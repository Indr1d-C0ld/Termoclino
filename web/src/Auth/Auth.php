<?php

declare(strict_types=1);

namespace App\Auth;

use App\Core\Database;
use App\Core\GameConfig;
use App\Core\Session;
use App\Support\Audit;

/**
 * Autenticazione: registrazione, verifica dell'indirizzo, accesso, uscita.
 *
 * Regola d'ingresso: nessuno entra senza aver confermato l'indirizzo e-mail.
 * L'utente resta 'pending' finche' non clicca il collegamento ricevuto.
 */
final class Auth
{
    private const SESSION_KEY = 'uid';
    /** La generazione delle sessioni con cui questa sessione e' nata. */
    private const SESSION_GEN = 'uid_gen';

    /** @var array<string,mixed>|null cache per richiesta */
    private static ?array $cached = null;
    private static bool $resolved = false;

    // --- Stato ---------------------------------------------------------------

    /** @return array<string,mixed>|null */
    public static function user(): ?array
    {
        if (self::$resolved) {
            return self::$cached;
        }
        self::$resolved = true;

        $id = Session::get(self::SESSION_KEY);
        if (!is_int($id) && !(is_string($id) && ctype_digit($id))) {
            return self::$cached = null;
        }

        $row = Database::first(
            'SELECT id, username, email, status, role, email_verified_at, created_at, last_login_at, sessioni_gen
             FROM users WHERE id = ?',
            [(int) $id]
        );

        if ($row === null || in_array((string) $row['status'], ['banned', 'suspended'], true)) {
            Session::forget(self::SESSION_KEY);
            return self::$cached = null;
        }

        // Una sessione nata prima che la password venisse rifatta non vale
        // piu'. E' la meta' del recupero che si dimentica sempre: la password
        // la si rifa' quasi sempre perche' qualcun altro e' entrato, e se la
        // sua sessione restasse aperta la password nuova non servirebbe a niente.
        if ((int) Session::get(self::SESSION_GEN, 0) < (int) $row['sessioni_gen']) {
            Session::forget(self::SESSION_KEY);
            Session::forget(self::SESSION_GEN);
            return self::$cached = null;
        }

        return self::$cached = $row;
    }

    public static function check(): bool
    {
        return self::user() !== null;
    }

    public static function id(): ?int
    {
        $u = self::user();
        return $u === null ? null : (int) $u['id'];
    }

    public static function status(): string
    {
        $u = self::user();
        return $u === null ? 'guest' : (string) $u['status'];
    }

    public static function isAdmin(): bool
    {
        $u = self::user();
        return $u !== null && (string) $u['role'] === 'admin';
    }

    public static function isVerified(): bool
    {
        $u = self::user();
        return $u !== null && $u['email_verified_at'] !== null;
    }

    // --- Regole --------------------------------------------------------------

    public static function minPasswordLength(): int
    {
        return max(6, GameConfig::int('auth.min_password_length', 9));
    }

    public static function registrationOpen(): bool
    {
        return GameConfig::bool('auth.registration_open', true);
    }

    public static function hashPassword(string $plain): string
    {
        if (defined('PASSWORD_ARGON2ID')) {
            return password_hash($plain, PASSWORD_ARGON2ID, ['memory_cost' => 65536, 'time_cost' => 4, 'threads' => 2]);
        }
        return password_hash($plain, PASSWORD_DEFAULT, ['cost' => 12]);
    }

    /**
     * Ripulisce un nome utente prima di validarlo o cercarlo: toglie gli spazi
     * ai bordi e riduce a una sola ogni sequenza di spaziatura, comprese quelle
     * insidiose (tabulazione, spazio unificatore U+00A0). Senza questo passaggio
     * "Mario  Rossi" e "Mario Rossi" sarebbero due account distinti e
     * indistinguibili a occhio.
     */
    public static function normalizeUsername(string $u): string
    {
        $u = preg_replace('/[\p{Z}\s]+/u', ' ', $u) ?? $u;
        return trim($u);
    }

