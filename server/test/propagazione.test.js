// @ts-check
/**
 * Le tabelle di propagazione di F2 (filone G): il file dello scenario, la
 * lettura in linea (server/src/sim/world/propagazione.js), il collegamento ai
 * sensori (server/src/sim/sensors/perdita.js) e la riserva analitica di F1.
 *
 * Sanita' fisica (la TL cresce con la distanza, lo strato conta di piu' alle alte
 * frequenze, la piattaforma perde piu' del canale, la terra fa ombra), accordo con
 * l'analitico dove devono andare d'accordo (vicino alla sorgente, in acqua
 * profonda), reciprocita', determinismo, costo. La convalida del tracciatore sui
 * casi canonici sta in tools/acustica/test_convalida.py (Python).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { caricaAmbiente } from '../../shared/ambiente.js';
import {
  MAGIA_TL, TabellePropagazione, caricaPropagazione, propagazioneAnalitica, tabelleDaAmbiente,
} from '../src/sim/world/propagazione.js';
import { ambienteProvvisorio, creaAmbiente } from '../src/sim/world/ambiente.js';
import { perditaTrasmissione } from '../src/sim/sensors/acustica.js';
import { perdita } from '../src/sim/sensors/perdita.js';
import { eccessoAllaDistanza, portata } from '../src/sim/sensors/taratura.js';
import { acustica, piattaforme } from './aiuto.js';

const DIR = new URL('../../shared/data/scenari/', import.meta.url);
const ambiente = await caricaAmbiente('torpex_palestra');
const blocco = /** @type {import('../src/sim/world/propagazione.js').BloccoPropagazione} */ (
  /** @type {any} */ (ambiente.valori).propagazione);
const vere = /** @type {TabellePropagazione} */ (await caricaPropagazione('torpex_palestra'));
const FONDALI = blocco.regioni.map((r) => r.fondale);

/** Tabelle su un fondale piatto di h metri (la classe di fondale, o fra due). @param {number} h */
async function piatte(h) {
  return /** @type {TabellePropagazione} */ (await caricaPropagazione('torpex_palestra', { fondale: () => h }));
}

/** @param {number} x @param {number} y @param {number} z */
const P = (x, y, z) => ({ x, y, z });

test('il file delle tabelle e\' quello dello scenario, sotto i 5 MB', async () => {
  assert.ok(vere instanceof TabellePropagazione);
  assert.equal(vere.fonte, 'tabelle');
  const byte = await readFile(new URL(blocco.tabella.file, DIR));
  assert.equal(byte.length, blocco.tabella.byte);
  assert.ok(byte.length < 5 * 1024 * 1024, `${byte.length} byte`);
  assert.equal(createHash('sha256').update(byte).digest('hex'), blocco.tabella.sha256);
  assert.equal(byte.subarray(0, 8).toString('latin1'), MAGIA_TL);
  // bande: le due ottave dei sensori a banda larga coincidono con acustica.json
  for (const id of /** @type {const} */ (['sfera', 'towed'])) {
    const b = blocco.bande.find((x) => x.id === id);
    assert.ok(b, id);
    assert.equal(b.centro, acustica.bande[id].centro);
    assert.equal(b.da, acustica.bande[id].da);
    assert.equal(b.a, acustica.bande[id].a);
  }
  for (const id of ['f50', 'f100', 'f300', 'f1000', 'f3500', 'f25000']) assert.ok(blocco.bande.some((b) => b.id === id), id);
  // un file diverso da quello dello scenario non si carica
  const rotto = new Uint8Array(byte);
  rotto[100] ^= 1;
  await assert.rejects(() => tabelleDaAmbiente(ambiente, { leggi: async () => rotto }), /SHA-256/);
  assert.throws(() => new TabellePropagazione(blocco, rotto.subarray(0, 1000), { fondale: () => 100, assorbimento: () => 0 }));
});

