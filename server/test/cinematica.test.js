// @ts-check
/**
 * Dinamica del battello confrontata con i dati delle piattaforme e con i
 * modelli di riferimento di shared/data/SCHEMA.md §5: accelerazione,
 * diametro di accostata a varie velocita', timoni che vogliono abbrivio,
 * auto-quota, emersione d'emergenza, fondo, quote di collaudo e collasso,
 * timoniere, autopilota, telegrafo a percentuale, ufficiale di guardia.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battello, ordina, avanza, p688, palfa, AREA } from './aiuto.js';
import { ambienteProvvisorio } from '../src/sim/world/ambiente.js';
import { NODO_MS, differenzaAngolare } from '../../shared/units.js';
import { validaOrdine, contestoOrdini, MOTIVI_ORDINE } from '../../shared/protocol.js';

const d688 = p688.valori.dinamica;

/**
 * Il modello di riferimento della velocita' (SCHEMA §5) integrato a 0,1 s:
 * lo stesso di shared/test/piattaforme.test.js.
 * @param {number} ordine kt
 * @param {number} soglia kt
 */
function tempoRiferimento(ordine, soglia) {
  const { tau, max } = d688.accelerazione;
  let v = 0;
  let t = 0;
  while (v < soglia && t < 3600) {
    v += Math.min((ordine - v) / tau, max) * 0.1;
    t += 0.1;
  }
  return t;
}

test('accelerazione: il 688 insegue l\'ordine come il modello dei dati', () => {
  for (const soglia of [10, 20, 30]) {
    const b = battello({ velocita: 0 });
    ordina(b, 'macchina', 'flank');
    let t = null;
    avanza(b, 900, undefined, (s) => { if (t === null && b.velocita >= soglia) t = s; });
    assert.ok(t !== null);
    assert.ok(Math.abs(t - tempoRiferimento(32, soglia)) < 1, `0→${soglia} kt in ${t} s`);
  }
  // da 0 a 32 kt in circa 4 minuti (nota dei dati)
  const b = battello({ velocita: 0 });
  ordina(b, 'macchina', 'flank');
  avanza(b, 240);
  assert.ok(b.velocita > 31 && b.velocita <= 32, `dopo 4 minuti ${b.velocita}`);
});

test('decelerazione per sola resistenza e frenata con la macchina indietro', () => {
  const lenta = battello({ velocita: 20 });
  ordina(lenta, 'macchina', 'stop');
  avanza(lenta, 30);
  const rev = battello({ velocita: 20 });
  ordina(rev, 'macchina', 'rev');
  avanza(rev, 30);
  assert.ok(lenta.velocita > rev.velocita, 'indietro tutta frena di piu\'');
  assert.ok(20 - lenta.velocita <= d688.decelerazione.max * 30 + 1e-9);
  assert.ok(20 - rev.velocita <= d688.frenata_rev * 30 + 1e-9);
  avanza(rev, 300);
  assert.ok(Math.abs(rev.velocita - (-6)) < 0.2, `indietro a regime: ${rev.velocita}`);
});

