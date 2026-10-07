// @ts-check
/**
 * Protocollo fra client e server di gioco — versione 0 (F0).
 *
 * Questo modulo e' il contratto: lo importano il server Node e il client nel
 * browser, cosi' i due non possono divergere in silenzio. Nessuna API solo-Node:
 * la firma del biglietto si verifica con Web Crypto (`globalThis.crypto.subtle`),
 * che esiste in Node 20+ e in tutti i browser moderni.
 *
 * Regole di fondo (PROGETTO §6):
 *  - i messaggi sono oggetti JSON con un campo `t` (tipo);
 *  - il primo messaggio del client e' `ciao` con il biglietto rilasciato da PHP
 *    (mai nell'indirizzo del WebSocket: gli indirizzi finiscono nei log di Apache);
 *  - il server non manda MAI posizioni, rotte o identita' vere di altri battelli.
 *    In F0 non c'e' ancora un mondo, ma la regola si scrive dal primo giorno.
 */

/** Versione del protocollo. Il server rifiuta un client con versione diversa. */
export const PROTOCOLLO_VERSIONE = 0;

/** Dimensione massima di un messaggio, in byte (UTF-8). */
export const MESSAGGIO_MAX_BYTE = 16 * 1024;

/** Secondi concessi al client per presentare il biglietto dopo la connessione. */
export const ATTESA_CIAO_SECONDI = 10;

/** Tolleranza sugli orologi fra PHP e Node, in secondi. */
export const TOLLERANZA_OROLOGIO_SECONDI = 5;

/** Tipi di messaggio dal client al server. */
export const DAL_CLIENT = Object.freeze({
  CIAO: 'ciao',
  PING: 'ping',
});

/** Tipi di messaggio dal server al client. */
export const DAL_SERVER = Object.freeze({
  BENVENUTO: 'benvenuto',
  PONG: 'pong',
  ERRORE: 'errore',
  ADDIO: 'addio',
});

/** Codici d'errore. Stabili: il client li traduce, non mostra il testo grezzo. */
export const ERRORI = Object.freeze({
  MESSAGGIO_MALFORMATO: 'messaggio_malformato',
  MESSAGGIO_TROPPO_GRANDE: 'messaggio_troppo_grande',
  TIPO_SCONOSCIUTO: 'tipo_sconosciuto',
  VERSIONE: 'versione_protocollo',
  BIGLIETTO_ASSENTE: 'biglietto_assente',
  BIGLIETTO_NON_VALIDO: 'biglietto_non_valido',
  BIGLIETTO_SCADUTO: 'biglietto_scaduto',
  BIGLIETTO_GIA_USATO: 'biglietto_gia_usato',
  NON_PRESENTATO: 'non_presentato',
  TROPPO_IN_FRETTA: 'troppo_in_fretta',
  ORIGINE: 'origine_non_ammessa',
});

/**
 * @typedef {{v: number, uid: number, nome: string, ruolo: string, exp: number, nonce: string}} CaricoBiglietto
 * @typedef {{ok: true, carico: CaricoBiglietto} | {ok: false, errore: string}} EsitoBiglietto
 * @typedef {{t: string, [k: string]: unknown}} Messaggio
 * @typedef {{ok: true, messaggio: Messaggio} | {ok: false, errore: string}} EsitoDecodifica
 */

const codificatore = new TextEncoder();
const decodificatore = new TextDecoder('utf-8', { fatal: true });

/**
 * Decodifica e valida la forma minima di un messaggio in arrivo.
 * Non lancia mai: chi riceve dalla rete non deve poter far cadere il server.
 *
 * @param {string} testo
 * @returns {EsitoDecodifica}
 */
export function decodifica(testo) {
  if (typeof testo !== 'string') return { ok: false, errore: ERRORI.MESSAGGIO_MALFORMATO };
  if (codificatore.encode(testo).length > MESSAGGIO_MAX_BYTE) {
    return { ok: false, errore: ERRORI.MESSAGGIO_TROPPO_GRANDE };
  }
  /** @type {unknown} */
  let dato;
  try {
    dato = JSON.parse(testo);
  } catch {
    return { ok: false, errore: ERRORI.MESSAGGIO_MALFORMATO };
  }
  if (dato === null || typeof dato !== 'object' || Array.isArray(dato)) {
    return { ok: false, errore: ERRORI.MESSAGGIO_MALFORMATO };
  }
  const t = /** @type {Record<string, unknown>} */ (dato).t;
  if (typeof t !== 'string' || t.length === 0 || t.length > 32) {
    return { ok: false, errore: ERRORI.MESSAGGIO_MALFORMATO };
  }
  return { ok: true, messaggio: /** @type {Messaggio} */ (dato) };
}

