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
acustica        rumore_irradiato{…}, cavitazione{…}, rumore_proprio{…}, tonali[], forza_bersaglio{…},
                F2: righe_giri[], pale{…}, transitori{…}
sensori         sfera, sfera_attiva, conforme, rimorchiata, intercettazione, alta_frequenza, periscopio,
                F2: esm, radar
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

### 4.2 I blocchi di F2

Usati dai sensori di F2 (`server/src/sim/sensors/`, modelli e taratura in `docs/CALIBRAZIONE_F2.md`).

- `acustica.tonali[].tipo` (testo): `elettrica`, `pompa`, `turbina`, `riduttore`, `ventilazione`,
  `diesel`… Serve alla biblioteca delle firme e al giocatore che classifica. Il livello delle righe
  a frequenza fissa (`sopra_banda_larga`) è riferito allo spettro a banda larga **alla velocità di
  riferimento** (`rumore_irradiato.velocita_rif`, 5 kt), senza cavitazione e al traverso: è un
  livello fisso, che non segue la velocità. A velocità alte la banda larga sale e può coprirle.
- `acustica.righe_giri[]`: righe che seguono i giri dell'asse (ingranamento dei riduttori,
  accensioni dei diesel): `nome`, `tipo`, `per_giro` (frequenza = `per_giro` · giri/60, giri =
  velocità dei giri · `propulsione.giri_per_nodo`), `sopra_banda_larga` (sopra la banda larga
  **attuale**, alla stessa frequenza), `da_velocita`, `a_velocita`.
