// @ts-check
/**
 * L'ambiente di uno scenario — modulo comune a server e browser, senza dipendenze.
 *
 * Uno scenario sta in due file di shared/data/scenari/, generati da tools/batimetria/scarica.py:
 *   <id>.json             lo scenario (formato `termoclino-scenario/1`, vedi sotto)
 *   <id>.batimetria.bin   la griglia del fondale, Int16 little-endian
 *
 * Questo modulo li carica e risponde alle domande del motore e della mappa:
 *   fondale(x, y)                       profondita' del fondo, m (bilineare sui nodi; < 0 sulla terra)
 *   terra(x, y)                         il punto e' terra emersa?
 *   velocitaSuono(z)                    profilo del suono, m/s
 *   strato()                            lo strato: profondita', perdita nell'attraversarlo, salto di velocita'
 *   rumoreAmbiente(f, statoMare?)       rumore ambiente, dB re 1 µPa²/Hz (Coates)
 *   assorbimento(f)                     assorbimento, dB/km (Ainslie & McColm)
 *   inPiano(lat, lon) / inGeografiche(x, y)   conversioni con la proiezione dello scenario (shared/geo.js)
 *
 * GRIGLIA. `colonne` x `righe` nodi, righe da nord a sud e colonne da ovest a est: il nodo (riga i,
 * colonna j) sta in x = x_min + j·passo, y = y_max − i·passo (metri sul piano locale: x a est, y a
 * nord). Il valore e' la profondita' del fondo in metri, positiva verso il basso; la terra ha valore
 * negativo (la quota del suolo col segno meno, almeno −1). Fra i nodi si interpola in modo bilineare:
 * la linea di costa e' lo zero dell'interpolazione. Fuori dalla griglia `fondale` restituisce NaN.
 *
 * PROVENIENZA. Come i dati di piattaforma (shared/data/SCHEMA.md), ogni numero dello scenario ha fonte
 * e confidenza: o e' un *dato* {valore, unita, fonte, confidenza, nota?, rif?}, o fa parte di una
 * *serie* {serie: [numeri], unita, fonte, confidenza, nota?} (profili, tabelle). Fanno eccezione solo i
 * campi strutturali del file binario (`batimetria.colonne`, `righe`, `byte`). `ambiente.valori` e' lo
 * scenario con dati e serie ridotti ai loro numeri; `ambiente.provenienza(percorso)` restituisce il dato
 * o la serie completi.
 *
 * In F1 l'oceanografia e' una sola per tutto lo scenario (un profilo, uno strato, un mare): le
 * funzioni accettano gia' la posizione dove in futuro conterra' (strato), ma oggi la ignorano.
 *
 * Lettura dei file come in shared/data/piattaforme.js: fetch() nel browser, fs in Node; oppure con
 * lettori forniti dal chiamante (percorsi relativi alla cartella shared/).
 */

import { ProiezioneLocale } from './geo.js';
import { CONFIDENZE, UNITA, chiaviFonte, isDato, leggiTesto } from './data/piattaforme.js';

/** Scenari disponibili. */
export const SCENARI = Object.freeze(/** @type {const} */ (['torpex_palestra']));

/** Formato atteso nel campo `formato` dello scenario. */
export const FORMATO_SCENARIO = 'termoclino-scenario/1';

/**
 * Unita' ammesse negli scenari: quelle dei dati di piattaforma piu' le grandezze dell'ambiente.
 * @type {ReadonlySet<string>}
 */
export const UNITA_SCENARIO = new Set([
  ...UNITA,
  '°C', // temperatura
  'psu', // salinita'
  'dB/km', // assorbimento
  'dB re 1 µPa²/Hz', // livello spettrale del rumore
]);

/** Campi numerici strutturali ammessi senza provenienza (descrivono il file, non il mondo). */
const NUMERI_STRUTTURALI = new Set(['batimetria.colonne', 'batimetria.righe', 'batimetria.byte']);

