// @ts-check
/**
 * Un sottomarino: dinamica, autopilota, auto-quota, antenna rimorchiata.
 *
 * I modelli sono quelli «di riferimento» di shared/data/SCHEMA.md §5, con cui
 * i dati delle piattaforme sono stati tarati:
 *  - velocita': dv/dt = clamp((v_ordine − v)/tau, …) con accelerazione,
 *    decelerazione per sola resistenza e frenata con la macchina indietro;
 *  - accostata: cerchio di diametro tattico a barra tutta, velocita' angolare
 *    min(ω_max, v/R) proporzionale alla barra, raggiunta con un ritardo del
 *    primo ordine di `tempo_risposta`; in accostata la velocita' cala verso
 *    v·(1 − perdita_velocita);
 *  - quota: timoni orizzontali efficaci come (v/v_piena)², assetto limitato,
 *    velocita' verticale v·sin(assetto) limitata; da fermi solo le casse
 *    d'assetto; emersione d'emergenza a velocita' fissa;
 *  - cavitazione: innesco V(d) = V_rif·√((d + 10,1)/(d_rif + 10,1)) alla quota
 *    della chiglia (cosi' sono tarati i dati), confrontato con la velocita'
 *    «dei giri» dell'elica, che segue l'ordine di macchina piu' in fretta dello
 *    scafo: chi chiama tutta forza cavita subito, come nel 1989;
 *  - antenna rimorchiata: regole R2 e R3 (tempi, velocita', tempo morto dopo
 *    le accostate).
 *
 * Il passo e' fisso (0,1 s di gioco); niente casualita' qui dentro tranne la
 * perdita dell'antenna per eccesso di velocita', che usa il generatore del
 * battello (sotto-flusso della partita).
 */

import { NODO_MS, differenzaAngolare, normalizza360, gradiInRadianti, radiantiInGradi } from '../../../../shared/units.js';
import { rilevamento as rilevamentoDa } from '../../../../shared/geo.js';
import { TIMONI_O_MAX, WAYPOINT_MAX, MOTIVI_ORDINE } from '../../../../shared/protocol.js';
import { velocitaCavitazione, livelloSottomarino } from '../sensors/acustica.js';

/** @typedef {import('../../../../shared/data/piattaforme.js').ValoriPiattaforma} ValoriPiattaforma */
/** @typedef {import('../../../../shared/protocol.js').Ordine} Ordine */
/** @typedef {import('../world/ambiente.js').Ambiente} Ambiente */
/** @typedef {import('../../../../shared/rng.js').Generatore} Generatore */
/** @typedef {typeof import('../../../../shared/protocol.js').STATI_TOWED[number]} StatoTowed */
/** @typedef {import('../sensors/acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../sensors/acustica.js').NomeBanda} NomeBanda */

/**
 * @typedef {object} Rapporto
 * @property {'sonar' | 'guardia' | 'timone' | 'macchina' | 'navigazione'} chi
 * @property {string} chiave
 * @property {Record<string, string | number | boolean | null>} parametri
 */

/** Guadagni del timoniere: gradi di barra per grado d'errore e per °/s di accostata. */
const TIMONIERE_KP = 3;
const TIMONIERE_KD = 12;
/** Barra «standard» e oltre quale scarto si usa la barra tutta (gradi). */
const BARRA_STANDARD = 15;
const SCARTO_BARRA_TUTTA = 45;
/** Variazione dei giri dell'elica, in nodi equivalenti al secondo. */
const RAMPA_ELICA = 2;
/** L'autopilota rallenta all'ordine 2/3 nelle accostate oltre questo scarto (gradi). */
const AUTOPILOTA_SCARTO_RALLENTA = 45;
/** Raggio d'arrivo minimo a un waypoint (m). */
const ARRIVO_MIN = 300;

