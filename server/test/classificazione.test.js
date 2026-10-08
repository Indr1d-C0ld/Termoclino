// @ts-check
/**
 * La classificazione dell'equipaggio (server/src/sim/crew/classificazione.js)
 * contro la biblioteca delle firme (shared/data/firme.js) su spettri
 * sintetici: classe giusta e tempo con l'evidenza netta (3 minuti), tempo e
 * frequenza d'errore con l'evidenza discreta (6 minuti, 15 %), nessuna classe
 * senza niente che somigli alla biblioteca, il comandante che prevale, i
 * biologici dai transitori.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Classificatore, CLASSIFICAZIONE, statoDi, paleDaDemon, righeDi } from '../src/sim/crew/classificazione.js';
import { Traccia, Ipotesi } from '../src/sim/crew/tracce.js';
import { biblioteca } from '../../shared/data/firme.js';
import { caricaFirme } from '../../shared/data/firme.js';
import { Generatore } from '../../shared/rng.js';
import { quantizzaSE } from '../../shared/protocol.js';
import { piattaforme } from './aiuto.js';

const libro = biblioteca(piattaforme, await caricaFirme());

/**
 * Uno spettro dell'antenna (1 Hz per cella da 0) con le righe date, e il DEMON
 * (0,1 Hz per cella) con la riga d'asse e quella di pala.
 * @param {Generatore} rng
 * @param {{hz: number, se: number}[]} righe
 * @param {{asse: number, pale: number} | null} elica
 */
function spettro(rng, righe, elica) {
  const v = new Uint8Array(1024);
  for (let k = 0; k < v.length; k++) {
    let lin = 0.1 * -Math.log(1 - rng.uniforme());
    for (const r of righe) lin += 10 ** ((r.se - 12 * ((k + 0.5 - r.hz) / 0.8) ** 2) / 10);
    v[k] = quantizzaSE(10 * Math.log10(lin));
  }
  const d = new Uint8Array(512);
  for (let k = 0; k < d.length; k++) {
    let lin = 0.1 * -Math.log(1 - rng.uniforme());
    if (elica) {
      for (const [f, se] of [[elica.asse, 3], [elica.asse * elica.pale, 10]]) lin += 10 ** ((se - 12 * ((0.1 * (k + 0.5) - f) / 0.15) ** 2) / 10);
    }
    d[k] = quantizzaSE(10 * Math.log10(lin));
  }
  return { da_hz: 0, passo_hz: 1, righe: v, demon_da_hz: 0, demon_passo_hz: 0.1, demon: d };
}

/** @param {string} c */
function traccia(c) {
  const t = new Traccia(0, [new Ipotesi()]);
  t.contatto = c;
  return t;
}

/**
 * Guarda una traccia ogni PERIODO secondi fino a `fine`; restituisce le decisioni.
 * @param {Classificatore} cl @param {any} t @param {Generatore} rng
 * @param {{hz: number, se: number}[]} righe @param {{asse: number, pale: number} | null} elica @param {number} fine
 */
function ascolta(cl, t, rng, righe, elica, fine) {
  /** @type {{ora: number, classe: string, confidenza: number}[]} */
  const decisioni = [];
  for (let ora = 1; ora <= fine; ora++) {
    if (cl.vuoleGuardare(t, ora)) cl.sguardo(t, spettro(rng, righe, elica), ora);
    const d = cl.decidi(t, ora);
    if (d) decisioni.push({ ora, classe: d.classe, confidenza: d.confidenza });
  }
  return decisioni;
}

test('righe e pale dagli spettri', () => {
  const sp = spettro(new Generatore('r'), [{ hz: 60, se: 8 }, { hz: 400, se: 6 }], { asse: 2, pale: 4 });
  const r = righeDi(sp.righe, 0, 1, 10).map((x) => Math.round(x.hz));
  assert.deepEqual(r, [60, 400]);
  const p = paleDaDemon(righeDi(sp.demon, 0, 0.1, 0.5));
  assert.equal(p?.pale, 4);
  assert.ok(Math.abs(/** @type {number} */ (p?.asse) - 2) < 0.1);
});

