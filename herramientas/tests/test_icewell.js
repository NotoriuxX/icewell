const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const WEB = path.join(__dirname, '../../web');
let fallas = 0;
function ok(cond, msg){ console.log((cond ? 'OK   ' : 'FAIL ') + msg); if(!cond) fallas++; }

// Carga la página con scripts locales inline (jsdom no lee file:// relativos sin resources)
function cargar(archivo, query, hash){
  let html = fs.readFileSync(path.join(WEB, archivo), 'utf8');
  html = html.replace(/<script src="(assets\/[^"]+)"><\/script>/g, (m, src) =>
    '<script>' + fs.readFileSync(path.join(WEB, src), 'utf8') + '\n</script>');
  html = html.replace(/<link[^>]+fonts[^>]*>/g, '');
  const errores = [];
  const dom = new JSDOM(html, {
    url: 'http://localhost/' + archivo + (query || '') + (hash || ''),
    runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w){
      w.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
      w.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function(){};
      w.print = () => { w.__printed = (w.__printed || 0) + 1; };
      w.addEventListener('error', e => errores.push(e.message));
    }
  });
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return { dom, w: dom.window, d: dom.window.document, errores };
}

// ---------------- index.html ----------------
{
  const { w, d, errores } = cargar('index.html', '?hoy=2026-09-27');
  ok(!errores.length, 'index sin errores JS ' + errores.join(' | '));
  ok(w.icewellAniversario && w.icewellAniversario.anios === 17, 'index: años = 17 (2026-09-27, fundación 2009-01-01)');
  const vl = d.querySelector('.vertical-label [data-anios]');
  ok(vl && vl.textContent === '17', 'vertical-label rellena años');
  const hero = d.querySelector('.hero-metrics [data-anios]');
  ok(hero && hero._countParts && hero._countParts.target === 17, 'contador hero apunta a 17 (rellenado antes de statParts)');
  const m2 = [...d.querySelectorAll('.hero-metrics .js-count')].map(e => e._countParts && e._countParts.target);
  ok(m2.includes(51) && m2.includes(170000), 'cifras PDF 51 y 170.000 en hero: ' + m2.join(','));
  ok(!/\+150|400k|400\.000/.test(d.body.innerHTML), 'sin cifras viejas (+150 / 400k)');
  ok(d.querySelector('.wa-float svg path') && !d.querySelector('.whatsapp-float'), 'WhatsApp flotante nuevo presente');
  ok(d.querySelectorAll('a[href="cv.html"]').length >= 4, 'links a cv.html (nav, menú móvil, footer, CTA)');
  ok(d.querySelectorAll('.sector-links a[href^="cv.html#sector="]').length === 10, '10 links de sector al CV');
  ok(!d.documentElement.classList.contains('aniversario'), 'sin tema aniversario el 27-sep');
}
{
  const { w, d } = cargar('index.html', '?hoy=2027-01-05');
  ok(w.icewellAniversario.anios === 18, 'hoy=2027-01-05 → 18 años');
  ok(d.documentElement.classList.contains('aniversario'), 'hoy=2027-01-05 → tema aniversario activo');
  ok(!!d.querySelector('.aniv-modal-overlay') || d.readyState !== 'complete', 'modal aniversario (o diferido a load)');
}
{
  const { d } = cargar('index.html', '?hoy=2027-02-02');
  ok(!d.documentElement.classList.contains('aniversario'), 'hoy=2027-02-02 → sin tema (pasó el mes)');
}
{
  const { d } = cargar('index.html', '?aniversario=1');
  ok(d.documentElement.classList.contains('aniversario'), '?aniversario=1 fuerza tema');
  const b = d.querySelector('.aniv-switch button');
  ok(b && /^Aniversario · \d+ años$/.test(b.textContent) && b.getAttribute('aria-pressed') === 'true', 'botón "Aniversario · N años" visible y marcado: ' + (b && b.textContent));
}
{
  const { d } = cargar('index.html', '?hoy=2026-09-27');
  const b = d.querySelector('.aniv-switch button');
  ok(b && b.getAttribute('aria-pressed') === 'false', 'botón visible siempre (sin parámetros), apagado fuera del mes');
  b.click();
  ok(d.documentElement.classList.contains('aniversario') && b.getAttribute('aria-pressed') === 'true', 'clic en el botón → tema aniversario activo');
  b.click();
  ok(!d.documentElement.classList.contains('aniversario'), 'segundo clic → vuelve a normal');
}
{
  const { d } = cargar('index.html', '?preview=0');
  ok(!d.querySelector('.aniv-switch'), '?preview=0 oculta el botón');
}
for(const pag of ['cv.html', 'cv-presentacion.html']){
  const { d } = cargar(pag, '');
  ok(!!d.querySelector('.aniv-switch button'), pag + ': también tiene el botón de aniversario');
}