export class Battello {
  /**
   * @param {object} a
   * @param {string} a.id  identificativo interno (mai inviato agli altri)
   * @param {string} a.nome
   * @param {string} a.sigla
   * @param {ValoriPiattaforma} a.piattaforma
   * @param {number} a.x @param {number} a.y @param {number} a.z quota della chiglia, m
   * @param {number} a.rotta gradi
   * @param {number} a.velocita kt
   * @param {Generatore} a.rng
   * @param {ValoriAcustica} a.acustica
   */
  constructor(a) {
    const p = a.piattaforma;
    this.id = a.id;
    this.tipo = /** @type {const} */ ('sottomarino');
    this.nome = a.nome;
    this.sigla = a.sigla;
    this.p = p;
    this.rng = a.rng;
    this.ac = a.acustica;
    this.x = a.x;
    this.y = a.y;
    this.z = Math.max(a.z, p.dimensioni.pescaggio);
    this.rotta = normalizza360(a.rotta);
    this.velocita = a.velocita;
    /** velocita' equivalente ai giri dell'elica, kt */
    this.vElica = a.velocita;
    /** velocita' angolare, °/s (positiva = a dritta) */
    this.omega = 0;
    /** assetto, gradi (positivo = prua in giu') */
    this.assetto = 0;
    /** velocita' verticale, m/s (positiva = scende) */
    this.wz = 0;

    // Ordini. La macchina parte all'ordine piu' vicino alla velocita' iniziale.
    /** @type {string | number} */
    this.macchina = this._ordinePiuVicino(a.velocita);
    this.timone = 0;
    this.timoneOrdinato = 0;
    /** @type {number | null} */
    this.rottaOrdinata = this.rotta;
    this.timoniO = 0;
    this.timoniOOrdinati = 0;
    /** @type {number | null} */
    this.quotaOrdinata = this.z;
    /** @type {'manuale' | 'automatica' | 'emersione'} */
    this.modoQuota = 'automatica';
    this.autopilota = { attivo: false, waypoint: /** @type {{x: number, y: number}[]} */ ([]), prossimo: 0 };

    const rim = p.sensori.rimorchiata;
    /** Antenna rimorchiata (null se il battello non l'ha). */
    this.towed = rim.presente ? {
      /** @type {StatoTowed} */ stato: 'stivata',
      filato: 0,
      lunghezza: (rim.lunghezza_cavo ?? 0) + (rim.lunghezza_antenna ?? 0),
      tempoMorto: 0,
      /** s ancora con l'errore di rilevamento raddoppiato (piccola accostata) */
      sigmaDoppia: 0,
      rottaRif: this.rotta,
      quota: /** @type {number | null} */ (null),
    } : null;

    this.danni = { urti_fondale: 0, oltre_collaudo: false, collasso: false };
    this.inContattoFondo = false;
    this.cavitante = false;
    /** transitorio in corso (dB in piu' sul rumore irradiato) */
    this.transitorio = 0;
    /** @type {Rapporto[]} rapporti prodotti dalla dinamica, raccolti dalla partita */
    this.rapporti = [];
    /** profondita' dell'acqua sotto il battello all'ultimo passo, m */
    this.profonditaAcqua = Infinity;
  }

  // -------------------------------------------------------------------------
  // Ordini
  // -------------------------------------------------------------------------

  /**
   * Velocita' ordinata dal telegrafo, kt.
   * @param {string | number} ordine
   * @returns {number}
   */
  velocitaDiOrdine(ordine) {
    const om = this.p.dinamica.ordini_macchina;
    if (typeof ordine === 'number') {
      // Telegrafo a percentuale: interpolazione lineare fra le tacche.
      for (let i = 1; i < om.length; i++) {
        const a = om[i - 1];
        const b = om[i];
        const pa = a.percentuale ?? 0;
        const pb = b.percentuale ?? 0;
        if (ordine <= pb || i === om.length - 1) {
          const k = pb === pa ? 0 : (ordine - pa) / (pb - pa);
          return a.velocita + Math.max(0, Math.min(1, k)) * (b.velocita - a.velocita);
        }
      }
      return 0;
    }
    const voce = om.find((o) => o.ordine.toLowerCase() === ordine);
    return voce ? voce.velocita : 0;
  }

  /**
   * @param {number} v kt
   * @returns {string | number}
   */
  _ordinePiuVicino(v) {
    const om = this.p.dinamica.ordini_macchina;
    let migliore = om[0];
    for (const o of om) if (Math.abs(o.velocita - v) < Math.abs(migliore.velocita - v)) migliore = o;
    return this.p.dinamica.telegrafo.tipo === 'percentuale' ? (migliore.percentuale ?? 0) : migliore.ordine.toLowerCase();
  }

