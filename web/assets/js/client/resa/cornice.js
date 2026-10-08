// @ts-check
/**
 * La «cornice» comune alle stazioni del 688 (ORIGINALE.md §1, [FRAME]): barra del bersaglio in alto,
 * striscia CRS/SPEED/DEPTH sotto la mappa, nastro dei messaggi, barra di stato con coordinate e
 * orologio, pulsantiera della mappa, cursore.
 *
 * Posizioni misurate sulle catture DOSBox (013, 021, 023, 046):
 *  - valori della barra bersaglio in magenta (13): TARGET in x 48 y 6; BEARING x 49, RANGE x 113,
 *    COURSE x 182, SPEED x 241, DPT x 276 in y 13 (le etichette le disegna STAT.CLS);
 *  - striscia sotto la mappa: valori ciano (11) in y 122: CRS x 29 (con '*' come simbolo dei gradi),
 *    SPEED x 87, DEPTH x 139 seguito da FT in ciano scuro (3);
 *  - nastro: maiuscole grandi bianche in y 175, spaziatura 2, fra x 6 e 311;
 *  - barra di stato: cifre grandi bianche con '%' come due punti in y 187: gruppi in x 10 e 100 seguiti
 *    da una lettera grande gialla (14), orologio in x 210.
 */
import { scrivi, larghezzaTesto, perIlFont, inGrande, cifreGrandi } from './testo.js';
import { normalizza360, metriInPiedi } from '../../../shared/units.js';

/** @typedef {import('./tela.js').Tela} Tela */
/** @typedef {import('./testo.js').FontGioco} FontGioco */

export const NASTRO = Object.freeze({ x1: 6, x2: 311, y: 175, y1: 174, y2: 182, spaziatura: 2 });

/**
 * Velocità come la scriveva il gioco: «0», «.7», «33.8».
 * @param {number} nodi
 */
export function formatoVelocita(nodi) {
  const v = Math.abs(nodi);
  if (v < 0.05) return '0';
  const s = v.toFixed(1);
  return v < 1 ? s.slice(1) : s;
}

/**
 * Un numero con un decimale come lo scriveva il gioco (015: «24.4»): la parte intera, la cifra
 * decimale subito dopo come fosse un'altra cifra, e il punto è un solo pixel giallo sulla riga di base
 * nello spazio fra le due. Così «24.4» sta fra SPEED: e DEPTH: senza toccare la scritta; sotto il
 * nodo «.7», a zero solo «0».
 * @param {import('./tela.js').Tela} tela @param {FontGioco} font @param {number} x @param {number} y
 * @param {number} valore @param {number} colore
 * @returns {number} la x dopo l'ultima cifra
 */
export function scriviDecimale(tela, font, x, y, valore, colore) {
  const s = formatoVelocita(valore);
  if (s === '0') return scrivi(tela, font, x, y, s, colore);
  const [intero, decimale] = s.split('.');
  const xi = intero ? scrivi(tela, font, x, y, intero, colore) : x;
  tela.pixel(xi - 1, y + 4, 14);
  return scrivi(tela, font, xi, y, decimale, colore);
}

/** Tre cifre di un angolo. @param {number} gradi */
export function treCifre(gradi) {
  return String(Math.round(normalizza360(gradi)) % 360).padStart(3, '0');
}

/**
 * Grado:primo:secondo con l'emisfero, per la barra di stato: 62:01:30 N.
 * @param {number} gradi @param {'lat' | 'lon'} tipo
 * @returns {{ testo: string, emisfero: string }}
 */
export function gms(gradi, tipo) {
  const neg = gradi < 0;
  let s = Math.round(Math.abs(gradi) * 3600);
  const g = Math.floor(s / 3600); s -= g * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const p2 = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return {
    testo: `${p2(g)}:${p2(m)}:${p2(s)}`,
    emisfero: tipo === 'lat' ? (neg ? 'S' : 'N') : (neg ? 'W' : 'E'),
  };
}

