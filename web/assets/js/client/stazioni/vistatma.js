// @ts-check
/**
 * La vista TMA nella Navigation Board (F6): il gioco del 1989 non l'aveva (ORIGINALE.md §5: i contatti
 * passavano dalla X alla lettera esatta), qui si disegna nel kit originale (palette EGA, font del gioco,
 * la finestra della mappa) e si entra col tasto T della pulsantiera della mappa, che nella Navigation
 * Board passa dalla carta alla TMA e ritorno (come nel Sonar passa dalla cascata alla carta): nessun
 * tasto funzione nuovo.
 *
 * Tre pagine, scelte con A nella testata; N passa al contatto successivo (e lo designa):
 *  - PUNTI: il diagramma tempo-rilevamento (il tempo scende, il più recente in alto come la cascata);
 *    tratteggi grigi ai cambi di gamba del proprio moto; la retta della variazione del rilevamento
 *    sull'ultima gamba (magenta); la curva prevista dalla soluzione di prova del MATE (gialla) e da quella
 *    dell'equipaggio (blu); in fondo variazione (°/min), distanza di Ekelund dell'ultimo cambio di gamba,
 *    Q e consiglio di manovra dell'equipaggio;
 *  - MATE: i residui (misurato − previsto) della soluzione di prova, per tempo, attorno allo zero: una
 *    pendenza dentro una gamba vuol dire rotta o velocità sbagliate, un salto fra due gambe distanza
 *    sbagliata. Sotto, la prova: D distanza, R rotta, V velocità (ognuna col suo meno e più), E la manda
 *    all'equipaggio come soluzione del comandante (ordine `soluzione`), Z la cancella, U riparte dalla
 *    soluzione dell'equipaggio;
 *  - TRACCE: l'elenco delle tracce dell'equipaggio (designazione, sensori, rilevamento, variazione,
 *    classe e confidenza, stato); un clic su una riga la designa, su CL si cambia la classificazione del
 *    comandante, su ABB la si abbandona.
 * I conti sono quelli di shared/tma.js (agente I); il livello d'assistenza decide cosa manda il server
 * (soluzioni, ellissi, lettere esatte), e la vista disegna quello che arriva.
 */
import { FINESTRA } from '../resa/mappa.js';
import { scrivi, larghezzaTesto, perIlFont } from '../resa/testo.js';
import { treCifre } from '../resa/cornice.js';
import { designatoDi, classeDi } from './comune.js';
import { strumenti, provaIniziale, provaInStato, proprioAllOra, statoSoluzione } from '../tma.js';
import { rilevamentoPrevisto, norm180, norm360, inPolare, avanzaStato } from '../../../shared/tma.js';
import { CLASSI } from '../../../shared/protocol.js';
import { metriInKiloiarde, normalizza360 } from '../../../shared/units.js';

/** @typedef {import('./comune.js').Contesto} Contesto */
/** @typedef {import('../cls.js').Hotspot} Hotspot */
/** @typedef {import('../../../shared/tma.js').SoluzionePolare} SoluzionePolare */

/** Geometria della vista. */
export const TMA = Object.freeze({
  testata: 29, etichette: 36, tacche: 41, y1: 43, y2: 104, info: 106, consiglio: 114,
  // MATE: residui fino a y 100, poi i comandi
  mateY2: 98, comandi1: 102, comandi2: 111,
});
/** Le pagine, nell'ordine di A. */
export const PAGINE = Object.freeze(/** @type {const} */ (['punti', 'mate', 'elenco']));
/** Tasti delle zone della vista. */
export const TASTI_TMA = Object.freeze({
  PAGINA: 65, CONTATTO: 78, D: 68, R: 82, V: 86, PIU: 400, INVIA: 69, CANCELLA: 90, EQUIPAGGIO: 85,
  RIGA: 300, CLASSE: 330, ABBANDONA: 360,
});
/** Passi della prova: la distanza ×/÷ 1,1, la rotta 5°, la velocità 1 kt. */
export const PASSI_PROVA = Object.freeze({ distanza: 1.1, rotta: 5, velocita: 1 });

