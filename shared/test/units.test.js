// @ts-check
/**
 * Prove di shared/units.js: conversioni, andata e ritorno, angoli e rilevamenti.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as u from '../units.js';

/**
 * @param {number} atteso
 * @param {number} ottenuto
 * @param {number} [tolleranza] relativa
 */
function circa(ottenuto, atteso, tolleranza = 1e-12) {
  const scala = Math.max(1, Math.abs(atteso));
  assert.ok(
    Math.abs(ottenuto - atteso) <= tolleranza * scala,
    `atteso ${atteso}, ottenuto ${ottenuto}`,
  );
}

test('costanti esatte per definizione', () => {
  assert.equal(u.MIGLIO_NAUTICO_M, 1852);
  assert.equal(u.PIEDE_M, 0.3048);
  assert.equal(u.IARDA_M, 0.9144);
  assert.equal(u.KILOIARDA_M, 914.4);
  assert.equal(u.KABELTOV_M, 185.2);
  circa(u.NODO_MS, 0.514444444444444);
  // Un miglio nautico sono dieci cavi sovietici.
  circa(u.caviInMetri(10), u.MIGLIO_NAUTICO_M);
});

test('valori noti', () => {
  circa(u.nodiInMs(1), 1852 / 3600);
  circa(u.nodiInMs(32), 16.462222222222222);
  circa(u.piediInMetri(950), 289.56);
  circa(u.piediInMetri(1000), 304.8);
  circa(u.metriInPiedi(450), 1476.3779527559054);
  circa(u.metriInIarde(u.MIGLIO_NAUTICO_M), 2025.3718285214347);
  circa(u.kiloiardeInMetri(10), 9144);
  circa(u.metriInKiloiarde(1852), 2.025371828521435);
  circa(u.migliaNauticheInMetri(7.5), 13890);
  circa(u.metriInMigliaNautiche(55560), 30);
  circa(u.metriInCavi(1852), 10);
  circa(u.gradiInRadianti(180), Math.PI);
  circa(u.radiantiInGradi(Math.PI / 2), 90);
});

test('andata e ritorno di tutte le conversioni', () => {
  /** @type {Array<[(x: number) => number, (x: number) => number]>} */
  const coppie = [
    [u.nodiInMs, u.msInNodi],
    [u.piediInMetri, u.metriInPiedi],
    [u.iardeInMetri, u.metriInIarde],
    [u.kiloiardeInMetri, u.metriInKiloiarde],
    [u.migliaNauticheInMetri, u.metriInMigliaNautiche],
    [u.caviInMetri, u.metriInCavi],
    [u.gradiInRadianti, u.radiantiInGradi],
  ];
  const campioni = [0, 1, -1, 0.001, 3.7, 41, 290, 1475, 2400, 123456.789, -999.5];
  for (const [andata, ritorno] of coppie) {
    for (const x of campioni) {
      circa(ritorno(andata(x)), x);
      circa(andata(ritorno(x)), x);
    }
  }
});

test('normalizza360', () => {
  assert.equal(u.normalizza360(0), 0);
  assert.equal(u.normalizza360(360), 0);
  assert.equal(u.normalizza360(-10), 350);
  assert.equal(u.normalizza360(720.5), 0.5);
  assert.equal(u.normalizza360(-360), 0);
  assert.ok(Object.is(u.normalizza360(-0), 0), 'niente -0');
  assert.ok(Object.is(u.normalizza360(-720), 0), 'niente -0');
  const piccolo = u.normalizza360(-1e-14);
  assert.ok(piccolo >= 0 && piccolo < 360, `fuori intervallo: ${piccolo}`);
  for (let a = -1000; a <= 1000; a += 7.3) {
    const n = u.normalizza360(a);
    assert.ok(n >= 0 && n < 360);
    circa(Math.cos(u.gradiInRadianti(n)), Math.cos(u.gradiInRadianti(a)), 1e-9);
  }
});

test('normalizza180 e differenzaAngolare', () => {
  assert.equal(u.normalizza180(190), -170);
  assert.equal(u.normalizza180(-190), 170);
  assert.equal(u.normalizza180(180), 180);
  assert.equal(u.normalizza180(-180), 180);
  assert.equal(u.normalizza180(0), 0);
  assert.equal(u.differenzaAngolare(350, 10), 20);
  assert.equal(u.differenzaAngolare(10, 350), -20);
  assert.equal(u.differenzaAngolare(0, 180), 180);
  assert.equal(u.differenzaAngolare(90, 90), 0);
});

test('angolo nautico e matematico', () => {
  assert.equal(u.nauticoMatematico(0), 90);
  assert.equal(u.nauticoMatematico(90), 0);
  assert.equal(u.nauticoMatematico(180), 270);
  assert.equal(u.nauticoMatematico(270), 180);
  for (const a of [0, 13, 45, 133.3, 359]) circa(u.nauticoMatematico(u.nauticoMatematico(a)), a);
});

test('rilevamenti veri e relativi', () => {
  // Prua 350, contatto per 030 veri: 40° a dritta.
  assert.equal(u.rilevamentoRelativo(30, 350), 40);
  assert.equal(u.rilevamentoRelativoConSegno(30, 350), 40);
  assert.equal(u.rilevamentoRelativo(300, 350), 310);
  assert.equal(u.rilevamentoRelativoConSegno(300, 350), -50);
  assert.equal(u.rilevamentoVero(40, 350), 30);
  assert.equal(u.rilevamentoVero(-50, 350), 300);
  for (let prua = 0; prua < 360; prua += 37) {
    for (let vero = 0; vero < 360; vero += 23) {
      circa(u.rilevamentoVero(u.rilevamentoRelativo(vero, prua), prua), vero);
    }
  }
});

test('baffles e lato', () => {
  // Sfera che copre ±150° dalla prua: baffles di 60° totali.
  assert.equal(u.neiBaffles(180, 60), true);
  assert.equal(u.neiBaffles(151, 60), true);
  assert.equal(u.neiBaffles(209, 60), true);
  assert.equal(u.neiBaffles(150, 60), false, 'il bordo e\' ancora coperto');
  assert.equal(u.neiBaffles(0, 60), false);
  assert.equal(u.neiBaffles(-170, 60), true);
  assert.equal(u.latoRilevamento(0), 'prua');
  assert.equal(u.latoRilevamento(180), 'poppa');
  assert.equal(u.latoRilevamento(90), 'dritta');
  assert.equal(u.latoRilevamento(270), 'sinistra');
  assert.equal(u.latoRilevamento(-10), 'sinistra');
});

test('rilevamento speculare (ambiguita\' dell\'antenna rimorchiata)', () => {
  assert.equal(u.rilevamentoSpeculare(30, 0), 330);
  assert.equal(u.rilevamentoSpeculare(100, 90), 80);
  assert.equal(u.rilevamentoSpeculare(90, 90), 90);
  for (const asse of [0, 45, 200]) {
    for (const r of [10, 95, 359]) circa(u.rilevamentoSpeculare(u.rilevamentoSpeculare(r, asse), asse), r);
  }
});
