# Taratura del sonar passivo di F1

Come il server di gioco decide che cosa si sente, con quali numeri, e a che distanza. È il
livello C di `docs/ricerca/05_acustica.md` §6.3 (ripiego analitico, senza tabelle di
propagazione): le tabelle calcolate col tracciatore di raggi arrivano in F2 e sostituiranno la
perdita di trasmissione qui sotto senza toccare il resto.

Codice: `server/src/sim/sensors/acustica.js` (i termini), `passivo.js` (i fotogrammi),
`taratura.js` (le portate). Costanti: `shared/data/acustica.json`, ognuna con fonte e confidenza;
le costanti di piattaforma restano in `shared/data/piattaforme/*.json`. Le tabelle di questo
documento si rifanno con

```bash
node server/strumenti/taratura.js --fondale 200     # la palestra: piattaforma delle Fær Øer
node server/strumenti/taratura.js --fondale 1000    # acqua profonda, stesso mare
node server/strumenti/taratura.js --provvisorio     # l'ambiente provvisorio (strato a 60 m)
```

e le prove `server/test/acustica.test.js` controllano che restino dentro le bande del §4.

## 1. L'equazione

Per ogni sensore, per ogni sorgente, ogni secondo di gioco:

```
SE  = SL − TL − NL + DI − DT             (dB; SE = 0 → probabilità di scoperta 50 %)
SE' = SE + x(t)                          x: Ornstein-Uhlenbeck, σ = 6 dB, τ = 180 s
θ̂   = θ + N(0, σθ)                       σθ = max(σmin, 0,5 · fascio · 10^(−SE'/20))
```

Tutti i livelli sono **spettrali** (dB re 1 µPa²/Hz, sorgenti a 1 m) al centro della banda, e la
soglia è quella di un rivelatore d'energia riferita ai livelli spettrali, `DT = 5·log10(d/(B·t))`
con d = 13,8 (Pd 50 %, Pfa 10⁻⁴), B la larghezza della banda e t = 5 s di integrazione
dell'operatore. Così la larghezza di banda entra una volta sola, nella soglia.

### 1.1 Due bande, una per sensore

| Sensore | Banda | Centro | DI | Fascio a −3 dB | DT | Perché |
|---------|-------|-------:|---:|---------------:|---:|--------|
| sfera BQS-13 | 1414-2828 Hz | 2 kHz | 25,5 dB | 9,8° | −13,5 dB | la frequenza di riferimento della sfera nei dati: DI e fascio sono quelli del file, senza riscalature; sopra 1 kHz il salto di cavitazione conta per intero; il broadband di *Sub Command* stava a 2-4 kHz |
| antenna TB-16 | 212-424 Hz | 300 Hz | 14,7 dB | 3,5° | −9,4 dB | la frequenza di riferimento dell'antenna nei dati; bassa frequenza: niente assorbimento, più traffico |

Una banda media e una bassa bastano a dire le due cose che contano in F1: la cavitazione si sente
soprattutto in alto, il traffico lontano e l'antenna vivono in basso. Una terza banda non avrebbe
aggiunto niente che il giocatore possa vedere prima delle righe tonali (F2), che avranno bande
strette proprie.

## 2. I termini

**Sorgenti (SL).**

- Sottomarini (SCHEMA §5): `SL = SL_rif + gradino_sl0 + 20·log(max(v, 3)/5) + pendenza_extra·(v − 15)⁺`
  a 1 kHz, poi `−20·log(f/1 kHz)` per portarlo al centro della banda (spettro di Ross),
  `+ salto` (18 dB) se l'elica cavita (metà nella banda dei 300 Hz), `+3 dB` di poppa e `−2 dB` di
  prua raccordati col coseno dell'aspetto, `+20 dB` durante il soffiaggio d'emergenza.
  **SL_rif = 95 dB** (688I a 5 kt, 1 kHz): classificato, tarato sulle portate del §4. Il 688
  Flight I della palestra sta a +1, l'Alfa a +14 con un dB per nodo in più oltre i 15 kt.
