#!/usr/bin/env python3
"""
estrai688.py - estrattore e decodificatore dei file di "688 Attack Sub"
(MS-DOS, Electronic Arts 1989, John W. Ratcliff & Paul Grace; Turbo C 1988 + asm).

Uso (Python 3.8+ e Pillow; la cartella originale si legge soltanto, non si modifica mai):
    python3 estrai688.py ORIG --verifica           impronte MD5 della copia; esce con 0 se è la versione supportata
    python3 estrai688.py ORIG --client [DIR]       asset per il browser (predefinita web/assets/originali/)
    python3 estrai688.py ORIG --fixture [DIR]      fixture delle prove dell'interprete CLS (tests/client/fixture/)
    python3 estrai688.py ORIG [OUT] [--no-render]  estrazione completa per la ricerca (predefinita ./out)
Con una copia non riconosciuta --client e --fixture si rifiutano, a meno di --forza. Uscita deterministica.
Formati, uscite e interprete: docs/ASSET.md (§4 i formati, §8 l'uscita per il client).

Everything below was reverse-engineered from the EXEPACK-unpacked GAME.EXE (see docs/ASSET.md
for the byte layouts and the code addresses each decoder was taken from).

Formats handled
  *.EXE  Microsoft EXEPACK  -> unpacked MZ (out/exe/), strings, data tables (out/exe/*.txt|json)
  *.MLB  library: u16 count, u16 6, count x {u32 offset, u32 size, char name[13]}   (out/raw/)
  *.LZW / *.LZA / HELICOP.ENC   LZW: u16 ncodes, u16 outsize, LSB-first codes packed in 16-bit
         words, 1st code 8 bits then 9..12 bits, dictionary reset when 4096 entries are used.
  "PIC" RLE images (*.ENC, decompressed *.LZW pictures, MAIN.EGA): u16 W, u16 H, then H+1 rows
         stored BOTTOM-UP, each row = ceil(W/2) bytes of packed 4-bit pixels (high nibble first),
         RLE per row: c<0x80 -> copy c+1 literal bytes, c>=0x80 -> repeat next byte (c&0x7f)+3 times.
  *.PAK + *.PAL  raw 320x200 8bpp + 768-byte 8-bit RGB palette.
  *.T    4-bit unsigned PCM, 2 samples/byte (high nibble first), played with a CPU-calibrated
         busy loop; the "rate" argument passed by the game is ~ samples/second -> WAV (8-bit).
  *.CLS and decompressed SCENE*.LZA / TARGETS.LZW / HELICOP.ENC: "CLS" display-list bytecode
         (screens, hotspots, briefing text) -> disassembly .txt, JSON for the client, and an exact
         render by InterpreteCLS (the reference the JavaScript interpreter is tested against).
  SCENE*.TOK  scenario bytecode (unit templates, AI scripts) -> disassembly + unit table.
  GAME.EXE font (DS:9D5C, 224 glyphs of 14 bytes, codes 20h-FFh) -> PNG sheet / atlas + JSON.
"""
import os, sys, struct, json, wave, collections, hashlib, re, io, base64, argparse, shutil

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit('Pillow is required (pip install pillow)')

# ----------------------------------------------------------------------------- EXEPACK
def exepack_unpack(data):
    """Return (image_bytes, relocs[(seg,off)], (cs,ip,ss,sp)) of an EXEPACK'd MZ file."""
    hdr_size = struct.unpack_from('<H', data, 8)[0] * 16
    e_lastp, e_np = struct.unpack_from('<HH', data, 2)
    img = data[hdr_size:(e_np - 1) * 512 + (e_lastp or 512)]
    e_ip, e_cs = struct.unpack_from('<HH', data, 0x14)
    xh = e_cs * 16
    if img[xh + 14:xh + 16] == b'RB':
        real_ip, real_cs, _m, _x, real_sp, real_ss, dest_len = struct.unpack_from('<7H', img, xh)
    elif img[xh + 16:xh + 18] == b'RB':
        real_ip, real_cs, _m, _x, real_sp, real_ss, dest_len, _s = struct.unpack_from('<8H', img, xh)
    else:
        return None
    packed = img[:xh]
    out_len = dest_len * 16
    buf = bytearray(max(out_len, len(packed)))
    buf[:len(packed)] = packed
    src = len(packed) - 1
    n = 0
    while n < 16 and buf[src] == 0xFF:
        src -= 1; n += 1
    dst = out_len - 1
    while True:
        cmd = buf[src]; length = buf[src - 2] | (buf[src - 1] << 8); src -= 3
        if cmd & 0xFE == 0xB0:
            val = buf[src]; src -= 1
            buf[dst - length + 1:dst + 1] = bytes([val]) * length; dst -= length
        elif cmd & 0xFE == 0xB2:
            buf[dst - length + 1:dst + 1] = buf[src - length + 1:src + 1]; dst -= length; src -= length
        else:
            raise ValueError('bad EXEPACK command')
        if cmd & 1:
            break
    stub = img[xh:]
    p = stub.find(b'Packed file is corrupt') + len(b'Packed file is corrupt')
    relocs = []
    for seg in range(16):
        cnt = struct.unpack_from('<H', stub, p)[0]; p += 2
        for _ in range(cnt):
            relocs.append((seg * 0x1000, struct.unpack_from('<H', stub, p)[0])); p += 2
    return bytes(buf[:out_len]), relocs, (real_cs, real_ip, real_ss, real_sp)

def build_mz(image, relocs, regs):
    cs, ip, ss, sp = regs
    hdr_par = (0x1c + len(relocs) * 4 + 15) // 16
    total = hdr_par * 16 + len(image)
    hdr = bytearray(hdr_par * 16)
    struct.pack_into('<2s13H', hdr, 0, b'MZ', total % 512, (total + 511) // 512, len(relocs), hdr_par,
                     0x1000, 0xFFFF, ss, sp, 0, ip, cs, 0x1c, 0)
    for i, (s, o) in enumerate(relocs):
        struct.pack_into('<HH', hdr, 0x1c + 4 * i, o, s)
    return bytes(hdr) + image

GAME_DS = 0x13060          # DGROUP paragraph 0x1306 (mov dx,1306h at entry) -> linear image offset

# ----------------------------------------------------------------------------- MLB
def read_mlb(path):
    d = open(path, 'rb').read()
    n, unk = struct.unpack_from('<HH', d, 0)
    members = []
    for i in range(n):
        off, size = struct.unpack_from('<II', d, 4 + i * 21)
        name = d[4 + i * 21 + 8:4 + i * 21 + 21].split(b'\0')[0].decode('latin1')
        members.append((name, off, size, d[off:off + size]))
    return members

# ----------------------------------------------------------------------------- LZW
def lzw_decode(data):
    """GAME.EXE far proc 1283:000D."""
    ncodes, outsize = struct.unpack_from('<HH', data, 0)
    pos = 4; bitbuf = 0; avail = 0
    def getbits(n):
        nonlocal pos, bitbuf, avail
        if avail >= n:
            r = bitbuf & ((1 << n) - 1); bitbuf >>= n; avail -= n; return r
        w = (data[pos] if pos < len(data) else 0) | ((data[pos + 1] if pos + 1 < len(data) else 0) << 8)
        pos += 2
        need = n - avail
        r = bitbuf | ((w & ((1 << need) - 1)) << avail)
        bitbuf = w >> need; avail = 16 - need
        return r
    prefix = [0xFFFF] * 4096; suffix = list(range(256)) + [0] * (4096 - 256)
    nxt, width, maxc = 0x100, 8, 0x100
    out = bytearray()
    def emit(c):
        s = []
        while c != 0xFFFF:
            s.append(suffix[c]); c = prefix[c]
        s.reverse(); out.extend(s); return s[0]
    old = getbits(width); fc = emit(old)
    for _ in range(ncodes - 1):
        if nxt == 0x1000:
            nxt, width, maxc = 0x100, 8, 0x100
        if nxt >= maxc:
            width += 1; maxc <<= 1
        code = getbits(width)
        if code == nxt:
            if nxt < 0x1000: prefix[nxt] = old; suffix[nxt] = fc; nxt += 1
            fc = emit(code)
        else:
            fc = emit(code)
            if nxt < 0x1000: prefix[nxt] = old; suffix[nxt] = fc; nxt += 1
        old = code
    return bytes(out), outsize

# ----------------------------------------------------------------------------- PIC (RLE 4bpp)
def pic_decode(d):
    """Returns (W, rows_topdown(list of lists of nibbles, len H+1), H). GAME.EXE 0000:B28F."""
    W, H = struct.unpack_from('<HH', d, 0)
    bpr = (W + 1) // 2
    pos = 4; rows = []
    for _ in range(H + 1):
        row = bytearray()
        while len(row) < bpr:
            c = d[pos]; pos += 1
            if c & 0x80:
                row += bytes([d[pos]]) * ((c & 0x7F) + 3); pos += 1
            else:
                row += d[pos:pos + c + 1]; pos += c + 1
        pix = []
        for b in row[:bpr]:
            pix += [b >> 4, b & 15]
        rows.append(pix[:max(W, 1)])
    rows.reverse()                    # stored bottom-up
    return W, rows, H

def is_pic(d):
    if len(d) < 6: return False
    W, H = struct.unpack_from('<HH', d, 0)
    if not (1 <= W <= 320 and 1 <= H <= 200): return False
    try:
        pic_decode(d); return True
    except Exception:
        return False

def pic_image(W, rows, palette, base=0, transparent=None):
    """palette: list of 256 (r,g,b); pixel index = base + nibble."""
    h = len(rows)
    if transparent is None:
        im = Image.new('P', (W, h))
        im.putpalette([c for rgb in palette for c in rgb])
        im.putdata([base + p for r in rows for p in r])
        return im
    im = Image.new('RGBA', (W, h))
    im.putdata([(0, 0, 0, 0) if p == transparent else palette[base + p] + (255,) for r in rows for p in r])
    return im

# ----------------------------------------------------------------------------- palettes
EGA16 = [(0, 0, 0), (0, 0, 0xAA), (0, 0xAA, 0), (0, 0xAA, 0xAA), (0xAA, 0, 0), (0xAA, 0, 0xAA), (0xAA, 0x55, 0),
         (0xAA, 0xAA, 0xAA), (0x55, 0x55, 0x55), (0x55, 0x55, 0xFF), (0x55, 0xFF, 0x55), (0x55, 0xFF, 0xFF),
         (0xFF, 0x55, 0x55), (0xFF, 0x55, 0xFF), (0xFF, 0xFF, 0x55), (0xFF, 0xFF, 0xFF)]

def load_pal(data):
    return [tuple(data[i * 3:i * 3 + 3]) for i in range(256)]

def ega_pal():
    return EGA16 + [(0, 0, 0)] * 240

# periscope sprite name prefix table (GAME.EXE DS:0F8C), index = unit type (TOK op 28h / field +4Fh)
PERI_PREFIX = ['FOREST', 'MERCH', 'CARGO', 'SMK', 'SFX2', 'KARA', 'KIROV', 'KRIVAK', 'NUCHKA', 'SLAVA',
               'NIMITZ', 'IOWA', 'KIDD', 'OHP', 'SAC', 'TARGET', 'TANKER', 'HORMON', 'SEAHAWK', 'MISSILE']
# VGA colour base used by GAME.EXE 0000:32E5 when drawing periscope sprites (type 3/4/19, others 90h)
PERI_BASE = {'SMK': 0x50, 'SFX2': 0xA0, 'MISSILE': 0xA7}

def classify_pic(name):
    """-> (kind, palette_key, base, transparent) for an image member."""
    n = name.upper()
    stem = n.split('.')[0].rstrip('0123456789')
    if n.startswith('SURF'):
        return 'bathymetry map', 'navmap', 0, None
    if n.startswith('CREW'):
        return 'crew photo', 'DAY', 0x90, None
    if n in ('MAIN.LZW', 'ALFA.LZW', 'MAIN.EGA'):
        return 'control room (16 colours)', 'EGA', 0, None
    if n.startswith('END'):
        return 'end-of-mission picture (16 colours)', 'EGA', 0, None
    if n.startswith('SUB'):
        return 'status-screen submarine profile', 'EGA', 0, 1
    for p in PERI_PREFIX:
        if stem == p or (p == 'SFX2' and stem == 'SFX'):
            if p == 'TARGET':
                break
            return 'periscope sprite', 'DAY', PERI_BASE.get(p, 0x90), 15
    return 'UI sprite (16 colours)', 'EGA', 0, None

