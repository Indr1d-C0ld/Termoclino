// @ts-check
/**
 * Il diario della partita (PROGETTO §7.9, decisione D16; PROTOCOLLO v2,
 * «Diario della partita»): gli EVENTI TIPIZZATI che la simulazione registra
 * mentre accadono, scritti nelle istantanee accanto alla verita' al secondo.
 * Non va MAI ai client: porta la verita' che serve alle statistiche (distanza
 * vera di una scoperta, errore vero di una soluzione, causa vera di una
 * controscoperta), che si possono calcolare solo a partita chiusa.
 *
 * ============================================================================
 * API per chi aggiunge una meccanica (H, e da F3 armi e danni)
 * ============================================================================
 *
 *   partita.diario.emetti({evento: 'ping', sorgente: 'b1', rilevamento: 42, portata: 'corta'})
 *
 *  - `evento` e' una delle chiavi di EVENTI (sotto, con i campi di ciascuno);
 *    l'`ora` la mette il diario (l'ora di gioco corrente), a meno che
 *    l'evento non la porti gia' (per esempio un eco che arriva dopo);
 *  - gli identificativi sono quelli INTERNI delle entita' (`b1`, `n3`, `q2`):
 *    il diario e' il posto dove la verita' e' ammessa;
 *  - le distanze in metri, gli angoli in gradi veri, come nel motore; i numeri
 *    si arrotondano (Diario.arrotonda) per non gonfiare il file;
 *  - `emetti` non lancia mai: un evento con una chiave sconosciuta o senza un
 *    campo obbligatorio si scrive comunque, con `difetto` che dice cosa manca,
 *    e lo si conta in `diario.difetti` (le prove controllano che resti 0);
 *  - l'ordine delle righe e' quello di chiamata: con lo stesso seme e gli
 *    stessi ordini il diario e' identico riga per riga (determinismo).
 *
 * Chi ascolta il diario dentro il processo (le statistiche alla chiusura, le
 * prove) lo legge da `diario.eventi` (tutti gli eventi della partita, in
 * memoria: sono poche centinaia di righe all'ora) o da `diario.di(evento)`.
 *
 * Le righe nel file .jsonl.gz delle istantanee hanno la forma {ora, evento,
 * …campi}; le righe della verita' al secondo hanno {ora, entita: […]} e quella
 * d'intestazione {formato, …}: chi legge il file (statistiche.js) le
 * distingue cosi'.
 */

/** @typedef {import('./istantanee.js').RegistroIstantanee} RegistroIstantanee */

/**
 * I campi obbligatori di ogni evento (oltre a `ora` ed `evento`). I campi in
 * piu' sono ammessi (e documentati nei typedef qui sotto).
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const EVENTI = Object.freeze({
  // --- partita e giocatori (F1, ora tipizzati) ---
  entra: Object.freeze(['battello', 'uid', 'piattaforma', 'lato', 'assistenza']),
  esce: Object.freeze(['battello', 'motivo']),
  guardia: Object.freeze(['battello']),
  riprende: Object.freeze(['battello']),
  ordine: Object.freeze(['battello', 'cosa', 'valore']),
  fine: Object.freeze([]),
  // --- discrezione e manovra (I, dalla dinamica di F1) ---
  cavitazione: Object.freeze(['battello', 'attiva', 'velocita', 'quota']),
  strato: Object.freeze(['battello', 'sotto', 'quota', 'quota_strato']),
  periscopica: Object.freeze(['battello', 'attiva']),
  // --- ascolto, tracce e TMA (I) ---
  scoperta: Object.freeze(['osservatore', 'contatto', 'sensore', 'sorgente', 'distanza_vera', 'se', 'prima']),
  perdita: Object.freeze(['osservatore', 'contatto', 'sorgente', 'distanza_vera']),
  ambiguita: Object.freeze(['osservatore', 'contatto', 'risolta_da', 'giusta']),
  classificazione: Object.freeze(['osservatore', 'contatto', 'sorgente', 'classe', 'classe_vera', 'corretta', 'da']),
  soluzione: Object.freeze(['osservatore', 'contatto', 'sorgente', 'q', 'errore_distanza_pct', 'origine', 'motivo']),
  consiglio: Object.freeze(['osservatore', 'contatto', 'accostata', 'lato', 'minuti']),
  abbandono: Object.freeze(['osservatore', 'contatto']),
  assistenza: Object.freeze(['battello', 'livello']),
  controscoperta: Object.freeze(['ascoltatore', 'sorgente', 'causa', 'distanza_vera']),
  // --- sensori ed emissioni (H) ---
  ping: Object.freeze(['sorgente', 'rilevamento', 'portata']),
  transitorio: Object.freeze(['sorgente', 'tipo']),
  albero: Object.freeze(['battello', 'quale', 'alzato']),
  radar: Object.freeze(['battello', 'attivo']),
  esm: Object.freeze(['osservatore', 'emettitore', 'distanza_vera']),
  eco: Object.freeze(['osservatore', 'sorgente', 'distanza_vera']),
  intercetto: Object.freeze(['osservatore', 'emettitore', 'tipo', 'distanza_vera']),
  periscopio: Object.freeze(['osservatore', 'oggetto', 'distanza_vera']),
});

/**
 * Le cause di una controscoperta: perche' l'ascoltatore ha sentito (o visto)
 * la sorgente. Le passive le decide l'equipaggio di chi ascolta (I), dallo
 * stato vero della sorgente in quell'istante; le altre chi gestisce
 * l'emissione (H).
 */
