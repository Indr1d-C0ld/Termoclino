// Prove delle stazioni di F2 composte con la grafica originale (come le compone il browser, regia.js):
// l'analizzatore del Sonar con le 16 barre, TRGT PULSE e il ping, la vista TMA nella Navigation Board, la
// navigazione da tastiera fra le zone nuove (lettere che portano il cursore, Tab fra i gruppi, Invio che
// esegue) e gli ordini v2 che ne escono, validati con shared/protocol.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importa, lettoreDisco, CI_SONO_ORIGINALI, MOTIVO_SALTO } from './ambiente_client.mjs';

const salta = { skip: !CI_SONO_ORIGINALI && MOTIVO_SALTO };
const { codificaByte, SPETTRO, validaOrdine } = await import('../../shared/protocol.js');

/** Una regia con la partita e gli ordini raccolti (validati come farebbe il server). */
async function nuovaRegia() {
  const { caricaOriginali } = await importa('resa/risorse.js');
  const { Regia } = await importa('regia.js');
  const orig = await caricaOriginali(lettoreDisco);
  /** @type {{ cosa: string, valore: unknown }[]} */
  const ordini = [];
  const r = new Regia({ orig, ordina: (cosa, valore, n) => {
    const e = validaOrdine({ cosa, valore, n });
    assert.ok(e.ok, `ordine non valido: ${cosa} ${JSON.stringify(valore)}`);
    ordini.push({ cosa, valore });
  } });
  r.ricevi({ t: 'partita', id: 'p', scenario: 'torpex_palestra', ora: 0, passo: 0.1, scala_tempo: 1, in_pausa: false,
    tempo_modificabile: true, origine: { lat: 61.75, lon: -6.8333333 }, area: { x0: -1e5, y0: -1e5, x1: 1e5, y1: 1e5 },
    battello: { piattaforma: '688', nome: 'Los Angeles', sigla: 'SSN-688' } });
  return { r, ordini };
}

/** @param {Record<string, unknown>} campi */
function stato(campi = {}) {
  return { t: 'stato', ora: 100, x: 0, y: 0, z: 60, rotta: 0, velocita: 5, velocita_verticale: 0, macchina: '1/3',
    timone: 0, timoni_o: 0, rotta_ordinata: 0, quota_ordinata: 60, modo_quota: 'automatica',
    autopilota: { attivo: false, waypoint: [], prossimo: null }, cavitazione: false, v_cavitazione: 12,
    towed: { stato: 'filata', filato_m: 803, quota: 90, tempo_morto: 0, sorda: false },
    fondale: 200, profondita_acqua: 260, strato: 40, avvisi: [], alberi: { periscopio: false, esm: false, radar: false },
    radar_attivo: false, ascolto_attivo: 0, assistenza: 2, analizzatore: null, designato: null, ...campi };
}

/** Porta il cursore con un tasto e preme Invio, come al tavolo del 1989. @param {any} r @param {string} k */
function premi(r, k) {
  r.lettera(k);
  r.esegui();
}

test('Sonar: G designa la traccia, 3 + Invio accende l\'analizzatore su di lei; LOFAR e 16 barre', salta, async () => {
  const { r, ordini } = await nuovaRegia();
  r.vaiA('sonar');
  r.ricevi(stato());
  r.ricevi({ t: 'tracce', ora: 100, tracce: [{ contatto: 'S1', sensori: ['towed'], rilevamento: 30, variazione: 0.2, classe: null, confidenza: null, stato: 'nuova' }] });
  premi(r, 'g');
  assert.deepEqual(ordini.at(-1), { cosa: 'designa', valore: 'S1' });
  premi(r, '3');
  assert.deepEqual(ordini.at(-1), { cosa: 'analizzatore', valore: { contatto: 'S1' } });
  assert.equal(r.ui.analisi.aperta, true);
  // il server conferma e manda le righe: una riga a 60 Hz e una pala nel DEMON
  r.ricevi(stato({ ora: 104, designato: 'S1', analizzatore: { sensore: 'towed', rilevamento: 30, contatto: 'S1' } }));
  const f = SPETTRO.towed;
  const righe = new Uint8Array(f.RIGHE).fill(40); righe[60] = 160;
  const demon = new Uint8Array(f.DEMON_RIGHE).fill(40); demon[73] = 150;
  for (let ora = 104; ora <= 120; ora += 4) {
    r.ricevi({ t: 'spettro', ora, sensore: 'towed', rilevamento: 30, contatto: 'S1', da_hz: 0, passo_hz: 1, righe: codificaByte(righe),
      demon_da_hz: 0, demon_passo_hz: 0.1, demon: codificaByte(demon), asse: 0, sorda: false });
  }
  r.ricevi(stato({ ora: 121, designato: 'S1', analizzatore: { sensore: 'towed', rilevamento: 30, contatto: 'S1' } }));
  r.componi(10); // passato il ritratto del sonarista
  r.componi(10.1);
  const t = r.tela;
  // la riga dei 60 Hz bianca nella prima riga del LOFAR (0-1024 Hz su 168 colonne: colonna 9-10)
  const x60 = 8 + Math.floor((60.5 * 168) / 1024);
  assert.ok([t.leggi(x60, 41), t.leggi(x60 + 1, 41)].includes(15));
  // cinque righe dell'analizzatore, poi nero
  assert.notEqual(t.leggi(30, 45), 0);
  assert.equal(t.leggi(30, 47), 0);
  // le 16 barre: magenta, e il cappello rosso sulla barra della riga dei 60 Hz
  let rossi = 0;
  for (let x = 204; x <= 297; x++) for (let y = 30; y <= 47; y++) if (t.leggi(x, y) === 12) rossi++;
  assert.equal(rossi, 4);
  // I stringe l'asse delle frequenze (il pulsante I della pulsantiera, non la mappa)
  const zoom = r.ui.zoom;
  premi(r, 'i');
  assert.equal(r.ui.analisi.zoom, 1);
  assert.equal(r.ui.zoom, zoom);
  // di nuovo 3 + Invio: spento
  premi(r, '3');
  assert.deepEqual(ordini.at(-1), { cosa: 'analizzatore', valore: null });
});

