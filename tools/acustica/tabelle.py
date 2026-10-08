#!/usr/bin/env python3
"""
tabelle.py - le tabelle di propagazione di uno scenario (F2, filone G; PROGETTO §5.3).

Uso (Python 3.10+ con numpy e scipy; dalla radice del repo o da qui, e' lo stesso):

    python3 tools/acustica/tabelle.py                 rigenera torpex_palestra: .tl.bin e blocco `propagazione`
    python3 tools/acustica/tabelle.py --controlla     ricalcola e confronta con il file esistente, senza scrivere
    python3 tools/acustica/tabelle.py --processi 4    quanti processi (predefinito: tutti i core meno uno, al piu' 6)
    python3 tools/acustica/tabelle.py --solo-blocco   riscrive solo il blocco `propagazione` dello scenario dal
                                                      file .tl.bin esistente (note, fonti, parametri di lettura)

Scrive:
    shared/data/scenari/<id>.tl.bin    le tabelle (formato qui sotto)
    shared/data/scenari/<id>.json      solo il blocco `propagazione` (regioni, fondi, bande, quote, distanze,
                                       codifica, impronta del file); il resto dello scenario lo scrive
                                       tools/batimetria/scarica.py, che conserva questo blocco quando rigenera.

Il calcolo e' deterministico (stessi dati, stessi byte: la prova `test_convalida.py` e `--controlla` lo
verificano con lo SHA-256). Circa 2-4 minuti su 6 core, meno di 300 MB di memoria per processo.

FORMATO DEL FILE .tl.bin (little-endian)
    intestazione di 32 byte: 'TERMOTL1', poi sei uint32: numero di tabelle (regioni), di bande, di quote (l'elenco
    globale `propagazione.quote`), di distanze, il codice dello zero e il passo in centesimi di dB.
    poi, per ogni tabella t (nell'ordine di `propagazione.regioni`), per ogni banda b (ordine di
    `propagazione.bande`), per ogni coppia di quote i <= j fra le n_t quote valide della tabella (quelle
    dell'elenco globale sotto fondale - 1, piu' fondale - 1; ordine i = 0..n_t-1, j = i..n_t-1), un byte per
    distanza: codice = round((TL - 20 log10 r - alfa_b r) / passo) + zero, limitato a 0..255.
    La tabella e' simmetrica (reciprocita'): TL(i, j) = TL(j, i); si calcola con la sorgente alla quota piu' bassa
    (lo specchio di Lloyd semicoerente e' esatto in quel verso, vedi raggi.py).
"""
import argparse
import hashlib
import json
import math
import multiprocessing as mp
import os
import struct
import sys
import time

import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import ambiente as A  # noqa: E402
from raggi import campo, perdita_db  # noqa: E402

MAGIA = b'TERMOTL1'

# Lettura in linea (server/src/sim/world/propagazione.js): campioni del fondale lungo il percorso, perdita se il
# percorso passa sopra la terra. Nozionali; stanno nel blocco dello scenario perche' li legge il server.
CAMPIONI_PERCORSO = 15
PASSO_CAMPIONI = 2000.0
PERDITA_TERRA = 40.0
PERDITA_STRATO = 0.0
SOGLIA_TERRA = 1.0

_AMB = None


def _inizia(id_scenario):
    global _AMB
    _AMB = A.AmbienteScenario(id_scenario)


def _lavoro(compito):
    t, i = compito
    amb = _AMB
    reg = A.REGIONI[t]
    quote = A.quote_tabella(reg['fondale'])
    I = campo(amb.profilo(reg), amb.superficie(), amb.fondo(reg), quote[i], quote[i:], A.distanze(), amb.bande(),
              sottocampioni=1)
    # media mobile [1, 2, 1]/4 nell'intensita' lungo le distanze (passi del 2,5 %): smussa le caustiche residue
    J = I.copy()
    J[..., 1:-1] = 0.25 * I[..., :-2] + 0.5 * I[..., 1:-1] + 0.25 * I[..., 2:]
    return t, i, perdita_db(J)