  /**
   * Esegue un ordine gia' validato dal protocollo. Restituisce null se
   * eseguito, altrimenti il motivo del rifiuto (MOTIVI_ORDINE).
   * @param {Ordine} o
   * @param {{x0: number, y0: number, x1: number, y1: number}} area
   * @returns {string | null}
   */
  ordina(o, area) {
    const p = this.p;
    switch (o.cosa) {
      case 'macchina':
        this.macchina = o.valore;
        return null;
      case 'timone':
        this.timoneOrdinato = o.valore;
        this.rottaOrdinata = null;
        this.autopilota.attivo = false;
        return null;
      case 'rotta':
        this.rottaOrdinata = o.valore;
        this.autopilota.attivo = false;
        return null;
      case 'timoni_o':
        this.timoniOOrdinati = o.valore;
        this.quotaOrdinata = null;
        this.modoQuota = 'manuale';
        return null;
      case 'quota': {
        if (o.valore === 'emersione') {
          this.modoQuota = 'emersione';
          this.quotaOrdinata = 0;
          return null;
        }
        const q = o.valore === 'periscopica' ? p.profondita.periscopica
          : o.valore === 'automatica' ? p.profondita.automatica : o.valore;
        this.quotaOrdinata = q;
        this.modoQuota = 'automatica';
        return null;
      }
      case 'towed':
        return this._ordineTowed(o.valore);
      case 'waypoint': {
        const w = o.valore;
        const ap = this.autopilota;
        if (w.azione === 'svuota') {
          ap.waypoint = [];
          ap.prossimo = 0;
          if (ap.attivo) { ap.attivo = false; this.rottaOrdinata = Math.round(this.rotta * 10) / 10; }
          return null;
        }
        if (w.azione === 'togli') {
          if (w.indice >= ap.waypoint.length) return MOTIVI_ORDINE.INDICE;
          ap.waypoint.splice(w.indice, 1);
          if (w.indice < ap.prossimo) ap.prossimo--;
          if (ap.waypoint.length === 0 && ap.attivo) {
            ap.attivo = false;
            this.rottaOrdinata = Math.round(this.rotta * 10) / 10;
          }
          return null;
        }
        if (ap.waypoint.length >= WAYPOINT_MAX) return MOTIVI_ORDINE.TROPPI_WAYPOINT;
        if (w.x < area.x0 || w.x > area.x1 || w.y < area.y0 || w.y > area.y1) return MOTIVI_ORDINE.FUORI_AREA;
        ap.waypoint.push({ x: w.x, y: w.y });
        return null;
      }
      case 'autopilota': {
        const ap = this.autopilota;
        if (o.valore) {
          if (ap.waypoint.length === 0) return MOTIVI_ORDINE.NESSUN_WAYPOINT;
          if (ap.prossimo >= ap.waypoint.length) ap.prossimo = 0;
          ap.attivo = true;
        } else if (ap.attivo) {
          ap.attivo = false;
          this.rottaOrdinata = Math.round(this.rotta * 10) / 10;
        }
        return null;
      }
      default:
        // scala_tempo e pausa li tratta la partita.
        return null;
    }
  }

  /**
   * @param {'fila' | 'ritira' | 'taglia'} comando
   * @returns {string | null}
   */
  _ordineTowed(comando) {
    const t = this.towed;
    if (!t) return MOTIVI_ORDINE.SENZA_TOWED;
    if (comando === 'fila') {
      if (t.stato !== 'stivata' && t.stato !== 'in_ritiro') return MOTIVI_ORDINE.TOWED_STATO;
      t.stato = 'in_filare';
      this._rapporto('sonar', 'towed.in_filare');
      return null;
    }
    if (comando === 'ritira') {
      if (t.stato !== 'filata' && t.stato !== 'in_filare') return MOTIVI_ORDINE.TOWED_STATO;
      t.stato = 'in_ritiro';
      this._rapporto('sonar', 'towed.in_ritiro');
      return null;
    }
    // taglia
    if (t.stato === 'stivata' || t.stato === 'tagliata' || t.stato === 'persa') return MOTIVI_ORDINE.TOWED_STATO;
    t.stato = 'tagliata';
    t.filato = 0;
    t.quota = null;
    this._rapporto('sonar', 'towed.tagliata');
    return null;
  }

