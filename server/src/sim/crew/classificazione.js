// @ts-check
/**
 * La classificazione dell'equipaggio (F2_ASCOLTARE #7, ricerca 04 §4.6.4):
 * il sonarista guarda il LOFAR e il DEMON del fascio puntato su ogni traccia,
 * tiene le righe che persistono, le confronta con la «biblioteca delle
 * firme» (shared/data/firme.js, `biblioteca()`) e, dopo un tempo che dipende
 * da quanto l'evidenza e' netta, dice una classe con una confidenza. Puo'
 * sbagliare: con la probabilita' d'errore della sua evidenza sceglie la
 * seconda classe.
 *
 * NEBBIA DI GUERRA: lavora solo sui byte degli spettri (gli stessi che il
 * giocatore vede nell'analizzatore) e sui transitori riconosciuti; la verita'
 * la confronta l'arbitro, nel diario.
 *
 * I tempi (nozionali, ricerca 04 §4.6.4: «3-10 min sulle righe a banda
 * stretta, piu' rapida se la classe e' in biblioteca»):
 *  - evidenza netta (almeno due caratteri riconosciuti e due punti di
 *    vantaggio sulla seconda classe): 3 minuti, errore 5 %;
 *  - evidenza discreta (un punto di vantaggio): 6 minuti, errore 15 %;
 *  - evidenza debole (un solo carattere): 10 minuti, errore 30 %;
 *  - niente che somigli alla biblioteca: nessuna classe.
 * Il tempo si conta dalla prima riga stabile sulla traccia.
 */

import { SONAR, dequantizzaSE } from '../../../../shared/protocol.js';

/** @typedef {import('../../../../shared/data/firme.js').VoceBiblioteca} VoceBiblioteca */
/** @typedef {import('./tracce.js').Traccia} Traccia */
/** @typedef {import('../../../../shared/rng.js').Generatore} Generatore */

/**
 * Uno spettro del fascio puntato su una traccia (la forma di `spettro`).
 * @typedef {object} Spettro
 * @property {number} da_hz @property {number} passo_hz @property {Uint8Array} righe
 * @property {number} [demon_da_hz] @property {number} [demon_passo_hz] @property {Uint8Array} [demon]
 */

/** Parametri della classificazione (nozionali). */
export const CLASSIFICAZIONE = Object.freeze({
  /** s fra due sguardi allo spettro di una traccia (due fotogrammi a banda stretta) */
  PERIODO: 8,
  /** sguardi considerati per la stabilita' di una riga, e quanti devono averla */
  SGUARDI: 6,
  STABILE: 3,
  /** tolleranza in frequenza: Doppler fino a ~20 kt di velocita' radiale relativa (0,7 %) */
  DOPPLER: 0.007,
  /** livelli dell'evidenza: [vantaggio minimo, caratteri minimi, s, probabilita' d'errore] */
  LIVELLI: Object.freeze([
    Object.freeze({ vantaggio: 2, caratteri: 2, secondi: 180, errore: 0.05 }),
    Object.freeze({ vantaggio: 1, caratteri: 1, secondi: 360, errore: 0.15 }),
    Object.freeze({ vantaggio: 0.5, caratteri: 1, secondi: 600, errore: 0.30 }),
  ]),
  /** s fra due riesami di una traccia gia' classificata */
  RIESAME: 60,
  /** frequenza minima delle righe considerate, Hz (sotto c'e' solo il rumore del mare e del cavo) */
  F_MIN: 10,
  /** dB di cui una riga deve sporgere sul fondo vicino dello spettro */
  PROMINENZA: 4,
});

/**
 * Le righe di un vettore quantizzato: massimi locali sopra la soglia (SE ≥ 0)
 * che sporgono di almeno `prominenza` dB sul fondo vicino (la media delle
 * celle da 4 a 12 posti piu' in la' da ogni parte). Senza la sporgenza una
 * sorgente forte a banda larga, sopra soglia su tutto lo spettro, farebbe
 * «righe» a ogni increspatura: il sonarista guarda il LOFAR normalizzato.
 * @param {Uint8Array} v
 * @param {number} da  Hz del primo byte
 * @param {number} passo  Hz
 * @param {number} fMin
 * @param {number} [prominenza]  dB (4)
 * @returns {{hz: number, se: number}[]}
 */
