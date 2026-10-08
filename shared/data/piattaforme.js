// @ts-check
/**
 * Caricatore dei dati di piattaforma (shared/data/piattaforme/*.json), comune a
 * server e browser. Il formato e' descritto in shared/data/SCHEMA.md.
 *
 * Nei file ogni numero e' un "dato" con provenienza:
 *   {"valore": 32, "unita": "kt", "fonte": "[FAS-688]", "confidenza": "stimato", "nota": "..."}
 * Il motore pero' vuole numeri semplici: `piattaforma.valori` e' la stessa
 * struttura con ogni dato sostituito dal suo `valore`, mentre
 * `piattaforma.provenienza('dinamica.velocita_max')` restituisce il dato
 * completo (fonte, confidenza, nota) per i debriefing, l'enciclopedia di gioco
 * e le prove.
 *
 * Le unita' sono canoniche per grandezza (nodi, metri, secondi, gradi, Hz, dB...):
 * nessuna conversione al caricamento. Le conversioni stanno in shared/units.js.
 *
 * Lettura dei file: nel browser con fetch() relativo a questo modulo (shared/
 * e' servito cosi' com'e', senza bundler); in Node con fs, perche' fetch() di
 * Node non legge gli URL file:. Il ramo Node usa un import dinamico che il
 * browser non esegue mai.
 */

/** Identificativi delle piattaforme disponibili. */
export const PIATTAFORME = Object.freeze(/** @type {const} */ (['688', 'alfa']));

/** @typedef {typeof PIATTAFORME[number]} IdPiattaforma */

/** Formato atteso nel campo `formato` dei file. */
export const FORMATO = 'termoclino-piattaforma/1';

/** Livelli di confidenza ammessi (PROGETTO §3, pilastro 3). */
export const CONFIDENZE = Object.freeze(
  /** @type {const} */ (['documentato', 'stimato', 'calcolato', 'nozionale']),
);

/** @typedef {typeof CONFIDENZE[number]} Confidenza */

/**
 * Unita' canoniche ammesse, una per grandezza (vedi SCHEMA.md).
 * @type {ReadonlySet<string>}
 */
export const UNITA = new Set([
  'kt', // velocita' orizzontale
  'kt/s', // accelerazione
  'm', // lunghezze, quote, distanze
  'm/s', // velocita' verticale
  's', // tempi
  '°', // angoli
  '°/s', // velocita' angolari
  'Hz', // frequenze
  'dB', // livelli relativi, guadagni, indici di direttivita'
  'dB/kt', // pendenze lineari con la velocita'
  'dB/decade', // pendenze logaritmiche (20 dB/decade = 20·log v)
  't', // dislocamenti
  'kW', // potenze (anche termiche)
  'n', // conteggi
  '%', // percentuali
  'giri/min/kt', // giri dell'asse per nodo
  'anno', // anni del calendario
  '1', // numeri puri (fattori, frazioni, esponenti)
]);

/** Chiavi ammesse in un dato. */
const CHIAVI_DATO = new Set(['valore', 'unita', 'fonte', 'confidenza', 'nota', 'rif', 'intervallo']);

/**
 * @typedef {object} Dato
 * @property {number | boolean | string} valore
 * @property {string} [unita] obbligatoria se `valore` e' un numero
 * @property {string} fonte una o piu' chiavi di docs/ricerca/FONTI.md fra
 *   parentesi quadre, eventualmente con la pagina: "[CFW86 p.618–619] [FAS-688]"
 * @property {Confidenza} confidenza
 * @property {string} [nota] perche' questo valore, in italiano
 * @property {string} [rif] sezione della ricerca con il ragionamento
 * @property {[number, number]} [intervallo] forchetta delle fonti
 */

/**
 * Il nodo e' un dato con provenienza?
 * @param {unknown} nodo
 * @returns {nodo is Dato}
 */
export function isDato(nodo) {
  return (
    nodo !== null &&
    typeof nodo === 'object' &&
    !Array.isArray(nodo) &&
    Object.prototype.hasOwnProperty.call(nodo, 'valore') &&
    Object.prototype.hasOwnProperty.call(nodo, 'confidenza')
  );
}

