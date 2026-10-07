<?php

declare(strict_types=1);

namespace App\Cli;

use App\Core\Database;

/**
 * Migratore SQL minimale: applica in ordine i file db/migrations/*.sql
 * non ancora registrati in schema_migrations.
 *
 * Nota: in MariaDB il DDL fa commit implicito, quindi non c'e' vera
 * atomicita' per-file. Le migrazioni vanno scritte idempotenti
 * (CREATE TABLE IF NOT EXISTS, INSERT ... ON DUPLICATE KEY UPDATE)
 * cosi' che un ri-lancio dopo un errore parziale sia sicuro.
 */
final class Migrator
{
    public function __construct(private string $migrationsDir)
    {
    }

    /** @return list<string> messaggi di log */
    public function migrate(): array
    {
        $log = [];
        $pdo = Database::pdo();

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(64) NOT NULL PRIMARY KEY,
                applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $applied = array_column(
            Database::all('SELECT version FROM schema_migrations'),
            'version'
        );

        $files = glob(rtrim($this->migrationsDir, '/') . '/*.sql') ?: [];
        sort($files);

        $pending = 0;
        foreach ($files as $file) {
            $version = basename($file, '.sql');
            if (in_array($version, $applied, true)) {
                continue;
            }
            $pending++;

            $statements = $this->splitStatements((string) file_get_contents($file));

            foreach ($statements as $i => $sql) {
                try {
                    $pdo->exec($sql);
                } catch (\Throwable $e) {
                    $snippet = preg_replace('/\s+/', ' ', substr($sql, 0, 120));
                    $log[] = "  FALLITA    {$version} (statement " . ($i + 1) . "): " . $e->getMessage();
                    throw new \RuntimeException(
                        "Migrazione {$version} fallita allo statement " . ($i + 1)
                        . " [{$snippet}...]: " . $e->getMessage(),
                        0,
                        $e
                    );
                }
            }

            Database::run('INSERT INTO schema_migrations (version) VALUES (?)', [$version]);
            $log[] = "  applicata  {$version}  (" . count($statements) . ' statement)';
        }

        if ($pending === 0) {
            $log[] = '  nessuna migrazione da applicare (schema aggiornato)';
        }

        return $log;
    }

    /**
     * Divide un file in statement.
     *
     * Il separatore e' il punto e virgola, ma NON quello che si trova dentro
     * una stringa: la prima migrazione di questo progetto conteneva la nota
     * "...corrisponde clock.epoch_game; vuoto = ..." e la versione ingenua di
     * questa funzione la spezzava a meta', producendo due statement rotti e un
     * messaggio d'errore che parlava di sintassi SQL invece che del vero
     * problema. Da qui la scansione carattere per carattere.
     *
     * Si tiene conto di: apici singoli e doppi, il raddoppio dell'apice
     * ('' e "") che e' il modo di SQL per inserirlo in una stringa, la barra
     * rovesciata di MariaDB, i commenti -- e # fino a fine riga e quelli /* *"+"/.
     *
     * @return list<string>
     */
    private function splitStatements(string $sql): array
    {
        $out = [];
        $buf = '';
        $len = strlen($sql);
        $apice = '';        // '\'' o '"' quando siamo dentro una stringa
        $commento = '';     // 'riga' oppure 'blocco'

        for ($i = 0; $i < $len; $i++) {
            $c = $sql[$i];
            $succ = $i + 1 < $len ? $sql[$i + 1] : '';

            if ($commento === 'riga') {
                if ($c === "\n") {
                    $commento = '';
                    $buf .= $c;
                }
                continue;
            }
            if ($commento === 'blocco') {
                if ($c === '*' && $succ === '/') {
                    $commento = '';
                    $i++;
                }
                continue;
            }

            if ($apice !== '') {
                $buf .= $c;
                if ($c === '\\' && $succ !== '') {   // barra rovesciata: il prossimo e' letterale
                    $buf .= $succ;
                    $i++;
                } elseif ($c === $apice) {
                    if ($succ === $apice) {        // '' o "" dentro la stringa
                        $buf .= $succ;
                        $i++;
                    } else {
                        $apice = '';
                    }
                }
                continue;
            }

            if ($c === '-' && $succ === '-') { $commento = 'riga'; $i++; continue; }
            if ($c === '#')                  { $commento = 'riga'; continue; }
            if ($c === '/' && $succ === '*') { $commento = 'blocco'; $i++; continue; }

            if ($c === "'" || $c === '"') {
                $apice = $c;
                $buf .= $c;
                continue;
            }

            if ($c === ';') {
                $pezzo = trim($buf);
                if ($pezzo !== '') {
                    $out[] = $pezzo;
                }
                $buf = '';
                continue;
            }

            $buf .= $c;
        }

        $pezzo = trim($buf);
        if ($pezzo !== '') {
            $out[] = $pezzo;
        }
        return $out;
    }
}