/** Chiavi ammesse in un dato e in una serie. */
const CHIAVI_DATO = new Set(['valore', 'unita', 'fonte', 'confidenza', 'nota', 'rif', 'intervallo']);
const CHIAVI_SERIE = new Set(['serie', 'unita', 'fonte', 'confidenza', 'nota', 'rif']);

/**
 * @typedef {object} Serie
 * @property {number[]} serie
 * @property {string} unita
 * @property {string} fonte
 * @property {import('./data/piattaforme.js').Confidenza} confidenza
 * @property {string} [nota]
 * @property {string} [rif]
 */

/**
 * Il nodo e' una serie con provenienza?
 * @param {unknown} nodo
 * @returns {nodo is Serie}
 */
export function isSerie(nodo) {
  return (
    nodo !== null &&
    typeof nodo === 'object' &&
    !Array.isArray(nodo) &&
    Object.prototype.hasOwnProperty.call(nodo, 'serie') &&
    Object.prototype.hasOwnProperty.call(nodo, 'confidenza')
  );
}

/**
 * Visita tutti i dati e le serie, con il percorso puntato ("ambiente.strato.perdita").
 * @param {unknown} nodo
 * @param {(percorso: string, voce: import('./data/piattaforme.js').Dato | Serie) => void} visita
 * @param {string} [percorso]
 */
export function visitaProvenienze(nodo, visita, percorso = '') {
  if (isDato(nodo) || isSerie(nodo)) {
    visita(percorso, nodo);
    return;
  }
  if (Array.isArray(nodo)) {
    nodo.forEach((figlio, i) => visitaProvenienze(figlio, visita, unisci(percorso, String(i))));
    return;
  }
  if (nodo !== null && typeof nodo === 'object') {
    for (const [k, figlio] of Object.entries(nodo)) visitaProvenienze(figlio, visita, unisci(percorso, k));
  }
}

/**
 * La stessa struttura con dati e serie ridotti ai loro valori.
 * @param {unknown} nodo
 * @returns {unknown}
 */
export function valoriScenario(nodo) {
  if (isDato(nodo)) return nodo.valore;
  if (isSerie(nodo)) return [...nodo.serie];
  if (Array.isArray(nodo)) return nodo.map(valoriScenario);
  if (nodo !== null && typeof nodo === 'object') {
    /** @type {Record<string, unknown>} */
    const fuori = {};
    for (const [k, figlio] of Object.entries(nodo)) fuori[k] = valoriScenario(figlio);
    return fuori;
  }
  return nodo;
}

/**
 * Controlla la forma di uno scenario gia' letto: formato, provenienza di ogni numero, unita',
 * confidenze, coerenza della griglia. Non controlla che le chiavi di fonte esistano in FONTI.md
 * (lo fanno le prove).
 * @param {unknown} grezzi
 * @returns {string[]} errori, vuoto se valido
 */
