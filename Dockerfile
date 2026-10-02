# ==========================================================================
# ICEWELL — Sitio + panel (/admin) en un contenedor: PHP 8.3 + Apache
# Mismos .htaccess que el hosting compartido (una sola configuración de seguridad).
#   web/       → DocumentRoot (lo público)
#   servidor/  → FUERA del DocumentRoot (PHP del panel)
# La configuración llega por variables ICEWELL_* (ver .env.ejemplo), nunca dentro de la imagen.
# ==========================================================================
FROM php:8.3-apache

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends libjpeg62-turbo-dev libpng-dev libwebp-dev libfreetype6-dev libsqlite3-dev curl; \
    docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype; \
    docker-php-ext-install -j"$(nproc)" gd exif pdo_mysql pdo_sqlite; \
    apt-get purge -y --auto-remove libjpeg62-turbo-dev libpng-dev libwebp-dev libfreetype6-dev libsqlite3-dev; \
    apt-get install -y --no-install-recommends libjpeg62-turbo libpng16-16 libwebp7 libfreetype6 libsqlite3-0; \
    rm -rf /var/lib/apt/lists/*; \
    a2enmod rewrite headers; \
    a2dissite 000-default; \
    mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY docker/php.ini "$PHP_INI_DIR/conf.d/zz-icewell.ini"
COPY docker/apache-icewell.conf /etc/apache2/sites-available/icewell.conf
RUN a2ensite icewell \
 && sed -ri 's/^ServerTokens .*/ServerTokens Prod/; s/^ServerSignature .*/ServerSignature Off/' /etc/apache2/conf-available/security.conf

WORKDIR /var/www/icewell
COPY web/ web/
COPY servidor/ servidor/
COPY herramientas/admin-cli.php herramientas/semilla.js herramientas/
COPY docker/entrypoint.sh /usr/local/bin/icewell-entrypoint
# copia de las reglas de la carpeta de fotos: el volumen de fotos la tapa y el arranque la repone
COPY web/assets/obras/.htaccess /var/www/icewell/docker-obras.htaccess
RUN chmod +x /usr/local/bin/icewell-entrypoint \
 && rm -f servidor/config.php \
 && mkdir -p servidor/datos web/assets/obras \
 # el usuario de Apache solo escribe lo que el panel publica
 && chown -R www-data:www-data servidor/datos web/assets/obras \
 && chown www-data:www-data web/assets web/assets/vendor web/assets/sitio-data.js web/assets/cv-data.js web/assets/vendor/cv-pdf-assets.js

ENV ICEWELL_SIN_HTTPS=0
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS -H 'X-Forwarded-Proto: https' http://127.0.0.1/api/?r=config >/dev/null || exit 1
ENTRYPOINT ["icewell-entrypoint"]
CMD ["apache2-foreground"]
