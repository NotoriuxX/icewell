/* ==========================================================================
   ICEWELL — Editor: pestaña Obras
   Lista con búsqueda y filtros → ficha de cada obra → orden de la portada.

   Dónde aparece una obra (reglas del sitio, se muestran en la ficha):
     - Página principal (portafolio): si está marcada "en portada". EXIGE foto.
     - Currículum · "Obras destacadas y recientes": si tiene foto.
     - Currículum · "Trayectoria": siempre (con o sin foto).
     - Presentación · "Proyectos destacados": si está marcada como destacada.
     - Oculta: no aparece en ningún lado (queda guardada en el panel).
   ========================================================================== */
(function(){
  'use strict';
  var E = window.Editor, F = E.campos, el = F.el;
  var vista = { modo: 'lista', id: null, q: '', filtro: '', sector: '' };
  var fmtN = new Intl.NumberFormat('es-CL');

  function obras(){ return E.draft.obras; }
  function porId(id){ return obras().filter(function(o){ return o.id === id; })[0]; }
  function slug(t){ return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56); }
  function idUnico(base){ var id = base || 'obra', k = 2; while(porId(id)) id = base + '-' + k++; return id; }
  function norm(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function enPortada(){ return obras().filter(function(o){ return o.portada && o.visible !== false; }).sort(function(a, b){ return (a.ordenPortada || 0) - (b.ordenPortada || 0); }); }
  function renumerarPortada(){ enPortada().forEach(function(o, i){ o.ordenPortada = i + 1; }); }

  function dondeAparece(o){
    if(o.visible === false) return [['Oculta: no aparece en el sitio', 'off']];
    var l = [];
    l.push(o.portada && o.foto ? ['Página principal · portafolio', 'si'] : ['Página principal: no (márcala «en portada»; necesita foto)', 'no']);
    l.push(o.foto ? ['Currículum · obras destacadas y recientes (tarjeta con foto)', 'si'] : ['Currículum · tarjetas: no, falta foto', 'no']);
    l.push(['Currículum · trayectoria', 'si']);
    l.push(o.destacado ? ['Presentación · proyectos destacados', 'si'] : (o.anio >= 2023 ? ['Presentación · en ejecución y recientes', 'si'] : ['Presentación · trayectoria', 'si']));
    return l;
  }

  E.obras = {
    abrir: function(id){
      vista.modo = 'ficha'; vista.id = id; E.render(); document.getElementById('panel').scrollTop = 0;
      // la vista previa salta a la obra (portada si está ahí; si no, el CV) para que se vea qué se edita
      var o = porId(id);
      if(o && !o._nueva && E.vista) E.vista.mostrarObra(id);
    },
    verPortada: function(){ vista.modo = 'portada'; E.render(); }
  };

  // ==================================================================== lista
  function renderLista(p){
    var todas = obras(), cat = E.draft.catalogos;
    F.encabezado(p, 'Obras', todas.length + ' obras · ' + todas.filter(function(o){ return o.foto; }).length + ' con foto · ' + enPortada().length + ' en la portada.');
    var barra = el('div', 'ed-obras-barra');
    var nueva = el('button', 'btn btn--primario', '+ Nueva obra'); nueva.type = 'button';
    nueva.addEventListener('click', function(){
      var anio = new Date().getFullYear();
      var o = { id: idUnico('nueva-obra'), nombre: '', anio: anio, lugar: '', regiones: [], sectores: [], uso: '', sistemas: '', m2: null, foto: null,
        estado: 'ejecucion', tags: [], cliente: 'Privado', trabajo: 'Suministro y montaje', visible: true, _nueva: true };
      obras().unshift(o);
      E.cambio('obras'); E.instantanea();
      E.obras.abrir(o.id);
    });
    var port = el('button', 'btn btn--secundario', 'Ordenar portada'); port.type = 'button';
    port.addEventListener('click', function(){ E.obras.verPortada(); });
    barra.appendChild(nueva); barra.appendChild(port);
    p.appendChild(barra);

    var filtros = el('div', 'ed-obras-filtros');
    var q = el('input', 'entrada'); q.type = 'search'; q.placeholder = 'Buscar por nombre, lugar o sistema'; q.value = vista.q; q.setAttribute('aria-label', 'Buscar obras');
    var f = el('select', 'entrada'); f.setAttribute('aria-label', 'Filtrar');
    [['', 'Todas'], ['portada', 'En la portada'], ['foto', 'Con foto'], ['sinfoto', 'Sin foto'], ['destacada', 'Destacadas (presentación)'], ['ejecucion', 'En ejecución'], ['revisar', 'Con nota «revisar»'], ['ocultas', 'Ocultas']]
      .forEach(function(x){ var o = el('option', '', x[1]); o.value = x[0]; o.selected = vista.filtro === x[0]; f.appendChild(o); });
    var sct = el('select', 'entrada'); sct.setAttribute('aria-label', 'Sector');
    [{ id: '', label: 'Todos los sectores' }].concat(cat.sectores).forEach(function(x){ var o = el('option', '', x.label); o.value = x.id; o.selected = vista.sector === x.id; sct.appendChild(o); });
    filtros.appendChild(q); filtros.appendChild(f); filtros.appendChild(sct);
    p.appendChild(filtros);

    var lista = el('div', 'ed-obras-lista');
    var cuenta = el('p', 'ed-ayuda');
    p.appendChild(cuenta);
    p.appendChild(lista);
    function pintar(){
      lista.textContent = '';
      var palabras = norm(vista.q).split(/\s+/).filter(Boolean);
      var res = todas.filter(function(o){
        if(vista.sector && o.sectores.indexOf(vista.sector) < 0) return false;
        switch(vista.filtro){
          case 'portada': if(!o.portada) return false; break;
          case 'foto': if(!o.foto) return false; break;
          case 'sinfoto': if(o.foto) return false; break;
          case 'destacada': if(!o.destacado) return false; break;
          case 'ejecucion': if(o.estado !== 'ejecucion') return false; break;
          case 'revisar': if(!o.revisar) return false; break;
          case 'ocultas': if(o.visible !== false) return false; break;
        }
        var t = norm([o.nombre, o.lugar, o.uso, o.sistemas, o.anio].join(' '));
        return palabras.every(function(w){ return t.indexOf(w) >= 0; });
      });
      cuenta.textContent = res.length === todas.length ? '' : res.length + ' de ' + todas.length + ' obras';
      res.forEach(function(o){
        var b = el('button', 'ed-obra' + (o.visible === false ? ' ed-obra--oculta' : '')); b.type = 'button';
        b.dataset.ruta = 'obra:' + o.id;
        var mini = el('span', 'ed-obra__foto');
        if(o.foto){ var im = el('img'); im.src = '../assets/' + o.foto; im.alt = ''; im.loading = 'lazy'; mini.appendChild(im); }
        else mini.textContent = 'Sin foto';
        var txt = el('span', 'ed-obra__txt');
        txt.appendChild(el('strong', '', o.nombre || '(obra sin nombre)'));
        txt.appendChild(el('span', '', [o.anio, o.lugar, o.sectores.map(function(s){ var x = cat.sectores.filter(function(y){ return y.id === s; })[0]; return x ? x.label : s; }).join(', ')].filter(Boolean).join(' · ')));
        var marcas = el('span', 'ed-obra__marcas');
        if(o.portada) marcas.appendChild(el('span', 'ed-marca ed-marca--azul', 'Portada'));
        if(o.destacado) marcas.appendChild(el('span', 'ed-marca ed-marca--verde', 'Destacada'));
        if(o.estado === 'ejecucion') marcas.appendChild(el('span', 'ed-marca', 'En ejecución'));
        if(o.visible === false) marcas.appendChild(el('span', 'ed-marca ed-marca--gris', 'Oculta'));
        if(o.revisar) { var r = el('span', 'ed-marca ed-marca--amarilla', 'Revisar'); r.title = o.revisar; marcas.appendChild(r); }
        txt.appendChild(marcas);
        b.appendChild(mini); b.appendChild(txt);
        b.addEventListener('click', function(){ E.obras.abrir(o.id); });
        lista.appendChild(b);
      });
      if(!res.length) lista.appendChild(el('p', 'ed-vacio', 'No hay obras con ese filtro.'));
    }
    var tq;
    q.addEventListener('input', function(){ clearTimeout(tq); tq = setTimeout(function(){ vista.q = q.value; pintar(); }, 120); });
    f.addEventListener('change', function(){ vista.filtro = f.value; pintar(); });
    sct.addEventListener('change', function(){ vista.sector = sct.value; pintar(); });
    pintar();
  }

  // ==================================================================== ficha
  function renderFicha(p){
    var o = porId(vista.id);
    if(!o){ vista.modo = 'lista'; return renderLista(p); }
    var cat = E.draft.catalogos;
    var volver = el('button', 'ed-volver', '← Todas las obras'); volver.type = 'button';
    volver.addEventListener('click', function(){
      if(o._nueva && !o.nombre){ obras().splice(obras().indexOf(o), 1); E.cambio('obras'); }
      vista.modo = 'lista'; E.render();
    });
    p.appendChild(volver);
    var h = F.encabezado(p, o.nombre || 'Nueva obra');
    var titulo = h.querySelector('h1');

    if(o.revisar){
      var n = F.nota(p, 'Pendiente de confirmar con Icewell: ' + o.revisar, 'error');
      var listo = el('button', 'enlace', 'Ya está confirmado: quitar la nota'); listo.type = 'button';
      listo.addEventListener('click', function(){ delete o.revisar; E.cambio('obras'); E.instantanea(); E.render(); });
      n.appendChild(document.createTextNode(' ')); n.appendChild(listo);
    }

    // dónde aparece (se recalcula al cambiar foto / portada / destacada / visible)
    var donde = el('ul', 'ed-donde');
    function pintarDonde(){
      donde.textContent = '';
      dondeAparece(o).forEach(function(x){ donde.appendChild(el('li', 'ed-donde--' + x[1], x[0])); });
    }
    var sd = F.seccion(p, 'Dónde aparece', { clave: 'obra-donde' });
    sd.appendChild(donde); pintarDonde();
    // botones para ver la obra en la vista previa (solo donde aplica)
    var ver = el('div', 'ed-ver-obra');
    [['portada', 'Ver en la portada', o.portada && o.foto], ['cv', 'Ver en el CV', true], ['presentacion', 'Ver en la presentación', true]].forEach(function(x){
      if(!x[2] || o.visible === false) return;
      var b = el('button', 'btn btn--secundario btn--chico', x[1]); b.type = 'button';
      b.addEventListener('click', function(){ if(E.vista) E.vista.mostrarObra(o.id, x[0]); });
      ver.appendChild(b);
    });
    if(ver.childNodes.length && !o._nueva) sd.appendChild(ver);

    var s = F.seccion(p, 'Datos de la obra', { clave: 'obra-datos' });
    F.texto(s, 'Nombre', o, 'nombre', { max: 200, tipo: 'obras', requerido: true, ruta: 'obra:' + o.id, alCambiar: function(v){
      titulo.textContent = v || 'Nueva obra';
      // mientras sea nueva, el identificador se arma del nombre (después ya no cambia: lo usan enlaces)
      if(o._nueva){ var antes = o.id; o.id = 'x'; o.id = idUnico(slug(v) || 'obra'); if(vista.id === antes) vista.id = o.id; }
    } });
    var g = F.grilla(s);
    F.numero(g, 'Año', o, 'anio', { tipo: 'obras', min: 1990, maxNum: 2100, alCambiar: pintarDonde });
    F.selector(g, 'Estado', o, 'estado', [['ejecucion', 'En ejecución'], ['ejecutado', 'Ejecutada']], { tipo: 'obras' });
    F.selector(g, 'Cliente', o, 'cliente', [['Privado', 'Privado'], ['Público', 'Público']], { tipo: 'obras', ayuda: 'Es la etiqueta de la tarjeta.' });
    g = F.grilla(s);
    F.texto(g, 'Lugar (comuna o ciudad)', o, 'lugar', { max: 150, tipo: 'obras' });
    F.texto(g, 'Uso', o, 'uso', { max: 150, tipo: 'obras', placeholder: 'Ej: Bodegas y oficinas' });
    F.chips(s, 'Sectores', o, 'sectores', cat.sectores, { ayuda: 'Al menos uno. El primero es el que se muestra en la tarjeta.',
      crear: { etiqueta: '+ Nuevo sector', placeholder: 'Ej: Energía', fn: function(n){ return F.agregarACatalogo(cat.sectores, n); } } });
    F.chips(s, 'Regiones', o, 'regiones', cat.regiones, {
      crear: { etiqueta: '+ Nueva región', placeholder: 'Ej: Magallanes', fn: function(n){ return F.agregarACatalogo(cat.regiones, n); } } });
    g = F.grilla(s);
    var trabajo = F.texto(g, 'Tipo de trabajo', o, 'trabajo', { max: 80, tipo: 'obras' });
    var dl = el('datalist'); dl.id = 'trabajos'; ['Suministro y montaje', 'Proyecto y montaje', 'Proyecto', 'Montaje', 'Ingeniería'].forEach(function(t){ var x = el('option'); x.value = t; dl.appendChild(x); });
    s.appendChild(dl); trabajo.setAttribute('list', 'trabajos');
    F.numero(g, 'Superficie (m²)', o, 'm2', { tipo: 'obras', min: 0, maxNum: 10000000, ayuda: 'Vacío si no se conoce.' });
    F.texto(s, 'Sistemas instalados (resumen)', o, 'sistemas', { multi: true, max: 1000, tipo: 'obras', requerido: true, ayuda: 'Va en la trayectoria y en las fichas de la presentación.' });
    F.texto(s, 'Detalle (opcional)', o, 'detalle', { multi: true, max: 1500, tipo: 'obras', ayuda: 'Si existe, reemplaza al resumen en las tarjetas con foto del CV.' });
    var tags = { v: (o.tags || []).join(', ') };
    F.texto(s, 'Etiquetas (opcional)', tags, 'v', { max: 200, tipo: 'obras', placeholder: 'LEED, Gran altura, Solar/ERNC', ayuda: 'Separadas por coma. Aparecen en la trayectoria y en el buscador.',
      alCambiar: function(v){ o.tags = v.split(',').map(function(t){ return t.trim(); }).filter(Boolean).slice(0, 10); } });

    s = F.seccion(p, 'Foto', { clave: 'obra-foto' });
    F.imagen(s, 'Foto de la obra', o, 'foto', { tipo: 'obra', opcional: true, vacio: null, cambio: 'obras', nombre: function(){ return o.nombre; },
      ayuda: 'Horizontal, mínimo 1200 px de ancho. Sin foto la obra va solo en la trayectoria.',
      alCambiar: function(){ if(!o.foto && o.portada){ delete o.portada; delete o.ordenPortada; delete o.portadaAncha; renumerarPortada(); E.toast('Se quitó de la portada: la portada exige foto.'); } E.render(); } });
    F.texto(s, 'Descripción de la foto', o, 'alt', { max: 200, tipo: 'obras', placeholder: o.nombre, ayuda: 'Para lectores de pantalla y Google. Vacío = el nombre de la obra.' });

    s = F.seccion(p, 'Dónde mostrarla', { clave: 'obra-mostrar' });
    F.interruptor(s, 'Mostrar en la página principal (portafolio)', o, 'portada', { tipo: 'obras', borrarSiNo: true,
      deshabilitado: o.foto ? '' : 'Primero sube una foto: la portada solo muestra obras con foto.',
      ayuda: 'Se recomiendan 6 obras en la portada (hoy hay ' + enPortada().length + ').',
      alCambiar: function(si){ if(si){ o.ordenPortada = enPortada().length + 1; } else { delete o.ordenPortada; delete o.portadaAncha; } renumerarPortada(); E.render(); } });
    if(o.portada){
      F.interruptor(s, 'Tarjeta ancha en la portada (ocupa dos columnas)', o, 'portadaAncha', { tipo: 'obras', borrarSiNo: true,
        alCambiar: function(si){ if(si) obras().forEach(function(x){ if(x !== o) delete x.portadaAncha; }); } });
      F.texto(s, 'Texto de la tarjeta en la portada (opcional)', o, 'textoPortada', { max: 300, tipo: 'obras', placeholder: [o.lugar, o.sistemas].filter(Boolean).join(' · ') });
    }
    F.interruptor(s, 'Destacada en la presentación corporativa', o, 'destacado', { tipo: 'obras', borrarSiNo: true, alCambiar: pintarDonde,
      ayuda: 'Las del PDF corporativo son 9 (hoy hay ' + obras().filter(function(x){ return x.destacado; }).length + ').' });
    F.interruptor(s, 'Visible en el sitio', o, 'visible', { tipo: 'obras', alCambiar: pintarDonde, ayuda: 'Apágalo para ocultarla sin borrarla.' });

    s = F.seccion(p, 'Nota interna', { clave: 'obra-nota', abierta: !!o.revisar });
    F.texto(s, 'Pendiente de confirmar (no se publica en el sitio)', o, 'revisar', { multi: true, max: 300, tipo: 'obras' });

    var acc = el('div', 'ed-ficha-acc');
    var dup = el('button', 'btn btn--secundario', 'Duplicar obra'); dup.type = 'button';
    dup.addEventListener('click', function(){
      var c = E.clon(o); c.id = idUnico(o.id + '-copia'); c.nombre = o.nombre + ' (copia)'; delete c.portada; delete c.ordenPortada; delete c.portadaAncha; delete c._nueva;
      obras().splice(obras().indexOf(o) + 1, 0, c); E.cambio('obras'); E.instantanea(); E.obras.abrir(c.id);
    });
    var borrar = el('button', 'btn btn--peligro', 'Eliminar obra'); borrar.type = 'button';
    borrar.addEventListener('click', function(){
      E.confirmar('¿Eliminar «' + (o.nombre || 'esta obra') + '»?', ['Desaparece del sitio al publicar. Si solo quieres sacarla un tiempo, mejor apaga «Visible en el sitio».', 'Hasta guardar se puede deshacer con ↶, y después se puede recuperar desde Historial.'],
        { si: 'Eliminar', peligro: true }).then(function(si){
        if(!si) return;
        obras().splice(obras().indexOf(o), 1); renumerarPortada();
        E.cambio('obras'); E.instantanea(); vista.modo = 'lista'; E.render();
        E.toast('Obra eliminada del borrador.');
      });
    });
    acc.appendChild(dup); acc.appendChild(borrar);
    p.appendChild(acc);
  }

  // ==================================================================== orden de la portada
  function renderPortada(p){
    var volver = el('button', 'ed-volver', '← Todas las obras'); volver.type = 'button';
    volver.addEventListener('click', function(){ vista.modo = 'lista'; E.render(); });
    p.appendChild(volver);
    F.encabezado(p, 'Portafolio de la página principal', 'Estas obras salen en la página principal, en este orden. Todas tienen foto. Para agregar otra, ábrela y activa «Mostrar en la página principal».');
    var lista = enPortada();
    if(!lista.length) F.nota(p, 'No hay obras en la portada.', 'error');
    var cont = el('ol', 'ed-portada');
    lista.forEach(function(o, i){
      var li = el('li', 'ed-portada__item');
      var im = el('img'); im.src = '../assets/' + o.foto; im.alt = '';
      var t = el('span', 'ed-portada__txt'); t.appendChild(el('strong', '', o.nombre)); t.appendChild(el('span', '', o.anio + (o.portadaAncha ? ' · tarjeta ancha' : '')));
      var acc = el('span', 'ed-item__acc');
      [['↑', i > 0, function(){ mover(i, -1); }], ['↓', i < lista.length - 1, function(){ mover(i, 1); }]].forEach(function(b){
        var bt = el('button', 'ed-mini', b[0]); bt.type = 'button'; bt.disabled = !b[1]; bt.setAttribute('aria-label', (b[0] === '↑' ? 'Subir ' : 'Bajar ') + o.nombre); bt.addEventListener('click', b[2]); acc.appendChild(bt);
      });
      var abrir = el('button', 'enlace', 'Editar'); abrir.type = 'button'; abrir.addEventListener('click', function(){ E.obras.abrir(o.id); });
      var quitar = el('button', 'enlace', 'Quitar'); quitar.type = 'button';
      quitar.addEventListener('click', function(){ delete o.portada; delete o.ordenPortada; delete o.portadaAncha; renumerarPortada(); E.cambio('obras'); E.instantanea(); E.render(); });
      acc.appendChild(abrir); acc.appendChild(quitar);
      li.appendChild(im); li.appendChild(t); li.appendChild(acc);
      cont.appendChild(li);
    });
    p.appendChild(cont);
    function mover(i, d){
      var a = lista[i], b = lista[i + d], t = a.ordenPortada; a.ordenPortada = b.ordenPortada; b.ordenPortada = t;
      E.cambio('obras'); E.instantanea(); E.render();
    }
    var candidatas = obras().filter(function(o){ return !o.portada && o.foto && o.visible !== false; });
    if(candidatas.length){
      var s = F.seccion(p, 'Agregar a la portada', { clave: 'port-agregar', abierta: lista.length < 6, ayuda: 'Obras con foto que hoy no están en la portada.' });
      var g = el('div', 'ed-candidatas');
      candidatas.forEach(function(o){
        var b = el('button', 'ed-candidata'); b.type = 'button';
        var im = el('img'); im.src = '../assets/' + o.foto; im.alt = ''; im.loading = 'lazy';
        b.appendChild(im); b.appendChild(el('span', '', o.nombre + ' · ' + o.anio));
        b.addEventListener('click', function(){ o.portada = true; o.ordenPortada = enPortada().length + 1; renumerarPortada(); E.cambio('obras'); E.instantanea(); E.render(); });
        g.appendChild(b);
      });
      s.appendChild(g);
    }
  }

  E.registrarTab('obras', { render: function(p){
    if(vista.modo === 'ficha') renderFicha(p);
    else if(vista.modo === 'portada') renderPortada(p);
    else renderLista(p);
  } });
})();