test('la TL cresce con la distanza (in ogni classe, banda e coppia di quote)', async () => {
  for (const h of FONDALI) {
    const p = await piatte(h);
    for (const banda of blocco.bande.map((b) => b.id)) {
      for (const [zs, zr] of [[5, 13], [13, 13], [13, 150], [150, 150], [300, 600]]) {
        const s = P(0, 0, Math.min(zs, h - 1));
        const tl = (/** @type {number} */ r) => p.perdita(s, P(r, 0, Math.min(zr, h - 1)), banda);
        // Raddoppiando la distanza la TL puo' calare di qualche dB vicino alla superficie: i lobi dello specchio di
        // Lloyd (una nave a 5 m manda il primo rimbalzo sul fondo a 2 km oltre l'angolo critico e quello a 4 km
        // sotto). Nelle ottave mai piu' di 4 dB; nelle bande strette i lobi non si mediano (a 100 Hz una sorgente e un
        // ricevitore a 13 m in 600 m d'acqua: il rimbalzo a 2 km cade in uno zero, quello a 4 km in un massimo,
        // 11 dB di differenza) e si controlla solo l'andamento: su quattro raddoppi la TL cresce almeno quanto la
        // divergenza cilindrica (12 dB) meno qualche dB.
        const ottava = banda === 'sfera' || banda === 'towed';
        for (let r = 1000; r <= 128_000; r *= 2) {
          const a = tl(r);
          const b = tl(2 * r);
          if (ottava) assert.ok(b > a - 4, `${h} m, ${banda}, ${zs}->${zr}: ${r} m ${a.toFixed(1)} dB, ${2 * r} m ${b.toFixed(1)} dB`);
          if (r <= 16_000) {
            const c = tl(16 * r);
            assert.ok(c > a + 6, `${h} m, ${banda}, ${zs}->${zr}: ${r} m ${a.toFixed(1)} dB, ${16 * r} m ${c.toFixed(1)} dB`);
          }
        }
        // mai molto meglio della divergenza cilindrica dal fondale (nessuna energia dal nulla)
        for (const r of [5000, 50_000]) {
          const cil = 20 * Math.log10(h) + 10 * Math.log10(r / h);
          assert.ok(tl(r) > cil - 6, `${h} m, ${banda}, ${zs}->${zr}, ${r} m: ${tl(r).toFixed(1)} contro cilindrica ${cil.toFixed(1)}`);
        }
      }
    }
  }
});

test('vicino alla sorgente, in acqua profonda: divergenza sferica, come l\'analitico di F1', async () => {
  const p = await piatte(900);
  const amb = ambienteProvvisorio({ fondale: 900, strato: null, temperatura: 8.7, salinita: 35.24, ph: 8.09 });
  for (const r of [30, 100, 200, 400]) {
    for (const [banda, f] of /** @type {const} */ ([['sfera', 2000], ['towed', 300], ['f25000', 25000]])) {
      const s = P(0, 0, 350);
      const q = P(r, 0, 350);
      const tl = p.perdita(s, q, banda);
      const sferica = 20 * Math.log10(r) + (vere.alfa[/** @type {number} */ (vere.indiceBanda.get(banda))] * r);
      assert.ok(Math.abs(tl - sferica) < 1, `${banda} a ${r} m: ${tl.toFixed(2)} contro ${sferica.toFixed(2)}`);
      assert.ok(Math.abs(tl - perditaTrasmissione(acustica, amb, f, s, q)) < 1.5, `${banda} a ${r} m: tabelle contro F1`);
    }
  }
  // sotto la prima distanza (25 m): divergenza sferica sulla distanza obliqua
  const vicino = p.perdita(P(0, 0, 300), P(5, 0, 340), 'sfera');
  assert.ok(Math.abs(vicino - 20 * Math.log10(Math.hypot(5, 40))) < 1.5, `${vicino}`);
});

