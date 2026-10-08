// Prove della mappa (web/assets/js/client/resa/mappa.js) e dell'HUD: classi di profondità e rampa
// della carta nautica, coste, trasformazioni mondo/schermo, «a metà verso il bordo», scale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { importa, CI_SONO_ORIGINALI, ORIGINALI, MOTIVO_SALTO } from './ambiente_client.mjs';

const {
  classeProfondita, indiceCarta, costeggia, inSchermo, inMondo, puntoAMetaBordo, CENTRO, FINESTRA,
  SCALE_MAPPA_M, SOGLIE_CLASSI_M, classiFinestra,
} = await importa('resa/mappa.js');
const { xBussola, yQuota } = await importa('resa/hud.js');

test('classi: terra a quota ≤ 0, poi 2..15 dall\'acqua bassa alla fossa', () => {
  assert.equal(classeProfondita(-5), 0);
  assert.equal(classeProfondita(0), 0);
  assert.equal(classeProfondita(5), 2);
  assert.equal(classeProfondita(10), 3);
  assert.equal(classeProfondita(150), 8);
  assert.equal(classeProfondita(1499), 14);
  assert.equal(classeProfondita(3000), 15);
  assert.equal(classeProfondita(NaN), 0);
  assert.equal(SOGLIE_CLASSI_M.length, 13); // 14 classi d'acqua
  for (let m = 1; m < 4000; m += 7) assert.ok(classeProfondita(m + 7) >= classeProfondita(m));
});

test('indici della carta: 0BFh + 4·classe (ASSET.md §4.4)', () => {
  assert.equal(indiceCarta(0), 191);
  assert.equal(indiceCarta(1), 195);
  assert.equal(indiceCarta(15), 251);
});

test('palette DAY: terra verde, costa verde scura, acqua dal celeste al blu notte', { skip: !CI_SONO_ORIGINALI && MOTIVO_SALTO }, () => {
  const day = JSON.parse(readFileSync(path.join(ORIGINALI, 'palette', 'DAY.json'), 'utf8')).colori;
  assert.deepEqual(day[indiceCarta(0)], [133, 181, 0]);
  assert.deepEqual(day[indiceCarta(1)], [58, 181, 0]);
  const luce = (/** @type {number[]} */ c) => c[0] + c[1] + c[2];
  for (let k = 3; k <= 15; k++) assert.ok(luce(day[indiceCarta(k)]) <= luce(day[indiceCarta(k - 1)]), `classe ${k} più chiara della ${k - 1}`);
});

test('coste: la terra che tocca l\'acqua diventa costa, quella interna resta terra', () => {
  const w = 5, h = 3;
  const g = Int8Array.from([
    0, 0, 0, 5, 5,
    0, 0, 0, 5, 5,
    0, 0, 0, 5, 5,
  ]);
  const c = costeggia(g, w, h);
  assert.deepEqual([...c], [0, 0, 1, 5, 5, 0, 0, 1, 5, 5, 0, 0, 1, 5, 5]);
});

test('finestra: il fondale si campiona al centro di ogni pixel, fuori dai dati è nero (-1)', () => {
  const v = { cx: 0, cy: 0, mpp: 100 };
  const g = classiFinestra(v, (x) => (x < 0 ? -10 : x > 5000 ? null : 200));
  const w = FINESTRA.x2 - FINESTRA.x1 + 1;
  assert.equal(g.length, w * (FINESTRA.y2 - FINESTRA.y1 + 1));
  const riga = [...g.subarray(0, w)];
  assert.equal(riga[0], 0);
  assert.equal(riga[CENTRO.x - FINESTRA.x1 - 1], 1); // costa: l'ultimo pixel di terra
  assert.equal(riga[CENTRO.x - FINESTRA.x1], 9); // 200 m
  assert.equal(riga[w - 1], -1);
});

test('mondo e schermo: il battello al centro, il nord in alto, andata e ritorno', () => {
  const v = { cx: 1000, cy: 2000, mpp: 50 };
  assert.deepEqual(inSchermo(v, 1000, 2000), { px: CENTRO.x, py: CENTRO.y });
  assert.deepEqual(inSchermo(v, 1000, 2500), { px: CENTRO.x, py: CENTRO.y - 10 });
  const m = inMondo(v, 120, 33);
  const s = inSchermo(v, m.x, m.y);
  assert.ok(Math.abs(s.px - 120) < 1e-9 && Math.abs(s.py - 33) < 1e-9);
});

test('contatti di solo rilevamento: la X a metà strada verso il bordo, come nel 1989', () => {
  assert.deepEqual(puntoAMetaBordo(0), { px: CENTRO.x, py: Math.round(CENTRO.y - (CENTRO.y - FINESTRA.y1) / 2) });
  assert.deepEqual(puntoAMetaBordo(90), { px: Math.round(CENTRO.x + (FINESTRA.x2 - CENTRO.x) / 2), py: CENTRO.y });
  const p = puntoAMetaBordo(225);
  assert.ok(p.px < CENTRO.x && p.py > CENTRO.y);
});

test('zoom: dieci livelli crescenti', () => {
  assert.equal(SCALE_MAPPA_M.length, 10);
  for (let i = 1; i < 10; i++) assert.ok(SCALE_MAPPA_M[i] > SCALE_MAPPA_M[i - 1]);
});

test('HUD: 0,6 pixel per grado sul nastro, 32 piedi per riga sulla scala (misure di 013 e 074)', () => {
  assert.equal(xBussola(320, 320), 92);
  assert.equal(xBussola(315, 320), 89); // la tacca di NW in 013
  assert.equal(xBussola(0, 320), 92 + 24);
  assert.equal(yQuota(0), 43);
  assert.equal(yQuota(6.1), 43); // 20 ft
  assert.equal(yQuota(304.2), 74); // ~998 ft, il fondo di 074
  assert.equal(yQuota(5000), 107); // in fondo alla scala
});
