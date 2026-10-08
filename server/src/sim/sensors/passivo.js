// @ts-check
/**
 * Sonar passivo a banda larga, analitico: un fotogramma al secondo di gioco
 * per sensore, 180 settori da 2°, con l'eccesso di segnale quantizzato
 * (formato in shared/protocol.js, SONAR).
 *
 * Per ogni sorgente e per ogni secondo:
 *
 *   SE₀ = SL(banda, velocita', cavitazione, aspetto) − TL − NL + DI − DT − degrado
 *   SE  = SE₀ + x,   x processo di Ornstein-Uhlenbeck (σ, τ di acustica.json)
 *   θ̂   = θ + N(0, σ_θ),   σ_θ = max(σ_min, k·fascio·10^(−SE/20))   (R1)
 *
 * e l'energia 10^(SE/10) si stende sui settori secondo il diagramma del fascio
 * puntato su θ̂ (e, per l'antenna rimorchiata, anche sullo speculare rispetto
 * all'asse: l'ambiguita' destra/sinistra). Sopra si somma il fondo
 * normalizzato, esponenziale e indipendente per settore e fotogramma, che fa
 * il grano del waterfall. Nei settori ciechi (baffles, cono di prua
 * dell'antenna) le sorgenti non entrano.
 *
 * Il sensore vede la verita' (posizioni delle sorgenti) solo qui dentro, per
 * calcolare le misure; fuori escono solo i byte del fotogramma. Le sorgenti si
 * visitano in ordine di identificativo e ogni coppia sensore-sorgente ha il suo
 * sotto-flusso casuale: stesso seme e stessi ordini, stessi fotogrammi.
 */

import { normalizza180, normalizza360 } from '../../../../shared/units.js';
import { rilevamento } from '../../../../shared/geo.js';
import { SONAR, centroSettore, quantizzaSE } from '../../../../shared/protocol.js';
import {
  guadagnoFascio,
  rumoreProprioSfera,
  rumoreProprioTowed,
  sigmaRilevamento,
  sogliaRivelazione,
  sommaDb,
} from './acustica.js';
import { perdita } from './perdita.js';

/** @typedef {import('./acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('./acustica.js').NomeBanda} NomeBanda */
/** @typedef {import('../world/ambiente.js').Ambiente} Ambiente */
/** @typedef {import('../platform/battello.js').Battello} Battello */
/** @typedef {import('../../../../shared/rng.js').Generatore} Generatore */

/**
 * Cio' che un sensore chiede a una sorgente sonora.
 * @typedef {object} Sorgente
 * @property {string} id
 * @property {number} rotta  gradi (per l'aspetto)
 * @property {() => {x: number, y: number, z: number}} posizioneAcustica
 * @property {(ac: ValoriAcustica, banda: NomeBanda, cosAspetto: number) => number | null} livello
 *   livello spettrale nella banda, dB re 1 µPa²/Hz a 1 m; null se tace
 */

/**
 * Il contributo di una sorgente a un fotogramma: la verita' dietro la misura,
 * per l'arbitro e il diario (F2). NON va mai ai client.
 * @typedef {object} Contributo
 * @property {string} sorgente  id interno
 * @property {number} rilevamento  misurato, gradi veri
 * @property {number} se  eccesso di segnale con la fluttuazione, dB
 * @property {number} se_medio  senza la fluttuazione, dB
 * @property {number} distanza_vera  m
 * @property {number} [frequenza]  banda stretta: la riga piu' forte, Hz (osservata)
 */

/**
 * @typedef {object} Fotogramma
 * @property {Uint8Array} settori
 * @property {[number, number][]} ciechi
 * @property {number} [asse]
 * @property {boolean} [sorda]
 * @property {'stretta'} [banda]  F2: fotogramma a banda stretta (bandastretta.js)
 * @property {Contributo[]} [contributi]  F2: solo sul server, per l'arbitro
 */

/** Sotto questo SE (dB) una sorgente non lascia traccia nel fotogramma. */
const SE_TRASCURABILE = -40;

