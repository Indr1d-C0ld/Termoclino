// @ts-check
/**
 * Lo stato del client: quello che il proprio battello sa, costruito SOLO dai messaggi del server
 * (protocollo v2, docs/PROTOCOLLO.md) e dagli ordini che il giocatore ha dato.
 *
 * `riduci(stato, messaggio)` è una funzione pura: non tocca lo stato vecchio, non legge il DOM, non
 * conosce l'ora del browser. Il resto del client (resa, ingressi) legge lo stato e manda ordini.
 *
 * Nebbia di guerra (PROTOCOLLO.md, regola 4): qui non c'è e non ci può essere la posizione vera di un
 * altro battello. I contatti sono picchi di energia per settore di rilevamento, spettri del fascio
 * dell'analizzatore, echi e intercettazioni con le loro misure, avvistamenti del periscopio (rilevamento,
 * aspetto e angolo d'albero misurati), emissioni radar sentite dall'ESM, e le tracce e le soluzioni
 * dell'equipaggio: ipotesi, mai la verità (salvo la soluzione «esatta» del livello 3, che il server
 * manda solo per i contatti non umani).
 */
import {
  DAL_SERVER, SONAR, decodificaSettori, decodificaSpettro, decodificaDemon, WAYPOINT_MAX,
} from '../../shared/protocol.js';
import { nodiInMs } from '../../shared/units.js';

export { WAYPOINT_MAX };

/** Fotogrammi a banda stretta tenuti (uno ogni 4 s di gioco). */
export const STRETTA_MAX = 60;
/** Righe dell'analizzatore tenute (una ogni 4 s di gioco: un quarto d'ora). */
export const SPETTRI_MAX = 240;
/** Echi, intercettazioni e transitori tenuti (i più recenti). */
export const EVENTI_MAX = 40;
/** Punti tempo-rilevamento tenuti per traccia (uno ogni 4 s: due ore). */
export const STORIA_MAX = 1800;

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
 *   profondita_acqua: number | null, strato: number | null, avvisi: string[],
 *   alberi: Alberi, radar_attivo: boolean, ascolto_attivo: number, assistenza: number | null, analizzatore: Analizzatore,
 *   designato: string | null }} Nave
 * @typedef {{ settori: Uint8Array, ciechi: Uint8Array, asse: number | null, sorda: boolean }} Sensore
 *   settori e ciechi per settore di rilevamento VERO (180 da 2°)
 * @typedef {{ ora: number, rotta: number, sfera: Sensore | null, towed: Sensore | null }} FotogrammaSonar
 *   un secondo di gioco: i due sensori arrivano in messaggi separati con la stessa `ora`
 * @typedef {{ id: number, chiave: string, parametri: Record<string, unknown>, chi: string, ora: number | null }} Rapporto
 * @typedef {{ n: number, cosa: string, valore: unknown }} OrdineInViaggio
 * @typedef {{ periscopio: boolean, esm: boolean, radar: boolean }} Alberi
 * @typedef {{ sensore: string | null, rilevamento: number | null, contatto: string | null } | null} Analizzatore
 *   dove punta il fascio dell'analizzatore (null = spento)
 * @typedef {{ ora: number, sensore: string, rilevamento: number, contatto: string | null, da_hz: number, passo_hz: number,
 *   righe: Uint8Array, demon: Uint8Array | null, demon_da_hz: number, demon_passo_hz: number, asse: number | null,
 *   sorda: boolean }} Spettro
 *   una riga dell'analizzatore: SE quantizzato per cella di frequenza (q come nei fotogrammi `sonar`)
 * @typedef {{ ora: number, rilevamento: number, distanza: number, forza: number }} Eco
 * @typedef {{ numero: number, ora: number, riverbero: number | null, echi: Eco[] }} Ping
 *   gli echi di un proprio ping (`eco.ping`), arrivati uno per messaggio; `ora` = arrivo del primo
 * @typedef {{ ora: number, rilevamento: number, tipo: string, frequenza_khz: number | null, livello: number | null }} Intercetto
 * @typedef {{ ora: number, sensore: string, rilevamento: number, speculare: number | null, tipo: string,
 *   forza: number | null }} Transitorio
 * @typedef {{ vista: number, rilevamento: number, aspetto: number | null, sagoma: string | null,
 *   elevazione_alberi: number | null, luci: string[] | null, sotto_orizzonte: boolean, scia: boolean }} Avvistamento
 *   `sagoma` null = un albero o un periscopio senza figura; `luci`: le luci di navigazione viste di notte
 *   (LUCI del protocollo), null di giorno
 * @typedef {{ ora: number, echi: { rilevamento: number, distanza: number }[] }} Radar
 * @typedef {{ ora: number, oggetti: Avvistamento[], luce: string | null }} Visivo
 * @typedef {{ autopilota: boolean, waypoint: { x: number, y: number }[], designato: string | null,
 *   classifiche: Record<string, string | null> }} Ordinati
 *   `classifiche`: le classificazioni del comandante (ordine `classifica`), che prevalgono su quelle
 *   dell'equipaggio; restano finché la traccia non si abbandona
 * @typedef {{ rilevamento: number, tipo: string, banda: string, livello: number }} Emissione
 * @typedef {{ ora: number, emissioni: Emissione[] }} Esm
 * @typedef {{ contatto: string, sensori: string[], rilevamento: number, variazione: number | null, classe: string | null,
 *   confidenza: number | null, stato: string, speculare: number | null, classe_comandante: string | null }} Traccia
 * @typedef {{ ora: number, rilevamento: number, x: number, y: number, rotta: number, sensore: string }} PuntoStoria
 *   un rilevamento misurato della traccia, con la posizione e la rotta proprie in quel momento (per la TMA)
 * @typedef {{ contatto: string, ora: number, distanza: number, rotta: number, velocita: number, q: number | null,
 *   ellisse: { asse_lungo: number, asse_corto: number, orientamento: number } | null, origine: string,
 *   esatta: boolean, rilevamento: number | null, x: number | null, y: number | null }} Soluzione
 */