test('Sonar: TRGT PULSE pinga il bersaglio nel settore di prua, se no tutto il settore; giallo mentre ascolta', salta, async () => {
  const { r, ordini } = await nuovaRegia();
  r.vaiA('sonar');
  r.ricevi(stato({ rotta: 0 }));
  r.ui.bersaglio = { rilevamento: 40, visto: 100, perso: false };
  const i = r.hotspot().findIndex((/** @type {any} */ h) => h.tasto === 201);
  r.ui.fuoco = i;
  r.esegui();
  assert.deepEqual(ordini.at(-1), { cosa: 'attivo', valore: { rilevamento: 40, portata: 'lunga' } });
  r.ui.bersaglio = { rilevamento: 120, visto: 100, perso: false };
  r.esegui();
  assert.deepEqual(ordini.at(-1), { cosa: 'attivo', valore: { rilevamento: null, portata: 'lunga' } });
  // durante l'ascolto non parte niente e la scritta è gialla
  r.ricevi(stato({ ora: 101, ascolto_attivo: 30 }));
  const n = ordini.length;
  r.esegui();
  assert.equal(ordini.length, n);
  r.componi(2);
  let gialli = 0;
  for (let x = 152; x <= 212; x++) for (let y = 155; y <= 163; y++) if (r.tela.leggi(x, y) === 14) gialli++;
  assert.ok(gialli > 20);
  // l'eco: distanza nella barra del bersaglio (in miglia, «.4» sotto il miglio) e segno bianco sulla cascata
  r.ricevi({ t: 'eco', ora: 105, ping: 1, rilevamento: 120, distanza: 740.8, forza: 20, riverbero: 0 });
  r.ricevi(stato({ ora: 106 }));
  r.componi(3);
  assert.equal(r.tela.leggi(113, 15), 13); // la cifra «4» di «.4» in magenta, dove il 1989 scriveva RANGE
});

test('Navigation Board: T apre la vista TMA, A cambia pagina, N designa, il MATE manda la soluzione del comandante', salta, async () => {
  const { r, ordini } = await nuovaRegia();
  r.vaiA('navigazione');
  let x = 0;
  for (let ora = 0; ora <= 600; ora += 4) {
    x += 4 * 5 * 1852 / 3600;
    r.ricevi(stato({ ora, x, rotta: 90 }));
    r.ricevi({ t: 'tracce', ora, tracce: [
      { contatto: 'S1', sensori: ['sfera'], rilevamento: 10 + ora / 100, variazione: 0.6, classe: 'mercantile_generico', confidenza: 0.7, stato: 'tenuta' },
      { contatto: 'S2', sensori: ['towed'], rilevamento: 200, variazione: 0, classe: null, confidenza: null, stato: 'tenuta' },
    ] });
  }
  premi(r, 't');
  assert.equal(r.ui.tma.aperta, true);
  r.componi(1);
  // i punti tempo-rilevamento: bianchi nella finestra
  let punti = 0;
  for (let yy = 43; yy <= 104; yy++) for (let xx = 8; xx <= 175; xx++) if (r.tela.leggi(xx, yy) === 15) punti++;
  assert.ok(punti > 40, `${punti} punti`);
  premi(r, 'n');
  assert.deepEqual(ordini.at(-1), { cosa: 'designa', valore: 'S2' });
  premi(r, 'a');
  assert.equal(r.ui.tma.vista, 'mate');
  r.componi(2);
  premi(r, 'd'); // distanza: meno
  premi(r, 'e'); // INVIA
  const o = /** @type {any} */ (ordini.at(-1));
  assert.equal(o.cosa, 'soluzione');
  assert.equal(o.valore.contatto, 'S2');
  assert.ok(Math.abs(o.valore.distanza - 10000 / 1.1) < 300, String(o.valore.distanza));
  premi(r, 'z');
  assert.deepEqual(ordini.at(-1), { cosa: 'soluzione', valore: { contatto: 'S2', cancella: true } });
  // la pagina delle tracce: classificare e abbandonare
  premi(r, 'a');
  assert.equal(r.ui.tma.vista, 'elenco');
  r.componi(3);
  const hs = r.hotspot();
  r.ui.fuoco = hs.findIndex((/** @type {any} */ h) => h.tasto === 330); // CL della prima riga
  r.esegui();
  assert.deepEqual(ordini.at(-1), { cosa: 'classifica', valore: { contatto: 'S1', classe: '688' } });
  r.ui.fuoco = hs.findIndex((/** @type {any} */ h) => h.tasto === 361); // ABB della seconda
  r.esegui();
  assert.deepEqual(ordini.at(-1), { cosa: 'abbandona', valore: 'S2' });
  // T torna alla carta
  r.ui.fuoco = null;
  premi(r, 't');
  assert.equal(r.ui.tma.aperta, false);
});

