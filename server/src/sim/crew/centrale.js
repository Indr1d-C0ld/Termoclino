// @ts-check
/**
 * La centrale di tiro: la TMA dell'equipaggio sulle tracce, secondo il
 * livello di assistenza (PROGETTO §5.6, F2_ASCOLTARE #8-#9):
 *
 *  - 0 Manuale: niente; il comandante lavora con le misure (`tracce`, `sonar`)
 *    e gli strumenti di shared/tma.js nel client. L'equipaggio ripete solo la
 *    soluzione che il comandante gli da' (`soluzione`, origine 'comandante');
 *  - 1 MATE: in piu', a ogni cambio di gamba la distanza di Ekelund
 *    (`tma.ekelund`) e l'avviso quando senza manovra la distanza non e'
 *    osservabile (`tma.distanza_non_osservabile`); i residui del MATE li
 *    calcola il client;
 *  - 2 Auto-TMA: lo stimatore a massima verosimiglianza (shared/tma.js) su ogni
 *    traccia risolta, ogni 10 s di gioco: soluzione, ellisse, Q; il rapporto
 *    `tma.soluzione` quando Q arriva alla soglia di tiro, il consiglio di
 *    manovra («accosti di 90° a sinistra per 6 minuti») quando la soluzione
 *    non basta e l'avviso di distanza non osservabile;
 *  - 3 1989: come il 2; dopo il «fix» la lettera esatta, ma solo per i
 *    contatti non umani: questo lo decide la partita (che conosce la verita'),
 *    non la centrale.
 *
 * Tutto quello che entra qui sono misure (i punti tempo-rilevamento delle
 * tracce) e la navigazione propria.
 */

import {
  Q_TIRO, ekelundGambe, stimaMV, consiglioManovra, scartoDallaRetta, trovaGambe, norm180, NODO_MS,
  velocitaRilevamento, avanzaStato, inPolare, propaga, DISTANZA_MINIMA_EQUIPAGGIO,
} from '../../../../shared/tma.js';

/** @typedef {import('../../../../shared/tma.js').Stima} Stima */
/** @typedef {import('../../../../shared/tma.js').StatoCartesiano} StatoCartesiano */
/** @typedef {import('../../../../shared/tma.js').Misura} Misura */
/** @typedef {import('./tracce.js').Traccia} Traccia */
/** @typedef {import('../platform/battello.js').Rapporto} Rapporto */

/** Parametri della centrale (nozionali). */
export const CENTRALE = Object.freeze({
  /** s fra due stime di una traccia (e fra due `soluzione` ai livelli 2-3) */
  PERIODO: 10,
  /** s fra due stime nuove di una traccia (in mezzo la stima si propaga) */
  PERIODO_STIMA: 30,
  /** s fra due stime con tutte le partenze e il profilo della distanza (le altre partono dalla precedente) */
  PERIODO_MULTIPLA: 120,
  /** stime complete al piu' per giro della centrale (le altre al giro dopo): niente picchi di calcolo */
  MULTIPLE_PER_GIRO: 2,
  /** punti e durata minimi per una stima */
  PUNTI_MIN: 12,
  DURATA_MIN: 120,
  /** s finali confrontati con la stima precedente per scoprire una manovra del bersaglio */
  FINESTRA_MANOVRA: 180,
  /** χ² medio (con σ ≥ 1°) di quegli ultimi minuti oltre cui il bersaglio ha manovrato */
  CHI2_MANOVRA: 16,
  /** s senza punti oltre cui la soluzione riparte (un altro bersaglio puo' aver preso la traccia) */
  SILENZIO_MAX: 60,
  /** scarto normalizzato di due punti di fila dalla retta precedente oltre cui la traccia ha cambiato bersaglio */
  Z_SALTO: 5,
  /** s di storia tenuti dopo una manovra del bersaglio */
  FINESTRA_DOPO_MANOVRA: 360,
  /** s di traccia senza manovra propria prima dell'avviso di distanza non osservabile */
  NON_OSSERVABILE_DOPO: 180,
  /** s fra due consigli di manovra per lo stesso contatto */
  CONSIGLIO_OGNI: 300,
  /** s di gamba dritta prima di un consiglio */
  GAMBA_MIN_CONSIGLIO: 120,
  /** s di storia propria tenuti per le gambe */
  STORIA_PROPRIA: 2400,
  /** soglie di Q che il diario registra quando si attraversano */
  SOGLIE_Q: Object.freeze([30, 50, 70, 90]),
  /** s fra due campioni di soluzione nel diario */
  CAMPIONE_DIARIO: 60,
});

