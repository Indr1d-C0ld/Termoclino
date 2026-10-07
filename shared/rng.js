// @ts-check
/**
 * Generatore pseudocasuale deterministico con seme — modulo comune a server e
 * browser (PROGETTO §4.3).
 *
 * Algoritmo: sfc32 (Small Fast Counting, Chris Doty-Humphrey, PractRand), 128
 * bit di stato di cui 32 di contatore: periodo minimo garantito 2^32, atteso
 * intorno a 2^127. Lo stato iniziale si ricava dal seme con splitmix32
 * (incremento 0x9E3779B9 e finalizzatore a due giri), poi si scartano le prime
 * 12 uscite come raccomandato per sfc32.
 *
 * Solo aritmetica intera a 32 bit (Math.imul, >>> 0, |0): niente BigInt, niente
 * aritmetica a 64 bit (la lezione dell'xorshift64 in PHP). Le uscite intere sono
 * quindi IDENTICHE AL BIT su qualunque motore JavaScript, in Node e nel browser.
 *
 * Attenzione ai reali: `uniforme()` e `intero()` derivano dagli interi con
 * operazioni esatte e restano identici ovunque; `gaussiana()` usa Math.log,
 * Math.sqrt, Math.cos e Math.sin, che lo standard ECMAScript definisce
 * "implementation-approximated": i risultati sono deterministici sullo stesso
 * motore (stessa versione di Node o dello stesso browser) ma NON garantiti
 * identici al bit fra motori diversi. Per questo le partite si registrano
 * (istantanee della verita'), non si ricalcolano nel browser.
 *
 * Sotto-flussi: `deriva(etichetta)` crea un generatore indipendente (per
 * esempio uno per battello o per sensore) che dipende SOLO dal seme di chi lo
 * deriva e dall'etichetta, non da quanti numeri sono gia' stati estratti.
 * Cosi' aggiungere un'estrazione in un punto del codice non sposta i numeri
 * di tutte le altre entita'.
 *
 * Lo stato e' un oggetto JSON semplice: si salva con `stato()` e si riprende
 * con `Generatore.daStato()`, comprese le eventuali gaussiane in serbo.
 */

const DUE_ALLA_32 = 4294967296;
const SCARTI_INIZIALI = 12;

/**
 * @typedef {object} StatoGeneratore
 * @property {1} versione formato dello stato
 * @property {number} seme32 seme normalizzato a 32 bit (radice delle derivazioni)
 * @property {[number, number, number, number]} s stato di sfc32 (a, b, c, contatore)
 * @property {number | null} riserva seconda gaussiana di Box-Muller non ancora usata
 */

/**
 * Rotazione a sinistra su 32 bit.
 * @param {number} x
 * @param {number} r
 * @returns {number}
 */
function rotl(x, r) {
  return (x << r) | (x >>> (32 - r));
}

/**
 * Impronta a 32 bit di una stringa, in stile MurmurHash3 (blocchi = unita'
 * UTF-16, finalizzatore fmix32). Deterministica ovunque: solo Math.imul e
 * operatori sui bit. Non e' crittografica e non deve esserlo.
 * @param {string} testo
 * @param {number} [seme] seme a 32 bit
 * @returns {number} intero senza segno a 32 bit
 */
