<?php
/* "Entrar con Google" (Google Identity Services).
   El navegador recibe de Google un ID token (JWT firmado) y lo manda acá.
   El servidor NO confía en lo que diga el navegador: verifica
     - la firma RS256 con las llaves públicas de Google (JWKS, en caché),
     - aud = nuestro client id, iss = Google, exp/iat vigentes,
     - email_verified, y que el dominio de la cuenta (claim hd Y el correo)
       sea el de la empresa. */
declare(strict_types=1);

final class Google
{
    const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
    const EMISORES = ['accounts.google.com', 'https://accounts.google.com'];

    public static function verificar(string $jwt): array
    {
        $cliente = (string)Config::get('google_client_id');
        if ($cliente === '') throw new ErrorHttp(404, 'La entrada con Google no está habilitada.');
        $partes = explode('.', $jwt);
        if (count($partes) !== 3 || strlen($jwt) > 4096) throw new ErrorHttp(401, 'No se pudo verificar la cuenta de Google.');
        [$h64, $p64, $f64] = $partes;
        $cab = json_decode(self::b64($h64), true);
        $pl = json_decode(self::b64($p64), true);
        if (!is_array($cab) || !is_array($pl) || ($cab['alg'] ?? '') !== 'RS256' || empty($cab['kid'])) {
            throw new ErrorHttp(401, 'No se pudo verificar la cuenta de Google.');
        }
        $pem = self::llave((string)$cab['kid']);
        if (!$pem || openssl_verify($h64 . '.' . $p64, self::b64($f64), $pem, OPENSSL_ALGO_SHA256) !== 1) {
            throw new ErrorHttp(401, 'No se pudo verificar la cuenta de Google.');
        }
        $ahora = time();
        if (!in_array($pl['iss'] ?? '', self::EMISORES, true) || ($pl['aud'] ?? '') !== $cliente
            || (int)($pl['exp'] ?? 0) < $ahora - 60 || (int)($pl['iat'] ?? 0) > $ahora + 300 || empty($pl['sub'])) {
            throw new ErrorHttp(401, 'No se pudo verificar la cuenta de Google.');
        }
        $correo = strtolower((string)($pl['email'] ?? ''));
        $dominios = (array)Config::get('dominios_permitidos');
        if (($pl['email_verified'] ?? false) !== true || !in_array(strtolower((string)($pl['hd'] ?? '')), $dominios, true) || !Auth::dominioPermitido($correo)) {
            throw new ErrorHttp(403, 'Solo se puede entrar con una cuenta de Google de la empresa (@' . implode(', @', $dominios) . ').');
        }
        $pl['email'] = $correo;
        return $pl;
    }

    private static function b64(string $s): string
    {
        $r = base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true);
        return $r === false ? '' : $r;
    }

    /** Llave pública (PEM) para un kid, desde la caché o descargando las de Google. */
    private static function llave(string $kid): ?string
    {
        $llaves = self::jwks(false);
        if (!isset($llaves[$kid])) $llaves = self::jwks(true);   // Google rota las llaves: si no está, refrescar una vez
        $k = $llaves[$kid] ?? null;
        if (!$k || ($k['kty'] ?? '') !== 'RSA') return null;
        return self::pem(self::b64($k['n']), self::b64($k['e']));
    }

    private static function jwks(bool $forzar): array
    {
        $prueba = Config::get('google_jwks');   // solo pruebas: llaves inyectadas
        if (is_array($prueba)) return $prueba;
        $cache = Config::get('dir_datos') . '/google-jwks.json';
        if (!$forzar && is_file($cache)) {
            $c = json_decode((string)file_get_contents($cache), true);
            if (is_array($c) && ($c['vence'] ?? 0) > time()) return $c['llaves'];
        }
        // curl si existe (muchos hostings apagan allow_url_fopen); si no, file_get_contents
        $cuerpo = ''; $cabeceras = '';
        if (function_exists('curl_init')) {
            $c = curl_init(self::JWKS_URL);
            curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_HEADERFUNCTION => function ($ch, $h) use (&$cabeceras) { $cabeceras .= $h; return strlen($h); }]);
            $cuerpo = (string)curl_exec($c);
            curl_close($c);
        } else {
            $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true], 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
            $cuerpo = (string)@file_get_contents(self::JWKS_URL, false, $ctx);
            $cabeceras = implode("\n", $http_response_header ?? []);
        }
        $d = $cuerpo ? json_decode($cuerpo, true) : null;
        if (!is_array($d) || empty($d['keys'])) return [];
        $llaves = [];
        foreach ($d['keys'] as $k) if (!empty($k['kid'])) $llaves[$k['kid']] = $k;
        $vida = 3600;
        if (preg_match('/max-age=(\d+)/i', $cabeceras, $m)) $vida = min((int)$m[1], 86400);
        @file_put_contents($cache, json_encode(['vence' => time() + $vida, 'llaves' => $llaves]), LOCK_EX);
        return $llaves;
    }

    // ---- JWK (n, e) → PEM: DER de SubjectPublicKeyInfo armado a mano (sin librerías) ----
    private static function der(int $tag, string $v): string
    {
        $n = strlen($v);
        if ($n < 0x80) $len = chr($n);
        else { $b = ltrim(pack('N', $n), "\0"); $len = chr(0x80 | strlen($b)) . $b; }
        return chr($tag) . $len . $v;
    }
    private static function entero(string $b): string
    {
        $b = ltrim($b, "\0");
        if ($b === '' || ord($b[0]) > 0x7f) $b = "\0" . $b;
        return self::der(0x02, $b);
    }
    public static function pem(string $n, string $e): string
    {
        $rsa = self::der(0x30, self::entero($n) . self::entero($e));
        $alg = self::der(0x30, self::der(0x06, "\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01") . "\x05\x00");
        $spki = self::der(0x30, $alg . self::der(0x03, "\0" . $rsa));
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }
}
