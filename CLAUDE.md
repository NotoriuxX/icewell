# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Proyecto Icewell: sitio modernizado de icewell.net (hoy en Wix) + currículum interactivo, en HTML/CSS/JS plano, sin build ni framework. Contexto completo, decisiones y pendientes: `README.md` (leer primero). Skill con el resumen operativo: `/icewell`. Idioma del proyecto y del usuario: español.

## Comandos

Todas las rutas son relativas a la raíz del proyecto (`Desktop/icewell/proyecto/`).

```bash
# Servir el sitio + el panel (modo local: SQLite, correos a /admin/bandeja, "Entrar como desarrollador")
php -S 127.0.0.1:8765 -t web herramientas/servidor-local.php   # → / | /curriculum | /presentacion | /admin/
# Docker (sitio + panel + MariaDB): PC → http://localhost:8080 ; servidor → ver DESPLIEGUE-DOCKER.md
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
# Solo el sitio estático, sin panel. Ojo: no traduce /curriculum (sí el doble clic: transicion.js lleva al .html en file://)
python -m http.server 8765 --directory web

# Pruebas (jsdom, corren el JS real de las páginas). Instalar una vez:
npm install --prefix herramientas/tests
npm test --prefix herramientas/tests             # las 3 suites encadenadas con && (se corta en la primera que falla)
node herramientas/tests/test_icewell.js          # una sola: index + aniversario (+ botón de vista previa) + filtros/hash de cv.html
node herramientas/tests/test_web_ux.js           # tarjetas Público/Privado, filtro = todas tarjeta, barra fija, recuento
node herramientas/tests/test_pdf.js              # genera PDFs reales de cv.html (modo 'dibujo') → herramientas/tests/salida/
node herramientas/tests/test_sitio.js            # sitio-data.js → index/cv/presentación/PDF, XSS, portada desde datos
php herramientas/tests/test_api.php              # servidor del panel: auth, CSRF, límites, tokens, Google, 2FA, subidas (copia temporal)
php herramientas/tests/test_rutas.php            # direcciones limpias: alias, 301 desde los .html viejos, 404 propio (levanta php -S)

# Panel por consola
php herramientas/admin-cli.php crear-admin correo@icewell.cl "Nombre"   # (listar | aprobar | bloquear | resetear-clave | migrar)
php herramientas/admin-cli.php publicar-semilla  # regenera sitio-data.js + cv-data.js desde servidor/semilla.json
node herramientas/semilla.js                     # reimporta un cv-data.js editado a mano → servidor/semilla.json

# Regenerar fuentes/fotos embebidas del PDF (el panel lo hace solo al Publicar; esto es sin panel)
python herramientas/build_pdf_assets.py          # → web/assets/vendor/cv-pdf-assets.js
```

Lo que jsdom **no** puede validar (ni test_api.php) (no tiene layout ni canvas): la paginación por medición de `cv-presentacion.html`, las hojas A4 del modo 'foto' y las animaciones. Eso se verifica en Chrome real: con la extensión claude-in-chrome contra el servidor local, o con `msedge --headless=new --print-to-pdf=... URL` + render con PyMuPDF. En una pestaña oculta el scroll suave y las animaciones CSS/rAF no corren, así que no son bug.

## Arquitectura

### Páginas (`web/`)
**Direcciones limpias** (sin `.html`): `/` = `index.html`, `/curriculum` = `cv.html`, `/presentacion` = `cv-presentacion.html`, `/admin/<x>` = `admin/<x>.html`. Los archivos conservan su nombre; la tabla vive en `web/.htaccess` (hosting y Docker) **y** en `herramientas/servidor-local.php` (cambiar las dos; `test_rutas.php` lo revisa). Las direcciones viejas `.html` redirigen con 301 (conservando `?query`; el `#hash` lo conserva el navegador). Cualquier otra → `web/404.html`. En links y JS se escribe siempre la dirección limpia y relativa (`curriculum#sector=…`, `presentacion`, `./`).
- `index.html`: sitio principal (hero, servicios, portafolio, equipo, socios, contacto). Enlaza al CV. Formulario «Cuéntanos tu proyecto» = `assets/contacto-form.js` → `api/?r=contacto` (`servidor/lib/Solicitudes.php`: valida, anti-spam, guarda en `solicitudes` y avisa SOLO al correo de la empresa) → pestaña Solicitudes del panel. Menú con la sección actual marcada (IntersectionObserver).
- `cv.html`: **versión web** del CV, con el estilo del sitio (Big Shoulders + IBM Plex).
- `cv-presentacion.html` + `assets/cv-presentacion.js`: **versión presentación**, idéntica en estética a `Icewell-Presentacion-Corporativa.pdf` (Archivo + Inter, medidas en mm tomadas del PDF). La página es una pila de hojas A4.

Las dos versiones del CV comparten los datos, el formato del hash de filtros (`#sector=a,b&periodo=…&region=…&q=…`) y un selector "Versión web / Versión presentación" que conserva el filtro. **Regla del usuario: toda mejora de experiencia en una versión se porta a la otra** (ver `/icewell` § Paridad entre versiones).

