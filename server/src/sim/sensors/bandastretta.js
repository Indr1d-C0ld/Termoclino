// @ts-check
/**
 * Banda stretta (F2): le righe tonali di ogni sorgente, sentite una per una
 * con il guadagno della cella stretta, e i due prodotti che ne vengono:
 *
 *  - il **fotogramma a banda stretta** su tutti i fasci (messaggio `sonar` con
 *    `banda: 'stretta'`, ogni SPETTRO.PERIODO s): in ogni settore l'eccesso di
 *    segnale della riga piu' forte della finestra, steso col fascio alla
 *    frequenza di quella riga (piu' largo in basso). E' cio' su cui l'equipaggio
 *    scopre i contatti dalle righe: il vantaggio vero dell'antenna rimorchiata;
 *  - lo **spettro del fascio puntato** (messaggio `spettro`): il LOFAR (righe e
 *    fondo a banda larga, cella per cella) e il DEMON (lo spettro della
 *    modulazione d'ampiezza del rumore: righe d'asse e di pala).
 *
 * L'equazione di una riga di livello L (dB re 1 µPa² nella cella, alla sorgente):
 *
 *   SE = L − TL(f) − NL(f) + DI(f) + R(f) − DT_riga − degrado + x
 *   DT_riga = 5·log10(d·B/t)          (B cella, t integrazione: banda_stretta)
 *
 * con NL(f) = mare ⊕ rumore proprio alla frequenza, DI e fascio ricavati dalla
 * geometria del sensore (sfera 20·log f, antenna lineare 10·log f, dai valori di
 * riferimento dei dati), R(f) la risposta fuori banda, x la fluttuazione di
 * Ornstein-Uhlenbeck della coppia (σ e τ di acustica.json, passo di 4 s). La
 * frequenza osservata ha lo spostamento Doppler della velocita' radiale.
 *
 * Il DEMON: con s il rapporto segnale/rumore della sorgente nella banda a banda
 * larga del sensore (lineare, dentro il fascio), S la somma di tutte le
 * sorgenti nel fascio, m l'indice di modulazione a quella riga (pala, asse,
 * armoniche), nella cella b
 *
 *   r = (m²/2)·(s/(1+S))²·(B_banda/b),   SE = 10·log10 r − 5·log10(d/(b·t))
 *
 * (modello nozionale dichiarato in acustica.json, demon): serve un contatto
 * gia' forte a banda larga, e l'elica che cavita lo rende evidente.
 *
 * Come in passivo.js la verita' (posizioni) si usa solo qui dentro; fuori escono
 * i byte quantizzati. I `contributi` (sorgente, rilevamento misurato, SE,
 * distanza vera) restano sul server: li usa l'arbitro per il diario.
 */

import { normalizza180, normalizza360, NODO_MS, gradiInRadianti } from '../../../../shared/units.js';
import { rilevamento } from '../../../../shared/geo.js';
import { SONAR, SPETTRO, centroSettore, quantizzaSE } from '../../../../shared/protocol.js';
import { guadagnoFascio, rumoreProprioSferaA, rumoreProprioTowedA, sigmaRilevamento, sommaDb } from './acustica.js';
import { percorsoPerdita } from './perdita.js';
import { Generatore } from '../../../../shared/rng.js';

/** @typedef {import('./acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../world/ambiente.js').Ambiente} Ambiente */
/** @typedef {import('./passivo.js').SensorePassivo} SensorePassivo */
/** @typedef {import('./passivo.js').Fotogramma} Fotogramma */
/** @typedef {import('../platform/battello.js').RigaIrradiata} RigaIrradiata */
/** @typedef {import('../platform/battello.js').Modulazione} Modulazione */

/**
 * Una sorgente come la vede la banda stretta: quella di passivo.js piu' le
 * righe, la banda larga a ogni frequenza e la modulazione dell'elica.
 * @typedef {import('./passivo.js').Sorgente & {
 *   velocita?: number,
 *   righe?: (ac: ValoriAcustica, cosAspetto: number) => RigaIrradiata[],
 *   livelloA?: (ac: ValoriAcustica, f: number, cosAspetto: number) => number,
 *   modulazione?: () => Modulazione | null,
 * }} SorgenteBS
 */