- Cavitazione: innesco `V(d) = V_rif·√((d + 10,1)/(d_rif + 10,1))` alla quota della chiglia (come
  sono tarati i dati: 7,7 kt a quota periscopica, 18,6 a 500 ft, 25,9 a 1000 ft), confrontato con
  la velocità **dei giri** dell'elica, che segue l'ordine di macchina in pochi secondi mentre lo
  scafo ci mette minuti: chi chiama tutta forza cavita subito (come nel 1989, dove «la cavitazione
  dipende dall'accelerazione»), e a regime vale la tabella delle quote. La marcia indietro a nave
  lanciata conta il doppio della velocità dello scafo.
- Navi di superficie (forma di Ross, 50·log v): cacciatorpediniere **116 dB** a 10 kt a 1 kHz
  (Ross per 4 050 t darebbe 126: un'unità militare a velocità di trasferimento ha le eliche poco
  caricate; −10 dB nozionali), mercantile da 10 000 t **132 dB** (Ross, calcolato). Sotto i 3 kt
  resta il rumore dei macchinari: un cacciatorpediniere fermo si sente ancora a un miglio.
- Biologici: 98 dB a 2 kHz e 104 a 300 Hz quando parlano; episodi esponenziali di 2 minuti in
  media ogni 10.

**Perdita di trasmissione (TL)**, PROGETTO §5.3:

```
TL = 20·log min(r, r₀) + 10·log(max(r, r₀)/r₀) + α(f)·r + β·(r − r₀)⁺ + L_strato
```

- `r₀` = profondità dell'acqua (la minima fra sorgente, ricevitore e punto medio, mai sotto 100 m):
  sferica finché il fondo non conta, cilindrica dopo.
- `β` = perdita dei rimbalzi sul fondo nel regime cilindrico, `5 dB · tan 20° / (2·H)`, al massimo
  2 dB/km: circa 0,9 dB/km con 1000 m d'acqua, 2 dB/km sulla piattaforma (05 §5.5: 0,5-2).
- `α` = Ainslie & McColm nell'acqua dello scenario (0,14 dB/km a 2 kHz, 0,01 a 300 Hz in estate).
- `L_strato` = perdita dello strato quando sorgente e ricevitore ne stanno da parti opposte: quella
  dell'ambiente (13,5 dB nell'estate di TORPEX, strato a 21 m), altrimenti 12 dB; zero sotto i
  500 m di distanza (i raggi ripidi lo attraversano), piena oltre i 2000 m. La quota che conta è
  quella dell'elica e della sfera (chiglia − 5 m) e quella dell'antenna, che sta 30-100 m sotto il
  battello: **l'antenna può stare sotto lo strato mentre lo scafo è sopra**.

**Rumore (NL)** = rumore del mare ⊕ rumore proprio:

- mare: modello di Coates dell'ambiente (traffico 0,4, mare forza 3): 59,9 dB a 2 kHz, 65,2 dB a
  300 Hz;
- sfera: `45 − 6 + 10·log(1 + (v/8)⁶)` (il livello dei dati a 1 kHz portato a 2 kHz), +10 dB se
  si cavita: a 5 kt è 20 dB sotto il mare, a 15 pari, a 25 si è sordi;
- antenna: `33 + 10·log(1 + (v/3)⁶)` a 300 Hz (vedi §5.2), metà della cavitazione; oltre gli 8 kt
  si perde in più 1 dB per nodo (regola R2), oltre i 12 l'antenna è sorda.

