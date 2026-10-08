// Finto server di gioco per sviluppare il client senza il server vero (protocollo v2).
//
//   node tests/strumenti/finto_server.mjs [--porta 8197] [--notte] [--partenza x,y,rotta]
//   TERMOCLINO_CONFIG=$PWD/tests/strumenti/config_finto_server.php php -S 127.0.0.1:8161 -t web web/index.php
//   # e nel browser http://127.0.0.1:8161/plancia; con un'altra porta del finto server, FINTO_WS=ws://127.0.0.1:<porta>/
//   # (il filone J in F2 ha usato 8297/8298 con i siti 8261/8262). Il server riprende il battello di chi
//   # rientra con lo stesso nome entro 5 minuti, come quello vero.
//
// La configurazione di prova cambia solo gioco.ws_url (e con lui la Content-Security-Policy della
// pagina, che altrimenti bloccherebbe il collegamento): vedi tests/strumenti/config_finto_server.php.
//
// Parla la versione 2 di docs/PROTOCOLLO.md con le funzioni di shared/protocol.js, accetta qualunque
// biglietto (è uno strumento di sviluppo: non va mai esposto), e simula in modo plausibile ma
// semplificato una palestra di TORPEX: ogni connessione che `entra` governa un 688; tre
// cacciatorpediniere, un mercantile e due sorgenti biologiche fanno rumore; i giocatori si sentono fra
// loro. Non è il modello del server vero (server/src/sim): serve a dare al client messaggi della forma
// giusta, con numeri credibili. In più della v1: banda stretta e analizzatore (LOFAR, DEMON) con righe
// tonali inventate qui (le firme vere sono di shared/data), ping con echi e intercettazioni, transitori,
// periscopio (sagome e angolo d'albero), ESM e radar, tracce e soluzioni dell'equipaggio ai quattro
// livelli di assistenza. Rispetta la nebbia di guerra: degli altri manda solo misure e ipotesi.
// Con --notte (o FINTO_NOTTE=1) il periscopio vede di notte: luci di navigazione e sagome solo da vicino.
//
// Mai 8095 (produzione) né 8096 (server di sviluppo vero).
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from '../../server/node_modules/ws/wrapper.mjs';
import {
  PROTOCOLLO_VERSIONE, DAL_CLIENT, DAL_SERVER, ERRORI, MOTIVI_ORDINE, SONAR, SPETTRO, WAYPOINT_MAX,
  codifica, decodifica, validaOrdine, validaEntra, quantizzaSE, codificaSettori, b64urlDecodifica, codificaByte,
} from '../../shared/protocol.js';
import { normalizza360, normalizza180, nodiInMs, piediInMetri } from '../../shared/units.js';
import { fondaleSintetico } from '../../web/assets/js/client/fondale.js';
import { caricaAmbiente } from '../../shared/ambiente.js';

/** Le chiavi dei rapporti che questo server può mandare (un sottoinsieme di RAPPORTI di shared/protocol.js). */
export const CHIAVI_RAPPORTO = Object.freeze([
  'sonar.nuovo_contatto', 'sonar.contatto_perso',
  'towed.in_filare', 'towed.filata', 'towed.in_ritiro', 'towed.ritirata', 'towed.tagliata', 'towed.persa',
  'towed.stabilizzata', 'towed.sorda', 'towed.curva', 'towed.velocita_pericolosa',
  'macchina.cavitazione', 'macchina.fine_cavitazione',
  'guardia.quota_collaudo_vicina', 'guardia.oltre_quota_collaudo', 'guardia.collasso', 'guardia.urto_fondale',
  'guardia.in_superficie', 'navigazione.fondale_vicino', 'navigazione.waypoint_raggiunto',
  'navigazione.ultimo_waypoint', 'timone.rotta_raggiunta', 'timone.quota_raggiunta', 'guardia.ripreso_il_comando',
  // v2
  'sonar.transitorio', 'sonar.eco', 'sonar.fine_ascolto', 'intercetto.ping', 'periscopio.nave_in_vista',
  'periscopio.scia', 'guardia.alberi_abbassati', 'esm.radar', 'sonar.classificato', 'tma.soluzione',
  'tma.consiglio_manovra', 'tma.distanza_non_osservabile', 'tma.ekelund',
]);

const NOTTE = process.argv.includes('--notte') || process.env.FINTO_NOTTE === '1';
/** --partenza x,y,rotta: il primo battello parte lì (per provare il periscopio senza navigare un'ora). */
const PARTENZA_FORZATA = (() => {
  const i = process.argv.indexOf('--partenza');
  const v = i > 0 ? process.argv[i + 1].split(',').map(Number) : [];
  return v.length === 3 && v.every(Number.isFinite) ? { x: v[0], y: v[1], rotta: v[2] } : null;
})();

// la batimetria vera dello scenario (shared/ambiente.js), o il fondale sintetico del client se manca
let AREA = { x0: -60000, y0: -60000, x1: 60000, y1: 60000 };
let ORIGINE = { lat: 61.75, lon: -6.833333 };
let STRATO = 60;
/** @type {(x: number, y: number) => number | null} */
let fondale = fondaleSintetico(AREA);
/** @type {{ x: number, y: number, rotta: number, quota: number }[]} */
let PARTENZE = [];
/** @type {any} */
let VALORI = null;
try {
  const amb = await caricaAmbiente('torpex_palestra');
  AREA = { ...amb.area };
  ORIGINE = { lat: amb.origine.lat, lon: amb.origine.lon };
  STRATO = amb.strato(0, 0)?.profondita ?? STRATO;
  VALORI = amb.valori;
  PARTENZE = VALORI.partenze;
  fondale = (x, y) => {
    const d = amb.fondale(x, y);
    return Number.isFinite(d) ? d : null;
  };
} catch (e) {
  console.warn('batimetria vera non disponibile, uso il fondale sintetico:', /** @type {Error} */ (e).message);
}
const VELOCITA = { rev: -8, stop: 0, '1/3': 8, '2/3': 16, std: 22, full: 28, flank: 32 };
const COLLAUDO = 290, COLLASSO = 450, FILATO_MAX = 803;
/** Quota massima degli alberi (periscopica + 3 m) e quella a cui la guardia li abbassa. */
const QUOTA_ALBERI = 21, QUOTA_ABBASSA = 24;
/** Portate del ping, m (10 000 e 40 000 iarde). */
const PORTATA_PING = { corta: 9144, lunga: 36576 };
const C_SUONO = 1500;

/** @param {number} a @param {number} b */
const casuale = (a, b) => a + Math.random() * (b - a);
/** Normale standard (Box-Muller). */
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());
/** Rumore esponenziale di un rivelatore di energia, in dB rispetto alla media. */
const granello = () => 10 * Math.log10(-Math.log(Math.random() || 1e-9));
/** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 */
const rilevamentoDa = (x0, y0, x1, y1) => normalizza360((Math.atan2(x1 - x0, y1 - y0) * 180) / Math.PI);

// ------------------------------------------------------------------------------------- firme (inventate)

/**
 * Firme acustiche e ottiche INVENTATE per il finto server (quelle vere le scrive il filone H in
 * shared/data): righe tonali sopra la banda larga (dB), giri per nodo, pale, altezza d'albero, figura del
 * periscopio, radar.
 * @typedef {{ classe: string, umano: boolean, superficie: boolean, righe: { hz: number, db: number }[],
 *   giriPerNodo: number, pale: number, cavita: boolean, albero: number, sagoma: string | null,
 *   radar: { tipo: string, banda: string, portata: number }[], ts: number }} Firma
 */
/** @type {Record<string, Firma>} */
const FIRME = {
  forrest_sherman: {
    classe: 'forrest_sherman', umano: false, superficie: true,
    righe: [{ hz: 60, db: 12 }, { hz: 120, db: 8 }, { hz: 180, db: 5 }, { hz: 47, db: 9 }, { hz: 410, db: 6 }],
    giriPerNodo: 10, pale: 4, cavita: true, albero: 30, sagoma: 'FOREST',
    radar: [{ tipo: 'AN/SPS-40', banda: 'B', portata: 70000 }, { tipo: 'AN/SPS-10', banda: 'G', portata: 50000 }], ts: 25,
  },
  mercantile_generico: {
    classe: 'mercantile_generico', umano: false, superficie: true,
    righe: [{ hz: 50, db: 13 }, { hz: 100, db: 9 }, { hz: 150, db: 6 }, { hz: 34, db: 8 }],
    giriPerNodo: 9, pale: 5, cavita: true, albero: 32, sagoma: 'MERCH',
    radar: [{ tipo: 'navigazione', banda: 'I', portata: 30000 }], ts: 28,
  },
  biologico: {
    classe: 'biologico', umano: false, superficie: false, righe: [{ hz: 20, db: 6 }],
    giriPerNodo: 0, pale: 0, cavita: false, albero: 0, sagoma: null, radar: [], ts: 5,
  },
  '688': {
    classe: '688', umano: true, superficie: false, righe: [{ hz: 60, db: 6 }],
    giriPerNodo: 5.6, pale: 7, cavita: false, albero: 6, sagoma: null, radar: [{ tipo: 'AN/BPS-15', banda: 'I', portata: 25000 }], ts: 18,
  },
};

