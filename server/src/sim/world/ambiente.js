// @ts-check
/**
 * L'ambiente come lo vede il motore: fondale, strato, rumore del mare,
 * assorbimento. Un'interfaccia sola, due fornitori:
 *
 *  - `shared/ambiente.js` (batimetria e oceanografia per scenario): se esiste,
 *    `caricaAmbiente(id)` da' un oggetto con `fondale(x, y)`, `strato(x, y)`,
 *    `rumoreAmbiente(f)` e `assorbimento(f)`, e lo si usa;
 *  - altrimenti il **provvisorio** qui sotto: fondale piatto di 1000 m, uno
 *    strato a 60 m, mare forza 3, acqua del Mar di Norvegia. Stessa forma, cosi'
 *    il resto del motore non sa chi gli risponde.
 *
 * Le formule del provvisorio sono quelle raccomandate dalla ricerca
 * (docs/ricerca/05_acustica.md): rumore di Coates (§3.2) e assorbimento di
 * Ainslie & McColm (§2.2). Quando arriva shared/ambiente.js, le sue funzioni
 * hanno la precedenza voce per voce: cio' che non esporta resta provvisorio.
 */

import { access } from 'node:fs/promises';

/**
 * @typedef {object} Strato
 * @property {number} quota  m: profondita' dello strato (base dello strato superficiale)
 * @property {number | null} perdita  dB attraverso lo strato, o null per il valore di acustica.json
 */

/**
 * @typedef {object} Ambiente
 * @property {string} fonte  'shared/ambiente.js' o 'provvisorio'
 * @property {(x: number, y: number) => number} profondita  m d'acqua (positiva) nel punto
 * @property {(x: number, y: number) => Strato | null} strato
 * @property {(f: number) => number} rumore  livello spettrale del rumore ambiente, dB re 1 µPa²/Hz, a f Hz
 * @property {(f: number) => number} assorbimento  dB/km a f Hz
 */

/**
 * Rumore ambiente di Coates (attivita' navale s in [0,1], vento w in m/s),
 * f in Hz → dB re 1 µPa²/Hz. [STOJ06 eq. 6], 05_acustica.md §3.2.
 * @param {number} f Hz
 * @param {number} s
 * @param {number} w m/s
 */
export function rumoreCoates(f, s, w) {
  const fk = f / 1000;
  const l = Math.log10;
  const turb = 17 - 30 * l(fk);
  const navi = 40 + 20 * (s - 0.5) + 26 * l(fk) - 60 * l(fk + 0.03);
  const vento = 50 + 7.5 * Math.sqrt(w) + 20 * l(fk) - 40 * l(fk + 0.4);
  const term = -15 + 20 * l(fk);
  return 10 * l(10 ** (turb / 10) + 10 ** (navi / 10) + 10 ** (vento / 10) + 10 ** (term / 10));
}

/**
 * Assorbimento di Ainslie & McColm (1998), dB/km. [NPL-ABS], 05_acustica.md §2.2.
 * @param {number} f Hz
 * @param {number} t °C
 * @param {number} s psu
 * @param {number} ph
 * @param {number} zKm profondita', km
 */
export function assorbimentoAinslieMcColm(f, t, s, ph, zKm) {
  const fk = f / 1000;
  const f1 = 0.78 * Math.sqrt(s / 35) * Math.exp(t / 26);
  const f2 = 42 * Math.exp(t / 17);
  const f2q = fk * fk;
  return 0.106 * f1 * f2q / (f2q + f1 * f1) * Math.exp((ph - 8) / 0.56)
    + 0.52 * (1 + t / 43) * (s / 35) * f2 * f2q / (f2q + f2 * f2) * Math.exp(-zKm / 6)
    + 0.00049 * f2q * Math.exp(-(t / 27 + zKm / 17));
}

/** Vento per stato del mare (scala nozionale di 05_acustica.md §3.4), m/s. */
const VENTO_STATO_MARE = [0.5, 2.5, 4.5, 6.5, 9, 12, 15.5];

/**
 * @typedef {object} OpzioniProvvisorio
 * @property {number} [fondale]  m (predefinito 1000)
 * @property {number | null} [strato]  m (predefinito 60; null = nessuno strato)
 * @property {number | null} [perditaStrato]  dB (null = valore di acustica.json)
 * @property {number} [statoMare]  0-6 (predefinito 3)
 * @property {number} [traffico]  0-1 (predefinito 0,5)
 * @property {number} [temperatura]  in gradi Celsius (predefinito 6: Mar di Norvegia)
 * @property {number} [salinita]  psu (35)
 * @property {number} [ph]  (8)
 */

/**
 * L'ambiente provvisorio: piatto, uniforme, uguale ovunque.
 * @param {OpzioniProvvisorio} [o]
 * @returns {Ambiente}
 */
