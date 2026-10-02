---
description: Proyecto ICEWELL (sitio web + CV interactivo). Cargar ante cualquier tarea del sitio Icewell — rutas, paleta, datos reales, aniversario, CV filtrable, verificación.
---

# /icewell — Proyecto Icewell (Proyecto 22)

Empresa: **Icewell SpA**, asesorías, ingeniería y montajes térmicos (HVAC), Santiago, desde 2009. El sitio real icewell.net está en Wix. Acá se construye la versión modernizada en HTML plano, sin build y sin framework.

## Rutas

| Qué | Dónde |
|---|---|
| Proyecto activo | `Desktop/icewell/proyecto/` (**`CLAUDE.md`** = comandos + arquitectura; `README.md` = decisiones y pendientes) |
| Pruebas | `proyecto/herramientas/tests/` (`npm install` una vez, luego `npm test`: test_icewell, test_web_ux, test_pdf) |
| PDF web "igual a la página" | `proyecto/web/assets/cv-pdf-foto.js` (modo `'foto'`, por defecto); el anterior `cv-pdf.js` es el modo `'dibujo'` → `PDF_MODO` en `cv.html` o `?pdf=dibujo` |
| Sitio | `proyecto/web/index.html` |
| CV interactivo | `proyecto/web/cv.html` |
| CV versión presentación (idéntica al PDF corporativo) | `proyecto/web/cv-presentacion.html` + `assets/cv-presentacion.js` (hojas A4, paginación por medición, PDF por html2canvas) |
| Cola/avisos de PDF compartidos | `proyecto/web/assets/pdf-cola.js` (`PdfCola.encolar({etiqueta, ejecutar(ctx)})`) |
| Datos del CV (única fuente de verdad) | `proyecto/web/assets/cv-data.js` (`SECTORES`, `REGIONES`, `PERIODOS`, `PROYECTOS`) |
| Años + aniversario | `proyecto/web/assets/aniversario.js` → `ICEWELL_FUNDACION` (⚠ placeholder `2009-01-01`) |
| PDF corporativo (fuente del copy) | `Desktop/icewell/Icewell-Presentacion-Corporativa.pdf` (copia en `web/assets/`) |
| Prototipos históricos 00–08 | `Desktop/icewell/0X-*/` (no tocar; 08 es la base de `proyecto/`) |
| Assets de marca originales | `Desktop/icewell/_recursos-fuente/` (logo e isotipo SVG) |
| CV PDF generado por Python (anterior) | `Desktop/icewell/curriculum-pdf/build_curriculum.py` |

## Sistema visual (industrial luminoso)

- **Tipografía**: Big Shoulders Display (titulares en mayúscula), IBM Plex Sans (cuerpo), IBM Plex Mono (labels uppercase con tracking).
- **Paleta**: colores reales del logo, azul `#0062A8` / verde `#1A9614` / rojo `#D01726`. Fondos `--dark #082436`, `--snow #f6fbfd`, `--ink #112536`, `--ink-soft #4b6474`. Franja tricolor `--tri` en la banda de números y el footer.
- **Piso tipográfico**: 11px en mono y 12px en texto. No volver a 9–10px (era la queja "se ve poco"). Cualquier color nuevo se mide con WCAG: ≥4.5 texto normal, ≥3 display grande.
- **El CV sigue el estilo del index, NO el del PDF.** Manuel dijo que el PDF "tiene estados muy IA": nada de chips con borde verde a la izquierda ni pastillas de estado de colores. Se usan tarjetas con foto a sangre (`.project-card`), filas con líneas finas (`.method-list`) y meta en texto mono.

## Datos reales (regla de copy: todo texto debe ser trazable al PDF o al sitio)

- WhatsApp `56964074519` · Tel `+56 2 2847 0610` · `contacto@icewell.cl`, `gonzalo.diaz@icewell.cl` · Román Díaz #1363, Providencia · RUT 76.059.117-3.
- **Cifras oficiales = PDF**: 51 obras registradas, +170.000 m² en obras destacadas, 12 regiones (Tarapacá–Los Lagos). **No** usar +150 ni +400k (se eliminaron por decisión de Manuel).
- Años de experiencia: nunca van hardcodeados. Se usa `<x data-anios>` y `<x data-desde>`.

## Mecánicas clave

- **`aniversario.js`** (portado de `cuvolt/proyecto/assets/aniversario.js`):
  - expone `window.icewellAniversario` (`anios`, `rellenar()`, `aplicar()`);
  - el tema dura desde el día de fundación hasta el mismo día del mes siguiente;
  - botón flotante "Vista previa · Aniversario · N años" siempre visible en las 3 páginas (como la barra de cuvolt v3; `MOSTRAR_BOTON = false` para publicar, `?preview=0` lo oculta); parámetros `?aniversario=1` (forzar) y `?hoy=aaaa-mm-dd` (simular fecha).
  - **Gotcha**: el index llama `icewellAniversario.rellenar()` ANTES de `statParts()` del contador animado. Si se invierte el orden, el contador anima hacia el número viejo.
