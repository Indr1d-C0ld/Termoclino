// @ts-check
/**
 * Il tracciatore dell'equipaggio (server/src/sim/crew/tracce.js) su
 * fotogrammi sintetici: associazione di piu' bersagli, ambiguita' destra e
 * sinistra dell'antenna risolta da un'accostata e dalla sfera, perdita dopo
 * le occasioni mancate ma non durante i secondi ciechi, e il messaggio
 * `tracce` dell'equipaggio.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tracciatore } from '../src/sim/crew/tracce.js';
import { Generatore } from '../../shared/rng.js';
import { SONAR, centroSettore, quantizzaSE } from '../../shared/protocol.js';
import { norm180, norm360 } from '../../shared/tma.js';

const SFERA = { nome: /** @type {const} */ ('sfera'), fascio: 9.8, sigmaMin: 0.5, coefficiente: 0.5 };
const TOWED = { nome: /** @type {const} */ ('towed'), fascio: 3.5, sigmaMin: 1, coefficiente: 0.5, arcoEstremita: 30, fattoreEstremita: 3 };

/**
 * Un fotogramma sintetico: fondo esponenziale a −10 dB, lobi gaussiani
 * (−12·u² dB) sui rilevamenti misurati (con l'errore), e per l'antenna anche
 * sugli speculari rispetto all'asse.
 * @param {Generatore} rng
 * @param {{rilevamento: number, se: number}[]} bersagli  rilevamenti veri
 * @param {{fascio: number, asse?: number, sorda?: boolean}} o
 */
function fotogramma(rng, bersagli, o) {
  const lin = new Float64Array(SONAR.SETTORI);
  for (const b of bersagli) {
    const sigma = Math.max(0.5, 0.5 * o.fascio * 10 ** (-b.se / 20));
    const m = norm360(b.rilevamento + rng.gaussiana(0, sigma));
    const centri = o.asse === undefined ? [m] : [m, norm360(2 * o.asse - m)];
    for (const c of centri) {
      for (let k = 0; k < SONAR.SETTORI; k++) {
        const u = norm180(centroSettore(k) - c) / o.fascio;
        lin[k] += 10 ** ((b.se - 12 * u * u) / 10);
      }
    }
  }
  const settori = new Uint8Array(SONAR.SETTORI);
  for (let k = 0; k < SONAR.SETTORI; k++) settori[k] = quantizzaSE(10 * Math.log10(lin[k] + 0.1 * -Math.log(1 - rng.uniforme())));
  /** @type {import('../src/sim/crew/tracce.js').FotogrammaSonar} */
  const f = { settori, ciechi: [] };
  if (o.asse !== undefined) {
    f.asse = o.asse;
    f.sorda = o.sorda ?? false;
    f.ciechi = f.sorda ? [[0, 360]] : [[norm360(o.asse - 20), norm360(o.asse + 20)]];
  } else {
    f.ciechi = [[150, 210]];
  }
  return f;
}

function nuovo() {
  let n = 0;
  return new Tracciatore({ schiere: { sfera: SFERA, towed: TOWED }, designa: () => `S${++n}` });
}

