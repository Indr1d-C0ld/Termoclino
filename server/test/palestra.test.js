// @ts-check
/**
 * Il protocollo v1 attraverso il cancello vero: entrare nella palestra,
 * ordinare (bene e male), la scala del tempo in una partita condivisa,
 * l'ufficiale di guardia, il rientro, la seconda connessione, l'uscita, le
 * istantanee su file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { avvia, cliente } from './clienti.js';
import { ERRORI, MOTIVI_ORDINE, decodificaSettori } from '../../shared/protocol.js';
import { Palestra } from '../src/match/palestra.js';
import { creaRegistro } from '../src/registro.js';
import { acustica, piattaforme } from './aiuto.js';

test('entra, ordina, esce: risposte e errori del protocollo v1', async () => {
  const { cancello, palestra, url } = await avvia();
  try {
    const a = await cliente(url, 11, 'Alfa Uno');
    // prima di entrare non si ordina e non si esce
    a.manda({ t: 'ordine', cosa: 'macchina', valore: '2/3', n: 1 });
    assert.deepEqual(await a.aspetta('errore'), { t: 'errore', codice: ERRORI.NON_IN_PARTITA, n: 1 });
    a.manda({ t: 'esci' });
    assert.equal((await a.aspetta('errore')).codice, ERRORI.NON_IN_PARTITA);
    a.manda({ t: 'entra', scenario: 'shake_em' });
    assert.equal((await a.aspetta('errore')).codice, ERRORI.SCENARIO_SCONOSCIUTO);

    a.manda({ t: 'entra', scenario: 'torpex_palestra' });
    const p = await a.aspetta('partita');
    assert.equal(p.scenario, 'torpex_palestra');
    assert.equal(p.battello.piattaforma, '688');
    assert.equal(p.tempo_modificabile, true);
    assert.equal(p.passo, 0.1);
    const s = await a.aspetta('stato');
    assert.equal(typeof s.x, 'number');
    assert.equal(s.towed.stato, 'stivata');
    a.manda({ t: 'entra', scenario: 'torpex_palestra' });
    assert.equal((await a.aspetta('errore')).codice, ERRORI.GIA_IN_PARTITA);

    // ordini: accettati, malformati, rifiutati
    a.manda({ t: 'ordine', cosa: 'macchina', valore: '2/3', n: 2 });
    assert.deepEqual(await a.aspetta('ricevuto'), { t: 'ricevuto', n: 2, cosa: 'macchina', valore: '2/3' });
    a.manda({ t: 'ordine', cosa: 'rotta', valore: 123.456, n: 3 });
    assert.equal((await a.aspetta('ricevuto')).valore, 123.5);
    a.manda({ t: 'ordine', cosa: 'timone', valore: 45, n: 4 });
    assert.deepEqual(await a.aspetta('errore'), { t: 'errore', codice: ERRORI.ORDINE_NON_VALIDO, n: 4, cosa: 'timone', motivo: MOTIVI_ORDINE.FUORI_LIMITI });
    a.manda({ t: 'ordine', cosa: 'siluro', valore: 1, n: 5 });
    assert.equal((await a.aspetta('errore')).motivo, MOTIVI_ORDINE.COSA);
    a.manda({ t: 'ordine', cosa: 'autopilota', valore: true, n: 6 });
    assert.deepEqual(await a.aspetta('errore'), { t: 'errore', codice: ERRORI.ORDINE_RIFIUTATO, n: 6, cosa: 'autopilota', motivo: MOTIVI_ORDINE.NESSUN_WAYPOINT });
    a.manda({ t: 'ordine', cosa: 'waypoint', valore: { azione: 'aggiungi', x: 900_000, y: 0 }, n: 7 });
    assert.equal((await a.aspetta('errore')).motivo, MOTIVI_ORDINE.FUORI_AREA);
    a.manda({ t: 'ordine', cosa: 'towed', valore: 'ritira', n: 8 });
    assert.equal((await a.aspetta('errore')).motivo, MOTIVI_ORDINE.TOWED_STATO);
    a.manda({ t: 'ordine', cosa: 'towed', valore: 'fila', n: 9 });
    assert.equal((await a.aspetta('ricevuto')).n, 9);

    // da solo comanda il tempo
    a.manda({ t: 'ordine', cosa: 'scala_tempo', valore: 8, n: 10 });
    const tempo = await a.aspetta('tempo');
    assert.equal(tempo.scala_tempo, 8);
    assert.equal((await a.aspetta('ricevuto')).n, 10);
    a.manda({ t: 'ordine', cosa: 'pausa', valore: true, n: 11 });
    assert.equal((await a.aspetta('tempo')).in_pausa, true);
    const ora0 = /** @type {NonNullable<typeof palestra.partita>} */ (palestra.partita).ora;
    palestra.tick(1);
    assert.equal(/** @type {NonNullable<typeof palestra.partita>} */ (palestra.partita).ora, ora0, 'in pausa il tempo non passa');
    a.manda({ t: 'ordine', cosa: 'pausa', valore: false, n: 12 });
    await a.aspetta((m) => m.t === 'ricevuto' && m.n === 12);
    palestra.tick(0.5);
    assert.equal(/** @type {NonNullable<typeof palestra.partita>} */ (palestra.partita).ora, ora0 + 4);
    // un giro d'orologio fa al piu' 4 s di gioco: il resto si perde (e lo si registra)
    palestra.tick(1);
    assert.equal(/** @type {NonNullable<typeof palestra.partita>} */ (palestra.partita).ora, ora0 + 8);
    assert.equal(palestra.statistiche.persi, 40);

    // fotogrammi e stato arrivano col tempo
    for (let i = 0; i < 10; i++) palestra.tick(1);
    const sonar = await a.aspetta('sonar');
    assert.equal(sonar.sensore, 'sfera');
    assert.equal(decodificaSettori(sonar.settori)?.length, 180);
    assert.equal(sonar.ciechi.length, 1);
    const st = await a.aspetta('stato');
    assert.equal(st.macchina, '2/3');
    assert.equal(st.rotta_ordinata, 123.5);
    assert.equal(st.towed.stato, 'in_filare');

    // arriva un secondo giocatore: la scala torna a 1 e non si tocca piu'
    const b = await cliente(url, 12, 'Bravo Due');
    b.manda({ t: 'entra', scenario: 'torpex_palestra' });
    const pb = await b.aspetta('partita');
    assert.equal(pb.tempo_modificabile, false);
    assert.equal(pb.scala_tempo, 1);
    assert.notEqual(pb.battello.nome, p.battello.nome);
    const t2 = await a.aspetta('tempo');
    assert.deepEqual([t2.scala_tempo, t2.in_pausa, t2.tempo_modificabile], [1, false, false]);
    a.manda({ t: 'ordine', cosa: 'scala_tempo', valore: 4, n: 13 });
    assert.equal((await a.aspetta('errore')).motivo, MOTIVI_ORDINE.TEMPO_BLOCCATO);
    b.manda({ t: 'ordine', cosa: 'pausa', valore: true, n: 1 });
    assert.equal((await b.aspetta('errore')).motivo, MOTIVI_ORDINE.TEMPO_BLOCCATO);

    // esce il secondo: il primo torna padrone del tempo
    b.manda({ t: 'esci' });
    assert.deepEqual(await b.aspetta('uscita'), { t: 'uscita', motivo: 'esci' });
    assert.equal((await a.aspetta('tempo')).tempo_modificabile, true);
    b.manda({ t: 'ordine', cosa: 'macchina', valore: 'stop', n: 2 });
    assert.equal((await b.aspetta('errore')).codice, ERRORI.NON_IN_PARTITA);
    assert.equal(cancello.stato().palestra?.battelli, 1);
    b.ws.close();
    a.ws.close();
  } finally {
    await cancello.chiudi('fine prove');
  }
});

