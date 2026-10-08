// @ts-check
/**
 * Ship's Control (F4): timone, telegrafo di macchina, timoni orizzontali, funzioni automatiche,
 * autopilota, indicatore di cavitazione.
 *
 * Le manopole sono gli «sprite» che STEER.CLS lascia nella finestra della mappa del retro, come faceva
 * il gioco: il timone (5×13 in 30..34,77..89), la palla del telegrafo (34..46,97..107, nero
 * trasparente), la leva dei timoni orizzontali (61..82, blu trasparente). Le posizioni sono quelle
 * delle catture 013-016 e 074 (vedi le costanti).
 *
 * Zone cliccabili di STEER.CLS (pannelli.json, lavoro STEER_688), tasto → comando:
 *   R, 129-138  timone, undici posizioni da tutto a sinistra a tutto a dritta (gruppo 2)
 *   E, 140-145  macchina: REV, STOP, 1/3, 2/3, STD, FULL, FLANK (gruppo 3)
 *   D, 147-154  timoni orizzontali: quattro di salita, zero, quattro di discesa (gruppo 4)
 *   200-202     150 FT (quota 'automatica'), PERISCOPE DEPTH, EMERGENCY SURFACE (gruppo 5)
 *   '.'         autopilota (gruppo 6)
 */
import { chiamaRoutine } from '../resa/risorse.js';
import { attivaComune } from './comune.js';

/** @typedef {import('./comune.js').Contesto} Contesto */
/** @typedef {import('./comune.js').Stazione} Stazione */
/** @typedef {import('../cls.js').Hotspot} Hotspot */

/** Tasti del timone in ordine da sinistra a dritta, e gli angoli ordinati (comandi di timone reali). */
export const TASTI_TIMONE = [82, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138];
export const ANGOLI_TIMONE = [-30, -20, -15, -10, -5, 0, 5, 10, 15, 20, 30];
/** Telegrafo: tasto → ordine di macchina, con la posizione della palla. */
export const TELEGRAFO = Object.freeze(/** @type {Record<number, { ordine: string, x: number, y: number }>} */ ({
  69: { ordine: 'rev', x: 166, y: 153 },
  140: { ordine: 'stop', x: 166, y: 140 },
  141: { ordine: '1/3', x: 191, y: 140 },
  142: { ordine: '2/3', x: 211, y: 140 },
  143: { ordine: 'std', x: 231, y: 140 },
  144: { ordine: 'full', x: 252, y: 140 },
  145: { ordine: 'flank', x: 252, y: 156 },
}));
/** Timoni orizzontali dall'alto (RISE) al basso (DIVE), angoli e riga della maniglia. */
export const TASTI_TIMONI_O = [68, 147, 148, 149, 150, 151, 152, 153, 154];
export const ANGOLI_TIMONI_O = [-20, -15, -10, -5, 0, 5, 10, 15, 20];
const RIGHE_LEVA = [70, 76, 82, 88, 94, 101, 106, 112, 118];

/**
 * Spie accese del CAVITATION LEVEL. Il server dice se l'elica cavita e a che velocità comincerebbe
 * alla quota attuale (protocollo v1): le prime sei spie (blu e verdi) misurano quanto si è vicini a
 * quella velocità, le ultime quattro (gialle e rosse) si accendono solo cavitando, di più quanto più
 * la si supera. Nel 1989 l'indicatore seguiva l'accelerazione (ORIGINALE.md §3); qui segue la fisica
 * di SCHEMA §5, ma con lo stesso colpo d'occhio.
 * @param {number} nodi @param {number} vCav nodi @param {boolean} cavita
 */
export function spieCavitazione(nodi, vCav, cavita) {
  const v = Math.abs(nodi);
  if (cavita) return Math.min(10, 7 + Math.floor(Math.max(0, v - vCav) / 2));
  if (!(vCav > 0)) return 0;
  return Math.min(6, Math.floor((6 * v) / vCav));
}

/** Indice più vicino in una tabella ordinata. @param {number[]} tabella @param {number} v */
export function piuVicino(tabella, v) {
  let best = 0;
  for (let i = 1; i < tabella.length; i++) if (Math.abs(tabella[i] - v) < Math.abs(tabella[best] - v)) best = i;
  return best;
}