/**
 * Lo stato TMA di una traccia (sta in `traccia.tma`).
 * @typedef {object} StatoTma
 * @property {Stima | null} stima  l'ultima stima dell'equipaggio
 * @property {number} ultimaMultipla
 * @property {number} finestraDa  ora da cui si usano i punti (dopo una manovra del bersaglio)
 * @property {boolean} riferitoTiro  `tma.soluzione` gia' detto (si riarma sotto Q 50)
 * @property {number} fascia  fascia di Q dell'ultima soluzione (indice in SOGLIE_Q, −1 sotto la prima)
 * @property {number} ultimoCampione
 * @property {number} ultimoConsiglio
 * @property {number} gambaNonOsservabile  inizio della gamba propria per cui si e' gia' avvisato
 * @property {Set<string>} ekelund  coppie di gambe gia' riferite
 * @property {StatoCartesiano | null} comandante  la soluzione del comandante
 * @property {number} fixDa  ora da cui la traccia e' tenuta senza interruzioni (per il «fix» del livello 3)
 * @property {number} ultimaMisura  ora dell'ultimo punto usato dalla stima
 * @property {number} ultimaStima  ora dell'ultima stima nuova
 * @property {number} fattoreProfilo  il fattore del profilo della distanza dell'ultima stima completa
 * @property {number} controllato  ora dell'ultimo punto controllato per i salti
 * @property {number} sospetto  ora del primo punto fuori retta (−Infinity se nessuno)
 * @property {number} salto  ora dell'ultimo salto: la soluzione usa i punti da qui
 */

/**
 * @param {Traccia} t
 * @returns {StatoTma}
 */
export function tmaDi(t) {
  if (!('stima' in t.tma)) {
    Object.assign(t.tma, /** @type {StatoTma} */ ({
      stima: null, ultimaMultipla: -Infinity, finestraDa: -Infinity, riferitoTiro: false, fascia: -2,
      ultimoCampione: -Infinity, ultimoConsiglio: -Infinity, gambaNonOsservabile: -Infinity, ekelund: new Set(),
      comandante: null, fixDa: t.designata, ultimaMisura: -Infinity, ultimaStima: -Infinity, fattoreProfilo: 1,
      controllato: -Infinity, sospetto: -Infinity, salto: -Infinity,
    }));
  }
  return /** @type {StatoTma} */ (/** @type {unknown} */ (t.tma));
}

/**
 * Fatti della centrale per il diario (senza verita').
 * @typedef {{tipo: 'soluzione', traccia: Traccia, stima: Stima, motivo: 'prima' | 'soglia' | 'campione'}
 *   | {tipo: 'consiglio', traccia: Traccia, accostata: number, lato: string, minuti: number}} FattoCentrale
 */

/**
 * Una `soluzione` pronta per il messaggio (senza `esatta`, che aggiunge la partita).
 * @typedef {object} SoluzioneMsg
 * @property {string} contatto
 * @property {number} ora
 * @property {number} rilevamento
 * @property {number} distanza
 * @property {number} rotta
 * @property {number} velocita
 * @property {number | null} q
 * @property {{asse_lungo: number, asse_corto: number, orientamento: number} | null} ellisse
 * @property {'equipaggio' | 'comandante'} origine
 */

