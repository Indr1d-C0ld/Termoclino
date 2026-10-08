// @ts-check
/**
 * Il modello acustico analitico di F1 (livello C di docs/ricerca/05_acustica.md
 * §6.3): i termini dell'equazione del sonar passivo
 *
 *     SE = SL − TL − NL + DI − DT
 *
 * per banda, con i livelli SPETTRALI (dB re 1 µPa²/Hz) e la soglia di un
 * rivelatore d'energia riferita ai livelli spettrali, DT = 5·log10(d / (B·t)).
 * Le costanti assolute stanno in shared/data/acustica.json (con fonte e
 * confidenza), quelle relative nelle piattaforme; la taratura che ne esce e'
 * in docs/CALIBRAZIONE_F1.md.
 *
 * Due bande in F1, una per sensore, ciascuna centrata sulla frequenza di
 * riferimento del sensore nei dati (cosi' DI e fascio sono quelli dei file,
 * senza riscalature): la sfera a 2 kHz e l'antenna rimorchiata a 300 Hz. Una
 * banda media e una bassa bastano a dire le due cose che contano in F1: la
 * cavitazione si sente soprattutto in alto, il traffico e l'antenna vivono in
 * basso. Le righe tonali (F2) avranno le loro bande strette.
 */

import {
  CONFIDENZE,
  UNITA,
  chiaviFonte,
  isDato,
  leggiTesto,
  soloValori,
  visitaDati,
} from '../../../../shared/data/piattaforme.js';

/** @typedef {'sfera' | 'towed'} NomeBanda */
/** @typedef {import('../../../../shared/data/piattaforme.js').ValoriPiattaforma} ValoriPiattaforma */
/** @typedef {import('../world/ambiente.js').Ambiente} Ambiente */

/**
 * @typedef {object} ProfiloNave
 * @property {string} nome
 * @property {number} sl_10kt @property {number} pendenza @property {number} velocita_min
 * @property {number} quota_sorgente @property {number} aspetto_poppa @property {number} aspetto_prua
 * @property {number} velocita_max @property {number} diametro_tattico @property {number} accelerazione
 */

/**
 * @typedef {object} ValoriAcustica
 * @property {string} formato
 * @property {Record<NomeBanda, {centro: number, da: number, a: number, tempo_integrazione: number}>} bande
 * @property {{indice_d: number, fondo_normalizzato: number, fluttuazione_sigma: number, fluttuazione_tau: number}} rivelazione
 * @property {{sl_rif: number, pendenza_spettro: number, frazione_cavitazione_bassa_frequenza: number,
 *   elica_sopra_chiglia: number, soffiaggio_emergenza: number, rumore_proprio_cavitazione: number}} sottomarini
 * @property {{pendenza_spettro: number, towed_base: number}} rumore_proprio
 * @property {{distanza_transizione_min: number, perdita_rimbalzo: number, angolo_radente: number,
 *   perdita_fondo_max: number, perdita_strato: number, strato_distanza_minima: number,
 *   strato_distanza_piena: number}} propagazione
 * @property {{sfera: {lobi_laterali: number}, towed: {lobi_laterali: number, allargamento_max: number,
 *   quota_velocita_lenta: number, rischio_danno: number, velocita_filare_max: number}}} sensori
 * @property {{cacciatorpediniere: ProfiloNave, mercantile: ProfiloNave,
 *   biologico: {nome: string, sl_sfera: number, sl_towed: number, quota: number,
 *   attiva_media: number, spenta_media: number, deriva: number}}} sorgenti
 */

export const FORMATO_ACUSTICA = 'termoclino-acustica/1';

/** Unita' ammesse nel file acustico: quelle delle piattaforme piu' i dB/km. */
const UNITA_ACUSTICA = new Set([...UNITA, 'dB/km']);

