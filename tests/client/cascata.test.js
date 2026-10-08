// Prove della cascata a banda larga (web/assets/js/client/resa/cascata.js): geometria delle
// colonne in rilevamento relativo e vero, colori, settori ciechi, picchi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importa } from './ambiente_client.mjs';

const {
  COLONNE, COLONNA_CENTRO, coloreCascata, settoriDiColonna, rigaCascata, colonnaDiRilevamento,
  rilevamentoDiColonna, picchi,
} = await importa('resa/cascata.js');

test('colori: nero sotto il rumore, blu notte per il rumore, rampa del mare, ciano e bianco per i picchi', () => {
  assert.equal(coloreCascata(0), 0);
  assert.equal(coloreCascata(40), 99); // fondo di rumore del protocollo (q ≈ 40)
  assert.ok(coloreCascata(60) >= 96 && coloreCascata(60) <= 104); // soglia: ancora scuro
  assert.ok(coloreCascata(100) > 105 && coloreCascata(100) <= 142);
  assert.equal(coloreCascata(180), 11);
  assert.equal(coloreCascata(255), 15);
  // nei settori ciechi solo grigi spenti
  for (const v of [0, 40, 255]) assert.ok(coloreCascata(v, true) >= 145 && coloreCascata(v, true) <= 150);
  // monotona
  for (let v = 1; v < 256; v++) {
    const a = coloreCascata(v - 1), b = coloreCascata(v);
    const rango = (/** @type {number} */ c) => (c === 0 ? 0 : c === 11 ? 200 : c === 15 ? 300 : c);
    assert.ok(rango(b) >= rango(a), `non monotona a ${v}`);
  }
});

test('relativo: la colonna 84 (x 92) è la prua, due gradi per colonna, la poppa fuori dal quadro', () => {
  // rotta 090: la prua è il rilevamento vero 90°, settore 45
  assert.deepEqual(settoriDiColonna(COLONNA_CENTRO, 'relativo', 90), [45, 45]);
  assert.deepEqual(settoriDiColonna(COLONNA_CENTRO + 1, 'relativo', 90), [46, 46]);
  // una rotta dispari copre due settori per colonna
  assert.deepEqual(settoriDiColonna(COLONNA_CENTRO, 'relativo', 91), [45, 46]);
  assert.equal(colonnaDiRilevamento(90 + 180, 'relativo', 90), null);
  assert.equal(colonnaDiRilevamento(90 - 168, 'relativo', 90), 0);
});

test('vero: il nord al centro, 360° in 168 colonne', () => {
  assert.equal(colonnaDiRilevamento(0, 'vero', 123), COLONNA_CENTRO);
  assert.equal(colonnaDiRilevamento(90, 'vero', 0), COLONNA_CENTRO + 42);
  assert.equal(colonnaDiRilevamento(270, 'vero', 0), COLONNA_CENTRO - 42);
  const [s0, s1] = settoriDiColonna(COLONNA_CENTRO, 'vero', 0);
  assert.equal(s0, 0);
  assert.ok(s1 >= 1); // 2,14° per colonna: copre più di un settore
});

test('rilevamento di colonna e colonna di rilevamento si rispondono', () => {
  for (const rif of /** @type {const} */ (['relativo', 'vero'])) {
    for (const rotta of [0, 45, 271]) {
      for (const c of [3, 40, 84, 120, 160]) {
        const b = rilevamentoDiColonna(c, rif, rotta);
        const c2 = colonnaDiRilevamento(b, rif, rotta);
        assert.ok(c2 !== null && Math.floor(c2) === c, `${rif} ${rotta} ${c} → ${b} → ${c2}`);
      }
    }
  }
});

test('riga: un picco vero finisce nella colonna giusta in entrambi i riferimenti', () => {
  const settori = new Uint8Array(180).fill(40);
  settori[30] = 250; // 60°-62° veri
  const rel = rigaCascata(settori, null, 'relativo', 30);
  // relativo: 60° veri con rotta 030 = 30° a dritta → colonna 84 + 15
  assert.equal(rel[COLONNA_CENTRO + 15], 15);
  assert.equal(rel.filter((c) => c === 15).length, 1);
  const vero = rigaCascata(settori, null, 'vero', 30);
  const c = Math.floor(/** @type {number} */ (colonnaDiRilevamento(61, 'vero', 30)));
  assert.equal(vero[c], 15);
  assert.equal(rel.length, COLONNE);
});

test('riga: i settori ciechi escono grigi', () => {
  const settori = new Uint8Array(180).fill(180);
  const ciechi = new Uint8Array(180);
  ciechi[0] = 1; // 0°-2° veri
  const riga = rigaCascata(settori, ciechi, 'relativo', 0);
  assert.ok(riga[COLONNA_CENTRO] >= 145 && riga[COLONNA_CENTRO] <= 150);
  assert.equal(riga[COLONNA_CENTRO + 1], 11);
});

test('picchi: massimi locali sopra la soglia, anche a cavallo dello zero, fuori dai ciechi', () => {
  const s = new Uint8Array(180).fill(40);
  s[179] = 120; s[0] = 110; // un picco a 358°-360° che si allarga oltre lo zero
  s[50] = 90; s[51] = 95; s[52] = 80; // picco a 102°
  s[90] = 200; // cieco
  const ciechi = new Uint8Array(180);
  ciechi[90] = 1;
  const p = picchi(s, ciechi);
  assert.deepEqual(p.map((x) => x.settore), [179, 51]);
  assert.equal(p[0].rilevamento, 359);
  // separazione: due massimi vicini contano per uno
  const v = new Uint8Array(180).fill(40);
  v[10] = 100; v[11] = 50; v[12] = 99;
  assert.equal(picchi(v, null).length, 1);
});
