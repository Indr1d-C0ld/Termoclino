#!/usr/bin/env bash
#
# Termoclino — bootstrap dell'ambiente su il server.
# Da eseguire UNA VOLTA con sudo:   sudo bash deploy/00-bootstrap.sh
#
# Idempotente: puo' essere rilanciato senza danni. Non tocca i vhost esistenti
# (usa conf-available/a2enconf), fa backup di cio' che sostituisce, verifica la
# configurazione Apache con apache2ctl configtest PRIMA del reload, e non
# rigenera mai segreti gia' presenti.
#
# Cosa fa:
#   1. rende /data/html/termoclino scrivibile dall'utente di servizio, gruppo www-data (setgid)
#   2. crea /data/termoclino-config/ per i segreti (fuori dal DocumentRoot)
#   3. crea database e utente MariaDB trm_termoclino con password generata
#   4. scrive config.php (PHP) e server.env (server di gioco) se non esistono,
#      con LO STESSO segreto dei biglietti generato una volta sola
#   5. installa e abilita la conf Apache (sito + tunnel WebSocket /termoclino/ws)
#
# Cosa NON fa (non serve sudo): copiare il codice, applicare le migrazioni,
# avviare il contenitore del server di gioco. Per quello: bash deploy/02-pubblica.sh
#
set -euo pipefail

OWNER_USER="deploy"
OWNER_GROUP="www-data"
PROJECT_DIR="/data/html/termoclino"
CONFIG_DIR="/data/termoclino-config"
CONFIG_FILE="${CONFIG_DIR}/config.php"
SERVER_ENV="${CONFIG_DIR}/server.env"
DB_NAME="trm_termoclino"
DB_USER="trm_termoclino"
PUBLIC_HOST="example.com"
ADMIN_EMAIL="admin@example.com"
APACHE_CONF_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/apache-termoclino.conf"
APACHE_CONF_DST="/etc/apache2/conf-available/termoclino.conf"
STAMP="$(date +%Y%m%d-%H%M%S)"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '    \033[0;32m%s\033[0m\n' "$*"; }
warn(){ printf '    \033[0;33m%s\033[0m\n' "$*"; }

if [[ "${EUID}" -ne 0 ]]; then
  echo "Questo script va eseguito con sudo." >&2
  exit 1
fi

# --- 1. Directory di progetto ------------------------------------------------
say "1/5  Directory di progetto ${PROJECT_DIR}"
mkdir -p "${PROJECT_DIR}"
chown -R "${OWNER_USER}:${OWNER_GROUP}" "${PROJECT_DIR}"
chmod 2775 "${PROJECT_DIR}"
ok "$(stat -c '%U:%G %a' "${PROJECT_DIR}")  ${PROJECT_DIR}"

# --- 2. Directory dei segreti ------------------------------------------------
say "2/5  Directory di configurazione ${CONFIG_DIR}"
mkdir -p "${CONFIG_DIR}"
chown "${OWNER_USER}:${OWNER_GROUP}" "${CONFIG_DIR}"
chmod 2750 "${CONFIG_DIR}"
ok "$(stat -c '%U:%G %a' "${CONFIG_DIR}")  ${CONFIG_DIR}"

# --- 3. Database -------------------------------------------------------------
say "3/5  Database MariaDB ${DB_NAME}"
DB_EXISTS="$(mariadb -N -B -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${DB_NAME}';")"
USER_EXISTS="$(mariadb -N -B -e "SELECT COUNT(*) FROM mysql.user WHERE User='${DB_USER}' AND Host='localhost';")"

if [[ -f "${CONFIG_FILE}" ]]; then
  # Config gia' presente: NON si tocca la password, si riusa quella del file.
  DB_PASS="$(php -r '$c=require "'"${CONFIG_FILE}"'"; echo $c["db"]["pass"] ?? "";')"
  if [[ -z "${DB_PASS}" ]]; then
    echo "Config presente ma senza password DB leggibile: intervento manuale richiesto." >&2
    exit 1
  fi
  warn "config.php gia' presente: riuso la password esistente (nessuna rigenerazione)."
