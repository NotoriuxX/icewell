/* ==========================================================================
   ICEWELL — Cola de PDF en segundo plano + avisos de progreso (compartido)
   Lo usan cv.html (PDF estilo web, jsPDF) y cv-presentacion.html (PDF idéntico
   a la presentación corporativa, html2canvas + jsPDF).

   La persona sigue usando la página mientras se arma. Cada pedido es independiente;
   si se piden varios quedan "En espera" y se descargan en orden.

   API:
     PdfCola.encolar({ etiqueta, ejecutar: function(ctx){ return Promise<{ blob, nombre, paginas }> } })
       ctx.aviso(titulo, mensaje, pct)   pct 0–100, o -1 = barra indeterminada
     PdfCola.cargarScript(src) → Promise   (carga una sola vez)
     PdfCola.esperar(ms)       → Promise
   Requiere en la página: <div class="pdf-toasts" id="pdfToasts" aria-live="polite"></div>
   ========================================================================== */
(function(){
  var CSS = [
    '.pdf-toasts{position:fixed;z-index:70;left:20px;bottom:20px;display:grid;gap:10px;width:min(360px,calc(100vw - 110px));font-family:"IBM Plex Sans","Inter",Arial,sans-serif}',
    '.pdf-toast{position:relative;padding:14px 16px 16px;border:1px solid rgba(159,223,244,.32);border-radius:10px;color:#effbff;background:#082436;box-shadow:0 18px 40px rgba(2,21,33,.35),0 0 0 4px rgba(0,98,168,.18);overflow:hidden;animation:pdft-in 260ms cubic-bezier(.23,1,.32,1)}',
    '.pdf-toast--salir{animation:pdft-out 220ms cubic-bezier(.23,1,.32,1) forwards}',
    '@keyframes pdft-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
    '@keyframes pdft-out{to{opacity:0;transform:translateY(8px)}}',
    '.pdf-toast__top{display:flex;justify-content:space-between;gap:10px;color:#9fdff4;font:500 10.5px "IBM Plex Mono",monospace;letter-spacing:.1em;text-transform:uppercase}',
    '.pdf-toast__x{margin:-4px -6px 0 0;padding:2px 6px;border:0;color:#9fdff4;background:none;font-size:16px;line-height:1;cursor:pointer}',
    '.pdf-toast__x:hover{color:#fff}',
    '.pdf-toast__title{margin:8px 0 4px;font:800 21px/1 "Big Shoulders Display","Archivo",Impact,sans-serif;text-transform:uppercase;letter-spacing:-.01em}',
    '.pdf-toast__msg{margin:0;color:rgba(215,241,249,.86);font-size:13px;line-height:1.45}',
    '.pdf-toast__bar{height:4px;margin-top:12px;border-radius:4px;background:rgba(204,239,251,.16);overflow:hidden}',
    '.pdf-toast__bar i{display:block;height:100%;width:0;background:#39b2dc;transition:width 240ms cubic-bezier(.23,1,.32,1)}',
    '.pdf-toast__bar--indet i{width:35%!important;animation:pdft-indet 1.1s ease-in-out infinite}',
    '@keyframes pdft-indet{from{transform:translateX(-100%)}to{transform:translateX(300%)}}',
    '.pdf-toast__acciones{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
    '.pdf-toast__acciones[hidden]{display:none}',
    '.pdf-toast__acciones button{min-height:32px;padding:0 12px;border:1px solid rgba(204,239,251,.35);border-radius:999px;color:#fff;background:transparent;font:600 12.5px inherit;cursor:pointer}',
    '.pdf-toast__acciones button:hover{background:rgba(162,225,246,.14)}',
    '.pdf-toast--ok .pdf-toast__bar i{background:#3fc23a}',
    '.pdf-toast--error{background:#3a0d12}',
    '.pdf-toast--error .pdf-toast__top{color:#ffb3ba}',
    '.pdf-toast--espera{opacity:.78}',
    '@media (max-width:560px){.pdf-toasts{left:12px;bottom:12px;width:calc(100vw - 86px)}}',
    '@media print{.pdf-toasts{display:none!important}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  var cola = [], procesando = false;

  function esc(t){ return String(t).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function esperar(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function cargarScript(src){
    return new Promise(function(ok, falla){
      if(document.querySelector('script[data-src="' + src + '"]')) return ok();
      var s = document.createElement('script');
      s.src = src; s.dataset.src = src;
      s.onload = function(){ ok(); };
      s.onerror = function(){ s.remove(); falla(new Error('No se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
  }
  function contenedor(){
    var c = document.getElementById('pdfToasts');
    if(!c){ c = document.createElement('div'); c.id = 'pdfToasts'; c.className = 'pdf-toasts'; c.setAttribute('aria-live', 'polite'); document.body.appendChild(c); }
    return c;
  }

  // ---------- avisos ----------
  function crearAviso(job){
    var el = document.createElement('div');
    el.className = 'pdf-toast pdf-toast--espera';
    el.innerHTML = '<div class="pdf-toast__top"><span>PDF · ' + esc(job.etiqueta) + '</span><button class="pdf-toast__x" type="button" aria-label="Cerrar aviso">×</button></div>' +
      '<p class="pdf-toast__title">En espera</p><p class="pdf-toast__msg">Se armará cuando termine el anterior.</p>' +
      '<div class="pdf-toast__bar"><i></i></div><div class="pdf-toast__acciones" hidden></div>';
    el.querySelector('.pdf-toast__x').addEventListener('click', function(){ cerrarAviso(job); });
    contenedor().appendChild(el);
    job.el = el;
  }
  function aviso(job, titulo, msg, pct){
    if(!job.el) return;
    job.el.classList.remove('pdf-toast--espera');
    job.el.querySelector('.pdf-toast__title').textContent = titulo;
    job.el.querySelector('.pdf-toast__msg').textContent = msg;
    var bar = job.el.querySelector('.pdf-toast__bar');
    bar.classList.toggle('pdf-toast__bar--indet', pct < 0);
    if(pct >= 0) bar.querySelector('i').style.width = pct + '%';
  }
  function accionesAviso(job, lista){
    var cont = job.el && job.el.querySelector('.pdf-toast__acciones');
    if(!cont) return;
    cont.innerHTML = ''; cont.hidden = !lista.length;
    lista.forEach(function(a){
      var b = document.createElement('button'); b.type = 'button'; b.textContent = a[0];
      b.addEventListener('click', a[1]); cont.appendChild(b);
    });
  }
  function cerrarAviso(job){
    if(!job.el || job.el.classList.contains('pdf-toast--salir')) return;
    if(job.estado === 'espera') cola = cola.filter(function(j){ return j !== job; });   // cancelar uno en espera
    var el = job.el; el.classList.add('pdf-toast--salir');
    setTimeout(function(){ el.remove(); }, 230);
    clearTimeout(job.tCierre);
    job.el = null;
  }
  function bajarBlob(blob, nombre){
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nombre; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
  }

  // ---------- cola ----------
  function encolar(job){
    job.estado = 'espera';
    cola.push(job);
    crearAviso(job);
    procesar();
    return job;
  }
  function procesar(){
    if(procesando || !cola.length) return;
    procesando = true;
    var job = cola.shift();
    job.estado = 'corriendo';
    aviso(job, 'Preparando PDF', 'Puedes seguir usando la página. No cierres esta pestaña.', 3);
    var ctx = { aviso: function(t, m, p){ aviso(job, t, m, p); } };
    Promise.resolve().then(function(){ return job.ejecutar(ctx); })
    .then(function(res){
      job.estado = 'listo';
      bajarBlob(res.blob, res.nombre);
      aviso(job, 'Listo ✓', res.nombre + ' · ' + res.paginas + (res.paginas === 1 ? ' página' : ' páginas') + ' descargado', 100);
      if(job.el) job.el.classList.add('pdf-toast--ok');
      accionesAviso(job, [['Descargar de nuevo', function(){ bajarBlob(res.blob, res.nombre); }]]);
      job.tCierre = setTimeout(function(){ cerrarAviso(job); }, 8000);
    })
    .catch(function(err){
      console.error('[icewell pdf]', err);
      job.estado = 'error';
      aviso(job, 'No se pudo generar el PDF', 'Revisa tu conexión e inténtalo de nuevo, o usa la impresión del navegador.', 0);
      if(job.el) job.el.classList.add('pdf-toast--error');
      accionesAviso(job, [
        ['Reintentar', function(){ cerrarAviso(job); job.el = null; encolar(job); }],
        ['Usar impresión', function(){ cerrarAviso(job); window.print(); }]
      ]);
    })
    .then(function(){ procesando = false; procesar(); });
  }

  // Salir de la página a mitad corta la generación → aviso nativo del navegador
  window.addEventListener('beforeunload', function(e){
    if(procesando || cola.length){ e.preventDefault(); e.returnValue = 'El PDF todavía se está generando.'; return e.returnValue; }
  });

  window.PdfCola = { encolar: encolar, cargarScript: cargarScript, esperar: esperar, ocupado: function(){ return procesando || cola.length > 0; } };
})();
