# 06 — Target Motion Analysis (TMA): metodi, osservabilità, qualità della soluzione, modello di gioco

Sezione del catalogo di riferimento per il tributo a *688 Attack Sub* (1985–1991). Compilata il 2026-10-07.
Convenzioni di confidenza come in `05_acustica.md` (`documentato`, `stimato`, `calcolato`, `nozionale`). Le chiavi rimandano a `FONTI.md`.

---

## 1. Il problema

La TMA stima posizione, rotta e velocità del bersaglio. Le fonti aperte la trattano nel caso di bersaglio a **moto rettilineo uniforme** `[WAG91]`, `[NAVOPS-11]`. Con il sonar passivo l'unica misura diretta è il **rilevamento**, più eventualmente la frequenza delle tonali. Le incognite sono quattro: per esempio distanza, rilevamento, rotta e velocità a un tempo di riferimento.

Fatti fondamentali, tutti `documentato` `[NAVOPS-11 §1102]`:

| teorema / fatto | contenuto | implicazione di gioco |
|---|---|---|
| Thm 11.1–11.2 | Rilevamento costante significa rotta di collisione oppure rotte parallele | Il classico "bearing costante, distanza che cala": allarme collisione o contatto in avvicinamento |
| Thm 11.3 | Con tre rilevamenti, anche se il proprio battello va dritto, si determina la **DRM** (direzione del moto relativo), molto sensibile agli errori | La prima informazione utile è da che parte "tira" il rilevamento (*bearing drift*) |
| Thm 11.4 | **Se il proprio battello mantiene rotta e velocità, distanza, rotta e velocità del bersaglio non sono determinabili, per quanti rilevamenti si raccolgano** | La manovra del proprio battello è obbligatoria: senza lati diversi la soluzione resta indeterminata |
| Relazione cinematica | `R · BR = STA − SOA`: la distanza per il bearing rate è uguale alla differenza tra la velocità del bersaglio e quella propria normali alla linea di vista (eq. 11-8) | Base di Ekelund e di ogni stima in tempo reale |

Conversione pratica, `calcolata` dalla relazione precedente: **BR (°/min) = 1,934 × S_across (kt) / R (kyd) = 0,955 × S_across (kt) / R (nmi)**. Per esempio, un bersaglio a 10 kyd con 10 kt di velocità relativa trasversale dà circa 1,9°/min; a 30 kyd, circa 0,64°/min.

L'osservabilità bearings-only in letteratura scientifica è trattata da Nardone & Aidala (1981) e da Nardone, Lindgren & Gong (1984): con il proprio battello in moto rettilineo il problema non è osservabile e serve un'accelerazione, cioè una manovra `[NLG84]`. Riferimento bibliografico verificato, testo non consultato (paywall IEEE).

---

## 2. Metodi effettivamente insegnati e usati, in ordine cronologico

La fonte principale è la storia di Daniel H. Wagner, analista operativo della Marina USA con 38 anni di esperienza, pubblicata su *The Submarine Review* nel luglio 1991 `[WAG91]`. È integrata dal manuale USNA *Naval Operations Analysis* `[NAVOPS-11]` e dalla tesi NPS di Coll (1994), che descrive le procedure "in uso comune nelle forze subacquee NATO" `[COLL94]`.

