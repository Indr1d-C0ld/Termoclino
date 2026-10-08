// @ts-check
/**
 * Prove di shared/tma.js: strumenti manuali (bearing rate, Ekelund, gambe,
 * MATE), forme della soluzione, ellisse e qualita', limite di Cramér-Rao sulle
 * geometrie canoniche della ricerca (06_tma.md §3.2), Monte Carlo dello
 * stimatore contro il limite, osservabilita' senza manovra, robustezza a una
 * misura sbagliata, consiglio di manovra.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NODO_MS, Q_TIRO, comprimi, consiglioManovra, daPolare, distanzaEkelund, ekelundGambe, ellisse, inPolare,
  limiteCramerRao, norm180, norm360, osservabilita, propaga, qualita, residuiMATE, rilevamentoDa, stimaMV,
  trovaGambe, velocitaRilevamento, velocitaTrasversale, avanzaStato,
} from '../tma.js';
import { Generatore } from '../rng.js';

/** @typedef {import('../tma.js').Misura} Misura */

const KYD = 914.4;

/**
 * Le geometrie di 06_tma.md §3.2: bersaglio a R0 kyd per 000°, rotta 270° a
 * 10 kt; il proprio battello parte dall'origine a v kt e percorre le gambe
 * (accostate istantanee); un rilevamento ogni `passo` s con σ.
 * @param {{gambe: [number, number][], v?: number, R0?: number, passo?: number, sigma?: number, vB?: number}} c
 */
function geometria(c) {
  const v = (c.v ?? 5) * NODO_MS;
  const vB = (c.vB ?? 10) * NODO_MS;
  const bersaglio = { ora: 0, x: 0, y: (c.R0 ?? 10) * KYD, vx: -vB, vy: 0 };
  const durata = c.gambe.reduce((s, g) => s + g[1], 0) * 60;
  /** @param {number} t */
  const proprio = (t) => {
    let x = 0; let y = 0; let t0 = 0;
    for (const [rotta, min] of c.gambe) {
      const d = Math.min(min * 60, Math.max(0, t - t0));
      x += v * d * Math.sin(rotta * Math.PI / 180);
      y += v * d * Math.cos(rotta * Math.PI / 180);
      t0 += min * 60;
    }
    return { x, y };
  };
  /** @type {Misura[]} */
  const misure = [];
  for (let t = 0; t <= durata + 1e-9; t += c.passo ?? 30) {
    const p = proprio(t);
    const b = avanzaStato(bersaglio, t);
    misure.push({ ora: t, x: p.x, y: p.y, sigma: c.sigma ?? 0.5, rilevamento: rilevamentoDa(p.x, p.y, b.x, b.y) });
  }
  const fine = misure[misure.length - 1];
  return { misure, vero: avanzaStato(bersaglio, fine.ora), rif: { x: fine.x, y: fine.y } };
}

/**
 * Le misure con l'errore gaussiano.
 * @param {Misura[]} misure @param {Generatore} rng
 */
function rumorose(misure, rng) {
  return misure.map((m) => ({ ...m, rilevamento: norm360(m.rilevamento + rng.gaussiana(0, m.sigma)) }));
}

const CASI = {
  A: { gambe: /** @type {[number, number][]} */ ([[90, 12]]) },
  B: { gambe: /** @type {[number, number][]} */ ([[90, 6], [30, 6]]) },
  C: { gambe: /** @type {[number, number][]} */ ([[90, 6], [330, 6]]) },
  D: { gambe: /** @type {[number, number][]} */ ([[90, 6], [330, 6], [90, 6]]) },
  E: { gambe: /** @type {[number, number][]} */ ([[90, 6], [330, 6]]), sigma: 2 },
  F: { gambe: /** @type {[number, number][]} */ ([[90, 6], [330, 6]]), R0: 30 },
  G: { gambe: /** @type {[number, number][]} */ ([[90, 10], [330, 10]]), R0: 30 },
  H: { gambe: /** @type {[number, number][]} */ ([[90, 6], [330, 6]]), v: 10 },
  I: { gambe: /** @type {[number, number][]} */ ([[90, 6], [330, 6]]), passo: 5 },
  J: { gambe: /** @type {[number, number][]} */ ([[90, 6], [330, 6]]), R0: 4 },
};

