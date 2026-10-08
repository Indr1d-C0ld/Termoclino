# Taratura di F2

Le portate di F2 rifatte con le tabelle di propagazione, e quelle dei sensori nuovi. Il documento ha
due parti: la **propagazione** (filone G: le tabelle del tracciatore di raggi e le portate di F1
rifatte con loro) e i **sensori** (filone H, qui sotto: banda stretta, attivo e controscoperta,
transitori, periscopio, ESM e radar). Chi aggiunge una parte non tocca le altre.

## Propagazione (filone G)

Le tabelle di perdita di trasmissione TL(distanza, quota della sorgente, quota del ricevitore, banda)
che in F2 sostituiscono l'analitico di F1 (PROGETTO §5.3, F2_ASCOLTARE #1 e #12). Codice:
`tools/acustica/` — `raggi.py` (il tracciatore), `modi.py` (modi normali di Pekeris, per la
convalida), `ambiente.py` (profili, fondi, superficie e bande dello scenario), `tabelle.py` (le
tabelle), `test_convalida.py` (i casi canonici), `relazione.py` (i loro numeri, qui sotto); la lettura
in linea e' `server/src/sim/world/propagazione.js`, che i sensori raggiungono da
`server/src/sim/sensors/perdita.js`. Dati: il blocco `propagazione` di
`shared/data/scenari/torpex_palestra.json` (ogni numero con fonte e confidenza; fonti nella Parte H di
`docs/ricerca/FONTI.md`) e il file `torpex_palestra.tl.bin`. Si rifanno con

```bash
python3 tools/acustica/tabelle.py                    # le tabelle e il blocco dello scenario (circa 3 minuti, 6 processi)
python3 tools/acustica/tabelle.py --controlla        # le ricalcola e confronta lo SHA-256, senza scrivere
python3 tools/acustica/tabelle.py --solo-blocco      # riscrive solo il blocco JSON (note, parametri di lettura)
python3 -m unittest discover -s tools/acustica -p 'test_*.py' -v     # la convalida (un minuto o meno)
python3 tools/acustica/relazione.py                  # i numeri della convalida di G.4
node server/strumenti/taratura.js --tabelle --fondale 190            # le portate di F1 con le tabelle (G.7)
```

### G.1 Il metodo, e perche' semicoerente

