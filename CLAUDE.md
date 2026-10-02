# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Proyecto Icewell: sitio modernizado de icewell.net (hoy en Wix) + currículum interactivo, en HTML/CSS/JS plano, sin build ni framework. Contexto completo, decisiones y pendientes: `README.md` (leer primero). Skill con el resumen operativo: `/icewell`. Idioma del proyecto y del usuario: español.

## Comandos

Todas las rutas son relativas a la raíz del proyecto (`Desktop/icewell/proyecto/`).

```bash
# Servir el sitio (necesario para html2canvas con fotos, fetch con % de carga y deep-links; con doble clic también funciona)
python -m http.server 8765 --directory web       # → http://localhost:8765/index.html | cv.html | cv-presentacion.html

# Pruebas (jsdom, corren el JS real de las páginas). Instalar una vez:
npm install --prefix herramientas/tests
npm test --prefix herramientas/tests             # las 3 suites encadenadas con && (se corta en la primera que falla)
node herramientas/tests/test_icewell.js          # una sola: index + aniversario (+ botón de vista previa) + filtros/hash de cv.html
node herramientas/tests/test_web_ux.js           # tarjetas Público/Privado, filtro = todas tarjeta, barra fija, recuento
node herramientas/tests/test_pdf.js              # genera PDFs reales de cv.html (modo 'dibujo') → herramientas/tests/salida/

# Regenerar fuentes/fotos embebidas del PDF (OBLIGATORIO al agregar o cambiar una foto en cv-data.js)
python herramientas/build_pdf_assets.py          # → web/assets/vendor/cv-pdf-assets.js
```

Lo que jsdom **no** puede validar (no tiene layout ni canvas): la paginación por medición de `cv-presentacion.html`, las hojas A4 del modo 'foto' y las animaciones. Eso se verifica en Chrome real: con la extensión claude-in-chrome contra el servidor local, o con `msedge --headless=new --print-to-pdf=... URL` + render con PyMuPDF. En una pestaña oculta el scroll suave y las animaciones CSS/rAF no corren, así que no son bug.

## Arquitectura

### Páginas (`web/`)
- `index.html`: sitio principal (hero, servicios, portafolio, equipo, socios, contacto). Enlaza al CV.
- `cv.html`: **versión web** del CV, con el estilo del sitio (Big Shoulders + IBM Plex).
- `cv-presentacion.html` + `assets/cv-presentacion.js`: **versión presentación**, idéntica en estética a `Icewell-Presentacion-Corporativa.pdf` (Archivo + Inter, medidas en mm tomadas del PDF). La página es una pila de hojas A4.

Las dos versiones del CV comparten los datos, el formato del hash de filtros (`#sector=a,b&periodo=…&region=…&q=…`) y un selector "Versión web / Versión presentación" que conserva el filtro. **Regla del usuario: toda mejora de experiencia en una versión se porta a la otra** (ver `/icewell` § Paridad entre versiones).

### Datos: `assets/cv-data.js` (única fuente de verdad)
`SECTORES`, `REGIONES`, `PERIODOS` y `PROYECTOS` (68 obras). Campos clave de cada obra:
- `sectores[]`, `regiones[]`: ids de los catálogos;
- `m2`, `foto` (archivo en `assets/`);
- `estado`: 'ejecucion' | 'ejecutado';
- `cliente`: 'Público' | 'Privado'. Es la etiqueta de las tarjetas;
- `trabajo`, `detalle`: del CV original de Wix;
- `destacado: true`: las 9 del PDF corporativo; la vista sin filtro de la presentación depende de esto.

Las cifras institucionales (51 obras, +170.000 m², 12 regiones) van escritas en el HTML y no se calculan. Los casos dudosos llevan `// revisar`.

### Años automáticos: `assets/aniversario.js`
`ICEWELL_FUNDACION` (placeholder `2009-01-01`) → `window.icewellAniversario.anios`. Rellena `[data-anios]`/`[data-desde]` y activa el tema aniversario durante un mes. Botón flotante **"Vista previa · Aniversario · N años"** abajo al centro en las 3 páginas (siempre visible mientras `MOSTRAR_BOTON = true`; ponerlo en `false` al publicar; `?preview=0` lo oculta en una visita). Parámetros: `?hoy=aaaa-mm-dd`, `?aniversario=1` (queda en la URL al activar el botón, así el link se comparte ya activado). **Orden de carga:** hay que llamar `icewellAniversario.rellenar()` antes de que el contador animado del index lea su objetivo.

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
- Logo sobre fondo oscuro: **nunca en un recuadro o placa blanca**. Isotipo con sus 3 colores y la palabra "icewell" recoloreada a crema (`#f5efe0`), recoloreando los trazos 3–4 de `icewell-logo.svg` en un SVG en línea. Ejemplo: `LOGO_MODAL` en `aniversario.js`.
- Documentar decisiones y hallazgos en `README.md`. Comentarios en español, con el "por qué".

## Sesiones en la nube (claude.ai/code)

En la nube la raíz del repo = `Desktop/icewell/proyecto/` local. Toda ruta `Desktop/icewell/proyecto/...` en skills/docs se lee relativa a la raíz. Lo que vive fuera de `proyecto/` (p.ej. `../secret/`) NO existe en la nube.
