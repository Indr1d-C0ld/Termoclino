// @ts-check
/**
 * Prove di shared/ambiente.js e dello scenario torpex_palestra (shared/data/scenari/): provenienza
 * di ogni numero, integrita' della griglia, andata e ritorno fra nodi e piano, profondita' note in
 * punti reali, georeferenza della mappa del 1989, profilo del suono e strato, rumore e assorbimento,
 * unita' iniziali.
 *
 * I valori attesi nei punti reali vengono dai dati EMODnet ricampionati (tools/batimetria/scarica.py),
 * con tolleranze larghe: devono fallire se la griglia e' girata, traslata o letta male, non se cambia
 * di qualche metro a una nuova versione del DTM.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  Ambiente,
  SCENARI,
  FORMATO_SCENARIO,
  UNITA_SCENARIO,
  assorbimentoAinslieMcColm,
  caricaAmbiente,
  isSerie,
  rumoreCoates,
  validaScenario,
  velocitaSuonoMackenzie,
  visitaProvenienze,
} from '../ambiente.js';
import { chiaviFonte } from '../data/piattaforme.js';
import { distanza } from '../geo.js';

const DIR = new URL('../data/scenari/', import.meta.url);
const FONTI_MD = new URL('../../docs/ricerca/FONTI.md', import.meta.url);

const amb = await caricaAmbiente('torpex_palestra');
const v = amb.valori;
/** @type {any} */
const grezzi = JSON.parse(await readFile(new URL('torpex_palestra.json', DIR), 'utf8'));
const binario = await readFile(new URL(v.batimetria.file, DIR));

/**
 * @param {number} ottenuto
 * @param {number} atteso
 * @param {number} tolleranza assoluta
 * @param {string} [msg]
 */
function vicino(ottenuto, atteso, tolleranza, msg = '') {
  assert.ok(Math.abs(ottenuto - atteso) <= tolleranza, `${msg} atteso ${atteso} ± ${tolleranza}, ottenuto ${ottenuto}`);
}

/**
 * Fondale in un punto geografico.
 * @param {number} lat
 * @param {number} lon
 */
function fondaleGeo(lat, lon) {
  const p = amb.inPiano(lat, lon);
  return amb.fondale(p.x, p.y);
}

// ---------------------------------------------------------------------------
// Provenienza e formato
// ---------------------------------------------------------------------------

test('lo scenario e\' valido e ogni numero ha fonte e confidenza', () => {
  assert.deepEqual(SCENARI, ['torpex_palestra']);
  assert.equal(v.formato, FORMATO_SCENARIO);
  assert.deepEqual(validaScenario(grezzi), []);
  // Cammino indipendente dal validatore: i soli numeri nudi ammessi sono i campi del file binario.
  /** @type {string[]} */
  const nudi = [];
  /**
   * @param {unknown} n
   * @param {string} p
   */
  const cammina = (n, p) => {
    if (typeof n === 'number') nudi.push(p);
    else if (n && typeof n === 'object' && !('valore' in n) && !('serie' in n)) {
      for (const [k, f] of Object.entries(n)) cammina(f, p ? `${p}.${k}` : k);
    }
  };
  cammina(grezzi, '');
  assert.deepEqual(nudi.sort(), ['batimetria.byte', 'batimetria.colonne', 'batimetria.righe', 'propagazione.tabella.byte']);
  let voci = 0;
  visitaProvenienze(grezzi, (p, d) => {
    voci++;
    assert.ok(typeof d.fonte === 'string' && chiaviFonte(d.fonte).length > 0, `${p}: fonte`);
    assert.ok(['documentato', 'stimato', 'calcolato', 'nozionale'].includes(d.confidenza), `${p}: confidenza`);
    if (isSerie(d) || typeof d.valore === 'number') assert.ok(UNITA_SCENARIO.has(String(d.unita)), `${p}: unita'`);
  });
  assert.ok(voci > 100, `troppo poche voci con provenienza: ${voci}`);
});

