# Formato dei dati di piattaforma

File in `shared/data/piattaforme/<id>.json`, letti da `shared/data/piattaforme.js` sia dal server di
gioco sia dal browser. Formato `termoclino-piattaforma/1`. Oggi ci sono `688.json` (Los Angeles,
Flight I, con Flight II e 688I fra le varianti) e `alfa.json` (progetto 705/705K); le altre classi
arrivano in F7 con lo stesso schema.

La regola di fondo è il pilastro 3 di `docs/PROGETTO.md`: **ogni numero ha una fonte datata e una
confidenza**. Nei file non esiste un numero «nudo»: le prove (`shared/test/piattaforme.test.js`)
falliscono se ne compare uno.

## 1. Il dato

Ogni numero, e ogni fatto vero/falso che conta (per esempio «ha l'antenna rimorchiata»), è un
oggetto così:

```json
{"valore": 290, "unita": "m", "fonte": "[PM04] [FAS-688]", "confidenza": "stimato",
 "nota": "Test depth di 950 ft …", "rif": "01_piattaforme.md §1.1", "intervallo": [289, 300]}
```

| campo | obbligatorio | significato |
|---|---|---|
| `valore` | sì | numero, booleano o testo |
| `unita` | se `valore` è un numero | una delle unità canoniche (§2); vietata sui valori non numerici |
| `fonte` | sì | una o più chiavi di `docs/ricerca/FONTI.md` fra parentesi quadre, eventualmente con la pagina dentro le parentesi: `"[CFW86 p.618–619] [FAS-688]"`. La chiave è la prima parola dentro le parentesi |
| `confidenza` | sì | `documentato`, `stimato`, `calcolato` o `nozionale` (§3) |
| `nota` | no | perché questo valore, in italiano: le alternative scartate, il calcolo, i limiti |
| `rif` | no | sezione della ricerca (`docs/ricerca/…`) o di PROGETTO dove sta il ragionamento |
| `intervallo` | no | `[min, max]` della forchetta delle fonti; deve contenere `valore` |

Un oggetto è un dato se ha le chiavi `valore` e `confidenza`. Altre chiavi non sono ammesse. I testi
liberi (nomi, descrizioni, la legge di un telegrafo) restano stringhe semplici, senza provenienza.

**Le fonti.** Ogni chiave deve esistere nell'indice in fondo a `FONTI.md`; le chiavi segnaposto
(`[DS-xxx]`, `[AW-xxx]`, `[RSI-xxx]`) non valgono. Per un valore nozionale si cita la fonte su cui
il ragionamento si appoggia (per esempio `[DS-705]` per un diametro tattico tarato sull'inversione
in 42 s), non la ricerca interna, che va in `rif`. `[CONO]` è l'etichetta di `FONTI.md` per la
«conoscenza pregressa, non riverificata»: un dato che ha solo `[CONO]` come fonte deve essere
`nozionale` (lo controllano le prove).

## 2. Unità canoniche

Una sola unità per grandezza, così `piattaforma.valori` dà numeri pronti senza conversioni nascoste.
L'unità d'origine (piedi, shp, minuti, cavalli) si scrive nella `nota`.

| unità | grandezza |
|---|---|
| `kt` | velocità orizzontale (negativa = indietro) |
| `kt/s` | accelerazione |
| `m` | lunghezze, quote, distanze, calibri |
| `m/s` | velocità verticale |
| `s` | tempi |
| `°` | angoli; gli archi dei sensori sono semiampiezze salvo dove il nome dice altro (`arco_baffles` è l'ampiezza totale) |
| `°/s` | velocità angolari |
| `Hz` | frequenze |
| `dB` | livelli relativi, guadagni, indici di direttività |
| `dB/kt`, `dB/decade` | pendenze del rumore (20 dB/decade = 20·log v) |
| `t` | dislocamenti |
| `kW` | potenze, anche termiche |
| `n` | conteggi |
| `%` | percentuali |
| `giri/min/kt` | giri dell'asse per nodo |
| `anno` | anni del calendario |
| `1` | numeri puri: fattori, frazioni, esponenti |

Le conversioni stanno in `shared/units.js`.

**Convenzioni geometriche** (le stesse del motore, `shared/units.js`): piano locale in metri con x a
est e y a nord; rotte e rilevamenti da nord in senso orario; **quota positiva verso il basso, misurata
alla chiglia** come sui profondimetri USA. I rilevamenti relativi sono da prua in senso orario
(000-359), oppure con segno (positivo a dritta).

## 3. Confidenza

Le stesse etichette del catalogo di ricerca (`docs/ricerca/05_acustica.md` §0):

- `documentato`: dato ufficiale o di fonte autorevole primaria aperta (fact file, GAO, testimonianze,
  manuale del gioco del 1989 per i valori del gioco stesso);
- `stimato`: stima credibile di fonte aperta specializzata (FAS, Combat Fleets, Polmar, deepstorm.ru…);
- `calcolato`: ricavato con un calcolo riproducibile da valori documentati o stimati e ipotesi
  dichiarate nella nota (va trattato come `stimato`). Un calcolo esatto su un ingresso nozionale
  resta `nozionale`;
- `nozionale`: valore classificato o non trovato, proposto per il gioco con il ragionamento.

## 4. Struttura di un file

```
formato, id, aggiornato
identita        nome, designazione, tipo, nazione, lato ("usa" | "urss"), progetto, configurazione,
                primo_in_servizio, unita_costruite, operativi_per_anno{"1985".."1991"}, equipaggio
dimensioni      lunghezza, larghezza, pescaggio, dislocamento_superficie, dislocamento_immersione
propulsione     reattore (testo), potenza_asse, assi, elica_pale, giri_per_nodo, reattore_sempre_acceso
dinamica        velocita_max, velocita_max_superficie, telegrafo, ordini_macchina[],
                accelerazione{tau,max}, decelerazione{tau,max}, frenata_rev,
                accostata{angolo_timone_max, diametro_tattico, velocita_angolare_max,
                          tempo_risposta, perdita_velocita},
                quota{assetto_max, velocita_assetto, velocita_piena_efficacia_timoni,
                      velocita_verticale_max, velocita_verticale_zavorra,
                      velocita_emersione_emergenza}
profondita      periscopica, automatica, operativa, collaudo, collasso
acustica        rumore_irradiato{…}, cavitazione{…}, rumore_proprio{…}, tonali[], forza_bersaglio{…}
sensori         sfera, sfera_attiva, conforme, rimorchiata, intercettazione, alta_frequenza, periscopio
armi            tubi{…}, capacita, vls, filoguida, dotazioni[], contromisure{…}
varianti        (facoltativo) sotto-classi con le sole differenze, per anno
riferimento_1989  i valori del gioco originale, per il preset «regolamento 1989» (decisione D3)
contraddizioni  come il file risolve le voci di docs/ricerca/CONTRADDIZIONI.md (testo)
```

Ogni sensore ha `presente`; un sensore assente ha solo `presente` (falso) con la sua fonte e nota.
I campi delle sezioni che il motore usa in F1 sono tipizzati in `ValoriPiattaforma`
(`shared/data/piattaforme.js`) e le prove controllano che esistano in tutti i file.

### 4.1 Campi che chiedono una spiegazione

- `operativi_per_anno`: battelli in servizio operativo **al 31 dicembre** di ogni anno.
- `ordini_macchina`: le tacche del telegrafo, **in ordine dalla più indietro alla più avanti**, con
  velocità strettamente crescenti; l'ultima coincide con `velocita_max`. Il 688 usa gli ordini USN
  (REV, STOP, 1/3, 2/3, STD, FULL, FLANK); l'Alfa un telegrafo a percentuale da −10 a 110, come nel
  gioco del 1989, e ogni tacca ha anche `percentuale`. `telegrafo.tipo` è `"ordini"` o
  `"percentuale"`; per il secondo `telegrafo.legge` dice come la percentuale diventa velocità.
- `profondita.operativa` è la quota di lavoro normale (рабочая глубина per i sovietici); `collaudo` la
  quota limite autorizzata (test depth USA, предельная глубина sovietica); `collasso` lo schiacciamento.
  Per la US Navy operativa e collaudo coincidono. `automatica` è la quota della funzione «150 FT».
- `acustica.rumore_irradiato.gradino_sl0`: scarto in dB dal 688I sulla **scala a gradini** di
  `01_piattaforme.md` §3.3 (688I = 0). Il livello assoluto di riferimento del 688I è un parametro
  del modello acustico, non della piattaforma.
- `acustica.tonali[].sopra_banda_larga`: altezza della riga sullo spettro a banda larga dello stesso
  battello alla stessa frequenza, in una cella di 1 Hz. È negativa per le righe sepolte nel rumore
  (l'Akula secondo Coté). `da_velocita` e `a_velocita` delimitano il regime in cui la riga esiste.
- `sensori.*.frequenza_rif`: la frequenza a cui sono dati `indice_direttivita` e `fascio_3db`. Il
  modello li ricava a ogni frequenza dalla geometria (`diametro_equivalente` per le sfere,
  `lunghezza_antenna` per le antenne lineari); le prove controllano che i due valori siano coerenti
  con la geometria.
- `varianti.<nome>`: solo ciò che cambia rispetto alla configurazione di base, più `dal_anno` e
  `operativi_per_anno` della variante.

## 5. Modelli di riferimento

I numeri hanno senso solo dentro un modello. Questi sono i modelli con cui i dati sono stati tarati e
con cui le prove li verificano; il motore di F1 può raffinarli, ma se cambia la forma deve ritarare i
dati. Le equazioni definitive andranno in `docs/SIMULAZIONE.md`.

**Velocità.** La velocità insegue l'ordine con un primo ordine limitato:
`dv/dt = clamp((v_ordine − v) / tau, −max_dec, +max_acc)`, con `accelerazione` quando l'ordine è più
alto della velocità, `decelerazione` quando è più basso e la macchina va avanti, `frenata_rev` come
limite quando la macchina va indietro. Tarature: l'Alfa arriva da 0 a 40 kt in meno di un minuto
(«piena velocità entro un minuto», [DS-705]); il 688 impiega circa 3-4 minuti.

**Accostata.** A barra tutta il battello percorre un cerchio di diametro `diametro_tattico`, quasi
indipendente dalla velocità; nell'accostata la velocità cala verso `v·(1 − perdita_velocita)`; la
velocità angolare è `min(velocita_angolare_max, v_effettiva / (diametro_tattico/2))` e si raggiunge
dopo `tempo_risposta`. Con barra parziale si scala in proporzione all'angolo di barra. Taratura:
l'Alfa inverte la rotta alla velocità massima in 42 s [DS-705].

**Quota.** I timoni orizzontali agiscono solo con abbrivio: la loro efficacia vale
`min(1, (v / velocita_piena_efficacia_timoni)²)`; l'assetto cambia al più di `velocita_assetto` per
quell'efficacia e non supera `assetto_max`; la velocità verticale è `v · sin(assetto)` limitata da
`velocita_verticale_max`. Da fermi resta solo `velocita_verticale_zavorra` (casse d'assetto);
l'emersione d'emergenza sale a `velocita_emersione_emergenza` e fa un transitorio forte. È la
correzione voluta del 1989, dove si scendeva a 18 ft/s anche da fermi.

**Cavitazione** (`05_acustica.md` §7.2): `V_cav(d) = velocita_rif · √((d + 10,1) / (quota_rif + 10,1))`,
con d in metri (pressione assoluta: la forma del testo USNA proporzionale alla sola profondità
sbaglia vicino alla superficie). Sopra `V_cav` il rumore a banda larga sale di `salto` dB.

**Rumore irradiato** (`05_acustica.md` §7.3, `01_piattaforme.md` §3.2):
`SL(v) = SL_rif + gradino_sl0 + pendenza·log10(max(v, velocita_min) / velocita_rif)
+ pendenza_extra · max(0, v − soglia_pendenza_extra)` più l'eventuale salto di cavitazione, più
`aspetto_poppa` o `aspetto_prua` secondo l'angolo da cui si ascolta.

**Rumore proprio** (`05_acustica.md` §7.1): `NL(v) = livello_macchinario + 10·log10(1 + (v/v₀)^esponente)`
con v₀ = `velocita_soglia_sfera`, `velocita_soglia_conforme` o `velocita_soglia_rimorchiata`
secondo il sensore. Eccezione, decisa in F1: per l'antenna rimorchiata `livello_macchinario` (misurato
sullo scafo) non vale, perché la renderebbe sorda già a 6 kt contro le regole R2 qui sotto: al suo posto
si usa `rumore_proprio.towed_base` di `shared/data/acustica.json` (l'antenna sta 800 m a poppa, lontana
dai macchinari). La motivazione è nella nota di quel campo.

**Errore di rilevamento** (regola R1 di `CONTRADDIZIONI.md` §4, PROGETTO §5.6):
`σ = max(sigma_min, coefficiente_sigma · fascio(f) · 10^(−SE/20))`, con SE l'eccesso di segnale in dB.
Per le antenne rimorchiate σ si moltiplica per `fattore_sigma_estremita` entro `arco_estremita`
dall'asse, e nulla si sente entro `cieco_prua` dalla direzione del proprio battello.

**Antenna rimorchiata** (regole R2 e R3): sotto `velocita_min` l'antenna si incurva; piena efficacia
fino a `velocita_piena_efficacia`, poi `degrado_oltre` dB per nodo; sorda oltre `velocita_sorda`;
rischio di danno oltre `velocita_danno`. Dopo un'accostata più ampia di `soglia_accostata` non dà
rilevamenti per `(lunghezza_cavo + lunghezza_antenna) / v`, limitato fra `tempo_morto_min` e
`tempo_morto_max`; le accostate più piccole raddoppiano σ (`fattore_sigma_piccola_accostata`) per
`durata_piccola_accostata`. Ambiguità destra/sinistra se `ambiguita_destra_sinistra`.

## 6. Aggiungere una piattaforma

1. Copiare la struttura di un file esistente e riempirla dalla ricerca, con una fonte per ogni numero.
2. Aggiungere l'id a `PIATTAFORME` in `shared/data/piattaforme.js`.
3. `npm test`: le prove controllano provenienza, chiavi di fonte, unità, completezza e coerenza
   fisica; quelle specifiche del duello (688 contro Alfa) vanno estese se servono.
4. Se una scelta risolve o lascia aperta una voce di `CONTRADDIZIONI.md`, scriverlo in `contraddizioni`.

## 7. Scenari

Gli scenari stanno in `shared/data/scenari/<id>.json` (formato `termoclino-scenario/1`) con la griglia
del fondale accanto (`<id>.batimetria.bin`, Int16LE); li genera `tools/batimetria/scarica.py` e li legge
`shared/ambiente.js`, che ne descrive il formato in testa al modulo. La regola di provenienza è la
stessa di queste pagine, con due aggiunte:

- la **serie**, `{"serie": [numeri], "unita", "fonte", "confidenza", "nota"?}`, per i profili e le
  tabelle (temperatura, salinità e velocità del suono per quota, rumore per banda), dove un dato per
  numero sarebbe solo rumore;
- le unità dell'ambiente oltre a quelle del §2: `°C`, `psu`, `dB/km`, `dB re 1 µPa²/Hz`.

Gli unici numeri senza provenienza ammessi sono quelli che descrivono il file binario
(`batimetria.colonne`, `righe`, `byte`). Le prove (`shared/test/ambiente.test.js`) controllano
provenienza, chiavi di `FONTI.md`, integrità della griglia e coerenza fisica.
