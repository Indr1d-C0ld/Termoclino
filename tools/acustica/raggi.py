"""
raggi.py - il tracciatore di raggi di Termoclino (F2, filone G: propagazione).

Calcola la perdita di trasmissione TL(distanza, quota della sorgente, quota del ricevitore, banda) in un
ambiente **indipendente dalla distanza**: un profilo della velocita' del suono c(z) lineare a tratti, la
superficie del mare in cima e un fondo piatto, fluido, a una profondita' H. Serve a tools/acustica/tabelle.py,
che ne fa le tabelle degli scenari, e alle prove di tools/acustica/test_convalida.py, che lo confrontano con le
soluzioni esatte (divergenza sferica, specchio di Lloyd, guida di Pekeris a modi normali, profilo di Munk, canale
superficiale). Solo Python 3 + numpy.

METODO (riassunto; i particolari stanno accanto al codice).

1. Raggi in forma chiusa. In ogni tratto il gradiente g = dc/dz e' costante e il raggio e' un arco di cerchio:
   con l'invariante di Snell a = cos(theta)/c, posto u = a*c = cos(theta), s = sin(theta), il raggio percorre fra due
   quote dr = dz*(u_a + u_b)/(s_a + s_b) in orizzontale (forma esatta e stabile anche per g -> 0), ds di cammino e dt
   di tempo (formule in `tratto`). Un raggio in un mezzo indipendente dalla distanza e' **periodico**: oscilla fra un
   tetto (la superficie o un punto di inversione) e un pavimento (il fondo o un punto di inversione). Basta quindi
   calcolare il semiciclo discendente, poi la posizione a qualsiasi distanza e' una piegatura della fase: niente
   integrazione numerica passo per passo, niente errore che si accumula sui 300 km.

2. Intensita' incoerente (o semicoerente) per tubi di raggi. Ogni raggio rappresenta il ventaglio dtheta intorno
   al suo angolo di partenza; attraversando una verticale a distanza r porta l'energia E = dtheta/r (in unita' della
   sorgente a 1 m: la costanza di cos(theta)/c lungo il raggio fa sparire ogni altro fattore) e la stende con una
   "tenda" triangolare di semilarghezza w = |dz/dtheta0|*dtheta (misurata con due raggi gemelli a theta0 +- eps) e
   area E. L'intensita' al centro, 1/(r |dz/dtheta0|), e' quella classica del tubo di raggi; le tende di raggi vicini
   si sommano come un'interpolazione lineare fra i raggi, piegate alla superficie e al fondo. Alle caustiche w -> 0:
   la tenda non scende sotto una lunghezza d'onda e, dove il raggio curva, sotto due scale di Airy
   l = (lambda^2 R / 8 pi^2)^(1/3) (R il raggio di curvatura del raggio), mai oltre un decimo della distanza: fa le
   veci della diffrazione (energia finita alle caustiche, un po' di energia nelle zone d'ombra, di piu' alle basse
   frequenze).

3. Perdite. Al fondo il coefficiente di Rayleigh di un semispazio fluido con attenuazione (dB per lunghezza d'onda),
   piu' una perdita per rimbalzo uguale a ogni radenza (`Fondo.perdita_extra`, nozionale: cio' che il fondo liscio non
   vede); alla superficie la riflessione coerente di Eckart mu = exp(-2 (k sigma sin theta)^2) con l'energia diffusa
   che resta in parte nel raggio, piu' una perdita per rimbalzo (`Superficie.perdita_extra`: le tabelle usano quella
   empirica dei raggi radenti di Schulkin); nell'acqua l'assorbimento alfa(f) sul cammino vero del raggio.

4. Specchio di Lloyd (opzione "semicoerente", come in Bellhop): ogni raggio che tocca la superficie ha un gemello
   riflesso vicino alla sorgente; la coppia, sommata coerentemente e mediata sulla banda, pesa 1 - mu*<cos(2 Phi)>
   rispetto alla somma incoerente, con Phi = integrale di k_z fra la superficie e la quota della sorgente. Lo stesso
   vale dal lato del ricevitore, per i raggi passati almeno una volta dal pavimento (prima la coppia e' una sola). Cosi'
   una sorgente vicina alla superficie irradia poco ad angoli radenti alle basse frequenze (il dipolo dello specchio
   di Lloyd), e il campo vicino alla superficie si annulla come deve. E' esatto nel campo lontano quando la sorgente
   e' la quota piu' bassa delle due: le tabelle si calcolano cosi'. Con `semicoerente=False` il fattore e' 1.

5. Canali chiusi da un punto d'inversione (correzione WKB, `ritenzione_barriera`): la teoria dei raggi intrappolerebbe
   ogni frequenza in qualsiasi canale. A ogni passaggio dal punto d'inversione un raggio conserva S (1 - T^2): T^2 =
   1/(1 + exp(2B)) l'effetto tunnel attraverso la barriera evanescente (Kemble), S il sostegno del primo modo (la fase
   verticale di mezzo ciclo deve arrivare a 3/4 pi fra superficie e inversione, pi/2 fra due inversioni).

6. Per la convalida c'e' anche la somma **coerente** sugli autoraggi (`campo_coerente`), che pero' non conta le
   caustiche (indice KMAH): vale nei mezzi senza rifrazione (specchio di Lloyd, Pekeris), dove le caustiche non ci sono.

Unita': metri, secondi, m/s, Hz; le intensita' sono rapporti rispetto a quella a 1 m dalla sorgente (TL = -10 log I).
Quote positive verso il basso. Angoli in radianti, positivi verso il basso.
"""
import math
import numpy as np

