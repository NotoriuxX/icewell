// Mejoras de experiencia llevadas a cv.html (versión web)
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const WEB = 'C:/Users/MANUEL MERY/Desktop/icewell/proyecto/web';
let fallas = 0;
function ok(c, m){ console.log((c ? 'OK   ' : 'FAIL ') + m); if(!c) fallas++; }
let html = fs.readFileSync(path.join(WEB, 'cv.html'), 'utf8')
  .replace(/<script src="(assets\/[^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(WEB, s), 'utf8') + '\n</script>')
  .replace(/<link[^>]+fonts[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/cv.html', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w){ w.matchMedia = () => ({ matches: false }); w.HTMLElement.prototype.scrollIntoView = function(){ w.__subio = (w.__subio || 0) + 1; }; w.scrollTo = () => {}; } });
const w = dom.window, d = w.document;
const P = w.eval('PROYECTOS');

// sin filtro: tarjetas (foto, m² o reciente) + trayectoria en lista
const cards0 = d.querySelectorAll('#results .card').length, rows0 = d.querySelectorAll('#results .row').length;
ok(cards0 + rows0 === P.length && rows0 > 0, `sin filtro: ${cards0} tarjetas + ${rows0} filas = ${P.length}`);
ok([...d.querySelectorAll('#results [data-id]')].length === P.length, 'todas las obras llevan data-id');

// etiqueta Público/Privado según p.cliente
const malas = [...d.querySelectorAll('#results .card')].filter(c => { const p = P[+c.dataset.id]; return c.querySelector('.card-cli').textContent !== (p.cliente === 'Público' ? 'Público' : 'Privado'); });
ok(!malas.length, 'etiqueta de cada tarjeta = Público/Privado según cliente');
ok(![...d.querySelectorAll('#results .card-cli')].some(b => /ejecución/i.test(b.textContent)), '"En ejecución" ya no es etiqueta');
ok(d.querySelectorAll('#results .card-vivo').length === P.filter(p => p.estado === 'ejecucion').length, '"En ejecución" como texto en las obras en ejecución');

// con filtro: todas como tarjeta, 0 filas
d.querySelector('.chip[data-group="sector"][data-id="industrial"]').click();
const nInd = P.filter(p => p.sectores.includes('industrial')).length;
ok(d.querySelectorAll('#results .card').length === nInd && !d.querySelectorAll('#results .row').length, `Industrial: ${nInd} tarjetas y 0 filas`);
ok(/obras · Industrial/.test(d.querySelector('.result-title').textContent), 'título "N obras · Industrial": ' + d.querySelector('.result-title').textContent);
ok([...d.querySelectorAll('#results .card')].every(c => /Industrial/.test(c.querySelector('.card-content > span').textContent)), 'línea de cada tarjeta muestra el sector filtrado');

// barra fija: pastillas ×, Limpiar, Filtros ↑
const pills = d.querySelectorAll('#sumFiltros .sum-pill');
ok(pills.length === 1 && /Industrial/.test(pills[0].textContent), 'pastilla del filtro en la barra fija');
d.querySelector('.chip[data-group="region"][data-id="metropolitana"]').click();
ok(d.querySelectorAll('#sumFiltros .sum-pill').length === 2, '2 pastillas con sector + región');
d.querySelector('#sumFiltros .sum-pill[data-quitar="sector:industrial"]').click();
ok(!w.eval('1') || d.querySelectorAll('#sumFiltros .sum-pill').length === 1 && w.location.hash === '#region=metropolitana', '× quita el filtro desde la barra: ' + w.location.hash);
d.querySelector('#sumFiltros [data-subir-filtros]').click();
ok(w.__subio >= 1, '"Filtros ↑" sube a los chips');
d.querySelector('#sumFiltros [data-clear]').click();
ok(!d.body.classList.contains('has-filter') && d.querySelectorAll('#results .row').length === rows0, 'Limpiar desde la barra vuelve a todas');

// chips: número final correcto y clave para el recuento
const bInd = d.querySelector('.chip[data-id="industrial"] b');
ok(bInd.classList.contains('cnt--sube') || bInd.classList.contains('cnt--baja'), 'el número del chip se está recontando con animación (valor de paso: ' + bInd.textContent + ')');
setTimeout(() => {
  ok(bInd.dataset.k === 'sector:industrial' && +bInd.textContent === nInd, 'al terminar, chip Industrial muestra ' + bInd.textContent + ' (= ' + nInd + ')');
  console.log(fallas ? `\n${fallas} FALLAS` : '\nTODO OK'); process.exit(fallas ? 1 : 0);
}, 1200);
