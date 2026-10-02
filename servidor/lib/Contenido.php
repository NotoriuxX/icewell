<?php
/* ==========================================================================
   Contenido del sitio: validación + generación de los JS públicos.

   La BD guarda el contenido como un JSON (versiones). Al PUBLICAR se escriben
   dos archivos estáticos que leen las páginas (así el sitio sigue funcionando
   con doble clic y sin PHP):
     web/assets/sitio-data.js → window.ICEWELL_SITIO (empresa, cifras, textos…)
     web/assets/cv-data.js    → SECTORES / REGIONES / PERIODOS / PROYECTOS
                                 (mismo formato que antes: las pruebas y los PDF no cambian)

   Todo lo que llega del navegador pasa por validar(): el front no se cree nada.
   ========================================================================== */
declare(strict_types=1);

final class Contenido
{
    const ESQUEMA = 3;   // 2 = diseño 2 (02-oct): ver servidor/migraciones/diseno2.json · 3 = LinkedIn de la empresa
    const EXT_IMG = '/^(obras\/)?[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(jpe?g|png|webp|svg)$/';
    const ID = '/^[a-z0-9][a-z0-9-]{0,63}$/';

    /** @var string[] */
    private array $errores = [];
    private string $dirAssets;

    private function __construct(string $dirAssets) { $this->dirAssets = rtrim($dirAssets, '/'); }

    /**
     * Valida y normaliza. Devuelve [contenidoLimpio, errores[]].
     * Normaliza: recorta espacios, quita caracteres de control, fuerza tipos.
     */
    public static function validar($c, string $dirAssets): array
    {
        $v = new self($dirAssets);
        $limpio = $v->todo(self::completar(is_array($c) ? $c : []));
        return [$limpio, $v->errores];
    }

    /**
     * Agrega lo que falte (textos y opciones nuevas del sitio) desde servidor/semilla.json.
     * Así una versión guardada antes de que existiera un campo no lo deja en blanco.
     */
    public static function completar(array $c): array
    {
        static $semilla = null;
        if ($semilla === null) $semilla = json_decode((string)@file_get_contents(__DIR__ . '/../semilla.json'), true) ?: [];
        if ((int)($c['esquema'] ?? 1) < 2) $c = self::migrarDiseno2($c);
        if ((int)($c['esquema'] ?? 1) < 3) {
            // 3: LinkedIn de la empresa (Manuel, 02-oct). Solo si nadie había escrito uno.
            if (is_array($c['empresa'] ?? null) && trim((string)($c['empresa']['redes']['linkedin'] ?? '')) === '') {
                $c['empresa']['redes'] = (is_array($c['empresa']['redes'] ?? null) ? $c['empresa']['redes'] : []) + ['linkedin' => ''];
                $c['empresa']['redes']['linkedin'] = (string)($semilla['empresa']['redes']['linkedin'] ?? '');
            }
            $c['esquema'] = 3;
        }
        if (isset($semilla['textos'])) $c['textos'] = (is_array($c['textos'] ?? null) ? $c['textos'] : []) + $semilla['textos'];
        foreach (['inicio', 'cv'] as $sec) {
            if (isset($semilla[$sec]['serviciosColumnas']) && is_array($c[$sec] ?? null) && !isset($c[$sec]['serviciosColumnas'])) {
                $c[$sec]['serviciosColumnas'] = $semilla[$sec]['serviciosColumnas'];
            }
        }
        return $c;
    }