- **CV**:
  - filtros OR dentro de un grupo y AND entre grupos; contadores facetados con `coincide(p, excepto)`;
  - estado en el hash `#sector=a,b&periodo=…&region=…&q=…` (ids inválidos se ignoran);
  - **PDF real**: `assets/cv-pdf.js` (jsPDF 2.5.1 local en `assets/vendor/`). Hace una descarga directa de lo filtrado y carga jsPDF y los assets de forma diferida al primer clic. Si falla, usa `window.print` como respaldo.
    - Fotos, fuentes y logo van embebidos en `assets/vendor/cv-pdf-assets.js`. Se generan con `python proyecto/herramientas/build_pdf_assets.py`, y **hay que regenerar al tocar fotos**.
    - Gotcha: jsPDF no suma `charSpace` al alinear a la derecha. Usar el helper `textoDer()`/`ancho()` del archivo, nunca `{align:'right'}` con charSpace.
    - **Segundo plano**: `generar()` es `async` y cede el hilo entre filas. Devuelve `{blob, nombre, paginas}` (no llama `doc.save`). En `cv.html`, `encolarPdf()` y `procesarCola()` manejan la cola, el aviso `#pdfToasts` y la descarga con `bajarBlob()`. Cada pedido toma una foto de la selección al hacer clic.
    - Precarga con `precargarPdf()` (idle a los 2.5 s). `cargarAssetsConProgreso()` usa `fetch` + stream para el %, y en `file://` cae a `<script src>`. Hay guard `beforeunload` mientras hay cola. `?pdfLento=1` sirve para probar.
    - Test: `test_pdf.js` en el scratchpad genera los PDF reales vía jsdom (parchea `jsPDF.API.save`) y se revisan renderizando con PyMuPDF.
  - Agregar una obra = un objeto más en `PROYECTOS`. Su sector y región deben existir en los catálogos.
- **Gotcha sticky**: `overflow-x:hidden` en html y body rompe `position:sticky`. En el CV se usa `overflow-x: clip` solo en body.

## Dos versiones del CV
- `cv.html` (estilo sitio) y `cv-presentacion.html` (idéntica a `Icewell-Presentacion-Corporativa.pdf`) comparten los datos y el hash de filtros. Las dos tienen **Descargar CV** (completo, ignora filtros) y **Descargar proyectos** (= el **mismo CV completo pero solo con las obras seleccionadas**, pedido Manuel; nombre `Icewell-CV-<filtro>.pdf`).
- Presentación: filtros en la **barra fija** (`<details class="dd">` Sector/Región + Período + pastillas + "Ver N obras ↓"). Hoja 2 = KPIs + Certificaciones + caja 01/02/03. Sectores + Cobertura (`bloqueFiltros()`) van arriba de la primera hoja de obras: `PRE` lo toma la primera hoja que abra `flujoTarjetas`/`flujoTrayectoria`/"sin obras". `render(scroll, animar)`: fijas en `#zonaFija` (una vez); obras en `#zonaObras`, armadas en `.preparacion` y cambiadas con `replaceChildren`. Dominó por `data-id` (clases `.sale`/`.entra` + `animationDelay`; token para que gane el último filtro). Con filtro, `flujoSeleccion()` pone TODAS las obras como ficha en una grilla (`tarjeta(p, conAnio)`; m² solo si existe; sin listado aparte). Regla: ninguna hoja termina con 1 ficha sola; títulos "· hoja N". Los chips muestran `(N)` con `contarEn(st, grupo, id)` (facetado), se desactivan en 0 y `recontar()` anima el cambio con rAF + `ultimoConteo`. Gotcha de prueba: en una pestaña oculta (`visibilityState: hidden`) el scroll suave no se anima, así que no es bug.
- La versión presentación toma sus medidas del PDF original (mm/pt con PyMuPDF). Para cambiarla, comparar con `msedge --headless=new --print-to-pdf` + render lado a lado. `render()` no se puede verificar en jsdom (no hay layout): se prueba en navegador real.
- Gotcha html2canvas: un SVG en línea solo con `stroke` sale en blanco; se usa `<img src=data:image/svg+xml>`. Antes de fotografiar hay que esperar `img.complete`.

## Paridad entre versiones
Toda mejora de experiencia que se haga en una versión (`cv.html` / `cv-presentacion.html`) va también a la otra. Manuel no quiere pedirlas una por una. Hoy ambas tienen:
- etiqueta Público/Privado y "En ejecución" como texto;
- con filtro, todas como tarjeta;
- dominó sin salto;
- recuento animado de los chips;
- filtros en la barra fija;
- años exactos;
- PDF en segundo plano;
- "Descargar proyectos" = CV completo con la selección;
- sin fichas o filas sueltas.

## Verificación obligatoria (mismo criterio que cuvolt)

1. `node --check` no alcanza. Usar **jsdom**. Las pruebas ya están en `proyecto/herramientas/tests/` (`npm test`); para casos nuevos, agregarlos ahí y no en el scratchpad:
   - inyectar los `<script src="assets/…">` inline;
   - stub de `matchMedia`, `IntersectionObserver`, `scrollIntoView` y `print`;
   - validar resultados reales: años, tema con `?hoy=`, filtros y hash.
2. Chrome (`python -m http.server 8765` en `proyecto/web`):
   - desktop y 400px. La ventana suele estar maximizada y `resize_window` no achica; en ese caso usar iframes de 400px vía `document.write`;
   - para ver el PDF: forzar las `CSSMediaRule` con media `print` a `all`.
3. Verificar que exista toda ruta `assets/...` referenciada.

## Pendientes abiertos

Ver `proyecto/README.md` § Pendiente: fecha real de fundación, sectores y regiones `// revisar` en `cv-data.js`, fusión Fast Air, fotos `n-*` sacadas de Noticias. Idiomas quedan para después. La publicación en Wix se hace a mano.