/**
 * Chiavi bibliografiche citate in un campo `fonte`: il primo elemento dentro
 * ogni coppia di parentesi quadre ("[CFW86 p.618–619]" → "CFW86").
 * @param {string} fonte
 * @returns {string[]}
 */
export function chiaviFonte(fonte) {
  /** @type {string[]} */
  const chiavi = [];
  for (const m of fonte.matchAll(/\[([^\]]+)\]/g)) {
    const chiave = m[1].trim().split(/\s+/)[0];
    if (chiave) chiavi.push(chiave);
  }
  return chiavi;
}

/**
 * Visita in profondita' tutti i dati, con il loro percorso puntato
 * ("dinamica.ordini_macchina.3.velocita").
 * @param {unknown} nodo
 * @param {(percorso: string, dato: Dato) => void} visita
 * @param {string} [percorso]
 */
export function visitaDati(nodo, visita, percorso = '') {
  if (isDato(nodo)) {
    visita(percorso, nodo);
    return;
  }
  if (Array.isArray(nodo)) {
    nodo.forEach((figlio, i) => visitaDati(figlio, visita, unisci(percorso, String(i))));
    return;
  }
  if (nodo !== null && typeof nodo === 'object') {
    for (const [k, figlio] of Object.entries(nodo)) visitaDati(figlio, visita, unisci(percorso, k));
  }
}

/**
 * La stessa struttura con ogni dato sostituito dal suo valore.
 * @param {unknown} nodo
 * @returns {unknown}
 */
export function soloValori(nodo) {
  if (isDato(nodo)) return nodo.valore;
  if (Array.isArray(nodo)) return nodo.map(soloValori);
  if (nodo !== null && typeof nodo === 'object') {
    /** @type {Record<string, unknown>} */
    const fuori = {};
    for (const [k, figlio] of Object.entries(nodo)) fuori[k] = soloValori(figlio);
    return fuori;
  }
  return nodo;
}

/**
 * Controlla la forma di un file di piattaforma gia' letto. Non controlla che
 * le chiavi di fonte esistano in FONTI.md (lo fanno le prove, che vedono i
 * documenti; il browser no).
 * @param {unknown} grezzi
 * @returns {string[]} elenco degli errori, vuoto se il file e' valido
 */
export function validaPiattaforma(grezzi) {
  /** @type {string[]} */
  const errori = [];
  if (grezzi === null || typeof grezzi !== 'object' || Array.isArray(grezzi)) {
    return ['il file non contiene un oggetto'];
  }
  const radice = /** @type {Record<string, unknown>} */ (grezzi);
  if (radice.formato !== FORMATO) errori.push(`formato atteso ${FORMATO}, trovato ${String(radice.formato)}`);
  if (typeof radice.id !== 'string' || radice.id === '') errori.push('manca l\'id');
  controllaNodo(grezzi, '', errori);
  return errori;
}

/**
 * @param {unknown} nodo
 * @param {string} percorso
 * @param {string[]} errori
 */
function controllaNodo(nodo, percorso, errori) {
  if (typeof nodo === 'number') {
    errori.push(`${percorso}: numero senza provenienza (va scritto come dato con fonte e confidenza)`);
    return;
  }
  if (isDato(nodo)) {
    controllaDato(nodo, percorso, errori);
    return;
  }
  if (Array.isArray(nodo)) {
    nodo.forEach((figlio, i) => controllaNodo(figlio, unisci(percorso, String(i)), errori));
    return;
  }
  if (nodo !== null && typeof nodo === 'object') {
    for (const [k, figlio] of Object.entries(nodo)) {
      if (k === 'valore' || k === 'confidenza' || k === 'fonte') {
        errori.push(`${unisci(percorso, k)}: chiave riservata ai dati fuori da un dato completo`);
      }
      controllaNodo(figlio, unisci(percorso, k), errori);
    }
  }
}

/**
 * @param {Dato} dato
 * @param {string} percorso
 * @param {string[]} errori
 */
