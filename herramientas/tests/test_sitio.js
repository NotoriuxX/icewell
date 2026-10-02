// Datos del sitio en un solo lugar (assets/sitio-data.js + sitio-render.js):
// un cambio en ICEWELL_SITIO se propaga al index, al CV, a la presentación y a los PDF;
// el texto del panel nunca se interpreta como HTML; la portada sale de los datos.
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const WEB = path.join(__dirname, '../../web');
let fallas = 0;
function ok(c, m){ console.log((c ? 'OK   ' : 'FAIL ') + m); if(!c) fallas++; }

// parche: JS que corre justo después de sitio-data.js (simula lo que publicaría el panel)
function cargar(archivo, parche, extra){
  let html = fs.readFileSync(path.join(WEB, archivo), 'utf8')
    .replace(/<script src="(assets\/[^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(WEB, s), 'utf8') + '\n</script>' +
      (s === 'assets/sitio-data.js' && parche ? '<script>' + parche + '</script>' : ''))
    .replace(/<link[^>]+fonts[^>]*>/g, '');
  if(extra) html = html.replace('</body>', extra.map(s => '<script>' + fs.readFileSync(path.join(WEB, s), 'utf8') + '\n</script>').join('') + '</body>');
  const errores = [];
  const dom = new JSDOM(html, { url: 'http://localhost/' + archivo, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w){
      w.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
      w.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
      w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function(){};
      w.addEventListener('error', e => errores.push(e.message));
    } });
  return { w: dom.window, d: dom.window.document, errores };
}
const texto = n => n ? n.textContent.replace(/\s+/g, ' ').trim() : '';

