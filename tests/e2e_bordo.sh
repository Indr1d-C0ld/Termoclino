#!/usr/bin/env bash
# Prova end-to-end di F0: dall'arruolamento al benvenuto del server di gioco.
#
#   bash tests/e2e_bordo.sh [url-sito] [url-ws]
#
# Default: l'ambiente di sviluppo (php -S su 8160, server di gioco su 8095,
# posta su 'log'). Crea un utente usa-e-getta, legge il collegamento di conferma
# dal diario della posta, accede, prende il biglietto dalla plancia e lo
# presenta al server di gioco. Alla fine cancella l'utente, anche se fallisce.
set -euo pipefail

RADICE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITO="${1:-http://127.0.0.1:8160}"
WS="${2:-ws://127.0.0.1:8095/}"
CONSOLE="php $RADICE/web/bin/console.php"
DIARIO="$RADICE/web/storage/logs/app.log"
CAMPIONE="e2e$(date +%s)$RANDOM"
NOME="Prova ${CAMPIONE}"
EMAIL="${CAMPIONE}@example.com"
PASSWORD="$(openssl rand -hex 12)"
BISCOTTI="$(mktemp)"
PASSATE=0

pulisci() {
  rm -f "$BISCOTTI"
  $CONSOLE user:delete "$EMAIL" >/dev/null 2>&1 <<<"SI" || true
}
trap pulisci EXIT

ok()   { PASSATE=$((PASSATE + 1)); printf '  \033[0;32mok\033[0m   %s\n' "$*"; }
male() { printf '  \033[0;31mNO\033[0m   %s\n' "$*"; exit 1; }

# Il token CSRF dalla pagina (campo nascosto _token).
token() { grep -o 'name="_token" value="[^"]*"' | head -1 | sed 's/.*value="\([^"]*\)"/\1/'; }

echo "e2e bordo: $SITO  ->  $WS"

curl -fsS "$SITO/salute" | grep -q '"ok":true' && ok "il sito, il database e il server di gioco rispondono" \
  || male "/salute non e' ok (server di gioco spento?)"

# --- Arruolamento --------------------------------------------------------------
T=$(curl -fsS -c "$BISCOTTI" -b "$BISCOTTI" "$SITO/arruolamento" | token)
[ -n "$T" ] || male "nessun token CSRF nella pagina d'arruolamento"
CODICE=$(curl -sS -o /dev/null -w '%{http_code}' -c "$BISCOTTI" -b "$BISCOTTI" \
  --data-urlencode "_token=$T" --data-urlencode "username=$NOME" --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASSWORD" --data-urlencode "password_confirm=$PASSWORD" "$SITO/arruolamento")
[ "$CODICE" = "302" ] && ok "arruolamento accettato" || male "arruolamento: HTTP $CODICE"

# --- Conferma ---------------------------------------------------------------------
LINK=$(grep -o "[a-z]*://[^ ]*/conferma?token=[a-f0-9]*" "$DIARIO" | tail -1)
[ -n "$LINK" ] || male "nessun collegamento di conferma nel diario della posta"
curl -fsS -o /dev/null -c "$BISCOTTI" -b "$BISCOTTI" "$SITO/conferma?token=${LINK##*token=}" && ok "indirizzo confermato"

# --- Accesso -------------------------------------------------------------------------
T=$(curl -fsS -c "$BISCOTTI" -b "$BISCOTTI" "$SITO/accesso" | token)
DOVE=$(curl -sS -o /dev/null -w '%{redirect_url}' -c "$BISCOTTI" -b "$BISCOTTI" \
  --data-urlencode "_token=$T" --data-urlencode "login=$NOME" --data-urlencode "password=$PASSWORD" "$SITO/accesso")
[[ "$DOVE" == */plancia ]] && ok "accesso riuscito, rimandato alla plancia" || male "accesso: rimandato a '$DOVE'"

# --- Biglietto e server di gioco -------------------------------------------------------
PAGINA=$(curl -fsS -c "$BISCOTTI" -b "$BISCOTTI" "$SITO/plancia")
BIGLIETTO=$(printf '%s' "$PAGINA" | grep -o 'data-biglietto="[^"]*"' | sed 's/.*="\([^"]*\)"/\1/')
[ -n "$BIGLIETTO" ] && ok "la plancia rilascia un biglietto" || male "nessun biglietto nella plancia"

BENVENUTO=$(node "$RADICE/tests/strumenti/sali_a_bordo.mjs" "$WS" "$BIGLIETTO" "$SITO") || male "il server di gioco ha rifiutato il biglietto: $BENVENUTO"
printf '%s' "$BENVENUTO" | grep -q "\"nome\":\"$NOME\"" && ok "il server di gioco accoglie «$NOME»" || male "benvenuto inatteso: $BENVENUTO"

if node "$RADICE/tests/strumenti/sali_a_bordo.mjs" "$WS" "$BIGLIETTO" "$SITO" >/dev/null 2>&1; then
  male "lo stesso biglietto e' stato accettato due volte"
else
  ok "lo stesso biglietto non vale una seconda volta"
fi

# --- Biglietto nuovo per la riconnessione ----------------------------------------------
CSRF=$(printf '%s' "$PAGINA" | grep -o 'data-csrf="[^"]*"' | sed 's/.*="\([^"]*\)"/\1/')
NUOVO=$(curl -fsS -c "$BISCOTTI" -b "$BISCOTTI" -X POST -H "X-CSRF-Token: $CSRF" "$SITO/biglietto" \
  | sed -n 's/.*"biglietto":"\([^"]*\)".*/\1/p')
node "$RADICE/tests/strumenti/sali_a_bordo.mjs" "$WS" "$NUOVO" "$SITO" >/dev/null \
  && ok "un biglietto nuovo (riconnessione) porta di nuovo a bordo" || male "il biglietto di riconnessione non funziona"

# --- Grafica originale protetta ----------------------------------------------------------
CODICE=$(curl -sS -o /dev/null -w '%{http_code}' "$SITO/originali/manifest.json")
[ "$CODICE" = "302" ] && ok "la grafica originale non si vede senza accesso" || male "/originali senza accesso: HTTP $CODICE"

echo "e2e bordo: $PASSATE verifiche passate"
