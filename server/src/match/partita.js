// @ts-check
/**
 * Una partita: il mondo in memoria che avanza a passo fisso (PROGETTO §4.3).
 *
 *  - passo di 0,1 s di tempo di gioco per la dinamica; sensori, equipaggio,
 *    bersagli lenti e istantanee una volta al secondo di gioco;
 *  - scala del tempo e pausa: modificabili solo da chi e' solo nella partita
 *    (decisione D2: la scala di uno e' la scala di tutti);
 *  - generatore con seme e sotto-flussi per entita' e per sensore (rng.js):
 *    stesso seme e stessi ordini agli stessi passi → stesse istantanee sullo
 *    stesso motore JavaScript;
 *  - nebbia di guerra: ogni giocatore riceve solo `stato` del proprio battello,
 *    i fotogrammi dei propri sensori e i rapporti del proprio equipaggio.
 *
 * La partita non conosce le connessioni: a ogni giocatore e' associata una
 * funzione `invia(tipo, campi)` (null quando la linea e' caduta e il battello
 * e' in mano all'ufficiale di guardia).
 */

import { Generatore } from '../../../shared/rng.js';
import {
  ASSISTENZA_PREDEFINITA, DAL_SERVER, LIVELLI_ASSISTENZA, MOTIVI_ORDINE, PROTOCOLLO_VERSIONE, codificaSettori, contestoOrdini,
} from '../../../shared/protocol.js';
import { biblioteca as creaBiblioteca } from '../../../shared/data/firme.js';
import { Battello } from '../sim/platform/battello.js';
import { SensorePassivo } from '../sim/sensors/passivo.js';
import { Equipaggio } from '../sim/crew/equipaggio.js';
import { Nave, Biologico } from '../ai/navi.js';
import { Diario } from './diario.js';
import { Arbitro, classeVera } from './arbitro.js';
import { CENTRALE, tmaDi } from '../sim/crew/centrale.js';
import { normalizza180 } from '../../../shared/units.js';
import { rilevamento } from '../../../shared/geo.js';
// --- H: sensori di F2 ---
import { SensoriPartita } from '../sim/sensors/mondo.js';
/** Ordini dei sensori di F2 (filone H): li esegue sensors/mondo.js. */
const ORDINI_SENSORI = new Set(['analizzatore', 'attivo', 'albero', 'radar']);
/** Firma di classe per le navi della palestra senza `piattaforma` nello scenario. */
const FIRMA_PER_CLASSE = /** @type {Record<string, string>} */ ({ cacciatorpediniere: 'forrest_sherman', mercantile: 'mercantile_generico' });
// --- fine aggancio H ---

/** @typedef {import('../sim/sensors/acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../sim/world/ambiente.js').Ambiente} Ambiente */
/** @typedef {import('./scenario.js').Scenario} Scenario */
/** @typedef {import('./istantanee.js').RegistroIstantanee} RegistroIstantanee */
/** @typedef {import('../../../shared/data/piattaforme.js').Piattaforma} Piattaforma */
/** @typedef {import('../../../shared/protocol.js').Ordine} Ordine */
/** @typedef {import('../../../shared/protocol.js').ContestoOrdini} ContestoOrdini */
/** @typedef {(tipo: string, campi: Record<string, unknown>) => void} Invia */
/** @typedef {import('../../../shared/data/firme.js').VoceBiblioteca} VoceBiblioteca */
/** @typedef {import('../sim/crew/equipaggio.js').Fatto} FattoEquipaggio */
/** @typedef {import('../sim/crew/centrale.js').SoluzioneMsg} SoluzioneMsg */
/** @typedef {import('../sim/crew/tracce.js').Traccia} Traccia */

/** Passo fisso della simulazione, s di gioco. */
export const PASSO = 0.1;
/** Passi per secondo di gioco. */
const PASSI_AL_SECONDO = 10;
/** s di gioco fra due messaggi `tracce` (PROTOCOLLO v2). */
const PERIODO_TRACCE = 4;
/**
 * Il «fix» del livello 3: dopo quanti secondi di traccia tenuta senza
 * interruzioni l'equipaggio del 1989 «fissava» il contatto (MAN-688 p. 13:
 * «qualche minuto al sonarista»; nozionale).
 */
const FIX_SECONDI = 180;
/** Ordini che esegue l'equipaggio (PROTOCOLLO v2). */
const ORDINI_EQUIPAGGIO = new Set(['assistenza', 'designa', 'classifica', 'soluzione', 'abbandona']);
/** Velocita' oltre cui una controscoperta passiva e' «colpa della velocita'» (kt, nozionale: +6 dB sui 5 kt di pattugliamento con SL ∝ 20·log v). */
const VELOCITA_TRANQUILLA = 10;

