# 07 — Impiego dei siluri: dottrina, guida a filo, ricerca, salve, evasione, distanze d'ingaggio

Sezione del catalogo di riferimento per il tributo a *688 Attack Sub* (1985–1991). Compilata il 2026-10-07.
Convenzioni di confidenza come in `05_acustica.md`. Dati d'arma dettagliati (velocità, autonomie, date): `02_armi.md`. Contromisure: `03_contromisure.md`. Le chiavi rimandano a `FONTI.md`.

> Nota sulle fonti. La dottrina d'impiego reale (manuali NWP/ATP) è classificata. Le fonti aperte migliori sono di due tipi. Da un lato la storia ufficiale e semi-ufficiale: Coté, *The Third Battle*, Naval War College 2003. Dall'altro gli articoli dell'epoca su *The Submarine Review* (Naval Submarine League, 1984–1991), scritti da ufficiali e analisti spesso sotto pseudonimo. Dove manca una fonte, i valori sono `nozionali` e motivati.

---

## 1. Principi di fondo

| principio | contenuto | fonte | confidenza |
|---|---|---|---|
| Paradigma del siluro pesante | Si lancia "a migliaia di yard dal bersaglio, ben oltre la portata di acquisizione del sistema di homing". Il siluro leggero invece viene portato vicino al bersaglio dalla piattaforma (aereo, ASROC) | [COTE03 p. 57], che cita una fonte NUWC | documentato |
| Margine di velocità | Un siluro ASW deve avere il **50% di velocità in più** del bersaglio, perché il bersaglio allertato non sfugga. Con sottomarini da 30 kt a 1000 ft servivano siluri da 45 kt | [COTE03 p. 57] | documentato |
| Stesso concetto, lato britannico | Lo Spearfish doveva superare i 60 kt per mantenere il rapporto 1,5:1 sull'Alfa, accreditato di profondità oltre i 1000 m. Questa profondità si rivelerà sovrastimata, vedi §6 | [LONG89] | documentato (come requisito dell'epoca) |
| Lentezza dell'arma | "Servono sei o più minuti per percorrere 10 000 yard, una distanza di tiro ragionevolmente corta per i siluri ASW a homing terminale di oggi." Anche a 60 kt servono cinque minuti da 10 000 yd | [PHX84a], [PHX84b] | documentato (opinione d'epoca) |
| Furtività contro velocità | Un siluro veloce e rumoroso allerta il bersaglio e innesca contromisure e controfuoco. Contro un bersaglio "competente e allertato" la probabilità di colpire cala e lo scambio tende a 1:1. Si propone guida a filo silenziosa con homing passivo 3D e uso dell'attivo "solo all'ultimo secondo" | [PHX84a] | documentato (opinione d'epoca) |
| Il Mk 48 nasce come arma per navi di superficie | Il requisito degli anni '60 era per un'arma ASW lanciata da navi (rumorosa ma veloce); l'impiego da sottomarino è stato una conseguenza. Da qui i suoi limiti passivi ad alta velocità | [PHX84b] | documentato (opinione d'epoca) |

---

## 2. Guida a filo

### 2.1 Fatti

