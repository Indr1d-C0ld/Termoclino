// @ts-check
/**
 * Prove dei dati di piattaforma (shared/data/piattaforme/*.json) e del loro
 * caricatore: provenienza di ogni numero, chiavi di fonte esistenti in
 * docs/ricerca/FONTI.md, completezza per F1, coerenza fisica.
 *
 * I modelli usati qui (cavitazione, rumore irradiato, accostata, velocita',
 * errore di rilevamento) sono i "modelli di riferimento" descritti in
 * shared/data/SCHEMA.md: servono a verificare che i numeri, letti come lo
 * schema dice, diano i comportamenti attesi da PROGETTO e dalla ricerca.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PIATTAFORME,
  CONFIDENZE,
  UNITA,
  Piattaforma,
  caricaPiattaforma,
  caricaTutte,
  chiaviFonte,
  isDato,
  soloValori,
  validaPiattaforma,
  visitaDati,
} from '../data/piattaforme.js';
import { nodiInMs, radiantiInGradi } from '../units.js';

const DIR_DATI = new URL('../data/piattaforme/', import.meta.url);
const FONTI_MD = new URL('../../docs/ricerca/FONTI.md', import.meta.url);

/** @type {Map<string, any>} file grezzi */
const grezzi = new Map();
for (const id of PIATTAFORME) {
  grezzi.set(id, JSON.parse(await readFile(new URL(`${id}.json`, DIR_DATI), 'utf8')));
}
const tutte = await caricaTutte();
const p688 = /** @type {Piattaforma} */ (tutte.get('688'));
const alfa = /** @type {Piattaforma} */ (tutte.get('alfa'));
const v688 = p688.valori;
const valfa = alfa.valori;

/**
 * Valore a un percorso puntato.
 * @param {unknown} radice
 * @param {string} percorso
 * @returns {unknown}
 */
function a(radice, percorso) {
  /** @type {any} */
  let n = radice;
  for (const k of percorso.split('.')) {
    if (n === null || typeof n !== 'object' || !(k in n)) return undefined;
    n = n[k];
  }
  return n;
}

// ---------------------------------------------------------------------------
// Modelli di riferimento (SCHEMA.md)
// ---------------------------------------------------------------------------

/**
 * Velocita' d'innesco della cavitazione a una quota (pressione assoluta).
 * @param {{velocita_rif: number, quota_rif: number}} c
 * @param {number} quota metri
 */
function velocitaCavitazione(c, quota) {
  return c.velocita_rif * Math.sqrt((quota + 10.1) / (c.quota_rif + 10.1));
}

/**
 * Livello irradiato a banda larga relativo al 688I a 5 kt (dB), con la
 * cavitazione.
 * @param {import('../data/piattaforme.js').ValoriPiattaforma} p
 * @param {number} v kt
 * @param {number} quota m
 */
function livelloIrradiato(p, v, quota) {
  const r = p.acustica.rumore_irradiato;
  let sl =
    r.gradino_sl0 +
    r.pendenza * Math.log10(Math.max(v, r.velocita_min) / r.velocita_rif) +
    r.pendenza_extra * Math.max(0, v - r.soglia_pendenza_extra);
  if (v > velocitaCavitazione(p.acustica.cavitazione, quota)) sl += p.acustica.cavitazione.salto;
  return sl;
}

/**
 * Tempo per invertire la rotta a barra tutta partendo dalla velocita' v.
 * @param {import('../data/piattaforme.js').ValoriPiattaforma} p
 * @param {number} v kt
 * @returns {number} secondi
 */
function tempoInversione(p, v) {
  const acc = p.dinamica.accostata;
  const vEff = nodiInMs(v * (1 - acc.perdita_velocita));
  const omega = Math.min(acc.velocita_angolare_max, radiantiInGradi(vEff / (acc.diametro_tattico / 2)));
  return 180 / omega + acc.tempo_risposta;
}