### Panel (`web/admin/` + `servidor/`)
- **Fuente de verdad = BD del panel** (versiones del contenido JSON). `servidor/semilla.json` es el contenido inicial. **Publicar** escribe `assets/sitio-data.js` y `assets/cv-data.js` (`servidor/lib/Contenido.php`: validación de TODO lo que llega + generación) y regenera `vendor/cv-pdf-assets.js` (`PdfAssets.php`). **No editar esos 2 JS a mano**: se pisan al publicar (para cambios a mano: editar, `node herramientas/semilla.js`, `php herramientas/admin-cli.php publicar-semilla`).
- API: `web/api/index.php?r=<ruta>` → `servidor/api.php`. Todo POST exige `X-Requested-With: icewell` + Origin propio + JSON; con sesión, `X-CSRF-Token`. Clases en `servidor/lib/` (Auth, Sesion, Tokens, Limites, Google, Totp, Correo, Cripto, Imagenes, Panel, Auditoria). Config: `servidor/config.php` (hosting compartido; no va a git), o variables `ICEWELL_*` (Docker, `.env.ejemplo`); sin ninguna → modo local solo en `php -S`/CLI. Detrás de proxy: `proxies_confiables` (IPs/CIDR) decide si se cree `X-Forwarded-Proto/For`.
- Editor: `editor.js` (núcleo, guardar/publicar, deshacer, copia local), `editor-campos.js` (campos enlazados al borrador, siempre `textContent`), `editor-secciones.js`, `editor-obras.js`, `editor-cuenta.js`, `editor-vista.js` (iframe `?borrador=1` + `assets/borrador.js` lee `parent.icewellBorrador()`). Sin JS en línea: CSP `script-src 'self'` (`servidor/lib/Cabeceras.php` en local = `web/admin/.htaccess` en el hosting; cambiar los dos).
- `assets/sitio-render.js` aplica `ICEWELL_SITIO` al HTML: `data-t` (textos con formato `*énfasis*`, `**negrita**`, `{anios}`…), `data-empresa`, `data-wa`, `data-cifra`, `data-mapa` (enlace a Google Maps «cómo llegar» con la dirección del panel), `data-img`, `data-lista` (servicios, sectores, metodo, hitos, portada, equipo, socios, cv-servicios, cv-cert), `data-edit` (para el clic → campo). Los PDF y la presentación usan `icewellSitio.plano/html/empresa/campoEmpresa`. Cargar en orden: `borrador.js`, `sitio-data.js`, `aniversario.js`, `cv-data.js`, `sitio-render.js`.

### Datos: `assets/cv-data.js` (generado por el panel)
`SECTORES`, `REGIONES`, `PERIODOS` y `PROYECTOS` (68 obras). Campos clave de cada obra:
- `sectores[]`, `regiones[]`: ids de los catálogos;
- `m2`, `foto` (archivo en `assets/`);
- `estado`: 'ejecucion' | 'ejecutado';
- `cliente`: 'Público' | 'Privado'. Es la etiqueta de las tarjetas;
- `trabajo`, `detalle`: del CV original de Wix;
- `destacado: true`: las 9 del PDF corporativo; la vista sin filtro de la presentación depende de esto;
- `id` (estable, va en el panel), `portada`/`ordenPortada`/`portadaAncha`/`textoPortada` (portafolio del index; **exige foto**), `alt`, `revisar` (nota pendiente, antes `// revisar`).

**Regla de obras (Manuel, 02-oct)**: tarjeta = obra **con foto**; "Trayectoria" lista **todas** (con y sin foto). Igual en cv.html, presentación y ambos PDF.

Las cifras institucionales (51 obras, +170.000 m², 12 regiones) se escriben en el panel (`ICEWELL_SITIO.cifras`) y no se calculan.

### Años automáticos: `assets/aniversario.js`
`ICEWELL_FUNDACION` (= `ICEWELL_SITIO.config.fundacion`, placeholder `2009-01-01`, se edita en el panel) → `window.icewellAniversario.anios`. Rellena `[data-anios]`/`[data-desde]` y activa el tema aniversario durante un mes. Botón flotante **"Vista previa · Aniversario · N años"** abajo al centro en las 3 páginas (`MOSTRAR_BOTON` = `config.botonAniversario` del panel; apagarlo al publicar; `?preview=0` lo oculta en una visita). Parámetros: `?hoy=aaaa-mm-dd`, `?aniversario=1` (queda en la URL al activar el botón, así el link se comparte ya activado). **Orden de carga:** hay que llamar `icewellAniversario.rellenar()` antes de que el contador animado del index lea su objetivo.

