// @ts-check
/**
 * L'arbitro: chi c'era davvero dietro una traccia dell'equipaggio. Serve SOLO
 * al diario (la verita' delle statistiche: distanza vera di una scoperta,
 * errore vero di una soluzione, classificazione corretta o no) e al livello
 * di assistenza 3 (la lettera esatta, solo per i contatti non umani). Non
 * entra mai nelle decisioni dell'equipaggio e niente di cio' che calcola va
 * ai client, salvo la soluzione esatta del livello 3 per i contatti non umani.
 *
 * Come decide: per il sensore e il rilevamento misurato della traccia sceglie
 * la sorgente che ha fatto il picco. Prima guarda i `contributi` dei
 * fotogrammi di quel secondo (la verita' che i sensori lasciano sul server:
 * chi ha messo energia dove, con il rilevamento misurato e l'eccesso con la
 * fluttuazione, banda larga o stretta): vince il contributo piu' forte nel
 * fascio puntato sul rilevamento (eccesso piu' guadagno del fascio allo
 * scarto), se arriva almeno a −6 dB. Se nei fotogrammi non c'e' niente (la
 * traccia non e' stata sentita in quel secondo), ripiega sull'equazione del
 * sonar (`eccesso`, senza fluttuazione) fra le entita' entro due fasci (almeno
 * 6°). Se non c'e' nessuna candidata la traccia e' un falso contatto
 * (sorgente null).
 */

import { Battello } from '../sim/platform/battello.js';
import { guadagnoFascio } from '../sim/sensors/acustica.js';
import { rilevamento as rilevamentoDa } from '../../../shared/geo.js';
import { normalizza180 } from '../../../shared/units.js';

/** @typedef {import('./partita.js').Partita} Partita */
/** @typedef {import('./partita.js').Giocatore} Giocatore */
/** @typedef {import('./partita.js').Entita} Entita */
/** @typedef {import('../sim/crew/tracce.js').Traccia} Traccia */

/**
 * La classe della biblioteca (CLASSI di shared/protocol.js) di un'entita'.
 * @param {Entita} e
 * @returns {string | null}
 */
export function classeVera(e) {
  const x = /** @type {any} */ (e);
  if (typeof x.classeBiblioteca === 'string') return x.classeBiblioteca;
  if (e instanceof Battello) return /** @type {any} */ (e.p).id ?? (e.p.identita?.lato === 'urss' ? 'alfa' : '688');
  if (e.tipo === 'biologico') return 'biologico';
  if (x.classe === 'cacciatorpediniere') return 'forrest_sherman';
  if (x.classe === 'mercantile') return 'mercantile_generico';
  return null;
}

/**
 * @typedef {object} Attribuzione
 * @property {string | null} sorgente  id interno; null = falso contatto
 * @property {Entita | null} entita
 * @property {number | null} distanza  m, dal battello che osserva
 * @property {number | null} se  eccesso medio vero (dB) sul sensore, banda larga
 * @property {number | null} rilevamento  rilevamento vero dal sensore
 * @property {boolean} umano  la sorgente e' il battello di un giocatore
 */

const NESSUNA = Object.freeze(/** @type {Attribuzione} */ ({
  sorgente: null, entita: null, distanza: null, se: null, rilevamento: null, umano: false,
}));

export class Arbitro {
  /** @param {Partita} partita */
  constructor(partita) {
    this.p = partita;
    /** @type {Map<string, {id: string | null, ora: number}>} ultima attribuzione per osservatore e contatto */
    this.memoria = new Map();
  }

  /**
   * La sorgente vera di un rilevamento misurato da un sensore di un giocatore.
   * @param {Giocatore} g
   * @param {'sfera' | 'towed'} sensore
   * @param {number[]} rilevamenti  il misurato (e, per l'antenna ambigua, lo speculare)
   * @param {string | null} [preferita]  la sorgente attribuita prima: a parita' (3 dB) resta
   * @param {import('../sim/sensors/passivo.js').Fotogramma[]} [fotogrammi]  quelli di questo secondo
   *   per il sensore (banda larga e stretta)
   * @returns {Attribuzione}
   */
  attribuisci(g, sensore, rilevamenti, preferita = null, fotogrammi = []) {
    const daiFotogrammi = this._daiContributi(g, sensore, rilevamenti, preferita, fotogrammi);
    if (daiFotogrammi) return daiFotogrammi;
    let s = g.sensori[sensore];
    let geom = s ? s.geometria(this.p.amb) : null;
    // Antenna non in acqua: si guarda con la sfera (stesso battello).
    if (!s || !geom) { s = g.sensori.sfera; geom = s.geometria(this.p.amb); }
    if (!geom) return NESSUNA;
    const finestra = Math.max(6, 2 * s.fascio);
    let migliore = null;
    let punti = -Infinity;
    let puntiPreferita = -Infinity;
    for (const e of this.p._ordinate) {
      if (e === g.battello) continue;
      const theta = rilevamentoDa(geom.pos, e.posizioneAcustica());
      const scarto = Math.min(...rilevamenti.map((r) => Math.abs(normalizza180(r - theta))));
      if (scarto > finestra) continue;
      const ecc = /** @type {any} */ (s).eccesso(e, this.p.amb, geom);
      const se = ecc ? ecc.se : -60;
      const p = se + guadagnoFascio(scarto, s.fascio, -30);
      if (e.id === preferita) puntiPreferita = p;
      if (p > punti) { punti = p; migliore = { e, se, theta }; }
    }
    if (!migliore) return NESSUNA;
    if (preferita !== null && puntiPreferita > punti - 3) {
      const e = /** @type {Entita} */ (this.p.entita.get(preferita));
      if (e) {
        const theta = rilevamentoDa(geom.pos, e.posizioneAcustica());
        const ecc = /** @type {any} */ (s).eccesso(e, this.p.amb, geom);
        migliore = { e, se: ecc ? ecc.se : -60, theta };
      }
    }
    const e = migliore.e;
    return {
      sorgente: e.id,
      entita: e,
      distanza: Math.hypot(e.x - g.battello.x, e.y - g.battello.y),
      se: migliore.se,
      rilevamento: migliore.theta,
      umano: this.umano(e),
    };
  }

