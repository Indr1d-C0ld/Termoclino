#!/usr/bin/env python3
"""
scarica.py - l'ambiente di uno scenario di Termoclino: batimetria vera, oceanografia, rumore e
georeferenza della mappa del 1989. In F1 c'e' un solo scenario, «torpex_palestra» (l'area di
TORPEX '89 intorno alle Faer Oer).

Uso (Python 3.10+, numpy, scipy; si lancia dalla radice del repo o da qui, e' lo stesso):
    python3 tools/batimetria/scarica.py               rigenera tutto, scaricando solo cio' che manca in cache
    python3 tools/batimetria/scarica.py --rifai       riscarica anche cio' che e' gia' in cache
    python3 tools/batimetria/scarica.py --surfg FILE  mappa SURFG estratta (predefinita
                                                      web/assets/originali/mappe/SURFG.bin)

Scrive:
    shared/data/scenari/torpex_palestra.batimetria.bin  griglia Int16LE (formato in shared/ambiente.js)
    shared/data/scenari/torpex_palestra.json            lo scenario; GENERATO: non si modifica a mano,
                                                        si cambia questo file e lo si rilancia
La cache dei dati scaricati sta in tools/batimetria/cache/ (fuori da git, vedi .gitignore qui accanto):
circa 30 MB di EMODnet, 4 MB di ETOPO e i sottoinsiemi di WOA (dei file WOA, 110 + 70 MB, si tiene solo
il ritaglio dell'area).

Fonti (chiavi di docs/ricerca/FONTI.md):
  [EMODNET-DTM]  EMODnet Bathymetry, DTM 2024, 1/16 di primo d'arco, via ERDDAP. Licenza CC BY 4.0:
                 l'attribuzione e' nel campo `crediti` dello scenario.
  [ETOPO22]      NOAA NCEI ETOPO 2022, 15 secondi d'arco, via OPeNDAP: solo la quota delle terre emerse
                 (EMODnet non la da'). Pubblico dominio.
  [WOA23]        NOAA NCEI World Ocean Atlas 2023, decennio 1985-1994, estate (luglio-settembre),
                 griglia di 0,25 gradi: temperatura e salinita'. Pubblico dominio.
  [NCEP-R1]      NOAA PSL, NCEP/NCAR Reanalysis 1: vento medio mensile 1991-2020 a sigma 0,995.
  [GLODAP2]      GLODAPv2.2016b, climatologia mappata (Lauvset et al. 2016), via EMODnet ERDDAP: pH.
  [EST-688]      la mappa SURFG e lo script SCENE1A.TOK del gioco del 1989, estratti dalla copia
                 dell'utente con tools/estrai/estrai688.py (docs/ASSET.md).

Il metodo, gli errori e le scelte sono spiegati nei commenti qui sotto e, in breve, in
docs/PROGETTO.md §5.1. Il risultato e' deterministico: stessi dati in cache, stessi file.
"""
import argparse, gzip, hashlib, io, json, math, os, re, sys, urllib.request

try:
    import numpy as np
    from scipy import ndimage
    from scipy.io import netcdf_file
except ImportError:
    sys.exit('servono numpy e scipy (pip install numpy scipy)')

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.normpath(os.path.join(QUI, '..', '..'))
CACHE = os.path.join(QUI, 'cache')
SCENARI = os.path.join(RADICE, 'shared', 'data', 'scenari')

# ----------------------------------------------------------------------------- scenario
ID = 'torpex_palestra'
# Origine del piano tangente: 61°45' N, 6°50' W, al centro del campo di gioco originale di TORPEX '89
# (fra Sandoy e Suðuroy) una volta georeferenziato. L'area e' un quadrato di 200 km di lato centrato
# sull'origine: contiene tutto l'arcipelago, il campo originale con un margine di circa 75 km per parte,
# il Canale delle Faer Oer (Faroe Bank Channel, a sud-ovest) e il fianco del Canale Faer Oer-Shetland
# (a sud-est), cioe' acqua profonda vera oltre la piattaforma.
LAT0, LON0 = 61.75, -(6 + 50 / 60)
MEZZO_LATO = 100_000.0           # m
PASSO = 500.0                    # m fra i nodi: 401 x 401 nodi, 314 KiB
# Riquadro geografico da scaricare: contiene l'area con un po' di margine.
LAT_MIN, LAT_MAX, LON_MIN, LON_MAX = 60.80, 62.70, -8.85, -4.80

ERDDAP_EMODNET = 'https://erddap.emodnet.eu/erddap/griddap/'
ETOPO_DAP = ('https://www.ngdc.noaa.gov/thredds/dodsC/global/ETOPO2022/15s/15s_surface_elev_netcdf/'
             'ETOPO_2022_v1_15s_N75W015_surface.nc')
WOA_CSV = 'https://www.ncei.noaa.gov/data/oceans/woa/WOA23/DATA/'
NCEP_DAP = 'https://psl.noaa.gov/thredds/dodsC/Datasets/ncep.reanalysis.derived/surface/wspd.mon.ltm.nc'

# Stagione: estate (luglio-settembre) del decennio 1985-1994. Perche' (vedi anche il JSON):
#  - e' la stagione dello strato: la termoclina stagionale e' al massimo e lo strato superficiale
#    sottile (circa 20 m). Con i dati WOA23 dell'area la stessa analisi da' 4,5 m/s di salto di
#    velocita' in estate, 1,6 a giugno (media di tutti i decenni) e 0,2 in primavera (aprile-giugno):
#    in primavera lo strato quasi non c'e', e la prova d'architettura di F1 («se uno scende sotto lo
#    strato, l'altro lo perde», PROGETTO §11.2) non avrebbe niente da mostrare;
#  - WOA23 ha l'estate del decennio 1985-1994, quello del gioco, alla risoluzione di 0,25 gradi (i
#    mesi singoli di quel decennio solo a 1 grado);
#  - il vento estivo e' il piu' debole dell'anno (mare forza 3 come stato predefinito).
WOA_PERIODO, WOA_DECENNIO, WOA_RIS = 15, '8594', '0.25'
MESI_VENTO = (7, 8, 9)
# Profilo rappresentativo: media dei nodi WOA dentro l'area la cui colonna d'acqua arriva almeno a
# QUOTA_NODI_PROFONDI (a 750 m ci sono tutti e nove: la media non cambia composizione con la quota,
# cosa che un'unica media su tutti i nodi farebbe a ogni livello). Sotto l'ultimo livello si prosegue
# con T e S costanti fino al fondale massimo dell'area.
QUOTA_NODI_PROFONDI = 750.0
# Strato: profondita' dello strato rimescolato con il criterio di soglia 0,2 °C rispetto alla quota di
# 10 m [DBM04]; la base della termoclina stagionale si prende a 100 m (sotto, nel profilo estivo,
# il gradiente termico scende a circa 0,01 °C/m, quello della termoclina permanente).
SOGLIA_STRATO_C, QUOTA_RIF_STRATO, BASE_TERMOCLINA = 0.2, 10.0, 100.0
DB_PER_MS, PERDITA_MAX = 3.0, 15.0     # regola nozionale di 05_acustica.md §5.1
BANDE_HZ = (50, 150, 300, 1000, 3500, 25000)   # le bande di 05_acustica.md §6.3
# Stato del mare -> vento (m/s): centro delle classi nozionali di 05_acustica.md §3.4.
VENTO_PER_STATO = (0.5, 2.5, 4.5, 6.5, 9.0, 12.0, 15.5)
TRAFFICO = 0.4                     # attivita' navale di Coates, 0-1 (nozionale, vedi il JSON)

# ----------------------------------------------------------------------------- utilita'
def avviso(*a):
    print(*a, file=sys.stderr)

def scarica(url, dest, rifai=False):
    """Scarica url in dest (cache), se manca o se si chiede di rifarlo. Restituisce il percorso."""
    if os.path.exists(dest) and not rifai:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    avviso('  scarico', url[:140] + ('...' if len(url) > 140 else ''))
    req = urllib.request.Request(url, headers={'User-Agent': 'termoclino-batimetria/1'})
    with urllib.request.urlopen(req, timeout=600) as r, open(dest + '.parziale', 'wb') as f:
        while True:
            blocco = r.read(1 << 20)
            if not blocco:
                break
            f.write(blocco)
    os.replace(dest + '.parziale', dest)
    return dest

