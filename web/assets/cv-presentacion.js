/* ==========================================================================
   ICEWELL — Presentación corporativa interactiva (cv-presentacion.html)
   Réplica 1:1 de Icewell-Presentacion-Corporativa.pdf armada con los datos de
   cv-data.js. Los chips de "Sectores atendidos" y "Cobertura territorial" filtran.

   PDF: se "fotografían" las mismas hojas A4 (html2canvas) y se pegan en un PDF
   (jsPDF) → lo que se ve en pantalla es exactamente lo que se descarga.
     Descargar CV         = presentación completa, sin filtros
     Descargar proyectos  = solo las hojas de obras de la selección + datos de empresa
   Cola y avisos: assets/pdf-cola.js. Librerías: assets/vendor/ (sin CDN).
   ========================================================================== */
(function(){
  var SEC = {}; SECTORES.forEach(function(s){ SEC[s.id] = s.label; });
  var REG = {}; REGIONES.forEach(function(r){ REG[r.id] = r.label; });
  var PER = {}; PERIODOS.forEach(function(p){ PER[p.id] = p; });
  var fmtN = new Intl.NumberFormat('es-CL');
  var state = { sector: new Set(), periodo: new Set(), region: new Set(), q: '' };

  // Años de experiencia exactos, calculados desde la fundación (assets/aniversario.js); cambian solos cada aniversario
  var ANIOS = window.icewellAniversario ? icewellAniversario.anios : new Date().getFullYear() - 2009;
  var LOGO = document.getElementById('tplLogo').innerHTML;
  var ISO = document.getElementById('tplIso').innerHTML;

  // ---------- utilidades ----------
  function esc(t){ return String(t).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(t){ return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function el(html){ var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function periodoDe(p){ for(var i = 0; i < PERIODOS.length; i++){ if(p.anio >= PERIODOS[i].desde && p.anio <= PERIODOS[i].hasta) return PERIODOS[i].id; } return null; }
  PROYECTOS.forEach(function(p, i){
    p._id = i;
    p._periodo = periodoDe(p);
    p._texto = norm([p.nombre, p.lugar, p.uso, p.sistemas, p.anio, p.tags.join(' '),
      p.sectores.map(function(s){ return SEC[s]; }).join(' '), p.regiones.map(function(r){ return REG[r]; }).join(' '), p.trabajo || '', p.detalle || '', p.cliente || ''].join(' '));
  });
  function coincide(p, st){
    if(st.sector.size && !p.sectores.some(function(s){ return st.sector.has(s); })) return false;
    if(st.periodo.size && !st.periodo.has(p._periodo)) return false;
    if(st.region.size && !p.regiones.some(function(r){ return st.region.has(r); })) return false;
    if(st.q){ var w = norm(st.q).split(/\s+/).filter(Boolean); for(var i = 0; i < w.length; i++){ if(p._texto.indexOf(w[i]) < 0) return false; } }
    return true;
  }
  function hayFiltro(st){ return !!(st.sector.size || st.periodo.size || st.region.size || st.q); }
  function descripcion(st){
    var partes = [];
    if(st.sector.size) partes.push(Array.from(st.sector).map(function(s){ return SEC[s]; }).join(' + '));
    if(st.periodo.size) partes.push(Array.from(st.periodo).map(function(p){ return PER[p].label; }).join(', '));
    if(st.region.size) partes.push(Array.from(st.region).map(function(r){ return REG[r]; }).join(', '));
    if(st.q) partes.push('"' + st.q + '"');
    return partes.join(' · ');
  }
  // "Quilicura, RM" / "Osorno, Los Lagos" (formato del PDF)
  function lugarPdf(p){
    var r = p.regiones[0], reg = r === 'metropolitana' ? 'RM' : (REG[r] || '');
    if(!reg || p.lugar.indexOf(REG[r]) >= 0) return p.lugar;
    if(r !== 'metropolitana' && p.lugar.indexOf(',') >= 0) return p.lugar;
    return p.lugar + ', ' + reg;
  }
  function clienteDe(p){   // respaldo si una obra no trae 'cliente': lo deduce del campo uso
    var m = /^(Privado|Comercial|Público)/i.exec(p.uso || '');
    return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() : '';
  }
  function tarjetaSeleccion(p, st){
    // sector de la etiqueta: el filtrado si la obra lo tiene (Dilaco con filtro Industrial → Industrial), si no el primero
    var sec = p.sectores.filter(function(x){ return st.sector.has(x); })[0] || p.sectores[0];
    // etiqueta = tipo de cliente (Público verde / Privado azul, como el PDF); sector, uso y trabajo van adentro
    var cliente = p.cliente || clienteDe(p) || 'Privado', uso = usoCorto(p);
    var info = [SEC[sec], uso && uso !== SEC[sec] ? uso : '', p.trabajo || ''].filter(Boolean).join(' · ');
    return el('<article class="obra" data-id="' + p._id + '"><div class="obra__top"><h3>' + esc(p.nombre) + '</h3>' +
      '<span class="badge' + (cliente === 'Público' ? ' badge--publico' : '') + '">' + esc(cliente) + '</span></div>' +
      '<p class="obra__lugar">' + esc(lugarPdf(p)) + ' · ' + p.anio +
        (p.estado === 'ejecucion' ? ' · <b class="obra__vivo">En ejecución</b>' : '') + '</p>' +
      (info ? '<p class="obra__trabajo">' + esc(info) + '</p>' : '') +
      '<p class="obra__desc">' + esc(p.sistemas) + '</p>' +
      (p.m2 ? '<div class="obra__m2"><strong>' + fmtN.format(p.m2) + ' m²</strong><span>Superficie intervenida</span></div>' : '') +
      '</article>');
  }
  function usoCorto(p){ return (p.uso || '').replace(/^(Privado|Comercial|Público)\s*·?\s*/i, ''); }

  // ---------- hojas ----------
  function nuevaHoja(montar, cab){
    var h = el('<section class="hoja">' +
      (cab ? '<div class="h-cab"><div class="h-cab__logo">' + LOGO + '</div><p class="h-cab__txt">' + esc(cab) + '</p></div>' : '') +
      '<div class="h-cuerpo"></div>' +
      '<div class="h-pie"><span>Icewell SpA · <b>icewell.cl</b> · contacto@icewell.cl</span><span class="h-pie__n"></span></div></section>');
    montar(h);
    return { hoja: h, cuerpo: h.querySelector('.h-cuerpo') };
  }
  function desborda(c){ return c.scrollHeight > c.clientHeight + 1; }
  function encabezado(eb, titulo, lead){
    var f = document.createDocumentFragment();
    f.appendChild(el('<p class="eb">' + esc(eb) + '</p>'));
    f.appendChild(el('<h2 class="h2">' + titulo + '</h2>'));
    if(lead) f.appendChild(el('<p class="lead">' + lead + '</p>'));
    return f;
  }

  function hojaPortada(montar){
    var h = el('<section class="hoja">' +
      '<div class="h-portada__iso">' + ISO + '</div>' +
      '<div class="h-portada__logo">' + LOGO + '</div>' +
      '<h1 class="h-portada__t">Ingeniería y montaje<br>de sistemas HVAC</h1>' +
      '<p class="h-portada__l">Asesorías térmicas, ingeniería e instalaciones de climatización, ventilación y calefacción para proyectos en todo Chile.</p>' +
      '<div class="h-portada__banda"><div class="tri"><i></i><i></i><i></i></div>' +
        '<div class="h-portada__datos">' +
          '<div><p class="lbl">Desde</p><p>2009</p></div>' +
          '<div><p class="lbl">Experiencia</p><p><span data-anios>' + ANIOS + '</span> años</p></div>' +
          '<div><p class="lbl">Cobertura</p><p>Todo el país</p></div>' +
          '<div><p class="lbl">Especialidad</p><p>Asesorías,<br>ingeniería y<br>montajes térmicos</p></div>' +
        '</div>' +
        '<div class="h-portada__pie"><span>Presentación corporativa</span><span>Santiago · Chile</span></div>' +
      '</div></section>');
    montar(h);
  }

  function hojaQuienes(montar){
    var h = nuevaHoja(montar, 'Quiénes somos'), c = h.cuerpo;
    c.appendChild(encabezado('La empresa', 'Respuesta ágil y responsable<br>en climatización'));
    c.appendChild(el('<p class="lead">Icewell SpA fue creada a principios de 2009 para responder de manera ágil y responsable a las crecientes necesidades del mercado de aire acondicionado, ventilación y calefacción (HVAC), de acuerdo con los nuevos estándares de calidad, tecnología y cumplimiento de objetivos.</p>'));
    c.appendChild(el('<p class="lead" style="margin-top:4.3mm!important">La compañía está conformada por ingenieros civiles industriales e ingenieros mecánicos jóvenes, dinámicos y comprometidos con las necesidades de sus clientes. Cuentan con la experiencia acumulada durante más de 15 años trabajando para las principales empresas de climatización del país, ejecutando obras de relevancia y realizando proyectos de ingeniería e inspecciones técnicas en construcciones de diversos usos a lo largo de todo Chile.</p>'));
    c.appendChild(el('<div class="kpis">' +
      '<div class="kpi"><strong>2009</strong><span>Año de fundación</span></div>' +
      '<div class="kpi"><strong data-anios>' + ANIOS + '</strong><span>Años de<br>experiencia</span></div>' +
      '<div class="kpi"><strong>51</strong><span>Obras y proyectos<br>registrados</span></div>' +
      '<div class="kpi"><strong>+170.000</strong><span>m² intervenidos en<br>obras destacadas</span></div></div>'));
    var cert = el('<div class="bloque-h2 bloque-h2--primero"><p class="eb">Certificaciones y estándares</p></div>');
    cert.appendChild(el('<div class="chips">' + ['Proyectos con certificación LEED', 'Eficiencia energética', 'ERNC y solar térmica', 'Obras sobre 4.800 msnm']
      .map(function(t){ return '<span class="chip">' + t + '</span>'; }).join('') + '</div>'));
    c.appendChild(cert);
    c.appendChild(el('<div class="caja caja-3">' +
      '<div><p class="lbl">01 · Asesoría</p><p>Informes, evaluación técnico-económica e inspección técnica de obra</p></div>' +
      '<div><p class="lbl">02 · Ingeniería</p><p>Proyectos de climatización, ventilación y calefacción</p></div>' +
      '<div><p class="lbl">03 · Montaje</p><p>Suministro e instalación de sistemas HVAC</p></div></div>'));
  }

  // Van como <img src=data:…>: html2canvas no dibuja SVG en línea hechos solo de trazos (stroke); una imagen data: sí, y no "ensucia" el canvas en file://
  var ICONOS = {
    asesoria: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0062a8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="18" rx="1.5"/><path d="M9 3.5h6v2.5H9z"/><path d="m8.5 12 2 2 4-4"/><path d="M8.5 17.5h7"/></svg>',
    ingenieria: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0062a8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M9 4v16"/><circle cx="15" cy="15" r="2.6"/><path d="M15 11.2v1.2M15 17.6v1.2M11.2 15h1.2M17.6 15h1.2"/></svg>',
    montaje: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0062a8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="1.4"/><path d="M12 10.6c-.4-3.2 1.2-5.4 3.6-5.2 1.8.2 2 2.4.4 3.4-1.3.8-2.8 1-4 1.8"/><path d="M13.3 12.6c2.6 1.8 3.2 4.5 1.4 5.9-1.4 1-3.2-.3-2.8-2.1.3-1.5 1.2-2.7 1.4-3.8"/><path d="M10.7 12.6c-3 1.3-5.5.4-5.9-1.9-.2-1.8 1.9-2.6 3.1-1.3 1 1.1 1.5 2.5 2.8 3.2"/></svg>'
  };
  function hojaServicios(montar){
    var h = nuevaHoja(montar, 'Servicios'), c = h.cuerpo;
    c.appendChild(encabezado('Qué hacemos', 'Tres líneas de servicio,<br>un solo responsable'));
    [['asesoria', 'Asesorías Térmicas', 'Informes a proyectos y evaluaciones técnico-económicas, inspecciones técnicas de obra, cálculos de cargas térmicas y consumo de ACS, entre otros.', ['Evaluación técnico-económica', 'Inspección técnica de obra (ITO)', 'Cargas térmicas y consumo ACS']],
     ['ingenieria', 'Ingeniería', 'Elaboración de proyectos de climatización, ventilación y calefacción para el área comercial, residencial e industrial, con experiencia en eficiencia energética y uso de ERNC.', ['Ingeniería básica y de detalles', 'Eficiencia energética', 'Energías renovables no convencionales']],
     ['montaje', 'Instalaciones', 'Desarrollo de montajes de diversos sistemas HVAC: sistemas de agua, expansión directa, refrigerante variable, volumen variable e instalaciones solares.', ['Suministro y montaje', 'Chiller, fan-coil y UMA', 'VRV / VRF y solar térmica']]
    ].forEach(function(s){
      c.appendChild(el('<article class="srv"><img class="srv__ico" alt="" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ICONOS[s[0]]) + '"><h3>' + s[1] + '</h3><p>' + s[2] + '</p><div class="tags">' +
        s[3].map(function(t){ return '<span class="tag">' + t + '</span>'; }).join('') + '</div></article>'));
    });
    c.appendChild(el('<div class="caja valor"><h3>Propuesta de valor</h3>' +
      '<p>Proyectamos, estudiamos y proponemos soluciones a los requerimientos de nuestros clientes, considerando las mejores alternativas de precios y equipos disponibles en el mercado, para acompañarlos en todas las etapas de ejecución de un proyecto, cumpliendo plazos, estándares de calidad y presupuestos de costos.</p>' +
      '<div class="valor__4"><div>Eficiencia operacional</div><div>Máxima calidad</div><div>Innovación y desarrollo</div><div>Respuesta superior al cliente</div></div></div>'));
  }

  // Conteo facetado: obras que habría eligiendo esa opción, con los OTROS filtros aplicados
  // (sector → región/período/búsqueda; región → sector/período/búsqueda). Mismo número que la barra.
  function contarEn(st, grupo, id){
    var c = { sector: new Set(st.sector), periodo: new Set(st.periodo), region: new Set(st.region), q: st.q };
    c[grupo] = new Set([id]);
    return PROYECTOS.filter(function(p){ return coincide(p, c); }).length;
  }

  var PRE = null;   // bloque de filtros pendiente: lo toma la primera hoja de obras que se abra
  function bloqueFiltros(st, interactivo){
    function chipsDe(grupo, lista){
      var cont = el('<div class="chips"></div>');
      lista.forEach(function(x){
        var sel = st[grupo].has(x.id), n = contarEn(st, grupo, x.id), cero = !n && !sel;
        var num = ' <span class="chip__n">(<b class="cnt" data-k="' + grupo + ':' + x.id + '">' + n + '</b>)</span>';
        cont.appendChild(interactivo
          ? el('<button type="button" class="chip" data-' + grupo + '="' + x.id + '" aria-pressed="' + sel + '"' + (cero ? ' disabled' : '') +
               ' title="' + (cero ? 'Sin obras con los filtros actuales' : 'Ver obras: ' + esc(x.label)) + '">' + esc(x.label) + num + '</button>')
          : el('<span class="chip' + (sel ? ' chip--sel' : '') + (cero ? ' chip--cero' : '') + '">' + esc(x.label) + num + '</span>'));
      });
      return cont;
    }
    var b = el('<div class="filtros-obras"></div>');
    var sect = el('<div class="bloque-h2 bloque-h2--tope"><p class="eb">Sectores atendidos</p></div>'); sect.appendChild(chipsDe('sector', SECTORES)); b.appendChild(sect);
    var cob = el('<div class="bloque-h2"><p class="eb">Cobertura territorial</p></div>'); cob.appendChild(chipsDe('region', REGIONES)); b.appendChild(cob);
    return b;
  }
  function tomarPre(h){ if(PRE){ h.cuerpo.appendChild(PRE); PRE = null; } }

  function filaTray(p){
    return el('<div class="fila" data-id="' + p._id + '"><span>' + p.anio + '</span><div><b>' + esc(p.nombre) + '</b><small>' + esc(p.lugar) + ' · ' + esc(p.sistemas.replace(/\.$/, '')) + '</small></div></div>');
  }

  // Trayectoria: 2 columnas (primero la izquierda, después la derecha), título con el rango de años de cada hoja
  function flujoTrayectoria(montar, items, nota){
    var h, cols, cur, hojas = [];
    function abrir(){
      h = nuevaHoja(montar, 'Trayectoria');
      tomarPre(h);
      h.cuerpo.appendChild(encabezado('Obras ejecutadas', '<span class="js-rango">Trayectoria</span>', nota));
      cols = el('<div class="tray"><div class="tray__col"></div><div class="tray__col"></div></div>');
      h.cuerpo.appendChild(cols);
      cur = cols.children[0];
      hojas.push({ h: h, cols: cols });
    }
    // título por hoja con el rango de años de SUS filas; si todo cupo en la izquierda, repartir mitad y mitad
    function cerrar(x){
      var izq = x.cols.children[0], der = x.cols.children[1];
      if(!der.children.length && izq.children.length > 1){
        Array.from(izq.children).slice(Math.ceil(izq.children.length / 2)).forEach(function(f){ der.appendChild(f); });
      }
      var anios = Array.from(x.cols.querySelectorAll('.fila > span')).map(function(sp){ return +sp.textContent; });
      if(!anios.length) return;
      var mn = Math.min.apply(null, anios), mx = Math.max.apply(null, anios);
      x.h.hoja.querySelector('.js-rango').textContent = mn === mx ? 'Trayectoria ' + mn : 'Trayectoria ' + mn + ' – ' + mx;
    }
    abrir();
    items.forEach(function(p){
      var f = filaTray(p);
      cur.appendChild(f);
      if(desborda(h.cuerpo)){
        cur.removeChild(f);
        if(cur === cols.children[0]){ cur = cols.children[1]; cur.appendChild(f); }
        else { abrir(); cur.appendChild(f); }
      }
    });
    // regla de Manuel: la última hoja no queda con 1–2 filas sueltas → se traen las últimas de la hoja anterior
    if(hojas.length > 1){
      var ult = hojas[hojas.length - 1], ant = hojas[hojas.length - 2];
      var nUlt = ult.cols.querySelectorAll('.fila').length;
      if(nUlt < 3){
        var previas = Array.from(ant.cols.querySelectorAll('.fila')), faltan = 3 - nUlt;
        var izqUlt = ult.cols.children[0];
        previas.slice(previas.length - faltan).reverse().forEach(function(f){ izqUlt.insertBefore(f, izqUlt.firstChild); });
      }
    }
    hojas.forEach(cerrar);
  }

  // SIN FILTRO: sección única "Portafolio" con 2 subgrupos seguidos (no una sección por grupo).
  // Paginación como flujoSeleccion: se abre hoja nueva solo si algo no cabe (título "Portafolio · hoja N").
  // El recuadro azul (Modalidad/Usos/Ubicación) va al final si cabe; si no, se omite.
  function flujoPortafolio(montar, recientes, destacados, st){
    var h = nuevaHoja(montar, 'Portafolio'), numHoja = 1, grid;
    tomarPre(h);
    h.cuerpo.appendChild(encabezado('Portafolio', 'Proyectos',
      'Obras de suministro y montaje en ejecución, recientes y destacadas, en usos privados, comerciales y públicos.'));
    function hojaSiguiente(){
      numHoja++;
      h = nuevaHoja(montar, 'Portafolio');
      h.cuerpo.appendChild(encabezado('Portafolio', 'Proyectos <span class="h2-cont">· hoja ' + numHoja + '</span>'));
    }
    function grupo(titulo, items){
      if(!items.length) return;
      var sub = el('<div class="sub-tray"><p class="eb">' + titulo + '</p></div>');
      h.cuerpo.appendChild(sub);
      grid = el('<div class="grilla"></div>'); h.cuerpo.appendChild(grid);
      var anterior = null;
      items.forEach(function(p, k){
        var t = tarjetaSeleccion(p, st); grid.appendChild(t);
        if(desborda(h.cuerpo)){
          grid.removeChild(t);
          if(k === 0){ sub.remove(); grid.remove(); hojaSiguiente(); h.cuerpo.appendChild(sub); grid = el('<div class="grilla"></div>'); h.cuerpo.appendChild(grid); }
          else { anterior = grid; hojaSiguiente(); grid = el('<div class="grilla"></div>'); h.cuerpo.appendChild(grid); }
          grid.appendChild(t);
        }
      });
      // sin ficha sola al final de un grupo partido
      if(anterior && grid.children.length === 1 && anterior.children.length >= 3) grid.insertBefore(anterior.lastElementChild, grid.firstChild);
    }
    grupo('En ejecución y recientes', recientes);
    grupo('Proyectos destacados', destacados);
    var azul = el('<div class="caja barra-azul">' +
      '<div><p class="lbl">Modalidad</p><p>Suministro y montaje</p></div>' +
      '<div><p class="lbl">Usos</p><p>Privado, comercial y público</p></div>' +
      '<div><p class="lbl">Ubicación</p><p>Región Metropolitana y regiones</p></div></div>');
    h.cuerpo.appendChild(azul);
    if(desborda(h.cuerpo)) azul.remove();
  }

  // CON FILTRO: una sola sección seguida (pedido Manuel: "no tantas secciones, muchas vueltas").
  // Todas las obras con ficha (recientes + destacadas) en una grilla, y debajo "Obras ejecutadas"
  // en 2 columnas, en la misma hoja si caben. Solo se abre hoja nueva cuando algo no cabe.
  function flujoSeleccion(montar, lista, desc, st){
    // Orden: en ejecución primero, después por año (más reciente arriba) y superficie
    var fichas = lista.slice().sort(function(a, b){ return (b.estado === 'ejecucion') - (a.estado === 'ejecucion') || b.anio - a.anio || (b.m2 || 0) - (a.m2 || 0); });
    var n = lista.length;
    var h = nuevaHoja(montar, 'Obras seleccionadas');
    tomarPre(h);
    h.cuerpo.appendChild(encabezado('Portafolio', 'Obras · ' + esc(desc), n + (n === 1 ? ' obra.' : ' obras.')));
    var numHoja = 1;
    function hojaSiguiente(){
      numHoja++;
      h = nuevaHoja(montar, 'Obras seleccionadas');
      h.cuerpo.appendChild(encabezado('Portafolio', 'Obras · ' + esc(desc) + ' <span class="h2-cont">· hoja ' + numHoja + '</span>'));
    }
    var grid = el('<div class="grilla"></div>'), ultimaGrillaAnterior = null; h.cuerpo.appendChild(grid);
    fichas.forEach(function(p){
      var t = tarjetaSeleccion(p, st); grid.appendChild(t);
      if(desborda(h.cuerpo)){ grid.removeChild(t); ultimaGrillaAnterior = grid; hojaSiguiente(); grid = el('<div class="grilla"></div>'); h.cuerpo.appendChild(grid); grid.appendChild(t); }
    });
    // No dejar una ficha sola en la última hoja (regla de Manuel): se pasa una más desde la hoja anterior
    if(ultimaGrillaAnterior && grid.children.length === 1 && ultimaGrillaAnterior.children.length >= 3){
      grid.insertBefore(ultimaGrillaAnterior.lastElementChild, grid.firstChild);
    }
  }

  function hojaDatos(montar){
    var h = el('<section class="hoja">' +
      '<div class="h-datos__top"><div class="h-datos__iso">' + ISO + '</div><h2 class="h-datos__t">Conversemos su<br>próximo proyecto</h2></div>' +
      '<div class="tri h-datos__tri"><i></i><i></i><i></i></div>' +
      '<div class="h-datos__tabla"><p class="eb">Datos de la empresa</p><dl class="dl">' +
        '<dt>Razón social</dt><dd>Icewell SpA</dd>' +
        '<dt>Giro</dt><dd>Asesorías, ingeniería y montajes térmicos</dd>' +
        '<dt>RUT</dt><dd>76.059.117-3</dd>' +
        '<dt>Dirección</dt><dd>Román Díaz #1363, Providencia<small>Santiago, Chile</small></dd>' +
        '<dt>Teléfono</dt><dd>+56 2 2847 0610</dd>' +
        '<dt>Contacto</dt><dd>contacto@icewell.cl<small>gonzalo.diaz@icewell.cl</small></dd>' +
        '<dt>Sitio web</dt><dd>www.icewell.cl</dd>' +
      '</dl></div>' +
      '<div class="h-pie"><span>Icewell SpA · <b>icewell.cl</b> · contacto@icewell.cl</span><span class="h-pie__n"></span></div></section>');
    montar(h);
  }

  // ---------- armado ----------
  // modo: 'pantalla' (chips interactivos + filtro) | 'cv' (CV completo, sin filtro)
  //       | 'proyectos' (CV completo pero solo con las obras filtradas; chips con la selección resaltada)
  function montarEn(destino, modo){
    return modo === 'pantalla'
      ? function(h){ var m = el('<div class="hoja-marco"></div>'); m.appendChild(h); destino.appendChild(m); }
      : function(h){ destino.appendChild(h); };
  }
  // Hojas que no cambian con el filtro (en pantalla se arman UNA vez: no se reconstruyen al filtrar)
  function construirFijas(montar){ hojaPortada(montar); hojaQuienes(montar); hojaServicios(montar); }

  // Hojas de obras + datos. Sin filtro: misma estructura del PDF corporativo (recientes / destacados / trayectoria).
  // Con filtro: una sola sección seguida (flujoSeleccion).
  function construirObras(montar, modo, st){
    var filtrado = modo !== 'cv' && hayFiltro(st);
    var lista = PROYECTOS.filter(function(p){ return modo === 'cv' || coincide(p, st); });
    var vacio = { sector: new Set(), periodo: new Set(), region: new Set(), q: '' };
    PRE = bloqueFiltros(modo === 'cv' ? vacio : st, modo === 'pantalla');

    if(filtrado){
      if(lista.length) flujoSeleccion(montar, lista, descripcion(st), st);
      else {
        var h = nuevaHoja(montar, 'Obras seleccionadas');
        tomarPre(h);
        h.cuerpo.appendChild(encabezado('Portafolio', 'Sin obras', 'Selección: <b>' + esc(descripcion(st)) + '</b>.'));
        h.cuerpo.appendChild(el('<p class="vacio">No hay obras con esta combinación de filtros.</p>'));
      }
    } else {
      // 'destacado' = las 9 del PDF corporativo (ahora muchas más obras tienen m², gracias al CV original)
      var recientes = lista.filter(function(p){ return p.anio >= 2023 && !p.destacado; })
        .sort(function(a, b){ return (b.estado === 'ejecucion') - (a.estado === 'ejecucion') || b.anio - a.anio; });
      var destacados = lista.filter(function(p){ return p.destacado; }).sort(function(a, b){ return b.anio - a.anio || b.m2 - a.m2; });
      var tray = lista.filter(function(p){ return p.anio < 2023 && !p.destacado; }).sort(function(a, b){ return b.anio - a.anio; });
      flujoPortafolio(montar, recientes, destacados, vacio);
      if(tray.length) flujoTrayectoria(montar, tray, 'Proyectos y montajes desarrollados por Icewell SpA a lo largo de Chile.');
    }
    PRE = null;
    hojaDatos(montar);
    return lista.length;
  }

  // numeración (la portada no lleva número, igual que el PDF)
  function numerar(raiz){
    raiz.querySelectorAll('.hoja').forEach(function(h, i){ var n = h.querySelector('.h-pie__n'); if(n) n.textContent = String(i + 1).padStart(2, '0'); });
  }

  // Armado completo (PDF / pruebas)
  function construir(destino, modo, st){
    var montar = montarEn(destino, modo);
    construirFijas(montar);
    var marca = destino.children.length;
    construirObras(montar, modo, st);
    numerar(destino);
    return { primeraObra: destino.children[marca] || null, hojas: destino.querySelectorAll('.hoja').length };
  }

  // ---------- pantalla ----------
  var visor = document.getElementById('visor');
  function ajustarZoom(){
    var px = 210 * 96 / 25.4, disponible = visor.clientWidth - 16;
    document.documentElement.style.setProperty('--z', Math.min(1, disponible / px).toFixed(4));
  }
  // Barra fija: filtros siempre a mano (no hay que subir a la hoja 2). Desplegables <details> con
  // casillas + contador facetado (obras que quedarían con los demás filtros), pastillas ×, Limpiar,
  // período y "Ver N obras ↓". Se re-renderiza en cada cambio conservando qué desplegable estaba abierto.
  var ddAbierto = null, primeraObra = null;
  function contar(grupo, id){ return contarEn(state, grupo, id); }
  function desplegable(grupo, titulo, lista){
    var sel = state[grupo].size;
    return '<details class="dd" data-dd="' + grupo + '"' + (ddAbierto === grupo ? ' open' : '') + '>' +
      '<summary>' + titulo + (sel ? ' <em>' + sel + '</em>' : '') + '</summary><div class="dd__panel" role="group" aria-label="' + titulo + '">' +
      lista.map(function(x){
        var n = contar(grupo, x.id), on = state[grupo].has(x.id);
        return '<label class="dd__op' + (!n && !on ? ' dd__op--cero' : '') + '"><input type="checkbox" data-grupo="' + grupo + '" value="' + x.id + '"' + (on ? ' checked' : '') + (!n && !on ? ' disabled' : '') + '> ' +
          esc(x.label) + ' <small>' + n + '</small></label>';
      }).join('') + '</div></details>';
  }
  function renderBarra(){
    var total = PROYECTOS.filter(function(p){ return coincide(p, state); }).length;
    var html = desplegable('sector', 'Sector', SECTORES) + desplegable('region', 'Región', REGIONES) +
      '<select id="selPeriodo" aria-label="Período"><option value="">Todos los años</option>' +
      PERIODOS.map(function(p){ return '<option value="' + p.id + '"' + (state.periodo.has(p.id) && state.periodo.size === 1 ? ' selected' : '') + '>' + p.label + '</option>'; }).join('') + '</select>';
    if(!hayFiltro(state)){
      html += '<span class="barra__total">Todas las obras (' + total + ')</span>';
    } else {
      state.sector.forEach(function(x){ html += '<button type="button" class="pill" data-quitar="sector:' + x + '">' + esc(SEC[x]) + ' <span aria-hidden="true">×</span></button>'; });
      state.region.forEach(function(x){ html += '<button type="button" class="pill" data-quitar="region:' + x + '">' + esc(REG[x]) + ' <span aria-hidden="true">×</span></button>'; });
      if(state.q) html += '<button type="button" class="pill" data-quitar="q:">"' + esc(state.q) + '" <span aria-hidden="true">×</span></button>';
      html += '<button type="button" class="link-limpiar" data-limpiar>Limpiar</button>';
      html += '<button type="button" class="ver-obras" data-ver-obras' + (total ? '' : ' disabled') + '>Ver ' + total + (total === 1 ? ' obra' : ' obras') + ' ↓</button>';
    }
    document.getElementById('barraFiltro').innerHTML = html;
    document.getElementById('lblProyectos').textContent = hayFiltro(state) ? 'Descargar proyectos (' + total + ')' : 'Descargar proyectos';
  }
  function cerrarDesplegables(){ ddAbierto = null; document.querySelectorAll('.dd[open]').forEach(function(d){ d.open = false; }); }
  // Pantalla: las hojas fijas se arman una sola vez; al filtrar solo se reemplaza #zonaObras.
  // Las hojas nuevas se arman en un contenedor de preparación (en el DOM, oculto, para poder medir)
  // y se cambian de una vez con replaceChildren → sin cuadro vacío, sin parpadeo.
  // Dominó: las obras que se van salen de abajo hacia arriba; las nuevas entran de arriba hacia abajo;
  // las que se quedan no se animan. Solo se anima lo visible en pantalla.
  var zonaFija = null, zonaObras = null, token = 0;
  var ultimoConteo = {};   // último número mostrado por chip, para animar el recuento
  function recontar(animar){
    zonaObras.querySelectorAll('.cnt[data-k]').forEach(function(b){
      var k = b.dataset.k, nuevo = +b.textContent, viejo = ultimoConteo[k];
      ultimoConteo[k] = nuevo;
      if(!animar || SIN_MOV || viejo == null || viejo === nuevo) return;
      b.classList.add(nuevo > viejo ? 'cnt--sube' : 'cnt--baja');
      b.textContent = viejo;
      var t0 = null, dur = 450;
      (function paso(t){
        if(t0 === null) t0 = t;
        var x = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - x, 3);
        b.textContent = Math.round(viejo + (nuevo - viejo) * e);
        if(x < 1) requestAnimationFrame(paso);
        else setTimeout(function(){ b.classList.remove('cnt--sube', 'cnt--baja'); }, 250);
      })(performance.now());
      // si la pestaña está oculta rAF no corre: el valor final queda igual asegurado
      setTimeout(function(){ if(+b.textContent !== nuevo){ b.textContent = nuevo; b.classList.remove('cnt--sube', 'cnt--baja'); } }, dur + 400);
    });
  }
  var SIN_MOV = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function visibles(nodos){
    var alto = window.innerHeight;
    return nodos.filter(function(n){ var r = n.getBoundingClientRect(); return r.bottom > 60 && r.top < alto; });
  }
  function render(scrollAObras, animar){
    var mio = ++token;
    ajustarZoom();
    if(!zonaFija){
      visor.innerHTML = '';
      zonaFija = el('<div id="zonaFija"></div>'); zonaObras = el('<div id="zonaObras"></div>');
      visor.appendChild(zonaFija); visor.appendChild(zonaObras);
      construirFijas(montarEn(zonaFija, 'pantalla'));
    }
    // 1) armar lo nuevo en preparación
    var prep = el('<div class="preparacion" aria-hidden="true"></div>');
    document.body.appendChild(prep);
    construirObras(montarEn(prep, 'pantalla'), 'pantalla', state);
    var nuevos = {}; prep.querySelectorAll('[data-id]').forEach(function(n){ nuevos[n.dataset.id] = 1; });
    var viejos = {}; zonaObras.querySelectorAll('[data-id]').forEach(function(n){ viejos[n.dataset.id] = 1; });
    renderBarra();
    escribirHash();

    // 2) salida en dominó (abajo → arriba) de lo que ya no aplica
    var salen = animar && !SIN_MOV ? visibles(Array.from(zonaObras.querySelectorAll('[data-id]')).filter(function(n){ return !nuevos[n.dataset.id]; })) : [];
    salen.sort(function(a, b){ return b.getBoundingClientRect().top - a.getBoundingClientRect().top || b.getBoundingClientRect().left - a.getBoundingClientRect().left; });
    salen = salen.slice(0, 12);
    salen.forEach(function(n, i){ n.style.animationDelay = (i * 35) + 'ms'; n.classList.add('sale'); });
    var espera = salen.length ? 200 + (salen.length - 1) * 35 : 0;

    setTimeout(function(){
      if(mio !== token){ prep.remove(); return; }            // hubo otro filtro mientras tanto: gana el último
      // 3) cambio de una vez, conservando la posición
      var y = window.scrollY;
      zonaObras.replaceChildren.apply(zonaObras, Array.from(prep.children));
      prep.remove();
      numerar(visor);
      recontar(animar);
      primeraObra = zonaObras.firstElementChild;
      if(!scrollAObras) window.scrollTo({ top: Math.min(y, document.documentElement.scrollHeight - window.innerHeight), behavior: 'instant' });
      else if(primeraObra) primeraObra.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // 4) entrada en dominó (arriba → abajo) de lo nuevo
      if(animar && !SIN_MOV){
        var entran = visibles(Array.from(zonaObras.querySelectorAll('[data-id]')).filter(function(n){ return !viejos[n.dataset.id]; }));
        entran.sort(function(a, b){ return a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
        entran.slice(0, 16).forEach(function(n, i){
          n.style.animationDelay = (i * 45) + 'ms'; n.classList.add('entra');
          n.addEventListener('animationend', function fin(){ n.classList.remove('entra'); n.style.animationDelay = ''; n.removeEventListener('animationend', fin); });
        });
      }
    }, espera);
  }

  function escribirHash(){
    var h = new URLSearchParams();
    ['sector', 'periodo', 'region'].forEach(function(g){ if(state[g].size) h.set(g, Array.from(state[g]).join(',')); });
    if(state.q) h.set('q', state.q);
    var nuevo = h.toString().replace(/%2C/g, ',');
    if(location.hash.slice(1) !== nuevo){ try{ history.replaceState(null, '', nuevo ? '#' + nuevo : location.pathname + location.search); }catch(e){} }
    document.querySelectorAll('.js-version').forEach(function(a){ a.href = 'cv.html' + (nuevo ? '#' + nuevo : ''); });
  }
  function leerHash(){
    var h = new URLSearchParams(location.hash.replace(/^#/, ''));
    var validos = { sector: SEC, periodo: PER, region: REG };
    ['sector', 'periodo', 'region'].forEach(function(g){ state[g] = new Set((h.get(g) || '').split(',').filter(function(x){ return validos[g][x]; })); });
    state.q = h.get('q') || '';
  }
  function copiaEstado(){ return { sector: new Set(state.sector), periodo: new Set(state.periodo), region: new Set(state.region), q: state.q }; }

  document.addEventListener('click', function(e){
    var c = e.target.closest('button.chip[data-sector], button.chip[data-region]');
    if(c){
      var g = c.dataset.sector ? 'sector' : 'region', id = c.dataset.sector || c.dataset.region;
      state[g].has(id) ? state[g].delete(id) : state[g].add(id);
      render(state[g].has(id), true);
      return;
    }
    var q = e.target.closest('[data-quitar]');
    if(q){ var p = q.dataset.quitar.split(':'); if(p[0] === 'q') state.q = ''; else state[p[0]].delete(p[1]); render(false, true); return; }
    if(e.target.closest('[data-limpiar]')){ state.sector.clear(); state.periodo.clear(); state.region.clear(); state.q = ''; render(false, true); return; }
    if(e.target.closest('[data-ver-obras]')){ cerrarDesplegables(); if(primeraObra) primeraObra.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if(!e.target.closest('.dd')) cerrarDesplegables();
    if(e.target.closest('.js-pdf-cv')){ encolar('cv'); return; }
    if(e.target.closest('.js-pdf-proyectos')){ encolar('proyectos'); }
  });
  document.addEventListener('change', function(e){
    // desde la barra no se salta de posición: para eso está "Ver N obras ↓"
    if(e.target.id === 'selPeriodo'){ state.periodo = new Set(e.target.value ? [e.target.value] : []); render(false, true); }
    if(e.target.dataset && e.target.dataset.grupo){
      var g = e.target.dataset.grupo; ddAbierto = g;
      if(e.target.checked) state[g].add(e.target.value); else state[g].delete(e.target.value);
      render(false, true);
      var cb = document.querySelector('.dd[data-dd="' + g + '"] input[value="' + e.target.value + '"]'); if(cb) cb.focus();
    }
  });
  window.addEventListener('hashchange', function(){ leerHash(); render(false); });
  // un solo desplegable abierto a la vez; Esc cierra
  document.addEventListener('toggle', function(e){
    if(!e.target.classList || !e.target.classList.contains('dd')) return;
    if(e.target.open){ ddAbierto = e.target.dataset.dd; document.querySelectorAll('.dd[open]').forEach(function(d){ if(d !== e.target) d.open = false; }); }
    else if(ddAbierto === e.target.dataset.dd) ddAbierto = null;
  }, true);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && document.querySelector('.dd[open]')){ var d = document.querySelector('.dd[open]'); cerrarDesplegables(); d.querySelector('summary').focus(); } });
  var tRes; window.addEventListener('resize', function(){ clearTimeout(tRes); tRes = setTimeout(ajustarZoom, 120); });

  // ---------- PDF: fotografiar las hojas ----------
  var DEMORA_PRUEBA = new URLSearchParams(location.search).get('pdfLento') === '1' ? 3000 : 0;
  var libs = null;
  function cargarLibs(){
    if(libs) return libs;
    libs = PdfCola.cargarScript('assets/vendor/jspdf.umd.min.js')
      .then(function(){ return PdfCola.cargarScript('assets/vendor/html2canvas.min.js'); })
      .then(function(){ return PdfCola.esperar(DEMORA_PRUEBA); })
      .catch(function(err){ libs = null; throw err; });
    return libs;
  }
  function slug(t){ return norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  function encolar(modo){
    var st = copiaEstado(), filtro = hayFiltro(st), desc = descripcion(st);
    var esCV = modo === 'cv';
    var nombre = esCV || !filtro ? 'Icewell-Presentacion-Corporativa.pdf' : 'Icewell-CV-' + slug(desc) + '.pdf';
    PdfCola.encolar({
      etiqueta: esCV || !filtro ? 'Presentación completa' : 'CV · ' + desc,
      ejecutar: function(ctx){
        ctx.aviso('Preparando PDF', 'Cargando herramientas… puedes seguir usando la página.', -1);
        var cont = document.getElementById('exportar'), doc, hojas;
        return cargarLibs()
          .then(function(){ return document.fonts ? document.fonts.ready : null; })
          .then(function(){
            cont.innerHTML = '';
            construir(cont, esCV ? 'cv' : 'proyectos', st);
            hojas = Array.from(cont.querySelectorAll('.hoja'));
            // los íconos son <img src=data:…>: esperar que decodifiquen antes de fotografiar
            return Promise.all(Array.from(cont.querySelectorAll('img')).map(function(im){
              return im.complete ? null : new Promise(function(r){ im.onload = im.onerror = r; });
            }));
          })
          .then(function(){
            doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
            doc.setProperties({ title: esCV ? 'Icewell SpA — Presentación corporativa' : 'Icewell SpA — Proyectos' + (filtro ? ' · ' + desc : ''), author: 'Icewell SpA' });
            var i = 0;
            function siguiente(){
              if(i >= hojas.length) return null;
              ctx.aviso('Armando PDF…', 'Hoja ' + (i + 1) + ' de ' + hojas.length + ' · puedes seguir usando la página.', 5 + Math.round(90 * i / hojas.length));
              return PdfCola.esperar(0).then(function(){
                return window.html2canvas(hojas[i], { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
              }).then(function(canvas){
                if(i) doc.addPage();
                doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
                i++;
                return siguiente();
              });
            }
            return siguiente();
          })
          .then(function(){
            cont.innerHTML = '';
            return { blob: doc.output('blob'), nombre: nombre, paginas: hojas.length };
          }, function(err){ cont.innerHTML = ''; throw err; });
      }
    });
  }
  // precarga silenciosa de jsPDF + html2canvas (~560 KB)
  setTimeout(function(){
    try{ if(navigator.connection && navigator.connection.saveData) return; }catch(e){}
    var go = function(){ cargarLibs().catch(function(){}); };
    ('requestIdleCallback' in window) ? requestIdleCallback(go, { timeout: 4000 }) : go();
  }, 2500);

  // Las hojas se paginan midiendo el texto: esperar las fuentes antes del primer armado
  leerHash();
  var iniciar = function(){ render(false); if(hayFiltro(state)) setTimeout(function(){ var m = visor.querySelectorAll('.hoja-marco')[3]; m && m.scrollIntoView(); }, 80); };
  if(document.fonts && document.fonts.ready){ document.fonts.ready.then(iniciar); } else { iniciar(); }
  window.icewellPresentacion = { construir: construir, state: state };
})();
