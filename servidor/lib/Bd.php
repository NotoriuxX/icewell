<?php
/* Base de datos: PDO con sentencias preparadas SIEMPRE (nunca se arma SQL con datos).
   SQLite en local, MySQL/MariaDB en el hosting. Las fechas se guardan como
   timestamp Unix (entero) para que el mismo SQL sirva en los dos motores. */
declare(strict_types=1);

final class Bd
{
    private static ?PDO $pdo = null;
    const VERSION_ESQUEMA = 2;   // 2: tabla solicitudes (formulario del sitio)

    public static function pdo(): PDO
    {
        if (self::$pdo) return self::$pdo;
        $c = Config::get('bd');
        $opc = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        if (($c['driver'] ?? 'sqlite') === 'mysql') {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], (int)($c['puerto'] ?? 3306), $c['nombre']);
            self::$pdo = new PDO($dsn, $c['usuario'], $c['clave'], $opc);
            self::$pdo->exec("SET time_zone = '+00:00', sql_mode = 'STRICT_ALL_TABLES'");
        } else {
            $ruta = $c['sqlite'] ?? Config::get('dir_datos') . '/icewell.sqlite';
            $dir = dirname($ruta);
            if (!is_dir($dir)) mkdir($dir, 0700, true);
            $nueva = !is_file($ruta);
            self::$pdo = new PDO('sqlite:' . $ruta, null, null, $opc);
            self::$pdo->exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
            if ($nueva) @chmod($ruta, 0600);
        }
        self::migrar();
        return self::$pdo;
    }

    public static function esMysql(): bool { return (Config::get('bd')['driver'] ?? 'sqlite') === 'mysql'; }

    public static function ejecutar(string $sql, array $p = []): PDOStatement
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($p);
        return $st;
    }
    public static function uno(string $sql, array $p = []): ?array
    {
        $r = self::ejecutar($sql, $p)->fetch();
        return $r === false ? null : $r;
    }
    public static function todos(string $sql, array $p = []): array { return self::ejecutar($sql, $p)->fetchAll(); }
    public static function insertar(string $sql, array $p = []): int
    {
        self::ejecutar($sql, $p);
        return (int)self::pdo()->lastInsertId();
    }
    public static function transaccion(callable $fn)
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try { $r = $fn(); $pdo->commit(); return $r; }
        catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    }

    /** Crea las tablas que falten. Idempotente: se puede correr siempre. */
    public static function migrar(): void
    {
        $pdo = self::$pdo ?? self::pdo();
        $my = self::esMysql();
        $pk = $my ? 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
        $largo = $my ? 'LONGTEXT' : 'TEXT';
        $motor = $my ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
        $pdo->exec("CREATE TABLE IF NOT EXISTS meta (clave VARCHAR(40) PRIMARY KEY, valor VARCHAR(200) NOT NULL)$motor");
        $v = (int)($pdo->query("SELECT valor FROM meta WHERE clave = 'esquema'")->fetchColumn() ?: 0);
        if ($v >= self::VERSION_ESQUEMA) return;

        $sql = [
            "CREATE TABLE IF NOT EXISTS usuarios (
                id $pk,
                nombre VARCHAR(80) NOT NULL,
                email VARCHAR(190) NOT NULL UNIQUE,
                hash VARCHAR(255) NULL,
                rol VARCHAR(10) NOT NULL DEFAULT 'editor',
                estado VARCHAR(24) NOT NULL DEFAULT 'pendiente_verificacion',
                google_sub VARCHAR(64) NULL UNIQUE,
                totp_secreto TEXT NULL,
                totp_activo INTEGER NOT NULL DEFAULT 0,
                sesiones_version INTEGER NOT NULL DEFAULT 1,
                creado INTEGER NOT NULL,
                ultimo_login INTEGER NULL,
                ultimo_ip VARCHAR(45) NULL
            )$motor",
            // sesiones propias en la BD (no archivos de sesión de PHP): en un hosting compartido
            // la carpeta de sesiones puede ser legible por otros sitios del mismo servidor.
            // Se guarda solo el SHA-256 del valor de la cookie.
            "CREATE TABLE IF NOT EXISTS sesiones (
                id $pk,
                token_hash CHAR(64) NOT NULL UNIQUE,
                usuario_id INTEGER NOT NULL,
                csrf CHAR(64) NOT NULL,
                version INTEGER NOT NULL,
                creado INTEGER NOT NULL,
                ultimo INTEGER NOT NULL,
                ip VARCHAR(45) NOT NULL,
                agente VARCHAR(200) NOT NULL DEFAULT ''
            )$motor",
            "CREATE TABLE IF NOT EXISTS tokens (
                id $pk,
                selector CHAR(32) NOT NULL UNIQUE,
                verificador_hash CHAR(64) NOT NULL,
                usuario_id INTEGER NOT NULL,
                tipo VARCHAR(20) NOT NULL,
                expira INTEGER NOT NULL,
                usado INTEGER NOT NULL DEFAULT 0,
                creado INTEGER NOT NULL
            )$motor",
            "CREATE TABLE IF NOT EXISTS intentos (
                id $pk,
                tipo VARCHAR(20) NOT NULL,
                clave VARCHAR(190) NOT NULL,
                momento INTEGER NOT NULL
            )$motor",
            "CREATE TABLE IF NOT EXISTS contenido_versiones (
                id $pk,
                json $largo NOT NULL,
                autor_id INTEGER NULL,
                creado INTEGER NOT NULL,
                estado VARCHAR(12) NOT NULL DEFAULT 'borrador',
                nota VARCHAR(200) NOT NULL DEFAULT ''
            )$motor",
            "CREATE TABLE IF NOT EXISTS auditoria (
                id $pk,
                usuario_id INTEGER NULL,
                accion VARCHAR(40) NOT NULL,
                detalle VARCHAR(500) NOT NULL DEFAULT '',
                ip VARCHAR(45) NOT NULL DEFAULT '',
                creado INTEGER NOT NULL
            )$motor",
            // formulario «Cuéntanos tu proyecto» (Solicitudes.php)
            "CREATE TABLE IF NOT EXISTS solicitudes (
                id $pk,
                nombre VARCHAR(80) NOT NULL,
                correo VARCHAR(190) NOT NULL,
                tipo VARCHAR(20) NOT NULL,
                telefono VARCHAR(30) NOT NULL DEFAULT '',
                mensaje TEXT NOT NULL,
                ip VARCHAR(45) NOT NULL DEFAULT '',
                creado INTEGER NOT NULL,
                estado VARCHAR(12) NOT NULL DEFAULT 'nueva'
            )$motor",
        ];
        foreach ($sql as $s) $pdo->exec($s);
        $indices = [
            ['idx_sesiones_usuario', 'sesiones', 'usuario_id'],
            ['idx_tokens_usuario', 'tokens', 'usuario_id, tipo'],
            ['idx_intentos', 'intentos', 'tipo, clave, momento'],
            ['idx_auditoria_creado', 'auditoria', 'creado'],
            ['idx_solicitudes_estado', 'solicitudes', 'estado'],
        ];
        foreach ($indices as [$n, $t, $cols]) {
            try { $pdo->exec($my ? "CREATE INDEX $n ON $t ($cols)" : "CREATE INDEX IF NOT EXISTS $n ON $t ($cols)"); }
            catch (PDOException $e) { /* MySQL: el índice ya existe */ }
        }
        $st = $pdo->prepare($my ? "REPLACE INTO meta (clave, valor) VALUES ('esquema', ?)" : "INSERT OR REPLACE INTO meta (clave, valor) VALUES ('esquema', ?)");
        $st->execute([(string)self::VERSION_ESQUEMA]);
    }

    /** Solo para pruebas. */
    public static function reiniciarConexion(): void { self::$pdo = null; }
}
