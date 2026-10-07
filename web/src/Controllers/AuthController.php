<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth\Auth;
use App\Auth\AuthMail;
use App\Core\Database;
use App\Core\RateLimiter;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;

final class AuthController
{
    // --- Iscrizione ----------------------------------------------------------

    public function mostraIscrizione(Request $request): Response
    {
        return Response::html(view('auth/arruolamento', [
            'title'       => 'Arruolamento',
            'aperta'      => Auth::registrationOpen(),
            'minPassword' => Auth::minPasswordLength(),
        ]));
    }

    public function iscrivi(Request $request): Response
    {
        // Freno: 5 tentativi per indirizzo IP ogni mezz'ora.
        if (!RateLimiter::hit('iscr:' . $request->ip(), 5, 1800)) {
            Session::flash('error', "Troppi tentativi da questa connessione. Riprova fra mezz'ora.");
            return redirect('/arruolamento');
        }

        $username = $request->str('username');
        $email    = $request->str('email');
        $password = $request->str('password');
        $conferma = $request->str('password_confirm');

        if ($password !== $conferma) {
            Session::flashInput($request->all());
            Session::flash('error', 'Le due password non coincidono.');
            return redirect('/arruolamento');
        }

        $res = Auth::register($username, $email, $password, $request->ip());
        if (!$res['ok']) {
            Session::flashInput($request->all());
            Session::flash('error', $res['error'] ?? 'Arruolamento non riuscito.');
            return redirect('/arruolamento');
        }

        $emailPulita = mb_strtolower(trim($email));
        $nomePulito  = Auth::normalizeUsername($username);

        $inviata = AuthMail::sendVerification((int) $res['user_id'], $emailPulita, $nomePulito, (string) $res['token']);
        AuthMail::notifyAdmin((int) $res['user_id'], $nomePulito, $emailPulita);

        Session::flash('email', $emailPulita);
        if (!$inviata['ok']) {
            // Non e' un fallimento: il messaggio e' in coda e riparte da solo.
            // Si avverte solo perche' non arrivera' nello stesso minuto.
            Session::flash('warning', 'Iscrizione registrata. Il messaggio di conferma e\' in coda: '
                . 'se non arriva entro qualche minuto, chiedine un altro dalla pagina di accesso.');
        }
        return redirect('/conferma-inviata');
    }

    public function confermaInviata(Request $request): Response
    {
        return Response::html(view('auth/conferma_inviata', [
            'title' => 'Controlla la cassetta della posta',
            'email' => (string) flash('email', ''),
        ]));
    }

    /** Apertura del collegamento ricevuto per posta. */
    public function conferma(Request $request): Response
    {
        $res = Auth::verifyEmail($request->str('token'), $request->ip());

        return Response::html(view('auth/conferma_esito', [
            'title'  => $res['ok'] ? 'Indirizzo confermato' : 'Conferma non riuscita',
            'ok'     => $res['ok'],
            'errore' => $res['error'] ?? null,
            'utente' => $res['user'] ?? null,
        ]));
    }

    /** Nuovo invio del collegamento di conferma. */
    public function rinvia(Request $request): Response
    {
        $login = $request->str('login');

        if (!RateLimiter::hit('rinvio:' . $request->ip(), 5, 1800)) {
            Session::flash('error', "Troppe richieste di rinvio. Riprova fra mezz'ora.");
            return redirect('/accesso');
        }

        $row = Database::first(
            "SELECT id, username, email, status, verify_sent_at FROM users
             WHERE (username = ? OR email = ?) AND status = 'pending'",
            [Auth::normalizeUsername($login), mb_strtolower($login)]
        );

        // Risposta identica in ogni caso: non si rivela chi e' iscritto e chi no.
        if ($row !== null) {
            $ultimo = $row['verify_sent_at'] !== null ? strtotime((string) $row['verify_sent_at']) : 0;
            if (time() - $ultimo >= 120) {
                $token = Auth::issueToken((int) $row['id'], 'verify_email', $request->ip());
                AuthMail::sendVerification((int) $row['id'], (string) $row['email'], (string) $row['username'], $token);
            }
        }

        Session::flash('success', 'Se l\'iscrizione esiste ed e\' in attesa di conferma, il collegamento e\' stato inviato di nuovo.');
        return redirect('/accesso');
    }

