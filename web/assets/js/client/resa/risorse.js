// @ts-check
/**
 * Caricamento della grafica originale del 1989 per la resa Classic.
 *
 * Tutto arriva da `web/assets/originali/` (generata dall'estrattore dalla copia dell'utente), ma il
 * browser la chiede SOLO alla rotta autenticata `/originali/<percorso>`: Apache nega l'indirizzo
 * diretto (decisione D4). Il caricatore è astratto (due funzioni, JSON e byte), così le prove in Node
 * leggono gli stessi file dal disco e compongono le stesse schermate.
 */
import { caricaRisorse, FrameBuffer, eseguiLavoro, InterpreteCls } from '../cls.js';
import { decodificaPngIndicizzato, decodificaPngRgba, rgbaInIndici } from './png.js';

/** @typedef {import('../cls.js').Risorse} RisorseCls */
/** @typedef {import('../cls.js').Hotspot} Hotspot */
/** @typedef {import('../cls.js').Aggancio} Aggancio */
/** @typedef {import('../cls.js').PassoCls} PassoCls */
/** @typedef {import('./png.js').ImmagineIndicizzata} ImmagineIndicizzata */
/**
 * Un lavoro di cls/pannelli.json: come il gioco compone una schermata.
 * @typedef {{ id: string, titolo: string, passi: PassoCls[], cirillico: boolean, mostra: 'schermo'|'retro',
 *   dosbox?: string|null, risultato: { hotspot: Hotspot[], agganci: Aggancio[] } }} Lavoro
 */
/**
 * @typedef {object} Originali
 * @property {RisorseCls} cls script, figure e font per l'interprete
 * @property {Record<string, Lavoro>} lavori per id ('STEER_688', 'CONN_688'…)
 * @property {number[][]} palette DAY (= 688.PAL), 256 colori [r, g, b]
 * @property {number[][]} paletteNotte NIGHT: cambiano cielo (16-79), grigi delle sagome (144-159, rossi) e spruzzi
 * @property {Record<string, ImmagineIndicizzata>} immagini sale e ritratti, per percorso ('sale/688.png')
 * @property {Record<string, ImmagineIndicizzata>} sagome sagome del periscopio per nome ('FOREST2'), in indici
 *   della palette DAY (90h + nibble), trasparente = SAGOMA_TRASPARENTE; le carica `caricaSagome`
 */
/**
 * @typedef {object} Lettore
 * @property {(percorso: string) => Promise<any>} json
 * @property {(percorso: string) => Promise<Uint8Array>} byte
 */
/**
 * Pannello pronto: la pagina che il giocatore vede (indici), il retro (dove gli script lasciano gli
 * «sprite» delle manopole) e le zone cliccabili.
 * @typedef {{ lavoro: Lavoro, indici: Uint8Array, retro: Uint8Array, hotspot: Hotspot[], agganci: Aggancio[] }} Pannello
 */

/** Ritratti dell'equipaggio usati dal client (688, confrontati con le catture 014, 047, 061: CREW2 sonarista, CREW3 ufficiale alle armi, CREW4 ufficiale d'immersione). */
export const RITRATTI = ['equipaggio/CREW2.png', 'equipaggio/CREW3.png', 'equipaggio/CREW4.png'];

/**
 * Indice che nelle sagome del periscopio vuol dire «trasparente»: il nibble 15 sarebbe 9Fh, un nero che
 * le sagome non usano mai (ASSET.md §4.4), quindi lo si tiene come segnaposto da saltare.
 */
export const SAGOMA_TRASPARENTE = 0x9f;

/**
 * Lettore per il browser: tutto passa dalla rotta autenticata.
 * @param {string} base per esempio '/originali/' (url('/originali/') nella vista)
 * @returns {Lettore}
 */
export function lettoreHttp(base) {
  const url = (/** @type {string} */ p) => new URL(p, new URL(base, location.href)).href;
  return {
    async json(p) {
      const r = await fetch(url(p), { credentials: 'same-origin' });
      if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
      return r.json();
    },
    async byte(p) {
      const r = await fetch(url(p), { credentials: 'same-origin' });
      if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    },
  };
}

/**
 * Carica tutto quello che serve alla resa Classic.
 * @param {Lettore} lettore
 * @returns {Promise<Originali>}
 */
export async function caricaOriginali(lettore) {
  const [cls, pannelli, day, notte, ...immagini] = await Promise.all([
    caricaRisorse(lettore.json),
    lettore.json('cls/pannelli.json'),
    lettore.json('palette/DAY.json'),
    lettore.json('palette/NIGHT.json'),
    ...['sale/688.png', ...RITRATTI].map(async (p) => [p, await decodificaPngIndicizzato(await lettore.byte(p))]),
  ]);
  /** @type {Record<string, Lavoro>} */
  const lavori = {};
  for (const l of pannelli.lavori) lavori[l.id] = l;
  return {
    cls,
    lavori,
    palette: day.colori,
    paletteNotte: notte.colori,
    immagini: Object.fromEntries(/** @type {[string, ImmagineIndicizzata][]} */ (immagini)),
    sagome: {},
  };
}

