// @ts-check
/**
 * Sonar (F8): il pannello originale (SONAR COMPUTER, SONAR CONTROLS, TARGET) e, nella finestra della
 * mappa, la cascata a banda larga della sfera di prua e dell'antenna rimorchiata.
 *
 * Zone cliccabili di SONAR.CLS (lavoro SONAR_688): 200 FILTER, 201 ACTIVE, 203 TOWED ARRAY (gruppo 2);
 * 205 ANALYZE (gruppo 3); G TARGET (gruppo 4). I pulsanti FILTER e TOWED ARRAY li disegnava il codice
 * C: qui li ridisegna la routine 6 di SONAR.CLS (la stessa di TRGT PULSE) con le coordinate misurate
 * sulle catture 046 e 050.
 *
 * In più, disegnate dal client nella testata della cascata: V cambia sensore (sfera, antenna,
 * entrambi), R cambia riferimento (relativo alla prua o vero); un clic sulla cascata designa il
 * rilevamento sotto il puntatore. T sulla pulsantiera passa dalla cascata alla mappa e ritorno.
 * L'analizzatore a 16 barre resta spento fino a F2 (righe tonali).
 */
import { chiamaRoutine } from '../resa/risorse.js';
import { attivaComune, designaProssimo, ritrattoPer } from './comune.js';
import { FINESTRA } from '../resa/mappa.js';
import {
  COLONNE, COLONNA_CENTRO, rigaCascata, colonnaDiRilevamento, rilevamentoDiColonna,
} from '../resa/cascata.js';
import { scrivi, larghezzaTesto } from '../resa/testo.js';
import { normalizza360 } from '../../../shared/units.js';

/** @typedef {import('./comune.js').Contesto} Contesto */
/** @typedef {import('./comune.js').Stazione} Stazione */
/** @typedef {import('../cls.js').Hotspot} Hotspot */
/** @typedef {import('../stato.js').FotogrammaSonar} FotogrammaSonar */

/**
 * Testata della cascata: in alto sensore e riferimento (cliccabili), sotto le etichette dei
 * rilevamenti e le tacche; poi le righe dei dati, 79 secondi di storia.
 */
export const TESTATA = Object.freeze({ y1: FINESTRA.y1, y2: 41, parole: 29, etichette: 35, tacche: 40 });
export const RIGHE = Object.freeze({ y1: 42, y2: FINESTRA.y2 });
/** Tasti delle zone aggiunte dal client: V sensore, R riferimento, 250 il corpo della cascata. */
export const TASTO_VISTA = 86, TASTO_RIFERIMENTO = 82, TASTO_CASCATA = 250;

/**
 * Riga cacheata di un fotogramma per sensore e riferimento.
 * @param {Contesto} ctx @param {FotogrammaSonar} f @param {'sfera' | 'towed'} sensore
 */
function riga(ctx, f, sensore) {
  const rif = ctx.ui.cascata.riferimento;
  const k = `cascata:${sensore}:${rif}`;
  let wm = /** @type {WeakMap<FotogrammaSonar, Uint8Array> | undefined} */ (ctx.cache.get(k));
  if (!wm) {
    wm = new WeakMap();
    ctx.cache.set(k, wm);
  }
  let r = wm.get(f);
  if (!r) {
    const s = f[sensore];
    r = s ? rigaCascata(s.settori, s.ciechi, rif, f.rotta) : new Uint8Array(COLONNE);
    wm.set(f, r);
  }
  return r;
}

/**
 * Un riquadro della cascata fra y1 e y2: la riga più recente in alto.
 * @param {Contesto} ctx @param {'sfera' | 'towed'} sensore @param {number} y1 @param {number} y2
 */
