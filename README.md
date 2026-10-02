# Icewell — proyecto web (versión de trabajo)

Proyecto formal de Icewell, en la misma línea que CUVOLT. Toma el prototipo elegido `../08-industrial-luminoso/` y lo lleva a una versión modernizada del sitio real (icewell.net/tecnología, hoy en Wix, con cifras vencidas: "más de 14 años", "© 2035"). Skill para retomar en otra sesión: **`/icewell`**.

## Estructura

> Para trabajar con Claude Code: `CLAUDE.md` (comandos y arquitectura). Pruebas: `herramientas/tests/` → `npm test`.

```
proyecto/
  README.md · CLAUDE.md
  web/                      ← lo público (public_html en el hosting)
    index.html              ← sitio principal (evolución de 08-industrial-luminoso)
    cv.html                 ← currículum interactivo (filtros + PDF de lo filtrado)
    cv-presentacion.html    ← CV versión presentación (hojas A4)
    admin/                  ← PANEL: entrar/crear cuenta/recuperar + editor del sitio
    api/index.php           ← única puerta de la API (el código vive en servidor/)
    assets/
      sitio-data.js         ← GENERADO por el panel: empresa, cifras, textos, secciones
      cv-data.js            ← GENERADO por el panel: sectores, regiones, períodos, 68 obras
      sitio-render.js       ← aplica sitio-data.js al HTML de las 3 páginas
      borrador.js           ← vista previa del editor (lee el borrador sin publicar)
      aniversario.js        ← años automáticos + tema aniversario (portado de cuvolt)
      obras/                ← fotos subidas desde el panel
      (logos, fotos de proyectos, logos de socios: copia de 08/assets)
  servidor/                 ← PHP del panel, FUERA de public_html
    config.ejemplo.php      ← copiar a config.php en el hosting (no va a git)
    semilla.json            ← contenido inicial (lo que estaba escrito a mano)
    lib/                    ← Auth, Sesion, Google, Correo, Contenido, PdfAssets…
    datos/                  ← SQLite local, correos de prueba, respaldos (no va a git)
  herramientas/
    servidor-local.php      ← php -S para la beta en tu PC
    admin-cli.php           ← crear admin, aprobar, resetear clave, publicar-semilla
    semilla.js              ← (re)importa cv-data.js + textos → servidor/semilla.json
    tests/                  ← jsdom (npm test) + test_api.php (servidor)
```

`08-industrial-luminoso/` no se tocó: queda como histórico.

## Cómo abrir

Con doble clic funciona (el sitio público sigue siendo estático). Con el panel incluido, en tu PC:

```bash
php -S 127.0.0.1:8765 -t web herramientas/servidor-local.php
# http://localhost:8765/              sitio
# http://localhost:8765/admin/        panel → "Entrar como desarrollador"
# http://localhost:8765/admin/bandeja.html   correos de prueba (recuperar, verificar)
```

Sin PHP instalado (solo mirar el sitio): `python -m http.server 8765 --directory web`.
En Windows, PHP se instala una vez con `winget install PHP.PHP.8.3` (o el zip de windows.php.net, agregando la carpeta al PATH).

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

## Panel de administración (`/admin`) — 02-oct

Pedido de Manuel: entrar con cuenta de la empresa y editar todo el sitio sin tocar código (secciones, obras, CV, datos de contacto), con recuperación de contraseña y Google. Decisiones: **hosting compartido con PHP**, correos **@icewell.cl**, **registro + aprobación de un admin**, correo por **SMTP de la empresa**, sin IA por ahora. Base: el editor de CUVOLT, adaptado y mejorado.

