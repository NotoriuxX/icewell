<?php
/* Correos del panel (verificar cuenta, recuperar contraseña, avisos).
   - Producción: SMTP de la empresa (STARTTLS en 587 o SSL en 465, AUTH LOGIN).
     Cliente SMTP mínimo propio para no depender de Composer en un hosting compartido.
   - Local: no se envía nada; el correo queda en servidor/datos/bandeja/ y se ve en
     /admin/bandeja (ahí está el enlace de recuperación para probar el flujo).
   Los datos del usuario (nombre) se escapan en el HTML; destinatario y asunto se
   validan contra saltos de línea (inyección de cabeceras). */
declare(strict_types=1);

final class Correo
{
    // ---------------------------------------------------------------- mensajes
    public static function verificacion(array $u, string $sel, string $ver): bool
    {
        $url = Http::urlBase() . '/admin/verificar?id=' . $sel . '&t=' . $ver;
        return self::enviar($u['email'], 'Confirma tu correo · Panel Icewell',
            'Hola ' . $u['nombre'] . ",\n\nPara activar tu cuenta del panel de Icewell confirma tu correo en este enlace (vale 24 horas):\n\n$url\n\nDespués de confirmarlo, un administrador aprobará tu acceso.\nSi no fuiste tú, ignora este mensaje.",
            self::html('Confirma tu correo', '<p>Hola ' . self::e($u['nombre']) . ',</p><p>Para activar tu cuenta del panel de Icewell confirma tu correo. El enlace vale 24 horas.</p>',
                'Confirmar mi correo', $url, 'Después de confirmarlo, un administrador aprobará tu acceso. Si no fuiste tú, ignora este mensaje.'));
    }

    public static function recuperar(array $u, string $sel, string $ver): bool
    {
        $url = Http::urlBase() . '/admin/restablecer?id=' . $sel . '&t=' . $ver;
        return self::enviar($u['email'], 'Recupera tu contraseña · Panel Icewell',
            'Hola ' . $u['nombre'] . ",\n\nAlguien (ojalá tú) pidió crear una contraseña nueva para tu cuenta del panel de Icewell.\nEnlace (vale 30 minutos y se usa una sola vez):\n\n$url\n\nSi no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.",
            self::html('Crea una contraseña nueva', '<p>Hola ' . self::e($u['nombre']) . ',</p><p>Alguien (ojalá tú) pidió crear una contraseña nueva para tu cuenta del panel de Icewell. El enlace vale <b>30 minutos</b> y se usa una sola vez.</p>',
                'Crear contraseña nueva', $url, 'Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.'));
    }

    public static function claveCambiada(array $u): bool
    {
        $url = Http::urlBase() . '/admin/#recuperar';
        return self::enviar($u['email'], 'Tu contraseña cambió · Panel Icewell',
            'Hola ' . $u['nombre'] . ",\n\nLa contraseña de tu cuenta del panel de Icewell se cambió el " . date('d/m/Y H:i') . ".\nSe cerraron todas las sesiones abiertas.\n\nSi no fuiste tú, pide una contraseña nueva de inmediato ($url) y avisa a un administrador.",
            self::html('Tu contraseña cambió', '<p>Hola ' . self::e($u['nombre']) . ',</p><p>La contraseña de tu cuenta del panel de Icewell se cambió el ' . date('d/m/Y H:i') . '. Se cerraron todas las sesiones abiertas.</p>',
                'No fui yo: recuperar mi cuenta', $url, 'Si fuiste tú, no tienes que hacer nada.'));
    }

    public static function avisoRegistroRepetido(array $u): bool
    {
        $url = Http::urlBase() . '/admin/#recuperar';
        return self::enviar($u['email'], 'Intento de registro con tu correo · Panel Icewell',
            'Hola ' . $u['nombre'] . ",\n\nAlguien intentó crear una cuenta del panel de Icewell con tu correo, pero ya tienes una.\nSi olvidaste tu contraseña puedes crear una nueva: $url\nSi no fuiste tú, ignora este mensaje.",
            self::html('Ya tienes una cuenta', '<p>Hola ' . self::e($u['nombre']) . ',</p><p>Alguien intentó crear una cuenta del panel de Icewell con tu correo, pero ya tienes una.</p>',
                'Olvidé mi contraseña', $url, 'Si no fuiste tú, ignora este mensaje.'));
    }

    public static function avisarAdmins(array $nuevo): void
    {
        $admins = Bd::todos("SELECT email, nombre FROM usuarios WHERE rol = 'admin' AND estado = 'activo'");
        $url = Http::urlBase() . '/admin/editor#usuarios';
        foreach ($admins as $a) {
            self::enviar($a['email'], 'Nueva cuenta por aprobar · Panel Icewell',
                $nuevo['nombre'] . ' (' . $nuevo['email'] . ") confirmó su correo y espera aprobación para editar el sitio.\n\nAprobar o rechazar: $url",
                self::html('Nueva cuenta por aprobar', '<p><b>' . self::e($nuevo['nombre']) . '</b> (' . self::e($nuevo['email']) . ') confirmó su correo y espera aprobación para editar el sitio.</p>',
                    'Revisar en el panel', $url, 'Si no conoces a esta persona, bloquéala desde la pestaña Usuarios.'));
        }
    }

