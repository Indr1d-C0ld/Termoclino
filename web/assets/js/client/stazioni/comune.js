// @ts-check
/**
 * Ciò che tutte le stazioni del 688 hanno in comune: lo stato dell'interfaccia (zoom, HUD, mirino,
 * bersaglio designato…), la finestra della mappa con l'HUD, la cornice, la pulsantiera della mappa,
 * l'uscita verso la CONN.
 *
 * Una stazione è un oggetto con il lavoro del pannello (cls/pannelli.json), eventuali zone cliccabili
 * in più, una funzione che disegna il suo stato vivo e una che esegue i comandi. Il disegno avviene
 * tutto sulla tela indicizzata 320×200, ogni fotogramma, a partire dal pannello già pronto.
 */
import {
  FINESTRA, CENTRO, SCALE_MAPPA_M, ZOOM_INIZIALE, classiFinestra, disegnaFondale, disegnaBattello,
  disegnaScia, disegnaX, disegnaRombo, puntoAMetaBordo, puntoSulBordo, inSchermo, inMondo, inFinestra,
} from '../resa/mappa.js';
import { disegnaBussola, disegnaScalaQuota } from '../resa/hud.js';
import {
  disegnaBarraBersaglio, disegnaStriscia, disegnaBarraStato, disegnaRigaMessaggi, spegniPulsanti,
  gms, orologio, treCifre, formatoVelocita,
} from '../resa/cornice.js';
import { picchi } from '../resa/cascata.js';
import { scrivi, larghezzaTesto, perIlFont } from '../resa/testo.js';
import { ProiezioneLocale } from '../../../shared/geo.js';
import { normalizza360, nodiInMs, metriInMigliaNautiche } from '../../../shared/units.js';
import { posizioneSoluzione, proprioAllOra } from '../tma.js';

/** @typedef {import('../resa/tela.js').Tela} Tela */
/** @typedef {import('../resa/testo.js').FontGioco} FontGioco */
/** @typedef {import('../resa/risorse.js').Originali} Originali */
/** @typedef {import('../resa/risorse.js').Pannello} Pannello */
/** @typedef {import('../cls.js').Hotspot} Hotspot */
/** @typedef {import('../stato.js').StatoClient} StatoClient */
/** @typedef {import('../resa/mappa.js').Campionatore} Campionatore */
/** @typedef {import('../resa/cascata.js').Riferimento} Riferimento */
/** @typedef {import('../biblioteca.js').Classe} Classe */
/** @typedef {import('../../../shared/tma.js').SoluzionePolare} SoluzionePolare */

/** Codici dei tasti della pulsantiera della mappa (gruppo 1 di ogni stazione). */
export const TASTI_MAPPA = Object.freeze({ P: 80, F: 70, S: 83, I: 73, H: 72, O: 79, C: 67, B: 66, T: 84 });
/** Contour imaging (P, F, S, C): arriva in F2 con il sonar ad alta frequenza. */
/** @type {number[]} */
const MAPPA_SPENTI = [TASTI_MAPPA.P, TASTI_MAPPA.F, TASTI_MAPPA.S, TASTI_MAPPA.C];
/** Uscita verso la CONN. */
export const TASTO_USCITA = 88;

/**
 * Ritratti per ruolo che parla (`rapporto.chi` del protocollo v1): il sonarista (CREW2, 047), chi sta
 * ai timoni (CREW4, l'ufficiale d'immersione di 014), la macchina (CREW3, l'ufficiale davanti ai
 * macchinari di 061). La centrale di tiro (`tiro`, i rapporti della TMA da F2) ha lo stesso
 * ufficiale di 014, che nel 1989 sta al banco del tiro. L'ufficiale di guardia e il navigatore
 * parlano senza foto.
 */
export const RITRATTO_PER_RUOLO = Object.freeze(/** @type {Record<string, string>} */ ({
  sonar: 'equipaggio/CREW2.png',
  timone: 'equipaggio/CREW4.png',
  macchina: 'equipaggio/CREW3.png',
  tiro: 'equipaggio/CREW4.png',
}));

