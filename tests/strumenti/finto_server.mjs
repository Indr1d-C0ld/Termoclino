// Finto server di gioco per sviluppare il client senza il server vero (protocollo v1).
//
//   node tests/strumenti/finto_server.mjs [--porta 8197]
//   TERMOCLINO_CONFIG=$PWD/tests/strumenti/config_finto_server.php php -S 127.0.0.1:8161 -t web web/index.php
//   # e nel browser http://127.0.0.1:8161/plancia
//
// La configurazione di prova cambia solo gioco.ws_url (e con lui la Content-Security-Policy della
// pagina, che altrimenti bloccherebbe il collegamento): vedi tests/strumenti/config_finto_server.php.
//
// Parla la versione 1 di docs/PROTOCOLLO.md con le funzioni di shared/protocol.js, accetta qualunque
// biglietto (è uno strumento di sviluppo: non va mai esposto), e simula in modo plausibile ma
// semplificato una palestra di TORPEX: ogni connessione che `entra` governa un 688; tre
// cacciatorpediniere, un mercantile e due balene fanno rumore; i giocatori si sentono fra loro. Non è
// il modello del server vero (server/src/sim): serve a dare al client messaggi della forma giusta,
// con numeri credibili. Rispetta la nebbia di guerra: degli altri manda solo energia per settore.
//
// Mai 8095 (produzione) né 8096 (server di sviluppo vero).
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from '../../server/node_modules/ws/wrapper.mjs';
import {
  PROTOCOLLO_VERSIONE, DAL_CLIENT, DAL_SERVER, ERRORI, MOTIVI_ORDINE, SONAR, WAYPOINT_MAX,
  codifica, decodifica, validaOrdine, validaEntra, quantizzaSE, codificaSettori, b64urlDecodifica,
} from '../../shared/protocol.js';
import { normalizza360, normalizza180, nodiInMs, piediInMetri } from '../../shared/units.js';
import { fondaleSintetico } from '../../web/assets/js/client/fondale.js';
import { caricaAmbiente } from '../../shared/ambiente.js';

/** Le chiavi dei rapporti che questo server può mandare (le stesse del server vero, PROTOCOLLO.md v1). */
export const CHIAVI_RAPPORTO = Object.freeze([
  'sonar.nuovo_contatto', 'sonar.contatto_perso',
  'towed.in_filare', 'towed.filata', 'towed.in_ritiro', 'towed.ritirata', 'towed.tagliata', 'towed.persa',
  'towed.stabilizzata', 'towed.sorda', 'towed.curva', 'towed.velocita_pericolosa',
  'macchina.cavitazione', 'macchina.fine_cavitazione',
  'guardia.quota_collaudo_vicina', 'guardia.oltre_quota_collaudo', 'guardia.collasso', 'guardia.urto_fondale',
  'guardia.in_superficie', 'navigazione.fondale_vicino', 'navigazione.waypoint_raggiunto',
  'navigazione.ultimo_waypoint', 'timone.rotta_raggiunta', 'timone.quota_raggiunta',
]);

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

/** @param {number} a @param {number} b */
const casuale = (a, b) => a + Math.random() * (b - a);
/** Rumore esponenziale di un rivelatore di energia, in dB rispetto alla media. */
const granello = () => 10 * Math.log10(-Math.log(Math.random() || 1e-9));

// ------------------------------------------------------------------------------------- mondo

/** @typedef {{ x: number, y: number, z: number, rotta: number, v: number, sl: (o: number) => number }} Sorgente */

/**
 * Bersagli di superficie e biologici, dalle posizioni dello scenario (quelle del 1989 riportate sulla
 * carta vera) o, senza scenario, inventati: si muovono da soli in linea retta e non mandano mai la
 * loro posizione.
 */