/**
 * Tempo per passare da `da` a `soglia` kt con l'ordine `a` kt (passo 0,1 s).
 * @param {import('../data/piattaforme.js').ValoriPiattaforma} p
 * @param {number} da
 * @param {number} ordine
 * @param {number} soglia
 * @returns {number} secondi
 */
function tempoAccelerazione(p, da, ordine, soglia) {
  const { tau, max } = p.dinamica.accelerazione;
  let v = da;
  let t = 0;
  while (v < soglia && t < 3600) {
    v += Math.min((ordine - v) / tau, max) * 0.1;
    t += 0.1;
  }
  return t;
}

/**
 * Errore di rilevamento armonizzato R1.
 * @param {{sigma_min?: number, coefficiente_sigma?: number, fascio_3db?: number}} s
 * @param {number} se eccesso di segnale, dB
 */
function sigma(s, se) {
  return Math.max(
    /** @type {number} */ (s.sigma_min),
    /** @type {number} */ (s.coefficiente_sigma) * /** @type {number} */ (s.fascio_3db) * 10 ** (-se / 20),
  );
}

// ---------------------------------------------------------------------------
// Provenienza
// ---------------------------------------------------------------------------

test('ogni numero ha fonte e confidenza (anche camminando il JSON grezzo)', () => {
  for (const [id, g] of grezzi) {
    assert.deepEqual(validaPiattaforma(g), [], `${id}: il validatore trova errori`);
    /** @type {string[]} */
    const nudi = [];
    /**
     * @param {unknown} n
     * @param {string} percorso
     */
    const cammina = (n, percorso) => {
      if (typeof n === 'number') nudi.push(percorso);
      else if (isDato(n)) {
        assert.ok(typeof n.fonte === 'string' && n.fonte.length > 0, `${id} ${percorso}: fonte`);
        assert.ok(CONFIDENZE.includes(n.confidenza), `${id} ${percorso}: confidenza`);
        if (typeof n.valore === 'number') assert.ok(UNITA.has(/** @type {string} */ (n.unita)), `${id} ${percorso}: unita'`);
      } else if (n !== null && typeof n === 'object') {
        for (const [k, f] of Object.entries(n)) cammina(f, `${percorso}.${k}`);
      }
    };
    cammina(g, id);
    assert.deepEqual(nudi, [], `${id}: numeri senza provenienza`);
  }
});

test('il validatore rifiuta i numeri nudi e le provenienze incomplete', () => {
  const base = { formato: 'termoclino-piattaforma/1', id: 'prova' };
  assert.deepEqual(validaPiattaforma({ ...base, a: { valore: 1, unita: 'm', fonte: '[FAS-688]', confidenza: 'stimato' } }), []);
  assert.equal(validaPiattaforma({ ...base, a: 3 }).length, 1);
  assert.equal(validaPiattaforma({ ...base, a: { valore: 1, unita: 'm', fonte: 'FAS', confidenza: 'stimato' } }).length, 1);
  assert.equal(validaPiattaforma({ ...base, a: { valore: 1, unita: 'm', fonte: '[X]', confidenza: 'certo' } }).length, 1);
  assert.equal(validaPiattaforma({ ...base, a: { valore: 1, unita: 'ft', fonte: '[X]', confidenza: 'stimato' } }).length, 1);
  assert.equal(validaPiattaforma({ ...base, a: { valore: 9, unita: 'm', fonte: '[X]', confidenza: 'stimato', intervallo: [1, 2] } }).length, 1);
  assert.equal(validaPiattaforma({ ...base, a: { valore: true, unita: 'm', fonte: '[X]', confidenza: 'stimato' } }).length, 1);
  assert.equal(validaPiattaforma({ ...base, a: { valore: 1, unita: 'm', fonte: '[X]', confidenza: 'stimato', extra: 2 } }).length, 1);
  assert.equal(validaPiattaforma({ ...base, a: { b: [1, { valore: 2, fonte: '[X]', confidenza: 'stimato' }] } }).length, 2);
  assert.equal(validaPiattaforma({ formato: 'altro', id: 'x' }).length, 1);
  assert.throws(() => new Piattaforma({ ...base, a: 3 }), TypeError);
});