| metodo | origine / data | in breve | fonte | confidenza |
|---|---|---|---|---|
| **Lynch Plot** | 2ª guerra mondiale; LT Frank Lynch (R-1, poi XO dello USS *Harder* e CO dello USS *Haddo*) | Relazione tra rilevamenti, bearing rate e moto relativo, per attacchi "solo sonar". Insegnato alla Submarine School fino agli anni '60. Wagner non ne trova documentazione scritta | [WAG91] | documentato (storico) |
| Regolo per bearing rate | anni '50 | Curiosità: il direttore di macchina del K-1, LT Jimmy Carter, scrisse una tesi di comando su questo regolo | [WAG91] | documentato |
| **Spiess Plot** | 15 dicembre 1953; CDR Fred Spiess (Scripps), *Complete Solution of the Bearings Only Approach Problem* | Con tre rilevamenti, il luogo delle posizioni del bersaglio a un quarto istante è una retta (la *Spiess line*); intersecata con il quarto rilevamento dà la posizione, salvo **singolarità**. Primo metodo bearings-only completo. Se il proprio battello va dritto, la singolarità è inevitabile | [WAG91], [NAVOPS-11 §1105] | documentato |
| Parabola di Kettelle | 1953 (pubblicata nel 1961) | Con tre rilevamenti e proprio battello in moto rettilineo, tutte le tracce compatibili sono tangenti a una parabola con asse parallelo alla DRM | [WAG91] | documentato |
| Fagan | 1954 | Soluzione a quattro rilevamenti da tre equazioni trascendenti, risolubile con il regolo assumendo che il proprio battello sia quasi fermo (adatta ai battelli diesel) | [WAG91] | documentato |
| **Ekelund ranging** | estate 1958; LT (poi RADM) John J. Ekelund, istruttore alla Submarine School, *COMSUBLANT Quarterly Information Bulletin* | `R = (SOA₂ − SOA₁) / (BR₁ − BR₂)`: variazione della propria velocità attraverso la linea di vista divisa per la variazione inversa del bearing rate. Tutti gli ingressi si misurano a bordo. Ipotesi: distanza costante durante la manovra. Diffuso "in diverse marine" | [WAG91], [NAVOPS-11 §1103 eq. 11-10], [COLL94 eq. 1] | documentato |
| **Time correction** (Ekelund corretto nel tempo) | precursore Fagan; formalizzazione successiva | Trova il *best range time* t* in cui la stima è insensibile alla velocità del bersaglio lungo la linea di vista: `t* = (t₁·BR₁ − t₂·BR₂ + B₁ − B₂) / (BR₁ − BR₂)`. Nell'esempio del manuale, Ekelund sottostima del 13% e Ekelund corretto sovrastima del 9,4% | [COLL94 eq. 2], [NAVOPS-11 §1104] | documentato |
| Expanded time-bearing plot | in uso NATO (1994) | Rilevamenti su griglia tempo × rilevamento, interpolati con una retta o curva; la pendenza è il bearing rate. Fornisce gli ingressi a tutti gli altri metodi | [COLL94] | documentato |
| **Strip plot / plot geografico** | vintage ignoto (Wagner chiede ai lettori) | Sul DRT si riportano le posizioni del proprio battello e le linee di rilevamento; strisce trasparenti tarate per velocità del bersaglio vengono adattate alle linee. Serve anche per affinare una soluzione Ekelund | [COLL94], [WAG91] | documentato |
| Relative motion plot | — | Rotta relativa e velocità del bersaglio da due soluzioni Ekelund (manovra lag-lead-lag) | [COLL94] | documentato |
| **FLIT** | 1970; ENS Lyle Anderson (CSDG-2), con contributi Electric Boat | Innovazione **classificata**, provata in mare in pochi mesi. Contenuto non pubblico | [WAG91] | documentato (solo esistenza) |
| Teorema di Gullick | 1980; LT Jerry Gullick (CSDS-12) | Con proprio battello e bersaglio in moto rettilineo, le intersezioni degli altri rilevamenti con un rilevamento dato si muovono a velocità costante; ne deriva un metodo a quattro rilevamenti | [WAG91] | documentato |
| **MATE** (Manual Adaptive Target Estimator) e **MLE** (Maximum Likelihood Estimator) | sistemi di controllo del tiro digitali | Nel sistema di superficie AN/SQQ-89 UFCS: MATE richiede stime e manipolazione manuale sistematica da parte dell'operatore; MLE è lo stimatore statistico automatico. Il NUWC ha sviluppato un dimostratore MATE per il tracking grafico dei contatti subacquei | sintesi dal motore di ricerca di documenti NUWC e brevetti (non letti per intero) | stimato |
| Minimi quadrati batch / filtri di Kalman | anni '70–'80 | Il filtro di Kalman esteso in coordinate cartesiane è instabile nel caso bearings-only (Aidala 1979). La soluzione classica sono le **coordinate polari modificate** (Aidala & Hammel 1983). Lo stimatore batch a massima verosimiglianza è lo standard dei sistemi automatici | [AID79], [AH83] (riferimenti bibliografici, testi non consultati) | stimato |

**"Lambda".** Nelle fonti aperte consultate non ho trovato nessun metodo TMA chiamato "Lambda". Il manuale USNA chiama "strip plot" il metodo a strisce e "time-bearing plot" il diagramma tempo–rilevamento. Il termine non va usato nel gioco senza una fonte.

