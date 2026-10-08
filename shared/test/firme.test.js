// @ts-check
/**
 * Prove delle firme (shared/data/firme/*.json) e dei blocchi di F2 delle
 * piattaforme: provenienza di ogni numero, chiavi di FONTI.md, coerenza (righe
 * dentro le velocita', sagome che esistono fra gli ENC originali, radar in
 * banda), biblioteca delle firme completa per le CLASSI del protocollo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FIRME, Firma, biblioteca, caricaFirme, validaFirma } from '../data/firme.js';
import { caricaTutte, chiaviFonte, visitaDati } from '../data/piattaforme.js';
import { CLASSI } from '../protocol.js';

const firme = await caricaFirme();
const piattaforme = await caricaTutte();
const FONTI_MD = new URL('../../docs/ricerca/FONTI.md', import.meta.url);
const ASSET_MD = new URL('../../docs/ASSET.md', import.meta.url);

test('ogni firma si carica, e ogni numero ha fonte e confidenza', async () => {
  assert.deepEqual([...firme.keys()].sort(), [...FIRME].sort());
  for (const id of FIRME) {
    const grezzi = JSON.parse(await readFile(new URL(`../data/firme/${id}.json`, import.meta.url), 'utf8'));
    assert.deepEqual(validaFirma(grezzi), [], id);
    assert.equal(grezzi.formato, 'termoclino-firma/1');
    assert.equal(grezzi.id, id);
  }
  assert.throws(() => new Firma({ formato: 'termoclino-firma/1', id: 'x', a: 3 }), TypeError);
  assert.equal(validaFirma({ formato: 'altro', id: 'x' }).length, 1);
});

test('ogni chiave di fonte delle firme esiste in FONTI.md; [CONO] da solo vale solo per «nozionale»', async () => {
  const testo = await readFile(FONTI_MD, 'utf8');
  const definite = new Set([...testo.matchAll(/^\| \[([^\]\s]+)\] \|/gm)].map((m) => m[1]));
  for (const [id, f] of firme) {
    /** @type {string[]} */
    const mancanti = [];
    visitaDati(f.grezzi, (percorso, dato) => {
      const chiavi = chiaviFonte(dato.fonte);
      for (const k of chiavi) if (!definite.has(k)) mancanti.push(`${percorso}: [${k}]`);
      if (chiavi.every((k) => k === 'CONO')) assert.equal(dato.confidenza, 'nozionale', `${id} ${percorso}`);
    });
    assert.deepEqual(mancanti, [], id);
  }
});

test('righe e pale: frequenze sensate, regimi dentro la velocita\' massima', () => {
  for (const id of ['forrest_sherman', 'mercantile_generico']) {
    const v = /** @type {any} */ (firme.get(id)).valori;
    const vmax = v.propulsione.velocita_max;
    for (const t of v.acustica.tonali) {
      assert.ok(t.frequenza > 10 && t.frequenza < 2000, `${id} ${t.nome}`);
      assert.ok(t.da_velocita < t.a_velocita && t.a_velocita <= vmax, `${id} ${t.nome}`);
    }
    for (const t of v.acustica.righe_giri) assert.ok(t.per_giro >= 1, `${id} ${t.nome}`);
    assert.ok(v.acustica.pale.modulazione_cavitante > v.acustica.pale.modulazione);
    assert.ok(v.propulsione.elica_pale >= 3 && v.propulsione.assi >= 1);
  }
  const ds = /** @type {any} */ (firme.get('forrest_sherman')).valori;
  assert.ok(ds.acustica.tonali.some((/** @type {any} */ t) => t.frequenza === 60), 'rete USN a 60 Hz [NSTM-320]');
  assert.equal(ds.propulsione.assi, 2);
  // Le righe di F2 delle piattaforme: le pompe del 688 cambiano regime, l'Alfa ha la rete a 400 Hz.
  for (const [id, p] of piattaforme) {
    const a = /** @type {any} */ (p.valori).acustica;
    assert.ok(a.pale && a.transitori && Array.isArray(a.righe_giri), `${id}: blocchi di F2`);
    for (const tipo of ['scafo', 'pompa', 'regime', 'meccanico', 'portello', 'emersione']) assert.ok(a.transitori[tipo], `${id}: transitorio ${tipo}`);
    for (const t of a.tonali) assert.equal(typeof t.tipo, 'string', `${id} ${t.nome}: tipo`);
  }
});

test('ottica: sagome fra gli ENC originali (docs/ASSET.md), altezze d\'albero plausibili', async () => {
  const asset = await readFile(ASSET_MD, 'utf8');
  for (const id of ['forrest_sherman', 'mercantile_generico']) {
    const o = /** @type {any} */ (firme.get(id)).valori.ottica;
    for (let i = 0; i <= 4; i++) assert.ok(asset.includes(`${o.sagoma}${i}.ENC`), `${id}: manca ${o.sagoma}${i}.ENC`);
    assert.ok(o.altezza_alberi > 10 && o.altezza_alberi < 60, id);
    assert.ok(o.bordo_libero > 2 && o.bordo_libero < o.altezza_alberi, id);
  }
});

test('radar: banda NATO coerente con la frequenza, ESM che li coprono', () => {
  /** @param {number} f Hz */
  const lettera = (f) => {
    const g = f / 1e9;
    return g < 0.25 ? 'A' : g < 0.5 ? 'B' : g < 1 ? 'C' : g < 2 ? 'D' : g < 3 ? 'E' : g < 4 ? 'F' : g < 6 ? 'G' : g < 8 ? 'H' : g < 10 ? 'I' : 'J';
  };
  /** @type {any[]} */
  const tutti = [];
  for (const f of firme.values()) for (const r of f.valori.emettitori ?? []) tutti.push(r);
  for (const p of piattaforme.values()) tutti.push(/** @type {any} */ (p.valori).sensori.radar);
  assert.ok(tutti.length >= 5);
  for (const r of tutti) {
    assert.equal(lettera(r.frequenza), r.banda, r.nome);
    for (const p of piattaforme.values()) {
      const esm = /** @type {any} */ (p.valori).sensori.esm;
      assert.ok(r.frequenza >= esm.banda_min && r.frequenza <= esm.banda_max, `${r.nome} fuori dalla banda dell'ESM`);
    }
  }
});

test('biblioteca: una voce per ogni classe del protocollo, solo dati di classe', () => {
  const b = biblioteca(piattaforme, firme);
  assert.deepEqual([...b.keys()].sort(), [...CLASSI].sort());
  const ds = /** @type {NonNullable<ReturnType<typeof b.get>>} */ (b.get('forrest_sherman'));
  assert.equal(ds.tipo, 'nave');
  assert.equal(ds.sagoma, 'FOREST');
  assert.equal(ds.altezza_alberi, 30);
  assert.deepEqual(ds.radar.map((r) => r.nome), ['AN/SPS-40', 'AN/SPS-10']);
  assert.equal(/** @type {any} */ (b.get('alfa')).righe.some((/** @type {any} */ r) => r.frequenza === 400), true);
  assert.equal(/** @type {any} */ (b.get('688')).pale, 7);
  assert.ok(/** @type {any} */ (b.get('biologico')).canto.f_max > 0);
  for (const v of b.values()) {
    for (const k of Object.keys(v)) assert.ok(!['x', 'y', 'z', 'rotta', 'velocita', 'id'].includes(k), `${v.classe}: ${k}`);
  }
});