    /**
     * Esquema 1 → 2 (diseño 2, 02-oct). Los paneles que ya estaban en uso guardan los textos del
     * diseño anterior en la BD; sin esto seguirían mostrándolos. Se cambia SOLO lo que sigue igual
     * a la semilla anterior: lo que alguien editó a mano se respeta.
     */
    private static function migrarDiseno2(array $c): array
    {
        $m = json_decode((string)@file_get_contents(__DIR__ . '/../migraciones/diseno2.json'), true);
        if (!is_array($m)) return $c;
        $tx = is_array($c['textos'] ?? null) ? $c['textos'] : [];
        foreach ($m['textos'] as $k => [$viejo, $nuevo]) {
            if (!array_key_exists($k, $tx) || $tx[$k] === $viejo) $tx[$k] = $nuevo;
        }
        $c['textos'] = $tx;
        if (is_array($c['inicio'] ?? null)) {
            foreach ($m['listas'] as $k => [$viejo, $nuevo]) {
                if (($c['inicio'][$k] ?? null) == $viejo) $c['inicio'][$k] = $nuevo;
            }
            // Equipo: cada persona que sigue igual a la semilla anterior pasa a su versión nueva
            // (misma persona por nombre) o sale (Cristian Castro); se conserva la foto si ya tenía.
            // Quien no esté en la semilla anterior (agregado a mano) queda tal cual.
            if (is_array($c['inicio']['equipo'] ?? null)) {
                $porNombre = [];
                foreach ($m['equipo']['nuevo'] as $x) $porNombre[$x['nombre']] = $x;
                $sinFoto = fn($x) => array_diff_key((array)$x, ['foto' => 1]);
                $viejos = array_map($sinFoto, $m['equipo']['viejo']);
                $equipo = []; $nombres = [];
                foreach ($c['inicio']['equipo'] as $x) {
                    if (!is_array($x)) continue;
                    if (in_array($sinFoto($x), $viejos, false)) {
                        if (!isset($porNombre[$x['nombre'] ?? ''])) continue;          // salió del equipo
                        $x = ['foto' => (string)($x['foto'] ?? '')] + $porNombre[$x['nombre']];
                        if ($x['foto'] === '') $x['foto'] = $porNombre[$x['nombre']]['foto'];
                    }
                    $equipo[] = $x; $nombres[$x['nombre'] ?? ''] = true;
                }
                foreach ($m['equipo']['nuevo'] as $x) if (!isset($nombres[$x['nombre']])) $equipo[] = $x;   // José Castillo
                $c['inicio']['equipo'] = $equipo;
            }
        }
        $c['esquema'] = 2;
        return $c;
    }

    // servicios por fila: 'auto' (todos en una fila) o 1–6
    private function columnas(array $o, string $campo): string
    {
        $v = (string)($o['serviciosColumnas'] ?? '3');
        if (!in_array($v, ['auto', '1', '2', '3', '4', '5', '6'], true)) { $this->err($campo, 'Elige automático o de 1 a 6 por fila.'); return '3'; }
        return $v;
    }

