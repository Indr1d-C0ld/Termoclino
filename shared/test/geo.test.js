// @ts-check
/**
 * Prove di shared/geo.js: proiezione locale, accuratezza contro l'ortodromia a
 * 50/150/300 km, rilevamenti e distanze sul piano, CPA.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProiezioneLocale,
  raggioGauss,
  normalizzaLongitudine,
  distanzaOrtodromica,
  rottaOrtodromica,
  puntoOrtodromico,
  distanza,
  rilevamento,
  rilevamentoEDistanza,
  spostamento,
  vettoreVelocita,
  rottaEVelocita,
  cpa,
  RAGGIO_MEDIO_TERRA_M,
} from '../geo.js';
import { differenzaAngolare } from '../units.js';

/**
 * @param {number} ottenuto
 * @param {number} atteso
 * @param {number} tolleranza assoluta
 * @param {string} [messaggio]
 */
function vicino(ottenuto, atteso, tolleranza, messaggio = '') {
  assert.ok(
    Math.abs(ottenuto - atteso) <= tolleranza,
    `${messaggio} atteso ${atteso} ± ${tolleranza}, ottenuto ${ottenuto}`,
  );
}

/** Origini delle zone delle missioni del 1989 piu' qualche caso limite. */
const ORIGINI = [
  { nome: 'equatore', lat: 0, lon: 0 },
  { nome: 'Gibilterra', lat: 36, lon: -5.6 },
  { nome: 'Adriatico', lat: 41.5, lon: 18.5 },
  { nome: 'Kunashir', lat: 44, lon: 146 },
  { nome: 'Fær Øer', lat: 62, lon: -7 },
  { nome: 'Barents', lat: 70, lon: 33 },
  { nome: 'alta latitudine', lat: 75, lon: 0 },
  { nome: 'antimeridiano', lat: 50, lon: 179.9 },
];

test('raggio di Gauss e longitudine', () => {
  vicino(raggioGauss(0), 6356752.3, 0.1, 'all\'equatore vale il semiasse minore');
  assert.ok(raggioGauss(0) < raggioGauss(45) && raggioGauss(45) < raggioGauss(70), 'cresce con la latitudine');
  vicino(raggioGauss(62), 6390102, 2, 'Fær Øer');
  assert.equal(normalizzaLongitudine(190), -170);
  assert.equal(normalizzaLongitudine(180), -180);
  assert.equal(normalizzaLongitudine(-180), -180);
  assert.equal(normalizzaLongitudine(0), 0);
  assert.equal(normalizzaLongitudine(-190), 170);
});

test('origine non valida', () => {
  assert.throws(() => new ProiezioneLocale(89.5, 0), RangeError);
  assert.throws(() => new ProiezioneLocale(NaN, 0), RangeError);
  assert.throws(() => new ProiezioneLocale(10, 0, -1), RangeError);
});

test('andata e ritorno della proiezione', () => {
  for (const o of ORIGINI) {
    const p = new ProiezioneLocale(o.lat, o.lon);
    const zero = p.inPiano(o.lat, o.lon);
    vicino(zero.x, 0, 1e-6, `${o.nome} x0`);
    vicino(zero.y, 0, 1e-6, `${o.nome} y0`);
    for (let az = 0; az < 360; az += 30) {
      for (const d of [1, 1000, 50e3, 150e3, 300e3]) {
        const g = puntoOrtodromico(o, az, d, p.raggio);
        const q = p.inPiano(g.lat, g.lon);
        const r = p.inGeografiche(q.x, q.y);
        vicino(r.lat, g.lat, 1e-9, `${o.nome} lat`);
        vicino(differenzaAngolare(g.lon, r.lon), 0, 1e-9, `${o.nome} lon`);
      }
    }
  }
});

test('distanze e azimut dall\'origine conservati esattamente', () => {
  for (const o of ORIGINI) {
    const p = new ProiezioneLocale(o.lat, o.lon);
    for (let az = 5; az < 360; az += 40) {
      for (const d of [50e3, 150e3, 300e3]) {
        const g = puntoOrtodromico(o, az, d, p.raggio);
        const q = p.inPiano(g.lat, g.lon);
        vicino(Math.hypot(q.x, q.y), d, 1e-6 * d, `${o.nome} distanza`);
        vicino(differenzaAngolare(rilevamento({ x: 0, y: 0 }, q), rottaOrtodromica(o, g)), 0, 1e-7, `${o.nome} azimut`);
      }
    }
  }
});