function controllaDato(dato, percorso, errori) {
  const dove = percorso || '(radice)';
  for (const k of Object.keys(dato)) {
    if (!CHIAVI_DATO.has(k)) errori.push(`${dove}: chiave sconosciuta «${k}» in un dato`);
  }
  if (typeof dato.fonte !== 'string' || chiaviFonte(dato.fonte).length === 0) {
    errori.push(`${dove}: manca la fonte (almeno una [CHIAVE] di FONTI.md)`);
  }
  if (!CONFIDENZE.includes(/** @type {Confidenza} */ (dato.confidenza))) {
    errori.push(`${dove}: confidenza «${String(dato.confidenza)}» non ammessa`);
  }
  if (dato.nota !== undefined && typeof dato.nota !== 'string') errori.push(`${dove}: nota non testuale`);
  if (dato.rif !== undefined && typeof dato.rif !== 'string') errori.push(`${dove}: rif non testuale`);
  const v = dato.valore;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) errori.push(`${dove}: valore non finito`);
    if (typeof dato.unita !== 'string' || !UNITA.has(dato.unita)) {
      errori.push(`${dove}: unita' «${String(dato.unita)}» non canonica`);
    }
    if (dato.intervallo !== undefined) {
      const iv = dato.intervallo;
      const ok =
        Array.isArray(iv) &&
        iv.length === 2 &&
        iv.every((x) => typeof x === 'number' && Number.isFinite(x)) &&
        iv[0] <= v &&
        v <= iv[1];
      if (!ok) errori.push(`${dove}: intervallo non valido o che non contiene il valore`);
    }
  } else if (typeof v === 'boolean' || typeof v === 'string') {
    if (dato.unita !== undefined) errori.push(`${dove}: unita' su un valore non numerico`);
    if (dato.intervallo !== undefined) errori.push(`${dove}: intervallo su un valore non numerico`);
  } else {
    errori.push(`${dove}: valore di tipo non ammesso`);
  }
}

/**
 * @param {string} percorso
 * @param {string} chiave
 * @returns {string}
 */
function unisci(percorso, chiave) {
  return percorso === '' ? chiave : `${percorso}.${chiave}`;
}

/**
 * Congela in profondita' (i dati di piattaforma non si toccano a partita in corso).
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
// Tipi della vista a numeri semplici (le parti che usa il motore in F1)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} OrdineMacchina
 * @property {string} ordine etichetta della tacca ("1/3", "FLANK", "25%"...)
 * @property {number} [percentuale] solo per i telegrafi a percentuale
 * @property {number} velocita kt (negativa = indietro)
 */

/**
 * @typedef {object} Tonale
 * @property {string} nome
 * @property {string} [tipo]  F2: elettrica, pompa, turbina, riduttore…
 * @property {number} frequenza Hz
 * @property {number} sopra_banda_larga dB sopra lo spettro a banda larga, cella di 1 Hz
 * @property {number} da_velocita kt
 * @property {number} a_velocita kt
 */

/**
 * @typedef {object} SensoreDirettivo
 * @property {boolean} presente
 * @property {string} [nome]
 * @property {string} [modello]
 * @property {number} [banda_min] Hz
 * @property {number} [banda_max] Hz
 * @property {number} [diametro_equivalente] m (sfere)
 * @property {number} [lunghezza_antenna] m (antenne lineari)
 * @property {number} [frequenza_rif] Hz
 * @property {number} [indice_direttivita] dB alla frequenza di riferimento
 * @property {number} [fascio_3db] gradi alla frequenza di riferimento
 * @property {number} [sigma_min] gradi
 * @property {number} [coefficiente_sigma]
 * @property {number} [arco_baffles] gradi, ampiezza totale
 */

/**
 * @typedef {SensoreDirettivo & {
 *   lunghezza_cavo?: number, fattore_sigma_estremita?: number, arco_estremita?: number,
 *   cieco_prua?: number, tempo_filare?: number, tempo_recuperare?: number,
 *   velocita_min?: number, velocita_piena_efficacia?: number, degrado_oltre?: number,
 *   velocita_sorda?: number, velocita_danno?: number, tempo_morto_min?: number,
 *   tempo_morto_max?: number, soglia_accostata?: number,
 *   fattore_sigma_piccola_accostata?: number, durata_piccola_accostata?: number,
 *   ambiguita_destra_sinistra?: boolean, abbassamento_lento?: number,
 *   abbassamento_veloce?: number
 * }} AntennaRimorchiata
 */

