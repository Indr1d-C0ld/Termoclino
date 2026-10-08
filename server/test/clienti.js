// @ts-check
/**
 * Attrezzi per le prove che passano dal cancello vero: server su una porta
 * scelta dal sistema, biglietti firmati, client WebSocket che raccolgono
 * TUTTI i messaggi ricevuti (per la prova di nebbia) e sanno aspettarne uno.
 */
import { WebSocket } from 'ws';
import { avviaCancello } from '../src/gateway.js';
import { leggiConfigurazione } from '../src/config.js';
import { creaRegistro } from '../src/registro.js';
import { Palestra } from '../src/match/palestra.js';
import { firmaBiglietto, PROTOCOLLO_VERSIONE } from '../../shared/protocol.js';
import { acustica, piattaforme } from './aiuto.js';

export const SEGRETO = 'prova-segreto-lungo-almeno-trentadue-caratteri-0123456789';
export const ORIGINE = 'http://prova.locale';

/**
 * Avvia un cancello con una palestra senza orologio (la si fa avanzare a mano).
 * @param {Partial<import('../src/match/palestra.js').OpzioniPalestra>} [opzioni]
 */
export async function avvia(opzioni = {}) {
  const conf = leggiConfigurazione({
    TERMOCLINO_SEGRETO_BIGLIETTI: SEGRETO, TERMOCLINO_ORIGINI: ORIGINE,
    TERMOCLINO_MSG_AL_SECONDO: '200', TERMOCLINO_RAFFICA: '400', TERMOCLINO_ISTANTANEE: '-',
  });
  conf.porta = 0;
  /** @type {string[]} */
  const righe = [];
  const registro = creaRegistro('debug', (r) => righe.push(r));
  const palestra = new Palestra({
    registro, acustica, piattaforme, dirIstantanee: null, guardiaSecondi: 300, seme: 4242, orologio: false, ...opzioni,
  });
  const cancello = await avviaCancello(conf, registro, { palestra, battitoMs: 60_000 });
  return { cancello, palestra, righe, url: `ws://127.0.0.1:${cancello.porta}/` };
}

let nonce = 0;

/**
 * @param {number} uid
 * @param {string} nome
 */
export function biglietto(uid, nome) {
  return firmaBiglietto({
    v: 1, uid, nome, ruolo: 'player', exp: Math.floor(Date.now() / 1000) + 60,
    nonce: (++nonce).toString(16).padStart(24, '0') + process.pid.toString(16).padStart(8, '0'),
  }, SEGRETO);
}

/**
 * Un client: si presenta, raccoglie tutto, aspetta i messaggi per tipo.
 * @param {string} url
 * @param {number} uid
 * @param {string} nome
 */
export async function cliente(url, uid, nome) {
  const ws = new WebSocket(url, { origin: ORIGINE });
  /** @type {Array<Record<string, any>>} */
  const messaggi = [];
  /** @type {Array<{pred: (m: Record<string, any>) => boolean, da: number, risolvi: (m: Record<string, any>) => void}>} */
  const attese = [];
  let letti = 0;
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    messaggi.push(m);
    for (const a of [...attese]) {
      if (messaggi.length - 1 >= a.da && a.pred(m)) {
        attese.splice(attese.indexOf(a), 1);
        a.risolvi(m);
      }
    }
  });
  const chiusa = new Promise((r) => ws.on('close', (codice) => r(codice)));
  await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
  const c = {
    ws, messaggi, chiusa,
    /** @param {Record<string, unknown>} m */
    manda: (m) => ws.send(JSON.stringify(m)),
    /**
     * Il prossimo messaggio (dopo l'ultimo letto) che soddisfa il predicato.
     * @param {string | ((m: Record<string, any>) => boolean)} cond tipo o predicato
     * @returns {Promise<Record<string, any>>}
     */
    aspetta: (cond) => {
      const pred = typeof cond === 'string' ? (/** @type {Record<string, any>} */ m) => m.t === cond : cond;
      for (let i = letti; i < messaggi.length; i++) {
        if (pred(messaggi[i])) { letti = i + 1; return Promise.resolve(messaggi[i]); }
      }
      return new Promise((risolvi) => {
        attese.push({ pred, da: letti, risolvi: (m) => { letti = messaggi.indexOf(m) + 1; risolvi(m); } });
      });
    },
    /** Aspetta che tutto cio' che il server ha gia' mandato sia arrivato (giro di ping). */
    svuota: async () => {
      const n = Math.floor(Math.random() * 1e9);
      ws.send(JSON.stringify({ t: 'ping', n }));
      await c.aspetta((m) => m.t === 'pong' && m.n === n);
    },
  };
  c.manda({ t: 'ciao', versione: PROTOCOLLO_VERSIONE, biglietto: await biglietto(uid, nome) });
  await c.aspetta('benvenuto');
  return c;
}
