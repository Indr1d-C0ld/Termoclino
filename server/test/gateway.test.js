// @ts-check
/**
 * Prove del cancello WebSocket: si avvia il server su una porta casuale e lo si
 * provoca in tutti i modi che un client sbagliato (o malintenzionato) userebbe.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { avviaCancello } from '../src/gateway.js';
import { leggiConfigurazione } from '../src/config.js';
import { creaRegistro } from '../src/registro.js';
import { firmaBiglietto, PROTOCOLLO_VERSIONE, ERRORI } from '../../shared/protocol.js';

const SEGRETO = 'prova-segreto-lungo-almeno-trentadue-caratteri-0123456789';
const ORIGINE = 'http://prova.locale';
/** @type {Awaited<ReturnType<typeof avviaCancello>>} */
let cancello;
let url = '';
/** @type {string[]} */
const righe = [];

before(async () => {
  const conf = leggiConfigurazione({
    TERMOCLINO_SEGRETO_BIGLIETTI: SEGRETO,
    TERMOCLINO_PORTA: '8095', // sostituita sotto con 0
    TERMOCLINO_ORIGINI: ORIGINE,
    TERMOCLINO_MSG_AL_SECONDO: '20',
    TERMOCLINO_RAFFICA: '10',
  });
  conf.porta = 0; // porta scelta dal sistema: le prove non si pestano i piedi
  cancello = await avviaCancello(conf, creaRegistro('debug', (r) => righe.push(r)), { battitoMs: 200 });
  url = `ws://127.0.0.1:${cancello.porta}/`;
});

after(async () => { await cancello.chiudi('fine prove'); });

let contatoreNonce = 0;
/** @param {Partial<Record<string, unknown>>} [sovrascrivi] */
async function biglietto(sovrascrivi = {}) {
  const nonce = (++contatoreNonce).toString(16).padStart(24, '0');
  return firmaBiglietto({
    v: 1, uid: 7, nome: 'Comandante Prova', ruolo: 'player',
    exp: Math.floor(Date.now() / 1000) + 60, nonce, ...sovrascrivi,
  }, SEGRETO);
}

/**
 * Apre una connessione e raccoglie messaggi e chiusura.
 * @param {string} [origine]
 */
function apri(origine = ORIGINE) {
  const ws = new WebSocket(url, { origin: origine });
  /** @type {any[]} */
  const ricevuti = [];
  /** @type {Array<(m: any) => void>} */
  const attese = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    const a = attese.shift();
    if (a) a(m); else ricevuti.push(m);
  });
  const chiusa = new Promise((r) => ws.on('close', (codice) => r(codice)));
  const errore = new Promise((r) => ws.on('error', (e) => r(e)));
  const aperta = new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
  // Nelle prove di rifiuto nessuno aspetta l'apertura: senza questo, il suo
  // rifiuto resterebbe «non gestito» e farebbe fallire la prova sbagliata.
  aperta.catch(() => {});
  return {
    ws, aperta, chiusa, errore,
    /** @returns {Promise<any>} */
    prossimo: () => ricevuti.length ? Promise.resolve(ricevuti.shift()) : new Promise((r) => attese.push(r)),
    /** @param {object} m */
    manda: (m) => ws.send(JSON.stringify(m)),
  };
}

test('un biglietto valido porta a bordo', async () => {
  const c = apri();
  await c.aperta;
  c.manda({ t: 'ciao', versione: PROTOCOLLO_VERSIONE, biglietto: await biglietto() });
  const m = await c.prossimo();
  assert.equal(m.t, 'benvenuto');
  assert.deepEqual(m.utente, { uid: 7, nome: 'Comandante Prova', ruolo: 'player' });
  c.manda({ t: 'ping', n: 42 });
  const p = await c.prossimo();
  assert.equal(p.t, 'pong');
  assert.equal(p.n, 42);
  assert.equal(cancello.stato().utenti, 1);
  c.ws.close();
  await c.chiusa;
});

test('origine non ammessa: rifiutata prima ancora di aprire', async () => {
  const c = apri('https://altrove.example');
  const e = /** @type {Error} */ (await c.errore);
  assert.match(e.message, /403/);
});

test('lo stesso biglietto non vale due volte', async () => {
  const b = await biglietto();
  const uno = apri(); await uno.aperta;
  uno.manda({ t: 'ciao', versione: PROTOCOLLO_VERSIONE, biglietto: b });
  assert.equal((await uno.prossimo()).t, 'benvenuto');
  const due = apri(); await due.aperta;
  due.manda({ t: 'ciao', versione: PROTOCOLLO_VERSIONE, biglietto: b });
  const m = await due.prossimo();
  assert.equal(m.codice, ERRORI.BIGLIETTO_GIA_USATO);
  assert.equal(await due.chiusa, 4401);
  uno.ws.close(); await uno.chiusa;
});

test('biglietto scaduto, falsificato o con un altro segreto: rifiutato', async () => {
  const casi = [
    [await biglietto({ exp: Math.floor(Date.now() / 1000) - 120 }), ERRORI.BIGLIETTO_SCADUTO],
    [(await biglietto()).replace(/\.(.)/, (_, x) => '.' + (x === 'A' ? 'B' : 'A')), ERRORI.BIGLIETTO_NON_VALIDO],
    [await firmaBiglietto({ v: 1, uid: 1, nome: 'x', ruolo: 'admin', exp: 9e9, nonce: 'ab'.repeat(12) }, 'un-altro-segreto-lungo-trentadue-caratteri!!'), ERRORI.BIGLIETTO_NON_VALIDO],
    ['', ERRORI.BIGLIETTO_ASSENTE],
  ];
  for (const [b, atteso] of casi) {
    const c = apri(); await c.aperta;
    c.manda({ t: 'ciao', versione: PROTOCOLLO_VERSIONE, biglietto: b });
    assert.equal((await c.prossimo()).codice, atteso);
    assert.equal(await c.chiusa, 4401);
  }
});

test('senza presentarsi non si fa niente, e la versione sbagliata chiude', async () => {
  const c = apri(); await c.aperta;
  c.manda({ t: 'ping', n: 1 });
  assert.equal((await c.prossimo()).codice, ERRORI.NON_PRESENTATO);
  c.manda({ t: 'ciao', versione: 99, biglietto: await biglietto() });
  assert.equal((await c.prossimo()).codice, ERRORI.VERSIONE);
  assert.equal(await c.chiusa, 4426);
});

test('messaggi malformati: errore, e alla lunga chiusura', async () => {
  const c = apri(); await c.aperta;
  c.ws.send('non sono json');
  assert.equal((await c.prossimo()).codice, ERRORI.MESSAGGIO_MALFORMATO);
  for (let i = 0; i < 6; i++) c.ws.send('[1,2,3]');
  assert.equal(await c.chiusa, 4400);
});

test('chi martella viene frenato e poi chiuso', async () => {
  const c = apri(); await c.aperta;
  c.manda({ t: 'ciao', versione: PROTOCOLLO_VERSIONE, biglietto: await biglietto() });
  assert.equal((await c.prossimo()).t, 'benvenuto');
  for (let i = 0; i < 60; i++) c.manda({ t: 'ping', n: i });
  assert.equal(await c.chiusa, 4429);
});

test('la sonda /salute risponde senza WebSocket', async () => {
  const r = await fetch(`http://127.0.0.1:${cancello.porta}/salute`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.protocollo, PROTOCOLLO_VERSIONE);
});

test('il registro non contiene mai un biglietto intero', () => {
  for (const r of righe) assert.doesNotMatch(r, /[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}/);
});