/**
 * @typedef {object} StatoUi
 * @property {string} stazione
 * @property {number} zoom indice in SCALE_MAPPA_M
 * @property {boolean} hud
 * @property {boolean} ombreggiatura
 * @property {boolean} cascataSuSonar la finestra del Sonar mostra la cascata (T passa alla mappa)
 * @property {{ x: number, y: number }} cursore posizione logica del puntatore
 * @property {number | null} fuoco indice dell'hotspot scelto da tastiera
 * @property {{ tipo: 'waypoint', x: number, y: number } | null} mirino
 * @property {{ sensore: 'sfera' | 'towed' | 'entrambi', riferimento: Riferimento, banda: 'larga' | 'stretta' }} cascata
 *   la cascata del Sonar: sensore (V), riferimento (R), banda larga o stretta (FILTER: BAND PASS / NARROW)
 * @property {'lunga' | 'corta'} portataPing portata del prossimo ping (TRGT PULSE)
 * @property {{ aperta: boolean, biblioteca: boolean, classe: number, zoom: number, riga: number | null }} analisi
 *   l'analizzatore nella finestra del Sonar: `biblioteca` sovrappone le righe della classe `classe` (indice
 *   nella biblioteca); `zoom` stringe l'asse delle frequenze (I/O); `riga` la frequenza scelta col puntatore
 * @property {{ rotta: number, ingrandimento: number, vista: number | null,
 *   stadimetro: { vista: number, classe: string, distanza: number, ora: number } | null,
 *   libro: boolean, classe: number }} peri
 *   il periscopio: `rotta` rilevamento RELATIVO a cui è brandeggiato, `vista` l'avvistamento scelto (G),
 *   l'ultima lettura dello stadimetro, il libro di riconoscimento aperto e la classe che vi si guarda
 * @property {{ aperta: boolean, vista: 'punti' | 'mate' | 'elenco', contatto: string | null,
 *   prova: SoluzionePolare | null }} tma la vista TMA nella Navigation Board (T) e la soluzione di prova
 * @property {number} assistenza livello di assistenza voluto (quello in vigore lo dice `stato`)
 * @property {{ rilevamento: number, visto: number, perso: boolean } | null} bersaglio rilevamento VERO
 * @property {{ tutteTracce: boolean, tracciaBersaglio: boolean, proiezione: boolean, minuti: number }} plot
 * @property {{ immagine: string, fino: number } | null} ritratto
 * @property {number} ultimoRitratto
 * @property {boolean} filtroAlto
 * @property {boolean} aiuto
 * @property {boolean} capo
 * @property {string} lingua
 */

/** @param {string} lingua @returns {StatoUi} */
export function uiIniziale(lingua = 'it') {
  return {
    stazione: 'conn',
    zoom: ZOOM_INIZIALE,
    hud: true,
    ombreggiatura: true,
    cascataSuSonar: true,
    cursore: { x: 160, y: 100 },
    fuoco: null,
    mirino: null,
    cascata: { sensore: 'sfera', riferimento: 'relativo', banda: 'larga' },
    portataPing: 'lunga',
    analisi: { aperta: false, biblioteca: false, classe: 0, zoom: 0, riga: null },
    peri: { rotta: 0, ingrandimento: 0, vista: null, stadimetro: null, libro: false, classe: 0 },
    tma: { aperta: false, vista: 'punti', contatto: null, prova: null },
    assistenza: 2,
    bersaglio: null,
    plot: { tutteTracce: true, tracciaBersaglio: false, proiezione: false, minuti: 10 },
    ritratto: null,
    ultimoRitratto: -1e9,
    filtroAlto: false,
    aiuto: false,
    capo: false,
    lingua,
  };
}

/**
 * Tutto quello che serve a una stazione per disegnare e per agire.
 * @typedef {object} Contesto
 * @property {Tela} tela
 * @property {Originali} orig
 * @property {FontGioco} font
 * @property {Pannello} pannello
 * @property {StatoClient} stato
 * @property {StatoUi} ui
 * @property {number} ora secondi (orologio del browser, solo per le animazioni)
 * @property {Campionatore | null} fondale
 * @property {(cosa: string, valore: unknown) => void} ordina manda un `ordine` al server
 * @property {(chiave: string, parametri?: Record<string, unknown>) => void} avvisa messaggio locale nel nastro
 * @property {(chiave: string, parametri?: Record<string, unknown>) => string} t traduce
 * @property {Map<string, unknown>} cache
 * @property {Classe[]} biblioteca le classi del libro delle firme (vuoto finché non è caricato)
 */

/**
 * @typedef {object} Stazione
 * @property {string} id
 * @property {string} lavoro id in cls/pannelli.json
 * @property {boolean} cornice ha la finestra della mappa e le barre
 * @property {(ctx: Contesto) => Hotspot[]} [hotspotExtra] zone cliccabili disegnate dal client
 * @property {(ctx: Contesto) => void} disegna stato vivo della stazione (dopo la cornice)
 * @property {(ctx: Contesto, h: Hotspot, punto: { x: number, y: number } | null) => boolean} attiva
 * @property {(ctx: Contesto) => boolean} [disegnaFinestra] se c'è, disegna la finestra al posto della mappa (true = fatto)
 * @property {(ctx: Contesto) => DatiBersaglio | null} [barraBersaglio] la barra del bersaglio propria della
 *   stazione (il periscopio: l'avvistamento scelto); null = quella comune
 * @property {(ctx: Contesto) => boolean} [esc] Esc che la stazione usa per sé (chiude una sua vista)
 */

