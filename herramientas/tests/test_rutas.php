<?php
/* Direcciones limpias: levanta el servidor local (php -S + herramientas/servidor-local.php) y
   revisa alias, redirecciones 301 desde los .html viejos y el 404 propio.
   La misma tabla vive en web/.htaccess (hosting y Docker): si cambia una, cambiar la otra.
     php herramientas/tests/test_rutas.php */
declare(strict_types=1);

$raiz = realpath(__DIR__ . '/../..');
$fallos = 0;
function ok(bool $c, string $m): void { global $fallos; echo ($c ? 'OK   ' : 'FALLA ') . $m . "\n"; if (!$c) $fallos++; }

// puerto libre
$s = stream_socket_server('tcp://127.0.0.1:0'); $puerto = (int)substr(strrchr(stream_socket_get_name($s, false), ':'), 1); fclose($s);
$proc = proc_open([PHP_BINARY, '-S', "127.0.0.1:$puerto", '-t', "$raiz/web", "$raiz/herramientas/servidor-local.php"],
    [0 => ['pipe', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
for ($i = 0; $i < 50 && !@fsockopen('127.0.0.1', $puerto); $i++) usleep(100000);

function pedir(string $ruta): array
{
    global $puerto;
    $ctx = stream_context_create(['http' => ['follow_location' => 0, 'ignore_errors' => true, 'timeout' => 10]]);
    $cuerpo = @file_get_contents("http://127.0.0.1:$puerto$ruta", false, $ctx);
    $cab = $http_response_header ?? [];
    preg_match('#\s(\d{3})\s#', $cab[0] ?? '', $m);
    $h = [];
    foreach (array_slice($cab, 1) as $l) { [$k, $v] = array_pad(explode(':', $l, 2), 2, ''); $h[strtolower(trim($k))] = trim($v); }
    return ['codigo' => (int)($m[1] ?? 0), 'h' => $h, 'cuerpo' => (string)$cuerpo];
}

try {
    // páginas por su dirección limpia
    foreach (['/' => 'class="hero', '/curriculum' => 'version-switch', '/presentacion' => 'barra__version',
              '/admin/' => 'acceso', '/admin/editor' => 'ed-cab', '/admin/restablecer?id=x&t=y' => 'restablecer', '/admin/verificar' => 'verificar', '/admin/bandeja' => 'bandeja'] as $ruta => $marca) {
        $r = pedir($ruta);
        ok($r['codigo'] === 200 && str_contains($r['cuerpo'], $marca), "$ruta → 200 ($marca)");
    }
    // las viejas con .html redirigen (301) y conservan el ?query
    foreach (['/index.html' => '/', '/cv.html' => '/curriculum', '/cv-presentacion.html' => '/presentacion', '/curriculum/' => '/curriculum',
              '/admin/index.html' => '/admin/', '/admin/editor.html' => '/admin/editor', '/admin/bandeja.html' => '/admin/bandeja',
              '/admin/restablecer.html?id=abc&t=def' => '/admin/restablecer?id=abc&t=def', '/cv.html?pdf=dibujo' => '/curriculum?pdf=dibujo'] as $vieja => $nueva) {
        $r = pedir($vieja);
        ok($r['codigo'] === 301 && ($r['h']['location'] ?? '') === $nueva, "$vieja → 301 $nueva" . ($r['codigo'] !== 301 ? ' (llegó ' . $r['codigo'] . ')' : ''));
    }
    // el panel conserva su CSP en la dirección limpia
    $r = pedir('/admin/editor');
    ok(str_contains($r['h']['content-security-policy'] ?? '', "script-src 'self'"), '/admin/editor lleva la CSP del panel');
    // lo que no existe → 404 propio (php -S, solo, devolvería index.html con 200)
    foreach (['/no-existe', '/curriculum/algo', '/admin/no-existe', '/assets/no-existe.js'] as $ruta) {
        $r = pedir($ruta);
        ok($r['codigo'] === 404 && str_contains($r['cuerpo'], 'Esta página no existe'), "$ruta → 404 propio");
    }
    // archivos ocultos y PHP sueltos siguen cerrados; los estáticos, igual que antes
    ok(pedir('/.htaccess')['codigo'] === 404, '/.htaccess no se sirve');
    $r = pedir('/assets/sitio-render.js');
    ok($r['codigo'] === 200 && str_contains($r['cuerpo'], 'icewellSitio'), '/assets/… se sirve igual');
    ok(pedir('/api/?r=sesion')['codigo'] !== 404, '/api sigue respondiendo');
} finally {
    proc_terminate($proc); proc_close($proc);
}
echo $fallos ? "\n$fallos FALLA(S)\n" : "\nTODO OK\n";
exit($fallos ? 1 : 0);
