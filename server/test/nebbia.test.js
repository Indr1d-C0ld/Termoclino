// @ts-check
/**
 * LA PROVA DI NEBBIA (PROGETTO §11.2, punto 14; PROTOCOLLO, regola 4).
 *
 * Due giocatori nella palestra, attraverso il cancello WebSocket vero. Per
 * venti minuti di gioco si raccoglie OGNI messaggio che ciascun client riceve
 * e si confronta OGNI campo con la verita' dell'altro battello allo stesso
 * istante di gioco:
 *  - nessuna coppia di numeri (oggetti {x, y} o vettori [x, y]) vicina alla
 *    posizione vera dell'altro;
 *  - nessun numero uguale alla sua quota o alla sua rotta (scelte apposta con
 *    decimali che nient'altro nei messaggi puo' avere);
 *  - nessuna sua identita': nome del battello, numero di scafo, nome
 *    dell'utente, identificativo interno, uid;
 *  - lo `stato` ricevuto e' davvero il proprio (coincide con la propria verita');
 *  - solo i tipi e i campi del protocollo.
 * E, perche' la prova non sia vuota: l'equipaggio di A riferisce un contatto
 * sul rilevamento giusto di B, preso dalle misure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avvia, cliente } from './clienti.js';
import { rilevamento as rilevamentoDa } from '../../shared/geo.js';
import { differenzaAngolare } from '../../shared/units.js';

/** Campi ammessi per tipo di messaggio (oltre a `t`). */
const CAMPI = /** @type {Record<string, string[]>} */ ({
  benvenuto: ['versione', 'utente', 'server', 'presenti'],
  pong: ['n', 'ora'],
  errore: ['codice', 'n', 'cosa', 'motivo', 'tipo', 'nota', 'atteso'],
  partita: ['id', 'scenario', 'ora', 'passo', 'scala_tempo', 'in_pausa', 'tempo_modificabile', 'origine', 'area', 'battello'],
  tempo: ['ora', 'scala_tempo', 'in_pausa', 'tempo_modificabile'],
  stato: ['ora', 'x', 'y', 'z', 'rotta', 'velocita', 'velocita_verticale', 'assetto', 'giri', 'macchina', 'timone', 'timoni_o',
    'rotta_ordinata', 'quota_ordinata', 'modo_quota', 'autopilota', 'cavitazione', 'v_cavitazione', 'towed', 'fondale',
    'profondita_acqua', 'strato', 'avvisi', 'danni'],
  sonar: ['ora', 'sensore', 'settori', 'ciechi', 'asse', 'sorda'],
  rapporto: ['ora', 'chi', 'chiave', 'parametri'],
  ricevuto: ['n', 'cosa', 'valore'],
  uscita: ['motivo'],
});

/** Parametri ammessi per ogni chiave di rapporto (docs/PROTOCOLLO.md): esattamente questi. */
const PARAMETRI = /** @type {Record<string, string[]>} */ ({
  'sonar.nuovo_contatto': ['contatto', 'sensore', 'rilevamento', 'speculare'],
  'sonar.contatto_perso': ['contatto', 'sensore'],
  'towed.in_filare': [], 'towed.filata': [], 'towed.in_ritiro': [], 'towed.ritirata': [], 'towed.tagliata': [],
  'towed.persa': [], 'towed.stabilizzata': [], 'towed.sorda': ['velocita'], 'towed.curva': ['velocita'],
  'towed.velocita_pericolosa': ['velocita_danno'],
  'macchina.cavitazione': ['v_cavitazione'], 'macchina.fine_cavitazione': ['v_cavitazione'],
  'guardia.quota_collaudo_vicina': ['quota', 'collaudo'], 'guardia.oltre_quota_collaudo': ['quota', 'collaudo'],
  'guardia.collasso': ['quota', 'collasso'], 'guardia.urto_fondale': ['quota'], 'guardia.in_superficie': [],
  'guardia.ripreso_il_comando': ['secondi'],
  'navigazione.fondale_vicino': ['sotto_chiglia'], 'navigazione.fondale_avanti': ['distanza', 'profondita'],
  'navigazione.waypoint_raggiunto': ['indice'], 'navigazione.ultimo_waypoint': [],
  'timone.rotta_raggiunta': ['rotta'], 'timone.quota_raggiunta': ['quota'],
});

