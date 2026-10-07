# FONTI — bibliografia unificata del catalogo di riferimento

Fusione dei frammenti bibliografici eseguita il 2026-10-07 15:23 con `raw/fonti_check/merge_fonti.py`; verifica delle chiavi con `raw/fonti_check/check_keys.py`. I frammenti `_fonti_*.md` restano nella cartella e **non** sono stati modificati: in caso di dubbio fanno fede loro.

Data di consultazione di tutte le voci: **2026-10-07**, salvo diversa indicazione nella voce. Ogni voce dichiara il **modo** di consultazione (testo integrale scaricato / estratto / citato tramite / sintesi del motore di ricerca / conoscenza pregressa non riverificata), con le parole del ricercatore che l'ha usata.

## Stato della fusione

| sezione | file (ultima modifica) | frammento bibliografico | stato |
|---|---|---|---|
| 01 Piattaforme | `01_piattaforme.md` (15:11) | `_fonti_01.md` (15:11) | fuso, Parte B |
| 02 Armi | `02_armi.md` (15:08) | `_fonti_02_03.md` (15:08) | fuso, Parte C |
| 03 Contromisure | `03_contromisure.md` (15:06) | `_fonti_02_03.md` (15:08) | fuso, Parte C |
| 04 Sensori | `04_sensori.md` (15:09) | `_fonti_04_08.md` (15:09) | fuso, Parte D |
| 05 Acustica | `05_acustica.md` (06:25) | `_fonti_05_07.md` (15:00) | fuso, Parte A |
| 06 TMA | `06_tma.md` (14:56) | `_fonti_05_07.md` (15:00) | fuso, Parte A |
| 07 Dottrina dei siluri | `07_dottrina_siluri.md` (14:58) | `_fonti_05_07.md` (15:00) | fuso, Parte A |
| 08 688 Attack Sub originale | `08_688_originale.md` (15:09) | `_fonti_04_08.md` (15:09) | fuso, Parte D |
| Revisione incrociata | `CONTRADDIZIONI.md` (15:23) | `_fonti_integrazioni.md` (15:22) | fuso, Parte E |

**Verifica delle chiavi.** Sezioni controllate: `01_piattaforme.md`, `02_armi.md`, `03_contromisure.md`, `04_sensori.md`, `05_acustica.md`, `06_tma.md`, `07_dottrina_siluri.md`, `08_688_originale.md`, `CONTRADDIZIONI.md`. Chiavi distinte citate: **211**; chiavi definite qui: **229**; chiavi citate **senza voce: 0**. Chiavi definite ma non citate in nessuna sezione (fonti di contesto, calcoli, segnaposto): [NA81], [CALC-CZ], [CALC-ABS], [CALC-TMA], [CALC-CHASE], [CP-01], [CMP110], [GI15], [FAS-BSY2], [FAS-BQG5], [GAO-92-50], [RUWP-945], [RUWP-705], [WP-VICTOR], [ARMY2020-R].

## Chiavi sinonime (stessa opera, chiavi diverse)

Le sezioni sono state scritte in parallelo, perciò alcune opere hanno più chiavi. Sono tutte valide e definite qui sotto; questa tabella dice quali coincidono. Non sono collisioni: nessuna chiave ha due significati.

