<?php

declare(strict_types=1);

/**
 * Configurazione di SVILUPPO che punta la plancia al finto server di gioco
 * (tests/strumenti/finto_server.mjs) invece che al server vero.
 *
 * Non contiene segreti: carica la configurazione di sviluppo del progetto
 * (web/config/config.php, fuori dal repo) e cambia solo l'indirizzo del
 * WebSocket. Cambiandolo qui cambia anche la Content-Security-Policy della
 * pagina (connect-src), che altrimenti bloccherebbe il collegamento.
 *
 *   node tests/strumenti/finto_server.mjs --porta 8197 &
 *   TERMOCLINO_CONFIG=$PWD/tests/strumenti/config_finto_server.php \
 *     php -S 127.0.0.1:8161 -t web web/index.php
 *   # poi http://127.0.0.1:8161/plancia
 *
 * FINTO_WS sceglie un'altra porta del finto server. Mai 8095 (produzione).
 */

$base = require dirname(__DIR__, 2) . '/web/config/config.php';
$base['gioco']['ws_url'] = getenv('FINTO_WS') ?: 'ws://127.0.0.1:8197/';
return $base;
