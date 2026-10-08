// @ts-check
/**
 * La perdita di trasmissione in linea (F2, filone G; PROGETTO §5.3): la lettura
 * delle tabelle calcolate fuori linea dal tracciatore di raggi
 * (tools/acustica/tabelle.py) per ogni coppia sorgente-ricevitore, a costo
 * costante e senza tracciare raggi durante la partita.
 *
 *   const p = await caricaPropagazione('torpex_palestra');   // null se lo scenario non ha tabelle
 *   p.perdita({x, y, z}, {x, y, z}, 'sfera')   → dB    (banda delle tabelle)
 *   p.perdita(s, r, 437)                        → dB    (frequenza in Hz: interpola fra le bande strette)
 *   const via = p.percorso(s, r);  via.perdita('towed'); via.perdita(50); …   (piu' bande, un solo percorso)
 *
 * Le bande delle tabelle (blocco `propagazione.bande` dello scenario): 'sfera'
 * e 'towed' (le ottave dei sensori a banda larga di shared/data/acustica.json)
 * e le strette 'f50', 'f100', 'f300', 'f1000', 'f3500' (attivo BQQ-5 e
 * intercettazione) e 'f25000' (teste dei siluri, F3). Con una frequenza in Hz
 * si interpola fra le strette nel logaritmo della frequenza, e l'assorbimento si
 * rimette esatto per quella frequenza (le tabelle lo tengono fuori).
 *
 * COME UN PERCORSO SCEGLIE LE TABELLE. Ogni tabella e' calcolata per un fondale
 * piatto (una «regione»: classe di fondale con il suo tipo di fondo e il suo
 * profilo, rimescolato dentro il fronte di marea o stratificato fuori). Lungo il
 * segmento sorgente-ricevitore si legge un punto del fondale ogni
 * `percorso.passo_campioni` metri, al piu' `percorso.campioni` (piu' i due estremi,
 * pesati la meta': la regola del trapezio); ogni punto da'
 * il suo peso alle due classi che lo comprendono, interpolando nel logaritmo
 * della profondita'. La TL e' la media delle TL delle classi pesata cosi',
 * cioe' la frazione di percorso che il suono fa in ciascuna: e' esatta per la
 * parte di perdita che cresce con i chilometri (fondo, superficie) e una buona
 * approssimazione per la divergenza; e' simmetrica (reciprocita') e costa
 * sempre uguale. Se un campione cade sulla terra il percorso passa sopra
 * un'isola e si aggiunge `percorso.perdita_terra` (l'ombra). In ogni tabella le
 * quote si limitano al suo fondale (un battello a 300 m in un canale e un
 * tratto di piattaforma da 190 m: in quel tratto conta come stesse sul fondo).
 *
 * REGOLA DI GIOCO DELLO STRATO (facoltativa). Le tabelle contengono lo strato
 * com'e' in fisica: d'estate alle Fær Øer (21 m) nasconde poco, perche' e' troppo
 * sottile per intrappolare le frequenze dei sonar e sotto il fondo riempie l'ombra
 * (docs/CALIBRAZIONE_F2.md). `percorso.perdita_strato` dello scenario (dB, 0 =
 * solo fisica) aggiunge la perdita nozionale di F1 ai percorsi che hanno sorgente
 * e ricevitore da parti opposte dello strato, per la frazione di percorso in acqua
 * stratificata, raccordata da 500 a 2000 m come in F1.
 *
 * Dentro una tabella: interpolazione bilineare nelle quote (in dB) e lineare
 * nel logaritmo della distanza della parte TL − 20·log r − α·r, poi si
 * rimettono 20·log r e α·r esatti. Sotto la prima distanza (25 m) divergenza
 * sferica sulla distanza obliqua raccordata al primo valore.
 *
 * RISERVA. Senza tabelle vale l'analitico di F1 (livello C di 05 §6.3,
 * `perditaTrasmissione` di server/src/sim/sensors/acustica.js) dietro la stessa
 * interfaccia: `propagazioneAnalitica(ac, amb)`.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { caricaAmbiente } from '../../../../shared/ambiente.js';
import { perditaTrasmissione } from '../sensors/acustica.js';

/** Intestazione del file .tl.bin. */
export const MAGIA_TL = 'TERMOTL1';
const BYTE_INTESTAZIONE = 32;
const LN10_20 = 20 / Math.LN10;