export function impronta32(testo, seme = 0) {
  let h = seme | 0;
  for (let i = 0; i < testo.length; i++) {
    let k = testo.charCodeAt(i);
    k = Math.imul(k, 0xcc9e2d51);
    k = rotl(k, 15);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
    h = rotl(h, 13);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  h ^= testo.length;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Riduce un seme qualsiasi a 32 bit: un intero in [0, 2^32) resta com'e';
 * qualunque altro numero finito e qualunque stringa passano per impronta32
 * (dei numeri si usa la forma testuale, che ECMAScript definisce in modo
 * univoco).
 * @param {number | string} seme
 * @returns {number}
 */
export function normalizzaSeme(seme) {
  if (typeof seme === 'number') {
    if (!Number.isFinite(seme)) throw new RangeError(`seme non finito: ${seme}`);
    if (Number.isInteger(seme) && seme >= 0 && seme < DUE_ALLA_32) return seme >>> 0;
    return impronta32(String(seme));
  }
  if (typeof seme === 'string') return impronta32(seme);
  throw new TypeError('il seme deve essere un numero o una stringa');
}

/**
 * Crea la funzione splitmix32 a partire da un seme a 32 bit.
 * @param {number} seme32
 * @returns {() => number} ogni chiamata restituisce un intero senza segno a 32 bit
 */
export function splitmix32(seme32) {
  let a = seme32 | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

/**
 * Generatore pseudocasuale sfc32 con seme e sotto-flussi.
 */
export class Generatore {
  /**
   * @param {number | string} seme intero, reale o stringa (per esempio
   *   l'identificativo della partita)
   */
  constructor(seme) {
    /** @private */ this._seme32 = normalizzaSeme(seme);
    const sm = splitmix32(this._seme32);
    /** @private */ this._a = sm() | 0;
    /** @private */ this._b = sm() | 0;
    /** @private */ this._c = sm() | 0;
    /** @private */ this._d = sm() | 0;
    /** @private @type {number | null} */ this._riserva = null;
    for (let i = 0; i < SCARTI_INIZIALI; i++) this.prossimoUint32();
  }

  /** Seme normalizzato a 32 bit da cui discendono le derivazioni. */
  get seme32() {
    return this._seme32;
  }

  /**
   * Prossimo intero senza segno a 32 bit (passo di sfc32).
   * @returns {number}
   */
  prossimoUint32() {
    const t = (((this._a + this._b) | 0) + this._d) | 0;
    this._d = (this._d + 1) | 0;
    this._a = this._b ^ (this._b >>> 9);
    this._b = (this._c + (this._c << 3)) | 0;
    this._c = rotl(this._c, 21);
    this._c = (this._c + t) | 0;
    return t >>> 0;
  }

  /**
   * Reale uniforme in [0, 1) con 32 bit di risoluzione (identico al bit su
   * ogni motore).
   * @returns {number}
   */
  uniforme() {
    return this.prossimoUint32() / DUE_ALLA_32;
  }

  /**
   * Reale uniforme in [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  intervallo(min, max) {
    return min + (max - min) * this.uniforme();
  }

  /**
   * Intero uniforme in [min, max], estremi compresi, senza distorsione
   * (rigetto delle uscite oltre l'ultimo multiplo intero dell'ampiezza).
   * @param {number} min intero
   * @param {number} max intero, >= min, con max - min + 1 <= 2^32
   * @returns {number}
   */
  intero(min, max) {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
      throw new RangeError(`intervallo intero non valido: [${min}, ${max}]`);
    }
    const ampiezza = max - min + 1;
    if (ampiezza > DUE_ALLA_32) throw new RangeError('intervallo piu\' ampio di 2^32');
    const limite = DUE_ALLA_32 - (DUE_ALLA_32 % ampiezza);
    let u = this.prossimoUint32();
    while (u >= limite) u = this.prossimoUint32();
    return min + (u % ampiezza);
  }

  /**
   * Vero con probabilita' p.
   * @param {number} p in [0, 1]
   * @returns {boolean}
   */
  probabilita(p) {
    return this.uniforme() < p;
  }

  /**
   * Normale (gaussiana) con media e deviazione standard date, con il metodo
   * di Box-Muller: ogni coppia di uniformi da' due gaussiane, la seconda resta
   * in serbo (e viaggia nello stato serializzato). Deterministica sullo stesso
   * motore, non garantita identica al bit fra motori diversi (vedi in testa).
   * @param {number} [media]
   * @param {number} [sigma]
   * @returns {number}
   */
  gaussiana(media = 0, sigma = 1) {
    if (this._riserva !== null) {
      const z = this._riserva;
      this._riserva = null;
      return media + sigma * z;
    }
    // u1 in (0, 1]: il logaritmo resta finito.
    const u1 = (this.prossimoUint32() + 1) / DUE_ALLA_32;
    const u2 = this.prossimoUint32() / DUE_ALLA_32;
    const r = Math.sqrt(-2 * Math.log(u1));
    const th = 2 * Math.PI * u2;
    this._riserva = r * Math.sin(th);
    return media + sigma * r * Math.cos(th);
  }

  /**
   * Elemento a caso di un array non vuoto.
   * @template T
   * @param {readonly T[]} elementi
   * @returns {T}
   */
  scegli(elementi) {
    if (elementi.length === 0) throw new RangeError('scelta da un array vuoto');
    return elementi[this.intero(0, elementi.length - 1)];
  }

  /**
   * Mescola l'array sul posto (Fisher-Yates) e lo restituisce.
   * @template T
   * @param {T[]} elementi
   * @returns {T[]}
   */
  mescola(elementi) {
    for (let i = elementi.length - 1; i > 0; i--) {
      const j = this.intero(0, i);
      const t = elementi[i];
      elementi[i] = elementi[j];
      elementi[j] = t;
    }
    return elementi;
  }

  /**
   * Sotto-flusso indipendente identificato da un'etichetta (per esempio
   * 'battello:688-1', 'sensore:sfera', o un numero d'entita'). Dipende solo dal
   * seme di questo generatore e dall'etichetta.
   * @param {string | number} etichetta
   * @returns {Generatore}
   */
  deriva(etichetta) {
    return new Generatore(impronta32(String(etichetta), this._seme32 ^ 0x5bd1e995));
  }

  /**
   * Stato serializzabile in JSON.
   * @returns {StatoGeneratore}
   */
  stato() {
    return {
      versione: 1,
      seme32: this._seme32,
      s: [this._a >>> 0, this._b >>> 0, this._c >>> 0, this._d >>> 0],
      riserva: this._riserva,
    };
  }

  /**
   * Ricostruisce un generatore da uno stato salvato con `stato()`.
   * @param {StatoGeneratore} stato
   * @returns {Generatore}
   */
  static daStato(stato) {
    const ok =
      stato !== null &&
      typeof stato === 'object' &&
      stato.versione === 1 &&
      isUint32(stato.seme32) &&
      Array.isArray(stato.s) &&
      stato.s.length === 4 &&
      stato.s.every(isUint32) &&
      (stato.riserva === null || Number.isFinite(stato.riserva));
    if (!ok) throw new TypeError('stato del generatore non valido');
    const g = new Generatore(0);
    g._seme32 = stato.seme32;
    g._a = stato.s[0] | 0;
    g._b = stato.s[1] | 0;
    g._c = stato.s[2] | 0;
    g._d = stato.s[3] | 0;
    g._riserva = stato.riserva;
    return g;
  }

  /**
   * Copia indipendente con lo stesso stato.
   * @returns {Generatore}
   */
  clona() {
    return Generatore.daStato(this.stato());
  }
}

/**
 * @param {unknown} x
 * @returns {boolean}
 */
function isUint32(x) {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < DUE_ALLA_32;
}