# Lamella minima: una lunghezza d'onda (nozionale, vedi il punto 2 in testa).
LARGHEZZA_MINIMA_LAMBDA = 1.0
# Attenuazione in dB per lunghezza d'onda -> parte immaginaria relativa del numero d'onda.
DB_LAMBDA_IN_ETA = 1.0 / (40.0 * math.pi * math.log10(math.e))


# ----------------------------------------------------------------------------------------------- ambiente

class Profilo:
    """Velocita' del suono lineare a tratti fra i nodi z[0] = 0 < z[1] < ... < z[N] = H (il fondale)."""

    def __init__(self, z, c):
        z = np.asarray(z, dtype=float)
        c = np.asarray(c, dtype=float)
        if z.ndim != 1 or z.shape != c.shape or len(z) < 2:
            raise ValueError('profilo: quote e velocita\' di lunghezza diversa')
        if z[0] != 0.0 or np.any(np.diff(z) <= 0):
            raise ValueError('profilo: le quote devono partire da 0 ed essere crescenti')
        self.z = z
        self.c = c
        self.H = float(z[-1])

    def c_a(self, zq):
        return np.interp(zq, self.z, self.c)

    def con_nodo(self, zq):
        """Una copia con un nodo alla quota zq (se non c'e' gia') e l'indice di quel nodo."""
        zq = float(zq)
        if not (0.0 <= zq <= self.H):
            raise ValueError(f'quota {zq} fuori dalla colonna d\'acqua (0-{self.H})')
        i = int(np.searchsorted(self.z, zq))
        if i < len(self.z) and abs(self.z[i] - zq) < 1e-9:
            return self, i
        z = np.insert(self.z, i, zq)
        c = np.insert(self.c, i, self.c_a(zq))
        return Profilo(z, c), i

    def tronca(self, H):
        """Lo stesso profilo con il fondo a H (tagliato, o prolungato col gradiente dell'ultimo tratto)."""
        H = float(H)
        if H <= self.H:
            k = int(np.searchsorted(self.z, H))
            z = np.append(self.z[:k], H)
            c = np.append(self.c[:k], self.c_a(H))
            if len(z) >= 2 and z[-1] - z[-2] < 1e-6:
                z, c = z[:-1], c[:-1]
                z[-1], c[-1] = H, self.c_a(H)
            return Profilo(z, c)
        g = (self.c[-1] - self.c[-2]) / (self.z[-1] - self.z[-2])
        return Profilo(np.append(self.z, H), np.append(self.c, self.c[-1] + g * (H - self.z[-1])))


class Fondo:
    """Fondo fluido semi-infinito (Rayleigh): velocita' (m/s), densita' relativa all'acqua, attenuazione (dB/lambda).
    `assorbente=True` non riflette nulla (per le prove in acqua illimitata).

    `perdita_extra` (dB per rimbalzo, a `frequenza_extra`, scalata come (f/frequenza_extra)^esponente_extra) e' una
    perdita al fondo in piu' di quella del semispazio, uguale a ogni radenza: cio' che il modello liscio e omogeneo
    non vede (rugosita', stratificazione, diffusione di volume, pendenze del fondale vero). Zero nelle prove."""

    def __init__(self, velocita=1650.0, densita=1.9, attenuazione=0.8, assorbente=False, perdita_extra=0.0,
                 frequenza_extra=2000.0, esponente_extra=0.5):
        self.velocita = float(velocita)
        self.densita = float(densita)
        self.attenuazione = float(attenuazione)
        self.assorbente = bool(assorbente)
        self.perdita_extra = float(perdita_extra)
        self.frequenza_extra = float(frequenza_extra)
        self.esponente_extra = float(esponente_extra)

    def perdita_aggiuntiva(self, f):
        """dB per rimbalzo in piu' alla frequenza f."""
        if self.perdita_extra == 0.0:
            return 0.0
        return self.perdita_extra * (f / self.frequenza_extra) ** self.esponente_extra

    def riflessione(self, c_acqua, u):
        """Coefficiente complesso di riflessione per raggi con cos(radenza) = u nell'acqua sopra il fondo."""
        u = np.asarray(u, dtype=float)
        if self.assorbente:
            return np.zeros_like(u, dtype=complex)
        eta = self.attenuazione * DB_LAMBDA_IN_ETA
        n2 = (c_acqua / self.velocita) ** 2 * (1 + 1j * eta) ** 2
        k1z = np.sqrt(np.clip(1.0 - u * u, 0.0, None))
        k2z = np.sqrt(n2 - u * u + 0j)
        k2z = np.where(k2z.imag < 0, -k2z, k2z)          # onda che si smorza scendendo nel fondo
        return (self.densita * k1z - k2z) / (self.densita * k1z + k2z)


