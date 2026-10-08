// @ts-check
/**
 * Lo schermo Classic: la tela indicizzata 320×200 convertita in colori e mostrata ingrandita di un
 * fattore INTERO di pixel del dispositivo, al pixel più vicino.
 *
 * Il canvas resta di 320×200 pixel; lo si ingrandisce con il CSS (`image-rendering: pixelated`)
 * scegliendo la larghezza in modo che a ogni pixel logico corrispondano esattamente k pixel del
 * dispositivo, anche con un devicePixelRatio frazionario (1,25, 1,5…): niente righe più spesse delle
 * altre.
 */
import { LARGHEZZA, ALTEZZA } from './tela.js';

/** @typedef {import('./tela.js').Tela} Tela */

/**
 * Tabella palette → RGBA a 32 bit nell'ordine dei byte di ImageData (little endian).
 * @param {number[][]} palette 256 colori [r, g, b]
 */
export function tabellaColori(palette) {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = palette[i] ?? [0, 0, 0];
    t[i] = (255 << 24 | b << 16 | g << 8 | r) >>> 0;
  }
  return t;
}

/**
 * Fattore di ingrandimento intero (in pixel del dispositivo) che sta nello spazio dato.
 * @param {number} larghezzaCss @param {number} altezzaCss @param {number} dpr
 */
export function fattoreIntero(larghezzaCss, altezzaCss, dpr) {
  const k = Math.floor(Math.min((larghezzaCss * dpr) / LARGHEZZA, (altezzaCss * dpr) / ALTEZZA));
  return Math.max(1, k);
}

export class Schermo {
  /** @param {HTMLCanvasElement} canvas @param {number[][]} palette */
  constructor(canvas, palette) {
    this.canvas = canvas;
    canvas.width = LARGHEZZA;
    canvas.height = ALTEZZA;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D non disponibile');
    this.ctx = ctx;
    this.immagine = ctx.createImageData(LARGHEZZA, ALTEZZA);
    this.u32 = new Uint32Array(this.immagine.data.buffer);
    this.colori = tabellaColori(palette);
    this.fattore = 1;
  }

  /** @param {number[][]} palette */
  cambiaPalette(palette) {
    this.colori = tabellaColori(palette);
  }

  /** @param {Tela} tela */
  presenta(tela) {
    const px = tela.px, u = this.u32, c = this.colori;
    for (let i = 0; i < px.length; i++) u[i] = c[px[i]];
    this.ctx.putImageData(this.immagine, 0, 0);
  }

  /**
   * Adatta le dimensioni CSS allo spazio disponibile con un fattore intero.
   * @param {number} larghezzaCss @param {number} altezzaCss
   */
  adatta(larghezzaCss, altezzaCss) {
    const dpr = window.devicePixelRatio || 1;
    const k = fattoreIntero(larghezzaCss, altezzaCss, dpr);
    this.fattore = k;
    this.canvas.style.width = `${(LARGHEZZA * k) / dpr}px`;
    this.canvas.style.height = `${(ALTEZZA * k) / dpr}px`;
  }
}
