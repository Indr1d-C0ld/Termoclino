"""
test_convalida.py - convalida del tracciatore di raggi (raggi.py) e delle tabelle (tabelle.py) sui casi canonici.

    python3 -m unittest discover -s tools/acustica -p 'test_*.py' -v        (dalla radice del repo; circa un minuto)

Casi (docs/CALIBRAZIONE_F2.md, parte "Propagazione (G)", riporta i numeri):

1. divergenza sferica in acqua illimitata isovelocita' (20 log R, con e senza assorbimento);
2. specchio di Lloyd: somma coerente sugli autoraggi contro la forma chiusa; semicoerente (quella delle tabelle)
   contro la forma chiusa mediata sulla banda, nel campo lontano;
3. guida di Pekeris: raggi semicoerenti contro la somma incoerente dei modi normali (modi.py), due frequenze, fondo
   senza e con attenuazione, tre quote del ricevitore: scarto quadratico medio <= 1,5 dB e massimo <= 2,5 dB fra 1 e
   30 km;
4. profilo canonico di Munk: zone di convergenza dove le mette la letteratura (circa 60 km) e zone d'ombra fra l'una e
   l'altra;
5. canale superficiale: conservazione dell'energia intrappolata (10 log r, profondita' media), ombra sotto il canale,
   e la correzione WKB che fa uscire dal canale le basse frequenze;
6. reciprocita' del campo incoerente, formule uguali a quelle di shared/ambiente.js, determinismo delle tabelle e
   coerenza del file con lo scenario. Con TERMOCLINO_RIGENERA=1 rifa' anche tutte le tabelle e confronta lo SHA-256
   (qualche minuto: e' `python3 tools/acustica/tabelle.py --controlla`).
"""
import hashlib
import json
import math
import os
import struct
import sys
import unittest

import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import ambiente as A  # noqa: E402
from modi import Pekeris  # noqa: E402
from raggi import (Banda, Famiglia, Fondo, Profilo, Superficie, campo, campo_coerente,  # noqa: E402
                   perdita_db)


def media_banda_lloyd(zs, zr, r, c, f1, f2, n=401):
    """|p|^2 dello specchio di Lloyd in forma chiusa mediato su [f1, f2] (pressione relativa a 1 m)."""
    acc = np.zeros_like(r)
    R1 = np.hypot(r, zr - zs)
    R2 = np.hypot(r, zr + zs)
    for f in np.linspace(f1, f2, n):
        k = 2 * math.pi * f / c
        acc += np.abs(np.exp(1j * k * R1) / R1 - np.exp(1j * k * R2) / R2) ** 2
    return acc / n


class Sferica(unittest.TestCase):
    def test_20_log_R(self):
        prof = Profilo([0, 5000], [1500, 1500])
        r = np.geomspace(10, 3000, 40)
        zr = [2500.0, 2600.0, 3000.0]
        I = campo(prof, Superficie(assorbente=True), Fondo(assorbente=True), 2500.0, zr, r,
                  [Banda('x', 9000, 11000, 10000)], semicoerente=False, sottocampioni=1)
        for k, q in enumerate(zr):
            dz = abs(q - 2500.0)
            dentro = dz / r < math.tan(math.radians(85))        # dentro il ventaglio dei raggi (88 gradi)
            errore = perdita_db(I[0, k]) - 20 * np.log10(np.hypot(r, dz))
            # le lamelle a tenda interpolano linearmente fra i raggi: un'increspatura di qualche decimo di dB
            self.assertLess(np.max(np.abs(errore[dentro])), 0.6, f'zr {q}: {errore[dentro]}')
            self.assertLess(math.sqrt(np.mean(errore[dentro] ** 2)), 0.2, f'zr {q}: {errore[dentro]}')

    def test_assorbimento_sul_cammino(self):
        prof = Profilo([0, 5000], [1500, 1500])
        r = np.array([500.0, 2000.0, 4000.0])
        b0 = Banda('a', 9000, 11000, 10000, 0.0)
        b1 = Banda('b', 9000, 11000, 10000, 1.2)                # dB/km
        I = campo(prof, Superficie(assorbente=True), Fondo(assorbente=True), 2500.0, [2500.0, 3500.0], r, [b0, b1],
                  semicoerente=False, sottocampioni=1)
        for k, dz in enumerate([0.0, 1000.0]):
            R = np.hypot(r, dz)
            np.testing.assert_allclose(perdita_db(I[1, k]) - perdita_db(I[0, k]), 1.2 * R / 1000, atol=0.1)


