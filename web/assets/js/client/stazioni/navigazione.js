// @ts-check
/**
 * Navigation Board (F6): la mappa con la batimetria vera, i waypoint e l'autopilota, il pannello
 * PLOTTING (tracce, proiezione della posizione) e TARGET.
 *
 * Zone cliccabili di NAV.CLS (lavoro NAV_688): G TARGET (gruppo 2); W SET, K CLEAR, Q TIME, '.'
 * AUTO PILOT (gruppo 3); 200 ALL TRACKS, 201 TARGET TRACK, 202 PLOT PROJ, '=' e '-' le frecce della
 * proiezione temporale (gruppo 4). I riquadri ON/OFF si ridisegnano con la routine 8 di NAV.CLS, la
 * stessa che li disegna spenti; le due cifre della proiezione stanno negli agganci «cifra» del lavoro.
 *
 * SET apre il mirino: lo si muove col mouse o con le frecce e lo si conferma con Invio o con un clic
 * nella finestra (Esc annulla). Fino a 9 waypoint; l'autopilota si accende da solo, come nel 1989.
 *
 * T della pulsantiera della mappa passa dalla carta alla vista TMA (stazioni/vistatma.js) e ritorno.
 */
import { chiamaRoutine } from '../resa/risorse.js';
import { attivaComune, designaProssimo, vistaMappa } from './comune.js';
import { FINESTRA, inMondo } from '../resa/mappa.js';
import { CIFRA_GRANDE, scrivi } from '../resa/testo.js';
import { WAYPOINT_MAX, SCALE_TEMPO } from '../../../shared/protocol.js';
import { disegnaTma, hotspotTma, attivaTma } from './vistatma.js';

/** @typedef {import('./comune.js').Contesto} Contesto */
/** @typedef {import('./comune.js').Stazione} Stazione */
/** @typedef {import('../cls.js').Hotspot} Hotspot */

/** Riquadri ON/OFF (NAV.CLS L04 → routine 8 con x, y, x+32, y+12). */
const RIQUADRI = { tutte: [194, 42], bersaglio: [194, 62], proiezione: [194, 82] };

/**
 * Riquadro ON/OFF. Il gioco scrive « ON» con lo spazio davanti ma «OFF» senza (catture 021, 026: lo
 * script invece disegna « OFF», tre pixel più a destra).
 * @param {Contesto} ctx @param {number} x @param {number} y @param {boolean} acceso
 * @param {number} [x2] bordo destro, se il gioco lo disegna più largo
 */
function riquadro(ctx, x, y, acceso, x2 = x + 32) {
  chiamaRoutine(ctx.orig.cls, ctx.tela, 'NAV.CLS', 8, [x, y, x2, y + 12, acceso ? ' ON' : 'OFF', 11, 1]);
}

/**
 * Cifra grande in una casella DIGITBOX: il gioco annerisce 9×9 pixel dall'angolo (bordo in alto e a
 * sinistra compresi) e scrive la cifra a +1,+2 (021).
 * @param {Contesto} ctx @param {number} x @param {number} y @param {number} n
 */
function cifra(ctx, x, y, n) {
  ctx.tela.riempi(x, y, x + 8, y + 8, 0);
  scrivi(ctx.tela, ctx.font, x + 1, y + 2, String.fromCharCode(CIFRA_GRANDE + n), 15);
}

/** @param {Contesto} ctx */
function disegna(ctx) {
  const p = ctx.ui.plot;
  riquadro(ctx, RIQUADRI.tutte[0], RIQUADRI.tutte[1], p.tutteTracce);
  riquadro(ctx, RIQUADRI.bersaglio[0], RIQUADRI.bersaglio[1], p.tracciaBersaglio);
  riquadro(ctx, RIQUADRI.proiezione[0], RIQUADRI.proiezione[1], p.proiezione);
  // autopilota: il gioco lo ridisegna da x 265 a 297, sopra quello dello script (021)
  riquadro(ctx, 265, 153, ctx.stato.ordinati.autopilota, 297);
  const caselle = ctx.pannello.agganci.filter((a) => a.tipo === 'cifra');
  if (caselle.length >= 2) {
    cifra(ctx, Number(caselle[0].x1), Number(caselle[0].y1), Math.floor(p.minuti / 10));
    cifra(ctx, Number(caselle[1].x1), Number(caselle[1].y1), p.minuti % 10);
  }
}

