#!/usr/bin/env bash
#
# Termoclino — installa (o aggiorna) la sola configurazione Apache.
#
#   sudo bash deploy/01-apache.sh
#
# Idempotente. Fa il backup di cio' che sostituisce, verifica la sintassi con
# apache2ctl configtest PRIMA di ricaricare, e se il configtest fallisce
# rimette a posto il file precedente senza ricaricare niente.
#
# Serve separato da 00-bootstrap.sh perche' la configurazione Apache e'
# l'unica cosa che puo' aver bisogno di essere aggiornata dopo il primo
# insediamento, e rilanciare l'intero bootstrap per quella e' sproporzionato.

set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/apache-termoclino.conf"
DST="/etc/apache2/conf-available/termoclino.conf"
STAMP="$(date +%Y%m%d-%H%M%S)"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '    \033[0;32m%s\033[0m\n' "$*"; }
ko()  { printf '    \033[0;31m%s\033[0m\n' "$*"; }

if [[ "${EUID}" -ne 0 ]]; then
  echo "Questo script va eseguito con sudo." >&2
  exit 1
fi
[[ -f "${SRC}" ]] || { echo "Manca ${SRC}" >&2; exit 1; }

say "Configurazione Apache"
BACKUP=""
if [[ -f "${DST}" ]]; then
  if cmp -s "${SRC}" "${DST}"; then
    ok "gia' aggiornata: niente da fare"
    exit 0
  fi
  BACKUP="${DST}.bak-${STAMP}"
  cp -a "${DST}" "${BACKUP}"
  ok "backup: ${BACKUP}"
fi

install -m 0644 -o root -g root "${SRC}" "${DST}"
a2enmod rewrite proxy proxy_wstunnel >/dev/null 2>&1 || true
a2enconf termoclino >/dev/null

if apache2ctl configtest 2>&1 | tail -1 | grep -q "Syntax OK"; then
  systemctl reload apache2
  ok "configtest OK, apache2 ricaricato"
else
  ko "configtest FALLITO: rimetto il file precedente e non ricarico."
  apache2ctl configtest || true
  if [[ -n "${BACKUP}" ]]; then
    install -m 0644 -o root -g root "${BACKUP}" "${DST}"
    ok "ripristinato ${DST}"
  else
    a2disconf termoclino >/dev/null 2>&1 || true
    rm -f "${DST}"
    ok "rimossa la configurazione nuova"
  fi
  exit 1
fi

say "Verifica"
for U in / accesso salute; do
  CODICE=$(curl -sS -o /dev/null -w '%{http_code}' "https://example.com/termoclino/${U}" || echo '---')
  printf '    %-10s %s\n' "/${U}" "${CODICE}"
done
printf '\n    Se "accesso" e "salute" rispondono 200, gli URL puliti funzionano.\n'
printf '    Se rispondono 404, il blocco <Directory> non si sta applicando:\n'
printf '    controlla che il percorso sia /var/www/html/termoclino e NON /data/html/termoclino.\n\n'
