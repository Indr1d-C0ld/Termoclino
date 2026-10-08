// Prove del riduttore dello stato del client (web/assets/js/client/stato.js) sui messaggi del
// protocollo v1 (docs/PROTOCOLLO.md): pure, senza DOM e senza asset originali.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importa } from './ambiente_client.mjs';

const { statoIniziale, riduci, mascheraCiechi, TRACCIA_PASSO_S } = await importa('stato.js');
const { codificaSettori } = await import('../../shared/protocol.js');

/** @param {any} s @param {any[]} messaggi */
const tutti = (s, messaggi) => messaggi.reduce((a, m) => riduci(a, m), s);

const PARTITA = {
  t: 'partita', id: 'p1', scenario: 'torpex_palestra', ora: 0, passo: 0.1, scala_tempo: 1, in_pausa: false,
  tempo_modificabile: true, origine: { lat: 61.75, lon: -6.83 }, area: { x0: -1e5, y0: -1e5, x1: 1e5, y1: 1e5 },
  battello: { piattaforma: '688', nome: 'Dallas', sigla: 'SSN-700' },
};

/** @param {Partial<Record<string, unknown>>} campi */
function stato(campi = {}) {
  return {
    t: 'stato', ora: 10, x: 100, y: 200, z: 45.7, rotta: 270, velocita: 8.5, velocita_verticale: 0, assetto: 0, giri: 50,
    macchina: '1/3', timone: 0, timoni_o: 0, rotta_ordinata: null, quota_ordinata: 45.7, modo_quota: 'automatica',
    autopilota: { attivo: true, waypoint: [[1000, 2000], [3000, 4000]], prossimo: 1 },
    cavitazione: false, v_cavitazione: 9.1,
    towed: { stato: 'filata', filato_m: 803, quota: 80, tempo_morto: 0, sorda: false },
    fondale: 150, profondita_acqua: 195.7, strato: 21, avvisi: [], danni: { urti_fondale: 0, oltre_collaudo: false, collasso: false },
    ...campi,
  };
}

test('partita e stato: i campi del protocollo v1 arrivano nello stato del client', () => {
  const s = tutti(statoIniziale(), [PARTITA, stato()]);
  assert.equal(s.partita.battello.sigla, 'SSN-700');
  assert.equal(s.partita.tempo_modificabile, true);
  assert.equal(s.nave.macchina, '1/3');
  assert.equal(s.nave.profondita_acqua, 195.7);
  assert.deepEqual(s.nave.autopilota.waypoint, [{ x: 1000, y: 2000 }, { x: 3000, y: 4000 }]);
  assert.equal(s.nave.towed.stato, 'filata');
  // lo specchio degli ordini segue il server
  assert.deepEqual(s.ordinati, { autopilota: true, waypoint: [{ x: 1000, y: 2000 }, { x: 3000, y: 4000 }], designato: null, classifiche: {} });
});

test('partita: una partita nuova azzera cascata e traccia, la stessa no', () => {
  let s = tutti(statoIniziale(), [PARTITA, stato()]);
  s = riduci(s, { t: 'sonar', ora: 10, sensore: 'sfera', settori: codificaSettori(new Uint8Array(180)), ciechi: [] });
  assert.equal(s.sonar.length, 1);
  assert.equal(riduci(s, PARTITA).sonar.length, 1);
  assert.equal(riduci(s, { ...PARTITA, id: 'p2' }).sonar.length, 0);
  assert.equal(riduci(s, { ...PARTITA, id: 'p2' }).nave, null);
});

test('tempo: scala e pausa cambiano, il resto della partita resta', () => {
  const s = tutti(statoIniziale(), [PARTITA, { t: 'tempo', ora: 50, scala_tempo: 1, in_pausa: false, tempo_modificabile: false }]);
  assert.equal(s.partita.tempo_modificabile, false);
  assert.equal(s.partita.id, 'p1');
});

