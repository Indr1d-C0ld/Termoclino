// @ts-check
/**
 * Traduzione dei messaggi: catalogo per lingua, segnaposto con formati, ripiego sull'italiano e,
 * per una chiave che nessun catalogo conosce, la chiave stessa resa leggibile (meglio un messaggio
 * brutto nel nastro che un messaggio perso).
 *
 * Formati dei segnaposto ({nome|formato}):
 *   piedi    metri → piedi interi          iarde    metri → iarde intere
 *   gradi    tre cifre (045)               nodi     un decimale
 *   ordinale indice da 0 → numero da 1     oppure   « O 135» se c'è un rilevamento speculare, se no niente
 *   macchina, lato, verso, sensore, transitorio: parole del catalogo (fmt.<formato>.<valore>)
 *   classe   nome della classe del libro (classe.<valore>)
 *   percento confidenza 0-1 (o già 0-100) → intero
 *   contatto « (S1)» se c'è una designazione, se no niente
 *   kyd      metri → kiloiarde con un decimale
 */
import it from './it.js';
import en from './en.js';
import { metriInPiedi, metriInIarde, metriInKiloiarde, normalizza360 } from '../../../shared/units.js';
import { perIlFont } from '../resa/testo.js';

/** @type {Record<string, Record<string, string>>} */
export const CATALOGHI = { it, en };
export const LINGUA_PREDEFINITA = 'it';

/** @param {unknown} v */
function gradi(v) {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(normalizza360(n)) % 360).padStart(3, '0') : String(v);
}

/**
 * @param {Record<string, string>} cat
 * @param {string} formato
 * @param {unknown} v
 */
function formatta(cat, formato, v) {
  const n = typeof v === 'number' ? v : Number(v);
  const parola = (/** @type {string} */ k) => cat[k] ?? it[k];
  switch (formato) {
    case 'piedi':
      return Number.isFinite(n) ? String(Math.round(metriInPiedi(n))) : String(v);
    case 'iarde':
      return Number.isFinite(n) ? String(Math.round(metriInIarde(n) / 10) * 10) : String(v);
    case 'gradi':
      return gradi(v);
    case 'nodi':
      return Number.isFinite(n) ? n.toFixed(1) : String(v);
    case 'ordinale':
      return Number.isFinite(n) ? String(n + 1) : String(v);
    case 'oppure':
      return v === null || v === undefined || v === '' ? '' : ` ${parola('fmt.oppure') ?? 'O'} ${gradi(v)}`;
    case 'macchina':
    case 'lato':
    case 'verso':
    case 'sensore':
    case 'transitorio':
      return parola(`fmt.${formato}.${v}`) ?? String(v).toUpperCase();
    case 'classe':
      return parola(`classe.${v}`) ?? perIlFont(String(v).replace(/_/g, ' '));
    case 'percento':
      return Number.isFinite(n) ? String(Math.round(n <= 1 ? n * 100 : n)) : String(v);
    case 'contatto':
      return v === null || v === undefined || v === '' ? '' : ` (${perIlFont(String(v))})`;
    case 'kyd':
      return Number.isFinite(n) ? metriInKiloiarde(n).toFixed(1) : String(v);
    default:
      return String(v);
  }
}

/**
 * Testo di una chiave con i parametri.
 * @param {string} lingua 'it' | 'en'
 * @param {string} chiave per esempio 'sonar.nuovo_contatto'
 * @param {Record<string, unknown>} [parametri]
 */
export function traduci(lingua, chiave, parametri = {}) {
  const cat = CATALOGHI[lingua] ?? CATALOGHI[LINGUA_PREDEFINITA];
  const modello = cat[chiave] ?? CATALOGHI[LINGUA_PREDEFINITA][chiave];
  if (modello === undefined) {
    // chiave sconosciuta: si mostra comunque, leggibile
    const nuda = chiave.replace(/^[a-z]+\./, '').replace(/_/g, ' ').toUpperCase();
    const extra = Object.values(parametri).filter((v) => typeof v === 'number' || typeof v === 'string').join(' ');
    return extra ? `${nuda} ${extra}` : nuda;
  }
  return modello.replace(/\{([a-z_0-9]+)(?:\|([a-z_]+))?\}/gi, (_, nome, formato) => {
    const v = parametri[nome];
    if (formato === 'oppure' || formato === 'sensore' || formato === 'contatto') return formatta(cat, formato, v);
    if (v === undefined || v === null) return '';
    return formato ? formatta(cat, formato, v) : String(v);
  });
}