/**
 * Cio' che serve di una sorgente in questo istante.
 * @typedef {object} Vista
 * @property {SorgenteBS} s
 * @property {{x: number, y: number, z: number}} ps
 * @property {number} theta rilevamento vero
 * @property {number} rel rispetto all'asse del sensore
 * @property {number} d distanza, m
 * @property {number} cosAspetto
 * @property {number} doppler fattore f_osservata / f
 * @property {(f: number | string) => number} [via] la TL del percorso, a ogni frequenza (si calcola alla prima richiesta)
 */

/** Sotto questo SE (dB) una riga non lascia traccia. */
const SE_TRASCURABILE = -40;
/** Punti della griglia di frequenza su cui si calcola il fondo a banda larga del LOFAR. */
const GRIGLIA_CONTINUO = 17;
/** Armoniche di pala al massimo nel DEMON. */
const ARMONICHE_DEMON = 6;
/** Sotto questo SE (dB) il fondo a banda larga di una sorgente non si stende sul LOFAR (il fondo e' a −10). */
const SOGLIA_CONTINUO = -22;

/**
 * La parte di una sorgente che non dipende dal fascio (cache per istante).
 * @typedef {object} Base
 * @property {Vista} v
 * @property {{f: number, se: number, tipo: string}[]} righe
 * @property {Float64Array | null} griglia  SE del fondo a banda larga sulla griglia, senza fascio
 * @property {number} massimo  il massimo della griglia
 * @property {number} snr  rapporto segnale/rumore nella banda del sensore, senza fascio, dB
 * @property {Modulazione | null} mod
 */

export class AnalizzatoreBandaStretta {
  /**
   * @param {object} a
   * @param {SensorePassivo} a.passivo  il sensore a banda larga (geometria, rumore, ciechi)
   * @param {ValoriAcustica} a.ac
   * @param {Generatore} a.rng  sotto-flusso dei fotogrammi a banda stretta (rilevamenti, fondo)
   * @param {(idSorgente: string) => Generatore} a.rngCoppia  fluttuazione di ogni coppia
   */
  constructor(a) {
    this.passivo = a.passivo;
    this.nome = a.passivo.nome;
    this.b = a.passivo.b;
    this.ac = a.ac;
    this.rng = a.rng;
    this.rngCoppia = a.rngCoppia;
    const p = this.b.p;
    const dati = this.nome === 'sfera' ? p.sensori.sfera : p.sensori.rimorchiata;
    this.fRif = dati.frequenza_rif ?? a.ac.bande[this.nome].centro;
    this.diRif = dati.indice_direttivita ?? 0;
    this.fascioRif = dati.fascio_3db ?? 10;
    this.bandaMin = dati.banda_min ?? 0;
    this.bandaMax = dati.banda_max ?? Infinity;
    this.esponenteDi = this.nome === 'sfera' ? 20 : 10;
    this.sigmaMin = dati.sigma_min ?? 1;
    this.coefficiente = dati.coefficiente_sigma ?? 0.5;
    this.finestra = SPETTRO[this.nome];
    const bs = a.ac.banda_stretta;
    const d = a.ac.rivelazione.indice_d;
    /** soglia di una riga nella cella, riferita alla potenza della riga sul rumore spettrale */
    this.dtRiga = 5 * Math.log10(d * this.finestra.PASSO_HZ / bs.tempo_integrazione);
    /** soglia del fondo a banda larga nella cella, riferita ai livelli spettrali */
    this.dtContinuo = 5 * Math.log10(d / (this.finestra.PASSO_HZ * bs.tempo_integrazione));
    this.lobi = a.ac.sensori[this.nome].lobi_laterali;
    this.fondoLineare = 10 ** (a.ac.rivelazione.fondo_normalizzato / 10);
    this.c = a.ac.attivo?.velocita_suono ?? 1500;
    /** @type {Map<string, {x: number, rng: Generatore}>} */
    this.fluttuazioni = new Map();
    /** istante a cui valgono le basi in cache (lo fissa chi chiama: l'ora di gioco) */
    this.epoca = 0;
    /** @type {number | null} */
    this._epocaCache = null;
    /** @type {Map<string, Base | null>} */
    this._cache = new Map();
  }

  // -------------------------------------------------------------------------
  // Il sensore alla frequenza f
  // -------------------------------------------------------------------------

  /** @param {number} f Hz */
  di(f) {
    return Math.max(0, this.diRif + this.esponenteDi * Math.log10(f / this.fRif));
  }