export function validaScenario(grezzi) {
  /** @type {string[]} */
  const errori = [];
  if (grezzi === null || typeof grezzi !== 'object' || Array.isArray(grezzi)) return ['lo scenario non e\' un oggetto'];
  const r = /** @type {Record<string, any>} */ (grezzi);
  if (r.formato !== FORMATO_SCENARIO) errori.push(`formato atteso ${FORMATO_SCENARIO}, trovato ${String(r.formato)}`);
  if (typeof r.id !== 'string' || r.id === '') errori.push('manca l\'id');
  controllaNodo(grezzi, '', errori);
  const b = r.batimetria;
  if (!b || typeof b !== 'object') {
    errori.push('manca la batimetria');
  } else {
    if (b.codifica !== 'int16le') errori.push(`batimetria: codifica ${String(b.codifica)} non gestita`);
    for (const k of ['colonne', 'righe', 'byte']) {
      if (!Number.isInteger(b[k]) || b[k] <= 0) errori.push(`batimetria.${k} non valido`);
    }
    if (Number.isInteger(b.colonne) && Number.isInteger(b.righe) && b.byte !== b.colonne * b.righe * 2) {
      errori.push('batimetria.byte non corrisponde a colonne x righe x 2');
    }
    if (typeof b.file !== 'string' || !/^[\w.-]+\.bin$/.test(b.file)) errori.push('batimetria.file non valido');
  }
  for (const p of ['origine.lat', 'origine.lon', 'area.x0', 'area.y0', 'area.x1', 'area.y1', 'batimetria.passo',
    'batimetria.x_min', 'batimetria.y_max', 'ambiente.strato.profondita', 'ambiente.strato.perdita',
    'ambiente.mare.stato_predefinito', 'ambiente.rumore.traffico', 'ambiente.assorbimento.temperatura',
    'ambiente.assorbimento.salinita', 'ambiente.assorbimento.ph', 'ambiente.assorbimento.profondita']) {
    const v = a(grezzi, p);
    if (!isDato(v) || typeof v.valore !== 'number') errori.push(`${p}: manca (dato numerico)`);
  }
  for (const p of ['ambiente.profilo.quota', 'ambiente.profilo.velocita_suono', 'ambiente.mare.vento_per_stato']) {
    if (!isSerie(a(grezzi, p))) errori.push(`${p}: manca (serie)`);
  }
  const zq = a(grezzi, 'ambiente.profilo.quota');
  const zc = a(grezzi, 'ambiente.profilo.velocita_suono');
  if (isSerie(zq) && isSerie(zc)) {
    if (zq.serie.length !== zc.serie.length || zq.serie.length < 2) errori.push('profilo: serie di lunghezza diversa');
    for (let i = 1; i < zq.serie.length; i++) {
      if (!(zq.serie[i] > zq.serie[i - 1])) errori.push('profilo: quote non crescenti');
    }
  }
  return errori;
}

/**
 * @param {unknown} nodo
 * @param {string} percorso
 * @param {string[]} errori
 */
function controllaNodo(nodo, percorso, errori) {
  if (typeof nodo === 'number') {
    if (!NUMERI_STRUTTURALI.has(percorso)) errori.push(`${percorso}: numero senza provenienza`);
    return;
  }
  if (isDato(nodo)) {
    controllaVoce(nodo, percorso, CHIAVI_DATO, errori);
    const v = nodo.valore;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) errori.push(`${percorso}: valore non finito`);
      if (typeof nodo.unita !== 'string' || !UNITA_SCENARIO.has(nodo.unita)) {
        errori.push(`${percorso}: unita' «${String(nodo.unita)}» non ammessa`);
      }
    } else if (typeof v === 'boolean' || typeof v === 'string') {
      if (nodo.unita !== undefined) errori.push(`${percorso}: unita' su un valore non numerico`);
    } else {
      errori.push(`${percorso}: valore di tipo non ammesso`);
    }
    return;
  }
  if (isSerie(nodo)) {
    controllaVoce(nodo, percorso, CHIAVI_SERIE, errori);
    if (!Array.isArray(nodo.serie) || nodo.serie.length === 0 || !nodo.serie.every((x) => typeof x === 'number' && Number.isFinite(x))) {
      errori.push(`${percorso}: la serie deve essere un elenco di numeri finiti`);
    }
    if (typeof nodo.unita !== 'string' || !UNITA_SCENARIO.has(nodo.unita)) {
      errori.push(`${percorso}: unita' «${String(nodo.unita)}» non ammessa`);
    }
    return;
  }
  if (Array.isArray(nodo)) {
    nodo.forEach((figlio, i) => controllaNodo(figlio, unisci(percorso, String(i)), errori));
    return;
  }
  if (nodo !== null && typeof nodo === 'object') {
    for (const [k, figlio] of Object.entries(nodo)) {
      if (k === 'valore' || k === 'confidenza' || k === 'fonte' || k === 'serie') {
        errori.push(`${unisci(percorso, k)}: chiave riservata fuori da un dato o da una serie`);
      }
      controllaNodo(figlio, unisci(percorso, k), errori);
    }
  }
}

/**
 * Controlli comuni a dati e serie: chiavi, fonte, confidenza, testi.
 * @param {Record<string, any>} voce
 * @param {string} percorso
 * @param {Set<string>} chiavi
 * @param {string[]} errori
 */