test('lo strato: conta nell\'acqua stratificata e alle alte frequenze, non nell\'acqua rimescolata dalla marea', async () => {
  /** TL(13 -> profondo) − TL(13 -> 13) media fra 3 e 10 km. @param {TabellePropagazione} p @param {string} banda @param {number} zr */
  const scarto = (p, banda, zr) => {
    let acc = 0;
    let n = 0;
    for (let r = 3000; r <= 10_000; r += 500) {
      acc += p.perdita(P(0, 0, 13), P(r, 0, zr), banda) - p.perdita(P(0, 0, 13), P(r, 0, 13), banda);
      n++;
    }
    return acc / n;
  };
  const strat = await piatte(190);
  // sopra e sotto lo strato (21 m) nella piattaforma stratificata d'estate
  const s2k = scarto(strat, 'sfera', 150);
  const s25k = scarto(strat, 'f25000', 150);
  const s300 = scarto(strat, 'towed', 150);
  assert.ok(s2k > 2, `2 kHz: ${s2k.toFixed(1)} dB`);
  assert.ok(s25k > s2k + 3, `25 kHz ${s25k.toFixed(1)} contro 2 kHz ${s2k.toFixed(1)}: il canale sottile intrappola le alte`);
  assert.ok(s300 < s2k, `300 Hz ${s300.toFixed(1)} contro 2 kHz ${s2k.toFixed(1)}: le basse escono dal canale`);
  // nel canale profondo il rimbalzo sul fondo riempie l'ombra: lo strato quasi non nasconde
  assert.ok(Math.abs(scarto(await piatte(900), 'sfera', 150)) < 3);
  // la regola di gioco facoltativa: con perdita_strato la differenza cresce di quel tanto, solo attraverso lo strato
  const conRegola = new TabellePropagazione({ ...blocco, percorso: { ...blocco.percorso, perdita_strato: 8 } },
    strat.byte, { fondale: () => 190, assorbimento: (f) => ambiente.assorbimento(f), quotaStrato: 21 });
  assert.ok(Math.abs(scarto(conRegola, 'sfera', 150) - s2k - 8) < 0.01);
  assert.equal(conRegola.perdita(P(0, 0, 13), P(5000, 0, 15), 'sfera'), strat.perdita(P(0, 0, 13), P(5000, 0, 15), 'sfera'));
  assert.equal(blocco.percorso.perdita_strato, 0, 'nello scenario vale la sola fisica (vedi CALIBRAZIONE_F2)');
});

test('piattaforma contro canale, sulla batimetria vera: la piattaforma perde di piu\'', () => {
  // due tratti di 20 km da est a ovest al margine sud dell'area: piattaforma (171-211 m), Canale delle Faer Oer (880-950 m)
  const piatt = [P(-5000, -95_000, 150), P(15_000, -95_000, 150)];
  const canale = [P(-57_500, -95_000, 150), P(-37_500, -95_000, 150)];
  for (let k = 0; k <= 20; k++) {
    assert.ok(Math.abs(ambiente.fondale(-5000 + 1000 * k, -95_000) - 190) < 45);
    assert.ok(ambiente.fondale(-57_500 + 1000 * k, -95_000) > 850);
  }
  assert.equal(ambiente.regioneAcustica(5000, -95_000)?.gruppo, 'piattaforma');
  assert.equal(ambiente.regioneAcustica(-47_500, -95_000)?.gruppo, 'canale');
  for (const banda of ['sfera', 'f3500']) {
    const tp = vere.perdita(piatt[0], piatt[1], banda);
    const tc = vere.perdita(canale[0], canale[1], banda);
    assert.ok(tp > tc + 4, `${banda}: piattaforma ${tp.toFixed(1)} dB, canale ${tc.toFixed(1)} dB`);
  }
  // alle basse frequenze il fondo conta poco: la differenza si riduce
  const d50 = vere.perdita(piatt[0], piatt[1], 'f50') - vere.perdita(canale[0], canale[1], 'f50');
  const d2k = vere.perdita(piatt[0], piatt[1], 'sfera') - vere.perdita(canale[0], canale[1], 'sfera');
  assert.ok(d50 < d2k, `${d50.toFixed(1)} contro ${d2k.toFixed(1)}`);
});