    /**
     * Nome utente: lettere (accentate comprese), cifre, spazio, apostrofo,
     * punto, trattino, underscore. Da 3 a 32 caratteri, e deve cominciare e
     * finire con una lettera o una cifra: cosi' "Mario Rossi" va bene, " -_ " no.
     */
    public static function validateUsername(string $u): ?string
    {
        $u = self::normalizeUsername($u);

        if (mb_strlen($u) < 3 || mb_strlen($u) > 32) {
            return 'Il nome utente deve avere da 3 a 32 caratteri.';
        }
        if (!preg_match('/^[\p{L}\p{N}][\p{L}\p{N} .\x27_-]*[\p{L}\p{N}]$/u', $u)) {
            return 'Il nome utente puo\' contenere lettere, cifre, spazi, apostrofo, punto, trattino '
                . 'e underscore, e deve cominciare e finire con una lettera o una cifra.';
        }
        return null;
    }

    // --- Registrazione -------------------------------------------------------

    /**
     * Crea l'account in stato 'pending' e restituisce il gettone di verifica in chiaro
     * (che esiste solo in questo istante: in tabella ne va l'hash).
     *
     * @return array{ok:bool, error?:string, user_id?:int, token?:string}
     */
    public static function register(string $username, string $email, string $password, ?string $ip = null): array
    {
        $username = self::normalizeUsername($username);
        $email    = mb_strtolower(trim($email));

        if (!self::registrationOpen()) {
            return ['ok' => false, 'error' => 'Le registrazioni sono momentaneamente chiuse.'];
        }
        if ($err = self::validateUsername($username)) {
            return ['ok' => false, 'error' => $err];
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'Indirizzo e-mail non valido.'];
        }
        $min = self::minPasswordLength();
        if (mb_strlen($password) < $min) {
            return ['ok' => false, 'error' => "La password deve avere almeno {$min} caratteri."];
        }

        $clash = Database::first('SELECT id, username, email FROM users WHERE username = ? OR email = ?', [$username, $email]);
        if ($clash !== null) {
            return ['ok' => false, 'error' => (string) $clash['username'] === $username
                ? 'Questo nome utente è già in uso.'
                : 'Esiste già un account con questo indirizzo e-mail.'];
        }

        Database::run(
            'INSERT INTO users (username, email, password_hash, status) VALUES (?, ?, ?, ?)',
            [$username, $email, self::hashPassword($password), 'pending']
        );
        $userId = Database::lastInsertId();

        $token = self::issueToken($userId, 'verify_email', $ip);
        Audit::log('auth.register', $userId, 'user', $userId, ['username' => $username], $ip);

