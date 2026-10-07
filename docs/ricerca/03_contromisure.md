# 3 — CONTROMISURE ED EVASIONE (1985–1991): catalogo con fonti

Esche, disturbatori e manovre con cui un sottomarino del 1985–91 si difende da un siluro acustico. La sezione completa `07_dottrina_siluri.md` §6, che tratta l'evasione dal punto di vista dell'impiego dei siluri: qui il fuoco è sui **dispositivi** (USA e URSS), sulle **manovre** e sui **parametri nozionali** per il gioco.

## 3.0 Convenzioni

- Chiavi di fonte tra parentesi quadre (es. `[FUN-11]`, `[PEP89]`): ognuna risolve a una voce in `_fonti_02_03.md`. Le chiavi `FUN-8`, `PEP89`, `PHX84a`, `COTE03` e `CW-MAN` sono già usate dalle sezioni sorelle: si mantengono identiche.
- `confidenza`: `documentato` / `stimato` / `nozionale`, con lo stesso significato della sezione 2.
- **Avvertenza di fondo.** Prestazioni acustiche, durate e livelli d'emissione delle contromisure reali sono **classificati** da entrambe le parti. Le fonti aperte verificate danno solo **principi di funzionamento, nomi, piattaforme e (a volte) date**. Quasi tutti i numeri di comportamento di questa sezione sono quindi `nozionale`, e sono dichiarati tali.

---

## 3.1 Principi documentati (validi per entrambe le parti)

| Principio | Fonte | Confidenza |
|---|---|---|
| Il primo passo è l'**allarme**: i ricevitori d'intercettazione acustica danno frequenza e azimut fin dal primo ping, e i siluri hanno la massima priorità, "per avere il tempo di applicare le tattiche di evasione" | [FUN-11 §11.3.1] | documentato |
| Esche rumorose (noisemaker) trainate o lanciate funzionano quando la geometria crea **ampia separazione in azimut** tra esca e bersaglio | [FUN-11 §11.3.2] | documentato |
| I sottomarini impiegano "**piccole esche mobili simili a siluri**" con transponder che restituiscono un'eco realistica ai sonar attivi; grazie al rumore che producono, simulano "in parte" la firma passiva di un sottomarino | [FUN-11 §11.3.2] | documentato |
| Un **disturbatore acustico** a bordo di un sottomarino deve avere un livello di sorgente di **almeno 200 dB re 1 µPa** per essere efficace contro i sonar attivi moderni | [FUN-11 §11.3.2] | documentato |
| L'esca chimica tedesca (Pillenwerfer) non produceva effetto **Doppler**: un operatore addestrato la distingueva dal sottomarino. Da qui il ruolo della discriminazione Doppler | [FUN-11 §11.3] | documentato |
| Le **bolle d'aria** mascherano o creano falsi bersagli (principio del Prairie/Masker delle navi di superficie) | [FUN-11 §11.3.2] | documentato |
| Esca **ripetitrice** trainata (AN/SLQ-25 Nixie, navi di superficie): riceve il ping del siluro, lo amplifica 2–3 volte e lo rimanda indietro; va messa a mare tra 10 e 25 kn (consigliato non oltre 15 kn) | [FAS-SLQ25] | stimato |
| La **filoguida** aiuta il siluro a "evitare esche e disturbatori": l'operatore usa il sonar del sottomarino | [FAS-MK48] | stimato |
| L'ADCAP ha "minore vulnerabilità alle contromisure" rispetto ai Mk 48 precedenti | [FAS-MK48] | stimato |
| Il seeker "Keramika" sovietico (copia del Mk 46) fu "migliorato nella difesa dai mezzi di contromisura idroacustica"; del "Sapfir" si dice che ha "misure logiche di protezione" | [MR-USET80] [MR-SET65] | stimato |
| **Tempi.** Un siluro impiega "sei o più minuti per percorrere 10.000 yd". Sott'acqua serve "un tempo considerevole" per mettere in posizione esche e disturbatori ben lontani dal sottomarino, e un siluro scoperto a poche centinaia di yard "può ancora impedire un'evasione efficace" | [PHX84a] | documentato (opinione d'epoca) |

