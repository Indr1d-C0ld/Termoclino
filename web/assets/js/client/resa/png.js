// @ts-check
/**
 * Decodifica dei PNG dell'estrattore: quelli indicizzati (sale di controllo, ritratti dell'equipaggio)
 * e quelli RGBA (le sagome del periscopio, scritte in RGBA con il nibble trasparente).
 *
 * La resa Classic lavora in indici di palette, e le immagini originali sono PNG «a palette» (tipo di
 * colore 3, profondità 8 o 4) scritti da estrai688.py. Passarle dal decodificatore del browser
 * vorrebbe dire tornare da RGB agli indici, con il rischio della gestione del colore; qui invece si
 * leggono gli indici così come sono, con `DecompressionStream` (browser e Node 18+), senza dipendenze.
 * Le sagome RGBA (tipo 6, 8 bit) si leggono allo stesso modo e si riportano agli indici con
 * `rgbaInIndici`, confrontando i colori con quelli esatti della palette (sono stati scritti da lì).
 */

/** @typedef {{ larghezza: number, altezza: number, indici: Uint8Array }} ImmagineIndicizzata */
/** @typedef {{ larghezza: number, altezza: number, rgba: Uint8Array }} ImmagineRgba */

/** @param {Uint8Array} b @param {number} o */
function u32(b, o) {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

/** @param {Uint8Array} dati zlib */
async function gonfia(dati) {
  const flusso = new Blob([/** @type {BlobPart} */ (dati)]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(flusso).arrayBuffer());
}

/** Predittore di Paeth. @param {number} a @param {number} b @param {number} c */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Legge il PNG fino alle righe di byte già senza filtro (una riga = `passo` byte).
 * @param {Uint8Array} byte il file PNG
 */
async function righeGrezze(byte) {
  const firma = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!firma.every((v, i) => byte[i] === v)) throw new Error('non è un PNG');
  let larghezza = 0, altezza = 0, profondita = 0, tipo = 0, interlacciato = 0;
  /** @type {Uint8Array[]} */
  const idat = [];
  let o = 8;
  while (o + 8 <= byte.length) {
    const lung = u32(byte, o);
    const nome = String.fromCharCode(byte[o + 4], byte[o + 5], byte[o + 6], byte[o + 7]);
    const corpo = byte.subarray(o + 8, o + 8 + lung);
    if (nome === 'IHDR') {
      larghezza = u32(corpo, 0);
      altezza = u32(corpo, 4);
      profondita = corpo[8];
      tipo = corpo[9];
      interlacciato = corpo[12];
    } else if (nome === 'IDAT') idat.push(corpo);
    else if (nome === 'IEND') break;
    o += 12 + lung;
  }
  const canali = tipo === 6 ? 4 : tipo === 3 ? 1 : 0;
  const ammessa = tipo === 3 ? [1, 2, 4, 8].includes(profondita) : profondita === 8;
  if (!canali || interlacciato !== 0 || !ammessa) {
    throw new Error(`PNG non supportato (tipo ${tipo}, profondità ${profondita}, interlacciato ${interlacciato})`);
  }
  const compressi = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let k = 0;
  for (const c of idat) { compressi.set(c, k); k += c.length; }
  const grezzi = await gonfia(compressi);
  const passo = Math.ceil((larghezza * profondita * canali) / 8);
  // byte per pixel ai fini dei filtri (almeno 1)
  const bpp = Math.max(1, (profondita * canali) >> 3);
  const righe = new Uint8Array(passo * altezza);
  let prec = new Uint8Array(passo);
  let riga = new Uint8Array(passo);
  for (let y = 0; y < altezza; y++) {
    const base = y * (passo + 1);
    const filtro = grezzi[base];
    for (let x = 0; x < passo; x++) {
      const v = grezzi[base + 1 + x];
      const a = x >= bpp ? riga[x - bpp] : 0, b = prec[x], c = x >= bpp ? prec[x - bpp] : 0;
      let r;
      switch (filtro) {
        case 0: r = v; break;
        case 1: r = v + a; break;
        case 2: r = v + b; break;
        case 3: r = v + ((a + b) >> 1); break;
        case 4: r = v + paeth(a, b, c); break;
        default: throw new Error(`filtro PNG ${filtro} sconosciuto`);
      }
      riga[x] = r & 0xff;
    }
    righe.set(riga, y * passo);
    [prec, riga] = [riga, prec];
  }
  return { larghezza, altezza, profondita, tipo, passo, righe };
}

/**
 * @param {Uint8Array} byte il file PNG (a palette)
 * @returns {Promise<ImmagineIndicizzata>}
 */
export async function decodificaPngIndicizzato(byte) {
  const g = await righeGrezze(byte);
  if (g.tipo !== 3) throw new Error(`PNG non supportato (tipo ${g.tipo}): serve un PNG a palette`);
  const { larghezza, altezza, profondita, passo, righe } = g;
  const indici = new Uint8Array(larghezza * altezza);
  const perByte = 8 / profondita, maschera = (1 << profondita) - 1;
  for (let y = 0; y < altezza; y++) {
    for (let x = 0; x < larghezza; x++) {
      const byteRiga = righe[y * passo + Math.floor(x / perByte)];
      const spost = 8 - profondita * ((x % perByte) + 1);
      indici[y * larghezza + x] = (byteRiga >> spost) & maschera;
    }
  }
  return { larghezza, altezza, indici };
}

/**
 * @param {Uint8Array} byte il file PNG (RGBA, 8 bit per canale)
 * @returns {Promise<ImmagineRgba>}
 */
export async function decodificaPngRgba(byte) {
  const g = await righeGrezze(byte);
  if (g.tipo !== 6) throw new Error(`PNG non supportato (tipo ${g.tipo}): serve un PNG RGBA`);
  return { larghezza: g.larghezza, altezza: g.altezza, rgba: g.righe };
}

/**
 * Da RGBA agli indici di palette: ogni pixel opaco prende l'indice, fra `primo` e `ultimo`, del
 * colore esattamente uguale (o il più vicino, per sicurezza); i pixel trasparenti diventano
 * `trasparente`. Le sagome del periscopio sono il nibble n disegnato come 90h + n nella palette DAY.
 * @param {ImmagineRgba} img @param {number[][]} palette @param {number} primo @param {number} ultimo
 * @param {number} trasparente indice dei pixel trasparenti (da saltare poi in Tela.incolla)
 * @returns {ImmagineIndicizzata}
 */
export function rgbaInIndici(img, palette, primo, ultimo, trasparente) {
  const n = img.larghezza * img.altezza;
  const indici = new Uint8Array(n);
  /** @type {Map<number, number>} */
  const memo = new Map();
  for (let i = 0; i < n; i++) {
    const r = img.rgba[4 * i], g = img.rgba[4 * i + 1], b = img.rgba[4 * i + 2], a = img.rgba[4 * i + 3];
    if (a < 128) { indici[i] = trasparente; continue; }
    const k = (r << 16) | (g << 8) | b;
    let idx = memo.get(k);
    if (idx === undefined) {
      let migliore = primo, dmin = Infinity;
      for (let j = primo; j <= ultimo; j++) {
        const c = palette[j] ?? [0, 0, 0];
        const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
        if (d < dmin) { dmin = d; migliore = j; }
      }
      idx = migliore;
      memo.set(k, idx);
    }
    indici[i] = idx;
  }
  return { larghezza: img.larghezza, altezza: img.altezza, indici };
}
