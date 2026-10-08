// @ts-check
/**
 * Lo stato del client: quello che il proprio battello sa, costruito SOLO dai messaggi del server
 * (protocollo v1, docs/PROTOCOLLO.md) e dagli ordini che il giocatore ha dato.
 *
 * `riduci(stato, messaggio)` è una funzione pura: non tocca lo stato vecchio, non legge il DOM, non
 * conosce l'ora del browser. Il resto del client (resa, ingressi) legge lo stato e manda ordini.
 *
 * Nebbia di guerra (PROTOCOLLO.md, regola 4): qui non c'è e non ci può essere la posizione di un altro
 * battello. I contatti sono solo picchi di energia per settore di rilevamento, e le designazioni
 * dell'equipaggio (S1, S2…) nei rapporti.
 */
import { DAL_SERVER, SONAR, decodificaSettori, WAYPOINT_MAX } from '../../shared/protocol.js';

export { WAYPOINT_MAX };

/** Fotogrammi sonar tenuti in memoria (la cascata più alta ne mostra 79). */
export const SONAR_MAX = 120;
/** Punti della traccia propria: uno ogni 10 s di gioco, per due ore. */
export const TRACCIA_PASSO_S = 10;
export const TRACCIA_MAX = 720;
/** Rapporti tenuti (il nastro li consuma per id). */
const RAPPORTI_MAX = 50;

/**
 * @typedef {{ x0: number, y0: number, x1: number, y1: number }} Area
 * @typedef {{ id: string, scenario: string, ora: number, scala_tempo: number, in_pausa: boolean,
 *   tempo_modificabile: boolean, origine: { lat: number, lon: number } | null, area: Area | null,
 *   battello: { piattaforma: string, nome: string, sigla: string } }} Partita
 * @typedef {{ stato: string, filato_m: number, quota: number | null, tempo_morto: number, sorda: boolean }} Towed
 * @typedef {{ ora: number, x: number, y: number, z: number, rotta: number, velocita: number,
 *   velocita_verticale: number, macchina: string, timone: number, timoni_o: number,
 *   rotta_ordinata: number | null, quota_ordinata: number | null, modo_quota: string,
 *   autopilota: { attivo: boolean, waypoint: { x: number, y: number }[], prossimo: number | null },
 *   cavitazione: boolean, v_cavitazione: number, towed: Towed | null, fondale: number | null,
 *   profondita_acqua: number | null, strato: number | null, avvisi: string[] }} Nave
 * @typedef {{ settori: Uint8Array, ciechi: Uint8Array, asse: number | null, sorda: boolean }} Sensore
 *   settori e ciechi per settore di rilevamento VERO (180 da 2°)
 * @typedef {{ ora: number, rotta: number, sfera: Sensore | null, towed: Sensore | null }} FotogrammaSonar
 *   un secondo di gioco: i due sensori arrivano in messaggi separati con la stessa `ora`
 * @typedef {{ id: number, chiave: string, parametri: Record<string, unknown>, chi: string, ora: number | null }} Rapporto
 * @typedef {{ n: number, cosa: string, valore: unknown }} OrdineInViaggio
 */
/**
 * @typedef {object} StatoClient
 * @property {{ uid: number, nome: string } | null} utente
 * @property {Partita | null} partita
 * @property {Nave | null} nave
 * @property {FotogrammaSonar[]} sonar dal più recente
 * @property {{ ora: number, x: number, y: number }[]} traccia dalla più vecchia
 * @property {Rapporto[]} rapporti gli ultimi arrivati (il nastro li consuma per id)
 * @property {number} prossimoRapporto
 * @property {{ autopilota: boolean, waypoint: { x: number, y: number }[] }} ordinati
 *   specchio locale degli ordini, valido finché il prossimo `stato` non dice la sua
 * @property {OrdineInViaggio[]} inViaggio ordini mandati e non ancora ricevuti o respinti
 * @property {number} prossimoOrdine numero `n` del prossimo ordine
 * @property {string | null} errore ultimo codice d'errore del server
 * @property {string | null} uscita motivo dell'ultima `uscita` (il battello non è più nostro)
 */

/** @returns {StatoClient} */
export function statoIniziale() {
  return {
    utente: null,
    partita: null,
    nave: null,
    sonar: [],
    traccia: [],
    rapporti: [],
    prossimoRapporto: 1,
    ordinati: { autopilota: false, waypoint: [] },
    inViaggio: [],
    prossimoOrdine: 1,
    errore: null,
    uscita: null,
  };
}