export const CAUSE_CONTROSCOPERTA = Object.freeze(/** @type {const} */ ([
  'cavitazione',  // la sorgente cavitava
  'transitorio',  // un transitorio in corso (soffiaggio, portelli, cambi di quota)
  'velocita',     // oltre la velocita' tranquilla della sua classe
  'rumore',       // il rumore di fondo del battello, a velocita' tranquilla: sentito «onestamente»
  'ping',         // un proprio ping intercettato
  'radar',        // il proprio radar intercettato dall'ESM
  'albero',       // un albero alzato visto al periscopio
]));

/**
 * @typedef {object} EventoBase
 * @property {number} ora  s di gioco
 * @property {string} evento
 * @property {string} [difetto]  campi mancanti o evento sconosciuto (non dovrebbe mai comparire)
 */

/**
 * Un battello entra nella partita.
 * @typedef {EventoBase & {evento: 'entra', battello: string, uid: number, piattaforma: string,
 *   lato: string, assistenza: number, umano: boolean}} EventoEntra
 */
/**
 * Un osservatore forma una traccia, o un sensore nuovo comincia a contribuire
 * a una traccia gia' tenuta (`prima: false`). Verita': `sorgente` (id
 * interno, null = falso contatto: nessuna entita' spiega il picco),
 * `distanza_vera` (m, dal sensore), `se` (eccesso di segnale vero medio, dB,
 * senza fluttuazione), `umano` (la sorgente e' il battello di un giocatore).
 * Il rilevamento misurato (e lo speculare, se la traccia dell'antenna e'
 * ancora ambigua) accanto a quello vero della sorgente.
 * @typedef {EventoBase & {evento: 'scoperta', osservatore: string, contatto: string, sensore: string,
 *   banda: string, sorgente: string | null, distanza_vera: number | null, se: number | null, se_misurato?: number,
 *   rilevamento: number, speculare: number | null, rilevamento_vero: number | null,
 *   prima: boolean, umano: boolean}} EventoScoperta
 */
/**
 * La traccia e' persa (nessun sensore la sente da PERDITA secondi).
 * @typedef {EventoBase & {evento: 'perdita', osservatore: string, contatto: string,
 *   sorgente: string | null, distanza_vera: number | null, durata: number}} EventoPerdita
 */
/**
 * L'ambiguita' destra/sinistra dell'antenna rimorchiata risolta.
 * @typedef {EventoBase & {evento: 'ambiguita', osservatore: string, contatto: string,
 *   risolta_da: 'accostata' | 'sfera', giusta: boolean | null}} EventoAmbiguita
 */
/**
 * Una classificazione (dell'equipaggio o del comandante). `classe_vera` e'
 * la classe della sorgente vera; `secondi` dalla scoperta.
 * @typedef {EventoBase & {evento: 'classificazione', osservatore: string, contatto: string,
 *   sorgente: string | null, classe: string | null, classe_vera: string | null, corretta: boolean,
 *   da: 'equipaggio' | 'comandante', confidenza: number | null, secondi: number}} EventoClassificazione
 */
/**
 * Una soluzione di TMA. Si scrive alla prima soluzione di una traccia, quando
 * Q attraversa una soglia (30, 50, 70, 90), a ogni soluzione del comandante e
 * al piu' ogni 60 s di gioco come campione. Verita': `errore_distanza_pct`
 * ((stimata − vera)/vera · 100), `errore_rotta` (gradi), `errore_velocita`
 * (nodi), `distanza_vera`.
 * @typedef {EventoBase & {evento: 'soluzione', osservatore: string, contatto: string,
 *   sorgente: string | null, q: number | null, errore_distanza_pct: number | null,
 *   errore_rotta: number | null, errore_velocita: number | null, distanza_vera: number | null,
 *   origine: 'equipaggio' | 'comandante', livello: number, esatta: boolean,
 *   motivo: 'prima' | 'soglia' | 'campione' | 'comandante' | 'esatta'}} EventoSoluzione
 */