const bersagli = VALORI
  ? [
    ...VALORI.navi.map((/** @type {any} */ n) => ({ x: n.x, y: n.y, z: 4, rotta: n.rotta, v: n.velocita,
      sl: () => (n.classe === 'mercantile' ? 157 : 152) })),
    ...VALORI.biologici.map((/** @type {any} */ b, /** @type {number} */ i) => ({ x: b.x, y: b.y, z: 30, rotta: casuale(0, 360), v: 2,
      sl: (/** @type {number} */ o) => (Math.sin(o / 23 + i * 3) > 0.6 ? 142 : 0) })),
  ]
  : [
    ...[0, 1, 2].map((i) => ({ x: -9000 + i * 2500, y: -16000 - i * 1800, z: 4, rotta: 315, v: 11, sl: () => 152 })),
    { x: 14000, y: -8000, z: 6, rotta: 40, v: 13, sl: () => 157 },
    ...[0, 1].map((i) => ({ x: casuale(-20000, 20000), y: casuale(5000, 25000), z: 30, rotta: casuale(0, 360), v: 2,
      sl: (/** @type {number} */ o) => (Math.sin(o / 23 + i * 3) > 0.6 ? 142 : 0) })),
  ];
let prossimaPartenza = 0;

/** @type {Set<Battello>} */
const battelli = new Set();
let ora = 0;
let scala = 1;
let pausa = false;
let prossimaPartita = 1;
const ID_PARTITA = `finta-${Date.now().toString(36)}`;

class Battello {
  /** @param {import('ws').WebSocket} ws @param {string} nome */
  constructor(ws, nome) {
    this.ws = ws;
    this.nome = nome;
    let x = 0, y = 0, rotta = 320;
    const p = PARTENZE[prossimaPartenza++ % Math.max(1, PARTENZE.length)];
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
    /** @type {Map<object, { designazione: string, colpi: number, ultimo: number }>} */
    this.contatti = new Map();
    this.prossimoContatto = 1;
    /** @type {Record<string, number>} */
    this.ultimoAvviso = {};
    this.quotaAnnunciata = true;
    this.rottaAnnunciata = true;
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
        this.rotta_ordinata = normalizza360((Math.atan2(wx - this.x, wy - this.y) * 180) / Math.PI);
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
  }

