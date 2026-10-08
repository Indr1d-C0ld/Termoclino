// @ts-check
/**
 * La palestra di F1: UNA partita condivisa dello scenario `torpex_palestra`,
 * creata al primo `entra` e chiusa quando resta senza sottomarini. Ogni
 * giocatore vi governa il proprio 688; se cade la linea, l'ufficiale di
 * guardia tiene il battello per `guardiaSecondi` (tempo reale), poi lo toglie.
 *
 * Qui sta anche l'orologio: un ciclo in tempo reale che fa avanzare la
 * partita alla sua scala, manda `stato` a 4 Hz e controlla le guardie.
 */

import { randomBytes, randomInt } from 'node:crypto';
import { DAL_SERVER, ERRORI, validaOrdine } from '../../../shared/protocol.js';
import { Partita } from './partita.js';
import { RegistroIstantanee } from './istantanee.js';
import { caricaScenario } from './scenario.js';
import { creaAmbiente } from '../sim/world/ambiente.js';
import { caricaAcustica } from '../sim/sensors/acustica.js';
import { caricaTutte } from '../../../shared/data/piattaforme.js';

/** @typedef {import('./partita.js').Invia} Invia */
/** @typedef {import('../registro.js').Registro} Registro */
/** @typedef {import('../sim/sensors/acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../../../shared/data/piattaforme.js').Piattaforma} Piattaforma */

/**
 * Il canale verso una connessione: per i messaggi e per dirle che il battello
 * non e' piu' suo (`revocato` manda `uscita {motivo}` e libera la connessione).
 * @typedef {object} Canale
 * @property {Invia} invia
 * @property {(motivo: string) => void} revocato
 */

/**
 * @typedef {object} OpzioniPalestra
 * @property {Registro} registro
 * @property {ValoriAcustica} acustica
 * @property {Map<string, Piattaforma>} piattaforme
 * @property {string | null} dirIstantanee  null = niente registrazione
 * @property {number} guardiaSecondi
 * @property {number} [maxGiocatori]
 * @property {number | string} [seme]  fisso solo per le prove
 * @property {() => number} [adessoMs]
 * @property {boolean} [orologio]  false = nessun ciclo automatico (prove)
 * @property {number} [tickMs]  periodo del ciclo (25 ms)
 * @property {number} [chiusuraVuotaMs]  dopo quanto si chiude una palestra senza sottomarini
 */

/** Periodo dei messaggi `stato`, ms reali. */
const PERIODO_STATO_MS = 250;

export class Palestra {
  /** @param {OpzioniPalestra} o */
  constructor(o) {
    this.o = o;
    this.adessoMs = o.adessoMs ?? (() => Date.now());
    /** @type {Partita | null} */
    this.partita = null;
    /** @type {Promise<Partita> | null} */
    this._inCreazione = null;
    /** @type {Map<number, Canale>} uid -> canale che governa il battello */
    this.canali = new Map();
    /** @type {NodeJS.Timeout | null} */
    this._ciclo = null;
    this._ultimoTick = 0;
    this._ultimoStato = 0;
    /** @type {number | null} */
    this._vuotaDa = null;
    this.statistiche = { passi: 0, persi: 0, tickLenti: 0, msMassimoTick: 0 };
  }

  /**
   * Crea la partita se non c'e' (una sola alla volta anche con ingressi
   * simultanei).
   * @returns {Promise<Partita>}
   */
  async _partita() {
    if (this.partita && !this.partita.chiusa) return this.partita;
    if (this._inCreazione) return this._inCreazione;
    this._inCreazione = (async () => {
      const o = this.o;
      const scenario = await caricaScenario('torpex_palestra', o.registro);
      const ambiente = await creaAmbiente(scenario, o.registro);
      const id = `palestra-${new Date(this.adessoMs()).toISOString().replace(/[-:]/g, '').replace(/\..*/, '')}-${randomBytes(3).toString('hex')}`;
      const istantanee = o.dirIstantanee ? await RegistroIstantanee.apri(o.dirIstantanee, id, o.registro) : null;
      const partita = new Partita({
        id, seme: o.seme ?? randomInt(0, 2 ** 32), scenario, ambiente,
        acustica: o.acustica, piattaforme: o.piattaforme, istantanee, maxGiocatori: o.maxGiocatori,
      });
      this.partita = partita;
      this._vuotaDa = null;
      o.registro.info('partita_aperta', {
        partita: id, seme: partita.seme, scenario: scenario.fonte, ambiente: ambiente.fonte,
        istantanee: istantanee?.percorso ?? null,
      });
      if (o.orologio !== false) this._avviaOrologio();
      return partita;
    })();
    try {
      return await this._inCreazione;
    } finally {
      this._inCreazione = null;
    }
  }

