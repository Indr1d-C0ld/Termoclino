// @ts-check
/**
 * Protocollo fra client e server di gioco — versione 2 (F2, «Ascoltare»).
 *
 * Questo modulo e' il contratto: lo importano il server Node e il client nel
 * browser, cosi' i due non possono divergere in silenzio. Nessuna API solo-Node:
 * la firma del biglietto si verifica con Web Crypto (`globalThis.crypto.subtle`),
 * che esiste in Node 20+ e in tutti i browser moderni. La spiegazione di ogni
 * messaggio sta in docs/PROTOCOLLO.md; se i due divergono vale questo file.
 *
 * Regole di fondo (PROGETTO §6):
 *  - i messaggi sono oggetti JSON con un campo `t` (tipo); per questo l'ora di
 *    gioco nei messaggi si chiama sempre `ora`, mai `t`;
 *  - il primo messaggio del client e' `ciao` con il biglietto rilasciato da PHP
 *    (mai nell'indirizzo del WebSocket: gli indirizzi finiscono nei log di Apache);
 *  - il server non manda MAI posizioni, rotte, quote o identita' vere di altri
 *    battelli: solo lo stato del proprio, le misure dei propri sensori e i
 *    rapporti del proprio equipaggio (prova: server/test/nebbia.test.js).
 *
 * Tutti gli ordini si validano qui, con `validaOrdine`: il server per
 * difendersi, il client per non mandare ordini che verrebbero respinti.
 *
 * Storia: v0 (F0) il cancello; v1 (F1) palestra, stato, sonar a banda larga,
 * rapporti; v2 (F2) banda stretta (LOFAR, DEMON), sonar attivo e
 * intercettazione, transitori, periscopio, ESM e radar, tracce e soluzioni
 * dell'equipaggio, livelli di assistenza. docs/PROTOCOLLO.md tiene la storia.
 */

/** Versione del protocollo. Il server rifiuta un client con versione diversa. */
export const PROTOCOLLO_VERSIONE = 2;

/** Dimensione massima di un messaggio, in byte (UTF-8). */
export const MESSAGGIO_MAX_BYTE = 16 * 1024;

/** Secondi concessi al client per presentare il biglietto dopo la connessione. */
export const ATTESA_CIAO_SECONDI = 10;

/** Tolleranza sugli orologi fra PHP e Node, in secondi. */
export const TOLLERANZA_OROLOGIO_SECONDI = 5;

/** Tipi di messaggio dal client al server. */
export const DAL_CLIENT = Object.freeze({
  CIAO: 'ciao',
  PING: 'ping',
  ENTRA: 'entra',
  ESCI: 'esci',
  ORDINE: 'ordine',
});

/** Tipi di messaggio dal server al client. */
export const DAL_SERVER = Object.freeze({
  BENVENUTO: 'benvenuto',
  PONG: 'pong',
  ERRORE: 'errore',
  ADDIO: 'addio',
  PARTITA: 'partita',
  TEMPO: 'tempo',
  STATO: 'stato',
  SONAR: 'sonar',
  RAPPORTO: 'rapporto',
  RICEVUTO: 'ricevuto',
  USCITA: 'uscita',
  // v2
  SPETTRO: 'spettro',
  ECO: 'eco',
  INTERCETTO: 'intercetto',
  TRANSITORIO: 'transitorio',
  VISIVO: 'visivo',
  ESM: 'esm',
  RADAR: 'radar',
  TRACCE: 'tracce',
  SOLUZIONE: 'soluzione',
  STORIA: 'storia',
});

/** Codici d'errore. Stabili: il client li traduce, non mostra il testo grezzo. */
export const ERRORI = Object.freeze({
  MESSAGGIO_MALFORMATO: 'messaggio_malformato',
  MESSAGGIO_TROPPO_GRANDE: 'messaggio_troppo_grande',
  TIPO_SCONOSCIUTO: 'tipo_sconosciuto',
  VERSIONE: 'versione_protocollo',
  BIGLIETTO_ASSENTE: 'biglietto_assente',
  BIGLIETTO_NON_VALIDO: 'biglietto_non_valido',
  BIGLIETTO_SCADUTO: 'biglietto_scaduto',
  BIGLIETTO_GIA_USATO: 'biglietto_gia_usato',
  NON_PRESENTATO: 'non_presentato',
  TROPPO_IN_FRETTA: 'troppo_in_fretta',
  ORIGINE: 'origine_non_ammessa',
  // v1
  SCENARIO_SCONOSCIUTO: 'scenario_sconosciuto',
  GIA_IN_PARTITA: 'gia_in_partita',
  NON_IN_PARTITA: 'non_in_partita',
  PARTITA_PIENA: 'partita_piena',
  ORDINE_NON_VALIDO: 'ordine_non_valido',
  ORDINE_RIFIUTATO: 'ordine_rifiutato',
  // v2
  ASSISTENZA_NON_VALIDA: 'assistenza_non_valida', // `entra` con un livello di assistenza malformato
});

/**
 * Motivi di un ordine respinto (campo `motivo` dell'errore). Stabili come i
 * codici. `ordine_non_valido` = l'ordine e' scritto male (lo controlla
 * `validaOrdine`); `ordine_rifiutato` = e' scritto bene ma ora non si puo'
 * eseguire (lo decide il server).
 */
export const MOTIVI_ORDINE = Object.freeze({
  // ordine_non_valido
  COSA: 'cosa',                         // `cosa` assente o sconosciuta
  TIPO: 'tipo',                         // `valore` del tipo sbagliato
  FUORI_LIMITI: 'fuori_limiti',         // numero fuori dall'intervallo ammesso
  VALORE: 'valore',                     // testo non fra quelli ammessi
  N: 'n',                               // numero d'ordine `n` malformato
  // ordine_rifiutato
  TEMPO_BLOCCATO: 'tempo_bloccato',     // scala o pausa: non sei solo nella partita
  SENZA_TOWED: 'senza_towed',           // il battello non ha l'antenna rimorchiata
  TOWED_STATO: 'towed_stato',           // l'antenna non e' nello stato giusto (gia' filata, tagliata...)
  TROPPI_WAYPOINT: 'troppi_waypoint',
  NESSUN_WAYPOINT: 'nessun_waypoint',   // autopilota senza waypoint
  FUORI_AREA: 'fuori_area',             // waypoint fuori dall'area dello scenario
  INDICE: 'indice',                     // waypoint da togliere che non esiste
  // ordine_rifiutato, v2
  QUOTA: 'quota',                       // albero o attivo che chiede la quota periscopica (si e' piu' giu')
  ALBERO: 'albero',                     // radar senza l'albero del radar alzato
  CONTATTO: 'contatto',                 // contatto che l'equipaggio non tiene
  LIVELLO: 'livello',                   // livello di assistenza non ammesso in questa partita
  SENZA_SENSORE: 'senza_sensore',       // il battello non ha quel sensore (radar, ESM, attivo, ...)
  PING_IN_CORSO: 'ping_in_corso',       // si ascolta ancora l'eco del ping precedente
  SETTORE: 'settore',                   // ping fuori dal settore di trasmissione della sfera
});

/** Scenari ammessi in `entra`. In F1 solo la palestra di TORPEX '89. */
export const SCENARI = Object.freeze(/** @type {const} */ (['torpex_palestra']));

