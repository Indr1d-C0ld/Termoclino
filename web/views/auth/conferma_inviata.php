<?php /** @var string $email */ ?>
<p class="occhiello">Quasi fatto</p>
<h1>Controlla la cassetta della posta</h1>

<div class="carta">
  <p>
    <?php if ($email !== ''): ?>
      Ho mandato un collegamento di conferma a <strong><?= e($email) ?></strong>.
    <?php else: ?>
      Ho mandato un collegamento di conferma al tuo indirizzo.
    <?php endif; ?>
    Aprilo e sei dentro.
  </p>
  <p class="tenue">
    Se non lo trovi, guarda nella posta indesiderata: i messaggi automatici ci finiscono spesso.
    Dalla pagina di accesso puoi chiederne un altro.
  </p>
  <div class="bottoni">
    <a class="bottone secondario" href="<?= e(url('/accesso')) ?>">Vai all'accesso</a>
  </div>
</div>
