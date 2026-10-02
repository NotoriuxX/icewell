<?php
/* API del panel: web/api/index.php?r=<ruta>. Una sola puerta de entrada.
   Reglas que valen para TODAS las rutas:
   - respuestas JSON con cabeceras de seguridad;
   - todo POST exige mismo origen (X-Requested-With + Origin) y cuerpo JSON;
   - todo POST con sesión exige además el token CSRF de esa sesión;
   - un error interno nunca muestra detalles (se registra en el log del servidor). */
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

Http::cabeceras();
$ruta = is_string($_GET['r'] ?? null) ? $_GET['r'] : '';
$metodo = Http::metodo();

try {
    if ($metodo === 'POST') Http::exigirMismoOrigen();
    elseif ($metodo !== 'GET') throw new ErrorHttp(405, 'Método no permitido.');
    $post = fn() => Http::json();
    // con sesión + CSRF (+ rol opcional)
    $conSesion = function (?string $rol = null) use ($metodo): array {
        $s = Sesion::exigir($rol);
        if ($metodo === 'POST') Sesion::exigirCsrf($s);
        return $s;
    };
    $soloPost = function () use ($metodo) { if ($metodo !== 'POST') throw new ErrorHttp(405, 'Método no permitido.'); };

    switch ($ruta) {
        // ------------------------------------------------ públicas
        case 'config':
            Http::responder(['ok' => true, 'local' => Config::esLocal(), 'googleClientId' => (string)Config::get('google_client_id'),
                'dominios' => Config::get('dominios_permitidos'), 'desarrollador' => Http::permiteDesarrollador()]);
            break;
        case 'sesion':
            $s = Sesion::actual();
            if (!$s) throw new ErrorHttp(401, 'Sin sesión.');
            Http::responder(['ok' => true, 'usuario' => Auth::publico($s), 'csrf' => $s['csrf'],
                'puedePublicar' => Config::get('publicar_rol') !== 'admin' || $s['rol'] === 'admin', 'local' => Config::esLocal()]);
            break;
        case 'auth/login':            $soloPost(); Http::responder(Auth::login($post())); break;
        case 'auth/totp':             $soloPost(); Http::responder(Auth::loginTotp($post())); break;
        case 'auth/registro':         $soloPost(); Http::responder(Auth::registro($post())); break;
        case 'auth/verificar':        $soloPost(); Http::responder(Auth::verificarCorreo($post())); break;
        case 'auth/recuperar':        $soloPost(); Http::responder(Auth::recuperar($post())); break;
        case 'auth/enlace':           $soloPost(); Http::responder(Auth::validarEnlaceReset($post())); break;
        case 'auth/restablecer':      $soloPost(); Http::responder(Auth::restablecer($post())); break;
        case 'auth/google':           $soloPost(); Http::responder(Auth::google($post())); break;
        case 'auth/desarrollador':    $soloPost(); Http::responder(Auth::desarrollador()); break;
        case 'auth/salir':
            $soloPost();
            $s = Sesion::actual();
            if ($s) { Sesion::exigirCsrf($s); Auditoria::registrar((int)$s['id'], 'logout'); }
            Sesion::cerrar();
            Http::responder(['ok' => true]);
            break;
        case 'contacto':              $soloPost(); Http::responder(Solicitudes::recibir($post())); break;   // formulario del sitio
        case 'dev/bandeja':
            if (!Http::permiteDesarrollador()) throw new ErrorHttp(404, 'No encontrado.');
            Http::responder(['ok' => true, 'correos' => Correo::bandeja()]);
            break;

        // ------------------------------------------------ contenido
        case 'contenido':
            $conSesion();
            Http::responder(Panel::contenido());
            break;
        case 'contenido/guardar':     $soloPost(); $s = $conSesion(); Http::responder(Panel::guardar($post(), $s)); break;
        case 'contenido/publicar':    $soloPost(); $s = $conSesion(); Http::responder(Panel::publicar($post(), $s)); break;
        case 'historial':             $conSesion(); Http::responder(Panel::historial()); break;
        case 'historial/version':     $conSesion(); Http::responder(Panel::version((int)($_GET['id'] ?? 0))); break;
        case 'imagen':                $soloPost(); $s = $conSesion(); Http::responder(Imagenes::guardar($post(), (int)$s['id'])); break;

        // ------------------------------------------------ solicitudes del formulario
        case 'solicitudes':           $conSesion(); Http::responder(Solicitudes::listar()); break;
        case 'solicitudes/nuevas':    $conSesion(); Http::responder(['ok' => true, 'n' => Solicitudes::nuevas()]); break;
        case 'solicitudes/estado':    $soloPost(); $s = $conSesion(); Http::responder(Solicitudes::estado($post(), $s)); break;
        case 'solicitudes/borrar':    $soloPost(); $s = $conSesion('admin'); Http::responder(Solicitudes::borrar($post(), $s)); break;

        // ------------------------------------------------ usuarios y auditoría (admin)
        case 'usuarios':              $conSesion('admin'); Http::responder(Panel::usuarios()); break;
        case 'usuarios/actualizar':   $soloPost(); $s = $conSesion('admin'); Http::responder(Panel::actualizarUsuario($post(), $s)); break;
        case 'auditoria':
            $conSesion('admin');
            Http::responder(['ok' => true, 'eventos' => array_map(fn($e) => ['accion' => $e['accion'], 'detalle' => $e['detalle'], 'ip' => $e['ip'],
                'fecha' => (int)$e['creado'], 'usuario' => $e['nombre'] ?? '—'], Auditoria::ultimas(300))]);
            break;

        // ------------------------------------------------ mi cuenta
        case 'cuenta/clave':          $soloPost(); $s = $conSesion(); Http::responder(Panel::cambiarMiClave($post(), $s)); break;
        case 'cuenta/sesiones':       $s = $conSesion(); Http::responder(['ok' => true, 'sesiones' => Sesion::listar((int)$s['id']), 'actual' => (int)$s['sesion_id']]); break;
        case 'cuenta/cerrar-todas':
            $soloPost(); $s = $conSesion();
            Sesion::cerrarTodas((int)$s['id']);
            Auditoria::registrar((int)$s['id'], 'sesiones.cerradas');
            Http::responder(['ok' => true]);
            break;
        case 'cuenta/2fa/iniciar':    $soloPost(); $s = $conSesion(); Http::responder(Panel::totpIniciar($s)); break;
        case 'cuenta/2fa/activar':    $soloPost(); $s = $conSesion(); Http::responder(Panel::totpActivar($post(), $s)); break;
        case 'cuenta/2fa/desactivar': $soloPost(); $s = $conSesion(); Http::responder(Panel::totpDesactivar($post(), $s)); break;

        default:
            throw new ErrorHttp(404, 'No encontrado.');
    }
} catch (ErrorHttp $e) {
    Http::responder(['ok' => false, 'error' => $e->getMessage()] + $e->extra, $e->estado);
} catch (Throwable $e) {
    error_log('[icewell api] ' . $ruta . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Http::responder(['ok' => false, 'error' => 'Error interno. Inténtalo de nuevo en un momento.'], 500);
}