class Superficie:
    """Superficie libera (pressione nulla, R = -1) con la rugosita' del mare.

    sigma: altezza quadratica media delle onde (m). La riflessione coerente vale mu = exp(-2 (k sigma sin theta)^2)
    (Eckart 1953); dell'energia diffusa (1 - mu^2) una frazione `frazione_avanti` resta nel raggio, il resto si perde.
    `assorbente=True` non riflette nulla (acqua illimitata)."""

    def __init__(self, sigma=0.0, frazione_avanti=0.5, assorbente=False, perdita_extra=None):
        self.sigma = float(sigma)
        self.frazione_avanti = float(frazione_avanti)
        self.assorbente = bool(assorbente)
        # perdita_extra(f) -> dB per rimbalzo in piu', uguale a ogni radenza (None: nessuna)
        self.perdita_extra = perdita_extra

    def mu(self, k, s):
        return np.exp(-2.0 * (k * self.sigma * s) ** 2)

    def energia_rimbalzo(self, k, s, f=None):
        if self.assorbente:
            return np.zeros_like(np.asarray(s, dtype=float))
        m2 = self.mu(k, s) ** 2
        e = m2 + self.frazione_avanti * (1.0 - m2)
        if self.perdita_extra is not None and f is not None:
            e = e * 10 ** (-self.perdita_extra(f) / 10)
        return e


class Banda:
    """Una banda di calcolo: frequenze estreme (Hz), centro, assorbimento al centro (dB/km)."""

    def __init__(self, ident, da, a, centro=None, alfa=0.0):
        self.id = ident
        self.da = float(da)
        self.a = float(a)
        self.centro = float(centro) if centro is not None else math.sqrt(self.da * self.a)
        self.alfa = float(alfa)


# ------------------------------------------------------------------------------------- un tratto di raggio

def tratto(dz, ua, ub, sa, sb, a):
    """Cammino di un raggio in un tratto a gradiente costante fra le quote z_a e z_b = z_a + dz (dz >= 0),
    con u = cos(theta) = a*c e s = sin(theta) >= 0 ai due estremi. Restituisce (dr, ds, dt): distanza orizzontale,
    lunghezza del cammino e tempo. Forme algebricamente esatte e stabili anche per g -> 0 e ai punti di inversione
    (s = 0); dz = 0 da' zero."""
    dz = np.asarray(dz, dtype=float)
    pos = dz > 0
    den_r = sa + sb
    with np.errstate(divide='ignore', invalid='ignore'):
        dr = np.where(pos, dz * (ua + ub) / np.where(den_r > 0, den_r, 1.0), 0.0)
        D = ub - ua                                    # = a*g*dz
        X = (ub + ua) / np.where(sa * ub + ua * sb > 0, sa * ub + ua * sb, 1.0)
        Y = ua * ub + sa * sb                          # cos(theta_a - theta_b) > 0 in un tratto
        t = D * X / np.where(Y > 0, Y, 1.0)
        atanc = np.where(np.abs(t) > 1e-8, np.arctan(t) / np.where(t != 0, t, 1.0), 1.0 - t * t / 3.0)
        ds = np.where(pos, dz * X / np.where(Y > 0, Y, 1.0) * atanc, 0.0)
        q = (1.0 + X) / np.where((1.0 + sb) * ua > 0, (1.0 + sb) * ua, 1.0)
        tt = D * q
        logc = np.where(np.abs(tt) > 1e-8, np.log1p(tt) / np.where(tt != 0, tt, 1.0), 1.0 - tt / 2.0)
        dt = np.where(pos, dz * a * q * logc, 0.0)
    return dr, ds, dt


def _integrale_barriera(z, c, a, z_da, z_a):
    """int_{z_da}^{z_a} sqrt(a^2 - 1/c^2) dz nel tratto evanescente (a*c >= 1), per raggi (a, z_da, z_a).
    Per tratto lineare, con u = a*c: (1/g) [F(u)] , F(u) = sqrt(u^2-1) - atan(sqrt(u^2-1)); in forma stabile
    dz * a * (F(u_b) - F(u_a)) / (u_b - u_a), che per u_b -> u_a tende a dz * sqrt(a^2 - 1/c^2)."""
    P = np.clip(z[None, :], z_da[:, None], z_a[:, None])
    u = np.maximum(a[:, None] * np.interp(P, z, c), 1.0)
    dz = np.diff(P, axis=1)
    ua, ub = u[:, :-1], u[:, 1:]
    qa, qb = np.sqrt(ua * ua - 1), np.sqrt(ub * ub - 1)
    Fa, Fb = qa - np.arctan(qa), qb - np.arctan(qb)
    du = ub - ua
    um = 0.5 * (ua + ub)
    with np.errstate(divide='ignore', invalid='ignore'):
        rapporto = np.where(np.abs(du) > 1e-9, (Fb - Fa) / np.where(du != 0, du, 1.0), np.sqrt(um * um - 1) / um)
    return np.sum(np.where(dz > 0, dz * a[:, None] * rapporto, 0.0), axis=1)


