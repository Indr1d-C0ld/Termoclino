// @ts-check
/**
 * L'equipaggio di F1: il sonarista che forma i contatti guardando i
 * fotogrammi, e gli avvisi di chi sta in camera di manovra.
 *
 * NEBBIA DI GUERRA. Il sonarista non sa nulla della verita': lavora solo sui
 * byte dei fotogrammi che riceve anche il giocatore (picchi sopra la soglia,
 * associati per vicinanza di rilevamento). Per questo i rilevamenti dei
 * rapporti vengono dalle misure, e le designazioni (S1, S2…) sono sue: un
 * contatto perso e ritrovato altrove e' un contatto nuovo, due bersagli vicini
 * sotto lo stesso fascio sono un contatto solo.
 */

import { differenzaAngolare, normalizza180, normalizza360 } from '../../../../shared/units.js';
import { SONAR, centroSettore, dequantizzaSE } from '../../../../shared/protocol.js';

/** @typedef {import('../platform/battello.js').Battello} Battello */
/** @typedef {import('../platform/battello.js').Rapporto} Rapporto */
/** @typedef {import('../sensors/passivo.js').Fotogramma} Fotogramma */
/** @typedef {import('../world/ambiente.js').Ambiente} Ambiente */

/** Fotogrammi considerati per confermare un contatto, e quanti devono avere il picco. */
const FINESTRA = 8;
const CONFERMA = 5;
/** Secondi senza picco dopo cui un contatto confermato e' perso. */
const PERDITA = 60;
/** Prominenza minima di un picco sui settori a ±mezzo fascio, dB. */
const PROMINENZA = 3;

/**
 * @typedef {object} Traccia
 * @property {string | null} designazione
 * @property {number} rilevamento  stima (media mobile delle misure), gradi veri
 * @property {number} colpi  bit dei fotogrammi recenti con un picco associato
 * @property {number} ultimo  numero dell'ultimo fotogramma con picco
 */

/**
 * Trova i picchi di un fotogramma: massimi locali sopra la soglia (SE ≥ 0)
 * piu' alti di almeno PROMINENZA dB dei settori a mezzo fascio di distanza,
 * con il rilevamento raffinato per interpolazione parabolica.
 * @param {Uint8Array} settori
 * @param {number} fascio gradi
 * @returns {number[]} rilevamenti veri
 */
export function trovaPicchi(settori, fascio) {
  const n = SONAR.SETTORI;
  const m = Math.max(1, Math.ceil(fascio / 2 / SONAR.AMPIEZZA_SETTORE) + 1);
  /** @type {number[]} */
  const picchi = [];
  const v = (/** @type {number} */ k) => dequantizzaSE(settori[((k % n) + n) % n]);
  for (let k = 0; k < n; k++) {
    const c = v(k);
    if (c < 0) continue;
    const s = v(k - 1);
    const d = v(k + 1);
    if (!(c > s && c >= d)) continue;
    if (c - Math.max(v(k - m), v(k + m)) < PROMINENZA) continue;
    const den = s - 2 * c + d;
    const delta = den < 0 ? 0.5 * (s - d) / den : 0;
    picchi.push(normalizza360(centroSettore(k) + delta * SONAR.AMPIEZZA_SETTORE));
  }
  return picchi;
}

/**
 * Il tracciatore di un sensore.
 */
export class Tracciatore {
  /**
   * @param {'sfera' | 'towed'} sensore
   * @param {number} fascio gradi
   * @param {() => string} designa
   */
  constructor(sensore, fascio, designa) {
    this.sensore = sensore;
    this.fascio = fascio;
    this.designa = designa;
    this.porta = Math.max(1.5 * fascio, 4);
    /** @type {Traccia[]} */
    this.tracce = [];
    this.n = 0;
  }

