# 05 — Acustica e ambiente: guida alla modellazione

Sezione del catalogo di riferimento per il tributo a *688 Attack Sub* (finestra storica 1985–1991).
Compilata il 2026-10-07. Le chiavi tra parentesi quadre (es. `[FUN-8 §8.9.2]`) rimandano a `FONTI.md`.

## 0. Convenzioni

**Confidenza** (colonna `confidenza` di ogni tabella):

| etichetta | significato |
|---|---|
| `documentato` | equazione o valore riportato da fonte ufficiale o autorevole (testo didattico USNA, norma o guida NPL, articolo con revisione paritaria), verificato sul testo |
| `stimato` | stima di fonte aperta credibile, oppure valore riportato da fonte secondaria senza verifica sul testo originale |
| `calcolato` | valore che ho ricavato con un calcolo riproducibile da equazioni `documentate` e da ipotesi dichiarate (script in `raw/05/calc/` e `raw/06/calc/`). Va trattato come `stimato` |
| `nozionale` | grandezza classificata o non pubblicata: è un valore di gioco proposto da me, con la motivazione |

**Unità.** I livelli sono in dB re 1 µPa (sorgenti a 1 m; rumore come livello spettrale, dB re 1 µPa²/Hz). Conversioni usate: 1 nmi = 1852 m = 2025,4 yd; 1 kyd = 914,4 m; 1 kt = 0,5144 m/s.

**Avvertenza di metodo.** I valori operativi reali (livelli irradiati dei singoli sottomarini, indici di direttività, soglie di rivelazione dei sonar di bordo) sono classificati. Le equazioni, l'oceanografia e la fisica sono invece pubbliche e solide. Per questo il documento separa nettamente la **fisica** (`documentato`) dai **numeri di piattaforma** (quasi sempre `nozionale`). Per il gioco la scelta consigliata è usare equazioni vere con parametri di piattaforma nozionali ma coerenti tra loro.

---

## 1. Le equazioni del sonar

### 1.1 Forma di base

La rivelazione avviene quando il segnale, al netto del rumore, supera la soglia di rivelazione: `S − N ≥ DT` `[FUN-8 §8.9.1, eq. 8-25]`. Per definizione, DT è il rapporto segnale/rumore che dà una **probabilità di rivelazione del 50%**. Se il rapporto medio fornito è maggiore di quello richiesto, la probabilità sale tra 50% e 100%; se è minore, scende tra 50% e 0% `[FUN-8 §8.9.1]`.

| equazione | forma | fonte | confidenza |
|---|---|---|---|
| Sonar passivo | `SL − TL − NL + DI ≥ DT` | [FUN-8 eq. 8-28] | documentato |
| Sonar attivo, limitato dal rumore | `SL − 2TL + TS − NL + DI ≥ DT` | [FUN-8 eq. 8-30] | documentato |
| Sonar attivo, limitato dalla riverberazione | `SL − 2TL + TS − RL ≥ DT` | [FUN-8 eq. 8-31] | documentato |
| Figure of merit passiva | `FOM = SL − NL + DI − DT` (= massima TL tollerabile per Pd 50%) | [FUN-8 eq. 8-32] | documentato |
| Figure of merit attiva | `FOM = SL + TS − NL + DI − DT` (massima TL a due vie) | [FUN-8 eq. 8-33] | documentato |
| Eccesso di segnale | `SE = SL − TL − NL + DI − DT` (passivo); SE = 0 equivale a Pd = 50% | derivato da [FUN-8]; uso standard in [SONALYSTS-SC] | documentato |

Nel sonar passivo `SL` è il livello irradiato dal **bersaglio**; nell'attivo è quello del **proprio** trasmettitore. `NL` raccoglie sia il rumore ambiente sia il rumore proprio, sommati in potenza `[FUN-8 §8.9.2]`.

**Chi determina ogni termine** `[FUN-8, tabella §8.9.1]`: SL attivo, NL proprio, DI e DT dipendono dall'apparato; TL, RL e NL ambiente dall'ambiente; TS e SL passivo dal bersaglio. Per il game design la tripartizione è utile: **il giocatore controlla** il rumore proprio (velocità, profondità, cavitazione), la geometria (aspetto, profondità rispetto allo strato) e la scelta del sensore (banda, DI). **L'ambiente** fissa TL e NL. **Il bersaglio** fissa SL e TS.

### 1.2 Esempio didattico FOM → portata (Islanda, estate, 2 kHz)

Il testo USNA mostra come la stessa FOM dia portate molto diverse a seconda del percorso disponibile `[FUN-8 §8.10.1]`. Le portate sono quelle al 50% di probabilità di rivelazione:

| sonar | FOM (dB) | percorso diretto | bottom bounce | convergence zone | fonte | confidenza |
|---|---|---|---|---|---|---|
| A | 80 | 7,5 kyd | nessuna | nessuna | [FUN-8 §8.10.1] | documentato (didattico) |
| B | 95 | 21 kyd | 50 kyd | 81 kyd | [FUN-8 §8.10.1] | documentato (didattico) |
| C | 105 | 36 kyd | 90 kyd | 160 kyd | [FUN-8 §8.10.1] | documentato (didattico) |

Implicazione di gioco: **15 dB di FOM in più non allungano solo la portata; aprono percorsi nuovi** (BB, CZ). È il meccanismo per cui un 688 silenzioso con un buon array trainato "vede" un Victor I in CZ, mentre l'avversario non lo vede affatto.

### 1.3 Da eccesso di segnale a probabilità di rivelazione

Il testo USNA spiega che i valori istantanei del rapporto segnale/rumore oscillano molto: cambiano l'operatore, la propagazione, il livello irradiato dal bersaglio e il rumore proprio. Per questo c'è una probabilità non nulla di rivelare anche quando il valore *medio* è sotto soglia `[FUN-8 §8.9.1]`. Il modello statistico abituale nelle analisi operative tratta SE come variabile normale. Se ne ricava:

