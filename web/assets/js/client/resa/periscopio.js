// @ts-check
/**
 * La vista del periscopio (stazione F5) nella finestra della mappa: cielo e mare a toni, la costa
 * all'orizzonte, le sagome originali delle navi (ENC del 1989) e il reticolo; più la matematica che
 * serve: dove cade un rilevamento, quale figura e quanto grande, lo stadimetro.
 *
 * Misure sulle catture DOSBox 033, 039 (giorno) e 094 (notte):
 *  - orizzonte in y 90: cielo nelle righe 28-89, mare nelle righe 90-120;
 *  - il cielo è la rampa 16-79 della palette percorsa all'indietro, dall'indice 78 in cima al 18 sopra
 *    l'orizzonte; il mare riparte dal 62 e scurisce verso il basso fino al 77 (tabelle sotto, lette riga
 *    per riga sulla 033). Di notte gli indici sono gli stessi: cambia solo la palette (NIGHT.PAL fa la
 *    rampa blu notte e rende rosse le sagome, 094), come faceva il gioco;
 *  - una nave a 10 miglia è una sagoma di circa 22×9 pixel, a 6,5 miglia più grande (033, 039): il gioco
 *    rimpiccioliva le figure ENC (188×52 il Forrest Sherman di fianco) con un suo codice (129D:000B).
 *
 * Le figure: cinque angolazioni per classe (0 prua, 1 tre quarti di prua, 2 fianco, 3 tre quarti di poppa,
 * 4 poppa), disegnate col fianco di DRITTA verso l'osservatore (la prua a destra: FOREST2 ha il cannone
 * singolo e la plancia a destra, i due cannoni poppieri a sinistra); il lato di sinistra si ottiene
 * specchiando, come faceva il gioco. La Nimitz ha otto angolazioni ogni 45° e non si specchia.
 *
 * L'ottica è quella del periscopio d'attacco del 688 (Type 2/18): due ingrandimenti, 1,5× con 32° di
 * campo e 6× con 8°. La finestra è larga 168 pixel: a 1,5× un grado vale 5,25 pixel, a 6× 21. A quelle
 * scale una nave lontana sarebbe un puntino; come nel 1989 la sagoma non scende sotto una misura minima
 * (ALTEZZA_MINIMA), ma la distanza si misura con l'angolo d'albero che dà il server, non con i pixel.
 */
import { normalizza360 } from '../../../shared/units.js';

/** @typedef {import('./tela.js').Tela} Tela */
/** @typedef {import('./png.js').ImmagineIndicizzata} ImmagineIndicizzata */

/** Finestra (la stessa della mappa) e orizzonte. */
export const VISTA = Object.freeze({ x1: 8, y1: 28, x2: 175, y2: 120, orizzonte: 90, centro: 92 });
export const LARGHEZZA_VISTA = VISTA.x2 - VISTA.x1 + 1;

/** Indici del cielo, righe 28-89 (033). */
export const CIELO = Object.freeze([
  78, 78, 77, 76, 74, 74, 74, 72, 70, 70, 69, 66, 66, 66, 65, 64, 62, 62, 61, 60, 57, 57, 57, 56, 54, 54, 54, 52,
  50, 50, 49, 48, 46, 46, 45, 44, 42, 42, 41, 40, 38, 38, 37, 36, 34, 34, 32, 30, 30, 30, 29, 28, 26, 26, 25, 24,
  22, 22, 21, 20, 18, 18,
]);
/** Indici del mare, righe 90-120 (033). */
export const MARE = Object.freeze([
  62, 62, 62, 62, 64, 64, 65, 65, 66, 66, 66, 66, 66, 66, 69, 69, 70, 70, 70, 70, 72, 72, 74, 74, 74, 74, 74, 74,
  76, 76, 77,
]);

/** Gli ingrandimenti: nome sul pannello e campo orizzontale in gradi. */
export const INGRANDIMENTI = Object.freeze([
  Object.freeze({ nome: '1.5X', campo: 32 }),
  Object.freeze({ nome: '6X', campo: 8 }),
]);

/** Altezza minima di una sagoma, in pixel (la 033 ne mostra 9 a 10 miglia). */
export const ALTEZZA_MINIMA = 9;
/** Scala massima di una figura (oltre, a distanza ravvicinata, non ci starebbe nella finestra). */
export const SCALA_MASSIMA = 1.6;

/** Pixel per grado con un campo dato. @param {number} campo gradi */
export function pixelPerGrado(campo) {
  return LARGHEZZA_VISTA / campo;
}

/**
 * x dello schermo (frazionaria) di un rilevamento vero, col periscopio puntato su `puntamento` (vero):
 * il centro del reticolo è x 92. Fuori dal campo: null.
 * @param {number} rilevamento @param {number} puntamento @param {number} campo
 */
