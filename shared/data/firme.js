// @ts-check
/**
 * Caricatore delle firme (shared/data/firme/*.json): navi di superficie,
 * mercantili e sorgenti biologiche, cioe' tutto cio' che fa rumore (e luce, e
 * onde radio) senza essere un sottomarino giocabile. Formato
 * `termoclino-firma/1`, descritto in shared/data/SCHEMA.md §8; stesse regole
 * di provenienza delle piattaforme (ogni numero e' un dato con fonte e
 * confidenza), stesso caricatore nel server e nel browser.
 *
 * La «biblioteca delle firme» (`biblioteca()`) mette insieme piattaforme e
 * firme in una vista uniforme per classe: righe tonali, righe che seguono i
 * giri, pale e assi, altezza d'albero, sagoma, radar. E' il «libro» che
 * l'equipaggio usa per classificare (PROGETTO §5.6, ricerca 04 §4.6.4) e che
 * il client mostra al giocatore che classifica da se': contiene solo dati di
 * classe, mai lo stato di un'entita' in partita.
 */

import { soloValori, validaPiattaforma, visitaDati, leggiTesto } from './piattaforme.js';

/** Identificativi delle firme disponibili. */
export const FIRME = Object.freeze(/** @type {const} */ (['forrest_sherman', 'mercantile_generico', 'biologico']));

/** Formato atteso nel campo `formato` dei file. */
export const FORMATO_FIRMA = 'termoclino-firma/1';

/**
 * Una riga tonale a frequenza fissa (macchinari, rete elettrica, pompe).
 * `sopra_banda_larga`: dB sopra lo spettro a banda larga della sorgente alla
 * stessa frequenza, nella cella di 1 Hz, alla velocita' di riferimento della
 * sorgente (5 kt i sottomarini, 10 kt le navi): il livello della riga e'
 * fisso, non segue la velocita'.
 * @typedef {object} RigaFissa
 * @property {string} nome
 * @property {string} [tipo]
 * @property {number} frequenza Hz
 * @property {number} sopra_banda_larga dB
 * @property {number} da_velocita kt
 * @property {number} a_velocita kt
 */

/**
 * Una riga che segue i giri dell'asse (ingranamento dei riduttori, accensioni
 * dei diesel): frequenza = per_giro · giri/60. `sopra_banda_larga` e' riferito
 * alla banda larga ATTUALE alla stessa frequenza (la riga sale con la velocita').
 * @typedef {object} RigaGiri
 * @property {string} nome
 * @property {string} [tipo]
 * @property {number} per_giro
 * @property {number} sopra_banda_larga dB
 * @property {number} da_velocita kt
 * @property {number} a_velocita kt
 */

/**
 * Righe di pala e d'asse, e modulazione del rumore (DEMON).
 * @typedef {object} Pale
 * @property {number} livello dB sopra la banda larga alla frequenza di pala, alla velocita' attuale
 * @property {number} armoniche n (fondamentale compresa)
 * @property {number} decremento dB per armonica
 * @property {number} livello_asse dB sopra la banda larga alla frequenza d'asse
 * @property {number} modulazione indice di modulazione senza cavitazione
 * @property {number} modulazione_cavitante indice con l'elica che cavita
 * @property {number} modulazione_asse frazione della modulazione di pala alla frequenza d'asse
 */

/**
 * Un radar (emettitore per l'ESM altrui, e radar proprio).
 * @typedef {object} Radar
 * @property {string} nome designazione (cio' che l'ESM riconosce)
 * @property {string} banda lettera NATO
 * @property {number} frequenza Hz
 * @property {number} potenza_picco kW
 * @property {number} guadagno dB
 * @property {number} fascio gradi, orizzontale a −3 dB
 * @property {number} periodo s, un giro d'antenna
 * @property {number} altezza m sopra il mare
 * @property {boolean} [acceso] trasmette (gli emettitori delle navi)
 * @property {number} [portata_rif] m: distanza a cui vede un bersaglio di 1000 m² (radar proprio)
 */

