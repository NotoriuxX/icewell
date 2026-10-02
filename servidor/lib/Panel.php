<?php
/* Contenido (versiones, guardar, publicar) y administración de usuarios. */
declare(strict_types=1);

final class Panel
{
    const MAX_VERSIONES = 150;

    // ---------------------------------------------------------------- contenido
    private static function ultima(): ?array
    {
        return Bd::uno('SELECT id, json, autor_id, creado, estado FROM contenido_versiones ORDER BY id DESC LIMIT 1');
    }
    private static function ultimaPublicada(): ?array
    {
        return Bd::uno("SELECT id, creado FROM contenido_versiones WHERE estado = 'publicado' ORDER BY id DESC LIMIT 1");
    }

    /** Primera vez: el contenido inicial es la semilla (lo que hoy está publicado). */
    private static function asegurarSemilla(): void
    {
        if (self::ultima()) return;
        $semilla = json_decode((string)file_get_contents(__DIR__ . '/../semilla.json'), true);
        [$limpio] = Contenido::validar($semilla, Config::get('dir_web') . '/assets');
        Bd::insertar("INSERT INTO contenido_versiones (json, autor_id, creado, estado, nota) VALUES (?, NULL, ?, 'publicado', 'Contenido inicial')",
            [json_encode($limpio, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), time()]);
    }

    public static function contenido(): array
    {
        self::asegurarSemilla();
        $u = self::ultima();
        $p = self::ultimaPublicada();
        $autor = $u['autor_id'] ? Bd::uno('SELECT nombre FROM usuarios WHERE id = ?', [$u['autor_id']]) : null;
        return ['ok' => true, 'contenido' => json_decode($u['json'], true), 'version' => (int)$u['id'],
            'guardado' => ['fecha' => (int)$u['creado'], 'autor' => $autor['nombre'] ?? 'Sistema'],
            'publicada' => $p ? (int)$p['id'] : null, 'sinPublicar' => !$p || (int)$p['id'] !== (int)$u['id']];
    }

    public static function guardar(array $d, array $s): array
    {
        self::asegurarSemilla();
        $base = (int)($d['base'] ?? 0);
        $u = self::ultima();
        // bloqueo optimista: si otra persona guardó después de que abriste el editor, no se pisan los cambios
        if ((int)$u['id'] !== $base) {
            $autor = $u['autor_id'] ? Bd::uno('SELECT nombre FROM usuarios WHERE id = ?', [$u['autor_id']]) : null;
            throw new ErrorHttp(409, 'Otra persona (' . ($autor['nombre'] ?? 'alguien') . ') guardó cambios mientras editabas. Copia lo tuyo, recarga y vuelve a aplicarlo.',
                ['version' => (int)$u['id']]);
        }
        [$limpio, $errores] = Contenido::validar($d['contenido'] ?? null, Config::get('dir_web') . '/assets');
        if ($errores) throw new ErrorHttp(422, 'Hay datos por corregir antes de guardar.', ['errores' => $errores]);
        $json = json_encode($limpio, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === $u['json']) return ['ok' => true, 'version' => (int)$u['id'], 'sinCambios' => true];
        $nota = mb_substr(trim(preg_replace('/[\x00-\x1F\x7F]/', '', (string)($d['nota'] ?? '')) ?? ''), 0, 200);
        $id = Bd::insertar("INSERT INTO contenido_versiones (json, autor_id, creado, estado, nota) VALUES (?, ?, ?, 'borrador', ?)",
            [$json, $s['id'], time(), $nota]);
        // historial acotado (se conservan siempre las publicadas recientes)
        $corte = Bd::uno('SELECT id FROM contenido_versiones ORDER BY id DESC LIMIT 1 OFFSET ' . self::MAX_VERSIONES);
        if ($corte) Bd::ejecutar("DELETE FROM contenido_versiones WHERE id <= ? AND estado <> 'publicado'", [$corte['id']]);
        Auditoria::registrar((int)$s['id'], 'contenido.guardado', "versión $id" . ($nota ? " · $nota" : ''));
        return ['ok' => true, 'version' => $id, 'contenido' => $limpio];
    }