// ---------- index: lo que antes estaba escrito a mano ahora sale de los datos ----------
{
  const { w, d, errores } = cargar('index.html');
  ok(!errores.length, 'index sin errores ' + errores.join(' | '));
  const S = w.ICEWELL_SITIO;
  const cards = [...d.querySelectorAll('.project-grid .project-card')];
  const port = w.eval('PROYECTOS.filter(p=>p.portada&&p.foto).sort((a,b)=>a.ordenPortada-b.ordenPortada).map(p=>p.nombre)');
  ok(cards.length === port.length && cards.length === 6, 'portada: ' + cards.length + ' tarjetas desde los datos');
  ok(JSON.stringify(cards.map(c => c.querySelector('h3').textContent)) === JSON.stringify(port), 'portada en el orden de ordenPortada');
  ok(cards.filter(c => c.classList.contains('project-card--wide')).length === 1 && /Debaines/.test(d.querySelector('.project-card--wide h3').textContent), 'Hotel Debaines sigue siendo la tarjeta ancha');
  ok(cards.every(c => c.querySelector('img').getAttribute('src').startsWith('assets/')), 'cada tarjeta de portada tiene foto');
  ok(d.querySelectorAll('.marquee-track img').length === S.inicio.socios.length * 2, 'socios: la marquesina se duplica sola (' + d.querySelectorAll('.marquee-track img').length + ')');
  ok(d.querySelectorAll('.marquee-track img[aria-hidden="true"]').length === S.inicio.socios.length, 'la copia de la marquesina va oculta a lectores de pantalla');
  { // iniciales solo para quien no tiene foto (hoy: Andrés Mora → AM)
    const ini = n => n.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
    const esperadas = S.inicio.equipo.filter(x => !x.foto).map(x => ini(x.nombre)).join();
    ok([...d.querySelectorAll('.team-initials')].map(e => e.textContent).join() === esperadas, 'equipo: iniciales para quien no tiene foto (' + esperadas + ')');
  }
  // Diseño 2 (02-oct): lema, 4 cifras en el hero y las 4 vistas del equipo desde los mismos datos
  ok(/^Somos confianza y profesionalismo para tus proyectos de climatización\.$/.test(texto(d.querySelector('h1'))), 'hero: el lema nuevo en el h1');
  ok(/ágil y responsable/.test(texto(d.querySelector('.hero-lead'))), 'hero: la bajada');
  ok(d.querySelectorAll('.hero-metrics .js-count').length === 4 && d.querySelector('.hero-metrics [data-cifra="regiones"]'), 'hero: 4 cifras (años, obras, regiones, m²)');
  ok(!/150\+|\+150|400\.000|100%/.test(d.querySelector('main').textContent), 'sin las cifras no verificadas del diseño original (150+, 400.000, 100%)');
  const nombres = sel => [...d.querySelectorAll(sel)].map(e => e.textContent).join();
  const equipo = 'Andrés Mora,Flavio Magnasco,Gonzalo Díaz W.,José Castillo';
  ok(nombres('.team-grid h3') === equipo, 'equipo · Grid: ' + nombres('.team-grid h3'));
  ok(nombres('.org-chart h4') === equipo && d.querySelectorAll('.org-row .org-card').length === 3, 'equipo · Organigrama: CEO arriba y 3 abajo');
  ok(nombres('.photo-cards h4') === equipo, 'equipo · Fotos');
  ok(nombres('.exec-list h4') === equipo, 'equipo · Lista ejecutiva');
  ok(!/Cristian Castro/.test(d.body.textContent), 'Cristian Castro ya no aparece');
  ok([...d.querySelectorAll('.org-chart [data-edit], .photo-cards [data-edit], .exec-list [data-edit]')].every(e => /^inicio\.equipo\.\d$/.test(e.dataset.edit)), 'cada ficha de las 4 vistas lleva al campo de esa persona en el panel');
  ok(d.querySelectorAll('.org-areas [data-t^="equipo.area"]').length === 6, 'organigrama: 3 áreas editables');
  // pestañas: una visible a la vez
  const vistas = () => [...d.querySelectorAll('.team-view')].filter(v => !v.hidden).map(v => v.id).join();
  ok(vistas() === 'vista-grid', 'pestañas: arranca en Grid');
  d.getElementById('tab-fotos').click();
  ok(vistas() === 'vista-fotos' && d.getElementById('tab-fotos').getAttribute('aria-selected') === 'true', 'pestañas: clic en Fotos muestra solo Fotos');
  // con foto: la foto aparece en las 4 vistas
  {
    const { d: d2 } = cargar('index.html', 'ICEWELL_SITIO.inicio.equipo[1].foto = "obras/flavio.webp";');
    ok(['.team-grid', '.org-chart', '.photo-cards', '.exec-list'].every(s => d2.querySelector(s + ' img[src="assets/obras/flavio.webp"]')), 'una foto de equipo se ve en las 4 vistas');
  }
  // hitos y "por qué" sin texto: no quedan h3/p vacíos
  ok(![...d.querySelectorAll('.timeline-item h3, .method-item p')].length, 'hitos sin título y puntos sin texto: sin elementos vacíos');
  ok(/51 obras registradas en 12 regiones/.test(texto(d.querySelector('.timeline'))), 'línea de tiempo con cifras automáticas');
  ok(d.querySelectorAll('.service-list .service-card').length === 3 && d.querySelectorAll('.method-list .method-item').length === 3, 'servicios y método desde los datos');
  ok(d.querySelector('.hero-section h1 em').textContent === 'confianza y profesionalismo', 'título del hero con énfasis (lema)');
  ok(!d.querySelector('[data-red], [data-redes], .contact-redes, .footer-redes'), 'sin redes sociales en el index (pedido Manuel 02-oct)');
  const acc = d.querySelectorAll('.contact-actions > a, .contact-actions > button');
  ok(acc.length === 2 && !d.querySelector('.contact-actions a[href^="mailto:"]') && d.querySelector('.contact-actions [data-abrir-formulario]').classList.contains('btn-ghost-light'), 'Contacto: 2 botones (WhatsApp + formulario con el estilo claro), sin el de correo');
  const mapa = d.querySelector('.contact-data a[data-mapa]');
  const dirMapa = [S.empresa.direccion, S.empresa.comuna, S.empresa.ciudad, S.empresa.pais].filter(Boolean).join(', ');
  ok(mapa && mapa.href === 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dirMapa) && mapa.target === '_blank', 'Dirección abre Google Maps «cómo llegar»');
  ok(!d.querySelector('.footer-form, .footer-acciones') && d.querySelector('.site-footer .footer-legal .credito'), 'pie en una barra: sin botón de formulario, con el crédito');
  ok([...d.querySelectorAll('a[data-wa="cotizar"]')].every(a => a.href === 'https://wa.me/56964074519?text=' + encodeURIComponent(S.empresa.wa.cotizar)), 'links de WhatsApp armados con el número y el mensaje de los datos');
}

