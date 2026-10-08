// @ts-check
/**
 * Il cancello: server HTTP + WebSocket che accoglie i client.
 *
 * Fa il mestiere di cancello — origine, biglietto, freni, battito, presenza —
 * e smista i messaggi di partita (`entra`, `esci`, `ordine`, protocollo v1)
 * alla palestra di F1. Le partite non vedono le connessioni: ricevono un
 * «canale» per i messaggi (vedi match/palestra.js).
 * Cosa NON fa, di proposito: non legge sessioni PHP, non tocca il database,
 * non conosce password. Sa chi sei solo dal biglietto firmato.
 *
 * Codici di chiusura propri (4000-4999 sono riservati alle applicazioni):
 *   4400 messaggio malformato ripetuto   4401 biglietto rifiutato
 *   4408 biglietto non presentato in tempo   4426 versione di protocollo
 *   4429 troppo in fretta, ripetutamente
 */

import http from 'node:http';
import { WebSocketServer } from 'ws';
import {
  ATTESA_CIAO_SECONDI,
  DAL_CLIENT,
  DAL_SERVER,
  ERRORI,
  MESSAGGIO_MAX_BYTE,
  PROTOCOLLO_VERSIONE,
  codifica,
  decodifica,
  validaEntra,
  verificaBiglietto,
} from '../../shared/protocol.js';
import { creaPalestra } from './match/palestra.js';

/** @typedef {import('./config.js').Configurazione} Configurazione */
/** @typedef {import('./registro.js').Registro} Registro */
/** @typedef {import('../../shared/protocol.js').CaricoBiglietto} CaricoBiglietto */
/** @typedef {import('./match/palestra.js').Palestra} Palestra */
/** @typedef {import('./match/palestra.js').Canale} Canale */

/**
 * @typedef {object} Connessione
 * @property {number} id
 * @property {import('ws').WebSocket} ws
 * @property {string} ip
 * @property {CaricoBiglietto | null} utente
 * @property {boolean} inVerifica
 * @property {number} gettoni
 * @property {number} ultimoRiempimento
 * @property {number} sgarbi            violazioni del freno o della forma
 * @property {boolean} viva             per il battito
 * @property {NodeJS.Timeout | null} attesaCiao
 * @property {Canale | null} canale     il battello che questa connessione governa
 * @property {Promise<void>} coda       i messaggi di una connessione si trattano in ordine
 */

/**
 * @param {Configurazione} conf
 * @param {Registro} registro
 * @param {{adessoMs?: () => number, battitoMs?: number, palestra?: Palestra}} [opzioni]
 */
