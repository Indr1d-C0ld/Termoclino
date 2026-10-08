// @ts-check
/**
 * Prove del protocollo (v2): validazione di ogni ordine (anche malformato),
 * quantizzazione e codifica dei fotogrammi sonar e degli spettri, contesti di
 * validazione ricavati dalle piattaforme, catalogo dei rapporti.
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
  ALBERI,
  ASSISTENZA_PREDEFINITA,
  CHIAVI_RAPPORTO,
  CLASSI,
  LIVELLI_ASSISTENZA,
  PORTATE_ATTIVO,
  RAPPORTI,
  SPETTRO,
  TIPI_TRANSITORIO,
  centroCella,
  codificaByte,
  contattoValido,
  decodificaByte,
  decodificaDemon,
  decodificaSpettro,
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

test('versione 2, tipi e codici stabili', () => {
  assert.equal(PROTOCOLLO_VERSIONE, 2);
  assert.deepEqual(Object.values(DAL_CLIENT), ['ciao', 'ping', 'entra', 'esci', 'ordine']);
  assert.ok(Object.values(DAL_SERVER).includes('sonar'));
  for (const t of ['spettro', 'eco', 'intercetto', 'transitorio', 'visivo', 'esm', 'radar', 'tracce', 'soluzione']) {
    assert.ok((/** @type {string[]} */ (Object.values(DAL_SERVER))).includes(t), `manca il tipo ${t}`);
  }
  assert.equal(ERRORI.ORDINE_NON_VALIDO, 'ordine_non_valido');
  assert.equal(ERRORI.ASSISTENZA_NON_VALIDA, 'assistenza_non_valida');
  assert.equal(new Set(Object.values(MOTIVI_ORDINE)).size, Object.values(MOTIVI_ORDINE).length);
  for (const m of ['quota', 'albero', 'contatto', 'livello', 'senza_sensore', 'ping_in_corso', 'settore']) {
    assert.ok((/** @type {string[]} */ (Object.values(MOTIVI_ORDINE))).includes(m), `manca il motivo ${m}`);
  }
});

test('rapporti: catalogo esportato, parametri senza doppioni, chiavi con il ruolo', () => {
  assert.deepEqual([...CHIAVI_RAPPORTO], Object.keys(RAPPORTI));
  assert.ok(CHIAVI_RAPPORTO.length >= 35);
  for (const [k, p] of Object.entries(RAPPORTI)) {
    assert.match(k, /^[a-z]+\.[a-z_]+$/, k);
    assert.equal(new Set(p).size, p.length, `${k}: parametri doppi`);
    assert.ok(Object.isFrozen(p));
  }
  // v1 intatti, v2 dalla bozza (con le rifiniture di PROTOCOLLO.md)
  assert.deepEqual(RAPPORTI['sonar.nuovo_contatto'], ['contatto', 'sensore', 'rilevamento', 'speculare']);
  assert.deepEqual(RAPPORTI['sonar.eco'], ['rilevamento', 'distanza']);
  assert.deepEqual(RAPPORTI['intercetto.ping'], ['rilevamento', 'frequenza_khz']);
  assert.deepEqual(RAPPORTI['sonar.transitorio'], ['contatto', 'sensore', 'tipo', 'rilevamento']);
  for (const k of ['periscopio.nave_in_vista', 'periscopio.scia', 'esm.radar', 'sonar.fine_ascolto', 'guardia.alberi_abbassati',
    'sonar.classificato', 'tma.soluzione', 'tma.consiglio_manovra', 'tma.distanza_non_osservabile', 'tma.ekelund']) {
    assert.ok(RAPPORTI[k], `manca ${k}`);
  }
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
  // ogni cosa ammessa ha un caso valido in queste prove
  assert.deepEqual([...ORDINI].sort(), [
    'abbandona', 'albero', 'analizzatore', 'assistenza', 'attivo', 'autopilota', 'classifica', 'designa', 'macchina',
    'pausa', 'quota', 'radar', 'rotta', 'scala_tempo', 'soluzione', 'timone', 'timoni_o', 'towed', 'waypoint',
  ]);
  // un ordine passato per decodifica come arriva dalla rete
  const d = decodifica(JSON.stringify({ t: 'ordine', cosa: 'quota', valore: 'periscopica', n: 1 }));
  assert.equal(d.ok && validaOrdine(d.messaggio).ok, true);
});