export class SensorePassivo {
  /**
   * @param {object} a
   * @param {NomeBanda} a.nome
   * @param {Battello} a.battello  chi ascolta
   * @param {ValoriAcustica} a.ac
   * @param {Generatore} a.rng  sotto-flusso del sensore (rilevamenti e fondo)
   * @param {(idSorgente: string) => Generatore} a.rngCoppia  sotto-flusso per la fluttuazione di ogni coppia
   */
  constructor(a) {
    this.nome = a.nome;
    this.b = a.battello;
    this.ac = a.ac;
    this.rng = a.rng;
    this.rngCoppia = a.rngCoppia;
    const p = this.b.p;
    const dati = a.nome === 'sfera' ? p.sensori.sfera : p.sensori.rimorchiata;
    const f = a.ac.bande[a.nome].centro;
    const fRif = dati.frequenza_rif ?? f;
    // DI e fascio dai dati, riscalati se la banda non fosse centrata sulla
    // frequenza di riferimento (sfera: 20·log f; antenna lineare: 10·log f).
    this.frequenza = f;
    this.di = (dati.indice_direttivita ?? 0) + (a.nome === 'sfera' ? 20 : 10) * Math.log10(f / fRif);
    this.fascio = (dati.fascio_3db ?? 10) * fRif / f;
    this.sigmaMin = dati.sigma_min ?? 1;
    this.coefficiente = dati.coefficiente_sigma ?? 0.5;
    this.dt = sogliaRivelazione(a.ac, a.nome);
    this.lobi = a.ac.sensori[a.nome].lobi_laterali;
    /** @type {Map<string, {x: number, rng: Generatore}>} fluttuazione per sorgente */
    this.fluttuazioni = new Map();
    this.fondoLineare = 10 ** (a.ac.rivelazione.fondo_normalizzato / 10);
  }

  /**
   * Fluttuazione di Ornstein-Uhlenbeck della coppia, avanzata di un secondo.
   * @param {string} id
   * @returns {number} dB
   */
  _fluttua(id) {
    const r = this.ac.rivelazione;
    let f = this.fluttuazioni.get(id);
    if (!f) {
      const rng = this.rngCoppia(id);
      f = { x: rng.gaussiana(0, r.fluttuazione_sigma), rng };
      this.fluttuazioni.set(id, f);
      return f.x;
    }
    const a = Math.exp(-1 / r.fluttuazione_tau);
    f.x = f.x * a + r.fluttuazione_sigma * Math.sqrt(1 - a * a) * f.rng.gaussiana();
    return f.x;
  }

  /**
   * Geometria e rumore del sensore in questo istante: dove sta, verso dove
   * guarda, quanto rumore sente. null se il sensore non e' in acqua.
   * @param {Ambiente} amb
   * @returns {{pos: {x: number, y: number, z: number}, asse: number, sorda: boolean, degrado: number, nl: number} | null}
   */
  geometria(amb) {
    const b = this.b;
    const ac = this.ac;
    if (this.nome === 'towed') {
      const rim = b.p.sensori.rimorchiata;
      const pt = b.posizioneTowed();
      if (!pt || b.towed?.stato !== 'filata') return null;
      return {
        pos: pt,
        asse: pt.asse,
        sorda: !b.towedUtile,
        degrado: Math.max(0, Math.abs(b.velocita) - (rim.velocita_piena_efficacia ?? 8)) * (rim.degrado_oltre ?? 1),
        nl: sommaDb(amb.rumore(this.frequenza), rumoreProprioTowed(b.p, ac, b.velocita, b.cavitante)),
      };
    }
    return {
      pos: { x: b.x, y: b.y, z: Math.max(1, b.z - ac.sottomarini.elica_sopra_chiglia) },
      asse: b.rotta,
      sorda: false,
      degrado: 0,
      nl: sommaDb(amb.rumore(this.frequenza), rumoreProprioSfera(b.p, ac, b.velocita, b.cavitante)),
    };
  }

  /**
   * L'eccesso di segnale medio (senza fluttuazione) di una sorgente, con il
   * rilevamento vero e quello relativo all'asse; null se la sorgente tace o
   * cade in un settore cieco. E' l'equazione del sonar di questo sensore: la
   * usano i fotogrammi e la taratura (docs/CALIBRAZIONE_F1.md).
   * @param {Sorgente} s
   * @param {Ambiente} amb
   * @param {NonNullable<ReturnType<SensorePassivo['geometria']>>} g
   * @returns {{se: number, theta: number, rel: number, d: number} | null}
   */
  eccesso(s, amb, g) {
    const ac = this.ac;
    const rim = this.b.p.sensori.rimorchiata;
    const ps = s.posizioneAcustica();
    const verso = rilevamento(ps, g.pos);
    const cosAspetto = Math.cos((verso - s.rotta) * Math.PI / 180);
    const sl = s.livello(ac, this.nome, cosAspetto);
    if (sl === null) return null;
    const theta = rilevamento(g.pos, ps);
    const rel = normalizza180(theta - g.asse);
    if (this.nome === 'towed') {
      if (Math.abs(rel) < (rim.cieco_prua ?? 20)) return null;
    } else if (Math.abs(normalizza180(rel - 180)) < (this.b.p.sensori.sfera.arco_baffles ?? 60) / 2) {
      return null;
    }
    const tl = perdita(ac, amb, this.frequenza, ps, g.pos, this.nome);
    const d = Math.hypot(ps.x - g.pos.x, ps.y - g.pos.y, ps.z - g.pos.z);
    return { se: sl - tl - g.nl + this.di - this.dt - g.degrado, theta, rel, d };
  }

