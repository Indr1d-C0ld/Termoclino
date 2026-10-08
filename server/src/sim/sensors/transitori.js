// @ts-check
/**
 * Transitori (F2): i rumori brevi che le entita' producono (shared/data/
 * piattaforme/*.json, acustica.transitori; scatti dei biologici in
 * shared/data/firme/biologico.json) e chi li sente.
 *
 * Per ogni transitorio e ogni sensore di ogni altro battello, con i termini
 * della banda larga di quel sensore (passivo.js: rumore, DI, ciechi, degrado):
 *
 *   SE = L(f_banda) − TL − NL + DI − 5·log10(d/(B·max(τ, τ_min))) − degrado + x
 *
 * con L il livello del transitorio portato al centro della banda (spettro di
 * Ross), B la larghezza della banda, τ la durata, x la fluttuazione della
 * coppia sul sensore a banda larga (la stessa propagazione). Chi lo sente lo
 * riceve all'ora d'arrivo (un percorso, 1500 m/s): un messaggio `transitorio`
 * per sensore e un rapporto del sonarista; il tipo lo riconosce sopra la
 * soglia di riconoscimento, altrimenti «sconosciuto».
 */

import { normalizza180, normalizza360 } from '../../../../shared/units.js';
import { rilevamento } from '../../../../shared/geo.js';
import { sigmaRilevamento, spostamentoSpettro } from './acustica.js';
import { perdita } from './perdita.js';

/** @typedef {import('./acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../world/ambiente.js').Ambiente} Ambiente */
/** @typedef {import('./passivo.js').SensorePassivo} SensorePassivo */
/** @typedef {import('../platform/battello.js').Battello} Battello */
/** @typedef {import('../platform/battello.js').Transitorio} Transitorio */
/** @typedef {import('./attivo.js').Consegna} Consegna */
/** @typedef {import('../../../../shared/rng.js').Generatore} Generatore */

/**
 * @typedef {object} Ascoltatore
 * @property {Battello} b
 * @property {{sfera: SensorePassivo, towed: SensorePassivo}} sensori
 */

/**
 * Raccoglie i transitori nati nell'ultimo secondo e calcola chi li sente.
 * @param {object} a
 * @param {number} a.ora  s di gioco
 * @param {{id: string, transitoriNuovi?: Transitorio[], posizioneAcustica: () => {x: number, y: number, z: number}}[]} a.entita
 * @param {Ascoltatore[]} a.ascoltatori
 * @param {ValoriAcustica} a.ac
 * @param {Ambiente} a.amb
 * @param {Generatore} a.rng
 * @returns {{consegne: (Consegna & {sensore: 'sfera' | 'towed', rilevamento: number})[], diario: Record<string, unknown>[]}}
 */
export function ascoltaTransitori(a) {
  const { ora, ac, amb, rng } = a;
  const c = ac.attivo.velocita_suono;
  const tMin = ac.transitori.tempo_integrazione_minimo;
  const soglia = ac.transitori.soglia_riconoscimento;
  const d0 = ac.rivelazione.indice_d;
  /** @type {(Consegna & {sensore: 'sfera' | 'towed', rilevamento: number})[]} */
  const consegne = [];
  /** @type {Record<string, unknown>[]} */
  const diario = [];
  for (const e of a.entita) {
    const nuovi = e.transitoriNuovi;
    if (!nuovi || nuovi.length === 0) continue;
    const lista = nuovi.splice(0);
    const ps = e.posizioneAcustica();
    for (const t of lista) {
      diario.push({ evento: 'transitorio', sorgente: e.id, tipo: t.tipo, livello: t.livello });
      for (const asc of a.ascoltatori) {
        if (asc.b === /** @type {unknown} */ (e)) continue;
        /** @type {{sensore: 'sfera' | 'towed', se: number, misurato: number, speculare: number | null, d: number} | null} */
        let migliore = null;
        /** @type {(Consegna & {sensore: 'sfera' | 'towed', rilevamento: number})[]} */
        const sentiti = [];
        for (const nome of /** @type {const} */ (['sfera', 'towed'])) {
          const s = asc.sensori[nome];
          const g = s.geometria(amb);
          if (!g || g.sorda) continue;
          const theta = rilevamento(g.pos, ps);
          const rel = normalizza180(theta - g.asse);
          if (nome === 'towed') {
            if (Math.abs(rel) < (asc.b.p.sensori.rimorchiata.cieco_prua ?? 20)) continue;
          } else if (Math.abs(normalizza180(rel - 180)) < (asc.b.p.sensori.sfera.arco_baffles ?? 60) / 2) {
            continue;
          }
          const banda = ac.bande[nome];
          const d = Math.max(1, Math.hypot(ps.x - g.pos.x, ps.y - g.pos.y, ps.z - g.pos.z));
          const x = s.fluttuazioni.get(e.id)?.x ?? 0;
          const dt = 5 * Math.log10(d0 / ((banda.a - banda.da) * Math.max(t.durata, tMin)));
          const se = t.livello + spostamentoSpettro(ac, banda.centro) - perdita(ac, amb, banda.centro, ps, g.pos, nome)
            - g.nl + s.di - dt - g.degrado + x;
          if (se < 0) continue;
          const sigma = sigmaRilevamento(se, s.fascio, s.coefficiente, s.sigmaMin);
          const misurato = normalizza360(theta + sigma * rng.gaussiana());
          const speculare = nome === 'towed' ? Math.round(normalizza360(2 * g.asse - misurato)) % 360 : null;
          const ril = Math.round(misurato) % 360;
          const arrivo = Math.round((ora + d / c) * 10) / 10;
          const tipo = se >= soglia ? t.tipo : 'sconosciuto';
          sentiti.push({
            ora: arrivo, a: asc.b, tipo: 'transitorio', sensore: nome, rilevamento: ril,
            campi: { ora: arrivo, sensore: nome, rilevamento: ril, speculare, tipo, forza: Math.round(se) },
            rapporto: null, diario: [],
          });
          if (!migliore || se > migliore.se) migliore = { sensore: nome, se, misurato: ril, speculare, d };
        }
        if (!migliore || sentiti.length === 0) continue;
        // Un rapporto solo (dal sensore che lo sente meglio) e la controscoperta nel diario.
        const primo = /** @type {Consegna & {sensore: 'sfera' | 'towed', rilevamento: number}} */ (
          sentiti.find((x) => x.sensore === /** @type {any} */ (migliore).sensore));
        primo.rapporto = {
          chi: 'sonar', chiave: 'sonar.transitorio',
          parametri: { contatto: null, sensore: migliore.sensore, tipo: migliore.se >= soglia ? t.tipo : 'sconosciuto', rilevamento: migliore.misurato },
        };
        primo.diario = [{
          ora: primo.ora, evento: 'controscoperta', ascoltatore: asc.b.id, sorgente: e.id, causa: 'transitorio',
          distanza_vera: migliore.d, sensore: migliore.sensore, tipo: t.tipo,
        }];
        consegne.push(...sentiti);
      }
    }
  }
  return { consegne, diario };
}
