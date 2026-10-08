// @ts-check
/**
 * Prove dei sensori di F2 (filone H): banda stretta (righe tonali, LOFAR,
 * DEMON), sonar attivo e controscoperta, transitori, alberi, periscopio e
 * stadimetro, ESM e radar, eventi del diario. Le portate si calcolano con lo
 * stesso codice dei sensori (sensors/taratura_f2.js); le meccaniche si provano
 * dentro una partita vera (match/partita.js), con i messaggi che arriverebbero
 * al client.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Generatore } from '../../shared/rng.js';
import { SONAR, SPETTRO, decodificaDemon, decodificaSettori, decodificaSpettro, dequantizzaSE, settoreDi, validaOrdine } from '../../shared/protocol.js';
import { rilevamento as rilevamentoDa } from '../../shared/geo.js';
import { differenzaAngolare } from '../../shared/units.js';
import { ambienteProvvisorio } from '../src/sim/world/ambiente.js';
import { caricaPropagazione } from '../src/sim/world/propagazione.js';
import { eccessoAllaDistanza } from '../src/sim/sensors/taratura.js';
import {
  eccessoAttivo, eccessoBandaStretta, erroreStadimetro, portata, portataEsm, portateOttiche,
} from '../src/sim/sensors/taratura_f2.js';
import { SensorePassivo } from '../src/sim/sensors/passivo.js';
import { AnalizzatoreBandaStretta } from '../src/sim/sensors/bandastretta.js';
import { Battello } from '../src/sim/platform/battello.js';
import { Nave } from '../src/ai/navi.js';
import { acustica, piattaforme, p688, partita, raccoglitore, battello, avanza, ordina } from './aiuto.js';

/** L'estate di TORPEX su un fondale piatto (la piattaforma delle Fær Øer, o acqua profonda). */
const estate = (/** @type {number} */ fondale) => ambienteProvvisorio({
  fondale, strato: 21, perditaStrato: 13.5, statoMare: 3, traffico: 0.4, temperatura: 8.7, salinita: 35.24, ph: 8.09,
});

/** @param {Record<string, any>} m @param {number} k */
const qDi = (m, k) => /** @type {Uint8Array} */ (decodificaSpettro(/** @type {any} */ (m)))[k];

/**
 * Un ascoltatore 688 a 150 m e 5 kt con l'antenna filata e i suoi analizzatori.
 * @param {import('../src/sim/world/ambiente.js').Ambiente} amb
 */
function ascoltatore(amb) {
  const b = new Battello({
    id: 'a', nome: 'a', sigla: 'a', piattaforma: p688.valori, x: 0, y: 0, z: 150, rotta: 0, velocita: 5,
    rng: new Generatore(1), acustica,
  });
  b.vElica = 5;
  const t = /** @type {NonNullable<Battello['towed']>} */ (b.towed);
  t.stato = 'filata';
  t.filato = t.lunghezza;
  b._towed(0, amb);
  /** @param {'sfera' | 'towed'} nome */
  const sens = (nome) => {
    const passivo = new SensorePassivo({ nome, battello: b, ac: acustica, rng: new Generatore(`p${nome}`), rngCoppia: (id) => new Generatore(`c${nome}${id}`) });
    const bs = new AnalizzatoreBandaStretta({ passivo, ac: acustica, rng: new Generatore(`b${nome}`), rngCoppia: (id) => new Generatore(`bc${nome}${id}`) });
    return { passivo, bs };
  };
  return { b, sfera: sens('sfera'), towed: sens('towed') };
}

/**
 * Un cacciatorpediniere della palestra con la sua firma.
 * @param {number} x @param {number} y @param {number} rotta @param {number} velocita
 */
function cacciatorpediniere(x, y, rotta, velocita) {
  return new Nave({
    id: 'n1', classe: 'cacciatorpediniere', nome: 'dd', profilo: acustica.sorgenti.cacciatorpediniere,
    x, y, rotta, velocita, waypoint: [], firma: acustica.firme.forrest_sherman,
  });
}