/** Le `cosa` di un ordine. */
export const ORDINI = Object.freeze(/** @type {const} */ ([
  'macchina', 'timone', 'timoni_o', 'quota', 'rotta', 'towed',
  'waypoint', 'autopilota', 'scala_tempo', 'pausa',
  // v2
  'assistenza', 'analizzatore', 'attivo', 'albero', 'radar',
  'designa', 'classifica', 'soluzione', 'abbandona',
]));

/** @typedef {typeof ORDINI[number]} CosaOrdine */

/** Scale del tempo ammesse (tempo di gioco per secondo reale). */
export const SCALE_TEMPO = Object.freeze([1, 2, 4, 8, 16, 32]);

/** Angolo massimo dei timoni orizzontali, gradi (positivo = a scendere). */
export const TIMONI_O_MAX = 20;

/** Waypoint al massimo, come nell'originale del 1989. */
export const WAYPOINT_MAX = 9;

/** Valori testuali di `quota`. */
export const QUOTE_SPECIALI = Object.freeze(/** @type {const} */ (['periscopica', 'automatica', 'emersione']));

/** Valori di `towed`. */
export const COMANDI_TOWED = Object.freeze(/** @type {const} */ (['fila', 'ritira', 'taglia']));

/** Stati dell'antenna rimorchiata in `stato.towed.stato`. */
export const STATI_TOWED = Object.freeze(/** @type {const} */ ([
  'stivata', 'in_filare', 'filata', 'in_ritiro', 'tagliata', 'persa',
]));

/** Sensori che producono fotogrammi `sonar` (e, da v2, `spettro`). */
export const SENSORI_SONAR = Object.freeze(/** @type {const} */ (['sfera', 'towed']));

/**
 * Bande dei fotogrammi `sonar` (v2): `larga` sono quelli di F1 (un fotogramma
 * al secondo, il campo `banda` manca); `stretta` sono i fotogrammi della
 * banda stretta su tutti i fasci, ogni SPETTRO.PERIODO secondi: in ogni
 * settore l'eccesso della riga tonale piu' forte della finestra del sensore.
 */
export const BANDE_SONAR = Object.freeze(/** @type {const} */ (['larga', 'stretta']));

/**
 * Finestre dell'analizzatore (messaggio `spettro`, v2) e dei fotogrammi a
 * banda stretta. Il byte k di `righe` e' la cella di frequenza
 * [DA_HZ + k·PASSO_HZ, DA_HZ + (k+1)·PASSO_HZ); quello di `demon` la cella di
 * frequenza di modulazione [DEMON_DA_HZ + k·DEMON_PASSO_HZ, …). Stessa
 * quantizzazione dei fotogrammi `sonar` (quantizzaSE). I messaggi ripetono
 * da_hz e passo_hz: il client usa quelli del messaggio.
 */
export const SPETTRO = Object.freeze({
  /** s di gioco fra due `spettro` (e fra due fotogrammi a banda stretta) */
  PERIODO: 4,
  sfera: Object.freeze({ DA_HZ: 0, PASSO_HZ: 2, RIGHE: 1024, DEMON_DA_HZ: 0, DEMON_PASSO_HZ: 0.1, DEMON_RIGHE: 512 }),
  towed: Object.freeze({ DA_HZ: 0, PASSO_HZ: 1, RIGHE: 1024, DEMON_DA_HZ: 0, DEMON_PASSO_HZ: 0.1, DEMON_RIGHE: 512 }),
});

/** Portate del ping (ordine `attivo`): impulso e finestra d'ascolto (PROTOCOLLO v2). */
export const PORTATE_ATTIVO = Object.freeze(/** @type {const} */ (['corta', 'lunga']));

/** Alberi che si alzano a quota periscopica (ordine `albero`, `stato.alberi`). */
export const ALBERI = Object.freeze(/** @type {const} */ (['periscopio', 'esm', 'radar']));

/**
 * Tipi di transitorio come li riconosce il sonarista (`transitorio.tipo`).
 * `sconosciuto` quando il transitorio e' troppo debole per riconoscerlo.
 */
export const TIPI_TRANSITORIO = Object.freeze(/** @type {const} */ ([
  'scafo', 'portello', 'pompa', 'emersione', 'meccanico', 'biologico', 'sconosciuto',
]));

/** Luci di navigazione che il periscopio vede di notte (`visivo.oggetti[].luci`), regola 21 del COLREG. */
export const LUCI = Object.freeze(/** @type {const} */ (['testa_d_albero', 'fianco_dritta', 'fianco_sinistra', 'coronamento']));

/**
 * Classi della biblioteca delle firme (ordine `classifica`, `tracce.classe`):
 * gli identificativi dei file di shared/data/piattaforme/ e shared/data/firme/.
 */
export const CLASSI = Object.freeze(/** @type {const} */ ([
  '688', 'alfa', 'forrest_sherman', 'mercantile_generico', 'biologico',
]));

/** Livelli di assistenza (PROGETTO §5.6); il predefinito di `entra` e' 2. */
export const LIVELLI_ASSISTENZA = Object.freeze([0, 1, 2, 3]);
export const ASSISTENZA_PREDEFINITA = 2;

/**
 * Designazione di un contatto dell'equipaggio: lettere maiuscole (anche
 * cirilliche, per l'equipaggio dell'Alfa) seguite da un numero: 'S1', 'S12'.
 */
export const CONTATTO_RE = /^\p{Lu}{1,3}\d{1,4}$/u;

/**
 * I rapporti dell'equipaggio: chiave → parametri, esattamente questi (la prova
 * di nebbia lo controlla, i cataloghi delle lingue del client devono avere una
 * frase per ogni chiave). Chi aggiunge un rapporto lo aggiunge qui.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const RAPPORTI = Object.freeze({
  // v1
  'sonar.nuovo_contatto': Object.freeze(['contatto', 'sensore', 'rilevamento', 'speculare']),
  'sonar.contatto_perso': Object.freeze(['contatto', 'sensore']),
  'towed.in_filare': Object.freeze([]),
  'towed.filata': Object.freeze([]),
  'towed.in_ritiro': Object.freeze([]),
  'towed.ritirata': Object.freeze([]),
  'towed.tagliata': Object.freeze([]),
  'towed.persa': Object.freeze([]),
  'towed.stabilizzata': Object.freeze([]),
  'towed.sorda': Object.freeze(['velocita']),
  'towed.curva': Object.freeze(['velocita']),
  'towed.velocita_pericolosa': Object.freeze(['velocita_danno']),
  'macchina.cavitazione': Object.freeze(['v_cavitazione']),
  'macchina.fine_cavitazione': Object.freeze(['v_cavitazione']),
  'guardia.quota_collaudo_vicina': Object.freeze(['quota', 'collaudo']),
  'guardia.oltre_quota_collaudo': Object.freeze(['quota', 'collaudo']),
  'guardia.collasso': Object.freeze(['quota', 'collasso']),
  'guardia.urto_fondale': Object.freeze(['quota']),
  'guardia.in_superficie': Object.freeze([]),
  'guardia.ripreso_il_comando': Object.freeze(['secondi']),
  'navigazione.fondale_vicino': Object.freeze(['sotto_chiglia']),
  'navigazione.fondale_avanti': Object.freeze(['distanza', 'profondita']),
  'navigazione.waypoint_raggiunto': Object.freeze(['indice']),
  'navigazione.ultimo_waypoint': Object.freeze([]),
  'timone.rotta_raggiunta': Object.freeze(['rotta']),
  'timone.quota_raggiunta': Object.freeze(['quota']),
  // v2: sensori (H)
  'sonar.transitorio': Object.freeze(['contatto', 'sensore', 'tipo', 'rilevamento']),
  'sonar.eco': Object.freeze(['rilevamento', 'distanza']),
  'sonar.fine_ascolto': Object.freeze(['echi']),
  'intercetto.ping': Object.freeze(['rilevamento', 'frequenza_khz']),
  'periscopio.nave_in_vista': Object.freeze(['rilevamento', 'sagoma']),
  'periscopio.scia': Object.freeze(['velocita']),
  'guardia.alberi_abbassati': Object.freeze(['quota']),
  'esm.radar': Object.freeze(['rilevamento', 'tipo', 'banda']),
  // v2: equipaggio e TMA (I)
  'sonar.classificato': Object.freeze(['contatto', 'classe', 'confidenza']),
  'tma.soluzione': Object.freeze(['contatto', 'q']),
  'tma.consiglio_manovra': Object.freeze(['contatto', 'accostata', 'lato', 'minuti']),
  'tma.distanza_non_osservabile': Object.freeze(['contatto']),
  'tma.ekelund': Object.freeze(['contatto', 'distanza']),
});

/** Le chiavi dei rapporti, per i cataloghi delle lingue. */
export const CHIAVI_RAPPORTO = Object.freeze(Object.keys(RAPPORTI));