/** @typedef {{x: number, y: number, z: number}} Punto3 */
/** @typedef {string | number} Banda  id di banda delle tabelle, o frequenza in Hz */

/**
 * L'interfaccia comune alle tabelle e alla riserva analitica.
 * @typedef {object} Propagazione
 * @property {'tabelle' | 'analitico'} fonte
 * @property {(s: Punto3, r: Punto3, banda: Banda) => number} perdita  TL in dB
 * @property {(s: Punto3, r: Punto3) => {perdita: (banda: Banda) => number}} percorso
 */

/**
 * Il blocco `propagazione` dello scenario ridotto ai valori.
 * @typedef {object} BloccoPropagazione
 * @property {string} formato
 * @property {Array<{id: string, fondale: number, fondo: string, profilo: string}>} regioni
 * @property {Array<{id: string, centro: number, da: number, a: number, alfa: number}>} bande
 * @property {number[]} quote
 * @property {{prima: number, rapporto: number, numero: number}} distanze
 * @property {{passo: number, zero: number}} codifica
 * @property {{campioni: number, passo_campioni?: number, soglia_terra: number, perdita_terra: number,
 *   perdita_strato?: number}} percorso
 * @property {{file: string, codifica: string, byte: number, sha256: string}} tabella
 */

/**
 * @typedef {object} OpzioniTabelle
 * @property {(x: number, y: number) => number} [fondale]  m (NaN fuori dalla griglia, ≤ 0 sulla terra): una
 *   batimetria qualsiasi (prove, taratura su fondale piatto); lenta, si legge punto per punto
 * @property {{colonne: number, righe: number, xMin: number, yMax: number, passo: number, nodi: ArrayLike<number>}} [griglia]
 *   la griglia del fondale dello scenario (shared/ambiente.js): la via veloce. Una delle due
 * @property {(f: number) => number} assorbimento  dB/km alla frequenza f (Hz)
 * @property {number} [fondaleFuori]  m, quando `fondale` da' NaN (fuori dalla griglia)
 * @property {number} [quotaStrato]  m, profondita' dello strato (per la regola di gioco facoltativa)
 */