function controllaVoce(voce, percorso, chiavi, errori) {
  const dove = percorso || '(radice)';
  for (const k of Object.keys(voce)) if (!chiavi.has(k)) errori.push(`${dove}: chiave sconosciuta «${k}»`);
  if (typeof voce.fonte !== 'string' || chiaviFonte(voce.fonte).length === 0) errori.push(`${dove}: manca la fonte`);
  if (!CONFIDENZE.includes(voce.confidenza)) errori.push(`${dove}: confidenza «${String(voce.confidenza)}» non ammessa`);
  if (voce.nota !== undefined && typeof voce.nota !== 'string') errori.push(`${dove}: nota non testuale`);
  if (voce.rif !== undefined && typeof voce.rif !== 'string') errori.push(`${dove}: rif non testuale`);
}

/**
 * Valore a un percorso puntato.
 * @param {unknown} radice
 * @param {string} percorso
 * @returns {unknown}
 */
function a(radice, percorso) {
  /** @type {any} */
  let n = radice;
  for (const k of percorso.split('.')) {
    if (n === null || typeof n !== 'object' || !(k in n)) return undefined;
    n = n[k];
  }
  return n;
}

/**
 * @param {string} percorso
 * @param {string} chiave
 */
function unisci(percorso, chiave) {
  return percorso === '' ? chiave : `${percorso}.${chiave}`;
}

/**
 * Congela in profondita'.
 * @template T
 * @param {T} nodo
 * @returns {T}
 */
function congela(nodo) {
  if (nodo !== null && typeof nodo === 'object') {
    for (const figlio of Object.values(nodo)) congela(figlio);
    Object.freeze(nodo);
  }
  return nodo;
}

// ---------------------------------------------------------------------------
// Formule (05_acustica.md)
// ---------------------------------------------------------------------------

/**
 * Velocita' del suono, equazione di Mackenzie (1981) [MACK81] [NPL-SS] (05_acustica.md §4.1).
 * Dominio dichiarato: T 2-30 °C, S 25-40 psu, D 0-8000 m.
 * @param {number} t temperatura, °C
 * @param {number} s salinita', psu
 * @param {number} d profondita', m
 * @returns {number} m/s
 */
export function velocitaSuonoMackenzie(t, s, d) {
  return (
    1448.96 + 4.591 * t - 5.304e-2 * t * t + 2.374e-4 * t * t * t + 1.34 * (s - 35) + 1.63e-2 * d +
    1.675e-7 * d * d - 1.025e-2 * t * (s - 35) - 7.139e-13 * t * d * d * d
  );
}

/**
 * Assorbimento del suono in mare, Ainslie & McColm (1998) [NPL-ABS] (05_acustica.md §2.2).
 * @param {number} frequenzaHz
 * @param {number} t temperatura, °C
 * @param {number} s salinita', psu
 * @param {number} ph
 * @param {number} zKm profondita', km
 * @returns {number} dB/km
 */
export function assorbimentoAinslieMcColm(frequenzaHz, t, s, ph, zKm) {
  const f = frequenzaHz / 1000;
  const f2 = f * f;
  const f1r = 0.78 * Math.sqrt(s / 35) * Math.exp(t / 26); // acido borico, kHz
  const f2r = 42 * Math.exp(t / 17); // solfato di magnesio, kHz
  return (
    ((0.106 * f1r * f2) / (f2 + f1r * f1r)) * Math.exp((ph - 8) / 0.56) +
    ((0.52 * (1 + t / 43) * (s / 35) * f2r * f2) / (f2 + f2r * f2r)) * Math.exp(-zKm / 6) +
    0.00049 * f2 * Math.exp(-(t / 27 + zKm / 17))
  );
}

/**
 * Rumore ambiente, modello parametrico di Coates [STOJ06 eq. 6] (05_acustica.md §3.2): turbolenza,
 * traffico, vento e rumore termico sommati in potenza.
 * @param {number} frequenzaHz
 * @param {number} traffico attivita' navale s, 0 (bassa) - 1 (alta)
 * @param {number} vento m/s
 * @returns {number} dB re 1 µPa²/Hz
 */