class Lloyd(unittest.TestCase):
    prof = Profilo([0, 5000], [1500, 1500])

    def test_coerente_forma_chiusa(self):
        f, zs, zr = 150.0, 25.0, 100.0
        k = 2 * math.pi * f / 1500
        r = np.linspace(50, 5000, 80)
        R1, R2 = np.hypot(r, zr - zs), np.hypot(r, zr + zs)
        esatta = np.exp(1j * k * R1) / R1 - np.exp(1j * k * R2) / R2
        p = campo_coerente(self.prof, Superficie(), Fondo(assorbente=True), zs, zr, r, f)
        # errore relativo all'ampiezza del cammino diretto: anche sugli zeri dell'interferenza
        self.assertLess(np.max(np.abs(p - esatta) * R1), 1e-4)

    def test_semicoerente_campo_lontano(self):
        # la sorgente e' la quota piu' alta (cosi' si calcolano le tabelle): il dipolo di Lloyd, 40 log r, e' esatto
        c, f = 1500.0, 150.0
        b = Banda('x', 0.9 * f, 1.1 * f, f)
        for zs, zr in [(25.0, 100.0), (5.0, 25.0), (10.0, 300.0)]:
            k = 2 * math.pi * f / c
            r0 = 4 * k * zs * zr                                # oltre: argomento di Lloyd < 1/4
            r = np.geomspace(max(r0, 200.0), 30000, 25)
            I = campo(self.prof, Superficie(), Fondo(assorbente=True), zs, [zr], r, [b], sottocampioni=1)
            esatta = media_banda_lloyd(zs, zr, r, c, b.da, b.a)
            errore = perdita_db(I[0, 0]) - perdita_db(esatta)
            self.assertLess(np.max(np.abs(errore)), 1.0, f'{zs}->{zr}: {np.round(errore, 2)}')


class PekerisModi(unittest.TestCase):
    """Guida di Pekeris: H = 100 m, acqua 1500 m/s, fondo 1800 m/s e densita' 1,8 ([PEK48], [JKPS11] cap. 2 e 5)."""

    def test_raggi_contro_modi(self):
        H, c1, c2, rho2 = 100.0, 1500.0, 1800.0, 1.8
        prof = Profilo([0, H], [c1, c1])
        r = np.geomspace(1000, 30000, 30)
        zs, zr = 30.0, [10.0, 50.0, 90.0]
        self.risultati = []
        for att in (0.0, 0.5):
            for f in (100.0, 500.0):
                modi = Pekeris(f, H, c1, c2, rho2, att)
                I = campo(prof, Superficie(), Fondo(c2, rho2, att), zs, zr, r, [Banda('x', f / 1.1, f * 1.1, f)])
                for k, q in enumerate(zr):
                    d = perdita_db(I[0, k]) - modi.perdita_incoerente(zs, q, r)
                    rms, mx = math.sqrt(np.mean(d ** 2)), np.max(np.abs(d))
                    self.assertLess(rms, 1.5, f'{f} Hz, {att} dB/lambda, zr {q}: rms {rms:.2f}')
                    self.assertLess(mx, 2.5, f'{f} Hz, {att} dB/lambda, zr {q}: max {mx:.2f}')

    def test_modi_sensati(self):
        # numero di modi intrappolati: kz_max H / pi, arrotondato
        m = Pekeris(500.0, 100.0, 1500.0, 1800.0, 1.8)
        kzmax = math.sqrt(m.k1 ** 2 - m.k2.real ** 2)
        self.assertEqual(len(m.kr), int(kzmax * 100 / math.pi + 0.5))
        # con l'attenuazione nel fondo i modi si smorzano, gli alti di piu'
        a = Pekeris(500.0, 100.0, 1500.0, 1800.0, 1.8, 0.5)
        self.assertTrue(np.all(a.kr.imag > 0))
        self.assertGreater(a.kr.imag[-1], a.kr.imag[0])


