<?php
/* ==========================================================================
   ICEWELL — Pruebas del servidor del panel (autenticación y API)
     php herramientas/tests/test_api.php

   Copia el proyecto a una carpeta temporal (no toca la BD ni los JS reales),
   levanta `php -S` con una config de prueba (llave de Google falsa) y recorre
   los flujos y los ataques típicos: dominio ajeno, claves débiles, CSRF,
   origen ajeno, fuerza bruta, enlaces reutilizados o vencidos, sesiones que
   deben morir, Google con firma o dominio falsos, 2FA con códigos repetidos,
   archivos disfrazados de foto, y que el modo desarrollador no exista en producción.
   ========================================================================== */
declare(strict_types=1);

$RAIZ = dirname(__DIR__, 2);
$TMP = sys_get_temp_dir() . '/icewell-test-' . bin2hex(random_bytes(4));
$fallas = 0;
function ok(bool $c, string $m): void { global $fallas; echo ($c ? 'OK   ' : 'FAIL ') . $m . "\n"; if (!$c) $fallas++; }
function copiar(string $de, string $a): void
{
    if (is_dir($de)) {
        @mkdir($a, 0777, true);
        foreach (scandir($de) as $f) if ($f !== '.' && $f !== '..' && $f !== 'datos' && $f !== 'config.php') copiar("$de/$f", "$a/$f");
    } else copy($de, $a);
}
copiar("$RAIZ/web", "$TMP/web");
copiar("$RAIZ/servidor", "$TMP/servidor");
@mkdir("$TMP/herramientas", 0777, true);
copy("$RAIZ/herramientas/servidor-local.php", "$TMP/herramientas/servidor-local.php");

// llave RSA de prueba = "Google"
$k = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
$det = openssl_pkey_get_details($k);
$b64u = fn(string $s) => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
$jwks = ['k1' => ['kty' => 'RSA', 'kid' => 'k1', 'n' => $b64u($det['rsa']['n']), 'e' => $b64u($det['rsa']['e'])]];

function config(string $entorno, array $jwks): string
{
    return "<?php\nreturn " . var_export([
        'entorno' => $entorno, 'url_base' => $entorno === 'local' ? '' : 'https://example.test',
        'pepper' => str_repeat('ab', 32), 'clave_cifrado' => str_repeat('cd', 32),
        'dominios_permitidos' => ['icewell.cl'], 'admin_inicial' => 'jefa@icewell.cl', 'publicar_rol' => 'admin',
        'google_client_id' => 'cliente-prueba.apps.googleusercontent.com', 'google_jwks' => $jwks,
    ], true) . ";\n";
}
file_put_contents("$TMP/servidor/config.php", config('local', $jwks));