    public static function publicar(array $d, array $s): array
    {
        if (Config::get('publicar_rol') === 'admin' && $s['rol'] !== 'admin') throw new ErrorHttp(403, 'Solo un administrador puede publicar. Guarda y avísale.');
        self::asegurarSemilla();
        $u = self::ultima();
        if ((int)($d['version'] ?? 0) !== (int)$u['id']) throw new ErrorHttp(409, 'Hay una versión más nueva guardada. Recarga el editor antes de publicar.');
        [$limpio, $errores] = Contenido::validar(json_decode($u['json'], true), Config::get('dir_web') . '/assets');
        if ($errores) throw new ErrorHttp(422, 'Hay datos por corregir antes de publicar.', ['errores' => $errores]);
        $dirWeb = (string)Config::get('dir_web');
        Contenido::publicar($limpio, $dirWeb, Config::get('dir_datos') . '/respaldos');
        $pdf = PdfAssets::regenerar($limpio, $dirWeb);
        Bd::ejecutar("UPDATE contenido_versiones SET estado = 'publicado' WHERE id = ?", [$u['id']]);
        Auditoria::registrar((int)$s['id'], 'contenido.publicado', "versión {$u['id']} · fotos PDF: {$pdf['fotos']} ({$pdf['nuevas']} nuevas)");
        return ['ok' => true, 'version' => (int)$u['id'], 'pdf' => $pdf];
    }

