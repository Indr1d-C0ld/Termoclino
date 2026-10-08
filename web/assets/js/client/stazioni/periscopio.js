// @ts-check
/**
 * Periscopio (F5): il pannello originale (ESM LEVEL, PERISCOPE e ANTENNA, PERISCOPE ROTATION, WEAPON
 * CONTROL, TARGET) e, col periscopio alzato, la vista nella finestra della mappa con le sagome originali.
 *
 * Zone cliccabili di PERI.CLS (lavoro PERI_688): G TARGET (gruppo 2); U periscopio, N antenna (l'albero
 * dell'ESM), '-' e '=' brandeggio a sinistra e a destra (gruppo 3); L LAUNCH (gruppo 4, arriva con le
 * armi in F3). I riquadri DOWN/UP e la finestrella dei gradi li disegnava il codice C: qui li disegna la
 * routine 9 di PERI.CLS (la stessa di TARGET e LAUNCH) nelle posizioni misurate su 032 e 033; le dieci
 * spie dell'ESM sono quelle di 041 (tre blu, tre verdi, due gialle, due rosse).
 *
 *  - U alza e abbassa il periscopio (ordine `albero`: serve la quota periscopica), N l'albero dell'ESM;
 *  - '-' e '=' brandeggiano di mezzo campo (16° a 1,5×, 4° a 6×); un clic nella vista la centra lì;
 *  - G sceglie l'avvistamento successivo e ci porta il periscopio (nel 1989 il mirino si agganciava alla
 *    nave e la identificava all'istante: qui l'identità resta da stimare);
 *  - zone in più nella vista: M ingrandimento (1,5× / 6×), D stadimetro. Lo stadimetro chiede la classe
 *    dal libro di riconoscimento (si sfoglia con '-' e '=', si sceglie con D, Esc chiude), poi dà la
 *    distanza = altezza d'albero / tan(angolo misurato fra linea d'acqua e testa d'albero) e mostra
 *    per un attimo l'immagine sdoppiata con la testa d'albero allineata alla linea d'acqua.
 *
 * Di notte (il server lo dice con le luci di navigazione, che di giorno sono null) la regia usa la
 * palette NIGHT: cielo blu notte e sagome rosse, come nel 1989 (094).
 */
import { chiamaRoutine, SAGOMA_TRASPARENTE } from '../resa/risorse.js';
import { attivaComune, migliaBarra, disegnaHud } from './comune.js';
import { FINESTRA } from '../resa/mappa.js';
import {
  VISTA, INGRANDIMENTI, disegnaCieloMare, xDiRilevamento, rilevamentoDiX, figuraPer, scalaFigura, disegnaFigura,
  rettangoloFigura, distanzaStadimetro, profiloCosta, disegnaCosta,
} from '../resa/periscopio.js';
import { treCifre } from '../resa/cornice.js';
import { scrivi, scriviBordato, larghezzaTesto, perIlFont } from '../resa/testo.js';
import { normalizza360, normalizza180 } from '../../../shared/units.js';

/** @typedef {import('./comune.js').Contesto} Contesto */
/** @typedef {import('./comune.js').Stazione} Stazione */
/** @typedef {import('../cls.js').Hotspot} Hotspot */
/** @typedef {import('../stato.js').Avvistamento} Avvistamento */

/** Riquadri disegnati dal codice C (032, 033), argomenti della routine 9 di PERI.CLS. */
export const RIQUADRI = Object.freeze({
  periscopio: [203, 75, 237, 87],
  antenna: [263, 75, 297, 87],
  gradi: [235, 112, 265, 124],
});
/** Spie dell'ESM: interno della spia k in x 209+9k..212+9k, y 41..46 (041). */
export const SPIE_ESM = Object.freeze({ x0: 209, passo: 9, larghezza: 4, y1: 41, y2: 46, colori: [9, 9, 9, 10, 10, 10, 14, 14, 12, 12] });
/** Tasti delle zone aggiunte nella vista. */
export const TASTO_INGRANDIMENTO = 77, TASTO_STADIMETRO = 68, TASTO_VISTA_PERI = 252;
/** Secondi per cui resta l'immagine sdoppiata dello stadimetro. */
const DURATA_SDOPPIATA = 3;