export class TabellePropagazione {
  /**
   * @param {BloccoPropagazione} blocco
   * @param {Uint8Array} byte  il contenuto del file .tl.bin
   * @param {OpzioniTabelle} o
   */
  constructor(blocco, byte, o) {
    /** @type {'tabelle'} */
    this.fonte = 'tabelle';
    this.blocco = blocco;
    const dv = new DataView(byte.buffer, byte.byteOffset, byte.byteLength);
    const magia = String.fromCharCode(...byte.subarray(0, 8));
    if (magia !== MAGIA_TL) throw new TypeError(`tabelle di propagazione: intestazione ${magia}`);
    const [nT, nB, nQ, nR, zero, centesimi] = [0, 1, 2, 3, 4, 5].map((k) => dv.getUint32(8 + 4 * k, true));
    if (nT !== blocco.regioni.length || nB !== blocco.bande.length || nQ !== blocco.quote.length
      || nR !== blocco.distanze.numero || zero !== blocco.codifica.zero
      || centesimi !== Math.round(blocco.codifica.passo * 100)) {
      throw new TypeError('tabelle di propagazione: il file non corrisponde al blocco dello scenario');
    }
    this.byte = byte;
    this.fondale = o.fondale ?? null;
    this.assorbimento = o.assorbimento;
    this.fondaleFuori = o.fondaleFuori ?? Math.max(...blocco.regioni.map((r) => r.fondale));
    this.nR = nR;
    this.r0 = blocco.distanze.prima;
    this.lnq = Math.log(blocco.distanze.rapporto);
    this.passo = blocco.codifica.passo;
    this.zero = zero;
    this.campioni = Math.max(1, Math.round(blocco.percorso.campioni));
    this.passoCampioni = blocco.percorso.passo_campioni ?? 0;
    this.sogliaTerra = blocco.percorso.soglia_terra;
    this.perditaTerra = blocco.percorso.perdita_terra;
    this.perditaStrato = blocco.percorso.perdita_strato ?? 0;
    this.quotaStrato = o.quotaStrato ?? NaN;
    /** 1 per le classi di fondale con l'acqua stratificata (dove c'e' lo strato) */
    this.stratificate = Uint8Array.from(blocco.regioni, (r) => (r.profilo === 'stratificato' ? 1 : 0));
    /** @type {Map<string, number>} */
    this.indiceBanda = new Map(blocco.bande.map((b, i) => [b.id, i]));
    /** @type {string} */
    this._ultimaBanda = '';
    this._ultimoIndice = 0;
    /** α delle bande, dB/m */
    this.alfa = Float64Array.from(blocco.bande, (b) => b.alfa / 1000);
    // bande strette per la lettura a frequenza: ordinate per centro
    const strette = blocco.bande.map((b, i) => ({ i, f: b.centro, id: b.id })).filter((b) => /^f\d+$/.test(b.id))
      .sort((a, b) => a.f - b.f);
    this.stretteIndice = Int32Array.from(strette, (b) => b.i);
    this.stretteLnF = Float64Array.from(strette, (b) => Math.log(b.f));
    // tabelle: fondale, quote valide, indice delle quote al metro, scostamento di ogni (tabella, banda)
    let base = BYTE_INTESTAZIONE;
    /** @type {{fondale: number, lnH: number, quote: Float64Array, n: number, perMetro: Int16Array, base: Int32Array,
     *   riga: Int32Array, inversi: Float64Array}[]} */
    this.tabelle = blocco.regioni.map((reg) => {
      const H = reg.fondale;
      const q = blocco.quote.filter((z) => z < H - 1);
      q.push(H - 1);
      const quote = Float64Array.from(q);
      const n = quote.length;
      // per ogni metro intero di quota, l'indice i del tratto [quote[i], quote[i+1]] che lo contiene
      const perMetro = new Int16Array(Math.ceil(H) + 2);
      let i = 0;
      for (let m = 0; m < perMetro.length; m++) {
        while (i < n - 2 && quote[i + 1] <= m) i++;
        perMetro[m] = i;
      }
      const coppie = (n * (n + 1)) / 2;
      const basi = new Int32Array(nB);
      for (let b = 0; b < nB; b++) { basi[b] = base; base += coppie * nR; }
      // indice della coppia (i, j), i <= j, nell'ordine del file: riga[i] + j
      const riga = Int32Array.from({ length: n }, (_, i) => i * n - (i * (i - 1)) / 2 - i);
      // 1 / (quote[i+1] - quote[i]) (l'ultimo non serve: il tratto si ferma a n - 2)
      const inversi = Float64Array.from({ length: n }, (_, i) => (i < n - 1 ? 1 / (quote[i + 1] - quote[i]) : 0));
      return { fondale: H, lnH: Math.log(H), quote, n, perMetro, base: basi, riga, inversi };
    });
    if (base !== byte.byteLength) throw new RangeError(`tabelle di propagazione: ${byte.byteLength} byte, attesi ${base}`);
    this.lnH = Float64Array.from(this.tabelle, (t) => t.lnH);
    this.classeFuori = this.classe(this.fondaleFuori);
    // La via veloce: la classe di fondale di ogni nodo della griglia, calcolata una volta, in un byte (la
    // coordinata continua fra le tabelle a passi di 1/32; 255 sulla terra: 160 KB, stanno nella cache); lungo
    // un percorso si legge il nodo piu' vicino (500 m).
    if (!this.fondale && !o.griglia) throw new TypeError('tabelle di propagazione: serve la griglia o una funzione del fondale');
    if (o.griglia) {
      const g = o.griglia;
      this.griglia = { colonne: g.colonne, righe: g.righe, xMin: g.xMin, yMax: g.yMax, inv: 1 / g.passo };
      this.classi = Uint8Array.from(g.nodi, (h) => (h >= this.sogliaTerra ? Math.round(this.classe(h) * 32) : 255));
    } else {
      this.griglia = null;
      this.classi = null;
    }
    // percorso riusato da `perdita` (nessuna allocazione per chiamata)
    this._via = new Percorso(this);
  }

