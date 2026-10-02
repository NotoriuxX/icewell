# Icewell — proyecto web (versión de trabajo)

Proyecto formal de Icewell, en la misma línea que CUVOLT. Toma el prototipo elegido `../08-industrial-luminoso/` y lo lleva a una versión modernizada del sitio real (icewell.net/tecnología, hoy en Wix, con cifras vencidas: "más de 14 años", "© 2035"). Skill para retomar en otra sesión: **`/icewell`**.

## Estructura

> Para trabajar con Claude Code: `CLAUDE.md` (comandos y arquitectura). Pruebas: `herramientas/tests/` → `npm test`.

```
proyecto/
  README.md
  web/
    index.html      ← sitio principal (evolución de 08-industrial-luminoso)
    cv.html         ← currículum interactivo (filtros + PDF de lo filtrado)
    assets/
      aniversario.js   ← años automáticos + tema aniversario (portado de cuvolt)
      cv-data.js       ← ÚNICA fuente de datos del CV (63 obras)
      icewell-presentacion-corporativa.pdf  ← descarga "Presentación completa"
      (logos, fotos de proyectos, logos de socios: copia de 08/assets)
```

`08-industrial-luminoso/` no se tocó: queda como histórico.

## Cómo abrir

Con doble clic funciona. Para probar deep-links y la impresión conviene levantar un servidor:

```bash
cd Desktop/icewell/proyecto/web && python -m http.server 8765
# http://localhost:8765/index.html   ·   http://localhost:8765/cv.html#sector=mineria
```

## Qué cambió respecto de 08

- **Paleta y legibilidad**:
  - Los acentos pasan a los colores reales del logo: azul `#0062A8`, verde `#1A9614`, rojo `#D01726`. La franja tricolor va sobre la banda de números y el footer.
  - El piso tipográfico sube de 8.5–10px a 11–12px en labels mono, métricas, footer y tarjetas.
  - Se oscurecieron los tonos que no llegaban a WCAG AA (`vertical-label` estaba en 2.76, el "=" verde en 2.40).
  - Se subieron las opacidades de texto sobre fondo oscuro (0.64–0.73 → 0.82–0.9).
  - Todos los pares medidos quedan ≥4.5, o ≥3 en display grande.
- **WhatsApp**: el botón flotante tiene el logo oficial de WhatsApp, un círculo `#25D366` y pulso (patrón de `cuvolt/proyecto/index-v3.html`). Número 56964074519.
- **Cifras = PDF corporativo** (decisión de Manuel): 51 obras registradas, +170.000 m² en obras destacadas y 12 regiones. Se eliminaron +150 proyectos, +400k m² y "100% obras entregadas".
- **Años automáticos** (`[data-anios]`): cambian solos el día del aniversario. El footer muestra `© año actual`.
- **Tema aniversario**: se activa desde el día de fundación hasta el mismo día del mes siguiente. Pone acentos dorados en años, sello y eyebrows, y muestra un modal con laurel 1 vez por año (`localStorage icewell_aniv_visto_<año>`).
  - **Botón de vista previa siempre visible** (abajo al centro, en index, cv y cv-presentacion): "Vista previa · Aniversario · 17 años". Al tocarlo la página se ve como el día del aniversario (modal con laurel, confeti, dorado) y el estado queda en la URL (`?aniversario=1`). Para publicar sin el botón: `MOSTRAR_BOTON = false` en `assets/aniversario.js`.
- **Currículum**:
  - link en el nav, en el menú móvil y en el footer;
  - CTA "Ver currículum completo" en Proyectos;
  - 10 links de sector en Servicios, que abren `cv.html#sector=<id>`.

## Dos versiones del CV (para mostrarle a Icewell)

Las dos comparten los datos (`cv-data.js`) y los filtros por hash (`#sector=hoteleria`). El selector **Versión web / Versión presentación** que va arriba en ambas conserva el filtro al cambiar de versión.

