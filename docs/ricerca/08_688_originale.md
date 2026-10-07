# 08 — Il *688 Attack Sub* originale (1989): che cosa modellava, che cosa semplificava, che cosa sbagliava

Sezione del catalogo di riferimento per il tributo moderno. Le chiavi tra parentesi quadre rimandano a `_fonti_04_08.md`.
Le pagine del manuale sono quelle a stampa ([MAN-688 p. NN]). Ogni voce dell'elenco finale dice se l'errore è
**documentato da un recensore**, **dichiarato dagli stessi autori** o **dedotto da me** confrontando il manuale con fonti aperte.

---

## 8.1 Scheda d'identità (verifica dell'attribuzione)

| Voce | Valore | fonte | confidenza |
|---|---|---|---|
| Titolo | *688 Attack Sub* | [MAN-688] | documentato |
| Editore | Electronic Arts, San Mateo (CA) | [MAN-688 retrocopertina], [CGW59] | documentato |
| Progettisti | John Ratcliff, Paul Grace, Randall Breen (CGW scrive «Paul Grece» per refuso) | [CGW59] (riquadro dati), [CGW64] | documentato |
| Programma | «Software © 1988 John Ratcliff» | [MAN-688 retrocopertina] | documentato |
| Produttore | Paul Grace (autore delle *Designer's Notes*) | [CGW64], [MAN-688 p. 68] | documentato |
| Grafica / musica | Michael Kosaka e Wilfredo Aguilar / Rob Hubbard | [CGW64] | documentato |
| Manuale | David Luoto, a cura di Z. J. Yee; ringraziamenti al «Naval Post-Graduate School Computer Club, Monterey» | [MAN-688 retrocopertina] | documentato |
| Uscita DOS | primavera 1989 (recensito su CGW di maggio 1989; eseguibile locale datato 12/06/1989) | [CGW59], [FIL-688] | documentato |
| Prezzo di lancio | 49,95 $ | [CGW59] | documentato |
| Altre piattaforme | Amiga 1990 (EA); Sega Mega Drive/Genesis 1991, sviluppato da MicroProse e pubblicato da Sega | [WP-688]; recensioni Amiga 1990 in [AMR] | stimato (secondaria) |
| Seguiti | *SSN-21 Seawolf* (Ratcliff e Grace, 1994); *688(I) Hunter/Killer* (sviluppato da Sonalysts per Jane's/EA, 1997), con **Paul Grace produttore esecutivo** | [WP-688], [WP-688I], [SUBSIM-688I] | stimato (secondaria) / documentato (credito citato dal recensore) |

**Correzione al brief:** il gioco non è di MicroProse né di «Microplay»: è un titolo Electronic Arts. MicroProse compare solo come sviluppatore del port Mega Drive [WP-688].

Requisiti: 384 KB liberi, DOS 2.0+, una sola unità floppy; grafica EGA, Tandy 1000, CGA, VGA/MCGA, Hercules; audio PC speaker, AdLib, Covox Speech Thing [MAN-688 pp. 2–5].

---

## 8.2 Che cosa modellava il gioco (estratto dal manuale)

### 8.2.1 Struttura e postazioni

Il gioco è organizzato attorno al **CONN** (menu principale) da cui si raggiungono otto postazioni con tasti funzione
(F2 Radio Room, F3 Status Panel, F4 Ship's Control, F5 Periscope, F6 Navigation Board, F7 Weapon Control, F8 Sonar Room, F9 CONN)
[MAN-688 pp. 6, 70]. Il manuale vanta «oltre 40 controlli» [MAN-688 p. 1]. **In giocatore singolo il gioco si ferma quando si è nel CONN**;
in partita via modem no [MAN-688 p. 8]. La compressione temporale (tasto TIME) vale circa ×2, «a seconda della velocità del computer»,
e non esiste nelle partite via modem [MAN-688 pp. 42, 44].

Le stesse postazioni esistono sull'Alfa, con grafica in **pseudo-cirillico** disattivabile (Ctrl-R) [MAN-688 p. 34].

### 8.2.2 Livelli di difficoltà

Due soli livelli, scelti solo contro il computer [MAN-688 p. 29]:
- **BEGINNER**: il giocatore è più silenzioso, il suo sonar è più potente di quello dell'avversario, il battello sopporta più danni e il periscopio alzato è meno visibile al radar.
- **STANDARD**: capacità «normali». Le partite via modem sono sempre STANDARD.

### 8.2.3 Modalità a due giocatori

Due modem Hayes-compatibili da almeno 1200 baud, oppure cavo null-modem; un giocatore «originator», l'altro «answerer»; sono giocabili via modem le missioni 1, 2, 5, 7, 8 e 9; niente pausa, niente compressione temporale; chat dalla Radio Room; resa con Ctrl-K [MAN-688 pp. 30–34]. Con il modem gli obiettivi di missione sono facoltativi («dichiarate voi gli obiettivi»). In TORPEX '89 via modem si affrontano due 688 (Los Angeles contro Dallas) **senza missili, per equilibrio** [MAN-688 p. 19].

### 8.2.4 Le dieci missioni

Il manuale dice che le missioni procedono in ordine cronologico «dalla guerra fredda alla guerra totale» e che l'azione si svolge in una porzione ridotta della mappa (il «playfield»): chi si allontana troppo chiude la missione [MAN-688 p. 18].

| # | Nome | Area | Lato 688 | Lato Alfa | Dotazione 688 / Alfa | Modem |
|---|---|---|---|---|---|---|
| 1 | TORPEX '89 | Isole Fær Øer | affondare 3 *Forrest Sherman* in disarmo in 15 min senza farsi scoprire dagli elicotteri; variante gara Los Angeles contro Dallas | — | 22 Mk 48 ADCAP, 2 Harpoon, 6 noisemaker | sì |
| 2 | Shake 'Em | Fær Øer | far perdere il contatto a un Alfa per 3 min (limite 20 min) | mantenere il contatto entro 3 min e a distanza di tiro, restando nei baffles del 688 | 8 ADCAP, 4 Harpoon, 6 NM / 8 Type 53, 4 NM (modem: 20 contro 18 siluri) | sì |
| 3 | Sub Ops | Mare di Barents | — | «mettere in sicurezza il porto» di Severomorsk scacciando un intruso; usare il ping attivo sotto 1 miglio | — / 18 Type 53, 4 NM | no |
| 4 | Mumar Cadaver | Stretto di Gibilterra | affondare 4 petroliere libiche scortate senza colpire traffico neutrale | — | 20 ADCAP, 4 Harpoon, 6 NM | no |
| 5 | Escape | Gibilterra | uscire in Atlantico senza essere tenuto in contatto | mantenere il contatto sul 688 a distanza di tiro | 20 ADCAP, 4 Harpoon, 6 NM / 18 Type 53, 4 NM | sì |
| 6 | Goulash | Bocca dell'Adriatico | scortare 6 mercantili verso nord (crisi jugoslava immaginaria) | — | 20 Mk 48, 4 Harpoon, 6 NM | no |
| 7 | Cat Walk | Passo di Kunashir | cacciare un SSBN con l'aiuto di un SH-60 che sgancia una boa marcatrice | proteggere l'SSBN senza confonderlo con il 688 | 20 Mk 48, 4 Harpoon, 6 NM / 18 Type 53, 4 NM | sì |
| 8 | Surprise Party | Margine della piattaforma celtica | scortare un gruppo NATO verso il Mare di Norvegia | attaccare da solo il gruppo | 20 Mk 48, 4 Harpoon, 6 NM / 18 Type 53, 4 NM | sì (Alfa svantaggiato) |
| 9 | Homecoming | Piattaforma celtica | difendere un convoglio per la Francia | agguato con un Oscar | 16 Mk 48, **8 Sea Lance**, 6 NM / 18 Type 53, 6 NM | sì |
| 10 | Hit and Run | Baltico | lanciare 4 Tomahawk entro 5 min contro siti nucleari, poi uscire dal Baltico | — | 20 Mk 48, 4 Tomahawk, 6 NM | no |

Fonte di tutta la tabella: [MAN-688 pp. 18–28]. La recensione di Compute! conta 16 combinazioni giocabili (10 missioni, alcune anche dal lato sovietico) e lamenta che siano poche e solo «superato/fallito», senza punteggio né promozioni [CMP111]. CGW segnala sorprese di copione non annunciate nel briefing (un Alfa posato sul fondo in TORPEX; bombardieri Backfire in Goulash) [CGW59].

### 8.2.5 Sensori e loro regole di gioco

**Contatti sonar.** Un contatto nuovo è una «X»: si conosce solo la direzione; **la X è disegnata sempre a metà strada fra il proprio battello e il bordo della mappa**, qualunque sia lo zoom. Quando l'operatore ottiene un *fix*, la X diventa una lettera, e «**le lettere segnano sempre la posizione esatta del bersaglio**»; la lettera è scura finché il contatto non è identificato, chiara dopo l'identificazione; un contatto perso e ritrovato può ricevere una lettera nuova [MAN-688 p. 38]. Il fix arriva dopo che «il sonarista ha ascoltato per qualche minuto» [MAN-688 p. 13].

**Barra dati del bersaglio.** BEARING relativo alla prua (non vero), RANGE in **miglia nautiche**, COURSE vero, SPEED in nodi, DEPTH in piedi [MAN-688 pp. 40–41]. L'esempio a p. 40 mostra distanza 27 senza unità; nella figura del quick start la distanza è 6,4 [MAN-688 p. 11].

**Sonar Room** [MAN-688 pp. 46–48]:
- *ANALYZE* (analizzatore di spettro): asse orizzontale = frequenze udibili; le navi tendono a «picchi» bassi, i siluri alti; l'identificazione positiva richiede di riconoscere la firma individuale. Le firme sono stampate su schede: il file [SID-688] le riproduce come istogrammi a 16 «bin» per 9 classi alleate e 13 sovietiche (più siluri da 450/533 mm, Mk 48, Mk 50, Spearfish), alcune con punto interrogativo nel file stesso.
- *FILTER*: BAND PASS (tutto) o HIGH PASS (solo alte frequenze: «per vedere SOLO i siluri sulla mappa»).
- *TARGETING PULSE*: il sonar attivo, «informa temporaneamente di tutto ciò che è davanti» e allerta «quasi tutto».
- *TOWED ARRAY*: vedi sotto.

**Copertura del sonar (Figura 5.6, letta sull'immagine).** Senza towed array: 100 % nel settore prodiero, 50 % ai traversi, 0–5 % a poppa. Con towed array: 100 % nell'intero emisfero prodiero, 65 % nei quadranti poppieri, 0–5 % in un cono stretto dritto a poppa [MAN-688 p. 48, fig. 5.6].

**Baffles (Figura 6.4, letta sull'immagine).** Cono cieco poppiero di **90°** senza towed array, **45°** con towed array; «anche il towed array non elimina del tutto il problema» [MAN-688 p. 59, fig. 6.4].

**Towed array** [MAN-688 pp. 15, 47–48, 53]:
- «può superare i 2000 ft»; si srotola «in qualche minuto» (un clic per filare, uno per recuperare);
- limita la velocità a **2/3 sul 688** e al **50 % sull'Alfa** (oscillazioni rumorose e resistenza);
- «non efficace nelle virate strette»;
- se si deve accelerare con l'array filato, il gioco chiede se **tagliare il cavo**; un array tagliato è perso per la missione.
- Consiglio del recensore (ex ufficiale): filarlo per il contatto iniziale e la stima del moto del bersaglio, **ritirarlo prima dell'attacco**; in virata **si perdono i contatti** e ricompaiono quando si torna in rotta stabile [CGW59].

**Contour imaging (solo 688).** Presentato come «side scanning sonar» ad alta frequenza e corto raggio che disegna in 3D il fondale a prua e ai lati, con i contatti come ovali; «**virtualmente non rilevabile — nessuna penalità per l'uso**» [MAN-688 pp. 38–39]. Sia CGW sia Compute! lo indicano come elemento centrale del gioco (nascondersi in fosse e dietro rilievi) [CGW59], [CMP111].

**Periscopio, antenna, ESM** [MAN-688 pp. 11–12, 42, 48–49]: periscopio e antenna solo a quota periscopica **20 ft**; il periscopio dà identificazione positiva e fix immediato delle navi di superficie; l'indicatore ESM misura quanto è forte il radar nemico sulla propria posizione: il radar vede periscopio, antenna e la loro scia, e «più forte il segnale, più rapida la scoperta». Con l'addendum si può tenere il periscopio alzato e guardare la mappa [ADD-688].

**Strati termici.** Il manuale spiega gradienti, canali, *shadow zones* e consiglia di stare «appena sotto lo strato» [MAN-688 pp. 54–56]; attraversare uno strato «dà all'altro un segnale più debole» [MAN-688 p. 56]. L'addendum precisa che **ci sono sempre più strati termici**, ma l'HUD mostra **solo l'ultimo attraversato** [ADD-688]. Compute! conferma che strati, gradienti e zone d'ombra sono simulati [CMP111]; CGW raccomanda di sapere sempre quanti strati ci sono e a che quota [CGW59].

**Rumore proprio e cavitazione** [MAN-688 pp. 45–46, 56]: indicatore di cavitazione (solo 688) che dipende da **accelerazione** e **profondità**; vietato STD, FULL e FLANK a 100 ft o meno; REV «estremamente rumoroso», soprattutto fra 0 e 100 ft; a velocità alta si è più udibili e si sente meno; fermare le macchine e derivare costringe l'inseguitore a riacquisire il contatto. L'autopilota non torna mai a FLANK dopo una virata (solo FULL) [MAN-688 p. 43].

**Fondale.** Profondità da 0 a «oltre 2000 ft» (oltre non serve: «pochissimi sottomarini scendono sotto i 2000 ft»); ci si può incagliare; le acque più basse si attraversano solo in superficie [MAN-688 p. 37]. Profondità automatiche: 150 ft e quota periscopica 20 ft; emersione d'emergenza rumorosa [MAN-688 p. 45].

### 8.2.6 Ausili alla TMA (per incrocio con 06_tma.md)

Il gioco **non fa fare la TMA al giocatore**: la soluzione (distanza, rotta, velocità, profondità) la produce il «sonarista» dopo un tempo non specificato, e da quel momento la lettera sulla mappa è nella posizione esatta [MAN-688 pp. 13, 38]. Gli ausili disponibili [MAN-688 p. 43], [ADD-688]:
- **ALL TRACKS / TARGET TRACK**: la scia di punti di tutti i contatti o del solo bersaglio (punti fitti = bersaglio lento);
- **PLOT PROJECTION + TIME PROJECTION**: si inseriscono i minuti e il gioco disegna un rombo chiaro (posizione futura propria) e uno scuro (del bersaglio) a rotta e velocità costanti; si può mandare un siluro verso il punto proiettato;
- **WAYPOINT** (fino a 9) con autopilota che rallenta per virare;
- la X «a metà schermo» è di fatto una **linea di rilevamento** visualizzata come punto.

Non ci sono: diagramma tempo-rilevamento (waterfall), dot stack, metodo di Ekelund, stima della distanza da variazione di rilevamento, ambiguità destra/sinistra del towed array, soluzioni alternative o qualità della soluzione. Per il tributo questo è il punto più importante da correggere (vedi 8.4).

### 8.2.7 Armi e regole di impiego (per incrocio con 07_dottrina_siluri.md)

**Tubi** [MAN-688 pp. 14, 49–50]: il 688 ha nel gioco **4 tubi lanciasiluri «a prua» + 2 tubi ausiliari «a centro nave» per i noisemaker**; l'Alfa ha 6 tubi prodieri e il sesto lancia noisemaker finché ce ne sono, poi siluri. I siluri non stanno armati nei tubi: ogni tubo va selezionato e caricato; l'icona cambia colore quando è pronto. I missili del Los Angeles partono dai tubi lanciasiluri (il manuale nota che gli scafi più recenti hanno i lanciatori verticali) [MAN-688 p. 50].

**Guida a filo e comandi** [MAN-688 pp. 44, 50–51]:
- Il siluro lanciato punta al bersaglio **selezionato al momento del lancio**; dopo il lancio si può selezionare un altro contatto senza cambiare quello del siluro.
- **Filo di 7,5 nm**: tagliato il filo il siluro non è più controllabile. Un siluro col filo «cerca il bersaglio finché esplode o finisce il carburante».
- Comandi su siluro selezionato: **SEARCH** (ricerca attiva con schema di ricerca e ping), **DIRECT** (lo si manda a un punto della mappa: arrivato lì, se non si ordina SEARCH, «deriva finché finisce il carburante»), **DETONATE** (autodistruzione; il siluro fa danni anche senza impatto diretto).
- Nessuna impostazione di distanza di abilitazione, quota/soffitto/fondo, velocità di corsa, modo passivo/attivo separato, angolo di ricerca. Il manuale parla di siluri «a due velocità» solo nelle note dei progettisti, come motivo per accorciare le scale [MAN-688 p. 68].
- Il proprio siluro può perdere il bersaglio e **agganciare il lanciatore o un'unità amica** [MAN-688 p. 51].
- Prestazioni del computer: su macchine lente il numero di siluri in acqua contemporaneamente può essere limitato a **due** [ADD-688].

**Tabella siluri del gioco** [MAN-688 pp. 61–63] (tutti con portata uguale per scelta dichiarata):

| Arma (come nel gioco) | Nazione | Portata nel gioco | Velocità nel gioco | Carica nel gioco | Nota |
|---|---|---|---|---|---|
| Mk 48 ADCAP | USA | 10 nm | 52,5 kt | 267 kg | arma del 688 |
| Mk 46 | USA | 10 nm | 40 kt | 44 kg | navi, aerei, ASROC |
| Mk 50 ALWT | USA | 10 nm | 40 kt | 45 kg «directed energy» | — |
| «Mk 32» | USA/vari | 10 nm | 40 kt | 150 kg | elencato come siluro: vedi errori |
| Spearfish | UK | 10 nm | 60 kt | «directed energy» | Trafalgar |
| Type 40 (406 mm) | URSS | 10 nm | «Unknown» | 100 kg | — |
| Type 53 (533 mm) | URSS | 10 nm | 47,5 kt | 400 kg | arma dell'Alfa |
| Type 65 (660 mm) | URSS | 10 nm | 47,5 kt | 900 kg | — |

Velocità e cariche reali vanno prese dalla sezione armi del catalogo, non da qui.

**Evasione dai siluri (Figura 6.3, letta sull'immagine)** [MAN-688 pp. 58–59]: il cono del sensore del siluro è descritto come «forse solo 20° davanti a sé»; i siluri hanno un raggio di virata limitato («oltre 45 kt»); tre zone concentriche ma spostate verso prua, con distanze indicative in nm:

| Zona | a prua | al traverso | a poppa | Manovra consigliata |
|---|---|---|---|---|
| A (lunga) | 15 | 9 | 6 | virare e scappare: «basta stargli davanti qualche miglio e resta senza carburante» |
| B (media) | 10 | 6 | 4 | portarsi a 90° dalla rotta del siluro, per uscire dal cono |
| C (corta) | 5 | 3 | 2 | portarsi a 150° o 210° dalla rotta del siluro, per farlo «sovracorrere» |

I noisemaker imitano il rumore del battello e possono ingannare sottomarini e siluri; in tempo di pace lanciarli è rischioso perché l'altro non distingue un noisemaker da un siluro [MAN-688 p. 57].

**Missili** [MAN-688 p. 64]: Harpoon 130 km, Mach 0,9; Tomahawk 460 km antinave / 2600 km attacco terrestre; **entrambi solo a quota periscopica e con identificazione positiva del bersaglio**; Sea Lance con dati «SECRET» e «test previsti per luglio 1989»; SS-N-14 55 km; ASROC 2–10 km.

**Danni** [MAN-688 p. 51]: i sistemi danneggiati restano danneggiati per tutta la missione (nessuna riparazione); es. «motori al 75 %» = velocità massima al 75 %. L'Alfa non ha lo schema dei danni.

### 8.2.8 Capacità dell'Alfa e degli altri battelli nel gioco

Tabella dei sottomarini del gioco [MAN-688 pp. 60–61]; il manuale avverte che alcune specifiche «sono state alterate per bilanciare il gioco, in particolare la profondità massima di certi sottomarini sovietici», e il progettista rifiuta in anticipo telefonate sulle velocità massime («Jane's ci sembra ridicolmente bassa, altre fonti ci farebbero trainare sciatori nautici») [MAN-688 pp. 60, 69].

| Classe | Tipo | V max (gioco) | Prof. max (gioco) | Rumore (gioco) | Armi (gioco) |
|---|---|---|---|---|---|
| Akula | SSN | 45 kt | 1800 ft | sopra la media | Type 53, Type 65, SS-N-16 |
| **Alfa** | SSN | **42 kt** | **1800 ft** | **sopra la media** | Type 53 |
| Charlie II | SSGN | 24 kt | 1800 ft | media | Type 53, SS-N-9 |
| Foxtrot | SS | 16 kt | 800 ft | basso | Type 40, Type 53 |
| Kilo | SS | 16 kt | 1200 ft | molto basso | Type 53 |
| **Los Angeles** | SSN | **37 kt** | **1500 ft** | **basso** | Mk 48 ADCAP, Harpoon, Tomahawk, Sea Lance |
| Oscar | SSGN | 35 kt | 1800 ft | media | Type 53, Type 65, SS-N-16, SS-N-19 |
| Trafalgar | SSN | 32 kt | 1500 ft | basso | Spearfish, Harpoon |
| Typhoon | SSBN | 24 kt | 1800 ft | sopra la media | Type 53, Type 65, SA-N-5, SS-N-16 |
| Victor | SSN | 32 kt | 1800 ft | sotto la media | Type 53, Type 65 |

Differenze di dotazione dell'Alfa nel gioco [MAN-688 pp. 36, 39–40, 45, 48–49, 51]: niente contour imaging, niente indicatore di cavitazione, niente schema danni, comandi mappa ridotti (zoom UP/DN, CONTOUR, HUD); **ha un towed array** (con limite al 50 % della velocità); 6 tubi di cui uno per noisemaker; solo Type 53; meno noisemaker (4) e un carico tipico di 18 siluri. Compute! riassume: l'Alfa è più veloce, il 688 ha più armi e quindi un netto vantaggio [CMP111]; secondo Wikipedia l'Alfa ha nel gioco «velocità sostenute più alte» [WP-688].

Confronto con le fonti aperte sull'Alfa reale (progetto 705/705K):

| Parametro | Gioco | Fonti aperte | fonte | confidenza |
|---|---|---|---|---|
| Velocità max | 42 kt | 41 kt dimostrati (Cote); 41 kt di tabella, «in realtà non oltre 39 kt» (nota DeepStorm) | [COTE-2003], [DS-705] | stimato |
| Profondità | 1800 ft (≈ 549 m) | operativa «più vicina a 1100 ft» (Cote); di lavoro 320 (350?) m, limite 400 (420?) m (DeepStorm) | [COTE-2003], [DS-705] | stimato |
| Siluri | 18 Type 53 | 6 tubi da 533 mm, 20 siluri (SAET-60, SET-65) o mine | [DS-705] | stimato |
| Towed array | sì | nessuna antenna rimorchiata nell'elenco del materiale radioelettronico | [DS-705] | stimato (assenza in un elenco, non prova formale) |
| Sonar | — | GAK «Okean» nel testo; «Енисей» (МГК-1001) in tabella e disegno — fonti incoerenti | [DS-705], [WP-ALFA] | stimato |

---

## 8.3 Che cosa ne dissero i recensori

**Computer Gaming World, maggio 1989 (Lt. H. E. Dille, «Silent Running»)** [CGW59]. Recensione entusiasta scritta da un ufficiale; apre con un racconto in prima persona di un attacco passivo a 6,5 nm sotto lo strato. Lodi: interfaccia a icone facile, grafica (soprattutto il contour imaging in EGA/VGA), missioni varie con sorprese di copione, modem. Critiche, raccolte nel paragrafo «Down Doppler»: chiamarlo simulatore è «fuorviante» per (1) i troppi danni sopportabili dal giocatore, **sei colpi per affondare contro due per i nemici**; (2) la facilità di puntamento; (3) **portata di 10 nm per tutti i siluri**; (4) la semplificazione di «quasi tutti gli aspetti» della guerra subacquea. Riconosce che i progettisti hanno scelto consapevolmente velocità ed eccitazione. Il giudizio finale lo definisce un «quantum leap in quality for naval-oriented wargaming» e lo candida a gioco dell'anno. Fra i consigli: towed array per il contatto iniziale e da ritirare prima dell'attacco; si perdono contatti virando con l'array; «pulire» periodicamente i baffles invertendo la rotta; nel gioco l'**Akula** è «più veloce, più profondo e più silenzioso» del Los Angeles.

**Computer Gaming World, ottobre 1989** [CGW64]: tra i candidati al premio «Simulation Game of the Year» (vince *F-19 Stealth Fighter*).

**Compute!, agosto 1989 (Richard Sheffield)** [CMP111]. Lodi alla grafica (foto digitalizzate dell'equipaggio) e al modem, che considera una possibile novità per tutto il settore. Critiche: tastiera scomoda, manuale povero di tattica (con il sospetto che il resto sia nella *688 Survival Guide* venduta a parte a 12,95 $), solo dieci missioni, esito solo superato/fallito. Conferma che strati, gradienti e zone d'ombra sono simulati e che **i siluri sono stati portati da 40 a 10 miglia** per velocizzare il gioco, «buttando dalla finestra» molte tattiche reali.

**Computer Gaming World, giugno 1992 (M. Evan Brooks, rassegna dei wargame moderni)** [CGW95]. Voto **2 stelle su 5**; il recensore dice di non aver mai capito perché fosse così popolare; il gioco **somiglia più alla guerra sottomarina della seconda guerra mondiale che a quella moderna**, e l'enfasi sull'**acquisizione del bersaglio al periscopio** è irrealistica. Secondo [WP-688] la rassegna del gennaio 1994 ripete il giudizio [CGW114, non letto].

**Riviste europee (solo voti, da indice)** [AMR]: DOS — Commodore Computing International (ott. 1989) 94 %, ACE 22 (lug. 1989) 847/1000; Amiga 1990 — The Games Machine 90 %, Zero 88 %, Amiga Format 86 %, CU Amiga 86 %, Amiga Magazine (Italia) 85 %, Amiga Computing 82 %, Joystick 78 %, Amiga Joker 78 %, ACE 765/1000, Amiga Action 59 %; riedizioni 1993 — Amiga Force 83 %, Amiga Action 80 %, Amiga Format 73 %, Amiga Power 58 %. I testi non li ho letti: le scansioni non sono scaricabili senza browser. *Games International* gli dà 7/10 (tramite [WP-688]).

**Sintesi:** all'uscita fu accolto come il miglior gioco navale del momento, perdonandogli la semplificazione; a pochi anni di distanza un recensore di wargame lo giudicava «da seconda guerra mondiale».

**Il confronto con *688(I) Hunter/Killer* (1997).** Il seguito per realismo fu sviluppato da Sonalysts, che lavorava già a simulazioni per la Difesa USA e fece revisionare il gioco dal Pentagono [WP-688I]; Paul Grace ne fu il produttore esecutivo [SUBSIM-688I]. La recensione di SUBSIM (voto 90, realismo 17/20) elenca proprio ciò che il 1989 non aveva [SUBSIM-688I]:
- tre presentazioni sonar passive distinte: **broadband** (scoperta e designazione dei contatti), **narrowband** (identificazione), **DEMON** (velocità dalla modulazione del rumore dell'elica);
- una postazione di **TMA** in cui il giocatore «costruisce» la soluzione con righello e tacche, alimentata da sonar, radar, ESM e periscopio;
- **nessuna mappa con simboli in tempo reale** che dia poteri «divini»: non si punta un SSN con un clic;
- albero ESM che dà rilevamento e tipo degli emettitori radar;
- multigiocatore in rete fino a 8, modem, seriale; editor di missioni.
Difetti segnalati: missioni «in scatola» con comportamenti identici a ogni partita, IA nemica senza vera tattica, e un visore 3D che permette di guidare a vista il siluro (scorretto in multigiocatore). È la misura di quanto il 1989 avesse spostato la TMA fuori dalle mani del giocatore (vedi 8.2.6).

---

## 8.4 Elenco delle semplificazioni e degli errori

Legenda della colonna «tipo»: **R** = documentato da un recensore d'epoca; **A** = dichiarato dagli autori (manuale/note dei progettisti); **D** = dedotto da me dal manuale confrontato con fonti aperte (va verificato da chi tiene le sezioni sulle piattaforme e sulle armi); **D-CONO** = dedotto da conoscenza pregressa non riverificata.

| # | Semplificazione / errore | Che cosa fa il gioco | Realtà o problema | fonte | tipo |
|---|---|---|---|---|---|
| 1 | Portata unica dei siluri | tutti i siluri, USA e URSS, 10 nm | i progettisti citano siluri «a due velocità» fino a 40 miglia; Compute! «da 40 a 10 miglia» | [MAN-688 pp. 58, 61, 68], [CMP111], [CGW59] | A + R |
| 2 | Scala compressa | «distanza di combattimento» dell'ordine di 15 miglia; molte armi con portata sbagliata | voluto per avere tempi di corsa dei siluri di uno o due minuti reali | [MAN-688 pp. 68–69] | A |
| 3 | Bersaglio esatto dopo il fix | la lettera indica «sempre la posizione esatta» | nessuna incertezza di soluzione: la TMA, cuore del mestiere, scompare | [MAN-688 p. 38]; «facilità di puntamento» in [CGW59] | R + D |
| 4 | Linea di rilevamento come punto | la X compare a metà schermo | trasmette l'idea sbagliata di una distanza; in realtà è una linea | [MAN-688 p. 38] | D |
| 5 | Classificazione | firma riconosciuta a occhio su un istogramma a 16 barre, confrontandola con le schede | la classificazione reale si fa sulle righe a banda stretta (LOFAR); la biblioteca delle firme sovietiche era un patrimonio d'intelligence | [MAN-688 pp. 46–47], [SID-688], [COTE-2003 p. 49] | D |
| 6 | Periscopio come sensore principale | identificazione e fix immediati; necessario per Harpoon/Tomahawk | «enfasi irrealistica sull'acquisizione al periscopio» | [CGW95], [MAN-688 pp. 11–12, 64] | R |
| 7 | Danni asimmetrici | il giocatore incassa ~6 colpi, i nemici 2; BEGINNER ne regge ancora di più | un siluro pesante a segno è in genere decisivo | [CGW59], [MAN-688 p. 29] | R |
| 8 | Contour imaging senza costi | sonar ad alta frequenza «non rilevabile, nessuna penalità» | ogni sonar attivo è intercettabile; i ricevitori sovietici di intercettazione coprono fino a 60 kHz (nella versione moderna MGK-400EM) | [MAN-688 pp. 38–39], [OP-400EM] | D |
| 9 | Towed array sull'Alfa | l'Alfa fila un towed array (limite 50 %) | nell'elenco del materiale del progetto 705 non c'è antenna rimorchiata | [MAN-688 p. 48], [DS-705] | D |
| 10 | Alfa più profondo del reale | 1800 ft | ~1100 ft operativi (Cote); 320–400 m (DeepStorm); gli autori ammettono di aver alterato le profondità sovietiche | [MAN-688 p. 60], [COTE-2003], [DS-705] | A + D |
| 11 | Akula «super» | 45 kt, 1800 ft; nel gioco più veloce e profondo del 688 | valori da verificare nella sezione piattaforme; Cote attesta solo che l'Akula si avvicinò alla parità acustica | [MAN-688 p. 60], [CGW59], [COTE-2003 p. 69] | D |
| 12 | Strati termici semplificati | più strati, ma l'HUD mostra solo l'ultimo attraversato; attraversarlo indebolisce il segnale | niente zone di convergenza né percorsi sul fondo (alla scala di 15 miglia non servirebbero); descrizione fisica approssimata (vedi #13) | [ADD-688], [MAN-688 pp. 54–56], [FUN-ch8] | D |
| 13 | Errore di oceanografia nel manuale | «termoclino permanente» = «strato sottile vicino al fondo»; la rifrazione è attribuita alla «densità» | il termoclino permanente sta sotto quello stagionale; sotto c'è lo strato isotermo profondo a ~4 °C; la grandezza che conta è la velocità del suono (soprattutto la temperatura) | [MAN-688 p. 55], [FUN-ch8 §8.4] | D |
| 14 | Posizione dei tubi | 4 tubi «a prua» + 2 tubi ausiliari «a centro nave» per i noisemaker | sul 688 la prua è occupata dalla sfera sonar e i 4 tubi sono a centro nave e angolati; i decoy non usano tubi ausiliari a centro nave | [MAN-688 p. 49], [FAS-SSN688] (4 tubi), [CONO] | D-CONO |
| 15 | «Mk 32» elencato come siluro | 40 kt, 150 kg, 10 nm | Mk 32 è il lanciasiluri di bordo (Surface Vessel Torpedo Tubes) per Mk 46/Mk 50, non un siluro | [MAN-688 p. 62], [CONO] | D-CONO |
| 16 | Missili solo a quota periscopica | Harpoon e Tomahawk richiedono quota periscopica e identificazione positiva | le versioni per sottomarini si lanciano in immersione, dai tubi o dai lanciatori verticali | [MAN-688 p. 64], [CONO] | D-CONO |
| 17 | Sea Lance in servizio | 8 Sea Lance in Homecoming, dati «SECRET» | nel 1989 era in sviluppo; il programma fu poi cancellato (mai in servizio) | [MAN-688 pp. 26, 64], [CONO] | D-CONO |
| 18 | Niente impostazioni del siluro | solo SEARCH, DIRECT, DETONATE; filo 7,5 nm | nessuna distanza di abilitazione, quota, soffitto/fondo, velocità, modo passivo/attivo | [MAN-688 pp. 50–51] | D |
| 19 | Sonar attivo onnisciente | un ping mostra «tutto ciò che è davanti» | nessuna modellazione di fascio, riverberazione, ecc.; la portata attiva dipende dal livello di sorgente e dall'ambiente (vedi 04) | [MAN-688 p. 47], [POL-1981] | D |
| 20 | Divieto di velocità sotto 100 ft | STD/FULL/FLANK impossibili sopra i 100 ft | regola di gioco al posto di un modello di cavitazione legato alla velocità | [MAN-688 p. 46] | D |
| 21 | Velocità di alcune navi | Slava 12 kt, Forrest Sherman 20 kt, Iowa 35 kt | valori anomali (Slava e Sherman molto sottostimati): verificare nella sezione navi | [MAN-688 pp. 65–67], [CONO] | D-CONO |
| 22 | Armi preassegnate e niente armi nucleari | dotazione fissa per missione, niente armi nucleari | dichiarato per bilanciamento | [MAN-688 p. 69] | A |
| 23 | Compressione temporale debole | ×2 circa; playfield ristretto | niente lunghi trasferimenti né pattugliamenti | [MAN-688 pp. 18, 42] | A |
| 24 | Il ping «warble» | il suono del sonar moderno è un «warble» più che un «ping» (semplificazione ammessa) | — | [MAN-688 p. 69] | A |
| 25 | Missioni poche e solo superato/fallito | 10 missioni, niente punteggio né carriera | — | [CMP111] | R |
| 26 | Siluri limitati dalla CPU | sulle macchine lente al massimo 2 siluri in acqua | limite tecnico, non realistico | [ADD-688] | A |

**Che cosa il gioco faceva bene e conviene tenere** (giudizio mio, sostenuto dalle recensioni): stazioni separate con il CONN che mette in pausa; strati termici come risorsa tattica [CMP111], [CGW59]; towed array con costi veri (velocità, tempo per filarlo, perdita in virata, taglio del cavo) [MAN-688 pp. 47–48], [CGW59]; baffles espliciti con contromanovra di «clear baffles» [CGW59]; cavitazione legata a accelerazione e profondità [MAN-688 p. 45]; rischio di escalation in tempo di pace (ping o noisemaker scambiati per un attacco) [MAN-688 pp. 21, 57]; ESM e rischio di scoperta al periscopio [MAN-688 pp. 48–49]; filo del siluro, DIRECT verso il punto proiettato, rischio di autoaggancio [MAN-688 pp. 50–51]; missioni asimmetriche giocabili da entrambi i lati e via modem.

---

## 8.5 Implicazioni per il tributo

1. **Rimettere la TMA al centro** (correzioni #3–#4): rilevamenti con rumore (σ per sensore, vedi 04 §4.6), soluzione costruita dal giocatore o da un «assistente» con qualità dichiarata, lettere sulla mappa sostituite da ellissi d'incertezza. Gli ausili del 1989 (proiezione del moto, scie) restano, ma applicati alla soluzione **stimata**.
2. **Scala:** il compromesso dei 15 miglia era dovuto a CPU e tempi di gioco. Con compressione temporale vera (×1…×32) si può tenere la portata reale dei siluri e scontri a distanze reali; se si vuole un modo «arcade» per due giocatori, lo si dichiari come preset.
3. **Siluri:** aggiungere impostazioni minime (distanza di abilitazione, quota di ricerca, velocità o due velocità, modo attivo/passivo) mantenendo i comandi intuitivi del 1989 (DIRECT verso un punto, SEARCH, DETONATE, guida a filo con lunghezza credibile).
4. **Periscopio** utile ma non decisivo: identificazione delle navi di superficie, rischio ESM/radar crescente col tempo d'esposizione; niente fix «gratuito» sui sottomarini.
5. **Correggere Alfa e Akula** con i valori delle sezioni piattaforme (niente towed array sull'Alfa; profondità reali) e mantenere l'asimmetria del 1989 (Alfa veloce e rumoroso, 688 silenzioso e meglio equipaggiato), che i recensori apprezzavano.
6. **Danni simmetrici e realistici** (un colpo pesante a segno è di norma decisivo); la tolleranza ai danni maggiorata eventualmente solo come aiuto del livello principiante, dichiarato.
7. **Contour imaging → BQS-15 / MIDAS**: utile per fondali e ghiaccio ma intercettabile (vedi 04).
8. **Mantenere** il multigiocatore a due con obiettivi asimmetrici e il ruolo del «tempo di pace» (regole d'ingaggio, rischio di escalation), che erano l'idea più originale del gioco.