/**
 * Spie accese dell'ESM per il livello più forte sentito (dB sopra soglia): una ogni 6 dB, così un radar
 * di scoperta a una decina di miglia accende sette-otto spie come l'elicottero di 041.
 * @param {number | null} livello
 */
export function spieEsm(livello) {
  if (livello === null || !Number.isFinite(livello) || livello < 0) return 0;
  return Math.max(1, Math.min(10, Math.ceil((livello + 1) / 6)));
}

/** Il periscopio è alzato? @param {Contesto} ctx */
function alzato(ctx) {
  return ctx.stato.nave?.alberi.periscopio === true;
}

/** Rilevamento vero a cui guarda il periscopio. @param {Contesto} ctx */
export function puntamento(ctx) {
  return normalizza360((ctx.stato.nave?.rotta ?? 0) + ctx.ui.peri.rotta);
}

/** Campo dell'ingrandimento in uso, gradi. @param {Contesto} ctx */
function campo(ctx) {
  return INGRANDIMENTI[ctx.ui.peri.ingrandimento]?.campo ?? INGRANDIMENTI[0].campo;
}

/** È notte? Di giorno le luci degli avvistamenti sono null; senza avvistamenti vale `visivo.luce`. @param {Contesto} ctx */
export function notte(ctx) {
  const v = ctx.stato.visivo;
  if (!v) return false;
  if (v.luce) return v.luce === 'notte';
  return v.oggetti.some((o) => o.luci !== null);
}

/** Gli avvistamenti dell'ultimo fotogramma, se è recente. @param {Contesto} ctx @returns {Avvistamento[]} */
function avvistamenti(ctx) {
  const v = ctx.stato.visivo, nave = ctx.stato.nave;
  if (!v || !nave || nave.ora - v.ora > 5) return [];
  return v.oggetti;
}

/** La classe del libro di riconoscimento che si guarda (solo navi e sottomarini con altezza d'albero). @param {Contesto} ctx */
function classiLibro(ctx) {
  return ctx.biblioteca.filter((c) => c.albero !== null);
}

/** @param {Contesto} ctx */
function classeLibro(ctx) {
  const l = classiLibro(ctx);
  return l.length ? l[((ctx.ui.peri.classe % l.length) + l.length) % l.length] : null;
}

// ------------------------------------------------------------------------------------- vista

/**
 * Dove cade ogni avvistamento nella vista (per disegnarli e per scegliere col clic).
 * @param {Contesto} ctx
 */
function posizioni(ctx) {
  const c = campo(ctx), p = puntamento(ctx);
  /** @type {{ o: Avvistamento, x: number, r: { x1: number, y1: number, x2: number, y2: number }, nome: string | null, specchio: boolean, scala: number }[]} */
  const out = [];
  for (const o of avvistamenti(ctx)) {
    const x = xDiRilevamento(o.rilevamento, p, c);
    if (x === null) continue;
    const fig = o.sagoma ? figuraPer(o.sagoma, o.aspetto ?? 90, (n) => !!ctx.orig.sagome[n]) : null;
    const img = fig ? ctx.orig.sagome[fig.nome] : null;
    if (img && fig) {
      const scala = scalaFigura(o.elevazione_alberi ?? 0, c, img.altezza);
      const base = o.sotto_orizzonte ? VISTA.orizzonte + Math.round(img.altezza * scala * 0.35) : VISTA.orizzonte;
      out.push({ o, x, r: rettangoloFigura(x, base, img.larghezza, img.altezza, scala), nome: fig.nome, specchio: fig.specchio, scala });
    } else {
      out.push({ o, x, r: { x1: Math.round(x) - 1, y1: VISTA.orizzonte - 4, x2: Math.round(x) + 1, y2: VISTA.orizzonte }, nome: null, specchio: false, scala: 1 });
    }
  }
  // dal più lontano (più piccolo) al più vicino
  out.sort((a, b) => (a.o.elevazione_alberi ?? 0) - (b.o.elevazione_alberi ?? 0));
  return out;
}

/** La costa all'orizzonte, cacheata finché non ci si muove di 50 m o non si brandeggia. @param {Contesto} ctx */
function costa(ctx) {
  const nave = ctx.stato.nave;
  if (!ctx.fondale || !nave) return null;
  const k = `costa:${Math.round(nave.x / 50)},${Math.round(nave.y / 50)},${puntamento(ctx).toFixed(1)},${campo(ctx)}`;
  let p = /** @type {Int16Array | undefined} */ (ctx.cache.get(k));
  if (!p) {
    for (const kk of ctx.cache.keys()) if (kk.startsWith('costa:')) ctx.cache.delete(kk);
    p = profiloCosta(ctx.fondale, nave, puntamento(ctx), campo(ctx));
    ctx.cache.set(k, p);
  }
  return p;
}

