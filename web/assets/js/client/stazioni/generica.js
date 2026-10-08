// @ts-check
/**
 * Le stazioni che arrivano nelle fasi successive: Radio (F2), Status (F3), Periscopio (F5), Controllo
 * armi (F7). Si vedono con il loro pannello originale; dove c'è la finestra della mappa (periscopio e
 * armi) la mappa funziona come altrove, i comandi propri rispondono «non disponibile».
 */
import { attivaComune } from './comune.js';

/** @typedef {import('./comune.js').Stazione} Stazione */

/**
 * @param {string} id @param {string} lavoro @param {boolean} cornice
 * @param {(s: string) => void} vaiA
 * @returns {Stazione}
 */
export function generica(id, lavoro, cornice, vaiA) {
  return {
    id,
    lavoro,
    cornice,
    disegna() {},
    attiva(ctx, h) {
      if (cornice && attivaComune(ctx, h, vaiA)) return true;
      if (h.tasto === 88 && h.gruppo === 0) {
        vaiA('conn');
        return true;
      }
      ctx.avvisa('locale.stazione_non_disponibile');
      return true;
    },
  };
}
