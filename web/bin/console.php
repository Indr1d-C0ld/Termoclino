<?php

declare(strict_types=1);

/**
 * Termoclino — console di servizio.
 *
 *   php bin/console.php <comando> [argomenti]
 *
 * Tutto cio' che non si fa dal browser si fa da qui: migrazioni, account,
 * prove della posta, impostazioni a caldo.
 */

$projectRoot = require __DIR__ . '/_bootstrap.php';

use App\Auth\Auth;
use App\Auth\AuthMail;
use App\Cli\Migrator;
use App\Core\Config;
use App\Core\Database;
use App\Core\GameConfig;
use App\Core\Posta;
use App\Gioco\ServerDiGioco;

$argv = $_SERVER['argv'] ?? [];
$cmd  = $argv[1] ?? 'aiuto';
$args = array_slice($argv, 2);

/**
 * Stampa una riga.
 *
 * Se chi legge se ne va — tipicamente perche' l'uscita e' incanalata in `head`
 * — scrivere su un tubo chiuso genera un avviso per ogni riga rimasta. Un
 * comando di servizio non deve vomitare venti avvisi solo perche' qualcuno ne
 * voleva leggere le prime cinque righe: si smette e basta.
 */
function riga(string $s = ''): void
{
    if (@fwrite(STDOUT, $s . "\n") === false) {
        exit(0);
    }
}

function errore(string $s): never
{
    fwrite(STDERR, "errore: {$s}\n");
    exit(1);
}

/**
 * Riempimento a larghezza fissa che conta i CARATTERI, non i byte.
 *
 * sprintf('%-9s') conta byte: «mercoledì» occupa dieci byte per nove
 * caratteri, e le colonne della console si disallineano appena compare una
 * lettera accentata — cioè sempre, in italiano.
 */
function col(string $s, int $largo, bool $destra = false): string
{
    return mb_str_pad($s, $largo, ' ', $destra ? STR_PAD_LEFT : STR_PAD_RIGHT);
}

/** Domanda con risposta nascosta (password). */
function chiediSegreto(string $prompt): string
{
    fwrite(STDOUT, $prompt);
    if (function_exists('shell_exec') && stripos(PHP_OS_FAMILY, 'win') === false) {
        @shell_exec('stty -echo 2>/dev/null');
    }
    $v = rtrim((string) fgets(STDIN), "\r\n");
    if (function_exists('shell_exec') && stripos(PHP_OS_FAMILY, 'win') === false) {
        @shell_exec('stty echo 2>/dev/null');
    }
    fwrite(STDOUT, "\n");
    return $v;
}

