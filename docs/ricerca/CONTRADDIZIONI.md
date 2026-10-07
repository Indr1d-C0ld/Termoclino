# CONTRADDIZIONI — verifica di coerenza fra le sezioni 01–08

Revisione incrociata del catalogo, compilata il 2026-10-07 (ore 15:10–15:40) sulle versioni dei file presenti in
quel momento: `01_piattaforme.md` (15:11), `02_armi.md` (15:08), `03_contromisure.md` (15:06), `04_sensori.md`
(15:09), `05_acustica.md`, `06_tma.md`, `07_dottrina_siluri.md`, `08_688_originale.md` (15:09).
**Nessuna sezione è stata modificata.** Le correzioni spettano ai curatori: qui ci sono solo i problemi, le
prove e una proposta di soluzione.

I riferimenti «01:96» indicano file e riga. Le chiavi tra parentesi quadre sono in `FONTI.md`; quelle nuove,
raccolte durante questa revisione, sono nel frammento `_fonti_integrazioni.md` (Parte E di `FONTI.md`).

**Gravità.**
- **A (alta):** cambia una regola di gioco, una data di disponibilità o il bilanciamento.
- **M (media):** valori nozionali divergenti fra sezioni, da armonizzare.
- **B (bassa):** nomenclatura, etichette di confidenza, rimandi.

---

## 1. Contraddizioni fra sezioni