**Raggi in forma chiusa.** In un ambiente indipendente dalla distanza (profilo c(z) lineare a tratti,
superficie, fondo piatto) un raggio e' un arco di cerchio in ogni tratto e, soprattutto, e' periodico:
oscilla fra un tetto (superficie o punto d'inversione) e un pavimento (fondo o punto d'inversione). Il
tracciatore calcola esattamente il semiciclo discendente di ogni raggio (distanza, cammino, tempo, con
formule stabili anche per gradiente nullo e ai punti d'inversione) e ottiene la posizione a qualsiasi
distanza piegando la fase: nessuna integrazione passo per passo, nessun errore che cresce sui 300 km.
Ventaglio di 1 544 raggi fra ±88°, fitti vicino all'orizzontale (0,02° entro 6°).

**Intensita' per tubi di raggi, somma semicoerente.** Ogni raggio porta l'energia del suo spicchio di
angoli; attraversando la verticale a distanza r la stende su una «tenda» triangolare larga quanto il
tubo di raggi, |∂z/∂θ₀|·Δθ (misurata con due raggi gemelli): la somma delle tende e' l'intensita' del
tubo di raggi interpolata linearmente fra i raggi, piegata alla superficie e al fondo. La tenda non
scende sotto una lunghezza d'onda e, dove il raggio curva, sotto due scale di Airy
ℓ = (λ²R/8π²)^(1/3) (il campo vicino a una caustica), mai oltre un decimo della distanza: e' la
diffrazione povera che tiene finite le caustiche ([PB87]). La somma e' **incoerente** (niente frange
d'interferenza: per una banda larga e per il gioco sono rumore), con una correzione **semicoerente**
come l'opzione omonima di Bellhop: ogni raggio che tocca la superficie ha un gemello riflesso vicino
alla sorgente, e la coppia pesa 1 − μ⟨cos 2Φ⟩ (Φ la fase verticale fra superficie e sorgente, media
sulla banda, μ la coerenza della superficie rugosa). E' lo **specchio di Lloyd**: una sorgente vicina
alla superficie irradia poco ad angoli radenti alle basse frequenze (le righe a 50 Hz di una nave
arrivano deboli lontano), e il campo si annulla vicino alla superficie. Lo stesso fattore dal lato del
ricevitore vale dopo almeno un passaggio dal fondo (prima la coppia e' una sola). La convalida mostra
che e' esatto quando la sorgente e' la quota piu' bassa: le tabelle sono simmetriche (reciprocita') e
ogni coppia si calcola cosi'. La somma puramente incoerente sbaglierebbe di 15-45 dB nel campo lontano
dello specchio di Lloyd (G.4); quella coerente non e' mediabile su una banda e non ha senso a 25 kHz.

**Canali chiusi da un'inversione: correzione WKB.** La teoria dei raggi intrappola ogni frequenza in
un canale, anche sottile. Per i raggi rinchiusi da un punto d'inversione oltre il quale il suono puo'
propagarsi di nuovo (lo strato superficiale sopra la termoclina, e il suo rovescio) ogni passaggio dal
punto d'inversione conserva S·(1 − T²): T² = 1/(1 + e^(2B)) l'effetto tunnel attraverso la barriera
(formula di Kemble, B = ∫ω√(a² − 1/c²)dz) e S il sostegno modale (il raggio e' un modo solo se la fase
verticale di mezzo ciclo arriva a quella del primo modo, 3π/4 fra superficie e inversione). L'energia
che esce si perde (nella palestra finirebbe comunque sul fondo). Effetto: lo strato estivo di 21 m
(canale con 0,34 m/s di salita della velocita') ha il primo modo fra 1,3 e 2,5 kHz e lo perde quasi
tutto per effetto tunnel; intrappola davvero solo le alte frequenze (25 kHz).

**Perdite.** Fondo: coefficiente di Rayleigh di un semispazio fluido con attenuazione ([JKPS11]) piu'
una perdita nozionale per rimbalzo (G.6). Superficie: riflessione coerente di Eckart
μ = exp(−2(kσ sin θ)²) ([ECK53]), meta' dell'energia diffusa che resta nel raggio, e la perdita dei raggi
radenti di Schulkin 1,64·√(f·H) ([SCH68]). Acqua: Ainslie & McColm sul cammino vero del raggio. Lungo le
distanze una media mobile [1, 2, 1]/4 dell'intensita' sui passi del 2,5 %.

### G.2 Le regioni: classi di fondale

L'area e' quasi tutta piattaforma (56-200 m) con i canali profondi a sud-ovest e a est. Le tabelle
sono calcolate per **sette classi di fondale** (fondo piatto), raggruppate in quattro regioni; ogni
classe ha il suo fondo e il suo profilo. Le aree sono le frazioni dei nodi di mare della griglia che
cadono nella classe (la piu' vicina nel logaritmo della profondita').

| Classe | Fondale (da-a) | Fondo | Profilo | Area |
|--------|----------------|-------|---------|-----:|
| costa_30 | 30 m (0-42) | ghiaia | rimescolato | 2,2 % |
| costa_60 | 60 m (42-81) | ghiaia | rimescolato | 6,5 % |
| piattaforma_110 | 110 m (81-145) | sabbia | rimescolato | 25,8 % |
| piattaforma_190 | 190 m (145-258) | sabbia | stratificato | 38,2 % |
| scarpata_350 | 350 m (258-458) | ghiaia | stratificato | 14,2 % |
| scarpata_600 | 600 m (458-735) | sabbia fangosa (limo) | stratificato | 6,5 % |
| canale_900 | 900 m (oltre 735) | ghiaia | stratificato | 6,6 % |

- **Profili.** Lo scenario ha il profilo climatologico WOA23 dell'estate, che smussa lo strato isotermo
  che una sonda vedrebbe. Fuori dal fronte di marea (classi da 190 m) il profilo e' quello di una sonda
  tipo: **strato rimescolato isotermo fino a 21 m** (10,50 °C, la temperatura climatologica a quella
  quota: la velocita' sale per la sola pressione da 1 491,86 a 1 492,20 m/s), poi la climatologia
  interpolata con un polinomio cubico monotono (PCHIP) ogni 5 m (i livelli standard lineari a tratti
  hanno spigoli nel gradiente che i raggi vedono come caustiche finte). **Dentro il fronte** (classi
  fino a 110 m) la marea rimescola la colonna da cima a fondo tutto l'anno ([LHS09]: omogenea dentro i
  100 m, fronte fra 100 e 150 m di fondale): profilo isotermo alle medie della colonna, che piega
  dolcemente i raggi verso la superficie. Fra 110 e 190 m la lettura interpola: e' il fronte.
- **Fondi** ([JKPS11] tab. 1.3, scelta per classe da [MASSON03] dove c'e' un rilievo): ghiaia 1 800 m/s,
  densita' 2,0, 0,6 dB/λ (angolo critico 34°); sabbia 1 650, 1,9, 0,8 (25°); limo 1 575, 1,7, 1,0 (19°).
  La ghiaia sulla scarpata superiore (sabbie mobili su un substrato di ghiaia sotto i 500 m) e nel
  canale (ghiaia solcata fra 750 e 1200 m ai piedi della piattaforma delle Fær Øer), le sabbie fangose
  sulla scarpata inferiore, sono di [MASSON03]; sabbia sulla piattaforma e ghiaia sotto costa sono
  nozionali (nessun rilievo aperto letto per la piattaforma interna).
- **Superficie**: mare forza 3 dello scenario (6,5 m/s): H1/3 = 1,04 m, σ = 0,26 m ([PM64]); perdita
  dei raggi radenti 4,3 dB a 2 kHz, 1,7 a 300 Hz, 15 a 25 kHz. Le tabelle valgono per questo stato
  del mare.
- **Bande** (8): `sfera` e `towed`, le ottave dei sensori a banda larga di `acustica.json` (2 kHz e
  300 Hz); `f50`, `f100`, `f300`, `f1000` per le righe tonali, `f3500` per l'attivo BQQ-5 e
  l'intercettazione, `f25000` per le teste dei siluri e il sonar ad alta frequenza di F3, ciascuna
  ±10 % intorno al centro (la media sulla banda smussa le frange dello specchio di Lloyd). A una
  frequenza qualsiasi si interpola fra le strette nel logaritmo della frequenza e si rimette
  l'assorbimento esatto.
- **Quote** (16 + il fondo): 2, 5, 10, 15, 20, 25, 32, 45, 65, 90, 125, 175, 250, 350, 500, 700 m e
  fondale − 1; fitte intorno alle eliche delle navi (5-6 m), alla sfera a quota periscopica (13 m) e
  allo strato (21 m). **Distanze**: 382, in progressione geometrica da 25 m con passo del 2,5 % (1 km
  di passo a 40 km), fino a 307 km.

**Come un percorso sceglie le tabelle.** Lungo il segmento sorgente-ricevitore si legge un punto del
fondale ogni 2 km, al piu' 15, piu' i due estremi (pesati la meta': regola del trapezio); ogni punto da'
il suo peso alle due
classi che lo comprendono (interpolando nel logaritmo della profondita'), e la TL e' la media delle TL
delle classi con quei pesi, cioe' con la frazione di percorso che il suono fa in ciascuna. E' esatta
per la parte di perdita che cresce coi chilometri (rimbalzi, assorbimento) e approssimata per la
divergenza; e' simmetrica (reciprocita'), costa sempre uguale e non sceglie un estremo a caso (la
scelta «la regione dell'estremo piu' basso» sbaglierebbe per un battello nel canale che ascolta una
nave sulla piattaforma a 20 km: conta quanta strada si fa sulla piattaforma). In ogni classe le quote
si limitano al suo fondale. Se un punto interno cade sulla terra il percorso passa sopra un'isola: +40
dB nozionali (l'ombra; in F1 la terra non faceva ombra). Fuori dalla griglia vale la classe piu'
profonda.

### G.3 Le tabelle

`shared/data/scenari/torpex_palestra.tl.bin`: **1 906 976 byte** (1,8 MiB), SHA-256
`501d093c90e44661324c9c67e765fe5a02dd5773ebb256be83ecb45215641427`. Un byte per valore:
TL − 20·log r − α·r a passi di 0,5 dB (da −50 a +77,5 dB sulla divergenza sferica, oltre il percorso e'
comunque muto); l'assorbimento resta fuori e la lettura lo rimette esatto, cosi' le alte frequenze non
saturano e la lettura per frequenza interpola solo la parte geometrica. Intestazione di 32 byte e
blocchi (classe, banda, coppia di quote i ≤ j, distanza): il formato e' in testa a `tabelle.py`, e il
server lo controlla (intestazione, dimensione, SHA-256) prima di usarlo. Sette classi, otto bande, 693
coppie di quote in tutto, 382 distanze. Calcolo: circa 3 minuti su 6 processi (10 minuti di CPU), meno di
300 MB per processo; **deterministico** (ricalcolo con lo stesso SHA-256: `--controlla`).

### G.4 Convalida

`python3 -m unittest discover -s tools/acustica -p 'test_*.py'`: 15 prove (una, la rigenerazione
completa, solo con `TERMOCLINO_RIGENERA=1`). I numeri (`relazione.py`):

| Caso | Soluzione di riferimento | Risultato |
|------|--------------------------|-----------|
| Divergenza sferica, acqua illimitata isovelocita', 10 m-3 km, tre quote | 20·log R (e α·R sul cammino) | scarto massimo 0,49 dB, quadratico medio 0,06 dB; assorbimento entro 0,1 dB |
| Specchio di Lloyd, coerente (150 Hz, 25 → 100 m, 50 m-5 km) | forma chiusa e^(ikR₁)/R₁ − e^(ikR₂)/R₂ | \|p − esatta\|·R₁ < 5·10⁻⁸ anche negli zeri; TL entro 2·10⁻⁷ dB |
| Specchio di Lloyd, semicoerente, campo lontano (dipolo, 40·log r), tre geometrie | forma chiusa mediata sulla banda | scarto massimo 0,58 dB (la somma incoerente sbaglierebbe di 15-45 dB) |
| Guida di Pekeris (H 100 m, 1500/1800 m/s, densita' 1,8; sorgente a 30 m, ricevitori a 10, 50, 90 m; 100 e 500 Hz; fondo senza perdite e con 0,5 dB/λ), 1-30 km | somma incoerente dei modi normali (radici esatte dell'equazione caratteristica, Newton complesso con le perdite; 7 e 37 modi) | quadratico medio 0,20-1,02 dB, massimo 1,74 dB (100 Hz, ricevitore a 90 m, vicino al fondo) |
| Profilo canonico di Munk (sorgente 1000 m, ricevitore 100 m, 50 Hz, fondo assorbente) | prima zona di convergenza intorno ai 60 km ([JKPS11], [SM194]) | prima zona 51,5-74 km (due caustiche, minimo a 69 km), seconda 110-139 km, ombra fra 20 e 50 km; ciclo del raggio radente in superficie 65,3 km |
| Canale superficiale di 100 m (gradiente di pressione) su termoclina, 25 kHz | conservazione dell'energia del cono intrappolato, 2·sin θ_max/r | entro 0,09 dB da 10 a 80 km; 3,0 dB per raddoppio della distanza (10·log r); sotto il canale nessuna energia |
| Canale sottile di 20 m, sorgente e ricevitore a 10 m, 10-20 km | teoria dei modi (taglio intorno a 1-2 kHz) | 25 kHz intrappolato (69 dB, cilindrica); 300 Hz non intrappolato (con la correzione WKB nessuna energia resta nel canale; senza, la teoria dei raggi lo darebbe a 71-74 dB come un'alta frequenza) |
| Reciprocita' del campo incoerente (13 ↔ 150 m su piattaforma stratificata) | TL(a→b) = TL(b→a) | entro 1,5 dB |
| Formule uguali a `shared/ambiente.js` | velocita' del suono e assorbimento dello scenario | entro 0,006 m/s e 10⁻⁴ relativo |

I casi con soluzione esatta stanno entro 1-2 dB (il bersaglio di F2_ASCOLTARE §3); la prima zona di
convergenza di Munk e' dove la mette la letteratura. Bellhop non e' stato usato (niente binari
scaricati): il riferimento sono le soluzioni esatte qui sopra.

### G.5 Lettura in linea

`propagazione.js`: `perdita(sorgente, ricevitore, banda)` con l'id di una banda o una frequenza in Hz,
e `percorso(s, r)` per leggere piu' bande dallo stesso percorso (lo usa `percorsoPerdita` di H). Costo
costante: al piu' 17 letture di una griglia di classi precalcolata (un byte per nodo, 160 KB, il nodo
piu' vicino), poi per ogni classe attraversata (tre in media entro 60 km) 8 letture di byte (bilineare
nelle quote, lineare nel logaritmo della distanza), un logaritmo per percorso. Misura su questa macchina
(Intel i7-4770TE del 2013, 2,3 GHz, con altri processi: carico 11-20 su 8 thread; un minuto di misure,
`server/test/propagazione.test.js` ne fa una piu' breve): coppie da partita (200 coppie entro 60 km,
rilette) **mediana 0,81 µs, minimo 0,59 µs** per una banda delle tabelle, 1,16 µs a una frequenza
qualsiasi (due bande interpolate); caso peggiore (coppie a caso fino a 280 km, molte classi, cache
fredda) mediana 1,08 µs. A macchina scarica si sta sotto il microsecondo. Senza tabelle (scenario che non le
ha, file rotto) l'ambiente resta senza `propagazione` e `perdita.js` usa l'analitico di F1; la stessa
riserva sta dietro la stessa interfaccia in `propagazioneAnalitica(ac, amb)`.

`server/test/propagazione.test.js` (10 prove): file e scenario (SHA-256, dimensione, bande uguali ad
`acustica.json`, file rotto rifiutato); la TL cresce con la distanza in ogni classe, banda e coppia di
quote, e non scende mai sotto la divergenza cilindrica dal fondale; vicino alla sorgente in acqua
profonda e' la sferica e coincide con l'analitico di F1 (entro 1,5 dB); lo strato conta nell'acqua
stratificata, di piu' alle alte frequenze, quasi niente nel canale; la piattaforma perde piu' del
canale sulla batimetria vera (7 dB a 2 kHz su 20 km, 10 dB a 3,5 kHz; a 50 Hz quasi nulla); la terra fa
ombra (un percorso sopra Suðuroy); reciprocita' e determinismo esatti; lettura a frequenza; i sensori
passano dalle tabelle quando ci sono e dall'analitico quando no; le portate di PROGETTO §5.12 con le
tabelle; il costo.

### G.6 Le perdite nozionali, e come sono tarate

Con il solo modello fisico liscio (semispazio fluido, superficie di Eckart) le portate uscivano molto
piu' lunghe di F1: due 688 lenti a 9-12 kyd sulla piattaforma, un cacciatorpediniere a 10 kt a 30 miglia,
un 688 che cavita a 60 miglia. Il semispazio fluido sotto l'angolo critico perde 0,1-0,7 dB per
rimbalzo su sabbia e ghiaia (contro i 2-30 dB che riporta [FUN-8]), e la superficie di Eckart a radenze
di pochi gradi quasi nulla; mancano la rugosita' del fondo (ghiaia, increspature e dune di [MASSON03]),
la stratificazione dei sedimenti, la diffusione di volume e le pendenze del fondale vero, le bolle e la
diffusione della superficie. Due termini, documentati nel blocco dello scenario:

- **Superficie**: la perdita dei raggi radenti di Schulkin, 1,64·√(f·H) dB per rimbalzo (formula
  empirica dei canali superficiali, [SCH68], non riverificata; `stimato`), 4,3 dB a 2 kHz con il mare
  forza 3. Senza, nell'acqua rimescolata della piattaforma interna (che piega i raggi verso la
  superficie e li tiene lontani dal fondo) un cacciatorpediniere si sentirebbe a 50 miglia.
- **Fondo**: 4 dB per rimbalzo a 2 kHz in piu' del semispazio, uguali a ogni radenza, scalati con la
  radice della frequenza (1,5 dB a 300 Hz, 0,6 a 50 Hz, 14 a 25 kHz): `nozionale`, nel campo di [FUN-8].
  Tarata perche' due 688 lenti sulla piattaforma si sentano a poche migliaia di iarde (PROGETTO §5.12).
  La sensibilita' e' bassa (da 2 a 5 dB la portata dei 688 lenti cambia di meno di una kyd: a qualche
  km l'energia e' dei raggi radenti, che toccano il fondo di rado); conta per i bersagli forti e lontani.

Nessun altro parametro e' stato toccato: livelli di sorgente, rumore e soglie restano quelli di F1.

### G.7 Le portate di F1 rifatte con le tabelle

Stessi casi, stesso codice dei fotogrammi di `CALIBRAZIONE_F1.md` §3 (kyd); l'ambiente e' l'estate di
TORPEX con la TL dalle tabelle su un fondale piatto della profondita' indicata (fra due classi si
interpola, come in partita). La palestra parte a 180-220 m: la colonna «190 m». Nella colonna
«110 m» (acqua rimescolata, niente strato) i battelli «a 150 m» stanno sul fondo, a 109 m.

| Caso | Sensore | F1, 200 m | F1, 1000 m | 110 m (rimescolata) | 190 m (palestra) | 350 m | 900 m (canale) |
|------|---------|----:|----:|----:|----:|----:|----:|
| 688 a 5 kt, entrambi a 150 m | sfera | 5,0 | 4,2 | 2,7 | 5,6 | 4,8 | 4,8 |
| 688 a 5 kt a quota periscopica, ascolto a 150 m (strato in mezzo) | sfera | 1,8 | 1,4 | 4,3 | 3,2 | 3,2 | 3,0 |
| 688 a 10 kt (150 m) | sfera | 7,3 | 7,8 | 10,1 | 9,2 | 6,4 | 6,3 |
| 688 a 15 kt (150 m) | sfera | 8,7 | 10,2 | 11,1 | 13,2 | 12,1 | 9,5 |
| 688 a 20 kt (150 m, cavita) | sfera | 17,6 | 27,1 | 22,1 | 34,7 | 57,0 | 60,1 |
| 688 a 10 kt a quota periscopica (cavita), ascolto a quota periscopica | sfera | 14,9 | 21,8 | 24,7 | 16,7 | 19,0 | 22,6 |
| 688 a 5 kt, chi ascolta va a 15 kt | sfera | 4,6 | 3,6 | 2,2 | 4,8 | 4,6 | 3,5 |
| 688 a 5 kt, chi ascolta va a 25 kt | sfera | 0,5 | 0,4 | 0,4 | 0,4 | 0,4 | 0,4 |
| Alfa a 10 kt (150 m) | sfera | 12,7 | 17,6 | 21,0 | 21,6 | 34,4 | 31,0 |
| Alfa a 40 kt (300 m, cavita) | sfera | 38,3 | 68,7 | 82,0 | 88,7 | 159,7 | 188,2 |
| cacciatorpediniere a 10 kt, ascolto a quota periscopica (stesso lato) | sfera | 13,1 | 18,4 | 20,7 | 13,4 | 14,5 | 21,0 |
| cacciatorpediniere a 10 kt, ascolto a 150 m (sotto lo strato) | sfera | 7,5 | 8,1 | 15,9 | 11,5 | 14,4 | 16,8 |
| cacciatorpediniere a 20 kt, ascolto a quota periscopica | sfera | 19,9 | 31,6 | 39,0 | 22,9 | 29,6 | 41,7 |
| cacciatorpediniere a 20 kt, ascolto a 150 m | sfera | 13,8 | 19,7 | 26,3 | 20,2 | 26,7 | 36,9 |
| cacciatorpediniere fermo (macchinari), ascolto a quota periscopica | sfera | 3,0 | 1,8 | 2,4 | 1,6 | 1,5 | 1,3 |
| mercantile a 12 kt, ascolto a quota periscopica | sfera | 22,1 | 36,1 | 45,9 | 28,2 | 38,0 | 43,5 |
| mercantile a 12 kt, ascolto a 150 m | sfera | 16,0 | 23,9 | 35,9 | 23,6 | 31,3 | 41,1 |
| sorgente biologica attiva (30 m), ascolto a 150 m | sfera | 8,1 | 9,1 | 6,2 | 4,8 | 8,1 | 6,0 |
| 688 a 5 kt (150 m) — antenna, battello a 150 m | towed | 3,9 | 2,7 | 3,9 | 5,9 | 4,2 | 3,6 |
| 688 a 15 kt (150 m) — antenna | towed | 7,6 | 8,3 | 12,2 | 14,4 | 13,6 | 11,7 |
| Alfa a 10 kt (150 m) — antenna | towed | 11,7 | 16,2 | 30,6 | 36,0 | 43,1 | 36,9 |
| 688 a 5 kt (150 m) — antenna a 10 kt | towed | 2,5 | 1,3 | 2,3 | 2,3 | 2,3 | 1,7 |
| 688 a 5 kt (150 m) — antenna, battello a quota periscopica (antenna sotto lo strato) | towed | 3,9 | 2,7 | 4,0 | 4,8 | 4,6 | 4,3 |
| cacciatorpediniere a 10 kt — antenna, battello a quota periscopica | towed | 6,3 | 6,2 | 15,8 | 13,3 | 19,3 | 27,8 |
| mercantile a 12 kt — antenna, battello a 150 m | towed | 15,1 | 23,2 | 73,6 | 32,4 | 49,4 | 75,8 |

**Bande di F1** (`CALIBRAZIONE_F1.md` §4) con le tabelle, sulle colonne 190, 350 e 900 m:

| Richiesta | Banda | Con le tabelle | |
|-----------|-------|----------------|---|
| due 688 lenti a poche migliaia di iarde (PROGETTO §5.12) | 2,5-7 kyd (F1); 3-10 (§5.12) | 4,8-5,6 kyd | sì |
| chi accelera si fa sentire prima; chi cavita da molto lontano | ×1,6 a 15 kt; ×1,8 cavitando | ×2,0-2,5; ×2,6-6,3 | sì |
| per ascoltare si rallenta; a 25 kt si e' sordi | meno di un quarto | ×0,07-0,08 | sì |
| l'Alfa rumoroso a 10 kt, sentito da lontanissimo a tutta forza | ×1,6 il 688; oltre 15 nm | ×2,3-5,4; 44-93 nm | sì |
| un cacciatorpediniere a 10 kt: varie miglia | 5-15 nm | 6,6-10,4 nm | sì |
| i biologici: qualche miglio | 0,5-7 nm | 2,4-4,0 nm | sì |
| l'antenna: utile a velocita' basse, sorda oltre i 12 kt | 1,5-7 kyd; peggio a 10 kt | 3,6-5,9; 1,7-2,3 kyd | sì |
| **se uno scende sotto lo strato, l'altro lo perde** | meno di metà | **×0,57-0,67** | **no** |
| **un cacciatorpediniere attraverso lo strato** | meno del 60 % | **×0,80-1,00** | **no** |

**Lo strato, in fisica, nasconde poco.** Il cambiamento piu' grande rispetto a F1 non e' nelle portate
(simili per i battelli lenti, piu' lunghe per i bersagli forti, dove la perdita di 2 dB/km di F1 era
molto dura) ma nello strato. Lo strato estivo delle Fær Øer e' di 21 m: troppo sottile per intrappolare
le frequenze dei sonar (il primo modo esiste solo sopra 1,3-2,5 kHz ed esce per effetto tunnel), e sotto
di lui, su fondali di 190-900 m con ghiaia e sabbia, il rimbalzo sul fondo riempie la zona d'ombra a
pochi km. Resta una protezione vera ma modesta (un 688 a quota periscopica si sente al 57-67 % della
portata, non al 33-36 % della regola nozionale di F1, 13,5 dB), quasi nessuna contro un
cacciatorpediniere, e nessuna nell'acqua rimescolata della piattaforma interna, dove lo strato non c'e'.
E' la ragione per cui in acque basse lo strato «conta meno»; e' anche diverso dalla prova di F1
(PROGETTO §11.2 (13)), che non e' una banda di §5.12: **non e' stato tarato**. Per ridare le bande di
F1 c'e' una regola di gioco facoltativa, `propagazione.percorso.perdita_strato` (dB in piu' per i
percorsi con sorgente e ricevitore da parti opposte dello strato, per la frazione di percorso in acqua
stratificata, raccordata da 500 a 2000 m come in F1): **0 nello scenario** (sola fisica); con **8 dB**
le bande dello strato di F1 tornano tutte (688: ×0,34-0,40; cacciatorpediniere: ×0,42-0,60). Si cambia
in `tools/acustica/tabelle.py` (`PERDITA_STRATO`) e `--solo-blocco`, senza ricalcolare le tabelle. La
scelta e' di progetto.

Altro da notare: le **righe basse dell'antenna** vanno piu' lontano della sfera (meno perdite al fondo e
in superficie alle basse frequenze: il vantaggio vero dell'antenna, che H misura in H.2); i bersagli
forti si sentono piu' lontano che in F1 (un mercantile a 12 kt a 14-22 miglia, un 688 che cavita a
20 kt a 17-30 miglia, un Alfa a 40 kt a 44-93 miglia); nel canale profondo i battelli lenti si sentono
come sulla piattaforma (4,8 kyd), quelli forti piu' lontano.

### G.8 Cosa manca

- **Ambiente indipendente dalla distanza per classe**: la media lungo il percorso non fa l'accoppiamento
  dei modi sulle pendenze (il suono che sale dal canale sulla piattaforma perde di piu', quello che
  scende di meno: l'effetto megafono); un'isola piu' stretta della distanza fra due campioni (fino a
  17 km sui percorsi di 280 km, 4 km su quelli di 60 km) puo' sfuggire; la riva non riflette.
- **Uno stato del mare e una stagione**: le tabelle valgono per il mare forza 3 e l'estate dello
  scenario; cambiare lo stato del mare in partita cambia il rumore ma non la TL.
- **Lo strato uguale ovunque fuori dal fronte**; il fronte e' la sola variazione orizzontale
  dell'oceanografia (fra 110 e 190 m).
- **L'energia che esce dai canali per effetto tunnel si perde** invece di proseguire sotto (nella
  palestra quasi tutta finirebbe sul fondo).
- **Le bande strette hanno i lobi dello specchio di Lloyd** delle sorgenti vicine alla superficie: una
  riga a 100 Hz di un battello a quota periscopica puo' sentirsi meglio a 4 km che a 2 km. E' fisica
  (nessuna media su una banda per una riga pura), ma va tenuto presente leggendo le portate delle righe.
- Le perdite nozionali al fondo e la regola dello strato sono parametri di taratura: se cambiano
  livelli o soglie di H, vanno rivisti insieme.


## Sensori (filone H)

Codice: `server/src/sim/sensors/` — `bandastretta.js` (righe, LOFAR, DEMON, fotogrammi a banda
stretta), `attivo.js` (ping, eco, riverberazione, intercettazione), `transitori.js`, `ottica.js`
(periscopio), `radio.js` (ESM, radar), `mondo.js` (tutto cio' insieme nella partita),
`taratura_f2.js` (le portate). Dati: `shared/data/firme/*.json` (navi, mercantile, biologici), i
blocchi di F2 di `shared/data/piattaforme/*.json` (SCHEMA §4.2), le sezioni nuove di
`shared/data/acustica.json` e `shared/data/sensori.json` (SCHEMA §8-9). Le tabelle si rifanno con

```bash
node server/strumenti/taratura_f2.js --tabelle --fondale 190   # la palestra: tabelle di G, piattaforma delle Fær Øer
node server/strumenti/taratura_f2.js --fondale 200             # analitico di F1 (la riserva), stessa piattaforma
node server/strumenti/taratura_f2.js --fondale 1000            # analitico, acqua profonda
```

e le prove `server/test/sensori_f2.test.js` controllano che i risultati restino dentro le bande
dell'ultima sezione. Come in F1 una **portata** e' la distanza a cui l'eccesso di segnale medio
(senza fluttuazione) scende a 0 dB, cioe' la probabilita' di scoperta del 50 %; la fluttuazione di
σ = 6 dB fa sentire un contatto ogni tanto piu' lontano e perdere ogni tanto piu' vicino. Ambiente:
l'estate di TORPEX (strato a 21 m con 13,5 dB, mare forza 3, traffico 0,4). Chi ascolta e' un 688 a
5 kt; il bersaglio sta al traverso con la prua parallela (aspetto neutro, niente Doppler).

### H.1 Le equazioni

**Righe tonali** (`bandastretta.js`). Ogni piattaforma ha righe a frequenza fissa (rete elettrica,
pompe, turbine), righe che seguono i giri (ingranamento dei riduttori, accensioni dei diesel:
frequenza = `per_giro`·giri/60) e righe di pala e d'asse (frequenza di pala = pale·giri/60,
[ITTC-02], con le armoniche). Il livello di una riga (dB re 1 µPa² nella cella, alla sorgente) e'
dato sopra lo spettro a banda larga della sorgente alla stessa frequenza; per le righe fisse e'
riferito alla velocita' di riferimento (5 kt i sottomarini, 10 kt le navi), quindi e' fisso e a
velocita' alte la banda larga lo puo' coprire. Lo spettro a banda larga e' quello di Ross
(−20·log f) sopra i 100 Hz e piatto sotto (`banda_stretta.ginocchio_spettro`); alle bande di F1
non cambia niente.

```
SE_riga = L − TL(f) − NL(f) + DI(f) + R(f) − 5·log10(d·B/t) − degrado + x
```

con B la cella (1 Hz l'antenna, 2 Hz la sfera), t = 60 s d'integrazione (04 §4.6.4: 1-3 minuti per
la banda stretta), NL(f) = mare (Coates) ⊕ rumore proprio alla frequenza (sfera: macchinario, piatto
sotto i 100 Hz; antenna: flusso con −20 dB/decade), DI e fascio dalla geometria (sfera
20·log f, antenna lineare 10·log f: a 60 Hz l'antenna ha 7,7 dB e un fascio di 17°, la sfera
nessuna direttivita'), R(f) la risposta fuori banda (−40 dB/decade sotto i 30 Hz dell'antenna e i
500 Hz della sfera). La frequenza osservata ha lo spostamento Doppler della velocita' radiale.

- **Fotogramma a banda stretta** (messaggio `sonar` con `banda: 'stretta'`, ogni 4 s): in ogni
  settore la riga piu' forte di ogni sorgente, stesa col fascio alla sua frequenza e col suo errore
  di rilevamento (R1 con il fascio di quella frequenza). E' cio' su cui l'equipaggio scopre i
  contatti dalle righe.
- **LOFAR** (`spettro.righe`): per il fascio puntato, le righe di ogni sorgente pesate dal fascio
  alla loro frequenza, piu' il fondo a banda larga di ogni sorgente cella per cella; il fondo
  normalizzato (−10 dB, esponenziale) come nei fotogrammi.
- **DEMON** (`spettro.demon`, modello nozionale di `acustica.json`, `demon`): con s il rapporto
  segnale/rumore della sorgente nella banda a banda larga del sensore, S la somma di quelli di tutte
  le sorgenti nel fascio, m l'indice di modulazione (alla frequenza d'asse, di pala, delle armoniche),
  r = (m²/2)·(s/(1+S))²·(B_banda/b) nella cella b = 0,1 Hz e SE = 10·log r − 5·log(d/(b·t)). Il DEMON
  chiede un contatto gia' forte a banda larga; l'elica che cavita (navi di superficie quasi sempre,
  sottomarini sopra la velocita' d'innesco) ha m dieci volte piu' grande.

**Sonar attivo e intercettazione** (`attivo.js`):

```
E   = SL + G_tx(ψ) − 2·TL(f, r) + TS(aspetto)                       eco, dB re 1 µPa²
N   = NL(f) + 10·log(1/τ) − DI_rx(f)                                 rumore nella banda dell'impulso
RL  = SL + G_tx − 2·TL + 10·log(Σ S·A·G_v²) − G_Doppler             riverberazione alla stessa distanza
SE  = E − (N ⊕ RL) − 5·log(d)                                       impulso adattato (B·τ = 1)
SE_intercetto = SL + G_tx(ψ') − TL(f, r') − (NL(f) + 10·log B_c − DI_i) − 5·log(d/(B_c·τ))
```

La riverberazione somma superficie (Chapman-Harris, [ZHANG04], col vento dello stato del mare),
fondo (Lambert, μ = −27 dB, [OIK07]) e volume (S_v = −80 dB re 1 m⁻¹) sulla cella c·τ/2 sotto il
fascio di ricezione; superficie e fondo sono pesati dal fascio verticale (7,2°, andata e ritorno),
cosi' da vicino stanno fuori dal fascio. Il guadagno Doppler (fino a 20 dB) separa l'eco di un
bersaglio con moto radiale dallo spettro della riverberazione: e' cio' che rende utile l'impulso
lungo. Il ping del 688 (BQS-13 a 3,5 kHz) e' di 228 dB nel fascio di 6°, 218 su tutto il settore di
±60°; quello dell'Alfa di 222 dB a 3 kHz con un fascio di 10°. Gli intercettatori (WLR-9, «Enisej»)
hanno canali di 100 Hz e nessuna direttivita'.

**Transitori** (`transitori.js`): `SE = L(f_banda) − TL − NL + DI − 5·log(d/(B·max(τ, 0,5 s))) −
degrado + x`, con i termini della banda larga di ciascun sensore: un transitorio breve paga una
soglia piu' alta della banda larga (−8 dB invece di −13,5 sulla sfera) ma e' molto piu' forte.

**Ottica** (`ottica.js`): orizzonte ottico d = 3,86·√h km ([WP-ORIZZONTE]); una nave si vede se la
testa d'albero sta sopra l'orizzonte dell'occhio (2 m a quota periscopica) e dentro la visibilita'
(10 miglia di giorno, 2 di notte per la sagoma; luci della regola 22 a 6 e 3 miglia, [COLREG-22]),
ridotta del 20 % per ogni grado di mare oltre il 3. L'angolo d'albero misurato e'
atan((H − h)/R) + atan(h/R) con un errore relativo σ = 3,5 %, e lo stadimetro R = H/tan α ([NSL10]),
con l'altezza d'albero della classe giusta, sbaglia solo di quell'errore. Lo stadimetro serve finche'
la linea d'acqua e' sopra l'orizzonte (5,5 km per un occhio a 2 m).

**ESM e radar** (`radio.js`): P_r = P_t + G_t − 20·log(4π·d/λ) − L_diffr − perdite, con la
diffrazione sulla terra sferica liscia di ITU-R P.526 ([ITU-P526]) oltre l'orizzonte radio (raggio
equivalente 8 500 km), misurata dal suo valore all'orizzonte perche' la curva sia continua
(semplificazione dichiarata); livello = P_r − sensibilita' (−70 dBm il WLR-8, −65 il ricevitore
dell'Alfa). Il radar proprio vede una nave (40 dBsm) fino alla sua portata di riferimento
(20 km per 30 dBsm, scala con la radice quarta della sezione) e non oltre l'orizzonte radio; un
albero alzato (0 dBsm, +6 col pennacchio) a pochi chilometri.

