<?php

declare(strict_types=1);

namespace App\Auth;

use App\Core\Config;
use App\Core\Database;
use App\Core\GameConfig;
use App\Core\Posta;

/**
 * Le e-mail dell'iscrizione. Testo semplice: il Mailer non fa HTML, e queste
 * righe sono la prima cosa che una persona legge di Termoclino. Il tono e'
 * quello di un biglietto lasciato nella cassetta della posta, non di un
 * messaggio di servizio.
 */
final class AuthMail
{
    /** URL assoluto pubblico: nei collegamenti delle e-mail non si puo' usare quello relativo. */
    private static function publicUrl(string $path = '/'): string
    {
        $base = rtrim((string) Config::get('app.public_url', ''), '/');
        return $base . '/' . ltrim($path, '/');
    }

    private static function nomeGioco(): string
    {
        return (string) Config::get('app.name', 'Termoclino');
    }

    /** @return array{ok:bool, error?:string} */
    /**
     * Il collegamento per rifare la password. Stesso tono della conferma, e
     * la stessa priorita': e' l'unica porta per chi e' rimasto fuori.
     *
     * @return array{ok:bool, error?:string}
     */
    public static function sendRecupero(int $userId, string $email, string $username, string $token): array
    {
        $link  = self::publicUrl('/recupero?token=' . $token);
        $ttl   = GameConfig::int('auth.recupero_ttl_ore', 2);
        $gioco = self::nomeGioco();
        $ore   = $ttl === 1 ? "un'ora" : "{$ttl} ore";

        $subject = "{$gioco} — rifare la password";
        $body = <<<TXT
        {$username},

        qualcuno ha chiesto di rifare la password di questo account. Se sei
        tu, apri questo collegamento e scegline una nuova:

        {$link}

        Il collegamento vale {$ore} e si usa una volta sola. Appena la password
        cambia, tutte le sessioni gia' aperte si chiudono: se qualcuno era
        entrato al posto tuo, si ritrova fuori.

        Se non hai chiesto niente, non devi fare niente: senza questo
        collegamento la password resta quella di prima.

        Buona caccia.

        --
        {$gioco} — simulatore di sottomarini della Guerra Fredda,
        tributo amatoriale a 688 Attack Sub (1989)
        Messaggio automatico: non rispondere a questo indirizzo.
        TXT;

        $res = Posta::invia($email, $subject, $body, 'recupero', 1);
        if (!$res['ok']) {
            logger('recupero per utente ' . $userId . ' messo in coda: ' . ($res['error'] ?? '?'), 'warning');
        }
        return $res;
    }

    public static function sendVerification(int $userId, string $email, string $username, string $token): array
    {
        $link  = self::publicUrl('/conferma?token=' . $token);
        $ttl   = GameConfig::int('auth.verify_ttl_hours', 48);
        $gioco = self::nomeGioco();

        $subject = "{$gioco} — conferma il tuo indirizzo";
        $body = <<<TXT
        {$username},

        qualcuno con il tuo indirizzo ha appena chiesto di arruolarsi a bordo.
        Se sei tu, conferma aprendo questo collegamento:

        {$link}

        Il collegamento vale {$ttl} ore. Se scade puoi chiederne un altro dalla
        pagina di accesso.

        Se non hai chiesto niente, ignora questo messaggio: senza conferma
        l'iscrizione non viene attivata e l'indirizzo non resta a nessuno.

        Buona caccia.

        --
        {$gioco} — simulatore di sottomarini della Guerra Fredda,
        tributo amatoriale a 688 Attack Sub (1989)
        Messaggio automatico: non rispondere a questo indirizzo.
        TXT;

        // Priorita' 1: e' l'unica porta d'ingresso al gioco. Se l'SMTP non
        // risponde adesso, il messaggio resta in coda e riparte da solo.
        $res = Posta::invia($email, $subject, $body, 'conferma', 1);

        // Il contatore segna quando il messaggio e' stato PRESO IN CARICO:
        // e' quello che regola il freno sui rinvii.
        Database::run(
            'UPDATE users SET verify_sent_at = NOW(), verify_count = verify_count + 1 WHERE id = ?',
            [$userId]
        );
        if (!$res['ok']) {
            logger('conferma per utente ' . $userId . ' messa in coda: ' . ($res['error'] ?? '?'), 'warning');
        }
        return $res;
    }

    /**
     * Avviso all'amministratore. Non deve mai bloccare l'iscrizione: se
     * fallisce, resta solo una riga di diario.
     */
    public static function notifyAdmin(int $userId, string $username, string $email): void
    {
        if (!Config::get('notify.new_registration', true)) {
            return;
        }
        $to = (string) Config::get('notify.admin_email', '');
        if ($to === '') {
            return;
        }
        $gioco = self::nomeGioco();

        $body = <<<TXT
        Nuova iscrizione a {$gioco}.

          utente : {$username}
          e-mail : {$email}
          id     : {$userId}
          quando : %s

        L'account resta 'pending' finche' l'interessato non conferma
        l'indirizzo dal collegamento ricevuto.

        Console: php bin/console.php user:list
        TXT;

        // Priorita' bassa: l'amministratore puo' aspettare, chi si iscrive no.
        Posta::invia($to, "{$gioco} — nuova iscrizione: {$username}", sprintf($body, fmt_dt(time())), 'avviso_admin', 7);
        Database::run('UPDATE users SET admin_notified_at = NOW() WHERE id = ?', [$userId]);
    }
}