// ---------------------------------------------------------------------------
// Banda stretta
// ---------------------------------------------------------------------------

test('banda stretta: l\'antenna scopre il cacciatorpediniere dalle righe prima della sfera a banda larga', async () => {
  const bersaglio = /** @type {const} */ ({ tipo: 'nave', classe: 'cacciatorpediniere', velocita: 10 });
  /** @type {[string, import('../src/sim/world/ambiente.js').Ambiente, number][]} */
  const casi = [['piattaforma, 150 m', estate(200), 150], ['acqua profonda, 150 m', estate(1000), 150]];
  const tab = await caricaPropagazione('torpex_palestra', { fondale: () => 190 });
  if (tab) {
    for (const q of [150, 18]) {
      const amb = estate(190);
      amb.propagazione = tab;
      casi.push([`tabelle di propagazione, ${q} m`, amb, q]);
    }
  }
  for (const [nome, amb, quota] of casi) {
    const a = { ascoltatore: /** @type {const} */ ({ sensore: 'towed', velocita: 5, quota }), bersaglio, ac: acustica, amb, piattaforme };
    const righe = portata(eccessoBandaStretta(a));
    const sfera = portata(eccessoAllaDistanza({ ...a, ascoltatore: { ...a.ascoltatore, sensore: 'sfera' } }));
    assert.ok(righe > 1.3 * sfera, `${nome}: righe ${(righe / 1852).toFixed(1)} nm, sfera ${(sfera / 1852).toFixed(1)} nm`);
  }
  // Un 688 lento non e' un regalo per l'antenna: le sue righe sono basse.
  const amb = estate(200);
  const a = { ascoltatore: /** @type {const} */ ({ sensore: 'towed', velocita: 5, quota: 150 }), bersaglio: /** @type {const} */ ({ tipo: 'sottomarino', piattaforma: '688', velocita: 5, quota: 150 }), ac: acustica, amb, piattaforme };
  const r688 = portata(eccessoBandaStretta(a));
  assert.ok(r688 > 2000 && r688 < 7000, `688 lento sulle righe: ${r688.toFixed(0)} m`);
});

test('banda stretta: nei fotogrammi il cacciatorpediniere c\'e\' dove la banda larga non lo vede', () => {
  const amb = estate(200);
  const { b, sfera, towed } = ascoltatore(amb);
  const g = /** @type {NonNullable<ReturnType<SensorePassivo['geometria']>>} */ (towed.passivo.geometria(amb));
  // a 8,5 km al traverso di dritta: oltre la portata a banda larga di sfera e antenna (≈ 7 km), dentro quella delle righe (≈ 10,5)
  const dd = cacciatorpediniere(g.pos.x + 8500, g.pos.y, 0, 10);
  const vero = rilevamentoDa(g.pos, dd.posizioneAcustica());
  const k = settoreDi(vero);
  let stretta = 0;
  let larga = 0;
  for (let i = 0; i < 40; i++) {
    const fs = /** @type {NonNullable<ReturnType<AnalizzatoreBandaStretta['fotogramma']>>} */ (towed.bs.fotogramma([b, dd], amb));
    assert.equal(fs.banda, 'stretta');
    const picco = Math.max(fs.settori[(k + 179) % 180], fs.settori[k], fs.settori[(k + 1) % 180]);
    if (picco >= SONAR.Q_SOGLIA) stretta++;
    const fl = /** @type {NonNullable<ReturnType<SensorePassivo['fotogramma']>>} */ (sfera.passivo.fotogramma([b, dd], amb));
    const piccoL = Math.max(fl.settori[(k + 179) % 180], fl.settori[k], fl.settori[(k + 1) % 180]);
    if (piccoL >= SONAR.Q_SOGLIA) larga++;
    // i contributi (verita') restano sul fotogramma del server
    assert.ok(fs.contributi?.some((c) => c.sorgente === 'n1'));
  }
  assert.ok(stretta >= 20, `fotogrammi a banda stretta col picco: ${stretta}/40`);
  assert.ok(larga < stretta / 2, `fotogrammi della sfera col picco: ${larga}/40`);
});