/** Il contatto della vista: quello scelto, o il designato, o la prima traccia. @param {Contesto} ctx */
export function contattoTma(ctx) {
  const t = ctx.stato.tracce;
  const c = ctx.ui.tma.contatto ?? designatoDi(ctx);
  if (c && (t.some((x) => x.contatto === c) || ctx.stato.storia[c])) return c;
  return t.find((x) => x.stato !== 'persa')?.contatto ?? null;
}

/**
 * Gli strumenti per il contatto della vista, cacheati finché non arrivano misure nuove o non cambia la
 * prova.
 * @param {Contesto} ctx @param {string} c
 */
function strumentiDi(ctx, c) {
  const s = ctx.stato;
  const prova = ctx.ui.tma.prova;
  const k = `tma:${c}:${(s.storia[c] ?? []).length}:${s.oraTracce}:${s.traccia.length}:${prova ? `${prova.ora},${prova.distanza},${prova.rotta},${prova.velocita},${prova.rilevamento}` : ''}`;
  let r = /** @type {ReturnType<typeof strumenti> | undefined} */ (ctx.cache.get(k));
  if (!r) {
    for (const kk of ctx.cache.keys()) if (kk.startsWith('tma:')) ctx.cache.delete(kk);
    r = strumenti(s, c, prova);
    ctx.cache.set(k, r);
  }
  return r;
}

/**
 * Asse del tempo del diagramma: dall'ultima misura (in alto) indietro di quanto basta per tutte le
 * misure, fra 5 e 60 minuti, a passi tondi.
 * @param {number} ultima ora @param {number} prima ora @param {number} righe
 */
export function asseTempo(ultima, prima, righe) {
  const span = Math.max(300, Math.min(3600, ultima - prima));
  const minuti = [5, 10, 15, 20, 30, 45, 60].find((m) => m * 60 >= span) ?? 60;
  const sPerRiga = (minuti * 60) / righe;
  return { fine: ultima, inizio: ultima - minuti * 60, sPerRiga, minuti };
}

/**
 * Asse dei rilevamenti: centrato sulla media circolare, ampiezza tonda che contiene tutto (almeno ±5°).
 * @param {number[]} rilevamenti
 */
export function asseRilevamenti(rilevamenti) {
  if (rilevamenti.length === 0) return { centro: 0, semi: 10 };
  let sx = 0, sy = 0;
  for (const r of rilevamenti) { sx += Math.sin((r * Math.PI) / 180); sy += Math.cos((r * Math.PI) / 180); }
  const centro = normalizza360((Math.atan2(sx, sy) * 180) / Math.PI);
  let max = 0;
  for (const r of rilevamenti) max = Math.max(max, Math.abs(norm180(r - centro)));
  const semi = [5, 10, 15, 20, 30, 45, 60, 90, 180].find((x) => x >= max * 1.1) ?? 180;
  return { centro, semi };
}

/**
 * x dello schermo di un rilevamento sull'asse.
 * @param {number} r @param {{ centro: number, semi: number }} a
 */
export function xDiRilevamentoTma(r, a) {
  const w = FINESTRA.x2 - FINESTRA.x1;
  return FINESTRA.x1 + w / 2 + (norm180(r - a.centro) / a.semi) * (w / 2);
}

/** y di un'ora sull'asse del tempo. @param {number} ora @param {ReturnType<typeof asseTempo>} t @param {number} y1 */
export function yDiOra(ora, t, y1) {
  return y1 + (t.fine - ora) / t.sPerRiga;
}