test('angoli, forme polare e cartesiana, velocita\' trasversale', () => {
  assert.equal(norm360(-30), 330);
  assert.equal(norm180(270), -90);
  assert.equal(rilevamentoDa(0, 0, 1, 1), 45);
  const proprio = { x: 100, y: -200 };
  const s = daPolare({ ora: 50, rilevamento: 30, distanza: 5000, rotta: 250, velocita: 12 }, proprio);
  const p = inPolare(s, proprio);
  assert.ok(Math.abs(p.rilevamento - 30) < 1e-9 && Math.abs(p.distanza - 5000) < 1e-6);
  assert.ok(Math.abs(p.rotta - 250) < 1e-9 && Math.abs(p.velocita - 12) < 1e-9);
  // R·BR = STA − SOA: rotta propria a dritta del rilevamento → SOA positiva
  assert.ok(Math.abs(velocitaTrasversale(90, 10, 0) - 10) < 1e-12);
  assert.ok(Math.abs(velocitaTrasversale(0, 10, 90) + 10) < 1e-12);
});

test('bearing rate e punti tempo-rilevamento: retta pesata, errore della pendenza', () => {
  // bersaglio fermo a nord a 5 km, proprio battello verso est a 10 kt: il
  // rilevamento cala di 1,934·S/R °/min (06_tma §1)
  const v = 10 * NODO_MS;
  /** @type {Misura[]} */
  const misure = [];
  for (let t = 0; t <= 120; t++) misure.push({ ora: t, x: v * t, y: 0, sigma: 1, rilevamento: rilevamentoDa(v * t, 0, 0, 5000) });
  const br = /** @type {NonNullable<ReturnType<typeof velocitaRilevamento>>} */ (velocitaRilevamento(misure));
  const atteso = -1.934 * 10 / (5000 / KYD);
  assert.ok(Math.abs(br.variazione - atteso) < 0.03, `${br.variazione} contro ${atteso}`);
  // σ della pendenza: 1°/√Σ(t − t̄)² ≈ 0,16 °/min con 121 misure in due minuti
  assert.ok(Math.abs(br.sigmaVariazione - 60 / Math.sqrt(121 * (120 ** 2 + 2 * 120) / 12)) < 0.01, `${br.sigmaVariazione}`);
  const punti = comprimi(misure, 10);
  assert.equal(punti.length, 13);
  assert.ok(Math.abs(punti[1].sigma - 1 / Math.sqrt(10)) < 1e-9);
  // i punti stanno sulla curva vera
  for (const p of punti) assert.ok(Math.abs(norm180(p.rilevamento - rilevamentoDa(p.x, p.y, 0, 5000))) < 0.01);
});

test('gambe ed Ekelund: la distanza dai due bearing rate, entro il 15 % (NAVOPS: Ekelund sottostima del 13 %)', () => {
  const g = geometria({ ...CASI.C, passo: 10 });
  const campioni = [];
  for (let t = 0; t <= 720; t++) campioni.push({ ora: t, rotta: t < 360 ? 90 : 330, velocita: 5 });
  const gambe = trovaGambe(campioni);
  assert.equal(gambe.length, 2);
  assert.equal(gambe[0].rotta, 90);
  assert.equal(gambe[1].rotta, 330);
  const e = ekelundGambe(g.misure, gambe);
  assert.equal(e.length, 1);
  // Ekelund vale la distanza al «best range time», a meta' manovra
  const t = e[0].ora;
  const b = avanzaStato({ ora: 0, x: 0, y: 10 * KYD, vx: -10 * NODO_MS, vy: 0 }, t);
  const pos = { x: 5 * NODO_MS * Math.min(t, 360), y: 0 };
  if (t > 360) {
    pos.x += 5 * NODO_MS * (t - 360) * Math.sin(330 * Math.PI / 180);
    pos.y += 5 * NODO_MS * (t - 360) * Math.cos(330 * Math.PI / 180);
  }
  const vera = Math.hypot(b.x - pos.x, b.y - pos.y);
  assert.ok(e[0].valida);
  assert.ok(Math.abs(e[0].distanza - vera) / vera < 0.15, `Ekelund ${e[0].distanza} contro ${vera}`);
  // stesse SOA: niente distanza
  const piatta = distanzaEkelund({ ora: 0, rilevamento: 0, variazione: 1, soa: 5 }, { ora: 60, rilevamento: 0, variazione: 1, soa: 5 });
  assert.equal(piatta.valida, false);
});

