# Icewell en Docker: correr local y publicar en el servidor nuevo

Este archivo tiene dos partes:
1. **Guía**: qué hay y cómo se usa.
2. **Prompt para Claude**: copiar y pegar en la sesión de Claude que tenga acceso al servidor nuevo cuando esté habilitado. Contiene todo lo que tiene que hacer.

---

## 1. Guía

### Qué levanta
`docker-compose.yml` levanta 3 servicios:

| Servicio | Qué es | Persistencia |
|---|---|---|
| `web` | PHP 8.3 + Apache con el sitio (`web/`) y el panel (`servidor/` fuera del DocumentRoot) | volúmenes `icewell_obras` (fotos subidas) e `icewell_datos` (respaldos y caché) |
| `db` | MariaDB 11 (usuarios, versiones del contenido, auditoría) | volumen `icewell_bd` |
| `caddy` | Proxy HTTPS con certificado automático de Let's Encrypt. Solo con `--profile https` | volúmenes `caddy_datos` y `caddy_config` |

- Al arrancar, `web` crea o actualiza las tablas y **re-publica la última versión publicada**. Los JS del sitio salen de la BD, así que reconstruir o actualizar la imagen nunca muestra contenido viejo.
- La configuración va en `.env` (ver `.env.ejemplo`), nunca dentro de la imagen. En producción, si faltan los secretos, el contenedor no arranca.
- La seguridad es la misma del hosting compartido: los mismos `.htaccess` y la misma API. Las pruebas (`php herramientas/tests/test_api.php`) cubren también la config por variables y el proxy.

### En tu PC (desarrollo)
Requiere Docker Desktop.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- Sitio: http://localhost:8080
- Panel: http://localhost:8080/admin/ → «Entrar como desarrollador»
- Correos de prueba: http://localhost:8080/admin/bandeja
- Currículum: http://localhost:8080/curriculum · Presentación: http://localhost:8080/presentacion (direcciones limpias, ver `web/.htaccess`)

No necesita `.env`. El código está montado: los cambios en `web/` y `servidor/` se ven al recargar.
Publicar desde el panel en desarrollo **escribe los JS del repo** (`web/assets/sitio-data.js`, `cv-data.js`, `vendor/cv-pdf-assets.js`), igual que con `php -S`. Después se hace commit si corresponde.
Para apagar: `Ctrl+C`, o `docker compose -f docker-compose.yml -f docker-compose.dev.yml down`. Con `down -v` se borra también la BD de prueba.

### Vista previa pública desde tu PC (túnel, solo el sitio)
Para ver el sitio en el celular o mandárselo a alguien sin servidor: `powershell -File herramientas/tunel.ps1` imprime un link `https://….trycloudflare.com` (Cloudflare Quick Tunnel, gratis, sin cuenta). Se suma `docker-compose.tunel.yml` (Caddy + cloudflared en la red de Docker).
- **Solo sale el sitio.** `/admin`, `/api` y `/servidor` responden 404 por el túnel (`docker/Caddyfile.tunel`), porque el Docker de desarrollo tiene «Entrar como desarrollador» para cualquier IP. El formulario de contacto cae a su respaldo por correo/WhatsApp.
- El link cambia cada vez y muere al apagar el túnel o la PC: `powershell -File herramientas/tunel.ps1 -Apagar` (el sitio local sigue).
- Para algo fijo 24/7 hace falta un servidor (esta guía, parte «En el servidor»). Los créditos de **Docker Sandboxes** (promoción de 250 USD) no sirven para eso: son microVMs para agentes, no hosting web.

### En el servidor (producción)
Ver el prompt de abajo: es la lista completa de pasos.