test('la terra fa ombra: un percorso sopra Suðuroy perde molto di piu\' di uno in mare aperto', () => {
  const isola = vere.percorso(P(-10_000, -38_000, 13), P(14_000, -38_000, 13));
  const aperto = vere.percorso(P(-10_000, -60_000, 13), P(14_000, -60_000, 13));
  assert.ok(isola.terra && !aperto.terra);
  assert.ok(isola.perdita('sfera') > aperto.perdita('sfera') + 25);
});

test('reciprocita\', determinismo e lettura a frequenza', async () => {
  const a = P(31_000, -9000, 140);
  const b = P(-12_000, 27_000, 13);
  for (const banda of [...blocco.bande.map((x) => x.id), 437, 2000, 60]) {
    const ab = vere.perdita(a, b, banda);
    const ba = vere.perdita(b, a, banda);
    assert.ok(Math.abs(ab - ba) < 1e-6, `${banda}: ${ab} contro ${ba}`);
  }
  const altre = await caricaPropagazione('torpex_palestra');
  assert.ok(altre);
  for (let k = 0; k < 50; k++) {
    const s = P(-90_000 + 3700 * k, 80_000 - 3100 * k, 5 + 9 * k);
    const r = P(60_000 - 2900 * k, -70_000 + 2300 * k, 13 + 7 * k);
    assert.equal(altre.perdita(s, r, 'sfera'), vere.perdita(s, r, 'sfera'));
  }
  // a frequenza: sulle bande strette la stessa cosa; in mezzo fra le vicine; l'assorbimento esatto
  const via = vere.percorso(P(0, 0, 50), P(30_000, 0, 150));
  // (l'assorbimento a frequenza viene dalla formula, quello della banda dal valore arrotondato dello scenario)
  for (const f of [50, 100, 300, 1000, 3500, 25_000]) assert.ok(Math.abs(via.perdita(f) - via.perdita(`f${f}`)) < 1e-3);
  const t2k = via.perdita(2000);
  assert.ok(t2k > Math.min(via.perdita('f1000'), via.perdita('f3500')) - 0.5);
  assert.ok(t2k < Math.max(via.perdita('f1000'), via.perdita('f3500')) + 0.5);
  assert.ok(via.perdita(40_000) - via.perdita(25_000) > 30 * (ambiente.assorbimento(40_000) - ambiente.assorbimento(25_000)) - 1);
  assert.throws(() => via.perdita('nessuna'), /sconosciuta/);
});

test('i sensori chiedono la TL alle tabelle se l\'ambiente le porta, altrimenti all\'analitico di F1', async () => {
  const amb = await creaAmbiente({ id: 'torpex_palestra' });
  assert.ok(amb.propagazione, 'creaAmbiente attacca le tabelle dello scenario');
  const s = P(30_000, -10_000, 145);
  const r = P(36_000, -12_000, 145);
  assert.equal(perdita(acustica, amb, 2000, s, r, 'sfera'), vere.perdita(s, r, 'sfera'));
  assert.equal(perdita(acustica, amb, 437, s, r), vere.perdita(s, r, 437));
  // senza tabelle: F1, e la riserva con la stessa interfaccia da' lo stesso numero
  const provv = ambienteProvvisorio();
  assert.equal(perdita(acustica, provv, 2000, s, r, 'sfera'), perditaTrasmissione(acustica, provv, 2000, s, r));
  const riserva = propagazioneAnalitica(acustica, provv);
  assert.equal(riserva.fonte, 'analitico');
  assert.equal(riserva.perdita(s, r, 'sfera'), perditaTrasmissione(acustica, provv, 2000, s, r));
  assert.equal(riserva.perdita(s, r, 'towed'), perditaTrasmissione(acustica, provv, 300, s, r));
  assert.equal(riserva.percorso(s, r).perdita('f3500'), perditaTrasmissione(acustica, provv, 3500, s, r));
  assert.equal(riserva.perdita(s, r, 437), perditaTrasmissione(acustica, provv, 437, s, r));
});

