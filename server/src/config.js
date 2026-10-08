// @ts-check
/**
 * Configurazione del server di gioco, tutta da variabili d'ambiente.
 *
 * In esercizio le fornisce `docker compose` leggendo
 * /data/termoclino-config/server.env (scritto da deploy/00-bootstrap.sh, fuori
 * dal DocumentRoot). Nessun segreto nel codice e nessun valore di ripiego per
 * il segreto: senza, il server non parte.
 */

import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * @typedef {object} Configurazione
 * @property {string} host
 * @property {number} porta
 * @property {string} segretoBiglietti
 * @property {string[]} originiAmmesse   vuoto = nessun controllo (solo sviluppo)
 * @property {number} messaggiAlSecondo
 * @property {number} raffica
 * @property {'debug'|'info'|'warn'|'error'} livelloLog
 * @property {string} versione
 * @property {string | null} dirIstantanee  cartella delle istantanee della verita' (null = non si registra)
 * @property {number} guardiaSecondi  quanto l'ufficiale di guardia tiene un battello senza linea, s reali
 * @property {number} maxGiocatori  battelli al massimo nella palestra
 */

/**
 * @param {Record<string, string | undefined>} env
 * @returns {Configurazione}
 */
export function leggiConfigurazione(env) {
  const segreto = env.TERMOCLINO_SEGRETO_BIGLIETTI ?? '';
  if (segreto.length < 32 || segreto.includes('CAMBIAMI')) {
    throw new Error('TERMOCLINO_SEGRETO_BIGLIETTI assente o troppo corto (almeno 32 caratteri)');
  }
  const porta = Number(env.TERMOCLINO_PORTA ?? '8095');
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error(`TERMOCLINO_PORTA non valida: ${env.TERMOCLINO_PORTA}`);
  }
  const livello = /** @type {Configurazione['livelloLog']} */ (env.TERMOCLINO_LOG ?? 'info');
  if (!['debug', 'info', 'warn', 'error'].includes(livello)) {
    throw new Error(`TERMOCLINO_LOG non valido: ${livello}`);
  }
  const guardia = Number(env.TERMOCLINO_GUARDIA_SECONDI ?? '300');
  if (!Number.isFinite(guardia) || guardia < 0) {
    throw new Error(`TERMOCLINO_GUARDIA_SECONDI non valido: ${env.TERMOCLINO_GUARDIA_SECONDI}`);
  }
  const maxGiocatori = Number(env.TERMOCLINO_PALESTRA_MAX ?? '8');
  if (!Number.isInteger(maxGiocatori) || maxGiocatori < 1 || maxGiocatori > 64) {
    throw new Error(`TERMOCLINO_PALESTRA_MAX non valido: ${env.TERMOCLINO_PALESTRA_MAX}`);
  }
  // Istantanee: in Docker una cartella su volume (vedi compose.yaml); fuori,
  // la cartella temporanea del sistema. "-" le spegne.
  const dir = env.TERMOCLINO_ISTANTANEE ?? join(tmpdir(), 'termoclino', 'istantanee');
  return {
    host: env.TERMOCLINO_HOST ?? '127.0.0.1',
    porta,
    segretoBiglietti: segreto,
    originiAmmesse: (env.TERMOCLINO_ORIGINI ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o !== ''),
    messaggiAlSecondo: Number(env.TERMOCLINO_MSG_AL_SECONDO ?? '20'),
    raffica: Number(env.TERMOCLINO_RAFFICA ?? '40'),
    livelloLog: livello,
    versione: env.TERMOCLINO_VERSIONE ?? 'sviluppo',
    dirIstantanee: dir === '-' || dir === '' ? null : dir,
    guardiaSecondi: guardia,
    maxGiocatori,
  };
}