export class Centrale {
  /**
   * @param {object} a
   * @param {number} a.livello  0-3
   */
  constructor(a) {
    this.livello = a.livello;
    /** @type {{ora: number, x: number, y: number, rotta: number, velocita: number}[]} storia propria (1 Hz) */
    this.propri = [];
    /** @type {FattoCentrale[]} */
    this.fatti = [];
    /** stime complete ancora possibili in questo giro */
    this._budget = CENTRALE.MULTIPLE_PER_GIRO;
  }

  /**
   * La navigazione propria, ogni secondo.
   * @param {number} ora @param {{x: number, y: number, rotta: number, velocita: number}} b
   */
  campione(ora, b) {
    this.propri.push({ ora, x: b.x, y: b.y, rotta: b.rotta, velocita: b.velocita });
    const limite = ora - CENTRALE.STORIA_PROPRIA;
    let i = 0;
    while (i < this.propri.length && this.propri[i].ora < limite) i++;
    if (i > 0) this.propri.splice(0, i);
  }

  /**
   * La propria posizione a un'ora (campione piu' vicino, estrapolato col suo moto).
   * @param {number} ora
   * @returns {{x: number, y: number}}
   */
  posizioneAllOra(ora) {
    const p = this.propri;
    if (!p.length) return { x: 0, y: 0 };
    let i = 0;
    while (i < p.length - 1 && p[i + 1].ora <= ora) i++;
    const c = p[i];
    const dt = ora - c.ora;
    const v = c.velocita * NODO_MS;
    const th = c.rotta * Math.PI / 180;
    return { x: c.x + v * dt * Math.sin(th), y: c.y + v * dt * Math.cos(th) };
  }

  /** La gamba propria in corso: da quando rotta e velocita' sono ferme. */
  gambaCorrente() {
    const p = this.propri;
    if (!p.length) return null;
    const ultimo = p[p.length - 1];
    let i = p.length - 1;
    while (i > 0 && Math.abs(norm180(p[i - 1].rotta - ultimo.rotta)) <= 3 && Math.abs(p[i - 1].velocita - ultimo.velocita) <= 1) i--;
    return { da: p[i].ora, a: ultimo.ora, rotta: ultimo.rotta, velocita: ultimo.velocita };
  }

  /**
   * I punti della traccia che la TMA usa (dalla finestra in poi).
   * @param {Traccia} t
   * @returns {Misura[] | null}
   */
  punti(t) {
    const p = t.punti;
    if (!p) return null;
    const s = tmaDi(t);
    // Dopo un silenzio lungo non si puo' essere sicuri che il contatto
    // ritrovato sia lo stesso (due bersagli che s'incrociano sotto il fascio
    // si scambiano la traccia): la soluzione riparte dal ritrovamento.
    let da = s.finestraDa;
    for (let i = p.length - 1; i > 0; i--) {
      if (p[i].ora - p[i - 1].ora > CENTRALE.SILENZIO_MAX) { da = Math.max(da, p[i].ora - 1e-6); break; }
    }
    // Salti: un punto lontano dalla retta dei nove punti prima (con σ di
    // almeno 1°), seguito da un altro altrettanto lontano, e' l'inizio di un
    // altro bersaglio, non una misura storta.
    for (let i = 0; i < p.length; i++) {
      if (p[i].ora <= s.controllato) continue;
      s.controllato = p[i].ora;
      const prima = p.slice(Math.max(0, i - 9), i).filter((m) => m.ora >= p[i].ora - 300 && m.ora >= s.salto);
      if (prima.length < 4) { s.sospetto = -Infinity; continue; }
      const br = velocitaRilevamento(prima);
      if (!br) continue;
      const atteso = br.rilevamento + br.variazione / 60 * (p[i].ora - br.ora);
      const z = Math.abs(norm180(p[i].rilevamento - atteso)) / Math.hypot(Math.max(1, p[i].sigma), br.sigmaRilevamento * 3);
      if (z > CENTRALE.Z_SALTO) {
        if (s.sospetto > -Infinity) { s.salto = s.sospetto; s.sospetto = -Infinity; } else s.sospetto = p[i].ora - 1e-6;
      } else {
        s.sospetto = -Infinity;
      }
    }
    da = Math.max(da, s.salto);
    return da > -Infinity ? p.filter((m) => m.ora >= da) : p;
  }

