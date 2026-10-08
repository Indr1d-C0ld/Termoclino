// @ts-check
/**
 * Attrezzi comuni alle prove del motore: dati caricati una volta, battelli e
 * partite in un ambiente provvisorio noto (fondale 1000 m, strato a 60 m,
 * mare forza 3), avanzamento a passi.
 */
import { caricaTutte } from '../../shared/data/piattaforme.js';
import { Generatore } from '../../shared/rng.js';
import { caricaAcustica } from '../src/sim/sensors/acustica.js';
import { ambienteProvvisorio } from '../src/sim/world/ambiente.js';
import { Battello } from '../src/sim/platform/battello.js';
import { Partita } from '../src/match/partita.js';
import { palestraProvvisoria } from '../src/match/scenario.js';
import { validaOrdine, contestoOrdini } from '../../shared/protocol.js';

export const piattaforme = await caricaTutte();
export const acustica = await caricaAcustica();
export const p688 = /** @type {import('../../shared/data/piattaforme.js').Piattaforma} */ (piattaforme.get('688'));
export const palfa = /** @type {import('../../shared/data/piattaforme.js').Piattaforma} */ (piattaforme.get('alfa'));

/** Area larga per gli ordini dei battelli isolati. */
export const AREA = { x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 };

/**
 * Un battello isolato.
 * @param {{piattaforma?: string, x?: number, y?: number, z?: number, rotta?: number, velocita?: number}} [o]
 */
export function battello(o = {}) {
  const p = /** @type {import('../../shared/data/piattaforme.js').Piattaforma} */ (piattaforme.get(o.piattaforma ?? '688'));
  return new Battello({
    id: 'b', nome: 'Prova', sigla: 'SSN-000', piattaforma: p.valori,
    x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 100, rotta: o.rotta ?? 0, velocita: o.velocita ?? 0,
    rng: new Generatore(7), acustica,
  });
}

/**
 * Esegue un ordine (validato come farebbe il server).
 * @param {Battello} b
 * @param {string} cosa
 * @param {unknown} valore
 */
export function ordina(b, cosa, valore) {
  const v = validaOrdine({ cosa, valore }, contestoOrdini(b.p));
  if (!v.ok) throw new Error(`ordine non valido: ${cosa} ${JSON.stringify(valore)} (${v.motivo})`);
  const r = b.ordina(v.ordine, AREA);
  if (r !== null) throw new Error(`ordine rifiutato: ${cosa} (${r})`);
}

/**
 * Fa avanzare un battello di `secondi`, chiamando `ogni` a ogni passo.
 * @param {Battello} b
 * @param {number} secondi
 * @param {import('../src/sim/world/ambiente.js').Ambiente} [amb]
 * @param {(t: number) => void} [ogni]
 */
export function avanza(b, secondi, amb = ambienteProvvisorio(), ogni) {
  const n = Math.round(secondi * 10);
  for (let i = 0; i < n; i++) {
    b.passo(0.1, amb);
    ogni?.((i + 1) / 10);
  }
}

/**
 * Una partita della palestra provvisoria.
 * @param {number | string} seme
 * @param {import('../src/sim/world/ambiente.js').OpzioniProvvisorio} [opzAmb]
 * @param {import('../src/match/istantanee.js').RegistroIstantanee | null} [istantanee]
 */
export function partita(seme, opzAmb = {}, istantanee = null) {
  return new Partita({
    id: `prova-${seme}`, seme, scenario: palestraProvvisoria(), ambiente: ambienteProvvisorio(opzAmb),
    acustica, piattaforme, istantanee,
  });
}

/**
 * Raccoglitore di messaggi per un giocatore in-process.
 */
export function raccoglitore() {
  /** @type {Array<Record<string, any>>} */
  const messaggi = [];
  return {
    messaggi,
    /** @param {string} t @param {Record<string, unknown>} campi */
    invia: (t, campi) => { messaggi.push({ t, ...campi }); },
    /** @param {string} t */
    di: (t) => messaggi.filter((m) => m.t === t),
  };
}
