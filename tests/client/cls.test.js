// Prove dell'interprete CLS del client (web/assets/js/client/cls.js).
//
// 1. Prove sintetiche: programmi CLS scritti a mano e un font finto; girano sempre, anche in un clone
//    pubblico che non ha i file originali.
// 2. Confronto pixel per pixel con l'interprete di riferimento Python: per ogni lavoro di
//    cls/pannelli.json (tutte le stazioni 688 e Alfa, status, sala comando, selezione missione,
//    configurazione, dialoghi) l'interprete JS disegna su FrameBuffer e le due pagine devono coincidere
//    byte per byte con quelle scritte da `estrai688.py --fixture`; devono coincidere anche hotspot,
//    agganci, tabella SETMAP e stato finale. Servono gli asset e le fixture generati dalla copia
//    dell'utente; se mancano la prova si salta con il motivo.
//
//    python3 tools/estrai/estrai688.py "<cartella del gioco>" --client --fixture
//    node --test tests/client/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InterpreteCls, FrameBuffer, preparaRisorse, caricaRisorse, eseguiLavoro, hotspotIn, s16, LARGHEZZA,
} from '../../web/assets/js/client/cls.js';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ORIGINALI = process.env.TERMOCLINO_ORIGINALI ?? path.join(RADICE, 'web', 'assets', 'originali');
const FIXTURE = process.env.TERMOCLINO_FIXTURE ?? path.join(RADICE, 'tests', 'client', 'fixture');

// ------------------------------------------------------------------------------ prove sintetiche

