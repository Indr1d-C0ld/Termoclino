// @ts-check
/**
 * Prove del protocollo v1: validazione di ogni ordine (anche malformato),
 * quantizzazione e codifica dei fotogrammi sonar, contesti di validazione
 * ricavati dalle piattaforme.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTESTO_688,
  COMANDI_TOWED,
  DAL_CLIENT,
  DAL_SERVER,
  ERRORI,
  MOTIVI_ORDINE,
  ORDINI,
  PROTOCOLLO_VERSIONE,
  QUOTE_SPECIALI,
  SCALE_TEMPO,
  SONAR,
  WAYPOINT_MAX,
  centroSettore,
  codificaSettori,
  contestoOrdini,
  decodifica,
  decodificaSettori,
  dequantizzaSE,
  quantizzaSE,
  settoreDi,
  validaEntra,
  validaOrdine,
} from '../protocol.js';
import { caricaTutte } from '../data/piattaforme.js';

const tutte = await caricaTutte();
const ctx688 = contestoOrdini(/** @type {any} */ (tutte.get('688')).valori);
const ctxAlfa = contestoOrdini(/** @type {any} */ (tutte.get('alfa')).valori);

/**
 * @param {string} cosa
 * @param {unknown} valore
 * @param {import('../protocol.js').ContestoOrdini} [ctx]
 */
const ok = (cosa, valore, ctx = ctx688) => {
  const v = validaOrdine({ cosa, valore }, ctx);
  assert.equal(v.ok, true, `${cosa} ${JSON.stringify(valore)} dovrebbe passare`);
  return v.ok ? v.ordine.valore : undefined;
};
/**
 * @param {string} cosa
 * @param {unknown} valore
 * @param {string} motivo
 * @param {import('../protocol.js').ContestoOrdini} [ctx]
 */
const no = (cosa, valore, motivo, ctx = ctx688) => {
  const v = validaOrdine({ cosa, valore }, ctx);
  assert.equal(v.ok, false, `${cosa} ${JSON.stringify(valore)} non dovrebbe passare`);
  if (!v.ok) assert.equal(v.motivo, motivo, `${cosa} ${JSON.stringify(valore)}`);
};

test('versione 1, tipi e codici stabili', () => {
  assert.equal(PROTOCOLLO_VERSIONE, 1);
  assert.deepEqual(Object.values(DAL_CLIENT), ['ciao', 'ping', 'entra', 'esci', 'ordine']);
  assert.ok(Object.values(DAL_SERVER).includes('sonar'));
  assert.equal(ERRORI.ORDINE_NON_VALIDO, 'ordine_non_valido');
  assert.equal(new Set(Object.values(MOTIVI_ORDINE)).size, Object.values(MOTIVI_ORDINE).length);
});

test('il contesto del 688 ricavato dai dati coincide con CONTESTO_688', () => {
  assert.deepEqual(ctx688, { ...CONTESTO_688, percentuale: [0, 0] });
  assert.equal(ctxAlfa.telegrafo, 'percentuale');
  assert.deepEqual(ctxAlfa.percentuale, [-10, 110]);
  assert.equal(ctxAlfa.quotaMax, 600);
});

test('macchina: tacche del 688, percentuali dell\'Alfa', () => {
  for (const v of ['rev', 'stop', '1/3', '2/3', 'std', 'full', 'flank']) assert.equal(ok('macchina', v), v);
  no('macchina', 'FLANK', MOTIVI_ORDINE.VALORE);
  no('macchina', 'avanti tutta', MOTIVI_ORDINE.VALORE);
  no('macchina', 50, MOTIVI_ORDINE.TIPO);
  no('macchina', null, MOTIVI_ORDINE.TIPO);
  assert.equal(ok('macchina', 110, ctxAlfa), 110);
  assert.equal(ok('macchina', -10, ctxAlfa), -10);
  assert.equal(ok('macchina', 37, ctxAlfa), 37);
  no('macchina', 111, MOTIVI_ORDINE.FUORI_LIMITI, ctxAlfa);
  no('macchina', -11, MOTIVI_ORDINE.FUORI_LIMITI, ctxAlfa);
  no('macchina', 50.5, MOTIVI_ORDINE.TIPO, ctxAlfa);
  no('macchina', '2/3', MOTIVI_ORDINE.TIPO, ctxAlfa);
});