/**
 * I valori della barra del bersaglio, già scritti.
 * @typedef {{ bersaglio?: string, rilevamento?: string, distanza?: string, rotta?: string, velocita?: string, quota?: string }} DatiBersaglio
 */

// ---------------------------------------------------------------------------------- mappa

/** Vista corrente: centro sul battello, quantizzato al pixel della scala. @param {Contesto} ctx */
export function vistaMappa(ctx) {
  const n = ctx.stato.nave;
  const mpp = SCALE_MAPPA_M[ctx.ui.zoom];
  const x = n?.x ?? 0, y = n?.y ?? 0;
  return { cx: Math.round(x / mpp) * mpp, cy: Math.round(y / mpp) * mpp, mpp };
}

/** Proiezione per lat/lon, se la partita ha un'origine. @param {Contesto} ctx */
export function proiezione(ctx) {
  const o = ctx.stato.partita?.origine;
  if (!o) return null;
  const k = `proiezione:${o.lat},${o.lon}`;
  let p = /** @type {ProiezioneLocale | undefined} */ (ctx.cache.get(k));
  if (!p) {
    p = new ProiezioneLocale(o.lat, o.lon);
    ctx.cache.set(k, p);
  }
  return p;
}

/**
 * La mappa dall'alto con tutto quello che ci va sopra.
 * @param {Contesto} ctx
 */
export function disegnaMappa(ctx) {
  const { tela, ui, stato } = ctx;
  const nave = stato.nave;
  const v = vistaMappa(ctx);
  tela.ritaglia(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2);
  if (ctx.fondale) {
    const chiave = `fondale:${v.cx},${v.cy},${v.mpp}`;
    let classi = /** @type {Int8Array | undefined} */ (ctx.cache.get(chiave));
    if (!classi) {
      for (const k of ctx.cache.keys()) if (k.startsWith('fondale:')) ctx.cache.delete(k);
      classi = classiFinestra(v, ctx.fondale);
      ctx.cache.set(chiave, classi);
    }
    disegnaFondale(tela, classi, ui.ombreggiatura);
  } else {
    tela.riempi(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2, 0);
  }
  if (!nave) {
    tela.senzaRitaglio();
    return;
  }
  // traccia propria: puntini neri
  if (ui.plot.tutteTracce) {
    for (const p of stato.traccia) {
      const s = inSchermo(v, p.x, p.y);
      tela.pixel(Math.round(s.px), Math.round(s.py), 0);
    }
  }
  // waypoint: cifre magenta (026), unite da puntini se l'autopilota li segue
  const wp = stato.ordinati.waypoint;
  let prec = inSchermo(v, nave.x, nave.y);
  wp.forEach((p, i) => {
    const s = inSchermo(v, p.x, p.y);
    if (stato.ordinati.autopilota) tela.linea(prec.px, prec.py, s.px, s.py, 13, 3, 1);
    prec = s;
    scrivi(tela, ctx.font, Math.round(s.px) - 2, Math.round(s.py) - 2, String(i + 1), 13);
  });
  // rilevamento del bersaglio designato: puntini rossi fino al bordo
  if (ui.bersaglio && !ui.bersaglio.perso) {
    const b = puntoSulBordo(ui.bersaglio.rilevamento);
    tela.linea(CENTRO.x, CENTRO.y, b.px, b.py, 12, 2, 1);
  }
  // contatti di solo rilevamento: la X a metà strada verso il bordo, come nel 1989. Con le tracce
  // dell'equipaggio (v2) le X sono le tracce tenute; prima, i picchi dell'ultimo fotogramma
  if (stato.oraTracce !== null) {
    for (const t of stato.tracce) {
      if (t.stato === 'persa' || !Number.isFinite(t.rilevamento)) continue;
      const m = puntoAMetaBordo(t.rilevamento);
      disegnaX(tela, m.px, m.py);
      if (t.speculare !== null) {
        const q = puntoAMetaBordo(t.speculare);
        disegnaX(tela, q.px, q.py, true);
      }
    }
  } else {
    const f = stato.sonar[0];
    if (f?.sfera) {
      for (const p of picchi(f.sfera.settori, f.sfera.ciechi).slice(0, 6)) {
        const m = puntoAMetaBordo(p.rilevamento);
        disegnaX(tela, m.px, m.py);
      }
    }
    // l'antenna rimorchiata: ogni contatto compare due volte (θ e 2·asse − θ), entrambe deboli
    if (f?.towed && !f.towed.sorda) {
      for (const p of picchi(f.towed.settori, f.towed.ciechi).slice(0, 6)) {
        const m = puntoAMetaBordo(p.rilevamento);
        disegnaX(tela, m.px, m.py, true);
      }
    }
  }
  disegnaEventi(ctx, v);
  disegnaSoluzioni(ctx, v);
  // proiezione della posizione (PLOT PROJ + TIME PROJECTION)
  if (ui.plot.proiezione) {
    const d = nodiInMs(nave.velocita) * 60 * ui.plot.minuti;
    const a = (nave.rotta * Math.PI) / 180;
    const s = inSchermo(v, nave.x + d * Math.sin(a), nave.y + d * Math.cos(a));
    if (inFinestra(s.px, s.py)) disegnaRombo(tela, s.px, s.py, 14);
  }
  disegnaScia(tela, nave.rotta, nave.velocita);
  disegnaBattello(tela);
  if (ui.hud) disegnaHud(ctx);
  tela.senzaRitaglio();
}

