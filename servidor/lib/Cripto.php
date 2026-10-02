<?php
/* Cifrado de secretos guardados en la BD (p.ej. el secreto TOTP) con libsodium
   (XSalsa20-Poly1305, autenticado). Si alguien copia la BD sin config.php, no
   puede leerlos. */
declare(strict_types=1);

final class Cripto
{
    private static function clave(): string
    {
        return sodium_hex2bin((string)Config::get('clave_cifrado'));
    }

    public static function cifrar(string $texto): string
    {
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        return 'v1:' . sodium_bin2base64($nonce . sodium_crypto_secretbox($texto, $nonce, self::clave()), SODIUM_BASE64_VARIANT_ORIGINAL);
    }

    public static function descifrar(?string $c): ?string
    {
        if (!$c || !str_starts_with($c, 'v1:')) return null;
        try { $b = sodium_base642bin(substr($c, 3), SODIUM_BASE64_VARIANT_ORIGINAL); }
        catch (SodiumException $e) { return null; }
        if (strlen($b) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) return null;
        $r = sodium_crypto_secretbox_open(substr($b, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), substr($b, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), self::clave());
        return $r === false ? null : $r;
    }

    /** Token aleatorio en hexadecimal (bytes de entropía). */
    public static function token(int $bytes = 32): string { return bin2hex(random_bytes($bytes)); }

    public static function sha256(string $s): string { return hash('sha256', $s); }
}
