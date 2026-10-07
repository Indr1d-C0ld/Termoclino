# TERMOCLINO — Documento di progetto

**Tributo e reinterpretazione di *688 Attack Sub* (John W. Ratcliff / Electronic Arts, 1989).**
Simulatore di sottomarini della tarda Guerra Fredda, giocabile nel browser, in singolo e in
duello uno-contro-uno, con il motore autoritativo su il server.

> «Termoclino» è un **nome di lavoro**: è lo strato d'acqua dove la temperatura crolla e il
> suono si piega, il nascondiglio intorno a cui ruota tutto il gioco. Il nome *688 Attack Sub*
> non si può usare (vedi §8.3). Decisione D5.

Versione documento: 0.3 — 07/10/2026 — quattro decisioni fondanti prese (§12.1); integrato con
ricerca, decodifica degli asset e catalogo delle schermate
Materiale di partenza: cartella di gioco originale (versione DOS del 1989, `GAME.EXE` del
12/06/1989), manuale utente (testo e scansione, 80 pagine), addendum, foglio di
identificazione sonar.

---

## 0. In una pagina

1. **Il duello in rete non tradisce l'originale: ne è la parte più coraggiosa.** Nel 1989 si
   giocava già 688 contro Alfa via modem Hayes o cavo null-modem, in sei missioni su dieci
   (1, 2, 5, 7, 8, 9), con chat dalla sala radio e resa con Ctrl-K. Noi portiamo quel duello
   dove nel 1989 non poteva arrivare: account, lobby, classifica, carriera.
2. **Si gioca nel browser, il motore gira su il server.** Lo sfidante entra con un link; niente
   da installare, firmare o aggiornare. È lo stesso stack degli altri giochi del server (Core di
   autenticazione già collaudato), più un server di gioco in tempo reale (Node.js in Docker)
   dietro Apache.
3. **Il server non manda mai la verità al client.** Ogni giocatore riceve solo ciò che i sensori
   del suo battello captano: energia per rilevamento, righe spettrali, transitori, rapporti
   dell'equipaggio. È questo, più ancora dell'equità, il motivo per cui il server deve essere
   autoritativo: in un duello fra sottomarini chi conosce la posizione dell'altro ha già vinto,
   e un client manomesso non deve avere niente da rubare.
4. **Anche il giocatore singolo è una partita sul server**, contro un capitano-IA che vede il
   mondo attraverso gli stessi sensori di un umano. Un solo motore, statistiche e traguardi
   onesti, nessuna riscrittura quando arriva la rete.
5. **Si conserva l'anima del 1989**: la CONN come menu, le stazioni sui tasti F2-F9, il nastro
   dei messaggi dell'equipaggio, la mappa con la pulsantiera a 9 tasti, la grafica originale, il
   cirillico finto dell'Alfa con Ctrl-R, perfino il tasto del capo F10.
6. **Si rifà da capo tutto quello che c'è sotto**: propagazione acustica vera (strato, zona
   d'ombra, convergenza, fondo), rumore proprio e cavitazione, towed array con l'ambiguità
   destra/sinistra, contatti con incertezza al posto delle lettere «esatte», analisi del moto
   del bersaglio (TMA), siluri con filo, quote e programmi di ricerca, esche, danni per
   compartimento, equipaggio a cui delegare a livelli.
