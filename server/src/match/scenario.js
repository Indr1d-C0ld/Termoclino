// @ts-check
/**
 * Scenari: si leggono da shared/data/scenari/<id>.json (formato dello
 * scenario, scritto in parallelo con la batimetria) e si riducono alla forma
 * che serve al motore. Finche' il file non c'e', o per le parti che non ha,
 * vale lo scenario provvisorio qui sotto: la palestra di TORPEX '89 a nord-est
 * delle Fær Øer, con tre cacciatorpediniere su un circuito, un mercantile e tre
 * sorgenti biologiche.
 *
 * La lettura e' tollerante: accetta posizioni in metri sul piano locale
 * ({x, y}) o in coordinate geografiche ({lat, lon}, convertite con la
 * proiezione dello scenario), e nomi di campo alternativi ragionevoli.
 */

import { access } from 'node:fs/promises';
import { ProiezioneLocale } from '../../../shared/geo.js';
import { leggiTesto } from '../../../shared/data/piattaforme.js';

/** @typedef {{x: number, y: number}} Punto */

/**
 * @typedef {object} Partenza
 * @property {number} x @property {number} y @property {number} rotta
 * @property {number} quota @property {number} velocita
 */

/**
 * @typedef {object} NaveScenario
 * @property {'cacciatorpediniere' | 'mercantile'} classe
 * @property {string} nome
 * @property {number} x @property {number} y @property {number} rotta @property {number} velocita
 * @property {Punto[]} waypoint
 * @property {'ciclo' | 'ferma'} alTermine  dopo l'ultimo waypoint: si ricomincia dal punto di partenza, o ci si ferma
 */

/**
 * @typedef {object} BiologicoScenario
 * @property {number} x @property {number} y
 * @property {number} [quota] m
 * @property {number} [velocita] kt
 */

/**
 * @typedef {object} Scenario
 * @property {string} id
 * @property {string} nome
 * @property {'file' | 'provvisorio'} fonte
 * @property {{lat: number, lon: number}} origine
 * @property {{x0: number, y0: number, x1: number, y1: number}} area
 * @property {Partenza[]} partenze
 * @property {NaveScenario[]} navi
 * @property {BiologicoScenario[]} biologici
 * @property {import('../sim/world/ambiente.js').OpzioniProvvisorio} [ambiente]
 */

/**
 * La palestra provvisoria. Area di 80 km di lato; i punti di partenza su un
 * anello di 5 km di raggio, con la prua verso il centro: due giocatori vicini
 * partono a 5 km (fuori portata reciproca a 5 kt) e si vanno incontro.
 * @returns {Scenario}
 */
export function palestraProvvisoria() {
  /** @type {Partenza[]} */
  const partenze = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * 360) / 8;
    const r = 5000;
    const x = r * Math.sin((a * Math.PI) / 180);
    const y = r * Math.cos((a * Math.PI) / 180);
    partenze.push({ x: Math.round(x), y: Math.round(y), rotta: (a + 180) % 360, quota: 45.72, velocita: 5 });
  }
  /** @type {Punto[]} */
  const circuito = [{ x: -8000, y: 14000 }, { x: 8000, y: 14000 }, { x: 0, y: 26000 }];
  return {
    id: 'torpex_palestra',
    nome: "TORPEX '89 — palestra",
    fonte: 'provvisorio',
    origine: { lat: 62.5, lon: -5.5 },
    area: { x0: -40000, y0: -40000, x1: 40000, y1: 40000 },
    partenze,
    navi: [
      { classe: 'cacciatorpediniere', nome: 'DD-931', x: -8000, y: 14000, rotta: 90, velocita: 12, waypoint: [circuito[1], circuito[2], circuito[0]], alTermine: 'ciclo' },
      { classe: 'cacciatorpediniere', nome: 'DD-933', x: 8000, y: 14000, rotta: 330, velocita: 12, waypoint: [circuito[2], circuito[0], circuito[1]], alTermine: 'ciclo' },
      { classe: 'cacciatorpediniere', nome: 'DD-937', x: 0, y: 26000, rotta: 210, velocita: 12, waypoint: [circuito[0], circuito[1], circuito[2]], alTermine: 'ciclo' },
      { classe: 'mercantile', nome: 'mercantile', x: -35000, y: -20000, rotta: 80, velocita: 12, waypoint: [{ x: 35000, y: -10000 }], alTermine: 'ciclo' },
    ],
    biologici: [{ x: -15000, y: 5000 }, { x: 12000, y: -8000 }, { x: 5000, y: 25000 }],
  };
}

