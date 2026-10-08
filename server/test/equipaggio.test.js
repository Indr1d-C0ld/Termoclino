// @ts-check
/**
 * L'equipaggio nella palestra (server/src/sim/crew/ e server/src/match/):
 * la TMA che converge con due gambe e che senza manovra resta a Q bassa, i
 * livelli di assistenza 0-3 (con la lettera esatta solo per i contatti non
 * umani), gli ordini dell'equipaggio, ogni evento del diario dalla sua
 * meccanica, e le statistiche di una sessione registrata su file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { partita, raccoglitore } from './aiuto.js';
import { validaOrdine, MOTIVI_ORDINE, RAPPORTI } from '../../shared/protocol.js';
import { RegistroIstantanee } from '../src/match/istantanee.js';
import { EVENTI } from '../src/match/diario.js';
import { leggiDiario, statistiche } from '../src/match/statistiche.js';
import { rilevamento } from '../../shared/geo.js';
import { norm180 } from '../../shared/tma.js';

/** @typedef {ReturnType<typeof partita>} Partita */
/** @typedef {NonNullable<ReturnType<Partita['aggiungiGiocatore']>>} Giocatore */

/**
 * Un ordine validato come farebbe il cancello; restituisce il motivo del rifiuto o null.
 * @param {Partita} p @param {Giocatore} g @param {string} cosa @param {unknown} valore
 */
function ordina(p, g, cosa, valore) {
  const v = validaOrdine({ cosa, valore }, g.contesto);
  if (!v.ok) throw new Error(`ordine non valido ${cosa} ${JSON.stringify(valore)}: ${v.motivo}`);
  return p.ordine(g.uid, v.ordine);
}

/**
 * Il 688 a sud del cacciatorpediniere DD-931 (n1, che va verso est a 12 kt
 * lungo y = 14 km), a 1/3 e 60 m: la geometria delle prove di convergenza.
 * @param {number | string} seme @param {number} [livello]
 */
function scena(seme, livello = 2) {
  /** @type {Record<string, unknown>[]} */
  const righe = [];
  const p = partita(seme, {}, /** @type {any} */ ({ scrivi: (/** @type {any} */ o) => righe.push(o), chiudi: async () => {} }));
  const r = raccoglitore();
  const g = /** @type {Giocatore} */ (p.aggiungiGiocatore(1, 'A', r.invia, { assistenza: livello }));
  g.battello.x = -4000; g.battello.y = 8000; g.battello.rotta = 90; g.battello.rottaOrdinata = 90;
  assert.equal(ordina(p, g, 'macchina', '1/3'), null);
  assert.equal(ordina(p, g, 'quota', 60), null);
  return { p, r, g, righe };
}

/**
 * @param {Partita} p @param {number} secondi
 * @param {(s: number) => void} [ogni]  prima del secondo s
 * @param {(s: number) => void} [dopo]  dopo il secondo s (p.ora === s)
 */
function corri(p, secondi, ogni, dopo) {
  const da = Math.round(p.ora);
  for (let s = da + 1; s <= da + secondi; s++) {
    ogni?.(s);
    for (let k = 0; k < 10; k++) p.passo();
    dopo?.(s);
  }
}

/**
 * La traccia di una sorgente nel diario (la prima scoperta che l'arbitro le attribuisce).
 * @param {Partita} p @param {string} sorgente @param {string} [osservatore]
 */
function contattoDi(p, sorgente, osservatore = 'b1') {
  return p.diario.eventi.find((e) => e.evento === 'scoperta' && e.prima && e.sorgente === sorgente && e.osservatore === osservatore)?.contatto;
}