test('MATE: residui nulli sulla soluzione vera; velocita\' sbagliata = pendenza, distanza sbagliata = salto', () => {
  const g = geometria({ ...CASI.D, passo: 10 });
  const gambe = [{ da: 0, a: 360 }, { da: 360, a: 720 }, { da: 720, a: 1080 }];
  const vero = residuiMATE(g.misure, g.vero, { gambe });
  assert.ok(vero.rms < 1e-6);
  const lenta = residuiMATE(g.misure, { ...g.vero, vx: g.vero.vx * 0.6 }, { gambe });
  assert.ok(lenta.rms > 0.5);
  assert.ok(lenta.gambe.some((x) => Math.abs(x.pendenza) > 0.1));
  const vicina = residuiMATE(g.misure, {
    ...g.vero, x: g.rif.x + 0.7 * (g.vero.x - g.rif.x), y: g.rif.y + 0.7 * (g.vero.y - g.rif.y),
  }, { gambe });
  const medie = vicina.gambe.map((x) => x.media);
  assert.ok(Math.max(...medie) - Math.min(...medie) > 1, `medie per gamba ${medie}`);
});

test('ellisse e qualita\': orientamento, semiassi al 90 %, soglie di Q', () => {
  const e = /** @type {NonNullable<ReturnType<typeof ellisse>>} */ (ellisse(100, 0, 400));
  assert.equal(e.orientamento, 0); // l'asse lungo sta a nord-sud
  assert.ok(Math.abs(e.asse_lungo - 20 * Math.sqrt(-2 * Math.log(0.1))) < 1e-9);
  const ruotata = /** @type {NonNullable<ReturnType<typeof ellisse>>} */ (ellisse(250, 150, 250));
  assert.ok(Math.abs(ruotata.orientamento - 45) < 1e-9);
  // errori pari alle soglie: Q = 100·e^-1
  assert.equal(qualita({ distanza: 10000, sigmaDistanza: 1000, sigmaRotta: 20, sigmaVelocita: 3 }), 37);
  assert.ok(qualita({ distanza: 10000, sigmaDistanza: 500, sigmaRotta: 8, sigmaVelocita: 1 }) >= Q_TIRO);
  assert.equal(qualita({ distanza: 10000, sigmaDistanza: Infinity, sigmaRotta: 1, sigmaVelocita: 1 }), 0);
});

test('Cramér-Rao: le geometrie canoniche della ricerca (06_tma.md §3.2)', () => {
  // σR/R della tabella; tolleranza del 30 % relativo (lo script della ricerca
  // discretizza le accostate e le ore in modo un po' diverso)
  const attesi = { B: 1.33, C: 0.51, D: 0.10, E: 2.05, F: 1.17, G: 0.62, H: 0.32, I: 0.22, J: 0.37 };
  const a = limiteCramerRao(geometria(CASI.A).misure, geometria(CASI.A).vero, { riferimento: geometria(CASI.A).rif });
  assert.equal(a.osservabile, false, 'senza manovra la matrice di Fisher e\' singolare');
  for (const [k, atteso] of Object.entries(attesi)) {
    const g = geometria(/** @type {any} */ (CASI)[k]);
    const r = limiteCramerRao(g.misure, g.vero, { riferimento: g.rif });
    assert.ok(Math.abs(r.relativa - atteso) / atteso < 0.3, `caso ${k}: σR/R ${r.relativa.toFixed(3)} contro ${atteso}`);
  }
});