`Pd = Φ(SE / σ)`, con Φ funzione di ripartizione normale standard.

| parametro | valore proposto | fonte / motivazione | confidenza |
|---|---|---|---|
| σ fluttuazione di SE | 5–8 dB (default 6 dB) | La forma è coerente con la definizione di DT al 50% `[FUN-8]`. σ è scelto da me: le fluttuazioni di TL a lungo raggio valgono diversi dB e le componenti si sommano in quadratura | nozionale |
| Correlazione temporale delle fluttuazioni | processo di Ornstein–Uhlenbeck con τ = 1–5 min | Evita lo "sfarfallio" del contatto a ogni tick. Il contatto deve andare e venire in modo plausibile | nozionale |
| Indice di rivelazione d per Pd = 50%, Pfa = 10⁻⁴ | d ≈ 13,8 (11,4 dB) | Calcolo gaussiano: d = (z₁₋Pfa)². Con Pfa = 10⁻² d ≈ 5,4; con 10⁻⁶ d ≈ 22,6 | calcolato |
| DT di un rivelatore di energia | `DT = 5 log₁₀(d·B/t)` (B banda in Hz, t tempo di integrazione in s) | Urick, *Principles of Underwater Sound*, 3ª ed. 1983, cap. 12 `[URICK83]` | stimato (da conoscenza pregressa, non riverificato sul testo) |

Uso nel gioco: con DT = 5 log(d·B/t), allungare l'integrazione (t) o restringere la banda (analisi narrowband) abbassa DT. È la meccanica "**più tempo sul contatto = rivelazione più debole possibile**". È anche la *recognition differential* che Sonalysts dichiara di modellare per ogni tipo di sonar `[SONALYSTS-SC]`.

---

## 2. Perdita di trasmissione (TL)

### 2.1 Divergenza geometrica

| legge | formula | quando | fonte | confidenza |
|---|---|---|---|---|
| Sferica | `TL = 20 log r` (r in m) | vicino alla sorgente, mezzo illimitato | [FUN-8 eq. 8-18] | documentato |
| Cilindrica | `TL = 10 log r` | portate ≫ profondità d'acqua, energia intrappolata in strato o canale | [FUN-8 eq. 8-20] | documentato |
| Totale con assorbimento e anomalia | `TL = 20 log r + αr + A` (sferica); `TL = 10 log r + αr + A` (cilindrica) | A = "anomalia" che raccoglie diffusione e perdite al fondo | [FUN-8 eq. 8-23/8-24] | documentato |
| Ibrida (pratica di simulazione) | `TL = 20 log r₀ + 10 log(r/r₀) + αr` per r > r₀; r₀ ≈ profondità dello strato o del canale | interpolazione standard fra i due regimi | (forma derivata da FUN) | nozionale |
| "Practical spreading" | `TL = 15 log r + αr` | compromesso usato in letteratura sulle comunicazioni acustiche (k = 1,5) | [STOJ06] | documentato (in quel contesto) |

### 2.2 Assorbimento: attenzione alla formula del testo USNA

Il testo USNA dà `α = 0,036 f²/(f² + 3600) + 3,2·10⁻⁷ f²` in dB/m (f in kHz, acqua a 5 °C) `[FUN-8 eq. 8-21]`. **Questa formula omette il rilassamento dell'acido borico.** Sotto i 5 kHz sottostima l'assorbimento fino a un ordine di grandezza. Il confronto che segue è `calcolato` con lo script `raw/05/calc/absorption_noise.py`. Uso la formula di Thorp in dB/km `[STOJ06 eq. 3]` e quella di Ainslie & McColm (1998), presa dal codice del calcolatore NPL `[NPL-ABS]`.

| f (kHz) | FUN eq. 8-21 (dB/km) | Thorp (dB/km) | Ainslie–McColm, 4 °C, S 35, pH 8 (dB/km) | A&M Mediterraneo, 13,5 °C, S 38,6, pH 8,2 | confidenza |
|---|---|---|---|---|---|
| 0,1 | 0,0001 | 0,003 | 0,001 | 0,001 | calcolato |
| 0,3 | 0,0009 | 0,012 | 0,010 | 0,010 | calcolato |
| 1 | 0,010 | 0,069 | 0,064 | 0,080 | calcolato |
| 2 | 0,041 | 0,135 | 0,124 | 0,175 | calcolato |
| 3,5 | 0,126 | 0,239 | 0,224 | 0,282 | calcolato |
| 10 | 1,005 | 1,187 | 1,154 | 1,023 | calcolato |
| 30 | 7,49 | 8,28 | 7,65 | 6,97 | calcolato |
| 50 | 15,6 | 17,5 | 15,1 | 16,4 | calcolato |

**Formula raccomandata per il gioco: Ainslie & McColm (1998)** `[NPL-ABS]`, con f in kHz, T in °C, S in psu e z in km:

```
f1 = 0.78·sqrt(S/35)·exp(T/26)                  # rilassamento acido borico (kHz)
f2 = 42·exp(T/17)                               # rilassamento MgSO4 (kHz)
α  = 0.106·f1·f²/(f²+f1²)·exp((pH−8)/0.56)
   + 0.52·(1+T/43)·(S/35)·f2·f²/(f²+f2²)·exp(−z/6)
   + 0.00049·f²·exp(−(T/27 + z/17))             # dB/km
```

La formula di Francois & Garrison (1982, JASA 72(3) e 72(6)) è più completa; la NPL la implementa nello stesso calcolatore `[NPL-ABS]`. Ainslie & McColm la riassumono con accuratezza simile, e la NPL preferisce citarli per semplicità `[NPL-ABS]`.

