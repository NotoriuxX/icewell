/* ==========================================================================
   ICEWELL — PDF real del currículum (jsPDF, vectorial, texto seleccionable)
   Lo usa cv.html: botón "Descargar PDF" → descarga directa de un .pdf con
   exactamente lo filtrado. No depende del diálogo de impresión.

   Dependencias (se cargan recién al hacer clic, ver cv.html → descargarPdf):
     assets/vendor/jspdf.umd.min.js     jsPDF 2.5.1 (copia local, sin CDN)
     assets/vendor/cv-pdf-assets.js     fuentes + logo + fotos en base64
                                        (lo genera proyecto/herramientas/build_pdf_assets.py)

   API: await icewellPDF.generar({ lista, hayFiltro, desc, anios, desde, SEC, REG, nombreArchivo, onProgreso })
        → { blob, nombre, paginas }. NO descarga: quien llama decide (cv.html → aviso + <a download>).
        Es async y cede el hilo entre filas de tarjetas / años de trayectoria para no congelar la página;
        onProgreso({ etapa: 'armando'|'listo', hechas, total }) informa obras procesadas.
   ========================================================================== */
(function(){
  // ---------- sistema visual (mismos tokens que index/cv) ----------
  var C = {
    ink: [17, 37, 54], soft: [75, 100, 116], blue: [0, 98, 168], blueDeep: [0, 74, 128],
    dark: [8, 36, 54], line: [218, 227, 233], green: [26, 150, 20], red: [208, 23, 38],
    ice: [180, 232, 248], white: [255, 255, 255], snow: [244, 250, 252]
  };
  var PAG = { w: 210, h: 297 }, M = 14, W = PAG.w - 2 * M;
  var Y_INICIO = 30, Y_LIMITE = 276;
  var PT = 0.3528;                      // 1 pt en mm
  var fmtN = new Intl.NumberFormat('es-CL');

  function pausa(){ return new Promise(function(r){ setTimeout(r, 0); }); }

  async function generar(o){
    var hechas = 0, totalObras = o.lista.length;
    async function avance(etapa){ if(o.onProgreso) o.onProgreso({ etapa: etapa, hechas: hechas, total: totalObras }); await pausa(); }
    await avance('armando');
    var A = window.CV_PDF_ASSETS;
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    Object.keys(A.fuentes).forEach(function(n){
      doc.addFileToVFS(n + '.ttf', A.fuentes[n]);
      doc.addFont(n + '.ttf', n, 'normal');
    });
    doc.setProperties({ title: 'Currículum Icewell' + (o.hayFiltro ? ' — ' + o.desc : ''), author: 'Icewell SpA', subject: 'Obras y proyectos HVAC', creator: 'icewell cv.html' });

    var y = Y_INICIO;
    var fecha = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

    // ---------- helpers ----------
    function fuente(nombre, pt, color, esp){ doc.setFont(nombre, 'normal'); doc.setFontSize(pt); doc.setTextColor.apply(doc, color); doc.setCharSpace(esp || 0); }
    function alto(pt, lineas, factor){ return pt * PT * (factor || 1.25) * lineas; }
    function texto(str, x, yy, opts){ doc.text(str, x, yy, Object.assign({ baseline: 'top' }, opts || {})); }
    function lineas(str, ancho){ return doc.splitTextToSize(String(str), ancho); }
    // jsPDF no suma el charSpace al alinear a la derecha ni en getTextWidth → se medía corto y se salía del margen
    function ancho(str){ return doc.getTextWidth(str) + doc.getCharSpace() * Math.max(String(str).length - 1, 0); }
    function textoDer(str, xDer, yy, lh){
      (Array.isArray(str) ? str : [str]).forEach(function(l, i){ texto(l, xDer - ancho(l), yy + i * (lh || 0)); });
    }
    function relleno(c){ doc.setFillColor.apply(doc, c); }
    function trazo(c, g){ doc.setDrawColor.apply(doc, c); doc.setLineWidth(g || 0.2); }
    function eyebrow(str, x, yy, color){
      trazo(color || C.blue, 0.3); doc.line(x, yy + 1.3, x + 7, yy + 1.3);
      fuente('PlexMono', 7, color || C.blue, 0.5); texto(str.toUpperCase(), x + 9.5, yy);
      doc.setCharSpace(0);
    }
    function franjaTri(yy, h){
      var t = W / 3;
      relleno(C.blue); doc.rect(M, yy, t, h, 'F');
      relleno(C.green); doc.rect(M + t, yy, t, h, 'F');
      relleno(C.red); doc.rect(M + 2 * t, yy, t, h, 'F');
    }
    function cabecera(){
      doc.addImage(A.logo, 'PNG', M, 11, 30, 30 * 161 / 640);
      fuente('PlexMono', 6.5, C.soft, 0.5);
      var cab = 'CURRÍCULUM CORPORATIVO' + (o.hayFiltro ? '  ·  ' + o.desc.toUpperCase() : o.seleccion ? '  ·  ' + o.seleccion.toUpperCase() : '');
      if(cab.length > 70) cab = cab.slice(0, 67) + '...';
      textoDer(cab, PAG.w - M, 13);
      doc.setCharSpace(0);
      franjaTri(21, 0.8);
    }
    function nuevaPagina(){ doc.addPage(); cabecera(); y = Y_INICIO; }
    function asegurar(h){ if(y + h > Y_LIMITE) nuevaPagina(); }

    cabecera();

    // ---------- portada / encabezado de la selección ----------
    eyebrow(o.hayFiltro ? 'Selección de obras · ' + fecha : 'Currículum corporativo · Icewell SpA', M, y);
    y += 7;
    if(o.hayFiltro){
      fuente('BigShoulders-Black', 30, C.ink);
      var tit = lineas((o.titulo || ('Obras · ' + o.desc)).toUpperCase(), W);
      texto(tit, M, y, { lineHeightFactor: 0.95 });
      y += alto(30, tit.length, 0.95) + 7;
      fuente('PlexSans', 9.5, C.soft);
      var lead = lineas('Obras de climatización, ventilación y calefacción ejecutadas por Icewell SpA que coinciden con esta selección. Documento generado desde el currículum interactivo el ' + fecha + '.', W * 0.78);
      texto(lead, M, y, { lineHeightFactor: 1.45 });
      y += alto(9.5, lead.length, 1.45) + 7;
    } else {
      fuente('BigShoulders-Black', 38, C.ink);
      texto('INGENIERÍA Y MONTAJE', M, y);
      y += alto(38, 1, 0.95);
      texto('DE SISTEMAS ', M, y);
      var anchoDe = doc.getTextWidth('DE SISTEMAS ');
      doc.setTextColor.apply(doc, C.blue); texto('HVAC.', M + anchoDe, y);
      y += alto(38, 1, 0.95) + 7;
      fuente('PlexSans', 9.5, C.soft);
      var lead2 = lineas('Asesorías térmicas, ingeniería e instalaciones de climatización, ventilación y calefacción para proyectos en todo Chile. Un equipo de ingenieros civiles industriales y mecánicos con experiencia en obras de relevancia desde ' + o.desde + '.', W * 0.78);
      texto(lead2, M, y, { lineHeightFactor: 1.45 });
      y += alto(9.5, lead2.length, 1.45) + 7;
      // CV completo pero con obras seleccionadas ("Descargar proyectos"): se deja explícita la selección
      if(o.seleccion){
        relleno(C.snow); doc.rect(M, y - 3, W, 9, 'F'); relleno(C.green); doc.rect(M, y - 3, 1, 9, 'F');
        fuente('PlexSans-SemiBold', 9, C.ink); texto('Selección de obras: ' + o.seleccion + ' · ' + o.lista.length + (o.lista.length === 1 ? ' obra' : ' obras'), M + 4, y - 0.4);
        y += 11;
      }
    }

    // KPIs (4 columnas con línea superior, como .hero-metrics)
    var kpis;
    if(o.hayFiltro){
      var m2 = o.lista.reduce(function(a, p){ return a + (p.m2 || 0); }, 0);
      var regs = {}; o.lista.forEach(function(p){ p.regiones.forEach(function(r){ regs[r] = 1; }); });
      var anios = o.lista.map(function(p){ return p.anio; });
      var ini = Math.min.apply(null, anios), fin = Math.max.apply(null, anios);
      kpis = [
        [String(o.lista.length), o.lista.length === 1 ? 'Obra en esta selección' : 'Obras en esta selección'],
        [m2 ? fmtN.format(m2) : '—', 'm² con superficie registrada'],
        [String(Object.keys(regs).length), Object.keys(regs).length === 1 ? 'Región' : 'Regiones'],
        [ini === fin ? String(ini) : ini + '–' + fin, 'Período de las obras']
      ];
    } else {
      kpis = [[String(o.anios), 'Años de experiencia · desde ' + o.desde], ['51', 'Obras y proyectos registrados'],
              ['+170.000', 'm² intervenidos en obras destacadas'], ['12', 'Regiones, de Tarapacá a Los Lagos']];
    }
    trazo(C.line, 0.3); doc.line(M, y, M + W, y);
    y += 4;
    var kw = W / 4;
    kpis.forEach(function(k, i){
      fuente('BigShoulders-Black', 24, C.blue); texto(k[0], M + i * kw, y);
      fuente('PlexMono', 6.3, C.soft, 0.25); texto(lineas(k[1].toUpperCase(), kw - 6), M + i * kw, y + 10, { lineHeightFactor: 1.35 });
      doc.setCharSpace(0);
    });
    y += 22;

    // Servicios (solo CV completo): banda oscura de 3 columnas
    if(!o.hayFiltro){
      var srv = [
        ['01 · Asesoría', 'Asesorías térmicas', 'Informes y evaluaciones técnico-económicas, inspección técnica de obra, cargas térmicas y consumo de ACS.'],
        ['02 · Ingeniería', 'Ingeniería', 'Proyectos de climatización, ventilación y calefacción comercial, residencial e industrial, con eficiencia energética y ERNC.'],
        ['03 · Montaje', 'Instalaciones', 'Sistemas de agua, expansión directa, VRV/VRF, volumen variable e instalaciones solares. Suministro y montaje.']
      ];
      var hs = 44;
      relleno(C.dark); doc.rect(M, y, W, hs, 'F');
      var sw = W / 3;
      srv.forEach(function(s, i){
        var x = M + i * sw + 6;
        if(i){ trazo([40, 70, 90], 0.2); doc.line(M + i * sw, y + 5, M + i * sw, y + hs - 5); }
        fuente('PlexMono', 6.5, C.ice, 0.5); texto(s[0].toUpperCase(), x, y + 6); doc.setCharSpace(0);
        fuente('BigShoulders-Black', 16, C.white); texto(s[1].toUpperCase(), x, y + 12);
        fuente('PlexSans', 7.8, [205, 230, 240]); texto(lineas(s[2], sw - 12), x, y + 21, { lineHeightFactor: 1.4 });
      });
      y += hs + 9;
    }

    // ---------- obras destacadas: tarjetas 2 columnas con foto ----------
    var todasFicha = !!(o.seleccion || o.hayFiltro);
    var esFicha = function(p){ return todasFicha || p.foto || p.m2 || p.anio >= 2023; };
    var dest = o.lista.filter(esFicha)
      .sort(function(a, b){ return (b.estado === 'ejecucion') - (a.estado === 'ejecucion') || b.anio - a.anio || (b.m2 || 0) - (a.m2 || 0); });
    var resto = o.lista.filter(function(p){ return !esFicha(p); });
    var cols = dest.length > 6 ? 3 : 2;               // CV completo: 3 columnas → menos páginas
    var gap = cols === 3 ? 5 : 6, cw = (W - gap * (cols - 1)) / cols, fh = cw * 2 / 3;
    var T = cols === 3 ? { nom: 11.5, desc: 7.2, m2: 11.5, pad: 4 } : { nom: 13.5, desc: 7.8, m2: 13, pad: 5 };

    function metaTxt(p){ return p.sectores.map(function(s){ return o.SEC[s]; }).concat(p.tags).join(' · '); }
    function lugar(p){ var r = p.regiones.map(function(x){ return o.REG[x]; }).join(' / '); return p.lugar + (r && p.lugar.indexOf(r) < 0 ? ' · ' + r : ''); }

    function medirTarjeta(p){
      fuente('BigShoulders-Bold', T.nom, C.ink); var n = lineas(p.nombre.toUpperCase(), cw - 2 * T.pad);
      fuente('PlexSans', T.desc, C.soft); var d = lineas(lugar(p) + ' · ' + p.sistemas, cw - 2 * T.pad);
      return { n: n, d: d, h: fh + 5 + 4.5 + alto(T.nom, n.length, 0.95) + 3 + alto(T.desc, d.length, 1.4) + (p.m2 ? 9 : 0) + 4 };
    }
    function dibujarTarjeta(p, x, yy, hh, med, idx){
      trazo(C.line, 0.25); doc.rect(x, yy, cw, hh, 'S');
      var src = p.foto && A.fotos[p.foto];
      if(src){ doc.addImage(src, 'JPEG', x, yy, cw, fh, p.foto, 'FAST'); }
      else {
        relleno(C.dark); doc.rect(x, yy, cw, fh, 'F');
        fuente('BigShoulders-Black', 34, C.white); texto(p.m2 ? fmtN.format(p.m2) + ' m²' : String(p.anio), x + 6, yy + fh - 17);
      }
      // etiqueta superior (año / en ejecución) e índice
      var pub = p.cliente === 'Público', etiqueta = pub ? 'PÚBLICO' : 'PRIVADO';
      fuente('PlexMono', 6.3, C.white, 0.4);
      var ew = ancho(etiqueta) + 5;
      relleno(pub ? C.green : C.blue); doc.rect(x + 4, yy + 4, ew, 5.2, 'F');
      texto(etiqueta, x + 6.5, yy + 5.3); doc.setCharSpace(0);
      var num = String(idx + 1).padStart(2, '0');
      fuente('PlexMono', 6.3, C.white); relleno(C.dark); doc.rect(x + cw - 4 - ancho(num) - 3, yy + 4, ancho(num) + 3, 5.2, 'F');
      textoDer(num, x + cw - 5.5, yy + 5.3);
      // cuerpo
      var px = x + T.pad, ty = yy + fh + 5;
      var metaCard = [String(p.anio), o.SEC[p.sectores[0]], p.trabajo || ''].filter(Boolean).join(' · ').toUpperCase();
      fuente('PlexMono', 6, C.blue, 0.3); texto(lineas(metaCard, cw - 2 * T.pad - 4)[0], px, ty); doc.setCharSpace(0);
      if(p.estado === 'ejecucion'){ var wm = ancho(lineas(metaCard, cw - 2 * T.pad - 4)[0]); fuente('PlexMono', 6, C.green, 0.3); texto(' · EN EJECUCIÓN', px + wm, ty); doc.setCharSpace(0); }
      ty += 4.5;
      fuente('BigShoulders-Bold', T.nom, C.ink); texto(med.n, px, ty, { lineHeightFactor: 0.95 });
      ty += alto(T.nom, med.n.length, 0.95) + 3;
      fuente('PlexSans', T.desc, C.soft); texto(med.d, px, ty, { lineHeightFactor: 1.4 });
      ty += alto(T.desc, med.d.length, 1.4) + 3;
      if(p.m2){
        trazo(C.line, 0.2); doc.line(px, ty, x + cw - T.pad, ty);
        fuente('BigShoulders-Black', T.m2, C.blue); texto(fmtN.format(p.m2) + ' m²', px, ty + 2);
        fuente('PlexMono', 5.6, C.soft, 0.25); textoDer(cols === 3 ? 'SUPERFICIE' : 'SUPERFICIE INTERVENIDA', x + cw - T.pad, ty + 3.2); doc.setCharSpace(0);
      }
    }

    if(dest.length){
      asegurar(12 + fh + 30);
      eyebrow((todasFicha ? 'Obras · ' + (o.seleccion || o.desc) + ' · ' + dest.length : 'Obras destacadas y recientes · ' + dest.length), M, y); y += 8;
      for(var i = 0; i < dest.length; i += cols){
        var fila = dest.slice(i, i + cols), med = fila.map(medirTarjeta);
        var hh = Math.max.apply(null, med.map(function(m){ return m.h; }));
        asegurar(hh);
        fila.forEach(function(p, j){ dibujarTarjeta(p, M + j * (cw + gap), y, hh, med[j], i + j); });
        y += hh + gap;
        hechas += fila.length;
        await avance('armando');
      }
      y += 3;
    }

    // ---------- trayectoria: filas con línea fina, agrupadas por año ----------
    if(resto.length){
      asegurar(24);
      eyebrow('Trayectoria · ' + resto.length + (resto.length === 1 ? ' obra' : ' obras') + (dest.length ? ' más' : ''), M, y); y += 8;
      var colAnio = 20, colMeta = 44, anchoTxt = W - colAnio - colMeta - 4;
      var filas = resto.slice().sort(function(a, b){ return b.anio - a.anio; }).map(function(p){
        fuente('PlexSans-SemiBold', 9.2, C.ink); var n = lineas(p.nombre, anchoTxt);
        fuente('PlexSans', 7.8, C.soft); var d = lineas(lugar(p) + ' · ' + p.sistemas, anchoTxt);
        return { p: p, n: n, d: d, h: 3 + alto(9.2, n.length, 1.2) + 1 + alto(7.8, d.length, 1.35) + 3 };
      });
      // corte de página: si a la página siguiente pasarían solo 1–2 filas, se cortan antes para que pasen 3
      function corteDesde(k){
        var yy = y, f = 0;
        while(k + f < filas.length && yy + filas[k + f].h <= Y_LIMITE){ yy += filas[k + f].h; f++; }
        var quedan = filas.length - k - f;
        if(quedan > 0 && quedan < 3 && f > 3) f -= (3 - quedan);
        return k + f;
      }
      var corte = corteDesde(0), anioPag = null;
      for(var k = 0; k < filas.length; k++){
        var fi = filas[k], p = fi.p;
        if(k === corte){ nuevaPagina(); anioPag = null; corte = corteDesde(k); }
        var nuevoAnio = p.anio !== anioPag;
        trazo(nuevoAnio ? C.ink : C.line, nuevoAnio ? 0.35 : 0.2); doc.line(nuevoAnio ? M : M + colAnio, y, M + W, y);
        if(nuevoAnio){ fuente('BigShoulders-Black', 17, C.blue); texto(String(p.anio), M, y + 2.5); anioPag = p.anio; }
        fuente('PlexSans-SemiBold', 9.2, C.ink); texto(fi.n, M + colAnio, y + 3, { lineHeightFactor: 1.2 });
        fuente('PlexSans', 7.8, C.soft); texto(fi.d, M + colAnio, y + 3 + alto(9.2, fi.n.length, 1.2) + 1, { lineHeightFactor: 1.35 });
        fuente('PlexMono', 6.2, C.blue, 0.3); textoDer(lineas(metaTxt(p).toUpperCase(), colMeta - 6), M + W, y + 3.6, alto(6.2, 1, 1.35)); doc.setCharSpace(0);
        y += fi.h;
        hechas++;
        if(k % 6 === 5) await avance('armando');
      }
      y += 6;
    }

    // ---------- certificaciones (solo completo) ----------
    if(!o.hayFiltro){
      asegurar(24);
      eyebrow('Certificaciones y estándares', M, y); y += 7;
      var certs = ['Proyectos con certificación LEED', 'Eficiencia energética', 'ERNC y solar térmica', 'Obras sobre 4.800 msnm'];
      var cwc = W / 4;
      trazo(C.line, 0.25); doc.line(M, y, M + W, y);
      certs.forEach(function(c, i){ fuente('BigShoulders-Bold', 11, C.ink); texto(lineas(c.toUpperCase(), cwc - 6), M + i * cwc, y + 3, { lineHeightFactor: 1 }); });
      y += 14; doc.line(M, y, M + W, y);
      y += 8;
    }

    // ---------- datos de empresa: banda oscura ----------
    var he = 52;
    asegurar(he);
    relleno(C.dark); doc.rect(M, y, W, he, 'F');
    fuente('PlexMono', 6.5, C.ice, 0.5); texto('DATOS DE LA EMPRESA', M + 8, y + 8); doc.setCharSpace(0);
    fuente('BigShoulders-Black', 22, C.white); texto(['CONVERSEMOS SU', 'PRÓXIMO PROYECTO.'], M + 8, y + 14, { lineHeightFactor: 0.95 });
    fuente('PlexSans', 8, [196, 228, 239]); texto('WhatsApp +56 9 6407 4519', M + 8, y + 33);
    var filas = [['Razón social', 'Icewell SpA'], ['Giro', 'Asesorías, ingeniería y montajes térmicos'], ['RUT', '76.059.117-3'],
                 ['Dirección', 'Román Díaz #1363, Providencia, Santiago'], ['Teléfono', '+56 2 2847 0610'],
                 ['Contacto', 'contacto@icewell.cl · gonzalo.diaz@icewell.cl'], ['Sitio web', 'www.icewell.cl']];
    var dx = M + W * 0.44, dy = y + 7;
    filas.forEach(function(f){
      fuente('PlexMono', 6.2, C.ice, 0.4); texto(f[0].toUpperCase(), dx, dy + 0.6); doc.setCharSpace(0);
      fuente('PlexSans', 8.2, C.white); texto(f[1], dx + 24, dy);
      dy += 5.7;
    });
    y += he;

    // ---------- pie + numeración en todas las páginas ----------
    var total = doc.getNumberOfPages();
    for(var pg = 1; pg <= total; pg++){
      doc.setPage(pg);
      trazo(C.line, 0.2); doc.line(M, 284, M + W, 284);
      fuente('PlexMono', 6.2, C.soft, 0.2);
      texto('ICEWELL SPA · ROMÁN DÍAZ 1363, PROVIDENCIA · +56 2 2847 0610 · CONTACTO@ICEWELL.CL', M, 286.5);
      textoDer(String(pg).padStart(2, '0') + ' / ' + String(total).padStart(2, '0'), M + W, 286.5);
      doc.setCharSpace(0);
    }

    hechas = totalObras;
    if(o.onProgreso) o.onProgreso({ etapa: 'listo', hechas: hechas, total: totalObras, paginas: total });
    return { blob: doc.output('blob'), nombre: o.nombreArchivo || 'Icewell-CV.pdf', paginas: total };
  }

  window.icewellPDF = { generar: generar };
})();