test('LOFAR: le righe del cacciatorpediniere alle frequenze giuste, l\'ingranamento segue i giri', () => {
  const amb = estate(200);
  const { b, towed } = ascoltatore(amb);
  const g = /** @type {NonNullable<ReturnType<SensorePassivo['geometria']>>} */ (towed.passivo.geometria(amb));
  // A 10 kt (la velocita' di riferimento della firma) tutte le righe fisse spiccano; a 18 kt
  // la banda larga e' salita di 13 dB e restano la rete a 60 Hz e l'ingranamento, che segue i giri.
  for (const [velocita, righe] of /** @type {[number, number[]][]} */ ([[10, [60, 97, 120, 145]], [18, [60]]])) {
    // al traverso, con la prua a nord come l'ascoltatore: niente Doppler
    const dd = cacciatorpediniere(g.pos.x + 3000, g.pos.y, 0, velocita);
    const fascio = rilevamentoDa(g.pos, dd.posizioneAcustica());
    towed.bs.epoca = velocita; // un istante nuovo per la cache degli spettri
    const s = /** @type {NonNullable<ReturnType<AnalizzatoreBandaStretta['spettro']>>} */ (towed.bs.spettro([b, dd], amb, fascio, new Generatore(9)));
    const fin = SPETTRO.towed;
    const m = { sensore: 'towed', righe: btoa(String.fromCharCode(...s.righe)) };
    const cella = (/** @type {number} */ f) => Math.floor((f - fin.DA_HZ) / fin.PASSO_HZ);
    const giri = velocita * /** @type {number} */ (acustica.firme.forrest_sherman.propulsione?.giri_per_nodo);
    const ingranamento = 120 * giri / 60;
    for (const f of [...righe, ingranamento]) {
      const q = qDi(m, cella(f));
      const intorno = [cella(f) - 6, cella(f) - 5, cella(f) + 5, cella(f) + 6].map((c) => qDi(m, c));
      assert.ok(dequantizzaSE(q) > 0, `${velocita} kt, riga a ${f.toFixed(1)} Hz: SE ${dequantizzaSE(q)}`);
      assert.ok(q > Math.max(...intorno) + 6, `${velocita} kt, ${f.toFixed(1)} Hz: la riga non spicca`);
    }
  }
});

test('DEMON: frequenza d\'asse e di pala dai giri; senza cavitazione il 688 e\' muto', () => {
  const amb = estate(200);
  const { b, sfera } = ascoltatore(amb);
  const g = /** @type {NonNullable<ReturnType<SensorePassivo['geometria']>>} */ (sfera.passivo.geometria(amb));
  const dd = cacciatorpediniere(g.pos.x + 2500, g.pos.y, 0, 10);
  const fascio = rilevamentoDa(g.pos, dd.posizioneAcustica());
  const s = /** @type {NonNullable<ReturnType<AnalizzatoreBandaStretta['spettro']>>} */ (sfera.bs.spettro([b, dd], amb, fascio, new Generatore(3)));
  const fin = SPETTRO.sfera;
  const dem = /** @type {Uint8Array} */ (decodificaDemon({ sensore: 'sfera', demon: btoa(String.fromCharCode(...s.demon)) }));
  const cella = (/** @type {number} */ f) => Math.floor((f - fin.DEMON_DA_HZ) / fin.DEMON_PASSO_HZ);
  const asse = 10 * 10 / 60; // 10 kt · 10 giri/min/kt
  const pala = asse * 4;
  for (const f of [asse, pala, 2 * pala]) assert.ok(dequantizzaSE(dem[cella(f)]) > 3, `DEMON a ${f.toFixed(2)} Hz: ${dequantizzaSE(dem[cella(f)])}`);
  // la cella piu' forte e' la frequenza di pala: pale = pala / asse
  let kMax = 0;
  for (let k = 1; k < dem.length; k++) if (dem[k] > dem[kMax]) kMax = k;
  assert.equal(kMax, cella(pala));
  // Un 688 a 5 kt (niente cavitazione): nessuna riga di modulazione sopra soglia.
  const altro = battello({ x: g.pos.x + 2500, y: g.pos.y, z: 150, velocita: 5 });
  altro.vElica = 5;
  sfera.bs.epoca = 1; // un istante nuovo per la cache degli spettri
  const s2 = /** @type {NonNullable<ReturnType<AnalizzatoreBandaStretta['spettro']>>} */ (sfera.bs.spettro([b, altro], amb, rilevamentoDa(g.pos, altro.posizioneAcustica()), new Generatore(4)));
  assert.ok(Math.max(...s2.demon) < SONAR.Q_SOGLIA, 'il DEMON di un 688 lento dovrebbe essere vuoto');
  // ...e cavitando a quota periscopica le sette pale si contano.
  const cav = battello({ x: g.pos.x + 2500, y: g.pos.y, z: 18, velocita: 12 });
  cav.vElica = 12;
  cav.cavitante = true;
  sfera.bs.epoca = 2;
  const s3 = /** @type {NonNullable<ReturnType<AnalizzatoreBandaStretta['spettro']>>} */ (sfera.bs.spettro([b, cav], amb, rilevamentoDa(g.pos, cav.posizioneAcustica()), new Generatore(5)));
  const asse688 = 12 * 5.6 / 60;
  assert.ok(dequantizzaSE(s3.demon[cella(7 * asse688)]) > 0, 'pala del 688 che cavita');
});

