<?php
/* Configuración: servidor/config.php, o modo local automático si no existe.
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
            $c = require $archivo;
            if (!is_array($c)) throw new RuntimeException('config.php debe devolver un array');
        } else {
            // Sin config.php solo se permite arrancar en una PC (php -S o consola), nunca en un hosting
            if (!in_array(PHP_SAPI, ['cli', 'cli-server'], true)) {
                throw new RuntimeException('Falta servidor/config.php (copiar config.ejemplo.php).');
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
            'dir_web' => realpath(self::DIR . '/../web') ?: self::DIR . '/../web',
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
        return self::$c = $c;
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