/**
 * @typedef {object} StatoClient
 * @property {{ uid: number, nome: string } | null} utente
 * @property {Partita | null} partita
 * @property {Nave | null} nave
 * @property {FotogrammaSonar[]} sonar banda larga, dal più recente
 * @property {FotogrammaSonar[]} sonarStretta banda stretta (la riga tonale più forte per settore, ogni 4 s), dal più recente
 * @property {{ ora: number, x: number, y: number, rotta: number, velocita: number }[]} traccia dalla più vecchia
 *   (con rotta e velocità: le gambe del proprio moto per la TMA)
 * @property {Rapporto[]} rapporti gli ultimi arrivati (il nastro li consuma per id)
 * @property {number} prossimoRapporto
 * @property {Ordinati} ordinati specchio locale degli ordini, valido finché il prossimo `stato` non dice la sua
 * @property {OrdineInViaggio[]} inViaggio ordini mandati e non ancora ricevuti o respinti
 * @property {number} prossimoOrdine numero `n` del prossimo ordine
 * @property {string | null} errore ultimo codice d'errore del server
 * @property {string | null} uscita motivo dell'ultima `uscita` (il battello non è più nostro)
 * @property {Spettro[]} spettri righe dell'analizzatore, dalla più recente
 * @property {Ping[]} ping i propri ping con i loro echi, dal più recente
 * @property {Intercetto[]} intercetti emissioni attive altrui sentite, dalla più recente
 * @property {Transitorio[]} transitori dal più recente
 * @property {Visivo | null} visivo ultimo fotogramma del periscopio (null = abbassato o niente in vista)
 * @property {Esm | null} esm ultimo fotogramma dell'ESM
 * @property {Radar | null} radar ultimo giro d'antenna del proprio radar
 * @property {number | null} oraTracce `ora` dell'ultimo messaggio `tracce`
 * @property {Traccia[]} tracce le tracce dell'equipaggio nell'ultimo messaggio
 * @property {Record<string, PuntoStoria[]>} storia punti tempo-rilevamento per traccia, dal più vecchio
 * @property {Record<string, Soluzione>} soluzioni l'ultima soluzione per traccia (equipaggio, comandante o esatta)
 */

/** @returns {StatoClient} */
export function statoIniziale() {
  return {
    utente: null,
    partita: null,
    nave: null,
    sonar: [],
    sonarStretta: [],
    traccia: [],
    rapporti: [],
    prossimoRapporto: 1,
    ordinati: ordinatiAZero(),
    inViaggio: [],
    prossimoOrdine: 1,
    errore: null,
    uscita: null,
    spettri: [],
    ping: [],
    intercetti: [],
    transitori: [],
    visivo: null,
    esm: null,
    radar: null,
    oraTracce: null,
    tracce: [],
    storia: {},
    soluzioni: {},
  };
}