  /**
   * L'ufficiale di guardia prende il battello: tiene rotta, velocita' e quota.
   */
  prendiGuardia() {
    this.autopilota.attivo = false;
    this.rottaOrdinata = Math.round(this.rotta * 10) / 10;
    if (this.modoQuota === 'manuale') {
      this.modoQuota = 'automatica';
      this.quotaOrdinata = Math.round(this.z * 10) / 10;
    }
  }

  /**
   * @param {Rapporto['chi']} chi
   * @param {string} chiave
   * @param {Rapporto['parametri']} [parametri]
   */
  _rapporto(chi, chiave, parametri = {}) {
    this.rapporti.push({ chi, chiave, parametri });
  }

  // -------------------------------------------------------------------------
  // Dinamica
  // -------------------------------------------------------------------------

  /** Velocita' d'innesco della cavitazione alla quota attuale, kt. */
  get vCavitazione() {
    return velocitaCavitazione(this.p.acustica.cavitazione, this.z);
  }

  /** In superficie (la chiglia al pescaggio). */
  get inSuperficie() {
    return this.z <= this.p.dimensioni.pescaggio + 0.05;
  }

  /**
   * Un passo di simulazione.
   * @param {number} dt s di gioco
   * @param {Ambiente} amb
   */
  passo(dt, amb) {
    const p = this.p;
    const din = p.dinamica;
    const acc = din.accostata;

    // --- Timone: a mano, timoniere su una rotta, o autopilota.
    let vOrdine = this.velocitaDiOrdine(this.macchina);
    /** @type {number | null} */
    let rottaVoluta = this.rottaOrdinata;
    if (this.autopilota.attivo) {
      const r = this._autopilota();
      rottaVoluta = r.rotta;
      if (r.rallenta) vOrdine = Math.min(vOrdine, this.velocitaDiOrdine(this._ordine23()));
    }
    if (rottaVoluta !== null) {
      const errore = differenzaAngolare(this.rotta, rottaVoluta);
      const barraMax = Math.abs(errore) > SCARTO_BARRA_TUTTA ? acc.angolo_timone_max : BARRA_STANDARD;
      this.timone = clamp(TIMONIERE_KP * errore - TIMONIERE_KD * this.omega, -barraMax, barraMax);
    } else {
      this.timone = this.timoneOrdinato;
    }

    // --- Velocita' (SCHEMA §5): l'ordine, meno la perdita in accostata.
    if (this.inSuperficie) vOrdine = Math.min(vOrdine, din.velocita_max_superficie);
    const vObiettivo = vOrdine * (1 - acc.perdita_velocita * Math.abs(this.timone) / acc.angolo_timone_max);
    const v = this.velocita;
    let a;
    if (vObiettivo > v && vObiettivo > 0) {
      // la macchina spinge avanti
      a = Math.min((vObiettivo - v) / din.accelerazione.tau, din.accelerazione.max);
    } else if (vObiettivo < v && vObiettivo < 0) {
      // la macchina spinge indietro: frena (o arretra) con la frenata_rev come limite
      a = Math.max((vObiettivo - v) / din.accelerazione.tau, -din.frenata_rev);
    } else {
      // macchina ridotta o ferma: rallenta la sola resistenza
      a = clamp((vObiettivo - v) / din.decelerazione.tau, -din.decelerazione.max, din.decelerazione.max);
    }
    this.velocita = v + a * dt;
    // Giri dell'elica: inseguono l'ordine (non la perdita in accostata).
    const dElica = vOrdine - this.vElica;
    this.vElica += clamp(dElica, -RAMPA_ELICA * dt, RAMPA_ELICA * dt);

    // --- Accostata.
    const vMs = this.velocita * NODO_MS;
    const omegaPiena = Math.min(acc.velocita_angolare_max, radiantiInGradi(Math.abs(vMs) / (acc.diametro_tattico / 2)));
    const omegaObiettivo = Math.sign(vMs) * omegaPiena * this.timone / acc.angolo_timone_max;
    this.omega += (omegaObiettivo - this.omega) * Math.min(1, dt / acc.tempo_risposta);
    this.rotta = normalizza360(this.rotta + this.omega * dt);

    // --- Quota.
    this._quota(dt, vMs, amb);

    // --- Posizione.
    const th = gradiInRadianti(this.rotta);
    const orizz = vMs * Math.cos(gradiInRadianti(this.assetto));
    this.x += orizz * Math.sin(th) * dt;
    this.y += orizz * Math.cos(th) * dt;

    // --- Cavitazione: giri contro velocita' d'innesco alla quota. Con l'elica
    // che gira contro il moto (indietro a nave lanciata) le pale lavorano con
    // angoli d'attacco enormi: si conta il doppio della velocita' dello scafo.
    const concordi = Math.sign(this.vElica) === Math.sign(this.velocita) || Math.abs(this.velocita) < 0.5;
    const carico = concordi ? Math.abs(this.vElica) : Math.abs(this.vElica) + 2 * Math.abs(this.velocita);
    this.cavitante = !this.inSuperficie && carico > this.vCavitazione;

    // --- Antenna rimorchiata.
    if (this.towed) this._towed(dt, amb);
  }