    public static function aprobado(array $u): bool
    {
        $url = Http::urlBase() . '/admin/';
        return self::enviar($u['email'], 'Tu acceso fue aprobado · Panel Icewell',
            'Hola ' . $u['nombre'] . ",\n\nUn administrador aprobó tu acceso al panel del sitio de Icewell. Ya puedes entrar: $url",
            self::html('Acceso aprobado', '<p>Hola ' . self::e($u['nombre']) . ',</p><p>Un administrador aprobó tu acceso al panel del sitio de Icewell.</p>', 'Entrar al panel', $url, ''));
    }

    /** Aviso de una solicitud del formulario del sitio (Solicitudes::recibir). Todo va escapado. */
    public static function solicitud(string $para, array $s): bool
    {
        $url = Http::urlBase() . '/admin/editor#solicitudes';
        $filas = [['Nombre', $s['nombre']], ['Correo', $s['correo']], ['Necesita', $s['tipo']], ['Teléfono', $s['telefono'] ?: '—']];
        $texto = "Llegó una solicitud desde el formulario del sitio.\n\n"
            . implode("\n", array_map(fn($f) => $f[0] . ': ' . $f[1], $filas)) . "\n\nMensaje:\n" . $s['mensaje'] . "\n\nVer en el panel: $url";
        $html = '<p>Llegó una solicitud desde el formulario del sitio.</p><table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 14px">'
            . implode('', array_map(fn($f) => '<tr><td style="padding:3px 14px 3px 0;color:#4b6474">' . self::e($f[0]) . '</td><td style="padding:3px 0"><b>' . self::e($f[1]) . '</b></td></tr>', $filas))
            . '</table><p style="white-space:pre-wrap;border-left:3px solid #0062a8;padding-left:12px;margin:0">' . self::e($s['mensaje']) . '</p>';
        return self::enviar($para, 'Nueva solicitud: ' . $s['tipo'] . ' — ' . preg_replace('/[\r\n]+/', ' ', $s['nombre']),
            $texto, self::html('Nueva solicitud #' . (int)$s['id'], $html, 'Ver en el panel', $url, 'Para responder, escribe directamente a ' . $s['correo'] . '.'));
    }

    // ---------------------------------------------------------------- envío
    public static function enviar(string $para, string $asunto, string $texto, string $html): bool
    {
        if (!filter_var($para, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $para . $asunto)) return false;
        try {
            if (Config::esLocal()) { self::aBandeja($para, $asunto, $texto, $html); return true; }
            self::smtp($para, $asunto, $texto, $html);
            return true;
        } catch (Throwable $e) {
            error_log('[icewell correo] ' . $e->getMessage());
            try { Auditoria::registrar(null, 'correo.error', mb_substr($e->getMessage(), 0, 200)); } catch (Throwable $e2) {}
            return false;
        }
    }

