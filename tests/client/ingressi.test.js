// Prove della navigazione da tastiera fra le zone cliccabili (web/assets/js/client/ingressi.js):
// Tab per gruppi, frecce dentro il gruppo e fra tutti, lettere e cifre che spostano il cursore.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { importa, CI_SONO_ORIGINALI, ORIGINALI, MOTIVO_SALTO } from './ambiente_client.mjs';

const { naviga, perTasto, centro, TASTI_STAZIONE } = await importa('ingressi.js');

/** @param {number} tasto @param {number} gruppo */
const h = (tasto, gruppo) => ({ cursore: 0, x1: 0, y1: 0, x2: 10, y2: 10, colore: 15, tasto, gruppo });
// come uno script: uscita (gruppo 0), poi gruppi 1, 2, 3
const HS = [h(88, 0), h(80, 1), h(70, 1), h(83, 1), h(82, 2), h(129, 2), h(130, 2), h(69, 3)];

test('senza fuoco si parte dal primo comando che non sia l\'uscita', () => {
  assert.equal(naviga(HS, null, 'tab'), 1);
  assert.equal(naviga([], null, 'tab'), null);
});

test('Tab e Maiusc-Tab: primo comando del gruppo successivo o precedente, in giro', () => {
  assert.equal(naviga(HS, 2, 'tab'), 4);
  assert.equal(naviga(HS, 4, 'tab'), 7);
  assert.equal(naviga(HS, 7, 'tab'), 0);
  assert.equal(naviga(HS, 4, 'tab-indietro'), 1);
  assert.equal(naviga(HS, 0, 'tab-indietro'), 7);
});

test('frecce destra e sinistra: dentro il gruppo, in giro', () => {
  assert.equal(naviga(HS, 4, 'destra'), 5);
  assert.equal(naviga(HS, 6, 'destra'), 4);
  assert.equal(naviga(HS, 4, 'sinistra'), 6);
  assert.equal(naviga(HS, 7, 'destra'), 7); // gruppo di un solo comando
});

test('frecce su e giù: il comando precedente o successivo, qualunque sia il gruppo', () => {
  assert.equal(naviga(HS, 3, 'giu'), 4);
  assert.equal(naviga(HS, 7, 'giu'), 0);
  assert.equal(naviga(HS, 0, 'su'), 7);
});

test('lettere e cifre: la lettera porta al comando, la cifra al primo del gruppo, 0 e X all\'uscita', () => {
  assert.equal(perTasto(HS, 'r'), 4);
  assert.equal(perTasto(HS, 'E'), 7);
  assert.equal(perTasto(HS, '2'), 4);
  assert.equal(perTasto(HS, '0'), 0);
  assert.equal(perTasto(HS, 'x'), 0);
  assert.equal(perTasto(HS, 'q'), null);
  assert.equal(perTasto(HS, 'Enter'), null);
});

test('centro della zona, dove va il cursore', () => {
  assert.deepEqual(centro({ ...h(1, 1), x1: 10, x2: 20, y1: 5, y2: 8 }), { x: 15, y: 7 });
});

test('tasti funzione: F2-F8 le stazioni, F9 la CONN (ORIGINALE.md §4)', () => {
  assert.deepEqual(TASTI_STAZIONE, {
    F2: 'radio', F3: 'status', F4: 'governo', F5: 'periscopio', F6: 'navigazione', F7: 'armi', F8: 'sonar', F9: 'conn',
  });
});

test('Ship\'s Control vero: E porta al REV, quattro volte a destra si arriva a STD', { skip: !CI_SONO_ORIGINALI && MOTIVO_SALTO }, () => {
  const pannelli = JSON.parse(readFileSync(path.join(ORIGINALI, 'cls', 'pannelli.json'), 'utf8'));
  const hs = pannelli.lavori.find((/** @type {any} */ l) => l.id === 'STEER_688').risultato.hotspot;
  let i = perTasto(hs, 'e');
  assert.equal(hs[i].tasto, 69);
  for (let k = 0; k < 4; k++) i = naviga(hs, i, 'destra');
  assert.equal(hs[i].tasto, 143); // STD
  // la cifra 5 porta alle funzioni automatiche, il primo è 150 FT
  assert.equal(hs[/** @type {number} */ (perTasto(hs, '5'))].tasto, 200);
  // il timone: R è tutto a sinistra
  assert.equal(hs[/** @type {number} */ (perTasto(hs, 'r'))].x1, 53);
});