/**
 * La scala dei rilevamenti in basso: tacca ogni grado (6×) o ogni 5° (1,5×), etichetta ogni 5° o 10° col
 * rilevamento vero; tacca lunga al centro del reticolo.
 * @param {Contesto} ctx
 */
function reticolo(ctx) {
  const { tela, font } = ctx;
  const c = campo(ctx), p = puntamento(ctx);
  const passo = c <= 8 ? 1 : 5, etichetta = c <= 8 ? 5 : 10;
  const y = VISTA.y2 - 1;
  for (let g = Math.ceil((p - c / 2) / passo) * passo; g <= p + c / 2; g += passo) {
    const x = xDiRilevamento(g, p, c);
    if (x === null) continue;
    const xi = Math.floor(x);
    const lunga = normalizza360(g) % etichetta === 0;
    tela.vline(xi, y - (lunga ? 3 : 1), y, 15);
    if (lunga) {
      const testo = treCifre(g);
      const w = larghezzaTesto(font, testo) - 1;
      if (xi - w / 2 > VISTA.x1 + 1 && xi + w / 2 < VISTA.x2 - 1) scrivi(tela, font, xi - Math.floor(w / 2), y - 10, testo, 15);
    }
  }
  // il centro: due trattini verticali sopra e sotto l'orizzonte
  tela.vline(VISTA.centro, VISTA.orizzonte - 14, VISTA.orizzonte - 8, 15);
  tela.vline(VISTA.centro, VISTA.orizzonte + 4, VISTA.orizzonte + 9, 15);
  tela.hline(VISTA.orizzonte, VISTA.centro - 12, VISTA.centro - 7, 15);
  tela.hline(VISTA.orizzonte, VISTA.centro + 7, VISTA.centro + 12, 15);
}

/**
 * Le parole della vista con le loro posizioni: in alto a sinistra, sotto la parola del lato, lontane
 * dalla bussola e dalla scala della quota dell'HUD.
 * @param {Contesto} ctx
 */
function paroleVista(ctx) {
  const ingr = INGRANDIMENTI[ctx.ui.peri.ingrandimento]?.nome ?? '1.5X';
  const stad = ctx.t('ui.peri.stadimetro');
  return { ingr, stad, xi: VISTA.x1 + 3, yi: VISTA.y1 + 10, xs: VISTA.x1 + 3, ys: VISTA.y1 + 18 };
}

/**
 * La vista: cielo e mare, costa, sagome (le più lontane prima), luci di notte, scie, reticolo, la parola
 * del lato come nel 1989 (PORT, STARBRD, AFT), ingrandimento e stadimetro.
 * @param {Contesto} ctx
 */
