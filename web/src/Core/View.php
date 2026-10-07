<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;

final class View
{
    private static string $viewPath = '';

    public static function setPath(string $path): void
    {
        self::$viewPath = rtrim($path, '/');
    }

    /** @param array<string,mixed> $data */
    public static function render(string $name, array $data = [], ?string $layout = 'layout'): string
    {
        $content = self::renderPartial($name, $data);

        if ($layout === null) {
            return $content;
        }

        return self::renderPartial($layout, $data + [
            'content' => $content,
            'title'   => $data['title'] ?? Config::get('app.name', 'Termoclino'),
            'ambiente'  => self::ambiente($name),
            'larghezza' => self::larghezza($name),
        ]);
    }

    /**
     * Quale «aria» respira la pagina.
     *
     * Le pagine di soglia — ingresso, arruolamento, conferma, errore — stanno
     * «in superficie»: fondo scuro di mare notturno, niente strumenti. Le pagine
     * di bordo (plancia, profilo, lobby) hanno l'aria della sala di controllo.
     * Elencare le soglie e' piu' difficile da sbagliare quando se ne aggiunge
     * una: una pagina dimenticata finisce a bordo, non al largo.
     */
    private static function ambiente(string $vista): string
    {
        $vista = ltrim($vista, '/');
        if ($vista === 'home'
            || str_starts_with($vista, 'auth/')
            || str_starts_with($vista, 'errors/')) {
            return 'superficie';
        }
        return 'bordo';
    }

    /**
     * Quanto e' larga la colonna.
     *
     * Il corpo del sito e' tarato sulla lettura (42rem). Fanno eccezione la
     * plancia, che contiene lo schermo di gioco, e il pannello di
     * amministrazione, fatto di tabelle larghe.
     */
    private static function larghezza(string $vista): string
    {
        $v = ltrim($vista, '/');
        return ($v === 'gioco/plancia' || str_starts_with($v, 'admin/')) ? 'largo' : '';
    }

    /** @param array<string,mixed> $data */
    public static function renderPartial(string $name, array $data = []): string
    {
        $file = self::$viewPath . '/' . ltrim($name, '/') . '.php';
        if (!is_file($file)) {
            throw new RuntimeException("Vista non trovata: {$name} ({$file})");
        }

        $render = static function (string $__file, array $__data): string {
            extract($__data, EXTR_SKIP);
            ob_start();
            require $__file;
            return (string) ob_get_clean();
        };

        return $render($file, $data);
    }
}
