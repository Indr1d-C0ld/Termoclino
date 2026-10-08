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
 *
 * F2: ogni corpo porta la sua firma (shared/data/firme/*.json): righe tonali,
 * righe che seguono i giri, pale e assi (DEMON), forza di bersaglio, sagoma e
 * altezza d'albero per il periscopio, radar per l'ESM altrui; i biologici
 * cantano (righe che saltano) e i globicefali scattano (transitori).
 */

import { NODO_MS, differenzaAngolare, gradiInRadianti, normalizza360, radiantiInGradi } from '../../../shared/units.js';
import { rilevamento } from '../../../shared/geo.js';
import { livelloNave, livelloNaveA, spostamentoSpettro, sommaDb } from '../sim/sensors/acustica.js';

/** @typedef {import('../sim/sensors/acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../sim/sensors/acustica.js').NomeBanda} NomeBanda */
/** @typedef {import('../sim/sensors/acustica.js').ProfiloNave} ProfiloNave */
/** @typedef {import('../../../shared/rng.js').Generatore} Generatore */
/** @typedef {import('../../../shared/data/firme.js').ValoriFirma} ValoriFirma */
/** @typedef {import('../../../shared/data/firme.js').SpecieBiologica} SpecieBiologica */
/** @typedef {import('../sim/platform/battello.js').RigaIrradiata} RigaIrradiata */
/** @typedef {import('../sim/platform/battello.js').Modulazione} Modulazione */
/** @typedef {import('../sim/platform/battello.js').Transitorio} Transitorio */

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
   * @param {ValoriFirma | null} [a.firma]  F2: la firma della classe (righe, ottica, radar)
   */
  constructor(a) {
    /** @type {ValoriFirma | null} */
    this.firma = a.firma ?? null;
    /** @type {Transitorio[]} (le navi di F2 non ne fanno; interfaccia comune) */
    this.transitoriNuovi = [];
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

  /**
   * F2: lo spettro a banda larga a una frequenza qualsiasi.
   * @param {ValoriAcustica} ac
   * @param {number} f Hz
   * @param {number} cosAspetto
   */
  livelloA(ac, f, cosAspetto) {
    return livelloNaveA(this.profilo, ac, f, this.velocita, cosAspetto);
  }

  /** Giri d'asse al minuto. */
  get giri() {
    return Math.abs(this.velocita) * (this.firma?.propulsione?.giri_per_nodo ?? 0);
  }

  /** F2: l'elica cavita (le navi di superficie gia' a velocita' basse). */
  get cavitante() {
    return Math.abs(this.velocita) > (this.firma?.propulsione?.velocita_cavitazione ?? 6);
  }

  /**
   * F2: le righe irradiate (vedi Battello.righe): le fisse riferite alla banda
   * larga alla velocita' di riferimento della firma, le altre a quella attuale.
   * @param {ValoriAcustica} ac
   * @param {number} cosAspetto
   * @returns {RigaIrradiata[]}
   */
  righe(ac, cosAspetto) {
    const fa = this.firma?.acustica;
    if (!fa) return [];
    const v = Math.abs(this.velocita);
    /** @type {RigaIrradiata[]} */
    const out = [];
    for (const t of fa.tonali ?? []) {
      if (v < t.da_velocita || v >= t.a_velocita) continue;
      out.push({ f: t.frequenza, livello: livelloNaveA(this.profilo, ac, t.frequenza, fa.velocita_rif, 0) + t.sopra_banda_larga, tipo: 'tonale' });
    }
    const asse = this.giri / 60;
    if (asse <= 0) return out;
    for (const t of fa.righe_giri ?? []) {
      if (v < t.da_velocita || v >= t.a_velocita) continue;
      const f = t.per_giro * asse;
      out.push({ f, livello: this.livelloA(ac, f, cosAspetto) + t.sopra_banda_larga, tipo: 'giri' });
    }
    const pa = fa.pale;
    if (pa) {
      const fp = asse * (this.firma?.propulsione?.elica_pale ?? 1);
      out.push({ f: asse, livello: this.livelloA(ac, asse, cosAspetto) + pa.livello_asse, tipo: 'asse' });
      for (let k = 1; k <= pa.armoniche; k++) {
        out.push({ f: k * fp, livello: this.livelloA(ac, k * fp, cosAspetto) + pa.livello - pa.decremento * (k - 1), tipo: 'pala' });
      }
    }
    return out;
  }

  /**
   * F2: la modulazione del rumore delle eliche (DEMON).
   * @returns {Modulazione | null}
   */
  modulazione() {
    const pa = this.firma?.acustica?.pale;
    const pr = this.firma?.propulsione;
    if (!pa || !pr || this.giri <= 0) return null;
    const m = this.cavitante ? pa.modulazione_cavitante : pa.modulazione;
    return { asse: this.giri / 60, pale: pr.elica_pale, assi: pr.assi, m, mAsse: m * pa.modulazione_asse, armoniche: pa.armoniche };
  }

  /**
   * F2: forza di bersaglio (seno quadro dell'aspetto fra prua/poppa e traverso).
   * @param {number} cosAspetto
   */
  forzaBersaglio(cosAspetto) {
    const fb = this.firma?.acustica?.forza_bersaglio ?? { prua_poppa: 25, traverso: 35 };
    return fb.prua_poppa + (fb.traverso - fb.prua_poppa) * (1 - cosAspetto * cosAspetto);
  }

  /** F2: i radar che trasmettono (per l'ESM altrui). */
  get emettitori() {
    return (this.firma?.emettitori ?? []).filter((r) => r.acceso !== false);
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
   * @param {SpecieBiologica | null} [a.specie]  F2: canto, scatti, forza di bersaglio
   */
  constructor(a) {
    this.id = a.id;
    this.tipo = /** @type {const} */ ('biologico');
    /** @type {SpecieBiologica | null} */
    this.specie = a.specie ?? null;
    // Sotto-flussi propri per il canto e gli scatti: non toccano quello degli episodi di F1.
    this.rngCanto = a.rng.deriva('canto');
    /** frequenza dell'unita' del canto in corso, Hz */
    this.fCanto = 0;
    this.cambioCanto = 0;
    this.prossimoScatto = 0;
    /** @type {Transitorio[]} */
    this.transitoriNuovi = [];
    /** @type {{livello: number, restante: number, peso: number}[]} */
    this.transitoriAttivi = [];
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
    this._f2(dt);
  }

  /**
   * F2: le unita' del canto cambiano frequenza; i treni di scatti sono
   * transitori `biologico`.
   * @param {number} dt
   */
  _f2(dt) {
    const sp = this.specie;
    if (!sp) return;
    if (sp.canto) {
      this.cambioCanto -= dt;
      if (this.cambioCanto <= 0) {
        this.cambioCanto = sp.canto.durata_unita;
        this.fCanto = this.rngCanto.intervallo(sp.canto.f_min, sp.canto.f_max);
      }
    }
    if (sp.scatti && this.attivo) {
      this.prossimoScatto -= dt;
      if (this.prossimoScatto <= 0) {
        this.prossimoScatto = -Math.log(1 - this.rngCanto.uniforme()) * sp.scatti.intervallo;
        this.transitoriNuovi.push({ tipo: 'biologico', livello: sp.scatti.livello, durata: sp.scatti.durata });
        this.transitoriAttivi.push({ livello: sp.scatti.livello, restante: Math.max(1, sp.scatti.durata), peso: Math.min(1, sp.scatti.durata) });
      }
    }
    if (this.transitoriAttivi.length > 0) {
      for (const t of this.transitoriAttivi) t.restante -= dt;
      this.transitoriAttivi = this.transitoriAttivi.filter((t) => t.restante > 0);
    }
  }

  /**
   * F2: le righe del canto, quando il gruppo e' attivo.
   * @returns {RigaIrradiata[]}
   */
  righe() {
    const c = this.specie?.canto;
    if (!this.attivo || !c || this.fCanto <= 0) return [];
    return [{ f: this.fCanto, livello: c.livello, tipo: 'canto' }];
  }

  /** @returns {null} i biologici non hanno eliche */
  modulazione() {
    return null;
  }

  /**
   * F2: lo spettro a banda larga a una frequenza qualsiasi: il livello di F1
   * della banda piu' vicina (i biologici non hanno uno spettro di Ross).
   * @param {ValoriAcustica} ac
   * @param {number} f Hz
   * @returns {number}
   */
  livelloA(ac, f) {
    if (!this.attivo) return -Infinity;
    return f >= 800 ? this.profilo.sl_sfera : this.profilo.sl_towed;
  }

  /** F2: forza di bersaglio. */
  forzaBersaglio() {
    return this.specie?.forza_bersaglio ?? 0;
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
    let sl = this.attivo ? (banda === 'sfera' ? this.profilo.sl_sfera : this.profilo.sl_towed) : -Infinity;
    // F2: i treni di scatti si vedono anche sul waterfall, per la loro durata.
    if (this.transitoriAttivi.length > 0) {
      let lin = 0;
      for (const t of this.transitoriAttivi) lin += t.peso * 10 ** ((t.livello + spostamentoSpettro(ac, ac.bande[banda].centro)) / 10);
      sl = sommaDb(sl, 10 * Math.log10(lin));
    }
    return sl === -Infinity ? null : sl;
  }

  verita() {
    return {
      id: this.id, tipo: this.tipo,
      x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100, z: this.z,
      rotta: Math.round(this.rotta * 1000) / 1000, attivo: this.attivo,
    };
  }
}