/** @returns {Ordinati} */
function ordinatiAZero() {
  return { autopilota: false, waypoint: [], designato: null, classifiche: {} };
}

/** I campi della partita che ripartono da zero con una partita nuova o con un'uscita. */
function sensoriAZero() {
  return {
    sonarStretta: [], spettri: [], ping: [], intercetti: [], transitori: [], visivo: null, esm: null, radar: null,
    oraTracce: null, tracce: [], storia: {}, soluzioni: {},
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
    alberi: {
      periscopio: m.alberi?.periscopio === true,
      esm: m.alberi?.esm === true,
      radar: m.alberi?.radar === true,
    },
    radar_attivo: m.radar_attivo === true,
    ascolto_attivo: num(m.ascolto_attivo),
    assistenza: numONull(m.assistenza),
    analizzatore: analizzatore(m.analizzatore),
    designato: typeof m.designato === 'string' && m.designato ? m.designato : null,
  };
  return n;
}

/** @param {unknown} v @returns {Analizzatore} */
function analizzatore(v) {
  if (!v || typeof v !== 'object') return null;
  const a = /** @type {Record<string, unknown>} */ (v);
  return {
    sensore: typeof a.sensore === 'string' ? a.sensore : null,
    rilevamento: numONull(a.rilevamento),
    contatto: typeof a.contatto === 'string' ? a.contatto : null,
  };
}

/** @param {unknown} v @returns {string} */
function testo(v) {
  return typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v);
}

/** @param {unknown} v @returns {Traccia | null} */
function traccia(v) {
  if (!v || typeof v !== 'object') return null;
  const t = /** @type {Record<string, any>} */ (v);
  const contatto = testo(t.contatto);
  const ril = numONull(t.rilevamento);
  if (!contatto) return null;
  return {
    contatto,
    sensori: Array.isArray(t.sensori) ? t.sensori.map(String) : typeof t.sensori === 'string' ? [t.sensori] : [],
    rilevamento: ril ?? NaN,
    variazione: numONull(t.variazione),
    classe: typeof t.classe === 'string' && t.classe ? t.classe : null,
    confidenza: numONull(t.confidenza),
    stato: testo(t.stato) || 'tenuta',
    speculare: numONull(t.speculare),
    classe_comandante: typeof t.classe_comandante === 'string' && t.classe_comandante ? t.classe_comandante : null,
  };
}

/** @param {Record<string, any>} m @returns {Soluzione | null} */
function soluzione(m) {
  const contatto = testo(m.contatto);
  if (!contatto) return null;
  const e = m.ellisse && typeof m.ellisse === 'object' ? m.ellisse : null;
  return {
    contatto,
    ora: num(m.ora),
    distanza: num(m.distanza),
    rotta: num(m.rotta),
    velocita: num(m.velocita),
    q: numONull(m.q),
    ellisse: e && [e.asse_lungo, e.asse_corto, e.orientamento].every(Number.isFinite)
      ? { asse_lungo: e.asse_lungo, asse_corto: e.asse_corto, orientamento: e.orientamento } : null,
    origine: testo(m.origine) || 'equipaggio',
    esatta: m.esatta === true,
    rilevamento: numONull(m.rilevamento),
    x: numONull(m.x),
    y: numONull(m.y),
  };
}

/**
 * Posizione e rotta proprie a un'ora di gioco: dall'ultimo `stato`, portato avanti (o indietro) in linea
 * retta per la differenza d'ora (al più qualche secondo: lo `stato` arriva a 4 Hz di tempo reale).
 * @param {Nave | null} n @param {number} ora
 */
function proprioA(n, ora) {
  if (!n) return null;
  const dt = Math.max(-30, Math.min(30, ora - n.ora));
  const a = (n.rotta * Math.PI) / 180;
  const v = nodiInMs(n.velocita);
  return { x: n.x + v * Math.sin(a) * dt, y: n.y + v * Math.cos(a) * dt, rotta: n.rotta };
}

