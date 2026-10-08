// @ts-check
/**
 * Il modello acustico di F1: dati con provenienza, perdita di trasmissione
 * (monotona, strato, fondo), rumore, baffles, fotogrammi coerenti con
 * l'equazione del sonar, portate di rivelazione dentro le bande di taratura
 * (docs/CALIBRAZIONE_F1.md).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { acustica, piattaforme, battello, ordina } from './aiuto.js';
import {
  perditaTrasmissione, validaAcustica, sogliaRivelazione, sommaDb, guadagnoFascio,
  rumoreProprioSfera, livelloSottomarino, sigmaRilevamento,
} from '../src/sim/sensors/acustica.js';
import { ambienteProvvisorio, rumoreCoates, assorbimentoAinslieMcColm } from '../src/sim/world/ambiente.js';
import { SensorePassivo } from '../src/sim/sensors/passivo.js';
import { tabellaPortate, eccessoAllaDistanza, portata } from '../src/sim/sensors/taratura.js';
import { trovaPicchi } from '../src/sim/crew/equipaggio.js';
import { Nave } from '../src/ai/navi.js';
import { Generatore } from '../../shared/rng.js';
import { chiaviFonte, visitaDati } from '../../shared/data/piattaforme.js';
import { SONAR, dequantizzaSE, settoreDi } from '../../shared/protocol.js';
import { metriInKiloiarde, metriInMigliaNautiche } from '../../shared/units.js';

const amb = ambienteProvvisorio();
const p688 = /** @type {any} */ (piattaforme.get('688')).valori;

test('acustica.json: ogni numero ha fonte (esistente in FONTI.md) e confidenza', async () => {
  const grezzi = JSON.parse(await readFile(new URL('../../shared/data/acustica.json', import.meta.url), 'utf8'));
  assert.deepEqual(validaAcustica(grezzi), []);
  const fonti = await readFile(new URL('../../docs/ricerca/FONTI.md', import.meta.url), 'utf8');
  const definite = new Set([...fonti.matchAll(/^\| \[([^\]\s]+)\] \|/gm)].map((m) => m[1]));
  /** @type {string[]} */
  const mancanti = [];
  visitaDati(grezzi, (p, d) => {
    for (const k of chiaviFonte(String(d.fonte))) if (!definite.has(k)) mancanti.push(`${p}: [${k}]`);
    if (chiaviFonte(String(d.fonte)).every((k) => k === 'CONO')) assert.equal(d.confidenza, 'nozionale', p);
  });
  assert.deepEqual(mancanti, []);
  assert.ok(validaAcustica({ formato: 'termoclino-acustica/1', a: 3 }).length > 0);
});

test('perdita di trasmissione: cresce con la distanza, sferica poi cilindrica', () => {
  for (const f of [300, 2000]) {
    let prima = -Infinity;
    for (let r = 10; r < 200_000; r *= 1.07) {
      const tl = perditaTrasmissione(acustica, amb, f, { x: 0, y: 0, z: 100 }, { x: r, y: 0, z: 100 });
      assert.ok(tl > prima, `TL non monotona a ${f} Hz, ${r} m`);
      prima = tl;
    }
  }
  const tl = (/** @type {number} */ r) => perditaTrasmissione(acustica, amb, 2000, { x: 0, y: 0, z: 100 }, { x: r, y: 0, z: 100 });
  // sferica fino alla profondita' dell'acqua (1000 m): 20 dB per decade
  assert.ok(Math.abs(tl(1000) - tl(100) - 20) < 0.3);
  // oltre, cilindrica (10 dB per decade) piu' assorbimento e perdite al fondo
  const decade = tl(20_000) - tl(2000);
  assert.ok(decade > 10 && decade < 10 + 18 * (0.13 + 0.93) + 0.5, `${decade}`);
  // l'assorbimento conta di piu' in alto: a 50 km la sfera perde piu' dell'antenna
  const alta = perditaTrasmissione(acustica, amb, 2000, { x: 0, y: 0, z: 100 }, { x: 50_000, y: 0, z: 100 });
  const bassa = perditaTrasmissione(acustica, amb, 300, { x: 0, y: 0, z: 100 }, { x: 50_000, y: 0, z: 100 });
  assert.ok(alta - bassa > 5, `${alta - bassa}`);
  // in acque basse il regime cilindrico comincia prima ma il fondo si fa pagare
  const bassofondo = ambienteProvvisorio({ fondale: 150 });
  const tlB = perditaTrasmissione(acustica, bassofondo, 2000, { x: 0, y: 0, z: 50 }, { x: 10_000, y: 0, z: 50 });
  const tlP = perditaTrasmissione(acustica, amb, 2000, { x: 0, y: 0, z: 50 }, { x: 10_000, y: 0, z: 50 });
  assert.ok(Math.abs(tlB - tlP) < 10);
});

