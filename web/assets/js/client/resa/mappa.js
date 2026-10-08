// @ts-check
/**
 * La mappa dall'alto nella finestra delle stazioni: batimetria nei toni della carta nautica originale,
 * proprio battello al centro, rilevamenti, tracce, waypoint, proiezione.
 *
 * Misure prese sulle catture DOSBox (docs/ORIGINALE.md e note dell'agente E):
 *  - la mappa si disegna in x 8..175, y 28..120 (168×93, il ritaglio acceso dal codice C);
 *  - il proprio battello è il quadratino 5×5 verde con il centro in (92, 74);
 *  - la carta usa l'indice 0BFh + 4·classe: 0 terra (133,181,0), 1 costa (58,181,0), 2-15 profondità
 *    crescente dal celeste al blu notte (ASSET.md §4.4);
 *  - un contatto di solo rilevamento è una X gialla bordata di rosso, «sempre a metà fra te e il bordo
 *    della mappa» (ORIGINALE.md §3).
 *
 * Le classi di profondità sono nostre (le mappe SURF del 1989 non dicono quanti metri valga un
 * livello): fitte dove vive un sottomarino (0-500 m), larghe nelle fosse oceaniche.
 */
import { normalizza360 } from '../../../shared/units.js';

/** @typedef {import('./tela.js').Tela} Tela */

/** Finestra della mappa, estremi inclusi. */
export const FINESTRA = Object.freeze({ x1: 8, y1: 28, x2: 175, y2: 120 });
/** Pixel del proprio battello (centro del quadratino). */
export const CENTRO = Object.freeze({ x: 92, y: 74 });

/** Primo indice della rampa della carta nautica nella palette DAY. */
export const BASE_CARTA = 0xbf;
export const CLASSE_TERRA = 0;
export const CLASSE_COSTA = 1;

/**
 * Soglie (metri d'acqua) fra le classi 2..15: classe 2 sotto i 10 m, classe 15 da 1500 m in giù.
 * @type {readonly number[]}
 */
export const SOGLIE_CLASSI_M = Object.freeze([10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500]);

/**
 * Metri per pixel dei 10 livelli di zoom, dal più vicino al più lontano (serie R10: ogni livello è
 * circa 1,6 volte il precedente). Al più lontano la finestra copre 269 km.
 * @type {readonly number[]}
 */
export const SCALE_MAPPA_M = Object.freeze([25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600]);
/** Livello di zoom all'avvio. */
export const ZOOM_INIZIALE = 4;

/**
 * Classe di profondità: 0 terra (quota del fondo ≤ 0), 2..15 acqua sempre più profonda. La costa
 * (classe 1) dipende dai vicini: la decide `costeggia`.
 * @param {number} metri profondità del fondo (positiva = acqua)
 */
export function classeProfondita(metri) {
  if (!(metri > 0)) return CLASSE_TERRA;
  let c = 2;
  for (const s of SOGLIE_CLASSI_M) {
    if (metri < s) return c;
    c++;
  }
  return 15;
}

/** Indice di palette di una classe. @param {number} classe 0..15 */
export function indiceCarta(classe) {
  return BASE_CARTA + 4 * classe;
}

/**
 * Vista della mappa: centro nel mondo (metri, x est, y nord) e scala.
 * @typedef {{ cx: number, cy: number, mpp: number }} Vista
 */

/** Dal mondo allo schermo. @param {Vista} v @param {number} x @param {number} y */
export function inSchermo(v, x, y) {
  return { px: CENTRO.x + (x - v.cx) / v.mpp, py: CENTRO.y - (y - v.cy) / v.mpp };
}

/** Dallo schermo al mondo (centro del pixel). @param {Vista} v @param {number} px @param {number} py */
export function inMondo(v, px, py) {
  return { x: v.cx + (px - CENTRO.x) * v.mpp, y: v.cy - (py - CENTRO.y) * v.mpp };
}

/** Il punto (logico) è dentro la finestra? @param {number} px @param {number} py */
export function inFinestra(px, py) {
  return px >= FINESTRA.x1 && px <= FINESTRA.x2 && py >= FINESTRA.y1 && py <= FINESTRA.y2;
}

/**
 * Funzione che dà la profondità del fondo in un punto del piano (metri, positiva = acqua; ≤ 0 terra;
 * null fuori dai dati).
 * @typedef {(x: number, y: number) => (number | null)} Campionatore
 */

/**
 * Griglia delle classi nella finestra (168×93), con le coste: un pixel di terra che tocca l'acqua
 * diventa costa, come il bordo verde scuro delle isole del 1989. Fuori dai dati: -1.
 * @param {Vista} v @param {Campionatore} campiona
 * @returns {Int8Array}
 */
export function classiFinestra(v, campiona) {
  const w = FINESTRA.x2 - FINESTRA.x1 + 1, h = FINESTRA.y2 - FINESTRA.y1 + 1;
  const g = new Int8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const p = inMondo(v, FINESTRA.x1 + i, FINESTRA.y1 + j);
      const d = campiona(p.x, p.y);
      g[j * w + i] = d === null ? -1 : classeProfondita(d);
    }
  }
  return costeggia(g, w, h);
}

