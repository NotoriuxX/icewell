<?php
/* Regenera web/assets/vendor/cv-pdf-assets.js al publicar (fotos nuevas al PDF).
   Mismo resultado que herramientas/build_pdf_assets.py (que necesita Python y
   Pillow, que un hosting compartido no tiene): recorte centrado 3:2 a 720×480,
   JPEG calidad 72, en data URL. Las fuentes, el logo y las fotos que ya estaban
   se reutilizan del archivo actual: solo se procesan las fotos nuevas. */
declare(strict_types=1);

final class PdfAssets
{
    const FUENTES = [
        'BigShoulders-Black' => 'BigShouldersDisplay-Black.ttf',
        'BigShoulders-Bold'  => 'BigShouldersDisplay-Bold.ttf',
        'PlexMono'           => 'IBMPlexMono-Medium.ttf',
        'PlexSans'           => 'IBMPlexSans-Regular.ttf',
        'PlexSans-SemiBold'  => 'IBMPlexSans-SemiBold.ttf',
        'PlexSans-Bold'      => 'IBMPlexSans-Bold.ttf',
    ];
    const ANCHO = 720, ALTO = 480, CALIDAD = 72;
    const PREFIJO = 'window.CV_PDF_ASSETS = ';

    /** @return array{fotos:int,nuevas:int,faltan:string[]} */
    public static function regenerar(array $contenido, string $dirWeb): array
    {
        $assets = rtrim($dirWeb, '/') . '/assets';
        $ruta = $assets . '/vendor/cv-pdf-assets.js';
        $actual = self::leer($ruta);
        $out = ['fuentes' => $actual['fuentes'] ?? [], 'fotos' => [], 'logo' => $actual['logo'] ?? null];
        foreach (self::FUENTES as $n => $f) {
            if (empty($out['fuentes'][$n])) $out['fuentes'][$n] = base64_encode((string)file_get_contents($assets . '/fonts/' . $f));
        }
        if (!$out['logo']) $out['logo'] = 'data:image/png;base64,' . base64_encode((string)file_get_contents($assets . '/icewell-logo.png'));

        $fotos = [];
        foreach ($contenido['obras'] as $o) if (!empty($o['foto']) && ($o['visible'] ?? true)) $fotos[$o['foto']] = true;
        $fotos = array_keys($fotos);
        sort($fotos);
        $nuevas = 0; $faltan = [];
        foreach ($fotos as $f) {
            if (!empty($actual['fotos'][$f])) { $out['fotos'][$f] = $actual['fotos'][$f]; continue; }
            $dataUrl = self::recortar($assets . '/' . $f);
            if ($dataUrl === null) { $faltan[] = $f; continue; }
            $out['fotos'][$f] = $dataUrl;
            $nuevas++;
        }
        $js = "/* GENERADO por el panel (servidor/lib/PdfAssets.php) o por herramientas/build_pdf_assets.py — no editar a mano */\n"
            . self::PREFIJO . json_encode($out, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . ";\n";
        Contenido::escribirAtomico($ruta, $js);
        return ['fotos' => count($out['fotos']), 'nuevas' => $nuevas, 'faltan' => $faltan];
    }

    private static function leer(string $ruta): array
    {
        if (!is_file($ruta)) return [];
        $s = (string)file_get_contents($ruta);
        $i = strpos($s, self::PREFIJO);
        if ($i === false) return [];
        $json = rtrim(substr($s, $i + strlen(self::PREFIJO)), "; \n\r\t");
        $d = json_decode($json, true);
        return is_array($d) ? $d : [];
    }

    /** object-fit: cover a 3:2 y JPEG liviano. */
    public static function recortar(string $archivo): ?string
    {
        if (!is_file($archivo)) return null;
        $im = @imagecreatefromstring((string)file_get_contents($archivo));
        if (!$im) return null;
        $w = imagesx($im); $h = imagesy($im);
        $obj = self::ANCHO / self::ALTO;
        if ($w / $h > $obj) { $nw = (int)round($h * $obj); $sx = intdiv($w - $nw, 2); $sy = 0; $sw = $nw; $sh = $h; }
        else { $nh = (int)round($w / $obj); $sx = 0; $sy = intdiv($h - $nh, 2); $sw = $w; $sh = $nh; }
        $dst = imagecreatetruecolor(self::ANCHO, self::ALTO);
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));   // PNG con transparencia → fondo blanco
        imagecopyresampled($dst, $im, 0, 0, $sx, $sy, self::ANCHO, self::ALTO, $sw, $sh);
        ob_start();
        imagejpeg($dst, null, self::CALIDAD);
        $bin = (string)ob_get_clean();
        return 'data:image/jpeg;base64,' . base64_encode($bin);
    }
}