def ritenzione_barriera(B_omega, fase_omega, omega, soglia):
    """Frazione d'energia che un raggio intrappolato da una barriera conserva a ogni passaggio dal punto
    d'inversione (correzione WKB della teoria dei raggi, che da sola intrappola tutto a ogni frequenza):

    - effetto tunnel attraverso la barriera, formula di Kemble: T^2 = 1 / (1 + exp(2 B)), B = omega * B_omega;
    - sostegno modale: il raggio e' un modo intrappolato solo se la fase verticale del mezzo ciclo,
      Phi = omega * fase_omega, arriva alla soglia del primo modo (3/4 pi fra superficie e inversione, pi/2 fra
      due inversioni); sotto la soglia l'energia non e' sostenuta e se ne va. Raccordo lineare su pi/2.

    Restituisce S * (1 - T^2) (1 dove non c'e' barriera)."""
    B = omega * B_omega
    T2 = 1.0 / (1.0 + np.exp(np.minimum(2.0 * np.nan_to_num(B, nan=50.0), 700.0)))
    Phi = omega * fase_omega
    S = np.clip((Phi - (soglia - math.pi / 4)) / (math.pi / 2), 0.0, 1.0)
    return np.where(np.isnan(B_omega), 1.0, S * (1.0 - T2))


# --------------------------------------------------------------------------------- famiglia di raggi