test('ufficiale di guardia: la linea cade, il battello resta; si rientra con un biglietto nuovo', async () => {
  let adesso = 1_000_000;
  const { cancello, palestra, url } = await avvia({ guardiaSecondi: 120, adessoMs: () => adesso });
  try {
    const a = await cliente(url, 21, 'Charlie');
    a.manda({ t: 'entra', scenario: 'torpex_palestra' });
    const p = await a.aspetta('partita');
    a.manda({ t: 'ordine', cosa: 'macchina', valore: '2/3', n: 1 });
    a.manda({ t: 'ordine', cosa: 'timone', valore: 10, n: 2 });
    await a.aspetta((m) => m.t === 'ricevuto' && m.n === 2);
    a.ws.close();
    await a.chiusa;
    await new Promise((r) => setTimeout(r, 20));
    const partita = /** @type {NonNullable<typeof palestra.partita>} */ (palestra.partita);
    const g = /** @type {NonNullable<ReturnType<typeof partita.giocatori.get>>} */ (partita.giocatori.get(21));
    assert.equal(g.invia, null);
    assert.ok(g.battello.rottaOrdinata !== null, 'la guardia tiene la rotta');
    for (let i = 0; i < 60; i++) palestra.tick(1);
    assert.ok(Math.abs(g.battello.omega) < 0.1, 'la guardia ha raddrizzato');
    adesso += 60_000;
    palestra.tick(0.1);
    assert.ok(partita.giocatori.has(21), 'prima della scadenza il battello resta');

    // rientro: stesso battello, e la guardia riferisce
    const a2 = await cliente(url, 21, 'Charlie');
    a2.manda({ t: 'entra', scenario: 'torpex_palestra' });
    const p2 = await a2.aspetta('partita');
    assert.equal(p2.battello.nome, p.battello.nome);
    const r = await a2.aspetta((m) => m.t === 'rapporto' && m.chiave === 'guardia.ripreso_il_comando');
    assert.equal(r.parametri.secondi, 60);

    // una seconda connessione dello stesso utente prende il battello
    const a3 = await cliente(url, 21, 'Charlie');
    a3.manda({ t: 'entra', scenario: 'torpex_palestra' });
    await a3.aspetta('partita');
    assert.deepEqual(await a2.aspetta('uscita'), { t: 'uscita', motivo: 'altra_connessione' });
    a2.manda({ t: 'ordine', cosa: 'macchina', valore: 'stop', n: 9 });
    assert.equal((await a2.aspetta('errore')).codice, ERRORI.NON_IN_PARTITA);

    // linea caduta di nuovo, e questa volta la guardia scade
    a3.ws.close();
    await a3.chiusa;
    await new Promise((r) => setTimeout(r, 20));
    adesso += 121_000;
    palestra.tick(0.1);
    assert.equal(partita.giocatori.has(21), false);
    a2.ws.close();
  } finally {
    await cancello.chiudi('fine prove');
  }
});