/** Font finto: 224 glifi larghi 3 con la riga 0 piena (111) e la riga 1 col solo pixel di sinistra. */
function fontFinto() {
  const glifi = [];
  for (let g = 0; g < 224; g++) glifi.push({ codice: 0x20 + g, larghezza: 3, righe: [0xe0, 0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
  const A_Z = [];
  for (let i = 0; i < 26; i++) A_Z.push(0x41 + i);
  A_Z[1] = 0xe7; // B -> glifo del cirillico finto
  return { primo_codice: 0x20, glifi, cirillico: { A_Z } };
}

/**
 * @param {any[]} routine liste di istruzioni, la prima è main
 * @param {Record<string, any>} [figure]
 */
function risorseFinte(routine, figure = {}) {
  const prog = {
    formato: 'termoclino-cls/1', nome: 'PROVA.CLS',
    routine: routine.map((codice, i) => ({ indice: i, nome: i ? `L${i - 1}` : 'main', nargs: 0, tipi: [], codice })),
  };
  return preparaRisorse({ programmi: [prog], figure: { figure }, font: fontFinto() });
}

/** @param {number} op @param {any[]} a */
const P = (op, ...a) => ({ '@': 0, op, a });

/** @param {FrameBuffer} fb @param {number} x @param {number} y @param {'schermo'|'retro'} [pg] */
const px = (fb, x, y, pg = 'schermo') => fb.pagine[pg][y * LARGHEZZA + x];

test('s16: parole a 16 bit con segno', () => {
  assert.equal(s16(0xffff), -1);
  assert.equal(s16(0x8000), -32768);
  assert.equal(s16(0x7fff), 32767);
  assert.equal(s16(65536 + 5), 5);
});

test('primitive grafiche: rettangoli rovesciati, linee, contorno', () => {
  const ris = risorseFinte([[P(1, 10, 10, 5, 5, 3), P(3, 20, 30, 25, 7), P(2, 40, 22, 20, 9), P(9, 50, 50, 52, 52, 12)]]);
  const fb = new FrameBuffer();
  new InterpreteCls({ risorse: ris, bersaglio: fb }).esegui('PROVA.CLS');
  assert.equal(px(fb, 5, 5), 3);
  assert.equal(px(fb, 10, 10), 3);
  assert.equal(px(fb, 30, 20), 7);
  assert.equal(px(fb, 25, 20), 7);
  assert.deepEqual([px(fb, 40, 19), px(fb, 40, 20), px(fb, 40, 22), px(fb, 40, 23)], [0, 9, 9, 0]);
  assert.equal(px(fb, 51, 50), 12);
  assert.equal(px(fb, 51, 51), 0); // RECT è solo contorno
  assert.equal(fb.fuoriSchermo, 0);
});

test('CIRCLE: il contorno usa il colore di CIRCLE_EDGE, non il colore dato', () => {
  const ris = risorseFinte([[P(22, 5), P(14, 100, 100, 4, 9, 0), P(14, 150, 100, 4, 9, 1), P(14, 200, 100, 4, 9, 2)]]);
  const fb = new FrameBuffer();
  new InterpreteCls({ risorse: ris, bersaglio: fb }).esegui('PROVA.CLS');
  assert.equal(px(fb, 104, 100), 5); // modo 0: contorno nel colore 5
  assert.equal(px(fb, 100, 100), 0); // ... e vuoto dentro
  assert.equal(px(fb, 154, 100), 9); // modo 1: pieno di colore 9
  assert.equal(px(fb, 150, 100), 9);
  assert.equal(px(fb, 204, 100), 5); // modo 2: pieno 9 e contorno 5
  assert.equal(px(fb, 200, 100), 9);
});

test('testo: a capo a fine finestra, ritorno in cima, grassetto, cirillico', () => {
  // finestra larga 10: glifi di 3 + spaziatura 1 -> due per riga; interlinea 9; alta 20 -> poi si torna su
  const ris = risorseFinte([[P(27, 0, 0, 10, 20), P(12, 4), P(5, 'AAAAAA')]]);
  const fb = new FrameBuffer();
  const it = new InterpreteCls({ risorse: ris, bersaglio: fb });
  it.esegui('PROVA.CLS');
  assert.equal(px(fb, 0, 0), 4);
  assert.equal(px(fb, 4, 0), 4);
  assert.equal(px(fb, 8, 0), 0); // terzo glifo: non ci sta (8 + 3 + 1 > 10), va a capo
  assert.equal(px(fb, 0, 9), 4);
  // terza riga: 9 + 18 > 20, quindi ricomincia da y = 0 (finestra[1])
  assert.deepEqual([it.stato.x, it.stato.y], [8, 0]);

  const fb2 = new FrameBuffer();
  const it2 = new InterpreteCls({ risorse: risorseFinte([[P(6, 0, 50), P(5, '@A@A')]]), bersaglio: fb2 });
  it2.esegui('PROVA.CLS');
  assert.equal(px(fb2, 3, 50), 15); // grassetto: glifo ridisegnato a x + 1
  assert.equal(it2.stato.x, 4 + 1 + 4); // avanzamento +1 in grassetto
  assert.equal(it2.stato.grassetto, 0);

  /** @type {Uint8Array[]} */
  const glifi = [];
  const it3 = new InterpreteCls({
    risorse: risorseFinte([[P(5, 'B5b@@')]]), cirillico: true,
    bersaglio: { pagina() {}, copia() {}, riempi() {}, pixel() {}, rigaFigura() {},
      glifo: (_x, _y, r) => { glifi.push(r); } },
  });
  it3.esegui('PROVA.CLS');
  assert.equal(glifi.length, 4); // B, 5, b, @
  const font = it3.risorse.font;
  assert.equal(glifi[0], font.righe[0xe7 - 0x20]); // B -> cirillico
  assert.equal(glifi[1], font.righe[0x35 + 0xad - 0x20]); // 5 -> E2h
  assert.equal(glifi[2], font.righe[0x62 - 0x20]); // le minuscole restano latine
  assert.equal(glifi[3], font.righe[0x40 - 0x20]); // '@@' stampa '@'
});

test('figure: base in basso, ultima riga memorizzata saltata, trasparenza, nibble di riempimento', () => {
  // figura 3x2 (H = 2): 3 righe memorizzate dal basso, 4 pixel per riga (W dispari: si disegna anche il 4°)
  const righe = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 9]);
  const figura = { larghezza: 3, altezza: 2, righe: 3, pixel_per_riga: 4, dati: Buffer.from(righe).toString('base64') };
  const fb = new FrameBuffer();
  new InterpreteCls({ risorse: risorseFinte([[P(28, 'X.ENC', 10, 10, 6)]], { 'X.ENC': figura }), bersaglio: fb }).esegui('PROVA.CLS');
  assert.deepEqual([px(fb, 10, 12), px(fb, 13, 12)], [1, 4]); // prima riga memorizzata a y + H
  assert.deepEqual([px(fb, 10, 11), px(fb, 11, 11)], [5, 0]); // il 6 è trasparente
  assert.equal(px(fb, 10, 10), 0); // la terza riga (9 9 9 9) non si disegna
});

test('pagine, SAVE_RECT / RESTORE_RECT, hotspot, SETMAP, agganci', () => {
  const ris = risorseFinte([[
    P(1, 0, 0, 319, 199, 2), // schermo pieno di 2
    P(24, 10, 10, 20, 20), // salva il riquadro sullo schermo nel retro
    P(1, 10, 10, 20, 20, 7),
    P(10, 0, 0, 0, 50, 50, 15, 65, 1), P(10, 3, 10, 10, 20, 20, 14, 200, 2), P(10, 0, 0, 0, 5, 5, 1, 1, 1),
    P(21, 2), // tiene i primi due hotspot
    P(11, 14, 6), P(7, 3, 100, 100, 1), P(16, 1, 1, 0, 0),
  ], [P(25)]]);
  const fb = new FrameBuffer();
  const it = new InterpreteCls({ risorse: ris, bersaglio: fb });
  it.esegui('PROVA.CLS');
  assert.equal(px(fb, 15, 15), 7);
  assert.equal(px(fb, 15, 15, 'retro'), 2);
  assert.equal(it.hotspot.length, 2);
  assert.equal(hotspotIn(it.hotspot, 15, 15)?.tasto, 200); // vince l'ultimo registrato
  assert.equal(hotspotIn(it.hotspot, 40, 40)?.tasto, 65);
  assert.equal(hotspotIn(it.hotspot, 60, 60), null);
  assert.deepEqual(it.tabella, { 14: 6 });
  assert.deepEqual(it.agganci.map((a) => a.tipo), ['cifra', 'attesa']);
  assert.deepEqual(it.agganci[0], { tipo: 'cifra', x1: 100, y1: 100, x2: 110, y2: 110, valore: 3, barra: [115, 101, 157, 108] });
  it.esegui('PROVA.CLS', 1); // RESTORE_RECT
  assert.equal(px(fb, 15, 15), 2);
});

// ------------------------------------------------------------------------------ confronto con il riferimento

const disponibili = existsSync(path.join(ORIGINALI, 'manifest.json')) && existsSync(path.join(FIXTURE, 'indice.json'));
const MOTIVO = `asset originali o fixture assenti (${path.relative(RADICE, ORIGINALI)}, ${path.relative(RADICE, FIXTURE)}): `
  + 'generarli dalla propria copia con python3 tools/estrai/estrai688.py "<cartella del gioco>" --client --fixture';

/** @param {Uint8Array} atteso @param {Uint8Array} ottenuto */
function primaDifferenza(atteso, ottenuto) {
  let n = 0, primo = -1;
  for (let i = 0; i < atteso.length; i++) {
    if (atteso[i] !== ottenuto[i]) {
      if (primo < 0) primo = i;
      n++;
    }
  }
  return n ? `${n} pixel diversi, il primo in (${primo % LARGHEZZA}, ${Math.floor(primo / LARGHEZZA)}): `
    + `atteso ${atteso[primo]}, ottenuto ${ottenuto[primo]}` : '';
}

if (!disponibili) {
  test('pannelli originali: confronto pixel per pixel con il riferimento Python', { skip: MOTIVO }, () => {});
} else {
  const leggi = (/** @type {string} */ rel) => JSON.parse(readFileSync(path.join(ORIGINALI, rel), 'utf8'));
  const risorse = await caricaRisorse(async (rel) => leggi(rel));
  const pannelli = leggi('cls/pannelli.json');
  const indice = JSON.parse(readFileSync(path.join(FIXTURE, 'indice.json'), 'utf8'));

  test('fixture e asset vengono dalla stessa versione dell\'estrattore', () => {
    const man = leggi('manifest.json');
    assert.equal(indice.sha256_estrattore, man.estrattore.sha256,
      'rigenerare insieme asset e fixture: estrai688.py ... --client --fixture');
    assert.deepEqual(indice.lavori, pannelli.lavori.map((/** @type {{id: string}} */ l) => l.id));
  });

  for (const lavoro of pannelli.lavori) {
    test(`pannello ${lavoro.id}: pixel, hotspot e agganci identici al riferimento`, () => {
      const fb = new FrameBuffer();
      const it = eseguiLavoro(risorse, lavoro, fb);
      const atteso = JSON.parse(readFileSync(path.join(FIXTURE, `${lavoro.id}.json`), 'utf8'));
      for (const pg of /** @type {const} */ (['schermo', 'retro'])) {
        const ref = new Uint8Array(readFileSync(path.join(FIXTURE, `${lavoro.id}.${pg}.bin`)));
        const diff = primaDifferenza(ref, fb.indici(pg));
        assert.equal(diff, '', `pagina ${pg}: ${diff}`);
      }
      assert.equal(fb.fuoriSchermo, 0);
      assert.deepEqual(it.anomalie, atteso.anomalie);
      assert.deepEqual(it.hotspot, atteso.hotspot);
      assert.deepEqual(it.agganci, atteso.agganci);
      assert.deepEqual(it.tabella, atteso.tabella);
      assert.deepEqual(it.parole, atteso.parole);
      assert.deepEqual(it.coppie, atteso.coppie);
      assert.deepEqual(it.stato, atteso.stato);
      // e i dati precalcolati per il client coincidono con quello che calcola il client
      assert.deepEqual(it.risultato, lavoro.risultato);
    });
  }
}