---

## 3.2 USA — dispositivi di contromisura per sottomarini

| Dispositivo | Lancio / forma | Funzionamento | Periodo | Fonte | Confidenza |
|---|---|---|---|---|---|
| **ADC Mk 2** (Acoustic Device Countermeasure) | cilindro da **3"**, espulso dai lanciatori per segnali/contromisure di navi e sottomarini | batteria; **staziona in verticale** a una quota impostata grazie a un motore controllato dalla pressione che muove un'elichetta intubata in coda; emette un segnale acustico per ingannare i siluri | IOC **1978** (secondo Friedman 2006, p. 769, citato da cmano-db); ancora prodotto oggi | [MILAERO-2022] [CMANO-ADC] | funzionamento = stimato; data = citato tramite fonte secondaria |
| **ADC Mk 3** | **6,25"** (16 cm), conservato e lanciato **dall'esterno** dello scafo | come il Mk 2 (stazionario, quota impostata), contro siluri e sonar | IOC **1992** (Friedman 2006, citato da cmano-db) → **post-finestra** | [CMANO-ADC] | citato tramite fonte secondaria |
| **Mk 70 MOSS** (Mobile Submarine Simulator) | dal tubo da 21"; corpo derivato dal Mk 37 | esca **mobile** che simula un sottomarino, sia in passivo (rumore) sia in attivo (transponder) | da metà/fine anni '70 | concetto generale in [FUN-11]; il dettaglio Mk 70/Mk 37 viene da conoscenza pregressa | concetto = documentato; designazione e date = **non riverificato** |
| **NAE** (Noise Acoustic Emitter) | piccolo dispositivo espulso dal sottomarino | rumore a larga banda (disturbatore) | anni '70–'80 | conoscenza pregressa | **non riverificato** |
| Lanciatori per segnali/contromisure del 688 (es. "signal ejector") | — | espellono segnali, boe e ADC da 3" | — | conoscenza pregressa; vedi sezione 1 | **non riverificato** |
| AN/SLQ-25 **Nixie** (solo contesto, navi di superficie) | trainato | ripetitore elettroacustico | in servizio negli anni '80 | [FAS-SLQ25] [FUN-11] | stimato |

Note:
- **Ricerca non riuscita.** Le ricerche web mirate su "Mk 70 MOSS" e "Noise Acoustic Emitter" non hanno prodotto fonti primarie leggibili (motore di ricerca fuori servizio per limite di sessione; i motori alternativi non davano risultati utili). Le righe MOSS e NAE vanno quindi trattate come **da verificare** su Friedman, *U.S. Submarines Since 1945* (1994) o *World Naval Weapons Systems* (1989/1991).
- **Per il gioco 1985–91:** ADC Mk 2 sì; ADC Mk 3 no; MOSS sì (raro, occupa un tubo e un posto nel deposito armi).

---

## 3.3 URSS — mezzi di contromisura idroacustica (ГПД)

| Denominazione | Descrizione nella fonte | Periodo | Fonte | Confidenza |
|---|---|---|---|---|
| **MG-14 "Anabar"** | "apparato **semovente** di disturbi idroacustici" (disturbatore mobile) | non indicata (si presume anni '60–'70) | [WP-RU-SLOVNAZ] (/А) | stimato (solo identificazione) |
| **MG-44 "Korund"** | "**simulatore** idroacustico semovente di sottomarino" | non indicata | [WP-RU-SLOVNAZ] (/К) | stimato |
| **MG-74 "Korund-2"** | **simulatori** imbarcati dal pr.671RTM (Victor III) al posto dei siluri | anni '80 (stesso periodo del 671RTM) | [DSTORM-671RTM] | stimato |
| **MG-54 "Magma"** | "simulatore idroacustico **alla deriva** di un sottomarino in movimento" | non indicata | [WP-RU-SLOVNAZ] (/М) | stimato |
| **"Magnetit"** | apparato di contromisura idroacustica **alla deriva** | non indicata | [WP-RU-SLOVNAZ] (/М) | stimato |
| **"Sprut"** | apparato **alla deriva** di soppressione idroacustica | non indicata | [WP-RU-SLOVNAZ] (/С) | stimato |
| **MG-104 "Brosok"** | apparato **semovente** di contromisura idroacustica; lanciatori dedicati nella prua dei pr.971 **a partire da K-391** | fine finestra: K-391 entrato in servizio verso il 1989 (data da conoscenza pregressa) | [WP-RU-SLOVNAZ] (/Б) [WP-RU-971] [DSTORM-971] | stimato |
| MG-114 "Berill", MG-124 "Berilliy" | apparati semoventi di contromisura (il secondo "automatico") | probabilmente **post-1991** | [WP-RU-SLOVNAZ] (/Б) | stimato (date non verificate) |
| **REPS-324 "Shlagbaum"** | "lanciatore monouso per siluri da 533 mm REPS-324" (la fonte non dice che sia un mezzo di contromisura) | tarda, non verificata | [WP-RU-SLOVNAZ] (/Ш) | stimato |
| MG-34, GIP-1, "Vist", VIPS, "Pantograf" | **nessuna fonte verificata trovata** (la ricerca "МГ-34" restituisce solo la mitragliatrice tedesca) | — | — | **non verificato: non usare come dato** |

