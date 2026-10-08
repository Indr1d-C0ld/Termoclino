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
const { ERRORI, MOTIVI_ORDINE, CONTESTO_688, QUOTE_SPECIALI, RAPPORTI, CHIAVI_RAPPORTO, CLASSI, ALBERI, TIPI_TRANSITORIO } = await import('../../shared/protocol.js');
const { CHIAVI_RAPPORTO: CHIAVI_FINTO } = await import('../strumenti/finto_server.mjs');

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

test('ogni rapporto del protocollo (RAPPORTI di shared/protocol.js) ha la sua frase, con i soli parametri dichiarati', () => {
  assert.ok(CHIAVI_RAPPORTO.length >= 38, `solo ${CHIAVI_RAPPORTO.length} chiavi nel protocollo`);
  for (const k of CHIAVI_RAPPORTO) {
    for (const lingua of ['it', 'en']) {
      const frase = CATALOGHI[lingua][k];
      assert.ok(frase, `${lingua}: manca ${k}`);
      for (const m of frase.matchAll(/\{([a-z_0-9]+)(?:\|[a-z_]+)?\}/g)) {
        assert.ok(RAPPORTI[k].includes(m[1]), `${lingua} ${k}: {${m[1]}} non è un parametro del rapporto`);
      }
      // con tutti i parametri (anche null) la frase non lascia segnaposto
      const parametri = Object.fromEntries(RAPPORTI[k].map((p) => [p, p === 'contatto' ? 'S1' : 5]));
      assert.ok(!/[{}]/.test(traduci(lingua, k, parametri)), `${lingua} ${k}: segnaposto rimasto`);
    }
  }
});

test('ogni rapporto del finto server è nel protocollo', () => {
  for (const k of CHIAVI_FINTO) assert.ok(CHIAVI_RAPPORTO.includes(k), `${k} non è in RAPPORTI`);
});

test('codici d\'errore e motivi degli ordini respinti: tutti tradotti', () => {
  for (const c of Object.values(ERRORI)) assert.ok(CATALOGHI.it[`errore.${c}`], `manca errore.${c}`);
  const rifiuti = ['tempo_bloccato', 'senza_towed', 'towed_stato', 'troppi_waypoint', 'nessun_waypoint', 'fuori_area', 'indice',
    'quota', 'albero', 'contatto', 'livello', 'senza_sensore', 'ping_in_corso', 'settore'];
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
    // v2
    ['assistenza', 0], ['assistenza', 3], ['analizzatore', null], ['analizzatore', { contatto: 'S2' }],
    ['analizzatore', { sensore: 'towed', rilevamento: 45.5 }], ['attivo', { rilevamento: null, portata: 'lunga' }],
    ...ALBERI.flatMap((quale) => [true, false].map((alzato) => /** @type {[string, unknown]} */ (['albero', { quale, alzato }]))),
    ['radar', true], ['radar', false], ['designa', 'S1'], ['designa', null],
    ['classifica', { contatto: 'S1', classe: 'forrest_sherman' }], ['classifica', { contatto: 'S1', classe: null }],
    ['soluzione', { contatto: 'S1', ora: 10, distanza: 5000, rotta: 90, velocita: 10 }], ['soluzione', { contatto: 'S1', cancella: true }],
    ['abbandona', 'S1'],
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

test('v2: classi del libro e tipi di transitorio hanno il loro nome; designazioni cirilliche nel font', () => {
  for (const c of CLASSI) {
    for (const lingua of ['it', 'en']) {
      for (const k of [`classe.${c}`, `classe_media.${c}`, `ui.tma.classe_breve.${c}`]) assert.ok(CATALOGHI[lingua][k], `${lingua}: manca ${k}`);
    }
  }
  for (const t of TIPI_TRANSITORIO) assert.ok(`fmt.transitorio.${t}` in CATALOGHI.it, `manca fmt.transitorio.${t}`);
  assert.equal(traduci('it', 'sonar.classificato', { contatto: 'S3', classe: 'forrest_sherman', confidenza: 0.82 }),
    'S3 CLASSIFICATO: CACCIATORPEDINIERE FORREST SHERMAN (82)');
  assert.equal(traduci('it', 'sonar.transitorio', { contatto: null, sensore: 'towed', tipo: 'scafo', rilevamento: 7 }),
    "TRANSITORIO DI SCAFO ALL'ANTENNA PER 007");
  assert.equal(traduci('en', 'sonar.transitorio', { contatto: 'S2', sensore: 'sfera', tipo: 'pompa', rilevamento: 120 }),
    'TRANSIENT PUMP BEARING 120 (S2)');
  assert.equal(traduci('it', 'tma.consiglio_manovra', { contatto: 'S1', accostata: 90, lato: 'sinistra', minuti: 6 }),
    'PER S1: ACCOSTARE DI 90 GRADI A SINISTRA PER 6 MINUTI');
  assert.equal(traduci('it', 'sonar.eco', { rilevamento: 45, distanza: 3657.6 }), 'ECO PER 045, 4000 IARDE');
  // l'equipaggio dell'Alfa designa i contatti in cirillico: nel font diventano i glifi del pseudo-cirillico
  assert.equal(perIlFont('Ц12'), '\xf012');
  assert.equal(traduci('it', 'sonar.contatto_perso', { contatto: 'Ц1' }), 'CONTATTO Ц1 PERSO');
});
