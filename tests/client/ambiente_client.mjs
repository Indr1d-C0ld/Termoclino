// Ambiente comune alle prove del client in Node: registra il gancio che porta i moduli comuni del
// browser (/assets/shared/) alla cartella shared/, e legge la grafica originale dal disco quando c'è.
//
// I moduli del client vanno importati DOPO questo file, con import() dinamico: i loro import statici
// si risolvono solo dopo che il gancio è registrato.
import { register } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

register('./risolvi_shared.mjs', import.meta.url);

export const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ORIGINALI = process.env.TERMOCLINO_ORIGINALI ?? path.join(RADICE, 'web', 'assets', 'originali');
export const CLIENT = path.join(RADICE, 'web', 'assets', 'js', 'client');

/** Gli asset estratti ci sono? (in un clone pubblico no: le prove che li usano si saltano) */
export const CI_SONO_ORIGINALI = existsSync(path.join(ORIGINALI, 'manifest.json'));
export const MOTIVO_SALTO = 'mancano gli asset originali: python3 tools/estrai/estrai688.py "<cartella del gioco>" --client';

/** Lettore dal disco con la stessa interfaccia di lettoreHttp. */
export const lettoreDisco = {
  json: async (p) => JSON.parse(readFileSync(path.join(ORIGINALI, p), 'utf8')),
  byte: async (p) => new Uint8Array(readFileSync(path.join(ORIGINALI, p))),
};

/** Importa un modulo del client per percorso relativo a web/assets/js/client. */
export function importa(rel) {
  return import(new URL(`file://${path.join(CLIENT, rel)}`).href);
}
