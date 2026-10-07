# 688 Attack Sub (EA 1989) — inventario degli asset e dei formati

Analisi dei file della versione DOS (GAME.EXE del 12/06/1989, librerie del 04/03/1989) fatta per riusare la
grafica originale in un tributo. Tutto ciò che segue è stato ricavato da disassemblaggio statico degli eseguibili
(dopo averli spacchettati) e verificato decodificando i file; dove qualcosa è dedotto e non verificato lo dico.

**Cartella di lavoro:** `scratchpad/assets/`

| percorso | contenuto |
|---|---|
| `estrai688.py` | estrattore unico (Python 3 + Pillow): `python3 estrai688.py orig out` rigenera tutto `out/` in circa 3 s |
| `orig/` | copia dei file originali (gli originali in `<cartella del gioco>/` non sono stati toccati) |
| `out/raw/DISK1, DISK2/` | i 205 membri delle librerie, estratti così come sono, più gli indici `*_index.txt` |
| `out/decompressed/` | i 34 file LZW/LZA decompressi (`.bin`) |
| `out/png/screens, crew, periscope, periscope_night, maps, ui/` | tutte le immagini decodificate (PNG; gli sprite trasparenti sono RGBA) |
| `out/png/cls/` | rendering delle schermate descritte dagli script CLS (stazioni 688/Alfa, menu, aiuto, dialoghi) + versioni `_hotspots` |
| `out/png/briefings/` | ordini di missione renderizzati con il font del gioco, stile sala radio |
| `out/png/font/` | il font del gioco (foglio PNG ×3 e JSON con le bitmap) |
| `out/palettes/` | campionari delle palette (DAY, NIGHT, 688, ALFA, TITLE, EGA, navmap, grey) |
| `out/wav/` | i 6 suoni `.T` in WAV a 8 bit, più la banca di campioni di CALLS.EXE (solo grezza) |
| `out/cls/*.txt` | disassemblato di tutti gli script CLS/LZA |
| `out/tok/` | disassemblato dei 22 scenari TOK, `units_all.tsv/json` (unità create), `templates_all.json` (incluse le armi) |
| `out/text/` | testi di ordini e debriefing, identificazione bersagli, tabella anticopia, `mission_config.tsv` |
| `out/exe/` | EXE spacchettati, stringhe, `GAME_tables.json`, simboli di debug di TITLE.EXE |
| `out/contact_sheets/` | provini: screens, maps, crew, periscope 1-4, ui, cls 1-5 |
| `reference_dosbox/` | 18 schermate catturate da DOSBox 0.74 (VGA, missione 1), il riferimento con cui ho confrontato i render; **non** sono rigenerate dallo script |
| `re/` | appunti di reverse engineering: disassemblati (`game_seg0.asm`, `game_farsegs.asm`, `calls.asm`), handler TOK, script di supporto |
| `unexepack.py` | spacchettatore EXEPACK autonomo (la stessa logica è anche dentro `estrai688.py`) |

---

## 1. Ricerca web (cosa esiste già)