test('istantanee della verita\': gzip a righe JSON, una al secondo di gioco, con gli ordini', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'termoclino-prova-'));
  try {
    const palestra = new Palestra({
      registro: creaRegistro('error', () => {}), acustica, piattaforme, dirIstantanee: dir, guardiaSecondi: 300, seme: 5, orologio: false,
    });
    const canale = { invia: () => {}, revocato: () => {} };
    await palestra.entra(31, 'Delta', canale);
    palestra.ordine(31, canale, { cosa: 'macchina', valore: 'std' });
    for (let i = 0; i < 30; i++) palestra.tick(1);
    await palestra.chiudi();
    const file = await readdir(dir);
    assert.equal(file.length, 1);
    assert.match(file[0], /^palestra-.*\.jsonl\.gz$/);
    const righe = gunzipSync(await readFile(join(dir, file[0]))).toString('utf8').trim().split('\n').map((r) => JSON.parse(r));
    assert.equal(righe[0].formato, 'termoclino-istantanee/1');
    assert.equal(righe[0].seme, 5);
    assert.ok(righe.some((r) => r.evento === 'ordine' && r.cosa === 'macchina' && r.valore === 'std'));
    const istanti = righe.filter((r) => Array.isArray(r.entita));
    assert.equal(istanti.length, 30);
    assert.deepEqual(istanti.map((r) => r.ora), Array.from({ length: 30 }, (_, i) => i + 1));
    assert.ok(istanti[0].entita.some((/** @type {any} */ e) => e.tipo === 'sottomarino'));
    assert.equal(righe[righe.length - 1].evento, 'fine');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