test('accuratezza contro l\'ortodromia a 50, 150 e 300 km', () => {
  // Coppie di punti entro r dall'origine, nelle direzioni peggiori
  // (trasversali): l'errore relativo massimo atteso e' c²/6 con c = r/R.
  /** @type {Array<[number, number]>} r in metri, errore relativo massimo ammesso */
  const casi = [
    [50e3, 1.1e-5],
    [150e3, 1.0e-4],
    [300e3, 4.0e-4],
  ];
  for (const [r, ammesso] of casi) {
    let peggiore = 0;
    for (const o of ORIGINI) {
      const p = new ProiezioneLocale(o.lat, o.lon);
      for (let az = 0; az < 360; az += 20) {
        for (const daz of [1, 10, 45, 71, 90, 135, 180]) {
          for (const f of [1, 0.5]) {
            const a = puntoOrtodromico(o, az, r, p.raggio);
            const b = puntoOrtodromico(o, az + daz, r * f, p.raggio);
            const dPiano = distanza(p.inPiano(a.lat, a.lon), p.inPiano(b.lat, b.lon));
            const dSfera = distanzaOrtodromica(a, b, p.raggio);
            peggiore = Math.max(peggiore, Math.abs(dPiano - dSfera) / dSfera);
          }
        }
      }
    }
    assert.ok(peggiore <= ammesso, `r = ${r / 1000} km: errore ${peggiore.toExponential(2)} > ${ammesso}`);
    // E la teoria: c²/6 e' davvero il tetto (con un margine del 10 %).
    const c = r / RAGGIO_MEDIO_TERRA_M;
    assert.ok(peggiore <= 1.1 * (c * c) / 6, `r = ${r / 1000} km oltre c²/6`);
  }
});

test('l\'antimeridiano non spezza il piano', () => {
  const p = new ProiezioneLocale(50, 179.9);
  const est = p.inPiano(50, -179.9);
  assert.ok(est.x > 0, 'oltre l\'antimeridiano si va a est');
  vicino(Math.hypot(est.x, est.y), distanzaOrtodromica({ lat: 50, lon: 179.9 }, { lat: 50, lon: -179.9 }, p.raggio), 1e-6);
});