  /**
   * Il lavoro di ogni PERIODO secondi: stime, rapporti, soluzioni da mandare.
   * @param {number} ora
   * @param {Traccia[]} tracce  designate
   * @param {{x: number, y: number, rotta: number, velocita: number}} proprio  posizione e moto attuali
   * @param {{designato: string | null, sigmaFutura?: (relativo: number) => number, tempoMorto?: number}} [o]
   * @returns {{rapporti: Rapporto[], soluzioni: SoluzioneMsg[]}}
   */
  lavora(ora, tracce, proprio, o = { designato: null }) {
    /** @type {Rapporto[]} */
    const rapporti = [];
    /** @type {SoluzioneMsg[]} */
    const soluzioni = [];
    const gamba = this.gambaCorrente();
    // Il contatto su cui la centrale lavora a voce (avvisi, Ekelund, consigli):
    // il designato, o la traccia risolta tenuta da piu' tempo.
    const tenute = tracce.filter((t) => t.contatto !== null && t.stato !== 'persa' && !t.ambigua);
    const fuoco = tenute.find((t) => t.contatto === o.designato) ?? tenute[0] ?? null;
    // Le stime complete (tutte le partenze e il profilo della distanza) costano:
    // al piu' MULTIPLE_PER_GIRO per giro, le altre aspettano il giro dopo.
    this._budget = CENTRALE.MULTIPLE_PER_GIRO;
    for (const t of tracce) {
      if (t.contatto === null) continue;
      const s = tmaDi(t);
      if (t.stato === 'persa') { s.fixDa = Infinity; continue; }
      if (s.fixDa === Infinity) s.fixDa = ora;
      const punti = this.punti(t);
      const pronta = punti !== null && punti.length >= CENTRALE.PUNTI_MIN && punti[punti.length - 1].ora - punti[0].ora >= CENTRALE.DURATA_MIN;

      // Distanza non osservabile: la traccia e' tenuta da un pezzo e il
      // proprio moto, da quando la si tiene, e' una retta.
      if (pronta && t === fuoco && this.livello >= 1 && gamba && ora - gamba.da >= CENTRALE.NON_OSSERVABILE_DOPO
        && scartoDallaRetta(/** @type {Misura[]} */ (punti)) < 25 && s.gambaNonOsservabile !== gamba.da) {
        s.gambaNonOsservabile = gamba.da;
        rapporti.push({ chi: 'tiro', chiave: 'tma.distanza_non_osservabile', parametri: { contatto: t.contatto } });
        if (this.livello >= 2) {
          const c = this._consiglio(t, ora, proprio, o, /** @type {Misura[]} */ (punti), null);
          if (c) rapporti.push(c);
        }
      }

      // Livello 1: Ekelund a ogni cambio di gamba.
      if (pronta && t === fuoco && this.livello === 1) {
        const gambe = trovaGambe(this.propri, { durataMinima: 120 });
        const e = ekelundGambe(/** @type {Misura[]} */ (punti), gambe).filter((x) => x.valida);
        const ultima = e[e.length - 1];
        if (ultima) {
          const chiave = `${ultima.da.da}:${ultima.a.da}`;
          if (!s.ekelund.has(chiave) && ultima.a.a >= ora - 15) {
            s.ekelund.add(chiave);
            rapporti.push({ chi: 'tiro', chiave: 'tma.ekelund', parametri: { contatto: t.contatto, distanza: Math.round(ultima.distanza / 10) * 10 } });
          }
        }
      }

      // Livelli 2-3: lo stimatore.
      if (this.livello >= 2 && pronta) {
        const st = this._stima(t, ora, proprio, /** @type {Misura[]} */ (punti));
        if (st) this._dopoStima(t, st, ora, proprio, o, rapporti, /** @type {Misura[]} */ (punti), t === fuoco ? gamba : null);
      }

      // Le soluzioni da mandare.
      if (s.comandante) {
        soluzioni.push(this.messaggioComandante(t, ora, proprio));
      } else if (this.livello >= 2 && s.stima && s.stima.osservabile) {
        soluzioni.push(messaggioStima(/** @type {string} */ (t.contatto), s.stima));
      }
    }
    return { rapporti, soluzioni };
  }