### Cómo funciona
- **El sitio público sigue estático.** La BD guarda el contenido y sus versiones; **Publicar** escribe `assets/sitio-data.js` + `assets/cv-data.js` (escritura atómica, respaldo previo en `servidor/datos/respaldos/`) y regenera las fotos del PDF. Doble clic, pruebas y PDF siguen igual.
- **Un dato, un lugar**: teléfono, WhatsApp (y sus mensajes), correos, dirección, RUT, redes, cifras institucionales y fecha de fundación se editan en «Empresa y contacto» y llegan a index, CV, presentación y los 3 generadores de PDF (`sitio-render.js`: `data-t`, `data-empresa`, `data-wa`, `data-cifra`, `data-lista`). El HTML conserva el texto escrito como respaldo si falta el JS.
- **Formato de los textos** (seguro, sin HTML): `*énfasis*` (azul), `**negrita**`, salto de línea, y `{anios}` `{desde}` `{obras}` `{m2}` `{regiones}` → valores automáticos.
- **Obras**: lista con filtros (portada, con/sin foto, destacadas, en ejecución, revisar, ocultas), ficha con «Dónde aparece», portada **solo con foto** (si se quita la foto, sale de la portada), tarjeta ancha, orden de la portada, destacada (presentación), ocultar sin borrar, duplicar, nota interna «revisar».
- **Currículum**: títulos, bajadas, servicios (texto web + texto corto para PDF), certificaciones y todos los textos de la presentación. Los datos de la empresa se ven en solo lectura y se editan en su pestaña.
- **Guardar ≠ Publicar**: Guardar crea un borrador (cualquier editor); Publicar (admin, configurable) cambia el sitio. Bloqueo optimista (si otra persona guardó, no se pisan), historial de 150 versiones con «Cargar al borrador», deshacer/rehacer, y **copia local del borrador** si se corta la sesión o se cierra la pestaña.
- **Vista previa real** (iframe con `?borrador=1`, `assets/borrador.js`): Inicio / CV web / CV presentación, escritorio/tablet/móvil; clic en un texto → su campo; foco en un campo → se marca en la vista previa. Textos al vuelo; obras y presentación recargan conservando el scroll.

### Seguridad (todo se valida en el servidor)
- Correo: solo `@icewell.cl` exacto (sin subdominios ni Unicode). Registro → verificar correo → **aprobación de un admin** (aviso por correo a los admins). `admin_inicial` en config sirve para el primer acceso en un hosting sin consola.
- Contraseñas: mínimo 12, sin las más comunes ni el nombre/correo; **Argon2id** (bcrypt si el hosting no lo tiene) sobre HMAC con un *pepper* que vive en `config.php`, fuera de la BD.
- Recuperar: enlace `restablecer.html?id=<selector>&t=<verificador>`, en la BD solo el SHA-256, **30 min, un solo uso**; la página valida el enlace antes de mostrar el formulario y lo saca de la barra de direcciones; al cambiar la clave se cierran **todas** las sesiones y llega un correo de aviso. Respuestas que no revelan si un correo existe (login, registro, recuperar), con tiempo parecido.
- Google: el ID token se verifica en el servidor (firma RS256 con las llaves de Google, `aud`, `iss`, vencimiento, `email_verified`, claim `hd` **y** dominio del correo). Cuenta nueva → espera aprobación.
- Sesiones propias en la BD (no archivos de PHP, que en un hosting compartido pueden ser legibles por otros sitios): cookie `__Host-`, HttpOnly, SameSite=Strict, 30 min de inactividad / 8 h máximo, revalidación por petición (bloquear o cambiar la clave corta al instante). CSRF por sesión + cabecera propia + chequeo de Origin. Límites de intentos por IP y por correo.
- **2FA opcional** (app autenticadora, TOTP) con secreto cifrado con libsodium; cada código sirve una vez. Muy recomendado para admins.
- Imágenes: solo JPG/PNG/WebP ≤ 8 MB, tipo real por bytes, **re-codificadas con GD** (se pierde EXIF/GPS y cualquier contenido escondido), nombre aleatorio, carpeta sin ejecución de PHP. Nada de SVG.
- CSP estricta en el panel (sin JavaScript en línea), `X-Frame-Options`, `Referrer-Policy: no-referrer` (los enlaces llevan token), HSTS, auditoría de entradas, intentos fallidos, guardados y publicaciones (pestaña Usuarios).
- Pruebas: `php herramientas/tests/test_api.php` (89 chequeos de flujos y ataques: dominio ajeno, clave débil, CSRF, origen ajeno, fuerza bruta, enlaces reutilizados/vencidos, sesiones que deben morir, Google falso, 2FA repetido, PHP disfrazado de foto, modo desarrollador en producción).

