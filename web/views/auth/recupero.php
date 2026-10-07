<?php
/**
 * @var string $token
 * @var bool $valido
 * @var string|null $errore
 * @var int $minimo
 */
?>
<p class="occhiello">Password dimenticata</p>
<h1>Una password nuova</h1>

<?php if (!$valido): ?>
  <div class="carta">
    <p><?= e((string) $errore) ?></p>
    <div class="bottoni">
      <a class="bottone" href="<?= e(url('/password-dimenticata')) ?>">Chiedine un altro</a>
    </div>
  </div>
<?php else: ?>
  <p class="sommario">
    Appena la cambi, tutte le sessioni aperte si chiudono — anche quelle su altri dispositivi.
    Se qualcuno era entrato al posto tuo, si ritrova fuori.
  </p>
  <div class="carta">
    <form method="post" action="<?= e(url('/recupero')) ?>">
      <?= csrf_field() ?>
      <input type="hidden" name="token" value="<?= e($token) ?>">
      <div class="campo">
        <label for="password">Password nuova</label>
        <input type="password" id="password" name="password" required minlength="<?= (int) $minimo ?>"
               autocomplete="new-password">
        <span class="aiuto">Almeno <?= (int) $minimo ?> caratteri.</span>
      </div>
      <div class="campo">
        <label for="password_confirm">Di nuovo, per sicurezza</label>
        <input type="password" id="password_confirm" name="password_confirm" required
               minlength="<?= (int) $minimo ?>" autocomplete="new-password">
      </div>
      <div class="bottoni"><button type="submit">Cambia la password</button></div>
    </form>
  </div>
<?php endif; ?>
