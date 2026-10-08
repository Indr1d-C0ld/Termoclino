// @ts-check
/**
 * ESM e radar (F2). Le onde radio non sono il suono: corrono in linea retta
 * fino all'orizzonte radio (raggio terrestre per 4/3, 4,12·√h km) e oltre
 * calano per diffrazione sulla terra sferica (ITU-R P.526, [ITU-P526]). Per
 * l'ESM il segnale fa un percorso solo: un radar si sente molto piu' lontano
 * di quanto quel radar veda il periscopio (04 §4.6.3), e ben oltre l'orizzonte
 * acustico.
 *
 *   P_r (dBm) = P_t + G_t − 20·log(4π·d/λ) − L_diffrazione − perdite
 *   livello   = P_r − sensibilita' dell'ESM
 *
 * con L_diffrazione = 0 entro l'orizzonte radio e, oltre, l'attenuazione di
 * P.526 (F(X) + G(Y1) + G(Y2), β = 1) misurata a partire dal suo valore
 * all'orizzonte, cosi' che la curva sia continua (scelta nozionale dichiarata
 * in docs/CALIBRAZIONE_F2.md). Il radar proprio vede le navi e gli alberi
 * alzati entro l'orizzonte e entro la sua portata, che scala con la radice
 * quarta della sezione radar.
 */

import { normalizza360 } from '../../../../shared/units.js';
import { rilevamento } from '../../../../shared/geo.js';

/** @typedef {import('./acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../platform/battello.js').Battello} Battello */
/** @typedef {import('../../ai/navi.js').Nave} Nave */
/** @typedef {import('../../../../shared/rng.js').Generatore} Generatore */
/** @typedef {import('../../../../shared/data/firme.js').Radar} Radar */

const VELOCITA_LUCE = 299_792_458;

/**
 * Attenuazione di diffrazione sulla terra sferica liscia rispetto allo spazio
 * libero, ITU-R P.526 §3.1.1.2 (β = 1): −(F(X) + G(Y1) + G(Y2)), dB.
 * @param {number} fMHz
 * @param {number} dKm
 * @param {number} h1 m
 * @param {number} h2 m
 * @param {number} aeKm raggio terrestre equivalente
 */
export function attenuazioneP526(fMHz, dKm, h1, h2, aeKm) {
  const X = 2.188 * fMHz ** (1 / 3) * aeKm ** (-2 / 3) * dKm;
  const F = X >= 1.6 ? 11 + 10 * Math.log10(X) - 17.6 * X : -20 * Math.log10(X) - 5.6488 * X ** 1.425;
  /** @param {number} h */
  const G = (h) => {
    const B = 9.575e-3 * fMHz ** (2 / 3) * aeKm ** (-1 / 3) * Math.max(0.1, h);
    return B > 2 ? 17.6 * Math.sqrt(B - 1.1) - 5 * Math.log10(B - 1.1) - 8 : 20 * Math.log10(B + 0.1 * B ** 3);
  };
  return -(F + G(h1) + G(h2));
}

/**
 * Perdita di diffrazione oltre l'orizzonte radio, continua all'orizzonte, dB ≥ 0.
 * @param {number} f Hz
 * @param {number} d m
 * @param {number} h1 m
 * @param {number} h2 m
 * @param {number} ae m
 */
export function perditaDiffrazione(f, d, h1, h2, ae) {
  const dLos = orizzonteRadio(h1, h2, ae);
  if (d <= dLos) return 0;
  const fMHz = f / 1e6;
  return Math.max(0, attenuazioneP526(fMHz, d / 1000, h1, h2, ae / 1000) - attenuazioneP526(fMHz, dLos / 1000, h1, h2, ae / 1000));
}

/**
 * Distanza dell'orizzonte radio fra due antenne, m.
 * @param {number} h1 @param {number} h2 @param {number} ae
 */
