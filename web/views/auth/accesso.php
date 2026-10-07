<?php $daConfermare = flash('need_verify'); ?>
<p class="occhiello">Bentornato a bordo</p>
<h1>Accesso</h1>

<div class="carta">
  <form method="post" action="<?= e(url('/accesso')) ?>">
    <?= csrf_field() ?>

    <div class="campo">
      <label for="login">Nome utente o indirizzo e-mail</label>
      <input type="text" id="login" name="login" required autocomplete="username"
             value="<?= e((string) old('login')) ?>">
    </div>

    <div class="campo">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password">
      <span class="aiuto"><a href="<?= e(url('/password-dimenticata')) ?>">Password dimenticata?</a></span>
    </div>

    <div class="bottoni">
      <button type="submit">Entra</button>
      <a class="bottone tenue" href="<?= e(url('/arruolamento')) ?>">Non sono ancora arruolato</a>
    </div>
  </form>
</div>

<?php if (is_string($daConfermare) && $daConfermare !== ''): ?>
<div class="carta">
  <h2>Il tuo indirizzo non è ancora confermato</h2>
  <p>Se il messaggio non è arrivato o è scaduto, puoi chiederne un altro.</p>
  <form method="post" action="<?= e(url('/rinvia-conferma')) ?>">
    <?= csrf_field() ?>
    <input type="hidden" name="login" value="<?= e($daConfermare) ?>">
    <button type="submit" class="secondario">Mandami un altro collegamento</button>
  </form>
</div>
<?php endif; ?>