/**
 * Terra con almeno un vicino d'acqua (4-connessi) → costa.
 * @param {Int8Array} g @param {number} w @param {number} h
 */
export function costeggia(g, w, h) {
  const out = g.slice();
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (g[j * w + i] !== CLASSE_TERRA) continue;
      const acqua = (/** @type {number} */ a, /** @type {number} */ b) => a >= 0 && a < w && b >= 0 && b < h && g[b * w + a] >= 2;
      if (acqua(i - 1, j) || acqua(i + 1, j) || acqua(i, j - 1) || acqua(i, j + 1)) out[j * w + i] = CLASSE_COSTA;
    }
  }
  return out;
}

/**
 * Disegna il fondale. Senza ombreggiatura (tasto B spento) l'acqua è di un solo tono.
 * @param {Tela} tela @param {Int8Array} classi @param {boolean} ombreggiatura
 */
export function disegnaFondale(tela, classi, ombreggiatura) {
  const w = FINESTRA.x2 - FINESTRA.x1 + 1, h = FINESTRA.y2 - FINESTRA.y1 + 1;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const c = classi[j * w + i];
      let idx;
      if (c < 0) idx = 0;
      else if (c >= 2 && !ombreggiatura) idx = indiceCarta(5);
      else idx = indiceCarta(c);
      tela.px[(FINESTRA.y1 + j) * 320 + FINESTRA.x1 + i] = idx;
    }
  }
}

/** Il proprio battello: quadratino 5×5, bordo verde scuro (2) e interno verde chiaro (10). @param {Tela} tela */
export function disegnaBattello(tela) {
  tela.riempi(CENTRO.x - 2, CENTRO.y - 2, CENTRO.x + 2, CENTRO.y + 2, 2);
  tela.riempi(CENTRO.x - 1, CENTRO.y - 1, CENTRO.x + 1, CENTRO.y + 1, 10);
}

/**
 * Scia del battello: un trattino che esce dalla poppa, lungo con la velocità (015: «a short wake line»).
 * @param {Tela} tela @param {number} rotta gradi @param {number} nodi
 */
export function disegnaScia(tela, rotta, nodi) {
  const lung = Math.min(8, Math.round(nodi / 5));
  if (lung < 1) return;
  const a = ((rotta + 180) * Math.PI) / 180;
  const x0 = CENTRO.x + 3 * Math.sin(a), y0 = CENTRO.y - 3 * Math.cos(a);
  tela.linea(x0, y0, x0 + lung * Math.sin(a), y0 - lung * Math.cos(a), 15);
}

/**
 * Punto «a metà strada verso il bordo» lungo un rilevamento vero, dal centro della finestra.
 * @param {number} rilevamento gradi veri
 */
export function puntoAMetaBordo(rilevamento) {
  const a = (normalizza360(rilevamento) * Math.PI) / 180;
  const dx = Math.sin(a), dy = -Math.cos(a);
  // distanza dal centro al bordo della finestra lungo la direzione (dx, dy)
  const tx = dx > 0 ? (FINESTRA.x2 - CENTRO.x) / dx : dx < 0 ? (FINESTRA.x1 - CENTRO.x) / dx : Infinity;
  const ty = dy > 0 ? (FINESTRA.y2 - CENTRO.y) / dy : dy < 0 ? (FINESTRA.y1 - CENTRO.y) / dy : Infinity;
  const t = Math.min(tx, ty) / 2;
  return { px: Math.round(CENTRO.x + t * dx), py: Math.round(CENTRO.y + t * dy) };
}

/**
 * Punto sul bordo della finestra lungo un rilevamento vero (per la linea del bersaglio designato).
 * @param {number} rilevamento gradi veri
 */
export function puntoSulBordo(rilevamento) {
  const m = puntoAMetaBordo(rilevamento);
  return { px: CENTRO.x + 2 * (m.px - CENTRO.x), py: CENTRO.y + 2 * (m.py - CENTRO.y) };
}

/**
 * La X di un contatto di solo rilevamento: 7×7, giallo (14) con il contorno rosso (4). Con `debole` è
 * solo rossa (l'eco ambigua dell'antenna rimorchiata).
 * @param {Tela} tela @param {number} x @param {number} y @param {boolean} [debole]
 */
export function disegnaX(tela, x, y, debole = false) {
  const diag = [[-2, -2], [2, -2], [-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1], [-2, 2], [2, 2]];
  for (const [dx, dy] of diag) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) tela.pixel(x + dx + ox, y + dy + oy, 4);
  }
  if (!debole) for (const [dx, dy] of diag) tela.pixel(x + dx, y + dy, 14);
}

/**
 * Rombo della proiezione: giallo (14) per il proprio battello, come in 024.
 * @param {Tela} tela @param {number} x @param {number} y @param {number} colore
 */
export function disegnaRombo(tela, x, y, colore) {
  x = Math.round(x); y = Math.round(y);
  for (let r = -3; r <= 3; r++) {
    const w = 3 - Math.abs(r);
    tela.hline(y + r, x - w, x + w, colore);
  }
}
