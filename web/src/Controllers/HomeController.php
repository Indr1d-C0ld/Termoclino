<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth\Auth;
use App\Core\Config;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Gioco\ServerDiGioco;

final class HomeController
{
    /**
     * La soglia: cos'e' Termoclino e le due porte (accesso / arruolamento).
     *
     * Pagina pubblica: per D4 qui non compare grafica originale del 1989, solo
     * cio' che e' nostro. La grafica d'epoca si vede nel client, dopo l'accesso.
     */
    public function index(Request $request): Response
    {
        if (Auth::check() && Auth::status() === 'active') {
            return Response::redirect(url('/plancia'));
        }

        $equipaggi = 0;
        try {
            $equipaggi = (int) (Database::first(
                "SELECT COUNT(*) AS n FROM users WHERE status = 'active'"
            )['n'] ?? 0);
        } catch (\Throwable) {
            // Prima delle migrazioni la pagina deve comunque aprirsi.
        }

        return Response::html(view('home', [
            'title'     => 'Termoclino',
            'equipaggi' => $equipaggi,
        ]));
    }

    /**
     * Sonda di servizio: dice se l'applicazione, il database e il server di
     * gioco sono vivi. La usano il monitoraggio e le prove end-to-end.
     */
    public function salute(Request $request): Response
    {
        $db = false;
        try {
            $db = Database::isReachable();
        } catch (\Throwable) {
        }
        $gioco = ServerDiGioco::salute();
        $ok = $db && $gioco !== null;
        return Response::json([
            'app'    => 'termoclino',
            'nome'   => (string) Config::get('app.name', 'Termoclino'),
            'ok'     => $ok,
            'db'     => $db,
            'server' => $gioco,
            'time'   => date('c'),
        ], $ok ? 200 : 503);
    }
}