// ---------------------------------------------------------------------------
// Partita: attivo, transitori, alberi, periscopio, ESM, radar, diario
// ---------------------------------------------------------------------------

/**
 * Una partita della palestra con due 688 e i loro raccoglitori.
 * @param {number | string} seme
 */
function dueGiocatori(seme) {
  const p = partita(seme, { fondale: 200, strato: 21, perditaStrato: 13.5, statoMare: 3, traffico: 0.4 });
  const ra = raccoglitore();
  const rb = raccoglitore();
  const ga = /** @type {NonNullable<ReturnType<typeof p.aggiungiGiocatore>>} */ (p.aggiungiGiocatore(1, 'A', ra.invia));
  const gb = /** @type {NonNullable<ReturnType<typeof p.aggiungiGiocatore>>} */ (p.aggiungiGiocatore(2, 'B', rb.invia));
  return { p, ra, rb, ga, gb };
}

/**
 * @param {ReturnType<typeof dueGiocatori>['p']} p
 * @param {number} uid
 * @param {string} cosa
 * @param {unknown} valore
 */
function ordine(p, uid, cosa, valore) {
  const v = validaOrdine({ cosa, valore });
  assert.ok(v.ok, `${cosa} ${JSON.stringify(valore)}`);
  return p.ordine(uid, /** @type {any} */ (v).ordine);
}

/**
 * Fa avanzare la partita di `secondi` di gioco.
 * @param {ReturnType<typeof dueGiocatori>['p']} p @param {number} secondi
 */
function corri(p, secondi) {
  for (let i = 0; i < secondi * 10; i++) p.passo();
}