// ---------------- cv.html ----------------
{
  const { w, d, errores } = cargar('cv.html');
  ok(!errores.length, 'cv sin errores JS ' + errores.join(' | '));
  const total = w.eval('PROYECTOS.length');
  // regla: tarjetas = obras con foto; Trayectoria = TODAS (con y sin foto)
  const nFoto = w.eval('PROYECTOS.filter(p=>p.foto).length');
  const nCards = d.querySelectorAll('.card').length, nRows = d.querySelectorAll('.row').length;
  ok(nRows === total && nCards === nFoto, 'sin filtro: ' + nCards + ' tarjetas (con foto) + Trayectoria con todas ' + nRows + '/' + total);
  ok(!d.querySelector('.card--solid'), 'sin filtro ninguna tarjeta sin foto');
  ok(d.querySelector('.kpi [data-anios]').textContent === String(w.icewellAniversario.anios), 'KPI años automático');
  // sin nombres duplicados
  const nombres = w.eval('PROYECTOS.map(p=>p.nombre)');
  ok(new Set(nombres).size === nombres.length, 'sin proyectos duplicados');
  // todo sector/región referenciado existe
  const malos = w.eval(`PROYECTOS.filter(p=>p.sectores.some(s=>!SECTORES.find(x=>x.id===s))||p.regiones.some(r=>!REGIONES.find(x=>x.id===r))).map(p=>p.nombre)`);
  ok(!malos.length, 'ids de sector/región válidos ' + malos.join(','));
  // cada sector tiene al menos 1 obra
  const vacios = w.eval(`SECTORES.filter(s=>!PROYECTOS.some(p=>p.sectores.includes(s.id))).map(s=>s.id)`);
  ok(!vacios.length, 'todos los sectores tienen obras ' + vacios.join(','));

  // clic en Hotelería
  const chip = d.querySelector('.chip[data-group="sector"][data-id="hoteleria"]');
  chip.click();
  const esperados = w.eval(`PROYECTOS.filter(p=>p.sectores.includes('hoteleria')).map(p=>p.nombre).sort()`);
  const vistos = [...d.querySelectorAll('.card h3, .row h4')].map(e => e.textContent).sort();
  ok(JSON.stringify(vistos) === JSON.stringify(esperados), 'Hotelería filtra exacto: ' + vistos.join(' | '));
  ok(w.location.hash === '#sector=hoteleria', 'hash actualizado: ' + w.location.hash);
  ok(d.body.classList.contains('has-filter'), 'body.has-filter (PDF enfocado)');
  ok(/Hotelería/.test(d.getElementById('printFilter').textContent), 'encabezado PDF dice el filtro: ' + d.getElementById('printFilter').textContent);
  ok(d.querySelector('.chip[data-id="hoteleria"]').getAttribute('aria-pressed') === 'true', 'chip queda activo tras re-render');

  // + Minería (OR dentro del grupo)
  d.querySelector('.chip[data-group="sector"][data-id="mineria"]').click();
  const orN = w.eval(`PROYECTOS.filter(p=>p.sectores.includes('hoteleria')||p.sectores.includes('mineria')).length`);
  ok(d.querySelectorAll('.card, .row').length === orN, 'Hotelería + Minería = OR (' + orN + ')');

  // + período (AND entre grupos)
  d.querySelector('.chip[data-group="periodo"][data-id="2010-2013"]').click();
  const andN = w.eval(`PROYECTOS.filter(p=>(p.sectores.includes('hoteleria')||p.sectores.includes('mineria'))&&p.anio>=2010&&p.anio<=2013).length`);
  ok(d.querySelectorAll('.card, .row').length === andN, '+ 2010–2013 = AND (' + andN + ')');

  // imprimir
  const titulo = d.title;
  d.querySelector('.summary .js-pdf-proyectos').click();
  ok(d.querySelector('#pdfToasts .pdf-toast') && /PDF · CV · Hotelería/.test(d.getElementById('pdfToasts').textContent), 'botón PDF abre aviso en segundo plano (detalle en test_pdf.js)');

  // limpiar
  d.getElementById('clearBtn').click();
  ok(d.querySelectorAll('.row').length === total && !d.body.classList.contains('has-filter'), 'limpiar vuelve a todas');

  // búsqueda
  const inp = d.getElementById('searchInput');
  inp.value = 'leed'; inp.dispatchEvent(new w.Event('input'));
  await_(() => {
    const leed = w.eval(`PROYECTOS.filter(p=>/leed/i.test(p.sistemas+p.tags.join())).length`);
    ok(d.querySelectorAll('.card, .row').length === leed, 'buscar "leed" → ' + leed);
  });

  // cobertura → filtra región
  setTimeout(() => {
    d.getElementById('clearBtn').click();
    d.querySelector('.chip[data-cobertura="atacama"]').click();
    const at = w.eval(`PROYECTOS.filter(p=>p.regiones.includes('atacama')).length`);
    ok(d.querySelectorAll('.card, .row').length === at && w.location.hash === '#region=atacama', 'cobertura Atacama → ' + at + ' ' + w.location.hash);
  }, 400);
}
function await_(fn){ setTimeout(fn, 300); }

// deep-link desde el index
{
  const { d, w } = cargar('cv.html', '', '#sector=mineria');
  const n = w.eval(`PROYECTOS.filter(p=>p.sectores.includes('mineria')).length`);
  ok(d.querySelectorAll('.card, .row').length === n, 'abrir cv.html#sector=mineria filtra al cargar (' + n + ')');
  ok(d.querySelector('.chip[data-id="mineria"]').getAttribute('aria-pressed') === 'true', 'chip Minería activo al cargar');
}
{
  const { d } = cargar('cv.html', '', '#sector=inventado&periodo=xx');
  ok(!d.body.classList.contains('has-filter'), 'hash con ids inválidos se ignora');
}

setTimeout(() => { console.log(fallas ? `\n${fallas} FALLAS` : '\nTODO OK'); process.exit(fallas ? 1 : 0); }, 900);