  /**
   * @param {Fotogramma} f
   * @returns {Rapporto[]}
   */
  aggiorna(f) {
    /** @type {Rapporto[]} */
    const out = [];
    if (f.sorda) return out;
    this.n++;
    let picchi = trovaPicchi(f.settori, this.fascio);
    const asse = f.asse ?? 0;
    if (this.sensore === 'towed') {
      // L'antenna da' ogni contatto due volte: si tiene solo il lato di dritta
      // dell'asse, e lo speculare va nel rapporto.
      picchi = picchi.filter((p) => normalizza180(p - asse) > 0);
    }
    const usati = new Set();
    const ordinate = [...this.tracce].sort((a, b) => Number(b.designazione !== null) - Number(a.designazione !== null));
    for (const t of ordinate) {
      let migliore = -1;
      let distanza = this.porta;
      picchi.forEach((p, i) => {
        if (usati.has(i)) return;
        const d = Math.abs(differenzaAngolare(t.rilevamento, p));
        if (d <= distanza) { distanza = d; migliore = i; }
      });
      t.colpi = (t.colpi << 1) & ((1 << FINESTRA) - 1);
      if (migliore >= 0) {
        usati.add(migliore);
        t.rilevamento = normalizza360(t.rilevamento + 0.3 * differenzaAngolare(t.rilevamento, picchi[migliore]));
        t.colpi |= 1;
        t.ultimo = this.n;
      }
    }
    picchi.forEach((p, i) => {
      if (!usati.has(i)) this.tracce.push({ designazione: null, rilevamento: p, colpi: 1, ultimo: this.n });
    });
    /** @type {Traccia[]} */
    const restano = [];
    for (const t of this.tracce) {
      if (t.designazione === null) {
        if (contaBit(t.colpi) >= CONFERMA) {
          t.designazione = this.designa();
          out.push({
            chi: 'sonar',
            chiave: 'sonar.nuovo_contatto',
            parametri: {
              contatto: t.designazione,
              sensore: this.sensore,
              rilevamento: Math.round(t.rilevamento) % 360,
              speculare: this.sensore === 'towed' ? Math.round(normalizza360(2 * asse - t.rilevamento)) % 360 : null,
            },
          });
          restano.push(t);
        } else if (this.n - t.ultimo < FINESTRA) {
          restano.push(t);
        }
      } else if (this.n - t.ultimo >= PERDITA) {
        out.push({ chi: 'sonar', chiave: 'sonar.contatto_perso', parametri: { contatto: t.designazione, sensore: this.sensore } });
      } else {
        restano.push(t);
      }
    }
    this.tracce = restano;
    return out;
  }
}

/** @param {number} x */
function contaBit(x) {
  let c = 0;
  for (let v = x; v; v &= v - 1) c++;
  return c;
}

/**
 * L'equipaggio di un battello.
 */
export class Equipaggio {
  /**
   * @param {Battello} battello
   * @param {{sfera: number, towed: number}} fasci  larghezze dei fasci dei sensori, gradi
   */
  constructor(battello, fasci) {
    this.b = battello;
    let numero = 0;
    const designa = () => `S${++numero}`;
    this.tracciatori = {
      sfera: new Tracciatore('sfera', fasci.sfera, designa),
      towed: new Tracciatore('towed', fasci.towed, designa),
    };
    /** @type {Set<string>} avvisi in corso */
    this.attivi = new Set();
    this.cavitazioneDa = 0;
    this.cavitazioneRiferita = false;
    /** @type {number | null} */ this.rottaSeguita = null;
    this.rottaInAttesa = false;
    /** @type {number | null} */ this.quotaSeguita = null;
    this.quotaInAttesa = false;
    this.fondaleAvantiLibero = 0;
  }

  /** Gli avvisi in corso, per `stato.avvisi`. */
  avvisi() {
    return [...this.attivi].sort();
  }

  /**
   * Un secondo di lavoro dell'equipaggio.
   * @param {{sfera: Fotogramma | null, towed: Fotogramma | null}} fotogrammi
   * @param {Ambiente} amb
   * @returns {Rapporto[]}
   */
  ogniSecondo(fotogrammi, amb) {
    /** @type {Rapporto[]} */
    const out = this.b.rapporti.splice(0);
    if (fotogrammi.sfera) out.push(...this.tracciatori.sfera.aggiorna(fotogrammi.sfera));
    if (fotogrammi.towed) out.push(...this.tracciatori.towed.aggiorna(fotogrammi.towed));
    this._avvisi(out, amb);
    this._timoniere(out);
    return out;
  }

  /**
   * Accende o spegne un avviso; riferisce quando si accende.
   * @param {Rapporto[]} out
   * @param {string} avviso
   * @param {boolean} acceso
   * @param {Rapporto | null} rapporto
   */
  _avviso(out, avviso, acceso, rapporto) {
    if (acceso && !this.attivi.has(avviso)) {
      this.attivi.add(avviso);
      if (rapporto) out.push(rapporto);
    } else if (!acceso) {
      this.attivi.delete(avviso);
    }
  }