/**
 * L'HUD (tasto H): bussola con la rotta propria e scala della quota col fondo e lo strato. Sulla mappa
 * e, come nel 1989 (033), sopra la vista del periscopio.
 * @param {Contesto} ctx
 */
export function disegnaHud(ctx) {
  const nave = ctx.stato.nave;
  if (!nave) return;
  disegnaBussola(ctx.tela, ctx.font, nave.rotta);
  const fondo = nave.profondita_acqua ?? (nave.fondale === null ? null : nave.z + nave.fondale);
  disegnaScalaQuota(ctx.tela, nave.z, fondo, nave.strato);
}

/** Secondi per cui echi, intercettazioni e transitori restano sulla mappa. */
export const DURATA_EVENTI_S = 90;

/**
 * Segni degli eventi recenti sulla mappa: gli echi dei propri ping e del radar (posizioni misurate:
 * rilevamento e distanza), le intercettazioni (rilevamento a tratteggio giallo fino al bordo), i
 * transitori (un tratto magenta lungo il rilevamento), le emissioni radar all'ESM (una tacca gialla sul
 * bordo).
 * @param {Contesto} ctx @param {import('../resa/mappa.js').Vista} v
 */
function disegnaEventi(ctx, v) {
  const { tela, stato } = ctx;
  const nave = stato.nave;
  if (!nave) return;
  const ora = nave.ora;
  /** @param {number} ril @param {number} dist @param {number} t @param {number} colore */
  const segno = (ril, dist, t, colore) => {
    const p = proprioAllOra(stato, t) ?? nave;
    const a = (ril * Math.PI) / 180;
    const sc = inSchermo(v, p.x + dist * Math.sin(a), p.y + dist * Math.cos(a));
    if (!inFinestra(sc.px, sc.py)) return;
    const x = Math.round(sc.px), y = Math.round(sc.py);
    tela.rett(x - 2, y - 2, x + 2, y + 2, 0);
    tela.riempi(x - 1, y - 1, x + 1, y + 1, colore);
  };
  for (const p of stato.ping) {
    if (ora - p.ora > DURATA_EVENTI_S) break;
    for (const e of p.echi) segno(e.rilevamento, e.distanza, e.ora, 15);
  }
  if (stato.radar && ora - stato.radar.ora < 10) for (const e of stato.radar.echi) segno(e.rilevamento, e.distanza, stato.radar.ora, 14);
  for (const i of stato.intercetti) {
    if (ora - i.ora > DURATA_EVENTI_S) break;
    const b = puntoSulBordo(i.rilevamento);
    tela.linea(CENTRO.x, CENTRO.y, b.px, b.py, 14, 3, 2);
  }
  for (const t of stato.transitori) {
    if (ora - t.ora > DURATA_EVENTI_S) break;
    const m = puntoAMetaBordo(t.rilevamento), b = puntoSulBordo(t.rilevamento);
    tela.linea(m.px, m.py, b.px, b.py, 13, 2, 0);
  }
  if (nave.alberi.esm && stato.esm && ora - stato.esm.ora < 5) {
    for (const e of stato.esm.emissioni) {
      const b = puntoSulBordo(e.rilevamento), m = puntoAMetaBordo(e.rilevamento);
      const dx = (m.px - b.px) / 10, dy = (m.py - b.py) / 10;
      tela.linea(b.px, b.py, b.px + 4 * dx, b.py + 4 * dy, 14);
    }
  }
}