**Il quadro operativo** (manuale USNA): Ekelund serve a una prima stima della distanza dopo aver determinato la DRM e impostato l'avvicinamento `[NAVOPS-11 §1103]`. La TMA bearings-only è in genere più accurata con una manovra **lead-lag** che con una lag-lead. Per il lancio conviene un *best range time* nel futuro: per esempio puntare il bersaglio nel primo lato e passare in *lag* nel secondo `[NAVOPS-11 §1104]`.

**Tempi.** Il centro operativo di una nave di superficie dichiara che la TMA manuale su DRT e moboard richiede **25–40 minuti**. Assume che il contatto mantenga rotta e velocità costanti, cosa realistica se non sa di essere seguito, e ha accuratezza limitata `[SWOS-2.13]` (`documentato`, contesto di superficie).

---

## 3. Perché servono i lati di manovra, in numeri

### 3.1 Tattiche di manovra (Coll 1994)

La tesi NPS simula con Monte Carlo (10 000 repliche) un battello diesel che fa TMA bearings-only contro una nave. Ipotesi: errore di rilevamento gaussiano σ = 0,5°, campionamento ogni 30 s, lati di 10,5 minuti `[COLL94]`.

| risultato | valore | confidenza |
|---|---|---|
| Tattica migliore | Alla scoperta accostare al rilevamento iniziale meno un angolo di *lead* di 70°, poi manovra lead-lag-lead o lag-lead-lag. Angolo di *lag* 15° con batteria scarica, 0° con batteria carica | documentato (risultato di simulazione) |
| Successo dell'attacco con la tattica migliore | 58,18% (attacchi in cui il siluro acquisisce e colpisce) | documentato (simulazione) |
| Con un lag di 30° | Soluzione più precisa ma il battello resta fuori dalla regione di avvicinamento nel 14,3% dei casi; successo 55,72% | documentato (simulazione) |
| Tensione di fondo | Manovrare migliora la TMA ma ostacola la chiusura della distanza: "trade off between objectives one and three" | documentato |
| Modello di acquisizione del siluro usato nella tesi | `AcqRange (nmi) = 0,0008 · V_bersaglio(kt)²`, quindi 0,26 nmi per 18 kt; siluro da 45 kt e 7,5 nmi | documentato, ma è un **modello accademico nozionale** e non un dato d'arma |

### 3.2 Limite inferiore di Cramér–Rao (CRLB), calcolato

Script `raw/06/calc/tma_crlb.py`. Bersaglio inizialmente a 10 kyd per 000°, rotta 270°, 10 kt. Proprio battello a 5 kt. Rilevamenti ogni 30 s con σ = 0,5° (parametri di [COLL94]). Il CRLB è il **miglior errore ottenibile** da uno stimatore non distorto: lo stimatore reale fa uguale o peggio.

| caso | distanza finale | σ_R minima | σ_R/R | σ_V minima | confidenza |
|---|---|---|---|---|---|
| A. Un lato di 12 min, nessuna manovra | 8,9 kyd | **non osservabile** (matrice di Fisher singolare) | — | — | calcolato |
| B. 6' rotta 090 + 6' rotta 030 (accostata di 60°) | 10,6 kyd | 14,2 kyd | 133% | 18 kt | calcolato |
| C. 6' rotta 090 + 6' rotta 330 (accostata di 120°) | 10,2 kyd | 5,2 kyd | 51% | 5,9 kt | calcolato |
| D. Tre lati da 6' (090, 330, 090) | 11,7 kyd | 1,2 kyd | **10%** | 1,2 kt | calcolato |
| E. Come C, con σ = 2° (sonar scadente o segnale debole) | 10,2 kyd | 20,9 kyd | 205% | 23 kt | calcolato |
| F. Come C, bersaglio a 30 kyd | 29,5 kyd | 34,7 kyd | 117% | 14 kt | calcolato |
| G. Come F, lati da 10' | 29,6 kyd | 18,2 kyd | 62% | 7 kt | calcolato |
| H. Come C, proprio battello a 10 kt | 9,8 kyd | 3,2 kyd | 32% | 4,2 kt | calcolato |
| I. Come C, rilevamento ogni 5 s | 10,2 kyd | 2,2 kyd | 22% | 2,5 kt | calcolato |
| J. Come C, bersaglio a 4 kyd | 5,5 kyd | 2,0 kyd | 37% | 4,2 kt | calcolato |

Controllo Monte Carlo (`raw/06/calc/tma_mc2.py`: minimi quadrati di Levenberg–Marquardt con più punti di partenza, 150 prove). Nel caso D l'errore mediano di distanza è 0,77 kyd (7%) e il 90° percentile 1,7 kyd. È coerente con il CRLB del 10%.