/**
 * Qualcuno ha sentito (o visto) la sorgente: lo stesso fatto di una
 * `scoperta`, visto dalla parte di chi e' stato scoperto, con la causa.
 * @typedef {EventoBase & {evento: 'controscoperta', ascoltatore: string, sorgente: string,
 *   causa: typeof CAUSE_CONTROSCOPERTA[number], distanza_vera: number, sensore?: string,
 *   contatto?: string}} EventoControscoperta
 */
/**
 * @typedef {EventoBase & {evento: 'ping', sorgente: string, rilevamento: number | null,
 *   portata: string}} EventoPing
 * @typedef {EventoBase & {evento: 'transitorio', sorgente: string, tipo: string}} EventoTransitorio
 * @typedef {EventoBase & {evento: 'albero', battello: string, quale: string, alzato: boolean}} EventoAlbero
 * @typedef {EventoBase & {evento: 'esm', osservatore: string, emettitore: string, distanza_vera: number}} EventoEsm
 * @typedef {EventoBase & {evento: 'assistenza', battello: string, livello: number}} EventoAssistenza
 * @typedef {EventoBase & {evento: 'cavitazione', battello: string, attiva: boolean, velocita: number,
 *   quota: number}} EventoCavitazione
 * @typedef {EventoBase & {evento: 'strato', battello: string, sotto: boolean, quota: number,
 *   quota_strato: number | null}} EventoStrato  `quota_strato` null = lo strato e' sparito
 * @typedef {EventoBase & {evento: 'periscopica', battello: string, attiva: boolean}} EventoPeriscopica
 */

/**
 * @typedef {EventoBase & Record<string, unknown>} Evento
 */

/** Cifre decimali con cui il diario arrotonda i numeri. */
const CIFRE = 2;

export class Diario {
  /**
   * @param {object} [a]
   * @param {RegistroIstantanee | {scrivi: (o: Record<string, unknown>) => void} | null} [a.registro]
   *   le istantanee della partita (null = solo memoria)
   * @param {() => number} [a.ora]  l'ora di gioco corrente
   */
  constructor(a = {}) {
    this.registro = a.registro ?? null;
    this.oraCorrente = a.ora ?? (() => 0);
    /** @type {Evento[]} tutti gli eventi della partita, in ordine */
    this.eventi = [];
    /** eventi con un difetto (chiave sconosciuta, campi mancanti) */
    this.difetti = 0;
    /** @type {((e: Evento) => void)[]} chi vuole sapere degli eventi mentre accadono */
    this.ascoltatori = [];
  }

  /**
   * Registra un evento. Non lancia mai.
   * @param {{evento: string, ora?: number, [k: string]: unknown}} e
   * @returns {Evento} l'evento come e' stato scritto
   */
  emetti(e) {
    /** @type {Evento} */
    const riga = { ora: e.ora ?? this.oraCorrente(), evento: e.evento };
    for (const [k, v] of Object.entries(e)) {
      if (k === 'ora' || k === 'evento') continue;
      riga[k] = Diario.arrotonda(v);
    }
    const attesi = EVENTI[e.evento];
    if (!attesi) {
      riga.difetto = 'evento_sconosciuto';
    } else {
      const mancano = attesi.filter((k) => !(k in riga));
      if (mancano.length) riga.difetto = `mancano: ${mancano.join(', ')}`;
    }
    if (riga.difetto) this.difetti++;
    this.eventi.push(riga);
    try {
      this.registro?.scrivi(riga);
    } catch {
      // il registro non deve fermare la partita
    }
    for (const f of this.ascoltatori) f(riga);
    return riga;
  }

  /**
   * Gli eventi di un tipo.
   * @param {string} evento
   * @returns {Evento[]}
   */
  di(evento) {
    return this.eventi.filter((e) => e.evento === evento);
  }

  /**
   * Arrotonda i numeri (anche dentro oggetti e vettori) a CIFRE decimali.
   * @param {unknown} v
   * @returns {unknown}
   */
  static arrotonda(v) {
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return null;
      const k = 10 ** CIFRE;
      const r = Math.round(v * k) / k;
      return r === 0 ? 0 : r;
    }
    if (Array.isArray(v)) return v.map((x) => Diario.arrotonda(x));
    if (v !== null && typeof v === 'object') {
      /** @type {Record<string, unknown>} */
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = Diario.arrotonda(x);
      return o;
    }
    return v;
  }
}