/**
 * Le soluzioni sulla mappa: la posizione stimata ADESSO (portata avanti col moto della soluzione), un
 * cerchio con la designazione accanto. Come le lettere del 1989: verde la soluzione esatta del livello
 * 3, blu quella dell'equipaggio (con l'ellisse d'incertezza al 90 % a puntini), magenta quella del
 * comandante. Con TARGET TRACK la rotta della soluzione del bersaglio designato a puntini rossi, con
 * PLOT PROJ il rombo rosso della sua posizione fra TIME PROJ minuti (024, 064).
 * @param {Contesto} ctx @param {import('../resa/mappa.js').Vista} v
 */
function disegnaSoluzioni(ctx, v) {
  const { tela, stato, ui, font } = ctx;
  const nave = stato.nave;
  if (!nave) return;
  const designato = designatoDi(ctx);
  for (const sol of Object.values(stato.soluzioni)) {
    const t = stato.tracce.find((x) => x.contatto === sol.contatto);
    if (stato.oraTracce !== null && !t && !sol.esatta) continue; // traccia abbandonata o persa da tempo
    const p = posizioneSoluzione(stato, sol, nave.ora);
    if (!p) continue;
    const sc = inSchermo(v, p.x, p.y);
    const colore = sol.esatta ? 10 : sol.origine === 'comandante' ? 13 : 9;
    if (sol.ellisse && !sol.esatta) disegnaEllisse(tela, sc.px, sc.py, sol.ellisse, v.mpp, 9);
    if (sol.contatto === designato) {
      const vmin = (sol.velocita * 1852) / 60;
      const a = (sol.rotta * Math.PI) / 180;
      if (ui.plot.tracciaBersaglio) {
        const da = inSchermo(v, p.x - vmin * 10 * Math.sin(a), p.y - vmin * 10 * Math.cos(a));
        tela.linea(da.px, da.py, sc.px, sc.py, 12, 2, 0);
      }
      if (ui.plot.proiezione) {
        const q = inSchermo(v, p.x + vmin * ui.plot.minuti * Math.sin(a), p.y + vmin * ui.plot.minuti * Math.cos(a));
        if (inFinestra(q.px, q.py)) disegnaRombo(tela, q.px, q.py, 12);
      }
    }
    if (!inFinestra(sc.px, sc.py)) continue;
    const x = Math.round(sc.px), y = Math.round(sc.py);
    for (let k = 0; k < 16; k++) {
      const ang = (k * Math.PI) / 8;
      tela.pixel(Math.round(x + 3.5 * Math.cos(ang)), Math.round(y + 3.5 * Math.sin(ang)), colore);
    }
    tela.pixel(x, y, colore);
    scrivi(tela, font, x + 5, y - 2, perIlFont(sol.contatto), colore);
  }
}

/**
 * Ellisse d'incertezza a puntini: semiassi in metri, orientamento = rilevamento vero del semiasse
 * maggiore (shared/tma.js `ellisse`).
 * @param {Tela} tela @param {number} cx @param {number} cy
 * @param {{ asse_lungo: number, asse_corto: number, orientamento: number }} e @param {number} mpp @param {number} colore
 */
export function disegnaEllisse(tela, cx, cy, e, mpp, colore) {
  const a = e.asse_lungo / mpp, b = e.asse_corto / mpp;
  if (!(a > 1)) return;
  const o = (e.orientamento * Math.PI) / 180;
  // asse maggiore lungo il rilevamento `orientamento`: in schermo (sin o, −cos o)
  const ux = Math.sin(o), uy = -Math.cos(o);
  const n = Math.min(120, Math.max(16, Math.round(a * 1.5)));
  for (let k = 0; k < n; k += 2) {
    const t = (2 * Math.PI * k) / n;
    const pa = a * Math.cos(t), pb = b * Math.sin(t);
    tela.pixel(Math.round(cx + pa * ux - pb * uy), Math.round(cy + pa * uy + pb * ux), colore);
  }
}

/** Il contatto designato (dal server, o lo specchio dell'ordine appena dato). @param {Contesto} ctx */
export function designatoDi(ctx) {
  return ctx.stato.ordinati.designato;
}

/**
 * La classe di una traccia come la vede il comandante: la sua classificazione, se no quella
 * dell'equipaggio.
 * @param {StatoClient} stato @param {string} contatto
 * @returns {{ classe: string | null, da: 'comandante' | 'equipaggio' | null, confidenza: number | null }}
 */