try {
    switch ($cmd) {

        // --- Schema ----------------------------------------------------------
        case 'migrate':
            riga('Migrazioni:');
            foreach ((new Migrator($projectRoot . '/db/migrations'))->migrate() as $l) {
                riga($l);
            }
            break;

        case 'status':
            riga('Termoclino — stato');
            riga('  configurazione : ' . Config::sourceFile());
            riga('  database       : ' . (string) Config::get('db.name'));
            $vivo = Database::isReachable();
            riga('  connessione    : ' . ($vivo ? 'ok' : 'NON raggiungibile — ' . (Database::lastError() ?? '?')));
            if (!$vivo) {
                break;
            }
            // `status` e' il comando che si lancia quando qualcosa non va: deve
            // rispondere anche PRIMA della prima migrazione, quando nessuna
            // delle tabelle esiste ancora. Altrimenti l'unico strumento di
            // diagnosi e' anche l'unico che non funziona.
            $applicate = Database::first("SHOW TABLES LIKE 'schema_migrations'") === null
                ? []
                : Database::all('SELECT version, applied_at FROM schema_migrations ORDER BY version');
            $suDisco   = array_map(
                static fn (string $f): string => basename($f, '.sql'),
                glob($projectRoot . '/db/migrations/*.sql') ?: []
            );
            $mancanti = array_diff($suDisco, array_column($applicate, 'version'));
            riga('  migrazioni     : ' . count($applicate) . ' applicate, ' . count($mancanti) . ' in attesa');
            foreach ($mancanti as $m) {
                riga('      in attesa: ' . $m);
            }
            if ($applicate === []) {
                riga('  (schema vuoto: lancia `php bin/console.php migrate`)');
                break;
            }
            riga('  utenti         : ' . (int) (Database::first('SELECT COUNT(*) n FROM users')['n'] ?? 0)
                . ' (' . (int) (Database::first("SELECT COUNT(*) n FROM users WHERE status='active'")['n'] ?? 0) . ' attivi)');
            $t = Database::first('SELECT started_at, ok, duration_ms FROM tick_runs ORDER BY id DESC LIMIT 1');
            riga('  ultimo battito : ' . ($t === null
                ? 'mai'
                : $t['started_at'] . ' — ' . ((int) $t['ok'] === 1 ? 'ok' : 'con guasti') . ', ' . $t['duration_ms'] . ' ms'));
            riga('  posta          : ' . json_encode(Posta::stato(), JSON_UNESCAPED_UNICODE));
            $g = ServerDiGioco::salute();
            riga('  server di gioco: ' . ($g === null
                ? 'NON risponde (' . (string) Config::get('gioco.salute_url', 'http://127.0.0.1:8095/salute') . ')'
                : 'ok, versione ' . ($g['versione'] ?? '?') . ', ' . ($g['connessioni'] ?? 0) . ' connessioni'));
            break;

        // --- Account ----------------------------------------------------------
        case 'user:list':
            $righe = Database::all(
                'SELECT id, username, email, status, role, created_at, last_login_at
                 FROM users ORDER BY id'
            );
            if ($righe === []) {
                riga('Nessun utente.');
                break;
            }
            riga(sprintf('%-5s %-24s %-32s %-10s %-10s %s', 'id', 'utente', 'e-mail', 'stato', 'ruolo', 'ultimo accesso'));
            foreach ($righe as $r) {
                riga(sprintf(
                    '%-5d %-24s %-32s %-10s %-10s %s',
                    (int) $r['id'], $r['username'], $r['email'], $r['status'], $r['role'],
                    $r['last_login_at'] ?? '—'
                ));
            }
            break;

        case 'user:create':
            $nome  = $args[0] ?? errore('uso: user:create <utente> <email> [--admin]');
            $email = $args[1] ?? errore('uso: user:create <utente> <email> [--admin]');
            $admin = in_array('--admin', $args, true);
            $pw    = chiediSegreto('Password: ');
            $pw2   = chiediSegreto('Ripeti:   ');
            if ($pw !== $pw2) {
                errore('le due password non coincidono');
            }
            $res = Auth::register($nome, $email, $pw);
            if (!$res['ok']) {
                errore((string) ($res['error'] ?? 'creazione non riuscita'));
            }
            // Creato da console: si da' per confermato, e' l'amministratore che lo fa a mano.
            Database::run(
                "UPDATE users SET status='active', email_verified_at=NOW(), role=? WHERE id=?",
                [$admin ? 'admin' : 'player', (int) $res['user_id']]
            );
            riga('Creato utente #' . $res['user_id'] . ' (' . ($admin ? 'admin' : 'giocatore') . '), gia\' attivo.');
            break;

        case 'user:admin':
            $chi = $args[0] ?? errore('uso: user:admin <utente|email>');
            $n = Database::run(
                "UPDATE users SET role='admin' WHERE username = ? OR email = ?",
                [Auth::normalizeUsername($chi), mb_strtolower($chi)]
            )->rowCount();
            riga($n > 0 ? "Ora {$chi} e' amministratore." : 'Nessun utente con quel nome.');
            break;

        case 'user:activate':
            $chi = $args[0] ?? errore('uso: user:activate <utente|email>');
            $n = Database::run(
                "UPDATE users SET status='active', email_verified_at = COALESCE(email_verified_at, NOW())
                 WHERE username = ? OR email = ?",
                [Auth::normalizeUsername($chi), mb_strtolower($chi)]
            )->rowCount();
            riga($n > 0 ? "Attivato: {$chi}." : 'Nessun utente con quel nome.');
            break;

        case 'user:password':
            $chi = $args[0] ?? errore('uso: user:password <utente|email>');
            $u = Database::first(
                'SELECT id FROM users WHERE username = ? OR email = ?',
                [Auth::normalizeUsername($chi), mb_strtolower($chi)]
            ) ?? errore('nessun utente con quel nome');
            $pw  = chiediSegreto('Nuova password: ');
            $pw2 = chiediSegreto('Ripeti:         ');
            if ($pw !== $pw2) {
                errore('le due password non coincidono');
            }
            if (mb_strlen($pw) < Auth::minPasswordLength()) {
                errore('troppo corta: servono almeno ' . Auth::minPasswordLength() . ' caratteri');
            }
            Database::run('UPDATE users SET password_hash = ? WHERE id = ?', [Auth::hashPassword($pw), (int) $u['id']]);
            riga('Password cambiata.');
            break;

        case 'user:delete':
            $chi = $args[0] ?? errore('uso: user:delete <utente|email>');
            $u = Database::first(
                'SELECT id, username FROM users WHERE username = ? OR email = ?',
                [Auth::normalizeUsername($chi), mb_strtolower($chi)]
            ) ?? errore('nessun utente con quel nome');
            fwrite(STDOUT, "Cancellare definitivamente «{$u['username']}» (#{$u['id']})? scrivi SI: ");
            if (rtrim((string) fgets(STDIN)) !== 'SI') {
                riga('Annullato.');
                break;
            }
            Database::run('DELETE FROM users WHERE id = ?', [(int) $u['id']]);
            riga('Cancellato.');
            break;

        // --- Posta -------------------------------------------------------------
        case 'mail:test':
            $to = $args[0] ?? (string) Config::get('notify.admin_email', '');
            if ($to === '') {
                errore('uso: mail:test <indirizzo>');
            }
            $res = Posta::invia(
                $to,
                'Termoclino — prova di posta',
                "Se leggi questo messaggio, la posta funziona.\n\nInviato il " . date('c') . ".\n",
                'prova',
                3
            );
            riga($res['ok'] ? "Inviato a {$to}." : 'In coda (o fallito): ' . ($res['error'] ?? '?'));
            break;

        case 'mail:queue':
            riga(json_encode(Posta::stato(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            foreach (Database::all(
                'SELECT id, destinatario, oggetto, genere, priorita, tentativi, prossimo_at, inviato_at, rinunciato_at, ultimo_errore
                 FROM mail_queue ORDER BY id DESC LIMIT 20'
            ) as $m) {
                riga(sprintf(
                    '  #%-5d %-28s pri%-2d tent%-2d %-20s %s',
                    (int) $m['id'],
                    mb_substr((string) $m['destinatario'], 0, 28),
                    (int) $m['priorita'],
                    (int) $m['tentativi'],
                    $m['inviato_at'] ?? ($m['rinunciato_at'] !== null ? 'RINUNCIATO' : 'in attesa'),
                    (string) ($m['ultimo_errore'] ?? '')
                ));
            }
            break;

        case 'mail:flush':
            riga(json_encode(Posta::smista((int) ($args[0] ?? 20)), JSON_UNESCAPED_UNICODE));
            break;

        // --- Il mondo --------------------------------------------------------------
        case 'config:get':
            if (isset($args[0])) {
                var_export(GameConfig::get($args[0]));
                riga();
                break;
            }
            foreach (GameConfig::all() as $k => $v) {
                riga(sprintf('  %-28s %-8s %s', $k, $v['type'], $v['value']));
            }
            break;

        case 'config:set':
            $k = $args[0] ?? errore('uso: config:set <chiave> <valore> [tipo]');
            $v = $args[1] ?? errore('uso: config:set <chiave> <valore> [tipo]');
            GameConfig::set($k, $v, $args[2] ?? 'string');
            riga("Impostato {$k} = {$v}");
            break;

        // --- Aiuto ----------------------------------------------------------------
        case 'aiuto':
        case '--help':
        case '-h':
        default:
            riga('Termoclino — console');
            riga('');
            riga('  Schema');
            riga('    migrate                        applica le migrazioni in attesa');
            riga('    status                         configurazione, schema, utenti, battito, posta, server di gioco');
            riga('');
            riga('  Account');
            riga('    user:list                      elenco degli utenti');
            riga('    user:create <nome> <email> [--admin]');
            riga('    user:admin <nome|email>        promuove ad amministratore');
            riga('    user:activate <nome|email>     attiva senza passare dalla conferma');
            riga('    user:password <nome|email>     cambia la password');
            riga('    user:delete <nome|email>       cancella definitivamente');
            riga('');
            riga('  Posta');
            riga('    mail:test [indirizzo]          manda un messaggio di prova');
            riga('    mail:queue                     stato della coda e ultimi venti messaggi');
            riga('    mail:flush [n]                 tenta n messaggi in coda');
            riga('');
            riga('  Impostazioni a caldo');
            riga('    config:get [chiave]            legge le chiavi di game_config');
            riga('    config:set <chiave> <valore> [tipo]');
            if ($cmd !== 'aiuto' && $cmd !== '--help' && $cmd !== '-h') {
                riga('');
                errore("comando sconosciuto: {$cmd}");
            }
            break;
    }
} catch (\Throwable $e) {
    errore($e->getMessage());
}
