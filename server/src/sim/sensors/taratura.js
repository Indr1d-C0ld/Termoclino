// @ts-check
/**
 * Taratura del sonar passivo: portate di rivelazione (SE medio = 0, cioe'
 * probabilita' di scoperta del 50 % senza fluttuazione) per i casi che
 * contano, calcolate con LO STESSO codice che produce i fotogrammi
 * (SensorePassivo.eccesso). Le usano le prove (bande di portata) e lo
 * strumento server/strumenti/taratura.js, che stampa la tabella di
 * docs/CALIBRAZIONE_F1.md.
 *
 * Geometria canonica: chi ascolta va verso nord; il bersaglio sta al traverso
 * di dritta del sensore (rilevamento 090), con la prua a nord: aspetto al
 * traverso, nessuna correzione di prua o di poppa.
 */

import { Generatore } from '../../../../shared/rng.js';
import { Battello } from '../platform/battello.js';
import { Nave, Biologico } from '../../ai/navi.js';
import { SensorePassivo } from './passivo.js';

/** @typedef {import('./acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../world/ambiente.js').Ambiente} Ambiente */
/** @typedef {import('../../../../shared/data/piattaforme.js').Piattaforma} Piattaforma */
/** @typedef {import('./passivo.js').Sorgente} Sorgente */

/**
 * @typedef {object} Ascoltatore
 * @property {'sfera' | 'towed'} sensore
 * @property {number} velocita kt
 * @property {number} quota m (chiglia)
 */

/**
 * @typedef {{tipo: 'sottomarino', piattaforma: string, velocita: number, quota: number}
 *   | {tipo: 'nave', classe: 'cacciatorpediniere' | 'mercantile', velocita: number}
 *   | {tipo: 'biologico'}} Bersaglio
 */

/**
 * Un battello fermo nello stato voluto (velocita', quota, cavitazione).
 * @param {Piattaforma} p
 * @param {ValoriAcustica} ac
 * @param {string} id
 * @param {number} velocita
 * @param {number} quota
 */
function battelloFisso(p, ac, id, velocita, quota) {
  const b = new Battello({
    id, nome: id, sigla: id, piattaforma: p.valori, x: 0, y: 0, z: quota, rotta: 0, velocita,
    rng: new Generatore(1), acustica: ac,
  });
  b.vElica = velocita;
  b.cavitante = velocita > b.vCavitazione;
  return b;
}

/**
 * Le funzioni SE(r) di un caso.
 * @param {object} a
 * @param {Ascoltatore} a.ascoltatore
 * @param {Bersaglio} a.bersaglio
 * @param {ValoriAcustica} a.ac
 * @param {Ambiente} a.amb
 * @param {Map<string, Piattaforma>} a.piattaforme
 * @returns {(r: number) => number | null} eccesso medio a distanza r (m) dal sensore
 */
export function eccessoAllaDistanza(a) {
  const { ac, amb } = a;
  const p688 = /** @type {Piattaforma} */ (a.piattaforme.get('688'));
  const chi = battelloFisso(p688, ac, 'ascolta', a.ascoltatore.velocita, a.ascoltatore.quota);
  if (a.ascoltatore.sensore === 'towed') {
    const t = /** @type {NonNullable<Battello['towed']>} */ (chi.towed);
    t.stato = 'filata';
    t.filato = t.lunghezza;
    chi._towed(0, amb);
  }
  const sensore = new SensorePassivo({
    nome: a.ascoltatore.sensore, battello: chi, ac, rng: new Generatore(2), rngCoppia: () => new Generatore(3),
  });
  const g = sensore.geometria(amb);
  if (!g) throw new Error('sensore non in acqua');
  /** @type {Sorgente & {x: number, y: number}} */
  let s;
  const b = a.bersaglio;
  if (b.tipo === 'sottomarino') {
    s = battelloFisso(/** @type {Piattaforma} */ (a.piattaforme.get(b.piattaforma)), ac, 'bersaglio', b.velocita, b.quota);
  } else if (b.tipo === 'nave') {
    s = new Nave({
      id: 'bersaglio', classe: b.classe, nome: b.classe, profilo: ac.sorgenti[b.classe],
      x: 0, y: 0, rotta: 0, velocita: b.velocita, waypoint: [],
    });
  } else {
    const bio = new Biologico({ id: 'bersaglio', x: 0, y: 0, profilo: ac.sorgenti.biologico, rng: new Generatore(4) });
    bio.attivo = true;
    bio.rotta = 0;
    s = bio;
  }
  return (r) => {
    s.x = g.pos.x + r;
    s.y = g.pos.y;
    const e = sensore.eccesso(s, amb, g);
    return e ? e.se : null;
  };
}

/**
 * Distanza (m) a cui l'eccesso medio scende a 0 dB. Infinity se oltre 500 km,
 * 0 se non si sente nemmeno a 10 m.
 * @param {(r: number) => number | null} se
 */
export function portata(se) {
  const f = (/** @type {number} */ r) => se(r) ?? -Infinity;
  let lo = 10;
  let hi = 500_000;
  if (f(hi) >= 0) return Infinity;
  if (f(lo) < 0) return 0;
  for (let i = 0; i < 80; i++) {
    const m = Math.sqrt(lo * hi);
    if (f(m) >= 0) lo = m; else hi = m;
  }
  return lo;
}