function pannelloCascata(ctx, sensore, y1, y2) {
  const { tela, stato, font, ui } = ctx;
  const nave = stato.nave;
  if (sensore === 'towed' && nave && (!nave.towed || nave.towed.stato !== 'filata')) {
    const st = nave.towed?.stato ?? 'assente';
    const testo = ctx.t(`ui.cascata.${st}`, { metri: Math.round(nave.towed?.filato_m ?? 0) });
    const w = larghezzaTesto(font, testo);
    scrivi(tela, font, 92 - Math.floor(w / 2), Math.floor((y1 + y2) / 2) - 2, testo, 8);
    return;
  }
  const n = y2 - y1 + 1;
  for (let i = 0; i < n && i < stato.sonar.length; i++) {
    const f = stato.sonar[i];
    if (!f[sensore]) continue;
    const r = riga(ctx, f, sensore);
    tela.px.set(r, (y1 + i) * 320 + FINESTRA.x1);
  }
  // antenna rimorchiata: l'asse di simmetria dello speculare (`asse`, verso prua), a puntini magenta, e
  // SORDA quando l'antenna non ascolta (accostata, velocità)
  const ultimo = stato.sonar.find((f) => f[sensore])?.[sensore];
  if (sensore === 'towed' && ultimo) {
    if (ultimo.asse !== null) {
      const c = colonnaDiRilevamento(ultimo.asse, ui.cascata.riferimento, nave?.rotta ?? 0);
      if (c !== null) for (let y = y1; y <= y2; y += 3) tela.pixel(FINESTRA.x1 + Math.floor(c), y, 13);
    }
    if (ultimo.sorda) scrivi(tela, font, FINESTRA.x1 + 3, y1 + 2, ctx.t('ui.cascata.sorda'), 13);
  }
}

/** Testata: tacche ogni 30°, etichette ogni 90°, sensore a sinistra e riferimento a destra. @param {Contesto} ctx */
function testata(ctx) {
  const { tela, font, ui, stato } = ctx;
  const rotta = stato.nave?.rotta ?? 0;
  const rif = ui.cascata.riferimento;
  tela.riempi(FINESTRA.x1, TESTATA.y1, FINESTRA.x2, TESTATA.y2, 0);
  for (let g = 0; g < 360; g += 10) {
    // in relativo le tacche segnano i rilevamenti relativi, in vero quelli veri
    const vero = rif === 'relativo' ? rotta + g : g;
    const c = colonnaDiRilevamento(vero, rif, rotta);
    if (c === null) continue;
    const x = FINESTRA.x1 + Math.floor(c);
    const lunga = g % 30 === 0;
    tela.vline(x, lunga ? TESTATA.tacche : TESTATA.tacche + 1, TESTATA.y2, lunga ? 7 : 8);
    if (g % 90 === 0) {
      const testo = String(g).padStart(3, '0');
      const w = larghezzaTesto(font, testo) - 1;
      const xe = Math.max(FINESTRA.x1 + 1, Math.min(FINESTRA.x2 - w, x - Math.floor(w / 2)));
      scrivi(tela, font, xe, TESTATA.etichette, testo, 7);
    }
  }
  scrivi(tela, font, FINESTRA.x1 + 3, TESTATA.parole, ctx.t(`ui.cascata.${ui.cascata.sensore}`), 13);
  const r = ctx.t(`ui.cascata.${rif}`);
  scrivi(tela, font, FINESTRA.x2 - larghezzaTesto(font, r) - 1, TESTATA.parole, r, 13);
  // bersaglio designato: triangolino magenta sopra la sua colonna, con il rilevamento
  const b = ui.bersaglio;
  if (b && !b.perso) {
    const c = colonnaDiRilevamento(b.rilevamento, rif, rotta);
    if (c !== null) {
      const x = FINESTRA.x1 + Math.floor(c);
      tela.hline(TESTATA.parole, x - 2, x + 2, 13);
      tela.hline(TESTATA.parole + 1, x - 1, x + 1, 13);
      tela.pixel(x, TESTATA.parole + 2, 13);
    }
  }
}

/** La finestra del Sonar. @param {Contesto} ctx */
function disegnaFinestra(ctx) {
  if (!ctx.ui.cascataSuSonar) return false;
  const { tela, ui, stato } = ctx;
  tela.ritaglia(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2);
  tela.riempi(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2, 0);
  testata(ctx);
  const s = ui.cascata.sensore;
  if (stato.sonar.length === 0) {
    const testo = ctx.t('ui.cascata.attesa');
    scrivi(tela, ctx.font, 92 - Math.floor(larghezzaTesto(ctx.font, testo) / 2), 76, testo, 8);
  } else if (s === 'entrambi') {
    const meta = Math.floor((RIGHE.y1 + RIGHE.y2) / 2);
    pannelloCascata(ctx, 'sfera', RIGHE.y1, meta - 1);
    tela.hline(meta, FINESTRA.x1, FINESTRA.x2, 8);
    pannelloCascata(ctx, 'towed', meta + 1, RIGHE.y2);
  } else {
    pannelloCascata(ctx, s, RIGHE.y1, RIGHE.y2);
  }
  // linea della prua (relativo) o della rotta (vero), a puntini, per orientarsi
  const rotta = stato.nave?.rotta ?? 0;
  const cp = ui.cascata.riferimento === 'relativo' ? COLONNA_CENTRO : colonnaDiRilevamento(rotta, 'vero', rotta);
  if (cp !== null) for (let y = RIGHE.y1; y <= RIGHE.y2; y += 4) tela.pixel(FINESTRA.x1 + Math.floor(cp), y, 7);
  tela.senzaRitaglio();
  return true;
}