    private static function aBandeja(string $para, string $asunto, string $texto, string $html): void
    {
        $dir = Config::get('dir_datos') . '/bandeja';
        if (!is_dir($dir)) mkdir($dir, 0700, true);
        // microsegundos en el nombre: así el orden alfabético es el orden de llegada
        $f = $dir . '/' . date('Ymd-His') . '-' . substr(explode(' ', microtime())[0], 2, 6) . '-' . bin2hex(random_bytes(2)) . '.json';
        file_put_contents($f, json_encode(['para' => $para, 'asunto' => $asunto, 'texto' => $texto, 'fecha' => time()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    }

    public static function bandeja(int $n = 30): array
    {
        $dir = Config::get('dir_datos') . '/bandeja';
        $archivos = glob($dir . '/*.json') ?: [];
        rsort($archivos);
        return array_values(array_filter(array_map(fn($f) => json_decode((string)file_get_contents($f), true), array_slice($archivos, 0, $n))));
    }

    private static function smtp(string $para, string $asunto, string $texto, string $html): void
    {
        $c = (array)Config::get('smtp');
        foreach (['host', 'puerto', 'usuario', 'clave', 'de'] as $k) if (empty($c[$k])) throw new RuntimeException("SMTP sin configurar: falta '$k'");
        $seg = $c['seguridad'] ?? 'tls';
        $remoto = ($seg === 'ssl' ? 'ssl://' : 'tcp://') . $c['host'] . ':' . (int)$c['puerto'];
        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $c['host']]]);
        $s = @stream_socket_client($remoto, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
        if (!$s) throw new RuntimeException("SMTP: no se pudo conectar ($errstr)");
        stream_set_timeout($s, 20);
        $leer = function () use ($s): array {
            $txt = '';
            while (($l = fgets($s, 1024)) !== false) { $txt .= $l; if (strlen($l) < 4 || $l[3] === ' ') break; }
            return [(int)substr($txt, 0, 3), $txt];
        };
        $cmd = function (string $linea, array $esperado) use ($s, $leer): string {
            if ($linea !== '') fwrite($s, $linea . "\r\n");
            [$cod, $txt] = $leer();
            if (!in_array($cod, $esperado, true)) throw new RuntimeException('SMTP: respuesta inesperada ' . trim($txt));
            return $txt;
        };
        $host = parse_url((string)Config::get('url_base'), PHP_URL_HOST) ?: 'localhost';
        try {
            $cmd('', [220]);
            $cmd("EHLO $host", [250]);
            if ($seg === 'tls') {
                $cmd('STARTTLS', [220]);
                if (!stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) throw new RuntimeException('SMTP: no se pudo iniciar TLS');
                $cmd("EHLO $host", [250]);
            }
            $cmd('AUTH LOGIN', [334]);
            $cmd(base64_encode($c['usuario']), [334]);
            $cmd(base64_encode($c['clave']), [235]);
            $cmd('MAIL FROM:<' . $c['de'] . '>', [250]);
            $cmd('RCPT TO:<' . $para . '>', [250, 251]);
            $cmd('DATA', [354]);
            $msg = self::mime($c, $para, $asunto, $texto, $html);
            $msg = preg_replace('/^\./m', '..', $msg);   // "dot-stuffing"
            fwrite($s, $msg . "\r\n.\r\n");
            $cmd('', [250]);
            $cmd('QUIT', [221]);
        } finally {
            fclose($s);
        }
    }

    private static function mime(array $c, string $para, string $asunto, string $texto, string $html): string
    {
        $limite = 'icw-' . bin2hex(random_bytes(8));
        $enc = fn($t) => '=?UTF-8?B?' . base64_encode($t) . '?=';
        $dominio = substr(strrchr($c['de'], '@') ?: '@icewell.cl', 1);
        $cab = [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . $enc($c['de_nombre'] ?? 'Icewell') . ' <' . $c['de'] . '>',
            'To: <' . $para . '>',
            'Subject: ' . $enc($asunto),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $dominio . '>',
            'MIME-Version: 1.0',
            'Auto-Submitted: auto-generated',
            'Content-Type: multipart/alternative; boundary="' . $limite . '"',
        ];
        $parte = fn($tipo, $cuerpo) => "--$limite\r\nContent-Type: $tipo; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($cuerpo), 76, "\r\n");
        return implode("\r\n", $cab) . "\r\n\r\n" . $parte('text/plain', $texto) . $parte('text/html', $html) . "--$limite--";
    }

    // ---------------------------------------------------------------- plantilla
    private static function e(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

    /** Correo HTML simple, con estilos en línea (los clientes de correo ignoran <style>). */
    private static function html(string $titulo, string $cuerpo, string $boton, string $url, string $pie): string
    {
        $u = self::e($url);
        return '<!doctype html><html lang="es"><body style="margin:0;background:#eef6f9;font-family:Arial,Helvetica,sans-serif;color:#112536">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef6f9;padding:24px 12px"><tr><td align="center">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff">'
            . '<tr><td style="background:#082436;padding:22px 28px;color:#f5efe0;font:800 22px Arial,sans-serif;letter-spacing:.02em">icewell <span style="color:#9fdff4;font:12px monospace;letter-spacing:.12em;text-transform:uppercase">· panel del sitio</span></td></tr>'
            . '<tr><td style="height:4px;line-height:4px;font-size:0;background:linear-gradient(90deg,#0062a8 0 33%,#1a9614 33% 66%,#d01726 66%);background-color:#0062a8">&nbsp;</td></tr>'
            . '<tr><td style="padding:28px">'
            . '<h1 style="margin:0 0 14px;font:800 24px Arial,sans-serif;color:#112536">' . self::e($titulo) . '</h1>'
            . '<div style="font-size:15px;line-height:1.6;color:#2c4555">' . $cuerpo . '</div>'
            . '<p style="margin:24px 0"><a href="' . $u . '" style="display:inline-block;background:#0062a8;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:6px">' . self::e($boton) . '</a></p>'
            . '<p style="font-size:12px;line-height:1.5;color:#4b6474">Si el botón no funciona, copia esta dirección en el navegador:<br><span style="word-break:break-all;color:#0062a8">' . $u . '</span></p>'
            . ($pie ? '<p style="font-size:13px;line-height:1.5;color:#4b6474;border-top:1px solid #dbe6ec;padding-top:14px">' . self::e($pie) . '</p>' : '')
            . '</td></tr></table></td></tr></table></body></html>';
    }
}