// ------------------------------------------------------------------------------------- mondo

/**
 * @typedef {{ id: string, x: number, y: number, z: number, rotta: number, v: number, firma: Firma,
 *   sl: (o: number) => number, transitorio: number }} Bersaglio
 */

/**
 * Bersagli di superficie e biologici, dalle posizioni dello scenario (quelle del 1989 riportate sulla
 * carta vera) o, senza scenario, inventati: si muovono da soli in linea retta e non mandano mai la
 * loro posizione.
 * @type {Bersaglio[]}
 */
const bersagli = VALORI
  ? [
    ...VALORI.navi.map((/** @type {any} */ n) => ({ id: n.id, x: n.x, y: n.y, z: 4, rotta: n.rotta, v: n.velocita,
      firma: FIRME[n.piattaforma] ?? FIRME.mercantile_generico, transitorio: -1e9,
      sl: () => (n.classe === 'mercantile' ? 157 : 152) })),
    ...VALORI.biologici.map((/** @type {any} */ b, /** @type {number} */ i) => ({ id: b.id, x: b.x, y: b.y, z: 30, rotta: casuale(0, 360), v: 2,
      firma: FIRME.biologico, transitorio: -1e9,
      sl: (/** @type {number} */ o) => (Math.sin(o / 23 + i * 3) > 0.6 ? 142 : 0) })),
  ]
  : [
    ...[0, 1, 2].map((i) => ({ id: `dd${i + 1}`, x: -9000 + i * 2500, y: -16000 - i * 1800, z: 4, rotta: 315, v: 11,
      firma: FIRME.forrest_sherman, transitorio: -1e9, sl: () => 152 })),
    { id: 'merc1', x: 14000, y: -8000, z: 6, rotta: 40, v: 13, firma: FIRME.mercantile_generico, transitorio: -1e9, sl: () => 157 },
    ...[0, 1].map((i) => ({ id: `bio${i + 1}`, x: casuale(-20000, 20000), y: casuale(5000, 25000), z: 30, rotta: casuale(0, 360), v: 2,
      firma: FIRME.biologico, transitorio: -1e9,
      sl: (/** @type {number} */ o) => (Math.sin(o / 23 + i * 3) > 0.6 ? 142 : 0) })),
  ];
let prossimaPartenza = 0;

/** @type {Set<Battello>} */
const battelli = new Set();
/** Battelli rimasti senza linea, per nome dell'utente: chi rientra entro 5 minuti li riprende. */
/** @type {Map<string, { battello: Battello, dal: number }>} */
const senzaLinea = new Map();
let ora = 0;
let scala = 1;
let pausa = false;
let prossimaPartita = 1;
const ID_PARTITA = `finta-${Date.now().toString(36)}`;

/**
 * Una sorgente come la vede un battello: posizione e moto (solo per i conti di questo server), livello a
 * banda larga e firma.
 * @typedef {{ x: number, y: number, z: number, rotta: number, v: number, sl: number, chiave: object,
 *   firma: Firma, alberi: { periscopio: boolean, esm: boolean, radar: boolean } | null, radarAttivo: boolean }} Sorgente
 */

/**
 * Perdita di trasmissione (dB) semplificata: sferica più assorbimento, più lo strato.
 * @param {number} r m @param {number} khz
 */
function perdita(r, khz) {
  return 20 * Math.log10(Math.max(1, r)) + (0.003 * khz * khz + 0.05) * (r / 1000);
}

/**
 * Risposta di un sensore fuori dalla sua banda (PROTOCOLLO v2: −40 dB per decade fuori dalla banda).
 * @param {'sfera' | 'towed'} sensore @param {number} hz
 */
function rispostaBanda(sensore, hz) {
  const [lo, hi] = sensore === 'towed' ? [30, 1000] : [500, 5000];
  if (hz < lo) return -40 * Math.log10(lo / Math.max(hz, 1));
  if (hz > hi) return -40 * Math.log10(hz / hi);
  return 0;
}

/**
 * @typedef {{ designazione: string, colpi: number, ultimo: number, inizio: number, sensori: Set<string>,
 *   storia: { ora: number, ril: number }[], classe: string | null, confidenza: number, comandante: string | null,
 *   annunciata: boolean, stato: string, bias: number[], qAnnunciata: boolean, consiglio: number,
 *   nonOss: boolean, solCte: object | null, abbandonato: boolean }} Contatto
 */

class Battello {
  /** @param {import('ws').WebSocket} ws @param {string} nome @param {number} assistenza */
  constructor(ws, nome, assistenza) {
    this.ws = ws;
    this.nome = nome;
    let x = 0, y = 0, rotta = 320;
    const p = (prossimaPartenza === 0 && PARTENZA_FORZATA) || PARTENZE[prossimaPartenza++ % Math.max(1, PARTENZE.length)];
    if (p === PARTENZA_FORZATA) prossimaPartenza++;
    if (p) ({ x, y, rotta } = p);
    else {
      for (let k = 0; k < 200; k++) {
        x = casuale(-15000, 15000); y = casuale(-25000, 0);
        if ((fondale(x, y) ?? 0) > 150) break;
      }
    }
    this.x = x; this.y = y; this.z = 6; this.rotta = rotta; this.v = 0; this.vz = 0;
    this.macchina = 'stop'; this.timone = 0; this.timoni_o = 0;
    /** @type {number | null} */ this.rotta_ordinata = null;
    /** @type {number | null} */ this.quota_ordinata = 6;
    this.modo_quota = 'automatica';
    this.autopilota = { attivo: false, /** @type {[number, number][]} */ waypoint: [], /** @type {number | null} */ prossimo: null };
    this.cavita = false;
    this.towed = { stato: 'stivata', filato_m: 0, quota: /** @type {number | null} */ (null), tempo_morto: 0, sorda: false };
    this.urti = 0;
    this.rottaPrima = rotta;
    /** @type {Map<object, Contatto>} */
    this.contatti = new Map();
    this.prossimoContatto = 1;
    /** @type {Record<string, number>} */
    this.ultimoAvviso = {};
    this.quotaAnnunciata = true;
    this.rottaAnnunciata = true;
    // v2
    this.assistenza = assistenza;
    this.alberi = { periscopio: false, esm: false, radar: false };
    this.radarAttivo = false;
    /** @type {{ sensore: 'sfera' | 'towed', rilevamento: number, contatto: string | null } | null} */
    this.analizzatore = null;
    /** @type {string | null} */ this.designato = null;
    this.fineAscolto = 0;
    this.numeroPing = 0;
    /** @type {{ ora: number, fai: () => void }[]} */
    this.inArrivo = [];
    /** @type {Map<object, number>} */ this.visti = new Map();
    this.prossimaVista = 1;
    /** @type {Map<string, number>} */ this.radarSentiti = new Map();
    this.quotaTransitorio = this.z;
    /** ora dell'ultimo transitorio di questo battello (alza per un attimo il suo livello) */
    this.transitorio = -1e9;
    /** cambi di rotta propri oltre 20° (per la «manovra» della TMA finta): ore */
    /** @type {number[]} */ this.gambe = [0];
    this.rottaGamba = rotta;
  }

  /** @param {string} t @param {Record<string, unknown>} campi */
  manda(t, campi) {
    if (this.ws.readyState === 1) this.ws.send(codifica(t, campi));
  }

  /** @param {string} chi @param {string} chiave @param {Record<string, unknown>} [parametri] @param {number} [ogni] s minimi fra due uguali */
  rapporto(chi, chiave, parametri = {}, ogni = 0) {
    if (ogni && ora - (this.ultimoAvviso[chiave] ?? -1e9) < ogni) return;
    this.ultimoAvviso[chiave] = ora;
    this.manda(DAL_SERVER.RAPPORTO, { ora: Math.floor(ora), chi, chiave, parametri });
  }

  get vCavitazione() {
    return 8 * Math.sqrt((Math.max(0, this.z) + 10.1) / (20 + 10.1));
  }

  /** Livello di sorgente del battello visto dagli altri. */
  sl() {
    return 125 + 20 * Math.log10(Math.max(Math.abs(this.v), 3) / 5) + (this.cavita ? 18 : 0) + (this.modo_quota === 'emersione' ? 20 : 0);
  }