/**
 * I casi della tabella di taratura (docs/CALIBRAZIONE_F1.md).
 * @type {{nome: string, ascoltatore: Ascoltatore, bersaglio: Bersaglio, banda?: string}[]}
 */
export const CASI_TARATURA = [
  { nome: '688 a 5 kt, entrambi a 150 m', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 150 } },
  { nome: '688 a 5 kt a quota periscopica, ascolto a 150 m (strato in mezzo)', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 18 } },
  { nome: '688 a 10 kt (150 m)', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 10, quota: 150 } },
  { nome: '688 a 15 kt (150 m)', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 15, quota: 150 } },
  { nome: '688 a 20 kt (150 m, cavita)', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 20, quota: 150 } },
  { nome: '688 a 10 kt a quota periscopica (cavita), ascolto a quota periscopica', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 18 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 10, quota: 18 } },
  { nome: '688 a 5 kt, chi ascolta va a 15 kt', ascoltatore: { sensore: 'sfera', velocita: 15, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 150 } },
  { nome: '688 a 5 kt, chi ascolta va a 25 kt', ascoltatore: { sensore: 'sfera', velocita: 25, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 150 } },
  { nome: 'Alfa a 10 kt (150 m)', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: 'alfa', velocita: 10, quota: 150 } },
  { nome: 'Alfa a 40 kt (300 m, cavita)', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: 'alfa', velocita: 40, quota: 300 } },
  { nome: 'cacciatorpediniere a 10 kt, ascolto a quota periscopica (stesso lato)', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 18 }, bersaglio: { tipo: 'nave', classe: 'cacciatorpediniere', velocita: 10 } },
  { nome: 'cacciatorpediniere a 10 kt, ascolto a 150 m (sotto lo strato)', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 150 }, bersaglio: { tipo: 'nave', classe: 'cacciatorpediniere', velocita: 10 } },
  { nome: 'cacciatorpediniere a 20 kt, ascolto a quota periscopica', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 18 }, bersaglio: { tipo: 'nave', classe: 'cacciatorpediniere', velocita: 20 } },
  { nome: 'cacciatorpediniere a 20 kt, ascolto a 150 m', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 150 }, bersaglio: { tipo: 'nave', classe: 'cacciatorpediniere', velocita: 20 } },
  { nome: 'cacciatorpediniere fermo (macchinari), ascolto a quota periscopica', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 18 }, bersaglio: { tipo: 'nave', classe: 'cacciatorpediniere', velocita: 0 } },
  { nome: 'mercantile a 12 kt, ascolto a quota periscopica', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 18 }, bersaglio: { tipo: 'nave', classe: 'mercantile', velocita: 12 } },
  { nome: 'mercantile a 12 kt, ascolto a 150 m', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 150 }, bersaglio: { tipo: 'nave', classe: 'mercantile', velocita: 12 } },
  { nome: 'sorgente biologica attiva (30 m), ascolto a 150 m', ascoltatore: { sensore: 'sfera', velocita: 5, quota: 150 }, bersaglio: { tipo: 'biologico' } },
  { nome: '688 a 5 kt (150 m) — antenna, battello a 150 m', ascoltatore: { sensore: 'towed', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 150 } },
  { nome: '688 a 15 kt (150 m) — antenna', ascoltatore: { sensore: 'towed', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 15, quota: 150 } },
  { nome: 'Alfa a 10 kt (150 m) — antenna', ascoltatore: { sensore: 'towed', velocita: 5, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: 'alfa', velocita: 10, quota: 150 } },
  { nome: '688 a 5 kt (150 m) — antenna a 10 kt', ascoltatore: { sensore: 'towed', velocita: 10, quota: 150 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 150 } },
  { nome: '688 a 5 kt (150 m) — antenna, battello a quota periscopica (antenna sotto lo strato)', ascoltatore: { sensore: 'towed', velocita: 5, quota: 18 }, bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 150 } },
  { nome: 'cacciatorpediniere a 10 kt — antenna, battello a quota periscopica', ascoltatore: { sensore: 'towed', velocita: 5, quota: 18 }, bersaglio: { tipo: 'nave', classe: 'cacciatorpediniere', velocita: 10 } },
  { nome: 'mercantile a 12 kt — antenna, battello a 150 m', ascoltatore: { sensore: 'towed', velocita: 5, quota: 150 }, bersaglio: { tipo: 'nave', classe: 'mercantile', velocita: 12 } },
];

/**
 * La tabella delle portate.
 * @param {ValoriAcustica} ac
 * @param {Ambiente} amb
 * @param {Map<string, Piattaforma>} piattaforme
 * @returns {{nome: string, sensore: string, metri: number, kyd: number, nm: number}[]}
 */
export function tabellaPortate(ac, amb, piattaforme) {
  return CASI_TARATURA.map((c) => {
    const r = portata(eccessoAllaDistanza({ ascoltatore: c.ascoltatore, bersaglio: c.bersaglio, ac, amb, piattaforme }));
    return { nome: c.nome, sensore: c.ascoltatore.sensore, metri: r, kyd: r / 914.4, nm: r / 1852 };
  });
}