/** Parole e zone della testata. @param {Contesto} ctx @param {string | null} c */
function testataTma(ctx, c) {
  const { font, ui, stato } = ctx;
  const liv = stato.nave?.assistenza ?? ui.assistenza;
  const titolo = c ? perIlFont(c) : '--';
  const pagina = ctx.t(`ui.tma.${ui.tma.vista}`);
  const livello = ctx.t('ui.tma.livello', { n: liv });
  const xp = FINESTRA.x2 - larghezzaTesto(font, pagina) - 1;
  const xl = xp - larghezzaTesto(font, livello) - 6;
  return { titolo, pagina, livello, xc: FINESTRA.x1 + 3, xp, xl };
}

/**
 * La vista intera (chiamata dalla Navigation Board al posto della carta).
 * @param {Contesto} ctx
 */
export function disegnaTma(ctx) {
  const { tela, font, ui } = ctx;
  tela.ritaglia(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2);
  tela.riempi(FINESTRA.x1, FINESTRA.y1, FINESTRA.x2, FINESTRA.y2, 0);
  const c = contattoTma(ctx);
  const h = testataTma(ctx, c);
  const designato = c !== null && c === designatoDi(ctx);
  scrivi(tela, font, h.xc, TMA.testata, h.titolo, designato ? 13 : 11);
  const tr = c ? ctx.stato.tracce.find((x) => x.contatto === c) : null;
  if (tr) {
    const sens = tr.sensori.map((x) => ctx.t(`ui.tma.sensore.${x}`)).join('+');
    scrivi(tela, font, h.xc + larghezzaTesto(font, h.titolo) + 4, TMA.testata, sens, 7);
  }
  scrivi(tela, font, h.xl, TMA.testata, h.livello, 7);
  scrivi(tela, font, h.xp, TMA.testata, h.pagina, 13);
  if (ui.tma.vista === 'elenco') disegnaElenco(ctx);
  else if (!c) {
    const t = ctx.t('ui.tma.nessuna_traccia');
    scrivi(tela, font, 92 - Math.floor(larghezzaTesto(font, t) / 2), 72, t, 8);
  } else if (ui.tma.vista === 'mate') disegnaMate(ctx, c);
  else disegnaPunti(ctx, c);
  tela.senzaRitaglio();
}

/**
 * Il diagramma tempo-rilevamento.
 * @param {Contesto} ctx @param {string} c
 */