Note:
- **Alfa.** Le fonti consultate non elencano le contromisure del pr.705. Wikipedia dice che il sistema d'arma "Sargan" gestiva attacco, homing dei siluri e "**uso delle contromisure**", sia su comando sia automaticamente [WP-EN-ALFA]. Deepstorm descrive la dottrina: una volta scoperto un attacco, il battello doveva **prima lanciare una salva** e poi **sottrarsi ai siluri con la velocità**; la manovra veniva provata in esercitazione (inversione di 180° in 42 s) [DSTORM-705].
- **Dove stanno i simulatori sovietici semoventi.** Quelli documentati (MG-74) si caricano **nei tubi lanciasiluri**, al posto delle armi [DSTORM-671RTM]. Lanciatori esterni dedicati compaiono solo a fine 1989 sugli Akula (MG-104) [WP-RU-971].

---

## 3.4 Dottrina di evasione: cosa dicono le fonti

### 3.4.1 Al traverso o di poppa? (Doppler)
Peppe (*Submarine Review*, ottobre 1989) modella un seeker attivo che può filtrare i ritorni a Doppler quasi nullo per evitare i falsi bersagli dovuti al riverbero:
- **chi fugge allontanandosi** genera Doppler ed è sempre visto;
- **chi fugge di traverso** alla linea di vista ha Doppler nullo ed è invisibile al seeker filtrato.

Nel caso semplice il gioco è "stabile", con valore 0,7. Nel caso realistico (ingaggio a 5 kyd, siluro a 50 kn, bersaglio a 30 kn, falsi contatti 0,10%/kyd) la soluzione è **mista**:
- l'attaccante usa il filtro Doppler il 24% delle volte;
- l'evasore fugge di poppa il 46% e di traverso il 54%;
- la probabilità di colpire è **46%**.

Corollario: se la dottrina nemica è "evadere in profondità", conviene mettere i siluri sotto lo strato, e allora a volte conviene evadere verso l'alto [PEP89]. → `documentato` come modello accademico; i numeri sono illustrativi.

### 3.4.2 Velocità o silenzio
- **Correre** funziona solo con un margine di velocità sufficiente. La regola di progetto occidentale chiedeva un rapporto **1,5:1** tra siluro e bersaglio, e per mantenerlo contro l'Alfa lo Spearfish britannico doveva superare i 60 kn [LONG89]. Mk 48 Mod 4 a 55 kn contro Alfa a 41 kn dà 1,34:1, sotto soglia → l'Alfa **può superare in corsa** un Mk 48 lanciato da lontano verso la sua poppa (vedi 07 §6.2). L'ADCAP a ≈63 kn porta il rapporto a 1,54 [COTE03].
- **Restare silenziosi** funziona contro i seeker passivi e contro la TMA nemica, ma non contro un seeker attivo già agganciato.
- Contro un **diesel in acque basse** il GAO riporta la valutazione OPTEVFOR (1994): il bersaglio ha "un tempo di reazione molto breve" contro un ADCAP lanciato ad alta velocità e "non sarebbe in grado di evadere o controbattere efficacemente" [GAO-95-104] (fuori finestra, ma utile come principio).
- Un sottomarino attaccato **scende** di quota per poter correre senza cavitare [FUN-8 §8.8.1.3], citato in `05_acustica.md` e `07_dottrina_siluri.md`.