    // ---------------------------------------------------------------- reglas
    private function todo(array $c): array
    {
        $out = ['esquema' => self::ESQUEMA];

        $e = $this->obj($c, 'empresa');
        $out['empresa'] = [
            'nombre'          => $this->txt($e, 'nombre', 'empresa.nombre', 60, true),
            'razonSocial'     => $this->txt($e, 'razonSocial', 'empresa.razonSocial', 120, true),
            'giro'            => $this->txt($e, 'giro', 'empresa.giro', 200),
            'rut'             => $this->rut($e['rut'] ?? '', 'empresa.rut'),
            'direccion'       => $this->txt($e, 'direccion', 'empresa.direccion', 150, true),
            'comuna'          => $this->txt($e, 'comuna', 'empresa.comuna', 80),
            'ciudad'          => $this->txt($e, 'ciudad', 'empresa.ciudad', 80),
            'pais'            => $this->txt($e, 'pais', 'empresa.pais', 60),
            'telefono'        => $this->fono($e['telefono'] ?? '', 'empresa.telefono', true),
            'whatsapp'        => $this->fono($e['whatsapp'] ?? '', 'empresa.whatsapp', true),
            'correo'          => $this->correo($e['correo'] ?? '', 'empresa.correo', true),
            'correoComercial' => $this->correo($e['correoComercial'] ?? '', 'empresa.correoComercial', false),
            'web'             => $this->dominio($e['web'] ?? '', 'empresa.web'),
            'redes'           => [],
            'wa'              => [],
        ];
        $redes = $this->obj($e, 'redes');
        foreach (['linkedin', 'instagram', 'facebook', 'youtube'] as $r) {
            $out['empresa']['redes'][$r] = $this->url($redes[$r] ?? '', "empresa.redes.$r");
        }
        $wa = $this->obj($e, 'wa');
        foreach (['cotizar', 'cv', 'presentacion'] as $k) {
            $out['empresa']['wa'][$k] = $this->txt($wa, $k, "empresa.wa.$k", 300);
        }

        $ci = $this->obj($c, 'cifras');
        $out['cifras'] = [
            'obras'         => $this->txt($ci, 'obras', 'cifras.obras', 20, true),
            'm2'            => $this->txt($ci, 'm2', 'cifras.m2', 20, true),
            'regiones'      => $this->txt($ci, 'regiones', 'cifras.regiones', 20, true),
            'regionesTexto' => $this->txt($ci, 'regionesTexto', 'cifras.regionesTexto', 80),
        ];

        $cf = $this->obj($c, 'config');
        $fund = (string)($cf['fundacion'] ?? '');
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $fund, $m) || !checkdate((int)$m[2], (int)$m[3], (int)$m[1]) || (int)$m[1] < 1950 || (int)$m[1] > 2100) {
            $this->err('config.fundacion', 'Fecha de fundación inválida (aaaa-mm-dd).');
            $fund = '2009-01-01';
        }
        $out['config'] = ['fundacion' => $fund, 'botonAniversario' => (bool)($cf['botonAniversario'] ?? false)];

        $seo = $this->obj($c, 'seo');
        $out['seo'] = [
            'titulo'      => $this->txt($seo, 'titulo', 'seo.titulo', 90, true),
            'descripcion' => $this->txt($seo, 'descripcion', 'seo.descripcion', 300),
        ];

        $out['textos'] = [];
        foreach ($this->obj($c, 'textos') as $k => $val) {
            if (!is_string($k) || !preg_match('/^[a-z]+\.[A-Za-z0-9]{1,40}$/', $k)) { $this->err('textos', "Clave de texto inválida: $k"); continue; }
            $out['textos'][$k] = $this->limpiar($val, 2000, "textos.$k");
        }
        if (count($out['textos']) > 400) $this->err('textos', 'Demasiados textos.');

        $in = $this->obj($c, 'inicio');
        $out['inicio'] = [
            'heroFoto'    => $this->img($in['heroFoto'] ?? '', 'inicio.heroFoto', true),
            'heroFotoAlt' => $this->txt($in, 'heroFotoAlt', 'inicio.heroFotoAlt', 200),
            'serviciosColumnas' => $this->columnas($in, 'inicio.serviciosColumnas'),
            'servicios'   => $this->lista($in, 'servicios', 'inicio.servicios', 12, fn($x, $p) => [
                'etiqueta' => $this->txt($x, 'etiqueta', "$p.etiqueta", 60),
                'titulo'   => $this->txt($x, 'titulo', "$p.titulo", 80, true),
                'texto'    => $this->txt($x, 'texto', "$p.texto", 500),
            ]),
            'metodo'      => $this->lista($in, 'metodo', 'inicio.metodo', 8, fn($x, $p) => [
                'titulo' => $this->txt($x, 'titulo', "$p.titulo", 80, true),
                'texto'  => $this->txt($x, 'texto', "$p.texto", 300),
            ]),
            'hitos'       => $this->lista($in, 'hitos', 'inicio.hitos', 12, fn($x, $p) => [
                'fecha'  => $this->txt($x, 'fecha', "$p.fecha", 20, true),
                'titulo' => $this->txt($x, 'titulo', "$p.titulo", 80),      // opcional desde el diseño 2
                'texto'  => $this->txt($x, 'texto', "$p.texto", 300),
            ]),
            'equipo'      => $this->lista($in, 'equipo', 'inicio.equipo', 24, fn($x, $p) => [
                'cargo'  => $this->txt($x, 'cargo', "$p.cargo", 40),
                'nombre' => $this->txt($x, 'nombre', "$p.nombre", 80, true),
                'texto'  => $this->txt($x, 'texto', "$p.texto", 300),
                'foto'   => $this->img($x['foto'] ?? '', "$p.foto", false),
            ]),
            'socios'      => $this->lista($in, 'socios', 'inicio.socios', 40, fn($x, $p) => [
                'nombre' => $this->txt($x, 'nombre', "$p.nombre", 80, true),
                'logo'   => $this->img($x['logo'] ?? '', "$p.logo", true),
                'grande' => (bool)($x['grande'] ?? false),
            ]),
        ];

        $cv = $this->obj($c, 'cv');
        $out['cv'] = [
            'servicios' => $this->lista($cv, 'servicios', 'cv.servicios', 6, fn($x, $p) => [
                'etiqueta' => $this->txt($x, 'etiqueta', "$p.etiqueta", 60),
                'titulo'   => $this->txt($x, 'titulo', "$p.titulo", 80, true),
                'texto'    => $this->txt($x, 'texto', "$p.texto", 500),
                'resumen'  => $this->txt($x, 'resumen', "$p.resumen", 160),
                'items'    => $this->textos($x['items'] ?? [], "$p.items", 8, 80),
            ]),
            'certificaciones' => $this->textos($cv['certificaciones'] ?? [], 'cv.certificaciones', 8, 80),
            'serviciosColumnas' => $this->columnas($cv, 'cv.serviciosColumnas'),
        ];

        $pr = $this->obj($c, 'presentacion');
        $out['presentacion'] = [
            'caja' => $this->lista($pr, 'caja', 'presentacion.caja', 3, fn($x, $p) => [
                'etiqueta' => $this->txt($x, 'etiqueta', "$p.etiqueta", 60),
                'texto'    => $this->txt($x, 'texto', "$p.texto", 160),
            ]),
            'servicios' => $this->lista($pr, 'servicios', 'presentacion.servicios', 3, fn($x, $p) => [
                'icono'  => in_array($x['icono'] ?? '', ['asesoria', 'ingenieria', 'montaje'], true) ? $x['icono'] : 'asesoria',
                'titulo' => $this->txt($x, 'titulo', "$p.titulo", 80, true),
                'texto'  => $this->txt($x, 'texto', "$p.texto", 400),
                'tags'   => $this->textos($x['tags'] ?? [], "$p.tags", 5, 60),
            ]),
            'valorPuntos' => $this->textos($pr['valorPuntos'] ?? [], 'presentacion.valorPuntos', 4, 60),
            'barraAzul' => $this->lista($pr, 'barraAzul', 'presentacion.barraAzul', 3, fn($x, $p) => [
                'etiqueta' => $this->txt($x, 'etiqueta', "$p.etiqueta", 40),
                'texto'    => $this->txt($x, 'texto', "$p.texto", 80),
            ]),
        ];

        $cat = $this->obj($c, 'catalogos');
        $out['catalogos'] = [
            'sectores' => $this->catalogo($cat, 'sectores', 30),
            'regiones' => $this->catalogo($cat, 'regiones', 20),
            'periodos' => $this->lista($cat, 'periodos', 'catalogos.periodos', 12, function ($x, $p) {
                $id = (string)($x['id'] ?? '');
                if (!preg_match(self::ID, $id)) $this->err("$p.id", 'Id inválido.');
                $desde = (int)($x['desde'] ?? 0); $hasta = (int)($x['hasta'] ?? 0);
                if ($desde < 1950 || $hasta < $desde || $hasta > 9999) $this->err($p, 'Rango de años inválido.');
                return ['id' => $id, 'label' => $this->txt($x, 'label', "$p.label", 40, true), 'desde' => $desde, 'hasta' => $hasta];
            }),
        ];
        $secIds = array_column($out['catalogos']['sectores'], 'id');
        $regIds = array_column($out['catalogos']['regiones'], 'id');

        $out['obras'] = [];
        $ids = [];
        $obras = $c['obras'] ?? [];
        if (!is_array($obras) || count($obras) > 2000) { $this->err('obras', 'Lista de obras inválida.'); $obras = []; }
        foreach (array_values($obras) as $i => $o) {
            if (!is_array($o)) { $this->err("obras.$i", 'Obra inválida.'); continue; }
            $p = 'obras.' . $i;
            $id = (string)($o['id'] ?? '');
            if (!preg_match(self::ID, $id)) $this->err("$p.id", 'Id inválido.');
            if (isset($ids[$id])) $this->err("$p.id", "Id repetido: $id");
            $ids[$id] = true;
            $anio = $o['anio'] ?? null;
            if (!is_int($anio) && !(is_string($anio) && ctype_digit($anio))) $this->err("$p.anio", 'Año inválido.');
            $anio = (int)$anio;
            if ($anio < 1990 || $anio > 2100) $this->err("$p.anio", 'Año fuera de rango.');
            $m2 = $o['m2'] ?? null;
            if ($m2 === '' || $m2 === null) $m2 = null;
            elseif (is_numeric($m2) && (int)$m2 >= 0 && (int)$m2 <= 10000000) $m2 = (int)$m2;
            else { $this->err("$p.m2", 'Superficie inválida.'); $m2 = null; }
            $foto = $this->img($o['foto'] ?? '', "$p.foto", false);
            $sect = $this->ids($o['sectores'] ?? [], $secIds, "$p.sectores");
            if (!$sect) $this->err("$p.sectores", 'La obra necesita al menos un sector.');
            $obra = [
                'id'       => $id,
                'nombre'   => $this->txt($o, 'nombre', "$p.nombre", 200, true),
                'anio'     => $anio,
                'lugar'    => $this->txt($o, 'lugar', "$p.lugar", 150),
                'regiones' => $this->ids($o['regiones'] ?? [], $regIds, "$p.regiones"),
                'sectores' => $sect,
                'uso'      => $this->txt($o, 'uso', "$p.uso", 150),
                'sistemas' => $this->txt($o, 'sistemas', "$p.sistemas", 1000, true),
                'm2'       => $m2,
                'foto'     => $foto !== '' ? $foto : null,
                'estado'   => ($o['estado'] ?? '') === 'ejecucion' ? 'ejecucion' : 'ejecutado',
                'tags'     => $this->textos($o['tags'] ?? [], "$p.tags", 10, 40),
                'cliente'  => ($o['cliente'] ?? '') === 'Público' ? 'Público' : 'Privado',
            ];
            // opcionales: solo se escriben si traen valor (cv-data.js queda igual de limpio que antes)
            foreach (['trabajo' => 80, 'detalle' => 1500, 'textoPortada' => 300, 'alt' => 200, 'revisar' => 300] as $k => $max) {
                $val = $this->txt($o, $k, "$p.$k", $max);
                if ($val !== '') $obra[$k] = $val;
            }
            if (!empty($o['destacado'])) $obra['destacado'] = true;
            if (!empty($o['portada'])) {
                if ($obra['foto'] === null) $this->err("$p.portada", "«{$obra['nombre']}»: la portada exige foto.");
                $obra['portada'] = true;
                $obra['ordenPortada'] = max(0, min(999, (int)($o['ordenPortada'] ?? 0)));
                if (!empty($o['portadaAncha'])) $obra['portadaAncha'] = true;
            }
            $obra['visible'] = !array_key_exists('visible', $o) || (bool)$o['visible'];
            $out['obras'][] = $obra;
        }
        return $out;
    }

    // ---------------------------------------------------------------- helpers
    private function err(string $campo, string $msg): void
    {
        if (count($this->errores) < 50) $this->errores[] = ['campo' => $campo, 'error' => $msg];
    }

    private function obj($c, string $k): array
    {
        $v = is_array($c) ? ($c[$k] ?? []) : [];
        return is_array($v) ? $v : [];
    }

    /** Texto: sin caracteres de control (salvo \n), recortado, con largo máximo. */
    private function limpiar($v, int $max, string $campo): string
    {
        if (is_int($v) || is_float($v)) $v = (string)$v;
        if (!is_string($v)) { if ($v !== null) $this->err($campo, 'Debe ser texto.'); return ''; }
        if (!mb_check_encoding($v, 'UTF-8')) { $this->err($campo, 'Codificación inválida.'); return ''; }
        $v = str_replace(["\r\n", "\r"], "\n", $v);
        $v = preg_replace('/[\x00-\x09\x0B-\x1F\x7F\x{200B}-\x{200F}\x{2028}\x{2029}\x{202A}-\x{202E}]/u', '', $v) ?? '';
        $v = trim($v);
        if (mb_strlen($v) > $max) { $this->err($campo, "Máximo $max caracteres."); $v = mb_substr($v, 0, $max); }
        return $v;
    }

    private function txt(array $o, string $k, string $campo, int $max, bool $requerido = false): string
    {
        $v = $this->limpiar($o[$k] ?? '', $max, $campo);
        if ($requerido && $v === '') $this->err($campo, 'Obligatorio.');
        return $v;
    }

    private function textos($lista, string $campo, int $maxN, int $maxLen): array
    {
        if (!is_array($lista)) { $this->err($campo, 'Debe ser una lista.'); return []; }
        $out = [];
        foreach (array_values($lista) as $i => $t) {
            $t = $this->limpiar($t, $maxLen, "$campo.$i");
            if ($t !== '') $out[] = $t;
        }
        if (count($out) > $maxN) { $this->err($campo, "Máximo $maxN elementos."); $out = array_slice($out, 0, $maxN); }
        return $out;
    }

    private function lista(array $o, string $k, string $campo, int $maxN, callable $fn): array
    {
        $l = $o[$k] ?? [];
        if (!is_array($l)) { $this->err($campo, 'Debe ser una lista.'); return []; }
        if (count($l) > $maxN) { $this->err($campo, "Máximo $maxN elementos."); $l = array_slice($l, 0, $maxN); }
        $out = [];
        foreach (array_values($l) as $i => $x) $out[] = $fn(is_array($x) ? $x : [], "$campo.$i");
        return $out;
    }

    private function catalogo(array $cat, string $k, int $maxN): array
    {
        $ids = [];
        return $this->lista($cat, $k, "catalogos.$k", $maxN, function ($x, $p) use (&$ids) {
            $id = (string)($x['id'] ?? '');
            if (!preg_match(self::ID, $id)) $this->err("$p.id", 'Id inválido (minúsculas, números y guiones).');
            if (isset($ids[$id])) $this->err("$p.id", "Id repetido: $id");
            $ids[$id] = true;
            return ['id' => $id, 'label' => $this->txt($x, 'label', "$p.label", 40, true)];
        });
    }

    private function ids($lista, array $validos, string $campo): array
    {
        if (!is_array($lista)) { $this->err($campo, 'Debe ser una lista.'); return []; }
        $out = [];
        foreach ($lista as $id) {
            if (!is_string($id) || !in_array($id, $validos, true)) { $this->err($campo, 'Id desconocido: ' . (is_string($id) ? $id : '?')); continue; }
            if (!in_array($id, $out, true)) $out[] = $id;
        }
        return $out;
    }

    private function img($v, string $campo, bool $requerido): string
    {
        $v = is_string($v) ? trim($v) : '';
        if ($v === '') { if ($requerido) $this->err($campo, 'Falta la imagen.'); return ''; }
        if (!preg_match(self::EXT_IMG, $v) || str_contains($v, '..')) { $this->err($campo, 'Nombre de imagen inválido.'); return ''; }
        if (!is_file($this->dirAssets . '/' . $v)) { $this->err($campo, "La imagen «{$v}» no existe."); return ''; }
        return $v;
    }

    private function fono($v, string $campo, bool $requerido): string
    {
        $v = $this->limpiar($v, 30, $campo);
        if ($v === '') { if ($requerido) $this->err($campo, 'Obligatorio.'); return ''; }
        $dig = preg_replace('/\D/', '', $v);
        if (!preg_match('/^\+?[0-9 ()-]+$/', $v) || strlen($dig) < 8 || strlen($dig) > 15) $this->err($campo, 'Teléfono inválido (ej: +56 2 2847 0610).');
        return $v;
    }

    private function correo($v, string $campo, bool $requerido): string
    {
        $v = mb_strtolower($this->limpiar($v, 120, $campo));
        if ($v === '') { if ($requerido) $this->err($campo, 'Obligatorio.'); return ''; }
        if (!filter_var($v, FILTER_VALIDATE_EMAIL)) $this->err($campo, 'Correo inválido.');
        return $v;
    }

    private function dominio($v, string $campo): string
    {
        $v = mb_strtolower($this->limpiar($v, 100, $campo));
        if ($v !== '' && !preg_match('/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/', $v)) $this->err($campo, 'Sitio web inválido (ej: www.icewell.cl).');
        return $v;
    }

    private function url($v, string $campo): string
    {
        $v = $this->limpiar($v, 300, $campo);
        if ($v === '') return '';
        // solo https: un "javascript:" o "data:" en un href sería XSS
        if (!preg_match('#^https://[^\s<>"\']+$#i', $v) || !filter_var($v, FILTER_VALIDATE_URL)) $this->err($campo, 'Debe ser una dirección https://');
        return $v;
    }

    /** RUT chileno con dígito verificador (módulo 11). */
    private function rut($v, string $campo): string
    {
        $v = $this->limpiar($v, 15, $campo);
        if ($v === '') return '';
        $limpio = strtoupper(preg_replace('/[^0-9kK]/', '', $v));
        if (strlen($limpio) < 2) { $this->err($campo, 'RUT inválido.'); return $v; }
        $cuerpo = substr($limpio, 0, -1); $dv = substr($limpio, -1);
        $suma = 0; $mul = 2;
        for ($i = strlen($cuerpo) - 1; $i >= 0; $i--) { $suma += (int)$cuerpo[$i] * $mul; $mul = $mul === 7 ? 2 : $mul + 1; }
        $res = 11 - ($suma % 11);
        $esperado = $res === 11 ? '0' : ($res === 10 ? 'K' : (string)$res);
        if ($dv !== $esperado) $this->err($campo, 'RUT con dígito verificador incorrecto.');
        return $v;
    }

    // ---------------------------------------------------------------- generación
    private static function js($v): string
    {
        // JSON_HEX_TAG: "</script>" dentro de un texto no puede cerrar un <script> si alguien lo pega en línea
        return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_THROW_ON_ERROR);
    }

    /** sitio-data.js: todo menos catálogos y obras. */
    public static function generarSitio(array $c, string $marca): string
    {
        $sitio = $c;
        unset($sitio['catalogos'], $sitio['obras']);
        return "/* GENERADO por el panel (/admin) el $marca — NO editar a mano: los cambios se pierden al publicar.\n" .
            "   Datos de la empresa, cifras, textos y secciones del sitio. Lo leen index.html, cv.html,\n" .
            "   cv-presentacion.html y los PDF (assets/sitio-render.js lo aplica al HTML). */\n" .
            "window.ICEWELL_SITIO = (window.ICEWELL_BORRADOR && window.ICEWELL_BORRADOR.sitio) || " .
            json_encode($sitio, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . ";\n";
    }

    /** cv-data.js: mismo formato de siempre (const SECTORES/REGIONES/PERIODOS/PROYECTOS), solo obras visibles. */
    public static function generarCv(array $c, string $marca): string
    {
        $lineas = function (array $lista): string {
            return "[\n" . implode(",\n", array_map(fn($x) => '  ' . self::js($x), $lista)) . "\n]";
        };
        $obras = array_values(array_filter($c['obras'], fn($o) => $o['visible'] !== false));
        $obras = array_map(function ($o) { unset($o['visible']); return $o; }, $obras);
        $b = 'window.ICEWELL_BORRADOR';
        return "/* ==========================================================================\n" .
            "   ICEWELL — Datos del currículum (GENERADO por el panel /admin el $marca)\n" .
            "   NO editar a mano: se regenera al publicar. Para cambiar una obra, usar el panel.\n\n" .
            "   Campos de cada obra: id, nombre, anio, lugar, regiones[], sectores[], uso, sistemas,\n" .
            "   m2 (número o null), foto (archivo en assets/ o null), estado ('ejecucion'|'ejecutado'),\n" .
            "   tags[], cliente ('Público'|'Privado'), y opcionales: trabajo, detalle, destacado\n" .
            "   (una de las 9 del PDF corporativo), portada/ordenPortada/portadaAncha/textoPortada\n" .
            "   (portafolio del index; exige foto), alt (texto alternativo de la foto), revisar (nota\n" .
            "   pendiente de confirmar con Icewell). Las obras ocultas en el panel no se publican.\n" .
            "   ========================================================================== */\n\n" .
            "const SECTORES = ($b && $b.sectores) || " . $lineas($c['catalogos']['sectores']) . ";\n\n" .
            "const REGIONES = ($b && $b.regiones) || " . $lineas($c['catalogos']['regiones']) . ";\n\n" .
            "const PERIODOS = ($b && $b.periodos) || " . $lineas($c['catalogos']['periodos']) . ";\n\n" .
            "const PROYECTOS = ($b && $b.proyectos) || " . $lineas($obras) . ";\n";
    }

    /** Escritura atómica: un visitante nunca lee un archivo a medio escribir. */
    public static function escribirAtomico(string $ruta, string $datos): void
    {
        $tmp = $ruta . '.tmp-' . bin2hex(random_bytes(6));
        if (file_put_contents($tmp, $datos, LOCK_EX) === false) throw new RuntimeException("No se pudo escribir $ruta");
        @chmod($tmp, 0644);
        if (!rename($tmp, $ruta)) { @unlink($tmp); throw new RuntimeException("No se pudo reemplazar $ruta"); }
    }

    /**
     * Publica: respalda los JS actuales y escribe los nuevos.
     * Devuelve la lista de archivos escritos.
     */
    public static function publicar(array $c, string $dirWeb, ?string $dirRespaldos = null): array
    {
        $assets = rtrim($dirWeb, '/') . '/assets';
        $marca = date('Y-m-d H:i');
        $archivos = [
            $assets . '/sitio-data.js' => self::generarSitio($c, $marca),
            $assets . '/cv-data.js'    => self::generarCv($c, $marca),
        ];
        if ($dirRespaldos) {
            $dest = rtrim($dirRespaldos, '/') . '/' . date('Ymd_His');
            @mkdir($dest, 0700, true);
            foreach (array_keys($archivos) as $ruta) if (is_file($ruta)) @copy($ruta, $dest . '/' . basename($ruta));
        }
        foreach ($archivos as $ruta => $datos) self::escribirAtomico($ruta, $datos);
        return array_keys($archivos);
    }
}