### Comandos útiles (en el servidor, dentro de la carpeta del proyecto)
```bash
docker compose ps                                   # estado
docker compose logs -f web                          # registro del sitio
docker compose exec -e ICEWELL_CLAVE='…' web su -s /bin/sh www-data -c 'php herramientas/admin-cli.php crear-admin correo@icewell.cl "Nombre"'
docker compose exec web su -s /bin/sh www-data -c 'php herramientas/admin-cli.php listar'
docker compose exec db sh -c 'mariadb-dump -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"' > respaldo-$(date +%F).sql
git pull && docker compose --profile https up -d --build   # actualizar
```

---

## 2. Prompt para Claude (copiar desde aquí)

```text
Eres el encargado de publicar el sitio de Icewell en el servidor nuevo usando Docker.
Repositorio: github.com/NotoriuxX/icewell (rama a usar: la que te indique Manuel; el trabajo de Docker está en
claude/gracious-johnson-vtzpf1 o en main si ya se fusionó). Idioma: español. Antes de empezar, lee CLAUDE.md,
README.md (sección "Panel de administración") y DESPLIEGUE-DOCKER.md.

QUÉ ES
- Sitio estático (index.html, cv.html, cv-presentacion.html) + panel de administración en /admin con login
  (correo @icewell.cl, Google opcional, recuperación por correo, 2FA), hecho en PHP 8.3 + MariaDB.
- Todo ya funciona en Docker: Dockerfile, docker-compose.yml (web + db + caddy con perfil "https"),
  docker/entrypoint.sh, .env.ejemplo. Probado: producción sin botón de desarrollador, cookie __Host- Secure,
  re-publicación al recrear el contenedor, 98 pruebas de seguridad en herramientas/tests/test_api.php.
- NO cambies la lógica de seguridad. Si algo no funciona en el servidor, arréglalo en la configuración de
  Docker/servidor, y si tocas código PHP, agrega el caso a test_api.php y córrelo.

ANTES DE TOCAR NADA, PÍDELE A MANUEL (no inventes estos valores):
1. Dominio definitivo (www.icewell.cl o icewell.net) y confirmación de que el DNS (registro A/AAAA) ya apunta
   a la IP del servidor.
2. Correo del primer administrador (debe ser @icewell.cl).
3. Datos SMTP para los correos del panel: cuenta (p.ej. no-responder@icewell.cl) y su "contraseña de
   aplicación" de Google Workspace (requiere 2 pasos activado en esa cuenta). Si aún no la tiene, se puede
   publicar sin SMTP, pero la recuperación de contraseña no enviará correos hasta configurarlo.
4. (Opcional) ID de cliente OAuth de Google para "Entrar con Google": Google Cloud Console → Credenciales →
   ID de cliente OAuth "Aplicación web", origen autorizado = https://<dominio>.
5. Si el servidor ya tiene otro proxy/web server usando los puertos 80/443 (nginx, Apache, Traefik, otro
   Caddy). En ese caso NO uses el perfil "https": publica el servicio web en un puerto local
   (p.ej. 127.0.0.1:8081:80), configura ese proxy para que reenvíe al puerto y ponga X-Forwarded-Proto
   y X-Forwarded-For, y agrega su IP o rango a ICEWELL_PROXIES_CONFIABLES.

PASOS EN EL SERVIDOR
1. Verifica Docker y Compose v2: `docker --version && docker compose version`. Si faltan, instálalos
   (Docker Engine oficial). Firewall: abrir solo 22, 80 y 443.
2. Clona el repo en /opt/icewell (o donde indique Manuel) y entra a la carpeta.
3. Crea .env desde .env.ejemplo:
   - ICEWELL_ENTORNO=produccion
   - ICEWELL_URL_BASE=https://<dominio> (sin barra final) e ICEWELL_DOMINIO=<dominio>
   - ICEWELL_PEPPER y ICEWELL_CLAVE_CIFRADO: cada uno con `openssl rand -hex 32`. Guárdalos también en un
     gestor de contraseñas de Manuel: si se pierden, se pierden todas las contraseñas y los 2FA.
     NUNCA los cambies después.
   - ICEWELL_BD_CLAVE: `openssl rand -hex 16`
   - ICEWELL_ADMIN_INICIAL=<correo del admin>
   - SMTP y GOOGLE_CLIENT_ID según lo que entregó Manuel
   - `chmod 600 .env`. Nunca lo subas a git ni lo pegues en el chat.
4. Levanta: `docker compose --profile https up -d --build`
5. Verifica:
   - `docker compose ps`: web y db "healthy", caddy "Up".
   - `docker compose logs web | grep icewell`: debe decir "Base de datos lista".
   - `curl -sI https://<dominio>/` → 200 con Strict-Transport-Security.
   - `curl -sI http://<dominio>/` → redirección a https.
   - `curl -s https://<dominio>/api/?r=config` → "local":false y "desarrollador":false. OBLIGATORIO: si dice
     true, detente y revisa ICEWELL_ENTORNO.
   - `curl -sI https://<dominio>/admin/` → cabecera Content-Security-Policy.
   - `curl -s -o /dev/null -w "%{http_code}" https://<dominio>/servidor/config.ejemplo.php` → 404.