| | `cv.html` — **Versión web** | `cv-presentacion.html` — **Versión presentación** |
|---|---|---|
| Aspecto | Estilo del sitio (industrial luminoso) | **Idéntica al PDF corporativo** (`Icewell-Presentacion-Corporativa.pdf`): hojas A4, Archivo + Inter, mismas medidas en mm tomadas del PDF con PyMuPDF |
| Filtrar | Chips de sector, período, región y buscador | **Barra fija arriba**: desplegables Sector / Región (casillas con contador), Período, pastillas × y Limpiar, y botón "Ver N obras ↓". También sirven los chips de la hoja 2 |
| **Descargar CV** | CV completo, siempre sin filtros (`Icewell-CV.pdf`, 7 págs, vectorial, jsPDF) | Presentación completa (`Icewell-Presentacion-Corporativa.pdf`, 10 hojas) |
| **Descargar proyectos** | **El mismo CV completo pero solo con las obras seleccionadas** (`Icewell-CV-hoteleria.pdf`), con la franja "Selección de obras: …" en la portada | **La misma presentación completa pero solo con las obras seleccionadas** (`Icewell-CV-hoteleria.pdf`); en la hoja 2 los sectores y regiones elegidos salen resaltados |
| Cómo se arma el PDF | Dibujado con jsPDF (texto seleccionable, ~1.4 MB completo) | Se **fotografían las mismas hojas** con html2canvas y se pegan en jsPDF → idéntico a la pantalla. El texto no se puede seleccionar; pesa ~2.9 MB y tarda ~11 s completo |

- Las hojas de la versión presentación se **paginan midiendo el contenido real**: si una tarjeta o fila no cabe, pasa a una hoja nueva que repite el encabezado. La trayectoria llena primero la columna izquierda y después la derecha, igual que el PDF.
- Contenido: portada; hoja 2 = empresa + KPIs + **Certificaciones y estándares** + caja 01/02/03; servicios; **Sectores atendidos + Cobertura territorial justo arriba de "Proyectos actuales"** (pegados a los resultados: al filtrar se ven los chips resaltados y las obras debajo; en el PDF también); *Obras recientes y en ejecución* (2023–2024, con PRIVADO/COMERCIAL/PÚBLICO); *Proyectos destacados* (con m²); trayectoria; datos.
- **Con filtro, todas las obras como ficha** (pedido Manuel: "déjala como ficha nomás"): "Obras · Industrial" + "12 obras." + una sola grilla de tarjetas (en ejecución primero, luego por año). Las recientes llevan PRIVADO/COMERCIAL/PÚBLICO/EN EJECUCIÓN; las anteriores a 2023 y las destacadas, el año. Los m² salen solo si la obra los tiene. Ya no hay listado aparte de "Obras ejecutadas". Sin filtro se mantiene la estructura del PDF (con su trayectoria en lista).
- **Fichas filtradas: la etiqueta dice PÚBLICO (verde) o PRIVADO (azul)**, como en el PDF. Adentro: "lugar · año · En ejecución" y "sector · uso · tipo de trabajo". Sale del campo `cliente` de `cv-data.js`: explícito en las 6 obras 2023 del PDF (Hotel Debaines, "Comercial", cuenta como Privado); el resto está deducido por el mandante (Estado, municipios y empresas públicas = Público: 21 obras; Privado: 47). **Revisar con Icewell**, en especial: Colegio Darío Salas, Escuela Manuel Orella, Parque de negocios Los Libertadores (el PDF dice Público), Empresa Portuaria San Antonio y Hospital del Tórax. Sin filtro se usa **la misma ficha**: la etiqueta dice Público/Privado también en las obras en ejecución, y "En ejecución" va como texto dentro.
- **Sin filtro, una sola sección "Portafolio"** (antes eran "Proyectos actuales" y "Portafolio / Proyectos destacados" por separado): título "Proyectos" con los subgrupos "En ejecución y recientes" y "Proyectos destacados" seguidos en las mismas hojas ("Proyectos · hoja N"), y el recuadro azul Modalidad/Usos/Ubicación al final si cabe. La trayectoria (lista) sigue como sección aparte. Esta vista ya no es idéntica al PDF corporativo en las hojas de obras (pedido de Manuel); portada, empresa, servicios y datos sí lo son.
- **Años de experiencia exactos** también en la versión presentación: portada ("Experiencia 17 años") y caja KPI ("17 Años de experiencia") salen de `aniversario.js` y cambian solos cada aniversario. Antes decía "+15" fijo. El párrafo "más de 15 años trabajando para las principales empresas" se dejó: habla de la experiencia de los ingenieros antes de fundar Icewell.
- **Chips con cantidad**: "Oficinas (7)", "Coquimbo (1)". Es el conteo facetado: obras que habría eligiendo esa opción, con los otros filtros aplicados. Se recuenta con animación al filtrar (sube en verde, baja en gris). En (0) queda gris y **no se puede seleccionar**, por ejemplo con Coquimbo, Hotelería (0); también en la barra. En el PDF salen igual, sin animación.
- **Sin fichas sueltas**: si la última hoja quedaría con 1 sola ficha, se pasa una más desde la hoja anterior. Las hojas siguientes se titulan "Obras · X · hoja 2".
- **Sin parpadeo + dominó**: las hojas fijas (portada, empresa, servicios) se arman una sola vez. Al filtrar solo se reemplaza `#zonaObras`, que se arma aparte y se cambia de una vez. Las obras que se van salen en dominó de abajo hacia arriba; las nuevas entran de arriba hacia abajo; las que se quedan no se mueven. Con `prefers-reduced-motion` no hay animación.
- Filtrar desde la barra **no mueve la página** (se guarda y restaura el scroll al rearmar las hojas). Filtrar desde los chips de la hoja 2 sí baja a las obras.
- Gotcha html2canvas: un SVG en línea hecho solo de trazos sale en blanco. Por eso los íconos de Servicios van como `<img src="data:image/svg+xml,…">`. Los logos, que son rellenos, sí salen en línea. Todo va embebido, así que funciona también con doble clic.
- La cola y los avisos de PDF de ambas versiones viven en `assets/pdf-cola.js`, compartido.
- Verificación: Edge headless `--print-to-pdf` de `cv-presentacion.html`, renderizado lado a lado con el PDF original (PyMuPDF).

