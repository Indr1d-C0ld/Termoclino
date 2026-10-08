// @ts-check
/**
 * L'HUD sopra la mappa (tasto H): nastro della bussola in alto e scala della quota a destra.
 *
 * Misurato al pixel su 013 e 074 (catture DOSBox):
 *  - bussola: linea magenta (13) a y 32 da x 68 a 121, ombra nera a y 31 (da 63 a 122) e un pixel nero a
 *    sinistra di ogni tacca; la rotta propria sta sempre in x 92, sotto il triangolo bianco (righe 29-31);
 *    3 px ogni 5° (0,6 px per grado), tacca media ogni 15°, lunga ogni 45° con il nome del punto
 *    cardinale in ciano bordato di nero (y 39);
 *  - scala della quota: colonna magenta x 169 da y 43 a 107, tacche ogni 2 righe con periodo di 8
 *    (lunga, corta, media, corta), 32 piedi per riga a partire da 0 ft in y 43; freccetta verde (10)
 *    per la quota propria, rossa (12) per il fondo, una tacca che sporge a destra per lo strato.
 */
import { normalizza360, metriInPiedi } from '../../../shared/units.js';
import { scrivi, scriviBordato, larghezzaTesto } from './testo.js';

/** @typedef {import('./tela.js').Tela} Tela */
/** @typedef {import('./testo.js').FontGioco} FontGioco */

export const BUSSOLA = Object.freeze({ x1: 68, x2: 121, centro: 92, y: 32, pxPerGrado: 0.6 });
export const SCALA_QUOTA = Object.freeze({ x: 169, y0: 43, y1: 107, piediPerRiga: 32 });

const CARDINALI = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * x dello schermo di un rilevamento vero sul nastro, data la rotta (può uscire dal nastro).
 * @param {number} rilevamento @param {number} rotta
 */
export function xBussola(rilevamento, rotta) {
  let d = normalizza360(rilevamento - rotta);
  if (d > 180) d -= 360;
  return BUSSOLA.centro + d * BUSSOLA.pxPerGrado;
}

/**
 * Nastro della bussola.
 * @param {Tela} tela @param {FontGioco} font @param {number} rotta gradi veri
 */
export function disegnaBussola(tela, font, rotta) {
  const { x1, x2, y } = BUSSOLA;
  tela.hline(y - 1, x1 - 5, x2 + 1, 0);
  tela.hline(y, x1, x2, 13);
  // tacche: un multiplo di 5° cade ogni 3 pixel
  const primo = Math.ceil((rotta - 45) / 5) * 5;
  for (let g = primo; g <= rotta + 50; g += 5) {
    const x = Math.round(xBussola(g, rotta));
    if (x < x1 || x > x2) continue;
    const n = normalizza360(g);
    const fondo = n % 45 === 0 ? y + 5 : n % 15 === 0 ? y + 3 : y + 1;
    tela.vline(x - 1, y + 1, fondo, 0);
    tela.vline(x, y + 1, fondo, 13);
    if (n % 45 === 0) {
      const nome = CARDINALI[n / 45];
      const w = larghezzaTesto(font, nome) - 1;
      scriviBordato(tela, font, x - Math.floor(w / 2), y + 7, nome, 11, 0);
    }
  }
  // triangolo bianco della rotta propria
  const c = BUSSOLA.centro;
  tela.hline(y - 3, c - 2, c + 2, 15);
  tela.hline(y - 2, c - 1, c + 1, 15);
  tela.pixel(c, y - 1, 15);
}

/**
 * Riga dello schermo di una quota (metri) sulla scala, limitata alla scala.
 * @param {number} metri
 */
export function yQuota(metri) {
  const y = SCALA_QUOTA.y0 + metriInPiedi(Math.max(0, metri)) / SCALA_QUOTA.piediPerRiga;
  return Math.floor(Math.min(SCALA_QUOTA.y1, y));
}

/**
 * Freccetta della scala: 4/5/4 pixel col contorno nero.
 * @param {Tela} tela @param {number} y @param {number} colore
 */
function freccetta(tela, y, colore) {
  tela.riempi(155, y - 2, 160, y + 2, 0);
  tela.pixel(161, y, 0);
  tela.hline(y - 1, 156, 159, colore);
  tela.hline(y, 156, 160, colore);
  tela.hline(y + 1, 156, 159, colore);
}

/**
 * Scala della quota con la quota propria, il fondo e lo strato.
 * @param {Tela} tela @param {number} quota metri @param {number | null} fondo metri (quota del fondo) @param {number | null} strato metri
 */
export function disegnaScalaQuota(tela, quota, fondo, strato) {
  const { x, y0, y1 } = SCALA_QUOTA;
  /** @param {number} y */
  const inizio = (y) => {
    const k = (y - y0) % 8;
    return k === 0 ? x - 6 : k === 4 ? x - 4 : k % 2 === 0 ? x - 2 : x;
  };
  // prima le ombre (un pixel in basso a sinistra, e una seconda riga sotto le tacche lunghe e medie), poi le tacche
  for (let y = y0; y <= y1; y++) {
    const sx = inizio(y);
    tela.hline(y + 1, sx - 1, x - 1, 0);
    if (sx <= x - 4) tela.hline(y + 2, sx, x - 3, 0);
    tela.pixel(x + 1, y, 0);
  }
  for (let y = y0; y <= y1; y++) tela.hline(y, inizio(y), x, 13);
  if (strato !== null && strato > 0) {
    const ys = yQuota(strato);
    tela.hline(ys - 1, x - 3, x + 6, 0);
    tela.hline(ys + 1, x - 3, x + 6, 0);
    tela.hline(ys, x - 4, x + 5, 13);
  }
  if (fondo !== null && fondo > 0) freccetta(tela, yQuota(fondo), 12);
  freccetta(tela, yQuota(quota), 10);
}

/**
 * Parola della direzione del periscopio o della vista (in alto a sinistra nella finestra).
 * @param {Tela} tela @param {FontGioco} font @param {string} parola
 */
export function disegnaParolaVista(tela, font, parola) {
  if (parola) scrivi(tela, font, 11, 30, parola, 13);
}