**Ordini di grandezza utili** (A&M, 4 °C; perdita per solo assorbimento su 30 nmi = 55,6 km; `calcolato`): 50 Hz ≈ 0 dB; 300 Hz ≈ 0,6 dB; 1 kHz ≈ 3,5 dB; 3,5 kHz ≈ 12 dB; 10 kHz ≈ 64 dB; 25 kHz ≈ 320 dB.
Ne segue che **le rivelazioni in CZ e a lungo raggio sono un fatto di bassa frequenza** (righe tonali < 500 Hz sull'array trainato). Le teste dei siluri (decine di kHz) "vedono" solo a poche migliaia di yard.

> Nota critica. Il supplemento USNA sul TASS indica α = 0,9 dB/m a 2 kHz e 0,01 dB/m a 50 Hz `[FUN-TASS]`. Sono valori sbagliati di circa quattro ordini di grandezza (il valore corretto a 2 kHz è circa 0,12 dB/**km**). Il ragionamento qualitativo del supplemento resta valido (bassa frequenza = lunga portata, ma servono aperture grandi); **i suoi numeri non vanno usati**.

### 2.3 Perdite al contorno e riverberazione

| grandezza | valore | fonte | confidenza |
|---|---|---|---|
| Perdita per riflessione sul fondo | da 2 a oltre 30 dB per rimbalzo; fondi molli (fango) 10–30 dB; roccia o sabbia liscia meno | [FUN-8 §8.7.3.2] | documentato |
| Deep scattering layer | circa 600 m di giorno; di notte risale verso la superficie e diventa una forte sorgente di riverberazione per i sonar attivi | [FUN-8 §8.7.3.2] | documentato |
| Riverberazione di superficie | cresce con il vento (stato del mare) | [FUN-8 §8.7.3.2] | documentato |
| Target strength di un sottomarino | in genere 15–25 dB, dipende dall'aspetto (al traverso più alta che di prua) | [FUN-8 §8.9.3.2] | documentato |

Proposta di gioco (nozionale): TS = 10 dB di prua o di poppa, 25 dB al traverso, con interpolazione a seno quadro dell'angolo d'aspetto. Bonus di +3 dB per scafi senza piastrelle anecoiche (Alfa, Victor I) e −5/−10 dB per scafi con rivestimento anecoico (Akula, Sierra, ultimi Victor III). Il rivestimento sovietico "Cluster Guard" è trattato in `01_piattaforme.md`, se la fonte è disponibile lì.

---

## 3. Rumore ambiente

### 3.1 Componenti (Wenz)

Il testo USNA classifica il rumore ambiente in idrodinamico (vento, onde, tempeste), sismico, traffico navale e biologico. Usa le curve di Wenz per stimarne i livelli `[FUN-8 §8.8.2–8.8.3]`.
Esempio svolto: a 300 Hz, rotte commerciali e mare con onde di 6 ft danno 65 dB (traffico) e 66 dB (onde), che combinati fanno **68,4 dB** `[FUN-8 §8.8.3]` (`documentato`, didattico).

### 3.2 Modello parametrico (Coates, ripreso da Stojanovic)

Livelli spettrali in dB re 1 µPa²/Hz con f in kHz. `s` è l'attività navale (0 = bassa, 1 = alta) e `w` il vento in m/s `[STOJ06 eq. 6]`, da Coates, *Underwater Acoustic Systems* (1989):

```
N_turb(f)  = 17 − 30 log f                                  # domina sotto ~10 Hz
N_ship(f)  = 40 + 20(s − 0.5) + 26 log f − 60 log(f + 0.03) # domina 10–100 Hz
N_wind(f)  = 50 + 7.5 w^0.5 + 20 log f − 40 log(f + 0.4)    # domina 100 Hz–100 kHz
N_therm(f) = −15 + 20 log f                                 # domina sopra ~100 kHz
NL = 10 log(Σ 10^(N_i/10))
```

Valori `calcolati` con questa forma (dB re 1 µPa²/Hz):

| f | s = 0,2, w = 0 | s = 0,5, w = 5 m/s | s = 0,5, w = 10 m/s | s = 1, w = 10 m/s | s = 0,5, w = 15 m/s | confidenza |
|---|---|---|---|---|---|---|
| 50 Hz | 66,4 | 72,2 | 72,5 | 82,0 | 73,2 | calcolato |
| 100 Hz | 61,4 | 67,8 | 69,6 | 77,5 | 72,6 | calcolato |
| 300 Hz | 50,9 | 63,3 | 69,6 | 70,9 | 74,8 | calcolato |
| 1 kHz | 44,5 | 61,0 | 67,9 | 67,9 | 73,2 | calcolato |
| 3 kHz | 38,3 | 55,1 | 62,0 | 62,0 | 67,3 | calcolato |
| 10 kHz | 29,3 | 46,1 | 53,0 | 53,0 | 58,4 | calcolato |

### 3.3 Curve di Knudsen per stato del mare (1–25 kHz)

Kurahashi & Gratta parametrizzano lo spettro medio a stato del mare 0 dalle curve di Urick come `P(f) = 10 log(f^(−5/3)) + 94,5` (f in Hz). Per gli stati più alti aggiungono `30 log(n_s + 1)` `[KG08 eq. 1–2]`. Tabella `calcolata`:

| stato del mare | 300 Hz | 1 kHz | 3 kHz | 10 kHz | confidenza |
|---|---|---|---|---|---|
| 0 | 53,2 | 44,5 | 36,5 | 27,8 | calcolato da [KG08] |
| 1 | 62,2 | 53,5 | 45,6 | 36,9 | calcolato |
| 2 | 67,5 | 58,8 | 50,9 | 42,1 | calcolato |
| 3 | 71,3 | 62,6 | 54,6 | 45,9 | calcolato |
| 4 | 74,2 | 65,5 | 57,5 | 48,8 | calcolato |
| 6 | 78,6 | 69,9 | 61,9 | 53,2 | calcolato |

(A 300 Hz il modello di Knudsen è al limite della sua validità: lì domina il traffico. Usare il modello di Coates.)

### 3.4 Altre sorgenti

| sorgente | effetto | fonte | confidenza |
|---|---|---|---|
| Pioggia | Forte aumento tra 1 e 10 kHz. Cold Waters lo limita a +20 dB (`MaxNoiseFromRain=20`) | Wenz 1962, non riverificato; [CW-MOD] | stimato |
| Gamberetti schioccatori | 86 dB re 1 µPa sopra i banchi; 1–50 kHz; tra 35°N e 40°S (fino a 52° lungo le coste europee); fondali sotto le 30 braccia; massimo al tramonto | [FUN-8 §8.8.2.4] | documentato |
| Pesci | 50–8000 Hz (vescica natatoria 75–150 Hz); picchi all'alba, al tramonto e nella stagione riproduttiva | [FUN-8 §8.8.2.4] | documentato |
| Traffico navale lontano | Solo basse frequenze; in acque profonde udibile a migliaia di km | [FUN-8 §8.8.2.3] | documentato |
| Sotto il pack artico | Livelli tra i più bassi degli oceani sotto pack consolidato, ma molto variabili: intervallo di 30–40 dB. Transitori del ghiaccio oltre 100 dB re 1 µPa²/Hz. Vicino al margine del ghiaccio fino a +10 dB | [REEVES17] | documentato |

**Mappa nozionale stato del mare → vento** per pilotare il modello di Coates: SS0 = 0–1 m/s, SS1 = 2–3, SS2 = 4–5, SS3 = 6–7, SS4 = 8–10, SS5 = 11–13, SS6 = 14–17 m/s (`nozionale`; scala Beaufort approssimata).

---

## 4. Velocità del suono e profili

### 4.1 Equazione di Mackenzie (1981)

`documentato` `[NPL-SS]`, `[MACK81]`:

```
c(T,S,D) = 1448.96 + 4.591 T − 5.304e-2 T² + 2.374e-4 T³
         + 1.340 (S − 35) + 1.630e-2 D + 1.675e-7 D²
         − 1.025e-2 T (S − 35) − 7.139e-13 T D³        [m/s]
T in °C, S in psu, D in m. Validità: T 2–30 °C, S 25–40, D 0–8000 m.
```

Alternative: la formula semplificata di Wilson (1960) del testo USNA, `c = 1449 + 4,6T + 0,055T² + 0,003T³ + (1,39 − 0,012T)(S − 35) + 0,017d`, accurata entro 0,6 m/s nel 96% dei casi secondo `[FUN-8 eq. 8-11]`. Poi Coppens (1981), valida per 0–35 °C, 0–45 psu e 0–4000 m `[NPL-SS]`. Infine UNESCO / Chen–Millero e Del Grosso, più precise ma in funzione della pressione `[NPL-SS]`.
**Il Mar di Norvegia e l'Artico profondo hanno T < 2 °C, fuori dal dominio di Mackenzie.** L'errore resta piccolo per un gioco, ma il dato va dichiarato.

Sensibilità utili (derivate di Mackenzie, `calcolato`): circa +3,5–4,5 m/s per °C (di più in acqua fredda), +1,3 m/s per psu, +16–17 m/s per km di profondità. Velocità standard da 1500 m/s, campo reale 1420–1560 m/s `[FUN-8 §8.4.5]`.

### 4.2 Struttura tipica

Il profilo profondo tipico ha quattro strati `[FUN-8 §8.4.7]`:

1. **strato superficiale** rimescolato dal vento, con variazioni giornaliere;
2. **termoclino stagionale** a gradiente negativo, forte in estate e in autunno, quasi assente in inverno e in Artico;
3. **termoclino principale** (permanente);
4. **strato isotermo profondo** a circa 4 °C, con gradiente positivo dovuto alla pressione.

Il **minimo** di velocità tra 3 e 4 è l'asse del canale profondo (SOFAR). Nel 90% circa dei batitermogrammi c'è uno strato isotermo sopra un gradiente negativo. La *layer depth* è la profondità di massima velocità sopra il termoclino stagionale `[FUN-8 §8.6.2]`.
Le variazioni stagionali riguardano solo lo strato superficiale `[FUN-SEASON]`. In inverno lo strato superficiale è quasi isotermo e il gradiente leggermente positivo: è la migliore occasione per un *surface duct*. In estate prevale un gradiente negativo marcato. Primavera e autunno sono di transizione, e in autunno è difficile che il raffreddamento crei un gradiente positivo.

Profili **idealizzati** usati nei calcoli di §5.3. I valori di T e S sono `nozionali` (illustrativi, plausibili per la climatologia ma **non** tratti da un atlante). Le velocità del suono sono `calcolate` con Mackenzie:

| ambiente | c superficie/strato | minimo (asse) | c al fondo | fondo | confidenza |
|---|---|---|---|---|---|
| Nord Atlantico, ~40°N 30°W, estate | 1522,8 m/s | 1493 m/s a ~1000 m | 1545 m/s | 5000 m | nozionale/calcolato |
| Nord Atlantico, inverno (strato rimescolato 150 m) | 1510 m/s | 1493 m/s a ~1000 m | 1545 m/s | 5000 m | nozionale/calcolato |
| Mar di Norvegia, ~68°N, estate | 1490 m/s | 1463 m/s a ~700 m | 1499 m/s | 3200 m | nozionale/calcolato |
| Mediterraneo (Ionio), estate | 1538 m/s | 1514 m/s a ~200 m (acqua profonda calda, ~13,7 °C) | 1574 m/s | 4000 m | nozionale/calcolato |
| Pacifico NE, ~35°N 150°W, estate | 1518 m/s | 1481 m/s a ~800 m | 1550 m/s | 5500 m | nozionale/calcolato |
| Artico sotto il ghiaccio | minimo vicino alla superficie: profilo a gradiente positivo, "semicanale" a rifrazione verso l'alto | — | — | — | documentato (qualitativo) [REEVES17] |

---

## 5. Percorsi di propagazione

### 5.1 Strato superficiale, zona d'ombra, "best depth"

| fenomeno | dati | fonte | confidenza |
|---|---|---|---|
| Zona d'ombra sotto lo strato | Se la temperatura cala di 2 °C o più nei primi 10 m, la zona d'ombra comincia oltre circa 1000 m | [FUN-8 §8.6.2] | documentato |
| Raggio critico | I raggi sotto l'angolo critico restano nello strato; gli altri lo attraversano e vengono rifratti verso il basso. Tra i due rami resta un'ombra (non perfetta, per la diffrazione) | [FUN-8 §8.6.2] | documentato |
| Profondità ottimale di avvicinamento | `best depth ≈ 17·√Z` (Z = layer depth in m), valida fino a Z = 60 m; oltre, layer depth + 60 m | [FUN-8 eq. 8-33] | documentato (nell'HTML il simbolo √ è andato perso: lo ricostruisco perché è l'unica forma coerente con il raccordo a Z = 60 m) |
| Rilevazione attraverso lo strato | Ridotta: il sottomarino sotto uno strato sottile sente la nave di superficie, il cui sonar resta intrappolato sopra. Contromossa: VDS o inclinazione del fascio | [FUN-9, "Environmental Problems"] | documentato |
| Effetto pomeridiano | Se c'è poco vento, il riscaldamento crea un gradiente positivo tra metà mattina e metà pomeriggio, e le prestazioni del sonar di superficie peggiorano | [FUN-9] | documentato |
| Fronti e correnti | Un sottomarino che passa dalla corrente del Labrador alla Corrente del Golfo "sparisce come chi esce da un campo ed entra in un bosco" | [FUN-8 §8.4.7] | documentato (qualitativo) |

Per la perdita attraverso lo strato non ho trovato valori aperti affidabili. Proposta `nozionale`: 0–15 dB a seconda della "forza dello strato", da derivare dal salto di velocità alla base dello strato (ad esempio 3 dB per ogni m/s di salto, fino a un massimo di 15 dB). Per confronto, Cold Waters usa `MaxLayerBonus=12` e `MaxSurfaceDuctBonus=12` `[CW-MOD]`.

### 5.2 Surface duct

Si forma con un gradiente positivo vicino alla superficie (inverno, strato isotermo). Intrappola le frequenze **sopra una frequenza di taglio**, che cresce al diminuire dello spessore del condotto; le frequenze molto basse "escono". I condotti superficiali eccezionali (gradiente termico positivo) sono "rari e poco stabili" `[FUN-8 §8.6.3]`.
Proposta `nozionale`: con condotto di spessore H (m), le frequenze sotto `f_c ≈ 1500 / (0,015·H^1,5)` Hz non sono intrappolate. Il coefficiente vale circa 0,015 in metri ed è ricavato da una regola di Urick ricordata in piedi (λ_max ≈ 8,5·10⁻³ H^1,5), **non riverificata**. Con H = 30 m, f_c ≈ 600 Hz; con H = 100 m, f_c ≈ 100 Hz. Dentro il condotto: divergenza cilindrica oltre r₀ ≈ H, più una perdita di 1–3 dB per "skip" (nozionale).

### 5.3 Convergence zone (CZ)

| dato | valore | fonte | confidenza |
|---|---|---|---|
| Distanza tipica della prima CZ (testo USNA) | "circa 50 km" (~27 nmi), poi multipli successivi | [FUN-8 §8.6.3] | documentato (valore indicativo) |
| Condizione di formazione | Serve *depth excess*: il fondo deve stare sotto la profondità coniugata, dove c eguaglia la velocità di superficie o di strato. Per CZ operativamente utili con guadagno affidabile si indicano circa 1200 ft (~366 m) di depth excess. Il testo dice "a maximum", ma il senso è un minimo | [FUN-8 §8.6.4] | documentato (con nota sulla formulazione) |
| CZ misurata, Pacifico, aprile 1976 (550 Hz, sorgente 100 m, ricevitore 400 m) | caustica a 33,5 km; tre CZ entro 185 km | [BJ82] | documentato |
| Atlantico vs Mediterraneo (studio NATO SACLANTCEN) | intervallo fra le CZ ~60 km in Atlantico, solo 35–40 km in Mediterraneo; focalizzazione molto più forte in Atlantico; nei casi studiati la CZ compare solo in condizioni estive | [SM194] (letto solo l'abstract tramite motore di ricerca: il PDF DTIC restituisce 403) | stimato |
| Ampiezza dell'anello | "pochi miglia", circa 5–10% della distanza | snippet di ricerca senza fonte primaria; coerente con i calcoli sotto | stimato |
| Guadagno di convergenza | "6–20 dB" rispetto alla sola divergenza | snippet di ricerca, fonte primaria non individuata | stimato (debole) |
| Cold Waters (videogioco 2017) | `ConvergenceRange=35000,44000` yd (17–22 nmi: compressa per giocabilità), `MaxConvergenceBonus=20` dB; modellata solo la prima CZ | [CW-MOD], descrizione su forum | documentato (come scelta di gioco) |

**Calcolo di controllo** con ray tracing 2D (`raw/05/calc/cz_raytrace.py`, Mackenzie + profili idealizzati di §4.2). Prima CZ con sorgente e ricevitore alla stessa profondità, contando solo i percorsi rifratti in profondità che non toccano il fondo:

| ambiente | sorg./ric. 60 m | sorg./ric. 150 m | sorg./ric. 300 m | confidenza |
|---|---|---|---|---|
| Nord Atlantico, estate | 30,8–33,1 nmi | 29,6–32,6 nmi | 28,1–32,8 nmi | calcolato |
| Nord Atlantico, inverno | 30,6–34,9 nmi | 29,7–32,6 nmi | 28,1–32,0 nmi | calcolato |
| Mar di Norvegia, estate (depth excess ~500 m: marginale) | 25,0–26,2 nmi | 23,9–32,9 nmi | 21,7–24,5 nmi | calcolato |
| Pacifico NE, estate | 28,8–33,6 nmi | 27,1–33,2 nmi | 24,4–32,6 nmi | calcolato |
| Mediterraneo (Ionio), estate | 13,9–28,3 nmi | 11,3–27,9 nmi | 7,3–27,5 nmi | calcolato: il profilo a rifrazione verso l'alto quasi dalla superficie non dà un anello netto. Usare [SM194]: ~19–22 nmi |

Il risultato atlantico (≈30 nmi, anello di 2–5 nmi) concorda con il valore "~30 nmi" della domanda e con [FUN-8]. Valori proposti per il gioco (`nozionale`, ancorati alle righe precedenti):

| bacino | CZ1 (centro) | larghezza anello | guadagno | CZ2, CZ3 | note |
|---|---|---|---|---|---|
| Nord Atlantico / Pacifico profondo | 31 nmi (±2 secondo la stagione) | 3 nmi | +10 dB medi (picco +15) rispetto alla legge ibrida | a ×2 e ×3 della distanza, con −3 dB a ciascun anello | solo con fondale ≥ 4000 m |
| Mar di Norvegia | 25 nmi | 4 nmi | +6 dB | solo CZ2 | depth excess marginale: CZ inaffidabile, cioè intermittente |
| Mediterraneo | 20 nmi | 4 nmi | +5 dB | solo CZ2 | solo d'estate [SM194]; d'inverno nessuna CZ |
| Mare di Barents, piattaforme, Artico sotto il ghiaccio | — | — | — | — | nessuna CZ: acque basse oppure semicanale artico |

### 5.4 Bottom bounce, canale profondo, Artico

| percorso | modello | fonte | confidenza |
|---|---|---|---|
| Bottom bounce | Riflessione speculare; perdita per rimbalzo 2–30 dB (vedi §2.3); efficace su fondo piatto; dipende molto dalla profondità e dall'assorbimento del fondo | [FUN-8 §8.6.4] | documentato |
| Bottom bounce in Cold Waters | `BottomBounceRange=15000,20000` yd, `BottomBounceDepthRange=2000,2800`, `MaxBottomBounceBonus=10` | [CW-MOD] | documentato (scelta di gioco) |
| Canale profondo (SOFAR) | Asse oltre 1 km di profondità alle medie latitudini; solo divergenza cilindrica; portate molto lunghe in bassa frequenza; percorsi RSR e RBR | [FUN-8 §8.6.3] | documentato |
| Artico sotto il ghiaccio | Semicanale a rifrazione verso l'alto: le alte frequenze si attenuano molto per la diffusione sul ghiaccio rugoso, le basse (decine di Hz) viaggiano lontano | [REEVES17] | documentato (qualitativo) |

### 5.5 Acque basse

Il testo USNA nota che in acque basse fondo e superficie fanno da guida d'onda: le prestazioni possono migliorare, ma la riverberazione dal fondo può mascherare un bersaglio vicino `[FUN-8 §8.7.3.2; FUN-9]`. I sistemi di previsione di bordo come SIMAS non sono utilizzabili in acque basse `[SWOS-2.13]`.
Proposta `nozionale`: sotto i 200 m di fondale, TL cilindrica dopo r₀ = profondità del fondale, più 0,5–2 dB per km secondo il tipo di fondo (roccia, sabbia, fango).

---

## 6. Come le simulazioni modellano tutto questo a basso costo

### 6.1 La pratica della US Navy dell'epoca

- **Previsioni precalcolate** distribuite al gruppo: l'ICAPS calcola le portate previste per tutti i sonar del gruppo da battaglia e le diffonde con messaggio giornaliero. Il SIMAS (sull'AN/UYQ-25) calcola a bordo la FOM e le prestazioni previste dai batitermogrammi XBT, ma non funziona in acque basse `[SWOS-2.13]`.
- **Curve di perdita di propagazione**: la FOM si converte in portata solo con curve TL(r) per frequenza, area e stagione, "da un programma di ray tracing o da misure smussate" `[FUN-8 §8.10.1]`.
- **Modelli di propagazione degli anni '70–'80** confrontati con misure in CZ (Pacifico, 1976) `[BJ82]`:
  - **CONGRATS**, ray tracing coerente (Weinberg, NUSC 1969): entro 1,5 dB;
  - **FACT**, il modello a raggi "standard" della Marina (Spofford 1974): scarti oltre 10 dB nei dettagli;
  - **PE**, equazione parabolica (Tappert e Hardin): entro 1 dB. Gli autori preferiscono la PE per la diffrazione completa e la facilità d'uso.

### 6.2 Giochi e simulatori commerciali

| prodotto | come modella | fonte | confidenza |
|---|---|---|---|
| *688(I) Hunter/Killer* (1997) → *Sub Command* (2001), Sonalysts | Eccesso di segnale passivo `SE = RN − PL − IN − RD`. Propagazione calcolata "al volo" con interazioni con superficie, fondo e strato termico più attenuazione con la distanza. Rumore interferente = fondo (stato del mare, pioggia, traffico) + rumore proprio in funzione della velocità. *Recognition differential* specifico per tipo di sonar. Broadband modellato a 2–4 kHz e variabile con la velocità; narrowband con 5 righe fisse fra 50 Hz e 2 kHz per piattaforma, indipendenti dalla velocità (riga a 60 Hz per le navi USA, 50 Hz per tutte le altre). Ambiente scelto fra tre profili (surface duct, CZ, bottom limited), tre tipi di fondo e stato del mare 0–5. Le righe a bassa frequenza compaiono per prime sull'array trainato; il broadband arriva dopo. La classificazione richiede più righe narrowband | [SONALYSTS-SC] (note di progetto Sonalysts riportate da SUBSIM, copia Wayback del 2025-02-13) | documentato (come scelta di progetto) |
| *Sub Command*, cavitazione | Tabella misurata da un giocatore per il 688I: cavitazione a 9 kt sotto 74 ft, 16 kt sotto 212 ft, 30 kt sotto 466 ft. È una relazione quasi **lineare** profondità–velocità (~18 ft per nodo), diversa dalla legge fisica a radice quadrata di §7.2 | [SONALYSTS-SC] (sezione "nzm30's Cavitation Table") | documentato (come comportamento del gioco) |
| *Cold Waters* (Killerfish, 2017) | Bonus additivi in dB per surface duct (12), strato (12), CZ (20, a 35–44 kyd) e bottom bounce (10, a 15–20 kyd); `SpreadingFactor=20`, `AttenuationFactor=0.0008`; rumore ambiente base 75 dB, +5 dB per grado di stato del mare, pioggia fino a +20; cavitazione +20 dB; transitori +5; +1 dB per nodo di velocità del bersaglio; rumore di flusso del sonar +1 dB per nodo; `SelfNoise=115` nell'esempio del 688; bonus "running silent" 5–8 dB. Il manuale aggiunge che gli array trainati sono "accecati" dal rumore di flusso intorno a 10 kt | [CW-MOD], [CW-MAN p. 16] | documentato (come scelta di gioco) |

### 6.3 Architettura proposta per il nuovo gioco

**Livello A — fuori linea (al caricamento dello scenario o in fase di build).**
Per ogni *ambiente* (bacino × stagione: profilo, fondo, stato del mare) e per ogni *banda* (per esempio 50, 150, 300, 1000, 3500 e 25 000 Hz), si calcolano tabelle `TL[z_sorgente][z_ricevitore][r]`.
- Profondità: 6–8 classi (15, 60, 120, 200, 300, 450, 600 m, più "sotto/sopra lo strato").
- Distanza: passo di 0,25 nmi fino a 80 nmi.
- Strumenti: Bellhop (raggi/fasci gaussiani) o RAM (equazione parabolica) dalla Ocean Acoustics Library. In alternativa basta il tracciatore semplice di `raw/05/calc/cz_raytrace.py`, esteso con un'intensità per tubo di raggi.
- Le tabelle si smussano su ±0,5 nmi e si salvano in forma incoerente (senza interferenza a lobi, che sul piano di gioco è solo rumore).

**Livello B — in tempo reale.**
```
TL = interp(TL_tab[env][band], z_src, z_rec, r)              # lookup bilineare
SE = SL_target(band, v, aspect, cav) − TL − NL_tot(band, own_v, sea, rain, ship)
     + DI_sensor(band, bearing_rel) − DT_sensor(band, t_int)
Pd = Φ(SE_fluttuante / σ)  con SE_fluttuante = SE + OU(σ=4 dB, τ=3 min)
```
`NL_tot` è la somma in potenza del rumore ambiente (§3) e del rumore proprio (§7.1). Per l'array trainato si aggiunge il rumore proprio irradiato dal battello attraverso la distanza del cavo.

**Livello C — ripiego analitico** (se non si vogliono tabelle):
`TL = 20 log r₀ + 10 log(r/r₀) + α(f)·r + L_strato·[attraversa lo strato] − G_CZ·[r nell'anello CZ] + L_fondo·n_rimbalzi`, con i parametri di §2 e §5.

Costo: con 6 bande × 8 × 8 profondità × 320 passi di distanza servono circa 120 000 float per ambiente (meno di 0,5 MB). Il lookup costa pochi microsecondi per coppia sensore–bersaglio.

---

## 7. Rumore proprio, cavitazione, rumore irradiato

### 7.1 Rumore proprio e rumore di flusso

| fatto | fonte | confidenza |
|---|---|---|
| Il rumore di flusso ha una **soglia netta**: flusso quasi laminare solo sotto 1–2 kt per oggetti irregolari; oltre, la turbolenza cresce rapidamente con la velocità | [FUN-8 §8.8.1.2] | documentato |
| È soprattutto a **bassa frequenza** e quasi solo un problema di rumore proprio: forte sulla superficie dello scafo, debole nel campo irradiato | [FUN-8 §8.8.1.2] | documentato |
| Peggiora con le incrostazioni biologiche (fouling) | [FUN-8 §8.8.1.2] | documentato |
| Dipendenza dalla velocità: il rumore di flusso cresce più o meno come 50–60 log V | Urick 1983 [URICK83] | stimato (da conoscenza pregressa, non riverificato) |
| Le scelte di Cold Waters e Sub Command: +1 dB/kt (lineare); array trainato inutilizzabile oltre ~10 kt | [CW-MOD], [CW-MAN] | documentato (scelta di gioco) |

Curva proposta (`nozionale`) per il rumore proprio visto dai sensori dello scafo, in dB re 1 µPa²/Hz nella banda di 1 kHz:
`NL_self(v) = NL_mach + 10 log(1 + (v/v₀)^6)`, con NL_mach = 45 dB (macchinario a velocità minima) e v₀ = 8 kt per la sfera di prua, v₀ = 5 kt per i conformi di fianco.
Con questi valori: a 5 kt il rumore proprio è sotto il rumore di SS2 (~59 dB); a 15 kt arriva intorno a 61 dB e comincia a dominare; a 25 kt sale intorno a 75 dB. Così si riproduce la regola "per ascoltare si rallenta" (sprint & drift).
Per l'array trainato: v₀ = 3 kt e un massimo operativo di 12 kt (vedi `04_sensori.md` per i limiti meccanici dei TB-16 e TB-23).

### 7.2 Cavitazione

| fatto | fonte | confidenza |
|---|---|---|
| La cavitazione nasce alle punte delle pale e poi si estende a lamina (sheet cavitation); il rumore è un sibilo forte e continuo | [FUN-8 §8.8.1.3] | documentato |
| Con la profondità il rumore di cavitazione cala e si sposta verso frequenze più alte, come se si rallentasse | [FUN-8 §8.8.1.3] | documentato |
| Relazione critica: `N₀² / d = costante` (N₀ = giri critici, d = profondità). Esempio: 50 giri/min a 15 ft diventano 100 giri/min a 60 ft | [FUN-8 §8.8.1.3] | documentato (ma vedi la correzione sotto) |
| Urick (1967): i giri d'asse all'inizio della cavitazione sono circa proporzionali alla **radice quadrata della pressione statica**. Il rumore relativo si può tracciare in funzione di (velocità in nodi)/√(pressione in atmosfere) | brevetto US 3,676,802 (US Navy, 1972), simulatore di rumore di cavitazione per addestramento sonar [PAT3676802] | documentato |
| I siluri cercano e attaccano sotto la profondità di cavitazione; un sottomarino sotto attacco scende per poter correre senza cavitare | [FUN-8 §8.8.1.3] | documentato |

**Correzione fisica della formula USNA.** La pressione che conta è quella **assoluta**: atmosfera più colonna d'acqua, cioè circa 10,1 m (33 ft) d'acqua in più. La forma usata in USNA (∝ d) è un'approssimazione valida solo ben sotto la superficie. Dal numero di cavitazione σ = (p₀ − p_v)/(½ρV²) e dalla nota di Urick si ottiene:

`V_cav(d) = V_cav,ref · sqrt( (d + 10,1) / (d_ref + 10,1) )`  (d = profondità dell'elica in m)

| classe (proposta) | V_cav a quota periscopica (elica a ~20 m) | a 150 m | a 300 m | motivazione | confidenza |
|---|---|---|---|---|---|
| 688 / 688I | 8 kt | 18,5 kt | 25,6 kt | elica a 7 pale a basso numero di giri; buona progettazione | nozionale |
| Akula I | 8 kt | 18,5 kt | 25,6 kt | progettazione anni '80 di livello paragonabile | nozionale |
| Victor III | 7 kt | 16 kt | 22 kt | tecnologia intermedia | nozionale |
| Alfa (705) | 6 kt | 14 kt | 19 kt | elica ad alto numero di giri ottimizzata per la velocità | nozionale |

Salto di rumore all'inizio della cavitazione: +15–20 dB nel broadband sopra 1 kHz (Cold Waters usa +20 dB `[CW-MOD]`). Il salto si attenua gradualmente con la profondità secondo il rapporto V/V_cav (`nozionale`).

### 7.3 Rumore irradiato: tonali e broadband

| fatto | fonte | confidenza |
|---|---|---|
| Il macchinario (impianto, riduttori, pompe, generatori) è sempre presente. I grandi corpi rotanti generano basse frequenze; i piccoli servomotori e relè possono generare ultrasuoni più dannosi per i siluri | [FUN-8 §8.8.1.1] | documentato |
| Silenziamento dei sottomarini: basamenti isolati (raft); riduttori come sorgente principale; tentativi turbo-elettrici meno efficienti; eliche migliorate (vantaggio poi eroso dalla diffusione della tecnologia); circolazione naturale del reattore, pompe a idrogetto, piastrelle anecoiche | [FUN-8 §8.8.1.4.2] | documentato |
| Broadband variabile con la velocità, narrowband (tonali) no; righe elettriche a 60 Hz (USA) o 50 Hz (resto del mondo) | [SONALYSTS-SC] | documentato (come modello di gioco) |
| Navi mercantili (Ross 1976): `L(f) = 112 + 50 log(v/10) + 15 log(DT) + 20 − 20 log f` (v in kt, DT = dislocamento in t, f in Hz) | Ross 1976, riportato da [ARX2402] | stimato (riportato da fonte secondaria) |
| Le navi irradiano in modo asimmetrico: a poppa 5–10 dB più che a prua | McKenna et al. 2012 [MCK12] | documentato (per i mercantili) |

Proposta `nozionale` per i sottomarini (broadband, banda di 1 kHz, dB re 1 µPa²/Hz a 1 m):
`SL_bb(v) = SL₀ + 20 log(max(v, 3)/5)` sotto la cavitazione, più il salto di cavitazione di §7.2. L'aspetto aggiunge +3 dB di poppa e −2 dB di prua.
I valori di SL₀ per classe si ricavano dalla graduatoria qualitativa di `01_piattaforme.md`, applicando un'unica scala di 4–6 dB per "gradino": per esempio 688I = SL₀ di riferimento, Akula I = +2, Victor III = +6, Sierra = +6, Alfa = +14, Victor I = +20.
Le tonali hanno livelli fissi per piattaforma, e alcune (pompe del refrigerante) si accendono solo oltre una certa velocità: è il tipico "cambio di regime" che il giocatore può sfruttare.

---

## 8. Riepilogo dei parametri di gioco proposti

| parametro | valore | confidenza |
|---|---|---|
| Fluttuazione di SE | σ = 6 dB, OU con τ = 3 min | nozionale |
| Assorbimento | Ainslie & McColm per bacino (T, S, pH) | documentato (formula) |
| Rumore ambiente | Coates (traffico s, vento w) + pioggia (fino a +20 dB a 1–10 kHz) + biologico costiero | documentato (formule) / stimato (pioggia) |
| Prima CZ | Atlantico/Pacifico 31 nmi (anello 3 nmi, +10 dB); Norvegia 25 nmi (inaffidabile); Mediterraneo 20 nmi (solo d'estate) | calcolato / stimato |
| Perdita attraverso lo strato | 0–15 dB secondo la forza dello strato | nozionale |
| Best depth | 17√Z (Z ≤ 60 m), altrimenti Z + 60 m | documentato |
| Rumore di flusso | NL_self(v) = 45 + 10 log(1 + (v/8)^6) per la sfera; v₀ = 3 kt per l'array trainato | nozionale |
| Cavitazione | V_cav ∝ √(d + 10,1 m); 688 a 8 kt sotto quota periscopica | documentato (legge) / nozionale (valori) |
| TS attiva | 10 dB di prua o poppa, 25 dB al traverso | stimato (intervallo 15–25 da [FUN-8]) / nozionale (forma) |

Collegamenti: i parametri dei sensori (DI, bande, settori ciechi) sono in `04_sensori.md`; la qualità della soluzione di tiro dipende dalla rivelazione ed è trattata in `06_tma.md`.
