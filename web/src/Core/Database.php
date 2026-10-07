<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;
use RuntimeException;

/**
 * Wrapper sottile su PDO/MariaDB. Connessione lazy e condivisa.
 */
final class Database
{
    private static ?PDO $pdo = null;
    private static ?string $lastError = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $host    = (string) Config::get('db.host', '127.0.0.1');
        $port    = (int) Config::get('db.port', 3306);
        $name    = (string) Config::get('db.name', '');
        $user    = (string) Config::get('db.user', '');
        $pass    = (string) Config::get('db.pass', '');
        $charset = (string) Config::get('db.charset', 'utf8mb4');

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";

        try {
            self::$pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_STRINGIFY_FETCHES  => false,
            ]);
        } catch (PDOException $e) {
            self::$lastError = $e->getMessage();
            throw new RuntimeException('Connessione al database non riuscita: ' . $e->getMessage(), 0, $e);
        }

        // Il database e PHP devono leggere lo stesso orologio. Il codice scrive
        // le date col NOW() del database (scadenze dei gettoni, ultimo accesso,
        // registro) e le rilegge con il time() di PHP: finche' i due fusi
        // coincidono per caso va tutto bene, e in produzione coincidevano. Su
        // una macchina col database in UTC e PHP in Europe/Rome, invece, un
        // collegamento per rifare la password — due ore di validita' — nasceva
        // gia' scaduto. Si allinea qui, una volta, all'offset che PHP sta usando
        // adesso (che il bootstrap ha gia' preso da app.timezone).
        self::$pdo->exec('SET time_zone = ' . self::$pdo->quote(date('P')));

        return self::$pdo;
    }

    /** Verifica non lanciante: utile per la pagina di setup. */
    public static function isReachable(): bool
    {
        try {
            self::pdo()->query('SELECT 1');
            return true;
        } catch (\Throwable $e) {
            self::$lastError = $e->getMessage();
            return false;
        }
    }

    public static function lastError(): ?string
    {
        return self::$lastError;
    }

    /**
     * @param array<string,mixed>|list<mixed> $params
     */
    public static function run(string $sql, array $params = []): \PDOStatement
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /**
     * @param array<string,mixed>|list<mixed> $params
     * @return array<string,mixed>|null
     */
    public static function first(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    /**
     * @param array<string,mixed>|list<mixed> $params
     * @return list<array<string,mixed>>
     */
    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    public static function lastInsertId(): int
    {
        return (int) self::pdo()->lastInsertId();
    }
}
