// @ts-check
/**
 * Taratura dei sensori di F2 (docs/CALIBRAZIONE_F2.md, sezioni dei sensori):
 * portate della banda stretta (righe tonali) contro la banda larga, del sonar
 * attivo contro l'intercettazione, dell'ottica e dell'ESM; errore dello
 * stadimetro. Le calcola LO STESSO codice che produce le misure
 * (bandastretta.js, attivo.js, ottica.js, radio.js), senza fluttuazione: una
 * portata e' la distanza a cui l'eccesso di segnale medio scende a 0 (50 % di
 * probabilita' di scoperta).
 *
 * Geometria canonica come in F1 (taratura.js): chi ascolta va verso nord, il
 * bersaglio sta al suo traverso di dritta con la prua a nord (aspetto al
 * traverso). Per il ping il bersaglio sta a prua, nel settore di trasmissione.
 */

import { Generatore } from '../../../../shared/rng.js';
import { Battello } from '../platform/battello.js';
import { Nave, Biologico } from '../../ai/navi.js';
import { SensorePassivo } from './passivo.js';
import { AnalizzatoreBandaStretta } from './bandastretta.js';
import { eccessoEco, eccessoIntercetto } from './attivo.js';
import { Periscopio } from './ottica.js';
import { livelloEsm } from './radio.js';
import { portata } from './taratura.js';

/** @typedef {import('./acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../world/ambiente.js').Ambiente} Ambiente */
/** @typedef {import('../../../../shared/data/piattaforme.js').Piattaforma} Piattaforma */
/** @typedef {import('./taratura.js').Ascoltatore} Ascoltatore */
/** @typedef {import('./taratura.js').Bersaglio} Bersaglio */

export { portata };

/** Firma di classe delle navi della palestra. */
const FIRMA = /** @type {const} */ ({ cacciatorpediniere: 'forrest_sherman', mercantile: 'mercantile_generico' });

/**
 * Un battello fermo nello stato voluto, con l'antenna filata se serve.
 * @param {Piattaforma} p @param {ValoriAcustica} ac @param {Ambiente} amb
 * @param {string} id @param {number} velocita @param {number} quota
 */
function battelloFisso(p, ac, amb, id, velocita, quota) {
  const b = new Battello({
    id, nome: id, sigla: id, piattaforma: p.valori, x: 0, y: 0, z: quota, rotta: 0, velocita,
    rng: new Generatore(1), acustica: ac,
  });
  b.vElica = velocita;
  b.cavitante = velocita > b.vCavitazione;
  if (b.towed) {
    b.towed.stato = 'filata';
    b.towed.filato = b.towed.lunghezza;
    b._towed(0, amb);
  }
  return b;
}

/**
 * Il bersaglio di un caso.
 * @param {Bersaglio} b @param {ValoriAcustica} ac @param {Ambiente} amb @param {Map<string, Piattaforma>} piattaforme
 */
function bersaglio(b, ac, amb, piattaforme) {
  if (b.tipo === 'sottomarino') {
    return battelloFisso(/** @type {Piattaforma} */ (piattaforme.get(b.piattaforma)), ac, amb, 'bersaglio', b.velocita, b.quota);
  }
  if (b.tipo === 'nave') {
    return new Nave({
      id: 'bersaglio', classe: b.classe, nome: b.classe, profilo: ac.sorgenti[b.classe],
      x: 0, y: 0, rotta: 0, velocita: b.velocita, waypoint: [], firma: ac.firme[FIRMA[b.classe]],
    });
  }
  const bio = new Biologico({
    id: 'bersaglio', x: 0, y: 0, profilo: ac.sorgenti.biologico, rng: new Generatore(4), specie: ac.firme.biologico.specie?.balena ?? null,
  });
  bio.attivo = true;
  bio.rotta = 0;
  bio.fCanto = 300;
  return bio;
}

/**
 * La riga piu' forte di un bersaglio alla distanza r, sul sensore (banda
 * stretta, senza fluttuazione).
 * @param {object} a
 * @param {Ascoltatore} a.ascoltatore
 * @param {Bersaglio} a.bersaglio
 * @param {ValoriAcustica} a.ac
 * @param {Ambiente} a.amb
 * @param {Map<string, Piattaforma>} a.piattaforme
 * @returns {(r: number) => number | null} SE della riga piu' forte
 */
export function eccessoBandaStretta(a) {
  const { ac, amb } = a;
  const chi = battelloFisso(/** @type {Piattaforma} */ (a.piattaforme.get('688')), ac, amb, 'ascolta', a.ascoltatore.velocita, a.ascoltatore.quota);
  const passivo = new SensorePassivo({ nome: a.ascoltatore.sensore, battello: chi, ac, rng: new Generatore(2), rngCoppia: () => new Generatore(3) });
  const bs = new AnalizzatoreBandaStretta({ passivo, ac, rng: new Generatore(5), rngCoppia: () => new Generatore(6) });
  const g = passivo.geometria(amb);
  if (!g) throw new Error('sensore non in acqua');
  const s = bersaglio(a.bersaglio, ac, amb, a.piattaforme);
  return (r) => {
    s.x = g.pos.x + r;
    s.y = g.pos.y;
    const v = bs.vista(/** @type {any} */ (s), g);
    if (!v) return null;
    const righe = bs.righeSorgente(v, amb, g, 0);
    let m = -Infinity;
    for (const x of righe) if (x.se > m) m = x.se;
    return m === -Infinity ? null : m;
  };
}

