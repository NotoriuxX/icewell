<?php
/* Arranque común del servidor del panel (API y consola). */
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');          // nunca mostrar errores internos al navegador
ini_set('log_errors', '1');
date_default_timezone_set('America/Santiago');
mb_internal_encoding('UTF-8');

foreach (['Config', 'Bd', 'Http', 'Cripto', 'Limites', 'Tokens', 'Auditoria', 'Sesion', 'Totp', 'Google', 'Correo', 'Auth', 'Contenido', 'Imagenes', 'PdfAssets', 'Panel', 'Solicitudes'] as $c) {
    require_once __DIR__ . '/lib/' . $c . '.php';
}
Config::cargar();