/**
 * Carica uno scenario, dal file se c'e', altrimenti provvisorio.
 * @param {string} id
 * @param {{warn: (e: string, d?: Record<string, unknown>) => void}} [registro]
 * @returns {Promise<Scenario>}
 */
export async function caricaScenario(id, registro) {
  const base = id === 'torpex_palestra' ? palestraProvvisoria() : null;
  const url = new URL(`../../../shared/data/scenari/${id}.json`, import.meta.url);
  let grezzo = null;
  try {
    await access(url);
    grezzo = JSON.parse(await leggiTesto(url));
  } catch (e) {
    if (/** @type {any} */ (e).code !== 'ENOENT') registro?.warn('scenario_illeggibile', { id, errore: /** @type {Error} */ (e).message });
  }
  if (!grezzo) {
    if (!base) throw new Error(`scenario sconosciuto: ${id}`);
    return base;
  }
  try {
    return normalizzaScenario(grezzo, base, id);
  } catch (e) {
    registro?.warn('scenario_non_valido', { id, errore: /** @type {Error} */ (e).message });
    if (!base) throw e;
    return base;
  }
}

/**
 * Riduce un file di scenario alla forma del motore; cio' che manca lo prende
 * dallo scenario provvisorio.
 * @param {any} g
 * @param {Scenario | null} base
 * @param {string} id
 * @returns {Scenario}
 */