/**
 * @param {string} t
 * @param {Record<string, unknown>} [campi]
 * @returns {string}
 */
export function codifica(t, campi = {}) {
  return JSON.stringify({ t, ...campi });
}

// --- Biglietto -----------------------------------------------------------------

/** @param {Uint8Array} byte */
export function b64urlCodifica(byte) {
  let binario = '';
  for (const b of byte) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * @param {string} testo
 * @returns {Uint8Array | null}
 */
export function b64urlDecodifica(testo) {
  if (!/^[A-Za-z0-9_-]*$/.test(testo)) return null;
  const base64 = testo.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (testo.length % 4)) % 4);
  try {
    const binario = atob(base64);
    const out = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) out[i] = binario.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * HMAC-SHA256 con Web Crypto.
 * @param {string} segreto
 * @param {string} testo
 * @returns {Promise<Uint8Array>}
 */
async function hmac(segreto, testo) {
  const sottile = globalThis.crypto?.subtle;
  if (!sottile) throw new Error('Web Crypto non disponibile');
  const chiave = await sottile.importKey('raw', codificatore.encode(segreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await sottile.sign('HMAC', chiave, codificatore.encode(testo)));
}

/**
 * Confronto a tempo costante: non rivela con la durata quanti byte coincidono.
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 */
function ugualiATempoCostante(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Firma un carico come fa `App\Gioco\Biglietto::firma()` in PHP.
 * Serve alle prove di compatibilita' e agli strumenti, non al server in esercizio.
 *
 * @param {Record<string, unknown>} carico
 * @param {string} segreto
 */
export async function firmaBiglietto(carico, segreto) {
  const corpo = b64urlCodifica(codificatore.encode(JSON.stringify(carico)));
  return corpo + '.' + b64urlCodifica(await hmac(segreto, corpo));
}

/**
 * Verifica un biglietto: firma, forma, versione, scadenza.
 * Il controllo del riuso (nonce) spetta a chi riceve, perche' richiede memoria.
 *
 * @param {unknown} biglietto
 * @param {string} segreto
 * @param {number} adessoSecondi  ora Unix in secondi
 * @returns {Promise<EsitoBiglietto>}
 */
export async function verificaBiglietto(biglietto, segreto, adessoSecondi) {
  if (typeof biglietto !== 'string' || biglietto === '') return { ok: false, errore: ERRORI.BIGLIETTO_ASSENTE };
  if (biglietto.length > 1024) return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };
  const parti = biglietto.split('.');
  if (parti.length !== 2) return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };
  const [corpo, sigillo] = parti;
  // Si confronta la GRAFIA canonica del sigillo, non i byte decodificati: in
  // base64 l'ultimo carattere porta bit di riempimento che la decodifica
  // ignora, e confrontando i byte lo stesso sigillo avrebbe piu' grafie valide
  // (trovato con una prova: 3 biglietti alterati su 64 passavano).
  const atteso = codificatore.encode(b64urlCodifica(await hmac(segreto, corpo)));
  if (!ugualiATempoCostante(atteso, codificatore.encode(sigillo))) return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };

  const corpoByte = b64urlDecodifica(corpo);
  if (!corpoByte) return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };
  /** @type {unknown} */
  let c;
  try {
    c = JSON.parse(decodificatore.decode(corpoByte));
  } catch {
    return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };
  }
  if (c === null || typeof c !== 'object') return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };
  const k = /** @type {Record<string, unknown>} */ (c);
  if (k.v !== 1
    || !Number.isInteger(k.uid) || /** @type {number} */ (k.uid) <= 0
    || typeof k.nome !== 'string' || k.nome === ''
    || typeof k.ruolo !== 'string'
    || !Number.isInteger(k.exp)
    || typeof k.nonce !== 'string' || !/^[0-9a-f]{16,64}$/.test(k.nonce)) {
    return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };
  }
  if (/** @type {number} */ (k.exp) + TOLLERANZA_OROLOGIO_SECONDI < adessoSecondi) {
    return { ok: false, errore: ERRORI.BIGLIETTO_SCADUTO };
  }
  return {
    ok: true,
    carico: {
      v: 1,
      uid: /** @type {number} */ (k.uid),
      nome: k.nome,
      ruolo: k.ruolo,
      exp: /** @type {number} */ (k.exp),
      nonce: k.nonce,
    },
  };
}
