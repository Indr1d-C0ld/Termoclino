// Prove del libro delle firme (web/assets/js/client/biblioteca.js) sui dati comuni veri
// (shared/data/piattaforme/*.json e shared/data/firme/*.json del filone H): ogni classe del protocollo
// che ha un file diventa una voce con righe tonali, pale, altezza d'albero, sagoma e radar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { importa, RADICE } from './ambiente_client.mjs';

const { caricaBiblioteca, normalizzaClasse, righeAttese, concordanza, NODI_LIBRO } = await importa('biblioteca.js');
const { CLASSI } = await import('../../shared/protocol.js');

/** Lettore dal disco come quello del browser (relativo a shared/). @param {string} p */
const leggi = async (p) => JSON.parse(readFileSync(path.join(RADICE, 'shared', p), 'utf8'));

const libro = await caricaBiblioteca(leggi);

test('il libro ha una voce per ogni classe del protocollo che ha un file', () => {
  const conFile = CLASSI.filter((c) => ['piattaforme', 'firme'].some((d) => existsSync(path.join(RADICE, 'shared', 'data', d, `${c}.json`))));
  assert.deepEqual(libro.map((c) => c.id), conFile);
  assert.ok(libro.length >= 2);
});

test('le voci: righe tonali ordinate, pale, e per le navi altezza d\'albero, sagoma e radar', () => {
  for (const c of libro) {
    assert.ok(c.righe.every((r, i) => i === 0 || r.hz >= c.righe[i - 1].hz), `${c.id}: righe non ordinate`);
    assert.ok(c.righe.every((r) => r.hz > 0 && r.hz < 5000), `${c.id}: frequenza fuori scala`);
  }
  const fs = libro.find((c) => c.id === 'forrest_sherman');
  if (fs) {
    assert.equal(fs.tipo, 'superficie');
    assert.ok(fs.albero !== null && fs.albero > 10 && fs.albero < 60);
    assert.equal(fs.sagoma, 'FOREST');
    assert.ok(fs.righe.some((r) => !r.variabile));
    assert.ok(fs.pale !== null && fs.pale >= 2);
  }
  const ssn = libro.find((c) => c.id === '688');
  if (ssn) assert.equal(ssn.tipo, 'sottomarino');
});

test('normalizzazione: tonali fisse, righe dei giri alla velocità del libro, intervalli di velocità', () => {
  const c = normalizzaClasse('prova', [{
    identita: { nome: 'Prova' },
    propulsione: { elica_pale: { valore: 5 }, giri_per_nodo: { valore: 6 } },
    acustica: {
      tonali: [{ nome: 'rete', frequenza: { valore: 60 }, sopra_banda_larga: { valore: 10 }, da_velocita: { valore: 0 }, a_velocita: { valore: 30 } },
        { nome: 'pompe alte', frequenza: { valore: 148 }, da_velocita: { valore: 16 } }],
      righe_giri: [{ nome: 'riduttore', per_giro: { valore: 120 } }],
    },
    ottica: { altezza_alberi: { valore: 25 }, sagoma: 'MERCH' },
    emettitori: [{ nome: 'navigazione', banda: 'I' }],
  }]);
  assert.deepEqual(c.righe.map((r) => [r.hz, r.variabile]), [[60, false], [120 * 6 * NODI_LIBRO / 60, true], [148, false]]);
  assert.equal(c.pale, 5);
  assert.equal(c.albero, 25);
  assert.equal(c.sagoma, 'MERCH');
  assert.deepEqual(c.radar, ['navigazione']);
  assert.deepEqual(righeAttese(c, 10).map((r) => r.hz), [60, 120]);
  // il punteggio di concordanza conta le righe fisse ritrovate fra quelle misurate
  assert.equal(concordanza([{ hz: 60.4 }, { hz: 147 }], c, 1), 1);
  assert.equal(concordanza([{ hz: 50 }], c, 1), 0);
});