test('timone e timoni orizzontali: interi entro i limiti', () => {
  assert.equal(ok('timone', -30), -30);
  assert.equal(ok('timone', 30), 30);
  assert.equal(Object.is(ok('timone', -0), 0), true);
  no('timone', 31, MOTIVI_ORDINE.FUORI_LIMITI);
  no('timone', -31, MOTIVI_ORDINE.FUORI_LIMITI);
  no('timone', 1.5, MOTIVI_ORDINE.TIPO);
  no('timone', '15', MOTIVI_ORDINE.TIPO);
  no('timone', Number.NaN, MOTIVI_ORDINE.TIPO);
  no('timone', Infinity, MOTIVI_ORDINE.TIPO);
  assert.equal(ok('timoni_o', 20), 20);
  assert.equal(ok('timoni_o', -20), -20);
  no('timoni_o', 21, MOTIVI_ORDINE.FUORI_LIMITI);
  no('timoni_o', true, MOTIVI_ORDINE.TIPO);
});

test('quota: metri fino al collasso, o le parole della pulsantiera', () => {
  assert.equal(ok('quota', 0), 0);
  assert.equal(ok('quota', 45.72), 45.7);
  assert.equal(ok('quota', 450), 450);
  for (const q of QUOTE_SPECIALI) assert.equal(ok('quota', q), q);
  no('quota', -1, MOTIVI_ORDINE.FUORI_LIMITI);
  no('quota', 450.1, MOTIVI_ORDINE.FUORI_LIMITI);
  assert.equal(ok('quota', 590, ctxAlfa), 590);
  no('quota', 'fondo', MOTIVI_ORDINE.VALORE);
  no('quota', Number.NaN, MOTIVI_ORDINE.TIPO);
  no('quota', { m: 3 }, MOTIVI_ORDINE.TIPO);
});

test('rotta: da 0 a 360, normalizzata al decimo', () => {
  assert.equal(ok('rotta', 0), 0);
  assert.equal(ok('rotta', 359.96), 0);
  assert.equal(ok('rotta', 360), 0);
  assert.equal(ok('rotta', 123.456), 123.5);
  no('rotta', -0.1, MOTIVI_ORDINE.FUORI_LIMITI);
  no('rotta', 360.1, MOTIVI_ORDINE.FUORI_LIMITI);
  no('rotta', '090', MOTIVI_ORDINE.TIPO);
});

test('towed, autopilota, pausa, scala del tempo', () => {
  for (const c of COMANDI_TOWED) assert.equal(ok('towed', c), c);
  no('towed', 'su', MOTIVI_ORDINE.VALORE);
  no('towed', 1, MOTIVI_ORDINE.TIPO);
  assert.equal(ok('autopilota', true), true);
  no('autopilota', 'si', MOTIVI_ORDINE.TIPO);
  no('autopilota', 1, MOTIVI_ORDINE.TIPO);
  assert.equal(ok('pausa', false), false);
  no('pausa', null, MOTIVI_ORDINE.TIPO);
  for (const s of SCALE_TEMPO) assert.equal(ok('scala_tempo', s), s);
  no('scala_tempo', 0, MOTIVI_ORDINE.VALORE);
  no('scala_tempo', 3, MOTIVI_ORDINE.VALORE);
  no('scala_tempo', 64, MOTIVI_ORDINE.VALORE);
  no('scala_tempo', 2.5, MOTIVI_ORDINE.TIPO);
});