export function ambienteProvvisorio(o = {}) {
  const fondale = o.fondale ?? 1000;
  const quotaStrato = o.strato === undefined ? 60 : o.strato;
  const perditaStrato = o.perditaStrato ?? null;
  const vento = VENTO_STATO_MARE[Math.max(0, Math.min(6, Math.round(o.statoMare ?? 3)))];
  const traffico = o.traffico ?? 0.5;
  const t = o.temperatura ?? 6;
  const s = o.salinita ?? 35;
  const ph = o.ph ?? 8;
  /** @type {Map<number, number>} */ const cacheRumore = new Map();
  /** @type {Map<number, number>} */ const cacheAss = new Map();
  /** @type {Strato | null} */
  const strato = quotaStrato === null ? null : { quota: quotaStrato, perdita: perditaStrato };
  return {
    fonte: 'provvisorio',
    profondita: () => fondale,
    strato: () => strato,
    rumore: (f) => {
      let v = cacheRumore.get(f);
      if (v === undefined) { v = rumoreCoates(f, traffico, vento); cacheRumore.set(f, v); }
      return v;
    },
    assorbimento: (f) => {
      let v = cacheAss.get(f);
      if (v === undefined) { v = assorbimentoAinslieMcColm(f, t, s, ph, 0); cacheAss.set(f, v); }
      return v;
    },
  };
}

/**
 * Crea l'ambiente di uno scenario: shared/ambiente.js se c'e', altrimenti il
 * provvisorio. Non lancia: un modulo d'ambiente rotto non deve impedire di
 * giocare (lo si dice nel registro).
 *
 * @param {{id: string, ambiente?: OpzioniProvvisorio}} scenario
 * @param {{warn: (e: string, d?: Record<string, unknown>) => void}} [registro]
 * @returns {Promise<Ambiente>}
 */
export async function creaAmbiente(scenario, registro) {
  const provvisorio = ambienteProvvisorio(scenario.ambiente ?? {});
  const url = new URL('../../../../shared/ambiente.js', import.meta.url);
  try {
    await access(url);
  } catch {
    return provvisorio;
  }
  try {
    /** @type {any} */
    const mod = await import(url.href);
    return adattaModulo(mod, scenario, provvisorio);
  } catch (e) {
    registro?.warn('ambiente_non_caricato', { errore: /** @type {Error} */ (e).message });
    return provvisorio;
  }
}

/**
 * Adatta il modulo shared/ambiente.js all'interfaccia del motore, funzione per
 * funzione: si usa cio' che esporta, il resto resta provvisorio.
 * @param {any} mod
 * @param {{id: string}} scenario
 * @param {Ambiente} provvisorio
 * @returns {Promise<Ambiente>}
 */
async function adattaModulo(mod, scenario, provvisorio) {
  // Se il modulo prepara l'ambiente di uno scenario (carica la griglia), lo si chiama.
  /** @type {any} */
  let amb = mod;
  if (typeof mod.caricaAmbiente === 'function') amb = await mod.caricaAmbiente(scenario.id);
  else if (typeof mod.creaAmbiente === 'function') amb = await mod.creaAmbiente(scenario.id);
  const chiama = (/** @type {string} */ nome) => (typeof amb?.[nome] === 'function' ? amb[nome].bind(amb) : null);
  const fondale = chiama('fondale');
  const strato = chiama('strato');
  const rumore = chiama('rumoreAmbiente') ?? chiama('rumore');
  const assorbimento = chiama('assorbimento');
  // Fuori dalla griglia (NaN) vale il fondale massimo dello scenario; sulla
  // terra (fondale <= 0) un metro: il battello e' in secca e il suono che
  // passa sopra la terra paga le perdite delle acque bassissime.
  const fuoriGriglia = Number(amb?.valori?.batimetria?.fondale_massimo) || provvisorio.profondita(0, 0);
  return {
    fonte: fondale ? 'shared/ambiente.js' : 'provvisorio',
    profondita: fondale
      ? (x, y) => {
        const d = Number(fondale(x, y));
        if (Number.isNaN(d)) return fuoriGriglia;
        return d > 1 ? d : 1;
      }
      : provvisorio.profondita,
    strato: strato
      ? (x, y) => {
        const s = strato(x, y);
        if (s === null || s === undefined) return null;
        if (typeof s === 'number') return { quota: s, perdita: null };
        return { quota: Number(s.quota ?? s.profondita), perdita: s.perdita ?? null };
      }
      : provvisorio.strato,
    rumore: rumore ? (f) => Number(rumore(f)) : provvisorio.rumore,
    assorbimento: assorbimento ? (f) => Number(assorbimento(f)) : provvisorio.assorbimento,
  };
}
