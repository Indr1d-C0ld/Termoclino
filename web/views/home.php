<?php /** @var int $equipaggi */ ?>
<section class="soglia">
  <p class="occhiello">Mare di Norvegia, 1989</p>
  <h1>Termoclino</h1>
  <p class="sommario">
    Sotto i cento metri l'acqua si raffredda di colpo e il suono si piega. Chi ci sta sotto
    sente senza essere sentito. Chi resta sopra corre di più, ma lo sente tutto l'oceano.
  </p>
</section>

<section class="colonne">
  <div class="carta">
    <h2>Un duello che si gioca ad ascoltare</h2>
    <p>
      Un Los Angeles contro un Alfa, ognuno al comando di un giocatore. Il 688 ha l'orecchio
      migliore e i siluri filoguidati; l'Alfa a 41 nodi sfugge a quasi tutto, ma a quella velocità
      è sordo e si fa sentire da lontanissimo. Vince chi sente per primo, e sa aspettare.
    </p>
  </div>
  <div class="carta">
    <h2>Il 1989, rifatto da sotto</h2>
    <p>
      Le stazioni, la sala di controllo e il nastro dei messaggi sono quelli del gioco originale.
      Sotto, tutto è nuovo: propagazione del suono vera, zone d'ombra e di convergenza, analisi del
      moto del bersaglio, siluri con filo, quote e programmi di ricerca.
    </p>
  </div>
</section>

<div class="bottoni centrati">
  <a class="bottone" href="<?= e(url('/arruolamento')) ?>">Arruolati</a>
  <a class="bottone secondario" href="<?= e(url('/accesso')) ?>">Sono già a bordo</a>
</div>

<p class="cruscotto-pubblico">
  <span class="cifra"><?= e((string) $equipaggi) ?></span>
  <span><?= $equipaggi === 1 ? 'comandante arruolato' : 'comandanti arruolati' ?></span>
</p>

<div class="nota">
  <strong>In costruzione.</strong> Questa è la fase F0: ci si arruola, si conferma l'indirizzo
  e si sale a bordo del server di gioco. Il primo battello in acqua arriva con la fase F1.
</div>