test('il validatore rifiuta numeri nudi, fonti mancanti e unita\' ignote', () => {
  const copia = structuredClone(grezzi);
  copia.ambiente.strato.profondita = 21;
  copia.area.x0.fonte = 'nessuna';
  copia.ambiente.assorbimento.temperatura.unita = 'K';
  const errori = validaScenario(copia).join('\n');
  assert.match(errori, /ambiente\.strato\.profondita: numero senza provenienza/);
  assert.match(errori, /area\.x0: manca la fonte/);
  assert.match(errori, /temperatura: unita' «K»/);
  assert.throws(() => new Ambiente(copia, binario), /scenario non valido/);
});

test('ogni chiave di fonte esiste in docs/ricerca/FONTI.md; [CONO] da solo vale solo per «nozionale»', async () => {
  const testo = await readFile(FONTI_MD, 'utf8');
  const definite = new Set([...testo.matchAll(/^\| \[([^\]\s]+)\] \|/gm)].map((m) => m[1]));
  /** @type {string[]} */
  const mancanti = [];
  visitaProvenienze(grezzi, (p, d) => {
    const chiavi = chiaviFonte(d.fonte);
    for (const k of chiavi) if (!definite.has(k) || /-xxx$/.test(k)) mancanti.push(`${p}: [${k}]`);
    if (chiavi.every((k) => k === 'CONO' || k === 'CP-01')) assert.equal(d.confidenza, 'nozionale', `${p}: solo [CONO]`);
  });
  assert.deepEqual(mancanti, []);
});

test('i crediti riportano l\'attribuzione di EMODnet (CC BY 4.0) e le altre fonti dei dati', () => {
  const emod = v.crediti.find((c) => /EMODnet/.test(c.dati));
  assert.ok(emod, 'manca il credito EMODnet');
  assert.equal(emod.licenza, 'CC BY 4.0');
  assert.match(emod.testo, /EMODnet Bathymetry Consortium/);
  assert.match(emod.testo, /doi\.org\/10\.12770\/cf51df64/);
  for (const nome of ['ETOPO', 'World Ocean Atlas', 'NCEP', 'GLODAP']) {
    assert.ok(v.crediti.some((c) => c.dati.includes(nome)), `manca il credito ${nome}`);
  }
});

// ---------------------------------------------------------------------------
// Griglia
// ---------------------------------------------------------------------------

test('il file della batimetria e\' quello descritto nello scenario', () => {
  const b = v.batimetria;
  assert.equal(b.codifica, 'int16le');
  assert.equal(binario.length, b.colonne * b.righe * 2);
  assert.equal(binario.length, b.byte);
  assert.equal(createHash('sha256').update(binario).digest('hex'), b.sha256);
  assert.ok(binario.length < 400 * 1024, 'la batimetria deve restare di qualche centinaio di KB');
  // La griglia copre l'area esattamente, nodo sugli angoli.
  assert.equal(b.x_min, v.area.x0);
  assert.equal(b.y_max, v.area.y1);
  assert.equal(b.x_min + (b.colonne - 1) * b.passo, v.area.x1);
  assert.equal(b.y_max - (b.righe - 1) * b.passo, v.area.y0);
  assert.ok(b.passo >= 250 && b.passo <= 500);
  // Little-endian, riga per riga da nord: il primo nodo e' l'angolo nord-ovest.
  assert.equal(amb.nodo(0, 0), binario.readInt16LE(0));
  const k = 123 * b.colonne + 77;
  assert.equal(amb.nodo(123, 77), binario.readInt16LE(2 * k));
});

test('andata e ritorno: sui nodi il fondale e\' il valore del nodo, fra i nodi e\' bilineare', () => {
  const g = amb.griglia;
  for (const [i, j] of [[0, 0], [0, g.colonne - 1], [g.righe - 1, 0], [g.righe - 1, g.colonne - 1], [200, 200], [137, 251], [311, 42]]) {
    const p = amb.posizioneNodo(i, j);
    assert.equal(amb.fondale(p.x, p.y), amb.nodo(i, j), `nodo ${i},${j}`);
    // piano -> geografiche -> piano
    const geo = amb.inGeografiche(p.x, p.y);
    const q = amb.inPiano(geo.lat, geo.lon);
    vicino(q.x, p.x, 1e-6, 'x');
    vicino(q.y, p.y, 1e-6, 'y');
  }
  // Centro di una cella: media dei quattro nodi.
  const p = amb.posizioneNodo(150, 180);
  const atteso = (amb.nodo(150, 180) + amb.nodo(150, 181) + amb.nodo(151, 180) + amb.nodo(151, 181)) / 4;
  vicino(amb.fondale(p.x + g.passo / 2, p.y - g.passo / 2), atteso, 1e-9, 'centro cella');
  // Continuita': nessun salto attraversando il bordo di una cella.
  const a = amb.fondale(p.x + g.passo - 1e-6, p.y);
  const b = amb.fondale(p.x + g.passo + 1e-6, p.y);
  vicino(a, b, 1e-3, 'continuita\'');
  // Fuori dalla griglia: NaN, e non e' terra.
  assert.ok(Number.isNaN(amb.fondale(v.area.x1 + 1, 0)));
  assert.ok(Number.isNaN(amb.fondale(0, v.area.y0 - 1)));
  assert.equal(amb.terra(v.area.x1 + 1, 0), false);
  assert.ok(amb.dentro(0, 0) && !amb.dentro(v.area.x1 + 1, 0));
});

