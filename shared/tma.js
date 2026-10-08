// @ts-check
/**
 * TMA — analisi del moto del bersaglio sui soli rilevamenti (PROGETTO §5.6,
 * docs/ricerca/06_tma.md). Matematica pura, senza dipendenze: la usano il
 * server (l'equipaggio, livelli 2-3) e il client (gli strumenti manuali dei
 * livelli 0-1), cosi' i numeri che il giocatore calcola da se' sono gli stessi
 * dell'equipaggio. Gira in Node 20+ e nei browser.
 *
 * ============================================================================
 * API (stabile da F2: il client la usa senza chiedere niente al server)
 * ============================================================================
 *
 * Convenzioni
 *  - piano locale in metri, x verso est, y verso nord; tempi in secondi di
 *    gioco (`ora`, come nel protocollo);
 *  - rilevamenti e rotte in gradi veri (0 = nord, senso orario);
 *  - lo STATO CARTESIANO del bersaglio e' {ora, x, y, vx, vy} in m e m/s: la
 *    posizione all'istante `ora` e la velocita' (costante: moto rettilineo
 *    uniforme, l'ipotesi di tutta la TMA classica);
 *  - la FORMA POLARE e' quella del protocollo: {ora, rilevamento, distanza,
 *    rotta, velocita} con distanza in m e velocita' in NODI, riferita alla
 *    posizione propria a quell'ora (`daPolare`, `inPolare`);
 *  - una MISURA e' {ora, rilevamento, sigma, x, y}: il rilevamento vero
 *    misurato, la sua deviazione standard stimata (gradi) e la posizione DEL
 *    SENSORE in quell'istante (per l'antenna rimorchiata non e' lo scafo).
 *
 * Strumenti manuali (livelli 0-1)
 *  - comprimi(misure, passo)               punti tempo-rilevamento: media pesata per intervalli
 *  - velocitaRilevamento(misure, {da, a})  retta ai minimi quadrati: rilevamento, °/min e il loro errore
 *  - velocitaTrasversale(rotta, kt, ril)   velocita' propria attraverso la linea di vista (kt, + = a dritta)
 *  - trovaGambe(campioni, opz)             le gambe del proprio moto (rotta e velocita' costanti)
 *  - distanzaEkelund(g1, g2)               R = (SOA₂ − SOA₁)/(BR₁ − BR₂) e il «best range time»
 *  - ekelundGambe(misure, gambe)           Ekelund su ogni coppia di gambe consecutive
 *  - residuiMATE(misure, prova, opz)       residui di una soluzione di prova, per gamba
 *
 * Forme e piccoli aiuti
 *  - daPolare(sol, proprio) / inPolare(stato, proprio)   forma del protocollo <-> stato cartesiano
 *  - avanzaStato(stato, ora), rilevamentoPrevisto(stato, misura), rilevamentoDa(x0, y0, x1, y1)
 *  - norm360, norm180, scartoDallaRetta(punti) (m: 0 = nessuna manovra propria)
 *  - costanti: NODO_MS, Q_TIRO (70), K_ELLISSE, CONTENIMENTO_ELLISSE (0,9), DISTANZE_PARTENZA,
 *    SIGMA_VELOCITA_PRIORE, DISTANZA_MINIMA_EQUIPAGGIO
 *
 * Stimatore (livelli 2-3)
 *  - stimaMV(misure, opz)        massima verosimiglianza (Levenberg-Marquardt) con covarianza,
 *                                ellisse, qualita' Q e osservabilita'; opzioni per l'equipaggio:
 *                                costo robusto (Cauchy), distanza minima, profilo della distanza
 *  - propaga(stima, ora, rif)    la stessa stima a un'altra ora (covarianza propagata)
 *  - qualita({...})              la Q 0-100 dalle incertezze (definizione sotto)
 *  - ellisse(pxx, pxy, pyy)      semiassi e orientamento dell'ellisse al 90 %
 *  - limiteCramerRao(misure, vero, opz)  il miglior errore possibile per una geometria
 *  - osservabilita(misure, opz)  la distanza e' osservabile? (senza manovra propria: no)
 *  - consiglioManovra(opz)       l'accostata e la durata che massimizzano l'osservabilita'
 *
 * Qualita' Q (06_tma.md §4, con una correzione dichiarata):
 *
 *     Q = 100 · exp( −[ (σR / 0,10·R)² + (σC / 20°)² + (σV / 3 kt)² ] / 3 )
 *
 * σR = errore standard della distanza all'ora della stima, σV della
 * velocita' lungo il moto, σC della rotta. Correzione: σC si calcola come
 * errore della velocita' TRASVERSALE al moto diviso per max(V, 5 kt), non per
 * V: per un bersaglio quasi fermo la rotta e' indefinita ma irrilevante per il
 * tiro (20° di rotta su 5 kt sono 1,7 kt di velocita' trasversale, e quello e'
 * il metro). Q ≈ 37 vuol dire «errori pari alle soglie»; Q ≥ 70 (Q_TIRO) e' la
 * soluzione di tiro (σR ≲ 6-10 % di R). Se lo stimatore spiega male le misure
 * (χ² ridotto > 1, per esempio perche' il bersaglio ha manovrato) la
 * covarianza si gonfia di quel fattore e Q cala; se il profilo della
 * verosimiglianza sulla distanza (la stima rifatta a distanza fissata) e' piu'
 * largo della covarianza lineare, la covarianza si gonfia fino a quello. Senza
 * osservabilita' Q = 0.
 *
 * Lo stato e' cartesiano (x, y, vx, vy all'ora della stima) e non in
 * coordinate polari modificate: con il Levenberg-Marquardt, piu' partenze e il
 * profilo della distanza non serve, e le misure di sensori in posti diversi
 * (sfera e antenna 800 m a poppa) entrano senza conti in piu'.
 */

/** m/s in un nodo. */
export const NODO_MS = 1852 / 3600;
/** Soglia di Q per la soluzione di tiro (06_tma.md §4, nozionale). */
export const Q_TIRO = 70;
/** Probabilita' di contenimento dell'ellisse inviata (semiassi a k·σ). */
export const CONTENIMENTO_ELLISSE = 0.9;
/** k dell'ellisse al 90 % in due dimensioni: √(−2·ln 0,1). */
export const K_ELLISSE = Math.sqrt(-2 * Math.log(1 - CONTENIMENTO_ELLISSE));
/** Distanze di partenza dello stimatore, m (2, 5, 10, 20, 40 kyd come in tma_mc2.py, piu' 1 km). */
export const DISTANZE_PARTENZA = Object.freeze([1000, 1829, 4572, 9144, 18288, 36576]);
/**
 * Distanza minima delle stime dell'equipaggio, m (nozionale): un contatto passivo tenuto per
 * minuti a meno di un chilometro coprirebbe ogni altro suono; sotto, le soluzioni «a ridosso»
 * sono quasi sempre l'effetto di rilevamenti sbagliati.
 */
export const DISTANZA_MINIMA_EQUIPAGGIO = 1000;
/** Priore debole sulla velocita' del bersaglio usato dall'equipaggio, m/s per componente (15 kt). */
export const SIGMA_VELOCITA_PRIORE = 15 * NODO_MS;

const RAD = Math.PI / 180;
const GRADI = 180 / Math.PI;
/** Sotto questo scarto dalla retta (m) il proprio moto non ha manovra. */
const SCARTO_MANOVRA_MIN = 25;
/** Costante del costo robusto di Cauchy (95 % d'efficienza su misure gaussiane). */
const CAUCHY = 2.385;
/** Velocita' sotto cui l'errore di rotta si misura come velocita' trasversale (m/s). */
const V_RIF_ROTTA = 5 * NODO_MS;

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Misura
 * @property {number} ora  s di gioco
 * @property {number} rilevamento  gradi veri
 * @property {number} sigma  deviazione standard stimata, gradi (> 0)
 * @property {number} x  posizione del sensore all'ora della misura, m (est)
 * @property {number} y  m (nord)
 */

/**
 * @typedef {object} StatoCartesiano
 * @property {number} ora  s
 * @property {number} x  m
 * @property {number} y  m
 * @property {number} vx  m/s
 * @property {number} vy  m/s
 */

/**
 * @typedef {object} SoluzionePolare  la forma del protocollo
 * @property {number} ora
 * @property {number} rilevamento  gradi veri, dalla posizione propria
 * @property {number} distanza  m
 * @property {number} rotta  gradi veri
 * @property {number} velocita  nodi
 */

