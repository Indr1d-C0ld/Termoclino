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
 *
 * F2 (protocollo v2): gli stessi controlli su TUTTI i tipi nuovi (sonar a
 * banda stretta, spettro, eco, intercetto, transitorio, visivo, esm, radar,
 * tracce, soluzione) e sui campi nuovi di `stato`; i parametri dei rapporti
 * sono esattamente quelli di RAPPORTI in shared/protocol.js. La seconda prova
 * mette i due battelli a quota periscopica, vicini, con gli alberi alzati, il
 * radar acceso, l'analizzatore puntato e i ping, a livelli d'assistenza
 * diversi (3 e 1), e controlla che ognuno dei messaggi nuovi sia davvero
 * arrivato e non porti niente dell'altro.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avvia, cliente } from './clienti.js';
import { rilevamento as rilevamentoDa } from '../../shared/geo.js';
import { differenzaAngolare } from '../../shared/units.js';
import { RAPPORTI, decodificaSpettro, decodificaDemon, decodificaSettori } from '../../shared/protocol.js';

/** Campi ammessi per tipo di messaggio (oltre a `t`). */
const CAMPI = /** @type {Record<string, string[]>} */ ({
  benvenuto: ['versione', 'utente', 'server', 'presenti'],
  pong: ['n', 'ora'],
  errore: ['codice', 'n', 'cosa', 'motivo', 'tipo', 'nota', 'atteso'],
  partita: ['id', 'scenario', 'ora', 'passo', 'scala_tempo', 'in_pausa', 'tempo_modificabile', 'origine', 'area', 'battello'],
  tempo: ['ora', 'scala_tempo', 'in_pausa', 'tempo_modificabile'],
  stato: ['ora', 'x', 'y', 'z', 'rotta', 'velocita', 'velocita_verticale', 'assetto', 'giri', 'macchina', 'timone', 'timoni_o',
    'rotta_ordinata', 'quota_ordinata', 'modo_quota', 'autopilota', 'cavitazione', 'v_cavitazione', 'towed', 'fondale',
    'profondita_acqua', 'strato', 'avvisi', 'danni',
    // v2
    'alberi', 'radar_attivo', 'ascolto_attivo', 'assistenza', 'analizzatore', 'designato'],
  sonar: ['ora', 'sensore', 'settori', 'ciechi', 'asse', 'sorda', 'banda'],
  rapporto: ['ora', 'chi', 'chiave', 'parametri'],
  ricevuto: ['n', 'cosa', 'valore'],
  uscita: ['motivo'],
  // v2 (PROTOCOLLO.md, «Messaggi nuovi dal server»)
  spettro: ['ora', 'sensore', 'rilevamento', 'contatto', 'da_hz', 'passo_hz', 'righe', 'demon_da_hz', 'demon_passo_hz', 'demon', 'asse', 'sorda'],
  eco: ['ora', 'ping', 'rilevamento', 'distanza', 'forza', 'riverbero'],
  intercetto: ['ora', 'rilevamento', 'tipo', 'frequenza_khz', 'livello'],
  transitorio: ['ora', 'sensore', 'rilevamento', 'speculare', 'tipo', 'forza'],
  visivo: ['ora', 'luce', 'oggetti'],
  esm: ['ora', 'emissioni'],
  radar: ['ora', 'echi'],
  tracce: ['ora', 'tracce'],
  storia: ['ora', 'contatto', 'punti'],
  soluzione: ['contatto', 'ora', 'rilevamento', 'distanza', 'rotta', 'velocita', 'q', 'ellisse', 'origine', 'esatta'],
});

/** Campi degli elementi dei vettori dei messaggi v2: esattamente questi (i facoltativi possono mancare). */
const ELEMENTI = /** @type {Record<string, {campo: string, ammessi: string[]}>} */ ({
  visivo: { campo: 'oggetti', ammessi: ['vista', 'rilevamento', 'aspetto', 'sagoma', 'elevazione_alberi', 'luci', 'sotto_orizzonte', 'scia'] },
  esm: { campo: 'emissioni', ammessi: ['rilevamento', 'tipo', 'banda', 'livello'] },
  radar: { campo: 'echi', ammessi: ['rilevamento', 'distanza'] },
  storia: { campo: 'punti', ammessi: ['ora', 'rilevamento', 'x', 'y', 'rotta'] },
  tracce: { campo: 'tracce', ammessi: ['contatto', 'sensori', 'rilevamento', 'variazione', 'classe', 'confidenza', 'stato', 'speculare'] },
});