    public static function historial(): array
    {
        $filas = Bd::todos('SELECT v.id, v.creado, v.estado, v.nota, LENGTH(v.json) AS bytes, u.nombre AS autor
                            FROM contenido_versiones v LEFT JOIN usuarios u ON u.id = v.autor_id ORDER BY v.id DESC LIMIT 60');
        return ['ok' => true, 'versiones' => array_map(fn($f) => ['id' => (int)$f['id'], 'fecha' => (int)$f['creado'], 'estado' => $f['estado'],
            'nota' => $f['nota'], 'autor' => $f['autor'] ?? 'Sistema', 'bytes' => (int)$f['bytes']], $filas)];
    }

    public static function version(int $id): array
    {
        $v = Bd::uno('SELECT json FROM contenido_versiones WHERE id = ?', [$id]);
        if (!$v) throw new ErrorHttp(404, 'Esa versión ya no existe.');
        return ['ok' => true, 'id' => $id, 'contenido' => json_decode($v['json'], true)];
    }

    // ---------------------------------------------------------------- usuarios (admin)
    public static function usuarios(): array
    {
        return ['ok' => true, 'usuarios' => array_map([Auth::class, 'publico'], Bd::todos('SELECT * FROM usuarios ORDER BY estado <> \'pendiente_aprobacion\', id'))];
    }

    private static function adminsActivos(): int
    {
        return (int)Bd::uno("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND estado = 'activo'")['n'];
    }

    public static function actualizarUsuario(array $d, array $s): array
    {
        $id = (int)($d['id'] ?? 0);
        $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$id]);
        if (!$u) throw new ErrorHttp(404, 'Usuario no encontrado.');
        $accion = (string)($d['accion'] ?? '');
        $propio = $id === (int)$s['id'];
        $ultimoAdmin = $u['rol'] === 'admin' && $u['estado'] === 'activo' && self::adminsActivos() <= 1;
        switch ($accion) {
            case 'aprobar':
                if (!in_array($u['estado'], ['pendiente_aprobacion', 'bloqueado'], true)) throw new ErrorHttp(422, 'Este usuario no está esperando aprobación.');
                Bd::ejecutar("UPDATE usuarios SET estado = 'activo' WHERE id = ?", [$id]);
                if ($u['estado'] === 'pendiente_aprobacion') Correo::aprobado($u);
                break;
            case 'bloquear':
                if ($propio) throw new ErrorHttp(422, 'No puedes bloquearte a ti mismo.');
                if ($ultimoAdmin) throw new ErrorHttp(422, 'Es el último administrador activo.');
                Bd::ejecutar("UPDATE usuarios SET estado = 'bloqueado' WHERE id = ?", [$id]);
                Sesion::cerrarTodas($id);
                break;
            case 'rechazar':   // borra una solicitud que nunca fue aprobada
                if (!in_array($u['estado'], ['pendiente_verificacion', 'pendiente_aprobacion'], true)) throw new ErrorHttp(422, 'Solo se pueden rechazar solicitudes pendientes. Para un usuario activo, bloquéalo.');
                Bd::ejecutar('DELETE FROM tokens WHERE usuario_id = ?', [$id]);
                Bd::ejecutar('DELETE FROM usuarios WHERE id = ?', [$id]);
                break;
            case 'rol':
                $rol = (string)($d['rol'] ?? '');
                if (!in_array($rol, ['admin', 'editor'], true)) throw new ErrorHttp(422, 'Rol inválido.');
                if ($propio && $rol !== 'admin') throw new ErrorHttp(422, 'No puedes quitarte el rol de administrador a ti mismo.');
                if ($ultimoAdmin && $rol !== 'admin') throw new ErrorHttp(422, 'Es el último administrador activo.');
                Bd::ejecutar('UPDATE usuarios SET rol = ? WHERE id = ?', [$rol, $id]);
                Sesion::cerrarTodas($id);   // el permiso nuevo rige desde ya
                break;
            case 'cerrar_sesiones':
                Sesion::cerrarTodas($id);
                break;
            case 'quitar_2fa':   // por si pierde el teléfono
                if ($propio) throw new ErrorHttp(422, 'Para tu propia cuenta usa "Mi cuenta".');
                Bd::ejecutar('UPDATE usuarios SET totp_activo = 0, totp_secreto = NULL WHERE id = ?', [$id]);
                Sesion::cerrarTodas($id);
                break;
            default:
                throw new ErrorHttp(422, 'Acción desconocida.');
        }
        Auditoria::registrar((int)$s['id'], 'usuario.' . $accion, $u['email'] . ($accion === 'rol' ? ' → ' . $d['rol'] : ''));
        return self::usuarios();
    }

    // ---------------------------------------------------------------- mi cuenta
    public static function cambiarMiClave(array $d, array $s): array
    {
        $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$s['id']]);
        Limites::exigir('login_correo', $u['email']);
        if ($u['hash'] && !Auth::verificarClave($u, (string)($d['actual'] ?? ''))) {
            Limites::registrar('login_correo', $u['email']);
            throw new ErrorHttp(401, 'La contraseña actual no es correcta.', ['campo' => 'actual']);
        }
        $nueva = (string)($d['nueva'] ?? '');
        if ($p = Auth::problemaClave($nueva, $u['email'], $u['nombre'])) throw new ErrorHttp(422, $p, ['campo' => 'nueva']);
        Auth::cambiarClave((int)$u['id'], $nueva);   // cierra todas las sesiones…
        $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$s['id']]);
        $ses = Sesion::crear($u);                     // …y abre una nueva en este navegador
        Correo::claveCambiada($u);
        Auditoria::registrar((int)$u['id'], 'clave.cambiada');
        return ['ok' => true, 'csrf' => $ses['csrf'], 'mensaje' => 'Contraseña cambiada. Se cerraron tus otras sesiones.'];
    }

    public static function totpIniciar(array $s): array
    {
        $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$s['id']]);
        if ((int)$u['totp_activo'] === 1) throw new ErrorHttp(422, 'La verificación en dos pasos ya está activa.');
        $sec = Totp::nuevoSecreto();
        Bd::ejecutar('UPDATE usuarios SET totp_secreto = ? WHERE id = ?', [Cripto::cifrar($sec), $u['id']]);
        return ['ok' => true, 'secreto' => trim(chunk_split($sec, 4, ' ')), 'uri' => Totp::uri($sec, $u['email'])];
    }

    public static function totpActivar(array $d, array $s): array
    {
        $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$s['id']]);
        Limites::exigir('totp', Http::ip());
        $sec = Cripto::descifrar($u['totp_secreto']);
        if (!$sec || !Totp::verificar($sec, (string)($d['codigo'] ?? ''), (int)$u['id'])) {
            Limites::registrar('totp', Http::ip());
            throw new ErrorHttp(422, 'El código no coincide. Revisa que la hora del teléfono esté bien.');
        }
        Bd::ejecutar('UPDATE usuarios SET totp_activo = 1 WHERE id = ?', [$u['id']]);
        Auditoria::registrar((int)$u['id'], '2fa.activada');
        return ['ok' => true, 'mensaje' => 'Verificación en dos pasos activada.'];
    }

    public static function totpDesactivar(array $d, array $s): array
    {
        $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$s['id']]);
        Limites::exigir('totp', Http::ip());
        $sec = Cripto::descifrar($u['totp_secreto']);
        if (!$sec || !Totp::verificar($sec, (string)($d['codigo'] ?? ''), (int)$u['id'])) {
            Limites::registrar('totp', Http::ip());
            throw new ErrorHttp(422, 'Código incorrecto.');
        }
        Bd::ejecutar('UPDATE usuarios SET totp_activo = 0, totp_secreto = NULL WHERE id = ?', [$u['id']]);
        Auditoria::registrar((int)$u['id'], '2fa.desactivada');
        return ['ok' => true, 'mensaje' => 'Verificación en dos pasos desactivada.'];
    }
}
