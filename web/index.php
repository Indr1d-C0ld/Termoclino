<?php

declare(strict_types=1);

/**
 * Termoclino — front controller unico.
 * Ogni richiesta applicativa passa da qui (PATH_INFO o RewriteRule).
 */

define('TERMOCLINO', true);
define('APP_START', microtime(true));

$projectRoot = __DIR__;

// Server incorporato di PHP (php -S ... index.php): qui index.php fa da router
// e riceve ANCHE le richieste dei file statici. Restituendo false si dice al
// server di servirli da solo. Sotto Apache non serve — ci pensa la RewriteCond
// -f — ma senza questa riga in sviluppo il foglio di stile arriva come 404
// in HTML e la pagina si vede nuda, con un errore di MIME che non sembra
// affatto un problema di instradamento.
if (PHP_SAPI === 'cli-server') {
    $richiesto = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
    $file = $projectRoot . '/' . ltrim(rawurldecode($richiesto), '/');
    // I moduli comuni a server e client stanno in ../shared. In esercizio
    // deploy/02-pubblica.sh li copia in assets/shared/; in sviluppo li si serve
    // da qui, senza collegamenti simbolici (che il test runner di Node seguirebbe,
    // facendo girare le prove due volte).
    if (str_starts_with($richiesto, '/assets/shared/')) {
        $base = realpath(dirname($projectRoot) . '/shared');
        $vero = $base === false ? false : realpath($base . '/' . substr(rawurldecode($richiesto), strlen('/assets/shared/')));
        if ($vero !== false && str_starts_with($vero, $base . '/') && is_file($vero)
            && preg_match('/\.(js|json|bin)$/', $vero) === 1) {
            // .bin: le griglie del fondale degli scenari (shared/data/scenari/*.batimetria.bin).
            header('Content-Type: ' . match (true) {
                str_ends_with($vero, '.json') => 'application/json; charset=utf-8',
                str_ends_with($vero, '.bin') => 'application/octet-stream',
                default => 'text/javascript; charset=utf-8',
            });
            readfile($vero);
            return true;
        }
        http_response_code(404);
        return true;
    }
    // assets/originali/ non si serve mai direttamente (D4): passa dal router,
    // che chiede l'accesso — come fa Apache in esercizio.
    // Il server di sviluppo serve da solo SOLO file statici: un .php diverso da
    // index.php non si esegue mai per indirizzo diretto (sotto Apache ci pensano
    // le regole di negazione; qui ci si pensa da se').
    if ($richiesto !== '/index.php' && is_file($file) && !str_starts_with($richiesto, '/assets/originali/')
        && !str_ends_with(strtolower($file), '.php')
        && str_starts_with(realpath($file) ?: '', $projectRoot . '/')) {
        return false;
    }
}

require $projectRoot . '/src/autoload.php';
require $projectRoot . '/src/Support/helpers.php';

use App\Core\Config;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Core\Session;
use App\Core\View;

$GLOBALS['__project_root'] = $projectRoot;

// --- Configurazione ----------------------------------------------------------
try {
    Config::load($projectRoot);
} catch (\Throwable $e) {
    http_response_code(503);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>Termoclino — configurazione</title>'
        . '<style>body{font:16px/1.65 system-ui,sans-serif;background:#06101a;color:#d7dee4;'
        . 'max-width:44rem;margin:4rem auto;padding:0 1.5rem}code{background:#1a2129;color:#55ff55;padding:.15em .4em;'
        . 'border-radius:3px}h1{color:#55ffff;font-weight:600}</style>'
        . '<h1>Configurazione mancante</h1><p>Non riesco ad avviare l\'applicazione:</p>'
        . '<pre><code>' . htmlspecialchars($e->getMessage(), ENT_QUOTES) . '</code></pre>'
        . '<p>Esegui <code>sudo bash deploy/00-bootstrap.sh</code>, poi '
        . '<code>php bin/console.php migrate</code>.</p>';
    exit;
}

date_default_timezone_set((string) Config::get('app.timezone', 'UTC'));

$debug = (bool) Config::get('app.debug', false);
ini_set('display_errors', $debug ? '1' : '0');
error_reporting(E_ALL);

View::setPath($projectRoot . '/views');
Session::start();

// --- Richiesta ---------------------------------------------------------------
$forcedBase = Config::get('app.base_path');
$request = new Request(
    (bool) Config::get('app.pretty_urls', false),
    is_string($forcedBase) ? $forcedBase : null,
);
$GLOBALS['__base_path']  = $request->basePath();
$GLOBALS['__url_prefix'] = $request->urlPrefix();
// Il percorso lo calcola gia' Request, che sa districare PATH_INFO, il
// prefisso e /index.php. Lo si deposita qui perche' le viste possano sapere
// dove si trovano — ricalcolarlo in un helper vorrebbe dire una seconda
// copia di quella logica, e prima o poi le due divergono.
$GLOBALS['__percorso']   = $request->path();

// --- Instradamento -----------------------------------------------------------
$router = new Router();
require $projectRoot . '/src/routes.php';

try {
    $response = $router->dispatch($request);
} catch (\Throwable $e) {
    logger(sprintf('%s: %s @ %s:%d', $e::class, $e->getMessage(), $e->getFile(), $e->getLine()), 'error');

    $isDb = str_contains(strtolower($e->getMessage()), 'database')
        || str_contains(strtolower($e->getMessage()), 'connessione al database');

    if ($isDb) {
        $response = Response::html(view('errors/db', [
            'title'  => 'Servizio non disponibile',
            'debug'  => $debug,
            'detail' => $e->getMessage(),
        ]), 503);
    } else {
        $response = Response::html(view('errors/generic', [
            'title'   => 'Errore interno',
            'status'  => 500,
            'message' => $debug
                ? $e::class . ': ' . $e->getMessage()
                : 'Qualcosa e\' andato storto. L\'inconveniente e\' stato annotato.',
        ]), 500);
    }
}

$response->send();