/**
 * Geometria e quantizzazione dei fotogrammi `sonar`.
 *
 * Il fotogramma e' un vettore di SETTORI byte. Il settore k copre i
 * rilevamenti VERI [k·AMPIEZZA, (k+1)·AMPIEZZA): centro a k·2+1 gradi. Il byte
 * q codifica l'eccesso di segnale SE (dB, 0 = soglia di rivelazione, cioe'
 * probabilita' di scoperta del 50 %) come q = round((SE − SE_MIN) / PASSO_DB),
 * limitato a [0, 255]: SE = −30 + 0,5·q, da −30 dB (q = 0) a +97,5 dB
 * (q = 255); la soglia SE = 0 vale q = 60. Il fondo di rumore sta intorno a
 * −10 dB (q ≈ 40) e fluttua: e' il «grano» del waterfall.
 */
export const SONAR = Object.freeze({
  SETTORI: 180,
  AMPIEZZA_SETTORE: 2,
  SE_MIN: -30,
  PASSO_DB: 0.5,
  /** q della soglia di rivelazione (SE = 0 dB). */
  Q_SOGLIA: 60,
});

/**
 * Quantizza un eccesso di segnale in dB nel byte del fotogramma.
 * @param {number} se dB (anche -Infinity)
 * @returns {number} intero in [0, 255]
 */
export function quantizzaSE(se) {
  if (!(se > SONAR.SE_MIN)) return 0; // anche NaN e -Infinity
  const q = Math.round((se - SONAR.SE_MIN) / SONAR.PASSO_DB);
  return q > 255 ? 255 : q;
}

/**
 * Il valore in dB di un byte del fotogramma (centro del gradino).
 * @param {number} q intero in [0, 255]
 * @returns {number} dB
 */
export function dequantizzaSE(q) {
  return SONAR.SE_MIN + SONAR.PASSO_DB * q;
}

/**
 * Settore che contiene un rilevamento vero.
 * @param {number} rilevamento gradi (qualsiasi)
 * @returns {number} intero in [0, SETTORI)
 */
export function settoreDi(rilevamento) {
  let a = rilevamento % 360;
  if (a < 0) a += 360;
  const k = Math.floor(a / SONAR.AMPIEZZA_SETTORE);
  return k >= SONAR.SETTORI ? 0 : k;
}

/**
 * Rilevamento vero al centro di un settore.
 * @param {number} k
 * @returns {number} gradi
 */
export function centroSettore(k) {
  return k * SONAR.AMPIEZZA_SETTORE + SONAR.AMPIEZZA_SETTORE / 2;
}

/**
 * Codifica i byte di un fotogramma in base64 (standard, 180 byte → 240
 * caratteri, senza «=» perche' 180 e' multiplo di 3).
 * @param {Uint8Array} byte
 * @returns {string}
 */
export function codificaSettori(byte) {
  let binario = '';
  for (let i = 0; i < byte.length; i++) binario += String.fromCharCode(byte[i]);
  return btoa(binario);
}

/**
 * Decodifica il campo `settori` di un fotogramma `sonar`.
 * @param {string} testo base64
 * @returns {Uint8Array | null} null se la stringa non e' un fotogramma valido
 */