test('TMA nella palestra: con due gambe la soluzione arriva sotto il 15 % con Q ≥ 70; nessuna soluzione «sicura» sbagliata', (t) => {
  for (const seme of [2, 4, 8]) {
    const { p, r, g } = scena(seme);
    corri(p, 1200, (s) => { if (s === 600) assert.equal(ordina(p, g, 'rotta', 0), null); });
    const c = contattoDi(p, 'n1');
    assert.ok(c, `seme ${seme}: il cacciatorpediniere non e' stato scoperto`);
    const sol = p.diario.di('soluzione').filter((e) => e.contatto === c);
    const ultima = sol[sol.length - 1];
    const msg = r.di('soluzione').filter((m) => m.contatto === c);
    t.diagnostic(`seme ${seme}: ${c}, ultima soluzione q ${ultima.q}, errore di distanza ${ultima.errore_distanza_pct} %, ` +
      `rotta ${ultima.errore_rotta}°, velocita' ${ultima.errore_velocita} kt; prima Q ≥ 70 a ${sol.find((e) => /** @type {number} */ (e.q) >= 70)?.ora} s`);
    assert.ok(/** @type {number} */ (ultima.q) >= 70, `seme ${seme}: Q ${ultima.q}`);
    assert.ok(Math.abs(/** @type {number} */ (ultima.errore_distanza_pct)) < 15, `seme ${seme}: errore ${ultima.errore_distanza_pct} %`);
    assert.ok(msg.length > 10 && msg.every((m) => m.origine === 'equipaggio' && m.esatta === undefined));
    assert.ok(r.di('rapporto').some((m) => m.chiave === 'tma.soluzione' && m.parametri.contatto === c));
    // nessuna traccia con Q ≥ 70 e la distanza sbagliata di piu' del 30 %
    const cattive = p.diario.di('soluzione').filter((e) => /** @type {number} */ (e.q) >= 70 && Math.abs(/** @type {number} */ (e.errore_distanza_pct)) > 30);
    assert.deepEqual(cattive, [], `seme ${seme}`);
  }
});

test('TMA senza manovra: la distanza non e\' osservabile, Q resta bassa, l\'equipaggio lo dice e consiglia l\'accostata', () => {
  const { p, r } = scena(2);
  corri(p, 900);
  const c = /** @type {string} */ (contattoDi(p, 'n1'));
  assert.ok(c);
  const sol = r.di('soluzione').filter((m) => m.contatto === c);
  assert.ok(sol.every((m) => m.q < 30), `soluzioni con Q: ${sol.map((m) => m.q)}`);
  const rapp = r.di('rapporto');
  const non = rapp.find((m) => m.chiave === 'tma.distanza_non_osservabile');
  assert.ok(non, 'nessun avviso di distanza non osservabile');
  const consiglio = rapp.find((m) => m.chiave === 'tma.consiglio_manovra');
  assert.ok(consiglio, 'nessun consiglio di manovra');
  assert.ok(consiglio.parametri.accostata >= 30 && ['sinistra', 'dritta'].includes(consiglio.parametri.lato));
  assert.ok(consiglio.parametri.minuti >= 3 && consiglio.parametri.minuti <= 10);
  assert.ok(p.diario.di('consiglio').length >= 1);
  for (const m of rapp.filter((x) => x.chiave.startsWith('tma.'))) {
    assert.deepEqual(Object.keys(m.parametri).sort(), [...RAPPORTI[m.chiave]].sort());
    assert.equal(m.chi, 'tiro');
  }
});

test('livelli 0 e 1: niente soluzioni dell\'equipaggio; il comandante la da\' e l\'equipaggio la ripete; Ekelund al cambio di gamba', () => {
  for (const livello of [0, 1]) {
    const { p, r, g } = scena(4, livello);
    corri(p, 1200, (s) => {
      // il comandante designa il cacciatorpediniere: la centrale lavora su quello
      if (s === 300) assert.equal(ordina(p, g, 'designa', contattoDi(p, 'n1')), null);
      if (s === 600) assert.equal(ordina(p, g, 'rotta', 0), null);
    });
    assert.deepEqual(r.di('soluzione'), [], `livello ${livello}: soluzioni dell'equipaggio`);
    const c = /** @type {string} */ (contattoDi(p, 'n1'));
    const ekelund = r.di('rapporto').filter((m) => m.chiave === 'tma.ekelund');
    if (livello === 1) {
      assert.ok(ekelund.length >= 1, 'livello 1: nessun Ekelund');
      const n1 = /** @type {any} */ (p.entita.get('n1'));
      const vera = Math.hypot(n1.x - g.battello.x, n1.y - g.battello.y);
      assert.ok(Math.abs(ekelund[0].parametri.distanza - vera) / vera < 0.5, `Ekelund ${ekelund[0].parametri.distanza} contro ${vera}`);
    } else {
      assert.deepEqual(ekelund, []);
      assert.equal(r.di('rapporto').filter((m) => m.chiave === 'tma.consiglio_manovra').length, 0);
    }
    // la soluzione del comandante: eco subito, e nel diario con l'errore vero
    const n1 = /** @type {any} */ (p.entita.get('n1'));
    const ril = rilevamento(g.battello, n1);
    const esito = ordina(p, g, 'soluzione', { contatto: c, ora: p.ora, distanza: 7000, rotta: 90, velocita: 12, rilevamento: Math.round(ril * 10) / 10 });
    assert.equal(esito, null);
    const eco = r.di('soluzione').at(-1);
    assert.equal(eco?.origine, 'comandante');
    assert.equal(eco?.q, null);
    assert.equal(eco?.ellisse, null);
    assert.equal(eco?.distanza, 7000);
    const ev = p.diario.di('soluzione').at(-1);
    assert.equal(ev?.origine, 'comandante');
    assert.equal(typeof ev?.errore_distanza_pct, 'number');
    // e poi ogni 10 s la stessa soluzione portata avanti
    corri(p, 20);
    const dopo = r.di('soluzione').filter((m) => m.ora > /** @type {number} */ (eco?.ora));
    assert.ok(dopo.length >= 1 && dopo.every((m) => m.origine === 'comandante'));
    assert.equal(ordina(p, g, 'soluzione', { contatto: c, cancella: true }), null);
    assert.equal(ordina(p, g, 'soluzione', { contatto: 'S99', cancella: true }), MOTIVI_ORDINE.CONTATTO);
  }
});