  /**
   * L'attribuzione dai contributi dei fotogrammi (null se nessuno spiega il picco).
   * @param {Giocatore} g @param {'sfera' | 'towed'} sensore @param {number[]} rilevamenti
   * @param {string | null} preferita
   * @param {import('../sim/sensors/passivo.js').Fotogramma[]} fotogrammi
   * @returns {Attribuzione | null}
   */
  _daiContributi(g, sensore, rilevamenti, preferita, fotogrammi) {
    const fascio = g.sensori[sensore]?.fascio ?? 10;
    const finestra = Math.max(6, 2 * fascio);
    /** @type {{id: string, se: number, punti: number} | null} */
    let migliore = null;
    let puntiPreferita = -Infinity;
    for (const f of fotogrammi) {
      for (const c of f.contributi ?? []) {
        const visti = f.asse === undefined ? [c.rilevamento] : [c.rilevamento, 2 * f.asse - c.rilevamento];
        let scarto = Infinity;
        for (const r of rilevamenti) for (const v of visti) scarto = Math.min(scarto, Math.abs(normalizza180(r - v)));
        if (scarto > finestra) continue;
        const punti = c.se + guadagnoFascio(scarto, fascio, -30);
        if (c.sorgente === preferita) puntiPreferita = Math.max(puntiPreferita, punti);
        if (!migliore || punti > migliore.punti) migliore = { id: c.sorgente, se: c.se_medio, punti };
      }
    }
    if (!migliore || migliore.punti < -6) return null;
    let id = migliore.id;
    if (preferita !== null && puntiPreferita > migliore.punti - 3) id = preferita;
    const e = this.p.entita.get(id);
    if (!e) return null;
    const s = g.sensori[sensore];
    const geom = s?.geometria(this.p.amb) ?? g.sensori.sfera.geometria(this.p.amb);
    return {
      sorgente: id,
      entita: e,
      distanza: Math.hypot(e.x - g.battello.x, e.y - g.battello.y),
      se: id === migliore.id ? migliore.se : null,
      rilevamento: geom ? rilevamentoDa(geom.pos, e.posizioneAcustica()) : null,
      umano: this.umano(e),
    };
  }

  /**
   * La sorgente di una traccia adesso (con memoria: un'attribuzione cambia
   * solo se un'altra entita' spiega il picco meglio di 3 dB).
   * @param {Giocatore} g
   * @param {Traccia} t
   * @param {number} ora
   * @param {Record<string, import('../sim/sensors/passivo.js').Fotogramma[]>} [fotogrammi]  di questo secondo, per sensore
   * @returns {Attribuzione}
   */
  traccia(g, t, ora, fotogrammi = {}) {
    const chiave = `${g.battello.id}:${t.contatto}`;
    const m = this.memoria.get(chiave);
    // il sensore con la misura piu' recente, e il rilevamento del suo filtro
    const f0 = t.ipotesi[0].filtri;
    const sensore = /** @type {'sfera' | 'towed'} */ (f0.towed.ultima > f0.sfera.ultima ? 'towed' : 'sfera');
    /** @type {number[]} */
    const rilevamenti = [];
    for (const h of t.ipotesi) {
      const f = h.filtri[sensore];
      const p = f.predici(Math.min(ora, f.ultima));
      if (p) rilevamenti.push(p.rilevamento);
    }
    if (!rilevamenti.length) return NESSUNA;
    const a = this.attribuisci(g, sensore, rilevamenti, m?.id ?? null, fotogrammi[sensore] ?? []);
    this.memoria.set(chiave, { id: a.sorgente, ora });
    return a;
  }

  /**
   * L'entita' e' il battello di un giocatore umano?
   * @param {Entita} e
   */
  umano(e) {
    if (!(e instanceof Battello)) return false;
    for (const g of this.p.giocatori.values()) if (g.battello === e) return true;
    return false;
  }
}
