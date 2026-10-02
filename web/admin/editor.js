/* ==========================================================================
   ICEWELL — Editor del sitio: núcleo (estado, guardar/publicar, deshacer, pestañas)
   Basado en el editor de CUVOLT, adaptado a Icewell (un idioma, obras, CV) y
   con lo que le faltaba: borrador vs publicado, bloqueo optimista (dos personas
   no se pisan), copia local del borrador por si se corta la sesión o la luz,
   validación en el servidor y vista previa de las 3 páginas.

   Módulos (todos cuelgan de window.Editor):
     editor-campos.js     constructores de campos enlazados al borrador
     editor-secciones.js  pestañas Página principal, Currículum, Empresa, Sectores
     editor-obras.js      pestaña Obras (lista, ficha, portada)
     editor-cuenta.js     Usuarios, Historial, Mi cuenta
     editor-vista.js      vista previa en iframe + clic → campo
     editor-inicio.js     arranque
   ========================================================================== */
(function(){
  'use strict';
  var P = window.Panel;
  var $ = function(id){ return document.getElementById(id); };
  var LOCAL = 'icw_borrador_v1';

  var E = window.Editor = {
    usuario: null, puedePublicar: false, local: false,
    publicado: null,        // contenido de la última versión guardada en el servidor (base de "Descartar")
    draft: null,            // copia de trabajo
    version: 0,             // id de la versión guardada sobre la que se trabaja (bloqueo optimista)
    sinPublicar: false,     // hay versiones guardadas que el sitio todavía no muestra
    dirty: false,
    tabActual: 'inicio',
    tabs: {},
    abiertos: {}            // qué secciones plegables quedaron abiertas
  };
  function clon(o){ return JSON.parse(JSON.stringify(o)); }
  E.clon = clon;

  // ---------------------------------------------------------------- avisos
  E.toast = function(msg, tipo, ms){
    var t = document.createElement('div');
    t.className = 'ed-toast' + (tipo ? ' ed-toast--' + tipo : '');
    t.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    t.textContent = msg;
    $('toasts').appendChild(t);
    setTimeout(function(){ t.classList.add('fuera'); setTimeout(function(){ t.remove(); }, 300); }, ms || (tipo === 'error' ? 7000 : 3800));
  };
  // diálogo propio (no confirm()): se puede leer entero y el botón dice qué pasa
  E.confirmar = function(titulo, cuerpo, op){
    op = op || {};
    var d = $('dialogo');
    $('dialogoTitulo').textContent = titulo;
    var c = $('dialogoCuerpo'); c.textContent = '';
    (Array.isArray(cuerpo) ? cuerpo : [cuerpo]).forEach(function(x){
      if(typeof x === 'string'){ var p = document.createElement('p'); p.textContent = x; c.appendChild(p); } else if(x) c.appendChild(x);
    });
    $('dialogoSi').textContent = op.si || 'Aceptar';
    $('dialogoSi').className = 'btn ' + (op.peligro ? 'btn--peligro' : 'btn--primario');
    $('dialogoNo').hidden = !!op.soloAceptar;
    $('dialogoNo').textContent = op.no || 'Cancelar';
    return new Promise(function(res){
      d.onclose = function(){ res(d.returnValue === 'si'); };
      d.returnValue = '';
      d.showModal();
      (op.peligro ? $('dialogoNo') : $('dialogoSi')).focus();
    });
  };

  // ---------------------------------------------------------------- estado / cabecera
  function actualizarCabecera(){
    var est = $('estado');
    if(E.dirty){ est.textContent = 'Cambios sin guardar'; est.className = 'ed-estado ed-estado--sucio'; }
    else if(E.sinPublicar){ est.textContent = 'Guardado · falta publicar'; est.className = 'ed-estado ed-estado--pendiente'; }
    else { est.textContent = 'Publicado · al día'; est.className = 'ed-estado ed-estado--ok'; }
    $('btnGuardar').disabled = !E.dirty;
    $('btnDescartar').disabled = !E.dirty;
    $('btnPublicar').disabled = !(E.dirty || E.sinPublicar) || !E.puedePublicar;
    $('btnPublicar').title = E.puedePublicar ? 'Hace visibles en el sitio los cambios guardados' : 'Solo un administrador puede publicar. Guarda y avísale.';
    $('btnDeshacer').disabled = pila.i <= 0;
    $('btnRehacer').disabled = pila.i >= pila.s.length - 1;
    document.body.classList.toggle('ed--sucio', E.dirty);
  }
  E.actualizarCabecera = actualizarCabecera;

  // tipo: 'sitio' (textos/empresa: la vista previa se actualiza sin recargar) | 'obras' (recarga la vista previa)
  var tGuardarLocal = null;
  E.cambio = function(tipo){
    E.dirty = true;
    actualizarCabecera();
    if(E.vista) E.vista.programar(tipo || 'sitio');
    clearTimeout(tGuardarLocal);
    tGuardarLocal = setTimeout(guardarLocal, 600);
  };

  // ---------------------------------------------------------------- deshacer / rehacer (en memoria, esta sesión)
  var pila = { s: [], i: -1 };
  E.instantanea = function(){
    var j = JSON.stringify(E.draft);
    if(pila.s[pila.i] === j) return;
    pila.s = pila.s.slice(0, pila.i + 1);
    pila.s.push(j);
    if(pila.s.length > 80) pila.s.shift();
    pila.i = pila.s.length - 1;
    actualizarCabecera();
  };
  function irA(i){
    pila.i = i;
    E.draft = JSON.parse(pila.s[i]);
    E.dirty = pila.s[i] !== JSON.stringify(E.publicado);
    E.render();
    actualizarCabecera();
    if(E.vista) E.vista.programar('obras');
    guardarLocal();
  }
  E.deshacer = function(){ E.instantanea(); if(pila.i > 0) irA(pila.i - 1); };
  E.rehacer = function(){ if(pila.i < pila.s.length - 1) irA(pila.i + 1); };
  function reiniciarPila(){ pila = { s: [JSON.stringify(E.draft)], i: 0 }; }

  // ---------------------------------------------------------------- copia local del borrador
  // Si se corta la sesión, se cierra la pestaña o se va la luz, lo no guardado se ofrece al volver.
  function guardarLocal(){
    try {
      if(E.dirty) localStorage.setItem(LOCAL, JSON.stringify({ base: E.version, fecha: Date.now(), usuario: E.usuario && E.usuario.id, draft: E.draft }));
      else localStorage.removeItem(LOCAL);
    } catch(e){ /* almacenamiento lleno o bloqueado: no es crítico */ }
  }
  E.borrarLocal = function(){ try { localStorage.removeItem(LOCAL); } catch(e){} };
  E.recuperarLocal = function(){
    var g; try { g = JSON.parse(localStorage.getItem(LOCAL) || 'null'); } catch(e){ g = null; }
    if(!g || !g.draft || g.usuario !== (E.usuario && E.usuario.id) || JSON.stringify(g.draft) === JSON.stringify(E.publicado)) return;
    var cuando = new Date(g.fecha).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
    var aviso = g.base === E.version ? '' : 'Ojo: desde entonces alguien guardó otra versión. Si lo recuperas y guardas, revisa que no se pierda lo de esa persona.';
    E.confirmar('Tienes cambios sin guardar', ['Quedó un borrador sin guardar en este navegador (' + cuando + ').', aviso, '¿Quieres recuperarlo?'],
      { si: 'Recuperar borrador', no: 'Descartarlo' }).then(function(si){
      if(si){ E.draft = g.draft; E.dirty = true; E.instantanea(); E.render(); actualizarCabecera(); if(E.vista) E.vista.programar('obras'); E.toast('Borrador recuperado. Revísalo y guarda.'); }
      else E.borrarLocal();
    });
  };

  // ---------------------------------------------------------------- pestañas
  E.registrarTab = function(nombre, def){ E.tabs[nombre] = def; };
  E.tab = function(nombre, sinScroll){
    if(!E.tabs[nombre]) nombre = 'inicio';
    if(E.tabs[nombre].soloAdmin && (!E.usuario || E.usuario.rol !== 'admin')) nombre = 'inicio';
    E.tabActual = nombre;
    document.querySelectorAll('[data-tab]').forEach(function(b){
      var on = b.dataset.tab === nombre;
      b.classList.toggle('activo', on);
      if(b.closest('#tabs')) b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    try { history.replaceState(null, '', '#' + nombre); } catch(e){}
    E.render();
    if(!sinScroll) $('panel').scrollTop = 0;
    document.body.classList.add('ed--panel-abierto');
  };
  E.render = function(){
    var panel = $('panel');
    var y = panel.scrollTop;
    panel.textContent = '';
    try { E.tabs[E.tabActual].render(panel); }
    catch(err){ console.error(err); var p = document.createElement('p'); p.className = 'aviso aviso--error'; p.textContent = 'Error mostrando esta sección: ' + err.message; panel.appendChild(p); }
    panel.scrollTop = y;
  };

  // Ir a un campo por su ruta (clic en la vista previa, errores del servidor)
  E.rutaTab = function(ruta){
    var tipo = ruta.split(':')[0], resto = ruta.slice(tipo.length + 1);
    if(tipo === 'obra') return 'obras';
    if(tipo === 'empresa' || tipo === 'cifras' || tipo === 'config') return 'empresa';
    if(tipo === 'catalogo') return 'catalogos';
    if(tipo === 't') return /^cifras\./.test(resto) ? 'empresa' : /^(cv|pres)\./.test(resto) ? 'cv' : 'inicio';
    if(tipo === 'lista') return /^(cv|presentacion)\./.test(resto) ? 'cv' : 'inicio';
    if(tipo === 'seo') return 'inicio';
    return null;
  };
  E.ir = function(ruta){
    if(ruta.indexOf('obra:') === 0){ E.tab('obras'); if(E.obras) E.obras.abrir(ruta.slice(5)); return; }
    var tab = E.rutaTab(ruta);
    if(!tab) return;
    if(E.tabActual !== tab) E.tab(tab);
    var el = document.querySelector('[data-ruta="' + CSS.escape(ruta) + '"]');
    if(!el) return;
    var det = el.closest('details'); while(det){ det.open = true; det = det.parentElement && det.parentElement.closest('details'); }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var foco = el.matches('input,textarea,select,button') ? el : el.querySelector('input,textarea,select,button');
    if(foco) setTimeout(function(){ foco.focus({ preventScroll: true }); }, 250);
    el.classList.remove('ed-destello'); void el.offsetWidth; el.classList.add('ed-destello');
    document.body.classList.add('ed--panel-abierto');
  };

  // ---------------------------------------------------------------- guardar / publicar / descartar
  // errores del servidor: { campo: 'obras.3.nombre', error } → texto legible
  function describirErrores(errores){
    var ul = document.createElement('ul'); ul.className = 'ed-errores';
    (errores || []).forEach(function(e){
      var li = document.createElement('li');
      var m = /^obras\.(\d+)\./.exec(e.campo);
      var donde = m && E.draft.obras[+m[1]] ? 'Obra «' + E.draft.obras[+m[1]].nombre + '»' : e.campo;
      li.textContent = donde + ': ' + e.error;
      ul.appendChild(li);
    });
    return ul;
  }

  E.guardar = function(){
    if(!E.dirty) return Promise.resolve(true);
    var btn = $('btnGuardar');
    P.ocupado(btn, true);
    return P.api('contenido/guardar', { contenido: E.draft, base: E.version }).then(function(r){
      E.version = r.version;
      if(r.contenido){ E.draft = r.contenido; }
      E.publicado = clon(E.draft);
      E.dirty = false; E.sinPublicar = true;
      E.borrarLocal(); reiniciarPila();
      E.render(); actualizarCabecera();
      E.toast(r.sinCambios ? 'No había cambios que guardar.' : 'Guardado. Todavía no se ve en el sitio: falta Publicar.', 'ok');
      return true;
    }).catch(function(err){
      if(err.estado === 422 && err.datos.errores) E.confirmar('Hay datos por corregir', [err.message, describirErrores(err.datos.errores)], { soloAceptar: true, si: 'Entendido' });
      else if(err.estado === 409) E.confirmar('Otra persona guardó cambios', [err.message, 'Tu borrador quedó guardado en este navegador: al recargar te ofreceremos recuperarlo.'], { soloAceptar: true, si: 'Entendido' });
      else manejarError(err);
      return false;
    }).then(function(ok){ P.ocupado(btn, false); actualizarCabecera(); return ok; });
  };

  E.publicar = function(){
    var cuerpo = ['Los cambios quedarán visibles en el sitio para todos: página principal, currículum, presentación y PDF.'];
    if(E.dirty) cuerpo.push('Primero se guardarán tus cambios.');
    return E.confirmar('¿Publicar en el sitio?', cuerpo, { si: 'Publicar ahora' }).then(function(si){
      if(!si) return;
      return E.guardar().then(function(ok){
        if(!ok) return;
        var btn = $('btnPublicar');
        P.ocupado(btn, true);
        return P.api('contenido/publicar', { version: E.version }).then(function(r){
          E.sinPublicar = false;
          actualizarCabecera();
          E.toast('Publicado. El sitio ya muestra los cambios' + (r.pdf && r.pdf.nuevas ? ' (y ' + r.pdf.nuevas + ' foto(s) nueva(s) en el PDF)' : '') + '.', 'ok', 6000);
          if(r.pdf && r.pdf.faltan && r.pdf.faltan.length) E.toast('Ojo: no se encontraron estas fotos para el PDF: ' + r.pdf.faltan.join(', '), 'error');
          if(E.vista) E.vista.recargar();
        }).catch(function(err){
          if(err.estado === 422 && err.datos.errores) E.confirmar('Hay datos por corregir', [err.message, describirErrores(err.datos.errores)], { soloAceptar: true, si: 'Entendido' });
          else manejarError(err);
        }).then(function(){ P.ocupado(btn, false); actualizarCabecera(); });
      });
    });
  };

  E.descartar = function(){
    E.confirmar('¿Descartar los cambios?', 'Se pierde todo lo que no guardaste y vuelves a la última versión guardada.', { si: 'Descartar cambios', peligro: true }).then(function(si){
      if(!si) return;
      E.draft = clon(E.publicado); E.dirty = false;
      E.borrarLocal(); reiniciarPila();
      E.render(); actualizarCabecera();
      if(E.vista) E.vista.programar('obras');
      E.toast('Cambios descartados.');
    });
  };

  // sesión vencida o sin permiso: el borrador queda en este navegador
  function manejarError(err){
    if(err.estado === 401){
      guardarLocal();
      E.confirmar('Tu sesión expiró', ['Por seguridad la sesión se cierra tras 30 minutos sin actividad.', 'Tus cambios sin guardar quedaron en este navegador: al volver a entrar te ofreceremos recuperarlos.'],
        { soloAceptar: true, si: 'Volver a entrar' }).then(function(){ location.href = './'; });
      return;
    }
    E.toast(err.message, 'error');
  }
  E.error = manejarError;

  // ---------------------------------------------------------------- borrador para la vista previa
  // La vista previa (iframe con ?borrador=1) lo pide vía window.parent.icewellBorrador() (assets/borrador.js)
  window.icewellBorrador = function(){
    if(!E.draft) return null;
    var d = clon(E.draft);
    var sitio = Object.assign({}, d); delete sitio.catalogos; delete sitio.obras;
    return {
      sitio: sitio,
      sectores: d.catalogos.sectores, regiones: d.catalogos.regiones, periodos: d.catalogos.periodos,
      proyectos: d.obras.filter(function(o){ return o.visible !== false; }).map(function(o){ delete o.visible; return o; })
    };
  };

  // ---------------------------------------------------------------- arranque (lo llama editor-inicio.js)
  E.cargar = function(){
    return P.api('sesion').then(function(s){
      E.usuario = s.usuario; E.puedePublicar = s.puedePublicar; E.local = s.local;
      $('nombreUsuario').textContent = s.usuario.nombre.split(' ')[0];
      $('correoUsuario').textContent = s.usuario.email + ' · ' + (s.usuario.rol === 'admin' ? 'administrador' : 'editor');
      $('avatar').textContent = (s.usuario.nombre.match(/\b\p{L}/gu) || ['·']).slice(0, 2).join('').toUpperCase();
      document.querySelectorAll('[data-solo-admin]').forEach(function(el){ el.hidden = s.usuario.rol !== 'admin'; });
      return P.api('contenido');
    }).then(function(r){
      E.publicado = r.contenido; E.draft = clon(r.contenido);
      E.version = r.version; E.sinPublicar = r.sinPublicar;
      reiniciarPila();
      actualizarCabecera();
      return r;
    });
  };

  // ---------------------------------------------------------------- botones y atajos
  $('btnGuardar').addEventListener('click', function(){ E.guardar(); });
  $('btnPublicar').addEventListener('click', function(){ E.publicar(); });
  $('btnDescartar').addEventListener('click', function(){ E.descartar(); });
  $('btnDeshacer').addEventListener('click', function(){ E.deshacer(); });
  $('btnRehacer').addEventListener('click', function(){ E.rehacer(); });
  document.addEventListener('keydown', function(e){
    var mod = e.ctrlKey || e.metaKey;
    if(mod && e.key.toLowerCase() === 's'){ e.preventDefault(); E.guardar(); }
    // dentro de un campo de texto, Ctrl+Z es el deshacer del propio campo
    else if(mod && e.key.toLowerCase() === 'z' && !e.target.matches('input,textarea')){ e.preventDefault(); e.shiftKey ? E.rehacer() : E.deshacer(); }
  });
  window.addEventListener('beforeunload', function(e){ if(E.dirty){ guardarLocal(); e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-tab]');
    if(t){ E.tab(t.dataset.tab); $('menuUsuario').hidden = true; $('btnUsuario').setAttribute('aria-expanded', 'false'); }
  });
  $('btnUsuario').addEventListener('click', function(){
    var m = $('menuUsuario'); m.hidden = !m.hidden; this.setAttribute('aria-expanded', String(!m.hidden));
  });
  document.addEventListener('click', function(e){ if(!e.target.closest('.ed-usuario')){ $('menuUsuario').hidden = true; $('btnUsuario').setAttribute('aria-expanded', 'false'); } });
  $('btnSalir').addEventListener('click', function(){
    (E.dirty ? E.confirmar('Tienes cambios sin guardar', 'Si sales ahora, quedan solo en este navegador (te ofreceremos recuperarlos al volver).', { si: 'Salir igual' }) : Promise.resolve(true))
      .then(function(si){ if(!si) return; guardarLocal(); E.dirty = false; return P.api('auth/salir', {}).catch(function(){}).then(function(){ location.href = './'; }); });
  });
  // Seguro extra contra la "página gris": si algo desplaza el documento (foco en un control oculto,
  // scrollIntoView), se vuelve arriba. En escritorio el documento no debe moverse nunca.
  window.addEventListener('scroll', function(){
    if(window.matchMedia('(min-width: 901px)').matches && (window.scrollY || document.documentElement.scrollTop)) window.scrollTo(0, 0);
  }, { passive: true });
  document.addEventListener('scroll', function(){ if(document.body.scrollTop) document.body.scrollTop = 0; }, true);
  // celular: el panel es un cajón sobre la vista previa
  $('btnVerPanel').addEventListener('click', function(){ document.body.classList.toggle('ed--panel-abierto'); });
})();