/**
 * @typedef {object} Ellisse  semiassi al 90 % (K_ELLISSE · σ)
 * @property {number} asse_lungo  semiasse maggiore, m
 * @property {number} asse_corto  semiasse minore, m
 * @property {number} orientamento  rilevamento vero del semiasse maggiore, gradi in [0, 180)
 */

/**
 * @typedef {object} Stima
 * @property {number} ora  ora di riferimento
 * @property {number} x @property {number} y @property {number} vx @property {number} vy
 * @property {number[]} covarianza  4×4 per righe (x, y, vx, vy), m e m/s
 * @property {{x: number, y: number}} riferimento  posizione propria all'ora della stima
 * @property {number} distanza  m
 * @property {number} rilevamento  gradi veri
 * @property {number} rotta  gradi veri
 * @property {number} velocita  nodi
 * @property {number} sigmaDistanza  m (Infinity se non osservabile)
 * @property {number} sigmaRotta  gradi (vedi la correzione nell'intestazione)
 * @property {number} sigmaVelocita  nodi
 * @property {Ellisse | null} ellisse
 * @property {number} q  0-100
 * @property {boolean} osservabile
 * @property {string | null} motivo  'nessuna_manovra' | 'geometria_debole' | null
 * @property {number} chi2  χ² ridotto dei residui (≈ 1 se le σ sono giuste e il modello regge)
 * @property {number} rms  residuo quadratico medio, gradi
 * @property {number} n  misure usate
 * @property {number} iterazioni
 * @property {number} [fattoreProfilo]  di quanto il profilo della distanza ha gonfiato la covarianza (≥ 1)
 */

/**
 * @typedef {object} Gamba
 * @property {number} da  s
 * @property {number} a  s
 * @property {number} rotta  gradi veri (media)
 * @property {number} velocita  nodi (media)
 */

// ---------------------------------------------------------------------------
// Angoli e piccola algebra
// ---------------------------------------------------------------------------

/** @param {number} g @returns {number} in [0, 360) */
export function norm360(g) {
  let a = g % 360;
  if (a < 0) a += 360;
  if (a >= 360) a -= 360;
  return a === 0 ? 0 : a;
}

/** @param {number} g @returns {number} in (−180, 180] */
export function norm180(g) {
  const a = norm360(g);
  return a > 180 ? a - 360 : a;
}

/** @param {number} r radianti @returns {number} in (−π, π] */
function normPi(r) {
  let a = r % (2 * Math.PI);
  if (a <= -Math.PI) a += 2 * Math.PI;
  else if (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

/**
 * Rilevamento vero da (x0, y0) a (x1, y1), gradi.
 * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
 */
export function rilevamentoDa(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx === 0 && dy === 0) return 0;
  return norm360(Math.atan2(dx, dy) * GRADI);
}

/**
 * Risolve A·x = b (n×n per righe) con eliminazione di Gauss e pivot parziale.
 * @param {number[]} A  n·n, non modificata
 * @param {number[]} b
 * @param {number} n
 * @returns {number[] | null} null se singolare
 */
function risolvi(A, b, n) {
  const M = A.slice();
  const v = b.slice();
  let scala = 0;
  for (let i = 0; i < n * n; i++) scala = Math.max(scala, Math.abs(M[i]));
  if (!(scala > 0)) return null;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r * n + c]) > Math.abs(M[p * n + c])) p = r;
    if (Math.abs(M[p * n + c]) <= scala * 1e-15) return null;
    if (p !== c) {
      for (let k = 0; k < n; k++) { const t = M[c * n + k]; M[c * n + k] = M[p * n + k]; M[p * n + k] = t; }
      const t = v[c]; v[c] = v[p]; v[p] = t;
    }
    for (let r = c + 1; r < n; r++) {
      const f = M[r * n + c] / M[c * n + c];
      if (f === 0) continue;
      for (let k = c; k < n; k++) M[r * n + k] -= f * M[c * n + k];
      v[r] -= f * v[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = v[r];
    for (let k = r + 1; k < n; k++) s -= M[r * n + k] * x[k];
    x[r] = s / M[r * n + r];
  }
  return x;
}

/**
 * Inversa di una matrice 4×4 simmetrica definita positiva, con un controllo di
 * condizionamento relativo alla scala di ogni variabile (le variabili hanno
 * unita' diverse: m e m/s). null se (numericamente) singolare.
 * @param {number[]} A 16
 * @returns {number[] | null}
 */
function inversa4(A) {
  // Equilibratura: D·A·D con D = diag(1/√A_ii), cosi' la soglia e' adimensionale.
  const d = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    if (!(A[i * 5] > 0)) return null;
    d[i] = 1 / Math.sqrt(A[i * 5]);
  }
  const E = new Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) E[i * 4 + j] = A[i * 4 + j] * d[i] * d[j];
  // Cholesky di E.
  const L = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j <= i; j++) {
      let s = E[i * 4 + j];
      for (let k = 0; k < j; k++) s -= L[i * 4 + k] * L[j * 4 + k];
      if (i === j) {
        if (!(s > 1e-11)) return null;
        L[i * 4 + i] = Math.sqrt(s);
      } else {
        L[i * 4 + j] = s / L[j * 4 + j];
      }
    }
  }
  // Inversa di L, poi E⁻¹ = L⁻ᵀ L⁻¹.
  const Li = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    Li[i * 4 + i] = 1 / L[i * 4 + i];
    for (let j = 0; j < i; j++) {
      let s = 0;
      for (let k = j; k < i; k++) s -= L[i * 4 + k] * Li[k * 4 + j];
      Li[i * 4 + j] = s / L[i * 4 + i];
    }
  }
  const out = new Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = Math.max(i, j); k < 4; k++) s += Li[k * 4 + i] * Li[k * 4 + j];
      out[i * 4 + j] = s * d[i] * d[j];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Strumenti manuali
// ---------------------------------------------------------------------------

/**
 * Punti tempo-rilevamento: le misure raggruppate in intervalli di `passo`
 * secondi (allineati a multipli di `passo`), ciascuno con la media pesata
 * (1/σ²) del rilevamento, l'errore della media σ/√n, l'ora e la posizione
 * medie del sensore. E' la «pila di punti» del diagramma tempo-rilevamento e
 * il modo in cui l'equipaggio riduce le misure al secondo prima dello
 * stimatore: con il bersaglio che si muove di pochi decimi di grado per
 * intervallo l'informazione persa e' trascurabile.
 * @param {Misura[]} misure  in ordine di tempo
 * @param {number} passo  s
 * @returns {Misura[]}
 */
export function comprimi(misure, passo) {
  /** @type {Misura[]} */
  const out = [];
  let i = 0;
  while (i < misure.length) {
    const k = Math.floor(misure[i].ora / passo);
    const rif = misure[i].rilevamento;
    let w = 0; let sb = 0; let st = 0; let sx = 0; let sy = 0;
    let j = i;
    for (; j < misure.length && Math.floor(misure[j].ora / passo) === k; j++) {
      const m = misure[j];
      const wi = 1 / (m.sigma * m.sigma);
      w += wi;
      sb += wi * norm180(m.rilevamento - rif);
      st += wi * m.ora;
      sx += wi * m.x;
      sy += wi * m.y;
    }
    out.push({ ora: st / w, rilevamento: norm360(rif + sb / w), sigma: 1 / Math.sqrt(w), x: sx / w, y: sy / w });
    i = j;
  }
  return out;
}

/**
 * Velocita' di variazione del rilevamento: retta ai minimi quadrati pesati sui
 * rilevamenti (srotolati attorno al primo) fra `da` e `a`.
 * @param {Misura[]} misure
 * @param {{da?: number, a?: number}} [finestra]
 * @returns {{ora: number, rilevamento: number, variazione: number, sigmaVariazione: number,
 *   sigmaRilevamento: number, n: number} | null}  `ora` = ora media (pesata), `rilevamento`
 *   a quell'ora; `variazione` in gradi al minuto (+ = il rilevamento cresce, verso dritta)
 */