test('evidenza netta: il Forrest Sherman in tre minuti, quasi sempre giusto', () => {
  const fs = /** @type {NonNullable<ReturnType<typeof libro.get>>} */ (libro.get('forrest_sherman'));
  const righe = fs.righe.map((r) => ({ hz: r.frequenza, se: 6 }));
  const cl = new Classificatore({ biblioteca: libro, rng: new Generatore('netta') });
  let giuste = 0;
  for (let i = 0; i < 40; i++) {
    const t = traccia(`S${i + 1}`);
    const d = ascolta(cl, t, new Generatore(`fs-${i}`), righe, { asse: 2, pale: /** @type {number} */ (fs.pale) }, 400);
    // la prima riga stabile arriva al terzo sguardo (16-24 s), poi 3 minuti; se
    // la prima volta sbaglia, al riesame (un minuto dopo) si corregge
    assert.ok(d.length >= 1 && d.length <= 2, JSON.stringify(d));
    assert.ok(d[0].ora >= 180 && d[0].ora <= 220, `classificato a ${d[0].ora}`);
    assert.equal(d[0].confidenza, 95);
    if (d[0].classe === 'forrest_sherman') giuste++;
    assert.equal(d[d.length - 1].classe, 'forrest_sherman');
  }
  assert.ok(giuste >= 35, `giuste al primo colpo ${giuste} su 40 (errore atteso 5 %)`);
});

test('evidenza discreta: sei minuti e l\'errore dichiarato (15 %), su molte tracce', () => {
  // una sola riga, quella delle pompe del 688 a bassa velocita' (74 Hz): un carattere, vantaggio 1,5
  const cl = new Classificatore({ biblioteca: libro, rng: new Generatore('discreta') });
  let sbagliate = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const t = traccia(`S${i + 1}`);
    const d = ascolta(cl, t, new Generatore(`d-${i}`), [{ hz: 74, se: 7 }], null, 420);
    assert.equal(d.length, 1);
    assert.ok(d[0].ora >= 360 && d[0].ora <= 400, `classificato a ${d[0].ora}`);
    assert.equal(d[0].confidenza, 85);
    if (d[0].classe !== '688') sbagliate++;
  }
  const atteso = CLASSIFICAZIONE.LIVELLI[1].errore;
  // binomiale: 200 prove, p = 0,15 → σ ≈ 2,5 %; ±3σ
  assert.ok(Math.abs(sbagliate / N - atteso) < 0.075, `errori ${sbagliate}/${N}`);
});

test('niente che somigli alla biblioteca: nessuna classe; il comandante prevale', () => {
  const cl = new Classificatore({ biblioteca: libro, rng: new Generatore('niente') });
  const t = traccia('S1');
  assert.deepEqual(ascolta(cl, t, new Generatore('x'), [{ hz: 333, se: 8 }, { hz: 517, se: 8 }], null, 700), []);
  cl.comandante(t, 'alfa');
  assert.equal(statoDi(t).classe, 'alfa');
  assert.equal(statoDi(t).da, 'comandante');
  assert.equal(cl.vuoleGuardare(t, 800), false);
  // il Forrest Sherman ora si sente, ma il comandante ha deciso
  const fs = /** @type {NonNullable<ReturnType<typeof libro.get>>} */ (libro.get('forrest_sherman'));
  assert.deepEqual(ascolta(cl, t, new Generatore('y'), fs.righe.map((r) => ({ hz: r.frequenza, se: 6 })), null, 400), []);
  cl.comandante(t, null);
  assert.equal(statoDi(t).da, null);
});

test('i biologici si riconoscono dai transitori', () => {
  const cl = new Classificatore({ biblioteca: libro, rng: new Generatore('bio') });
  let giuste = 0;
  for (let i = 0; i < 20; i++) {
    const t = traccia(`S${i + 1}`);
    /** @type {any[]} */
    const d = [];
    for (let ora = 1; ora <= 400; ora++) {
      if (ora % 30 === 0) cl.transitorio(t, 'biologico', ora);
      if (cl.vuoleGuardare(t, ora)) cl.sguardo(t, spettro(new Generatore(`b${i}-${ora}`), [], null), ora);
      const x = cl.decidi(t, ora);
      if (x) d.push({ ora, ...x });
    }
    assert.ok(d.length >= 1);
    // un solo carattere (i transitori): evidenza discreta, sei minuti
    assert.ok(d[0].ora >= 360, `classificato a ${d[0].ora}`);
    if (d[0].classe === 'biologico') giuste++;
  }
  assert.ok(giuste >= 14, `biologici giusti ${giuste} su 20`);
});
