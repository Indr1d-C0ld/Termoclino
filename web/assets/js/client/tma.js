// @ts-check
/**
 * La parte del client della TMA: dai messaggi del server (storia dei rilevamenti delle tracce, traccia
 * propria, soluzioni) alle forme di shared/tma.js, e ritorno. Niente matematica nuova: i conti sono
 * quelli del modulo comune (agente I), così i numeri che il giocatore ottiene da sé ai livelli 0-1 sono
 * gli stessi dell'equipaggio.
 *
 *  - `misureDi`: la storia tempo-rilevamento di una traccia come misure {ora, rilevamento, sigma, x, y};
 *  - `gambeProprie`: le gambe del proprio moto dalla traccia propria (rotta e velocità ogni 10 s);
 *  - `posizioneSoluzione`: dove sta (e dove sarà) il bersaglio secondo una soluzione;
 *  - `provaIniziale`, `provaInStato`: la soluzione di prova del MATE nella forma del protocollo e nello
 *    stato cartesiano;
 *  - `strumenti`: tutto quello che la vista TMA mostra per una traccia in un colpo solo.
 */
import {
  trovaGambe, velocitaRilevamento, ekelundGambe, residuiMATE, daPolare, inPolare, avanzaStato, norm360,
  osservabilita,
} from '../../shared/tma.js';

/** @typedef {import('./stato.js').StatoClient} StatoClient */
/** @typedef {import('./stato.js').PuntoStoria} PuntoStoria */
/** @typedef {import('./stato.js').Soluzione} Soluzione */
/** @typedef {import('../../shared/tma.js').Misura} Misura */
/** @typedef {import('../../shared/tma.js').Gamba} Gamba */
/** @typedef {import('../../shared/tma.js').StatoCartesiano} StatoCartesiano */
/** @typedef {import('../../shared/tma.js').SoluzionePolare} SoluzionePolare */

/**
 * Deviazione standard nominale di un rilevamento della traccia, per sensore (gradi). Le tracce del
 * protocollo non la portano: questi sono i valori tipici di PROGETTO §5.6 a segnale buono (la sfera
 * ha un fascio di 9,8°, l'antenna di 3,5°). Contano solo come pesi relativi fra le misure.
 */
export const SIGMA_NOMINALE = Object.freeze(/** @type {Record<string, number>} */ ({ sfera: 1.5, towed: 1, periscopio: 0.5 }));

/**
 * Le misure di una traccia per shared/tma.js.
 * @param {PuntoStoria[]} storia @param {{ da?: number, a?: number }} [finestra]
 * @returns {Misura[]}
 */
export function misureDi(storia, finestra = {}) {
  const da = finestra.da ?? -Infinity, a = finestra.a ?? Infinity;
  return storia
    .filter((p) => p.ora >= da && p.ora <= a && Number.isFinite(p.rilevamento))
    .map((p) => ({ ora: p.ora, rilevamento: p.rilevamento, sigma: SIGMA_NOMINALE[p.sensore] ?? 1.5, x: p.x, y: p.y }));
}

/**
 * Le gambe del proprio moto (shared/tma.js trovaGambe) dalla traccia propria.
 * @param {{ ora: number, rotta: number, velocita: number }[]} traccia
 * @returns {Gamba[]}
 */
export function gambeProprie(traccia) {
  return traccia.length < 2 ? [] : trovaGambe(traccia.map((p) => ({ ora: p.ora, rotta: p.rotta, velocita: p.velocita })));
}

/**
 * Posizione propria a un'ora: interpolata sulla traccia (un punto ogni 10 s), o portata avanti in linea
 * retta dall'ultimo `stato`.
 * @param {StatoClient} s @param {number} ora
 * @returns {{ x: number, y: number } | null}
 */
export function proprioAllOra(s, ora) {
  const t = s.traccia;
  const n = s.nave;
  if (n && (t.length === 0 || ora >= t[t.length - 1].ora)) {
    const dt = ora - n.ora;
    const a = (n.rotta * Math.PI) / 180;
    const v = (n.velocita * 1852) / 3600;
    return { x: n.x + v * Math.sin(a) * dt, y: n.y + v * Math.cos(a) * dt };
  }
  if (t.length === 0) return null;
  if (ora <= t[0].ora) return { x: t[0].x, y: t[0].y };
  for (let i = 1; i < t.length; i++) {
    if (t[i].ora >= ora) {
      const p = t[i - 1], q = t[i];
      const f = q.ora > p.ora ? (ora - p.ora) / (q.ora - p.ora) : 0;
      return { x: p.x + f * (q.x - p.x), y: p.y + f * (q.y - p.y) };
    }
  }
  const u = t[t.length - 1];
  return { x: u.x, y: u.y };
}

