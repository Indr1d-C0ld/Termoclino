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
  assert.deepEqual(s.ordinati, { autopilota: true, waypoint: [{ x: 1000, y: 2000 }, { x: 3000, y: 4000 }] });
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
  assert.deepEqual(s.ordinati, { autopilota: true, waypoint: [{ x: 10, y: 20 }] });
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
  // le sole posizioni sono le proprie (nave, traccia) e quelle ordinate (waypoint)
  assert.deepEqual(Object.keys(s).sort(), ['errore', 'inViaggio', 'nave', 'ordinati', 'partita', 'prossimoOrdine', 'prossimoRapporto', 'rapporti', 'sonar', 'traccia', 'uscita', 'utente']);
});