  /**
   * @param {Traccia} t @param {number} ora @param {{x: number, y: number}} proprio @param {Misura[]} punti
   * @returns {Stima | null}
   */
  _stima(t, ora, proprio, punti) {
    const s = tmaDi(t);
    // La stima si fa all'ora dell'ultima misura (dove i dati la sostengono) e
    // poi si porta ad adesso con la covarianza propagata: una traccia che non
    // si sente da un po' ha una soluzione che invecchia, non una nuova.
    const tUltima = punti[punti.length - 1].ora;
    if (s.stima && (s.ultimaMisura === tUltima || ora - s.ultimaStima < CENTRALE.PERIODO_STIMA)) {
      s.stima = propaga(s.stima, ora, { x: proprio.x, y: proprio.y });
      return s.stima;
    }
    s.ultimaMisura = tUltima;
    s.ultimaStima = ora;
    const rifUltima = this.posizioneAllOra(tUltima);
    const vuole = !s.stima || ora - s.ultimaMultipla >= CENTRALE.PERIODO_MULTIPLA
      || (s.stima.q < 30 && ora - s.ultimaMultipla >= CENTRALE.PERIODO_STIMA);
    const multipla = vuole && (this._budget > 0 || !s.stima);
    if (multipla) this._budget--;
    const comuni = { ora: tUltima, riferimento: rifUltima, robusta: true, distanzaMinima: distanzaMinima(t.seMedio) };
    let st = stimaMV(punti, { ...comuni, iniziale: s.stima, multipla, profilo: multipla ? true : s.fattoreProfilo });
    if (multipla) {
      s.ultimaMultipla = ora;
      if (st) s.fattoreProfilo = st.fattoreProfilo ?? 1;
    }
    // Manovra del bersaglio: la stima fatta senza gli ultimi tre minuti (se
    // era buona) non spiega gli ultimi tre minuti. Il confronto si fa con
    // σ ≥ 1°: un errore sistematico di un paio di gradi (due bersagli che si
    // incrociano sotto il fascio) non e' una manovra; una virata si', dopo
    // pochi minuti. Allora la storia si accorcia e Q crolla finche' una nuova
    // gamba propria non rende di nuovo osservabile la distanza.
    const recenti = punti.filter((m) => m.ora >= ora - CENTRALE.FINESTRA_MANOVRA);
    const vecchi = punti.filter((m) => m.ora < ora - CENTRALE.FINESTRA_MANOVRA);
    if (multipla && recenti.length >= 12 && vecchi.length >= CENTRALE.PUNTI_MIN
      && punti[0].ora < ora - CENTRALE.FINESTRA_DOPO_MANOVRA) {
      const prima = stimaMV(vecchi, { ...comuni, profilo: false });
      if (prima && prima.q >= 30) {
        let c = 0;
        let somma = 0;
        for (const m of recenti) {
          const dt = m.ora - prima.ora;
          const b = Math.atan2(prima.x + prima.vx * dt - m.x, prima.y + prima.vy * dt - m.y) * 180 / Math.PI;
          const z = norm180(m.rilevamento - b) / Math.max(1, m.sigma);
          c += z * z;
          somma += z;
        }
        if (c / recenti.length > CENTRALE.CHI2_MANOVRA && Math.abs(somma / recenti.length) > 3) {
          s.finestraDa = ora - CENTRALE.FINESTRA_DOPO_MANOVRA;
          const corti = punti.filter((m) => m.ora >= s.finestraDa);
          st = corti.length >= CENTRALE.PUNTI_MIN ? stimaMV(corti, comuni) : null;
          if (st) s.fattoreProfilo = st.fattoreProfilo ?? 1;
          if (!st) { s.stima = null; return null; }
        }
      }
    }
    if (!st) return null;
    st = propaga(st, ora, { x: proprio.x, y: proprio.y });
    s.stima = st;
    return st;
  }