  /** Fascio a −3 dB, gradi (al traverso per l'antenna). @param {number} f Hz */
  fascio(f) {
    return Math.min(180, this.fascioRif * this.fRif / Math.max(f, 1));
  }

  /** Risposta fuori dalla banda del sensore, dB ≤ 0. @param {number} f Hz */
  risposta(f) {
    const k = this.ac.banda_stretta.pendenza_fuori_banda;
    if (f < this.bandaMin) return -k * Math.log10(this.bandaMin / Math.max(f, 0.1));
    if (f > this.bandaMax) return -k * Math.log10(f / this.bandaMax);
    return 0;
  }

  /**
   * Rumore alla frequenza f: mare ⊕ rumore proprio del sensore.
   * @param {Ambiente} amb
   * @param {number} f Hz
   */
  rumore(amb, f) {
    const b = this.b;
    const fi = Math.max(1, Math.round(f));
    const proprio = this.nome === 'sfera'
      ? rumoreProprioSferaA(b.p, this.ac, fi, b.velocita, b.cavitante)
      : rumoreProprioTowedA(b.p, this.ac, fi, b.velocita, b.cavitante);
    return sommaDb(amb.rumore(fi), proprio);
  }

  // -------------------------------------------------------------------------
  // Le sorgenti
  // -------------------------------------------------------------------------

  /**
   * Fluttuazione della coppia, avanzata di un periodo (SPETTRO.PERIODO s).
   * @param {string} id
   * @returns {number} dB
   */
  _fluttua(id) {
    const r = this.ac.rivelazione;
    let f = this.fluttuazioni.get(id);
    if (!f) {
      const rng = this.rngCoppia(id);
      f = { x: rng.gaussiana(0, r.fluttuazione_sigma), rng };
      this.fluttuazioni.set(id, f);
      return f.x;
    }
    const a = Math.exp(-SPETTRO.PERIODO / r.fluttuazione_tau);
    f.x = f.x * a + r.fluttuazione_sigma * Math.sqrt(1 - a * a) * f.rng.gaussiana();
    return f.x;
  }

  /** La fluttuazione attuale della coppia, senza avanzarla. @param {string} id */
  _x(id) {
    return this.fluttuazioni.get(id)?.x ?? 0;
  }