  /** Un passo di simulazione. @param {number} dt s di gioco */
  passo(dt) {
    // autopilota e timoniere
    const ap = this.autopilota;
    if (ap.attivo && ap.prossimo !== null) {
      const [wx, wy] = ap.waypoint[ap.prossimo];
      if (Math.hypot(wx - this.x, wy - this.y) < 400) {
        this.rapporto('navigazione', 'navigazione.waypoint_raggiunto', { indice: ap.prossimo });
        if (ap.prossimo + 1 < ap.waypoint.length) ap.prossimo++;
        else {
          this.rapporto('navigazione', 'navigazione.ultimo_waypoint');
          ap.attivo = false; ap.prossimo = null; this.rotta_ordinata = Math.round(this.rotta);
        }
      } else {
        this.rotta_ordinata = rilevamentoDa(this.x, this.y, wx, wy);
      }
    }
    if (this.rotta_ordinata !== null) {
      const d = normalizza180(this.rotta_ordinata - this.rotta);
      this.timone = Math.abs(d) > 45 ? Math.sign(d) * 30 : Math.max(-15, Math.min(15, Math.round(d)));
      if (Math.abs(d) < 1 && !this.rottaAnnunciata) {
        this.rottaAnnunciata = true;
        if (!ap.attivo) this.rapporto('timone', 'timone.rotta_raggiunta', { rotta: Math.round(this.rotta_ordinata) });
      }
    }
    // macchina, timone, quota
    const obiettivo = VELOCITA[/** @type {keyof typeof VELOCITA} */ (this.macchina)] ?? 0;
    const acc = obiettivo > this.v ? 0.15 : 0.25;
    this.v += Math.max(-acc * dt, Math.min(acc * dt, obiettivo - this.v));
    const giro = (this.timone / 30) * Math.min(2.5, Math.abs(this.v) * 0.12) * Math.sign(this.v || 1);
    this.rotta = normalizza360(this.rotta + giro * dt);
    if (Math.abs(normalizza180(this.rotta - this.rottaGamba)) > 20) { this.gambe.push(ora); this.rottaGamba = this.rotta; }
    const vms = Math.abs(nodiInMs(this.v));
    if (this.modo_quota === 'emersione') {
      this.vz = -2;
      if (this.z <= 0.5) {
        this.modo_quota = 'automatica'; this.quota_ordinata = 0;
        this.rapporto('guardia', 'guardia.in_superficie');
      }
    } else if (this.modo_quota === 'automatica' && this.quota_ordinata !== null) {
      const max = 0.25 * vms + 0.3;
      this.vz = Math.max(-max, Math.min(max, (this.quota_ordinata - this.z) * 0.08));
      if (Math.abs(this.quota_ordinata - this.z) < 1 && !this.quotaAnnunciata) {
        this.quotaAnnunciata = true;
        this.rapporto('timone', 'timone.quota_raggiunta', { quota: Math.round(this.quota_ordinata * 10) / 10 });
      }
    } else {
      this.vz = (this.timoni_o / 20) * vms * 0.25;
    }
    this.z = Math.max(0, this.z + this.vz * dt);
    const a = (this.rotta * Math.PI) / 180;
    this.x += nodiInMs(this.v) * Math.sin(a) * dt;
    this.y += nodiInMs(this.v) * Math.cos(a) * dt;
    // fondo, quote limite, cavitazione
    const prof = fondale(this.x, this.y) ?? 2000;
    if (this.z > prof - 3) {
      this.z = Math.max(0, prof - 3);
      this.urti++;
      this.rapporto('guardia', 'guardia.urto_fondale', { quota: Math.round(this.z) }, 10);
    } else if (prof - this.z < 30) this.rapporto('navigazione', 'navigazione.fondale_vicino', { sotto_chiglia: Math.round(prof - this.z) }, 30);
    if (this.z > COLLAUDO) this.rapporto('guardia', 'guardia.oltre_quota_collaudo', { quota: Math.round(this.z), collaudo: COLLAUDO }, 20);
    else if (this.z > COLLAUDO - 30) this.rapporto('guardia', 'guardia.quota_collaudo_vicina', { quota: Math.round(this.z), collaudo: COLLAUDO }, 30);
    const cavita = Math.abs(this.v) > this.vCavitazione;
    if (cavita !== this.cavita) {
      this.cavita = cavita;
      this.rapporto('macchina', cavita ? 'macchina.cavitazione' : 'macchina.fine_cavitazione', { v_cavitazione: Math.round(this.vCavitazione * 10) / 10 }, 5);
    }
    // alberi: oltre la quota degli alberi la guardia li abbassa; periscopio in corsa: scia
    if ((this.alberi.periscopio || this.alberi.esm || this.alberi.radar) && this.z > QUOTA_ABBASSA) {
      this.alberi = { periscopio: false, esm: false, radar: false };
      this.radarAttivo = false;
      this.rapporto('guardia', 'guardia.alberi_abbassati', { quota: Math.round(this.z) });
    }
    if (this.alberi.periscopio && Math.abs(this.v) > 10) this.rapporto('guardia', 'periscopio.scia', { velocita: Math.round(Math.abs(this.v) * 10) / 10 }, 60);
    // cambi di quota: lo scafo scricchiola (un transitorio che gli altri sentono)
    if (Math.abs(this.z - this.quotaTransitorio) > 15) {
      this.quotaTransitorio = this.z;
    /** ora dell'ultimo transitorio di questo battello (alza per un attimo il suo livello) */
    this.transitorio = -1e9;
      if (Math.random() < 0.6) transitorioA(this, 'scafo', 130);
    }
    // antenna rimorchiata
    const tw = this.towed;
    if (tw.stato === 'in_filare') {
      tw.filato_m = Math.min(FILATO_MAX, tw.filato_m + (FILATO_MAX / 420) * dt);
      if (tw.filato_m >= FILATO_MAX) { tw.stato = 'filata'; tw.tempo_morto = 60; this.rapporto('sonar', 'towed.filata'); }
    } else if (tw.stato === 'in_ritiro') {
      tw.filato_m = Math.max(0, tw.filato_m - (FILATO_MAX / 420) * dt);
      if (tw.filato_m <= 0) { tw.stato = 'stivata'; this.rapporto('sonar', 'towed.ritirata'); }
    }
    if (tw.stato === 'filata') {
      if (Math.abs(normalizza180(this.rotta - this.rottaPrima)) > 10) {
        tw.tempo_morto = Math.max(tw.tempo_morto, Math.min(480, Math.max(120, FILATO_MAX / Math.max(vms, 0.5))));
        this.rottaPrima = this.rotta;
      }
      const prima = tw.tempo_morto;
      tw.tempo_morto = Math.max(0, tw.tempo_morto - dt);
      if (prima > 0 && tw.tempo_morto === 0) this.rapporto('sonar', 'towed.stabilizzata');
      tw.sorda = tw.tempo_morto > 0 || Math.abs(this.v) > 12 || Math.abs(this.v) < 3;
      if (Math.abs(this.v) > 12) this.rapporto('sonar', 'towed.sorda', { velocita: Math.round(Math.abs(this.v)) }, 60);
      if (Math.abs(this.v) > 16) this.rapporto('guardia', 'towed.velocita_pericolosa', { velocita_danno: 18 }, 30);
      if (Math.abs(this.v) > 18 && Math.random() < 0.002 * dt) { tw.stato = 'persa'; tw.filato_m = 0; this.rapporto('sonar', 'towed.persa'); }
    } else {
      this.rottaPrima = this.rotta;
      tw.sorda = false;
    }
    tw.quota = tw.stato === 'stivata' || tw.stato === 'tagliata' || tw.stato === 'persa' ? null : Math.round(this.z + tw.filato_m * 0.08);
    // quello che arriva (echi, intercettazioni, fine dell'ascolto)
    const pronti = this.inArrivo.filter((e) => e.ora <= ora);
    if (pronti.length) {
      this.inArrivo = this.inArrivo.filter((e) => e.ora > ora);
      for (const e of pronti) e.fai();
    }
  }

  stato() {
    const prof = fondale(this.x, this.y) ?? 2000;
    const avvisi = [];
    if (this.cavita) avvisi.push('cavitazione');
    if (this.z > COLLAUDO) avvisi.push('oltre_quota_collaudo');
    if (prof - this.z < 30) avvisi.push('fondale_vicino');
    if (this.alberi.periscopio && Math.abs(this.v) > 10) avvisi.push('periscopio_scia');
    avvisi.sort();
    return {
      ora: Math.round(ora * 10) / 10,
      x: Math.round(this.x * 10) / 10, y: Math.round(this.y * 10) / 10, z: Math.round(this.z * 10) / 10,
      rotta: Math.round(this.rotta * 10) / 10, velocita: Math.round(this.v * 10) / 10,
      velocita_verticale: Math.round(this.vz * 100) / 100, assetto: Math.round(this.vz * 4), giri: Math.round(this.v * 6),
      macchina: this.macchina, timone: this.timone, timoni_o: this.timoni_o,
      rotta_ordinata: this.rotta_ordinata === null ? null : Math.round(this.rotta_ordinata * 10) / 10,
      quota_ordinata: this.modo_quota === 'manuale' ? null : this.quota_ordinata,
      modo_quota: this.modo_quota,
      autopilota: this.autopilota,
      cavitazione: this.cavita, v_cavitazione: Math.round(this.vCavitazione * 10) / 10,
      towed: { ...this.towed, filato_m: Math.round(this.towed.filato_m) },
      fondale: Math.round(prof - this.z), profondita_acqua: Math.round(prof), strato: STRATO,
      avvisi, danni: { urti_fondale: this.urti, oltre_collaudo: this.z > COLLAUDO, collasso: false },
      alberi: { ...this.alberi },
      radar_attivo: this.radarAttivo,
      ascolto_attivo: Math.max(0, Math.round((this.fineAscolto - ora) * 10) / 10),
      assistenza: this.assistenza,
      analizzatore: this.analizzatore ? { ...this.analizzatore, rilevamento: Math.round(this.analizzatore.rilevamento * 10) / 10 } : null,
      designato: this.designato,
    };
  }

