<?php

declare(strict_types=1);

/**
 * Termoclino — battito di servizio.
 *
 * Da cron, ogni minuto (nel crontab dell'utente di servizio, non di root):
 *   * * * * * /usr/bin/php /data/html/termoclino/bin/tick.php >/dev/null 2>&1
 *
 * A differenza degli altri giochi del server, qui il mondo NON avanza col
 * battito: le partite le fa girare il server di gioco, in tempo reale. Il
 * battito fa il lavoro di fondo del sito: la coda della posta, la pulizia dei
 * freni e, da F6, l'elaborazione delle partite concluse (valutazioni, gradi,
 * decorazioni).
 *
 * Ogni fase sta in piedi da sola: se una cade, cade da sola, lascia detto
 * perche', e il battito va avanti.
 */

$projectRoot = require __DIR__ . '/_bootstrap.php';

use App\Core\Database;
use App\Core\Posta;
use App\Core\RateLimiter;

$avvio = microtime(true);
$lock  = $projectRoot . '/storage/tick.lock';

// Un solo battito per volta: se il precedente e' ancora in corso si esce subito.
$fp = fopen($lock, 'c');
if ($fp === false || !flock($fp, LOCK_EX | LOCK_NB)) {
    exit(0);
}

$id = null;
try {
    // Prima delle migrazioni non c'e' niente da battere.
    if (Database::first("SHOW TABLES LIKE 'tick_runs'") === null) {
        exit(0);
    }

    Database::run('INSERT INTO tick_runs (started_at, ok) VALUES (NOW(3), 0)');
    $id = Database::lastInsertId();

    $guasti = [];
    $fase = static function (string $nome, callable $f, mixed $difetto) use (&$guasti): mixed {
        try {
            return $f();
        } catch (\Throwable $e) {
            $guasti[] = $nome . ': ' . $e->getMessage();
            logger('battito: fase ' . $nome . ' — ' . $e->getMessage(), 'error');
            return $difetto;
        }
    };

    $posta = $fase('posta', static fn (): array => Posta::smista(), ['tentati' => 0, 'inviati' => 0]);
    $freni = $fase('freni', static fn (): int => RateLimiter::gc(), 0);

    $ms = (int) round((microtime(true) - $avvio) * 1000);
    Database::run(
        'UPDATE tick_runs SET finished_at = NOW(3), ok = ?, duration_ms = ?, tasks = ?, note = ? WHERE id = ?',
        [
            $guasti === [] ? 1 : 0,
            $ms,
            json_encode(['posta' => $posta, 'freni_potati' => $freni], JSON_UNESCAPED_UNICODE),
            $guasti === [] ? null : mb_substr(implode(' | ', $guasti), 0, 255),
            $id,
        ]
    );
} catch (\Throwable $e) {
    logger('battito fallito: ' . $e->getMessage(), 'error');
    if ($id !== null) {
        try {
            Database::run(
                'UPDATE tick_runs SET finished_at = NOW(3), ok = 0, note = ? WHERE id = ?',
                [mb_substr($e->getMessage(), 0, 255), $id]
            );
        } catch (\Throwable) {
            // Se non si riesce neanche a scrivere il fallimento, resta il diario.
        }
    }
    exit(1);
} finally {
    flock($fp, LOCK_UN);
    fclose($fp);
}
