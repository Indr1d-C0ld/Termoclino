// @ts-check
/**
 * Il tracciatore dell'equipaggio di F2 (PROGETTO §5.6, F2_ASCOLTARE #7): le
 * misure di tutti i sensori associate in TRACCE (S1, S2… sul 688, Ц1, Ц2…
 * sull'Alfa), con stato (nuova, tenuta, persa), rilevamento e velocita' di
 * variazione misurati, e la storia tempo-rilevamento che serve alla TMA.
 *
 * NEBBIA DI GUERRA. Come il sonarista di F1, il tracciatore lavora solo su cio'
 * che l'equipaggio sa: i byte dei fotogrammi (gli stessi che riceve il
 * giocatore), i parametri dei propri sensori e la posizione del proprio
 * battello. Nessuna verita' entra qui; chi ha bisogno di sapere quale entita'
 * c'era davvero dietro una traccia (il diario, il livello 3) lo chiede
 * all'arbitro della partita (server/src/match/arbitro.js), fuori da qui.
 *
 * Come lavora, per ogni fotogramma (sfera e antenna, banda larga ogni secondo
 * e banda stretta ogni 4 s):
 *  1. i picchi sopra soglia diventano RIVELAZIONI con un rilevamento
 *     (interpolazione parabolica: il fascio ha il lobo gaussiano, esatta in dB)
 *     e la σ che l'equipaggio stima dal SE misurato con la regola R1 dei propri
 *     sensori (piu' 0,3° di quantizzazione); per l'antenna ogni rivelazione e'
 *     una COPPIA (lato di dritta dell'asse e speculare);
 *  2. ogni traccia predice il proprio rilevamento (retta pesata sugli ultimi
 *     due minuti di misure della stessa schiera; da un'altra schiera, con la
 *     porta allargata della parallasse: l'antenna sta 800 m a poppa) e prende
 *     la rivelazione piu' vicina dentro la porta (vicino piu' prossimo, le
 *     tracce designate per prime);
 *  3. le rivelazioni avanzate fanno tracce tentative, confermate con 5 picchi
 *     su 8 s (banda larga, come in F1) o 3 su 16 s (banda stretta) e allora
 *     designate;
 *  4. AMBIGUITA' DELL'ANTENNA: una traccia della sola antenna tiene due
 *     ipotesi (il lato di dritta e lo speculare) che seguono ciascuna il
 *     proprio elemento della coppia. Dopo un'accostata (l'asse cambia di Δ) lo
 *     speculare salta di 2Δ mentre il rilevamento vero resta continuo: vince
 *     l'ipotesi che ritrova la sua coppia dentro la porta. Risolve anche la
 *     sfera, se vede il contatto vicino a una sola delle due ipotesi;
 *  5. una traccia si perde dopo PERDITA secondi in cui almeno un sensore
 *     avrebbe potuto sentirla e non l'ha sentita: i secondi ciechi (antenna
 *     sorda dopo un'accostata, baffles) non contano, fino a DERIVA_MAX. Un
 *     contatto perso e ritrovato e' un contatto nuovo (regola di F1).
 */

import { SONAR, centroSettore, dequantizzaSE } from '../../../../shared/protocol.js';
import { norm180, norm360 } from '../../../../shared/tma.js';

/** @typedef {import('../../../../shared/tma.js').Misura} Misura */

/** Parametri del tracciatore (nozionali, tarati sulle prove di server/test/tracce.test.js). */
export const TRACCE = Object.freeze({
  /** s di misure con cui si predice rilevamento e variazione */
  FINESTRA_FILTRO: 120,
  /** s dei punti tempo-rilevamento della TMA */
  PASSO_PUNTI: 10,
  /** s di punti tenuti per la TMA */
  STORIA_PUNTI: 2400,
  /** conferma di una traccia tentativa: picchi associati entro la finestra (s) */
  CONFERMA: Object.freeze({ larga: Object.freeze({ finestra: 8, colpi: 5 }), stretta: Object.freeze({ finestra: 16, colpi: 3 }) }),
  /**
   * s di occasioni mancate dopo cui una traccia e' persa: 60 s (F1) per una
   * traccia giovane, che crescono di mezzo secondo per secondo di traccia
   * tenuta fino a PERDITA_MAX. Il contatto va e viene in minuti (fluttuazione
   * con τ = 180 s, acustica.json) e il sonarista non lascia andare un
   * contatto tenuto da dieci minuti dopo un minuto di silenzio (nozionale).
   */
  PERDITA: 60,
  PERDITA_MAX: 240,
  /** s senza misure, anche da cieco, dopo cui una traccia e' persa */
  DERIVA_MAX: 600,
  /** s in cui una traccia persa resta nell'elenco `tracce` */
  RICORDO_PERSA: 300,
  /** s in cui una traccia appena designata e' 'nuova' */
  NUOVA: 30,
  /** porta minima di associazione per schiera, gradi */
  PORTA_MIN: Object.freeze({ sfera: 4, towed: 3 }),
  /** porta quando si associa con la predizione di un'altra schiera (parallasse), gradi */
  PORTA_PARALLASSE: 8,
  /** cambio d'asse (gradi) oltre cui la prima coppia dopo l'accostata puo' risolvere l'ambiguita' */
  ACCOSTATA_RISOLVE: 20,
  /** errore di quantizzazione del rilevamento interpolato, gradi (sommato in quadratura) */
  SIGMA_QUANTIZZAZIONE: 0.3,
  /**
   * σ minima di un punto tempo-rilevamento (gradi). Le misure al secondo hanno
   * errori indipendenti nel modello dei sensori, ma quelle vere no
   * (calibrazione, rifrazione, due bersagli sotto lo stesso fascio): senza un
   * pavimento la TMA crederebbe a una precisione che non c'e'. 0,3° ogni 10 s
   * vale l'ipotesi «buone condizioni» della ricerca, 0,5° ogni 30 s
   * ([COLL94], 06_tma.md §3.2). E' la manopola della taratura della TMA
   * (quanto deve manovrare chi caccia): nozionale.
   */
  SIGMA_MIN_PUNTO: 0.3,
  /** prominenza minima di un picco sui settori a mezzo fascio, dB (F1) */
  PROMINENZA: 3,
  /** s dopo l'ultima misura in cui una schiera conta fra i `sensori` della traccia */
  SENSORE_RECENTE: 30,
});

