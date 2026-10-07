// @ts-check
/**
 * Termoclino — server di gioco. Punto d'ingresso.
 *
 *   TERMOCLINO_SEGRETO_BIGLIETTI=... node server/src/main.js
 *
 * In esercizio gira nel contenitore descritto da server/compose.yaml.
 */

import { leggiConfigurazione } from './config.js';
import { creaRegistro } from './registro.js';
import { avviaCancello } from './gateway.js';

let conf;
try {
  conf = leggiConfigurazione(process.env);
} catch (e) {
  process.stderr.write(`Configurazione non valida: ${/** @type {Error} */ (e).message}\n`);
  process.exit(1);
}

const registro = creaRegistro(conf.livelloLog);
const cancello = await avviaCancello(conf, registro);

let inChiusura = false;
for (const segnale of /** @type {const} */ (['SIGTERM', 'SIGINT'])) {
  process.on(segnale, async () => {
    if (inChiusura) return;
    inChiusura = true;
    registro.info('segnale', { segnale });
    await cancello.chiudi('manutenzione');
    process.exit(0);
  });
}

process.on('unhandledRejection', (motivo) => {
  registro.error('promessa_non_gestita', { motivo: String(motivo) });
});