class Famiglia:
    """I raggi che partono da una quota zs con gli angoli theta0 (radianti, + verso il basso): il loro semiciclo
    discendente tabulato sui nodi del profilo, la fase di partenza e i confini (superficie/fondo o inversione)."""

    def __init__(self, prof, zs, theta0):
        p, s = prof.con_nodo(zs)
        self.prof = p
        self.s = s
        self.zs = float(zs)
        th = np.asarray(theta0, dtype=float)
        if np.any(th == 0) or np.any(np.abs(th) >= math.pi / 2):
            raise ValueError('angoli di partenza: escluso lo zero e |theta| < 90 gradi')
        self.theta0 = th
        z, c = p.z, p.c
        N = len(z) - 1
        self.N = N
        a = np.cos(th) / c[s]
        self.a = a
        J = len(th)
        U = a[:, None] * c[None, :]
        k = np.arange(N + 1)
        sopra = (U >= 1.0) & (k[None, :] < s)
        sotto = (U >= 1.0) & (k[None, :] > s)
        kup = np.where(sopra, k[None, :], -1).max(axis=1)
        kdn = np.where(sotto, k[None, :], N + 1).min(axis=1)
        g = np.diff(c) / np.diff(z)
        ztop = np.zeros(J)
        m = kup >= 0
        if np.any(m):
            i = kup[m]
            ztop[m] = z[i + 1] + (1.0 / a[m] - c[i + 1]) / g[i]
        zbot = np.full(J, p.H)
        m = kdn <= N
        if np.any(m):
            i = kdn[m] - 1
            zbot[m] = z[i] + (1.0 / a[m] - c[i]) / g[i]
        self.superficie = kup < 0          # il tetto e' la superficie (rimbalza)
        self.fondo = kdn > N               # il pavimento e' il fondo (rimbalza)
        self.ztop = ztop
        self.zbot = zbot
        P = np.clip(z[None, :], ztop[:, None], zbot[:, None])
        cP = np.interp(P, z, c)
        u = np.clip(a[:, None] * cP, 0.0, 1.0)
        sn = np.sqrt(1.0 - u * u)
        self.P, self.u, self.sn = P, u, sn
        dr, ds, dt = tratto(np.diff(P, axis=1), u[:, :-1], u[:, 1:], sn[:, :-1], sn[:, 1:], a[:, None])
        zero = np.zeros((J, 1))
        self.Rc = np.hstack([zero, np.cumsum(dr, axis=1)])
        self.Sc = np.hstack([zero, np.cumsum(ds, axis=1)])
        self.Tc = np.hstack([zero, np.cumsum(dt, axis=1)])
        self.R = self.Rc[:, -1]            # semiciclo: distanza
        self.S = self.Sc[:, -1]            # cammino
        self.T = self.Tc[:, -1]            # tempo
        giu = th > 0
        phi0 = np.where(giu, self.Rc[:, s], 2 * self.R - self.Rc[:, s])
        self.phi0 = np.mod(phi0, 2 * self.R)
        self.g = g
        # angolo al fondo (per la riflessione) e alla superficie (per la rugosita')
        self.u_fondo = np.clip(a * c[-1], 0, 1)
        self.s_superficie = np.sqrt(np.clip(1 - (a * c[0]) ** 2, 0, None))
        # Barriere: un punto d'inversione oltre il quale, dopo un tratto evanescente (a*c > 1), il raggio
        # potrebbe propagarsi di nuovo (il canale superficiale sopra la termoclina, o il suo rovescio). Per
        # ciascuna l'integrale B/omega = int sqrt(a^2 - 1/c^2) dz attraverso la barriera; NaN se non c'e'.
        self.barriera_giu = np.full(J, np.nan)
        self.barriera_su = np.full(J, np.nan)
        dopo = (U < 1.0) & (k[None, :] > kdn[:, None])
        k2 = np.where(dopo, k[None, :], N + 1).min(axis=1)
        m = (~self.fondo) & (k2 <= N)
        if np.any(m):
            i = k2[m] - 1
            z2 = z[i] + (1.0 / a[m] - c[i]) / g[i]
            self.barriera_giu[m] = _integrale_barriera(z, c, a[m], zbot[m], z2)
        prima = (U < 1.0) & (k[None, :] < kup[:, None])
        k1 = np.where(prima, k[None, :], -1).max(axis=1)
        m = (~self.superficie) & (k1 >= 0)
        if np.any(m):
            i = k1[m]
            z1 = z[i] + (1.0 / a[m] - c[i]) / g[i]
            self.barriera_su[m] = _integrale_barriera(z, c, a[m], z1, ztop[m])
        # fase verticale di mezzo ciclo, diviso omega (per la condizione dei modi)
        self.fase_mezzo = self.T - a * self.R

    # ------------------------------------------------------------------ valutazione a distanze date

    def _lungo(self, idx, phi):
        """Posizione lungo il ciclo per i raggi idx (J') alle fasi phi (J' x M): quota, cos, sin, cammino e tempo
        cumulati dall'inizio del ciclo 0, direzione (True = in discesa)."""
        R = self.R[idx][:, None]
        S = self.S[idx][:, None]
        T = self.T[idx][:, None]
        due = 2.0 * R
        cyc = np.floor(phi / due)
        ph = phi - cyc * due
        giu = ph < R
        rho = np.where(giu, ph, due - ph)
        Jp, M = phi.shape
        N = self.N
        Rc = self.Rc[idx]
        Rn = Rc / np.where(R > 0, R, 1.0)
        righe = np.arange(Jp)[:, None] * 2.0
        chiavi = (Rn + righe).ravel()
        cerca = (rho / np.where(R > 0, R, 1.0) + righe).ravel()
        k = np.searchsorted(chiavi, cerca, side='right').reshape(Jp, M) - 1 - (np.arange(Jp)[:, None] * (N + 1))
        k = np.clip(k, 0, N - 1)
        r_ = np.arange(Jp)[:, None]
        Pk = self.P[idx][r_, k]
        Pk1 = self.P[idx][r_, k + 1]
        ua = self.u[idx][r_, k]
        sa = self.sn[idx][r_, k]
        sb = self.sn[idx][r_, k + 1]
        a = self.a[idx][:, None]
        gk = self.g[k]
        D = np.clip(rho - Rc[r_, k], 0.0, None)
        s = sa - a * gk * D
        s = np.clip(s, np.minimum(sa, sb), np.maximum(sa, sb))
        uu = np.sqrt(np.clip(1.0 - s * s, 0.0, 1.0))
        with np.errstate(divide='ignore', invalid='ignore'):
            dzp = D * (sa + s) / np.where(ua + uu > 0, ua + uu, 1.0)
        zq = np.clip(Pk + dzp, Pk, Pk1)
        _, dsp, dtp = tratto(zq - Pk, ua, uu, sa, s, a)
        Sd = self.Sc[idx][r_, k] + dsp
        Td = self.Tc[idx][r_, k] + dtp
        s_lungo = cyc * 2 * S + np.where(giu, Sd, 2 * S - Sd)
        t_lungo = cyc * 2 * T + np.where(giu, Td, 2 * T - Td)
        return zq, uu, s, s_lungo, t_lungo, giu, gk

    def valuta(self, idx, r):
        """Per i raggi idx alle distanze r (M,): dizionario con quota z, cos u, sin s, cammino dalla sorgente,
        tempo dalla sorgente, rimbalzi in superficie e sul fondo, direzione."""
        idx = np.asarray(idx)
        r = np.asarray(r, dtype=float)
        phi0 = self.phi0[idx][:, None]
        zero = np.zeros((len(idx), 1))
        _, _, _, s0, t0, _, _ = self._lungo(idx, phi0 + zero)
        z, u, s, sl, tl, giu, gk = self._lungo(idx, phi0 + r[None, :])
        R = self.R[idx][:, None]
        due = 2 * R
        tot = phi0 + r[None, :]
        n_sup = np.floor(tot / due) - np.floor(phi0 / due)
        n_fon = np.floor((tot - R) / due) - np.floor((phi0 - R) / due)
        n_pav = n_fon.copy()               # passaggi dal pavimento (fondo o inversione in basso)
        n_tet = n_sup.copy()               # passaggi dal tetto (superficie o inversione in alto)
        n_sup = n_sup * self.superficie[idx][:, None]
        n_fon = n_fon * self.fondo[idx][:, None]
        return {'z': z, 'u': u, 's': s, 'cammino': sl - s0, 'tempo': tl - t0,
                'n_sup': n_sup, 'n_fon': n_fon, 'n_pav': n_pav, 'n_tet': n_tet, 'giu': giu, 'gradiente': gk}

    def ritardo_a_quota(self, zq):
        """Integrale (tempo - a*distanza) = integrale di sqrt(1/c^2 - a^2) dz fra il tetto e la quota zq lungo il
        semiciclo discendente, per tutti i raggi (moltiplicato per omega e' la fase verticale). NaN per i raggi che
        non arrivano a zq."""
        zq = float(zq)
        dentro = (zq >= self.ztop - 1e-9) & (zq <= self.zbot + 1e-9)
        z = self.prof.z
        Pq = np.clip(np.minimum(self.P, zq), self.ztop[:, None], None)
        cP = np.interp(Pq, z, self.prof.c)
        u = np.clip(self.a[:, None] * cP, 0, 1)
        sn = np.sqrt(1 - u * u)
        dr, _, dt = tratto(np.diff(Pq, axis=1), u[:, :-1], u[:, 1:], sn[:, :-1], sn[:, 1:], self.a[:, None])
        val = dt.sum(axis=1) - self.a * dr.sum(axis=1)
        return np.where(dentro, val, np.nan)


