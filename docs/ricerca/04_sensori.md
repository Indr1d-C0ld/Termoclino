# 04 — Sensori (1985–1991): sonar, antenne rimorchiate, intercettatori, ESM, periscopi, radar, direzione del tiro, rilevamento non acustico

Sezione del catalogo di riferimento. Le chiavi tra parentesi quadre rimandano a `_fonti_04_08.md`.
Colonna **confidenza**: `documentato` = fonte ufficiale o autorevole aperta (GAO, U.S. Naval Academy, costruttore, Naval War College);
`stimato` = stima aperta credibile (FAS, GlobalSecurity, Polmar, enciclopedie, DeepStorm, Gusev, Apal'kov, Wikipedia);
`nozionale` = dato classificato o assente: valore di gioco proposto da me, con il ragionamento.
I numeri che vengono solo da **conoscenza pregressa non riverificata** sono marcati [CONO] e vanno controllati prima dell'uso.

> **Avvertenza generale.** Su prestazioni di scoperta, accuratezza di rilevamento e bande esatte dei sonar della guerra fredda
> le fonti aperte sono povere e spesso derivate le une dalle altre. Le «portate di scoperta» che circolano (soprattutto quelle
> sovietiche in km) sono valori pubblicitari o massimi in condizioni ideali, quasi sempre senza indicare il bersaglio:
> in gioco vanno usate solo come tetti, non come portate tipiche. La portata vera esce dall'equazione del sonar (§4.1).

---

## 4.1 Concetti minimi per il motore di gioco

**Equazione del sonar passivo e figure of merit (FOM).** La scoperta passiva avviene quando SL − TL − (NL − DI) ≥ DT;
la FOM passiva è SL − NL + DI − DT e rappresenta la massima perdita di propagazione accettabile [FUN-ch8 §8.9–8.10].
Esempio del manuale della Naval Academy (acque d'Islanda, estate, 2 kHz, probabilità di scoperta 50 %):

| FOM sonar (dB) | Percorso diretto | Bottom bounce | Zona di convergenza | fonte | confidenza |
|---|---|---|---|---|---|
| 80 | 7,5 kyd | nessuna | nessuna | [FUN-ch8 §8.10.1] | documentato (esempio didattico) |
| 95 | 21 kyd | 50 kyd | 81 kyd | [FUN-ch8 §8.10.1] | documentato (esempio didattico) |
| 105 | 36 kyd | 90 kyd | 160 kyd | [FUN-ch8 §8.10.1] | documentato (esempio didattico) |

Lezione per il gioco: 10 dB di FOM in più non allungano la portata del 10 %, ma aprono **percorsi di propagazione nuovi**.

**Indice di direttività (DI).** Il DI misura quanto un'antenna attenua il rumore isotropo grazie alla direzionalità [FUN-ch8 §8.9].
Le antenne lunghe rimorchiate possono superare i 30 dB [FUN-tass] (attenzione: la stessa pagina riporta coefficienti di assorbimento
sbagliati di tre ordini di grandezza, vedi nota in `_fonti_04_08.md`). Per stimare i DI nozionali (§4.6) uso le formule standard
[CONO]: pistone circolare di diametro D → DI ≈ 20·log10(π·D/λ), larghezza del fascio a −3 dB ≈ 59°·λ/D;
antenna lineare di lunghezza L → DI ≈ 10·log10(2L/λ), fascio al traverso ≈ 51°·λ/L (con c = 1500 m/s).

**Rumore di flusso.** È quasi assente sotto 1–2 nodi, compare **di colpo** oltre una soglia di velocità e poi cresce;
è soprattutto a bassa frequenza ed è un problema quasi solo di rumore proprio [FUN-ch8 §8.8.1.2].

**Cavitazione.** Inizia sulle punte delle pale; a profondità maggiore la cavitazione si riduce e si sposta verso le alte frequenze;
la velocità critica dell'elica segue N₀²/d = costante: se un'elica cavita a 50 giri/min a 15 ft, a 60 ft cavita a 100 giri/min
[FUN-ch8 §8.8.1.3]. (Precisazione [CONO]: la grandezza fisicamente corretta è la pressione assoluta, cioè la profondità più circa 10 m d'atmosfera;
la forma del manuale è un'approssimazione.)

**Profilo termico.** Quattro strati: superficiale (rimescolato), termoclino stagionale (gradiente negativo, forte d'estate),
termoclino permanente, strato isotermo profondo a ~4 °C con gradiente positivo dovuto alla pressione; fra gli ultimi due il
canale sonoro profondo [FUN-ch8 §8.4.7]. La velocità del suono cresce di circa 3 m/s per °C [FUN-ch8 §8.4].

---

## 4.2 Stati Uniti

### 4.2.1 Quadro d'insieme: che cosa aveva un 688 fra il 1985 e il 1991

| Sistema | Funzione | Su quali 688 | Periodo | fonte | confidenza |
|---|---|---|---|---|---|
| AN/BQQ-5 (A→D) | suite integrata sfera + array conforme + rimorchiato | SSN-688…750 | IOC 1976; varianti successive | [WWH-SON], [GUS-GAK], [WP-LA] | stimato |
| AN/BSY-1 (con BQQ-5 evoluto) | sistema di combattimento integrato sonar + direzione del tiro | SSN-751 e seguenti (688I) | prime unità 1988–89; piena capacità da SSN-755 (installato set. 1989) | [GAO-90-72] | documentato |
| TB-16 | antenna rimorchiata «fat line» | tutti | anni '70–'80 | [FAS-TB16], [COTE-2003 p. 49] | stimato |
| TB-23 | antenna rimorchiata «thin line» | progressivamente (BQQ-5D) | anni '80 | [FAS-TB23], [GUS-GAK] | stimato |
| TB-29 | thin line più lunga | non sui 688 nel periodo | OPEVAL su BQQ-5E nel FY1998 | [FAS-BQQ5], [FAS-TB29] | stimato → **anacronismo** |
| AN/BQS-15 | sonar attivo ad alta frequenza: mine, ghiaccio, ostacoli | 688 (integrato come aggiornamento del BQQ-5) | anni '80 | [FAS-BQS15], [WWH-SON], [POL-1979] | stimato |
| AN/WLR-9 | ricevitore d'intercettazione acustica (sonar attivi e siluri a ricerca acustica) | 688 | in servizio già nel 1979 | [POL-1979], [FAS-WLY1] | stimato |
| AN/WLR-8, AN/WLR-10, AN/BRD-7 | ESM radar/radio, contromisure, radiogoniometro | 688 | 1979 | [POL-1979] | stimato |
| Periscopi Type 2 e Type 18 | attacco (sinistra) e ricerca (dritta) | 688 | — | [FAS-SSN688] | stimato |
| AN/BPS-15 (A) / BPS-16 | radar di navigazione | 688 | — | [FAS-SSN688], [FAS-BPS15] | stimato |
| Mk 113 mod 10 → Mk 117 → CCS Mk 1 | direzione del tiro | Mk 113 sui primi; Mk 117 dal Dallas (SSN-700); CCS Mk 1 sui Flight II; BSY-1 sui 688I | — | [WP-LA], [GAO-90-72] | stimato |

### 4.2.2 AN/BQQ-5 e la sfera AN/BQS-13

Descrizione. Suite digitale attiva/passiva che integra la sfera prodiera (AN/BQS-11, -12 o -13), l'array conforme di scafo e
l'antenna rimorchiata; il formatore di fasci digitale (DIMUS) seleziona gli idrofoni e orienta i fasci, il cui numero è limitato
solo dalla capacità del calcolatore [WWH-SON], [POL-1981]. Rispetto al precedente BQQ-2 (commutazione manuale) ha molto meno rumore
interno e riduce la guardia sonar a circa quattro operatori [POL-1981]. Nel BQQ-1 (1958) la scoperta iniziale in zona di convergenza
avveniva con il BQR-7 in banda larga a bassa frequenza «a partire da 150 Hz» o con la sfera attiva BQS-6; la sfera poi seguiva il
bersaglio fino al percorso diretto per la soluzione di tiro [COTE-2003 p. 30]. La sfera dei 637 dava una visuale molto più ampia in
azimut ed elevazione rispetto ai battelli precedenti [COTE-2003 p. 50].

| Parametro | Valore | fonte | confidenza |
|---|---|---|---|
| Diametro della sfera BQS-13 | 4,5 m (≈ 15 ft; l'OCR di Polmar 1981 riporta un diametro di «…5 foot» corrotto, compatibile con 15 ft) | [GUS-GAK], [POL-1981] | stimato |
| Elementi della sfera | 1241 idrofoni/trasduttori (TR-155E/BQ) | [GUS-GAK], [WP-LA] | stimato |
| Banda attiva | circa 3,5 kHz | [GUS-GAK], [WWH-SON] | stimato |
| Banda passiva della sfera | 0,5–5 kHz | [GUS-GAK] | stimato |
| Fasci formati | 600 per modo (60 azimut × 10 elevazioni, da +19° a −53°), fascio di circa 6° × 7,2° | [GUS-GAK] | stimato |
| Verifica di coerenza | un pistone di 4,5 m a 3,5 kHz dà un fascio di circa 5,6°: coerente con 6° | calcolo mio [CONO] | stimato |
| Array conforme di scafo | 104 idrofoni DT-276 (104–156 secondo Wikipedia); 24 fasci per lato + 2 per il rumore proprio | [GUS-GAK], [WP-LA] | stimato |
| BQR-7 (antenato dell'array conforme) | tre file di idrofoni lunghe 50 ft ciascuna | [GS-BQR7] | stimato |
| Potenza del sonar attivo | circa 0,5 MW per scoperte a 10 000 yd, contro meno di 0,5 W per un passivo con scoperta simile | [POL-1981] | stimato |
| Perché serve l'attivo | distanza precisa per armi non autoguidate (SUBROC, circa 30 nm), acque basse, bersagli molto silenziosi | [POL-1981] | stimato |
| Entrata in servizio | IOC 1976; su tutti i 688 fino all'SSN-750; retrofit su Permit e Sturgeon | [WWH-SON] | stimato |

Varianti A–E (sintesi da [GUS-GAK] e [WWH-SON], confidenza **stimato**):

| Variante | Novità | Prima unità / periodo |
|---|---|---|
| BQQ-5A | secondo calcolatore AN/UYK-7, memoria a disco; programma da 240 000 a 334 000 istruzioni | fine anni '70 |
| BQQ-5B | nuove console; integrazione dell'antenna rimorchiata [POL-1981]; formatore di fasci orientabile per l'array conforme (SHAB) | SHAB per primo sul Dallas (SSN-700) |
| BQQ-5C | analisi DIFAR potenziata, tre calcolatori AN/UYK-44, tracciamento passivo per la direzione del tiro | per primo sul Salt Lake City (SSN-716); A e B portati a C |
| BQQ-5D | integrazione dell'antenna sottile TB-23, elaborazione comune a più antenne | fine anni '80 sui 688 senza BSY-1 |
| BQQ-5E | TB-29, attivo a bassa frequenza, display a colori | anni '90 (OPEVAL FY1998) → **anacronistico** per 1985–91 |

Nota: Gusev sostiene che l'aggiunta del passivo AN/BQR-21 DIMUS con analizzatori di spettro portò la scoperta con le antenne di scafo
«fino a 160 km» [GUS-GAK]; è un valore massimo senza bersaglio dichiarato: confidenza **stimato**, da usare solo come tetto.
Una pagina GlobalSecurity ricorda che il BQQ-5 fu progettato per **una sola console** e poi rifatto a tre, con problemi di spazio e di
personale [GS-BQQ5].

### 4.2.3 AN/BSY-1 (688 «Improved», dal 1988) e i suoi guai

| Fatto | Valore | fonte | confidenza |
|---|---|---|---|
| Origine | nasce dal programma SUBACS (1980), ristrutturato nel 1985 in BSY-1 (688I) e BSY-2 (Seawolf); abbandonato il bus dati in fibra ottica per cavi in rame | [GAO-90-72 pp. 8–9] | documentato |
| Che cosa sostituisce | il sonar AN/BQQ-5 e la direzione del tiro CCS Mk 1 | [GAO-90-72 p. 9] | documentato |
| Prime installazioni | SSN-751…754 con un sistema «preliminare» con sola autodifesa (acustica, sicurezza, lancio armi); piena capacità rinviata in media di **19 mesi** | [GAO-90-72 pp. 9, 14] | documentato |
| Primo sistema completo | quinto sistema consegnato a maggio 1989, installato a settembre 1989 (SSN-755) | [GAO-90-72 p. 14] | documentato |
| Prova in mare dell'SSN-751 (giugno 1988) | **20 carenze** tali da degradare la capacità di missione, quasi tutte del BSY-1 | [GAO-90-72 p. 15] | documentato |
| Prestazioni dichiarate | SSN-751: 12 siluri lanciati, 9 colpi, 3 guasti; il sonar passivo ha seguito bersagli Mk-30 a distanze «maggiori di qualsiasi sottomarino precedente» | [GAO-90-72 p. 14, nota] | documentato (dichiarazione del Navy) |
| Costo del ciclo di vita | da 5,4 (feb. 1986, 19 sistemi) a 12,1 miliardi $ (nov. 1988, 24 sistemi): +125 % | [GAO-90-72 p. 12] | documentato |
| Valutazione operativa | non ancora svolta a fine 1989; prevista nel 1990 | [GAO-90-72 pp. 15–16] | documentato |
| Componenti sonar | sfera attiva a media frequenza (MFAC), attivo ad alta frequenza nella vela (HFAC), TB-16 in guaina lungo lo scafo, TB-23 avvolta nelle casse zavorra | [WWH-SON] | stimato |
| Wide Aperture Array (BQG-5) | il costo di produzione include «sei nuove WAA»; secondo l'enciclopedia la BQG-5 compare dal Columbia (SSN-771) | [GAO-90-72 p. 13], [WWH-SON] | documentato / stimato → in gioco **anacronistico** prima del 1991 |

Implicazione narrativa: un 688I del 1989–90 può avere un sistema di combattimento «immaturo», cosa giocabile come handicap di scenario.

### 4.2.4 Antenne rimorchiate

Storia. La prima antenna rimorchiata da sottomarino fu lo STASS, sperimentato a metà anni '60 e in servizio a fine anni '60; non si poteva
ritirare a bordo, quindi era **agganciata** («clip-on») all'inizio della missione e trainata per tutto il periodo. Seguirono antenne
recuperabili, TB-16, TB-23 e TB-29, con apertura acustica crescente; il loro primo impiego importante fu costruire la **biblioteca delle
firme** dei sottomarini sovietici [COTE-2003 p. 49]. Nel 1984 l'ammiraglio Watkins dichiarò che contro i Victor III l'antenna rimorchiata
a bassa frequenza «ha funzionato ogni volta», puntando sulle righe della frequenza di pala [COTE-2003 pp. 66, 69].

| Parametro | TB-16 («fat line») | TB-23 («thin line») | TB-29 | fonte | confidenza |
|---|---|---|---|---|---|
| Lunghezza dell'array acustico | 240 ft (≈ 73 m); Gusev: 56 m per la TB-16F | non trovata in fonti lette; [CONO] circa 900–1000 ft | «più lunga della TB-23»; Gusev: fino a 750 m | [FAS-TB16], [GUS-GAK], [FAS-TB29] | stimato (TB-23: nozionale) |
| Diametro | 3,5 in (≈ 89 mm); Gusev ≈ 90 mm | «thin line» (le antenne sottili hanno diametri minimi di circa 1 in) | — | [FAS-TB16], [GUS-GAK], [GS-TOWED] | stimato |
| Massa | 1400 lb l'array; 450 lb il cavo | — | — | [FAS-TB16] | stimato |
| Cavo di traino | 2400 ft (≈ 730 m), Ø 0,37 in; Gusev: 780 m per la TB-16F | cavo coassiale da 1–2 km (tipico di SQR-19, TB-23, TB-29) | idem | [FAS-TB16], [GUS-GAK], [FAS-TB23] | stimato |
| Stivaggio e messa a mare (688) | guaina lungo lo scafo; si mette a mare **pompando acqua** nel tubo («flushing») | avvolta su verricello nelle casse zavorra; messa a mare con sistema meccanico | — | [WWH-SON], [GS-TOWED], [WP-TAS] | stimato |
| Banda | bassa frequenza (valori in Hz non trovati in fonti aperte lette) | più bassa (più apertura) | — | [COTE-2003 p. 49] | nozionale per i numeri |
| Ambiguità destra/sinistra | sì, per idrofoni omnidirezionali | sì | sì | [GS-TOWED] | stimato |
| Manovra | i formatori di fasci assumono un'antenna dritta: durante le manovre non si forma il fascio, con tempi morti **fino al 50 %** | idem | la TB-29 misura la forma e la compensa | [FAS-TB23], [FAS-TB29] | stimato |
| Velocità | vanno limitate; la resistenza cresce col quadrato della velocità | idem | — | [WP-TAS] | stimato |
| Periodo | in servizio negli anni '80 | in servizio negli anni '80 (BQQ-5D) | anni '90 → **anacronismo** per i 688 | [COTE-2003], [GUS-GAK], [FAS-BQQ5] | stimato |

Contesto Trident: l'AN/BQQ-6 dell'Ohio è il BQQ-5 senza trasmettitori attivi (sfera solo ricevente, 944 idrofoni secondo
[WWH-SON]), in servizio dal 1981; antenne rimorchiate BQR-15 (cavo 2640 ft) e processore BQQ-9, «probabilità media a circa 30 nm»
e una zona di convergenza [FAS-BQQ6], [WWH-SON], [FAS-BQQ9] (confidenza **stimato**).

### 4.2.5 AN/BQS-15 (alta frequenza, corto raggio)

Sonar attivo ad alta frequenza e corto raggio, costruito da Ametek, per scoprire ed evitare mine e per il ghiaccio [FAS-BQS15];
integrato con il BQQ-5 come aggiornamento, anche per scoprire e seguire bersagli [WWH-SON]; nel 1979 è già elencato tra i sonar
tattici del 688 [POL-1979]. Frequenze e portate: **non trovate** in fonti aperte lette (nozionale). È l'equivalente reale del «contour
imaging» del gioco del 1989 (vedi 08), ma con un costo: emette, quindi è intercettabile.

### 4.2.6 Intercettazione acustica, ESM, radar

| Sistema | Che cosa fa | Dati | fonte | confidenza |
|---|---|---|---|---|
| AN/WLR-9 | ricevitore d'intercettazione acustica: scopre sonar attivi di ricerca e siluri a ricerca acustica | banda non trovata in fonti lette (i valori «1,1–70 kHz» circolano solo in database di giochi: **non usati**) | [POL-1979], [FAS-WLY1] | stimato |
| AN/WLR-12/17 | successori della stessa famiglia sui 688 | — | [FAS-WLY1] | stimato |
| AN/WLR-8 | ESM: radar di tiro e frequenze radio | «riportata» 50 MHz–18 GHz | [POL-1979] | stimato |
| AN/WLR-10 | apparato di contromisure | — | [POL-1979] | stimato |
| AN/BRD-7 | radiogoniometro | — | [POL-1979] | stimato |
| AN/BPS-15 (A) / BPS-16; AN/BPS-5 | radar di navigazione e scoperta di superficie | banda X [CONO] | [FAS-SSN688], [FAS-BPS15] | stimato (banda: CONO) |

Termine di paragone sovietico, unico dato aperto sull'accuratezza di un intercettatore: il modulo di intercettazione del moderno
MGK-400EM copre **1–60 kHz** con accuratezza di rilevamento **5° (1–10 kHz)**, **10° (10–30 kHz)** e solo **quadrante (30–60 kHz)**
[OP-400EM] (confidenza **documentato** per la versione d'esportazione moderna; per il 1985–91 è solo un ordine di grandezza).

### 4.2.7 Periscopi, sonde ambientali, direzione del tiro

- **Periscopi:** Type 2 d'attacco a sinistra e Type 18 di ricerca a dritta [FAS-SSN688] (stimato). Che il Type 18 avesse TV, bassa
  luminosità e fotografia è [CONO] non verificato.
- **Velocimetro (BQH) ed ecoscandaglio (BQN-17):** non trovati in fonti lette; il manuale della Naval Academy descrive batitermografi
  e velocimetri come strumenti di bordo [FUN-ch8 §8.4.6]. In gioco: profilo misurato in continuo alla quota del battello, il resto
  stimato (nozionale).
- **Direzione del tiro:** la classe nasce con la Mk 113 mod 10 («Pargo») su calcolatore UYK-7; la Mk 117, prima «tutta digitale»,
  compare per prima sul Dallas (SSN-700); la CCS Mk 1 (Lockheed) aggiunge il Tomahawk; la CCS Mk 2 (Raytheon) è degli anni '90
  [WP-LA] (stimato; CCS Mk 2 → anacronismo). Il BSY-1 sostituisce BQQ-5 e CCS Mk 1 sui 688I; negli aggiornamenti l'UYK-7 viene
  sostituito dall'UYK-43 [GAO-90-72 p. 9] (documentato).

---

## 4.3 Unione Sovietica

### 4.3.1 Quadro d'insieme (complessi idroacustici e altri sensori)

| Sistema | Classe/progetto (nome NATO) | Periodo | Dati principali | fonte | confidenza |
|---|---|---|---|---|---|
| MGK-300 «Rubin» | 671, 671RT (Victor I/II) | anni '60–'70 | 4 antenne; passivo, attivo, intercettazione, comunicazione | [GUS-GAK], [APL-671RTM] | stimato |
| MGK-400 «Rubikon» («Shark Teeth») | 667BDR (Delta III), sottomarini diesel e nucleari | adottato 1976 | scoperta «fino a 200 km»; passivo, attivo con misura di distanza, intercettazione, comunicazione, mine/ostacoli; filtri a banda stretta per la variazione di distanza | [RUWP-667BDR], [GUS-GAK] | stimato |
| MGK-500 «Skat» (Skat-M «piccolo», Skat-B «grande») | progetto avviato nel 1968 (TsNII «Morfizpribor») | adottato 1978 | prima rete di elaborazione su circuiti integrati (4 calcolatori «Karat») | [RUWP-SKAT], [GUS-GAK] | stimato |
| MGK-503 «Skat-KS» | 671RTM (Victor III), 2 unità 945 (Sierra I), 941 (Typhoon) | dal 1977–79 | con antenna rimorchiata; portata 2–3 volte il Rubikon; DeepStorm: «circa tre volte la generazione precedente», scoperta max **230 km** in condizioni idrologiche normali | [RUWP-SKAT], [DS-671RTM], [DS-945] | stimato |
| «Skat-2M» | gran parte dei 671RTMK | anni '80 | sostituisce lo Skat-KS | [DS-671RTM] | stimato |
| MGK-520 «Skat-BDRM» | 667BDRM (Delta IV) | metà anni '80 | antenna rimorchiata retrattile nello scafo | [RUWP-SKAT], [DS-667BDRM] | stimato |
| MGK-540 «Skat-3» («Shark Gill») | 971 (Akula), 945A (Sierra II), 949/949A | prove sul K-284 nel 1986–87, modifiche nel 1988 | digitale; antenna prodiera, **due antenne di fianco** e antenna rimorchiata; portata «tre volte» quella dei sottomarini di seconda generazione | [RUWP-SKAT], [DS-971], [WP-AKULA] | stimato (in periodo per l'Akula dal 1987–88: **non** anacronistico) |
| «Okean» / «Енисей» (MGK-1001?) | 705 (Alfa) | anni '70 | GAK automatizzato; le fonti si contraddicono sul nome | [DS-705], [WP-ALFA] | stimato |
| MG-519 «Arfa» | sottomarini diesel (877 Kilo) | — | stazione per mine e ostacoli (citata solo come sostituita dall'MGK-400EM) | [OP-400EM] | stimato |
| MNK-200 «Tukan» (SOKS) | alcuni 671RTMK; 971 dal K-263 o K-322 | prototipo 1971–72, crociera in Atlantico nel 1977, esercitazioni 1977 e 1979 | rilevamento della scia (vedi §4.4) | [TSALKIN], [DS-971], [RUWP-971] | stimato |

**Shark Teeth / Shark Gill:** sono nomi NATO. Wikipedia russa li associa rispettivamente a Rubikon e Skat-3 [RUWP-667BDR], [WP-AKULA];
non ho verificato l'assegnazione in fonti NATO o d'intelligence aperte.

### 4.3.2 Prestazioni dichiarate (da usare come tetti, non come valori tipici)

| Dato | Valore | Note | fonte | confidenza |
|---|---|---|---|---|
| Rubikon, portata massima | ~200 km | bersaglio non specificato | [RUWP-667BDR] | stimato |
| Skat-KS, portata massima | 230 km | «condizioni idrologiche normali», bersaglio non specificato | [DS-671RTM], [APL-671RTM] | stimato |
| MGK-400EM (moderno), passivo | sottomarino con rumore ridotto a 0,05 Pa/√Hz: **16 km**; nave di superficie da 10 Pa/√Hz: **100 km**; 12 bersagli seguiti in automatico; accuratezza di rilevamento **10'** (0,17°) | versione d'esportazione degli anni 2000 | [OP-400EM] | documentato (per quel prodotto) |
| MGK-400EM, attivo | settore ±30°; 16 km su bersaglio di raggio equivalente 10 m; mine a 1,8 km | idem | [OP-400EM] | documentato (per quel prodotto) |
| Akula visto dal 688 | un 971 sarebbe scopribile dal BQQ-5 a **non più di 10 km** anche nelle condizioni migliori (Barents d'inverno) | tesi MFTI 1995 citata da DeepStorm, non verificabile | [DS-971] | stimato (di parte) |
| Silenziosità dell'Akula | K-284 più silenzioso di **12–15 dB** del 671RTM | fonte russa | [DS-971] | stimato |
| Akula secondo fonte USA | righe a banda stretta sotto il livello della banda larga; banda larga «vicina o uguale» a quella di Sturgeon e primi 688 | Cote, da testimonianze pubbliche | [COTE-2003 p. 69] | documentato (fonte autorevole aperta) |

### 4.3.3 Antenne rimorchiate sovietiche

- **671RTM (Victor III):** l'antenna rimorchiata flessibile («ГПБА», infrasonica) dello Skat-KS sta **arrotolata nella gondola**
  sopra il timone verticale, con dispositivo di messa a mare «Руза-П»; la soluzione fu imposta dalla zona a scafo singolo a poppa
  [DS-671RTM], [APL-671RTM], [RUWP-671RTM]. Antenna provata sul K-403 (667AK); prototipo Skat provato sul K-524 [RUWP-671RTM].
- **«Пеламида» (Pelamida):** le schede DeepStorm la collocano su **due soli 941** (TK-17 e TK-20) e su **due 641B** (diesel, durante
  i lavori) [DS-941], [DS-641B]. **Correzione al brief:** non ho trovato fonti che la mettano nella gondola del Victor III.
- **971 (Akula):** antenna rimorchiata nel contenitore sopra la deriva verticale [DS-971], [WP-AKULA].
- **705 (Alfa):** nessuna antenna rimorchiata nell'elenco del materiale radioelettronico [DS-705].
- Curiosità con valore di scenario: nel 1983 il K-324 (671RTM), seguendo la fregata USS McCloy che provava un'antenna TASS, se ne
  avvolse circa 400 m nell'elica e fu rimorchiato a Cuba [APL-671RTM], [RUWP-671RTM] (stimato).

### 4.3.4 ESM, radar, periscopi sovietici (dalle schede di progetto)

| Progetto | Radar | ESM / radiogoniometro | Periscopi | fonte | confidenza |
|---|---|---|---|---|---|
| 671RTM/RTMK (Victor III) | RLK «Каскад» (МРК-50/500: le due fonti trascrivono «МРК-500») con accessorio «Корма» | SORS «Залив-П» (МРП-21А); radiogoniometro «Завеса» | ПЗНГ-10(М); TV МТ-70-10 | [DS-671RTM], [APL-671RTM] | stimato |
| 705 (Alfa) | RLK «Чибис» (DeepStorm); «Topol MRK-50 (Snoop Tray)» (Wikipedia) | radiogoniometro «Весло-П» | universale «Сигнал»; TV «ТВ-1» | [DS-705], [WP-ALFA] | stimato (fonti in conflitto) |
| 971 (Akula) | RLK «Радиан» (МРКП-58 o -59) | — | «Сигнал-3»; comandante «Лебедь-11/21» | [DS-971], [RUWP-971] | stimato |
| 945 (Sierra I) | «Радиан» (МРКП-58) | — | «Кутум»; «Лебедь-21» | [DS-945] | stimato |
| 941 (Typhoon) | «Радиан(-У)» (МРКП-58) | SORS; radiogoniometro «Зона» | «Кутум», «Лебедь-21» | [DS-941] | stimato |

«Snoop Tray» è il nome NATO del radar di superficie dei sottomarini sovietici; l'associazione univoca con «Каскад»/MRK-50 è [CONO].
Bande, potenze e portate di questi radar ed ESM: **non trovate** in fonti aperte lette (nozionale).

---

## 4.4 Rilevamento non acustico della scia (SOKS) e analoghi occidentali

**Che cosa dicono le fonti aperte lette:**
- Il programma «Tukan» (CNII «Granit», Leningrado) nasce da un decreto del 27/01/1967; l'avanprogetto è presentato il **10 maggio 1968**;
  il primo prototipo «Tukan-1» esce dalla produzione a fine 1971 ed è installato nel 1972 su un sottomarino nucleare (cantiere n. 602),
  poi spostato sul n. 608; crociera autonoma in Atlantico dal 10 aprile al 7 maggio 1977; esercitazioni «Акватория-77» e
  «Штабель-10» (1979). Adottato con la sigla **MNK-200** [TSALKIN] (testimonianza di un ex vice-progettista: **stimato**).
- Principio: sensori sullo scafo misurano mentre si naviga le **anomalie dei campi idrofisici** dell'acqua (pulsazioni di velocità,
  temperatura, conducibilità elettrica, radioattività) e distinguono le anomalie artificiali da quelle naturali; il risultato migliore
  è sulla «zona stretta» della scia [TSALKIN]. Wikipedia inglese parla di sensori idrodinamici sul bordo d'attacco della vela che
  misurano variazioni di temperatura e salinità [WP-AKULA]. Sul 945A c'è un «sensore ambientale a 10 punti» sulla vela [WP-SIERRA] (Wikipedia non lo chiama SOKS: l'accostamento è mio).
- Uso operativo: un comandante dichiarò che «Tukan» lo aiutava a **mantenere o recuperare un contatto idroacustico perso** [TSALKIN];
  nell'operazione «Апорт» (1985) uno dei cinque 671RTM aveva «Tukan» per cercare i sottomarini americani lungo la scia [NVO-2018].
- Installazione: «датчики СОКС» nei disegni del 671RTMK [DS-671RTM]; sui 971 dal K-263 secondo DeepStorm, dal K-322 (esclusi K-461,
  K-328, K-152) secondo Wikipedia russa [DS-971], [RUWP-971]; DeepStorm dice che rileva la scia «molte ore dopo» il passaggio [DS-971].
- Un blog anonimo parla di persistenza «da 30 minuti a parecchie ore» e di prima installazione sul K-14 nel 1969 [SUBCLUB-SOKS]:
  affidabilità **bassa**, in contrasto con la cronologia di [TSALKIN] (prototipo solo nel 1972).
- Analoghi occidentali: Polmar nel 1981 cita l'interesse per sensori non acustici (magnetici, rilevazione di neutroni, scia) ma afferma
  che il sonar resta il più efficace secondo la Marina e la comunità scientifica americana [POL-1981]; Cote osserva che la colonna d'acqua
  resta «relativamente opaca» all'energia non acustica e che molto del non acustico è ancora classificato [COTE-2003 pp. 80, 90].
  **Non ho trovato** in fonti aperte lette un sistema statunitense equivalente installato sui 688.

**Lettura prudente per il gioco:** sensore sovietico **di inseguimento**, non di scoperta a distanza: funziona solo se si attraversa la
scia recente di un bersaglio; dà presenza ed età approssimata della scia, non distanza; utile per riprendere un contatto perso.

---

## 4.5 Verifica degli anacronismi (scenari 1985–1991)

| Elemento | In periodo? | Motivo | fonte |
|---|---|---|---|
| BQQ-5 A–D, TB-16, TB-23, BQS-15, WLR-9 | sì | in servizio negli anni '80 | [WWH-SON], [GUS-GAK], [POL-1979] |
| BSY-1 | sì, dal 1988–89 (SSN-751+), maturo dal 1989–90 | GAO | [GAO-90-72] |
| BQQ-5E, TB-29, LFA, CCS Mk 2, A-RCI/BQQ-10, WLY-1 | **no** | OPEVAL 1997–98, programmi fine anni '90 | [FAS-BQQ5], [FAS-BSY1], [FAS-TB29], [FAS-WLY1] |
| BQG-5 Wide Aperture Array | **no** prima del 1991 (in produzione) | GAO 1990 la mette nei costi; installazioni dal SSN-771 | [GAO-90-72], [WWH-SON] |
| MGK-540 Skat-3 su Akula | sì dal 1987–88 | prove 1986–87 sul K-284 | [RUWP-SKAT] |
| SOKS «Tukan» | sì (su alcuni battelli) | adottato dopo prove 1977–79; su Akula da K-263/K-322 | [TSALKIN], [DS-971], [RUWP-971] |
| Antenna rimorchiata sull'Alfa | **no** (assente nell'elenco del materiale) | — | [DS-705] |
| Pelamida sul Victor III | **non attestata** | Pelamida solo su 2 Typhoon e 2 Foxtrot 641B | [DS-941], [DS-641B] |

---

## 4.6 Implicazioni per il gioco — parametri **nozionali** proposti

Tutti i valori di questa sezione sono **nozionali** salvo dove richiamo una fonte. Il criterio è: geometria dichiarata nelle fonti →
DI e larghezza del fascio con le formule di §4.1 → accuratezza come frazione del fascio dipendente dal rapporto segnale/rumore.

### 4.6.1 Tabella dei sensori acustici

| Sensore | Banda di gioco | DI (dB) | Fascio −3 dB | σ rilevamento (SNR alto / vicino a soglia) | Copertura / baffles | Ragionamento | confidenza |
|---|---|---|---|---|---|---|---|
| Sfera BQS-13 passiva | 0,5–5 kHz (centro tattico 1–2 kHz) | 13,5 @0,5 kHz; 19,5 @1 kHz; 25,5 @2 kHz | 39° @0,5; 20° @1; 10° @2 kHz | 1,5° / 5° a 2 kHz; 3° / 10° a 1 kHz | ±150° dalla prua (baffles 60° a poppa) | D = 4,5 m e banda da [GUS-GAK]; σ ≈ fascio/6 con SNR ≥ DT+10 dB, ≈ fascio/2 a soglia | nozionale |
| Sfera BQS-13 attiva | 3,5 kHz | ≈ 30 | ≈ 6° × 7° | 1° in rilevamento; distanza ±1–2 % | settore prodiero ±60° | 3,5 kHz e fasci 6° × 7,2° da [GUS-GAK]; il ping rivela il battello a distanze ≥ 1,5–2 volte la propria portata attiva (vantaggio del percorso singolo) | nozionale |
| Array conforme (BQR-7/24) | 50 Hz–1 kHz | 10–15 | ampio (10–30°) | 5° / 15° | fianchi ±(30°–150°) | file da 50 ft [GS-BQR7]; aiuta a risolvere l'ambiguità della rimorchiata | nozionale |
| TB-16 | 30–1000 Hz (righe di pala e macchinario) | 9,9 @100 Hz; 14,7 @300 Hz; 19,9 @1 kHz | 10° @100 Hz; 3,5° @300 Hz | 1° / 4° a 300 Hz al traverso; ×3 entro 30° dagli assi | cieca ±20° verso prua (rumore proprio) e mediocre ±25° a poppa | L = 73 m [FAS-TB16]; ambiguità destra/sinistra [GS-TOWED] | nozionale |
| TB-23 | 10–500 Hz | ≈ 13 @50 Hz; ≈ 16 @100 Hz | 5° @50 Hz; 2,6° @100 Hz | 0,7° / 3° a 100 Hz al traverso | come TB-16, endfire peggiore | L ipotizzata 290 m [CONO], apertura maggiore [COTE-2003] | nozionale |
| BQS-15 | 20–80 kHz (ipotesi) | — | stretto | — | prua e vela, portata 1–3 km | solo navigazione, mine, ghiaccio, fondale; **intercettabile** | nozionale |
| Rubikon (Victor I/II, Delta III) | 0,3–5 kHz | ≈ 1–3 dB sotto il BQQ-5 | — | 2° / 7° | baffles 60° | antenna più piccola e generazione precedente | nozionale |
| Skat-KS (Victor III) | come Rubikon + rimorchiata infrasonica 10–300 Hz | +3–5 dB sul Rubikon | — | 1,5° / 6° | baffles 60°; rimorchiata come TB-16 | «tre volte» la portata precedente [DS-671RTM] ≈ +6–10 dB di FOM in propagazione cilindrica/sferica | nozionale |
| Skat-3 (Akula 1987+) | come Skat-KS + antenne di fianco | ≈ BQQ-5D | — | 1° / 5° | fianchi coperti dalle antenne laterali | antenne di fianco [RUWP-SKAT] | nozionale |
| Okean/Enisei (Alfa) | 1–5 kHz | ≈ Rubikon | — | 2,5° / 8° | baffles 70° | Alfa rumoroso a velocità tattica, niente rimorchiata [DS-705] | nozionale |

Note di calcolo (c = 1500 m/s): λ(1 kHz) = 1,5 m; sfera da 4,5 m → π·D/λ = 9,4 → DI = 19,5 dB; fascio = 59°·1,5/4,5 ≈ 20°.
TB-16 a 300 Hz: λ = 5 m; 2L/λ = 29 → DI = 14,7 dB; fascio = 51°·5/73 ≈ 3,5°. La pagina FUN dichiara DI > 30 dB «non raro» per i TASS
[FUN-tass]: con le formule standard serve un'antenna di diverse centinaia di metri a qualche centinaio di Hz; i valori qui sopra sono
quindi prudenti.

### 4.6.2 Regole per l'antenna rimorchiata

| Regola | Valore nozionale | Ragionamento / fonte di appoggio |
|---|---|---|
| Tempo per filarla / recuperarla | TB-16: 6–8 min; TB-23: 12–18 min | ≈ 800–1100 m di cavo + antenna a 1,5–2 m/s; il gioco del 1989 dice «qualche minuto» [MAN-688 p. 48] |
| Velocità minima | 3 kt | sotto, l'antenna (zavorrata per affondare) scende e si incurva [WP-TAS] |
| Velocità «utile» | piena efficacia ≤ 8 kt; −1 dB/kt fra 8 e 15 kt | il rumore di flusso compare oltre una soglia e cresce [FUN-ch8 §8.8.1.2] |
| Velocità meccanica massima | TB-16: 18 kt; TB-23: 15 kt; oltre, probabilità di danno crescente; opzione «taglia il cavo» come nel 1989 | resistenza ∝ v² [WP-TAS]; il gioco del 1989 limitava a 2/3 della potenza [MAN-688 p. 48] |
| Stabilità in virata | dopo una variazione di rotta > 10° l'antenna non dà rilevamenti per t ≈ (cavo + antenna)/velocità: TB-16 a 5 kt ≈ 5 min, a 10 kt ≈ 2,5 min; TB-23 a 5 kt ≈ 7 min | serve che tutta la lunghezza ripassi per il punto di virata; tempi morti «fino al 50 %» in manovra [FAS-TB23] |
| Ambiguità destra/sinistra | due rilevamenti speculari rispetto all'asse dell'antenna; si risolve con una **virata** (dopo la stabilizzazione) o incrociando con sfera o array conforme | [GS-TOWED] |
| Quota dell'antenna | più bassa della quota del battello di 30–100 m a seconda della velocità (più bassa a bassa velocità); può stare oltre lo strato quando il battello è sopra | principio descritto in [WP-TAS] per le antenne trainate |
| Baffles con antenna | il cono cieco poppiero si riduce (il gioco del 1989: 90° → 45° [MAN-688 fig. 6.4]) ma resta l'endfire debole | coerente con §4.6.1 |

### 4.6.3 Altri sensori

| Sensore | Regola nozionale proposta |
|---|---|
| WLR-9 e analoghi sovietici | scopre ogni sonar attivo o siluro in ricerca attiva entro 1,5–2,5 volte la portata alla quale quel sonar può scoprire il battello; rilevamento con σ 5° (1–10 kHz) o 10° (10–30 kHz) e solo quadrante oltre 30 kHz (ordine di grandezza da [OP-400EM]); classifica «sonar di nave / di sottomarino / siluro» |
| ESM (WLR-8, «Залив-П») | solo a quota periscopica con albero alzato; scopre radar di superficie e di aerei a distanza > 1,5 volte quella a cui quel radar vede il periscopio; σ 3–5° |
| Radar (BPS-15, «Каскад») | uso di navigazione; ogni emissione è intercettata dagli ESM nemici entro decine di nm |
| Periscopio | identificazione visiva delle navi di superficie entro 8–12 nm di giorno con buona visibilità; distanza stimata con stadimetro ±5–10 %; probabilità di essere scoperti per minuto d'esposizione crescente con stato del mare basso, velocità propria e radar/aerei nemici |
| SOKS «Tukan» (solo URSS, battelli dotati) | rileva la scia se il battello la attraversa o la segue entro 1–3 km lateralmente e se la scia ha meno di 2–6 ore; dà età e direzione di massima (non verso), nessuna distanza; serve a riacquisire un contatto, non a scoprirlo a distanza |
| Velocimetro/batitermografo | profilo noto in continuo alla propria quota; per le altre quote, profilo stimato (lancio di sonda o storico) |

### 4.6.4 Tempi di elaborazione e operatore

Il gioco del 1989 chiedeva «qualche minuto» al sonarista prima del *fix* [MAN-688 p. 13]. Proposta nozionale: il rilevamento compare
dopo un tempo d'integrazione di 10–60 s (banda larga) o 1–3 min (banda stretta), più lungo a SNR basso; la classificazione richiede
3–10 min sulle righe a banda stretta, più rapida se la classe è in biblioteca («biblioteca delle firme», [COTE-2003 p. 49]).
Il BSY-1 immaturo del 1988–89 [GAO-90-72] può essere reso come tempi di elaborazione più lunghi o guasti casuali.
