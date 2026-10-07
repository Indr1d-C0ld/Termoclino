# Protocollo client ↔ server di gioco

Il contratto vive nel codice in `shared/protocol.js`, importato da entrambe le parti. Questo
documento ne spiega le regole e tiene la storia delle versioni. Se i due divergono, vale il
codice e questo documento va corretto.

## Regole che non cambiano con le versioni

1. **Messaggi JSON** con un campo `t` (tipo), al massimo 16 KiB. Binario solo se un giorno il
   waterfall lo richiederà (lo si dirà qui).
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
   prova automatica che lo verifica sui messaggi effettivamente inviati.
5. **I codici d'errore sono stabili** (`ERRORI` in `shared/protocol.js`); il client li traduce.
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

## Versione 1 (F1) — prima immersione (bozza)

Aggiunge una partita di prova («palestra» nell'area di TORPEX '89) in cui ogni giocatore
collegato governa un proprio 688. Niente armi, niente TMA.

| Direzione | Tipo | Campi |
|-----------|------|-------|
| C → S | `entra` | `scenario` (in F1 solo `torpex_palestra`) |
| C → S | `esci` | — |
| C → S | `ordine` | `cosa`, `valore` — vedi sotto |
| S → C | `partita` | `id`, `scenario`, `scala_tempo`, `ora_gioco` (s), `origine {lat, lon}`, `area {x0,y0,x1,y1}` (m), `battello {classe, nome}` |
| S → C | `stato` | 4 Hz di tempo reale: il **proprio** battello — `t` (s di gioco), `x`, `y`, `z` (m), `rotta`, `velocita` (kt), `ordine_macchina`, `timone`, `timoni_o`, `quota_ordinata`, `cavitazione` (0-1), `towed {stato, filato_m}`, `fondale` (m sotto la chiglia), `strato` (m) |
| S → C | `sonar` | 1 Hz di tempo di gioco: `t`, per sensore (`sfera`, `towed`) un vettore di 180 settori da 2° con l'eccesso di segnale quantizzato (0-255), e i settori ciechi |
| S → C | `rapporto` | messaggio dell'equipaggio: `chiave` (per i cataloghi delle lingue), `parametri`, `chi` (ruolo che parla) |

Ordini (`cosa` → `valore`):

| `cosa` | `valore` |
|--------|----------|
| `macchina` | `stop`, `1/3`, `2/3`, `std`, `full`, `flank`, `rev` |
| `timone` | gradi interi da −30 (sinistra) a +30 (dritta) |
| `timoni_o` | gradi interi da −20 (salire) a +20 (scendere) |
| `quota` | quota ordinata in metri (l'auto-quota se ne occupa), oppure `periscopica`, `emersione` |
| `towed` | `fila`, `ritira`, `taglia` |
| `rotta` | rotta ordinata in gradi (l'autopilota se ne occupa) |
| `waypoint` | `{azione: 'aggiungi'|'togli'|'svuota', x, y}` |
| `autopilota` | `true` / `false` |
| `scala_tempo` | solo in singolo: 0 (pausa), 1, 2, 4, 8, 16, 32 |

Le posizioni sono in metri nel piano tangente dello scenario (x verso est, y verso nord, quota
positiva verso il basso), angoli in gradi veri, velocità in nodi. Le conversioni stanno in
`shared/units.js` e `shared/geo.js`.