**Lezioni per il design** (`calcolato`, coerenti con [WAG91], [NAVOPS-11] e [COLL94]):
1. Senza manovra la distanza resta indeterminata: lo dice il teorema e il gioco deve rispettarlo.
2. **Due lati** danno una soluzione grossolana (errore del 30–130%); **tre lati** la portano a circa il 10%. È l'ordine dei "20–40 minuti" di [SWOS-2.13].
3. Accostate ampie (≥ 90°), più velocità propria, più rilevamenti e bersagli vicini migliorano la soluzione. Ma velocità più alta significa più rumore proprio (vedi `05_acustica.md` §7.1), e qui sta il dilemma che rende il gioco interessante.
4. A grandi distanze (30 kyd e oltre) servono lati lunghi oppure informazioni non angolari: Doppler delle tonali, rimbalzo sul fondo e CZ (la distanza è "nota" entro l'anello), un ping singolo, il periscopio.

---

## 4. Cosa significa "qualità della soluzione"

Nella pratica e nei giochi la qualità della soluzione è un riassunto dell'incertezza dello stato stimato.
- In *Cold Waters* un valore SOL in percentuale cresce con: contatto selezionato, segnale forte, classificazione nota, **alto bearing rate**, distanza misurata con ping, laser o radar.
- Lo stesso valore cala con: segnale debole, classificazione errata, manovra del bersaglio, perdita del contatto, basso bearing rate, siluro esca lanciato dal bersaglio. Senza contatto decade nel tempo `[CW-MAN pp. 22–23]`.
- In *Sub Command* l'"Auto Crewman" TMA impedisce al giocatore di toccare la soluzione mentre è attivo. Se il giocatore classifica male il contatto (nave invece di sottomarino), il controllo di tiro imposta preset sbagliati `[SONALYSTS-SC]`.

Definizione proposta (`nozionale`) per il nuovo gioco, legata alla matrice di covarianza P dello stimatore:

```
σR  = sqrt(g_R' P g_R)            # incertezza di distanza al tempo attuale
σC  = incertezza di rotta (gradi); σV = incertezza di velocità (kt)
Q   = 100 · exp( −[ (σR / (0.10·R))² + (σC / 20°)² + (σV / 3 kt)² ] / 3 )
```

Q ≈ 37% corrisponde a "errore pari alle soglie" (10% di distanza, 20° di rotta, 3 kt). Q ≥ 70% è da considerare **soluzione di tiro**.
Per il lancio la grandezza che conta davvero è la probabilità che il siluro, giunto al punto di abilitazione, abbia il bersaglio dentro il cono di acquisizione. Si stima propagando P fino all'istante di abilitazione e confrontando l'ellisse con la portata d'acquisizione del seeker (vedi `07_dottrina_siluri.md`).

---

## 5. Modello di TMA "assistibile" per il gioco

### 5.1 Pipeline di misura (`nozionale`, basata sui sensori di `04_sensori.md`)

| sensore | cadenza | σ rilevamento | particolarità |
|---|---|---|---|
| Sfera BQS-13 / BQQ-5, broadband | 4–10 s | 0,5–1,5° (peggiora con SE basso: σ ∝ 1/√SNR) | settori ciechi a poppa (baffles) |
| Array conforme, narrowband | 10–20 s | 1–2° | bassa frequenza, buona portata |
| Array trainato TB-16 / TB-23 | 10–30 s | 0,5–2° | **ambiguità destra/sinistra** risolta solo con un'accostata; dati inutili durante e subito dopo l'accostata (2–4 minuti di assestamento del cavo) |
| Periscopio | su comando | 0,2° più distanza da stadimetro (±10%) | richiede quota periscopica: rischio di scoperta |
| Ping attivo singolo | su comando | 1° più distanza (±2%) | avverte il bersaglio (intercettazione WLR-9 o equivalente sovietico) |

### 5.2 Stimatore

- **Batch a massima verosimiglianza** (Levenberg–Marquardt) su una finestra mobile di 20–40 minuti, con stato (x, y, vx, vy) relativo all'istante di riferimento. Inizializzazione multipla su distanze di 2, 5, 10, 20 e 40 kyd, come in `tma_mc2.py`. Costo trascurabile anche per 10 contatti.
- In alternativa, **filtro a particelle** (2000 particelle) o EKF in coordinate polari modificate `[AH83]`.
- **Rilevazione di manovra del bersaglio**: test chi-quadro sui residui degli ultimi N rilevamenti. Se fallisce, la finestra si accorcia e Q crolla. È quello che fa *Cold Waters* quando il bersaglio cambia rotta `[CW-MAN]`.
- **Doppler / f-TMA**: se si tracciano tonali stabili, lo spostamento di frequenza aggiunge informazione sulla velocità radiale e riduce la necessità di manovra. Il testo USNA cita il Doppler come strumento per stimare aspetto e moto `[FUN-9]`. Implementarlo come bonus a Q quando la tonale è stabile da almeno 5 minuti (`nozionale`).

### 5.3 Livelli di automazione dell'equipaggio

| livello | cosa fa il giocatore | cosa fa il "computer"/equipaggio | modello storico |
|---|---|---|---|
| 0 — Manuale ("Lynch/Ekelund") | Legge il time-bearing plot, sceglie i lati, usa un calcolatore Ekelund (inserisce i due bearing rate e le due SOA) e un plot geografico con strisce di velocità | Solo misure grezze e grafici; nessuna soluzione automatica | Anni '50–'60; pratica NATO su battelli diesel [COLL94] |
| 1 — "MATE" assistito | Imposta una soluzione di prova (distanza, rotta, velocità) e la regola finché i residui ("pila di punti") non si allineano; decide le manovre | Mostra i residui in tempo reale; calcola Ekelund al cambio di lato; segnala la singolarità di Spiess quando i lati non bastano | Sistemi digitali Mk 117 / CCS degli anni '80 (MATE, stimato) |
| 2 — Auto-TMA ("MLE") | Fa solo le manovre (il gioco suggerisce "accosta di 90° a sinistra per 6 minuti") | Lo stimatore ML produce soluzione, ellisse di incertezza e Q; propone i preset d'arma | MLE automatico; *Sub Command* Auto Crewman [SONALYSTS-SC] |
| 3 — Arcade ("SOL%") | Niente | Q cresce in funzione di tempo, bearing rate e classificazione (moltiplicatore di difficoltà come `PlayerTMARate` in *Cold Waters*: 1,4 / 1,2 / 1 / 0,85 [CW-MOD]) | *Cold Waters* |

Raccomandazione: per il duello a due giocatori usare livelli simmetrici e impostare il livello 2 come predefinito. È fedele: la soluzione dipende dalle manovre giuste, che sono rumorose, dal tempo e dal silenzio. È anche giocabile, perché nessuno deve fare trigonometria sotto pressione.

### 5.4 TMA sovietica (nota)

Il termine sovietico corrispondente è "ЭДЦ" (элементы движения цели, elementi del moto del bersaglio). Sui battelli di terza generazione era calcolato dai sistemi di gestione del combattimento (БИУС). Classi, sistemi e date sono in `04_sensori.md` e `01_piattaforme.md`. Senza fonti aperte che quantifichino la differenza, la proposta di gioco (`nozionale`) è dare al giocatore sovietico **lo stesso stimatore** con σ di rilevamento più alto del 30–50% sui sensori delle classi più vecchie (Victor I/II, Alfa). Così si riflette il divario di sensori documentato qualitativamente da Coté: Akula vicino alla parità, il resto della flotta no `[COTE03]`.

---

## 6. Riepilogo dei parametri

| parametro | valore | confidenza |
|---|---|---|
| Lati di manovra | 2 lati per una prima soluzione (±30–50%), 3 per una soluzione di tiro (~10%); 5–10 minuti per lato; accostate di 60–120° | calcolato / documentato (forma) |
| σ rilevamento sfera, in condizioni buone | 0,5° | stimato (ipotesi di [COLL94]) |
| Tempo tipico di TMA manuale | 25–40 min | documentato [SWOS-2.13] (superficie) |
| Formula Ekelund | `R = ΔSOA / −ΔBR` (unità coerenti) | documentato |
| Best range time | `t* = (t₁BR₁ − t₂BR₂ + B₁ − B₂)/(BR₁ − BR₂)` | documentato |
| Bearing rate | 1,934 × S_across(kt)/R(kyd) °/min | calcolato |
| Soglia per "soluzione di tiro" | Q ≥ 70% (σR ≤ ~7% R, σC ≤ ~15°, σV ≤ ~2 kt) | nozionale |
| Decadimento della soluzione senza contatto | σR cresce con √(σV² t²) propagato | nozionale |
