/* ==========================================================================
   ICEWELL — Formulario «Cuéntanos tu proyecto» (index.html)
   Una pregunta por pantalla: nombre → correo → qué necesita → mensaje → resumen.
   Lo abre cualquier elemento con [data-abrir-formulario]. Envía a api/?r=contacto
   (servidor/lib/Solicitudes.php: valida, guarda y avisa por correo a la empresa).
   - Accesible: diálogo modal, foco atrapado, Esc cierra, errores con aria-live.
   - Lo que escribe la persona se pone siempre con textContent (nunca innerHTML).
   - Sin servidor (doble clic) o si falla la red: ofrece enviar lo mismo por correo
     (mailto con todo escrito) o por WhatsApp; nunca se pierde lo escrito.
   - Anti-spam: campo trampa "web" (oculto) y el tiempo desde que se abrió (ms).
   ========================================================================== */
(function(){
  'use strict';
  var TIPOS = [['proyecto', 'Proyecto nuevo'], ['mantencion', 'Mantención'], ['asesoria', 'Asesoría'], ['otro', 'Otro']];
  var TOTAL = 5;
  var API = 'api/?r=contacto';
  var reducido = false;
  try{ reducido = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}

  var datos = { nombre: '', correo: '', tipo: '', mensaje: '', telefono: '' };
  var paso = 1, abierto = 0, origen = null, raiz, enviando = false;

  function el(tag, clase, texto){
    var n = document.createElement(tag);
    if(clase) n.className = clase;
    if(texto != null) n.textContent = texto;
    return n;
  }
  function boton(clase, texto){ var b = el('button', clase, texto); b.type = 'button'; return b; }
  function campo(id, etiqueta, input){
    var w = el('div', 'cf__campo');
    var l = el('label', 'cf__etq', etiqueta); l.htmlFor = id;
    input.id = id; input.className = 'cf__input';
    w.appendChild(l); w.appendChild(input);
    return w;
  }
  function empresa(k){ try { return window.icewellSitio.campoEmpresa(k) || ''; } catch(e){ return ''; } }

  // ---------------------------------------------------------------- estructura
  function construir(){
    raiz = el('div', 'cf');
    raiz.id = 'formularioContacto';
    raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-modal', 'true'); raiz.setAttribute('aria-labelledby', 'cfTitulo1');
    raiz.hidden = true;

    var top = el('div', 'cf__top');
    var logo = el('img', 'cf__logo'); logo.src = 'assets/icewell-logo-oscuro.svg'; logo.alt = 'Icewell'; logo.width = 103; logo.height = 26;
    var prog = el('div', 'cf__prog');
    var progTxt = el('p', 'cf__progtxt'); progTxt.id = 'cfProgreso';
    var barra = el('div', 'cf__barra'); barra.setAttribute('aria-hidden', 'true'); barra.appendChild(el('span'));
    prog.appendChild(progTxt); prog.appendChild(barra);
    var cerrarB = boton('cf__cerrar', '×'); cerrarB.setAttribute('aria-label', 'Cerrar el formulario');
    cerrarB.addEventListener('click', cerrar);
    top.appendChild(logo); top.appendChild(prog); top.appendChild(cerrarB);
    raiz.appendChild(top);

    var form = el('form', 'cf__form'); form.noValidate = true;
    // trampa para bots: fuera de la vista y del orden de tabulación
    var trampa = el('div', 'cf__trampa'); trampa.setAttribute('aria-hidden', 'true');
    var tIn = el('input'); tIn.name = 'web'; tIn.type = 'text'; tIn.tabIndex = -1; tIn.autocomplete = 'off';
    trampa.appendChild(el('label', '', 'Sitio web (no completar)')); trampa.appendChild(tIn);
    form.appendChild(trampa);

    // 1 · nombre
    var p1 = pasoNuevo(1, '¿Cómo te llamas?');
    var iNombre = el('input'); iNombre.type = 'text'; iNombre.autocomplete = 'name'; iNombre.maxLength = 80;
    p1.appendChild(campo('cfNombre', 'Tu nombre', iNombre));
    // 2 · correo
    var p2 = pasoNuevo(2, '');
    var t2 = p2.querySelector('h2');
    t2.appendChild(document.createTextNode('Hola, ')); t2.appendChild(el('span', 'cf__nombre'));
    t2.appendChild(document.createTextNode('. ¿A qué correo te respondemos?'));
    var iCorreo = el('input'); iCorreo.type = 'email'; iCorreo.inputMode = 'email'; iCorreo.autocomplete = 'email'; iCorreo.maxLength = 190;
    p2.appendChild(campo('cfCorreo', 'Tu correo', iCorreo));
    // 3 · qué necesita (radios con forma de botón: accesibles con teclado y lector)
    var p3 = pasoNuevo(3, '¿Qué necesitas?');
    var fs = el('fieldset', 'cf__opciones');
    fs.appendChild(el('legend', 'cf__sr', 'Qué necesitas'));
    TIPOS.forEach(function(t){
      var l = el('label', 'cf__opcion');
      var r = el('input'); r.type = 'radio'; r.name = 'tipo'; r.value = t[0];
      r.addEventListener('change', function(){ datos.tipo = r.value; limpiarError(); setTimeout(function(){ if(paso === 3) avanzar(); }, reducido ? 0 : 260); });
      l.appendChild(r); l.appendChild(el('span', '', t[1]));
      fs.appendChild(l);
    });
    p3.appendChild(fs);
    // 4 · mensaje + teléfono
    var p4 = pasoNuevo(4, 'Cuéntanos más');
    var iMsg = el('textarea'); iMsg.rows = 5; iMsg.maxLength = 2000;
    iMsg.placeholder = 'Tipo de edificio u obra, ubicación, plazos, qué necesitas climatizar…';
    p4.appendChild(campo('cfMensaje', 'Tu consulta o solicitud', iMsg));
    var cont = el('p', 'cf__contador', '0 / 2000'); cont.setAttribute('aria-live', 'off');
    iMsg.addEventListener('input', function(){ cont.textContent = iMsg.value.length + ' / 2000'; });
    p4.appendChild(cont);
    var iTel = el('input'); iTel.type = 'tel'; iTel.inputMode = 'tel'; iTel.autocomplete = 'tel'; iTel.maxLength = 30;
    p4.appendChild(campo('cfTelefono', 'Teléfono (opcional)', iTel));
    p4.appendChild(el('p', 'cf__ayuda', 'Ctrl + Enter para continuar.'));
    // 5 · resumen
    var p5 = pasoNuevo(5, 'Revisa y envía');
    var dl = el('dl', 'cf__resumen');
    [['nombre', 'Nombre', 1], ['correo', 'Correo', 2], ['tipo', 'Necesitas', 3], ['mensaje', 'Consulta', 4], ['telefono', 'Teléfono', 4]].forEach(function(f){
      var fila = el('div', 'cf__fila');
      fila.appendChild(el('dt', '', f[1]));
      var dd = el('dd'); dd.setAttribute('data-resumen', f[0]);
      fila.appendChild(dd);
      var ed = boton('cf__editar', 'Editar'); ed.setAttribute('aria-label', 'Editar ' + f[1].toLowerCase());
      ed.addEventListener('click', function(){ ir(f[2], -1); });
      fila.appendChild(ed);
      dl.appendChild(fila);
    });
    p5.appendChild(dl);
    // listo
    var fin = el('section', 'cf__paso cf__fin'); fin.setAttribute('data-paso', 'fin'); fin.hidden = true;
    var tf = el('h2', 'cf__titulo'); tf.id = 'cfTituloFin'; tf.tabIndex = -1;
    fin.appendChild(tf);
    fin.appendChild(el('p', 'cf__texto cf__fin-texto'));
    var ok = boton('cf__btn cf__btn--primario', 'Cerrar'); ok.addEventListener('click', cerrar);
    fin.appendChild(ok);
    // alternativa: sin servidor o con error
    var alt = el('section', 'cf__paso cf__alt'); alt.setAttribute('data-paso', 'alt'); alt.hidden = true;
    var ta = el('h2', 'cf__titulo', 'No pudimos enviarlo desde aquí'); ta.id = 'cfTituloAlt'; ta.tabIndex = -1;
    alt.appendChild(ta);
    alt.appendChild(el('p', 'cf__texto cf__alt-texto'));
    var acc = el('div', 'cf__acciones');
    var aMail = el('a', 'cf__btn cf__btn--primario', 'Enviar por correo'); aMail.id = 'cfAltCorreo';
    var aWa = el('a', 'cf__btn cf__btn--fantasma', 'Enviar por WhatsApp'); aWa.id = 'cfAltWa'; aWa.target = '_blank'; aWa.rel = 'noopener';
    var volver = boton('cf__btn cf__btn--fantasma', 'Volver al resumen'); volver.addEventListener('click', function(){ ir(5, -1); });
    acc.appendChild(aMail); acc.appendChild(aWa); acc.appendChild(volver);
    alt.appendChild(acc);

    [p1, p2, p3, p4, p5, fin, alt].forEach(function(p){ form.appendChild(p); });
    var err = el('p', 'cf__error'); err.id = 'cfError'; err.setAttribute('role', 'alert');
    form.appendChild(err);

    var nav = el('div', 'cf__nav');
    var atras = boton('cf__btn cf__btn--fantasma cf__atras', 'Atrás');
    var sig = el('button', 'cf__btn cf__btn--primario cf__sig', 'Continuar'); sig.type = 'submit';
    atras.addEventListener('click', function(){ if(paso > 1) ir(paso - 1, -1); });
    nav.appendChild(atras); nav.appendChild(sig);
    form.appendChild(nav);
    form.addEventListener('submit', function(e){ e.preventDefault(); if(paso === TOTAL) enviar(); else avanzar(); });
    raiz.appendChild(form);

    // teclado: Esc cierra, Tab queda dentro, Ctrl+Enter en el mensaje avanza
    raiz.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ e.preventDefault(); cerrar(); return; }
      if(e.key === 'Enter' && (e.ctrlKey || e.metaKey) && paso < TOTAL && raiz.querySelector('.cf__paso[data-paso="' + paso + '"]:not([hidden])')){ e.preventDefault(); avanzar(); return; }
      if(e.key === 'Tab'){
        var f = Array.prototype.filter.call(raiz.querySelectorAll('button, a[href], input:not([tabindex="-1"]), textarea'), function(x){ return !x.closest('[hidden]') && !x.disabled; });
        if(!f.length) return;
        var i = f.indexOf(document.activeElement);
        if(e.shiftKey && (i <= 0)){ e.preventDefault(); f[f.length - 1].focus(); }
        else if(!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
      }
    });
    document.body.appendChild(raiz);
  }
  function pasoNuevo(n, titulo){
    var s = el('section', 'cf__paso'); s.setAttribute('data-paso', String(n)); s.hidden = true;
    var h = el('h2', 'cf__titulo', titulo); h.id = 'cfTitulo' + n; h.tabIndex = -1;
    s.appendChild(el('p', 'cf__num', String(n).padStart(2, '0') + ' / ' + String(TOTAL).padStart(2, '0')));
    s.appendChild(h);
    return s;
  }
  function q(sel){ return raiz.querySelector(sel); }

  // ---------------------------------------------------------------- navegación
  function leer(){
    datos.nombre = q('#cfNombre').value.trim();
    datos.correo = q('#cfCorreo').value.trim();
    datos.mensaje = q('#cfMensaje').value.trim();
    datos.telefono = q('#cfTelefono').value.trim();
  }
  function validar(n){
    leer();
    if(n === 1 && (datos.nombre.length < 2 || datos.nombre.length > 80)) return ['#cfNombre', 'Escribe tu nombre para continuar.'];
    if(n === 2 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.correo)) return ['#cfCorreo', 'Revisa el correo: debe tener la forma nombre@empresa.cl.'];
    if(n === 3 && !datos.tipo) return ['input[name="tipo"]', 'Elige una opción.'];
    if(n === 4){
      if(datos.mensaje.length < 10) return ['#cfMensaje', 'Cuéntanos un poco más (al menos 10 caracteres).'];
      if(datos.telefono && !/^[0-9 +()\-]{6,30}$/.test(datos.telefono)) return ['#cfTelefono', 'El teléfono solo lleva números, espacios y + ( ) -.'];
    }
    return null;
  }
  function mostrarError(sel, msg){
    var e = q('#cfError'); e.textContent = msg;
    var c = q(sel);
    if(c){ c.setAttribute('aria-invalid', 'true'); c.setAttribute('aria-describedby', 'cfError'); c.focus(); }
  }
  function limpiarError(){
    q('#cfError').textContent = '';
    Array.prototype.forEach.call(raiz.querySelectorAll('[aria-invalid]'), function(x){ x.removeAttribute('aria-invalid'); x.removeAttribute('aria-describedby'); });
  }
  function avanzar(){
    var e = validar(paso);
    if(e){ mostrarError(e[0], e[1]); return; }
    ir(paso + 1, 1);
  }
  // dir: 1 = adelante (entra desde la derecha), -1 = atrás
  function ir(n, dir){
    limpiarError();
    leer();
    var actual = raiz.querySelector('.cf__paso:not([hidden])');
    var nuevo = raiz.querySelector('.cf__paso[data-paso="' + n + '"]');
    if(!nuevo) return;
    if(actual && actual !== nuevo) actual.hidden = true;
    nuevo.hidden = false;
    nuevo.classList.remove('cf__entra--der', 'cf__entra--izq'); void nuevo.offsetWidth;
    nuevo.classList.add(dir < 0 ? 'cf__entra--izq' : 'cf__entra--der');
    var esPaso = typeof n === 'number';
    if(esPaso) paso = n;
    raiz.setAttribute('aria-labelledby', nuevo.querySelector('h2').id);
    // textos que dependen de lo escrito (siempre textContent)
    q('.cf__nombre').textContent = datos.nombre.split(/\s+/)[0] || '';
    if(n === 5) pintarResumen();
    var nav = q('.cf__nav'); nav.hidden = !esPaso;
    q('.cf__atras').hidden = n === 1;
    q('.cf__sig').textContent = n === TOTAL ? 'Enviar solicitud' : 'Continuar';
    var pr = esPaso ? n : TOTAL;
    q('#cfProgreso').textContent = esPaso ? 'Paso ' + n + ' de ' + TOTAL : (n === 'fin' ? 'Enviado' : 'Paso 5 de 5');
    q('.cf__barra span').style.width = (n === 'fin' ? 100 : pr / TOTAL * 100) + '%';
    // foco: el campo del paso, o el título
    var foco = nuevo.querySelector(n === 3 ? 'input[name="tipo"]:checked, input[name="tipo"]' : 'input:not([tabindex="-1"]), textarea') || nuevo.querySelector('h2');
    if(n === 5 || !esPaso) foco = nuevo.querySelector('h2');
    setTimeout(function(){ try { foco.focus({ preventScroll: true }); } catch(e){ foco.focus(); } }, 30);
  }
  function nombreTipo(id){ for(var i = 0; i < TIPOS.length; i++) if(TIPOS[i][0] === id) return TIPOS[i][1]; return ''; }
  function pintarResumen(){
    leer();
    var v = { nombre: datos.nombre, correo: datos.correo, tipo: nombreTipo(datos.tipo), mensaje: datos.mensaje, telefono: datos.telefono || '—' };
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-resumen]'), function(dd){ dd.textContent = v[dd.getAttribute('data-resumen')]; });
  }

  // ---------------------------------------------------------------- envío
  function textoPlano(){
    return 'Nombre: ' + datos.nombre + '\nCorreo: ' + datos.correo + '\nNecesito: ' + nombreTipo(datos.tipo) +
      (datos.telefono ? '\nTeléfono: ' + datos.telefono : '') + '\n\n' + datos.mensaje;
  }
  function alternativa(motivo){
    var correo = empresa('correo') || 'contacto@icewell.cl';
    q('.cf__alt-texto').textContent = motivo + ' Lo que escribiste no se perdió: puedes enviarlo tal cual por correo a ' + correo + ' o por WhatsApp.';
    q('#cfAltCorreo').href = 'mailto:' + correo + '?subject=' + encodeURIComponent('Solicitud: ' + nombreTipo(datos.tipo) + ' — ' + datos.nombre) + '&body=' + encodeURIComponent(textoPlano());
    var wa = '';
    try { wa = window.icewellSitio.waUrl('cotizar').split('?')[0]; } catch(e){ wa = 'https://wa.me/56964074519'; }
    q('#cfAltWa').href = wa + '?text=' + encodeURIComponent('Hola Icewell, les escribo desde el sitio.\n\n' + textoPlano());
    ir('alt', 1);
  }
  function enviar(){
    if(enviando) return;
    leer();
    for(var n = 1; n <= 4; n++){ var e = validar(n); if(e){ ir(n, -1); mostrarError(e[0], e[1]); return; } }
    if(location.protocol === 'file:'){ alternativa('Esta copia del sitio se abrió sin servidor.'); return; }
    enviando = true;
    var sig = q('.cf__sig'); sig.disabled = true; sig.textContent = 'Enviando…';
    var cuerpo = { nombre: datos.nombre, correo: datos.correo, tipo: datos.tipo, mensaje: datos.mensaje, telefono: datos.telefono,
      web: raiz.querySelector('input[name="web"]').value, ms: Date.now() - abierto };
    fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'icewell' }, body: JSON.stringify(cuerpo) })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ return { estado: r.status, j: j }; }); })
      .then(function(res){
        if(res.estado === 200 && res.j.ok){
          q('#cfTituloFin').textContent = '¡Listo, ' + (datos.nombre.split(/\s+/)[0] || '') + '!';
          q('.cf__fin-texto').textContent = 'Recibimos tu solicitud. Te escribiremos a ' + datos.correo + ' lo antes posible.';
          ir('fin', 1);
          return;
        }
        if(res.estado === 422 && res.j.errores){
          var mapa = { nombre: [1, '#cfNombre'], correo: [2, '#cfCorreo'], tipo: [3, 'input[name="tipo"]'], mensaje: [4, '#cfMensaje'], telefono: [4, '#cfTelefono'] };
          for(var k in mapa) if(res.j.errores[k]){ ir(mapa[k][0], -1); mostrarError(mapa[k][1], res.j.errores[k]); return; }
        }
        alternativa(res.estado === 429 ? 'Recibimos varias solicitudes seguidas desde tu conexión.' : 'El servidor no respondió como esperábamos.');
      })
      .catch(function(){ alternativa('No hay conexión con el servidor.'); })
      .then(function(){ enviando = false; sig.disabled = false; });
  }

  // ---------------------------------------------------------------- abrir / cerrar
  function abrir(ev){
    if(ev && ev.preventDefault) ev.preventDefault();
    if(!raiz) construir();
    origen = document.activeElement;
    raiz.hidden = false;
    document.documentElement.classList.add('cf-abierto');
    abierto = Date.now();
    if(raiz.querySelector('.cf__fin:not([hidden])')){       // después de enviar, uno nuevo empieza de cero
      datos = { nombre: '', correo: '', tipo: '', mensaje: '', telefono: '' };
      Array.prototype.forEach.call(raiz.querySelectorAll('input, textarea'), function(x){ if(x.type === 'radio') x.checked = false; else x.value = ''; });
      ir(1, 1);
    } else ir(paso, 1);
  }
  function cerrar(){
    if(!raiz || raiz.hidden) return;
    raiz.hidden = true;
    document.documentElement.classList.remove('cf-abierto');
    if(origen && origen.focus) origen.focus();
  }
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('[data-abrir-formulario]');
    if(a) abrir(e);
  });
  window.icewellFormulario = { abrir: abrir, cerrar: cerrar };
})();