# ------------------------------------------------------------------------------------- ventaglio di angoli

def ventaglio(fino=88.0, fine=6.0, passo_fine=0.02, medio=30.0, passo_medio=0.1, passo_largo=0.25):
    """Angoli di partenza (radianti) e pesi dtheta: fitti vicino all'orizzontale, dove stanno i raggi intrappolati
    negli strati e nei canali, radi verso la verticale. Simmetrico, senza lo zero."""
    def lato(a0, a1, passo):
        n = max(1, int(round((a1 - a0) / passo)))
        bordi = np.linspace(a0, a1, n + 1)
        return 0.5 * (bordi[:-1] + bordi[1:]), np.diff(bordi)
    c1, w1 = lato(0.0, fine, passo_fine)
    c2, w2 = lato(fine, medio, passo_medio)
    c3, w3 = lato(medio, fino, passo_largo)
    pos = np.concatenate([c1, c2, c3])
    w = np.concatenate([w1, w2, w3])
    th = np.concatenate([-pos[::-1], pos])
    dw = np.concatenate([w[::-1], w])
    return np.radians(th), np.radians(dw)


# ----------------------------------------------------------------------------------- campo incoerente

def _media_coseno(fase_centro, banda):
    """<cos(2 Phi)> sulla banda, con Phi proporzionale alla frequenza e Phi(centro) = fase_centro."""
    x1 = 2 * fase_centro * banda.da / banda.centro
    x2 = 2 * fase_centro * banda.a / banda.centro
    dx = x2 - x1
    with np.errstate(divide='ignore', invalid='ignore'):
        m = np.where(np.abs(dx) > 1e-9, (np.sin(x2) - np.sin(x1)) / np.where(dx != 0, dx, 1.0), np.cos(x1))
    return m


