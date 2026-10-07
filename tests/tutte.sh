#!/usr/bin/env bash
# Tutte le prove di Termoclino, in ordine dal piu' veloce al piu' lento.
#
#   bash tests/tutte.sh            unita' + tipi + end-to-end (servono i server di sviluppo)
#   bash tests/tutte.sh --veloce   senza end-to-end
set -uo pipefail

RADICE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RADICE"
FALLITE=()

passo() {
  local nome="$1"; shift
  printf '\n\033[1;36m== %s\033[0m\n' "$nome"
  if "$@"; then printf '\033[0;32m   %s: ok\033[0m\n' "$nome"; else FALLITE+=("$nome"); printf '\033[0;31m   %s: FALLITA\033[0m\n' "$nome"; fi
}

passo "sintassi PHP" bash -c 'find web -name "*.php" -print0 | xargs -0 -n1 php -l >/dev/null'
passo "sintassi script" bash -c 'for f in deploy/*.sh tests/*.sh; do bash -n "$f" || exit 1; done'
passo "prove JavaScript" npm test --silent
passo "controllo dei tipi" npm run --silent typecheck
if [ "${1:-}" != "--veloce" ]; then
  passo "end-to-end bordo" bash tests/e2e_bordo.sh
fi

echo
if [ ${#FALLITE[@]} -eq 0 ]; then
  printf '\033[1;32mTutte le prove sono verdi.\033[0m\n'
else
  printf '\033[1;31mFallite: %s\033[0m\n' "${FALLITE[*]}"
  exit 1
fi
