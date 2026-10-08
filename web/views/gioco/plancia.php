<?php
/** @var string $wsUrl */
/** @var string $biglietto */
/** @var array<string,mixed> $utente */
// In sviluppo (app.debug) il client espone la regia alla console del browser
// (window.termoclino) per le verifiche; in esercizio l'attributo non c'e'.
$sviluppo = (bool) config('app.debug', false);
?>
<link rel="stylesheet" href="<?= e(asset('css/plancia.css')) ?>">

<div class="plancia" id="plancia"
     data-ws="<?= e($wsUrl) ?>"
     data-biglietto="<?= e($biglietto) ?>"
     data-url-biglietto="<?= e(url('/biglietto')) ?>"
     data-csrf="<?= e(csrf_token()) ?>"
     data-originali="<?= e(url('/originali/')) ?>"
     data-shared="<?= e(root_url('/assets/shared/')) ?>"
     data-uscita="<?= e(url('/')) ?>"
     data-lingua="it"<?= $sviluppo ? ' data-sviluppo="1"' : '' ?>>
  <div class="plancia-vetro">
    <canvas id="schermo-classic" width="320" height="200" tabindex="0"
            aria-label="Plancia del sottomarino: usa F1 per l'aiuto"></canvas>
    <pre class="capo" hidden>A:\RATCLIFF&gt;<span class="capo-cursore">_</span></pre>
  </div>
  <p class="riga-stato"><span class="spia" data-stato="spento"></span>
    <span id="stato-collegamento">In attesa del collegamento…</span>
    <span class="tasti">F1 aiuto e assistenza · F2–F8 stazioni · F9 CONN · F10 capo</span></p>
  <p class="crediti" id="crediti-mappa" hidden></p>
</div>

<noscript><p class="nota">La plancia ha bisogno di JavaScript.</p></noscript>

<script type="module" src="<?= e(asset('js/client/plancia.js')) ?>"></script>