export function rumoreCoates(frequenzaHz, traffico, vento) {
  const f = frequenzaHz / 1000;
  const l = Math.log10;
  const turbolenza = 17 - 30 * l(f);
  const navi = 40 + 20 * (traffico - 0.5) + 26 * l(f) - 60 * l(f + 0.03);
  const ventoDb = 50 + 7.5 * Math.sqrt(vento) + 20 * l(f) - 40 * l(f + 0.4);
  const termico = -15 + 20 * l(f);
  return 10 * l(10 ** (turbolenza / 10) + 10 ** (navi / 10) + 10 ** (ventoDb / 10) + 10 ** (termico / 10));
}

// ---------------------------------------------------------------------------
// Tipi della vista a numeri semplici (le parti che usano motore e client)
// ---------------------------------------------------------------------------

/** @typedef {{x: number, y: number}} PuntoScenario */

/**
 * @typedef {object} NaveScenario
 * @property {string} id
 * @property {string} nome
 * @property {'cacciatorpediniere' | 'mercantile'} classe
 * @property {string} piattaforma
 * @property {number} x
 * @property {number} y
 * @property {number} rotta gradi veri
 * @property {number} velocita kt
 * @property {number} quota m
 * @property {Array<PuntoScenario & {script_1989?: {X: number, Y: number}}>} waypoint
 * @property {'ferma' | 'ciclo'} al_termine
 * @property {{X: number, Y: number}} [script_1989]
 */

/**
 * @typedef {object} PartenzaScenario
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} rotta gradi veri
 * @property {number} quota m
 * @property {number} velocita kt
 */

/**
 * @typedef {object} BiologicoScenario
 * @property {string} id
 * @property {string} nome
 * @property {string} tipo
 * @property {number} x
 * @property {number} y
 * @property {number} quota m
 * @property {number} velocita kt
 */

/**
 * @typedef {object} ValoriScenario
 * @property {string} formato
 * @property {string} id
 * @property {string} nome
 * @property {string[]} note
 * @property {Array<{dati: string, licenza: string, testo: string}>} crediti
 * @property {{lat: number, lon: number}} origine
 * @property {{x0: number, y0: number, x1: number, y1: number}} area
 * @property {{file: string, codifica: string, colonne: number, righe: number, x_min: number,
 *   y_max: number, passo: number, byte: number, sha256: string, fondale_massimo: number}} batimetria
 * @property {{coefficienti: {a: number, b: number, c: number, d: number, e: number, f: number},
 *   scarto_quadratico_medio: number}} georeferenza_1989
 * @property {{
 *   profilo: {quota: number[], temperatura: number[], salinita: number[], velocita_suono: number[]},
 *   strato: {profondita: number, base_termoclina: number, salto_velocita: number, perdita: number,
 *     gradiente_sotto: number},
 *   mare: {stato_predefinito: number, vento_stagione: number, vento_per_stato: number[]},
 *   rumore: {modello: string, traffico: number, tabella: number[][]},
 *   assorbimento: {modello: string, temperatura: number, salinita: number, ph: number, profondita: number,
 *     bande: Array<{frequenza: number, alfa: number}>}
 * }} ambiente
 * @property {PartenzaScenario[]} partenze
 * @property {Array<PuntoScenario & {id: string, rotta: number, fondale: number,
 *   script_1989: {X: number, Y: number}}>} partenze_1989
 * @property {number} distanza_minima_partenze
 * @property {NaveScenario[]} navi
 * @property {BiologicoScenario[]} biologici
 */

/**
 * @typedef {object} Strato
 * @property {number} profondita m, base dello strato superficiale (la "layer depth")
 * @property {number} quota m, sinonimo di `profondita` (il nome che usa il motore)
 * @property {number} perdita dB persi da un percorso che attraversa lo strato
 * @property {number} saltoVelocita m/s fra la base dello strato e la base della termoclina stagionale
 * @property {number} baseTermoclina m
 */