test('le lettrici fornite dal chiamante (percorsi relativi a shared/) caricano lo stesso scenario', async () => {
  /** @type {string[]} */
  const chiesti = [];
  const radice = new URL('../', import.meta.url);
  const altro = await caricaAmbiente('torpex_palestra', {
    leggiJson: async (p) => { chiesti.push(p); return JSON.parse(await readFile(new URL(p, radice), 'utf8')); },
    leggiByte: async (p) => { chiesti.push(p); return new Uint8Array(await readFile(new URL(p, radice))); },
  });
  assert.deepEqual(chiesti, ['data/scenari/torpex_palestra.json', 'data/scenari/torpex_palestra.batimetria.bin']);
  assert.equal(altro.fondale(1234, -5678), amb.fondale(1234, -5678));
  await assert.rejects(() => caricaAmbiente('../segreti'), /id di scenario non valido/);
});

// ---------------------------------------------------------------------------
// Profondita' note in punti reali
// ---------------------------------------------------------------------------

test('profondita\' note: canali profondi, banco, piattaforma', () => {
  // Soglia del Canale delle Faer Oer (Faroe Bank Channel), circa 840 m in letteratura; EMODnet 846 m.
  vicino(fondaleGeo(61.42, -8.33), 846, 40, 'soglia del Faroe Bank Channel');
  // Fianco del Canale Faer Oer-Shetland, all'angolo sud-est dell'area (EMODnet 859-868 m).
  assert.ok(fondaleGeo(60.95, -5.0) > 700, 'Canale Faer Oer-Shetland');
  // Banco delle Faer Oer (Faroe Bank): un banco isolato poco profondo in mezzo all'acqua profonda.
  const banco = fondaleGeo(61.0, -8.3);
  assert.ok(banco > 60 && banco < 200, `Faroe Bank ${banco}`);
  // Piattaforma intorno alle isole: a levante della punta nord di Suduroy e nel Nolsoyarfjordur.
  const est = fondaleGeo(61.70, -6.60);
  assert.ok(est > 30 && est < 150, `piattaforma a est di Suduroy ${est}`);
  const fjord = fondaleGeo(61.95, -6.70);
  assert.ok(fjord > 20 && fjord < 120, `Nolsoyarfjordur ${fjord}`);
  // Il fondale massimo dello scenario e' quello della griglia.
  let max = -Infinity;
  for (let k = 0; k < amb.griglia.nodi.length; k++) max = Math.max(max, amb.griglia.nodi[k]);
  assert.equal(max, v.batimetria.fondale_massimo);
});

test('terra sulle isole', () => {
  for (const [nome, lat, lon] of [
    ['Suduroy', 61.53, -6.85],
    ['Sandoy', 61.84, -6.78],
    ['Torshavn (Streymoy)', 62.0107, -6.7716],
    ['Klaksvik (Bordoy)', 62.226, -6.589],
  ]) {
    const p = amb.inPiano(/** @type {number} */ (lat), /** @type {number} */ (lon));
    assert.ok(amb.terra(p.x, p.y), `${nome} dovrebbe essere terra (${amb.fondale(p.x, p.y)})`);
  }
  // Le cime dell'arcipelago (Slaettaratindur 880 m su Eysturoy, Kuvingafjall 830 m su Kunoy, Villingadalsfjall
  // 841 m su Vidoy) sono tutte nelle isole del nord: la media della cella di 500 m resta sotto le cime.
  let min = Infinity;
  let kmin = 0;
  for (let k = 0; k < amb.griglia.nodi.length; k++) if (amb.griglia.nodi[k] < min) { min = amb.griglia.nodi[k]; kmin = k; }
  assert.ok(min < -600 && min > -900, `quota massima ${-min} m`);
  const p = amb.posizioneNodo(Math.floor(kmin / amb.griglia.colonne), kmin % amb.griglia.colonne);
  const g = amb.inGeografiche(p.x, p.y);
  assert.ok(g.lat > 62.2 && g.lat < 62.4 && g.lon > -7.1 && g.lon < -6.5, `cima in ${g.lat}, ${g.lon}`);
  // Le terre emerse sono poche: l'arcipelago in un quadrato di 200 km.
  const frazione = amb.griglia.nodi.filter((n) => n <= 0).length / amb.griglia.nodi.length;
  assert.ok(frazione > 0.02 && frazione < 0.06, `frazione di terra ${frazione}`);
});

