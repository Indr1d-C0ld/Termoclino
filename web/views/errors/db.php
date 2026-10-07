<?php /** @var bool $debug */ /** @var string $detail */ ?>
<p class="occhiello">Servizio non disponibile</p>
<h1>Il porto è chiuso per un momento</h1>
<p class="sommario">
  Non riesco a raggiungere la banca dati. Di solito è una cosa passeggera: riprova fra poco.
</p>
<?php if (!empty($debug)): ?>
  <div class="carta"><pre style="white-space:pre-wrap;margin:0"><?= e($detail ?? '') ?></pre></div>
<?php endif; ?>