// ---------------------------------------------------------------------------
// Ambiente
// ---------------------------------------------------------------------------

/**
 * L'ambiente di uno scenario caricato e validato.
 */
export class Ambiente {
  /**
   * @param {unknown} grezzi lo scenario JSON gia' interpretato
   * @param {ArrayBuffer | Uint8Array} batimetria il contenuto del file .bin
   */
  constructor(grezzi, batimetria) {
    const errori = validaScenario(grezzi);
    if (errori.length > 0) throw new TypeError(`scenario non valido:\n  ${errori.join('\n  ')}`);
    /** Il file cosi' com'e', congelato. @readonly @type {Record<string, unknown>} */
    this.grezzi = congela(/** @type {Record<string, unknown>} */ (grezzi));
    /** Solo i valori, congelati. @readonly @type {ValoriScenario} */
    this.valori = congela(/** @type {ValoriScenario} */ (valoriScenario(grezzi)));
    const v = this.valori;
    /** @readonly */ this.id = v.id;
    /** @readonly */ this.nome = v.nome;
    /** @readonly */ this.origine = v.origine;
    /** @readonly */ this.area = v.area;
    /** Proiezione del piano locale (shared/geo.js). @readonly */
    this.proiezione = new ProiezioneLocale(v.origine.lat, v.origine.lon);

    // --- griglia
    const b = v.batimetria;
    const byte = batimetria instanceof Uint8Array ? batimetria : new Uint8Array(batimetria);
    if (byte.byteLength !== b.byte) {
      throw new RangeError(`batimetria di ${byte.byteLength} byte, attesi ${b.byte}`);
    }
    const dv = new DataView(byte.buffer, byte.byteOffset, byte.byteLength);
    const nodi = new Int16Array(b.colonne * b.righe);
    for (let k = 0; k < nodi.length; k++) nodi[k] = dv.getInt16(2 * k, true);
    /** @readonly */
    this.griglia = Object.freeze({
      colonne: b.colonne,
      righe: b.righe,
      xMin: b.x_min,
      yMax: b.y_max,
      passo: b.passo,
      /** valori dei nodi, riga per riga da nord, m (negativi sulla terra) */
      nodi,
    });

    // --- oceanografia
    const amb = v.ambiente;
    /** @private */ this._quote = amb.profilo.quota;
    /** @private */ this._c = amb.profilo.velocita_suono;
    /** @readonly @type {Strato} */
    this.datiStrato = Object.freeze({
      profondita: amb.strato.profondita,
      quota: amb.strato.profondita,
      perdita: amb.strato.perdita,
      saltoVelocita: amb.strato.salto_velocita,
      baseTermoclina: amb.strato.base_termoclina,
    });
    /** Stato del mare predefinito dello scenario (0-6). @readonly */
    this.statoMare = amb.mare.stato_predefinito;
    /** @private */ this._ventoPerStato = amb.mare.vento_per_stato;
    /** @private */ this._traffico = amb.rumore.traffico;
    /** @private */ this._ass = amb.assorbimento;
    /** @private @type {Map<string, number>} */ this._cacheRumore = new Map();
    /** @private @type {Map<number, number>} */ this._cacheAss = new Map();

    /** @private @type {Map<string, import('./data/piattaforme.js').Dato | Serie>} */
    this._indice = new Map();
    visitaProvenienze(this.grezzi, (p, d) => this._indice.set(p, d));
  }

  /**
   * Valore di un nodo della griglia (riga i da nord, colonna j da ovest), m.
   * @param {number} i
   * @param {number} j
   * @returns {number}
   */
  nodo(i, j) {
    const g = this.griglia;
    return g.nodi[i * g.colonne + j];
  }

  /**
   * Coordinate sul piano del nodo (i, j).
   * @param {number} i riga (da nord)
   * @param {number} j colonna (da ovest)
   * @returns {PuntoScenario}
   */
  posizioneNodo(i, j) {
    const g = this.griglia;
    return { x: g.xMin + j * g.passo, y: g.yMax - i * g.passo };
  }