/**
 * Carica le sagome del periscopio (le 93 figure di `periscopio/giorno/`, dal manifesto dell'estrattore)
 * e le riporta agli indici della palette DAY: di notte le stesse figure si vedono rosse cambiando solo
 * la palette dello schermo, come faceva il gioco con NIGHT.PAL. Si può limitare a qualche prefisso
 * (per esempio ['FOREST', 'MERCH']); senza, le carica tutte. Non lancia: una figura che non si legge
 * resta semplicemente assente (il periscopio la salta).
 * @param {Originali} orig @param {Lettore} lettore @param {string[]} [prefissi]
 * @returns {Promise<number>} quante figure sono state caricate
 */
export async function caricaSagome(orig, lettore, prefissi) {
  /** @type {string[]} */
  let percorsi = [];
  try {
    const m = await lettore.json('manifest.json');
    percorsi = (m.file ?? []).map((/** @type {{percorso: string}} */ f) => f.percorso)
      .filter((/** @type {string} */ p) => /^periscopio\/giorno\/[A-Z0-9]+\.png$/.test(p));
  } catch {
    return 0;
  }
  const nome = (/** @type {string} */ p) => p.replace(/^.*\//, '').replace(/\.png$/, '');
  if (prefissi) percorsi = percorsi.filter((p) => prefissi.some((x) => nome(p).startsWith(x)));
  let n = 0;
  await Promise.all(percorsi.map(async (p) => {
    try {
      const rgba = await decodificaPngRgba(await lettore.byte(p));
      orig.sagome[nome(p)] = rgbaInIndici(rgba, orig.palette, 0x90, 0x9e, SAGOMA_TRASPARENTE);
      n++;
    } catch {
      // figura illeggibile: il periscopio non la disegna
    }
  }));
  return n;
}

/**
 * Esegue un lavoro e ne tiene le pagine in indici. Lo sfondo della sala comando (688.PAK) è la
 * schermata VGA già decodificata.
 * @param {Originali} orig
 * @param {string} id
 * @returns {Pannello}
 */
export function preparaPannello(orig, id) {
  const lavoro = orig.lavori[id];
  if (!lavoro) throw new Error(`lavoro assente: ${id}`);
  const fb = new FrameBuffer();
  const it = eseguiLavoro(orig.cls, lavoro, fb, {
    sfondo: (nome, pagina) => {
      const img = orig.immagini[`sale/${nome.replace(/\.PAK$/i, '').toUpperCase()}.png`];
      if (img) fb.caricaIndici(pagina, img.indici);
    },
  });
  const mostra = lavoro.mostra ?? 'schermo';
  return {
    lavoro,
    indici: fb.indici(mostra).slice(),
    retro: fb.indici('retro').slice(),
    hotspot: it.hotspot.map((h) => ({ ...h })),
    agganci: it.agganci,
  };
}

/**
 * Bersaglio dell'interprete CLS che scrive sulla tela indicizzata: serve a chiamare le routine degli
 * script con parametri nuovi (il riquadro ON/OFF, il pulsante DEPLOY/RETRIEVE), esattamente come
 * faceva il codice C del gioco sopra il pannello.
 * @typedef {import('../cls.js').Bersaglio} Bersaglio
 */
/** @implements {Bersaglio} */
export class BersaglioTela {
  /** @param {import('./tela.js').Tela} tela */
  constructor(tela) {
    this.tela = tela;
  }

  /** Una sola pagina: lo schermo che si sta componendo. */
  pagina() {}

  /** Nessuna copia fra pagine nelle routine che chiamiamo. */
  copia() {}

  /** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {number} c */
  riempi(x1, y1, x2, y2, c) {
    this.tela.riempi(x1, y1, x2, y2, c);
  }

  /** @param {number} x @param {number} y @param {number} c */
  pixel(x, y, c) {
    this.tela.pixel(x, y, c);
  }

  /** @param {number} x @param {number} y @param {Uint8Array} righe @param {number} c */
  glifo(x, y, righe, c) {
    for (let r = 0; r < 13; r++) {
      const b = righe[r];
      if (!b) continue;
      for (let bit = 0; bit < 8; bit++) if (b & (0x80 >> bit)) this.tela.pixel(x + bit, y + r, c);
    }
  }

  /** @param {number} x @param {number} y @param {Uint8Array} pixel @param {number} trasparente */
  rigaFigura(x, y, pixel, trasparente) {
    for (let i = 0; i < pixel.length; i++) {
      if (trasparente !== 0xff && pixel[i] === trasparente) continue;
      this.tela.pixel(x + i, y, pixel[i]);
    }
  }
}

/**
 * Chiama una routine di uno script CLS sulla tela (per esempio NAV.CLS routine 8 = il riquadro con
 * il testo ombreggiato). Lo stato del testo riparte da quello iniziale del gioco.
 * @param {RisorseCls} cls @param {import('./tela.js').Tela} tela
 * @param {string} file @param {number} routine @param {(number|string)[]} argomenti
 */
export function chiamaRoutine(cls, tela, file, routine, argomenti) {
  const it = new InterpreteCls({ risorse: cls, bersaglio: new BersaglioTela(tela) });
  it.esegui(file, routine, argomenti);
}
