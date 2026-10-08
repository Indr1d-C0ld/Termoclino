// @ts-check
/**
 * Sonar (F8): il pannello originale (SONAR COMPUTER, SONAR CONTROLS, TARGET) e, nella finestra della
 * mappa, la cascata della sfera di prua e dell'antenna rimorchiata o l'analizzatore (LOFAR e DEMON del
 * fascio puntato) con il libro delle firme.
 *
 * Zone cliccabili di SONAR.CLS (lavoro SONAR_688): 200 FILTER, 201 ACTIVE, 203 TOWED ARRAY (gruppo 2);
 * 205 ANALYZE (gruppo 3); G TARGET (gruppo 4). I pulsanti FILTER, ACTIVE e TOWED ARRAY li disegnava il
 * codice C: qui li ridisegna la routine 6 di SONAR.CLS con le coordinate misurate sulle catture 046,
 * 050 e 051.
 *
 *  - FILTER: banda larga («BAND PASS», come nel 1989) o banda stretta («NARROW»: la riga tonale più forte
 *    per settore, ogni 4 s, protocollo v2), per la cascata;
 *  - ACTIVE (TRGT PULSE): un ping sul contatto designato o sul rilevamento scelto, se sta nel settore di
 *    trasmissione di prua (±60°), altrimenti su tutto il settore; la portata (lunga/corta) si sceglie
 *    nella testata della cascata. Mentre si ascolta l'eco la scritta diventa gialla. Gli echi danno
 *    distanza e rilevamento nella barra del bersaglio e un segno bianco sulla cascata e sulla mappa;
 *  - ANALYZE: accende l'analizzatore sul contatto designato (o sul rilevamento scelto sulla cascata) e
 *    lo mostra nella finestra; di nuovo, lo spegne. Le 16 barre del SONAR COMPUTER mostrano lo spettro
 *    del fascio come nel 1989 (048), col cappello rosso sulla barra più alta.
 *
 * Zone in più, disegnate dal client:
 *  - nella testata della cascata: V sensore (sfera, antenna, entrambi), L portata del ping, R riferimento
 *    (relativo alla prua o vero); un clic sulla cascata sceglie il rilevamento (e ci punta l'analizzatore
 *    se è acceso su un rilevamento);
 *  - nella testata dell'analizzatore: V sensore del fascio, L libro (le righe di una classe sopra il
 *    LOFAR), W torna alla cascata lasciando acceso il fascio; un clic sul LOFAR sceglie una riga; con il
 *    libro aperto, - e = cambiano classe e K classifica il contatto analizzato con quella classe. I e O
 *    della pulsantiera stringono e allargano l'asse delle frequenze.
 *  - T sulla pulsantiera passa dalla finestra del Sonar alla mappa e ritorno.
 */
import { chiamaRoutine } from '../resa/risorse.js';
import { attivaComune, designaProssimo, ritrattoPer, designatoDi, classeDi } from './comune.js';
import { FINESTRA } from '../resa/mappa.js';
import {
  COLONNE, COLONNA_CENTRO, rigaCascata, colonnaDiRilevamento, rilevamentoDiColonna,
} from '../resa/cascata.js';
import {
  rigaSpettro, ricampiona, righeTonali, mediaRecente, barreAnalizzatore, disegnaBarre, tacche, formatoHz,
  colonnaDiFrequenza, frequenzaDiColonna, stimaPale,
} from '../resa/spettro.js';
import { scrivi, larghezzaTesto, perIlFont } from '../resa/testo.js';
import { normalizza360, normalizza180 } from '../../../shared/units.js';
import { SPETTRO } from '../../../shared/protocol.js';

/** @typedef {import('./comune.js').Contesto} Contesto */
/** @typedef {import('./comune.js').Stazione} Stazione */
/** @typedef {import('../cls.js').Hotspot} Hotspot */
/** @typedef {import('../stato.js').FotogrammaSonar} FotogrammaSonar */
/** @typedef {import('../stato.js').Spettro} Spettro */

/**
 * Testata della cascata: in alto sensore, portata del ping e riferimento (cliccabili), sotto le
 * etichette dei rilevamenti e le tacche; poi le righe dei dati, 79 secondi di storia (79 fotogrammi da
 * 4 s in banda stretta).
 */
