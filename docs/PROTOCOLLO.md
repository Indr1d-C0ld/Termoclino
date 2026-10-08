# Protocollo client ↔ server di gioco

Il contratto vive nel codice in `shared/protocol.js`, importato da entrambe le parti. Questo
documento ne spiega le regole e tiene la storia delle versioni. Se i due divergono, vale il
codice e questo documento va corretto.

## Regole che non cambiano con le versioni

1. **Messaggi JSON** con un campo `t` (tipo), al massimo 16 KiB. Per questo l'ora di gioco, nei
   messaggi, si chiama sempre `ora` e mai `t`. I fotogrammi del sonar viaggiano dentro il JSON come
   base64 (§ v1, `sonar`): niente WebSocket binario.
2. **Il primo messaggio del client è `ciao`** con il biglietto rilasciato da PHP. Mai nell'indirizzo
   del WebSocket: gli indirizzi finiscono nei log di Apache. Dieci secondi per presentarsi.
3. **Biglietto**: `b64url(json(carico)) "." b64url(HMAC-SHA256(segreto, b64url(json(carico))))`,
   carico `{v:1, uid, nome, ruolo, exp, nonce}`, valido 60 s, **monouso** (il server ricorda i nonce).
   Firmato da `App\Gioco\Biglietto` (PHP), verificato da `verificaBiglietto` (Web Crypto). La prova
   `tests/compat/biglietto.test.js` controlla che le due parti producano lo stesso biglietto byte
   per byte.
4. **Nebbia di guerra**: il server non manda mai posizioni, rotte, quote o identità vere di
   battelli che non siano il proprio. Solo misure dei sensori, rapporti dell'equipaggio ed eventi
   percepiti. La verità arriva una volta sola, nel debriefing a partita chiusa. Ogni fase ha una
   prova automatica che lo verifica sui messaggi effettivamente inviati (in F1:
   `server/test/nebbia.test.js`).
5. **I codici d'errore sono stabili** (`ERRORI` e `MOTIVI_ORDINE` in `shared/protocol.js`); il
   client li traduce.
6. **Freni**: 20 messaggi al secondo di regime, raffica di 40; oltre, errore e poi chiusura.

## Codici di chiusura

| Codice | Motivo |
|--------|--------|
| 1001 | il server si spegne (manutenzione): il client riprova con un biglietto nuovo |
| 4400 | messaggi malformati ripetuti |
| 4401 | biglietto rifiutato (assente, falso, scaduto, già usato) |
| 4408 | biglietto non presentato entro 10 s |
| 4426 | versione del protocollo diversa: il client deve ricaricare la pagina |
| 4429 | troppo in fretta, ripetutamente |

## Versione 0 (F0) — il cancello

| Direzione | Tipo | Campi |
|-----------|------|-------|
| C → S | `ciao` | `versione`, `biglietto` |
| C → S | `ping` | `n` (numero libero, restituito) |
| S → C | `benvenuto` | `versione`, `utente {uid, nome, ruolo}`, `server {versione, avviato}`, `presenti` |
| S → C | `pong` | `n`, `ora` (ms del server) |
| S → C | `errore` | `codice`, eventuali dettagli |
| S → C | `addio` | `motivo` |

La v1 li conserva tutti, identici. Il server accetta solo client con la **stessa** versione
(`ciao.versione === 1`): un client F0 riceve `versione_protocollo` e la chiusura 4426.

## Versione 1 (F1) — prima immersione

Una partita di prova condivisa, la **palestra** nell'area di TORPEX '89 (scenario
`torpex_palestra`): ogni giocatore collegato che vi `entra` governa un proprio 688, in un punto di
partenza libero, nella stessa acqua degli altri, con tre cacciatorpediniere, un mercantile e
qualche sorgente biologica. Niente armi, niente TMA, niente lobby.

### Convenzioni

- Posizioni in **metri** sul piano locale dello scenario (x verso est, y verso nord, origine in
  `partita.origine`), **quota positiva verso il basso** misurata alla chiglia.
- Rotte e rilevamenti in **gradi veri** (0 = nord, senso orario); velocità in **nodi**; velocità
  verticali in m/s (positive verso il basso).
- `ora` = secondi di **tempo di gioco** dall'inizio della partita (il passo della simulazione è
  0,1 s).
- Le conversioni per la visualizzazione (piedi, iarde, kyd, cavi) stanno in `shared/units.js` e
  `shared/geo.js`; i limiti del battello (quote, timone, telegrafo) nei dati di piattaforma
  (`shared/data/piattaforme/<partita.battello.piattaforma>.json`).

### Messaggi

| Direzione | Tipo | Campi | Quando |
|-----------|------|-------|--------|
| C → S | `entra` | `scenario` (in F1 solo `torpex_palestra`) | una volta; se l'utente ha già un battello nella palestra (connessione caduta), lo riprende |
| C → S | `esci` | — | lascia la partita: il battello viene tolto subito |
| C → S | `ordine` | `cosa`, `valore`, `n` (facoltativo, intero 0…2³¹−1, restituito nella risposta) | vedi «Ordini» |
| S → C | `partita` | `id`, `scenario`, `ora`, `passo`, `scala_tempo`, `in_pausa`, `tempo_modificabile`, `origine {lat, lon}`, `area {x0, y0, x1, y1}`, `battello {piattaforma, nome, sigla}` | in risposta a `entra` |
| S → C | `tempo` | `ora`, `scala_tempo`, `in_pausa`, `tempo_modificabile` | quando cambia la scala, la pausa, o se si può cambiarle |
| S → C | `stato` | il **proprio** battello (tabella sotto) | 4 volte al secondo di tempo reale, più una subito dopo `partita` |
| S → C | `sonar` | `ora`, `sensore`, `settori`, `ciechi`, `asse`, `sorda` (vedi «Sonar») | un fotogramma per sensore attivo per ogni secondo di tempo di gioco |
| S → C | `rapporto` | `ora`, `chi`, `chiave`, `parametri` | quando l'equipaggio ha qualcosa da dire |
| S → C | `ricevuto` | `n`, `cosa`, `valore` (normalizzato) | per ogni ordine accettato |
| S → C | `errore` | `codice`, e per gli ordini `n`, `cosa`, `motivo` | per ogni ordine o messaggio respinto |
| S → C | `uscita` | `motivo`: `esci`, `altra_connessione`, `partita_chiusa` | quando il battello non è più tuo |

`battello.sigla` è il numero di scafo (per esempio `SSN-700`), `battello.nome` il nome (`Dallas`):
sono del **proprio** battello.

**Ordine.** I messaggi di una connessione si trattano nell'ordine in cui arrivano: un `ordine`
mandato subito dopo `entra` trova già il battello in acqua. A `entra` il server risponde `partita`
e subito dopo uno `stato`; poi `stato` a 4 Hz, `sonar` e `rapporto` col tempo di gioco. Chi entra
non riceve `tempo` (la scala e la pausa sono già in `partita`): `tempo` arriva solo quando
cambiano, o quando cambia `tempo_modificabile` perché qualcuno entra o esce.

