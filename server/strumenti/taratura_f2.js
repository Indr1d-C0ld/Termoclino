// @ts-check
/**
 * Stampa le tabelle dei sensori di F2 per docs/CALIBRAZIONE_F2.md (sezioni
 * dei sensori): banda stretta contro banda larga, attivo contro
 * intercettazione, ottica, ESM, stadimetro.
 *
 *   node server/strumenti/taratura_f2.js                       analitico di F1, fondale 200 m, estate di TORPEX
 *   node server/strumenti/taratura_f2.js --fondale 1000        acqua profonda
 *   node server/strumenti/taratura_f2.js --tabelle --fondale 190
 *                       la TL dalle tabelle del tracciatore di raggi dello scenario su un
 *                       fondale piatto di quella profondita' (come server/strumenti/taratura.js)
 */
import { parseArgs } from 'node:util';
import { caricaTutte } from '../../shared/data/piattaforme.js';
import { caricaAcustica } from '../src/sim/sensors/acustica.js';
import { ambienteProvvisorio } from '../src/sim/world/ambiente.js';
import { caricaScenario } from '../src/match/scenario.js';
import { caricaPropagazione } from '../src/sim/world/propagazione.js';
import { eccessoAllaDistanza } from '../src/sim/sensors/taratura.js';
import {
  CASI_BANDA_STRETTA, eccessoAttivo, eccessoBandaStretta, erroreStadimetro, portata, portataEsm, portateOttiche, rigaMigliore,
} from '../src/sim/sensors/taratura_f2.js';
import { orizzonteRadio } from '../src/sim/sensors/radio.js';

const { values } = parseArgs({
  options: {
    fondale: { type: 'string', default: '200' },
    tabelle: { type: 'boolean', default: false },
    mare: { type: 'string' },
  },
});
const scenario = await caricaScenario('torpex_palestra');
/** @type {import('../src/sim/world/ambiente.js').OpzioniProvvisorio} */
const opzioni = { ...(scenario.ambiente ?? {}), fondale: Number(values.fondale) };
if (values.mare !== undefined) opzioni.statoMare = Number(values.mare);
const amb = ambienteProvvisorio(opzioni);
if (values.tabelle) {
  const fondale = Number(values.fondale);
  const p = await caricaPropagazione('torpex_palestra', { fondale: () => fondale });
  if (!p) throw new Error('lo scenario non ha tabelle di propagazione');
  amb.propagazione = p;
}
const ac = await caricaAcustica();
const piattaforme = await caricaTutte();
const statoMare = opzioni.statoMare ?? 3;
const kyd = (/** @type {number} */ m) => (Number.isFinite(m) ? (m / 914.4).toFixed(1).replace('.', ',') : 'oltre');
const nm = (/** @type {number} */ m) => (Number.isFinite(m) ? (m / 1852).toFixed(1).replace('.', ',') : 'oltre');

console.log(`Ambiente: estate di TORPEX (strato ${amb.strato(0, 0)?.quota ?? '—'} m), fondale ${opzioni.fondale} m, mare forza ${statoMare}; ` +
  `TL ${values.tabelle ? 'dalle tabelle di propagazione' : 'analitica di F1'}.\n`);

console.log('### Banda stretta (riga piu\' forte, antenna) contro banda larga\n');
console.log('| Caso | Antenna, righe: kyd | nm | riga (Hz) | Sfera, banda larga: kyd | Antenna, banda larga: kyd | Antenna righe / sfera |');
console.log('|------|----:|----:|----:|----:|----:|----:|');
for (const c of CASI_BANDA_STRETTA) {
  const a = { ascoltatore: c.ascoltatore, bersaglio: c.bersaglio, ac, amb, piattaforme };
  const rNb = portata(eccessoBandaStretta(a));
  const riga = rigaMigliore(a, Math.max(100, rNb * 0.98));
  const rSf = portata(eccessoAllaDistanza({ ...a, ascoltatore: { ...c.ascoltatore, sensore: 'sfera' } }));
  const rTb = portata(eccessoAllaDistanza({ ...a, ascoltatore: { ...c.ascoltatore, sensore: 'towed' } }));
  console.log(`| ${c.nome} | ${kyd(rNb)} | ${nm(rNb)} | ${riga ? riga.f.toFixed(0) : '—'} | ${kyd(rSf)} | ${kyd(rTb)} | ${rSf > 0 ? (rNb / rSf).toFixed(2).replace('.', ',') : '—'} |`);
}