// ---------- formulario «Cuéntanos tu proyecto», LinkedIn, crédito y menú ----------
(async () => {
  const { w, d, errores } = cargar('index.html');
  ok(!errores.length, 'index (formulario) sin errores ' + errores.join(' | '));
  // crédito (las redes de la empresa se sacaron del sitio)
  const cred = d.querySelector('.site-footer .credito a');
  ok(cred && cred.textContent === 'Manuel Mery' && cred.href === 'https://www.linkedin.com/in/manuel-mery-413874119/' && cred.rel === 'noopener', 'crédito «Diseño y desarrollo: Manuel Mery» con su LinkedIn');
  // menú: Currículum destacado y marca de la sección al tocar un enlace
  ok(d.querySelector('.desktop-nav a.nav-cv[href="curriculum"]'), 'Currículum destacado en el menú');
  d.querySelector('.desktop-nav a[href="#equipo"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  ok(d.querySelector('.desktop-nav a[href="#equipo"]').classList.contains('activo') && d.querySelector('.desktop-nav a[href="#equipo"]').getAttribute('aria-current') === 'true'
    && !d.querySelector('.desktop-nav a[href="#nosotros"]').classList.contains('activo'), 'menú: la sección elegida queda marcada (aria-current)');
  // formulario
  const botones = d.querySelectorAll('[data-abrir-formulario]');
  ok(botones.length === 1 && botones[0].closest('.contact-actions') && botones[0].textContent.trim() === 'Cuéntanos tu proyecto', 'botón «Cuéntanos tu proyecto» solo en Contacto (se sacó del pie)');
  botones[0].click();
  const cf = d.getElementById('formularioContacto');
  ok(cf && !cf.hidden && cf.getAttribute('role') === 'dialog' && cf.getAttribute('aria-modal') === 'true', 'abre un diálogo modal');
  const visible = () => cf.querySelector('.cf__paso:not([hidden])').getAttribute('data-paso');
  const sig = () => cf.querySelector('.cf__form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  ok(visible() === '1' && /Paso 1 de 5/.test(cf.querySelector('#cfProgreso').textContent), 'paso 1 de 5: nombre');
  sig();
  ok(visible() === '1' && /nombre/.test(d.getElementById('cfError').textContent), 'sin nombre no avanza y avisa');
  cf.querySelector('#cfNombre').value = 'María <b>Pérez</b>'; sig();
  ok(visible() === '2' && cf.querySelector('.cf__nombre').textContent === 'María' && !cf.querySelector('.cf__nombre b'), 'paso 2 saluda por el nombre (como texto)');
  cf.querySelector('#cfCorreo').value = 'maria@'; sig();
  ok(visible() === '2' && cf.querySelector('#cfCorreo').getAttribute('aria-invalid') === 'true', 'correo mal escrito no avanza');
  cf.querySelector('#cfCorreo').value = 'maria@constructora.cl'; sig();
  ok(visible() === '3' && cf.querySelectorAll('input[name="tipo"]').length === 4, 'paso 3: 4 opciones');
  sig();
  ok(visible() === '3', 'sin elegir opción no avanza');
  const op = cf.querySelector('input[value="mantencion"]'); op.checked = true; op.dispatchEvent(new w.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  ok(visible() === '4', 'elegir una opción avanza sola');
  cf.querySelector('#cfMensaje').value = 'Corto'; sig();
  ok(visible() === '4', 'mensaje muy corto no avanza');
  cf.querySelector('#cfMensaje').value = 'Mantención de 3 chillers <img src=x onerror=alert(1)> en Providencia.'; sig();
  ok(visible() === '5', 'paso 5: resumen');
  const res = k => cf.querySelector('[data-resumen="' + k + '"]').textContent;
  ok(res('tipo') === 'Mantención' && /<img src=x/.test(res('mensaje')) && !cf.querySelector('.cf__resumen img') && res('telefono') === '—', 'el resumen muestra lo escrito como texto (sin HTML)');
  // envío
  let pedido = null;
  w.fetch = (url, op) => { pedido = { url, op }; return Promise.resolve({ status: 200, json: () => Promise.resolve({ ok: true }) }); };
  sig(); await new Promise(r => setTimeout(r, 50));
  const cuerpo = pedido && JSON.parse(pedido.op.body);
  ok(pedido && pedido.url === 'api/?r=contacto' && pedido.op.headers['X-Requested-With'] === 'icewell' && cuerpo.tipo === 'mantencion' && cuerpo.web === '' && typeof cuerpo.ms === 'number', 'envía a api/?r=contacto con la cabecera, la trampa y el tiempo');
  ok(visible() === 'fin' && /maria@constructora\.cl/.test(cf.querySelector('.cf__fin-texto').textContent), 'pantalla de «¡Listo!»');
  cf.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok(cf.hidden, 'Esc cierra');
  // sin servidor: respaldo por correo / WhatsApp con todo escrito
  botones[0].click();
  ok(visible() === '1' && cf.querySelector('#cfNombre').value === '', 'después de enviar, uno nuevo empieza de cero');
  cf.querySelector('#cfNombre').value = 'Pedro'; sig(); cf.querySelector('#cfCorreo').value = 'pedro@x.cl'; sig();
  const o2 = cf.querySelector('input[value="otro"]'); o2.checked = true; o2.dispatchEvent(new w.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  cf.querySelector('#cfMensaje').value = 'Consulta de prueba sin servidor.'; sig();
  w.fetch = () => Promise.reject(new Error('red'));
  sig(); await new Promise(r => setTimeout(r, 50));
  const mail = cf.querySelector('#cfAltCorreo').getAttribute('href');
  ok(visible() === 'alt' && mail.startsWith('mailto:contacto@icewell.cl?') && decodeURIComponent(mail).includes('Consulta de prueba sin servidor.') && cf.querySelector('#cfAltWa').href.startsWith('https://wa.me/'), 'sin servidor: ofrece correo y WhatsApp con lo escrito');
})().then(() => {
// ---------- un dato cambiado en el panel se propaga a TODO ----------
const PARCHE = `
  ICEWELL_SITIO.empresa.telefono = '+56 2 2999 1234';
  ICEWELL_SITIO.empresa.whatsapp = '+56 9 1111 2222';
  ICEWELL_SITIO.empresa.direccion = 'Av. Prueba 99';
  ICEWELL_SITIO.cifras.obras = '77';
  ICEWELL_SITIO.textos['hero.lead'] = 'Texto nuevo <img src=x onerror="window.__xss=1"> con *énfasis*';
  ICEWELL_SITIO.textos['cv.titulo'] = 'Título <b>raro</b> *HVAC.*';
  ICEWELL_SITIO.seo.titulo = 'Icewell · prueba';
`;
{
  const { w, d } = cargar('index.html', PARCHE);
  ok(texto(d.querySelector('.contact-data a[data-empresa="telefono"]')) === '+56 2 2999 1234' && d.querySelector('a[data-empresa="telefono"]').getAttribute('href') === 'tel:+56229991234', 'index: teléfono nuevo (texto y tel:)');
  ok([...d.querySelectorAll('a[data-wa]')].every(a => a.href.startsWith('https://wa.me/56911112222')), 'index: todos los WhatsApp con el número nuevo');
  ok(d.querySelectorAll('[data-cifra="obras"]').length === 2 && [...d.querySelectorAll('[data-cifra="obras"]')].every(e => /77/.test(e.textContent) || (e._countParts && e._countParts.target === 77)), 'index: cifra de obras nueva en hero y banda');
  ok(/77 obras registradas/.test(texto(d.querySelector('.timeline'))), 'index: {obras} dentro de un texto también cambia');
  const lead = d.querySelector('.hero-lead');
  ok(!lead.querySelector('img') && /<img src=x/.test(lead.textContent) && !w.__xss, 'XSS: un texto con HTML se muestra como texto, no se ejecuta');
  ok(lead.querySelector('em') && lead.querySelector('em').textContent === 'énfasis', 'formato *énfasis* sí funciona');
  ok(d.querySelector('a[data-mapa]').href.includes(encodeURIComponent('Av. Prueba 99')), 'index: el enlace a Maps sigue la dirección nueva');
  ok(d.title === 'Icewell · prueba', 'index: <title> desde los datos SEO');
}
{
  const { w, d, errores } = cargar('cv.html', PARCHE, ['assets/vendor/cv-pdf-assets.js', 'assets/cv-pdf-foto.js']);
  ok(!errores.length, 'cv sin errores ' + errores.join(' | '));
  ok(texto(d.querySelector('.company a[data-empresa="telefono"]')) === '+56 2 2999 1234', 'cv: teléfono nuevo en Datos de la empresa');
  ok(/2999 1234/.test(texto(d.querySelector('.print-foot'))), 'cv: teléfono nuevo en el pie de impresión');
  ok(!d.querySelector('[data-red], [data-redes]') && d.querySelector('.company a[data-mapa]').href.includes(encodeURIComponent('Av. Prueba 99')), 'cv: sin fila LinkedIn y la dirección abre Maps con la dirección nueva');
  ok(d.querySelector('.cover h1 em').textContent === 'HVAC.' && !d.querySelector('.cover h1 b') && /<b>raro<\/b>/.test(d.querySelector('.cover h1').textContent), 'cv: título con énfasis y sin HTML colado');
  ok(d.title !== 'Icewell · prueba', 'cv: el SEO del index no pisa el <title> del CV');
  // PDF modo foto: se arma con los mismos datos
  const cont = d.createElement('div'); d.body.appendChild(cont);
  const SEC = {}, REG = {};
  w.eval('SECTORES').forEach(s => SEC[s.id] = s.label); w.eval('REGIONES').forEach(r => REG[r.id] = r.label);
  const hojas = w.icewellPdfFoto.construir(cont, { lista: w.eval('PROYECTOS.slice()'), seleccion: '', SEC, REG, anios: 17, desde: 2009 });
  const todo = texto(cont);
  ok(hojas.length > 1 && /2999 1234/.test(todo) && !/2847 0610/.test(todo), 'PDF (foto): teléfono nuevo y ninguno viejo');
  ok(/77/.test(texto(cont.querySelector('.wh-kpis'))), 'PDF (foto): cifra de obras nueva');
  ok(!cont.querySelector('.wh-hero h1 b') && cont.querySelector('.wh-hero h1 em'), 'PDF (foto): título escapado, con énfasis');
  ok(cont.querySelectorAll('.wh-card').length === w.eval('PROYECTOS.filter(p=>p.foto).length'), 'PDF (foto): tarjetas = obras con foto');
  ok(cont.querySelectorAll('.wh-fila').length === w.eval('PROYECTOS.length'), 'PDF (foto): Trayectoria con todas las obras');
}
{
  const { w, d, errores } = cargar('cv-presentacion.html', PARCHE);
  ok(!errores.length, 'presentación sin errores ' + errores.join(' | '));
  const cont = d.createElement('div'); d.body.appendChild(cont);
  w.icewellPresentacion.construir(cont, 'cv', { sector: new Set(), periodo: new Set(), region: new Set(), q: '' });
  const todo = texto(cont);
  ok(/2999 1234/.test(todo) && !/2847 0610/.test(todo), 'presentación: teléfono nuevo en la hoja de datos');
  ok(/77/.test(texto(cont.querySelector('.kpis'))), 'presentación: cifra de obras nueva');
  ok(cont.querySelectorAll('.fila').length === w.eval('PROYECTOS.length'), 'presentación: Trayectoria con todas las obras (paridad con cv.html)');
  ok(d.querySelector('.wa-float').href.startsWith('https://wa.me/56911112222?text='), 'presentación: WhatsApp flotante con el número nuevo');
}

// ---------- sin sitio-data.js el HTML escrito queda como respaldo ----------
{
  const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
  ok(/Román Díaz 1363/.test(html) && /project-card--wide/.test(html), 'index.html conserva el contenido escrito como respaldo');
}

console.log(fallas ? `\n${fallas} FALLAS` : '\nTODO OK');
process.exit(fallas ? 1 : 0);
});
