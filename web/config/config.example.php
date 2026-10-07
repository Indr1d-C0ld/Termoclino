<?php

declare(strict_types=1);

/**
 * MODELLO di configurazione — solo segnaposto, nessun segreto.
 *
 * Il file vero lo genera deploy/00-bootstrap.sh in
 *   /data/termoclino-config/config.php
 * L'app lo cerca, in ordine: $TERMOCLINO_CONFIG, /etc/termoclino/config.php,
 * /data/termoclino-config/config.php, <progetto>/config/config.php.
 */

return [
    'app' => [
        'name'        => 'Termoclino',
        'env'         => 'production',
        'debug'       => false,
        'timezone'    => 'Europe/Rome',
        'pretty_urls' => true,
        'base_path'   => null,
        'public_url'  => 'https://example.com/termoclino',
    ],

    // Il server di gioco (Node, in Docker). Il segreto dei biglietti deve
    // coincidere con TERMOCLINO_SEGRETO_BIGLIETTI in server.env: lo scrivono
    // insieme deploy/00-bootstrap.sh, una volta sola.
    'gioco' => [
        'ws_url'            => '/termoclino/ws',               // per il browser
        'salute_url'        => 'http://127.0.0.1:8095/salute', // per PHP, dalla macchina stessa
        'segreto_biglietti' => 'CAMBIAMI-almeno-32-caratteri-casuali',
    ],

    'db' => [
        'host'    => '127.0.0.1',
        'port'    => 3306,
        'name'    => 'trm_termoclino',
        'user'    => 'trm_termoclino',
        'pass'    => 'CAMBIAMI',
        'charset' => 'utf8mb4',
    ],

    'security' => [
        'session_name' => 'termoclino_sess',
        'session_ttl'  => 60 * 60 * 8,
    ],

    // 'log' scrive su storage/logs/app.log invece di spedire davvero.
    'mail' => [
        'transport'   => 'log',
        'smtp_host'   => 'smtp-relay.brevo.com',
        'smtp_port'   => 587,
        'smtp_secure' => 'tls',
        'smtp_user'   => 'CAMBIAMI',
        'smtp_pass'   => 'CAMBIAMI',
        'from_email'  => 'CAMBIAMI',   // mittente verificato dal provider
        'from_name'   => 'Termoclino',
        'timeout'     => 15,
    ],

    'notify' => [
        'new_registration' => true,
        'admin_email'      => 'admin@example.com',
    ],
];
