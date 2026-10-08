# F2 «Ascoltare» — piano

Fase F2 della roadmap (`PROGETTO.md` §10): dopo F1, dove ci si sente solo come energia a banda larga
sul waterfall, in F2 **un contatto si rileva, si classifica e si risolve in TMA ai quattro livelli di
assistenza**. Niente armi (F3), niente capitano IA (F4): i bersagli sono quelli della palestra.

Il protocollo dei messaggi nuovi è in `PROTOCOLLO.md`, «Versione 2 (F2) — bozza»: la bozza la scrive
la sessione principale prima di cominciare, chi implementa la rifinisce e dice perché.

## 1. Cosa entra

| # | Cosa | Dove | Note |
|---|------|------|------|
| 1 | **Tabelle di propagazione** fuori linea: tracciatore di raggi nostro, convalidato su casi canonici (sferica in acqua isovelocità, specchio di Lloyd, guida di Pekeris a modi normali, profilo di Munk con le zone di convergenza); TL(distanza, quota sorgente, quota ricevitore, banda) per le regioni d'ambiente dello scenario; ricerca in linea a costo costante | `tools/acustica/`, `shared/data/scenari/*.tl.bin`, `server/src/sim/world/propagazione.js` | PROGETTO §5.3. Fondo per regione (sabbia, ghiaia, fango: perdita al rimbalzo nozionale dichiarata). L'analitico di F1 resta come riserva e come termine di confronto |
| 2 | **Firme acustiche**: banda larga e **righe tonali** per piattaforma (macchinari, rete elettrica 60/50 Hz, frequenza di pala = giri × pale, pompe che si accendono oltre una velocità), **transitori** (cambi di quota dello scafo, portelli, pompe, emersione) | `shared/data/piattaforme/*.json`, `shared/data/firme/*.json` (navi di superficie, mercantile, biologici) | PROGETTO §5.4, ricerca 01 §3, 05 §7. Ogni numero con fonte e confidenza; nozionale dichiarato dove la realtà è classificata |
| 3 | **Banda stretta**: LOFAR del fascio puntato (sfera e towed), DEMON (righe di pala dalla modulazione), rivelazione delle singole righe con il loro guadagno di banda; la towed array dà finalmente il suo vantaggio vero, le righe basse | `server/src/sim/sensors/` | Il fascio lo sceglie il giocatore (analizzatore) o l'equipaggio |
| 4 | **Sonar attivo**: ping (TRGT PULSE), eco con distanza e rilevamento misurati, riverberazione, e **controscoperta**: tutti quelli che hanno un ricevitore d'intercettazione sentono il ping molto più lontano di quanto torni l'eco | `server/src/sim/sensors/` | Il 688 ha la BQQ-5 attiva (≈3,5 kHz) e la WLR-9 d'intercettazione |
| 5 | **Periscopio** con le **sagome originali** e lo **stadimetro**: a quota periscopica, alzato, si vedono le navi entro la portata ottica (giorno/notte, stato del mare); l'ottica dà rilevamento, aspetto e angolo d'albero misurati; la distanza la stima il giocatore scegliendo la classe (altezza d'albero dal libro) — errore ±7 %. Periscopio alzato oltre i 10 nodi: avviso e scia | client (stazione F5), `server/src/sim/sensors/` | Le navi di superficie della palestra hanno le loro sagome tra gli ENC estratti |
| 6 | **ESM** (e radar proprio, facoltativo): con l'albero alzato si sentono i radar delle navi (rilevamento, tipo, livello) da molto lontano; il proprio radar è un'emissione che gli ESM altrui sentono | `server/src/sim/sensors/` | I Forrest Sherman hanno radar di scoperta aerea e di superficie: dati in `firme/` |
| 7 | **Tracce dell'equipaggio**: associazione delle misure di tutti i sensori in tracce (Sierra-1…), classificazione dalle righe tonali contro la «biblioteca delle firme» con un tempo (3-10 minuti, ricerca 04) e una probabilità di errore | `server/src/sim/crew/` | Le tracce portano solo misure e ipotesi dell'equipaggio, mai la verità |
| 8 | **TMA**: stimatore a massima verosimiglianza sui soli rilevamenti (Gauss-Newton con la covarianza), qualità Q, ellisse, consiglio di manovra («accosti di 90° a sinistra per 6 minuti»); strumenti manuali: velocità di variazione del rilevamento, distanza di Ekelund, punti tempo-rilevamento, MATE (soluzione di prova e residui) | `shared/tma.js` (matematica pura, la usano server e client), `server/src/sim/crew/` | PROGETTO §5.6, ricerca 06. La matematica nel modulo comune: i residui del MATE si calcolano nel client dalle misure, senza chiedere niente al server |
| 9 | **Livelli di assistenza 0-3** (PROGETTO §5.6): scelti all'`entra` e modificabili; il livello decide cosa dice l'equipaggio. Il **livello 3** («lettera esatta» dopo il fix, come nel 1989) vale **solo per i contatti non umani**: un umano resta al massimo al livello 2 per gli altri umani, anche in palestra | server e client | La prova di nebbia si estende: nessun livello rivela la verità di un altro giocatore |
| 10 | **Diario della partita**: eventi tipizzati (scoperta, perdita, classificazione, soluzione, ping, controscoperta, transitorio, periscopio, ESM…) scritti nelle istantanee, con la verità che serve alle statistiche (distanza vera della scoperta, errore vero della soluzione). È la base delle statistiche di F6 (PROGETTO §7.9, decisione D16) | `server/src/match/diario.js` | Ogni meccanica di F2 emette i suoi eventi, con una prova per ciascuno |
| 11 | **Client**: analizzatore (LOFAR e DEMON) nella stazione Sonar con BAND PASS e TRGT PULSE; stazione Periscopio (F5) con le sagome, l'ingrandimento e lo stadimetro; ESM; **vista TMA** nella Navigation Board (punti tempo-rilevamento, strumenti dei livelli 0-1, soluzione e ellisse al livello 2, lettera al livello 3); elenco delle tracce; scelta del livello | `web/assets/js/client/` | Stile Classic: i pannelli nuovi (la vista TMA non esisteva nel 1989) si disegnano con palette, font e cornici originali |
| 12 | **Taratura**: le distanze di scoperta di F1 rifatte con le tabelle; in più quelle a banda stretta (towed array sulle righe basse) e quelle dell'attivo e dell'intercettazione | `docs/CALIBRAZIONE_F2.md` | Bande di PROGETTO §5.12 e ricerca 07 §7 |

## 2. Chi fa cosa

Quattro filoni in parallelo, ognuno con i suoi file:

| Filone | Possiede | Usa |
|--------|----------|-----|
| **G — Propagazione** | `tools/acustica/**`, `server/src/sim/world/propagazione.js`, `shared/data/scenari/*.tl.*`, le regioni d'ambiente nel JSON dello scenario | `shared/ambiente.js` |
| **H — Sensori e firme** | `server/src/sim/sensors/**`, gli alberi e l'attivo in `server/src/sim/platform/`, `shared/data/firme/**`, i blocchi acustici di `shared/data/piattaforme/*.json`, `shared/protocol.js` (messaggi e ordini nuovi, compresi quelli di I, secondo la bozza), `docs/PROTOCOLLO.md`, `docs/CALIBRAZIONE_F2.md` | `propagazione.js` di G (fino ad allora l'analitico di F1, dietro la stessa interfaccia) |
| **I — Equipaggio, TMA, diario** | `server/src/sim/crew/**`, `shared/tma.js`, `server/src/match/diario.js` e il collegamento nel ciclo della partita (`server/src/match/partita.js`), i livelli di assistenza | le misure di H |
| **J — Client** | `web/assets/js/client/**` (tranne `cls.js`), `web/views/gioco/`, `web/assets/css/plancia.css`, `tests/client/**`, `tests/strumenti/finto_server.mjs` | il protocollo v2, `shared/tma.js` |