export function orizzonteRadio(h1, h2, ae) {
  return Math.sqrt(2 * ae * Math.max(0, h1)) + Math.sqrt(2 * ae * Math.max(0, h2));
}

/**
 * Livello di un radar all'ingresso di un ESM, dB sopra la sua sensibilita'.
 * @param {Radar} r
 * @param {number} d m
 * @param {number} hEsm m
 * @param {number} sensibilita dB re 1 mW
 * @param {ValoriAcustica} ac
 */
export function livelloEsm(r, d, hEsm, sensibilita, ac) {
  const lambda = VELOCITA_LUCE / r.frequenza;
  const pt = 10 * Math.log10(r.potenza_picco * 1e6);
  const spazio = 20 * Math.log10(4 * Math.PI * Math.max(1, d) / lambda);
  const diff = perditaDiffrazione(r.frequenza, d, r.altezza, hEsm, ac.radio.raggio_terra_equivalente);
  return pt + r.guadagno - spazio - diff - ac.radio.perdite - sensibilita;
}

/**
 * Gli emettitori radar della partita in questo istante.
 * @param {Iterable<{id: string, tipo: string, x: number, y: number}>} entita
 * @returns {{id: string, x: number, y: number, radar: Radar}[]}
 */
export function emettitori(entita) {
  /** @type {{id: string, x: number, y: number, radar: Radar}[]} */
  const out = [];
  for (const e of entita) {
    if (e.tipo === 'nave') {
      for (const r of /** @type {Nave} */ (/** @type {unknown} */ (e)).emettitori) out.push({ id: e.id, x: e.x, y: e.y, radar: r });
    } else if (e.tipo === 'sottomarino') {
      const b = /** @type {Battello} */ (/** @type {unknown} */ (e));
      const r = b.p.sensori.radar;
      if (b.radarAttivo && r?.presente) {
        out.push({
          id: e.id, x: e.x, y: e.y,
          radar: {
            nome: r.nome ?? 'radar', banda: r.banda ?? '?', frequenza: r.frequenza ?? 9.4e9, potenza_picco: r.potenza_picco ?? 25,
            guadagno: r.guadagno ?? 28, fascio: r.fascio ?? 3, periodo: r.periodo ?? 5, altezza: r.altezza ?? 2.5,
          },
        });
      }
    }
  }
  return out;
}

/**
 * L'ESM di un battello: cosa sente adesso e cosa e' nuovo.
 */
export class Esm {
  /**
   * @param {Battello} b
   * @param {Generatore} rng
   */
  constructor(b, rng) {
    this.b = b;
    this.rng = rng;
    /** @type {Map<string, number>} chiave emettitore → ultima ora in cui l'ha sentito */
    this.ultimo = new Map();
  }

  /**
   * @param {object} a
   * @param {Iterable<{id: string, tipo: string, x: number, y: number}>} a.entita
   * @param {ValoriAcustica} a.ac
   * @param {number} a.ora
   * @returns {{emissioni: {rilevamento: number, tipo: string, banda: string, livello: number}[],
   *   nuove: {id: string, tipo: string, banda: string, rilevamento: number, distanza: number}[]}}
   */
  ascolta(a) {
    const b = this.b;
    const e = b.p.sensori.esm;
    /** @type {{rilevamento: number, tipo: string, banda: string, livello: number}[]} */
    const emissioni = [];
    /** @type {{id: string, tipo: string, banda: string, rilevamento: number, distanza: number}[]} */
    const nuove = [];
    if (!e?.presente) return { emissioni, nuove };
    for (const em of emettitori(a.entita)) {
      if (em.id === b.id) continue;
      const r = em.radar;
      if (r.frequenza < (e.banda_min ?? 0) || r.frequenza > (e.banda_max ?? Infinity)) continue;
      const d = Math.max(1, Math.hypot(em.x - b.x, em.y - b.y));
      const livello = livelloEsm(r, d, e.altezza ?? 3, e.sensibilita ?? -70, a.ac);
      if (livello < 0) continue;
      const ril = Math.round(normalizza360(rilevamento(b, em) + (e.sigma ?? 4) * this.rng.gaussiana())) % 360;
      const tipo = livello >= a.ac.radio.soglia_riconoscimento ? r.nome : 'sconosciuto';
      emissioni.push({ rilevamento: ril, tipo, banda: r.banda, livello: Math.round(livello) });
      const chiave = `${em.id}:${r.nome}`;
      const prima = this.ultimo.get(chiave);
      if (prima === undefined || a.ora - prima > a.ac.radio.ricomparsa) nuove.push({ id: em.id, tipo, banda: r.banda, rilevamento: ril, distanza: d });
      this.ultimo.set(chiave, a.ora);
    }
    return { emissioni, nuove };
  }
}

