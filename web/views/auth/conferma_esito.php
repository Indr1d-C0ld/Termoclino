<?php /** @var bool $ok */ /** @var string|null $errore */ /** @var array<string,mixed>|null $utente */ ?>
<?php if ($ok): ?>
  <p class="occhiello">Fatto</p>
  <h1>Indirizzo confermato</h1>
  <div class="carta">
    <p>
      <?php if (is_array($utente) && isset($utente['username'])): ?>
        Benvenuto, <strong><?= e((string) $utente['username']) ?></strong>.
      <?php endif; ?>
      L'arruolamento è attivo: adesso puoi salire a bordo.
    </p>
    <div class="bottoni">
      <a class="bottone" href="<?= e(url('/accesso')) ?>">Entra</a>
    </div>
  </div>
<?php else: ?>
  <p class="occhiello">Non ci siamo</p>
  <h1>Conferma non riuscita</h1>
  <div class="carta">
    <p><?= e($errore ?? 'Il collegamento non è valido.') ?></p>
    <p class="tenue">Dalla pagina di accesso puoi chiedere un collegamento nuovo.</p>
    <div class="bottoni">
      <a class="bottone secondario" href="<?= e(url('/accesso')) ?>">Vai all'accesso</a>
    </div>
  </div>
<?php endif; ?>