test('livello 3: la lettera esatta dopo il fix, ma solo per i contatti non umani', () => {
  const { p, r, g } = scena(5, 3);
  const rb = raccoglitore();
  const gb = /** @type {Giocatore} */ (p.aggiungiGiocatore(2, 'B', rb.invia, { assistenza: 3 }));
  // B a 2,5 km, a tutta forza: A lo sente, lo tiene, e ci fa la TMA
  gb.battello.x = -1500; gb.battello.y = 8500; gb.battello.rotta = 270; gb.battello.rottaOrdinata = 270;
  assert.equal(ordina(p, gb, 'macchina', 'full'), null);
  /** @type {Map<number, {a: {x: number, y: number}, b: {x: number, y: number}}>} */
  const posizioni = new Map();
  corri(p, 900, (s) => {
    if (s === 400) assert.equal(ordina(p, g, 'rotta', 0), null);
  }, (s) => posizioni.set(s, { a: { x: g.battello.x, y: g.battello.y }, b: { x: gb.battello.x, y: gb.battello.y } }));
  const esatte = r.di('soluzione').filter((m) => m.esatta === true);
  assert.ok(esatte.length > 0, 'nessuna soluzione esatta');
  const umano = p.diario.di('scoperta').filter((e) => e.osservatore === 'b1' && e.sorgente === 'b2').map((e) => e.contatto);
  assert.ok(umano.length > 0, 'A non ha mai sentito B: la prova e\' vuota');
  for (const m of esatte) {
    const vera = p.diario.di('soluzione').find((e) => e.osservatore === 'b1' && e.contatto === m.contatto && e.esatta);
    assert.ok(vera, `soluzione esatta di ${m.contatto} senza evento nel diario`);
    assert.notEqual(vera.sorgente, 'b2', 'la lettera esatta di un umano');
    assert.equal(m.q, 100);
    // e soprattutto: la lettera esatta non sta mai dove sta B
    const pos = /** @type {NonNullable<ReturnType<typeof posizioni.get>>} */ (posizioni.get(m.ora));
    const th = m.rilevamento * Math.PI / 180;
    const x = pos.a.x + m.distanza * Math.sin(th);
    const y = pos.a.y + m.distanza * Math.cos(th);
    assert.ok(Math.hypot(x - pos.b.x, y - pos.b.y) > 500, `${m.contatto} a ${m.ora}: la lettera esatta e' B`);
  }
  // i contatti di B hanno al piu' la soluzione dell'equipaggio: stimata, mai esatta
  const diB = r.di('soluzione').filter((m) => {
    const e = p.diario.di('soluzione').findLast((x) => x.osservatore === 'b1' && x.contatto === m.contatto && x.ora <= m.ora);
    return e?.sorgente === 'b2';
  });
  for (const m of diB) assert.notEqual(m.esatta, true);
  // le esatte arrivano solo dopo il fix (FIX_SECONDI di traccia tenuta)
  for (const m of esatte) {
    const d = /** @type {any} */ (p.diario.di('scoperta').find((e) => e.osservatore === 'b1' && e.contatto === m.contatto && e.prima));
    assert.ok(m.ora - d.ora >= 180, `${m.contatto}: esatta a ${m.ora - d.ora} s dalla scoperta`);
  }
});