else
  DB_PASS="$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | head -c 28)"
fi

mariadb -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mariadb -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mariadb -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mariadb -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
mariadb -e "FLUSH PRIVILEGES;"
[[ "${DB_EXISTS}" == "0" ]] && ok "database creato" || ok "database gia' esistente (conservato)"
[[ "${USER_EXISTS}" == "0" ]] && ok "utente creato" || ok "utente gia' esistente (password riallineata al config)"

# --- 4. Configurazioni con i segreti -----------------------------------------
say "4/5  ${CONFIG_FILE} e ${SERVER_ENV}"

# Il segreto dei biglietti e' UNO solo e deve coincidere nei due file: se uno
# dei due esiste gia', si riusa il suo; si genera solo se mancano entrambi.
SEGRETO=""
if [[ -f "${CONFIG_FILE}" ]]; then
  SEGRETO="$(php -r '$c=require "'"${CONFIG_FILE}"'"; echo $c["gioco"]["segreto_biglietti"] ?? "";')"
fi
if [[ -z "${SEGRETO}" && -f "${SERVER_ENV}" ]]; then
  SEGRETO="$(grep -E '^TERMOCLINO_SEGRETO_BIGLIETTI=' "${SERVER_ENV}" | cut -d= -f2- || true)"
fi
if [[ -z "${SEGRETO}" ]]; then
  SEGRETO="$(openssl rand -hex 32)"
  ok "segreto dei biglietti generato"
else
  ok "segreto dei biglietti gia' presente: riusato"
fi

if [[ -f "${CONFIG_FILE}" ]]; then
  ok "config.php gia' presente: lasciato intatto"
  if ! grep -q "segreto_biglietti" "${CONFIG_FILE}"; then
    warn "ATTENZIONE: config.php non ha la sezione 'gioco'. Aggiungila a mano copiandola"
    warn "da web/config/config.example.php, con segreto_biglietti uguale a quello di server.env."
  fi
else
  cat > "${CONFIG_FILE}" <<PHPEOF
<?php

declare(strict_types=1);

/**
 * Termoclino — configurazione con i segreti. FUORI dal DocumentRoot.
 * Generato da deploy/00-bootstrap.sh il ${STAMP}.
 */

return [
    'app' => [
        'name'        => 'Termoclino',
        'env'         => 'production',
        'debug'       => false,
        'timezone'    => 'Europe/Rome',
        'pretty_urls' => true,
        'base_path'   => null,
        'public_url'  => 'https://${PUBLIC_HOST}/termoclino',
    ],

    // Il server di gioco. Il segreto coincide con TERMOCLINO_SEGRETO_BIGLIETTI
    // in ${SERVER_ENV}: se lo cambi qui, cambialo anche la'.
    'gioco' => [
        'ws_url'            => '/termoclino/ws',
        'salute_url'        => 'http://127.0.0.1:8095/salute',
        'segreto_biglietti' => '${SEGRETO}',
    ],

    'db' => [
        'host'    => '127.0.0.1',
        'port'    => 3306,
        'name'    => '${DB_NAME}',
        'user'    => '${DB_USER}',
        'pass'    => '${DB_PASS}',
        'charset' => 'utf8mb4',
    ],

    'security' => [
        'session_name' => 'termoclino_sess',
        'session_ttl'  => 60 * 60 * 8,
    ],

    // Trasporto e-mail: 'log' finche' non si compilano le credenziali Brevo.
    // Le chiavi reali si copiano dal config di un altro gioco del server:
    // stesso account Brevo, stesso mittente verificato del forum.
    'mail' => [
        'transport'   => 'log',   // 'smtp' dopo aver messo le credenziali Brevo
        'smtp_host'   => 'smtp-relay.brevo.com',
        'smtp_port'   => 587,
        'smtp_secure' => 'tls',
        'smtp_user'   => 'CAMBIAMI',
        'smtp_pass'   => 'CAMBIAMI',
        'from_email'  => 'CAMBIAMI',   // deve essere un mittente verificato in Brevo
        'from_name'   => 'Termoclino',
        'timeout'     => 15,
    ],

    'notify' => [
        'new_registration' => true,
        'admin_email'      => '${ADMIN_EMAIL}',
    ],
];
PHPEOF
  chown "${OWNER_USER}:${OWNER_GROUP}" "${CONFIG_FILE}"
  chmod 0640 "${CONFIG_FILE}"
  ok "config.php creato ($(stat -c '%U:%G %a' "${CONFIG_FILE}"))"