function disegnaPunti(ctx, c) {
  const { tela, font, stato } = ctx;
  const st = strumentiDi(ctx, c);
  const m = st.misure;
  if (m.length === 0) {
    const t = ctx.t('ui.tma.attesa_misure');
    scrivi(tela, font, 92 - Math.floor(larghezzaTesto(font, t) / 2), 72, t, 8);
    return;
  }
  const righe = TMA.y2 - TMA.y1 + 1;
  const tempo = asseTempo(m[m.length - 1].ora, m[0].ora, righe);
  const visibili = m.filter((x) => x.ora >= tempo.inizio);
  const asse = asseRilevamenti(visibili.map((x) => x.rilevamento));
  // asse dei rilevamenti: etichette al centro e ai lati
  for (const f of [-1, -0.5, 0, 0.5, 1]) {
    const r = norm360(asse.centro + f * asse.semi);
    const x = Math.round(xDiRilevamentoTma(r, asse));
    tela.vline(Math.min(FINESTRA.x2, x), TMA.tacche, TMA.tacche + 1, 7);
    if (f !== -0.5 && f !== 0.5) {
      const testo = treCifre(r);
      const w = larghezzaTesto(font, testo) - 1;
      scrivi(tela, font, Math.max(FINESTRA.x1 + 1, Math.min(FINESTRA.x2 - w, x - Math.floor(w / 2))), TMA.etichette, testo, 7);
    }
  }
  scrivi(tela, font, FINESTRA.x1 + 2, TMA.y2 - 6, ctx.t('ui.tma.minuti', { n: tempo.minuti }), 8);
  // cambi di gamba del proprio moto
  for (const g of st.gambe) {
    const y = Math.round(yDiOra(g.da, tempo, TMA.y1));
    if (y >= TMA.y1 && y <= TMA.y2) for (let x = FINESTRA.x1; x <= FINESTRA.x2; x += 3) tela.pixel(x, y, 8);
  }
  // curve previste: soluzione dell'equipaggio (blu) e prova del MATE (gialla), una riga sì e una no
  const sol = stato.soluzioni[c];
  const stSol = sol ? statoSoluzione(stato, sol) : null;
  const stProva = ctx.ui.tma.prova ? provaInStato(stato, ctx.ui.tma.prova) : null;
  for (let y = TMA.y1; y <= TMA.y2; y += 2) {
    const ora = tempo.fine - (y - TMA.y1) * tempo.sPerRiga;
    const p = proprioAllOra(stato, ora);
    if (!p) continue;
    const o = { ora, x: p.x, y: p.y };
    if (stSol) tela.pixel(Math.round(xDiRilevamentoTma(rilevamentoPrevisto(stSol, o), asse)), y, sol?.esatta ? 10 : 9);
    if (stProva) tela.pixel(Math.round(xDiRilevamentoTma(rilevamentoPrevisto(stProva, o), asse)), y, 14);
  }
  // la retta della variazione del rilevamento
  const vr = st.variazione;
  if (vr) {
    const ultima = st.gambe[st.gambe.length - 1];
    const da = Math.max(tempo.inizio, ultima ? ultima.da : vr.ora - 300);
    for (let ora = da; ora <= tempo.fine; ora += tempo.sPerRiga) {
      const r = vr.rilevamento + (vr.variazione * (ora - vr.ora)) / 60;
      tela.pixel(Math.round(xDiRilevamentoTma(r, asse)), Math.round(yDiOra(ora, tempo, TMA.y1)), 13);
    }
  }
  // i punti
  for (const x of visibili) {
    const px = Math.round(xDiRilevamentoTma(x.rilevamento, asse)), py = Math.round(yDiOra(x.ora, tempo, TMA.y1));
    tela.pixel(px, py, x.sigma <= 1 ? 11 : 15);
    tela.pixel(px + 1, py, x.sigma <= 1 ? 11 : 15);
  }
  infoTma(ctx, c, st);
}

/**
 * La riga in fondo: variazione, Ekelund, Q della soluzione, consiglio di manovra.
 * @param {Contesto} ctx @param {string} c @param {ReturnType<typeof strumenti>} st
 */
function infoTma(ctx, c, st) {
  const { tela, font, stato } = ctx;
  const parti = [];
  if (st.variazione) {
    const v = st.variazione.variazione;
    parti.push(ctx.t('ui.tma.variazione', { v: `${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(1)}` }));
  }
  const ek = [...st.ekelund].reverse().find((e) => e.valida);
  if (ek) parti.push(ctx.t('ui.tma.ekelund', { kyd: metriInKiloiarde(ek.distanza).toFixed(1) }));
  const sol = stato.soluzioni[c];
  if (sol?.esatta) parti.push(ctx.t('ui.tma.esatta'));
  else if (sol && sol.q !== null) parti.push(ctx.t('ui.tma.q', { q: Math.round(sol.q) }));
  else if (st.osservabilita && !st.osservabilita.osservabile) parti.push(ctx.t('ui.tma.non_osservabile'));
  scrivi(tela, font, FINESTRA.x1 + 2, TMA.info, parti.join('  '), 7);
  // l'ultimo consiglio di manovra dell'equipaggio per questo contatto
  const cons = [...stato.rapporti].reverse().find((r) => r.chiave === 'tma.consiglio_manovra' && r.parametri.contatto === c);
  if (cons) {
    const p = cons.parametri;
    const t = ctx.t('ui.tma.consiglio', { accostata: p.accostata, lato: p.lato, minuti: p.minuti });
    scrivi(tela, font, FINESTRA.x1 + 2, TMA.consiglio, t, 14);
  }
}