| fonte | cosa contiene |
|---|---|
| canadianavenger, "Attack of the subs" (15/07/2024) — https://canadianavenger.io/2024/07/15/attack-of-the-subs/ | **L'unico lavoro sui formati che ho trovato.** Decodifica `*.PAK`/`*.PAL` (raw 320×200 + palette) e `MAIN.EGA` con lo stesso RLE che ho trovato io (corsa = (c&7Fh)+3, letterale = c+1, nibble alto prima, righe dal basso). Non tocca le librerie `.MLB` («se ci sono altre immagini saranno dentro gli eseguibili, che sono compressi»: in realtà stanno nelle MLB). |
| canadianavenger, "Running on empty" (20/07/2024) — https://canadianavenger.io/2024/07/20/running-on-empty/ e codice https://github.com/canadianavenger/ea-pak (licenza MIT) | Codificatore e decodificatore PAK ed EGA da e verso BMP. |
| John W. Ratcliff, "Everyone Deserves a Good Origin Story" (2014) — http://codesuppository.blogspot.com/2014/07/everyone-deserves-good-origin-story.html | Storia del gioco: Paul Grace ha curato game design e missioni, Ratcliff tutto il codice. Il motore disegna navi, costa ed esplosioni come height field 3D con sprite "rotoscopati". Il gioco è nato in 16 colori ed è passato a 256 (MCGA) durante lo sviluppo. Ha audio digitale anche su PC speaker e partita via modem. Gli ufficiali sono foto di dipendenti EA (Randy Breen è l'ufficiale alle armi). Fu distribuito anche come demo giocabile allegata ai floppy Maxell. |
| GitHub `jratcliff63367` — https://github.com/jratcliff63367 | Nessun sorgente di 688. C'è solo `digpak` (i driver audio DIGPAK, successivi). **Il codice di 688 non risulta mai pubblicato.** |
| Dr. Dobb's | Ratcliff vi ha scritto di compressione audio e di musica e suono nei giochi (1991), non di LZW. L'articolo LZW di riferimento del 10/1989 è di Mark Nelson (http://www.drdobbs.com/architecture-and-design/lzw-data-compression/184408217): l'LZW di 688 è dello stesso tipo, ma con un'implementazione in assembly propria. |
| ModdingWiki (moddingwiki.shikadi.net) | Da qui non raggiungibile (timeout su curl e WebFetch, anche tramite archive.org). Nessun risultato di ricerca indicizzato per "688 Attack Sub". |
| SUBSIM "688 Attack Sub: Modern Analysis" — https://www.subsim.com/radioroom/showthread.php?t=237891 | Forum (risponde 403 ai fetch). Secondo i riassunti un utente ha modificato il gioco patchando l'EXE con il debugger Borland. Nessuna documentazione dei formati. |
| VOGONS / nerdlypleasures — http://nerdlypleasures.blogspot.com/2014/07/pushing-limits-pc-sound-chip-digitized.html , https://www.tales-from-darkenedroom.com/post/688-attack-sub-not-running-silent | Solo conferme: il gioco usa audio digitalizzato su Tandy (porta C0h), Covox e PC speaker; AdLib serve per la musica. |
| VGMRips — https://vgmrips.net/packs/pack/688-attack-sub-ibm-pc-xt-at-tandy-1000 | La musica del titolo (cioè CALLS.EXE) registrata su Tandy. |

Nessuno aveva decodificato MLB, LZW, ENC, CLS, TOK, `.T` o le tabelle: quello che segue è nuovo.

---

## 2. Come carica i dati il gioco (mappa del codice)

- I tre EXE sono compressi con **Microsoft EXEPACK** (la stringa "Packed file is corrupt" lo rivela). EXEPACK è
  un RLE all'indietro, per questo le stringhe erano già leggibili. Le dimensioni spacchettate sono: GAME 128592 B
  (45 rilocazioni), TITLE 13856 B, CALLS 65408 B.
- GAME.EXE è in Turbo C, modello *small/compact*. Il codice C principale sta nel segmento 0 (0000–FEBF) e richiama
  moduli assembly "far" ai paragrafi 0FEC, 1011 (motore di simulazione e interprete TOK), 124D, 1283 (LZW), 129D
  (sprite scalati), 12C2. DGROUP è 1306h, quindi l'immagine lineare del segmento dati parte da 13060h.
- `688.BAT` lancia `TITLE`, che fa scegliere video (EGA/Tandy/CGA/VGA/Hercules) e audio, suona la musica tramite
  `CALLS.EXE` ed esce con un ERRORLEVEL. Poi il batch avvia `GAME n`.
- GAME apre `DISK1.MLB` e `DISK2.MLB` (0000:CE29) e carica i membri per nome in "slot" di memoria (0000:CF14).
  `*.LZW` e `*.LZA` passano dal decompressore (0000:F59F → far 1283:000D).
  Le immagini si disegnano con 0000:B28F (sprite e figure a schermo intero) o 129D:000B (sprite scalati del
  periscopio). Le schermate sono script CLS eseguiti da 0000:BB44.
  Gli scenari `SCENEnx.TOK` vengono copiati in DS:5105 ed eseguiti dall'interprete 1011:137C.
- Le stazioni si costruiscono così (0000:1196): `STAT.CLS` routine 1 (688) o 2 (Alfa) per la cornice comune,
  poi `<STAZIONE>.CLS` routine 3 (688) o 4 (Alfa). I render in `out/png/cls/` riproducono questa sequenza.

---

## 3. Inventario completo (un asset per riga)

Legenda. **PIC-RLE**: immagine 4 bit/pixel con RLE (§4.4). **dim** = larghezza × righe memorizzate.
**palette**: come il gioco colora i nibble in modalità VGA. "DAY/NIGHT b+n" significa indice = b + nibble nella
palette DAY.PAL o NIGHT.PAL; "EGA 16" sono i 16 colori standard (identici agli indici 0–15 di DAY.PAL); "trasp. k"
indica che il nibble k non viene disegnato. Le descrizioni vengono dall'aver guardato ogni PNG.

| libreria | membro | formato | byte | decodificato | cosa contiene | palette | dim / frame |
|---|---|---|---|---|---|---|---|
| DISK1.MLB | DIALOG0.ENC | PIC-RLE | 219 | sì | pulsante "OK" dei riquadri di dialogo | EGA 16 | 29x21 |
| DISK1.MLB | DIALOG1.ENC | PIC-RLE | 314 | sì | pulsante "CANCEL" | EGA 16 | 58x22 |
| DISK1.MLB | DIAL0.ENC | PIC-RLE | 144 | sì | selettore cifra UP/DN del numero di telefono (pannello configurazione) | EGA 16 | 11x24 |
| DISK1.MLB | SURFA.LZW | LZW > PIC-RLE | 9352 | sì | mappa batimetrica, indice mappa 0 = missione 6 GOULASH (Jugoslavia/Adriatico secondo il briefing) | DAY 191+4n (mappa nav.) | 320x200 |
| DISK1.MLB | SURFB.LZW | LZW > PIC-RLE | 11384 | sì | mappa batimetrica, indice 1 = missione 0 HIT AND RUN | DAY 191+4n (mappa nav.) | 319x200 |
| DISK1.MLB | SURFC.LZW | LZW > PIC-RLE | 12874 | sì | mappa batimetrica, indice 2 = missione 3 SUB OPS (costa di Polyarnyy, lato sovietico) | DAY 191+4n (mappa nav.) | 320x200 |
| DISK1.MLB | SURFG.LZW | LZW > PIC-RLE | 15308 | sì | mappa batimetrica, indice 6 = missioni 1 TORPEX e 2 SHAKE EM (isole Faroe) | DAY 191+4n (mappa nav.) | 319x200 |
| DISK1.MLB | DAY.PAL | palette RGB 8 bit | 768 | sì | palette VGA 256 colori diurna (= 688.PAL = ALFA.PAL) | - |  |
| DISK1.MLB | NIGHT.PAL | palette RGB 8 bit | 768 | sì | palette VGA notturna: cielo scuro, rampa grigia 144-159 diventa rossa (periscopio notturno) | - |  |
| DISK1.MLB | SELECT.CLS | CLS bytecode | 2354 | sì (bytecode); resa esatta (§4.7) | script schermate: L00 selezione missione, L01 pannello di configurazione, L02-L0B widget (fulmine modem, caselle) | EGA 16 / VGA 0-15 |  |
| DISK1.MLB | DIALOG.CLS | CLS bytecode | 2661 | sì (bytecode); resa esatta (§4.7) | script: 30 riquadri di dialogo parametrici (PLAY AGAIN, EXIT TO DOS, pausa, modem...) | EGA 16 |  |
| DISK1.MLB | SCENE0A.LZA | LZW > CLS | 2896 | sì | missione 0, lato USA (688): ordini, debriefing, configurazione armi/mappa |  | 5250 byte decompr. |
| DISK1.MLB | SCENE1A.LZA | LZW > CLS | 2762 | sì | missione 1, lato USA (688): ordini, debriefing, configurazione armi/mappa |  | 5120 byte decompr. |
| DISK1.MLB | SCENE1B.LZA | LZW > CLS | 1966 | sì | missione 1, lato URSS (Alfa): ordini, debriefing, configurazione armi/mappa |  | 3507 byte decompr. |
| DISK1.MLB | SCENE1C.LZA | LZW > CLS | 2482 | sì | missione 1, lato partita modem 688 vs Alfa: ordini, debriefing, configurazione armi/mappa |  | 4770 byte decompr. |
| DISK1.MLB | SCENE2A.LZA | LZW > CLS | 2378 | sì | missione 2, lato USA (688): ordini, debriefing, configurazione armi/mappa |  | 4253 byte decompr. |
| DISK1.MLB | SCENE2B.LZA | LZW > CLS | 2260 | sì | missione 2, lato URSS (Alfa): ordini, debriefing, configurazione armi/mappa |  | 4072 byte decompr. |
| DISK1.MLB | SCENE3B.LZA | LZW > CLS | 2662 | sì | missione 3, lato URSS (Alfa): ordini, debriefing, configurazione armi/mappa |  | 4910 byte decompr. |
| DISK1.MLB | SCENE4A.LZA | LZW > CLS | 2522 | sì | missione 4, lato USA (688): ordini, debriefing, configurazione armi/mappa |  | 4497 byte decompr. |
| DISK1.MLB | SCENE5A.LZA | LZW > CLS | 2680 | sì | missione 5, lato USA (688): ordini, debriefing, configurazione armi/mappa |  | 4798 byte decompr. |
| DISK1.MLB | SCENE5B.LZA | LZW > CLS | 2612 | sì | missione 5, lato URSS (Alfa): ordini, debriefing, configurazione armi/mappa |  | 4625 byte decompr. |
| DISK1.MLB | SCENE6A.LZA | LZW > CLS | 2570 | sì | missione 6, lato USA (688): ordini, debriefing, configurazione armi/mappa |  | 4752 byte decompr. |
| DISK1.MLB | SCENE7A.LZA | LZW > CLS | 2250 | sì | missione 7, lato USA (688): ordini, debriefing, configurazione armi/mappa |  | 3936 byte decompr. |
| DISK1.MLB | SCENE7B.LZA | LZW > CLS | 1876 | sì | missione 7, lato URSS (Alfa): ordini, debriefing, configurazione armi/mappa |  | 3360 byte decompr. |
| DISK1.MLB | SCENE7C.LZA | LZW > CLS | 3188 | sì | missione 7, lato partita modem 688 vs Alfa: ordini, debriefing, configurazione armi/mappa |  | 5811 byte decompr. |
| DISK1.MLB | SCENE8A.LZA | LZW > CLS | 2042 | sì | missione 8, lato USA (688): ordini, debriefing, configurazione armi/mappa |  | 3624 byte decompr. |
| DISK1.MLB | SCENE8B.LZA | LZW > CLS | 1658 | sì | missione 8, lato URSS (Alfa): ordini, debriefing, configurazione armi/mappa |  | 2788 byte decompr. |
| DISK1.MLB | SCENE8C.LZA | LZW > CLS | 2704 | sì | missione 8, lato partita modem 688 vs Alfa: ordini, debriefing, configurazione armi/mappa |  | 4837 byte decompr. |
| DISK1.MLB | SCENE9A.LZA | LZW > CLS | 2100 | sì | missione 9, lato USA (688): ordini, debriefing, configurazione armi/mappa |  | 3745 byte decompr. |
| DISK1.MLB | SCENE9B.LZA | LZW > CLS | 1976 | sì | missione 9, lato URSS (Alfa): ordini, debriefing, configurazione armi/mappa |  | 3564 byte decompr. |
| DISK1.MLB | SCENE9C.LZA | LZW > CLS | 3206 | sì | missione 9, lato partita modem 688 vs Alfa: ordini, debriefing, configurazione armi/mappa |  | 5906 byte decompr. |
| DISK1.MLB | SCENE1B.TOK | TOK bytecode | 2048 | sì (bytecode), semantica parziale | missione 1, lato URSS: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE1C.TOK | TOK bytecode | 1620 | sì (bytecode), semantica parziale | missione 1, lato modem: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE4A.TOK | TOK bytecode | 2303 | sì (bytecode), semantica parziale | missione 4, lato USA: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE5A.TOK | TOK bytecode | 1863 | sì (bytecode), semantica parziale | missione 5, lato USA: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE5B.TOK | TOK bytecode | 1917 | sì (bytecode), semantica parziale | missione 5, lato URSS: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE5C.TOK | TOK bytecode | 1131 | sì (bytecode), semantica parziale | missione 5, lato modem: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE6A.TOK | TOK bytecode | 1979 | sì (bytecode), semantica parziale | missione 6, lato USA: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE7A.TOK | TOK bytecode | 1879 | sì (bytecode), semantica parziale | missione 7, lato USA: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE7B.TOK | TOK bytecode | 2180 | sì (bytecode), semantica parziale | missione 7, lato URSS: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE7C.TOK | TOK bytecode | 1794 | sì (bytecode), semantica parziale | missione 7, lato modem: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE8A.TOK | TOK bytecode | 2288 | sì (bytecode), semantica parziale | missione 8, lato USA: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE8B.TOK | TOK bytecode | 2284 | sì (bytecode), semantica parziale | missione 8, lato URSS: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE8C.TOK | TOK bytecode | 2012 | sì (bytecode), semantica parziale | missione 8, lato modem: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE9A.TOK | TOK bytecode | 2209 | sì (bytecode), semantica parziale | missione 9, lato USA: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE9C.TOK | TOK bytecode | 2142 | sì (bytecode), semantica parziale | missione 9, lato modem: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE0A.TOK | TOK bytecode | 2404 | sì (bytecode), semantica parziale | missione 0, lato USA: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE1A.TOK | TOK bytecode | 1479 | sì (bytecode), semantica parziale | missione 1, lato USA: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE2A.TOK | TOK bytecode | 1408 | sì (bytecode), semantica parziale | missione 2, lato USA: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE2B.TOK | TOK bytecode | 1602 | sì (bytecode), semantica parziale | missione 2, lato URSS: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE2C.TOK | TOK bytecode | 1176 | sì (bytecode), semantica parziale | missione 2, lato modem: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE3B.TOK | TOK bytecode | 2075 | sì (bytecode), semantica parziale | missione 3, lato URSS: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE9B.TOK | TOK bytecode | 2415 | sì (bytecode), semantica parziale | missione 9, lato URSS: script di scenario (unità, IA, eventi, comandi del giocatore) |  |  |
| DISK1.MLB | SCENE2C.LZA | LZW > CLS | 4378 | sì | missione 2, lato partita modem 688 vs Alfa: ordini, debriefing, configurazione armi/mappa |  | 8330 byte decompr. |
| DISK1.MLB | SCENE5C.LZA | LZW > CLS | 4558 | sì | missione 5, lato partita modem 688 vs Alfa: ordini, debriefing, configurazione armi/mappa |  | 8598 byte decompr. |
| DISK2.MLB | FOREST0.ENC | PIC-RLE | 573 | sì | cacciatorpediniere classe Forrest Sherman - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 23x53 |
| DISK2.MLB | FOREST1.ENC | PIC-RLE | 1162 | sì | cacciatorpediniere classe Forrest Sherman - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 87x52 |
| DISK2.MLB | FOREST2.ENC | PIC-RLE | 2057 | sì | cacciatorpediniere classe Forrest Sherman - di fianco | DAY/NIGHT 144+n, trasp. 15 | 188x52 |
| DISK2.MLB | FOREST3.ENC | PIC-RLE | 1410 | sì | cacciatorpediniere classe Forrest Sherman - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 108x52 |
| DISK2.MLB | FOREST4.ENC | PIC-RLE | 587 | sì | cacciatorpediniere classe Forrest Sherman - poppa | DAY/NIGHT 144+n, trasp. 15 | 23x53 |
| DISK2.MLB | SUB1.ENC | PIC-RLE | 3004 | sì | 688 in spaccato con compartimenti (schermata STATUS, danni) | EGA 16, trasp. 1 | 298x60 |
| DISK2.MLB | SUB2.ENC | PIC-RLE | 2752 | sì | 688 vista esterna (schermata STATUS) | EGA 16, trasp. 1 | 299x46 |
| DISK2.MLB | 4WAY.ENC | PIC-RLE | 529 | sì | tastierino 3x3 P/F/S I/H/O C/B/T dei controlli di visualizzazione | EGA 16 | 33x33 |
| DISK2.MLB | SFX23.ENC | PIC-RLE | 810 | sì | colonna d'acqua di un'esplosione, 4 fasi, fase 3 | DAY/NIGHT 160+n, trasp. 15 | 82x26 |
| DISK2.MLB | SFX20.ENC | PIC-RLE | 502 | sì | colonna d'acqua di un'esplosione, 4 fasi, fase 0 | DAY/NIGHT 160+n, trasp. 15 | 53x30 |
| DISK2.MLB | SFX21.ENC | PIC-RLE | 905 | sì | colonna d'acqua di un'esplosione, 4 fasi, fase 1 | DAY/NIGHT 160+n, trasp. 15 | 75x38 |
| DISK2.MLB | SFX22.ENC | PIC-RLE | 1275 | sì | colonna d'acqua di un'esplosione, 4 fasi, fase 2 | DAY/NIGHT 160+n, trasp. 15 | 81x47 |
| DISK2.MLB | EXP1.T | PCM 4 bit | 5696 | sì (rate nominale) | esplosione (siluro a segno) |  | 11392 campioni |
| DISK2.MLB | TORPRAMP.T | PCM 4 bit | 3798 | sì (rate nominale) | lancio siluro |  | 7596 campioni |
| DISK2.MLB | WHALE2.T | PCM 4 bit | 4424 | sì (rate nominale) | canto di balena (contatto BIOLOGICAL) |  | 8848 campioni |
| DISK2.MLB | LOGO0.ENC | PIC-RLE | 520 | sì | logo "688" (riquadro blu con sottomarino) della schermata di aiuto | EGA 16 | 92x29 |
| DISK2.MLB | MAIN.LZW | LZW > PIC-RLE | 16328 | sì | sala comando del 688, versione EGA 16 colori | EGA 16 | 320x200 |
| DISK2.MLB | STATUS.CLS | CLS bytecode | 767 | sì (bytecode); resa esatta (§4.7) | script: cornice della stazione STATUS (vista laterale del sottomarino) | EGA 16 |  |
| DISK2.MLB | REVIEW.CLS | CLS bytecode | 52 | sì (bytecode); resa esatta (§4.7) | script: 3 hotspot del riesame messaggi | - |  |
| DISK2.MLB | UP.ENC | PIC-RLE | 68 | sì | interruttore in posizione UP | EGA 16 | 10x12 |
| DISK2.MLB | DN.ENC | PIC-RLE | 68 | sì | interruttore in posizione DN | EGA 16 | 10x12 |
| DISK2.MLB | KARA0.ENC | PIC-RLE | 559 | sì | incrociatore classe Kara - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 28x43 |
| DISK2.MLB | KARA1.ENC | PIC-RLE | 1242 | sì | incrociatore classe Kara - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 117x41 |
| DISK2.MLB | KARA2.ENC | PIC-RLE | 2005 | sì | incrociatore classe Kara - di fianco | DAY/NIGHT 144+n, trasp. 15 | 250x42 |
| DISK2.MLB | KARA3.ENC | PIC-RLE | 1128 | sì | incrociatore classe Kara - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 114x40 |
| DISK2.MLB | KARA4.ENC | PIC-RLE | 540 | sì | incrociatore classe Kara - poppa | DAY/NIGHT 144+n, trasp. 15 | 27x43 |
| DISK2.MLB | KIROV0.ENC | PIC-RLE | 583 | sì | incrociatore nucleare Kirov - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 34x44 |
| DISK2.MLB | KIROV1.ENC | PIC-RLE | 1332 | sì | incrociatore nucleare Kirov - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 127x43 |
| DISK2.MLB | KIROV2.ENC | PIC-RLE | 2327 | sì | incrociatore nucleare Kirov - di fianco | DAY/NIGHT 144+n, trasp. 15 | 254x44 |
| DISK2.MLB | KIROV3.ENC | PIC-RLE | 1342 | sì | incrociatore nucleare Kirov - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 128x43 |
| DISK2.MLB | KIROV4.ENC | PIC-RLE | 566 | sì | incrociatore nucleare Kirov - poppa | DAY/NIGHT 144+n, trasp. 15 | 32x44 |
| DISK2.MLB | MERCH0.ENC | PIC-RLE | 525 | sì | nave mercantile - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 32x38 |
| DISK2.MLB | MERCH1.ENC | PIC-RLE | 1384 | sì | nave mercantile - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 110x35 |
| DISK2.MLB | MERCH2.ENC | PIC-RLE | 2068 | sì | nave mercantile - di fianco | DAY/NIGHT 144+n, trasp. 15 | 226x34 |
| DISK2.MLB | MERCH3.ENC | PIC-RLE | 1423 | sì | nave mercantile - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 114x35 |
| DISK2.MLB | MERCH4.ENC | PIC-RLE | 509 | sì | nave mercantile - poppa | DAY/NIGHT 144+n, trasp. 15 | 31x35 |
| DISK2.MLB | SLAVA0.ENC | PIC-RLE | 717 | sì | incrociatore classe Slava - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 31x51 |
| DISK2.MLB | SLAVA1.ENC | PIC-RLE | 1502 | sì | incrociatore classe Slava - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 105x51 |
| DISK2.MLB | SLAVA2.ENC | PIC-RLE | 2935 | sì | incrociatore classe Slava - di fianco | DAY/NIGHT 144+n, trasp. 15 | 254x50 |
| DISK2.MLB | SLAVA3.ENC | PIC-RLE | 1794 | sì | incrociatore classe Slava - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 128x49 |
| DISK2.MLB | SLAVA4.ENC | PIC-RLE | 654 | sì | incrociatore classe Slava - poppa | DAY/NIGHT 144+n, trasp. 15 | 28x51 |
| DISK2.MLB | SONAR1.T | PCM 4 bit | 6019 | sì (rate nominale) | ping del sonar attivo |  | 12038 campioni |
| DISK2.MLB | MBOX0.ENC | PIC-RLE | 122 | sì | icona busta/messaggio | EGA 16 | 27x11 |
| DISK2.MLB | M.CLS | CLS bytecode | 297 | sì (bytecode); resa esatta (§4.7) | script: hotspot della sala comando (L00 = 688, L01 = Alfa) + mappa colori CGA | - |  |
| DISK2.MLB | NIMITZ0.ENC | PIC-RLE | 633 | sì | portaerei classe Nimitz (8 angolazioni) - angolazione 0 | DAY/NIGHT 144+n, trasp. 15 | 65x32 |
| DISK2.MLB | NIMITZ1.ENC | PIC-RLE | 1269 | sì | portaerei classe Nimitz (8 angolazioni) - angolazione 1 | DAY/NIGHT 144+n, trasp. 15 | 141x33 |
| DISK2.MLB | NIMITZ2.ENC | PIC-RLE | 1986 | sì | portaerei classe Nimitz (8 angolazioni) - angolazione 2 | DAY/NIGHT 144+n, trasp. 15 | 255x34 |
| DISK2.MLB | NIMITZ3.ENC | PIC-RLE | 1161 | sì | portaerei classe Nimitz (8 angolazioni) - angolazione 3 | DAY/NIGHT 144+n, trasp. 15 | 136x35 |
| DISK2.MLB | NIMITZ4.ENC | PIC-RLE | 689 | sì | portaerei classe Nimitz (8 angolazioni) - angolazione 4 | DAY/NIGHT 144+n, trasp. 15 | 67x35 |
| DISK2.MLB | NIMITZ5.ENC | PIC-RLE | 1083 | sì | portaerei classe Nimitz (8 angolazioni) - angolazione 5 | DAY/NIGHT 144+n, trasp. 15 | 126x33 |
| DISK2.MLB | NIMITZ6.ENC | PIC-RLE | 1981 | sì | portaerei classe Nimitz (8 angolazioni) - angolazione 6 | DAY/NIGHT 144+n, trasp. 15 | 255x32 |
| DISK2.MLB | NIMITZ7.ENC | PIC-RLE | 1115 | sì | portaerei classe Nimitz (8 angolazioni) - angolazione 7 | DAY/NIGHT 144+n, trasp. 15 | 146x32 |
| DISK2.MLB | IOWA0.ENC | PIC-RLE | 527 | sì | corazzata classe Iowa - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 30x39 |
| DISK2.MLB | IOWA1.ENC | PIC-RLE | 1078 | sì | corazzata classe Iowa - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 128x38 |
| DISK2.MLB | IOWA2.ENC | PIC-RLE | 1875 | sì | corazzata classe Iowa - di fianco | DAY/NIGHT 144+n, trasp. 15 | 255x39 |
| DISK2.MLB | IOWA3.ENC | PIC-RLE | 1007 | sì | corazzata classe Iowa - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 116x38 |
| DISK2.MLB | IOWA4.ENC | PIC-RLE | 548 | sì | corazzata classe Iowa - poppa | DAY/NIGHT 144+n, trasp. 15 | 32x39 |
| DISK2.MLB | KIDD0.ENC | PIC-RLE | 605 | sì | cacciatorpediniere classe Kidd - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 24x52 |
| DISK2.MLB | KIDD1.ENC | PIC-RLE | 1472 | sì | cacciatorpediniere classe Kidd - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 107x51 |
| DISK2.MLB | KIDD2.ENC | PIC-RLE | 2613 | sì | cacciatorpediniere classe Kidd - di fianco | DAY/NIGHT 144+n, trasp. 15 | 242x53 |
| DISK2.MLB | KIDD3.ENC | PIC-RLE | 1486 | sì | cacciatorpediniere classe Kidd - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 109x51 |
| DISK2.MLB | KIDD4.ENC | PIC-RLE | 606 | sì | cacciatorpediniere classe Kidd - poppa | DAY/NIGHT 144+n, trasp. 15 | 23x52 |
| DISK2.MLB | OHP0.ENC | PIC-RLE | 515 | sì | fregata Oliver Hazard Perry - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 23x50 |
| DISK2.MLB | OHP1.ENC | PIC-RLE | 1239 | sì | fregata Oliver Hazard Perry - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 103x49 |
| DISK2.MLB | OHP2.ENC | PIC-RLE | 2032 | sì | fregata Oliver Hazard Perry - di fianco | DAY/NIGHT 144+n, trasp. 15 | 203x51 |
| DISK2.MLB | OHP3.ENC | PIC-RLE | 1191 | sì | fregata Oliver Hazard Perry - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 105x50 |
| DISK2.MLB | OHP4.ENC | PIC-RLE | 579 | sì | fregata Oliver Hazard Perry - poppa | DAY/NIGHT 144+n, trasp. 15 | 27x52 |
| DISK2.MLB | SAC0.ENC | PIC-RLE | 513 | sì | rifornitrice classe Sacramento - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 34x33 |
| DISK2.MLB | SAC1.ENC | PIC-RLE | 1204 | sì | rifornitrice classe Sacramento - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 114x32 |
| DISK2.MLB | SAC2.ENC | PIC-RLE | 2305 | sì | rifornitrice classe Sacramento - di fianco | DAY/NIGHT 144+n, trasp. 15 | 255x29 |
| DISK2.MLB | SAC3.ENC | PIC-RLE | 1325 | sì | rifornitrice classe Sacramento - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 127x29 |
| DISK2.MLB | SAC4.ENC | PIC-RLE | 470 | sì | rifornitrice classe Sacramento - poppa | DAY/NIGHT 144+n, trasp. 15 | 34x29 |
| DISK2.MLB | KRIVAK0.ENC | PIC-RLE | 360 | sì | fregata Krivak II - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 24x32 |
| DISK2.MLB | KRIVAK1.ENC | PIC-RLE | 779 | sì | fregata Krivak II - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 95x31 |
| DISK2.MLB | KRIVAK2.ENC | PIC-RLE | 1406 | sì | fregata Krivak II - di fianco | DAY/NIGHT 144+n, trasp. 15 | 193x32 |
| DISK2.MLB | KRIVAK3.ENC | PIC-RLE | 896 | sì | fregata Krivak II - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 109x31 |
| DISK2.MLB | KRIVAK4.ENC | PIC-RLE | 358 | sì | fregata Krivak II - poppa | DAY/NIGHT 144+n, trasp. 15 | 24x32 |
| DISK2.MLB | TANKER0.ENC | PIC-RLE | 365 | sì | petroliera - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 33x25 |
| DISK2.MLB | TANKER1.ENC | PIC-RLE | 899 | sì | petroliera - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 117x25 |
| DISK2.MLB | TANKER2.ENC | PIC-RLE | 1557 | sì | petroliera - di fianco | DAY/NIGHT 144+n, trasp. 15 | 253x27 |
| DISK2.MLB | TANKER3.ENC | PIC-RLE | 914 | sì | petroliera - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 119x26 |
| DISK2.MLB | TANKER4.ENC | PIC-RLE | 366 | sì | petroliera - poppa | DAY/NIGHT 144+n, trasp. 15 | 32x26 |
| DISK2.MLB | CARGO0.ENC | PIC-RLE | 602 | sì | nave da carico - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 37x36 |
| DISK2.MLB | CARGO1.ENC | PIC-RLE | 1348 | sì | nave da carico - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 114x38 |
| DISK2.MLB | CARGO2.ENC | PIC-RLE | 2907 | sì | nave da carico - di fianco | DAY/NIGHT 144+n, trasp. 15 | 255x41 |
| DISK2.MLB | CARGO3.ENC | PIC-RLE | 1493 | sì | nave da carico - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 123x41 |
| DISK2.MLB | CARGO4.ENC | PIC-RLE | 676 | sì | nave da carico - poppa | DAY/NIGHT 144+n, trasp. 15 | 36x41 |
| DISK2.MLB | CREW1.ENC | PIC-RLE | 7481 | sì | ritratto fotografico digitalizzato di un ufficiale (dipendenti EA) (CREW1) | DAY/NIGHT 144+n | 168x94 |
| DISK2.MLB | CREW2.ENC | PIC-RLE | 5579 | sì | ritratto fotografico digitalizzato di un ufficiale (dipendenti EA) (CREW2) | DAY/NIGHT 144+n | 173x96 |
| DISK2.MLB | CREW3.ENC | PIC-RLE | 7546 | sì | ritratto fotografico digitalizzato di un ufficiale (dipendenti EA) (CREW3) | DAY/NIGHT 144+n | 173x96 |
| DISK2.MLB | CREW4.ENC | PIC-RLE | 7459 | sì | ritratto fotografico digitalizzato di un ufficiale (dipendenti EA) (CREW4) | DAY/NIGHT 144+n | 173x96 |
| DISK2.MLB | CREW5.ENC | PIC-RLE | 7974 | sì | ritratto fotografico digitalizzato di un ufficiale (dipendenti EA) (CREW5) | DAY/NIGHT 144+n | 171x94 |
| DISK2.MLB | CREW6.ENC | PIC-RLE | 7595 | sì | ritratto fotografico digitalizzato di un ufficiale (dipendenti EA) (CREW6) | DAY/NIGHT 144+n | 173x96 |
| DISK2.MLB | CREW7.ENC | PIC-RLE | 7405 | sì | ritratto fotografico digitalizzato di un ufficiale (dipendenti EA) (CREW7) | DAY/NIGHT 144+n | 171x94 |
| DISK2.MLB | CREW8.ENC | PIC-RLE | 7502 | sì | ritratto fotografico digitalizzato di un ufficiale (dipendenti EA) (CREW8) | DAY/NIGHT 144+n | 171x94 |
| DISK2.MLB | SEAHAWK0.ENC | PIC-RLE | 963 | sì | elicottero SH-60B Seahawk (LAMPS III) - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 108x45 |
| DISK2.MLB | SEAHAWK1.ENC | PIC-RLE | 1137 | sì | elicottero SH-60B Seahawk (LAMPS III) - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 116x32 |
| DISK2.MLB | SEAHAWK2.ENC | PIC-RLE | 1243 | sì | elicottero SH-60B Seahawk (LAMPS III) - di fianco | DAY/NIGHT 144+n, trasp. 15 | 128x39 |
| DISK2.MLB | SEAHAWK3.ENC | PIC-RLE | 1263 | sì | elicottero SH-60B Seahawk (LAMPS III) - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 123x53 |
| DISK2.MLB | SEAHAWK4.ENC | PIC-RLE | 1173 | sì | elicottero SH-60B Seahawk (LAMPS III) - poppa | DAY/NIGHT 144+n, trasp. 15 | 99x60 |
| DISK2.MLB | SMK0.ENC | PIC-RLE | 3431 | sì | colonna di fumo con fiamme alla base, 3 varianti | DAY/NIGHT 80+n, trasp. 15 | 50x164 |
| DISK2.MLB | SMK1.ENC | PIC-RLE | 3382 | sì | colonna di fumo con fiamme alla base, 3 varianti | DAY/NIGHT 80+n, trasp. 15 | 45x167 |
| DISK2.MLB | SMK2.ENC | PIC-RLE | 3523 | sì | colonna di fumo con fiamme alla base, 3 varianti | DAY/NIGHT 80+n, trasp. 15 | 46x166 |
| DISK2.MLB | 2WAY.ENC | PIC-RLE | 80 | sì | freccette su/giù (zoom/scala) | EGA 16 | 10x15 |
| DISK2.MLB | RADIO.CLS | CLS bytecode | 4666 | sì (bytecode); resa esatta (§4.7) | script: sala radio (codice di sicurezza, MSG REVIEW, ESM, periscopio/antenna) | EGA 16 |  |
| DISK2.MLB | WCR.CLS | CLS bytecode | 3791 | sì (bytecode); resa esatta (§4.7) | script: controllo armi (tubi, missili, LAUNCH, controllo siluro) | EGA 16 |  |
| DISK2.MLB | PERI.CLS | CLS bytecode | 4404 | sì (bytecode); resa esatta (§4.7) | script: stazione periscopio | EGA 16 |  |
| DISK2.MLB | NAV.CLS | CLS bytecode | 3798 | sì (bytecode); resa esatta (§4.7) | script: tavolo di navigazione (plotting, waypoint, time projection) | EGA 16 |  |
| DISK2.MLB | END0.LZW | LZW > PIC-RLE | 7664 | sì | sfondo del debriefing: scrivania con cartella, matita, cornice per le foto END1-4 | EGA 16 | 319x200 |
| DISK2.MLB | END2.LZW | LZW > PIC-RLE | 4674 | sì | debriefing: cartolina "San Francisco" (rientro vittorioso USA) | EGA 16 | 205x134 |
| DISK2.MLB | END3.LZW | LZW > PIC-RLE | 5590 | sì | debriefing: ritratto di Lenin, "Comrade, the Navy regrets to inform you..." (Alfa perso) | EGA 16 | 205x134 |
| DISK2.MLB | END4.LZW | LZW > PIC-RLE | 5766 | sì | debriefing: cartolina "Greetings from Moscow" (vittoria sovietica) | EGA 16 | 205x134 |
| DISK2.MLB | TARGETS.LZW | LZW > CLS | 842 | sì (bytecode); resa esatta (§4.7) | NON immagine: script CLS con i testi di identificazione bersaglio per tipo (46 routine) | - |  |
| DISK2.MLB | ALFA.LZW | LZW > PIC-RLE | 17244 | sì | sala comando dell'Alfa, versione EGA 16 colori | EGA 16 | 319x200 |
| DISK2.MLB | MISSILE0.ENC | PIC-RLE | 370 | sì | sequenza lancio missile (0 emersione/spruzzo ... 7 puntino lontano) | DAY/NIGHT 167+n, trasp. 15 | 44x22 |
| DISK2.MLB | MISSILE1.ENC | PIC-RLE | 589 | sì | sequenza lancio missile (0 emersione/spruzzo ... 7 puntino lontano) | DAY/NIGHT 167+n, trasp. 15 | 66x39 |
| DISK2.MLB | MISSILE2.ENC | PIC-RLE | 533 | sì | sequenza lancio missile (0 emersione/spruzzo ... 7 puntino lontano) | DAY/NIGHT 167+n, trasp. 15 | 52x44 |
| DISK2.MLB | MISSILE3.ENC | PIC-RLE | 532 | sì | sequenza lancio missile (0 emersione/spruzzo ... 7 puntino lontano) | DAY/NIGHT 167+n, trasp. 15 | 59x44 |
| DISK2.MLB | MISSILE4.ENC | PIC-RLE | 278 | sì | sequenza lancio missile (0 emersione/spruzzo ... 7 puntino lontano) | DAY/NIGHT 167+n, trasp. 15 | 40x46 |
| DISK2.MLB | MISSILE5.ENC | PIC-RLE | 188 | sì | sequenza lancio missile (0 emersione/spruzzo ... 7 puntino lontano) | DAY/NIGHT 167+n, trasp. 15 | 6x46 |
| DISK2.MLB | MISSILE6.ENC | PIC-RLE | 145 | sì | sequenza lancio missile (0 emersione/spruzzo ... 7 puntino lontano) | DAY/NIGHT 167+n, trasp. 15 | 4x47 |
| DISK2.MLB | MISSILE7.ENC | PIC-RLE | 145 | sì | sequenza lancio missile (0 emersione/spruzzo ... 7 puntino lontano) | DAY/NIGHT 167+n, trasp. 15 | 4x47 |
| DISK2.MLB | PROP2.T | PCM 4 bit | 1655 | sì (rate nominale) | rumore d'elica (analisi sonar) |  | 3310 campioni |
| DISK2.MLB | PROPV2.T | PCM 4 bit | 1970 | sì (rate nominale) | rumore d'elica, variante (analisi sonar) |  | 3940 campioni |
| DISK2.MLB | DAMAGE0.ENC | PIC-RLE | 79 | sì | indicatore di danno della schermata STATUS | EGA 16 | 31x5 |
| DISK2.MLB | DAMAGE1.ENC | PIC-RLE | 26 | sì | indicatore di danno della schermata STATUS | EGA 16 | 150x3 |
| DISK2.MLB | DAMAGE2.ENC | PIC-RLE | 90 | sì | indicatore di danno della schermata STATUS | EGA 16 | 1x43 |
| DISK2.MLB | DAMAGE3.ENC | PIC-RLE | 157 | sì | indicatore di danno della schermata STATUS | EGA 16 | 15x17 |
| DISK2.MLB | DAMAGE4.ENC | PIC-RLE | 441 | sì | indicatore di danno della schermata STATUS | EGA 16 | 57x18 |
| DISK2.MLB | DAMAGE5.ENC | PIC-RLE | 64 | sì | indicatore di danno della schermata STATUS | EGA 16 | 2x30 |
| DISK2.MLB | SURFD.LZW | LZW > PIC-RLE | 9984 | sì | mappa batimetrica, indice 3 = missioni 4 MUMAR CADAVER e 5 ESCAPE (stretto di Gibilterra) | DAY 191+4n (mappa nav.) | 320x200 |
| DISK2.MLB | SURFE.LZW | LZW > PIC-RLE | 13264 | sì | mappa batimetrica, indice 4 = missione 7 CAT WALK (Pacifico, CINCPACFLT) | DAY 191+4n (mappa nav.) | 318x200 |
| DISK2.MLB | SURFF.LZW | LZW > PIC-RLE | 11968 | sì | mappa batimetrica, indice 5 = missioni 8 SURPRISE PARTY e 9 HOMECOMING (Mare di Norvegia / Atlantico) | DAY 191+4n (mappa nav.) | 320x200 |
| DISK2.MLB | STEER.CLS | CLS bytecode | 7163 | sì (bytecode); resa esatta (§4.7) | script: stazione governo (timone, macchine, quota, auto-funzioni) | EGA 16 |  |
| DISK2.MLB | STAT.CLS | CLS bytecode | 1947 | sì (bytecode); resa esatta (§4.7) | script: cornice comune a tutte le stazioni (barra TARGET/BEARING, riga messaggi, orologio, tastierino 4WAY) | EGA 16 |  |
| DISK2.MLB | TARGET0.ENC | PIC-RLE | 32 | sì | marcatore bersaglio 5x6 (i 5 file sono identici) | EGA 16 | 5x7 |
| DISK2.MLB | TARGET1.ENC | PIC-RLE | 32 | sì | marcatore bersaglio 5x6 (i 5 file sono identici) | EGA 16 | 5x7 |
| DISK2.MLB | TARGET2.ENC | PIC-RLE | 32 | sì | marcatore bersaglio 5x6 (i 5 file sono identici) | EGA 16 | 5x7 |
| DISK2.MLB | TARGET4.ENC | PIC-RLE | 32 | sì | marcatore bersaglio 5x6 (i 5 file sono identici) | EGA 16 | 5x7 |
| DISK2.MLB | TARGET3.ENC | PIC-RLE | 32 | sì | marcatore bersaglio 5x6 (i 5 file sono identici) | EGA 16 | 5x7 |
| DISK2.MLB | END1.LZW | LZW > PIC-RLE | 5730 | sì | debriefing: biglietto "With Sympathy and Honor from the U.S. Navy" (688 perso) | EGA 16 | 205x134 |
| DISK2.MLB | TOSH0.ENC | PIC-RLE | 230 | sì | targhetta "TOSHIBA MADE IN JAPAN" sul computer sonar dell'Alfa (allusione allo scandalo Toshiba-Kongsberg 1987) | EGA 16 | 50x12 |
| DISK2.MLB | SONAR.CLS | CLS bytecode | 4047 | sì (bytecode); resa esatta (§4.7) | script: sala sonar (analyze, filtri, sonar attivo, towed array) | EGA 16 |  |
| DISK2.MLB | HELP.CLS | CLS bytecode | 8059 | sì (bytecode); resa esatta (§4.7) | script: 88 fumetti di aiuto + pagina introduttiva + liste di parole chiave | EGA 16 |  |
| DISK2.MLB | NUCHKA0.ENC | PIC-RLE | 543 | sì | corvetta Nanuchka (usata per il tipo "KONI") - prua (di fronte) | DAY/NIGHT 144+n, trasp. 15 | 27x44 |
| DISK2.MLB | NUCHKA1.ENC | PIC-RLE | 1181 | sì | corvetta Nanuchka (usata per il tipo "KONI") - 3/4 prua | DAY/NIGHT 144+n, trasp. 15 | 89x44 |
| DISK2.MLB | NUCHKA2.ENC | PIC-RLE | 1968 | sì | corvetta Nanuchka (usata per il tipo "KONI") - di fianco | DAY/NIGHT 144+n, trasp. 15 | 170x45 |
| DISK2.MLB | NUCHKA3.ENC | PIC-RLE | 1291 | sì | corvetta Nanuchka (usata per il tipo "KONI") - 3/4 poppa | DAY/NIGHT 144+n, trasp. 15 | 103x43 |
| DISK2.MLB | NUCHKA4.ENC | PIC-RLE | 528 | sì | corvetta Nanuchka (usata per il tipo "KONI") - poppa | DAY/NIGHT 144+n, trasp. 15 | 27x44 |
| DISK2.MLB | HELICOP.ENC | LZW > CLS (travestito da .ENC) | 3550 | sì (bytecode); resa esatta (§4.7) | NON immagine: script CLS (LZW) con le 153 domande della protezione anticopia + risposte (3 lettere) | - |  |
| (sciolto) | 688.PAK | raw 320x200 8bpp | 64000 | sì | sala comando del 688, VGA 256 colori | 688.PAL | 320x200 |
| (sciolto) | 688.PAL | palette RGB 8 bit | 768 | sì | palette di 688.PAK (identica a DAY.PAL) | - | 256 |
| (sciolto) | ALFA.PAK | raw 320x200 8bpp | 64000 | sì | sala comando dell'Alfa, VGA | ALFA.PAL | 320x200 |
| (sciolto) | ALFA.PAL | palette RGB 8 bit | 768 | sì | palette (identica a DAY.PAL) | - | 256 |
| (sciolto) | TITLE.PAK | raw 320x200 8bpp | 64000 | sì | schermata del titolo VGA (688 in emersione) | TITLE.PAL | 320x200 |
| (sciolto) | TITLE.PAL | palette RGB 8 bit | 768 | sì | palette del titolo (rampe blu/grigie della foto) | - | 256 |
| (sciolto) | MAIN.EGA | PIC-RLE | 5807 | sì | schermata del titolo EGA (distintivo "dolphins"), non la sala comando | EGA 16 | 319x199 |
| (sciolto) | GAME.EXE | MZ + EXEPACK | 104572 | sì (spacchettato) | gioco (Turbo C + asm); contiene font, tabelle nomi, messaggi | - | 128592 B |
| (sciolto) | TITLE.EXE | MZ + EXEPACK | 16869 | sì (spacchettato) | titolo, scelta modalità video/audio, lancia CALLS | - | 13856 B (+4811 B coda) |
| (sciolto) | CALLS.EXE | MZ + EXEPACK | 64861 | parziale | driver musica del titolo (Tandy/speaker, AdLib, Covox) + banca campioni 4 bit (~56 KB) | - | 65408 B |
| (sciolto) | 688.BAT | testo | 351 | sì | TITLE %1 poi GAME n in base a ERRORLEVEL (= modalità video 1-6) | - |  |
| (sciolto) | MODEM.688 | testo | 18 | sì | stringa di init modem "ATV1E0X3" + separatori | - |  |
| (sciolto) | PROFILE.688 | binario | 19 | no (struttura non analizzata) | impostazioni salvate (scritto da GAME: "Couldn't write PROFILE.688") | - |  |

### 3.1 Asset raggruppati per tipo

- **Fondali e schermate (7 + 3 VGA):**
  - sala comando del 688: `688.PAK` (VGA) e `MAIN.LZW` (EGA), due disegni diversi, il tavolo di carteggio cambia;
  - sala comando dell'Alfa: `ALFA.PAK` e `ALFA.LZW`;
  - titolo: `TITLE.PAK` (VGA, foto del 688 in emersione) e `MAIN.EGA` (EGA, distintivo dolphins: nonostante il nome non è la sala comando);
  - debriefing: `END0` (scrivania) con `END1` (condoglianze US Navy), `END2` (San Francisco), `END3` (Lenin, "Comrade..."), `END4` (Greetings from Moscow).
- **Pannelli delle stazioni:** non sono bitmap. Sono **script vettoriali CLS** (rettangoli, linee, pixel, testo col font
  del gioco, sprite UI). Ci sono STAT (cornice), PERI, SONAR, NAV, WCR (armi), RADIO, STEER (governo), STATUS, M (hotspot
  della sala comando), SELECT (selezione missione e configurazione), DIALOG, HELP e REVIEW, ciascuno in versione 688
  (grigio) e Alfa (ciano). Semantica esatta nel §4.7, interprete JavaScript e confronto con DOSBox nel §8.
- **Elementi UI (23 sprite):** OK/CANCEL, tastierino 4WAY, 2WAY, UP/DN, DIAL0, LOGO0, MBOX0, TOSH0 (targhetta Toshiba
  sul sonar sovietico), 6 indicatori di danno, 5 marcatori TARGET, SUB1/SUB2 (688 in spaccato e vista esterna della
  schermata STATUS).
- **Sprite del periscopio (93):** 13 classi di navi ed elicottero, ciascuna in 5 angolazioni (0 prua, 1 tre quarti di
  prua, 2 fianco, 3 tre quarti di poppa, 4 poppa; il gioco ricava le altre specchiando). Nimitz ha 8 frame. Poi missile
  (8 fasi), esplosione (SFX20–23) e fumo (SMK0–2). Sono in grigi a 16 livelli, con il nibble 15 trasparente, e colorati
  con palette diverse di giorno e di notte (di notte rossi). Le immagini dell'elicottero **KA-25 "HORMON" mancano**: la
  tabella dei prefissi le prevede ma nelle MLB non ci sono.
- **Ritratti dell'equipaggio (8):** `CREW1–8`, foto digitalizzate in 16 grigi da 168–173 × 94–96 pixel.
- **Mappe (7):** `SURFA–G`, mappe batimetriche 320×200 a 16 livelli (0 = terra, 1 = costa, 2–15 = profondità
  crescente). Servono alla carta nautica, alla vista "contour" 3D e alla costa vista dal periscopio. A quale missione
  serve ciascuna è indicato nella tabella e viene da `mission_config.tsv`.
- **Font:** uno solo, dentro GAME.EXE, con 224 glyph, codici 20h-FFh (piccolo maiuscolo, grande maiuscolo usato per le
  minuscole, simboli dei pulsanti, pseudo-cirillico): vedi §4.8.
- **Suoni (6):** `.T`, PCM a 4 bit: esplosione, lancio siluro, ping sonar, due rumori d'elica, balena. La musica del
  titolo sta in CALLS.EXE.
- **Scene e testi (24 LZA + TOK.LZW + HELICOP):** ordini di missione, debriefing ("CODE: n-m-ACP"), configurazione
  delle armi, testi di identificazione dei bersagli, domande anticopia.
- **Dati di missione (22 TOK):** posizioni, classi, prestazioni, IA, eventi, legame tra comandi del giocatore e script.

---

## 4. Formati: struttura dei byte

### 4.1 EXEPACK (GAME/TITLE/CALLS.EXE)
All'indirizzo CS:0 dell'EXE impacchettato c'è un'intestazione di 16 o 18 byte
`{real_IP, real_CS, mem_start, exepack_size, real_SP, real_SS, dest_len (paragrafi), [skip_len], 'RB'}`, seguita dallo
stub e dalla tabella di rilocazione impacchettata (16 gruppi `count, offset[count]`, uno per ogni segmento da 64 KB).
I dati si leggono **all'indietro** dalla fine: si saltano fino a 16 byte FFh di riempimento, poi si legge un byte di
comando preceduto da una lunghezza a 16 bit. B0h/B1h = riempimento (un byte ripetuto), B2h/B3h = copia; il bit 0 a 1
indica l'ultimo blocco. TITLE.EXE ha 4811 byte in coda all'immagine MZ: è la **tabella dei simboli di Turbo Debugger**
(nomi dei moduli: `TITLE.C`, `DECODE.ASM`, `FBLOAD.ASM`, `HERC_CGA.ASM`, `PALETTE.ASM`, `SETEGA.ASM`...; funzioni
`_DECODE`, `_CGATOHERC`, `_DOMCGAPAL`...), estratta in `out/exe/TITLE_debug_symbols.txt`.

### 4.2 Librerie `*.MLB`
```
u16 count            (DISK1 = 55, DISK2 = 150)
u16 6                (costante; probabilmente la versione o il numero di campi)
count × { u32 offset ; u32 size ; char name[13] }   (21 byte; il nome è terminato da NUL, il resto è sporcizia)
dati                 (il primo offset = 4 + count*21; i membri sono contigui e senza padding)
```

### 4.3 LZW (`*.LZW`, `*.LZA`, `HELICOP.ENC`), decompressore far 1283:000D
```
u16 ncodes   numero di codici nel flusso
u16 outsize  dimensione decompressa in byte (usata per allocare)
bitstream    codici packed LSB-first dentro parole a 16 bit little-endian
```
- Dizionario di 4096 voci. Le voci 0–255 sono le radici, con prefisso FFFFh.
- Il **primo codice è largo 8 bit**. Prima di leggere ogni codice successivo, se `next ≥ max` la larghezza cresce di
  1 bit e `max` raddoppia: quindi da 9 a 12 bit.
- Quando `next` arriva a 4096 il dizionario si azzera, la larghezza torna a 8 e viene subito portata a 9. Non c'è un
  codice CLEAR né un codice di fine.
- Il caso KwKwK è quello standard.
- **Verificato:** tutti i 34 file decompressi hanno esattamente la dimensione `outsize`.

### 4.4 Immagini "PIC-RLE" (`*.ENC`, LZW decompressi, `MAIN.EGA`), disegnate da 0000:B28F
```
u16 W      larghezza in pixel (gli sfondi a schermo intero hanno 318/319/320)
u16 H      righe memorizzate = H+1
(H+1) righe, memorizzate DAL BASSO VERSO L'ALTO; ogni riga è RLE indipendente e si decodifica in ceil(W/2) byte:
   c < 80h : copia c+1 byte letterali
   c ≥ 80h : ripete il byte seguente (c & 7Fh) + 3 volte
pixel 4 bit, nibble ALTO = pixel di sinistra
```
- Il decodificatore del gioco lavora riga per riga: decodifica nel buffer DS:C5F4, poi applica una tabella di
  traduzione opzionale (CGA) e un eventuale specchiamento orizzontale (flag 9788h).
- In VGA (modalità 5) scrive `base + nibble` e salta il colore trasparente.
- Secondo la mia lettura del ciclo disegna H righe da y+H a y+1, quindi l'ultima riga memorizzata (quella in cima)
  non verrebbe disegnata. Nei PNG l'ho comunque tenuta, perché contiene dati veri (in ALFA, END0, SURF).
- Le basi di colore VGA, verificate nel codice in 0000:0FD1 e 0000:32E5, sono:
  - ritratti CREW: 90h (rampa di grigi 144–159);
  - sprite del periscopio: 90h per le navi, 50h per SMK (grigi più fuoco 80–95), A0h per SFX2 (spruzzi 160–175),
    A7h per MISSILE (167–182);
  - tutto il resto: 0 (colori EGA).
- La mappa nautica usa l'indice `0BFh + 4·nibble`. L'ho verificato sui colori di una cattura DOSBox: solo
  191, 195, ..., 251.
- In NIGHT.PAL cambiano le rampe del cielo (16–79), dei grigi (144–159, che diventano rossi) e 160–166/183–188:
  la stessa nave vista di notte appare rossa.

### 4.5 `*.PAK` + `*.PAL`
64000 byte raw 8 bpp (320×200, dall'alto) + 768 byte RGB a **8 bit** (non 6). La conversione a 6 bit per il DAC la fa il codice; la
routine precisa non l'ho isolata.
- `688.PAL` = `ALFA.PAL` = `DAY.PAL`. Rampe di DAY: 16–79 cielo; 80–95 grigi e colori del fuoco; 96–143 mare;
  144–159 grigi degli sprite; 160–190 spruzzi e missile; 191–251 profondità della carta nautica (passo 4); gli
  indici 192–198 sono magenta di riempimento (inutilizzati).
- `TITLE.PAL` è la palette della foto del titolo.
- Il gioco cita anche un `MCGA.PAL` che non è presente tra i file.

### 4.6 Suoni `*.T`, riprodotti da 0000:D461
Byte = 2 campioni a 4 bit senza segno (prima il nibble alto, silenzio ≈ 7/8), mandati tramite tabella a PC speaker,
Tandy (porta C0h) o Covox (LPT). Non c'è intestazione. Il tempo tra campioni è un ciclo di attesa calibrato con il
timer BIOS (0000:A008): `ritardo = cal·3200/R`. Calcolando i cicli (75 per ogni iterazione di calibrazione contro 45
per iterazione di attesa) R vale circa **campioni al secondo** (≈0,95·R Hz). I valori R usati dal gioco sono:
- EXP1: 5000 (siluro a segno) e 4000;
- SONAR1: 5500 e 6200;
- TORPRAMP: 6500;
- analisi sonar: PROP2 `2500+50·tipo` ×4, PROPV2 `2000+30·tipo` ×4 oppure `5500+10·tipo` ×5 (contatti con flag
  10h), WHALE2 `2500+random(4000)` ×2.

**La "firma acustica" di ogni classe di nave è quindi solo un cambio di altezza del campione d'elica, calcolato
dall'indice di tipo.**
I WAV in `out/wav` usano valori nominali (EXP1 5000, SONAR1 5500, TORPRAMP 6500, PROP2 3000, PROPV2 2600, WHALE2 4500).

### 4.7 Script CLS (`*.CLS`, LZA decompressi, `TARGETS.LZW`, `HELICOP.ENC`), interprete 0000:BB44
È un piccolo bytecode di disegno con subroutine e parametri.
```
u8  n                     numero di routine locali
u16 desc_off[n]           offset (dall'inizio del file) del descrittore di ogni routine
u16 code_base             offset dell'area codice; il "main" (routine 0) comincia qui
descrittore: u8 nargs ; u16 code_offset (relativo a code_base) ; u16 argtypes (big-endian, 2 bit per argomento, 1=byte 2=word 3=stringa)
istruzione:  u8 op
    op = 0      : END/RET
    op < 80h    : primitiva op della tabella DS:97A2 (stesso formato di descrittore: nargs, indirizzo C, argtypes)
    op ≥ 80h    : chiamata alla routine locale (op & 7Fh)
  se nargs > 0: 1 byte di "modi" (2 se nargs > 4), 2 bit per argomento dal MSB:
    0 = immediato, 1 = parametro della routine chiamante, 2 = parametro + immediato, 3 = parametro − immediato
  poi i nibble con gli indici dei parametri (uno per ogni argomento con modo ≠ 0, alto/basso alternati)
  poi gli immediati secondo argtypes (byte, word LE, stringa terminata da NUL)
```
- Gli argomenti sono parole a 16 bit (gli immediati byte si estendono a zero; i confronti dei gestori sono con segno).
  Un parametro di tipo stringa è un puntatore: «parametro + immediato» farebbe aritmetica sui puntatori, ma nessuno
  script lo usa. Non ci sono salti né condizioni: uno script è una lista di disegno con sottoprogrammi.
- Il codice C esegue una routine con 0000:EF42 (file, numero di routine, parametri a zero) oppure, per i dialoghi,
  con 0000:8342 e due parametri (x, y). La routine 0 è il «main», la routine n è Ln−1 del disassemblato.

Le 31 primitive (DS:97A2) sono **tutte identificate**, ciascuna leggendo il suo gestore nel percorso VGA (modo video 5).
I nomi sono quelli usati da `estrai688.py` e dal client:

| op | nome | argomenti | effetto (gestore) |
|---|---|---|---|
| 01 | FILLRECT | x1,y1,x2,y2,c | rettangolo pieno, estremi riordinati e inclusi (A2C6) |
| 02 / 03 | VLINE / HLINE | x,y1,y2,c / y,x1,x2,c | linee (B004, ABFE) |
| 04 | PIXEL | x,y,c | (AEE7) |
| 05, 1A | PRINT | s | testo, vedi sotto (D630) |
| 06 | MOVETO | x,y | cursore del testo (ED20) |
| 07 | DIGITBOX | n,x,y,barra | riquadro incassato 11×11 con la cifra grande 87h+n; se barra ≠ 0 un secondo riquadro da x+13 a x+59 con la barra grigia (EBF4). Tubi, missili, proiezione temporale, codice di sicurezza: cifra e barra poi le ridisegna il codice del gioco |
| 08 | PRINT_SHADOW | s,c,ombra | tre passate nel colore d'ombra a (+1,0), (+1,+1), (0,+1), poi il testo in c (EC97) |
| 09 | RECT | x1,y1,x2,y2,c | contorno: due HLINE e due VLINE (E838) |
| 0A | HOTSPOT | cursore,x1,y1,x2,y2,c,tasto,gruppo | zona cliccabile in una lista; si prova dall'ultima registrata; `tasto` è la lettera ASCII del comando (R, U, T, P, N, W, S…) o un codice interno ≥ 80h; `cursore` sceglie fra 17 forme del puntatore (ED9E, C901) |
| 0B | SETMAP | i,v | byte i della tabella DS:B45A (EE9D, §5.4) |
| 0C / 0D | TEXTCOLOR / TEXTSPACING | c / n | colore e spazio fra i glifi |
| 0E | CIRCLE | x,y,r,c,modo | modo 0: contorno nel colore di CIRCLE_EDGE, **non** in c; 1: pieno di c; 2: pieno e poi contorno (EA36) |
| 0F | RUN_CLS | file | esegue un altro script; nessuno script la usa |
| 10 | WAIT_INPUT | a,b,c,d | ciclo modale che aspetta un clic su una zona (DBFB) |
| 11 | PAGE_BACK | — | si disegna nella pagina di retro, un buffer in RAM (F065) |
| 12 | SHOW_BACK | — | copia tutto il retro sullo schermo (A000h) e si disegna lì (E9B4) |
| 13 | HIDE_MOUSE | — | ripristina lo sfondo sotto il puntatore (12C2:032B): non disegna nulla |
| 14 | PICTURE | file | figura a schermo intero; nessuno script la usa |
| 15 | HOTSPOT_TRUNC | n | tiene solo le prime n zone (E402) |
| 16 | CIRCLE_EDGE | c | colore del contorno dei cerchi (ED15) |
| 17 | SHOW_ZOOM | — | come SHOW_BACK ma con un'apertura animata dal centro della finestra (F0CD) |
| 18 / 19 | SAVE_RECT / RESTORE_RECT | x1,y1,x2,y2 / — | copia il riquadro dallo schermo al retro, e indietro: lo sfondo sotto un dialogo (82F2, 831E) |
| 1B | TEXTWINDOW | x1,y1,x2,y2 | finestra del testo e cursore nell'angolo (D60D) |
| 1C | SPRITE | file,x,y,trasp | figura PIC-RLE, trasp = nibble da saltare (255 = nessuno) (EFB9 → B28F) |
| 1D | TELETYPE | s | riga della telescrivente della sala radio, animata dal codice (606E) |
| 1E / 1F | HELPWORD / HELPPAIR | w / a,b | liste delle parole dell'aiuto |

Dettagli che contano per ridisegnare al pixel (tutti verificati contro le catture DOSBox, §8):
- **Nessun ritaglio.** Il flag DS:B456 lo accende solo il codice C (mappa, contour); con gli script ogni primitiva
  scrive a `riga[y] + x` nel segmento di 64 KB, senza controlli. Negli script originali nessuna scrittura cade fuori
  dai 320×200.
- **Pagine.** In VGA lo schermo è A000h e il «retro» un buffer in RAM. STAT.CLS comincia con PAGE_BACK, quindi le
  stazioni si disegnano nel retro e il gioco poi lo mostra; SELECT.CLS finisce con SHOW_ZOOM; i dialoghi (0000:8342)
  disegnano direttamente sullo schermo dopo SAVE_RECT, e il codice chiama RESTORE_RECT dopo il clic.
- **Testo** (D630). `@` commuta il grassetto, che è uno stato globale e sopravvive fra una stampa e l'altra; `@@`
  stampa `@`. `\n` va a capo: x torna al bordo sinistro della finestra e y scende dell'interlinea DS:BD73 (**9**, non 8),
  ma se y + 2·interlinea supera il fondo della finestra si ricomincia dalla cima. Prima di ogni glifo, se
  x + larghezza + spaziatura supera il bordo destro, si va a capo. In grassetto il glifo si ridisegna a x+1 e
  l'avanzamento cresce di 1; la seconda passata riparte dalla posizione salvata *prima* dell'eventuale a capo e usa il
  carattere *non* rimappato dal cirillico. Col cirillico attivo (lato Alfa; Ctrl-R lo spegne, 0000:1E36) A-Z passano
  dalla tabella DS:BD8B e poi le cifre 4-9 diventano E1h-E6h; le minuscole (maiuscole grandi) restano latine.
- **SPRITE**: base in basso a y+H, H righe disegnate dal basso verso l'alto (l'ultima riga memorizzata, quella in
  cima, non si disegna mai), 2·ceil(W/2) pixel per riga (anche il nibble di riempimento delle larghezze dispari),
  colore = nibble (la base DS:9789 è 0 quando girano gli script).
- **Stato iniziale** quando il gioco chiama gli script: finestra 0,0,319,199, colore 15, spaziatura 1, interlinea 9,
  grassetto spento, colore del contorno 15. Gli script delle stazioni si impostano da sé quello che serve.

### 4.8 Font (GAME.EXE DS:9D5C)
14 byte per glyph: `u8 larghezza ; 13 righe da 1 byte (MSB = pixel di sinistra)`. Il glyph del carattere ch sta
all'indice ch−20h; l'avanzamento è larghezza + spaziatura. **224 glyph, codici 20h-FFh** (non 208: la prima
estrazione si era fermata a CFh e perdeva Ц Щ Ч, che il cirillico usa per U, W, Y):
- 20h–5Fh: maiuscole piccole e segni (ASCII);
- 60h–7Fh: maiuscole grandi, usate scrivendo in minuscolo (per esempio 'mission selection');
- 80h–86h simboli; 87h–90h cifre grandi 0-9 (DIGITBOX); 91h–C4h simboli dei pulsanti; C5h–CCh pezzi delle scritte FIRE e
  DETONATE; CDh–DCh maiuscole grandi K-Z (seconda serie); E1h–E6h cifre 4-9 del cirillico; E7h–F2h lettere del
  **pseudo-cirillico**; F3h–FBh simboli; FCh–FFh vuoti. Con Ctrl-R il gioco rimappa A–Z tramite la tabella DS:BD8B (§4.7).

### 4.9 Scenari TOK (`SCENEnx.TOK`), interprete 1011:137C, tabella degli handler DS:6505
Il bytecode non ha intestazione separata.
```
op (byte) + operandi a lunghezza fissa per opcode (b/w); 0 = RET. Le destinazioni dei salti sono offset dall'inizio del file.
```
- 118 opcode (01h–76h). Il formato di ognuno è ricavato dal suo handler e sta in `TOK_FMT` dentro `estrai688.py`.
- **Verifica:** tutti i 22 file si disassemblano linearmente fino all'ultimo byte senza un solo opcode ignoto.
- Gli opcode sono di quattro tipi:
  - costruzione di un'unità in un record di 100 byte (DS:2BEE) e creazione (op 10h);
  - ordini (rotta, quota, velocità, waypoint);
  - condizioni e salti (sul contatto, su casuale, contatori, stati, zone);
  - timer ed eventi, messaggi all'equipaggio.
- L'inizio di ogni file imposta 5 **tabelle di eventi** che legano i comandi del giocatore a subroutine dello script
  (dispatcher 1011:1F50):
  - op 1Fh (6 word): waypoint/autopilota, velocità ordinata, timone, quota e due comandi vari;
  - op 25h (7 word): un handler di lancio **per ognuno dei 7 tubi**;
  - op 26h (6 word): un handler **per ognuno dei 6 tipi d'arma** (crea il siluro, il missile o il noisemaker);
  - op 31h (6 word) e op 58h (3 word): altri comandi (periscopio, antenna, sonar attivo...). Non li ho identificati
    uno per uno.
- **Anche il sottomarino del giocatore è definito e pilotato dallo script.**

Il record dell'unità, con unità di misura verificate sui dati:

| offset | op che lo imposta | significato | unità / verifica |
|---|---|---|---|
| +02 | 10 | id dell'unità | progressivo |
| +04 | 04 | categoria (1 o 2) | — |
| +06 | 05 | flag: bit 0–1 dominio (1 sub, 2 superficie, 3 aria), 08h NATO, 10h avversario, 20h arma, C0h speciale (balena) | ostile se i bit 3–4 sono diversi (op 3Fh) |
| +07 | 38 | **punti scafo** | 688: 160–220; Alfa: 175 o 250; siluro: 20 |
| +18/+1C (+16/+1A) | 02 | X, Y (32 bit con parte frazionaria) | **unità di 2″ d'arco**: SET_POS 5568,1376 coincide con l'indicatore "03:05:36 X / 00:45:52 Y" della cattura DOSBox |
| +1E (+30, +2C) | 03 / 22 | **quota** (attuale, richiesta, variazione) | **1/8 di piede**: 160 = 20 ft, come a schermo |
| +20 (+34, +36) | 06 / 19 | **rotta** | 9000 = 360°, angolo matematico: bussola = 90 − v/25 (3250 → 320°, visto a schermo) |
| +22 (+32) | 07 / 21 | **velocità** | **1/320 di nodo** |
| +38 | 08 | rapidità di cambio quota | — |
| +3A, +3B, +3C, +3D | 0C, 0D, 0E/29, 0F | rumore irradiato (dedotto), sensibilità dei sensori (dedotto), ?, probabilità di colpire/uccidere su 256 (dedotto: usata da 54h/6Ah) | — |
| +3E | 09 | velocità di virata | — |
| +40 | 0A | accelerazione | — |
| +42 | 0B | **velocità massima** | 1/320 kt: 688 = 11840 = **37 kt**, Alfa = 13440 = **42 kt**, come nel manuale |
| +4C | 13 | classe sonar/simbolo (1 sub/arma, 2 aria, 3 superficie) | — |
| +4F | 28 | **tipo**: indice nella tabella dei nomi DS:019A e dei prefissi del periscopio DS:0F8C | 20 = 688, 21 = Alfa, 25 = balena |
| +5A | 35 | **quota massima** | 1/8 ft: 688 = 12000 = **1500 ft**, Alfa = 14400 = **1800 ft**, come nel manuale |
| +5F | 46/49/5F/6E/6F | stato dell'IA / bit | — |

---

## 5. Tabelle di dati negli eseguibili e negli script

### 5.1 Tabelle in GAME.EXE (offset nel segmento dati; esportate in `out/exe/GAME_tables.json`)
| DS | struttura | contenuto | affidabilità |
|---|---|---|---|
| 019A | 46 near pointer | nomi dei tipi di unità, indice = byte `type` (+4F) | certa |
| 01F6 | 67 near pointer | messaggi dell'equipaggio (0 "tube cleared" ... 66 "adjusting engine speed"). Gli op TOK 23h/55h usano questi numeri: 36 "active sonar captain" (i 3 ping del SOSUS), 34 "game over". I valori ≥ 100 sono probabilmente codici di fine missione. | certa per la tabella, dedotta per il legame con i codici |
| 0F8C | 20 near pointer | prefissi degli sprite del periscopio per tipo (17 "HORMON" non ha file) | certa |
| 97A2 | n + offset + descrittori | 31 primitive CLS {nargs, handler, argtypes} | certa |
| 9D5C | 208 × 14 byte | font | certa |
| 6505 | 118 word | handler TOK nel segmento 1011 | certa |
| B45A | 16 byte | tabella scritta da CLS B11 (CGA, configurazione missione, anticopia) | certa |
| 03FD | rampa di byte " %),0257..." | tabella crescente non lineare, forse prospettiva o scala del periscopio | dedotta |
| 1706–1900 | 32 parole cifrate Atbash + 31 sostituti | filtro volgarità della chat modem | certa |

**Non ho trovato una tabella centrale di parametri per nave dentro l'EXE.** Prestazioni, punti scafo, rumore, armi e IA
stanno negli **script TOK** di ogni missione (§5.2). Nell'EXE ci sono solo le formule d'uso (altezza del suono d'elica
per tipo, conversioni).

### 5.2 Parametri per tipo di unità (dalle unità create nei 22 scenari: `out/tok/units_all.tsv`)
Colonne: tipo | nome | dominio | n. unità | scenari | vel. max kt | quota max ft | punti scafo | rumore b3A | sensori b3B |
Pkill b3D | virata | var. quota | accel. | flag. Valori separati da "|" = sovrascritture successive nello script (per
esempio 255 nei rami modem).

| tipo | nome | dominio | n | scenari | vmax | qmax | HP | rumore | sens | pk | vir | dq | acc | flag |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | FORREST SHERMAN CLASS DESTROYER | surface | 13 | 1A 1B 1C | 25.0 | - | 100 | 12 | 11 | 0, 9 | 4, 5 | 2 | 15, 2 | 18, 82 |
| 1 | MERCHANT SHIP | surface | 27 | 2A 2B 2C 3B 4A 5A 5B 5C 7A 7B 7C | 15.0, 20.0, 25.0 | - | 50 | 15, 20 | 0 | 0 | 4 | 2 | 2 | 66, 74 |
| 2 | CARGO SHIP | surface | 20 | 6A 9A 9B 9C | 15.0, 25.0 | - | 110, 75 | 15, 18 | 0 | 0 | 4 | 2 | 2 | 74 |
| 5 | KARA CLASS GUIDED MISSILE CRUISER | surface | 1 | 0A | 30.0 | - | 150 | 24 | 18 | 90 | 4 | 2 | 2 | 18 |
| 6 | KIROV | surface | 2 | 0A 6A | 30.0 | - | 200 | 24 | 18 | 90 | 4 | 2 | 2 | 18 |
| 7 | KRIVAK II | surface | 1 | 0A | 30.0 | - | 100 | 24 | 18 | 90 | 4 | 2 | 2 | 18 |
| 8 | KONI CLASS FRIGATE | surface | 3 | 3B 4A | 25.0 | - | 50 | 15, 20 | 0, 18 | 5 | 4 | 2 | 2 | 18, 82 |
| 9 | SLAVA CLASS CRUISER | surface | 3 | 0A 3B 6A | 25.0, 30.0 | - | 175 | 15, 22, 24 | 0, 18 | 90 | 4 | 2 | 2 | 18, 82 |
| 10 | NIMITZ CLASS AIRCRAFT CARRIER | surface | 3 | 8A 8B 8C | 15.0 | - | 220 | 25 | 4 | 15 | 4 | 2 | 2 | 10 |
| 11 | IOWA CLASS BATTLESHIP | surface | 3 | 8A 8B 8C | 15.0 | - | 175 | 15 | 8 | 17 | 4 | 2 | 2 | 10 |
| 12 | KIDD CLASS GUIDED MISSILE DESTROYER | surface | 3 | 8A 8B 8C | 33.0 | - | 150 | 15 | 8 | 16 | 4 | 2 | 2 | 10 |
| 13 | OLIVER HAZARD PERRY CLASS FRIGATE | surface | 9 | 8A 8B 8C 9A 9B 9C | 15.0, 29.0 | - | 100, 75 | 15 | 0, 8 | 128, 15 | 4 | 2 | 2 | 10 |
| 14 | SACRAMENTO CLASS OILER | surface | 3 | 8A 8B 8C | 15.0 | - | 75 | 22 | 5 | 5 | 4 | 2 | 2 | 74 |
| 15 | CRUISE MISSILE TARGET | surface | 1 | 0A | 1.0 | - | - | 0 | - | - | - | - | - | 194 |
| 16 | TANKER | surface | 4 | 4A | 15.0 | - | 75 | 20 | 0 | - | 4 | 2 | 2 | 82 |
| 18 | SEAHAWK-60B LAMPS III HELICOPTOR | air | 4 | 1A 7A 7B 7C | 70.0, 90.0 | - | - | 0 | 18, 25, 55 | - | 25 | 1 | 30 | 19 |
| 20 | US 688 CLASS ATTACK SUBMARINE | sub | 23 | 0A 1A 1B 1C 2A 2B 2C 4A 5A 5B 5C 6A 7A 7B 7C 8A 8B 8C 9A 9B 9C | 37.0 | 1500.0 | 160, 160|255, 180, 180|255, 200, 220, 220|255 | 10, 10|1, 6, 6|1, 8, 8|1 | 18, 18|55, 20, 20|55, 22, 22|55, 24, 24|55 | - | 10 | 16 | 10 | 9 |
| 21 | SOVIET ALFA CLASS ATTACK SUBMARINE | sub | 19 | 0A 1A 2A 2B 2C 3B 5A 5B 5C 6A 7A 7B 7C 8A 8B 8C 9A 9B 9C | 42.0 | 1800.0 | 175, 175|255, 250, 250|255 | 10, 10|1, 12, 12|1, 8, 9, 9|1 | 17, 18, 18|55, 19, 19|55 | - | 10 | 20 | 10 | 17 |
| 23 | VICTOR III CLASS FAST ATTACK SUB | sub | 4 | 0A 2A 5A | 42.0 | 1800.0 | 175, 175|160 | 10, 8 | 18 | - | 10 | 20 | 10 | 17 |
| 25 | BIOLOGICAL | - | 29 | 0A 1A 1B 2A 2B 2C 3B 4A 5A 5B 5C 6A 7A 7B 7C 8A 8B 8C 9A 9B 9C | 1.0 | - | - | 25, 25|0 | - | - | - | - | - | 192 |
| 28 | OSCAR CLASS (SSGN) CRUISE MISSILE SUB | sub | 3 | 9A 9B 9C | 42.0 | 1800.0 | 175 | 8, 9|14 | 18 | - | 10 | 20 | 10 | 17 |
| 29 | AKULA CLASS FAST ATTACK | sub | 2 | 0A 5A | 42.0, 42.0|50.0 | 1800.0 | 175|255 | 10 | 18, 18|20 | - | 10 | 20 | 10, 10|25 | 17 |
| 30 | CHARLIE II CLASS GUIDED MISSILE SUB | sub | 1 | 3B | 42.0 | 1800.0 | 175 | 10 | 18 | - | 10 | 20 | 10 | 17 |
| 31 | TYPHOON CLASS SSBN | sub | 3 | 7A 7B 7C | 42.0 | 1800.0 | 175 | 12|14 | 19 | - | 10 | 20 | 10 | 17 |
| 33 | FOXTROT CLASS DIESEL SUB | sub | 2 | 4A | 20.0 | 600.0 | 110 | 5 | 23 | - | 10 | 20 | 5 | 17 |
| 34 | TRAFALGAR CLASS FAST ATTACK | sub | 1 | 3B | 37.0 | 1500.0 | 180 | 8 | 22 | - | 10 | 16 | 10 | 9 |

Armi create dagli handler degli eventi (`templates_all.json`):

| tipo | nome | vmax kt | qmax ft | HP | rumore | sens | Pkill/256 | virata | var. quota | accel. |
|---|---|---|---|---|---|---|---|---|---|---|
| 22 | MARK 48 TORPEDO (688) | 55 (60 in alcune missioni) | 1800 | 20 | 18 | 17 | 75 | 25 | 30 | 30 |
| 37 | 533 MM TORPEDO (sovietico) | 50 / 55 | 1800 | 20 | 18 | 15 | 100 | 25 | 30 | 40 |
| 38 | 450 MM TORPEDO | 50 | 1800 | 20 | 18 | 15 | 40 | 25 | 30 | 40 |
| 39 | SPEARFISH TORPEDO | 55 | 1800 | 20 | 18 | 17 | 75 | 25 | 30 | 30 |

I missili (handler dell'arma di tipo 4) non creano un'unità. Fanno partire un timer di 10 tick e poi l'op 6Ah
confronta un numero casuale con 75: probabilmente è la probabilità di colpire (75/256), ma è dedotto.

### 5.3 Contenuto delle missioni
Lettere degli scenari: A = USA in singolo, B = URSS (Alfa) in singolo, C = partita via modem.
- 0 HIT AND RUN: Alfa, Victor III, Akula, gruppo Kirov/Slava/Kara/Krivak, bersaglio per missili da crociera.
- 1 TORPEX '89: 3 cacciatorpediniere Forrest Sherman radiocomandati, elicottero LAMPS, Alfa, balena; tre punti di
  partenza casuali.
- 2 SHAKE 'EM: Alfa in coda, Victor III, mercantili.
- 3 SUB OPS (solo Alfa): Trafalgar, Slava, Koni, Charlie II, mercantili.
- 4 MUMAR CADAVER: 2 Foxtrot, 4 petroliere, Koni ×2, mercantile.
- 5 ESCAPE: Alfa, 2 Victor III, Akula, balene, mercantili.
- 6 GOULASH: Alfa, 5 navi da carico, Kirov, Slava.
- 7 CAT WALK: Typhoon, mercantili, Seahawk, Alfa.
- 8 SURPRISE PARTY: gruppo Nimitz, Iowa, Sacramento, Perry, Kidd, Alfa.
- 9 HOMECOMING: convoglio di 5 navi da carico, 2 Perry, Alfa, Oscar.

L'elenco completo con posizioni e waypoint è in `out/tok/units_all.tsv`.

### 5.4 Configurazione della missione (`out/text/mission_config.tsv`)
La routine L13 (lato USA) o L14 (lato URSS) di ogni `SCENE*.LZA` riempie con B11 la tabella DS:B45A, che il codice
legge in 0000:1E11. Il contenuto è:
- `[0]` lato (0 = 688, 1 = Alfa);
- `[1..6]` scorte per tipo d'arma (copiate in DS:02DF);
- `[7..13]` tipo d'arma caricato nei tubi 1–7 (DS:02D8);
- `[14]` indice della mappa (SURF A–G).

Il 688 ha 4 tubi lanciasiluri di tipo 0 (16–24 Mark 48), 2 tubi ausiliari di tipo 5 (6 noisemaker) e un tubo missili
di tipo 4 (2–4), 3 (missione 0) o 2 (missione 9, 8 armi). L'Alfa ha 5 tubi di tipo 1 (18 siluri da 533 mm, 8 nella
2B) e 2 di tipo 5 (4 noisemaker). Per i tipi 2–4 la corrispondenza più probabile è 2 = SEALANCE (missione 9, scorta
antisommergibile), 3 = HARPOON (missione 0 contro un gruppo di superficie), 4 = TOMAHAWK (missione 4, attacco alla
Libia). La cattura "MISSILES 2" della missione 1 è coerente.

### 5.5 Altro
- **HELICOP.ENC** non è un'immagine: è l'archivio LZW delle **153 domande della protezione anticopia** (nome del
  sottomarino della classe Los Angeles + inizio di una frase del manuale) con le risposte di 3 lettere. In chiaro in
  `out/text/HELICOP_ENC.txt`.
- Il bytecode TOK ha un op di **autocontrollo anti-crack** (75h): confronta byte del codice di GAME.EXE con copie
  salvate e lo script salta se coincidono.
- `TARGETS.LZW` chiama "NANUCHA CLASS MISSILE CORVETTE" il tipo 8, che la tabella dei nomi dell'EXE chiama "KONI CLASS
  FRIGATE". Lo sprite usato è `NUCHKA*`.
- **CALLS.EXE** è il driver della musica del titolo, con tre back-end:
  - routine 0: PSG Tandy/speaker a 3 voci con timer a interrupt;
  - routine 1: Covox/LPT;
  - routine 2: AdLib a 9 voci.
  La partitura è a bytecode (80h–88h, FFh). Da 20B8h alla fine dell'immagine ci sono circa 56 KB di dati a 4 bit, che
  credo siano la banca dei campioni per le voci Covox/speaker. L'ho esportata grezza; confini e frequenza non sono
  decodificati.

---

## 6. Cosa ho verificato e cosa ho dedotto

**Verificato davvero** (decodifica completa e controllo visivo o numerico):
- EXEPACK: i tre EXE si spacchettano. Le stringhe sono quelle attese e il codice di GAME si disassembla coerentemente
  (entry point Turbo C con `mov dx,1306h`).
- MLB: tutti i 205 membri, contigui, senza buchi.
- LZW: 34 file su 34 con la dimensione esatta.
- PIC-RLE: tutte le 139 immagini (124 ENC, 14 LZW e `MAIN.EGA`) consumano esattamente i propri byte e producono immagini corrette.
  Le ho guardate tutte nei provini. Navi, ritratti, schermate, mappe e UI sono dritti e con i colori giusti; i colori
  delle stazioni coincidono con le catture DOSBox.
- PAK/PAL: corrette.
- Rendering CLS: **esatto**. Le parti statiche di tutte le stazioni (688, Alfa in cirillico e in latino), di status,
  selezione missione, configurazione e dei dialoghi coincidono al pixel con le catture DOSBox; nel riquadro dei dialoghi
  0 pixel diversi su 0. Differiscono solo le zone che ridisegna il codice del gioco (§8.4).
- TOK: i 22 file si disassemblano interi. Unità di misura confermate da quattro riscontri indipendenti (velocità e
  quota massime del 688 e dell'Alfa contro il manuale, quota e rotta iniziali e coordinate X/Y contro lo schermo).
- Configurazione delle missioni: l'indice di mappa della missione 1 = SURFG, che ha la forma delle Faroe; "MISSILES 2"
  coincide con la cattura.
- Ordini e debriefing: testi estratti integralmente; il render del briefing coincide con lo stile della sala radio.
- Copia di sicurezza: il codice "LET" per "DALLAS: IF YOU'RE GOING TO ???" è stato accettato in DOSBox.

**Dedotto, non verificato a orecchio o a schermo:**
- La frequenza dei `.T` (≈ R Hz, calcolata dai cicli).
- Il significato di b3A (rumore), b3B (sensori) e b3D (probabilità di colpire).
- I nomi dei tipi d'arma 2–4.
- La semantica di parte degli opcode TOK (nomi come OP37, OP57, OP59... in `estrai688.py`) e delle tabelle di
  eventi B ed E.
- L'associazione geografica delle mappe A, B, E ed F: so a quale missione servono, non quale costa reale ritraggono.
- Il ruolo dei campioni in CALLS.EXE.

---

## 7. Domande aperte
1. **Frequenze audio reali.** Si possono misurare registrando l'uscita audio da DOSBox con Covox o Tandy (pochi
   minuti di lavoro).
2. **La vista 3D del periscopio e della modalità "contour"** non sono asset: sono generate in tempo reale dalle mappe
   SURF dal motore height field di Ratcliff (asm 1011/12C2). Per riprodurle bisogna reimplementarle o catturarle da
   DOSBox.
3. **KA-25 Hormone senza sprite** (HORMON*.ENC manca) e **MCGA.PAL citato ma assente.** Può darsi che sia una
   revisione dei file diversa da quella della release: andrebbe confrontata con altre copie (Internet Archive ne ha
   diverse).
4. **Palette CGA, Hercules e Tandy:** non le ho esportate (mappatura B11 e tabelle per modalità). Per un tributo
   bastano EGA e VGA.
5. **PROFILE.688** (19 byte) e **MODEM.688:** struttura non analizzata (impostazioni utente e stringhe AT).
6. **Prima riga dei PIC:** il disegno del gioco la salta (forse un off-by-one mio o del gioco); nei PNG c'è.
7. **Semantica completa del TOK** (eventi B/E, b3A–b3D, AI): basterebbe un'esecuzione strumentata in DOSBox-debug o
   leggere il motore 1011 per intero.
8. **Diritti:** la grafica è © 1989 John W. Ratcliff / Electronic Arts (vedi titolo e HELP). Per riusarla in un
   tributo pubblico serve un permesso o una valutazione legale; il codice di Ratcliff non risulta pubblicato.

---

## 8. Uscita per il client e interprete JavaScript (F0)

### 8.1 Comandi

```
python3 tools/estrai/estrai688.py ORIG --verifica            # solo le impronte MD5; esce con 0 se la copia è quella supportata
python3 tools/estrai/estrai688.py ORIG --client --fixture    # asset per il browser + fixture delle prove
python3 tools/estrai/estrai688.py ORIG out                   # estrazione completa per la ricerca, come prima
node --test tests/client/                                    # oppure npm test
```

- **Verifica.** MD5 dei 13 file della versione supportata (GAME.EXE del 12/06/1989, 932eac8c…); MODEM.688 e PROFILE.688
  sono configurazione dell'utente e non si controllano. Una copia diversa o incompleta produce un avviso chiaro
  nell'estrazione per la ricerca; con `--client`/`--fixture` l'estrattore **rifiuta** di procedere, a meno di `--forza`
  (e il manifesto registra l'esito della verifica).
- **Deterministica**: stesso input, stessi byte (verificato con due esecuzioni). La cartella di uscita si svuota solo
  se contiene già un `manifest.json` (o `indice.json` per le fixture), altrimenti l'estrattore si ferma.
- `web/assets/originali/` e `tests/client/fixture/` sono in `.gitignore`: contengono grafica originale.

### 8.2 `web/assets/originali/` (279 file, 2,4 MB)

| percorso | contenuto |
|---|---|
| `manifest.json` | ogni file con tipo, byte, sha256, palette, membro d'origine (`DISK2.MLB:FOREST0.ENC`); versione e sha256 dell'estrattore; esito della verifica MD5 |
| `palette/*.json` | DAY, NIGHT, 688, ALFA, TITLE (256 colori RGB a 8 bit come nei .PAL), EGA16, MAPPA (i 16 colori della carta nautica, DAY BFh+4n) |
| `sale/688.png`, `sale/ALFA.png`, `titolo/TITLE.png` | schermate VGA 320×200, PNG indicizzati con la loro palette |
| `periscopio/giorno/*.png`, `periscopio/notte/*.png` | le 93 sagome in RGBA con il nibble 15 trasparente, palette DAY e NIGHT (di notte rosse) |
| `equipaggio/CREWn.png`, `equipaggio/notte/` | ritratti indicizzati (indici 90h+n) |
| `interfaccia/*.png` | 23 elementi d'interfaccia, EGA16; SUB1/SUB2 con il nibble 1 trasparente |
| `fine/END0-4.png` | scrivania e cartoline di fine missione |
| `mappe/SURFx.png`, `mappe/SURFx.bin`, `mappe/mappe.json` | mappe di profondità: PNG nei colori della carta, griglia grezza (un byte per cella, 0 terra, 1 costa, 2-15 profondità) e indice con le missioni di ognuna (ricavate dagli script SCENE) |
| `suoni/*.wav` | i 6 suoni, 8 bit mono alla frequenza nominale del §4.6 |
| `font/font.png`, `font/font.json` | atlante 16×14 celle di 8×13 (bianco su trasparente) e, per ogni codice 20h-FFh, larghezza, posizione e le 13 righe; gruppi del font, tabella del cirillico, interlinea e spaziatura |
| `cls/<SCRIPT>.json` | i 13 script `.CLS` decodificati (sotto) |
| `cls/figure.json` | le figure 16 colori come le usa SPRITE (righe dal basso, nibble di riempimento compreso, base64) |
| `cls/primitive.json` | la tabella DS:97A2: codice, nome, numero e tipo degli argomenti, gestore |
| `cls/pannelli.json` | i 49 «lavori» di resa con hotspot e agganci già calcolati (sotto) |

Le figure PNG hanno tutte le H+1 righe memorizzate; il manifesto dice quante ne disegna il gioco con SPRITE (`righe_disegnate_dal_gioco`; per le sagome del periscopio, disegnate da un altro codice, 129D:000B, non è verificato).

**Script** (`termoclino-cls/1`): `routine[i]` con `nargs`, `tipi` e `codice`, la lista delle istruzioni. Un'istruzione
è `{"op": 3, "n": "HLINE", "a": [...]}` (primitiva) o `{"r": 5, "a": [...]}` (chiamata della routine 5); `@` è lo
scostamento nel file. Un argomento è un numero (immediato senza segno, come nel bytecode), una stringa (byte 00h-FFh
come caratteri), `{"p": i}`, `{"p": i, "piu": v}` o `{"p": i, "meno": v}` (parametro della routine).

**Lavori** (`termoclino-pannelli/1`): come il gioco compone ogni schermata. Un lavoro ha `passi` (routine di uno
script, primitiva chiamata dal codice C, cambio di pagina, sfondo), `cirillico`, `mostra` (la pagina che il giocatore
vede alla fine), `dosbox` (la cattura corrispondente, se c'è) e `risultato`: `hotspot` (zone cliccabili nell'ordine di
registrazione), `agganci` e la tabella SETMAP. Ci sono le sei stazioni in tre versioni (688, Alfa in cirillico, Alfa in
latino con Ctrl-R), status 688 e Alfa, riesame dei messaggi, sala comando 688 e Alfa (hotspot su `sale/*.png`),
selezione della missione, configurazione e tutti i 24 dialoghi a due parametri nella posizione in cui li apre il gioco.

### 8.3 L'interprete JavaScript (`web/assets/js/client/cls.js`)

Modulo ES senza dipendenze, tipi in JSDoc (passa `tsc --checkJs` in modo stretto), gira nel browser e in Node 20+.
`caricaRisorse(leggiJsonDaUrl(base))` carica script, figure e font; `eseguiLavoro(risorse, lavoro, bersaglio)` o
`new InterpreteCls({...}).esegui('STAT.CLS', 1)` eseguono; `hotspotIn(hotspot, x, y)` trova la zona sotto il puntatore
come fa il gioco. Due bersagli:

- `FrameBuffer`: due pagine indicizzate da 64 KB modellate come i segmenti del gioco (scrittura a (y·320+x) mod 65536);
  `indici()` e `rgba(palette)` per leggerle.
- `CanvasTarget(ctx, {palette, scala})`: Canvas 2D con scala intera o frazionaria. Ogni pixel logico occupa il
  rettangolo di dispositivo [round(x·s), round((x+1)·s)): a scala 1 è identico al FrameBuffer (verificato nel browser
  su tutti i 47 lavori senza sfondo), a scala 4 è esattamente l'ingrandimento al pixel più vicino, a 2,5 non compare
  nessun colore fuori palette. Rettangoli e linee sono rettangoli nitidi, il font si ingrandisce al pixel più vicino.

**Completo**: tutte le 31 primitive. **Gli script non disegnano mai lo stato vivo**: mappa, valori della barra
TARGET/BEARING, spie, ON/OFF, cursori, orologio, riga dei messaggi li disegna il codice C sopra il pannello, quindi non
c'è niente da indovinare dentro l'interprete. Quello che dagli script si sa del vivo esce come dati:
- `hotspot`: {cursore, x1, y1, x2, y2, colore, tasto, gruppo}, nell'ordine di registrazione;
- agganci `cifra`: le caselle di DIGITBOX con la cifra iniziale e il rettangolo della barra (tubi e missili di WCR,
  proiezione temporale di NAV, codice di sicurezza di RADIO);
- agganci `attesa` (WAIT_INPUT), `mostra` (SHOW_BACK/SHOW_ZOOM: l'animazione di apertura è del client),
  `telescrivente` (TELETYPE: testo e colore, l'animazione è del client), `sfondo`;
- `esegui_cls` e `immagine` (RUN_CLS, PICTURE) sono solo annotate: nessuno script le usa.
Le zone vive che non passano dagli script vanno definite dal client; un esempio dal codice: durante il disegno della
mappa nelle stazioni la finestra di ritaglio è 8,27–176,119 (0000:C1E1).

### 8.4 Prove e confronti

- `tests/client/cls.test.js` (node:test): sei prove sintetiche che girano sempre, anche senza i file originali, e per
  ciascuno dei 49 lavori il confronto **byte per byte** delle due pagine con quelle dell'interprete di riferimento
  Python (`--fixture`), più hotspot, agganci, tabella e stato finale. Senza asset o fixture la prova si salta e dice
  come generarli. Risultato attuale: 56 prove, 56 passate.
- L'interprete di riferimento (`InterpreteCLS` in `estrai688.py`) è a sua volta confrontato con le catture DOSBox:
  fuori dalle zone vive i pannelli coincidono al pixel (le sale di controllo a meno della quantizzazione a 6 bit del DAC).
- `web/assets/js/client/prova-cls.html`: disegna ogni lavoro a scala 1 e a scala scelta (2–5, anche 2,5), con la
  cattura DOSBox accanto, gli hotspot e le caselle sovrapposti a richiesta, e il controllo «scala 1 = FrameBuffer».
  Servire la radice del repo (per esempio `python3 -m http.server -d . 8173`) e aprire
  `/web/assets/js/client/prova-cls.html`; le catture si leggono da `privato/` (parametro `?schermate=` per cambiarlo).