  /**
   * La coordinata continua di classe di un fondale h: i + f fra la tabella i e la i+1, interpolando nel
   * logaritmo della profondita' (0 sotto la prima, n−1 sopra l'ultima).
   * @param {number} h m (> 0)
   */
  classe(h) {
    const lnH = this.lnH;
    const n = lnH.length;
    const x = Math.log(h);
    if (x <= lnH[0]) return 0;
    if (x >= lnH[n - 1]) return n - 1;
    let i = 0;
    while (x > lnH[i + 1]) i++;
    return i + (x - lnH[i]) / (lnH[i + 1] - lnH[i]);
  }

  /**
   * La classe nel punto: −1 sulla terra.
   * @param {number} x
   * @param {number} y
   */
  _classeIn(x, y) {
    const g = this.griglia;
    if (g && this.classi) {
      const j = Math.round((x - g.xMin) * g.inv);
      const i = Math.round((g.yMax - y) * g.inv);
      if (j < 0 || i < 0 || j >= g.colonne || i >= g.righe) return this.classeFuori;
      const c = this.classi[i * g.colonne + j];
      return c === 255 ? -1 : c * 0.03125;
    }
    const h = /** @type {(x: number, y: number) => number} */ (this.fondale)(x, y);
    if (Number.isNaN(h)) return this.classeFuori;
    return h >= this.sogliaTerra ? this.classe(h) : -1;
  }

  /**
   * TL fra due punti in una banda (id) o a una frequenza (Hz).
   * @param {Punto3} s sorgente
   * @param {Punto3} r ricevitore
   * @param {Banda} banda
   */
  perdita(s, r, banda) {
    return this._prepara(this._via, s, r).perdita(banda);
  }

  /**
   * Il percorso fra due punti, per leggerne piu' bande. L'oggetto e' NUOVO a
   * ogni chiamata (si puo' tenere); `perdita` invece ne riusa uno interno.
   * @param {Punto3} s
   * @param {Punto3} r
   * @returns {Percorso}
   */
  percorso(s, r) {
    return this._prepara(new Percorso(this), s, r);
  }