  /**
   * `entra`: un battello nuovo, o il proprio se lo si aveva gia'.
   * @param {number} uid
   * @param {string} nome
   * @param {Canale} canale
   * @param {{assistenza?: number}} [opzioni]  livello di assistenza (PROTOCOLLO v2, `entra`); chi riprende
   *   il proprio battello tiene il livello che aveva (lo cambia con l'ordine `assistenza`)
   * @returns {Promise<{ok: true} | {ok: false, errore: string}>}
   */
  async entra(uid, nome, canale, opzioni = {}) {
    const partita = await this._partita();
    const vecchio = this.canali.get(uid);
    const adesso = this.adessoMs();
    let g = partita.giocatori.get(uid) ?? null;
    if (g) {
      if (vecchio && vecchio !== canale) vecchio.revocato('altra_connessione');
      this.canali.set(uid, canale);
      canale.invia(DAL_SERVER.PARTITA, partita.descrizione(g));
      partita.riprendi(uid, canale.invia, adesso);
    } else {
      g = partita.aggiungiGiocatore(uid, nome, canale.invia, opzioni);
      if (!g) return { ok: false, errore: ERRORI.PARTITA_PIENA };
      this.canali.set(uid, canale);
      canale.invia(DAL_SERVER.PARTITA, partita.descrizione(g));
      this.o.registro.info('in_palestra', { partita: partita.id, uid, battello: g.battello.id });
    }
    canale.invia(DAL_SERVER.STATO, partita.stato(g));
    return { ok: true };
  }

  /**
   * `esci`: il battello viene tolto subito.
   * @param {number} uid
   * @param {Canale} canale
   */
  esci(uid, canale) {
    if (this.canali.get(uid) !== canale || !this.partita) return false;
    this.canali.delete(uid);
    this.partita.rimuoviGiocatore(uid, 'esci');
    canale.revocato('esci');
    return true;
  }

  /**
   * La connessione e' caduta: se governava un battello, passa all'ufficiale
   * di guardia.
   * @param {number} uid
   * @param {Canale} canale
   */
  disconnesso(uid, canale) {
    if (this.canali.get(uid) !== canale || !this.partita) return;
    this.canali.delete(uid);
    this.partita.disconnesso(uid, this.adessoMs());
    this.o.registro.info('guardia', { partita: this.partita.id, uid });
  }

  /**
   * Un messaggio `ordine`. Restituisce i campi della risposta.
   * @param {number} uid
   * @param {Canale} canale
   * @param {Record<string, unknown>} m
   * @returns {{t: string, campi: Record<string, unknown>}}
   */
  ordine(uid, canale, m) {
    const partita = this.partita;
    const g = partita?.giocatori.get(uid);
    const nGrezzo = Number.isSafeInteger(m.n) ? m.n : null;
    if (!partita || !g || this.canali.get(uid) !== canale) {
      return { t: DAL_SERVER.ERRORE, campi: { codice: ERRORI.NON_IN_PARTITA, n: nGrezzo } };
    }
    const v = validaOrdine(m, g.contesto);
    if (!v.ok) return { t: DAL_SERVER.ERRORE, campi: { codice: ERRORI.ORDINE_NON_VALIDO, n: v.n, cosa: v.cosa, motivo: v.motivo } };
    const motivo = partita.ordine(uid, v.ordine);
    if (motivo !== null) {
      return { t: DAL_SERVER.ERRORE, campi: { codice: ERRORI.ORDINE_RIFIUTATO, n: v.n, cosa: v.ordine.cosa, motivo } };
    }
    return { t: DAL_SERVER.RICEVUTO, campi: { n: v.n, cosa: v.ordine.cosa, valore: v.ordine.valore } };
  }