### Beta en tu PC (sin servidor)
`php -S 127.0.0.1:8765 -t web herramientas/servidor-local.php` → sin `config.php` arranca en **modo local**: SQLite en `servidor/datos/`, secretos generados solos, correos a `/admin/bandeja.html` y botón **«Entrar como desarrollador»** (solo modo local **y** solo desde 127.0.0.1; en producción no existe). Publicar en local escribe los JS de `web/assets/` del repo: después se hace commit como siempre.
Para crear una cuenta real de admin por consola: `php herramientas/admin-cli.php crear-admin correo@icewell.cl "Nombre"`.

### Publicar el panel (hosting compartido con PHP 8.1+)
1. Subir `web/` a `public_html/` y `servidor/` **al lado** (no adentro): `/home/usuario/servidor`. Si el hosting no deja, va dentro con su `.htaccess` (Require all denied).
2. Crear la base MySQL/MariaDB y su usuario (cPanel → Bases de datos).
3. Copiar `servidor/config.ejemplo.php` a `servidor/config.php` y completar: `url_base` (https), BD, `pepper` y `clave_cifrado` (`php -r "echo bin2hex(random_bytes(32));"` cada uno, **no cambiarlos después**), `admin_inicial`, SMTP.
4. SMTP de Google Workspace: `smtp.gmail.com`, 587, tls, usuario = la cuenta, clave = **contraseña de aplicación** (requiere verificación en dos pasos en esa cuenta).
5. Google (opcional): Google Cloud Console → Credenciales → ID de cliente OAuth «Aplicación web», origen autorizado = `url_base` → pegar en `google_client_id`.
6. Permisos de escritura para PHP en `web/assets/sitio-data.js`, `web/assets/cv-data.js`, `web/assets/vendor/cv-pdf-assets.js`, `web/assets/obras/` y `servidor/datos/`.
7. HTTPS activo (los `.htaccess` redirigen y ponen HSTS). Entrar a `/admin/`, registrarse con el correo de `admin_inicial`, confirmar el correo → queda admin. Activar 2FA. Dejar `admin_inicial` vacío.
8. Antes de abrirlo al público: «Empresa → Aniversario» → apagar el botón de vista previa y poner la fecha real de fundación.

### Lo que se estaba pasando por alto (y quedó resuelto o anotado)
- El portafolio del index estaba escrito a mano y no usaba `destacado` → ahora sale de `portada` en los datos.
- Los datos de contacto estaban copiados en ~30 lugares (incluidos los PDF) → una sola fuente.
- Las fotos nuevas no llegaban al PDF hasta correr Python → se regeneran al publicar.
- Los `// revisar` se habrían perdido al generar `cv-data.js` → campo `revisar`.
- Los logos de socios estaban duplicados a mano para la marquesina → se duplican solos.
- Faltaban: texto alternativo de las fotos, SEO editable, redes sociales, fotos del equipo (sin foto se ven las iniciales), respaldos al publicar, historial, papelera (ocultar), concurrencia entre dos editores, auditoría y 2FA.
- Pendiente de decidir: dominio definitivo (icewell.net vs icewell.cl) y migración desde Wix; respaldo periódico de la BD (cPanel → copias de seguridad).

## Docker (02-oct)

