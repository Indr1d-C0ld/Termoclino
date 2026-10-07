#!/usr/bin/env bash
# Pubblica il lavoro da questo albero a /data/html/termoclino e (ri)avvia il
# server di gioco. Idempotente: si puo' rilanciare quante volte si vuole.
# SENZA sudo: il bootstrap (00) ha gia' dato le cartelle all'utente di servizio.
#
#   bash deploy/02-pubblica.sh            pubblica, migra, estrae, riavvia
#   bash deploy/02-pubblica.sh --prova    mostra cosa copierebbe, senza farlo
#
# La grafica originale si estrae dalla copia del gioco dell'utente, che non sta
# nel repo: TERMOCLINO_ORIGINALI indica dove si trova.
set -euo pipefail

SORGENTE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINAZIONE="${TERMOCLINO_HTML:-/data/html/termoclino}"
CONFIG="${TERMOCLINO_CONFIG_PROD:-/data/termoclino-config/config.php}"
SERVER_ENV="${TERMOCLINO_SERVER_ENV:-/data/termoclino-config/server.env}"
ORIGINALI="${TERMOCLINO_ORIGINALI:-/percorso/della/copia/688}"
GRUPPO="${TERMOCLINO_GRUPPO:-www-data}"
URL="${TERMOCLINO_URL:-https://example.com/termoclino}"

PROVA=()
[ "${1:-}" = "--prova" ] && PROVA=(--dry-run) && echo ">>> prova a vuoto, non tocco niente"

[ -d "$DESTINAZIONE" ] || { echo "manca $DESTINAZIONE: prima sudo bash deploy/00-bootstrap.sh"; exit 1; }
[ -f "$CONFIG" ]       || { echo "manca $CONFIG: prima sudo bash deploy/00-bootstrap.sh"; exit 1; }
[ -f "$SERVER_ENV" ]   || { echo "manca $SERVER_ENV: prima sudo bash deploy/00-bootstrap.sh"; exit 1; }

# assets/originali/ e storage/ esistono solo in esercizio: una copia con
# --delete li cancellerebbe. assets/shared/ in sviluppo non esiste (lo serve
# index.php da ../shared): qui si copiano i file veri, subito dopo.
echo ">>> copio l'applicazione"
rsync -a --delete "${PROVA[@]}" \
  --exclude 'config/config.php' \
  --exclude 'config/prova_sviluppo.txt' \
  --exclude 'storage/' \
  --exclude 'assets/originali/' \
  --exclude 'assets/shared/' \
  --itemize-changes \
  "$SORGENTE/web/" "$DESTINAZIONE/"

echo ">>> copio i moduli comuni in assets/shared/"
rsync -a --delete "${PROVA[@]}" --exclude 'test/' \
  "$SORGENTE/shared/" "$DESTINAZIONE/assets/shared/"

[ ${#PROVA[@]} -gt 0 ] && exit 0

mkdir -p "$DESTINAZIONE/storage/logs" "$DESTINAZIONE/storage/cache"

echo ">>> permessi"
find "$DESTINAZIONE" -path "$DESTINAZIONE/storage" -prune -o -print0 | xargs -0 chgrp "$GRUPPO"
find "$DESTINAZIONE" -path "$DESTINAZIONE/storage" -prune -o -type d -print0 | xargs -0 chmod 775
find "$DESTINAZIONE" -path "$DESTINAZIONE/storage" -prune -o -type f -print0 | xargs -0 chmod 664
chgrp "$GRUPPO" "$DESTINAZIONE/storage" "$DESTINAZIONE/storage/logs" "$DESTINAZIONE/storage/cache"
chmod 2775 "$DESTINAZIONE/storage" "$DESTINAZIONE/storage/logs" "$DESTINAZIONE/storage/cache"

echo ">>> migrazioni"
TERMOCLINO_CONFIG="$CONFIG" php "$DESTINAZIONE/bin/console.php" migrate

echo ">>> grafica originale"
if [ -d "$ORIGINALI" ]; then
  python3 "$SORGENTE/tools/estrai/estrai688.py" "$ORIGINALI" --client "$DESTINAZIONE/assets/originali" \
    || echo "    (estrazione non riuscita: il sito funziona, il client restera' senza grafica originale)"
else
  echo "    copia del gioco non trovata in $ORIGINALI: salto (TERMOCLINO_ORIGINALI per indicarla)"
fi

echo ">>> server di gioco"
docker compose -f "$SORGENTE/server/compose.yaml" up -d --build --remove-orphans
for i in $(seq 1 15); do
  curl -fsS http://127.0.0.1:8095/salute >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS http://127.0.0.1:8095/salute && echo

echo ">>> verifica dall'esterno"
for U in / accesso salute; do
  printf '    %-10s %s\n' "/$U" "$(curl -sS -o /dev/null -w '%{http_code}' "$URL/$U" || echo '---')"
done
printf '    %-10s %s\n' "/ws" "$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H "Origin: ${URL%/termoclino}" \
  "$URL/ws" || echo '---')"
echo "    (attesi: 200, 200, 200 e 101 per il WebSocket)"
echo ">>> fatto."