/**
 * Cio' che l'equipaggio sa di una propria schiera (dai dati di piattaforma).
 * @typedef {object} Schiera
 * @property {'sfera' | 'towed'} nome
 * @property {number} fascio  gradi alla frequenza della banda
 * @property {number} sigmaMin  gradi
 * @property {number} coefficiente
 * @property {number} [arcoEstremita]  towed: gradi dagli assi in cui σ si moltiplica
 * @property {number} [fattoreEstremita]
 */

/**
 * Un picco di un fotogramma, come lo vede il sonarista.
 * @typedef {object} Rivelazione
 * @property {'sfera' | 'towed'} sensore
 * @property {'larga' | 'stretta'} banda
 * @property {number} ora
 * @property {number} rilevamento  gradi veri (antenna: il lato di dritta dell'asse)
 * @property {number | null} speculare  antenna: l'altro lato; sfera: null
 * @property {number} se  dB misurati al picco
 * @property {number} sigma  gradi, stimata dall'equipaggio
 * @property {number} x  posizione del sensore
 * @property {number} y
 */

/**
 * Un fotogramma come lo da' il sensore (F1, e banda stretta di F2).
 * @typedef {object} FotogrammaSonar
 * @property {Uint8Array} settori
 * @property {[number, number][]} ciechi
 * @property {number} [asse]
 * @property {boolean} [sorda]
 */

/**
 * Fatti del tracciatore per chi tiene il diario (senza verita').
 * @typedef {{tipo: 'designata' | 'sensore', traccia: Traccia, sensore: string, banda: string,
 *     rilevamento: number, se: number}
 *   | {tipo: 'persa', traccia: Traccia}
 *   | {tipo: 'risolta', traccia: Traccia, da: 'accostata' | 'sfera', rilevamento: number, scartato: number}} Fatto
 */

/**
 * I picchi di un fotogramma: massimi locali sopra la soglia (SE ≥ 0), piu'
 * alti di almeno PROMINENZA dB dei settori a mezzo fascio, col rilevamento
 * raffinato per interpolazione parabolica e il SE del settore del massimo.
 * @param {Uint8Array} settori
 * @param {number} fascio gradi
 * @returns {{rilevamento: number, se: number}[]}
 */
export function picchi(settori, fascio) {
  const n = SONAR.SETTORI;
  const m = Math.max(1, Math.ceil(fascio / 2 / SONAR.AMPIEZZA_SETTORE) + 1);
  /** @type {{rilevamento: number, se: number}[]} */
  const out = [];
  const v = (/** @type {number} */ k) => dequantizzaSE(settori[((k % n) + n) % n]);
  for (let k = 0; k < n; k++) {
    const c = v(k);
    if (c < 0) continue;
    const s = v(k - 1);
    const d = v(k + 1);
    if (!(c > s && c >= d)) continue;
    if (c - Math.max(v(k - m), v(k + m)) < TRACCE.PROMINENZA) continue;
    const den = s - 2 * c + d;
    const delta = den < 0 ? 0.5 * (s - d) / den : 0;
    out.push({ rilevamento: norm360(centroSettore(k) + delta * SONAR.AMPIEZZA_SETTORE), se: c });
  }
  return out;
}

/**
 * Le rivelazioni di un fotogramma con la σ stimata dall'equipaggio.
 * @param {FotogrammaSonar} f
 * @param {Schiera} schiera
 * @param {'larga' | 'stretta'} banda
 * @param {number} ora
 * @param {{x: number, y: number}} pos  posizione del sensore
 * @param {number} [fattoreSigma]  1, o 2 dopo una piccola accostata (antenna)
 * @returns {Rivelazione[]}
 */