  /** L'ordine «2/3» (o il 50 % sul telegrafo a percentuale). */
  _ordine23() {
    return this.p.dinamica.telegrafo.tipo === 'percentuale' ? 50 : '2/3';
  }

  /**
   * Autopilota: rotta verso il prossimo waypoint; avanza quando ci si arriva.
   * @returns {{rotta: number, rallenta: boolean}}
   */
  _autopilota() {
    const ap = this.autopilota;
    const arrivo = Math.max(ARRIVO_MIN, this.p.dinamica.accostata.diametro_tattico / 2);
    let w = ap.waypoint[ap.prossimo];
    while (w && Math.hypot(w.x - this.x, w.y - this.y) < arrivo) {
      this._rapporto('navigazione', 'navigazione.waypoint_raggiunto', { indice: ap.prossimo });
      ap.prossimo++;
      w = ap.waypoint[ap.prossimo];
    }
    if (!w) {
      ap.attivo = false;
      this.rottaOrdinata = Math.round(this.rotta * 10) / 10;
      this._rapporto('navigazione', 'navigazione.ultimo_waypoint');
      return { rotta: this.rottaOrdinata, rallenta: false };
    }
    const rotta = rilevamentoDa({ x: this.x, y: this.y }, w);
    // Rallenta durante le accostate larghe e, come nel 1989, anche prima: a
    // meno di due minuti da un waypoint dove la rotta cambia di molto.
    let rallenta = Math.abs(differenzaAngolare(this.rotta, rotta)) > AUTOPILOTA_SCARTO_RALLENTA;
    const dopo = ap.waypoint[ap.prossimo + 1];
    if (!rallenta && dopo) {
      const distanza = Math.hypot(w.x - this.x, w.y - this.y);
      const svolta = Math.abs(differenzaAngolare(rotta, rilevamentoDa(w, dopo)));
      rallenta = svolta > AUTOPILOTA_SCARTO_RALLENTA && distanza < arrivo + 120 * Math.abs(this.velocita) * NODO_MS;
    }
    return { rotta, rallenta };
  }

