// @ts-check
/**
 * Cavitazione con la quota (PROGETTO §11.3: a quota periscopica il 688 cavita
 * gia' sopra gli 8 nodi, a 500 ft regge fino a circa 18, a 1000 ft fino a
 * circa 25) e regole dell'antenna rimorchiata (R2 e R3 di SCHEMA §5): tempi,
 * velocita', taglio, tempo morto dopo le accostate, ambiguita' destra/sinistra.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battello, ordina, avanza, acustica, p688, AREA } from './aiuto.js';
import { velocitaCavitazione } from '../src/sim/sensors/acustica.js';
import { SensorePassivo } from '../src/sim/sensors/passivo.js';
import { ambienteProvvisorio } from '../src/sim/world/ambiente.js';
import { Nave } from '../src/ai/navi.js';
import { Generatore } from '../../shared/rng.js';
import { piediInMetri, normalizza180 } from '../../shared/units.js';
import { validaOrdine, MOTIVI_ORDINE, decodificaSettori, dequantizzaSE, centroSettore } from '../../shared/protocol.js';
import { trovaPicchi } from '../src/sim/crew/equipaggio.js';

const cav = p688.valori.acustica.cavitazione;
const rim = p688.valori.sensori.rimorchiata;

test('velocita\' d\'innesco: 8 kt a quota periscopica, ~18 a 500 ft, ~25 a 1000 ft', () => {
  const pd = velocitaCavitazione(cav, p688.valori.profondita.periscopica);
  const q500 = velocitaCavitazione(cav, piediInMetri(500));
  const q1000 = velocitaCavitazione(cav, piediInMetri(1000));
  assert.ok(pd > 7.5 && pd <= 8, `quota periscopica: ${pd}`);
  assert.ok(Math.abs(q500 - 18.5) < 0.5, `500 ft: ${q500}`);
  assert.ok(Math.abs(q1000 - 25.6) < 0.5, `1000 ft: ${q1000}`);
  // radice della pressione assoluta, non della sola profondita'
  assert.ok(Math.abs(velocitaCavitazione(cav, 0) - 8 * Math.sqrt(10.1 / 30.1)) < 1e-9);
});

test('il battello cavita secondo la quota, a regime', () => {
  /** @type {[number, string, boolean][]} [quota m, ordine, cavita?] */
  const casi = [
    [18, '1/3', false], [18, '2/3', true],
    [piediInMetri(500), 'std', false], [piediInMetri(500), 'full', true],
    [piediInMetri(1000), 'full', false], [piediInMetri(1000), 'flank', true],
  ];
  for (const [quota, ordine, atteso] of casi) {
    const b = battello({ velocita: 0, z: quota });
    ordina(b, 'quota', quota);
    ordina(b, 'macchina', ordine);
    avanza(b, 900);
    assert.equal(b.cavitante, atteso, `${quota.toFixed(0)} m a ${ordine} (${b.velocita.toFixed(1)} kt, innesco ${b.vCavitazione.toFixed(1)})`);
  }
});

test('i giri vanno avanti allo scafo: chiamare tutta forza fa cavitare subito', () => {
  const b = battello({ velocita: 5, z: 100 });
  ordina(b, 'quota', 100);
  ordina(b, 'macchina', 'flank');
  avanza(b, 15);
  assert.ok(b.velocita < 10, `lo scafo e' ancora lento: ${b.velocita}`);
  assert.equal(b.cavitante, true, 'ma l\'elica gira gia\' da tutta forza');
  // la marcia indietro a nave lanciata cavita anche a quote dove l'avanti non cavita
  const r = battello({ velocita: 15, z: 150 });
  ordina(r, 'quota', 150);
  ordina(r, 'macchina', 'std');
  avanza(r, 5);
  assert.equal(r.cavitante, false);
  ordina(r, 'macchina', 'rev');
  avanza(r, 10);
  assert.equal(r.cavitante, true);
});

test('antenna: sette minuti per filarla, utile solo filata e a velocita\' giusta', () => {
  const b = battello({ velocita: 5, z: 100 });
  ordina(b, 'macchina', '1/3');
  ordina(b, 'towed', 'fila');
  const t = /** @type {NonNullable<typeof b.towed>} */ (b.towed);
  avanza(b, rim.tempo_filare - 5);
  assert.equal(t.stato, 'in_filare');
  assert.equal(b.towedUtile, false);
  avanza(b, 10);
  assert.equal(t.stato, 'filata');
  assert.equal(t.filato, t.lunghezza);
  assert.ok(Math.abs(t.lunghezza - 803) < 1e-9);
  assert.equal(b.towedUtile, true);
  // piu' bassa del battello, di piu' a bassa velocita'
  assert.ok(t.quota !== null && t.quota > b.z + 50, `quota antenna ${t.quota}`);
  // troppo veloci: sorda
  ordina(b, 'macchina', 'full');
  avanza(b, 200);
  assert.ok(b.velocita > rim.velocita_sorda);
  assert.equal(b.towedUtile, false);
  // non si fila due volte; si ritira; si taglia una volta sola
  const fila = validaOrdine({ cosa: 'towed', valore: 'fila' });
  assert.equal(fila.ok && b.ordina(fila.ordine, AREA), MOTIVI_ORDINE.TOWED_STATO);
  ordina(b, 'macchina', '1/3');
  avanza(b, 300);
  ordina(b, 'towed', 'ritira');
  avanza(b, rim.tempo_recuperare + 5);
  assert.equal(t.stato, 'stivata');
  const taglia = validaOrdine({ cosa: 'towed', valore: 'taglia' });
  assert.equal(taglia.ok && b.ordina(taglia.ordine, AREA), MOTIVI_ORDINE.TOWED_STATO);
  ordina(b, 'towed', 'fila');
  avanza(b, 60);
  ordina(b, 'towed', 'taglia');
  assert.equal(t.stato, 'tagliata');
  assert.equal(fila.ok && b.ordina(fila.ordine, AREA), MOTIVI_ORDINE.TOWED_STATO);
  const chiavi = b.rapporti.map((r) => r.chiave);
  for (const k of ['towed.in_filare', 'towed.filata', 'towed.in_ritiro', 'towed.ritirata', 'towed.tagliata']) assert.ok(chiavi.includes(k), k);
});

