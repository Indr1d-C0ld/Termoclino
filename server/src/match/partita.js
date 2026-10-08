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
import { DAL_SERVER, MOTIVI_ORDINE, PROTOCOLLO_VERSIONE, codificaSettori, contestoOrdini } from '../../../shared/protocol.js';
import { Battello } from '../sim/platform/battello.js';
import { SensorePassivo } from '../sim/sensors/passivo.js';
import { Equipaggio } from '../sim/crew/equipaggio.js';
import { Nave, Biologico } from '../ai/navi.js';

/** @typedef {import('../sim/sensors/acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../sim/world/ambiente.js').Ambiente} Ambiente */
/** @typedef {import('./scenario.js').Scenario} Scenario */
/** @typedef {import('./istantanee.js').RegistroIstantanee} RegistroIstantanee */
/** @typedef {import('../../../shared/data/piattaforme.js').Piattaforma} Piattaforma */
/** @typedef {import('../../../shared/protocol.js').Ordine} Ordine */
/** @typedef {import('../../../shared/protocol.js').ContestoOrdini} ContestoOrdini */
/** @typedef {(tipo: string, campi: Record<string, unknown>) => void} Invia */

/** Passo fisso della simulazione, s di gioco. */
export const PASSO = 0.1;
/** Passi per secondo di gioco. */
const PASSI_AL_SECONDO = 10;

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

    const sorg = this.ac.sorgenti;
    a.scenario.navi.forEach((n, i) => {
      this._aggiungi(new Nave({
        id: `n${i + 1}`, classe: n.classe, nome: n.nome,
        profilo: n.classe === 'cacciatorpediniere' ? sorg.cacciatorpediniere : sorg.mercantile,
        x: n.x, y: n.y, rotta: n.rotta, velocita: n.velocita, waypoint: n.waypoint, alTermine: n.alTermine,
      }));
    });
    a.scenario.biologici.forEach((b, i) => {
      const id = `q${i + 1}`;
      this._aggiungi(new Biologico({
        id, x: b.x, y: b.y, quota: b.quota, velocita: b.velocita, profilo: sorg.biologico, rng: this.rng.deriva(`bio:${id}`),
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
   * @returns {Giocatore | null}  null se la partita e' piena
   */
  aggiungiGiocatore(uid, nome, invia) {
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
    /** @type {Giocatore} */
    const g = {
      uid, nome, battello, sensori,
      equipaggio: new Equipaggio(battello, { sfera: sensori.sfera.fascio, towed: sensori.towed.fascio }),
      contesto: contestoOrdini(piattaforma.valori),
      invia, disconnessoDa: null,
    };
    const eraModificabile = this.tempoModificabile;
    this.giocatori.set(uid, g);
    this.istantanee?.scrivi({ ora: this.ora, evento: 'entra', battello: id });
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
    this.istantanee?.scrivi({ ora: this.ora, evento: 'esce', battello: g.battello.id, motivo });
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
    this.istantanee?.scrivi({ ora: this.ora, evento: 'guardia', battello: g.battello.id });
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
      this.istantanee?.scrivi({ ora: this.ora, evento: 'riprende', battello: g.battello.id });
      invia(DAL_SERVER.RAPPORTO, {
        ora: this.ora, chi: 'guardia', chiave: 'guardia.ripreso_il_comando',
        parametri: { secondi: Math.round((adessoMs - assente) / 1000) },
      });
    }
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
    const esito = g.battello.ordina(o, this.scenario.area);
    if (esito === null) this.istantanee?.scrivi({ ora: this.ora, evento: 'ordine', battello: g.battello.id, cosa: o.cosa, valore: o.valore });
    return esito;
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
    return g.battello.statoPerClient(this.ora, this.amb, g.equipaggio.avvisi());
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

  /** Lavoro di ogni secondo di gioco: sensori, equipaggio, istantanea. */
  _secondo() {
    const ora = this.ora;
    for (const g of this.giocatori.values()) {
      const sfera = g.sensori.sfera.fotogramma(this._ordinate, this.amb);
      const towed = g.sensori.towed.fotogramma(this._ordinate, this.amb);
      const rapporti = g.equipaggio.ogniSecondo({ sfera, towed }, this.amb);
      if (!g.invia) continue;
      for (const [sensore, f] of /** @type {const} */ ([['sfera', sfera], ['towed', towed]])) {
        if (!f) continue;
        /** @type {Record<string, unknown>} */
        const campi = { ora, sensore, settori: codificaSettori(f.settori), ciechi: f.ciechi };
        if (f.asse !== undefined) campi.asse = f.asse;
        if (f.sorda !== undefined) campi.sorda = f.sorda;
        g.invia(DAL_SERVER.SONAR, campi);
      }
      for (const r of rapporti) g.invia(DAL_SERVER.RAPPORTO, { ora, chi: r.chi, chiave: r.chiave, parametri: r.parametri });
    }
    if (this.istantanee) this.istantanee.scrivi(this.istantanea());
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
    this.istantanee?.scrivi({ ora: this.ora, evento: 'fine' });
    await this.istantanee?.chiudi();
  }
}
