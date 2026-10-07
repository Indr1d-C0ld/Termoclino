// @ts-check
/**
 * Unita' di misura e angoli — modulo comune a server e browser.
 *
 * Convenzioni interne del motore (PROGETTO §5.1-5.2):
 *  - piano locale in metri: x verso est, y verso nord;
 *  - quota positiva verso il basso, in metri (0 = superficie). La quota del
 *    battello e' quella della chiglia, come sui profondimetri USA;
 *  - rotte e rilevamenti in gradi, 0 = nord, crescenti in senso orario;
 *  - velocita' dei battelli in nodi nei dati, in m/s quando si integra il moto.
 *
 * Le unita' "di bordo" servono solo alla visualizzazione: il 688 ragiona in
 * piedi, iarde, migliaia di iarde (kyd) e nodi; l'Alfa in metri e cavi
 * (1 kabel't = 185,2 m), come sulle unita' sovietiche.
 *
 * Tutte le costanti sono esatte per definizione (miglio nautico internazionale
 * 1929, piede e iarda internazionali 1959).
 */

/** Metri in un miglio nautico internazionale. */
export const MIGLIO_NAUTICO_M = 1852;
/** Metri al secondo in un nodo (1852 m all'ora). */
export const NODO_MS = MIGLIO_NAUTICO_M / 3600;
/** Metri in un piede internazionale. */
export const PIEDE_M = 0.3048;
/** Metri in una iarda internazionale. */
export const IARDA_M = 0.9144;
/** Metri in mille iarde (kyd). */
export const KILOIARDA_M = 914.4;
/** Metri in un cavo sovietico (кабельтов): un decimo di miglio nautico. */
export const KABELTOV_M = 185.2;

const GRADI_PER_RADIANTE = 180 / Math.PI;
const RADIANTI_PER_GRADO = Math.PI / 180;

// ---------------------------------------------------------------------------
// Velocita'
// ---------------------------------------------------------------------------

/** @param {number} nodi @returns {number} metri al secondo */
export function nodiInMs(nodi) {
  return nodi * NODO_MS;
}

/** @param {number} ms metri al secondo @returns {number} nodi */
export function msInNodi(ms) {
  return ms / NODO_MS;
}

// ---------------------------------------------------------------------------
// Lunghezze
// ---------------------------------------------------------------------------

/** @param {number} piedi @returns {number} metri */
export function piediInMetri(piedi) {
  return piedi * PIEDE_M;
}

/** @param {number} metri @returns {number} piedi */
export function metriInPiedi(metri) {
  return metri / PIEDE_M;
}

/** @param {number} iarde @returns {number} metri */
export function iardeInMetri(iarde) {
  return iarde * IARDA_M;
}

/** @param {number} metri @returns {number} iarde */
export function metriInIarde(metri) {
  return metri / IARDA_M;
}

/** @param {number} kyd migliaia di iarde @returns {number} metri */
export function kiloiardeInMetri(kyd) {
  return kyd * KILOIARDA_M;
}

/** @param {number} metri @returns {number} migliaia di iarde */
export function metriInKiloiarde(metri) {
  return metri / KILOIARDA_M;
}

/** @param {number} miglia miglia nautiche @returns {number} metri */
export function migliaNauticheInMetri(miglia) {
  return miglia * MIGLIO_NAUTICO_M;
}

/** @param {number} metri @returns {number} miglia nautiche */
export function metriInMigliaNautiche(metri) {
  return metri / MIGLIO_NAUTICO_M;
}

/** @param {number} cavi kabel't sovietici @returns {number} metri */
export function caviInMetri(cavi) {
  return cavi * KABELTOV_M;
}

/** @param {number} metri @returns {number} kabel't sovietici */
export function metriInCavi(metri) {
  return metri / KABELTOV_M;
}

// ---------------------------------------------------------------------------
// Angoli
// ---------------------------------------------------------------------------

/** @param {number} gradi @returns {number} radianti */
export function gradiInRadianti(gradi) {
  return gradi * RADIANTI_PER_GRADO;
}

/** @param {number} radianti @returns {number} gradi */
export function radiantiInGradi(radianti) {
  return radianti * GRADI_PER_RADIANTE;
}

/**
 * Riporta un angolo in [0, 360).
 * Restituisce sempre +0, mai -0, e 0 (non 360) per i multipli di 360.
 * @param {number} gradi
 * @returns {number}
 */
