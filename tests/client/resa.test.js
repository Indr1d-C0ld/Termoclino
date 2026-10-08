// Prove della resa Classic: barre e nastro (cornice.js), testo nel font del 1989, decodifica dei PNG
// indicizzati, spie della cavitazione, e — con gli asset originali — la composizione delle stazioni
// sulla tela indicizzata come la fa il browser (regia.js), confrontata con le misure delle catture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { importa, lettoreDisco, CI_SONO_ORIGINALI, MOTIVO_SALTO } from './ambiente_client.mjs';

const { formatoVelocita, gms, orologio, treCifre, Nastro, NASTRO } = await importa('resa/cornice.js');
const { perIlFont, inGrande, cifreGrandi } = await importa('resa/testo.js');
const { decodificaPngIndicizzato } = await importa('resa/png.js');
const { spieCavitazione, TELEGRAFO } = await importa('stazioni/governo.js');
const { fattoreIntero } = await importa('resa/schermo.js');
const { codificaSettori } = await import('../../shared/protocol.js');

test('numeri come li scriveva il gioco: velocità «.7», tre cifre, orologio, gradi:primi:secondi', () => {
  assert.equal(formatoVelocita(0), '0');
  assert.equal(formatoVelocita(0.72), '.7');
  assert.equal(formatoVelocita(33.84), '33.8');
  assert.equal(formatoVelocita(-6), '6.0');
  assert.equal(treCifre(-5), '355');
  assert.equal(treCifre(359.6), '000');
  assert.equal(orologio(3725.9), '01:02:05');
  assert.deepEqual(gms(61.75, 'lat'), { testo: '61:45:00', emisfero: 'N' });
  assert.deepEqual(gms(-6.8333333, 'lon'), { testo: '06:50:00', emisfero: 'W' });
});

test('testo: maiuscole del font, accenti come sulle telescriventi, lettere grandi nel nastro', () => {
  assert.equal(perIlFont("Profondità è 50 m"), "PROFONDITA' E' 50 M");
  assert.equal(perIlFont('mail@x'), 'MAIL X');
  assert.equal(inGrande('S1 PER 045'), 's1 per 045');
  assert.equal(cifreGrandi('01:2'), '\u0087\u0088%\u0089');
});

test('nastro: entra da destra, si ferma a sinistra, lascia il posto al successivo', () => {
  const n = new Nastro();
  n.aggiungi('PRIMO');
  n.aggiungi('PRIMO'); // doppione di fila: ignorato
  n.aggiungi('SECONDO');
  n.avanza(0.01);
  assert.equal(n.testo, 'primo');
  assert.ok(n.x > NASTRO.x1 + 2);
  for (let i = 0; i < 10; i++) n.avanza(0.5);
  assert.equal(n.x, NASTRO.x1 + 2);
  for (let i = 0; i < 6; i++) n.avanza(0.5);
  assert.equal(n.testo, 'secondo');
});

test('cavitazione: sei spie fino alla velocità d\'innesco, poi gialle e rosse cavitando', () => {
  assert.equal(spieCavitazione(0, 8, false), 0);
  assert.equal(spieCavitazione(4, 8, false), 3);
  assert.equal(spieCavitazione(7.9, 8, false), 5);
  assert.equal(spieCavitazione(9, 8, true), 7);
  assert.equal(spieCavitazione(20, 8, true), 10);
  assert.equal(spieCavitazione(-6, 8, false), 4); // indietro conta la velocità assoluta
});

test('schermo: fattore intero di pixel del dispositivo, anche con devicePixelRatio frazionario', () => {
  assert.equal(fattoreIntero(1280, 900, 1), 4);
  assert.equal(fattoreIntero(1000, 900, 1), 3);
  assert.equal(fattoreIntero(1000, 700, 1.25), 3); // 1250×875 pixel veri: 3,9 → 3
  assert.equal(fattoreIntero(1100, 700, 1.25), 4); // 1375×875: 4 interi
  assert.equal(fattoreIntero(100, 100, 1), 1);
});

/**
 * PNG a palette di prova, scritto a mano (IHDR, PLTE, IDAT con i filtri dati).
 * @param {number} w @param {number} h @param {number} profondita @param {number[][]} righe byte già impaccati @param {number[]} filtri
 */