console.log('\n### Sonar attivo: eco contro intercettazione\n');
console.log('| Chi pinga | Bersaglio (ascolta con il suo intercettatore) | Ping | Eco, senza moto radiale: kyd | Eco, avvicinamento 10 kt: kyd | Intercettazione: kyd | nm | Intercettazione / eco |');
console.log('|-----------|-----------|------|----:|----:|----:|----:|----:|');
/** @type {[string, number, import('../src/sim/sensors/taratura.js').Bersaglio, string][]} */
const casiAttivo = [
  ['688', 150, { tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 150 }, '688 a 150 m'],
  ['688', 150, { tipo: 'sottomarino', piattaforma: 'alfa', velocita: 5, quota: 150 }, 'Alfa a 150 m'],
  ['alfa', 150, { tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 150 }, '688 a 150 m'],
  ['688', 150, { tipo: 'nave', classe: 'cacciatorpediniere', velocita: 10 }, 'cacciatorpediniere'],
];
for (const [chi, quota, b, nome] of casiAttivo) {
  for (const [p, puntato] of /** @type {const} */ ([['corta', true], ['lunga', true], ['lunga', false]])) {
    const e = eccessoAttivo({ pingatore: chi, quota, bersaglio: b, portata: p, puntato, ac, amb, statoMare, piattaforme });
    const e2 = eccessoAttivo({ pingatore: chi, quota, bersaglio: b, portata: p, puntato, ac, amb, statoMare, piattaforme, rottaBersaglio: 180 });
    const rEco = portata((r) => e.eco(r));
    const rEco2 = portata((r) => e2.eco(r));
    const rInt = b.tipo === 'sottomarino' ? portata((r) => e.intercetto(r)) : NaN;
    console.log(`| ${chi} | ${nome} | ${p}, ${puntato ? 'fascio' : 'settore'} | ${kyd(rEco)} | ${kyd(rEco2)} | ${Number.isNaN(rInt) ? '—' : kyd(rInt)} | ${Number.isNaN(rInt) ? '—' : nm(rInt)} | ${Number.isNaN(rInt) ? '—' : (rInt / Math.max(rEco, rEco2)).toFixed(1).replace('.', ',')} |`);
  }
}

console.log('\n### Periscopio\n');
console.log('| Nave | Luce, mare | Sagoma: nm | Luci: nm | Stadimetro (linea d\'acqua): kyd | Testa d\'albero sull\'orizzonte: nm |');
console.log('|------|------|----:|----:|----:|----:|');
const p688 = /** @type {import('../../shared/data/piattaforme.js').Piattaforma} */ (piattaforme.get('688'));
for (const firma of ['forrest_sherman', 'mercantile_generico']) {
  for (const [notte, mare] of /** @type {const} */ ([[false, 3], [false, 5], [true, 3]])) {
    const o = portateOttiche(ac, p688, firma, notte, mare);
    console.log(`| ${firma} | ${notte ? 'notte' : 'giorno'}, forza ${mare} | ${nm(o.sagoma)} | ${notte ? nm(o.luci) : '—'} | ${kyd(o.stadimetro)} | ${nm(o.orizzonte_testa)} |`);
  }
}
for (const firma of ['forrest_sherman', 'mercantile_generico']) {
  const e = erroreStadimetro(ac, p688, firma, 2000, `taratura:${firma}`);
  console.log(`\nStadimetro sul ${firma} (classe giusta, 2000 letture fra 1 km e la linea d'acqua): entro ±7 % il ${(100 * e.entro7).toFixed(1)} %, ` +
    `errore medio ${(100 * e.media).toFixed(2)} %, σ ${(100 * e.sigma).toFixed(2)} %.`);
}

console.log('\n### ESM\n');
console.log('| Radar | Banda | ESM | Portata: nm | Orizzonte radio: nm |');
console.log('|-------|-------|-----|----:|----:|');
/** @type {[string, import('../../shared/data/firme.js').Radar][]} */
const radar = [];
for (const r of ac.firme.forrest_sherman.emettitori ?? []) radar.push(['cacciatorpediniere', r]);
for (const r of ac.firme.mercantile_generico.emettitori ?? []) radar.push(['mercantile', r]);
for (const id of ['688', 'alfa']) {
  const r = /** @type {any} */ (piattaforme.get(id)?.valori.sensori.radar);
  radar.push([id, { nome: r.nome, banda: r.banda, frequenza: r.frequenza, potenza_picco: r.potenza_picco, guadagno: r.guadagno, fascio: r.fascio, periodo: r.periodo, altezza: r.altezza }]);
}
for (const [chi, r] of radar) {
  for (const id of ['688', 'alfa']) {
    const esm = /** @type {any} */ (piattaforme.get(id)?.valori.sensori.esm);
    const d = portataEsm(ac, r, esm);
    console.log(`| ${chi}: ${r.nome} | ${r.banda} | ${id} | ${nm(d)} | ${nm(orizzonteRadio(r.altezza, esm.altezza, ac.radio.raggio_terra_equivalente))} |`);
  }
}