    // --- Accesso -------------------------------------------------------------

    public function mostraAccesso(Request $request): Response
    {
        return Response::html(view('auth/accesso', ['title' => 'Accesso']));
    }

    public function accedi(Request $request): Response
    {
        $login = $request->str('login');

        // Due freni: uno per indirizzo IP (chi prova molti account) e uno per
        // nome utente (chi martella un account solo da piu' indirizzi).
        if (!RateLimiter::hit('accesso:ip:' . $request->ip(), 20, 900)
            || !RateLimiter::hit('accesso:utente:' . mb_strtolower($login), 10, 900)) {
            Session::flash('error', 'Troppi tentativi di accesso. Attendi qualche minuto.');
            return redirect('/accesso');
        }

        $res = Auth::attempt($login, $request->str('password'), $request->ip());

        if (!$res['ok']) {
            Session::flashInput(['login' => $login]);
            Session::flash('error', $res['error'] ?? 'Accesso non riuscito.');
            if (!empty($res['need_verify'])) {
                Session::flash('need_verify', $login);
            }
            return redirect('/accesso');
        }

        RateLimiter::clear('accesso:utente:' . mb_strtolower($login));
        return redirect('/plancia');
    }

    // --- Password dimenticata ---------------------------------------------------

    public function mostraRecupero(Request $request): Response
    {
        return Response::html(view('auth/recupero_richiesta', ['title' => 'Password dimenticata']));
    }

    /** Manda il collegamento — o fa finta, se l'indirizzo non risulta. */
    public function chiediRecupero(Request $request): Response
    {
        // Un freno per indirizzo di rete: senza, il modulo sarebbe un modo per
        // riempire di posta la casella di qualcun altro.
        if (!RateLimiter::hit('recupero:' . $request->ip(), 5, 1800)) {
            Session::flash('error', "Troppe richieste. Riprova fra mezz'ora.");
            return redirect('/password-dimenticata');
        }
        $res = Auth::richiediRecupero($request->str('email'), $request->ip());
        if (!$res['ok']) {
            Session::flashInput(['email' => $request->str('email')]);
            Session::flash('error', $res['error'] ?? 'Richiesta non valida.');
            return redirect('/password-dimenticata');
        }
        Session::flash('success', 'Se quell\'indirizzo risulta iscritto, il collegamento è partito. '
            . 'Controlla la posta, anche fra lo spam.');
        return redirect('/accesso');
    }

    /** La pagina della password nuova, aperta dal collegamento. */
    public function mostraRifai(Request $request): Response
    {
        $token = $request->str('token');
        $stato = Auth::recuperoValido($token);
        return Response::html(view('auth/recupero', [
            'title'  => 'Password nuova',
            'token'  => $token,
            'valido' => (bool) $stato['ok'],
            'errore' => $stato['error'] ?? null,
            'minimo' => Auth::minPasswordLength(),
        ]));
    }

    public function rifai(Request $request): Response
    {
        $token = $request->str('token');
        $pw    = (string) $request->input('password', '');
        if ($pw !== (string) $request->input('password_confirm', '')) {
            Session::flash('error', 'Le due password non coincidono.');
            return redirect('/recupero?token=' . urlencode($token));
        }
        $res = Auth::rifaiPassword($token, $pw, $request->ip());
        if (!$res['ok']) {
            Session::flash('error', $res['error'] ?? 'Non è stato possibile cambiare la password.');
            return redirect('/recupero?token=' . urlencode($token));
        }
        Session::flash('success', 'Password cambiata. Le sessioni aperte sono state chiuse: entra con quella nuova.');
        return redirect('/accesso');
    }

    public function esci(Request $request): Response
    {
        Auth::logout();
        return redirect('/');
    }
}
