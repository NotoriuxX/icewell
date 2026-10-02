// PDF en segundo plano: genera los PDF reales vía cv.html (jsdom), captura el blob descargado,
// valida aviso/cola/progreso/error. Guarda los PDF en el scratchpad para revisarlos.
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const WEB = path.join(__dirname, '../../web');
const OUT = require('path').join(__dirname, 'salida'); require('fs').mkdirSync(OUT, { recursive: true });
let fallas = 0;
function ok(c, m){ console.log((c ? 'OK   ' : 'FAIL ') + m); if(!c) fallas++; }
const esperar = ms => new Promise(r => setTimeout(r, ms));

function abrir(hash, { fallaCarga = false } = {}){
  const html = fs.readFileSync(path.join(WEB, 'cv.html'), 'utf8')
    .replace(/<script src="(assets\/[^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(WEB, s), 'utf8') + '\n</script>')
    .replace(/<link[^>]+fonts[^>]*>/g, '');
  const ctx = { blobs: [], progreso: [], errores: [], impreso: 0 };
  const dom = new JSDOM(html, { url: 'http://localhost/cv.html?pdf=dibujo' + hash   /* el modo foto (html2canvas) se prueba en Chrome real */, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w){
      w.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){} });
      w.HTMLElement.prototype.scrollIntoView = function(){};
      w.print = () => ctx.impreso++;
      w.URL.createObjectURL = b => { ctx.blobs.push(b); return 'blob:x' + ctx.blobs.length; };
      w.URL.revokeObjectURL = () => {};
      w.addEventListener('error', e => ctx.errores.push(e.message));
      const orig = w.document.createElement.bind(w.document);
      w.document.createElement = function(tag){
        const el = orig(tag);
        if(tag === 'script'){
          Object.defineProperty(el, 'src', { set(v){ this._src = v; }, get(){ return this._src; } });
          setTimeout(() => {
            if(!el._src) return;
            if(fallaCarga){ el.onerror && el.onerror(new Error('simulada')); return; }
            try {
              w.eval(fs.readFileSync(path.join(WEB, el._src), 'utf8'));
              if(el._src === 'assets/cv-pdf.js' && !w.__envuelto){          // registrar el avance real
                w.__envuelto = true;
                const gen = w.icewellPDF.generar;
                w.icewellPDF.generar = o => gen(Object.assign({}, o, { onProgreso: p => { ctx.progreso.push(p); o.onProgreso && o.onProgreso(p); } }));
              }
              el.onload && el.onload();
            } catch(e){ ctx.errores.push('eval ' + el._src + ': ' + e.message); el.onerror && el.onerror(e); }
          }, 5);
        }
        return el;
      };
    }
  });
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return { w: dom.window, d: dom.window.document, ctx };
}
function leerBlob(w, b){
  return new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(Buffer.from(fr.result)); fr.readAsArrayBuffer(b); });
}
async function hasta(cond, ms = 20000){ const t = Date.now(); while(!cond() && Date.now() - t < ms) await esperar(20); return cond(); }

