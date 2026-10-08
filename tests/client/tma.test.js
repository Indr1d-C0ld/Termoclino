// Prove della parte del client della TMA (web/assets/js/client/tma.js e stazioni/vistatma.js) contro il
// modulo comune shared/tma.js: dalla storia dei rilevamenti (costruita dal riduttore con i messaggi del
// protocollo) alle misure, le gambe del proprio moto, i residui del MATE, Ekelund, la posizione delle
// soluzioni; più la geometria della vista. I numeri devono essere quelli del modulo comune.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importa } from './ambiente_client.mjs';

const { statoIniziale, riduci } = await importa('stato.js');
const { misureDi, gambeProprie, proprioAllOra, posizioneSoluzione, provaIniziale, strumenti, SIGMA_NOMINALE } = await importa('tma.js');
const { asseTempo, asseRilevamenti, xDiRilevamentoTma, yDiOra } = await importa('stazioni/vistatma.js');
const shared = await import('../../shared/tma.js');

const NODO = 1852 / 3600;
/** Il bersaglio vero: parte da (6000, 12000) e va per 260° a 10 nodi. @param {number} t */
const bersaglio = (t) => ({ x: 6000 + 10 * NODO * Math.sin((260 * Math.PI) / 180) * t, y: 12000 + 10 * NODO * Math.cos((260 * Math.PI) / 180) * t });

/**
 * Una partita simulata: proprio battello a 8 nodi per 0° per 12 minuti, poi per 90° (accostata secca),
 * uno `stato` al secondo e le `tracce` ogni 4 s col rilevamento vero (senza rumore).
 */
function simula() {
  let s = riduci(statoIniziale(), { t: 'partita', id: 'p', scenario: 'torpex_palestra', ora: 0, passo: 0.1, scala_tempo: 1,
    in_pausa: false, tempo_modificabile: true, origine: { lat: 61.75, lon: -6.83 }, area: { x0: -1e5, y0: -1e5, x1: 1e5, y1: 1e5 },
    battello: { piattaforma: '688', nome: 'Dallas', sigla: 'SSN-700' } });
  let x = 0, y = 0;
  for (let t = 0; t <= 1440; t++) {
    const rotta = t < 720 ? 0 : 90;
    if (t > 0) {
      x += 8 * NODO * Math.sin((rotta * Math.PI) / 180);
      y += 8 * NODO * Math.cos((rotta * Math.PI) / 180);
    }
    s = riduci(s, { t: 'stato', ora: t, x, y, z: 60, rotta, velocita: 8, velocita_verticale: 0, assetto: 0, giri: 40, macchina: '1/3',
      timone: 0, timoni_o: 0, rotta_ordinata: rotta, quota_ordinata: 60, modo_quota: 'automatica',
      autopilota: { attivo: false, waypoint: [], prossimo: null }, cavitazione: false, v_cavitazione: 10, towed: null,
      fondale: 200, profondita_acqua: 260, strato: null, avvisi: [], alberi: { periscopio: false, esm: false, radar: false },
      radar_attivo: false, ascolto_attivo: 0, assistenza: 1, analizzatore: null, designato: 'S1' });
    if (t % 4 === 0) {
      const b = bersaglio(t);
      const ril = shared.rilevamentoDa(x, y, b.x, b.y);
      s = riduci(s, { t: 'tracce', ora: t, tracce: [{ contatto: 'S1', sensori: ['sfera'], rilevamento: ril, variazione: null,
        classe: null, confidenza: null, stato: 'tenuta' }] });
    }
  }
  return s;
}

const S = simula();

test('misure dalla storia: una ogni 4 s, con la posizione propria e la σ nominale del sensore', () => {
  const m = misureDi(S.storia.S1);
  assert.equal(m.length, 1440 / 4 + 1);
  assert.equal(m[0].sigma, SIGMA_NOMINALE.sfera);
  const p = proprioAllOra(S, 400);
  const q = m.find((z) => z.ora === 400);
  assert.ok(p && q && Math.hypot(p.x - q.x, p.y - q.y) < 1);
  assert.equal(misureDi(S.storia.S1, { da: 100, a: 200 }).length, 26);
});

test('gambe proprie: due, prima e dopo l\'accostata, come le trova shared/tma.js', () => {
  const g = gambeProprie(S.traccia);
  assert.equal(g.length, 2);
  assert.ok(Math.abs(g[0].rotta) < 1e-6 && Math.abs(g[1].rotta - 90) < 1e-6);
  assert.deepEqual(g, shared.trovaGambe(S.traccia.map((p) => ({ ora: p.ora, rotta: p.rotta, velocita: p.velocita }))));
});