  /**
   * Timoni orizzontali, auto-quota, casse d'assetto, emersione, fondo.
   * @param {number} dt
   * @param {number} vMs velocita' in m/s
   * @param {Ambiente} amb
   */
  _quota(dt, vMs, amb) {
    const p = this.p;
    const q = p.dinamica.quota;
    const pescaggio = p.dimensioni.pescaggio;
    const efficacia = Math.min(1, (vMs / NODO_MS / q.velocita_piena_efficacia_timoni) ** 2);
    const tassoAssetto = q.velocita_assetto * efficacia;
    let wZavorra = 0;

    if (this.modoQuota === 'emersione') {
      // Soffiaggio d'emergenza: si sale comunque, rumorosamente.
      this.transitorio = 1;
      this.timoniO = -TIMONI_O_MAX;
      this.assetto = Math.max(-q.assetto_max, this.assetto - q.velocita_assetto * dt);
      this.wz = -q.velocita_emersione_emergenza;
      this.z += this.wz * dt;
      if (this.z <= pescaggio) {
        this.z = pescaggio;
        this.wz = 0;
        this.assetto = 0;
        this.modoQuota = 'automatica';
        this.quotaOrdinata = 0;
        this.transitorio = 0;
        this._rapporto('guardia', 'guardia.in_superficie');
      }
      this._fondo(amb);
      return;
    }

    if (this.modoQuota === 'automatica' && this.quotaOrdinata !== null) {
      const obiettivo = Math.max(pescaggio, this.quotaOrdinata);
      const dz = obiettivo - this.z;
      const sinMax = Math.sin(gradiInRadianti(q.assetto_max));
      const wMax = Math.min(q.velocita_verticale_max, Math.abs(vMs) * sinMax);
      // Profilo di frenata: quanto si puo' scendere prima di dover raddrizzare.
      const aW = Math.max(1e-3, Math.abs(vMs) * gradiInRadianti(tassoAssetto) * 0.5);
      const wVoluta = Math.sign(dz) * Math.min(wMax, Math.sqrt(2 * aW * Math.abs(dz)), 0.25 * Math.abs(dz));
      const assettoVoluto = Math.abs(vMs) > 0.05
        ? radiantiInGradi(Math.asin(clamp(wVoluta / Math.abs(vMs), -sinMax, sinMax))) * Math.sign(vMs)
        : 0;
      this.timoniO = clamp(4 * (assettoVoluto - this.assetto), -TIMONI_O_MAX, TIMONI_O_MAX);
      // Da fermi lavorano le casse d'assetto.
      wZavorra = Math.sign(dz) * Math.min(q.velocita_verticale_zavorra, 0.05 * Math.abs(dz)) * (1 - efficacia);
    } else {
      this.timoniO = this.timoniOOrdinati;
    }

    // Assetto: i timoni agiscono con l'abbrivio; senza, lo scafo si raddrizza.
    this.assetto += (this.timoniO / TIMONI_O_MAX) * tassoAssetto * dt;
    this.assetto -= this.assetto * (1 - efficacia) * dt / 20;
    this.assetto = clamp(this.assetto, -q.assetto_max, q.assetto_max);

    this.wz = clamp(vMs * Math.sin(gradiInRadianti(this.assetto)), -q.velocita_verticale_max, q.velocita_verticale_max) + wZavorra;
    this.z += this.wz * dt;
    this.transitorio = 0;
    if (this.z < pescaggio) {
      this.z = pescaggio;
      this.wz = 0;
      if (this.assetto < 0) this.assetto = 0;
    }
    this._fondo(amb);
  }

  /**
   * Urto col fondo: la chiglia non va sotto il fondale. In F1 solo il
   * conteggio e il rapporto (nel 1989 era un'abrasione del 16 %).
   * @param {Ambiente} amb
   */
  _fondo(amb) {
    const h = amb.profondita(this.x, this.y);
    this.profonditaAcqua = h;
    if (this.z >= h) {
      this.z = h;
      if (this.wz > 0) this.wz = 0;
      if (this.assetto > 0) this.assetto = 0;
      if (!this.inContattoFondo) {
        this.inContattoFondo = true;
        this.danni.urti_fondale++;
        this._rapporto('guardia', 'guardia.urto_fondale', { quota: Math.round(this.z) });
      }
    } else if (this.z < h - 2) {
      this.inContattoFondo = false;
    }
    const prof = this.p.profondita;
    if (this.z > prof.collaudo) this.danni.oltre_collaudo = true;
    if (this.z > prof.collasso && !this.danni.collasso) {
      this.danni.collasso = true;
      this._rapporto('guardia', 'guardia.collasso', { quota: Math.round(this.z), collasso: prof.collasso });
    }
  }