`tempo_modificabile` è vero solo se si è **soli** nella partita: la palestra è condivisa, e la
scala del tempo di uno sarebbe la scala di tutti (decisione D2). Quando arriva un secondo
giocatore la scala torna 1, la pausa si toglie e chi c'era già riceve `tempo`; quando resta uno
solo, riceve `tempo` con `tempo_modificabile: true`. Se tutti i giocatori perdono la linea la
scala torna 1 (il mondo non corre a 32x senza nessuno a guardare).

Errori di partita: `scenario_sconosciuto`, `gia_in_partita` (un secondo `entra` sulla stessa
connessione), `non_in_partita` (`ordine` o `esci` senza essere entrati), `partita_piena`.

#### `stato`

| Campo | Significato |
|-------|-------------|
| `ora` | s di gioco |
| `x`, `y`, `z` | posizione (m) e quota della chiglia (m) |
| `rotta`, `velocita` | gradi veri, nodi (negativa = indietro) |
| `velocita_verticale` | m/s, positiva = scende |
| `assetto` | gradi, positivo = prua in giù |
| `giri` | giri dell'elica al minuto (negativi = indietro) |
| `macchina` | ordine di macchina in vigore (come in `ordine`) |
| `timone`, `timoni_o` | angoli attuali, gradi (timone positivo = a dritta; timoni orizzontali positivi = a scendere) |
| `rotta_ordinata` | rotta che il timoniere sta tenendo, o `null` se il timone è a mano |
| `quota_ordinata` | quota che l'auto-quota sta tenendo, o `null` se i timoni orizzontali sono a mano |
| `modo_quota` | `manuale`, `automatica`, `emersione` (soffiaggio d'emergenza in corso) |
| `autopilota` | `{attivo, waypoint: [[x, y], …], prossimo}`: `prossimo` è l'indice del waypoint verso cui si va |
| `cavitazione` | l'elica sta cavitando |
| `v_cavitazione` | nodi: velocità d'innesco alla quota attuale (la tabella che il capo macchina conosce) |
| `towed` | `null` se il battello non ha l'antenna; altrimenti `{stato, filato_m, quota, tempo_morto, sorda}` con `stato` fra `stivata`, `in_filare`, `filata`, `in_ritiro`, `tagliata`, `persa` |
| `fondale` | metri d'acqua sotto la chiglia (ecoscandaglio) |
| `profondita_acqua` | metri dalla superficie al fondo, nel punto dove si è |
| `strato` | quota dello strato termico misurata dal batitermografo, o `null` |
| `avvisi` | chiavi degli avvisi in corso, in ordine alfabetico: `cavitazione`, `collasso`, `fondale_avanti`, `fondale_vicino`, `oltre_quota_collaudo`, `quota_collaudo_vicina`, `towed_curva`, `towed_sorda`, `towed_velocita_pericolosa` |
| `danni` | `{urti_fondale, oltre_collaudo, collasso}`: in F1 solo segnalazioni, nessun effetto sulla dinamica |

#### Ordini

| `cosa` | `valore` | Effetto |
|--------|----------|---------|
| `macchina` | 688: `rev`, `stop`, `1/3`, `2/3`, `std`, `full`, `flank`. Telegrafo a percentuale (Alfa): intero da −10 a 110 | ordine al telegrafo; la velocità lo insegue con l'inerzia dei dati |
| `timone` | intero da −30 (barra tutta a sinistra) a +30 (a dritta) | timone a mano: annulla `rotta` e spegne l'autopilota |
| `timoni_o` | intero da −20 (a salire) a +20 (a scendere) | timoni orizzontali a mano: annulla `quota` |
| `quota` | metri (0 … quota di collasso), oppure `periscopica`, `automatica` (i 150 ft della pulsantiera), `emersione` (soffiaggio d'emergenza: rumoroso, sale anche da fermo) | l'auto-quota porta e tiene il battello alla quota; 0 = in superficie |
| `rotta` | gradi da 0 a 360 (360 = 0), al decimo | il timoniere accosta (timone 15°, 30° oltre i 45° di scarto) e tiene la rotta; spegne l'autopilota |
| `towed` | `fila`, `ritira`, `taglia` | antenna rimorchiata (vedi sotto) |
| `waypoint` | `{azione: 'aggiungi', x, y}`, `{azione: 'togli', indice}`, `{azione: 'svuota'}` | al massimo 9 waypoint, dentro l'area dello scenario |
| `autopilota` | `true` / `false` | segue i waypoint in ordine, **rallenta a 2/3 nelle accostate oltre i 45°** come nel 1989, **ignora il fondale** (ma il navigatore avvisa); all'ultimo waypoint si spegne e tiene la rotta |
| `scala_tempo` | 1, 2, 4, 8, 16, 32 | solo se `tempo_modificabile` |
| `pausa` | `true` / `false` | solo se `tempo_modificabile` |

Un ordine scritto male riceve `errore {codice: 'ordine_non_valido', n, cosa, motivo}` con
`motivo` fra `cosa`, `tipo`, `fuori_limiti`, `valore`, `n`. Un ordine scritto bene che ora non si
può eseguire riceve `errore {codice: 'ordine_rifiutato', n, cosa, motivo}` con `motivo` fra
`tempo_bloccato`, `senza_towed`, `towed_stato`, `troppi_waypoint`, `nessun_waypoint`,
`fuori_area`, `indice`. Ogni ordine accettato riceve `ricevuto {n, cosa, valore}`, dove `valore` è
quello normalizzato (arrotondato al decimo per quote e rotte, intero per i waypoint). La
validazione è `validaOrdine()` in `shared/protocol.js`: il client può (e dovrebbe) chiamarla prima
di mandare.

**Antenna rimorchiata** (TB-16, regole R2 e R3 di `shared/data/SCHEMA.md` §5): `fila` da
`stivata` o `in_ritiro` (7 minuti per filare 803 m); `ritira` da `in_filare` o `filata` (7 minuti);
`taglia` da qualunque stato con l'antenna fuori (resta `tagliata` per sempre). Sopra i 12 nodi il
cavo non si fila né si ritira: resta dov'è finché non si rallenta. Dà fotogrammi solo quando è
`filata`. Sotto i 3 nodi si incurva e oltre i 12 è sorda (`sorda: true`, fotogramma di solo fondo);
oltre i 18 rischia di andare `persa`; dopo un'accostata di più di 10° è sorda per tutta
l'accostata e poi per (cavo + antenna) / velocità, fra 2 e 8 minuti (`tempo_morto`); le accostate
più piccole raddoppiano per un minuto l'errore di rilevamento. Sta 30-100 m sotto il battello
(`towed.quota`), più in basso quanto più si va piano.

#### Sonar

Un messaggio per sensore attivo (`sfera`, e `towed` quando l'antenna è filata) per ogni secondo
di tempo di gioco: a scala 32 sono 32 fotogrammi al secondo per sensore, circa 300 byte l'uno.

| Campo | Significato |
|-------|-------------|
| `ora` | s di gioco, intero: il fotogramma integra il secondo che finisce qui |
| `sensore` | `sfera` (banda 1,4–2,8 kHz) o `towed` (banda 212–424 Hz) |
| `settori` | 180 byte in base64 (240 caratteri): il byte k è il settore dei rilevamenti **veri** [2k°, 2k+2°) |
| `ciechi` | archi senza ascolto, `[da, a]` in gradi veri in senso orario: i baffles della sfera, il cono di prua dell'antenna, tutto il cerchio se l'antenna è sorda |
| `asse` | solo `towed`: rilevamento vero dell'asse dell'antenna, nel verso dall'antenna al battello (a cavo dritto è la prua). L'antenna non distingue i lati: ogni contatto compare **due volte**, a `θ` e a `2·asse − θ`, e si risolve accostando |
| `sorda` | solo `towed`: vero durante il tempo morto dopo un'accostata e fuori dalle velocità utili |

**Quantizzazione.** Ogni byte q è l'**eccesso di segnale** del settore, in dB rispetto alla soglia
di rivelazione (0 dB = probabilità di scoperta del 50 %): `SE = −30 + 0,5·q`, da −30 dB (q = 0) a
+97,5 dB (q = 255). La soglia vale **q = 60**. Il fondo di rumore normalizzato sta intorno a
−10 dB (q ≈ 40) e fluttua da un fotogramma all'altro come l'uscita vera di un rivelatore di
energia (potenza esponenziale): è il grano del waterfall, e la probabilità che un settore di solo
rumore superi la soglia è circa 5·10⁻⁵. Un bersaglio si allarga sui settori vicini secondo il
diagramma del fascio (9,8° a −3 dB per la sfera a 2 kHz, 3,5° per l'antenna a 300 Hz, più largo
verso gli assi) con il suo errore di rilevamento. Le funzioni `quantizzaSE`, `dequantizzaSE`,
`settoreDi`, `centroSettore`, `codificaSettori`, `decodificaSettori` stanno in
`shared/protocol.js`. Il modello che produce i fotogrammi e la sua taratura sono in
`docs/CALIBRAZIONE_F1.md`.

#### Rapporti dell'equipaggio

`chi` è il ruolo che parla (`sonar`, `guardia`, `timone`, `macchina`, `navigazione`); `chiave` va
nei cataloghi delle lingue; i rilevamenti nei parametri vengono **dalle misure** (media dei
rilevamenti misurati), mai dalla verità, e i contatti hanno solo una designazione dell'equipaggio
(`S1`, `S2`…, assegnata in ordine di scoperta), mai un'identità.

| `chi` | `chiave` | `parametri` |
|-------|----------|-------------|
| sonar | `sonar.nuovo_contatto` | `contatto`, `sensore`, `rilevamento` (gradi veri, intero), `speculare` (towed: l'altro rilevamento possibile; sfera: `null`) |
| sonar | `sonar.contatto_perso` | `contatto`, `sensore` |
| sonar | `towed.in_filare`, `towed.filata`, `towed.in_ritiro`, `towed.ritirata`, `towed.tagliata`, `towed.persa`, `towed.stabilizzata` | — |
| sonar | `towed.sorda` (troppo veloci), `towed.curva` (troppo lenti) | `velocita` |
| guardia | `towed.velocita_pericolosa` | `velocita_danno` |
| macchina | `macchina.cavitazione`, `macchina.fine_cavitazione` | `v_cavitazione` |
| guardia | `guardia.quota_collaudo_vicina`, `guardia.oltre_quota_collaudo`, `guardia.collasso` | `quota`, `collaudo` / `collasso` |
| guardia | `guardia.urto_fondale` | `quota` |
| guardia | `guardia.in_superficie` | — |
| guardia | `guardia.ripreso_il_comando` | `secondi` (per quanto l'ufficiale di guardia ha tenuto il battello) |
| navigazione | `navigazione.fondale_vicino` | `sotto_chiglia` (m) |
| navigazione | `navigazione.fondale_avanti` | `distanza` (m), `profondita` (m d'acqua) — il fondo sale sulla rotta più su della chiglia |
| navigazione | `navigazione.waypoint_raggiunto` | `indice` |
| navigazione | `navigazione.ultimo_waypoint` | — |
| timone | `timone.rotta_raggiunta` | `rotta` |
| timone | `timone.quota_raggiunta` | `quota` (quella ordinata) |

#### Ufficiale di guardia

Se la connessione cade, la partita continua e il battello resta: l'ufficiale di guardia **tiene
rotta, velocità e quota** (spegne l'autopilota, ordina la rotta e la quota attuali). Dopo un tempo
configurabile (`TERMOCLINO_GUARDIA_SECONDI`, 300 s reali predefiniti) il battello viene tolto.
Rientrando prima con un `entra` (e un biglietto nuovo) si riprende lo stesso battello e si riceve
`guardia.ripreso_il_comando`. Se lo stesso utente apre una seconda connessione, la nuova prende il
battello e la vecchia riceve `uscita {motivo: 'altra_connessione'}`.

### Cosa cambia rispetto alla bozza, e perché

| Bozza | Ora | Perché |
|-------|-----|--------|
| `stato.t` = secondi di gioco | `ora` | `t` è già il tipo del messaggio |
| `scala_tempo: 0` = pausa | ordine `pausa` separato | la pausa non deve dimenticare la scala scelta, e «0» in un campo numerico è un trabocchetto |
| `waypoint {azione:'togli', x, y}` | `togli` per `indice` | togliere per coordinate obbligherebbe a confronti fra reali |
| `cavitazione` 0–1 | booleano + `v_cavitazione` | il modello è un salto all'innesco (SCHEMA §5); la velocità d'innesco alla quota attuale è l'informazione che serve al comandante |
| `towed {stato, filato_m}` | più `quota`, `tempo_morto`, `sorda` | l'antenna sta più in basso del battello (può essere sotto lo strato quando lo scafo è sopra) e il tempo morto dopo un'accostata è la regola che il giocatore deve vedere |
| `sonar`: un vettore per sensore e «i settori ciechi» | un messaggio per sensore, `settori` in base64, `ciechi` come archi, `asse` per l'antenna | 240 caratteri invece di ~700 per fotogramma; gli archi sono indipendenti dalla risoluzione; senza l'asse il client non può disegnare lo speculare |
| nessuna risposta agli ordini | `ricevuto` / `errore` con `n` | il client sa quale ordine è stato respinto e perché |
| — | `tempo`, `uscita`, `rapporto.chi` | cambi di scala in una partita condivisa, perdita del battello, ritratto di chi parla |
| `quota` solo in metri, `periscopica`, `emersione` | più `automatica` | il tasto «150 FT» della pulsantiera del 1989 |

## Versione 2 (F2) — «Ascoltare»

Bozza della sessione principale (`docs/F2_ASCOLTARE.md`), rifinita da chi l'ha implementata: le
differenze, con il perché, sono nella tabella in fondo. Tutto quello che non è scritto qui resta come
nella v1. `PROTOCOLLO_VERSIONE` = 2: un client v1 riceve `versione_protocollo` e la chiusura 4426.

**Regola che non cambia**: ogni campo è una **misura** dei propri sensori o un'**ipotesi** del
proprio equipaggio, mai la verità di un'altra entità. Unica eccezione dichiarata: al livello di
assistenza 3, la soluzione «esatta» dei contatti **non umani** (`soluzione.esatta: true`). La prova
`server/test/nebbia.test.js` controlla ogni tipo di messaggio qui sotto.

I modelli fisici che producono le misure (righe tonali, LOFAR, DEMON, attivo, riverberazione,
intercettazione, transitori, ottica, ESM, radar) e le loro portate sono in
`docs/CALIBRAZIONE_F2.md`; le firme delle piattaforme in `shared/data/piattaforme/*.json` e
`shared/data/firme/*.json` (formato in `shared/data/SCHEMA.md` §8).

### `entra`

`entra {scenario, assistenza?}`: `assistenza` è il livello 0-3 (PROGETTO §5.6), predefinito 2. Un
valore malformato riceve l'errore `assistenza_non_valida` e non si entra; un livello ben scritto ma non
ammesso in quella partita lo decide il server (vedi l'ordine `assistenza`).

### Ordini nuovi

| `cosa` | `valore` | Effetto |
|--------|----------|---------|
| `assistenza` | intero 0, 1, 2, 3 | livello di assistenza; `ordine_rifiutato {motivo: 'livello'}` se non è ammesso in questa partita |
| `analizzatore` | `{sensore: 'sfera'\|'towed', rilevamento}`, oppure `{contatto}`, oppure `null` (spento) | punta il fascio dell'analizzatore su un rilevamento vero (0…360, al decimo) o lo aggancia a un contatto dell'equipaggio, che ne aggiorna il rilevamento a ogni `spettro`; da qui arrivano gli `spettro`. `senza_towed` se si chiede l'antenna a un battello che non l'ha; `contatto` se l'equipaggio non tiene quel contatto |
| `attivo` | `{rilevamento: gradi \| null, portata: 'corta'\|'lunga'}` (entrambi obbligatori) | un ping (TRGT PULSE). `null` = tutto il settore di trasmissione di prua (±60° sul 688 e sull'Alfa); un rilevamento = fascio puntato su quel rilevamento vero, che deve stare nel settore (altrimenti `settore`). `corta`: impulso breve, ascolto fino a 10.000 yd; `lunga`: impulso lungo, ascolto fino a 40.000 yd. Gli echi arrivano come `eco`, e tutti gli intercettatori nella portata lo sentono (`intercetto`). Rifiuti: `senza_sensore`, `ping_in_corso` (si ascolta ancora il ping precedente: vedi `stato.ascolto_attivo`) |
| `albero` | `{quale: 'periscopio'\|'esm'\|'radar', alzato: true\|false}` | alza o abbassa un albero. Per alzarlo la chiglia deve stare entro la quota massima degli alberi (quota periscopica + 3 m: 21 m sul 688, 19 m sull'Alfa), altrimenti `quota`; `senza_sensore` se il battello non ha quell'albero. Abbassare si può sempre. Se il battello scende oltre la quota massima + 3 m l'ufficiale di guardia abbassa tutto (`guardia.alberi_abbassati`) |
| `radar` | `true` / `false` | trasmette o tace; serve l'albero del radar alzato (`albero`), abbassarlo spegne il radar |
| `designa` | `contatto` (`'S1'`…) oppure `null` | il contatto di riferimento delle stazioni (barra del bersaglio, analizzatore, TMA) |
| `classifica` | `{contatto, classe}` (`classe` fra le `CLASSI` della biblioteca, o `null` per togliere) | la classificazione del comandante prevale su quella dell'equipaggio |
| `soluzione` | `{contatto, ora, distanza, rotta, velocita, rilevamento?}` oppure `{contatto, cancella: true}` | la soluzione del comandante (livelli 0-1): `ora` s di gioco ≥ 0, `distanza` m (0 < d ≤ 500 km, intera), `rotta` 0…360 al decimo, `velocita` 0…60 kt al decimo, `rilevamento` (facoltativo, 0…360 al decimo) il rilevamento vero del bersaglio all'`ora`: se manca l'equipaggio usa il proprio rilevamento misurato a quell'ora |
| `abbandona` | `contatto` | l'equipaggio smette di tenere la traccia |

Un **contatto** è una designazione dell'equipaggio: da una a tre lettere maiuscole (anche cirilliche)
e un numero, `CONTATTO_RE` in `shared/protocol.js`. Le `CLASSI` della biblioteca sono `688`, `alfa`,
`forrest_sherman`, `mercantile_generico`, `biologico` (i file di `shared/data/piattaforme/` e
`shared/data/firme/`, che il client può leggere: sono il «libro» con righe tonali, numero di pale,
altezza d'albero e radar di ogni classe).

**Validazione.** `validaOrdine()` copre tutti gli ordini nuovi con gli stessi motivi della v1:
`tipo` (forma sbagliata: non un oggetto, chiavi in più o mancanti, tipi diversi), `valore` (testo fuori
elenco, contatto scritto male, classe sconosciuta, `analizzatore` con contatto **e** sensore),
`fuori_limiti` (numeri fuori intervallo). `ricevuto.valore` è quello normalizzato.

Nuovi motivi di `ordine_rifiutato`: `quota` (albero sotto la quota massima degli alberi), `albero`
(radar senza l'albero alzato), `contatto` (contatto che l'equipaggio non tiene), `livello` (livello di
assistenza non ammesso in questa partita), `senza_sensore` (il battello non ha quel sensore o
quell'albero), `ping_in_corso`, `settore`.

### `stato`: campi nuovi

| Campo | Significato |
|-------|-------------|
| `alberi` | `{periscopio, esm, radar}`: booleani, alzati o no |
| `radar_attivo` | il proprio radar trasmette |
| `ascolto_attivo` | s di gioco che restano della finestra d'ascolto dell'ultimo ping (0 = si può pingare) |
| `assistenza` | livello di assistenza in vigore |
| `analizzatore` | `null` (spento) o `{sensore, rilevamento, contatto}`: dove punta il fascio adesso (rilevamento vero al decimo) e il contatto che segue (`null` se puntato a mano) |
| `designato` | il contatto designato, o `null` |

`avvisi` aggiunge `periscopio_scia`: periscopio alzato oltre i 10 kt (si vede il pennacchio, vedi
`periscopio.scia`).

### Messaggi nuovi dal server

| Tipo | Campi | Quando |
|------|-------|--------|
| `sonar` con `banda: 'stretta'` | come i fotogrammi `sonar` della v1, più `banda: 'stretta'`: nel settore k l'eccesso di segnale della **riga tonale più forte** della finestra del sensore (righe di macchina, rete elettrica, pale), con il fascio alla frequenza di quella riga | ogni 4 s di gioco (ora multipla di `SPETTRO.PERIODO`) per ogni sensore in acqua. I fotogrammi a banda larga restano quelli della v1, uno al secondo e **senza** il campo `banda` |
| `spettro` | `ora`, `sensore`, `rilevamento` (vero, del fascio), `contatto` (o `null`), `da_hz`, `passo_hz`, `righe` (base64), `demon_da_hz`, `demon_passo_hz`, `demon` (base64), e per l'antenna `asse` e `sorda` | ogni 4 s di gioco con l'analizzatore acceso e il sensore in acqua |
| `eco` | `ora` (arrivo), `ping` (numero del proprio ping), `rilevamento` (al decimo), `distanza` (m), `forza` (dB), `riverbero` (dB) | uno per ogni eco sopra soglia, al tempo d'andata e ritorno del suono; a finestra chiusa l'equipaggio dice `sonar.fine_ascolto` |
| `intercetto` | `ora` (arrivo), `rilevamento` (intero), `tipo` (`ping`; da F3 anche `siluro`), `frequenza_khz` (misurata, al decimo), `livello` (dB sopra soglia, intero) | quando il ricevitore d'intercettazione (WLR-9 sul 688, «Enisej» sull'Alfa) sente un ping altrui, al tempo di un solo percorso |
| `transitorio` | `ora` (arrivo), `sensore`, `rilevamento` (intero), `speculare` (solo antenna, altrimenti `null`), `tipo`, `forza` (dB, intero) | quando un transitorio altrui supera la soglia di un sensore (un messaggio per sensore che lo sente) |
| `visivo` | `ora`, `luce` (`giorno` \| `notte`: quella dello scenario, per il cielo e la palette), `oggetti: [{vista, rilevamento, aspetto, sagoma, elevazione_alberi, luci, sotto_orizzonte, scia}]` | ogni secondo di gioco con il periscopio alzato (anche con `oggetti` vuoto) |
| `esm` | `ora`, `emissioni: [{rilevamento, tipo, banda, livello}]` | ogni secondo di gioco con l'albero ESM alzato (anche vuoto) |
| `radar` | `ora`, `echi: [{rilevamento, distanza}]` | a ogni giro d'antenna (6 s sul 688, 5 sull'Alfa) con il radar che trasmette |
| `storia` | `ora`, `contatto`, `punti: [{ora, rilevamento, x, y, rotta}]`: i punti tempo-rilevamento (ogni 10 s) di una traccia tenuta e risolta, con la posizione del sensore e la rotta propria in quel momento | a chi rientra (`entra` che riprende il battello), una per traccia: la pila della TMA non riparte da zero |
| `tracce` | `ora`, `tracce: [{contatto, sensori, rilevamento, variazione (°/min), classe, confidenza, stato: 'nuova'\|'tenuta'\|'persa', speculare?}]` | ogni 4 s di gioco; solo misure e ipotesi dell'equipaggio (filone I: forma della bozza) |
| `soluzione` | `contatto`, `ora`, `rilevamento` (vero, all'`ora`, dalla propria posizione), `distanza`, `rotta`, `velocita`, `q` (0-100), `ellisse` `{asse_lungo, asse_corto, orientamento}` (m, gradi), `origine` (`equipaggio`\|`comandante`), `esatta` (solo livello 3, solo contatti non umani); `q` ed `ellisse` sono `null` nell'eco della soluzione del comandante | ai livelli 2-3 ogni 10 s di gioco per le tracce con una soluzione; ai livelli 0-1 solo l'eco di quella del comandante (filone I) |

#### `spettro` (analizzatore: LOFAR e DEMON)

Due spettri del fascio puntato, ogni 4 s:

- **LOFAR** (`righe`): la cella k copre le frequenze `[da_hz + k·passo_hz, da_hz + (k+1)·passo_hz)`.
  Finestre (`SPETTRO` in `shared/protocol.js`): antenna 0-1024 Hz in celle da 1 Hz, sfera 0-2048 Hz in
  celle da 2 Hz, 1024 celle (1368 caratteri base64). Ci sono le righe tonali di tutte le sorgenti che
  il fascio sente (anche quelle dello speculare, per l'antenna), spostate per effetto Doppler dalla
  velocità radiale, e il loro fondo a banda larga; fuori dalla banda del sensore (TB-16 30-1000 Hz,
  sfera 500-5000 Hz) la risposta cala di 40 dB per decade.
- **DEMON** (`demon`): lo spettro della **modulazione d'ampiezza** del rumore a banda larga del fascio,
  celle da 0,1 Hz da 0 a 51,2 Hz (512 celle). Ci stanno la frequenza d'asse (giri/60) e la frequenza
  di pala (giri × pale / 60) con le armoniche: forti quando l'elica cavita (navi di superficie, sempre),
  deboli altrimenti. Dalla frequenza di pala si contano le pale e si stima la velocità.

Quantizzazione **come `sonar`**: `SE = −30 + 0,5·q` (dB, 0 = soglia), fondo intorno a −10 dB con
il suo grano. Funzioni: `decodificaSpettro(m)`, `decodificaDemon(m)`, `decodificaByte(testo, n)`,
`codificaByte`, `centroCella(da_hz, passo_hz, k)`.

#### `eco`, `intercetto` e la controscoperta

Un ping dà la distanza ma si fa sentire molto più lontano: l'eco fa due volte il percorso (e paga la
forza del bersaglio e la riverberazione), l'intercettatore lo sente dopo un percorso solo. La
distanza misurata è `1500 m/s × tempo d'andata e ritorno / 2` con l'errore della lunghezza
dell'impulso e del segnale; `riverbero` è il livello della riverberazione (superficie, fondo, volume)
rispetto al rumore alla distanza dell'eco: quando è alto, gli echi deboli si perdono nel fondo. Chi
pinga riceve `eco` solo per gli echi sopra soglia; gli altri battelli, se il loro ricevitore
d'intercettazione sente il ping, ricevono `intercetto` e il rapporto `intercetto.ping`.

#### `transitorio`

I transitori sono rumori brevi delle altre entità: `scafo` (lo scafo che lavora nei cambi di quota),
`portello` (portelli dei tubi, da F3), `pompa` (pompe d'assetto e cambio di regime delle pompe del
refrigerante), `emersione` (soffiaggio d'emergenza), `meccanico` (alberi idraulici, macchinari),
`biologico` (scatti dei cetacei). Il sonarista li riconosce se superano la soglia di almeno 6 dB,
altrimenti `sconosciuto`. Durano poco ma alzano anche il livello a banda larga della sorgente per la
loro durata: si vedono come lampi sul waterfall.

#### `visivo` (periscopio)

Per ogni nave in vista (entro la portata ottica, che dipende dal giorno o dalla notte, dallo stato del
mare e dall'orizzonte: testa d'albero sopra l'orizzonte dell'occhio):

| Campo | Significato |
|-------|-------------|
| `vista` | numero di vista, lo stesso finché l'oggetto resta in vista; un oggetto perso e ritrovato ha un numero nuovo. Non è un'identità |
| `rilevamento` | gradi veri, misurato (σ 0,3° di giorno), al decimo |
| `aspetto` | angolo sulla prua stimato dall'osservatore, −180…180 (positivo = si vede il fianco di dritta) |
| `sagoma` | nome dell'immagine originale da disegnare: famiglia della classe (`FOREST`, `MERCH`) più l'indice 0-4 dell'aspetto (0 di prua, 2 al traverso, 4 di poppa; il lato lo dà il segno di `aspetto`). `null` = un albero o un periscopio, senza sagoma |
| `elevazione_alberi` | angolo fra linea d'acqua e testa d'albero, gradi con tre decimali, con l'errore dell'osservatore (σ 3,5 %): con l'altezza d'albero della classe giusta, `distanza = altezza / tan(elevazione)` cade entro il ±7 % (stadimetro). `null` se lo scafo è sotto l'orizzonte o di notte senza sagoma |
| `luci` | di notte, le luci di navigazione viste (`testa_d_albero`, `fianco_dritta`, `fianco_sinistra`, `coronamento`); di giorno `null` |
| `sotto_orizzonte` | la linea d'acqua è sotto l'orizzonte dell'occhio: si vede solo la parte alta |
| `scia` | si vede la scia (onda di prua di una nave in moto, o il pennacchio di un periscopio) |

Gli alberi alzati di un altro battello (periscopio, ESM, radar) si vedono solo da vicino, di più se
quel battello corre: sono oggetti con `sagoma: null`, `aspetto: null`, `elevazione_alberi: null`.

#### `esm` e `radar`

`esm.emissioni`: per ogni radar che l'ESM sente (oltre l'orizzonte acustico: il segnale fa un
percorso solo, e oltre l'orizzonte radio cala per diffrazione), `rilevamento` misurato (σ 4°),
`tipo` riconosciuto (la designazione del radar: `AN/SPS-40`, `AN/SPS-10`, `navigazione`, `AN/BPS-15`,
`MRK-50`; `sconosciuto` sotto i 6 dB sopra la soglia), `banda` (lettera NATO: `B`, `G`, `I`…), `livello`
(dB sopra la soglia). Il proprio radar,
quando trasmette, è un'emissione che gli ESM altrui sentono; `radar.echi` sono le navi (e gli alberi
alzati vicini) che il proprio radar vede: rilevamento al decimo, distanza in metri, misurati.

### Rapporti nuovi

L'elenco completo, con i parametri esatti di ogni chiave, lo esporta `shared/protocol.js`
(`RAPPORTI`, `CHIAVI_RAPPORTO`): i cataloghi delle lingue devono avere una frase per ognuna. `chi`
aggiunge `tiro`, la centrale di tiro (TMA).

| `chi` | `chiave` | `parametri` |
|-------|----------|-------------|
| sonar | `sonar.transitorio` | `contatto` (o `null`), `sensore`, `tipo`, `rilevamento` |
| sonar | `sonar.eco` | `rilevamento`, `distanza` (m) |
| sonar | `sonar.fine_ascolto` | `echi` (quanti) — la finestra d'ascolto del ping si è chiusa |
| sonar | `intercetto.ping` | `rilevamento`, `frequenza_khz` |
| guardia | `periscopio.nave_in_vista` | `rilevamento`, `sagoma` |
| guardia | `periscopio.scia` | `velocita` (kt) — periscopio alzato oltre i 10 kt |
| guardia | `guardia.alberi_abbassati` | `quota` (m) — si è scesi oltre la quota degli alberi |
| guardia | `esm.radar` | `rilevamento`, `tipo`, `banda` — un radar nuovo all'ESM |
| sonar | `sonar.classificato` | `contatto`, `classe`, `confidenza` (filone I) |
| tiro | `tma.soluzione` | `contatto`, `q` (filone I) |
| tiro | `tma.consiglio_manovra` | `contatto`, `accostata`, `lato`, `minuti` (filone I) |
| tiro | `tma.distanza_non_osservabile` | `contatto` (filone I) |
| tiro | `tma.ekelund` | `contatto`, `distanza` (m) — distanza di Ekelund a ogni cambio di gamba, livello 1 (filone I) |

### Diario della partita (interno, non va ai client)

Righe `{ora, evento, …}` nelle istantanee, accanto alla verità al secondo, scritte con
`partita.diario.emetti()` (`server/src/match/diario.js`, che ne elenca i campi obbligatori in
`EVENTI`). Ogni evento porta la verità che servirà alle statistiche (PROGETTO §7.9); gli
identificativi sono quelli interni (`b1`, `n2`, `q1`). Quelli dei sensori e delle emissioni:

| `evento` | Campi | Quando |
|----------|-------|--------|
| `ping` | `sorgente`, `rilevamento` (`null` = settore), `portata`, `ping` (numero), `frequenza` (Hz) | a ogni ping |
| `eco` | `osservatore`, `sorgente`, `distanza_vera`, `ping`, `distanza_misurata`, `se` | per ogni eco sopra soglia, all'ora d'arrivo |
| `intercetto` | `osservatore`, `emettitore`, `tipo` (`ping`), `distanza_vera`, `livello` | quando un ricevitore d'intercettazione sente un ping, all'ora d'arrivo |
| `controscoperta` | `ascoltatore`, `sorgente`, `causa` (`ping`, `radar`, `transitorio`, `albero`), `distanza_vera`, `sensore` | la stessa cosa vista da chi è stato sentito: per `intercetto`, per ogni radar nuovo all'ESM, per ogni transitorio sentito, per ogni albero visto al periscopio o al radar |
| `transitorio` | `sorgente`, `tipo` | a ogni transitorio, sentito o no |
| `albero` | `battello`, `quale`, `alzato`, `da` (`ordine` o `guardia`) | a ogni alzata e abbassata |
| `radar` | `battello`, `attivo` | quando il radar comincia o smette di trasmettere |
| `esm` | `osservatore`, `emettitore`, `distanza_vera`, `tipo` | quando un ESM sente un radar per la prima volta (o di nuovo dopo 60 s senza) |
| `periscopio` | `osservatore`, `oggetto`, `distanza_vera`, `sagoma` | quando un oggetto entra in vista al periscopio |

Gli eventi dell'equipaggio (`scoperta`, `perdita`, `classificazione`, `soluzione`, `assistenza`…) li
scrive il filone I. `scoperta {osservatore, sorgente, contatto, sensore, distanza_vera, se}` si
ricava dai **contributi** che ogni fotogramma porta con sé sul server (mai inviati): per ogni sorgente
sentita `{sorgente, rilevamento (misurato), se (con la fluttuazione), se_medio, distanza_vera}`.

### Tracce, soluzioni e livelli di assistenza (filone I, come implementati)

Il codice: `server/src/sim/crew/` (`tracce.js` il tracciatore, `classificazione.js`, `centrale.js` la
TMA per livello, `equipaggio.js`), `shared/tma.js` (la matematica, comune al client),
`server/src/match/arbitro.js` (la verità dietro le tracce: solo per il diario e il livello 3).

**Tracce.** Le designazioni sono dell'equipaggio, in ordine di scoperta: `S1`, `S2`… sul 688, `Ц1`,
`Ц2`… sull'Alfa («цель»); un contatto perso e ritrovato è un contatto nuovo (regola di F1). Una
traccia nasce da 5 picchi in 8 s a banda larga o da 3 in 16 s a banda stretta, su qualunque schiera;
le misure di sfera e antenna dello stesso bersaglio vanno nella stessa traccia. `stato` è `nuova` nei
primi 30 s, poi `tenuta`; `persa` quando per 60 s (fino a 240 s per una traccia tenuta da molto:
+0,5 s per secondo di traccia) nessun sensore che avrebbe potuto sentirla l'ha sentita — i secondi
ciechi (antenna sorda dopo un'accostata, baffles) non contano, fino a 10 minuti; una traccia persa
resta nell'elenco 5 minuti. `sensori` sono le schiere che l'hanno sentita negli ultimi 30 s;
`rilevamento` (al decimo) e `variazione` (°/min, al centesimo) vengono dalla retta pesata degli ultimi
due minuti di misure della sfera se recenti, altrimenti dell'antenna; `speculare` c'è solo finché
la traccia è dell'antenna e **ambigua**: sparisce quando un'accostata (lo speculare salta di 2Δ, il
vero no) o la sfera decidono il lato. `classe` e `confidenza` (0-100) sono dell'equipaggio;
`confidenza` è `null` se la classe l'ha data il comandante. Al più 40 tracce per messaggio.

**Classificazione.** Dalle righe stabili dello spettro del fascio puntato su ogni traccia (uno sguardo
ogni 8 s, con un sotto-flusso proprio dei sensori: non sposta i numeri dell'analizzatore del
giocatore) e dal DEMON (pale e asse), contro la biblioteca delle firme: 3 minuti dalla prima riga
stabile con l'evidenza netta (errore 5 %), 6 con quella discreta (15 %), 10 con quella debole (30 %);
niente classe se niente somiglia alla biblioteca. Rapporto `sonar.classificato`.

**Soluzioni.** `distanza` al metro, `rotta` al grado, `velocita` al decimo di nodo, `rilevamento`
al decimo dalla propria posizione all'`ora`; `ellisse`: semiassi al 90 % (m) e rilevamento vero
del semiasse maggiore (0-179); `q` 0-100 come definita in testa a `shared/tma.js` (dalle incertezze
di distanza, rotta e velocità; Q ≥ 70 è la soluzione di tiro). Si mandano solo le soluzioni con la
distanza osservabile (con una manovra propria nei dati).

| Livello | Cosa manda l'equipaggio |
|---------|-------------------------|
| 0 — Manuale | `tracce` (misure e classi); nessuna soluzione: solo l'eco di quella del comandante (ordine `soluzione`), subito e poi ogni 10 s portata avanti all'ora del messaggio |
| 1 — MATE | come lo 0, più `tma.ekelund` a ogni cambio di gamba e `tma.distanza_non_osservabile` dopo 3 minuti di gamba dritta, sul contatto designato (o il più vecchio tenuto) |
| 2 — Auto-TMA | `soluzione` ogni 10 s per ogni traccia risolta con la distanza osservabile, `tma.soluzione` quando Q arriva a 70, `tma.distanza_non_osservabile` e `tma.consiglio_manovra` («accosti di 90° a sinistra per 6 minuti», l'accostata e la durata che portano prima il limite di Cramér-Rao della distanza sotto il 10 %) |
| 3 — 1989 | come il 2; dopo il «fix» (traccia tenuta 3 minuti senza interruzioni) la soluzione **esatta** (`esatta: true`, `q: 100`, ellisse nulla) ma **solo** se l'arbitro attribuisce la traccia a una sorgente **non umana**; i battelli dei giocatori restano alla soluzione stimata |

La soluzione del comandante prevale su quella dell'equipaggio a ogni livello finché non la cancella.
Chi rientra dopo una caduta di linea riceve di nuovo le soluzioni del comandante in vigore. I
rapporti della TMA li dice la centrale di tiro: `chi: 'tiro'`.

**Diario (eventi dell'equipaggio).** Con la verità dell'arbitro (dai `contributi` dei fotogrammi
di quel secondo, o dall'equazione del sonar se non c'è un contributo vicino):

| `evento` | Campi | Quando |
|----------|-------|--------|
| `scoperta` | `osservatore`, `contatto`, `sensore`, `banda`, `sorgente` (`null` = falso contatto), `distanza_vera`, `se` (medio vero), `se_misurato`, `rilevamento`, `speculare`, `rilevamento_vero`, `prima`, `umano` | alla designazione (`prima: true`) e quando un'altra schiera comincia a sentire la traccia |
| `controscoperta` | `ascoltatore`, `sorgente`, `causa` (`cavitazione`, `transitorio`, `velocita` oltre 10 kt, `rumore`), `distanza_vera`, `sensore`, `contatto` | con ogni `scoperta` passiva di un sottomarino, dalla parte di chi è stato sentito |
| `perdita` | `osservatore`, `contatto`, `sorgente`, `distanza_vera`, `durata` | traccia persa |
| `ambiguita` | `osservatore`, `contatto`, `risolta_da` (`accostata` \| `sfera`), `giusta`, `sorgente` | quando si decide il lato dell'antenna |
| `classificazione` | `osservatore`, `contatto`, `sorgente`, `classe`, `classe_vera`, `corretta`, `da`, `confidenza`, `secondi` (dalla designazione) | a ogni classificazione dell'equipaggio o del comandante |
| `soluzione` | `osservatore`, `contatto`, `sorgente`, `q`, `errore_distanza_pct`, `errore_rotta`, `errore_velocita`, `errore_rilevamento`, `distanza_vera`, `origine`, `livello`, `esatta`, `motivo` (`prima`, `soglia`, `campione`, `comandante`, `esatta`) | la prima soluzione, quando Q attraversa 30-50-70-90, al più ogni 60 s come campione, a ogni soluzione del comandante, alla prima esatta |
| `consiglio` | `osservatore`, `contatto`, `accostata`, `lato`, `minuti` | a ogni consiglio di manovra |
| `abbandono`, `assistenza` | `osservatore`, `contatto`; `battello`, `livello` | ordini `abbandona`, `assistenza` |
| `cavitazione`, `strato`, `periscopica` | `battello`, `attiva`, `velocita`, `quota`; `battello`, `sotto`, `quota`, `quota_strato`; `battello`, `attiva` | cambi di stato (cavitazione con 3 s di conferma, strato con 2 m d'isteresi) di ogni sottomarino |

`entra` porta `uid`, `piattaforma`, `lato`, `assistenza`, `umano`. Le statistiche della partita si
calcolano da questi eventi e dalla verità al secondo (`server/src/match/statistiche.js`).

### Cosa cambia rispetto alla bozza, e perché

| Bozza | Ora | Perché |
|-------|-----|--------|
| solo `spettro` per la banda stretta | in più `sonar` con `banda: 'stretta'` ogni 4 s, su tutti i fasci | senza una presentazione della banda stretta su tutti i rilevamenti né l'equipaggio né il giocatore possono **scoprire** un contatto dalle righe tonali: l'analizzatore guarda un fascio solo, e il vantaggio dell'antenna (le righe basse oltre la portata a banda larga) resterebbe invisibile. I fotogrammi a banda larga restano identici alla v1 |
| `spettro {ora, sensore, rilevamento, da_hz, passo_hz, righe, demon, demon_da_hz, demon_passo_hz}` | più `contatto`, e per l'antenna `asse` e `sorda`; finestre fisse per sensore in `SPETTRO` | `contatto` dice al client che il fascio segue una traccia; senza `asse` il client non sa che lo spettro dell'antenna contiene anche lo speculare; finestre diverse perché la sfera sente sopra i 500 Hz e l'antenna sotto i 1000 |
| `eco {ora, rilevamento, distanza, forza} per ogni eco; riverbero` | un messaggio per eco, con `ping` e `riverbero` (dB sul rumore a quella distanza); a finestra chiusa il rapporto `sonar.fine_ascolto` | gli echi arrivano a tempi diversi; senza la fine della finestra un ping senza echi sarebbe indistinguibile da un ping ancora in ascolto |
| `attivo {rilevamento: null}` = omnidirezionale | `null` = tutto il **settore di prua** di trasmissione (±60°); un rilevamento deve stare nel settore (`settore`); `portata` obbligatoria | la sfera del 688 trasmette verso prua (dato `sensori.sfera_attiva.settore`); un default implicito della portata avrebbe nascosto una scelta tattica |
| — | `stato.ascolto_attivo`, motivo `ping_in_corso` | un ping alla volta: la finestra d'ascolto dell'eco del precedente |
| `transitorio {…, tipo, forza}` | più `speculare` (antenna); tipi `biologico` e `sconosciuto` | l'antenna non distingue i lati; i cetacei fanno scatti; un transitorio debole non si riconosce |
| `visivo {vista, rilevamento, aspetto, sagoma, elevazione_alberi, luci?}` | `luci` sempre presente (`null` di giorno), più `sotto_orizzonte` e `scia`; e `visivo.luce` (giorno o notte); `sagoma: null` per gli alberi dei battelli | campi sempre presenti sono più facili da validare; oltre l'orizzonte lo stadimetro mente e il giocatore deve saperlo; la scia è ciò che rende pericoloso il periscopio in velocità; senza `luce` il client indovinava la notte dalle luci, e col mare vuoto sbagliava |
| `esm {rilevamento, tipo, banda, livello}` | uguale; `tipo` è la designazione del radar riconosciuto, `banda` la lettera NATO | — |
| il radar proprio: solo un'emissione | più il messaggio `radar` con gli echi | un radar che trasmette e non mostra niente non avrebbe senso; resta un'emissione che gli ESM altrui sentono |
| `albero`: serve la quota periscopica | la quota massima degli alberi è la periscopica + 3 m; scendendo oltre altri 3 m l'ufficiale di guardia li abbassa (`guardia.alberi_abbassati`) | l'auto-quota oscilla di qualche metro intorno alla periscopica; un albero alzato a 100 m non ha senso |
| motivi `quota`, `albero`, `contatto`, `livello` | più `senza_sensore`, `ping_in_corso`, `settore` | l'Alfa non ha tutto quello che ha il 688; un ping alla volta; il settore di trasmissione |
| `entra {scenario, assistenza}` | un `assistenza` malformato è l'errore `assistenza_non_valida` | come uno scenario sconosciuto: meglio un errore che un livello diverso da quello voluto |
| rapporti `intercetto.ping (rilevamento)`, `esm.radar (rilevamento, tipo)`, `sonar.transitorio (contatto?, …)` | `intercetto.ping` con `frequenza_khz`, `esm.radar` con `banda`, `sonar.transitorio` con `sensore` e `contatto` sempre presente (`null` se non è di una traccia); nuovi `sonar.fine_ascolto` e `guardia.alberi_abbassati` | parametri facoltativi complicano i cataloghi e la prova di nebbia, che chiede i parametri esatti |
| `periscopio.scia` senza parametri | `periscopio.scia {velocita}` | l'ufficiale dice a che velocità si sta andando |
| contatti `'S1'…` | `CONTATTO_RE`: 1-3 maiuscole (anche cirilliche: `Ц1`) e un numero | le designazioni sovietiche dell'equipaggio dell'Alfa |
| `soluzione {contatto, ora, distanza, rotta, velocita}` (ordine e messaggio) | più `rilevamento` (facoltativo nell'ordine, sempre nel messaggio) | senza il rilevamento all'ora della soluzione il client non sa dove mettere la soluzione e la sua ellisse; il comandante che lo omette usa quello misurato dall'equipaggio |
| — | rapporto `tma.ekelund` | al livello 1 l'equipaggio dice la distanza di Ekelund a ogni cambio di gamba |
| `tracce[].speculare?` | presente solo finché la traccia è ambigua | lo speculare non ha senso dopo che un'accostata o la sfera hanno deciso il lato; il client lo disegna solo quando c'è |
| `tracce[].confidenza` | `null` se la classe è del comandante | la classificazione del comandante non è una probabilità dell'equipaggio |
| rapporti della TMA dal sonarista | `chi: 'tiro'` (centrale di tiro) | la TMA la fa la squadra di tiro, non il sonar; il client sceglie il ritratto per ruolo |
| `soluzione` ai livelli 2-3 per ogni traccia con una soluzione | solo con la distanza osservabile (Q > 0) | senza manovra la distanza è un'ipotesi del priore, non una soluzione: l'equipaggio lo dice con `tma.distanza_non_osservabile` |
| diario `scoperta {…, se}` | più `banda`, `se_misurato`, `rilevamento`, `speculare`, `rilevamento_vero`, `umano`; `controscoperta` passiva con `causa` dallo stato vero di chi è stato sentito | servono alle statistiche (falsi contatti, vantaggio di rilevamento, «ti hanno sentito per colpa di…») |