/**
 * La prova: quella in memoria se è dello stesso contatto, altrimenti una nuova.
 * @param {Contesto} ctx @param {string} c
 */
export function provaPer(ctx, c) {
  const nave = ctx.stato.nave;
  if (!nave) return null;
  if (!ctx.ui.tma.prova || ctx.cache.get('tma:prova:contatto') !== c) {
    ctx.ui.tma.prova = provaIniziale(ctx.stato, c, Math.floor(nave.ora));
    ctx.cache.set('tma:prova:contatto', c);
  }
  return ctx.ui.tma.prova;
}

/** I comandi del MATE: testi e zone, una riga per D/R/V e una per E/Z/U. @param {Contesto} ctx @param {SoluzionePolare | null} p */
function comandiMate(ctx, p) {
  const { font } = ctx;
  const campi = [
    { tasto: TASTI_TMA.D, testo: `D ${p ? metriInKiloiarde(p.distanza).toFixed(1) : '--'}K` },
    { tasto: TASTI_TMA.R, testo: `R ${p ? treCifre(p.rotta) : '---'}*` },
    { tasto: TASTI_TMA.V, testo: `V ${p ? p.velocita.toFixed(1) : '--'}` },
  ];
  /** @type {{ hs: Hotspot, testo: string, x: number, y: number, colore: number }[]} */
  const out = [];
  let x = FINESTRA.x1 + 2;
  campi.forEach((c, i) => {
    const gruppo = 7 + i;
    out.push({ hs: { cursore: 0, x1: x - 1, y1: TMA.comandi1 - 1, x2: x + 5, y2: TMA.comandi1 + 6, colore: 14, tasto: c.tasto, gruppo }, testo: '<', x, y: TMA.comandi1, colore: 14 });
    x += 7;
    out.push({ hs: { cursore: 0, x1: x - 1, y1: TMA.comandi1 - 1, x2: x + larghezzaTesto(font, c.testo), y2: TMA.comandi1 + 6, colore: 14, tasto: -1, gruppo }, testo: c.testo, x, y: TMA.comandi1, colore: 15 });
    x += larghezzaTesto(font, c.testo) + 2;
    out.push({ hs: { cursore: 0, x1: x - 1, y1: TMA.comandi1 - 1, x2: x + 5, y2: TMA.comandi1 + 6, colore: 14, tasto: TASTI_TMA.PIU + c.tasto, gruppo }, testo: '>', x, y: TMA.comandi1, colore: 14 });
    x += 10;
  });
  x = FINESTRA.x1 + 2;
  for (const [tasto, chiave] of /** @type {[number, string][]} */ ([[TASTI_TMA.INVIA, 'ui.tma.invia'], [TASTI_TMA.CANCELLA, 'ui.tma.cancella'], [TASTI_TMA.EQUIPAGGIO, 'ui.tma.equipaggio']])) {
    const testo = ctx.t(chiave);
    out.push({ hs: { cursore: 0, x1: x - 1, y1: TMA.comandi2 - 1, x2: x + larghezzaTesto(font, testo), y2: TMA.comandi2 + 6, colore: 13, tasto, gruppo: 10 }, testo, x, y: TMA.comandi2, colore: 13 });
    x += larghezzaTesto(font, testo) + 8;
  }
  return out;
}

/**
 * Il MATE: i residui della prova per tempo, e i comandi.
 * @param {Contesto} ctx @param {string} c
 */
