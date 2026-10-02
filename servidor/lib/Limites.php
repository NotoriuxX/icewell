<?php
/* Límite de intentos (fuerza bruta, abuso de registro/recuperación).
   Se cuenta por IP y por correo por separado: probar muchas claves contra una
   cuenta desde muchas IPs, o muchas cuentas desde una IP, se frena igual. */
declare(strict_types=1);

final class Limites
{
    // tipo => [máximo, ventana en segundos]
    const REGLAS = [
        'login_ip'        => [20, 900],
        'login_correo'    => [5, 900],
        'totp'            => [6, 900],
        'registro_ip'     => [10, 3600],
        'recuperar_ip'    => [10, 3600],
        'recuperar_correo'=> [3, 3600],
        'token_ip'        => [30, 900],     // probar enlaces de recuperación/verificación al azar
        'google_ip'       => [30, 900],
        'subida_usuario'  => [120, 3600],
        'totp_usado'      => [1, 120],      // un código de 6 dígitos sirve una sola vez
        'contacto_ip'     => [5, 3600],     // formulario del sitio: 5 solicitudes por hora y por IP
    ];

    public static function registrar(string $tipo, string $clave): void
    {
        Bd::ejecutar('INSERT INTO intentos (tipo, clave, momento) VALUES (?, ?, ?)', [$tipo, self::k($clave), time()]);
        if (random_int(1, 50) === 1) Bd::ejecutar('DELETE FROM intentos WHERE momento < ?', [time() - 86400]);
    }

    public static function contar(string $tipo, string $clave): int
    {
        [, $ventana] = self::REGLAS[$tipo];
        return (int)Bd::uno('SELECT COUNT(*) AS n FROM intentos WHERE tipo = ? AND clave = ? AND momento > ?', [$tipo, self::k($clave), time() - $ventana])['n'];
    }

    /** Lanza 429 si se pasó el límite. El mensaje no dice qué límite (no ayuda al atacante). */
    public static function exigir(string $tipo, string $clave): void
    {
        [$max, $ventana] = self::REGLAS[$tipo];
        if (self::contar($tipo, $clave) >= $max) {
            $min = (int)ceil($ventana / 60);
            throw new ErrorHttp(429, "Demasiados intentos. Espera unos $min minutos e inténtalo de nuevo.", ['reintentar' => $ventana]);
        }
    }

    public static function limpiar(string $tipo, string $clave): void
    {
        Bd::ejecutar('DELETE FROM intentos WHERE tipo = ? AND clave = ?', [$tipo, self::k($clave)]);
    }

    // el correo se guarda como hash: la tabla de intentos no es una lista de correos
    private static function k(string $c): string { return hash('sha256', strtolower($c)); }
}
