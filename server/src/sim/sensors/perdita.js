// @ts-check
/**
 * La perdita di trasmissione che usano i sensori di F2 (banda stretta, attivo,
 * intercettazione, transitori). E' un punto solo, apposta: quando arrivano le
 * tabelle del tracciatore di raggi (server/src/sim/world/propagazione.js, filone
 * G) si reindirizza qui, con la stessa firma. Fino ad allora vale l'analitico
 * di F1 (acustica.js, perditaTrasmissione), che e' anche la riserva.
 *
 * (G) Reindirizzata: se l'ambiente porta le tabelle dello scenario
 * (`amb.propagazione`, caricate da server/src/sim/world/ambiente.js) decidono
 * loro; altrimenti l'analitico di F1. `banda` facoltativa: l'id di una banda
 * delle tabelle ('sfera' e 'towed' sono le ottave dei sensori a banda larga);
 * senza, si legge alla frequenza f (interpolata fra le bande strette).
 */

import { perditaTrasmissione } from './acustica.js';

/** @typedef {import('./acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../world/ambiente.js').Ambiente} Ambiente */
/** @typedef {import('./acustica.js').Punto3} Punto3 */

/**
 * TL fra sorgente e ricevitore alla frequenza f, dB.
 * @param {ValoriAcustica} ac
 * @param {Ambiente} amb
 * @param {number} f Hz
 * @param {Punto3} s sorgente (z positiva verso il basso)
 * @param {Punto3} r ricevitore
 * @param {string} [banda] id di una banda delle tabelle (per esempio 'sfera', 'towed')
 * @returns {number}
 */
export function perdita(ac, amb, f, s, r, banda) {
  if (amb.propagazione) return amb.propagazione.perdita(s, r, banda ?? f);
  return perditaTrasmissione(ac, amb, f, s, r);
}

/**
 * La TL di un percorso a piu' frequenze (righe tonali, griglia del LOFAR): con
 * le tabelle si legge il percorso una volta sola e poi ogni banda o frequenza.
 * @param {ValoriAcustica} ac
 * @param {Ambiente} amb
 * @param {Punto3} s
 * @param {Punto3} r
 * @returns {(f: number | string) => number}  TL a una frequenza in Hz (o a una banda delle tabelle)
 */
export function percorsoPerdita(ac, amb, s, r) {
  if (amb.propagazione) {
    const via = amb.propagazione.percorso(s, r);
    return (f) => via.perdita(f);
  }
  return (f) => perditaTrasmissione(ac, amb, typeof f === 'number' ? f : (ac.bande[/** @type {'sfera' | 'towed'} */ (f)]?.centro ?? 1000), s, r);
}