function disegnaMate(ctx, c) {
  const { tela, font } = ctx;
  const prova = provaPer(ctx, c);
  const st = strumentiDi(ctx, c);
  const res = st.residui;
  const centro = 92;
  if (res && res.punti.length) {
    const righe = TMA.mateY2 - TMA.y1 + 1;
    const tempo = asseTempo(res.punti[res.punti.length - 1].ora, res.punti[0].ora, righe);
    let max = 0;
    for (const p of res.punti) if (p.ora >= tempo.inizio) max = Math.max(max, Math.abs(p.residuo));
    const semi = [1, 2, 5, 10, 20, 45, 90].find((x) => x >= max * 1.1) ?? 180;
    const w = (FINESTRA.x2 - FINESTRA.x1) / 2;
    for (let y = TMA.y1; y <= TMA.mateY2; y += 3) tela.pixel(centro, y, 7);
    for (const f of [-1, 1]) {
      const testo = `${f < 0 ? '-' : '+'}${semi}*`;
      const x = centro + f * w;
      scrivi(tela, font, f < 0 ? FINESTRA.x1 + 1 : x - larghezzaTesto(font, testo), TMA.etichette, testo, 7);
    }
    scrivi(tela, font, centro - 1, TMA.etichette, '0', 7);
    for (const g of st.gambe) {
      const y = Math.round(yDiOra(g.da, tempo, TMA.y1));
      if (y >= TMA.y1 && y <= TMA.mateY2) for (let x = FINESTRA.x1; x <= FINESTRA.x2; x += 3) tela.pixel(x, y, 8);
    }
    for (const p of res.punti) {
      if (p.ora < tempo.inizio) continue;
      const x = Math.round(centro + (p.residuo / semi) * w), y = Math.round(yDiOra(p.ora, tempo, TMA.y1));
      tela.pixel(x, y, Math.abs(p.normalizzato) <= 2 ? 10 : 12);
    }
    const t = ctx.t('ui.tma.rms', { rms: res.rms.toFixed(1) });
    scrivi(tela, font, FINESTRA.x2 - larghezzaTesto(font, t) - 1, TMA.comandi2, t, 7);
  } else {
    const t = ctx.t('ui.tma.attesa_misure');
    scrivi(tela, font, 92 - Math.floor(larghezzaTesto(font, t) / 2), 66, t, 8);
  }
  tela.hline(TMA.comandi1 - 3, FINESTRA.x1, FINESTRA.x2, 8);
  for (const z of comandiMate(ctx, prova)) scrivi(tela, font, z.x, z.y, z.testo, z.colore);
}

/**
 * Colonne dell'elenco delle tracce (x): designazione, rilevamento, variazione (°/min), classe (sigla di sei
 * lettere al più), confidenza (o CTE se la classe è del comandante), stato (N nuova, T tenuta, P persa),
 * ABB per abbandonarla. Ventotto caratteri del font in 168 pixel.
 */
export const COLONNE_ELENCO = Object.freeze({ contatto: 9, ril: 31, varz: 51, classe: 78, conf: 116, stato: 135, abb: 155 });

/** Le righe dell'elenco delle tracce, con le loro zone. @param {Contesto} ctx */
function righeElenco(ctx) {
  const { stato } = ctx;
  const d = designatoDi(ctx);
  return stato.tracce.slice(0, 8).map((t, i) => {
    const y = TMA.etichette + 1 + 9 * i;
    const cl = classeDi(stato, t.contatto);
    const nome = cl.classe ? ctx.t(`ui.tma.classe_breve.${cl.classe}`) : '?';
    const conf = cl.da === 'comandante' ? 'CTE' : cl.confidenza !== null ? String(Math.round(cl.confidenza <= 1 ? cl.confidenza * 100 : cl.confidenza)) : '';
    return {
      t, y,
      contatto: perIlFont(t.contatto),
      ril: Number.isFinite(t.rilevamento) ? treCifre(t.rilevamento) : '---',
      varz: t.variazione !== null ? `${t.variazione >= 0 ? '+' : '-'}${Math.abs(t.variazione).toFixed(1)}` : '',
      nome, conf, stato: ctx.t(`ui.tma.stato.${t.stato}`), abb: ctx.t('ui.tma.abbandona'),
      colore: t.contatto === d ? 13 : t.stato === 'persa' ? 8 : 15,
    };
  });
}