export function velocitaRilevamento(misure, finestra = {}) {
  const da = finestra.da ?? -Infinity;
  const a = finestra.a ?? Infinity;
  const sel = misure.filter((m) => m.ora >= da && m.ora <= a);
  if (sel.length < 2) return null;
  const rif = sel[0].rilevamento;
  let w = 0; let st = 0; let sb = 0;
  for (const m of sel) {
    const wi = 1 / (m.sigma * m.sigma);
    w += wi; st += wi * m.ora; sb += wi * norm180(m.rilevamento - rif);
  }
  const tm = st / w;
  const bm = sb / w;
  let stt = 0; let stb = 0;
  for (const m of sel) {
    const wi = 1 / (m.sigma * m.sigma);
    const dt = m.ora - tm;
    stt += wi * dt * dt;
    stb += wi * dt * (norm180(m.rilevamento - rif) - bm);
  }
  if (!(stt > 0)) return null;
  const pendenza = stb / stt; // gradi/s
  return {
    ora: tm,
    rilevamento: norm360(rif + bm),
    variazione: pendenza * 60,
    sigmaVariazione: 60 / Math.sqrt(stt),
    sigmaRilevamento: 1 / Math.sqrt(w),
    n: sel.length,
  };
}

/**
 * Velocita' propria attraverso la linea di vista (SOA trasversale), con il
 * segno della convenzione del bearing rate: positiva se la propria rotta sta a
 * dritta del rilevamento (il moto proprio fa calare il rilevamento).
 * R·BR = STA − SOA (NAVOPS-11 eq. 11-8).
 * @param {number} rotta gradi
 * @param {number} velocita  qualsiasi unita' (la stessa esce)
 * @param {number} rilevamento gradi
 */
export function velocitaTrasversale(rotta, velocita, rilevamento) {
  return velocita * Math.sin((rotta - rilevamento) * RAD);
}

/**
 * Distanza di Ekelund da due gambe (NAVOPS-11 §1103 eq. 11-10, COLL94 eq. 1-2):
 *
 *     R = (SOA₂ − SOA₁) / (BR₁ − BR₂)
 *
 * con BR in rad/s e SOA in m/s; e il «best range time» t* in cui la stima e'
 * insensibile alla velocita' radiale del bersaglio, l'istante in cui le due
 * rette tempo-rilevamento si incontrano:
 * t* = (t₁·BR₁ − t₂·BR₂ + B₂ − B₁)/(BR₁ − BR₂) (unita' coerenti; COLL94 eq. 2
 * scrive B₁ − B₂ con l'altra convenzione di segno della differenza).
 * Ipotesi: distanza quasi costante durante la manovra, bersaglio in moto
 * rettilineo uniforme.
 * @param {{ora: number, rilevamento: number, variazione: number, sigmaVariazione?: number,
 *   soa: number}} g1  prima gamba: ora media, rilevamento a quell'ora, °/min, kt trasversali
 * @param {typeof g1} g2
 * @returns {{distanza: number, ora: number, valida: boolean, sigmaDistanza: number}}
 *   `valida` = distanza positiva e differenza dei BR significativa (oltre 2σ)
 */
export function distanzaEkelund(g1, g2) {
  const br1 = g1.variazione * RAD / 60;
  const br2 = g2.variazione * RAD / 60;
  const dbr = br1 - br2;
  const dsoa = (g2.soa - g1.soa) * NODO_MS;
  const distanza = dbr === 0 ? Infinity : dsoa / dbr;
  const s1 = (g1.sigmaVariazione ?? 0) * RAD / 60;
  const s2 = (g2.sigmaVariazione ?? 0) * RAD / 60;
  const sdbr = Math.hypot(s1, s2);
  const sigmaDistanza = dbr === 0 ? Infinity : Math.abs(distanza) * sdbr / Math.abs(dbr);
  const dB = norm180(g2.rilevamento - g1.rilevamento) * RAD;
  const ora = dbr === 0 ? (g1.ora + g2.ora) / 2 : (g1.ora * br1 - g2.ora * br2 + dB) / dbr;
  return {
    distanza,
    ora,
    valida: Number.isFinite(distanza) && distanza > 0 && Math.abs(dbr) > 2 * sdbr,
    sigmaDistanza,
  };
}

/**
 * Le gambe del proprio moto: tratti in cui rotta e velocita' restano entro le
 * tolleranze; i tratti d'accostata non fanno parte di nessuna gamba.
 * @param {{ora: number, rotta: number, velocita: number}[]} campioni  in ordine di tempo
 * @param {{tolleranzaRotta?: number, tolleranzaVelocita?: number, durataMinima?: number}} [o]
 *   gradi (3), nodi (1), s (60)
 * @returns {Gamba[]}
 */
export function trovaGambe(campioni, o = {}) {
  const tr = o.tolleranzaRotta ?? 3;
  const tv = o.tolleranzaVelocita ?? 1;
  const dmin = o.durataMinima ?? 60;
  /** @type {Gamba[]} */
  const gambe = [];
  let i = 0;
  while (i < campioni.length) {
    const c0 = campioni[i];
    let sr = 0; let sv = 0; let n = 0;
    let j = i;
    for (; j < campioni.length; j++) {
      const c = campioni[j];
      if (Math.abs(norm180(c.rotta - c0.rotta)) > tr || Math.abs(c.velocita - c0.velocita) > tv) break;
      sr += norm180(c.rotta - c0.rotta); sv += c.velocita; n++;
    }
    const fine = campioni[j - 1];
    if (fine.ora - c0.ora >= dmin) {
      gambe.push({ da: c0.ora, a: fine.ora, rotta: norm360(c0.rotta + sr / n), velocita: sv / n });
    }
    i = Math.max(j, i + 1);
  }
  return gambe;
}

/**
 * Ekelund su ogni coppia di gambe consecutive (con almeno `minimo` misure
 * per gamba). E' il conto che l'equipaggio fa al livello 1 a ogni cambio di
 * gamba, e quello che il giocatore fa da se' al livello 0.
 * @param {Misura[]} misure
 * @param {Gamba[]} gambe
 * @param {{minimo?: number, margine?: number}} [o]  misure minime per gamba (6); s scartati
 *   all'inizio di ogni gamba (30: l'assestamento dopo l'accostata)
 * @returns {{da: Gamba, a: Gamba, distanza: number, ora: number, valida: boolean, sigmaDistanza: number}[]}
 */