/** Nomi e numeri di scafo dei 688 della palestra, in ordine d'arrivo. */
const SCAFI_688 = [
  ['Los Angeles', 'SSN-688'], ['Dallas', 'SSN-700'], ['Philadelphia', 'SSN-690'], ['Memphis', 'SSN-691'],
  ['Baton Rouge', 'SSN-689'], ['Omaha', 'SSN-692'], ['Groton', 'SSN-694'], ['Birmingham', 'SSN-695'],
];

/**
 * @typedef {object} Giocatore
 * @property {number} uid
 * @property {string} nome
 * @property {Battello} battello
 * @property {Equipaggio} equipaggio
 * @property {{sfera: SensorePassivo, towed: SensorePassivo}} sensori
 * @property {ContestoOrdini} contesto
 * @property {Invia | null} invia
 * @property {number | null} disconnessoDa  ms reali
 */

/** @typedef {Battello | Nave | Biologico} Entita */

export class Partita {
  /**
   * @param {object} a
   * @param {string} a.id
   * @param {number | string} a.seme
   * @param {Scenario} a.scenario
   * @param {Ambiente} a.ambiente
   * @param {ValoriAcustica} a.acustica
   * @param {Map<string, Piattaforma>} a.piattaforme
   * @param {RegistroIstantanee | null} [a.istantanee]
   * @param {number} [a.maxGiocatori]
   * @param {Map<string, VoceBiblioteca>} [a.biblioteca]  la biblioteca delle firme (predefinita: piattaforme e
   *   firme del file acustico)
   * @param {number[]} [a.livelliAmmessi]  livelli di assistenza ammessi in questa partita (tutti)
   */
  constructor(a) {
    this.id = a.id;
    this.rng = new Generatore(a.seme);
    this.seme = this.rng.seme32;
    this.scenario = a.scenario;
    this.amb = a.ambiente;
    this.ac = a.acustica;
    this.piattaforme = a.piattaforme;
    this.istantanee = a.istantanee ?? null;
    this.maxGiocatori = a.maxGiocatori ?? 8;
    /** passi eseguiti: l'ora di gioco e' passi/10, senza accumulare errori */
    this.passi = 0;
    this.scala = 1;
    this.inPausa = false;
    this._accumulo = 0;
    /** @type {Map<string, Entita>} */
    this.entita = new Map();
    /** @type {Entita[]} entita' in ordine di identificativo (ordine deterministico) */
    this._ordinate = [];
    /** @type {Map<number, Giocatore>} */
    this.giocatori = new Map();
    this._prossimoBattello = 1;
    this.chiusa = false;
    /** Il diario della partita (eventi tipizzati con la verita', diario.js): H e le fasi successive vi scrivono con `emetti`. */
    this.diario = new Diario({ registro: this.istantanee, ora: () => this.ora });
    /** L'arbitro: la verita' dietro le tracce, per il diario e il livello 3 (arbitro.js). */
    this.arbitro = new Arbitro(this);
    /** @type {Map<string, VoceBiblioteca>} la biblioteca delle firme dell'equipaggio */
    this.biblioteca = a.biblioteca ?? creaBiblioteca(a.piattaforme,
      new Map(Object.entries(/** @type {any} */ (a.acustica).firme ?? {}).map(([k, v]) => [k, /** @type {any} */ ({ valori: v })])));
    this.livelliAmmessi = a.livelliAmmessi ?? [...LIVELLI_ASSISTENZA];
    /** @type {Map<string, {cav: boolean, cavDa: number, sotto: boolean | null, peri: boolean}>} discrezione per battello */
    this._discrezione = new Map();
    /** @type {Map<number, Record<string, import('../sim/sensors/passivo.js').Fotogramma[]>>} i fotogrammi del secondo in corso (per l'arbitro) */
    this._fotogrammi = new Map();
    // --- H: i sensori di F2 (server/src/sim/sensors/mondo.js) ---
    /** @type {SensoriPartita} */
    this.sensoriH = new SensoriPartita({
      ac: this.ac, amb: this.amb, rng: this.rng, entita: () => this._ordinate, ora: () => this.ora,
      diario: this.diario, scenario: a.scenario,
    });
    const firme = /** @type {ValoriAcustica['firme'] | undefined} */ (this.ac.firme) ?? {};
    // --- fine aggancio H ---

    const sorg = this.ac.sorgenti;
    a.scenario.navi.forEach((n, i) => {
      this._aggiungi(new Nave({
        id: `n${i + 1}`, classe: n.classe, nome: n.nome,
        profilo: n.classe === 'cacciatorpediniere' ? sorg.cacciatorpediniere : sorg.mercantile,
        x: n.x, y: n.y, rotta: n.rotta, velocita: n.velocita, waypoint: n.waypoint, alTermine: n.alTermine,
        // --- H: la firma della classe (righe, sagoma, radar) ---
        firma: firme[n.piattaforma ?? FIRMA_PER_CLASSE[n.classe]] ?? null,
      }));
    });
    a.scenario.biologici.forEach((b, i) => {
      const id = `q${i + 1}`;
      this._aggiungi(new Biologico({
        id, x: b.x, y: b.y, quota: b.quota, velocita: b.velocita, profilo: sorg.biologico, rng: this.rng.deriva(`bio:${id}`),
        // --- H: la specie (canto, scatti) ---
        specie: firme.biologico?.specie?.[b.specie ?? 'balena'] ?? null,
      }));
    });
    this.istantanee?.scrivi({
      formato: 'termoclino-istantanee/1', partita: this.id, seme: this.seme, scenario: a.scenario.id,
      fonte_scenario: a.scenario.fonte, ambiente: a.ambiente.fonte, protocollo: PROTOCOLLO_VERSIONE, passo: PASSO,
    });
  }

