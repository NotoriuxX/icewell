<?php
/* Cuentas: contraseñas, dominio permitido, registro, login, recuperación.
   Reglas de seguridad aplicadas acá (el navegador solo ayuda, no decide):
   - contraseña: Argon2id (bcrypt si el hosting no lo tiene) sobre HMAC-SHA256 con
     un "pepper" que vive en config.php, fuera de la BD;
   - solo correos del dominio de la empresa (comparación exacta, sin subdominios);
   - respuestas que no revelan si un correo existe (login, registro, recuperar);
   - tiempo parecido exista o no la cuenta (se verifica contra un hash de relleno). */
declare(strict_types=1);

final class Auth
{
    // hashes de relleno: verificar contra ellos cuesta lo mismo que contra uno real
    const RELLENO_ARGON = '$argon2id$v=19$m=65536,t=4,p=1$WjROdXBtcVhRcHJqdzJyYQ$twjI5vQ7Aji0ZD1pWG1xe+FO8a3ht02JHaISrjnRLN8';
    const RELLENO_BCRYPT = '$2y$12$jx0gj.z1tEyD2PBSoIiTye0j70a4MxXO0OgNKqrTiMiJBbm6eZxIu';

    // Contraseñas más usadas (y variantes locales). La regla principal es el largo (12+).
    const COMUNES = ['123456789012', '1234567890123', 'contraseña123', 'contrasena123', 'password1234', 'password12345',
        'qwertyuiop12', 'qwerty123456', '111111111111', '000000000000', 'abcdefghijkl', 'iloveyou1234', 'admin1234567',
        'administrador', 'administrador1', 'icewell12345', 'icewell2009', 'icewell123456', 'icewellspa123', 'santiago1234',
        'chile1234567', 'climatizacion', 'climatizacion1', 'bienvenido123', 'holahola1234', 'teamo1234567', 'superman1234',
        'micontraseña1', 'micontrasena1', 'passw0rd1234', 'p@ssw0rd1234', 'changeme1234', 'letmein12345', 'welcome12345',
        'football1234', 'monkey123456', 'dragon123456', 'asdfghjkl123', 'zxcvbnm12345', '1q2w3e4r5t6y', '1qaz2wsx3edc'];

    // ---------------------------------------------------------------- correo y dominio
    public static function normalizarCorreo(string $c): string
    {
        return strtolower(trim($c));
    }

    public static function dominioPermitido(string $correo): bool
    {
        if (!filter_var($correo, FILTER_VALIDATE_EMAIL) || strlen($correo) > 190) return false;
        if (!preg_match('/^[a-z0-9._%+-]+@([a-z0-9.-]+)$/', $correo, $m)) return false;   // solo ASCII: sin homógrafos Unicode
        return in_array($m[1], (array)Config::get('dominios_permitidos'), true);
    }

    // ---------------------------------------------------------------- contraseñas
    /** Devuelve el problema de la clave, o '' si está bien. */
    public static function problemaClave(string $clave, string $correo = '', string $nombre = ''): string
    {
        $largo = mb_strlen($clave);
        if ($largo < 12) return 'La contraseña debe tener al menos 12 caracteres.';
        if ($largo > 128) return 'La contraseña no puede tener más de 128 caracteres.';
        $min = mb_strtolower($clave);
        if (in_array($min, self::COMUNES, true) || count(array_unique(mb_str_split($min))) < 5) return 'Esa contraseña es muy fácil de adivinar. Prueba una frase de 3 o 4 palabras.';
        $partes = array_filter(array_merge(
            [strstr($correo, '@', true) ?: ''],
            preg_split('/\s+/', mb_strtolower($nombre)) ?: []
        ), fn($p) => mb_strlen($p) >= 4);
        foreach ($partes as $p) if (str_contains($min, mb_strtolower($p))) return 'La contraseña no puede contener tu nombre ni tu correo.';
        return '';
    }

    private static function conPepper(string $clave): string
    {
        return hash_hmac('sha256', $clave, sodium_hex2bin((string)Config::get('pepper')));
    }

    private static function algoritmo()
    {
        return defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
    }

