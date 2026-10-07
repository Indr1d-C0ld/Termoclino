<p class="occhiello">Password dimenticata</p>
<h1>Rifare la password</h1>
<p class="sommario">
  Scrivi l'indirizzo usato per l'arruolamento: se risulta, ti arriva un collegamento per sceglierne
  una nuova. La risposta è la stessa in ogni caso — da questa pagina non si può scoprire chi è
  iscritto e chi no.
</p>

<div class="carta">
  <form method="post" action="<?= e(url('/password-dimenticata')) ?>">
    <?= csrf_field() ?>
    <div class="campo">
      <label for="email">Indirizzo e-mail</label>
      <input type="email" id="email" name="email" required autocomplete="email"
             value="<?= e((string) old('email')) ?>">
    </div>
    <div class="bottoni">
      <button type="submit">Mandami il collegamento</button>
      <a class="bottone tenue" href="<?= e(url('/accesso')) ?>">Torna all'accesso</a>
    </div>
  </form>
</div>
