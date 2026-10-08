// @ts-check
/**
 * Bersagli di F1: navi di superficie che seguono i waypoint dello scenario
 * (i cacciatorpediniere di TORPEX '89, un mercantile neutrale) e sorgenti
 * biologiche intermittenti. Niente armi, niente evasione: in F1 sono rumore
 * che si muove (PROGETTO §11.2, punto 11). L'IA che li comanda in F4 usera'
 * gli stessi corpi.
 *
 * Cinematica semplice ma onesta: velocita' che insegue l'ordine con
 * un'accelerazione limitata, accostata al piu' a v/R (diametro tattico del
 * profilo), rotta verso il prossimo waypoint, giro dei waypoint in cerchio.
 */

import { NODO_MS, differenzaAngolare, gradiInRadianti, normalizza360, radiantiInGradi } from '../../../shared/units.js';
import { rilevamento } from '../../../shared/geo.js';
import { livelloNave } from '../sim/sensors/acustica.js';

/** @typedef {import('../sim/sensors/acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../sim/sensors/acustica.js').NomeBanda} NomeBanda */
/** @typedef {import('../sim/sensors/acustica.js').ProfiloNave} ProfiloNave */
/** @typedef {import('../../../shared/rng.js').Generatore} Generatore */

/** Raggio d'arrivo a un waypoint, m. */
const ARRIVO = 500;

export class Nave {
  /**
   * @param {object} a
   * @param {string} a.id
   * @param {'cacciatorpediniere' | 'mercantile'} a.classe
   * @param {string} a.nome
   * @param {ProfiloNave} a.profilo
   * @param {number} a.x @param {number} a.y @param {number} a.rotta @param {number} a.velocita kt
   * @param {{x: number, y: number}[]} a.waypoint
   * @param {'ciclo' | 'ferma'} [a.alTermine]  dopo l'ultimo waypoint: si torna al punto di
   *   partenza e si ricomincia (predefinito), oppure ci si ferma (TORPEX '89: SPEED_TO 0)
   */
  constructor(a) {
    this.id = a.id;
    this.tipo = /** @type {const} */ ('nave');
    this.classe = a.classe;
    this.nome = a.nome;
    this.profilo = a.profilo;
    this.x = a.x;
    this.y = a.y;
    this.z = 0;
    this.rotta = normalizza360(a.rotta);
    this.velocita = a.velocita;
    this.velocitaOrdinata = Math.min(a.velocita, a.profilo.velocita_max);
    this.alTermine = a.alTermine ?? 'ciclo';
    // In ciclo il giro si chiude tornando al punto di partenza.
    const partenza = { x: a.x, y: a.y };
    const ultimo = a.waypoint[a.waypoint.length - 1];
    this.waypoint = this.alTermine === 'ciclo' && a.waypoint.length > 0
      && (!ultimo || Math.hypot(ultimo.x - partenza.x, ultimo.y - partenza.y) > ARRIVO)
      ? [...a.waypoint, partenza] : [...a.waypoint];
    this.prossimo = 0;
    this.arrivata = false;
  }

  /**
   * @param {number} dt s
   */
  passo(dt) {
    const pr = this.profilo;
    const w = this.arrivata ? null : this.waypoint[this.prossimo];
    if (w) {
      if (Math.hypot(w.x - this.x, w.y - this.y) < ARRIVO) {
        if (this.prossimo + 1 < this.waypoint.length) this.prossimo++;
        else if (this.alTermine === 'ciclo') this.prossimo = 0;
        else { this.arrivata = true; this.velocitaOrdinata = 0; }
      }
    }
    if (w && !this.arrivata) {
      const voluta = rilevamento(this, this.waypoint[this.prossimo]);
      const errore = differenzaAngolare(this.rotta, voluta);
      const omegaMax = radiantiInGradi(this.velocita * NODO_MS / (pr.diametro_tattico / 2));
      const omega = Math.max(-omegaMax, Math.min(omegaMax, errore / 4));
      this.rotta = normalizza360(this.rotta + omega * dt);
    }
    const dv = this.velocitaOrdinata - this.velocita;
    this.velocita += Math.max(-pr.accelerazione * dt, Math.min(pr.accelerazione * dt, dv));
    const th = gradiInRadianti(this.rotta);
    const v = this.velocita * NODO_MS;
    this.x += v * Math.sin(th) * dt;
    this.y += v * Math.cos(th) * dt;
  }

  posizioneAcustica() {
    return { x: this.x, y: this.y, z: this.profilo.quota_sorgente };
  }

  /**
   * @param {ValoriAcustica} ac
   * @param {NomeBanda} banda
   * @param {number} cosAspetto
   */
  livello(ac, banda, cosAspetto) {
    return livelloNave(this.profilo, ac, banda, this.velocita, cosAspetto);
  }

  verita() {
    return {
      id: this.id, tipo: this.tipo, classe: this.classe,
      x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100, z: 0,
      rotta: Math.round(this.rotta * 1000) / 1000, velocita: Math.round(this.velocita * 1000) / 1000,
    };
  }
}

/**
 * Sorgente biologica: un gruppo di cetacei o un branco, che si sposta piano e
 * si fa sentire a episodi (durate esponenziali, sotto-flusso proprio).
 */
export class Biologico {
  /**
   * @param {object} a
   * @param {string} a.id
   * @param {number} a.x @param {number} a.y
   * @param {ValoriAcustica['sorgenti']['biologico']} a.profilo
   * @param {Generatore} a.rng
   * @param {number} [a.quota] m (predefinita quella del profilo)
   * @param {number} [a.velocita] kt di deriva (predefinita quella del profilo)
   */
  constructor(a) {
    this.id = a.id;
    this.tipo = /** @type {const} */ ('biologico');
    this.profilo = a.profilo;
    this.rng = a.rng;
    this.x = a.x;
    this.y = a.y;
    this.z = a.quota ?? a.profilo.quota;
    this.rotta = this.rng.intervallo(0, 360);
    this.velocita = a.velocita ?? a.profilo.deriva;
    this.attivo = this.rng.probabilita(a.profilo.attiva_media / (a.profilo.attiva_media + a.profilo.spenta_media));
    this.cambio = this._durata();
  }

  _durata() {
    const media = this.attivo ? this.profilo.attiva_media : this.profilo.spenta_media;
    return -Math.log(1 - this.rng.uniforme()) * media;
  }

  /**
   * @param {number} dt s
   */
  passo(dt) {
    const th = gradiInRadianti(this.rotta);
    const v = this.velocita * NODO_MS;
    this.x += v * Math.sin(th) * dt;
    this.y += v * Math.cos(th) * dt;
    this.cambio -= dt;
    if (this.cambio <= 0) {
      this.attivo = !this.attivo;
      this.cambio = this._durata();
      // Ogni tanto il gruppo cambia direzione.
      this.rotta = normalizza360(this.rotta + this.rng.intervallo(-45, 45));
    }
  }

  posizioneAcustica() {
    return { x: this.x, y: this.y, z: this.z };
  }

  /**
   * @param {ValoriAcustica} ac
   * @param {NomeBanda} banda
   * @returns {number | null}
   */
  livello(ac, banda) {
    if (!this.attivo) return null;
    return banda === 'sfera' ? this.profilo.sl_sfera : this.profilo.sl_towed;
  }

  verita() {
    return {
      id: this.id, tipo: this.tipo,
      x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100, z: this.z,
      rotta: Math.round(this.rotta * 1000) / 1000, attivo: this.attivo,
    };
  }
}