6. Primer acceso: Manuel entra a https://<dominio>/admin/#registro con el correo de ICEWELL_ADMIN_INICIAL,
   confirma con el enlace que le llega por correo y queda como administrador. Sin SMTP todavía: crea el
   admin por consola con
   `docker compose exec -e ICEWELL_CLAVE='<clave que elija Manuel>' web su -s /bin/sh www-data -c 'php herramientas/admin-cli.php crear-admin <correo> "<Nombre>"'`
   y pídele que la cambie en "Mi cuenta".
   Después: pon ICEWELL_ADMIN_INICIAL vacío en .env y `docker compose up -d`.
7. Recomiéndale a Manuel, en el panel:
   - activar la verificación en dos pasos (Mi cuenta);
   - en "Empresa y contacto → Aniversario", apagar el botón de vista previa y poner la fecha real de fundación;
   - publicar una vez para confirmar que todo se escribe bien.
8. Respaldos: crea un cron diario en el servidor que guarde
   - `docker compose exec -T db sh -c 'mariadb-dump -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"'` (comprimido con gzip);
   - el volumen de fotos (`docker run --rm -v icewell_icewell_obras:/d -v /opt/respaldos:/r alpine tar czf /r/obras-$(date +%F).tgz -C /d .`).

   Conserva 14 días. Prueba a restaurar una vez en un contenedor aparte.
9. Actualizaciones futuras: `git pull && docker compose --profile https up -d --build`. La BD, las fotos y
   el contenido publicado se conservan (volúmenes + re-publicación al arrancar).

SI ALGO FALLA
- "Producción: falta ICEWELL_…" en los logs de web → completar .env.
- La BD no responde → `docker compose logs db`. Si cambiaste ICEWELL_BD_CLAVE después del primer arranque,
  MariaDB conserva la clave vieja: vuelve a la anterior o cámbiala dentro de MariaDB.
- Caddy no obtiene el certificado → el DNS aún no apunta al servidor o el puerto 80/443 está ocupado/cerrado.
- Bucle de redirecciones → falta que el proxy mande X-Forwarded-Proto o su IP no está en
  ICEWELL_PROXIES_CONFIABLES.
- Los correos no llegan → revisa el SMTP (la clave de Google Workspace debe ser una "contraseña de aplicación")
  y el registro de actividad del panel (Usuarios → Registro de actividad, acción "correo error").
- Publicar falla con "No se pudo escribir" → permisos de web/assets dentro del contenedor:
  `docker compose exec web ls -l web/assets`. Deben ser de www-data, como en el Dockerfile.

AL TERMINAR, dile a Manuel en pocas líneas:
- la URL del sitio y del panel;
- cómo entrar;
- dónde quedan los respaldos;
- qué falta (SMTP, Google, fecha de fundación), si algo faltó.
```