export const TESTATA = Object.freeze({ y1: FINESTRA.y1, y2: 41, parole: 29, etichette: 35, tacche: 40 });
export const RIGHE = Object.freeze({ y1: 42, y2: FINESTRA.y2 });
/** L'analizzatore: testata (y 28-40), LOFAR (41-96), DEMON (98-120). */
export const LOFAR = Object.freeze({ y1: 41, y2: 96, etichette: 35, tacche: 40 });
export const DEMON = Object.freeze({ testo: 98, y1: 105, y2: FINESTRA.y2, max_hz: 25.6 });
/** Tasti delle zone aggiunte dal client. */
export const TASTO_VISTA = 86, TASTO_RIFERIMENTO = 82, TASTO_PORTATA = 76, TASTO_CASCATA = 250;
export const TASTO_LIBRO = 76, TASTO_TORNA = 87, TASTO_LOFAR = 251, TASTO_CLASSE_SU = 61, TASTO_CLASSE_GIU = 45,
  TASTO_CLASSIFICA = 75;
/** Le ampiezze dell'asse delle frequenze del LOFAR (I/O): la finestra del sensore, poi sempre più strette. */
export const AMPIEZZE_HZ = Object.freeze([0, 512, 256, 128, 64, 32]);
/** Settore di trasmissione della sfera attiva, gradi per lato (PROTOCOLLO v2, `attivo`). */
export const SETTORE_PING = 60;

// ------------------------------------------------------------------------------------- cascata

/**
 * Riga cacheata di un fotogramma per sensore, banda e riferimento.
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

/** I fotogrammi della banda scelta. @param {Contesto} ctx */
function fotogrammi(ctx) {
  return ctx.ui.cascata.banda === 'stretta' ? ctx.stato.sonarStretta : ctx.stato.sonar;
}

/**
 * Riga della cascata (y) di un'ora di gioco, o null se è fuori dal riquadro.
 * @param {FotogrammaSonar[]} lista @param {number} ora @param {number} y1 @param {number} y2
 */
function rigaDiOra(lista, ora, y1, y2) {
  const primo = lista[0];
  if (!primo) return null;
  const passo = lista.length > 1 ? Math.max(1, primo.ora - lista[1].ora) : 1;
  const y = y1 + Math.round((primo.ora - ora) / passo);
  return y >= y1 && y <= y2 ? y : null;
}

/**
 * Un riquadro della cascata fra y1 e y2: la riga più recente in alto, con i segni degli echi (bianco),
 * delle intercettazioni (giallo) e dei transitori (magenta) all'ora e al rilevamento in cui sono arrivati.
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
  const lista = fotogrammi(ctx);
  const n = y2 - y1 + 1;
  for (let i = 0; i < n && i < lista.length; i++) {
    const f = lista[i];
    if (!f[sensore]) continue;
    const r = riga(ctx, f, sensore);
    tela.px.set(r, (y1 + i) * 320 + FINESTRA.x1);
  }
  const rotta = nave?.rotta ?? 0, rif = ui.cascata.riferimento;
  /** @param {number} ril @param {number} ora @param {(x: number, y: number) => void} segno */
  const segna = (ril, ora, segno) => {
    const c = colonnaDiRilevamento(ril, rif, rotta);
    const y = rigaDiOra(lista, ora, y1, y2);
    if (c !== null && y !== null) segno(FINESTRA.x1 + Math.floor(c), y);
  };
  for (const p of stato.ping) {
    for (const e of p.echi) {
      segna(e.rilevamento, e.ora, (x, y) => { tela.rett(x - 1, y - 1, x + 1, y + 1, 15); });
    }
  }
  for (const i of stato.intercetti) {
    segna(i.rilevamento, i.ora, (x, y) => { tela.hline(y, x - 2, x + 2, 14); tela.hline(y + 1, x - 1, x + 1, 14); tela.pixel(x, y + 2, 14); });
  }
  for (const t of stato.transitori) {
    if (t.sensore !== sensore) continue;
    segna(t.rilevamento, t.ora, (x, y) => { tela.vline(x, y - 1, y + 1, 13); tela.vline(x + 1, y - 1, y + 1, 13); });
  }
  // antenna rimorchiata: l'asse di simmetria dello speculare (`asse`, verso prua), a puntini magenta, e
  // SORDA quando l'antenna non ascolta (accostata, velocità)
  const ultimo = lista.find((f) => f[sensore])?.[sensore];
  if (sensore === 'towed' && ultimo) {
    if (ultimo.asse !== null) {
      const c = colonnaDiRilevamento(ultimo.asse, rif, rotta);
      if (c !== null) for (let y = y1; y <= y2; y += 3) tela.pixel(FINESTRA.x1 + Math.floor(c), y, 13);
    }
    if (ultimo.sorda) scrivi(tela, font, FINESTRA.x1 + 3, y1 + 2, ctx.t('ui.cascata.sorda'), 13);
  }
}