function disegnaVista(ctx) {
  const { tela, font, ui, ora } = ctx;
  disegnaCieloMare(tela);
  const profilo = costa(ctx);
  if (profilo) disegnaCosta(tela, profilo);
  const pos = posizioni(ctx);
  for (const p of pos) {
    const o = p.o;
    const img = p.nome ? ctx.orig.sagome[p.nome] : null;
    if (img) {
      // sotto l'orizzonte: la parte bassa dello scafo non si vede
      if (o.sotto_orizzonte) tela.ritaglia(VISTA.x1, VISTA.y1, VISTA.x2, VISTA.orizzonte - 1);
      disegnaFigura(tela, img, p.x, p.r.y2, p.scala, p.specchio, SAGOMA_TRASPARENTE);
      tela.ritaglia(VISTA.x1, VISTA.y1, VISTA.x2, VISTA.y2);
      if (o.scia) {
        // l'onda di prua: schiuma bianca davanti alla prua (a destra se si vede il fianco di dritta)
        const prua = (o.aspetto ?? 0) >= 0 ? p.r.x2 : p.r.x1;
        const verso = (o.aspetto ?? 0) >= 0 ? 1 : -1;
        for (let k = 0; k < 3; k++) tela.pixel(prua + verso * k, Math.min(VISTA.orizzonte, p.r.y2) - (k === 0 ? 1 : 0), 15);
      }
    } else if (!o.luci || o.luci.length === 0) {
      // un albero o un periscopio: un tratto scuro sull'orizzonte, col pennacchio se corre
      tela.vline(Math.round(p.x), VISTA.orizzonte - 3, VISTA.orizzonte - 1, 144 + 2);
      if (o.scia) { tela.pixel(Math.round(p.x) - 1, VISTA.orizzonte, 15); tela.pixel(Math.round(p.x) + 1, VISTA.orizzonte, 15); }
    }
    if (o.luci) disegnaLuci(ctx, p);
    if (ui.peri.vista === o.vista) {
      const { x1, y1, x2, y2 } = p.r;
      for (const [cx, cy, dx, dy] of [[x1 - 2, y1 - 2, 1, 1], [x2 + 2, y1 - 2, -1, 1], [x1 - 2, y2 + 2, 1, -1], [x2 + 2, y2 + 2, -1, -1]]) {
        tela.pixel(cx, cy, 15); tela.pixel(cx + dx, cy, 15); tela.pixel(cx, cy + dy, 15);
      }
      // lo stadimetro: l'immagine sdoppiata, con la linea d'acqua della copia sulla testa d'albero
      const s = ui.peri.stadimetro;
      if (s && s.vista === o.vista && ora - s.ora < DURATA_SDOPPIATA && img) {
        const h = p.r.y2 - p.r.y1 + 1;
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < p.r.x2 - p.r.x1 + 1; i++) {
            const sx = Math.min(img.larghezza - 1, Math.floor((i + 0.5) / p.scala));
            const sy = Math.min(img.altezza - 1, Math.floor((j + 0.5) / p.scala));
            const c = img.indici[sy * img.larghezza + (p.specchio ? img.larghezza - 1 - sx : sx)];
            if (c !== SAGOMA_TRASPARENTE && (i + j) % 2 === 0) tela.pixel(p.r.x1 + i, p.r.y1 - h + j, 11);
          }
        }
      }
    }
  }
  reticolo(ctx);
  // l'HUD resta sopra la vista come nel 1989 (033): bussola con la rotta propria, scala della quota
  if (ui.hud) disegnaHud(ctx);
  // il lato verso cui guarda il periscopio, in alto a sinistra (048: «STARBRD»)
  const rel = normalizza360(ui.peri.rotta);
  if (ui.hud) {
    const lato = rel >= 157.5 && rel < 202.5 ? 'AFT' : rel >= 22.5 && rel < 157.5 ? 'STARBRD' : rel >= 202.5 && rel < 337.5 ? 'PORT' : '';
    if (lato) scriviBordato(tela, font, VISTA.x1 + 3, VISTA.y1 + 2, lato, 13, 0);
  }
  const w = paroleVista(ctx);
  scriviBordato(tela, font, w.xi, w.yi, w.ingr, 13, 0);
  scriviBordato(tela, font, w.xs, w.ys, w.stad, 13, 0);
}

/**
 * Le luci di navigazione (regola 21 del COLREG): testa d'albero bianca in cima, fianco di dritta verde e
 * di sinistra rossa a metà altezza, coronamento bianco a poppa. Di notte la sagoma è rossa e scura: le
 * luci (colori EGA, che NIGHT.PAL non cambia) sono quello che si vede.
 * @param {Contesto} ctx @param {{ o: Avvistamento, x: number, r: { x1: number, y1: number, x2: number, y2: number } }} p
 */
function disegnaLuci(ctx, p) {
  const { tela } = ctx;
  const luci = p.o.luci ?? [];
  const destra = (p.o.aspetto ?? 0) >= 0; // fianco di dritta: prua a destra
  const xm = Math.round(p.x), ymezzo = Math.round((p.r.y1 + p.r.y2) / 2);
  const prua = destra ? p.r.x2 - 1 : p.r.x1 + 1, poppa = destra ? p.r.x1 + 1 : p.r.x2 - 1;
  for (const l of luci) {
    if (l === 'testa_d_albero') tela.pixel(xm, p.r.y1, 15);
    else if (l === 'fianco_dritta') tela.pixel(prua, ymezzo, 10);
    else if (l === 'fianco_sinistra') tela.pixel(prua, ymezzo, 12);
    else if (l === 'coronamento') tela.pixel(poppa, ymezzo + 1, 15);
  }
}