export function righeDi(v, da, passo, fMin = 0, prominenza = CLASSIFICAZIONE.PROMINENZA) {
  /** @type {{hz: number, se: number}[]} */
  const out = [];
  for (let k = 1; k < v.length - 1; k++) {
    if (v[k] < SONAR.Q_SOGLIA) continue;
    if (!(v[k] > v[k - 1] && v[k] >= v[k + 1])) continue;
    let somma = 0;
    let n = 0;
    for (let j = 4; j <= 12; j++) {
      if (k - j >= 0) { somma += v[k - j]; n++; }
      if (k + j < v.length) { somma += v[k + j]; n++; }
    }
    const c = dequantizzaSE(v[k]);
    if (n > 0 && c - dequantizzaSE(somma / n) < prominenza) continue;
    const s = dequantizzaSE(v[k - 1]);
    const d = dequantizzaSE(v[k + 1]);
    const den = s - 2 * c + d;
    const delta = den < 0 ? 0.5 * (s - d) / den : 0;
    const hz = da + (k + 0.5 + delta) * passo;
    if (hz >= fMin) out.push({ hz, se: c });
  }
  return out;
}

/**
 * Il numero di pale dal DEMON: la riga piu' forte e' la frequenza di pala, la
 * riga d'asse e' la piu' bassa che la divide in un intero fra 3 e 9.
 * @param {{hz: number, se: number}[]} righe
 * @returns {{pale: number, asse: number} | null}
 */
export function paleDaDemon(righe) {
  if (righe.length < 2) return null;
  const pala = righe.reduce((m, r) => (r.se > m.se ? r : m));
  for (const r of [...righe].sort((a, b) => a.hz - b.hz)) {
    if (r.hz >= pala.hz) break;
    const k = pala.hz / r.hz;
    const n = Math.round(k);
    if (n >= 3 && n <= 9 && Math.abs(k - n) < 0.08) return { pale: n, asse: r.hz };
  }
  return null;
}

/**
 * Lo stato della classificazione di una traccia (sta in `traccia.cls`).
 * @typedef {object} StatoClassificazione
 * @property {Map<number, {visti: number[], prima: number}>} righe  per cella di 1 Hz: sguardi in cui c'era
 * @property {number[]} sguardi  ore degli ultimi sguardi
 * @property {number[]} pale  stime del numero di pale
 * @property {number[]} assi  stime della frequenza d'asse (Hz, dal DEMON)
 * @property {number} biologici  transitori biologici attribuiti
 * @property {number} primaEvidenza  ora della prima riga stabile (Infinity = nessuna)
 * @property {string | null} classe  quella in vigore (dell'equipaggio o del comandante)
 * @property {number | null} confidenza  0-100, null se l'ha data il comandante
 * @property {'equipaggio' | 'comandante' | null} da
 * @property {number} ultimoSguardo
 * @property {number} ultimoRiesame
 */

/**
 * @param {Traccia} t
 * @returns {StatoClassificazione}
 */
export function statoDi(t) {
  if (!t.cls.righe) {
    Object.assign(t.cls, /** @type {StatoClassificazione} */ ({
      righe: new Map(), sguardi: [], pale: [], assi: [], biologici: 0, primaEvidenza: Infinity,
      classe: null, confidenza: null, da: null, ultimoSguardo: -Infinity, ultimoRiesame: -Infinity,
    }));
  }
  return /** @type {StatoClassificazione} */ (/** @type {unknown} */ (t.cls));
}

/**
 * Il classificatore dell'equipaggio.
 */
export class Classificatore {
  /**
   * @param {object} a
   * @param {Map<string, VoceBiblioteca>} a.biblioteca
   * @param {Generatore} a.rng  sotto-flusso dell'equipaggio per gli errori
   */
  constructor(a) {
    this.biblioteca = a.biblioteca;
    this.rng = a.rng;
  }

  /**
   * Serve uno sguardo allo spettro di questa traccia adesso?
   * @param {Traccia} t @param {number} ora
   */
  vuoleGuardare(t, ora) {
    const s = statoDi(t);
    if (s.da === 'comandante') return false;
    const periodo = s.classe === null ? CLASSIFICAZIONE.PERIODO : CLASSIFICAZIONE.RIESAME / 3;
    return ora - s.ultimoSguardo >= periodo;
  }