export function rivelazioni(f, schiera, banda, ora, pos, fattoreSigma = 1) {
  if (f.sorda) return [];
  const towed = schiera.nome === 'towed';
  const asse = f.asse ?? 0;
  /** @type {Rivelazione[]} */
  const out = [];
  for (const p of picchi(f.settori, schiera.fascio)) {
    const rel = norm180(p.rilevamento - asse);
    if (towed && rel <= 0) continue; // ogni contatto c'e' due volte: si tiene il lato di dritta
    let sigma = Math.max(schiera.sigmaMin, schiera.coefficiente * schiera.fascio * 10 ** (-p.se / 20)) * fattoreSigma;
    if (towed) {
      const dagliAssi = Math.min(Math.abs(rel), 180 - Math.abs(rel));
      if (dagliAssi < (schiera.arcoEstremita ?? 30)) sigma *= schiera.fattoreEstremita ?? 3;
    }
    sigma = Math.hypot(sigma, TRACCE.SIGMA_QUANTIZZAZIONE);
    out.push({
      sensore: schiera.nome, banda, ora, rilevamento: p.rilevamento,
      speculare: towed ? norm360(2 * asse - p.rilevamento) : null,
      se: p.se, sigma, x: pos.x, y: pos.y,
    });
  }
  return out;
}

/**
 * Un rilevamento cade in uno degli archi ciechi del fotogramma?
 * @param {number} ril
 * @param {[number, number][]} ciechi
 */
export function inArcoCieco(ril, ciechi) {
  for (const [da, a] of ciechi) {
    const ampiezza = norm360(a - da) || (a === da ? 0 : 360);
    if (da === 0 && a === 360) return true;
    if (norm360(ril - da) <= ampiezza) return true;
  }
  return false;
}

/**
 * Le misure recenti di una schiera per una ipotesi: predicono rilevamento e
 * variazione con una retta ai minimi quadrati pesati (rilevamenti srotolati).
 */
export class Filtro {
  constructor() {
    /** @type {{ora: number, r: number, w: number}[]} r srotolato */
    this.m = [];
    /** @type {{tm: number, rm: number, b: number, w: number, stt: number, piatta: boolean} | null} la retta, ricalcolata dopo ogni misura */
    this._retta = null;
  }

  /** @param {number} ora @param {number} ril @param {number} sigma */
  aggiungi(ora, ril, sigma) {
    const ultimo = this.m[this.m.length - 1];
    const r = ultimo ? ultimo.r + norm180(ril - ultimo.r) : ril;
    this.m.push({ ora, r, w: 1 / (sigma * sigma) });
    const limite = ora - TRACCE.FINESTRA_FILTRO;
    let i = 0;
    while (i < this.m.length - 3 && this.m[i].ora < limite) i++;
    if (i > 0) this.m.splice(0, i);
    this._retta = null;
  }

  /** Ora dell'ultima misura (−Infinity se vuoto). */
  get ultima() {
    return this.m.length ? this.m[this.m.length - 1].ora : -Infinity;
  }

  /** La retta ai minimi quadrati pesati (in cache fino alla prossima misura). */
  _calcola() {
    const m = this.m;
    let w = 0; let st = 0; let sr = 0;
    for (const p of m) { w += p.w; st += p.w * p.ora; sr += p.w * p.r; }
    const tm = st / w;
    const rm = sr / w;
    let stt = 0; let str = 0;
    for (const p of m) { const d = p.ora - tm; stt += p.w * d * d; str += p.w * d * (p.r - rm); }
    const ultimo = m[m.length - 1];
    const piatta = m.length < 3 || ultimo.ora - m[0].ora < 5 || !(stt > 0);
    this._retta = { tm, rm, b: piatta ? 0 : str / stt, w, stt, piatta };
    return this._retta;
  }

  /**
   * @param {number} ora
   * @returns {{rilevamento: number, variazione: number, sigma: number} | null}
   *   variazione in gradi al secondo; sigma = incertezza della predizione, gradi
   */
  predici(ora) {
    const m = this.m;
    if (!m.length) return null;
    const q = this._retta ?? this._calcola();
    if (q.piatta) {
      const ultimo = m[m.length - 1];
      return { rilevamento: norm360(ultimo.r), variazione: 0, sigma: 1 / Math.sqrt(ultimo.w) };
    }
    const dt = ora - q.tm;
    // incertezza della retta in `ora` (errore della media e della pendenza)
    const s2 = 1 / q.w + dt * dt / q.stt;
    return { rilevamento: norm360(q.rm + q.b * dt), variazione: q.b, sigma: Math.sqrt(s2) };
  }
}

/**
 * Una ipotesi di traccia: i filtri per schiera e i punti tempo-rilevamento
 * per la TMA. Una traccia risolta ne ha una; una della sola antenna, prima
 * dell'accostata, due (dritta e speculare).
 */