test('ogni chiave di fonte esiste in docs/ricerca/FONTI.md', async () => {
  const testo = await readFile(FONTI_MD, 'utf8');
  // Indice delle chiavi in fondo a FONTI.md: righe "| [CHIAVE] | Parte | ...".
  const definite = new Set([...testo.matchAll(/^\| \[([^\]\s]+)\] \|/gm)].map((m) => m[1]));
  assert.ok(definite.size >= 200, `indice delle chiavi troppo corto: ${definite.size}`);
  for (const [id, g] of grezzi) {
    /** @type {string[]} */
    const mancanti = [];
    visitaDati(g, (percorso, dato) => {
      for (const chiave of chiaviFonte(dato.fonte)) {
        if (!definite.has(chiave) || /-xxx$/.test(chiave)) mancanti.push(`${percorso}: [${chiave}]`);
      }
    });
    assert.deepEqual(mancanti, [], `${id}: chiavi assenti da FONTI.md`);
  }
});

test('la conoscenza pregressa da sola non basta per "documentato" o "calcolato"', () => {
  for (const [id, g] of grezzi) {
    visitaDati(g, (percorso, dato) => {
      const chiavi = chiaviFonte(dato.fonte);
      if (chiavi.every((k) => k === 'CONO' || k === 'CP-01')) {
        assert.equal(dato.confidenza, 'nozionale', `${id} ${percorso}: solo [CONO] ma «${dato.confidenza}»`);
      }
    });
  }
});

test('chiaviFonte legge anche le pagine', () => {
  assert.deepEqual(chiaviFonte('[CFW86 p.618–619] [FAS-688]'), ['CFW86', 'FAS-688']);
  assert.deepEqual(chiaviFonte('[MAN-688 pp. 60–61]'), ['MAN-688']);
  assert.deepEqual(chiaviFonte('nessuna'), []);
});

// ---------------------------------------------------------------------------
// Caricatore
// ---------------------------------------------------------------------------

test('caricatore: valori semplici, provenienza, congelamento', async () => {
  assert.deepEqual([...tutte.keys()].sort(), ['688', 'alfa']);
  const p = await caricaPiattaforma('688');
  assert.equal(p.valori.dinamica.velocita_max, 32);
  const prov = p.provenienza('dinamica.velocita_max');
  assert.equal(prov?.unita, 'kt');
  assert.equal(prov?.confidenza, 'stimato');
  assert.equal(p.provenienza('acustica.tonali.0.frequenza')?.valore, 60);
  assert.equal(p.provenienza('non.esiste'), undefined);
  assert.ok(Object.isFrozen(p.valori.dinamica), 'valori congelati');
  assert.throws(() => {
    /** @type {any} */ (p.valori.dinamica).velocita_max = 99;
  }, TypeError);
  assert.deepEqual(soloValori(grezzi.get('688')), p.valori);
  assert.ok(p.dati().length > 100);
  await assert.rejects(() => caricaPiattaforma('akula'), RangeError);
});

