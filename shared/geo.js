// @ts-check
/**
 * Geometria del mondo di gioco — modulo comune a server e browser.
 *
 * Ogni scenario ha un'origine (latitudine, longitudine) e vive su un piano
 * locale in metri: x verso est, y verso nord, rotte e rilevamenti da nord in
 * senso orario (vedi units.js). Latitudine e longitudine servono solo per
 * caricare la batimetria e per la visualizzazione (PROGETTO §5.1).
 *
 * PROIEZIONE. Si usa la proiezione azimutale equidistante sulla sfera
 * osculatrice di Gauss nel punto d'origine (raggio sqrt(M·N) dell'ellissoide
 * WGS84). E' "il piano tangente" che conserva esattamente distanze e azimut
 * dall'origine; le distanze fra due punti qualsiasi hanno un errore che cresce
 * come il quadrato della distanza dall'origine.
 *
 * ERRORE DELL'APPROSSIMAZIONE PIANA (distanza sul piano contro ortodromia
 * sulla stessa sfera, coppie di punti entro r dall'origine, caso peggiore su
 * azimut e latitudini 0°-75°; verificato da shared/test/geo.test.js):
 *
 *   r =  50 km: errore relativo <= 1,0e-5, assoluto <= 0,4 m
 *   r = 150 km: errore relativo <= 9,3e-5, assoluto <= 11 m
 *   r = 212 km: errore relativo <= 1,9e-4, assoluto <= 31 m
 *   r = 300 km: errore relativo <= 3,7e-4, assoluto <= 86 m
 *
 * L'errore relativo massimo vale c²/6 con c = r/R: nasce nella direzione
 * trasversale, dove la scala del piano e' c/sin(c); lungo i raggi uscenti
 * dall'origine l'errore e' nullo. Un'area di gioco di 300 km di lato centrata
 * sull'origine ha i punti entro 212 km dal centro: errore sotto il 2e-4, meno
 * della precisione di qualunque sensore del periodo e meno di una cella della
 * batimetria GEBCO (15 secondi d'arco, circa 460 m).
 *
 * SFERA CONTRO ELLISSOIDE. Nessuna sfera riproduce i due raggi di curvatura
 * dell'ellissoide (meridiano M e trasversale N); la sfera di Gauss sqrt(M·N)
 * divide a meta' lo scarto: 0,22 % a 36° N (Gibilterra), 0,17 % a 45° N,
 * 0,07 % a 62° N (Faer Oer), 0,04 % a 70° N (Barents), contro lo 0,2-0,4 %
 * della sfera media da 6371 km. E' una piccola anisotropia di scala quasi
 * uniforme: non deforma la geometria del gioco (che vive tutta sul piano),
 * sposta solo l'aggancio a latitudine e longitudine reali di meno di 220 m a
 * 100 km dall'origine, sotto la cella GEBCO.
 *
 * Fuori da qualche centinaio di km dall'origine la proiezione resta definita
 * ma perde senso: uno scenario piu' grande va spezzato o rifatto con un'altra
 * origine.
 */

import { gradiInRadianti, radiantiInGradi, normalizza360 } from './units.js';

/** Raggio medio terrestre IUGG (R1), in metri. */
export const RAGGIO_MEDIO_TERRA_M = 6371008.8;
/** Semiasse maggiore dell'ellissoide WGS84, in metri. */
export const WGS84_A = 6378137;
/** Schiacciamento dell'ellissoide WGS84. */
export const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);

/** @typedef {{x: number, y: number}} Punto  posizione sul piano locale, metri */
/** @typedef {{x: number, y: number}} Vettore  velocita' sul piano locale, m/s */
/** @typedef {{lat: number, lon: number}} Geografiche  gradi decimali */

/**
 * Raggio della sfera osculatrice di Gauss sull'ellissoide WGS84:
 * sqrt(M·N), media geometrica dei raggi di curvatura meridiano e trasversale.
 * @param {number} latGradi latitudine geodetica, gradi
 * @returns {number} metri
 */
export function raggioGauss(latGradi) {
  const s = Math.sin(gradiInRadianti(latGradi));
  const w = 1 - WGS84_E2 * s * s;
  return (WGS84_A * Math.sqrt(1 - WGS84_E2)) / w;
}

/**
 * Longitudine riportata in [-180, 180).
 * @param {number} lonGradi
 * @returns {number}
 */
export function normalizzaLongitudine(lonGradi) {
  const l = normalizza360(lonGradi + 180) - 180;
  return l === 0 ? 0 : l;
}

/**
 * Proiezione azimutale equidistante con origine fissa: converte fra
 * coordinate geografiche e piano locale dello scenario.
 */