  /** Le sorgenti che questo battello può sentire: bersagli e gli altri battelli (mai le loro posizioni al client). @returns {Sorgente[]} */
  sorgenti() {
    /** @type {Sorgente[]} */
    const out = bersagli.map((b) => ({ x: b.x, y: b.y, z: b.z, rotta: b.rotta, v: b.v, sl: b.sl(ora), chiave: b, firma: b.firma, alberi: null, radarAttivo: false }));
    for (const o of battelli) {
      if (o !== this) out.push({ x: o.x, y: o.y, z: o.z, rotta: o.rotta, v: o.v, sl: o.sl(), chiave: o, firma: FIRME['688'], alberi: o.alberi, radarAttivo: o.radarAttivo });
    }
    return out;
  }

  /**
   * Eccesso di segnale a banda larga di una sorgente su un sensore (dB), senza il diagramma del fascio.
   * @param {Sorgente} s @param {'sfera' | 'towed'} sensore
   */
  seBandaLarga(s, sensore) {
    const towed = sensore === 'towed';
    const r = Math.max(50, Math.hypot(s.x - this.x, s.y - this.y));
    const proprio = 10 * Math.log10(1 + (Math.abs(this.v) / 8) ** 6) - (towed ? 6 : 0);
    const strato = (s.z > STRATO) !== ((towed ? this.towed.quota ?? this.z : this.z) > STRATO) ? 10 : 0;
    return s.sl - (20 * Math.log10(r) + 0.08 * (r / 1000)) - 55 - strato + 15 - proprio;
  }

  /** Archi ciechi di un sensore. @param {'sfera' | 'towed'} sensore @returns {[number, number][]} */
  ciechi(sensore) {
    if (sensore === 'sfera') return [[normalizza360(this.rotta + 150), normalizza360(this.rotta + 210)]];
    if (this.towed.sorda) return [[0, 360]];
    return [[normalizza360(this.rotta - 20), normalizza360(this.rotta + 20)]];
  }

  /** @param {'sfera' | 'towed'} sensore @param {number} b */
  cieco(sensore, b) {
    return this.ciechi(sensore).some(([da, a]) => (a - da >= 360) || normalizza360(b - da) <= normalizza360(a - da));
  }

  /**
   * Un fotogramma a banda larga di un sensore: eccesso di segnale per settore di rilevamento VERO.
   * @param {'sfera' | 'towed'} sensore
   */
  fotogramma(sensore) {
    const towed = sensore === 'towed';
    const sigma = (towed ? 3.5 : 9.8) / 2.355;
    const asse = this.rotta;
    const proprio = 10 * Math.log10(1 + (Math.abs(this.v) / 8) ** 6) - (towed ? 6 : 0);
    const potenza = new Float64Array(SONAR.SETTORI);
    for (let k = 0; k < SONAR.SETTORI; k++) potenza[k] = 10 ** ((-10 - proprio + granello()) / 10);
    for (const s of this.sorgenti()) {
      if (!(s.sl > 0)) continue;
      let se = this.seBandaLarga(s, sensore);
      // un transitorio recente alza la sorgente per un attimo: un lampo sulla cascata
      const b = /** @type {any} */ (s.chiave);
      if (ora - (b.transitorio ?? -1e9) < 2) se += 15;
      const vero = normalizza360(rilevamentoDa(this.x, this.y, s.x, s.y) + casuale(-1, 1));
      const direzioni = towed ? [vero, normalizza360(2 * asse - vero)] : [vero];
      for (const d of direzioni) {
        if (this.cieco(sensore, d)) continue;
        for (let k = 0; k < SONAR.SETTORI; k++) {
          const delta = normalizza180(k * 2 + 1 - d);
          if (Math.abs(delta) > 4 * sigma + 2) continue;
          potenza[k] += 10 ** ((se - (delta * delta) / (2 * sigma * sigma) * 4.343) / 10);
        }
      }
    }
    const byte = new Uint8Array(SONAR.SETTORI);
    for (let k = 0; k < SONAR.SETTORI; k++) byte[k] = quantizzaSE(10 * Math.log10(potenza[k]));
    // il sonarista: contatti confermati sui picchi (qui guardando chi c'è davvero: è un finto server)
    if (!towed) this.sonarista(byte, 'sfera');
    return { byte, ciechi: this.ciechi(sensore), asse, sorda: this.towed.sorda };
  }

  /**
   * Le righe tonali di una sorgente come arrivano a un sensore: frequenza (con l'effetto Doppler) ed
   * eccesso di segnale nella cella di 1 Hz.
   * @param {Sorgente} s @param {'sfera' | 'towed'} sensore
   * @returns {{ hz: number, se: number }[]}
   */
  righeDi(s, sensore) {
    const f = s.firma;
    const se0 = this.seBandaLarga(s, sensore) + 12; // guadagno di banda stretta
    const ril = rilevamentoDa(s.x, s.y, this.x, this.y);
    const vr = nodiInMs(s.v) * Math.cos(((s.rotta - ril) * Math.PI) / 180); // verso di noi
    const doppler = 1 + vr / C_SUONO;
    return f.righe.map((r) => ({ hz: r.hz * doppler, se: se0 + r.db + rispostaBanda(sensore, r.hz) }));
  }

  /**
   * Fotogramma a banda stretta: per settore la riga più forte che il sensore sente.
   * @param {'sfera' | 'towed'} sensore
   */
  fotogrammaStretta(sensore) {
    const towed = sensore === 'towed';
    const sigma = (towed ? 2.5 : 7) / 2.355;
    const potenza = new Float64Array(SONAR.SETTORI);
    for (let k = 0; k < SONAR.SETTORI; k++) potenza[k] = 10 ** ((-10 + granello()) / 10);
    for (const s of this.sorgenti()) {
      if (!(s.sl > 0)) continue;
      const righe = this.righeDi(s, sensore);
      if (!righe.length) continue;
      const se = Math.max(...righe.map((r) => r.se));
      const vero = normalizza360(rilevamentoDa(this.x, this.y, s.x, s.y) + casuale(-0.5, 0.5));
      const direzioni = towed ? [vero, normalizza360(2 * this.rotta - vero)] : [vero];
      for (const d of direzioni) {
        if (this.cieco(sensore, d)) continue;
        for (let k = 0; k < SONAR.SETTORI; k++) {
          const delta = normalizza180(k * 2 + 1 - d);
          if (Math.abs(delta) > 4 * sigma + 2) continue;
          potenza[k] = Math.max(potenza[k], 10 ** ((se - (delta * delta) / (2 * sigma * sigma) * 4.343) / 10));
        }
      }
      if (towed) this.sonaristaTowed(s, se, vero);
    }
    const byte = new Uint8Array(SONAR.SETTORI);
    for (let k = 0; k < SONAR.SETTORI; k++) byte[k] = quantizzaSE(10 * Math.log10(potenza[k]));
    return { byte, ciechi: this.ciechi(sensore), asse: this.rotta, sorda: this.towed.sorda };
  }

  /**
   * L'analizzatore: LOFAR e DEMON del fascio puntato.
   */
  spettro() {
    const a = this.analizzatore;
    if (!a) return null;
    const sensore = a.sensore;
    const fin = SPETTRO[sensore];
    const larghezza = sensore === 'towed' ? 3 : 7;
    // un fascio agganciato a un contatto lo segue
    if (a.contatto) {
      const c = [...this.contatti.entries()].find(([, x]) => x.designazione === a.contatto);
      if (c) {
        const s = this.sorgenti().find((x) => x.chiave === c[0]);
        if (s) a.rilevamento = normalizza360(rilevamentoDa(this.x, this.y, s.x, s.y) + casuale(-0.5, 0.5));
      }
    }
    const righe = new Float64Array(fin.RIGHE);
    const demon = new Float64Array(fin.DEMON_RIGHE);
    for (let k = 0; k < fin.RIGHE; k++) righe[k] = 10 ** ((-10 + rispostaBanda(sensore, (k + 0.5) * fin.PASSO_HZ) * 0.2 + granello()) / 10);
    for (let k = 0; k < fin.DEMON_RIGHE; k++) demon[k] = 10 ** ((-10 + granello()) / 10);
    for (const s of this.sorgenti()) {
      if (!(s.sl > 0)) continue;
      const vero = rilevamentoDa(this.x, this.y, s.x, s.y);
      const delta = Math.min(Math.abs(normalizza180(vero - a.rilevamento)),
        sensore === 'towed' ? Math.abs(normalizza180(2 * this.rotta - vero - a.rilevamento)) : 999);
      if (delta > 2 * larghezza) continue;
      const fascio = -12 * (delta / larghezza) ** 2;
      const bb = this.seBandaLarga(s, sensore) + fascio;
      for (let k = 0; k < fin.RIGHE; k++) righe[k] += 10 ** ((bb - 8 + rispostaBanda(sensore, (k + 0.5) * fin.PASSO_HZ)) / 10);
      for (const r of this.righeDi(s, sensore)) {
        const k = Math.floor(r.hz / fin.PASSO_HZ);
        if (k < 0 || k >= fin.RIGHE) continue;
        righe[k] += 10 ** ((r.se + fascio) / 10);
        if (k + 1 < fin.RIGHE) righe[k + 1] += 10 ** ((r.se + fascio - 9) / 10);
      }
      // DEMON: asse e pale (forti se l'elica cavita: le navi di superficie sempre)
      const f = s.firma;
      if (f.pale > 0 && s.v > 0.5) {
        const asse = (f.giriPerNodo * Math.abs(s.v)) / 60;
        const forte = f.cavita || (s.v > 12) ? 0 : -18;
        for (const [hz, db] of [[asse, -6], [asse * f.pale, 0], [2 * asse * f.pale, -5], [3 * asse * f.pale, -9]]) {
          const k = Math.floor(hz / fin.DEMON_PASSO_HZ);
          if (k >= 0 && k < fin.DEMON_RIGHE) demon[k] += 10 ** ((bb + forte + db + 4) / 10);
        }
      }
    }
    const q = (/** @type {Float64Array} */ v) => {
      const out = new Uint8Array(v.length);
      for (let k = 0; k < v.length; k++) out[k] = quantizzaSE(10 * Math.log10(v[k]));
      return out;
    };
    /** @type {Record<string, unknown>} */
    const m = {
      ora: Math.floor(ora), sensore, rilevamento: Math.round(a.rilevamento * 10) / 10, contatto: a.contatto,
      da_hz: fin.DA_HZ, passo_hz: fin.PASSO_HZ, righe: codificaByte(q(righe)),
      demon_da_hz: fin.DEMON_DA_HZ, demon_passo_hz: fin.DEMON_PASSO_HZ, demon: codificaByte(q(demon)),
    };
    if (sensore === 'towed') Object.assign(m, { asse: Math.round(this.rotta * 10) / 10, sorda: this.towed.sorda });
    return m;
  }

