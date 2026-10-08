// @ts-check
/**
 * Istantanee della verita' su file: una riga JSON al secondo di gioco, piu'
 * gli eventi (ordini, ingressi, uscite), compresse in gzip. Sono il replay di
 * PROGETTO §4.3 («registrati, non ricalcolati») e il materiale del debriefing
 * con la verita'. Non escono MAI verso i client durante la partita.
 *
 * Il file e' <cartella>/<id partita>.jsonl.gz. La prima riga descrive la
 * partita (seme, scenario, versione del protocollo). Se la cartella non e'
 * scrivibile la partita continua senza registrazione e lo si dice nel
 * registro: un disco pieno non deve fermare chi sta giocando.
 */

import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createGzip } from 'node:zlib';

/** Righe fra due svuotamenti del compressore (circa un minuto di gioco). */
const RIGHE_PER_SVUOTARE = 64;

export class RegistroIstantanee {
  /**
   * @param {string} percorso file .jsonl.gz
   * @param {import('node:zlib').Gzip} gzip
   * @param {Promise<void>} finito
   */
  constructor(percorso, gzip, finito) {
    this.percorso = percorso;
    this._gzip = gzip;
    this._finito = finito;
    this.righe = 0;
    this.chiuso = false;
  }

  /**
   * Apre il file della partita.
   * @param {string} cartella
   * @param {string} id
   * @param {{warn: (e: string, d?: Record<string, unknown>) => void}} [registro]
   * @returns {Promise<RegistroIstantanee | null>}
   */
  static async apri(cartella, id, registro) {
    try {
      await mkdir(cartella, { recursive: true });
      const percorso = join(cartella, `${id}.jsonl.gz`);
      const file = createWriteStream(percorso, { flags: 'wx' });
      const gzip = createGzip({ level: 6 });
      gzip.pipe(file);
      const finito = new Promise((risolvi) => {
        file.on('close', () => risolvi(undefined));
        file.on('error', (e) => {
          registro?.warn('istantanee_errore', { percorso, errore: e.message });
          risolvi(undefined);
        });
      });
      await new Promise((risolvi, rifiuta) => {
        file.once('open', risolvi);
        file.once('error', rifiuta);
      });
      return new RegistroIstantanee(percorso, gzip, /** @type {Promise<void>} */ (finito));
    } catch (e) {
      registro?.warn('istantanee_disattivate', { cartella, errore: /** @type {Error} */ (e).message });
      return null;
    }
  }

  /**
   * @param {Record<string, unknown>} oggetto
   */
  scrivi(oggetto) {
    if (this.chiuso) return;
    this._gzip.write(JSON.stringify(oggetto) + '\n');
    this.righe++;
    // Ogni tanto si svuota il compressore: se il processo cade si perde al
    // piu' l'ultimo minuto, non la partita.
    if (this.righe % RIGHE_PER_SVUOTARE === 0) this._gzip.flush();
  }

  /** Chiude e svuota su disco. */
  async chiudi() {
    if (this.chiuso) return;
    this.chiuso = true;
    this._gzip.end();
    await this._finito;
  }
}