/**
 * @typedef {object} ValoriFirma
 * @property {string} formato
 * @property {string} id
 * @property {{nome: string, designazione?: string, tipo: 'nave' | 'biologico', categoria: string,
 *   nazione?: string, lato?: string}} identita
 * @property {{lunghezza: number, larghezza: number, pescaggio: number, dislocamento: number}} [dimensioni]
 * @property {{assi: number, elica_pale: number, giri_per_nodo: number, rete_elettrica?: number,
 *   potenza_asse?: number, velocita_max?: number, velocita_cavitazione?: number, cilindri?: number}} [propulsione]
 * @property {{profilo_banda_larga: string, velocita_rif: number, tonali: RigaFissa[], righe_giri: RigaGiri[],
 *   pale: Pale, forza_bersaglio: {prua_poppa: number, traverso: number}}} [acustica]
 * @property {{altezza_alberi: number, bordo_libero: number, sagoma: string, luci: boolean,
 *   velocita_scia: number}} [ottica]
 * @property {Radar[]} [emettitori]
 * @property {Record<string, SpecieBiologica>} [specie]
 */

/**
 * Una specie (o un gruppo) di sorgenti biologiche.
 * @typedef {object} SpecieBiologica
 * @property {string} nome
 * @property {{f_min: number, f_max: number, livello: number, durata_unita: number} | null} canto
 *   unita' del canto: righe che cambiano frequenza ogni `durata_unita` s
 * @property {{livello: number, durata: number, intervallo: number} | null} scatti
 *   treni di scatti: transitori `biologico`
 * @property {number} forza_bersaglio dB
 */

/**
 * Controlla un file di firma gia' letto (stesse regole delle piattaforme).
 * @param {unknown} grezzi
 * @returns {string[]} errori
 */
export function validaFirma(grezzi) {
  if (grezzi === null || typeof grezzi !== 'object' || Array.isArray(grezzi)) return ['il file non contiene un oggetto'];
  const g = /** @type {Record<string, unknown>} */ (grezzi);
  // validaPiattaforma controlla provenienza, unita' e intervalli di ogni dato;
  // si ignora il suo controllo del formato, che e' quello delle piattaforme.
  const errori = validaPiattaforma({ ...g, formato: 'termoclino-piattaforma/1' });
  if (g.formato !== FORMATO_FIRMA) errori.push(`formato atteso ${FORMATO_FIRMA}, trovato ${String(g.formato)}`);
  return errori;
}

/**
 * Una firma caricata e validata.
 */
export class Firma {
  /** @param {unknown} grezzi */
  constructor(grezzi) {
    const errori = validaFirma(grezzi);
    if (errori.length > 0) throw new TypeError(`firma non valida:\n  ${errori.join('\n  ')}`);
    /** @readonly */
    this.grezzi = congela(/** @type {Record<string, unknown>} */ (grezzi));
    /** @readonly @type {string} */
    this.id = /** @type {string} */ (this.grezzi.id);
    /** @readonly @type {ValoriFirma} */
    this.valori = congela(/** @type {ValoriFirma} */ (soloValori(grezzi)));
    /** @private @type {Map<string, import('./piattaforme.js').Dato>} */
    this._indice = new Map();
    visitaDati(this.grezzi, (p, d) => this._indice.set(p, d));
  }

  /**
   * Il dato completo a un percorso puntato ('ottica.altezza_alberi').
   * @param {string} percorso
   */
  provenienza(percorso) {
    return this._indice.get(percorso);
  }

  /** Tutti i dati con il loro percorso. */
  dati() {
    return [...this._indice.entries()];
  }
}

/**
 * @template T
 * @param {T} nodo
 * @returns {T}
 */
function congela(nodo) {
  if (nodo !== null && typeof nodo === 'object') {
    for (const figlio of Object.values(nodo)) congela(figlio);
    Object.freeze(nodo);
  }
  return nodo;
}

/**
 * URL del file di una firma.
 * @param {string} id
 * @returns {URL}
 */
export function urlFirma(id) {
  if (!(/** @type {readonly string[]} */ (FIRME)).includes(id)) throw new RangeError(`firma sconosciuta: ${id}`);
  return new URL(`./firme/${id}.json`, import.meta.url);
}

/**
 * @param {string} id
 * @returns {Promise<Firma>}
 */
export async function caricaFirma(id) {
  return new Firma(JSON.parse(await leggiTesto(urlFirma(id))));
}

/**
 * Tutte le firme note.
 * @returns {Promise<Map<string, Firma>>}
 */