/** @param {unknown} v @param {number} [d] */
function num(v, d = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/** @param {unknown} v */
function numONull(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Archi ciechi [da, a] (gradi veri, in senso orario) → maschera dei 180 settori: un settore è cieco
 * se il suo centro cade nell'arco.
 * @param {unknown} archi
 */
export function mascheraCiechi(archi) {
  const m = new Uint8Array(SONAR.SETTORI);
  if (!Array.isArray(archi)) return m;
  for (const a of archi) {
    if (!Array.isArray(a) || a.length !== 2) continue;
    const da = num(a[0]), fino = num(a[1]);
    let ampiezza = ((fino - da) % 360 + 360) % 360;
    if (ampiezza === 0 && fino !== da) ampiezza = 360;
    if (fino - da >= 360) ampiezza = 360;
    for (let k = 0; k < SONAR.SETTORI; k++) {
      const c = k * SONAR.AMPIEZZA_SETTORE + SONAR.AMPIEZZA_SETTORE / 2;
      const d = ((c - da) % 360 + 360) % 360;
      if (ampiezza >= 360 || d <= ampiezza) m[k] = 1;
    }
  }
  return m;
}

/** @param {unknown} v */
function nave(v) {
  const m = /** @type {Record<string, any>} */ (v);
  const ap = m.autopilota && typeof m.autopilota === 'object' ? m.autopilota : {};
  const wp = Array.isArray(ap.waypoint)
    ? ap.waypoint.filter((/** @type {unknown} */ p) => Array.isArray(p) && p.length === 2).map((/** @type {number[]} */ p) => ({ x: num(p[0]), y: num(p[1]) }))
    : [];
  const tw = m.towed && typeof m.towed === 'object' ? m.towed : null;
  /** @type {Nave} */
  const n = {
    ora: num(m.ora),
    x: num(m.x),
    y: num(m.y),
    z: num(m.z),
    rotta: num(m.rotta),
    velocita: num(m.velocita),
    velocita_verticale: num(m.velocita_verticale),
    macchina: String(m.macchina ?? 'stop'),
    timone: num(m.timone),
    timoni_o: num(m.timoni_o),
    rotta_ordinata: numONull(m.rotta_ordinata),
    quota_ordinata: numONull(m.quota_ordinata),
    modo_quota: String(m.modo_quota ?? 'manuale'),
    autopilota: { attivo: ap.attivo === true, waypoint: wp, prossimo: numONull(ap.prossimo) },
    cavitazione: m.cavitazione === true,
    v_cavitazione: num(m.v_cavitazione),
    towed: tw
      ? { stato: String(tw.stato ?? 'stivata'), filato_m: num(tw.filato_m), quota: numONull(tw.quota),
        tempo_morto: num(tw.tempo_morto), sorda: tw.sorda === true }
      : null,
    fondale: numONull(m.fondale),
    profondita_acqua: numONull(m.profondita_acqua),
    strato: numONull(m.strato),
    avvisi: Array.isArray(m.avvisi) ? m.avvisi.map(String) : [],
  };
  return n;
}

/**
 * Applica un messaggio del server (o un'azione locale: `locale`, `ordine`) e restituisce lo stato nuovo.
 * @param {StatoClient} s
 * @param {{ t: string, [k: string]: unknown }} m
 * @returns {StatoClient}
 */
export function riduci(s, m) {
  switch (m.t) {
    case DAL_SERVER.BENVENUTO: {
      const u = /** @type {{uid?: number, nome?: string}} */ (m.utente ?? {});
      return { ...s, utente: { uid: num(u.uid), nome: String(u.nome ?? '') }, errore: null };
    }
    case DAL_SERVER.PARTITA: {
      const o = /** @type {any} */ (m.origine);
      const a = /** @type {any} */ (m.area);
      const b = /** @type {any} */ (m.battello ?? {});
      /** @type {Partita} */
      const partita = {
        id: String(m.id ?? ''),
        scenario: String(m.scenario ?? ''),
        ora: num(m.ora),
        scala_tempo: num(m.scala_tempo, 1),
        in_pausa: m.in_pausa === true,
        tempo_modificabile: m.tempo_modificabile === true,
        origine: o && Number.isFinite(o.lat) && Number.isFinite(o.lon) ? { lat: o.lat, lon: o.lon } : null,
        area: a && [a.x0, a.y0, a.x1, a.y1].every(Number.isFinite) ? { x0: a.x0, y0: a.y0, x1: a.x1, y1: a.y1 } : null,
        battello: { piattaforma: String(b.piattaforma ?? ''), nome: String(b.nome ?? ''), sigla: String(b.sigla ?? '') },
      };
      // partita nuova: si riparte da zero con cascata, traccia e ordini
      const nuova = !s.partita || s.partita.id !== partita.id;
      return nuova
        ? { ...s, partita, nave: null, sonar: [], traccia: [], ordinati: { autopilota: false, waypoint: [] }, inViaggio: [], uscita: null }
        : { ...s, partita, uscita: null };
    }
    case DAL_SERVER.TEMPO: {
      if (!s.partita) return s;
      return {
        ...s,
        partita: {
          ...s.partita,
          ora: num(m.ora, s.partita.ora),
          scala_tempo: num(m.scala_tempo, s.partita.scala_tempo),
          in_pausa: m.in_pausa === true,
          tempo_modificabile: m.tempo_modificabile === true,
        },
      };
    }
    case DAL_SERVER.STATO: {
      const n = nave(m);
      let traccia = s.traccia;
      const ultimo = traccia[traccia.length - 1];
      if (!ultimo || n.ora < ultimo.ora) traccia = [{ ora: n.ora, x: n.x, y: n.y }];
      else if (n.ora - ultimo.ora >= TRACCIA_PASSO_S) {
        traccia = traccia.concat([{ ora: n.ora, x: n.x, y: n.y }]);
        if (traccia.length > TRACCIA_MAX) traccia = traccia.slice(traccia.length - TRACCIA_MAX);
      }
      // dal server: l'autopilota e i waypoint veri sostituiscono lo specchio locale
      const ordinati = { autopilota: n.autopilota.attivo, waypoint: n.autopilota.waypoint };
      return { ...s, nave: n, traccia, ordinati };
    }
    case DAL_SERVER.SONAR: {
      const sensore = m.sensore === 'towed' ? 'towed' : m.sensore === 'sfera' ? 'sfera' : null;
      const settori = decodificaSettori(/** @type {string} */ (m.settori));
      if (!sensore || !settori) return s;
      const ora = num(m.ora);
      /** @type {Sensore} */
      const dati = { settori, ciechi: mascheraCiechi(m.ciechi), asse: numONull(m.asse), sorda: m.sorda === true };
      const primo = s.sonar[0];
      if (primo && primo.ora === ora) {
        return { ...s, sonar: [{ ...primo, [sensore]: dati }, ...s.sonar.slice(1)] };
      }
      /** @type {FotogrammaSonar} */
      const f = { ora, rotta: s.nave?.rotta ?? 0, sfera: null, towed: null, [sensore]: dati };
      return { ...s, sonar: [f, ...s.sonar].slice(0, SONAR_MAX) };
    }
    case DAL_SERVER.RAPPORTO:
    case 'locale': {
      /** @type {Rapporto} */
      const r = {
        id: s.prossimoRapporto,
        chiave: String(m.chiave ?? ''),
        parametri: /** @type {Record<string, unknown>} */ (m.parametri && typeof m.parametri === 'object' ? m.parametri : {}),
        chi: String(m.chi ?? ''),
        ora: typeof m.ora === 'number' ? m.ora : s.nave?.ora ?? null,
      };
      return { ...s, rapporti: [...s.rapporti, r].slice(-RAPPORTI_MAX), prossimoRapporto: s.prossimoRapporto + 1 };
    }
    case DAL_SERVER.RICEVUTO:
      return { ...s, inViaggio: s.inViaggio.filter((o) => o.n !== m.n) };
    case DAL_SERVER.ERRORE: {
      const inViaggio = m.n === undefined ? s.inViaggio : s.inViaggio.filter((o) => o.n !== m.n);
      return { ...s, errore: String(m.codice ?? 'errore'), inViaggio };
    }
    case DAL_SERVER.USCITA:
      // il battello non è più nostro: quello che sapeva se ne va con lui
      return { ...s, uscita: String(m.motivo ?? ''), nave: null, traccia: [], sonar: [], ordinati: { autopilota: false, waypoint: [] } };
    case 'ordine': {
      // l'ordine appena mandato: in viaggio fino a `ricevuto`/`errore`, e lo specchio locale per
      // vedere subito autopilota e waypoint (lo `stato` successivo lo corregge)
      const n = num(m.n, s.prossimoOrdine);
      const inViaggio = [...s.inViaggio, { n, cosa: String(m.cosa), valore: m.valore }].slice(-20);
      const base = { ...s, inViaggio, prossimoOrdine: Math.max(s.prossimoOrdine, n + 1) };
      const cosa = m.cosa, valore = /** @type {any} */ (m.valore);
      if (cosa === 'autopilota') return { ...base, ordinati: { ...s.ordinati, autopilota: valore === true } };
      if (cosa === 'waypoint' && valore && typeof valore === 'object') {
        if (valore.azione === 'svuota') return { ...base, ordinati: { autopilota: false, waypoint: [] } };
        if (valore.azione === 'aggiungi' && s.ordinati.waypoint.length < WAYPOINT_MAX) {
          return { ...base, ordinati: { ...s.ordinati, waypoint: [...s.ordinati.waypoint, { x: num(valore.x), y: num(valore.y) }] } };
        }
        if (valore.azione === 'togli') {
          return { ...base, ordinati: { ...s.ordinati, waypoint: s.ordinati.waypoint.filter((_, i) => i !== valore.indice) } };
        }
      }
      if ((cosa === 'timone' || cosa === 'rotta') && s.ordinati.autopilota) return { ...base, ordinati: { ...s.ordinati, autopilota: false } };
      return base;
    }
    default:
      return s;
  }
}

/**
 * L'ordine in viaggio a cui si riferisce un errore (per dire «quale» ordine è stato respinto).
 * @param {StatoClient} s @param {unknown} n
 */
export function ordineInViaggio(s, n) {
  return s.inViaggio.find((o) => o.n === n) ?? null;
}