/**
 * @typedef {object} ValoriPiattaforma
 * @property {string} formato
 * @property {string} id
 * @property {{nome: string, designazione: string, tipo: string, nazione: string, lato: string,
 *   primo_in_servizio: number, unita_costruite: number, equipaggio: number,
 *   operativi_per_anno: Record<string, number>}} identita
 * @property {{lunghezza: number, larghezza: number, pescaggio: number,
 *   dislocamento_superficie: number, dislocamento_immersione: number}} dimensioni
 * @property {{reattore: string, potenza_asse: number, assi: number, elica_pale: number,
 *   giri_per_nodo: number, reattore_sempre_acceso: boolean}} propulsione
 * @property {{
 *   velocita_max: number, velocita_max_superficie: number,
 *   telegrafo: {tipo: string, minimo?: number, massimo?: number, legge?: string},
 *   ordini_macchina: OrdineMacchina[],
 *   accelerazione: {tau: number, max: number},
 *   decelerazione: {tau: number, max: number},
 *   frenata_rev: number,
 *   accostata: {angolo_timone_max: number, diametro_tattico: number,
 *     velocita_angolare_max: number, tempo_risposta: number, perdita_velocita: number},
 *   quota: {assetto_max: number, velocita_assetto: number,
 *     velocita_piena_efficacia_timoni: number, velocita_verticale_max: number,
 *     velocita_verticale_zavorra: number, velocita_emersione_emergenza: number}
 * }} dinamica
 * @property {{periscopica: number, automatica: number, operativa: number,
 *   collaudo: number, collasso: number}} profondita
 * @property {{
 *   rumore_irradiato: {gradino_sl0: number, velocita_rif: number, velocita_min: number,
 *     pendenza: number, pendenza_extra: number, soglia_pendenza_extra: number,
 *     aspetto_poppa: number, aspetto_prua: number},
 *   cavitazione: {velocita_rif: number, quota_rif: number, salto: number},
 *   rumore_proprio: {livello_macchinario: number, esponente: number,
 *     velocita_soglia_sfera: number, velocita_soglia_conforme: number,
 *     velocita_soglia_rimorchiata: number},
 *   tonali: Tonale[],
 *   righe_giri?: import('./firme.js').RigaGiri[],
 *   pale?: import('./firme.js').Pale,
 *   transitori?: Record<string, {livello?: number, durata: number, quota_evento?: number,
 *     probabilita?: number, intervallo_minimo?: number}>,
 *   forza_bersaglio: {prua_poppa: number, traverso: number, correzione_rivestimento: number}
 * }} acustica
 * @property {{
 *   sfera: SensoreDirettivo,
 *   sfera_attiva: {presente: boolean, frequenza?: number, settore?: number, livello_sorgente?: number,
 *     fascio?: number, perdita_settore?: number, durata_corta?: number, durata_lunga?: number,
 *     ascolto_corta?: number, ascolto_lunga?: number, sigma_min?: number},
 *   conforme: SensoreDirettivo & {settore_da?: number, settore_a?: number},
 *   rimorchiata: AntennaRimorchiata,
 *   intercettazione: {presente: boolean, nome?: string, banda_min?: number, banda_max?: number,
 *     sigma_bassa?: number, sigma_media?: number, sigma_alta?: number, banda_canale?: number,
 *     indice_direttivita?: number},
 *   alta_frequenza: {presente: boolean, nome?: string},
 *   periscopio: {presente: boolean, numero?: number, errore_stadimetro?: number, errore_elevazione?: number,
 *     altezza_occhio?: number, margine_quota?: number, velocita_scia?: number, sigma_rilevamento?: number,
 *     sigma_aspetto?: number},
 *   esm?: {presente: boolean, nome?: string, banda_min?: number, banda_max?: number, sensibilita?: number,
 *     sigma?: number, altezza?: number},
 *   radar?: {presente: boolean, nome?: string, banda?: string, frequenza?: number, potenza_picco?: number,
 *     guadagno?: number, fascio?: number, periodo?: number, altezza?: number, portata_rif?: number,
 *     sigma_rilevamento?: number, sigma_distanza?: number}
 * }} sensori
 * @property {{
 *   tubi: {numero: number, calibro: number, posizione: string, tempo_ricarica: number},
 *   capacita: number, vls: number, filoguida: boolean,
 *   dotazioni: {dal_anno: number, al_anno: number, voci: {arma: string, numero: number}[]}[],
 *   contromisure: {tipo: string, lanciatori: number, dotazione: number,
 *     tempo_ricarica: number, durata: number}
 * }} armi
 * @property {Record<string, unknown>} [varianti]
 * @property {Record<string, unknown>} riferimento_1989
 * @property {Record<string, string>} [contraddizioni]
 */

