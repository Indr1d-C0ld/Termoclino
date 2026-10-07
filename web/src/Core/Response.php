<?php

declare(strict_types=1);

namespace App\Core;

final class Response
{
    /** @param array<string,string> $headers */
    public function __construct(
        private string $body = '',
        private int $status = 200,
        private array $headers = [],
    ) {
    }

    public static function html(string $html, int $status = 200): self
    {
        return new self($html, $status, ['Content-Type' => 'text/html; charset=utf-8']);
    }

    public static function text(string $text, int $status = 200): self
    {
        return new self($text, $status, ['Content-Type' => 'text/plain; charset=utf-8']);
    }

    public static function json(mixed $data, int $status = 200): self
    {
        return new self(
            json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '{}',
            $status,
            ['Content-Type' => 'application/json; charset=utf-8'],
        );
    }

    public static function redirect(string $url, int $status = 302): self
    {
        return new self('', $status, ['Location' => $url]);
    }

    public function withHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;
        return $this;
    }

    public function status(): int
    {
        return $this->status;
    }

    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->status);

            // Header di sicurezza di base.
            //
            // `blob:` fra le sorgenti delle immagini non e' una concessione
            // generica: un URL blob: lo puo' fabbricare solo uno script della
            // pagina, da dati che la pagina ha gia' in mano, e non apre nessuna
            // porta verso l'esterno. Serve al riquadro di ritaglio, che mostra
            // l'anteprima del file scelto con `URL.createObjectURL()` prima
            // ancora di mandarlo al server. Senza, il browser blocca
            // l'immagine, il riquadro non compare e il giocatore legge soltanto
            // "non riesco a mostrarti l'anteprima" — che e' vero e non spiega
            // niente.
            $defaults = [
                'X-Content-Type-Options' => 'nosniff',
                'X-Frame-Options'        => 'SAMEORIGIN',
                'Referrer-Policy'        => 'same-origin',
                'Content-Security-Policy' => "default-src 'self'; img-src 'self' data: blob:; "
                    . "style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'self'; "
                    . "form-action 'self'; frame-ancestors 'self'; "
                    // Il client di gioco parla col server via WebSocket: si
                    // dichiara esplicitamente, anche quando e' sulla stessa
                    // origine (in sviluppo sta su un'altra porta).
                    . 'connect-src ' . self::origineConnessioni(),
            ];
            foreach ($defaults as $name => $value) {
                if (!isset($this->headers[$name])) {
                    header("{$name}: {$value}");
                }
            }
            foreach ($this->headers as $name => $value) {
                header("{$name}: {$value}");
            }
        }

        echo $this->body;
    }

    /**
     * Le origini a cui il browser puo' connettersi: la propria e quella del
     * server di gioco, se configurata con un indirizzo assoluto (ws://, wss://).
     */
    private static function origineConnessioni(): string
    {
        $fonti = ["'self'"];
        $ws = (string) Config::get('gioco.ws_url', '');
        if (preg_match('#^(wss?://[^/]+)#', $ws, $m) === 1) {
            $fonti[] = $m[1];
        }
        return implode(' ', $fonti);
    }
}