### H.2 Banda stretta contro banda larga

Palestra (tabelle di propagazione del filone G, fondale piatto di 190 m):

| Caso | Antenna, righe: kyd | nm | riga (Hz) | Sfera, banda larga: kyd | Antenna, banda larga: kyd | Antenna righe / sfera |
|------|----:|----:|----:|----:|----:|----:|
| cacciatorpediniere a 10 kt, ascolto a 150 m | 18,8 | 9,3 | 60 | 11,5 | 13,0 | 1,63 |
| cacciatorpediniere a 10 kt, battello a quota periscopica | 20,2 | 10,0 | 60 | 13,4 | 13,3 | 1,51 |
| cacciatorpediniere fermo (macchinari), ascolto a 150 m | 18,8 | 9,3 | 60 | 2,0 | 1,7 | 9,47 |
| mercantile a 12 kt, ascolto a 150 m | 29,9 | 14,8 | 60 | 23,6 | 32,4 | 1,27 |
| 688 a 5 kt (150 m), ascolto a 150 m | 4,8 | 2,4 | 74 | 5,6 | 5,9 | 0,85 |
| 688 a 20 kt (150 m, pompe in alta velocita'), ascolto a 150 m | 21,8 | 10,7 | 336 | 34,7 | 41,6 | 0,63 |
| Alfa a 5 kt (150 m), ascolto a 150 m | 28,5 | 14,1 | 400 | 14,6 | 21,4 | 1,95 |
| Alfa a 10 kt (150 m), ascolto a 150 m | 36,5 | 18,0 | 200 | 21,6 | 36,0 | 1,69 |
| balena che canta (30 m), ascolto a 150 m | 53,2 | 26,3 | 300 | 4,8 | 3,2 | 11,05 |

Riserva analitica di F1, fondale 200 m e 1000 m (righe dell'antenna / sfera a banda larga, kyd):

| Caso | 200 m: righe | 200 m: sfera | 1000 m: righe | 1000 m: sfera |
|------|----:|----:|----:|----:|
| cacciatorpediniere a 10 kt, ascolto a 150 m | 11,5 | 7,5 | 15,7 | 8,1 |
| cacciatorpediniere a 10 kt, battello a quota periscopica | 11,5 | 13,1 | 15,7 | 18,4 |
| mercantile a 12 kt, ascolto a 150 m | 15,2 | 16,0 | 23,3 | 23,9 |
| 688 a 5 kt (150 m) | 3,6 | 5,0 | 2,3 | 4,2 |
| 688 a 20 kt (150 m) | 9,6 | 17,6 | 12,0 | 27,1 |
| Alfa a 5 kt (150 m) | 11,0 | 10,1 | 14,8 | 12,8 |
| Alfa a 10 kt (150 m) | 11,1 | 12,7 | 15,0 | 17,6 |
| balena che canta | 20,8 | 8,1 | 35,1 | 9,1 |

Lettura:

- **Il cacciatorpediniere si scopre prima sull'antenna dalle righe** (la rete a 60 Hz dei
  turbogeneratori) che sulla sfera a banda larga: 9-10 miglia contro 6-7 con le tabelle, a qualunque
  quota del battello. Con la riserva analitica vale solo per il battello sotto lo strato: l'analitico
  fa pagare i 13,5 dB dello strato anche a 60 Hz, mentre le tabelle (che lo trattano per frequenza)
  lasciano passare le basse frequenze sotto uno strato di soli 21 m, come fa la fisica (un canale
  superficiale di 21 m non intrappola niente sotto il kHz). Fermo, il cacciatorpediniere si sente
  ancora alla stessa distanza: le righe dei macchinari non dipendono dalla velocita'.
- **Due 688 lenti restano un affare da poche migliaia di iarde** anche in banda stretta (2-5 kyd):
  le righe del 688 sono deboli (6 dB sopra la banda larga la rete, 5 le pompe, 0 il riduttore). A
  20 kt le pompe passano in alta velocita' (148 Hz, il cambio di regime) ma la banda larga sale
  piu' delle righe e domina.
- **L'Alfa si fa sentire dalle righe** (la rete a 400 Hz, il primo battello sovietico con la rete a
  frequenza elevata, [DS-705]): a 5 kt l'antenna lo sente quasi al doppio della sfera.