  /**
   * Il fotogramma del secondo appena trascorso.
   * @param {Sorgente[]} sorgenti  tutte le sorgenti della partita, in ordine di id
   * @param {Ambiente} amb
   * @returns {Fotogramma | null}  null se il sensore non c'e' (antenna non filata)
   */
  fotogramma(sorgenti, amb) {
    const b = this.b;
    const ac = this.ac;
    const towed = this.nome === 'towed';
    const rim = b.p.sensori.rimorchiata;
    const g = this.geometria(amb);
    if (!g) return null;
    const { asse, sorda } = g;

    const lineare = new Float64Array(SONAR.SETTORI);
    /** @type {Contributo[]} */
    const contributi = [];
    const sigmaDoppia = towed && (b.towed?.sigmaDoppia ?? 0) > 0 ? (rim.fattore_sigma_piccola_accostata ?? 2) : 1;
    const mezzoBaffles = (b.p.sensori.sfera.arco_baffles ?? 60) / 2;
    const ciecoPrua = rim.cieco_prua ?? 20;
    const arcoEstremita = rim.arco_estremita ?? 30;

    for (const s of sorgenti) {
      if (s === /** @type {unknown} */ (b)) continue;
      // La fluttuazione avanza sempre, anche per chi non si sente: cosi'
      // i numeri casuali non dipendono da cosa e' udibile.
      const x = this._fluttua(s.id);
      if (sorda) continue;
      const e = this.eccesso(s, amb, g);
      if (!e) continue;
      const se = e.se + x;
      if (se < SE_TRASCURABILE) continue;
      let sigma = sigmaRilevamento(se, this.fascio, this.coefficiente, this.sigmaMin) * sigmaDoppia;
      let fascio = this.fascio;
      if (towed) {
        const dagliAssi = Math.min(Math.abs(e.rel), 180 - Math.abs(e.rel));
        if (dagliAssi < arcoEstremita) sigma *= rim.fattore_sigma_estremita ?? 3;
        fascio = this.fascio / Math.max(1 / ac.sensori.towed.allargamento_max, Math.abs(Math.sin(e.rel * Math.PI / 180)));
      }
      const misurato = normalizza360(e.theta + sigma * this.rng.gaussiana());
      this._stendi(lineare, misurato, se, fascio);
      contributi.push({ sorgente: s.id, rilevamento: Math.round(misurato * 10) / 10, se, se_medio: e.se, distanza_vera: e.d });
      if (towed) this._stendi(lineare, normalizza360(2 * asse - misurato), se, fascio);
    }

    // Fondo normalizzato: potenza esponenziale per settore.
    const settori = new Uint8Array(SONAR.SETTORI);
    for (let k = 0; k < SONAR.SETTORI; k++) {
      const fondo = -Math.log(1 - this.rng.uniforme()) * this.fondoLineare;
      settori[k] = quantizzaSE(10 * Math.log10(lineare[k] + fondo));
    }

    /** @type {Fotogramma} */
    const out = { settori, ciechi: [], contributi };
    if (towed) {
      out.asse = Math.round(asse * 10) / 10;
      out.sorda = sorda;
      out.ciechi = sorda ? [[0, 360]] : [[arco(asse - ciecoPrua), arco(asse + ciecoPrua)]];
    } else {
      out.ciechi = [[arco(asse + 180 - mezzoBaffles), arco(asse + 180 + mezzoBaffles)]];
    }
    return out;
  }

  /**
   * Stende l'energia di una sorgente sui settori col diagramma del fascio.
   * @param {Float64Array} lineare
   * @param {number} theta rilevamento misurato
   * @param {number} se dB
   * @param {number} fascio gradi
   */
  _stendi(lineare, theta, se, fascio) {
    const soglia = this.ac.rivelazione.fondo_normalizzato - 20;
    // Se anche i lobi laterali sono sotto il fondo, basta il lobo principale.
    const soloPrincipale = se + this.lobi < soglia;
    const ampiezza = soloPrincipale ? fascio * Math.sqrt(Math.max(0, se - soglia) / 12) : 180;
    for (let k = 0; k < SONAR.SETTORI; k++) {
      const delta = normalizza180(centroSettore(k) - theta);
      if (Math.abs(delta) > ampiezza + SONAR.AMPIEZZA_SETTORE) continue;
      lineare[k] += 10 ** ((se + guadagnoFascio(delta, fascio, this.lobi)) / 10);
    }
  }
}

/**
 * Angolo riportato in [0, 360) e arrotondato al decimo, per gli archi ciechi.
 * @param {number} a
 */
function arco(a) {
  return Math.round(normalizza360(a) * 10) / 10;
}