/**
 * La frase con cui l'equipaggio ripete un ordine accettato (`ricevuto {cosa, valore}`), come chiave
 * del catalogo e parametri; null se per quell'ordine non si dice niente (l'antenna rimorchiata ha i
 * suoi rapporti dal server).
 * @param {string} cosa @param {unknown} valore
 * @returns {{ chiave: string, parametri: Record<string, unknown>, chi: string } | null}
 */
export function frasePerRicevuto(cosa, valore) {
  const v = /** @type {any} */ (valore);
  switch (cosa) {
    case 'macchina':
      return { chiave: 'ricevuto.macchina', parametri: { valore: v }, chi: 'macchina' };
    case 'timone':
      return v === 0
        ? { chiave: 'ricevuto.timone_zero', parametri: {}, chi: 'timone' }
        : { chiave: 'ricevuto.timone', parametri: { gradi: Math.abs(v), lato: v > 0 ? 'dritta' : 'sinistra' }, chi: 'timone' };
    case 'timoni_o':
      return v === 0
        ? { chiave: 'ricevuto.timoni_o_zero', parametri: {}, chi: 'timone' }
        : { chiave: 'ricevuto.timoni_o', parametri: { gradi: Math.abs(v), verso: v > 0 ? 'scendere' : 'salire' }, chi: 'timone' };
    case 'quota':
      if (typeof v === 'string') return { chiave: `ricevuto.quota_${v}`, parametri: {}, chi: 'timone' };
      return { chiave: 'ricevuto.quota', parametri: { valore: v }, chi: 'timone' };
    case 'rotta':
      return { chiave: 'ricevuto.rotta', parametri: { valore: v }, chi: 'timone' };
    case 'waypoint':
      if (v?.azione === 'aggiungi') return { chiave: 'ricevuto.waypoint', parametri: {}, chi: 'navigazione' };
      if (v?.azione === 'svuota') return { chiave: 'ricevuto.waypoint_svuota', parametri: {}, chi: 'navigazione' };
      return null;
    case 'autopilota':
      return { chiave: v ? 'ricevuto.autopilota_si' : 'ricevuto.autopilota_no', parametri: {}, chi: 'navigazione' };
    case 'scala_tempo':
      return { chiave: 'ricevuto.scala_tempo', parametri: { valore: v }, chi: '' };
    case 'pausa':
      return { chiave: v ? 'ricevuto.pausa_si' : 'ricevuto.pausa_no', parametri: {}, chi: '' };
    // v2
    case 'assistenza':
      return { chiave: 'ricevuto.assistenza', parametri: { valore: v }, chi: '' };
    case 'analizzatore':
      if (v === null || v === undefined) return { chiave: 'ricevuto.analizzatore_spento', parametri: {}, chi: 'sonar' };
      if (v.contatto) return { chiave: 'ricevuto.analizzatore_contatto', parametri: { contatto: v.contatto }, chi: 'sonar' };
      return { chiave: 'ricevuto.analizzatore_rilevamento', parametri: { rilevamento: v.rilevamento, sensore: v.sensore }, chi: 'sonar' };
    case 'attivo':
      return { chiave: 'ricevuto.attivo', parametri: {}, chi: 'sonar' };
    case 'albero':
      return { chiave: `ricevuto.albero_${v?.quale}_${v?.alzato ? 'su' : 'giu'}`, parametri: {}, chi: 'guardia' };
    case 'radar':
      return { chiave: v ? 'ricevuto.radar_si' : 'ricevuto.radar_no', parametri: {}, chi: 'guardia' };
    case 'designa':
      return v ? { chiave: 'ricevuto.designa', parametri: { contatto: v }, chi: '' } : { chiave: 'ricevuto.designa_nessuno', parametri: {}, chi: '' };
    case 'classifica':
      return v?.classe
        ? { chiave: 'ricevuto.classifica', parametri: { contatto: v.contatto, classe: v.classe }, chi: '' }
        : { chiave: 'ricevuto.classifica_tolta', parametri: { contatto: v?.contatto }, chi: '' };
    case 'soluzione':
      return v?.cancella
        ? { chiave: 'ricevuto.soluzione_cancellata', parametri: { contatto: v.contatto }, chi: '' }
        : { chiave: 'ricevuto.soluzione', parametri: { contatto: v?.contatto }, chi: '' };
    case 'abbandona':
      return { chiave: 'ricevuto.abbandona', parametri: { contatto: v }, chi: 'sonar' };
    default:
      return null;
  }
}