/** @param {Contesto} ctx */
function disegna(ctx) {
  const { tela, pannello, stato } = ctx;
  const nave = stato.nave;
  const retro = pannello.retro;
  const timone = nave ? nave.timone : 0;
  const timoniO = nave ? nave.timoni_o : 0;
  const macchina = nave ? nave.macchina : 'stop';

  // timone: la manopola sopra la posizione più vicina all'angolo attuale
  const it = piuVicino(ANGOLI_TIMONE, timone);
  const hs = pannello.hotspot.find((h) => h.tasto === TASTI_TIMONE[it]);
  if (hs) tela.copia(retro, 30, 77, 34, 89, hs.x1 + 3, 145);

  // telegrafo
  const voce = Object.values(TELEGRAFO).find((v) => v.ordine === macchina) ?? TELEGRAFO[140];
  tela.copia(retro, 34, 97, 46, 107, voce.x, voce.y, 0);

  // leva dei timoni orizzontali: maniglia sola a zero, con il gambo verso il perno altrimenti
  const il = piuVicino(ANGOLI_TIMONI_O, timoniO);
  const y = RIGHE_LEVA[il];
  if (il === 4) tela.copia(retro, 61, 84, 82, 88, 191, y, 1);
  else if (il < 4) tela.copia(retro, 61, 84, 82, 90, 191, y, 1);
  else tela.copia(retro, 61, 103, 82, 109, 191, y - 2, 1);

  // cavitazione: dieci spie, tre blu, tre verdi, due gialle, due rosse (015)
  const accese = nave ? spieCavitazione(nave.velocita, nave.v_cavitazione, nave.cavitazione) : 0;
  const colori = [9, 9, 9, 10, 10, 10, 14, 14, 12, 12];
  for (let k = 0; k < 10; k++) tela.riempi(199 + 11 * k, 39, 204 + 11 * k, 44, k < accese ? colori[k] : 7);

  // autopilota: il gioco lo ridisegna largo fino a x 316 e con il bordo destro del riquadro di NAV.CLS
  // (routine 8: bianco in x2-2, grigio scuro in x2-1), non con quello di STEER.CLS (routine 7, che
  // mette il bianco in x2-1): così coincide al pixel con 013
  const on = stato.ordinati.autopilota;
  chiamaRoutine(ctx.orig.cls, tela, 'NAV.CLS', 8, [284, 153, 316, 165, on ? ' ON' : 'OFF', 11, 1]);
}

/**
 * @param {Contesto} ctx @param {Hotspot} h @param {{ x: number, y: number } | null} _punto
 * @param {(s: string) => void} vaiA
 */
function attiva(ctx, h, _punto, vaiA) {
  if (attivaComune(ctx, h, vaiA)) return true;
  const t = h.tasto;
  const ir = TASTI_TIMONE.indexOf(t);
  if (ir >= 0) {
    ctx.ordina('timone', ANGOLI_TIMONE[ir]);
    return true;
  }
  if (TELEGRAFO[t]) {
    ctx.ordina('macchina', TELEGRAFO[t].ordine);
    return true;
  }
  const io = TASTI_TIMONI_O.indexOf(t);
  if (io >= 0) {
    ctx.ordina('timoni_o', ANGOLI_TIMONI_O[io]);
    return true;
  }
  if (t === 200) { ctx.ordina('quota', 'automatica'); return true; }
  if (t === 201) { ctx.ordina('quota', 'periscopica'); return true; }
  if (t === 202) { ctx.ordina('quota', 'emersione'); return true; }
  if (t === 46) { ctx.ordina('autopilota', !ctx.stato.ordinati.autopilota); return true; }
  return false;
}

/** @param {(s: string) => void} vaiA @returns {Stazione} */
export function governo(vaiA) {
  return {
    id: 'governo',
    lavoro: 'STEER_688',
    cornice: true,
    disegna,
    attiva: (ctx, h, p) => attiva(ctx, h, p, vaiA),
  };
}