function png(w, h, profondita, righe, filtri) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (/** @type {Buffer} */ b) => { let r = 0xffffffff; for (const x of b) r = crcT[(r ^ x) & 0xff] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const pezzo = (/** @type {string} */ t, /** @type {Buffer} */ d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = profondita; ih[9] = 3;
  const grezzi = Buffer.from(righe.flatMap((r, i) => [filtri[i], ...r]));
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pezzo('IHDR', ih),
    pezzo('PLTE', Buffer.alloc(48)), pezzo('IDAT', zlib.deflateSync(grezzi)), pezzo('IEND', Buffer.alloc(0))]));
}

test('PNG a palette: indici così come sono, con i filtri Sub e Up e a 4 bit', async () => {
  // 8 bit: riga 0 senza filtro, riga 1 con Up (+ riga sopra), riga 2 con Sub (+ pixel a sinistra)
  const a = await decodificaPngIndicizzato(png(3, 3, 8, [[1, 2, 3], [1, 1, 1], [5, 1, 1]], [0, 2, 1]));
  assert.deepEqual([...a.indici], [1, 2, 3, 2, 3, 4, 5, 6, 7]);
  // 4 bit: due pixel per byte, nibble alto a sinistra, larghezza dispari
  const b = await decodificaPngIndicizzato(png(3, 1, 4, [[0x12, 0x30]], [0]));
  assert.deepEqual([...b.indici], [1, 2, 3]);
});

// ------------------------------------------------------------------------------ con gli asset

/** @type {any} */
let regiaPronta = null;
async function regia() {
  if (regiaPronta) return regiaPronta;
  const { caricaOriginali } = await importa('resa/risorse.js');
  const { Regia } = await importa('regia.js');
  const orig = await caricaOriginali(lettoreDisco);
  const r = new Regia({ orig });
  r.ricevi({ t: 'partita', id: 'p', scenario: 'torpex_palestra', ora: 0, passo: 0.1, scala_tempo: 1, in_pausa: false,
    tempo_modificabile: true, origine: { lat: 61.75, lon: -6.8333333 }, area: { x0: -1e5, y0: -1e5, x1: 1e5, y1: 1e5 },
    battello: { piattaforma: '688', nome: 'Los Angeles', sigla: 'SSN-688' } });
  regiaPronta = { r, orig };
  return regiaPronta;
}

/** @param {Record<string, unknown>} campi */
function stato(campi) {
  return { t: 'stato', ora: 118, x: 0, y: 0, z: 6.1, rotta: 320, velocita: 0, velocita_verticale: 0, macchina: 'stop',
    timone: 0, timoni_o: 0, rotta_ordinata: null, quota_ordinata: null, modo_quota: 'manuale',
    autopilota: { attivo: false, waypoint: [], prossimo: null }, cavitazione: false, v_cavitazione: 8,
    towed: { stato: 'stivata', filato_m: 0, quota: null, tempo_morto: 0, sorda: false },
    fondale: 290, profondita_acqua: 296, strato: 21, avvisi: [], ...campi };
}

test('Ship\'s Control composto: palla del telegrafo, manopola del timone, leva, spie, autopilota', { skip: !CI_SONO_ORIGINALI && MOTIVO_SALTO }, async () => {
  const { r } = await regia();
  r.vaiA('governo');
  r.ricevi(stato({ macchina: 'flank', timone: 15, timoni_o: 20, velocita: 24.4, cavitazione: true, v_cavitazione: 20 }));
  r.componi(1);
  const t = r.tela, retro = r.pannello.retro;
  // la palla a FLANK è lo sprite del retro (34..46, 97..107), nero trasparente, in (252, 156)
  const f = TELEGRAFO[145];
  for (let y = 97; y <= 107; y++) {
    for (let x = 34; x <= 46; x++) {
      const c = retro[y * 320 + x];
      if (c) assert.equal(t.leggi(f.x + x - 34, f.y + y - 97), c);
    }
  }
  // e non c'è più a STOP: lì torna il pannello (la spia rossa dello STOP)
  assert.equal(t.leggi(170, 142), r.pannello.indici[142 * 320 + 170]);
  // timone 15 a dritta: la manopola sopra la zona 136 (x1 125) → x 128
  assert.equal(t.leggi(128, 146), retro[78 * 320 + 30]);
  // timoni a scendere tutta: la maniglia in fondo alla fessura (righe 118-122, come in 014)
  assert.equal(t.leggi(195, 120), retro[107 * 320 + 65]);
  // velocità «24.4» come in 015: il punto è un pixel giallo in (98, 126), la cifra decimale da x 99
  assert.equal(t.leggi(98, 126), 14);
  assert.equal(t.leggi(99, 124), 11);
  // cavitazione: 4,4 nodi oltre l'innesco → 7 + 2 = 9 spie, la nona rossa, la decima spenta
  assert.equal(t.leggi(201 + 11 * 6, 41), 14);
  assert.equal(t.leggi(201 + 11 * 8, 41), 12);
  assert.equal(t.leggi(201 + 11 * 9, 41), 7);
});