| fatto | fonte | confidenza |
|---|---|---|
| Mk 37 Mod 1 (1960): prima guida a filo USA; controllo durante il percorso di avvicinamento; efficace contro bersagli fino a 20 kt e 1000 ft | [COTE03 p. 58] | documentato |
| Mk 48 Mod 3 (fine anni '70): capacità *track-via-torpedo*, cioè dati del sonar del siluro rimandati al battello tramite il filo | [COTE03 p. 59] | documentato |
| Mk 48: all'uscita dal tubo un filo sottile si svolge e collega elettronicamente siluro e battello. L'operatore guida il siluro con i sonar di bordo, il che "aiuta a evitare esche e disturbatori". Poi il filo viene tagliato e il siluro prosegue con il proprio sonar attivo/passivo. Mk 48 e ADCAP possono operare con o senza filo e fare **più riattacchi** | [FAS-MK48] | documentato |
| Vincolo tattico: la guida a filo di un siluro lanciato verso prua "obbliga il sottomarino a mantenere una rotta di chiusura durante la fase di guida". Per questo conviene lanciare dalla distanza più grande possibile | [PHX84a] | documentato (opinione d'epoca) |
| Il filo dovrebbe essere bidirezionale: comandi verso il siluro, dati del sonar del siluro verso il battello, così l'operatore valuta le contromisure del bersaglio | [PHX84a] (auspicio del 1984, poi realizzato con il TVT del Mk 48-3, secondo [COTE03]) | documentato |
| Un siluro a filo che lascia una scia rivela la posizione del battello agli aerei di scorta | [PHX84a] | documentato |
| Modello *Sub Command*: chiudere il portello esterno del tubo taglia il filo | [SONALYSTS-SC] | documentato (scelta di gioco) |
| Modello *Cold Waters*: il filo può rompersi al lancio; ricaricare il tubo lo taglia; alcune classi hanno meno fili che tubi. Per ridurre le rotture: bassa velocità, assetto livellato, arma entro ±60° dalla prua | [CW-MAN pp. 11–12] | documentato (scelta di gioco) |

### 2.2 Lunghezza del filo e limiti del lanciatore (`nozionale`)

Le lunghezze reali delle bobine (lato siluro e lato battello) non risultano da fonti aperte verificate. La fisica è nota: il filo si svolge da due bobine, una nel siluro e una sul lato battello, così né il siluro né il battello lo trascinano nell'acqua. **Il limite pratico è quindi il movimento del battello e la tensione, più che la distanza del siluro.**

| parametro | valore proposto | motivazione | confidenza |
|---|---|---|---|
| Filo lato siluro | pari all'autonomia del siluro | Il filo non deve limitare la portata dell'arma: l'interruzione nasce dagli altri vincoli | nozionale |
| Filo lato battello | 3 nmi di moto proprio dopo il lancio | Il battello che si allontana di qualche miglio consuma la bobina di bordo e il filo si spezza | nozionale |
| Velocità propria massima con filo | 12 kt; tra 12 e 18 kt rischio di rottura del 2% al minuto, oltre i 18 kt rottura certa | Coerente con "bassa velocità" [CW-MAN] e con il fatto che il battello deve restare silenzioso per guidare | nozionale |
| Settore | arma entro ±60° dalla prua del lanciatore; fuori settore, rischio del 5% al minuto | come [CW-MAN] | nozionale (precedente di gioco) |
| Accostate | velocità di accostata oltre 1°/s: rischio del 5% per manovra | Le accostate strette mettono in tensione il filo | nozionale |
| Fili contemporanei | 688: 4 (uno per tubo) | 4 tubi lanciasiluri da 533 mm (vedi `01_piattaforme.md`) | stimato |
| Ritardo di comando | 1–2 s | Collegamento elettrico diretto | nozionale |

---

## 3. Preset d'arma: abilitazione, quote, schemi di ricerca

| preset | significato | fonte | confidenza |
|---|---|---|---|
| Profilo a fasi programmate | Prima fase: il siluro va sulla rotta voluta con giroscopi e regolazioni di quota, e la mantiene fino al presunto arrivo nella zona del bersaglio. Seconda fase: schema di ricerca, per esempio circolare o elicoidale | [FUN-15 §16.6.1.2] | documentato |
| Mk 37 | Percorso preimpostato su rilevamento fisso, poi ricerca circolare passiva, poi homing terminale attivo | [COTE03 p. 58] | documentato |
| Mk 48 / ADCAP | "Eseguono procedure programmate di ricerca, acquisizione e attacco"; riattacchi multipli | [FAS-MK48] | documentato |
| **Enable (distanza di abilitazione)** | Punto (distanza o waypoint) oltre il quale il seeker si attiva. Prima è "cieco" per non agganciare il lanciatore o le esche vicine | [CW-MAN p. 11] (RTE, "Range To Enable"); concetto generale in [FUN-15] | documentato (come concetto) |
| **Ceiling / floor** | Quote minima e massima di ricerca: evitano la superficie (riverberazione, bersagli spuri) e il fondo, e mettono la ricerca sopra o sotto lo strato | L'esistenza di impostazioni quota di ricerca/attacco per il Mk 48 è in [FAS-MK48] ("Search/attack depth settings", valori di pagina poco chiari). *Cold Waters* usa Run Level / Shallow (sopra lo strato, ~30 ft) / Deep (~30 ft sotto lo strato, o 350 ft senza strato) [CW-MAN p. 11] | documentato (concetto) / nozionale (valori) |
| Schemi di ricerca | Rettilineo, **snake** (serpentina), cerchio a destra, cerchio a sinistra | [CW-MAN p. 11]; [FUN-15] per circolare ed elicoidale | documentato (come scelta di gioco e principio) |
| Modo del seeker | Passivo (silenzioso, richiede un bersaglio rumoroso), attivo (efficace contro bersagli silenziosi, ma avverte il bersaglio), misto | [CW-MAN p. 11]; [PHX84a] | documentato |
| Filtro Doppler (attivo) | Scartare gli echi a Doppler quasi nullo riduce i falsi bersagli da riverberazione, ma rende il siluro cieco a un bersaglio che si muove **trasversalmente** alla linea di vista | [PEP89] | documentato |
| Wake homing (sovietico) | 53-65K e 65-76 seguono la scia di navi di superficie: inutili contro sottomarini immersi. Dettagli in `02_armi.md` | (vedi `02_armi.md`) | — |

Proposta di preset per il gioco (`nozionale`):

| preset | valori ammessi | default 688 vs SSN |
|---|---|---|
| Velocità | Bassa (40 kt, massima autonomia e seeker passivo più efficace) / Alta (55 kt Mk 48; fino a 63 kt per ADCAP, secondo [COTE03]) | bassa fino all'abilitazione, alta all'aggancio |
| Enable | 1–30 kyd oltre il lancio, oppure waypoint | punto stimato del bersaglio meno 2 kyd |
| Ceiling / floor | 50–1500 ft | ceiling = profondità dello strato + 50 ft se il bersaglio è sotto lo strato |
| Ricerca | rettilinea / snake (ampiezza ±20°, periodo 1 kyd) / cerchio | snake |
| Seeker | passivo / attivo / passivo poi attivo all'aggancio | passivo poi attivo |
| Anti-superficie | sì/no: fuse e quota diverse | no |

---

## 4. Seeker: portata di acquisizione (quasi tutto nozionale)

| dato | valore | fonte | confidenza |
|---|---|---|---|
| "Weapon acquisition range 1600 yards" (pagina Mk 48 di FAS) | 1600 yd | [FAS-MK48]. **Attenzione**: nella stessa scheda compaiono le distanze di lancio ASROC 1500–12 000 yd, quindi il blocco sembra mescolare dati del Mk 46/ASROC | stimato (dubbio) |
| ADCAP rispetto al Mk 48 | "Portata di acquisizione migliorata, minore vulnerabilità alle contromisure, minori vincoli di bordo (riscaldamento, riattivazione), maggiore efficacia anti-superficie" | [FAS-MK48] | documentato (qualitativo) |
| Modello accademico NPS | AcqRange (nmi) = 0,0008 · V_bersaglio² (0,26 nmi a 18 kt) | [COLL94] | documentato come modello; nozionale come dato |
| Mk 46: zona di non-fuga | Cilindro di "diverse migliaia di yard" di diametro e circa 1500 ft di altezza | [COTE03 p. 57] | documentato |

Proposta (`nozionale`), da collegare al modello acustico di `05_acustica.md`: il seeker è un sonar ad alta frequenza (20–40 kHz) con TL sferica e assorbimento di 4–8 dB/km. Le portate che ne risultano:

| seeker | vs SSN rumoroso (Victor I, Alfa in corsa) | vs SSN silenzioso (Akula, 688I) | vs nave | note |
|---|---|---|---|---|
| Mk 48 (Mod 3/4), attivo | 2000 yd | 1500 yd | 3000 yd | −30% con piastrelle anecoiche |
| Mk 48 ADCAP, attivo | 3000 yd | 2200 yd | 4000 yd | ADCAP "improved acquisition range" |
| Mk 48 / ADCAP, passivo | 4000 yd | 800 yd | 6000 yd | dipende dal SL del bersaglio |
| Siluri sovietici (USET-80, SET-65) | vedi `02_armi.md` | — | — | — |

---

## 5. Salve, ventagli e controfuoco

| fatto | fonte | confidenza |
|---|---|---|
| Il dialogo d'apertura di Peppe (1989) mostra lo schema di un ingaggio SSN contro SSN a distanza ravvicinata: contatto classificato, preparazione dell'arma, lancio quasi immediato; il bersaglio sente i transitori di lancio, poi "torpedo in the water", e il lanciatore viene a sua volta allertato | [PEP89] | documentato (scenario illustrativo) |
| Teoria dei giochi: contro un siluro con o senza filtro Doppler, la strategia ottima di entrambe le parti è **mista**. Nell'esempio (ingaggio a 5 kyd, siluro a 50 kt, bersaglio a 30 kt, probabilità di falso bersaglio 0,10%/kyd), l'attaccante usa il filtro Doppler il 24% delle volte, il bersaglio fugge "via" il 46% e "di traverso" il 54%; probabilità di colpire 46% | [PEP89] | documentato (modello accademico) |
| Corollario dottrinale: se la dottrina nemica è "evadere in profondità", conviene mettere i siluri sotto lo strato; e allora a volte conviene evadere in superficie. L'adesione cieca a una dottrina "costa battelli e vite" | [PEP89] | documentato |
| Mischia (melee): con portate di scoperta sotto le 6000 yd servirebbe un'arma leggera, molto veloce, a salve, con homing terminale | [PHX84a], [PHX90] | documentato (opinione d'epoca) |

Regola di ventaglio proposta (`nozionale`), derivata dalla TMA di `06_tma.md`:
- **Numero di siluri**: 1 se Q ≥ 80%; 2 se 50% ≤ Q < 80% (ventaglio); Q < 50% sconsigliato, salvo controfuoco.
- **Apertura del ventaglio**: `Δψ = 2·atan(σ_cross / R_enable)`, dove σ_cross è l'incertezza trasversale della posizione prevista all'abilitazione, limitata a ±15°.
- **Controfuoco** ("snap shot" lungo il rilevamento del siluro in arrivo): sempre consentito, con TMA nulla. Il siluro corre lungo il rilevamento e si abilita a una distanza preimpostata (per esempio 4 kyd). Serve soprattutto a costringere il lanciatore a tagliare il filo e manovrare.

---

## 6. Evasione dai siluri

### 6.1 Elementi documentati

| elemento | fonte | confidenza |
|---|---|---|
| Allarme: i ricevitori d'intercettazione acustica danno frequenza e azimut dal primo ping e assegnano priorità ai siluri, per dare tempo alle manovre evasive | [FUN-11 §11.3.1] | documentato |
| Un sottomarino sotto attacco scende di quota per correre forte senza cavitare | [FUN-8 §8.8.1.3] | documentato |
| Fuga di traverso alla linea di vista contro i seeker a filtro Doppler, fuga "via" contro gli altri; serve una strategia mista | [PEP89] | documentato |
| Esche: noisemaker trainati o lanciati; decoy mobili tipo siluro con transponder che restituiscono un'eco realistica e simulano in parte la firma passiva. Per disturbare un sonar attivo da sottomarino servono almeno 200 dB re 1 µPa | [FUN-11 §11.3.2] | documentato |
| Knuckle: la turbolenza di un'accostata a tutta barra ad alta velocità crea un falso bersaglio che disturba l'homing | [CW-MAN p. 22] (definizione di gioco); il concetto compare anche nella letteratura divulgativa | documentato (come modello di gioco) / stimato (reale) |
| "Crazy Ivan": termine coniato da Tom Clancy (*The Hunt for Red October*, 1984). La manovra sovietica di virata brusca per "ripulire i baffles" e scoprire un inseguitore è invece descritta come reale da fonti secondarie | fonte secondaria (sintesi di ricerca da Wikipedia "Baffles (submarine)" e articoli divulgativi); approfondimento in `03_contromisure.md` | stimato |

### 6.2 Inseguimento in coda: la meccanica centrale del duello 688 contro Alfa

Distanza iniziale massima da cui un siluro raggiunge un bersaglio che, allertato al lancio, fugge in linea retta alla massima velocità:
`R₀,max = R_autonomia · (1 − V_bersaglio / V_siluro)`.
Si trascurano il tempo di reazione del bersaglio (che favorisce l'attaccante) e la portata di acquisizione (anch'essa a favore dell'attaccante, di circa 1–2 kyd). Script `raw/07/calc/sternchase.py`. Le autonomie del Mk 48 sono quelle "claimed" della pagina FAS `[FAS-MK48]`; le velocità dei bersagli sono indicative (vedi `01_piattaforme.md`), tranne l'Alfa a 41 kt dimostrati `[COTE03]`.

| bersaglio in fuga | Mk 48, 55 kt (34,4 kyd) | Mk 48, 40 kt (44,6 kyd) | ADCAP, 55 kt (42,5 kyd) | ADCAP, 63 kt (autonomia nozionale 35 kyd) | confidenza |
|---|---|---|---|---|---|
| Alfa, 41 kt | **8,8 kyd** | **0 (non lo raggiunge)** | 10,8 kyd | 12,2 kyd | calcolato |
| Sierra, ~34 kt | 13,1 | 6,7 | 16,2 | 16,1 | calcolato |
| Akula, ~33 kt | 13,8 | 7,8 | 17,0 | 16,7 | calcolato |
| Victor I, ~32 kt | 14,4 | 8,9 | 17,8 | 17,2 | calcolato |
| Victor III, ~30 kt | 15,7 | 11,1 | 19,3 | 18,3 | calcolato |
| Kilo, 17 kt | 23,8 | 25,6 | 29,4 | 25,6 | calcolato |

Lettura per il design:
- L'Alfa allertato che fugge a tutta forza **sfugge al Mk 48 lanciato oltre circa 9 kyd**, e a qualunque Mk 48 in regime lento.
- In cambio, a 41 kt l'Alfa è assordato dal proprio rumore di flusso (vedi `05_acustica.md` §7.1) e udibile a grande distanza. Non può guidare armi a filo né sapere dove andrà il secondo siluro. È il compromesso velocità/rumore che rende interessante il duello.
- L'ADCAP (operativo dal 1988, `[FAS-MK48]`) riduce ma non annulla questo vantaggio. Per gli scenari 1985–87 il 688 ha il Mk 48 Mod 4; dal 1988–89 l'ADCAP.

### 6.3 Il mito e la realtà dell'Alfa

Secondo Coté, l'Alfa (1970) "sorprese" la Marina USA perché stimato a 45 kt e 2000–2500 ft di quota operativa, e provocò grandi investimenti in siluri (Mk 48 ADCAP, Mk 46 NEARTIP, Mk 50). In realtà dimostrò **41 kt**. Lo scafo in titanio servì a ridurre il dislocamento più che ad aumentare la quota, che era "più vicina a 1100 ft". Il reattore a piombo-bismuto richiedeva vapore da terra in porto per non "congelare". Ne furono schierati solo sei. "L'Alfa fece più per la postura ASW della Marina USA che per quella sovietica" `[COTE03 pp. 59–60]` (`documentato`).
Implicazione: il gioco può offrire due "versioni" dell'Alfa. Quella **di intelligence 1980** (45 kt, oltre 2000 ft) è il "mito", utile come modalità storica o leggendaria. Quella **reale** (41 kt, ~1100–1300 ft: vedi `01_piattaforme.md` per i dati sovietici di profondità operativa e di collaudo) va usata come predefinita.

### 6.4 Sequenza di evasione proposta (`nozionale`, sintetizzata dagli elementi di §6.1)

1. **Allarme** (WLR-9 o sonar): rilevamento e stima del tipo (attivo o passivo, frequenza).
2. **Controfuoco** facoltativo lungo il rilevamento d'origine (§5).
3. **Contromisura** (decoy/noisemaker) lanciata *prima* di accostare, così resta tra il siluro e la nuova rotta.
4. **Accostata** a tutta barra con aumento di velocità (knuckle): mettere il siluro al traverso se il seeker è attivo e potrebbe avere filtro Doppler, oppure a poppa se è passivo o in inseguimento.
5. **Cambio di quota attraverso lo strato**, nel verso opposto alla quota di ricerca presunta (o casuale, secondo [PEP89]).
6. **Corsa** sotto la velocità di cavitazione della nuova quota (`05_acustica.md` §7.2) fino a esaurire l'autonomia del siluro, poi di nuovo silenzio.

---

## 7. Distanze tipiche d'ingaggio sottomarino contro sottomarino

| dato | valore | fonte | confidenza |
|---|---|---|---|
| Distanza di tiro "ragionevolmente corta" per i siluri ASW (1984) | 10 000 yd | [PHX84a] | documentato (opinione d'epoca) |
| "Mischia" con scoperta sotto le 6000 yd, in condizioni ambientali sfavorevoli | < 6000 yd | [PHX84a], [PHX90] | documentato |
| Akula: livello broadband vicino o uguale a Sturgeon e primi 688; tonali narrowband sotto il broadband. Ne segue che a lunga distanza la scoperta è difficile e a breve distanza la controscoperta è più probabile | qualitativo | [COTE03 p. 70] | documentato |
| Akula più silenzioso dei Delta e più rumoroso degli ultimi 688 | qualitativo | [COTE03 p. 71] | documentato |
| Victor III (1978; importanza capita nel 1981): rilevabile soprattutto grazie alle tonali di pala dell'elica sull'array trainato a bassa frequenza (testimonianza dell'ammiraglio Watkins, 1984) | qualitativo | [COTE03 p. 69] | documentato |
| Pedinamenti (trail) della Guerra Fredda: documentati in termini generali | — | [COTE03] | documentato (qualitativo) |

Proposta di distribuzione delle distanze per scenario (`nozionale`, coerente con le righe precedenti e con `05_acustica.md`):

| coppia | prima scoperta tipica | distanza di lancio tipica |
|---|---|---|
| 688I silenzioso contro Victor I / Alfa in transito veloce | 20–40 kyd in diretta, anche in CZ (~31 nmi) con TB-16/TB-23 | 8–15 kyd (prima che l'Alfa possa fuggire, §6.2) |
| 688 contro Victor III | 10–20 kyd | 6–12 kyd |
| 688 contro Akula I (1985–91) | 3–10 kyd, spesso su transitori | 3–8 kyd (mischia) |
| Alfa contro 688 | l'Alfa scopre per primo solo se il 688 è veloce o cavita | 3–10 kyd, o controfuoco |

---

## 8. Regole di gioco riassuntive

| regola | valore | confidenza |
|---|---|---|
| Margine di velocità minimo per colpire un bersaglio in fuga | 1,5:1 | documentato (regola di progetto) |
| Formula dell'inseguimento in coda | `R₀,max = R_aut (1 − V_t/V_s)` | calcolato |
| Filo: limiti per il battello | ≤ 12 kt sicuri; ±60° dalla prua; 3 nmi di moto proprio | nozionale |
| Enable, ceiling/floor, snake/cerchio | come §3 | documentato (concetti) / nozionale (valori) |
| Seeker attivo Mk 48 / ADCAP vs SSN silenzioso | 1500 / 2200 yd | nozionale |
| Strategie miste di evasione | Doppler sì/no contro via/traverso | documentato [PEP89] |
| Alfa "mito" contro "reale" | 45 kt e 2000+ ft contro 41 kt e ~1100 ft | documentato [COTE03] |
