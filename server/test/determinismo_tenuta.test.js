// @ts-check
/**
 * Determinismo (PROGETTO §4.3: stesso seme e stessi ordini → stesse
 * istantanee sullo stesso motore) e tenuta (un'ora di gioco a 32x con due
 * giocatori e i bersagli, senza errori e dentro un tempo massimo).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partita, raccoglitore, acustica, piattaforme } from './aiuto.js';
import { Palestra } from '../src/match/palestra.js';
import { creaRegistro } from '../src/registro.js';
import { Generatore } from '../../shared/rng.js';
import { MESSAGGIO_MAX_BYTE, codifica, decodificaSettori, validaOrdine } from '../../shared/protocol.js';

/** Ordini a passi fissi: [passo, giocatore, cosa, valore]. */
const COPIONE = /** @type {const} */ ([
  [50, 1, 'macchina', '2/3'], [80, 2, 'towed', 'fila'], [120, 1, 'quota', 150], [600, 2, 'rotta', 300],
  [900, 1, 'timone', -20], [1500, 1, 'rotta', 45], [2000, 2, 'macchina', 'std'], [2400, 1, 'towed', 'fila'],
  [3000, 2, 'quota', 'periscopica'], [6000, 1, 'macchina', 'full'], [9000, 2, 'quota', 'emersione'],
  [12000, 1, 'macchina', '1/3'], [15000, 2, 'quota', 100],
]);

/**
 * Gioca il copione e restituisce tutto cio' che e' uscito: istantanee e messaggi.
 * @param {number} seme
 */
function gioca(seme) {
  /** @type {string[]} */
  const righe = [];
  const registro = /** @type {any} */ ({ scrivi: (/** @type {unknown} */ o) => righe.push(JSON.stringify(o)), chiudi: async () => {} });
  const p = partita(seme, {}, registro);
  const a = raccoglitore();
  const b = raccoglitore();
  const ga = /** @type {NonNullable<ReturnType<typeof p.aggiungiGiocatore>>} */ (p.aggiungiGiocatore(1, 'A', a.invia));
  const gb = /** @type {NonNullable<ReturnType<typeof p.aggiungiGiocatore>>} */ (p.aggiungiGiocatore(2, 'B', b.invia));
  for (let passo = 0; passo < 18_000; passo++) {
    for (const [n, chi, cosa, valore] of COPIONE) {
      if (n !== passo) continue;
      const g = chi === 1 ? ga : gb;
      const v = validaOrdine({ cosa, valore }, g.contesto);
      assert.ok(v.ok);
      assert.equal(p.ordine(g.uid, v.ordine), null);
    }
    p.passo();
    if (passo % 25 === 0) p.inviaStati();
  }
  return { righe, a: JSON.stringify(a.messaggi), b: JSON.stringify(b.messaggi), na: a.messaggi.length };
}

test('determinismo: stesso seme e stessi ordini → stesse istantanee e stessi messaggi', () => {
  const uno = gioca(20261007);
  const due = gioca(20261007);
  assert.equal(uno.righe.length, due.righe.length);
  assert.ok(uno.righe.length > 1800, `istantanee: ${uno.righe.length}`);
  for (let i = 0; i < uno.righe.length; i++) assert.equal(uno.righe[i], due.righe[i], `istantanea ${i} diversa`);
  assert.equal(uno.a, due.a);
  assert.equal(uno.b, due.b);
  // un altro seme cambia i sensori (e quindi i messaggi), non la dinamica
  const altro = gioca(7);
  assert.notEqual(altro.a, uno.a);
});