  /** Ora di gioco, s. */
  get ora() {
    return this.passi / PASSI_AL_SECONDO;
  }

  /** Si puo' cambiare scala e pausa: un solo giocatore nella partita. */
  get tempoModificabile() {
    return this.giocatori.size === 1;
  }

  /** @param {Entita} e */
  _aggiungi(e) {
    this.entita.set(e.id, e);
    this._ordinate = [...this.entita.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  }

  /** @param {string} id */
  _togli(id) {
    this.entita.delete(id);
    this._ordinate = this._ordinate.filter((e) => e.id !== id);
  }

  // -------------------------------------------------------------------------
  // Giocatori
  // -------------------------------------------------------------------------

  /**
   * Un giocatore entra con un 688 nuovo, in un punto di partenza libero.
   * @param {number} uid
   * @param {string} nome
   * @param {Invia} invia
   * @param {{assistenza?: number}} [opzioni]  livello di assistenza (predefinito 2)
   * @returns {Giocatore | null}  null se la partita e' piena
   */
  aggiungiGiocatore(uid, nome, invia, opzioni = {}) {
    if (this.giocatori.size >= this.maxGiocatori) return null;
    const piattaforma = /** @type {Piattaforma} */ (this.piattaforme.get('688'));
    const n = this._prossimoBattello++;
    const id = `b${n}`;
    const p = this._partenzaLibera(n);
    const [nomeScafo, sigla] = SCAFI_688[(n - 1) % SCAFI_688.length];
    const battello = new Battello({
      id, nome: nomeScafo, sigla, piattaforma: piattaforma.valori,
      x: p.x, y: p.y, z: p.quota, rotta: p.rotta, velocita: p.velocita,
      rng: this.rng.deriva(`battello:${id}`), acustica: this.ac,
    });
    battello.profonditaAcqua = this.amb.profondita(battello.x, battello.y);
    this._aggiungi(battello);
    /** @param {'sfera' | 'towed'} s */
    const sensore = (s) => new SensorePassivo({
      nome: s, battello, ac: this.ac,
      rng: this.rng.deriva(`sensore:${id}:${s}`),
      rngCoppia: (sorgente) => this.rng.deriva(`coppia:${id}:${s}:${sorgente}`),
    });
    const sensori = { sfera: sensore('sfera'), towed: sensore('towed') };
    const rim = piattaforma.valori.sensori.rimorchiata;
    /** @param {'sfera' | 'towed'} s */
    const schiera = (s) => ({
      nome: s, fascio: sensori[s].fascio, sigmaMin: sensori[s].sigmaMin, coefficiente: sensori[s].coefficiente,
      arcoEstremita: rim.arco_estremita, fattoreEstremita: rim.fattore_sigma_estremita,
    });
    const livello = opzioni.assistenza !== undefined && this.livelliAmmessi.includes(opzioni.assistenza)
      ? opzioni.assistenza : ASSISTENZA_PREDEFINITA;
    const lato = piattaforma.valori.identita?.lato ?? 'usa';
    /** @type {Giocatore} */
    const g = {
      uid, nome, battello, sensori,
      equipaggio: new Equipaggio(battello, {
        schiere: { sfera: schiera('sfera'), towed: rim.presente ? schiera('towed') : null },
        biblioteca: this.biblioteca, rng: this.rng.deriva(`equipaggio:${id}`), livello, lato,
      }),
      contesto: contestoOrdini(piattaforma.valori),
      invia, disconnessoDa: null,
    };
    const eraModificabile = this.tempoModificabile;
    this.giocatori.set(uid, g);
    this.sensoriH.aggiungi(g); // --- H ---
    this.diario.emetti({ evento: 'entra', battello: id, uid, piattaforma: '688', lato, assistenza: livello, umano: true });
    if (eraModificabile && !this.tempoModificabile && (this.scala !== 1 || this.inPausa)) {
      this.scala = 1;
      this.inPausa = false;
    }
    // Chi entra riceve `partita`, che ha gia' scala e pausa; gli altri `tempo`.
    if (eraModificabile !== this.tempoModificabile) this._annunciaTempo(uid);
    return g;
  }

  /**
   * Il primo punto di partenza senza sottomarini entro 2 km; se non ce n'e',
   * uno occupato spostato di qualche km.
   * @param {number} n numero del battello
   */
  _partenzaLibera(n) {
    const partenze = this.scenario.partenze;
    const sub = [...this.entita.values()].filter((e) => e.tipo === 'sottomarino');
    for (const p of partenze) {
      if (sub.every((s) => Math.hypot(s.x - p.x, s.y - p.y) > 2000)) return p;
    }
    const p = partenze[(n - 1) % partenze.length];
    const k = Math.floor((n - 1) / partenze.length) + 1;
    return { ...p, x: p.x + 2500 * k, y: p.y - 2500 * k };
  }

  /**
   * Il giocatore lascia la partita: il battello sparisce.
   * @param {number} uid
   * @param {string} motivo
   */
  rimuoviGiocatore(uid, motivo) {
    const g = this.giocatori.get(uid);
    if (!g) return;
    this.giocatori.delete(uid);
    this._togli(g.battello.id);
    this.sensoriH.togli(g); // --- H ---
    this.diario.emetti({ evento: 'esce', battello: g.battello.id, motivo });
    if (this.giocatori.size === 1) this._annunciaTempo();
  }

  /**
   * La linea e' caduta: l'ufficiale di guardia prende il battello.
   * @param {number} uid
   * @param {number} adessoMs
   */
  disconnesso(uid, adessoMs) {
    const g = this.giocatori.get(uid);
    if (!g) return;
    g.invia = null;
    g.disconnessoDa = adessoMs;
    g.battello.prendiGuardia();
    this.diario.emetti({ evento: 'guardia', battello: g.battello.id });
    // Nessuno a guardare: il mondo torna al tempo reale.
    if (![...this.giocatori.values()].some((x) => x.invia)) {
      this.scala = 1;
      this.inPausa = false;
    }
  }

  /**
   * Il giocatore riprende il battello (linea ritrovata o seconda connessione).
   * @param {number} uid
   * @param {Invia} invia
   * @param {number} adessoMs
   * @returns {Giocatore | null}
   */
  riprendi(uid, invia, adessoMs) {
    const g = this.giocatori.get(uid);
    if (!g) return null;
    const assente = g.disconnessoDa;
    g.invia = invia;
    g.disconnessoDa = null;
    if (assente !== null) {
      this.diario.emetti({ evento: 'riprende', battello: g.battello.id });
      invia(DAL_SERVER.RAPPORTO, {
        ora: this.ora, chi: 'guardia', chiave: 'guardia.ripreso_il_comando',
        parametri: { secondi: Math.round((adessoMs - assente) / 1000) },
      });
    }
    // Le soluzioni del comandante si ripetono a chi rientra (ai livelli 0-1 non tornano da sole).
    for (const sol of g.equipaggio.soluzioniComandante(this.ora)) invia(DAL_SERVER.SOLUZIONE, { ...sol });
    // E la storia tempo-rilevamento delle tracce, una per messaggio: senza, la pila dei punti della
    // TMA ricomincia da zero a ogni ricaricamento della pagina.
    for (const s of g.equipaggio.storiaTracce()) invia(DAL_SERVER.STORIA, { ora: this.ora, ...s });
    return g;
  }

  /**
   * Esegue un ordine gia' validato. Restituisce null se eseguito, altrimenti
   * il motivo del rifiuto.
   * @param {number} uid
   * @param {Ordine} o
   * @returns {string | null}
   */
  ordine(uid, o) {
    const g = this.giocatori.get(uid);
    if (!g) return MOTIVI_ORDINE.COSA;
    if (o.cosa === 'scala_tempo' || o.cosa === 'pausa') {
      if (!this.tempoModificabile) return MOTIVI_ORDINE.TEMPO_BLOCCATO;
      if (o.cosa === 'scala_tempo') this.scala = o.valore; else this.inPausa = o.valore;
      this._annunciaTempo();
      return null;
    }
    if (ORDINI_EQUIPAGGIO.has(o.cosa)) return this._ordineEquipaggio(g, /** @type {{cosa: string, valore: any}} */ (o));
    // --- H: ordini dei sensori di F2 (analizzatore, attivo, alberi, radar) ---
    if (ORDINI_SENSORI.has(o.cosa)) {
      const motivo = this.sensoriH.ordine(g, o, this.scenario.area);
      if (motivo === null) this.diario.emetti({ evento: 'ordine', battello: g.battello.id, cosa: o.cosa, valore: o.valore });
      return motivo;
    }
    // --- fine aggancio H ---
    const esito = g.battello.ordina(o, this.scenario.area);
    if (esito === null) this.diario.emetti({ evento: 'ordine', battello: g.battello.id, cosa: o.cosa, valore: o.valore });
    return esito;
  }

  /**
   * Gli ordini dell'equipaggio: assistenza, designa, classifica, soluzione, abbandona.
   * @param {Giocatore} g
   * @param {{cosa: string, valore: any}} o
   * @returns {string | null}
   */
  _ordineEquipaggio(g, o) {
    if (o.cosa === 'assistenza' && !this.livelliAmmessi.includes(o.valore)) return MOTIVI_ORDINE.LIVELLO;
    const esito = g.equipaggio.ordine(o, this.ora);
    if (esito !== null) return esito;
    this.diario.emetti({ evento: 'ordine', battello: g.battello.id, cosa: o.cosa, valore: o.valore });
    this._fattiEquipaggio(g, this.ora);
    this._inviaSoluzioni(g, this.ora, false);
    return null;
  }

  /**
   * Manda `tempo` a tutti i giocatori collegati (tranne `escluso`).
   * @param {number} [escluso] uid
   */
  _annunciaTempo(escluso) {
    const campi = { ora: this.ora, scala_tempo: this.scala, in_pausa: this.inPausa, tempo_modificabile: this.tempoModificabile };
    for (const g of this.giocatori.values()) if (g.uid !== escluso) g.invia?.(DAL_SERVER.TEMPO, campi);
  }

  /**
   * Il messaggio `partita` per un giocatore.
   * @param {Giocatore} g
   */
  descrizione(g) {
    return {
      id: this.id,
      scenario: this.scenario.id,
      ora: this.ora,
      passo: PASSO,
      scala_tempo: this.scala,
      in_pausa: this.inPausa,
      tempo_modificabile: this.tempoModificabile,
      origine: { ...this.scenario.origine },
      area: { ...this.scenario.area },
      battello: { piattaforma: '688', nome: g.battello.nome, sigla: g.battello.sigla },
    };
  }

  /**
   * Lo `stato` del proprio battello.
   * @param {Giocatore} g
   */
  stato(g) {
    // --- H: ascolto attivo, analizzatore e avvisi dei sensori di F2 ---
    const h = this.sensoriH.stato(g);
    const avvisi = h.avvisi.length > 0 ? [...new Set([...g.equipaggio.avvisi(), ...h.avvisi])].sort() : g.equipaggio.avvisi();
    // --- fine aggancio H ---
    return {
      ...g.battello.statoPerClient(this.ora, this.amb, avvisi),
      ascolto_attivo: h.ascolto_attivo,
      analizzatore: h.analizzatore,
      assistenza: g.equipaggio.livello,
      designato: g.equipaggio.designato,
    };
  }

  // -------------------------------------------------------------------------
  // Tempo
  // -------------------------------------------------------------------------

  /**
   * Fa avanzare la partita di `dtReale` secondi reali, alla scala corrente.
   * Restituisce i passi eseguiti. `massimoPassi` evita la spirale quando il
   * processo resta indietro: il tempo in eccesso si perde (e lo si dice).
   * @param {number} dtReale
   * @param {number} [massimoPassi]
   * @returns {{passi: number, persi: number}}
   */
  avanza(dtReale, massimoPassi = 1000) {
    if (this.inPausa || this.chiusa) return { passi: 0, persi: 0 };
    this._accumulo += dtReale * this.scala;
    let n = Math.floor(this._accumulo / PASSO + 1e-9);
    let persi = 0;
    if (n > massimoPassi) { persi = n - massimoPassi; n = massimoPassi; }
    this._accumulo -= (n + persi) * PASSO;
    if (this._accumulo < 0) this._accumulo = 0;
    for (let i = 0; i < n; i++) this.passo();
    return { passi: n, persi };
  }

  /** Un passo di 0,1 s di gioco. */
  passo() {
    for (const e of this._ordinate) {
      if (e instanceof Battello) e.passo(PASSO, this.amb);
      else e.passo(PASSO);
    }
    this.passi++;
    if (this.passi % PASSI_AL_SECONDO === 0) this._secondo();
  }

  /** Lavoro di ogni secondo di gioco: sensori, equipaggio, diario, istantanea. */
  _secondo() {
    const ora = this.ora;
    this.sensoriH.inizioSecondo(ora); // --- H: ping, alberi, transitori di tutte le entita' ---
    for (const g of this.giocatori.values()) {
      const sfera = g.sensori.sfera.fotogramma(this._ordinate, this.amb);
      const towed = g.sensori.towed.fotogramma(this._ordinate, this.amb);
      // --- H: sensori di F2 (banda stretta, attivo, transitori, periscopio, ESM: sensors/mondo.js) ---
      const h = this.sensoriH ? this.sensoriH.secondo(g, ora) : null;
      // --- fine aggancio H ---
      /** @type {import('../sim/crew/equipaggio.js').Ingressi} */
      const ingressi = {
        sfera, towed,
        stretta: h?.bandaStretta ?? null,
        transitori: (h?.messaggi ?? [])
          .filter((/** @type {{tipo: string}} */ m) => m.tipo === DAL_SERVER.TRANSITORIO)
          .map((/** @type {{campi: any}} */ m) => ({ rilevamento: m.campi.rilevamento, tipo: m.campi.tipo, sensore: m.campi.sensore })),
        ascolta: this.sensoriH?.righe
          ? (/** @type {'sfera' | 'towed'} */ sensore, /** @type {number} */ ril) => this.sensoriH.righe(g, sensore, ril)
          : null,
      };
      /** @type {Record<string, import('../sim/sensors/passivo.js').Fotogramma[]>} */
      const fg = { sfera: [], towed: [] };
      for (const [k, f] of /** @type {const} */ ([['sfera', sfera], ['towed', towed], ['sfera', h?.bandaStretta?.sfera], ['towed', h?.bandaStretta?.towed]])) {
        if (f) fg[k].push(f);
      }
      this._fotogrammi.set(g.uid, fg);
      const rapporti = g.equipaggio.ogniSecondo(ingressi, this.amb, ora);
      this._fattiEquipaggio(g, ora);
      if (!g.invia) { g.equipaggio.soluzioni.length = 0; continue; }
      for (const [sensore, f] of /** @type {const} */ ([['sfera', sfera], ['towed', towed]])) {
        if (!f) continue;
        /** @type {Record<string, unknown>} */
        const campi = { ora, sensore, settori: codificaSettori(f.settori), ciechi: f.ciechi };
        if (f.asse !== undefined) campi.asse = f.asse;
        if (f.sorda !== undefined) campi.sorda = f.sorda;
        g.invia(DAL_SERVER.SONAR, campi);
      }
      // --- H: messaggi e rapporti dei sensori di F2 ---
      for (const m of h?.messaggi ?? []) g.invia(m.tipo, m.campi);
      for (const r of h?.rapporti ?? []) g.invia(DAL_SERVER.RAPPORTO, { ora, chi: r.chi, chiave: r.chiave, parametri: r.parametri });
      // --- fine aggancio H ---
      for (const r of rapporti) g.invia(DAL_SERVER.RAPPORTO, { ora, chi: r.chi, chiave: r.chiave, parametri: r.parametri });
      if (ora % PERIODO_TRACCE === 0) g.invia(DAL_SERVER.TRACCE, g.equipaggio.messaggioTracce(ora));
      this._inviaSoluzioni(g, ora, ora % CENTRALE.PERIODO === 0);
    }
    this._discrezioneSecondo(ora);
    if (this.istantanee) this.istantanee.scrivi(this.istantanea());
  }

  /**
   * Manda le soluzioni pronte. Al livello 3, nei secondi della centrale, le
   * tracce «fissate» (tenute da FIX_SECONDI) di sorgenti NON UMANE hanno la
   * soluzione esatta (`esatta: true`, PROTOCOLLO v2): l'unica verita' che va a
   * un client, e mai quella di un altro giocatore.
   * @param {Giocatore} g
   * @param {number} ora
   * @param {boolean} periodica  e' un secondo della centrale (ogni 10 s)
   */
  _inviaSoluzioni(g, ora, periodica) {
    const e = g.equipaggio;
    /** @type {Map<string, Record<string, unknown>>} */
    const msg = new Map();
    for (const s of e.soluzioni.splice(0)) msg.set(s.contatto, { ...s });
    if (periodica && e.livello === 3) {
      for (const t of e.tracce) {
        const st = tmaDi(t);
        if (t.stato === 'persa' || st.comandante || ora - st.fixDa < FIX_SECONDI) continue;
        const a = this.arbitro.traccia(g, t, ora, this._fotogrammi.get(g.uid));
        if (!a.entita || a.umano) continue;
        const esatta = soluzioneEsatta(/** @type {string} */ (t.contatto), ora, g.battello, a.entita);
        msg.set(/** @type {string} */ (t.contatto), esatta);
        if (!t.tma.esattaNelDiario) {
          t.tma.esattaNelDiario = true;
          this.diario.emetti({
            evento: 'soluzione', osservatore: g.battello.id, contatto: t.contatto, sorgente: a.sorgente, q: 100,
            errore_distanza_pct: 0, errore_rotta: 0, errore_velocita: 0, distanza_vera: a.distanza,
            origine: 'equipaggio', livello: 3, esatta: true, motivo: 'esatta',
          });
        }
      }
    }
    if (!g.invia) return;
    for (const m of msg.values()) g.invia(DAL_SERVER.SOLUZIONE, m);
  }

  /**
   * I fatti dell'equipaggio diventano eventi del diario, con la verita'
   * dell'arbitro.
   * @param {Giocatore} g
   * @param {number} ora
   */
  _fattiEquipaggio(g, ora) {
    const d = this.diario;
    const io = g.battello.id;
    const livello = g.equipaggio.livello;
    for (const f of /** @type {FattoEquipaggio[]} */ (g.equipaggio.fatti.splice(0))) {
      switch (f.tipo) {
        case 'designata':
        case 'sensore': {
          const t = f.traccia;
          const ril = [f.rilevamento];
          const sp = t.ambigua ? t.stima(ora).speculare : null;
          if (sp !== null) ril.push(sp);
          const a = this.arbitro.attribuisci(g, /** @type {'sfera' | 'towed'} */ (f.sensore), ril, null,
            this._fotogrammi.get(g.uid)?.[f.sensore] ?? []);
          if (f.tipo === 'designata') this.arbitro.memoria.set(`${io}:${t.contatto}`, { id: a.sorgente, ora });
          d.emetti({
            evento: 'scoperta', osservatore: io, contatto: t.contatto, sensore: f.sensore, banda: f.banda,
            sorgente: a.sorgente, distanza_vera: a.distanza, se: a.se, se_misurato: f.se,
            rilevamento: f.rilevamento, speculare: sp, rilevamento_vero: a.rilevamento, prima: f.tipo === 'designata', umano: a.umano,
          });
          if (f.tipo === 'designata' && a.entita instanceof Battello && a.distanza !== null) {
            d.emetti({
              evento: 'controscoperta', ascoltatore: io, sorgente: a.sorgente, causa: causaPassiva(a.entita),
              distanza_vera: a.distanza, sensore: f.sensore, contatto: t.contatto,
            });
          }
          break;
        }
        case 'persa': {
          const t = f.traccia;
          const m = this.arbitro.memoria.get(`${io}:${t.contatto}`);
          const e = m?.id ? this.entita.get(m.id) : undefined;
          d.emetti({
            evento: 'perdita', osservatore: io, contatto: t.contatto, sorgente: m?.id ?? null,
            distanza_vera: e ? Math.hypot(e.x - g.battello.x, e.y - g.battello.y) : null, durata: ora - t.designata,
          });
          break;
        }
        case 'risolta': {
          const t = f.traccia;
          const m = this.arbitro.memoria.get(`${io}:${t.contatto}`);
          const e = m?.id ? this.entita.get(m.id) : undefined;
          let giusta = null;
          const pos = g.battello.posizioneTowed() ?? g.battello;
          if (e) {
            const vero = rilevamento(pos, e.posizioneAcustica());
            giusta = Math.abs(normalizza180(f.rilevamento - vero)) < Math.abs(normalizza180(f.scartato - vero));
          }
          d.emetti({ evento: 'ambiguita', osservatore: io, contatto: t.contatto, risolta_da: f.da, giusta, sorgente: m?.id ?? null });
          break;
        }
        case 'classificazione': {
          const t = f.traccia;
          const a = this.arbitro.traccia(g, t, ora, this._fotogrammi.get(g.uid));
          const vera = a.entita ? classeVera(a.entita) : null;
          d.emetti({
            evento: 'classificazione', osservatore: io, contatto: t.contatto, sorgente: a.sorgente, classe: f.classe,
            classe_vera: vera, corretta: f.classe !== null && f.classe === vera, da: f.da, confidenza: f.confidenza,
            secondi: ora - t.designata,
          });
          break;
        }
        case 'soluzione': {
          const st = f.stima;
          const a = this.arbitro.traccia(g, f.traccia, ora, this._fotogrammi.get(g.uid));
          d.emetti({
            evento: 'soluzione', osservatore: io, contatto: f.traccia.contatto, sorgente: a.sorgente, q: st.q,
            ...erroriSoluzione(st.rilevamento, st.distanza, st.rotta, st.velocita, g.battello, a.entita),
            origine: 'equipaggio', livello, esatta: false, motivo: f.motivo,
          });
          break;
        }
        case 'soluzione_comandante': {
          if (!f.soluzione) break;
          const s = f.soluzione;
          const a = this.arbitro.traccia(g, f.traccia, ora, this._fotogrammi.get(g.uid));
          d.emetti({
            evento: 'soluzione', osservatore: io, contatto: f.traccia.contatto, sorgente: a.sorgente, q: null,
            ...erroriSoluzione(s.rilevamento, s.distanza, s.rotta, s.velocita, g.battello, a.entita),
            origine: 'comandante', livello, esatta: false, motivo: 'comandante',
          });
          break;
        }
        case 'consiglio':
          d.emetti({ evento: 'consiglio', osservatore: io, contatto: f.traccia.contatto, accostata: f.accostata, lato: f.lato, minuti: f.minuti });
          break;
        case 'abbandono':
          d.emetti({ evento: 'abbandono', osservatore: io, contatto: f.traccia.contatto });
          break;
        case 'assistenza':
          d.emetti({ evento: 'assistenza', battello: io, livello: f.livello });
          break;
      }
    }
  }

  /**
   * Discrezione e manovra nel diario: inizio e fine della cavitazione (con 3 s
   * di conferma, come il rapporto della macchina), passaggi dello strato
   * (2 m d'isteresi), quota periscopica.
   * @param {number} ora
   */
  _discrezioneSecondo(ora) {
    for (const e of this._ordinate) {
      if (!(e instanceof Battello)) continue;
      const b = e;
      const strato = this.amb.strato(b.x, b.y);
      const quotaStrato = strato ? strato.quota : null;
      const peri = !b.inSuperficie && b.z <= b.p.profondita.periscopica + 1;
      let d = this._discrezione.get(b.id);
      if (!d) {
        d = { cav: false, cavDa: 0, sotto: null, peri: false };
        this._discrezione.set(b.id, d);
      }
      if (b.cavitante !== d.cav) {
        if (++d.cavDa >= 3) {
          d.cav = b.cavitante;
          d.cavDa = 0;
          this.diario.emetti({ evento: 'cavitazione', ora: ora - 2, battello: b.id, attiva: d.cav, velocita: b.velocita, quota: b.z });
        }
      } else {
        d.cavDa = 0;
      }
      const sotto = quotaStrato === null ? null
        : d.sotto ? b.z > quotaStrato - 2 : b.z > quotaStrato + 2;
      if (sotto !== d.sotto) {
        d.sotto = sotto;
        this.diario.emetti({ evento: 'strato', battello: b.id, sotto: sotto === true, quota: b.z, quota_strato: quotaStrato });
      }
      if (peri !== d.peri) {
        d.peri = peri;
        this.diario.emetti({ evento: 'periscopica', battello: b.id, attiva: peri });
      }
    }
  }

  /** La verita' di questo istante (per il registro, mai per i client). */
  istantanea() {
    return { ora: this.ora, entita: this._ordinate.map((e) => e.verita()) };
  }

  /** Manda `stato` a ogni giocatore collegato (4 Hz di tempo reale). */
  inviaStati() {
    for (const g of this.giocatori.values()) g.invia?.(DAL_SERVER.STATO, this.stato(g));
  }

  /** Chiude la partita e svuota il registro. */
  async chiudi() {
    if (this.chiusa) return;
    this.chiusa = true;
    this.diario.emetti({ evento: 'fine' });
    await this.istantanee?.chiudi();
  }
}

/**
 * Perche' una sorgente si e' fatta sentire al sonar passivo (diario,
 * `controscoperta`): cavitazione, transitorio in corso, velocita' oltre la
 * tranquilla, o solo il proprio rumore di fondo.
 * @param {Battello} b
 * @returns {'cavitazione' | 'transitorio' | 'velocita' | 'rumore'}
 */
function causaPassiva(b) {
  if (b.cavitante) return 'cavitazione';
  if (b.transitorio) return 'transitorio';
  if (Math.abs(b.velocita) > VELOCITA_TRANQUILLA) return 'velocita';
  return 'rumore';
}

/**
 * Velocita' vera di un'entita' (kt) e rotta.
 * @param {Entita} e
 */
function motoVero(e) {
  return { rotta: e.rotta, velocita: /** @type {any} */ (e).velocita ?? 0 };
}

/**
 * Gli errori veri di una soluzione (forma polare dalla propria posizione)
 * rispetto alla sorgente vera; null senza sorgente.
 * @param {number} ril @param {number} dist @param {number} rotta @param {number} vel
 * @param {{x: number, y: number}} proprio @param {Entita | null} e
 */
function erroriSoluzione(ril, dist, rotta, vel, proprio, e) {
  if (!e) return { errore_distanza_pct: null, errore_rotta: null, errore_velocita: null, distanza_vera: null };
  const vera = Math.hypot(e.x - proprio.x, e.y - proprio.y);
  const m = motoVero(e);
  return {
    errore_distanza_pct: vera > 0 ? (dist - vera) / vera * 100 : null,
    errore_rotta: normalizza180(rotta - m.rotta),
    errore_velocita: vel - Math.abs(m.velocita),
    distanza_vera: vera,
    errore_rilevamento: normalizza180(ril - rilevamento(proprio, e)),
  };
}

/**
 * La soluzione esatta del livello 3 (solo sorgenti non umane: lo controlla chi chiama).
 * @param {string} contatto @param {number} ora @param {Battello} proprio @param {Entita} e
 * @returns {Record<string, unknown>}
 */
function soluzioneEsatta(contatto, ora, proprio, e) {
  const m = motoVero(e);
  return {
    contatto, ora,
    rilevamento: Math.round(rilevamento(proprio, e) * 10) / 10 % 360,
    distanza: Math.round(Math.hypot(e.x - proprio.x, e.y - proprio.y)),
    rotta: Math.round(m.rotta) % 360,
    velocita: Math.round(Math.abs(m.velocita) * 10) / 10,
    q: 100,
    ellisse: { asse_lungo: 0, asse_corto: 0, orientamento: 0 },
    origine: 'equipaggio',
    esatta: true,
  };
}