def campo(prof, superficie, fondo, zs, zr, r, bande, angoli=None, sottocampioni=3, semicoerente=True,
          blocco=300, eps=1e-6, larghezza_minima=LARGHEZZA_MINIMA_LAMBDA, barriere=True):
    """Intensita' incoerente (o semicoerente) I[banda, ricevitore, distanza], relativa a 1 m dalla sorgente.

    prof, superficie, fondo: l'ambiente; zs: quota della sorgente; zr: quote dei ricevitori (K,); r: distanze (M,),
    crescenti e positive; bande: elenco di Banda. Con sottocampioni > 1 ogni distanza e' la media dell'intensita' su
    `sottocampioni` punti in progressione geometrica che coprono l'intervallo fino alle distanze vicine (un filtro a
    finestra nel logaritmo della distanza, come le tabelle che si leggono per interpolazione)."""
    r = np.asarray(r, dtype=float)
    zr = np.atleast_1d(np.asarray(zr, dtype=float))
    if angoli is None:
        angoli = ventaglio()
    th, dth = angoli
    fam = Famiglia(prof, zs, th)
    piu = Famiglia(prof, zs, th + eps)
    meno = Famiglia(prof, zs, th - eps)
    H = fam.prof.H
    c0 = fam.prof.c[0]
    cH = fam.prof.c[-1]
    # distanze di valutazione (sottocampioni geometrici intorno a ogni distanza)
    if sottocampioni > 1 and len(r) > 1:
        q = np.exp(np.mean(np.diff(np.log(r))))
        off = (np.arange(sottocampioni) - (sottocampioni - 1) / 2) / sottocampioni
        rr = (r[None, :] * q ** off[:, None]).ravel()
    else:
        sottocampioni = 1
        rr = r.copy()
    B = len(bande)
    K = len(zr)
    I = np.zeros((B, K, len(rr)))
    # grandezze per raggio e banda (non dipendono dalla distanza)
    Rf = np.abs(fondo.riflessione(cH, fam.u_fondo)) ** 2                     # energia al rimbalzo sul fondo
    lnRf0 = np.log(np.maximum(Rf, 1e-300))
    lnRf = [lnRf0 - fondo.perdita_aggiuntiva(b.centro) * math.log(10) / 10 for b in bande]
    lnS, Fs, mu = [], [], []
    rit_s = fam.ritardo_a_quota(zs)
    rit_r = [fam.ritardo_a_quota(q) for q in zr]
    for b in bande:
        k = 2 * math.pi * b.centro / c0
        es = superficie.energia_rimbalzo(k, fam.s_superficie, b.centro)
        lnS.append(np.log(np.maximum(es, 1e-300)))
        m = np.zeros_like(fam.a) if superficie.assorbente else superficie.mu(k, fam.s_superficie)
        mu.append(m)
        if semicoerente:
            w = 2 * math.pi * b.centro
            fattore = 1 - m * _media_coseno(w * np.nan_to_num(rit_s), b)
            Fs.append(np.where(fam.superficie & ~np.isnan(rit_s), fattore, 1.0))
        else:
            Fs.append(np.ones_like(fam.a))
    # Canali delimitati da un punto d'inversione: tunnel e sostegno modale (ritenzione_barriera), per banda.
    # Soglia del primo modo: 3/4 pi se l'altro confine e' un rimbalzo, pi/2 se e' un'altra inversione.
    lnBg, lnBs = [], []
    soglia_g = np.where(fam.superficie, 0.75 * math.pi, 0.5 * math.pi)
    soglia_s = np.where(fam.fondo, 0.75 * math.pi, 0.5 * math.pi)
    for b in bande:
        w = 2 * math.pi * b.centro
        if barriere:
            lnBg.append(np.log(np.maximum(ritenzione_barriera(fam.barriera_giu, fam.fase_mezzo, w, soglia_g), 1e-300)))
            lnBs.append(np.log(np.maximum(ritenzione_barriera(fam.barriera_su, fam.fase_mezzo, w, soglia_s), 1e-300)))
        else:
            lnBg.append(np.zeros(len(th)))
            lnBs.append(np.zeros(len(th)))
    lam = np.array([c0 / b.centro for b in bande]) * larghezza_minima
    alfa = np.array([b.alfa for b in bande]) / 1000.0 * math.log(10) / 10      # neper di energia per metro
    J = len(th)
    for i0 in range(0, J, blocco):
        idx = np.arange(i0, min(J, i0 + blocco))
        v = fam.valuta(idx, rr)
        zp = piu.valuta(idx, rr)['z']
        zm = meno.valuta(idx, rr)['z']
        z = v['z']
        pav = v['n_pav']
        dzdth = np.maximum(np.abs(zp - z), np.abs(z - zm)) / eps
        wt = dzdth * dth[idx][:, None]
        E0 = dth[idx][:, None] / rr[None, :]
        # curvatura del raggio nel punto (1/raggio di curvatura = a |g|), per la larghezza minima di Airy
        curv = fam.a[idx][:, None] * np.abs(v['gradiente'])
        for ib, b in enumerate(bande):
            lnE = (np.log(E0) + v['n_sup'] * lnS[ib][idx][:, None] + v['n_fon'] * lnRf[ib][idx][:, None]
                   + v['n_pav'] * lnBg[ib][idx][:, None] + v['n_tet'] * lnBs[ib][idx][:, None]
                   - alfa[ib] * v['cammino'])
            E = np.exp(lnE) * Fs[ib][idx][:, None]
            vivi = E.max(axis=1) > 1e-25
            if not np.any(vivi):
                continue
            # lamella minima: una lunghezza d'onda e, dove il raggio curva, due volte la scala di Airy della caustica
            # l = (R / (2 k^2))^(1/3) = (lambda^2 R / (8 pi^2))^(1/3), R = 1/(a |g|) il raggio di curvatura del raggio
            # (il campo vicino a un punto d'inversione e' una funzione di Airy di (z_t - z)/l)
            cv = curv[vivi]
            with np.errstate(divide='ignore'):
                airy = np.where(cv > 0, 2.0 * np.cbrt(lam[ib] ** 2 / (8 * math.pi ** 2) / np.where(cv > 0, cv, 1.0)), 0.0)
            # ...ma mai piu' di un decimo della distanza: vicino alla sorgente non ci sono caustiche, e il campo
            # varia in quota sulla scala della distanza stessa
            minima = np.minimum(np.maximum(lam[ib], airy), 0.1 * rr[None, :])
            Ev, zv, wv = E[vivi], z[vivi], np.maximum(wt[vivi], minima)
            righe = np.nonzero(vivi)[0]
            # Lamelle larghe quanto la colonna d'acqua: energia stesa uniformemente sul fondale.
            unif = wv >= H
            ru, cu = np.nonzero(unif)
            Eu = Ev[ru, cu] / H
            pu = pav[righe][ru, cu] >= 1
            # Le altre: tende (triangolo di semilarghezza w e area E: le tende di raggi vicini si sommano come
            # un'interpolazione lineare fra i raggi), piegate alla superficie e al fondo (immagini).
            rt, ct = np.nonzero(~unif)
            zt = zv[rt, ct]
            it = 1.0 / wv[rt, ct]
            dt_ = Ev[rt, ct] * it
            pt = pav[righe][rt, ct] >= 1
            if semicoerente:
                sup_r = fam.superficie[idx][vivi]
                mu_r = mu[ib][idx][vivi]
            for kr, q in enumerate(zr):
                if semicoerente:
                    # Il gemello di Lloyd dal lato del ricevitore e' un raggio distinto da quello dal lato della
                    # sorgente solo se fra i due c'e' stato almeno un passaggio dal pavimento (fondo o inversione):
                    # senza, la coppia diretto/riflesso e' una sola e l'ha gia' contata il fattore della sorgente.
                    rr_q = rit_r[kr][idx][vivi]
                    fr = 1 - mu_r * _media_coseno(2 * math.pi * b.centro * np.nan_to_num(rr_q), b)
                    fr = np.where(sup_r & ~np.isnan(rr_q), fr, 1.0)
                    fu = np.where(pu, fr[ru], 1.0)
                    ft = np.where(pt, fr[rt], 1.0)
                else:
                    fu = 1.0
                    ft = 1.0
                acc = np.zeros(len(rr))
                if len(cu):
                    acc += np.bincount(cu, weights=Eu * fu, minlength=len(rr))
                peso = dt_ * ft
                for d in (np.abs(q - zt) * it, (q + zt) * it, (2 * H - q - zt) * it):
                    m = d < 1.0
                    if np.any(m):
                        acc += np.bincount(ct[m], weights=peso[m] * (1.0 - d[m]), minlength=len(rr))
                I[ib, kr] += acc
    if sottocampioni > 1:
        I = I.reshape(B, K, sottocampioni, len(r)).mean(axis=2)
    return I