# ----------------------------------------------------------------------------- sounds
SOUND_RATE = {'EXP1.T': 5000, 'SONAR1.T': 5500, 'TORPRAMP.T': 6500, 'PROP2.T': 3000, 'PROPV2.T': 2600,
              'WHALE2.T': 4500}
SOUND_NOTE = {
    'EXP1.T': 'explosion; played with rate 5000 (torpedo hit) and 4000 (0000:8C4C)',
    'SONAR1.T': 'active sonar ping; rate 5500 / 6200',
    'TORPRAMP.T': 'torpedo launch; rate 6500',
    'PROP2.T': 'propeller (sonar analysis, contact flag 8): rate = 2500 + 50*type, x4',
    'PROPV2.T': 'propeller (sonar analysis): rate = 2000 + 30*type (x4) or 5500 + 10*type (flag 10h, x5)',
    'WHALE2.T': 'whale song (type 25 BIOLOGICAL): rate = 2500 + random(4000), x2',
}

def t_to_wav(data, path, rate):
    samples = bytearray()
    for b in data:
        samples.append((b >> 4) * 17)
        samples.append((b & 15) * 17)
    w = wave.open(path, 'wb')
    w.setnchannels(1); w.setsampwidth(1); w.setframerate(rate); w.writeframes(bytes(samples)); w.close()

# ----------------------------------------------------------------------------- font
def load_font(game_img):
    """224 glifi (codici 20h-FFh), 14 byte ciascuno: larghezza + 13 righe (MSB = pixel di sinistra)."""
    base = GAME_DS + 0x9D5C
    glyphs = []
    for g in range(224):
        a = base + g * 14
        glyphs.append((game_img[a], game_img[a + 1:a + 14]))
    return glyphs

# ----------------------------------------------------------------------------- CLS bytecode
def load_cls_builtins(game_img):
    t = GAME_DS + 0x97A2
    n = game_img[t]; out = {}
    for i in range(n):
        off = struct.unpack_from('<H', game_img, t + 1 + 2 * i)[0]; a = t + off
        cnt = game_img[a]; h = struct.unpack_from('<H', game_img, a + 1)[0]
        tb = (game_img[a + 3] << 8) | game_img[a + 4]
        out[i + 1] = (cnt, h, [(tb >> (14 - 2 * k)) & 3 for k in range(cnt)])
    return out

# Mnemonici delle 31 primitive CLS (tabella DS:97A2). Tutte identificate leggendo il gestore di ognuna nel
# percorso VGA (modo video 5): vedi docs/ASSET.md §4.7 e InterpreteCLS qui sotto.
CLS_NAMES = {1: 'FILLRECT x1,y1,x2,y2,c', 2: 'VLINE x,y1,y2,c', 3: 'HLINE y,x1,x2,c', 4: 'PIXEL x,y,c',
             5: 'PRINT s', 6: 'MOVETO x,y', 7: 'DIGITBOX n,x,y,barra', 8: 'PRINT_SHADOW s,c,cshadow',
             9: 'RECT x1,y1,x2,y2,c', 10: 'HOTSPOT cursor,x1,y1,x2,y2,c,key,group', 11: 'SETMAP i,v',
             12: 'TEXTCOLOR c', 13: 'TEXTSPACING n', 14: 'CIRCLE x,y,r,c,mode', 15: 'RUN_CLS file',
             16: 'WAIT_INPUT a,b,c,d', 17: 'PAGE_BACK', 18: 'SHOW_BACK', 19: 'HIDE_MOUSE', 20: 'PICTURE file',
             21: 'HOTSPOT_TRUNC n', 22: 'CIRCLE_EDGE c', 23: 'SHOW_ZOOM', 24: 'SAVE_RECT x1,y1,x2,y2',
             25: 'RESTORE_RECT', 26: 'PRINT2 s', 27: 'TEXTWINDOW x1,y1,x2,y2', 28: 'SPRITE file,x,y,transp',
             29: 'TELETYPE s', 30: 'HELPWORD w', 31: 'HELPPAIR a,b'}
CLS_MNEMO = {k: v.split()[0] for k, v in CLS_NAMES.items()}

class CLS:
    def __init__(self, data, builtins):
        self.d = data; self.B = builtins
        n = data[0]
        self.descs = []
        for i in range(n):
            off = struct.unpack_from('<H', data, 1 + 2 * i)[0]
            cnt = data[off]; addr = struct.unpack_from('<H', data, off + 1)[0]
            tb = (data[off + 3] << 8) | data[off + 4] if off + 4 < len(data) else 0
            self.descs.append((cnt, addr, [(tb >> (14 - 2 * k)) & 3 for k in range(cnt)]))
        self.codebase = struct.unpack_from('<H', data, 1 + 2 * n)[0]

    def decode(self, pc):
        d = self.d; op = d[pc]; pc += 1
        if op == 0:
            return 0, None, [], pc
        if op < 0x80:
            cnt, _h, types = self.B[op]; kind = 'B'
        else:
            cnt, _a, types = self.descs[op & 0x7F]; kind = 'L'
        args = [None] * cnt
        if cnt:
            b1 = d[pc]; pc += 1
            if cnt > 4:
                mw = (b1 << 8) | d[pc]; pc += 1
            else:
                mw = (b1 << 8) | b1
            modes = [(mw >> (14 - 2 * k)) & 3 for k in range(cnt)]
            half = None
            for k in range(cnt):
                if modes[k]:
                    if half is None:
                        b = d[pc]; pc += 1; nib = b >> 4; half = b & 15
                    else:
                        nib = half; half = None
                    args[k] = ('P', nib)
            for k in range(cnt):
                if modes[k] == 1: continue
                t = types[k]
                if t == 1: v = d[pc]; pc += 1
                elif t == 2: v = struct.unpack_from('<H', d, pc)[0]; pc += 2
                else:
                    e = d.index(0, pc); v = d[pc:e].decode('latin1'); pc = e + 1
                if modes[k] == 0: args[k] = v
                elif modes[k] == 2: args[k] = ('P+', args[k][1], v)
                else: args[k] = ('P-', args[k][1], v)
        return op, kind, args, pc

    def entry(self, idx):
        return self.codebase if idx == 0 else self.codebase + self.descs[idx - 1][1]

    def listing(self):
        out = ['; %d local routines, code base %#x' % (len(self.descs), self.codebase)]
        for idx in range(len(self.descs) + 1):
            if idx == 0:
                out.append('; ---- main @ %#x' % self.entry(0))
            else:
                c, a, t = self.descs[idx - 1]
                out.append('; ---- routine L%02X (opcode %#x) nargs=%d argtypes=%s @ %#x' % (idx - 1, 0x80 + idx - 1, c, t, self.entry(idx)))
            pc = self.entry(idx)
            for _ in range(20000):
                if pc >= len(self.d): break
                op, kind, args, npc = self.decode(pc)
                if op == 0:
                    out.append('   %05x: END' % pc); break
                nm = ('B%02d %s' % (op, CLS_NAMES.get(op, '?').split()[0])) if kind == 'B' else 'CALL L%02X' % (op & 0x7F)
                out.append('   %05x: %-22s %r' % (pc, nm, args))
                pc = npc
        return out

# ----------------------------------------------------------------------------- interprete CLS di riferimento
def s16(v):
    """Parola a 16 bit con segno, come la vedono i confronti jl/jle/jg del gioco."""
    v &= 0xFFFF
    return v - 0x10000 if v & 0x8000 else v

# Tabella del cirillico finto: GAME.EXE DS:BD8B, 26 byte. Con il cirillico attivo (lato Alfa; Ctrl-R lo
# spegne) le lettere A-Z passano da qui, poi le cifre 4-9 (34h-39h) vengono spostate di +ADh sulle loro
# varianti E1h-E6h (0000:D67B). Le minuscole (maiuscole grandi, 61h-7Ah) restano latine.
def load_cirillico(game_img):
    a = GAME_DS + 0xBD8B
    return bytes(game_img[a:a + 26])

def cls_espandi_pic(d):
    """Righe di una figura PIC-RLE come le usa il disegnatore 0000:B28F: W, H dell'intestazione e le H+1
    righe memorizzate DAL BASSO, ognuna di ceil(W/2) byte = 2*ceil(W/2) pixel (il nibble di riempimento
    delle larghezze dispari viene disegnato anche lui)."""
    W, H = struct.unpack_from('<HH', d, 0)
    bpr = (W + 1) // 2
    pos = 4; righe = []
    for _ in range(H + 1):
        row = bytearray()
        while len(row) < bpr:
            c = d[pos]; pos += 1
            if c & 0x80:
                row += bytes([d[pos]]) * ((c & 0x7F) + 3); pos += 1
            else:
                row += d[pos:pos + c + 1]; pos += c + 1
        pix = bytearray()
        for b in row[:bpr]:
            pix += bytes((b >> 4, b & 15))
        righe.append(bytes(pix))
    return W, H, righe            # righe[0] = prima memorizzata = riga più in basso