/**
 * @param {Contesto} ctx @param {Hotspot} h @param {{ x: number, y: number } | null} _punto
 * @param {(s: string) => void} vaiA
 */
function attiva(ctx, h, _punto, vaiA) {
  if (ctx.ui.tma.aperta && h.gruppo >= 5 && attivaTma(ctx, h)) return true;
  if (attivaComune(ctx, h, vaiA)) return true;
  const ui = ctx.ui;
  switch (h.tasto) {
    case 71: // G: TARGET
      designaProssimo(ctx);
      return true;
    case 87: // W: SET
      if (ctx.stato.ordinati.waypoint.length >= WAYPOINT_MAX) {
        ctx.avvisa('locale.waypoint_massimi');
      } else {
        ui.tma.aperta = false;
        ui.mirino = { tipo: 'waypoint', x: 92, y: 74 };
        ctx.avvisa('locale.seleziona_waypoint');
      }
      return true;
    case 75: // K: CLEAR
      ctx.ordina('waypoint', { azione: 'svuota' });
      return true;
    case 81: { // Q: TIME. La palestra è condivisa: la scala si cambia solo se si è soli (D2)
      const p = ctx.stato.partita;
      if (!p || !p.tempo_modificabile) {
        ctx.avvisa('motivo.tempo_bloccato');
      } else {
        const i = SCALE_TEMPO.indexOf(p.scala_tempo);
        ctx.ordina('scala_tempo', SCALE_TEMPO[(i + 1) % SCALE_TEMPO.length]);
      }
      return true;
    }
    case 46: // . : AUTO PILOT
      ctx.ordina('autopilota', !ctx.stato.ordinati.autopilota);
      return true;
    case 200:
      ui.plot.tutteTracce = !ui.plot.tutteTracce;
      return true;
    case 201:
      ui.plot.tracciaBersaglio = !ui.plot.tracciaBersaglio;
      return true;
    case 202:
      ui.plot.proiezione = !ui.plot.proiezione;
      return true;
    case 61: // freccia sinistra della proiezione temporale
      ui.plot.minuti = Math.max(1, ui.plot.minuti - 1);
      return true;
    case 45: // freccia destra
      ui.plot.minuti = Math.min(99, ui.plot.minuti + 1);
      return true;
    default:
      return false;
  }
}

/**
 * Conferma del mirino del waypoint nel punto (logico) dato.
 * @param {Contesto} ctx @param {number} px @param {number} py
 */
export function confermaWaypoint(ctx, px, py) {
  ctx.ui.mirino = null;
  if (px < FINESTRA.x1 || px > FINESTRA.x2 || py < FINESTRA.y1 || py > FINESTRA.y2) return;
  const m = inMondo(vistaMappa(ctx), px, py);
  ctx.ordina('waypoint', { azione: 'aggiungi', x: Math.round(m.x), y: Math.round(m.y) });
  if (!ctx.stato.ordinati.autopilota) ctx.ordina('autopilota', true);
}

/** @param {(s: string) => void} vaiA @returns {Stazione} */
export function navigazione(vaiA) {
  return {
    id: 'navigazione',
    lavoro: 'NAV_688',
    cornice: true,
    disegna,
    disegnaFinestra(ctx) {
      if (!ctx.ui.tma.aperta || ctx.ui.mirino) return false;
      disegnaTma(ctx);
      return true;
    },
    hotspotExtra: (ctx) => (ctx.ui.tma.aperta && !ctx.ui.mirino ? hotspotTma(ctx) : []),
    attiva: (ctx, h, p) => attiva(ctx, h, p, vaiA),
  };
}