(async () => {
  // 1) un PDF por filtro: aviso aparece al instante, termina en "Listo", baja el blob
  for(const [hash, salida] of [['', 'pdf_completo.pdf'], ['#sector=hoteleria', 'pdf_hoteleria.pdf'], ['#sector=mineria&periodo=2010-2013', 'pdf_mineria.pdf'], ['#sector=logistica', 'pdf_logistica.pdf']]){
    const { w, d, ctx } = abrir(hash);
    d.querySelector(hash ? '.summary .js-pdf-proyectos' : '.js-pdf-cv').click();
    const t = d.querySelector('#pdfToasts .pdf-toast');
    ok(!!t, (hash || 'completo') + ': aviso aparece al hacer clic');
    await hasta(() => ctx.blobs.length || ctx.errores.length);
    ok(!ctx.errores.length, (hash || 'completo') + ': sin errores ' + ctx.errores.join(' | '));
    if(!ctx.blobs.length){ ok(false, 'no hubo blob'); continue; }
    const buf = await leerBlob(w, ctx.blobs[0]);
    fs.writeFileSync(path.join(OUT, salida), buf);
    ok(buf.slice(0, 5).toString() === '%PDF-', (hash || 'completo') + ': blob es PDF real (' + Math.round(buf.length / 1024) + ' KB)');
    ok(/Listo/.test(t.textContent) && t.classList.contains('pdf-toast--ok'), 'aviso termina en "Listo": ' + t.querySelector('.pdf-toast__msg').textContent);
    const hechas = ctx.progreso.map(p => p.hechas);
    ok(hechas.length > 2 && hechas.every((v, i) => !i || v >= hechas[i - 1]) && ctx.progreso.at(-1).etapa === 'listo', 'progreso creciente hasta "listo" (' + hechas.length + ' avisos)');
    // descargar de nuevo reusa el blob (no rearma)
    const antes = ctx.progreso.length;
    [...t.querySelectorAll('.pdf-toast__acciones button')].find(b => /de nuevo/.test(b.textContent)).click();
    ok(ctx.blobs.length === 2 && ctx.progreso.length === antes, '"Descargar de nuevo" reusa el blob');
  }

  // 2) cola: 2 pedidos seguidos + cambiar filtro durante la generación
  {
    const { w, d, ctx } = abrir('#sector=hoteleria');
    d.querySelector('.summary .js-pdf-proyectos').click();
    d.querySelector('.chip[data-group="sector"][data-id="mineria"]').click();   // cambia filtro mientras corre
    d.querySelector('.chip[data-group="sector"][data-id="hoteleria"]').click();
    d.querySelector('.summary .js-pdf-proyectos').click();                                // segundo pedido: solo minería
    const avisos = d.querySelectorAll('#pdfToasts .pdf-toast');
    ok(avisos.length === 2 && /En espera/.test(avisos[1].textContent), 'cola: 2 avisos, el segundo "En espera"');
    ok(d.querySelectorAll('.card, .row').length === 9, 'render() sigue funcionando durante la generación (minería = 9)');
    await hasta(() => ctx.blobs.length === 2 || ctx.errores.length);
    const n1 = (await leerBlob(w, ctx.blobs[0])).length, n2 = ctx.blobs[1] ? (await leerBlob(w, ctx.blobs[1])).length : 0;
    ok(ctx.blobs.length === 2 && n1 !== n2, 'cola: 2 PDF distintos descargados en orden (' + Math.round(n1/1024) + ' KB / ' + Math.round(n2/1024) + ' KB)');
    ok(/hoteleria/.test(avisos[0].textContent) || /Hotelería/.test(avisos[0].textContent), 'el 1º conserva la foto de su selección (Hotelería)');
  }

  // 2b) Descargar CV ignora el filtro activo; Descargar proyectos sin filtro = todas las obras
  {
    const { w, d, ctx } = abrir('#sector=hoteleria');
    d.querySelector('.js-pdf-cv').click();
    await hasta(() => ctx.blobs.length || ctx.errores.length);
    const t = d.querySelector('#pdfToasts .pdf-toast');
    ok(/Icewell-CV\.pdf · \d+ páginas/.test(t.textContent), 'Descargar CV con filtro activo = CV completo: ' + t.querySelector('.pdf-toast__msg').textContent);
  }
  {
    const { w, d, ctx } = abrir('');
    d.querySelector('.summary .js-pdf-proyectos').click();
    await hasta(() => ctx.blobs.length || ctx.errores.length);
    const t = d.querySelector('#pdfToasts .pdf-toast');
    ok(/Icewell-CV\.pdf/.test(t.textContent) && ctx.progreso.at(-1).total === w.eval("PROYECTOS.length"), 'Descargar proyectos sin filtro = CV completo (todas las obras): ' + t.querySelector('.pdf-toast__msg').textContent);
  }

  // 3) error de carga → aviso de error con Reintentar / Usar impresión
  {
    const { d, ctx } = abrir('#sector=salud', { fallaCarga: true });
    d.querySelector('.summary .js-pdf-proyectos').click();
    const t = d.querySelector('#pdfToasts .pdf-toast');
    await hasta(() => t.classList.contains('pdf-toast--error'), 5000);
    ok(t.classList.contains('pdf-toast--error'), 'falla de carga → aviso de error');
    const imp = [...t.querySelectorAll('button')].find(b => /impresi/.test(b.textContent));
    imp && imp.click();
    ok(ctx.impreso === 1, '"Usar impresión" llama window.print');
  }

  console.log(fallas ? `\n${fallas} FALLAS` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();