test('completezza per F1: i campi del motore ci sono, nei tipi giusti', () => {
  const numerici = [
    'dimensioni.lunghezza', 'dimensioni.larghezza', 'dimensioni.dislocamento_immersione',
    'dinamica.velocita_max', 'dinamica.velocita_max_superficie',
    'dinamica.accelerazione.tau', 'dinamica.accelerazione.max',
    'dinamica.decelerazione.tau', 'dinamica.decelerazione.max', 'dinamica.frenata_rev',
    'dinamica.accostata.angolo_timone_max', 'dinamica.accostata.diametro_tattico',
    'dinamica.accostata.velocita_angolare_max', 'dinamica.accostata.tempo_risposta',
    'dinamica.accostata.perdita_velocita',
    'dinamica.quota.assetto_max', 'dinamica.quota.velocita_assetto',
    'dinamica.quota.velocita_piena_efficacia_timoni', 'dinamica.quota.velocita_verticale_max',
    'dinamica.quota.velocita_verticale_zavorra', 'dinamica.quota.velocita_emersione_emergenza',
    'profondita.periscopica', 'profondita.automatica', 'profondita.operativa',
    'profondita.collaudo', 'profondita.collasso',
    'acustica.rumore_irradiato.gradino_sl0', 'acustica.rumore_irradiato.velocita_rif',
    'acustica.rumore_irradiato.velocita_min', 'acustica.rumore_irradiato.pendenza',
    'acustica.rumore_irradiato.pendenza_extra', 'acustica.rumore_irradiato.soglia_pendenza_extra',
    'acustica.rumore_irradiato.aspetto_poppa', 'acustica.rumore_irradiato.aspetto_prua',
    'acustica.cavitazione.velocita_rif', 'acustica.cavitazione.quota_rif', 'acustica.cavitazione.salto',
    'acustica.rumore_proprio.livello_macchinario', 'acustica.rumore_proprio.esponente',
    'acustica.rumore_proprio.velocita_soglia_sfera',
    'acustica.forza_bersaglio.prua_poppa', 'acustica.forza_bersaglio.traverso',
    'sensori.sfera.banda_min', 'sensori.sfera.banda_max', 'sensori.sfera.diametro_equivalente',
    'sensori.sfera.frequenza_rif', 'sensori.sfera.indice_direttivita', 'sensori.sfera.fascio_3db',
    'sensori.sfera.sigma_min', 'sensori.sfera.coefficiente_sigma', 'sensori.sfera.arco_baffles',
    'armi.tubi.numero', 'armi.capacita',
    ...['1985', '1986', '1987', '1988', '1989', '1990', '1991'].map((y) => `identita.operativi_per_anno.${y}`),
  ];
  const booleani = [
    'sensori.sfera.presente', 'sensori.conforme.presente', 'sensori.rimorchiata.presente',
    'sensori.intercettazione.presente', 'propulsione.reattore_sempre_acceso', 'armi.filoguida',
  ];
  for (const [id, p] of tutte) {
    for (const k of numerici) assert.equal(typeof a(p.valori, k), 'number', `${id}: ${k}`);
    for (const k of booleani) assert.equal(typeof a(p.valori, k), 'boolean', `${id}: ${k}`);
    assert.ok(Array.isArray(p.valori.dinamica.ordini_macchina) && p.valori.dinamica.ordini_macchina.length >= 5);
    assert.ok(Array.isArray(p.valori.acustica.tonali) && p.valori.acustica.tonali.length >= 2);
  }
});

// ---------------------------------------------------------------------------
// Coerenza fisica
// ---------------------------------------------------------------------------

test('ordini di macchina: velocita\' strettamente crescenti, da indietro a tutta forza', () => {
  for (const [id, p] of tutte) {
    const ordini = p.valori.dinamica.ordini_macchina;
    for (let i = 1; i < ordini.length; i++) {
      assert.ok(ordini[i].velocita > ordini[i - 1].velocita, `${id}: ${ordini[i - 1].ordine} → ${ordini[i].ordine}`);
    }
    assert.ok(ordini[0].velocita < 0, `${id}: il primo ordine e' indietro`);
    assert.ok(ordini.some((o) => o.velocita === 0), `${id}: c'e' lo stop`);
    assert.equal(ordini[ordini.length - 1].velocita, p.valori.dinamica.velocita_max, `${id}: l'ultimo e' la massima`);
  }
  assert.deepEqual(v688.dinamica.ordini_macchina.map((o) => o.ordine), ['REV', 'STOP', '1/3', '2/3', 'STD', 'FULL', 'FLANK']);
  // Telegrafo a percentuale dell'Alfa: legge lineare nei giri.
  assert.equal(valfa.dinamica.telegrafo.tipo, 'percentuale');
  for (const o of valfa.dinamica.ordini_macchina) {
    const pc = /** @type {number} */ (o.percentuale);
    assert.ok(Math.abs(o.velocita - (valfa.dinamica.velocita_max * pc) / 110) < 0.06, `Alfa ${o.ordine}`);
  }
});

