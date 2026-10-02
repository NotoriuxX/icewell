<?php
/* Entrada/salida HTTP de la API: JSON, cabeceras de seguridad, IP del cliente,
   chequeo de origen. */
declare(strict_types=1);

final class ErrorHttp extends RuntimeException
{
    public int $estado;
    public array $extra;
    public function __construct(int $estado, string $mensaje, array $extra = [])
    {
        parent::__construct($mensaje);
        $this->estado = $estado;
        $this->extra = $extra;
    }
}

final class Http
{
    const MAX_CUERPO = 12 * 1024 * 1024;   // 12 MB: alcanza para una foto de 8 MB en base64

    public static function cabeceras(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, max-age=0');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: no-referrer');
        header('X-Frame-Options: DENY');
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
        header('Cross-Origin-Resource-Policy: same-origin');
        if (self::esHttps()) header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        header_remove('X-Powered-By');
    }

    public static function esHttps(): bool
    {
        if ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443) return true;
        // detrás de un proxy HTTPS (Caddy en Docker, Cloudflare): solo se cree a X-Forwarded-Proto si viene de un proxy confiable
        return self::desdeProxyConfiable() && strtolower(trim(explode(',', (string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0])) === 'https';
    }

    /** ¿La petición llegó desde un proxy de la lista proxies_confiables (IPs o rangos CIDR, p.ej. 172.16.0.0/12)? */
    public static function desdeProxyConfiable(): bool
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        foreach ((array)Config::get('proxies_confiables') as $p) if (self::ipEnRango($ip, (string)$p)) return true;
        return false;
    }

    public static function ipEnRango(string $ip, string $rango): bool
    {
        if (!str_contains($rango, '/')) return $ip !== '' && $ip === $rango;
        [$red, $bits] = explode('/', $rango, 2);
        $a = @inet_pton($ip); $b = @inet_pton($red);
        if ($a === false || $b === false || strlen($a) !== strlen($b)) return false;
        $bits = (int)$bits;
        if ($bits < 0 || $bits > strlen($a) * 8) return false;
        $bytes = intdiv($bits, 8); $resto = $bits % 8;
        if (substr($a, 0, $bytes) !== substr($b, 0, $bytes)) return false;
        if ($resto === 0) return true;
        $m = chr((0xFF << (8 - $resto)) & 0xFF);
        return (ord($a[$bytes]) & ord($m)) === (ord($b[$bytes]) & ord($m));
    }

    public static function responder(array $datos, int $estado = 200): void
    {
        http_response_code($estado);
        echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function metodo(): string { return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'); }

    /** Cuerpo JSON (objeto). Rechaza otros Content-Type: un <form> de otro sitio no puede mandar JSON. */
    public static function json(): array
    {
        $tipo = strtolower($_SERVER['CONTENT_TYPE'] ?? '');
        if (!str_starts_with($tipo, 'application/json')) throw new ErrorHttp(415, 'Se esperaba JSON.');
        $largo = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($largo > self::MAX_CUERPO) throw new ErrorHttp(413, 'La solicitud es demasiado grande.');
        $crudo = file_get_contents('php://input', false, null, 0, self::MAX_CUERPO + 1);
        if ($crudo === false || strlen($crudo) > self::MAX_CUERPO) throw new ErrorHttp(413, 'La solicitud es demasiado grande.');
        $d = json_decode($crudo, true, 64);
        if (!is_array($d)) throw new ErrorHttp(400, 'JSON inválido.');
        return $d;
    }

    /** IP del cliente. Solo se cree a X-Forwarded-For si viene de un proxy configurado. */
    public static function ip(): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        if (self::desdeProxyConfiable() && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $partes = array_map('trim', explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']));
            $real = end($partes);
            if (filter_var($real, FILTER_VALIDATE_IP)) $ip = $real;
        }
        return substr($ip, 0, 45);
    }

    /** "Entrar como desarrollador": solo modo local, y desde la misma PC (o Docker local con ICEWELL_DESARROLLADOR=1). */
    public static function permiteDesarrollador(): bool
    {
        return Config::esLocal() && (self::esIpLocal() || Config::get('desarrollador') === true);
    }

    public static function esIpLocal(): bool
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        return $ip === '127.0.0.1' || $ip === '::1';
    }

    public static function agente(): string
    {
        return mb_substr(preg_replace('/[\x00-\x1F\x7F]/', '', (string)($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 200);
    }

    /**
     * Toda petición que cambia algo debe venir del mismo sitio:
     *  - cabecera X-Requested-With: icewell (un sitio ajeno no puede ponerla sin pasar por CORS, que no se habilita)
     *  - Origin (o Referer) igual al host propio.
     */
    public static function exigirMismoOrigen(): void
    {
        if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'icewell') throw new ErrorHttp(403, 'Solicitud rechazada.');
        $origen = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origen === '' && !empty($_SERVER['HTTP_REFERER'])) {
            $p = parse_url($_SERVER['HTTP_REFERER']);
            if ($p && isset($p['scheme'], $p['host'])) $origen = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
        }
        if ($origen === '') return;   // algunos navegadores no mandan Origin en mismo origen; el header personalizado ya cubre
        $permitidos = [];
        $base = (string)Config::get('url_base');
        if ($base !== '') $permitidos[] = rtrim($base, '/');
        if (Config::esLocal() && !empty($_SERVER['HTTP_HOST'])) {
            $permitidos[] = 'http://' . $_SERVER['HTTP_HOST'];
            $permitidos[] = 'https://' . $_SERVER['HTTP_HOST'];
        }
        // también se acepta www/sin www del dominio configurado
        foreach ($permitidos as $p) {
            $alt = preg_replace('#^(https?://)www\.#', '$1', $p);
            $permitidos[] = $alt === $p ? preg_replace('#^(https?://)#', '$1www.', $p) : $alt;
        }
        if (!in_array(rtrim($origen, '/'), $permitidos, true)) throw new ErrorHttp(403, 'Origen no permitido.');
    }

    /** URL base para los enlaces de los correos. En producción, SIEMPRE la de config. */
    public static function urlBase(): string
    {
        $b = (string)Config::get('url_base');
        if ($b !== '') return rtrim($b, '/');
        if (self::permiteDesarrollador() && !empty($_SERVER['HTTP_HOST']) && preg_match('/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/', $_SERVER['HTTP_HOST'])) {
            return 'http://' . $_SERVER['HTTP_HOST'];
        }
        return 'http://localhost:8765';
    }
}