// ---------------------------------------------------------------------------
// Piattaforma
// ---------------------------------------------------------------------------

/**
 * Una piattaforma caricata e validata: valori semplici piu' provenienza.
 */
export class Piattaforma {
  /**
   * @param {unknown} grezzi contenuto del file JSON gia' interpretato
   */
  constructor(grezzi) {
    const errori = validaPiattaforma(grezzi);
    if (errori.length > 0) {
      throw new TypeError(`piattaforma non valida:\n  ${errori.join('\n  ')}`);
    }
    /** Il file cosi' com'e', congelato. @readonly @type {Record<string, unknown>} */
    this.grezzi = congela(/** @type {Record<string, unknown>} */ (grezzi));
    /** @readonly @type {string} */
    this.id = /** @type {string} */ (this.grezzi.id);
    /** Solo i valori, congelati. @readonly @type {ValoriPiattaforma} */
    this.valori = congela(/** @type {ValoriPiattaforma} */ (soloValori(grezzi)));
    /** @private @type {Map<string, Dato>} */
    this._indice = new Map();
    visitaDati(this.grezzi, (percorso, dato) => this._indice.set(percorso, dato));
  }

  /**
   * Il dato completo (fonte, confidenza, nota) a un percorso puntato, per
   * esempio 'dinamica.velocita_max' o 'acustica.tonali.0.frequenza'.
   * @param {string} percorso
   * @returns {Dato | undefined}
   */
  provenienza(percorso) {
    return this._indice.get(percorso);
  }

  /**
   * Tutti i dati con il loro percorso.
   * @returns {Array<[string, Dato]>}
   */
  dati() {
    return [...this._indice.entries()];
  }
}

/**
 * URL del file JSON di una piattaforma, relativo a questo modulo.
 * @param {string} id
 * @returns {URL}
 */
export function urlPiattaforma(id) {
  if (!(/** @type {readonly string[]} */ (PIATTAFORME).includes(id))) {
    throw new RangeError(`piattaforma sconosciuta: ${id}`);
  }
  return new URL(`./piattaforme/${id}.json`, import.meta.url);
}

/**
 * Legge un file di testo da un URL: fs in Node per file:, fetch altrove.
 * @param {URL} url
 * @returns {Promise<string>}
 */
export async function leggiTesto(url) {
  if (url.protocol === 'file:') {
    const { readFile } = await import('node:fs/promises');
    return readFile(url, 'utf8');
  }
  const risposta = await fetch(url);
  if (!risposta.ok) throw new Error(`lettura di ${url.href} fallita: HTTP ${risposta.status}`);
  return risposta.text();
}

/**
 * Carica e valida una piattaforma.
 * @param {string} id '688' o 'alfa'
 * @returns {Promise<Piattaforma>}
 */
export async function caricaPiattaforma(id) {
  const testo = await leggiTesto(urlPiattaforma(id));
  return new Piattaforma(JSON.parse(testo));
}

/**
 * Carica tutte le piattaforme note.
 * @returns {Promise<Map<string, Piattaforma>>}
 */
export async function caricaTutte() {
  const elenco = await Promise.all(PIATTAFORME.map((id) => caricaPiattaforma(id)));
  return new Map(elenco.map((p) => [p.id, p]));
}
