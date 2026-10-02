<?php
// Puerta de entrada de la API del panel. El código vive FUERA de la carpeta pública:
// en el hosting, servidor/ va al lado de public_html (ver README → Publicar el panel).
// Si el hosting no lo permite y servidor/ quedó dentro de public_html, también se encuentra
// (protegido por su .htaccess "Require all denied").
declare(strict_types=1);
foreach ([dirname(__DIR__, 2) . '/servidor/api.php', dirname(__DIR__) . '/servidor/api.php'] as $api) {
    if (is_file($api)) { require $api; exit; }
}
http_response_code(500);
header('Content-Type: application/json; charset=utf-8');
echo '{"ok":false,"error":"No se encontró la carpeta servidor/ del panel."}';
