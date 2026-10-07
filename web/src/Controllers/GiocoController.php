<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Gioco\Biglietto;
use App\Gioco\ServerDiGioco;

/**
 * La plancia: la pagina che ospita il client di gioco.
 *
 * In F0 il client fa una cosa sola — sale a bordo del server di gioco con il
 * biglietto e lo dice — ma la pagina e' gia' quella definitiva: un guscio che
 * carica i moduli del client e gli passa indirizzo e biglietto.
 */
final class GiocoController
{
    public function plancia(Request $request): Response
    {
        $utente = Auth::user();
        if ($utente === null) {
            return redirect('/accesso');
        }
        return Response::html(view('gioco/plancia', [
            'title'     => 'Plancia',
            'wsUrl'     => ServerDiGioco::wsUrl(),
            'biglietto' => Biglietto::emetti($utente),
            'utente'    => $utente,
        ]))->withHeader('Cache-Control', 'no-store');
    }

    /**
     * La grafica e i suoni originali del 1989, solo per chi ha fatto accesso.
     *
     * Decisione D4: registrazione aperta, ma il materiale originale non sta
     * sulle pagine pubbliche e non si raggiunge con un indirizzo diretto.
     * Apache nega `assets/originali/` (deploy/apache-termoclino.conf) e i file
     * passano da qui, dietro il filtro 'active'.
     */
    public function originale(Request $request, string $percorso = ''): Response
    {
        $tipi = ['png' => 'image/png', 'json' => 'application/json', 'wav' => 'audio/wav'];
        $base = realpath(dirname(__DIR__, 2) . '/assets/originali');
        $file = $base === false ? false : realpath($base . '/' . $percorso);
        $est  = strtolower(pathinfo((string) $percorso, PATHINFO_EXTENSION));
        if ($file === false || !str_starts_with($file, $base . '/') || !is_file($file) || !isset($tipi[$est])) {
            return Response::text('Non trovato.', 404);
        }
        return Response::text((string) file_get_contents($file))
            ->withHeader('Content-Type', $tipi[$est])
            // privato: niente cache condivise (proxy) per materiale riservato agli iscritti
            ->withHeader('Cache-Control', 'private, max-age=86400');
    }

    /**
     * Un biglietto nuovo, per riconnettersi senza ricaricare la pagina: il
     * primo vale 60 secondi, una riconnessione dopo un'ora ne vuole un altro.
     * POST con il token CSRF, come ogni richiesta che cambia qualcosa: emettere
     * un biglietto e' un'azione, non una lettura.
     */
    public function biglietto(Request $request): Response
    {
        $utente = Auth::user();
        if ($utente === null) {
            return Response::json(['ok' => false, 'errore' => 'non_collegato'], 401);
        }
        return Response::json([
            'ok'        => true,
            'biglietto' => Biglietto::emetti($utente),
            'ws'        => ServerDiGioco::wsUrl(),
        ])->withHeader('Cache-Control', 'no-store');
    }
}