test('sonar: i due sensori dello stesso secondo diventano un fotogramma solo, in rilevamenti veri', () => {
  const sfera = new Uint8Array(180);
  sfera[22] = 200; // 44°-46° veri
  const towed = new Uint8Array(180);
  towed[10] = 150;
  let s = tutti(statoIniziale(), [PARTITA, stato({ rotta: 90 })]);
  s = riduci(s, { t: 'sonar', ora: 11, sensore: 'sfera', settori: codificaSettori(sfera), ciechi: [[240, 300]] });
  s = riduci(s, { t: 'sonar', ora: 11, sensore: 'towed', settori: codificaSettori(towed), ciechi: [[70, 110]], asse: 90, sorda: false });
  s = riduci(s, { t: 'sonar', ora: 12, sensore: 'sfera', settori: codificaSettori(sfera), ciechi: [] });
  assert.equal(s.sonar.length, 2);
  const [nuovo, vecchio] = s.sonar;
  assert.equal(nuovo.ora, 12);
  assert.equal(vecchio.ora, 11);
  assert.equal(vecchio.rotta, 90);
  assert.equal(vecchio.sfera.settori[22], 200);
  assert.equal(vecchio.towed.settori[10], 150);
  assert.equal(vecchio.towed.asse, 90);
  assert.equal(vecchio.sfera.ciechi[135], 1); // 270° è nei baffles [240, 300]
  assert.equal(vecchio.sfera.ciechi[22], 0);
});

test('sonar: un fotogramma malformato si ignora', () => {
  const s0 = riduci(statoIniziale(), PARTITA);
  assert.equal(riduci(s0, { t: 'sonar', ora: 1, sensore: 'sfera', settori: 'non base64!', ciechi: [] }), s0);
  assert.equal(riduci(s0, { t: 'sonar', ora: 1, sensore: 'boh', settori: codificaSettori(new Uint8Array(180)) }), s0);
});

test('mascheraCiechi: archi in senso orario, anche a cavallo dello zero, e il cerchio intero', () => {
  const m = mascheraCiechi([[350, 10]]);
  assert.equal(m[0], 1); // centro 1°
  assert.equal(m[175], 1); // centro 351°
  assert.equal(m[5], 0);
  assert.equal(mascheraCiechi([[0, 360]]).every((v) => v === 1), true);
  assert.equal(mascheraCiechi(null).every((v) => v === 0), true);
});

test('rapporti e messaggi locali: numerati in ordine, con chi parla', () => {
  let s = riduci(statoIniziale(), { t: 'rapporto', ora: 5, chi: 'sonar', chiave: 'sonar.nuovo_contatto', parametri: { contatto: 'S1', rilevamento: 45 } });
  s = riduci(s, { t: 'locale', chiave: 'locale.zoom_massimo', parametri: {} });
  assert.deepEqual(s.rapporti.map((r) => [r.id, r.chiave, r.chi]), [[1, 'sonar.nuovo_contatto', 'sonar'], [2, 'locale.zoom_massimo', '']]);
});

test('ordini: in viaggio fino a ricevuto o errore, con lo specchio di autopilota e waypoint', () => {
  let s = riduci(statoIniziale(), PARTITA);
  s = riduci(s, { t: 'ordine', cosa: 'waypoint', valore: { azione: 'aggiungi', x: 10, y: 20 }, n: 1 });
  s = riduci(s, { t: 'ordine', cosa: 'autopilota', valore: true, n: 2 });
  assert.deepEqual(s.ordinati, { autopilota: true, waypoint: [{ x: 10, y: 20 }], designato: null, classifiche: {} });
  assert.deepEqual(s.inViaggio.map((o) => o.n), [1, 2]);
  assert.equal(s.prossimoOrdine, 3);
  s = riduci(s, { t: 'ricevuto', n: 1, cosa: 'waypoint', valore: { azione: 'aggiungi', x: 10, y: 20 } });
  s = riduci(s, { t: 'errore', codice: 'ordine_rifiutato', n: 2, cosa: 'autopilota', motivo: 'nessun_waypoint' });
  assert.deepEqual(s.inViaggio, []);
  assert.equal(s.errore, 'ordine_rifiutato');
  // il timone a mano spegne l'autopilota (come fa il server)
  s = riduci(s, { t: 'ordine', cosa: 'timone', valore: -10, n: 3 });
  assert.equal(s.ordinati.autopilota, false);
  s = riduci(s, { t: 'ordine', cosa: 'waypoint', valore: { azione: 'togli', indice: 0 }, n: 4 });
  assert.deepEqual(s.ordinati.waypoint, []);
});