export function decodificaSettori(testo) {
  if (typeof testo !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(testo)) return null;
  try {
    const binario = atob(testo);
    if (binario.length !== SONAR.SETTORI) return null;
    const out = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) out[i] = binario.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Codifica un vettore di byte qualsiasi in base64 standard (per `spettro`:
 * `righe` e `demon`). Con lunghezze non multiple di 3 compare il «=».
 * @param {Uint8Array} byte
 * @returns {string}
 */
export function codificaByte(byte) {
  let binario = '';
  for (let i = 0; i < byte.length; i++) binario += String.fromCharCode(byte[i]);
  return btoa(binario);
}

/**
 * Decodifica un vettore di byte in base64 di lunghezza nota.
 * @param {unknown} testo
 * @param {number} lunghezza byte attesi
 * @returns {Uint8Array | null} null se la stringa non e' valida o la lunghezza non torna
 */
export function decodificaByte(testo, lunghezza) {
  if (typeof testo !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(testo)) return null;
  try {
    const binario = atob(testo);
    if (binario.length !== lunghezza) return null;
    const out = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) out[i] = binario.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Decodifica le righe di un messaggio `spettro` (LOFAR): la lunghezza attesa
 * e' quella della finestra del sensore (SPETTRO[sensore].RIGHE).
 * @param {{sensore: string, righe: unknown}} m
 * @returns {Uint8Array | null}
 */
export function decodificaSpettro(m) {
  const f = m.sensore === 'sfera' || m.sensore === 'towed' ? SPETTRO[m.sensore] : null;
  return f ? decodificaByte(m.righe, f.RIGHE) : null;
}

/**
 * Decodifica lo spettro DEMON di un messaggio `spettro`.
 * @param {{sensore: string, demon: unknown}} m
 * @returns {Uint8Array | null}
 */
export function decodificaDemon(m) {
  const f = m.sensore === 'sfera' || m.sensore === 'towed' ? SPETTRO[m.sensore] : null;
  return f ? decodificaByte(m.demon, f.DEMON_RIGHE) : null;
}

/**
 * Frequenza al centro della cella k di una finestra.
 * @param {number} daHz
 * @param {number} passoHz
 * @param {number} k
 * @returns {number} Hz
 */
export function centroCella(daHz, passoHz, k) {
  return daHz + (k + 0.5) * passoHz;
}

// --- Ordini --------------------------------------------------------------------

/**
 * Cio' che serve per validare gli ordini di un battello: si ricava dai dati di
 * piattaforma con `contestoOrdini`, cosi' il protocollo non dipende dai file.
 *
 * @typedef {object} ContestoOrdini
 * @property {'ordini' | 'percentuale'} telegrafo
 * @property {string[]} ordiniMacchina  valori ammessi di `macchina` con telegrafo a ordini (minuscoli)
 * @property {[number, number]} percentuale  estremi del telegrafo a percentuale
 * @property {number} timoneMax  gradi
 * @property {number} quotaMax  metri (quota di collasso: piu' giu' non si ordina)
 */

/** Contesto del 688 (Flight I), lo stesso che `contestoOrdini` ricava da 688.json. */
export const CONTESTO_688 = Object.freeze(/** @type {ContestoOrdini} */ ({
  telegrafo: 'ordini',
  ordiniMacchina: ['rev', 'stop', '1/3', '2/3', 'std', 'full', 'flank'],
  percentuale: [0, 0],
  timoneMax: 30,
  quotaMax: 450,
}));

/**
 * Ricava il contesto di validazione dai valori di una piattaforma
 * (`Piattaforma.valori` di shared/data/piattaforme.js).
 * @param {{dinamica: {telegrafo: {tipo: string, minimo?: number, massimo?: number},
 *   ordini_macchina: {ordine: string}[], accostata: {angolo_timone_max: number}},
 *   profondita: {collasso: number}}} valori
 * @returns {ContestoOrdini}
 */
export function contestoOrdini(valori) {
  const d = valori.dinamica;
  const percentuale = d.telegrafo.tipo === 'percentuale';
  return {
    telegrafo: percentuale ? 'percentuale' : 'ordini',
    ordiniMacchina: percentuale ? [] : d.ordini_macchina.map((o) => o.ordine.toLowerCase()),
    percentuale: [d.telegrafo.minimo ?? 0, d.telegrafo.massimo ?? 0],
    timoneMax: d.accostata.angolo_timone_max,
    quotaMax: valori.profondita.collasso,
  };
}

/**
 * @typedef {{azione: 'aggiungi', x: number, y: number}
 *   | {azione: 'togli', indice: number}
 *   | {azione: 'svuota'}} OrdineWaypoint
 */

/**
 * Valore normalizzato di `analizzatore`: spento, puntato su un rilevamento
 * vero di un sensore, o agganciato a un contatto dell'equipaggio.
 * @typedef {null | {sensore: 'sfera' | 'towed', rilevamento: number} | {contatto: string}} OrdineAnalizzatore
 */

/**
 * Valore normalizzato di `soluzione`: quella del comandante, o la sua cancellazione.
 * `rilevamento` (facoltativo) e' il rilevamento vero del bersaglio all'`ora` della
 * soluzione; se manca l'equipaggio usa il proprio rilevamento misurato a quell'ora.
 * @typedef {{contatto: string, ora: number, distanza: number, rotta: number, velocita: number,
 *   rilevamento?: number}
 *   | {contatto: string, cancella: true}} OrdineSoluzione
 */

/**
 * Un ordine gia' validato e normalizzato.
 * @typedef {{cosa: 'macchina', valore: string | number}
 *   | {cosa: 'timone', valore: number}
 *   | {cosa: 'timoni_o', valore: number}
 *   | {cosa: 'quota', valore: number | 'periscopica' | 'automatica' | 'emersione'}
 *   | {cosa: 'rotta', valore: number}
 *   | {cosa: 'towed', valore: 'fila' | 'ritira' | 'taglia'}
 *   | {cosa: 'waypoint', valore: OrdineWaypoint}
 *   | {cosa: 'autopilota', valore: boolean}
 *   | {cosa: 'scala_tempo', valore: number}
 *   | {cosa: 'pausa', valore: boolean}
 *   | {cosa: 'assistenza', valore: number}
 *   | {cosa: 'analizzatore', valore: OrdineAnalizzatore}
 *   | {cosa: 'attivo', valore: {rilevamento: number | null, portata: 'corta' | 'lunga'}}
 *   | {cosa: 'albero', valore: {quale: 'periscopio' | 'esm' | 'radar', alzato: boolean}}
 *   | {cosa: 'radar', valore: boolean}
 *   | {cosa: 'designa', valore: string | null}
 *   | {cosa: 'classifica', valore: {contatto: string, classe: string | null}}
 *   | {cosa: 'soluzione', valore: OrdineSoluzione}
 *   | {cosa: 'abbandona', valore: string}} Ordine
 */

/**
 * @typedef {{ok: true, ordine: Ordine, n: number | null}
 *   | {ok: false, motivo: string, n: number | null, cosa: string | null}} EsitoOrdine
 */

/** Coordinata massima accettata in un waypoint (m): il server controlla poi l'area. */
const COORDINATA_MAX = 1e6;

/** Limiti della soluzione del comandante (ordine `soluzione`). */
export const SOLUZIONE_LIMITI = Object.freeze({ DISTANZA_MAX: 500_000, VELOCITA_MAX: 60, ORA_MAX: 1e7 });

/**
 * Un oggetto semplice (non null, non vettore) con esattamente le chiavi
 * ammesse (le facoltative possono mancare).
 * @param {unknown} v
 * @param {string[]} chiavi ammesse
 * @returns {v is Record<string, unknown>}
 */
function oggettoCon(v, chiavi) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.keys(v).every((k) => chiavi.includes(k));
}

/**
 * Un rilevamento valido (0…360), normalizzato al decimo; null se non e' un numero.
 * @param {unknown} v
 * @returns {number | 'tipo' | 'fuori_limiti'}
 */
function rilevamentoOrdine(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'tipo';
  if (v < 0 || v > 360) return 'fuori_limiti';
  const r = Math.round(v * 10) / 10;
  return r >= 360 ? 0 : r;
}

/**
 * La designazione di un contatto e' scritta bene?
 * @param {unknown} v
 * @returns {v is string}
 */
export function contattoValido(v) {
  return typeof v === 'string' && v.length <= 8 && CONTATTO_RE.test(v);
}

/**
 * Valida un messaggio `ordine` gia' decodificato. Non lancia mai.
 *
 * @param {Record<string, unknown>} m il messaggio (con `cosa`, `valore`, `n` facoltativo)
 * @param {ContestoOrdini} [contesto] predefinito il 688
 * @returns {EsitoOrdine}
 */
export function validaOrdine(m, contesto = CONTESTO_688) {
  /** @type {number | null} */
  let n = null;
  const cosaGrezza = typeof m.cosa === 'string' && m.cosa.length <= 32 ? m.cosa : null;
  /** @param {string} motivo @returns {EsitoOrdine} */
  const no = (motivo) => ({ ok: false, motivo, n, cosa: cosaGrezza });
  if (m.n !== undefined && m.n !== null) {
    if (!Number.isSafeInteger(m.n) || /** @type {number} */ (m.n) < 0 || /** @type {number} */ (m.n) > 2147483647) {
      return no(MOTIVI_ORDINE.N);
    }
    n = /** @type {number} */ (m.n);
  }
  if (cosaGrezza === null || !(/** @type {readonly string[]} */ (ORDINI)).includes(cosaGrezza)) return no(MOTIVI_ORDINE.COSA);
  const cosa = /** @type {CosaOrdine} */ (cosaGrezza);
  const v = m.valore;
  /** @param {Ordine} ordine @returns {EsitoOrdine} */
  const si = (ordine) => ({ ok: true, ordine, n });

  switch (cosa) {
    case 'macchina': {
      if (contesto.telegrafo === 'percentuale') {
        if (typeof v !== 'number') return no(MOTIVI_ORDINE.TIPO);
        if (!Number.isInteger(v)) return no(MOTIVI_ORDINE.TIPO);
        if (v < contesto.percentuale[0] || v > contesto.percentuale[1]) return no(MOTIVI_ORDINE.FUORI_LIMITI);
        return si({ cosa, valore: v });
      }
      if (typeof v !== 'string') return no(MOTIVI_ORDINE.TIPO);
      if (!contesto.ordiniMacchina.includes(v)) return no(MOTIVI_ORDINE.VALORE);
      return si({ cosa, valore: v });
    }
    case 'timone':
    case 'timoni_o': {
      if (typeof v !== 'number' || !Number.isInteger(v)) return no(MOTIVI_ORDINE.TIPO);
      const max = cosa === 'timone' ? contesto.timoneMax : TIMONI_O_MAX;
      if (Math.abs(v) > max) return no(MOTIVI_ORDINE.FUORI_LIMITI);
      return si({ cosa, valore: v === 0 ? 0 : v });
    }
    case 'quota': {
      if (typeof v === 'string') {
        if (!(/** @type {readonly string[]} */ (QUOTE_SPECIALI)).includes(v)) return no(MOTIVI_ORDINE.VALORE);
        return si({ cosa, valore: /** @type {'periscopica' | 'automatica' | 'emersione'} */ (v) });
      }
      if (typeof v !== 'number' || !Number.isFinite(v)) return no(MOTIVI_ORDINE.TIPO);
      if (v < 0 || v > contesto.quotaMax) return no(MOTIVI_ORDINE.FUORI_LIMITI);
      return si({ cosa, valore: Math.round(v * 10) / 10 });
    }
    case 'rotta': {
      if (typeof v !== 'number' || !Number.isFinite(v)) return no(MOTIVI_ORDINE.TIPO);
      if (v < 0 || v > 360) return no(MOTIVI_ORDINE.FUORI_LIMITI);
      const r = Math.round(v * 10) / 10;
      return si({ cosa, valore: r >= 360 ? 0 : r });
    }
    case 'towed': {
      if (typeof v !== 'string') return no(MOTIVI_ORDINE.TIPO);
      if (!(/** @type {readonly string[]} */ (COMANDI_TOWED)).includes(v)) return no(MOTIVI_ORDINE.VALORE);
      return si({ cosa, valore: /** @type {'fila' | 'ritira' | 'taglia'} */ (v) });
    }
    case 'waypoint': {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) return no(MOTIVI_ORDINE.TIPO);
      const w = /** @type {Record<string, unknown>} */ (v);
      if (w.azione === 'svuota') return si({ cosa, valore: { azione: 'svuota' } });
      if (w.azione === 'togli') {
        if (typeof w.indice !== 'number' || !Number.isInteger(w.indice)) return no(MOTIVI_ORDINE.TIPO);
        if (w.indice < 0 || w.indice >= WAYPOINT_MAX) return no(MOTIVI_ORDINE.FUORI_LIMITI);
        return si({ cosa, valore: { azione: 'togli', indice: w.indice } });
      }
      if (w.azione === 'aggiungi') {
        if (typeof w.x !== 'number' || typeof w.y !== 'number' || !Number.isFinite(w.x) || !Number.isFinite(w.y)) {
          return no(MOTIVI_ORDINE.TIPO);
        }
        if (Math.abs(w.x) > COORDINATA_MAX || Math.abs(w.y) > COORDINATA_MAX) return no(MOTIVI_ORDINE.FUORI_LIMITI);
        return si({ cosa, valore: { azione: 'aggiungi', x: Math.round(w.x), y: Math.round(w.y) } });
      }
      return no(MOTIVI_ORDINE.VALORE);
    }
    case 'autopilota':
    case 'pausa': {
      if (typeof v !== 'boolean') return no(MOTIVI_ORDINE.TIPO);
      return si({ cosa, valore: v });
    }
    case 'scala_tempo': {
      if (typeof v !== 'number' || !Number.isInteger(v)) return no(MOTIVI_ORDINE.TIPO);
      if (!SCALE_TEMPO.includes(v)) return no(MOTIVI_ORDINE.VALORE);
      return si({ cosa, valore: v });
    }
    // --- v2 -----------------------------------------------------------------
    case 'assistenza': {
      if (typeof v !== 'number' || !Number.isInteger(v)) return no(MOTIVI_ORDINE.TIPO);
      if (!LIVELLI_ASSISTENZA.includes(v)) return no(MOTIVI_ORDINE.FUORI_LIMITI);
      return si({ cosa, valore: v });
    }
    case 'analizzatore': {
      if (v === null) return si({ cosa, valore: null });
      if (!oggettoCon(v, ['sensore', 'rilevamento', 'contatto'])) return no(MOTIVI_ORDINE.TIPO);
      if ('contatto' in v) {
        if ('sensore' in v || 'rilevamento' in v) return no(MOTIVI_ORDINE.VALORE);
        if (!contattoValido(v.contatto)) return no(typeof v.contatto === 'string' ? MOTIVI_ORDINE.VALORE : MOTIVI_ORDINE.TIPO);
        return si({ cosa, valore: { contatto: v.contatto } });
      }
      if (typeof v.sensore !== 'string') return no(MOTIVI_ORDINE.TIPO);
      if (!(/** @type {readonly string[]} */ (SENSORI_SONAR)).includes(v.sensore)) return no(MOTIVI_ORDINE.VALORE);
      const r = rilevamentoOrdine(v.rilevamento);
      if (typeof r === 'string') return no(r);
      return si({ cosa, valore: { sensore: /** @type {'sfera' | 'towed'} */ (v.sensore), rilevamento: r } });
    }
    case 'attivo': {
      if (!oggettoCon(v, ['rilevamento', 'portata']) || !('rilevamento' in v) || !('portata' in v)) return no(MOTIVI_ORDINE.TIPO);
      if (typeof v.portata !== 'string') return no(MOTIVI_ORDINE.TIPO);
      if (!(/** @type {readonly string[]} */ (PORTATE_ATTIVO)).includes(v.portata)) return no(MOTIVI_ORDINE.VALORE);
      const portata = /** @type {'corta' | 'lunga'} */ (v.portata);
      if (v.rilevamento === null) return si({ cosa, valore: { rilevamento: null, portata } });
      const r = rilevamentoOrdine(v.rilevamento);
      if (typeof r === 'string') return no(r);
      return si({ cosa, valore: { rilevamento: r, portata } });
    }
    case 'albero': {
      if (!oggettoCon(v, ['quale', 'alzato']) || !('quale' in v) || !('alzato' in v)) return no(MOTIVI_ORDINE.TIPO);
      if (typeof v.quale !== 'string' || typeof v.alzato !== 'boolean') return no(MOTIVI_ORDINE.TIPO);
      if (!(/** @type {readonly string[]} */ (ALBERI)).includes(v.quale)) return no(MOTIVI_ORDINE.VALORE);
      return si({ cosa, valore: { quale: /** @type {'periscopio' | 'esm' | 'radar'} */ (v.quale), alzato: v.alzato } });
    }
    case 'radar': {
      if (typeof v !== 'boolean') return no(MOTIVI_ORDINE.TIPO);
      return si({ cosa, valore: v });
    }
    case 'designa': {
      if (v === null) return si({ cosa, valore: null });
      if (typeof v !== 'string') return no(MOTIVI_ORDINE.TIPO);
      if (!contattoValido(v)) return no(MOTIVI_ORDINE.VALORE);
      return si({ cosa, valore: v });
    }
    case 'abbandona': {
      if (typeof v !== 'string') return no(MOTIVI_ORDINE.TIPO);
      if (!contattoValido(v)) return no(MOTIVI_ORDINE.VALORE);
      return si({ cosa, valore: v });
    }
    case 'classifica': {
      if (!oggettoCon(v, ['contatto', 'classe']) || !('contatto' in v) || !('classe' in v)) return no(MOTIVI_ORDINE.TIPO);
      if (typeof v.contatto !== 'string' || (v.classe !== null && typeof v.classe !== 'string')) return no(MOTIVI_ORDINE.TIPO);
      if (!contattoValido(v.contatto)) return no(MOTIVI_ORDINE.VALORE);
      if (v.classe !== null && !(/** @type {readonly string[]} */ (CLASSI)).includes(v.classe)) return no(MOTIVI_ORDINE.VALORE);
      return si({ cosa, valore: { contatto: v.contatto, classe: /** @type {string | null} */ (v.classe) } });
    }
    case 'soluzione': {
      if (!oggettoCon(v, ['contatto', 'ora', 'distanza', 'rotta', 'velocita', 'rilevamento', 'cancella'])) return no(MOTIVI_ORDINE.TIPO);
      if (typeof v.contatto !== 'string') return no(MOTIVI_ORDINE.TIPO);
      if (!contattoValido(v.contatto)) return no(MOTIVI_ORDINE.VALORE);
      if ('cancella' in v) {
        if (v.cancella !== true) return no(MOTIVI_ORDINE.VALORE);
        if (Object.keys(v).length !== 2) return no(MOTIVI_ORDINE.VALORE);
        return si({ cosa, valore: { contatto: v.contatto, cancella: true } });
      }
      const { ora, distanza, rotta, velocita } = v;
      for (const x of [ora, distanza, rotta, velocita]) {
        if (typeof x !== 'number' || !Number.isFinite(x)) return no(MOTIVI_ORDINE.TIPO);
      }
      const L = SOLUZIONE_LIMITI;
      const [o, d, r, w] = /** @type {number[]} */ ([ora, distanza, rotta, velocita]);
      if (o < 0 || o > L.ORA_MAX || d <= 0 || d > L.DISTANZA_MAX || r < 0 || r > 360 || w < 0 || w > L.VELOCITA_MAX) {
        return no(MOTIVI_ORDINE.FUORI_LIMITI);
      }
      const rotta10 = Math.round(r * 10) / 10;
      /** @type {OrdineSoluzione} */
      const sol = {
        contatto: v.contatto,
        ora: Math.round(o * 10) / 10,
        distanza: Math.max(1, Math.round(d)),
        rotta: rotta10 >= 360 ? 0 : rotta10,
        velocita: Math.round(w * 10) / 10,
      };
      if (v.rilevamento !== undefined) {
        const ril = rilevamentoOrdine(v.rilevamento);
        if (typeof ril === 'string') return no(ril);
        sol.rilevamento = ril;
      }
      return si({ cosa, valore: sol });
    }
  }
  return no(MOTIVI_ORDINE.COSA);
}