def calcola(id_scenario, processi):
    amb = A.AmbienteScenario(id_scenario)
    bande = amb.bande()
    r = A.distanze()
    compiti = []
    for t, reg in enumerate(A.REGIONI):
        n = len(A.quote_tabella(reg['fondale']))
        compiti += [(t, i) for i in range(n)]
    # i lavori piu' lunghi (tabelle profonde, sorgenti in alto) per primi
    compiti.sort(key=lambda c: (-A.REGIONI[c[0]]['fondale'], c[1]))
    risultati = {}
    t0 = time.time()
    if processi > 1:
        ctx = mp.get_context('fork')
        with ctx.Pool(processi, initializer=_inizia, initargs=(id_scenario,)) as pool:
            for k, (t, i, tl) in enumerate(pool.imap_unordered(_lavoro, compiti)):
                risultati[(t, i)] = tl
                print(f'\r  {k + 1}/{len(compiti)} lavori, {time.time() - t0:.0f} s', end='', file=sys.stderr, flush=True)
    else:
        _inizia(id_scenario)
        for k, c in enumerate(compiti):
            t, i, tl = _lavoro(c)
            risultati[(t, i)] = tl
            print(f'\r  {k + 1}/{len(compiti)} lavori, {time.time() - t0:.0f} s', end='', file=sys.stderr, flush=True)
    print(file=sys.stderr)
    # codifica
    alfa = np.array([b.alfa for b in bande]) / 1000.0
    rif = 20 * np.log10(r)[None, :] + alfa[:, None] * r[None, :]          # B x M
    blocchi = []
    for t, reg in enumerate(A.REGIONI):
        n = len(A.quote_tabella(reg['fondale']))
        for ib in range(len(bande)):
            for i in range(n):
                tl = risultati[(t, i)][ib]                                   # (n - i) x M
                cod = np.clip(np.rint((tl - rif[ib][None, :]) / A.PASSO_DB) + A.ZERO_CODICE, 0, 255).astype(np.uint8)
                blocchi.append(cod.tobytes())
    intest = MAGIA + struct.pack('<6I', len(A.REGIONI), len(bande), len(A.QUOTE), A.DISTANZE_NUMERO, A.ZERO_CODICE,
                                 int(round(A.PASSO_DB * 100)))
    dati = intest + b''.join(blocchi)
    return amb, bande, dati


# ------------------------------------------------------------------------------------------ blocco JSON

def dato(valore, unita, fonte, confidenza, nota=None, rif=None):
    d = {'valore': valore}
    if unita is not None:
        d['unita'] = unita
    d['fonte'] = fonte
    d['confidenza'] = confidenza
    if nota:
        d['nota'] = nota
    if rif:
        d['rif'] = rif
    return d


def it(x, cifre=1):
    return f'{x:.{cifre}f}'.replace('.', ',')


def statistiche_regioni(amb):
    """Frazione dell'area di mare per classe di fondale (la classe piu' vicina nel logaritmo della profondita')."""
    b = amb.v['batimetria']
    g = np.fromfile(os.path.join(A.SCENARI, b['file']), dtype='<i2').astype(float)
    mare = g[g >= SOGLIA_TERRA]
    H = np.log(np.array([r['fondale'] for r in A.REGIONI]))
    k = np.argmin(np.abs(np.log(mare)[:, None] - H[None, :]), axis=1)
    return [float((k == t).mean()) for t in range(len(A.REGIONI))], len(mare) / len(g)