export class Ipotesi {
  constructor() {
    /** @type {{sfera: Filtro, towed: Filtro}} */
    this.filtri = { sfera: new Filtro(), towed: new Filtro() };
    /** @type {Misura[]} punti tempo-rilevamento chiusi, in ordine di tempo */
    this.punti = [];
    /** @type {Record<string, {k: number, w: number, rif: number, sb: number, st: number, sx: number, sy: number} | null>} */
    this.acc = { sfera: null, towed: null };
  }

  /**
   * @param {'sfera' | 'towed'} sensore
   * @param {number} ora @param {number} ril @param {number} sigma @param {number} x @param {number} y
   */
  aggiungi(sensore, ora, ril, sigma, x, y) {
    this.filtri[sensore].aggiungi(ora, ril, sigma);
    const k = Math.floor(ora / TRACCE.PASSO_PUNTI);
    let a = this.acc[sensore];
    if (a && a.k !== k) { this._chiudi(sensore); a = null; }
    if (!a) a = this.acc[sensore] = { k, w: 0, rif: ril, sb: 0, st: 0, sx: 0, sy: 0 };
    const wi = 1 / (sigma * sigma);
    a.w += wi; a.sb += wi * norm180(ril - a.rif); a.st += wi * ora; a.sx += wi * x; a.sy += wi * y;
  }

  /** @param {string} sensore */
  _chiudi(sensore) {
    const a = this.acc[sensore];
    if (!a) return;
    this.acc[sensore] = null;
    const p = {
      ora: a.st / a.w, rilevamento: norm360(a.rif + a.sb / a.w),
      sigma: Math.max(TRACCE.SIGMA_MIN_PUNTO, 1 / Math.sqrt(a.w)), x: a.sx / a.w, y: a.sy / a.w,
    };
    // inserimento in ordine (le due schiere chiudono i loro intervalli in tempi diversi)
    let i = this.punti.length;
    while (i > 0 && this.punti[i - 1].ora > p.ora) i--;
    this.punti.splice(i, 0, p);
  }

  /**
   * Chiude gli intervalli finiti e pota la storia.
   * @param {number} ora
   */
  chiudi(ora) {
    const k = Math.floor(ora / TRACCE.PASSO_PUNTI);
    for (const s of /** @type {const} */ (['sfera', 'towed'])) if (this.acc[s] && /** @type {any} */ (this.acc[s]).k < k) this._chiudi(s);
    const limite = ora - TRACCE.STORIA_PUNTI;
    let i = 0;
    while (i < this.punti.length && this.punti[i].ora < limite) i++;
    if (i > 0) this.punti.splice(0, i);
  }

  /**
   * La predizione per associare una misura della schiera `sensore`: dal suo
   * filtro se ha misure recenti, altrimenti da quello dell'altra schiera con
   * la porta della parallasse.
   * @param {'sfera' | 'towed'} sensore
   * @param {number} ora
   * @returns {{rilevamento: number, sigma: number, parallasse: boolean, variazione: number} | null}
   */
  predici(sensore, ora) {
    const proprio = this.filtri[sensore];
    const altro = this.filtri[sensore === 'sfera' ? 'towed' : 'sfera'];
    const recente = (/** @type {Filtro} */ f) => ora - f.ultima <= TRACCE.FINESTRA_FILTRO;
    if (proprio.m.length && (recente(proprio) || !altro.m.length || proprio.ultima >= altro.ultima)) {
      const p = proprio.predici(ora);
      return p && { ...p, parallasse: false };
    }
    if (altro.m.length) {
      const p = altro.predici(ora);
      return p && { ...p, parallasse: true };
    }
    return null;
  }

  /**
   * Il rilevamento e la variazione da mostrare: la sfera se ha misure
   * recenti (sta sul battello), altrimenti l'antenna.
   * @param {number} ora
   * @returns {{rilevamento: number, variazione: number} | null}  variazione in gradi al minuto
   */
  stima(ora) {
    const s = this.filtri.sfera;
    const t = this.filtri.towed;
    const f = s.m.length && (ora - s.ultima <= TRACCE.SENSORE_RECENTE || s.ultima >= t.ultima) ? s : t;
    const p = f.predici(Math.min(ora, f.ultima));
    return p && { rilevamento: p.rilevamento, variazione: p.variazione * 60 };
  }

  /** Ultima misura di qualunque schiera. */
  get ultima() {
    return Math.max(this.filtri.sfera.ultima, this.filtri.towed.ultima);
  }
}

/**
 * Una traccia dell'equipaggio.
 */
