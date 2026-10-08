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