/** Le tre parole della testata con le loro x (per disegnarle e per le zone cliccabili). @param {Contesto} ctx */
function paroleTestata(ctx) {
  const { font, ui } = ctx;
  const sensore = ctx.t(`ui.cascata.${ui.cascata.sensore}`) + (ui.cascata.banda === 'stretta' ? ctx.t('ui.cascata.stretta') : '');
  const rif = ctx.t(`ui.cascata.${ui.cascata.riferimento}`);
  const portata = ctx.t(`ui.ping.${ui.portataPing}`);
  const xr = FINESTRA.x2 - larghezzaTesto(font, rif) - 1;
  const xp = xr - larghezzaTesto(font, portata) - 6;
  return { sensore, rif, portata, xs: FINESTRA.x1 + 3, xp, xr };
}

/** Testata: tacche ogni 30°, etichette ogni 90°, sensore a sinistra, portata del ping e riferimento a destra. @param {Contesto} ctx */
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
  const p = paroleTestata(ctx);
  scrivi(tela, font, p.xs, TESTATA.parole, p.sensore, 13);
  scrivi(tela, font, p.xp, TESTATA.parole, p.portata, 13);
  scrivi(tela, font, p.xr, TESTATA.parole, p.rif, 13);
  // bersaglio designato: triangolino magenta sopra la sua colonna
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
  // il fascio dell'analizzatore: trattino verde sotto le etichette
  const a = stato.nave?.analizzatore;
  if (a && a.rilevamento !== null) {
    const c = colonnaDiRilevamento(a.rilevamento, rif, rotta);
    if (c !== null) tela.hline(TESTATA.tacche - 1, FINESTRA.x1 + Math.floor(c) - 2, FINESTRA.x1 + Math.floor(c) + 2, 10);
  }
}