/**
 * Valida un messaggio `entra`: lo scenario e, da v2, il livello di assistenza
 * facoltativo (predefinito ASSISTENZA_PREDEFINITA). Se il livello e' ammesso
 * in quella partita lo decide il server.
 * @param {Record<string, unknown>} m
 * @returns {{ok: true, scenario: typeof SCENARI[number], assistenza: number} | {ok: false, errore: string}}
 */
export function validaEntra(m) {
  if (typeof m.scenario !== 'string' || !(/** @type {readonly string[]} */ (SCENARI)).includes(m.scenario)) {
    return { ok: false, errore: ERRORI.SCENARIO_SCONOSCIUTO };
  }
  let assistenza = ASSISTENZA_PREDEFINITA;
  if (m.assistenza !== undefined && m.assistenza !== null) {
    if (typeof m.assistenza !== 'number' || !LIVELLI_ASSISTENZA.includes(m.assistenza)) {
      return { ok: false, errore: ERRORI.ASSISTENZA_NON_VALIDA };
    }
    assistenza = m.assistenza;
  }
  return { ok: true, scenario: /** @type {typeof SCENARI[number]} */ (m.scenario), assistenza };
}

// --- Forma dei messaggi dal server (per i tipi del client e delle prove) --------

/**
 * @typedef {object} MsgPartita
 * @property {'partita'} t
 * @property {string} id  identificativo della partita
 * @property {string} scenario
 * @property {number} ora  secondi di gioco dall'inizio della partita
 * @property {number} passo  passo della simulazione, s di gioco (0,1)
 * @property {number} scala_tempo
 * @property {boolean} in_pausa
 * @property {boolean} tempo_modificabile  scala e pausa si possono ordinare (solo se si e' soli)
 * @property {{lat: number, lon: number}} origine  origine del piano locale
 * @property {{x0: number, y0: number, x1: number, y1: number}} area  m
 * @property {{piattaforma: string, nome: string, sigla: string}} battello  il proprio
 */