  /**
   * Rapporti e fatti dopo una stima.
   * @param {Traccia} t @param {Stima} st @param {number} ora
   * @param {{x: number, y: number, rotta: number, velocita: number}} proprio
   * @param {{designato: string | null, sigmaFutura?: (relativo: number) => number, tempoMorto?: number}} o
   * @param {Rapporto[]} rapporti @param {Misura[]} punti
   * @param {{da: number} | null} gamba
   */
  _dopoStima(t, st, ora, proprio, o, rapporti, punti, gamba) {
    const s = tmaDi(t);
    const contatto = /** @type {string} */ (t.contatto);
    if (!st.osservabile) return;
    const fascia = CENTRALE.SOGLIE_Q.filter((q) => st.q >= q).length - 1;
    /** @type {'prima' | 'soglia' | 'campione' | null} */
    let motivo = null;
    if (s.fascia === -2) motivo = 'prima';
    else if (fascia !== s.fascia) motivo = 'soglia';
    else if (ora - s.ultimoCampione >= CENTRALE.CAMPIONE_DIARIO) motivo = 'campione';
    s.fascia = fascia;
    if (motivo) {
      s.ultimoCampione = ora;
      this.fatti.push({ tipo: 'soluzione', traccia: t, stima: st, motivo });
    }
    if (st.q >= Q_TIRO && !s.riferitoTiro) {
      s.riferitoTiro = true;
      rapporti.push({ chi: 'tiro', chiave: 'tma.soluzione', parametri: { contatto, q: st.q } });
    } else if (st.q < 50) {
      s.riferitoTiro = false;
    }
    // Consiglio di manovra (solo sul contatto di lavoro, `gamba` non nulla):
    // soluzione insufficiente, gamba dritta da un po'.
    if (st.q < Q_TIRO && gamba && ora - gamba.da >= CENTRALE.GAMBA_MIN_CONSIGLIO
      && ora - s.ultimoConsiglio >= CENTRALE.CONSIGLIO_OGNI) {
      const c = this._consiglio(t, ora, proprio, o, punti, st);
      if (c) rapporti.push(c);
    }
  }

  /**
   * Il consiglio di manovra per una traccia (null se tirare dritto basta).
   * @param {Traccia} t @param {number} ora
   * @param {{x: number, y: number, rotta: number, velocita: number}} proprio
   * @param {{sigmaFutura?: (relativo: number) => number, tempoMorto?: number}} o
   * @param {Misura[]} punti @param {Stima | null} st
   * @returns {Rapporto | null}
   */
  _consiglio(t, ora, proprio, o, punti, st) {
    const s = tmaDi(t);
    /** @type {StatoCartesiano[]} */
    let ipotesi;
    if (st && st.osservabile) {
      // la stima e due distanze diverse sulla stessa linea di vista: il
      // consiglio deve reggere anche se la stima sbaglia
      ipotesi = [0.6, 1, 1.6].map((k) => ipotesiADistanza(st.distanza * k, st.rilevamento, punti, ora, proprio));
    } else {
      const ultimo = punti[punti.length - 1];
      ipotesi = [2000, 5000, 12000].map((R) => ipotesiADistanza(R, ultimo.rilevamento, punti, ora, proprio));
    }
    const c = consiglioManovra({
      misure: punti, ipotesi,
      proprio: { ora, x: proprio.x, y: proprio.y, rotta: proprio.rotta, velocita: Math.max(3, Math.abs(proprio.velocita)) },
      sigma: o.sigmaFutura, tempoMorto: o.tempoMorto ?? 0, periodo: 30,
    });
    s.ultimoConsiglio = ora;
    if (!c.lato || c.accostata === 0) return null;
    this.fatti.push({ tipo: 'consiglio', traccia: t, accostata: c.accostata, lato: c.lato, minuti: c.minuti });
    return {
      chi: 'tiro', chiave: 'tma.consiglio_manovra',
      parametri: { contatto: /** @type {string} */ (t.contatto), accostata: c.accostata, lato: c.lato, minuti: c.minuti },
    };
  }

