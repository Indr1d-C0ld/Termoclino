<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\GiocoController;
use App\Controllers\HomeController;
use App\Core\Router;

/** @var Router $router */

// --- Pubbliche ---------------------------------------------------------------
// Per la decisione D4 le pagine pubbliche non mostrano grafica originale del 1989.
$router->get('/', [HomeController::class, 'index']);
$router->get('/salute', [HomeController::class, 'salute']);

// --- Arruolamento e conferma dell'indirizzo ----------------------------------
$router->get('/arruolamento', [AuthController::class, 'mostraIscrizione'], ['guest']);
$router->post('/arruolamento', [AuthController::class, 'iscrivi'], ['guest', 'throttle']);
$router->get('/conferma-inviata', [AuthController::class, 'confermaInviata']);
$router->get('/conferma', [AuthController::class, 'conferma']);
$router->post('/rinvia-conferma', [AuthController::class, 'rinvia'], ['throttle']);

// --- Accesso -----------------------------------------------------------------
$router->get('/accesso', [AuthController::class, 'mostraAccesso'], ['guest']);
$router->post('/accesso', [AuthController::class, 'accedi'], ['guest', 'throttle']);
$router->post('/esci', [AuthController::class, 'esci'], ['auth']);

// --- Password dimenticata ----------------------------------------------------
$router->get('/password-dimenticata', [AuthController::class, 'mostraRecupero']);
$router->post('/password-dimenticata', [AuthController::class, 'chiediRecupero'], ['throttle']);
$router->get('/recupero', [AuthController::class, 'mostraRifai']);
$router->post('/recupero', [AuthController::class, 'rifai'], ['throttle']);

// --- A bordo -----------------------------------------------------------------
$router->get('/plancia', [GiocoController::class, 'plancia'], ['active']);
$router->post('/biglietto', [GiocoController::class, 'biglietto'], ['active', 'throttle']);
// La grafica originale del 1989: solo dopo l'accesso (D4), mai per indirizzo diretto.
$router->get('/originali/{*percorso}', [GiocoController::class, 'originale'], ['active']);