export function classeDi(stato, contatto) {
  if (Object.hasOwn(stato.ordinati.classifiche, contatto) && stato.ordinati.classifiche[contatto] !== null) {
    return { classe: stato.ordinati.classifiche[contatto], da: 'comandante', confidenza: null };
  }
  const t = stato.tracce.find((x) => x.contatto === contatto);
  if (t?.classe_comandante) return { classe: t.classe_comandante, da: 'comandante', confidenza: null };
  if (t?.classe) return { classe: t.classe, da: 'equipaggio', confidenza: t.confidenza };
  return { classe: null, da: null, confidenza: null };
}

/**
 * Distanza in miglia come la scriveva il gioco nella barra del bersaglio: un decimale, sotto il miglio
 * «.4» (ORIGINALE.md §1).
 * @param {number} metri
 */
export function migliaBarra(metri) {
  const m = metriInMigliaNautiche(metri);
  const s = m.toFixed(1);
  return m < 1 ? s.slice(1) : s;
}

/**
 * Ritratto dell'equipaggio al posto della finestra (014, 047): la riga più bassa della foto sta
 * sull'ultima riga della finestra (y 120) e le righe in cima che non ci stanno restano tagliate.
 * Misurato su 014: CREW4 (96 righe) va da y 25, e i pixel coincidono tutti.
 * @param {Contesto} ctx @param {string} percorso
 */
export function disegnaRitratto(ctx, percorso) {
  const img = ctx.orig.immagini[percorso];
  if (!img) return;
  const { tela } = ctx;
  tela.ritaglia(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2);
  tela.riempi(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2, 0);
  tela.incolla(img.indici, img.larghezza, FINESTRA.x1, FINESTRA.y2 - (img.altezza - 1));
  tela.senzaRitaglio();
}

// ---------------------------------------------------------------------------------- bersaglio

/** Secondi per cui l'eco di un ping dà la distanza nella barra del bersaglio. */
export const DURATA_ECO_BARRA_S = 120;

/**
 * La distanza dell'eco più recente vicino a un rilevamento (entro 6°), se c'è.
 * @param {StatoClient} stato @param {number} rilevamento vero @param {number} ora
 * @returns {number | null} m
 */
export function ecoVicino(stato, rilevamento, ora) {
  for (const p of stato.ping) {
    if (ora - p.ora > DURATA_ECO_BARRA_S) break;
    let migliore = null, dmin = 6;
    for (const e of p.echi) {
      const d = Math.abs(((e.rilevamento - rilevamento + 540) % 360) - 180);
      if (d <= dmin) { dmin = d; migliore = e.distanza; }
    }
    if (migliore !== null) return migliore;
  }
  return null;
}

/**
 * La barra del bersaglio comune: il contatto designato (classe, rilevamento della traccia, distanza,
 * rotta e velocità della soluzione o, senza soluzione, la distanza dell'eco), oppure il rilevamento
 * scelto sulla cascata. Il rilevamento è relativo alla prua, come nel 1989.
 * @param {Contesto} ctx
 * @returns {DatiBersaglio | null}
 */
export function datiBersaglio(ctx) {
  const { stato, ui } = ctx;
  const nave = stato.nave;
  if (!nave) return null;
  const rel = (/** @type {number} */ vero) => `${treCifre(vero - nave.rotta)}*`;
  const d = designatoDi(ctx);
  if (d) {
    const t = stato.tracce.find((x) => x.contatto === d);
    // persa, o non più fra le tracce dell'equipaggio
    const perso = t ? t.stato === 'persa' : stato.oraTracce !== null;
    const cl = classeDi(stato, d);
    const nomeClasse = cl.classe ? ctx.t(`classe.${cl.classe}`) : ctx.t('ui.classe_ignota');
    /** @type {DatiBersaglio} */
    const out = { bersaglio: `${d}: ${perso ? ctx.t('ui.contatto_perso') : nomeClasse}` };
    let ril = t && Number.isFinite(t.rilevamento) ? t.rilevamento : null;
    // di un contatto perso la barra dice solo che è perso (come «CONTACT HAS BEEN LOST» del 1989)
    if (perso) return out;
    const sol = stato.soluzioni[d];
    const p = sol ? posizioneSoluzione(stato, sol, nave.ora) : null;
    if (sol && p) {
      out.distanza = migliaBarra(Math.hypot(p.x - nave.x, p.y - nave.y));
      out.rotta = `${treCifre(sol.rotta)}*`;
      // dieci nodi e oltre senza decimali: nella barra del 1989 «16.5» finirebbe sopra DPT
      out.velocita = sol.velocita >= 9.95 ? String(Math.round(sol.velocita)) : formatoVelocita(sol.velocita);
      if (ril === null) ril = normalizza360((Math.atan2(p.x - nave.x, p.y - nave.y) * 180) / Math.PI);
    }
    if (!out.distanza && ril !== null) {
      const e = ecoVicino(stato, ril, nave.ora);
      if (e !== null) out.distanza = migliaBarra(e);
    }
    if (ril !== null) out.rilevamento = rel(ril);
    return out;
  }
  const b = ui.bersaglio;
  if (!b) return null;
  /** @type {DatiBersaglio} */
  const out = {
    bersaglio: ctx.t(b.perso ? 'ui.contatto_perso' : 'ui.contatto_sonar'),
    rilevamento: b.perso ? '' : rel(b.rilevamento),
  };
  const e = b.perso ? null : ecoVicino(stato, b.rilevamento, nave.ora);
  if (e !== null) out.distanza = migliaBarra(e);
  return out;
}