export function ekelundGambe(misure, gambe, o = {}) {
  const minimo = o.minimo ?? 6;
  const margine = o.margine ?? 30;
  const out = [];
  for (let k = 0; k + 1 < gambe.length; k++) {
    const g1 = gambe[k];
    const g2 = gambe[k + 1];
    const b1 = velocitaRilevamento(misure, { da: g1.da + margine, a: g1.a });
    const b2 = velocitaRilevamento(misure, { da: g2.da + margine, a: g2.a });
    if (!b1 || !b2 || b1.n < minimo || b2.n < minimo) continue;
    const e = distanzaEkelund(
      { ...b1, soa: velocitaTrasversale(g1.rotta, g1.velocita, b1.rilevamento) },
      { ...b2, soa: velocitaTrasversale(g2.rotta, g2.velocita, b2.rilevamento) },
    );
    out.push({ da: g1, a: g2, ...e });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Forme della soluzione
// ---------------------------------------------------------------------------

/**
 * Dalla forma polare del protocollo allo stato cartesiano.
 * @param {SoluzionePolare} s
 * @param {{x: number, y: number}} proprio  posizione propria all'ora della soluzione
 * @returns {StatoCartesiano}
 */
export function daPolare(s, proprio) {
  const b = s.rilevamento * RAD;
  const c = s.rotta * RAD;
  const v = s.velocita * NODO_MS;
  return {
    ora: s.ora,
    x: proprio.x + s.distanza * Math.sin(b),
    y: proprio.y + s.distanza * Math.cos(b),
    vx: v * Math.sin(c),
    vy: v * Math.cos(c),
  };
}

/**
 * Dallo stato cartesiano alla forma polare, vista da `proprio`.
 * @param {StatoCartesiano} s
 * @param {{x: number, y: number}} proprio
 * @returns {SoluzionePolare}
 */
export function inPolare(s, proprio) {
  const v = Math.hypot(s.vx, s.vy);
  return {
    ora: s.ora,
    rilevamento: rilevamentoDa(proprio.x, proprio.y, s.x, s.y),
    distanza: Math.hypot(s.x - proprio.x, s.y - proprio.y),
    rotta: v === 0 ? 0 : norm360(Math.atan2(s.vx, s.vy) * GRADI),
    velocita: v / NODO_MS,
  };
}

/**
 * Lo stato portato a un'altra ora (moto rettilineo uniforme).
 * @param {StatoCartesiano} s
 * @param {number} ora
 * @returns {StatoCartesiano}
 */
export function avanzaStato(s, ora) {
  const dt = ora - s.ora;
  return { ora, x: s.x + s.vx * dt, y: s.y + s.vy * dt, vx: s.vx, vy: s.vy };
}

/**
 * Il rilevamento che una soluzione prevede per una misura (gradi).
 * @param {StatoCartesiano} s
 * @param {{ora: number, x: number, y: number}} m
 */
export function rilevamentoPrevisto(s, m) {
  const dt = m.ora - s.ora;
  return rilevamentoDa(m.x, m.y, s.x + s.vx * dt, s.y + s.vy * dt);
}

// ---------------------------------------------------------------------------
// Residui (MATE)
// ---------------------------------------------------------------------------

/**
 * Residui di una soluzione di prova (il MATE: il comandante regola distanza,
 * rotta e velocita' finche' i punti non si allineano sullo zero). Una pendenza
 * dei residui dentro una gamba dice che rotta o velocita' sono sbagliate; un
 * salto fra una gamba e l'altra dice che la distanza e' sbagliata.
 * @param {Misura[]} misure
 * @param {StatoCartesiano} prova
 * @param {{gambe?: {da: number, a: number}[]}} [o]
 * @returns {{punti: {ora: number, residuo: number, normalizzato: number}[], rms: number, chi2: number,
 *   gambe: {da: number, a: number, n: number, media: number, pendenza: number}[]}}
 *   residuo = misurato − previsto, gradi; pendenza in gradi al minuto
 */
export function residuiMATE(misure, prova, o = {}) {
  const punti = misure.map((m) => {
    const r = norm180(m.rilevamento - rilevamentoPrevisto(prova, m));
    return { ora: m.ora, residuo: r, normalizzato: r / m.sigma };
  });
  let q = 0; let c = 0;
  for (const p of punti) { q += p.residuo * p.residuo; c += p.normalizzato * p.normalizzato; }
  const gambe = (o.gambe ?? []).map((g) => {
    const sel = punti.filter((p) => p.ora >= g.da && p.ora <= g.a);
    if (sel.length === 0) return { da: g.da, a: g.a, n: 0, media: 0, pendenza: 0 };
    let st = 0; let sr = 0;
    for (const p of sel) { st += p.ora; sr += p.residuo; }
    const tm = st / sel.length;
    const media = sr / sel.length;
    let stt = 0; let str = 0;
    for (const p of sel) { stt += (p.ora - tm) ** 2; str += (p.ora - tm) * (p.residuo - media); }
    return { da: g.da, a: g.a, n: sel.length, media, pendenza: stt > 0 ? (str / stt) * 60 : 0 };
  });
  const n = Math.max(1, punti.length);
  return { punti, rms: Math.sqrt(q / n), chi2: c / n, gambe };
}

// ---------------------------------------------------------------------------
// Stimatore a massima verosimiglianza
// ---------------------------------------------------------------------------

/**
 * Riga dello jacobiano del rilevamento (radianti) rispetto a (x, y, vx, vy)
 * all'ora t0; restituisce il rilevamento previsto (radianti).
 * @param {number[]} s @param {Misura | {ora: number, x: number, y: number}} m
 * @param {number} t0 @param {number[]} j  uscita, 4
 */
function riga(s, m, t0, j) {
  const tau = m.ora - t0;
  const dx = s[0] + s[2] * tau - m.x;
  const dy = s[1] + s[3] * tau - m.y;
  const r2 = Math.max(dx * dx + dy * dy, 1);
  const a = dy / r2;
  const b = -dx / r2;
  j[0] = a; j[1] = b; j[2] = a * tau; j[3] = b * tau;
  return Math.atan2(dx, dy);
}

/**
 * I vincoli deboli dello stimatore: il priore sulla velocita' (peso w = 1/σv²)
 * e la barriera della distanza minima (sotto `rmin` dal riferimento, all'ora
 * della stima, il costo cresce come ((rmin − R)/sb)²); `cauchy` > 0 rende
 * robusto il costo delle misure: ρ(z) = c²·ln(1 + (z/c)²) al posto di z².
 * @typedef {{w: number, rif: {x: number, y: number}, rmin: number, sb: number, cauchy: number}} Vincoli
 */

/**
 * Costo (somma dei residui normalizzati al quadrato, piu' i vincoli).
 * @param {number[]} s @param {Misura[]} misure @param {number} t0 @param {Vincoli} v
 */
function costo(s, misure, t0, v) {
  let c = 0;
  const k = v.cauchy;
  for (const m of misure) {
    const tau = m.ora - t0;
    const r = normPi(m.rilevamento * RAD - Math.atan2(s[0] + s[2] * tau - m.x, s[1] + s[3] * tau - m.y));
    const z = r / (m.sigma * RAD);
    c += k > 0 ? k * k * Math.log1p((z / k) ** 2) : z * z;
  }
  c += v.w * (s[2] * s[2] + s[3] * s[3]);
  if (v.rmin > 0) {
    const R = Math.hypot(s[0] - v.rif.x, s[1] - v.rif.y);
    if (R < v.rmin) c += ((v.rmin - R) / v.sb) ** 2;
  }
  return c;
}

/**
 * Aggiunge i vincoli alle equazioni normali.
 * @param {number[]} A @param {number[]} g @param {number[]} s @param {Vincoli} v
 */
function vincola(A, g, s, v) {
  A[10] += v.w; A[15] += v.w;
  g[2] -= v.w * s[2]; g[3] -= v.w * s[3];
  if (v.rmin > 0) {
    const dx = s[0] - v.rif.x;
    const dy = s[1] - v.rif.y;
    const R = Math.max(1e-6, Math.hypot(dx, dy));
    if (R < v.rmin) {
      const jx = dx / R / v.sb;
      const jy = dy / R / v.sb;
      const r = (v.rmin - R) / v.sb;
      A[0] += jx * jx; A[1] += jx * jy; A[4] += jx * jy; A[5] += jy * jy;
      g[0] += jx * r; g[1] += jy * r;
    }
  }
}

/**
 * Matrice d'informazione JᵀWJ (4×4) e gradiente JᵀWr. Con `cauchy` > 0 i pesi
 * sono quelli del costo robusto nello stato s (IRLS): 1/(1 + (z/c)²).
 * @param {number[]} s @param {Misura[]} misure @param {number} t0
 * @param {boolean} conResidui
 * @param {number} [cauchy]
 */
function informazione(s, misure, t0, conResidui, cauchy = 0) {
  const A = new Array(16).fill(0);
  const g = [0, 0, 0, 0];
  const j = [0, 0, 0, 0];
  for (const m of misure) {
    const h = riga(s, m, t0, j);
    let w = 1 / ((m.sigma * RAD) ** 2);
    const rr = normPi(m.rilevamento * RAD - h);
    if (cauchy > 0) w /= 1 + (rr / (m.sigma * RAD) / cauchy) ** 2;
    const r = conResidui ? rr : 0;
    for (let a = 0; a < 4; a++) {
      g[a] += j[a] * w * r;
      for (let b = a; b < 4; b++) A[a * 4 + b] += j[a] * w * j[b];
    }
  }
  for (let a = 0; a < 4; a++) for (let b = 0; b < a; b++) A[a * 4 + b] = A[b * 4 + a];
  return { A, g };
}

/**
 * Levenberg-Marquardt da una partenza.
 * @param {number[]} s0 @param {Misura[]} misure @param {number} t0 @param {Vincoli} v
 * @param {number} itMax
 */
function lm(s0, misure, t0, v, itMax) {
  let s = s0.slice();
  let c = costo(s, misure, t0, v);
  let lambda = 1e-3;
  let it = 0;
  for (; it < itMax; it++) {
    const { A, g } = informazione(s, misure, t0, true, v.cauchy);
    vincola(A, g, s, v);
    let migliorato = false;
    for (let tent = 0; tent < 12; tent++) {
      const B = A.slice();
      for (let k = 0; k < 4; k++) B[k * 5] += lambda * (A[k * 5] + 1e-12 * (A[0] + A[5]) + 1e-9);
      const d = risolvi(B, g, 4);
      if (!d) { lambda *= 10; continue; }
      const sn = [s[0] + d[0], s[1] + d[1], s[2] + d[2], s[3] + d[3]];
      const cn = costo(sn, misure, t0, v);
      if (cn < c) {
        const relativo = (c - cn) / Math.max(c, 1e-12);
        s = sn; c = cn;
        lambda = Math.max(lambda / 3, 1e-9);
        migliorato = true;
        if (relativo < 1e-10) it = itMax;
        break;
      }
      lambda *= 4;
    }
    if (!migliorato) break;
  }
  return { s, c, it };
}

/**
 * Il costo minimo con la distanza dal riferimento fissata a R all'ora t0
 * (Levenberg-Marquardt su rilevamento e velocita'), per il profilo.
 * @param {number} R @param {number[]} q0  partenza [rilevamento (rad), vx, vy] @param {Misura[]} misure
 * @param {number} t0 @param {{x: number, y: number}} rif @param {Vincoli} v
 * @returns {{c: number, q: number[]}}
 */
function costoAdistanza(R, q0, misure, t0, rif, v) {
  const stato = (/** @type {number[]} */ q) => [rif.x + R * Math.sin(q[0]), rif.y + R * Math.cos(q[0]), q[1], q[2]];
  const wPriore = v.w;
  let q = q0.slice();
  let c = costo(stato(q), misure, t0, v);
  let lambda = 1e-3;
  const j = [0, 0, 0, 0];
  for (let it = 0; it < 30; it++) {
    const st = stato(q);
    const A = new Array(9).fill(0);
    const g = [0, 0, 0];
    const cb = R * Math.cos(q[0]);
    const sb = -R * Math.sin(q[0]);
    for (const m of misure) {
      const h = riga(st, m, t0, j);
      let w = 1 / ((m.sigma * RAD) ** 2);
      const r = normPi(m.rilevamento * RAD - h);
      if (v.cauchy > 0) w /= 1 + (r / (m.sigma * RAD) / v.cauchy) ** 2;
      const jj = [j[0] * cb + j[1] * sb, j[2], j[3]];
      for (let a = 0; a < 3; a++) {
        g[a] += jj[a] * w * r;
        for (let b = 0; b < 3; b++) A[a * 3 + b] += jj[a] * w * jj[b];
      }
    }
    A[4] += wPriore; A[8] += wPriore;
    g[1] -= wPriore * q[1]; g[2] -= wPriore * q[2];
    let fatto = false;
    for (let tent = 0; tent < 10; tent++) {
      const B = A.slice();
      for (let a = 0; a < 3; a++) B[a * 4] += lambda * (A[a * 4] + 1e-9);
      const d = risolvi(B, g, 3);
      if (!d) { lambda *= 10; continue; }
      const qn = [q[0] + d[0], q[1] + d[1], q[2] + d[2]];
      const cn = costo(stato(qn), misure, t0, v);
      if (cn < c) {
        const rel = (c - cn) / Math.max(c, 1e-12);
        q = qn; c = cn; lambda = Math.max(lambda / 3, 1e-9); fatto = true;
        if (rel < 1e-8) it = 30;
        break;
      }
      lambda *= 4;
    }
    if (!fatto) break;
  }
  return { c, q };
}

/**
 * Semiampiezza (m) dell'intervallo a 1σ del profilo di verosimiglianza della
 * distanza: la piu' grande fra |R± − R̂| con Δχ²(R±) = 1, cercate a passi
 * geometrici a partire da 1σ lineare e poi per bisezione. Infinity se da una
 * parte il costo non cresce di 1 neanche a 8 volte (o un ottavo) la distanza.
 * @param {number[]} s @param {number} c0 @param {number} scala  χ² ridotto (≥ 1)
 * @param {number} R0 @param {number} sR  σ lineare
 * @param {Misura[]} misure @param {number} t0 @param {{x: number, y: number}} rif @param {Vincoli} v
 */
function intervalloProfilo(s, c0, scala, R0, sR, misure, t0, rif, v) {
  const vs = velocitaSensore(misure);
  const b0 = Math.atan2(s[0] - rif.x, s[1] - rif.y);
  let massimo = 0;
  for (const verso of [1, -1]) {
    const passo = 1 + Math.min(1, Math.max(0.03, sR / Math.max(R0, 1)));
    // partenza: il moto relativo scala con la distanza
    const partenza = (/** @type {number} */ k) => [b0, vs.vx + k * (s[2] - vs.vx), vs.vy + k * (s[3] - vs.vy)];
    let kIn = 1;
    let kOut = 1;
    let q = partenza(1);
    let trovato = false;
    for (let i = 1; i <= 40; i++) {
      kOut = verso > 0 ? passo ** i : passo ** -i;
      if (kOut > 8 || kOut < 1 / 8) break;
      const r = costoAdistanza(R0 * kOut, i === 1 ? partenza(kOut) : [q[0], vs.vx + (kOut / kIn) * (q[1] - vs.vx), vs.vy + (kOut / kIn) * (q[2] - vs.vy)], misure, t0, rif, v);
      if ((r.c - c0) / scala >= 1) { trovato = true; break; }
      kIn = kOut;
      q = r.q;
    }
    if (!trovato) return Infinity;
    for (let i = 0; i < 4; i++) {
      const km = Math.sqrt(kIn * kOut);
      const r = costoAdistanza(R0 * km, [q[0], vs.vx + (km / kIn) * (q[1] - vs.vx), vs.vy + (km / kIn) * (q[2] - vs.vy)], misure, t0, rif, v);
      if ((r.c - c0) / scala >= 1) kOut = km; else { kIn = km; q = r.q; }
    }
    massimo = Math.max(massimo, Math.abs(Math.sqrt(kIn * kOut) - 1) * R0);
  }
  return massimo;
}

/**
 * Stima della velocita' propria (del sensore) dalle posizioni delle misure
 * recenti: serve solo alle partenze dello stimatore.
 * @param {Misura[]} misure
 */
function velocitaSensore(misure) {
  const n = misure.length;
  const ultimo = misure[n - 1];
  let i = n - 1;
  while (i > 0 && ultimo.ora - misure[i - 1].ora < 120) i--;
  const primo = misure[i];
  const dt = ultimo.ora - primo.ora;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (ultimo.x - primo.x) / dt, vy: (ultimo.y - primo.y) / dt };
}

/**
 * Stimatore pseudo-lineare (PLE): ogni rilevamento dice che il bersaglio sta
 * sulla sua retta, condizione lineare nello stato. Distorto, ma una buona
 * partenza quando la geometria e' osservabile.
 * @param {Misura[]} misure @param {number} t0
 */
function pseudoLineare(misure, t0) {
  const A = new Array(16).fill(0);
  const b = [0, 0, 0, 0];
  for (const m of misure) {
    const c = Math.cos(m.rilevamento * RAD);
    const s = Math.sin(m.rilevamento * RAD);
    const tau = m.ora - t0;
    const h = [c, -s, c * tau, -s * tau];
    const z = m.x * c - m.y * s;
    const w = 1 / (m.sigma * m.sigma);
    for (let i = 0; i < 4; i++) {
      b[i] += h[i] * w * z;
      for (let j = 0; j < 4; j++) A[i * 4 + j] += h[i] * w * h[j];
    }
  }
  return risolvi(A, b, 4);
}

/**
 * Scarto massimo (m) delle posizioni del sensore dalla retta a velocita'
 * costante che meglio le approssima: zero vuol dire «nessuna manovra».
 * @param {{ora: number, x: number, y: number}[]} punti
 */
export function scartoDallaRetta(punti) {
  const n = punti.length;
  if (n < 3) return 0;
  let st = 0; let sx = 0; let sy = 0;
  for (const p of punti) { st += p.ora; sx += p.x; sy += p.y; }
  const tm = st / n; const xm = sx / n; const ym = sy / n;
  let stt = 0; let stx = 0; let sty = 0;
  for (const p of punti) { const d = p.ora - tm; stt += d * d; stx += d * (p.x - xm); sty += d * (p.y - ym); }
  const vx = stt > 0 ? stx / stt : 0;
  const vy = stt > 0 ? sty / stt : 0;
  let max = 0;
  for (const p of punti) {
    const d = p.ora - tm;
    max = Math.max(max, Math.hypot(p.x - xm - vx * d, p.y - ym - vy * d));
  }
  return max;
}

/**
 * Le grandezze derivate di uno stato con la sua covarianza.
 * @param {number[]} s  [x, y, vx, vy]
 * @param {number[] | null} P
 * @param {{x: number, y: number}} rif
 */
function derivate(s, P, rif) {
  const dx = s[0] - rif.x;
  const dy = s[1] - rif.y;
  const R = Math.hypot(dx, dy);
  const V = Math.hypot(s[2], s[3]);
  if (!P) {
    return { R, V, sigmaDistanza: Infinity, sigmaRotta: Infinity, sigmaVelocita: Infinity, ellisse: null };
  }
  const ux = dx / Math.max(R, 1e-9);
  const uy = dy / Math.max(R, 1e-9);
  const sR2 = ux * ux * P[0] + 2 * ux * uy * P[1] + uy * uy * P[5];
  // Velocita': lungo il moto e trasversale (con una direzione qualunque se ferma).
  const ax = V > 1e-6 ? s[2] / V : 0;
  const ay = V > 1e-6 ? s[3] / V : 1;
  const sA2 = ax * ax * P[10] + 2 * ax * ay * P[11] + ay * ay * P[15];
  const cx = ay; const cy = -ax;
  const sC2 = cx * cx * P[10] + 2 * cx * cy * P[11] + cy * cy * P[15];
  return {
    R,
    V,
    sigmaDistanza: Math.sqrt(Math.max(0, sR2)),
    sigmaRotta: Math.sqrt(Math.max(0, sC2)) / Math.max(V, V_RIF_ROTTA) * GRADI,
    sigmaVelocita: Math.sqrt(Math.max(0, sA2)) / NODO_MS,
    ellisse: ellisse(P[0], P[1], P[5]),
  };
}

/**
 * Qualita' Q della soluzione, 0-100 (definizione nell'intestazione).
 * @param {{distanza: number, sigmaDistanza: number, sigmaRotta: number, sigmaVelocita: number}} s
 *   m, m, gradi, nodi
 * @returns {number} intero
 */
export function qualita(s) {
  if (![s.sigmaDistanza, s.sigmaRotta, s.sigmaVelocita].every(Number.isFinite) || !(s.distanza > 0)) return 0;
  const e = (s.sigmaDistanza / (0.1 * s.distanza)) ** 2 + (s.sigmaRotta / 20) ** 2 + (s.sigmaVelocita / 3) ** 2;
  return Math.round(100 * Math.exp(-e / 3));
}

/**
 * Ellisse d'incertezza al 90 % da una covarianza di posizione 2×2.
 * @param {number} pxx m² @param {number} pxy @param {number} pyy
 * @param {number} [k]  semiassi a k·σ (predefinito K_ELLISSE)
 * @returns {Ellisse | null}
 */
export function ellisse(pxx, pxy, pyy, k = K_ELLISSE) {
  if (![pxx, pxy, pyy].every(Number.isFinite)) return null;
  const m = (pxx + pyy) / 2;
  const d = Math.sqrt(((pxx - pyy) / 2) ** 2 + pxy * pxy);
  const l1 = Math.max(0, m + d);
  const l2 = Math.max(0, m - d);
  // Angolo matematico (da est, antiorario) dell'asse maggiore → rilevamento.
  const th = 0.5 * Math.atan2(2 * pxy, pxx - pyy) * GRADI;
  let orientamento = norm360(90 - th);
  if (orientamento >= 180) orientamento -= 180;
  return { asse_lungo: k * Math.sqrt(l1), asse_corto: k * Math.sqrt(l2), orientamento };
}

/**
 * Stato iniziale plausibile a distanza R sul rilevamento di riferimento, con
 * la velocita' che spiega il bearing rate (velocita' radiale relativa nulla).
 * @param {number} R @param {{rilevamento: number, variazione: number}} br
 * @param {{x: number, y: number}} rif @param {{vx: number, vy: number}} vs
 */
function partenza(R, br, rif, vs) {
  const b = br.rilevamento * RAD;
  const rate = br.variazione * RAD / 60;
  // n = perpendicolare oraria alla linea di vista
  return [
    rif.x + R * Math.sin(b), rif.y + R * Math.cos(b),
    vs.vx + R * rate * Math.cos(b), vs.vy - R * rate * Math.sin(b),
  ];
}

/**
 * Stimatore a massima verosimiglianza sui soli rilevamenti: minimizza
 * Σ((β_i − h_i(s))/σ_i)² sullo stato s = (x, y, vx, vy) all'ora `ora` con
 * Levenberg-Marquardt da piu' partenze (pseudo-lineare, distanze di
 * DISTANZE_PARTENZA, soluzione precedente), e restituisce la migliore con la
 * covarianza (JᵀWJ)⁻¹ gonfiata del χ² ridotto quando supera 1.
 *
 * Con `sigmaVelocitaPriore` (predefinito per l'equipaggio: 15 kt) si aggiunge
 * un priore gaussiano debole sulla velocita' del bersaglio: non sposta una
 * soluzione ben determinata, ma tiene finita quella di una geometria senza
 * manovra (che resta con Q bassa e `osservabile: false`). `null` = stima pura
 * (le prove contro il limite di Cramér-Rao).
 *
 * @param {Misura[]} misure  almeno 4, in ordine di tempo
 * @param {object} [o]
 * @param {number} [o.ora]  ora della stima (predefinita: l'ultima misura)
 * @param {{x: number, y: number}} [o.riferimento]  posizione propria a `ora` (predefinita: il
 *   sensore dell'ultima misura): da qui si misurano distanza e rilevamento
 * @param {StatoCartesiano | null} [o.iniziale]  partenza in piu' (la stima precedente)
 * @param {boolean} [o.multipla]  anche le partenze di DISTANZE_PARTENZA (predefinito vero)
 * @param {number | null} [o.sigmaVelocitaPriore]  m/s per componente; null = nessun priore
 * @param {number} [o.iterazioni]  massimo per partenza (40)
 * @param {boolean} [o.robusta]  costo robusto di Cauchy (c = 2,385, efficienza del 95 % su misure
 *   gaussiane): una misura sbagliata (due bersagli che si scambiano la traccia, un picco di rumore)
 *   conta come pochi punti, non come centinaia. L'equipaggio la usa; la stima pura (prove contro
 *   Cramér-Rao) no. Predefinito falso
 * @param {number} [o.distanzaMinima]  m: barriera morbida (σ = un decimo) sotto cui la stima non
 *   scende. Le soluzioni «a ridosso», che si muovono col proprio battello, spiegano bene pochi
 *   rilevamenti sbagliati; un contatto passivo tenuto per minuti non e' a poche centinaia di metri.
 *   L'equipaggio usa DISTANZA_MINIMA_EQUIPAGGIO; predefinito 0 (nessuna)
 * @param {boolean | number} [o.profilo]  vero (predefinito): l'intervallo di profilo della distanza
 *   (costoso); un numero: il fattore di covarianza di un profilo calcolato prima, applicato senza
 *   ricalcolarlo; falso: niente profilo
 * @returns {Stima | null}  null con meno di 4 misure
 */
export function stimaMV(misure, o = {}) {
  const n = misure.length;
  if (n < 4) return null;
  const ultimo = misure[n - 1];
  const t0 = o.ora ?? ultimo.ora;
  const rif = o.riferimento ?? { x: ultimo.x, y: ultimo.y };
  const sp = o.sigmaVelocitaPriore === undefined ? SIGMA_VELOCITA_PRIORE : o.sigmaVelocitaPriore;
  const wPriore = sp === null ? 0 : 1 / (sp * sp);
  const rmin = o.distanzaMinima ?? 0;
  /** @type {Vincoli} */
  const vinc = { w: wPriore, rif, rmin, sb: rmin / 10, cauchy: o.robusta ? CAUCHY : 0 };
  const itMax = o.iterazioni ?? 40;

  /** @type {number[][]} */
  const partenze = [];
  if (o.iniziale) {
    const s = avanzaStato(o.iniziale, t0);
    partenze.push([s.x, s.y, s.vx, s.vy]);
  }
  if (o.multipla !== false || partenze.length === 0) {
    const durata = ultimo.ora - misure[0].ora;
    const br = velocitaRilevamento(misure, { da: ultimo.ora - Math.max(60, durata / 4) })
      ?? velocitaRilevamento(misure) ?? { rilevamento: ultimo.rilevamento, variazione: 0 };
    const brT0 = { rilevamento: norm360(br.rilevamento + br.variazione / 60 * (t0 - ('ora' in br ? br.ora : ultimo.ora))), variazione: br.variazione };
    const vs = velocitaSensore(misure);
    for (const R of DISTANZE_PARTENZA) partenze.push(partenza(R, brT0, rif, vs));
    const ple = pseudoLineare(misure, t0);
    if (ple && ple.every(Number.isFinite)) partenze.push(ple);
  }

  let migliore = { s: partenze[0], c: Infinity, it: 0 };
  let iterazioni = 0;
  for (const s0 of partenze) {
    const r = lm(s0, misure, t0, vinc, itMax);
    iterazioni += r.it;
    if (r.c < migliore.c) migliore = r;
  }
  const s = migliore.s;
  const datiSoli = informazione(s, misure, t0, false, vinc.cauchy).A;
  const A = datiSoli.slice();
  A[10] += wPriore; A[15] += wPriore;
  let P = inversa4(A);
  const chi2 = migliore.c / Math.max(1, n - 4);
  if (P && chi2 > 1) P = P.map((v) => v * chi2);
  // Verosimiglianza di profilo sulla distanza: la covarianza lineare,
  // calcolata nella stima, sottovaluta l'incertezza quando la funzione costo
  // e' asimmetrica o piatta lungo la linea di vista (geometria debole, misure
  // con un errore sistematico) e la stima e' caduta dove la curvatura e'
  // grande. Si cercano, rifacendo la stima con la distanza fissata, le
  // distanze dove il costo cresce di 1 (Δχ² normalizzato al χ² ridotto quando
  // supera 1): l'intervallo a 1σ del profilo. Se e' piu' largo di quello
  // lineare, la covarianza si gonfia di conseguenza.
  let fattoreProfilo = 1;
  if (P && typeof o.profilo === 'number') {
    fattoreProfilo = Math.max(1, o.profilo);
    P = P.map((v) => v * fattoreProfilo);
  } else if (P && o.profilo !== false) {
    const R0 = Math.hypot(s[0] - rif.x, s[1] - rif.y);
    const sR = derivate(s, P, rif).sigmaDistanza;
    const sp = intervalloProfilo(s, migliore.c, Math.max(1, chi2), R0, sR, misure, t0, rif, vinc);
    if (!Number.isFinite(sp)) { P = null; fattoreProfilo = Infinity; } else if (sp > sR && sR > 0) {
      fattoreProfilo = (sp / sR) ** 2;
      P = P.map((v) => v * fattoreProfilo);
    }
  }
  let rmsq = 0;
  for (const m of misure) {
    const r = norm180(m.rilevamento - rilevamentoPrevisto({ ora: t0, x: s[0], y: s[1], vx: s[2], vy: s[3] }, m));
    rmsq += r * r;
  }
  const d = derivate(s, P, rif);

  // Osservabilita': manovra propria e informazione dei soli dati.
  const scarto = scartoDallaRetta(misure);
  const Pdati = inversa4(datiSoli);
  const sRdati = Pdati ? derivate(s, Pdati, rif).sigmaDistanza : Infinity;
  /** @type {string | null} */
  let motivo = null;
  if (scarto < SCARTO_MANOVRA_MIN) motivo = 'nessuna_manovra';
  else if (!(sRdati <= d.R)) motivo = 'geometria_debole';
  const osservabile = motivo === null;
  const q = osservabile ? qualita({ distanza: d.R, sigmaDistanza: d.sigmaDistanza, sigmaRotta: d.sigmaRotta, sigmaVelocita: d.sigmaVelocita }) : 0;
  const polare = inPolare({ ora: t0, x: s[0], y: s[1], vx: s[2], vy: s[3] }, rif);
  return {
    ora: t0, x: s[0], y: s[1], vx: s[2], vy: s[3],
    covarianza: P ?? new Array(16).fill(Infinity),
    riferimento: { x: rif.x, y: rif.y },
    distanza: d.R,
    rilevamento: polare.rilevamento,
    rotta: polare.rotta,
    velocita: polare.velocita,
    sigmaDistanza: d.sigmaDistanza,
    sigmaRotta: d.sigmaRotta,
    sigmaVelocita: d.sigmaVelocita,
    ellisse: d.ellisse,
    q,
    osservabile,
    motivo,
    chi2,
    rms: Math.sqrt(rmsq / n),
    n,
    iterazioni,
    fattoreProfilo,
  };
}

/**
 * La stima portata a un'altra ora: stato in moto rettilineo, covarianza
 * propagata (P' = F·P·Fᵀ, senza rumore di processo: l'incertezza di posizione
 * cresce con σV·Δt, 06_tma.md §6), grandezze ricalcolate da `riferimento`.
 * @param {Stima} st
 * @param {number} ora
 * @param {{x: number, y: number}} [riferimento]  posizione propria a `ora` (predefinita quella della stima)
 * @returns {Stima}
 */
export function propaga(st, ora, riferimento = st.riferimento) {
  const dt = ora - st.ora;
  const s = [st.x + st.vx * dt, st.y + st.vy * dt, st.vx, st.vy];
  const P0 = st.covarianza;
  /** @type {number[] | null} */
  let P = null;
  if (P0.every(Number.isFinite)) {
    // F = [[I, dt·I], [0, I]]
    const F = [1, 0, dt, 0, 0, 1, 0, dt, 0, 0, 1, 0, 0, 0, 0, 1];
    const FP = new Array(16).fill(0);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) FP[i * 4 + j] += F[i * 4 + k] * P0[k * 4 + j];
    P = new Array(16).fill(0);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) P[i * 4 + j] += FP[i * 4 + k] * F[j * 4 + k];
  }
  const d = derivate(s, P, riferimento);
  const q = st.osservabile ? qualita({ distanza: d.R, sigmaDistanza: d.sigmaDistanza, sigmaRotta: d.sigmaRotta, sigmaVelocita: d.sigmaVelocita }) : 0;
  const polare = inPolare({ ora, x: s[0], y: s[1], vx: s[2], vy: s[3] }, riferimento);
  return {
    ...st,
    ora, x: s[0], y: s[1],
    covarianza: P ?? st.covarianza,
    riferimento: { x: riferimento.x, y: riferimento.y },
    distanza: d.R,
    rilevamento: polare.rilevamento,
    sigmaDistanza: d.sigmaDistanza,
    sigmaRotta: d.sigmaRotta,
    sigmaVelocita: d.sigmaVelocita,
    ellisse: d.ellisse,
    q,
  };
}