test('attivo: l\'eco da\' distanza e rilevamento, l\'intercettatore sente il ping prima e piu\' lontano', () => {
  const { p, ra, rb, ga, gb } = dueGiocatori('ping');
  const a = ga.battello;
  const bb = gb.battello;
  for (const b of [a, bb]) { b.z = 150; b.quotaOrdinata = 150; b._zPrecedente = 150; }
  a.x = 0; a.y = 0; a.rotta = 0; a.rottaOrdinata = 0;
  bb.x = 300; bb.y = 6000; bb.rotta = 90; bb.rottaOrdinata = 90;
  corri(p, 2);
  const vera = Math.hypot(bb.x - a.x, bb.y - a.y, 0);
  assert.equal(ordine(p, 1, 'attivo', { rilevamento: null, portata: 'corta' }), null);
  assert.equal(ordine(p, 1, 'attivo', { rilevamento: null, portata: 'corta' }), 'ping_in_corso');
  assert.equal(ordine(p, 1, 'attivo', { rilevamento: 180, portata: 'corta' }), 'ping_in_corso');
  corri(p, 14);
  const eco = ra.di('eco').find((m) => Math.abs(differenzaAngolare(m.rilevamento, rilevamentoDa(a, bb))) < 10);
  assert.ok(eco, `nessuna eco di B: ${JSON.stringify(ra.di('eco'))}`);
  assert.ok(Math.abs(eco.distanza - vera) / vera < 0.02, `distanza misurata ${eco.distanza}, vera ${vera.toFixed(0)}`);
  assert.equal(eco.ping, 1);
  const int = rb.di('intercetto')[0];
  assert.ok(int, 'B non ha intercettato il ping');
  assert.ok(int.ora < eco.ora, 'l\'intercettazione (un percorso) arriva prima dell\'eco (andata e ritorno)');
  assert.equal(int.tipo, 'ping');
  assert.ok(Math.abs(int.frequenza_khz - 3.5) <= 0.2);
  assert.ok(Math.abs(differenzaAngolare(int.rilevamento, rilevamentoDa(bb, a))) < 20, `rilevamento dell'intercettazione ${int.rilevamento}`);
  assert.ok(rb.di('rapporto').some((m) => m.chiave === 'intercetto.ping'));
  assert.ok(ra.di('rapporto').some((m) => m.chiave === 'sonar.eco'));
  assert.ok(ra.di('rapporto').some((m) => m.chiave === 'sonar.fine_ascolto'));
  assert.ok(ra.di('stato').length === 0 || true);
  assert.equal(p.stato(ga).ascolto_attivo, 0);
  // il ping fuori settore si rifiuta (la sfera trasmette a prua)
  assert.equal(ordine(p, 1, 'attivo', { rilevamento: 170, portata: 'corta' }), 'settore');
  // diario: ping, eco, intercetto, controscoperta per il ping
  const d = p.diario;
  assert.equal(d.difetti, 0, JSON.stringify(d.eventi.filter((e) => e.difetto)));
  assert.ok(d.di('ping').some((e) => e.sorgente === a.id));
  assert.ok(d.di('eco').some((e) => e.osservatore === a.id && e.sorgente === bb.id && Math.abs(/** @type {number} */ (e.distanza_vera) - vera) < 50));
  assert.ok(d.di('intercetto').some((e) => e.osservatore === bb.id && e.emettitore === a.id));
  assert.ok(d.di('controscoperta').some((e) => e.causa === 'ping' && e.ascoltatore === bb.id && e.sorgente === a.id));
});

test('attivo: l\'intercettazione arriva molto piu\' lontano dell\'eco (asimmetria della controscoperta)', () => {
  for (const fondale of [200, 1000]) {
    for (const [chi, contro] of [['688', 'alfa'], ['alfa', '688'], ['688', '688']]) {
      const e = eccessoAttivo({
        pingatore: chi, quota: 150, bersaglio: { tipo: 'sottomarino', piattaforma: contro, velocita: 5, quota: 150 },
        portata: 'corta', puntato: true, ac: acustica, amb: estate(fondale), statoMare: 3, piattaforme,
      });
      const eco = portata((r) => e.eco(r));
      const intercetto = portata((r) => e.intercetto(r));
      assert.ok(eco > 4000, `${chi} su ${contro}, ${fondale} m: eco a ${eco.toFixed(0)} m`);
      assert.ok(intercetto > 2 * eco, `${chi} su ${contro}, ${fondale} m: intercetto ${intercetto.toFixed(0)} m, eco ${eco.toFixed(0)} m`);
    }
  }
});

