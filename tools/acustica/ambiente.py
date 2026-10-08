"""
ambiente.py - l'ambiente acustico di uno scenario per il tracciatore (raggi.py): profili per regione, fondi,
superficie, bande e assorbimento, letti dallo scenario (shared/data/scenari/<id>.json) e da
shared/data/acustica.json. Le formule sono le stesse di shared/ambiente.js (Mackenzie 1981, Ainslie & McColm 1998),
riscritte qui in Python; le prove di tools/acustica/test_convalida.py controllano che diano gli stessi numeri del file.

Le scelte (ognuna finisce, con fonte e confidenza, nel blocco `propagazione` dello scenario):

- PROFILI. Lo scenario ha un profilo climatologico (WOA23, media di molti anni): la media smussa lo strato isotermo
  che una sonda vedrebbe (lo dice la nota di `ambiente.strato.profondita`). Per i raggi si ricostruisce il profilo
  di una sonda tipo: **strato rimescolato isotermo** fino alla profondita' dello strato dello scenario (21 m), alla
  temperatura e salinita' climatologiche di quella quota; sotto, la climatologia. Nello strato la velocita' cresce
  solo per la pressione (+0,016 m/s per metro): e' il canale superficiale sottile dell'estate.
  Sulla **piattaforma interna** delle Faer Oer, dentro il fronte di marea (100-150 m di fondale), l'acqua e' invece
  rimescolata dalla superficie al fondo tutto l'anno ([LHS09]): li' il profilo e' isotermo, alla temperatura e
  salinita' medie della colonna climatologica fra 0 e il fondale.
- FONDI per classe di fondale ([MASSON03] per la scarpata e il canale, nozionale per la piattaforma), con i
  parametri geoacustici tipici di [JKPS11] (tab. 1.3).
- SUPERFICIE: altezza delle onde dallo stato del mare predefinito (Pierson-Moskowitz, [PM64]), riflessione
  coerente di Eckart ([ECK53]) e perdita per rimbalzo dei raggi radenti di Schulkin ([SCH68]).
- PERDITA AL FONDO IN PIU' del semispazio liscio (nozionale, tarata): vedi PERDITA_FONDO_EXTRA.
"""
import json
import math
import os

import numpy as np

from raggi import Banda, Fondo, Profilo, Superficie

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.normpath(os.path.join(QUI, '..', '..'))
SCENARI = os.path.join(RADICE, 'shared', 'data', 'scenari')
ACUSTICA = os.path.join(RADICE, 'shared', 'data', 'acustica.json')


def valori(nodo):
    """Lo scenario con dati e serie ridotti ai loro numeri (come valoriScenario di shared/ambiente.js)."""
    if isinstance(nodo, dict):
        if 'valore' in nodo and 'confidenza' in nodo:
            return nodo['valore']
        if 'serie' in nodo and 'confidenza' in nodo:
            return list(nodo['serie'])
        return {k: valori(v) for k, v in nodo.items()}
    if isinstance(nodo, list):
        return [valori(v) for v in nodo]
    return nodo


def mackenzie(t, s, d):
    """Velocita' del suono, Mackenzie (1981) [MACK81]; come velocitaSuonoMackenzie di shared/ambiente.js."""
    t = np.asarray(t, dtype=float)
    s = np.asarray(s, dtype=float)
    d = np.asarray(d, dtype=float)
    return (1448.96 + 4.591 * t - 5.304e-2 * t * t + 2.374e-4 * t ** 3 + 1.34 * (s - 35) + 1.63e-2 * d
            + 1.675e-7 * d * d - 1.025e-2 * t * (s - 35) - 7.139e-13 * t * d ** 3)


def ainslie_mccolm(f, t, s, ph, z_km):
    """Assorbimento in dB/km, Ainslie & McColm (1998) [NPL-ABS]; come assorbimentoAinslieMcColm di shared/ambiente.js."""
    fk = f / 1000.0
    f2 = fk * fk
    f1r = 0.78 * math.sqrt(s / 35) * math.exp(t / 26)
    f2r = 42 * math.exp(t / 17)
    return (0.106 * f1r * f2 / (f2 + f1r * f1r) * math.exp((ph - 8) / 0.56)
            + 0.52 * (1 + t / 43) * (s / 35) * f2r * f2 / (f2 + f2r * f2r) * math.exp(-z_km / 6)
            + 0.00049 * f2 * math.exp(-(t / 27 + z_km / 17)))


# --------------------------------------------------------------------------------------------- scelte

# Fondi: parametri geoacustici tipici di [JKPS11] tab. 1.3 (velocita' di compressione per acqua a 1500 m/s,
# densita' relativa, attenuazione di compressione in dB per lunghezza d'onda).
FONDI = {
    'ghiaia': {'nome': 'ghiaia', 'velocita': 1800.0, 'densita': 2.0, 'attenuazione': 0.6},
    'sabbia': {'nome': 'sabbia', 'velocita': 1650.0, 'densita': 1.9, 'attenuazione': 0.8},
    'sabbia_fangosa': {'nome': 'sabbia fangosa (limo)', 'velocita': 1575.0, 'densita': 1.7, 'attenuazione': 1.0},
}

