// Prove dell'analizzatore (web/assets/js/client/resa/spettro.js): righe del LOFAR e del DEMON ricampionate
// sullo schermo, righe tonali, media in potenza, barre del SONAR COMPUTER, stima delle pale. Pure, senza
// asset originali.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importa } from './ambiente_client.mjs';

const {
  ricampiona, rigaSpettro, coloreLofar, righeTonali, mediaRecente, barreAnalizzatore, disegnaBarre, BARRE,
  colonnaDiFrequenza, frequenzaDiColonna, tacche, formatoHz, stimaPale,
} = await importa('resa/spettro.js');
const { Tela } = await importa('resa/tela.js');
const { SPETTRO } = await import('../../shared/protocol.js');

/** Una riga di fondo (q 40) con righe tonali: {indice: q}. @param {number} n @param {Record<number, number>} righe */
function riga(n, righe) {
  const b = new Uint8Array(n).fill(40);
  for (const [k, v] of Object.entries(righe)) b[Number(k)] = v;
  return b;
}

test('ricampionamento: una colonna su più celle prende il massimo, una cella larga si allarga', () => {
  // 1024 celle da 1 Hz su 168 colonne: la riga a 60 Hz non sparisce
  const b = riga(1024, { 60: 120 });
  const v = ricampiona(b, 0, 1, 0, 1024, 168);
  const c = Math.floor(colonnaDiFrequenza(60.5, 0, 1024, 168));
  assert.equal(v[c], 120);
  // al più due colonne (una cella a cavallo del confine), tutte vicine alla riga
  const accese = [...v].map((x, i) => (x === 120 ? i : -1)).filter((i) => i >= 0);
  assert.ok(accese.length <= 2 && accese.every((i) => Math.abs(i - c) <= 1), String(accese));
  // zoom 40-80 Hz: 40 celle su 168 colonne, la riga occupa 4-5 colonne
  const z = ricampiona(b, 0, 1, 40, 80, 168);
  const piene = [...z].filter((x) => x === 120).length;
  assert.ok(piene >= 4 && piene <= 5, `${piene}`);
  // fuori dalla finestra: zero
  assert.equal(ricampiona(b, 0, 1, 2000, 2100, 10)[0], 0);
});

test('colonne e frequenze: andata e ritorno', () => {
  for (const f of [0.5, 60, 333, 1023]) {
    const c = colonnaDiFrequenza(f, 0, 1024, 168);
    assert.ok(Math.abs(frequenzaDiColonna(c, 0, 1024, 168) - f) <= 1024 / 168);
  }
  assert.equal(colonnaDiFrequenza(1025, 0, 1024, 168), null);
});

test('colori del LOFAR: fondo scuro, righe chiare, monotoni', () => {
  assert.equal(coloreLofar(0), 0);
  assert.ok(coloreLofar(40) >= 96 && coloreLofar(40) <= 104);
  assert.equal(coloreLofar(95), 11);
  assert.equal(coloreLofar(200), 15);
  const rango = (/** @type {number} */ c) => (c === 0 ? 0 : c === 11 ? 200 : c === 15 ? 300 : c);
  for (let q = 1; q < 256; q++) assert.ok(rango(coloreLofar(q)) >= rango(coloreLofar(q - 1)));
  const r = rigaSpettro(riga(1024, { 60: 200 }), 0, 1, 0, 1024, 168);
  assert.equal(r.length, 168);
  assert.ok(r.includes(15));
});

test('righe tonali: massimi sopra soglia, raffinati, dal più forte, separati', () => {
  const b = riga(1024, { 59: 70, 60: 100, 61: 80, 120: 90, 121: 89, 400: 61 });
  const r = righeTonali(b, 0, 1);
  assert.deepEqual(r.map((x) => x.banda), [60, 120]);
  // la parabola sposta la stima verso il vicino più forte (61 > 59)
  assert.ok(r[0].hz > 60.5 && r[0].hz < 61);
  // la sfera ha celle da 2 Hz
  assert.equal(righeTonali(riga(1024, { 30: 100 }), 0, 2)[0].banda, 30);
});

test('media in potenza: si ferma a un altro fascio; con righe uguali dà la stessa riga', () => {
  const s = (/** @type {number} */ ril, /** @type {Uint8Array} */ r) => ({ ora: 0, sensore: 'towed', rilevamento: ril, contatto: null,
    da_hz: 0, passo_hz: 1, righe: r, demon: r, demon_da_hz: 0, demon_passo_hz: 0.1, asse: null, sorda: false });
  const a = riga(16, { 3: 100 });
  const m = mediaRecente([s(10, a), s(11, a), s(90, riga(16, { 3: 0 }))], 8);
  assert.equal(m?.[3], 100);
  assert.equal(m?.[0], 40);
  // due righe 100 e 40 (60 dB di differenza in mezzi dB = 30 dB): la media sta 3 dB sotto la più forte
  const n = mediaRecente([s(0, riga(4, { 0: 100 })), s(0, riga(4, { 0: 40 }))], 8);
  assert.equal(n?.[0], 94);
  assert.equal(mediaRecente([], 8), null);
});

test('barre del SONAR COMPUTER: 16 bande logaritmiche da 16 Hz, il fondo basso, la riga più alta col cappello', () => {
  const f = SPETTRO.towed;
  const vuota = barreAnalizzatore(riga(f.RIGHE, {}), f.DA_HZ, f.PASSO_HZ);
  assert.equal(vuota.altezze.length, 16);
  assert.ok(vuota.altezze.every((h) => h <= 2));
  const piena = barreAnalizzatore(riga(f.RIGHE, { 60: 150, 500: 90 }), f.DA_HZ, f.PASSO_HZ);
  const k60 = Math.floor((16 * Math.log(60 / 16)) / Math.log(1024 / 16));
  assert.equal(piena.picco, k60);
  assert.equal(piena.altezze[k60], 18);
  // disegno: magenta a righe alterne, cappello rosso, vuoto grigio
  const t = new Tela();
  disegnaBarre(t, piena.altezze, piena.picco);
  const x = BARRE.x0 + BARRE.passo * k60;
  assert.equal(t.leggi(x, BARRE.y1), 12);
  assert.equal(t.leggi(x, BARRE.y1 + 1), 4);
  assert.equal(t.leggi(x, BARRE.y2), BARRE.y2 % 2 ? 13 : 5);
  assert.equal(t.leggi(BARRE.x0 + BARRE.passo * 15, BARRE.y1), 8);
});

test('assi e etichette: tacche tonde, frequenze corte', () => {
  assert.deepEqual(tacche(0, 1024, 4).valori, [0, 500, 1000]);
  assert.deepEqual(tacche(40, 80, 4).valori, [40, 50, 60, 70, 80]);
  assert.equal(formatoHz(0), '0');
  assert.equal(formatoHz(2000), '2K');
  assert.equal(formatoHz(1500), '1.5K');
  assert.equal(formatoHz(7.5), '7.5');
  assert.equal(formatoHz(60), '60');
});

test('DEMON: dalla frequenza di pala e dalle armoniche dell\'asse il numero di pale', () => {
  // asse 2 Hz, quattro pale: pala 8 Hz, armoniche dell'asse a 2, 4, 6 e la seconda di pala a 16
  const righe = [{ hz: 8, q: 120 }, { hz: 2, q: 100 }, { hz: 16, q: 95 }, { hz: 4, q: 80 }, { hz: 6, q: 78 }];
  assert.deepEqual(stimaPale(righe, 0.1), { asse_hz: 2, pale: 4, pala_hz: 8 });
  assert.equal(stimaPale([], 0.1), null);
});