export function normalizzaScenario(g, base, id) {
  const num = (/** @type {any} */ v) => (typeof v === 'number' && Number.isFinite(v) ? v : (isDatoNumero(v) ? v.valore : null));
  const origineGrezza = g.origine ?? g.centro ?? null;
  const lat = num(origineGrezza?.lat);
  const lon = num(origineGrezza?.lon);
  const origine = lat !== null && lon !== null ? { lat, lon } : base?.origine;
  if (!origine) throw new Error('scenario senza origine');
  const proiezione = new ProiezioneLocale(origine.lat, origine.lon);
  /** @param {any} p @returns {Punto | null} */
  const punto = (p) => {
    if (!p) return null;
    if (Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number') return { x: p[0], y: p[1] };
    const x = num(p.x);
    const y = num(p.y);
    if (x !== null && y !== null) return { x, y };
    const la = num(p.lat);
    const lo = num(p.lon);
    if (la !== null && lo !== null) return proiezione.inPiano(la, lo);
    const pos = p.posizione ?? p.pos;
    return pos && pos !== p ? punto(pos) : null;
  };

  let area = base?.area;
  const ag = g.area;
  if (ag && [ag.x0, ag.y0, ag.x1, ag.y1].every((v) => num(v) !== null)) {
    area = { x0: /** @type {number} */ (num(ag.x0)), y0: /** @type {number} */ (num(ag.y0)), x1: /** @type {number} */ (num(ag.x1)), y1: /** @type {number} */ (num(ag.y1)) };
  } else if (ag && num(ag.lato) !== null) {
    const m = /** @type {number} */ (num(ag.lato)) / 2;
    area = { x0: -m, y0: -m, x1: m, y1: m };
  }
  if (!area) throw new Error('scenario senza area');

  /** @type {Partenza[]} */
  const partenze = [];
  for (const p of g.partenze ?? g.punti_partenza ?? g.spawn ?? []) {
    const q = punto(p);
    if (!q) continue;
    partenze.push({
      ...q,
      rotta: num(p.rotta) ?? 0,
      quota: num(p.quota) ?? 45.72,
      velocita: num(p.velocita) ?? 5,
    });
  }

  /** @type {NaveScenario[]} */
  const navi = [];
  for (const n of g.navi ?? g.unita ?? g.bersagli ?? []) {
    const q = punto(n);
    const classe = /cacciatorpediniere|destroyer|dd|sherman/i.test(String(n.classe ?? n.tipo ?? '')) ? 'cacciatorpediniere'
      : /mercantil|merchant|cargo/i.test(String(n.classe ?? n.tipo ?? '')) ? 'mercantile' : null;
    if (!q || !classe) continue;
    /** @type {Punto[]} */
    const wp = [];
    for (const w of n.waypoint ?? n.rotta_waypoint ?? n.percorso ?? []) {
      const pw = punto(w);
      if (pw) wp.push(pw);
    }
    navi.push({
      classe,
      nome: String(n.nome ?? n.id ?? classe),
      ...q,
      rotta: num(n.rotta) ?? (wp[0] ? Math.atan2(wp[0].x - q.x, wp[0].y - q.y) * 180 / Math.PI : 0),
      velocita: num(n.velocita) ?? 12,
      waypoint: wp.length > 0 ? wp : [q],
      alTermine: /ferm|stop/i.test(String(n.al_termine ?? '')) ? 'ferma' : 'ciclo',
    });
  }

  /** @type {BiologicoScenario[]} */
  const biologici = [];
  for (const b of g.biologici ?? g.biologiche ?? []) {
    const q = punto(b);
    if (!q) continue;
    /** @type {BiologicoScenario} */
    const bio = { ...q };
    const quota = num(b.quota);
    const velocita = num(b.velocita);
    if (quota !== null) bio.quota = quota;
    if (velocita !== null) bio.velocita = velocita;
    biologici.push(bio);
  }

  // Oceanografia dello scenario per l'ambiente provvisorio (finche' manca
  // shared/ambiente.js, che avra' la precedenza): strato, mare, traffico, acqua.
  /** @type {import('../sim/world/ambiente.js').OpzioniProvvisorio} */
  const ambiente = { ...(base?.ambiente ?? {}) };
  const ga = g.ambiente ?? {};
  const quotaStrato = num(ga.strato?.profondita ?? ga.strato?.quota);
  if (quotaStrato !== null) ambiente.strato = quotaStrato;
  else if (ga.strato === null) ambiente.strato = null;
  const perdita = num(ga.strato?.perdita);
  if (perdita !== null) ambiente.perditaStrato = perdita;
  const mare = num(ga.mare?.stato_predefinito ?? ga.mare?.stato);
  if (mare !== null) ambiente.statoMare = mare;
  const traffico = num(ga.rumore?.traffico);
  if (traffico !== null) ambiente.traffico = traffico;
  const t = num(ga.assorbimento?.temperatura);
  const sal = num(ga.assorbimento?.salinita);
  const ph = num(ga.assorbimento?.ph);
  if (t !== null) ambiente.temperatura = t;
  if (sal !== null) ambiente.salinita = sal;
  if (ph !== null) ambiente.ph = ph;

  return {
    id,
    nome: String(g.nome ?? base?.nome ?? id),
    fonte: 'file',
    origine,
    area,
    partenze: partenze.length > 0 ? partenze : (base?.partenze ?? []),
    navi: navi.length > 0 ? navi : (base?.navi ?? []),
    biologici: biologici.length > 0 ? biologici : (base?.biologici ?? []),
    ambiente,
  };
}

/** @param {any} v */
function isDatoNumero(v) {
  return v !== null && typeof v === 'object' && typeof v.valore === 'number' && Number.isFinite(v.valore);
}
