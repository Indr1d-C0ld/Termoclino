// @ts-check
/**
 * Il libro delle firme e di riconoscimento: per ogni classe che il protocollo ammette in `classifica`
 * (`CLASSI` di shared/protocol.js) le righe tonali, il numero di pale, l'altezza d'albero (per lo
 * stadimetro), la sagoma del periscopio e i radar. I dati sono quelli comuni del filone H
 * (shared/data/piattaforme/*.json per i sottomarini, shared/data/firme/*.json per navi e biologici,
 * formato in shared/data/SCHEMA.md §8: `acustica.tonali`, `acustica.righe_giri`, `propulsione.elica_pale`
 * e `giri_per_nodo`, `ottica.altezza_alberi` e `ottica.sagoma`, `emettitori[].nome`), serviti sotto
 * /assets/shared/: il client li legge come il comandante legge il libro, e confronta a occhio le righe
 * del LOFAR.
 *
 * `normalizzaClasse` riduce un file alla forma che serve alle stazioni; i numeri restano quelli del file
 * (ogni dato ha la sua provenienza: qui si tiene solo il valore).
 */
import { CLASSI } from '../../shared/protocol.js';

/**
 * Una riga tonale del libro.
 * @typedef {{ hz: number, nome: string, livello: number | null, da_nodi: number | null, a_nodi: number | null,
 *   variabile: boolean }} RigaLibro
 *   `variabile`: la frequenza cambia con la velocità (pale, asse): quelle fisse sono le più utili per
 *   classificare; `da_nodi`/`a_nodi`: la riga c'è solo in quell'intervallo di velocità (pompe)
 */
/**
 * @typedef {object} Classe
 * @property {string} id identificativo del protocollo ('forrest_sherman')
 * @property {string} nome nome della classe, come lo scrive il file
 * @property {'sottomarino' | 'superficie' | 'biologico'} tipo
 * @property {RigaLibro[]} righe
 * @property {number | null} pale numero di pale dell'elica
 * @property {number | null} giriPerNodo giri dell'asse al minuto per nodo (per la frequenza di pala)
 * @property {number | null} albero altezza della testa d'albero sulla linea d'acqua, m (stadimetro)
 * @property {string | null} sagoma famiglia delle figure del periscopio ('FOREST')
 * @property {string[]} radar i radar (designazioni come in `esm.tipo`)
 */

/** @param {unknown} v @returns {unknown} il valore di un dato con provenienza, o il valore stesso */
function val(v) {
  return v && typeof v === 'object' && !Array.isArray(v) && 'valore' in v ? /** @type {any} */ (v).valore : v;
}

/** @param {unknown} v */
function numero(v) {
  const x = val(v);
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

/**
 * Cerca nel file, a qualunque profondità, il primo campo con uno dei nomi dati.
 * @param {unknown} nodo @param {string[]} nomi @param {number} [profondita]
 * @returns {unknown}
 */
function cerca(nodo, nomi, profondita = 6) {
  if (!nodo || typeof nodo !== 'object' || profondita < 0) return undefined;
  const o = /** @type {Record<string, unknown>} */ (nodo);
  for (const n of nomi) if (n in o) return o[n];
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') {
      const r = cerca(v, nomi, profondita - 1);
      if (r !== undefined) return r;
    }
  }
  return undefined;
}

/** Velocità a cui si mostrano nel libro le righe che seguono i giri dell'asse (riduttore, pale), nodi. */
export const NODI_LIBRO = 10;

/**
 * Le righe tonali di un file (SCHEMA §8): `acustica.tonali` a frequenza fissa (rete elettrica, pompe:
 * alcune solo in un intervallo di velocità) e `acustica.righe_giri`, la cui frequenza è `per_giro` ×
 * giri/60 e quindi segue la velocità: nel libro si mostrano a NODI_LIBRO nodi, come «variabili».
 * @param {unknown} dati @param {number | null} giriPerNodo
 * @returns {RigaLibro[]}
 */
function righeDi(dati, giriPerNodo) {
  /** @type {RigaLibro[]} */
  const out = [];
  const tonali = cerca(dati, ['tonali', 'righe_tonali']);
  if (Array.isArray(tonali)) {
    for (const r of tonali) {
      if (!r || typeof r !== 'object') continue;
      const o = /** @type {Record<string, unknown>} */ (r);
      const hz = numero(o.frequenza ?? o.hz ?? o.frequenza_hz);
      if (hz === null) continue;
      out.push({
        hz,
        nome: String(val(o.nome) ?? val(o.tipo) ?? ''),
        livello: numero(o.sopra_banda_larga ?? o.livello),
        da_nodi: numero(o.da_velocita ?? o.da_nodi),
        a_nodi: numero(o.a_velocita ?? o.a_nodi),
        variabile: false,
      });
    }
  }
  const giri = cerca(dati, ['righe_giri']);
  if (Array.isArray(giri) && giriPerNodo !== null) {
    for (const r of giri) {
      if (!r || typeof r !== 'object') continue;
      const o = /** @type {Record<string, unknown>} */ (r);
      const perGiro = numero(o.per_giro);
      if (perGiro === null) continue;
      out.push({
        hz: (perGiro * giriPerNodo * NODI_LIBRO) / 60,
        nome: String(val(o.nome) ?? val(o.tipo) ?? ''),
        livello: numero(o.sopra_banda_larga ?? o.livello),
        da_nodi: numero(o.da_velocita),
        a_nodi: numero(o.a_velocita),
        variabile: true,
      });
    }
  }
  return out.sort((x, y) => x.hz - y.hz);
}

