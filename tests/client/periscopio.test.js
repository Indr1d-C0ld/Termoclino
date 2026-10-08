// Prove del periscopio (web/assets/js/client/resa/periscopio.js e stazioni/periscopio.js): proiezione dei
// rilevamenti, scelta della figura dall'aspetto (e lo specchio), scala delle sagome, stadimetro, costa
// all'orizzonte, PNG RGBA delle sagome; con gli asset originali la stazione composta come in 033.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { importa, lettoreDisco, CI_SONO_ORIGINALI, MOTIVO_SALTO } from './ambiente_client.mjs';

const {
  VISTA, CIELO, MARE, INGRANDIMENTI, ALTEZZA_MINIMA, xDiRilevamento, rilevamentoDiX, fotogrammaPerAspetto, figuraPer,
  scalaFigura, rettangoloFigura, disegnaFigura, disegnaCieloMare, distanzaStadimetro, elevazioneAlbero, profiloCosta,
  pixelPerGrado,
} = await importa('resa/periscopio.js');
const { Tela } = await importa('resa/tela.js');
const { decodificaPngRgba, rgbaInIndici } = await importa('resa/png.js');
const { spieEsm } = await importa('stazioni/periscopio.js');

test('cielo e mare: una riga di indici per ogni riga della finestra, orizzonte in y 90 (033)', () => {
  assert.equal(CIELO.length, VISTA.orizzonte - VISTA.y1);
  assert.equal(MARE.length, VISTA.y2 - VISTA.orizzonte + 1);
  assert.ok([...CIELO, ...MARE].every((c) => c >= 16 && c <= 79)); // la rampa del cielo di DAY/NIGHT
  const t = new Tela();
  disegnaCieloMare(t);
  assert.equal(t.leggi(50, 28), 78);
  assert.equal(t.leggi(50, 89), 18);
  assert.equal(t.leggi(50, 90), 62);
  assert.equal(t.leggi(50, 120), 77);
  assert.equal(t.leggi(7, 60), 0); // fuori dalla finestra non si tocca
});

test('proiezione: il centro del reticolo è x 92, gradi per pixel dall\'ingrandimento, andata e ritorno', () => {
  const [basso, alto] = INGRANDIMENTI;
  assert.equal(pixelPerGrado(basso.campo), 168 / 32);
  assert.equal(pixelPerGrado(alto.campo), 21);
  assert.equal(xDiRilevamento(100, 100, alto.campo), 92.5);
  assert.equal(xDiRilevamento(101, 100, alto.campo), 92.5 + 21);
  assert.equal(xDiRilevamento(359, 1, basso.campo), 92.5 - 2 * 5.25); // a cavallo del nord
  assert.equal(xDiRilevamento(200, 100, alto.campo), null);
  for (const x of [8, 50, 92, 175]) {
    const r = rilevamentoDiX(x, 45, basso.campo);
    assert.ok(Math.abs((xDiRilevamento(r, 45, basso.campo) ?? 0) - (x + 0.5)) < 1e-9);
  }
});

test('aspetto → figura: cinque angolazioni dal fianco di dritta, il lato di sinistra specchiato', () => {
  assert.deepEqual(fotogrammaPerAspetto(0), { indice: 0, specchio: false });
  assert.deepEqual(fotogrammaPerAspetto(40), { indice: 1, specchio: false });
  assert.deepEqual(fotogrammaPerAspetto(90), { indice: 2, specchio: false });
  assert.deepEqual(fotogrammaPerAspetto(-90), { indice: 2, specchio: true });
  assert.deepEqual(fotogrammaPerAspetto(270), { indice: 2, specchio: true });
  assert.deepEqual(fotogrammaPerAspetto(-135), { indice: 3, specchio: true });
  assert.deepEqual(fotogrammaPerAspetto(180), { indice: 4, specchio: false });
  assert.deepEqual(fotogrammaPerAspetto(315, 8), { indice: 7, specchio: false }); // la Nimitz
  const esiste = (/** @type {string} */ n) => /^FOREST[0-4]$/.test(n);
  // il server manda la figura già scelta (famiglia + indice) e il segno dell'aspetto dice il lato
  assert.deepEqual(figuraPer('FOREST2', -80, esiste), { nome: 'FOREST2', specchio: true });
  assert.deepEqual(figuraPer('FOREST2', 85, esiste), { nome: 'FOREST2', specchio: false });
  // o solo la famiglia, e la figura la sceglie l'aspetto
  assert.deepEqual(figuraPer('forest', 170, esiste), { nome: 'FOREST4', specchio: false });
  assert.equal(figuraPer('KARA', 90, esiste), null);
});

