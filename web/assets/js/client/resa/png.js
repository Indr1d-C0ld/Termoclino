// @ts-check
/**
 * Decodifica dei PNG indicizzati dell'estrattore (sale di controllo, ritratti dell'equipaggio).
 *
 * La resa Classic lavora in indici di palette, e le immagini originali sono PNG «a palette» (tipo di
 * colore 3, profondità 8 o 4) scritti da estrai688.py. Passarle dal decodificatore del browser
 * vorrebbe dire tornare da RGB agli indici, con il rischio della gestione del colore; qui invece si
 * leggono gli indici così come sono, con `DecompressionStream` (browser e Node 18+), senza dipendenze.
 */

/** @typedef {{ larghezza: number, altezza: number, indici: Uint8Array }} ImmagineIndicizzata */

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
 * @param {Uint8Array} byte il file PNG
 * @returns {Promise<ImmagineIndicizzata>}
 */
export async function decodificaPngIndicizzato(byte) {
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
  if (tipo !== 3 || interlacciato !== 0 || ![1, 2, 4, 8].includes(profondita)) {
    throw new Error(`PNG non supportato (tipo ${tipo}, profondità ${profondita}, interlacciato ${interlacciato})`);
  }
  const compressi = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let k = 0;
  for (const c of idat) { compressi.set(c, k); k += c.length; }
  const grezzi = await gonfia(compressi);
  const passo = Math.ceil((larghezza * profondita) / 8);
  const indici = new Uint8Array(larghezza * altezza);
  let prec = new Uint8Array(passo);
  let riga = new Uint8Array(passo);
  for (let y = 0; y < altezza; y++) {
    const base = y * (passo + 1);
    const filtro = grezzi[base];
    for (let x = 0; x < passo; x++) {
      const v = grezzi[base + 1 + x];
      const a = x > 0 ? riga[x - 1] : 0, b = prec[x], c = x > 0 ? prec[x - 1] : 0;
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
    const perByte = 8 / profondita, maschera = (1 << profondita) - 1;
    for (let x = 0; x < larghezza; x++) {
      const byteRiga = riga[Math.floor(x / perByte)];
      const spost = 8 - profondita * ((x % perByte) + 1);
      indici[y * larghezza + x] = (byteRiga >> spost) & maschera;
    }
    [prec, riga] = [riga, prec];
  }
  return { larghezza, altezza, indici };
}