- `acustica.pale`: le righe di pala (frequenza = pale · giri/60, [ITTC-02]) e d'asse e la
  modulazione del rumore per il DEMON. `livello` (dB sopra la banda larga attuale alla frequenza di
  pala, cella di 1 Hz), `armoniche` (n, fondamentale compresa), `decremento` (dB per armonica),
  `livello_asse` (dB, frequenza d'asse), `modulazione` e `modulazione_cavitante` (indice di
  modulazione d'ampiezza alla frequenza di pala, senza e con l'elica che cavita),
  `modulazione_asse` (frazione della modulazione di pala alla frequenza d'asse).
- `acustica.transitori.<tipo>`: `scafo` (`livello`, `durata`, `quota_evento`: ogni quanti metri di
  cambio di quota, `probabilita`), `pompa` (pompe d'assetto: `livello`, `durata`,
  `intervallo_minimo`), `regime` (le righe che cambiano con la velocità: transitorio `pompa`),
  `meccanico` (idraulica degli alberi), `portello` (F3), `emersione` (solo `durata`: il livello è
  quello del soffiaggio). `livello` è un livello spettrale **equivalente a 1 kHz**, dB re
  1 µPa²/Hz a 1 m, che i sensori portano al centro della loro banda con lo spettro di Ross.
- `sensori.sfera_attiva`: oltre a `frequenza` e `settore` (semiampiezza del settore di prua in cui
  si trasmette): `livello_sorgente` (dB re 1 µPa a 1 m sull'asse), `fascio` (larghezza del fascio
  attivo, gradi), `perdita_settore` (dB in meno trasmettendo su tutto il settore), `durata_corta` e
  `durata_lunga` (impulsi, s), `ascolto_corta` e `ascolto_lunga` (finestre d'ascolto, m),
  `sigma_min` (errore minimo di rilevamento dell'eco).
- `sensori.intercettazione`: in più `banda_canale` (Hz, nella soglia 5·log(d/(B·τ))) e
  `indice_direttivita`.
- `sensori.periscopio`: in più `errore_elevazione` (σ relativo dell'angolo d'albero, %: due sigma
  fanno `errore_stadimetro`), `altezza_occhio` (m sopra l'acqua), `margine_quota` (gli alberi si
  alzano con la chiglia entro `profondita.periscopica` + margine), `velocita_scia` (kt),
  `sigma_rilevamento` e `sigma_aspetto` (gradi).
- `sensori.esm`: `presente`, `nome`, `banda_min`/`banda_max` (Hz), `sensibilita` (dB re 1 mW, con
  l'unità `dB`), `sigma` (gradi), `altezza` (m).
- `sensori.radar`: `presente`, `nome` (la designazione che gli ESM altrui riconoscono), `banda`
  (lettera NATO, testo), `frequenza` (Hz), `potenza_picco` (kW), `guadagno` (dB), `fascio` (gradi),
  `periodo` (s per giro d'antenna), `altezza` (m), `portata_rif` (m: distanza a cui vede 1 000 m²),
  `sigma_rilevamento` (gradi), `sigma_distanza` (%).

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
- le unità dell'ambiente oltre a quelle del §2: `°C`, `psu`, `dB/km`, `dB re 1 µPa²/Hz`, `dB/λ`
  (attenuazione nei sedimenti).

Gli unici numeri senza provenienza ammessi sono quelli che descrivono i file binari
(`batimetria.colonne`, `righe`, `byte`; `propagazione.tabella.byte`). Le prove
(`shared/test/ambiente.test.js`) controllano provenienza, chiavi di `FONTI.md`, integrità della griglia
e coerenza fisica.

**Propagazione (F2).** Il blocco `propagazione` (formato `termoclino-tl/1`) e il file accanto
`<id>.tl.bin` li scrive `tools/acustica/tabelle.py` (`scarica.py` conserva il blocco quando rigenera lo
scenario): le classi di fondale («regioni», con fondo e profilo), i fondi, la superficie, le bande, le
quote e le distanze delle tabelle, i parametri della lettura in linea (`percorso`) e l'impronta del file.
Il formato del file è in testa a `tabelle.py`; lo legge il server
(`server/src/sim/world/propagazione.js`), e `shared/ambiente.js` ne espone solo
`regioneAcustica(x, y)`. Metodo e convalida: `docs/CALIBRAZIONE_F2.md`, parte G.

## 8. Firme (F2)

Le firme stanno in `shared/data/firme/<id>.json` (formato `termoclino-firma/1`), lette da
`shared/data/firme.js` nel server e nel browser: le navi di superficie (`forrest_sherman`), il
mercantile (`mercantile_generico`) e le sorgenti biologiche (`biologico`). Stesse regole di
provenienza delle piattaforme (§1-3: ogni numero è un dato con fonte e confidenza, le prove sono in
`shared/test/firme.test.js`). Il livello a banda larga resta nel profilo di F1 di
`shared/data/acustica.json` (`sorgenti`): la firma aggiunge ciò che serve ai sensori di F2.

```
formato, id, aggiornato
identita        nome, designazione, tipo ("nave" | "biologico"), categoria, nazione, lato, configurazione
dimensioni      lunghezza, larghezza, pescaggio, dislocamento
propulsione     assi, potenza_asse, velocita_max, elica_pale, giri_per_nodo, rete_elettrica,
                velocita_cavitazione (sopra, la modulazione e' quella dell'elica che cavita), cilindri
acustica        profilo_banda_larga (testo: la voce di acustica.json, sorgenti), velocita_rif,
                tonali[], righe_giri[], pale{…}, forza_bersaglio{prua_poppa, traverso}
ottica          altezza_alberi (m, il «libro» dello stadimetro), bordo_libero (m),
                sagoma (testo: la famiglia delle immagini originali, FOREST → FOREST0…FOREST4), luci
emettitori[]    radar: nome, banda, frequenza, potenza_picco, guadagno, fascio, periodo, altezza, acceso
specie{}        solo i biologici: <specie>{nome, canto{f_min, f_max, livello, durata_unita} | null,
                scatti{livello, durata, intervallo} | null, forza_bersaglio}
```

- Le righe di una nave sono come quelle dei sottomarini (§4.2), con la velocità di riferimento
  della firma (`acustica.velocita_rif`, 10 kt: quella del livello a banda larga di F1).
- `ottica.sagoma` è solo un **nome**: le immagini originali (gli ENC estratti in
  `web/assets/originali/`, `docs/ASSET.md`) non entrano mai nel repository. L'indice 0-4 lo sceglie
  il server dall'angolo sulla prua (0 di prua, 2 al traverso, 4 di poppa); il lato lo dice il segno
  di `visivo.aspetto`.
- `canto.livello` è il livello di una riga del canto (dB re 1 µPa² a 1 m); `scatti.livello` un
  livello spettrale equivalente a 1 kHz, come i transitori dei battelli.
- La **biblioteca delle firme** (`biblioteca()` di `shared/data/firme.js`) mette insieme
  piattaforme e firme in una voce per classe (righe, righe che seguono i giri, pale, assi, altezza
  d'albero, sagoma, radar, canto): la usano l'equipaggio per classificare e il client per il
  giocatore che classifica da sé. Le classi sono le `CLASSI` di `shared/protocol.js`.

## 9. Sensori non acustici (F2)

`shared/data/sensori.json` (formato `termoclino-sensori/1`, stesse regole) tiene le costanti dei
modelli dell'ottica (`ottica`: orizzonte, visibilità di giorno e di notte, luci della regola 22,
stato del mare, visibilità degli alberi altrui) e della radio (`radio`: raggio terrestre
equivalente, perdite, sezioni radar, soglie dell'ESM). Le carica, con le firme, `caricaAcustica()`
(`server/src/sim/sensors/acustica.js`): `ac.ottica`, `ac.radio`, `ac.firme`. Le costanti acustiche
nuove di F2 (banda stretta, DEMON, attivo, riverberazione, transitori) stanno in
`shared/data/acustica.json`.