Todo el proyecto (sitio + panel + MariaDB) corre en Docker; detalle completo y **prompt listo para el Claude que publique en el servidor nuevo**: [`DESPLIEGUE-DOCKER.md`](DESPLIEGUE-DOCKER.md).
- PC: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` → http://localhost:8080 (panel con «Entrar como desarrollador», correos a la bandeja de prueba, código montado).
- Servidor: `.env` desde `.env.ejemplo` → `docker compose --profile https up -d --build` (Caddy saca el certificado HTTPS solo).
- Configuración por variables `ICEWELL_*` (o `*_FILE` para Docker secrets); `servidor/config.php` sigue sirviendo para un hosting compartido.
- Al arrancar, el contenedor migra la BD y **re-publica la última versión publicada** (`admin-cli.php republicar`): los JS del sitio salen de la BD, no hace falta volumen para ellos. Volúmenes: BD, fotos subidas y `servidor/datos`.
- Detrás de un proxy: `ICEWELL_PROXIES_CONFIABLES` acepta rangos CIDR; `X-Forwarded-Proto/For` solo se creen si vienen de ahí (si no, cualquiera podría fingir https o su IP).
- «Entrar como desarrollador» en Docker: solo con `ICEWELL_ENTORNO=local` **y** `ICEWELL_DESARROLLADOR=1`, y el puerto publicado solo en 127.0.0.1. En producción se ignora (probado).
- Verificado en este entorno: stack completo con MariaDB, flujo del editor en Chromium (editar, subir foto, publicar), producción (redirección a https, cookie `__Host-` Secure, sin botón de desarrollador, contenido que sobrevive a recrear el contenedor). ⚠ La red de la sesión de prueba bloquea los repositorios de Debian, así que el paso `apt-get` del `Dockerfile` (receta oficial de la imagen `php`) se reemplazó por una imagen de prueba con las mismas extensiones; en una PC o servidor normal el `Dockerfile` se construye tal cual.

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
- **Con filtro, todas las obras como tarjeta** en una grilla ("14 obras · Industrial"), sin lista aparte. Sin filtro: "Obras destacadas y recientes" = **las obras con foto** + "Trayectoria" en lista con **todas** las obras (regla de Manuel, 02-oct: una obra con foto sale en los dos lados; sin foto, solo en Trayectoria; si después se le agrega foto, pasa a estar en los dos). Igual en ambos PDF y en la versión presentación (su trayectoria también lista todas).
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
  - **Fotos del PDF**: van embebidas en `assets/vendor/cv-pdf-assets.js` (fuentes + logo + fotos recortadas a 3:2 en base64) porque leerlas en vivo con canvas falla con doble clic (file://). **El panel lo regenera solo al Publicar** (`servidor/lib/PdfAssets.php`, solo procesa las fotos nuevas). Sin panel: `python herramientas/build_pdf_assets.py`.
  - Muestras generadas: `proyecto/muestras-pdf/` (completo de 7 págs, Hotelería de 2 págs, Minería 2010–2013).
- **"Presentación completa"** descarga el PDF corporativo tal cual.
- **Cobertura territorial**: tocar una región filtra y baja al listado.

### Datos (`assets/cv-data.js`)

> **Desde el 02-oct `cv-data.js` lo genera el panel** (mismo formato: `const SECTORES/REGIONES/PERIODOS/PROYECTOS`). No editarlo a mano: se pisa al publicar. Los antiguos comentarios `// revisar` son ahora el campo `revisar` de cada obra (insignia "Revisar" en el panel). Campos nuevos: `id`, `portada`/`ordenPortada`/`portadaAncha`/`textoPortada` (portafolio del index), `alt`. Las obras ocultas en el panel no se publican.

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

- **Fecha real de fundación**: sigue el placeholder 2009-01-01, ahora en el panel (Empresa y contacto → Aniversario). Con esa fecha, hoy da **17 años**. El PDF solo dice "principios de 2009".
- **Dominio**: el sitio actual es icewell.net (Wix), pero todos los correos y el "Sitio web" dicen icewell.cl. El panel exige correos @icewell.cl (decisión de Manuel). Confirmar cuál será el dominio del sitio nuevo.
- Obras con nota «Revisar» en el panel (antes `// revisar` en `cv-data.js`):
  - **Sector**: Línea 7 Metro, Estaciones Metro y Metro S.A. (van como Gobierno; ¿es mejor "Transporte"?); DK Home (Retail); Casino Enjoy Pucón (Hotelería); Block La Dehesa (Oficinas); Torre del Sol (Residencial); Cerro Dominador (Industrial/energía).
  - **Región**: Aduana de Quillagua (el sitio dice Tarapacá; Quillagua está en el límite con Antofagasta); Caserones (el PDF dice Coquimbo); Soprole Rukan (sin región en el PDF).
  - **Fusión**: "Oficinas Fast Air Aeropuerto" + "Centro de Importaciones Fast Air" se unieron en una sola obra. Confirmar que sea la misma.
  - **Fotos** tomadas de Noticias del sitio: `n-sanantonio.jpg` y `n-torax.jpg` coinciden con su obra. `n-calama.jpg` quedó bien asignada a la Planta Solar CPS. `n-uc.jpg` es de otro edificio UC (Campus San Joaquín): pendiente de sacar o reemplazar.
- Cambio de idioma: fuera de alcance por ahora.
- Publicación: el sitio real está en Wix. El panel necesita un hosting con PHP (ver «Publicar el panel»): hay que mover el dominio desde Wix.

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