  /**
   * Geometria di una sorgente, o null se tace o cade in un settore cieco.
   * @param {SorgenteBS} s
   * @param {NonNullable<ReturnType<SensorePassivo['geometria']>>} g
   * @returns {Vista | null}
   */
  vista(s, g) {
    if (s === /** @type {unknown} */ (this.b)) return null;
    const ps = s.posizioneAcustica();
    const theta = rilevamento(g.pos, ps);
    const rel = normalizza180(theta - g.asse);
    if (this.nome === 'towed') {
      if (Math.abs(rel) < (this.b.p.sensori.rimorchiata.cieco_prua ?? 20)) return null;
    } else if (Math.abs(normalizza180(rel - 180)) < (this.b.p.sensori.sfera.arco_baffles ?? 60) / 2) {
      return null;
    }
    const dx = ps.x - g.pos.x;
    const dy = ps.y - g.pos.y;
    const dz = ps.z - g.pos.z;
    const d = Math.max(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
    const verso = rilevamento(ps, g.pos);
    const cosAspetto = Math.cos((verso - s.rotta) * Math.PI / 180);
    // Doppler: velocita' di avvicinamento lungo la congiungente orizzontale.
    const h = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / h;
    const uy = dy / h;
    const vs = (s.velocita ?? 0) * NODO_MS;
    const ts = gradiInRadianti(s.rotta);
    const vo = this.b.velocita * NODO_MS;
    const to = gradiInRadianti(this.b.rotta);
    const avvicinamento = (vo * Math.sin(to) - vs * Math.sin(ts)) * ux + (vo * Math.cos(to) - vs * Math.cos(ts)) * uy;
    return { s, ps, theta, rel, d, cosAspetto, doppler: 1 + avvicinamento / this.c };
  }

  /**
   * Le righe di una sorgente dentro la finestra, con il loro SE (senza il fascio).
   * @param {Vista} v
   * @param {Ambiente} amb
   * @param {NonNullable<ReturnType<SensorePassivo['geometria']>>} g
   * @param {number} x fluttuazione
   * @returns {{f: number, se: number, tipo: string}[]}
   */
  righeSorgente(v, amb, g, x) {
    const righe = v.s.righe?.(this.ac, v.cosAspetto) ?? [];
    const fin = this.finestra;
    const fMax = fin.DA_HZ + fin.RIGHE * fin.PASSO_HZ;
    /** @type {{f: number, se: number, tipo: string}[]} */
    const out = [];
    /** @type {Map<number, number>} TL per frequenza (arrotondata), dentro questa chiamata */
    const tl = new Map();
    const via = v.via ?? (v.via = percorsoPerdita(this.ac, amb, v.ps, g.pos));
    for (const r of righe) {
      const f = r.f * v.doppler;
      if (!(f >= fin.DA_HZ && f < fMax) || f < 1) continue;
      const risp = this.risposta(f);
      if (risp < -60) continue;
      const fk = Math.round(f);
      let t = tl.get(fk);
      if (t === undefined) { t = via(fk); tl.set(fk, t); }
      const se = r.livello - t - this.rumore(amb, f) + this.di(f) + risp - this.dtRiga - g.degrado + x;
      if (se > SE_TRASCURABILE) out.push({ f, se, tipo: r.tipo });
    }
    return out;
  }

  /**
   * Fascio dell'antenna a un angolo dall'asse (si allarga verso gli assi).
   * @param {number} f
   * @param {number} rel
   */
  _fascioA(f, rel) {
    const base = this.fascio(f);
    if (this.nome !== 'towed') return base;
    return Math.min(180, base / Math.max(1 / this.ac.sensori.towed.allargamento_max, Math.abs(Math.sin(rel * Math.PI / 180))));
  }

  // -------------------------------------------------------------------------
  // Fotogramma a banda stretta su tutti i fasci
  // -------------------------------------------------------------------------

  /**
   * Il fotogramma a banda stretta di questo periodo: stessa forma di quelli a
   * banda larga (passivo.js), piu' `banda: 'stretta'` e i contributi.
   * @param {SorgenteBS[]} sorgenti tutte le entita', in ordine di id
   * @param {Ambiente} amb
   * @returns {Fotogramma | null} null se il sensore non e' in acqua
   */
  fotogramma(sorgenti, amb) {
    const b = this.b;
    const towed = this.nome === 'towed';
    const rim = b.p.sensori.rimorchiata;
    const g = this.passivo.geometria(amb);
    if (!g) return null;
    this._epocaCache = null; // la fluttuazione avanza: le basi degli spettri vanno ricalcolate
    const lineare = new Float64Array(SONAR.SETTORI);
    /** @type {NonNullable<Fotogramma['contributi']>} */
    const contributi = [];
    const sigmaDoppia = towed && (b.towed?.sigmaDoppia ?? 0) > 0 ? (rim.fattore_sigma_piccola_accostata ?? 2) : 1;
    for (const s of sorgenti) {
      if (s === /** @type {unknown} */ (b)) continue;
      const x = this._fluttua(s.id);
      if (g.sorda) continue;
      const v = this.vista(s, g);
      if (!v) continue;
      const righe = this.righeSorgente(v, amb, g, x);
      if (righe.length === 0) continue;
      let migliore = righe[0];
      for (const r of righe) if (r.se > migliore.se) migliore = r;
      if (migliore.se < SE_TRASCURABILE + 10) continue;
      const fascio = this._fascioA(migliore.f, v.rel);
      let sigma = sigmaRilevamento(migliore.se, this.fascio(migliore.f), this.coefficiente, this.sigmaMin) * sigmaDoppia;
      if (towed) {
        const dagliAssi = Math.min(Math.abs(v.rel), 180 - Math.abs(v.rel));
        if (dagliAssi < (rim.arco_estremita ?? 30)) sigma *= rim.fattore_sigma_estremita ?? 3;
      }
      const misurato = normalizza360(v.theta + sigma * this.rng.gaussiana());
      this._stendi(lineare, misurato, migliore.se, fascio);
      if (towed) this._stendi(lineare, normalizza360(2 * g.asse - misurato), migliore.se, fascio);
      contributi.push({
        sorgente: s.id, rilevamento: Math.round(misurato * 10) / 10, se: migliore.se, se_medio: migliore.se - x,
        distanza_vera: v.d, frequenza: Math.round(migliore.f * 10) / 10,
      });
    }
    const settori = new Uint8Array(SONAR.SETTORI);
    for (let k = 0; k < SONAR.SETTORI; k++) {
      const fondo = -Math.log(1 - this.rng.uniforme()) * this.fondoLineare;
      settori[k] = quantizzaSE(10 * Math.log10(lineare[k] + fondo));
    }
    /** @type {Fotogramma} */
    const out = { settori, ciechi: [], banda: 'stretta', contributi };
    if (towed) {
      const cono = rim.cieco_prua ?? 20;
      out.asse = Math.round(g.asse * 10) / 10;
      out.sorda = g.sorda;
      out.ciechi = g.sorda ? [[0, 360]] : [[arco(g.asse - cono), arco(g.asse + cono)]];
    } else {
      const mezzo = (b.p.sensori.sfera.arco_baffles ?? 60) / 2;
      out.ciechi = [[arco(g.asse + 180 - mezzo), arco(g.asse + 180 + mezzo)]];
    }
    return out;
  }

  /**
   * @param {Float64Array} lineare
   * @param {number} theta
   * @param {number} se
   * @param {number} fascio
   */
  _stendi(lineare, theta, se, fascio) {
    const soglia = this.ac.rivelazione.fondo_normalizzato - 20;
    const soloPrincipale = se + this.lobi < soglia;
    const ampiezza = soloPrincipale ? fascio * Math.sqrt(Math.max(0, se - soglia) / 12) : 180;
    for (let k = 0; k < SONAR.SETTORI; k++) {
      const delta = normalizza180(centroSettore(k) - theta);
      if (Math.abs(delta) > ampiezza + SONAR.AMPIEZZA_SETTORE) continue;
      lineare[k] += 10 ** ((se + guadagnoFascio(delta, fascio, this.lobi)) / 10);
    }
  }

  // -------------------------------------------------------------------------
  // Spettro del fascio puntato: LOFAR e DEMON
  // -------------------------------------------------------------------------

  /**
   * Guadagno del fascio puntato su `rilevamentoFascio` per una sorgente, alla
   * frequenza f. Per l'antenna il fascio e' un cono intorno all'asse: conta
   * l'angolo dall'asse, e la sorgente si sente anche dallo speculare.
   * @param {Vista} v
   * @param {number} rilevamentoFascio vero
   * @param {number} asse
   * @param {number} f
   */
  guadagno(v, rilevamentoFascio, asse, f) {
    if (this.nome === 'towed') {
      const relFascio = Math.abs(normalizza180(rilevamentoFascio - asse));
      const delta = Math.abs(Math.abs(v.rel) - relFascio);
      return guadagnoFascio(delta, this._fascioA(f, relFascio), this.lobi);
    }
    return guadagnoFascio(normalizza180(v.theta - rilevamentoFascio), this.fascio(f), this.lobi);
  }

  /**
   * La parte di una sorgente che non dipende dal fascio, calcolata una volta
   * per istante (`epoca`, l'ora di gioco) e riusata da tutti gli spettri di
   * quell'istante (l'analizzatore del giocatore e gli sguardi dell'equipaggio):
   * geometria, righe, fondo a banda larga sulla griglia, rapporto
   * segnale/rumore a banda larga e modulazione.
   * @param {SorgenteBS} s
   * @param {Ambiente} amb
   * @param {NonNullable<ReturnType<SensorePassivo['geometria']>>} g
   * @returns {Base | null}
   */
  _base(s, amb, g) {
    const chiave = this.epoca;
    if (this._epocaCache !== chiave) {
      this._cache.clear();
      this._epocaCache = chiave;
    }
    if (this._cache.has(s.id)) return /** @type {Base | null} */ (this._cache.get(s.id));
    const v = this.vista(s, g);
    if (!v) {
      this._cache.set(s.id, null);
      return null;
    }
    const x = this._x(s.id);
    const righe = this.righeSorgente(v, amb, g, x);
    const fin = this.finestra;
    const passi = GRIGLIA_CONTINUO - 1;
    /** @type {Float64Array | null} */
    let griglia = null;
    let massimo = -Infinity;
    let snr = -Infinity;
    if (v.s.livelloA) {
      const via = v.via ?? (v.via = percorsoPerdita(this.ac, amb, v.ps, g.pos));
      const fc = this.ac.bande[this.nome].centro;
      const sl = v.s.livelloA(this.ac, fc, v.cosAspetto);
      if (Number.isFinite(sl)) snr = sl - via(this.nome) - g.nl + this.passivo.di - g.degrado + x;
      // Il fondo a banda larga nelle celle supera quello della banda di qualche decina di dB al
      // massimo (spettro piu' alto in basso, soglia della cella): se e' lontanissimo non si calcola.
      if (snr > SOGLIA_CONTINUO - 40) {
        griglia = new Float64Array(GRIGLIA_CONTINUO);
        for (let i = 0; i <= passi; i++) {
          const f = Math.max(1, fin.DA_HZ + (i / passi) * fin.RIGHE * fin.PASSO_HZ);
          griglia[i] = v.s.livelloA(this.ac, f, v.cosAspetto) - via(Math.round(f)) - this.rumore(amb, f) + this.di(f)
            + this.risposta(f) - this.dtContinuo - g.degrado + x;
          if (griglia[i] > massimo) massimo = griglia[i];
        }
      }
    }
    /** @type {Base} */
    const base = { v, righe, griglia, massimo, snr, mod: v.s.modulazione?.() ?? null };
    this._cache.set(s.id, base);
    return base;
  }

  /**
   * LOFAR e DEMON del fascio puntato su un rilevamento vero. Non avanza la
   * fluttuazione (lo fa il fotogramma a banda stretta): l'analizzatore del
   * giocatore e gli sguardi dell'equipaggio vedono lo stesso mare.
   * @param {SorgenteBS[]} sorgenti
   * @param {Ambiente} amb
   * @param {number} rilevamentoFascio gradi veri
   * @param {Generatore} rng  sotto-flusso del fondo (diverso per il giocatore e per l'equipaggio)
   * @returns {{righe: Uint8Array, demon: Uint8Array, asse: number, sorda: boolean,
   *   contributi: {sorgente: string, guadagno: number, distanza_vera: number}[]} | null}
   */
  spettro(sorgenti, amb, rilevamentoFascio, rng) {
    const g = this.passivo.geometria(amb);
    if (!g) return null;
    const fin = this.finestra;
    const n = fin.RIGHE;
    const lofar = new Float64Array(n);
    const nd = fin.DEMON_RIGHE;
    const demon = new Float64Array(nd);
    /** @type {{sorgente: string, guadagno: number, distanza_vera: number}[]} */
    const contributi = [];
    if (!g.sorda) {
      const banda = this.ac.bande[this.nome];
      const fc = banda.centro;
      const larghezza = banda.a - banda.da;
      const dtDemon = 5 * Math.log10(this.ac.rivelazione.indice_d / (fin.DEMON_PASSO_HZ * this.ac.demon.tempo_integrazione));
      const passi = GRIGLIA_CONTINUO - 1;
      const gg = new Float64Array(GRIGLIA_CONTINUO);
      /** @type {{s: number, mod: Modulazione}[]} */
      const modulate = [];
      let sommaS = 0;
      for (const s of sorgenti) {
        if (s === /** @type {unknown} */ (this.b)) continue;
        const base = this._base(s, amb, g);
        if (!base) continue;
        const v = base.v;
        // Righe.
        for (const r of base.righe) {
          const k = Math.floor((r.f - fin.DA_HZ) / fin.PASSO_HZ);
          if (k < 0 || k >= n) continue;
          const se = r.se + this.guadagno(v, rilevamentoFascio, g.asse, r.f);
          if (se > SE_TRASCURABILE) lofar[k] += 10 ** (se / 10);
        }
        // Fondo a banda larga della sorgente: la griglia piu' il fascio, interpolata in dB.
        if (base.griglia && base.massimo > SOGLIA_CONTINUO) {
          let massimo = -Infinity;
          for (let i = 0; i <= passi; i++) {
            const f = Math.max(1, fin.DA_HZ + (i / passi) * n * fin.PASSO_HZ);
            gg[i] = base.griglia[i] + this.guadagno(v, rilevamentoFascio, g.asse, f);
            if (gg[i] > massimo) massimo = gg[i];
          }
          if (massimo > SOGLIA_CONTINUO) {
            // Interpolazione lineare in dB fra i punti della griglia = geometrica in potenza:
            // una moltiplicazione per cella invece di una potenza.
            const celle = n / passi;
            for (let i = 0; i < passi; i++) {
              if (gg[i] <= SOGLIA_CONTINUO && gg[i + 1] <= SOGLIA_CONTINUO) continue;
              let lin = 10 ** (gg[i] / 10);
              const passo = 10 ** ((gg[i + 1] - gg[i]) / (10 * celle));
              const k0 = Math.round(i * celle);
              const k1 = Math.min(n, Math.round((i + 1) * celle));
              for (let k = k0; k < k1; k++) {
                lofar[k] += lin;
                lin *= passo;
              }
            }
          }
        }
        // Rapporto segnale/rumore nella banda a banda larga, per il DEMON.
        if (Number.isFinite(base.snr)) {
          const gC = this.guadagno(v, rilevamentoFascio, g.asse, fc);
          const sLin = 10 ** ((base.snr + gC) / 10);
          sommaS += sLin;
          if (base.mod) modulate.push({ s: sLin, mod: base.mod });
          if (gC > -20) contributi.push({ sorgente: s.id, guadagno: Math.round(gC * 10) / 10, distanza_vera: v.d });
        }
      }
      for (const { s, mod } of modulate) {
        const q = (s / (1 + sommaS)) ** 2 * (larghezza / fin.DEMON_PASSO_HZ);
        /** @param {number} f @param {number} m */
        const aggiungi = (f, m) => {
          const k = Math.floor((f - fin.DEMON_DA_HZ) / fin.DEMON_PASSO_HZ);
          if (k < 0 || k >= nd || m <= 0) return;
          const se = 10 * Math.log10((m * m / 2) * q) - dtDemon;
          if (se > SE_TRASCURABILE) demon[k] += 10 ** (se / 10);
        };
        aggiungi(mod.asse, mod.mAsse);
        const fp = mod.asse * mod.pale;
        for (let k = 1; k <= Math.min(ARMONICHE_DEMON, mod.armoniche + 1); k++) aggiungi(k * fp, mod.m * 0.7 ** (k - 1));
      }
    }
    return {
      righe: this._quantizza(lofar, rng), demon: this._quantizza(demon, rng),
      asse: Math.round(g.asse * 10) / 10, sorda: g.sorda, contributi,
    };
  }

  /**
   * Somma il fondo normalizzato (potenza esponenziale, il grano) e quantizza.
   * Il fondo viene da una riserva di campioni esponenziali preparata una volta
   * (stesso generatore, quindi deterministica), letta da un punto a caso: lo
   * spettro e' lungo e lo si chiede spesso (anche l'equipaggio), e mille
   * logaritmi a ogni sguardo costavano piu' di tutto il resto.
   * @param {Float64Array} segnale potenza lineare per cella
   * @param {Generatore} rng
   * @returns {Uint8Array}
   */
  _quantizza(segnale, rng) {
    const f = fondoRiserva(this.fondoLineare);
    const n = segnale.length;
    const out = new Uint8Array(n);
    let j = Math.floor(rng.uniforme() * RISERVA);
    for (let k = 0; k < n; k++) {
      j = (j + 1) & (RISERVA - 1);
      out[k] = segnale[k] > 0 ? quantizzaSE(10 * Math.log10(segnale[k] + f.lineare[j])) : f.byte[j];
    }
    return out;
  }
}

/** Campioni nella riserva del fondo (potenza di 2). */
const RISERVA = 1 << 16;
/** @type {Map<number, {lineare: Float64Array, byte: Uint8Array}>} */
const riserve = new Map();

/**
 * La riserva di campioni del fondo normalizzato per una media data.
 * @param {number} media potenza lineare
 */
function fondoRiserva(media) {
  let r = riserve.get(media);
  if (!r) {
    const rng = new Generatore('fondo-banda-stretta');
    const lineare = new Float64Array(RISERVA);
    const byte = new Uint8Array(RISERVA);
    for (let i = 0; i < RISERVA; i++) {
      lineare[i] = -Math.log(1 - rng.uniforme()) * media;
      byte[i] = quantizzaSE(10 * Math.log10(lineare[i]));
    }
    r = { lineare, byte };
    riserve.set(media, r);
  }
  return r;
}

/**
 * @param {number} a
 */
function arco(a) {
  return Math.round(normalizza360(a) * 10) / 10;
}