test('antenna: oltre la velocita\' di danno prima o poi si perde', () => {
  const b = battello({ velocita: 5, z: 100 });
  ordina(b, 'macchina', '1/3');
  ordina(b, 'towed', 'fila');
  avanza(b, 430);
  ordina(b, 'macchina', 'flank');
  avanza(b, 1800);
  const t = /** @type {NonNullable<typeof b.towed>} */ (b.towed);
  assert.equal(t.stato, 'persa');
  assert.ok(b.rapporti.some((r) => r.chiave === 'towed.persa'));
});

test('antenna: tempo morto dopo un\'accostata = (cavo + antenna) / v, fra 2 e 8 minuti', () => {
  for (const [ordine, v] of /** @type {const} */ ([['1/3', 5], ['2/3', 10]])) {
    const b = battello({ velocita: v, z: 100 });
    ordina(b, 'macchina', ordine);
    ordina(b, 'towed', 'fila');
    avanza(b, 430);
    const t = /** @type {NonNullable<typeof b.towed>} */ (b.towed);
    assert.equal(b.towedUtile, true);
    ordina(b, 'rotta', 90);
    let fineAccostata = null;
    let utileDi = null;
    avanza(b, 900, undefined, (s) => {
      if (fineAccostata === null && Math.abs(b.rotta - 90) < 1 && Math.abs(b.omega) < 0.05) fineAccostata = s;
      if (utileDi === null && fineAccostata !== null && b.towedUtile) utileDi = s;
    });
    assert.ok(fineAccostata !== null && utileDi !== null);
    const atteso = Math.min(rim.tempo_morto_max, Math.max(rim.tempo_morto_min, t.lunghezza / (b.velocita * 0.514444)));
    const misurato = utileDi - fineAccostata;
    assert.ok(Math.abs(misurato - atteso) < 0.15 * atteso, `${ordine}: ${misurato.toFixed(0)} s contro ${atteso.toFixed(0)}`);
    assert.ok(b.rapporti.some((r) => r.chiave === 'towed.stabilizzata'));
  }
});

test('antenna: ogni contatto compare due volte, speculare rispetto all\'asse', () => {
  const amb = ambienteProvvisorio();
  const b = battello({ velocita: 6, z: 150, rotta: 30 });
  ordina(b, 'macchina', '1/3');
  const t = /** @type {NonNullable<typeof b.towed>} */ (b.towed);
  t.stato = 'filata';
  t.filato = t.lunghezza;
  b.velocita = 6;
  b._towed(0, amb);
  const ac = { ...acustica, rivelazione: { ...acustica.rivelazione, fluttuazione_sigma: 0 } };
  const sensore = new SensorePassivo({ nome: 'towed', battello: b, ac, rng: new Generatore(5), rngCoppia: () => new Generatore(6) });
  const pos = /** @type {NonNullable<ReturnType<typeof b.posizioneTowed>>} */ (b.posizioneTowed());
  // un mercantile a 8 km, 70° a dritta dell'asse
  const theta = 30 + 70;
  const m = new Nave({
    id: 'm', classe: 'mercantile', nome: 'm', profilo: acustica.sorgenti.mercantile,
    x: pos.x + 8000 * Math.sin(theta * Math.PI / 180), y: pos.y + 8000 * Math.cos(theta * Math.PI / 180),
    rotta: 0, velocita: 12, waypoint: [],
  });
  const f = /** @type {NonNullable<ReturnType<typeof sensore.fotogramma>>} */ (sensore.fotogramma([b, m], amb));
  assert.equal(f.asse, 30);
  assert.equal(f.sorda, false);
  const picchi = trovaPicchi(f.settori, sensore.fascio).map((p) => normalizza180(p - 30));
  assert.ok(picchi.some((p) => Math.abs(p - 70) < 4), `picchi relativi ${picchi}`);
  assert.ok(picchi.some((p) => Math.abs(p + 70) < 4), `manca lo speculare: ${picchi}`);
  // il cono di prua dell'antenna e' cieco
  assert.deepEqual(f.ciechi, [[10, 50]]);
  // durante il tempo morto l'antenna e' sorda e il fotogramma lo dice
  t.tempoMorto = 100;
  const sordo = /** @type {NonNullable<ReturnType<typeof sensore.fotogramma>>} */ (sensore.fotogramma([b, m], amb));
  assert.equal(sordo.sorda, true);
  assert.deepEqual(sordo.ciechi, [[0, 360]]);
  const s = /** @type {Uint8Array} */ (decodificaSettori(Buffer.from(sordo.settori).toString('base64')));
  assert.ok(Math.max(...Array.from(s, (q) => dequantizzaSE(q))) < 0, 'nessun picco sopra soglia mentre e\' sorda');
  assert.ok(centroSettore(0) === 1);
});