export class Traccia {
  /**
   * @param {number} nata  ora della prima rivelazione
   * @param {Ipotesi[]} ipotesi
   */
  constructor(nata, ipotesi) {
    /** @type {string | null} designazione (null finche' e' tentativa) */
    this.contatto = null;
    this.nata = nata;
    this.designata = -Infinity;
    this.ipotesi = ipotesi;
    /** ora dell'ultima associazione */
    this.ultima = nata;
    /** @type {Record<string, number>} ultima misura per schiera */
    this.sensori = {};
    /** @type {string} */
    this.ultimoSensore = '';
    /** @type {{larga: number[], stretta: number[]}} ore dei picchi mentre e' tentativa */
    this.colpi = { larga: [], stretta: [] };
    this.tempoCieco = 0;
    /** @type {'nuova' | 'tenuta' | 'persa'} */
    this.stato = 'nuova';
    this.persaDa = Infinity;
    /** asse dell'antenna all'ultima associazione dell'antenna */
    this.asseUltimo = /** @type {number | null} */ (null);
    /** l'ambiguita' e' stata risolta (da un'accostata o dalla sfera) */
    this.risolta = ipotesi.length === 1;
    /** @type {Record<string, any>} stato della classificazione (classificazione.js) */
    this.cls = {};
    /** @type {Record<string, any>} stato della TMA (centrale.js) */
    this.tma = {};
    /** eccesso di segnale tipico dei picchi della traccia (media mobile, dB misurati) */
    this.seMedio = /** @type {number | null} */ (null);
  }

  get ambigua() {
    return this.ipotesi.length > 1;
  }

  /**
   * Il rilevamento e la variazione della traccia, e lo speculare se ambigua.
   * @param {number} ora
   */
  stima(ora) {
    const a = this.ipotesi[0].stima(ora);
    const b = this.ambigua ? this.ipotesi[1].stima(ora) : null;
    return { rilevamento: a?.rilevamento ?? 0, variazione: a?.variazione ?? 0, speculare: b ? b.rilevamento : null };
  }

  /** I punti tempo-rilevamento per la TMA (null se ancora ambigua). */
  get punti() {
    return this.ambigua ? null : this.ipotesi[0].punti;
  }
}

/**
 * Il tracciatore di un equipaggio: tutte le tracce, da tutte le schiere.
 */
export class Tracciatore {
  /**
   * @param {object} a
   * @param {Record<'sfera' | 'towed', Schiera | null>} a.schiere
   * @param {() => string} a.designa  la prossima designazione ('S1', 'S2'…)
   */
  constructor(a) {
    this.schiere = a.schiere;
    this.designa = a.designa;
    /** @type {Traccia[]} designate e tentative */
    this.tracce = [];
    /** @type {Fatto[]} fatti del secondo in corso (li raccoglie l'equipaggio) */
    this.fatti = [];
    /** @type {Set<Traccia>} tracce associate nel secondo in corso */
    this._associate = new Set();
    /** @type {{f: FotogrammaSonar, sensore: string}[]} fotogrammi attivi del secondo in corso */
    this._attivi = [];
  }

  /** Le tracce designate (anche perse), in ordine di designazione. */
  get designate() {
    return this.tracce.filter((t) => t.contatto !== null);
  }

  /**
   * @param {string} contatto
   * @returns {Traccia | undefined}
   */
  traccia(contatto) {
    return this.tracce.find((t) => t.contatto === contatto);
  }