test('Navigation Board composto: ON/OFF del gioco, cifre della proiezione, mappa col battello al centro', { skip: !CI_SONO_ORIGINALI && MOTIVO_SALTO }, async () => {
  const { r } = await regia();
  r.vaiA('navigazione');
  r.fondale = (/** @type {number} */ x) => (x < -2000 ? -5 : 150);
  r.cache.clear();
  r.ui.plot.proiezione = true;
  r.ui.plot.minuti = 10;
  r.ricevi(stato({}));
  r.componi(2);
  const t = r.tela;
  // battello: quadratino verde in (92, 74)
  assert.equal(t.leggi(92, 74), 10);
  assert.equal(t.leggi(90, 72), 2);
  // terra a ovest (x < -2 km = 13 px a 160 m/px), acqua a est
  assert.equal(t.leggi(60, 100), 191);
  assert.equal(t.leggi(140, 100), 191 + 4 * 8);
  // cifre della proiezione: «1» e «0» bianchi nelle caselle DIGITBOX (250,113) e (261,113)
  const bianchi = (/** @type {number} */ x0) => { let n = 0; for (let y = 115; y < 122; y++) for (let x = x0; x < x0 + 9; x++) if (t.leggi(x, y) === 15) n++; return n; };
  assert.ok(bianchi(251) > 4 && bianchi(262) > 8);
  // PLOT PROJ acceso: « ON» in ciano nel terzo riquadro
  let ciano = 0;
  for (let y = 85; y < 92; y++) for (let x = 199; x < 225; x++) if (t.leggi(x, y) === 11) ciano++;
  assert.ok(ciano > 10);
  // striscia: «320*» in ciano da x 29
  assert.equal(t.leggi(29, 122), 11);
});

test('Sonar composto: la cascata nella finestra, la prua al centro, i baffles grigi', { skip: !CI_SONO_ORIGINALI && MOTIVO_SALTO }, async () => {
  const { r } = await regia();
  r.vaiA('sonar');
  r.ui.cascataSuSonar = true;
  r.ricevi(stato({ rotta: 0 }));
  const s = new Uint8Array(180).fill(40);
  s[0] = 250; // dritto di prua
  for (let ora = 1; ora <= 5; ora++) {
    r.ricevi({ t: 'sonar', ora, sensore: 'sfera', settori: codificaSettori(s), ciechi: [[150, 210]] });
  }
  r.componi(3);
  const t = r.tela;
  assert.equal(t.leggi(92, 43), 15); // seconda riga, colonna della prua (la prima ha il puntino della prua)
  assert.ok(t.leggi(9, 43) >= 145 && t.leggi(9, 43) <= 150); // 192° relativi: nei baffles
  // le zone in più della testata ci sono: sensore, portata del ping, riferimento, corpo della cascata
  assert.equal(r.hotspot().length, r.pannello.hotspot.length + 4);
});

test('CONN: il nome della stazione sotto il puntatore, e Invio ci porta', { skip: !CI_SONO_ORIGINALI && MOTIVO_SALTO }, async () => {
  const { r } = await regia();
  r.vaiA('conn');
  r.lettera('n');
  r.componi(4);
  // il riquadro bianco in basso
  assert.equal(r.tela.leggi(160, 184), 15);
  r.esegui();
  assert.equal(r.ui.stazione, 'navigazione');
  r.esc();
});