# Classi di fondale (le "regioni"): profondita' della tabella, fondo, profilo, gruppo.
REGIONI = [
    {'id': 'costa_30', 'gruppo': 'costa', 'fondale': 30.0, 'fondo': 'ghiaia', 'profilo': 'rimescolato'},
    {'id': 'costa_60', 'gruppo': 'costa', 'fondale': 60.0, 'fondo': 'ghiaia', 'profilo': 'rimescolato'},
    {'id': 'piattaforma_110', 'gruppo': 'piattaforma', 'fondale': 110.0, 'fondo': 'sabbia', 'profilo': 'rimescolato'},
    {'id': 'piattaforma_190', 'gruppo': 'piattaforma', 'fondale': 190.0, 'fondo': 'sabbia', 'profilo': 'stratificato'},
    {'id': 'scarpata_350', 'gruppo': 'scarpata', 'fondale': 350.0, 'fondo': 'ghiaia', 'profilo': 'stratificato'},
    {'id': 'scarpata_600', 'gruppo': 'scarpata', 'fondale': 600.0, 'fondo': 'sabbia_fangosa', 'profilo': 'stratificato'},
    {'id': 'canale_900', 'gruppo': 'canale', 'fondale': 900.0, 'fondo': 'ghiaia', 'profilo': 'stratificato'},
]

# Quote delle sorgenti e dei ricevitori nelle tabelle (m). In ogni tabella valgono quelle sotto fondale - 1, piu'
# un nodo a fondale - 1 (sul fondo). Fitte vicino alla superficie e intorno allo strato di 21 m: le eliche delle navi
# (5-6 m), la sfera a quota periscopica (13 m), lo strato, poi sempre piu' rade.
QUOTE = [2.0, 5.0, 10.0, 15.0, 20.0, 25.0, 32.0, 45.0, 65.0, 90.0, 125.0, 175.0, 250.0, 350.0, 500.0, 700.0]

# Distanze: progressione geometrica da 25 m, passo del 2,5 % (1 km a 40 km), fino a oltre 300 km.
DISTANZA_PRIMA = 25.0
DISTANZA_RAPPORTO = 1.025
DISTANZE_NUMERO = 382

# Codifica: TL - 20 log10(r) - alfa*r a passi di 0,5 dB in un byte, zero a 100 (da -50 a +77,5 dB).
PASSO_DB = 0.5
ZERO_CODICE = 100

# Bande strette di riferimento per le righe tonali e l'attivo: centro, +-10 %.
BANDE_STRETTE = [50.0, 100.0, 300.0, 1000.0, 3500.0, 25000.0]
LARGHEZZA_STRETTA = 0.10

FRAZIONE_AVANTI = 0.5   # energia diffusa dalla superficie che resta nel raggio (nozionale)
PASSO_PROFILO = 5.0     # m fra i nodi del profilo sotto lo strato (interpolazione PCHIP della climatologia)

# Perdita al fondo in piu' del semispazio liscio (dB per rimbalzo a 2 kHz, scalata con la radice della frequenza):
# nozionale, tarata sulle portate di PROGETTO §5.12 (docs/CALIBRAZIONE_F2.md). Il semispazio fluido da' sotto
# l'angolo critico 0,1-0,7 dB per rimbalzo su sabbia e ghiaia; [FUN-8] riporta da 2 a oltre 30 dB.
PERDITA_FONDO_EXTRA = 4.0
FREQUENZA_FONDO_EXTRA = 2000.0
ESPONENTE_FONDO_EXTRA = 0.5


def quote_tabella(fondale):
    zs = [q for q in QUOTE if q < fondale - 1.0]
    return zs + [fondale - 1.0]


def distanze():
    return DISTANZA_PRIMA * DISTANZA_RAPPORTO ** np.arange(DISTANZE_NUMERO)


def altezza_significativa(vento):
    """Altezza significativa delle onde H_1/3 (m) per mare completamente sviluppato: 0,0246 U10^2
    (Pierson-Moskowitz [PM64], con il vento a 10 m)."""
    return 0.0246 * vento ** 2


def altezza_onde(vento):
    """Altezza quadratica media della superficie (m): H_1/3 / 4."""
    return altezza_significativa(vento) / 4.0


def perdita_schulkin(f, h13):
    """Perdita per rimbalzo in superficie dei canali superficiali, formula empirica di Schulkin (1968) [SCH68]:
    1,64 sqrt(f H) dB con f in kHz e H l'altezza delle onde in piedi (qui H_1/3). Indipendente dalla radenza: e' la
    perdita misurata dei raggi radenti (bolle, diffusione fuori dal canale), che la riflessione coerente di Eckart da
    sola, quasi totale a radenze di pochi gradi, non da'."""
    return 1.64 * math.sqrt(f / 1000.0 * h13 / 0.3048)