| chiavi | opera |
|---|---|
| [COTE03] (Parte A) = [COTE-2003] (Parte D) | Coté, *The Third Battle*, Newport Paper 16, 2003 |
| [FUN-8] (Parte A) = [FUN-ch8] (Parte D) | USNA, *Fundamentals of Naval Weapons Systems*, cap. 8 |
| [FUN-TASS] (Parte A) = [FUN-tass] (Parte D) | USNA, *Fundamentals…*, supplemento TASS |
| [FAS-688] (Parte B) = [FAS-SSN688] (Parte D) | FAS, *SSN-688 Los Angeles-class* |
| [DS-705] (Parte B) = [DSTORM-705] (Parte C) | deepstorm.ru, progetto 705 |
| [DS-671RTM] (Parte B) = [DSTORM-671RTM] (Parte C) | deepstorm.ru, progetto 671RTM |
| [DS-971] (Parte B) = [DSTORM-971] (Parte C) | deepstorm.ru, progetto 971 |
| [WP-ALFA] (Parte D) = [WP-EN-ALFA] (Parte C) | en.wikipedia, *Alfa-class submarine* |
| [RUWP-971] (Parte D) = [WP-RU-971] (Parte C) | ru.wikipedia, progetto 971 |
| [CONO] (Parte D) = [CP-01] (Parte B) | «conoscenza pregressa, non riverificata» (etichetta, non un'opera) |

**Attenzione al prefisso `DS-`**, usato con due significati: deepstorm.ru (`[DS-705]`, `[DS-971]`, …, Parti B e D) e designation-systems.net di A. Parsch (`[DS-44]`, `[DS-84]`, `[DS-109]`, `[DS-125]`, Parte C). Nessuna chiave coincide, ma conviene leggere la voce prima di citarla.

---

## Parte A — Sezioni 05 (acustica), 06 (TMA), 07 (dottrina dei siluri)

*Frammento d'origine: `_fonti_05_07.md` (ultima modifica 15:00). Il testo è riportato com'è; le chiavi già definite in una Parte precedente sono trasformate in rimandi (↪).*


Consultazione: 2026-10-07 per tutte le voci. Campo **modo**: `testo integrale scaricato` / `estratto` / `abstract via ricerca` / `riferimento bibliografico, non consultato`.

### Testi didattici e manuali ufficiali / semi-ufficiali

- **[FUN-8]** US Naval Academy, Weapons and Systems Engineering Dept., *Fundamentals of Naval Weapons Systems* (corso ES310), cap. 8 "Principles of Underwater Sound". Edizione web s.d. (bibliografia fino al 1989; pubblicata su FAS verso la fine degli anni '90). https://man.fas.org/dod-101/navy/docs/fun/part08.htm — modo: testo integrale scaricato (`raw/05/part08.htm`). *([FUN-8] è sinonimo di [FUN-ch8] (stessa opera).)*
- **[FUN-9]** Idem, cap. 9 "Underwater Detection and Tracking Systems". https://man.fas.org/dod-101/navy/docs/fun/part09.htm — testo integrale scaricato (il capitolo è dichiaratamente "in revisione").
- **[FUN-11]** Idem, cap. 11 "Countermeasures" (§11.3 Acoustic Countermeasures). https://man.fas.org/dod-101/navy/docs/fun/part11.htm — testo integrale scaricato.
- **[FUN-15]** Idem, cap. 15 "Guidance and Control" (paragrafi numerati 16.x nel file). https://man.fas.org/dod-101/navy/docs/fun/part15.htm — testo integrale scaricato.
- **[FUN-TASS]** Idem, supplemento "Towed Array Sonar System – Directivity advantage of large aperture arrays". https://man.fas.org/dod-101/navy/docs/fun/tass.htm — testo integrale scaricato (contiene valori di assorbimento errati, vedi 05 §2.2). *([FUN-TASS] è sinonimo di [FUN-tass] (stessa opera).)*
- **[FUN-SEASON]** Idem, supplemento "Seasonal Variation in SVPs". https://man.fas.org/dod-101/navy/docs/fun/season.htm — testo integrale scaricato.
- **[NAVOPS-11]** D. H. Wagner, W. C. Mylander, T. J. Sanders (a cura di), *Naval Operations Analysis*, 3ª ed., Naval Institute Press (1999: anno ed edizione dedotti; Wagner 1991 la dice "in preparazione"), cap. 11 "Bearings-Only Target Motion Analysis", pp. 257–272. Scansione: https://mathscinotes.com/wp-content/uploads/2015/04/NavOps.pdf — testo integrale del capitolo (mancano le pp. 262–265 nell'estrazione).
- **[SWOS-2.13]** Surface Warfare Officers School, Division Officer Training, *Information Sheet 2.13 – Sub-surface Combat Information Center*, s.d. (fine anni '90). https://man.fas.org/dod-101/navy/docs/swos/stu2/STU13.html — testo integrale scaricato.
- **[FAS-MK48]** Federation of American Scientists, Military Analysis Network, "MK-48 Torpedo", s.d. (pagina mantenuta fino a fine anni '90–2000; cita GAO/NSIAD-95-104 del 12/06/1995). https://man.fas.org/dod-101/sys/ship/weaps/mk-48.htm — testo integrale scaricato.

### Storia, articoli d'epoca

- **[COTE03]** Owen R. Coté Jr., *The Third Battle: Innovation in the U.S. Navy's Silent Cold War Struggle with Soviet Submarines*, Newport Paper n. 16, Naval War College Press, 2003. Scheda: https://digital-commons.usnwc.edu/usnwc-newport-papers/18 (PDF protetto da Cloudflare). Testo letto da una copia OCR (djvu.txt) di Internet Archive scaricata da un altro ricercatore (`raw/01/cote_third_battle_djvu.txt`). Numeri di pagina presi dalle intestazioni del testo OCR (pp. 57–60, 69–71) — modo: testo integrale (OCR). *([COTE03] è sinonimo di [COTE-2003] (stessa opera).)*
- **[WAG91]** Daniel H. Wagner, "Target Motion Analysis Innovations by Naval Officers", *The Submarine Review*, luglio 1991, Naval Submarine League. https://archive.navalsubleague.org/1991/target-motion-analysis-innovations-by-naval-officers — testo integrale scaricato.
- **[PEP89]** P. Kevin Peppe, "Torpedo Evasion: A Games Approach", *The Submarine Review*, ottobre 1989. https://archive.navalsubleague.org/1989/torpedo-evasion-a-games-approach — testo integrale scaricato (le tabelle dei payoff sono solo nel numero completo).
- **[PHX84a]** "Phoenix" (pseudonimo), "The Submarine ASW Torpedo", *The Submarine Review*, gennaio 1984. https://archive.navalsubleague.org/1984/the-submarine-asw-torpedo — testo integrale scaricato.
- **[PHX84b]** "Phoenix", "The Antiship Torpedo", *The Submarine Review*, luglio 1984. https://archive.navalsubleague.org/1984/the-antiship-torpedo — testo integrale scaricato.
- **[PHX90]** RADM M. H. Rindskopf e CAPT William J. Ruhe, "Submarine Weapons of the '90s", *The Submarine Review*, aprile 1990. https://archive.navalsubleague.org/1990/submarine-weapons-of-the-90s — testo integrale scaricato.
- **[LONG89]** Brian R. Longworth, "Torpedo Propulsion: Then, Now, Tomorrow", *The Submarine Review*, aprile 1989. https://archive.navalsubleague.org/1989/torpedo-propulsion-then-now-tomorrow — testo integrale scaricato.
- **[COLL94]** Pedro F. Coll, *Target Motion Analysis from a Diesel Submarine's Perspective*, tesi di MS, Naval Postgraduate School, Monterey, settembre 1994 (relatore A. R. Washburn); hdl:10945/42970; DTIC ADA289557. https://calhoun.nps.edu/server/api/core/bitstreams/3711c63c-51a2-4d93-994a-fc86a27e50a4/content — testo integrale scaricato.

### Acustica: equazioni e dati

- **[NPL-SS]** National Physical Laboratory (UK), *Technical Guides – Speed of sound in sea water – Underlying Physics* (pagina © 2026). https://resource.npl.co.uk/acoustics/techguides/soundseawater/underlying-phys.html — testo integrale scaricato (certificato TLS del sito incompleto: scaricato ignorando la verifica).
- **[MACK81]** K. V. Mackenzie, "Nine-term equation for the sound speed in the oceans", *J. Acoust. Soc. Am.* 70(3), 807–812, 1981 — consultato tramite [NPL-SS] (coefficienti e dominio di validità); articolo originale non consultato.
- **[NPL-ABS]** National Physical Laboratory, *Technical Guides – Calculation of absorption of sound in seawater* (pagina "Underlying physics" e codice JavaScript del calcolatore: formule Francois–Garrison 1982, Fisher–Simmons 1977, Ainslie–McColm 1998). https://resource.npl.co.uk/acoustics/techguides/seaabsorption/ — testo e codice scaricati. Originali: M. A. Ainslie, J. G. McColm, *JASA* 103(3), 1671–1672, 1998; R. E. Francois, G. R. Garrison, *JASA* 72(3), 896–907 e 72(6), 1879–1890, 1982 (non consultati direttamente).
- **[STOJ06]** Milica Stojanovic, "On the Relationship Between Capacity and Distance in an Underwater Acoustic Communication Channel", Proc. 1st ACM WUWNet, 2006 (anche *ACM SIGMOBILE MC2R* 11(4), 2007). https://www.mit.edu/~millitsa/resources/pdfs/bwdx.pdf — testo integrale scaricato. Riporta la formula di Thorp (dB/km), citando Berkhovskikh & Lysanov 1982, e il modello di rumore di R. Coates, *Underwater Acoustic Systems*, Wiley 1989.
- **[KG08]** N. Kurahashi, G. Gratta, "Oceanic Ambient Noise as a Background to Acoustic Neutrino Detection", arXiv:0712.1833v2 (2008; pubblicato su *Phys. Rev. D* 78, 2008). https://arxiv.org/pdf/0712.1833 — testo integrale scaricato (parametrizzazione di Knudsen da Urick).
- **[REEVES17]** E. Reeves, P. Gerstoft, P. F. Worcester, M. A. Dzieciuch, A. Thode, "Eastern Arctic ambient noise on a drifting vertical array", arXiv:1702.01356v3, luglio 2017. https://arxiv.org/pdf/1702.01356 — testo integrale scaricato.
- **[BJ82]** C. Allan Boyles, Geraldine W. Joice, "Comparison of Three Acoustic Transmission Loss Models with Experimental Data", *Johns Hopkins APL Technical Digest* 3(1), 67–76, 1982. https://secwww.jhuapl.edu/techdigest/content/techdigest/pdf/V03-N01/03-01-Boyles.pdf — testo integrale scaricato.
- **[SM194]** G. Dreini, F. B. Jensen, "Wave-theory modelling of convergence zone propagation in the ocean", SACLANTCEN Memorandum SM-194, giugno 1987 (DTIC ADA183607). https://apps.dtic.mil/sti/tr/pdf/ADA183607.pdf — **accesso negato (HTTP 403)**; consultato solo l'abstract riportato dal motore di ricerca.
- **[MCK12]** M. F. McKenna, D. Ross, S. M. Wiggins, J. A. Hildebrand, "Underwater radiated noise from modern commercial ships", *JASA* 131(1), 92–103, 2012. https://www.navymarinespeciesmonitoring.us/files/2313/8308/7954/McKenna_et_al._2012-Underwater_radiated_noise_from_modern_commercial_ships.pdf — testo integrale scaricato.
- **[ARX2402]** A. Venkateshwaran, I. K. Deo, J. Jelovica, R. K. Jaiman, "A multi-objective optimization framework for reducing the impact of ship noise on marine mammals", arXiv:2402.02647v2, 18 maggio 2024. https://arxiv.org/pdf/2402.02647 — testo integrale scaricato; usato solo per la formula di Ross (1976) che riproduce.
- **[PAT3676802]** F. J. Murphree (cessionario US Department of the Navy), "Submarine propeller cavitation noise simulator", brevetto US 3,676,802, depositato il 21-06-1971, concesso l'11-07-1972. https://patents.google.com/patent/US3676802A/en — testo scaricato (cita R. J. Urick, *Principles of Underwater Sound for Engineers*, McGraw-Hill, 1967).
- **[URICK83]** R. J. Urick, *Principles of Underwater Sound*, 3ª ed., McGraw-Hill, 1983 — **riferimento bibliografico, non consultato**: le formule attribuite sono da conoscenza pregressa e sono marcate `stimato` nel testo.
- Ross, D., *Mechanics of Underwater Noise*, Pergamon, 1976 — non consultato; citato tramite [ARX2402] e [MCK12].

### Stima bearings-only (riferimenti bibliografici, non consultati: paywall IEEE)

- **[NLG84]** S. C. Nardone, A. G. Lindgren, K. F. Gong, "Fundamental properties and performance of conventional bearings-only target motion analysis", *IEEE Trans. Automatic Control* AC-29(9), 775–787, settembre 1984 (estremi verificati tramite ricerca).
- **[NA81]** S. C. Nardone, V. J. Aidala, "Observability criteria for bearings-only target motion analysis", *IEEE Trans. Aerospace and Electronic Systems* AES-17(2), 162–166, 1981 (da conoscenza pregressa).
- **[AID79]** V. J. Aidala, "Kalman filter behavior in bearings-only tracking applications", *IEEE Trans. AES* AES-15(1), 29–39, 1979 (da conoscenza pregressa).
- **[AH83]** V. J. Aidala, S. E. Hammel, "Utilization of modified polar coordinates for bearings-only tracking", *IEEE Trans. Automatic Control* AC-28(3), 283–294, 1983 (da conoscenza pregressa).

### Giochi e simulatori (fonti sulle scelte di modellazione)

- **[SONALYSTS-SC]** SUBSIM Review, "Tactics & Tips: Sub Command", con le "Sonalysts Game Design Notes" (note di progetto, circa 2001) e la tabella di cavitazione di "nzm30". https://www.subsim.com/tactics-tips-sub-command/ — sito dietro Cloudflare; letta la copia Wayback del 13-02-2025: http://web.archive.org/web/20250213192413/https://www.subsim.com/tactics-tips-sub-command/
- **[CW-MOD]** Killerfish Games, "Modding Guide" (Cold Waters, 2017), guida Steam Community id 938593459. https://steamcommunity.com/sharedfiles/filedetails/?id=938593459 — testo integrale scaricato.
- **[CW-MAN]** Killerfish Games, *Cold Waters Operations Manual*, v. 1.07 (2018). https://cdn.akamai.steamstatic.com/steam/apps/541210/manuals/Cold_Waters_Operations_Manual_107.pdf — testo integrale scaricato.

### Calcoli propri (riproducibili)

- **[CALC-CZ]** `raw/05/calc/cz_raytrace.py`: ray tracing 2D, Mackenzie, profili idealizzati (nozionali).
- **[CALC-ABS]** `raw/05/calc/absorption_noise.py`: confronto fra le formule di assorbimento, tabelle di rumore di Coates e Knudsen, conversione del bearing rate, indice d.
- **[CALC-TMA]** `raw/06/calc/tma_crlb.py` (limite di Cramér–Rao), `raw/06/calc/tma_mc2.py` (Monte Carlo con minimi quadrati di Levenberg–Marquardt).
- **[CALC-CHASE]** `raw/07/calc/sternchase.py`: inseguimento in coda.

### Fonti cercate e non accessibili

- DTIC (apps.dtic.mil): HTTP 403 per gli script, per esempio ADA145986 "Simple prediction of convergence zone propagation" e ADA183607 (SM-194).
- DOSITS (dosits.org): 403.
- SUBSIM forum e tutorial TMA di Dangerous Waters: challenge Cloudflare. Non ho tentato di aggirarla, perché equivarrebbe a superare un controllo anti-bot.

---

## Parte B — Sezione 01 (piattaforme)

*Frammento d'origine: `_fonti_01.md` (ultima modifica 15:11). Il testo è riportato com'è; le chiavi già definite in una Parte precedente sono trasformate in rimandi (↪).*


Frammento bibliografico da fondere in `FONTI.md`. Data di accesso per tutte le voci: **2026-10-07**.
Copie locali in `raw/01/` (nome file indicato tra parentesi).

Legenda della modalità di consultazione:
- **testo integrale scaricato**: pagina o documento letti per intero (HTML/PDF/OCR scaricati con curl);
- **estratto/anteprima**: solo frammenti di testo (es. ricerca full-text di archive.org su libri in prestito
  controllato, che restituisce brevi estratti senza numero di pagina);
- **citato tramite <fonte>**: documento non visto direttamente;
- **da conoscenza pregressa, non riverificato**.

---

### Fonti ufficiali / primarie

**[USN-FF97]** U.S. Navy, Chief of Information. *Fact File: Attack Submarines – SSN* (Los Angeles, Seawolf,
Narwhal, Sturgeon, Benjamin Franklin). Pagina web, versione archiviata il 9 ottobre 1997.
URL: https://web.archive.org/web/19971009171728/http://www.chinfo.navy.mil/navpalib/factfile/ships/ship-ssn.html
— testo integrale scaricato (Wayback Machine) (`navy_ssn_factfile_1997.*`).

**[USN-FF24]** U.S. Navy. *Fact File: Attack Submarines – SSN*. Pagina web, versione archiviata il 2 gennaio 2024.
URL: https://web.archive.org/web/20240102034939/https://www.navy.mil/Resources/Fact-Files/Display-FactFiles/article/2169558/attack-submarines-ssn/
— testo integrale scaricato (Wayback; il sito navy.mil risponde 403 agli accessi automatici) (`navy_ssn_factfile.*`).

**[NTSP98]** Naval Air Systems Command (PMA264). *Navy Training System Plan for the Navy Consolidated
Sonobuoys*, N88-NTSP-A-50-8910B/A, settembre 1998, 11 pp. Già ospitato da FAS:
http://www.fas.org/man/dod-101/sys/ship/weaps/docs/ntsp-Sonobuoy.pdf ; copia letta:
https://web.archive.org/web/20030413024143/http://www.fas.org/man/dod-101/sys/ship/weaps/docs/ntsp-Sonobuoy.pdf
— testo integrale scaricato (PDF → pdftotext) (`ntsp_sonobuoy_1998.*`). Descrive le varianti in produzione nel 1998.

**[ONI97]** Rear Adm. Michael W. Cramer, Director of Naval Intelligence. *Worldwide Submarine Challenges, 1997*.
Statement before the Subcommittee on Seapower, Senate Armed Services Committee, 8 aprile 1997.
URL: https://irp.fas.org/congress/1997_hr/s970408c.htm — testo integrale scaricato (`oni_1997_cramer.*`).

**[ONI96]** Office of Naval Intelligence. *Worldwide Submarine Challenges 1996*, p. 11: grafico "Nuclear
Submarines – Broadband – Radiated noise vs Year – At tactical speeds (5–7 knots)".
— **citato tramite [CW23]**, figura 3 (riproduzione del grafico, esaminata come immagine:
`cmsi_img/ONI1996_fig3_broadband_noise.jpg`). Documento ONI originale non visto.

**[ONI09]** Office of Naval Intelligence. *The People's Liberation Army Navy: A Modern Navy with Chinese
Characteristics*, 2009: grafico "Submarine Quieting Trends / Relative detectability".
— **citato tramite [CW23]**, figura 5 (esaminata come immagine: `cmsi_img/ONI2009_fig5_relative_detectability.jpg`).

Testimonianze citate di seconda mano (tutte **citate tramite [COTE03]**):
- Adm. James D. Watkins, CNO, testimonianza del 1984 sui Victor III ("we had misjudged the absolute sound and
  pressure levels…") [COTE03 p.66–67].
- V.Adm. Lee Baggett Jr., Committee on Armed Services, U.S. Senate, *DoD Authorization for Appropriations for
  FY 1986*, Part 8, 26 febbraio 1985, p. 4373 (parità acustica tra Akula e i 688 non migliorati; Akula e Sierra
  confrontati con i 688 più vecchi) [COTE03 note 102, 110].
- Adm. Butts, stessa audizione, p. 4365 (sostituzione dei Delta con sottomarini "quieter, SS-N-21 equipped")
  [COTE03 nota 110].

### Studi e opere di riferimento occidentali

↪ [COTE03] → voce principale: [COTE03] (Parte A). *Nota di consultazione di questa sezione:* Owen R. Cote Jr. *The Third Battle: Innovation in the U.S. Navy's Silent Cold War Struggle with
Soviet Submarines*. Newport Papers n. 16, Naval War College Press, Newport RI, 2003 (DTIC ADA421957).
URL: https://archive.org/details/DTIC_ADA421957 (file `DTIC_ADA421957_djvu.txt`)
— testo integrale scaricato (OCR) (`cote_third_battle_djvu.txt`). Pagine citate: 59–60 (Alfa, Mk 48/Mk 46/Mk 50),
66–67 (Delta, Victor III), 67–70 (Akula), 72 (Akula contro Delta e 688), note 101–110.

**[CW23]** Christopher P. Carlson, Howard Wang. *A Brief Technical History of PLAN Nuclear Submarines*.
China Maritime Report n. 30, China Maritime Studies Institute, U.S. Naval War College, 17 agosto 2023.
URL: https://www.andrewerickson.com/wp-content/uploads/2023/08/CMSI_China-Maritime-Report_30_A-Brief-Technical-History-of-PLAN-Nuclear-Submarines_Carlson-Wang_202308.pdf
(anche https://digital-commons.usnwc.edu/cmsi-maritime-reports/30)
— testo integrale scaricato (PDF → pdftotext; figure estratte con pdfimages) (`cmsi30_carlson_wang.pdf`, `cmsi30.txt`, `cmsi_img/`).
Usato per: riproduzione dei grafici ONI 1996 e 2009; zattere ad anello (Alfa, Victor II/III) e zattere
orizzontali flottanti (Sturgeon, Sierra, Akula).

**[PM04]** Norman Polmar, Kenneth J. Moore. *Cold War Submarines: The Design and Construction of U.S. and
Soviet Submarines*. Brassey's, Washington DC, 2004, xxiii + 407 pp.
Copia digitale in prestito controllato: https://archive.org/details/coldwarsubmarine0000polm
— **estratto/anteprima**: solo frammenti restituiti dalla ricerca full-text di archive.org
(`services/search/beta/page_production/?service_backend=fts`), senza numeri di pagina tranne quelli visibili
nel frammento (glossario p. xix; indice: Alfa SSN pp. 136, 139, 140–45, 146). Frammenti salvati in `raw/01/pm/`.
Frasi usate: definizioni di test, working, limiting e collapse depth; "The Alfa SSN's speed of 41 knots also
took Western intelligence unaware"; Los Angeles: "This limited her test depth to an estimated 950 feet (290
meters)"; "greater test depth in third-generation SSNs—1,970 feet (600 m)"; Mike: "she successfully reached
her test depth of 3,280 feet"; equipaggio del Mike "57 … later increased to 64"; equipaggio al completamento
"25 officers, 4 warrant officers, and 1 petty officer" (attribuito all'Alfa dal contesto, che parla di concetti
di equipaggio "aeronautici"); Seawolf "some 50 weapons … one-third more than in a modified Los Angeles-class
SSN (37 weapons)". Il resto del libro **non è stato letto**.

**[FR97]** Norman Friedman. *The Naval Institute Guide to World Naval Weapons Systems, 1997–1998*. Naval
Institute Press, Annapolis, 1997. Copia in prestito controllato: https://archive.org/details/navalinstitutegu0000frie
— **estratto/anteprima** (ricerca full-text di archive.org, frammenti salvati in `raw/01/pm/`). Voci usate:
SSQ-41 ("standard Western 31-channel A-size (14 lb) omnidirectional Julie-Jezebel", "the most widely used
Western buoy"), SSQ-53 (standardizzata nel 1969; SSQ-53B a 99 canali, 22 lb, profondità 100/400/1000 ft, durate
1/3/8 h), SSQ-77 VLAD, SSQ-47B, carichi di boe dell'Il-38 (RGB-1/RGB-2), sistemi Berkut, Korshun e Baku,
OKA-2 (portata attiva max 5 500 m, passiva 18 500 m), VGS-3, AQS-13F (216 dB, 1 500 ft), "12 Type 75 Series S
buoys" del Ka-27.

**[CFW86]** Jean Labayle Couhat (ed.), A.D. Baker III (ed. inglese). *Combat Fleets of the World 1986/87:
Their Ships, Aircraft, and Armament*. Naval Institute Press, Annapolis, 1986.
URL: https://archive.org/details/CombatFleetsOfTheWorld198687
— testo integrale scaricato (OCR djvu, 3,4 MB) (`cfw8687_djvu.txt`). Pagine citate: 184–185 (Trafalgar,
Swiftsure, Valiant), 494–495 (aviazione navale sovietica), 498 (Delta III/IV, Typhoon), 501–502 (Oscar,
Charlie), 504–508 (SSN e SS sovietici), 510, 515 (Kirov, Kara), 613–614 (aerei ed elicotteri USA), 618–621
(Los Angeles, Sturgeon, Permit), 630 (Ticonderoga), 639–642 (Spruance, Perry). L'OCR contiene errori puntuali
(es. "SSQ-63/SSQ-60" per SSQ-53/SSQ-62, "ASQ-13F" per AQS-13F): sono stati corretti solo dove l'errore era evidente.
Fonte coeva: riflette le stime occidentali del 1985–86.

**[JFS90]** Richard Sharpe (ed.). *Jane's Fighting Ships 1990–91*. Jane's Information Group, Coulsdon, 1990.
Copia in prestito controllato: https://archive.org/details/janesfightingshi0000unse_q1i4
— **estratto/anteprima** (ricerca full-text di archive.org; poche interrogazioni riuscite, servizio instabile).
Usato solo per la quota dei Kilo: "Structure: Diving depth, 300 m (985 ft)" (scheda di un Kilo da esportazione).

**[FAS-688]** Federation of American Scientists, Military Analysis Network. *SSN-688 Los Angeles-class*. *([FAS-688] è sinonimo di [FAS-SSN688] (stessa opera).)*
Aggiornata il 14/2/2000. URL: https://man.fas.org/dod-101/sys/ship/ssn-688.htm — testo integrale scaricato (`fas_ssn-688.*`).

**[FAS-637]** FAS MAN. *SSN-637 Sturgeon class*. Aggiornata il 28/11/1999. https://man.fas.org/dod-101/sys/ship/ssn-637.htm — testo integrale scaricato.

**[FAS-594]** FAS MAN. *SSN-594 Permit class*. Aggiornata il 26/10/1999. https://man.fas.org/dod-101/sys/ship/ssn-594.htm — testo integrale scaricato.

**[FAS-705]** FAS MAN (J. Pike). *Project 705 Lira / Alfa class*. Aggiornata il 7/9/2000. Originale
http://www.fas.org/man/dod-101/sys/ship/row/rus/705.htm (oggi 404); letta su
https://web.archive.org/web/20011024093939/http://fas.org/man/dod-101/sys/ship/row/rus/705.htm
— testo integrale scaricato (`fas_rus_705.*`). Attenzione: contiene errori (scambio OK-550/BM-40A; prototipo chiamato K-377).

**[FAS-971]** FAS MAN. *Project 971 Shchuka-B / Akula*. Aggiornata il 7/9/2000. Wayback:
https://web.archive.org/web/20011202043220/http://www.fas.org/man/dod-101/sys/ship/row/rus/971.htm — testo integrale scaricato.

**[FAS-945]** FAS MAN. *Project 945 Barrakuda / Sierra*. Aggiornata il 7/9/2000. Wayback:
https://web.archive.org/web/20020203080633/http://www.fas.org/man/dod-101/sys/ship/row/rus/945.htm — testo integrale scaricato.

**[FAS-685]** FAS MAN. *Project 685 Plavnik / Mike*. Aggiornata il 7/9/2000. Wayback:
https://web.archive.org/web/20020203074841/http://www.fas.org/man/dod-101/sys/ship/row/rus/685.htm — testo integrale scaricato.

**[FAS-1135]** FAS MAN. *Project 1135 Burevestnik / Krivak*. Wayback:
https://web.archive.org/web/20011230094743/http://www.fas.org/man/dod-101/sys/ship/row/rus/1135.htm — testo integrale scaricato.

**[FAS-956]** FAS MAN. *Project 956 Sarych / Sovremenny*. Wayback:
https://web.archive.org/web/20020203082053/http://www.fas.org/man/dod-101/sys/ship/row/rus/956.htm — testo integrale scaricato.

**[FAS-1144]** FAS MAN. *Project 1144 Orlan / Kirov*. Wayback:
https://web.archive.org/web/20010806024721/http://www.fas.org/man/dod-101/sys/ship/row/rus/1144.htm — testo integrale scaricato.

**[FAS-1164]** FAS MAN. *Project 1164 Atlant / Slava*. Wayback:
https://web.archive.org/web/20011205205030/http://www.fas.org/man/dod-101/sys/ship/row/rus/1164.htm — testo integrale scaricato.

**[FAS-DD963]** FAS MAN. *DD-963 Spruance class*. Aggiornata il 14/2/2000. https://man.fas.org/dod-101/sys/ship/dd-963.htm — testo integrale scaricato.

**[FAS-FFG7]** FAS MAN. *FFG-7 Oliver Hazard Perry class*. Aggiornata il 14/2/2000. https://man.fas.org/dod-101/sys/ship/ffg-7.htm — testo integrale scaricato.

**[FAS-CG47]** FAS MAN. *CG-47 Ticonderoga class*. Aggiornata il 9/5/2000. https://man.fas.org/dod-101/sys/ship/cg-47.htm — testo integrale scaricato.

**[FAS-P3]** FAS MAN. *P-3 Orion*. Aggiornata il 27/12/1999. https://man.fas.org/dod-101/sys/ac/p-3.htm — testo integrale scaricato.

**[FAS-S3]** FAS MAN. *S-3B Viking*. Aggiornata il 23/4/2000. https://man.fas.org/dod-101/sys/ac/s-3.htm — testo integrale scaricato.

**[FAS-SH60]** FAS MAN. *SH-60 Seahawk*. Aggiornata il 27/12/1999. https://man.fas.org/dod-101/sys/ac/sh-60.htm — testo integrale scaricato.

**[FAS-IL38]** FAS MAN. *Il-38 May*. Aggiornata il 21/9/1999. https://man.fas.org/dod-101/sys/ac/row/il-38.htm — testo integrale scaricato.

**[FAS-KA25]** FAS MAN. *Ka-25 Hormone*. Aggiornata il 17/6/2000. https://man.fas.org/dod-101/sys/ac/row/ka-25.htm — testo integrale scaricato.

**[FAS-SSQ53]** FAS MAN. *AN/SSQ-53 Directional Frequency Analysis and Recording Sonobuoy*. Aggiornata il 12/12/1998.
https://man.fas.org/dod-101/sys/ship/weaps/an-ssq-53.htm — testo integrale scaricato.

**[WP-TRAF]** Wikipedia (EN). *Trafalgar-class submarine* (wikitesto; le date di commissione citano Jane's
Fighting Ships 1996, p. 758). https://en.wikipedia.org/wiki/Trafalgar-class_submarine — testo integrale scaricato;
**solo controllo secondario** (`wp_Trafalgar-class_submarine.wiki`).

**[WP-SWIFT]** Wikipedia (EN). *Swiftsure-class submarine*. https://en.wikipedia.org/wiki/Swiftsure-class_submarine
— testo integrale scaricato; **solo controllo secondario**.

### Fonti russe specializzate

**[DS-xxx]** A.S. Nikolaev (curatore). *Штурм глубины / Глубинный шторм* — schede per progetto, "Подводные
лодки. Проект …", sezioni "Состав проекта", "История проекта", "Тактико-технические данные". deepstorm.ru,
© 2002–2024. Le schede citano a loro volta: V.P. Kuzin, V.I. Nikol'skij, *Военно-Морской Флот СССР 1945–1991*
(1996); Ju.V. Apal'kov, *Подводные лодки* (2002–2003); S.S. Berežnoj, *Атомные подводные лодки ВМФ СССР и
России* (2001); V.E. Il'in, A.I. Kolesnikov, *Подводные лодки России* (2002). Tutte le schede: testo integrale
scaricato (cp1251 → UTF-8) (`ds_*.txt`).
- **[DS-705]** Проекты 705 и 705К «Лира»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/705/list.htm *([DS-705] è sinonimo di [DSTORM-705] (stessa opera).)*
- **[DS-671]** Проект 671 «Ёрш»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/671/list.htm
- **[DS-671RT]** Проект 671РТ «Сёмга»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/671RT/list.htm
- **[DS-671RTM]** Проект 671РТМ(К) «Щука»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/671RTM/list.htm *([DS-671RTM] è sinonimo di [DSTORM-671RTM] (stessa opera).)*
- **[DS-971]** Проект 971 «Щука-Б»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/971/list.htm *([DS-971] è sinonimo di [DSTORM-971] (stessa opera).)*
- **[DS-945]** Проект 945 «Барракуда»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/945/list.htm
- **[DS-945A]** Проект 945А «Кондор»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/945A/list.htm
- **[DS-685]** Проект 685 «Плавник»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/685/list.htm
- **[DS-877]** Проект 877 «Палтус»: https://www.deepstorm.ru/DeepStorm.files/45-92/dts/877/list.htm
- **[DS-641]** Проект 641: https://www.deepstorm.ru/DeepStorm.files/45-92/dts/641/list.htm
- **[DS-641B]** Проект 641Б «Сом»: https://www.deepstorm.ru/DeepStorm.files/45-92/dts/641b/list.htm
- **[DS-670]** Проект 670 «Скат»: https://www.deepstorm.ru/DeepStorm.files/45-92/nsrs/670/list.htm
- **[DS-670M]** Проект 670М «Чайка»: https://www.deepstorm.ru/DeepStorm.files/45-92/nsrs/670m/list.htm
- **[DS-949A]** Проект 949А «Антей»: https://www.deepstorm.ru/DeepStorm.files/45-92/nsrs/949A/list.htm
- **[DS-941]** Проект 941 «Акула»: https://www.deepstorm.ru/DeepStorm.files/45-92/nbrs/941/list.htm
- **[DS-667BDR]** Проект 667БДР «Кальмар»: https://www.deepstorm.ru/DeepStorm.files/45-92/nbrs/667BDR/list.htm
- **[DS-667BDRM]** Проект 667БДРМ (nome «Дельфин» non riportato nella scheda): https://www.deepstorm.ru/DeepStorm.files/45-92/nbrs/667BDRM/list.htm

**[RSI-xxx]** *RussianShips.info — Корабли ВМФ СССР и России*, schede per progetto (TTX, armamento, elettronica,
elenco unità con date). © 2009–2026. Testo integrale scaricato (cp1251 → UTF-8) (`rsi_*.txt`).
- **[RSI-1135]** http://russianships.info/boevye/1135.htm (сторожевые корабли пр.1135/1135М)
- **[RSI-1155]** http://russianships.info/boevye/1155.htm (БПК пр.1155)
- **[RSI-956]** http://russianships.info/boevye/956.htm (эсминцы пр.956)
- **[RSI-1144]** http://russianships.info/boevye/1144.htm (ТАРКР пр.1144/11442)
- **[RSI-1164]** http://russianships.info/boevye/1164.htm (РКР пр.1164)
- **[RSI-1134B]** http://russianships.info/boevye/1134b.htm (БПК пр.1134Б)

**[AW-xxx]** *Уголок неба* (airwar.ru), enciclopedia aeronautica. Le pagine riproducono articoli di riviste
specializzate russe, indicati in calce. Testo integrale scaricato (cp1251 → UTF-8) (`airwar_*.txt`).
- **[AW-IL38]** Ил-38: http://www.airwar.ru/enc/sea/il38.html — articolo di A. Artem'ev, "«Ильюшин» против
  подводной угрозы", *Авиация и Космонавтика* (anno non indicato nella pagina); scheda TTX della pagina.
- **[AW-TU142M]** Ту-142М: http://www.airwar.ru/enc/sea/tu142m.html — articoli di A. Artem'ev, "Крылья над
  морем", *Авиация и Космонавтика* 2008-07, e altri (A. Sovenko 2006; V. Rigmant 1999; D. Antonov e V. Rigmant 1994).
- **[AW-BE12]** Бе-12: http://www.airwar.ru/enc/sea/be12.html — articoli di A. Artem'ev, "«Чайка» над морем",
  *Авиация и Время* 1997-03; V.N. Martynenko e A.I. Sal'nikov 1997; N. Jakubovič, *Крылья Родины* 1996-09.

### Conoscenza pregressa non riverificata

**[CP-01]** Elementi indicati nel testo come "da conoscenza pregressa, non riverificato": *([CP-01] è sinonimo di [CONO] (stessa opera).)*
- sonar MGK-400 "Rubikon" su Kilo e Tango;
- profondità (60/1 000 ft) e durate (1/3/8 h) della SSQ-41B;
- rientro di K-43 (INS *Chakra*) dall'India nel 1991 (la data di consegna, 5/1/1988, è invece in [DS-670]);
- VL-ASROC operativo dal 1993;
- date di commissione della classe Oliver Hazard Perry (1977–1989), salvo il totale 51 [FAS-FFG7] e il conteggio
  1986 [CFW86];
- nome NATO delle sigle sonar sovietiche non citate esplicitamente dalle fonti.
Non sono stati usati come base per numeri in tabella senza marcatura esplicita.

### Fonti cercate ma non ottenute

- Friedman, *U.S. Submarines Since 1945* (1994): non trovato in copia consultabile.
- Jane's Fighting Ships 1986–87 e 1988–89 (archive.org: `janesfightingshi86moor`, `janesfightingshi8990shar`):
  presenti solo in prestito controllato, non interrogati; il 1990–91 è stato interrogato solo in minima parte ([JFS90]). **Prossimo passo consigliato**: ricerca full-text come per [PM04].
- Polmar, *Guide to the Soviet Navy* (4ª ed., 1986, `guidetosovietnav0000unse`): in prestito controllato, non interrogato.
- CIA FOIA Reading Room (NIE/SNIE sui sottomarini sovietici): non consultata in questa tornata (limite delle ricerche web).
- Pagine FAS sul Victor III, sull'Oscar II, sull'Udaloy e sul Kara: non trovate nella Wayback Machine con gli URL provati (671tm, 671rt, 949a, 1155, 1134b, 670); potrebbero esistere con altri nomi di file.

---

## Parte C — Sezioni 02 (armi) e 03 (contromisure)

*Frammento d'origine: `_fonti_02_03.md` (ultima modifica 15:08). Il testo è riportato com'è; le chiavi già definite in una Parte precedente sono trasformate in rimandi (↪).*


Compilato il 2026-10-07. Tutti gli accessi sono del **2026-10-07**. Le copie scaricate sono in `raw/02/` salvo diversa indicazione: `raw/02/mr/` (militaryrussia), `raw/02/ds/` (deepstorm), `raw/02/wiki/` (estratti Wikipedia via API), `raw/02/ia/` (testi Internet Archive).

Modi di consultazione:
- `testo integrale scaricato` = letto per intero dalla copia scaricata;
- `estratto/anteprima` = letta solo una parte;
- `citato tramite <fonte>` = non letto in originale;
- `da conoscenza pregressa, non riverificato`.

Le chiavi condivise con `_fonti_05_07.md` / `FONTI.md` (COTE03, PEP89, PHX84a, PHX90, LONG89, FUN-8, FUN-11, CW-MAN, FAS-MK48) indicano **la stessa opera**; qui si annota solo come l'ho consultata io.

### Fonti ufficiali / primarie (USA)

- **[GAO-91-22BR]** U.S. General Accounting Office, *Navy Budget: Potential Reductions in Weapons Procurement*, Briefing Report to Congressional Requesters, GAO/NSIAD-91-22BR (B-241277), gennaio 1991. https://www.gao.gov/assets/nsiad-91-22br.pdf
  - Contiene: pp. 13–15 (Mk 48 ADCAP: "full production … February 1989"; Mk 50: OPEVAL da luglio 1990, decisione di produzione piena prevista ad aprile 1991); p. 27 ("The Secretary of the Navy canceled the Sea Lance program last year"); App. III (Sea Lance "Program canceled", al 29/09/1990); paragrafo Tomahawk (46 sottomarini abilitati a fine 1989; Block III sui sottomarini nel 1995).
  - Modo: **testo integrale scaricato** (PDF via WebFetch, il curl diretto era bloccato; testo OCR con errori di riconoscimento) — `raw/02/gao_nsiad-91-22br.pdf`, `.txt`.
- **[GAO-95-104]** U.S. General Accounting Office, *Navy Torpedo Programs: MK-48 ADCAP Upgrades Not Adequately Justified*, GAO/NSIAD-95-104 (B-260154), 12 giugno 1995. https://www.govinfo.gov/content/pkg/GAOREPORTS-NSIAD-95-104/pdf/GAOREPORTS-NSIAD-95-104.pdf
  - Contiene: pp. 2–3 (programma avviato nel 1975, produzione piena nell'FY1989, acquisti fermati nel 1992, ultime consegne nel 1996; parere OPTEVFOR 1994 sul lancio ad alta velocità).
  - Modo: **testo integrale scaricato** — `raw/02/govinfo_NSIAD-95-104.pdf`, `.txt`.
- **[NAVY-TORP2005]** U.S. Navy Fact File, "Torpedoes – Mark 46, Mark 48, Mark 50", NAVSEA, Last Update 30 March 2005. http://www.navy.mil/navydata/fact_display.asp?cid=2100&tid=900&ct=2
  - Modo: **testo integrale scaricato** dalla Wayback Machine (richiesta `web/2004id_/…`, restituita la copia aggiornata al 2005; il navy.mil attuale risponde 403) — `raw/02/wb_ff_2100_900.html`.
- **[NAVY-MK50]** U.S. Navy Fact File, "Torpedo – Mark 50", Last Update 13 November 2007 (contiene "first authorized for fleet use in October 1992"). http://www.navy.mil/navydata/fact_display.asp?cid=2100&tid=1000&ct=2 — modo: **testo integrale scaricato** (Wayback) — `raw/02/wb_ff_2100_1000.html`.
- **[NAVY-MK54]** U.S. Navy Fact File, "Mk 54 MAKO Lightweight Torpedo", Last Update 13 November 2007 (IOC 2004). http://www.navy.mil/navydata/fact_display.asp?cid=2100&tid=1100&ct=2 — modo: **testo integrale scaricato** (Wayback) — `raw/02/wb_navy_mk48_old.html`. Il nome del file è fuorviante: l'URL richiesto restituiva la scheda Mk 54.
- **[NAVY-MINES]** U.S. Navy Fact File, "U.S. Navy Mines", Last Update 18 November 2011 (Mk 67 SLMM: deployed 1987, 1.658 lb, 510 lb HE). http://www.navy.mil/navydata/fact_display.asp?cid=2100&tid=1200&ct=2 — modo: **testo integrale scaricato** (Wayback) — `raw/02/wb_ff_2100_1200.html`.
- **[NAVY-MK48-2021]** U.S. Navy Fact File, "MK 48 – Heavyweight Torpedo", last updated 14 Oct 2021 (Mod 6 IOC 1997, Mod 7 IOC 2006, peso 3.744 lb, testata 650 lb). https://www.navy.mil/Resources/Fact-Files/Display-FactFiles/Article/2167907/mk-48-heavyweight-torpedo/ — modo: **testo integrale scaricato** (Wayback 2023; il sito attuale risponde 403) — `raw/02/wb_navy_mk48.html`.
- **[NAVY-TLAM2003]** U.S. Navy Fact File, "Tomahawk Cruise Missile", PEO(W), Last Update 11 August 2003 (Block II TLAM-A IOC 1984; gittate dei Block II/III). http://www.navy.mil/navydata/fact_display.asp?cid=2200&tid=1300&ct=2 — modo: **testo integrale scaricato** (Wayback) — `raw/02/wb_navy_tomahawk_old.html`.
- **[NAVY-TLAM2021]** U.S. Navy Fact File, "Tomahawk Cruise Missile", last updated 27 Sep 2021. https://www.navy.mil/Resources/Fact-Files/Display-FactFiles/Article/2169229/tomahawk-cruise-missile/ — modo: **testo integrale scaricato** (Wayback 2023) — `raw/02/wb_navy_tomahawk.html`.
- **[SMP-1985]** U.S. Department of Defense, *Soviet Military Power 1985*, Fourth Edition, aprile 1985 ("SS-NX-21 … expected to become operational this year"). Internet Archive `soviet-military-power-1985_202409` — modo: **testo integrale scaricato** (OCR) — `raw/02/ia/`.
- **[SMP-1987]** U.S. Department of Defense, *Soviet Military Power 1987*, Sixth Edition, marzo 1987 ("expected to become operational soon"; Mike capace di lanciare SS-N-15 e SS-N-16). DTIC ADA189858, Internet Archive `DTIC_ADA189858` — modo: **testo integrale scaricato** (OCR).
- **[SMP-1988]** U.S. Department of Defense, *Soviet Military Power: An Assessment of the Threat 1988*, aprile 1988 (tra i fatti dell'anno: "The SS-N-21 sea-launched cruise missile became operational"; Oscar "24 SS-N-19 550-kilometer"). Internet Archive `soviet-military-power-1988_202409` — modo: **testo integrale scaricato** (OCR).

### Fonti specialistiche aperte (USA)

- **[NW-US]** Tony DiGiulian, "Torpedoes of the United States of America – Post-World War II", NavWeaps, ultimo aggiornamento 13 gennaio 2026 (prima pubblicazione 31/10/2008). Fonti dichiarate: Friedman, *Naval Institute Guide to World Naval Weapons 1991/92*; Milford, "US Navy Torpedoes", *Submarine Review* (1996–); Jane's (2001). http://www.navweaps.com/Weapons/WTUS_PostWWII.php — modo: **testo integrale scaricato** — `raw/02/navweaps_TorpUS.html`, `nw_us_post.txt`.
- ↪ [FAS-MK48] → voce principale: [FAS-MK48] (Parte A). *Nota di consultazione di questa sezione:* Federation of American Scientists, Military Analysis Network, "MK-48 Torpedo" (R. Sherman / J. Pike), aggiornato il 12 dicembre 1998. https://man.fas.org/dod-101/sys/ship/weaps/mk-48.htm — modo: **testo integrale scaricato** — `raw/02/fas_mk48.html`. **Attenzione**: le righe "acquisition range 1600 yards / ASROC / 6–8 minutes" coincidono con quelle della pagina Mk 46 (vedi sezione 2).
- **[FAS-MK46]** FAS MAN, "MK-46 Torpedo", aggiornato il 12/12/1998. https://man.fas.org/dod-101/sys/ship/weaps/mk-46.htm — **testo integrale scaricato**.
- **[FAS-MK50]** FAS MAN, "MK-50 Advanced Lightweight Torpedo [ALWT]", aggiornato il 12/12/1998 (storia OPEVAL 1990–92 da DOT&E). https://man.fas.org/dod-101/sys/ship/weaps/mk-50.htm — **testo integrale scaricato**.
- **[FAS-MK57]** FAS MAN, "MK 57 Submarine-laid ASW Mine", aggiornato il 12/12/1998. https://man.fas.org/dod-101/sys/ship/weaps/mk-57.htm — **testo integrale scaricato** — `raw/02/fas_ship_weaps_mk-57.htm`.
- **[FAS-MK67]** FAS MAN, "MK 67 Submarine Launched Mobile Mine (SLMM)", aggiornato il 12/12/1998 (Date Deployed 1983; 330 lb HE; fino a 600 ft). https://man.fas.org/dod-101/sys/ship/weaps/mk-67.htm — **testo integrale scaricato**.
- ↪ [FAS-688] → voce principale: [FAS-688] (Parte B). *Nota di consultazione di questa sezione:* FAS MAN, "SSN-688 Los Angeles-class", aggiornato il 14 febbraio 2000 (da SSN 719 in poi 12 tubi verticali per Tomahawk; *Providence* in servizio il 27/07/1985). https://man.fas.org/dod-101/sys/ship/ssn-688.htm — **testo integrale scaricato**.
- **[FAS-SLQ25]** FAS MAN, "AN/SLQ-25 NIXIE", aggiornato il 30 giugno 1999. https://man.fas.org/dod-101/sys/ship/weaps/an-slq-25.htm — **testo integrale scaricato**.
- **[DS-44]** Andreas Parsch, "Goodyear UUM-44 Subroc", *Directory of U.S. Military Rockets and Missiles*, designation-systems.net, ultimo aggiornamento 19 luglio 2002 (fonti: Gibson 1996; Friedman, *US Naval Weapons*, 1983; Jane's Weapon Systems 1987-88). https://www.designation-systems.net/dusrm/m-44.html — **testo integrale scaricato**.
- **[DS-84]** A. Parsch, "Boeing (McDonnell Douglas) AGM/RGM/UGM-84 Harpoon", designation-systems.net, ultimo aggiornamento 14 dicembre 2024. https://www.designation-systems.net/dusrm/m-84.html — **testo integrale scaricato**.
- **[DS-109]** A. Parsch, "Raytheon (General Dynamics) AGM/BGM/RGM/UGM-109 Tomahawk", designation-systems.net, ultimo aggiornamento 22 dicembre 2024. https://www.designation-systems.net/dusrm/m-109.html — **testo integrale scaricato**.
- **[DS-125]** A. Parsch, "Boeing RUM/UUM-125 Sea Lance", designation-systems.net, ultimo aggiornamento 28 maggio 2002 (fonti: Jane's Weapon Systems 1987-88; Polmar, *Ships and Aircraft of the US Fleet*, 15ª ed. 1993). https://www.designation-systems.net/dusrm/m-125.html — **testo integrale scaricato**.
- **[NWA-ALLBOMBS]** Carey Sublette, "Complete List of All U.S. Nuclear Weapons", nuclearweaponarchive.org, ultima modifica 30 marzo 2023 (W55: "Mid Kiloton Range", prodotta 1/64–3/68 e 3/70–4/74, ritirata 6/83–9/90, 285 esemplari; W80-0; W44; W89 cancellata 9/1991). https://nuclearweaponarchive.org/Usa/Weapons/Allbombs.html — **testo integrale scaricato**.
- **[GS-MK60]** GlobalSecurity.org, "MK 60 Encapsulated Torpedo (CAPTOR)" e "MK 60 Specifications", ultima modifica 07-07-2011. https://www.globalsecurity.org/military/systems/munitions/mk60.htm e `…/mk60-specs.htm` — **testo integrale scaricato**. Nota: la tabella delle specifiche mescola dati del Mk 46 e del CAPTOR; ne ho usato solo le righe specifiche della mina (pesi, lunghezze, quota, 1979).
- **[MILAERO-2022]** *Military & Aerospace Electronics*, "Ultra Electronics to build torpedo-defense decoy to help protect surface warships from torpedo attacks", 11 luglio 2022 (descrizione dell'ADC Mk 2: 3", stazionaria a quota impostata, motore controllato dalla pressione). https://www.militaryaerospace.com/sensors/article/14279356/torpedo-defense-decoy-surface-warships — **testo integrale scaricato**.
- **[CMANO-ADC]** cmano-db.com (database del gioco *Command: Modern Operations*, db v.511), voci "ADC Mk2 Mod 0 Torpedo Decoy" (weapon/137: "IOC 1978") e "ADC Mk3 Mod 0" (weapon/136: "IOC 1992", 6,25"). Entrambe citano Friedman, *The Naval Institute Guide to World Naval Weapon Systems*, 5ª ed., 2006, p. 769. https://cmano-db.com/weapon/137/ e /136/ — modo: pagine scaricate; le **date sono "citate tramite"** un database di gioco che dichiara Friedman 2006: **Friedman non è stato letto**.

### Monografie, riviste e manuali

- ↪ [COTE03] → voce principale: [COTE03] (Parte A). *Nota di consultazione di questa sezione:* Owen R. Coté Jr., *The Third Battle*, Newport Paper 16, Naval War College Press, 2003 (DTIC ADA421957). Contiene: pp. 58–60 (Mk 37 fino al 1972; Mk 48-3 a fine anni '70; envelope expansion nei primi anni '80; ADCAP "63-knot" da Milford 1997; Alfa a 41 kn e ≈1.100 ft; Mk 50 "late 1980s"; NEARTIP a fine anni '70). Modo: **testo integrale scaricato** (OCR Internet Archive `DTIC_ADA421957`, copia mia in `raw/02/ia/`).
- ↪ [LONG89] → voce principale: [LONG89] (Parte A). *Nota di consultazione di questa sezione:* Brian R. Longworth, "Torpedo Propulsion: Then, Now, Tomorrow", *The Submarine Review*, aprile 1989. https://archive.navalsubleague.org/1989/torpedo-propulsion-then-now-tomorrow — modo: **testo integrale** letto dalla copia `raw/07/nsl_1989_torpedo-propulsion-then-now-tomorrow.txt` (scaricata dal coordinatore). Citazioni verificate: "900m depth, a variable speed (55 knots top) and a range approaching 40km"; "To sustain a 1.5:1 speed advantage over the ALPHA, a top speed of over 60 knots would be needed"; "reported diving depth of the ALPHA exceeding 1,000m".
- ↪ [PEP89] → voce principale: [PEP89] (Parte A). *Nota di consultazione di questa sezione:* P. Kevin Peppe, "Torpedo Evasion: A Games Approach", *The Submarine Review*, ottobre 1989. https://archive.navalsubleague.org/1989/torpedo-evasion-a-games-approach — **testo integrale** (senza le tabelle dei payoff) letto da `raw/07/nsl1989_evasion.txt`.
- ↪ [PHX84a] → voce principale: [PHX84a] (Parte A). *Nota di consultazione di questa sezione:* "Phoenix", "The Submarine ASW Torpedo", *The Submarine Review*, gennaio 1984. https://archive.navalsubleague.org/1984/the-submarine-asw-torpedo — **testo integrale** letto da `raw/07/`.
- ↪ [PHX90] → voce principale: [PHX90] (Parte A). *Nota di consultazione di questa sezione:* M. H. Rindskopf, W. J. Ruhe, "Submarine Weapons of the '90s", *The Submarine Review*, aprile 1990 (vi compare già "the cancelled SEA LANCE"). https://archive.navalsubleague.org/1990/submarine-weapons-of-the-90s — **testo integrale** letto da `raw/07/`.
- ↪ [FUN-8] → voce principale: [FUN-8] (Parte A). *Nota di consultazione di questa sezione:* US Naval Academy, *Fundamentals of Naval Weapons Systems*, cap. 8. https://man.fas.org/dod-101/navy/docs/fun/part08.htm — **citato tramite** `05_acustica.md` / `07_dottrina_siluri.md` (non riletto da me).
- ↪ [FUN-11] → voce principale: [FUN-11] (Parte A). *Nota di consultazione di questa sezione:* US Naval Academy, *Fundamentals of Naval Weapons Systems*, cap. 11 "Countermeasures", §11.3 "Acoustic Countermeasures" (edizione web s.d., bibliografia fino al 1989). https://man.fas.org/dod-101/navy/docs/fun/part11.htm — **testo integrale** letto da `raw/05/part11.txt`.
- ↪ [CW-MAN] → voce principale: [CW-MAN] (Parte A). *Nota di consultazione di questa sezione:* Manuale di *Cold Waters* (Killerfish Games): **citato tramite** `07_dottrina_siluri.md` (definizione di gioco del knuckle); non letto da me.

### Fonti russe / sovietiche

- **[NW-RU]** Tony DiGiulian, "Torpedoes of Russia/USSR – Post-World War II", NavWeaps, ultimo aggiornamento 23 aprile 2021 (prima pubblicazione 05/08/2016). Fonti dichiarate: Кузин/Никольский, *ВМФ СССР 1945–1991*; Павлов, *Военные корабли России 1997–1998*; *Jane's Underwater Warfare Systems 1997–98*; *Военный парад* 1996–2000. http://www.navweaps.com/Weapons/WTRussian_post-WWII.php — modo: **testo integrale scaricato** — `raw/02/nw_ru_post.html`, `.txt`.

**militaryrussia.ru** (*MilitaryRussia.Ru — отечественная военная техника после 1945 г.*), autore delle schede "DIMMI". Al 2026-10-07 il sito risponde con la pagina "Сайт находится в разработке": **tutte le schede sono state lette dalle copie Wayback Machine** (richiesta `https://web.archive.org/web/2024id_/http://militaryrussia.ru/blog/topic-NNN.html`, snapshot del 2024–25). Modo: **testo integrale scaricato** (`raw/02/mr/tNNN.html` e `.txt`). Ogni scheda elenca le proprie fonti: tra le ricorrenti, Широкорад А.Б. *Оружие отечественного флота 1945–2000* (2001), *ЦНИИ «Гидроприбор» и его люди за 60 лет* (2003), Гусев Р. *Такова торпедная жизнь* (2003), Прошкин/Маринин in *Военный парад* 3/1997.
- **[MR-USET80]** "УСЭТ-80 / УСЭТ-80К", topic-454, creata 14.02.2011, modificata 28.01.2012.
- **[MR-TEST71]** "ТЭСТ-71 / ТЭСТ-71М", topic-453, creata 14.02.2011, modificata 04.10.2023.
- **[MR-SET65]** "СЭТ-65", topic-469, modificata 07.11.2011.
- **[MR-SET53]** "СЭТ-53 / СЭТ-53М", topic-465, modificata 27.03.2011.
- **[MR-SAET60]** "САЭТ-60 / САЭТ-60М", topic-467, modificata 23.02.2016.
- **[MR-5365K]** "53-65К", topic-460, modificata 07.11.2011.
- **[MR-6576]** "65-76 / 65-76А", topic-461, modificata 15.03.2011.
- **[MR-SHKVAL]** "ВА-111 Шквал М-5", topic-473, modificata 13.04.2016.
- **[MR-VYUGA]** "РПК-2 Вьюга, ракета 81Р – SS-N-15 STARFISH", topic-447, modificata 20.11.2018 (cita il decreto n. 617-209 del 4/8/1969).
- **[MR-VODOPAD]** "РПК-6 Водопад – SS-N-16 STALLION", topic-448, modificata 04.10.2023.
- **[MR-VETER]** "РПК-7 Ветер – SS-N-16 STALLION (1984 г.)", topic-449, modificata 30.09.2023.
- **[MR-GRANAT]** "3К-10 / С-10 Гранат – SS-N-21 SAMPSON", topic-697, modificata 10.12.2023.
- **[MR-PMR2]** "Б-VII-40 Голец / ПМК-1 / ПМР-2", topic-520, modificata 06.11.2011.
- **[MR-PMR1]** "ПМР-1", topic-521, 09.04.2011.
- **[MR-PMT1]** "ПМТ-1", topic-523, 09.04.2011.
- **[MR-PMK2]** "ПМК-2", topic-522, 09.04.2011.

**deepstorm.ru** (*Штурм глубины*, А.С. Николаев, © 2002–2024). Modo: **testo integrale scaricato** (`raw/02/ds/`).
- **[DSTORM-705]** "Проект 705 (705К)" (tabella armamento: 6×533, 20 siluri SAET-60/SET-65 o 24 (36?) mine PMR-1/PMR-2; inversione di 180° in 42 s; dottrina "salva, poi fuga"). Fonti dichiarate: Кузин/Никольский 1996, Ильин/Колесников 2002, Бережной 2001, Апальков 2003. http://deepstorm.ru/DeepStorm.files/45-92/nts/705/list.htm *([DSTORM-705] è sinonimo di [DS-705] (stessa opera).)*
- **[DSTORM-671RTM]** "Проект 671РТМ (671РТМК)" (4×533 + 2×650; 18 armi da 533, tra cui 53-65K, SET-65, M-5 Shkval e 81R; 6 siluri 65-76; fino a 36 mine "Golets"; simulatori MG-74 "Korund-2"). http://deepstorm.ru/DeepStorm.files/45-92/nts/671RTM/list.htm *([DSTORM-671RTM] è sinonimo di [DS-671RTM] (stessa opera).)*
- **[DSTORM-971]** "Проект 971" (UGST con bobina del siluro da 25 km, post-1991; da K-391 lanciatore per i mezzi di contromisura idroacustica nella sovrastruttura). http://deepstorm.ru/DeepStorm.files/45-92/nts/971/list.htm *([DSTORM-971] è sinonimo di [DS-971] (stessa opera).)*

### Wikipedia (solo fonte secondaria; estratti in testo semplice via API MediaWiki, revisione corrente al 2026-10-07)

- **[WP-RU-SLOVNAZ]** ru.wikipedia, "Словесные названия российского оружия" e sottopagine /А (rev. 2025-09-06: «Анабар» MG-14), /Б (2026-07-20: «Бросок» MG-104, «Берилл» MG-114, «Бериллий» MG-124), /К (2024-11-10: «Корунд» MG-44), /М (2025-05-26: «Магма» MG-54, «Магнетит»), /С (2024-12-10: «Спрут»), /Ш (2024-10-17: «Шлагбаум» REPS-324). Modo: testo integrale scaricato (`raw/02/wiki/ru_slovnaz_*.txt`).
- **[WP-RU-971]** ru.wikipedia, "Подводные лодки проекта 971 «Щука-Б»", rev. 2026-09-02 (MG-104 da K-391). Testo integrale scaricato. *([WP-RU-971] è sinonimo di [RUWP-971] (stessa opera).)*
- **[WP-RU-RM2]** ru.wikipedia, "РМ-2 (реактивная мина)" (adozione 1963). Testo integrale scaricato.
- **[WP-RU-GRANIT]** ru.wikipedia, "П-700 «Гранит»" (decreto n. 686-214 del 19/07/1983). Testo integrale scaricato.
- **[WP-RU-MOSKIT]** ru.wikipedia, "П-270 «Москит»", rev. 2026-09-08. Testo integrale scaricato.
- **[WP-EN-ALFA]** en.wikipedia, "Alfa-class submarine". Testo integrale scaricato. *([WP-EN-ALFA] è sinonimo di [WP-ALFA] (stessa opera).)*
- **[WP-EN-SHKVAL]** en.wikipedia, "VA-111 Shkval". Testo integrale scaricato.
- **[WP-EN-VYUGA]** en.wikipedia, "RPK-2 Vyuga" (in contrasto con [MR-VYUGA]: vedi sezione 2.5). Testo integrale scaricato.
- **[WP-EN-SUBROC]** en.wikipedia, "UUM-44 SUBROC", rev. 2026-08-30. Testo integrale scaricato.
- **[WP-EN-BAFFLES]** en.wikipedia, "Baffles (submarine)" (destinazione del redirect "Crazy Ivan"), rev. 2026-08-12. Testo integrale scaricato.

### Fonti cercate ma non ottenute / non usate

- **gao.gov** (curl bloccato da Akamai): NSIAD-89-8 (propulsione Mk 50) e NSIAD-92-191 (propulsione ADCAP) non letti.
- **navy.mil** attuale: risponde 403; usate le copie Wayback.
- **militaryrussia.ru**: sito offline, usate le copie Wayback; le schede sulle mine УДМ, АПМ e МДМ non sono state trovate.
- **Friedman** (*U.S. Submarines Since 1945*, *World Naval Weapons Systems*) e **Polmar & Moore** (*Cold War Submarines*): su Internet Archive solo in prestito controllato, **non letti**. Le affermazioni su Mk 70 MOSS, NAE e lanciatori del 688 restano "da conoscenza pregressa, non riverificato".
- **podlodka.info** "Минное оружие подводных лодок": download fallito per timeout.
- WebSearch è stato indisponibile per una parte del lavoro (limite di sessione).

---

## Parte D — Sezioni 04 (sensori) e 08 (688 Attack Sub originale)

*Frammento d'origine: `_fonti_04_08.md` (ultima modifica 15:09). Il testo è riportato com'è; le chiavi già definite in una Parte precedente sono trasformate in rimandi (↪).*


Tutte le fonti consultate il 2026-10-07. Le copie grezze (HTML, PDF, testo estratto) sono in
`ricerca/raw/04/` con il nome indicato tra parentesi quadre dopo «copia:».

Modalità di consultazione (dichiarate per ogni voce):
- **testo integrale scaricato**: ho letto il testo della fonte (o la sua scansione/OCR completa);
- **estratto/anteprima**: ho letto solo una parte (indice, tabella, riassunto);
- **citato tramite <secondaria>**: non ho visto la fonte, la riporto come la riporta un'altra;
- **da conoscenza pregressa, non riverificato**: dato che conosco ma che in questa sessione non ho potuto riscontrare in una fonte aperta. Va trattato come ipotesi da verificare.

---

### A. Fonti primarie sul gioco 688 Attack Sub (sez. 08)

**[MAN-688]** Electronic Arts, *688 Attack Sub — User Manual* (IBM/DOS), manuale di David Luoto, a cura di Z. J. Yee, © 1988 Electronic Arts; software © 1988 John Ratcliff. Pagine citate secondo la numerazione a stampa (1–73). Due copie locali: trascrizione testuale (`/percorso/della/copia/688-Attack-Sub_Manual_DOS_EN_Text-only.pdf`, priva delle figure, «Downloaded From P-80 Systems») e scansione completa a 80 pagine (`..._Scanned-PDF.pdf`). — **testo integrale scaricato** (pdftotext della trascrizione + OCR tesseract di tutte le 80 pagine della scansione; figure 5.6, 6.3 e 6.4 lette direttamente sull'immagine). Copia: [raw/04/manuale.txt], [raw/04/scan/p-NN.txt], [raw/04/scan/fig63zoom-61.png], [raw/04/scan/fig56-50.png].

**[ADD-688]** Electronic Arts, *688 Attack Sub — Addendum* (foglio aggiuntivo alla confezione DOS, codice 158403), s.d. (1989). Copia locale `688-Attack-Sub_Misc_DOS_EN_Addendum.pdf`. — **testo integrale scaricato** (OCR tesseract a 300 dpi; il layer di testo originale del PDF è illeggibile). Copia: [raw/04/add-3.txt], [raw/04/add-4.txt].

**[SID-688]** *688 Attack Sub — Sonar Identification* (file di testo che riproduce le «firme» a barre delle schede di identificazione sonar). Copia locale `688-Attack-Sub_Misc_DOS_EN_Sonar-Identification-Doc.txt`. — **testo integrale scaricato**.

**[FIL-688]** File eseguibili del gioco nella cartella locale `/percorso/della/copia/688/` (GAME.EXE datato 12/06/1989, TITLE.EXE 22/05/1989, dati 04/03/1989). — **ispezione diretta** delle sole date dei file (nessun reverse engineering).

### B. Recensioni e retrospettive (sez. 08)

**[CGW59]** Lt. H. E. Dille, «Silent Running» (recensione di *688 Attack Sub*), *Computer Gaming World* n. 59, maggio 1989, pp. 32–33. URL: https://www.cgwmuseum.org/galleries/issues/cgw_59.pdf — **testo integrale scaricato** (PDF dell'intero numero, pdftotext). Copia: [raw/04/cgw_59.txt] righe 1340–1505.

**[CGW64]** *Computer Gaming World* n. 64, ottobre 1989, «Game of the Year Awards» (688 Attack Sub tra le nomination «Simulation Game of the Year»; vince F-19 Stealth Fighter). URL: https://www.cgwmuseum.org/galleries/issues/cgw_64.pdf — **testo integrale scaricato**. Copia: [raw/04/cgw_64.txt] righe 1320–1370.

**[CGW95]** M. Evan Brooks, «The Modern Games: 1950–2000», *Computer Gaming World* n. 95, giugno 1992, p. 120 circa (voce «688»). URL: https://www.cgwmuseum.org/galleries/issues/cgw_95.pdf — **testo integrale scaricato**. Copia: [raw/04/cgw_95.txt] righe 4780–4795.

**[CGW114]** M. Evan Brooks, «War In Our Time / A Survey Of Wargames From 1950–2000», *Computer Gaming World* n. 114, gennaio 1994, pp. 194–212. — **citato tramite [WP-688]** (il PDF scaricato non ha layer di testo; non l'ho letto).

**[CMP111]** Richard Sheffield, «688 Attack Sub» (recensione), *Compute!* n. 111, agosto 1989, p. 64. URL: https://archive.org/download/1989-08-compute-magazine/Compute_Issue_111_1989_Aug_djvu.txt — **testo integrale scaricato** (OCR di archive.org). Copia: [raw/04/compute_111_djvu.txt] righe 14976–15100.

**[CMP110]** Dan Gutman, «Nine for '89», *Compute!* n. 110, luglio 1989, p. 19. — **citato tramite [WP-688]**.

**[GI15]** Mike Siggins, «Computer Games», *Games International* n. 15, giugno 1990, pp. 44–45 (voto 7/10). — **citato tramite [WP-688]**.

**[AMR]** Amiga Magazine Rack, indice delle recensioni di *688 Attack Sub* (rivista, numero, autore, pagina, voto). URL: https://amr.abime.net/amr_search.php?search=688+attack — **estratto/anteprima** (solo l'indice con i voti; le scansioni delle pagine non sono scaricabili senza browser e non le ho lette). Copia: [raw/04/amr_search.html].

**[SUBSIM-688I]** SUBSIM Review (sito curato da Neal Stevens), «Jane's 688(I) Hunter/Killer» (recensione, 1997; data 7/12/1997 secondo [WP-688I]; autore della recensione non indicato nella pagina). URL: https://www.subsim.com/ssr/688.html — **testo integrale scaricato**. Copia: [raw/04/subsim_688i.txt].

**[WP-688]** Wikipedia (en), «688 Attack Sub», revisione consultata il 2026-10-07. URL: https://en.wikipedia.org/wiki/688_Attack_Sub — **testo integrale scaricato** (fonte secondaria, usata solo per piattaforme/date e per rimandare a recensioni non lette). Copia: [raw/04/wp_688_Attack_Sub.txt], [raw/04/wp_688_raw.txt].

**[WP-688I]** Wikipedia (en), «688(I) Hunter/Killer», consultata il 2026-10-07. — **testo integrale scaricato** (secondaria). Copia: [raw/04/wp_688_I__Hunter_Killer.txt].

### C. Sensori statunitensi (sez. 04)

**[FAS-BQQ5]** Federation of American Scientists (J. Pike, R. Sherman), «AN/BQQ-5 Sonar», pagina aggiornata 12/12/1998. URL: https://man.fas.org/dod-101/sys/ship/weaps/an-bqq-5.htm — **testo integrale scaricato**. Copia: [raw/04/fas_an-bqq-5.html].

**[FAS-BSY1]** FAS, «AN/BSY-1 Integrated ASW combat system», 1998. URL: https://man.fas.org/dod-101/sys/ship/weaps/an-bsy-1.htm — **testo integrale scaricato**.

**[FAS-BSY2]** FAS, «BSY-2 Combat System», 1998–99. URL: https://man.fas.org/dod-101/sys/ship/weaps/an-bsy-2.htm — **testo integrale scaricato**.

**[FAS-BQS15]** FAS, «AN/BQS-15», 1998. URL: https://man.fas.org/dod-101/sys/ship/weaps/an-bqs-15.htm — **testo integrale scaricato**.

**[FAS-BQQ6]** FAS, «BQQ-6 Passive Sonar», 1998. URL: https://man.fas.org/dod-101/sys/ship/weaps/an-bqq-6.htm — **testo integrale scaricato**.

**[FAS-BQQ9]** FAS, «BQQ-9 TASPE Towed Array», 1998. URL: https://man.fas.org/dod-101/sys/ship/weaps/an-bqq-9.htm — **testo integrale scaricato**.

**[FAS-TB16]** FAS, «TB-16 Fat Line Towed Array», 1998. URL: https://man.fas.org/dod-101/sys/ship/weaps/tb-16.htm — **testo integrale scaricato**.

**[FAS-TB23]** FAS, «TB-23 Thin Line Towed Array», 1998. URL: https://man.fas.org/dod-101/sys/ship/weaps/tb-23.htm — **testo integrale scaricato**.

**[FAS-TB29]** FAS, «TB-29 Thin Line Towed Array», ca. 1999–2000. URL: https://man.fas.org/dod-101/sys/ship/weaps/tb-29.htm — **testo integrale scaricato**.

**[FAS-BQG5]** FAS, «AN/BQG-5 Wide Aperture Array», 1998. URL: https://man.fas.org/dod-101/sys/ship/weaps/an-bqg-5.htm — **testo integrale scaricato**.

**[FAS-BPS15]** FAS, «AN/BPS-15(H) Submarine Navigation Radar», 1998. URL: https://man.fas.org/dod-101/sys/ship/weaps/an-bps-15.htm — **testo integrale scaricato**.

**[FAS-WLY1]** FAS, «AN/WLY-1», 04/02/1999. URL: https://man.fas.org/dod-101/sys/ship/weaps/an-wly-1.htm — **testo integrale scaricato** (cita la famiglia AN/WLR-9/12/17 sui 688).

**[FAS-SSN688]** FAS, «SSN-688 Los Angeles-class», pagina con elenco «Combat Systems». URL: https://man.fas.org/dod-101/sys/ship/ssn-688.htm — **testo integrale scaricato**. Copia: [raw/04/fas_ssn-688.txt] righe 140–158. *([FAS-SSN688] è sinonimo di [FAS-688] (stessa opera).)*

**[FUN-tass]** U.S. Naval Academy, *Fundamentals of Naval Weapons Systems* (ES300), supplemento «TASS — Directivity advantage of large aperture arrays», ospitato da FAS. URL: https://man.fas.org/dod-101/navy/docs/fun/tass.htm — **testo integrale scaricato**. Nota critica: i coefficienti di assorbimento riportati (0,9 dB/m a 2 kHz; 0,01 dB/m a 50 Hz) sono incompatibili con i valori standard dell'acustica subacquea (a 2 kHz l'assorbimento è dell'ordine di 0,1 dB/**km**): la pagina va usata solo per il concetto (DI > 30 dB per array lunghi), non per i numeri di attenuazione. *([FUN-tass] è sinonimo di [FUN-TASS] (stessa opera).)*

**[FUN-ch8]** U.S. Naval Academy, *Fundamentals of Naval Weapons Systems*, cap. 8 «Principles of Underwater Sound» (equazioni del sonar, figure of merit, profilo termico). URL: https://man.fas.org/dod-101/navy/docs/fun/part08.htm — **testo integrale scaricato**. Copia: [raw/04/fun_part08.txt] (tabella FOM alle righe 1750–1765; profilo a quattro strati alle righe 570–590). *([FUN-ch8] è sinonimo di [FUN-8] (stessa opera).)*

**[GAO-90-72]** U.S. General Accounting Office, *Navy Acquisition: Cost, Schedule, and Performance of New Submarine Combat Systems*, GAO/NSIAD-90-72, gennaio 1990, 49 pp. URL: https://gao.justia.com/department-of-defense/1990/1/navy-acquisition-nsiad-90-72/NSIAD-90-72-full-report.pdf — **testo integrale scaricato** (il server gao.gov ha negato l'accesso; usato il mirror Justia). Copia: [raw/04/gao_nsiad-90-72.txt].

**[GAO-92-50]** GAO, *Navy Acquisition: Development of the AN/BSY-1 Combat System*, GAO/NSIAD-92-50 (1992); **[GAO-93-81]** GAO, *AN/BSY-1 Combat System Operational Evaluation*, GAO/NSIAD-93-81 (1993). — **citati tramite** riassunto del motore di ricerca: non letti (gao.gov ha restituito «Access Denied»). Non usati per numeri.

**[COTE-2003]** Owen R. Cote Jr., *The Third Battle: Innovation in the U.S. Navy's Silent Cold War Struggle with Soviet Submarines*, Newport Papers n. 16, Naval War College Press, 2003. URL: https://www.usni.org/sites/default/files/inline-files/newportpaper16.pdf — **testo integrale scaricato**. Copia: [raw/04/cote.txt] (BQQ-1/BQR-7: p. 30, righe 1349–1381; towed array STASS→TB-16→TB-23/29 e biblioteca delle firme: p. 49, righe 2172–2196; Alfa: p. 59, righe 2612–2627; Victor III: p. 66; Akula: p. 69, righe 2947–2995). *([COTE-2003] è sinonimo di [COTE03] (stessa opera).)*

**[POL-1981]** Norman Polmar, «The US Navy: Sonars, Part 2», *U.S. Naval Institute Proceedings*, vol. 107/9/943, settembre 1981. URL: https://www.usni.org/magazines/proceedings/1981/september/us-navy-sonars-part-2 (copia Wayback 21/12/2024) — **testo integrale scaricato** ma da OCR non corretto (il primo terzo dell'articolo è parzialmente illeggibile). Copia: [raw/04/usni_sonars2.txt].

**[POL-1979]** «The U.S. Navy: Electronic Warfare (Part 1)», *U.S. Naval Institute Proceedings*, vol. 105/10/920, ottobre 1979 (serie «The U.S. Navy»; l'autore non compare nella copia OCR: attribuzione a N. Polmar **non verificata**). URL: https://www.usni.org/magazines/proceedings/1979/october/u-s-navy-electronic-warfare-part-1 (copia Wayback 17/12/2024) — **testo integrale scaricato** (OCR). Copia: [raw/04/usni_ew1.txt] righe 22–28.

**[WWH-SON]** «Sonars (Military Weapons)», what-when-how.com (testo di un'enciclopedia di sistemi d'arma non identificata, anni '90; copia Wayback del 03/01/2023). URL: https://what-when-how.com/military-weapons/sonars-military-weapons/ — **testo integrale scaricato**; affidabilità = enciclopedia secondaria anonima, confidenza al massimo «stimato». Copia: [raw/04/wwh_sonars.txt].

**[GS-BQR7] [GS-TOWED] [GS-BQQ5]** GlobalSecurity.org, pagine «AN/BQR-7», «Towed Array Sonar Systems», «AN/BQQ-5 Sonar» (s.d.). URL: https://www.globalsecurity.org/military/systems/ship/systems/{an-bqr-7,towed-array,an-bqq-5}.htm — **testo integrale scaricato** (testi in parte ripresi da brevetti e documenti NAVSEA, senza note).

**[WP-LA]** Wikipedia (en), «Los Angeles-class submarine», sezioni «Fire control» e «Sonar», consultata il 2026-10-07. — **testo integrale scaricato** (secondaria). Copia: [raw/04/wp_Los_Angeles-class_submarine.txt] righe 31–50.

**[WP-TAS]** Wikipedia (en), «Towed array sonar», consultata il 2026-10-07. — **testo integrale scaricato** (secondaria).

**[CONO]** Dati riportati **da conoscenza pregressa, non riverificati** in questa sessione (ogni uso è marcato nel testo con [CONO]). *([CONO] è sinonimo di [CP-01] (stessa opera).)*

### D. Sensori sovietici (sez. 04)

**[GUS-GAK]** А. Гусев (A. Gusev), *Боевые корабли мира на рубеже XX–XXI веков. Часть I. Подводные лодки*, capitolo «Гидроакустические комплексы подводных лодок» (tabella dei complessi idroacustici, russi e stranieri). Editore/anno non visibili nella copia (probabilmente San Pietroburgo, Галея Принт, ca. 2000: **non verificato**). URL: https://www.e-reading.club/chapter.php/148683/132/boevye-korabli-mira-na-rubezhe-xx-xxi-vekov-chast-i-podvodnye.html — **testo integrale scaricato** (del capitolo). Copia: [raw/04/ru_ereading_gak.txt] righe 66–82.

↪ [DS-671RTM] [DS-705] [DS-971] [DS-945] [DS-641B] → voce principale: [DS-671RTM] (Parte B), [DS-705] (Parte B), [DS-971] (Parte B), [DS-945] (Parte B), [DS-641B] (Parte B). *Nota di consultazione di questa sezione:* DeepStorm.ru, schede «Проект 671РТМ и 671РТМК», «Проект 705», «Проект 971», «Проект 945», «Проект 641Б» (compilazioni di A. Krylov et al. da Kuzin–Nikol'skij 1996, Apal'kov ecc.). URL: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/{671RTM,705,971,945}/list.htm ; .../dts/641b/list.htm — **testo integrale scaricato**. Copie: [raw/04/ds_*.txt].

↪ [DS-941] [DS-667BDRM] → voce principale: [DS-941] (Parte B), [DS-667BDRM] (Parte B). *Nota di consultazione di questa sezione:* DeepStorm.ru, schede «Проект 941» e «Проект 667БДРМ». URL: https://www.deepstorm.ru/DeepStorm.files/45-92/nbrs/{941,667BDRM}/list.htm — **testo integrale scaricato**. Copie: [raw/04/ds_941.txt] (riga 246: «ГПБА «Пеламида» (установлена только на ТК-17 и ТК-20)»), [raw/04/ds_667BDRM.txt].

**[APL-671RTM]** Ю. В. Апальков, *Корабли ВМФ СССР. Том 1. Подводные лодки. Часть 2*, scheda «ПЛА пр. 671РТМ и 671РТМК» (ripubblicata su tech.wikireading.ru/4873). Anno non verificato (2003 circa). — **testo integrale scaricato** (della scheda). Copia: [raw/04/wr_4873.txt].

**[RUWP-SKAT]** Wikipedia (ru), «Скат (гидроакустический комплекс)», consultata il 2026-10-07 (cita Громковский В.В., *Гидроакустика* 2004, вып. 5). — **testo integrale scaricato** (secondaria). Copia: [raw/04/ruwp_20406.txt].

**[RUWP-971] [RUWP-671RTM] [RUWP-945] [RUWP-667BDR] [RUWP-705]** Wikipedia (ru), voci sui progetti 971, 671РТМ(К), 945, 667БДР, 705(К), consultate il 2026-10-07. — **testo integrale scaricato** (secondarie). Copie: [raw/04/ruwp_96864.txt], [ruwp_21415.txt], [ruwp_7059.txt], [ruwp_667bdr.txt], [ruwp_27296.txt]. *([RUWP-971] è sinonimo di [WP-RU-971] (stessa opera).)*

**[WP-AKULA] [WP-ALFA] [WP-VICTOR] [WP-SIERRA]** Wikipedia (en), «Akula-class submarine», «Alfa-class submarine», «Victor-class submarine», «Sierra-class submarine», consultate il 2026-10-07. — **testo integrale scaricato** (secondarie). *([WP-ALFA] è sinonimo di [WP-EN-ALFA] (stessa opera).)*

**[OP-400EM]** Концерн «Океанприбор», scheda prodotto «Гидроакустический комплекс МГК-400ЭМ» (versione d'esportazione modernizzata, anni 2000). URL: http://www.oceanpribor.ru/text/41.htm (copia Wayback 04/08/2021) — **testo integrale scaricato**. Copia: [raw/04/ru_oceanpribor_41.txt].

**[TSALKIN]** И. А. Цалкин (I. A. Tsalkin, ex vice-capo progettista di «Tukan»), «К истории становления и развития исследований аномалий морской среды», MemoClub (rivista online dei veterani di CNII «Granit»), novembre 2018. URL: https://memoclub.ru/2018/11/k-istorii-stanovleniya-i-razvitiya-issledovaniy-anomaliy-morskoy-sredyi-3/ (copia Wayback 11/07/2026) — **testo integrale scaricato**. Copia: [raw/04/ru_memoclub_anomal.txt] righe 44–95.

**[NVO-2018]** В. С. Лодкин, «Как советские подводники американцев обставили», *Независимое военное обозрение*, 27/07/2018. URL: https://nvo.ng.ru/wars/2018-07-27/12_1006_submarine.html — **testo integrale scaricato**. Copia: [raw/04/ru_nvo_aport.txt].

**[SUBCLUB-SOKS]** «Система обнаружения ПЛ по кильватерному следу», Клуб моряков-подводников (repost di un blog Yandex Zen), s.d. URL: https://submarinersclub.ru/news?id=1911 — **testo integrale scaricato**; affidabilità bassa (blog anonimo), usato solo come indizio.

**[ARMY2020-R]** «"Рубикон" подводного противостояния. Успехi и проблемы гидроакустического комплекса МГК-400», army2020.ru / warfiles.ru (ripresa di topwar.ru). — **non letto** (pagine non raggiungibili o senza testo dell'articolo); i numeri che circolano da questa fonte (scoperta dei Los Angeles a 80–200 cavi) compaiono solo in un riassunto del motore di ricerca e **non** sono usati.

---

## Parte E — Revisione incrociata (`CONTRADDIZIONI.md`)

*Frammento d'origine: `_fonti_integrazioni.md` (ultima modifica 15:22). Il testo è riportato com'è; le chiavi già definite in una Parte precedente sono trasformate in rimandi (↪).*


Compilato il 2026-10-07 durante la verifica di coerenza fra le sezioni 01–08. Tutti gli accessi sono del **2026-10-07**.
Le copie scaricate sono in `raw/03/` (contromisure) salvo diversa indicazione. Queste fonti **non sono ancora citate
nelle sezioni**: servono a documentare le voci di `CONTRADDIZIONI.md` §3 e, se il curatore lo decide, a integrare
`03_contromisure.md`.

Modi di consultazione: `testo integrale scaricato` / `estratto` / `citato tramite <fonte>` / `sintesi del motore di
ricerca, non letto` (quest'ultima modalità non è mai usata come base per un numero).

### Fonti statunitensi (ufficiali e FAS)

- **[EPA-UNDS99]** U.S. Environmental Protection Agency e Department of Defense, *Phase I Final Rule and Technical
  Development Document of Uniform National Discharge Standards (UNDS)*, EPA-842-R-99-001, Appendice A, rapporto
  "Submarine Acoustic Countermeasures Launcher Discharge: Nature of Discharge", aprile 1999, 14 pp. (fonti interne
  citate: UNDS Data Call Response, *Countermeasure Set, Acoustic (CSA) Mk 2*, NAVSEA PMS415D5, 20/02/1998; NSWC Crane
  EDD 95-068 sull'ADC Mk 3 Mod 0, maggio 1995).
  https://www.epa.gov/sites/default/files/2015-08/documents/2007_07_10_oceans_regulatory_unds_tdddocuments_appasublauncher.pdf
  — **testo integrale scaricato** (pdftotext) — `raw/03/epa_unds_sublauncher.pdf`, `.txt`.
  Contiene: lanciatori **esterni** CSA Mk 2 a generatore di gas, tubo di circa 122,3 × 7,5 in, monouso (il tubo
  esaurito si sostituisce in porto); **14 tubi per battello sui Los Angeles**, 16 sugli Ohio; installati su 20 SSN 688
  e 4 SSBN 726 alla data del rapporto; figura "CSA Mk 2 Mod 1 — SSN 688I Dihedral Configuration"; circa 60 lanci
  all'anno in tutta la flotta, per addestramento.

- **[FAS-BQR15]** Federation of American Scientists (J. Pike, R. Sherman), «AN/BQR-15», pagina aggiornata il
  12/12/1998 («Ohio-class and Lafayette-class SSBN submarines are equipped with the AN/BQR-15 passive towed array
  produced by Western Electric»). https://man.fas.org/dod-101/sys/ship/weaps/an-bqr-15.htm — **testo integrale
  scaricato** dal ricercatore della sezione 04 (`raw/04/fas_an-bqr-15.html`) ma non messo a catalogo; riletto da me.

### Studi e manuali russi

- **[KORZH10]** И. Г. Корж (I. G. Korž), *Зарождение и развитие отечественного гидроакустического противодействия
  и подавления: 40-е – 60-е годы XX века*, dissertazione di candidato in scienze tecniche, specialità VAK 07.00.10
  (storia della scienza e della tecnica), 2010, 193 pp. Pagina del catalogo dissercat con introduzione e
  conclusioni dell'autoriassunto: https://www.dissercat.com/content/zarozhdenie-i-razvitie-otechestvennogo-gidroakusticheskogo-protivodeistviya-i-podavleniya
  — **estratto** (introduzione e conclusioni pubbliche; il testo completo è a pagamento e non è stato letto) —
  `raw/03/dissercat_gpd.html`, `.txt`. L'autore dichiara di basarsi sulle collane «Судостроение» 1976–1993, sulla
  *Гидроакустическая энциклопедия* (1999) e sulla storia aziendale *ЦНИИ «Гидроприбор» и его люди за 60 лет*.
  Contiene la cronologia dei mezzi sovietici di contromisura idroacustica (ГПД): ИП 1955; MG-14 1961; MG-24 1962
  (lanciato dal dispositivo ВИПС); MG-24M 1964; MG-34 1967 e MG-34M 1970; ГИП-1; MG-44 1967; MG-54 1967; MG-64 1969;
  MG-74 e MG-84 1972; con i principi di funzionamento e alcune probabilità di successo tattico dichiarate.
- **[KRAS14]** Е. П. Красильников, П. А. Хорьков, *Системы противоторпедной защиты подводных лодок*, manuale
  universitario, СПбГМТУ, San Pietroburgo, 2014, 96 pp. Copia: https://dokumen.pub/9259fdf17b2d15ae724d046c47419748.html
  — **estratto** (l'anteprima contiene introduzione, §1.1–1.2 e parte del cap. 3; mancano §1.3–2.3, cioè proprio
  i capitoli sui dispositivi e sui lanciatori ВИПС/ДУК) — `raw/03/dokumen_ptz.html`, `.txt`. Usato per: tassonomia
  dei mezzi (disturbatori contro imitatori; imitatori «emettitori» contro «ripetitori»; separazione verticale; mezzi
  esterni alla deriva da 76–127 mm e semoventi da 124–250 mm); fisica dei rivestimenti assorbenti (spessore ≥ λ/4,
  in pratica oltre 5–10 cm; rivestimento da 100 mm: riduzione della target strength ≥ 6 dB fra 2 e 100 kHz; da
  120 mm: circa 10 dB). Fonte del 2014 su materiali in parte occidentali e moderni: per il 1985–91 vale come ordine
  di grandezza.

### Fonti divulgative e amatoriali (russe)

- **[WARFOR-GPD]** «Гидроакустическое противодействие», *Военное оружие и армии Мира* (warfor.me), articolo non
  datato (sito © 2014–). https://warfor.me/gidroakusticheskoe-protivodeystvie/ — **testo integrale scaricato** —
  `raw/03/warfor_gpd.html`, `.txt`. Affidabilità: divulgativa (`stimato` al massimo). Contiene: MG-74 «Корунд»
  adottato nel **1974** (contro il 1972 di [KORZH10]), simile a un siluro elettrico, modi «disturbo» e «esca» con
  manovra programmata; MG-104 adottato nel **1987**, più piccolo, lanciato da un **lanciatore esterno unificato УЗПУ**
  e non dal tubo lanciasiluri.
- **[KREM-MG74]** «Прибор акустического противодействия МГ-74», sito amatoriale sul progetto 671RTM
  (kremalera.narod.ru), s.d.; riproduce la scheda d'esportazione «Самоходный многоцелевой прибор гидроакустического
  противодействия МГ-74Э». http://kremalera.narod.ru/mg74.htm — **testo integrale scaricato** —
  `raw/03/kremalera_mg74.html`, `.txt`. Dati: calibro 533 mm; lunghezza senza bobina 3 900 mm; quota di corsa fino a
  250 m; lanciato dai tubi lanciasiluri normali, stivato sulle rastrelliere dei siluri; modi: disturbo mirato in
  frequenza contro i sonar, imitazione dell'eco, imitazione del rumore del sottomarino; cambio automatico di modo e
  di manovra secondo il livello dei ping ricevuti; quota e velocità impostate prima del lancio con un «ввод
  шпиндельный» meccanico.
- **[KREM-ARMS]** «Атомные лодки пр. 671РТМ. Вооружение.», stesso sito, s.d. http://kremalera.narod.ru/arms.htm —
  **testo integrale scaricato** — `raw/03/kremalera_arms.html`, `.txt`. Elenca i «имитаторы МГ-74 "Корунд"» nel carico
  da 533 mm del 671RTM.

- **[MR-MG74]** militaryrussia.ru (autore «DIMMI»), «МГ-74 Корунд» (МГ-74 / МГ-74Э «Корунд-2», МГ-74М / МГ-74МЭ
  «Корунд-2М»), topic-602, «данные на 2013 г.». Sito offline: letta la copia Wayback
  `https://web.archive.org/web/2024id_/http://militaryrussia.ru/blog/topic-602.html` — **testo integrale scaricato** —
  `raw/03/mr_t602.html`, `.txt`. Fonti dichiarate: kremalera.narod.ru (2011), sito del costruttore «Двигатель» (2009),
  russianarms.mybb.ru, museo S-189. Dati: adottato nel **1974**; 533 mm; 3 900 mm senza bobina; **950 kg**; **corsa
  fino a 15 km a non oltre 15 kn**; quota fino a 250 m; motore elettrico birotativo, batteria argento-zinco; modi
  disturbo / eco / rumore; vettori **641, 877/636, 671RTM/RTMK, 971**. Versione MG-74M(E): 17 e 22 kn, fino a 600 m
  (mod. 1, 6 000 mm, 1 050 kg).
- **[MR-MG104]** militaryrussia.ru, «МГ-104» («Бросок»), topic-485, «данные на 2011 г.». Copia Wayback
  `https://web.archive.org/web/2024id_/http://militaryrussia.ru/blog/topic-485.html` — **testo integrale scaricato** —
  `raw/03/mr_t485.html`, `.txt`. Fonte dichiarata: forum «Отвага» (2010) e foto del museo di CNII «Gidropribor».
  Dati: CNII «Gidropribor», capo progettista R. A. Lukin; adottato nel **1987**; falso bersaglio contro i siluri;
  stivato **fuori dallo scafo** nel lanciatore esterno unificato (УЗПУ); dopo un primo tratto si stacca la bobina e
  il veicolo **traina un'antenna ricevente e una emittente** (disturbo o imitazione del sottomarino); una sola
  velocità, manovra in rotta e quota; a fine missione si autodistrugge e affonda; **324 mm, 4 700 mm, 386 kg**; sui
  971 nei lanciatori «Шлагбаум» (inserto-lanciatore «СГАПД "Шлагбаум"»), oppure dai tubi lanciasiluri.

### Wikipedia (solo fonte secondaria)

- **[WP-EN-MOSS]** en.wikipedia, "Mobile submarine simulator" (voce con avviso "relies on a single source",
  ottobre 2025), consultata il 2026-10-07. https://en.wikipedia.org/wiki/Mobile_submarine_simulator — **testo
  integrale scaricato** — `raw/03/wp_moss.html`. Contiene: MOSS Mk 70 «10-inch vehicle», eco attiva e firma
  passiva simili a quelle del battello lanciatore; in servizio dal **1976**; imbarcato su **tutti gli SSBN**
  americani dagli anni '80 fino al ritiro a metà anni '90; sviluppato da Gould, poi Westinghouse.
- **[WP-RU-SLOVNAZ-E]** ru.wikipedia, «Словесные названия российского оружия/Е», revisione del 2024-11-10 (testo via
  API MediaWiki) — **testo integrale scaricato** — `raw/03/ruwp_slovnaz_E.json`, `.txt`. Voci usate: «Егорлык» —
  «дрейфующий малогабаритный комбинированный прибор гидроакустических помех МГ-34»; «Енисей» — «корабельный ГАК
  МГК-1001». Complemento di [WP-RU-SLOVNAZ] (sezione 02/03).

### Cercate e non ottenute

- militaryrussia.ru, schede «МГ-74 Корунд» (topic-602) e «МГ-104» (topic-485): **404** sul sito (in ricostruzione);
  lette dalle copie Wayback, vedi [MR-MG74] e [MR-MG104].
- dfnc.ru «МГ-104 Бросок» (adozione nel 1987 sui progetti 971, lanciatore УЗПУ, progettista R. A. Lukin): pagina
  caricata via JavaScript, testo non estratto. **Sintesi del motore di ricerca, non letto**: non usata per numeri
  (la data 1987, l'УЗПУ e il capo progettista sono comunque in [MR-MG104] e [WARFOR-GPD]).
- Navy SBIR N191-023 ("Efficient 3-inch Acoustic Device Countermeasure (ADC) Depth Control System") e il bando
  "ADC MK 2 MOD 4 & MOD 5" (lancio dei 3" dall'«Internal Countermeasure Launcher (ICL), also known as the Signal
  Ejector»): CloudFront 403 / non scaricato. **Sintesi del motore di ricerca, non letto.**
- U.S. Naval Institute *Proceedings*, "The U.S. Navy: Electronic Warfare (Part 2)", novembre 1979: challenge
  Cloudflare, non aggirata.

---

## Indice delle chiavi

Chiave → Parte in cui è definita → sezioni che la citano. «↪» indica le Parti in cui la stessa chiave compare di nuovo come rimando.

| chiave | definita in | rimandi | citata in |
|---|---|---|---|
| [ADD-688] | D |  | 08 |
| [AH83] | A |  | 06 |
| [AID79] | A |  | 06 |
| [AMR] | D |  | 08 |
| [APL-671RTM] | D |  | 04 |
| [ARMY2020-R] | D |  | — |
| [ARX2402] | A |  | 05 |
| [AW-BE12] | B |  | 01 |
| [AW-IL38] | B |  | 01 |
| [AW-TU142M] | B |  | 01 |
| [AW-xxx] | B |  | — |
| [BJ82] | A |  | 05 |
| [CALC-ABS] | A |  | — |
| [CALC-CHASE] | A |  | — |
| [CALC-CZ] | A |  | — |
| [CALC-TMA] | A |  | — |
| [CFW86] | B |  | 01, CONTRADDIZIONI |
| [CGW114] | D |  | 08 |
| [CGW59] | D |  | 08 |
| [CGW64] | D |  | 08 |
| [CGW95] | D |  | 08 |
| [CMANO-ADC] | C |  | 02, 03, CONTRADDIZIONI |
| [CMP110] | D |  | — |
| [CMP111] | D |  | 08 |
| [COLL94] | A |  | 06, 07, CONTRADDIZIONI |
| [CONO] | D |  | 04, 08 |
| [COTE-2003] | D |  | 04, 08, CONTRADDIZIONI |
| [COTE03] | A | B, C | 01, 02, 03, 06, 07, CONTRADDIZIONI |
| [CP-01] | B |  | — |
| [CW-MAN] | A | C | 03, 05, 06, 07, CONTRADDIZIONI |
| [CW-MOD] | A |  | 05, 06 |
| [CW23] | B |  | 01, CONTRADDIZIONI |
| [DS-109] | C |  | 02, CONTRADDIZIONI |
| [DS-125] | C |  | 02, CONTRADDIZIONI |
| [DS-44] | C |  | 02, CONTRADDIZIONI |
| [DS-641] | B |  | 01 |
| [DS-641B] | B | D | 01, 04, CONTRADDIZIONI |
| [DS-667BDR] | B |  | 01 |
| [DS-667BDRM] | B | D | 01, 04 |
| [DS-670] | B |  | 01 |
| [DS-670M] | B |  | 01 |
| [DS-671] | B |  | 01 |
| [DS-671RT] | B |  | 01 |
| [DS-671RTM] | B | D | 01, 04 |
| [DS-685] | B |  | 01 |
| [DS-705] | B | D | 01, 04, 08, CONTRADDIZIONI |
| [DS-84] | C |  | 02, CONTRADDIZIONI |
| [DS-877] | B |  | 01 |
| [DS-941] | B | D | 01, 04 |
| [DS-945] | B | D | 01, 04 |
| [DS-945A] | B |  | 01 |
| [DS-949A] | B |  | 01 |
| [DS-971] | B | D | 01, 04, CONTRADDIZIONI |
| [DS-xxx] | B |  | — |
| [DSTORM-671RTM] | C |  | 02, 03, CONTRADDIZIONI |
| [DSTORM-705] | C |  | 02, 03, CONTRADDIZIONI |
| [DSTORM-971] | C |  | 02, 03 |
| [EPA-UNDS99] | E |  | CONTRADDIZIONI |
| [FAS-1135] | B |  | 01 |
| [FAS-1144] | B |  | 01 |
| [FAS-1164] | B |  | 01 |
| [FAS-594] | B |  | 01 |
| [FAS-637] | B |  | 01 |
| [FAS-685] | B |  | 01, CONTRADDIZIONI |
| [FAS-688] | B | C | 01, 02, CONTRADDIZIONI |
| [FAS-705] | B |  | 01 |
| [FAS-945] | B |  | 01 |
| [FAS-956] | B |  | 01 |
| [FAS-971] | B |  | 01 |
| [FAS-BPS15] | D |  | 04 |
| [FAS-BQG5] | D |  | — |
| [FAS-BQQ5] | D |  | 04, CONTRADDIZIONI |
| [FAS-BQQ6] | D |  | 04 |
| [FAS-BQQ9] | D |  | 04 |
| [FAS-BQR15] | E |  | CONTRADDIZIONI |
| [FAS-BQS15] | D |  | 04 |
| [FAS-BSY1] | D |  | 04 |
| [FAS-BSY2] | D |  | — |
| [FAS-CG47] | B |  | 01 |
| [FAS-DD963] | B |  | 01 |
| [FAS-FFG7] | B |  | 01 |
| [FAS-IL38] | B |  | 01 |
| [FAS-KA25] | B |  | 01 |
| [FAS-MK46] | C |  | 02 |
| [FAS-MK48] | A | C | 02, 03, 07 |
| [FAS-MK50] | C |  | 02 |
| [FAS-MK57] | C |  | 02 |
| [FAS-MK67] | C |  | 02 |
| [FAS-P3] | B |  | 01 |
| [FAS-S3] | B |  | 01 |
| [FAS-SH60] | B |  | 01 |
| [FAS-SLQ25] | C |  | 03 |
| [FAS-SSN688] | D |  | 04, 08, CONTRADDIZIONI |
| [FAS-SSQ53] | B |  | 01 |
| [FAS-TB16] | D |  | 04 |
| [FAS-TB23] | D |  | 04, CONTRADDIZIONI |
| [FAS-TB29] | D |  | 04, CONTRADDIZIONI |
| [FAS-WLY1] | D |  | 04 |
| [FIL-688] | D |  | 08 |
| [FR97] | B |  | 01 |
| [FUN-11] | A | C | 03, 07, CONTRADDIZIONI |
| [FUN-15] | A |  | 07 |
| [FUN-8] | A | C | 03, 05, 07, CONTRADDIZIONI |
| [FUN-9] | A |  | 05, 06 |
| [FUN-ch8] | D |  | 04, 08, CONTRADDIZIONI |
| [FUN-SEASON] | A |  | 05 |
| [FUN-TASS] | A |  | 05, CONTRADDIZIONI |
| [FUN-tass] | D |  | 04, CONTRADDIZIONI |
| [GAO-90-72] | D |  | 04, CONTRADDIZIONI |
| [GAO-91-22BR] | C |  | 02, CONTRADDIZIONI |
| [GAO-92-50] | D |  | — |
| [GAO-95-104] | C |  | 02, 03 |
| [GI15] | D |  | — |
| [GS-BQQ5] | D |  | 04 |
| [GS-BQR7] | D |  | 04 |
| [GS-MK60] | C |  | 02 |
| [GS-TOWED] | D |  | 04 |
| [GUS-GAK] | D |  | 04, CONTRADDIZIONI |
| [JFS90] | B |  | 01 |
| [KG08] | A |  | 05 |
| [KORZH10] | E |  | CONTRADDIZIONI |
| [KRAS14] | E |  | CONTRADDIZIONI |
| [KREM-ARMS] | E |  | CONTRADDIZIONI |
| [KREM-MG74] | E |  | CONTRADDIZIONI |
| [LONG89] | A | C | 02, 03, 07 |
| [MACK81] | A |  | 05 |
| [MAN-688] | D |  | 04, 08, CONTRADDIZIONI |
| [MCK12] | A |  | 05 |
| [MILAERO-2022] | C |  | 03 |
| [MR-5365K] | C |  | 02 |
| [MR-6576] | C |  | 02 |
| [MR-GRANAT] | C |  | 02 |
| [MR-MG104] | E |  | CONTRADDIZIONI |
| [MR-MG74] | E |  | CONTRADDIZIONI |
| [MR-PMK2] | C |  | 02 |
| [MR-PMR1] | C |  | 02 |
| [MR-PMR2] | C |  | 02 |
| [MR-PMT1] | C |  | 02 |
| [MR-SAET60] | C |  | 02, 03 |
| [MR-SET53] | C |  | 02, 03 |
| [MR-SET65] | C |  | 02, 03 |
| [MR-SHKVAL] | C |  | 02 |
| [MR-TEST71] | C |  | 02, 03 |
| [MR-USET80] | C |  | 02, 03 |
| [MR-VETER] | C |  | 02 |
| [MR-VODOPAD] | C |  | 02, 03 |
| [MR-VYUGA] | C |  | 02 |
| [NA81] | A |  | — |
| [NAVOPS-11] | A |  | 06 |
| [NAVY-MINES] | C |  | 02 |
| [NAVY-MK48-2021] | C |  | 02 |
| [NAVY-MK50] | C |  | 02, CONTRADDIZIONI |
| [NAVY-MK54] | C |  | 02 |
| [NAVY-TLAM2003] | C |  | 02 |
| [NAVY-TLAM2021] | C |  | 02 |
| [NAVY-TORP2005] | C |  | 02 |
| [NLG84] | A |  | 06 |
| [NPL-ABS] | A |  | 05 |
| [NPL-SS] | A |  | 05 |
| [NTSP98] | B |  | 01 |
| [NVO-2018] | D |  | 04 |
| [NW-RU] | C |  | 02 |
| [NW-US] | C |  | 02, 03 |
| [NWA-ALLBOMBS] | C |  | 02 |
| [ONI09] | B |  | 01 |
| [ONI96] | B |  | 01, CONTRADDIZIONI |
| [ONI97] | B |  | 01 |
| [OP-400EM] | D |  | 04, 08, CONTRADDIZIONI |
| [PAT3676802] | A |  | 05 |
| [PEP89] | A | C | 03, 07 |
| [PHX84a] | A | C | 03, 07 |
| [PHX84b] | A |  | 07 |
| [PHX90] | A | C | 02, 07 |
| [PM04] | B |  | 01 |
| [POL-1979] | D |  | 04 |
| [POL-1981] | D |  | 04, 08, CONTRADDIZIONI |
| [REEVES17] | A |  | 05 |
| [RSI-1134B] | B |  | 01 |
| [RSI-1135] | B |  | 01 |
| [RSI-1144] | B |  | 01 |
| [RSI-1155] | B |  | 01 |
| [RSI-1164] | B |  | 01 |
| [RSI-956] | B |  | 01 |
| [RSI-xxx] | B |  | — |
| [RUWP-667BDR] | D |  | 04 |
| [RUWP-671RTM] | D |  | 04 |
| [RUWP-705] | D |  | — |
| [RUWP-945] | D |  | — |
| [RUWP-971] | D |  | 04 |
| [RUWP-SKAT] | D |  | 04, CONTRADDIZIONI |
| [SID-688] | D |  | 08 |
| [SM194] | A |  | 05 |
| [SMP-1985] | C |  | 02 |
| [SMP-1987] | C |  | 02 |
| [SMP-1988] | C |  | 02 |
| [SONALYSTS-SC] | A |  | 05, 06, 07 |
| [STOJ06] | A |  | 05 |
| [SUBCLUB-SOKS] | D |  | 04 |
| [SUBSIM-688I] | D |  | 08 |
| [SWOS-2.13] | A |  | 05, 06 |
| [TSALKIN] | D |  | 04 |
| [URICK83] | A |  | 05 |
| [USN-FF24] | B |  | 01 |
| [USN-FF97] | B |  | 01 |
| [WAG91] | A |  | 06 |
| [WARFOR-GPD] | E |  | CONTRADDIZIONI |
| [WP-688] | D |  | 08 |
| [WP-688I] | D |  | 08 |
| [WP-AKULA] | D |  | 04, CONTRADDIZIONI |
| [WP-ALFA] | D |  | 04, 08 |
| [WP-EN-ALFA] | C |  | 02, 03 |
| [WP-EN-BAFFLES] | C |  | 03 |
| [WP-EN-MOSS] | E |  | CONTRADDIZIONI |
| [WP-EN-SHKVAL] | C |  | 02 |
| [WP-EN-SUBROC] | C |  | 02 |
| [WP-EN-VYUGA] | C |  | 02 |
| [WP-LA] | D |  | 04 |
| [WP-RU-971] | C |  | 03 |
| [WP-RU-GRANIT] | C |  | 02 |
| [WP-RU-MOSKIT] | C |  | 02 |
| [WP-RU-RM2] | C |  | 02 |
| [WP-RU-SLOVNAZ] | C |  | 03, CONTRADDIZIONI |
| [WP-RU-SLOVNAZ-E] | E |  | CONTRADDIZIONI |
| [WP-SIERRA] | D |  | 04 |
| [WP-SWIFT] | B |  | 01 |
| [WP-TAS] | D |  | 04 |
| [WP-TRAF] | B |  | 01 |
| [WP-VICTOR] | D |  | — |
| [WWH-SON] | D |  | 04, CONTRADDIZIONI |