// ---------------------------------------------------------------------------
// Limite di Cramér-Rao, osservabilita', consiglio di manovra
// ---------------------------------------------------------------------------

/**
 * Limite inferiore di Cramér-Rao per una geometria: l'inversa della matrice
 * d'informazione di Fisher Σ JᵢJᵢᵀ/σᵢ² calcolata nello stato VERO. Non
 * dipende dai rilevamenti misurati (`rilevamento` delle misure e' ignorato):
 * e' il miglior errore che uno stimatore non distorto puo' ottenere.
 * @param {{ora: number, x: number, y: number, sigma: number}[]} misure
 * @param {StatoCartesiano} vero  lo stato vero all'ora in cui si vuole il limite
 * @param {{riferimento?: {x: number, y: number}}} [o]  posizione propria a `vero.ora`
 *   (predefinita: il sensore della misura piu' vicina nel tempo)
 * @returns {{osservabile: boolean, distanza: number, sigmaDistanza: number, sigmaRotta: number,
 *   sigmaVelocita: number, relativa: number, q: number, covarianza: number[] | null}}
 *   `relativa` = σR/R
 */
export function limiteCramerRao(misure, vero, o = {}) {
  const s = [vero.x, vero.y, vero.vx, vero.vy];
  let rif = o.riferimento;
  if (!rif) {
    let m0 = misure[0];
    for (const m of misure) if (Math.abs(m.ora - vero.ora) < Math.abs(m0.ora - vero.ora)) m0 = m;
    rif = { x: m0.x, y: m0.y };
  }
  const { A } = informazione(s, /** @type {Misura[]} */ (misure), vero.ora, false);
  const P = inversa4(A);
  const d = derivate(s, P, rif);
  return {
    osservabile: P !== null && Number.isFinite(d.sigmaDistanza),
    distanza: d.R,
    sigmaDistanza: d.sigmaDistanza,
    sigmaRotta: d.sigmaRotta,
    sigmaVelocita: d.sigmaVelocita,
    relativa: d.sigmaDistanza / d.R,
    q: qualita({ distanza: d.R, sigmaDistanza: d.sigmaDistanza, sigmaRotta: d.sigmaRotta, sigmaVelocita: d.sigmaVelocita }),
    covarianza: P,
  };
}