`server/src/match/partita.js` è di I; H vi aggiunge solo agganci delimitati e commentati, rileggendo
il file prima di toccarlo.

## 3. Fatta quando

- le tabelle riproducono i casi canonici (entro 1-2 dB sui casi con soluzione esatta; la prima
  zona di convergenza del profilo di Munk dove la letteratura la mette) e la ricerca in linea costa
  meno di un microsecondo per coppia;
- un Forrest Sherman della palestra si scopre **prima sulla towed array dalle righe tonali** che
  sulla sfera a banda larga; il LOFAR mostra le sue righe; l'equipaggio lo classifica in pochi
  minuti, e il giocatore può farlo da sé confrontando le righe con la biblioteca;
- con due gambe del proprio battello la soluzione automatica (livello 2) arriva sotto il 10-15 %
  di errore di distanza con Q ≥ 70 %; **senza manovra Q resta basso** (la distanza non è
  osservabile); su molte prove l'errore dello stimatore sta vicino al limite di Cramér-Rao;
- ai livelli 0 e 1 gli strumenti manuali danno gli stessi numeri del modulo comune; al livello 3 la
  lettera compare solo per i contatti non umani;
- un ping dà distanza e rilevamento del bersaglio, e **ogni ricevitore d'intercettazione nella
  portata lo sente**, molto più lontano dell'eco: prova a due browser (uno pinga, l'altro lo sente);
