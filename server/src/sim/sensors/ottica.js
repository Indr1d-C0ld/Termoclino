// @ts-check
/**
 * Il periscopio (F2): cosa si vede, con quale errore, e chi vede il proprio
 * periscopio. Costanti in shared/data/sensori.json (ottica), dati di
 * piattaforma (sensori.periscopio) e di firma (ottica: altezza d'albero,
 * bordo libero, famiglia di sagome, luci).
 *
 * Una nave e' in vista se la sua testa d'albero sta sopra l'orizzonte
 * dell'occhio, d ≤ 3,86·(√h_occhio + √h_albero) km ([WP-ORIZZONTE]), e dentro la
 * portata ottica: di giorno la visibilita' (ridotta dallo stato del mare), di
 * notte la sagoma solo da vicino e, piu' lontano, le luci di navigazione della
 * regola 22 ([COLREG-22]) secondo l'angolo da cui si guarda. Per ogni oggetto:
 *
 *  - rilevamento misurato (σ della piattaforma);
 *  - angolo sulla prua stimato (σ della piattaforma), positivo se si vede il
 *    fianco di dritta;
 *  - sagoma: famiglia della classe + indice 0-4 dall'angolo sulla prua VERO
 *    (e' cio' che l'occhio vede: 0 di prua, 2 al traverso, 4 di poppa);
 *  - elevazione della testa d'albero sulla linea d'acqua, misurata con l'errore
 *    relativo dell'osservatore: atan((H − h)/R) + atan(h/R) in geometria piana,
 *    cosi' che lo stadimetro (R = H / tan α, [NSL10]) con la classe giusta dia
 *    l'errore dell'osservatore e nient'altro (±7 % a due sigma). Se la linea
 *    d'acqua e' sotto l'orizzonte dell'occhio lo stadimetro non si usa (null).
 *
 * Gli alberi alzati degli altri battelli si vedono da vicino (di piu' col
 * pennacchio, oltre la velocita' di scia): oggetti senza sagoma. Il «numero di
 * vista» e' locale all'osservatore e vale finche' l'oggetto resta in vista.
 */

import { normalizza180, normalizza360 } from '../../../../shared/units.js';
import { rilevamento } from '../../../../shared/geo.js';

/** @typedef {import('./acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../platform/battello.js').Battello} Battello */
/** @typedef {import('../../ai/navi.js').Nave} Nave */
/** @typedef {import('../../../../shared/rng.js').Generatore} Generatore */
/** @typedef {import('../../../../shared/protocol.js').OggettoVisivo} OggettoVisivo */

/**
 * Lo stato ottico di un osservatore (numeri di vista).
 */
export class Periscopio {
  /**
   * @param {Battello} b
   * @param {Generatore} rng
   */
  constructor(b, rng) {
    this.b = b;
    this.rng = rng;
    /** @type {Map<string, number>} id dell'entita' → numero di vista (solo sul server) */
    this.viste = new Map();
    this.prossima = 1;
    this.sciaRiferita = false;
  }

  /**
   * Il fattore dello stato del mare sulla portata ottica.
   * @param {ValoriAcustica} ac
   * @param {number} statoMare
   */
  static fattoreMare(ac, statoMare) {
    const o = ac.ottica;
    return Math.max(0.2, 1 - o.riduzione_stato_mare * Math.max(0, statoMare - o.stato_mare_limpido));
  }