/**
 * La distanza e' osservabile con queste misure? Due controlli:
 *  1. manovra propria: se le posizioni del sensore stanno su una retta
 *     percorsa a velocita' costante (scarto < 25 m) la distanza NON e'
 *     osservabile, per quanti rilevamenti si raccolgano (NAVOPS-11 Thm 11.4,
 *     Nardone-Lindgren-Gong 1984): motivo 'nessuna_manovra';
 *  2. con una stima (o un'ipotesi) del bersaglio, il limite di Cramér-Rao
 *     della distanza: oltre il 100 % la geometria e' troppo debole
 *     ('geometria_debole').
 * @param {Misura[]} misure
 * @param {{stato?: StatoCartesiano, riferimento?: {x: number, y: number}}} [o]
 * @returns {{osservabile: boolean, motivo: string | null, scarto: number, relativa: number}}
 *   `scarto` m dalla retta; `relativa` σR/R del limite (Infinity senza stato)
 */
export function osservabilita(misure, o = {}) {
  const scarto = scartoDallaRetta(misure);
  if (scarto < SCARTO_MANOVRA_MIN) return { osservabile: false, motivo: 'nessuna_manovra', scarto, relativa: Infinity };
  if (!o.stato) return { osservabile: true, motivo: null, scarto, relativa: Infinity };
  const crlb = limiteCramerRao(misure, o.stato, { riferimento: o.riferimento });
  const ok = crlb.relativa <= 1;
  return { osservabile: ok, motivo: ok ? null : 'geometria_debole', scarto, relativa: crlb.relativa };
}