  /**
   * La soluzione del comandante (ordine `soluzione`), o null per cancellarla.
   * @param {Traccia} t @param {StatoCartesiano | null} sol
   */
  comandante(t, sol) {
    tmaDi(t).comandante = sol;
  }

  /**
   * Il messaggio della soluzione del comandante portata a `ora`.
   * @param {Traccia} t @param {number} ora @param {{x: number, y: number}} proprio
   * @returns {SoluzioneMsg}
   */
  messaggioComandante(t, ora, proprio) {
    const sol = /** @type {StatoCartesiano} */ (tmaDi(t).comandante);
    const p = inPolare(avanzaStato(sol, ora), proprio);
    return {
      contatto: /** @type {string} */ (t.contatto), ora,
      rilevamento: Math.round(p.rilevamento * 10) / 10, distanza: Math.round(p.distanza),
      rotta: Math.round(p.rotta) % 360, velocita: Math.round(p.velocita * 10) / 10,
      q: null, ellisse: null, origine: 'comandante',
    };
  }
}

/**
 * La distanza sotto cui l'equipaggio non crede a una soluzione, dal segnale
 * misurato della traccia (nozionale): con la taratura della palestra
 * (docs/CALIBRAZIONE_F1.md §3) un 688 a 5 nodi, la sorgente piu' silenziosa
 * della biblioteca, sta a 0 dB di eccesso intorno ai 4-5 km e guadagna circa
 * 6 dB a ogni dimezzamento della distanza: un contatto che resta sotto i
 * 15 dB e' oltre i 2 km, uno sotto i 30 dB oltre il chilometro.
 * @param {number | null} se  dB
 */
export function distanzaMinima(se) {
  if (se === null || se < 15) return 2 * DISTANZA_MINIMA_EQUIPAGGIO;
  if (se < 30) return DISTANZA_MINIMA_EQUIPAGGIO;
  return 300;
}

/**
 * Il messaggio di una stima dell'equipaggio (arrotondato: distanza al metro,
 * rotta al grado, velocita' al decimo di nodo, ellisse al metro e al grado).
 * @param {string} contatto @param {Stima} st
 * @returns {SoluzioneMsg}
 */
export function messaggioStima(contatto, st) {
  return {
    contatto, ora: st.ora,
    rilevamento: Math.round(st.rilevamento * 10) / 10,
    distanza: Math.round(st.distanza),
    rotta: Math.round(st.rotta) % 360,
    velocita: Math.round(st.velocita * 10) / 10,
    q: st.q,
    ellisse: st.ellisse ? {
      asse_lungo: Math.round(Math.min(st.ellisse.asse_lungo, 1e6)),
      asse_corto: Math.round(Math.min(st.ellisse.asse_corto, 1e6)),
      orientamento: Math.round(st.ellisse.orientamento) % 180,
    } : null,
    origine: 'equipaggio',
  };
}

/**
 * Un bersaglio ipotetico a distanza R sul rilevamento dato, con la velocita'
 * che spiega il bearing rate misurato (velocita' radiale relativa nulla).
 * @param {number} R @param {number} ril @param {Misura[]} punti @param {number} ora
 * @param {{x: number, y: number, rotta: number, velocita: number}} proprio
 * @returns {StatoCartesiano}
 */
function ipotesiADistanza(R, ril, punti, ora, proprio) {
  const br = velocitaRilevamento(punti, { da: ora - 240 }) ?? { variazione: 0 };
  const b = ril * Math.PI / 180;
  const rate = br.variazione * Math.PI / 180 / 60;
  const vo = proprio.velocita * NODO_MS;
  const c = proprio.rotta * Math.PI / 180;
  return {
    ora, x: proprio.x + R * Math.sin(b), y: proprio.y + R * Math.cos(b),
    vx: vo * Math.sin(c) + R * rate * Math.cos(b), vy: vo * Math.cos(c) - R * rate * Math.sin(b),
  };
}