class InterpreteCLS:
    """Interprete di riferimento degli script CLS, fedele al percorso VGA (modo 5) di GAME.EXE.

    Riproduce l'interprete 0000:BB44 e le 31 primitive della tabella DS:97A2 così come le esegue il gioco,
    comprese le stranezze (vedi docs/ASSET.md §4.7): pagine 'schermo' (A000h) e 'retro' (buffer in RAM)
    modellate come segmenti lineari di 64 KB, nessun ritaglio (il flag DS:B456 lo accende solo il codice C
    del gioco), testo con a capo e ritorno in cima alla finestra, grassetto a doppia passata, cirillico finto.
    È il riferimento con cui si confronta, pixel per pixel, l'interprete JavaScript del client."""

    def __init__(self, font, programmi, figure, tab_cirillico, cirillico=False):
        self.font = font                    # 224 glifi (larghezza, 13 byte di righe), codici 20h-FFh
        self.tab_cirillico = tab_cirillico  # DS:BD8B
        self.programmi = programmi          # nome maiuscolo -> CLS
        self.figure = figure                # nome maiuscolo -> byte PIC-RLE (già decompressi se LZW)
        self.pagine = {'schermo': bytearray(65536), 'retro': bytearray(65536)}
        self.pagina = 'schermo'
        # variabili del gioco: colore BD75, spaziatura BD71, interlinea BD73, cursore BD6D/BD6F,
        # finestra BD78/BD7C/BD7A/BD7E, grassetto BD86, cirillico BD89, colore del bordo dei cerchi BD76
        self.colore = 15; self.spaziatura = 1; self.interlinea = 9
        self.x = 0; self.y = 0
        self.fin = [0, 0, 319, 199]
        self.grassetto = 0; self.cirillico = 1 if cirillico else 0; self.colore_bordo = 15
        self.hotspot = []                   # nell'ordine di registrazione (il gioco prova prima l'ultimo)
        self.tabella = {}                   # SETMAP: DS:B45A (CGA, configurazione missione, anticopia)
        self.salvato = None                 # rettangolo di SAVE_RECT
        self.agganci = []                   # eventi e regioni da riempire con lo stato vivo
        self.parole = []; self.coppie = []  # liste dell'aiuto (HELPWORD, HELPPAIR)
        self.anomalie = collections.Counter()
        self.profondita = 0

    # ---------------------------------------------------------------- memoria video
    def _scrivi(self, x, y, c):
        if not (0 <= x < 320 and 0 <= y < 200):
            self.anomalie['scrittura fuori schermo'] += 1
        self.pagine[self.pagina][(y * 320 + x) & 0xFFFF] = c & 0xFF

    def copia(self, da, a, x1, y1, x2, y2):
        """0000:A623: copia di un rettangolo (estremi inclusi) fra le due pagine."""
        src = self.pagine[da]; dst = self.pagine[a]
        for yy in range(y1, y2 + 1):
            for xx in range(x1, x2 + 1):
                o = (yy * 320 + xx) & 0xFFFF
                dst[o] = src[o]

    # ---------------------------------------------------------------- primitive grafiche
    def riempi(self, x1, y1, x2, y2, c):
        if x1 > x2: x1, x2 = x2, x1
        if y1 > y2: y1, y2 = y2, y1
        for yy in range(y1, y2 + 1):
            for xx in range(x1, x2 + 1):
                self._scrivi(xx, yy, c)

    def hline(self, y, x1, x2, c):
        if x2 < x1: x1, x2 = x2, x1
        for xx in range(x1, x2 + 1):
            self._scrivi(xx, y, c)

    def vline(self, x, y1, y2, c):
        if y2 < y1: y1, y2 = y2, y1
        for yy in range(y1, y2 + 1):
            self._scrivi(x, yy, c)

    def pixel(self, x, y, c):
        self._scrivi(x, y, c)

    def rett(self, x1, y1, x2, y2, c):
        """0000:E838: due HLINE e due VLINE."""
        self.hline(y1, x1, x2, c); self.hline(y2, x1, x2, c)
        self.vline(x1, y1, y2, c); self.vline(x2, y1, y2, c)

    def cerchio(self, cx, cy, r, c, modo):
        """0000:EA36. modo 0: contorno di 8 pixel per passo nel colore di CIRCLE_EDGE (non c!);
        modo 1: pieno di colore c; modo 2: pieno e poi contorno."""
        x, y, d1, d2, err = r, 0, 2 * r - 1, 1, 0
        while x >= y:
            if modo:
                self.hline(cy + y, cx - x, cx + x, c); self.hline(cy - y, cx - x, cx + x, c)
                self.hline(cy + x, cx - y, cx + y, c); self.hline(cy - x, cx - y, cx + y, c)
            else:
                b = self.colore_bordo
                for px, py in ((x, y), (-x, y), (x, -y), (-x, -y), (y, x), (-y, x), (y, -x), (-y, -x)):
                    self.pixel(cx + px, cy + py, b)
            err += d2; d2 += 2; y += 1
            if err >= x:
                err -= d1; d1 -= 2; x -= 1
        if modo == 2:
            self.cerchio(cx, cy, r, c, 0)

    def incasso(self, x1, y1, x2, y2):
        """0000:ED31: riquadro incassato (fondo nero, ombra grigia in alto a sinistra, luce bianca)."""
        self.riempi(x1 + 1, y1 + 1, x2 - 1, y2 - 1, 0)
        self.hline(y1, x1, x2, 8); self.hline(y2, x1 + 1, x2, 15)
        self.vline(x1, y1, y2, 8); self.vline(x2, y1 + 1, y2, 15)

    def figura(self, nome, x, y, trasp):
        """SPRITE (0000:EFB9 -> 0000:B28F): base in basso a y+H, H righe disegnate dal basso verso l'alto;
        l'ultima riga memorizzata (quella in cima) non viene disegnata. Colore = nibble (base 0)."""
        d = self.figure.get(nome.upper())
        if d is None:
            self.anomalie['figura mancante ' + nome] += 1; return
        W, H, righe = cls_espandi_pic(d)
        yb = y + H; limite = yb - H; resto = H; k = 0
        while True:
            row = righe[k] if k < len(righe) else b''
            for i, p in enumerate(row):
                if trasp != 0xFF and p == trasp:
                    continue
                self._scrivi(x + i, yb, p)
            if yb == limite:
                break
            yb -= 1; resto = (resto - 1) & 0xFFFF; k += 1
            if resto == 0:
                break

    # ---------------------------------------------------------------- testo (0000:D630)
    def a_capo(self):
        """0000:D8D8: torna al bordo sinistro; se la riga dopo non ci sta, ricomincia dall'alto."""
        self.x = self.fin[0]
        yy = self.y + 2 * self.interlinea
        if yy > self.fin[3]:
            yy = self.fin[1] + self.interlinea
        self.y = yy - self.interlinea

    def _glifo(self, codice):
        g = codice - 0x20
        if not 0 <= g < len(self.font):
            self.anomalie['glifo inesistente %#x' % codice] += 1
            return None
        return self.font[g]

    def stampa(self, s):
        s = s.encode('latin1') if isinstance(s, str) else bytes(s)
        n = len(s); i = 0
        while True:
            bl = s[i] if i < n else 0
            dopo = s[i + 1] if i + 1 < n else 0
            if bl != 0x40:
                if self.cirillico:
                    if 0x41 <= bl <= 0x5A:
                        bl = self.tab_cirillico[bl - 0x41]
                    if 0x34 <= bl <= 0x39:
                        bl += 0xAD
                if bl < 0x20:
                    if bl == 10:
                        self.a_capo(); i += 1; continue
                    if bl == 0:
                        return
            if bl < 0x20 or bl == 0x40:
                # '@' (o un carattere di controllo): '@@' stampa '@', altrimenti commuta il grassetto
                if dopo == 0x40:
                    i += 1
                else:
                    self.grassetto ^= 1; i += 1; continue
            x0, y0 = self.x, self.y
            seconda = False
            while True:
                gl = self._glifo(bl)
                if gl is None:
                    break
                w, righe = gl
                if self.x + w + self.spaziatura > self.fin[2]:
                    self.a_capo()
                for r in range(13):
                    b = righe[r]
                    if b:
                        for bit in range(8):
                            if b & (0x80 >> bit):
                                self._scrivi(self.x + bit, self.y + r, self.colore)
                self.x = s16(self.x + w + self.spaziatura)
                if seconda or not self.grassetto:
                    break
                # seconda passata del grassetto: un pixel più a destra, dalla posizione salvata PRIMA
                # dell'eventuale a capo, e con il carattere NON rimappato dal cirillico (0000:D8CD)
                seconda = True
                self.x, self.y = x0 + 1, y0
                bl = s[i] if i < n else 0
            i += 1

    def stampa_ombra(self, s, c, c_ombra):
        """0000:EC97: tre passate d'ombra (+1,0), (+1,+1), (0,+1) e poi il testo."""
        x0, y0 = self.x, self.y
        self.colore = c_ombra & 0xFF
        for dx, dy in ((1, 0), (1, 1), (0, 1)):
            self.x, self.y = x0 + dx, y0 + dy
            self.stampa(s)
        self.x, self.y = x0, y0
        self.colore = c & 0xFF
        self.stampa(s)

    def casella_cifra(self, n, x, y, barra):
        """0000:EBF4 (DIGITBOX): riquadro incassato con una cifra grande (glifo 87h+n) e, se barra,
        un secondo riquadro con la barra grigia. Usato per tubi, missili, proiezione temporale: la cifra e
        la barra poi le ridisegna il codice del gioco con lo stato vivo."""
        car = (0x87 + n) & 0xFF
        self.colore = 15
        self.incasso(x, y, x + 10, y + 10)
        regione = {'tipo': 'cifra', 'x1': x, 'y1': y, 'x2': x + 10, 'y2': y + 10, 'valore': n}
        if barra:
            self.incasso(x + 13, y - 1, x + 59, y + 10)
            self.riempi(x + 15, y + 1, x + 57, y + 8, 8)
            regione['barra'] = [x + 15, y + 1, x + 57, y + 8]
        self.agganci.append(regione)
        self.x, self.y = x + 2, y + 2
        self.stampa(bytes((car,)))

    # ---------------------------------------------------------------- esecuzione
    def esegui(self, nome, routine=0, parametri=()):
        prog = self.programmi[nome.upper()] if isinstance(nome, str) else nome
        self._routine(prog, routine, [s16(p) if isinstance(p, int) else p for p in parametri])

    def _routine(self, prog, idx, par):
        if self.profondita > 32:
            self.anomalie['ricorsione'] += 1; return
        self.profondita += 1
        pc = prog.entry(idx)
        while True:
            op, kind, args, pc = prog.decode(pc)
            if op == 0:
                break
            vals = []
            for a in args:
                if isinstance(a, tuple):
                    if a[1] < len(par):
                        pv = par[a[1]]
                    else:
                        pv = 0; self.anomalie['parametro mancante'] += 1
                    if a[0] == 'P':
                        v = pv
                    elif isinstance(pv, str):
                        v = pv[a[2]:] if a[0] == 'P+' else pv     # aritmetica sui puntatori: mai usata
                    else:
                        v = s16(pv + a[2]) if a[0] == 'P+' else s16(pv - a[2])
                    vals.append(v)
                else:
                    vals.append(s16(a) if isinstance(a, int) else a)
            if kind == 'L':
                self._routine(prog, (op & 0x7F) + 1, vals)
            else:
                self.primitiva(op, vals)
        self.profondita -= 1

    def primitiva(self, op, v):
        if op == 1: self.riempi(*v)
        elif op == 2: self.vline(*v)
        elif op == 3: self.hline(*v)
        elif op == 4: self.pixel(*v)
        elif op in (5, 26): self.stampa(v[0])
        elif op == 6: self.x, self.y = v
        elif op == 7: self.casella_cifra(*v)
        elif op == 8: self.stampa_ombra(*v)
        elif op == 9: self.rett(*v)
        elif op == 10:
            cur, x1, y1, x2, y2, c, tasto, gruppo = v
            self.hotspot.append({'cursore': cur, 'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
                                 'colore': c & 0xFF, 'tasto': tasto & 0xFF, 'gruppo': gruppo & 0xFF})
        elif op == 11: self.tabella[v[0] & 0xFFFF] = v[1] & 0xFF
        elif op == 12: self.colore = v[0] & 0xFF
        elif op == 13: self.spaziatura = v[0]
        elif op == 14: self.cerchio(*v)
        elif op == 15: self.agganci.append({'tipo': 'esegui_cls', 'file': v[0]})   # mai usata negli script
        elif op == 16: self.agganci.append({'tipo': 'attesa', 'argomenti': list(v)})
        elif op == 17: self.pagina = 'retro'
        elif op in (18, 23):
            # SHOW_BACK copia tutta la pagina di retro sullo schermo; SHOW_ZOOM fa lo stesso con un'apertura
            # animata dal centro della finestra e finisce con SHOW_BACK (0000:F0CD -> 0000:E9B4)
            self.copia('retro', 'schermo', 0, 0, 319, 199)
            self.pagina = 'schermo'
            self.agganci.append({'tipo': 'mostra', 'animazione': op == 23})
        elif op == 19: pass                     # nasconde il puntatore del mouse (12C2:032B): niente da disegnare
        elif op == 20: self.agganci.append({'tipo': 'immagine', 'file': v[0]})        # mai usata negli script
        elif op == 21:
            if v[0] < len(self.hotspot):
                del self.hotspot[max(v[0], 0):]
        elif op == 22: self.colore_bordo = v[0] & 0xFF
        elif op == 24:
            self.salvato = list(v)
            self.copia('schermo', 'retro', *v)
        elif op == 25:
            if self.salvato is not None and self.salvato[0] >= 0:
                self.copia('retro', 'schermo', *self.salvato)
            self.salvato = None
        elif op == 27:
            self.fin = list(v); self.x, self.y = v[0], v[1]
        elif op == 28: self.figura(v[0], v[1], v[2], v[3] & 0xFF)
        elif op == 29: self.agganci.append({'tipo': 'telescrivente', 'testo': v[0], 'colore': self.colore})
        elif op == 30: self.parole.append(v[0] & 0xFFFF)
        elif op == 31: self.coppie.append([v[0] & 0xFF, v[1] & 0xFF])
        else:
            self.anomalie['primitiva sconosciuta %d' % op] += 1

    def esegui_passi(self, passi, sfondi=None):
        """Esegue la sequenza di un lavoro (vedi LAVORI_CLS): chiamate di routine, primitive chiamate
        direttamente dal codice del gioco, cambi di pagina, sfondi."""
        for p in passi:
            if 'file' in p:
                self.esegui(p['file'], p.get('routine', 0), p.get('argomenti', ()))
            elif 'primitiva' in p:
                op = {m: k for k, m in CLS_MNEMO.items()}[p['primitiva']]
                self.primitiva(op, [s16(a) if isinstance(a, int) else a for a in p.get('argomenti', ())])
            elif 'pagina' in p:
                self.pagina = p['pagina']
            elif 'sfondo' in p:
                if sfondi and p['sfondo'] in sfondi:
                    self.pagine[self.pagina][:64000] = sfondi[p['sfondo']]
                self.agganci.append({'tipo': 'sfondo', 'file': p['sfondo']})

    def immagine(self, pagina, palette):
        im = Image.frombytes('P', (320, 200), bytes(self.pagine[pagina][:64000]))
        im.putpalette([c for rgb in palette for c in rgb])
        return im


# Lavori di resa: come GAME.EXE compone ogni schermata con gli script (0000:1196 per le stazioni:
# STAT.CLS routine 1/2 = cornice 688/Alfa, poi <STAZIONE>.CLS routine 3/4; 0000:8342 per i dialoghi:
# pagina schermo, hotspot modale a tutto schermo, routine con (x, y), finestra di testo di nuovo piena).
# 'mostra' è la pagina che il giocatore vede alla fine; 'dosbox' la cattura corrispondente, se c'è.
STAZIONI = [('PERI', 'Periscopio'), ('SONAR', 'Sonar'), ('NAV', 'Navigazione'), ('WCR', 'Controllo armi'),
            ('RADIO', 'Sala radio'), ('STEER', 'Governo (Ship\'s Control)')]