  /**
   * @param {Percorso} via
   * @param {Punto3} s
   * @param {Punto3} r
   */
  _prepara(via, s, r) {
    const dx = r.x - s.x;
    const dy = r.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    via.d = d;
    via.zs = s.z;
    via.zr = r.z;
    // distanza: indice e peso nella progressione geometrica, una volta per percorso
    let u = d > this.r0 ? Math.log(d / this.r0) / this.lnq : 0;
    if (u > this.nR - 1) u = this.nR - 1;
    let k = u | 0;
    if (k > this.nR - 2) k = this.nR - 2;
    via.k = k;
    via.wk = u - k;
    const pesi = via.pesi;
    pesi.fill(0);
    // campioni interni: uno ogni `passo_campioni` metri, al piu' `campioni` (costo limitato e costante)
    let interni = this.campioni;
    if (this.passoCampioni > 0) {
      const n = Math.ceil(d / this.passoCampioni) - 1;
      interni = n < 1 ? 1 : (n > interni ? interni : n);
    }
    const passi = interni + 1;
    let terra = false;
    const g = this.griglia;
    const classi = this.classi;
    // via veloce: coordinate di griglia incrementali, nodo piu' vicino
    const gj0 = g ? (s.x - g.xMin) * g.inv + 0.5 : 0;
    const gi0 = g ? (g.yMax - s.y) * g.inv + 0.5 : 0;
    const dgj = g ? (dx * g.inv) / passi : 0;
    const dgi = g ? (-dy * g.inv) / passi : 0;
    for (let c = 0; c <= passi; c++) {
      let v;
      if (g && classi) {
        const fj = gj0 + dgj * c;
        const fi = gi0 + dgi * c;
        if (fj < 0 || fi < 0 || fj >= g.colonne || fi >= g.righe) v = this.classeFuori;
        else {
          const codice = classi[(fi | 0) * g.colonne + (fj | 0)];
          v = codice === 255 ? -1 : codice * 0.03125;
        }
      } else {
        const t = c / passi;
        v = this._classeIn(s.x + dx * t, s.y + dy * t);
      }
      const estremo = c === 0 || c === passi;
      if (v < 0) {
        if (!estremo) terra = true;
        v = 0;
      }
      const w = estremo ? 0.5 : 1;
      const i = v | 0;
      const f = v - i;
      pesi[i] += w * (1 - f);
      if (f > 0) pesi[i + 1] += w * f;
    }
    let strat = 0;
    const inv = 1 / passi;
    for (let i = 0; i < pesi.length; i++) {
      pesi[i] *= inv;
      if (this.stratificate[i]) strat += pesi[i];
    }
    via.terra = terra;
    via.stratificata = strat;
    return via;
  }

  /**
   * TL − 20·log r − α_b·r (la parte tabulata) in una tabella e una banda.
   * @param {number} t indice della tabella
   * @param {number} b indice della banda
   * @param {number} k indice della distanza (si leggono k e k+1)
   * @param {number} wk peso di k+1
   * @param {number} zs m
   * @param {number} zr m
   */
  _anomalia(t, b, k, wk, zs, zr) {
    const tab = this.tabelle[t];
    const q = tab.quote;
    const ultima = q[tab.n - 1];
    // quote: limitate alla tabella, tratto e peso
    const zsC = zs < q[0] ? q[0] : (zs > ultima ? ultima : zs);
    const zrC = zr < q[0] ? q[0] : (zr > ultima ? ultima : zr);
    const is = tab.perMetro[zsC | 0];
    const ir = tab.perMetro[zrC | 0];
    const ws = (zsC - q[is]) * tab.inversi[is];
    const wr = (zrC - q[ir]) * tab.inversi[ir];
    const base = tab.base[b] + k;
    const riga = tab.riga;
    const nR = this.nR;
    const B = this.byte;
    // le quattro coppie di quote (simmetriche: si legge la coppia con i <= j), ciascuna lineare in distanza
    const v00 = cella(B, base, riga, nR, wk, is, ir);
    const v01 = cella(B, base, riga, nR, wk, is, ir + 1);
    const v10 = cella(B, base, riga, nR, wk, is + 1, ir);
    const v11 = cella(B, base, riga, nR, wk, is + 1, ir + 1);
    const acc = (1 - ws) * ((1 - wr) * v00 + wr * v01) + ws * ((1 - wr) * v10 + wr * v11);
    return (acc - this.zero) * this.passo;
  }
}

/**
 * Il codice di una coppia di quote (i, j) interpolato fra le distanze k e k+1.
 * @param {Uint8Array} B
 * @param {number} base  inizio del blocco (tabella, banda) piu' k
 * @param {Int32Array} riga  riga[i] + j = indice della coppia (i <= j)
 * @param {number} nR
 * @param {number} wk
 * @param {number} i
 * @param {number} j
 */