  /**
   * Un fotogramma di una schiera.
   * @param {FotogrammaSonar | null} f
   * @param {'sfera' | 'towed'} sensore
   * @param {'larga' | 'stretta'} banda
   * @param {number} ora
   * @param {{x: number, y: number}} pos  posizione del sensore
   * @param {number} [fattoreSigma]
   */
  fotogramma(f, sensore, banda, ora, pos, fattoreSigma = 1) {
    const schiera = this.schiere[sensore];
    if (!f || !schiera || f.sorda) return;
    this._attivi.push({ f, sensore });
    const rivs = rivelazioni(f, schiera, banda, ora, pos, fattoreSigma);
    const usate = new Set();
    const asse = f.asse ?? null;
    // Assegnazione al vicino piu' prossimo globale: le coppie (traccia,
    // rivelazione) dentro le porte, in ordine di distanza normalizzata; ogni
    // traccia e ogni rivelazione una volta sola. Cosi' una traccia che deriva
    // da cieca (porta larga) non ruba il picco a quella che lo segue da vicino.
    // Prima le tracce designate, poi le tentative sugli avanzi.
    /** @type {Map<Traccia, number>} */
    const assegnate = new Map();
    for (const gruppo of [this.designate, this._ordine().filter((t) => t.contatto === null)]) {
      /** @type {{t: Traccia, i: number, z: number}[]} */
      const coppie = [];
      for (const t of gruppo) {
        if (t.stato === 'persa') continue;
        for (const c of this._candidati(t, rivs, sensore, ora, asse)) coppie.push({ t, ...c });
      }
      coppie.sort((a, b) => a.z - b.z || (a.t.nata - b.t.nata) || (a.i - b.i));
      for (const c of coppie) {
        if (assegnate.has(c.t) || usate.has(c.i)) continue;
        assegnate.set(c.t, c.i);
        usate.add(c.i);
      }
    }
    // Un picco avanzato entro un fascio da una traccia tenuta e' la stessa
    // macchia sul waterfall: non fa una traccia nuova (due bersagli sotto lo
    // stesso fascio sono un contatto solo).
    const tenute = this.designate.filter((t) => t.stato !== 'persa')
      .flatMap((t) => t.ipotesi.map((h) => h.predici(sensore, ora)))
      .filter((p) => p !== null).map((p) => /** @type {{rilevamento: number}} */ (p).rilevamento);
    rivs.forEach((r, i) => {
      if (usate.has(i)) return;
      const el = r.speculare === null ? [r.rilevamento] : [r.rilevamento, r.speculare];
      if (tenute.some((b) => el.some((e) => Math.abs(norm180(e - b)) < schiera.fascio))) usate.add(i);
    });
    for (const [t, i] of assegnate) {
      // la traccia vede solo la rivelazione assegnata
      const altre = new Set(rivs.map((_, k) => k).filter((k) => k !== i));
      if (t.ambigua) this._associaAmbigua(t, rivs, altre, sensore, banda, ora, asse);
      else this._associaRisolta(t, rivs, altre, sensore, banda, ora);
    }
    rivs.forEach((r, i) => {
      if (usate.has(i)) return;
      /** @type {Ipotesi[]} */
      const ip = [new Ipotesi()];
      ip[0].aggiungi(sensore, ora, r.rilevamento, r.sigma, r.x, r.y);
      if (r.speculare !== null) {
        ip.push(new Ipotesi());
        ip[1].aggiungi(sensore, ora, r.speculare, r.sigma, r.x, r.y);
      }
      const t = new Traccia(ora, ip);
      t.asseUltimo = asse;
      this._colpo(t, r, ora);
      this.tracce.push(t);
    });
  }

  /** Tracce designate prima (per designazione), poi tentative per eta'. */
  _ordine() {
    const d = this.tracce.filter((t) => t.contatto !== null);
    const n = this.tracce.filter((t) => t.contatto === null).sort((a, b) => a.nata - b.nata);
    return [...d, ...n];
  }

  /**
   * Le rivelazioni dentro la porta di una traccia, con la distanza
   * normalizzata (scarto / σ combinata) della migliore ipotesi ed elemento.
   * @param {Traccia} t @param {Rivelazione[]} rivs @param {'sfera' | 'towed'} sensore
   * @param {number} ora @param {number | null} asse
   * @returns {{i: number, z: number}[]}
   */
  _candidati(t, rivs, sensore, ora, asse) {
    const accostata = t.ambigua && sensore === 'towed' && asse !== null && t.asseUltimo !== null
      ? Math.abs(norm180(asse - t.asseUltimo)) : 0;
    const allarga = accostata >= TRACCE.ACCOSTATA_RISOLVE ? Math.min(accostata, 30) : 0;
    /** @type {{i: number, z: number}[]} */
    const out = [];
    const previsioni = t.ipotesi.map((h) => h.predici(sensore, ora)).filter((p) => p !== null);
    rivs.forEach((r, i) => {
      let z = Infinity;
      for (const p of /** @type {{rilevamento: number, sigma: number, parallasse: boolean}[]} */ (previsioni)) {
        const porta = Math.max(this._porta(sensore, p, r), allarga);
        for (const e of r.speculare === null ? [r.rilevamento] : [r.rilevamento, r.speculare]) {
          const d = Math.abs(norm180(e - p.rilevamento));
          if (d <= porta) z = Math.min(z, d / Math.max(0.1, porta / 3));
        }
      }
      if (z < Infinity) out.push({ i, z });
    });
    return out;
  }

  /**
   * Porta di associazione, gradi.
   * @param {'sfera' | 'towed'} sensore
   * @param {{sigma: number, parallasse: boolean}} p
   * @param {Rivelazione} r
   */
  _porta(sensore, p, r) {
    const schiera = /** @type {Schiera} */ (this.schiere[sensore]);
    // La porta cresce con l'incertezza della predizione (una traccia che non si
    // sente da un po'), ma non oltre un fascio e mezzo: un salto piu' grande
    // e' un altro bersaglio, non lo stesso ritrovato.
    const base = Math.min(Math.max(TRACCE.PORTA_MIN[sensore], 0.6 * schiera.fascio, 3 * Math.hypot(r.sigma, p.sigma)),
      Math.max(TRACCE.PORTA_MIN[sensore], 1.5 * schiera.fascio));
    return p.parallasse ? Math.max(base, TRACCE.PORTA_PARALLASSE) : base;
  }