// ---------------------------------------------------------------------------
// Georeferenza e unita' del 1989
// ---------------------------------------------------------------------------

test('georeferenza: le coordinate di script convertite sono quelle scritte nello scenario', () => {
  const g = v.georeferenza_1989;
  assert.ok(g.scarto_quadratico_medio > 500 && g.scarto_quadratico_medio < 4000, `scarto ${g.scarto_quadratico_medio}`);
  // Scala: circa 20 m per unita' di script, non i 61,7 m dei «2 secondi d'arco» mostrati dal gioco.
  const sx = Math.hypot(g.coefficienti.a, g.coefficienti.d);
  const sy = Math.hypot(g.coefficienti.b, g.coefficienti.e);
  assert.ok(sx > 15 && sx < 25 && sy > 15 && sy < 25, `scale ${sx}, ${sy}`);
  // Quasi nessuna rotazione: nord del gioco = nord vero entro 5 gradi.
  assert.ok(Math.abs(Math.atan2(g.coefficienti.d, g.coefficienti.a)) < (5 * Math.PI) / 180);
  /** @type {Array<{x: number, y: number, script_1989?: {X: number, Y: number}}>} */
  const conScript = [...v.navi, ...v.navi.flatMap((n) => n.waypoint), ...v.biologici, ...v.partenze_1989];
  let n = 0;
  for (const u of conScript) {
    if (!u.script_1989) continue;
    const p = amb.daScript1989(u.script_1989.X, u.script_1989.Y);
    vicino(u.x, p.x, 1, 'x');
    vicino(u.y, p.y, 1, 'y');
    n++;
  }
  assert.ok(n >= 8, `posizioni del 1989 controllate: ${n}`);
});

test('i tre Forrest Sherman di TORPEX \'89 partono e arrivano in acqua, a 10 nodi verso nord-ovest', () => {
  const dd = v.navi.filter((n) => n.classe === 'cacciatorpediniere');
  assert.equal(dd.length, 3);
  for (const n of dd) {
    assert.ok(n.script_1989, `${n.id}: manca la posizione dello script`);
    assert.equal(n.velocita, 10);
    assert.equal(n.al_termine, 'ferma');
    const punti = [{ x: n.x, y: n.y }, ...n.waypoint];
    for (const p of punti) {
      assert.ok(amb.fondale(p.x, p.y) > 20, `${n.id}: fondale ${amb.fondale(p.x, p.y)} in ${p.x}, ${p.y}`);
      assert.ok(amb.dentro(p.x, p.y));
    }
    // Rotta per nord-ovest («making their way northwest», ordini di TORPEX '89).
    assert.ok(n.rotta > 290 && n.rotta < 340, `${n.id}: rotta ${n.rotta}`);
    // Tutto il tratto e' in acqua.
    for (let t = 0; t <= 1; t += 0.01) {
      const x = punti[0].x + (punti[1].x - punti[0].x) * t;
      const y = punti[0].y + (punti[1].y - punti[0].y) * t;
      assert.ok(!amb.terra(x, y), `${n.id}: la rotta tocca terra a t = ${t.toFixed(2)}`);
    }
  }
  // Partono a sud del waypoint comune, vicino alla punta nord di Suduroy.
  for (const n of dd) {
    const g = amb.inGeografiche(n.x, n.y);
    assert.ok(g.lat > 61.55 && g.lat < 61.72 && g.lon > -7.0 && g.lon < -6.7, `${n.id}: ${g.lat}, ${g.lon}`);
  }
});