export class ProiezioneLocale {
  /**
   * @param {number} lat0 latitudine dell'origine, gradi (|lat0| < 89)
   * @param {number} lon0 longitudine dell'origine, gradi
   * @param {number} [raggio] raggio della sfera in metri; predefinito il
   *   raggio di Gauss alla latitudine dell'origine
   */
  constructor(lat0, lon0, raggio) {
    if (!Number.isFinite(lat0) || !Number.isFinite(lon0) || Math.abs(lat0) >= 89) {
      throw new RangeError(`origine non valida: ${lat0}, ${lon0}`);
    }
    const r = raggio === undefined ? raggioGauss(lat0) : raggio;
    if (!Number.isFinite(r) || r <= 0) throw new RangeError(`raggio non valido: ${raggio}`);
    /** @readonly */ this.lat0 = lat0;
    /** @readonly */ this.lon0 = normalizzaLongitudine(lon0);
    /** @readonly */ this.raggio = r;
    /** @private */ this._phi0 = gradiInRadianti(lat0);
    /** @private */ this._sin0 = Math.sin(this._phi0);
    /** @private */ this._cos0 = Math.cos(this._phi0);
    /** @private */ this._lam0 = gradiInRadianti(this.lon0);
  }

  /**
   * Da coordinate geografiche al piano locale.
   * @param {number} lat gradi
   * @param {number} lon gradi
   * @returns {Punto}
   */
  inPiano(lat, lon) {
    const phi = gradiInRadianti(lat);
    const dLam = gradiInRadianti(normalizzaLongitudine(lon - this.lon0));
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    // Distanza angolare dall'origine con l'emisenoverso, stabile anche vicino a 0.
    const sDPhi = Math.sin((phi - this._phi0) / 2);
    const sDLam = Math.sin(dLam / 2);
    const h = Math.min(1, sDPhi * sDPhi + this._cos0 * cosPhi * sDLam * sDLam);
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    const k = c < 1e-9 ? 1 + (c * c) / 6 : c / Math.sin(c);
    const x = this.raggio * k * cosPhi * Math.sin(dLam);
    const y = this.raggio * k * (this._cos0 * sinPhi - this._sin0 * cosPhi * Math.cos(dLam));
    return { x, y };
  }

  /**
   * Dal piano locale a coordinate geografiche.
   * @param {number} x metri verso est
   * @param {number} y metri verso nord
   * @returns {Geografiche}
   */
  inGeografiche(x, y) {
    const rho = Math.hypot(x, y);
    if (rho < 1e-6) return { lat: this.lat0, lon: this.lon0 };
    const c = rho / this.raggio;
    const sinC = Math.sin(c);
    const cosC = Math.cos(c);
    const sinPhi = cosC * this._sin0 + (y * sinC * this._cos0) / rho;
    const phi = Math.asin(Math.max(-1, Math.min(1, sinPhi)));
    const lam =
      this._lam0 + Math.atan2(x * sinC, rho * this._cos0 * cosC - y * this._sin0 * sinC);
    return { lat: radiantiInGradi(phi), lon: normalizzaLongitudine(radiantiInGradi(lam)) };
  }
}

// ---------------------------------------------------------------------------
// Sfera: verifiche e visualizzazione
// ---------------------------------------------------------------------------

/**
 * Distanza ortodromica (formula dell'emisenoverso) fra due punti su una sfera.
 * @param {Geografiche} a
 * @param {Geografiche} b
 * @param {number} [raggio] metri, predefinito il raggio medio terrestre
 * @returns {number} metri
 */
export function distanzaOrtodromica(a, b, raggio = RAGGIO_MEDIO_TERRA_M) {
  const p1 = gradiInRadianti(a.lat);
  const p2 = gradiInRadianti(b.lat);
  const sDPhi = Math.sin((p2 - p1) / 2);
  const sDLam = Math.sin(gradiInRadianti(normalizzaLongitudine(b.lon - a.lon)) / 2);
  const h = Math.min(1, sDPhi * sDPhi + Math.cos(p1) * Math.cos(p2) * sDLam * sDLam);
  return 2 * raggio * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Rotta iniziale dell'ortodromia da `a` verso `b`, gradi veri in [0, 360).
 * @param {Geografiche} a
 * @param {Geografiche} b
 * @returns {number}
 */
export function rottaOrtodromica(a, b) {
  const p1 = gradiInRadianti(a.lat);
  const p2 = gradiInRadianti(b.lat);
  const dLam = gradiInRadianti(normalizzaLongitudine(b.lon - a.lon));
  const yy = Math.sin(dLam) * Math.cos(p2);
  const xx = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLam);
  return normalizza360(radiantiInGradi(Math.atan2(yy, xx)));
}

/**
 * Punto raggiunto percorrendo l'ortodromia da `a` con rotta iniziale `rotta`
 * per `distanza` metri.
 * @param {Geografiche} a
 * @param {number} rotta gradi veri
 * @param {number} distanza metri
 * @param {number} [raggio] metri, predefinito il raggio medio terrestre
 * @returns {Geografiche}
 */
export function puntoOrtodromico(a, rotta, distanza, raggio = RAGGIO_MEDIO_TERRA_M) {
  const p1 = gradiInRadianti(a.lat);
  const th = gradiInRadianti(rotta);
  const d = distanza / raggio;
  const sinP2 = Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th);
  const p2 = Math.asin(Math.max(-1, Math.min(1, sinP2)));
  const lam =
    gradiInRadianti(a.lon) +
    Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * sinP2);
  return { lat: radiantiInGradi(p2), lon: normalizzaLongitudine(radiantiInGradi(lam)) };
}