function cella(B, base, riga, nR, wk, i, j) {
  const off = base + (i <= j ? riga[i] + j : riga[j] + i) * nR;
  const a = B[off];
  return a + (B[off + 1] - a) * wk;
}

/**
 * Un percorso sorgente-ricevitore gia' campionato: pesi delle classi di
 * fondale, terra in mezzo, distanza e quote.
 */
export class Percorso {
  /** @param {TabellePropagazione} tab */
  constructor(tab) {
    this.tab = tab;
    this.pesi = new Float64Array(tab.tabelle.length);
    this.d = 0;
    this.zs = 0;
    this.zr = 0;
    this.terra = false;
    /** frazione del percorso in acqua stratificata */
    this.stratificata = 0;
    /** indice e peso della distanza nelle tabelle */
    this.k = 0;
    this.wk = 0;
  }

  /**
   * TL in dB in una banda delle tabelle (id) o a una frequenza (Hz).
   * @param {Banda} banda
   * @returns {number}
   */
  perdita(banda) {
    const T = this.tab;
    if (typeof banda === 'number') return this._perditaFrequenza(banda);
    // l'ultima banda chiesta (quasi sempre la stessa): niente ricerca nella mappa
    let b = T._ultimoIndice;
    if (banda !== T._ultimaBanda) {
      const i = T.indiceBanda.get(banda);
      if (i === undefined) throw new RangeError(`banda di propagazione sconosciuta: ${banda}`);
      T._ultimaBanda = banda;
      T._ultimoIndice = b = i;
    }
    return this._somma(b) + this._geometria(T.alfa[b]);
  }

  /**
   * @param {number} f Hz
   */
  _perditaFrequenza(f) {
    const T = this.tab;
    const lf = T.stretteLnF;
    const n = lf.length;
    const x = Math.log(f);
    let anom;
    if (x <= lf[0]) anom = this._somma(T.stretteIndice[0]);
    else if (x >= lf[n - 1]) anom = this._somma(T.stretteIndice[n - 1]);
    else {
      let i = 0;
      while (x > lf[i + 1]) i++;
      const w = (x - lf[i]) / (lf[i + 1] - lf[i]);
      anom = (1 - w) * this._somma(T.stretteIndice[i]) + w * this._somma(T.stretteIndice[i + 1]);
    }
    return anom + this._geometria(T.assorbimento(f) / 1000);
  }

  /**
   * La parte tabulata, media delle classi del percorso, piu' l'ombra della terra.
   * @param {number} b indice della banda
   */
  _somma(b) {
    const T = this.tab;
    let acc = 0;
    const pesi = this.pesi;
    for (let t = 0; t < pesi.length; t++) {
      const p = pesi[t];
      if (p > 0) acc += p * T._anomalia(t, b, this.k, this.wk, this.zs, this.zr);
    }
    if (this.terra) acc += T.perditaTerra;
    if (T.perditaStrato > 0 && this.stratificata > 0 && (this.zs < T.quotaStrato) !== (this.zr < T.quotaStrato)) {
      const k = (this.d - 500) / 1500;
      acc += T.perditaStrato * this.stratificata * (k < 0 ? 0 : (k > 1 ? 1 : k));
    }
    return acc;
  }

  /**
   * 20·log r + α·r; sotto la prima distanza della tabella, divergenza sferica
   * sulla distanza obliqua raccordata alla prima distanza.
   * @param {number} alfa dB/m
   */
  _geometria(alfa) {
    const T = this.tab;
    if (this.d >= T.r0) return LN10_20 * Math.log(this.d) + alfa * this.d;
    const dz = this.zr - this.zs;
    const obliqua = Math.sqrt(this.d * this.d + dz * dz);
    const obliqua0 = Math.sqrt(T.r0 * T.r0 + dz * dz);
    return LN10_20 * (Math.log(T.r0) + Math.log(Math.max(1, obliqua) / obliqua0)) + alfa * obliqua;
  }
}

// ---------------------------------------------------------------------------
// Riserva analitica (F1)
// ---------------------------------------------------------------------------