def blocco(amb, bande, dati, nome_file):
    frazioni, _ = statistiche_regioni(amb)
    t_ml, s_ml = amb.temperatura_strato()
    H = [r['fondale'] for r in A.REGIONI]
    confini = [math.sqrt(H[k] * H[k + 1]) for k in range(len(H) - 1)]
    nomi = {'costa': 'acque costiere', 'piattaforma': 'piattaforma', 'scarpata': 'scarpata', 'canale': 'canale'}
    note_fondo = {
        'costa_30': 'Acque costiere fra le isole, battute dalle correnti di marea piu\' forti dell\'area: fondo grossolano. '
                    'Nessun rilievo sedimentologico aperto letto per la piattaforma interna delle Faer Oer: nozionale, '
                    'per analogia con la ghiaia residuale che [MASSON03] trova dove le correnti superano 1 m/s.',
        'costa_60': 'Come costa_30.',
        'piattaforma_110': 'Piattaforma: sabbia (nozionale). [MASSON03] descrive al ciglio della piattaforma (circa 200 m) '
                           'ghiaia e sabbia mescolate, con sabbie mobili sopra un substrato di ghiaia.',
        'piattaforma_190': 'Come piattaforma_110; qui la colonna d\'acqua e\' gia\' stratificata d\'estate (fuori dal '
                           'fronte di marea).',
        'scarpata_350': '[MASSON03]: sulla scarpata superiore, sotto la corrente di pendio diretta a nord-est (oltre 0,75 '
                        'm/s), sabbie mobili su un substrato prevalentemente di ghiaia, fino a circa 500 m.',
        'scarpata_600': '[MASSON03]: sulla scarpata inferiore e sul fondo dei canali meridionali, veli di sabbia e sabbia '
                        'fangosa depositati dalle correnti di fondo (0,3-0,4 m/s); qui i parametri del limo.',
        'canale_900': '[MASSON03]: nel Canale delle Faer Oer i sedimenti piu\' grossolani stanno lungo il bordo '
                      'settentrionale, ai piedi della piattaforma delle Faer Oer: ghiaia solcata dalle correnti fra 750 e '
                      '1200 m. La parte del canale nell\'area e\' quella.',
    }
    regioni = []
    for t, reg in enumerate(A.REGIONI):
        da = confini[t - 1] if t > 0 else 0.0
        a = confini[t] if t < len(confini) else None
        voce = {
            'id': reg['id'],
            'nome': f"{nomi[reg['gruppo']]}, {int(reg['fondale'])} m",
            'gruppo': reg['gruppo'],
            'fondale': dato(reg['fondale'], 'm', '[EMODNET-DTM] [CALC-TL]', 'nozionale',
                            'Profondita\' della tabella. Fra due classi la lettura in linea interpola nel logaritmo della '
                            'profondita\' locale.'),
            'da': dato(round(da, 1), 'm', '[CALC-TL]', 'calcolato', 'Media geometrica con la classe precedente.'),
        }
        if a is not None:
            voce['a'] = dato(round(a, 1), 'm', '[CALC-TL]', 'calcolato', 'Media geometrica con la classe seguente.')
        voce['fondo'] = reg['fondo']
        voce['nota_fondo'] = note_fondo[reg['id']]
        voce['profilo'] = reg['profilo']
        voce['area'] = dato(round(100 * frazioni[t], 1), '%', '[EMODNET-DTM]', 'calcolato',
                            'Frazione dei nodi di mare della griglia che cadono in questa classe.')
        regioni.append(voce)
    fondi = {}
    for k, p in A.FONDI.items():
        fondi[k] = {
            'nome': p['nome'],
            'velocita': dato(p['velocita'], 'm/s', '[JKPS11]', 'stimato', 'Velocita\' di compressione tipica (tab. 1.3).'),
            'densita': dato(p['densita'], '1', '[JKPS11]', 'stimato', 'Rispetto all\'acqua.'),
            'attenuazione': dato(p['attenuazione'], 'dB/λ', '[JKPS11]', 'stimato', 'Attenuazione di compressione.'),
            'angolo_critico': dato(round(math.degrees(math.acos(min(1.0, 1490.0 / p['velocita']))), 1), '°',
                                   '[JKPS11] [CALC-TL]', 'calcolato',
                                   'Radenza sotto la quale la riflessione e\' quasi totale, con 1490 m/s nell\'acqua sul fondo.'),
        }
    bb = []
    usi = {'sfera': 'banda larga della sfera (ottava di acustica.json)',
           'towed': 'banda larga dell\'antenna rimorchiata (ottava di acustica.json)',
           'f50': 'righe tonali basse (rete elettrica, pale)', 'f100': 'righe tonali', 'f300': 'righe tonali',
           'f1000': 'righe tonali alte', 'f3500': 'sonar attivo BQQ-5 e intercettazione (WLR-9)',
           'f25000': 'teste dei siluri e sonar ad alta frequenza (F3)'}
    for b in bande:
        stretta = b.id.startswith('f')
        bb.append({
            'id': b.id,
            'uso': usi[b.id],
            'centro': dato(b.centro, 'Hz', '[CALC-TL]' if stretta else '[CALC-TL] [URICK83]', 'nozionale',
                           'Frequenza di riferimento: la lettura per frequenza interpola fra le bande strette nel '
                           'logaritmo della frequenza.' if stretta else 'Come bande.' + b.id + ' di acustica.json.'),
            'da': dato(round(b.da, 3), 'Hz', '[CALC-TL]', 'nozionale',
                       'Centro meno il 10 %: la media sulla banda smussa le frange dello specchio di Lloyd.' if stretta
                       else 'Come in acustica.json.'),
            'a': dato(round(b.a, 3), 'Hz', '[CALC-TL]', 'nozionale', 'Centro piu\' il 10 %.' if stretta else 'Come in acustica.json.'),
            'alfa': dato(round(b.alfa, 6), 'dB/km', '[NPL-ABS] [WOA23] [GLODAP2]', 'calcolato',
                         'Ainslie & McColm al centro della banda nell\'acqua dello scenario (ambiente.assorbimento): '
                         'nelle tabelle e\' tolto (alfa per distanza) e la lettura lo rimette.'),
        })
    sha = hashlib.sha256(dati).hexdigest()
    return {
        'formato': 'termoclino-tl/1',
        'generato_da': 'tools/acustica/tabelle.py',
        'descrizione': ('Tabelle di perdita di trasmissione TL(distanza, quota della sorgente, quota del ricevitore, banda) '
                        'calcolate fuori linea con il tracciatore di raggi di tools/acustica (PROGETTO §5.3), una per '
                        'classe di fondale («regione»), e lette in linea da server/src/sim/world/propagazione.js. Metodo, '
                        'convalida e taratura in docs/CALIBRAZIONE_F2.md.'),
        'metodo': ('Raggi in forma chiusa in un ambiente indipendente dalla distanza (profilo lineare a tratti, fondo piatto '
                   'per regione); intensita\' semicoerente per tubi di raggi: somma incoerente dei raggi, ciascuno pesato '
                   'col fattore dello specchio di Lloyd mediato sulla banda alla sorgente e (dopo un passaggio dal fondo) al '
                   'ricevitore; lamelle minime di una lunghezza d\'onda e due scale di Airy alle caustiche; nei canali '
                   'chiusi da un punto d\'inversione la correzione WKB (effetto tunnel di Kemble e sostegno del primo '
                   'modo), che rende il canale superficiale sottile trasparente alle basse frequenze; riflessione di '
                   'Rayleigh sul fondo piu\' una perdita nozionale per rimbalzo, di Eckart in superficie; assorbimento di '
                   'Ainslie & McColm sul cammino dei raggi. '
                   'Lungo le distanze una media mobile [1, 2, 1]/4 dell\'intensita\' sui passi del 2,5 %. Lungo un percorso la lettura in linea media le tabelle delle '
                   'classi di fondale incontrate (pesate per tratto) e aggiunge una perdita se il percorso passa sopra la '
                   'terra.'),
        'profili': {
            'stratificato': {
                'descrizione': ('Estate al largo del fronte di marea: strato rimescolato isotermo fino alla profondita\' '
                                'dello strato dello scenario, alla temperatura e salinita\' climatologiche di quella quota; '
                                'sotto, il profilo climatologico. E\' la sonda tipo che la media climatologica smussa '
                                '(nota di ambiente.strato.profondita).'),
                'profondita_strato': dato(amb.strato, 'm', '[WOA23] [DBM04]', 'calcolato', 'ambiente.strato.profondita.'),
                'temperatura_strato': dato(round(t_ml, 3), '°C', '[WOA23]', 'calcolato',
                                           'Temperatura climatologica alla base dello strato.'),
                'salinita_strato': dato(round(s_ml, 3), 'psu', '[WOA23]', 'calcolato'),
                'velocita_superficie': dato(round(float(A.mackenzie(t_ml, s_ml, 0.0)), 2), 'm/s', '[MACK81] [WOA23]',
                                            'calcolato'),
                'velocita_base_strato': dato(round(float(A.mackenzie(t_ml, s_ml, amb.strato)), 2), 'm/s',
                                             '[MACK81] [WOA23]', 'calcolato',
                                             'Nello strato isotermo la velocita\' cresce solo con la pressione: un canale '
                                             'superficiale sottile. Con la correzione WKB il primo modo vi esiste da circa '
                                             '1,3-2,5 kHz ed e\' molto perduto per effetto tunnel: per i sonar (sotto i 4 kHz) '
                                             'il canale quasi non intrappola; conta per le alte frequenze (25 kHz).'),
            },
            'rimescolato': {
                'descrizione': ('Piattaforma interna, dentro il fronte di marea delle Faer Oer: colonna d\'acqua omogenea '
                                'tutto l\'anno, alle medie climatologiche di temperatura e salinita\' fra la superficie e il '
                                'fondale della classe. Niente strato: la velocita\' cresce dolcemente con la pressione e '
                                'piega i raggi verso la superficie.'),
                'fronte': dato(150.0, 'm', '[LHS09]', 'stimato',
                               'Il fronte di marea sta fra le isobate di 100 e 150 m; dentro l\'acqua e\' omogenea anche '
                               'd\'estate. Le classi fino a 110 m sono rimescolate, quelle da 190 m stratificate: fra le due la '
                               'lettura in linea interpola, ed e\' il fronte.'),
            },
        },
        'fondi': fondi,
        'perdita_fondo_extra': {
            'perdita': dato(A.PERDITA_FONDO_EXTRA, 'dB', '[FUN-8] [CALC-TL]', 'nozionale',
                            'Perdita al rimbalzo sul fondo in piu\' di quella del semispazio fluido liscio, uguale a ogni '
                            'radenza, alla frequenza di riferimento: rugosita\' (ghiaia, increspature, dune di sabbia di '
                            '[MASSON03]), stratificazione dei sedimenti, diffusione di volume e pendenze del fondale vero, '
                            'che il modello piatto e omogeneo non vede. Il semispazio da\' sotto l\'angolo critico solo '
                            '0,1-0,7 dB per rimbalzo su sabbia e ghiaia; [FUN-8] riporta da 2 a oltre 30 dB. Tarata perche\' '
                            'due 688 lenti sulla piattaforma si sentano a poche migliaia di iarde (PROGETTO §5.12): '
                            'docs/CALIBRAZIONE_F2.md.', 'docs/CALIBRAZIONE_F2.md'),
            'frequenza': dato(A.FREQUENZA_FONDO_EXTRA, 'Hz', '[CALC-TL]', 'nozionale', 'Frequenza a cui vale `perdita`.'),
            'esponente': dato(A.ESPONENTE_FONDO_EXTRA, '1', '[CALC-TL]', 'nozionale',
                              'La perdita in piu\' scala come (f / frequenza)^esponente: la rugosita\' conta meno alle basse '
                              'frequenze (1,5 dB a 300 Hz, 0,6 dB a 50 Hz, 14 dB a 25 kHz).'),
        },
        'superficie': {
            'stato_mare': dato(amb.stato_mare, 'n', '[NCEP-R1]', 'calcolato', 'ambiente.mare.stato_predefinito: le tabelle '
                               'valgono per questo stato del mare.'),
            'altezza_onde': dato(round(amb.sigma_onde, 3), 'm', '[PM64] [STOJ06]', 'calcolato',
                                 f'Altezza quadratica media delle onde, H1/3 / 4 con H1/3 = 0,0246 U10² (mare completamente '
                                 f'sviluppato) e il vento della classe {amb.stato_mare} ({it(amb.vento)} m/s).'),
            'frazione_avanti': dato(A.FRAZIONE_AVANTI, '1', '[ECK53]', 'nozionale',
                                    'Dell\'energia che la superficie rugosa toglie alla riflessione coerente (1 - mu², '
                                    'mu = exp(-2 (k sigma sin theta)²)), quanta resta nel raggio; il resto si perde. Al '
                                    'massimo 3 dB per rimbalzo.'),
            'altezza_significativa': dato(round(amb.h13, 3), 'm', '[PM64] [STOJ06]', 'calcolato',
                                          f'H1/3 = 0,0246 U10² con il vento della classe {amb.stato_mare}.'),
            'perdita_radenti': dato(round(A.perdita_schulkin(2000.0, amb.h13), 2), 'dB', '[SCH68] [URICK83]', 'stimato',
                                    'Perdita per rimbalzo dei raggi radenti a 2 kHz, formula empirica di Schulkin '
                                    '1,64·√(f·H) (f in kHz, H altezza delle onde in piedi, qui H1/3), uguale a ogni '
                                    'radenza e moltiplicata alla riflessione di Eckart; va come la radice della '
                                    f'frequenza: {it(A.perdita_schulkin(300.0, amb.h13))} dB a 300 Hz, '
                                    f'{it(A.perdita_schulkin(25000.0, amb.h13))} a 25 kHz. Senza, nell\'acqua rimescolata '
                                    'della piattaforma interna (che piega i raggi verso la superficie) il suono andrebbe '
                                    'lontanissimo senza perdere quasi nulla.'),
        },
        'regioni': regioni,
        'bande': bb,
        'quote': {'serie': list(A.QUOTE), 'unita': 'm', 'fonte': '[CALC-TL]', 'confidenza': 'nozionale',
                  'nota': ('Quote delle sorgenti e dei ricevitori; in ogni tabella valgono quelle sotto fondale - 1, piu\' '
                           'fondale - 1. Fitte vicino alla superficie e intorno allo strato (eliche delle navi a 5-6 m, '
                           'sfera a quota periscopica a 13 m, strato a 21 m). Fra due quote si interpola linearmente in dB.')},
        'distanze': {
            'prima': dato(A.DISTANZA_PRIMA, 'm', '[CALC-TL]', 'nozionale', 'Prima distanza della tabella; sotto, divergenza '
                          'sferica sulla distanza obliqua raccordata al primo valore.'),
            'rapporto': dato(A.DISTANZA_RAPPORTO, '1', '[CALC-TL]', 'nozionale',
                             'Progressione geometrica: un passo del 2,5 % (25 m a 1 km, 1 km a 40 km).'),
            'numero': dato(A.DISTANZE_NUMERO, 'n', '[CALC-TL]', 'nozionale', 'Fino a oltre 300 km.'),
        },
        'codifica': {
            'passo': dato(A.PASSO_DB, 'dB', '[CALC-TL]', 'nozionale', 'Un byte per valore: TL - 20 log10 r - alfa r.'),
            'zero': dato(A.ZERO_CODICE, 'n', '[CALC-TL]', 'nozionale', 'Codice dello zero: da -50 a +77,5 dB rispetto alla '
                         'divergenza sferica (oltre, il percorso e\' comunque muto).'),
        },
        'percorso': {
            'campioni': dato(CAMPIONI_PERCORSO, 'n', '[CALC-TL]', 'nozionale',
                             'Punti del fondale letti al piu\' lungo il segmento sorgente-ricevitore (estremi esclusi): '
                             'costo limitato e costante. Un\'isola piu\' stretta della distanza fra due campioni puo\' '
                             'sfuggire (oltre i 32 km i campioni si diradano: 18 km su 280 km).'),
            'passo_campioni': dato(PASSO_CAMPIONI, 'm', '[CALC-TL]', 'nozionale',
                                   'Un campione ogni tanti metri fino al massimo di `campioni`: la griglia del fondale e\' '
                                   'di 500 m, isole e pendenze si misurano in chilometri.'),
            'soglia_terra': dato(SOGLIA_TERRA, 'm', '[EMODNET-DTM]', 'nozionale', 'Un campione con meno acqua di cosi\' e\' terra.'),
            'perdita_terra': dato(PERDITA_TERRA, 'dB', '[CALC-TL]', 'nozionale',
                                  'Perdita in piu\' se il percorso passa sopra la terra: l\'isola fa ombra, e intorno passa '
                                  'solo la diffrazione. Nessun valore aperto; in F1 la terra non faceva ombra.'),
            'perdita_strato': dato(PERDITA_STRATO, 'dB', '[CW-MOD] [CALC-TL]', 'nozionale',
                                   'Regola di gioco facoltativa: perdita in piu\' per i percorsi con sorgente e ricevitore '
                                   'da parti opposte dello strato, per la frazione di percorso in acqua stratificata (da 500 '
                                   'a 2000 m raccordata, come in F1). Zero: vale solo la fisica delle tabelle, nella quale lo '
                                   'strato estivo di 21 m nasconde poco (docs/CALIBRAZIONE_F2.md, dove sta anche il valore '
                                   'che ridarebbe le bande dello strato di F1).'),
        },
        'tabella': {
            'file': nome_file,
            'codifica': 'uint8',
            'byte': len(dati),
            'sha256': sha,
        },
    }


