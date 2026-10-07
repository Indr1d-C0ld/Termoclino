<?php

declare(strict_types=1);

namespace App\Gioco;

use App\Core\Config;

/**
 * Cio' che PHP sa del server di gioco: dove sta e se e' vivo.
 *
 * Due indirizzi diversi, di proposito:
 *  - `gioco.ws_url` e' quello che usa il BROWSER (pubblico, dietro Apache,
 *    sotto sottopercorso per via dell'HSTS del vhost);
 *  - `gioco.salute_url` e' quello che usa PHP dalla macchina stessa, senza
 *    passare da Apache.
 */
final class ServerDiGioco
{
    /**
     * Indirizzo WebSocket per il browser. Se in configurazione e' un percorso
     * («/termoclino/ws»), lo si completa con schema e host della richiesta.
     */
    public static function wsUrl(): string
    {
        $u = (string) Config::get('gioco.ws_url', '/termoclino/ws');
        if (preg_match('#^wss?://#', $u) === 1) {
            return $u;
        }
        $https = (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
        return ($https ? 'wss://' : 'ws://') . $host . '/' . ltrim($u, '/');
    }

    /**
     * Stato riportato dalla sonda /salute del server di gioco, o null se non
     * risponde entro un secondo. Mai un'eccezione: la pagina che chiede deve
     * poter dire «il server di gioco e' spento» invece di cadere anche lei.
     *
     * @return array<string,mixed>|null
     */
    public static function salute(): ?array
    {
        $u = (string) Config::get('gioco.salute_url', 'http://127.0.0.1:8095/salute');
        $ctx = stream_context_create(['http' => ['timeout' => 1.0, 'ignore_errors' => true]]);
        $corpo = @file_get_contents($u, false, $ctx);
        if ($corpo === false) {
            return null;
        }
        $j = json_decode($corpo, true);
        return is_array($j) && ($j['ok'] ?? false) === true ? $j : null;
    }
}