## CV interactivo (`cv.html`)

**Mejoras de experiencia llevadas desde la versión presentación (28-sep):**
- **Tarjetas uniformes**:
  - la etiqueta es Público/Privado (verde/azul, desde `p.cliente`);
  - la línea de la tarjeta dice "año · sector · tipo de trabajo" (el sector es el filtrado si corresponde);
  - "En ejecución" va como texto verde;
  - las tarjetas sin foto muestran los m² o el año en grande.
- **Con filtro, todas las obras como tarjeta** en una grilla ("14 obras · Industrial"), sin lista aparte. Sin filtro: "Obras destacadas y recientes" (foto, m² o 2023+) + "Trayectoria" en lista.
- **Sin salto + dominó**: el resultado se arma aparte y se cambia de una vez. Salen de abajo hacia arriba las que ya no aplican y entran de arriba hacia abajo las nuevas; las que se quedan no se mueven. Con `prefers-reduced-motion` no hay animación.
- **Recuento animado** en los números de los chips: sube en verde, baja en gris; en 0 quedan gris y bloqueados.
- **Filtros a mano en la barra fija**: pastillas × del filtro activo, "Limpiar" y "Filtros ↑" (sube a los chips). Filtrar desde ahí no mueve la página.
- **PDF web** (`cv-pdf.js`):
  - etiqueta Público/Privado, y el año y "En ejecución" en la línea mono;
  - con selección, todas las obras como tarjeta, bajo "Obras · Hotelería";
  - la trayectoria no deja 1–2 filas solas en la última página.
- **PDF igual a la página (modo 'foto', 28-sep)**: `assets/cv-pdf-foto.js` arma hojas A4 con el estilo del sitio y las fotografía con html2canvas, igual que la versión presentación.
  - Contenido: barra blanca con el logo, hero celeste con cifras, "Qué hacemos", tarjetas con foto a sangre, trayectoria con año grande, bloque de empresa y footer oscuro con franja tricolor.
  - Tiempos medidos en este PC: Hotelería 2.2 s (486 KB), Salud 3.2 s (689 KB), CV completo 11 s (11 hojas, 3.2 MB). Captura a 1.6×. El texto no es seleccionable.
  - **Para volver al PDF anterior** (jsPDF dibujado, liviano, texto seleccionable): en `cv.html` cambiar `var PDF_MODO = ... || 'foto'` por `'dibujo'`. Para probar sin tocar nada: `cv.html?pdf=dibujo`.
  - Gotchas html2canvas: `radial-gradient` sale como mancha, la sombra difusa como franja gris, `-webkit-line-clamp` no funciona (el texto se corta en JS con `corto()`), y un reset `.wh-hoja p{margin:0}` pisaba los márgenes (se usa `:where()`).