$PUERTO = 8811;
$srv = proc_open([PHP_BINARY, '-S', "127.0.0.1:$PUERTO", '-t', "$TMP/web", "$TMP/herramientas/servidor-local.php"], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
register_shutdown_function(function () use (&$srv, $TMP) { if (is_resource($srv)) proc_terminate($srv); exec('rm -rf ' . escapeshellarg($TMP)); });
for ($i = 0; $i < 50 && !@fsockopen('127.0.0.1', $PUERTO); $i++) usleep(100000);

// ---------------------------------------------------------------- cliente HTTP con "navegadores" separados
$NAV = [];
function req(string $nav, string $metodo, string $ruta, $cuerpo = null, array $extra = [], int $puerto = 0): array
{
    global $NAV, $PUERTO, $TMP;
    $puerto = $puerto ?: $PUERTO;
    $NAV[$nav] = $NAV[$nav] ?? ['csrf' => ''];
    $h = ['X-Requested-With: icewell', 'Origin: http://127.0.0.1:' . $puerto];
    if ($cuerpo !== null) { $h[] = 'Content-Type: application/json'; if ($NAV[$nav]['csrf']) $h[] = 'X-CSRF-Token: ' . $NAV[$nav]['csrf']; }
    foreach ($extra as $k => $v) { $h = array_values(array_filter($h, fn($x) => stripos($x, $k . ':') !== 0)); if ($v !== null) $h[] = "$k: $v"; }
    $url = str_starts_with($ruta, '/') ? "http://127.0.0.1:$puerto$ruta" : "http://127.0.0.1:$puerto/api/?r=$ruta";
    $c = curl_init($url);
    curl_setopt_array($c, [CURLOPT_CUSTOMREQUEST => $metodo, CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_HTTPHEADER => $h,
        CURLOPT_COOKIEFILE => "$TMP/cookies-$nav", CURLOPT_COOKIEJAR => "$TMP/cookies-$nav"]);
    if ($cuerpo !== null) curl_setopt($c, CURLOPT_POSTFIELDS, is_string($cuerpo) ? $cuerpo : json_encode($cuerpo));
    $r = curl_exec($c);
    $codigo = curl_getinfo($c, CURLINFO_RESPONSE_CODE);
    $tam = curl_getinfo($c, CURLINFO_HEADER_SIZE);
    curl_close($c);
    $cab = substr($r, 0, $tam); $txt = substr($r, $tam);
    $d = json_decode($txt, true) ?? [];
    if (!empty($d['csrf'])) $NAV[$nav]['csrf'] = $d['csrf'];
    return ['codigo' => $codigo, 'd' => $d, 'cab' => $cab, 'txt' => $txt];
}
function bandeja(): array
{
    global $TMP;
    $f = glob("$TMP/servidor/datos/bandeja/*.json"); sort($f);
    return array_map(fn($x) => json_decode(file_get_contents($x), true), $f);
}
function enlace(string $para, string $pagina): array
{
    foreach (array_reverse(bandeja()) as $m) {
        if ($m['para'] === $para && preg_match('#/admin/' . $pagina . '\?id=([0-9a-f]{32})&t=([0-9a-f]{64})#', $m['texto'], $x)) return ['id' => $x[1], 't' => $x[2]];
    }
    return ['id' => '', 't' => ''];
}
$CLAVE = 'una frase larga para probar';

// ================================================================ cabeceras y origen
$r = req('x', 'GET', 'config');
ok($r['codigo'] === 200 && $r['d']['local'] === true && $r['d']['desarrollador'] === true, 'config: modo local con botón de desarrollador desde 127.0.0.1');
ok(str_contains($r['cab'], "default-src 'none'") && stripos($r['cab'], 'X-Frame-Options: DENY') !== false && stripos($r['cab'], 'nosniff') !== false, 'API con CSP, X-Frame-Options y nosniff');
$r = req('x', 'GET', '/admin/');
ok(str_contains($r['cab'], "script-src 'self' https://accounts.google.com/gsi/client") && str_contains($r['cab'], 'Referrer-Policy: no-referrer'), 'páginas del panel con CSP estricta y no-referrer');
ok(req('x', 'GET', '/assets/obras/.htaccess')['codigo'] === 404 && req('x', 'GET', '/api/../../servidor/config.php')['codigo'] !== 200, 'no se sirven archivos ocultos ni el servidor');
ok(req('x', 'POST', 'auth/login', ['correo' => 'a@icewell.cl', 'clave' => 'x'], ['X-Requested-With' => null])['codigo'] === 403, 'POST sin X-Requested-With → 403 (un formulario de otro sitio no pasa)');
ok(req('x', 'POST', 'auth/login', ['correo' => 'a@icewell.cl', 'clave' => 'x'], ['Origin' => 'https://malo.example'])['codigo'] === 403, 'POST desde otro origen → 403');
ok(req('x', 'POST', 'auth/login', 'correo=a&clave=b', ['Content-Type' => 'application/x-www-form-urlencoded'])['codigo'] === 415, 'POST que no es JSON → 415');

// ================================================================ registro
$r = req('x', 'POST', 'auth/registro', ['nombre' => 'Ana Pérez', 'correo' => 'ana@gmail.com', 'clave' => $CLAVE]);
ok($r['codigo'] === 422 && ($r['d']['campo'] ?? '') === 'correo', 'registro con correo ajeno a la empresa → rechazado');
$r = req('x', 'POST', 'auth/registro', ['nombre' => 'Ana Pérez', 'correo' => 'ana@sub.icewell.cl', 'clave' => $CLAVE]);
ok($r['codigo'] === 422, 'subdominio (@sub.icewell.cl) → rechazado');
$r = req('x', 'POST', 'auth/registro', ['nombre' => 'Ana Pérez', 'correo' => 'ana@icewell.cl.evil.com', 'clave' => $CLAVE]);
ok($r['codigo'] === 422, 'dominio que solo empieza igual (icewell.cl.evil.com) → rechazado');
$r = req('x', 'POST', 'auth/registro', ['nombre' => 'Ana Pérez', 'correo' => 'ana@icewell.cl', 'clave' => 'corta123']);
ok($r['codigo'] === 422 && ($r['d']['campo'] ?? '') === 'clave', 'clave de menos de 12 → rechazada');
$r = req('x', 'POST', 'auth/registro', ['nombre' => 'Ana Pérez', 'correo' => 'ana@icewell.cl', 'clave' => 'password1234']);
ok($r['codigo'] === 422, 'clave muy común → rechazada');
$r = req('x', 'POST', 'auth/registro', ['nombre' => 'Ana Pérez', 'correo' => 'ana@icewell.cl', 'clave' => 'la clave de pérez es esta']);
ok($r['codigo'] === 422, 'clave que contiene el nombre → rechazada');
$bdx = new PDO('sqlite:' . "$TMP/servidor/datos/icewell.sqlite"); $bdx->exec('DELETE FROM intentos');   // los intentos fallidos de arriba también cuentan para el límite
$r = req('x', 'POST', 'auth/registro', ['nombre' => 'Ana Pérez', 'correo' => 'Ana@Icewell.CL', 'clave' => $CLAVE]);
ok($r['codigo'] === 200 && $r['d']['ok'], 'registro válido (correo en mayúsculas se normaliza)');
$generico = $r['d']['mensaje'];
$v = enlace('ana@icewell.cl', 'verificar');
ok($v['id'] !== '', 'llega el correo de verificación con enlace id+token');
$r = req('x', 'POST', 'auth/registro', ['nombre' => 'Ana Dos', 'correo' => 'ana@icewell.cl', 'clave' => 'una frase cualquiera ok']);
ok($r['codigo'] === 200 && $r['d']['mensaje'] === $generico, 'registro repetido: misma respuesta (no revela que la cuenta existe)');
$b = bandeja(); ok(str_contains(end($b)['asunto'], 'Intento de registro'), '…y al dueño le llega un aviso');
ok(req('x', 'POST', 'auth/login', ['correo' => 'ana@icewell.cl', 'clave' => $CLAVE])['d']['error'] === 'Primero confirma tu correo con el enlace que te enviamos.', 'antes de confirmar el correo no entra');
$r = req('x', 'POST', 'auth/verificar', $v);
ok($r['codigo'] === 200 && $r['d']['estado'] === 'pendiente_aprobacion', 'verificar → queda esperando aprobación');
ok(req('x', 'POST', 'auth/verificar', $v)['codigo'] === 400, 'el enlace de verificación no sirve dos veces');
ok(req('x', 'POST', 'auth/login', ['correo' => 'ana@icewell.cl', 'clave' => $CLAVE])['codigo'] === 403, 'sin aprobación no entra');

// admin inicial (config) → activo al verificar
req('adm', 'POST', 'auth/registro', ['nombre' => 'Jefa Admin', 'correo' => 'jefa@icewell.cl', 'clave' => $CLAVE]);
$r = req('adm', 'POST', 'auth/verificar', enlace('jefa@icewell.cl', 'verificar'));
ok($r['d']['estado'] === 'activo', 'el correo admin_inicial queda activo como administrador al verificar');
$r = req('adm', 'POST', 'auth/login', ['correo' => 'jefa@icewell.cl', 'clave' => $CLAVE]);
ok($r['codigo'] === 200 && strlen($NAV['adm']['csrf']) === 64, 'admin entra y recibe token CSRF');
ok(preg_match('/Set-Cookie: icw_sesion=[0-9a-f]{64};.*HttpOnly.*SameSite=Strict/i', $r['cab']) === 1, 'cookie de sesión HttpOnly + SameSite=Strict');

// aprobar a Ana
$ana = array_values(array_filter(req('adm', 'GET', 'usuarios')['d']['usuarios'], fn($u) => $u['email'] === 'ana@icewell.cl'))[0];
ok(req('x', 'POST', 'usuarios/actualizar', ['id' => $ana['id'], 'accion' => 'aprobar'])['codigo'] === 401, 'sin sesión no se aprueba a nadie');
ok(req('adm', 'POST', 'usuarios/actualizar', ['id' => $ana['id'], 'accion' => 'aprobar'], ['X-CSRF-Token' => str_repeat('0', 64)])['codigo'] === 403, 'con CSRF incorrecto → 403');
ok(req('adm', 'POST', 'usuarios/actualizar', ['id' => $ana['id'], 'accion' => 'aprobar'])['codigo'] === 200, 'admin aprueba a Ana');
$b = bandeja(); ok(str_contains(end($b)['asunto'], 'aprobado'), '…y a Ana le llega el aviso de aprobación');
$r = req('ana', 'POST', 'auth/login', ['correo' => 'ana@icewell.cl', 'clave' => $CLAVE]);
ok($r['codigo'] === 200, 'Ana entra');
ok(req('ana', 'GET', 'usuarios')['codigo'] === 403, 'un editor no ve la lista de usuarios');
$miAdmin = array_values(array_filter(req('adm', 'GET', 'usuarios')['d']['usuarios'], fn($u) => $u['email'] === 'jefa@icewell.cl'))[0];
ok(req('adm', 'POST', 'usuarios/actualizar', ['id' => $miAdmin['id'], 'accion' => 'bloquear'])['codigo'] === 422, 'el admin no puede bloquearse a sí mismo');
ok(req('adm', 'POST', 'usuarios/actualizar', ['id' => $miAdmin['id'], 'accion' => 'rol', 'rol' => 'editor'])['codigo'] === 422, 'el último admin no puede quitarse el rol');

// ================================================================ contenido
$r = req('ana', 'GET', 'contenido');
ok($r['codigo'] === 200 && count($r['d']['contenido']['obras']) === 68, 'contenido inicial = la semilla (68 obras)');
$c = $r['d']['contenido']; $ver = $r['d']['version'];
$c['empresa']['telefono'] = '+56 2 2999 1234';
$c['textos']['hero.lead'] = 'Hola </script><script>alert(1)</script>';
ok(req('ana', 'POST', 'contenido/guardar', ['contenido' => $c, 'base' => $ver], ['X-CSRF-Token' => null])['codigo'] === 403, 'guardar sin CSRF → 403');
$r = req('ana', 'POST', 'contenido/guardar', ['contenido' => $c, 'base' => $ver]);
ok($r['codigo'] === 200 && $r['d']['version'] > $ver, 'guardar → versión nueva');
$ver2 = $r['d']['version'];
ok(req('adm', 'POST', 'contenido/guardar', ['contenido' => $c, 'base' => $ver])['codigo'] === 409, 'guardar sobre una versión vieja → 409 (no se pisan cambios ajenos)');
$malo = $c; $malo['obras'][10]['portada'] = true; $malo['obras'][10]['foto'] = null;
$r = req('ana', 'POST', 'contenido/guardar', ['contenido' => $malo, 'base' => $ver2]);
ok($r['codigo'] === 422 && str_contains(json_encode($r['d']['errores'], JSON_UNESCAPED_UNICODE), 'portada exige foto'), 'obra en portada sin foto → rechazada');
$malo = $c; $malo['empresa']['rut'] = '76.059.117-4';
ok(req('ana', 'POST', 'contenido/guardar', ['contenido' => $malo, 'base' => $ver2])['codigo'] === 422, 'RUT con dígito verificador malo → rechazado');
$malo = $c; $malo['empresa']['redes']['linkedin'] = 'javascript:alert(1)';
ok(req('ana', 'POST', 'contenido/guardar', ['contenido' => $malo, 'base' => $ver2])['codigo'] === 422, 'red social con javascript: → rechazada');
$malo = $c; $malo['obras'][0]['foto'] = '../../servidor/config.php';
ok(req('ana', 'POST', 'contenido/guardar', ['contenido' => $malo, 'base' => $ver2])['codigo'] === 422, 'foto con ruta "../" → rechazada');
$malo = $c; $malo['inicio']['serviciosColumnas'] = '9';
ok(req('ana', 'POST', 'contenido/guardar', ['contenido' => $malo, 'base' => $ver2])['codigo'] === 422, 'servicios por fila fuera de auto/1–6 → rechazado');
$malo = $c; $malo['obras'][0]['sectores'][] = 'sector-inventado';
ok(req('ana', 'POST', 'contenido/guardar', ['contenido' => $malo, 'base' => $ver2])['codigo'] === 422, 'obra con un sector que no está en el catálogo → rechazada');
ok(req('ana', 'POST', 'contenido/publicar', ['version' => $ver2])['codigo'] === 403, 'un editor no publica (publicar_rol = admin)');
$r = req('adm', 'POST', 'contenido/publicar', ['version' => $ver2]);
ok($r['codigo'] === 200, 'admin publica');
$js = file_get_contents("$TMP/web/assets/sitio-data.js");
ok(str_contains($js, '+56 2 2999 1234'), 'sitio-data.js publicado con el teléfono nuevo');
ok(!str_contains($js, '</script>') && str_contains($js, '\\u003C/script'), 'un "</script>" en un texto queda escapado en el JS publicado');
ok(count(glob("$TMP/servidor/datos/respaldos/*/sitio-data.js")) >= 1, 'se respaldó la versión anterior de los JS');
ok(str_contains(file_get_contents("$TMP/web/assets/cv-data.js"), 'const PROYECTOS'), 'cv-data.js regenerado con el mismo formato');

// ================================================================ subida de imágenes
$falsa = 'data:image/jpeg;base64,' . base64_encode("\xFF\xD8\xFF\xE0<?php system(\$_GET['c']); ?>");
ok(req('ana', 'POST', 'imagen', ['tipo' => 'obra', 'datos' => $falsa])['codigo'] === 422, 'PHP disfrazado de JPG → rechazado');
ok(req('ana', 'POST', 'imagen', ['tipo' => 'obra', 'datos' => 'data:image/svg+xml;base64,' . base64_encode('<svg onload="alert(1)"/>')])['codigo'] === 422, 'SVG → rechazado');
$im = imagecreatetruecolor(300, 200); ob_start(); imagejpeg($im); $chica = ob_get_clean();
ok(req('ana', 'POST', 'imagen', ['tipo' => 'obra', 'datos' => 'data:image/jpeg;base64,' . base64_encode($chica)])['codigo'] === 422, 'foto de menos de 400 px → rechazada');
$im = imagecreatetruecolor(1600, 1000); imagefilledrectangle($im, 0, 0, 800, 1000, imagecolorallocate($im, 0, 98, 168)); ob_start(); imagejpeg($im, null, 90); $buena = ob_get_clean() . '<?php echo 1; ?>';
$r = req('ana', 'POST', 'imagen', ['tipo' => 'obra', 'nombre' => 'Obra de prueba ñ', 'datos' => 'data:image/jpeg;base64,' . base64_encode($buena)]);
ok($r['codigo'] === 200 && preg_match('#^obras/obra-de-prueba-n-[0-9a-f]{8}\.webp$#', $r['d']['archivo'] ?? ''), 'foto válida → guardada como WebP con nombre del servidor: ' . ($r['d']['archivo'] ?? ''));
$guardada = file_get_contents("$TMP/web/assets/" . ($r['d']['archivo'] ?? 'x'));
ok($guardada && !str_contains($guardada, '<?php') && substr($guardada, 0, 4) === 'RIFF' && substr($guardada, 8, 4) === 'WEBP', 'la foto se re-codificó a WebP: el código pegado al final desapareció');
ok(strlen($guardada) < strlen($buena) && ($r['d']['bytes_final'] ?? 0) === strlen($guardada) && ($r['d']['bytes_original'] ?? 0) === strlen($buena), 'la WebP pesa menos que la original y la respuesta informa ambos pesos');
ok(($r['d']['ancho'] ?? 0) === 1600 && ($r['d']['alto'] ?? 0) === 1000, 'conserva tamaño y proporción (1600×1000, bajo el máximo de 2000 px)');
// obra nueva con esa foto → publicar regenera las fotos del PDF
$c = req('adm', 'GET', 'contenido')['d'];
$cc = $c['contenido'];
array_unshift($cc['obras'], ['id' => 'obra-prueba', 'nombre' => 'Obra de prueba', 'anio' => 2025, 'lugar' => 'Santiago', 'regiones' => ['metropolitana'], 'sectores' => ['oficinas'],
    'uso' => 'Oficinas', 'sistemas' => 'VRV', 'm2' => 1200, 'foto' => $r['d']['archivo'], 'estado' => 'ejecucion', 'tags' => [], 'cliente' => 'Privado', 'portada' => true, 'ordenPortada' => 7, 'visible' => true]);
// sector y región creados desde la ficha de la obra (el panel los agrega al catálogo)
$cc['catalogos']['sectores'][] = ['id' => 'data-center', 'label' => 'Data center'];
$cc['catalogos']['regiones'][] = ['id' => 'aysen', 'label' => 'Aysén'];
$cc['obras'][0]['sectores'][] = 'data-center'; $cc['obras'][0]['regiones'][] = 'aysen';
$cc['cv']['serviciosColumnas'] = 'auto';
$g = req('adm', 'POST', 'contenido/guardar', ['contenido' => $cc, 'base' => $c['version']]);
ok($g['codigo'] === 200, 'obra con sector y región nuevos del catálogo + servicios "auto" → aceptada');
$p = req('adm', 'POST', 'contenido/publicar', ['version' => $g['d']['version'] ?? 0]);
ok(($p['d']['pdf']['nuevas'] ?? 0) === 1, 'publicar con una foto nueva la agrega al PDF (cv-pdf-assets.js)');
$cvjs = file_get_contents("$TMP/web/assets/cv-data.js");
ok(str_contains($cvjs, '"data-center"') && str_contains($cvjs, 'Aysén'), 'el sector y la región nuevos llegan a cv-data.js');
ok(str_contains(file_get_contents("$TMP/web/assets/vendor/cv-pdf-assets.js"), '"' . str_replace('/', '\/', $r['d']['archivo']) . '"') || str_contains(file_get_contents("$TMP/web/assets/vendor/cv-pdf-assets.js"), '"' . $r['d']['archivo'] . '"'), '…y la foto está embebida en cv-pdf-assets.js');

// ================================================================ recuperar contraseña
$n0 = count(bandeja());
$r = req('x', 'POST', 'auth/recuperar', ['correo' => 'nadie@icewell.cl']);
ok($r['codigo'] === 200 && count(bandeja()) === $n0, 'recuperar con correo inexistente: misma respuesta y no se envía nada');
$gen = $r['d']['mensaje'];
$r = req('x', 'POST', 'auth/recuperar', ['correo' => 'ana@icewell.cl']);
ok($r['d']['mensaje'] === $gen && count(bandeja()) === $n0 + 1, 'recuperar con correo real: misma respuesta, llega el enlace');
$rst = enlace('ana@icewell.cl', 'restablecer');
$r = req('x', 'POST', 'auth/enlace', $rst);
ok($r['codigo'] === 200 && $r['d']['correo'] === 'an•@icewell.cl', 'el enlace se valida antes de mostrar el formulario (correo enmascarado)');
ok(req('x', 'POST', 'auth/enlace', ['id' => $rst['id'], 't' => str_repeat('a', 64)])['codigo'] === 400, 'token cambiado → inválido');
ok(req('x', 'POST', 'auth/restablecer', $rst + ['clave' => 'corta'])['codigo'] === 422, 'clave nueva débil → rechazada (el enlace sigue sirviendo)');
ok(req('x', 'POST', 'auth/restablecer', $rst + ['clave' => $CLAVE])['codigo'] === 422, 'la clave nueva no puede ser igual a la anterior');
$NUEVA = 'otra frase nueva y segura';
ok(req('x', 'POST', 'auth/restablecer', $rst + ['clave' => $NUEVA])['codigo'] === 200, 'restablecer con clave buena → ok');
ok(req('x', 'POST', 'auth/restablecer', $rst + ['clave' => 'tercera frase distinta ok'])['codigo'] === 400, 'el enlace no sirve dos veces');
ok(req('ana', 'GET', 'contenido')['codigo'] === 401, 'la sesión que Ana tenía abierta se cerró al cambiar la clave');
$b = bandeja(); ok(str_contains(end($b)['asunto'], 'contraseña cambió'), 'llega el aviso "tu contraseña cambió"');
ok(req('ana', 'POST', 'auth/login', ['correo' => 'ana@icewell.cl', 'clave' => $CLAVE])['codigo'] === 401, 'la clave vieja ya no sirve');
ok(req('ana', 'POST', 'auth/login', ['correo' => 'ana@icewell.cl', 'clave' => $NUEVA])['codigo'] === 200, 'la nueva sí');
// enlace vencido
req('x', 'POST', 'auth/recuperar', ['correo' => 'ana@icewell.cl']);
$rst2 = enlace('ana@icewell.cl', 'restablecer');
$bd = new PDO('sqlite:' . "$TMP/servidor/datos/icewell.sqlite");
$bd->prepare('UPDATE tokens SET expira = ? WHERE selector = ?')->execute([time() - 5, $rst2['id']]);
ok(req('x', 'POST', 'auth/restablecer', $rst2 + ['clave' => 'tercera frase distinta ok'])['codigo'] === 400, 'enlace vencido (30 min) → no sirve');
$fila = $bd->query("SELECT verificador_hash FROM tokens WHERE selector = '{$rst2['id']}'")->fetch();
ok($fila && $fila['verificador_hash'] !== $rst2['t'] && strlen($fila['verificador_hash']) === 64, 'en la BD el token se guarda solo como hash');
$u = $bd->query("SELECT hash FROM usuarios WHERE email = 'ana@icewell.cl'")->fetch();
ok(str_starts_with($u['hash'], '$argon2id$') || str_starts_with($u['hash'], '$2y$'), 'contraseña guardada con Argon2id/bcrypt');

// ================================================================ fuerza bruta
for ($i = 0; $i < 5; $i++) req('fb', 'POST', 'auth/login', ['correo' => 'jefa@icewell.cl', 'clave' => 'intento malo ' . $i]);
$r = req('fb', 'POST', 'auth/login', ['correo' => 'jefa@icewell.cl', 'clave' => $CLAVE]);
ok($r['codigo'] === 429, '6º intento con la misma cuenta → 429 aunque la clave sea correcta');
ok(req('fb', 'POST', 'auth/login', ['correo' => 'noexiste@icewell.cl', 'clave' => 'x'])['d']['error'] === 'Correo o contraseña incorrectos.', 'cuenta inexistente: mismo mensaje que clave incorrecta');
$bd->exec("DELETE FROM intentos");

// ================================================================ Google
$jwt = function (array $pl, $llave = null) use ($k, $b64u) {
    $h = $b64u(json_encode(['alg' => 'RS256', 'kid' => 'k1', 'typ' => 'JWT']));
    $p = $b64u(json_encode($pl + ['iss' => 'https://accounts.google.com', 'aud' => 'cliente-prueba.apps.googleusercontent.com', 'exp' => time() + 600, 'iat' => time(), 'email_verified' => true]));
    openssl_sign("$h.$p", $firma, $llave ?: $k, OPENSSL_ALGO_SHA256);
    return "$h.$p." . $b64u($firma);
};
$r = req('g', 'POST', 'auth/google', ['credential' => $jwt(['sub' => '111', 'email' => 'pedro@gmail.com', 'hd' => ''])]);
ok($r['codigo'] === 403, 'Google con cuenta personal (@gmail.com) → rechazada');
$r = req('g', 'POST', 'auth/google', ['credential' => $jwt(['sub' => '112', 'email' => 'pedro@icewell.cl', 'hd' => 'otra.cl'])]);
ok($r['codigo'] === 403, 'Google con hd distinto al dominio → rechazada');
$otra = openssl_pkey_new(['private_key_bits' => 2048]);
ok(req('g', 'POST', 'auth/google', ['credential' => $jwt(['sub' => '113', 'email' => 'pedro@icewell.cl', 'hd' => 'icewell.cl'], $otra)])['codigo'] === 401, 'Google con firma falsa → 401');
ok(req('g', 'POST', 'auth/google', ['credential' => $jwt(['sub' => '114', 'email' => 'pedro@icewell.cl', 'hd' => 'icewell.cl', 'aud' => 'otro-cliente'])])['codigo'] === 401, 'Google emitido para otra app (aud) → 401');
ok(req('g', 'POST', 'auth/google', ['credential' => $jwt(['sub' => '115', 'email' => 'pedro@icewell.cl', 'hd' => 'icewell.cl', 'exp' => time() - 3600])])['codigo'] === 401, 'Google vencido → 401');
$r = req('g', 'POST', 'auth/google', ['credential' => $jwt(['sub' => '116', 'email' => 'pedro@icewell.cl', 'hd' => 'icewell.cl', 'name' => 'Pedro Soto'])]);
ok($r['codigo'] === 403 && ($r['d']['estado'] ?? '') === 'pendiente_aprobacion', 'Google válido de la empresa → cuenta creada, espera aprobación');
$r = req('ana2', 'POST', 'auth/google', ['credential' => $jwt(['sub' => '117', 'email' => 'ana@icewell.cl', 'hd' => 'icewell.cl'])]);
ok($r['codigo'] === 200, 'Google con el correo de una cuenta activa → entra y queda vinculada');
ok(req('ana3', 'POST', 'auth/google', ['credential' => $jwt(['sub' => '999', 'email' => 'ana@icewell.cl', 'hd' => 'icewell.cl'])])['codigo'] === 403, 'otro usuario de Google con el mismo correo → rechazado');

// ================================================================ 2FA
require "$TMP/servidor/lib/Totp.php";
$r = req('adm', 'POST', 'auth/login', ['correo' => 'jefa@icewell.cl', 'clave' => $CLAVE]);
$ini = req('adm', 'POST', 'cuenta/2fa/iniciar', []);
$sec = str_replace(' ', '', $ini['d']['secreto'] ?? '');
ok(strlen($sec) === 32 && str_starts_with($ini['d']['uri'] ?? '', 'otpauth://totp/'), '2FA: secreto y enlace otpauth');
$paso = intdiv(time(), 30);
ok(req('adm', 'POST', 'cuenta/2fa/activar', ['codigo' => '000000'])['codigo'] === 422, '2FA: código incorrecto no activa');
ok(req('adm', 'POST', 'cuenta/2fa/activar', ['codigo' => Totp::codigo($sec, $paso)])['codigo'] === 200, '2FA: activada con código correcto');
$cifrado = $bd->query("SELECT totp_secreto FROM usuarios WHERE email = 'jefa@icewell.cl'")->fetch()['totp_secreto'];
ok(str_starts_with($cifrado, 'v1:') && !str_contains($cifrado, $sec), 'el secreto 2FA se guarda cifrado en la BD');
$r = req('adm2', 'POST', 'auth/login', ['correo' => 'jefa@icewell.cl', 'clave' => $CLAVE]);
ok(($r['d']['requiere_totp'] ?? false) && !preg_match('/Set-Cookie: icw_sesion=[0-9a-f]/', $r['cab']), 'con 2FA, la clave sola no abre sesión');
$des = $r['d']['desafio'] ?? '';
ok(req('adm2', 'POST', 'auth/totp', ['desafio' => $des, 'codigo' => Totp::codigo($sec, $paso)])['codigo'] === 401, 'el mismo código de 6 dígitos no sirve dos veces');
ok(req('adm2', 'POST', 'auth/totp', ['desafio' => $des, 'codigo' => Totp::codigo($sec, $paso + 1)])['codigo'] === 200, 'código siguiente → entra');

// ================================================================ producción: nada del modo local
file_put_contents("$TMP/servidor/config-prod.php", config('produccion', $jwks));
$P2 = 8812;
mkdir("$TMP/prod");
copiar("$TMP/web", "$TMP/prod/web"); copiar("$TMP/servidor", "$TMP/prod/servidor"); @mkdir("$TMP/prod/herramientas"); copy("$TMP/herramientas/servidor-local.php", "$TMP/prod/herramientas/servidor-local.php");
copy("$TMP/servidor/config-prod.php", "$TMP/prod/servidor/config.php");
$srv2 = proc_open([PHP_BINARY, '-S', "127.0.0.1:$P2", '-t', "$TMP/prod/web", "$TMP/prod/herramientas/servidor-local.php"], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $p2);
for ($i = 0; $i < 50 && !@fsockopen('127.0.0.1', $P2); $i++) usleep(100000);
$o = ['Origin' => 'https://example.test'];
ok(req('p', 'GET', 'config', null, [], $P2)['d']['desarrollador'] === false, 'producción: sin botón de desarrollador');
ok(req('p', 'POST', 'auth/desarrollador', [], $o, $P2)['codigo'] === 404, 'producción: "entrar como desarrollador" no existe (aunque sea desde 127.0.0.1)');
ok(req('p', 'GET', 'dev/bandeja', null, [], $P2)['codigo'] === 404, 'producción: bandeja de correos de prueba no existe');
req('p', 'POST', 'auth/recuperar', ['correo' => 'ana@icewell.cl'], $o, $P2);
ok(!is_dir("$TMP/prod/servidor/datos/bandeja") || count(glob("$TMP/prod/servidor/datos/bandeja/*")) === count(glob("$TMP/servidor/datos/bandeja/*")), 'producción: los correos no van a la bandeja local');
proc_terminate($srv2);

// ================================================================ Docker: configuración por variables y proxy
@mkdir("$TMP/env/servidor/lib", 0777, true);
foreach (glob("$TMP/servidor/lib/*.php") as $f) copy($f, "$TMP/env/servidor/lib/" . basename($f));
$sec = "$TMP/env/pepper.txt"; file_put_contents($sec, str_repeat('ef', 32) . "\n");
$leer = function (array $env) use ($TMP) {
    $cmd = 'env -i PATH=/usr/bin:/bin ' . implode(' ', array_map(fn($k, $v) => $k . '=' . escapeshellarg($v), array_keys($env), $env))
        . ' ' . escapeshellarg(PHP_BINARY) . ' -r ' . escapeshellarg('require "' . $TMP . '/env/servidor/lib/Config.php"; try { echo json_encode(Config::cargar()); } catch (Throwable $e) { echo json_encode(["error" => $e->getMessage()]); }');
    return json_decode((string)shell_exec($cmd), true);
};
$c = $leer(['ICEWELL_ENTORNO' => 'produccion', 'ICEWELL_URL_BASE' => 'https://www.icewell.cl/', 'ICEWELL_PEPPER_FILE' => $sec, 'ICEWELL_CLAVE_CIFRADO' => str_repeat('12', 32),
    'ICEWELL_BD_DRIVER' => 'mysql', 'ICEWELL_BD_HOST' => 'db', 'ICEWELL_BD_CLAVE' => 'x', 'ICEWELL_DOMINIOS' => 'icewell.cl, icewell.net', 'ICEWELL_DESARROLLADOR' => '1',
    'ICEWELL_PROXIES_CONFIABLES' => '172.16.0.0/12,10.0.0.5', 'ICEWELL_SMTP_HOST' => 'smtp.gmail.com', 'ICEWELL_SMTP_USUARIO' => 'a@icewell.cl']);
ok(($c['entorno'] ?? '') === 'produccion' && $c['url_base'] === 'https://www.icewell.cl' && $c['bd']['driver'] === 'mysql' && $c['bd']['host'] === 'db', 'Docker: configuración desde variables ICEWELL_*');
ok(($c['pepper'] ?? '') === str_repeat('ef', 32), 'Docker: secreto leído de un archivo (*_FILE, Docker secrets)');
ok($c['dominios_permitidos'] === ['icewell.cl', 'icewell.net'] && $c['proxies_confiables'] === ['172.16.0.0/12', '10.0.0.5'] && $c['smtp']['de'] === 'a@icewell.cl', 'Docker: listas y SMTP desde variables');
ok(($c['desarrollador'] ?? null) === false, 'Docker: ICEWELL_DESARROLLADOR=1 se ignora en producción');
$c = $leer(['ICEWELL_ENTORNO' => 'produccion', 'ICEWELL_URL_BASE' => 'https://www.icewell.cl']);
ok(isset($c['error']) && str_contains($c['error'], 'pepper'), 'Docker: producción sin secretos no arranca');
$c = $leer(['ICEWELL_ENTORNO' => 'local', 'ICEWELL_DESARROLLADOR' => '1']);
ok(($c['entorno'] ?? '') === 'local' && $c['desarrollador'] === true && preg_match('/^[0-9a-f]{64}$/', $c['pepper'] ?? ''), 'Docker local: secretos generados y botón de desarrollador habilitado');

require_once "$TMP/servidor/lib/Config.php"; require_once "$TMP/servidor/lib/Http.php";
Config::forzar(['proxies_confiables' => ['172.16.0.0/12', '2001:db8::/32']]);
ok(Http::ipEnRango('172.18.0.3', '172.16.0.0/12') && !Http::ipEnRango('172.32.0.1', '172.16.0.0/12') && Http::ipEnRango('2001:db8::1', '2001:db8::/32') && !Http::ipEnRango('10.0.0.1', '172.16.0.0/12'), 'rangos CIDR (IPv4 e IPv6)');
$_SERVER = ['REMOTE_ADDR' => '203.0.113.9', 'HTTP_X_FORWARDED_PROTO' => 'https', 'HTTP_X_FORWARDED_FOR' => '1.2.3.4'];
ok(!Http::esHttps() && Http::ip() === '203.0.113.9', 'X-Forwarded-Proto/For de un cliente cualquiera se ignoran (no se puede fingir https ni la IP)');
$_SERVER = ['REMOTE_ADDR' => '172.18.0.4', 'HTTP_X_FORWARDED_PROTO' => 'https', 'HTTP_X_FORWARDED_FOR' => '9.9.9.9, 1.2.3.4'];
ok(Http::esHttps() && Http::ip() === '1.2.3.4', 'desde el proxy de Docker (Caddy) sí se cree https y la IP real');

echo $fallas ? "\n$fallas FALLAS\n" : "\nTODO OK\n";
exit($fallas ? 1 : 0);