/**
 * Tiene agganciato il bersaglio designato al picco più vicino del fotogramma sonar più recente
 * (entro 8°); dopo 15 s senza un picco il contatto è perso.
 * @param {Contesto} ctx
 */
export function seguiBersaglio(ctx) {
  // un contatto designato: il rilevamento è quello della traccia dell'equipaggio
  const d = designatoDi(ctx);
  const t = d ? ctx.stato.tracce.find((x) => x.contatto === d) : null;
  if (t && Number.isFinite(t.rilevamento)) {
    ctx.ui.bersaglio = { rilevamento: t.rilevamento, visto: ctx.stato.oraTracce ?? 0, perso: t.stato === 'persa' };
    return;
  }
  const b = ctx.ui.bersaglio, f = ctx.stato.sonar[0];
  if (!b || !f || !f.sfera) return;
  if (ctx.cache.get('bersaglio:ora') === f.ora) return;
  ctx.cache.set('bersaglio:ora', f.ora);
  let migliore = null, dmin = 8;
  for (const p of picchi(f.sfera.settori, f.sfera.ciechi)) {
    const d = Math.abs(((p.rilevamento - b.rilevamento + 540) % 360) - 180);
    if (d <= dmin) { dmin = d; migliore = p.rilevamento; }
  }
  if (migliore !== null) {
    ctx.ui.bersaglio = { rilevamento: migliore, visto: f.ora, perso: false };
  } else if (!b.perso && f.ora - b.visto > 15) {
    ctx.ui.bersaglio = { ...b, perso: true };
    ctx.avvisa('locale.contatto_perso');
  }
}

/**
 * TARGET (G): designa il picco successivo, dal più forte (Tab nel mirino del 1989).
 * @param {Contesto} ctx
 */
export function designaProssimo(ctx) {
  // con le tracce dell'equipaggio (v2) si designa una traccia: l'ordine `designa` la rende il
  // riferimento di tutte le stazioni (barra, analizzatore, TMA)
  const tracce = ctx.stato.tracce.filter((t) => t.stato !== 'persa');
  if (tracce.length > 0) {
    const att = designatoDi(ctx);
    const i = tracce.findIndex((t) => t.contatto === att);
    const prossima = tracce[(i + 1) % tracce.length];
    ctx.ordina('designa', prossima.contatto);
    ctx.ui.bersaglio = { rilevamento: prossima.rilevamento, visto: ctx.stato.oraTracce ?? 0, perso: false };
    return;
  }
  const f = ctx.stato.sonar[0];
  const lista = f?.sfera ? picchi(f.sfera.settori, f.sfera.ciechi).map((p) => normalizza360(p.rilevamento)) : [];
  if (!f || lista.length === 0) {
    ctx.avvisa('locale.nessun_contatto');
    return;
  }
  const att = ctx.ui.bersaglio;
  let i = 0;
  if (att && !att.perso) {
    const j = lista.findIndex((r) => Math.abs(((r - att.rilevamento + 540) % 360) - 180) < 3);
    i = j < 0 ? 0 : (j + 1) % lista.length;
  }
  ctx.ui.bersaglio = { rilevamento: lista[i], visto: f.ora, perso: false };
  ctx.avvisa('locale.bersaglio_acquisito');
}

// ---------------------------------------------------------------------------------- cornice