test('entra: solo gli scenari noti, livello di assistenza facoltativo', () => {
  assert.deepEqual(validaEntra({ scenario: 'torpex_palestra' }), { ok: true, scenario: 'torpex_palestra', assistenza: ASSISTENZA_PREDEFINITA });
  assert.equal(ASSISTENZA_PREDEFINITA, 2);
  for (const l of LIVELLI_ASSISTENZA) assert.deepEqual(validaEntra({ scenario: 'torpex_palestra', assistenza: l }), { ok: true, scenario: 'torpex_palestra', assistenza: l });
  assert.deepEqual(validaEntra({ scenario: 'torpex_palestra', assistenza: null }), { ok: true, scenario: 'torpex_palestra', assistenza: 2 });
  for (const a of [4, -1, 1.5, '2', true, {}]) {
    assert.deepEqual(validaEntra({ scenario: 'torpex_palestra', assistenza: a }), { ok: false, errore: ERRORI.ASSISTENZA_NON_VALIDA }, JSON.stringify(a));
  }
  assert.equal(validaEntra({ scenario: 'shake_em' }).ok, false);
  assert.equal(validaEntra({}).ok, false);
});

test('v2: assistenza, radar, designa, abbandona', () => {
  for (const l of LIVELLI_ASSISTENZA) assert.equal(ok('assistenza', l), l);
  no('assistenza', 4, MOTIVI_ORDINE.FUORI_LIMITI);
  no('assistenza', -1, MOTIVI_ORDINE.FUORI_LIMITI);
  no('assistenza', 1.5, MOTIVI_ORDINE.TIPO);
  no('assistenza', '2', MOTIVI_ORDINE.TIPO);
  assert.equal(ok('radar', true), true);
  assert.equal(ok('radar', false), false);
  no('radar', 'acceso', MOTIVI_ORDINE.TIPO);
  no('radar', 1, MOTIVI_ORDINE.TIPO);
  assert.equal(ok('designa', 'S1'), 'S1');
  assert.equal(ok('designa', 'Ц12'), 'Ц12');
  assert.equal(ok('designa', null), null);
  no('designa', 's1', MOTIVI_ORDINE.VALORE);
  no('designa', 'S', MOTIVI_ORDINE.VALORE);
  no('designa', 'S1 ', MOTIVI_ORDINE.VALORE);
  no('designa', 'SIERRA1', MOTIVI_ORDINE.VALORE);
  no('designa', 7, MOTIVI_ORDINE.TIPO);
  assert.equal(ok('abbandona', 'S3'), 'S3');
  no('abbandona', null, MOTIVI_ORDINE.TIPO);
  no('abbandona', '3', MOTIVI_ORDINE.VALORE);
  assert.equal(contattoValido('S9999'), true);
  assert.equal(contattoValido('S10000'), false);
  assert.equal(contattoValido('<b>S1</b>'), false);
});