test('scala: la testa d\'albero all\'angolo misurato, mai sotto l\'altezza minima né oltre la massima', () => {
  const campo = 8, righe = 52;
  // 1° di elevazione a 6x: 21 pixel di altezza
  assert.ok(Math.abs(scalaFigura(1, campo, righe) * righe - 21) < 1e-9);
  assert.ok(Math.abs(scalaFigura(0.01, campo, righe) * righe - ALTEZZA_MINIMA) < 1e-9);
  assert.ok(scalaFigura(10, campo, righe) <= 1.6);
  const r = rettangoloFigura(92.5, 90, 188, 52, 0.5);
  assert.deepEqual(r, { x1: 46, y1: 65, x2: 139, y2: 90, w: 94, h: 26 });
});

test('figura disegnata e specchiata, col trasparente saltato', () => {
  // 3×2: riga 0 = [1, 2, T], riga 1 = [3, 4, 5]
  const img = { larghezza: 3, altezza: 2, indici: Uint8Array.from([1, 2, 99, 3, 4, 5]) };
  const t = new Tela();
  disegnaFigura(t, img, 51.5, 11, 1, false, 99);
  assert.deepEqual([t.leggi(50, 10), t.leggi(51, 10), t.leggi(52, 10)], [1, 2, 0]);
  assert.deepEqual([t.leggi(50, 11), t.leggi(51, 11), t.leggi(52, 11)], [3, 4, 5]);
  const s = new Tela();
  disegnaFigura(s, img, 51.5, 11, 1, true, 99);
  assert.deepEqual([s.leggi(50, 10), s.leggi(51, 10), s.leggi(52, 10)], [0, 2, 1]);
  assert.deepEqual([s.leggi(50, 11), s.leggi(51, 11), s.leggi(52, 11)], [5, 4, 3]);
});

test('stadimetro: distanza = altezza / tan(angolo), e con l\'errore dell\'osservatore (σ 3,5 %) cade nel ±7 %', () => {
  assert.ok(Math.abs(distanzaStadimetro(30, elevazioneAlbero(30, 9000)) - 9000) < 1e-6);
  assert.equal(distanzaStadimetro(30, 0), Infinity);
  // due sigma di errore sull'angolo: la distanza sbaglia di circa il 7 % (piccoli angoli)
  const e = elevazioneAlbero(30, 9000);
  assert.ok(Math.abs(distanzaStadimetro(30, e * 1.07) / 9000 - 1 / 1.07) < 1e-3);
  // la classe sbagliata: l'errore è il rapporto delle altezze (30 m contro 25 m)
  assert.ok(Math.abs(distanzaStadimetro(25, e) / 9000 - 25 / 30) < 1e-3);
});

test('costa all\'orizzonte: un\'isola alta davanti si vede, alle spalle no, il mare aperto è vuoto', () => {
  // un'isola di 300 m di quota a 10 km a nord
  const isola = (/** @type {number} */ x, /** @type {number} */ y) => (Math.hypot(x, y - 10000) < 2000 ? -300 : 100);
  const avanti = profiloCosta(isola, { x: 0, y: 0 }, 0, 32);
  const altezza = avanti[84];
  // 300 m a 8-10 km: poco meno di 2°, a 1,5x circa 10 pixel
  assert.ok(altezza >= 8 && altezza <= 12, String(altezza));
  assert.ok(avanti[0] === 0 && avanti[167] === 0);
  assert.ok(profiloCosta(isola, { x: 0, y: 0 }, 180, 32).every((h) => h === 0));
  assert.ok(profiloCosta(() => 200, { x: 0, y: 0 }, 0, 32).every((h) => h === 0));
});

test('ESM: le spie salgono di una ogni 6 dB, da zero a dieci', () => {
  assert.equal(spieEsm(null), 0);
  assert.equal(spieEsm(-5), 0);
  assert.equal(spieEsm(0), 1);
  assert.equal(spieEsm(30), 6);
  assert.equal(spieEsm(45), 8);
  assert.equal(spieEsm(200), 10);
});

/**
 * PNG RGBA di prova (2×2, filtro Sub sulla seconda riga).
 */
function pngRgba() {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (/** @type {Buffer} */ b) => { let r = 0xffffffff; for (const x of b) r = crcT[(r ^ x) & 0xff] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const pezzo = (/** @type {string} */ t, /** @type {Buffer} */ d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(2, 0); ih.writeUInt32BE(2, 4); ih[8] = 8; ih[9] = 6;
  // riga 0 senza filtro: grigio 16 opaco, trasparente; riga 1 Sub: nero opaco, poi +16 (grigio 16)
  const grezzi = Buffer.from([0, 16, 16, 16, 255, 0, 0, 0, 0, 1, 0, 0, 0, 255, 16, 16, 16, 0]);
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pezzo('IHDR', ih),
    pezzo('IDAT', zlib.deflateSync(grezzi)), pezzo('IEND', Buffer.alloc(0))]));
}