/**
 * Il radar proprio: un giro d'antenna ogni `periodo` secondi.
 */
export class RadarProprio {
  /**
   * @param {Battello} b
   * @param {Generatore} rng
   */
  constructor(b, rng) {
    this.b = b;
    this.rng = rng;
    this.prossimoGiro = 0;
  }

  /**
   * Un giro d'antenna, se e' il momento (null altrimenti).
   * @param {object} a
   * @param {Iterable<{id: string, tipo: string, x: number, y: number, velocita: number}>} a.entita
   * @param {ValoriAcustica} a.ac
   * @param {number} a.ora
   * @returns {{echi: {rilevamento: number, distanza: number}[], alberi: {id: string, distanza: number}[]} | null}
   */
  giro(a) {
    const b = this.b;
    const r = b.p.sensori.radar;
    if (!b.radarAttivo || !r?.presente) {
      this.prossimoGiro = a.ora;
      return null;
    }
    if (a.ora < this.prossimoGiro) return null;
    this.prossimoGiro = a.ora + Math.max(1, Math.round(r.periodo ?? 5));
    const ae = a.ac.radio.raggio_terra_equivalente;
    const h = r.altezza ?? 2.5;
    const rif = r.portata_rif ?? 20000;
    /** @type {{rilevamento: number, distanza: number}[]} */
    const echi = [];
    /** @type {{id: string, distanza: number}[]} */
    const alberi = [];
    for (const e of a.entita) {
      if (e.id === b.id) continue;
      let rcs;
      let hBersaglio;
      if (e.tipo === 'nave') {
        const n = /** @type {Nave} */ (/** @type {unknown} */ (e));
        rcs = a.ac.radio.rcs_nave;
        hBersaglio = (n.firma?.ottica?.altezza_alberi ?? 20) / 2;
      } else if (e.tipo === 'sottomarino') {
        const s = /** @type {Battello} */ (/** @type {unknown} */ (e));
        if (!(s.alberi.periscopio || s.alberi.esm || s.alberi.radar)) continue;
        const scia = Math.abs(s.velocita) > (s.p.sensori.periscopio.velocita_scia ?? 10);
        rcs = a.ac.radio.rcs_albero + (scia ? a.ac.radio.rcs_scia : 0);
        hBersaglio = s.p.sensori.periscopio.altezza_occhio ?? 2;
      } else {
        continue;
      }
      const d = Math.max(1, Math.hypot(e.x - b.x, e.y - b.y));
      const portata = Math.min(rif * 10 ** ((rcs - 30) / 40), orizzonteRadio(h, hBersaglio, ae));
      if (d > portata) continue;
      echi.push({
        rilevamento: Math.round(normalizza360(rilevamento(b, e) + (r.sigma_rilevamento ?? 1) * this.rng.gaussiana()) * 10) / 10,
        distanza: Math.max(1, Math.round(d * (1 + ((r.sigma_distanza ?? 1) / 100) * this.rng.gaussiana()))),
      });
      if (e.tipo === 'sottomarino') alberi.push({ id: e.id, distanza: d });
    }
    echi.sort((x, y) => x.rilevamento - y.rilevamento);
    return { echi, alberi };
  }
}