test('strato: si paga solo attraversandolo, e solo oltre qualche centinaio di metri', () => {
  const sopra = { x: 0, y: 0, z: 30 };
  const sotto = (/** @type {number} */ r) => ({ x: r, y: 0, z: 150 });
  const stessa = (/** @type {number} */ r) => ({ x: r, y: 0, z: 40 });
  const piena = acustica.propagazione.perdita_strato;
  for (const r of [3000, 10_000, 30_000]) {
    const attraverso = perditaTrasmissione(acustica, amb, 2000, sopra, sotto(r));
    const stessoLato = perditaTrasmissione(acustica, amb, 2000, sopra, stessa(r));
    assert.ok(Math.abs(attraverso - stessoLato - piena) < 0.2, `${r} m: ${attraverso - stessoLato}`);
  }
  const vicino = perditaTrasmissione(acustica, amb, 2000, sopra, sotto(400)) - perditaTrasmissione(acustica, amb, 2000, sopra, stessa(400));
  assert.ok(vicino < 1, `sotto i 500 m lo strato non nasconde: ${vicino}`);
  // simmetrica: da sotto a sopra come da sopra a sotto
  assert.ok(Math.abs(perditaTrasmissione(acustica, amb, 2000, sotto(10_000), sopra) - perditaTrasmissione(acustica, amb, 2000, sopra, sotto(10_000))) < 1e-9);
  // senza strato, niente perdita
  const senza = ambienteProvvisorio({ strato: null });
  assert.ok(Math.abs(perditaTrasmissione(acustica, senza, 2000, sopra, sotto(10_000)) - perditaTrasmissione(acustica, senza, 2000, sopra, stessa(10_000))) < 0.01);
});

test('rumore e soglie: formule della ricerca', () => {
  // Coates: valori calcolati di 05_acustica.md §3.2 (s = 0,5, w = 5 m/s)
  assert.ok(Math.abs(rumoreCoates(1000, 0.5, 5) - 61.0) < 0.2);
  assert.ok(Math.abs(rumoreCoates(300, 0.5, 5) - 63.3) < 0.2);
  // Ainslie & McColm a 4 °C: 05 §2.2 (1 kHz 0,064 dB/km, 10 kHz 1,154)
  assert.ok(Math.abs(assorbimentoAinslieMcColm(1000, 4, 35, 8, 0) - 0.064) < 0.003);
  assert.ok(Math.abs(assorbimentoAinslieMcColm(10000, 4, 35, 8, 0) - 1.154) < 0.02);
  assert.ok(Math.abs(sogliaRivelazione(acustica, 'sfera') - (-13.5)) < 0.1);
  assert.ok(Math.abs(sogliaRivelazione(acustica, 'towed') - (-9.4)) < 0.1);
  assert.ok(Math.abs(sommaDb(60, 60) - 63.01) < 0.01);
  assert.equal(sommaDb(-Infinity, 50), 50);
  assert.ok(Math.abs(guadagnoFascio(4.9, 9.8, -25) - (-3)) < 1e-9);
  assert.equal(guadagnoFascio(90, 9.8, -25) < -40, true);
  // rumore proprio: a 5 kt sotto il mare, a 15 kt pari, a 25 kt sordi (05 §7.1)
  const mare = amb.rumore(2000);
  assert.ok(rumoreProprioSfera(p688, acustica, 5, false) < mare - 10);
  assert.ok(Math.abs(rumoreProprioSfera(p688, acustica, 15, false) - mare) < 5);
  assert.ok(rumoreProprioSfera(p688, acustica, 25, false) > mare + 8);
  // rumore irradiato: Alfa assordante ad alta velocita', cavitazione +18 dB
  const p = (/** @type {string} */ id) => /** @type {any} */ (piattaforme.get(id)).valori;
  assert.ok(livelloSottomarino(p('alfa'), acustica, 'sfera', 40, false, 0) - livelloSottomarino(p('688'), acustica, 'sfera', 32, false, 0) > 20);
  assert.ok(Math.abs(livelloSottomarino(p688, acustica, 'sfera', 10, true, 0) - livelloSottomarino(p688, acustica, 'sfera', 10, false, 0) - 18) < 1e-9);
  assert.ok(livelloSottomarino(p688, acustica, 'sfera', 10, false, -1) > livelloSottomarino(p688, acustica, 'sfera', 10, false, 1), 'di poppa si sente di piu\'');
});

/**
 * Un cacciatorpediniere a distanza e rilevamento dati da un battello.
 * @param {number} r @param {number} rilevamento @param {number} [v]
 */
