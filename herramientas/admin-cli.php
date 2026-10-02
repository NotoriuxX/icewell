<?php
/* ==========================================================================
   ICEWELL — Herramientas de administración por consola
   Sirven para el primer acceso (crear el admin) y para emergencias
   (desbloquear, resetear clave) sin depender del navegador.

     php herramientas/admin-cli.php publicar-semilla     genera los JS públicos desde servidor/semilla.json
     php herramientas/admin-cli.php crear-admin <correo> <nombre>
     php herramientas/admin-cli.php listar
     php herramientas/admin-cli.php aprobar <correo> [admin|editor]
     php herramientas/admin-cli.php bloquear <correo>
     php herramientas/admin-cli.php resetear-clave <correo>   (pide la clave nueva sin mostrarla)
     php herramientas/admin-cli.php migrar               crea/actualiza las tablas
   ========================================================================== */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$RAIZ = dirname(__DIR__);
$cmd = $argv[1] ?? '';

function salir(string $msg, int $codigo = 1): void { fwrite($codigo ? STDERR : STDOUT, $msg . "\n"); exit($codigo); }

if ($cmd === 'publicar-semilla') {
    // No necesita BD ni config: solo convierte la semilla en los JS públicos.
    require $RAIZ . '/servidor/lib/Contenido.php';
    $c = json_decode((string)file_get_contents($RAIZ . '/servidor/semilla.json'), true);
    [$limpio, $errores] = Contenido::validar($c, $RAIZ . '/web/assets');
    if ($errores) salir("La semilla tiene errores:\n" . implode("\n", array_map(fn($e) => " - {$e['campo']}: {$e['error']}", $errores)));
    foreach (Contenido::publicar($limpio, $RAIZ . '/web') as $f) echo 'Escrito ' . substr($f, strlen($RAIZ) + 1) . "\n";
    exit(0);
}

require $RAIZ . '/servidor/bootstrap.php';

function pedirClave(string $msg): string
{
    fwrite(STDOUT, $msg);
    if (DIRECTORY_SEPARATOR === '/' && posix_isatty(STDIN)) { system('stty -echo'); $c = trim((string)fgets(STDIN)); system('stty echo'); fwrite(STDOUT, "\n"); return $c; }
    return trim((string)fgets(STDIN));
}

switch ($cmd) {
    case 'migrar':
        Bd::migrar();
        salir('Tablas al día.', 0);

    case 'crear-admin':
        [$correo, $nombre] = [$argv[2] ?? '', $argv[3] ?? ''];
        if ($correo === '' || $nombre === '') salir('Uso: crear-admin <correo> <nombre>');
        $correo = Auth::normalizarCorreo($correo);
        // en local se permite cualquier correo (para entrar en beta sin cuenta de la empresa)
        if (!Config::esLocal() && !Auth::dominioPermitido($correo)) salir('En producción el admin debe tener correo de ' . implode(', ', Config::get('dominios_permitidos')));
        $clave = getenv('ICEWELL_CLAVE') ?: pedirClave('Clave (mín. 12 caracteres): ');
        if ($err = Auth::problemaClave($clave, $correo, $nombre)) salir($err);
        Bd::migrar();
        $id = Auth::crearUsuario($nombre, $correo, $clave, 'admin', 'activo');
        Auditoria::registrar($id, 'cli.crear_admin', $correo);
        salir("Admin creado: $correo", 0);

    case 'listar':
        foreach (Bd::todos('SELECT email, nombre, rol, estado, ultimo_login FROM usuarios ORDER BY id') as $u) {
            printf("%-34s %-22s %-7s %-22s %s\n", $u['email'], $u['nombre'], $u['rol'], $u['estado'], $u['ultimo_login'] ?? '-');
        }
        exit(0);

    case 'aprobar':
    case 'bloquear':
        $correo = Auth::normalizarCorreo($argv[2] ?? '');
        $u = Bd::uno('SELECT id FROM usuarios WHERE email = ?', [$correo]) ?? salir('No existe ese usuario.');
        if ($cmd === 'aprobar') {
            $rol = in_array($argv[3] ?? 'editor', ['admin', 'editor'], true) ? ($argv[3] ?? 'editor') : 'editor';
            Bd::ejecutar("UPDATE usuarios SET estado = 'activo', rol = ? WHERE id = ?", [$rol, $u['id']]);
        } else {
            Bd::ejecutar("UPDATE usuarios SET estado = 'bloqueado', sesiones_version = sesiones_version + 1 WHERE id = ?", [$u['id']]);
        }
        Auditoria::registrar((int)$u['id'], "cli.$cmd", $correo);
        salir('Listo.', 0);

    case 'resetear-clave':
        $correo = Auth::normalizarCorreo($argv[2] ?? '');
        $u = Bd::uno('SELECT id, nombre FROM usuarios WHERE email = ?', [$correo]) ?? salir('No existe ese usuario.');
        $clave = getenv('ICEWELL_CLAVE') ?: pedirClave('Clave nueva (mín. 12 caracteres): ');
        if ($err = Auth::problemaClave($clave, $correo, $u['nombre'])) salir($err);
        Auth::cambiarClave((int)$u['id'], $clave);
        Auditoria::registrar((int)$u['id'], 'cli.resetear_clave', $correo);
        salir('Clave cambiada y sesiones cerradas.', 0);

    default:
        salir("Comandos: publicar-semilla | migrar | crear-admin <correo> <nombre> | listar | aprobar <correo> [admin|editor] | bloquear <correo> | resetear-clave <correo>");
}
