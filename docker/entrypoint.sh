#!/bin/sh
# ==========================================================================
# ICEWELL — arranque del contenedor
#  1. revisa la configuración (en producción: secretos obligatorios)
#  2. espera la base de datos y crea/actualiza las tablas
#  3. re-publica la última versión publicada (los JS del sitio salen de la BD,
#     así un contenedor nuevo nunca muestra contenido viejo)
#  4. arranca Apache
# ==========================================================================
set -e
cd /var/www/icewell

if [ "${ICEWELL_ENTORNO:-}" = "" ]; then
  echo "[icewell] Falta ICEWELL_ENTORNO (local | produccion). Ver .env.ejemplo." >&2; exit 1
fi
if [ "$ICEWELL_ENTORNO" != "local" ]; then
  for v in ICEWELL_URL_BASE ICEWELL_PEPPER ICEWELL_CLAVE_CIFRADO ICEWELL_BD_CLAVE; do
    eval val=\${$v:-}; eval f=\${${v}_FILE:-}
    if [ -z "$val" ] && [ -z "$f" ]; then echo "[icewell] Producción: falta $v (ver .env.ejemplo)." >&2; exit 1; fi
  done
fi

# los volúmenes nuevos llegan vacíos y con dueño root
mkdir -p servidor/datos web/assets/obras
chown -R www-data:www-data servidor/datos web/assets/obras
[ -f web/assets/obras/.htaccess ] || cp /var/www/icewell/docker-obras.htaccess web/assets/obras/.htaccess 2>/dev/null || true

# Desarrollo (código montado desde la PC): Apache debe poder escribir lo que publica el panel.
# Si web/ pertenece a un usuario de la PC (Linux/Mac), Apache pasa a usar ese mismo UID;
# si pertenece a root (típico en algunos montajes), se da permiso de escritura a esos pocos archivos.
if [ "$ICEWELL_ENTORNO" = "local" ]; then
  uid=$(stat -c %u web)
  if [ "$uid" != "0" ] && [ "$uid" != "$(id -u www-data)" ]; then
    usermod -o -u "$uid" www-data 2>/dev/null && echo "[icewell] Apache usa el UID $uid (dueño del código montado)."
    chown -R www-data servidor/datos web/assets/obras
  fi
  if ! su -s /bin/sh www-data -c "test -w web/assets && test -w web/assets/vendor"; then
    chmod o+w web/assets web/assets/vendor web/assets/sitio-data.js web/assets/cv-data.js web/assets/vendor/cv-pdf-assets.js 2>/dev/null \
      && echo "[icewell] Permiso de escritura (solo desarrollo) en los JS que genera el panel."
  fi
fi

# esperar la BD (MariaDB tarda unos segundos la primera vez)
i=0
until su -s /bin/sh www-data -c "php herramientas/admin-cli.php migrar" >/tmp/migrar.log 2>&1; do
  i=$((i+1))
  if [ $i -ge 30 ]; then echo "[icewell] La base de datos no responde:" >&2; cat /tmp/migrar.log >&2; exit 1; fi
  sleep 2
done
echo "[icewell] Base de datos lista."
su -s /bin/sh www-data -c "php herramientas/admin-cli.php republicar" || echo "[icewell] (republicar: se dejan los JS de la imagen)"

exec docker-php-entrypoint "$@"