/** L'elenco delle tracce. @param {Contesto} ctx */
function disegnaElenco(ctx) {
  const { tela, font } = ctx;
  const righe = righeElenco(ctx);
  if (righe.length === 0) {
    const t = ctx.t('ui.tma.nessuna_traccia');
    scrivi(tela, font, 92 - Math.floor(larghezzaTesto(font, t) / 2), 72, t, 8);
    return;
  }
  const k = COLONNE_ELENCO;
  for (const r of righe) {
    scrivi(tela, font, k.contatto, r.y, r.contatto, r.colore);
    scrivi(tela, font, k.ril, r.y, r.ril, r.colore);
    scrivi(tela, font, k.varz, r.y, r.varz, 7);
    scrivi(tela, font, k.classe, r.y, r.nome, 11);
    scrivi(tela, font, k.conf, r.y, r.conf, 3);
    scrivi(tela, font, k.stato, r.y, r.stato, 7);
    scrivi(tela, font, k.abb, r.y, r.abb, 12);
  }
}

/** Le zone della vista TMA. @param {Contesto} ctx @returns {Hotspot[]} */
export function hotspotTma(ctx) {
  const { font, ui } = ctx;
  const c = contattoTma(ctx);
  const h = testataTma(ctx, c);
  /** @type {Hotspot[]} */
  const hs = [
    { cursore: 0, x1: h.xc - 1, y1: FINESTRA.y1, x2: h.xc + Math.max(10, larghezzaTesto(font, h.titolo)), y2: TMA.testata + 6, colore: 13, tasto: TASTI_TMA.CONTATTO, gruppo: 5 },
    { cursore: 0, x1: h.xp - 1, y1: FINESTRA.y1, x2: FINESTRA.x2, y2: TMA.testata + 6, colore: 13, tasto: TASTI_TMA.PAGINA, gruppo: 5 },
  ];
  if (ui.tma.vista === 'mate' && c) {
    for (const z of comandiMate(ctx, ui.tma.prova)) if (z.hs.tasto !== -1) hs.push(z.hs);
  }
  if (ui.tma.vista === 'elenco') {
    righeElenco(ctx).forEach((r, i) => {
      hs.push(
        { cursore: 0, x1: FINESTRA.x1, y1: r.y - 1, x2: COLONNE_ELENCO.classe - 2, y2: r.y + 6, colore: 15, tasto: TASTI_TMA.RIGA + i, gruppo: 6 },
        { cursore: 0, x1: COLONNE_ELENCO.classe - 1, y1: r.y - 1, x2: COLONNE_ELENCO.stato - 2, y2: r.y + 6, colore: 11, tasto: TASTI_TMA.CLASSE + i, gruppo: 6 },
        { cursore: 0, x1: COLONNE_ELENCO.abb - 1, y1: r.y - 1, x2: FINESTRA.x2, y2: r.y + 6, colore: 12, tasto: TASTI_TMA.ABBANDONA + i, gruppo: 6 },
      );
    });
  }
  return hs;
}

/**
 * Esegue un comando della vista TMA. Restituisce true se era suo.
 * @param {Contesto} ctx @param {Hotspot} h
 */