### 3.4.3 Strato termico
Il cambio di quota attraverso lo strato degrada sia l'acquisizione del seeker sia il contatto del lanciatore (vedi `05_acustica.md` §5). Peppe ne fa un elemento della strategia mista [PEP89]. Non esistono numeri aperti sull'efficacia contro siluri specifici → `nozionale` (§3.6).

### 3.4.4 Knuckle
Accostata a tutta barra ad alta velocità: la turbolenza della scia piegata crea un volume di acqua agitata e bolle che **riflette i ping attivi** e può offrire al seeker un falso bersaglio fermo. È un termine e un concetto della marineria di superficie e sottomarina (conoscenza pregressa, non riverificato). Nei giochi commerciali è modellato esplicitamente ([CW-MAN p. 22], citato in 07 §6.1). Poiché il knuckle è **fermo** (Doppler nullo rispetto all'acqua), il filtro Doppler di Peppe lo scarta: è quindi efficace soprattutto contro seeker **senza** filtro. Questa è una deduzione che combina [PEP89] e [FUN-11] → `stimato`.

### 3.4.5 "Crazy Ivan"
- **Documentato (secondario).** "Pulire i baffles" (virare per ascoltare il settore cieco a poppa) è pratica reale. Alcuni comandanti lo facevano con una o più accostate brusche, sia per scoprire un inseguitore sia per mettersi in posizione d'attacco. Queste manovre estreme erano "più comuni sui sottomarini sovietici", da cui il soprannome "Crazy Ivan". Pericoli: scoperta dell'inseguitore e **collisione**. Le manovre di pulizia dei baffles degli Yankee erano dette "Yankee Doodles". Con l'avvento dell'**array trainato** (che sui sovietici parte con 667BDR e 671RTM) la necessità diminuì [WP-EN-BAFFLES].
- **Folklore / da non prendere alla lettera.** L'espressione è gergo occidentale reso popolare da Tom Clancy (*The Hunt for Red October*, 1984; vedi 07 §6.1). Non risulta da fonti primarie sovietiche come manovra codificata. Il dettaglio "virata di 180° a orari fissi" è un'invenzione narrativa.
- **Per il gioco.** Un SSN sovietico IA esegue periodicamente una pulizia dei baffles, con intervallo e verso **casuali**, come prescrive la buona tattica secondo [WP-EN-BAFFLES]. Talvolta la accompagna con un'accostata brusca e un'accelerazione; il rischio di collisione va modellato per un inseguitore entro 1 kyd.

### 3.4.6 Portata dei seeker: la distanza a cui l'evasione diventa difficile

| Seeker | Raggio (contro sottomarino) | Fonte | Confidenza |
|---|---|---|---|
| Mk 37 Mod 2/3 | ≈1.000 yd (910 m) | [NW-US] | stimato |
| Mk 48 Mod 0 (dato storico) | 4.000 yd riportati | [NW-US] | stimato |
| Mk 48 (FAS) | "1.600 yd": dato **contaminato** da righe Mk 46/ASROC | [FAS-MK48] | dubbio |
| Mk 46 | zona di "non fuga": cilindro di "diverse migliaia di yard" | [COTE03] via 07 §4 | documentato |
| SET-53M (passivo, 25 kHz) | 600 m, settore ±60° | [MR-SET53] | stimato |
| SAET-60 (passivo, antinave) | 600–800 m | [MR-SAET60] | stimato |
| SET-65 / TEST-71 ("Sapfir", attivo) | 800 m | [MR-SET65] [MR-TEST71] | stimato |
| Keramika (SET-65K, TEST-71MK, USET-80K) | 1.500 m | [MR-SET65] [MR-TEST71] [MR-USET80] | stimato |
| USET-80 "Vodopad" | ≥1.500 m (prestazioni scarse in acque basse e con forte riverbero) | [MR-USET80] | stimato |
| UMGT-1 | 1.500 m | [MR-VODOPAD] | stimato |
| Valori di gioco Mk 48 / ADCAP | vedi `07_dottrina_siluri.md` §4 e `02_armi.md` §2.9 | — | nozionale |

---

## 3.5 Tabella master delle contromisure, con parametri di gioco

I valori delle colonne "Durata", "Livello/banda" ed "Effetto" sono **tutti `nozionale`** salvo indicazione contraria. Motivazione generale: i seeker lavorano a decine di kHz e "vedono" solo poche migliaia di yard (`05_acustica.md`); un'esca deve superare in quella banda il livello del bersaglio vero; un disturbatore contro un sonar attivo deve arrivare a ≥200 dB re 1 µPa [FUN-11].

| Tipo | Esempi reali | Lancio | Durata (nozionale) | Livello / banda (nozionale) | Effetto di gioco (nozionale) | Periodo | Fonte del tipo | Confidenza del tipo |
|---|---|---|---|---|---|---|---|---|
| **Esca stazionaria** che rimanda o imita l'eco | ADC Mk 2 (USA) | lanciatore da 3" esterno al tubo; ricarica 30 s; 10–12 colpi per il 688 | **4 min** | eco del sottomarino + 6 dB nella banda 15–40 kHz; rumore pari al SL del sottomarino a 8 kn | contro siluro attivo che non l'ha ancora agganciato: P(seduzione) 0,50 (Mk 48 Mod 3 / Sapfir), 0,35 (Mod 4 / Keramika), 0,20 (ADCAP); con **filtro Doppler** attivo × 0,3 (esca ferma) | 1978→ | [MILAERO-2022] [CMANO-ADC] [FUN-11] | stimato |
| **Esca alla deriva** (disturbo o simulazione) | MG-54 "Magma", "Magnetit", "Sprut" (URSS) | espulsa (lanciatore piccolo o tubo) | **5 min** | come sopra; "Magma" simula un sottomarino in moto, quindi un piccolo Doppler | P(seduzione) 0,40 / 0,30 / 0,15 (stesse classi di seeker); × 0,6 con filtro Doppler | anni '70–'80 (non verificato) | [WP-RU-SLOVNAZ] | stimato |
| **Simulatore semovente** di sottomarino | Mk 70 MOSS (USA); MG-44 "Korund", MG-74 "Korund-2" (URSS) | **tubo lanciasiluri**: consuma un tubo per il tempo di lancio e un posto nel deposito | **15 min** a 10–15 kn (MOSS: corpo Mk 37, ≈40 min di batteria a 17 kn [NW-US], ridotti dal carico utile) | rumore irradiato a larga banda pari a un SSN a 10 kn + transponder attivo | **seduce sia i siluri sia i sonaristi**: P(seduzione) 0,60 (passivo) / 0,45 (attivo), 0,30 contro ADCAP; Doppler non lo filtra (si muove); per la TMA nemica è un "contatto sottomarino" credibile per 3–5 min | anni '70→ (USA, non riverificato); 671RTM (URSS) | [FUN-11] [DSTORM-671RTM] | stimato |
| **Disturbatore** (rumore) | NAE (USA, non verificato); MG-14 "Anabar" (URSS, semovente) | espulso o semovente | **3 min** | rumore a larga banda 10–50 kHz, SL 190–200 dB (sotto la soglia di 200 dB di [FUN-11] → efficace contro i seeker, non contro i sonar delle navi) | non seduce: **dimezza** la portata d'acquisizione dei seeker entro ±20° dalla linea del disturbatore; acceca il sonar passivo nemico in quel settore; rivela però la presenza del lanciatore | anni '60–'80 | [FUN-11] [WP-RU-SLOVNAZ] | stimato |
| **Knuckle** | manovra | — | **60–90 s** | eco volumetrica, Doppler nullo | P(seduzione) 0,20 solo contro seeker attivi senza filtro Doppler; richiede ≥15 kn e barra ≥20°; il sottomarino diventa più rumoroso (cavitazione se sopra la soglia di quota) | sempre | [PEP89] [FUN-11] (deduzione); [CW-MAN] (modello di gioco) | stimato / nozionale |
| **Cambio di quota attraverso lo strato** | manovra | — | finché il siluro resta dall'altra parte | — | portata del seeker × 0,5 attraverso lo strato (da collegare al modello TL di `05_acustica.md`); il filo continua a funzionare | sempre | [PEP89] | nozionale |
| **Silenzio** (motore al minimo) | manovra | — | — | SL del sottomarino −10/−15 dB | contro seeker passivo: portata ridotta in proporzione al SL (equazione del sonar di `05_acustica.md`); contro seeker attivo agganciato: nessun effetto | sempre | [FUN-8] via 05 | documentato (principio) |
| **Filoguida** come contro-contromisura | Mk 48 (tutti), TEST-71 | — | finché dura il filo | — | se il filo è integro, l'operatore "rifiuta" l'esca: P(seduzione) × 0,5 (USA); × 0,7 (TEST-71: solo rotta, operatore con dati più poveri) | — | [FAS-MK48] [MR-TEST71] | stimato / nozionale |

Esempio di **sequenza combinata** (esca + knuckle + corsa), coerente con 07 §6.4:
1. Lancio dell'esca o del simulatore **prima** dell'accostata, così resta tra il siluro e la nuova rotta.
2. Knuckle.
3. Nuova rotta al traverso (contro un attivo con Doppler) o di poppa (contro un passivo o in inseguimento).
4. Cambio di quota attraverso lo strato.
5. Corsa sotto la velocità di cavitazione della nuova quota, poi di nuovo silenzio.

Bonus nozionale per l'uso **combinato** ben eseguito (esca lanciata ≥30 s prima dell'accostata, separazione in azimut ≥30° tra esca e nuova rotta [FUN-11]): +0,15 alla P(seduzione) dell'esca, con un massimo di 0,85.