/**
 * @typedef {object} MsgTempo
 * @property {'tempo'} t
 * @property {number} ora
 * @property {number} scala_tempo
 * @property {boolean} in_pausa
 * @property {boolean} tempo_modificabile
 */

/**
 * @typedef {object} StatoTowed
 * @property {typeof STATI_TOWED[number]} stato
 * @property {number} filato_m  cavo + antenna in acqua, m
 * @property {number | null} quota  quota dell'antenna, m (null se non e' in acqua)
 * @property {number} tempo_morto  s ancora senza fasci dopo un'accostata (0 = utilizzabile)
 * @property {boolean} sorda  troppo veloce, troppo lenta o in accostata: nessun rilevamento
 */

/**
 * @typedef {object} MsgStato
 * @property {'stato'} t
 * @property {number} ora  s di gioco
 * @property {number} x  m, est
 * @property {number} y  m, nord
 * @property {number} z  quota della chiglia, m (positiva verso il basso)
 * @property {number} rotta  gradi veri
 * @property {number} velocita  kt (negativa = indietro)
 * @property {number} velocita_verticale  m/s, positiva verso il basso
 * @property {number} assetto  gradi, positivo = prua in giu'
 * @property {number} giri  giri dell'elica al minuto (negativi = indietro)
 * @property {string | number} macchina  ordine di macchina in vigore
 * @property {number} timone  gradi, positivo = a dritta
 * @property {number} timoni_o  gradi, positivo = a scendere
 * @property {number | null} rotta_ordinata  null = timone a mano
 * @property {number | null} quota_ordinata  null = timoni orizzontali a mano
 * @property {'manuale' | 'automatica' | 'emersione'} modo_quota
 * @property {{attivo: boolean, waypoint: [number, number][], prossimo: number | null}} autopilota
 * @property {boolean} cavitazione
 * @property {number} v_cavitazione  kt: velocita' d'innesco alla quota attuale
 * @property {StatoTowed | null} towed  null se il battello non l'ha
 * @property {number} fondale  m d'acqua sotto la chiglia
 * @property {number} profondita_acqua  m, dalla superficie al fondo
 * @property {number | null} strato  quota dello strato, m (null = nessuno strato)
 * @property {string[]} avvisi  chiavi degli avvisi in corso
 * @property {{urti_fondale: number, oltre_collaudo: boolean, collasso: boolean}} danni
 * @property {{periscopio: boolean, esm: boolean, radar: boolean}} alberi  v2: alberi alzati
 * @property {boolean} radar_attivo  v2: il radar trasmette
 * @property {number} ascolto_attivo  v2: s di gioco che restano della finestra d'ascolto dell'ultimo ping (0 = si puo' pingare)
 * @property {number} assistenza  v2: livello di assistenza 0-3
 * @property {null | {sensore: 'sfera' | 'towed', rilevamento: number, contatto: string | null}} analizzatore
 *   v2: dove punta l'analizzatore (rilevamento vero del fascio; `contatto` se lo segue l'equipaggio)
 * @property {string | null} designato  v2: il contatto di riferimento delle stazioni
 */