test('ordini dell\'equipaggio: assistenza, designa, classifica, abbandona; contatti sconosciuti e livelli non ammessi', () => {
  const { p, r, g } = scena(2, 2);
  corri(p, 30);
  const c = /** @type {string} */ (r.di('rapporto').find((m) => m.chiave === 'sonar.nuovo_contatto')?.parametri.contatto);
  assert.ok(c);
  assert.equal(ordina(p, g, 'designa', c), null);
  assert.equal(p.stato(g).designato, c);
  assert.equal(ordina(p, g, 'designa', 'S77'), MOTIVI_ORDINE.CONTATTO);
  assert.equal(ordina(p, g, 'classifica', { contatto: c, classe: 'alfa' }), null);
  corri(p, 4);
  const voce = r.di('tracce').at(-1)?.tracce.find((/** @type {any} */ x) => x.contatto === c);
  assert.equal(voce.classe, 'alfa');
  assert.equal(voce.confidenza, null);
  assert.equal(ordina(p, g, 'assistenza', 1), null);
  assert.equal(p.stato(g).assistenza, 1);
  assert.equal(ordina(p, g, 'abbandona', c), null);
  corri(p, 4);
  assert.ok(!r.di('tracce').at(-1)?.tracce.some((/** @type {any} */ x) => x.contatto === c));
  assert.equal(p.stato(g).designato, null);
  assert.equal(ordina(p, g, 'abbandona', c), MOTIVI_ORDINE.CONTATTO);
  p.livelliAmmessi = [2];
  assert.equal(ordina(p, g, 'assistenza', 3), MOTIVI_ORDINE.LIVELLO);
  const ev = p.diario.eventi;
  assert.ok(ev.some((e) => e.evento === 'classificazione' && e.da === 'comandante' && e.contatto === c && e.corretta === false));
  assert.ok(ev.some((e) => e.evento === 'assistenza' && e.livello === 1));
  assert.ok(ev.some((e) => e.evento === 'abbandono' && e.contatto === c));
});

