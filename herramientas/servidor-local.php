<?php
/* ==========================================================================
   ICEWELL — Servidor local (beta en tu PC, sin hosting)

     php -S 127.0.0.1:8765 -t web herramientas/servidor-local.php

   → http://localhost:8765/            sitio
   → http://localhost:8765/admin/      panel (botón "Entrar como desarrollador")
   → http://localhost:8765/admin/bandeja.html   correos de prueba (recuperar, verificar)

   Sin servidor/config.php arranca en modo local: SQLite en servidor/datos/,
   correos a la bandeja de prueba, secretos generados solos. Escuchar SIEMPRE en
   127.0.0.1 (no 0.0.0.0): el modo local no es para exponerlo en la red.

   Este router replica lo que en el hosting hacen los .htaccess: cabeceras de
   seguridad del panel, /api → web/api/index.php, y nada de archivos ocultos.
   ========================================================================== */
declare(strict_types=1);

$uri = rawurldecode((string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));

// archivos ocultos (.htaccess, .gitkeep…) y cualquier otro .php: no se sirven
if (preg_match('#/\.#', $uri) || (preg_match('#\.php$#i', $uri) && $uri !== '/api/index.php')) {
    http_response_code(404);
    echo 'No encontrado';
    return true;
}
// fotos subidas: solo imágenes (igual que web/assets/obras/.htaccess)
if (str_starts_with($uri, '/assets/obras/') && !preg_match('#\.(jpe?g|png|webp)$#i', $uri)) {
    http_response_code(404);
    return true;
}
if ($uri === '/api' || $uri === '/api/' || $uri === '/api/index.php') {
    require __DIR__ . '/../web/api/index.php';
    return true;
}
if ($uri === '/admin') { header('Location: /admin/'); return true; }

// El panel se sirve desde acá: php -S descarta las cabeceras si el router devuelve false,
// y el panel necesita su CSP (igual que web/admin/.htaccess en el hosting).
if (str_starts_with($uri, '/admin/')) {
    $base = realpath(__DIR__ . '/../web/admin');
    $ruta = realpath(__DIR__ . '/../web' . (str_ends_with($uri, '/') ? $uri . 'index.html' : $uri));
    if (!$ruta || !str_starts_with($ruta, $base . DIRECTORY_SEPARATOR) || !is_file($ruta)) { http_response_code(404); echo 'No encontrado'; return true; }
    $tipos = ['html' => 'text/html; charset=UTF-8', 'css' => 'text/css; charset=UTF-8', 'js' => 'text/javascript; charset=UTF-8', 'svg' => 'image/svg+xml', 'png' => 'image/png'];
    $ext = strtolower(pathinfo($ruta, PATHINFO_EXTENSION));
    if (!isset($tipos[$ext])) { http_response_code(404); return true; }
    require __DIR__ . '/../servidor/lib/Cabeceras.php';
    Cabeceras::panel();
    header('X-Content-Type-Options: nosniff');
    header('Content-Type: ' . $tipos[$ext]);
    header('Content-Length: ' . filesize($ruta));
    readfile($ruta);
    return true;
}
return false;   // el resto lo sirve php -S tal cual (estáticos)