class AmbienteScenario:
    """Tutto cio' che serve al tracciatore per uno scenario."""

    def __init__(self, id_scenario='torpex_palestra'):
        self.id = id_scenario
        self.percorso_json = os.path.join(SCENARI, f'{id_scenario}.json')
        with open(self.percorso_json, encoding='utf-8') as f:
            self.grezzi = json.load(f)
        with open(ACUSTICA, encoding='utf-8') as f:
            self.acustica = valori(json.load(f))
        v = valori(self.grezzi)
        self.v = v
        amb = v['ambiente']
        self.z_clim = np.array(amb['profilo']['quota'], dtype=float)
        self.t_clim = np.array(amb['profilo']['temperatura'], dtype=float)
        self.s_clim = np.array(amb['profilo']['salinita'], dtype=float)
        self.strato = float(amb['strato']['profondita'])
        ass = amb['assorbimento']
        self.ass = (float(ass['temperatura']), float(ass['salinita']), float(ass['ph']), float(ass['profondita']) / 1000)
        stato = int(round(amb['mare']['stato_predefinito']))
        self.stato_mare = stato
        self.vento = float(amb['mare']['vento_per_stato'][stato])
        self.sigma_onde = altezza_onde(self.vento)
        self.h13 = altezza_significativa(self.vento)

    # -------------------------------------------------------------------- profili

    def temperatura_strato(self):
        return float(np.interp(self.strato, self.z_clim, self.t_clim)), float(np.interp(self.strato, self.z_clim, self.s_clim))

    def profilo_stratificato(self, fondale):
        """Strato rimescolato isotermo fino a self.strato, poi la climatologia (prolungata oltre l'ultimo livello
        con T e S costanti, come fa lo scenario). Sotto lo strato T e S si interpolano con un polinomio cubico
        monotono a tratti (PCHIP) su nodi ogni PASSO_PROFILO metri: un profilo lineare a tratti sui soli livelli
        standard (fino a 100 m l'uno dall'altro) ha spigoli nel gradiente che i raggi vedono come caustiche finte."""
        from scipy.interpolate import PchipInterpolator
        t_ml, s_ml = self.temperatura_strato()
        sotto = self.z_clim > self.strato
        zc = np.concatenate([[self.strato], self.z_clim[sotto]])
        tc = np.concatenate([[t_ml], self.t_clim[sotto]])
        sc = np.concatenate([[s_ml], self.s_clim[sotto]])
        fondo = max(fondale, zc[-1])
        zz = np.unique(np.concatenate([np.arange(self.strato, zc[-1], PASSO_PROFILO), [zc[-1]]]))
        tt = PchipInterpolator(zc, tc)(zz)
        ss = PchipInterpolator(zc, sc)(zz)
        z = np.concatenate([[0.0], zz])
        t = np.concatenate([[t_ml], tt])
        s = np.concatenate([[s_ml], ss])
        if fondo > z[-1]:
            z = np.append(z, fondo)
            t = np.append(t, t[-1])
            s = np.append(s, s[-1])
        c = mackenzie(t, s, z)
        return Profilo(z, c).tronca(fondale)

    def medie_colonna(self, fondale):
        zz = np.linspace(0.0, fondale, 401)
        return (float(np.mean(np.interp(zz, self.z_clim, self.t_clim))),
                float(np.mean(np.interp(zz, self.z_clim, self.s_clim))))

    def profilo_rimescolato(self, fondale):
        """Colonna rimescolata dalla marea: T e S costanti (le medie climatologiche fra 0 e il fondale)."""
        t, s = self.medie_colonna(fondale)
        z = np.linspace(0.0, fondale, int(math.ceil(fondale / 10.0)) + 1)
        return Profilo(z, mackenzie(t, s, z))

    def profilo(self, regione):
        H = regione['fondale']
        return self.profilo_rimescolato(H) if regione['profilo'] == 'rimescolato' else self.profilo_stratificato(H)

    # -------------------------------------------------------------------- contorni e bande

    def fondo(self, regione):
        p = FONDI[regione['fondo']]
        return Fondo(p['velocita'], p['densita'], p['attenuazione'], perdita_extra=PERDITA_FONDO_EXTRA,
                     frequenza_extra=FREQUENZA_FONDO_EXTRA, esponente_extra=ESPONENTE_FONDO_EXTRA)

    def superficie(self):
        h13 = self.h13
        return Superficie(self.sigma_onde, FRAZIONE_AVANTI, perdita_extra=lambda f: perdita_schulkin(f, h13))

    def assorbimento(self, f):
        t, s, ph, z = self.ass
        return ainslie_mccolm(f, t, s, ph, z)

    def bande(self):
        """Le bande delle tabelle: le due dei sensori a banda larga di acustica.json (ottave) e le strette."""
        out = []
        for nome in ('sfera', 'towed'):
            b = self.acustica['bande'][nome]
            out.append(Banda(nome, b['da'], b['a'], b['centro'], self.assorbimento(b['centro'])))
        for f in BANDE_STRETTE:
            out.append(Banda(f'f{int(f)}', f * (1 - LARGHEZZA_STRETTA), f * (1 + LARGHEZZA_STRETTA), f, self.assorbimento(f)))
        return out