### Filtros y render
- Filtro: OR dentro de un grupo, AND entre grupos. Los chips muestran un **conteo facetado** (`contarEn(st, grupo, id)`: obras que habría con esa opción y los otros filtros), se desactivan en 0 y animan el recuento (`recontar()` + `ultimoConteo`).
- Render **sin salto + dominó**, igual en ambas versiones:
  1. se arma en un contenedor oculto `.preparacion` (en el DOM, para poder medir);
  2. salen de abajo hacia arriba las tarjetas visibles que ya no aplican (clases `.sale`/`.entra` con `animationDelay`, identificadas por `data-id` = índice en `PROYECTOS`);
  3. se cambia de una vez con `replaceChildren` conservando `scrollY`;
  4. entran las nuevas de arriba hacia abajo.
  
  Un `token` hace que gane el último filtro. Si no sale nada, el cambio es síncrono (las pruebas dependen de eso).
- Con filtro: **todas las obras como tarjeta** en una grilla. Sin filtro: tarjetas (destacadas y recientes) + trayectoria en lista.
- Presentación:
  - las hojas fijas (portada, empresa, servicios) se arman una vez en `#zonaFija`; al filtrar solo se reemplaza `#zonaObras`;
  - el bloque de chips "Sectores atendidos / Cobertura" (`PRE`) lo toma la primera hoja de obras que se abre;
  - la paginación agrega elementos y abre hoja nueva cuando `scrollHeight > clientHeight`, con reglas para no dejar 1 ficha o 1–2 filas solas en una hoja.

### PDF (descarga directa, en segundo plano)
- `assets/pdf-cola.js` (compartido): `PdfCola.encolar({ etiqueta, ejecutar(ctx) → {blob, nombre, paginas} })`. Maneja la cola, los avisos de progreso, "Descargar de nuevo", el respaldo `window.print` y el guard `beforeunload`. Cada pedido toma una foto de la selección al hacer clic.
- "Descargar CV" = completo e ignora los filtros. "Descargar proyectos" = **el mismo CV completo, solo con las obras seleccionadas**.
- `cv.html` tiene 2 generadores, elegidos con `PDF_MODO` en `cv.html` (o `?pdf=dibujo`):
  - `'foto'` (por defecto): `assets/cv-pdf-foto.js` arma hojas A4 con el estilo del sitio y las fotografía con html2canvas → jsPDF. Se ve igual a la página, pero el texto no es seleccionable.
  - `'dibujo'`: `assets/cv-pdf.js` dibuja con jsPDF (vectorial, liviano). Ojo: jsPDF no suma `charSpace` al alinear a la derecha; usar `textoDer()`/`ancho()`.
- `cv-presentacion.js` también fotografía sus propias hojas (html2canvas).
- Librerías locales en `assets/vendor/` (sin CDN). Las fotos, el logo y las fuentes van **embebidos en base64** (`cv-pdf-assets.js`) porque html2canvas/canvas se "ensucian" con imágenes `file://`. Los íconos de la presentación son `<img src="data:image/svg+xml,…">`: html2canvas no dibuja SVG en línea hechos solo con `stroke`.
- Rarezas de html2canvas que ya costaron bugs:
  - `radial-gradient` sale como mancha;
  - las sombras difusas salen como franjas grises;
  - `-webkit-line-clamp` no funciona (el texto se corta en JS con `corto()`);
  - `display:flex` con `::before` descuadra;
  - un reset `.x p{margin:0}` pisa márgenes de clases (usar `:where()`);
  - hay que esperar `img.complete` y `document.fonts.ready` antes de capturar.

## Convenciones del usuario
- El copy debe ser trazable a un dato real: PDF corporativo, CV original de Wix o sitio actual. No inventar cifras ni obras.
- Contraste mínimo WCAG AA; piso tipográfico de 11 px mono y 12 px texto.
- Diseño vigente = **diseño 2** (el que eligió Icewell; ver README § Diseño 2): navy `#0C141C`, fondo `#F1F4F7`, azul `#0062A8`, cian `#5FC4E4`, Big Shoulders en mayúsculas + IBM Plex, botones rectos de 4 px. `index.html` y `cv.html` comparten este sistema; la presentación y los PDF conservan el suyo. El diseño 1 está en git (commit `56416a6`).
- Logo sobre fondo oscuro: **nunca en un recuadro o placa blanca**. Isotipo con sus 3 colores y la palabra "icewell" recoloreada a crema (`#f5efe0`), recoloreando los trazos 3–4 de `icewell-logo.svg` en un SVG en línea. Ejemplo: `LOGO_MODAL` en `aniversario.js`.
- Documentar decisiones y hallazgos en `README.md`. Comentarios en español, con el "por qué".
- Panel: todo dato que entra se valida en el servidor (`Contenido::validar`); en el navegador, nunca `innerHTML` con datos del usuario. Cambios de seguridad → agregar el caso a `test_api.php`.

## Sesiones en la nube (claude.ai/code)

En la nube la raíz del repo = `Desktop/icewell/proyecto/` local. Toda ruta `Desktop/icewell/proyecto/...` en skills/docs se lee relativa a la raíz. Lo que vive fuera de `proyecto/` (p.ej. `../secret/`) NO existe en la nube.
