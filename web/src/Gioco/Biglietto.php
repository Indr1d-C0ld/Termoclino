<?php

declare(strict_types=1);

namespace App\Gioco;

use App\Core\Config;
use RuntimeException;

/**
 * Il biglietto per salire a bordo: la prova, firmata da PHP, che chi apre il
 * WebSocket verso il server di gioco e' un utente collegato e attivo.
 *
 * Il server di gioco (Node) non legge le sessioni PHP e non vede password:
 * riceve solo questo biglietto, ne controlla la firma con lo stesso segreto e
 * lega l'utente alla connessione. Il formato e' il contratto fra i due mondi,
 * e la sua controparte sta in `shared/protocol.js` (`verificaBiglietto`): se
 * cambia qui, cambia la' — le prove `tests/e2e_bordo.sh` e
 * `shared/test/protocol.test.js` usano lo stesso vettore di prova per accorgersene.
 *
 *   biglietto = b64url(json(carico)) "." b64url(HMAC-SHA256(segreto, b64url(json(carico))))
 *   carico    = {v:1, uid, nome, ruolo, exp, nonce}
 *
 * Vale 60 secondi e il nonce lo rende monouso: chi lo intercetta in un log non
 * fa in tempo a usarlo, e comunque non due volte.
 */
final class Biglietto
{
    public const VERSIONE = 1;
    public const DURATA_SECONDI = 60;

    /**
     * @param array{id:int|string, username:string, role:string} $utente
     */
    public static function emetti(array $utente, ?int $adesso = null): string
    {
        $adesso ??= time();
        $carico = [
            'v'     => self::VERSIONE,
            'uid'   => (int) $utente['id'],
            'nome'  => (string) $utente['username'],
            'ruolo' => (string) $utente['role'],
            'exp'   => $adesso + self::DURATA_SECONDI,
            'nonce' => bin2hex(random_bytes(12)),
        ];
        return self::firma($carico, self::segreto());
    }

    /**
     * Firma un carico gia' pronto. Pubblica per le prove: con un carico e un
     * segreto fissi il risultato deve coincidere byte per byte con quello di
     * `shared/protocol.js`.
     *
     * @param array<string,mixed> $carico
     */
    public static function firma(array $carico, string $segreto): string
    {
        $json = json_encode($carico, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $corpo = self::b64url($json);
        $sigillo = self::b64url(hash_hmac('sha256', $corpo, $segreto, true));
        return $corpo . '.' . $sigillo;
    }

    private static function segreto(): string
    {
        $s = (string) Config::get('gioco.segreto_biglietti', '');
        // Un segreto corto o lasciato al segnaposto renderebbe i biglietti
        // falsificabili: meglio una pagina d'errore che un ponte aperto.
        if (strlen($s) < 32 || str_contains($s, 'CAMBIAMI')) {
            throw new RuntimeException('Segreto dei biglietti assente o troppo corto (gioco.segreto_biglietti).');
        }
        return $s;
    }

    private static function b64url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}
