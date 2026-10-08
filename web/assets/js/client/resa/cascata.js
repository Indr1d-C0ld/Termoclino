// @ts-check
/**
 * La cascata a banda larga («waterfall») nella finestra della mappa del Sonar.
 *
 * Il gioco del 1989 non l'aveva (ORIGINALE.md §5): è una stazione nuova, costruita nel kit originale.
 * Una riga per fotogramma `sonar` (1 Hz di tempo di gioco), 180 settori da 2°, il tempo che scende
 * verso il basso, nei colori della palette DAY: nero per il fondo, la rampa del mare (96-143, dal blu
 * notte al ciano) per l'eccesso di segnale, ciano chiaro (11) e bianco (15) per i picchi, i grigi degli
 * sprite (145-150) per i settori ciechi (baffles), che restano visibili ma spenti.
 *
 * Geometria: la finestra è larga 168 pixel; i settori del protocollo v1 sono di rilevamento VERO
 * (settore k = [2k°, 2k+2°)).
 *  - Rilevamento RELATIVO: due gradi per colonna, la prua al centro (x 92, la stessa colonna del
 *    battello sulla mappa) e i 24° di poppa (168°-192°) fuori dal quadro: cadono comunque nei baffles
 *    della sfera. Ogni riga si ruota con la rotta del suo secondo: un contatto fermo scivola di lato
 *    quando si accosta.
 *  - Rilevamento VERO: il nord al centro e 360° compressi in 168 colonne.
 * Una colonna che copre più settori prende il massimo, così un picco stretto non sparisce nel
 * ricampionamento.
 */
import { normalizza360 } from '../../../shared/units.js';

/** @typedef {'relativo' | 'vero'} Riferimento */

export const SETTORI = 180;
export const GRADI_SETTORE = 2;
export const COLONNE = 168;
/** Colonna della prua (relativo) o del nord (vero): x 92 sullo schermo. */
export const COLONNA_CENTRO = 84;

/**
 * Indice di palette per un byte del fotogramma (q: SE = −30 + 0,5·q dB; fondo di rumore intorno a
 * q 40, soglia di rivelazione a q 60). Il rumore resta nel blu notte (96-104), quello che supera la
 * soglia sale lungo la rampa del mare fino al ciano (105-142), poi ciano chiaro e bianco.
 * @param {number} v @param {boolean} [cieco]
 */
export function coloreCascata(v, cieco = false) {
  if (cieco) return 145 + Math.min(5, Math.floor(v / 40));
  if (v < 28) return 0;
  if (v < 64) return 96 + Math.floor((v - 28) / 4);
  if (v < 160) return 105 + Math.floor(((v - 64) * 38) / 96);
  return v < 200 ? 11 : 15;
}

/**
 * Settori VERI (estremi inclusi, anche oltre 179: si riducono modulo 180) coperti da una colonna.
 * @param {number} colonna 0..167 @param {Riferimento} rif @param {number} rotta gradi veri della riga
 * @returns {[number, number]}
 */
export function settoriDiColonna(colonna, rif, rotta) {
  const passo = rif === 'relativo' ? GRADI_SETTORE : 360 / COLONNE;
  const da = normalizza360((colonna - COLONNA_CENTRO) * passo + (rif === 'relativo' ? rotta : 0));
  const s0 = Math.floor(da / GRADI_SETTORE + 1e-9);
  const s1 = Math.floor((da + passo) / GRADI_SETTORE - 1e-9);
  return [s0, Math.max(s0, s1)];
}

/**
 * Una riga della cascata (168 indici di palette) da un fotogramma.
 * @param {ArrayLike<number>} settori 180 byte del protocollo, settore k = rilevamenti veri [2k°, 2k+2°)
 * @param {ArrayLike<number> | null} ciechi 180 valori, ≠0 = settore cieco (stato.js: mascheraCiechi)
 * @param {Riferimento} rif @param {number} rotta
 * @returns {Uint8Array}
 */
export function rigaCascata(settori, ciechi, rif, rotta) {
  const riga = new Uint8Array(COLONNE);
  for (let c = 0; c < COLONNE; c++) {
    const [s0, s1] = settoriDiColonna(c, rif, rotta);
    let v = 0, cieco = true;
    for (let s = s0; s <= s1; s++) {
      const k = s % SETTORI;
      v = Math.max(v, settori[k] ?? 0);
      if (!ciechi || !ciechi[k]) cieco = false;
    }
    riga[c] = coloreCascata(v, cieco);
  }
  return riga;
}

/**
 * Colonna (0..167, frazionaria) di un rilevamento VERO, o null se cade fuori dal quadro (poppa, in
 * relativo).
 * @param {number} vero @param {Riferimento} rif @param {number} rotta
 */
export function colonnaDiRilevamento(vero, rif, rotta) {
  if (rif === 'relativo') {
    let rel = normalizza360(vero - rotta);
    if (rel >= 180) rel -= 360;
    const c = COLONNA_CENTRO + rel / GRADI_SETTORE;
    return c < 0 || c >= COLONNE ? null : c;
  }
  let d = normalizza360(vero);
  if (d >= 180) d -= 360;
  return COLONNA_CENTRO + (d * COLONNE) / 360;
}

/**
 * Rilevamento VERO al centro di una colonna.
 * @param {number} colonna @param {Riferimento} rif @param {number} rotta
 */
export function rilevamentoDiColonna(colonna, rif, rotta) {
  if (rif === 'relativo') return normalizza360(rotta + (colonna - COLONNA_CENTRO + 0.5) * GRADI_SETTORE);
  return normalizza360(((colonna - COLONNA_CENTRO + 0.5) * 360) / COLONNE);
}

/**
 * Picchi di un vettore di settori: massimi locali (vicini circolari) sopra la soglia, fuori dai
 * settori ciechi, ordinati dal più forte; due picchi più vicini di `separazione` settori contano per
 * uno. È quello che la plancia può dire senza posizioni: «c'è qualcosa per 045». La soglia
 * predefinita è quella di rivelazione del protocollo (q = 60, SE = 0 dB) più 6 dB, per non far
 * comparire una X a ogni granello di rumore.
 * @param {ArrayLike<number>} settori @param {ArrayLike<number> | null} ciechi
 * @param {number} [soglia] @param {number} [separazione]
 * @returns {{ settore: number, valore: number, rilevamento: number }[]} rilevamento vero al centro del settore
 */
export function picchi(settori, ciechi, soglia = 72, separazione = 3) {
  /** @type {{ settore: number, valore: number, rilevamento: number }[]} */
  const trovati = [];
  for (let k = 0; k < SETTORI; k++) {
    const v = settori[k] ?? 0;
    if (v < soglia || (ciechi && ciechi[k])) continue;
    const prima = settori[(k + SETTORI - 1) % SETTORI] ?? 0;
    const dopo = settori[(k + 1) % SETTORI] ?? 0;
    // massimo locale; su un pianoro vale il primo settore
    if (v > prima && v >= dopo) trovati.push({ settore: k, valore: v, rilevamento: k * GRADI_SETTORE + GRADI_SETTORE / 2 });
  }
  trovati.sort((a, b) => b.valore - a.valore);
  /** @type {typeof trovati} */
  const tenuti = [];
  for (const p of trovati) {
    const vicino = tenuti.some((q) => {
      const d = Math.abs(q.settore - p.settore);
      return Math.min(d, SETTORI - d) < separazione;
    });
    if (!vicino) tenuti.push(p);
  }
  return tenuti;
}