/**
 * @typedef {object} MsgSonar
 * @property {'sonar'} t
 * @property {number} ora  s di gioco (intero): il fotogramma integra il secondo che finisce qui
 * @property {typeof SENSORI_SONAR[number]} sensore
 * @property {string} settori  base64 di SONAR.SETTORI byte (vedi SONAR)
 * @property {[number, number][]} ciechi  archi ciechi in gradi veri, [da, a] in senso orario
 * @property {number} [asse]  solo towed: rilevamento vero dell'asse dell'antenna, dall'antenna al battello
 *   (a cavo dritto e' la prua);
 *   ogni rilevamento ha il suo speculare 2·asse − rilevamento
 * @property {boolean} [sorda]  solo towed: nessun fascio (accostata, velocita')
 * @property {'stretta'} [banda]  v2: assente nei fotogrammi a banda larga (uno al secondo, come in v1);
 *   'stretta' nei fotogrammi a banda stretta (ogni SPETTRO.PERIODO s): in ogni settore l'eccesso
 *   della riga piu' forte della finestra del sensore
 */

/**
 * @typedef {object} MsgSpettro
 * @property {'spettro'} t
 * @property {number} ora  s di gioco (multiplo di SPETTRO.PERIODO)
 * @property {'sfera' | 'towed'} sensore
 * @property {number} rilevamento  rilevamento vero del fascio dell'analizzatore, al decimo
 * @property {string | null} contatto  il contatto che il fascio segue, o null
 * @property {number} da_hz @property {number} passo_hz  finestra LOFAR (SPETTRO[sensore])
 * @property {string} righe  base64 di SPETTRO[sensore].RIGHE byte, quantizzati come `sonar`
 * @property {number} demon_da_hz @property {number} demon_passo_hz
 * @property {string} demon  base64 di SPETTRO[sensore].DEMON_RIGHE byte: lo spettro della modulazione
 *   d'ampiezza del rumore (righe d'asse e di pala)
 * @property {number} [asse]  solo towed: come in `sonar` (il fascio sente anche lo speculare)
 * @property {boolean} [sorda]  solo towed: solo fondo
 */

/**
 * @typedef {object} MsgEco
 * @property {'eco'} t
 * @property {number} ora  s di gioco: arrivo dell'eco (ping + andata e ritorno)
 * @property {number} ping  numero del proprio ping (1, 2, …)
 * @property {number} rilevamento  gradi veri, misurato, al decimo
 * @property {number} distanza  m, misurata (tempo d'andata e ritorno per 1500 m/s / 2), intera
 * @property {number} forza  eccesso di segnale dell'eco, dB, al mezzo dB
 * @property {number} riverbero  riverberazione rispetto al rumore alla distanza dell'eco, dB, intero
 */

/**
 * @typedef {object} MsgIntercetto
 * @property {'intercetto'} t
 * @property {number} ora  s di gioco: arrivo del ping (un solo percorso)
 * @property {number} rilevamento  gradi veri, misurato, intero
 * @property {'ping'} tipo  (da F3 anche 'siluro')
 * @property {number} frequenza_khz  misurata, al decimo di kHz
 * @property {number} livello  dB sopra la soglia del ricevitore, intero
 */

/**
 * @typedef {object} MsgTransitorio
 * @property {'transitorio'} t
 * @property {number} ora  s di gioco: arrivo del transitorio
 * @property {'sfera' | 'towed'} sensore
 * @property {number} rilevamento  gradi veri, misurato, intero
 * @property {number | null} speculare  solo towed: l'altro rilevamento possibile; sfera: null
 * @property {typeof TIPI_TRANSITORIO[number]} tipo  come lo riconosce il sonarista
 * @property {number} forza  eccesso di segnale, dB, intero
 */

/**
 * Un oggetto visto al periscopio.
 * @typedef {object} OggettoVisivo
 * @property {number} vista  numero di vista: lo stesso finche' l'oggetto resta in vista, mai un'identita'
 * @property {number} rilevamento  gradi veri, misurato, al decimo
 * @property {number | null} aspetto  angolo sulla prua del bersaglio stimato dall'osservatore,
 *   gradi interi da −180 a 180 (positivo = se ne vede il fianco di dritta); null per un albero
 * @property {string | null} sagoma  nome dell'immagine originale (per esempio 'FOREST2'); null = un
 *   albero o un periscopio, che non ha sagoma
 * @property {number | null} elevazione_alberi  gradi, angolo misurato fra linea d'acqua e testa
 *   d'albero (con l'errore dell'osservatore), tre decimali; null se non si legge
 * @property {Array<typeof LUCI[number]> | null} luci  di notte le luci di navigazione viste; di giorno null
 * @property {boolean} sotto_orizzonte  lo scafo e' sotto l'orizzonte: lo stadimetro non e' affidabile
 * @property {boolean} scia  si vede la scia (onda di prua o pennacchio del periscopio)
 */

/**
 * @typedef {object} MsgVisivo
 * @property {'visivo'} t
 * @property {number} ora
 * @property {OggettoVisivo[]} oggetti
 */

/**
 * @typedef {object} MsgEsm
 * @property {'esm'} t
 * @property {number} ora
 * @property {{rilevamento: number, tipo: string, banda: string, livello: number}[]} emissioni
 *   rilevamento misurato (intero), tipo di radar riconosciuto, banda NATO (lettera), dB sopra la soglia (intero)
 */

/**
 * @typedef {object} MsgRadar
 * @property {'radar'} t
 * @property {number} ora  s di gioco, alla fine di un giro d'antenna
 * @property {{rilevamento: number, distanza: number}[]} echi  misurati: gradi veri al decimo, m interi
 */

/**
 * @typedef {object} MsgTracce
 * @property {'tracce'} t
 * @property {number} ora
 * @property {{contatto: string, sensori: string[], rilevamento: number, variazione: number | null,
 *   classe: string | null, confidenza: number | null, stato: 'nuova' | 'tenuta' | 'persa',
 *   speculare?: number | null}[]} tracce
 */