// ---------------------------------------------------------------------------
// Piano locale
// ---------------------------------------------------------------------------

/**
 * Distanza fra due punti del piano, metri.
 * @param {Punto} da
 * @param {Punto} a
 * @returns {number}
 */
export function distanza(da, a) {
  return Math.hypot(a.x - da.x, a.y - da.y);
}

/**
 * Rilevamento vero di `a` visto da `da`, gradi in [0, 360). Se i due punti
 * coincidono restituisce 0.
 * @param {Punto} da
 * @param {Punto} a
 * @returns {number}
 */
export function rilevamento(da, a) {
  const dx = a.x - da.x;
  const dy = a.y - da.y;
  if (dx === 0 && dy === 0) return 0;
  return normalizza360(radiantiInGradi(Math.atan2(dx, dy)));
}

/**
 * Rilevamento vero e distanza in un colpo solo.
 * @param {Punto} da
 * @param {Punto} a
 * @returns {{rilevamento: number, distanza: number}}
 */
export function rilevamentoEDistanza(da, a) {
  return { rilevamento: rilevamento(da, a), distanza: distanza(da, a) };
}

/**
 * Punto raggiunto da `da` muovendosi lungo `rotta` per `metri`.
 * @param {Punto} da
 * @param {number} rotta gradi veri
 * @param {number} metri
 * @returns {Punto}
 */
export function spostamento(da, rotta, metri) {
  const th = gradiInRadianti(rotta);
  return { x: da.x + metri * Math.sin(th), y: da.y + metri * Math.cos(th) };
}

/**
 * Vettore velocita' da rotta e modulo (le unita' del modulo si conservano:
 * nodi in ingresso, nodi in uscita).
 * @param {number} rotta gradi veri
 * @param {number} velocita
 * @returns {Vettore}
 */
export function vettoreVelocita(rotta, velocita) {
  const th = gradiInRadianti(rotta);
  return { x: velocita * Math.sin(th), y: velocita * Math.cos(th) };
}

/**
 * Rotta e modulo da un vettore velocita'. Con vettore nullo la rotta e' 0.
 * @param {Vettore} v
 * @returns {{rotta: number, velocita: number}}
 */
export function rottaEVelocita(v) {
  const velocita = Math.hypot(v.x, v.y);
  if (velocita === 0) return { rotta: 0, velocita: 0 };
  return { rotta: normalizza360(radiantiInGradi(Math.atan2(v.x, v.y))), velocita };
}

/**
 * @typedef {object} RisultatoCpa
 * @property {number} tcpa secondi dall'istante attuale al punto di minima
 *   distanza; negativo se il minimo e' gia' passato (le tracce si allontanano)
 * @property {number} dcpa distanza minima, metri
 * @property {Punto} punto1 posizione del primo mobile al CPA
 * @property {Punto} punto2 posizione del secondo mobile al CPA
 * @property {number} rilevamento rilevamento vero del secondo visto dal primo al CPA
 * @property {boolean} inAvvicinamento vero se la distanza sta diminuendo
 */

/**
 * Punto di minima distanza (CPA) fra due mobili a rotta e velocita' costanti.
 *
 * Con moto relativo nullo (stessa velocita' vettoriale) la distanza resta
 * costante: tcpa = 0 e dcpa = distanza attuale. Con `soloFuturo` il tcpa
 * negativo viene portato a 0 (il CPA "utile" di chi guarda avanti: per tracce
 * che si allontanano e' adesso).
 *
 * @param {Punto} p1 posizione del primo, metri
 * @param {Vettore} v1 velocita' del primo, m/s
 * @param {Punto} p2 posizione del secondo, metri
 * @param {Vettore} v2 velocita' del secondo, m/s
 * @param {{soloFuturo?: boolean}} [opzioni]
 * @returns {RisultatoCpa}
 */
export function cpa(p1, v1, p2, v2, opzioni = {}) {
  const dpx = p2.x - p1.x;
  const dpy = p2.y - p1.y;
  const dvx = v2.x - v1.x;
  const dvy = v2.y - v1.y;
  const dv2 = dvx * dvx + dvy * dvy;
  const prodotto = dpx * dvx + dpy * dvy;
  let t = dv2 < 1e-18 ? 0 : -prodotto / dv2;
  if (opzioni.soloFuturo && t < 0) t = 0;
  const q1 = { x: p1.x + v1.x * t, y: p1.y + v1.y * t };
  const q2 = { x: p2.x + v2.x * t, y: p2.y + v2.y * t };
  return {
    tcpa: t === 0 ? 0 : t,
    dcpa: distanza(q1, q2),
    punto1: q1,
    punto2: q2,
    rilevamento: rilevamento(q1, q2),
    inAvvicinamento: prodotto < 0,
  };
}
