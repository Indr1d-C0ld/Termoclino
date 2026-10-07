# Fonti — sezione 01 (Piattaforme)

Frammento bibliografico da fondere in `FONTI.md`. Data di accesso per tutte le voci: **2026-10-07**.
Copie locali in `raw/01/` (nome file indicato tra parentesi).

Legenda della modalità di consultazione:
- **testo integrale scaricato**: pagina o documento letti per intero (HTML/PDF/OCR scaricati con curl);
- **estratto/anteprima**: solo frammenti di testo (es. ricerca full-text di archive.org su libri in prestito
  controllato, che restituisce brevi estratti senza numero di pagina);
- **citato tramite <fonte>**: documento non visto direttamente;
- **da conoscenza pregressa, non riverificato**.

---

## Fonti ufficiali / primarie

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

## Studi e opere di riferimento occidentali

**[COTE03]** Owen R. Cote Jr. *The Third Battle: Innovation in the U.S. Navy's Silent Cold War Struggle with
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

**[FAS-688]** Federation of American Scientists, Military Analysis Network. *SSN-688 Los Angeles-class*.
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

## Fonti russe specializzate

**[DS-xxx]** A.S. Nikolaev (curatore). *Штурм глубины / Глубинный шторм* — schede per progetto, "Подводные
лодки. Проект …", sezioni "Состав проекта", "История проекта", "Тактико-технические данные". deepstorm.ru,
© 2002–2024. Le schede citano a loro volta: V.P. Kuzin, V.I. Nikol'skij, *Военно-Морской Флот СССР 1945–1991*
(1996); Ju.V. Apal'kov, *Подводные лодки* (2002–2003); S.S. Berežnoj, *Атомные подводные лодки ВМФ СССР и
России* (2001); V.E. Il'in, A.I. Kolesnikov, *Подводные лодки России* (2002). Tutte le schede: testo integrale
scaricato (cp1251 → UTF-8) (`ds_*.txt`).
- **[DS-705]** Проекты 705 и 705К «Лира»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/705/list.htm
- **[DS-671]** Проект 671 «Ёрш»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/671/list.htm
- **[DS-671RT]** Проект 671РТ «Сёмга»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/671RT/list.htm
- **[DS-671RTM]** Проект 671РТМ(К) «Щука»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/671RTM/list.htm
- **[DS-971]** Проект 971 «Щука-Б»: https://www.deepstorm.ru/DeepStorm.files/45-92/nts/971/list.htm
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

## Conoscenza pregressa non riverificata

**[CP-01]** Elementi indicati nel testo come "da conoscenza pregressa, non riverificato":
- sonar MGK-400 "Rubikon" su Kilo e Tango;
- profondità (60/1 000 ft) e durate (1/3/8 h) della SSQ-41B;
- rientro di K-43 (INS *Chakra*) dall'India nel 1991 (la data di consegna, 5/1/1988, è invece in [DS-670]);
- VL-ASROC operativo dal 1993;
- date di commissione della classe Oliver Hazard Perry (1977–1989), salvo il totale 51 [FAS-FFG7] e il conteggio
  1986 [CFW86];
- nome NATO delle sigle sonar sovietiche non citate esplicitamente dalle fonti.
Non sono stati usati come base per numeri in tabella senza marcatura esplicita.

## Fonti cercate ma non ottenute

- Friedman, *U.S. Submarines Since 1945* (1994): non trovato in copia consultabile.
- Jane's Fighting Ships 1986–87 e 1988–89 (archive.org: `janesfightingshi86moor`, `janesfightingshi8990shar`):
  presenti solo in prestito controllato, non interrogati; il 1990–91 è stato interrogato solo in minima parte ([JFS90]). **Prossimo passo consigliato**: ricerca full-text come per [PM04].
- Polmar, *Guide to the Soviet Navy* (4ª ed., 1986, `guidetosovietnav0000unse`): in prestito controllato, non interrogato.
- CIA FOIA Reading Room (NIE/SNIE sui sottomarini sovietici): non consultata in questa tornata (limite delle ricerche web).
- Pagine FAS sul Victor III, sull'Oscar II, sull'Udaloy e sul Kara: non trovate nella Wayback Machine con gli URL provati (671tm, 671rt, 949a, 1155, 1134b, 670); potrebbero esistere con altri nomi di file.