test('portate con le tabelle: due 688 lenti a poche migliaia di iarde (PROGETTO §5.12)', async () => {
  for (const h of [190, 350, 900]) {
    const amb = ambienteProvvisorio({ fondale: h, strato: 21, perditaStrato: 13.5, traffico: 0.4, temperatura: 8.7, salinita: 35.24, ph: 8.09 });
    amb.propagazione = await piatte(h);
    const kyd = (/** @type {Parameters<typeof eccessoAllaDistanza>[0]['bersaglio']} */ bersaglio,
      /** @type {Parameters<typeof eccessoAllaDistanza>[0]['ascoltatore']} */ ascoltatore) =>
      portata(eccessoAllaDistanza({ ascoltatore, bersaglio, ac: acustica, amb, piattaforme })) / 914.4;
    const quieti = kyd({ tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 150 }, { sensore: 'sfera', velocita: 5, quota: 150 });
    assert.ok(quieti > 3 && quieti < 10, `${h} m: 688 contro 688 a 5 kt, ${quieti.toFixed(1)} kyd`);
    const dd = kyd({ tipo: 'nave', classe: 'cacciatorpediniere', velocita: 10 }, { sensore: 'sfera', velocita: 5, quota: 18 }) / 2.0254;
    assert.ok(dd > 5 && dd < 15, `${h} m: cacciatorpediniere a 10 kt, ${dd.toFixed(1)} nm`);
  }
});

test('costo: la lettura in linea costa meno di un microsecondo per coppia', () => {
  // Come in partita: un insieme fisso di coppie (otto battelli con due sensori, una dozzina di sorgenti) entro
  // 60 km, rilette ogni secondo; e il caso peggiore, coppie a caso in tutta l'area (fino a 280 km, tante classi
  // di fondale attraversate, nessuna memoria cache calda).
  let seme = 12345;
  const caso = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
  /** @param {number} n @param {number} lato @param {number} raggio */
  const coppie = (n, lato, raggio) => Array.from({ length: n }, () => {
    const s = P(-lato + 2 * lato * caso(), -lato + 2 * lato * caso(), 5 + 300 * caso());
    const a = 2 * Math.PI * caso();
    const d = raggio * caso();
    return { s, r: P(s.x + d * Math.cos(a), s.y + d * Math.sin(a), 5 + 300 * caso()) };
  });
  /** @param {{s: ReturnType<typeof P>, r: ReturnType<typeof P>}[]} insieme @param {number} giri */
  const misura = (insieme, giri) => {
    let somma = 0;
    for (let k = 0; k < 10; k++) for (const c of insieme) somma += vere.perdita(c.s, c.r, 'sfera');
    // tempo di CPU del processo, non di orologio: le prove girano in parallelo con altro
    const t0 = process.cpuUsage();
    for (let k = 0; k < giri; k++) for (const c of insieme) somma += vere.perdita(c.s, c.r, 'sfera');
    const t = process.cpuUsage(t0);
    assert.ok(Number.isFinite(somma));
    return (t.user + t.system) * 1000 / (giri * insieme.length);
  };
  const partita = misura(coppie(200, 60_000, 60_000), 500);
  const peggiore = misura(coppie(4000, 95_000, 280_000), 25);
  // il bersaglio e' 1 µs (docs/CALIBRAZIONE_F2.md riporta la misura a macchina scarica); la soglia della prova e'
  // larga perche' le prove girano in parallelo con altro e la cache si contende
  assert.ok(partita < 4000, `${partita.toFixed(0)} ns per coppia`);
  console.log(`# propagazione: ${partita.toFixed(0)} ns per coppia in partita, ${peggiore.toFixed(0)} ns nel caso peggiore ` +
    `(un campione del fondale ogni ${blocco.percorso.passo_campioni} m, al piu' ${blocco.percorso.campioni})`);
});