/**
 * Il libro di riconoscimento nella finestra: la classe, la sua figura di fianco, l'altezza d'albero, le
 * pale, i radar. Si sfoglia con le frecce della rotazione ('-' e '='), si sceglie con D.
 * @param {Contesto} ctx
 */
function disegnaLibro(ctx) {
  const { tela, font } = ctx;
  tela.riempi(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2, 15);
  tela.rett(FINESTRA.x1 + 1, FINESTRA.y1 + 1, FINESTRA.x2 - 1, FINESTRA.y2 - 1, 8);
  const titolo = ctx.t('ui.peri.libro');
  scrivi(tela, font, 92 - Math.floor(larghezzaTesto(font, titolo) / 2), FINESTRA.y1 + 3, titolo, 0);
  const c = classeLibro(ctx);
  if (!c) {
    const t = ctx.t('locale.libro_assente');
    scrivi(tela, font, 92 - Math.floor(larghezzaTesto(font, t) / 2), 70, t, 8);
    return;
  }
  const l = classiLibro(ctx);
  const i = l.indexOf(c);
  const nome = perIlFont(`${i + 1}/${l.length} ${ctx.t(`classe_media.${c.id}`)}`);
  scrivi(tela, font, FINESTRA.x1 + 4, FINESTRA.y1 + 12, nome.slice(0, 30), 1);
  const img = c.sagoma ? ctx.orig.sagome[`${c.sagoma}2`] : null;
  if (img) {
    const scala = Math.min(1, 156 / img.larghezza, 34 / img.altezza);
    tela.ritaglia(FINESTRA.x1 + 2, FINESTRA.y1 + 20, FINESTRA.x2 - 2, FINESTRA.y1 + 58);
    disegnaFigura(tela, img, 92, FINESTRA.y1 + 56, scala, false, SAGOMA_TRASPARENTE);
    tela.senzaRitaglio();
  }
  const righe = [
    ctx.t('ui.peri.albero', { metri: c.albero !== null ? Math.round(c.albero) : '?', piedi: c.albero !== null ? Math.round(c.albero / 0.3048) : '?' }),
    c.pale !== null ? ctx.t('ui.analisi.pale', { n: c.pale }) : '',
    c.radar.length ? perIlFont(`RADAR: ${c.radar.join(' ')}`).slice(0, 30) : '',
  ].filter(Boolean);
  righe.forEach((r, k) => scrivi(tela, font, FINESTRA.x1 + 4, FINESTRA.y1 + 61 + 8 * k, r, 0));
  const scelta = ctx.t('ui.peri.scegli');
  scrivi(tela, font, FINESTRA.x2 - larghezzaTesto(font, scelta) - 4, FINESTRA.y2 - 8, scelta, 4);
}

/** @param {Contesto} ctx */
function disegnaFinestra(ctx) {
  const { tela, ui } = ctx;
  if (ui.peri.libro) {
    tela.ritaglia(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2);
    disegnaLibro(ctx);
    tela.senzaRitaglio();
    return true;
  }
  if (!alzato(ctx)) return false;
  tela.ritaglia(VISTA.x1, VISTA.y1, VISTA.x2, VISTA.y2);
  disegnaVista(ctx);
  tela.senzaRitaglio();
  return true;
}

// ------------------------------------------------------------------------------------- pannello

/** @param {Contesto} ctx */
function disegna(ctx) {
  const { tela, stato } = ctx;
  const cls = ctx.orig.cls;
  const nave = stato.nave;
  const r = RIQUADRI;
  chiamaRoutine(cls, tela, 'PERI.CLS', 9, [...r.periscopio, nave?.alberi.periscopio ? ' UP' : 'DOWN', 11, 1]);
  chiamaRoutine(cls, tela, 'PERI.CLS', 9, [...r.antenna, nave?.alberi.esm ? ' UP' : 'DOWN', 11, 1]);
  chiamaRoutine(cls, tela, 'PERI.CLS', 9, [...r.gradi, `${treCifre(ctx.ui.peri.rotta)}*`, 11, 1]);
  // ESM LEVEL: il radar più forte che l'albero dell'ESM sente
  const esm = stato.esm;
  const recente = esm && nave && nave.alberi.esm && nave.ora - esm.ora <= 5;
  const livello = recente && esm.emissioni.length ? Math.max(...esm.emissioni.map((e) => e.livello)) : null;
  const accese = spieEsm(livello);
  const s = SPIE_ESM;
  for (let k = 0; k < 10; k++) {
    const x = s.x0 + s.passo * k;
    tela.riempi(x, s.y1, x + s.larghezza - 1, s.y2, k < accese ? s.colori[k] : 8);
  }
}

