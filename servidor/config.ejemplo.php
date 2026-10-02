<?php
/* ==========================================================================
   ICEWELL — Configuración del servidor del panel (/admin)

   Copiar este archivo como servidor/config.php y completar.
   config.php NO va a git (tiene secretos) y debe quedar FUERA de public_html.

   En local (php -S en tu PC) no hace falta: sin config.php el servidor arranca
   en modo 'local' con SQLite y secretos generados en servidor/datos/.
   ========================================================================== */
return [
    // 'produccion' | 'local'. En 'local' los correos van a la bandeja de prueba
    // (/admin/bandeja.html) y existe "Entrar como desarrollador" (solo desde 127.0.0.1).
    'entorno' => 'produccion',

    // Dirección pública del sitio, SIN barra final. Se usa para armar los enlaces de los
    // correos (recuperar contraseña, verificar). Nunca se toma del navegador: un Host
    // falso podría mandar enlaces a otro dominio.
    'url_base' => 'https://www.icewell.cl',

    // ---- Base de datos (hosting compartido: MySQL / MariaDB) ----
    'bd' => [
        'driver'   => 'mysql',              // 'mysql' | 'sqlite'
        'host'     => 'localhost',
        'puerto'   => 3306,
        'nombre'   => 'icewell_panel',
        'usuario'  => 'icewell_panel',
        'clave'    => 'CAMBIAR',
        // 'sqlite' => __DIR__ . '/datos/icewell.sqlite',   // si driver = sqlite
    ],

    // ---- Secretos: generar cada uno con   php -r "echo bin2hex(random_bytes(32)), PHP_EOL;" ----
    // pepper: se mezcla con cada contraseña antes del hash. Si la BD se filtra, sin el pepper
    // los hashes no sirven para probar claves. NO cambiarlo después: invalida todas las claves.
    'pepper'       => 'CAMBIAR_64_HEX',
    // clave de cifrado (libsodium) para secretos guardados en la BD (TOTP).
    'clave_cifrado' => 'CAMBIAR_64_HEX',

    // ---- Quién puede entrar ----
    'dominios_permitidos' => ['icewell.cl'],
    // Este correo queda como administrador al verificarse (o al entrar con Google).
    // Sirve para el primer acceso en un hosting sin consola. Dejar '' cuando ya exista un admin.
    'admin_inicial' => '',
    // 'admin' = solo administradores publican | 'editor' = cualquier usuario aprobado publica
    'publicar_rol' => 'admin',

    // ---- Google (opcional) ----
    // Google Cloud Console → APIs y servicios → Credenciales → ID de cliente OAuth (aplicación web).
    // Orígenes autorizados: la url_base. Dejar '' para ocultar el botón.
    'google_client_id' => '',

    // ---- Correo saliente (SMTP de la empresa) ----
    // Google Workspace: smtp.gmail.com, 587, tls, usuario = la cuenta, clave = "contraseña de aplicación".
    'smtp' => [
        'host'      => 'smtp.gmail.com',
        'puerto'    => 587,
        'seguridad' => 'tls',               // 'tls' (STARTTLS, 587) | 'ssl' (465)
        'usuario'   => 'no-responder@icewell.cl',
        'clave'     => 'CAMBIAR',
        'de'        => 'no-responder@icewell.cl',
        'de_nombre' => 'Icewell · Panel del sitio',
    ],

    // Solo si el hosting está detrás de un proxy/CDN que pone la IP real en X-Forwarded-For
    // (p.ej. Cloudflare). Lista de IPs del proxy; vacío = se usa REMOTE_ADDR (lo seguro).
    'proxies_confiables' => [],
];