  stato() {
    const prof = fondale(this.x, this.y) ?? 2000;
    const avvisi = [];
    if (this.cavita) avvisi.push('cavitazione');
    if (this.z > COLLAUDO) avvisi.push('oltre_quota_collaudo');
    if (prof - this.z < 30) avvisi.push('fondale_vicino');
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
    };
  }

  /** Le sorgenti che questo battello può sentire: bersagli e gli altri battelli (mai le loro posizioni al client). */
  sorgenti() {
    /** @type {{ x: number, y: number, z: number, sl: number, chiave: object }[]} */
    const out = bersagli.map((b) => ({ x: b.x, y: b.y, z: b.z, sl: b.sl(ora), chiave: b }));
    for (const o of battelli) if (o !== this) out.push({ x: o.x, y: o.y, z: o.z, sl: o.sl(), chiave: o });
    return out;
  }

  /**
   * Un fotogramma di un sensore: eccesso di segnale per settore di rilevamento VERO.
   * @param {'sfera' | 'towed'} sensore
   */
  fotogramma(sensore) {
    const towed = sensore === 'towed';
    const sigma = (towed ? 3.5 : 9.8) / 2.355;
    const asse = this.rotta;
    // rumore proprio: per ascoltare si rallenta (PROGETTO §5.4)
    const proprio = 10 * Math.log10(1 + (Math.abs(this.v) / 8) ** 6) - (towed ? 6 : 0);
    const potenza = new Float64Array(SONAR.SETTORI);
    for (let k = 0; k < SONAR.SETTORI; k++) potenza[k] = 10 ** ((-10 - proprio + granello()) / 10);
    /** @type {[number, number][]} */
    const ciechi = [];
    if (!towed) ciechi.push([normalizza360(this.rotta + 150), normalizza360(this.rotta + 210)]);
    else if (this.towed.sorda) ciechi.push([0, 360]);
    else ciechi.push([normalizza360(asse - 20), normalizza360(asse + 20)]);
    const cieco = (/** @type {number} */ b) => ciechi.some(([da, a]) => (a - da >= 360) || normalizza360(b - da) <= normalizza360(a - da));
    for (const s of this.sorgenti()) {
      if (!(s.sl > 0)) continue;
      const r = Math.max(50, Math.hypot(s.x - this.x, s.y - this.y));
      const strato = (s.z > STRATO) !== ((towed ? this.towed.quota ?? this.z : this.z) > STRATO) ? 10 : 0;
      const se = s.sl - (20 * Math.log10(r) + 0.08 * (r / 1000)) - 55 - strato + 15 - proprio;
      const vero = normalizza360((Math.atan2(s.x - this.x, s.y - this.y) * 180) / Math.PI + casuale(-1, 1));
      const direzioni = towed ? [vero, normalizza360(2 * asse - vero)] : [vero];
      for (const d of direzioni) {
        if (cieco(d)) continue;
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
    if (!towed) this.sonarista(byte);
    return { byte, ciechi, asse, sorda: this.towed.sorda };
  }

  /** @param {Uint8Array} byte */
  sonarista(byte) {
    for (const s of this.sorgenti()) {
      const vero = normalizza360((Math.atan2(s.x - this.x, s.y - this.y) * 180) / Math.PI);
      const q = byte[Math.floor(vero / 2) % 180];
      let c = this.contatti.get(s.chiave);
      if (q >= 76) {
        if (!c) { c = { designazione: '', colpi: 0, ultimo: ora }; this.contatti.set(s.chiave, c); }
        c.colpi++; c.ultimo = ora;
        if (!c.designazione && c.colpi >= 5) {
          c.designazione = `S${this.prossimoContatto++}`;
          this.rapporto('sonar', 'sonar.nuovo_contatto', { contatto: c.designazione, sensore: 'sfera', rilevamento: Math.round(vero), speculare: null });
        }
      } else if (c && ora - c.ultimo > 60) {
        if (c.designazione) this.rapporto('sonar', 'sonar.contatto_perso', { contatto: c.designazione, sensore: 'sfera' });
        this.contatti.delete(s.chiave);
      }
    }
  }

  /** @param {Record<string, unknown>} m */
  ordine(m) {
    const esito = validaOrdine(m);
    if (!esito.ok) return this.manda(DAL_SERVER.ERRORE, { codice: ERRORI.ORDINE_NON_VALIDO, n: esito.n, cosa: esito.cosa, motivo: esito.motivo });
    const { ordine, n } = esito;
    /** @param {string} motivo */
    const rifiuta = (motivo) => this.manda(DAL_SERVER.ERRORE, { codice: ERRORI.ORDINE_RIFIUTATO, n, cosa: ordine.cosa, motivo });
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
    }
    this.manda(DAL_SERVER.RICEVUTO, { n, cosa: ordine.cosa, valore: ordine.valore });
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
        for (const b of battelli) {
          for (const s of /** @type {const} */ (['sfera', 'towed'])) {
            if (s === 'towed' && b.towed.stato !== 'filata') continue;
            const f = b.fotogramma(s);
            /** @type {Record<string, unknown>} */
            const m = { ora: ultimoSecondo, sensore: s, settori: codificaSettori(f.byte), ciechi: f.ciechi };
            if (s === 'towed') Object.assign(m, { asse: Math.round(f.asse * 10) / 10, sorda: f.sorda });
            b.manda(DAL_SERVER.SONAR, m);
          }
        }
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
        battello = new Battello(ws, nome);
        battelli.add(battello);
        battello.manda(DAL_SERVER.PARTITA, {
          id: ID_PARTITA, scenario: e.scenario, ora: Math.floor(ora), passo: PASSO, scala_tempo: scala, in_pausa: pausa,
          tempo_modificabile: battelli.size === 1, origine: ORIGINE, area: AREA,
          battello: { piattaforma: '688', nome: 'Dallas', sigla: `SSN-${700 + prossimaPartita++}` },
        });
        battello.manda(DAL_SERVER.STATO, battello.stato());
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
    ws.on('close', () => { if (battello) battelli.delete(battello); });
  });
  const timer = setInterval(ciclo, 20);
  http.listen(porta, '127.0.0.1', () => console.log(`finto server di gioco (protocollo v${PROTOCOLLO_VERSIONE}) su ws://127.0.0.1:${porta}/`));
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