---

## 3.6 Implicazioni per il gioco (sintesi)

1. **Cronologia delle contromisure.**
   - USA 1985–91: ADC Mk 2 (3") e, se si vuole, MOSS; **mai** ADC Mk 3 (1992).
   - URSS: simulatori nei tubi (classe MG-44/MG-74) e apparati alla deriva o semoventi.
   - Lanciatori esterni MG-104 solo sugli Akula da fine 1989.
   - Per l'**Alfa** la dotazione è ignota → proposta nozionale: 2 simulatori semoventi che occupano posti del deposito siluri (su 20) + 4 apparati alla deriva espulsi da un piccolo lanciatore. La dottrina documentata è "salva, poi fuga a velocità" [DSTORM-705].
2. **Contro-contromisure per generazione** (ordine documentato qualitativamente, numeri nozionali): Sapfir < Keramika (1986+) ≈ Mk 48 Mod 4 < ADCAP ("reduced vulnerability to countermeasures" [FAS-MK48]). La filoguida raddoppia la resistenza alle esche finché il filo è integro.
3. **Doppler.** Il filtro Doppler va reso una **scelta del giocatore** al lancio (vedi [PEP89]):
   - filtro attivo: ignora knuckle ed esche ferme, ma non vede un bersaglio che fugge di traverso;
   - filtro disattivo: vede tutto ma abbocca alle esche.
   È la scelta tattica più ricca e meglio documentata della sezione.
4. **Tempi.** Le esche richiedono tempo per entrare in posizione [PHX84a] → ritardo di attivazione nozionale di **10 s** per l'ADC, **30 s** per il simulatore da tubo (lancio + allontanamento).
5. **"Crazy Ivan"** è da modellare come pulizia dei baffles a intervalli **casuali**, non come rituale a orologio: il folklore va segnalato nel manuale o nell'enciclopedia di gioco.
6. **Lacune** (tutte coperte da valori nozionali qui sopra):
   - durate e livelli reali di ADC, MOSS e MG-xx;
   - data e caratteristiche di NAE e del segnalatore del 688;
   - designazioni sovietiche MG-34, GIP-1 e VIPS;
   - dotazione di contromisure dell'Alfa;
   - efficacia numerica del knuckle.