test('l\'Alfa e\' piu\' veloce, accelera e accosta meglio, scende piu\' a fondo', () => {
  assert.ok(valfa.dinamica.velocita_max > v688.dinamica.velocita_max);
  assert.equal(valfa.dinamica.velocita_max, 41);
  assert.equal(v688.dinamica.velocita_max, 32);
  // «Piena velocita' entro un minuto» [DS-705]; il 688 impiega minuti.
  const tAlfa = tempoAccelerazione(valfa, 0, 41, 40);
  const t688 = tempoAccelerazione(v688, 0, 32, 31);
  assert.ok(tAlfa <= 60, `Alfa 0 → 40 kt in ${tAlfa.toFixed(1)} s`);
  assert.ok(t688 > 120 && t688 < 360, `688 0 → 31 kt in ${t688.toFixed(1)} s`);
  // Inversione di 180° alla velocita' massima in 42 s [DS-705].
  const invAlfa = tempoInversione(valfa, valfa.dinamica.velocita_max);
  const inv688 = tempoInversione(v688, v688.dinamica.velocita_max);
  assert.ok(Math.abs(invAlfa - 42) <= 4, `Alfa: inversione in ${invAlfa.toFixed(1)} s`);
  assert.ok(inv688 > invAlfa * 1.5, `688: inversione in ${inv688.toFixed(1)} s`);
  // Quote: il 688 e' il battello meno profondo del duello.
  assert.ok(valfa.profondita.collaudo > v688.profondita.collaudo);
  assert.ok(valfa.profondita.operativa > v688.profondita.operativa);
});

test('quote in ordine e coerenti con le fonti', () => {
  for (const [id, p] of tutte) {
    const q = p.valori.profondita;
    assert.ok(q.periscopica < q.automatica, `${id}`);
    assert.ok(q.automatica < q.operativa, `${id}`);
    assert.ok(q.operativa <= q.collaudo, `${id}`);
    assert.ok(q.collaudo < q.collasso, `${id}`);
    // Collasso circa 1,5 volte la quota limite (glossario di Polmar & Moore).
    assert.ok(q.collasso / q.collaudo >= 1.4 && q.collasso / q.collaudo <= 1.6, `${id}`);
  }
  assert.equal(v688.profondita.collaudo, 290);
  assert.equal(v688.profondita.collasso, 450);
  assert.equal(valfa.profondita.operativa, 320);
  assert.equal(valfa.profondita.collaudo, 400);
});

test('timoni orizzontali: servono abbrivio, velocita\' verticale limitata', () => {
  for (const [id, p] of tutte) {
    const q = p.valori.dinamica.quota;
    assert.ok(q.velocita_verticale_zavorra < 0.5, `${id}: da fermo si scende piano`);
    assert.ok(q.velocita_piena_efficacia_timoni > 0);
    // A tutta forza v·sin(assetto) supera il tetto, a 5 kt no.
    const aTutta = nodiInMs(p.valori.dinamica.velocita_max) * Math.sin((q.assetto_max * Math.PI) / 180);
    const a5 = nodiInMs(5) * Math.sin((q.assetto_max * Math.PI) / 180);
    assert.ok(a5 < q.velocita_verticale_max && aTutta >= q.velocita_verticale_max * 0.9, `${id}`);
  }
});