  /**
   * Cosa si vede adesso. `nuovi` sono gli oggetti appena entrati in vista,
   * per il rapporto e il diario.
   * @param {object} a
   * @param {Iterable<{id: string, tipo: string, x: number, y: number, rotta: number, velocita: number}>} a.entita
   * @param {ValoriAcustica} a.ac
   * @param {boolean} a.notte
   * @param {number} a.statoMare
   * @returns {{oggetti: OggettoVisivo[], nuovi: {id: string, oggetto: OggettoVisivo, distanza: number, albero: boolean}[]}}
   */
  guarda(a) {
    const b = this.b;
    const { ac, notte } = a;
    const o = ac.ottica;
    const per = b.p.sensori.periscopio;
    const hOcchio = per.altezza_occhio ?? 2;
    const mare = Periscopio.fattoreMare(ac, a.statoMare);
    const orizzonte = (/** @type {number} */ h) => o.orizzonte * 1000 * Math.sqrt(Math.max(0, h));
    /** @type {OggettoVisivo[]} */
    const oggetti = [];
    /** @type {{id: string, oggetto: OggettoVisivo, distanza: number, albero: boolean}[]} */
    const nuovi = [];
    /** @type {Set<string>} */
    const visti = new Set();

    for (const e of a.entita) {
      if (e === /** @type {unknown} */ (b)) continue;
      const R = Math.max(1, Math.hypot(e.x - b.x, e.y - b.y));
      const theta = rilevamento(b, e);
      if (e.tipo === 'nave') {
        const n = /** @type {Nave} */ (/** @type {unknown} */ (e));
        const ot = n.firma?.ottica;
        if (!ot) continue;
        const H = ot.altezza_alberi;
        const sopraOrizzonte = R <= orizzonte(hOcchio) + orizzonte(H);
        if (!sopraOrizzonte) continue;
        const sagomaVisibile = R <= (notte ? o.visibilita_notte : o.visibilita_giorno) * mare;
        // Angolo sulla prua vero: dal bersaglio verso l'osservatore, rispetto alla sua prua.
        const aob = normalizza180(rilevamento(e, b) - e.rotta);
        /** @type {OggettoVisivo['luci']} */
        let luci = null;
        if (notte && ot.luci) {
          /** @type {NonNullable<OggettoVisivo['luci']>} */
          const l = [];
          const abs = Math.abs(aob);
          if (abs <= 112.5 && R <= o.luce_testa_albero * mare) l.push('testa_d_albero');
          if (aob > 0 && aob <= 112.5 && R <= o.luce_fianco * mare) l.push('fianco_dritta');
          if (aob < 0 && aob >= -112.5 && R <= o.luce_fianco * mare) l.push('fianco_sinistra');
          if (abs >= 112.5 && R <= o.luce_coronamento * mare) l.push('coronamento');
          luci = l;
        }
        if (!sagomaVisibile && !(luci && luci.length > 0)) continue;
        const sottoOrizzonte = R > orizzonte(hOcchio);
        let elevazione = null;
        if (sagomaVisibile && !sottoOrizzonte) {
          const vera = (Math.atan((H - hOcchio) / R) + Math.atan(hOcchio / R)) * 180 / Math.PI;
          const sigma = (per.errore_elevazione ?? 3.5) / 100;
          elevazione = Math.round(vera * (1 + sigma * this.rng.gaussiana()) * 1000) / 1000;
        }
        const indice = Math.abs(aob) < 22.5 ? 0 : Math.abs(aob) < 67.5 ? 1 : Math.abs(aob) < 112.5 ? 2 : Math.abs(aob) < 157.5 ? 3 : 4;
        /** @type {OggettoVisivo} */
        const ogg = {
          vista: 0,
          rilevamento: Math.round(normalizza360(theta + (per.sigma_rilevamento ?? 0.3) * this.rng.gaussiana()) * 10) / 10,
          aspetto: Math.max(-180, Math.min(180, Math.round(normalizza180(aob + (per.sigma_aspetto ?? 10) * this.rng.gaussiana())))),
          sagoma: sagomaVisibile ? `${ot.sagoma}${indice}` : null,
          elevazione_alberi: elevazione,
          luci,
          sotto_orizzonte: sottoOrizzonte,
          scia: Math.abs(n.velocita) > o.velocita_onda_prua,
        };
        this._numera(e.id, ogg, R, false, visti, nuovi);
        oggetti.push(ogg);
      } else if (e.tipo === 'sottomarino') {
        const s = /** @type {Battello} */ (/** @type {unknown} */ (e));
        if (!(s.alberi.periscopio || s.alberi.esm || s.alberi.radar)) continue;
        const scia = Math.abs(s.velocita) > (s.p.sensori.periscopio.velocita_scia ?? 10);
        const portata = (notte ? o.albero_notte : o.albero_giorno) * mare * (scia ? o.fattore_scia : 1);
        if (R > portata) continue;
        /** @type {OggettoVisivo} */
        const ogg = {
          vista: 0,
          rilevamento: Math.round(normalizza360(theta + (per.sigma_rilevamento ?? 0.3) * this.rng.gaussiana()) * 10) / 10,
          aspetto: null, sagoma: null, elevazione_alberi: null, luci: null, sotto_orizzonte: false, scia,
        };
        this._numera(e.id, ogg, R, true, visti, nuovi);
        oggetti.push(ogg);
      }
    }
    for (const id of [...this.viste.keys()]) if (!visti.has(id)) this.viste.delete(id);
    oggetti.sort((x, y) => x.vista - y.vista);
    return { oggetti, nuovi };
  }

  /**
   * @param {string} id
   * @param {OggettoVisivo} ogg
   * @param {number} R
   * @param {boolean} albero
   * @param {Set<string>} visti
   * @param {{id: string, oggetto: OggettoVisivo, distanza: number, albero: boolean}[]} nuovi
   */
  _numera(id, ogg, R, albero, visti, nuovi) {
    visti.add(id);
    let v = this.viste.get(id);
    if (v === undefined) {
      v = this.prossima++;
      this.viste.set(id, v);
      nuovi.push({ id, oggetto: ogg, distanza: R, albero });
    }
    ogg.vista = v;
  }

  /** Il periscopio e' alzato oltre la velocita' di scia. */
  get scia() {
    const b = this.b;
    return b.alberi.periscopio && Math.abs(b.velocita) > (b.p.sensori.periscopio.velocita_scia ?? 10);
  }
}
