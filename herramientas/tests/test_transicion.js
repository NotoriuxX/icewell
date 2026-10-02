/* Transición entre páginas: cortina al salir (cv / presentación / WhatsApp) y al llegar. */
const { JSDOM } = require('jsdom'); const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../web/assets/transicion.js'), 'utf8');
let fallos = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA ') + m); if(!c) fallos++; };
function pagina(url, storage){
  const dom = new JSDOM('<body><a id="cv" href="curriculum">cv</a><a id="pr" href="presentacion">p</a><a id="wa" href="https://wa.me/56964074519" target="_blank">w</a><a id="an" href="#x">a</a></body>', { url, runScripts: 'outside-only', pretendToBeVisual: true });
  if(storage) dom.window.sessionStorage.setItem('icewellTr', storage);
  dom.window.eval(src); return dom;
}
(async () => {
  let d = pagina('http://localhost/'); let c = d.window.document.querySelector('.tr-cortina');
  ok(c && !c.classList.contains('on'), 'cortina creada y oculta en carga normal');
  d.window.document.getElementById('cv').click();
  ok(c.classList.contains('on') && c.querySelector('img[src$="isotipo.svg"]'), 'clic a /curriculum → cortina con el isotipo del preloader');
  ok(d.window.sessionStorage.getItem('icewellTr') === '1', 'deja marca para la llegada');
  d = pagina('http://localhost/curriculum'); c = d.window.document.querySelector('.tr-cortina');
  d.window.document.getElementById('pr').click();
  ok(c.classList.contains('on'), 'cv → presentación: cortina');
  d = pagina('http://localhost/curriculum'); c = d.window.document.querySelector('.tr-cortina');
  d.window.document.getElementById('cv').click();
  ok(!c.classList.contains('on'), 'enlace a la misma página: sin cortina');
  d.window.document.getElementById('an').click();
  ok(!c.classList.contains('on'), 'ancla: sin cortina');
  d = pagina('http://localhost/cv.html'); c = d.window.document.querySelector('.tr-cortina');
  d.window.document.getElementById('cv').click();
  ok(!c.classList.contains('on'), 'cv.html (dirección vieja) = /curriculum: misma página, sin cortina');
  let abierta = null; d = pagina('http://localhost/'); c = d.window.document.querySelector('.tr-cortina');
  d.window.open = (u) => { abierta = { u, location: { set href(v){ abierta.va = v; } } }; return abierta; };
  d.window.document.getElementById('wa').click();
  ok(c.classList.contains('on'), 'WhatsApp: cortina');
  await new Promise(r => setTimeout(r, 1200));
  ok(abierta && abierta.va === 'https://wa.me/56964074519', 'WhatsApp: abre la pestaña con la URL');
  await new Promise(r => setTimeout(r, 700));
  ok(!c.classList.contains('on'), 'WhatsApp: cortina se retira');
  d = pagina('http://localhost/curriculum', '1'); c = d.window.document.querySelector('.tr-cortina');
  ok(c.classList.contains('ya'), 'llegada: cortina puesta desde el primer pintado');
  d.window.icewellTransicion.listo(); d.window.dispatchEvent(new d.window.Event('load'));
  await new Promise(r => setTimeout(r, 700));
  ok(!c.classList.contains('ya') && !c.classList.contains('on'), 'llegada: se retira tras load + listo()');
  process.exit(fallos ? 1 : 0);
})();
