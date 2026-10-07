<?php
/** @var string $wsUrl */
/** @var string $biglietto */
/** @var array<string,mixed> $utente */
?>
<p class="occhiello">A bordo</p>
<h1>Plancia</h1>

<div class="schermo" id="plancia"
     data-ws="<?= e($wsUrl) ?>"
     data-biglietto="<?= e($biglietto) ?>"
     data-url-biglietto="<?= e(url('/biglietto')) ?>"
     data-csrf="<?= e(csrf_token()) ?>">
  <div class="vetro">
    <p class="riga-stato"><span class="spia" data-stato="spento"></span>
      <span id="stato-collegamento">In attesa del collegamento…</span></p>
    <pre id="registro-bordo" aria-live="polite"></pre>
  </div>
</div>

<div class="nota">
  Fase F0: la plancia verifica soltanto che il collegamento con il server di gioco funzioni
  (biglietto firmato, presentazione, battito). Le stazioni arrivano con la fase F1.
</div>

<script type="module" src="<?= e(asset('js/client/plancia.js')) ?>"></script>