| # | Tema | Una sezione dice | L'altra dice | Prove | Gravità | Proposta |
|---|---|---|---|---|---|---|
| C1 | Sensori del 688I nel 1988–91 | 01:98 dà al 688I «BQQ-5D/E, TB-16D, TB-23, **BQG-5D** (flank array), BQS-15 / **MIDAS**» | 04:60, 04:100, 04:120, 04:277–278: BQQ-5E e TB-29 sono degli anni '90 (OPEVAL FY1998); la BQG-5 Wide Aperture Array compare dal Columbia (SSN-771); il BSY-1 **sostituisce** il BQQ-5 sui 688I | GAO: il BSY-1 «replaces the AN/BQQ-5 sonar and the CCS MK-1» e la WAA è ancora un costo di produzione nel 1990 [GAO-90-72]; BQG-5 dal SSN-771 [WWH-SON]; BQQ-5E/TB-29 OPEVAL 1998 [FAS-BQQ5] [FAS-TB29]; MIDAS = BQS-24 della suite BSY-2 del Seawolf [WWH-SON] | **A** | Per il 1985–91 il 688I ha BSY-1 (sfera MFAC, HFAC nella vela, TB-16, TB-23), **senza** WAA, senza BQQ-5E/TB-29/MIDAS. In 01 la riga va riferita alla configurazione di fine anni '90. |
| C2 | MIDAS come erede del «contour imaging» | 08:256 propone «Contour imaging → BQS-15 / MIDAS» | come C1: MIDAS (BQS-24) è un sonar della generazione Seawolf | [WWH-SON] | **B** | Per il 1985–91 usare solo la BQS-15 (04 §4.2.5). |
| C3 | Antenna rimorchiata del 688 flight I | 01:96: «BQR-15 o TB-16» | 04 non dà la BQR-15 ai 688; FAS la attribuisce solo agli SSBN Ohio e Lafayette; WWH la data sui Lafayette (1974) | [FAS-BQR15]; [WWH-SON]; ma Gusev mette la «ГАС bqr-15 с буксируемой протяженной антенной» dentro la suite BQQ-5 [GUS-GAK] | **B** | Fonti in conflitto: per il gioco usare TB-16 sui 688 e lasciare la BQR-15 agli SSBN, con una nota. |
| C4 | Scala di rumorosità: distanza Akula–Victor III | 05:393 (Akula +2, Victor III +6, cioè 4 dB); 01:333–357 (Akula +2, Late Victor III +5, Early +8: 3–6 dB) | 04:214: il K-284 è **12–15 dB** più silenzioso del 671RTM | fonte russa [DS-971]; la stessa scheda pone l'obiettivo di progetto di ridurre il rumore «circa cinque volte» rispetto al miglior battello di 2ª generazione (5× = 7 dB in potenza, 14 dB in pressione) [DS-971]; l'ordinamento ONI è senza scala [ONI96] | **A** (bilanciamento) | I dB sono tutti nozionali, ma lo scarto di 3–6 dB è da due a cinque volte più piccolo dell'unico numero pubblicato. Proposta: allargare a **+2 Akula / +10…+12 Early Victor III**, oppure dichiarare in 05 e 01 perché si scarta il dato russo (fonte di parte, condizioni ignote). |
| C5 | Scala di rumorosità: Sierra e Victor III | 05:393 (Sierra +6, Victor III +6) | 01:323–324: Sierra **+3** («+6 non supportato»), Victor III da separare in Early +8 / Late +5 | E1, E8 di 01 §3.1 [ONI96] [CW23] [COTE03] | **M** | Adottare i valori di 01 §3.3 come riferimento unico e aggiornare 05 §7.3 e 05 §8 di conseguenza. Già segnalato da 01. |
| C6 | Velocità utile dell'antenna rimorchiata | 05:356 e 05:408: v₀ = 3 kt, «massimo operativo di 12 kt» | 04:316–318: piena efficacia ≤ 8 kt, poi −1 dB/kt fino a 15 kt; limite meccanico 18 kt (TB-16) e 15 kt (TB-23) | Cold Waters: array «accecati» intorno a 10 kt [CW-MAN]; il 1989 limitava il 688 a 2/3 della potenza [MAN-688 p. 48] | **M** | Regola unica proposta in §4 (R2). |
| C7 | Tempo morto dell'antenna rimorchiata dopo un'accostata | 06:125: «2–4 minuti di assestamento del cavo» | 04:319: t ≈ (cavo + antenna)/velocità: TB-16 5 min a 5 kt, 2,5 min a 10 kt; TB-23 7 min a 5 kt | fisica del traino; tempi morti «fino al 50 %» in manovra [FAS-TB23] | **M** | La formula di 04 contiene i 2–4 min di 06 come caso particolare (8–12 kt). Proposta in §4 (R3). |
| C8 | σ di rilevamento dei sonar USA | 06:123–125 e 06:158: sfera 0,5–1,5°, conforme 1–2°, rimorchiata 0,5–2°; «0,5° in condizioni buone» | 04:295–299: sfera 1,5° (a 2 kHz) e 3° (a 1 kHz) con SNR alto, 5–10° vicino alla soglia; conforme 5°/15°; TB-16 1°/4°; TB-23 0,7°/3° | Le cifre di 06 vengono dall'ipotesi di simulazione di [COLL94] (σ = 0,5°); quelle di 04 dalla geometria (larghezza del fascio da [GUS-GAK]) | **A** | Con il CRLB di 06 §3.2, l'errore della soluzione a tre lati cresce linearmente con σ: **10 % a 0,5°, 30 % a 1,5°, 60 % a 3°** (caso D; `raw/fonti_check/sigma_sens.py`). Scegliere un solo modello (proposta in §4, R1), altrimenti la regola «tre lati ≈ 10 %» di 06 §3.2 e 06 §6 non vale con i sensori di 04. |
| C9 | Etichetta di confidenza del σ = 0,5° | 06:158: «stimato (ipotesi di [COLL94])» | per la convenzione del catalogo un'ipotesi di simulazione è `nozionale` | [COLL94] è una tesi su un battello diesel con σ scelto dall'autore | **B** | Rietichettare come `nozionale`. |
| C10 | Stadimetro del periscopio | 06 §5.1: distanza ±10 % | 04:331: ±5–10 % | nessuna fonte in nessuna delle due | **B** | Un solo valore, per esempio ±7 %, `nozionale`. |
| C11 | Mk 70 MOSS sui 688 | 03:37, 03:44, 03:126, 03:147: MOSS lanciato dal tubo da 21", «corpo derivato dal Mk 37»; «MOSS sì (raro)» per il 688 | due fonti già a catalogo e una nuova lo danno **solo agli SSBN** | «The Mk-70 MOSS (mobile submarine simulator) is carried by SSBNs. This torpedo tube-launched device…» [POL-1981] (copia `raw/04/usni_sonars2.txt`); tabella «Mk 70 MOSS — submarines (SSBN 726) — Tube-Launched Mobile Submarine Simulator» [WWH-SON]; «10-inch vehicle», in servizio dal 1976, su tutti gli SSBN dagli anni '80 a metà anni '90 [WP-EN-MOSS] | **A** | Togliere il MOSS dal carico del 688 (o dichiararlo «what-if»). Il «corpo da Mk 37» (19") non si concilia con un veicolo da 10": da cancellare finché non c'è una fonte. |
| C12 | Lanciatore dell'ADC sul 688 | 03:124: «lanciatore da 3" esterno al tubo; ricarica 30 s; 10–12 colpi per il 688» (senza fonte) | i lanciatori **esterni** documentati sono i CSA Mk 2: **14 tubi** per i Los Angeles, monouso a generatore di gas (si sostituiscono in porto), tubo di 122,3 × 7,5 in secondo la figura, compatibile con l'ADC Mk 3 da 6,25" citato nel rapporto; nel 1998 su 20 SSN 688, configurazione «SSN 688I Dihedral» | [EPA-UNDS99]; ADC Mk 3 IOC 1992 [CMANO-ADC]; prove dell'ADC Mk 3 Mod 0 ancora nel 1995 [EPA-UNDS99] | **M** | Per il 1985–91: niente lanciatori esterni sul 688 (sono degli anni '90, legati all'ADC Mk 3). I 3" si lanciano dai **segnalatori interni** (signal ejector), ricaricabili a bordo: il loro numero e la cadenza restano `nozionali` (una sola sintesi di ricerca, non letta, parla di «Internal Countermeasure Launcher, also known as the Signal Ejector»). |
| C13 | Data e prestazioni dell'MG-74 | 03:54: «anni '80 (stesso periodo del 671RTM)»; 03:126: simulatore semovente con durata nozionale di 15 min a 10–15 kn | adottato nel **1974** [MR-MG74] [WARFOR-GPD] (1972 secondo [KORZH10]); **15 km di corsa a non oltre 15 kn** (circa 32 min), quota fino a 250 m, 950 kg; vettori 641, 877/636, 671RTM, 971 [MR-MG74] | [MR-MG74] [KORZH10] [WARFOR-GPD] [KREM-MG74] | **M** | Datarlo «1972–74» e usare i dati di [MR-MG74] al posto dei valori nozionali di 03 §3.5 (15 kn, 15 km, ≤ 250 m). |
| C14 | Riduzione della portata dei seeker con le piastrelle | 07 §4: «−30 % con piastrelle anecoiche» | 05:124: TS −5/−10 dB per gli scafi rivestiti | — | **verificato, coerente** | Con propagazione sferica a due vie (40 log r) −6 dB di TS valgono −30 % di portata; −10 dB circa −44 %. Le due proposte sono compatibili se si usa −6 dB come valore medio. |
| C15 | Inseguimento in coda: autonomie usate | 07:136–143 usa le autonomie «claimed» del FAS (Mk 48: 34,4 kyd a 55 kt; ADCAP 63 kt con 35 kyd nozionali) | 02 §2.9 propone valori di gioco più bassi (Mk 48 Mod 4: 32 kyd a 55 kn, 40 kyd a 40 kn; ADCAP: 38 kyd a 60 kn, 50 kyd a 40 kn) | — | **B** | Con i valori di 02 la distanza massima di lancio contro l'Alfa in fuga diventa **8,1 kyd** (Mk 48, 55 kn; 07 dà 8,8) e **12,0 kyd** (ADCAP, 60 kn; 07 dà 12,2); contro l'Akula 12,8 kyd (07: 13,8). Conclusioni invariate; conviene però rifare la tabella di 07 con i valori di 02 per avere una sola base. |
| C16 | Data del Mk 50 | 01:485: «Mk 50 diffuso (fine anni '80, "never produced in great numbers")» | 02: OPEVAL 1990–91, impiego in flotta autorizzato a **ottobre 1992** | [NAVY-MK50] [GAO-91-22BR]; la frase «late 1980s» è di [COTE03] | **B** | Entrambe lo escludono dal periodo; uniformare la data a «1992». |
| C17 | Nome NATO «Shark Gill» | 01:210 attribuisce «Shark Gill» (da FAS) al sonar del **Mike** | 04:197 lo lega allo **Skat-3 (MGK-540)** dell'Akula, citando Wikipedia | [FAS-685]; [WP-AKULA]; 04 stesso dice di non averlo verificato su fonti NATO | **B** | Tenere i nomi NATO dei sonar sovietici fuori dalle tabelle numeriche, o marcarli tutti «non verificato». |
| C18 | Anno del Rubikon | 04:192: MGK-400 «adottato 1976» | Gusev scrive «разработан в 1976 г.» (sviluppato, non adottato) | [GUS-GAK] (`raw/04/ru_ereading_gak.txt`, voce МГК-400) | **B** | Correggere in «sviluppato nel 1976». |
| C19 | Riflessione dello scafo dell'Alfa | 05:124: «+3 dB per scafi senza piastrelle (Alfa, Victor I)» | DeepStorm: le forme dello scafo dell'Alfa «assicuravano una riflessione minima» dei segnali sonar | [DS-705] (`raw/04/ds_705.txt`, paragrafo sulle manovre di evasione) | **B** | Fonte di parte e solo qualitativa: tenere TS neutra (0 dB) per l'Alfa invece di +3, o citarla come controprova. |

---

## 2. Lacune e rimandi rotti

| # | Problema | Dove | Cosa c'è già nelle fonti scaricate | Proposta |
|---|---|---|---|---|
| L1 | 05:124 rimanda il rivestimento sovietico «Cluster Guard» a `01_piattaforme.md`, ma **01 non ne parla**; anche **03 non tratta i rivestimenti anecoici**, che il brief della sezione chiedeva | 05 §2.3, 01, 03 | Akula: scafo leggero «покрыт противогидроакустическим резиновым покрытием» [DS-971]; Tango: «противогидролокационными покрытиями облицован наружный корпус» e rivestimenti fonoisolanti sui basamenti [DS-641B], [CFW86 p.507]; Trafalgar: piastrelle anecoiche [CFW86 p.185]; fisica: spessore ≥ λ/4, in pratica 5–10 cm; 100 mm danno ≥ 6 dB di riduzione della TS fra 2 e 100 kHz, 120 mm circa 10 dB [KRAS14] | Aggiungere un paragrafo a 03 (o a 05 §2.3) con queste fonti. Per i Victor III e il nome «Cluster Guard» **nessuna fonte** trovata: restano `nozionali`. |
| L2 | 03:61 dichiara «nessuna fonte verificata» per MG-34, ГИП-1 e ВИПС; 03:52–53 non dà date per MG-14 e MG-44 | 03 §3.3 | Cronologia completa in una dissertazione del 2010 [KORZH10] (vedi §3) | Integrare la tabella 03 §3.3. |
| L3 | 03:38 e 03:127: NAE senza fonte; 03 non cita i disturbatori e ripetitori acustici dei sottomarini USA | 03 §3.2 | Tabella dei sistemi EW navali: BLQ-3 (disturbatore LF), BLQ-4 (disturbatore HF), BLQ-5 (ripetitore LF), BLQ-6 (ripetitore HF), BLQ-8 (contromisure acustiche), tutti «submarines»; BLR-14 BSAWS «warns, analyzes, and launches CM» [WWH-SON] (enciclopedia anonima, `stimato`, senza date) | Citare almeno l'esistenza di questi sistemi; date e prestazioni restano ignote. |
| L4 | 03 §3.6 propone per l'Alfa «2 simulatori + 4 apparati alla deriva espulsi da un piccolo lanciatore» | 03:150 | Il lanciatore piccolo per apparati alla deriva esisteva già sui battelli sovietici anni '60: l'MG-24 «si lanciava dal dispositivo ВИПС già presente sui sottomarini» [KORZH10] | La parte «apparati alla deriva» della proposta di 03 diventa plausibile: citare [KORZH10]. Per i «2 simulatori» invece attenzione: l'elenco dei vettori dell'MG-74 (641, 877/636, 671RTM/RTMK, 971) **non comprende il 705** [MR-MG74]; resta un'ipotesi `nozionale`. |
| L5 | 01:211 e 01:213: Rubikon su Kilo e Tango «non riverificato» | 01 §2.3 | Tango: nella legenda del disegno DeepStorm «основная антенна ГАК «Рубикон»» [DS-641B]; Kilo: l'MGK-400EM sostituisce l'MGK-400E dei 877E/877EKM/636 [OP-400EM] e Gusev dice che il Rubikon è montato su sottomarini piccoli e medi, diesel e nucleari [GUS-GAK] | Promuovere a `stimato` con queste chiavi. |
| L6 | 01:209, 01:217, 01:219: sonar di Sierra II, Typhoon e Delta IV «non verificato» o «n.d.» | 01 §2.3 | Skat-3 su entrambi i 945A; Skat-KS sui 941; MGK-520 «Skat-BDRM» sui 667BDRM [RUWP-SKAT] (secondaria) | Inserire con confidenza `stimato`. |
| L7 | Nome del sonar dell'Alfa (Okean / Enisej / MGK-1001) | 01:203 (riga Alfa), 04 §4.3.1, 08 §8.2.8 | Wikipedia russa: «Енисей — корабельный ГАК МГК-1001» [WP-RU-SLOVNAZ-E]: conferma il binomio Enisej = MGK-1001, non quale dei due nomi spetti all'Alfa | Lasciare la doppia denominazione, aggiungendo questa conferma. |
| L8 | 03:60: «REPS-324 "Shlagbaum"… la fonte non dice che sia un mezzo di contromisura» | 03 §3.3 | «Шлагбаум» è l'inserto-lanciatore dei mezzi semoventi di contromisura (СГАПД) MG-104 sui 971; l'MG-104 è da 324 mm [MR-MG104] | Riclassificare lo «Shlagbaum» come lanciatore esterno di contromisure, non come lanciasiluri. |

---

## 3. Integrazioni raccolte durante la revisione (contromisure, per il curatore di 03)

Le sezioni non sono state toccate. Questi dati vengono da fonti lette per intero o in estratto (vedi
`_fonti_integrazioni.md`) e colmano parte delle lacune dichiarate in 03 §3.6.

### 3.1 Cronologia sovietica dei mezzi di contromisura idroacustica (ГПД)

| Mezzo | Tipo (secondo la fonte) | Adozione | Funzionamento | Fonte | Confidenza |
|---|---|---|---|---|---|
| ИП | serie di cartucce **alla deriva** che creano cortine di bolle di gas | 1955 | riduceva del 50–60 % la probabilità di classificazione corretta; sganciamento dall'inseguitore con probabilità 0,5–0,6 | [KORZH10] | stimato |
| **MG-14** «Anabar» | disturbatore **semovente** | 1961 | emettitore meccanico a larga banda; sganciamento dall'inseguitore con probabilità 0,6–0,7, sfondamento di uno schieramento di navi 0,5 | [KORZH10] [WP-RU-SLOVNAZ] | stimato |
| MG-24 / MG-24M | disturbatore attivo **piccolo, alla deriva** | 1962 / 1964 | emettitore meccanico a larga banda; **lanciato dal dispositivo ВИПС** già presente sui sottomarini; usato contro gli idrofoni (sonar passivi) | [KORZH10] | stimato |
| **MG-34** «Egorlyk» / MG-34M | disturbatore **piccolo, alla deriva**, «combinato» | 1967 / 1970 | emettitore meccanico a larga banda **più** cartucce idroreattive che formano una nube di microbolle riflettente per i sonar attivi | [KORZH10] [WP-RU-SLOVNAZ-E] | stimato |
| **ГИП-1** | cartuccia «imitatrice» idroacustica | anni '60 (data non indicata) | solo cartucce idroreattive in gran numero: nube di bolle potente | [KORZH10] | stimato |
| MG-44 «Korund» | **imitatore semovente** di sottomarino | 1967 | registratore magnetico a filo: riproduce il rumore registrato del battello **oppure** registra i ping del sonar nemico e rimanda eco simulate | [KORZH10] [WP-RU-SLOVNAZ] | stimato |
| MG-54 «Magma» | imitatore **alla deriva** di sottomarino in moto | 1967 | come MG-44, registratore a pellicola | [KORZH10] [WP-RU-SLOVNAZ] | stimato |
| MG-64 | bersaglio-imitatore semovente (addestramento) | 1969 | — | [KORZH10] | stimato |
| **MG-74** «Korund(-2)» e MG-84 | imitatori/disturbatori **semoventi multiruolo** | **1974** [MR-MG74] [WARFOR-GPD] o 1972 [KORZH10] | elettronica migliorata, registratore a pellicola, **più tratti di corsa**; imitazione separata di rumore ed eco, disturbo mirato in frequenza; credibilità dell'imitazione +80–90 %, probabilità di successo dei compiti tattici +30–40 % rispetto alla generazione precedente [KORZH10]. Calibro 533 mm, lunghezza 3 900 mm senza bobina, 950 kg, **corsa fino a 15 km a non oltre 15 kn**, quota fino a 250 m, lanciato dai normali tubi lanciasiluri e stivato sulle rastrelliere; cambia modo e manovra secondo il livello dei ping ricevuti; vettori 641, 877/636, 671RTM/RTMK, 971 [MR-MG74] [KREM-MG74] | [KORZH10] [WARFOR-GPD] [MR-MG74] [KREM-MG74] [KREM-ARMS] [DSTORM-671RTM] | stimato |
| **MG-104** «Brosok» | falso bersaglio **semovente** da 324 mm (4 700 mm, 386 kg) | **1987** | stivato fuori dallo scafo nel **lanciatore esterno unificato (УЗПУ)**, sui 971 negli inserti «Шлагбаум»; dopo il primo tratto traina un'antenna ricevente e una emittente (disturbo o imitazione); una sola velocità; si autodistrugge a fine corsa | [MR-MG104] [WARFOR-GPD]; installazione dal K-391 [DS-971] | stimato |

Per il gioco ne derivano tre classi di carico sovietico:
- imitatori/disturbatori da 533 mm nei tubi (MG-74): **in servizio nel 1985–91**, perché i vettori elencati
  comprendono 671RTM e 971 [MR-MG74];
- piccoli disturbatori alla deriva da un lanciatore interno di tipo ВИПС (MG-24/MG-34): adottati negli anni '60;
  la loro presenza a bordo nel 1985–91 è **probabile ma non attestata** dalle fonti lette;
- apparati semoventi da lanciatori esterni (MG-104): solo sugli Akula, dal K-391 (1989).

Per l'MG-74 velocità e corsa sono note (≤ 15 kn, 15 km [MR-MG74]); per gli altri mezzi velocità, durata e livelli
d'emissione restano **sconosciuti** in tutte le fonti lette, e i valori di 03 §3.5 restano `nozionali`.

### 3.2 Contromisure USA

| Dato | Fonte | Confidenza |
|---|---|---|
| Mk 70 MOSS: veicolo da 10", eco attiva e firma passiva del battello lanciatore; in servizio dal 1976; **solo SSBN**; ritirato a metà anni '90 | [WP-EN-MOSS] [POL-1981] [WWH-SON] | stimato (tre fonti concordi, nessuna primaria) |
| CSA Mk 2: lanciatori **esterni** monouso a generatore di gas; 14 tubi per battello sui Los Angeles, 16 sugli Ohio; 20 SSN 688 e 4 SSBN equipaggiati alla fine degli anni '90; versione «SSN 688I Dihedral» | [EPA-UNDS99] | documentato (per il 1998–99) |
| ADC Mk 3 Mod 0 (6,25"): prove di immersione e pressione presso NSWC Crane nel maggio 1995 | [EPA-UNDS99] (riferimento 6) | documentato (conferma la data post-1991 di [CMANO-ADC]) |
| Taglio di carico realistico per il 688 nel 1985–91: solo i 3" (ADC Mk 2, IOC 1978) dai segnalatori interni | deduzione da [CMANO-ADC] [EPA-UNDS99] | stimato |

### 3.3 Tassonomia utile per le regole di 03 §3.5

Un manuale universitario russo del 2014 [KRAS14] distingue:
- **disturbatori**: mascherano l'eco e saturano il ricevitore del seeker; usati da soli possono **attirare** i siluri «intelligenti»;
- **falsi bersagli**: rispondono al ping del seeker; si dividono in «emettitori» (impulso preformato) e «ripetitori» (risposta in tempo reale);
- la **separazione verticale** fra esca e sottomarino è il fattore chiave, quindi i mezzi alla deriva rendono meno in acque basse;
- i mezzi esterni piccoli: alla deriva da 76–127 mm e semoventi da 124–250 mm.

Tutto questo è coerente con il modello di 03 §3.5 e con [FUN-11]. Il dettaglio «un disturbatore isolato può
attirare il siluro» merita una regola: un seeker moderno (ADCAP, Keramika) attratto da un disturbatore isolato
riceve un rilevamento verso la sorgente (`nozionale`).

---

## 4. Proposta di armonizzazione dei parametri dei sensori (C6, C7, C8)

`04_sensori.md` contiene già la tabella dei parametri nozionali dei sensori (04 §4.6: DI, fasci, σ, baffles,
regole per le antenne rimorchiate e per gli intercettatori). Per questo **non** ho scritto un `04b_parametri_sensori.md`.
Restano le tre divergenze di §1. Questa è una proposta, da approvare o respingere dai curatori di 04, 05 e 06.
Tutti i valori sono `nozionali`.

| Regola | Proposta | Perché |
|---|---|---|
| **R1. σ di rilevamento** | `σ = max(σ_min, 0,5 · θ₃dB · 10^(−SE/20))`, con θ₃dB = larghezza del fascio di 04 §4.6.1, SE = eccesso di segnale sopra la soglia (05 §1.1) e σ_min = 0,5° (sfera, TB-23) o 1° (TB-16, conforme). Sfera a 2 kHz (θ₃dB = 10°): SE = 0 → 5°; SE = 10 dB → 1,6°; SE ≥ 20 dB → 0,5°. Cioè i valori «a soglia / SNR alto» di 04 e, a segnale molto forte, lo 0,5° di 06 | Concilia 04 (geometria) e 06 (valore di simulazione [COLL94]) con la forma «σ ∝ 1/√SNR» già scritta in 06:123. Rende **più rapida la TMA sui bersagli rumorosi o vicini** e più lenta su quelli silenziosi: è proprio il meccanismo che separa Alfa e Akula. |
| **R2. Velocità dell'antenna rimorchiata** | Rumore di flusso con v₀ = 3 kt (05) fino a 8 kt; da 8 a 12 kt −1 dB/kt aggiuntivo (04); oltre i 12 kt l'antenna è «sorda» (05, e i 10 kt di Cold Waters); limite meccanico 18 kt (TB-16) e 15 kt (TB-23) con rischio di danno (04) | Una sola curva al posto di tre soglie diverse; il limite di 12 kt di 05 diventa il limite d'uso, quelli di 04 diventano i limiti di sopravvivenza dell'antenna. |
| **R3. Tempo morto dopo l'accostata** | `t = (L_cavo + L_antenna) / v`, con un minimo di 2 min e un massimo di 8 min; per accostate ≤ 10° nessun tempo morto ma σ ×2 per 1 min | È la fisica di 04; a 8–12 kt dà i 2–4 min di 06. |
| R4. Ambiguità destra/sinistra | come 04 §4.6.2 (si risolve con un'accostata dopo la stabilizzazione o con la sfera/conforme) | già coerente fra 04, 06 e 08 |
| R5. Baffles | sfera ±150° (04); con antenna filata cono cieco ridotto ma endfire debole ±20–25° (04) | 08 riporta i 90° → 45° del gioco del 1989: è una scelta di gioco storica, non un dato |

Conseguenza da comunicare al curatore di 06: con R1 la regola «tre lati ≈ 10 %» (06 §3.2 e 06 §6) vale solo per
bersagli con SNR alto; per un Akula vicino alla soglia (σ ≈ 3–5°) servono lati più lunghi o più numerosi (caso D
del CRLB: 60 % a 3°, 100 % a 5°).

---

## 5. Verifiche superate (nessuna contraddizione)

- **Seeker** 02 §2.9 contro 07 §4: allineati (02:281–282 rimanda esplicitamente a 07 §4).
- **Regole del filo** 02 §2.9 contro 07 §2.2: allineate (02:284 «stessi valori di 07 §2.2»).
- **Antenna rimorchiata sull'Alfa**: assente in 01, 04 (04 §4.3.3) e 08 (08 §8.4 #9), tutti su [DS-705].
- **Velocità dell'Alfa**: 41 kt in 01, 02, 07 e 08, con le stime occidentali di 43–46 kt trattate come «intelligence d'epoca».
- **ADC Mk 3 fuori periodo**: 02 §2.8, 03 §3.2 e la nuova fonte [EPA-UNDS99] concordano.
- **Silenzio come contromisura** (03 §3.5: SL −10/−15 dB) e legge del rumore di 05 §7.3 (`SL₀ + 20 log(v/5)`): da 15 a 3–5 kt la legge dà −9,5/−14 dB. Coerenti.
- **Disturbatore ≥ 200 dB re 1 µPa** [FUN-11]: stesso valore in 03 e 07.
- **σ sovietico** (06 §5.4: +30–50 % sulle classi vecchie) contro 04 §4.6.1 (Rubikon 2°, Okean 2,5° contro 1,5° della sfera USA a 2 kHz): +33–67 %, compatibile.
- **Rimandi**: 08 → «04 §4.6» esiste; 05 → «04_sensori.md per i limiti meccanici di TB-16 e TB-23» esiste (04 §4.6.2); 07 → «03_contromisure.md» per il Crazy Ivan esiste (03 §3.4.5).

---

## 6. Chiavi bibliografiche

Verifica automatica (`raw/fonti_check/check_keys.py FONTI.md`) dopo la fusione: **211 chiavi distinte citate in 01–08 e
in questo file, 0 senza voce**. L'esito completo e la tabella delle chiavi
sinonime (stessa opera, chiavi diverse in sezioni diverse: `[COTE03]` = `[COTE-2003]`, `[FUN-8]` = `[FUN-ch8]`,
`[FUN-TASS]` = `[FUN-tass]`, `[FAS-688]` = `[FAS-SSN688]`, `[DS-705]` = `[DSTORM-705]`, ecc.) sono in testa a
`FONTI.md`. Attenzione al prefisso **`DS-`**, usato con due significati: deepstorm.ru (`[DS-705]`, `[DS-971]`…) e
designation-systems.net (`[DS-44]`, `[DS-84]`, `[DS-109]`, `[DS-125]`). Non ci sono collisioni di chiave, ma un
lettore può confonderle: se si rinomina, conviene il prefisso DSN- per designation-systems (DSN-44 ecc.).

---

## Come le hanno risolte i dati di F0 (07/10/2026)

I file `shared/data/piattaforme/688.json` e `alfa.json` portano un blocco `contraddizioni` che dice, voce per voce,
che cosa si e' scelto e perche'. Qui il riassunto; il dettaglio (e la fonte di ogni numero) sta nei file.

| Voce | File | Esito |
|------|------|-------|
| C1 | 688 | risolta: il 688I del 1988-91 ha BSY-1, TB-16 e TB-23; niente WAA, BQQ-5E, TB-29, MIDAS (varianti.688I) |
| C2 | 688 | risolta: niente MIDAS, solo BQS-15 (sensori.alta_frequenza) |
| C3 | 688 | risolta: TB-16 sui 688, BQR-15 agli SSBN (sensori.rimorchiata) |
| C4 | 688 | aperta: riguarda Akula e Victor III (F7); non tocca 688 e Alfa |
| C4 | Alfa | aperta: tocca Akula e Victor III; l'Alfa a +14 resta fra Victor III e Victor I anche con la proposta +10/+12 |
| C5 | 688 | risolta per la scala di riferimento: vale 01 §3.3 (688I 0, 688 +1, Alfa +14); i valori di Sierra e Victor III si scriveranno in F7 |
| C5 | Alfa | risolta per la scala di riferimento: vale 01 §3.3 |
| C6 | 688 | risolta con R2 (sensori.rimorchiata) |
| C7 | 688 | risolta con R3 (sensori.rimorchiata) |
| C8 | 688 | risolta con R1: σ = max(σ_min, 0,5 · fascio · 10^(−SE/20)) per ogni sensore |
| C8 | Alfa | risolta con R1, σ sovietico +50 % come in 06 §5.4 |
| C9 | 688 | risolta: σ_min = 0,5° marcato nozionale |
| C10 | 688 | risolta: stadimetro ±7 % nozionale (sensori.periscopio) |
| C10 | Alfa | risolta: stadimetro ±7 % |
| C11 | 688 | risolta: niente MOSS sul 688 (armi.contromisure) |
| C12 | 688 | risolta: ADC Mk 2 dai segnalatori interni, numeri nozionali (armi.contromisure) |
| C13 | Alfa | non usata in F1: l'MG-74 si data 1972-74 [MR-MG74] [KORZH10] |
| C19 | Alfa | risolta: correzione TS neutra (0 dB) |
| L4 | Alfa | aperta e dichiarata: i 2 simulatori dell'Alfa sono un'ipotesi |
| L7 | Alfa | annotata: FAS chiama «Yenisei» il ricevitore d'intercettazione e «Okean» il sonar |
