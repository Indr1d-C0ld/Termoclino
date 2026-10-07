<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Impostazioni di gioco lette da game_config (modificabili a caldo, senza deploy).
 * Cache per richiesta: una sola query per tutta la vita del processo.
 */
final class GameConfig
{
    /** @var array<string,array{value:string,type:string}>|null */
    private static ?array $cache = null;

    private static function load(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }
        $rows = [];
        try {
            foreach (Database::all('SELECT ckey, cvalue, ctype FROM game_config') as $r) {
                $rows[(string) $r['ckey']] = ['value' => (string) $r['cvalue'], 'type' => (string) $r['ctype']];
            }
        } catch (\Throwable) {
            // Prima delle migrazioni la tabella non esiste: si usano i default.
        }
        return self::$cache = $rows;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $row = self::load()[$key] ?? null;
        if ($row === null) {
            return $default;
        }
        return match ($row['type']) {
            'int'   => (int) $row['value'],
            'float' => (float) $row['value'],
            'bool'  => in_array(strtolower($row['value']), ['1', 'true', 'si', 'yes', 'on'], true),
            'json'  => json_decode($row['value'], true) ?? $default,
            default => $row['value'],
        };
    }

    public static function int(string $key, int $default = 0): int
    {
        return (int) self::get($key, $default);
    }

    public static function bool(string $key, bool $default = false): bool
    {
        return (bool) self::get($key, $default);
    }

    /**
     * Cambia il valore di una manopola.
     *
     * **Il tipo non si tocca se non lo si dice.** Prima il parametro aveva
     * come difetto `'string'` e la query lo riscriveva sempre: chiunque
     * chiamasse `set()` senza conoscere il tipo — `bin/console.php config:set`
     * col terzo argomento omesso, una prova che rimette a posto un valore —
     * declassava la manopola a stringa in silenzio. Il valore continuava a
     * funzionare, perche' `int()` e `bool()` lo convertono comunque; a rompersi
     * era la pagina delle leve, che sceglie il controllo da mostrare guardando
     * il tipo, e da quel momento offriva una casella di testo dove serviva una
     * spunta. Un guasto che non si vede finche' non si va a cercarlo.
     */
    public static function set(string $key, string $value, ?string $type = null, ?string $note = null): void
    {
        Database::run(
            'INSERT INTO game_config (ckey, cvalue, ctype, note) VALUES (?, ?, COALESCE(?, \'string\'), ?)
             ON DUPLICATE KEY UPDATE cvalue = VALUES(cvalue), ctype = COALESCE(?, ctype)',
            [$key, $value, $type, $note, $type]
        );
        self::$cache = null;
    }

    /** @return array<string,array{value:string,type:string}> */
    public static function all(): array
    {
        return self::load();
    }
}