export function xDiRilevamento(rilevamento, puntamento, campo) {
  let d = normalizza360(rilevamento - puntamento);
  if (d > 180) d -= 360;
  if (Math.abs(d) > campo / 2 + 20) return null;
  return VISTA.centro + 0.5 + d * pixelPerGrado(campo);
}

/**
 * Rilevamento vero sotto una colonna dello schermo.
 * @param {number} x @param {number} puntamento @param {number} campo
 */
export function rilevamentoDiX(x, puntamento, campo) {
  return normalizza360(puntamento + (x + 0.5 - (VISTA.centro + 0.5)) / pixelPerGrado(campo));
}

/**
 * Quale figura e se specchiarla, dall'angolo sulla prua misurato (aspetto: gradi dalla prua del
 * bersaglio verso l'osservatore, in senso orario; 0-180 = si vede il fianco di dritta, 180-360 = quello
 * di sinistra; si accetta anche −180..180).
 * @param {number} aspetto @param {number} [angolazioni] 5 (prua…poppa, specchiate) o 8 (Nimitz)
 * @returns {{ indice: number, specchio: boolean }}
 */
export function fotogrammaPerAspetto(aspetto, angolazioni = 5) {
  const a = normalizza360(aspetto);
  if (angolazioni === 8) return { indice: Math.round(a / 45) % 8, specchio: false };
  const lato = a <= 180 ? a : 360 - a; // 0 prua … 180 poppa
  return { indice: Math.min(4, Math.round(lato / 45)), specchio: a > 180 && lato > 0 && lato < 180 };
}

/**
 * Nome dell'immagine originale per un avvistamento: `sagoma` può essere già una figura ('FOREST2') o il
 * prefisso della classe ('FOREST'), e allora la figura la sceglie l'aspetto.
 * @param {string} sagoma @param {number} aspetto @param {(nome: string) => boolean} esiste
 * @returns {{ nome: string, specchio: boolean } | null}
 */
export function figuraPer(sagoma, aspetto, esiste) {
  const s = sagoma.toUpperCase();
  const otto = esiste(`${s}7`);
  if (!/\d$/.test(s) || !esiste(s)) {
    const f = fotogrammaPerAspetto(aspetto, otto ? 8 : 5);
    const nome = `${s}${f.indice}`;
    return esiste(nome) ? { nome, specchio: f.specchio } : null;
  }
  // figura già scelta dal server: si specchia comunque se si vede il fianco di sinistra
  const prefisso = s.replace(/\d+$/, '');
  const ottoP = esiste(`${prefisso}7`);
  return { nome: s, specchio: !ottoP && fotogrammaPerAspetto(aspetto).specchio };
}

/**
 * Scala di una figura alta `righe` pixel perché la testa d'albero stia `elevazione` gradi sopra la
 * linea di galleggiamento, con il minimo e il massimo della resa.
 * @param {number} elevazione gradi @param {number} campo gradi @param {number} righe altezza della figura
 */
export function scalaFigura(elevazione, campo, righe) {
  const altezza = Math.max(ALTEZZA_MINIMA, elevazione * pixelPerGrado(campo));
  return Math.min(SCALA_MASSIMA, altezza / Math.max(1, righe));
}

/**
 * Rettangolo che la figura occupa sullo schermo: centrata sul rilevamento, la riga più bassa sulla linea
 * di galleggiamento.
 * @param {number} x centro (frazionario) @param {number} yBase riga della linea di galleggiamento
 * @param {number} larghezza @param {number} altezza della figura @param {number} scala
 */
export function rettangoloFigura(x, yBase, larghezza, altezza, scala) {
  const w = Math.max(1, Math.round(larghezza * scala));
  const h = Math.max(1, Math.round(altezza * scala));
  const x1 = Math.round(x - w / 2);
  return { x1, y1: yBase - h + 1, x2: x1 + w - 1, y2: yBase, w, h };
}

/**
 * Disegna una figura ingrandita o rimpicciolita al pixel più vicino (come gli sprite scalati del gioco),
 * eventualmente specchiata, saltando l'indice trasparente; rispetta il ritaglio della tela.
 * @param {Tela} tela @param {ImmagineIndicizzata} img @param {number} x centro @param {number} yBase
 * @param {number} scala @param {boolean} specchio @param {number} trasparente
 */
export function disegnaFigura(tela, img, x, yBase, scala, specchio, trasparente) {
  const r = rettangoloFigura(x, yBase, img.larghezza, img.altezza, scala);
  for (let j = 0; j < r.h; j++) {
    const sy = Math.min(img.altezza - 1, Math.floor((j + 0.5) / scala));
    for (let i = 0; i < r.w; i++) {
      let sx = Math.min(img.larghezza - 1, Math.floor((i + 0.5) / scala));
      if (specchio) sx = img.larghezza - 1 - sx;
      const c = img.indici[sy * img.larghezza + sx];
      if (c !== trasparente) tela.pixel(r.x1 + i, r.y1 + j, c);
    }
  }
  return r;
}