/** Parametri ammessi per ogni chiave di rapporto: esattamente quelli di RAPPORTI (shared/protocol.js). */
const PARAMETRI = /** @type {Record<string, readonly string[]>} */ (RAPPORTI);

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
 * Il campo e' un angolo (rilevamenti, rotte, archi, assi, aspetti)?
 * @param {string} p percorso del campo
 */
function angolare(p) {
  return p.includes('ciechi')
    || /(^|\.)(rilevamento|speculare|asse|aspetto|rotta|rotta_ordinata|orientamento|variazione|timone|timoni_o|assetto|accostata)$/.test(p);
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
    const el = ELEMENTI[m.t];
    if (el) {
      if (!Array.isArray(m[el.campo])) v.push(`${dove}: ${el.campo} non e' un vettore`);
      else {
        for (const o of m[el.campo]) {
          for (const k of Object.keys(o)) if (!el.ammessi.includes(k)) v.push(`${dove}: campo inatteso ${el.campo}.${k}`);
        }
      }
    }
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
    // quota e rotta dell'altro, una volta assestate su valori che nient'altro ha. Da v2 i
    // messaggi portano molti piu' numeri (archi, rilevamenti al decimo, ellissi in metri): la
    // rotta si cerca nei campi angolari, la quota negli altri, se no le coincidenze del caso
    // (un arco cieco che finisce a 33,3°, un'ellisse di 180 m) sembrerebbero fughe.
    const quotaFerma = Math.abs(lui.z - altro.quota) < 0.2;
    const rottaFerma = Math.abs(differenzaAngolare(lui.rotta, altro.rotta)) < 0.1;
    for (const [p, f] of foglie(m, '', [])) {
      if (typeof f !== 'number' || p === 'ora' || p === 'n') continue;
      const angolo = angolare(p);
      if (!angolo && quotaFerma && Math.abs(f - lui.z) < 0.06) v.push(`${dove}.${p}: ${f} e' la quota dell'altro`);
      if (angolo && rottaFerma && Math.abs(f - lui.rotta) < 0.06) v.push(`${dove}.${p}: ${f} e' la rotta dell'altro`);
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

test('nebbia di guerra F2: periscopio, ESM, radar, ping, analizzatore e livelli diversi', { timeout: 120_000 }, async () => {
  const { cancello, palestra, url } = await avvia({ seme: 2718 });
  try {
    const a = await cliente(url, 51, 'Comandante Charlie');
    const b = await cliente(url, 52, 'Comandante Delta');
    a.manda({ t: 'entra', scenario: 'torpex_palestra', assistenza: 3 });
    const pa = await a.aspetta('partita');
    b.manda({ t: 'entra', scenario: 'torpex_palestra', assistenza: 1 });
    const pb = await b.aspetta('partita');
    const partita = /** @type {NonNullable<typeof palestra.partita>} */ (palestra.partita);
    const ga = /** @type {NonNullable<ReturnType<typeof partita.giocatori.get>>} */ (partita.giocatori.get(51));
    const gb = /** @type {NonNullable<ReturnType<typeof partita.giocatori.get>>} */ (partita.giocatori.get(52));
    // Messa in scena: entrambi a quota periscopica, B a 1,6 km a nord-est di A: ci si vede al
    // periscopio (alberi), ci si sente all'ESM e al radar, i ping tornano e si intercettano.
    const QUOTA_A = 18.7;
    const QUOTA_B = 19.3;
    const ROTTA_A = 166.6;
    const ROTTA_B = 247.5;
    gb.battello.x = ga.battello.x + 1300;
    gb.battello.y = ga.battello.y + 900;
    for (const [g, q] of /** @type {const} */ ([[ga, QUOTA_A], [gb, QUOTA_B]])) {
      g.battello.z = q;
      g.battello.quotaOrdinata = q;
      g.battello._zPrecedente = q;
    }
    const daA = a.messaggi.length;
    const daB = b.messaggi.length;
    const ordini = [
      [a, 'macchina', '1/3'], [a, 'quota', QUOTA_A], [a, 'rotta', ROTTA_A],
      [a, 'albero', { quale: 'periscopio', alzato: true }], [a, 'albero', { quale: 'esm', alzato: true }],
      [a, 'albero', { quale: 'radar', alzato: true }], [a, 'radar', true],
      [a, 'analizzatore', { sensore: 'sfera', rilevamento: 55 }],
      [b, 'macchina', '1/3'], [b, 'quota', QUOTA_B], [b, 'rotta', ROTTA_B],
      [b, 'albero', { quale: 'periscopio', alzato: true }], [b, 'albero', { quale: 'radar', alzato: true }], [b, 'radar', true],
      [b, 'albero', { quale: 'esm', alzato: true }],
    ];
    for (const [c, cosa, valore] of /** @type {[typeof a, string, unknown][]} */ (ordini)) c.manda({ t: 'ordine', cosa, valore });
    await a.svuota();
    await b.svuota();
    for (const c of [a, b]) {
      const rifiuti = c.messaggi.filter((m) => m.t === 'errore' && m.codice !== undefined);
      assert.deepEqual(rifiuti, [], `ordini respinti: ${JSON.stringify(rifiuti)}`);
    }
    partita.scala = 32;

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
    let prossimoPing = 30;
    while (partita.ora < 600) {
      palestra.tick(0.125);
      registra();
      distanzaMinima = Math.min(distanzaMinima, Math.hypot(ga.battello.x - gb.battello.x, ga.battello.y - gb.battello.y));
      if (partita.ora >= prossimoPing && gb.battello.attivo.ascolto === 0) {
        prossimoPing = partita.ora + 60;
        b.manda({ t: 'ordine', cosa: 'attivo', valore: { rilevamento: null, portata: 'corta' } });
        await b.svuota();
      }
      if (storiaA.length % 20 === 0) await new Promise((r) => setImmediate(r));
    }
    await a.svuota();
    await b.svuota();
    assert.ok(distanzaMinima > 1000, `i battelli si sono avvicinati troppo per la prova: ${distanzaMinima}`);
    assert.ok(storiaB.some((s) => Math.abs(s.z - QUOTA_B) < 0.2) && storiaA.some((s) => Math.abs(s.z - QUOTA_A) < 0.2));
    assert.ok(storiaB.filter((s) => Math.abs(differenzaAngolare(s.rotta, ROTTA_B)) < 0.1).length > storiaB.length / 2);
    assert.ok(storiaA.filter((s) => Math.abs(differenzaAngolare(s.rotta, ROTTA_A)) < 0.1).length > storiaA.length / 2);

    const altroDiA = {
      uid: 52, nome: pb.battello.nome, sigla: pb.battello.sigla, utente: 'Delta', id: gb.battello.id,
      storia: storiaB, quota: QUOTA_B, rotta: ROTTA_B,
    };
    const altroDiB = {
      uid: 51, nome: pa.battello.nome, sigla: pa.battello.sigla, utente: 'Charlie', id: ga.battello.id,
      storia: storiaA, quota: QUOTA_A, rotta: ROTTA_A,
    };
    const va = violazioni(a.messaggi, altroDiA, { storia: storiaA, da: daA });
    const vb = violazioni(b.messaggi, altroDiB, { storia: storiaB, da: daB });
    assert.deepEqual(va.slice(0, 20), [], `A riceve la verita' di B (${va.length} violazioni)`);
    assert.deepEqual(vb.slice(0, 20), [], `B riceve la verita' di A (${vb.length} violazioni)`);

    // La prova non e' vuota: ogni meccanica nuova ha mandato i suoi messaggi, ben formati.
    const di = (/** @type {typeof a} */ c, /** @type {string} */ t) => c.messaggi.filter((m) => m.t === t);
    assert.ok(di(a, 'intercetto').length >= 3, `intercettazioni di A: ${di(a, 'intercetto').length}`);
    assert.ok(di(b, 'eco').length >= 1, `echi di B: ${di(b, 'eco').length}`);
    assert.ok(di(a, 'visivo').some((m) => m.oggetti.some((/** @type {any} */ o) => o.sagoma === null)), 'A non vede gli alberi di B');
    assert.ok(di(a, 'esm').some((m) => m.emissioni.some((/** @type {any} */ e) => e.tipo === 'AN/BPS-15')), 'l\'ESM di A non sente il radar di B');
    assert.ok(di(b, 'esm').some((m) => m.emissioni.some((/** @type {any} */ e) => e.tipo === 'AN/BPS-15')), 'l\'ESM di B non sente il radar di A');
    assert.ok(di(a, 'radar').some((m) => m.echi.length > 0), 'il radar di A non vede niente');
    assert.ok(di(a, 'transitorio').length >= 1, 'A non sente i transitori di B (alberi, scafo)');
    const spettri = di(a, 'spettro');
    assert.ok(spettri.length >= 100, `spettri di A: ${spettri.length}`);
    for (const m of spettri) {
      assert.ok(decodificaSpettro(m) && decodificaDemon(m), 'spettro malformato');
    }
    assert.ok(di(a, 'sonar').some((m) => m.banda === 'stretta' && decodificaSettori(m.settori)), 'niente fotogrammi a banda stretta');
    assert.ok(di(a, 'stato').some((m) => m.alberi.periscopio && m.radar_attivo && m.analizzatore?.sensore === 'sfera'));
    a.ws.close();
    b.ws.close();
  } finally {
    await cancello.chiudi('fine prove');
  }
});

// ---------------------------------------------------------------------------
// I (equipaggio, TMA): tracce e soluzioni a tutti i livelli di assistenza
// ---------------------------------------------------------------------------

/**
 * Le soluzioni ricevute da `io` su contatti che l'arbitro (lato server, nel
 * diario) attribuiva all'altro giocatore in quell'istante.
 * @param {Array<Record<string, any>>} messaggi
 * @param {Array<Record<string, any>>} eventi  il diario della partita
 * @param {string} io  id interno di chi riceve
 * @param {string} altro  id interno dell'altro giocatore
 */
function soluzioniSullAltro(messaggi, eventi, io, altro) {
  return messaggi.filter((m) => {
    if (m.t !== 'soluzione') return false;
    let sorgente = null;
    for (const e of eventi) {
      if (e.ora > m.ora) break;
      if ((e.evento === 'scoperta' || e.evento === 'soluzione' || e.evento === 'classificazione')
        && e.osservatore === io && e.contatto === m.contatto) sorgente = e.sorgente;
    }
    return sorgente === altro;
  });
}

test('nebbia di guerra F2 (equipaggio): tracce e soluzioni non portano mai la verita\' di un altro giocatore, a nessun livello', { timeout: 180_000 }, async (t) => {
  for (const [livA, livB] of /** @type {const} */ ([[3, 2], [1, 0]])) {
    const { cancello, palestra, url } = await avvia({ seme: 1618 + livA });
    try {
      const a = await cliente(url, 61, 'Comandante Echo');
      const b = await cliente(url, 62, 'Comandante Foxtrot');
      a.manda({ t: 'entra', scenario: 'torpex_palestra', assistenza: livA });
      const pa = await a.aspetta('partita');
      b.manda({ t: 'entra', scenario: 'torpex_palestra', assistenza: livB });
      const pb = await b.aspetta('partita');
      const partita = /** @type {NonNullable<typeof palestra.partita>} */ (palestra.partita);
      const ga = /** @type {NonNullable<ReturnType<typeof partita.giocatori.get>>} */ (partita.giocatori.get(61));
      const gb = /** @type {NonNullable<ReturnType<typeof partita.giocatori.get>>} */ (partita.giocatori.get(62));
      // B a 3 km da A, a tutta forza (cavita: lo si sente); A fa due gambe e ha la soluzione
      ga.battello.x = -4000; ga.battello.y = 8000; ga.battello.rotta = 90; ga.battello.rottaOrdinata = 90;
      gb.battello.x = -1500; gb.battello.y = 9500; gb.battello.rotta = 270; gb.battello.rottaOrdinata = 270;
      for (const [c, cosa, valore] of /** @type {[typeof a, string, unknown][]} */ ([
        [a, 'macchina', '1/3'], [a, 'quota', 60], [b, 'macchina', 'full'], [b, 'quota', 41.3], [b, 'rotta', 247.5],
      ])) c.manda({ t: 'ordine', cosa, valore });
      await a.svuota();
      await b.svuota();
      partita.scala = 32;
      /** @type {Map<number, {a: Verita, b: Verita}>} */
      const storia = new Map();
      let girata = false;
      while (partita.ora < 1000) {
        palestra.tick(1 / 32); // un secondo di gioco per giro: la verita' di ogni secondo
        storia.set(Math.round(partita.ora), {
          a: { ora: partita.ora, x: ga.battello.x, y: ga.battello.y, z: ga.battello.z, rotta: ga.battello.rotta, velocita: ga.battello.velocita },
          b: { ora: partita.ora, x: gb.battello.x, y: gb.battello.y, z: gb.battello.z, rotta: gb.battello.rotta, velocita: gb.battello.velocita },
        });
        if (!girata && partita.ora >= 450) {
          girata = true;
          a.manda({ t: 'ordine', cosa: 'rotta', valore: 0 });
          await a.svuota();
        }
        if (storia.size % 20 === 0) await new Promise((r) => setImmediate(r));
      }
      await a.svuota();
      await b.svuota();
      // i controlli generali di questa prova (campi, identita', posizioni). Il confronto con quota
      // e rotta dell'altro qui si spegne (NaN): i rilevamenti al decimo delle tracce e delle
      // soluzioni di tutti i contatti incontrano per caso qualunque valore al decimo, e la rotta
      // e la quota di B le controllano gia' le due prove qui sopra; la rotta stimata di B la
      // controlla questa prova, piu' sotto, contro la verita'.
      const storiaA = [...storia.values()].map((v) => v.a);
      const storiaB = [...storia.values()].map((v) => v.b);
      const va = violazioni(a.messaggi, {
        uid: 62, nome: pb.battello.nome, sigla: pb.battello.sigla, utente: 'Foxtrot', id: gb.battello.id, storia: storiaB, quota: NaN, rotta: NaN,
      }, { storia: storiaA, da: a.messaggi.length });
      const vb = violazioni(b.messaggi, {
        uid: 61, nome: pa.battello.nome, sigla: pa.battello.sigla, utente: 'Echo', id: ga.battello.id, storia: storiaA, quota: NaN, rotta: NaN,
      }, { storia: storiaB, da: b.messaggi.length });
      assert.deepEqual(va.slice(0, 20), [], `A riceve la verita' di B (${va.length} violazioni)`);
      assert.deepEqual(vb.slice(0, 20), [], `B riceve la verita' di A (${vb.length} violazioni)`);
      const eventi = partita.diario.eventi;
      for (const [c, io, altro, lui] of /** @type {const} */ ([[a, 'b1', 'b2', 'b'], [b, 'b2', 'b1', 'a']])) {
        const livello = c === a ? livA : livB;
        const sol = c.messaggi.filter((m) => m.t === 'soluzione');
        const tracce = c.messaggi.filter((m) => m.t === 'tracce');
        assert.ok(tracce.length >= 240, `${io}: messaggi tracce ${tracce.length}`);
        // ai livelli 0-1 l'equipaggio non manda soluzioni proprie
        if (livello <= 1) assert.ok(sol.every((m) => m.origine === 'comandante'), `${io} al livello ${livello}`);
        // la lettera esatta solo al livello 3, e mai sull'altro giocatore
        if (livello < 3) assert.ok(sol.every((m) => m.esatta === undefined));
        const sullAltro = soluzioniSullAltro(c.messaggi, eventi, io, altro);
        for (const m of sullAltro) {
          assert.notEqual(m.esatta, true, `${io}: lettera esatta sull'altro giocatore`);
          const v = /** @type {NonNullable<ReturnType<typeof storia.get>>} */ (storia.get(m.ora));
          const me = io === 'b1' ? v.a : v.b;
          const altroV = v[lui];
          const th = m.rilevamento * Math.PI / 180;
          const errore = Math.hypot(me.x + m.distanza * Math.sin(th) - altroV.x, me.y + m.distanza * Math.cos(th) - altroV.y);
          const erroreRotta = Math.abs(differenzaAngolare(m.rotta, altroV.rotta));
          const erroreV = Math.abs(m.velocita - Math.abs(altroV.velocita));
          // una stima, non la verita' copiata: mai tutto esatto insieme
          assert.ok(!(errore < 1 && erroreRotta < 0.5 && erroreV < 0.05), `${io} a ${m.ora}: soluzione identica alla verita' dell'altro`);
        }
        if (c === a) {
          t.diagnostic(`livello ${livA}: ${sol.length} soluzioni, ${sol.filter((m) => m.esatta).length} esatte, ${sullAltro.length} sull'altro giocatore`);
          if (livA === 3) {
            assert.ok(sol.some((m) => m.esatta === true), 'la prova e\' vuota: nessuna lettera esatta (contatti non umani)');
            assert.ok(sullAltro.length > 0, 'la prova e\' vuota: A non ha soluzioni su B');
          }
        }
      }
      a.ws.close();
      b.ws.close();
    } finally {
      await cancello.chiudi('fine prove');
    }
  }
});