test('accostata: a barra tutta il diametro e\' quello tattico a ogni velocita\'', () => {
  const D = d688.accostata.diametro_tattico;
  for (const ordine of ['1/3', '2/3', 'std', 'full', 'flank']) {
    const b = battello({ velocita: 0 });
    ordina(b, 'macchina', ordine);
    avanza(b, 900);
    ordina(b, 'timone', 30);
    avanza(b, 300); // regime: velocita' ridotta e accostata costante
    // diametro dalla traiettoria: estensione in x su un giro intero
    const periodo = 360 / Math.abs(b.omega);
    let xmin = Infinity;
    let xmax = -Infinity;
    avanza(b, periodo + 5, undefined, () => { xmin = Math.min(xmin, b.x); xmax = Math.max(xmax, b.x); });
    const diametro = xmax - xmin;
    assert.ok(Math.abs(diametro - D) / D < 0.03, `${ordine}: diametro ${diametro.toFixed(0)} m`);
    // velocita' angolare = v/R, sotto il tetto
    const atteso = Math.min(d688.accostata.velocita_angolare_max, (b.velocita * NODO_MS / (D / 2)) * 180 / Math.PI);
    assert.ok(Math.abs(b.omega - atteso) < 0.01);
    // in accostata la velocita' cala del 30 %
    const v0 = b.velocitaDiOrdine(ordine);
    assert.ok(Math.abs(b.velocita - v0 * (1 - d688.accostata.perdita_velocita)) < 0.3, `${ordine}: ${b.velocita}`);
  }
  // l'accostata e' piu' lenta a bassa velocita': a 5 kt molto meno di 1 °/s
  const lenta = battello({ velocita: 5 });
  ordina(lenta, 'macchina', '1/3');
  ordina(lenta, 'timone', 30);
  avanza(lenta, 120);
  assert.ok(lenta.omega < 0.5 && lenta.omega > 0.2);
});

test('timoniere: rotta ordinata raggiunta senza scavalcarla', () => {
  for (const [da, a] of [[0, 90], [90, 300], [10, 350], [180, 175]]) {
    const b = battello({ velocita: 10, rotta: da });
    ordina(b, 'macchina', '2/3');
    ordina(b, 'rotta', a);
    let peggiore = 0;
    const segno = Math.sign(differenzaAngolare(da, a));
    avanza(b, 400, undefined, () => {
      const oltre = -segno * differenzaAngolare(b.rotta, a);
      if (oltre > peggiore) peggiore = oltre;
    });
    assert.ok(Math.abs(differenzaAngolare(b.rotta, a)) < 0.2, `${da}→${a}: ${b.rotta}`);
    assert.ok(peggiore < 1, `${da}→${a}: scavalca di ${peggiore}°`);
  }
});

test('timoni orizzontali: senza abbrivio non fanno niente (correzione del 1989)', () => {
  const ferma = battello({ velocita: 0, z: 100 });
  ordina(ferma, 'macchina', 'stop');
  ordina(ferma, 'timoni_o', 20);
  avanza(ferma, 60);
  assert.ok(Math.abs(ferma.z - 100) < 0.1, `da fermi: ${ferma.z}`);
  const lenta = battello({ velocita: 2, z: 100 });
  ordina(lenta, 'macchina', 'stop');
  ordina(lenta, 'timoni_o', 20);
  avanza(lenta, 30);
  const inMoto = battello({ velocita: 10, z: 100 });
  ordina(inMoto, 'macchina', '2/3');
  ordina(inMoto, 'timoni_o', 20);
  avanza(inMoto, 30);
  assert.ok(inMoto.z - 100 > 10 * (lenta.z - 100), `10 kt: ${inMoto.z}, 2 kt: ${lenta.z}`);
  // assetto e velocita' verticale limitati
  avanza(inMoto, 60);
  assert.ok(inMoto.assetto <= d688.quota.assetto_max + 1e-9);
  assert.ok(inMoto.wz <= d688.quota.velocita_verticale_max + 1e-9);
});