/**
 * Controlla il file acustico: ogni numero e' un dato con fonte, confidenza e
 * unita' canonica (le stesse regole di shared/data/SCHEMA.md).
 * @param {unknown} grezzi
 * @returns {string[]} errori
 */
export function validaAcustica(grezzi) {
  /** @type {string[]} */
  const errori = [];
  if (grezzi === null || typeof grezzi !== 'object') return ['il file non contiene un oggetto'];
  if (/** @type {any} */ (grezzi).formato !== FORMATO_ACUSTICA) errori.push(`formato atteso ${FORMATO_ACUSTICA}`);
  /** @param {unknown} n @param {string} p */
  const cammina = (n, p) => {
    if (typeof n === 'number') { errori.push(`${p}: numero senza provenienza`); return; }
    if (isDato(n)) return;
    if (n !== null && typeof n === 'object') for (const [k, f] of Object.entries(n)) cammina(f, p ? `${p}.${k}` : k);
  };
  cammina(grezzi, '');
  visitaDati(grezzi, (p, d) => {
    if (chiaviFonte(String(d.fonte ?? '')).length === 0) errori.push(`${p}: manca la fonte`);
    if (!CONFIDENZE.includes(/** @type {any} */ (d.confidenza))) errori.push(`${p}: confidenza non ammessa`);
    if (typeof d.valore === 'number' && !UNITA_ACUSTICA.has(String(d.unita))) errori.push(`${p}: unita' ${d.unita}`);
  });
  return errori;
}

/**
 * Carica e valida shared/data/acustica.json.
 * @returns {Promise<ValoriAcustica>}
 */
export async function caricaAcustica() {
  const testo = await leggiTesto(new URL('../../../../shared/data/acustica.json', import.meta.url));
  const grezzi = JSON.parse(testo);
  const errori = validaAcustica(grezzi);
  if (errori.length > 0) throw new TypeError(`acustica.json non valido:\n  ${errori.join('\n  ')}`);
  return /** @type {ValoriAcustica} */ (soloValori(grezzi));
}

// ---------------------------------------------------------------------------
// Somme e soglie
// ---------------------------------------------------------------------------

/**
 * Somma in potenza di livelli in dB.
 * @param {number} a @param {number} b
 */
export function sommaDb(a, b) {
  if (a === -Infinity) return b;
  if (b === -Infinity) return a;
  const m = Math.max(a, b);
  return m + 10 * Math.log10(1 + 10 ** ((Math.min(a, b) - m) / 10));
}

/**
 * Soglia di rivelazione di un rivelatore d'energia, riferita ai livelli
 * spettrali: DT = 5·log10(d / (B·t)). [URICK83], 05 §1.3.
 * @param {ValoriAcustica} ac
 * @param {NomeBanda} banda
 */
export function sogliaRivelazione(ac, banda) {
  const b = ac.bande[banda];
  return 5 * Math.log10(ac.rivelazione.indice_d / ((b.a - b.da) * b.tempo_integrazione));
}

// ---------------------------------------------------------------------------
// Sorgenti
// ---------------------------------------------------------------------------

/**
 * Velocita' d'innesco della cavitazione alla quota dell'elica (pressione
 * assoluta): V(d) = V_rif · √((d + 10,1) / (d_rif + 10,1)). SCHEMA.md §5.
 * @param {{velocita_rif: number, quota_rif: number}} cav
 * @param {number} quota m (dell'elica o della chiglia: vedi quota_rif)
 * @returns {number} kt
 */
export function velocitaCavitazione(cav, quota) {
  return cav.velocita_rif * Math.sqrt((Math.max(0, quota) + 10.1) / (cav.quota_rif + 10.1));
}

/**
 * Correzione d'aspetto: `prua` quando chi ascolta e' davanti, `poppa` dietro,
 * zero al traverso, raccordata col coseno.
 * @param {number} cosAspetto coseno dell'angolo fra la prua della sorgente e la direzione verso chi ascolta
 * @param {number} prua dB
 * @param {number} poppa dB
 */