/**
 * Il consiglio di manovra dell'equipaggio («accosti di 90° a sinistra per 6
 * minuti»): fra le accostate candidate e le durate della gamba nuova sceglie
 * quella che porta prima il limite di Cramér-Rao della distanza sotto
 * l'obiettivo (o, se nessuna ci arriva, quella che ci va piu' vicino), media
 * sulle ipotesi di bersaglio. Le misure future si simulano ogni `periodo` s
 * con la σ che il sensore avrebbe a quel rilevamento relativo (callback: il
 * cono cieco della rimorchiata, i baffles della sfera e l'endfire li conosce
 * l'equipaggio), e nessuna misura per `tempoMorto` s dopo l'accostata.
 * @param {object} a
 * @param {Misura[]} a.misure  la storia (compressa) gia' raccolta
 * @param {StatoCartesiano[]} a.ipotesi  bersagli possibili, all'ora attuale
 * @param {{ora: number, x: number, y: number, rotta: number, velocita: number}} a.proprio  nodi
 * @param {(relativo: number) => number} [a.sigma]  σ in gradi per rilevamento relativo con segno
 *   (Infinity = cieco); predefinita la mediana delle σ della storia
 * @param {number} [a.periodo]  s (30)
 * @param {number} [a.tempoMorto]  s (0)
 * @param {number} [a.velocitaAccostata]  velocita' d'accostata propria, gradi al secondo (1)
 * @param {number[]} [a.accostate]  gradi con segno, negativo = a sinistra
 * @param {number[]} [a.minuti]  durate candidate della gamba nuova
 * @param {number} [a.obiettivo]  σR/R voluta (0,10)
 * @returns {{accostata: number, lato: 'sinistra' | 'dritta' | null, rotta: number, minuti: number,
 *   relativa: number, senzaManovra: number}}  `relativa` = σR/R previsto alla fine;
 *   `senzaManovra` = lo stesso tirando dritto (per confronto)
 */