/**
 * La frequenza della riga piu' forte alla distanza r (per la tabella).
 * @param {Parameters<typeof eccessoBandaStretta>[0]} a
 * @param {number} r
 */
export function rigaMigliore(a, r) {
  const { ac, amb } = a;
  const chi = battelloFisso(/** @type {Piattaforma} */ (a.piattaforme.get('688')), ac, amb, 'ascolta', a.ascoltatore.velocita, a.ascoltatore.quota);
  const passivo = new SensorePassivo({ nome: a.ascoltatore.sensore, battello: chi, ac, rng: new Generatore(2), rngCoppia: () => new Generatore(3) });
  const bs = new AnalizzatoreBandaStretta({ passivo, ac, rng: new Generatore(5), rngCoppia: () => new Generatore(6) });
  const g = /** @type {NonNullable<ReturnType<SensorePassivo['geometria']>>} */ (passivo.geometria(amb));
  const s = bersaglio(a.bersaglio, ac, amb, a.piattaforme);
  s.x = g.pos.x + r;
  s.y = g.pos.y;
  const v = bs.vista(/** @type {any} */ (s), g);
  if (!v) return null;
  let m = null;
  for (const x of bs.righeSorgente(v, amb, g, 0)) if (!m || x.se > m.se) m = x;
  return m;
}

/**
 * Eccesso dell'eco (bersaglio a prua, ping puntato o di settore) e
 * dell'intercettazione (un altro 688 o un Alfa che ascolta) alla distanza r.
 * @param {object} a
 * @param {string} a.pingatore  piattaforma di chi pinga
 * @param {number} a.quota
 * @param {Bersaglio} a.bersaglio
 * @param {'corta' | 'lunga'} a.portata
 * @param {boolean} a.puntato  fascio puntato (altrimenti tutto il settore)
 * @param {number} [a.rottaBersaglio]  gradi (0 = come chi pinga: nessun moto radiale; 180 = gli viene incontro)
 * @param {ValoriAcustica} a.ac
 * @param {Ambiente} a.amb
 * @param {number} a.statoMare
 * @param {Map<string, Piattaforma>} a.piattaforme
 */
export function eccessoAttivo(a) {
  const { ac, amb } = a;
  const b = battelloFisso(/** @type {Piattaforma} */ (a.piattaforme.get(a.pingatore)), ac, amb, 'pinga', 5, a.quota);
  b.towed = null;
  const e = bersaglio(a.bersaglio, ac, amb, a.piattaforme);
  e.rotta = a.rottaBersaglio ?? 0;
  const richiesto = { rilevamento: a.puntato ? 0 : null, portata: a.portata };
  return {
    /** @param {number} r */
    eco: (r) => {
      e.x = b.x;
      e.y = b.y + r;
      return eccessoEco(b, /** @type {any} */ (e), richiesto, ac, amb, a.statoMare)?.se ?? null;
    },
    /** @param {number} r */
    intercetto: (r) => {
      if (e.tipo !== 'sottomarino') return null;
      e.x = b.x;
      e.y = b.y + r;
      return eccessoIntercetto(b, /** @type {Battello} */ (e), richiesto, ac, amb)?.se ?? null;
    },
  };
}

/**
 * Portate ottiche di una nave dal periscopio: la sagoma e (di notte) le luci,
 * e il limite dell'orizzonte per la testa d'albero e per la linea d'acqua.
 * @param {ValoriAcustica} ac
 * @param {Piattaforma} p  chi guarda
 * @param {string} firma
 * @param {boolean} notte
 * @param {number} statoMare
 */
export function portateOttiche(ac, p, firma, notte, statoMare) {
  const o = ac.ottica;
  const hOcchio = p.valori.sensori.periscopio.altezza_occhio ?? 2;
  const H = ac.firme[firma].ottica?.altezza_alberi ?? 20;
  const mare = Periscopio.fattoreMare(ac, statoMare);
  const oriz = (/** @type {number} */ h) => o.orizzonte * 1000 * Math.sqrt(h);
  const testa = oriz(hOcchio) + oriz(H);
  return {
    sagoma: Math.min(testa, (notte ? o.visibilita_notte : o.visibilita_giorno) * mare),
    luci: notte ? Math.min(testa, o.luce_testa_albero * mare) : 0,
    stadimetro: Math.min(oriz(hOcchio), (notte ? o.visibilita_notte : o.visibilita_giorno) * mare),
    orizzonte_testa: testa,
  };
}

