// @ts-check
/**
 * Configurazione del server di gioco, tutta da variabili d'ambiente.
 *
 * In esercizio le fornisce `docker compose` leggendo
 * /data/termoclino-config/server.env (scritto da deploy/00-bootstrap.sh, fuori
 * dal DocumentRoot). Nessun segreto nel codice e nessun valore di ripiego per
 * il segreto: senza, il server non parte.
 */

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
  };
}