test('associazione: due bersagli, due tracce stabili con rilevamento e variazione giusti', () => {
  const rng = new Generatore('due');
  const tr = nuovo();
  /** @type {any[]} */
  const fatti = [];
  for (let t = 1; t <= 300; t++) {
    const b = [{ rilevamento: 30 + t / 60, se: 12 }, { rilevamento: 100 - 0.5 * t / 60, se: 15 }];
    tr.fotogramma(fotogramma(rng, b, { fascio: 9.8 }), 'sfera', 'larga', t, { x: 0, y: 0 });
    tr.fineSecondo(t);
    fatti.push(...tr.fatti.splice(0));
  }
  const designate = fatti.filter((f) => f.tipo === 'designata');
  assert.equal(designate.length, 2, JSON.stringify(designate.map((f) => [f.traccia.contatto, f.rilevamento])));
  assert.ok(designate.every((f) => f.sensore === 'sfera' && f.banda === 'larga'));
  assert.equal(fatti.filter((f) => f.tipo === 'persa').length, 0);
  const s1 = /** @type {NonNullable<ReturnType<typeof tr.traccia>>} */ (tr.traccia('S1')).stima(300);
  const s2 = /** @type {NonNullable<ReturnType<typeof tr.traccia>>} */ (tr.traccia('S2')).stima(300);
  const [a, b] = Math.abs(norm180(s1.rilevamento - 35)) < 5 ? [s1, s2] : [s2, s1];
  assert.ok(Math.abs(norm180(a.rilevamento - 35)) < 1, `S a 35°: ${a.rilevamento}`);
  assert.ok(Math.abs(a.variazione - 1) < 0.3, `variazione ${a.variazione}`);
  assert.ok(Math.abs(norm180(b.rilevamento - 97.5)) < 1, `S a 97,5°: ${b.rilevamento}`);
  assert.ok(Math.abs(b.variazione + 0.5) < 0.3);
  // i punti tempo-rilevamento per la TMA: uno ogni 10 s
  const punti = /** @type {NonNullable<ReturnType<typeof tr.traccia>>} */ (tr.traccia('S1')).punti;
  assert.ok(punti && punti.length >= 28 && punti.length <= 31, `${punti?.length}`);
});

/**
 * Un'antenna che vede un bersaglio a `vero`; a `accostataA` l'asse cambia, e
 * l'antenna e' sorda per `morto` secondi.
 * @param {number} vero @param {number} asse0 @param {number} asse1
 */
function antennaConAccostata(vero, asse0, asse1, morto = 150) {
  const rng = new Generatore(`towed-${vero}-${asse1}`);
  const tr = nuovo();
  /** @type {any[]} */
  const fatti = [];
  /** @type {{ora: number, speculare: number | null}[]} */
  const stima = [];
  for (let t = 1; t <= 600; t++) {
    const accostata = t > 200;
    const sorda = t > 200 && t <= 200 + morto;
    const asse = accostata ? asse1 : asse0;
    const f = fotogramma(rng, [{ rilevamento: vero + 0.002 * t, se: 10 }], { fascio: 3.5, asse, sorda });
    tr.fotogramma(f, 'towed', 'larga', t, { x: 0, y: 0 });
    tr.fineSecondo(t);
    fatti.push(...tr.fatti.splice(0));
    const s = tr.traccia('S1')?.stima(t);
    if (s) stima.push({ ora: t, speculare: s.speculare });
  }
  return { tr, fatti, stima };
}

test('antenna: lo speculare, poi l\'accostata risolve l\'ambiguita\' dalla parte giusta (dritta e sinistra)', () => {
  // vero a dritta dell'asse: 60° con l'asse a 0, speculare a 300°; accostata a 300
  {
    const { tr, fatti, stima } = antennaConAccostata(60, 0, 300);
    const d = fatti.find((f) => f.tipo === 'designata');
    assert.ok(d && Math.abs(norm180(d.rilevamento - 60)) < 3);
    assert.ok(stima.some((s) => s.speculare !== null && Math.abs(norm180(s.speculare - 300)) < 3), 'prima dell\'accostata c\'e\' lo speculare');
    const r = fatti.find((f) => f.tipo === 'risolta');
    assert.ok(r, 'nessuna risoluzione');
    assert.equal(r.da, 'accostata');
    assert.ok(Math.abs(norm180(r.rilevamento - 60.5)) < 3, `risolta a ${r.rilevamento}`);
    assert.ok(Math.abs(norm180(r.scartato - 300)) < 5, `scartato ${r.scartato}`);
    const t = /** @type {NonNullable<ReturnType<typeof tr.traccia>>} */ (tr.traccia('S1'));
    assert.equal(t.ambigua, false);
    assert.equal(t.stato, 'tenuta', 'la traccia non si perde durante il tempo morto');
    assert.equal(fatti.filter((f) => f.tipo === 'designata').length, 1, 'nessun contatto nuovo dopo l\'accostata');
    assert.ok(Math.abs(norm180(t.stima(600).rilevamento - 61.2)) < 2);
  }
  // vero a sinistra: 300° con l'asse a 0 (il rappresentante di dritta e' lo speculare, 60°); accostata a 60
  {
    const { tr, fatti } = antennaConAccostata(300, 0, 60);
    const r = fatti.find((f) => f.tipo === 'risolta');
    assert.ok(r, 'nessuna risoluzione');
    assert.ok(Math.abs(norm180(r.rilevamento - 300.5)) < 3, `risolta a ${r.rilevamento}`);
    const t = /** @type {NonNullable<ReturnType<typeof tr.traccia>>} */ (tr.traccia('S1'));
    assert.ok(Math.abs(norm180(t.stima(600).rilevamento - 301.2)) < 2);
  }
});