/**
 * @typedef {{ora: number, x: number, y: number, z: number, rotta: number, velocita: number}} Verita
 */

/**
 * Tutte le foglie di un messaggio con il loro percorso.
 * @param {unknown} v
 * @param {string} p
 * @param {Array<[string, unknown]>} out
 */
function foglie(v, p, out) {
  if (v !== null && typeof v === 'object') {
    for (const [k, f] of Object.entries(v)) foglie(f, p ? `${p}.${k}` : k, out);
  } else {
    out.push([p, v]);
  }
  return out;
}

/**
 * Coppie (x, y) di un messaggio: oggetti con x e y numerici, vettori di due numeri.
 * @param {unknown} v
 * @param {string} p
 * @param {Array<[string, number, number]>} out
 */
function coppie(v, p, out) {
  if (Array.isArray(v)) {
    if (v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') out.push([p, v[0], v[1]]);
    v.forEach((f, i) => coppie(f, `${p}[${i}]`, out));
  } else if (v !== null && typeof v === 'object') {
    const o = /** @type {Record<string, unknown>} */ (v);
    if (typeof o.x === 'number' && typeof o.y === 'number') out.push([p, o.x, o.y]);
    for (const [k, f] of Object.entries(o)) coppie(f, p ? `${p}.${k}` : k, out);
  }
  return out;
}

/**
 * La verita' registrata piu' vicina a un'ora di gioco.
 * @param {Verita[]} storia
 * @param {number} ora
 */
function veritaA(storia, ora) {
  let migliore = storia[0];
  for (const s of storia) if (Math.abs(s.ora - ora) < Math.abs(migliore.ora - ora)) migliore = s;
  return migliore;
}

/**
 * Controlla che i messaggi ricevuti da `io` non contengano niente dell'`altro`.
 * @param {Array<Record<string, any>>} messaggi
 * @param {{uid: number, nome: string, sigla: string, utente: string, id: string, storia: Verita[], quota: number, rotta: number}} altro
 * @param {{storia: Verita[], da: number}} io  `da`: primo messaggio dopo la messa in scena
 * @returns {string[]} violazioni
 */
function violazioni(messaggi, altro, io) {
  /** @type {string[]} */
  const v = [];
  /** @type {number | null} */
  let ultimaOra = null;
  for (const [i, m] of messaggi.entries()) {
    const dove = `messaggio ${i} (${m.t})`;
    // forma: solo tipi e campi del protocollo
    const ammessi = CAMPI[m.t];
    if (!ammessi) { v.push(`${dove}: tipo inatteso`); continue; }
    for (const k of Object.keys(m)) if (k !== 't' && !ammessi.includes(k)) v.push(`${dove}: campo inatteso ${k}`);
    if (m.t === 'rapporto') {
      const ammessiP = PARAMETRI[m.chiave];
      if (!ammessiP) v.push(`${dove}: chiave di rapporto inattesa ${m.chiave}`);
      else if (JSON.stringify(Object.keys(m.parametri).sort()) !== JSON.stringify([...ammessiP].sort())) {
        v.push(`${dove}: parametri di ${m.chiave} diversi dal protocollo: ${Object.keys(m.parametri)}`);
      }
    }
    if (typeof m.ora === 'number' && m.t !== 'pong') ultimaOra = m.ora;
    // identita': mai, in nessun testo
    for (const [p, f] of foglie(m, '', [])) {
      if (typeof f === 'string') {
        for (const segreto of [altro.nome, altro.sigla, altro.utente]) if (f.includes(segreto)) v.push(`${dove}.${p}: contiene «${segreto}»`);
        if (f === altro.id) v.push(`${dove}.${p}: identificativo interno dell'altro`);
      }
      if (p.endsWith('uid') && f === altro.uid) v.push(`${dove}.${p}: uid dell'altro`);
    }
    if (ultimaOra === null || m.t === 'pong' || m.t === 'benvenuto') continue;
    const lui = veritaA(altro.storia, ultimaOra);
    const me = veritaA(io.storia, ultimaOra);
    // posizioni: nessuna coppia vicina a dove sta l'altro
    for (const [p, x, y] of coppie(m, '', [])) {
      if (Math.hypot(x - lui.x, y - lui.y) < 300) v.push(`${dove}.${p}: (${x}, ${y}) e' la posizione dell'altro (${lui.x.toFixed(0)}, ${lui.y.toFixed(0)})`);
    }
    // lo stato e' il proprio
    if (m.t === 'stato' && i >= io.da) {
      if (Math.hypot(m.x - me.x, m.y - me.y) > 60) v.push(`${dove}: lo stato non e' il proprio (${m.x}, ${m.y})`);
      if (Math.abs(m.z - me.z) > 1) v.push(`${dove}: quota non propria ${m.z}`);
    }
    // quota e rotta dell'altro, una volta assestate su valori che nient'altro ha
    const quotaFerma = Math.abs(lui.z - altro.quota) < 0.2;
    const rottaFerma = Math.abs(differenzaAngolare(lui.rotta, altro.rotta)) < 0.1;
    for (const [p, f] of foglie(m, '', [])) {
      if (typeof f !== 'number' || p === 'ora' || p === 'n') continue;
      if (quotaFerma && Math.abs(f - lui.z) < 0.06) v.push(`${dove}.${p}: ${f} e' la quota dell'altro`);
      if (rottaFerma && Math.abs(f - lui.rotta) < 0.06) v.push(`${dove}.${p}: ${f} e' la rotta dell'altro`);
    }
  }
  return v;
}

test('nebbia di guerra: nessun messaggio porta all\'uno la verita\' dell\'altro', { timeout: 120_000 }, async () => {
  const { cancello, palestra, url } = await avvia({ seme: 31337 });
  try {
    const a = await cliente(url, 41, 'Comandante Alfa');
    const b = await cliente(url, 42, 'Comandante Bravo');
    a.manda({ t: 'entra', scenario: 'torpex_palestra' });
    const pa = await a.aspetta('partita');
    b.manda({ t: 'entra', scenario: 'torpex_palestra' });
    const pb = await b.aspetta('partita');
    const partita = /** @type {NonNullable<typeof palestra.partita>} */ (palestra.partita);
    const ga = /** @type {NonNullable<ReturnType<typeof partita.giocatori.get>>} */ (partita.giocatori.get(41));
    const gb = /** @type {NonNullable<ReturnType<typeof partita.giocatori.get>>} */ (partita.giocatori.get(42));
    // Messa in scena: B a 3 km a est-nord-est di A, cosi' si sentono.
    gb.battello.x = ga.battello.x + 3000;
    gb.battello.y = ga.battello.y + 3000;
    const daA = a.messaggi.length;
    const daB = b.messaggi.length;
    const QUOTA_A = 45.7;
    const QUOTA_B = 33.3; // sotto lo strato, come A; decimali che nessun altro campo ha
    const ROTTA_A = 180;
    const ROTTA_B = 247.5; // idem: i rilevamenti dei rapporti sono interi
    const ordini = [
      [a, 'macchina', '1/3'], [a, 'quota', QUOTA_A], [a, 'rotta', ROTTA_A],
      [b, 'macchina', 'std'], [b, 'quota', QUOTA_B], [b, 'rotta', ROTTA_B],
    ];
    for (const [c, cosa, valore] of /** @type {[typeof a, string, unknown][]} */ (ordini)) c.manda({ t: 'ordine', cosa, valore });
    await a.svuota();
    await b.svuota();
    partita.scala = 32; // si forza: con due giocatori la scala e' bloccata a 1

    /** @type {Verita[]} */
    const storiaA = [];
    /** @type {Verita[]} */
    const storiaB = [];
    const registra = () => {
      for (const [g, s] of /** @type {const} */ ([[ga, storiaA], [gb, storiaB]])) {
        const v = g.battello;
        s.push({ ora: partita.ora, x: v.x, y: v.y, z: v.z, rotta: v.rotta, velocita: v.velocita });
      }
    };
    registra();
    let distanzaMinima = Infinity;
    while (partita.ora < 1200) {
      palestra.tick(0.125);
      registra();
      distanzaMinima = Math.min(distanzaMinima, Math.hypot(ga.battello.x - gb.battello.x, ga.battello.y - gb.battello.y));
      // ogni tanto si lascia correre il ciclo degli eventi: i messaggi partono davvero
      if (storiaA.length % 20 === 0) await new Promise((r) => setImmediate(r));
    }
    await a.svuota();
    await b.svuota();
    assert.ok(distanzaMinima > 1000, `i battelli si sono avvicinati troppo per la prova: ${distanzaMinima}`);

    const conta = (/** @type {typeof a} */ c, /** @type {string} */ t) => c.messaggi.filter((m) => m.t === t).length;
    assert.ok(conta(a, 'sonar') >= 1100, `fotogrammi di A: ${conta(a, 'sonar')}`);
    assert.ok(conta(a, 'stato') >= 250);

    const altroDiA = {
      uid: 42, nome: pb.battello.nome, sigla: pb.battello.sigla, utente: 'Bravo', id: gb.battello.id,
      storia: storiaB, quota: QUOTA_B, rotta: ROTTA_B,
    };
    const altroDiB = {
      uid: 41, nome: pa.battello.nome, sigla: pa.battello.sigla, utente: 'Alfa', id: ga.battello.id,
      storia: storiaA, quota: QUOTA_A, rotta: ROTTA_A,
    };
    // la messa in scena regge: quote e rotte si sono assestate su valori distintivi
    assert.ok(storiaB.some((s) => Math.abs(s.z - QUOTA_B) < 0.2) && storiaA.some((s) => Math.abs(s.z - QUOTA_A) < 0.2));
    assert.ok(storiaB.filter((s) => Math.abs(differenzaAngolare(s.rotta, ROTTA_B)) < 0.1).length > 200);

    const va = violazioni(a.messaggi, altroDiA, { storia: storiaA, da: daA });
    const vb = violazioni(b.messaggi, altroDiB, { storia: storiaB, da: daB });
    assert.deepEqual(va.slice(0, 20), [], `A riceve la verita' di B (${va.length} violazioni)`);
    assert.deepEqual(vb.slice(0, 20), [], `B riceve la verita' di A (${vb.length} violazioni)`);

    // la prova non e' vuota: A sente B, e il rilevamento riferito viene dalle misure
    const contatti = a.messaggi.filter((m) => m.t === 'rapporto' && m.chiave === 'sonar.nuovo_contatto' && m.parametri.sensore === 'sfera');
    const suB = contatti.filter((m) => {
      const lui = veritaA(storiaB, m.ora);
      const me = veritaA(storiaA, m.ora);
      return Math.abs(differenzaAngolare(rilevamentoDa(me, lui), m.parametri.rilevamento)) < 15;
    });
    assert.ok(suB.length >= 1, `A non ha mai riferito B: ${JSON.stringify(contatti.map((c) => c.parametri))}`);
    a.ws.close();
    b.ws.close();
  } finally {
    await cancello.chiudi('fine prove');
  }
});