export function attivaTma(ctx, h) {
  const ui = ctx.ui, stato = ctx.stato;
  const c = contattoTma(ctx);
  const t = h.tasto;
  if (t === TASTI_TMA.PAGINA) {
    ui.tma.vista = PAGINE[(PAGINE.indexOf(ui.tma.vista) + 1) % PAGINE.length];
    return true;
  }
  if (t === TASTI_TMA.CONTATTO) {
    const lista = stato.tracce.filter((x) => x.stato !== 'persa');
    if (lista.length === 0) return true;
    const i = lista.findIndex((x) => x.contatto === c);
    const n = lista[(i + 1) % lista.length].contatto;
    ui.tma.contatto = n;
    ctx.ordina('designa', n);
    return true;
  }
  if (t >= TASTI_TMA.RIGA && t < TASTI_TMA.RIGA + 30) {
    const r = stato.tracce[t - TASTI_TMA.RIGA];
    if (r) { ui.tma.contatto = r.contatto; ctx.ordina('designa', r.contatto); }
    return true;
  }
  if (t >= TASTI_TMA.CLASSE && t < TASTI_TMA.CLASSE + 30) {
    const r = stato.tracce[t - TASTI_TMA.CLASSE];
    if (!r) return true;
    const cl = classeDi(stato, r.contatto);
    const att = cl.da === 'comandante' ? /** @type {readonly string[]} */ (CLASSI).indexOf(cl.classe ?? '') : -1;
    const prossima = att + 1 < CLASSI.length ? CLASSI[att + 1] : null;
    ctx.ordina('classifica', { contatto: r.contatto, classe: prossima });
    return true;
  }
  if (t >= TASTI_TMA.ABBANDONA && t < TASTI_TMA.ABBANDONA + 30) {
    const r = stato.tracce[t - TASTI_TMA.ABBANDONA];
    if (r) ctx.ordina('abbandona', r.contatto);
    return true;
  }
  if (!c) return false;
  const p = provaPer(ctx, c);
  if (!p) return false;
  const nave = stato.nave;
  switch (t) {
    case TASTI_TMA.D: ui.tma.prova = { ...p, distanza: Math.max(100, p.distanza / PASSI_PROVA.distanza) }; return true;
    case TASTI_TMA.PIU + TASTI_TMA.D: ui.tma.prova = { ...p, distanza: Math.min(150000, p.distanza * PASSI_PROVA.distanza) }; return true;
    case TASTI_TMA.R: ui.tma.prova = { ...p, rotta: norm360(p.rotta - PASSI_PROVA.rotta) }; return true;
    case TASTI_TMA.PIU + TASTI_TMA.R: ui.tma.prova = { ...p, rotta: norm360(p.rotta + PASSI_PROVA.rotta) }; return true;
    case TASTI_TMA.V: ui.tma.prova = { ...p, velocita: Math.max(0, p.velocita - PASSI_PROVA.velocita) }; return true;
    case TASTI_TMA.PIU + TASTI_TMA.V: ui.tma.prova = { ...p, velocita: Math.min(50, p.velocita + PASSI_PROVA.velocita) }; return true;
    case TASTI_TMA.INVIA: {
      // la prova portata all'ora attuale, nella forma dell'ordine (rilevamento compreso)
      const st = provaInStato(stato, p);
      const ora = nave ? Math.floor(nave.ora) : p.ora;
      const proprio = proprioAllOra(stato, ora);
      if (!st || !proprio) return true;
      const q = inPolare(avanzaStato(st, ora), proprio);
      ctx.ordina('soluzione', {
        contatto: c, ora, distanza: Math.max(1, Math.round(q.distanza)), rotta: Math.round(q.rotta * 10) / 10 % 360,
        velocita: Math.round(Math.min(60, q.velocita) * 10) / 10, rilevamento: Math.round(q.rilevamento * 10) / 10 % 360,
      });
      return true;
    }
    case TASTI_TMA.CANCELLA:
      ctx.ordina('soluzione', { contatto: c, cancella: true });
      return true;
    case TASTI_TMA.EQUIPAGGIO: {
      const sol = stato.soluzioni[c];
      if (!sol || !nave) { ctx.avvisa('locale.tma_senza_soluzione'); return true; }
      ui.tma.prova = null;
      ctx.cache.delete('tma:prova:contatto');
      ui.tma.prova = provaIniziale(stato, c, Math.floor(nave.ora));
      ctx.cache.set('tma:prova:contatto', c);
      return true;
    }
    default:
      return false;
  }
}