test('ortodromia: valori noti', () => {
  // Un grado di meridiano sulla sfera media IUGG: 111,195 km.
  vicino(distanzaOrtodromica({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), (RAGGIO_MEDIO_TERRA_M * Math.PI) / 180, 1e-6);
  vicino(distanzaOrtodromica({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), 111195.08, 0.01);
  assert.equal(rottaOrtodromica({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), 0);
  vicino(rottaOrtodromica({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }), 90, 1e-9);
  const b = puntoOrtodromico({ lat: 62, lon: -7 }, 123, 77000);
  vicino(distanzaOrtodromica({ lat: 62, lon: -7 }, b), 77000, 1e-6);
});

test('rilevamento e distanza sul piano', () => {
  const o = { x: 0, y: 0 };
  assert.equal(rilevamento(o, { x: 0, y: 10 }), 0);
  assert.equal(rilevamento(o, { x: 10, y: 0 }), 90);
  assert.equal(rilevamento(o, { x: 0, y: -10 }), 180);
  assert.equal(rilevamento(o, { x: -10, y: 0 }), 270);
  vicino(rilevamento(o, { x: 1, y: 1 }), 45, 1e-12);
  assert.equal(rilevamento(o, o), 0, 'punti coincidenti');
  assert.equal(distanza({ x: 3, y: 4 }, { x: 0, y: 0 }), 5);
  for (const rotta of [0, 33, 90, 181, 359.5]) {
    for (const d of [1, 4572, 30000]) {
      const q = spostamento({ x: 100, y: -200 }, rotta, d);
      const rd = rilevamentoEDistanza({ x: 100, y: -200 }, q);
      vicino(differenzaAngolare(rd.rilevamento, rotta), 0, 1e-9);
      vicino(rd.distanza, d, 1e-9 * d);
    }
  }
});

test('vettore velocita\' e ritorno', () => {
  const v = vettoreVelocita(90, 10);
  vicino(v.x, 10, 1e-12);
  vicino(v.y, 0, 1e-12);
  for (const rotta of [0, 45, 135, 270, 359]) {
    const r = rottaEVelocita(vettoreVelocita(rotta, 12.5));
    vicino(differenzaAngolare(r.rotta, rotta), 0, 1e-9);
    vicino(r.velocita, 12.5, 1e-12);
  }
  assert.deepEqual(rottaEVelocita({ x: 0, y: 0 }), { rotta: 0, velocita: 0 });
});

test('CPA: rotte opposte sulla stessa linea', () => {
  const r = cpa({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 10000 }, { x: 0, y: -10 });
  vicino(r.tcpa, 500, 1e-9);
  vicino(r.dcpa, 0, 1e-9);
  assert.equal(r.inAvvicinamento, true);
});

test('CPA: rotte che si incrociano', () => {
  const r = cpa({ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 1000, y: 2000 }, { x: -5, y: 0 });
  vicino(r.tcpa, 300, 1e-9);
  vicino(r.dcpa, Math.hypot(500, 500), 1e-9);
  vicino(r.punto1.y, 1500, 1e-9);
  vicino(r.punto2.x, -500, 1e-9);
  vicino(r.rilevamento, 315, 1e-9);
});

test('CPA: bersaglio fermo al traverso', () => {
  const r = cpa({ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 300, y: 1000 }, { x: 0, y: 0 });
  vicino(r.tcpa, 200, 1e-9);
  vicino(r.dcpa, 300, 1e-9);
  vicino(r.rilevamento, 90, 1e-9);
});

test('CPA: stessa velocita\' (moto relativo nullo)', () => {
  const r = cpa({ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 600, y: 800 }, { x: 3, y: 4 });
  assert.equal(r.tcpa, 0);
  vicino(r.dcpa, 1000, 1e-9);
  assert.equal(r.inAvvicinamento, false);
});

test('CPA: tracce che si allontanano', () => {
  const p1 = { x: 0, y: 0 };
  const v1 = { x: 0, y: 5 };
  const p2 = { x: 200, y: 1000 };
  const v2 = { x: 0, y: 8 };
  const r = cpa(p1, v1, p2, v2);
  assert.ok(r.tcpa < 0, 'il minimo e\' nel passato');
  assert.equal(r.inAvvicinamento, false);
  vicino(r.dcpa, 200, 1e-9);
  const f = cpa(p1, v1, p2, v2, { soloFuturo: true });
  assert.equal(f.tcpa, 0);
  vicino(f.dcpa, distanza(p1, p2), 1e-9);
});

test('CPA: confronto con la ricerca esaustiva', () => {
  // Tracce pseudo-casuali ma fisse: il minimo campionato non scende sotto dcpa.
  let s = 1;
  const caso = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296 - 0.5;
  };
  for (let k = 0; k < 200; k++) {
    const p1 = { x: caso() * 40000, y: caso() * 40000 };
    const p2 = { x: caso() * 40000, y: caso() * 40000 };
    const v1 = { x: caso() * 30, y: caso() * 30 };
    const v2 = { x: caso() * 30, y: caso() * 30 };
    const r = cpa(p1, v1, p2, v2);
    let minimo = Infinity;
    for (let t = r.tcpa - 600; t <= r.tcpa + 600; t += 0.5) {
      minimo = Math.min(
        minimo,
        Math.hypot(p2.x + v2.x * t - p1.x - v1.x * t, p2.y + v2.y * t - p1.y - v1.y * t),
      );
    }
    assert.ok(r.dcpa <= minimo + 1e-6, `caso ${k}: dcpa ${r.dcpa} > minimo campionato ${minimo}`);
    assert.ok(minimo - r.dcpa < 1, `caso ${k}: minimo campionato troppo lontano`);
  }
});