/** @template T @param {T[]} lista @param {T} nuovo @param {number} max */
function inTesta(lista, nuovo, max) {
  return [nuovo, ...lista].slice(0, max);
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
        ? { ...s, partita, nave: null, sonar: [], traccia: [], ordinati: ordinatiAZero(), inViaggio: [], uscita: null, ...sensoriAZero() }
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
      const punto = { ora: n.ora, x: n.x, y: n.y, rotta: n.rotta, velocita: n.velocita };
      if (!ultimo || n.ora < ultimo.ora) traccia = [punto];
      else if (n.ora - ultimo.ora >= TRACCIA_PASSO_S) {
        traccia = traccia.concat([punto]);
        if (traccia.length > TRACCIA_MAX) traccia = traccia.slice(traccia.length - TRACCIA_MAX);
      }
      // dal server: l'autopilota, i waypoint e il contatto designato veri sostituiscono lo specchio locale
      const ordinati = {
        ...s.ordinati,
        autopilota: n.autopilota.attivo,
        waypoint: n.autopilota.waypoint,
        designato: 'designato' in m ? n.designato : s.ordinati.designato,
      };
      return { ...s, nave: n, traccia, ordinati };
    }
    case DAL_SERVER.SONAR: {
      const sensore = m.sensore === 'towed' ? 'towed' : m.sensore === 'sfera' ? 'sfera' : null;
      const settori = decodificaSettori(/** @type {string} */ (m.settori));
      if (!sensore || !settori) return s;
      const ora = num(m.ora);
      /** @type {Sensore} */
      const dati = { settori, ciechi: mascheraCiechi(m.ciechi), asse: numONull(m.asse), sorda: m.sorda === true };
      // banda larga (F1, senza `banda`) e banda stretta (v2) in due storie separate
      const stretta = m.banda === 'stretta';
      const lista = stretta ? s.sonarStretta : s.sonar;
      const campo = stretta ? 'sonarStretta' : 'sonar';
      const primo = lista[0];
      if (primo && primo.ora === ora) {
        return { ...s, [campo]: [{ ...primo, [sensore]: dati }, ...lista.slice(1)] };
      }
      /** @type {FotogrammaSonar} */
      const f = { ora, rotta: s.nave?.rotta ?? 0, sfera: null, towed: null, [sensore]: dati };
      return { ...s, [campo]: [f, ...lista].slice(0, stretta ? STRETTA_MAX : SONAR_MAX) };
    }
    case DAL_SERVER.SPETTRO: {
      // la lunghezza delle righe è quella della finestra del sensore (SPETTRO del protocollo)
      const righe = decodificaSpettro({ sensore: String(m.sensore), righe: m.righe });
      if (!righe) return s;
      const demon = decodificaDemon({ sensore: String(m.sensore), demon: m.demon });
      /** @type {Spettro} */
      const r = {
        ora: num(m.ora),
        sensore: testo(m.sensore) || 'sfera',
        rilevamento: num(m.rilevamento),
        contatto: typeof m.contatto === 'string' && m.contatto ? m.contatto : null,
        da_hz: num(m.da_hz),
        passo_hz: num(m.passo_hz, 1),
        righe,
        demon,
        demon_da_hz: num(m.demon_da_hz),
        demon_passo_hz: num(m.demon_passo_hz, 0.1),
        asse: numONull(m.asse),
        sorda: m.sorda === true,
      };
      return { ...s, spettri: inTesta(s.spettri, r, SPETTRI_MAX) };
    }
    case DAL_SERVER.ECO: {
      // un messaggio per eco sopra soglia, all'ora d'arrivo; `ping` dice di quale proprio ping
      const r = numONull(m.rilevamento), d = numONull(m.distanza);
      if (r === null || d === null) return s;
      const numero = num(m.ping);
      /** @type {Eco} */
      const e = { ora: num(m.ora), rilevamento: r, distanza: d, forza: num(m.forza) };
      const i = s.ping.findIndex((p) => p.numero === numero);
      if (i >= 0) {
        const p = s.ping[i];
        const nuovo = { ...p, echi: [...p.echi, e], riverbero: numONull(m.riverbero) ?? p.riverbero };
        return { ...s, ping: s.ping.map((x, k) => (k === i ? nuovo : x)) };
      }
      /** @type {Ping} */
      const p = { numero, ora: e.ora, riverbero: numONull(m.riverbero), echi: [e] };
      return { ...s, ping: inTesta(s.ping, p, EVENTI_MAX) };
    }
    case DAL_SERVER.INTERCETTO: {
      const r = numONull(m.rilevamento);
      if (r === null) return s;
      /** @type {Intercetto} */
      const i = { ora: num(m.ora), rilevamento: r, tipo: testo(m.tipo) || 'ping', frequenza_khz: numONull(m.frequenza_khz), livello: numONull(m.livello) };
      return { ...s, intercetti: inTesta(s.intercetti, i, EVENTI_MAX) };
    }
    case DAL_SERVER.TRANSITORIO: {
      const r = numONull(m.rilevamento);
      if (r === null) return s;
      /** @type {Transitorio} */
      const tr = {
        ora: num(m.ora), sensore: testo(m.sensore) || 'sfera', rilevamento: r, speculare: numONull(m.speculare),
        tipo: testo(m.tipo) || 'sconosciuto', forza: numONull(m.forza),
      };
      return { ...s, transitori: inTesta(s.transitori, tr, EVENTI_MAX) };
    }
    case DAL_SERVER.VISIVO: {
      /** @type {Avvistamento[]} */
      const oggetti = [];
      for (const o of Array.isArray(m.oggetti) ? m.oggetti : []) {
        const r = numONull(o?.rilevamento);
        if (r === null) continue;
        oggetti.push({
          vista: num(o.vista), rilevamento: r, aspetto: numONull(o.aspetto),
          sagoma: typeof o.sagoma === 'string' && o.sagoma ? o.sagoma : null,
          elevazione_alberi: numONull(o.elevazione_alberi), luci: Array.isArray(o.luci) ? o.luci.map(String) : null,
          sotto_orizzonte: o.sotto_orizzonte === true, scia: o.scia === true,
        });
      }
      return { ...s, visivo: { ora: num(m.ora), oggetti, luce: typeof m.luce === 'string' ? m.luce : null } };
    }
    case DAL_SERVER.ESM: {
      /** @type {Emissione[]} */
      const emissioni = [];
      for (const e of Array.isArray(m.emissioni) ? m.emissioni : []) {
        const r = numONull(e?.rilevamento);
        if (r === null) continue;
        emissioni.push({ rilevamento: r, tipo: testo(e.tipo), banda: testo(e.banda), livello: num(e.livello) });
      }
      return { ...s, esm: { ora: num(m.ora), emissioni } };
    }
    case DAL_SERVER.RADAR: {
      /** @type {Radar['echi']} */
      const echi = [];
      for (const e of Array.isArray(m.echi) ? m.echi : []) {
        const r = numONull(e?.rilevamento), d = numONull(e?.distanza);
        if (r !== null && d !== null) echi.push({ rilevamento: r, distanza: d });
      }
      return { ...s, radar: { ora: num(m.ora), echi } };
    }
    case DAL_SERVER.TRACCE: {
      const ora = num(m.ora);
      const tracce = /** @type {Traccia[]} */ ((Array.isArray(m.tracce) ? m.tracce : []).map(traccia).filter(Boolean));
      // la storia tempo-rilevamento di ogni traccia tenuta, con la propria posizione in quel momento
      const storia = { ...s.storia };
      const proprio = proprioA(s.nave, ora);
      for (const t of tracce) {
        if (!Number.isFinite(t.rilevamento) || t.stato === 'persa' || !proprio) continue;
        const vecchia = storia[t.contatto] ?? [];
        const ultimo = vecchia[vecchia.length - 1];
        if (ultimo && ultimo.ora >= ora) continue;
        const punto = { ora, rilevamento: t.rilevamento, x: proprio.x, y: proprio.y, rotta: proprio.rotta, sensore: t.sensori[0] ?? '' };
        storia[t.contatto] = [...vecchia, punto].slice(-STORIA_MAX);
      }
      // le soluzioni delle tracce che l'equipaggio non tiene più se ne vanno con loro
      const tenute = new Set(tracce.map((t) => t.contatto));
      const soluzioni = Object.fromEntries(Object.entries(s.soluzioni).filter(([c]) => tenute.has(c)));
      return { ...s, oraTracce: ora, tracce, storia, soluzioni };
    }
    case DAL_SERVER.STORIA: {
      // chi rientra riceve i punti tenuti dall'equipaggio: si fondono con quelli che ci sono già
      const contatto = typeof m.contatto === 'string' ? m.contatto : '';
      if (!contatto || !Array.isArray(m.punti)) return s;
      /** @type {Map<number, PuntoStoria>} */
      const perOra = new Map((s.storia[contatto] ?? []).map((p) => [p.ora, p]));
      for (const p of m.punti) {
        const ora = numONull(p?.ora), r = numONull(p?.rilevamento), x = numONull(p?.x), y = numONull(p?.y), rotta = numONull(p?.rotta);
        if (ora === null || r === null || x === null || y === null || perOra.has(ora)) continue;
        perOra.set(ora, { ora, rilevamento: r, x, y, rotta: rotta ?? 0, sensore: '' });
      }
      const punti = [...perOra.values()].sort((a, b) => a.ora - b.ora).slice(-STORIA_MAX);
      return { ...s, storia: { ...s.storia, [contatto]: punti } };
    }
    case DAL_SERVER.SOLUZIONE: {
      const sol = soluzione(/** @type {Record<string, any>} */ (m));
      if (!sol) return s;
      const soluzioni = { ...s.soluzioni };
      if (m.cancella === true) delete soluzioni[sol.contatto];
      else soluzioni[sol.contatto] = sol;
      return { ...s, soluzioni };
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
    case DAL_SERVER.RICEVUTO: {
      const inViaggio = s.inViaggio.filter((o) => o.n !== m.n);
      const v = /** @type {any} */ (m.valore);
      // la soluzione del comandante cancellata (o una traccia abbandonata) non va più disegnata
      if ((m.cosa === 'soluzione' && v?.cancella === true) || m.cosa === 'abbandona') {
        const contatto = m.cosa === 'abbandona' ? v : v.contatto;
        const soluzioni = { ...s.soluzioni };
        if (typeof contatto === 'string' && (m.cosa === 'abbandona' || soluzioni[contatto]?.origine === 'comandante')) delete soluzioni[contatto];
        return { ...s, inViaggio, soluzioni };
      }
      return { ...s, inViaggio };
    }
    case DAL_SERVER.ERRORE: {
      const inViaggio = m.n === undefined ? s.inViaggio : s.inViaggio.filter((o) => o.n !== m.n);
      return { ...s, errore: String(m.codice ?? 'errore'), inViaggio };
    }
    case DAL_SERVER.USCITA:
      // il battello non è più nostro: quello che sapeva se ne va con lui
      return { ...s, uscita: String(m.motivo ?? ''), nave: null, traccia: [], sonar: [], ordinati: ordinatiAZero(), ...sensoriAZero() };
    case 'ordine': {
      // l'ordine appena mandato: in viaggio fino a `ricevuto`/`errore`, e lo specchio locale per
      // vedere subito autopilota e waypoint (lo `stato` successivo lo corregge)
      const n = num(m.n, s.prossimoOrdine);
      const inViaggio = [...s.inViaggio, { n, cosa: String(m.cosa), valore: m.valore }].slice(-20);
      const base = { ...s, inViaggio, prossimoOrdine: Math.max(s.prossimoOrdine, n + 1) };
      const cosa = m.cosa, valore = /** @type {any} */ (m.valore);
      if (cosa === 'autopilota') return { ...base, ordinati: { ...s.ordinati, autopilota: valore === true } };
      if (cosa === 'waypoint' && valore && typeof valore === 'object') {
        if (valore.azione === 'svuota') return { ...base, ordinati: { ...s.ordinati, autopilota: false, waypoint: [] } };
        if (valore.azione === 'aggiungi' && s.ordinati.waypoint.length < WAYPOINT_MAX) {
          return { ...base, ordinati: { ...s.ordinati, waypoint: [...s.ordinati.waypoint, { x: num(valore.x), y: num(valore.y) }] } };
        }
        if (valore.azione === 'togli') {
          return { ...base, ordinati: { ...s.ordinati, waypoint: s.ordinati.waypoint.filter((_, i) => i !== valore.indice) } };
        }
      }
      if ((cosa === 'timone' || cosa === 'rotta') && s.ordinati.autopilota) return { ...base, ordinati: { ...s.ordinati, autopilota: false } };
      if (cosa === 'designa') return { ...base, ordinati: { ...s.ordinati, designato: typeof valore === 'string' ? valore : null } };
      if (cosa === 'classifica' && valore && typeof valore.contatto === 'string') {
        return { ...base, ordinati: { ...s.ordinati, classifiche: { ...s.ordinati.classifiche, [valore.contatto]: valore.classe ?? null } } };
      }
      if (cosa === 'abbandona' && typeof valore === 'string') {
        const classifiche = { ...s.ordinati.classifiche };
        delete classifiche[valore];
        const designato = s.ordinati.designato === valore ? null : s.ordinati.designato;
        return { ...base, ordinati: { ...s.ordinati, classifiche, designato } };
      }
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