test('auto-quota: raggiunge 150 m e la quota periscopica senza scavalcare', () => {
  for (const ordine of ['1/3', '2/3', 'full']) {
    const b = battello({ velocita: 0, z: 45.72 });
    ordina(b, 'macchina', ordine);
    avanza(b, 300);
    ordina(b, 'quota', 150);
    let zmax = 0;
    avanza(b, 600, undefined, () => { zmax = Math.max(zmax, b.z); });
    assert.ok(Math.abs(b.z - 150) < 0.5, `${ordine}: ${b.z}`);
    assert.ok(zmax < 153, `${ordine}: scavalca fino a ${zmax}`);
    ordina(b, 'quota', 'periscopica');
    let zmin = 999;
    avanza(b, 600, undefined, () => { zmin = Math.min(zmin, b.z); });
    assert.ok(Math.abs(b.z - p688.valori.profondita.periscopica) < 0.5);
    assert.ok(zmin > p688.valori.profondita.periscopica - 3, `${ordine}: risale fino a ${zmin}`);
  }
  // da fermi lavorano solo le casse d'assetto: 0,1 m/s al massimo
  const ferma = battello({ velocita: 0, z: 100 });
  ordina(ferma, 'macchina', 'stop');
  ordina(ferma, 'quota', 120);
  avanza(ferma, 60);
  assert.ok(ferma.z > 100.5 && ferma.z <= 100 + d688.quota.velocita_verticale_zavorra * 60 + 1e-6, `${ferma.z}`);
});

test('emersione d\'emergenza: sale anche da fermi, rumorosa, e si ferma in superficie', () => {
  const b = battello({ velocita: 0, z: 200 });
  ordina(b, 'quota', 'emersione');
  avanza(b, 1);
  assert.equal(b.transitorio, 1);
  let t = null;
  avanza(b, 120, undefined, (s) => { if (t === null && b.inSuperficie) t = s + 1; });
  assert.ok(t !== null && Math.abs(t - (200 - p688.valori.dimensioni.pescaggio) / d688.quota.velocita_emersione_emergenza) < 2, `${t}`);
  assert.equal(b.z, p688.valori.dimensioni.pescaggio);
  assert.equal(b.transitorio, 0);
  assert.ok(b.rapporti.some((r) => r.chiave === 'guardia.in_superficie'));
  // in superficie la velocita' e' limitata
  ordina(b, 'macchina', 'flank');
  avanza(b, 600);
  assert.ok(b.velocita <= d688.velocita_max_superficie + 0.01);
});

test('fondo: la chiglia non lo passa, l\'urto si conta una volta', () => {
  const amb = ambienteProvvisorio({ fondale: 200 });
  const b = battello({ velocita: 10, z: 150 });
  ordina(b, 'macchina', '2/3');
  ordina(b, 'quota', 300);
  let zmax = 0;
  avanza(b, 300, amb, () => { zmax = Math.max(zmax, b.z); });
  assert.ok(zmax <= 200);
  assert.equal(b.danni.urti_fondale, 1);
  assert.equal(b.rapporti.filter((r) => r.chiave === 'guardia.urto_fondale').length, 1);
  ordina(b, 'quota', 100);
  avanza(b, 300, amb);
  ordina(b, 'quota', 250);
  avanza(b, 300, amb);
  assert.equal(b.danni.urti_fondale, 2);
});

test('quote di collaudo e di collasso: in F1 solo segnalazioni', () => {
  const amb = ambienteProvvisorio({ fondale: 3000 });
  const b = battello({ velocita: 15, z: 250 });
  ordina(b, 'macchina', 'std');
  ordina(b, 'quota', 400);
  avanza(b, 600, amb);
  assert.equal(b.danni.oltre_collaudo, true);
  assert.equal(b.danni.collasso, false);
  b.z = 460;
  avanza(b, 1, amb);
  assert.equal(b.danni.collasso, true);
  assert.ok(b.rapporti.some((r) => r.chiave === 'guardia.collasso'));
});