  /**
   * Il sonarista: contatti confermati sui picchi a banda larga (qui guardando chi c'è davvero: è un
   * finto server).
   * @param {Uint8Array} byte @param {'sfera'} sensore
   */
  sonarista(byte, sensore) {
    for (const s of this.sorgenti()) {
      const vero = rilevamentoDa(this.x, this.y, s.x, s.y);
      const q = byte[Math.floor(vero / 2) % 180];
      if (q >= 76 && !this.cieco(sensore, vero)) this.senti(s, vero, sensore);
    }
    for (const [k, c] of this.contatti) {
      if (ora - c.ultimo > 60 && c.stato !== 'persa') {
        if (c.designazione) this.rapporto('sonar', 'sonar.contatto_perso', { contatto: c.designazione, sensore: [...c.sensori][0] ?? 'sfera' });
        c.stato = 'persa';
      }
      if (ora - c.ultimo > 120) this.contatti.delete(k);
    }
  }

  /** L'antenna sente una riga: anche lei forma contatti (prima della sfera, sulle righe basse). @param {Sorgente} s @param {number} se @param {number} vero */
  sonaristaTowed(s, se, vero) {
    if (this.towed.sorda || se < 6) return;
    this.senti(s, vero, 'towed');
  }

  /** @param {Sorgente} s @param {number} vero @param {string} sensore */
  senti(s, vero, sensore) {
    let c = this.contatti.get(s.chiave);
    if (!c) {
      c = { designazione: '', colpi: 0, ultimo: ora, inizio: ora, sensori: new Set(), storia: [], classe: null, confidenza: 0,
        comandante: null, annunciata: false, stato: 'nuova', bias: [gauss(), gauss(), gauss()], qAnnunciata: false,
        consiglio: ora, nonOss: false, solCte: null, abbandonato: false };
      this.contatti.set(s.chiave, c);
    }
    if (c.abbandonato) return;
    c.colpi++; c.ultimo = ora; c.sensori.add(sensore);
    if (c.stato === 'persa') c.stato = 'tenuta';
    if (!c.designazione && c.colpi >= (sensore === 'towed' ? 3 : 5)) {
      c.designazione = `S${this.prossimoContatto++}`;
      c.inizio = ora;
      const spec = sensore === 'towed' ? Math.round(normalizza360(2 * this.rotta - vero)) : null;
      this.rapporto('sonar', 'sonar.nuovo_contatto', { contatto: c.designazione, sensore, rilevamento: Math.round(vero), speculare: spec });
    }
  }

  /** Il messaggio `tracce` (ogni 4 s): misure e ipotesi dell'equipaggio. */
  tracce() {
    const out = [];
    for (const [k, c] of this.contatti) {
      if (!c.designazione || c.abbandonato) continue;
      const s = this.sorgenti().find((x) => x.chiave === k);
      if (!s) continue;
      const vero = rilevamentoDa(this.x, this.y, s.x, s.y);
      const ril = normalizza360(vero + gauss() * (c.sensori.has('towed') ? 0.6 : 1.2));
      c.storia.push({ ora, ril });
      c.storia = c.storia.filter((p) => ora - p.ora <= 120);
      const vecchio = c.storia[0];
      const variazione = vecchio && ora - vecchio.ora >= 30 ? (normalizza180(ril - vecchio.ril) / (ora - vecchio.ora)) * 60 : null;
      // classificazione dell'equipaggio dopo 3 minuti, giusta 4 volte su 5
      if (!c.classe && ora - c.inizio > 180) {
        const giusta = Math.random() < 0.8;
        c.classe = giusta ? s.firma.classe : ['forrest_sherman', 'mercantile_generico', 'biologico', '688'].filter((x) => x !== s.firma.classe)[Math.floor(Math.random() * 3)];
        c.confidenza = Math.round(casuale(0.6, 0.9) * 100) / 100;
        this.rapporto('sonar', 'sonar.classificato', { contatto: c.designazione, classe: c.classe, confidenza: c.confidenza });
      }
      const towedSolo = c.sensori.has('towed') && !c.sensori.has('sfera');
      out.push({
        contatto: c.designazione, sensori: [...c.sensori], rilevamento: Math.round(ril * 10) / 10,
        variazione: variazione === null ? null : Math.round(variazione * 100) / 100,
        classe: c.classe, confidenza: c.classe ? c.confidenza : null, stato: c.stato,
        speculare: towedSolo ? Math.round(normalizza360(2 * this.rotta - ril) * 10) / 10 : null,
      });
      if (c.stato === 'nuova') c.stato = 'tenuta';
    }
    this.manda(DAL_SERVER.TRACCE, { ora: Math.floor(ora), tracce: out });
  }

  /**
   * Le soluzioni dell'equipaggio (livelli 2-3, ogni 10 s): finte, con un errore che cala col tempo e
   * con le manovre proprie; al livello 3 quella esatta dei contatti non umani.
   */
  soluzioni() {
    if (this.assistenza < 2) return;
    for (const [k, c] of this.contatti) {
      if (!c.designazione || c.abbandonato || c.stato === 'persa' || ora - c.inizio < 60) continue;
      const s = this.sorgenti().find((x) => x.chiave === k);
      if (!s) continue;
      const vero = rilevamentoDa(this.x, this.y, s.x, s.y);
      const R = Math.hypot(s.x - this.x, s.y - this.y);
      if (this.assistenza === 3 && !s.firma.umano) {
        this.manda(DAL_SERVER.SOLUZIONE, {
          contatto: c.designazione, ora: Math.floor(ora), rilevamento: Math.round(vero * 10) / 10, distanza: Math.round(R),
          rotta: Math.round(s.rotta * 10) / 10, velocita: Math.round(s.v * 10) / 10, q: 100, ellisse: null,
          origine: 'equipaggio', esatta: true,
        });
        continue;
      }
      const gambe = this.gambe.filter((t) => t > c.inizio).length + 1;
      const tSeconda = this.gambe.filter((t) => t > c.inizio)[0] ?? null;
      const sR = gambe >= 2 && tSeconda !== null ? Math.max(0.05, 0.35 * Math.exp(-(ora - tSeconda) / 400)) : 0.6;
      const sC = gambe >= 2 ? Math.max(5, 40 * sR / 0.35) : 60;
      const sV = gambe >= 2 ? Math.max(1, 6 * sR / 0.35) : 8;
      const q = Math.round(100 * Math.exp(-((sR / 0.1) ** 2 + (sC / 20) ** 2 + (sV / 3) ** 2) / 3));
      const misurato = normalizza360(vero + gauss() * 0.5);
      this.manda(DAL_SERVER.SOLUZIONE, {
        contatto: c.designazione, ora: Math.floor(ora), rilevamento: Math.round(misurato * 10) / 10,
        distanza: Math.round(R * Math.max(0.2, 1 + c.bias[0] * sR)),
        rotta: Math.round(normalizza360(s.rotta + c.bias[1] * sC) * 10) / 10,
        velocita: Math.round(Math.max(0, s.v + c.bias[2] * sV) * 10) / 10, q,
        ellisse: { asse_lungo: Math.round(2.15 * sR * R), asse_corto: Math.round(2.15 * R * 0.01), orientamento: Math.round(misurato % 180) },
        origine: 'equipaggio', esatta: false,
      });
      if (q >= 70 && !c.qAnnunciata) {
        c.qAnnunciata = true;
        this.rapporto('sonar', 'tma.soluzione', { contatto: c.designazione, q });
      }
      if (gambe < 2 && ora - c.consiglio > 240) {
        c.consiglio = ora;
        if (!c.nonOss) { c.nonOss = true; this.rapporto('sonar', 'tma.distanza_non_osservabile', { contatto: c.designazione }); }
        const lato = normalizza180(vero - this.rotta) > 0 ? 'sinistra' : 'dritta';
        this.rapporto('sonar', 'tma.consiglio_manovra', { contatto: c.designazione, accostata: 90, lato, minuti: 6 });
      }
    }
  }

