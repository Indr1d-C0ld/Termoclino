<?php
/** I messaggi lampo di una richiesta. Le classi seguono termoclino.css. */
$mappa = [
    'error'   => 'errore',
    'success' => 'riuscito',
    'warning' => 'attenzione',
    'info'    => '',
];
foreach ($mappa as $chiave => $classe):
    $msg = flash($chiave);
    if (!is_string($msg) || $msg === '') { continue; }
?>
<div class="avviso <?= $classe ?>" role="status"><?= e($msg) ?></div>
<?php endforeach; ?>