test('partenze dei 688: in acqua profonda, distanti fra loro, dentro l\'area', () => {
  const p = v.partenze;
  assert.ok(p.length >= 2 && p.length <= 4);
  let minima = Infinity;
  for (let i = 0; i < p.length; i++) {
    assert.ok(amb.fondale(p[i].x, p[i].y) >= 110, `${p[i].id}: fondale ${amb.fondale(p[i].x, p[i].y)}`);
    assert.ok(amb.dentro(p[i].x, p[i].y));
    assert.ok(p[i].quota > 0 && p[i].quota < amb.fondale(p[i].x, p[i].y) - 30);
    for (let j = i + 1; j < p.length; j++) minima = Math.min(minima, distanza(p[i], p[j]));
  }
  vicino(minima, v.distanza_minima_partenze, 1);
  // Fuori dalla portata reciproca di due battelli silenziosi (poche migliaia di iarde, PROGETTO §5.12),
  // ma non cosi' lontani da non incontrarsi.
  assert.ok(minima > 10_000 && minima < 30_000, `distanza minima ${minima}`);
  // Le partenze del 1989 sono documentate per confronto (e cadono contro la costa).
  assert.equal(v.partenze_1989.length, 3);
});

test('mercantile e biologici in acqua, rotte del mercantile tutte in mare', () => {
  const merc = v.navi.filter((n) => n.classe === 'mercantile');
  assert.equal(merc.length, 1);
  const m = merc[0];
  const punti = [{ x: m.x, y: m.y }, ...m.waypoint, { x: m.x, y: m.y }];
  for (let k = 0; k + 1 < punti.length; k++) {
    for (let t = 0; t <= 1; t += 0.005) {
      const x = punti[k].x + (punti[k + 1].x - punti[k].x) * t;
      const y = punti[k].y + (punti[k + 1].y - punti[k].y) * t;
      assert.ok(amb.fondale(x, y) > 10, `mercantile: ${amb.fondale(x, y)} m in ${x}, ${y}`);
    }
  }
  assert.ok(v.biologici.length >= 2);
  for (const b of v.biologici) {
    assert.ok(amb.fondale(b.x, b.y) > b.quota, `${b.id}: sotto il fondale`);
  }
  assert.match(v.note.join(' '), /Seahawk/);
  assert.match(v.note.join(' '), /Alfa/);
});

// ---------------------------------------------------------------------------
// Profilo del suono e strato
// ---------------------------------------------------------------------------

test('profilo: quote crescenti fino al fondale massimo, velocita\' di Mackenzie sui T e S del file', () => {
  const p = v.ambiente.profilo;
  assert.equal(p.quota[0], 0);
  for (let i = 1; i < p.quota.length; i++) assert.ok(p.quota[i] > p.quota[i - 1]);
  assert.ok(p.quota[p.quota.length - 1] >= v.batimetria.fondale_massimo, 'il profilo deve coprire tutta l\'acqua');
  for (let i = 0; i < p.quota.length; i++) {
    vicino(p.velocita_suono[i], velocitaSuonoMackenzie(p.temperatura[i], p.salinita[i], p.quota[i]), 0.006, `c a ${p.quota[i]} m`);
    assert.ok(p.velocita_suono[i] > 1440 && p.velocita_suono[i] < 1520);
    assert.ok(p.salinita[i] > 34.5 && p.salinita[i] < 35.6);
    // sui livelli l'interpolazione restituisce il profilo
    vicino(amb.velocitaSuono(p.quota[i]), p.velocita_suono[i], 1e-9);
  }
  // Estate: acqua di superficie piu' calda, temperatura decrescente nei primi 200 m.
  for (let i = 1; p.quota[i] <= 200; i++) assert.ok(p.temperatura[i] <= p.temperatura[i - 1] + 0.02, `T a ${p.quota[i]} m`);
  assert.ok(p.temperatura[0] > 9 && p.temperatura[0] < 13, `SST ${p.temperatura[0]}`);
  // Fuori dal profilo: sopra la superficie vale la superficie, sotto prosegue senza salti.
  assert.equal(amb.velocitaSuono(-5), p.velocita_suono[0]);
  const ultimo = p.quota[p.quota.length - 1];
  vicino(amb.velocitaSuono(ultimo + 1), amb.velocitaSuono(ultimo), 0.1);
  // Fra due livelli la velocita' sta fra i due valori.
  const c = amb.velocitaSuono(33);
  const i = p.quota.findIndex((q) => q > 33);
  assert.ok(c <= Math.max(p.velocita_suono[i - 1], p.velocita_suono[i]) && c >= Math.min(p.velocita_suono[i - 1], p.velocita_suono[i]));
});