/** @param {Contesto} ctx */
function disegna(ctx) {
  const nave = ctx.stato.nave;
  const cls = ctx.orig.cls, tela = ctx.tela;
  // FILTER (riquadro 77..136, misurato su 046 e 051)
  chiamaRoutine(cls, tela, 'SONAR.CLS', 6, [77, 153, 136, 165, ctx.ui.filtroAlto ? 'HIGH PASS' : 'BAND PASS', 11, 1]);
  // TOWED ARRAY: RETRIEVE mentre è fuori o esce, DEPLOY altrimenti (riquadro 232..285, 046 e 050)
  const fuori = nave?.towed && (nave.towed.stato === 'filata' || nave.towed.stato === 'in_filare');
  chiamaRoutine(cls, tela, 'SONAR.CLS', 6, [232, 153, 285, 165, fuori ? 'RETRIEVE' : ' DEPLOY', 11, 1]);
}

/** Zone in più: i due interruttori della testata e il corpo della cascata. @param {Contesto} ctx @returns {Hotspot[]} */
function hotspotExtra(ctx) {
  if (!ctx.ui.cascataSuSonar) return [];
  return [
    { cursore: 0, x1: FINESTRA.x1, y1: TESTATA.y1, x2: FINESTRA.x1 + 34, y2: TESTATA.etichette - 2, colore: 13, tasto: TASTO_VISTA, gruppo: 5 },
    { cursore: 0, x1: FINESTRA.x2 - 28, y1: TESTATA.y1, x2: FINESTRA.x2, y2: TESTATA.etichette - 2, colore: 13, tasto: TASTO_RIFERIMENTO, gruppo: 5 },
    { cursore: 0, x1: FINESTRA.x1, y1: RIGHE.y1, x2: FINESTRA.x2, y2: RIGHE.y2, colore: 15, tasto: TASTO_CASCATA, gruppo: 6 },
  ];
}

/**
 * @param {Contesto} ctx @param {Hotspot} h @param {{ x: number, y: number } | null} punto
 * @param {(s: string) => void} vaiA
 */
function attiva(ctx, h, punto, vaiA) {
  if (attivaComune(ctx, h, vaiA)) return true;
  const ui = ctx.ui, nave = ctx.stato.nave;
  switch (h.tasto) {
    case 200:
      ui.filtroAlto = !ui.filtroAlto;
      ctx.avvisa('locale.non_disponibile');
      return true;
    case 201:
      ctx.avvisa('locale.non_disponibile');
      return true;
    case 203: {
      if (nave && !nave.towed) {
        ctx.avvisa('locale.senza_towed');
        return true;
      }
      const st = nave?.towed?.stato ?? 'stivata';
      ctx.ordina('towed', st === 'filata' || st === 'in_filare' ? 'ritira' : 'fila');
      return true;
    }
    case 205:
      ritrattoPer(ui, 'sonar', ctx.ora);
      ctx.avvisa('locale.non_disponibile');
      return true;
    case 71:
      designaProssimo(ctx);
      return true;
    case TASTO_VISTA:
      ui.cascata.sensore = ui.cascata.sensore === 'sfera' ? 'towed' : ui.cascata.sensore === 'towed' ? 'entrambi' : 'sfera';
      return true;
    case TASTO_RIFERIMENTO:
      ui.cascata.riferimento = ui.cascata.riferimento === 'relativo' ? 'vero' : 'relativo';
      return true;
    case TASTO_CASCATA: {
      const x = punto ? punto.x : (h.x1 + h.x2) / 2;
      const rotta = nave?.rotta ?? 0;
      const vero = rilevamentoDiColonna(Math.floor(x) - FINESTRA.x1, ui.cascata.riferimento, rotta);
      ui.bersaglio = { rilevamento: normalizza360(vero), visto: ctx.stato.sonar[0]?.ora ?? 0, perso: false };
      return true;
    }
    default:
      return false;
  }
}

/** @param {(s: string) => void} vaiA @returns {Stazione} */
export function sonar(vaiA) {
  return {
    id: 'sonar',
    lavoro: 'SONAR_688',
    cornice: true,
    disegna,
    hotspotExtra,
    disegnaFinestra,
    attiva: (ctx, h, p) => attiva(ctx, h, p, vaiA),
  };
}