  /**
   * Antenna rimorchiata: filare, ritirare, quota, danno da velocita', tempo
   * morto dopo le accostate (regole R2 e R3, SCHEMA §5).
   * @param {number} dt
   * @param {Ambiente} amb
   */
  _towed(dt, amb) {
    const t = /** @type {NonNullable<Battello['towed']>} */ (this.towed);
    const r = this.p.sensori.rimorchiata;
    const v = Math.abs(this.velocita);
    const vMaxFilare = 12; // vedi acustica.json sensori.towed.velocita_filare_max (stesso valore)
    const ritmo = t.lunghezza / (r.tempo_filare ?? 420);
    if (t.stato === 'in_filare' && v <= vMaxFilare) {
      t.filato = Math.min(t.lunghezza, t.filato + ritmo * dt);
      if (t.filato >= t.lunghezza) {
        t.stato = 'filata';
        t.rottaRif = this.rotta;
        t.tempoMorto = 0;
        this._rapporto('sonar', 'towed.filata');
      }
    } else if (t.stato === 'in_ritiro' && v <= vMaxFilare) {
      t.filato = Math.max(0, t.filato - (t.lunghezza / (r.tempo_recuperare ?? 420)) * dt);
      if (t.filato <= 0) {
        t.stato = 'stivata';
        this._rapporto('sonar', 'towed.ritirata');
      }
    }
    const fuori = t.stato === 'in_filare' || t.stato === 'filata' || t.stato === 'in_ritiro';
    if (!fuori) { t.quota = null; return; }

    // Quota: piu' bassa del battello, tanto piu' quanto si va piano.
    const vLenta = 3;
    const vSorda = r.velocita_sorda ?? 12;
    const k = clamp((v - vLenta) / (vSorda - vLenta), 0, 1);
    const abbassamento = (r.abbassamento_lento ?? 100) + k * ((r.abbassamento_veloce ?? 30) - (r.abbassamento_lento ?? 100));
    const frazione = t.filato / t.lunghezza;
    const fondale = amb.profondita(this.x, this.y);
    t.quota = Math.min(fondale - 5, this.z + abbassamento * frazione);

    // Danno oltre la velocita' di danno.
    const vDanno = r.velocita_danno ?? 18;
    if (v > vDanno) {
      const p = 1 - Math.exp(-0.05 * (v - vDanno) * dt / 60);
      if (this.rng.uniforme() < p) {
        t.stato = 'persa';
        t.filato = 0;
        t.quota = null;
        this._rapporto('sonar', 'towed.persa');
        return;
      }
    }

    // Tempo morto dopo le accostate (R3): oltre la soglia l'antenna non forma
    // fasci finche' tutto il cavo non e' ripassato per il punto di accostata;
    // il conto riparte a ogni soglia superata, quindi dura per tutta
    // l'accostata e poi (cavo + antenna) / v. Le accostate piccole, a rotta
    // ferma, raddoppiano l'errore di rilevamento per un minuto.
    if (t.stato === 'filata') {
      const scarto = Math.abs(differenzaAngolare(t.rottaRif, this.rotta));
      if (scarto > (r.soglia_accostata ?? 10)) {
        const durata = clamp(t.lunghezza / Math.max(0.5, v * NODO_MS), r.tempo_morto_min ?? 120, r.tempo_morto_max ?? 480);
        t.tempoMorto = Math.max(t.tempoMorto, durata);
        t.rottaRif = this.rotta;
      } else {
        if (Math.abs(this.omega) < 0.05 && scarto > 2) {
          t.sigmaDoppia = r.durata_piccola_accostata ?? 60;
          t.rottaRif = this.rotta;
        }
        if (t.tempoMorto > 0) {
          t.tempoMorto = Math.max(0, t.tempoMorto - dt);
          if (t.tempoMorto === 0) this._rapporto('sonar', 'towed.stabilizzata');
        }
      }
      if (t.sigmaDoppia > 0) t.sigmaDoppia = Math.max(0, t.sigmaDoppia - dt);
    }
  }

  /**
   * L'antenna da' fasci adesso? (filata, fuori dal tempo morto, a velocita' utile)
   */
  get towedUtile() {
    const t = this.towed;
    if (!t || t.stato !== 'filata' || t.tempoMorto > 0) return false;
    const r = this.p.sensori.rimorchiata;
    const v = Math.abs(this.velocita);
    return v >= (r.velocita_min ?? 3) && v <= (r.velocita_sorda ?? 12);
  }

  /**
   * Posizione del centro dell'antenna (a poppa lungo la rotta) e asse.
   * @returns {{x: number, y: number, z: number, asse: number} | null}
   */
  posizioneTowed() {
    const t = this.towed;
    if (!t || t.quota === null) return null;
    const r = this.p.sensori.rimorchiata;
    const dietro = t.filato - (r.lunghezza_antenna ?? 0) / 2 + this.p.dimensioni.lunghezza / 2;
    const th = gradiInRadianti(this.rotta);
    return { x: this.x - dietro * Math.sin(th), y: this.y - dietro * Math.cos(th), z: t.quota, asse: this.rotta };
  }

