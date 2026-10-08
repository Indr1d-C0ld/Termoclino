<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;

/**
 * Configurazione applicativa.
 *
 * Ordine di ricerca del file config:
 *   1. env TERMOCLINO_CONFIG
 *   2. <project>/config/config.php            (sviluppo: il file accanto al codice)
 *   3. /etc/termoclino/config.php
 *   4. /data/termoclino-config/config.php       (esercizio, fuori dal DocumentRoot)
 *
 * Il file accanto al codice viene PRIMA di quelli di sistema: sulla macchina
 * dove gira l'esercizio c'e' anche l'albero di sviluppo, e con l'ordine
 * opposto il sito di sviluppo e la sua console leggevano la configurazione
 * vera appena esisteva, scrivendo nel database vero e spedendo posta vera
 * (successo l'8/10/2026). In esercizio <project>/config/config.php non
 * esiste: deploy/02-pubblica.sh non lo copia.
 */
final class Config
{
    /** @var array<string,mixed> */
    private static array $data = [];
    private static bool $loaded = false;
    private static string $sourceFile = '';

    public static function load(string $projectRoot): void
    {
        if (self::$loaded) {
            return;
        }

        $candidates = array_values(array_filter([
            getenv('TERMOCLINO_CONFIG') ?: null,
            $projectRoot . '/config/config.php',
            '/etc/termoclino/config.php',
            '/data/termoclino-config/config.php',
        ]));

        foreach ($candidates as $path) {
            if (is_file($path) && is_readable($path)) {
                /** @var array<string,mixed> $cfg */
                $cfg = require $path;
                if (!is_array($cfg)) {
                    throw new RuntimeException("Config non valida in {$path}: atteso array.");
                }
                self::$data = $cfg;
                self::$sourceFile = $path;
                self::$loaded = true;
                return;
            }
        }

        throw new RuntimeException(
            "Nessun file di configurazione trovato. Cercati:\n  - " . implode("\n  - ", $candidates)
        );
    }

    public static function loaded(): bool
    {
        return self::$loaded;
    }

    public static function sourceFile(): string
    {
        return self::$sourceFile;
    }

    /**
     * Accesso con dot-notation: Config::get('db.host').
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        $node = self::$data;
        foreach (explode('.', $key) as $segment) {
            if (!is_array($node) || !array_key_exists($segment, $node)) {
                return $default;
            }
            $node = $node[$segment];
        }
        return $node;
    }
}