test('cavitazione: l\'innesco cresce con la quota come la radice della pressione assoluta', () => {
  for (const [id, p] of tutte) {
    const c = p.valori.acustica.cavitazione;
    let prima = 0;
    for (const quota of [0, 10, 20, 50, 100, 150, 300, 400]) {
      const v = velocitaCavitazione(c, quota);
      assert.ok(v > prima, `${id}: a ${quota} m`);
      prima = v;
    }
    assert.equal(velocitaCavitazione(c, c.quota_rif), c.velocita_rif);
    assert.ok(velocitaCavitazione(c, 0) > 0, `${id}: anche in superficie la soglia e' positiva`);
  }
  const c688 = v688.acustica.cavitazione;
  // PROGETTO §11.3: a quota periscopica cavita sopra gli 8 kt, a 500 ft fino a circa 18, a 1000 ft fino a circa 25.
  assert.ok(velocitaCavitazione(c688, v688.profondita.periscopica) <= 8);
  assert.ok(Math.abs(velocitaCavitazione(c688, 152.4) - 18.6) < 0.5);
  assert.ok(Math.abs(velocitaCavitazione(c688, 304.8) - 25.9) < 0.5);
  // 05 §7.2: 688 18,5 / 25,6 kt a 150 / 300 m; Alfa 14 / 19 kt.
  assert.ok(Math.abs(velocitaCavitazione(c688, 150) - 18.5) < 0.2);
  assert.ok(Math.abs(velocitaCavitazione(c688, 300) - 25.6) < 0.2);
  const cAlfa = valfa.acustica.cavitazione;
  assert.ok(Math.abs(velocitaCavitazione(cAlfa, 150) - 14) < 0.3);
  assert.ok(Math.abs(velocitaCavitazione(cAlfa, 300) - 19) < 0.3);
  // L'Alfa cavita prima del 688 a ogni quota, e a tutta forza cavita sempre.
  for (const quota of [20, 150, 300]) assert.ok(velocitaCavitazione(cAlfa, quota) < velocitaCavitazione(c688, quota));
  assert.ok(velocitaCavitazione(cAlfa, valfa.profondita.collasso) < valfa.dinamica.velocita_max);
});

test('rumore irradiato: scala a gradini e Alfa assordante ad alta velocita\'', () => {
  assert.equal(v688.acustica.rumore_irradiato.gradino_sl0, 1);
  assert.equal(valfa.acustica.rumore_irradiato.gradino_sl0, 14);
  assert.equal(/** @type {any} */ (v688.varianti)?.['688I'].gradino_sl0, 0, '688I = riferimento');
  assert.equal(v688.acustica.rumore_irradiato.pendenza_extra, 0);
  assert.equal(valfa.acustica.rumore_irradiato.pendenza_extra, 1);
  assert.equal(valfa.acustica.rumore_irradiato.soglia_pendenza_extra, 15);
  // Monotono con la velocita' (a quota profonda, senza cavitazione per il 688).
  for (const [id, p] of tutte) {
    let prima = -Infinity;
    for (let v = 0; v <= p.valori.dinamica.velocita_max; v += 1) {
      const sl = livelloIrradiato(p.valori, v, 250);
      assert.ok(sl >= prima, `${id} a ${v} kt`);
      prima = sl;
    }
  }
  // A 5 kt l'Alfa sta 13 dB sopra il 688; a tutta forza il divario esplode.
  const lento = livelloIrradiato(valfa, 5, 150) - livelloIrradiato(v688, 5, 150);
  assert.ok(Math.abs(lento - 13) < 1e-9);
  const veloce = livelloIrradiato(valfa, 41, 150) - livelloIrradiato(v688, 32, 150);
  assert.ok(veloce > 30, `divario a tutta forza ${veloce.toFixed(1)} dB`);
  // Oltre i 15 kt l'Alfa sale di piu' del 688 per ogni nodo.
  const pendenzaAlfa = livelloIrradiato(valfa, 30, 400) - livelloIrradiato(valfa, 20, 400);
  const pendenza688 = livelloIrradiato(v688, 30, 400) - livelloIrradiato(v688, 20, 400);
  assert.ok(pendenzaAlfa - pendenza688 > 9);
});