/**
 * Riduce i file di una classe (il file di piattaforma o di firma; anche due, uniti) alla forma del libro.
 * @param {string} id @param {unknown[]} files
 * @returns {Classe}
 */
export function normalizzaClasse(id, files) {
  const tutti = { file: files };
  const nome = files.map((f) => {
    const id_ = /** @type {any} */ (f)?.identita;
    return val(id_?.classe ?? id_?.nome_classe ?? cerca(f, ['nome_classe', 'classe']));
  }).find((x) => typeof x === 'string');
  const tipoGrezzo = files.map((f) => val(cerca(f, ['tipo', 'dominio']))).find((x) => typeof x === 'string');
  /** @type {Classe['tipo']} */
  const tipo = id === 'biologico' || /bio/i.test(String(tipoGrezzo)) ? 'biologico'
    : id === '688' || id === 'alfa' || /sott|sub/i.test(String(tipoGrezzo)) ? 'sottomarino' : 'superficie';
  const radarGrezzi = cerca(tutti, ['emettitori', 'radar']);
  /** @type {string[]} */
  const radar = [];
  if (Array.isArray(radarGrezzi)) {
    for (const r of radarGrezzi) {
      const t = val(r && typeof r === 'object' ? (/** @type {any} */ (r).nome ?? /** @type {any} */ (r).tipo ?? /** @type {any} */ (r).designazione) : r);
      if (typeof t === 'string') radar.push(t);
    }
  }
  const sagoma = val(cerca(tutti, ['sagoma', 'sagoma_periscopio', 'figura']));
  const giriPerNodo = numero(cerca(tutti, ['giri_per_nodo']));
  return {
    id,
    nome: typeof nome === 'string' ? nome : id.toUpperCase().replace(/_/g, ' '),
    tipo,
    righe: files.flatMap((f) => righeDi(f, giriPerNodo)).sort((a, b) => a.hz - b.hz),
    pale: numero(cerca(tutti, ['elica_pale', 'numero_pale', 'pale_elica'])),
    giriPerNodo,
    albero: numero(cerca(tutti, ['altezza_alberi', 'altezza_albero', 'testa_d_albero'])),
    sagoma: typeof sagoma === 'string' ? sagoma.toUpperCase().replace(/\d+$/, '') : null,
    radar,
  };
}

/**
 * Carica il libro: per ogni classe del protocollo il file di piattaforma o di firma che c'è (si provano
 * entrambi). Le classi senza file restano fuori; non lancia.
 * @param {(percorso: string) => Promise<unknown>} leggiJson relativo a assets/shared/ ('data/firme/x.json')
 * @returns {Promise<Classe[]>}
 */
export async function caricaBiblioteca(leggiJson) {
  const out = await Promise.all(CLASSI.map(async (id) => {
    const files = (await Promise.all([`data/piattaforme/${id}.json`, `data/firme/${id}.json`].map(async (p) => {
      try {
        return await leggiJson(p);
      } catch {
        return null;
      }
    }))).filter((f) => f !== null);
    return files.length ? normalizzaClasse(id, files) : null;
  }));
  return /** @type {Classe[]} */ (out.filter(Boolean));
}

/**
 * Le righe del libro attese a una velocità: quelle fisse e quelle variabili che a quella velocità ci
 * sono. Senza velocità, tutte.
 * @param {Classe} c @param {number | null} [nodi]
 */
export function righeAttese(c, nodi = null) {
  if (nodi === null) return c.righe;
  return c.righe.filter((r) => (r.da_nodi === null || nodi >= r.da_nodi) && (r.a_nodi === null || nodi <= r.a_nodi));
}

/**
 * Quante righe misurate cadono vicino a una riga del libro (entro `tolleranza` Hz o il 2 %): un
 * punteggio grezzo per ordinare il libro, la scelta resta al comandante.
 * @param {{ hz: number }[]} misurate @param {Classe} c @param {number} tolleranza Hz
 */
export function concordanza(misurate, c, tolleranza) {
  const fisse = c.righe.filter((r) => !r.variabile);
  if (fisse.length === 0) return 0;
  let n = 0;
  for (const r of fisse) if (misurate.some((m) => Math.abs(m.hz - r.hz) <= Math.max(tolleranza, 0.02 * r.hz))) n++;
  return n / fisse.length;
}