/**
 * Portata dell'ESM su un radar (livello sopra la sensibilita' = 0), m.
 * @param {ValoriAcustica} ac
 * @param {import('../../../../shared/data/firme.js').Radar} r
 * @param {{altezza?: number, sensibilita?: number}} esm
 */
export function portataEsm(ac, r, esm) {
  const f = (/** @type {number} */ d) => livelloEsm(r, d, esm.altezza ?? 3, esm.sensibilita ?? -70, ac);
  let lo = 100;
  let hi = 2_000_000;
  if (f(hi) >= 0) return Infinity;
  for (let i = 0; i < 80; i++) {
    const m = Math.sqrt(lo * hi);
    if (f(m) >= 0) lo = m; else hi = m;
  }
  return lo;
}

/**
 * Errore dello stadimetro con la classe giusta, su `n` letture a distanze fra
 * 1 km e il limite della linea d'acqua: frazione entro ±7 %, media e σ.
 * @param {ValoriAcustica} ac
 * @param {Piattaforma} p
 * @param {string} firma
 * @param {number} n
 * @param {number | string} seme
 */
export function erroreStadimetro(ac, p, firma, n, seme) {
  const oss = new Battello({
    id: 'oss', nome: 'oss', sigla: 'oss', piattaforma: p.valori, x: 0, y: 0, z: p.valori.profondita.periscopica,
    rotta: 0, velocita: 0, rng: new Generatore(1), acustica: ac,
  });
  oss.alberi.periscopio = true;
  const per = new Periscopio(oss, new Generatore(seme));
  const fv = ac.firme[firma];
  const H = /** @type {NonNullable<typeof fv.ottica>} */ (fv.ottica).altezza_alberi;
  const nave = new Nave({
    id: 'n', classe: 'cacciatorpediniere', nome: 'n', profilo: ac.sorgenti.cacciatorpediniere,
    x: 0, y: 0, rotta: 90, velocita: 10, waypoint: [], firma: fv,
  });
  const rng = new Generatore(`${seme}:distanze`);
  const limite = portateOttiche(ac, p, firma, false, 3).stadimetro;
  /** @type {number[]} */
  const errori = [];
  for (let i = 0; i < n; i++) {
    const R = rng.intervallo(1000, limite * 0.98);
    nave.x = R;
    nave.y = 0;
    const v = per.guarda({ entita: [nave], ac, notte: false, statoMare: 3 });
    const el = v.oggetti[0]?.elevazione_alberi;
    if (el === null || el === undefined) continue;
    const stima = H / Math.tan(el * Math.PI / 180);
    errori.push((stima - R) / R);
  }
  const media = errori.reduce((s, x) => s + x, 0) / errori.length;
  const sigma = Math.sqrt(errori.reduce((s, x) => s + (x - media) ** 2, 0) / errori.length);
  return { n: errori.length, entro7: errori.filter((x) => Math.abs(x) <= 0.07).length / errori.length, media, sigma };
}

/**
 * I casi delle tabelle di banda stretta (stessi bersagli di F1).
 * @type {{nome: string, ascoltatore: Ascoltatore, bersaglio: Bersaglio}[]}
 */
export const CASI_BANDA_STRETTA = [
  { nome: 'cacciatorpediniere a 10 kt, ascolto a 150 m', ascoltatore: { sensore: 'towed', velocita: 5, quota: 150 }, bersaglio: { tipo: 'nave', classe: 'cacciatorpediniere', velocita: 10 } },
  { nome: 'cacciatorpediniere a 10 kt, battello a quota periscopica', ascoltatore: { sensore: 'towed', velocita: 5, quota: 18 }, bersaglio: { tipo: 'nave', classe: 'cacciatorpediniere', velocita: 10 } },
  { nome: 'cacciatorpediniere fermo (macchinari), ascolto a 150 m', ascoltatore: { sensore: 'towed', velocita: 5, quota: 150 }, bersaglio: { tipo: 'nave', classe: 'cacciatorpediniere', velocita: 0 } },
  { nome: 'mercantile a 12 kt, ascolto a 150 m', ascoltatore: { sensore: 'towed', velocita: 5, quota: 150 }, bersaglio: { tipo: 'nave', classe: 'mercantile', velocita: 12 } },
  { nome: '688 a 5 kt (150 m), ascolto a 150 m', ascoltatore: { sensore: 'towed', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 150 } },
  { nome: '688 a 20 kt (150 m, pompe in alta velocita\'), ascolto a 150 m', ascoltatore: { sensore: 'towed', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 20, quota: 150 } },
  { nome: 'Alfa a 5 kt (150 m), ascolto a 150 m', ascoltatore: { sensore: 'towed', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: 'alfa', velocita: 5, quota: 150 } },
  { nome: 'Alfa a 10 kt (150 m), ascolto a 150 m', ascoltatore: { sensore: 'towed', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: 'alfa', velocita: 10, quota: 150 } },
  { nome: 'balena che canta (30 m), ascolto a 150 m', ascoltatore: { sensore: 'towed', velocita: 5, quota: 150 }, bersaglio: { tipo: 'biologico' } },
];