- al periscopio si vedono le navi con le sagome originali, e lo stadimetro dà la distanza entro il
  ±7 % se si sceglie la classe giusta;
- con l'albero ESM alzato si sentono i radar dei cacciatorpediniere oltre l'orizzonte acustico;
- ogni meccanica scrive i suoi eventi nel diario, con la verità che servirà alle statistiche;
- la prova di nebbia, estesa a tutti i messaggi nuovi e a tutti i livelli, passa;
- tutte le prove sono verdi tre volte di fila.

## 4. Stato (8/10/2026)

**F2 fatta**, salvo una decisione aperta (lo strato, sotto). Cosa è stato verificato:

- **Propagazione**: tracciatore semi-coerente con tabelle per sette classi di profondità e tre
  tipi di fondo (1,8 MiB, rigenerazione deterministica); casi canonici entro 0,5-1,7 dB, prima
  zona di convergenza del profilo di Munk a 51-74 km; ricerca in linea intorno a 1 µs per coppia
  (`docs/CALIBRAZIONE_F2.md`, parte G).
- **Sensori**: il Forrest Sherman si scopre sulle righe dell'antenna (60 Hz) a 9-10 miglia contro le
  6-7 della sfera a banda larga, a 150 m e a quota periscopica; eco entro il 2 %, intercettazione da
  2,3 a 3,5 volte più lontana dell'eco; stadimetro entro ±7 % nel 95 % delle letture con la classe
  giusta; radar dei cacciatorpediniere sentiti all'ESM fino a 53 miglia (parte H).
- **Equipaggio e TMA**: limite di Cramér-Rao uguale a quello della ricerca entro il 30 %, stimatore
  sul limite (RMS/CRLB 1,01 su 200 prove); in palestra, con due gambe, errore finale sotto il 13 % con
  Q 73-90 su 12 semi; senza manovra Q sotto 30 e il consiglio di accostare; classificazione del
  Forrest Sherman in 6-9 minuti; livello 3 esatto solo sui contatti non umani; diario senza difetti e
  primo calcolatore delle statistiche (`server/src/match/statistiche.js`).
- **Prova a due browser** sul server di sviluppo: da solo a 32× il primo 688 forma quattro tracce e
  riceve il consiglio di manovra; al periscopio vede tre Forrest Sherman con le sagome originali (due
  con lo scafo sotto l'orizzonte), all'ESM i loro SPS-40 e SPS-10 e il radar di navigazione del
  mercantile. Entrato il secondo, il primo pinga in portata lunga: il secondo, a circa 34 km, riceve
  «ci pingano, rilevamento 285, 3,5 kHz» (vero: circa 282) con 32 dB di margine, mentre al primo non
  torna l'eco del secondo.
- **Integrazione**: `visivo.luce` (giorno o notte) e il messaggio `storia` per chi rientra (la pila
  della TMA non riparte da zero), con le loro prove.

**Aperta: lo strato estivo nasconde poco.** Con le tabelle, il sottile strato di 21 m dell'estate
alle Faroe trattiene poco alle frequenze del sonar e il rimbalzo sul fondo riempie la zona d'ombra:
un 688 a quota periscopica si sente a 0,57-0,67 della distanza alla stessa quota (in F1 era sotto
0,5). È la fisica di quest'acqua bassa e stratificata appena; in acque profonde con uno strato
spesso l'effetto torna. C'è una manopola nozionale (`propagazione.percorso.perdita_strato`, oggi 0):
a 8 dB riporta le bande di F1. Decisione da prendere con l'utente.