# ------------------------------------------------------------------------------------- campo coerente

def campo_coerente(prof, superficie, fondo, zs, zr, r, f, angoli=None, iterazioni=4):
    """Pressione complessa p(r) relativa a quella a 1 m (|p|^2 confrontabile con `campo`), somma coerente sugli
    autoraggi alla quota zr. Senza indice KMAH: vale in mezzi senza caustiche (acqua isovelocita')."""
    r = np.asarray(r, dtype=float)
    if angoli is None:
        angoli = ventaglio(passo_fine=0.01, passo_medio=0.05, passo_largo=0.1)
    th, _ = angoli
    fam = Famiglia(prof, zs, th)
    v = fam.valuta(np.arange(len(th)), r)
    z = v['z']
    w = 2 * math.pi * f
    c0 = fam.prof.c[0]
    k0 = w / c0
    p = np.zeros(len(r), dtype=complex)
    firma = v['n_sup'] * 1000 + v['n_fon'] * 2 + v['giu']
    for m in range(len(r)):
        za, zb = z[:-1, m], z[1:, m]
        stessa = firma[:-1, m] == firma[1:, m]
        tra = stessa & (((za - zr) * (zb - zr)) <= 0) & (za != zb)
        js = np.nonzero(tra)[0]
        if len(js) == 0:
            continue
        lo, hi = th[js].copy(), th[js + 1].copy()
        flo, fhi = za[js] - zr, zb[js] - zr
        rm = np.array([r[m]])
        for _ in range(iterazioni + 4):              # regula falsi (Illinois) sull'angolo
            t = hi - fhi * (hi - lo) / np.where(fhi != flo, fhi - flo, 1.0)
            ft = Famiglia(prof, zs, t).valuta(np.arange(len(t)), rm)['z'][:, 0] - zr
            sinistra = np.sign(ft) == np.sign(flo)
            lo = np.where(sinistra, t, lo)
            flo = np.where(sinistra, ft, flo)
            hi = np.where(sinistra, hi, t)
            fhi = np.where(sinistra, fhi * 0.5, ft)
        e = 1e-7
        f0 = Famiglia(prof, zs, t)
        v0 = f0.valuta(np.arange(len(t)), rm)
        z1 = Famiglia(prof, zs, t + e).valuta(np.arange(len(t)), rm)['z'][:, 0]
        z2 = Famiglia(prof, zs, t - e).valuta(np.arange(len(t)), rm)['z'][:, 0]
        dzdth = np.abs(z1 - z2) / (2 * e)
        amp = 1.0 / np.sqrt(r[m] * dzdth)
        Rb = fondo.riflessione(f0.prof.c[-1], f0.u_fondo)
        mu = 0.0 if superficie.assorbente else superficie.mu(k0, f0.s_superficie)
        fatt = (-mu) ** v0['n_sup'][:, 0] * Rb ** v0['n_fon'][:, 0]
        p[m] = np.sum(amp * fatt * np.exp(1j * w * v0['tempo'][:, 0]))
    return p


def perdita_db(I):
    """TL in dB da un'intensita' relativa a 1 m."""
    return -10.0 * np.log10(np.maximum(I, 1e-300))