test('traccia: un punto ogni 10 s di gioco, e si riparte se il tempo torna indietro', () => {
  let s = riduci(statoIniziale(), PARTITA);
  for (let t = 0; t <= 60; t += 0.25) s = riduci(s, stato({ ora: t, x: t * 5 }));
  assert.equal(s.traccia.length, 60 / TRACCIA_PASSO_S + 1);
  s = riduci(s, stato({ ora: 1 }));
  assert.equal(s.traccia.length, 1);
});

test('uscita: il battello non è più nostro', () => {
  const s = tutti(statoIniziale(), [PARTITA, stato(), { t: 'uscita', motivo: 'altra_connessione' }]);
  assert.equal(s.nave, null);
  assert.equal(s.uscita, 'altra_connessione');
  assert.deepEqual([s.traccia.length, s.sonar.length], [0, 0]);
});

test('nebbia di guerra: lo stato del client non ha posti per altri battelli', () => {
  const s = tutti(statoIniziale(), [PARTITA, stato()]);
  // le sole posizioni sono le proprie (nave, traccia) e quelle ordinate (waypoint); il resto sono misure
  // (sonar, spettri, echi, intercettazioni, transitori, periscopio, ESM, radar) e ipotesi dell'equipaggio
  // (tracce, storia dei rilevamenti, soluzioni)
  assert.deepEqual(Object.keys(s).sort(), [
    'errore', 'esm', 'inViaggio', 'intercetti', 'nave', 'oraTracce', 'ordinati', 'partita', 'ping', 'prossimoOrdine',
    'prossimoRapporto', 'radar', 'rapporti', 'soluzioni', 'sonar', 'sonarStretta', 'spettri', 'storia', 'tracce', 'traccia',
    'transitori', 'uscita', 'utente', 'visivo',
  ]);
});

// ------------------------------------------------------------------------------------ protocollo v2

const { codificaByte, SPETTRO } = await import('../../shared/protocol.js');

/** @param {number} n @param {number} [v] */
const byte = (n, v = 40) => new Uint8Array(n).fill(v);

test('v2, stato: alberi, radar, ascolto del ping, assistenza, analizzatore, designato', () => {
  const s = tutti(statoIniziale(), [PARTITA, stato({
    alberi: { periscopio: true, esm: false, radar: false }, radar_attivo: false, ascolto_attivo: 12.5, assistenza: 1,
    analizzatore: { sensore: 'towed', rilevamento: 45.3, contatto: 'S2' }, designato: 'S2',
  })]);
  assert.deepEqual(s.nave.alberi, { periscopio: true, esm: false, radar: false });
  assert.equal(s.nave.ascolto_attivo, 12.5);
  assert.equal(s.nave.assistenza, 1);
  assert.deepEqual(s.nave.analizzatore, { sensore: 'towed', rilevamento: 45.3, contatto: 'S2' });
  assert.equal(s.ordinati.designato, 'S2');
  // un server che non dice il designato non cancella lo specchio dell'ordine appena dato
  const senza = stato();
  delete senza.designato;
  const t = riduci(riduci(s, { t: 'ordine', cosa: 'designa', valore: 'S3', n: 9 }), senza);
  assert.equal(t.ordinati.designato, 'S3');
});

test('v2, sonar a banda stretta: una storia separata da quella a banda larga', () => {
  let s = tutti(statoIniziale(), [PARTITA, stato()]);
  s = riduci(s, { t: 'sonar', ora: 12, sensore: 'sfera', settori: codificaSettori(byte(180)), ciechi: [] });
  s = riduci(s, { t: 'sonar', ora: 12, sensore: 'towed', banda: 'stretta', settori: codificaSettori(byte(180, 90)), ciechi: [], asse: 270 });
  assert.equal(s.sonar.length, 1);
  assert.equal(s.sonarStretta.length, 1);
  assert.equal(s.sonarStretta[0].towed.settori[0], 90);
  assert.equal(s.sonar[0].towed, null);
});

test('v2, spettro: righe e DEMON della finestra del sensore; lunghezze sbagliate si scartano', () => {
  const f = SPETTRO.towed;
  const m = {
    t: 'spettro', ora: 16, sensore: 'towed', rilevamento: 123.4, contatto: 'S1', da_hz: f.DA_HZ, passo_hz: f.PASSO_HZ,
    righe: codificaByte(byte(f.RIGHE, 70)), demon_da_hz: f.DEMON_DA_HZ, demon_passo_hz: f.DEMON_PASSO_HZ,
    demon: codificaByte(byte(f.DEMON_RIGHE, 41)), asse: 90, sorda: false,
  };
  let s = riduci(statoIniziale(), m);
  assert.equal(s.spettri.length, 1);
  assert.equal(s.spettri[0].righe.length, f.RIGHE);
  assert.equal(s.spettri[0].demon[3], 41);
  assert.equal(s.spettri[0].contatto, 'S1');
  assert.equal(s.spettri[0].asse, 90);
  s = riduci(s, { ...m, righe: codificaByte(byte(10)) });
  assert.equal(s.spettri.length, 1);
});