  /**
   * @param {Traccia} t @param {Rivelazione[]} rivs @param {Set<number>} usate
   * @param {'sfera' | 'towed'} sensore @param {'larga' | 'stretta'} banda @param {number} ora
   */
  _associaRisolta(t, rivs, usate, sensore, banda, ora) {
    const h = t.ipotesi[0];
    const p = h.predici(sensore, ora);
    if (!p) return;
    let migliore = -1;
    let elemento = 0;
    let distanza = Infinity;
    rivs.forEach((r, i) => {
      if (usate.has(i)) return;
      const porta = this._porta(sensore, p, r);
      for (const e of r.speculare === null ? [r.rilevamento] : [r.rilevamento, r.speculare]) {
        const d = Math.abs(norm180(e - p.rilevamento));
        if (d <= porta && d < distanza) { distanza = d; migliore = i; elemento = e; }
      }
    });
    if (migliore < 0) return;
    usate.add(migliore);
    const r = rivs[migliore];
    h.aggiungi(sensore, ora, elemento, r.sigma, r.x, r.y);
    this._associata(t, r, ora, elemento);
  }

  /**
   * Traccia ambigua (solo antenna): le due ipotesi seguono ciascuna il suo
   * elemento della coppia; l'accostata o la sfera decidono.
   * @param {Traccia} t @param {Rivelazione[]} rivs @param {Set<number>} usate
   * @param {'sfera' | 'towed'} sensore @param {'larga' | 'stretta'} banda @param {number} ora
   * @param {number | null} asse
   */
  _associaAmbigua(t, rivs, usate, sensore, banda, ora, asse) {
    const [A, B] = t.ipotesi;
    const pA = A.predici(sensore, ora);
    const pB = B.predici(sensore, ora);
    if (!pA || !pB) return;
    /** la miglior rivelazione e il suo elemento per un'ipotesi */
    const cerca = (/** @type {{rilevamento: number, sigma: number, parallasse: boolean}} */ p, /** @type {number} */ allarga) => {
      let i0 = -1; let e0 = 0; let d0 = Infinity;
      rivs.forEach((r, i) => {
        if (usate.has(i)) return;
        const porta = Math.max(this._porta(sensore, p, r), allarga);
        for (const e of r.speculare === null ? [r.rilevamento] : [r.rilevamento, r.speculare]) {
          const d = Math.abs(norm180(e - p.rilevamento));
          if (d <= porta && d < d0) { d0 = d; i0 = i; e0 = e; }
        }
      });
      return { i: i0, e: e0, d: d0 };
    };

    if (sensore === 'sfera') {
      // La sfera non ha ambiguita': se vede il contatto vicino a una sola
      // delle due ipotesi, quella e' la buona.
      const a = cerca(pA, 0);
      const b = cerca(pB, 0);
      let vince = -1;
      if (a.i >= 0 && (b.i < 0 || b.d > a.d + 5)) vince = 0;
      else if (b.i >= 0 && (a.i < 0 || a.d > b.d + 5)) vince = 1;
      if (vince < 0) return;
      const m = vince === 0 ? a : b;
      this._risolvi(t, vince, 'sfera');
      usate.add(m.i);
      const r = rivs[m.i];
      t.ipotesi[0].aggiungi(sensore, ora, m.e, r.sigma, r.x, r.y);
      this._associata(t, r, ora, m.e);
      return;
    }

    const accostata = asse !== null && t.asseUltimo !== null ? Math.abs(norm180(asse - t.asseUltimo)) : 0;
    if (accostata >= TRACCE.ACCOSTATA_RISOLVE) {
      // Lo speculare e' saltato di 2Δ, il vero no: si allarga la porta fino a
      // Δ (il rilevamento vero puo' essere derivato durante il tempo morto,
      // ma meno dello speculare).
      const allarga = Math.min(accostata, 30);
      const a = cerca(pA, allarga);
      const b = cerca(pB, allarga);
      let vince = -1;
      if (a.i >= 0 && (b.i < 0 || b.d > 2 * a.d + 5)) vince = 0;
      else if (b.i >= 0 && (a.i < 0 || a.d > 2 * b.d + 5)) vince = 1;
      if (vince >= 0) {
        const m = vince === 0 ? a : b;
        this._risolvi(t, vince, 'accostata');
        usate.add(m.i);
        const r = rivs[m.i];
        t.ipotesi[0].aggiungi(sensore, ora, m.e, r.sigma, r.x, r.y);
        t.asseUltimo = asse;
        this._associata(t, r, ora, m.e);
        return;
      }
      if (a.i < 0 && b.i < 0) return;
    }
    // Nessuna accostata (o non decisiva): ciascuna ipotesi prende il suo elemento.
    const a = cerca(pA, 0);
    const b = cerca(pB, 0);
    const i = a.i >= 0 ? a.i : b.i;
    if (i < 0) return;
    const r = rivs[i];
    const elementi = r.speculare === null ? [r.rilevamento, r.rilevamento] : [r.rilevamento, r.speculare];
    const vicino = (/** @type {{rilevamento: number}} */ p) =>
      elementi.reduce((m, e) => (Math.abs(norm180(e - p.rilevamento)) < Math.abs(norm180(m - p.rilevamento)) ? e : m));
    usate.add(i);
    const eA = vicino(pA);
    const eB = vicino(pB);
    A.aggiungi(sensore, ora, eA, r.sigma, r.x, r.y);
    B.aggiungi(sensore, ora, eB, r.sigma, r.x, r.y);
    t.asseUltimo = asse;
    this._associata(t, r, ora, eA);
  }

