<?php
/* Verificación en dos pasos (2FA) con app autenticadora (Google Authenticator,
   Microsoft Authenticator, 1Password…). RFC 6238: SHA-1, 30 s, 6 dígitos.
   Se acepta ±1 intervalo (reloj del teléfono desfasado) y cada código sirve una vez. */
declare(strict_types=1);

final class Totp
{
    const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function nuevoSecreto(): string
    {
        $b = random_bytes(20);
        $bits = '';
        foreach (str_split($b) as $c) $bits .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);
        $out = '';
        foreach (str_split($bits, 5) as $g) $out .= self::B32[bindec(str_pad($g, 5, '0'))];
        return $out;
    }

    private static function decodificar(string $s): string
    {
        $s = strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $s));
        $bits = '';
        foreach (str_split($s) as $c) $bits .= str_pad(decbin(strpos(self::B32, $c)), 5, '0', STR_PAD_LEFT);
        $out = '';
        foreach (str_split($bits, 8) as $byte) if (strlen($byte) === 8) $out .= chr(bindec($byte));
        return $out;
    }

    public static function codigo(string $secreto, int $paso): string
    {
        $h = hash_hmac('sha1', pack('J', $paso), self::decodificar($secreto), true);
        $o = ord($h[19]) & 0x0f;
        $n = ((ord($h[$o]) & 0x7f) << 24 | ord($h[$o + 1]) << 16 | ord($h[$o + 2]) << 8 | ord($h[$o + 3])) % 1000000;
        return str_pad((string)$n, 6, '0', STR_PAD_LEFT);
    }

    public static function verificar(string $secreto, string $codigo, int $usuarioId): bool
    {
        $codigo = preg_replace('/\s+/', '', $codigo);
        if (!preg_match('/^\d{6}$/', $codigo)) return false;
        $ahora = intdiv(time(), 30);
        foreach ([-1, 0, 1] as $d) {
            if (hash_equals(self::codigo($secreto, $ahora + $d), $codigo)) {
                $clave = $usuarioId . ':' . ($ahora + $d);
                if (Limites::contar('totp_usado', $clave) > 0) return false;   // mismo código dos veces = repetición
                Limites::registrar('totp_usado', $clave);
                return true;
            }
        }
        return false;
    }

    public static function uri(string $secreto, string $correo): string
    {
        return 'otpauth://totp/' . rawurlencode('Icewell:' . $correo) . '?secret=' . $secreto . '&issuer=Icewell&algorithm=SHA1&digits=6&period=30';
    }
}