/**
 * La perdita di F1 dietro la stessa interfaccia: le bande delle tabelle diventano
 * frequenze ('sfera' e 'towed' il centro delle bande di acustica.json, 'f300'
 * 300 Hz), le frequenze restano frequenze.
 * @param {import('../sensors/acustica.js').ValoriAcustica} ac
 * @param {import('./ambiente.js').Ambiente} amb  l'ambiente del motore (senza tabelle)
 * @returns {Propagazione}
 */
export function propagazioneAnalitica(ac, amb) {
  const senza = { ...amb, propagazione: undefined };
  /** @param {Banda} banda */
  const frequenza = (banda) => {
    if (typeof banda === 'number') return banda;
    const b = /** @type {Record<string, {centro: number}>} */ (ac.bande)[banda];
    if (b) return b.centro;
    const m = /^f(\d+(?:\.\d+)?)$/.exec(banda);
    if (m) return Number(m[1]);
    throw new RangeError(`banda di propagazione sconosciuta: ${banda}`);
  };
  /** @type {Propagazione} */
  const p = {
    fonte: 'analitico',
    perdita: (s, r, banda) => perditaTrasmissione(ac, senza, frequenza(banda), s, r),
    percorso: (s, r) => ({ perdita: (banda) => perditaTrasmissione(ac, senza, frequenza(banda), s, r) }),
  };
  return p;
}

// ---------------------------------------------------------------------------
// Caricamento
// ---------------------------------------------------------------------------

/**
 * Le tabelle di uno scenario gia' caricato (shared/ambiente.js), o null se lo
 * scenario non le ha. Il file e' controllato (intestazione, dimensione, SHA-256).
 * @param {import('../../../../shared/ambiente.js').Ambiente} ambiente
 * @param {{fondale?: (x: number, y: number) => number, leggi?: (url: URL) => Promise<Uint8Array>}} [o]
 *   `fondale` per sostituire la batimetria (per esempio un fondale piatto nelle prove e nella taratura)
 * @returns {Promise<TabellePropagazione | null>}
 */
export async function tabelleDaAmbiente(ambiente, o = {}) {
  const blocco = /** @type {BloccoPropagazione | undefined} */ (/** @type {any} */ (ambiente.valori).propagazione);
  const file = blocco?.tabella?.file;
  if (!blocco || typeof file !== 'string' || !/^[\w.-]+\.tl\.bin$/.test(file)) return null;
  const url = new URL(`../../../../shared/data/scenari/${file}`, import.meta.url);
  /** @type {Uint8Array} */
  let byte;
  try {
    byte = o.leggi ? await o.leggi(url) : new Uint8Array(await readFile(url));
  } catch (e) {
    if (/** @type {any} */ (e).code === 'ENOENT') return null;
    throw e;
  }
  if (byte.byteLength !== blocco.tabella.byte) {
    throw new RangeError(`${file}: ${byte.byteLength} byte, lo scenario ne dice ${blocco.tabella.byte}`);
  }
  const sha = createHash('sha256').update(byte).digest('hex');
  if (sha !== blocco.tabella.sha256) throw new TypeError(`${file}: SHA-256 diverso da quello dello scenario`);
  return new TabellePropagazione(blocco, byte, {
    ...(o.fondale ? { fondale: o.fondale } : { griglia: ambiente.griglia }),
    assorbimento: (f) => ambiente.assorbimento(f),
    fondaleFuori: ambiente.valori.batimetria.fondale_massimo,
    quotaStrato: ambiente.strato().profondita,
  });
}

/**
 * Carica le tabelle di uno scenario (null se non ne ha).
 * @param {string} id
 * @param {{fondale?: (x: number, y: number) => number}} [o]
 * @returns {Promise<TabellePropagazione | null>}
 */
export async function caricaPropagazione(id, o = {}) {
  return tabelleDaAmbiente(await caricaAmbiente(id), o);
}