export function consiglioManovra(a) {
  const periodo = a.periodo ?? 30;
  const tm = a.tempoMorto ?? 0;
  const wAcc = a.velocitaAccostata ?? 1;
  const accostate = a.accostate ?? [-150, -120, -90, -60, -30, 30, 60, 90, 120, 150];
  const durate = a.minuti ?? [3, 4, 6, 8, 10];
  const obiettivo = a.obiettivo ?? 0.10;
  const sigme = a.misure.map((m) => m.sigma).sort((x, y) => x - y);
  const sigmaFissa = sigme.length ? sigme[Math.floor(sigme.length / 2)] : 1;
  const sigmaDi = a.sigma ?? (() => sigmaFissa);
  const v = a.proprio.velocita * NODO_MS;

  // Informazione gia' raccolta, per ogni ipotesi (all'ora attuale).
  const base = a.ipotesi.map((h) => {
    const s0 = avanzaStato(h, a.proprio.ora);
    return { s: [s0.x, s0.y, s0.vx, s0.vy], A: informazione([s0.x, s0.y, s0.vx, s0.vy], a.misure, a.proprio.ora, false).A };
  });

  /**
   * σR/R medio (sulle ipotesi, in scala logaritmica) alla fine di una gamba.
   * @param {number} accostata @param {number} minuti
   */
  const valuta = (accostata, minuti) => {
    const rotta = a.proprio.rotta + accostata;
    const durataAcc = Math.abs(accostata) / wAcc;
    const fine = a.proprio.ora + durataAcc + minuti * 60;
    let somma = 0;
    for (const b of base) {
      const A = b.A.slice();
      const j = [0, 0, 0, 0];
      // posizione propria a fine accostata (si approssima l'arco con la corda a meta')
      const thA = (a.proprio.rotta + accostata / 2) * RAD;
      const x1 = a.proprio.x + v * durataAcc * Math.sin(thA);
      const y1 = a.proprio.y + v * durataAcc * Math.cos(thA);
      const t1 = a.proprio.ora + durataAcc;
      for (let t = t1 + Math.max(tm, periodo); t <= fine + 1e-6; t += periodo) {
        const ox = x1 + v * (t - t1) * Math.sin(rotta * RAD);
        const oy = y1 + v * (t - t1) * Math.cos(rotta * RAD);
        const tau = t - a.proprio.ora;
        const ril = rilevamentoDa(ox, oy, b.s[0] + b.s[2] * tau, b.s[1] + b.s[3] * tau);
        const sg = sigmaDi(norm180(ril - rotta));
        if (!Number.isFinite(sg)) continue;
        riga(b.s, { ora: t, x: ox, y: oy }, a.proprio.ora, j);
        const w = 1 / ((sg * RAD) ** 2);
        for (let p = 0; p < 4; p++) for (let q = 0; q < 4; q++) A[p * 4 + q] += j[p] * w * j[q];
      }
      const P = inversa4(A);
      // grandezze alla fine della gamba: si propaga la covarianza
      let rel = 1e3;
      if (P) {
        const dt = fine - a.proprio.ora;
        const sx = b.s[0] + b.s[2] * dt;
        const sy = b.s[1] + b.s[3] * dt;
        const tf = (fine - t1);
        const ox = x1 + v * tf * Math.sin(rotta * RAD);
        const oy = y1 + v * tf * Math.cos(rotta * RAD);
        const R = Math.hypot(sx - ox, sy - oy);
        const ux = (sx - ox) / R; const uy = (sy - oy) / R;
        // varianza di (p + v·dt) lungo u
        const g = [ux, uy, ux * dt, uy * dt];
        let s2 = 0;
        for (let p = 0; p < 4; p++) for (let q = 0; q < 4; q++) s2 += g[p] * P[p * 4 + q] * g[q];
        rel = Math.min(1e3, Math.sqrt(Math.max(0, s2)) / R);
      }
      somma += Math.log(rel);
    }
    return Math.exp(somma / Math.max(1, base.length));
  };

  const senzaManovra = valuta(0, durate[durate.length - 1]);
  let scelta = { accostata: 0, minuti: durate[durate.length - 1], relativa: senzaManovra };
  for (const minuti of durate) {
    let migliore = { accostata: 0, minuti, relativa: Infinity };
    for (const acc of accostate) {
      const r = valuta(acc, minuti);
      if (r < migliore.relativa) migliore = { accostata: acc, minuti, relativa: r };
    }
    if (migliore.relativa < scelta.relativa) scelta = migliore;
    if (migliore.relativa <= obiettivo) { scelta = migliore; break; }
  }
  return {
    accostata: Math.abs(scelta.accostata),
    lato: scelta.accostata < 0 ? 'sinistra' : scelta.accostata > 0 ? 'dritta' : null,
    rotta: norm360(a.proprio.rotta + scelta.accostata),
    minuti: scelta.minuti,
    relativa: scelta.relativa,
    senzaManovra,
  };
}