test('autopilota: segue i waypoint, rallenta nelle accostate, poi tiene la rotta', () => {
  const b = battello({ velocita: 15, rotta: 0 });
  ordina(b, 'macchina', 'std');
  ordina(b, 'waypoint', { azione: 'aggiungi', x: 0, y: 4000 });
  ordina(b, 'waypoint', { azione: 'aggiungi', x: 4000, y: 4000 });
  ordina(b, 'waypoint', { azione: 'aggiungi', x: 4000, y: 0 });
  ordina(b, 'autopilota', true);
  let vMinInAccostata = Infinity;
  avanza(b, 2400, undefined, () => {
    if (b.autopilota.attivo && Math.abs(b.omega) > 0.3) vMinInAccostata = Math.min(vMinInAccostata, b.velocita);
  });
  const raggiunti = b.rapporti.filter((r) => r.chiave === 'navigazione.waypoint_raggiunto').map((r) => r.parametri.indice);
  assert.deepEqual(raggiunti, [0, 1, 2]);
  assert.ok(b.rapporti.some((r) => r.chiave === 'navigazione.ultimo_waypoint'));
  assert.equal(b.autopilota.attivo, false);
  assert.ok(b.rottaOrdinata !== null);
  // prima e durante le accostate di 90° rallenta verso i 2/3 (10 kt)
  assert.ok(vMinInAccostata < 11.5, `in accostata ${vMinInAccostata}`);
  // senza waypoint l'autopilota non parte; fuori area il waypoint e' rifiutato
  const c = battello();
  const v = validaOrdine({ cosa: 'autopilota', valore: true }, contestoOrdini(c.p));
  assert.equal(v.ok && c.ordina(v.ordine, AREA), MOTIVI_ORDINE.NESSUN_WAYPOINT);
  const w = validaOrdine({ cosa: 'waypoint', valore: { azione: 'aggiungi', x: 9e5, y: 0 } });
  assert.equal(w.ok && c.ordina(w.ordine, { x0: -1000, y0: -1000, x1: 1000, y1: 1000 }), MOTIVI_ORDINE.FUORI_AREA);
  for (let i = 0; i < 9; i++) ordina(c, 'waypoint', { azione: 'aggiungi', x: i, y: i });
  const decimo = validaOrdine({ cosa: 'waypoint', valore: { azione: 'aggiungi', x: 1, y: 1 } });
  assert.equal(decimo.ok && c.ordina(decimo.ordine, AREA), MOTIVI_ORDINE.TROPPI_WAYPOINT);
  const togli = validaOrdine({ cosa: 'waypoint', valore: { azione: 'togli', indice: 8 } });
  assert.equal(togli.ok && c.ordina(togli.ordine, AREA), null);
  assert.equal(c.autopilota.waypoint.length, 8);
});

test('ufficiale di guardia: tiene rotta, velocita\' e quota', () => {
  const b = battello({ velocita: 10, z: 120, rotta: 45 });
  ordina(b, 'macchina', '2/3');
  ordina(b, 'timone', 10);
  ordina(b, 'timoni_o', 5);
  avanza(b, 20);
  b.prendiGuardia();
  const rotta = b.rottaOrdinata;
  const quota = b.quotaOrdinata;
  avanza(b, 600);
  assert.ok(rotta !== null && Math.abs(differenzaAngolare(b.rotta, rotta)) < 0.5);
  assert.ok(quota !== null && Math.abs(b.z - quota) < 1);
  assert.ok(Math.abs(b.velocita - 10) < 0.1);
});

test('telegrafo a percentuale dell\'Alfa: tacche e interpolazione', () => {
  const a = battello({ piattaforma: 'alfa', velocita: 0 });
  const om = palfa.valori.dinamica.ordini_macchina;
  for (const t of om) assert.ok(Math.abs(a.velocitaDiOrdine(/** @type {number} */ (t.percentuale)) - t.velocita) < 1e-9);
  assert.ok(Math.abs(a.velocitaDiOrdine(37.5) - (9.3 + 18.6) / 2) < 1e-9);
  ordina(a, 'macchina', 110);
  avanza(a, 60);
  assert.ok(a.velocita > 39, `l'Alfa arriva a ~40 kt in un minuto: ${a.velocita}`);
  // l'Alfa non ha l'antenna rimorchiata
  const v = validaOrdine({ cosa: 'towed', valore: 'fila' });
  assert.equal(v.ok && a.ordina(v.ordine, AREA), MOTIVI_ORDINE.SENZA_TOWED);
});
