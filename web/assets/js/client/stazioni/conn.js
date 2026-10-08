// @ts-check
/**
 * La CONN: la sala di controllo dipinta del 688 (sale/688.png) come menu, con le zone sensibili di
 * M.CLS (lavoro CONN_688): X uscita, R radio, U status, T governo, P periscopio, N navigazione,
 * W armi, S sonar. Nel 1989 il puntatore diventava l'icona della stazione; qui, sopra la zona, il
 * nome della stazione compare in basso in un riquadro bianco come quelli dell'aiuto.
 */
import { disegnaRiquadro } from '../resa/cornice.js';
import { larghezzaTesto } from '../resa/testo.js';
import { hotspotIn } from '../cls.js';

/** @typedef {import('./comune.js').Contesto} Contesto */
/** @typedef {import('./comune.js').Stazione} Stazione */

/** Lettera della zona → stazione. */
export const STAZIONE_PER_TASTO = Object.freeze(/** @type {Record<number, string>} */ ({
  82: 'radio', 85: 'status', 84: 'governo', 80: 'periscopio', 78: 'navigazione', 87: 'armi', 83: 'sonar',
}));

/** @param {Contesto} ctx */
function disegna(ctx) {
  const { ui, pannello } = ctx;
  const h = ui.fuoco !== null ? pannello.hotspot[ui.fuoco] ?? null : hotspotIn(pannello.hotspot, ui.cursore.x, ui.cursore.y);
  if (!h) return;
  const nome = ctx.t(`ui.stazione.${String.fromCharCode(h.tasto)}`);
  const w = larghezzaTesto(ctx.font, nome) + 8;
  disegnaRiquadro(ctx.tela, ctx.font, Math.round(160 - w / 2), 182, [nome]);
}

/** @param {(s: string) => void} vaiA @returns {Stazione} */
export function conn(vaiA) {
  return {
    id: 'conn',
    lavoro: 'CONN_688',
    cornice: false,
    disegna,
    attiva(ctx, h) {
      const s = STAZIONE_PER_TASTO[h.tasto];
      if (s) {
        vaiA(s);
        return true;
      }
      if (h.tasto === 88) {
        // EXIT: nel browser non c'è un DOS a cui tornare; si torna al sito
        location.href = document.getElementById('plancia')?.dataset.uscita ?? '/';
        return true;
      }
      return false;
    },
  };
}
