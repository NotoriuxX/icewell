<?php
/* Tokens de un solo uso para enlaces por correo (recuperar contraseña, verificar
   correo) y para el segundo paso del login con 2FA.

   Patrón selector + verificador:
     - el enlace lleva ?id=<selector>&t=<verificador>
     - la BD guarda el selector (para buscar) y SOLO el SHA-256 del verificador
     - se compara con hash_equals (tiempo constante)
   Si alguien lee la BD no puede armar un enlace válido; si adivina un selector,
   le falta el verificador (256 bits). */
declare(strict_types=1);

final class Tokens
{
    const DURACION = [
        'reset'        => 1800,      // 30 min
        'verificacion' => 86400,     // 24 h
        'desafio_totp' => 300,       // 5 min entre la clave y el código de 6 dígitos
    ];

    /** @return array{0:string,1:string} [selector, verificador] */
    public static function crear(int $usuarioId, string $tipo): array
    {
        // un enlace nuevo invalida los anteriores del mismo tipo
        Bd::ejecutar('UPDATE tokens SET usado = 1 WHERE usuario_id = ? AND tipo = ? AND usado = 0', [$usuarioId, $tipo]);
        $selector = Cripto::token(16);
        $verificador = Cripto::token(32);
        Bd::ejecutar('INSERT INTO tokens (selector, verificador_hash, usuario_id, tipo, expira, creado) VALUES (?, ?, ?, ?, ?, ?)',
            [$selector, Cripto::sha256($verificador), $usuarioId, $tipo, time() + self::DURACION[$tipo], time()]);
        if (random_int(1, 20) === 1) Bd::ejecutar('DELETE FROM tokens WHERE expira < ?', [time() - 86400 * 7]);
        return [$selector, $verificador];
    }

    /** Revisa sin gastar. Devuelve la fila o null. */
    public static function revisar(string $selector, string $verificador, string $tipo): ?array
    {
        if (!preg_match('/^[0-9a-f]{32}$/', $selector) || !preg_match('/^[0-9a-f]{64}$/', $verificador)) return null;
        $t = Bd::uno('SELECT * FROM tokens WHERE selector = ? AND tipo = ?', [$selector, $tipo]);
        if (!$t || (int)$t['usado'] === 1 || (int)$t['expira'] < time()) return null;
        if (!hash_equals($t['verificador_hash'], Cripto::sha256($verificador))) return null;
        return $t;
    }

    /** Revisa y gasta en una sola operación: dos pestañas no pueden usar el mismo enlace. */
    public static function consumir(string $selector, string $verificador, string $tipo): ?array
    {
        $t = self::revisar($selector, $verificador, $tipo);
        if (!$t) return null;
        $n = Bd::ejecutar('UPDATE tokens SET usado = 1 WHERE id = ? AND usado = 0', [$t['id']])->rowCount();
        return $n === 1 ? $t : null;
    }
}