  /**
   * @param {Rapporto[]} out
   * @param {Ambiente} amb
   */
  _avvisi(out, amb) {
    const b = this.b;
    const prof = b.p.profondita;
    const v = Math.abs(b.velocita);

    // Cavitazione, con tre secondi di conferma per non sfarfallare.
    if (b.cavitante !== this.cavitazioneRiferita) {
      if (++this.cavitazioneDa >= 3) {
        this.cavitazioneRiferita = b.cavitante;
        this.cavitazioneDa = 0;
        out.push({
          chi: 'macchina',
          chiave: b.cavitante ? 'macchina.cavitazione' : 'macchina.fine_cavitazione',
          parametri: { v_cavitazione: Math.round(b.vCavitazione * 10) / 10 },
        });
      }
    } else {
      this.cavitazioneDa = 0;
    }
    if (this.cavitazioneRiferita) this.attivi.add('cavitazione'); else this.attivi.delete('cavitazione');

    // Quote.
    const vicina = this.attivi.has('quota_collaudo_vicina') ? b.z > 0.85 * prof.collaudo : b.z > 0.9 * prof.collaudo;
    this._avviso(out, 'quota_collaudo_vicina', vicina && b.z <= prof.collaudo,
      { chi: 'guardia', chiave: 'guardia.quota_collaudo_vicina', parametri: { quota: Math.round(b.z), collaudo: prof.collaudo } });
    const oltre = this.attivi.has('oltre_quota_collaudo') ? b.z > 0.97 * prof.collaudo : b.z > prof.collaudo;
    this._avviso(out, 'oltre_quota_collaudo', oltre,
      { chi: 'guardia', chiave: 'guardia.oltre_quota_collaudo', parametri: { quota: Math.round(b.z), collaudo: prof.collaudo } });
    if (oltre) this.attivi.delete('quota_collaudo_vicina');
    this._avviso(out, 'collasso', b.z > prof.collasso, null);

    // Fondale sotto la chiglia.
    const sotto = b.profonditaAcqua - b.z;
    const vicino = this.attivi.has('fondale_vicino') ? sotto < 45 : sotto < 30;
    this._avviso(out, 'fondale_vicino', vicino && !b.inSuperficie,
      { chi: 'navigazione', chiave: 'navigazione.fondale_vicino', parametri: { sotto_chiglia: Math.round(sotto) } });

    // Fondale che sale sulla rotta (l'autopilota non lo guarda, il navigatore si').
    /** @type {{distanza: number, profondita: number} | null} */
    let avanti = null;
    if (v > 1 && !b.inSuperficie) {
      const th = b.rotta * Math.PI / 180;
      for (const d of [250, 500, 1000, 2000]) {
        const h = amb.profondita(b.x + d * Math.sin(th), b.y + d * Math.cos(th));
        if (h < b.z + 10) { avanti = { distanza: d, profondita: Math.round(h) }; break; }
      }
    }
    if (avanti) this.fondaleAvantiLibero = 0; else this.fondaleAvantiLibero++;
    this._avviso(out, 'fondale_avanti', avanti !== null || (this.attivi.has('fondale_avanti') && this.fondaleAvantiLibero < 10),
      avanti ? { chi: 'navigazione', chiave: 'navigazione.fondale_avanti', parametri: avanti } : null);

    // Antenna rimorchiata e velocita'.
    const t = b.towed;
    if (t) {
      const r = b.p.sensori.rimorchiata;
      const fuori = t.stato === 'filata' || t.stato === 'in_filare' || t.stato === 'in_ritiro';
      const vDanno = r.velocita_danno ?? 18;
      const pericolo = fuori && (this.attivi.has('towed_velocita_pericolosa') ? v > vDanno - 1 : v > vDanno);
      this._avviso(out, 'towed_velocita_pericolosa', pericolo,
        { chi: 'guardia', chiave: 'towed.velocita_pericolosa', parametri: { velocita_danno: vDanno } });
      const filata = t.stato === 'filata';
      const sorda = filata && v > (r.velocita_sorda ?? 12);
      this._avviso(out, 'towed_sorda', sorda,
        { chi: 'sonar', chiave: 'towed.sorda', parametri: { velocita: Math.round(v) } });
      const curva = filata && v < (r.velocita_min ?? 3);
      this._avviso(out, 'towed_curva', curva,
        { chi: 'sonar', chiave: 'towed.curva', parametri: { velocita: Math.round(v) } });
    }
  }

  /**
   * Il timoniere riferisce quando ha raggiunto la rotta o la quota ordinate.
   * @param {Rapporto[]} out
   */
  _timoniere(out) {
    const b = this.b;
    const rotta = b.autopilota.attivo ? null : b.rottaOrdinata;
    if (rotta !== this.rottaSeguita) {
      this.rottaSeguita = rotta;
      this.rottaInAttesa = rotta !== null && Math.abs(differenzaAngolare(b.rotta, rotta)) > 2;
    }
    if (this.rottaInAttesa && rotta !== null
      && Math.abs(differenzaAngolare(b.rotta, rotta)) < 1 && Math.abs(b.omega) < 0.1) {
      this.rottaInAttesa = false;
      out.push({ chi: 'timone', chiave: 'timone.rotta_raggiunta', parametri: { rotta } });
    }
    const quota = b.modoQuota === 'automatica' ? b.quotaOrdinata : null;
    if (quota !== this.quotaSeguita) {
      this.quotaSeguita = quota;
      this.quotaInAttesa = quota !== null && Math.abs(Math.max(quota, b.p.dimensioni.pescaggio) - b.z) > 3;
    }
    if (this.quotaInAttesa && quota !== null
      && Math.abs(Math.max(quota, b.p.dimensioni.pescaggio) - b.z) < 2 && Math.abs(b.wz) < 0.2) {
      this.quotaInAttesa = false;
      out.push({ chi: 'timone', chiave: 'timone.quota_raggiunta', parametri: { quota } });
    }
  }
}