- **I biologici in banda stretta**: una balena che canta e' una riga forte che salta (151 dB, il
  minimo misurato per la megattera [AU06]): l'antenna la sente da molte miglia. E' il rumore biologico
  vero, e il LOFAR (righe che cambiano frequenza ogni pochi secondi) e' il modo di riconoscerlo.

### H.3 Sonar attivo e controscoperta

Palestra (tabelle, 190 m). Chi pinga e il bersaglio a 150 m, il bersaglio a prua; «senza moto
radiale» e' il caso peggiore per l'eco (nessun guadagno Doppler sulla riverberazione).

| Chi pinga | Bersaglio (ascolta con il suo intercettatore) | Ping | Eco, senza moto radiale: kyd | Eco, avvicinamento 10 kt: kyd | Intercettazione: kyd | nm | Intercettazione / eco |
|-----------|-----------|------|----:|----:|----:|----:|----:|
| 688 | 688 a 150 m | corta, fascio | 25,2 | 26,2 | 75,9 | 37,5 | 2,9 |
| 688 | 688 a 150 m | lunga, fascio | 18,6 | 30,2 | 81,1 | 40,0 | 2,7 |
| 688 | 688 a 150 m | lunga, settore | 18,4 | 26,2 | 70,5 | 34,8 | 2,7 |
| alfa | 688 a 150 m | corta, fascio | 21,5 | 21,6 | 73,4 | 36,3 | 3,4 |
| alfa | 688 a 150 m | lunga, fascio | 11,1 | 26,6 | 79,7 | 39,3 | 3,0 |
| 688 | cacciatorpediniere | corta, fascio | 8,1 | 13,6 | — | — | — |