test('strato: sottile, con un salto di velocita\' sotto e una perdita coerente con la regola', () => {
  const s = amb.strato(0, 0);
  const d = v.ambiente.strato;
  assert.equal(s.profondita, d.profondita);
  assert.equal(s.quota, d.profondita);
  assert.ok(s.profondita > 5 && s.profondita < 60, `strato a ${s.profondita} m`);
  // Sotto lo strato il suono rallenta (gradiente negativo): e' cio' che piega i raggi verso il basso.
  assert.ok(amb.velocitaSuono(s.profondita) > amb.velocitaSuono(d.base_termoclina));
  vicino(d.salto_velocita, amb.velocitaSuono(s.profondita) - amb.velocitaSuono(d.base_termoclina), 0.02, 'salto');
  // La regola nozionale: 3 dB per m/s, al massimo 15 dB (05_acustica.md §5.1).
  vicino(s.perdita, Math.min(15, 3 * d.salto_velocita), 0.06, 'perdita');
  assert.ok(s.perdita >= 0 && s.perdita <= 15);
  assert.ok(s.perdita >= 6, 'lo strato estivo deve contare nella prova di F1');
  // Un 688 alla quota automatica (150 ft, 45,7 m) e' sotto lo strato, a quota periscopica e' dentro.
  assert.ok(45.72 > s.profondita && 18 < s.profondita);
  const prov = amb.provenienza('ambiente.strato.perdita');
  assert.equal(prov?.confidenza, 'nozionale');
});

// ---------------------------------------------------------------------------
// Rumore e assorbimento
// ---------------------------------------------------------------------------

test('rumore ambiente: la tabella del file e le formule danno lo stesso numero', () => {
  const r = v.ambiente.rumore;
  const bande = v.ambiente.assorbimento.bande.map((b) => b.frequenza);
  assert.equal(r.modello, 'coates');
  assert.equal(r.tabella.length, v.ambiente.mare.vento_per_stato.length);
  r.tabella.forEach((riga, stato) => {
    riga.forEach((nl, k) => vicino(amb.rumoreAmbiente(bande[k], stato), nl, 0.051, `stato ${stato}, ${bande[k]} Hz`));
  });
  // Lo stato predefinito vale quando non si passa lo stato del mare.
  assert.equal(amb.rumoreAmbiente(1000), amb.rumoreAmbiente(1000, amb.statoMare));
  assert.equal(amb.statoMare, 3);
  // Piu' mare, piu' rumore (a 1 kHz domina il vento); sopra 1 kHz il rumore cala con la frequenza.
  for (let s = 1; s <= 6; s++) assert.ok(amb.rumoreAmbiente(1000, s) > amb.rumoreAmbiente(1000, s - 1));
  assert.ok(amb.rumoreAmbiente(3500) < amb.rumoreAmbiente(1000));
  // Stato frazionario: fra i due vicini.
  const meta = amb.rumoreAmbiente(1000, 2.5);
  assert.ok(meta > amb.rumoreAmbiente(1000, 2) && meta < amb.rumoreAmbiente(1000, 3));
  // Ordine di grandezza di 05_acustica.md §3.2: s = 0,5 e vento 5 m/s danno 61,0 dB a 1 kHz.
  vicino(rumoreCoates(1000, 0.5, 5), 61.0, 0.1, 'Coates');
});

