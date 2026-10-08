// Prove dei cataloghi dei messaggi (web/assets/js/client/lingue/): stesse chiavi in italiano e in
// inglese, una frase per ogni rapporto che il server può mandare (cercato nel codice del server
// vero e del finto), per ogni codice d'errore e motivo stabile, per ogni ordine ripetuto; formati.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { importa, RADICE } from './ambiente_client.mjs';

const { CATALOGHI, traduci, frasePerRicevuto } = await importa('lingue/indice.js');
const { perIlFont } = await importa('resa/testo.js');
const { ERRORI, MOTIVI_ORDINE, CONTESTO_688, QUOTE_SPECIALI } = await import('../../shared/protocol.js');
const { CHIAVI_RAPPORTO } = await import('../strumenti/finto_server.mjs');

/** Tutti i file .js sotto una cartella. @param {string} dir @returns {string[]} */
function fileJs(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? fileJs(p) : n.endsWith('.js') ? [p] : [];
  });
}

/**
 * Le chiavi dei rapporti nel codice del server vero: ogni stringa 'ruolo.qualcosa' con uno dei ruoli
 * che parlano (PROTOCOLLO.md v1, «Rapporti dell'equipaggio») o con l'antenna rimorchiata.
 */
function chiaviDelServer() {
  const chiavi = new Set();
  for (const f of fileJs(path.join(RADICE, 'server', 'src'))) {
    const testo = readFileSync(f, 'utf8');
    for (const m of testo.matchAll(/'((?:sonar|towed|macchina|guardia|navigazione|timone)\.[a-z_]+)'/g)) chiavi.add(m[1]);
  }
  return chiavi;
}

test('italiano e inglese hanno le stesse chiavi', () => {
  assert.deepEqual(Object.keys(CATALOGHI.en).sort(), Object.keys(CATALOGHI.it).sort());
});

test('ogni rapporto del server vero ha la sua frase', () => {
  const chiavi = chiaviDelServer();
  assert.ok(chiavi.size >= 20, `trovate solo ${chiavi.size} chiavi nel server: il modo di cercarle è cambiato?`);
  for (const k of chiavi) {
    for (const lingua of ['it', 'en']) assert.ok(CATALOGHI[lingua][k], `${lingua}: manca ${k}`);
  }
});

test('ogni rapporto del finto server ha la sua frase', () => {
  for (const k of CHIAVI_RAPPORTO) for (const lingua of ['it', 'en']) assert.ok(CATALOGHI[lingua][k], `${lingua}: manca ${k}`);
});

test('codici d\'errore e motivi degli ordini respinti: tutti tradotti', () => {
  for (const c of Object.values(ERRORI)) assert.ok(CATALOGHI.it[`errore.${c}`], `manca errore.${c}`);
  const rifiuti = ['tempo_bloccato', 'senza_towed', 'towed_stato', 'troppi_waypoint', 'nessun_waypoint', 'fuori_area', 'indice'];
  for (const m of rifiuti) {
    assert.ok(Object.values(MOTIVI_ORDINE).includes(m), `${m} non è più un motivo del protocollo`);
    assert.ok(CATALOGHI.it[`motivo.${m}`], `manca motivo.${m}`);
  }
  for (const m of ['esci', 'altra_connessione', 'partita_chiusa']) assert.ok(CATALOGHI.it[`uscita.${m}`]);
});

test('l\'equipaggio ripete ogni ordine accettato con una frase del catalogo', () => {
  /** @type {[string, unknown][]} */
  const casi = [
    ...CONTESTO_688.ordiniMacchina.map((v) => /** @type {[string, unknown]} */ (['macchina', v])),
    ['timone', 0], ['timone', -15], ['timoni_o', 0], ['timoni_o', 10], ['quota', 120.5],
    ...QUOTE_SPECIALI.map((v) => /** @type {[string, unknown]} */ (['quota', v])),
    ['rotta', 45], ['waypoint', { azione: 'aggiungi', x: 1, y: 2 }], ['waypoint', { azione: 'svuota' }],
    ['autopilota', true], ['autopilota', false], ['scala_tempo', 4], ['pausa', true], ['pausa', false],
  ];
  for (const [cosa, valore] of casi) {
    const f = frasePerRicevuto(cosa, valore);
    assert.ok(f, `nessuna frase per ${cosa}`);
    for (const lingua of ['it', 'en']) {
      assert.ok(CATALOGHI[lingua][f.chiave], `${lingua}: manca ${f.chiave}`);
      const t = traduci(lingua, f.chiave, f.parametri);
      assert.ok(!/[{}]/.test(t), `segnaposto rimasto in «${t}»`);
    }
  }
  assert.equal(frasePerRicevuto('towed', 'fila'), null); // l'antenna ha i suoi rapporti dal server
});

test('i testi stanno nel font del 1989: maiuscole, cifre e segni da 20h a 5Fh, niente accenti né @', () => {
  for (const [lingua, cat] of Object.entries(CATALOGHI)) {
    for (const [k, v] of Object.entries(cat)) {
      const nudo = v.replace(/\{[^}]*\}/g, '').replace(/\n/g, ' ');
      for (const ch of nudo) {
        const c = ch.charCodeAt(0);
        assert.ok(c >= 0x20 && c <= 0x5f && ch !== '@', `${lingua} ${k}: «${ch}» non è nel font`);
      }
      assert.equal(perIlFont(nudo), nudo);
    }
  }
});

test('formati: piedi, gradi a tre cifre, ordinali da uno, speculare dell\'antenna', () => {
  assert.equal(traduci('it', 'timone.quota_raggiunta', { quota: 45.72 }), 'QUOTA 150 PIEDI, COMANDANTE');
  assert.equal(traduci('en', 'timone.rotta_raggiunta', { rotta: 5 }), 'STEADY ON COURSE 005 CAPTAIN');
  assert.equal(traduci('it', 'navigazione.waypoint_raggiunto', { indice: 0 }), 'WAYPOINT 1 RAGGIUNTO, COMANDANTE');
  assert.equal(
    traduci('it', 'sonar.nuovo_contatto', { contatto: 'S2', sensore: 'towed', rilevamento: 45, speculare: 135 }),
    "NUOVO CONTATTO S2 ALL'ANTENNA PER 045 O 135",
  );
  assert.equal(
    traduci('en', 'sonar.nuovo_contatto', { contatto: 'S1', sensore: 'sfera', rilevamento: 300, speculare: null }),
    'NEW CONTACT S1 BEARING 300',
  );
  assert.equal(traduci('it', 'ricevuto.macchina', { valore: 'flank' }), 'MACCHINA AVANTI A TUTTA FORZA, COMANDANTE');
});

test('una chiave sconosciuta si mostra comunque, leggibile', () => {
  assert.equal(traduci('it', 'guardia.qualcosa_di_nuovo', { quota: 50 }), 'QUALCOSA DI NUOVO 50');
});