test('diario: ogni meccanica scrive i suoi eventi, con la verita\', e le statistiche si calcolano dal file', async (t) => {
  const cartella = await mkdtemp(join(tmpdir(), 'termoclino-diario-'));
  try {
    const reg = /** @type {RegistroIstantanee} */ (await RegistroIstantanee.apri(cartella, 'diario-prova'));
    const p = partita(11, {}, reg);
    const ra = raccoglitore();
    const rb = raccoglitore();
    const ga = /** @type {Giocatore} */ (p.aggiungiGiocatore(1, 'A', ra.invia, { assistenza: 2 }));
    const gb = /** @type {Giocatore} */ (p.aggiungiGiocatore(2, 'B', rb.invia, { assistenza: 3 }));
    ga.battello.x = -4000; ga.battello.y = 8000; ga.battello.rotta = 90; ga.battello.rottaOrdinata = 90;
    gb.battello.x = 2000; gb.battello.y = 9000; gb.battello.rotta = 270; gb.battello.rottaOrdinata = 270;
    for (const [g, cosa, valore] of /** @type {[Giocatore, string, unknown][]} */ ([
      [ga, 'macchina', '1/3'], [ga, 'quota', 60], [ga, 'towed', 'fila'], [gb, 'macchina', 'full'], [gb, 'quota', 30],
    ])) assert.equal(ordina(p, g, cosa, valore), null);
    corri(p, 1500, (s) => {
      if (s === 500) { ordina(p, ga, 'rotta', 0); ordina(p, gb, 'macchina', '1/3'); }
      if (s === 800) ordina(p, gb, 'quota', 'periscopica');
      if (s === 1100) { ordina(p, ga, 'rotta', 270); ordina(p, gb, 'quota', 100); }
      if (s === 1200) ordina(p, ga, 'assistenza', 1);
    });
    p.rimuoviGiocatore(2, 'esci');
    await p.chiudi();
    assert.equal(p.diario.difetti, 0, 'eventi con campi mancanti');

    const d = await leggiDiario(reg.percorso);
    const tipi = new Set(d.eventi.map((e) => e.evento));
    for (const tipo of ['entra', 'esce', 'ordine', 'fine', 'scoperta', 'perdita', 'classificazione', 'soluzione',
      'controscoperta', 'assistenza', 'cavitazione', 'strato', 'periscopica']) {
      assert.ok(tipi.has(tipo), `nessun evento «${tipo}» nel diario`);
    }
    for (const e of d.eventi) {
      assert.ok(EVENTI[e.evento], `evento sconosciuto ${e.evento}`);
      for (const k of EVENTI[e.evento]) assert.ok(k in e, `${e.evento} senza ${k}`);
    }
    // la verita' che servira' alle statistiche
    const scoperte = d.eventi.filter((e) => e.evento === 'scoperta' && e.sorgente !== null);
    assert.ok(scoperte.length > 0 && scoperte.every((e) => typeof e.distanza_vera === 'number' && typeof e.se === 'number'));
    // l'arbitro attribuisce la scoperta alla sorgente che sta sul rilevamento misurato
    // (per l'antenna ancora ambigua, uno dei due lati)
    const scarto = (/** @type {any} */ e) => Math.min(...[e.rilevamento, e.speculare].filter((x) => x !== null)
      .map((x) => Math.abs(norm180(x - e.rilevamento_vero))));
    assert.ok(scoperte.every((e) => scarto(e) < 12), JSON.stringify(scoperte.filter((e) => scarto(e) >= 12)));
    const contro = d.eventi.filter((e) => e.evento === 'controscoperta');
    assert.ok(contro.every((e) => ['b1', 'b2'].includes(/** @type {string} */ (e.sorgente))));
    assert.ok(contro.some((e) => e.causa === 'cavitazione'), 'B a tutta forza cavita e si fa sentire');
    const cls = d.eventi.filter((e) => e.evento === 'classificazione');
    assert.ok(cls.every((e) => typeof e.corretta === 'boolean' && 'classe_vera' in e));
    assert.ok(d.verita.length >= 1500);

    const s = statistiche(d);
    t.diagnostic(`statistiche: ${JSON.stringify({ partita: s.partita, b1: s.battelli.b1.ascolto, b2: s.battelli.b2.discrezione })}`);
    assert.equal(s.partita.difetti, 0);
    const b1 = s.battelli.b1;
    const b2 = s.battelli.b2;
    assert.equal(b1.uid, 1);
    assert.equal(b2.assistenza, 3);
    assert.equal(b2.servizio.uscita, 1500);
    assert.ok(b1.servizio.miglia > 1.5 && b1.servizio.miglia < 3, `miglia ${b1.servizio.miglia}`);
    assert.ok(b2.servizio.velocita_media_kt > b1.servizio.velocita_media_kt);
    assert.ok(b1.ascolto.contatti >= 2);
    assert.ok(Object.keys(b1.ascolto.prime_scoperte).length >= 1);
    assert.equal(b1.ascolto.vantaggio.length, 1);
    assert.equal(b1.ascolto.vantaggio[0].contro, 'b2');
    assert.ok(b2.discrezione.tempo_cavitazione_s > 60, `cavitazione ${b2.discrezione.tempo_cavitazione_s}`);
    assert.ok(b2.discrezione.tempo_periscopica_s > 60, `periscopica ${b2.discrezione.tempo_periscopica_s}`);
    assert.ok(b2.discrezione.tempo_sotto_strato_s + b2.discrezione.tempo_sopra_strato_s <= 1500);
    assert.ok(Object.values(b2.discrezione.controscoperte).reduce((a, x) => a + /** @type {number} */ (x), 0) >= 1);
    assert.equal(b1.discrezione.tempo_cavitazione_s, 0);
  } finally {
    await rm(cartella, { recursive: true, force: true });
  }
});

test('chi rientra riceve la storia tempo-rilevamento delle tracce risolte: misure e posizioni proprie', () => {
  const { p, g } = scena(2);
  corri(p, 600);
  const r2 = raccoglitore();
  assert.ok(p.riprendi(1, r2.invia, 0), 'il battello si riprende');
  const storie = r2.di('storia');
  assert.ok(storie.length > 0 && storie.some((s) => s.punti.length >= 20), 'almeno una traccia con la sua storia');
  for (const s of storie) {
    assert.ok(g.equipaggio.tracce.some((t) => t.contatto === s.contatto), `${s.contatto} è una traccia dell'equipaggio`);
    for (let i = 1; i < s.punti.length; i++) assert.ok(s.punti[i].ora > s.punti[i - 1].ora, 'punti in ordine di tempo');
    for (const q of s.punti) {
      assert.deepEqual(Object.keys(q).sort(), ['ora', 'rilevamento', 'rotta', 'x', 'y']);
      // la posizione è quella propria (o dell'antenna, che sta a poppa): mai a chilometri dal proprio battello
      assert.ok(Math.hypot(q.x - g.battello.x, q.y - g.battello.y) < 1852 * 12, 'posizione del proprio sensore');
    }
  }
});
