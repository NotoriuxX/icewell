<?php
/* ==========================================================================
   ICEWELL — Servidor local (beta en tu PC, sin hosting)

     php -S 127.0.0.1:8765 -t web herramientas/servidor-local.php

   → http://localhost:8765/            sitio
   → http://localhost:8765/admin/      panel (botón "Entrar como desarrollador")
   → http://localhost:8765/curriculum     CV (web)   · /presentacion  CV (presentación)
   → http://localhost:8765/admin/bandeja  correos de prueba (recuperar, verificar)

   Sin servidor/config.php arranca en modo local: SQLite en servidor/datos/,
   correos a la bandeja de prueba, secretos generados solos. Escuchar SIEMPRE en
   127.0.0.1 (no 0.0.0.0): el modo local no es para exponerlo en la red.

   Este router replica lo que en el hosting hacen los .htaccess: cabeceras de
   seguridad del panel, /api → web/api/index.php, nada de archivos ocultos y las
   direcciones limpias (sin .html, misma tabla que web/.htaccess).
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

// ---- Direcciones limpias (misma tabla que web/.htaccess) ----
$web = realpath(__DIR__ . '/../web');
$query = (string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_QUERY);
$redirigir = function (string $a) use ($query) {
    header('Location: ' . $a . ($query !== '' ? '?' . $query : ''), true, 301);
    return true;
};
// 1) las viejas con .html → la limpia (301), conservando el ?query
$viejas = ['/index.html' => '/', '/cv.html' => '/curriculum', '/cv-presentacion.html' => '/presentacion',
           '/admin/index.html' => '/admin/', '/admin/index' => '/admin/', '/curriculum/' => '/curriculum', '/presentacion/' => '/presentacion'];
if (isset($viejas[$uri])) return $redirigir($viejas[$uri]);
if (preg_match('#^/admin/([a-z-]+)\.html$#', $uri, $m)) return $redirigir('/admin/' . $m[1]);
// 2) alias internos: la barra de direcciones no cambia
$alias = ['/curriculum' => '/cv.html', '/presentacion' => '/cv-presentacion.html'];
if (isset($alias[$uri])) $uri = $alias[$uri];
elseif (preg_match('#^/admin/([a-z-]+)$#', $uri, $m) && is_file("$web/admin/{$m[1]}.html")) $uri = "/admin/{$m[1]}.html";
// 3) lo que no existe → 404 propio (si no, php -S devolvería index.html con 200)
$archivo = $web . (str_ends_with($uri, '/') ? $uri . 'index.html' : $uri);
if (!is_file($archivo)) {
    http_response_code(404);
    header('Content-Type: text/html; charset=UTF-8');
    readfile("$web/404.html");
    return true;
}

// El panel se sirve desde acá: php -S descarta las cabeceras si el router devuelve false,
// y el panel necesita su CSP (igual que web/admin/.htaccess en el hosting).
if (str_starts_with($uri, '/admin/')) {
    $base = realpath(__DIR__ . '/../web/admin');
    $ruta = realpath(__DIR__ . '/../web' . (str_ends_with($uri, '/') ? $uri . 'index.html' : $uri));
    if (!$ruta || !str_starts_with($ruta, $base . DIRECTORY_SEPARATOR) || !is_file($ruta)) { http_response_code(404); readfile("$web/404.html"); return true; }
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
if ($uri === '/cv.html' || $uri === '/cv-presentacion.html') {
    // alias: php -S solo sirve tal cual la ruta pedida, así que el .html lo entrega el router
    header('Content-Type: text/html; charset=UTF-8');
    header('Content-Length: ' . filesize($archivo));
    readfile($archivo);
    return true;
}
return false;   // el resto lo sirve php -S tal cual (estáticos)