/**
 * Lo stato cartesiano di una soluzione del server (`x`, `y` se ci sono; se no rilevamento e distanza
 * dalla posizione propria all'ora della soluzione; senza rilevamento, quello della storia più vicino).
 * @param {StatoClient} s @param {Soluzione} sol
 * @returns {StatoCartesiano | null}
 */
export function statoSoluzione(s, sol) {
  const v = (sol.velocita * 1852) / 3600;
  const c = (sol.rotta * Math.PI) / 180;
  if (sol.x !== null && sol.y !== null) return { ora: sol.ora, x: sol.x, y: sol.y, vx: v * Math.sin(c), vy: v * Math.cos(c) };
  const proprio = proprioAllOra(s, sol.ora);
  if (!proprio) return null;
  let ril = sol.rilevamento;
  if (ril === null) {
    const storia = s.storia[sol.contatto] ?? [];
    let migliore = null, dmin = Infinity;
    for (const p of storia) {
      const d = Math.abs(p.ora - sol.ora);
      if (d < dmin) { dmin = d; migliore = p.rilevamento; }
    }
    if (migliore === null) {
      const t = s.tracce.find((x) => x.contatto === sol.contatto);
      migliore = t ? t.rilevamento : null;
    }
    ril = migliore;
  }
  if (ril === null || !Number.isFinite(ril)) return null;
  return daPolare({ ora: sol.ora, rilevamento: ril, distanza: sol.distanza, rotta: sol.rotta, velocita: sol.velocita }, proprio);
}

/**
 * Dove sta il bersaglio di una soluzione all'ora data.
 * @param {StatoClient} s @param {Soluzione} sol @param {number} ora
 */
export function posizioneSoluzione(s, sol, ora) {
  const st = statoSoluzione(s, sol);
  return st ? avanzaStato(st, ora) : null;
}

/**
 * La soluzione di prova con cui si apre il MATE: quella del comandante o dell'equipaggio se c'è,
 * altrimenti l'ultimo rilevamento a 10 000 m, rotta perpendicolare, 10 nodi.
 * @param {StatoClient} s @param {string} contatto @param {number} ora
 * @returns {SoluzionePolare | null}
 */
export function provaIniziale(s, contatto, ora) {
  const proprio = proprioAllOra(s, ora);
  if (!proprio) return null;
  const sol = s.soluzioni[contatto];
  if (sol) {
    const st = posizioneSoluzione(s, sol, ora);
    if (st) return inPolare(st, proprio);
  }
  const storia = s.storia[contatto] ?? [];
  const t = s.tracce.find((x) => x.contatto === contatto);
  const ril = storia.length ? storia[storia.length - 1].rilevamento : t?.rilevamento;
  if (ril === undefined || !Number.isFinite(ril)) return null;
  return { ora, rilevamento: ril, distanza: 10000, rotta: norm360(ril + 90), velocita: 10 };
}

/**
 * La prova polare del MATE nello stato cartesiano (riferita alla posizione propria a quell'ora).
 * @param {StatoClient} s @param {SoluzionePolare} prova
 */
export function provaInStato(s, prova) {
  const proprio = proprioAllOra(s, prova.ora);
  return proprio ? daPolare(prova, proprio) : null;
}

/**
 * Tutti gli strumenti della vista TMA per una traccia: misure, gambe, velocità di variazione del
 * rilevamento sull'ultima gamba (o sugli ultimi 5 minuti), Ekelund su ogni cambio di gamba, residui di
 * una prova, osservabilità.
 * @param {StatoClient} s @param {string} contatto @param {SoluzionePolare | null} prova
 */
export function strumenti(s, contatto, prova) {
  const misure = misureDi(s.storia[contatto] ?? []);
  const gambe = gambeProprie(s.traccia);
  const ultima = gambe[gambe.length - 1];
  const fine = misure.length ? misure[misure.length - 1].ora : 0;
  const finestra = ultima && fine - ultima.da >= 60 ? { da: ultima.da + 30, a: fine } : { da: fine - 300, a: fine };
  const variazione = misure.length >= 2 ? velocitaRilevamento(misure, finestra) : null;
  const ekelund = misure.length >= 12 && gambe.length >= 2 ? ekelundGambe(misure, gambe) : [];
  const st = prova ? provaInStato(s, prova) : null;
  const residui = st && misure.length ? residuiMATE(misure, st, { gambe }) : null;
  const oss = misure.length >= 3 ? osservabilita(misure) : null;
  return { misure, gambe, variazione, ekelund, residui, osservabilita: oss };
}
