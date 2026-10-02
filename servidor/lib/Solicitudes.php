<?php
/* Formulario «Cuéntanos tu proyecto» del sitio (assets/contacto-form.js).
   - Ruta pública (sin sesión): vale lo de todo POST en api.php (mismo origen + cabecera propia + JSON).
   - Anti-spam sin captcha: campo trampa oculto y tiempo mínimo entre abrir y enviar. Si fallan,
     se responde "ok" igual (el bot no aprende qué lo delató) y no se guarda nada.
   - Límite por IP (Limites: contacto_ip).
   - Se guarda en la tabla `solicitudes` y se avisa por correo SOLO al correo de la empresa:
     nunca se escribe al correo que ingresó el visitante (el formulario no sirve de relé de spam). */
declare(strict_types=1);

final class Solicitudes
{
    const TIPOS = ['proyecto' => 'Proyecto nuevo', 'mantencion' => 'Mantención', 'asesoria' => 'Asesoría', 'otro' => 'Otro'];
    const MIN_MS = 3000;     // nadie completa 5 pasos en menos de 3 s

    public static function recibir(array $d): array
    {
        $ip = Http::ip();
        Limites::exigir('contacto_ip', $ip);
        // trampa: un campo que la persona no ve; un bot lo llena
        if (trim((string)($d['web'] ?? '')) !== '' || (int)($d['ms'] ?? 0) < self::MIN_MS) {
            Limites::registrar('contacto_ip', $ip);
            return ['ok' => true];
        }
        $errores = [];
        $txt = function (string $k, int $min, int $max, string $msg) use ($d, &$errores): string {
            $v = is_string($d[$k] ?? null) ? trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)$d[$k])) : '';
            $n = mb_strlen($v);
            if ($n < $min || $n > $max) $errores[$k] = $msg;
            return $v;
        };
        $nombre = $txt('nombre', 2, 80, 'Escribe tu nombre (2 a 80 caracteres).');
        if (preg_match('/[\r\n]/', $nombre)) $errores['nombre'] = 'El nombre va en una sola línea.';
        $correo = mb_strtolower($txt('correo', 6, 190, 'Escribe un correo válido.'));
        if (!filter_var($correo, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $correo)) $errores['correo'] = 'Escribe un correo válido.';
        $tipo = (string)($d['tipo'] ?? '');
        if (!isset(self::TIPOS[$tipo])) $errores['tipo'] = 'Elige qué necesitas.';
        $telefono = $txt('telefono', 0, 30, 'Teléfono demasiado largo.');
        if ($telefono !== '' && !preg_match('/^[0-9 +()\-]{6,30}$/', $telefono)) $errores['telefono'] = 'El teléfono solo lleva números, espacios y + ( ) -.';
        $mensaje = $txt('mensaje', 10, 2000, 'Cuéntanos un poco más (10 a 2000 caracteres).');
        if ($errores) throw new ErrorHttp(422, 'Revisa los datos marcados.', ['errores' => $errores]);

        Limites::registrar('contacto_ip', $ip);
        $id = Bd::insertar('INSERT INTO solicitudes (nombre, correo, tipo, telefono, mensaje, ip, creado, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$nombre, $correo, $tipo, $telefono, $mensaje, $ip, time(), 'nueva']);
        Auditoria::registrar(null, 'solicitud.recibida', "#$id " . self::TIPOS[$tipo]);
        $para = self::correoEmpresa();
        if ($para) Correo::solicitud($para, ['id' => $id, 'nombre' => $nombre, 'correo' => $correo, 'tipo' => self::TIPOS[$tipo], 'telefono' => $telefono, 'mensaje' => $mensaje]);
        return ['ok' => true];
    }

    /** El correo de la empresa que está publicado (Empresa y contacto → Correo). */
    public static function correoEmpresa(): string
    {
        $v = Bd::uno("SELECT json FROM contenido_versiones WHERE estado = 'publicado' ORDER BY id DESC LIMIT 1");
        $c = $v ? json_decode($v['json'], true) : json_decode((string)@file_get_contents(__DIR__ . '/../semilla.json'), true);
        $correo = (string)($c['empresa']['correo'] ?? '');
        return filter_var($correo, FILTER_VALIDATE_EMAIL) ? $correo : '';
    }

    public static function listar(): array
    {
        $filas = Bd::todos('SELECT id, nombre, correo, tipo, telefono, mensaje, creado, estado FROM solicitudes ORDER BY id DESC LIMIT 500');
        return ['ok' => true, 'tipos' => self::TIPOS, 'solicitudes' => array_map(fn($f) => [
            'id' => (int)$f['id'], 'nombre' => $f['nombre'], 'correo' => $f['correo'], 'tipo' => $f['tipo'], 'telefono' => $f['telefono'],
            'mensaje' => $f['mensaje'], 'fecha' => (int)$f['creado'], 'estado' => $f['estado']], $filas)];
    }

    public static function nuevas(): int
    {
        return (int)Bd::uno("SELECT COUNT(*) AS n FROM solicitudes WHERE estado = 'nueva'")['n'];
    }

    public static function estado(array $d, array $s): array
    {
        $id = (int)($d['id'] ?? 0); $estado = (string)($d['estado'] ?? '');
        if (!in_array($estado, ['nueva', 'atendida'], true)) throw new ErrorHttp(422, 'Estado inválido.');
        if (!Bd::uno('SELECT id FROM solicitudes WHERE id = ?', [$id])) throw new ErrorHttp(404, 'La solicitud no existe.');
        Bd::ejecutar('UPDATE solicitudes SET estado = ? WHERE id = ?', [$estado, $id]);
        Auditoria::registrar((int)$s['id'], 'solicitud.' . $estado, "#$id");
        return ['ok' => true];
    }

    public static function borrar(array $d, array $s): array
    {
        $id = (int)($d['id'] ?? 0);
        if (!Bd::uno('SELECT id FROM solicitudes WHERE id = ?', [$id])) throw new ErrorHttp(404, 'La solicitud no existe.');
        Bd::ejecutar('DELETE FROM solicitudes WHERE id = ?', [$id]);
        Auditoria::registrar((int)$s['id'], 'solicitud.borrada', "#$id");
        return ['ok' => true];
    }
}