export function correzioneAspetto(cosAspetto, prua, poppa) {
  return cosAspetto >= 0 ? prua * cosAspetto : -poppa * cosAspetto;
}

/**
 * Livello spettrale irradiato da un sottomarino nella banda, dB re 1 µPa²/Hz a
 * 1 m. SCHEMA.md §5 («Rumore irradiato») piu' il livello assoluto e la
 * pendenza dello spettro di acustica.json.
 * @param {ValoriPiattaforma} p
 * @param {ValoriAcustica} ac
 * @param {NomeBanda} banda
 * @param {number} velocita kt (modulo)
 * @param {boolean} cavitante
 * @param {number} cosAspetto
 */
export function livelloSottomarino(p, ac, banda, velocita, cavitante, cosAspetto) {
  const r = p.acustica.rumore_irradiato;
  const v = Math.abs(velocita);
  let sl = ac.sottomarini.sl_rif + r.gradino_sl0
    + r.pendenza * Math.log10(Math.max(v, r.velocita_min) / r.velocita_rif)
    + r.pendenza_extra * Math.max(0, v - r.soglia_pendenza_extra)
    + ac.sottomarini.pendenza_spettro * Math.log10(ac.bande[banda].centro / 1000);
  if (cavitante) {
    sl += p.acustica.cavitazione.salto * (banda === 'sfera' ? 1 : ac.sottomarini.frazione_cavitazione_bassa_frequenza);
  }
  return sl + correzioneAspetto(cosAspetto, r.aspetto_prua, r.aspetto_poppa);
}

/**
 * Livello spettrale di una nave di superficie (forma di Ross: 50·log v).
 * @param {ProfiloNave} n
 * @param {ValoriAcustica} ac
 * @param {NomeBanda} banda
 * @param {number} velocita kt
 * @param {number} cosAspetto
 */
export function livelloNave(n, ac, banda, velocita, cosAspetto) {
  return n.sl_10kt + n.pendenza * Math.log10(Math.max(Math.abs(velocita), n.velocita_min) / 10)
    + ac.sottomarini.pendenza_spettro * Math.log10(ac.bande[banda].centro / 1000)
    + correzioneAspetto(cosAspetto, n.aspetto_prua, n.aspetto_poppa);
}

// ---------------------------------------------------------------------------
// Rumore proprio
// ---------------------------------------------------------------------------

/**
 * Rumore proprio sui sensori di scafo (la sfera): NL(v) = NL_mach +
 * 10·log(1 + (v/v₀)^esp), spostato dalla banda di 1 kHz a quella del sensore,
 * piu' la cavitazione propria. SCHEMA.md §5.
 * @param {ValoriPiattaforma} p
 * @param {ValoriAcustica} ac
 * @param {number} velocita kt
 * @param {boolean} cavitante
 */
export function rumoreProprioSfera(p, ac, velocita, cavitante) {
  const rp = p.acustica.rumore_proprio;
  const v = Math.abs(velocita);
  return rp.livello_macchinario
    + ac.rumore_proprio.pendenza_spettro * Math.log10(ac.bande.sfera.centro / 1000)
    + 10 * Math.log10(1 + (v / rp.velocita_soglia_sfera) ** rp.esponente)
    + (cavitante ? ac.sottomarini.rumore_proprio_cavitazione : 0);
}

/**
 * Rumore proprio dell'antenna rimorchiata (flusso sull'antenna), banda 300 Hz.
 * @param {ValoriPiattaforma} p
 * @param {ValoriAcustica} ac
 * @param {number} velocita kt
 * @param {boolean} cavitante
 */
export function rumoreProprioTowed(p, ac, velocita, cavitante) {
  const rp = p.acustica.rumore_proprio;
  const v = Math.abs(velocita);
  return ac.rumore_proprio.towed_base
    + 10 * Math.log10(1 + (v / rp.velocita_soglia_rimorchiata) ** rp.esponente)
    + (cavitante ? ac.sottomarini.rumore_proprio_cavitazione / 2 : 0);
}