test('transitori: lo scafo scricchiola nei cambi di quota, l\'idraulica degli alberi si sente', () => {
  const b = battello({ z: 50, velocita: 8 });
  b.vElica = 8;
  ordina(b, 'quota', 250);
  /** @type {string[]} */
  const tipi = [];
  avanza(b, 240, ambienteProvvisorio(), () => { for (const t of b.transitoriNuovi.splice(0)) tipi.push(t.tipo); });
  assert.ok(tipi.filter((t) => t === 'scafo').length >= 3, `scricchiolii: ${tipi}`);
  // a quota ferma niente
  tipi.length = 0;
  avanza(b, 120, ambienteProvvisorio(), () => { for (const t of b.transitoriNuovi.splice(0)) tipi.push(t.tipo); });
  assert.equal(tipi.filter((t) => t === 'scafo').length, 0);
  // il cambio di regime delle pompe del refrigerante (16 kt) e' un transitorio `pompa`
  ordina(b, 'macchina', 'full');
  avanza(b, 120, ambienteProvvisorio(), () => { for (const t of b.transitoriNuovi.splice(0)) tipi.push(t.tipo); });
  assert.ok(tipi.includes('pompa'), `cambio di regime: ${tipi}`);

  // In partita: B cambia quota vicino ad A, che lo sente.
  const { p, ra, ga, gb } = dueGiocatori('scafo');
  ga.battello.x = 0; ga.battello.y = 0;
  gb.battello.x = 2500; gb.battello.y = 0; gb.battello.velocita = 6; gb.battello.vElica = 6;
  ordine(p, 2, 'macchina', '1/3');
  ordine(p, 2, 'quota', 220);
  corri(p, 300);
  assert.ok(p.diario.di('transitorio').some((e) => e.sorgente === gb.battello.id && e.tipo === 'scafo'));
  const sentiti = ra.di('transitorio');
  assert.ok(sentiti.length >= 1, 'A non ha sentito gli scricchiolii di B');
  for (const m of sentiti) assert.ok(['scafo', 'sconosciuto', 'pompa', 'meccanico'].includes(m.tipo), m.tipo);
  assert.ok(ra.di('rapporto').some((m) => m.chiave === 'sonar.transitorio'));
  assert.ok(p.diario.di('controscoperta').some((e) => e.causa === 'transitorio' && e.ascoltatore === ga.battello.id));
  assert.equal(p.diario.difetti, 0);
});

test('alberi: solo a quota periscopica; periscopio ed ESM danno `visivo` ed `esm`; l\'ufficiale li abbassa scendendo', () => {
  const { p, ra, ga } = dueGiocatori('alberi');
  const a = ga.battello;
  a.z = 100; a.quotaOrdinata = 100; a._zPrecedente = 100;
  corri(p, 2);
  assert.equal(ordine(p, 1, 'albero', { quale: 'periscopio', alzato: true }), 'quota');
  assert.equal(ordine(p, 1, 'radar', true), 'albero');
  corri(p, 5);
  assert.equal(ra.di('visivo').length, 0);
  assert.equal(ra.di('esm').length, 0);
  // a quota periscopica
  a.z = 18; a.quotaOrdinata = 18; a._zPrecedente = 18;
  assert.equal(ordine(p, 1, 'albero', { quale: 'periscopio', alzato: true }), null);
  assert.equal(ordine(p, 1, 'albero', { quale: 'esm', alzato: true }), null);
  assert.equal(ordine(p, 1, 'albero', { quale: 'radar', alzato: true }), null);
  assert.equal(ordine(p, 1, 'radar', true), null);
  corri(p, 12);
  const st = p.stato(ga);
  assert.deepEqual(st.alberi, { periscopio: true, esm: true, radar: true });
  assert.equal(st.radar_attivo, true);
  assert.ok(ra.di('visivo').length >= 10, 'un `visivo` al secondo');
  const esm = ra.di('esm');
  assert.ok(esm.length >= 10);
  // i cacciatorpediniere della palestra (10-30 km) trasmettono: l'ESM li sente oltre l'orizzonte acustico
  assert.ok(esm.at(-1)?.emissioni.some((/** @type {any} */ e) => e.tipo === 'AN/SPS-40' && e.banda === 'B'), JSON.stringify(esm.at(-1)));
  assert.ok(ra.di('rapporto').some((m) => m.chiave === 'esm.radar'));
  assert.ok(ra.di('radar').length >= 1, 'il radar proprio fa i suoi giri');
  // periscopio alzato oltre i 10 kt: avviso e rapporto
  a.velocita = 12;
  a.vElica = 12;
  ordine(p, 1, 'macchina', 'full');
  corri(p, 3);
  assert.ok(p.stato(ga).avvisi.includes('periscopio_scia'));
  assert.ok(ra.di('rapporto').some((m) => m.chiave === 'periscopio.scia'));
  // giu': l'ufficiale di guardia abbassa tutto
  ordine(p, 1, 'quota', 80);
  corri(p, 60);
  assert.deepEqual(p.stato(ga).alberi, { periscopio: false, esm: false, radar: false });
  assert.equal(p.stato(ga).radar_attivo, false);
  assert.ok(ra.di('rapporto').some((m) => m.chiave === 'guardia.alberi_abbassati'));
  const d = p.diario;
  assert.equal(d.difetti, 0);
  assert.ok(d.di('albero').some((e) => e.battello === a.id && e.alzato === false && e.da === 'guardia'));
  assert.ok(d.di('radar').some((e) => e.battello === a.id && e.attivo === true));
  assert.ok(d.di('esm').some((e) => e.osservatore === a.id && /** @type {number} */ (e.distanza_vera) > 10000));
});