def sha256(percorso):
    h = hashlib.sha256()
    with open(percorso, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()

def q(v, n):
    """Arrotonda per il JSON (e restituisce un float Python, non numpy)."""
    return float(round(float(v), n))

# ----------------------------------------------------------------------------- proiezione
# Copia esatta di shared/geo.js (ProiezioneLocale): azimutale equidistante sulla sfera di Gauss
# nel punto d'origine. Le prove JavaScript controllano che le posizioni scritte qui tornino.
WGS84_A, WGS84_F = 6378137.0, 1 / 298.257223563
WGS84_E2 = WGS84_F * (2 - WGS84_F)

def raggio_gauss(lat):
    s = math.sin(math.radians(lat)); w = 1 - WGS84_E2 * s * s
    return WGS84_A * math.sqrt(1 - WGS84_E2) / w

class Proiezione:
    def __init__(self, lat0, lon0):
        self.lat0, self.lon0, self.r = lat0, lon0, raggio_gauss(lat0)
        self.p0 = math.radians(lat0); self.s0 = math.sin(self.p0); self.c0 = math.cos(self.p0)
        self.l0 = math.radians(lon0)

    def in_piano(self, lat, lon):
        phi = np.radians(lat); dl = np.radians((np.asarray(lon, float) - self.lon0 + 180) % 360 - 180)
        sp, cp = np.sin(phi), np.cos(phi)
        sdp, sdl = np.sin((phi - self.p0) / 2), np.sin(dl / 2)
        h = np.minimum(1, sdp * sdp + self.c0 * cp * sdl * sdl)
        c = 2 * np.arctan2(np.sqrt(h), np.sqrt(1 - h))
        k = np.where(c < 1e-9, 1 + c * c / 6, c / np.where(c < 1e-9, 1, np.sin(c)))
        return self.r * k * cp * np.sin(dl), self.r * k * (self.c0 * sp - self.s0 * cp * np.cos(dl))

    def in_geografiche(self, x, y):
        rho = math.hypot(x, y)
        if rho < 1e-6:
            return self.lat0, self.lon0
        c = rho / self.r; sc, cc = math.sin(c), math.cos(c)
        phi = math.asin(max(-1, min(1, cc * self.s0 + y * sc * self.c0 / rho)))
        lam = self.l0 + math.atan2(x * sc, rho * self.c0 * cc - y * self.s0 * sc)
        lon = (math.degrees(lam) + 180) % 360 - 180
        return math.degrees(phi), lon

# ----------------------------------------------------------------------------- batimetria
def leggi_emodnet(rifai):
    url = (f'{ERDDAP_EMODNET}bathymetry_dtm_2024.nc?elevation'
           f'%5B({LAT_MIN:.2f}):1:({LAT_MAX:.2f})%5D%5B({LON_MIN:.2f}):1:({LON_MAX:.2f})%5D')
    p = scarica(url, os.path.join(CACHE, f'emodnet_dtm2024_{LAT_MIN}_{LAT_MAX}_{LON_MIN}_{LON_MAX}.nc'), rifai)
    f = netcdf_file(p, 'r', mmap=False)
    lat = f.variables['latitude'][:].astype(float).copy()
    lon = f.variables['longitude'][:].astype(float).copy()
    elev = f.variables['elevation'][:].astype(np.float32).copy()
    f.close()
    return lat, lon, elev

def leggi_etopo(rifai):
    """Quote ETOPO 2022 15" sul riquadro, via OPeNDAP in ASCII (la mattonella N75W015 copre 60-75 N,
    15 W-0; i nodi sono al centro delle celle: lat = 60 + (i + 0,5)/240)."""
    i0 = int(math.floor((LAT_MIN - 60) * 240)); i1 = int(math.ceil((LAT_MAX - 60) * 240))
    j0 = int(math.floor((LON_MIN + 15) * 240)); j1 = int(math.ceil((LON_MAX + 15) * 240))
    url = f'{ETOPO_DAP}.ascii?z%5B{i0}:1:{i1}%5D%5B{j0}:1:{j1}%5D'
    p = scarica(url, os.path.join(CACHE, f'etopo2022_15s_{i0}_{i1}_{j0}_{j1}.txt'), rifai)
    righe = []
    with open(p, encoding='ascii') as f:
        for riga in f:
            m = re.match(r'^\[(\d+)\], (.*)$', riga.strip())
            if m and riga.startswith('['):
                righe.append([float(v) for v in m.group(2).split(',')])
    z = np.array(righe, dtype=np.float32)
    if z.shape != (i1 - i0 + 1, j1 - j0 + 1):
        sys.exit(f'ETOPO: forma inattesa {z.shape}')
    lat = 60 + (np.arange(i0, i1 + 1) + 0.5) / 240
    lon = -15 + (np.arange(j0, j1 + 1) + 0.5) / 240
    return lat, lon, z

def accumula(proj, lat, lon, campi, passo, x_min, y_max, nx, ny):
    """Somma per nodo (cella di `passo` m centrata sul nodo) di piu' campi su una griglia lat/lon
    regolare. campi: dict nome -> funzione(valori di una riga) -> array di pesi/valori. Le righe si
    proiettano una alla volta per non tenere in memoria milioni di coordinate."""
    tot = {k: np.zeros(nx * ny) for k in campi}
    for i in range(len(lat)):
        x, y = proj.in_piano(np.full(len(lon), lat[i]), lon)
        jj = np.rint((x - x_min) / passo).astype(np.int64)
        ii = np.rint((y_max - y) / passo).astype(np.int64)
        ok = (jj >= 0) & (jj < nx) & (ii >= 0) & (ii < ny)
        if not ok.any():
            continue
        idx = ii[ok] * nx + jj[ok]
        for k, fn in campi.items():
            tot[k] += np.bincount(idx, weights=fn(i)[ok], minlength=nx * ny)
    return {k: v.reshape(ny, nx) for k, v in tot.items()}

def griglia(proj, emod, etopo, passo, mezzo_lato):
    """Batimetria del piano locale. Per ogni nodo (cella di `passo` m centrata sul nodo):
    - mare se i campioni EMODnet di mare (quota < 0 sul LAT) sono la maggioranza: profondita' media
      dei soli campioni di mare;
    - terra se la maggioranza sono campioni EMODnet emersi (quota >= 0): quota media ETOPO delle celle
      emerse (almeno 1 m), col segno meno;
    - se la maggioranza sono celle vuote di EMODnet (NaN: terra, ma anche stretti e fiordi senza
      rilievi, fra le isole del nord), decide ETOPO: mare con la sua profondita' media se la media e'
      sotto lo zero, altrimenti terra.
    Restituisce la griglia Int16 e il numero di nodi decisi da ETOPO."""
    n = int(round(2 * mezzo_lato / passo)) + 1
    x_min, y_max = -mezzo_lato, mezzo_lato
    lat, lon, el = emod
    vuoto = np.isnan(el)
    mare = ~vuoto & (el < 0)
    a = accumula(proj, lat, lon, {
        'n_mare': lambda i: mare[i].astype(float),
        'somma': lambda i: np.where(mare[i], -el[i], 0.0),
        'n_su': lambda i: (~vuoto[i] & ~mare[i]).astype(float),
        'n_vuoti': lambda i: vuoto[i].astype(float),
    }, passo, x_min, y_max, n, n)
    lat_e, lon_e, z = etopo
    b = accumula(proj, lat_e, lon_e, {
        'n': lambda i: np.ones(len(lon_e)),
        'n_su': lambda i: (z[i] > 0).astype(float),
        'somma_su': lambda i: np.where(z[i] > 0, z[i], 0.0),
        'somma': lambda i: z[i].astype(float),
    }, passo, x_min, y_max, n, n)
    if (b['n'] == 0).any():
        sys.exit('nodi senza campioni ETOPO: allargare il riquadro scaricato')
    et = b['somma'] / b['n']
    quota = np.where(b['n_su'] > 0, b['somma_su'] / np.maximum(b['n_su'], 1), 1.0)
    prof = a['somma'] / np.maximum(a['n_mare'], 1)
    senza = (a['n_mare'] + a['n_su'] + a['n_vuoti']) == 0      # nessun campione EMODnet: decide ETOPO
    piu_mare = ~senza & (a['n_mare'] >= np.maximum(a['n_su'], a['n_vuoti']))
    piu_su = ~senza & ~piu_mare & (a['n_su'] >= a['n_vuoti'])
    decide_etopo = ~piu_mare & ~piu_su
    out = np.where(piu_mare, np.maximum(1, np.rint(prof)), -np.maximum(1, np.rint(quota)))
    out = np.where(decide_etopo & (et < 0), np.maximum(1, np.rint(-et)), out)
    return np.clip(out, -32767, 32767).astype('<i2'), int((decide_etopo & (et < 0)).sum())

# ----------------------------------------------------------------------------- georeferenza
# La mappa SURFG del 1989 (319 x 200 celle, 16 livelli). Quello che si e' ricavato dal gioco e dalle
# schermate DOSBox (docs/ASSET.md §4.3, schermate 025 e 027 del catalogo):
#  - le coordinate X, Y degli script sono in unita' che il gioco mostra come gradi:primi:secondi con
#    2" per unita', ma sono isotrope (una rotta a 45° fra due punti di script si vede a 316° a schermo)
#    e non sono gradi veri: la scala reale, ricavata qui, e' circa 20 m per unita' (non 61,7);
#  - cella (colonna, riga) = (floor(X / 32), 199 - floor(Y / 32)): X verso est, Y verso nord, riga 0
#    in alto; la mappa vista nel gioco coincide cella per cella con questa lettura (errore medio 0,02
#    livelli su tutta la finestra della mappa alla scala piu' vicina, 6 unita' per pixel);
#  - i livelli sono rovesciati rispetto a docs/ASSET.md: 15 = terra, 14 = costa, 13 ... 0 = acqua
#    sempre piu' profonda (il gioco disegna il colore 0BFh + 4 * (15 - n)).
# Georeferenza: affinita' (6 parametri) fra (X, Y) del gioco e (x, y) del piano locale, ai minimi
# quadrati su punti di controllo: i baricentri delle isole (o gruppi di isole che alla risoluzione
# della mappa si fondono) e le punte nord e sud delle tre isole lunghe, presi sia sulla mappa del 1989
# sia sulla linea di costa EMODnet ricampionata a 250 m.
SURFG_ISOLE = [
    # nome, celle-seme SURFG (colonna, riga) o rettangolo ('r', c0, c1, r0, r1), semi reali (lat, lon), punte
    ('Suðuroy', [(170, 168)], [(61.55, -6.85)], True),
    ('Sandoy', [(170, 113)], [(61.84, -6.78)], True),
    ('Stóra Dímun', [(175, 142)], [(61.693, -6.752)], False),
    ('Vágar', [(132, 79)], [(62.08, -7.25)], False),
    ('Mykines', [('r', 100, 110, 74, 82)], [(62.103, -7.62)], False),
    ('Streymoy + Eysturoy', [(156, 75), (171, 59)], [(62.10, -6.98)], True),
    ('Borðoy, Kunoy, Viðoy, Kalsoy', [(195, 52), (178, 42), (198, 32)], [(62.24, -6.55), (62.30, -6.73)], False),
    ('Svínoy + Fugloy', [(215, 48), (209, 36)], [(62.27, -6.35), (62.33, -6.30)], False),
]

def punte(x, y, quale, frazione=0.04):
    """Punta nord o sud di un'isola lungo il suo asse principale: media dei punti nel 4 % estremo."""
    cx, cy = x.mean(), y.mean()
    A = np.stack([x - cx, y - cy])
    _, v = np.linalg.eigh(A @ A.T)
    asse = v[:, 1] if v[1, 1] >= 0 else -v[:, 1]
    t = asse @ A
    sel = t >= np.quantile(t, 1 - frazione) if quale == 'N' else t <= np.quantile(t, frazione)
    return np.array([x[sel].mean(), y[sel].mean()])

def georeferenza(surfg_path, proj, emod):
    g = np.fromfile(surfg_path, dtype=np.uint8)
    if g.size != 319 * 200:
        sys.exit(f'{surfg_path}: dimensione inattesa ({g.size} byte, attesi 63800)')
    g = g.reshape(200, 319)
    terra_s = g >= 15
    lab_s, _ = ndimage.label(terra_s)
    # costa reale ricampionata a 250 m sul piano dello scenario
    passo, mezzo = 250.0, 100_000.0
    n = int(round(2 * mezzo / passo)) + 1
    lat, lon, el = emod
    mare = ~np.isnan(el) & (el < 0)
    a = accumula(proj, lat, lon, {'m': lambda i: mare[i].astype(float), 't': lambda i: (~mare[i]).astype(float)},
                 passo, -mezzo, mezzo, n, n)
    terra_r = a['t'] > a['m']
    lab_r, _ = ndimage.label(terra_r)
    xs = -mezzo + np.arange(n) * passo; ys = mezzo - np.arange(n) * passo
    punti = []   # (nome, X, Y, x, y)
    for nome, semi_s, semi_r, con_punte in SURFG_ISOLE:
        m = np.zeros_like(terra_s)
        for s in semi_s:
            if s[0] == 'r':
                _, c0, c1, r0, r1 = s
                rett = np.zeros_like(terra_s); rett[r0:r1 + 1, c0:c1 + 1] = True
                m |= rett & terra_s
            else:
                c, r = s
                if not terra_s[r, c]:
                    sys.exit(f'SURFG: il seme {s} di {nome} non e\' terra')
                m |= lab_s == lab_s[r, c]
        rr, cc = np.nonzero(m)
        X = (cc + 0.5) * 32.0; Y = (199 - rr + 0.5) * 32.0
        mr = np.zeros_like(terra_r)
        for la, lo in semi_r:
            x, y = proj.in_piano(la, lo)
            i = int(round((mezzo - float(y)) / passo)); j = int(round((float(x) + mezzo) / passo))
            win = terra_r[i - 6:i + 7, j - 6:j + 7]
            if not win.any():
                sys.exit(f'costa reale: nessuna terra entro 1,5 km dal seme {la}, {lo} ({nome})')
            di, dj = np.argwhere(win)[np.argmin([(a_ - 6) ** 2 + (b_ - 6) ** 2 for a_, b_ in np.argwhere(win)])]
            mr |= lab_r == lab_r[i - 6 + di, j - 6 + dj]
        ir, jr = np.nonzero(mr)
        x = xs[jr]; y = ys[ir]
        punti.append((nome + ', baricentro', X.mean(), Y.mean(), x.mean(), y.mean()))
        if con_punte:
            for qu in ('N', 'S'):
                ps = punte(X, Y, qu); pr = punte(x, y, qu)
                punti.append((f'{nome}, punta {qu}', ps[0], ps[1], pr[0], pr[1]))
    P = np.array([p[1:] for p in punti])
    A = np.column_stack([P[:, 0], P[:, 1], np.ones(len(P))])
    sol, *_ = np.linalg.lstsq(A, P[:, 2:], rcond=None)
    res = np.hypot(*(A @ sol - P[:, 2:]).T)
    coeff = [float(v) for v in (sol[0, 0], sol[1, 0], sol[2, 0], sol[0, 1], sol[1, 1], sol[2, 1])]
    return coeff, [(p[0], float(r)) for p, r in zip(punti, res)]

def da_gioco(coeff, X, Y):
    a, b, c, d, e, f = coeff
    return a * X + b * Y + c, d * X + e * Y + f

# ----------------------------------------------------------------------------- oceanografia
def mackenzie(T, S, D):
    """Velocita' del suono, Mackenzie (1981) [MACK81] via [NPL-SS]; T °C, S psu, D m."""
    return (1448.96 + 4.591 * T - 5.304e-2 * T ** 2 + 2.374e-4 * T ** 3 + 1.340 * (S - 35)
            + 1.630e-2 * D + 1.675e-7 * D ** 2 - 1.025e-2 * T * (S - 35) - 7.139e-13 * T * D ** 3)

def ainslie_mccolm(f_hz, T, S, pH, z_km):
    """Assorbimento, dB/km [NPL-ABS] (05_acustica.md §2.2)."""
    f = f_hz / 1000; f1 = 0.78 * math.sqrt(S / 35) * math.exp(T / 26); f2 = 42 * math.exp(T / 17)
    return (0.106 * f1 * f * f / (f * f + f1 * f1) * math.exp((pH - 8) / 0.56)
            + 0.52 * (1 + T / 43) * (S / 35) * f2 * f * f / (f * f + f2 * f2) * math.exp(-z_km / 6)
            + 0.00049 * f * f * math.exp(-(T / 27 + z_km / 17)))

def coates(f_hz, s, w):
    """Rumore ambiente di Coates, dB re 1 µPa²/Hz [STOJ06 eq. 6] (05_acustica.md §3.2)."""
    f = f_hz / 1000; L = math.log10
    termini = (17 - 30 * L(f), 40 + 20 * (s - 0.5) + 26 * L(f) - 60 * L(f + 0.03),
               50 + 7.5 * math.sqrt(w) + 20 * L(f) - 40 * L(f + 0.4), -15 + 20 * L(f))
    return 10 * L(sum(10 ** (t / 10) for t in termini))

def leggi_woa(var, rifai):
    """Ritaglio dell'area da un file CSV WOA23 (si scorre il gzip senza tenerlo tutto)."""
    nome = f'woa23_{WOA_DECENNIO}_{var}{WOA_PERIODO:02d}an04.csv.gz'
    tipo = {'t': 'temperature', 's': 'salinity'}[var]
    sub = os.path.join(CACHE, nome.replace('.csv.gz', f'_{LAT_MIN}_{LAT_MAX}_{LON_MIN}_{LON_MAX}.csv'))
    if rifai or not os.path.exists(sub):
        url = f'{WOA_CSV}{tipo}/csv/{WOA_DECENNIO}/{WOA_RIS}/{nome}'
        avviso('  scarico e ritaglio', url)
        req = urllib.request.Request(url, headers={'User-Agent': 'termoclino-batimetria/1'})
        tenute = []
        with urllib.request.urlopen(req, timeout=900) as r, gzip.open(r, 'rt', encoding='ascii') as f:
            for riga in f:
                if riga.startswith('#'):
                    tenute.append(riga); continue
                la, lo = riga.split(',', 2)[:2]
                if LAT_MIN - 0.25 <= float(la) <= LAT_MAX + 0.25 and LON_MIN - 0.25 <= float(lo) <= LON_MAX + 0.25:
                    tenute.append(riga)
        os.makedirs(CACHE, exist_ok=True)
        with open(sub, 'w', encoding='ascii') as f:
            f.writelines(tenute)
    quote, nodi = None, {}
    with open(sub, encoding='ascii') as f:
        for riga in f:
            if riga.startswith('#'):
                if 'DEPTHS' in riga:
                    quote = np.array([float(v) for v in riga.split(':', 1)[1].split(',') if v.strip()])
                continue
            p = riga.rstrip('\n').split(',')
            vals = [float(v) if v.strip() else np.nan for v in p[2:]]
            vals += [np.nan] * (len(quote) - len(vals))
            nodi[(float(p[0]), float(p[1]))] = np.array(vals[:len(quote)])
    return quote, nodi

def leggi_vento(rifai):
    """Vento medio mensile 1991-2020 NCEP/NCAR R1 (sigma 0,995) sui punti di griglia (2,5°) intorno
    all'area: 60 e 62,5 N, 7,5 e 5 W."""
    url = f'{NCEP_DAP}.ascii?wspd%5B0:1:11%5D%5B11:1:12%5D%5B141:1:142%5D'
    p = scarica(url, os.path.join(CACHE, 'ncep_r1_wspd_ltm_60-62.5N_7.5-5W.txt'), rifai)
    v = {}
    with open(p, encoding='ascii') as f:
        for riga in f:
            m = re.match(r'^\[(\d+)\]\[(\d+)\], (.*)$', riga.strip())
            if m:
                v[(int(m.group(1)), int(m.group(2)))] = [float(t) for t in m.group(3).split(',')]
    if len(v) != 24:
        sys.exit('NCEP: risposta inattesa')
    return v

def leggi_ph(rifai):
    url = (f'{ERDDAP_EMODNET}GLODAPv2_2016b_CMEMS.csv?pHtsinsitutp%5B(2020-01-01)%5D%5B(0):(300)%5D'
           f'%5B(60.5):(62.5)%5D%5B(351.5):(355.5)%5D')
    p = scarica(url, os.path.join(CACHE, 'glodap2_ph_0-300m.csv'), rifai)
    vals = []
    with open(p, encoding='utf-8') as f:
        for riga in f.readlines()[2:]:
            t = riga.strip().split(',')
            if len(t) == 5 and t[4] not in ('', 'NaN'):
                vals.append(float(t[4]))
    return np.array(vals)

# ----------------------------------------------------------------------------- dati con provenienza
def dato(valore, unita, fonte, confidenza, nota=None, rif=None):
    d = {'valore': valore}
    if unita is not None:
        d['unita'] = unita
    d['fonte'] = fonte; d['confidenza'] = confidenza
    if nota: d['nota'] = nota
    if rif: d['rif'] = rif
    return d

def serie(valori, unita, fonte, confidenza, nota=None):
    d = {'serie': valori, 'unita': unita, 'fonte': fonte, 'confidenza': confidenza}
    if nota: d['nota'] = nota
    return d

FG = '[EST-688] [EMODNET-DTM]'          # posizioni dal gioco, georeferenziate sulla costa EMODnet
def m(v, fonte=FG, conf='calcolato', nota=None):
    return dato(int(round(v)), 'm', fonte, conf, nota)
def punto(x, y, fonte=FG, conf='calcolato'):
    return {'x': m(x, fonte, conf), 'y': m(y, fonte, conf)}
def script(Xg, Yg):
    """Coordinate originali dello script, per rifare la conversione (unita' di script, adimensionali)."""
    return {'X': dato(Xg, '1', '[EST-688]', 'documentato'), 'Y': dato(Yg, '1', '[EST-688]', 'documentato')}

def it(v, cifre):
    """Numero per i testi dello scenario, con la virgola decimale."""
    return f'{v:.{cifre}f}'.replace('.', ',')

def geo_testo(proj, x, y):
    la, lo = proj.in_geografiche(x, y)
    return f"{it(abs(la), 4)} {'N' if la >= 0 else 'S'}, {it(abs(lo), 4)} {'W' if lo < 0 else 'E'}"

def rotta(da, a):
    return (math.degrees(math.atan2(a[0] - da[0], a[1] - da[1])) + 360) % 360

# ----------------------------------------------------------------------------- unita' di TORPEX '89
# Dallo script SCENE1A.TOK (lato 688, giocatore singolo), coordinate del gioco in unita' di script.
# Velocita' 0C80h = 3200/320 = 10 nodi per i tre cacciatorpediniere; il primo si ferma dopo un breve
# tratto, gli altri due vanno al waypoint comune a nord-ovest e si fermano (SPEED_TO 0).
TORPEX = {
    'partenze_688': [((5760, 1568), 270), ((5568, 1376), 320), ((5184, 2112), 170)],  # tre alternative casuali
    'cacciatorpediniere': [((5216, 1792), (5120, 1920)), ((5312, 1696), (4096, 2944)), ((5440, 1600), (4096, 2944))],
    'biologico': (5440, 1888),                     # tipo 25, quota 150 ft, fermo
    'seahawk': [(4096, 1696), (6688, 2272)],       # esclusi in F1, citati nella nota
    'alfa': (5024, 2176),
}

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--rifai', action='store_true', help='riscarica anche cio\' che e\' in cache')
    ap.add_argument('--surfg', default=os.path.join(RADICE, 'web', 'assets', 'originali', 'mappe', 'SURFG.bin'))
    args = ap.parse_args()
    proj = Proiezione(LAT0, LON0)
    os.makedirs(SCENARI, exist_ok=True)
    json_path = os.path.join(SCENARI, f'{ID}.json')
    bin_path = os.path.join(SCENARI, f'{ID}.batimetria.bin')

    avviso('batimetria')
    emod = leggi_emodnet(args.rifai)
    etopo = leggi_etopo(args.rifai)
    grid, da_etopo = griglia(proj, emod, etopo, PASSO, MEZZO_LATO)
    grid.tofile(bin_path)
    n = grid.shape[0]
    acqua = grid[grid > 0]
    avviso(f'  {n} x {n} nodi, {os.path.getsize(bin_path)} byte; terra {100 * (grid <= 0).mean():.1f} %, '
           f'fondale massimo {acqua.max()} m, nodi di mare decisi da ETOPO {da_etopo}')

    g = grid.astype(float)

    def fondale(x, y):
        """Bilineare sui nodi, come shared/ambiente.js."""
        fj = (x + MEZZO_LATO) / PASSO; fi = (MEZZO_LATO - y) / PASSO
        j0 = min(max(int(math.floor(fj)), 0), n - 2); i0 = min(max(int(math.floor(fi)), 0), n - 2)
        tj, ti = fj - j0, fi - i0
        return ((1 - ti) * ((1 - tj) * g[i0, j0] + tj * g[i0, j0 + 1])
                + ti * ((1 - tj) * g[i0 + 1, j0] + tj * g[i0 + 1, j0 + 1]))

    avviso('georeferenza della mappa del 1989')
    if os.path.exists(args.surfg):
        coeff, residui = georeferenza(args.surfg, proj, emod)
    else:
        # Senza la copia del gioco si riusano i coefficienti gia' calcolati (nel JSON precedente).
        try:
            with open(json_path, encoding='utf-8') as f:
                vecchio = json.load(f)['georeferenza_1989']
            coeff = [vecchio['coefficienti'][k]['valore'] for k in ('a', 'b', 'c', 'd', 'e', 'f')]
            residui = [(p['punto'], p['residuo']['valore']) for p in vecchio['punti_di_controllo']]
            avviso(f'  {args.surfg} non c\'e\': riuso i coefficienti dello scenario esistente')
        except (OSError, KeyError, ValueError):
            sys.exit(f'serve la mappa SURFG estratta ({args.surfg}): tools/estrai/estrai688.py ... --client')
    rms = math.sqrt(sum(r * r for _, r in residui) / len(residui))
    for nome, r in residui:
        avviso(f'  {nome:<45s} {r / 1000:5.1f} km')
    avviso(f'  scarto quadratico medio {rms / 1000:.2f} km, massimo {max(r for _, r in residui) / 1000:.2f} km')
    a, b, c, d, e, f = coeff

    avviso('oceanografia')
    quote, T = leggi_woa('t', args.rifai)
    _, S = leggi_woa('s', args.rifai)
    scelti = []
    for (la, lo), t in sorted(T.items()):
        x, y = proj.in_piano(la, lo)
        nliv = int(np.sum(~np.isnan(t)))
        if abs(x) <= MEZZO_LATO and abs(y) <= MEZZO_LATO and nliv and quote[nliv - 1] >= QUOTA_NODI_PROFONDI:
            scelti.append((la, lo))
    TT = np.array([T[p] for p in scelti]); SS = np.array([S[p] for p in scelti])
    kmax = int(np.searchsorted(quote, QUOTA_NODI_PROFONDI))
    z_woa = quote[:kmax + 1]
    t_m = TT[:, :kmax + 1].mean(0); s_m = SS[:, :kmax + 1].mean(0)
    fondo_max = float(acqua.max())
    estensione = [zz for zz in (800, 900, 1000, 1100, 1200, 1300, 1400, 1500) if zz - 100 < fondo_max]
    z_prof = np.concatenate([z_woa, estensione]); t_prof = np.concatenate([t_m, [t_m[-1]] * len(estensione)])
    s_prof = np.concatenate([s_m, [s_m[-1]] * len(estensione)])
    c_prof = mackenzie(t_prof, s_prof, z_prof)
    # strato: soglia di 0,2 °C rispetto a 10 m, interpolando fra i livelli standard
    t10 = float(np.interp(QUOTA_RIF_STRATO, z_prof, t_prof))
    zz = np.arange(QUOTA_RIF_STRATO, 300.01, 0.1)
    z_strato = float(zz[np.argmax(np.interp(zz, z_prof, t_prof) < t10 - SOGLIA_STRATO_C)])
    c_strato = float(np.interp(z_strato, z_prof, c_prof)); c_base = float(np.interp(BASE_TERMOCLINA, z_prof, c_prof))
    salto = c_strato - c_base
    perdita = min(PERDITA_MAX, DB_PER_MS * salto)
    i_min = int(np.argmin(c_prof))
    avviso(f'  {len(scelti)} nodi WOA profondi; strato {z_strato:.1f} m, salto {salto:.2f} m/s -> {perdita:.1f} dB; '
           f'c superficie {c_prof[0]:.1f}, minimo {c_prof[i_min]:.1f} a {z_prof[i_min]:.0f} m')
    # temperatura e salinita' medie dei primi 300 m (per l'assorbimento)
    zz = np.arange(0, 300.01, 1.0)
    t_300 = float(np.trapezoid(np.interp(zz, z_prof, t_prof), zz) / 300)
    s_300 = float(np.trapezoid(np.interp(zz, z_prof, s_prof), zz) / 300)
    ph = leggi_ph(args.rifai)
    ph_m = float(np.mean(ph))
    vento = leggi_vento(args.rifai)
    v_mesi = {mm: float(np.mean([vento[(mm - 1, la)][lo] for la in (0, 1) for lo in (0, 1)])) for mm in range(1, 13)}
    v_stag = float(np.mean([v_mesi[mm] for mm in MESI_VENTO]))
    stato_mare = min(range(len(VENTO_PER_STATO)), key=lambda k: abs(VENTO_PER_STATO[k] - v_stag))
    avviso(f'  T 0-300 m {t_300:.2f} °C, S {s_300:.3f}, pH {ph_m:.3f} ({len(ph)} valori), vento estivo '
           f'{v_stag:.2f} m/s -> mare {stato_mare}')
    PH, ZASS = round(ph_m, 2), 0.1
    T_ASS, S_ASS = round(t_300, 1), round(s_300, 2)

    # ------------------------------------------------------------------ unita'
    def conv(Xg, Yg):
        return da_gioco(coeff, Xg, Yg)

    nota_georef = ('Posizione del gioco del 1989 convertita con la georeferenza di questo scenario '
                   f'(affinità sulla costa; incertezza circa {it(rms / 1000, 1)} km, vedi georeferenza_1989).')
    unita_orig = []
    navi = []
    nomi_dd = ['DD-1', 'DD-2', 'DD-3']
    for k, ((p0, p1), nome) in enumerate(zip(TORPEX['cacciatorpediniere'], nomi_dd)):
        x0, y0 = conv(*p0); x1, y1 = conv(*p1)
        prof0 = fondale(x0, y0); prof1 = fondale(x1, y1)
        navi.append({
            'id': f'dd{k + 1}', 'nome': nome, 'classe': 'cacciatorpediniere',
            'piattaforma': 'forrest_sherman',
            'descrizione': 'Cacciatorpediniere classe Forrest Sherman radiato, radiocomandato (ordini di TORPEX \'89).',
            'x': m(x0, nota=f'{geo_testo(proj, x0, y0)}; fondale {prof0:.0f} m. Script: X {p0[0]}, Y {p0[1]}. ' + nota_georef),
            'y': m(y0),
            'script_1989': script(*p0),
            'rotta': dato(int(round(rotta((x0, y0), (x1, y1)))), '°', FG, 'calcolato', 'Verso il primo waypoint.'),
            'velocita': dato(10, 'kt', '[EST-688]', 'documentato', 'SPEED 0C80h = 3200/320 = 10 nodi nello script.'),
            'quota': dato(0, 'm', '[EST-688]', 'documentato', 'Nave di superficie.'),
            'waypoint': [dict(punto(x1, y1), script_1989=script(*p1),
                              nota=f'{geo_testo(proj, x1, y1)}; fondale {prof1:.0f} m. Script: X {p1[0]}, Y {p1[1]}.')],
            'al_termine': 'ferma',
            'nota_al_termine': 'Nello script, arrivato al waypoint il cacciatorpediniere si ferma (SPEED_TO 0).',
        })
        unita_orig.append((nome, x0, y0, prof0)); unita_orig.append((nome + ' wp', x1, y1, prof1))

    # Mercantile: in uscita da Torshavn verso la Scozia (Scrabster/Aberdeen), rotta per sud-est che passa
    # a est di Nolsoy e attraversa il campo di TORPEX a levante dei cacciatorpediniere.
    p_merc = [(61.995, -6.62), (61.70, -6.30), (61.05, -5.20)]
    xy_merc = [tuple(float(v) for v in proj.in_piano(la, lo)) for la, lo in p_merc]
    for (x, y) in xy_merc:
        if abs(x) > MEZZO_LATO or abs(y) > MEZZO_LATO:
            sys.exit('mercantile fuori area')
    nota_merc = ('Rotta plausibile, non storica: dall\'uscita del porto di Tórshavn a est di Nólsoy verso '
                 'sud-est (Scozia), al bordo dell\'area.')
    navi.append({
        'id': 'merc1', 'nome': 'mercantile', 'classe': 'mercantile', 'piattaforma': 'mercantile_generico',
        'descrizione': 'Piccolo mercantile da carico in servizio fra le Fær Øer e la Scozia.',
        'x': m(xy_merc[0][0], '[EMODNET-DTM]', 'nozionale', f'{geo_testo(proj, *xy_merc[0])}; fondale '
               f'{fondale(*xy_merc[0]):.0f} m. ' + nota_merc),
        'y': m(xy_merc[0][1], '[EMODNET-DTM]', 'nozionale'),
        'rotta': dato(int(round(rotta(xy_merc[0], xy_merc[1]))), '°', '[EMODNET-DTM]', 'calcolato', 'Verso il primo waypoint.'),
        'velocita': dato(12, 'kt', '[CONO]', 'nozionale',
                         'Velocità di servizio tipica di un piccolo mercantile degli anni \'80; nel gioco del 1989 i '
                         'MERCHANT SHIP hanno 15 nodi di massima.'),
        'quota': dato(0, 'm', '[CONO]', 'nozionale', 'Nave di superficie.'),
        'waypoint': [dict(punto(x, y, '[EMODNET-DTM]', 'nozionale'), nota=f'{geo_testo(proj, x, y)}; fondale {fondale(x, y):.0f} m.')
                     for x, y in xy_merc[1:]],
        'al_termine': 'ciclo',
        'nota_al_termine': 'Dopo l\'ultimo waypoint torna navigando al punto di partenza e ricomincia (viaggio di ritorno: '
                           'traffico continuo nella palestra).',
    })

    # Biologici: la «balena» dello script (tipo 25, 150 ft, ferma) e un branco di globicefali sul margine
    # della piattaforma a ovest di Suðuroy (nozionale: la specie e' comune alle Faer Oer).
    xb, yb = conv(*TORPEX['biologico'])
    bio2 = proj.in_piano(61.50, -7.45)
    biologici = [
        {'id': 'bio1', 'nome': 'balena', 'tipo': 'cetaceo',
         'x': m(xb, nota=f'{geo_testo(proj, xb, yb)}; fondale {fondale(xb, yb):.0f} m. Script: X '
                f'{TORPEX["biologico"][0]}, Y {TORPEX["biologico"][1]} (unità BIOLOGICAL, tipo 25). ' + nota_georef),
         'y': m(yb),
         'script_1989': script(*TORPEX['biologico']),
         'quota': dato(46, 'm', '[EST-688]', 'documentato', 'DEPTH 04B0h = 1200/8 = 150 ft nello script.'),
         'velocita': dato(0, 'kt', '[EST-688]', 'documentato', 'Ferma nello script (velocità massima 1 nodo).')},
        {'id': 'bio2', 'nome': 'globicefali', 'tipo': 'cetacei',
         'x': m(float(bio2[0]), '[EMODNET-DTM]', 'nozionale', f'{geo_testo(proj, *map(float, bio2))}; fondale '
                f'{fondale(*map(float, bio2)):.0f} m. Branco di globicefali sul margine della piattaforma: '
                'sorgente aggiunta per la palestra, non c\'e\' nello script del 1989.'),
         'y': m(float(bio2[1]), '[EMODNET-DTM]', 'nozionale'),
         'quota': dato(20, 'm', '[CONO]', 'nozionale', 'Vicino alla superficie.'),
         'velocita': dato(3, 'kt', '[CONO]', 'nozionale', 'Si sposta lentamente.')},
    ]

    # Partenze dei 688. Le tre partenze casuali dello script, convertite, cadono a 10-70 m di fondale
    # contro la costa di Suðuroy (la georeferenza sbaglia di qualche km e il campo di TORPEX e' tutto
    # sulla piattaforma): un 688 (pescaggio 9,4 m, quota automatica di 150 ft) non ci sta, e lo script ne
    # usa una sola per volta. Si riportano come `partenze_1989`; la palestra mette i 688 su un anello di
    # 9 km di raggio a levante di Suðuroy, nella fossa di 120-330 m dove si puo' scendere sotto lo strato,
    # con la prua verso il centro: due vicini partono a 12,7 km, fuori portata reciproca a bassa velocita'
    # (PROGETTO §5.12: due battelli silenziosi si scoprono a poche migliaia di iarde) e si vanno incontro.
    CENTRO, RAGGIO, PROF_MIN = (32_000.0, -19_000.0), 9_000.0, 110.0
    partenze, xy_p = [], []
    for k, (nome, rlv) in enumerate([('P1', 0), ('P2', 90), ('P3', 180), ('P4', 270)]):
        x = CENTRO[0] + RAGGIO * math.sin(math.radians(rlv)); y = CENTRO[1] + RAGGIO * math.cos(math.radians(rlv))
        pr = fondale(x, y)
        if pr < PROF_MIN:
            sys.exit(f'partenza {nome}: fondale {pr:.0f} m < {PROF_MIN}')
        xy_p.append((x, y))
        partenze.append({
            'id': nome.lower(),
            'x': m(x, '[EMODNET-DTM]', 'nozionale', f'{geo_testo(proj, x, y)}; fondale {pr:.0f} m. Anello di '
                   f'{RAGGIO / 1000:.0f} km di raggio intorno a {geo_testo(proj, *CENTRO)}, a levante di Suðuroy.'),
            'y': m(y, '[EMODNET-DTM]', 'nozionale'),
            'rotta': dato((rlv + 180) % 360, '°', '[EMODNET-DTM]', 'nozionale', 'Prua verso il centro dell\'anello.'),
            'quota': dato(18, 'm', '[CONO] [EST-688]', 'nozionale', 'Quota periscopica del 688 (shared/data/'
                          'piattaforme/688.json, circa 60 ft alla chiglia); lo script del 1989 parte a 20 ft '
                          '(DEPTH 00A0h = 160/8).'),
            'velocita': dato(0, 'kt', '[EST-688]', 'documentato', 'Fermo, come nello script.'),
        })
    dist_min = min(math.dist(xy_p[i], xy_p[j]) for i in range(len(xy_p)) for j in range(i + 1, len(xy_p)))
    partenze_1989 = []
    for k, ((Xg, Yg), rt) in enumerate(TORPEX['partenze_688']):
        x, y = conv(Xg, Yg)
        partenze_1989.append({
            'id': f'p1989_{k + 1}',
            'x': m(x, nota=f'{geo_testo(proj, x, y)}; fondale {fondale(x, y):.0f} m. Script: X {Xg}, Y {Yg}. ' + nota_georef),
            'y': m(y),
            'script_1989': script(Xg, Yg),
            'rotta': dato(rt, '°', '[EST-688]', 'documentato', 'COURSE dello script (bussola = 90 − v/25).'),
            'fondale': dato(int(round(fondale(x, y))), 'm', '[EMODNET-DTM]', 'calcolato'),
        })

    for nome, x, y, pr in unita_orig:
        if pr <= 0:
            sys.exit(f'{nome}: la posizione convertita cade a terra')

    # ------------------------------------------------------------------ JSON
    fonte_woa = '[WOA23]'
    nota_woa = (f'Media dei {len(scelti)} nodi WOA23 (decennio 1985-1994, estate, 0,25°) dentro l\'area con la colonna '
                f'd\'acqua fino ad almeno {QUOTA_NODI_PROFONDI:.0f} m (Canale delle Fær Øer e fianco del Canale '
                f'Fær Øer-Shetland); livelli standard fino a {QUOTA_NODI_PROFONDI:.0f} m, poi T e S costanti fino al '
                f'fondale massimo dell\'area ({fondo_max:.0f} m).')
    bande = []
    for fhz in BANDE_HZ:
        bande.append({'frequenza': dato(fhz, 'Hz', '[NPL-ABS]', 'documentato', None, '05_acustica.md §6.3'),
                      'alfa': dato(q(ainslie_mccolm(fhz, T_ASS, S_ASS, PH, ZASS), 5), 'dB/km', '[NPL-ABS] [WOA23] [GLODAP2]',
                                   'calcolato')})
    rumore_tab = []
    for ss in range(len(VENTO_PER_STATO)):
        rumore_tab.append(serie([q(coates(fhz, TRAFFICO, VENTO_PER_STATO[ss]), 1) for fhz in BANDE_HZ],
                                'dB re 1 µPa²/Hz', '[STOJ06]', 'calcolato',
                                f'Stato del mare {ss} (vento {it(VENTO_PER_STATO[ss], 1)} m/s), alle frequenze di `bande`.'))
    lat_sw = proj.in_geografiche(-MEZZO_LATO, -MEZZO_LATO); lat_ne = proj.in_geografiche(MEZZO_LATO, MEZZO_LATO)
    sc = {
        'formato': 'termoclino-scenario/1',
        'id': ID,
        'nome': 'TORPEX \'89 — palestra',
        'generato_da': 'tools/batimetria/scarica.py — non modificare a mano: si cambia lo strumento e lo si rilancia',
        'descrizione': ('Palestra di F1 nell\'area della missione 1 del 1989, TORPEX \'89, a sud dell\'arcipelago delle '
                        'Fær Øer (Mar di Norvegia): batimetria vera, profilo del suono estivo del decennio del gioco, '
                        'i tre cacciatorpediniere dello script originale, un mercantile e due sorgenti biologiche.'),
        'note': [
            'Esclusi in F1 e presenti nello script originale: l\'elicottero SH-60B Seahawk LAMPS III (fa la spola fra '
            f'{geo_testo(proj, *conv(*TORPEX["seahawk"][0]))} e {geo_testo(proj, *conv(*TORPEX["seahawk"][1]))} a 90 '
            'nodi) e l\'Alfa sovietico in agguato (a 400 ft, '
            f'{geo_testo(proj, *conv(*TORPEX["alfa"]))}); arrivano con le forze ASW e il capitano IA (F4).',
            'Lo script del 1989 sceglie a caso una delle tre partenze del 688 e chiude l\'esercitazione dopo 15 minuti; '
            'la palestra non ha limite di tempo e mette in acqua fino a quattro 688 insieme.',
            f'Le posizioni del 1989 portano l\'errore della georeferenza (circa {it(rms / 1000, 1)} km): i cacciatorpediniere sulla '
            'piattaforma restano in acqua, le partenze dei 688 sono state spostate al largo (vedi `partenze`).',
        ],
        'crediti': [
            {'dati': 'EMODnet Bathymetry', 'licenza': 'CC BY 4.0',
             'testo': 'Batimetria: EMODnet Bathymetry Consortium (2024): EMODnet Digital Bathymetry (DTM 2024). '
                      'https://doi.org/10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1 — rielaborata (media su '
                      'celle di 500 m). Non adatta alla navigazione.'},
            {'dati': 'NOAA NCEI ETOPO 2022', 'licenza': 'pubblico dominio',
             'testo': 'Quote delle terre emerse: NOAA National Centers for Environmental Information (2022), ETOPO 2022 '
                      '15 Arc-Second Global Relief Model. https://doi.org/10.25921/fd45-gt74'},
            {'dati': 'NOAA NCEI World Ocean Atlas 2023', 'licenza': 'pubblico dominio',
             'testo': 'Temperatura e salinità: World Ocean Atlas 2023 (NOAA NCEI), decennio 1985-1994, estate.'},
            {'dati': 'NCEP/NCAR Reanalysis 1', 'licenza': 'uso libero con citazione (NOAA PSL)',
             'testo': 'Vento: NCEP/NCAR Reanalysis 1, NOAA PSL, Boulder (Colorado, USA), https://psl.noaa.gov'},
            {'dati': 'GLODAPv2', 'licenza': 'libera con citazione',
             'testo': 'pH: Lauvset et al. (2016), A new global interior ocean mapped climatology: the 1°x1° GLODAP '
                      'version 2, Earth Syst. Sci. Data 8, 325-340.'},
        ],
        'origine': {
            'lat': dato(LAT0, '°', '[EST-688] [EMODNET-DTM]', 'nozionale',
                        '61°45\' N: centro del campo di TORPEX \'89 georeferenziato, arrotondato al primo.'),
            'lon': dato(round(LON0, 9), '°', '[EST-688] [EMODNET-DTM]', 'nozionale', '6°50\' W.'),
            'proiezione': 'azimutale equidistante sulla sfera di Gauss nell\'origine (shared/geo.js, ProiezioneLocale)',
        },
        'area': {
            'x0': m(-MEZZO_LATO, '[EMODNET-DTM]', 'nozionale', f'Quadrato di 200 km di lato centrato sull\'origine: '
                    f'angolo sud-ovest {geo_testo(proj, -MEZZO_LATO, -MEZZO_LATO)}, nord-est '
                    f'{geo_testo(proj, MEZZO_LATO, MEZZO_LATO)}.'),
            'y0': m(-MEZZO_LATO, '[EMODNET-DTM]', 'nozionale'),
            'x1': m(MEZZO_LATO, '[EMODNET-DTM]', 'nozionale'),
            'y1': m(MEZZO_LATO, '[EMODNET-DTM]', 'nozionale'),
        },
        'batimetria': {
            'file': f'{ID}.batimetria.bin',
            'codifica': 'int16le',
            'colonne': n, 'righe': n,
            'ordine': 'righe da nord a sud, colonne da ovest a est; il nodo (riga i, colonna j) sta in '
                      'x = x_min + j·passo, y = y_max − i·passo; fra i nodi si interpola in modo bilineare',
            'valori': 'profondità del fondo in metri, positiva verso il basso (riferimento: il LAT di EMODnet); '
                      'terra = valore negativo, cioè la quota del suolo col segno meno (almeno −1)',
            'x_min': m(-MEZZO_LATO, '[EMODNET-DTM]', 'nozionale'),
            'y_max': m(MEZZO_LATO, '[EMODNET-DTM]', 'nozionale'),
            'passo': dato(PASSO, 'm', '[EMODNET-DTM]', 'nozionale',
                          'Ogni nodo è la media dei campioni EMODnet (1/16 di primo, circa 115 x 55 m) nella cella di '
                          '500 m centrata sul nodo: circa 40 campioni per nodo. 500 m stanno sotto la scala dei sensori '
                          'e della mappa e tengono il file a circa 314 KiB.'),
            'byte': os.path.getsize(bin_path),
            'sha256': sha256(bin_path),
            'fondale_massimo': dato(int(acqua.max()), 'm', '[EMODNET-DTM]', 'calcolato'),
            'frazione_terra': dato(q(100 * (grid <= 0).mean(), 2), '%', '[EMODNET-DTM]', 'calcolato'),
            'fonti': '[EMODNET-DTM] [ETOPO22]',
            'nodi_da_etopo': dato(da_etopo, 'n', '[ETOPO22]', 'calcolato',
                                  'Nodi di mare dove EMODnet non ha dati (stretti e fiordi fra le isole): profondità ETOPO.'),
            'nota': ('EMODnet DTM 2024 (bathymetry_dtm_2024 su erddap.emodnet.eu) per il mare: media dei campioni di mare '
                     'nella cella; terra dove prevalgono i campioni emersi, con la quota media ETOPO 2022 15" delle celle '
                     'emerse; dove prevalgono le celle vuote di EMODnet decide ETOPO. Rifare: python3 '
                     'tools/batimetria/scarica.py.'),
        },
        'georeferenza_1989': {
            'mappa': 'SURFG (319 x 200 celle), missioni 1 e 2 del gioco del 1989',
            'cella': 'colonna = floor(X / 32), riga = 199 − floor(Y / 32); X verso est, Y verso nord, unità degli script',
            'livelli': '15 = terra, 14 = costa, 13 … 0 = acqua sempre più profonda (docs/ASSET.md li dà al contrario)',
            'formula': 'x = a·X + b·Y + c, y = d·X + e·Y + f (metri sul piano di questo scenario)',
            'coefficienti': {k: dato(q(v, 6), 'm' if k in 'cf' else '1', '[EST-688] [EMODNET-DTM]', 'calcolato')
                             for k, v in zip('abcdef', coeff)},
            'scala_x': dato(q(math.hypot(a, d), 3), 'm', '[EST-688] [EMODNET-DTM]', 'calcolato',
                            'Metri reali per unità di script lungo X (est-ovest).'),
            'scala_y': dato(q(math.hypot(b, e), 3), 'm', '[EST-688] [EMODNET-DTM]', 'calcolato',
                            'Metri reali per unità di script lungo Y (nord-sud). Il rapporto x/y (circa 0,88) è vicino '
                            'a quello dei pixel della VGA 320 x 200 (5:6): la mappa fu disegnata perché sembrasse giusta '
                            'sullo schermo. Il gioco però misura le distanze come se X e Y avessero la stessa scala.'),
            'scarto_quadratico_medio': dato(int(round(rms)), 'm', '[EST-688] [EMODNET-DTM]', 'calcolato',
                                            'Sui punti di controllo; è l\'incertezza delle posizioni del 1989 convertite.'),
            'punti_di_controllo': [{'punto': nome, 'residuo': dato(int(round(r)), 'm', '[EST-688] [EMODNET-DTM]', 'calcolato')}
                                   for nome, r in residui],
            'nota': ('Le unità degli script si mostrano a schermo come gradi:primi:secondi (2" per unità), ma non sono '
                     'gradi: la scala vera è circa 20 m per unità. La mappa è una Fær Øer disegnata a mano, riconoscibile '
                     'isola per isola ma deformata: l\'errore residuo (fino a 6 km sulla punta sud di Sandoy) è nella '
                     'mappa, non nel metodo. Metodo nei commenti di tools/batimetria/scarica.py.'),
        },
        'ambiente': {
            'stagione': dato('estate (luglio-settembre), decennio 1985-1994', None, '[WOA23]', 'documentato',
                             'Scelta per F1: è la stagione dello strato. Con lo stesso metodo i dati WOA23 dell\'area danno '
                             f'{it(salto, 1)} m/s di salto in estate, 1,6 a giugno e 0,2 in primavera (aprile-giugno): in '
                             'primavera lo strato quasi non c\'è e la prova di F1 «se uno scende sotto lo strato, l\'altro '
                             'lo perde» non avrebbe niente da mostrare. Il decennio è quello del gioco; il vento estivo è il '
                             'più debole dell\'anno.'),
            'profilo': {
                'quota': serie([q(v, 0) for v in z_prof], 'm', fonte_woa, 'documentato', nota_woa),
                'temperatura': serie([q(v, 3) for v in t_prof], '°C', fonte_woa, 'documentato',
                                     'Sotto i 600 m l\'acqua di fondo è sotto i 2 °C, fuori dal dominio dichiarato '
                                     'dell\'equazione di Mackenzie (05_acustica.md §4.1): errore piccolo, dichiarato.'),
                'salinita': serie([q(v, 3) for v in s_prof], 'psu', fonte_woa, 'documentato'),
                'velocita_suono': serie([q(v, 2) for v in c_prof], 'm/s', '[MACK81] [NPL-SS] [WOA23]', 'calcolato',
                                        'Equazione di Mackenzie (1981) sui valori di T e S.'),
            },
            'strato': {
                'profondita': dato(q(z_strato, 1), 'm', '[WOA23] [DBM04]', 'calcolato',
                                   f'Base dello strato rimescolato: la temperatura scende di {it(SOGLIA_STRATO_C, 1)} °C rispetto '
                                   f'a quella di {QUOTA_RIF_STRATO:.0f} m (criterio di soglia di de Boyer Montégut et al. '
                                   '2004). Nel profilo climatologico la velocità è massima in superficie: la media di molti '
                                   'anni smussa lo strato isotermo che una singola sonda vedrebbe.', '05_acustica.md §4.2, §5.1'),
                'base_termoclina': dato(BASE_TERMOCLINA, 'm', '[WOA23]', 'stimato',
                                        'Base della termoclina stagionale: sotto i 100 m il gradiente termico estivo scende a '
                                        'circa 0,01 °C/m, come nella termoclina permanente.'),
                'salto_velocita': dato(q(salto, 2), 'm/s', '[MACK81] [WOA23]', 'calcolato',
                                       'Velocità alla base dello strato meno velocità alla base della termoclina stagionale.'),
                'perdita': dato(q(perdita, 1), 'dB', '[WOA23] [CW-MOD]', 'nozionale',
                                f'Perdita per l\'attraversamento dello strato: {DB_PER_MS:.0f} dB per m/s di salto, al massimo '
                                f'{PERDITA_MAX:.0f} dB (regola nozionale di 05_acustica.md §5.1: nessun valore aperto '
                                'affidabile; Cold Waters usa un bonus di strato fino a 12 dB).', '05_acustica.md §5.1'),
                'gradiente_sotto': dato(q(salto / (BASE_TERMOCLINA - z_strato), 4), '1', '[MACK81] [WOA23]', 'calcolato',
                                        'Gradiente medio di velocità nella termoclina stagionale, (m/s)/m.'),
            },
            'velocita_suono_minima': {
                'quota': dato(q(z_prof[i_min], 0), 'm', '[WOA23] [MACK81]', 'calcolato',
                              'Minimo del profilo: è sul fondo del Canale delle Fær Øer (acqua di fondo sotto 0 °C), non '
                              'un canale SOFAR libero.'),
                'velocita': dato(q(c_prof[i_min], 2), 'm/s', '[WOA23] [MACK81]', 'calcolato'),
            },
            'mare': {
                'stato_predefinito': dato(stato_mare, 'n', '[NCEP-R1]', 'calcolato',
                                          f'Vento medio di luglio-settembre {it(v_stag, 1)} m/s (NCEP/NCAR R1, 1991-2020, '
                                          'quattro nodi intorno all\'area): classe più vicina della scala nozionale di '
                                          '05_acustica.md §3.4.'),
                'vento_stagione': dato(q(v_stag, 2), 'm/s', '[NCEP-R1]', 'documentato',
                                       'Media 1991-2020 (la climatologia disponibile più vicina al 1989).'),
                'vento_per_stato': serie(list(VENTO_PER_STATO), 'm/s', '[STOJ06]', 'nozionale',
                                         'Centro delle classi della mappa nozionale stato del mare → vento di '
                                         '05_acustica.md §3.4 (0-1, 2-3, 4-5, 6-7, 8-10, 11-13, 14-17 m/s); fra due stati '
                                         'si interpola.'),
            },
            'rumore': {
                'modello': 'coates',
                'formula': 'dB re 1 µPa²/Hz con f in kHz: N_turb = 17 − 30·log f; N_navi = 40 + 20·(s − 0,5) + 26·log f − '
                           '60·log(f + 0,03); N_vento = 50 + 7,5·√w + 20·log f − 40·log(f + 0,4); N_term = −15 + 20·log f; '
                           'somma in potenza (05_acustica.md §3.2)',
                'traffico': dato(TRAFFICO, '1', '[STOJ06]', 'nozionale',
                                 'Attività navale s di Coates (0 = bassa, 1 = alta): area lontana dalle grandi rotte '
                                 'oceaniche, con pesca e traffico locale.'),
                'tabella': rumore_tab,
            },
            'assorbimento': {
                'modello': 'ainslie-mccolm',
                'temperatura': dato(T_ASS, '°C', '[WOA23]', 'calcolato', 'Media del profilo fra 0 e 300 m.'),
                'salinita': dato(S_ASS, 'psu', '[WOA23]', 'calcolato', 'Media del profilo fra 0 e 300 m.'),
                'ph': dato(PH, '1', '[GLODAP2]', 'stimato',
                           f'pH in situ (scala totale) medio fra 0 e 300 m nell\'area: {it(ph_m, 3)}. La climatologia GLODAPv2 '
                           'è riferita al 2002: nel 1989 il pH era più alto di circa 0,02, effetto sull\'assorbimento '
                           'sotto il 4 %.'),
                'profondita': dato(ZASS * 1000, 'm', '[NPL-ABS]', 'nozionale', 'Quota di riferimento della formula.'),
                'bande': bande,
            },
        },
        'partenze': partenze,
        'partenze_1989': partenze_1989,
        'nota_partenze_1989': ('Le tre partenze alternative dello script del 1989 (il gioco ne sceglie una a caso), '
                               'convertite: cadono contro la costa di Suðuroy, su 10-70 m di fondale. Solo per confronto; '
                               'la palestra usa `partenze`.'),
        'distanza_minima_partenze': dato(int(round(dist_min)), 'm', '[EMODNET-DTM]', 'calcolato',
                                         'Fra due partenze qualsiasi: due 688 lenti si sentono a pochi km (PROGETTO §5.12).'),
        'navi': navi,
        'biologici': biologici,
    }
    # Il blocco `propagazione` (regioni acustiche e tabelle di perdita di trasmissione) lo scrive
    # tools/acustica/tabelle.py: qui si conserva com'e'. Se cambiano batimetria o oceanografia, va rifatto
    # anche quello (python3 tools/acustica/tabelle.py).
    try:
        with open(json_path, encoding='utf-8') as fi:
            vecchio = json.load(fi)
        if isinstance(vecchio, dict) and 'propagazione' in vecchio:
            sc['propagazione'] = vecchio['propagazione']
    except (OSError, ValueError):
        pass
    with open(json_path, 'w', encoding='utf-8') as fo:
        json.dump(sc, fo, ensure_ascii=False, indent=1)
        fo.write('\n')
    avviso(f'scritto {os.path.relpath(json_path, RADICE)} e {os.path.relpath(bin_path, RADICE)}')

if __name__ == '__main__':
    main()