/** Orologio di missione HH:MM:SS. @param {number} secondi */
export function orologio(secondi) {
  const t = Math.max(0, Math.floor(secondi));
  const p2 = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${p2(Math.floor(t / 3600))}:${p2(Math.floor(t / 60) % 60)}:${p2(t % 60)}`;
}

/**
 * Un numero «12.3» col punto decimale di un solo pixel fra le cifre, come scriviDecimale (la barra del
 * bersaglio del 1989 è stretta: «16.5» col punto del font finirebbe sopra DPT).
 * @param {Tela} tela @param {FontGioco} font @param {number} x @param {number} y @param {string} s @param {number} colore
 */
function scriviConPunto(tela, font, x, y, s, colore) {
  const i = s.indexOf('.');
  if (i < 0) return scrivi(tela, font, x, y, s, colore);
  const xi = i > 0 ? scrivi(tela, font, x, y, s.slice(0, i), colore) : x;
  tela.pixel(xi - 1, y + 4, colore);
  return scrivi(tela, font, xi, y, s.slice(i + 1), colore);
}

/**
 * Barra del bersaglio.
 * @param {Tela} tela @param {FontGioco} font
 * @param {{ bersaglio?: string, rilevamento?: string, distanza?: string, rotta?: string, velocita?: string, quota?: string }} v
 */
export function disegnaBarraBersaglio(tela, font, v) {
  if (v.bersaglio) scrivi(tela, font, 48, 6, perIlFont(v.bersaglio).slice(0, 44), 13);
  if (v.rilevamento) scrivi(tela, font, 49, 13, v.rilevamento, 13);
  if (v.distanza) scriviConPunto(tela, font, 113, 13, v.distanza, 13);
  if (v.rotta) scrivi(tela, font, 182, 13, v.rotta, 13);
  if (v.velocita) scriviConPunto(tela, font, 241, 13, v.velocita, 13);
  if (v.quota) {
    const x = scrivi(tela, font, 276, 13, v.quota, 13);
    scrivi(tela, font, x, 13, 'FT', 11);
  }
}

/**
 * Striscia sotto la mappa.
 * @param {Tela} tela @param {FontGioco} font @param {number} rotta @param {number} nodi @param {number} quota metri
 */
export function disegnaStriscia(tela, font, rotta, nodi, quota) {
  const x = scrivi(tela, font, 29, 122, treCifre(rotta), 11);
  scrivi(tela, font, x, 122, '*', 11);
  scriviDecimale(tela, font, 87, 122, nodi, 11);
  const xq = scrivi(tela, font, 139, 122, String(Math.max(0, Math.round(metriInPiedi(quota)))), 11);
  scrivi(tela, font, xq, 122, 'FT', 3);
}

/**
 * Barra di stato: due coordinate e l'orologio.
 * @param {Tela} tela @param {FontGioco} font
 * @param {{ testo: string, emisfero: string } | null} a @param {{ testo: string, emisfero: string } | null} b
 * @param {string} ora HH:MM:SS
 */
export function disegnaBarraStato(tela, font, a, b, ora) {
  if (a) {
    const x = scrivi(tela, font, 10, 187, cifreGrandi(a.testo), 15);
    scrivi(tela, font, x, 187, a.emisfero.toLowerCase(), 14);
  }
  if (b) {
    const x = scrivi(tela, font, 100, 187, cifreGrandi(b.testo), 15);
    scrivi(tela, font, x, 187, b.emisfero.toLowerCase(), 14);
  }
  scrivi(tela, font, 210, 187, cifreGrandi(ora), 15);
}

/**
 * Il nastro dei messaggi dell'equipaggio: ogni messaggio entra da destra e scorre verso sinistra
 * fino al bordo, poi resta finché non arriva il successivo (o per qualche secondo).
 */
export class Nastro {
  constructor() {
    /** @type {string[]} */
    this.coda = [];
    /** @type {string | null} testo già nei codici del font */
    this.testo = null;
    /** @type {number} */
    this.x = NASTRO.x2;
    this.fermo = 0;
    /** Pixel logici al secondo. */
    this.velocita = 120;
    /** Secondi di sosta a sinistra prima del messaggio successivo, e prima di sparire. */
    this.sosta = 2.5;
    this.durata = 12;
  }

  /** @param {string} testo già tradotto */
  aggiungi(testo) {
    const t = inGrande(perIlFont(testo));
    if (this.coda.length > 8) this.coda.shift();
    // lo stesso messaggio due volte di fila non serve
    if (this.coda[this.coda.length - 1] === t || (this.coda.length === 0 && this.testo === t && this.x <= NASTRO.x1 + 2)) return;
    this.coda.push(t);
  }

  /** Testo fisso al posto dei messaggi (per esempio le coordinate del mirino), o null. */
  get vuoto() {
    return this.testo === null && this.coda.length === 0;
  }

  /** @param {number} dt secondi */
  avanza(dt) {
    if (this.testo === null) {
      const prossimo = this.coda.shift();
      if (prossimo === undefined) return;
      this.testo = prossimo;
      this.x = NASTRO.x2;
      this.fermo = 0;
    }
    const arrivo = NASTRO.x1 + 2;
    if (this.x > arrivo) {
      this.x = Math.max(arrivo, this.x - this.velocita * dt);
      return;
    }
    this.fermo += dt;
    if ((this.coda.length > 0 && this.fermo >= this.sosta) || this.fermo >= this.durata) this.testo = null;
  }

  /** @param {Tela} tela @param {FontGioco} font */
  disegna(tela, font) {
    if (this.testo === null) return;
    const r = [...tela.ritaglio];
    tela.ritaglia(NASTRO.x1, NASTRO.y1, NASTRO.x2, NASTRO.y2);
    scrivi(tela, font, Math.round(this.x), NASTRO.y, this.testo, 15, NASTRO.spaziatura);
    tela.ritaglia(r[0], r[1], r[2], r[3]);
  }
}

/**
 * Testo fisso nella riga dei messaggi (le coordinate del mirino, come in 025).
 * @param {Tela} tela @param {FontGioco} font @param {string} testo
 */
export function disegnaRigaMessaggi(tela, font, testo) {
  tela.riempi(NASTRO.x1, NASTRO.y1, NASTRO.x2, NASTRO.y2, 0);
  scrivi(tela, font, NASTRO.x1 + 2, NASTRO.y, inGrande(perIlFont(testo)), 15, NASTRO.spaziatura);
}

/**
 * Pulsanti della pulsantiera della mappa non ancora in servizio: la lettera blu scura (1) diventa
 * grigio chiaro (7): sbiadita sul ciano, come un comando spento.
 * @param {Tela} tela @param {{ x1: number, y1: number, x2: number, y2: number }[]} rettangoli
 */
export function spegniPulsanti(tela, rettangoli) {
  for (const r of rettangoli) tela.ricolora(r.x1 + 1, r.y1 + 1, r.x2 - 1, r.y2 - 1, 1, 7);
}

// ------------------------------------------------------------------------------------- cursore

/** Freccia del puntatore misurata su 013 e 014: righe di pixel pieni dalla punta. */
const FRECCIA = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 2, 4, 5], [5, 6], [6, 7]];

/** Pixel pieni della freccia, relativi alla punta. */
export const PIXEL_FRECCIA = (() => {
  /** @type {[number, number][]} */
  const p = [];
  FRECCIA.forEach((r, y) => {
    for (let i = 0; i < r.length; i += 2) for (let x = r[i]; x <= r[i + 1]; x++) p.push([x, y]);
  });
  return p;
})();

/**
 * Il puntatore del 1989: freccia del colore del gruppo di comandi (bianca fuori dai comandi), con il
 * bordo nero.
 * @param {Tela} tela @param {number} x @param {number} y @param {number} colore
 */
export function disegnaFreccia(tela, x, y, colore) {
  const pieni = new Set(PIXEL_FRECCIA.map(([a, b]) => `${a},${b}`));
  for (const [a, b] of PIXEL_FRECCIA) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) if (!pieni.has(`${a + dx},${b + dy}`)) tela.pixel(x + a + dx, y + b + dy, 0);
    }
  }
  for (const [a, b] of PIXEL_FRECCIA) tela.pixel(x + a, y + b, colore);
}

/**
 * Mirino bianco (waypoint, bersaglio): croce con il centro vuoto, come in 025.
 * @param {Tela} tela @param {number} x @param {number} y
 */
export function disegnaMirino(tela, x, y) {
  for (let k = 2; k <= 6; k++) {
    tela.pixel(x - k, y, 15); tela.pixel(x + k, y, 15);
    tela.pixel(x, y - k, 15); tela.pixel(x, y + k, 15);
  }
}

/**
 * Riquadro di testo bianco con il bordo nero (aiuto, avvisi), come i fumetti dell'aiuto del 1989.
 * @param {Tela} tela @param {FontGioco} font @param {number} x @param {number} y @param {string[]} righe
 */
export function disegnaRiquadro(tela, font, x, y, righe) {
  const w = Math.max(...righe.map((r) => larghezzaTesto(font, r))) + 8;
  const h = righe.length * 9 + 6;
  tela.riempi(x, y, x + w, y + h, 15);
  tela.rett(x, y, x + w, y + h, 0);
  tela.rett(x + 1, y + 1, x + w - 1, y + h - 1, 8);
  righe.forEach((r, i) => scrivi(tela, font, x + 5, y + 4 + i * 9, r, 0));
  return { w, h };
}