test('antenna: la sfera risolve l\'ambiguita\' quando sente il contatto da una parte sola', () => {
  const rng = new Generatore('sfera-risolve');
  const tr = nuovo();
  /** @type {any[]} */
  const fatti = [];
  for (let t = 1; t <= 120; t++) {
    tr.fotogramma(fotogramma(rng, [{ rilevamento: 250, se: 10 }], { fascio: 3.5, asse: 0 }), 'towed', 'larga', t, { x: 0, y: -800 });
    // la sfera lo sente dal secondo minuto
    if (t > 60) tr.fotogramma(fotogramma(rng, [{ rilevamento: 252, se: 8 }], { fascio: 9.8 }), 'sfera', 'larga', t, { x: 0, y: 0 });
    tr.fineSecondo(t);
    fatti.push(...tr.fatti.splice(0));
  }
  const r = fatti.find((f) => f.tipo === 'risolta');
  assert.ok(r && r.da === 'sfera', JSON.stringify(fatti.map((f) => f.tipo)));
  assert.ok(Math.abs(norm180(r.rilevamento - 250)) < 3);
  assert.equal(fatti.filter((f) => f.tipo === 'designata').length, 1, 'la sfera si aggiunge alla traccia, non ne fa una nuova');
  assert.ok(fatti.some((f) => f.tipo === 'sensore' && f.sensore === 'sfera'));
  const t = /** @type {NonNullable<ReturnType<typeof tr.traccia>>} */ (tr.traccia('S1'));
  assert.deepEqual(Object.keys(t.sensori).sort(), ['sfera', 'towed']);
});

test('perdita: dopo un minuto di occasioni mancate si', () => {
  const rng = new Generatore('perdita');
  const tr = nuovo();
  /** @type {any[]} */
  const fatti = [];
  for (let t = 1; t <= 200; t++) {
    const b = t <= 60 ? [{ rilevamento: 45, se: 10 }] : [];
    tr.fotogramma(fotogramma(rng, b, { fascio: 9.8 }), 'sfera', 'larga', t, { x: 0, y: 0 });
    tr.fineSecondo(t);
    fatti.push(...tr.fatti.splice(0).map((f) => ({ ...f, ora: t })));
  }
  const persa = fatti.find((f) => f.tipo === 'persa');
  assert.ok(persa, 'la traccia non si perde');
  // 60 s piu' mezzo secondo per secondo di traccia tenuta (~55 s): fra 140 e 180
  assert.ok(persa.ora >= 140 && persa.ora <= 180, `persa a ${persa.ora}`);
  assert.equal(tr.traccia('S1')?.stato, 'persa');
});