test('assorbimento: tabella per banda, formula di Ainslie & McColm, ordini di grandezza', () => {
  const a = v.ambiente.assorbimento;
  assert.equal(a.modello, 'ainslie-mccolm');
  let prima = 0;
  for (const b of a.bande) {
    const alfa = amb.assorbimento(b.frequenza);
    vicino(alfa, b.alfa, Math.max(1e-5, 1e-3 * b.alfa), `${b.frequenza} Hz`);
    assert.ok(alfa > prima, 'l\'assorbimento cresce con la frequenza');
    prima = alfa;
  }
  // La tabella di 05_acustica.md §2.2 (4 °C, S 35, pH 8; calcolata a 100 m): 0,064 dB/km a 1 kHz, 0,224 a
  // 3,5 kHz, 1,154 a 10 kHz, 7,65 a 30 kHz.
  vicino(assorbimentoAinslieMcColm(1000, 4, 35, 8, 0.1), 0.064, 0.0005);
  vicino(assorbimentoAinslieMcColm(3500, 4, 35, 8, 0.1), 0.224, 0.0005);
  vicino(assorbimentoAinslieMcColm(10000, 4, 35, 8, 0.1), 1.154, 0.0005);
  vicino(assorbimentoAinslieMcColm(30000, 4, 35, 8, 0.1), 7.65, 0.005);
  // In quest'acqua (circa 9 °C): bassa frequenza quasi trasparente, alta frequenza assorbita.
  assert.ok(amb.assorbimento(300) < 0.02);
  assert.ok(amb.assorbimento(25000) > 3);
});

// ---------------------------------------------------------------------------
// Propagazione (F2): il blocco delle tabelle e le classi di fondale
// ---------------------------------------------------------------------------

test('propagazione: il file delle tabelle e\' quello dello scenario, le classi coprono il mare', async () => {
  const p = /** @type {import('../ambiente.js').ValoriPropagazione} */ (v.propagazione);
  assert.ok(p, 'manca il blocco propagazione (python3 tools/acustica/tabelle.py)');
  assert.equal(p.formato, 'termoclino-tl/1');
  const byte = await readFile(new URL(p.tabella.file, DIR));
  assert.equal(byte.length, p.tabella.byte);
  assert.equal(createHash('sha256').update(byte).digest('hex'), p.tabella.sha256);
  assert.ok(byte.length < 5 * 1024 * 1024, 'le tabelle restano sotto i 5 MB');
  // classi di fondale crescenti, ciascuna con un fondo descritto e un profilo; le aree fanno il 100 %
  let prima = 0;
  let area = 0;
  for (const r of p.regioni) {
    assert.ok(r.fondale > prima, r.id);
    prima = r.fondale;
    assert.ok(r.fondo in p.fondi, r.id);
    assert.ok(['rimescolato', 'stratificato'].includes(r.profilo), r.id);
    area += r.area;
  }
  vicino(area, 100, 0.5, 'aree delle classi');
  assert.ok((p.regioni.at(-1)?.fondale ?? 0) > 0.8 * v.batimetria.fondale_massimo, 'la classe piu\' profonda copre i canali');
  // dentro il fronte di marea l'acqua e' rimescolata, fuori stratificata (Larsen et al. 2009)
  assert.equal(p.regioni[0].profilo, 'rimescolato');
  assert.equal(p.regioni.at(-1)?.profilo, 'stratificato');
  // le quote cominciano vicino alla superficie e sono crescenti; le bande dei sensori ci sono
  assert.ok(p.quote[0] <= 5 && p.quote.every((q, i) => i === 0 || q > p.quote[i - 1]));
  for (const id of ['sfera', 'towed', 'f50', 'f300', 'f3500']) assert.ok(p.bande.some((b) => b.id === id), id);
  for (const b of p.bande) vicino(b.alfa, amb.assorbimento(b.centro), Math.max(1e-5, 1e-4 * b.alfa), b.id);
});

test('regioneAcustica: canale, piattaforma e terra nei punti noti', () => {
  // soglia del Canale delle Faer Oer (~846 m): la classe del canale
  const soglia = amb.inPiano(61.42, -8.33);
  assert.equal(amb.regioneAcustica(soglia.x, soglia.y)?.gruppo, 'canale');
  // le partenze della palestra stanno sulla piattaforma stratificata (180-220 m)
  for (const s of v.partenze) {
    const r = amb.regioneAcustica(s.x, s.y);
    assert.equal(r?.gruppo, 'piattaforma', s.id);
    assert.equal(r?.profilo, 'stratificato', s.id);
  }
  // sulla terra e fuori dalla griglia: nessuna classe
  const torshavn = amb.inPiano(62.01, -6.77);
  assert.equal(amb.regioneAcustica(torshavn.x, torshavn.y), null);
  assert.equal(amb.regioneAcustica(v.area.x1 + 1000, 0), null);
});