Riserva analitica (eco senza moto radiale / intercettazione, kyd): 688 su 688, corta: 16,4 / 40,4
a 200 m, 22,2 / 70,2 a 1000 m; lunga: 16,3 / 42,7 a 200 m, 5,6 (27,7 con 10 kt d'avvicinamento) /
74,8 a 1000 m. Sul cacciatorpediniere (che sta sopra lo strato) l'eco paga lo strato due volte.

Lettura: **l'intercettatore sente il ping da due volte e mezzo a tre volte e mezzo la distanza a
cui torna l'eco** (04 §4.6.3: 1,5-2,5 volte; [WP-SONAR]: «many times farther than twice the range»),
e lo sente prima (un percorso solo). In acque basse l'impulso corto rende quanto il lungo contro un
bersaglio che non si avvicina (la riverberazione cresce con la durata dell'impulso), il lungo rende
di piu' contro chi si muove (Doppler) e al largo (rumore). Il ping puntato rende di piu' e si fa
sentire meno fuori dal fascio (lobi a −20 dB, −30 dietro).

### H.4 Transitori

| Transitorio (sfera a 150 m, 5 kt) | 200 m analitico: kyd | tabelle 190 m: kyd | il battello a 5 kt, banda larga: kyd |
|------|----:|----:|----:|
| 688, scafo (112 dB a 1 kHz, 0,3 s) | 9,3 | 13,7 | 5,0 / 5,6 |
| 688, idraulica degli alberi (104 dB, 4 s) | 7,9 | 12,0 | 5,0 / 5,6 |
| 688, pompa d'assetto (104 dB, 8 s) | 8,5 | 12,6 | 5,0 / 5,6 |
| 688, portello (116 dB, 1,5 s; da F3) | 12,0 | 20,2 | 5,0 / 5,6 |
| Alfa, scafo (115 dB) | 10,5 | 14,9 | 10,1 / 14,6 |

Un transitorio fa sentire un battello silenzioso a circa **due volte** la sua portata a banda larga:
e' il «spesso su un transitorio» di PROGETTO §5.12. Lo scafo scricchiola ogni 15 m di cambio di quota
con probabilita' 0,5 (doppia oltre 1 m/s): scendere in fretta si paga. Il sonarista riconosce il
tipo sopra i 6 dB, altrimenti «sconosciuto». Tutti i livelli sono nozionali (equivalenti a 1 kHz).

### H.5 Periscopio e stadimetro

| Nave | Luce, mare | Sagoma: nm | Luci: nm | Stadimetro (linea d'acqua): kyd | Testa d'albero sull'orizzonte: nm |
|------|------|----:|----:|----:|----:|
| Forrest Sherman (albero 30 m) | giorno, forza 3 | 10,0 | — | 6,0 | 14,4 |
| Forrest Sherman | giorno, forza 5 | 6,0 | — | 6,0 | 14,4 |
| Forrest Sherman | notte, forza 3 | 2,0 | 6,0 | 4,1 | 14,4 |
| mercantile (albero 25 m) | giorno, forza 3 | 10,0 | — | 6,0 | 13,4 |
| mercantile | notte, forza 3 | 2,0 | 6,0 | 4,1 | 13,4 |

Stadimetro con la classe giusta, 2 000 letture fra 1 km e la linea d'acqua: sul Forrest Sherman
**entro ±7 % il 95,0 %** (errore medio +0,13 %, σ 3,53 %), sul mercantile il 96,4 % (+0,09 %,
σ 3,47 %). Con la classe sbagliata (25 m invece di 30) l'errore e' del 17 %: classificare bene conta.
Gli alberi di un altro battello si vedono a 1,8 km di giorno (400 m di notte), a 4,5 km se corre
oltre i 10 kt col periscopio alzato (il pennacchio); il radar proprio li vede a 3,6 km (5,2 col
pennacchio). Tutti nozionali: le fonti dicono che la scia tradisce, non a che distanza.

### H.6 ESM e radar

| Radar | Banda | ESM | Portata: nm | Orizzonte radio: nm |
|-------|-------|-----|----:|----:|
| cacciatorpediniere: AN/SPS-40 | B | 688 | 53,0 | 15,4 |
| cacciatorpediniere: AN/SPS-40 | B | Alfa | 49,4 | 15,4 |
| cacciatorpediniere: AN/SPS-10 | G | 688 | 27,6 | 15,0 |
| cacciatorpediniere: AN/SPS-10 | G | Alfa | 26,1 | 15,0 |
| mercantile: navigazione | I | 688 | 20,6 | 13,3 |
| 688: AN/BPS-15 | I | Alfa | 14,5 | 7,4 |
| Alfa: MRK-50 | I | 688 | 15,1 | 7,4 |

L'ESM sente i radar dei cacciatorpediniere **oltre l'orizzonte radio e molto oltre l'orizzonte
acustico** (50 miglia l'SPS-40 in UHF, che diffrange meglio; 28 l'SPS-10; la sfera sente lo stesso
cacciatorpediniere a 7-10 miglia). Il proprio radar e' un'emissione che l'ESM dell'altro sente a
14-16 miglia, il doppio del suo orizzonte radio, mentre il radar vede l'albero dell'altro solo a pochi
chilometri: accenderlo dice dove si e' a chi ascolta.

### H.7 Scelte e compromessi

1. **Livelli delle righe: nozionali, riferiti alla banda larga di F1.** I livelli veri delle righe sono
   classificati: ogni riga e' data in dB sopra lo spettro a banda larga gia' tarato in F1, e le prove
   controllano solo l'ordine e le bande. Le frequenze documentate sono la rete a 60 Hz delle navi USN
   ([NSTM-320]) e del 688, quella a 400 Hz dell'Alfa ([DS-705]); le altre (pompe, ventilatori,
   riduttori, accensioni) sono ordini di grandezza dichiarati.
2. **Tarature fatte in F2**: la riga a 60 Hz del Forrest Sherman a +20 dB (156 dB re 1 µPa² nella
   cella, nella fascia bassa delle righe misurate sulle navi mercantili moderne) perche' l'antenna lo
   scopra prima della sfera; l'ingranamento del riduttore dell'Alfa a +3 dB (con +6 l'Alfa lento era
   un contatto da 20 miglia); il canto della balena al minimo misurato (151 dB); i transitori dei
   battelli 6 dB sotto la prima stesura (si sentivano a tre volte e mezzo la portata a banda larga).
3. **La riserva analitica e lo strato.** L'analitico di F1 fa pagare lo strato uguale a tutte le
   frequenze; le tabelle no. Con l'analitico il vantaggio dell'antenna sul cacciatorpediniere c'e'
   solo col battello sotto lo strato. In partita valgono le tabelle (lo scenario le ha).
4. **Riverberazione senza Doppler nei casi canonici.** Il caso peggiore per l'eco; il guadagno
   Doppler (tetto di 20 dB) e' nel modello e vale in partita.
5. **Il fondo del LOFAR** viene da una riserva di 65 536 campioni esponenziali preparata una volta
   (deterministica), letta da un punto a caso a ogni spettro: lo spettro lo chiedono anche
   l'equipaggio per classificare (fino a qualche volta al secondo), e mille logaritmi a sguardo
   costavano piu' di tutto il resto. Le basi delle sorgenti (righe, fondo a banda larga sulla griglia,
   rapporto segnale/rumore) si calcolano una volta per secondo di gioco e servono a tutti gli sguardi.
6. **Velocita' del suono** di 1 500 m/s per i tempi d'arrivo e le distanze degli echi: il profilo
   dello scenario sta fra 1 480 e 1 495 m/s, l'errore (0,3 %) e' dentro σ della distanza.

### H.8 Le bande, e come ci stanno

Le prove `server/test/sensori_f2.test.js` falliscono se un risultato esce da queste bande.

| Richiesta | Fonte | Banda della prova | Risultato |
|-----------|-------|-------------------|-----------|
| un Forrest Sherman si scopre prima sull'antenna dalle righe che sulla sfera a banda larga | F2_ASCOLTARE §3 | righe dell'antenna oltre 1,3 volte la sfera: analitico (200 e 1000 m, battello a 150 m) e tabelle (150 m e quota periscopica) | ×1,5-1,9 (analitico), ×1,5-1,6 (tabelle) |
| il LOFAR mostra le righe alle frequenze giuste, la frequenza di pala dai giri | F2_ASCOLTARE #3 | le righe fisse e l'ingranamento (120·giri/60) nella loro cella, 3 dB sopra le vicine; il DEMON col massimo alla frequenza di pala, pale = pala/asse | 60, 97, 120, 145, 200 Hz a 10 kt; 60 e 360 Hz a 18 kt; DEMON a 1,67 / 6,67 Hz |
| due battelli silenziosi a poche migliaia di iarde | PROGETTO §5.12, 07 §7 | 688 lento sulle righe dell'antenna: 2-7 km | 3,3 km (200 m analitico) |
| un ping dà distanza e rilevamento; l'intercettatore lo sente molto piu' lontano | F2_ASCOLTARE §3, 04 §4.6.3 | distanza dell'eco entro il 2 %; intercettazione prima dell'eco e oltre 2 volte la portata dell'eco (688 e Alfa, 200 e 1000 m) | ×2,3-3,5 |
| stadimetro ±7 % con la classe giusta | F2_ASCOLTARE §3, C10 | almeno il 90 % delle letture entro ±7 %, errore medio sotto l'1 % | 95-96 %, +0,1 % |
| l'ESM sente i radar dei cacciatorpediniere oltre l'orizzonte acustico | F2_ASCOLTARE §3, 04 §4.6.3 | SPS-40 oltre 2,5 volte la portata della sfera, fra 30 e 80 miglia | 53 miglia contro 6,5 |
| i transitori nei cambi di quota | PROGETTO §5.4 | almeno 3 scricchiolii in 4 minuti di discesa da 50 a 250 m, nessuno a quota ferma; il cambio di regime e' un transitorio | sì |

### H.9 Cosa manca

- Le righe del proprio battello non sporcano i propri sensori di scafo (il rumore proprio e' solo a
  banda larga).
- Il DEMON non distingue gli assi (due eliche identiche danno le stesse righe); la classificazione
  conta le pale e la biblioteca dice quanti assi ha la classe.
- La TL per frequenza: le righe e il LOFAR usano le tabelle alle loro frequenze, interpolate fra le
  bande strette del filone G; il DEMON usa la banda del sensore.
- Il radar proprio non ha il clutter del mare, e gli scafi radiocomandati di TORPEX trasmettono per
  scelta di gioco (una nave senza equipaggio terrebbe spenti i radar).
- L'eco non ha la forma dell'impulso (niente echi multipli, niente fondale come bersaglio).