  /**
   * @param {Traccia} t @param {number} vince indice dell'ipotesi buona @param {'accostata' | 'sfera'} da
   */
  _risolvi(t, vince, da) {
    const buona = t.ipotesi[vince];
    const scartata = t.ipotesi[1 - vince];
    const ora = Math.max(buona.ultima, 0);
    t.ipotesi = [buona];
    t.risolta = true;
    if (t.contatto !== null) {
      this.fatti.push({
        tipo: 'risolta', traccia: t, da,
        rilevamento: buona.stima(ora)?.rilevamento ?? 0,
        scartato: scartata.stima(ora)?.rilevamento ?? 0,
      });
    }
  }

  /**
   * @param {Traccia} t @param {Rivelazione} r @param {number} ora @param {number} elemento
   */
  _associata(t, r, ora, elemento) {
    const nuovoSensore = t.contatto !== null && !(r.sensore in t.sensori);
    t.sensori[r.sensore] = ora;
    t.ultimoSensore = r.sensore;
    t.ultima = ora;
    t.tempoCieco = 0;
    t.seMedio = t.seMedio === null ? r.se : 0.95 * t.seMedio + 0.05 * r.se;
    this._associate.add(t);
    if (t.contatto === null) this._colpo(t, r, ora);
    else if (nuovoSensore) {
      this.fatti.push({ tipo: 'sensore', traccia: t, sensore: r.sensore, banda: r.banda, rilevamento: elemento, se: r.se });
    }
  }

  /**
   * Un picco per una traccia tentativa; la designa quando e' confermata.
   * @param {Traccia} t @param {Rivelazione} r @param {number} ora
   */
  _colpo(t, r, ora) {
    const regola = TRACCE.CONFERMA[r.banda];
    const colpi = t.colpi[r.banda];
    colpi.push(ora);
    while (colpi.length && colpi[0] <= ora - regola.finestra) colpi.shift();
    t.sensori[r.sensore] = ora;
    t.ultimoSensore = r.sensore;
    t.ultima = ora;
    if (colpi.length >= regola.colpi) {
      t.contatto = this.designa();
      t.designata = ora;
      t.stato = 'nuova';
      this.fatti.push({ tipo: 'designata', traccia: t, sensore: r.sensore, banda: r.banda, rilevamento: r.rilevamento, se: r.se });
    }
  }

  /**
   * Fine del secondo: tempi ciechi, perdite, pulizia delle tentative, punti
   * della TMA. Restituisce le tracce perse in questo secondo.
   * @param {number} ora
   * @returns {Traccia[]}
   */
  fineSecondo(ora) {
    /** @type {Traccia[]} */
    const perse = [];
    for (const t of this.tracce) {
      for (const h of t.ipotesi) h.chiudi(ora);
      if (t.contatto === null || t.stato === 'persa') continue;
      if (t.stato === 'nuova' && ora - t.designata >= TRACCE.NUOVA) t.stato = 'tenuta';
      if (this._associate.has(t)) continue;
      // Poteva sentirla qualcuno? Se nessun sensore attivo copriva il suo
      // rilevamento, il secondo e' cieco e non conta.
      const coperta = this._attivi.some(({ f, sensore }) => t.ipotesi.some((h) => {
        const p = h.predici(/** @type {'sfera' | 'towed'} */ (sensore), ora);
        return p !== null && !inArcoCieco(p.rilevamento, f.ciechi);
      }));
      if (!coperta) t.tempoCieco++;
      const perdita = Math.min(TRACCE.PERDITA_MAX, TRACCE.PERDITA + 0.5 * Math.max(0, t.ultima - t.designata));
      if (ora - t.ultima - t.tempoCieco >= perdita || ora - t.ultima >= TRACCE.DERIVA_MAX) {
        t.stato = 'persa';
        t.persaDa = ora;
        perse.push(t);
        this.fatti.push({ tipo: 'persa', traccia: t });
      }
    }
    // Tentative senza picchi recenti; perse da troppo.
    this.tracce = this.tracce.filter((t) => {
      if (t.contatto === null) return ora - t.ultima < 2 * TRACCE.CONFERMA.stretta.finestra;
      return !(t.stato === 'persa' && ora - t.persaDa > TRACCE.RICORDO_PERSA);
    });
    this._associate.clear();
    this._attivi = [];
    return perse;
  }

  /**
   * Toglie una traccia (ordine `abbandona`).
   * @param {Traccia} t
   */
  togli(t) {
    this.tracce = this.tracce.filter((x) => x !== t);
  }
}