    public static function hashear(string $clave): string
    {
        $opc = self::algoritmo() === PASSWORD_BCRYPT ? ['cost' => 12] : [];
        return password_hash(self::conPepper($clave), self::algoritmo(), $opc);
    }

    /** Verifica (en tiempo parecido aunque no haya hash) y re-hashea si cambió el algoritmo. */
    public static function verificarClave(?array $u, string $clave): bool
    {
        $hash = $u['hash'] ?? null;
        if (!$hash) {
            password_verify(self::conPepper($clave), self::algoritmo() === PASSWORD_BCRYPT ? self::RELLENO_BCRYPT : self::RELLENO_ARGON);
            return false;
        }
        if (!password_verify(self::conPepper($clave), $hash)) return false;
        $opc = self::algoritmo() === PASSWORD_BCRYPT ? ['cost' => 12] : [];
        if (password_needs_rehash($hash, self::algoritmo(), $opc)) {
            Bd::ejecutar('UPDATE usuarios SET hash = ? WHERE id = ?', [self::hashear($clave), $u['id']]);
        }
        return true;
    }

    public static function crearUsuario(string $nombre, string $correo, ?string $clave, string $rol, string $estado, ?string $googleSub = null): int
    {
        return Bd::insertar('INSERT INTO usuarios (nombre, email, hash, rol, estado, google_sub, creado) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$nombre, $correo, $clave === null ? null : self::hashear($clave), $rol, $estado, $googleSub, time()]);
    }

    public static function cambiarClave(int $usuarioId, string $clave): void
    {
        Bd::ejecutar('UPDATE usuarios SET hash = ? WHERE id = ?', [self::hashear($clave), $usuarioId]);
        Sesion::cerrarTodas($usuarioId);
    }

    public static function porCorreo(string $correo): ?array
    {
        return Bd::uno('SELECT * FROM usuarios WHERE email = ?', [$correo]);
    }

    public static function limpiarNombre(string $n): string
    {
        $n = trim(preg_replace('/\s+/u', ' ', preg_replace('/[\x00-\x1F\x7F<>]/u', '', $n) ?? '') ?? '');
        return mb_substr($n, 0, 80);
    }

    private static function esAdminInicial(string $correo): bool
    {
        $a = self::normalizarCorreo((string)Config::get('admin_inicial'));
        return $a !== '' && hash_equals($a, $correo);
    }

    /** Pasa de "correo verificado" a activo (admin inicial) o a esperar aprobación (resto). */
    private static function trasVerificar(array $u): string
    {
        if (self::esAdminInicial($u['email'])) {
            Bd::ejecutar("UPDATE usuarios SET estado = 'activo', rol = 'admin' WHERE id = ?", [$u['id']]);
            Auditoria::registrar((int)$u['id'], 'usuario.admin_inicial', $u['email']);
            return 'activo';
        }
        Bd::ejecutar("UPDATE usuarios SET estado = 'pendiente_aprobacion' WHERE id = ? AND estado = 'pendiente_verificacion'", [$u['id']]);
        Correo::avisarAdmins($u);
        return 'pendiente_aprobacion';
    }

    // ---------------------------------------------------------------- flujos
    public static function registro(array $d): array
    {
        $ip = Http::ip();
        Limites::exigir('registro_ip', $ip);
        Limites::registrar('registro_ip', $ip);
        $nombre = self::limpiarNombre((string)($d['nombre'] ?? ''));
        $correo = self::normalizarCorreo((string)($d['correo'] ?? ''));
        $clave = (string)($d['clave'] ?? '');
        if (mb_strlen($nombre) < 2) throw new ErrorHttp(422, 'Escribe tu nombre.', ['campo' => 'nombre']);
        if (!self::dominioPermitido($correo)) {
            throw new ErrorHttp(422, 'Usa tu correo de la empresa (@' . implode(', @', (array)Config::get('dominios_permitidos')) . ').', ['campo' => 'correo']);
        }
        if ($p = self::problemaClave($clave, $correo, $nombre)) throw new ErrorHttp(422, $p, ['campo' => 'clave']);

        $existe = self::porCorreo($correo);
        if ($existe) {
            // misma respuesta (y mismo tiempo: se calcula un hash igual) que un registro nuevo, así no se
            // revela que la cuenta existe; al dueño se le avisa por correo
            self::hashear($clave);
            Correo::avisoRegistroRepetido($existe);
            Auditoria::registrar((int)$existe['id'], 'registro.repetido', $correo);
        } else {
            $id = self::crearUsuario($nombre, $correo, $clave, 'editor', 'pendiente_verificacion');
            [$sel, $ver] = Tokens::crear($id, 'verificacion');
            Correo::verificacion(['id' => $id, 'nombre' => $nombre, 'email' => $correo], $sel, $ver);
            Auditoria::registrar($id, 'registro', $correo);
        }
        return ['ok' => true, 'mensaje' => 'Te enviamos un correo para confirmar tu dirección. Después, un administrador aprobará tu acceso.'];
    }

    public static function verificarCorreo(array $d): array
    {
        $ip = Http::ip();
        Limites::exigir('token_ip', $ip);
        $t = Tokens::consumir((string)($d['id'] ?? ''), (string)($d['t'] ?? ''), 'verificacion');
        if (!$t) { Limites::registrar('token_ip', $ip); throw new ErrorHttp(400, 'El enlace no es válido o ya venció. Puedes registrarte de nuevo o pedir recuperar tu contraseña.'); }
        $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$t['usuario_id']]);
        if (!$u || $u['estado'] === 'bloqueado') throw new ErrorHttp(400, 'El enlace no es válido.');
        $estado = $u['estado'] === 'pendiente_verificacion' ? self::trasVerificar($u) : $u['estado'];
        Auditoria::registrar((int)$u['id'], 'correo.verificado', $u['email']);
        return ['ok' => true, 'estado' => $estado, 'mensaje' => $estado === 'activo'
            ? 'Correo confirmado. Ya puedes entrar al panel.'
            : 'Correo confirmado. Te avisaremos por correo cuando un administrador apruebe tu acceso.'];
    }

    /** Login con clave. Si la cuenta tiene 2FA, devuelve un desafío en vez de la sesión. */
    public static function login(array $d): array
    {
        $ip = Http::ip();
        $correo = self::normalizarCorreo((string)($d['correo'] ?? ''));
        $clave = (string)($d['clave'] ?? '');
        Limites::exigir('login_ip', $ip);
        Limites::exigir('login_correo', $correo);
        if ($correo === '' || $clave === '' || mb_strlen($clave) > 256) throw new ErrorHttp(422, 'Escribe tu correo y tu contraseña.');

        $u = self::porCorreo($correo);
        if (!self::verificarClave($u, $clave)) {
            Limites::registrar('login_ip', $ip);
            Limites::registrar('login_correo', $correo);
            Auditoria::registrar($u ? (int)$u['id'] : null, 'login.fallido', $correo);
            throw new ErrorHttp(401, 'Correo o contraseña incorrectos.');
        }
        Limites::limpiar('login_correo', $correo);
        return self::abrirSesion($u, 'clave');
    }

    /** Estado de la cuenta → sesión, desafío 2FA o mensaje. Solo se llega acá con clave/Google válidos. */
    public static function abrirSesion(array $u, string $via): array
    {
        if ($u['estado'] === 'pendiente_verificacion') throw new ErrorHttp(403, 'Primero confirma tu correo con el enlace que te enviamos.', ['estado' => $u['estado']]);
        if ($u['estado'] === 'pendiente_aprobacion') throw new ErrorHttp(403, 'Tu cuenta está esperando la aprobación de un administrador.', ['estado' => $u['estado']]);
        if ($u['estado'] !== 'activo') throw new ErrorHttp(403, 'Esta cuenta está bloqueada. Habla con un administrador.', ['estado' => $u['estado']]);
        if ((int)$u['totp_activo'] === 1) {
            [$sel, $ver] = Tokens::crear((int)$u['id'], 'desafio_totp');
            return ['ok' => true, 'requiere_totp' => true, 'desafio' => $sel . '.' . $ver];
        }
        $s = Sesion::crear($u);
        Auditoria::registrar((int)$u['id'], 'login', $via);
        return ['ok' => true, 'csrf' => $s['csrf']];
    }

    public static function loginTotp(array $d): array
    {
        $ip = Http::ip();
        Limites::exigir('totp', $ip);
        [$sel, $ver] = array_pad(explode('.', (string)($d['desafio'] ?? ''), 2), 2, '');
        $t = Tokens::revisar($sel, $ver, 'desafio_totp');
        if (!$t) throw new ErrorHttp(401, 'El paso de verificación venció. Vuelve a entrar.');
        $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$t['usuario_id']]);
        $secreto = Cripto::descifrar($u['totp_secreto'] ?? null);
        if (!$u || !$secreto || !Totp::verificar($secreto, (string)($d['codigo'] ?? ''), (int)$u['id'])) {
            Limites::registrar('totp', $ip);
            Auditoria::registrar($u ? (int)$u['id'] : null, 'login.totp_fallido');
            throw new ErrorHttp(401, 'Código incorrecto.');
        }
        if (!Tokens::consumir($sel, $ver, 'desafio_totp')) throw new ErrorHttp(401, 'El paso de verificación venció. Vuelve a entrar.');
        if ($u['estado'] !== 'activo') throw new ErrorHttp(403, 'Esta cuenta no está activa.');
        $s = Sesion::crear($u);
        Auditoria::registrar((int)$u['id'], 'login', '2fa');
        return ['ok' => true, 'csrf' => $s['csrf']];
    }

    public static function recuperar(array $d): array
    {
        $ip = Http::ip();
        $correo = self::normalizarCorreo((string)($d['correo'] ?? ''));
        Limites::exigir('recuperar_ip', $ip);
        Limites::registrar('recuperar_ip', $ip);
        $generico = ['ok' => true, 'mensaje' => 'Si el correo pertenece a una cuenta, te llegará un enlace para crear una contraseña nueva. Revisa también la carpeta de spam. El enlace dura 30 minutos.'];
        if (!self::dominioPermitido($correo)) return $generico;
        if (Limites::contar('recuperar_correo', $correo) >= Limites::REGLAS['recuperar_correo'][0]) return $generico;   // sin avisar: no se revela nada
        Limites::registrar('recuperar_correo', $correo);
        $u = self::porCorreo($correo);
        if ($u && $u['estado'] !== 'bloqueado') {
            if ($u['estado'] === 'pendiente_verificacion') {
                [$sel, $ver] = Tokens::crear((int)$u['id'], 'verificacion');
                Correo::verificacion($u, $sel, $ver);
            } else {
                [$sel, $ver] = Tokens::crear((int)$u['id'], 'reset');
                Correo::recuperar($u, $sel, $ver);
            }
            Auditoria::registrar((int)$u['id'], 'recuperar.pedido', $correo);
        }
        return $generico;
    }

    public static function validarEnlaceReset(array $d): array
    {
        $ip = Http::ip();
        Limites::exigir('token_ip', $ip);
        $t = Tokens::revisar((string)($d['id'] ?? ''), (string)($d['t'] ?? ''), 'reset');
        if (!$t) { Limites::registrar('token_ip', $ip); throw new ErrorHttp(400, 'El enlace no es válido, ya se usó o venció (dura 30 minutos). Pide uno nuevo.'); }
        $u = Bd::uno('SELECT nombre, email FROM usuarios WHERE id = ?', [$t['usuario_id']]);
        // se muestra el correo enmascarado para que la persona sepa qué cuenta está recuperando
        return ['ok' => true, 'correo' => self::enmascarar($u['email'] ?? ''), 'nombre' => $u['nombre'] ?? ''];
    }

    public static function restablecer(array $d): array
    {
        $ip = Http::ip();
        Limites::exigir('token_ip', $ip);
        $sel = (string)($d['id'] ?? ''); $ver = (string)($d['t'] ?? ''); $clave = (string)($d['clave'] ?? '');
        $t = Tokens::revisar($sel, $ver, 'reset');
        if (!$t) { Limites::registrar('token_ip', $ip); throw new ErrorHttp(400, 'El enlace no es válido, ya se usó o venció. Pide uno nuevo.'); }
        $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$t['usuario_id']]);
        if (!$u || $u['estado'] === 'bloqueado') throw new ErrorHttp(400, 'El enlace no es válido.');
        if ($p = self::problemaClave($clave, $u['email'], $u['nombre'])) throw new ErrorHttp(422, $p, ['campo' => 'clave']);
        if ($u['hash'] && self::verificarClave($u, $clave)) throw new ErrorHttp(422, 'La contraseña nueva debe ser distinta de la anterior.', ['campo' => 'clave']);
        if (!Tokens::consumir($sel, $ver, 'reset')) throw new ErrorHttp(400, 'El enlace ya se usó. Pide uno nuevo.');
        self::cambiarClave((int)$u['id'], $clave);
        // abrir el enlace del correo prueba que la dirección es suya
        if ($u['estado'] === 'pendiente_verificacion') self::trasVerificar($u);
        Correo::claveCambiada($u);
        Auditoria::registrar((int)$u['id'], 'clave.restablecida', $u['email']);
        return ['ok' => true, 'mensaje' => 'Contraseña actualizada. Se cerraron las sesiones abiertas; entra con la nueva.'];
    }

    /** Entrada con Google: ID token verificado en el servidor (firma, audiencia, dominio). */
    public static function google(array $d): array
    {
        $ip = Http::ip();
        Limites::exigir('google_ip', $ip);
        Limites::registrar('google_ip', $ip);
        $p = Google::verificar((string)($d['credential'] ?? ''));
        $correo = self::normalizarCorreo($p['email']);
        $u = Bd::uno('SELECT * FROM usuarios WHERE google_sub = ?', [$p['sub']]) ?? self::porCorreo($correo);
        if ($u && $u['google_sub'] && $u['google_sub'] !== $p['sub']) throw new ErrorHttp(403, 'Esta cuenta ya está vinculada a otro usuario de Google.');
        if (!$u) {
            $nombre = self::limpiarNombre((string)($p['name'] ?? '')) ?: strstr($correo, '@', true);
            $id = self::crearUsuario($nombre, $correo, null, 'editor', 'pendiente_verificacion', $p['sub']);
            $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$id]);
            Auditoria::registrar($id, 'registro.google', $correo);
            self::trasVerificar($u);   // Google ya verificó el correo
            $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$id]);
        } else {
            if (!$u['google_sub']) {
                Bd::ejecutar('UPDATE usuarios SET google_sub = ? WHERE id = ?', [$p['sub'], $u['id']]);
                Auditoria::registrar((int)$u['id'], 'google.vinculado', $correo);
            }
            if ($u['estado'] === 'pendiente_verificacion') { self::trasVerificar($u); $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$u['id']]); }
        }
        return self::abrirSesion($u, 'google');
    }

    /** Solo modo local y solo desde la misma PC: entra como el primer admin (lo crea si no hay). */
    public static function desarrollador(): array
    {
        if (!Config::esLocal() || !Http::esIpLocal()) throw new ErrorHttp(404, 'No encontrado.');
        $u = Bd::uno("SELECT * FROM usuarios WHERE rol = 'admin' AND estado = 'activo' ORDER BY id LIMIT 1");
        if (!$u) {
            $id = self::crearUsuario('Desarrollador local', 'desarrollador@local.test', null, 'admin', 'activo');
            $u = Bd::uno('SELECT * FROM usuarios WHERE id = ?', [$id]);
        }
        $s = Sesion::crear($u);
        Auditoria::registrar((int)$u['id'], 'login', 'desarrollador local');
        return ['ok' => true, 'csrf' => $s['csrf']];
    }

    public static function enmascarar(string $correo): string
    {
        [$l, $d] = array_pad(explode('@', $correo, 2), 2, '');
        return mb_substr($l, 0, 2) . str_repeat('•', max(1, mb_strlen($l) - 2)) . '@' . $d;
    }

    public static function publico(array $u): array
    {
        return ['id' => (int)$u['id'], 'nombre' => $u['nombre'], 'email' => $u['email'], 'rol' => $u['rol'],
            'estado' => $u['estado'], 'google' => !empty($u['google_sub']), 'totp' => (int)$u['totp_activo'] === 1,
            'creado' => (int)$u['creado'], 'ultimo_login' => $u['ultimo_login'] ? (int)$u['ultimo_login'] : null];
    }
}
