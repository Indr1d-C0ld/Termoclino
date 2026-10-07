<?php
/** @var string $content */
/** @var string $title */
/** @var string $ambiente */
$nomeGioco = (string) config('app.name', 'Termoclino');
$ambiente  = $ambiente ?? 'bordo';
// Sulla soglia il titolo della pagina E' il nome del gioco: ripeterlo due volte
// nella barra del browser fa «Termoclino — Termoclino».
$titoloPagina = (string) ($title ?? $nomeGioco);
?>
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title><?= e($titoloPagina === $nomeGioco ? $nomeGioco : $titoloPagina . ' — ' . $nomeGioco) ?></title>
<meta name="description" content="Simulatore di sottomarini della tarda Guerra Fredda, in singolo e in duello: tributo amatoriale a 688 Attack Sub (1989).">
<link rel="stylesheet" href="<?= e(asset('css/termoclino.css')) ?>">
<link rel="icon" href="<?= e(asset('img/icona.svg')) ?>" type="image/svg+xml">
<meta name="theme-color" content="#07111c">
</head>
<body data-ambiente="<?= e($ambiente) ?>">

<header class="testata">
  <a class="marchio" href="<?= e(url('/')) ?>">
    <img src="<?= e(asset('img/icona.svg')) ?>" alt="" width="28" height="28">
    <span><?= e($nomeGioco) ?></span>
  </a>
  <nav>
    <?php if (auth_check()): ?>
      <a href="<?= e(url('/plancia')) ?>">Plancia</a>
      <span class="tenue"><?= e((string) (auth_user()['username'] ?? '')) ?></span>
      <form method="post" action="<?= e(url('/esci')) ?>" class="in-linea">
        <?= csrf_field() ?>
        <button type="submit" class="tenue">sbarca</button>
      </form>
    <?php else: ?>
      <a href="<?= e(url('/accesso')) ?>">Accedi</a>
      <a class="bottone" href="<?= e(url('/arruolamento')) ?>">Arruolati</a>
    <?php endif; ?>
  </nav>
</header>

<main class="contenuto <?= e($larghezza ?? '') ?>">
  <?= partial('flash') ?>
  <?= $content ?>
</main>

<footer class="piede">
  <p><?= e($nomeGioco) ?> è un tributo amatoriale e senza scopo di lucro a <em>688 Attack Sub</em>
     (John W. Ratcliff, Paul Grace e Randall Breen; Electronic Arts, 1989).</p>
  <p>Non affiliato a Electronic Arts né agli autori originali. I marchi e la grafica del 1989
     appartengono ai rispettivi aventi diritto; il materiale viene rimosso su loro richiesta.</p>
</footer>

</body>
</html>