test('sagome RGBA: decodifica (con i filtri a 4 byte per pixel) e ritorno agli indici della palette', async () => {
  const img = await decodificaPngRgba(pngRgba());
  assert.deepEqual([...img.rgba], [16, 16, 16, 255, 0, 0, 0, 0, 0, 0, 0, 255, 16, 16, 16, 255]);
  const palette = Array.from({ length: 256 }, (_, i) => (i >= 0x90 && i < 0xa0 ? [(i - 0x90) * 16, (i - 0x90) * 16, (i - 0x90) * 16] : [255, 0, 255]));
  const idx = rgbaInIndici(img, palette, 0x90, 0x9e, 0x9f);
  assert.deepEqual([...idx.indici], [0x91, 0x9f, 0x90, 0x91]);
});

// ------------------------------------------------------------------------------ con gli asset

test('Periscopio composto: DOWN/UP, gradi, spie dell\'ESM, cielo e sagoma nella vista (032, 033, 041)', { skip: !CI_SONO_ORIGINALI && MOTIVO_SALTO }, async () => {
  const { caricaOriginali, caricaSagome, SAGOMA_TRASPARENTE } = await importa('resa/risorse.js');
  const { Regia } = await importa('regia.js');
  const orig = await caricaOriginali(lettoreDisco);
  assert.ok(await caricaSagome(orig, lettoreDisco, ['FOREST']) >= 5);
  const r = new Regia({ orig });
  r.ricevi({ t: 'partita', id: 'p', scenario: 'torpex_palestra', ora: 0, passo: 0.1, scala_tempo: 1, in_pausa: false,
    tempo_modificabile: true, origine: { lat: 61.75, lon: -6.8333333 }, area: { x0: -1e5, y0: -1e5, x1: 1e5, y1: 1e5 },
    battello: { piattaforma: '688', nome: 'Los Angeles', sigla: 'SSN-688' } });
  const stato = { t: 'stato', ora: 50, x: 0, y: 0, z: 18, rotta: 320, velocita: 3, velocita_verticale: 0, macchina: '1/3',
    timone: 0, timoni_o: 0, rotta_ordinata: null, quota_ordinata: 18, modo_quota: 'automatica',
    autopilota: { attivo: false, waypoint: [], prossimo: null }, cavitazione: false, v_cavitazione: 8,
    towed: null, fondale: 100, profondita_acqua: 118, strato: null, avvisi: [],
    alberi: { periscopio: false, esm: true, radar: false }, radar_attivo: false, ascolto_attivo: 0, assistenza: 2, analizzatore: null, designato: null };
  r.vaiA('periscopio');
  r.ricevi(stato);
  r.ricevi({ t: 'esm', ora: 50, emissioni: [{ rilevamento: 300, tipo: 'AN/SPS-40', banda: 'B', livello: 45 }] });
  r.componi(1);
  // abbassato: la mappa nella finestra, DOWN nel riquadro del periscopio, UP in quello dell'antenna
  const t = r.tela;
  const ciano = (/** @type {number} */ x1, /** @type {number} */ x2) => { let n = 0; for (let y = 78; y < 84; y++) for (let x = x1; x < x2; x++) if (t.leggi(x, y) === 11) n++; return n; };
  assert.ok(ciano(208, 232) > ciano(268, 292), 'DOWN è più largo di UP');
  // otto spie accese (45 dB): la settima gialla, la nona spenta
  assert.equal(t.leggi(209 + 9 * 6, 43), 14);
  assert.equal(t.leggi(209 + 9 * 8, 43), 8);
  // alzato, con un cacciatorpediniere di fianco a 1° di elevazione per 320
  r.ricevi({ ...stato, ora: 51, alberi: { periscopio: true, esm: true, radar: false } });
  r.ricevi({ t: 'visivo', ora: 51, oggetti: [{ vista: 1, rilevamento: 320, aspetto: 90, sagoma: 'FOREST2', elevazione_alberi: 1,
    luci: null, sotto_orizzonte: false, scia: false }] });
  r.ui.peri.ingrandimento = 1;
  r.ui.hud = false;
  r.componi(2);
  assert.equal(t.leggi(40, 60), CIELO[32]);
  assert.equal(t.leggi(20, 110), MARE[20]);
  // la sagoma al centro del reticolo, la linea d'acqua sull'orizzonte: pixel della figura (grigi 144-158)
  let grigi = 0;
  for (let y = 69; y <= 90; y++) for (let x = 60; x <= 125; x++) { const c = t.leggi(x, y); if (c >= 0x90 && c < SAGOMA_TRASPARENTE) grigi++; }
  assert.ok(grigi > 200, `${grigi} pixel della sagoma`);
  // di giorno la palette resta DAY
  assert.equal(r.palette, 'giorno');
  r.ricevi({ t: 'visivo', ora: 52, oggetti: [{ vista: 1, rilevamento: 320, aspetto: 90, sagoma: 'FOREST2', elevazione_alberi: 1,
    luci: ['testa_d_albero', 'fianco_dritta'], sotto_orizzonte: false, scia: false }] });
  assert.equal(r.palette, 'notte');
});