/** Zone in più nella vista: ingrandimento, stadimetro e la vista stessa. @param {Contesto} ctx @returns {Hotspot[]} */
function hotspotExtra(ctx) {
  if (ctx.ui.peri.libro) {
    const scelta = ctx.t('ui.peri.scegli');
    const x1 = FINESTRA.x2 - larghezzaTesto(ctx.font, scelta) - 5;
    return [{ cursore: 0, x1, y1: FINESTRA.y2 - 9, x2: FINESTRA.x2 - 2, y2: FINESTRA.y2 - 1, colore: 4, tasto: TASTO_STADIMETRO, gruppo: 5 }];
  }
  if (!alzato(ctx)) return [];
  const w = paroleVista(ctx);
  const { font } = ctx;
  return [
    { cursore: 0, x1: w.xi - 1, y1: w.yi - 1, x2: w.xi + larghezzaTesto(font, w.ingr), y2: w.yi + 6, colore: 13, tasto: TASTO_INGRANDIMENTO, gruppo: 5 },
    { cursore: 0, x1: w.xs - 1, y1: w.ys - 1, x2: w.xs + larghezzaTesto(font, w.stad), y2: w.ys + 6, colore: 13, tasto: TASTO_STADIMETRO, gruppo: 5 },
    { cursore: 0, x1: VISTA.x1, y1: VISTA.y1, x2: VISTA.x2, y2: VISTA.y2, colore: 15, tasto: TASTO_VISTA_PERI, gruppo: 6 },
  ];
}

/**
 * La barra del bersaglio al periscopio: l'avvistamento scelto, con la classe e la distanza dello
 * stadimetro se si è misurata.
 * @param {Contesto} ctx
 */
function barraBersaglio(ctx) {
  const nave = ctx.stato.nave;
  const v = ctx.ui.peri.vista;
  if (!nave || v === null || !alzato(ctx)) return null;
  const o = avvistamenti(ctx).find((x) => x.vista === v);
  if (!o) return null;
  const s = ctx.ui.peri.stadimetro;
  const misurata = s && s.vista === v ? s : null;
  const classe = misurata ? ctx.biblioteca.find((c) => c.id === misurata.classe) : null;
  return {
    bersaglio: `${ctx.t('ui.peri.vista', { n: v })}: ${classe ? ctx.t(`classe.${classe.id}`) : '?'}`,
    rilevamento: `${treCifre(o.rilevamento - nave.rotta)}*`,
    distanza: misurata ? migliaBarra(misurata.distanza) : undefined,
  };
}

/**
 * Lo stadimetro sull'avvistamento scelto (o su quello più vicino al centro): senza classe apre il libro.
 * @param {Contesto} ctx
 */
export function stadimetro(ctx) {
  const ui = ctx.ui;
  const lista = avvistamenti(ctx).filter((o) => o.sagoma !== null);
  if (lista.length === 0) {
    ctx.avvisa('locale.peri_nessuna_nave');
    return;
  }
  let o = lista.find((x) => x.vista === ui.peri.vista);
  if (!o) {
    const p = puntamento(ctx);
    o = lista.reduce((a, b) => (Math.abs(normalizza180(a.rilevamento - p)) <= Math.abs(normalizza180(b.rilevamento - p)) ? a : b));
    ui.peri.vista = o.vista;
  }
  if (!ui.peri.libro) {
    ui.peri.libro = true;
    return;
  }
  // scelta dal libro
  ui.peri.libro = false;
  const c = classeLibro(ctx);
  if (!c || c.albero === null) return;
  if (o.elevazione_alberi === null || !(o.elevazione_alberi > 0)) {
    ctx.avvisa(o.sotto_orizzonte ? 'locale.stadimetro_orizzonte' : 'locale.stadimetro_impossibile');
    return;
  }
  const distanza = distanzaStadimetro(c.albero, o.elevazione_alberi);
  ui.peri.stadimetro = { vista: o.vista, classe: c.id, distanza, ora: ctx.ora };
  ctx.avvisa('locale.stadimetro', { distanza, rilevamento: o.rilevamento });
}

