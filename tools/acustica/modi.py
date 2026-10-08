"""
modi.py - modi normali della guida d'onda di Pekeris, per la convalida del tracciatore di raggi (raggi.py).

La guida di Pekeris (1948) e' il caso canonico delle acque basse con soluzione "esatta": uno strato d'acqua
isovelocita' (c1, densita' 1) di spessore H, superficie libera, sopra un semispazio fluido (c2 > c1, densita' rho2,
attenuazione in dB per lunghezza d'onda). Il campo lontano dalla sorgente e' la somma dei modi intrappolati

    p(r, z) = i/(4 rho1) * sum_m psi_m(zs) psi_m(z) H0^(1)(k_m r),      psi_m(z) = sin(kz_m z) / sqrt(N_m)

con kz_m le radici di  rho2 * kz * cos(kz H) + gamma * sin(kz H) = 0,  gamma = sqrt(k_m^2 - k2^2)  (continuita' della
pressione e della velocita' verticale sul fondo) e N_m la normalizzazione integrale di psi^2/rho. Il continuo dei
modi non intrappolati conta solo a poche profondita' d'acqua dalla sorgente: le prove confrontano da 1 km in la'.
Con l'attenuazione nel fondo le radici diventano complesse: si parte da quelle senza perdite e si raffinano col
metodo di Newton nel piano complesso.

TL = -20 log10 |4 pi p| (riferita a 1 m: in acqua illimitata p = exp(ikR)/(4 pi R)). La somma incoerente dei modi
(i termini incrociati si annullano in media sulla distanza) e' il termine di confronto delle tabelle incoerenti.
Fonte: [PEK48]; forma e notazione come in [JKPS11] cap. 2 e 5.
"""
import math
import numpy as np
from scipy.optimize import brentq
from scipy.special import hankel1

from raggi import DB_LAMBDA_IN_ETA


class Pekeris:
    def __init__(self, f, H, c1, c2, rho2, attenuazione=0.0):
        self.f = float(f)
        self.H = float(H)
        self.c1, self.c2, self.rho2 = float(c1), float(c2), float(rho2)
        w = 2 * math.pi * self.f
        self.k1 = w / self.c1
        eta = attenuazione * DB_LAMBDA_IN_ETA
        self.k2 = w / self.c2 * (1 + 1j * eta)
        self.kr = self._radici()
        kz = np.sqrt(self.k1 ** 2 - self.kr ** 2 + 0j)
        g = np.sqrt(self.kr ** 2 - self.k2 ** 2 + 0j)
        g = np.where(g.real < 0, -g, g)
        self.kz, self.gamma = kz, g
        H = self.H
        self.norma = (H / 2 - np.sin(2 * kz * H) / (4 * kz)) + np.sin(kz * H) ** 2 / (2 * g * self.rho2)

    def _radici(self):
        k1, k2r, H, rho2 = self.k1, self.k2.real, self.H, self.rho2
        kzmax = math.sqrt(k1 ** 2 - k2r ** 2)

        def F(kz):
            g = math.sqrt(max(kzmax ** 2 - kz ** 2, 0.0))
            return rho2 * kz * math.cos(kz * H) + g * math.sin(kz * H)

        griglia = np.linspace(1e-9, kzmax * (1 - 1e-12), 20000)
        valori = np.array([F(x) for x in griglia])
        radici = []
        for i in np.nonzero(np.sign(valori[:-1]) * np.sign(valori[1:]) < 0)[0]:
            radici.append(brentq(F, griglia[i], griglia[i + 1], xtol=1e-14))
        kr = np.sqrt(k1 ** 2 - np.array(radici) ** 2).astype(complex)
        if abs(self.k2.imag) > 0:                      # Newton nel piano complesso
            def G(k):
                kz = np.sqrt(k1 ** 2 - k ** 2 + 0j)
                g = np.sqrt(k ** 2 - self.k2 ** 2 + 0j)
                g = np.where(g.real < 0, -g, g)
                return rho2 * kz * np.cos(kz * H) + g * np.sin(kz * H)
            for _ in range(30):
                h = 1e-7 * np.abs(kr)
                d = (G(kr + h) - G(kr - h)) / (2 * h)
                passo = G(kr) / d
                kr = kr - passo
                if np.all(np.abs(passo) < 1e-13 * np.abs(kr)):
                    break
        return kr

    def psi(self, z):
        z = np.atleast_1d(np.asarray(z, dtype=float))
        return np.sin(self.kz[:, None] * z[None, :]) / np.sqrt(self.norma)[:, None]

    def pressione(self, zs, zr, r):
        """p(r) coerente alla quota zr (riferita come in testa)."""
        r = np.asarray(r, dtype=float)
        a = self.psi(zs)[:, 0] * self.psi(zr)[:, 0]
        return 1j / 4 * np.sum(a[:, None] * hankel1(0, self.kr[:, None] * r[None, :]), axis=0)

    def perdita_coerente(self, zs, zr, r):
        return -20 * np.log10(np.abs(4 * math.pi * self.pressione(zs, zr, r)))

    def perdita_incoerente(self, zs, zr, r):
        r = np.asarray(r, dtype=float)
        a = np.abs(self.psi(zs)[:, 0] * self.psi(zr)[:, 0]) ** 2
        termini = a[:, None] * np.exp(-2 * self.kr.imag[:, None] * r[None, :]) / np.abs(self.kr)[:, None]
        I = 2 * math.pi / r * termini.sum(axis=0)
        return -10 * np.log10(I)
