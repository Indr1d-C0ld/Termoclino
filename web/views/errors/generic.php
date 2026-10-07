<?php /** @var int $status */ /** @var string $message */ ?>
<p class="occhiello">Errore <?= e((string) ($status ?? 500)) ?></p>
<h1><?= e($title ?? 'Qualcosa non va') ?></h1>
<p class="sommario"><?= e($message ?? '') ?></p>
<div class="bottoni">
  <a class="bottone secondario" href="<?= e(url('/')) ?>">Torna in superficie</a>
</div>