test('rumore proprio: a tutta forza si e\' sordi', () => {
  for (const [id, p] of tutte) {
    const r = p.valori.acustica.rumore_proprio;
    /** @param {number} v */
    const nl = (v) => r.livello_macchinario + 10 * Math.log10(1 + (v / r.velocita_soglia_sfera) ** r.esponente);
    assert.ok(nl(5) - r.livello_macchinario < 1, `${id}: a 5 kt conta solo il macchinario`);
    assert.ok(nl(25) > 70, `${id}: a 25 kt sordo`);
  }
});

test('righe tonali: frequenze e regimi sensati, cambio di regime presente', () => {
  for (const [id, p] of tutte) {
    let cambi = 0;
    for (const t of p.valori.acustica.tonali) {
      assert.ok(t.frequenza > 10 && t.frequenza < 5000, `${id} ${t.nome}`);
      assert.ok(t.da_velocita < t.a_velocita, `${id} ${t.nome}`);
      assert.ok(t.a_velocita <= p.valori.dinamica.velocita_max, `${id} ${t.nome}`);
      if (t.da_velocita > 0 || t.a_velocita < p.valori.dinamica.velocita_max) cambi++;
    }
    assert.ok(cambi >= 1, `${id}: serve almeno una riga che compare o sparisce con la velocita'`);
  }
  assert.ok(v688.acustica.tonali.some((t) => t.frequenza === 60), '688: rete a 60 Hz');
  assert.ok(valfa.acustica.tonali.some((t) => t.frequenza === 400), 'Alfa: rete a 400 Hz [DS-705]');
});

test('sensori: DI e fascio coerenti con la geometria, errore di rilevamento R1', () => {
  const C = 1500;
  for (const [id, p] of tutte) {
    const s = p.valori.sensori.sfera;
    const lambda = C / /** @type {number} */ (s.frequenza_rif);
    const d = /** @type {number} */ (s.diametro_equivalente);
    assert.ok(Math.abs(/** @type {number} */ (s.indice_direttivita) - 20 * Math.log10((Math.PI * d) / lambda)) < 0.3, `${id} DI`);
    assert.ok(Math.abs(/** @type {number} */ (s.fascio_3db) - (59 * lambda) / d) < 0.2, `${id} fascio`);
    assert.ok(/** @type {number} */ (s.banda_min) < /** @type {number} */ (s.frequenza_rif));
    assert.ok(/** @type {number} */ (s.frequenza_rif) < /** @type {number} */ (s.banda_max));
  }
  const t = v688.sensori.rimorchiata;
  const lt = C / /** @type {number} */ (t.frequenza_rif);
  const L = /** @type {number} */ (t.lunghezza_antenna);
  assert.ok(Math.abs(/** @type {number} */ (t.indice_direttivita) - 10 * Math.log10((2 * L) / lt)) < 0.3);
  assert.ok(Math.abs(/** @type {number} */ (t.fascio_3db) - (51 * lt) / L) < 0.2);
  // R1 sulla sfera del 688 a 2 kHz: 5° a soglia, 1,6° con 10 dB, 0,5° oltre i 20 dB.
  const s688 = v688.sensori.sfera;
  assert.ok(Math.abs(sigma(s688, 0) - 4.9) < 0.15);
  assert.ok(Math.abs(sigma(s688, 10) - 1.55) < 0.1);
  assert.equal(sigma(s688, 25), 0.5);
  // L'Alfa sente peggio: +30-50 % di errore (06 §5.4), baffles piu' larghi.
  const sAlfa = valfa.sensori.sfera;
  for (const se of [0, 6, 10, 30]) {
    const rapporto = sigma(sAlfa, se) / sigma(s688, se);
    assert.ok(rapporto >= 1.3 && rapporto <= 1.55, `SE ${se}: rapporto ${rapporto.toFixed(2)}`);
  }
  assert.ok(/** @type {number} */ (sAlfa.indice_direttivita) < /** @type {number} */ (s688.indice_direttivita));
  assert.ok(/** @type {number} */ (sAlfa.arco_baffles) > /** @type {number} */ (s688.arco_baffles));
});