test('Monte Carlo: l\'errore di distanza dello stimatore sta vicino al limite di Cramér-Rao', (t) => {
  // Lo stimatore a massima verosimiglianza e' asintoticamente efficiente:
  // dove la geometria e' informativa (D: CRLB 10 %, I: 22 %) la non
  // linearita' e' piccola e l'errore quadratico medio deve stare entro il
  // ±30 % del limite (l'errore Monte Carlo della stima di un RMS con 200
  // prove e' ~5 %, il resto e' la distorsione del secondo ordine e la coda
  // verso le distanze lunghe). Dove non lo e' (C: 51 %) la distribuzione ha
  // code pesanti e il confronto con un limite gaussiano non ha senso.
  for (const [k, N] of /** @type {const} */ ([['D', 200], ['I', 120]])) {
    const g = geometria(CASI[k]);
    const crlb = limiteCramerRao(g.misure, g.vero, { riferimento: g.rif });
    const rng = new Generatore(`mc-${k}`);
    let somma2 = 0;
    let somma = 0;
    /** @type {number[]} */
    const assoluti = [];
    for (let i = 0; i < N; i++) {
      const s = /** @type {NonNullable<ReturnType<typeof stimaMV>>} */ (stimaMV(rumorose(g.misure, rng), {
        riferimento: g.rif, sigmaVelocitaPriore: null, profilo: false,
      }));
      const e = s.distanza - crlb.distanza;
      somma2 += e * e;
      somma += e;
      assoluti.push(Math.abs(e));
    }
    const rapporto = Math.sqrt(somma2 / N) / crlb.sigmaDistanza;
    assoluti.sort((a, b) => a - b);
    t.diagnostic(`caso ${k}: CRLB σR/R ${(100 * crlb.relativa).toFixed(1)} %, RMS/CRLB ${rapporto.toFixed(2)}, ` +
      `distorsione ${(100 * somma / N / crlb.distanza).toFixed(1)} %, mediana |e| ${(assoluti[N >> 1] / KYD).toFixed(2)} kyd, ` +
      `90° percentile ${(assoluti[Math.floor(0.9 * N)] / KYD).toFixed(2)} kyd`);
    assert.ok(rapporto > 0.75 && rapporto < 1.3, `caso ${k}: RMS/CRLB ${rapporto}`);
  }
});

test('senza manovra la distanza non e\' osservabile: Q resta a zero, e lo si dice', () => {
  const g = geometria(CASI.A);
  const rng = new Generatore('senza-manovra');
  for (let i = 0; i < 20; i++) {
    const s = /** @type {NonNullable<ReturnType<typeof stimaMV>>} */ (stimaMV(rumorose(g.misure, rng), { riferimento: g.rif }));
    assert.equal(s.osservabile, false);
    assert.equal(s.motivo, 'nessuna_manovra');
    assert.equal(s.q, 0);
  }
  assert.deepEqual(osservabilita(g.misure).motivo, 'nessuna_manovra');
  // con la manovra si', e Q sale
  const d = geometria({ ...CASI.D, passo: 10 });
  const s = /** @type {NonNullable<ReturnType<typeof stimaMV>>} */ (stimaMV(rumorose(d.misure, new Generatore('con')), { riferimento: d.rif }));
  assert.equal(s.osservabile, true);
  assert.ok(s.q >= Q_TIRO, `Q ${s.q}`);
  assert.ok(Math.abs(s.distanza - Math.hypot(d.vero.x - d.rif.x, d.vero.y - d.rif.y)) / s.distanza < 0.15);
});

test('stima robusta: una misura di un altro bersaglio non sposta la soluzione', () => {
  const d = geometria({ ...CASI.D, passo: 10 });
  const misure = rumorose(d.misure, new Generatore('robusta'));
  misure[misure.length - 1] = { ...misure[misure.length - 1], rilevamento: norm360(misure[misure.length - 1].rilevamento + 25) };
  const vera = Math.hypot(d.vero.x - d.rif.x, d.vero.y - d.rif.y);
  const robusta = /** @type {NonNullable<ReturnType<typeof stimaMV>>} */ (stimaMV(misure, { riferimento: d.rif, robusta: true }));
  assert.ok(Math.abs(robusta.distanza - vera) / vera < 0.15, `robusta ${robusta.distanza} contro ${vera}`);
});

test('la propagazione fa crescere l\'incertezza; il consiglio di manovra e\' un\'accostata che serve', () => {
  const d = geometria({ ...CASI.D, passo: 10 });
  const s = /** @type {NonNullable<ReturnType<typeof stimaMV>>} */ (stimaMV(rumorose(d.misure, new Generatore('p')), { riferimento: d.rif }));
  const dopo = propaga(s, s.ora + 600);
  assert.ok(dopo.sigmaDistanza > s.sigmaDistanza);
  assert.ok(dopo.q <= s.q);
  // una gamba sola: il consiglio e' accostare, e accostando il limite scende
  const a = geometria({ gambe: [[90, 8]], passo: 10 });
  const c = consiglioManovra({
    misure: a.misure, ipotesi: [{ ...a.vero }],
    proprio: { ora: a.misure[a.misure.length - 1].ora, x: a.rif.x, y: a.rif.y, rotta: 90, velocita: 5 },
  });
  assert.ok(c.accostata >= 60, `accostata ${c.accostata}`);
  assert.ok(c.lato === 'sinistra' || c.lato === 'dritta');
  assert.ok(c.relativa < c.senzaManovra / 3, `${c.relativa} contro ${c.senzaManovra}`);
});