DOSBOX_STAZIONI = {('PERI', '688'): '032_periscope_down.png', ('SONAR', '688'): '046_sonar_room.png',
                   ('NAV', '688'): '021_navigation_board.png', ('WCR', '688'): '052_weapons_control.png',
                   ('RADIO', '688'): '008_radio_keycode.png', ('STEER', '688'): '013_ship_control.png',
                   ('PERI', 'alfa'): '089_alfa_periscope_cyrillic.png', ('SONAR', 'alfa'): '092_alfa_sonar_cyrillic.png',
                   ('NAV', 'alfa'): '090_alfa_navigation_cyrillic.png', ('WCR', 'alfa'): '091_alfa_weapons_cyrillic.png',
                   ('RADIO', 'alfa'): '085_alfa_radio_keycode.png', ('STEER', 'alfa'): '088_alfa_ship_control_cyrillic.png',
                   ('PERI', 'alfa_latino'): None, ('SONAR', 'alfa_latino'): '097_alfa_sonar_latin.png',
                   ('NAV', 'alfa_latino'): '095_alfa_navigation_latin.png', ('WCR', 'alfa_latino'): '096_alfa_weapons_latin.png',
                   ('RADIO', 'alfa_latino'): None, ('STEER', 'alfa_latino'): '093_alfa_ship_control_latin.png'}
# dialoghi: routine (1 = L00) -> posizione con cui li apre il gioco (chiamate a 0000:8342); gli altri a (40, 40)
DIALOGHI_POS = {2: (185, 35), 3: (20, 20)}
DOSBOX_DIALOGHI = {1: '081_end_of_mission_dialog.png',
                   22: '102_modem_establishing_channel.png', 21: '103_modem_failure_to_communicate.png'}

def lavori_cls(programmi):
    lav = []
    for st, titolo in STAZIONI:
        for lato, r_stat, r_st, cir in (('688', 1, 3, False), ('alfa', 2, 4, True), ('alfa_latino', 2, 4, False)):
            lav.append({'id': '%s_%s' % (st, lato), 'titolo': '%s (%s)' % (titolo, {'688': '688', 'alfa': 'Alfa',
                        'alfa_latino': 'Alfa, scritte latine con Ctrl-R'}[lato]),
                        'cirillico': cir, 'mostra': 'retro', 'dosbox': DOSBOX_STAZIONI.get((st, lato)),
                        'passi': [{'pagina': 'schermo'}, {'file': 'STAT.CLS', 'routine': r_stat},
                                  {'file': st + '.CLS', 'routine': r_st}]})
    lav.append({'id': 'STATUS_688', 'titolo': 'Status (688)', 'cirillico': False, 'mostra': 'schermo',
                'dosbox': '011_status_panel.png', 'passi': [{'file': 'STATUS.CLS', 'routine': 0}]})
    lav.append({'id': 'STATUS_alfa', 'titolo': 'Status (Alfa)', 'cirillico': True, 'mostra': 'schermo',
                'dosbox': '087_alfa_status.png', 'passi': [{'file': 'STATUS.CLS', 'routine': 0}]})
    lav.append({'id': 'REVIEW', 'titolo': 'Riesame dei messaggi (solo hotspot)', 'cirillico': False,
                'mostra': 'schermo', 'dosbox': None, 'passi': [{'file': 'REVIEW.CLS', 'routine': 0}]})
    for lato, pak, r, cir, shot in (('688', '688.PAK', 1, False, '004_conn_688.png'),
                                     ('alfa', 'ALFA.PAK', 2, True, '083_alfa_conn.png')):
        lav.append({'id': 'CONN_%s' % lato, 'titolo': 'Sala comando (%s): hotspot' % ('688' if lato == '688' else 'Alfa'),
                    'cirillico': cir, 'mostra': 'schermo', 'dosbox': shot,
                    'passi': [{'pagina': 'schermo'}, {'sfondo': pak}, {'file': 'M.CLS', 'routine': r}]})
    lav.append({'id': 'SELECT_missione', 'titolo': 'Selezione della missione', 'cirillico': False,
                'mostra': 'schermo', 'dosbox': '002_mission_selection.png',
                'passi': [{'pagina': 'schermo'}, {'file': 'SELECT.CLS', 'routine': 1}]})
    lav.append({'id': 'SELECT_configurazione', 'titolo': 'Pannello di configurazione', 'cirillico': False,
                'mostra': 'retro', 'dosbox': '003_config_panel.png',
                'passi': [{'pagina': 'schermo'}, {'file': 'SELECT.CLS', 'routine': 2}]})
    dlg = programmi['DIALOG.CLS']
    for i, (nargs, _a, tipi) in enumerate(dlg.descs):
        r = i + 1
        if nargs != 2:
            continue                        # L17-L1C: modelli interni con testo come parametro
        x, y = DIALOGHI_POS.get(r, (40, 40))
        lav.append({'id': 'DIALOG_%02d' % r, 'titolo': 'Dialogo %d (L%02X) in (%d, %d)' % (r, i, x, y),
                    'cirillico': False, 'mostra': 'schermo', 'dosbox': DOSBOX_DIALOGHI.get(r),
                    'passi': [{'pagina': 'schermo'},
                              {'primitiva': 'HOTSPOT', 'argomenti': [0, 0, 0, 319, 199, 15, 0, 0]},
                              {'file': 'DIALOG.CLS', 'routine': r, 'argomenti': [x, y]},
                              {'primitiva': 'TEXTWINDOW', 'argomenti': [0, 0, 319, 199]}]})
    return lav

# ----------------------------------------------------------------------------- TOK bytecode
TOK_FMT = {
 0x01:'w',0x02:'ww',0x03:'w',0x04:'b',0x05:'b',0x06:'w',0x07:'w',0x08:'w',0x09:'w',0x0a:'w',0x0b:'w',
 0x0c:'b',0x0d:'b',0x0e:'b',0x0f:'b',0x10:'',0x11:'',0x12:'wwww',0x13:'b',0x14:'ww',0x15:'',0x16:'',
 0x17:'w',0x18:'w',0x19:'w',0x1a:'wb',0x1b:'',0x1c:'www',0x1d:'www',0x1e:'w',0x1f:'wwwwww',0x20:'w',
 0x21:'w',0x22:'ww',0x23:'b',0x24:'w',0x25:'wwwwwww',0x26:'wwwwww',0x27:'',0x28:'b',0x29:'b',0x2a:'',
 0x2b:'w',0x2c:'',0x2d:'ww',0x2e:'',0x2f:'b',0x30:'b',0x31:'wwwwww',0x32:'',0x33:'b',0x34:'',0x35:'w',
 0x36:'w',0x37:'',0x38:'b',0x39:'b',0x3a:'www',0x3b:'bww',0x3c:'w',0x3d:'w',0x3e:'w',0x3f:'w',0x40:'w',
 0x41:'w',0x42:'w',0x43:'w',0x44:'bw',0x45:'ww',0x46:'b',0x47:'bw',0x48:'ww',0x49:'',0x4a:'ww',0x4b:'ww',
 0x4c:'ww',0x4d:'w',0x4e:'www',0x4f:'www',0x50:'www',0x51:'w',0x52:'ww',0x53:'ww',0x54:'wb',0x55:'b',
 0x56:'w',0x57:'',0x58:'www',0x59:'',0x5a:'',0x5b:'',0x5c:'b',0x5d:'wwwww',0x5e:'w',0x5f:'',0x60:'',
 0x61:'',0x62:'',0x63:'w',0x64:'ww',0x65:'wwww',0x66:'',0x67:'',0x68:'w',0x69:'w',0x6a:'b',0x6b:'',
 0x6c:'ww',0x6d:'wb',0x6e:'b',0x6f:'b',0x70:'',0x71:'',0x72:'',0x73:'',0x74:'w',0x75:'w',0x76:'ww',
}
# names: field offsets refer to the 100-byte unit record (DS:2BEE while being built)
TOK_NAME = {
 0x01:'CALL', 0x02:'POS x,y', 0x03:'DEPTH', 0x04:'CAT(+4)', 0x05:'FLAGS', 0x06:'COURSE', 0x07:'SPEED',
 0x08:'DEPTHRATE(+38)', 0x09:'TURNRATE(+3E)', 0x0a:'ACCEL(+40)', 0x0b:'MAXSPEED(+42)', 0x0c:'NOISE?(+3A)',
 0x0d:'SENSOR?(+3B)', 0x0e:'B3C', 0x0f:'PKILL?(+3D)', 0x10:'CREATE_UNIT', 0x11:'NEW_UNIT', 0x12:'MOVE_TO x,y,spd,sub',
 0x13:'SONARCLASS(+4C)', 0x14:'TIMER t,sub', 0x15:'UPDATE', 0x16:'CLONE', 0x17:'SET+24', 0x18:'SET+2A',
 0x19:'TURN_TO course', 0x1a:'SET_DEPTH_TO d,rate', 0x1b:'SELECT_LAST', 0x1c:'ORDER_1c', 0x1d:'ORDER_1d',
 0x1e:'ONTICK sub', 0x1f:'EVENTS_A', 0x20:'SET+36', 0x21:'SPEED_TO frac/abs', 0x22:'DEPTH_TO d,?',
 0x23:'MSG', 0x24:'SET+34', 0x25:'EVENTS_C', 0x26:'EVENTS_D', 0x27:'STOP_TURN', 0x28:'TYPE(+4F)',
 0x29:'B3C', 0x2a:'REPORT_KILL', 0x2b:'CANCEL_TIMER sub', 0x2c:'CANCEL_TIMERS', 0x2d:'LAUNCH sub,sub',
 0x2e:'BREAK', 0x2f:'FLAG54.1', 0x30:'FLAG54.0', 0x31:'EVENTS_B', 0x32:'CLR_ONTICK', 0x33:'TARGET_LAST',
 0x34:'SAVE_CONTACT', 0x35:'MAXDEPTH(+5A)', 0x36:'CONTACT id', 0x37:'OP37', 0x38:'HP(+07)', 0x39:'OR_FLAGS4E',
 0x3a:'TABLE_1F48', 0x3b:'CONTACT_B16 v,sub,sub', 0x3c:'IFC_FAST goto', 0x3d:'IFC_DEEP goto', 0x3e:'IFC_WEAPON goto',
 0x3f:'IFC_HOSTILE goto', 0x40:'IFC_SURFACE goto', 0x41:'IFC_NEUTRAL goto', 0x42:'IFC_F14 goto', 0x43:'GOTO',
 0x44:'IF_RND>=p goto', 0x45:'IF_ID goto', 0x46:'STATE=', 0x47:'IF_STATE goto', 0x48:'IF_ALIVE id goto',
 0x49:'STATE++', 0x4a:'IF_ID2 goto', 0x4b:'IFC_ID goto', 0x4c:'CTR=', 0x4d:'CTR++', 0x4e:'IF_CTR> goto',
 0x4f:'IF_CTR< goto', 0x50:'IF_CTR== goto', 0x51:'CTR--', 0x52:'IF_DEAD id goto', 0x53:'IFC_NEAR d goto',
 0x54:'ATTACK', 0x55:'MSG2', 0x56:'IFC_TARGETS_ME goto', 0x57:'OP57', 0x58:'EVENTS_E', 0x59:'OP59', 0x5a:'OP5A',
 0x5b:'OP5B', 0x5c:'FLAG54.2', 0x5d:'IF_IN_BOX x1,y1,x2,y2 goto', 0x5e:'IFC_AIR goto', 0x5f:'STATE--',
 0x60:'RANDOMIZE', 0x61:'TURN_TO_CONTACT', 0x62:'HOLD', 0x63:'TURN_BY', 0x64:'CHASE_CONTACT', 0x65:'CMP_CTRS',
 0x66:'MATCH_DEPTH', 0x67:'MATCH_SPEED', 0x68:'IF_PLAYER1 goto', 0x69:'IF_NOT_MODEM goto', 0x6a:'ATTACK_RND',
 0x6b:'OP6B', 0x6c:'IF_X> goto', 0x6d:'IF_BIT goto', 0x6e:'BIT_SET', 0x6f:'BIT_CLR', 0x70:'CLR+2C',
 0x71:'TURN_AWAY', 0x72:'OP72', 0x73:'OP73', 0x74:'SELECT id', 0x75:'CODE_CHECKSUM goto', 0x76:'SET_1F6A',
}