export async function caricaFirme() {
  const elenco = await Promise.all(FIRME.map((id) => caricaFirma(id)));
  return new Map(elenco.map((f) => [f.id, f]));
}

// ---------------------------------------------------------------------------
// Biblioteca delle firme
// ---------------------------------------------------------------------------

/**
 * Una voce della biblioteca: cio' che si sa di una classe, uniforme per
 * sottomarini, navi e biologici.
 * @typedef {object} VoceBiblioteca
 * @property {string} classe identificativo (CLASSI di shared/protocol.js)
 * @property {string} nome
 * @property {'sottomarino' | 'nave' | 'biologico'} tipo
 * @property {string | null} lato
 * @property {{nome: string, tipo: string | null, frequenza: number, da_velocita: number, a_velocita: number}[]} righe
 *   righe a frequenza fissa
 * @property {{nome: string, tipo: string | null, per_giro: number}[]} righe_giri
 * @property {number | null} pale @property {number | null} assi @property {number | null} giri_per_nodo
 * @property {number | null} altezza_alberi m @property {string | null} sagoma famiglia di sagome
 * @property {{nome: string, banda: string}[]} radar
 * @property {{f_min: number, f_max: number} | null} canto
 */

/**
 * La biblioteca delle firme: una voce per classe.
 * @param {Map<string, import('./piattaforme.js').Piattaforma>} piattaforme
 * @param {Map<string, Firma>} firme
 * @returns {Map<string, VoceBiblioteca>}
 */
export function biblioteca(piattaforme, firme) {
  /** @type {Map<string, VoceBiblioteca>} */
  const out = new Map();
  for (const [id, p] of piattaforme) {
    const v = /** @type {any} */ (p.valori);
    out.set(id, {
      classe: id,
      nome: `${v.identita.nome} (${v.identita.designazione})`,
      tipo: 'sottomarino',
      lato: v.identita.lato ?? null,
      righe: (v.acustica.tonali ?? []).map((/** @type {any} */ t) => ({
        nome: t.nome, tipo: t.tipo ?? null, frequenza: t.frequenza, da_velocita: t.da_velocita, a_velocita: t.a_velocita,
      })),
      righe_giri: (v.acustica.righe_giri ?? []).map((/** @type {any} */ t) => ({ nome: t.nome, tipo: t.tipo ?? null, per_giro: t.per_giro })),
      pale: v.propulsione.elica_pale ?? null,
      assi: v.propulsione.assi ?? null,
      giri_per_nodo: v.propulsione.giri_per_nodo ?? null,
      altezza_alberi: null,
      sagoma: null,
      radar: v.sensori.radar?.presente ? [{ nome: v.sensori.radar.nome, banda: v.sensori.radar.banda }] : [],
      canto: null,
    });
  }
  for (const [id, f] of firme) {
    const v = f.valori;
    const canti = Object.values(v.specie ?? {}).map((s) => s.canto).filter((c) => c !== null);
    out.set(id, {
      classe: id,
      nome: v.identita.designazione ? `${v.identita.nome} (${v.identita.designazione})` : v.identita.nome,
      tipo: v.identita.tipo,
      lato: v.identita.lato ?? null,
      righe: (v.acustica?.tonali ?? []).map((t) => ({
        nome: t.nome, tipo: t.tipo ?? null, frequenza: t.frequenza, da_velocita: t.da_velocita, a_velocita: t.a_velocita,
      })),
      righe_giri: (v.acustica?.righe_giri ?? []).map((t) => ({ nome: t.nome, tipo: t.tipo ?? null, per_giro: t.per_giro })),
      pale: v.propulsione?.elica_pale ?? null,
      assi: v.propulsione?.assi ?? null,
      giri_per_nodo: v.propulsione?.giri_per_nodo ?? null,
      altezza_alberi: v.ottica?.altezza_alberi ?? null,
      sagoma: v.ottica?.sagoma ?? null,
      radar: (v.emettitori ?? []).map((r) => ({ nome: r.nome, banda: r.banda })),
      canto: canti.length > 0
        ? { f_min: Math.min(...canti.map((c) => /** @type {any} */ (c).f_min)), f_max: Math.max(...canti.map((c) => /** @type {any} */ (c).f_max)) }
        : null,
    });
  }
  return out;
}