/**
 * @typedef {object} MsgSoluzione
 * @property {'soluzione'} t
 * @property {string} contatto
 * @property {number} ora
 * @property {number} rilevamento  rilevamento vero del bersaglio all'`ora`, dalla propria posizione
 * @property {number} distanza @property {number} rotta @property {number} velocita
 * @property {number | null} q  0-100 (null nell'eco della soluzione del comandante)
 * @property {{asse_lungo: number, asse_corto: number, orientamento: number} | null} ellisse  (null
 *   nell'eco della soluzione del comandante)
 * @property {'equipaggio' | 'comandante'} origine
 * @property {boolean} [esatta]  solo al livello 3, solo per i contatti non umani
 */

/**
 * @typedef {object} MsgRapporto
 * @property {'rapporto'} t
 * @property {number} ora
 * @property {'sonar' | 'guardia' | 'timone' | 'macchina' | 'navigazione' | 'tiro'} chi  'tiro' = centrale di tiro (TMA, v2)
 * @property {string} chiave  per i cataloghi delle lingue, es. 'sonar.nuovo_contatto' (elenco: RAPPORTI)
 * @property {Record<string, string | number | boolean | null>} parametri
 */

// --- Decodifica e codifica -----------------------------------------------------

/**
 * @typedef {{v: number, uid: number, nome: string, ruolo: string, exp: number, nonce: string}} CaricoBiglietto
 * @typedef {{ok: true, carico: CaricoBiglietto} | {ok: false, errore: string}} EsitoBiglietto
 * @typedef {{t: string, [k: string]: unknown}} Messaggio
 * @typedef {{ok: true, messaggio: Messaggio} | {ok: false, errore: string}} EsitoDecodifica
 */

const codificatore = new TextEncoder();
const decodificatore = new TextDecoder('utf-8', { fatal: true });

/**
 * Decodifica e valida la forma minima di un messaggio in arrivo.
 * Non lancia mai: chi riceve dalla rete non deve poter far cadere il server.
 *
 * @param {string} testo
 * @returns {EsitoDecodifica}
 */
export function decodifica(testo) {
  if (typeof testo !== 'string') return { ok: false, errore: ERRORI.MESSAGGIO_MALFORMATO };
  if (codificatore.encode(testo).length > MESSAGGIO_MAX_BYTE) {
    return { ok: false, errore: ERRORI.MESSAGGIO_TROPPO_GRANDE };
  }
  /** @type {unknown} */
  let dato;
  try {
    dato = JSON.parse(testo);
  } catch {
    return { ok: false, errore: ERRORI.MESSAGGIO_MALFORMATO };
  }
  if (dato === null || typeof dato !== 'object' || Array.isArray(dato)) {
    return { ok: false, errore: ERRORI.MESSAGGIO_MALFORMATO };
  }
  const t = /** @type {Record<string, unknown>} */ (dato).t;
  if (typeof t !== 'string' || t.length === 0 || t.length > 32) {
    return { ok: false, errore: ERRORI.MESSAGGIO_MALFORMATO };
  }
  return { ok: true, messaggio: /** @type {Messaggio} */ (dato) };
}

/**
 * @param {string} t
 * @param {Record<string, unknown>} [campi]
 * @returns {string}
 */
export function codifica(t, campi = {}) {
  return JSON.stringify({ t, ...campi });
}

// --- Biglietto -----------------------------------------------------------------

/** @param {Uint8Array} byte */
export function b64urlCodifica(byte) {
  let binario = '';
  for (const b of byte) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * @param {string} testo
 * @returns {Uint8Array | null}
 */
export function b64urlDecodifica(testo) {
  if (!/^[A-Za-z0-9_-]*$/.test(testo)) return null;
  const base64 = testo.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (testo.length % 4)) % 4);
  try {
    const binario = atob(base64);
    const out = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) out[i] = binario.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * HMAC-SHA256 con Web Crypto.
 * @param {string} segreto
 * @param {string} testo
 * @returns {Promise<Uint8Array>}
 */
async function hmac(segreto, testo) {
  const sottile = globalThis.crypto?.subtle;
  if (!sottile) throw new Error('Web Crypto non disponibile');
  const chiave = await sottile.importKey('raw', codificatore.encode(segreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await sottile.sign('HMAC', chiave, codificatore.encode(testo)));
}

/**
 * Confronto a tempo costante: non rivela con la durata quanti byte coincidono.
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 */
function ugualiATempoCostante(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Firma un carico come fa `App\Gioco\Biglietto::firma()` in PHP.
 * Serve alle prove di compatibilita' e agli strumenti, non al server in esercizio.
 *
 * @param {Record<string, unknown>} carico
 * @param {string} segreto
 */
export async function firmaBiglietto(carico, segreto) {
  const corpo = b64urlCodifica(codificatore.encode(JSON.stringify(carico)));
  return corpo + '.' + b64urlCodifica(await hmac(segreto, corpo));
}

/**
 * Verifica un biglietto: firma, forma, versione, scadenza.
 * Il controllo del riuso (nonce) spetta a chi riceve, perche' richiede memoria.
 *
 * @param {unknown} biglietto
 * @param {string} segreto
 * @param {number} adessoSecondi  ora Unix in secondi
 * @returns {Promise<EsitoBiglietto>}
 */
export async function verificaBiglietto(biglietto, segreto, adessoSecondi) {
  if (typeof biglietto !== 'string' || biglietto === '') return { ok: false, errore: ERRORI.BIGLIETTO_ASSENTE };
  if (biglietto.length > 1024) return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };
  const parti = biglietto.split('.');
  if (parti.length !== 2) return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };
  const [corpo, sigillo] = parti;
  // Si confronta la GRAFIA canonica del sigillo, non i byte decodificati: in
  // base64 l'ultimo carattere porta bit di riempimento che la decodifica
  // ignora, e confrontando i byte lo stesso sigillo avrebbe piu' grafie valide
  // (trovato con una prova: 3 biglietti alterati su 64 passavano).
  const atteso = codificatore.encode(b64urlCodifica(await hmac(segreto, corpo)));
  if (!ugualiATempoCostante(atteso, codificatore.encode(sigillo))) return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };

  const corpoByte = b64urlDecodifica(corpo);
  if (!corpoByte) return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };
  /** @type {unknown} */
  let c;
  try {
    c = JSON.parse(decodificatore.decode(corpoByte));
  } catch {
    return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };
  }
  if (c === null || typeof c !== 'object') return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };
  const k = /** @type {Record<string, unknown>} */ (c);
  if (k.v !== 1
    || !Number.isInteger(k.uid) || /** @type {number} */ (k.uid) <= 0
    || typeof k.nome !== 'string' || k.nome === ''
    || typeof k.ruolo !== 'string'
    || !Number.isInteger(k.exp)
    || typeof k.nonce !== 'string' || !/^[0-9a-f]{16,64}$/.test(k.nonce)) {
    return { ok: false, errore: ERRORI.BIGLIETTO_NON_VALIDO };
  }
  if (/** @type {number} */ (k.exp) + TOLLERANZA_OROLOGIO_SECONDI < adessoSecondi) {
    return { ok: false, errore: ERRORI.BIGLIETTO_SCADUTO };
  }
  return {
    ok: true,
    carico: {
      v: 1,
      uid: /** @type {number} */ (k.uid),
      nome: k.nome,
      ruolo: k.ruolo,
      exp: /** @type {number} */ (k.exp),
      nonce: k.nonce,
    },
  };
}