test('Periscopio: U e N alzano gli alberi, D apre il libro, - e = lo sfogliano, Esc lo chiude', salta, async () => {
  const { r, ordini } = await nuovaRegia();
  r.biblioteca = [
    { id: 'forrest_sherman', nome: 'Forrest Sherman', tipo: 'superficie', righe: [], pale: 4, giriPerNodo: 10, albero: 30, sagoma: 'FOREST', radar: [] },
    { id: 'mercantile_generico', nome: 'Mercantile', tipo: 'superficie', righe: [], pale: 4, giriPerNodo: 9, albero: 25, sagoma: 'MERCH', radar: [] },
  ];
  r.vaiA('periscopio');
  r.ricevi(stato({ z: 18 }));
  premi(r, 'u');
  assert.deepEqual(ordini.at(-1), { cosa: 'albero', valore: { quale: 'periscopio', alzato: true } });
  premi(r, 'n');
  assert.deepEqual(ordini.at(-1), { cosa: 'albero', valore: { quale: 'esm', alzato: true } });
  r.ricevi(stato({ ora: 101, z: 18, alberi: { periscopio: true, esm: true, radar: false } }));
  r.ricevi({ t: 'visivo', ora: 101, oggetti: [{ vista: 4, rilevamento: 10, aspetto: 90, sagoma: 'FOREST2', elevazione_alberi: 0.2,
    luci: null, sotto_orizzonte: false, scia: false }] });
  premi(r, 'g');
  assert.equal(r.ui.peri.vista, 4);
  assert.equal(r.ui.peri.rotta, 10);
  premi(r, 'd');
  assert.equal(r.ui.peri.libro, true);
  premi(r, '=');
  assert.equal(r.ui.peri.classe, 1);
  premi(r, '-');
  premi(r, 'd');
  assert.equal(r.ui.peri.libro, false);
  const s = r.ui.peri.stadimetro;
  assert.ok(s && s.classe === 'forrest_sherman' && Math.abs(s.distanza - 30 / Math.tan((0.2 * Math.PI) / 180)) < 1e-6);
  // la barra del bersaglio: l'avvistamento con la classe e la distanza dello stadimetro (8592 m = 4.6 miglia)
  r.componi(4);
  assert.equal(r.tela.leggi(113, 13) === 13 || r.tela.leggi(114, 13) === 13 || r.tela.leggi(115, 13) === 13, true);
  // Esc chiude il libro senza toccare il resto
  premi(r, 'd');
  assert.equal(r.ui.peri.libro, true);
  r.esc();
  assert.equal(r.ui.peri.libro, false);
});

test('Aiuto: con F1 aperto le cifre 0-3 scelgono il livello d\'assistenza e lo ordinano', salta, async () => {
  const { r, ordini } = await nuovaRegia();
  /** @type {number[]} */
  const salvati = [];
  r.salvaAssistenza = (/** @type {number} */ l) => salvati.push(l);
  r.ricevi(stato());
  r.aiuto();
  r.lettera('1');
  assert.equal(r.ui.assistenza, 1);
  assert.deepEqual(ordini.at(-1), { cosa: 'assistenza', valore: 1 });
  assert.deepEqual(salvati, [1]);
  r.lettera('7');
  assert.equal(r.ui.assistenza, 1);
  r.componi(5);
  assert.equal(r.tela.leggi(30, 30), 15); // il riquadro bianco dell'aiuto
});