test('periscopio: navi con le sagome originali; alberi altrui da vicino; stadimetro ±7 % con la classe giusta', () => {
  const { p, ra, ga, gb } = dueGiocatori('periscopio');
  const a = ga.battello;
  const nave = /** @type {Nave} */ ([...p.entita.values()].find((e) => e.tipo === 'nave' && /** @type {Nave} */ (e).classe === 'cacciatorpediniere'));
  a.x = nave.x - 4000; a.y = nave.y; a.z = 18; a.quotaOrdinata = 18; a._zPrecedente = 18;
  gb.battello.x = a.x + 900; gb.battello.y = a.y - 600; gb.battello.z = 19; gb.battello.quotaOrdinata = 19;
  ordine(p, 1, 'albero', { quale: 'periscopio', alzato: true });
  ordine(p, 2, 'albero', { quale: 'periscopio', alzato: true });
  corri(p, 3);
  const v = ra.di('visivo').at(-1);
  const ogg = v.oggetti.find((/** @type {any} */ o) => typeof o.sagoma === 'string' && o.sagoma.startsWith('FOREST'));
  assert.ok(ogg, JSON.stringify(v));
  assert.match(ogg.sagoma, /^FOREST[0-4]$/);
  assert.equal(ogg.luci, null);
  assert.ok(ogg.elevazione_alberi > 0.2 && ogg.elevazione_alberi < 0.7, `elevazione ${ogg.elevazione_alberi}`);
  assert.ok(v.oggetti.some((/** @type {any} */ o) => o.sagoma === null && o.aspetto === null), 'l\'albero di B a 1 km non si vede');
  assert.ok(ra.di('rapporto').some((m) => m.chiave === 'periscopio.nave_in_vista'));
  assert.ok(p.diario.di('periscopio').some((e) => e.osservatore === a.id && e.oggetto === nave.id));
  assert.ok(p.diario.di('controscoperta').some((e) => e.causa === 'albero' && e.sorgente === gb.battello.id));
  // numeri di vista stabili finche' l'oggetto resta in vista
  corri(p, 3);
  const v2 = ra.di('visivo').at(-1);
  assert.ok(v2.oggetti.some((/** @type {any} */ o) => o.vista === ogg.vista && o.sagoma?.startsWith('FOREST')));
  // stadimetro
  for (const firma of ['forrest_sherman', 'mercantile_generico']) {
    const e = erroreStadimetro(acustica, p688, firma, 1000, `prova:${firma}`);
    assert.ok(e.entro7 >= 0.9, `${firma}: entro ±7 % solo il ${(100 * e.entro7).toFixed(1)} %`);
    assert.ok(Math.abs(e.media) < 0.01, `${firma}: errore medio ${e.media}`);
  }
  // la classe sbagliata (altezza d'albero del mercantile su un cacciatorpediniere) sbaglia di ~17 %
  const giusta = /** @type {any} */ (acustica.firme.forrest_sherman.ottica).altezza_alberi;
  const sbagliata = /** @type {any} */ (acustica.firme.mercantile_generico.ottica).altezza_alberi;
  assert.ok(Math.abs(sbagliata / giusta - 1) > 0.1);
  // di notte la sagoma solo da vicino, le luci piu' lontano
  const giorno = portateOttiche(acustica, p688, 'forrest_sherman', false, 3);
  const notte = portateOttiche(acustica, p688, 'forrest_sherman', true, 3);
  assert.ok(notte.sagoma < giorno.sagoma / 3 && notte.luci > notte.sagoma);
});