- Prueba: `test_web_ux.js` en el scratchpad (15 chequeos), además de `test_icewell.js` y `test_pdf.js`.


- Sigue el estilo visual del index, no el del PDF (pedido de Manuel: el PDF "tiene estados muy IA"):
  - tarjetas con foto a sangre y sombra, como `.project-card`;
  - filas de trayectoria con líneas finas, como `.method-list`;
  - labels mono y cifras grandes en Big Shoulders.
- **Filtros**: Sector, Período y Región. Dentro de un grupo son OR y entre grupos son AND. Hay un buscador de texto que no distingue acentos. Los chips muestran contadores que reaccionan a los demás filtros.
- **URL compartible**: `cv.html#sector=hoteleria,mineria&periodo=2010-2013&region=atacama&q=chiller`.
- **Descargar PDF** baja un **.pdf real** directo, sin diálogo de impresión. Lo arma `assets/cv-pdf.js` con **jsPDF** (copia local en `assets/vendor/`, sin CDN):
  - es vectorial y el texto se puede seleccionar;
  - usa las fuentes de la marca y la franja tricolor;
  - trae portada con KPIs, servicios, tarjetas con foto y m² (3 columnas si hay más de 6), trayectoria por año, certificaciones y datos de empresa;
  - lleva numeración "01 / 07" en todas las páginas.
  - **Con filtro** el PDF queda enfocado: título "Obras · Hotelería", con KPIs de la selección (n obras, m², regiones, período) y sin servicios. El archivo se llama `Icewell-CV-hoteleria.pdf`.
  - **Se genera en segundo plano con aviso de progreso** (abajo a la izquierda). Mientras se arma, la persona puede seguir haciendo scroll, filtrando y buscando.
    - Estados del aviso: "Cargando fuentes y fotos… 40%" → "Armando PDF… Obra 14 de 63" → "Listo ✓ · 7 páginas descargado". Al terminar se descarga solo y deja un botón "Descargar de nuevo", que reusa el archivo sin rearmarlo.
    - Cada clic toma una **foto de la selección** de ese momento. Cambiar filtros después no altera ese PDF. Si se piden varios, quedan **en cola** ("En espera") y bajan en orden.
    - Si falla la carga aparece un aviso rojo con "Reintentar" y "Usar impresión".
    - Si se intenta salir de la página a mitad, el navegador pregunta antes. Irse a otra página (index) corta la generación: es un límite de un sitio sin servidor.
    - **Precarga**: 2.5 s después de abrir `cv.html`, jsPDF y los assets (~2.4 MB) se bajan en segundo plano, salvo con "Ahorro de datos" activo. Así el clic suele ser casi instantáneo. El % de carga es real (con `fetch`); con doble clic (`file://`) la barra queda indeterminada.
    - Para ver la carga lenta: `cv.html?pdfLento=1` agrega 3 s de demora.
  - Si algo falla, cae al diálogo de impresión como respaldo. `Ctrl+P` sigue funcionando con el CSS `@media print`.
  - **Al agregar o cambiar una foto** en `cv-data.js` hay que correr `python proyecto/herramientas/build_pdf_assets.py`. Regenera `assets/vendor/cv-pdf-assets.js` (fuentes + logo + fotos recortadas a 3:2 en base64). Van embebidas porque leerlas en vivo con canvas falla al abrir con doble clic (file://).
  - Muestras generadas: `proyecto/muestras-pdf/` (completo de 7 págs, Hotelería de 2 págs, Minería 2010–2013).
- **"Presentación completa"** descarga el PDF corporativo tal cual.
- **Cobertura territorial**: tocar una región filtra y baja al listado.

### Datos (`assets/cv-data.js`)

- **68 obras** de 3 fuentes:
  1. el PDF corporativo nuevo (`Icewell-Presentacion-Corporativa.pdf`);
  2. el **CV original de Icewell** (PowerPoint publicado en Wix, 20 págs: `Downloads/2afe9a_76c6036a839247e7bc40b906e9405d19 (1).pdf`);
  3. los 5 proyectos 2024 del sitio.
- Del CV original se sumaron:
  - **m² de ~20 obras más** (30 en total tienen superficie);
  - **tipo de trabajo** (Suministro y montaje / Proyecto y montaje / Proyecto / Montaje);
  - **uso** real;
  - **detalle** largo (ej. "60 equipos de ventilación y 10 tableros a 4.800 msnm").
- Se separaron obras que estaban juntas: Park Plaza Lyon / Park Calama, Carozzi Galletas / Pastas, Metro Tobalaba / Moneda / Pedro de Valdivia.
- Conflictos resueltos con el original:
  - PDI Linares = **2017**;
  - Cerro Dominador son **2 obras** (splits + **Planta Solar CPS**, VRV, 3.436 m²).
  - La foto `n-calama.jpg` es de la noticia "Planta Concentradora Solar – Calama", así que quedó en la Planta Solar CPS y no en el hotel.
- `destacado: true` marca las 9 "Proyectos destacados" del PDF. La versión presentación sin filtro usa ese campo para seguir igual al PDF, aunque ahora haya más obras con m².
- La versión web muestra el `detalle` largo y el tipo de trabajo; la versión presentación filtrada muestra el tipo de trabajo en cada ficha.
- Las 5 obras de 2024 no tienen tipo de trabajo (no están en el CV original).
- El "51" y el "+170.000 m²" siguen siendo las cifras institucionales del PDF. El CV cuenta sus propias obras.
- Paginación: ninguna hoja termina con 1–2 filas o 1 ficha sola. El recuadro azul "Modalidad / Usos / Ubicación" se omite si no cabe (no se abre una hoja solo para él).

## Pendiente — confirmar con Icewell

- **Fecha real de fundación**: hoy es el placeholder `ICEWELL_FUNDACION = '2009-01-01'` en `assets/aniversario.js`. Con esa fecha, hoy da **17 años**. El PDF solo dice "principios de 2009".
- Casos marcados `// revisar` en `cv-data.js`:
  - **Sector**: Línea 7 Metro, Estaciones Metro y Metro S.A. (van como Gobierno; ¿es mejor "Transporte"?); DK Home (Retail); Casino Enjoy Pucón (Hotelería); Block La Dehesa (Oficinas); Torre del Sol (Residencial); Cerro Dominador (Industrial/energía).
  - **Región**: Aduana de Quillagua (el sitio dice Tarapacá; Quillagua está en el límite con Antofagasta); Caserones (el PDF dice Coquimbo); Soprole Rukan (sin región en el PDF).
  - **Fusión**: "Oficinas Fast Air Aeropuerto" + "Centro de Importaciones Fast Air" se unieron en una sola obra. Confirmar que sea la misma.
  - **Fotos** tomadas de Noticias del sitio: `n-sanantonio.jpg` y `n-torax.jpg` coinciden con su obra. `n-calama.jpg` quedó bien asignada a la Planta Solar CPS. `n-uc.jpg` es de otro edificio UC (Campus San Joaquín): pendiente de sacar o reemplazar.
- Cambio de idioma: fuera de alcance por ahora.
- Publicación: el sitio real está en Wix. Esto es un prototipo local, no se publica solo.

## Verificación hecha (2026-09-27)

- Hay 36 pruebas en jsdom sobre el runtime real (script `test_icewell.js` en el scratchpad de la sesión). Cubren:
  - años = 17;
  - `?hoy=2027-01-05` → 18 años y tema activo, `?hoy=2027-02-02` → sin tema;
  - el contador animado apunta al valor rellenado;
  - chips OR/AND;
  - hash de ida y vuelta, deep-link al cargar e ids inválidos ignorados;
  - búsqueda, cobertura, `window.print` y sin duplicados.
- Revisión visual en Chrome a 1300px y 400px (iframes): sin scroll horizontal.
- Vista de impresión simulada (reglas `@media print` forzadas a pantalla): OK.
- Bug encontrado y corregido: `overflow-x:hidden` en html y body a la vez rompía el header sticky del CV. Ahora body usa `overflow-x: clip`.