  // -------------------------------------------------------------------------
  // Acustica (interfaccia Sorgente di sensors/passivo.js)
  // -------------------------------------------------------------------------

  /** Dove nasce il rumore: l'elica, sull'asse dello scafo. */
  posizioneAcustica() {
    return { x: this.x, y: this.y, z: Math.max(1, this.z - this.ac.sottomarini.elica_sopra_chiglia) };
  }

  /**
   * Livello spettrale irradiato nella banda verso chi ascolta.
   * @param {ValoriAcustica} ac
   * @param {NomeBanda} banda
   * @param {number} cosAspetto
   */
  livello(ac, banda, cosAspetto) {
    return livelloSottomarino(this.p, ac, banda, this.velocita, this.cavitante, cosAspetto)
      + (this.transitorio ? ac.sottomarini.soffiaggio_emergenza : 0);
  }

  // -------------------------------------------------------------------------
  // Viste
  // -------------------------------------------------------------------------

  /**
   * Lo stato del proprio battello per il client (messaggio `stato`).
   * @param {number} ora s di gioco
   * @param {Ambiente} amb
   * @param {string[]} avvisi
   * @returns {Omit<import('../../../../shared/protocol.js').MsgStato, 't'>}
   */
  statoPerClient(ora, amb, avvisi) {
    const t = this.towed;
    const strato = amb.strato(this.x, this.y);
    return {
      ora,
      x: arrotonda(this.x, 1),
      y: arrotonda(this.y, 1),
      z: arrotonda(this.z, 1),
      rotta: arrotonda(this.rotta, 1),
      velocita: arrotonda(this.velocita, 2),
      velocita_verticale: arrotonda(this.wz, 2),
      assetto: arrotonda(this.assetto, 1),
      giri: Math.round(this.vElica * this.p.propulsione.giri_per_nodo),
      macchina: this.macchina,
      timone: arrotonda(this.timone, 1),
      timoni_o: arrotonda(this.timoniO, 1),
      rotta_ordinata: this.autopilota.attivo ? null : this.rottaOrdinata,
      quota_ordinata: this.modoQuota === 'manuale' ? null : this.quotaOrdinata,
      modo_quota: this.modoQuota,
      autopilota: {
        attivo: this.autopilota.attivo,
        waypoint: this.autopilota.waypoint.map((w) => /** @type {[number, number]} */ ([w.x, w.y])),
        prossimo: this.autopilota.attivo ? this.autopilota.prossimo : null,
      },
      cavitazione: this.cavitante,
      v_cavitazione: arrotonda(this.vCavitazione, 1),
      towed: t ? {
        stato: t.stato,
        filato_m: Math.round(t.filato),
        quota: t.quota === null ? null : Math.round(t.quota),
        tempo_morto: Math.ceil(t.tempoMorto),
        sorda: t.stato === 'filata' && !this.towedUtile,
      } : null,
      fondale: arrotonda(Math.max(0, this.profonditaAcqua - this.z), 1),
      profondita_acqua: arrotonda(this.profonditaAcqua, 1),
      strato: strato ? Math.round(strato.quota) : null,
      avvisi,
      danni: { ...this.danni },
    };
  }

  /**
   * La verita' per le istantanee (mai inviata ai client).
   */
  verita() {
    return {
      id: this.id,
      tipo: this.tipo,
      x: arrotonda(this.x, 2),
      y: arrotonda(this.y, 2),
      z: arrotonda(this.z, 2),
      rotta: arrotonda(this.rotta, 3),
      velocita: arrotonda(this.velocita, 3),
      assetto: arrotonda(this.assetto, 2),
      macchina: this.macchina,
      timone: arrotonda(this.timone, 2),
      cavitante: this.cavitante,
      towed: this.towed ? { stato: this.towed.stato, filato: arrotonda(this.towed.filato, 1), quota: this.towed.quota === null ? null : arrotonda(this.towed.quota, 1) } : null,
    };
  }
}

/**
 * @param {number} v @param {number} min @param {number} max
 */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/**
 * @param {number} v @param {number} cifre
 */
export function arrotonda(v, cifre) {
  const k = 10 ** cifre;
  const r = Math.round(v * k) / k;
  return r === 0 ? 0 : r;
}