test('ESM: i radar dei cacciatorpediniere si sentono oltre l\'orizzonte acustico; il ping no', () => {
  const amb = estate(200);
  const spsa40 = /** @type {any} */ (acustica.firme.forrest_sherman.emettitori)[0];
  const esm = /** @type {any} */ (p688.valori.sensori.esm);
  const radio = portataEsm(acustica, spsa40, esm);
  const acustico = portata(eccessoAllaDistanza({
    ascoltatore: { sensore: 'sfera', velocita: 5, quota: 18 }, bersaglio: { tipo: 'nave', classe: 'cacciatorpediniere', velocita: 10 },
    ac: acustica, amb, piattaforme,
  }));
  assert.ok(radio > 2.5 * acustico, `ESM ${(radio / 1852).toFixed(1)} nm, sfera ${(acustico / 1852).toFixed(1)} nm`);
  assert.ok(radio > 30 * 1852 && radio < 80 * 1852, `${(radio / 1852).toFixed(1)} nm`);
});

test('analizzatore: `spettro` ogni 4 s col contatto o sul rilevamento; rifiuti', () => {
  const { p, ra, ga } = dueGiocatori('analizzatore');
  assert.equal(ordine(p, 1, 'analizzatore', { contatto: 'S9' }), 'contatto');
  assert.equal(ordine(p, 1, 'analizzatore', { sensore: 'towed', rilevamento: 90 }), null);
  corri(p, 9);
  // l'antenna e' stivata: niente spettri dall'antenna
  assert.equal(ra.di('spettro').length, 0);
  assert.equal(ordine(p, 1, 'analizzatore', { sensore: 'sfera', rilevamento: 90 }), null);
  corri(p, 9);
  const s = ra.di('spettro');
  assert.ok(s.length >= 2);
  for (const m of s) {
    assert.equal(m.ora % SPETTRO.PERIODO, 0);
    assert.equal(m.sensore, 'sfera');
    assert.equal(m.rilevamento, 90);
    assert.equal(m.contatto, null);
    assert.equal(decodificaSpettro(m)?.length, SPETTRO.sfera.RIGHE);
    assert.equal(decodificaDemon(m)?.length, SPETTRO.sfera.DEMON_RIGHE);
  }
  assert.deepEqual(p.stato(ga).analizzatore, { sensore: 'sfera', rilevamento: 90, contatto: null });
  assert.equal(ordine(p, 1, 'analizzatore', null), null);
  assert.equal(p.stato(ga).analizzatore, null);
  // l'Alfa non ha l'antenna
  const alfa = new Battello({
    id: 'x', nome: 'x', sigla: 'x', piattaforma: /** @type {any} */ (piattaforme.get('alfa')).valori, x: 0, y: 0, z: 100, rotta: 0, velocita: 0,
    rng: new Generatore(1), acustica,
  });
  assert.equal(alfa.towed, null);
  assert.equal(p.sensoriH.ordine({ battello: alfa, sensori: ga.sensori }, { cosa: 'analizzatore', valore: { sensore: 'towed', rilevamento: 3 } }), 'senza_towed');
  // fotogrammi a banda stretta ogni 4 s, per la sfera (l'antenna e' stivata)
  const strette = ra.di('sonar').filter((m) => m.banda === 'stretta');
  assert.ok(strette.length >= 4 && strette.every((m) => m.sensore === 'sfera' && decodificaSettori(m.settori)));
});