test('perdita: un contatto nei baffles non si perde finche\' resta cieco (fino alla deriva massima)', () => {
  const rng = new Generatore('baffles');
  const tr = nuovo();
  /** @type {any[]} */
  const fatti = [];
  for (let t = 1; t <= 400; t++) {
    // il bersaglio entra nei baffles (150-210) dopo un minuto: niente picco, ma cieco
    const ril = t <= 60 ? 140 + t / 10 : 180;
    const b = t <= 60 ? [{ rilevamento: ril, se: 12 }] : [];
    tr.fotogramma(fotogramma(rng, b, { fascio: 9.8 }), 'sfera', 'larga', t, { x: 0, y: 0 });
    tr.fineSecondo(t);
    fatti.push(...tr.fatti.splice(0));
  }
  assert.equal(fatti.filter((f) => f.tipo === 'persa').length, 0, 'persa mentre era cieca');
});

test('messaggio `tracce`: solo misure e ipotesi, lo speculare solo se ambigua', async () => {
  const { Equipaggio } = await import('../src/sim/crew/equipaggio.js');
  const { battello } = await import('./aiuto.js');
  const b = battello({ z: 60, velocita: 5 });
  const e = new Equipaggio(b, { schiere: { sfera: SFERA, towed: TOWED }, rng: new Generatore('eq'), livello: 2 });
  const rng = new Generatore('msg');
  const amb = (await import('../src/sim/world/ambiente.js')).ambienteProvvisorio();
  /** @type {any[]} */
  const rapporti = [];
  for (let t = 1; t <= 30; t++) {
    const towed = fotogramma(rng, [{ rilevamento: 70, se: 12 }], { fascio: 3.5, asse: 0 });
    rapporti.push(...e.ogniSecondo({ sfera: null, towed: /** @type {any} */ (towed) }, amb, t));
  }
  const nuovo = rapporti.find((r) => r.chiave === 'sonar.nuovo_contatto');
  assert.ok(nuovo);
  assert.deepEqual(Object.keys(nuovo.parametri).sort(), ['contatto', 'rilevamento', 'sensore', 'speculare']);
  assert.ok(Math.abs(norm180(nuovo.parametri.speculare - 290)) <= 3);
  const m = e.messaggioTracce(32);
  assert.equal(m.tracce.length, 1);
  const v = /** @type {Record<string, unknown>} */ (m.tracce[0]);
  assert.deepEqual(Object.keys(v).sort(), ['classe', 'confidenza', 'contatto', 'rilevamento', 'sensori', 'speculare', 'stato', 'variazione']);
  assert.equal(v.contatto, 'S1');
  assert.deepEqual(v.sensori, ['towed']);
  assert.equal(v.stato, 'nuova');
  assert.equal(v.classe, null);
  assert.deepEqual(e.puntamento('S1')?.sensore, 'towed'); // la traccia e' solo dell'antenna
  assert.equal(e.puntamento('S9'), null);
});

test('designazioni sovietiche sull\'Alfa: Ц1, Ц2… (valide per il protocollo)', async () => {
  const { Equipaggio } = await import('../src/sim/crew/equipaggio.js');
  const { battello } = await import('./aiuto.js');
  const { CONTATTO_RE } = await import('../../shared/protocol.js');
  const amb = (await import('../src/sim/world/ambiente.js')).ambienteProvvisorio();
  const e = new Equipaggio(battello({ piattaforma: 'alfa', z: 60 }), {
    schiere: { sfera: SFERA, towed: null }, rng: new Generatore('alfa'), livello: 2, lato: 'urss',
  });
  const rng = new Generatore('alfa-f');
  /** @type {any[]} */
  const r = [];
  for (let t = 1; t <= 10; t++) r.push(...e.ogniSecondo({ sfera: /** @type {any} */ (fotogramma(rng, [{ rilevamento: 20, se: 15 }], { fascio: 9.8 })), towed: null }, amb, t));
  const nuovo = r.find((x) => x.chiave === 'sonar.nuovo_contatto');
  assert.equal(nuovo?.parametri.contatto, 'Ц1');
  assert.ok(CONTATTO_RE.test('Ц1'));
});