        return ['ok' => true, 'user_id' => $userId, 'token' => $token];
    }

    /** Genera un gettone monouso, ne salva l'hash e restituisce il valore in chiaro. */
    public static function issueToken(int $userId, string $kind, ?string $ip = null): string
    {
        $token = bin2hex(random_bytes(32));
        // Un collegamento di conferma puo' aspettare due giorni; uno per
        // rifare la password no: se finisce nelle mani sbagliate, deve
        // scadere presto.
        $ttl   = max(1, $kind === 'reset_password'
            ? GameConfig::int('auth.recupero_ttl_ore', 2)
            : GameConfig::int('auth.verify_ttl_hours', 48));

        // Un solo gettone vivo per tipo: i precedenti vengono invalidati.
        Database::run(
            'UPDATE user_tokens SET used_at = NOW() WHERE user_id = ? AND kind = ? AND used_at IS NULL',
            [$userId, $kind]
        );
        Database::run(
            'INSERT INTO user_tokens (user_id, kind, token_hash, expires_at, created_ip)
             VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?)',
            [$userId, $kind, hash('sha256', $token), $ttl, $ip !== null ? @inet_pton($ip) ?: null : null]
        );
        return $token;
    }

    /**
     * Consuma il gettone di verifica e attiva l'account.
     *
     * @return array{ok:bool, error?:string, user?:array<string,mixed>}
     */
    public static function verifyEmail(string $token, ?string $ip = null): array
    {
        $token = trim($token);
        if ($token === '' || !ctype_xdigit($token)) {
            return ['ok' => false, 'error' => 'Collegamento di verifica non valido.'];
        }

        $row = Database::first(
            'SELECT t.id, t.user_id, t.used_at, t.expires_at, u.status, u.username, u.email
             FROM user_tokens t JOIN users u ON u.id = t.user_id
             WHERE t.token_hash = ? AND t.kind = ?',
            [hash('sha256', $token), 'verify_email']
        );

        if ($row === null) {
            return ['ok' => false, 'error' => 'Collegamento di verifica non valido.'];
        }
        if ($row['used_at'] !== null) {
            // Gia' usato: se l'account e' attivo non e' un errore, e' un doppio clic.
            if ((string) $row['status'] === 'active') {
                return ['ok' => true, 'user' => $row];
            }
            return ['ok' => false, 'error' => 'Questo collegamento è già stato utilizzato.'];
        }
        if (strtotime((string) $row['expires_at']) < time()) {
            return ['ok' => false, 'error' => 'Il collegamento è scaduto. Richiedine uno nuovo dalla pagina di accesso.'];
        }

        Database::run('UPDATE user_tokens SET used_at = NOW() WHERE id = ?', [(int) $row['id']]);
        Database::run(
            "UPDATE users SET status = 'active', email_verified_at = NOW() WHERE id = ? AND status = 'pending'",
            [(int) $row['user_id']]
        );
        Audit::log('auth.verify_email', (int) $row['user_id'], 'user', (int) $row['user_id'], [], $ip);

        return ['ok' => true, 'user' => $row];
    }

    // --- Accesso -------------------------------------------------------------

    /**
     * @return array{ok:bool, error?:string, need_verify?:bool, user?:array<string,mixed>}
     */
    public static function attempt(string $login, string $password, ?string $ip = null): array
    {
        // Normalizzato come in registrazione: la spaziatura digitata a caso non
        // deve impedire l'accesso. Un indirizzo e-mail non contiene spazi,
        // quindi il passaggio e' innocuo anche quando si entra con quello.
        $login = self::normalizeUsername($login);
        $row = Database::first(
            'SELECT id, username, email, password_hash, status, role, sessioni_gen FROM users WHERE username = ? OR email = ?',
            [$login, mb_strtolower($login)]
        );

        // Confronto sempre eseguito anche senza utente: nessuna differenza di tempo
        // fra "utente inesistente" e "password errata".
        $hash = (string) ($row['password_hash'] ?? '$2y$12$' . str_repeat('x', 53));
        $okPw = password_verify($password, $hash);

        if ($row === null || !$okPw) {
            Audit::log('auth.login_failed', $row === null ? null : (int) $row['id'], 'user', null, ['login' => $login], $ip);
            return ['ok' => false, 'error' => 'Nome utente o password non corretti.'];
        }

        $status = (string) $row['status'];
        if ($status === 'pending') {
            return ['ok' => false, 'need_verify' => true,
                    'error' => 'Devi prima confermare il tuo indirizzo e-mail: controlla la posta.'];
        }
        if ($status === 'suspended') {
            return ['ok' => false, 'error' => 'Account sospeso.'];
        }
        if ($status === 'banned') {
            return ['ok' => false, 'error' => 'Account revocato.'];
        }

        if (password_needs_rehash($hash, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT)) {
            Database::run('UPDATE users SET password_hash = ? WHERE id = ?', [self::hashPassword($password), (int) $row['id']]);
        }

        Session::regenerate();
        Session::put(self::SESSION_KEY, (int) $row['id']);
        Session::put(self::SESSION_GEN, (int) ($row['sessioni_gen'] ?? 0));
        self::$resolved = false;
        self::$cached = null;

        Database::run(
            'UPDATE users SET last_login_at = NOW(), last_login_ip = ?, last_seen_at = NOW() WHERE id = ?',
            [$ip !== null ? @inet_pton($ip) ?: null : null, (int) $row['id']]
        );
        Audit::log('auth.login', (int) $row['id'], 'user', (int) $row['id'], [], $ip);

        return ['ok' => true, 'user' => $row];
    }

    // --- Il recupero della password ----------------------------------------------

    /**
     * Chiede il collegamento per rifare la password.
     *
     * Risponde SEMPRE nello stesso modo, che l'indirizzo esista o no: dire
     * «questo indirizzo non risulta» vorrebbe dire regalare a chiunque un modo
     * per sapere chi e' iscritto. Il modulo d'iscrizione lo prometteva («serve
     * per recuperare l'accesso») e fino all'audit del 23 settembre 2026 non
     * esisteva: chi dimenticava la password restava fuori, e l'unica via era
     * la console. Portato da Atlantik, dove gira da mesi.
     *
     * @return array{ok:bool, error?:string}
     */
    public static function richiediRecupero(string $email, ?string $ip = null): array
    {
        $email = trim(mb_strtolower($email));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'Indirizzo non valido.'];
        }
        $u = Database::first('SELECT id, username, email, status FROM users WHERE LOWER(email) = ?', [$email]);

        // Account che non c'e', o sospeso, o bandito: silenzio. Un account
        // sospeso non si riapre da solo con una password nuova.
        if ($u !== null && in_array((string) $u['status'], ['active', 'pending'], true)) {
            $token = self::issueToken((int) $u['id'], 'reset_password', $ip);
            AuthMail::sendRecupero((int) $u['id'], (string) $u['email'], (string) $u['username'], $token);
            Audit::log('auth.recupero_richiesto', (int) $u['id'], 'user', (int) $u['id'], [], $ip);
        }
        return ['ok' => true];
    }

    /**
     * Guarda se un gettone di recupero vale ancora, senza consumarlo: la
     * pagina della password nuova si apre solo se il collegamento e' buono,
     * invece di farla scrivere e poi dire di no.
     *
     * @return array{ok:bool, error?:string, user_id?:int}
     */
    public static function recuperoValido(string $token): array
    {
        $token = trim($token);
        if ($token === '' || !ctype_xdigit($token)) {
            return ['ok' => false, 'error' => 'Collegamento non valido.'];
        }
        $row = Database::first(
            'SELECT t.user_id, t.used_at, t.expires_at, u.status
             FROM user_tokens t JOIN users u ON u.id = t.user_id
             WHERE t.token_hash = ? AND t.kind = ?',
            [hash('sha256', $token), 'reset_password']
        );
        if ($row === null) {
            return ['ok' => false, 'error' => 'Collegamento non valido.'];
        }
        if ($row['used_at'] !== null) {
            return ['ok' => false, 'error' => 'Questo collegamento è già stato usato.'];
        }
        if (strtotime((string) $row['expires_at']) < time()) {
            return ['ok' => false, 'error' => 'Il collegamento è scaduto: chiedine uno nuovo.'];
        }
        if (!in_array((string) $row['status'], ['active', 'pending'], true)) {
            return ['ok' => false, 'error' => 'Questo account non può accedere.'];
        }
        return ['ok' => true, 'user_id' => (int) $row['user_id']];
    }

    /**
     * Consuma il gettone, mette la password nuova e fa cadere tutte le
     * sessioni aperte.
     *
     * @return array{ok:bool, error?:string}
     */
    public static function rifaiPassword(string $token, string $password, ?string $ip = null): array
    {
        $valido = self::recuperoValido($token);
        if (!$valido['ok']) {
            return $valido;
        }
        if (mb_strlen($password) < self::minPasswordLength()) {
            return ['ok' => false, 'error' => sprintf(
                'La password deve avere almeno %d caratteri.', self::minPasswordLength()
            )];
        }
        $uid = (int) $valido['user_id'];

        Database::run('UPDATE users SET password_hash = ? WHERE id = ?', [self::hashPassword($password), $uid]);
        Database::run('UPDATE user_tokens SET used_at = NOW() WHERE token_hash = ? AND kind = ?',
            [hash('sha256', trim($token)), 'reset_password']);
        // Chi era in attesa e rifa' la password ha dimostrato di leggere quella
        // casella: vale come conferma dell'indirizzo.
        Database::run(
            "UPDATE users SET status = 'active', email_verified_at = COALESCE(email_verified_at, NOW())
             WHERE id = ? AND status = 'pending'",
            [$uid]
        );
        // Tutte le sessioni nate prima di adesso cadono alla prossima pagina.
        Database::run('UPDATE users SET sessioni_gen = sessioni_gen + 1 WHERE id = ?', [$uid]);
        Audit::log('auth.password_rifatta', $uid, 'user', $uid, [], $ip);

        return ['ok' => true];
    }

    public static function logout(): void
    {
        $id = self::id();
        if ($id !== null) {
            Audit::log('auth.logout', $id, 'user', $id);
        }
        Session::forget(self::SESSION_KEY);
        Session::flush();
        self::$resolved = false;
        self::$cached = null;
    }
}