export function normalizza360(gradi) {
  let a = gradi % 360;
  if (a < 0) a += 360;
  // -1e-14 % 360 + 360 arrotonda a 360: va ripiegato su 0.
  if (a >= 360) a -= 360;
  return a === 0 ? 0 : a;
}

/**
 * Riporta un angolo in (-180, 180]. Utile per differenze e rilevamenti
 * relativi con segno (negativo = sinistra).
 * @param {number} gradi
 * @returns {number}
 */
export function normalizza180(gradi) {
  const a = normalizza360(gradi);
  return a > 180 ? a - 360 : a;
}

/**
 * Accostata piu' breve per passare dalla rotta `da` alla rotta `a`, in
 * (-180, 180]: positiva = a dritta (oraria), negativa = a sinistra.
 * @param {number} da gradi
 * @param {number} a gradi
 * @returns {number}
 */
export function differenzaAngolare(da, a) {
  return normalizza180(a - da);
}

/**
 * Converte fra angolo nautico (0 = nord, orario) e angolo matematico
 * (0 = est, antiorario), utile per Math.cos/Math.sin e per il Canvas.
 * La trasformazione e' la stessa nei due sensi: 90 - angolo.
 * @param {number} gradi
 * @returns {number} gradi in [0, 360)
 */
export function nauticoMatematico(gradi) {
  return normalizza360(90 - gradi);
}

// ---------------------------------------------------------------------------
// Rilevamenti veri e relativi
// ---------------------------------------------------------------------------

/**
 * Rilevamento relativo alla prua, in [0, 360) come lo leggono i sonaristi USA
 * (000 = di prua, 090 = al traverso di dritta, 180 = di poppa, 270 = al traverso
 * di sinistra).
 * @param {number} vero rilevamento vero, gradi
 * @param {number} prua gradi (rotta vera del proprio battello)
 * @returns {number}
 */
export function rilevamentoRelativo(vero, prua) {
  return normalizza360(vero - prua);
}

/**
 * Rilevamento relativo con segno, in (-180, 180]: positivo a dritta,
 * negativo a sinistra.
 * @param {number} vero rilevamento vero, gradi
 * @param {number} prua gradi
 * @returns {number}
 */
export function rilevamentoRelativoConSegno(vero, prua) {
  return normalizza180(vero - prua);
}

/**
 * Rilevamento vero da un rilevamento relativo alla prua.
 * @param {number} rilevamentoRel gradi (qualunque rappresentazione)
 * @param {number} prua gradi
 * @returns {number} gradi in [0, 360)
 */
export function rilevamentoVero(rilevamentoRel, prua) {
  return normalizza360(prua + rilevamentoRel);
}

/**
 * Il rilevamento relativo cade nei baffles, cioe' nel cono cieco centrato
 * sulla poppa? `arcoBaffles` e' l'ampiezza TOTALE del cono (per esempio 60°
 * per una sfera che copre ±150° dalla prua). Il bordo del cono e' ancora
 * coperto dal sensore.
 * @param {number} rilevamentoRel gradi
 * @param {number} arcoBaffles gradi, ampiezza totale
 * @returns {boolean}
 */
export function neiBaffles(rilevamentoRel, arcoBaffles) {
  return Math.abs(normalizza180(rilevamentoRel - 180)) < arcoBaffles / 2;
}

/**
 * Lato del rilevamento relativo: 'dritta', 'sinistra', oppure 'prua'/'poppa'
 * esattamente sull'asse.
 * @param {number} rilevamentoRel gradi
 * @returns {'dritta' | 'sinistra' | 'prua' | 'poppa'}
 */
export function latoRilevamento(rilevamentoRel) {
  const a = normalizza180(rilevamentoRel);
  if (a === 0) return 'prua';
  if (a === 180) return 'poppa';
  return a > 0 ? 'dritta' : 'sinistra';
}

/**
 * Rilevamento speculare rispetto a un asse (per esempio l'asse di un'antenna
 * rimorchiata, che non distingue i due lati): restituisce l'altro rilevamento
 * vero compatibile con la stessa misura.
 * @param {number} rilevamento gradi veri
 * @param {number} asse gradi veri dell'asse di simmetria
 * @returns {number} gradi in [0, 360)
 */
export function rilevamentoSpeculare(rilevamento, asse) {
  return normalizza360(2 * asse - rilevamento);
}
