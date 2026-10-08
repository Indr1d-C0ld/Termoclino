// @ts-check
/**
 * Tela indicizzata 320×200: la superficie su cui si compone ogni fotogramma della resa Classic.
 *
 * Come la VGA del 1989 (modo 13h) ogni pixel è un indice nella palette di 256 colori: il pannello
 * della stazione esce dall'interprete CLS già in indici, lo stato vivo (mappa, cascata, cifre, spie)
 * si disegna sopra negli stessi indici, e solo alla fine `Schermo` converte tutto in colori. Così un
 * lampo rosso dei danni o la palette notturna sono un cambio di tabella, non un ridisegno, e la stessa
 * composizione gira in Node per le prove (nessun DOM qui dentro).
 *
 * Tutte le primitive rispettano un rettangolo di ritaglio (estremi inclusi): la mappa del gioco si
 * disegnava con il ritaglio acceso sulla propria finestra.
 */

export const LARGHEZZA = 320;
export const ALTEZZA = 200;

/** @typedef {[number, number, number, number]} Rettangolo x1, y1, x2, y2 inclusi */

export class Tela {
  constructor() {
    /** Indici dei 64000 pixel, riga per riga dall'alto. */
    this.px = new Uint8Array(LARGHEZZA * ALTEZZA);
    /** @type {Rettangolo} */
    this.ritaglio = [0, 0, LARGHEZZA - 1, ALTEZZA - 1];
  }

  /**
   * Accende il ritaglio (estremi inclusi, già intersecato con lo schermo).
   * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
   */
  ritaglia(x1, y1, x2, y2) {
    this.ritaglio = [Math.max(0, x1), Math.max(0, y1), Math.min(LARGHEZZA - 1, x2), Math.min(ALTEZZA - 1, y2)];
  }

  /** Spegne il ritaglio. */
  senzaRitaglio() {
    this.ritaglio = [0, 0, LARGHEZZA - 1, ALTEZZA - 1];
  }

  /** Copia integrale di 64000 indici (per esempio il pannello della stazione). @param {Uint8Array} sorgente */
  carica(sorgente) {
    this.px.set(sorgente.subarray(0, LARGHEZZA * ALTEZZA));
  }

  /** @param {number} x @param {number} y */
  leggi(x, y) {
    return this.px[y * LARGHEZZA + x];
  }

  /** @param {number} x @param {number} y @param {number} c */
  pixel(x, y, c) {
    const r = this.ritaglio;
    x |= 0; y |= 0;
    if (x < r[0] || x > r[2] || y < r[1] || y > r[3]) return;
    this.px[y * LARGHEZZA + x] = c;
  }

  /** Rettangolo pieno, estremi inclusi e in qualunque ordine. @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {number} c */
  riempi(x1, y1, x2, y2, c) {
    if (x1 > x2) [x1, x2] = [x2, x1];
    if (y1 > y2) [y1, y2] = [y2, y1];
    const r = this.ritaglio;
    const a = Math.max(x1 | 0, r[0]), b = Math.min(x2 | 0, r[2]);
    const t = Math.max(y1 | 0, r[1]), u = Math.min(y2 | 0, r[3]);
    if (a > b || t > u) return;
    for (let y = t; y <= u; y++) this.px.fill(c, y * LARGHEZZA + a, y * LARGHEZZA + b + 1);
  }

  /** @param {number} y @param {number} x1 @param {number} x2 @param {number} c */
  hline(y, x1, x2, c) {
    this.riempi(x1, y, x2, y, c);
  }

  /** @param {number} x @param {number} y1 @param {number} y2 @param {number} c */
  vline(x, y1, y2, c) {
    this.riempi(x, y1, x, y2, c);
  }

  /** Contorno. @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {number} c */
  rett(x1, y1, x2, y2, c) {
    this.hline(y1, x1, x2, c);
    this.hline(y2, x1, x2, c);
    this.vline(x1, y1, y2, c);
    this.vline(x2, y1, y2, c);
  }

  /**
   * Segmento di Bresenham. `passo` > 1 disegna un pixel ogni `passo` (tratteggio a puntini, come
   * le tracce del 1989), a partire da `fase`.
   * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {number} c
   * @param {number} [passo] @param {number} [fase]
   */
  linea(x0, y0, x1, y1, c, passo = 1, fase = 0) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let n = fase;
    // limite di sicurezza: un segmento lunghissimo (fuori schermo) non deve bloccare il fotogramma
    for (let i = 0; i < 4096; i++) {
      if (n++ % passo === 0) this.pixel(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /**
   * Copia un rettangolo da un'altra pagina 320×200 (per esempio gli «sprite» che gli script lasciano
   * nella finestra della mappa del retro: manopole, palla del telegrafo, leva dei timoni).
   * @param {Uint8Array} sorgente pagina di 64000 indici
   * @param {number} sx1 @param {number} sy1 @param {number} sx2 @param {number} sy2 rettangolo sorgente incluso
   * @param {number} dx @param {number} dy angolo di destinazione
   * @param {number} [trasparente] indice da saltare (-1 = nessuno)
   */
  copia(sorgente, sx1, sy1, sx2, sy2, dx, dy, trasparente = -1) {
    for (let y = sy1; y <= sy2; y++) {
      for (let x = sx1; x <= sx2; x++) {
        const c = sorgente[y * LARGHEZZA + x];
        if (c !== trasparente) this.pixel(dx + x - sx1, dy + y - sy1, c);
      }
    }
  }

  /**
   * Ricolora dentro un rettangolo: ogni pixel di colore `da` diventa `a` (pulsanti spenti).
   * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {number} da @param {number} a
   */
  ricolora(x1, y1, x2, y2, da, a) {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) if (this.px[y * LARGHEZZA + x] === da) this.px[y * LARGHEZZA + x] = a;
    }
  }

  /**
   * Blocco di indici (larghezza w) incollato in (dx, dy); `trasparente` come in copia.
   * @param {Uint8Array} blocco @param {number} w @param {number} dx @param {number} dy @param {number} [trasparente]
   */
  incolla(blocco, w, dx, dy, trasparente = -1) {
    const h = Math.floor(blocco.length / w);
    const r = this.ritaglio;
    for (let y = 0; y < h; y++) {
      const yy = dy + y;
      if (yy < r[1] || yy > r[3]) continue;
      for (let x = 0; x < w; x++) {
        const xx = dx + x;
        if (xx < r[0] || xx > r[2]) continue;
        const c = blocco[y * w + x];
        if (c !== trasparente) this.px[yy * LARGHEZZA + xx] = c;
      }
    }
  }
}
