<?php
// Puerta de entrada de la API del panel. El código vive FUERA de la carpeta pública:
// en el hosting, servidor/ va al lado de public_html (ver README → Publicar el panel).
declare(strict_types=1);
require dirname(__DIR__, 2) . '/servidor/api.php';
