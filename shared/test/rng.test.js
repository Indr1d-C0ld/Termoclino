// @ts-check
/**
 * Prove di shared/rng.js: uscite note (verificate contro un'implementazione C
 * indipendente di splitmix32 + sfc32), determinismo, distribuzioni, stato
 * serializzabile, sotto-flussi indipendenti.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Generatore, impronta32, normalizzaSeme, splitmix32 } from '../rng.js';

/**
 * Coefficiente di correlazione di Pearson.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function correlazione(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
}

/**
 * @param {Generatore} g
 * @param {number} n
 * @returns {number[]}
 */
function uniformi(g, n) {
  return Array.from({ length: n }, () => g.uniforme());
}

test('uscite note per seme fisso (riferimento C)', () => {
  const sm = splitmix32(12345);
  assert.deepEqual([sm(), sm(), sm(), sm()], [3283241497, 613117429, 2940958500, 516375437]);
  const g = new Generatore(12345);
  assert.deepEqual(
    [g.prossimoUint32(), g.prossimoUint32(), g.prossimoUint32(), g.prossimoUint32(), g.prossimoUint32()],
    [2142345551, 3083893245, 1997626643, 3123200824, 1123390551],
  );
  const h = new Generatore(12345);
  assert.equal(h.uniforme(), 2142345551 / 4294967296);
});

test('seme testuale e impronta32 (riferimento C)', () => {
  assert.equal(impronta32('torpex-89'), 1463993584);
  assert.equal(impronta32('Пе'), 1806701521, 'unita\' UTF-16, non byte');
  assert.equal(impronta32(''), 0);
  const g = new Generatore('torpex-89');
  assert.equal(g.seme32, 1463993584);
  assert.deepEqual(
    Array.from({ length: 5 }, () => g.prossimoUint32()),
    [3900359089, 3763000995, 3950639437, 2601251032, 53939063],
  );
});

test('normalizzazione del seme', () => {
  assert.equal(normalizzaSeme(0), 0);
  assert.equal(normalizzaSeme(4294967295), 4294967295);
  assert.equal(normalizzaSeme(1.5), impronta32('1.5'));
  assert.equal(normalizzaSeme(-1), impronta32('-1'));
  assert.equal(normalizzaSeme(2 ** 32), impronta32('4294967296'));
  assert.throws(() => normalizzaSeme(NaN), RangeError);
  assert.throws(() => normalizzaSeme(Infinity), RangeError);
  // @ts-expect-error tipo sbagliato apposta
  assert.throws(() => normalizzaSeme(null), TypeError);
});

test('determinismo: stesso seme, stessa sequenza', () => {
  const a = new Generatore('partita-42');
  const b = new Generatore('partita-42');
  for (let i = 0; i < 2000; i++) {
    const tipo = i % 4;
    if (tipo === 0) assert.equal(a.prossimoUint32(), b.prossimoUint32());
    else if (tipo === 1) assert.equal(a.uniforme(), b.uniforme());
    else if (tipo === 2) assert.equal(a.intero(-5, 17), b.intero(-5, 17));
    else assert.equal(a.gaussiana(3, 2), b.gaussiana(3, 2));
  }
  const c = new Generatore('partita-43');
  const d = new Generatore('partita-42');
  const diverse = Array.from({ length: 20 }, () => c.prossimoUint32() !== d.prossimoUint32()).filter(Boolean);
  assert.ok(diverse.length >= 19, 'semi diversi danno sequenze diverse');
});

test('uniforme: intervallo e media', () => {
  const g = new Generatore(7);
  let somma = 0;
  const n = 100000;
  for (let i = 0; i < n; i++) {
    const u = g.uniforme();
    assert.ok(u >= 0 && u < 1);
    somma += u;
  }
  assert.ok(Math.abs(somma / n - 0.5) < 0.005, `media ${somma / n}`);
  const x = g.intervallo(-3, 5);
  assert.ok(x >= -3 && x < 5);
});

test('intero: estremi compresi, uniforme, errori', () => {
  const g = new Generatore(1989);
  assert.deepEqual(Array.from({ length: 8 }, () => g.intero(1, 6)), [2, 1, 2, 2, 2, 3, 3, 6]);
  const conteggi = new Array(6).fill(0);
  const n = 60000;
  for (let i = 0; i < n; i++) conteggi[g.intero(1, 6) - 1]++;
  // Chi quadro con 5 gradi di liberta': 20,5 ha probabilita' 0,001.
  const atteso = n / 6;
  const chi2 = conteggi.reduce((s, c) => s + (c - atteso) ** 2 / atteso, 0);
  assert.ok(chi2 < 20.5, `chi quadro ${chi2}`);
  assert.equal(g.intero(5, 5), 5);
  const grande = g.intero(0, 4294967295);
  assert.ok(Number.isInteger(grande) && grande >= 0 && grande <= 4294967295);
  assert.throws(() => g.intero(3, 2), RangeError);
  assert.throws(() => g.intero(0.5, 2), RangeError);
  assert.throws(() => g.intero(0, 2 ** 32), RangeError);
});