  /**
   * Uno sguardo allo spettro del fascio puntato sulla traccia.
   * @param {Traccia} t @param {Spettro} sp @param {number} ora
   */
  sguardo(t, sp, ora) {
    const s = statoDi(t);
    s.ultimoSguardo = ora;
    s.sguardi.push(ora);
    if (s.sguardi.length > CLASSIFICAZIONE.SGUARDI) s.sguardi.shift();
    const finestra = s.sguardi[0];
    for (const r of righeDi(sp.righe, sp.da_hz, sp.passo_hz, CLASSIFICAZIONE.F_MIN)) {
      const cella = Math.round(r.hz);
      // la stessa riga puo' cadere nella cella vicina (Doppler, interpolazione)
      const chiave = [cella, cella - 1, cella + 1].find((c) => s.righe.has(c)) ?? cella;
      const voce = s.righe.get(chiave) ?? { visti: [], prima: ora };
      voce.visti.push(ora);
      s.righe.set(chiave, voce);
    }
    for (const [k, v] of s.righe) {
      v.visti = v.visti.filter((o) => o >= finestra);
      if (v.visti.length === 0 && ora - v.prima > 600) s.righe.delete(k);
    }
    if (sp.demon && sp.demon_da_hz !== undefined && sp.demon_passo_hz !== undefined) {
      const p = paleDaDemon(righeDi(sp.demon, sp.demon_da_hz, sp.demon_passo_hz, 0.5));
      if (p) {
        s.pale.push(p.pale);
        s.assi.push(p.asse);
        if (s.pale.length > 10) { s.pale.shift(); s.assi.shift(); }
      }
    }
    if (s.primaEvidenza === Infinity && (this._stabili(s).length > 0 || this._pale(s) !== null)) s.primaEvidenza = ora;
  }

  /**
   * Un transitorio riconosciuto sul rilevamento della traccia.
   * @param {Traccia} t @param {string} tipo @param {number} ora
   */
  transitorio(t, tipo, ora) {
    const s = statoDi(t);
    if (tipo === 'biologico') {
      s.biologici++;
      if (s.primaEvidenza === Infinity) s.primaEvidenza = ora;
    }
  }

  /** @param {StatoClassificazione} s @returns {number[]} frequenze (Hz) delle righe stabili */
  _stabili(s) {
    /** @type {number[]} */
    const out = [];
    for (const [hz, v] of s.righe) if (v.visti.length >= CLASSIFICAZIONE.STABILE) out.push(hz);
    return out.sort((a, b) => a - b);
  }

  /** @param {StatoClassificazione} s */
  _pale(s) {
    if (s.pale.length < 3) return null;
    /** @type {Map<number, number>} */
    const conti = new Map();
    for (const p of s.pale) conti.set(p, (conti.get(p) ?? 0) + 1);
    let migliore = null;
    let n = 0;
    for (const [p, c] of conti) if (c > n) { migliore = p; n = c; }
    return n >= 0.6 * s.pale.length ? migliore : null;
  }