  /**
   * Profondita' del fondo nel punto, interpolata in modo bilineare fra i quattro nodi vicini: metri
   * positivi verso il basso in mare, negativi sulla terra (la costa e' lo zero). NaN fuori dalla
   * griglia.
   * @param {number} x m verso est
   * @param {number} y m verso nord
   * @returns {number}
   */
  fondale(x, y) {
    const g = this.griglia;
    const fj = (x - g.xMin) / g.passo;
    const fi = (g.yMax - y) / g.passo;
    if (!(fj >= 0 && fi >= 0 && fj <= g.colonne - 1 && fi <= g.righe - 1)) return NaN;
    const j0 = Math.min(Math.floor(fj), g.colonne - 2);
    const i0 = Math.min(Math.floor(fi), g.righe - 2);
    const tj = fj - j0;
    const ti = fi - i0;
    const n = g.nodi;
    const k = i0 * g.colonne + j0;
    const nord = n[k] + (n[k + 1] - n[k]) * tj;
    const sud = n[k + g.colonne] + (n[k + g.colonne + 1] - n[k + g.colonne]) * tj;
    return nord + (sud - nord) * ti;
  }

  /**
   * Il punto e' terra emersa (fondale ≤ 0)? Fuori dalla griglia: falso.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  terra(x, y) {
    return this.fondale(x, y) <= 0;
  }

  /**
   * Velocita' del suono alla profondita' z, interpolata linearmente nel profilo; sopra la superficie
   * vale quella di superficie, sotto l'ultimo livello prosegue col gradiente dell'ultimo tratto.
   * @param {number} z m, positiva verso il basso
   * @returns {number} m/s
   */
  velocitaSuono(z) {
    const q = this._quote;
    const c = this._c;
    if (!(z > q[0])) return c[0];
    let i = 1;
    while (i < q.length - 1 && q[i] < z) i++;
    const t = (z - q[i - 1]) / (q[i] - q[i - 1]);
    return c[i - 1] + (c[i] - c[i - 1]) * t;
  }

  /**
   * Lo strato superficiale (layer). In F1 e' uguale in tutto lo scenario: la posizione e' accettata
   * per quando il profilo cambiera' da zona a zona, ma non e' usata.
   * @param {number} [_x]
   * @param {number} [_y]
   * @returns {Strato}
   */
  strato(_x, _y) {
    return this.datiStrato;
  }

  /**
   * Vento per uno stato del mare (interpolato fra le classi; 0-6).
   * @param {number} statoMare
   * @returns {number} m/s
   */
  vento(statoMare) {
    const t = this._ventoPerStato;
    const s = Math.max(0, Math.min(t.length - 1, Number.isFinite(statoMare) ? statoMare : this.statoMare));
    const i = Math.min(Math.floor(s), t.length - 2);
    return t[i] + (t[i + 1] - t[i]) * (s - i);
  }

  /**
   * Rumore ambiente (Coates) alla frequenza data.
   * @param {number} frequenzaHz
   * @param {number} [statoMare] 0-6, predefinito quello dello scenario
   * @returns {number} dB re 1 µPa²/Hz
   */
  rumoreAmbiente(frequenzaHz, statoMare = this.statoMare) {
    const chiave = `${frequenzaHz}|${statoMare}`;
    let v = this._cacheRumore.get(chiave);
    if (v === undefined) {
      v = rumoreCoates(frequenzaHz, this._traffico, this.vento(statoMare));
      if (this._cacheRumore.size < 4096) this._cacheRumore.set(chiave, v);
    }
    return v;
  }

  /**
   * Assorbimento (Ainslie & McColm) nell'acqua dello scenario.
   * @param {number} frequenzaHz
   * @returns {number} dB/km
   */
  assorbimento(frequenzaHz) {
    let v = this._cacheAss.get(frequenzaHz);
    if (v === undefined) {
      const p = this._ass;
      v = assorbimentoAinslieMcColm(frequenzaHz, p.temperatura, p.salinita, p.ph, p.profondita / 1000);
      if (this._cacheAss.size < 4096) this._cacheAss.set(frequenzaHz, v);
    }
    return v;
  }

