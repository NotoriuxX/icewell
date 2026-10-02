/* ==========================================================================
   ICEWELL — Editor: constructores de campos enlazados al borrador.
   Cada campo escribe directo en el objeto que recibe (obj[k]) y avisa con
   Editor.cambio(); al salir del campo se guarda un punto de "deshacer".
   data-ruta = dirección del dato para saltar a él desde la vista previa.
   Todo con textContent: un texto del usuario nunca se interpreta como HTML.
   ========================================================================== */
(function(){
  'use strict';
  var E = window.Editor, P = window.Panel;
  var uid = 0;
  function el(tag, clase, texto){ var n = document.createElement(tag); if(clase) n.className = clase; if(texto != null) n.textContent = texto; return n; }
  function id(){ return 'c' + (++uid); }

  var F = E.campos = { el: el };

  /** Sección plegable. clave = para recordar si quedó abierta. */
  F.seccion = function(cont, titulo, op){
    op = op || {};
    var d = el('details', 'ed-sec');
    var clave = op.clave || titulo;
    d.open = E.abiertos[clave] != null ? E.abiertos[clave] : op.abierta !== false;
    d.addEventListener('toggle', function(){ E.abiertos[clave] = d.open; });
    var s = el('summary');
    s.appendChild(el('span', 'ed-sec__titulo', titulo));
    if(op.nota) s.appendChild(el('span', 'ed-sec__nota', op.nota));
    d.appendChild(s);
    var cuerpo = el('div', 'ed-sec__cuerpo');
    if(op.ayuda) cuerpo.appendChild(el('p', 'ed-ayuda', op.ayuda));
    d.appendChild(cuerpo);
    cont.appendChild(d);
    return cuerpo;
  };

  function envoltura(cont, etq, op, idCampo){
    var w = el('div', 'ed-campo' + (op.ancho ? ' ed-campo--' + op.ancho : ''));
    if(op.ruta) w.dataset.ruta = op.ruta;
    var l = el('label', '', etq); l.htmlFor = idCampo;
    w.appendChild(l);
    cont.appendChild(w);
    return w;
  }
  function ayuda(w, texto){ if(texto){ var a = el('small', 'ed-ayuda-campo', texto); w.appendChild(a); return a; } }

  /** Texto (input o textarea). op: { multi, max, ayuda, ruta, tipo, placeholder, ancho, alCambiar, sinBorrador } */
  F.texto = function(cont, etq, obj, k, op){
    op = op || {};
    var i = id(), w = envoltura(cont, etq, op, i);
    var inp = el(op.multi ? 'textarea' : 'input', 'entrada');
    inp.id = i;
    if(!op.multi) inp.type = op.tipoInput || 'text';
    if(op.multi) inp.rows = op.filas || Math.min(8, Math.max(2, Math.ceil(String(obj[k] || '').length / 70)));
    if(op.max) inp.maxLength = op.max;
    if(op.placeholder) inp.placeholder = op.placeholder;
    if(op.requerido) inp.required = true;
    inp.value = obj[k] == null ? '' : obj[k];
    var contador = op.max && op.max <= 400 ? el('small', 'ed-contador') : null;
    function contar(){ if(contador) contador.textContent = inp.value.length + '/' + op.max; }
    inp.addEventListener('input', function(){
      obj[k] = op.numero ? (inp.value === '' ? null : Number(inp.value)) : inp.value;
      contar();
      if(!op.sinBorrador) E.cambio(op.tipo || 'sitio');   // sinBorrador: campos que no son contenido (contraseñas, códigos)
      if(op.alCambiar) op.alCambiar(inp.value);
    });
    inp.addEventListener('focus', function(){ if(op.ruta && E.vista) E.vista.resaltar(op.ruta); });
    inp.addEventListener('blur', function(){ if(!op.sinBorrador) E.instantanea(); });
    w.appendChild(inp);
    var fila = el('div', 'ed-campo__pie');
    ayuda(fila, op.ayuda);
    if(contador){ fila.appendChild(contador); contar(); }
    if(fila.childNodes.length) w.appendChild(fila);
    return inp;
  };

  F.numero = function(cont, etq, obj, k, op){
    op = Object.assign({ tipoInput: 'number', numero: true }, op || {});
    var inp = F.texto(cont, etq, obj, k, op);
    inp.inputMode = 'numeric'; if(op.min != null) inp.min = op.min; if(op.maxNum != null) inp.max = op.maxNum;
    return inp;
  };

  /** Lista de textos cortos: una línea = un elemento (certificaciones, ítems, tags). */
  F.lineas = function(cont, etq, obj, k, op){
    op = op || {};
    var i = id(), w = envoltura(cont, etq, op, i);
    var ta = el('textarea', 'entrada'); ta.id = i;
    ta.rows = Math.max(3, (obj[k] || []).length + 1);
    ta.value = (obj[k] || []).join('\n');
    ta.addEventListener('input', function(){
      obj[k] = ta.value.split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
      E.cambio(op.tipo || 'sitio');
    });
    ta.addEventListener('blur', function(){ E.instantanea(); });
    w.appendChild(ta);
    ayuda(w, op.ayuda || 'Uno por línea.');
    return ta;
  };

  F.selector = function(cont, etq, obj, k, opciones, op){
    op = op || {};
    var i = id(), w = envoltura(cont, etq, op, i);
    var s = el('select', 'entrada'); s.id = i;
    opciones.forEach(function(o){ var x = el('option', '', o[1]); x.value = o[0]; if(String(obj[k] == null ? '' : obj[k]) === String(o[0])) x.selected = true; s.appendChild(x); });
    s.addEventListener('change', function(){ obj[k] = s.value; E.cambio(op.tipo || 'sitio'); E.instantanea(); if(op.alCambiar) op.alCambiar(s.value); });
    w.appendChild(s);
    ayuda(w, op.ayuda);
    return s;
  };

  /** Interruptor sí/no. op.deshabilitado = texto que explica por qué no se puede. */
  F.interruptor = function(cont, etq, obj, k, op){
    op = op || {};
    var w = el('div', 'ed-interruptor' + (op.deshabilitado ? ' ed-interruptor--off' : ''));
    if(op.ruta) w.dataset.ruta = op.ruta;
    var l = el('label');
    var c = el('input'); c.type = 'checkbox'; c.role = 'switch'; c.checked = !!obj[k]; c.disabled = !!op.deshabilitado;
    l.appendChild(c); l.appendChild(el('span', 'ed-interruptor__pista')); l.appendChild(el('span', 'ed-interruptor__txt', etq));
    w.appendChild(l);
    var txtAyuda = op.deshabilitado || op.ayuda;
    if(txtAyuda) w.appendChild(el('small', 'ed-ayuda-campo', txtAyuda));
    c.addEventListener('change', function(){
      if(c.checked) obj[k] = true; else if(op.borrarSiNo) delete obj[k]; else obj[k] = false;
      E.cambio(op.tipo || 'sitio'); E.instantanea();
      if(op.alCambiar) op.alCambiar(c.checked);
    });
    cont.appendChild(w);
    return c;
  };

  /** Selección múltiple con botones (sectores, regiones de una obra). */
  F.chips = function(cont, etq, obj, k, opciones, op){
    op = op || {};
    var w = el('fieldset', 'ed-chips');
    if(op.ruta) w.dataset.ruta = op.ruta;
    w.appendChild(el('legend', '', etq));
    var fila = el('div', 'ed-chips__fila');
    opciones.forEach(function(o){
      var b = el('button', 'ed-chip', o.label); b.type = 'button';
      var on = (obj[k] || []).indexOf(o.id) >= 0;
      b.setAttribute('aria-pressed', String(on));
      b.addEventListener('click', function(){
        var lista = (obj[k] || []).slice(), i = lista.indexOf(o.id);
        if(i >= 0) lista.splice(i, 1); else lista.push(o.id);
        // conservar el orden del catálogo (así cv-data.js queda prolijo)
        obj[k] = opciones.map(function(x){ return x.id; }).filter(function(x){ return lista.indexOf(x) >= 0; });
        b.setAttribute('aria-pressed', String(i < 0));
        E.cambio(op.tipo || 'obras'); E.instantanea();
      });
      fila.appendChild(b);
    });
    w.appendChild(fila);
    // "+ Nuevo sector" / "+ Nueva región": se crea en el catálogo y queda marcado en esta obra
    if(op.crear){
      var abrir = el('button', 'ed-chip ed-chip--nuevo', op.crear.etiqueta); abrir.type = 'button';
      var caja = el('div', 'ed-chips__nuevo'); caja.hidden = true;
      var inp = el('input', 'entrada'); inp.type = 'text'; inp.maxLength = 40; inp.placeholder = op.crear.placeholder || 'Nombre';
      inp.setAttribute('aria-label', op.crear.etiqueta);
      var ok = el('button', 'btn btn--primario btn--chico', 'Agregar'); ok.type = 'button';
      var no = el('button', 'enlace', 'Cancelar'); no.type = 'button';
      caja.appendChild(inp); caja.appendChild(ok); caja.appendChild(no);
      var agregar = function(){
        var nombre = inp.value.trim();
        if(nombre.length < 2){ inp.focus(); return; }
        var id = op.crear.fn(nombre);           // devuelve el id (nuevo o el que ya existía con ese nombre)
        if(!id) return;
        if((obj[k] || []).indexOf(id) < 0) obj[k] = (obj[k] || []).concat([id]);
        E.cambio(op.tipo || 'obras'); E.instantanea();
        E.render();
      };
      abrir.addEventListener('click', function(){ caja.hidden = false; abrir.hidden = true; inp.focus(); });
      no.addEventListener('click', function(){ caja.hidden = true; abrir.hidden = false; inp.value = ''; });
      ok.addEventListener('click', agregar);
      inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); agregar(); } if(e.key === 'Escape') no.click(); });
      fila.appendChild(abrir);
      w.appendChild(caja);
    }
    if(op.ayuda) w.appendChild(el('small', 'ed-ayuda-campo', op.ayuda));
    cont.appendChild(w);
    return w;
  };

  /** Agrega un elemento a un catálogo (sectores/regiones) o devuelve el que ya tiene ese nombre. */
  F.agregarACatalogo = function(lista, nombre){
    var norm = function(t){ return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); };
    var ya = lista.filter(function(x){ return norm(x.label) === norm(nombre); })[0];
    if(ya){ E.toast('«' + ya.label + '» ya existía: quedó marcado.'); return ya.id; }
    var base = norm(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'nuevo', id = base, n = 2;
    while(lista.some(function(x){ return x.id === id; })) id = base + '-' + n++;
    lista.push({ id: id, label: nombre.slice(0, 40) });
    E.toast('«' + nombre + '» se agregó a la lista. Aparecerá en los filtros y botones del sitio al publicar.', 'ok');
    return id;
  };

  /** Lista de elementos con agregar / quitar / subir / bajar. */
  F.lista = function(cont, op){
    var arr = op.arr;
    var w = el('div', 'ed-lista');
    if(op.ruta) w.dataset.ruta = op.ruta;
    function pintar(){
      w.textContent = '';
      arr.forEach(function(item, i){
        var c = el('div', 'ed-item');
        if(op.ruta) c.dataset.ruta = op.ruta + '.' + i;
        var cab = el('div', 'ed-item__cab');
        cab.appendChild(el('span', 'ed-item__num', String(i + 1).padStart(2, '0')));
        cab.appendChild(el('span', 'ed-item__titulo', op.titulo(item, i) || '(sin título)'));
        var acc = el('div', 'ed-item__acc');
        [['↑', 'Subir', i > 0, function(){ mover(i, -1); }], ['↓', 'Bajar', i < arr.length - 1, function(){ mover(i, 1); }],
         ['✕', 'Quitar', arr.length > (op.min || 0), function(){ quitar(i); }]].forEach(function(b){
          var bt = el('button', 'ed-mini', b[0]); bt.type = 'button'; bt.title = b[1]; bt.setAttribute('aria-label', b[1] + ' ' + (i + 1)); bt.disabled = !b[2];
          bt.addEventListener('click', b[3]); acc.appendChild(bt);
        });
        cab.appendChild(acc);
        c.appendChild(cab);
        var cuerpo = el('div', 'ed-item__cuerpo');
        op.campos(cuerpo, item, i);
        c.appendChild(cuerpo);
        w.appendChild(c);
      });
      if(!op.max || arr.length < op.max){
        var mas = el('button', 'btn btn--secundario ed-agregar', '+ ' + (op.agregar || 'Agregar')); mas.type = 'button';
        mas.addEventListener('click', function(){
          arr.push(op.nuevo()); E.cambio(op.tipo || 'sitio'); E.instantanea(); pintar();
          var ult = w.querySelectorAll('.ed-item'); ult = ult[ult.length - 1];
          if(ult){ ult.scrollIntoView({ block: 'center', behavior: 'smooth' }); var f = ult.querySelector('input,textarea'); if(f) f.focus({ preventScroll: true }); }
        });
        w.appendChild(mas);
      }
    }
    function mover(i, d){
      var t = arr[i]; arr[i] = arr[i + d]; arr[i + d] = t;
      E.cambio(op.tipo || 'sitio'); E.instantanea(); pintar();
    }
    function quitar(i){
      E.confirmar('¿Quitar este elemento?', '«' + (op.titulo(arr[i], i) || 'sin título') + '» se quitará. Puedes deshacerlo con ↶ antes de guardar.', { si: 'Quitar', peligro: true }).then(function(si){
        if(!si) return; arr.splice(i, 1); E.cambio(op.tipo || 'sitio'); E.instantanea(); pintar();
      });
    }
    pintar();
    cont.appendChild(w);
    return w;
  };

  // ---------------------------------------------------------------- imágenes
  // Antes de subir, las fotos muy grandes se achican en el navegador (subida más rápida);
  // el servidor igual valida, re-codifica y achica.
  function leerArchivo(file){
    return new Promise(function(res, rej){
      if(!/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error('Usa una foto JPG, PNG o WebP.'));
      var fr = new FileReader();
      fr.onload = function(){
        if(file.size <= 6 * 1024 * 1024) return res(fr.result);
        var img = new Image();
        img.onload = function(){
          var f = Math.min(1, 2600 / Math.max(img.width, img.height));
          var cv = document.createElement('canvas'); cv.width = Math.round(img.width * f); cv.height = Math.round(img.height * f);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          res(cv.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9));
        };
        img.onerror = function(){ rej(new Error('No se pudo leer la imagen.')); };
        img.src = fr.result;
      };
      fr.onerror = function(){ rej(new Error('No se pudo leer el archivo.')); };
      fr.readAsDataURL(file);
    });
  }
  function pesoLegible(b){
    if(b >= 1024 * 1024) return (b / 1024 / 1024).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' MB';
    return Math.max(1, Math.round(b / 1024)).toLocaleString('es-CL') + ' KB';
  }
  F.subir = function(file, tipo, nombre){
    return leerArchivo(file).then(function(datos){ return P.api('imagen', { tipo: tipo, nombre: nombre || '', datos: datos }); });
  };

  /** Imagen con vista previa, subir y quitar. op: { tipo:'obra'|'hero'|'equipo'|'socio', opcional, nombre:fn, ayuda, ruta } */
  F.imagen = function(cont, etq, obj, k, op){
    op = op || {};
    var w = el('div', 'ed-imagen');
    if(op.ruta) w.dataset.ruta = op.ruta;
    w.appendChild(el('span', 'ed-imagen__etq', etq));
    var fila = el('div', 'ed-imagen__fila');
    var marco = el('div', 'ed-imagen__marco' + (op.tipo === 'socio' ? ' ed-imagen__marco--logo' : ''));
    var img = el('img'); img.alt = '';
    var vacio = el('span', 'ed-imagen__vacio', 'Sin imagen');
    marco.appendChild(img); marco.appendChild(vacio);
    function pintar(){ var v = obj[k]; img.hidden = !v; vacio.hidden = !!v; if(v) img.src = '../assets/' + v; }
    pintar();
    var acc = el('div', 'ed-imagen__acc');
    var lbl = el('label', 'btn btn--secundario', obj[k] ? 'Cambiar imagen' : 'Subir imagen');
    var inp = el('input'); inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp'; inp.className = 'sr';
    lbl.appendChild(inp);
    acc.appendChild(lbl);
    var quitar = el('button', 'enlace', 'Quitar imagen'); quitar.type = 'button'; quitar.hidden = !op.opcional || !obj[k];
    quitar.addEventListener('click', function(){ obj[k] = op.vacio !== undefined ? op.vacio : ''; pintar(); quitar.hidden = true; lbl.firstChild.textContent = 'Subir imagen'; E.cambio(op.cambio || 'sitio'); E.instantanea(); if(op.alCambiar) op.alCambiar(); });
    acc.appendChild(quitar);
    var estado = el('small', 'ed-ayuda-campo', op.ayuda || '');
    acc.appendChild(estado);
    inp.addEventListener('change', function(){
      var f = inp.files[0]; if(!f) return;
      lbl.classList.add('cargando'); estado.textContent = 'Subiendo…';
      F.subir(f, op.tipo, op.nombre ? op.nombre() : '').then(function(r){
        obj[k] = r.archivo; pintar(); quitar.hidden = !op.opcional; lbl.firstChild.textContent = 'Cambiar imagen';
        // Peso del archivo que eligió la persona (no el achicado en el navegador) → peso final.
        var peso = r.bytes_final ? pesoLegible(f.size) + ' → ' + pesoLegible(r.bytes_final) + ' (' + String(r.formato || '').toUpperCase() + ', ' : '(';
        estado.textContent = 'Lista ' + peso + r.ancho + '×' + r.alto + ' px). Se publicará al Guardar y Publicar.';
        // También como aviso: en la ficha de obra, alCambiar vuelve a pintar el formulario y este texto se pierde.
        if(r.bytes_final) E.toast('Foto lista: ' + pesoLegible(f.size) + ' → ' + pesoLegible(r.bytes_final) + '.');
        E.cambio(op.cambio || 'sitio'); E.instantanea();
        if(op.alCambiar) op.alCambiar();
      }).catch(function(err){ estado.textContent = ''; if(err.estado === 401) E.error(err); else E.toast(err.message, 'error'); })
        .then(function(){ lbl.classList.remove('cargando'); inp.value = ''; });
    });
    fila.appendChild(marco); fila.appendChild(acc);
    w.appendChild(fila);
    cont.appendChild(w);
    return w;
  };

  F.nota = function(cont, texto, tipo){ var p = el('p', 'aviso' + (tipo ? ' aviso--' + tipo : ''), texto); cont.appendChild(p); return p; };
  F.grilla = function(cont){ var g = el('div', 'ed-grilla'); cont.appendChild(g); return g; };
  F.encabezado = function(cont, titulo, bajada){
    var h = el('div', 'ed-encabezado');
    h.appendChild(el('h1', '', titulo));
    if(bajada) h.appendChild(el('p', '', bajada));
    cont.appendChild(h);
    return h;
  };
  // recordatorio del formato de textos (una vez por pestaña)
  F.formato = function(cont){
    var p = el('p', 'ed-formato');
    p.appendChild(el('b', '', 'Formato: '));
    p.appendChild(document.createTextNode('*palabras* van destacadas en azul · **palabras** en negrita · Enter = salto de línea · {anios}, {desde}, {obras}, {m2}, {regiones} se reemplazan solos por las cifras.'));
    cont.appendChild(p);
  };
})();