// ---------------------------------------------------------------------------
// Propagazione
// ---------------------------------------------------------------------------

/**
 * @typedef {{x: number, y: number, z: number}} Punto3
 */

/**
 * Perdita di trasmissione, livello C (05 §6.3):
 *   TL = 20·log min(r, r₀) + 10·log(max(r, r₀)/r₀) + α·r + β·(r − r₀)⁺ + L_strato
 * con r₀ la profondita' dell'acqua (la minima fra sorgente, ricevitore e punto
 * medio, PROGETTO §5.3), β la perdita per km dei rimbalzi sul fondo nel regime
 * cilindrico (05 §5.5), α l'assorbimento dell'ambiente alla frequenza della
 * banda, L_strato quando sorgente e ricevitore stanno da parti opposte dello
 * strato (raccordata a zero sotto strato_distanza_minima).
 *
 * @param {ValoriAcustica} ac
 * @param {Ambiente} amb
 * @param {number} f Hz
 * @param {Punto3} s sorgente (z positiva verso il basso)
 * @param {Punto3} r ricevitore
 * @returns {number} dB
 */
export function perditaTrasmissione(ac, amb, f, s, r) {
  const pr = ac.propagazione;
  const dx = r.x - s.x;
  const dy = r.y - s.y;
  const dz = r.z - s.z;
  const d = Math.max(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
  const h = Math.min(amb.profondita(s.x, s.y), amb.profondita(r.x, r.y), amb.profondita(s.x + dx / 2, s.y + dy / 2));
  const r0 = Math.max(pr.distanza_transizione_min, h);
  let tl = d <= r0 ? 20 * Math.log10(d) : 20 * Math.log10(r0) + 10 * Math.log10(d / r0);
  tl += amb.assorbimento(f) * d / 1000;
  if (d > r0) {
    const beta = Math.min(pr.perdita_fondo_max,
      pr.perdita_rimbalzo * Math.tan(pr.angolo_radente * Math.PI / 180) / (2 * Math.max(h, 1) / 1000));
    tl += beta * (d - r0) / 1000;
  }
  const strato = amb.strato(r.x, r.y);
  if (strato && (s.z < strato.quota) !== (r.z < strato.quota)) {
    const pieno = strato.perdita ?? pr.perdita_strato;
    const k = Math.min(1, Math.max(0, (d - pr.strato_distanza_minima) / (pr.strato_distanza_piena - pr.strato_distanza_minima)));
    tl += pieno * k;
  }
  return tl;
}

// ---------------------------------------------------------------------------
// Fascio e rilevamento
// ---------------------------------------------------------------------------

/**
 * Guadagno del fascio (dB, ≤ 0) a Δ gradi dall'asse del fascio: lobo
 * principale gaussiano (−3 dB a mezzo fascio) e inviluppo dei lobi laterali
 * che decresce di 20·log(Δ/fascio).
 * @param {number} delta gradi (con segno o no)
 * @param {number} fascio gradi, larghezza a −3 dB
 * @param {number} lobi dB (negativo)
 */
export function guadagnoFascio(delta, fascio, lobi) {
  const u = Math.abs(delta) / fascio;
  const principale = -12 * u * u;
  const laterali = lobi - 20 * Math.log10(Math.max(1, u));
  return principale > laterali ? principale : laterali;
}

/**
 * Errore di rilevamento (deviazione standard, gradi): regola R1, SCHEMA.md §5.
 * @param {number} se eccesso di segnale, dB
 * @param {number} fascio gradi
 * @param {number} coefficiente
 * @param {number} sigmaMin gradi
 */
export function sigmaRilevamento(se, fascio, coefficiente, sigmaMin) {
  return Math.max(sigmaMin, coefficiente * fascio * 10 ** (-se / 20));
}
