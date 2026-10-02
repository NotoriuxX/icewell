/* ==========================================================================
   ICEWELL — Editor: vista previa
   El sitio real en un iframe con ?borrador=1: assets/borrador.js toma el
   borrador desde window.parent.icewellBorrador() antes de que carguen los datos,
   así se ve exactamente lo que se publicaría.
   - Cambios de texto/empresa: se aplican al vuelo (icewellRender), sin recargar.
   - Cambios de obras/catálogos o en la presentación: se recarga conservando el scroll.
   - Clic en un texto de la vista previa → salta a su campo. Foco en un campo →
     se marca el elemento en la vista previa.
   ========================================================================== */
(function(){
  'use strict';
  var E = window.Editor;
  var frame = document.getElementById('frame'), marco = document.getElementById('marco');
  var pagina = 'index.html', tVivo = null, tRecarga = null, pendienteRecarga = false, scrollGuardado = 0, rutaSel = null, irAlCargar = false;
  var DERIVADOS = { direccionCompleta: 'direccion', ubicacion: 'comuna', ubicacionLarga: 'comuna', ciudadPais: 'ciudad', webCorta: 'web' };

  function win(){ try { return frame.contentWindow; } catch(e){ return null; } }
  function doc(){ try { return frame.contentDocument; } catch(e){ return null; } }

  function url(){ return '../' + pagina + '?borrador=1&preview=0&_=' + Date.now(); }
  function recargar(){
    clearTimeout(tRecarga); clearTimeout(tVivo); pendienteRecarga = false;
    var w = win(); try { scrollGuardado = w && w.location.href !== 'about:blank' ? w.scrollY : 0; } catch(e){ scrollGuardado = 0; }
    frame.src = url();
  }
  function enVivo(){
    var w = win();
    if(!w || typeof w.icewellRender !== 'function' || !window.icewellBorrador){ return recargar(); }
    try { w.ICEWELL_SITIO = window.icewellBorrador().sitio; w.icewellRender(); marcar(rutaSel, false); }
    catch(e){ recargar(); }
  }

  frame.addEventListener('load', function(){
    var d = doc(), w = win();
    if(!d || !w || w.location.href === 'about:blank') return;
    // marca de selección (estilo inyectado en la vista previa, no en el sitio publicado)
    var st = d.createElement('style');
    st.textContent = '.icw-sel{outline:3px solid #1a9614!important;outline-offset:4px!important;border-radius:3px;transition:outline-color .2s}' +
      '[data-t],[data-empresa],[data-cifra],[data-edit],[data-img],[data-anios],[data-desde],[data-obra]{cursor:pointer}' +
      '[data-t]:hover,[data-empresa]:hover,[data-cifra]:hover,[data-edit]:hover,[data-anios]:hover,[data-obra]:hover{outline:1px dashed rgba(26,150,20,.7);outline-offset:3px}';
    d.head.appendChild(st);
    d.addEventListener('click', alHacerClic, true);
    // al cambiar de página para mostrar algo (una obra), se baja hasta eso; si no, se conserva el scroll
    var bajar = irAlCargar; irAlCargar = false;
    if(scrollGuardado && !bajar) setTimeout(function(){ try { w.scrollTo(0, scrollGuardado); } catch(e){} }, 400);
    if(rutaSel) setTimeout(function(){ marcar(rutaSel, bajar); }, bajar ? 900 : 500);
  });

  // ---------- clic en la vista previa → campo ----------
  function rutaDe(n){
    // los años no se escriben: salen de la fecha de fundación
    if(n.hasAttribute('data-anios') || n.hasAttribute('data-desde')) return 'config:fundacion';
    if(n.hasAttribute('data-obra')) return n.getAttribute('data-obra') ? 'obra:' + n.getAttribute('data-obra') : null;
    if(n.hasAttribute('data-t')) return 't:' + n.getAttribute('data-t');
    if(n.hasAttribute('data-empresa')){ var k = n.getAttribute('data-empresa'); return 'empresa:' + (DERIVADOS[k] || k); }
    if(n.hasAttribute('data-cifra')) return 'cifras:' + n.getAttribute('data-cifra');
    if(n.hasAttribute('data-img')) return 'lista:inicio.' + n.getAttribute('data-img');
    if(n.hasAttribute('data-edit')){ var e = n.getAttribute('data-edit'); return e.indexOf('obra:') === 0 ? e : 'lista:' + e; }
    return null;
  }
  function alHacerClic(ev){
    var t = ev.target;
    var a = t.closest('a[href]');
    var interactivo = t.closest('button, input, select, label, summary, .chip, .dd');
    var n = t.closest('[data-anios],[data-desde],[data-t],[data-empresa],[data-cifra],[data-img],[data-edit],[data-obra]');
    if(a && !interactivo){
      var h = a.getAttribute('href') || '';
      // dentro de la misma página (#proyectos) se deja; salir del sitio o abrir WhatsApp no
      if(h.charAt(0) !== '#') ev.preventDefault();
    }
    if(interactivo && !n) return;   // chips, filtros, botones del CV: funcionan normal
    var ruta = n ? rutaDe(n) : null;
    // presentación: sus textos se arman en JS (sin marcas); llevan a su sección del panel
    if(!ruta && pagina === 'cv-presentacion.html' && t.closest('.hoja')){
      ruta = 't:pres.portadaTitulo';
      E.toast('Los textos de la presentación están en Currículum → «Versión presentación».');
    }
    if(!ruta) return;
    ev.preventDefault(); ev.stopPropagation();
    if(ruta === 'config:fundacion') E.toast('Los años se calculan solos desde la fecha de fundación (Empresa y contacto → Aniversario).', '', 5500);
    marcar(ruta, false);
    E.ir(ruta);
  }

  // ---------- campo → vista previa ----------
  function selector(ruta){
    var tipo = ruta.split(':')[0], k = ruta.slice(tipo.length + 1);
    var esc = function(s){ return CSS.escape(s); };
    if(tipo === 't') return '[data-t="' + esc(k) + '"]';
    if(tipo === 'empresa'){
      var otros = Object.keys(DERIVADOS).filter(function(d){ return DERIVADOS[d] === k; }).map(function(d){ return '[data-empresa="' + d + '"]'; });
      return ['[data-empresa="' + esc(k) + '"]'].concat(otros).join(',');
    }
    if(tipo === 'cifras') return '[data-cifra="' + esc(k) + '"]';
    if(tipo === 'lista') return k.indexOf('inicio.heroFoto') === 0 ? '[data-img="heroFoto"]' : '[data-edit="' + esc(k) + '"]';
    if(tipo === 'obra') return '[data-edit="' + esc(ruta) + '"],[data-obra="' + esc(k) + '"]';
    if(tipo === 'config' && k === 'fundacion') return '[data-anios],[data-desde]';
    return null;
  }
  function marcar(ruta, desplazar){
    var d = doc(); if(!d) return;
    d.querySelectorAll('.icw-sel').forEach(function(x){ x.classList.remove('icw-sel'); });
    rutaSel = ruta;
    var sel = ruta && selector(ruta); if(!sel) return;
    var nodos = Array.from(d.querySelectorAll(sel)).filter(function(x){ var r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if(!nodos.length) return;
    nodos[0].classList.add('icw-sel');
    if(desplazar) nodos[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ---------- barra: página y tamaño ----------
  document.querySelectorAll('[data-pagina]').forEach(function(b){
    b.addEventListener('click', function(){ cambiarPagina(b.dataset.pagina); });
  });
  document.querySelectorAll('[data-ancho]').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('[data-ancho]').forEach(function(x){ x.classList.toggle('activo', x === b); });
      marco.dataset.ancho = b.dataset.ancho;
    });
  });

  function cambiarPagina(nueva){
    document.querySelectorAll('[data-pagina]').forEach(function(x){ x.classList.toggle('activo', x.dataset.pagina === nueva); });
    pagina = nueva; scrollGuardado = 0;
    document.getElementById('ayudaVista').textContent = pagina === 'cv-presentacion.html'
      ? 'La presentación se arma por hojas: sus textos se editan en la pestaña Currículum. Se recarga sola con cada cambio.'
      : 'Vista previa con tus cambios sin publicar. Haz clic en un texto para ir a su campo.';
    frame.src = url();
  }

  E.vista = {
    /** Lleva la vista previa a una obra: donde = 'portada' | 'cv' | 'presentacion' (o automático). */
    mostrarObra: function(id, donde){
      var o = (E.draft.obras || []).filter(function(x){ return x.id === id; })[0];
      if(!o) return;
      if(o.visible === false){ E.toast('Esta obra está oculta: no aparece en el sitio.'); return; }
      donde = donde || (o.portada && o.foto ? 'portada' : 'cv');
      var destino = { portada: 'index.html', cv: 'cv.html', presentacion: 'cv-presentacion.html' }[donde];
      rutaSel = 'obra:' + id;
      if(destino === pagina){ marcar(rutaSel, true); return; }
      irAlCargar = true;
      cambiarPagina(destino);
    },
    iniciar: function(){ marco.dataset.ancho = 'escritorio'; frame.src = url(); },
    recargar: recargar,
    resaltar: function(ruta){ marcar(ruta, true); },
    // tipo 'sitio': al vuelo; 'obras' (o la presentación, que arma todo en JS): recarga
    programar: function(tipo){
      if(tipo === 'obras' || pagina === 'cv-presentacion.html') pendienteRecarga = true;
      if(pendienteRecarga){ clearTimeout(tVivo); clearTimeout(tRecarga); tRecarga = setTimeout(recargar, 700); }
      else { clearTimeout(tVivo); tVivo = setTimeout(enVivo, 150); }
    }
  };
})();