test('gaussiana: media e varianza', () => {
  const g = new Generatore('rumore');
  const n = 50000;
  let s = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const z = g.gaussiana();
    s += z;
    s2 += z * z;
  }
  const media = s / n;
  const varianza = s2 / n - media * media;
  assert.ok(Math.abs(media) < 0.02, `media ${media}`);
  assert.ok(Math.abs(varianza - 1) < 0.03, `varianza ${varianza}`);
  const h = new Generatore(3);
  const v = Array.from({ length: 1000 }, () => h.gaussiana(10, 0.5));
  assert.ok(v.every(Number.isFinite));
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  assert.ok(Math.abs(m - 10) < 0.06, `media ${m}`);
});

test('stato: salva e riprendi a meta\' flusso, gaussiana in serbo compresa', () => {
  const g = new Generatore('salvataggio');
  for (let i = 0; i < 37; i++) g.prossimoUint32();
  g.gaussiana(); // lascia una gaussiana in serbo
  const stato = JSON.parse(JSON.stringify(g.stato()));
  assert.equal(stato.versione, 1);
  assert.equal(typeof stato.riserva, 'number');
  const h = Generatore.daStato(stato);
  for (let i = 0; i < 300; i++) {
    assert.equal(h.gaussiana(), g.gaussiana());
    assert.equal(h.prossimoUint32(), g.prossimoUint32());
    assert.equal(h.intero(0, 99), g.intero(0, 99));
  }
  // La derivazione sopravvive al salvataggio.
  assert.equal(h.deriva('x').prossimoUint32(), g.deriva('x').prossimoUint32());
  // Una copia e' indipendente dall'originale.
  const k = g.clona();
  const primo = k.prossimoUint32();
  assert.equal(g.prossimoUint32(), primo);
  k.prossimoUint32();
  assert.notDeepEqual(k.stato(), g.stato());
});

test('stato non valido', () => {
  const buono = new Generatore(1).stato();
  /** @type {any[]} */
  const cattivi = [
    null,
    {},
    { ...buono, versione: 2 },
    { ...buono, s: [1, 2, 3] },
    { ...buono, s: [1, 2, 3, -1] },
    { ...buono, s: [1, 2, 3, 2 ** 32] },
    { ...buono, seme32: 1.5 },
    { ...buono, riserva: 'x' },
  ];
  for (const s of cattivi) assert.throws(() => Generatore.daStato(s), TypeError);
});

test('sotto-flussi: non dipendono da quanto ha estratto il genitore', () => {
  const a = new Generatore(12345);
  const b = new Generatore(12345);
  for (let i = 0; i < 1000; i++) b.uniforme();
  b.gaussiana();
  const da = a.deriva('battello:alfa');
  const db = b.deriva('battello:alfa');
  assert.equal(da.seme32, 2101411062, 'valore di riferimento C');
  assert.deepEqual([da.prossimoUint32(), da.prossimoUint32(), da.prossimoUint32()], [2136361331, 3727930562, 146139566]);
  assert.deepEqual(uniformi(db, 3).map((u) => u * 4294967296), [2136361331, 3727930562, 146139566]);
  // Etichette numeriche e testuali equivalenti, derivazioni annidate deterministiche.
  assert.equal(a.deriva(7).seme32, a.deriva('7').seme32);
  assert.equal(a.deriva('x').deriva('y').seme32, b.deriva('x').deriva('y').seme32);
  // Genitori diversi, stessa etichetta: flussi diversi.
  assert.notEqual(new Generatore(1).deriva('s').seme32, new Generatore(2).deriva('s').seme32);
});

test('sotto-flussi: indipendenza statistica', () => {
  const radice = new Generatore('torpex-89');
  const etichette = ['battello:688', 'battello:alfa', 'sensore:sfera', 'sensore:rimorchiata', 'ia', 1, 2];
  const flussi = etichette.map((e) => uniformi(radice.deriva(e), 20000));
  flussi.push(uniformi(new Generatore('torpex-89'), 20000));
  // Tutti i semi derivati sono diversi.
  const semi = new Set(etichette.map((e) => radice.deriva(e).seme32));
  assert.equal(semi.size, etichette.length);
  // Correlazione a coppie e a ritardo 1 entro 4 deviazioni standard (1/√n ≈ 0,007).
  for (let i = 0; i < flussi.length; i++) {
    for (let j = i + 1; j < flussi.length; j++) {
      const r = correlazione(flussi[i], flussi[j]);
      assert.ok(Math.abs(r) < 0.03, `flussi ${i} e ${j}: r = ${r}`);
    }
    const r1 = correlazione(flussi[i].slice(0, -1), flussi[i].slice(1));
    assert.ok(Math.abs(r1) < 0.03, `flusso ${i}, ritardo 1: r = ${r1}`);
  }
});

test('scegli e mescola', () => {
  const g = new Generatore('mazzo');
  const mazzo = Array.from({ length: 52 }, (_, i) => i);
  const mescolato = g.mescola([...mazzo]);
  assert.deepEqual([...mescolato].sort((x, y) => x - y), mazzo, 'e\' una permutazione');
  assert.notDeepEqual(mescolato, mazzo);
  assert.deepEqual(new Generatore('mazzo').mescola([...mazzo]), mescolato, 'deterministica');
  assert.ok(['a', 'b', 'c'].includes(g.scegli(['a', 'b', 'c'])));
  assert.throws(() => g.scegli([]), RangeError);
  assert.equal(g.probabilita(0), false);
  assert.equal(g.probabilita(1), true);
});