test('v2, eco: un messaggio per eco, raccolti per numero di ping', () => {
  let s = tutti(statoIniziale(), [PARTITA, stato()]);
  s = riduci(s, { t: 'eco', ora: 20.5, ping: 3, rilevamento: 44.5, distanza: 4200, forza: 12, riverbero: -3 });
  s = riduci(s, { t: 'eco', ora: 31.2, ping: 3, rilevamento: 50.1, distanza: 12000, forza: 4, riverbero: 2 });
  s = riduci(s, { t: 'eco', ora: 80, ping: 4, rilevamento: 10, distanza: 900, forza: 30, riverbero: 0 });
  assert.equal(s.ping.length, 2);
  assert.equal(s.ping[0].numero, 4);
  assert.deepEqual(s.ping[1].echi.map((e) => e.distanza), [4200, 12000]);
  assert.equal(s.ping[1].riverbero, 2);
});

test('v2, intercettazioni, transitori, ESM e radar: dal più recente', () => {
  let s = riduci(statoIniziale(), { t: 'intercetto', ora: 5, rilevamento: 300, tipo: 'ping', frequenza_khz: 3.5, livello: 40 });
  s = riduci(s, { t: 'transitorio', ora: 6, sensore: 'towed', rilevamento: 30, speculare: 330, tipo: 'scafo', forza: 9 });
  s = riduci(s, { t: 'esm', ora: 7, emissioni: [{ rilevamento: 280, tipo: 'AN/SPS-40', banda: 'B', livello: 33 }] });
  s = riduci(s, { t: 'radar', ora: 8, echi: [{ rilevamento: 12.5, distanza: 15000 }] });
  assert.equal(s.intercetti[0].frequenza_khz, 3.5);
  assert.equal(s.transitori[0].speculare, 330);
  assert.equal(s.esm.emissioni[0].tipo, 'AN/SPS-40');
  assert.deepEqual(s.radar.echi, [{ rilevamento: 12.5, distanza: 15000 }]);
});

test('v2, visivo: luci null di giorno, sagoma null per gli alberi, sotto l\'orizzonte e scia', () => {
  const s = riduci(statoIniziale(), {
    t: 'visivo', ora: 9, oggetti: [
      { vista: 1, rilevamento: 10.2, aspetto: -95, sagoma: 'FOREST2', elevazione_alberi: 0.312, luci: null, sotto_orizzonte: false, scia: true },
      { vista: 2, rilevamento: 200, aspetto: null, sagoma: null, elevazione_alberi: null, luci: null, sotto_orizzonte: false, scia: false },
    ],
  });
  assert.equal(s.visivo.oggetti.length, 2);
  assert.equal(s.visivo.oggetti[0].luci, null);
  assert.equal(s.visivo.oggetti[0].aspetto, -95);
  assert.equal(s.visivo.oggetti[1].sagoma, null);
  assert.equal(s.visivo.oggetti[1].elevazione_alberi, null);
});

test('v2, tracce: la storia tempo-rilevamento con la posizione propria; le soluzioni delle tracce perse se ne vanno', () => {
  let s = tutti(statoIniziale(), [PARTITA, stato({ ora: 100, x: 0, y: 0, rotta: 90, velocita: 10 })]);
  s = riduci(s, { t: 'tracce', ora: 104, tracce: [{ contatto: 'S1', sensori: ['sfera'], rilevamento: 45, variazione: 0.5, classe: null, confidenza: null, stato: 'nuova' }] });
  s = riduci(s, { t: 'soluzione', contatto: 'S1', ora: 104, rilevamento: 45, distanza: 8000, rotta: 180, velocita: 12, q: 40,
    ellisse: { asse_lungo: 3000, asse_corto: 200, orientamento: 45 }, origine: 'equipaggio', esatta: false });
  const p = s.storia.S1[0];
  assert.equal(p.rilevamento, 45);
  // 4 s a 10 nodi verso est dall'ultimo stato
  assert.ok(Math.abs(p.x - 4 * 10 * 1852 / 3600) < 1e-6 && Math.abs(p.y) < 1e-9);
  assert.equal(s.soluzioni.S1.q, 40);
  assert.equal(s.soluzioni.S1.rilevamento, 45);
  // la stessa ora non aggiunge un punto; una traccia che sparisce porta via la sua soluzione, non la storia
  s = riduci(s, { t: 'tracce', ora: 104, tracce: [{ contatto: 'S1', sensori: ['sfera'], rilevamento: 46, stato: 'tenuta' }] });
  assert.equal(s.storia.S1.length, 1);
  s = riduci(s, { t: 'tracce', ora: 108, tracce: [] });
  assert.equal(s.soluzioni.S1, undefined);
  assert.equal(s.storia.S1.length, 1);
});