  // -------------------------------------------------------------------------
  // Orologio
  // -------------------------------------------------------------------------

  _avviaOrologio() {
    if (this._ciclo) return;
    this._ultimoTick = performance.now();
    this._ultimoStato = this._ultimoTick;
    this._ciclo = setInterval(() => this.tick(), this.o.tickMs ?? 25);
  }

  /**
   * Un giro dell'orologio (chiamabile a mano nelle prove).
   * @param {number} [dtRealeForzato] s reali (prove); predefinito il tempo trascorso
   */
  tick(dtRealeForzato) {
    const partita = this.partita;
    if (!partita || partita.chiusa) return;
    const t0 = performance.now();
    const dt = dtRealeForzato ?? Math.min(1, (t0 - this._ultimoTick) / 1000);
    this._ultimoTick = t0;
    // Al massimo 4 s di gioco per giro: a 32x e con giri da 25 ms ne servono 0,8.
    const r = partita.avanza(dt, 40);
    this.statistiche.passi += r.passi;
    if (r.persi > 0) {
      this.statistiche.persi += r.persi;
      this.o.registro.warn('passi_persi', { partita: partita.id, persi: r.persi });
    }
    if (dtRealeForzato !== undefined || t0 - this._ultimoStato >= PERIODO_STATO_MS) {
      this._ultimoStato = t0;
      partita.inviaStati();
    }
    this._guardie();
    const ms = performance.now() - t0;
    if (ms > this.statistiche.msMassimoTick) this.statistiche.msMassimoTick = ms;
    if (ms > 20) this.statistiche.tickLenti++;
  }

  /** Toglie i battelli rimasti troppo a lungo all'ufficiale di guardia; chiude la palestra vuota. */
  _guardie() {
    const partita = /** @type {Partita} */ (this.partita);
    const adesso = this.adessoMs();
    for (const g of [...partita.giocatori.values()]) {
      if (g.disconnessoDa !== null && adesso - g.disconnessoDa > this.o.guardiaSecondi * 1000) {
        partita.rimuoviGiocatore(g.uid, 'guardia_scaduta');
        this.o.registro.info('guardia_scaduta', { partita: partita.id, uid: g.uid });
      }
    }
    if (partita.giocatori.size === 0) {
      this._vuotaDa ??= adesso;
      if (adesso - this._vuotaDa > (this.o.chiusuraVuotaMs ?? 60_000)) void this.chiudiPartita('vuota');
    } else {
      this._vuotaDa = null;
    }
  }

  /**
   * @param {string} motivo
   */
  async chiudiPartita(motivo) {
    const partita = this.partita;
    if (!partita) return;
    this.partita = null;
    if (this._ciclo) { clearInterval(this._ciclo); this._ciclo = null; }
    for (const c of this.canali.values()) c.revocato('partita_chiusa');
    this.canali.clear();
    await partita.chiudi();
    this.o.registro.info('partita_chiusa', { partita: partita.id, motivo, ora_gioco: partita.ora, ...this.statistiche });
  }

  /** Spegnimento ordinato del server. */
  async chiudi() {
    await this.chiudiPartita('spegnimento');
  }
}

/**
 * Crea la palestra con i dati comuni (acustica e piattaforme) letti dal disco.
 * @param {import('../config.js').Configurazione} conf
 * @param {Registro} registro
 * @param {Partial<OpzioniPalestra>} [extra]
 * @returns {Promise<Palestra>}
 */
export async function creaPalestra(conf, registro, extra = {}) {
  const [piattaforme, acustica] = await Promise.all([caricaTutte(), caricaAcustica()]);
  return new Palestra({
    registro, acustica, piattaforme,
    dirIstantanee: conf.dirIstantanee,
    guardiaSecondi: conf.guardiaSecondi,
    maxGiocatori: conf.maxGiocatori,
    ...extra,
  });
}