def tok_decode(d, pc):
    op = d[pc]
    if op == 0: return 0, [], pc + 1
    f = TOK_FMT[op]; p = pc + 1; args = []
    for c in f:
        if c == 'b': args.append(d[p]); p += 1
        else: args.append(struct.unpack_from('<H', d, p)[0]); p += 2
    return op, args, p

def tok_listing(d):
    out = []; pc = 0
    while pc < len(d):
        op, args, npc = tok_decode(d, pc)
        if op == 0: out.append('%04x: RET' % pc)
        else:
            out.append('%04x: %02x %-26s %s' % (pc, op, TOK_NAME[op],
                       ', '.join(str(a) if TOK_FMT[op][i] == 'b' else '%#06x' % a for i, a in enumerate(args))))
        pc = npc
    return out

def dms(v):
    s = v * 2
    return '%02d:%02d:%02d' % (s // 3600, s // 60 % 60, s % 60)

def tok_units(d, names):
    """Abstract interpretation of the scenario setup code: follows CALLs, does NOT evaluate branches
    (random start positions, modem-only overrides...), so every value written to a field between
    NEW_UNIT and CREATE_UNIT is kept in order; the last one is what a straight run would leave."""
    units = []
    FIELD = {0x03: 'depth', 0x06: 'course', 0x07: 'speed', 0x08: 'depth_rate', 0x09: 'turn_rate', 0x0a: 'accel',
             0x0b: 'max_speed', 0x35: 'max_depth', 0x13: 'sonar_class', 0x04: 'cat', 0x05: 'flags', 0x0c: 'noise_b3a',
             0x0d: 'sensor_b3b', 0x0e: 'b3c', 0x29: 'b3c', 0x0f: 'pkill_b3d', 0x28: 'type', 0x38: 'hit_points'}
    def run(pc, cur, depth=0):
        for _ in range(4000):
            if pc >= len(d): return
            op, args, npc = tok_decode(d, pc)
            if op == 0: return
            if op == 0x01 and depth < 6:
                run(args[0], cur, depth + 1)
            elif op == 0x11:
                cur.clear()
            elif op == 0x02:
                cur.setdefault('pos', []).append((args[0], args[1]))
            elif op in FIELD:
                cur.setdefault(FIELD[op], []).append(args[0])
            elif op == 0x12:
                cur.setdefault('move_to', []).append((args[0], args[1]))
            elif op == 0x10:
                u = {k: list(v) for k, v in cur.items()}; u['at'] = pc; units.append(u)
                cur.pop('pos', None)
            elif op == 0x43:
                return
            pc = npc
    pc = 0
    while pc < len(d) and d[pc] in (0x1f, 0x31, 0x58, 0x25, 0x26, 0x3a):
        _, _, pc = tok_decode(d, pc)
    run(pc, {})
    conv = {'depth': lambda v: v / 8.0, 'max_depth': lambda v: v / 8.0, 'speed': lambda v: round(v / 320.0, 2),
            'max_speed': lambda v: round(v / 320.0, 2), 'course': lambda v: round((90 - v / 25.0) % 360, 1)}
    rows = []
    for i, u in enumerate(units):
        t = u.get('type', [None])[-1]
        fl = u.get('flags', [0])[-1]
        row = {'n': i, 'code_offset': '%#x' % u['at'], 'type': t,
               'type_name': names[t] if t is not None and t < len(names) else '?',
               'flags': fl, 'domain': {1: 'sub', 2: 'surface', 3: 'air'}.get(fl & 3, '-'),
               'side': 'NATO' if fl & 8 else ('USSR/opponent' if fl & 0x10 else '-'), 'weapon': bool(fl & 0x20),
               'start_positions': ['%d,%d (%sX %sY)' % (x, y, dms(x), dms(y)) for x, y in u.get('pos', [])],
               'move_to': ['%d,%d' % xy for xy in u.get('move_to', [])]}
        for k in ('max_speed', 'max_depth', 'hit_points', 'noise_b3a', 'sensor_b3b', 'b3c', 'pkill_b3d', 'turn_rate',
                  'depth_rate', 'accel', 'speed', 'depth', 'course', 'sonar_class', 'cat'):
            if k in u:
                vals = [conv[k](v) if k in conv else v for v in u[k]]
                row[k] = vals[-1] if len(vals) == 1 else '|'.join(str(v) for v in vals)
            else:
                row[k] = None
        rows.append(row)
    return rows

def tok_templates(d, names):
    """Every NEW_UNIT block anywhere in the file (incl. weapons spawned by event handlers),
    walked linearly (CALLs followed) until RET/CREATE_UNIT/GOTO."""
    FIELD = {0x03: 'depth', 0x06: 'course', 0x07: 'speed', 0x08: 'depth_rate', 0x09: 'turn_rate', 0x0a: 'accel',
             0x0b: 'max_speed', 0x35: 'max_depth', 0x13: 'sonar_class', 0x05: 'flags', 0x0c: 'noise_b3a',
             0x0d: 'sensor_b3b', 0x0e: 'b3c', 0x29: 'b3c', 0x0f: 'pkill_b3d', 0x28: 'type', 0x38: 'hit_points'}
    starts = []; pc = 0
    while pc < len(d):
        op, args, npc = tok_decode(d, pc)
        if op == 0x11: starts.append(pc)
        pc = npc
    out = []
    for st in starts:
        cur = {}
        def run(pc, depth=0):
            for _ in range(500):
                op, args, npc = tok_decode(d, pc)
                if op in (0, 0x10, 0x43): return
                if op == 0x01 and depth < 4: run(args[0], depth + 1)
                elif op in FIELD: cur[FIELD[op]] = args[0]
                pc = npc
        run(st)
        if 'type' not in cur: continue
        t = cur['type']; fl = cur.get('flags', 0)
        out.append({'at': '%#x' % st, 'type': t, 'type_name': names[t] if t < len(names) else '?', 'flags': fl,
                    'weapon': bool(fl & 0x20), 'max_speed_kt': cur.get('max_speed', 0) / 320.0 if 'max_speed' in cur else None,
                    'max_depth_ft': cur['max_depth'] / 8.0 if 'max_depth' in cur else None,
                    'hit_points': cur.get('hit_points'), 'noise_b3a': cur.get('noise_b3a'), 'sensor_b3b': cur.get('sensor_b3b'),
                    'pkill_b3d': cur.get('pkill_b3d'), 'turn_rate': cur.get('turn_rate'), 'depth_rate': cur.get('depth_rate'),
                    'accel': cur.get('accel')})
    return out

# ----------------------------------------------------------------------------- strings
def ascii_strings(data, minlen=4):
    out = []; cur = bytearray(); start = 0
    for i, b in enumerate(data):
        if 32 <= b < 127:
            if not cur: start = i
            cur.append(b)
        else:
            if len(cur) >= minlen: out.append((start, cur.decode()))
            cur = bytearray()
    if len(cur) >= minlen: out.append((start, cur.decode()))
    return out

# ----------------------------------------------------------------------------- contact sheet
def contact_sheet(items, path, cols=6, cell=(330, 230), title=None):
    """items: list of (label, PIL image)."""
    if not items: return
    cw, ch = cell
    rows = (len(items) + cols - 1) // cols
    top = 24 if title else 0
    sheet = Image.new('RGB', (cols * cw, rows * ch + top), (40, 40, 48))
    dr = ImageDraw.Draw(sheet)
    if title: dr.text((6, 6), title, fill=(255, 255, 255))
    for i, (label, im) in enumerate(items):
        im = im.convert('RGBA')
        maxw, maxh = cw - 10, ch - 26
        s = min(maxw / im.width, maxh / im.height)
        s = min(s, 2.0) if s >= 1 else s
        if s >= 1: s = int(s) or 1
        im2 = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.NEAREST)
        x = (i % cols) * cw + 5; y = (i // cols) * ch + 5 + top
        bg = Image.new('RGBA', im2.size, (128, 0, 128, 255))
        bg.alpha_composite(im2)
        sheet.paste(bg.convert('RGB'), (x, y))
        dr.text((x, y + maxh + 4), label, fill=(255, 255, 160))
    sheet.save(path)


# ----------------------------------------------------------------------------- impronte della versione supportata
VERSIONE_ESTRATTORE = '2.0.0'
VERSIONE_SUPPORTATA = '688 Attack Sub, MS-DOS, Electronic Arts 1989 (GAME.EXE del 12/06/1989, librerie del 04/03/1989)'
# MD5 dei file della copia di riferimento. MODEM.688 e PROFILE.688 sono configurazione dell'utente: non si
# controllano. Una copia diversa (altra edizione, file ritoccati) va segnalata: le tabelle e gli indirizzi di
# questo estrattore valgono solo per questa.
IMPRONTE_MD5 = {
    '688.BAT': 'ac795949871f3ba4d037d499536e09d3', '688.PAK': '459ddfb01d6b8087d288bd0fbd17f16e',
    '688.PAL': '949a5833807e101c22f10ba98bd67686', 'ALFA.PAK': 'ccccf3125851a8ca544f4a949d1221fc',
    'ALFA.PAL': '949a5833807e101c22f10ba98bd67686', 'CALLS.EXE': '4552638ddf08042531ec3a23971e9459',
    'DISK1.MLB': '89fc25473b9c044fe1de4ddcb15a84fd', 'DISK2.MLB': 'dc63c7600a0369dc9fc1f6668229fa68',
    'GAME.EXE': '932eac8cebe8a2e76fc67c5ac47ef217', 'MAIN.EGA': '74e5a0c47a80abd54fb66cb430112337',
    'TITLE.EXE': '64e0171a8fbe5a2a4983814709d66c38', 'TITLE.PAK': '55e3d575b889a67767b7f89125760ff3',
    'TITLE.PAL': 'b250a787c41441fb3399a90d12c0f3d9',
}

def trova_file(cartella, nome):
    """Nome di file senza distinzione fra maiuscole e minuscole (le copie DOS arrivano in tutti i modi)."""
    for f in sorted(os.listdir(cartella)):
        if f.upper() == nome.upper():
            return os.path.join(cartella, f)
    return None

def verifica_impronte(cartella):
    """-> (esito, impronte, righe). esito: 'supportata', 'sconosciuta' (file presenti ma diversi) o
    'incompleta' (manca qualcosa). Non modifica nulla."""
    righe = []; impronte = {}; mancanti = []; diversi = []
    for nome, atteso in sorted(IMPRONTE_MD5.items()):
        p = trova_file(cartella, nome)
        if p is None:
            mancanti.append(nome); righe.append('  MANCA     %s' % nome); continue
        h = hashlib.md5(open(p, 'rb').read()).hexdigest()
        impronte[nome] = h
        if h == atteso:
            righe.append('  ok        %-10s %s' % (nome, h))
        else:
            diversi.append(nome); righe.append('  DIVERSO   %-10s %s (atteso %s)' % (nome, h, atteso))
    esito = 'incompleta' if mancanti else ('sconosciuta' if diversi else 'supportata')
    return esito, impronte, righe

def avviso_versione(esito):
    if esito == 'supportata':
        return 'Versione riconosciuta: %s.' % VERSIONE_SUPPORTATA
    return ('ATTENZIONE: questa copia NON è la versione supportata (%s). Supportata: %s. Formati, indirizzi '
            'e tabelle dell\'estrattore sono stati ricavati da quella: con un\'altra edizione il risultato può '
            'essere sbagliato senza che niente lo segnali.' % (esito, VERSIONE_SUPPORTATA))

# ----------------------------------------------------------------------------- caricamento della copia originale
class Originale:
    """Tutto ciò che serve, letto (e mai scritto) dalla cartella originale dell'utente."""

    def __init__(self, cartella):
        self.dir = cartella
        self.exe = {}; self.exe_raw = {}
        for exe in ('GAME.EXE', 'TITLE.EXE', 'CALLS.EXE'):
            p = trova_file(cartella, exe)
            if not p:
                continue
            raw = open(p, 'rb').read()
            r = exepack_unpack(raw)
            if r:
                self.exe[exe] = r; self.exe_raw[exe] = raw
        if 'GAME.EXE' not in self.exe:
            sys.exit('GAME.EXE manca o non è impacchettato con EXEPACK: non è la versione supportata')
        self.game_img = self.exe['GAME.EXE'][0]
        g = self.game_img
        self.font = load_font(g)
        self.builtins = load_cls_builtins(g)
        self.cirillico = load_cirillico(g)
        self.names = []
        for k in range(46):
            ptr = struct.unpack_from('<H', g, GAME_DS + 0x19A + 2 * k)[0]
            self.names.append(g[GAME_DS + ptr:g.index(0, GAME_DS + ptr)].decode('latin1'))
        self.crew = []
        for k in range(67):
            ptr = struct.unpack_from('<H', g, GAME_DS + 0x1F6 + 2 * k)[0]
            self.crew.append(g[GAME_DS + ptr:g.index(0, GAME_DS + ptr)].decode('latin1'))
        # librerie: membro (maiuscolo) -> byte grezzi / decompressi, e da dove viene
        self.mlb = {}; self.rawfiles = {}; self.files = {}; self.origine = {}
        for lib in ('DISK1.MLB', 'DISK2.MLB'):
            p = trova_file(cartella, lib)
            if not p:
                continue
            self.mlb[lib] = read_mlb(p)
            for n, _off, _sz, d in self.mlb[lib]:
                self.rawfiles[n.upper()] = d; self.files[n.upper()] = d; self.origine[n.upper()] = '%s:%s' % (lib, n)
        self.lzw = {}
        for n in sorted(self.rawfiles):
            if n.endswith('.LZW') or n.endswith('.LZA') or n == 'HELICOP.ENC':
                dec, sz = lzw_decode(self.rawfiles[n])
                assert len(dec) == sz, n
                self.files[n] = dec; self.lzw[n] = (len(self.rawfiles[n]), len(dec))
        for sciolto in ('MAIN.EGA',):
            p = trova_file(cartella, sciolto)
            if p:
                self.files[sciolto] = open(p, 'rb').read(); self.origine[sciolto] = sciolto
        # palette
        self.pals = {'EGA': ega_pal()}
        for pn in ('688.PAL', 'ALFA.PAL', 'TITLE.PAL'):
            p = trova_file(cartella, pn)
            if p:
                self.pals[pn.split('.')[0]] = load_pal(open(p, 'rb').read())
        self.pals['DAY'] = load_pal(self.rawfiles['DAY.PAL'])
        self.pals['NIGHT'] = load_pal(self.rawfiles['NIGHT.PAL'])
        self.pals['navmap'] = [self.pals['DAY'][0xBF + 4 * i] for i in range(16)] + [(0, 0, 0)] * 240
        self.pals['grey'] = [self.pals['DAY'][0x90 + i] for i in range(16)] + [(0, 0, 0)] * 240
        # script CLS e figure PIC
        self.cls_nomi = sorted(n for n in self.files if n.endswith('.CLS') or n.endswith('.LZA')
                               or n in ('TARGETS.LZW', 'HELICOP.ENC'))
        self.programmi = {n: CLS(self.files[n], self.builtins) for n in self.cls_nomi}
        self.figure = {n: self.files[n] for n in self.files
                       if (n.endswith('.ENC') and n != 'HELICOP.ENC') or n == 'MAIN.EGA'
                       or (n.endswith('.LZW') and n != 'TARGETS.LZW')}

    def leggi(self, nome):
        p = trova_file(self.dir, nome)
        return open(p, 'rb').read() if p else None

    def interprete(self, cirillico=False):
        return InterpreteCLS(self.font, self.programmi, self.figure, self.cirillico, cirillico)

    def esegui_lavoro(self, lav, sfondi=None):
        it = self.interprete(lav.get('cirillico', False))
        it.esegui_passi(lav['passi'], sfondi)
        return it

    def mappe_missioni(self):
        """Indice della mappa SURF di ogni missione, dalla routine di configurazione degli script SCENE (§5.4)."""
        out = collections.defaultdict(set)
        for n in self.cls_nomi:
            if not n.endswith('.LZA'):
                continue
            prog = self.programmi[n]
            for idx in (0x14, 0x15):
                if idx > len(prog.descs):
                    continue
                it = self.interprete()
                it.esegui(prog, idx)
                if len(it.tabella) >= 15:
                    out['SURF' + chr(65 + it.tabella[14])].add(int(n[5]))
        return {k: sorted(v) for k, v in out.items()}


class _PaginaTesto(InterpreteCLS):
    """Interprete che scrive su un'immagine di altezza qualunque (resa dei testi degli ordini)."""
    def __init__(self, o, altezza, fondo=8):
        super().__init__(o.font, {}, {}, o.cirillico)
        self.im = Image.new('P', (320, altezza), fondo)
        self.im.putpalette([c for rgb in o.pals['DAY'] for c in rgb])
        self.px = self.im.load(); self.h = altezza
        self.fin = [0, 0, 319, altezza - 1]

    def _scrivi(self, x, y, c):
        if 0 <= x < 320 and 0 <= y < self.h:
            self.px[x, y] = c & 0xFF

# ----------------------------------------------------------------------------- uscita per la ricerca (out/)
def estrai_ricerca(o, outd, render=True):
    def P(*p):
        q = os.path.join(outd, *p); os.makedirs(os.path.dirname(q), exist_ok=True); return q
    report = {}
    # --- eseguibili
    for exe, (img, rel, regs) in o.exe.items():
        raw = o.exe_raw[exe]
        open(P('exe', exe.replace('.EXE', '_unpacked.EXE')), 'wb').write(build_mz(img, rel, regs))
        with open(P('exe', exe.replace('.EXE', '_strings.txt')), 'w') as f:
            for off, s in ascii_strings(img, 4):
                f.write('%06x  %s\n' % (off, s))
        # dati in coda all'immagine MZ (TITLE.EXE: tabella dei simboli di Turbo Debugger)
        e_lastp, e_np = struct.unpack_from('<HH', raw, 2)
        tail = raw[(e_np - 1) * 512 + (e_lastp or 512):]
        if tail:
            syms = sorted(set(x.decode() for x in re.findall(rb'[A-Za-z_][A-Za-z0-9_]{2,}(?:\.[A-Z]{1,3})?', tail)))
            open(P('exe', exe.replace('.EXE', '_debug_symbols.txt')), 'w').write(
                '%d bytes appended after the MZ image (Turbo Debugger symbols)\n' % len(tail) + '\n'.join(syms) + '\n')
    json.dump({'unit_type_names(DS:019A)': o.names, 'periscope_sprite_prefix(DS:0F8C)': PERI_PREFIX,
               'crew_messages(DS:01F6)': o.crew}, open(P('exe', 'GAME_tables.json'), 'w'), indent=1)
    # --- palette
    for k, pal in o.pals.items():
        im = Image.new('RGB', (16 * 12, 16 * 12))
        dr = ImageDraw.Draw(im)
        for i in range(256):
            dr.rectangle(((i % 16) * 12, (i // 16) * 12, (i % 16) * 12 + 11, (i // 16) * 12 + 11), fill=pal[i])
        im.save(P('palettes', k + '.png'))
    # --- librerie
    for lib, mem in o.mlb.items():
        with open(P('raw', lib + '_index.txt'), 'w') as f:
            f.write('#  name          offset    size\n')
            for i, (n, off, sz, _) in enumerate(mem):
                f.write('%3d %-13s %8d %7d\n' % (i, n, off, sz))
        for n, _off, _sz, d in mem:
            open(P('raw', lib.split('.')[0], n), 'wb').write(d)
    for n, (a, b) in o.lzw.items():
        open(P('decompressed', n + '.bin'), 'wb').write(o.files[n])
        report[n] = 'LZW %d -> %d bytes (header size matches)' % (a, b)
    sheets = collections.defaultdict(list)
    # --- schermate PAK
    for stem in ('688', 'ALFA', 'TITLE'):
        d = o.leggi(stem + '.PAK')
        if d:
            im = Image.frombytes('P', (320, 200), d)
            im.putpalette([c for rgb in o.pals[stem] for c in rgb])
            im.save(P('png', 'screens', stem + '_PAK.png'))
            sheets['screens'].append((stem + '.PAK (VGA)', im))
    # --- figure PIC
    for n in sorted(o.figure):
        d = o.figure[n]
        W, rows, H = pic_decode(d)
        kind, pk, base, tr = classify_pic(n)
        im = pic_image(W, rows, o.pals[pk], base, tr)
        sub = {'periscope sprite': 'periscope', 'crew photo': 'crew', 'bathymetry map': 'maps',
               'status-screen submarine profile': 'ui'}.get(kind, 'ui' if 'UI' in kind else 'screens')
        im.save(P('png', sub, n + '.png'))
        report[n] = '%s %dx%d (+%d rows stored) palette=%s base=%#x transparent=%s' % (kind, W, H, 1, pk, base, tr)
        sheets[sub].append(('%s %dx%d' % (n, W, H + 1), im))
        if kind == 'periscope sprite':
            pic_image(W, rows, o.pals['NIGHT'], base, tr).save(P('png', 'periscope_night', n + '.png'))
        if kind == 'bathymetry map':
            pic_image(W, rows, o.pals['grey'], 0, None).save(P('png', 'maps', n + '_grey.png'))
    # --- suoni
    for n, d in o.rawfiles.items():
        if n.endswith('.T'):
            rate = SOUND_RATE.get(n, 5000)
            t_to_wav(d, P('wav', n.replace('.T', '_%dHz.wav' % rate)), rate)
            report[n] = '4-bit PCM, %d samples, nominal %d Hz (%.2f s). %s' % (len(d) * 2, rate, len(d) * 2 / rate, SOUND_NOTE.get(n, ''))
    # --- font (224 glifi, 14 righe di 16)
    fs = Image.new('P', (16 * 10, 14 * 16), 0)
    fs.putpalette([0, 0, 0, 255, 255, 255, 80, 80, 80] + [0] * 759)
    fp = fs.load()
    for g, (w, rows) in enumerate(o.font):
        gx, gy = (g % 16) * 10, (g // 16) * 16
        for xx in range(min(w, 9)):
            fp[gx + xx, gy + 14] = 2
        for r in range(13):
            for bit in range(8):
                if rows[r] & (0x80 >> bit): fp[gx + bit, gy + r] = 1
    fs.resize((fs.width * 3, fs.height * 3), Image.NEAREST).save(P('png', 'font', 'GAME_font_x3.png'))
    json.dump([{'code': g + 32, 'width': w, 'rows': list(rows)} for g, (w, rows) in enumerate(o.font)],
              open(P('png', 'font', 'GAME_font.json'), 'w'))
    # --- script CLS: disassemblati e rese dei lavori (con lo sfondo PAK dove serve)
    for n in o.cls_nomi:
        open(P('cls', n + '.txt'), 'w').write('\n'.join(o.programmi[n].listing()))
    sfondi = {k: o.leggi(k) for k in ('688.PAK', 'ALFA.PAK')}
    if render:
        for lav in lavori_cls(o.programmi):
            it = o.esegui_lavoro(lav, sfondi)
            pal = o.pals['DAY']
            im = it.immagine(lav['mostra'], pal)
            im.save(P('png', 'cls', lav['id'] + '.png'))
            if it.hotspot:
                ov = im.convert('RGB'); dr = ImageDraw.Draw(ov)
                for hs in it.hotspot:
                    dr.rectangle((hs['x1'], hs['y1'], hs['x2'], hs['y2']), outline=(255, 0, 255))
                    k = hs['tasto']
                    dr.text((hs['x1'] + 1, hs['y1'] + 1), chr(k) if 32 < k < 127 else str(hs['gruppo']), fill=(255, 255, 0))
                ov.save(P('png', 'cls', lav['id'] + '_hotspots.png'))
            sheets['cls'].append((lav['id'], im))
            report['render ' + lav['id']] = 'anomalie=%s hotspot=%d agganci=%d' % (dict(it.anomalie), len(it.hotspot), len(it.agganci))
    # --- testi degli ordini e dei debriefing (TELETYPE di ogni routine)
    for n in o.cls_nomi:
        if not (n.endswith('.LZA') or n in ('HELICOP.ENC', 'TARGETS.LZW')):
            continue
        prog = o.programmi[n]
        lines_out = []
        for idx in range(len(prog.descs) + 1):
            it = o.interprete()
            it.esegui(prog, idx)
            tele = [(a['colore'], a['testo']) for a in it.agganci if a['tipo'] == 'telescrivente']
            if tele:
                lines_out.append('==== %s ====' % ('main (mission orders)' if idx == 0 else 'routine L%02X' % (idx - 1)))
                lines_out += [t for _c, t in tele]
                if idx == 0 and render:
                    pg = _PaginaTesto(o, 12 + 8 * len(tele))
                    pg.interlinea = 8
                    yy = 4
                    for col, t in tele:
                        pg.colore = col; pg.x = 8; pg.y = yy; pg.stampa(t); yy += 8
                    pg.im.save(P('png', 'briefings', n.replace('.LZA', '') + '_orders.png'))
        open(P('text', n.replace('.', '_') + '.txt'), 'w').write('\n'.join(lines_out) + '\n')
    # configurazione della missione: la routine 14h (lato USA) / 15h (lato URSS) di ogni SCENE riempie con SETMAP
    # la tabella DS:B45A (riletta da 0000:1E11): [0]=lato 0=688 1=Alfa, [1..6]=scorte per tipo d'arma,
    # [7..13]=tipo d'arma nei tubi 1..7, [14]=indice della mappa (SURF A..G)
    with open(P('text', 'mission_config.tsv'), 'w') as f:
        f.write('scene\troutine\tside\tstock_wtype0..5\ttube1..7_wtype\tmap\n')
        for n in o.cls_nomi:
            if not n.endswith('.LZA'):
                continue
            prog = o.programmi[n]
            for idx in (0x14, 0x15):
                if idx > len(prog.descs):
                    continue
                it = o.interprete()
                it.esegui(prog, idx)
                m = it.tabella
                if len(m) >= 15:
                    f.write('%s\tL%02X\t%s\t%s\t%s\tSURF%s\n' % (n, idx - 1, '688' if m[0] == 0 else 'ALFA',
                            ' '.join(str(m.get(i)) for i in range(1, 7)), ' '.join(str(m.get(i)) for i in range(7, 14)),
                            chr(65 + m.get(14, 0))))
    # CALLS.EXE: banca di campioni a 4 bit del driver della musica del titolo; confini e frequenza non
    # decifrati -> esportata grezza a 8 kHz solo per ascoltarla
    if 'CALLS.EXE' in o.exe:
        t_to_wav(o.exe['CALLS.EXE'][0][0x20B8:], P('wav', 'CALLS_samplebank_raw_8000Hz.wav'), 8000)
    # --- scenari TOK
    allunits = {}; alltemplates = {}
    for n in sorted(o.files):
        if not n.endswith('.TOK'):
            continue
        d = o.files[n]
        open(P('tok', n + '.txt'), 'w').write('\n'.join(tok_listing(d)))
        allunits[n] = tok_units(d, o.names)
        alltemplates[n] = tok_templates(d, o.names)
    json.dump(allunits, open(P('tok', 'units_all.json'), 'w'), indent=1)
    json.dump(alltemplates, open(P('tok', 'templates_all.json'), 'w'), indent=1)
    with open(P('tok', 'units_all.tsv'), 'w') as f:
        cols = ['scenario', 'n', 'type', 'type_name', 'domain', 'side', 'weapon', 'max_speed', 'max_depth', 'hit_points',
                'noise_b3a', 'sensor_b3b', 'b3c', 'pkill_b3d', 'turn_rate', 'depth_rate', 'accel', 'speed', 'depth',
                'course', 'start_positions', 'move_to']
        f.write('\t'.join(cols) + '\n')
        for sc, rows in allunits.items():
            for r in rows:
                f.write('\t'.join([sc] + [str(r.get(c)) for c in cols[1:]]) + '\n')
    # --- provini
    if render:
        for k, items in sheets.items():
            per = 30
            for i in range(0, len(items), per):
                contact_sheet(items[i:i + per], P('contact_sheets', 'sheet_%s_%d.png' % (k, i // per + 1)),
                              cols=5 if k != 'periscope' else 6, cell=(340, 240) if k in ('screens', 'maps', 'cls') else (280, 120),
                              title='688 Attack Sub - %s (%d-%d of %d)' % (k, i + 1, min(i + per, len(items)), len(items)))
    json.dump(report, open(P('report.json'), 'w'), indent=1)

# ----------------------------------------------------------------------------- uscita per il client (--client)
RADICE_REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLIENT_PREDEFINITO = os.path.join(RADICE_REPO, 'web', 'assets', 'originali')
FIXTURE_PREDEFINITO = os.path.join(RADICE_REPO, 'tests', 'client', 'fixture')

def impronta_estrattore():
    """SHA-256 dei sorgenti dell'estrattore: cambia l'estrattore, cambia l'impronta nel manifesto."""
    h = hashlib.sha256()
    d = os.path.dirname(os.path.abspath(__file__))
    for nome in ('estrai688.py', 'unexepack.py'):
        p = os.path.join(d, nome)
        if os.path.exists(p):
            h.update(nome.encode() + b'\0' + open(p, 'rb').read())
    return h.hexdigest()

def _json(obj, compatto=False):
    if compatto:
        s = json.dumps(obj, ensure_ascii=True, separators=(',', ':'))
    else:
        s = json.dumps(obj, ensure_ascii=True, indent=1)
    return (s + '\n').encode('ascii')

def _png(im):
    b = io.BytesIO(); im.save(b, format='PNG'); return b.getvalue()

def _wav(campioni, rate):
    b = io.BytesIO()
    w = wave.open(b, 'wb'); w.setnchannels(1); w.setsampwidth(1); w.setframerate(rate); w.writeframes(campioni); w.close()
    return b.getvalue()

def _prepara_cartella(cartella, segno):
    """Svuota una cartella di uscita solo se è nostra (contiene il file segno) o è vuota."""
    if os.path.isdir(cartella) and os.listdir(cartella):
        if not os.path.isfile(os.path.join(cartella, segno)):
            sys.exit('%s non è vuota e non contiene %s: non la svuoto (non sembra un\'uscita dell\'estrattore)'
                     % (cartella, segno))
        shutil.rmtree(cartella)
    os.makedirs(cartella, exist_ok=True)

class _Uscita:
    def __init__(self, base):
        self.base = base; self.voci = []

    def scrivi(self, rel, dati, tipo, origine=None, palette=None, **altro):
        p = os.path.join(self.base, *rel.split('/'))
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'wb') as f:
            f.write(dati)
        v = {'percorso': rel, 'tipo': tipo, 'byte': len(dati), 'sha256': hashlib.sha256(dati).hexdigest()}
        if origine: v['origine'] = origine
        if palette: v['palette'] = palette
        v.update(altro)
        self.voci.append(v)

def _pic_indici(d):
    """-> (W, H, righe dall'alto, ciascuna di W nibble): tutte le H+1 righe memorizzate."""
    W, rows, H = pic_decode(d)
    return W, H, rows

def _img_p(W, rows, pal, base=0, n_colori=256, trasp=None):
    im = Image.new('P', (W, len(rows)))
    im.putpalette([c for rgb in pal[:n_colori] for c in rgb])
    im.putdata([base + p for r in rows for p in r])
    if trasp is not None:
        im.info['transparency'] = trasp
    return im

def _img_rgba(W, rows, pal, base, trasp):
    im = Image.new('RGBA', (W, len(rows)))
    im.putdata([(0, 0, 0, 0) if p == trasp else tuple(pal[base + p]) + (255,) for r in rows for p in r])
    return im

def _cls_json(o, nome):
    """Uno script CLS decodificato: tabella delle routine e, per ognuna, la lista delle istruzioni.
    Argomento: numero (immediato, senza segno come nel bytecode), stringa, oppure {"p": i} = parametro i
    della routine, {"p": i, "piu": v} = parametro + v, {"p": i, "meno": v} = parametro - v."""
    prog = o.programmi[nome]
    def arg(a):
        if isinstance(a, tuple):
            if a[0] == 'P': return {'p': a[1]}
            return {'p': a[1], 'piu' if a[0] == 'P+' else 'meno': a[2]}
        return a
    routine = []
    for idx in range(len(prog.descs) + 1):
        if idx == 0:
            nargs, tipi, off_desc = 0, [], None
        else:
            nargs, _a, tipi = prog.descs[idx - 1]
            off_desc = struct.unpack_from('<H', prog.d, 1 + 2 * (idx - 1))[0]
        pc = prog.entry(idx); codice = []
        while True:
            op, kind, args, npc = prog.decode(pc)
            if op == 0:
                break
            ist = {'@': pc}
            if kind == 'B':
                ist['op'] = op; ist['n'] = CLS_MNEMO[op]
            else:
                ist['r'] = (op & 0x7F) + 1
            ist['a'] = [arg(a) for a in args]
            codice.append(ist)
            pc = npc
        routine.append({'indice': idx, 'nome': 'main' if idx == 0 else 'L%02X' % (idx - 1), 'nargs': nargs,
                        'tipi': tipi, 'descrittore': off_desc, 'inizio': prog.entry(idx), 'codice': codice})
    return {'formato': 'termoclino-cls/1', 'nome': nome, 'origine': o.origine.get(nome, nome),
            'base_codice': prog.codebase, 'routine': routine}

def _risultato_lavoro(it):
    return {'hotspot': it.hotspot, 'agganci': it.agganci,
            'tabella': {str(k): v for k, v in sorted(it.tabella.items())},
            'parole': it.parole, 'coppie': it.coppie}

STATO_INIZIALE = {'colore': 15, 'spaziatura': 1, 'interlinea': 9, 'x': 0, 'y': 0, 'finestra': [0, 0, 319, 199],
                  'grassetto': 0, 'colore_bordo': 15, 'pagina': 'schermo'}

def estrai_client(o, outd, verifica):
    esito, impronte = verifica
    _prepara_cartella(outd, 'manifest.json')
    u = _Uscita(outd)
    DAY, NIGHT = o.pals['DAY'], o.pals['NIGHT']
    # --- palette (RGB a 8 bit come nei file .PAL; EGA16 = i 16 colori standard)
    for nome, pal, n, orig in (('DAY', DAY, 256, o.origine['DAY.PAL']), ('NIGHT', NIGHT, 256, o.origine['NIGHT.PAL']),
                               ('688', o.pals['688'], 256, '688.PAL'), ('ALFA', o.pals['ALFA'], 256, 'ALFA.PAL'),
                               ('TITLE', o.pals['TITLE'], 256, 'TITLE.PAL'), ('EGA16', EGA16, 16, 'standard EGA'),
                               ('MAPPA', o.pals['navmap'], 16, 'DAY.PAL indici BFh+4n (carta nautica)')):
        u.scrivi('palette/%s.json' % nome, _json({'nome': nome, 'origine': orig, 'colori': [list(c) for c in pal[:n]]},
                 compatto=True), 'palette', origine=orig)
    # --- sale di controllo e titolo (VGA, PNG indicizzati con la loro palette)
    for stem, cart in (('688', 'sale'), ('ALFA', 'sale'), ('TITLE', 'titolo')):
        d = o.leggi(stem + '.PAK')
        im = Image.frombytes('P', (320, 200), d)
        im.putpalette([c for rgb in o.pals[stem] for c in rgb])
        u.scrivi('%s/%s.png' % (cart, stem), _png(im), 'schermata VGA 320x200 indicizzata', origine=stem + '.PAK',
                 palette=stem)
    # --- figure PIC
    for n in sorted(o.figure):
        if n == 'MAIN.EGA':
            continue
        W, H, rows = _pic_indici(o.figure[n])
        kind, pk, base, tr = classify_pic(n)
        stem = n.split('.')[0]
        meta = {'larghezza': W, 'righe': H + 1, 'righe_disegnate_dal_gioco': H}
        if kind == 'periscope sprite':
            for cart, pal, pn in (('giorno', DAY, 'DAY'), ('notte', NIGHT, 'NIGHT')):
                u.scrivi('periscopio/%s/%s.png' % (cart, stem), _png(_img_rgba(W, rows, pal, base, tr)),
                         'sagoma del periscopio RGBA', origine=o.origine[n], palette=pn, base='%#x' % base,
                         trasparente=tr, **meta)
        elif kind == 'crew photo':
            for cart, pal, pn in (('', DAY, 'DAY'), ('notte/', NIGHT, 'NIGHT')):
                u.scrivi('equipaggio/%s%s.png' % (cart, stem), _png(_img_p(W, rows, pal, base)),
                         'ritratto dell\'equipaggio indicizzato (indici %#x+n)' % base, origine=o.origine[n],
                         palette=pn, **meta)
        elif kind == 'bathymetry map':
            u.scrivi('mappe/%s.png' % stem, _png(_img_p(W, rows, o.pals['navmap'], 0, 16)),
                     'mappa di profondità (16 livelli, colori della carta nautica)', origine=o.origine[n],
                     palette='MAPPA', **meta)
            u.scrivi('mappe/%s.bin' % stem, bytes(p for r in rows for p in r),
                     'griglia grezza: %d x %d byte dall\'alto, valore 0 terra, 1 costa, 2-15 profondità crescente'
                     % (W, H + 1), origine=o.origine[n], **meta)
        elif n.startswith('END'):
            u.scrivi('fine/%s.png' % stem, _png(_img_p(W, rows, EGA16, 0, 16)), 'cartolina di fine missione',
                     origine=o.origine[n], palette='EGA16', **meta)
        elif n in ('MAIN.LZW', 'ALFA.LZW'):
            continue                        # sale di controllo EGA: il client usa le VGA
        else:
            u.scrivi('interfaccia/%s.png' % stem, _png(_img_p(W, rows, EGA16, 0, 16, tr)), 'elemento d\'interfaccia',
                     origine=o.origine[n], palette='EGA16', trasparente=tr, **meta)
    mappe = {}
    miss = o.mappe_missioni()
    for n in sorted(o.figure):
        if n.startswith('SURF'):
            W, H, rows = _pic_indici(o.figure[n])
            stem = n.split('.')[0]
            mappe[stem] = {'larghezza': W, 'righe': H + 1, 'png': 'mappe/%s.png' % stem, 'griglia': 'mappe/%s.bin' % stem,
                           'missioni': miss.get(stem, [])}
    u.scrivi('mappe/mappe.json', _json({'nota': 'indice della mappa di ogni missione letto dalla routine di '
                                        'configurazione degli script SCENE (tabella SETMAP[14])', 'mappe': mappe}),
             'indice delle mappe')
    # --- suoni (WAV 8 bit alla frequenza nominale, vedi docs/ASSET.md §4.6)
    for n in sorted(o.rawfiles):
        if n.endswith('.T'):
            d = o.rawfiles[n]; rate = SOUND_RATE.get(n, 5000)
            camp = bytes(v for b in d for v in (((b >> 4) * 17), ((b & 15) * 17)))
            u.scrivi('suoni/%s.wav' % n.split('.')[0], _wav(camp, rate), 'suono PCM 8 bit mono', origine=o.origine[n],
                     frequenza=rate, nota=SOUND_NOTE.get(n, ''))
    # --- font: atlante 16 x 14 celle di 8 x 13, bianco su trasparente, e metriche
    atl = Image.new('RGBA', (16 * 8, 14 * 13), (0, 0, 0, 0))
    ap = atl.load(); glifi = []
    for g, (w, rows) in enumerate(o.font):
        gx, gy = (g % 16) * 8, (g // 16) * 13
        for r in range(13):
            for bit in range(8):
                if rows[r] & (0x80 >> bit):
                    ap[gx + bit, gy + r] = (255, 255, 255, 255)
        glifi.append({'codice': 0x20 + g, 'larghezza': w, 'x': gx, 'y': gy, 'righe': list(rows)})
    u.scrivi('font/font.png', _png(atl), 'atlante del font (bianco su trasparente)', origine='GAME.EXE DS:9D5C')
    u.scrivi('font/font.json', _json({
        'formato': 'termoclino-font/1', 'origine': 'GAME.EXE DS:9D5C, 14 byte per glifo (larghezza + 13 righe, MSB a sinistra)',
        'primo_codice': 0x20, 'numero': len(glifi), 'cella': [8, 13], 'colonne': 16, 'atlante': 'font/font.png',
        'avanzamento': 'larghezza + spaziatura (TEXTSPACING, 1 di solito); in grassetto +1 e glifo ridisegnato a x+1',
        'interlinea': 9, 'spaziatura': 1,
        'cirillico': {'nota': 'col cirillico attivo (lato Alfa; Ctrl-R lo spegne) A-Z passano dalla tabella '
                               'DS:BD8B e poi le cifre 4-9 (34h-39h) diventano E1h-E6h; le minuscole no',
                      'A_Z': list(o.cirillico), 'cifre_4_9': [0x34 + 0xAD + i for i in range(6)]},
        'gruppi': [
            {'da': 0x20, 'a': 0x5F, 'cosa': 'maiuscole piccole e segni (ASCII)'},
            {'da': 0x60, 'a': 0x7F, 'cosa': 'maiuscole grandi: nel testo si scrivono in minuscolo; 7Eh triangolo'},
            {'da': 0x80, 'a': 0x86, 'cosa': 'barre e simboli'},
            {'da': 0x87, 'a': 0x90, 'cosa': 'cifre grandi 0-9 (DIGITBOX disegna 87h+n)'},
            {'da': 0x91, 'a': 0xC4, 'cosa': 'simboli dei pulsanti'},
            {'da': 0xC5, 'a': 0xCC, 'cosa': 'pezzi delle scritte FIRE e DETONATE'},
            {'da': 0xCD, 'a': 0xDC, 'cosa': 'maiuscole grandi K-Z, seconda serie'},
            {'da': 0xDD, 'a': 0xE0, 'cosa': 'simboli'},
            {'da': 0xE1, 'a': 0xE6, 'cosa': 'cifre 4-9 usate dal cirillico'},
            {'da': 0xE7, 'a': 0xF2, 'cosa': 'lettere del cirillico finto'},
            {'da': 0xF3, 'a': 0xFF, 'cosa': 'simboli (FCh-FFh vuoti)'}],
        'glifi': glifi}, compatto=True), 'metriche del font', origine='GAME.EXE DS:9D5C, DS:BD8B')
    # --- script CLS, figure usate dagli script, lavori di resa con hotspot e agganci precalcolati
    nomi_cls = [n for n in o.cls_nomi if n.endswith('.CLS')]
    for n in nomi_cls:
        u.scrivi('cls/%s.json' % n.split('.')[0], _json(_cls_json(o, n), compatto=True), 'script CLS decodificato',
                 origine=o.origine[n])
    figure = {}
    for n in sorted(o.figure):
        k = classify_pic(n)[0]
        if k.startswith('UI') or k.startswith('status'):
            W, H, righe = cls_espandi_pic(o.figure[n])
            figure[n] = {'larghezza': W, 'altezza': H, 'righe': len(righe), 'pixel_per_riga': len(righe[0]),
                         'dati': base64.b64encode(b''.join(righe)).decode('ascii')}
    u.scrivi('cls/figure.json', _json({'formato': 'termoclino-figure/1',
             'nota': 'figure 16 colori come le disegna SPRITE (0000:B28F): righe memorizzate DAL BASSO (la prima è '
                     'quella in fondo), 2*ceil(W/2) nibble per riga (il nibble di riempimento si disegna), un byte per '
                     'pixel, base64', 'figure': figure}, compatto=True), 'figure per l\'interprete CLS')
    u.scrivi('cls/primitive.json', _json({'formato': 'termoclino-primitive/1', 'tabella': 'GAME.EXE DS:97A2',
             'primitive': [{'op': k, 'nome': CLS_MNEMO[k], 'firma': CLS_NAMES[k], 'nargs': o.builtins[k][0],
                            'tipi': o.builtins[k][2], 'gestore': '0000:%04X' % o.builtins[k][1]}
                           for k in sorted(o.builtins)]}), 'tabella delle primitive CLS')
    lavori = []
    for lav in lavori_cls(o.programmi):
        it = o.esegui_lavoro(lav)
        if it.anomalie:
            print('  avviso: %s: %s' % (lav['id'], dict(it.anomalie)))
        lv = dict(lav); lv['risultato'] = _risultato_lavoro(it)
        lavori.append(lv)
    u.scrivi('cls/pannelli.json', _json({
        'formato': 'termoclino-pannelli/1',
        'nota': 'come GAME.EXE compone ogni schermata con gli script; risultato = hotspot (zone cliccabili, '
                'nell\'ordine di registrazione: il gioco prova prima l\'ultima), agganci (regioni e eventi che il '
                'client riempie con lo stato vivo) e tabella SETMAP, calcolati dall\'interprete di riferimento',
        'stato_iniziale': STATO_INIZIALE, 'lavori': lavori}, compatto=True), 'lavori di resa dei pannelli')
    # --- manifesto
    voci = sorted(u.voci, key=lambda v: v['percorso'])
    man = {'formato': 'termoclino-originali/1',
           'estrattore': {'nome': 'tools/estrai/estrai688.py', 'versione': VERSIONE_ESTRATTORE,
                          'sha256': impronta_estrattore()},
           'originale': {'versione': VERSIONE_SUPPORTATA, 'esito_verifica': esito, 'md5': impronte},
           'avvertenza': 'Asset estratti dalla copia dell\'utente: non vanno distribuiti né messi nel repository.',
           'file': voci}
    with open(os.path.join(outd, 'manifest.json'), 'wb') as f:
        f.write(_json(man))
    return len(voci)

# ----------------------------------------------------------------------------- fixture delle prove (--fixture)
def estrai_fixture(o, outd):
    """Per ogni lavoro: le due pagine (schermo e retro, 64000 byte indicizzati ciascuna) e il risultato
    (hotspot, agganci, tabella, stato finale) dell'interprete di riferimento. tests/client/cls.test.js le
    confronta byte per byte con l'interprete JavaScript. Gli sfondi PAK non si caricano: il test non ha
    bisogno di decodificare PNG."""
    _prepara_cartella(outd, 'indice.json')
    ids = []
    for lav in lavori_cls(o.programmi):
        it = o.esegui_lavoro(lav)
        for pg in ('schermo', 'retro'):
            with open(os.path.join(outd, '%s.%s.bin' % (lav['id'], pg)), 'wb') as f:
                f.write(bytes(it.pagine[pg][:64000]))
        r = _risultato_lavoro(it)
        r['stato'] = {'colore': it.colore, 'spaziatura': it.spaziatura, 'interlinea': it.interlinea, 'x': it.x,
                      'y': it.y, 'finestra': it.fin, 'grassetto': it.grassetto, 'colore_bordo': it.colore_bordo,
                      'pagina': it.pagina}
        r['anomalie'] = dict(it.anomalie)
        with open(os.path.join(outd, lav['id'] + '.json'), 'wb') as f:
            f.write(_json(r))
        ids.append(lav['id'])
    with open(os.path.join(outd, 'indice.json'), 'wb') as f:
        f.write(_json({'formato': 'termoclino-fixture-cls/1', 'estrattore': VERSIONE_ESTRATTORE,
                       'sha256_estrattore': impronta_estrattore(), 'lavori': ids}))
    return len(ids)

# ----------------------------------------------------------------------------- riga di comando
def main():
    ap = argparse.ArgumentParser(
        description='Estrattore dei file di 688 Attack Sub (DOS, 1989). Legge la cartella originale senza modificarla.',
        epilog='Esempi: estrai688.py ORIG out  (estrazione completa per la ricerca) | estrai688.py ORIG --verifica | '
               'estrai688.py ORIG --client --fixture  (asset per il browser e fixture delle prove)')
    ap.add_argument('originale', nargs='?', default='orig', help='cartella del gioco originale (sola lettura)')
    ap.add_argument('uscita', nargs='?', help='cartella dell\'estrazione completa per la ricerca')
    ap.add_argument('--no-render', action='store_true', help='niente rese PNG nell\'estrazione per la ricerca')
    ap.add_argument('--verifica', action='store_true', help='controlla solo le impronte MD5 ed esce (0 = supportata)')
    ap.add_argument('--client', nargs='?', const=CLIENT_PREDEFINITO, metavar='DIR',
                    help='scrive gli asset per il client (predefinita: web/assets/originali/)')
    ap.add_argument('--fixture', nargs='?', const=FIXTURE_PREDEFINITO, metavar='DIR',
                    help='scrive le fixture delle prove dell\'interprete CLS (predefinita: tests/client/fixture/)')
    ap.add_argument('--forza', action='store_true', help='procede anche con una versione non riconosciuta')
    a = ap.parse_args()
    if not os.path.isdir(a.originale):
        sys.exit('cartella originale inesistente: %s' % a.originale)
    esito, impronte, righe = verifica_impronte(a.originale)
    if a.verifica:
        print('Impronte MD5 di %s:' % a.originale)
        print('\n'.join(righe))
        print(avviso_versione(esito))
        sys.exit(0 if esito == 'supportata' else 1)
    if esito != 'supportata':
        print('\n'.join(righe), file=sys.stderr)
        print(avviso_versione(esito), file=sys.stderr)
        if (a.client or a.fixture) and not a.forza:
            sys.exit('Uscita per il client rifiutata: rilanciare con --forza per procedere comunque.')
    if not (a.client or a.fixture or a.uscita):
        a.uscita = 'out'
    o = Originale(a.originale)
    if a.uscita:
        estrai_ricerca(o, a.uscita, not a.no_render)
        print('estrazione per la ricerca ->', a.uscita)
    if a.client:
        n = estrai_client(o, a.client, (esito, impronte))
        print('asset per il client: %d file ->' % n, a.client)
    if a.fixture:
        n = estrai_fixture(o, a.fixture)
        print('fixture delle prove: %d lavori ->' % n, a.fixture)

if __name__ == '__main__':
    main()