  /** Ekelund al livello 1, a ogni cambio di gamba (finto: la distanza vera col 15 % d'errore). */
  ekelund() {
    if (this.assistenza !== 1) return;
    for (const [k, c] of this.contatti) {
      if (!c.designazione || c.abbandonato || c.stato === 'persa') continue;
      const s = this.sorgenti().find((x) => x.chiave === k);
      if (!s) continue;
      const R = Math.hypot(s.x - this.x, s.y - this.y);
      this.rapporto('sonar', 'tma.ekelund', { contatto: c.designazione, distanza: Math.round(R * (1 + 0.15 * gauss())) });
    }
  }

  /**
   * Un ping: echi a chi pinga al tempo d'andata e ritorno, intercettazioni agli altri a un percorso.
   * @param {{ rilevamento: number | null, portata: 'corta' | 'lunga' }} v
   */
  pinga(v) {
    const portata = PORTATA_PING[v.portata];
    this.fineAscolto = ora + (2 * portata) / C_SUONO;
    const numero = ++this.numeroPing;
    let echi = 0;
    for (const s of this.sorgenti()) {
      const r = Math.hypot(s.x - this.x, s.y - this.y);
      if (r > portata || r < 30) continue;
      const vero = rilevamentoDa(this.x, this.y, s.x, s.y);
      const fuori = v.rilevamento === null ? Math.abs(normalizza180(vero - this.rotta)) > 60 : Math.abs(normalizza180(vero - v.rilevamento)) > 10;
      if (fuori) continue;
      const se = 220 - 2 * perdita(r, 3.5) + s.firma.ts - 60 + 20 - 10 - (v.portata === 'corta' ? 4 : 0);
      if (se < 0) continue;
      echi++;
      const t = ora + (2 * r) / C_SUONO;
      this.inArrivo.push({
        ora: t,
        fai: () => {
          const d = Math.round(r * (1 + 0.01 * gauss()));
          const ril = Math.round(normalizza360(vero + gauss() * 0.7) * 10) / 10;
          this.manda(DAL_SERVER.ECO, { ora: Math.round(t * 10) / 10, ping: numero, rilevamento: ril, distanza: d, forza: Math.round(se), riverbero: Math.round(casuale(-5, 5)) });
          this.rapporto('sonar', 'sonar.eco', { rilevamento: Math.round(ril), distanza: d });
        },
      });
    }
    this.inArrivo.push({ ora: this.fineAscolto, fai: () => this.rapporto('sonar', 'sonar.fine_ascolto', { echi }) });
    // gli altri lo sentono molto più lontano: un percorso solo
    for (const o of battelli) {
      if (o === this) continue;
      const r = Math.hypot(o.x - this.x, o.y - this.y);
      const livello = 220 - perdita(r, 3.5) - 60 - 10;
      if (livello < 0) continue;
      const t = ora + r / C_SUONO;
      const ril = Math.round(normalizza360(rilevamentoDa(o.x, o.y, this.x, this.y) + gauss() * 2));
      o.inArrivo.push({
        ora: t,
        fai: () => {
          o.manda(DAL_SERVER.INTERCETTO, { ora: Math.round(t * 10) / 10, rilevamento: ril, tipo: 'ping', frequenza_khz: 3.5, livello: Math.round(livello) });
          o.rapporto('sonar', 'intercetto.ping', { rilevamento: ril, frequenza_khz: 3.5 });
        },
      });
    }
  }

  /** Il periscopio: navi in vista (giorno e notte), alberi dei battelli vicini. */
  visivo() {
    if (!this.alberi.periscopio) return;
    const oggetti = [];
    const occhio = 2;
    for (const s of this.sorgenti()) {
      const r = Math.hypot(s.x - this.x, s.y - this.y);
      const vero = rilevamentoDa(this.x, this.y, s.x, s.y);
      const f = s.firma;
      if (f.superficie) {
        const orizzonteAlbero = 4120 * (Math.sqrt(occhio) + Math.sqrt(f.albero));
        const orizzonteScafo = 4120 * (Math.sqrt(occhio) + Math.sqrt(6));
        const portataNotte = 6000;
        if (r > orizzonteAlbero || (NOTTE && r > 2.5 * portataNotte)) continue;
        let n = this.visti.get(s.chiave);
        if (n === undefined) {
          n = this.prossimaVista++;
          this.visti.set(s.chiave, n);
          this.rapporto('guardia', 'periscopio.nave_in_vista', { rilevamento: Math.round(vero), sagoma: `${f.sagoma}2` });
        }
        const aspetto = normalizza180(rilevamentoDa(s.x, s.y, this.x, this.y) - s.rotta);
        const sotto = r > orizzonteScafo;
        const sagoma = NOTTE && r > portataNotte ? null : `${f.sagoma}${Math.min(4, Math.round(Math.abs(aspetto) / 45))}`;
        /** @type {string[] | null} */
        let luci = null;
        if (NOTTE) {
          luci = ['testa_d_albero'];
          if (Math.abs(aspetto) < 112.5) luci.push(aspetto >= 0 ? 'fianco_dritta' : 'fianco_sinistra');
          else luci.push('coronamento');
        }
        oggetti.push({
          vista: n, rilevamento: Math.round(normalizza360(vero + gauss() * 0.3) * 10) / 10,
          aspetto: Math.round(aspetto + gauss() * 8), sagoma,
          elevazione_alberi: sotto || sagoma === null ? null : Math.round(((Math.atan2(f.albero, r) * 180) / Math.PI) * (1 + 0.035 * gauss()) * 1000) / 1000,
          luci, sotto_orizzonte: sotto, scia: s.v > 5,
        });
      } else if (s.alberi && (s.alberi.periscopio || s.alberi.esm || s.alberi.radar) && r < 3000 * (1 + s.v / 5)) {
        let n = this.visti.get(s.chiave);
        if (n === undefined) { n = this.prossimaVista++; this.visti.set(s.chiave, n); }
        oggetti.push({ vista: n, rilevamento: Math.round(normalizza360(vero + gauss() * 0.3) * 10) / 10, aspetto: null, sagoma: null,
          elevazione_alberi: null, luci: NOTTE ? [] : null, sotto_orizzonte: false, scia: s.v > 5 });
      }
    }
    this.manda(DAL_SERVER.VISIVO, { ora: Math.floor(ora), oggetti });
  }

  /** L'ESM: i radar delle navi (e il radar acceso degli altri), oltre l'orizzonte acustico. */
  esm() {
    if (!this.alberi.esm) return;
    const emissioni = [];
    for (const s of this.sorgenti()) {
      const radar = s.firma.superficie ? s.firma.radar : s.radarAttivo ? s.firma.radar : [];
      const r = Math.hypot(s.x - this.x, s.y - this.y);
      for (const rd of radar) {
        if (r > rd.portata * 1.5) continue;
        const livello = Math.round(70 - 20 * Math.log10(Math.max(1000, r) / 1000) - (r > 30000 ? 10 : 0));
        if (livello < 0) continue;
        const ril = Math.round(normalizza360(rilevamentoDa(this.x, this.y, s.x, s.y) + gauss() * 4));
        emissioni.push({ rilevamento: ril, tipo: rd.tipo, banda: rd.banda, livello });
        const k = `${/** @type {any} */ (s.chiave).id ?? 'b'}:${rd.tipo}`;
        if (ora - (this.radarSentiti.get(k) ?? -1e9) > 60) this.rapporto('guardia', 'esm.radar', { rilevamento: ril, tipo: rd.tipo, banda: rd.banda });
        this.radarSentiti.set(k, ora);
      }
    }
    this.manda(DAL_SERVER.ESM, { ora: Math.floor(ora), emissioni });
  }

  /** Il proprio radar (ogni 3 s): navi entro 20 km, alberi alzati vicini. */
  radar() {
    if (!this.radarAttivo) return;
    const echi = [];
    for (const s of this.sorgenti()) {
      const r = Math.hypot(s.x - this.x, s.y - this.y);
      const visibile = s.firma.superficie ? r < 20000 : s.alberi && (s.alberi.periscopio || s.alberi.esm || s.alberi.radar) && r < 4000;
      if (!visibile) continue;
      echi.push({ rilevamento: Math.round(normalizza360(rilevamentoDa(this.x, this.y, s.x, s.y) + gauss() * 1) * 10) / 10, distanza: Math.round(r * (1 + 0.01 * gauss())) });
    }
    this.manda(DAL_SERVER.RADAR, { ora: Math.floor(ora), echi });
  }