export async function avviaCancello(conf, registro, opzioni = {}) {
  const adessoMs = opzioni.adessoMs ?? (() => Date.now());
  const battitoMs = opzioni.battitoMs ?? 30_000;
  const palestra = opzioni.palestra ?? await creaPalestra(conf, registro);
  const avviato = new Date(adessoMs()).toISOString();

  /** @type {Set<Connessione>} */
  const connessioni = new Set();
  /** @type {Map<number, Set<Connessione>>} uid -> connessioni */
  const presenti = new Map();
  /** @type {Map<string, number>} nonce -> scadenza (s): i biglietti sono monouso */
  const nonceUsati = new Map();
  let prossimoId = 1;

  const http_ = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/salute' || req.url === '/ws/salute')) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(stato()));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Termoclino: qui si parla solo WebSocket.\n');
  });

  const wss = new WebSocketServer({
    server: http_,
    maxPayload: MESSAGGIO_MAX_BYTE,
    verifyClient: (info, accetta) => {
      if (conf.originiAmmesse.length > 0 && !conf.originiAmmesse.includes(info.origin)) {
        registro.warn('origine_rifiutata', { origine: info.origin ?? null, ip: ipDi(info.req) });
        accetta(false, 403, 'Origine non ammessa');
        return;
      }
      accetta(true);
    },
  });

  wss.on('connection', (ws, req) => {
    /** @type {Connessione} */
    const c = {
      id: prossimoId++,
      ws,
      ip: ipDi(req),
      utente: null,
      inVerifica: false,
      gettoni: conf.raffica,
      ultimoRiempimento: adessoMs(),
      sgarbi: 0,
      viva: true,
      attesaCiao: null,
      canale: null,
      coda: Promise.resolve(),
    };
    connessioni.add(c);
    registro.debug('connessione', { conn: c.id, ip: c.ip });

    c.attesaCiao = setTimeout(() => {
      if (!c.utente) {
        manda(c, DAL_SERVER.ERRORE, { codice: ERRORI.NON_PRESENTATO });
        ws.close(4408, 'biglietto non presentato');
      }
    }, ATTESA_CIAO_SECONDI * 1000);

    ws.on('pong', () => { c.viva = true; });
    // In ordine: un `ordine` che segue `entra` deve trovare il battello gia' in acqua.
    ws.on('message', (dati, binario) => {
      c.coda = c.coda.then(() => ricevi(c, dati, binario)).catch((e) => {
        registro.error('messaggio_fallito', { conn: c.id, errore: /** @type {Error} */ (e).message });
      });
    });
    ws.on('close', (codice) => congeda(c, codice));
    ws.on('error', (err) => registro.warn('errore_socket', { conn: c.id, errore: err.message }));
  });

  // Battito: chi non risponde al ping entro un giro viene chiuso. Senza, una
  // connessione caduta senza saluti (Wi-Fi, portatile chiuso) resterebbe
  // «presente» per sempre.
  const battito = setInterval(() => {
    for (const c of connessioni) {
      if (!c.viva) { c.ws.terminate(); continue; }
      c.viva = false;
      try { c.ws.ping(); } catch { /* chiusa nel frattempo */ }
    }
    const adessoS = Math.floor(adessoMs() / 1000);
    for (const [nonce, scade] of nonceUsati) if (scade < adessoS - 60) nonceUsati.delete(nonce);
  }, battitoMs);
  battito.unref();

  /**
   * @param {Connessione} c
   * @param {import('ws').RawData} dati
   * @param {boolean} binario
   */
  async function ricevi(c, dati, binario) {
    if (!frena(c)) return;
    if (binario) return sgarbo(c, ERRORI.MESSAGGIO_MALFORMATO);
    const esito = decodifica(dati.toString());
    if (!esito.ok) return sgarbo(c, esito.errore);
    const m = esito.messaggio;

    if (!c.utente) {
      if (m.t !== DAL_CLIENT.CIAO || c.inVerifica) {
        manda(c, DAL_SERVER.ERRORE, { codice: ERRORI.NON_PRESENTATO });
        return;
      }
      if (m.versione !== PROTOCOLLO_VERSIONE) {
        manda(c, DAL_SERVER.ERRORE, { codice: ERRORI.VERSIONE, atteso: PROTOCOLLO_VERSIONE });
        c.ws.close(4426, 'versione di protocollo');
        return;
      }
      c.inVerifica = true;
      const adessoS = Math.floor(adessoMs() / 1000);
      const v = await verificaBiglietto(m.biglietto, conf.segretoBiglietti, adessoS);
      c.inVerifica = false;
      if (!v.ok) return rifiuta(c, v.errore);
      if (nonceUsati.has(v.carico.nonce)) return rifiuta(c, ERRORI.BIGLIETTO_GIA_USATO);
      nonceUsati.set(v.carico.nonce, v.carico.exp);
      accogli(c, v.carico);
      return;
    }

    const uid = c.utente.uid;
    switch (m.t) {
      case DAL_CLIENT.PING:
        manda(c, DAL_SERVER.PONG, { n: typeof m.n === 'number' ? m.n : null, ora: adessoMs() });
        return;
      case DAL_CLIENT.ENTRA: {
        if (c.canale) { manda(c, DAL_SERVER.ERRORE, { codice: ERRORI.GIA_IN_PARTITA }); return; }
        const v = validaEntra(m);
        if (!v.ok) { manda(c, DAL_SERVER.ERRORE, { codice: v.errore }); return; }
        /** @type {Canale} */
        const canale = {
          invia: (t, campi) => manda(c, t, campi),
          revocato: (motivo) => {
            if (c.canale !== canale) return;
            c.canale = null;
            manda(c, DAL_SERVER.USCITA, { motivo });
          },
        };
        c.canale = canale; // prima dell'attesa: un secondo `entra` trova gia' il posto preso
        try {
          const r = await palestra.entra(uid, c.utente.nome, canale, { assistenza: v.assistenza });
          if (!r.ok) {
            c.canale = null;
            manda(c, DAL_SERVER.ERRORE, { codice: r.errore });
          } else if (c.ws.readyState !== c.ws.OPEN) {
            palestra.disconnesso(uid, canale);
          }
        } catch (e) {
          c.canale = null;
          registro.error('entra_fallito', { conn: c.id, uid, errore: /** @type {Error} */ (e).message });
          manda(c, DAL_SERVER.ERRORE, { codice: ERRORI.SCENARIO_SCONOSCIUTO });
        }
        return;
      }
      case DAL_CLIENT.ESCI:
        if (!c.canale || !palestra.esci(uid, c.canale)) manda(c, DAL_SERVER.ERRORE, { codice: ERRORI.NON_IN_PARTITA });
        return;
      case DAL_CLIENT.ORDINE: {
        if (!c.canale) {
          manda(c, DAL_SERVER.ERRORE, { codice: ERRORI.NON_IN_PARTITA, n: Number.isSafeInteger(m.n) ? m.n : null });
          return;
        }
        const r = palestra.ordine(uid, c.canale, m);
        manda(c, r.t, r.campi);
        return;
      }
      case DAL_CLIENT.CIAO:
        manda(c, DAL_SERVER.ERRORE, { codice: ERRORI.MESSAGGIO_MALFORMATO, nota: 'gia presentato' });
        return;
      default:
        manda(c, DAL_SERVER.ERRORE, { codice: ERRORI.TIPO_SCONOSCIUTO, tipo: m.t });
    }
  }

  /**
   * Secchio di gettoni: `messaggiAlSecondo` di regime, `raffica` di scorta.
   * @param {Connessione} c
   */
  function frena(c) {
    const adesso = adessoMs();
    c.gettoni = Math.min(conf.raffica, c.gettoni + ((adesso - c.ultimoRiempimento) / 1000) * conf.messaggiAlSecondo);
    c.ultimoRiempimento = adesso;
    if (c.gettoni >= 1) { c.gettoni -= 1; return true; }
    c.sgarbi++;
    if (c.sgarbi > 5) {
      registro.warn('troppo_in_fretta', { conn: c.id, uid: c.utente?.uid ?? null });
      c.ws.close(4429, 'troppo in fretta');
    } else {
      manda(c, DAL_SERVER.ERRORE, { codice: ERRORI.TROPPO_IN_FRETTA });
    }
    return false;
  }

  /** @param {Connessione} c @param {string} codice */
  function sgarbo(c, codice) {
    c.sgarbi++;
    manda(c, DAL_SERVER.ERRORE, { codice });
    if (c.sgarbi > 5) c.ws.close(4400, 'messaggi malformati');
  }

  /** @param {Connessione} c @param {string} codice */
  function rifiuta(c, codice) {
    registro.info('biglietto_rifiutato', { conn: c.id, ip: c.ip, codice });
    manda(c, DAL_SERVER.ERRORE, { codice });
    c.ws.close(4401, 'biglietto rifiutato');
  }

  /** @param {Connessione} c @param {CaricoBiglietto} u */
  function accogli(c, u) {
    c.utente = u;
    if (c.attesaCiao) { clearTimeout(c.attesaCiao); c.attesaCiao = null; }
    let mie = presenti.get(u.uid);
    if (!mie) { mie = new Set(); presenti.set(u.uid, mie); }
    mie.add(c);
    registro.info('a_bordo', { conn: c.id, uid: u.uid, nome: u.nome, nonce: u.nonce.slice(0, 8) });
    manda(c, DAL_SERVER.BENVENUTO, {
      versione: PROTOCOLLO_VERSIONE,
      utente: { uid: u.uid, nome: u.nome, ruolo: u.ruolo },
      server: { versione: conf.versione, avviato },
      presenti: presenti.size,
    });
  }

  /** @param {Connessione} c @param {number} codice */
  function congeda(c, codice) {
    if (c.attesaCiao) clearTimeout(c.attesaCiao);
    connessioni.delete(c);
    if (c.utente && c.canale) {
      palestra.disconnesso(c.utente.uid, c.canale);
      c.canale = null;
    }
    if (c.utente) {
      const mie = presenti.get(c.utente.uid);
      mie?.delete(c);
      if (mie && mie.size === 0) presenti.delete(c.utente.uid);
      registro.info('sbarcato', { conn: c.id, uid: c.utente.uid, codice });
    }
  }

  /** @param {Connessione} c @param {string} t @param {Record<string, unknown>} [campi] */
  function manda(c, t, campi) {
    if (c.ws.readyState === c.ws.OPEN) c.ws.send(codifica(t, campi));
  }

  function stato() {
    return {
      ok: true,
      app: 'termoclino-server',
      versione: conf.versione,
      protocollo: PROTOCOLLO_VERSIONE,
      avviato,
      connessioni: connessioni.size,
      utenti: presenti.size,
      palestra: palestra.partita ? {
        partita: palestra.partita.id,
        battelli: palestra.partita.giocatori.size,
        ora_gioco: palestra.partita.ora,
        scala_tempo: palestra.partita.scala,
      } : null,
    };
  }

  await new Promise((risolvi, rifiuta_) => {
    http_.once('error', rifiuta_);
    http_.listen(conf.porta, conf.host, () => { http_.off('error', rifiuta_); risolvi(undefined); });
  });
  const indirizzo = http_.address();
  const porta = typeof indirizzo === 'object' && indirizzo ? indirizzo.port : conf.porta;
  registro.info('in_ascolto', {
    host: conf.host, porta, versione: conf.versione, origini: conf.originiAmmesse, protocollo: PROTOCOLLO_VERSIONE,
    istantanee: conf.dirIstantanee, guardia_s: conf.guardiaSecondi, max_giocatori: conf.maxGiocatori,
  });

  return {
    porta,
    stato,
    palestra,
    /** Chiusura ordinata: si saluta chi e' a bordo, poi si spegne. */
    async chiudi(motivo = 'manutenzione') {
      clearInterval(battito);
      for (const c of connessioni) {
        manda(c, DAL_SERVER.ADDIO, { motivo });
        c.ws.close(1001, motivo);
      }
      await new Promise((r) => wss.close(() => r(undefined)));
      await new Promise((r) => http_.close(() => r(undefined)));
      await palestra.chiudi();
      registro.info('spento', { motivo });
    },
  };
}

/**
 * L'IP del client. Dietro Apache la connessione arriva da 127.0.0.1 e il vero
 * indirizzo sta in X-Forwarded-For; ci si fida dell'intestazione SOLO se la
 * connessione viene dalla macchina stessa, altrimenti chiunque potrebbe
 * dichiararsi chi vuole.
 * @param {import('node:http').IncomingMessage} req
 */
function ipDi(req) {
  const diretto = req.socket.remoteAddress ?? '';
  const locale = diretto === '127.0.0.1' || diretto === '::1' || diretto === '::ffff:127.0.0.1';
  const inoltrato = req.headers['x-forwarded-for'];
  if (locale && typeof inoltrato === 'string' && inoltrato !== '') {
    return inoltrato.split(',')[0].trim();
  }
  return diretto;
}