test('tenuta: un\'ora di gioco a 32x, due giocatori e bersagli, senza errori', { timeout: 120_000 }, async (t) => {
  /** @type {string[]} */
  const avvisi = [];
  const registro = creaRegistro('warn', (r) => avvisi.push(r));
  const palestra = new Palestra({
    registro, acustica, piattaforme, dirIstantanee: null, guardiaSecondi: 300, seme: 99, orologio: false,
  });
  /** @type {Map<number, {messaggi: number, byte: number, sonar: number, stati: number, rapporti: number}>} */
  const conti = new Map();
  /** @param {number} uid */
  const canale = (uid) => {
    const c = { messaggi: 0, byte: 0, sonar: 0, stati: 0, rapporti: 0 };
    conti.set(uid, c);
    return {
      invia: (/** @type {string} */ tipo, /** @type {Record<string, unknown>} */ campi) => {
        const testo = codifica(tipo, campi);
        assert.ok(testo.length <= MESSAGGIO_MAX_BYTE, `${tipo} troppo grande: ${testo.length}`);
        c.messaggi++;
        c.byte += testo.length;
        if (tipo === 'sonar') {
          c.sonar++;
          assert.equal(decodificaSettori(/** @type {string} */ (campi.settori))?.length, 180);
        } else if (tipo === 'stato') {
          c.stati++;
          for (const k of ['x', 'y', 'z', 'rotta', 'velocita']) assert.ok(Number.isFinite(campi[k]), `${k} non finito`);
        } else if (tipo === 'rapporto') c.rapporti++;
      },
      revocato: (/** @type {string} */ motivo) => { assert.equal(motivo, 'partita_chiusa'); },
    };
  };
  const ca = canale(1);
  const cb = canale(2);
  assert.deepEqual(await palestra.entra(1, 'A', ca), { ok: true });
  assert.deepEqual(await palestra.entra(2, 'B', cb), { ok: true });
  const partita_ = /** @type {NonNullable<typeof palestra.partita>} */ (palestra.partita);
  partita_.scala = 32; // nelle prove si forza: in palestra con due giocatori la scala e' bloccata a 1
  const rng = new Generatore('tenuta');
  const ordini = [
    ['macchina', ['1/3', '2/3', 'std', 'full', 'flank', 'stop', 'rev']], ['rotta', [0, 45, 90, 135, 180, 225, 270, 315]],
    ['quota', [18, 45.7, 100, 150, 250, 'periscopica', 'emersione']], ['towed', ['fila', 'ritira']],
    ['timone', [-30, -10, 0, 10, 30]], ['timoni_o', [-10, 0, 10]],
  ];
  const t0 = performance.now();
  let tick = 0;
  while (partita_.ora < 3600) {
    if (tick % 40 === 0) {
      for (const [uid, c] of /** @type {const} */ ([[1, ca], [2, cb]])) {
        const [cosa, valori] = /** @type {[string, unknown[]]} */ (rng.scegli(ordini));
        const r = palestra.ordine(uid, c, { cosa, valore: rng.scegli(valori) });
        assert.ok(r.t === 'ricevuto' || r.campi.codice === 'ordine_rifiutato', JSON.stringify(r));
      }
    }
    palestra.tick(0.025);
    tick++;
  }
  const ms = performance.now() - t0;
  const passi = palestra.statistiche.passi;
  t.diagnostic(`1 h di gioco a 32x: ${tick} giri, ${passi} passi in ${ms.toFixed(0)} ms ` +
    `(${(passi / ms * 1000).toFixed(0)} passi/s, ${(ms / tick).toFixed(3)} ms/giro, massimo ${palestra.statistiche.msMassimoTick.toFixed(2)} ms); ` +
    `entita ${partita_.entita.size}; messaggi A ${JSON.stringify(conti.get(1))}`);
  assert.ok(passi >= 36_000);
  assert.equal(palestra.statistiche.persi, 0);
  assert.ok(ms < 30_000, `troppo lento: ${ms} ms`);
  for (const c of conti.values()) {
    assert.ok(c.sonar >= 3600, `fotogrammi: ${c.sonar}`);
    assert.ok(c.stati >= 4000);
  }
  assert.deepEqual(avvisi.filter((r) => !r.includes('passi_persi')), []);
  await palestra.chiudi();
});