/** Cielo e mare a toni (il giorno o la notte li fa la palette). @param {Tela} tela */
export function disegnaCieloMare(tela) {
  for (let y = VISTA.y1; y <= VISTA.y2; y++) {
    const c = y < VISTA.orizzonte ? CIELO[y - VISTA.y1] : MARE[y - VISTA.orizzonte];
    tela.riempi(VISTA.x1, y, VISTA.x2, y, c ?? 0);
  }
}

/**
 * Lo stadimetro: la distanza dalla testa d'albero (altezza dal libro di riconoscimento, metri) e
 * dall'angolo misurato fra linea di galleggiamento e testa d'albero (gradi).
 * @param {number} altezza m @param {number} elevazione gradi
 * @returns {number} m (Infinity se l'angolo è nullo)
 */
export function distanzaStadimetro(altezza, elevazione) {
  const a = (elevazione * Math.PI) / 180;
  return a > 0 ? altezza / Math.tan(a) : Infinity;
}

/**
 * Elevazione della testa d'albero di una nave alta `altezza` metri a `distanza` metri (l'inverso dello
 * stadimetro: serve alle prove e al finto server).
 * @param {number} altezza @param {number} distanza
 */
export function elevazioneAlbero(altezza, distanza) {
  return (Math.atan2(altezza, distanza) * 180) / Math.PI;
}

/**
 * La costa vista dal periscopio: per ogni colonna, l'altezza (in pixel sopra l'orizzonte) della terra più
 * alta in vista lungo quel rilevamento, entro `portata` metri. La terra si vede se la sua cima supera
 * l'orizzonte geometrico (curvatura con la rifrazione standard, k = 4/3) da un occhio a `occhio` metri
 * sull'acqua. Il campionatore è quello della mappa: metri d'acqua (> 0) o quota del suolo col segno meno.
 * @param {(x: number, y: number) => (number | null)} campiona
 * @param {{ x: number, y: number }} da posizione propria @param {number} puntamento @param {number} campo
 * @param {{ portata?: number, occhio?: number, passi?: number }} [o]
 * @returns {Int16Array} per colonna: pixel sopra l'orizzonte (0 = nessuna terra), e −1 se la terra in
 *   vista è così vicina da coprire tutto il campo verticale
 */
export function profiloCosta(campiona, da, puntamento, campo, o = {}) {
  const portata = o.portata ?? 40000;
  const occhio = o.occhio ?? 2;
  const passi = o.passi ?? 48;
  const raggio = 6371000 * (4 / 3);
  const ppg = pixelPerGrado(campo);
  const out = new Int16Array(LARGHEZZA_VISTA);
  for (let c = 0; c < LARGHEZZA_VISTA; c++) {
    const ril = rilevamentoDiX(VISTA.x1 + c, puntamento, campo);
    const a = (ril * Math.PI) / 180;
    const sx = Math.sin(a), sy = Math.cos(a);
    let migliore = 0;
    for (let k = 1; k <= passi; k++) {
      // passi che si allargano con la distanza: fitti vicino, radi lontano
      const d = 150 * (portata / 150) ** (k / passi);
      const h = campiona(da.x + d * sx, da.y + d * sy);
      if (h === null || h > 0) continue;
      const quota = Math.max(1, -h);
      const ang = Math.atan2(quota - occhio - (d * d) / (2 * raggio), d) * (180 / Math.PI);
      if (ang > 0) migliore = Math.max(migliore, ang * ppg);
    }
    out[c] = migliore >= VISTA.orizzonte - VISTA.y1 ? -1 : Math.round(migliore);
  }
  return out;
}

/**
 * Disegna la costa: verde con un bordo bruno in cima e qualche striscia più scura (i colli dipinti della
 * 033 in verde 2 e 10 col marrone 6).
 * @param {Tela} tela @param {Int16Array} profilo
 */
export function disegnaCosta(tela, profilo) {
  for (let c = 0; c < profilo.length; c++) {
    const h = profilo[c];
    if (h === 0) continue;
    const x = VISTA.x1 + c;
    const cima = h < 0 ? VISTA.y1 : VISTA.orizzonte - h;
    for (let y = cima; y < VISTA.orizzonte; y++) {
      const dalBordo = y - cima;
      const colore = dalBordo === 0 ? 6 : (y + c) % 5 === 0 || dalBordo === 1 ? 10 : 2;
      tela.pixel(x, y, colore);
    }
  }
}