  /**
   * Punteggio di ogni classe della biblioteca per l'evidenza raccolta: +1 per
   * ogni riga della classe ritrovata (anche quelle che seguono i giri, alla
   * frequenza d'asse del DEMON per il loro numero per giro), −0,5 per ogni
   * riga stabile che la classe non spiega (al massimo −2), ±1,5 per il numero
   * di pale, +1 per transitorio biologico (massimo 3) alla classe biologica.
   * @param {StatoClassificazione} s
   * @returns {{classe: string, tipo: string, punti: number, caratteri: number}[]} in ordine decrescente
   */
  punteggi(s) {
    const stabili = this._stabili(s);
    const pale = this._pale(s);
    const assi = [...s.assi].sort((a, b) => a - b);
    const asse = pale !== null && assi.length ? assi[assi.length >> 1] : null;
    /** @type {{classe: string, tipo: string, punti: number, caratteri: number}[]} */
    const out = [];
    for (const v of this.biblioteca.values()) {
      let punti = 0;
      let caratteri = 0;
      const spiegate = new Set();
      for (const r of v.righe) {
        const tol = Math.max(1.5, CLASSIFICAZIONE.DOPPLER * r.frequenza);
        const trovata = stabili.find((hz) => Math.abs(hz - r.frequenza) <= tol);
        if (trovata !== undefined) { punti += 1; caratteri++; spiegate.add(trovata); }
      }
      if (asse !== null) {
        for (const r of v.righe_giri) {
          const f = r.per_giro * asse;
          const tol = Math.max(1.5, 2 * CLASSIFICAZIONE.DOPPLER * f);
          const trovata = stabili.find((hz) => !spiegate.has(hz) && Math.abs(hz - f) <= tol);
          if (trovata !== undefined) { punti += 1; caratteri++; spiegate.add(trovata); }
        }
      }
      const inspiegate = stabili.filter((hz) => !spiegate.has(hz)).length;
      punti -= Math.min(2, 0.5 * inspiegate);
      if (pale !== null && v.pale !== null) {
        if (v.pale === pale) { punti += 1.5; caratteri++; } else punti -= 1.5;
      }
      if (v.tipo === 'biologico' && s.biologici > 0) { punti += Math.min(3, s.biologici); caratteri++; }
      if (v.canto && stabili.length === 0 && s.biologici > 0) punti += 0.5;
      out.push({ classe: v.classe, tipo: v.tipo, punti, caratteri });
    }
    return out.sort((a, b) => b.punti - a.punti || (a.classe < b.classe ? -1 : 1));
  }

  /**
   * La decisione dell'equipaggio, se il tempo e l'evidenza bastano.
   * @param {Traccia} t @param {number} ora
   * @returns {{classe: string, confidenza: number, corretta_per_equipaggio: string} | null}
   *   la classe detta (forse sbagliata: `corretta_per_equipaggio` e' la sua prima scelta)
   */
  decidi(t, ora) {
    const s = statoDi(t);
    if (s.da === 'comandante' || s.primaEvidenza === Infinity || s.ultimoSguardo !== ora) return null;
    if (s.classe !== null && ora - s.ultimoRiesame < CLASSIFICAZIONE.RIESAME) return null;
    const p = this.punteggi(s);
    if (p.length === 0 || p[0].punti <= 0) return null;
    const vantaggio = p[0].punti - (p[1]?.punti ?? 0);
    const trascorso = ora - s.primaEvidenza;
    const livello = CLASSIFICAZIONE.LIVELLI.find((l) => vantaggio >= l.vantaggio && p[0].caratteri >= l.caratteri);
    if (!livello || trascorso < livello.secondi) return null;
    s.ultimoRiesame = ora;
    if (s.classe !== null) {
      // Riesame: si cambia idea solo se l'evidenza nuova e' netta e diversa.
      if (p[0].classe === s.classe || livello !== CLASSIFICAZIONE.LIVELLI[0]) return null;
    }
    // L'errore del sonarista e' plausibile: la seconda classe che ha qualche
    // carattere riconosciuto, o una dello stesso tipo (un sottomarino per un
    // altro, una nave per un'altra), mai una senza nessun indizio.
    const alternativa = p.slice(1).find((x) => x.caratteri > 0 || x.tipo === p[0].tipo);
    const sbaglia = alternativa !== undefined && this.rng.probabilita(livello.errore);
    const classe = sbaglia ? /** @type {{classe: string}} */ (alternativa).classe : p[0].classe;
    if (classe === s.classe) return null;
    s.classe = classe;
    s.confidenza = Math.round(100 * (1 - livello.errore));
    s.da = 'equipaggio';
    return { classe, confidenza: s.confidenza, corretta_per_equipaggio: p[0].classe };
  }

  /**
   * La classificazione del comandante (ordine `classifica`): prevale.
   * @param {Traccia} t @param {string | null} classe  null = si torna all'equipaggio
   */
  comandante(t, classe) {
    const s = statoDi(t);
    if (classe === null) {
      s.classe = null; s.confidenza = null; s.da = null; s.ultimoRiesame = -Infinity;
    } else {
      s.classe = classe; s.confidenza = null; s.da = 'comandante';
    }
  }
}
