#!/usr/bin/env python3
"""
relazione.py - stampa i numeri della convalida del tracciatore (i casi di test_convalida.py) per
docs/CALIBRAZIONE_F2.md, parte "Propagazione (filone G)".

    python3 tools/acustica/relazione.py
"""
import math
import os
import sys

import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

from modi import Pekeris  # noqa: E402
from raggi import Banda, Famiglia, Fondo, Profilo, Superficie, campo, campo_coerente, perdita_db  # noqa: E402
from test_convalida import media_banda_lloyd  # noqa: E402


def it(x, c=2):
    return f'{x:.{c}f}'.replace('.', ',')


def main():
    # 1. sferica
    prof = Profilo([0, 5000], [1500, 1500])
    r = np.geomspace(10, 3000, 40)
    I = campo(prof, Superficie(assorbente=True), Fondo(assorbente=True), 2500.0, [2500.0, 2600.0, 3000.0], r,
              [Banda('x', 9000, 11000, 10000)], semicoerente=False, sottocampioni=1)
    err = []
    for k, dz in enumerate([0.0, 100.0, 500.0]):
        d = perdita_db(I[0, k]) - 20 * np.log10(np.hypot(r, dz))
        err.append(d[dz / r < math.tan(math.radians(85))])
    e = np.concatenate(err)
    print(f'1. sferica: 10 m-3 km, tre quote: scarto massimo {it(np.max(np.abs(e)))} dB, '
          f'quadratico medio {it(math.sqrt(np.mean(e ** 2)))} dB')
    # 2. Lloyd
    f, zs, zr = 150.0, 25.0, 100.0
    k = 2 * math.pi * f / 1500
    rr = np.linspace(50, 5000, 80)
    R1, R2 = np.hypot(rr, zr - zs), np.hypot(rr, zr + zs)
    es = np.exp(1j * k * R1) / R1 - np.exp(1j * k * R2) / R2
    p = campo_coerente(prof, Superficie(), Fondo(assorbente=True), zs, zr, rr, f)
    tl_e, tl_p = -20 * np.log10(np.abs(es)), -20 * np.log10(np.abs(p))
    fuori_zeri = tl_e < np.median(tl_e) + 10
    print(f'2a. Lloyd coerente (150 Hz, 25 -> 100 m, 50 m-5 km): |p - esatta|*R1 max {np.max(np.abs(p - es) * R1):.1e}, '
          f'TL fuori dagli zeri entro {np.max(np.abs(tl_p - tl_e)[fuori_zeri]):.1e} dB')
    b = Banda('x', 0.9 * f, 1.1 * f, f)
    peggio = 0
    for zs, zr in [(25.0, 100.0), (5.0, 25.0), (10.0, 300.0)]:
        r0 = 4 * k * zs * zr
        rr = np.geomspace(max(r0, 200.0), 30000, 25)
        I = campo(prof, Superficie(), Fondo(assorbente=True), zs, [zr], rr, [b], sottocampioni=1)
        d = perdita_db(I[0, 0]) - perdita_db(media_banda_lloyd(zs, zr, rr, 1500.0, b.da, b.a))
        peggio = max(peggio, np.max(np.abs(d)))
    print(f'2b. Lloyd semicoerente nel campo lontano (40 log r), tre geometrie: scarto massimo {it(peggio)} dB')
    # 3. Pekeris
    H, c1, c2, rho2 = 100.0, 1500.0, 1800.0, 1.8
    prof = Profilo([0, H], [c1, c1])
    rr = np.geomspace(1000, 30000, 30)
    print('3. Pekeris (H 100 m, 1500/1800 m/s, densita\' 1,8; sorgente 30 m), raggi semicoerenti contro modi incoerenti, 1-30 km:')
    for att in (0.0, 0.5):
        for f in (100.0, 500.0):
            modi = Pekeris(f, H, c1, c2, rho2, att)
            I = campo(prof, Superficie(), Fondo(c2, rho2, att), 30.0, [10.0, 50.0, 90.0], rr, [Banda('x', f / 1.1, f * 1.1, f)])
            righe = []
            for kk, q in enumerate([10.0, 50.0, 90.0]):
                d = perdita_db(I[0, kk]) - modi.perdita_incoerente(30.0, q, rr)
                righe.append(f'{int(q)} m: rms {it(math.sqrt(np.mean(d ** 2)))}, max {it(np.max(np.abs(d)))}')
            print(f'   {int(f)} Hz, {it(att, 1)} dB/lambda, {len(modi.kr)} modi: ' + '; '.join(righe))
    # 4. Munk
    z = np.linspace(0, 5000, 501)
    eta = 2 * (z - 1300) / 1300
    prof = Profilo(z, 1500 * (1 + 0.00737 * (eta + np.exp(-eta) - 1)))
    rr = np.arange(1000.0, 150001.0, 500.0)
    I = campo(prof, Superficie(), Fondo(assorbente=True), 1000.0, [100.0], rr, [Banda('x', 45, 55, 50)], sottocampioni=1,
              semicoerente=False)
    tl = perdita_db(I[0, 0])
    d1 = (rr > 40000) & (rr < 90000)
    ill = rr[d1][tl[d1] < 200]
    c1_ = rr[d1][np.argmin(tl[d1])]
    d2 = (rr > 100000) & (rr < 150000)
    ill2 = rr[d2][tl[d2] < 200]
    th = math.acos(prof.c_a(1000.0) / prof.c[0] * 0.99999)
    ciclo = 2 * Famiglia(prof, 1000.0, np.array([th])).R[0]
    print(f'4. Munk (sorgente 1000 m, ricevitore 100 m, 50 Hz): prima zona {it(ill.min() / 1000, 1)}-{it(ill.max() / 1000, 1)} km '
          f'(minimo della TL a {it(c1_ / 1000, 1)} km, {it(np.min(tl[d1]), 1)} dB), seconda {it(ill2.min() / 1000, 1)}-'
          f'{it(ill2.max() / 1000, 1)} km; ciclo del raggio radente in superficie {it(ciclo / 1000, 1)} km; ombra fra 20 e 50 km')
    # 5. canale superficiale
    prof = Profilo([0, 100, 500.0], [1500, 1501.6, 1501.6 - 0.05 * 400])
    th_max = math.acos(prof.c_a(50.0) / 1501.6)
    rr = np.array([10000.0, 20000.0, 40000.0, 80000.0])
    zq = np.arange(0.25, 100, 0.5)
    I = campo(prof, Superficie(), Fondo(assorbente=True), 50.0, list(zq) + [250.0], rr, [Banda('a', 22500, 27500, 25000)],
              semicoerente=False, sottocampioni=1)
    integ = I[0, :-1].sum(axis=0) * 0.5
    bil = 10 * np.log10(integ / (2 * math.sin(th_max) / rr))
    media = -10 * np.log10(I[0, :-1].mean(axis=0))
    print(f'5a. canale di 100 m, 25 kHz: energia intrappolata conservata entro {it(np.max(np.abs(bil)))} dB a 10-80 km; '
          f'TL media nel canale {", ".join(it(x, 1) for x in media)} dB (3 dB per raddoppio: 10 log r); sotto (250 m) nessuna energia')
    prof = Profilo([0, 20, 500.0], [1500, 1500.32, 1500.32 - 0.05 * 480])
    rr = np.array([10000.0, 20000.0])
    bande = [Banda('alta', 22500, 27500, 25000), Banda('bassa', 270, 330, 300)]
    con = perdita_db(campo(prof, Superficie(), Fondo(assorbente=True), 10.0, [10.0], rr, bande, semicoerente=False,
                           sottocampioni=1)[:, 0])
    senza = perdita_db(campo(prof, Superficie(), Fondo(assorbente=True), 10.0, [10.0], rr, bande, semicoerente=False,
                             sottocampioni=1, barriere=False)[:, 0])
    print(f'5b. canale di 20 m, sorgente e ricevitore a 10 m, 10 e 20 km: 25 kHz {it(con[0][0], 1)}/{it(con[0][1], 1)} dB; '
          f'300 Hz {it(con[1][0], 1)}/{it(con[1][1], 1)} dB con la correzione WKB, {it(senza[1][0], 1)}/{it(senza[1][1], 1)} '
          f'senza')


if __name__ == '__main__':
    main()