function dd(r, rilevamento, v = 10) {
  return new Nave({
    id: 'dd', classe: 'cacciatorpediniere', nome: 'dd', profilo: acustica.sorgenti.cacciatorpediniere,
    x: r * Math.sin(rilevamento * Math.PI / 180), y: r * Math.cos(rilevamento * Math.PI / 180),
    rotta: (rilevamento + 90) % 360, velocita: v, waypoint: [],
  });
}

const senzaFluttuazione = { ...acustica, rivelazione: { ...acustica.rivelazione, fluttuazione_sigma: 0 } };

test('fotogramma: il picco sta dove dice l\'equazione del sonar, i baffles non sentono', () => {
  const b = battello({ velocita: 5, z: 45, rotta: 0 });
  ordina(b, 'macchina', '1/3');
  const sensore = new SensorePassivo({ nome: 'sfera', battello: b, ac: senzaFluttuazione, rng: new Generatore(11), rngCoppia: () => new Generatore(12) });
  const g = /** @type {NonNullable<ReturnType<typeof sensore.geometria>>} */ (sensore.geometria(amb));
  for (const r of [5000, 15_000]) {
    const bersaglio = dd(r, 60);
    const e = /** @type {{se: number}} */ (sensore.eccesso(bersaglio, amb, g));
    const f = /** @type {NonNullable<ReturnType<typeof sensore.fotogramma>>} */ (sensore.fotogramma([b, bersaglio], amb));
    const picchi = trovaPicchi(f.settori, sensore.fascio);
    assert.equal(picchi.length, 1, `${r} m: picchi ${picchi}`);
    const sigma = sigmaRilevamento(e.se, sensore.fascio, sensore.coefficiente, sensore.sigmaMin);
    assert.ok(Math.abs(picchi[0] - 60) < 3 * sigma + 1, `rilevamento ${picchi[0]} (σ ${sigma.toFixed(1)}°)`);
    const valore = dequantizzaSE(f.settori[settoreDi(picchi[0])]);
    assert.ok(Math.abs(valore - e.se) < 3, `${r} m: fotogramma ${valore} dB, equazione ${e.se.toFixed(1)} dB`);
  }
  // un bersaglio fortissimo nei baffles (a poppa) non c'e'
  const poppa = dd(3000, 180);
  assert.equal(sensore.eccesso(poppa, amb, g), null);
  const f = /** @type {NonNullable<ReturnType<typeof sensore.fotogramma>>} */ (sensore.fotogramma([b, poppa], amb));
  assert.deepEqual(trovaPicchi(f.settori, sensore.fascio), []);
  assert.deepEqual(f.ciechi, [[150, 210]]);
  // il fondo da solo resta sotto soglia quasi sempre (Pfa ~ 5e-5 per settore)
  let falsi = 0;
  for (let i = 0; i < 200; i++) {
    const vuoto = /** @type {NonNullable<ReturnType<typeof sensore.fotogramma>>} */ (sensore.fotogramma([b], amb));
    falsi += Array.from(vuoto.settori).filter((q) => q >= SONAR.Q_SOGLIA).length;
  }
  assert.ok(falsi <= 5, `falsi allarmi: ${falsi} su ${200 * 180}`);
});

test('errore di rilevamento: largo vicino alla soglia, stretto sui segnali forti', () => {
  const b = battello({ velocita: 5, z: 45, rotta: 0 });
  ordina(b, 'macchina', '1/3');
  const sensore = new SensorePassivo({ nome: 'sfera', battello: b, ac: senzaFluttuazione, rng: new Generatore(13), rngCoppia: () => new Generatore(14) });
  /** @param {number} r */
  const dispersione = (r) => {
    const bersaglio = dd(r, 90);
    /** @type {number[]} */
    const errori = [];
    for (let i = 0; i < 150; i++) {
      const f = /** @type {NonNullable<ReturnType<typeof sensore.fotogramma>>} */ (sensore.fotogramma([b, bersaglio], amb));
      const p = trovaPicchi(f.settori, sensore.fascio);
      if (p.length > 0) errori.push(p[0] - 90);
    }
    const m = errori.reduce((a, x) => a + x, 0) / errori.length;
    return Math.sqrt(errori.reduce((a, x) => a + (x - m) ** 2, 0) / errori.length);
  };
  const forte = dispersione(3000);
  const debole = dispersione(16_000);
  assert.ok(forte < 1.2, `segnale forte: σ ${forte}`);
  assert.ok(debole > 2 * forte, `vicino alla soglia: σ ${debole} contro ${forte}`);
});

/** Gli ambienti di taratura: il provvisorio e l'estate di TORPEX '89 (scenario della palestra). */
const AMBIENTI = [
  ['provvisorio (strato 60 m, 12 dB)', ambienteProvvisorio()],
  ['estate TORPEX (strato 21 m, 13,5 dB, traffico 0,4)', ambienteProvvisorio({ strato: 21, perditaStrato: 13.5, traffico: 0.4, temperatura: 8.7, salinita: 35.24, ph: 8.09 })],
  ['piattaforma delle Fær Øer (200 m d\'acqua, estate)', ambienteProvvisorio({ fondale: 200, strato: 21, perditaStrato: 13.5, traffico: 0.4, temperatura: 8.7, salinita: 35.24, ph: 8.09 })],
];