7. **I duelli sono asimmetrici due volte**: battelli diversi e **obiettivi diversi**, come nelle
   missioni originali (uno deve sganciarsi, l'altro tenere il contatto; uno deve passare uno
   stretto, l'altro sbarrarlo). L'asimmetria vera, ricostruita dalle fonti, è più netta di quella
   del 1989: il 688 ha l'orecchio migliore, il towed array e i **siluri filoguidati**; l'Alfa non
   ha né towed array né siluri a filo, ma a 41 nodi **sfugge a qualunque Mk 48 lanciato oltre
   circa 9.000 iarde** (11-12.000 contro l'ADCAP) — al prezzo di diventare sordo e di farsi
   sentire da lontanissimo. Il duello ruota tutto intorno a questo compromesso.
8. **Gli asset originali non si distribuiscono**: li estrae uno strumento nostro dalla copia
   dell'utente. Il repo pubblico non ne contiene nemmeno un byte.

---

## 1. Come riformulerei il prompt di partenza

Il prompt allegato è una buona base. Qui sotto quello che terrei, quello che cambierei e
perché.

| # | Il prompt dice | Propongo | Perché |
|---|----------------|----------|--------|
| 1 | Client Godot 4 (o Unity), PC Windows/Linux/Mac | **Client nel browser** (moduli JavaScript, Canvas 2D, WebGL facoltativo), server su il server | Lo sfidante entra con un link. Un eseguibile per macOS non firmato e non notarizzato (serve l'account sviluppatore Apple, 99 $/anno) va sbloccato a mano dalle impostazioni di sicurezza; uno per Windows si scontra con SmartScreen. L'interfaccia è pixel art 320×200: il terreno ideale del Canvas. È lo stack di Atlantik, Cento Gradini e Piazza Pulita, con il Core già collaudato. E ogni schermata la posso collaudare io stesso nel browser integrato. Decisione D1. |
| 2 | Ordine: prima singolo (punto 3), rete al punto 4 | **Server autoritativo dal primo giorno**; il singolo è una partita contro un bot che gira sul server | Un simulatore nato locale va riscritto per diventare autoritativo: è la trappola più comune di questo genere di progetti. E solo il server tiene onesti statistiche e traguardi anche in singolo. |
| 3 | Server autoritativo «per la fairness» | Server autoritativo **per la nebbia di guerra** | Il client riceve solo le misure dei propri sensori, mai le posizioni vere. Vedi §5.4 e §6. |
| 4 | Duello 1v1 fra due battelli | Duello 1v1 **a obiettivi asimmetrici**, più la modalità libera «fino all'ultimo» | Le missioni del 1989 lo facevano già: in *Shake 'Em* il 688 deve far perdere il contatto per 3 minuti mentre l'Alfa deve tenerlo; in *Escape* il 688 deve uscire da Gibilterra senza farsi scoprire. Gli obiettivi danno ritmo e rendono giocabile l'asimmetria. |
| 5 | (non affrontato) tempo e compressione nel duello | **Scala del tempo fissa per partita**, scelta in lobby | Via modem, nel 1989, il tempo scorreva 1:1. Una compressione che si spegne da sola quando succede qualcosa **rivela all'avversario che è successo qualcosa**. Decisione D2. |
| 6 | Ranking, gradi e achievements come un blocco unico | **Tre cose separate**: valutazione (abilità, Glicko-2, sale e scende), grado (carriera, si guadagna e non si perde), decorazioni e traguardi | Come in Atlantik. In più, con battelli asimmetrici serve stimare il **vantaggio di lato per scenario** (come il vantaggio del Bianco negli scacchi), altrimenti chi gioca il lato forte gonfia la propria valutazione. |
| 7 | «Conservare gli assets originali» | Estrarli dalla copia dell'utente con uno strumento nostro; **mai** nel repo pubblico; chiedere il permesso a Ratcliff | Il manuale riporta *«Software © 1988 John Ratcliff»* accanto al copyright EA sul manuale; la grafica però è di Michael Kosaka e Wilfredo Aguilar, quindi i suoi diritti dipendono dai contratti del 1988. Il nome commerciale è di EA. Ratcliff è pubblicamente attivo ed è il primo interlocutore naturale (§8.3). Decisione D13. |
| 8 | Modalità Classic e Remastered | Confermate, con una regola: le **stazioni nuove** (TMA, waterfall, schede d'arma) si costruiscono col **kit grafico originale** (cornici, pulsanti, strumenti, font estratti) | Altrimenti in modalità Classic sembrerebbero incollate. |
| 9 | Unity come alternativa; «standard 2025+» | Un motore solo; siamo nel 2026 | Tenere aperte due strade raddoppia le decisioni senza dare niente. |
| 10 | (mancano) | **Riconnessione** (se cadi la linea, l'ufficiale di guardia prende il comando), **debriefing con la verità** (rivedere la partita con entrambe le tracce: «ecco quando ti ho sentito»), **bot per il bilanciamento** (migliaia di duelli IA-contro-IA a tempo compresso), **ascolto in cuffia** dei contatti | Sono le cose che fanno funzionare un duello fra sottomarini nel 2026. |

---

## 2. Cosa faceva davvero l'originale

Sintesi dal manuale (letto per intero), dall'addendum, dal foglio sonar, dagli script delle
missioni decifrati (§8.1) e da una sessione di gioco in DOSBox con 103 schermate catalogate
(`docs/ORIGINALE.md`). Dove il gioco fa una cosa diversa dal manuale, vale quello che fa il gioco.

### 2.0 Quello che si vede solo giocando

- **Il mondo è compresso**: le distanze scorrono circa 3,5 volte più in fretta di quanto direbbero
  i nodi mostrati (lo confermano sia le velocità di avvicinamento sia la corsa dei siluri). La
  compressione del tempo vale circa 6×, non 2× come dice il manuale. L'orologio si ferma durante
  l'aiuto e quando è aperto un mirino (bersaglio, waypoint, DIRECT).
- **La cavitazione dipende dall'accelerazione, non dalla velocità**: circa 5/10 accelerando a
  FLANK o in REV a 150 ft, **zero a 37 nodi costanti**.
- **La velocità assorda davvero**: fra 34 e 37 nodi si perdono tutti i contatti, che non tornano
  nemmeno dopo un minuto a 8 nodi.
- Il 688 raggiunge i 37 nodi accelerando di circa mezzo nodo al secondo; con i timoni orizzontali
  a fondo scende di circa 18 ft al secondo **anche da fermo**. Toccare il fondo è solo
  un'abrasione (16% di danno allo scafo e il lampo rosso).
- I contatti passano dalla X direttamente alla lettera con dati esatti; il periscopio identifica
  una nave **all'istante a 10 miglia**.
- Armare un tubo richiede 15-25 secondi; i tubi si ricaricano da soli e il successivo si seleziona
  da sé. Il Mk 48 corre a circa 48 nodi. A BEGINNER un solo Mk 48 ha affondato un cacciatorpediniere
  (il manuale dice che ne servono di più).
- Le posizioni di partenza in TORPEX cambiano da una partita all'altra.
- Le lettere e le cifre **spostano solo il cursore** sul comando; serve poi Invio per eseguirlo.
- Sull'Alfa la macchina è graduata in percentuale (da −10 a 110), i pannelli sono color petrolio
  con manopole, e l'aiuto della pagina di stato parla ancora «del sottomarino classe 688».
- Il rapporto finale è solo un messaggio di telescrivente: niente punteggio, gradi o medaglie
  (*Compute!* lo lamentava già nel 1989).

### 2.1 Struttura e interfaccia

- **CONN** come menu principale (la sala di controllo disegnata, `688.PAK` / `ALFA.PAK`), con
  le stazioni come zone sensibili: Radio (F2), Status (F3), Ship's Control (F4), Periscopio
  (F5), Navigation Board (F6), Weapon Control (F7), Sonar (F8), ritorno alla CONN (F9),
  tasto del capo (F10), aiuto (F1). In singolo **il gioco si ferma quando sei nella CONN**.
- Ogni stazione ha gruppi di comandi raggiungibili con Tab, frecce, cifre (gruppo) e lettere
  (comando). Il gioco si può giocare con sei tasti.
- **Barra bersaglio** in alto (TARGET, BEARING, RANGE, COURSE, SPEED, DEPTH) e **nastro dei
  messaggi** dell'equipaggio che scorre da destra a sinistra, con ripasso dalla sala radio.
- **Mappa dall'alto** con 10 livelli di zoom, batimetria a toni (più scuro = più profondo),
  HUD con bussola, quota propria, fondo e strato termico. Pulsantiera a 9 tasti sul 688
  (P F S / I H O / C B T), più povera sull'Alfa (SCALE UP/DN, CONTOUR, HUD).
- **Contour imaging** («side scanning sonar», solo 688): immagine del fondo a prua, a dritta e
  a sinistra, «senza alcuna penalità» di rilevabilità.
- L'Alfa ha i comandi in **cirillico finto** (Ctrl-R lo spegne), niente contour imaging, niente
  indicatore di cavitazione, niente schema dei danni.
- Protezione anticopia: codice di accesso dalla sala radio (prime tre lettere di una parola del
  manuale, nel paragrafo intestato al nome di un 688).

### 2.2 Meccaniche

| Area | Come funzionava nel 1989 | Cosa cambiamo |
|------|--------------------------|---------------|
| **Scala** | «Raggio di combattimento» di circa 15 miglia; **tutti i siluri a 10 nm**, anche i sovietici; filo di 7,5 nm; velocità massime scelte «a sentimento» (note di Paul Grace) | Portate e velocità reali (con fonte o valore dichiarato nozionale); il ritmo lo danno la geometria degli scenari e gli obiettivi (§5.12). Il «regolamento 1989» resta come preset nostalgico (D3). |
| **Tempo** | Compressione «circa 2×» secondo il manuale, circa 6× misurata in DOSBox; mondo che scorre 3,5 volte più in fretta dei nodi mostrati; pausa nella CONN; via modem né pausa né compressione | Scala fissa per partita nei duelli; in singolo pausa e compressione libere fino a 32× (D2). |
| **Contatti** | «X» = solo rilevamento, disegnata sempre a metà fra te e il bordo della mappa; poi una **lettera nella posizione esatta** del bersaglio; poi l'identificazione (lettera scura → chiara) | Tracce con incertezza (ellisse) costruite da misure rumorose; TMA dell'equipaggio e manuale; la lettera «esatta» resta solo come livello di assistenza 3 (§5.6). |
| **Sonar** | Analizzatore a 4 zone dello spettro (navi, sottomarini, biologici, siluri); filtro BAND PASS / HIGH PASS (solo siluri); impulso attivo che «rivela tutto ciò che è davanti» e allerta tutti | Equazione del sonar per bande e righe tonali; waterfall a banda larga, LOFAR a banda stretta, DEMON; attivo con portata e rischio reali; ricevitore d'intercettazione (§5.4). |
| **Towed array** | Dispiegamento in minuti; limita la velocità (2/3 sul 688, 50% sull'Alfa); si può tagliare; nessun angolo cieco a poppa | Come sopra, più l'**ambiguità destra/sinistra** (un array lineare non distingue i due lati: la si risolve accostando) e alcuni minuti di cecità dopo ogni accostata. **Solo sul 688**: l'Alfa vero non lo aveva. |
| **Cavitazione** | Dipende da accelerazione e profondità, non dalla velocità (a 37 nodi costanti l'indicatore torna a zero); STD, FULL e FLANK vietati sopra i 100 ft; REV fragoroso | Velocità d'innesco che cresce con la radice della pressione; niente divieti: la cavitazione la paghi in rumore, non con un pulsante grigio. |
| **Strato termico** | Uno, segnato sull'HUD; «nasconditi appena sotto» | Profilo di velocità del suono reale per zona e stagione; strato, zona d'ombra, convergenza e fondo escono dalla propagazione (§5.3). |
| **ESM** | Livello del radar nemico; periscopio, antenna e scia sono visibili | Esposizione radar per tempo, stato del mare e altezza d'albero; intercettazione ESM bidirezionale. |
| **Armi** | 688: 4 tubi «a prua» e 2 ausiliari per i noisemaker; Alfa: 6 tubi, il sesto lancia noisemaker finché ci sono. Caricamento tubo per tubo. Missili solo a quota periscopica e con identificazione certa | I tubi del 688 sono a centro nave e angolati; le esche lanciate dai lanciatori da 3 pollici; Harpoon e Tomahawk antinave partono **in immersione** dai tubi (capsula); quantità, tempi di ricarica e regolazioni reali (§5.8). |
| **Siluri** | SELECT / SEARCH / DIRECT / DETONATE; cono di 20°; raggio di virata (RHC); tutti uguali | Velocità, quota, tetto e pavimento, distanza di abilitazione, ricerca a serpentina o a cerchio, testa passiva/attiva, filo che si rompe, siluri sovietici a **scia** (insensibili alle esche), riattacco (§5.8). |
| **Danni** | Per sistema in percentuale, permanenti per tutta la missione, nessuna riparazione | Compartimenti e sistemi, allagamento funzione della quota, squadre di controllo danni (riparazioni parziali e lente); «nessuna riparazione» come regola 1989 (D9). |
| **Navigazione** | Autopilota fino a 9 waypoint, rallenta in virata, **ignora il fondo**; proiezione della posizione futura | Uguale, più un avviso di fondale e quota di sicurezza; la proiezione diventa anche uno strumento di TMA. |
| **Difficoltà** | BEGINNER: sei più silenzioso, il tuo sonar è più potente, resisti di più, il periscopio si vede meno | Livelli di **assistenza** (cosa fa l'equipaggio per te), non di fisica truccata. I duelli in classifica usano regole fisse per coda. |
| **Prestazioni** | Su macchine lente al massimo 2 siluri in acqua | Nessun limite tecnico; i limiti sono quelli dei tubi e dei fili. |
| **Rete** | Modem Hayes ≥1200 baud o null-modem; originatore e risponditore; chat via TRANSMIT a qualsiasi quota; resa Ctrl-K; in TORPEX due 688 senza missili | Lobby, sfide con codice, classifica; chat radio conservata (regole di quota a scelta, D10); resa conservata. |
| **Resistenza ai danni** | Il giocatore incassa circa **sei colpi**, i nemici due (critica di *Computer Gaming World*, maggio 1989); a BEGINNER ancora di più | Danni uguali per tutti: un siluro pesante a segno è di norma decisivo. |
| **L'Alfa** | 42 nodi, 1800 ft, towed array (limite al 50%), 18 «Type 53», 4 noisemaker | 41 nodi dimostrati (in servizio non oltre 39), quota operativa intorno ai 1100 ft (320-400 m), **nessun towed array**, 20 siluri SET-65 / SAET-60 **senza filo**, virata di 180° a tutta forza in 42 secondi. Il «mito» dell'intelligence del 1980 (45 nodi, oltre 2000 ft) resta come variante leggendaria dichiarata. |
| **Missili** | Harpoon e Tomahawk solo a quota periscopica; 8 *Sea Lance* in *Homecoming* | Harpoon e Tomahawk si lanciano in immersione; il *Sea Lance* non entrò mai in servizio (cancellato nel 1990): resta solo come «e se?» dichiarato. |

Fonti e dettaglio di ogni riga: `docs/ricerca/08_688_originale.md` (26 semplificazioni ed errori,
ciascuno classificato come dichiarato dagli autori, segnalato da un recensore o dedotto dalle
fonti).

### 2.3 Le dieci missioni

| # | Nome | Zona | 688 | Alfa | Via modem |
|---|------|------|-----|------|-----------|
| 1 | TORPEX '89 | Fær Øer, Mar di Norvegia | Affondare 3 Forrest Sherman radiati in 15 minuti, con elicotteri a caccia | (variante: due 688, *Los Angeles* contro *Dallas*, 3 bersagli su 5) | Sì, 688 contro 688, senza missili |
| 2 | Shake 'Em | Fær Øer | Seminare l'Alfa per 3 minuti dopo i 20 | Non perdere il contatto per più di 3 minuti, restando a distanza di tiro | Sì (688: 20 siluri, Alfa: 18) |
| 3 | Sub Ops | Mare di Barents | — | «Mettere in sicurezza il porto» di Severomorsk: scacciare gli intrusi senza scatenare uno scontro | No |
| 4 | Mumar Cadaver | Stretto di Gibilterra | Affondare 4 petroliere libiche scortate, senza toccare i neutrali | — | No |
| 5 | Escape | Gibilterra | Uscire in Atlantico senza contatto sovietico | Tenere il contatto sul 688 mentre esce, a distanza di tiro | Sì (il miglior duello) |
| 6 | Goulash | Bocca dell'Adriatico | Scortare 6 mercantili verso nord (invasione sovietica della Jugoslavia) | — | No |
| 7 | Cat Walk | Passaggio di Kunashir | Affondare l'SSBN in uscita da Vladivostok (un Seahawk segnala con una boa) | Proteggere l'SSBN senza scambiarlo per il 688 | Sì |
| 8 | Surprise Party | Margine della piattaforma celtica | Scortare il gruppo da battaglia | Attaccarlo da solo | Sì (il giocatore più forte prende l'Alfa) |
| 9 | Homecoming | Piattaforma celtica | Difendere un convoglio diretto in Francia (8 Sea Lance) | Agguato con un Oscar | Sì (il più forte prende il 688) |
| 10 | Hit and Run | Mar Baltico | Lanciare 4 Tomahawk entro 5 minuti dalla costa della DDR e uscire dal Baltico | — | No |

Le missioni seguono una **cronologia** dalla diffidenza della guerra fredda alla guerra totale:
la «terza guerra mondiale del 1989 che non c'è stata». Diventa la campagna in singolo (§7.7).

---

## 3. Pilastri

1. **Identità visiva del 1989.** Stazioni, palette, ritratti dell'equipaggio, sagome al
   periscopio, nastro dei messaggi. Due rese: *Classic* (320×200 a fattore intero, pixel
   nitidi) e *Remastered* (pannelli ridisegnati a piena risoluzione dai loro script originali,
   bitmap ingrandite con un algoritmo per pixel art, strumenti dinamici in alta risoluzione). Le
   stazioni nuove si costruiscono col kit originale.
2. **Duello asimmetrico in rete, al centro.** 1v1, battelli diversi, obiettivi diversi, regole
   fisse e note in anticipo per le partite in classifica.
3. **Simulazione corretta e documentata.** Ogni numero ha una fonte datata e una confidenza
   (`documentato` / `stimato` / `calcolato` / `nozionale`) come in Atlantik; i valori ancora classificati
   sono dichiarati nozionali, con il ragionamento.
4. **Accessibile senza essere finto.** La fisica è la stessa per tutti; cambia quanto lavoro fa
   l'equipaggio per te. Il tutorial è TORPEX '89, come nel manuale.
5. **Server autoritativo e nebbia di guerra.** Il client sa solo ciò che il suo battello sa.
6. **Pragmatismo.** Poche dipendenze, niente framework dove non serve, prove automatiche per
   ogni modello, script di installazione collaudati.

---

## 4. Architettura tecnica

### 4.1 Vista d'insieme

```
 Browser del giocatore                          il server
┌─────────────────────────┐  HTTPS  ┌──────────────────────────────────────────────┐
│ Pagine: arruolamento,   │────────▶│ Apache ── PHP 8.4 (Core da Atlantik)         │
│ profilo, lobby,         │         │   account, profilo, classifiche, statistiche,│
│ classifiche, carriera   │         │   carriera, storico partite, admin           │
│                         │         │   rilascia il «biglietto» firmato per il WS  │
│ Client di gioco         │  WSS    │                                              │
│ (moduli JS, Canvas)     │────────▶│ Apache /termoclino/ws ──▶ 127.0.0.1:PORTA    │
│  stazioni, waterfall,   │◀────────│ Server di gioco: Node.js 24 LTS in Docker    │
│  mappa, periscopio,     │         │   presenza, sfide, code, matchmaking         │
│  audio                  │         │   partite: simulazione autoritativa,         │
└─────────────────────────┘         │   equipaggio, IA, registrazione              │
                                    │          │ esiti, statistiche, istantanee   │
                                    │          ▼                                   │
                                    │ MariaDB 11.8 (trm_termoclino) + file replay  │
                                    │   PHP elabora: valutazioni, gradi, medaglie  │
                                    └──────────────────────────────────────────────┘
```

Tre pezzi, ognuno nel linguaggio che gli si addice:

- **Applicazione web PHP** — identità, persistenza, pagine. Riusa il Core nato in Atlantik e già
  portato in Cento Gradini e Piazza Pulita: `Auth` con conferma per e-mail via Brevo,
  `Session`, `Csrf`, `RateLimiter`, `Migrator`, `View`, `GameConfig`, `Lock`, console.
- **Server di gioco Node.js** — tutto ciò che è in tempo reale: presenza in lobby, sfide,
  matchmaking, partite. Una partita è un oggetto in memoria che avanza a passo fisso.
- **Client nel browser** — moduli ES serviti così come sono, senza bundler.

### 4.2 Perché Node.js per il server di gioco (e non PHP)

- È fatto per un ciclo a eventi con connessioni persistenti; PHP-FPM no (si può fare con
  ReactPHP, ma nessun altro progetto del server lo usa e i processi PHP di lunga durata hanno
  trappole proprie).
- **È lo stesso linguaggio del client**: protocollo, tabelle dei dati, geometria, unità di
  misura e strumenti di TMA si scrivono una volta sola in `shared/` e li importano entrambi.
- Dipendenze minime: `ws` e `mariadb`. Le prove usano `node:test`, integrato.
- **JavaScript con annotazioni JSDoc** controllate da `tsc --checkJs --noEmit`: i tipi si
  verificano come in TypeScript, ma **senza passo di compilazione**: il browser carica gli
  stessi file che girano sul server. È la regola «niente build» degli altri progetti, senza
  rinunciare al controllo dei tipi.
- **In Docker** perché il Node di sistema è il 20, fuori supporto dal 30/04/2026, e perché la
  politica di riavvio di Docker sostituisce un'unità systemd (che richiederebbe sudo).

### 4.3 Il ciclo della partita

- **Passo fisso di 0,1 s di tempo di gioco** per dinamica e siluri; sensori integrati a 1 Hz;
  IA a 0,5-1 Hz. A 32× in singolo sono 320 passi al secondo per partita: costo trascurabile
  (8 core, 15 GB su il server).
- **Scala del tempo** fissa per partita nei duelli (D2); pausa e compressione solo in singolo.
- **Generatore pseudocasuale con seme** (sfc32/xoshiro128 su interi a 32 bit con `Math.imul`;
  la lezione dell'xorshift64 in PHP vale anche qui: niente aritmetica a 64 bit) → una partita
  rigiocata con lo stesso seme e gli stessi comandi dà le stesse istantanee **sullo stesso
  motore**. Serve alle prove.
- **Replay registrati, non ricalcolati**: istantanee della verità a 1 Hz più gli eventi,
  compressi su file. Ricalcolare nel browser non è affidabile perché `Math.sin` e simili non
  sono garantiti identici al bit fra motori JavaScript diversi.
- **Riconnessione**: se un client cade, la partita continua; l'**ufficiale di guardia** (lo
  stesso codice del bot, con dottrina prudente) tiene il battello. In classifica, dopo N minuti
  di assenza la partita è persa a tavolino.

### 4.4 Ponte di autenticazione

La pagina di gioco PHP, a sessione valida, rilascia un **biglietto** di 60 secondi
`{uid, nome, scadenza, nonce}` firmato HMAC-SHA256 con un segreto condiviso (in
`/data/termoclino-config/`). Il client lo presenta all'apertura del WebSocket; il server lo
verifica, controlla l'`Origin`, e lega l'utente alla connessione. Una riconnessione chiede un
biglietto nuovo. Nessuna sessione PHP letta dal server Node, nessuna password che transita sul
WebSocket.

### 4.5 Persistenza

- Il server di gioco scrive a fine partita, in una transazione: `matches`, `match_players`,
  statistiche del giocatore (colonne principali + JSON), il percorso del replay.
- **La logica del meta-gioco sta tutta in PHP**: un consumatore elabora le partite non ancora
  elaborate (valutazioni, gradi, medaglie, traguardi, statistiche globali), pigro alla lettura
  di una pagina e da cron ogni minuto — lo schema già usato negli altri progetti.
- Il server di gioco legge dal DB solo ciò che gli serve per abbinare i giocatori (valutazione,
  preferenze) e la configurazione.

### 4.6 Client

- **Classic**: Canvas 2D a risoluzione logica 320×200, ingrandito di un fattore intero con
  `image-rendering: pixelated`. Le stazioni originali sono le bitmap estratte più le zone
  sensibili; gli strumenti dinamici si disegnano nella stessa griglia di pixel e con la stessa
  palette.
- **Remastered**: risoluzione logica 1280×800. I pannelli, che nell'originale sono script di
  disegno (§8.1), si ridisegnano dallo stesso script a piena risoluzione; le bitmap vere (sale di
  controllo, sagome, ritratti) si ingrandiscono una volta per tutte in fase di estrazione con un
  algoritmo per pixel art (xBRZ o hq4x); mappa, waterfall, TMA e testi si disegnano in alta
  risoluzione. Effetto CRT facoltativo in WebGL.
- **Audio** (WebAudio): i suoni originali estratti; il **sonar in cuffia** sintetizzato dallo
  spettro ricevuto (rumore modellato + righe tonali), così un contatto si può anche *ascoltare*;
  voci dell'equipaggio facoltative generate offline con Piper (già installato su il server).
- **Lingue**: cataloghi di messaggi (italiano e inglese al lancio, D6). Le scritte disegnate
  nelle bitmap restano come sono: inglese sul 688, cirillico finto sull'Alfa, con Ctrl-R e in
  più un'opzione «russo vero» per le etichette ridisegnate.
- **Tastiera dell'originale**: F1-F10, Tab/frecce/cifre/lettere come da cartoncino del 1989, più
  mouse e scorciatoie configurabili dal profilo.

### 4.7 Messa in esercizio

- Codice in `/data/html/termoclino` (servito come `/termoclino/`); segreti in
  `/data/termoclino-config/config.php`; DB e utente MariaDB `trm_termoclino`.
- Contenitore `termoclino-server` legato a `127.0.0.1:<porta>`, rete dell'host per raggiungere
  MariaDB, `restart: unless-stopped`.
- Apache: `conf-available/termoclino.conf` con `ProxyPass /termoclino/ws ws://127.0.0.1:<porta>/`
  (`proxy_wstunnel` è già attivo, e `/bbs-ws` è già un precedente funzionante). Sotto
  sottopercorso e non su porta, per l'HSTS del vhost.
- `deploy/00-bootstrap.sh`: idempotente, da lanciare con sudo una volta sola (cartelle, DB,
  conf Apache con `configtest` prima del reload), collaudato su copia prima della consegna.

---

## 5. Simulazione

I numeri stanno in `shared/data/` con fonte e confidenza; le equazioni e i parametri in
`docs/SIMULAZIONE.md`; la ricerca da cui vengono in `docs/ricerca/`.

### 5.1 Mondo

- **Coordinate locali** per scenario (piano tangente, metri; quota positiva verso il basso).
  Le aree di gioco stanno sotto i 300 km di lato, dove l'errore della Terra piatta è
  trascurabile per il gioco. Latitudine e longitudine solo in visualizzazione.
- **Batimetria reale** ritagliata dalla griglia GEBCO per ogni zona delle missioni (Fær Øer,
  Barents, Gibilterra, Adriatico, Kunashir, piattaforma celtica, Baltico), disegnata nei toni
  della mappa originale.
- **Profilo di velocità del suono** dal World Ocean Atlas (NOAA, dominio pubblico) per zona e
  stagione, convertito con l'equazione di Mackenzie (1981).
- **Rumore ambiente** secondo le curve di Wenz: traffico, stato del mare, pioggia, biologici.

### 5.2 Unità di misura

- 688: piedi, iarde e migliaia di iarde (kyd), nodi, gradi veri.
- Alfa: **metri e cavi** (1 kabel't = 185,2 m), nodi, gradi: com'era sulle unità sovietiche.
- Il giocatore può forzare le proprie unità dal profilo.

### 5.3 Propagazione acustica

Due livelli:

1. **Fuori linea**: per ogni ambiente (profilo del suono + tipo di fondo + profondità media) si
   calcolano tabelle di perdita di trasmissione TL(distanza, quota sorgente, quota ricevitore,
   banda) con un tracciatore di raggi nostro, convalidato contro Bellhop (Acoustics Toolbox,
   M. Porter). Le tabelle contengono già strato, zona d'ombra, canale di superficie, zone di
   convergenza e rimbalzo sul fondo.
2. **In linea**: interpolazione nelle tabelle per ogni coppia sorgente-ricevitore e banda. Costo
   costante, nessun raggio tracciato durante la partita.

In F1 basta un'approssimazione analitica (divergenza sferica fino alla profondità del canale e
cilindrica oltre, assorbimento per bacino, penalità per l'attraversamento dello strato); le
tabelle arrivano in F2. Costo stimato delle tabelle: 6 bande × 8 × 8 classi di quota × 320 passi
di distanza ≈ 120.000 valori, meno di mezzo megabyte per ambiente.

Valori di riferimento dalla ricerca (`docs/ricerca/05_acustica.md`): prima zona di convergenza a
circa 31 miglia in Atlantico e Pacifico (anello di 3 miglia), circa 25 nel Mar di Norvegia e poco
affidabile, circa 20 nel Mediterraneo e solo d'estate; perdita attraverso lo strato fra 0 e 15 dB
secondo la sua forza (valore nozionale). Le scoperte lontane sono a bassa frequenza: su 30 miglia
l'assorbimento vale circa 0,6 dB a 300 Hz e 64 dB a 10 kHz. Attenzione: la formula di
assorbimento del testo dell'Accademia navale USA sottostima fino a 7 volte sotto i 5 kHz; si usa
Ainslie & McColm.

### 5.4 Rumore, sensori, nebbia di guerra

- **Rumore irradiato** per classe in funzione della velocità e del regime: banda larga, **righe
  tonali** (macchinari; frequenza delle pale = giri × numero di pale, che permette di contare le
  pale e classificare), cavitazione con velocità d'innesco che cresce con la radice della
  pressione, **transitori** (apertura dei portelli dei tubi, lancio, scricchiolii dello scafo
  nei cambi di quota, pompe).
- **Rumore proprio** in funzione della velocità (flusso sugli idrofoni) e dei macchinari;
  **baffles** a poppa.
- **Sensori**: sfera di prua e array conforme; towed array (con l'ambiguità destra/sinistra e la
  degradazione in accostata); ricevitore d'intercettazione (sente i ping e le teste dei siluri da
  molto lontano); sonar attivo (dà la distanza, ma ti fa sentire a distanza molto maggiore); sonar
  ad alta frequenza a corto raggio per fondo, ghiaccio e mine (l'erede onesto del «contour
  imaging»: rilevabile, ma solo da vicino); periscopio con **stadimetro** (la distanza si stima
  dall'altezza d'albero del bersaglio); ESM e radar.
- **Equazione del sonar** per banda: eccesso di segnale = SL − TL − rumore (ambiente ⊕ proprio)
  + guadagno d'antenna − soglia. Ne escono, ogni secondo, **misure**: energia per settore di
  rilevamento, righe spettrali visibili, transitori, ciascuna col proprio errore.
- **Solo queste misure arrivano al client.** Il waterfall che il giocatore guarda è disegnato
  da dati veri; le posizioni vere non lasciano mai il server.

Dati dei sensori dalla ricerca (`docs/ricerca/04_sensori.md`):

- **Sfera BQQ-5 / BQS-13** del 688: circa 4,5 m, 1.241 elementi, passivo 0,5-5 kHz, attivo
  intorno ai 3,5 kHz. **BSY-1** solo sui 688I, dal settembre 1989 (SSN-755), con molti problemi
  documentati dal GAO.
- **TB-16**: array di 240 ft su 2.400 ft di cavo. Proposte nozionali derivate: 6-8 minuti per
  filarlo, almeno 3 nodi, degrado oltre gli 8, limite meccanico 15-18; dopo un'accostata il cavo
  torna utilizzabile in circa (cavo + array) / velocità, cioè **circa 5 minuti a 5 nodi**. Il
  TB-23 non forma fasci mentre si manovra.
- **Alfa: nessun towed array** nell'elenco del materiale. Il Victor III lo porta nella gondola
  sulla deriva (Skat-KS); il «Pelamida» stava solo su due Typhoon e due Foxtrot.
- Lato sovietico c'è un sensore **non acustico** documentato, il SOKS «Tukan» (anomalie di
  temperatura, conducibilità e radioattività nella scia), in pattugliamento dal 1977 e montato
  sugli Akula: un'asimmetria interessante per le classi di F7.
- Precisione di rilevamento: vedi la formula armonizzata in §5.6.
- Le contraddizioni fra le sezioni della ricerca (19, più 8 lacune: per esempio sensori del 688I
  che sono in realtà degli anni '90, il MOSS che stava solo sugli SSBN, lo scarto di rumore fra
  Akula e Victor III) sono raccolte in `docs/ricerca/CONTRADDIZIONI.md` e vanno risolte prima di
  scrivere i dati di F2.

Le curve di partenza (nozionali dove la realtà è classificata, con il ragionamento in
`docs/ricerca/05_acustica.md` §7):

- **Rumore proprio** sulla sfera di prua: `NL(v) = 45 + 10·log(1 + (v/8)^6)` dB nella banda di
  1 kHz. A 5 nodi resta sotto il rumore del mare forza 2, a 15 comincia a dominare, a 25 nodi sei
  sordo. È la regola «per ascoltare si rallenta» che rende sensato lo scatto-e-deriva. Il towed
  array diventa inutile intorno ai 10-12 nodi.
- **Cavitazione**: velocità d'innesco `V(d) = V_rif · √((d + 10,1 m) / (d_rif + 10,1 m))`, cioè
  con la pressione **assoluta** (la formula del testo USNA, proporzionale alla sola profondità,
  sbaglia vicino alla superficie). Proposta: 688 a 8 nodi con l'elica a 20 m, 18,5 a 150 m, 25,6
  a 300 m; Alfa a 6 / 14 / 19 nodi. All'innesco +15-20 dB sopra 1 kHz.
- **Rumore irradiato**: `SL(v) = SL₀ + 20·log(max(v,3)/5)` più il salto di cavitazione, +3 dB di
  poppa e −2 dB di prua; SL₀ per classe su una scala a gradini. L'**ordine** è documentato (grafico
  dell'ONI del 1996 e testimonianze raccolte da Coté), i **decibel** sono nozionali: 688I = 0, 688
  Flight I +1, Akula I +2, Sierra +3, Sturgeon +5, Victor III +5 (ultimi) / +8 (primi), Alfa +14
  con una pendenza in più di circa 1 dB per nodo oltre i 15 nodi («extremely noisy at high
  speeds»), Victor I +20. Scala completa a 23 voci in `docs/ricerca/01_piattaforme.md` §3.3.
  Le righe tonali hanno livelli fissi per piattaforma, e
  alcune (pompe del refrigerante) si accendono solo oltre una certa velocità: un **cambio di
  regime** che si sente e che il giocatore può sfruttare.

### 5.5 Dinamica del battello

Ordini di macchina (1/3, 2/3, STD, FULL, FLANK, REV) → giri → velocità con inerzia; raggio di
accostata funzione della velocità; quota con timoni orizzontali, assetto e auto-quota; quota di
collaudo e di collasso con danno da pressione; urto col fondo; emersione d'emergenza
(rumorosa); towed array con tempi di dispiegamento, limite di velocità e taglio del cavo.

### 5.6 Contatti e TMA

- L'equipaggio forma le **tracce** (Sierra-1, Sierra-2… sul 688; designazioni sovietiche
  sull'Alfa) dalle misure, le classifica dalle righe tonali e stima la soluzione di moto
  (distanza, rotta, velocità) con uno **stimatore ai minimi quadrati sui soli rilevamenti**, con una qualità
  che dipende dal tempo e dalle manovre del proprio battello (senza un cambio di gamba la
  distanza non è osservabile: è fisica, non un capriccio del gioco).
- Strumenti manuali per chi vuole fare da sé: velocità di variazione del rilevamento, distanza
  di Ekelund, tabella a punti e cursori di soluzione alla maniera del MATE.
- **Livelli di assistenza**:

| Livello | Il giocatore | L'equipaggio | Modello storico |
|---------|--------------|--------------|-----------------|
| 0 — Manuale | Legge il diagramma tempo-rilevamento, sceglie i lati, usa Ekelund e il plot con le strisce di velocità | Solo misure e grafici | Anni '50-'60, pratica NATO sui battelli diesel |
| 1 — MATE | Imposta una soluzione di prova e la regola finché i residui si allineano | Mostra i residui, calcola Ekelund a ogni cambio di lato, avvisa quando i lati non bastano | Controllo del tiro digitale degli anni '80 |
| 2 — Auto-TMA | Fa solo le manovre (l'equipaggio suggerisce: «accosti di 90° a sinistra per 6 minuti») | Stimatore a massima verosimiglianza: soluzione, ellisse d'incertezza, qualità Q, preset d'arma proposti | Stimatore automatico (MLE) |
| 3 — 1989 | Niente | Dopo il «fix» la **lettera esatta** sulla mappa, come nell'originale | *688 Attack Sub* |

Il livello 2 è il predefinito dei duelli: la soluzione dipende ancora dalle manovre giuste, che
fanno rumore, dal tempo e dal silenzio, ma nessuno deve fare trigonometria sotto pressione.

I numeri che il gioco deve rispettare (dalla ricerca, `docs/ricerca/06_tma.md`): senza manovra
del proprio battello la distanza **non è osservabile**, per quanti rilevamenti si raccolgano
(teorema, non regola di gioco); la TMA manuale richiedeva 25-40 minuti. Con tre lati l'errore di
distanza migliore possibile (limite di Cramér-Rao) è circa il **10% con un errore di rilevamento di
0,5°, il 30% con 1,5°, il 60% con 3°**: la precisione dei sensori decide quanto deve manovrare chi
caccia, ed è il numero più importante da tarare. Proposta armonizzata (nozionale):
`σ = max(σ_min, 0,5 · ampiezza del fascio · 10^(−SE/20))`, che dà 0,5° solo su segnali molto
forti. La soglia di «soluzione di tiro» proposta è Q ≥ 70%.

### 5.7 Equipaggio

Ufficiale di guardia, sonarista, centrale di tiro, capo della sala macchine, controllo danni.
Rapporti nel nastro dei messaggi con i ritratti originali; deleghe (auto-quota, schivata
automatica, gestione dei tubi). L'ufficiale di guardia è anche chi tiene il battello se cadi la
linea.

### 5.8 Armi e contromisure

- **Siluri**: per tipo, velocità e portata per ciascuna impostazione di velocità, quote limite,
  filo con la sua lunghezza e le condizioni di rottura (velocità propria, accostate, chiusura del
  portello), distanza di abilitazione, tetto e pavimento, ricerca a serpentina o a cerchio, testa
  passiva o attiva con il suo cono, riattacco, **siluri a scia sovietici** (solo antinave, ciechi
  alle esche). Testata e letalità in funzione della distanza di scoppio.
- **Esche**: noisemaker fissi e simulatori mobili, con tempi e durate.
- **Missili**: Harpoon e Tomahawk antinave lanciati in immersione dai tubi; l'SS-N-16 «Vodopad»
  con siluro UMGT-1 (fino a 50 km) sulle classi sovietiche di F7; il *Sea Lance* dell'originale
  solo come «e se?» dichiarato (fu cancellato).
- **Mine** negli scenari che le prevedono.
- **Niente armi nucleari**, come decisero Ratcliff e Grace nel 1989 («dovrete fingere di averle
  già usate tutte»). Conseguenza che va detta: nel periodo erano nucleari il **SUBROC**, l'**SS-N-15**
  e lo **Shkval**, quindi né il 688 né l'Alfa hanno un'arma antisommergibile a distanza
  convenzionale; ce l'hanno invece Victor III, Sierra e Akula con l'SS-N-16 a siluro: un'asimmetria
  in più per F7. Le armi nucleari restano al massimo in un'impostazione separata, mai in classifica.

**I due battelli del duello**, dalla ricerca (`docs/ricerca/01_piattaforme.md` e `02_armi.md`):

| | 688 | Alfa (progetto 705/705K) |
|---|---|---|
| Velocità massima | 30-32 nodi reali (ufficialmente «oltre 20», poi «oltre 25») | 41 nodi, tutta forza in circa un minuto |
| Quota | collaudo 950 ft (290 m), collasso circa 1.475 ft | operativa 320 m, limite 400 m: **scende più del 688** |
| Equipaggio | 12-13 ufficiali + 115-116 | 32, turno di combattimento di 8 (automazione spinta) |
| In servizio | flotta numerosa; Flight II (VLS) da 1985, 688I da 1988 | 5 operativi fra 1985 e 1989, **nessuno dal 1990** |
| Tubi | 4 × 533 mm a centro nave, angolati | 6 × 533 mm a prua, caricamento rapido, tiro a ogni quota |
| Armi | 26 (Mk 48, Harpoon, Tomahawk, mine Mk 67); dal SSN 719 (1985) anche 12 VLS per Tomahawk | 20 siluri SET-65 / SAET-60, oppure 24 mine |
| Siluro | Mk 48 Mod 4 a **filo**, due regimi (40 / 55 nodi); ADCAP dal 1988 | Testa attiva/passiva, **senza filo**; portata attiva del seeker circa 800 m |
| Contromisure | ADC Mk 2 dai lanciatori da 3 pollici (in servizio dal 1978; il Mk 3 è del 1992, fuori finestra) | Simulatori semoventi MG-44 «Korund» e dispositivi alla deriva MG-54 «Magma»; dotazione dell'Alfa non documentata, proposta nozionale 2 simulatori + 4 alla deriva |
| Rapporto di velocità contro l'avversario | Mk 48 Mod 4 contro Alfa: 55/41 = **1,34**, sotto la regola di progetto dell'1,5:1; ADCAP a ~63 nodi: 1,54 | — |

Proposte di bilanciamento (nozionali, con ancoraggio): Mk 48 Mod 4 a 40 nodi per 40.000 iarde e
a 55 per 32.000; ADCAP 40 / 60 nodi per 50.000 / 38.000 iarde; seeker attivo del Mk 48 a 2.000
iarde contro un sottomarino, dell'ADCAP a 3.000; rottura del filo con probabilità per minuto
crescente oltre i 12 nodi propri e nelle accostate strette. Un Mk 48 a 55 nodi si sente a 8-10
km: il lancio avverte il bersaglio, e il controfuoco lungo il rilevamento del siluro in arrivo
(lo *snap shot*) è sempre possibile.

**Selettore d'anno** negli scenari, perché la disponibilità cambia dentro la finestra:

| | 1985-87 | 1988 | 1989 | 1990-91 |
|---|---|---|---|---|
| Mk 48 ADCAP | no (solo prove) | prime unità («operativo», primo lancio con testata il 23/07/1988) | produzione piena da febbraio, poche unità | carico misto, poi prevalente |
| VLS sui 688 | dal SSN 719 | sì | sì | sì |
| SUBROC (nucleare) | sì | sì | in rimozione | no |
| *Sea Lance* | mai | mai | mai | cancellato |
| USET-80 (sovietico) | sì | sì | sì | sì |
| Alfa operativi | 5 | 5 | 5 | **nessuno**: gli scenari 1990-91 usano Victor III, Akula, Sierra |

L'elenco di ciò che non deve mai comparire fra 1985 e 1991 (Mk 48 Mod 6/7, Mk 54, Mk 50 su un 688,
siluri filoguidati sull'Alfa, Shkval convenzionale con guida…) è in `docs/ricerca/02_armi.md` §2.8.

### 5.9 Danni

Compartimenti e sistemi (sfera sonar, towed array, periscopi, ESM, propulsione, timoni, tubi,
centrale di tiro, zavorra, aria compressa); allagamento con portata funzione della quota; pompe;
squadre di controllo danni con riparazioni parziali e lente. Lo scuotimento dello schermo e il
lampo rosso del 1989 restano (con l'opzione Ctrl-D dell'addendum per chi non li vuole).

### 5.10 Intelligenza artificiale

- **Capitano IA** che usa solo il proprio quadro dei sensori, con dottrine diverse per lato e per
  classe (Alfa: prima la salva, poi la fuga in velocità, come dicono le fonti sovietiche; ping più
  disinvolto; americana: lenta, silenziosa, siluro a filo da lontano).
- **Forze di contorno** (dipende dallo scenario): elicotteri con sonar a immersione e boe,
  pattugliatori marittimi (P-3C, Il-38), scorte di superficie, traffico mercantile neutrale,
  biologici. In un duello possono essere **chiamate**: per farlo bisogna salire a quota
  periscopica e trasmettere, esponendosi all'ESM. La sala radio del 1989 ritrova un senso.

### 5.11 Bilanciamento

Comando `bilancia`: migliaia di duelli bot-contro-bot senza grafica, a tempo massimo, per
scenario, lato e livello d'assistenza; rapporto con percentuali di vittoria, tempi di primo
rilevamento, distanze di ingaggio. Serve a regolare gli scenari prima che li giochino gli umani
e a stimare il vantaggio di lato per la valutazione.

### 5.12 Il ritmo

Il 1989 accorciava le distanze per fare in fretta. Noi teniamo le distanze vere e diamo ritmo
con:

- scenari che partono a distanze sensate (il pedinatore già a 3-5 miglia in *Shake 'Em*);
- **strettoie** geografiche reali (Gibilterra, Kunashir, gli stretti danesi);
- obiettivi con **limite di tempo** e un'area operativa (uscirne chiude la partita, come nel 1989
  il CINC chiudeva la missione a chi «perdeva la barca»);
- in duelli amichevoli, scala del tempo 1:2 o 1:4 scelta in lobby.

Le distanze vere aiutano più di quanto sembri. Due battelli silenziosi si scoprono a poche
migliaia di iarde (un Akula contro un 688: 3-10.000 iarde, spesso su un transitorio), e la
distanza massima da cui un siluro raggiunge un bersaglio che fugge in linea retta è
`R₀ = autonomia · (1 − V_bersaglio / V_siluro)`: contro l'Alfa a 41 nodi viene 8.800 iarde per il
Mk 48 a 55 nodi e zero per il Mk 48 a 40. Il duello vero si combatte già sotto le dieci miglia.
La fase lenta è la **ricerca**, ed è quella che gli scenari devono accorciare.

---

## 6. Rete e protocollo

- **WebSocket JSON** (binario solo per i fotogrammi del waterfall se servirà). La latenza
  conta poco in un simulatore di sottomarini: un comando arriva in decine di millisecondi, un
  battello impiega minuti ad accostare.
- **Dal client al server**: ordini come quelli veri — «timone 15 a dritta», «quota 150»,
  «macchina 2/3», «tubo 1: carica Mk 48», «lancia», «filo: dirigi su 045», «dispiega towed
  array». Ognuno validato e limitato in frequenza.
- **Dal server al client**: stato del proprio battello a 4 Hz; misure dei sensori a 1 Hz di tempo
  di gioco; tracce e rapporti dell'equipaggio; eventi (transitori, colpi, danni).
- **Mai**: posizioni, rotte o identità vere di altri battelli. Il debriefing a fine partita è
  l'unico momento in cui arriva la verità, e a partita chiusa.
- Specifica in `docs/PROTOCOLLO.md`, con versione del protocollo e prove di compatibilità.

---

## 7. Meta-gioco

### 7.1 Account e profilo

Dal Core: arruolamento con conferma per e-mail, accesso, recupero password, limiti di
frequenza. Profilo: lato preferito, unità di misura, lingua, livello di assistenza in singolo,
tasti, resa Classic/Remastered, volume e voci.

### 7.2 Lobby

Presenza in tempo reale; **sfide aperte** in bacheca; **sfida diretta** a un giocatore
collegato; **partita privata con codice** da passare a un amico (anche via e-mail dal sito);
scelta di scenario, lato, regole, scala del tempo; chat di lobby; «sfida il bot» sempre
disponibile (con una popolazione piccola è ciò che tiene viva la lobby).

### 7.3 Matchmaking

- **Classificata**: coda unica; scenario estratto da una rosa; lati **alternati** fra un
  incontro e l'altro; regole e assistenza fisse per coda; abbinamento per valutazione con
  tolleranza che si allarga nell'attesa.
- **Amichevole**: tutto libero, nessun effetto sulla valutazione.

### 7.4 Valutazione

**Glicko-2** (Glickman, 2012), aggiornata partita per partita: punteggio, deviazione e volatilità.
Al punteggio atteso si aggiunge un **termine di vantaggio di lato per scenario**, stimato da tutte
le partite in classifica (e, all'inizio, dalle prove del bot). Così vincere con l'Alfa in uno
scenario che favorisce il 688 vale di più. Storico della valutazione per giocatore.

### 7.5 Gradi

Si guadagnano con il **merito** (partite, obiettivi, prestazione), non con la valutazione, e non si
perdono. Si mostrano nella scala del lato che si sta giocando:

| Livello | US Navy | Marina sovietica |
|---------|---------|------------------|
| 1 | Ensign | Лейтенант |
| 2 | Lieutenant (junior grade) | Старший лейтенант |
| 3 | Lieutenant | Капитан-лейтенант |
| 4 | Lieutenant Commander | Капитан 3-го ранга |
| 5 | Commander | Капитан 2-го ранга |
| 6 | Captain | Капитан 1-го ранга |
| 7 | Rear Admiral (lower half) | Контр-адмирал |
| 8 | Rear Admiral | Вице-адмирал |
| 9 | Vice Admiral | Адмирал |
| 10 | Admiral | Адмирал флота |

I gradini 1-6 corrispondono davvero. Dal 7 in su la corrispondenza è **per gradino del gioco, non
per codice NATO**: il контр-адмирал equivale al Rear Admiral (OF-7), la marina sovietica non ha un
equivalente del Rear Admiral (lower half) (OF-6), e la US Navy non ha in tempo di pace un
equivalente dell'адмирал флота. La **qualifica sommergibilisti** («Dolphins» / distintivo sovietico) si ottiene
completando TORPEX '89, come nel manuale il tutorial.

### 7.6 Decorazioni, traguardi, statistiche

- **Decorazioni** storiche per lato, con criteri e motivazioni generate (lo schema di Atlantik).
- **Traguardi** distinti dalle decorazioni, molti e vari. Esempi: *Tonno in scatola* (il manuale:
  «turn the other guy into canned tuna» — affondare l'avversario col primo siluro); *Fantasma*
  (vincere senza essere mai rilevati); *Sotto lo strato*; *Zona di convergenza* (rilevare oltre le
  25 miglia); *Filo d'Arianna* (colpire con un siluro guidato dopo 10 minuti di corsa); *Torero*
  (schivare tre siluri in una partita); *Orecchio fino* (classificare l'avversario dalle sole righe
  tonali); *Nessuna lettera* (vincere ad assistenza 0); *Ritorno a casa* (le dieci missioni con
  entrambi i lati); *Il capo è passato* (il tasto F10).
- **Statistiche personali e globali**. Le più significative in un duello di sottomarini:
  **vantaggio di rilevamento** (chi ha sentito chi per primo, e con quanto anticipo), qualità
  della soluzione al momento del lancio (errore di distanza in %), rumore proprio medio, tempo
  sotto lo strato e a quota periscopica, ping emessi, siluri lanciati, a segno e schivati, fili
  rotti, esche usate, distanza media d'ingaggio. Globali: vittorie per lato e scenario, efficacia
  delle armi, mappe di calore degli ingaggi.

### 7.7 Singolo

- **Campagna 1989**: le dieci missioni rifatte su batimetria vera, con entrambi i lati dove
  l'originale li prevedeva e nuovi lati dove ha senso.
- **Scenari liberi** e un formato di scenario documentato (JSON) per aggiungerne.
- **Debriefing del CINC** a fine missione («warm praise or cold shoulder»), con la verità
  rivelata.

### 7.8 Storico e replay

Ogni partita ha la sua pagina: esito, statistiche, linea del tempo dei rilevamenti di entrambi, e
il **replay con la verità** (le due tracce sulla mappa, i cerchi di rilevamento, i siluri).

---

## 8. Asset originali

### 8.1 Cosa c'è nella cartella

**Quasi tutto si decifra.** Formati, tabelle e inventario completo in `docs/ASSET.md`; nessun
codice sorgente del gioco è mai stato pubblicato, e prima di noi esisteva solo la decodifica di
`.PAK`/`.PAL` e `MAIN.EGA` (canadianavenger, 2024). Il resto è lavoro nuovo, verificato
confrontando ogni decodifica con il gioco che gira in DOSBox.

| Cosa | Formato | Stato |
|------|---------|-------|
| Eseguibili | compressi con EXEPACK | decompressi; `TITLE.EXE` conserva perfino i simboli di Turbo Debugger |
| Librerie `.MLB` (205 voci) | indice in chiaro + membri contigui | complete |
| Compressione `.LZW`/`.LZA` | LZW da 8 a 12 bit | 34 file su 34, alla dimensione esatta |
| Immagini (`.ENC` e figure LZW) | 16 colori, RLE per riga, righe dal basso | 139 su 139; palette di ciascuna ricavata dal codice di disegno |
| Sale di controllo, titolo | `.PAK` + `.PAL` grezzi 320×200 | complete, versioni VGA ed EGA |
| **Pannelli delle stazioni** | **non sono immagini ma script `.CLS`**: un piccolo linguaggio di disegno a 31 primitive, con sottoprogrammi | interpreti in Python e in JavaScript identici pixel per pixel su 49 pannelli e conformi alle catture DOSBox; lo stato vivo (mappa, cifre, spie) lo disegna il codice C del gioco sopra il pannello, quindi lo disegna il nostro client |
| Scenari `.TOK` | linguaggio a 118 istruzioni | 22 file su 22 disassemblati fino all'ultimo byte; posizioni, rotte, armi e IA di **ogni unità di ogni missione** estratte |
| Suoni `.T` | PCM a 4 bit | convertiti in WAV; la frequenza esatta è stimata (4.000-6.500 Hz), da misurare registrando DOSBox |
| Font | dentro `GAME.EXE` | 224 caratteri (20h-FFh): due corpi di maiuscole, simboli, cirillico finto (Ц Щ Ч usate per U, W, Y) |
| Protezione anticopia | `HELICOP.ENC`, travestito da immagine | le 153 domande e risposte |

Che cosa c'è: le sale di controllo del 688 e dell'Alfa; 93 sagome al periscopio (13 classi in 5
angoli, la Nimitz in 8, più lancio di missile, esplosioni e fumo; le sagome dell'elicottero
Ka-25 sono richiamate ma mancano nei file); 8 ritratti dell'equipaggio (foto digitalizzate di
dipendenti EA, secondo il blog di Ratcliff); 23 elementi d'interfaccia, compresa una targhetta
«TOSHIBA MADE IN JAPAN» sul sonar sovietico (lo scandalo Toshiba del 1987); 7 mappe di profondità
a 16 livelli; i suoni (esplosione, lancio, ping, due eliche, canto di balena); i testi di ordini e
rapporti; la scrivania del rapporto finale e le quattro cartoline di fine missione (condoglianze
della US Navy, San Francisco, Lenin con «Comrade, the Navy regrets…», saluti da Mosca).

Tre scoperte che cambiano il piano:

1. **Il gioco non ha una tabella delle navi.** Velocità, quote, robustezza, armi e IA di ogni unità
   stanno negli script delle singole missioni, e perfino il battello del giocatore è definito dallo
   script. Le dieci missioni si possono quindi rifare **con le posizioni e le rotte originali**
   (unità di misura ricostruite: velocità in 1/320 di nodo, quota in 1/8 di piede, rotta in
   9000 parti, posizione in unità di 2 secondi d'arco).
2. **I pannelli sono script, non bitmap.** Portando l'interprete `.CLS` in JavaScript, i pannelli
   originali si possono ridisegnare a qualunque risoluzione: la modalità Remastered diventa una
   resa vettoriale nitida dello stesso disegno, non solo un ingrandimento di pixel.
3. **La vista al periscopio e il contour imaging non sono immagini**: li generava al volo un motore
   di «height field» dalle mappe di profondità. Vanno rifatti, e con la batimetria GEBCO vera
   vengono meglio dell'originale.

Le sonorità delle firme sonar del 1989 erano un unico campione d'elica a cui il gioco cambiava
l'intonazione secondo il tipo di nave: anche qui il nostro modello a righe tonali è un passo vero
in avanti.

### 8.2 Estrazione

`tools/estrai/estrai688.py` (Python 3 + Pillow, già funzionante: 808 file in 4 secondi) legge la
cartella originale **dell'utente** senza modificarla ed estrae PNG, WAV, disassemblati e tabelle.
In F0 gli si aggiungono la verifica delle impronte MD5 (versione supportata: `GAME.EXE` del
12/06/1989, 932eac8c…) e l'uscita nel formato che serve al client, dentro
`web/assets/originali/`, esclusa dal repo e servita solo dopo l'accesso. Da confrontare con le copie dell'Internet
Archive: le sagome del Ka-25 e una palette MCGA mancanti fanno pensare a edizioni diverse.

### 8.3 Diritti

- Progetto amatoriale, non ufficiale, senza scopo di lucro, non affiliato a Electronic Arts né a
  John W. Ratcliff; rimosso su richiesta degli aventi diritto (formula già usata negli altri
  progetti basati su opere altrui).
- **Nessun asset originale nel repo pubblico.** Il README spiega come estrarli da una copia
  propria.
- Il nome *688 Attack Sub* non si usa come titolo; si cita come opera di riferimento.
- **Chi ha fatto cosa** (manuale e *Computer Gaming World*, ottobre 1989): progetto di John
  Ratcliff, Paul Grace e Randall Breen; programma «© 1988 John Ratcliff»; **grafica di Michael
  Kosaka e Wilfredo Aguilar**; musica di **Rob Hubbard**; manuale © Electronic Arts. I diritti
  sulla grafica quindi potrebbero non essere di Ratcliff ma dell'editore, a seconda dei contratti
  del 1988.
- **Proposta**: scrivere comunque a John W. Ratcliff, che è pubblicamente attivo e il primo
  interlocutore naturale, per chiedere il permesso e, se lui non può darlo, a chi rivolgersi.
  Posso preparare la lettera; la spedisci tu (D13).
- Il servizio è aperto alla registrazione (D4): la grafica originale compare solo nel client di
  gioco dopo l'accesso, mai nelle pagine pubbliche. È comunque il punto in cui il rischio è
  maggiore, e la ragione per scrivere a Ratcliff prima del lancio.

---

## 9. Struttura delle cartelle

```
Termoclino/
├── README.md
├── docs/
│   ├── PROGETTO.md            questo documento
│   ├── ORIGINALE.md           cosa faceva il gioco del 1989: manuale, eseguibile, prove in DOSBox
│   ├── ASSET.md               inventario e formati dei file originali
│   ├── SIMULAZIONE.md         modelli, equazioni, parametri
│   ├── PROTOCOLLO.md          messaggi fra client e server, con versione
│   └── ricerca/               catalogo di ricerca (01-08), FONTI.md, CONTRADDIZIONI.md
├── privato/                   MAI nel repo pubblico: fonti scaricate, copie di lavoro
├── shared/                    moduli ES usati sia dal server sia dal browser
│   ├── units.js  geo.js  rng.js  protocol.js  tma-aids.js
│   └── data/                  piattaforme, armi, sensori, ambienti, scenari (JSON con fonte e confidenza)
├── server/                    server di gioco: Node.js 24, in Docker
│   ├── Dockerfile  compose.yaml  package.json  jsconfig.json
│   ├── src/
│   │   ├── main.js
│   │   ├── gateway/           WebSocket, biglietti, limiti di frequenza
│   │   ├── lobby/             presenza, sfide, code, matchmaking
│   │   ├── match/             ciclo della partita, scala del tempo, riconnessione, registrazione
│   │   ├── sim/
│   │   │   ├── world/         ambiente, batimetria, propagazione
│   │   │   ├── platform/      dinamica, propulsione, rumore, danni
│   │   │   ├── sensors/       passivo, attivo, towed array, intercettazione, periscopio, ESM
│   │   │   ├── contacts/      tracce, classificazione, TMA dell'equipaggio
│   │   │   ├── weapons/       siluri, filo, esche, missili, mine
│   │   │   └── crew/          automazione, rapporti, ufficiale di guardia
│   │   ├── ai/                capitano IA, forze ASW, traffico, biologici
│   │   └── store/             esiti e replay su MariaDB e file
│   └── test/
├── web/                       applicazione PHP: copiata cosi' com'e' in /data/html/termoclino
│   ├── index.php              front controller (Apache nega src/, views/, bin/, db/...)
│   ├── assets/
│   │   ├── css/  img/
│   │   ├── js/client/         il client di gioco: stazioni, resa, rete, audio, ingressi
│   │   ├── shared/            in sviluppo la serve index.php da ../shared, in esercizio una copia
│   │   └── originali/         generata dall'estrattore, MAI nel repo, servita solo dopo l'accesso
│   ├── src/
│   │   ├── Core/              portato da Cento Gradini (nato in Atlantik)
│   │   ├── Auth/              arruolamento, conferma, accesso, recupero
│   │   ├── Gioco/             biglietto firmato, server di gioco
│   │   ├── Meta/              (F6) Glicko-2, gradi, decorazioni, traguardi, statistiche
│   │   └── Controllers/
│   ├── views/
│   ├── db/migrations/
│   └── bin/                   console.php (migrate, user:*, mail:*, config:*), tick.php (cron)
├── tools/
│   ├── estrai/                estrattore dei file originali + verifica MD5
│   ├── acustica/              generatore delle tabelle di propagazione
│   ├── batimetria/            ritaglio GEBCO per scenario
│   └── bilancia/              duelli bot-contro-bot in serie e rapporto
├── deploy/
│   ├── 00-bootstrap.sh        (sudo, una volta) cartelle, DB, segreti, conf Apache
│   ├── 01-apache.sh           (sudo) solo la conf Apache, se cambia
│   ├── 02-pubblica.sh         copia nel DocumentRoot, migrazioni, grafica, contenitore
│   ├── 03-repo-pubblico.sh    deriva la copia pubblica, con le guardie (solo nel privato)
│   └── apache-termoclino.conf
└── tests/                     prove end-to-end, compatibilita' PHP/JS, tutte.sh
```

---

## 10. Roadmap

Fasi come negli altri progetti; ognuna si chiude con prove verdi e qualcosa che si può provare
nel browser.

| Fase | Nome | Contenuto | Fatta quando |
|------|------|-----------|--------------|
| **F0** | Fondamenta | Nome, documenti, estrattore degli asset, scheletro PHP con il Core (arruolamento e accesso), scheletro del server Node in Docker con biglietti, bootstrap, prove | Ci si registra, si apre la pagina di gioco e il WebSocket risponde con l'utente giusto; gli asset estratti si vedono |
| **F1** | Prima immersione | Ciclo della partita, dinamica del battello, area TORPEX con batimetria vera, sonar passivo a banda larga analitico, bersagli in moto, CONN + Ship's Control + Navigation Board + Sonar (waterfall) in resa Classic | **Due browser, due 688 nella stessa acqua**: ognuno sente l'altro solo come traccia sul waterfall (vedi §11) |
| **F2** | Ascoltare | Tabelle di propagazione, righe tonali e LOFAR, towed array con ambiguità, attivo, intercettazione, periscopio con le sagome originali e lo stadimetro, ESM, tracce e TMA dell'equipaggio, stazione TMA | Un contatto si rileva, si classifica e si risolve in TMA ai quattro livelli di assistenza |
| **F3** | Colpire | Siluri completi, filo, esche, missili, danni per compartimento e controllo danni, Weapon Control e Status | Si affonda un bersaglio e si schiva un siluro in modo credibile |
| **F4** | Il mondo del 1989 | Capitano IA, forze ASW, traffico, biologici, le dieci missioni ricostruite dagli script originali (posizioni, rotte, dotazioni) su batimetria vera, formato degli scenari, debriefing del CINC con le cartoline originali, singolo completo | La campagna si gioca da capo a fondo con entrambi i lati |
| **F5** | Il duello | Lobby, sfide e codici, ciclo di vita della partita, riconnessione e ufficiale di guardia, resa, chat radio, scenari di duello, replay con la verità | Due giocatori si sfidano, uno cade e rientra, a fine partita rivedono tutto |
| **F6** | Carriera | Glicko-2 con vantaggio di lato, classificata e amichevole, gradi, decorazioni, traguardi, statistiche personali e globali, storico | Le pagine pubbliche mostrano classifica e statistiche vere |
| **F7** | Profondità | Altre classi (688I, Sturgeon, Victor III, Akula, Kilo…), armi per anno, mine, selettore d'anno, bilanciamento col bot | Il rapporto di bilanciamento è dentro le bande stabilite per ogni scenario in classifica |
| **F8** | Rifinitura | Remastered, audio e sonar in cuffia, voci, tutorial contestuale, aiuto F1 per ogni comando, accessibilità, pannello admin | — |

---

## 11. Milestone 1: F0 + F1, «Prima immersione»

Obiettivo: **la prova che l'architettura regge**, con il minimo di simulazione già vera. Niente
armi, niente TMA, niente lobby.

### 11.1 F0 — Fondamenta

1. Nome definitivo (D5), coppia di repo privato/pubblico con identità dei commit neutra, guardie
   dello script di pubblicazione (niente asset, testi originali e fonti scaricate nel pubblico).
   I documenti di partenza ci sono già: questo, `ORIGINALE.md`, `ASSET.md`, `ricerca/`.
2. **Estrattore**: il decodificatore esiste già (`tools/estrai/`); in F0 gli si aggiungono la
   verifica MD5, l'uscita per il client (sale di controllo, font, elementi d'interfaccia, sagome)
   e il primo porting in JavaScript dell'interprete `.CLS` per i pannelli.
3. **Web PHP**: Core portato dalla versione più aggiornata fra i progetti, front controller, rotte
   `/arruolamento`, `/accesso`, `/verifica`, `/plancia`, migrazioni iniziali, console.
4. **Server Node** in Docker: gateway WebSocket, verifica del biglietto e dell'`Origin`,
   ping/pong, registro, limiti di frequenza, `node:test`, `tsc --checkJs`.
5. **Bootstrap** sudo (cartelle, DB, conf Apache con il ProxyPass del WebSocket), collaudato su
   copia.
6. `shared/`: unità, geometria, generatore con seme, protocollo v0; `data/` con il 688 e l'Alfa
   (valori con fonte e confidenza).

### 11.2 F1 — Prima immersione

7. **Ciclo della partita**: passo di 0,1 s, scala del tempo, pausa (solo singolo), istantanee a 1
   Hz su file.
8. **Dinamica**: macchina → giri → velocità con inerzia; timone con raggio di accostata funzione
   della velocità; quota con timoni orizzontali e auto-quota (150 ft, quota periscopica,
   emersione d'emergenza) — i timoni orizzontali agiscono solo con la nave in moto, non come nel
   1989 dove si scendeva a 18 ft al secondo da fermi; urto col fondo; quota di collasso;
   cavitazione con innesco funzione della quota; towed array (dispiegamento, limite di velocità,
   taglio).
9. **Ambiente**: area di TORPEX '89 (Fær Øer) con batimetria GEBCO ridotta a griglia; uno strato
   con la sua profondità; rumore ambiente dallo stato del mare.
10. **Sonar passivo analitico**: equazione del sonar a banda larga, rumore proprio con la
    velocità, baffles, errore di rilevamento funzione del rapporto segnale/rumore; uscita = energia
    per settore ogni secondo.
11. **Bersagli**: tre Forrest Sherman su rotta, un mercantile, biologici.
12. **Client Classic**: CONN (la sala di controllo originale con zone sensibili e F2-F10), Ship's
    Control (timone, macchina, timoni orizzontali, auto-funzioni), Navigation Board (mappa con
    batimetria nei toni originali, HUD, zoom I/O, waypoint e autopilota, tracce), Sonar
    (waterfall a banda larga, nuova ma nel kit originale), nastro dei messaggi, barra delle
    informazioni.
13. **La prova d'architettura**: due browser, due 688 nella stessa area. Ognuno vede l'altro
    solo come traccia nel proprio waterfall; se uno accelera, l'altro lo sente prima; se uno
    scende sotto lo strato, l'altro lo perde.
14. **Prove**: unità (cinematica, cavitazione, perdita, rilevamento), determinismo (stesso seme e
    stessi comandi → stesse istantanee), tenuta (un'ora simulata a 32×), end-to-end (accesso →
    partita → comando → stato), e la **prova di nebbia**: nessun messaggio inviato a un client
    contiene la posizione dell'altro battello.

### 11.3 Fatta quando

- ci si registra, si entra, si apre la plancia e si governa un 688 nella CONN originale;
- il battello accosta, accelera, scende e risale in modo credibile (confrontato con i valori
  delle fonti); a quota periscopica cavita già sopra gli 8 nodi, a 500 ft regge fino a circa 18,
  a 1000 ft fino a circa 25;
- i tre cacciatorpediniere compaiono sul waterfall alle distanze attese e spariscono nei baffles;
- due giocatori nella stessa area si sentono a vicenda secondo le regole dell'acustica e niente
  di più;
- tutte le prove sono verdi tre volte di fila.

---

## 12. Decisioni da prendere

### 12.1 Le quattro decisioni fondanti (prese con l'utente il 07/10/2026)

| # | Decisione | Conseguenza |
|---|-----------|-------------|
| D1 | **Browser + il server** | Architettura del §4 così com'è: PHP per account e meta-gioco, server di gioco Node in Docker, client JavaScript senza build. |
| D2 | **Scala del tempo fissa per partita** | Scelta in lobby e immutabile: 1:1 in classificata, 1:2 o 1:4 in amichevole. Pausa e compressione libera solo in singolo. |
| D3 | **Distanze vere, più il preset «regolamento 1989»** | Fisica, portate e armi reali; il preset 1989 (siluri a 10 miglia, filo di 7,5, lettere esatte, niente riparazioni) solo in singolo e in amichevole, mai in classifica. Le regole sono parametri dello stesso motore, non un secondo motore. |
| D4 | **Registrazione aperta da subito**, con conferma per e-mail | Come gli altri giochi del server. Conseguenze: le pagine pubbliche (home, classifiche, statistiche, albo) non mostrano grafica originale, che compare solo nel client di gioco dopo l'accesso; la formula «non ufficiale, senza scopo di lucro, rimosso su richiesta» sta in ogni pagina; la lettera a Ratcliff (D13) resta consigliata e diventa più urgente. |

### 12.2 Le altre decisioni

Con la mia raccomandazione; si possono prendere strada facendo.

| # | Decisione | Opzioni | Raccomando |
|---|-----------|---------|------------|
| D5 | Nome | Termoclino / altro | Termoclino |
| D6 | Lingue | Solo italiano / italiano e inglese | **Italiano e inglese** dal primo giorno (i cataloghi costano poco all'inizio e molto dopo) |
| D7 | Classi al lancio | 688 contro Alfa / anche altre | **688 contro Alfa** come nel 1989, in scenari 1985-89 (l'unica finestra in cui gli Alfa erano operativi); le altre classi in F7 |
| D8 | Assistenza in classifica | Libera / fissa per coda | **Fissa**: livello 2 (Auto-TMA) nella coda principale, livello 0-1 in una coda «puristi» se ci saranno abbastanza giocatori |
| D9 | Riparazioni | Sì, lente, con squadre / no, come nel 1989 | **Sì**, con «nessuna riparazione» nel regolamento 1989 |
| D10 | Chat in partita | Libera come via modem / solo con l'antenna alzata / nessuna | **Come via modem** in amichevole, nessuna in classifica |
| D11 | Finestra storica | 1985-1991 con selettore d'anno / un anno fisso | **1985-1991 con selettore** |
| D12 | Dati classificati | Valori nozionali dichiarati / inventati senza dirlo | **Nozionali dichiarati**, con il ragionamento in `docs/ricerca/` |
| D13 | Lettera a Ratcliff | Sì / no | **Sì**, prima di aprire il servizio al pubblico |

---

## 13. Rischi

| Rischio | Cosa facciamo |
|---------|---------------|
| Le parti vive dei pannelli e le viste 3D non hanno asset | I ~10 comandi `.CLS` dello stato vivo si scrivono da noi; periscopio e contour si rifanno su batimetria GEBCO; le catture DOSBox fanno da riferimento visivo |
| Diritti sulla grafica originale | Niente asset nel repo pubblico; grafica solo nel client dopo l'accesso, mai nelle pagine pubbliche (D4); lettera a Ratcliff prima del lancio |
| Il realismo acustico rende il gioco lento o illeggibile | Livelli di assistenza; scenari con geometria e tempo stretti; prove col bot prima degli umani |
| L'asimmetria rende la classifica ingiusta | Vantaggio di lato per scenario nella valutazione; lati alternati; bilanciamento misurato |
| Pochi giocatori in lobby | Bot sempre disponibile; partite private con codice; inviti per e-mail |
| Il progetto si allarga senza fine | Fasi chiuse con criteri «fatta quando»; F7 è il cassetto dove vanno le idee nuove |

---

## 14. Fonti

- *688 Attack Sub — User Manual*, Electronic Arts 1988-89 (manuale di David Luoto, a cura di
  Z. J. Yee; software © 1988 John Ratcliff): versione testo e scansione di 80 pagine.
- *688 Attack Sub — Addendum* (VGA, modem, parametri da riga di comando, Ctrl-D, Ctrl-Q).
- Foglio di identificazione sonar (firme delle unità americane e sovietiche).
- **Catalogo di ricerca** in `docs/ricerca/` (compilato il 07/10/2026): piattaforme, armi,
  contromisure, sensori, acustica, TMA, dottrina dei siluri, il gioco originale e le recensioni
  d'epoca; ogni numero ha fonte datata e confidenza (`documentato` / `stimato` / `calcolato` /
  `nozionale`). Bibliografia unificata in `docs/ricerca/FONTI.md` (211 chiavi citate, tutte
  risolte), contraddizioni aperte in `docs/ricerca/CONTRADDIZIONI.md`. Le fonti scaricate stanno
  in `privato/ricerca_grezza/` e non escono dal repo privato.
- Fonti principali: Coté, *The Third Battle* (Naval War College, 2003); *Fundamentals of Naval
  Weapons Systems* (Accademia navale USA); rapporti GAO 1990-95; *Combat Fleets of the World
  1986/87*; FAS; deepstorm.ru e militaryrussia.ru per i sistemi sovietici; *The Submarine Review*
  1984-91; *Computer Gaming World* n. 59, 64, 95 e *Compute!* n. 111 per il gioco del 1989.