test('antenna rimorchiata: il 688 ce l\'ha, l\'Alfa no; regole R2 e R3', () => {
  assert.equal(v688.sensori.rimorchiata.presente, true);
  assert.equal(valfa.sensori.rimorchiata.presente, false);
  assert.equal(valfa.sensori.conforme.presente, false);
  assert.equal(/** @type {any} */ (valfa.riferimento_1989).rimorchiata, true, 'nel 1989 l\'Alfa ce l\'aveva');
  const t = v688.sensori.rimorchiata;
  assert.equal(t.ambiguita_destra_sinistra, true);
  const n = (/** @type {number | undefined} */ x) => /** @type {number} */ (x);
  // R2: velocita' minima < piena efficacia < sorda < danno.
  assert.ok(n(t.velocita_min) < n(t.velocita_piena_efficacia));
  assert.ok(n(t.velocita_piena_efficacia) < n(t.velocita_sorda));
  assert.ok(n(t.velocita_sorda) < n(t.velocita_danno));
  // R3: tempo morto (cavo + antenna)/v fra i limiti; 04: ≈ 5 min a 5 kt, ≈ 2,5 min a 10 kt.
  /** @param {number} v */
  const morto = (v) =>
    Math.min(n(t.tempo_morto_max), Math.max(n(t.tempo_morto_min), (n(t.lunghezza_cavo) + n(t.lunghezza_antenna)) / nodiInMs(v)));
  assert.ok(Math.abs(morto(5) - 300) < 20, `a 5 kt ${morto(5).toFixed(0)} s`);
  assert.ok(Math.abs(morto(10) - 155) < 10, `a 10 kt ${morto(10).toFixed(0)} s`);
  assert.equal(morto(3), n(t.tempo_morto_max));
  assert.ok(n(t.tempo_filare) >= 360 && n(t.tempo_filare) <= 480);
  // La TB-23 del 688I: piu' lunga, piu' lenta da filare, piu' precisa.
  const tb23 = /** @type {any} */ (v688.varianti)?.['688I'].rimorchiata_sottile;
  assert.ok(tb23.lunghezza_antenna > n(t.lunghezza_antenna));
  assert.ok(tb23.tempo_filare > n(t.tempo_filare));
  assert.ok(tb23.sigma_min < n(t.sigma_min));
});

test('armi: dotazioni entro la capacita\', filo solo sul 688', () => {
  for (const [id, p] of tutte) {
    for (const d of p.valori.armi.dotazioni) {
      const totale = d.voci.reduce((s, x) => s + x.numero, 0);
      assert.ok(totale <= p.valori.armi.capacita, `${id} ${d.dal_anno}-${d.al_anno}: ${totale}`);
      assert.ok(d.dal_anno <= d.al_anno && d.dal_anno >= 1985 && d.al_anno <= 1991);
    }
  }
  assert.equal(v688.armi.filoguida, true);
  assert.equal(valfa.armi.filoguida, false);
  assert.equal(v688.armi.tubi.numero, 4);
  assert.equal(valfa.armi.tubi.numero, 6);
  // Niente ADCAP prima del 1988 (02 §2.8).
  for (const d of v688.armi.dotazioni) {
    if (d.al_anno < 1988) assert.ok(!d.voci.some((x) => x.arma.includes('ADCAP')));
  }
});

test('anni di servizio: Alfa operativi fino al 1989, nessuno dal 1990', () => {
  const op = valfa.identita.operativi_per_anno;
  for (const y of ['1985', '1986', '1987', '1988', '1989']) assert.equal(op[y], 5);
  assert.equal(op['1990'], 0);
  assert.equal(op['1991'], 0);
  const op688 = v688.identita.operativi_per_anno;
  let prima = 0;
  for (const y of ['1985', '1986', '1987', '1988', '1989', '1990', '1991']) {
    assert.ok(op688[y] >= prima, `688 ${y}`);
    prima = op688[y];
  }
  assert.equal(op688['1991'], 47);
});