/**
 * @param {Contesto} ctx @param {Hotspot} h @param {{ x: number, y: number } | null} punto
 * @param {(s: string) => void} vaiA
 */
function attiva(ctx, h, punto, vaiA) {
  const ui = ctx.ui, nave = ctx.stato.nave;
  // col libro aperto le frecce della rotazione lo sfogliano
  if (ui.peri.libro && (h.tasto === 45 || h.tasto === 61)) {
    ui.peri.classe += h.tasto === 61 ? 1 : -1;
    return true;
  }
  // col periscopio alzato I e O della pulsantiera cambiano l'ingrandimento invece della scala della mappa
  if (h.gruppo === 1 && alzato(ctx) && (h.tasto === 73 || h.tasto === 79)) {
    ui.peri.ingrandimento = h.tasto === 73 ? INGRANDIMENTI.length - 1 : 0;
    return true;
  }
  if (attivaComune(ctx, h, vaiA)) return true;
  switch (h.tasto) {
    case 85: // U: periscopio
      ctx.ordina('albero', { quale: 'periscopio', alzato: !nave?.alberi.periscopio });
      return true;
    case 78: // N: antenna (l'albero dell'ESM)
      ctx.ordina('albero', { quale: 'esm', alzato: !nave?.alberi.esm });
      return true;
    case 45: // '-': brandeggio a sinistra
    case 61: { // '=': a destra
      const passo = campo(ctx) / 2;
      ui.peri.rotta = normalizza360(ui.peri.rotta + (h.tasto === 61 ? passo : -passo));
      return true;
    }
    case 71: { // G: l'avvistamento successivo, e il periscopio ci va
      const lista = [...avvistamenti(ctx)].sort((a, b) => a.vista - b.vista);
      if (!alzato(ctx) || lista.length === 0) {
        ctx.avvisa(alzato(ctx) ? 'locale.peri_nessuna_nave' : 'locale.peri_abbassato');
        return true;
      }
      const i = lista.findIndex((o) => o.vista === ui.peri.vista);
      const o = lista[(i + 1) % lista.length];
      ui.peri.vista = o.vista;
      ui.peri.rotta = Math.round(normalizza360(o.rilevamento - (nave?.rotta ?? 0)) * 10) / 10;
      ctx.avvisa('locale.peri_vista', { n: o.vista, rilevamento: o.rilevamento });
      return true;
    }
    case 76: // L: LAUNCH, con le armi (F3)
      ctx.avvisa('locale.non_disponibile');
      return true;
    case TASTO_INGRANDIMENTO:
      ui.peri.ingrandimento = (ui.peri.ingrandimento + 1) % INGRANDIMENTI.length;
      return true;
    case TASTO_STADIMETRO:
      stadimetro(ctx);
      return true;
    case TASTO_VISTA_PERI: {
      // un clic su una nave la sceglie; altrove il periscopio si centra lì
      const x = punto ? punto.x : VISTA.centro;
      const y = punto ? punto.y : VISTA.orizzonte;
      const su = posizioni(ctx).reverse().find((p) => x >= p.r.x1 - 2 && x <= p.r.x2 + 2 && y >= p.r.y1 - 3 && y <= p.r.y2 + 3);
      if (su) {
        ui.peri.vista = su.o.vista;
        return true;
      }
      const ril = rilevamentoDiX(x, puntamento(ctx), campo(ctx));
      ui.peri.rotta = Math.round(normalizza360(ril - (nave?.rotta ?? 0)) * 10) / 10;
      return true;
    }
    default:
      return false;
  }
}

/** @param {(s: string) => void} vaiA @returns {Stazione} */
export function periscopio(vaiA) {
  return {
    id: 'periscopio',
    lavoro: 'PERI_688',
    cornice: true,
    disegna,
    disegnaFinestra,
    hotspotExtra,
    barraBersaglio,
    attiva: (ctx, h, p) => attiva(ctx, h, p, vaiA),
    esc(ctx) {
      if (ctx.ui.peri.libro) {
        ctx.ui.peri.libro = false;
        return true;
      }
      return false;
    },
  };
}
