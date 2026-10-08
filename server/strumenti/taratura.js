// @ts-check
/**
 * Stampa la tabella delle portate di rivelazione del sonar di F1 (Markdown),
 * calcolata con il codice dei fotogrammi: e' la tabella di
 * docs/CALIBRAZIONE_F1.md.
 *
 *   node server/strumenti/taratura.js                 ambiente dello scenario torpex_palestra
 *   node server/strumenti/taratura.js --provvisorio   ambiente provvisorio (strato 60 m, 12 dB)
 *   ... [--strato 60] [--fondale 1000] [--mare 3]     per cambiare una voce
 */
import { parseArgs } from 'node:util';
import { caricaTutte } from '../../shared/data/piattaforme.js';
import { caricaAcustica } from '../src/sim/sensors/acustica.js';
import { ambienteProvvisorio } from '../src/sim/world/ambiente.js';
import { tabellaPortate } from '../src/sim/sensors/taratura.js';
import { caricaScenario } from '../src/match/scenario.js';

const { values } = parseArgs({
  options: {
    provvisorio: { type: 'boolean', default: false },
    strato: { type: 'string' },
    fondale: { type: 'string', default: '1000' },
    mare: { type: 'string' },
  },
});
const scenario = await caricaScenario('torpex_palestra');
/** @type {import('../src/sim/world/ambiente.js').OpzioniProvvisorio} */
const opzioni = values.provvisorio ? {} : { ...(scenario.ambiente ?? {}) };
opzioni.fondale = Number(values.fondale);
if (values.strato !== undefined) opzioni.strato = values.strato === 'no' ? null : Number(values.strato);
if (values.mare !== undefined) opzioni.statoMare = Number(values.mare);
const amb = ambienteProvvisorio(opzioni);
const righe = tabellaPortate(await caricaAcustica(), amb, await caricaTutte());
const fmt = (/** @type {number} */ v) => (Number.isFinite(v) ? v.toFixed(1).replace('.', ',') : 'oltre 270');
const strato = amb.strato(0, 0);
console.log(`Ambiente: ${values.provvisorio ? 'provvisorio' : `scenario ${scenario.id} (${scenario.fonte})`}; fondale ${opzioni.fondale} m; ` +
  `strato ${strato ? `${strato.quota} m, ${strato.perdita ?? 'perdita di acustica.json'} dB` : 'assente'}; mare forza ${opzioni.statoMare ?? 3}; ` +
  `traffico ${opzioni.traffico ?? 0.5}; rumore ${amb.rumore(2000).toFixed(1)} dB a 2 kHz, ${amb.rumore(300).toFixed(1)} dB a 300 Hz.\n`);
console.log('| Caso | Sensore | kyd | miglia |');
console.log('|------|---------|----:|-------:|');
for (const r of righe) console.log(`| ${r.nome} | ${r.sensore} | ${fmt(r.kyd)} | ${fmt(r.nm)} |`);