def scrivi_json(percorso, sc):
    with open(percorso, 'w', encoding='utf-8') as fo:
        json.dump(sc, fo, ensure_ascii=False, indent=1)
        fo.write('\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    ap.add_argument('--scenario', default='torpex_palestra')
    ap.add_argument('--controlla', action='store_true', help='ricalcola e confronta, senza scrivere')
    ap.add_argument('--processi', type=int, default=max(1, min(6, (os.cpu_count() or 2) - 1)))
    ap.add_argument('--solo-blocco', action='store_true', help='riscrive solo il blocco JSON dal file esistente')
    a = ap.parse_args()
    t0 = time.time()
    if a.solo_blocco:
        amb = A.AmbienteScenario(a.scenario)
        nome = f'{a.scenario}.tl.bin'
        with open(os.path.join(A.SCENARI, nome), 'rb') as f:
            dati = f.read()
        bande = amb.bande()
        atteso = MAGIA + struct.pack('<6I', len(A.REGIONI), len(bande), len(A.QUOTE), A.DISTANZE_NUMERO, A.ZERO_CODICE,
                                     int(round(A.PASSO_DB * 100)))
        if dati[:32] != atteso:
            sys.exit('il file .tl.bin non corrisponde alle scelte di ambiente.py: rigenerare le tabelle')
        sc = amb.grezzi
        sc['propagazione'] = blocco(amb, bande, dati, nome)
        scrivi_json(amb.percorso_json, sc)
        print(f'riscritto il blocco propagazione di {os.path.relpath(amb.percorso_json, A.RADICE)}')
        return
    amb, bande, dati = calcola(a.scenario, a.processi)
    nome = f'{a.scenario}.tl.bin'
    percorso_bin = os.path.join(A.SCENARI, nome)
    sha = hashlib.sha256(dati).hexdigest()
    print(f'{len(dati)} byte, sha256 {sha}, {time.time() - t0:.0f} s')
    if a.controlla:
        with open(percorso_bin, 'rb') as f:
            vecchio = f.read()
        ok = vecchio == dati
        print('identico al file esistente' if ok else 'DIVERSO dal file esistente')
        sys.exit(0 if ok else 1)
    with open(percorso_bin, 'wb') as f:
        f.write(dati)
    sc = amb.grezzi
    sc['propagazione'] = blocco(amb, bande, dati, nome)
    scrivi_json(amb.percorso_json, sc)
    print(f'scritti {os.path.relpath(percorso_bin, A.RADICE)} e il blocco propagazione di '
          f'{os.path.relpath(amb.percorso_json, A.RADICE)}')


if __name__ == '__main__':
    main()