for (const [nomeAmb, ambiente] of /** @type {[string, import('../src/sim/world/ambiente.js').Ambiente][]} */ (AMBIENTI)) {
  test(`portate di rivelazione dentro le bande di taratura — ${nomeAmb}`, () => {
    const t = new Map(tabellaPortate(acustica, ambiente, piattaforme).map((r) => [r.nome, r]));
    const kyd = (/** @type {string} */ n) => { const r = t.get(n); assert.ok(r, n); return r.kyd; };
    const nm = (/** @type {string} */ n) => { const r = t.get(n); assert.ok(r, n); return r.nm; };
    // due 688 lenti: poche migliaia di iarde (PROGETTO §5.12, 07 §7)
    const quieti = kyd('688 a 5 kt, entrambi a 150 m');
    assert.ok(quieti > 2.5 && quieti < 7, `688 contro 688 a 5 kt: ${quieti} kyd`);
    // chi accelera si fa sentire prima; chi cavita, da molto lontano
    // (in acque basse un po' meno: il fondo si mangia i dB in piu' a 2 dB/km)
    assert.ok(kyd('688 a 15 kt (150 m)') > 1.6 * quieti);
    assert.ok(kyd('688 a 20 kt (150 m, cavita)') > 1.8 * kyd('688 a 15 kt (150 m)'));
    assert.ok(kyd('688 a 10 kt a quota periscopica (cavita), ascolto a quota periscopica') > 10);
    // con lo strato in mezzo: molto meno
    assert.ok(kyd('688 a 5 kt a quota periscopica, ascolto a 150 m (strato in mezzo)') < 0.5 * quieti);
    // per ascoltare si rallenta: a 25 kt si e' sordi
    assert.ok(kyd('688 a 5 kt, chi ascolta va a 25 kt') < 0.25 * quieti);
    assert.ok(kyd('688 a 5 kt, chi ascolta va a 15 kt') < quieti);
    // l'Alfa: rumoroso gia' a 10 kt, sentito da lontanissimo a tutta forza
    assert.ok(kyd('Alfa a 10 kt (150 m)') > 1.6 * kyd('688 a 10 kt (150 m)'));
    assert.ok(nm('Alfa a 40 kt (300 m, cavita)') > 15);
    // un cacciatorpediniere a 10 kt: varie miglia dallo stesso lato, molto meno attraverso
    const ddStesso = nm('cacciatorpediniere a 10 kt, ascolto a quota periscopica (stesso lato)');
    const ddSotto = nm('cacciatorpediniere a 10 kt, ascolto a 150 m (sotto lo strato)');
    assert.ok(ddStesso > 5 && ddStesso < 15, `DD stesso lato: ${ddStesso} nm`);
    assert.ok(ddSotto < 0.6 * ddStesso, `DD attraverso lo strato: ${ddSotto} nm`);
    assert.ok(nm('cacciatorpediniere fermo (macchinari), ascolto a quota periscopica') < 2);
    assert.ok(nm('mercantile a 12 kt, ascolto a quota periscopica') > ddStesso);
    // biologici: qualche miglio al piu'
    const bio = nm('sorgente biologica attiva (30 m), ascolto a 150 m');
    assert.ok(bio > 0.5 && bio < 7, `biologico: ${bio} nm`);
    // l'antenna: poche kyd sul 688, peggio a 10 kt, e sotto lo strato anche se lo scafo e' sopra
    const ant = kyd('688 a 5 kt (150 m) — antenna, battello a 150 m');
    assert.ok(ant > 1.5 && ant < 7, `antenna 688 contro 688: ${ant}`);
    assert.ok(kyd('688 a 5 kt (150 m) — antenna a 10 kt') < ant);
    assert.ok(kyd('688 a 5 kt (150 m) — antenna, battello a quota periscopica (antenna sotto lo strato)') > 0.8 * ant);
  });
}

test('la taratura usa lo stesso calcolo dei fotogrammi', () => {
  const se = eccessoAllaDistanza({
    ascoltatore: { sensore: 'sfera', velocita: 5, quota: 150 },
    bersaglio: { tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 150 },
    ac: acustica, amb, piattaforme,
  });
  const r = portata(se);
  assert.ok(Math.abs(/** @type {number} */ (se(r))) < 0.01);
  assert.ok(/** @type {number} */ (se(r / 2)) > 0);
  assert.ok(metriInKiloiarde(r) > 1 && metriInMigliaNautiche(r) < 10);
});