  /** @param {Record<string, unknown>} m */
  ordine(m) {
    const esito = validaOrdine(m);
    if (!esito.ok) return this.manda(DAL_SERVER.ERRORE, { codice: ERRORI.ORDINE_NON_VALIDO, n: esito.n, cosa: esito.cosa, motivo: esito.motivo });
    const { ordine, n } = esito;
    /** @param {string} motivo */
    const rifiuta = (motivo) => this.manda(DAL_SERVER.ERRORE, { codice: ERRORI.ORDINE_RIFIUTATO, n, cosa: ordine.cosa, motivo });
    /** @param {string} d */
    const contatto = (d) => [...this.contatti.values()].find((c) => c.designazione === d && !c.abbandonato) ?? null;
    switch (ordine.cosa) {
      case 'macchina': this.macchina = String(ordine.valore); break;
      case 'timone':
        this.timone = ordine.valore; this.rotta_ordinata = null; this.autopilota.attivo = false; break;
      case 'timoni_o': this.timoni_o = ordine.valore; this.modo_quota = 'manuale'; this.quota_ordinata = null; break;
      case 'quota': {
        const v = ordine.valore;
        if (v === 'emersione') { this.modo_quota = 'emersione'; this.quota_ordinata = 0; break; }
        this.modo_quota = 'automatica';
        this.quota_ordinata = v === 'periscopica' ? 18.3 : v === 'automatica' ? Math.round(piediInMetri(150) * 10) / 10 : v;
        this.quotaAnnunciata = false;
        break;
      }
      case 'rotta': this.rotta_ordinata = ordine.valore; this.autopilota.attivo = false; this.rottaAnnunciata = false; break;
      case 'towed': {
        const tw = this.towed, v = ordine.valore;
        if (v === 'fila' && tw.stato === 'stivata') { tw.stato = 'in_filare'; this.rapporto('sonar', 'towed.in_filare'); }
        else if (v === 'ritira' && (tw.stato === 'in_filare' || tw.stato === 'filata')) { tw.stato = 'in_ritiro'; this.rapporto('sonar', 'towed.in_ritiro'); }
        else if (v === 'taglia' && tw.filato_m > 0 && tw.stato !== 'tagliata') { tw.stato = 'tagliata'; tw.filato_m = 0; this.rapporto('sonar', 'towed.tagliata'); }
        else return rifiuta(MOTIVI_ORDINE.TOWED_STATO);
        break;
      }
      case 'waypoint': {
        const w = ordine.valore, ap = this.autopilota;
        if (w.azione === 'svuota') { ap.waypoint = []; ap.attivo = false; ap.prossimo = null; }
        else if (w.azione === 'togli') {
          if (w.indice >= ap.waypoint.length) return rifiuta(MOTIVI_ORDINE.INDICE);
          ap.waypoint.splice(w.indice, 1);
          if (ap.waypoint.length === 0) { ap.attivo = false; ap.prossimo = null; }
        } else {
          if (ap.waypoint.length >= WAYPOINT_MAX) return rifiuta(MOTIVI_ORDINE.TROPPI_WAYPOINT);
          if (w.x < AREA.x0 || w.x > AREA.x1 || w.y < AREA.y0 || w.y > AREA.y1) return rifiuta(MOTIVI_ORDINE.FUORI_AREA);
          ap.waypoint.push([w.x, w.y]);
          if (ap.prossimo === null) ap.prossimo = 0;
        }
        break;
      }
      case 'autopilota': {
        const ap = this.autopilota;
        if (ordine.valore && ap.waypoint.length === 0) return rifiuta(MOTIVI_ORDINE.NESSUN_WAYPOINT);
        ap.attivo = ordine.valore;
        if (ap.attivo && ap.prossimo === null) ap.prossimo = 0;
        if (!ap.attivo) this.rotta_ordinata = null;
        break;
      }
      case 'scala_tempo':
      case 'pausa':
        if (battelli.size > 1) return rifiuta(MOTIVI_ORDINE.TEMPO_BLOCCATO);
        if (ordine.cosa === 'scala_tempo') scala = ordine.valore; else pausa = ordine.valore;
        tempoATutti();
        break;
      // --- v2 ---
      case 'assistenza': this.assistenza = ordine.valore; break;
      case 'analizzatore': {
        const v = ordine.valore;
        if (v === null) { this.analizzatore = null; break; }
        if ('contatto' in v) {
          const c = contatto(v.contatto);
          if (!c) return rifiuta(MOTIVI_ORDINE.CONTATTO);
          const sensore = c.sensori.has('towed') && this.towed.stato === 'filata' ? 'towed' : 'sfera';
          const t = [...this.contatti.entries()].find(([, x]) => x === c);
          const s = t ? this.sorgenti().find((x) => x.chiave === t[0]) : null;
          this.analizzatore = { sensore, rilevamento: s ? rilevamentoDa(this.x, this.y, s.x, s.y) : 0, contatto: v.contatto };
        } else {
          if (v.sensore === 'towed' && this.towed.stato !== 'filata') return rifiuta(MOTIVI_ORDINE.TOWED_STATO);
          this.analizzatore = { sensore: v.sensore, rilevamento: v.rilevamento, contatto: null };
        }
        break;
      }
      case 'attivo': {
        const v = ordine.valore;
        if (ora < this.fineAscolto) return rifiuta(MOTIVI_ORDINE.PING_IN_CORSO);
        if (v.rilevamento !== null && Math.abs(normalizza180(v.rilevamento - this.rotta)) > 60) return rifiuta(MOTIVI_ORDINE.SETTORE);
        this.pinga(v);
        break;
      }
      case 'albero': {
        const v = ordine.valore;
        if (v.alzato && this.z > QUOTA_ALBERI) return rifiuta(MOTIVI_ORDINE.QUOTA);
        this.alberi[v.quale] = v.alzato;
        if (v.quale === 'radar' && !v.alzato) this.radarAttivo = false;
        if (!this.alberi.periscopio) this.visti.clear();
        transitorioA(this, 'meccanico', 105);
        break;
      }
      case 'radar':
        if (ordine.valore && !this.alberi.radar) return rifiuta(MOTIVI_ORDINE.ALBERO);
        this.radarAttivo = ordine.valore;
        break;
      case 'designa':
        if (ordine.valore !== null && !contatto(ordine.valore)) return rifiuta(MOTIVI_ORDINE.CONTATTO);
        this.designato = ordine.valore;
        break;
      case 'classifica': {
        const c = contatto(ordine.valore.contatto);
        if (!c) return rifiuta(MOTIVI_ORDINE.CONTATTO);
        c.comandante = ordine.valore.classe;
        if (ordine.valore.classe) { c.classe = ordine.valore.classe; c.confidenza = 1; }
        break;
      }
      case 'soluzione': {
        const v = ordine.valore;
        const c = contatto(v.contatto);
        if (!c) return rifiuta(MOTIVI_ORDINE.CONTATTO);
        if ('cancella' in v) { c.solCte = null; break; }
        c.solCte = v;
        const ril = /** @type {any} */ (v).rilevamento ?? c.storia[c.storia.length - 1]?.ril ?? 0;
        this.manda(DAL_SERVER.SOLUZIONE, {
          contatto: v.contatto, ora: v.ora, rilevamento: ril, distanza: v.distanza, rotta: v.rotta, velocita: v.velocita,
          q: null, ellisse: null, origine: 'comandante', esatta: false,
        });
        break;
      }
      case 'abbandona': {
        const c = contatto(ordine.valore);
        if (!c) return rifiuta(MOTIVI_ORDINE.CONTATTO);
        c.abbandonato = true;
        if (this.designato === ordine.valore) this.designato = null;
        if (this.analizzatore?.contatto === ordine.valore) this.analizzatore = null;
        break;
      }
    }
    this.manda(DAL_SERVER.RICEVUTO, { n, cosa: ordine.cosa, valore: ordine.valore });
  }
}

/**
 * Un transitorio di un battello (o di un bersaglio): lo sentono gli altri battelli, sfera e antenna, se
 * supera la soglia; il sonarista lo riconosce oltre i 6 dB.
 * @param {Battello | Bersaglio} sorgente @param {string} tipo @param {number} livello dB
 */
function transitorioA(sorgente, tipo, livello) {
  sorgente.transitorio = ora;
  for (const b of battelli) {
    if (b === sorgente) continue;
    const r = Math.hypot(sorgente.x - b.x, sorgente.y - b.y);
    const vero = rilevamentoDa(b.x, b.y, sorgente.x, sorgente.y);
    for (const sensore of /** @type {const} */ (['sfera', 'towed'])) {
      if (sensore === 'towed' && (b.towed.stato !== 'filata' || b.towed.sorda)) continue;
      if (b.cieco(sensore, vero)) continue;
      const se = livello - perdita(r, 1) - 55 + 10;
      if (se < 0) continue;
      const c = b.contatti.get(sorgente);
      const ril = Math.round(normalizza360(vero + gauss() * 2));
      const speculare = sensore === 'towed' ? Math.round(normalizza360(2 * b.rotta - ril)) : null;
      const t = ora + r / C_SUONO;
      const riconosciuto = se >= 6 ? tipo : 'sconosciuto';
      b.inArrivo.push({
        ora: t,
        fai: () => {
          b.manda(DAL_SERVER.TRANSITORIO, { ora: Math.round(t * 10) / 10, sensore, rilevamento: ril, speculare, tipo: riconosciuto, forza: Math.round(se) });
          b.rapporto('sonar', 'sonar.transitorio', { contatto: c?.designazione || null, sensore, tipo: riconosciuto, rilevamento: ril }, 5);
        },
      });
    }
  }
}