**Fotogramma.** L'energia `10^(SE'/10)` di ogni sorgente si stende sui 180 settori col diagramma
del fascio puntato sul rilevamento misurato θ̂ (lobo principale gaussiano, lobi laterali a −25 dB
per la sfera e −20 per l'antenna che calano di 20·log(Δ/fascio)); per l'antenna anche sullo
speculare rispetto all'asse, con il fascio che si allarga verso gli assi (fino a 4 volte) e σθ
triplo entro 30° dagli assi. Sopra si somma il **fondo normalizzato**: potenza esponenziale di
media −10 dB, indipendente per settore e per fotogramma, il grano del waterfall. Un settore di
solo rumore supera la soglia con probabilità e⁻¹⁰ ≈ 5·10⁻⁵ (circa una volta ogni due minuti su
tutto il cerchio). Le sorgenti nei settori ciechi (baffles di 60° della sfera, cono di ±20° a prua
dell'antenna) non entrano. Quantizzazione: `SE = −30 + 0,5·q`, soglia a q = 60 (PROTOCOLLO).

**Il sonarista** (equipaggio) lavora solo sui byte del fotogramma: massimi locali sopra 0 dB e
almeno 3 dB sopra i settori a mezzo fascio, associati per vicinanza (porta di 1,5 fasci), un
contatto è nuovo quando il picco c'è in 5 fotogrammi su 8 ed è perso dopo 60 s senza picco.

## 3. Le portate

Portata = distanza a cui `SE` medio (senza fluttuazione) scende a 0, cioè dove un contatto si
sente metà del tempo. Con σ = 6 dB di fluttuazione un contatto si sente ogni tanto anche più
lontano e si perde ogni tanto più vicino. Geometria: bersaglio al traverso, aspetto neutro.
Ambiente: l'estate di TORPEX '89 dallo scenario (strato a 21 m con 13,5 dB, mare forza 3,
traffico 0,4, acqua a 8,7 °C), con il fondale della palestra (piattaforma delle Fær Øer, 180-220 m
nei punti di partenza) e, per confronto, in acqua profonda. Chi ascolta va a 5 kt se non è detto.

| Caso | Sensore | Piattaforma (200 m) kyd | nm | Acqua profonda (1000 m) kyd | nm |
|------|---------|----:|----:|----:|----:|
| 688 a 5 kt, entrambi a 150 m | sfera | 5,0 | 2,5 | 4,2 | 2,1 |
| 688 a 5 kt a quota periscopica, ascolto a 150 m (strato in mezzo) | sfera | 1,8 | 0,9 | 1,4 | 0,7 |
| 688 a 10 kt (150 m) | sfera | 7,3 | 3,6 | 7,8 | 3,8 |
| 688 a 15 kt (150 m) | sfera | 8,7 | 4,3 | 10,2 | 5,0 |
| 688 a 20 kt (150 m, cavita) | sfera | 17,6 | 8,7 | 27,1 | 13,4 |
| 688 a 10 kt a quota periscopica (cavita), ascolto a quota periscopica | sfera | 14,9 | 7,3 | 21,8 | 10,8 |
| 688 a 5 kt, chi ascolta va a 15 kt | sfera | 4,6 | 2,3 | 3,6 | 1,8 |
| 688 a 5 kt, chi ascolta va a 25 kt | sfera | 0,5 | 0,3 | 0,4 | 0,2 |
| Alfa a 10 kt (150 m) | sfera | 12,7 | 6,3 | 17,6 | 8,7 |
| Alfa a 40 kt (300 m, cavita) | sfera | 38,3 | 18,9 | 68,7 | 33,9 |
| cacciatorpediniere a 10 kt, ascolto a quota periscopica (stesso lato) | sfera | 13,1 | 6,5 | 18,4 | 9,1 |
| cacciatorpediniere a 10 kt, ascolto a 150 m (sotto lo strato) | sfera | 7,5 | 3,7 | 8,1 | 4,0 |
| cacciatorpediniere a 20 kt, ascolto a quota periscopica | sfera | 19,9 | 9,8 | 31,6 | 15,6 |
| cacciatorpediniere a 20 kt, ascolto a 150 m | sfera | 13,8 | 6,8 | 19,7 | 9,7 |
| cacciatorpediniere fermo (macchinari), ascolto a quota periscopica | sfera | 3,0 | 1,5 | 1,8 | 0,9 |
| mercantile a 12 kt, ascolto a quota periscopica | sfera | 22,1 | 10,9 | 36,1 | 17,8 |
| mercantile a 12 kt, ascolto a 150 m | sfera | 16,0 | 7,9 | 23,9 | 11,8 |
| sorgente biologica attiva (30 m), ascolto a 150 m | sfera | 8,1 | 4,0 | 9,1 | 4,5 |
| 688 a 5 kt (150 m) — antenna, battello a 150 m | towed | 3,9 | 1,9 | 2,7 | 1,3 |
| 688 a 15 kt (150 m) — antenna | towed | 7,6 | 3,7 | 8,3 | 4,1 |
| Alfa a 10 kt (150 m) — antenna | towed | 11,7 | 5,8 | 16,2 | 8,0 |
| 688 a 5 kt (150 m) — antenna a 10 kt | towed | 2,5 | 1,2 | 1,3 | 0,6 |
| 688 a 5 kt (150 m) — antenna, battello a quota periscopica (antenna sotto lo strato) | towed | 3,9 | 1,9 | 2,7 | 1,3 |
| cacciatorpediniere a 10 kt — antenna, battello a quota periscopica | towed | 6,3 | 3,1 | 6,2 | 3,1 |
| mercantile a 12 kt — antenna, battello a 150 m | towed | 15,1 | 7,5 | 23,2 | 11,4 |

## 4. Le bande, e come ci stanno

Le prove (`server/test/acustica.test.js`, in tre ambienti: provvisorio, estate in acqua
profonda, piattaforma) falliscono se una portata esce da queste bande.

| Richiesta | Fonte | Banda della prova | Risultato |
|-----------|-------|-------------------|-----------|
| due battelli silenziosi si scoprono «a poche migliaia di iarde» (Akula contro 688: 3-10 kyd) | PROGETTO §5.12, 07 §7 | 688 contro 688 a 5 kt: 2,5-7 kyd | 4,2-5,0 kyd |
| se uno accelera, l'altro lo sente prima | PROGETTO §11.2 (13) | 15 kt: oltre 1,6 volte la portata a 5 kt; cavitando oltre 1,8 volte quella a 15 | ×1,7-2,4; ×2,0-2,7 |
| se uno scende sotto lo strato, l'altro lo perde | PROGETTO §11.2 (13) | con lo strato in mezzo meno di metà | ×0,33-0,36 |
| per ascoltare si rallenta; a 25 kt si è sordi | 05 §7.1 | a 25 kt meno di un quarto | ×0,1 |
| un cacciatorpediniere a 10 kt: varie miglia; attraverso lo strato molto meno | indicazione per F1 | 5-15 nm dallo stesso lato; dall'altro meno del 60 % | 6,5-9,1 nm; 3,7-4,0 nm |
| l'Alfa rumoroso già a velocità tattica, sentito da lontanissimo a tutta forza | 01 §3.2-3.3 | a 10 kt oltre 1,6 volte il 688; a 40 kt oltre 15 nm | ×1,7-2,3; 19-34 nm |
| l'antenna: utile a velocità basse, sorda oltre i 12 kt | R2, 04 §4.6.2 | 1,5-7 kyd sul 688; peggio a 10 kt | 2,7-3,9 kyd; 1,3-2,5 |
| i biologici: qualche miglio | — | 0,5-7 nm | 4,0-4,5 nm |

Lettura per la palestra: due 688 lenti sotto lo strato si sentono a 4-5 kyd; i cacciatorpediniere
a 10 kt si sentono a 6-7 miglia stando a quota periscopica e a 3-4 scendendo sotto lo strato (che
d'estate è a soli 21 m); un 688 che corre o cavita si fa sentire a 8-15 kyd, e un Alfa a tutta
forza da quasi venti miglia anche sulla piattaforma.

## 5. Scelte e compromessi

1. **Livelli assoluti nozionali, relativi documentati.** L'ordine delle classi (ONI 1996, Coté) e
   la fisica (equazioni, Coates, Ainslie & McColm) sono pubblici; i decibel dei battelli no. Si è
   fissato un solo numero libero, `SL_rif`, sulle portate fra sottomarini; tutto il resto (navi,
   rumore del mare, soglie) viene da formule con fonte. Il cacciatorpediniere è l'unica correzione
   a mano (−10 dB rispetto a Ross, §2).
2. **Il rumore proprio dell'antenna.** Il modello di riferimento di SCHEMA §5 applica a tutti i
   sensori il `livello_macchinario` (45 dB a 1 kHz, misurato sullo scafo) con il v₀ del sensore:
   per l'antenna (v₀ = 3 kt) la renderebbe sorda già a 6 kt, contro le regole R2 dello stesso
   file (piena efficacia fino a 8 kt, sorda oltre 12). L'antenna sta 800 m a poppa: ha un livello
   suo, `rumore_proprio.towed_base` = 33 dB a 300 Hz in `acustica.json`, scelto perché il flusso
   pareggi il mare a circa 9 kt. Le regole R2 (degrado di 1 dB/kt oltre gli 8, sorda oltre i 12)
   restano in vigore sopra il flusso.
3. **In F1 l'antenna non sente più lontano della sfera** sui sottomarini (2,7-3,9 kyd contro
   4,2-5,0): a 300 Hz il traffico è più alto e il DI più basso. Il suo vantaggio vero sono le
   righe tonali di bassa frequenza, che arrivano in F2. Già in F1 però non ha baffles a poppa, ha
   un fascio di 3,5° invece di 9,8° (rilevamenti più precisi), e sta sotto lo strato quando il
   battello è a quota periscopica.
4. **Acque basse.** Sulla piattaforma la divergenza diventa cilindrica presto ma il fondo si prende
   2 dB/km: le sorgenti forti guadagnano meno portata che in acqua profonda (un cacciatorpediniere
   a 20 kt: 10 nm invece di 16). È fisica, non un difetto: le prove hanno bande che valgono in
   entrambi i casi.
5. **Cavitazione a giri, non a velocità**: vedi §2. A regime la tabella delle quote vale esatta
   (prova `server/test/cavitazione_towed.test.js`).

## 6. Che cosa manca (F2)

- Zone di convergenza, rimbalzo sul fondo come percorso a sé, canale superficiale, effetto
  dello specchio di Lloyd per le sorgenti vicine alla superficie: arrivano con le tabelle del
  tracciatore di raggi.
- La terra non fa ombra: un percorso che passa sopra un'isola paga solo le perdite delle acque
  bassissime (fondale minimo di 1 m nel punto medio).
- Lo strato è uguale in tutta l'area (lo dà così l'ambiente di F1).
- Niente righe tonali, transitori (tranne il soffiaggio d'emergenza), sonar attivo.