test('v2: analizzatore', () => {
  assert.equal(ok('analizzatore', null), null);
  assert.deepEqual(ok('analizzatore', { sensore: 'towed', rilevamento: 123.456 }), { sensore: 'towed', rilevamento: 123.5 });
  assert.deepEqual(ok('analizzatore', { sensore: 'sfera', rilevamento: 360 }), { sensore: 'sfera', rilevamento: 0 });
  assert.deepEqual(ok('analizzatore', { contatto: 'S2' }), { contatto: 'S2' });
  no('analizzatore', { sensore: 'conforme', rilevamento: 10 }, MOTIVI_ORDINE.VALORE);
  no('analizzatore', { sensore: 'sfera', rilevamento: 361 }, MOTIVI_ORDINE.FUORI_LIMITI);
  no('analizzatore', { sensore: 'sfera', rilevamento: '10' }, MOTIVI_ORDINE.TIPO);
  no('analizzatore', { sensore: 'sfera' }, MOTIVI_ORDINE.TIPO);
  no('analizzatore', { sensore: 3, rilevamento: 10 }, MOTIVI_ORDINE.TIPO);
  no('analizzatore', { contatto: 'S2', sensore: 'sfera', rilevamento: 4 }, MOTIVI_ORDINE.VALORE);
  no('analizzatore', { contatto: 'x' }, MOTIVI_ORDINE.VALORE);
  no('analizzatore', { contatto: 2 }, MOTIVI_ORDINE.TIPO);
  no('analizzatore', { sensore: 'sfera', rilevamento: 4, extra: 1 }, MOTIVI_ORDINE.TIPO);
  no('analizzatore', 'sfera', MOTIVI_ORDINE.TIPO);
  no('analizzatore', [1, 2], MOTIVI_ORDINE.TIPO);
});

test('v2: attivo', () => {
  for (const p of PORTATE_ATTIVO) assert.deepEqual(ok('attivo', { rilevamento: null, portata: p }), { rilevamento: null, portata: p });
  assert.deepEqual(ok('attivo', { rilevamento: 359.97, portata: 'lunga' }), { rilevamento: 0, portata: 'lunga' });
  no('attivo', { rilevamento: null }, MOTIVI_ORDINE.TIPO);
  no('attivo', { portata: 'corta' }, MOTIVI_ORDINE.TIPO);
  no('attivo', { rilevamento: null, portata: 'media' }, MOTIVI_ORDINE.VALORE);
  no('attivo', { rilevamento: null, portata: 1 }, MOTIVI_ORDINE.TIPO);
  no('attivo', { rilevamento: -5, portata: 'corta' }, MOTIVI_ORDINE.FUORI_LIMITI);
  no('attivo', { rilevamento: 'prua', portata: 'corta' }, MOTIVI_ORDINE.TIPO);
  no('attivo', { rilevamento: Number.NaN, portata: 'corta' }, MOTIVI_ORDINE.TIPO);
  no('attivo', true, MOTIVI_ORDINE.TIPO);
  no('attivo', null, MOTIVI_ORDINE.TIPO);
});

test('v2: albero', () => {
  for (const q of ALBERI) {
    assert.deepEqual(ok('albero', { quale: q, alzato: true }), { quale: q, alzato: true });
    assert.deepEqual(ok('albero', { quale: q, alzato: false }), { quale: q, alzato: false });
  }
  no('albero', { quale: 'snorkel', alzato: true }, MOTIVI_ORDINE.VALORE);
  no('albero', { quale: 'periscopio', alzato: 1 }, MOTIVI_ORDINE.TIPO);
  no('albero', { quale: 'periscopio' }, MOTIVI_ORDINE.TIPO);
  no('albero', { quale: 'periscopio', alzato: true, quota: 3 }, MOTIVI_ORDINE.TIPO);
  no('albero', 'periscopio', MOTIVI_ORDINE.TIPO);
});

