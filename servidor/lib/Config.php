<?php
/* Configuración: servidor/config.php (hosting compartido), variables ICEWELL_* (Docker)
   o modo local automático si no hay ninguna de las dos.
   En modo local los secretos se generan una vez y quedan en servidor/datos/
   (fuera de git), así el panel funciona en tu PC sin configurar nada. */
declare(strict_types=1);

final class Config
{
    private static ?array $c = null;
    const DIR = __DIR__ . '/..';

    public static function cargar(): array
    {
        if (self::$c !== null) return self::$c;
        $archivo = self::DIR . '/config.php';
        if (is_file($archivo)) {
            // hosting compartido: config.php manda
            $c = require $archivo;
            if (!is_array($c)) throw new RuntimeException('config.php debe devolver un array');
        } elseif (self::env('ENTORNO') !== null) {
            // Docker (o cualquier servidor con variables de entorno): ICEWELL_*
            $c = self::desdeEntorno();
        } else {
            // Sin config.php ni variables solo se permite arrancar en una PC (php -S o consola), nunca en un hosting
            if (!in_array(PHP_SAPI, ['cli', 'cli-server'], true)) {
                throw new RuntimeException('Falta servidor/config.php (copiar config.ejemplo.php) o las variables ICEWELL_*.');
            }
            $c = ['entorno' => 'local'];
        }
        $local = ($c['entorno'] ?? 'produccion') === 'local';
        $c += [
            'url_base' => '',
            'bd' => ['driver' => 'sqlite', 'sqlite' => self::DIR . '/datos/icewell.sqlite'],
            'dominios_permitidos' => ['icewell.cl'],
            'admin_inicial' => '',
            'publicar_rol' => 'admin',
            'google_client_id' => '',
            'smtp' => [],
            'proxies_confiables' => [],
            'dir_web' => self::buscarWeb(),
            'dir_datos' => self::DIR . '/datos',
        ];
        if ($local) {
            $sec = self::secretosLocales($c['dir_datos']);
            $c += ['pepper' => $sec['pepper'], 'clave_cifrado' => $sec['clave_cifrado']];
        }
        foreach (['pepper', 'clave_cifrado'] as $k) {
            if (!isset($c[$k]) || !preg_match('/^[0-9a-f]{64}$/', (string)$c[$k])) {
                throw new RuntimeException("config.php: '$k' debe ser de 64 caracteres hexadecimales (bin2hex(random_bytes(32))).");
            }
        }
        if (!$local && !preg_match('#^https://[^/]+$#', (string)$c['url_base'])) {
            throw new RuntimeException("config.php: 'url_base' debe ser https://dominio (sin barra final).");
        }
        $c['dominios_permitidos'] = array_map('strtolower', (array)$c['dominios_permitidos']);
        $c['desarrollador'] = $local && (($c['desarrollador'] ?? false) === true);   // en producción nunca
        return self::$c = $c;
    }

    /** Variable ICEWELL_<k>, o el contenido del archivo ICEWELL_<k>_FILE (Docker secrets). null si no está. */
    public static function env(string $k): ?string
    {
        $v = getenv('ICEWELL_' . $k);
        if ($v !== false && $v !== '') return $v;
        $f = getenv('ICEWELL_' . $k . '_FILE');
        if ($f !== false && $f !== '' && is_readable($f)) return trim((string)file_get_contents($f));
        return null;
    }

    /** Misma forma que config.php, armada desde las variables ICEWELL_* (ver .env.ejemplo). */
    private static function desdeEntorno(): array
    {
        $e = fn(string $k, ?string $def = null) => self::env($k) ?? $def;
        $lista = fn(?string $v) => $v === null ? [] : array_values(array_filter(array_map('trim', explode(',', $v))));
        $c = [
            'entorno' => $e('ENTORNO') === 'local' ? 'local' : 'produccion',
            'url_base' => rtrim((string)$e('URL_BASE', ''), '/'),
            'dominios_permitidos' => $lista($e('DOMINIOS', 'icewell.cl')),
            'admin_inicial' => (string)$e('ADMIN_INICIAL', ''),
            'publicar_rol' => $e('PUBLICAR_ROL') === 'editor' ? 'editor' : 'admin',
            'google_client_id' => (string)$e('GOOGLE_CLIENT_ID', ''),
            'proxies_confiables' => $lista($e('PROXIES_CONFIABLES')),
            // solo modo local: permite "Entrar como desarrollador" aunque la petición no venga de 127.0.0.1
            // (en Docker llega desde la red interna). En producción se ignora: ver Auth::desarrollador().
            'desarrollador' => $e('DESARROLLADOR') === '1',
        ];
        $driver = $e('BD_DRIVER', 'sqlite');
        $c['bd'] = $driver === 'mysql'
            ? ['driver' => 'mysql', 'host' => $e('BD_HOST', 'db'), 'puerto' => (int)$e('BD_PUERTO', '3306'), 'nombre' => $e('BD_NOMBRE', 'icewell'),
               'usuario' => $e('BD_USUARIO', 'icewell'), 'clave' => (string)$e('BD_CLAVE', '')]
            : ['driver' => 'sqlite', 'sqlite' => $e('BD_SQLITE', self::DIR . '/datos/icewell.sqlite')];
        foreach (['PEPPER' => 'pepper', 'CLAVE_CIFRADO' => 'clave_cifrado', 'DIR_WEB' => 'dir_web'] as $k => $dest) {
            if (($v = $e($k)) !== null) $c[$dest] = $v;
        }
        if ($e('SMTP_HOST') !== null) {
            $c['smtp'] = ['host' => $e('SMTP_HOST'), 'puerto' => (int)$e('SMTP_PUERTO', '587'), 'seguridad' => $e('SMTP_SEGURIDAD', 'tls'),
                'usuario' => (string)$e('SMTP_USUARIO', ''), 'clave' => (string)$e('SMTP_CLAVE', ''),
                'de' => (string)$e('SMTP_DE', (string)$e('SMTP_USUARIO', '')), 'de_nombre' => (string)$e('SMTP_DE_NOMBRE', 'Icewell · Panel del sitio')];
        }
        return $c;
    }

    /** Carpeta pública: web/ en el repo; public_html (o www, htdocs) en el hosting, al lado de servidor/;
        o la carpeta que contiene a servidor/ si quedó adentro de public_html. */
    private static function buscarWeb(): string
    {
        foreach (['/../web', '/../public_html', '/../www', '/../htdocs', '/..'] as $c) {
            $r = realpath(self::DIR . $c);
            if ($r && is_file($r . '/assets/sitio-render.js')) return $r;
        }
        return self::DIR . '/../web';
    }

    private static function secretosLocales(string $dir): array
    {
        $f = $dir . '/secretos-local.php';
        if (is_file($f)) return require $f;
        if (!is_dir($dir)) mkdir($dir, 0700, true);
        $s = ['pepper' => bin2hex(random_bytes(32)), 'clave_cifrado' => bin2hex(random_bytes(32))];
        file_put_contents($f, "<?php\n// Generado automáticamente para el modo local. No sirve en producción.\nreturn " . var_export($s, true) . ";\n", LOCK_EX);
        @chmod($f, 0600);
        return $s;
    }

    public static function get(string $k)
    {
        return self::cargar()[$k] ?? null;
    }

    public static function esLocal(): bool
    {
        return self::get('entorno') === 'local';
    }

    /** Solo para pruebas: reemplaza la configuración en memoria. */
    public static function forzar(array $c): void { self::$c = $c; }
}
