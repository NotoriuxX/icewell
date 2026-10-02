<?php
/* Cabeceras de seguridad de las páginas del panel (/admin/*.html).
   En el hosting las pone web/admin/.htaccess (mismos valores); en local, el router
   herramientas/servidor-local.php. Si se cambia una, cambiar las dos. */
declare(strict_types=1);

final class Cabeceras
{
    // Sin 'unsafe-inline' en scripts: el panel no tiene JavaScript en línea, así un texto
    // inyectado no puede ejecutarse. Google solo para el botón "Entrar con Google".
    const CSP = "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; "
        . "style-src 'self' https://accounts.google.com/gsi/style; img-src 'self' data: blob: https://*.googleusercontent.com; "
        . "font-src 'self'; connect-src 'self' https://accounts.google.com/gsi/; frame-src 'self' https://accounts.google.com/gsi/; "
        . "frame-ancestors 'self'; base-uri 'none'; form-action 'self'; object-src 'none'";

    public static function panel(): void
    {
        header('Content-Security-Policy: ' . self::CSP);
        header('Referrer-Policy: no-referrer');                   // los enlaces de recuperación llevan el token en la URL
        header('Cross-Origin-Opener-Policy: same-origin-allow-popups');   // ventana de Google
        header('Cache-Control: no-store');
        header('X-Robots-Tag: noindex, nofollow');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    }
}