function tempoATutti() {
  for (const b of battelli) {
    b.manda(DAL_SERVER.TEMPO, { ora: Math.floor(ora), scala_tempo: scala, in_pausa: pausa, tempo_modificabile: battelli.size === 1 });
  }
}

// ------------------------------------------------------------------------------------- orologio

const PASSO = 0.1;
let ultimoReale = performance.now();
let accumulato = 0;
let ultimoSecondo = 0;
let ultimoStato = 0;

/** Il secondo di gioco intero appena compiuto: fotogrammi e messaggi dei sensori. @param {number} s */
function secondo(s) {
  for (const b of battelli) {
    for (const sensore of /** @type {const} */ (['sfera', 'towed'])) {
      if (sensore === 'towed' && b.towed.stato !== 'filata') continue;
      const f = b.fotogramma(sensore);
      /** @type {Record<string, unknown>} */
      const m = { ora: s, sensore, settori: codificaSettori(f.byte), ciechi: f.ciechi };
      if (sensore === 'towed') Object.assign(m, { asse: Math.round(f.asse * 10) / 10, sorda: f.sorda });
      b.manda(DAL_SERVER.SONAR, m);
      if (s % SPETTRO.PERIODO === 0) {
        const n = b.fotogrammaStretta(sensore);
        /** @type {Record<string, unknown>} */
        const ms = { ora: s, sensore, banda: 'stretta', settori: codificaSettori(n.byte), ciechi: n.ciechi };
        if (sensore === 'towed') Object.assign(ms, { asse: Math.round(n.asse * 10) / 10, sorda: n.sorda });
        b.manda(DAL_SERVER.SONAR, ms);
      }
    }
    if (s % SPETTRO.PERIODO === 0) {
      const sp = b.spettro();
      if (sp) b.manda(DAL_SERVER.SPETTRO, sp);
      b.tracce();
    }
    if (s % 10 === 0) b.soluzioni();
    if (s % 3 === 0) b.radar();
    b.visivo();
    b.esm();
    // Ekelund al livello 1: al primo minuto di ogni gamba nuova
    const ultima = b.gambe[b.gambe.length - 1];
    if (b.gambe.length >= 2 && s - ultima >= 60 && s - ultima < 61) b.ekelund();
  }
  // le balene scattano ogni tanto
  for (const t of bersagli) if (t.firma.classe === 'biologico' && Math.random() < 1 / 90) transitorioA(t, 'biologico', 140);
}

function ciclo() {
  const adesso = performance.now();
  const dtReale = Math.min(1, (adesso - ultimoReale) / 1000);
  ultimoReale = adesso;
  if (!pausa && battelli.size > 0) {
    accumulato += dtReale * scala;
    while (accumulato >= PASSO) {
      accumulato -= PASSO;
      ora += PASSO;
      for (const b of bersagli) {
        const a = (b.rotta * Math.PI) / 180;
        b.x += nodiInMs(b.v) * Math.sin(a) * PASSO;
        b.y += nodiInMs(b.v) * Math.cos(a) * PASSO;
        if (b.v < 3) b.rotta = normalizza360(b.rotta + casuale(-0.5, 0.5));
      }
      for (const b of battelli) b.passo(PASSO);
      // un fotogramma per sensore attivo per ogni secondo di gioco
      if (Math.floor(ora + 1e-6) > ultimoSecondo) {
        ultimoSecondo = Math.floor(ora + 1e-6);
        secondo(ultimoSecondo);
      }
    }
  }
  if (adesso - ultimoStato >= 250) {
    ultimoStato = adesso;
    for (const b of battelli) b.manda(DAL_SERVER.STATO, b.stato());
  }
}

// ------------------------------------------------------------------------------------- rete

/** @param {string} testo */
function salvaCattura(testo) {
  try {
    const m = JSON.parse(testo);
    const nome = String(m.nome ?? 'cattura').replace(/[^a-z0-9_-]/gi, '_').slice(0, 60);
    const png = String(m.png ?? '').replace(/^data:image\/png;base64,/, '');
    writeFileSync(path.join(/** @type {string} */ (process.env.FINTO_CATTURE), `${nome}.png`), Buffer.from(png, 'base64'));
  } catch (e) {
    console.error('cattura non salvata:', /** @type {Error} */ (e).message);
  }
}

/** @param {number} porta */
export function avvia(porta) {
  const http = createServer((req, res) => {
    res.writeHead(req.url === '/salute' ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, finto: true, presenti: battelli.size }));
  });
  const wss = new WebSocketServer({ server: http });
  wss.on('connection', (ws) => {
    /** @type {Battello | null} */
    let battello = null;
    let nome = '';
    ws.on('message', (dati) => {
      // strumento di verifica: con FINTO_CATTURE=<cartella> la pagina può mandare
      // {t:'cattura', nome, png: canvas.toDataURL()} e il fotogramma si salva lì (non è protocollo)
      if (process.env.FINTO_CATTURE && String(dati).startsWith('{"t":"cattura"')) return salvaCattura(String(dati));
      const esito = decodifica(String(dati));
      if (!esito.ok) return ws.send(codifica(DAL_SERVER.ERRORE, { codice: esito.errore }));
      const m = esito.messaggio;
      if (m.t === DAL_CLIENT.CIAO) {
        if (m.versione !== PROTOCOLLO_VERSIONE) {
          ws.send(codifica(DAL_SERVER.ERRORE, { codice: ERRORI.VERSIONE }));
          return ws.close(4426, 'versione');
        }
        // qualunque biglietto va bene: se si legge, se ne prende il nome
        const carico = typeof m.biglietto === 'string' ? b64urlDecodifica(m.biglietto.split('.')[0]) : null;
        try { nome = carico ? JSON.parse(new TextDecoder().decode(carico)).nome : ''; } catch { nome = ''; }
        nome ||= 'Comandante';
        ws.send(codifica(DAL_SERVER.BENVENUTO, {
          versione: PROTOCOLLO_VERSIONE, utente: { uid: 1, nome, ruolo: 'giocatore' },
          server: { versione: 'finto', avviato: new Date().toISOString() }, presenti: wss.clients.size,
        }));
      } else if (m.t === DAL_CLIENT.PING) {
        ws.send(codifica(DAL_SERVER.PONG, { n: m.n, ora: Date.now() }));
      } else if (m.t === DAL_CLIENT.ENTRA) {
        const e = validaEntra(m);
        if (!e.ok) return ws.send(codifica(DAL_SERVER.ERRORE, { codice: e.errore }));
        if (battello) return ws.send(codifica(DAL_SERVER.ERRORE, { codice: ERRORI.GIA_IN_PARTITA }));
        const ripreso = senzaLinea.get(nome);
        if (ripreso && performance.now() - ripreso.dal < 300000) {
          senzaLinea.delete(nome);
          battello = ripreso.battello;
          battello.ws = ws;
        } else {
          battello = new Battello(ws, nome, e.assistenza);
        }
        battelli.add(battello);
        battello.manda(DAL_SERVER.PARTITA, {
          id: ID_PARTITA, scenario: e.scenario, ora: Math.floor(ora), passo: PASSO, scala_tempo: scala, in_pausa: pausa,
          tempo_modificabile: battelli.size === 1, origine: ORIGINE, area: AREA,
          battello: { piattaforma: '688', nome: 'Dallas', sigla: `SSN-${700 + prossimaPartita++}` },
        });
        battello.manda(DAL_SERVER.STATO, battello.stato());
        if (ripreso) battello.rapporto('guardia', 'guardia.ripreso_il_comando', { secondi: Math.round((performance.now() - ripreso.dal) / 1000) });
        if (battelli.size > 1) { scala = 1; pausa = false; tempoATutti(); }
      } else if (m.t === DAL_CLIENT.ESCI) {
        if (!battello) return ws.send(codifica(DAL_SERVER.ERRORE, { codice: ERRORI.NON_IN_PARTITA }));
        battelli.delete(battello);
        battello.manda(DAL_SERVER.USCITA, { motivo: 'esci' });
        battello = null;
      } else if (m.t === DAL_CLIENT.ORDINE) {
        if (!battello) return ws.send(codifica(DAL_SERVER.ERRORE, { codice: ERRORI.NON_IN_PARTITA, n: m.n, cosa: m.cosa }));
        battello.ordine(m);
      } else {
        ws.send(codifica(DAL_SERVER.ERRORE, { codice: ERRORI.TIPO_SCONOSCIUTO }));
      }
    });
    ws.on('close', () => {
      if (!battello) return;
      battelli.delete(battello);
      senzaLinea.set(nome, { battello, dal: performance.now() });
    });
  });
  const timer = setInterval(ciclo, 20);
  http.listen(porta, '127.0.0.1', () => console.log(`finto server di gioco (protocollo v${PROTOCOLLO_VERSIONE}${NOTTE ? ', notte' : ''}) su ws://127.0.0.1:${porta}/`));
  return { http, wss, ferma: () => { clearInterval(timer); wss.close(); http.close(); } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--porta');
  const porta = i > 0 ? Number(process.argv[i + 1]) : 8197;
  if (porta === 8095 || porta === 8096) {
    console.error('8095 è la produzione e 8096 il server di sviluppo vero: scegli un\'altra porta');
    process.exit(1);
  }
  avvia(porta);
}