test('waypoint: aggiungi, togli, svuota, e le forme sbagliate', () => {
  assert.deepEqual(ok('waypoint', { azione: 'aggiungi', x: 1000.4, y: -2000.6 }), { azione: 'aggiungi', x: 1000, y: -2001 });
  assert.deepEqual(ok('waypoint', { azione: 'togli', indice: 0 }), { azione: 'togli', indice: 0 });
  assert.deepEqual(ok('waypoint', { azione: 'svuota', x: 3 }), { azione: 'svuota' });
  no('waypoint', { azione: 'aggiungi', x: 1 }, MOTIVI_ORDINE.TIPO);
  no('waypoint', { azione: 'aggiungi', x: 'a', y: 1 }, MOTIVI_ORDINE.TIPO);
  no('waypoint', { azione: 'aggiungi', x: 2e6, y: 0 }, MOTIVI_ORDINE.FUORI_LIMITI);
  no('waypoint', { azione: 'togli', indice: WAYPOINT_MAX }, MOTIVI_ORDINE.FUORI_LIMITI);
  no('waypoint', { azione: 'togli', indice: 1.5 }, MOTIVI_ORDINE.TIPO);
  no('waypoint', { azione: 'sposta' }, MOTIVI_ORDINE.VALORE);
  no('waypoint', [1, 2], MOTIVI_ORDINE.TIPO);
  no('waypoint', null, MOTIVI_ORDINE.TIPO);
});

test('cosa sconosciuta, numero d\'ordine e messaggi strani', () => {
  no('siluro', 1, MOTIVI_ORDINE.COSA);
  no('', 1, MOTIVI_ORDINE.COSA);
  no('__proto__', 1, MOTIVI_ORDINE.COSA);
  const senzaCosa = validaOrdine({ valore: 1 });
  assert.equal(senzaCosa.ok, false);
  if (!senzaCosa.ok) assert.equal(senzaCosa.motivo, MOTIVI_ORDINE.COSA);
  const conN = validaOrdine({ cosa: 'timone', valore: 5, n: 17 });
  assert.equal(conN.ok && conN.n, 17);
  for (const n of [-1, 1.5, '3', 2 ** 31, Number.NaN]) {
    const v = validaOrdine({ cosa: 'timone', valore: 5, n });
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.motivo, MOTIVI_ORDINE.N);
  }
  // ogni cosa ammessa ha un caso valido qui sopra
  assert.deepEqual([...ORDINI].sort(), ['autopilota', 'macchina', 'pausa', 'quota', 'rotta', 'scala_tempo', 'timone', 'timoni_o', 'towed', 'waypoint']);
  // un ordine passato per decodifica come arriva dalla rete
  const d = decodifica(JSON.stringify({ t: 'ordine', cosa: 'quota', valore: 'periscopica', n: 1 }));
  assert.equal(d.ok && validaOrdine(d.messaggio).ok, true);
});

test('entra: solo gli scenari noti', () => {
  assert.deepEqual(validaEntra({ scenario: 'torpex_palestra' }), { ok: true, scenario: 'torpex_palestra' });
  assert.equal(validaEntra({ scenario: 'shake_em' }).ok, false);
  assert.equal(validaEntra({}).ok, false);
});

test('sonar: quantizzazione, settori, codifica base64', () => {
  assert.equal(quantizzaSE(0), SONAR.Q_SOGLIA);
  assert.equal(dequantizzaSE(SONAR.Q_SOGLIA), 0);
  assert.equal(quantizzaSE(-Infinity), 0);
  assert.equal(quantizzaSE(Number.NaN), 0);
  assert.equal(quantizzaSE(-31), 0);
  assert.equal(quantizzaSE(1000), 255);
  for (let q = 0; q <= 255; q++) assert.equal(quantizzaSE(dequantizzaSE(q)), q);
  assert.equal(Math.abs(dequantizzaSE(quantizzaSE(12.3)) - 12.3) <= SONAR.PASSO_DB / 2, true);
  assert.equal(settoreDi(0), 0);
  assert.equal(settoreDi(1.99), 0);
  assert.equal(settoreDi(2), 1);
  assert.equal(settoreDi(359.9), 179);
  assert.equal(settoreDi(-1), 179);
  assert.equal(settoreDi(720), 0);
  assert.equal(centroSettore(0), 1);
  assert.equal(centroSettore(179), 359);
  const byte = new Uint8Array(SONAR.SETTORI);
  for (let i = 0; i < byte.length; i++) byte[i] = (i * 37) & 255;
  const s = codificaSettori(byte);
  assert.equal(s.length, 240);
  assert.deepEqual(decodificaSettori(s), byte);
  assert.equal(decodificaSettori(s.slice(0, 236)), null);
  assert.equal(decodificaSettori('!!!'), null);
  assert.equal(decodificaSettori(/** @type {any} */ (42)), null);
});