class Munk(unittest.TestCase):
    """Profilo canonico di Munk ([MUNK74]): c = 1500 (1 + eps (eta + exp(-eta) - 1)), eta = 2 (z - 1300)/1300,
    eps = 0,00737, fondo a 5000 m (assorbente), sorgente a 1000 m, 50 Hz."""

    @classmethod
    def setUpClass(cls):
        z = np.linspace(0, 5000, 501)
        eta = 2 * (z - 1300) / 1300
        cls.prof = Profilo(z, 1500 * (1 + 0.00737 * (eta + np.exp(-eta) - 1)))
        cls.r = np.arange(1000.0, 150001.0, 500.0)
        I = campo(cls.prof, Superficie(), Fondo(assorbente=True), 1000.0, [100.0, 1000.0], cls.r,
                  [Banda('x', 45, 55, 50)], sottocampioni=1, semicoerente=False)
        cls.tl = perdita_db(I[0])

    def test_prima_zona_di_convergenza(self):
        tl = self.tl[0]                                          # ricevitore a 100 m
        dentro = (self.r > 40000) & (self.r < 90000)
        illuminati = self.r[dentro][tl[dentro] < 200]
        self.assertGreater(len(illuminati), 0)
        inizio, fine = illuminati.min(), illuminati.max()
        centro = self.r[dentro][np.argmin(tl[dentro])]
        self.assertTrue(48000 <= inizio <= 60000, f'inizio della prima zona: {inizio / 1000:.1f} km')
        self.assertTrue(55000 <= centro <= 70000, f'centro della prima zona: {centro / 1000:.1f} km')
        # due famiglie (i raggi partiti in su e quelli partiti in giu' dalla sorgente profonda) danno due caustiche
        # vicino alla superficie: l'anello e' doppio, largo una ventina di km
        self.assertLess(fine - inizio, 25000)
        # fra la sorgente e la zona: ombra (in teoria dei raggi, nessuna energia)
        ombra = (self.r > 20000) & (self.r < 50000)
        self.assertTrue(np.all(tl[ombra] > np.min(tl[dentro]) + 40))
        # seconda zona a circa il doppio
        dentro2 = (self.r > 100000) & (self.r < 150000)
        centro2 = self.r[dentro2][np.argmin(tl[dentro2])]
        self.assertTrue(1.8 * centro <= centro2 <= 2.25 * centro, f'{centro / 1000} e {centro2 / 1000} km')

    def test_ciclo_del_raggio_radente(self):
        # il raggio orizzontale alla superficie torna in superficie dopo un ciclo: e' il passo delle zone
        th = math.acos(self.prof.c_a(1000.0) / self.prof.c[0] * 0.99999)
        fam = Famiglia(self.prof, 1000.0, np.array([th]))
        ciclo = 2 * fam.R[0]
        self.assertTrue(55000 < ciclo < 70000, f'ciclo {ciclo / 1000:.1f} km')


class CanaleSuperficiale(unittest.TestCase):
    """Strato isotermo di 100 m (c cresce di 0,016 m/s per metro) su una termoclina che piega in giu': i raggi entro
    l'angolo critico restano nel canale; gli altri finiscono sul fondo assorbente."""

    prof = Profilo([0, 100, 500.0], [1500, 1501.6, 1501.6 - 0.05 * 400])

    def test_energia_intrappolata(self):
        zs = 50.0
        th_max = math.acos(self.prof.c_a(zs) / 1501.6)
        r = np.array([10000.0, 20000.0, 40000.0, 80000.0])
        zr = np.arange(0.25, 100, 0.5)
        I = campo(self.prof, Superficie(), Fondo(assorbente=True), zs, list(zr) + [250.0], r,
                  [Banda('x', 22500, 27500, 25000)], semicoerente=False, sottocampioni=1)
        integrale = I[0, :-1].sum(axis=0) * 0.5
        atteso = 2 * math.sin(th_max) / r                        # potenza nel cono intrappolato / (r)
        np.testing.assert_allclose(10 * np.log10(integrale / atteso), 0, atol=0.5)
        # 10 log r nel canale
        media = -10 * np.log10(I[0, :-1].mean(axis=0))
        np.testing.assert_allclose(np.diff(media), 10 * np.log10(2), atol=0.3)
        # sotto il canale, ombra
        self.assertTrue(np.all(perdita_db(I[0, -1]) > media + 40))

    def test_le_basse_frequenze_escono(self):
        # canale sottile di 20 m (come lo strato estivo delle Faer Oer): a 25 kHz intrappola, a 300 Hz no (WKB)
        prof = Profilo([0, 20, 500.0], [1500, 1500.32, 1500.32 - 0.05 * 480])
        r = np.array([10000.0, 20000.0])
        bande = [Banda('alta', 22500, 27500, 25000), Banda('bassa', 270, 330, 300)]
        I = campo(prof, Superficie(), Fondo(assorbente=True), 10.0, [10.0], r, bande, semicoerente=False,
                  sottocampioni=1)
        tl = perdita_db(I[:, 0])
        self.assertTrue(np.all(tl[1] - tl[0] > 15), f'alta {tl[0]}, bassa {tl[1]}')
        senza = perdita_db(campo(prof, Superficie(), Fondo(assorbente=True), 10.0, [10.0], r, bande, semicoerente=False,
                                 sottocampioni=1, barriere=False)[:, 0])
        # la differenza la fa la correzione WKB: senza, a 300 Hz il canale tratterrebbe molta piu' energia
        # (resta solo l'allargamento di Airy delle lamelle); a 25 kHz non cambia quasi nulla
        self.assertTrue(np.all(tl[1] - senza[1] > 10), f'bassa: {tl[1]} con, {senza[1]} senza')
        self.assertLess(np.max(np.abs(tl[0] - senza[0])), 1.0)


