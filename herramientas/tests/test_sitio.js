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
  ok([...d.querySelectorAll('.team-initials')].map(e => e.textContent).join() === 'AM,FM,GD,CC', 'equipo: iniciales calculadas (AM, FM, GD, CC)');
  ok(/51 obras registradas en 12 regiones/.test(texto(d.querySelector('.timeline'))), 'línea de tiempo con cifras automáticas');
  ok(d.querySelectorAll('.service-list .service-card').length === 3 && d.querySelectorAll('.method-list .method-item').length === 3, 'servicios y método desde los datos');
  ok(d.querySelector('.hero-copy h1 em').textContent === 'hace habitable', 'título del hero con énfasis');
  ok(d.querySelector('.contact-redes').hidden, 'sin redes cargadas: el bloque de redes no se muestra');
  ok([...d.querySelectorAll('a[data-wa="cotizar"]')].every(a => a.href === 'https://wa.me/56964074519?text=' + encodeURIComponent(S.empresa.wa.cotizar)), 'links de WhatsApp armados con el número y el mensaje de los datos');
}

// ---------- un dato cambiado en el panel se propaga a TODO ----------
const PARCHE = `
  ICEWELL_SITIO.empresa.telefono = '+56 2 2999 1234';
  ICEWELL_SITIO.empresa.whatsapp = '+56 9 1111 2222';
  ICEWELL_SITIO.empresa.redes.linkedin = 'https://www.linkedin.com/company/icewell';
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
  ok(!d.querySelector('.contact-redes').hidden && d.querySelector('[data-red="linkedin"]').href === 'https://www.linkedin.com/company/icewell' && d.querySelector('[data-red="instagram"]').hidden, 'redes: solo aparece la que tiene dirección');
  ok(d.title === 'Icewell · prueba', 'index: <title> desde los datos SEO');
}
{
  const { w, d, errores } = cargar('cv.html', PARCHE, ['assets/vendor/cv-pdf-assets.js', 'assets/cv-pdf-foto.js']);
  ok(!errores.length, 'cv sin errores ' + errores.join(' | '));
  ok(texto(d.querySelector('.company a[data-empresa="telefono"]')) === '+56 2 2999 1234', 'cv: teléfono nuevo en Datos de la empresa');
  ok(/2999 1234/.test(texto(d.querySelector('.print-foot'))), 'cv: teléfono nuevo en el pie de impresión');
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