  /**
   * @param {number} lat gradi
   * @param {number} lon gradi
   * @returns {PuntoScenario} metri sul piano dello scenario
   */
  inPiano(lat, lon) {
    return this.proiezione.inPiano(lat, lon);
  }

  /**
   * @param {number} x m
   * @param {number} y m
   * @returns {import('./geo.js').Geografiche}
   */
  inGeografiche(x, y) {
    return this.proiezione.inGeografiche(x, y);
  }

  /**
   * Converte coordinate degli script del 1989 nel piano dello scenario (georeferenza della mappa).
   * @param {number} X unita' di script, verso est
   * @param {number} Y unita' di script, verso nord
   * @returns {PuntoScenario}
   */
  daScript1989(X, Y) {
    const k = this.valori.georeferenza_1989.coefficienti;
    return { x: k.a * X + k.b * Y + k.c, y: k.d * X + k.e * Y + k.f };
  }

  /**
   * Il punto e' dentro l'area di gioco?
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  dentro(x, y) {
    const r = this.area;
    return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  }

  /**
   * Il dato o la serie completi (fonte, confidenza, nota) a un percorso puntato, per esempio
   * 'ambiente.strato.perdita' o 'ambiente.profilo.velocita_suono'.
   * @param {string} percorso
   * @returns {import('./data/piattaforme.js').Dato | Serie | undefined}
   */
  provenienza(percorso) {
    return this._indice.get(percorso);
  }

  /**
   * Tutti i dati e le serie con il loro percorso.
   * @returns {Array<[string, import('./data/piattaforme.js').Dato | Serie]>}
   */
  provenienze() {
    return [...this._indice.entries()];
  }
}

// ---------------------------------------------------------------------------
// Caricamento
// ---------------------------------------------------------------------------

/**
 * @typedef {object} LettoriScenario
 * @property {(percorso: string) => Promise<unknown>} [leggiJson] percorso relativo a shared/
 * @property {(percorso: string) => Promise<ArrayBuffer | Uint8Array>} [leggiByte] percorso relativo a shared/
 */

/**
 * Legge byte da un URL: fs in Node per file:, fetch altrove.
 * @param {URL} url
 * @returns {Promise<Uint8Array>}
 */
export async function leggiByte(url) {
  if (url.protocol === 'file:') {
    const { readFile } = await import('node:fs/promises');
    const b = await readFile(url);
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }
  const risposta = await fetch(url);
  if (!risposta.ok) throw new Error(`lettura di ${url.href} fallita: HTTP ${risposta.status}`);
  return new Uint8Array(await risposta.arrayBuffer());
}

/**
 * Carica uno scenario e la sua batimetria.
 * @param {string} id per esempio 'torpex_palestra'
 * @param {LettoriScenario} [lettori] per leggere da altrove (percorsi relativi alla cartella shared/,
 *   per esempio 'data/scenari/torpex_palestra.json'); predefinito: accanto a questo modulo
 * @returns {Promise<Ambiente>}
 */
export async function caricaAmbiente(id, lettori = {}) {
  if (!/^[a-z0-9_]+$/.test(id)) throw new RangeError(`id di scenario non valido: ${id}`);
  const percorsoJson = `data/scenari/${id}.json`;
  const grezzi = lettori.leggiJson
    ? await lettori.leggiJson(percorsoJson)
    : JSON.parse(await leggiTesto(new URL(`./${percorsoJson}`, import.meta.url)));
  const file = /** @type {any} */ (grezzi)?.batimetria?.file;
  if (typeof file !== 'string' || !/^[\w.-]+\.bin$/.test(file)) throw new TypeError(`${id}: batimetria.file mancante`);
  const percorsoBin = `data/scenari/${file}`;
  const byte = lettori.leggiByte
    ? await lettori.leggiByte(percorsoBin)
    : await leggiByte(new URL(`./${percorsoBin}`, import.meta.url));
  return new Ambiente(grezzi, byte);
}