test('v2, ordini: designa, classifica (anche tolta), abbandona; la soluzione del comandante cancellata', () => {
  let s = tutti(statoIniziale(), [PARTITA, stato()]);
  s = riduci(s, { t: 'ordine', cosa: 'designa', valore: 'S1', n: 1 });
  s = riduci(s, { t: 'ordine', cosa: 'classifica', valore: { contatto: 'S1', classe: 'forrest_sherman' }, n: 2 });
  assert.equal(s.ordinati.designato, 'S1');
  assert.equal(s.ordinati.classifiche.S1, 'forrest_sherman');
  s = riduci(s, { t: 'ordine', cosa: 'classifica', valore: { contatto: 'S1', classe: null }, n: 3 });
  assert.equal(s.ordinati.classifiche.S1, null);
  s = riduci(s, { t: 'soluzione', contatto: 'S1', ora: 10, rilevamento: 5, distanza: 5000, rotta: 0, velocita: 5, q: null, ellisse: null, origine: 'comandante', esatta: false });
  s = riduci(s, { t: 'ricevuto', n: 4, cosa: 'soluzione', valore: { contatto: 'S1', cancella: true } });
  assert.equal(s.soluzioni.S1, undefined);
  s = riduci(s, { t: 'ordine', cosa: 'abbandona', valore: 'S1', n: 5 });
  assert.equal(s.ordinati.designato, null);
  assert.equal(Object.hasOwn(s.ordinati.classifiche, 'S1'), false);
});

test('v2, partita nuova: misure e ipotesi della partita vecchia se ne vanno', () => {
  let s = tutti(statoIniziale(), [PARTITA, stato()]);
  s = riduci(s, { t: 'intercetto', ora: 5, rilevamento: 300, tipo: 'ping', frequenza_khz: 3.5, livello: 40 });
  s = riduci(s, { t: 'tracce', ora: 12, tracce: [{ contatto: 'S1', sensori: ['sfera'], rilevamento: 45, stato: 'nuova' }] });
  s = riduci(s, { ...PARTITA, id: 'p9' });
  assert.deepEqual([s.intercetti.length, s.tracce.length, Object.keys(s.storia).length, s.oraTracce], [0, 0, 0, null]);
});

test('storia: chi rientra ritrova i punti tempo-rilevamento, fusi senza doppioni e in ordine', () => {
  let s = statoIniziale();
  s = riduci(s, { t: 'storia', ora: 300, contatto: 'S1', punti: [
    { ora: 120, rilevamento: 45.2, x: 0, y: 0, rotta: 90 },
    { ora: 100, rilevamento: 44.1, x: -50, y: 0, rotta: 90 },
    { ora: 110, rilevamento: 'x', x: 0, y: 0, rotta: 90 },
  ] });
  assert.deepEqual(s.storia.S1.map((p) => p.ora), [100, 120], 'ordinati, quelli malformati scartati');
  s = riduci(s, { t: 'storia', ora: 310, contatto: 'S1', punti: [{ ora: 120, rilevamento: 99, x: 1, y: 1, rotta: 0 }, { ora: 130, rilevamento: 46, x: 50, y: 0, rotta: 90 }] });
  assert.deepEqual(s.storia.S1.map((p) => [p.ora, p.rilevamento]), [[100, 44.1], [120, 45.2], [130, 46]], 'un punto già noto non si sovrascrive');
  assert.equal(riduci(s, { t: 'storia', ora: 1, punti: [] }), s, 'senza contatto non cambia niente');
});