test('v2: classifica e soluzione', () => {
  for (const c of CLASSI) assert.deepEqual(ok('classifica', { contatto: 'S1', classe: c }), { contatto: 'S1', classe: c });
  assert.deepEqual(ok('classifica', { contatto: 'S1', classe: null }), { contatto: 'S1', classe: null });
  no('classifica', { contatto: 'S1', classe: 'akula' }, MOTIVI_ORDINE.VALORE);
  no('classifica', { contatto: 'S1' }, MOTIVI_ORDINE.TIPO);
  no('classifica', { contatto: 'S1', classe: 7 }, MOTIVI_ORDINE.TIPO);
  no('classifica', { contatto: 'boh', classe: '688' }, MOTIVI_ORDINE.VALORE);
  const sol = { contatto: 'S1', ora: 123.45, distanza: 9144.4, rotta: 359.99, velocita: 12.34 };
  assert.deepEqual(ok('soluzione', sol), { contatto: 'S1', ora: 123.5, distanza: 9144, rotta: 0, velocita: 12.3 });
  assert.deepEqual(ok('soluzione', { ...sol, rilevamento: 45.06 }), { contatto: 'S1', ora: 123.5, distanza: 9144, rotta: 0, velocita: 12.3, rilevamento: 45.1 });
  assert.deepEqual(ok('soluzione', { contatto: 'S1', cancella: true }), { contatto: 'S1', cancella: true });
  no('soluzione', { contatto: 'S1', cancella: false }, MOTIVI_ORDINE.VALORE);
  no('soluzione', { contatto: 'S1', cancella: true, distanza: 3 }, MOTIVI_ORDINE.VALORE);
  no('soluzione', { ...sol, distanza: 0 }, MOTIVI_ORDINE.FUORI_LIMITI);
  no('soluzione', { ...sol, distanza: 600_000 }, MOTIVI_ORDINE.FUORI_LIMITI);
  no('soluzione', { ...sol, velocita: -1 }, MOTIVI_ORDINE.FUORI_LIMITI);
  no('soluzione', { ...sol, velocita: 61 }, MOTIVI_ORDINE.FUORI_LIMITI);
  no('soluzione', { ...sol, rotta: 400 }, MOTIVI_ORDINE.FUORI_LIMITI);
  no('soluzione', { ...sol, ora: -1 }, MOTIVI_ORDINE.FUORI_LIMITI);
  no('soluzione', { ...sol, rilevamento: 361 }, MOTIVI_ORDINE.FUORI_LIMITI);
  no('soluzione', { ...sol, rilevamento: '45' }, MOTIVI_ORDINE.TIPO);
  no('soluzione', { ...sol, velocita: '12' }, MOTIVI_ORDINE.TIPO);
  no('soluzione', { ...sol, distanza: Infinity }, MOTIVI_ORDINE.TIPO);
  no('soluzione', { contatto: 'S1', ora: 1 }, MOTIVI_ORDINE.TIPO);
  no('soluzione', { ...sol, contatto: 'x' }, MOTIVI_ORDINE.VALORE);
  no('soluzione', { ...sol, q: 80 }, MOTIVI_ORDINE.TIPO);
  no('soluzione', null, MOTIVI_ORDINE.TIPO);
});

test('v2: spettri, byte in base64, celle', () => {
  for (const sensore of /** @type {const} */ (['sfera', 'towed'])) {
    const f = SPETTRO[sensore];
    const righe = new Uint8Array(f.RIGHE).map((_, i) => (i * 13) & 255);
    const demon = new Uint8Array(f.DEMON_RIGHE).map((_, i) => (i * 7) & 255);
    const m = { sensore, righe: codificaByte(righe), demon: codificaByte(demon) };
    assert.deepEqual(decodificaSpettro(m), righe);
    assert.deepEqual(decodificaDemon(m), demon);
    assert.equal(decodificaSpettro({ ...m, sensore: 'conforme' }), null);
    assert.equal(decodificaSpettro({ ...m, righe: m.righe.slice(0, -4) }), null);
    assert.equal(m.righe.length < 1400, true, 'lo spettro sta comodo in 16 KiB');
  }
  assert.equal(decodificaByte('AAEC', 3)?.[2], 2);
  assert.equal(decodificaByte('AAEC', 4), null);
  assert.equal(decodificaByte('###', 2), null);
  assert.equal(decodificaByte(12, 2), null);
  assert.equal(centroCella(0, 1, 60), 60.5);
  assert.equal(SPETTRO.PERIODO, 4);
  assert.ok(TIPI_TRANSITORIO.includes('sconosciuto'));
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