class Varie(unittest.TestCase):
    def test_reciprocita_incoerente(self):
        prof = Profilo([0, 21, 100, 190], [1492.0, 1492.34, 1487.7, 1486.1])
        fondo = Fondo(1650, 1.9, 0.8)
        r = np.geomspace(1000, 30000, 12)
        b = [Banda('x', 1414, 2828, 2000)]
        a = campo(prof, Superficie(0.26), fondo, 13.0, [150.0], r, b, semicoerente=False)
        c = campo(prof, Superficie(0.26), fondo, 150.0, [13.0], r, b, semicoerente=False)
        self.assertLess(np.max(np.abs(perdita_db(a[0, 0]) - perdita_db(c[0, 0]))), 1.5)

    def test_formule_come_lo_scenario(self):
        amb = A.AmbienteScenario()
        v = amb.v['ambiente']
        c = A.mackenzie(np.array(v['profilo']['temperatura']), np.array(v['profilo']['salinita']),
                        np.array(v['profilo']['quota']))
        np.testing.assert_allclose(c, v['profilo']['velocita_suono'], atol=0.006)
        for b in v['assorbimento']['bande']:
            self.assertAlmostEqual(amb.assorbimento(b['frequenza']), b['alfa'], delta=max(1e-5, 1e-4 * b['alfa']))

    def test_tabelle_deterministiche(self):
        # una tabella piccola calcolata due volte: stessi byte
        amb = A.AmbienteScenario()
        reg = A.REGIONI[1]
        q = A.quote_tabella(reg['fondale'])
        r = A.distanze()[::8]
        uno = campo(amb.profilo(reg), amb.superficie(), amb.fondo(reg), q[1], q[1:], r, amb.bande()[:2], sottocampioni=1)
        due = campo(amb.profilo(reg), amb.superficie(), amb.fondo(reg), q[1], q[1:], r, amb.bande()[:2], sottocampioni=1)
        self.assertEqual(hashlib.sha256(uno.tobytes()).hexdigest(), hashlib.sha256(due.tobytes()).hexdigest())

    def test_file_e_scenario(self):
        with open(os.path.join(A.SCENARI, 'torpex_palestra.json'), encoding='utf-8') as f:
            sc = json.load(f)
        p = sc['propagazione']
        with open(os.path.join(A.SCENARI, p['tabella']['file']), 'rb') as f:
            dati = f.read()
        self.assertEqual(len(dati), p['tabella']['byte'])
        self.assertEqual(hashlib.sha256(dati).hexdigest(), p['tabella']['sha256'])
        self.assertLess(len(dati), 5 * 1024 * 1024)
        self.assertEqual(dati[:8], b'TERMOTL1')
        nT, nB, nQ, nR, zero, cent = struct.unpack('<6I', dati[8:32])
        self.assertEqual((nT, nB, nQ, nR), (len(p['regioni']), len(p['bande']), len(p['quote']['serie']),
                                            p['distanze']['numero']['valore']))
        attesi = 32
        for reg in p['regioni']:
            n = len(A.quote_tabella(reg['fondale']['valore']))
            attesi += nB * n * (n + 1) // 2 * nR
        self.assertEqual(attesi, len(dati))

    @unittest.skipUnless(os.environ.get('TERMOCLINO_RIGENERA') == '1', 'rigenerazione completa: TERMOCLINO_RIGENERA=1')
    def test_rigenerazione_identica(self):
        import tabelle
        _, _, dati = tabelle.calcola('torpex_palestra', max(1, min(6, (os.cpu_count() or 2) - 1)))
        with open(os.path.join(A.SCENARI, 'torpex_palestra.tl.bin'), 'rb') as f:
            self.assertEqual(hashlib.sha256(dati).hexdigest(), hashlib.sha256(f.read()).hexdigest())


if __name__ == '__main__':
    unittest.main()