test('MATE: la soluzione vera ha residui nulli, una sbagliata in distanza fa un salto fra le gambe', () => {
  const ora = 1440;
  const proprio = proprioAllOra(S, ora);
  assert.ok(proprio);
  const vera = shared.inPolare({ ora, ...bersaglio(ora), vx: 10 * NODO * Math.sin((260 * Math.PI) / 180), vy: 10 * NODO * Math.cos((260 * Math.PI) / 180) }, proprio);
  const st = strumenti(S, 'S1', vera);
  assert.ok(st.residui && st.residui.rms < 0.02, `rms ${st.residui?.rms}`);
  // gli stessi residui che dà shared/tma.js
  const diretto = shared.residuiMATE(st.misure, shared.daPolare(vera, proprio), { gambe: st.gambe });
  assert.deepEqual(st.residui, diretto);
  // il 30 % di distanza in più: medie dei residui diverse sulle due gambe
  const lontana = strumenti(S, 'S1', { ...vera, distanza: vera.distanza * 1.3 });
  const [a, b] = lontana.residui?.gambe ?? [];
  assert.ok(Math.abs(a.media - b.media) > 1, `${a.media} ${b.media}`);
});

test('variazione del rilevamento ed Ekelund: gli stessi numeri del modulo comune, e la distanza giusta', () => {
  const st = strumenti(S, 'S1', null);
  const ultima = st.gambe[st.gambe.length - 1];
  const fine = st.misure[st.misure.length - 1].ora;
  assert.deepEqual(st.variazione, shared.velocitaRilevamento(st.misure, { da: ultima.da + 30, a: fine }));
  assert.deepEqual(st.ekelund, shared.ekelundGambe(st.misure, st.gambe));
  const e = st.ekelund[0];
  assert.ok(e.valida);
  // la distanza vera all'ora di Ekelund (il «best range time»): con gambe di 12 minuti la distanza cambia
  // molto durante ciascuna e l'ipotesi del metodo regge solo all'ingrosso (qui −24 %): conta l'ordine di
  // grandezza, la precisione la dà il MATE
  const p = proprioAllOra(S, e.ora);
  const b = bersaglio(e.ora);
  const vera = p ? Math.hypot(b.x - p.x, b.y - p.y) : NaN;
  assert.ok(Math.abs(e.distanza / vera - 1) < 0.3, `Ekelund ${Math.round(e.distanza)} m, vera ${Math.round(vera)} m`);
  // con due gambe la distanza è osservabile
  assert.ok(st.osservabilita?.osservabile);
});

test('soluzione del server: dove sta adesso e da dove riparte il MATE', () => {
  const ora = 1000;
  const proprio = proprioAllOra(S, ora);
  assert.ok(proprio);
  const b = bersaglio(ora);
  /** @type {import('../../web/assets/js/client/stato.js').Soluzione} */
  const sol = { contatto: 'S1', ora, rilevamento: shared.rilevamentoDa(proprio.x, proprio.y, b.x, b.y),
    distanza: Math.hypot(b.x - proprio.x, b.y - proprio.y), rotta: 260, velocita: 10, q: 80, ellisse: null,
    origine: 'equipaggio', esatta: false, x: null, y: null };
  const s = { ...S, soluzioni: { S1: sol } };
  const dopo = posizioneSoluzione(s, sol, 1300);
  const vera = bersaglio(1300);
  assert.ok(dopo && Math.hypot(dopo.x - vera.x, dopo.y - vera.y) < 1);
  const prova = provaIniziale(s, 'S1', 1440);
  const atteso = bersaglio(1440), p2 = proprioAllOra(S, 1440);
  assert.ok(prova && p2 && Math.abs(prova.distanza - Math.hypot(atteso.x - p2.x, atteso.y - p2.y)) < 1);
  assert.ok(prova && Math.abs(prova.rotta - 260) < 1e-6 && Math.abs(prova.velocita - 10) < 1e-6);
  // senza soluzione: l'ultimo rilevamento, 10 000 m, rotta di traverso, 10 nodi
  const vuota = provaIniziale(S, 'S1', 1440);
  assert.equal(vuota?.distanza, 10000);
});

test('vista TMA: asse del tempo a passi tondi, asse dei rilevamenti centrato e simmetrico', () => {
  assert.deepEqual(asseTempo(1000, 900, 62), { fine: 1000, inizio: 700, sPerRiga: 300 / 62, minuti: 5 });
  assert.equal(asseTempo(5000, 0, 62).minuti, 60);
  assert.equal(asseTempo(1440, 0, 62).minuti, 30);
  const a = asseRilevamenti([355, 5, 1]);
  assert.ok(Math.abs(shared.norm180(a.centro - 0.33)) < 0.5);
  assert.equal(a.semi, 10);
  assert.equal(xDiRilevamentoTma(a.centro, a), 8 + 167 / 2);
  assert.equal(Math.round(xDiRilevamentoTma(a.centro + a.semi, a)), 175);
  const t = asseTempo(1000, 900, 62);
  assert.equal(yDiOra(1000, t, 43), 43);
  assert.ok(Math.abs(yDiOra(700, t, 43) - (43 + 62)) < 1e-9);
});