/**
 * Disegna la cornice comune: finestra (mappa, ritratto o quella della stazione), barre, nastro.
 * @param {Contesto} ctx @param {Stazione} st @param {{ disegna: (t: Tela, f: FontGioco) => void }} nastro
 */
export function disegnaCornice(ctx, st, nastro) {
  const { tela, ui, stato, font } = ctx;
  const nave = stato.nave;
  seguiBersaglio(ctx);
  const ritratto = ui.ritratto && ui.ritratto.fino > ctx.ora ? ui.ritratto.immagine : null;
  if (ritratto) disegnaRitratto(ctx, ritratto);
  else if (!(st.disegnaFinestra && st.disegnaFinestra(ctx))) disegnaMappa(ctx);
  if (!nave) {
    const testo = ctx.t('locale.attesa_partita');
    scrivi(tela, font, CENTRO.x - Math.floor(larghezzaTesto(font, testo) / 2), CENTRO.y - 2, testo, 7);
  }
  if (nave) {
    disegnaStriscia(tela, font, nave.rotta, nave.velocita, nave.z);
    const dati = st.barraBersaglio?.(ctx) ?? datiBersaglio(ctx);
    if (dati) disegnaBarraBersaglio(tela, font, dati);
    const p = proiezione(ctx);
    const ora = orologio(nave.ora);
    if (p) {
      const g = p.inGeografiche(nave.x, nave.y);
      disegnaBarraStato(tela, font, gms(g.lat, 'lat'), gms(g.lon, 'lon'), ora);
    } else {
      disegnaBarraStato(tela, font, null, null, ora);
    }
  }
  // mirino: la riga dei messaggi mostra le coordinate del punto, come in 025
  if (ui.mirino) {
    const v = vistaMappa(ctx);
    const m = inMondo(v, ui.mirino.x, ui.mirino.y);
    const p = proiezione(ctx);
    if (p) {
      const g = p.inGeografiche(m.x, m.y);
      const a = gms(g.lat, 'lat'), o = gms(g.lon, 'lon');
      disegnaRigaMessaggi(tela, font, `${a.testo}${a.emisfero} ${o.testo}${o.emisfero}`);
    } else {
      disegnaRigaMessaggi(tela, font, `${(m.x / 1000).toFixed(1)}X ${(m.y / 1000).toFixed(1)}Y`);
    }
  } else {
    nastro.disegna(tela, font);
  }
  spegniPulsanti(tela, ctx.pannello.hotspot.filter((h) => h.gruppo === 1 && MAPPA_SPENTI.includes(h.tasto)));
}

/**
 * Comandi comuni: pulsantiera della mappa e uscita. Restituisce true se il comando è stato preso.
 * @param {Contesto} ctx @param {Hotspot} h @param {(stazione: string) => void} vaiA
 */
export function attivaComune(ctx, h, vaiA) {
  const ui = ctx.ui;
  if (h.tasto === TASTO_USCITA && h.gruppo === 0) {
    vaiA('conn');
    return true;
  }
  if (h.gruppo !== 1) return false;
  switch (h.tasto) {
    case TASTI_MAPPA.I:
      if (ui.zoom === 0) ctx.avvisa('locale.zoom_minimo');
      else ui.zoom--;
      return true;
    case TASTI_MAPPA.O:
      if (ui.zoom === SCALE_MAPPA_M.length - 1) ctx.avvisa('locale.zoom_massimo');
      else ui.zoom++;
      return true;
    case TASTI_MAPPA.H:
      ui.hud = !ui.hud;
      return true;
    case TASTI_MAPPA.B:
      ui.ombreggiatura = !ui.ombreggiatura;
      return true;
    case TASTI_MAPPA.T:
      // T: la finestra della stazione e la carta (Sonar: cascata e analizzatore; Navigation Board: TMA)
      if (ui.stazione === 'sonar') ui.cascataSuSonar = !ui.cascataSuSonar;
      if (ui.stazione === 'navigazione') ui.tma.aperta = !ui.tma.aperta;
      return true;
    default:
      if (MAPPA_SPENTI.includes(h.tasto)) {
        ctx.avvisa('locale.non_disponibile');
        return true;
      }
      return false;
  }
}

/**
 * Mostra un ritratto per qualche secondo, se è passato abbastanza tempo dall'ultimo.
 * @param {StatoUi} ui @param {string} ruolo @param {number} ora
 */
export function ritrattoPer(ui, ruolo, ora) {
  const img = RITRATTO_PER_RUOLO[ruolo];
  if (!img || ora - ui.ultimoRitratto < 8) return;
  ui.ritratto = { immagine: img, fino: ora + 2 };
  ui.ultimoRitratto = ora;
}
