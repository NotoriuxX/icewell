/* ==========================================================================
   ICEWELL — PDF de la versión web "igual a la página" (modo 'foto')
   Arma por detrás hojas A4 con el mismo lenguaje visual de cv.html (barra superior
   blanca, hero celeste con grilla, tarjetas con foto a sangre, trayectoria con año
   grande, bloque de empresa y footer oscuro con franja tricolor) y las "fotografía"
   con html2canvas → jsPDF. Mismo método que la versión presentación.

   Modo anterior (PDF dibujado con jsPDF, texto seleccionable): assets/cv-pdf.js.
   Se elige en cv.html → PDF_MODO ('foto' | 'dibujo'), o con ?pdf=dibujo en la URL.

   Requiere: jsPDF, html2canvas y CV_PDF_ASSETS (fotos/logo en data: para que
   funcione también con doble clic, sin "ensuciar" el canvas en file://).
   API: icewellPdfFoto.generar(o, ctx) → Promise<{ blob, nombre, paginas }>
     o = { lista, seleccion, SEC, REG, anios, desde, nombreArchivo }
   ========================================================================== */
(function(){
  var ESCALA = 1.6;     // resolución de la captura (1.6× se ve nítido y es ~35% más rápido que 2×)
  var CALIDAD = 0.88;   // JPEG

  var CSS = [
    '.wh-hoja{position:relative;width:794px;height:1123px;overflow:hidden;background:#f6fbfd;color:#112536;font-family:"IBM Plex Sans",Arial,sans-serif;font-size:12px}',
    '.wh-hoja *{box-sizing:border-box}',
    '.wh-hoja :where(h1,h2,h3,h4,p){margin:0}',   /* :where = especificidad 0: no pisa los márgenes de .wh-sub, .wh-lead, etc. */
    '.wh-cab{position:absolute;left:0;right:0;top:0;height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 44px;background:#fff;border-bottom:1px solid rgba(17,37,54,.1)}   /* sin sombra difusa: html2canvas la pinta como franja gris */',
    '.wh-cab img{height:23px;width:auto;display:block}',
    '.wh-cab span{color:#4b6474;font:500 9.5px "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase}',
    '.wh-pie{position:absolute;left:0;right:0;bottom:0;height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 44px;background:#062132;color:#93b7c4;font:9px "IBM Plex Mono",monospace;letter-spacing:.06em;text-transform:uppercase}',
    '.wh-pie::before{position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#0062a8 0 33.34%,#1a9614 33.34% 66.67%,#d01726 66.67% 100%);content:""}',
    '.wh-cuerpo{position:absolute;top:62px;bottom:44px;left:0;right:0;padding:30px 44px 26px;overflow:hidden}',
    '.wh-eb{display:flex;align-items:center;gap:9px;margin:0 0 10px;color:#0062a8;font:500 9.5px "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase}',
    '.wh-eb::before{width:22px;height:1px;background:currentColor;content:""}',
    '.wh-eb--claro{color:#bce7f6}',
    '.wh-h2{padding-bottom:4px;font:800 40px/1 "Big Shoulders Display",Impact,sans-serif;letter-spacing:-.025em;text-transform:uppercase}',
    '.wh-h2 small{color:#4b6474;font-size:.5em;letter-spacing:0}',
    '.wh-tit{margin-bottom:20px}',
    '.wh-sub{display:block;margin:4px 0 16px;color:#0062a8;font:500 9.5px/14px "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase}',   /* block (no flex): html2canvas lo montaba sobre la grilla */
    '.wh-sub::before{display:inline-block;vertical-align:middle;margin:-2px 9px 0 0;width:22px;height:1px;background:currentColor;content:""}',
    /* hero */
    '.wh-hero{position:absolute;inset:62px 0 44px 0;overflow:hidden;background:linear-gradient(135deg,#fff 0%,#eef9fe 45%,#d9f1fa 100%)}',   /* radial-gradient sale como mancha en html2canvas */
    '.wh-hero::before{position:absolute;inset:0;background-image:linear-gradient(rgba(0,98,168,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,98,168,.05) 1px,transparent 1px);background-size:52px 52px;content:""}',
    '.wh-hero-in{position:relative;padding:56px 44px 0}',
    '.wh-hero h1{max-width:600px;font:800 70px/1 "Big Shoulders Display",Impact,sans-serif;letter-spacing:-.025em;text-transform:uppercase;padding-bottom:10px}',
    '.wh-hero h1 em{color:#0062a8;font-style:normal}',
    '.wh-lead{max-width:540px;margin:30px 0 0;color:#4b6474;font-size:13.5px;line-height:1.6}',
    '.wh-sel{display:inline-block;margin-top:18px;padding:9px 14px;border-left:3px solid #1a9614;background:rgba(255,255,255,.85);color:#112536;font-size:12.5px;font-weight:600}',
    '.wh-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:44px;padding-top:18px;border-top:1px solid rgba(17,37,54,.14)}',
    '.wh-kpis strong{display:block;margin-bottom:8px;color:#0062a8;font:800 44px/.8 "Big Shoulders Display",Impact,sans-serif;letter-spacing:-.03em}',
    '.wh-kpis span{display:block;color:#4b6474;font-size:9.5px;line-height:1.35;text-transform:uppercase;letter-spacing:.04em}',
    '.wh-serv{position:absolute;left:0;right:0;bottom:0;padding:26px 44px 28px;background:#082436;color:#effbff}',
    '.wh-serv h2{margin:0 0 16px;font:800 30px/1 "Big Shoulders Display",Impact,sans-serif;text-transform:uppercase}',
    '.wh-serv-g{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(204,239,251,.22);border-left:1px solid rgba(204,239,251,.22)}',
    '.wh-serv-g div{padding:14px 14px 16px;border-right:1px solid rgba(204,239,251,.22);border-bottom:1px solid rgba(204,239,251,.22)}',
    '.wh-serv-g span{color:#9fdff4;font:9px "IBM Plex Mono",monospace;letter-spacing:.08em;text-transform:uppercase}',
    '.wh-serv-g h3{margin:10px 0 6px;font:800 22px/.95 "Big Shoulders Display",Impact,sans-serif;text-transform:uppercase}',
    '.wh-serv-g p{color:rgba(215,241,249,.86);font-size:10.5px;line-height:1.5}',
    /* tarjetas (mismo diseño que .card de cv.html) */
    '.wh-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}',
    '.wh-card{position:relative;height:262px;overflow:hidden;color:#fff;background:#082436}',
    '.wh-card>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
    '.wh-card--solid{background:radial-gradient(360px 240px at 100% 0%,rgba(57,178,220,.42),transparent 65%),#082436}',
    '.wh-card--solid::before{position:absolute;inset:0;background-image:linear-gradient(rgba(159,223,244,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(159,223,244,.07) 1px,transparent 1px);background-size:34px 34px;content:""}',
    '.wh-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,23,36,.05) 18%,rgba(3,23,36,.93) 100%)}',
    '.wh-big{position:absolute;z-index:1;top:52px;left:18px;font:800 52px/.8 "Big Shoulders Display",Impact,sans-serif;letter-spacing:-.035em}',
    '.wh-big small{font-size:.45em;letter-spacing:0}',
    '.wh-cli{position:absolute;z-index:2;top:12px;left:12px;padding:4px 7px;background:#0062a8;font:500 8.5px/1 "IBM Plex Mono",monospace;letter-spacing:.1em;text-transform:uppercase}',
    '.wh-cli--pub{background:#1a9614}',
    '.wh-idx{position:absolute;z-index:2;top:13px;right:14px;color:#d7f4fc;font:9px "IBM Plex Mono",monospace}',
    '.wh-cont{position:absolute;z-index:1;left:18px;right:18px;bottom:16px}',
    '.wh-cont>span{display:block;margin-bottom:6px;color:#b4e8f8;font:8.5px/1.45 "IBM Plex Mono",monospace;letter-spacing:.08em;text-transform:uppercase}',
    '.wh-cont>span b{color:#8fe38a;font-weight:500}',
    '.wh-cont h3{margin-bottom:6px;font:800 23px/1 "Big Shoulders Display",Impact,sans-serif;letter-spacing:-.01em;text-transform:uppercase}',
    '.wh-cont p{color:rgba(235,250,255,.9);font-size:10.5px;line-height:1.45}',   /* el largo se corta en JS (corto()): html2canvas no soporta line-clamp y recorta a media línea */   /* 3 líneas; line-clamp no lo soporta html2canvas */
    '.wh-m2{margin-top:7px;font:800 17px/1 "Big Shoulders Display",Impact,sans-serif}',
    '.wh-m2 small{color:#b4e8f8;font:8.5px "IBM Plex Mono",monospace;letter-spacing:.06em;text-transform:uppercase}',
    /* trayectoria (mismo diseño que .year-block / .row) */
    '.wh-anio{display:grid;grid-template-columns:78px minmax(0,1fr);gap:14px;border-top:1px solid rgba(17,37,54,.13)}',
    '.wh-anio>div{min-width:0}',
    '.wh-anio>h3{padding-top:12px;color:#0062a8;font:800 28px/.9 "Big Shoulders Display",Impact,sans-serif}',
    '.wh-fila{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 14px;padding:10px 0;border-bottom:1px solid rgba(17,37,54,.13)}',
    '.wh-fila:last-child{border-bottom:0}',
    '.wh-fila h4{font:800 16px/1.1 "Big Shoulders Display",Impact,sans-serif;text-transform:uppercase}',
    '.wh-fila p{grid-column:1;color:#4b6474;font-size:10.5px;line-height:1.45}',
    '.wh-fila span{grid-column:2;grid-row:1/span 2;color:#0062a8;font:8.5px/1.5 "IBM Plex Mono",monospace;letter-spacing:.06em;text-align:right;text-transform:uppercase;max-width:150px;white-space:normal}',
    /* empresa (mismo diseño que .company) */
    '.wh-emp{margin-top:18px;padding:30px 30px 32px;color:#fff;background:radial-gradient(420px 260px at 97% 10%,rgba(57,178,220,.35),transparent 65%),#082436}',
    '.wh-emp-g{display:grid;grid-template-columns:.9fr 1.1fr;gap:26px}',
    '.wh-emp h2{font:800 40px/1 "Big Shoulders Display",Impact,sans-serif;text-transform:uppercase}',
    '.wh-emp h2+p{margin-top:12px;color:#c4e4ef;font-size:12px;line-height:1.6}',
    '.wh-emp dl{display:grid;grid-template-columns:96px 1fr;gap:7px 14px;margin:0}',
    '.wh-emp dt{padding-top:2px;color:#8fd7ee;font:8.5px "IBM Plex Mono",monospace;letter-spacing:.1em;text-transform:uppercase}',
    '.wh-emp dd{margin:0;font-size:12px;line-height:1.45}',
    '#exportarWeb{position:fixed;left:-10000px;top:0;width:794px;pointer-events:none}'
  ].join('\n');

  function esc(t){ return String(t).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(html){ var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function desborda(c){ return c.scrollHeight > c.clientHeight + 1; }
  // corta en la última palabra antes de n caracteres y agrega '…' (2 líneas de tarjeta ≈ 105 caracteres)
  function corto(t, n){
    t = String(t); if(t.length <= n) return t;
    var k = t.lastIndexOf(' ', n - 1); if(k < n * 0.6) k = n - 1;
    return t.slice(0, k).replace(/[\s,;.·]+$/, '') + '…';
  }
  function pausa(){ return new Promise(function(r){ setTimeout(r, 0); }); }

  function construir(cont, o){
    var A = window.CV_PDF_ASSETS, SEC = o.SEC, REG = o.REG, fmtN = new Intl.NumberFormat('es-CL');
    var etiquetaCab = 'Currículum corporativo' + (o.seleccion ? ' · ' + o.seleccion : '');
    function lugar(p){ var r = p.regiones.map(function(x){ return REG[x]; }).join(' / '); return p.lugar + (r && p.lugar.indexOf(r) < 0 ? ' · ' + r : ''); }
    function hoja(){
      var h = el('<section class="wh-hoja"><div class="wh-cab"><img src="' + A.logo + '" alt="Icewell"><span>' + esc(etiquetaCab) + '</span></div>' +
        '<div class="wh-cuerpo"></div><div class="wh-pie"><span>© ' + new Date().getFullYear() + ' Icewell SpA · Román Díaz 1363, Providencia · +56 2 2847 0610 · icewell.cl</span><span class="wh-n"></span></div></section>');
      cont.appendChild(h);
      return h.querySelector('.wh-cuerpo');
    }

    // 1) hero (parte superior de la página) + "Qué hacemos"
    var h1 = el('<section class="wh-hoja"><div class="wh-cab"><img src="' + A.logo + '" alt="Icewell"><span>' + esc(etiquetaCab) + '</span></div>' +
      '<div class="wh-hero"><div class="wh-hero-in">' +
        '<p class="wh-eb">Currículum corporativo · Icewell SpA</p>' +
        '<h1>Ingeniería y montaje de sistemas <em>HVAC.</em></h1>' +
        '<p class="wh-lead">Asesorías térmicas, ingeniería e instalaciones de climatización, ventilación y calefacción para proyectos en todo Chile. Un equipo de ingenieros civiles industriales y mecánicos con experiencia en obras de relevancia desde ' + o.desde + '.</p>' +
        (o.seleccion ? '<p class="wh-sel">Selección de obras: ' + esc(o.seleccion) + ' · ' + o.lista.length + (o.lista.length === 1 ? ' obra' : ' obras') + '</p>' : '') +
        '<div class="wh-kpis"><div><strong>' + o.anios + '</strong><span>Años de experiencia · desde ' + o.desde + '</span></div>' +
          '<div><strong>51</strong><span>Obras y proyectos registrados</span></div>' +
          '<div><strong>+170.000</strong><span>m² intervenidos en obras destacadas</span></div>' +
          '<div><strong>12</strong><span>Regiones, de Tarapacá a Los Lagos</span></div></div>' +
      '</div>' +
      '<div class="wh-serv"><p class="wh-eb wh-eb--claro">Qué hacemos</p><h2>Tres líneas de servicio, un solo responsable.</h2><div class="wh-serv-g">' +
        '<div><span>01 · Asesoría</span><h3>Asesorías térmicas</h3><p>Informes y evaluaciones técnico-económicas, inspección técnica de obra, cargas térmicas y consumo de ACS.</p></div>' +
        '<div><span>02 · Ingeniería</span><h3>Ingeniería</h3><p>Proyectos de climatización, ventilación y calefacción comercial, residencial e industrial, con eficiencia energética y ERNC.</p></div>' +
        '<div><span>03 · Montaje</span><h3>Instalaciones</h3><p>Sistemas de agua, expansión directa, VRV/VRF, volumen variable e instalaciones solares.</p></div>' +
      '</div></div></div>' +
      '<div class="wh-pie"><span>© ' + new Date().getFullYear() + ' Icewell SpA · Román Díaz 1363, Providencia · +56 2 2847 0610 · icewell.cl</span><span class="wh-n"></span></div></section>');
    cont.appendChild(h1);

    // 2) obras: con selección todas como tarjeta; completo: tarjetas (foto, m², 2023+) + trayectoria en lista
    var orden = function(a, b){ return (b.estado === 'ejecucion') - (a.estado === 'ejecucion') || b.anio - a.anio || (b.m2 || 0) - (a.m2 || 0); };
    var todas = !!o.seleccion;
    var fichas = o.lista.filter(function(p){ return todas || p.foto || p.m2 || p.anio >= 2023; }).sort(orden);
    var filas = o.lista.filter(function(p){ return !(todas || p.foto || p.m2 || p.anio >= 2023); }).sort(function(a, b){ return b.anio - a.anio; });
    var titulo = o.seleccion ? 'Obras · ' + esc(o.seleccion) : 'Obras destacadas y recientes';
    var c = hoja(), nHoja = 1;
    var enTray = false;
    function cabObras(primera){
      c.appendChild(enTray
        ? el('<div class="wh-tit"><p class="wh-eb">Obras ejecutadas</p><h2 class="wh-h2">Trayectoria</h2></div>')
        : el('<div class="wh-tit"><p class="wh-eb">Portafolio</p><h2 class="wh-h2">' + titulo + (primera ? '' : ' <small>· hoja ' + nHoja + '</small>') + '</h2></div>'));
    }
    function nuevaHojaObras(){ nHoja++; c = hoja(); cabObras(false); }
    cabObras(true);
    var grid = null, gridAnterior = null;
    if(fichas.length){
      c.appendChild(el('<p class="wh-sub">' + fichas.length + (fichas.length === 1 ? ' obra' : ' obras') + '</p>'));
      grid = el('<div class="wh-grid"></div>'); c.appendChild(grid);
      fichas.forEach(function(p, i){
        var pub = p.cliente === 'Público', sec = p.sectores.filter(function(x){ return (o.sectoresSel || []).indexOf(x) >= 0; })[0] || p.sectores[0];
        var src = p.foto && A.fotos[p.foto];
        var meta = [String(p.anio), SEC[sec], p.trabajo || ''].filter(Boolean).map(esc).join(' · ') + (p.estado === 'ejecucion' ? ' · <b>En ejecución</b>' : '');
        var t = el('<article class="wh-card' + (src ? '' : ' wh-card--solid') + '">' +
          (src ? '<img src="' + src + '" alt="">' : '<span class="wh-big">' + (p.m2 ? fmtN.format(p.m2) + ' <small>m²</small>' : p.anio) + '</span>') +
          '<div class="wh-shade"></div><span class="wh-cli' + (pub ? ' wh-cli--pub' : '') + '">' + (pub ? 'Público' : 'Privado') + '</span>' +
          '<span class="wh-idx">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<div class="wh-cont"><span>' + meta + '</span><h3>' + esc(p.nombre) + '</h3><p>' + esc(corto(lugar(p) + ' · ' + (p.detalle || p.sistemas), 105)) + '</p>' +
          (src && p.m2 ? '<div class="wh-m2">' + fmtN.format(p.m2) + ' <small>m² intervenidos</small></div>' : '') + '</div></article>');
        grid.appendChild(t);
        if(desborda(c)){ grid.removeChild(t); gridAnterior = grid; nuevaHojaObras(); grid = el('<div class="wh-grid"></div>'); c.appendChild(grid); grid.appendChild(t); }
      });
      // sin tarjeta sola en la última hoja
      if(gridAnterior && grid.children.length === 1 && gridAnterior.children.length >= 3) grid.insertBefore(gridAnterior.lastElementChild, grid.firstChild);
    }
    if(filas.length){
      enTray = true;
      var sub = el('<p class="wh-sub">Trayectoria · ' + filas.length + ' obras más</p>');
      c.appendChild(sub);
      if(desborda(c)){ sub.remove(); nuevaHojaObras(); c.appendChild(sub); }
      var bloque = null, anioBloque = null, hojasFilas = [c];
      filas.forEach(function(p){
        if(p.anio !== anioBloque){ bloque = el('<div class="wh-anio"><h3>' + p.anio + '</h3><div></div></div>'); c.appendChild(bloque); anioBloque = p.anio; }
        var meta = p.sectores.map(function(x){ return SEC[x]; }).concat(p.tags).join(' · ');
        var f = el('<div class="wh-fila"><h4>' + esc(p.nombre) + '</h4><span>' + esc(meta) + '</span><p>' + esc(lugar(p)) + ' · ' + esc(p.sistemas) + '</p></div>');
        bloque.lastElementChild.appendChild(f);
        if(desborda(c)){
          f.remove(); if(!bloque.lastElementChild.children.length) bloque.remove();
          nuevaHojaObras(); hojasFilas.push(c);
          bloque = el('<div class="wh-anio"><h3>' + p.anio + '</h3><div></div></div>'); c.appendChild(bloque); bloque.lastElementChild.appendChild(f);
        }
      });
      // última hoja sin 1–2 filas solas: se traen filas de la hoja anterior
      if(hojasFilas.length > 1){
        var ult = hojasFilas[hojasFilas.length - 1], ant = hojasFilas[hojasFilas.length - 2];
        var n = ult.querySelectorAll('.wh-fila').length;
        if(n < 3){
          var prev = Array.from(ant.querySelectorAll('.wh-fila')).slice(-(3 - n)).reverse();
          prev.forEach(function(fila){
            var anio = fila.closest('.wh-anio').firstElementChild.textContent, bl = fila.closest('.wh-anio');
            var primero = ult.querySelector('.wh-anio');
            if(primero && primero.firstElementChild.textContent === anio) primero.lastElementChild.insertBefore(fila, primero.lastElementChild.firstChild);
            else { var nb = el('<div class="wh-anio"><h3>' + anio + '</h3><div></div></div>'); nb.lastElementChild.appendChild(fila); ult.insertBefore(nb, primero); }
            if(!bl.lastElementChild.children.length) bl.remove();
          });
        }
      }
    }
    // 3) empresa (final de la página)
    var emp = el('<div class="wh-emp"><div class="wh-emp-g"><div><p class="wh-eb wh-eb--claro">Datos de la empresa</p><h2>Conversemos su próximo proyecto.</h2><p>Cuéntenos el alcance. Le responderá un ingeniero. WhatsApp +56 9 6407 4519.</p></div>' +
      '<dl><dt>Razón social</dt><dd>Icewell SpA</dd><dt>Giro</dt><dd>Asesorías, ingeniería y montajes térmicos</dd><dt>RUT</dt><dd>76.059.117-3</dd>' +
      '<dt>Dirección</dt><dd>Román Díaz #1363, Providencia, Santiago</dd><dt>Teléfono</dt><dd>+56 2 2847 0610</dd>' +
      '<dt>Contacto</dt><dd>contacto@icewell.cl<br>gonzalo.diaz@icewell.cl</dd><dt>Sitio web</dt><dd>www.icewell.cl</dd></dl></div></div>');
    c.appendChild(emp);
    if(desborda(c)){ emp.remove(); c = hoja(); c.appendChild(emp); }

    var hojas = cont.querySelectorAll('.wh-hoja');
    hojas.forEach(function(h, i){ h.querySelector('.wh-n').textContent = String(i + 1).padStart(2, '0') + ' / ' + String(hojas.length).padStart(2, '0'); });
    return Array.from(hojas);
  }

  async function generar(o, ctx){
    if(!document.getElementById('whCss')){ var st = document.createElement('style'); st.id = 'whCss'; st.textContent = CSS; document.head.appendChild(st); }
    var cont = document.getElementById('exportarWeb');
    if(!cont){ cont = document.createElement('div'); cont.id = 'exportarWeb'; cont.setAttribute('aria-hidden', 'true'); document.body.appendChild(cont); }
    if(document.fonts && document.fonts.ready) await document.fonts.ready;
    cont.innerHTML = '';
    try {
      var hojas = construir(cont, o);
      await Promise.all(Array.from(cont.querySelectorAll('img')).map(function(im){ return im.complete ? null : new Promise(function(r){ im.onload = im.onerror = r; }); }));
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
      doc.setProperties({ title: 'Currículum Icewell' + (o.seleccion ? ' — ' + o.seleccion : ''), author: 'Icewell SpA' });
      for(var i = 0; i < hojas.length; i++){
        ctx.aviso('Armando PDF…', 'Hoja ' + (i + 1) + ' de ' + hojas.length + ' · puedes seguir usando el currículum.', 50 + Math.round(48 * i / hojas.length));
        await pausa();
        var canvas = await window.html2canvas(hojas[i], { scale: ESCALA, backgroundColor: '#f6fbfd', logging: false });
        if(i) doc.addPage();
        doc.addImage(canvas.toDataURL('image/jpeg', CALIDAD), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }
      return { blob: doc.output('blob'), nombre: o.nombreArchivo, paginas: hojas.length };
    } finally {
      cont.innerHTML = '';
    }
  }

  window.icewellPdfFoto = { generar: generar, construir: construir, CSS: CSS };
})();
