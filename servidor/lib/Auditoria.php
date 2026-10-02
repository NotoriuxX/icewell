<?php
/* Registro de acciones: quién hizo qué y cuándo (entradas, intentos fallidos,
   aprobaciones, guardados, publicaciones). Lo ve el admin en el panel. */
declare(strict_types=1);

final class Auditoria
{
    public static function registrar(?int $usuarioId, string $accion, string $detalle = ''): void
    {
        $ip = PHP_SAPI === 'cli' ? 'consola' : Http::ip();
        Bd::ejecutar('INSERT INTO auditoria (usuario_id, accion, detalle, ip, creado) VALUES (?, ?, ?, ?, ?)',
            [$usuarioId, substr($accion, 0, 40), mb_substr($detalle, 0, 500), $ip, time()]);
    }

    public static function ultimas(int $n = 200): array
    {
        return Bd::todos('SELECT a.id, a.accion, a.detalle, a.ip, a.creado, u.nombre, u.email FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id ORDER BY a.id DESC LIMIT ' . max(1, min(1000, $n)));
    }
}