/** @param {Contesto} ctx */
function disegnaCascata(ctx) {
  const { tela, ui, stato } = ctx;
  testata(ctx);
  const s = ui.cascata.sensore;
  if (fotogrammi(ctx).length === 0) {
    const testo = ctx.t(ui.cascata.banda === 'stretta' ? 'ui.cascata.attesa_stretta' : 'ui.cascata.attesa');
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
}

// ------------------------------------------------------------------------------------- analizzatore

/**
 * L'intervallo di frequenze mostrato: tutta la finestra del sensore o, stringendo con I, un'ampiezza
 * centrata sulla riga scelta (o che parte da 0 Hz).
 * @param {Contesto} ctx @param {Spettro} sp
 * @returns {[number, number]}
 */
export function intervalloLofar(ctx, sp) {
  const fine = sp.da_hz + sp.righe.length * sp.passo_hz;
  const ampiezza = AMPIEZZE_HZ[ctx.ui.analisi.zoom] || fine - sp.da_hz;
  if (ampiezza >= fine - sp.da_hz) return [sp.da_hz, fine];
  const centro = ctx.ui.analisi.riga ?? sp.da_hz + ampiezza / 2;
  const f0 = Math.max(sp.da_hz, Math.min(fine - ampiezza, centro - ampiezza / 2));
  return [f0, f0 + ampiezza];
}

/** Le righe dell'analizzatore dello stesso fascio e della stessa finestra dell'ultima. @param {Contesto} ctx */
function spettriCorrenti(ctx) {
  const sp = ctx.stato.spettri;
  const primo = sp[0];
  if (!primo) return [];
  const out = [];
  for (const s of sp) {
    if (s.sensore !== primo.sensore || s.passo_hz !== primo.passo_hz || s.righe.length !== primo.righe.length) break;
    out.push(s);
  }
  return out;
}

/** La classe del libro che si sta guardando. @param {Contesto} ctx */
function classeLibro(ctx) {
  const n = ctx.biblioteca.length;
  return n ? ctx.biblioteca[((ctx.ui.analisi.classe % n) + n) % n] : null;
}

/**
 * Le zone dell'analizzatore nella testata e nel DEMON, con le parole: tutte calcolate qui, così
 * disegno e zone cliccabili coincidono.
 * @param {Contesto} ctx
 */
function paroleAnalizzatore(ctx) {
  const { font, stato, ui } = ctx;
  const a = stato.nave?.analizzatore ?? null;
  const sp = stato.spettri[0];
  const sensore = a?.sensore ?? sp?.sensore ?? 'sfera';
  const dove = a?.contatto ?? (a?.rilevamento !== null && a?.rilevamento !== undefined ? `${String(Math.round(normalizza360(a.rilevamento)) % 360).padStart(3, '0')}*` : '---');
  const titolo = `LOFAR ${perIlFont(dove)} ${ctx.t(`ui.cascata.${sensore}`)}`;
  const libro = ctx.t('ui.analisi.libro');
  const torna = ctx.t('ui.analisi.cascata');
  const xt = FINESTRA.x2 - larghezzaTesto(font, torna) - 1;
  const xl = xt - larghezzaTesto(font, libro) - 6;
  const c = ui.analisi.biblioteca ? classeLibro(ctx) : null;
  const classifica = ctx.t('ui.analisi.classifica');
  const xk = FINESTRA.x2 - larghezzaTesto(font, classifica) - 1;
  return { titolo, libro, torna, xs: FINESTRA.x1 + 3, xl, xt, classe: c, classifica, xk };
}

/**
 * Disegna l'analizzatore: testata, LOFAR (una riga ogni 4 s, la più recente in alto), DEMON integrato
 * a barre, e con il libro aperto le righe della classe (gialle quelle fisse, magenta quelle che variano
 * con la velocità) sopra il LOFAR.
 * @param {Contesto} ctx
 */
function disegnaAnalizzatore(ctx) {
  const { tela, font, stato, ui } = ctx;
  const p = paroleAnalizzatore(ctx);
  tela.riempi(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2, 0);
  scrivi(tela, font, p.xs, TESTATA.parole, p.titolo, 13);
  scrivi(tela, font, p.xl, TESTATA.parole, p.libro, ui.analisi.biblioteca ? 14 : 13);
  scrivi(tela, font, p.xt, TESTATA.parole, p.torna, 13);
  const lista = spettriCorrenti(ctx);
  const sp = lista[0];
  if (!sp) {
    const testo = ctx.t(stato.nave?.analizzatore ? 'ui.analisi.attesa' : 'ui.analisi.spento');
    scrivi(tela, font, 92 - Math.floor(larghezzaTesto(font, testo) / 2), 70, testo, 8);
    return;
  }
  const [f0, f1] = intervalloLofar(ctx, sp);
  // asse delle frequenze
  const t = tacche(f0, f1, 4);
  for (const f of t.valori) {
    const c = colonnaDiFrequenza(f, f0, f1, COLONNE);
    if (c === null) continue;
    const x = FINESTRA.x1 + Math.floor(c);
    tela.vline(x, LOFAR.tacche, LOFAR.tacche, 7);
    const testo = formatoHz(f);
    const w = larghezzaTesto(font, testo) - 1;
    scrivi(tela, font, Math.max(FINESTRA.x1 + 1, Math.min(FINESTRA.x2 - w, x - Math.floor(w / 2))), LOFAR.etichette, testo, 7);
  }
  // righe del LOFAR (cacheate per riga e intervallo)
  const k = `lofar:${f0},${f1}`;
  let wm = /** @type {WeakMap<Spettro, Uint8Array> | undefined} */ (ctx.cache.get(k));
  if (!wm) {
    for (const kk of ctx.cache.keys()) if (kk.startsWith('lofar:')) ctx.cache.delete(kk);
    wm = new WeakMap();
    ctx.cache.set(k, wm);
  }
  for (let i = 0; i < lista.length && LOFAR.y1 + i <= LOFAR.y2; i++) {
    const s = lista[i];
    let r = wm.get(s);
    if (!r) {
      r = rigaSpettro(s.righe, s.da_hz, s.passo_hz, f0, f1, COLONNE);
      wm.set(s, r);
    }
    tela.px.set(r, (LOFAR.y1 + i) * 320 + FINESTRA.x1);
  }
  // il libro: le righe della classe
  const c = p.classe;
  if (c) {
    for (const r of c.righe) {
      const col = colonnaDiFrequenza(r.hz, f0, f1, COLONNE);
      if (col === null) continue;
      const x = FINESTRA.x1 + Math.floor(col);
      const colore = r.variabile ? 13 : 14;
      tela.vline(x, LOFAR.tacche - 1, LOFAR.tacche, colore);
      for (let y = LOFAR.y1; y <= LOFAR.y2; y += 5) tela.pixel(x, y, colore);
    }
  }
  // la riga scelta col puntatore: tacca bianca e la sua frequenza
  if (ui.analisi.riga !== null) {
    const col = colonnaDiFrequenza(ui.analisi.riga, f0, f1, COLONNE);
    if (col !== null) {
      const x = FINESTRA.x1 + Math.floor(col);
      tela.vline(x, LOFAR.tacche - 2, LOFAR.tacche, 15);
    }
  }
  tela.hline(LOFAR.y2 + 1, FINESTRA.x1, FINESTRA.x2, 8);
  disegnaDemon(ctx, lista, p);
}

/**
 * Il DEMON integrato (media in potenza delle ultime 8 righe) a barre fra 0 e 25,6 Hz, con la stima
 * delle pale; col libro aperto, la classe che si guarda e il comando per classificare.
 * @param {Contesto} ctx @param {Spettro[]} lista @param {ReturnType<typeof paroleAnalizzatore>} p
 */
function disegnaDemon(ctx, lista, p) {
  const { tela, font, ui } = ctx;
  const sp = lista[0];
  const media = mediaRecente(lista, 8, 'demon');
  const altezza = DEMON.y2 - DEMON.y1 + 1;
  if (media && sp) {
    const v = ricampiona(media, sp.demon_da_hz, sp.demon_passo_hz, 0, DEMON.max_hz, COLONNE);
    for (let c = 0; c < COLONNE; c++) {
      const h = Math.max(0, Math.min(altezza, Math.round(((v[c] - 36) * altezza) / 80)));
      if (h > 0) tela.vline(FINESTRA.x1 + c, DEMON.y2 - h + 1, DEMON.y2, v[c] >= 66 ? 11 : 3);
    }
  }
  if (p.classe) {
    tela.riempi(FINESTRA.x1, DEMON.testo - 1, FINESTRA.x2, DEMON.testo + 5, 0);
    const nome = perIlFont(ctx.t(`classe_media.${p.classe.id}`));
    const x = scrivi(tela, font, FINESTRA.x1 + 3, DEMON.testo, '<', 14);
    const larghezzaMax = p.xk - x - 14;
    let n = nome;
    while (n.length > 1 && larghezzaTesto(font, n) > larghezzaMax) n = n.slice(0, -1);
    const x2 = scrivi(tela, font, x + 3, DEMON.testo, n, 14);
    scrivi(tela, font, x2 + 3, DEMON.testo, '>', 14);
    scrivi(tela, font, p.xk, DEMON.testo, p.classifica, 13);
    if (p.classe.pale !== null) scrivi(tela, font, FINESTRA.x1 + 3, DEMON.y1, ctx.t('ui.analisi.pale', { n: p.classe.pale }), 14);
    return;
  }
  // senza libro: la stima del sonarista dalle righe del DEMON
  if (media && sp) {
    const righe = righeTonali(media, sp.demon_da_hz, sp.demon_passo_hz, 70, 3).filter((r) => r.hz >= 0.5 && r.hz <= DEMON.max_hz);
    const stima = stimaPale(righe.slice(0, 6), sp.demon_passo_hz);
    const testo = stima
      ? ctx.t('ui.analisi.demon_stima', { asse: stima.asse_hz.toFixed(1), pala: stima.pala_hz.toFixed(1), pale: stima.pale })
      : ctx.t('ui.analisi.demon');
    scrivi(tela, font, FINESTRA.x1 + 3, DEMON.testo, testo, 7);
  } else {
    scrivi(tela, font, FINESTRA.x1 + 3, DEMON.testo, ctx.t('ui.analisi.demon'), 7);
  }
  if (ui.analisi.riga !== null) {
    const testo = ctx.t('ui.analisi.riga', { hz: ui.analisi.riga >= 100 ? Math.round(ui.analisi.riga) : ui.analisi.riga.toFixed(1) });
    scrivi(tela, font, FINESTRA.x2 - larghezzaTesto(font, testo) - 1, DEMON.testo, testo, 15);
  }
}

// ------------------------------------------------------------------------------------- finestra e pannello

/** La finestra del Sonar. @param {Contesto} ctx */
function disegnaFinestra(ctx) {
  if (!ctx.ui.cascataSuSonar) return false;
  const { tela } = ctx;
  tela.ritaglia(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2);
  tela.riempi(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2, 0);
  if (ctx.ui.analisi.aperta) disegnaAnalizzatore(ctx);
  else disegnaCascata(ctx);
  tela.senzaRitaglio();
  return true;
}

/** Le 16 barre del SONAR COMPUTER dall'ultima riga dell'analizzatore (spente senza). @param {Contesto} ctx */
function disegnaComputer(ctx) {
  const nave = ctx.stato.nave;
  const sp = ctx.stato.spettri[0];
  const recente = sp && nave?.analizzatore && nave.ora - sp.ora <= 3 * SPETTRO.PERIODO;
  if (!recente) {
    disegnaBarre(ctx.tela, new Array(16).fill(0), -1);
    return;
  }
  const { altezze, picco } = barreAnalizzatore(sp.righe, sp.da_hz, sp.passo_hz);
  disegnaBarre(ctx.tela, altezze, picco);
}

/** @param {Contesto} ctx */
function disegna(ctx) {
  const nave = ctx.stato.nave;
  const cls = ctx.orig.cls, tela = ctx.tela;
  // FILTER (riquadro 77..136, misurato su 046 e 051): banda larga o stretta
  chiamaRoutine(cls, tela, 'SONAR.CLS', 6, [77, 153, 136, 165, ctx.ui.cascata.banda === 'stretta' ? '  NARROW' : 'BAND PASS', 11, 1]);
  // ACTIVE: giallo mentre si ascolta l'eco del ping
  const ascolto = (nave?.ascolto_attivo ?? 0) > 0;
  chiamaRoutine(cls, tela, 'SONAR.CLS', 6, [149, 153, 215, 165, 'TRGT PULSE', ascolto ? 14 : 11, 1]);
  // TOWED ARRAY: RETRIEVE mentre è fuori o esce, DEPLOY altrimenti (riquadro 232..285, 046 e 050)
  const fuori = nave?.towed && (nave.towed.stato === 'filata' || nave.towed.stato === 'in_filare');
  chiamaRoutine(cls, tela, 'SONAR.CLS', 6, [232, 153, 285, 165, fuori ? 'RETRIEVE' : ' DEPLOY', 11, 1]);
  disegnaComputer(ctx);
}

/** Zone in più: quelle della testata e del corpo della finestra. @param {Contesto} ctx @returns {Hotspot[]} */
function hotspotExtra(ctx) {
  if (!ctx.ui.cascataSuSonar) return [];
  const { font } = ctx;
  const g = 5, y1 = TESTATA.y1, y2 = TESTATA.etichette - 2;
  /** @param {number} x1 @param {string} testo @param {number} tasto @param {number} [gruppo] @param {number} [y] */
  const zona = (x1, testo, tasto, gruppo = g, y = y1) => ({
    cursore: 0, x1: x1 - 1, y1: y, x2: x1 + larghezzaTesto(font, testo), y2: y === y1 ? y2 : y + 6, colore: 13, tasto, gruppo,
  });
  if (ctx.ui.analisi.aperta) {
    const p = paroleAnalizzatore(ctx);
    /** @type {Hotspot[]} */
    const hs = [
      zona(p.xs, p.titolo, TASTO_VISTA),
      zona(p.xl, p.libro, TASTO_LIBRO),
      zona(p.xt, p.torna, TASTO_TORNA),
      { cursore: 0, x1: FINESTRA.x1, y1: LOFAR.y1, x2: FINESTRA.x2, y2: LOFAR.y2, colore: 15, tasto: TASTO_LOFAR, gruppo: 6 },
    ];
    if (p.classe) {
      hs.push(
        { cursore: 0, x1: FINESTRA.x1 + 1, y1: DEMON.testo - 1, x2: FINESTRA.x1 + 9, y2: DEMON.testo + 6, colore: 14, tasto: TASTO_CLASSE_GIU, gruppo: 7 },
        { cursore: 0, x1: p.xk - 14, y1: DEMON.testo - 1, x2: p.xk - 3, y2: DEMON.testo + 6, colore: 14, tasto: TASTO_CLASSE_SU, gruppo: 7 },
        zona(p.xk, p.classifica, TASTO_CLASSIFICA, 7, DEMON.testo - 1),
      );
    }
    return hs;
  }
  const p = paroleTestata(ctx);
  return [
    zona(p.xs, p.sensore, TASTO_VISTA),
    zona(p.xp, p.portata, TASTO_PORTATA),
    zona(p.xr, p.rif, TASTO_RIFERIMENTO),
    { cursore: 0, x1: FINESTRA.x1, y1: RIGHE.y1, x2: FINESTRA.x2, y2: RIGHE.y2, colore: 15, tasto: TASTO_CASCATA, gruppo: 6 },
  ];
}

// ------------------------------------------------------------------------------------- comandi

/**
 * Il bersaglio per l'analizzatore e per il ping: il contatto designato, o il rilevamento scelto.
 * @param {Contesto} ctx
 * @returns {{ contatto: string | null, rilevamento: number | null }}
 */
export function bersaglioSonar(ctx) {
  const d = designatoDi(ctx);
  const b = ctx.ui.bersaglio;
  return { contatto: d, rilevamento: b && !b.perso ? b.rilevamento : null };
}

/** Il sensore per l'analizzatore: quello della cascata (l'antenna solo se è filata). @param {Contesto} ctx */
function sensoreAnalisi(ctx) {
  const tw = ctx.stato.nave?.towed;
  return ctx.ui.cascata.sensore === 'towed' && tw?.stato === 'filata' ? 'towed' : 'sfera';
}

/**
 * ANALYZE: accende l'analizzatore (sul contatto designato, o sul rilevamento scelto) e lo mostra; se
 * è già acceso e in vista lo spegne.
 * @param {Contesto} ctx
 */
export function analizza(ctx) {
  const ui = ctx.ui, nave = ctx.stato.nave;
  const acceso = !!nave?.analizzatore;
  if (acceso && ui.analisi.aperta) {
    ctx.ordina('analizzatore', null);
    ui.analisi.aperta = false;
    return;
  }
  ui.cascataSuSonar = true;
  ui.analisi.aperta = true;
  if (acceso) return;
  const b = bersaglioSonar(ctx);
  if (b.contatto) ctx.ordina('analizzatore', { contatto: b.contatto });
  else if (b.rilevamento !== null) ctx.ordina('analizzatore', { sensore: sensoreAnalisi(ctx), rilevamento: Math.round(normalizza360(b.rilevamento) * 10) / 10 });
  else {
    ui.analisi.aperta = false;
    ctx.avvisa('locale.analisi_senza_bersaglio');
    return;
  }
  ritrattoPer(ui, 'sonar', ctx.ora);
  ctx.avvisa('locale.analisi_in_corso');
}

/**
 * TRGT PULSE: un ping sul bersaglio se sta nel settore di prua, altrimenti su tutto il settore.
 * @param {Contesto} ctx
 */
export function pinga(ctx) {
  const nave = ctx.stato.nave;
  if (nave && nave.ascolto_attivo > 0) {
    ctx.avvisa('motivo.ping_in_corso');
    return;
  }
  const b = bersaglioSonar(ctx);
  let ril = b.rilevamento;
  if (ril !== null && nave && Math.abs(normalizza180(ril - nave.rotta)) > SETTORE_PING) {
    ctx.avvisa('locale.ping_fuori_settore');
    ril = null;
  }
  ctx.ordina('attivo', { rilevamento: ril === null ? null : Math.round(normalizza360(ril) * 10) / 10, portata: ctx.ui.portataPing });
}

/**
 * @param {Contesto} ctx @param {Hotspot} h @param {{ x: number, y: number } | null} punto
 * @param {(s: string) => void} vaiA
 */
function attiva(ctx, h, punto, vaiA) {
  const ui = ctx.ui, nave = ctx.stato.nave;
  // I e O stringono e allargano l'asse delle frequenze quando si guarda l'analizzatore
  if (h.gruppo === 1 && ui.analisi.aperta && ui.cascataSuSonar && (h.tasto === 73 || h.tasto === 79)) {
    ui.analisi.zoom = Math.max(0, Math.min(AMPIEZZE_HZ.length - 1, ui.analisi.zoom + (h.tasto === 73 ? 1 : -1)));
    return true;
  }
  if (attivaComune(ctx, h, vaiA)) return true;
  const analisi = ui.analisi.aperta && ui.cascataSuSonar;
  switch (h.tasto) {
    case 200:
      ui.cascata.banda = ui.cascata.banda === 'larga' ? 'stretta' : 'larga';
      ctx.avvisa(ui.cascata.banda === 'stretta' ? 'locale.filtro_stretta' : 'locale.filtro_larga');
      return true;
    case 201:
      pinga(ctx);
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
      analizza(ctx);
      return true;
    case 71:
      designaProssimo(ctx);
      return true;
    default:
      break;
  }
  if (analisi) {
    switch (h.tasto) {
      case TASTO_VISTA: {
        // l'altro sensore sullo stesso rilevamento (se il fascio è puntato a mano)
        const a = nave?.analizzatore;
        if (!a || a.contatto || a.rilevamento === null) return true;
        const altro = a.sensore === 'towed' ? 'sfera' : 'towed';
        if (altro === 'towed' && nave?.towed?.stato !== 'filata') {
          ctx.avvisa('locale.towed_non_filata');
          return true;
        }
        ctx.ordina('analizzatore', { sensore: altro, rilevamento: a.rilevamento });
        return true;
      }
      case TASTO_LIBRO:
        if (ctx.biblioteca.length === 0) ctx.avvisa('locale.libro_assente');
        else ui.analisi.biblioteca = !ui.analisi.biblioteca;
        return true;
      case TASTO_TORNA:
        ui.analisi.aperta = false;
        return true;
      case TASTO_CLASSE_SU:
      case TASTO_CLASSE_GIU:
        ui.analisi.classe += h.tasto === TASTO_CLASSE_SU ? 1 : -1;
        return true;
      case TASTO_CLASSIFICA: {
        const c = classeLibro(ctx);
        const contatto = nave?.analizzatore?.contatto ?? designatoDi(ctx);
        if (!c) return true;
        if (!contatto) {
          ctx.avvisa('locale.classifica_senza_contatto');
          return true;
        }
        const gia = classeDi(ctx.stato, contatto);
        ctx.ordina('classifica', { contatto, classe: gia.da === 'comandante' && gia.classe === c.id ? null : c.id });
        return true;
      }
      case TASTO_LOFAR: {
        const sp = ctx.stato.spettri[0];
        if (!sp) return true;
        const [f0, f1] = intervalloLofar(ctx, sp);
        const x = (punto ? punto.x : (h.x1 + h.x2) / 2) - FINESTRA.x1;
        const f = frequenzaDiColonna(x, f0, f1, COLONNE);
        // aggancio alla riga tonale più vicina entro tre colonne
        const media = mediaRecente(spettriCorrenti(ctx), 8) ?? sp.righe;
        const tolleranza = (3 * (f1 - f0)) / COLONNE;
        const vicine = righeTonali(media, sp.da_hz, sp.passo_hz).filter((r) => Math.abs(r.hz - f) <= tolleranza);
        vicine.sort((a, b) => Math.abs(a.hz - f) - Math.abs(b.hz - f));
        ui.analisi.riga = vicine.length ? Math.round(vicine[0].hz * 10) / 10 : Math.round(f * 10) / 10;
        return true;
      }
      default:
        return false;
    }
  }
  switch (h.tasto) {
    case TASTO_VISTA:
      ui.cascata.sensore = ui.cascata.sensore === 'sfera' ? 'towed' : ui.cascata.sensore === 'towed' ? 'entrambi' : 'sfera';
      return true;
    case TASTO_RIFERIMENTO:
      ui.cascata.riferimento = ui.cascata.riferimento === 'relativo' ? 'vero' : 'relativo';
      return true;
    case TASTO_PORTATA:
      ui.portataPing = ui.portataPing === 'lunga' ? 'corta' : 'lunga';
      return true;
    case TASTO_CASCATA: {
      const x = punto ? punto.x : (h.x1 + h.x2) / 2;
      const rotta = nave?.rotta ?? 0;
      const vero = normalizza360(rilevamentoDiColonna(Math.floor(x) - FINESTRA.x1, ui.cascata.riferimento, rotta));
      // un rilevamento scelto a mano toglie la designazione di una traccia
      if (designatoDi(ctx)) ctx.ordina('designa', null);
      ui.bersaglio = { rilevamento: vero, visto: ctx.stato.sonar[0]?.ora ?? 0, perso: false };
      const a = nave?.analizzatore;
      if (a && !a.contatto) ctx.ordina('analizzatore', { sensore: a.sensore === 'towed' ? 'towed' : 'sfera', rilevamento: Math.round(vero * 10) / 10 });
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
    esc(ctx) {
      if (ctx.ui.analisi.aperta && ctx.ui.analisi.biblioteca) {
        ctx.ui.analisi.biblioteca = false;
        return true;
      }
      return false;
    },
  };
}
