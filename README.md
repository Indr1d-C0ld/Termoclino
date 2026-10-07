# Termoclino

Simulatore di sottomarini della tarda Guerra Fredda, giocabile nel browser, in singolo e in
duello uno-contro-uno. È un **tributo amatoriale e senza scopo di lucro** a *688 Attack Sub*
(John W. Ratcliff, Paul Grace e Randall Breen; Electronic Arts, 1989): ne conserva
l'interfaccia a stazioni e la grafica originale, e rifà da capo tutto quello che sta sotto.

Non è affiliato a Electronic Arts né agli autori originali. I marchi, la grafica e i suoni del
1989 appartengono ai rispettivi aventi diritto e **non sono inclusi** in questo repository:
chi installa il gioco li estrae dalla propria copia con `tools/estrai/estrai688.py`.
Se gli aventi diritto lo chiedono, il progetto viene ritirato.

## Com'è fatto

| Parte | Dove | Cosa |
|-------|------|------|
| Sito | `web/` | PHP 8.4 senza framework: arruolamento, accesso, plancia, (poi) classifiche e carriera |
| Server di gioco | `server/` | Node.js 24 in Docker: WebSocket, simulazione autoritativa, nebbia di guerra |
| Moduli comuni | `shared/` | protocollo, unità, geometria, generatore con seme, dati delle piattaforme |
| Strumenti | `tools/` | estrattore della grafica originale, (poi) tabelle acustiche e bilanciamento |
| Documenti | `docs/` | progetto, ricerca con le fonti, il gioco originale, gli asset |

Il progetto completo, con le decisioni e la roadmap, è in [`docs/PROGETTO.md`](docs/PROGETTO.md).

## Installazione (Debian/Ubuntu con Apache, MariaDB, PHP 8.4, Docker)

```bash
sudo bash deploy/00-bootstrap.sh     # una volta: cartelle, database, segreti, Apache
bash deploy/02-pubblica.sh           # ogni volta: codice, migrazioni, grafica, server di gioco
```

Prima di lanciarli, adatta in cima agli script i percorsi, l'host pubblico e l'utente di
sistema. La copia del gioco originale si indica con `TERMOCLINO_ORIGINALI`.

## Sviluppo

```bash
npm install                          # strumenti di verifica (TypeScript per il controllo dei tipi)
(cd server && npm install)
npm test                             # tutte le prove JavaScript (node --test)
npm run typecheck                    # controllo dei tipi JSDoc, senza compilare
bash tests/tutte.sh                  # tutto, compresa la prova end-to-end
```

## Licenza

Il codice è distribuito con licenza GPL-3.0-or-later. La licenza copre il nostro codice e i
nostri documenti, non il materiale di terzi citato o estratto.
