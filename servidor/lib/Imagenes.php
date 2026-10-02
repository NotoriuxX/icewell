<?php
/* Subida de imágenes desde el panel.
   Defensa en capas (una foto subida es la puerta típica para colar código):
   - solo JPG, PNG o WebP (nada de SVG: puede llevar JavaScript), hasta 8 MB;
   - el tipo real se mira en los bytes (finfo + getimagesize), no en el nombre;
   - la imagen se VUELVE A CODIFICAR con GD: el archivo guardado lo escribe el
     servidor, así se pierden EXIF (GPS del teléfono) y cualquier contenido escondido;
   - nombre aleatorio elegido por el servidor, en assets/obras/ (sin PHP: .htaccess);
   - límite de subidas por usuario y hora. */
declare(strict_types=1);

final class Imagenes
{
    const MAX_BYTES = 8 * 1024 * 1024;
    const MAX_PIXELES = 40000000;   // 40 MP: evita "bombas" de descompresión
    const TIPOS = [
        // tipo => [lado máximo, salida]
        'obra'   => [2000, 'jpg'],
        'hero'   => [2400, 'jpg'],
        'equipo' => [800, 'jpg'],
        'socio'  => [600, 'png'],    // logos: se conserva la transparencia
    ];

    public static function guardar(array $d, int $usuarioId): array
    {
        Limites::exigir('subida_usuario', (string)$usuarioId);
        Limites::registrar('subida_usuario', (string)$usuarioId);
        $tipo = (string)($d['tipo'] ?? '');
        if (!isset(self::TIPOS[$tipo])) throw new ErrorHttp(422, 'Tipo de imagen desconocido.');
        $datos = (string)($d['datos'] ?? '');
        if (!preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$#', $datos, $m)) throw new ErrorHttp(422, 'Solo se aceptan fotos JPG, PNG o WebP.');
        $bin = base64_decode($m[2], true);
        if ($bin === false || $bin === '') throw new ErrorHttp(422, 'El archivo llegó dañado.');
        if (strlen($bin) > self::MAX_BYTES) throw new ErrorHttp(413, 'La imagen pesa más de 8 MB. Achícala un poco e inténtalo de nuevo.');

        $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($bin);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) throw new ErrorHttp(422, 'El archivo no es una imagen JPG, PNG o WebP.');
        $info = @getimagesizefromstring($bin);
        if (!$info || $info[0] < 1 || $info[1] < 1) throw new ErrorHttp(422, 'No se pudo leer la imagen.');
        if ($info[0] * $info[1] > self::MAX_PIXELES) throw new ErrorHttp(422, 'La imagen es demasiado grande (más de 40 megapíxeles).');
        if ($tipo !== 'socio' && min($info[0], $info[1]) < 400) throw new ErrorHttp(422, 'La foto es muy chica: necesita al menos 400 px por lado para verse bien.');

        $im = @imagecreatefromstring($bin);
        if (!$im) throw new ErrorHttp(422, 'No se pudo leer la imagen.');
        if ($mime === 'image/jpeg') $im = self::orientar($im, $bin);
        [$max, $ext] = self::TIPOS[$tipo];
        $im = self::escalar($im, $max, $ext === 'png');

        $dir = rtrim((string)Config::get('dir_web'), '/') . '/assets/obras';
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        $base = self::slug((string)($d['nombre'] ?? $tipo)) ?: $tipo;
        $archivo = $base . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
        $ruta = $dir . '/' . $archivo;
        $ok = $ext === 'png' ? imagepng($im, $ruta, 8) : imagejpeg($im, $ruta, 84);
        if (!$ok) throw new ErrorHttp(500, 'No se pudo guardar la imagen.');
        @chmod($ruta, 0644);
        Auditoria::registrar($usuarioId, 'imagen.subida', "obras/$archivo");
        return ['ok' => true, 'archivo' => 'obras/' . $archivo, 'ancho' => imagesx($im), 'alto' => imagesy($im)];
    }

    private static function escalar($im, int $max, bool $alfa)
    {
        $w = imagesx($im); $h = imagesy($im);
        $f = min(1, $max / max($w, $h));
        $nw = max(1, (int)round($w * $f)); $nh = max(1, (int)round($h * $f));
        $dst = imagecreatetruecolor($nw, $nh);
        if ($alfa) { imagealphablending($dst, false); imagesavealpha($dst, true); imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 0, 0, 0, 127)); }
        else imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        imagecopyresampled($dst, $im, 0, 0, 0, 0, $nw, $nh, $w, $h);
        return $dst;
    }

    /** Fotos de teléfono: aplica la rotación EXIF antes de que se pierda al re-codificar. */
    private static function orientar($im, string $bin)
    {
        if (!function_exists('exif_read_data')) return $im;
        $exif = @exif_read_data('data://image/jpeg;base64,' . base64_encode($bin));
        $o = (int)($exif['Orientation'] ?? 1);
        return match ($o) { 3 => imagerotate($im, 180, 0), 6 => imagerotate($im, -90, 0), 8 => imagerotate($im, 90, 0), default => $im };
    }

    private static function slug(string $t): string
    {
        $t = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $t) ?: '';
        return substr(trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($t)), '-'), 0, 40);
    }
}