fi

if [[ -f "${SERVER_ENV}" ]]; then
  ok "server.env gia' presente: lasciato intatto"
else
  cat > "${SERVER_ENV}" <<ENVEOF
# Termoclino — ambiente del server di gioco (docker compose: env_file).
# Generato da deploy/00-bootstrap.sh il ${STAMP}. FUORI dal DocumentRoot.
TERMOCLINO_SEGRETO_BIGLIETTI=${SEGRETO}
TERMOCLINO_HOST=127.0.0.1
TERMOCLINO_PORTA=8095
TERMOCLINO_ORIGINI=https://${PUBLIC_HOST},http://${PUBLIC_HOST}
TERMOCLINO_LOG=info
ENVEOF
  chown "${OWNER_USER}:${OWNER_GROUP}" "${SERVER_ENV}"
  chmod 0640 "${SERVER_ENV}"
  ok "server.env creato ($(stat -c '%U:%G %a' "${SERVER_ENV}"))"
fi

# --- 5. Apache ---------------------------------------------------------------
say "5/5  Configurazione Apache"
if [[ ! -f "${APACHE_CONF_SRC}" ]]; then
  echo "Manca ${APACHE_CONF_SRC}" >&2
  exit 1
fi
BACKUP=""
if [[ -f "${APACHE_CONF_DST}" ]]; then
  BACKUP="${APACHE_CONF_DST}.bak-${STAMP}"
  cp -a "${APACHE_CONF_DST}" "${BACKUP}"
  ok "backup: ${BACKUP}"
fi
install -m 0644 -o root -g root "${APACHE_CONF_SRC}" "${APACHE_CONF_DST}"
a2enmod rewrite proxy proxy_wstunnel >/dev/null 2>&1 || true
a2enconf termoclino >/dev/null
if apache2ctl configtest 2>&1 | tail -1 | grep -q "Syntax OK"; then
  systemctl reload apache2
  ok "configtest OK, apache2 ricaricato"
else
  warn "configtest FALLITO: rimetto com'era e non ricarico. Output:"
  apache2ctl configtest || true
  if [[ -n "${BACKUP}" ]]; then
    install -m 0644 -o root -g root "${BACKUP}" "${APACHE_CONF_DST}"
  else
    a2disconf termoclino >/dev/null 2>&1 || true
    rm -f "${APACHE_CONF_DST}"
  fi
  exit 1
fi

say "Fatto."
cat <<SUMMARY
    Progetto : ${PROJECT_DIR}          (${OWNER_USER}:${OWNER_GROUP}, 2775)
    Segreti  : ${CONFIG_FILE}  e  ${SERVER_ENV}
    Database : ${DB_NAME} / utente ${DB_USER} @localhost
    URL      : https://${PUBLIC_HOST}/termoclino/

    Le password e il segreto stanno SOLO in quei due file (0640). Non compaiono nei log.
    Passo successivo, SENZA sudo, dalla cartella del progetto:
      bash deploy/02-pubblica.sh

    Il battito va nel crontab di ${OWNER_USER} (NON in quello di root):
      * * * * * /usr/bin/php ${PROJECT_DIR}/bin/tick.php >/dev/null 2>&1
SUMMARY
