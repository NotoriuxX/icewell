<?php
/* Sesiones propias en la BD (no las de PHP).
   - Cookie con 256 bits aleatorios; en la BD solo su SHA-256.
   - Cookie __Host- (en HTTPS): Secure, Path=/, sin Domain → no la puede pisar un subdominio.
   - HttpOnly (JavaScript no la lee) y SameSite=Strict (no viaja en peticiones de otro sitio).
   - Expira por inactividad (30 min) y por edad (8 h).
   - En cada petición se re-valida al usuario: si lo bloquean, cambian su clave o
     le cierran las sesiones, la sesión deja de valer al instante (sesiones_version).
   - Cada sesión tiene su token CSRF. */
declare(strict_types=1);

final class Sesion
{
    const INACTIVIDAD = 1800;
    const MAXIMO = 28800;
    private static ?array $actual = null;
    private static bool $leida = false;

    private static function nombreCookie(): string
    {
        return Http::esHttps() ? '__Host-icw_sesion' : 'icw_sesion';
    }

    private static function ponerCookie(string $valor, int $expira): void
    {
        setcookie(self::nombreCookie(), $valor, [
            'expires' => $expira, 'path' => '/', 'secure' => Http::esHttps(), 'httponly' => true, 'samesite' => 'Strict',
        ]);
    }

    public static function crear(array $usuario): array
    {
        $token = Cripto::token(32);
        $csrf = Cripto::token(32);
        $ahora = time();
        Bd::ejecutar('INSERT INTO sesiones (token_hash, usuario_id, csrf, version, creado, ultimo, ip, agente) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [Cripto::sha256($token), $usuario['id'], $csrf, (int)$usuario['sesiones_version'], $ahora, $ahora, Http::ip(), Http::agente()]);
        Bd::ejecutar('UPDATE usuarios SET ultimo_login = ?, ultimo_ip = ? WHERE id = ?', [$ahora, Http::ip(), $usuario['id']]);
        // sesión de navegador (sin expires): se va al cerrar el navegador; el servidor igual corta a las 8 h
        self::ponerCookie($token, 0);
        if (random_int(1, 20) === 1) Bd::ejecutar('DELETE FROM sesiones WHERE ultimo < ? OR creado < ?', [$ahora - self::INACTIVIDAD, $ahora - self::MAXIMO]);
        self::$leida = false;
        return ['csrf' => $csrf];
    }

    /** Sesión válida + usuario, o null. */
    public static function actual(): ?array
    {
        if (self::$leida) return self::$actual;
        self::$leida = true;
        $token = $_COOKIE[self::nombreCookie()] ?? '';
        if (!is_string($token) || !preg_match('/^[0-9a-f]{64}$/', $token)) return null;
        $s = Bd::uno('SELECT s.id AS sesion_id, s.csrf, s.version, s.creado AS s_creado, s.ultimo, u.*
                       FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ?', [Cripto::sha256($token)]);
        $ahora = time();
        if (!$s || $s['estado'] !== 'activo' || (int)$s['version'] !== (int)$s['sesiones_version']
            || $ahora - (int)$s['ultimo'] > self::INACTIVIDAD || $ahora - (int)$s['s_creado'] > self::MAXIMO) {
            if ($s) Bd::ejecutar('DELETE FROM sesiones WHERE id = ?', [$s['sesion_id']]);
            self::ponerCookie('', 1);
            return null;
        }
        if ($ahora - (int)$s['ultimo'] > 60) Bd::ejecutar('UPDATE sesiones SET ultimo = ? WHERE id = ?', [$ahora, $s['sesion_id']]);
        unset($s['hash'], $s['totp_secreto']);
        return self::$actual = $s;
    }

    public static function exigir(?string $rol = null): array
    {
        $s = self::actual();
        if (!$s) throw new ErrorHttp(401, 'Tu sesión expiró. Vuelve a entrar.');
        if ($rol === 'admin' && $s['rol'] !== 'admin') throw new ErrorHttp(403, 'Solo un administrador puede hacer esto.');
        return $s;
    }

    /** Para todo POST con sesión: el token CSRF de la sesión debe venir en X-CSRF-Token. */
    public static function exigirCsrf(array $s): void
    {
        $h = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($h) || !hash_equals($s['csrf'], $h)) throw new ErrorHttp(403, 'La página quedó desactualizada. Recárgala e inténtalo de nuevo.');
    }

    public static function cerrar(): void
    {
        $s = self::actual();
        if ($s) Bd::ejecutar('DELETE FROM sesiones WHERE id = ?', [$s['sesion_id']]);
        self::ponerCookie('', 1);
        self::$actual = null;
    }

    /** Cierra TODAS las sesiones de un usuario (cambio de clave, bloqueo, "cerrar en todos lados"). */
    public static function cerrarTodas(int $usuarioId): void
    {
        Bd::ejecutar('UPDATE usuarios SET sesiones_version = sesiones_version + 1 WHERE id = ?', [$usuarioId]);
        Bd::ejecutar('DELETE FROM sesiones WHERE usuario_id = ?', [$usuarioId]);
    }

    public static function listar(int $usuarioId): array
    {
        return Bd::todos('SELECT id, creado, ultimo, ip, agente FROM sesiones WHERE usuario_id = ? AND ultimo > ? ORDER BY ultimo DESC',
            [$usuarioId, time() - self::INACTIVIDAD]);
    }
}
