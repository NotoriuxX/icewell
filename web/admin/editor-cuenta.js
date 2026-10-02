/* ==========================================================================
   ICEWELL — Editor: Usuarios (admin), Historial y Mi cuenta.
   Estas pestañas no editan el borrador: hablan directo con el servidor.
   ========================================================================== */
(function(){
  'use strict';
  var E = window.Editor, F = E.campos, P = window.Panel, el = F.el;
  function fecha(t){ return t ? new Date(t * 1000).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
  var ESTADOS = { activo: ['Activo', 'verde'], pendiente_aprobacion: ['Espera aprobación', 'amarilla'], pendiente_verificacion: ['Falta confirmar correo', 'gris'], bloqueado: ['Bloqueado', 'roja'] };

  // ==================================================================== Usuarios (solo admin)
  function pintarUsuarios(cont, lista){
    cont.textContent = '';
    var pend = lista.filter(function(u){ return u.estado === 'pendiente_aprobacion'; }).length;
    var badge = document.getElementById('pendientes'); badge.hidden = !pend; badge.textContent = pend;
    lista.forEach(function(u){
      var c = el('article', 'ed-usuario-fila');
      var info = el('div', 'ed-usuario-fila__info');
      info.appendChild(el('strong', '', u.nombre + (u.id === E.usuario.id ? ' (tú)' : '')));
      info.appendChild(el('span', '', u.email));
      var meta = el('span', 'ed-usuario-fila__meta', (u.rol === 'admin' ? 'Administrador' : 'Editor') + ' · último acceso: ' + fecha(u.ultimo_login) + (u.google ? ' · Google' : '') + (u.totp ? ' · 2 pasos' : ''));
      info.appendChild(meta);
      var est = ESTADOS[u.estado] || [u.estado, 'gris'];
      var marca = el('span', 'ed-marca ed-marca--' + est[1], est[0]);
      var acc = el('div', 'ed-usuario-fila__acc');
      function boton(txt, accion, clase, extra, conf){
        var b = el('button', 'btn ' + (clase || 'btn--secundario') + ' btn--chico', txt); b.type = 'button';
        b.addEventListener('click', function(){
          (conf ? E.confirmar(conf[0], conf[1], { si: txt, peligro: clase === 'btn--peligro' }) : Promise.resolve(true)).then(function(si){
            if(!si) return;
            P.ocupado(b, true);
            P.api('usuarios/actualizar', Object.assign({ id: u.id, accion: accion }, extra || {}))
              .then(function(r){ pintarUsuarios(cont, r.usuarios); E.toast('Listo.', 'ok'); })
              .catch(function(err){ E.error(err); P.ocupado(b, false); });
          });
        });
        acc.appendChild(b);
      }
      var yo = u.id === E.usuario.id;
      if(u.estado === 'pendiente_aprobacion'){
        boton('Aprobar', 'aprobar', 'btn--primario', null, null);
        boton('Rechazar', 'rechazar', 'btn--peligro', null, ['¿Rechazar la solicitud de ' + u.nombre + '?', 'Se borra la cuenta. Podrá volver a registrarse.']);
      } else if(u.estado === 'pendiente_verificacion'){
        boton('Borrar solicitud', 'rechazar', 'btn--peligro', null, ['¿Borrar la solicitud de ' + u.nombre + '?', 'Nunca confirmó su correo.']);
      } else if(u.estado === 'bloqueado'){
        boton('Desbloquear', 'aprobar');
      } else if(!yo){
        boton(u.rol === 'admin' ? 'Hacer editor' : 'Hacer admin', 'rol', null, { rol: u.rol === 'admin' ? 'editor' : 'admin' },
          [u.rol === 'admin' ? '¿Quitar el rol de administrador?' : '¿Dar rol de administrador?', u.rol === 'admin' ? 'Podrá editar pero no gestionar usuarios.' : 'Podrá aprobar y bloquear usuarios, y publicar.']);
        boton('Cerrar sesiones', 'cerrar_sesiones', null, null, null);
        if(u.totp) boton('Quitar 2 pasos', 'quitar_2fa', null, null, ['¿Quitar la verificación en dos pasos?', 'Úsalo si perdió el teléfono. Deberá volver a activarla.']);
        boton('Bloquear', 'bloquear', 'btn--peligro', null, ['¿Bloquear a ' + u.nombre + '?', 'Se cierran sus sesiones y no podrá entrar hasta que lo desbloquees.']);
      }
      c.appendChild(info); c.appendChild(marca); c.appendChild(acc);
      cont.appendChild(c);
    });
  }
  E.registrarTab('usuarios', { soloAdmin: true, render: function(p){
    F.encabezado(p, 'Usuarios', 'Quién puede entrar al panel. Las cuentas nuevas (solo correos de la empresa) esperan tu aprobación.');
    var cont = el('div', 'ed-usuarios'); cont.textContent = 'Cargando…';
    p.appendChild(cont);
    P.api('usuarios').then(function(r){ pintarUsuarios(cont, r.usuarios); }).catch(E.error);
    var s = F.seccion(p, 'Registro de actividad', { clave: 'auditoria', abierta: false, ayuda: 'Entradas, intentos fallidos, guardados y publicaciones (últimos 300).' });
    var tabla = el('div', 'ed-auditoria'); s.appendChild(tabla);
    s.parentNode.addEventListener('toggle', function cargar(){
      if(!s.parentNode.open || tabla.dataset.listo) return;
      tabla.dataset.listo = '1'; tabla.textContent = 'Cargando…';
      P.api('auditoria').then(function(r){
        tabla.textContent = '';
        r.eventos.forEach(function(e){
          var f = el('div', 'ed-auditoria__fila' + (/fallido|error|bloquear/.test(e.accion) ? ' ed-auditoria__fila--alerta' : ''));
          f.appendChild(el('span', '', fecha(e.fecha)));
          f.appendChild(el('span', '', e.usuario));
          f.appendChild(el('span', '', e.accion.replace(/[._]/g, ' ')));
          f.appendChild(el('span', '', e.detalle));
          f.appendChild(el('span', '', e.ip));
          tabla.appendChild(f);
        });
      }).catch(E.error);
    });
  } });

  // ==================================================================== Historial
  E.registrarTab('historial', { render: function(p){
    F.encabezado(p, 'Historial de versiones', 'Cada «Guardar» crea una versión. Puedes cargar cualquiera al borrador, revisarla en la vista previa y, si te sirve, guardarla y publicarla.');
    var cont = el('div', 'ed-historial'); cont.textContent = 'Cargando…';
    p.appendChild(cont);
    P.api('historial').then(function(r){
      cont.textContent = '';
      r.versiones.forEach(function(v, i){
        var f = el('div', 'ed-historial__fila');
        var t = el('div', 'ed-historial__txt');
        t.appendChild(el('strong', '', fecha(v.fecha) + ' · ' + v.autor));
        t.appendChild(el('span', '', (v.nota || (v.estado === 'publicado' ? 'Publicada' : 'Guardada')) + (i === 0 ? ' · versión actual' : '')));
        f.appendChild(t);
        if(v.estado === 'publicado') f.appendChild(el('span', 'ed-marca ed-marca--verde', 'Publicada'));
        if(i > 0){
          var b = el('button', 'btn btn--secundario btn--chico', 'Cargar al borrador'); b.type = 'button';
          b.addEventListener('click', function(){
            E.confirmar('¿Cargar esta versión?', ['Reemplaza el borrador actual' + (E.dirty ? ' (y tus cambios sin guardar)' : '') + ' por la versión del ' + fecha(v.fecha) + '.', 'No cambia nada hasta que Guardes y Publiques. Se puede deshacer con ↶.'], { si: 'Cargar' })
              .then(function(si){
                if(!si) return;
                return P.api('historial/version', undefined, { query: '&id=' + v.id }).then(function(r){
                  E.draft = r.contenido; E.dirty = true; E.instantanea(); E.actualizarCabecera();
                  if(E.vista) E.vista.programar('obras');
                  E.tab('inicio');
                  E.toast('Versión cargada al borrador. Revísala y guarda para conservarla.', 'ok', 6000);
                });
              }).catch(E.error);
          });
          f.appendChild(b);
        }
        cont.appendChild(f);
      });
    }).catch(E.error);
  } });

  // ==================================================================== Mi cuenta
  E.registrarTab('cuenta', { render: function(p){
    var u = E.usuario;
    F.encabezado(p, 'Mi cuenta', u.nombre + ' · ' + u.email + ' · ' + (u.rol === 'admin' ? 'administrador' : 'editor'));

    var s = F.seccion(p, 'Cambiar contraseña', { clave: 'cta-clave' });
    var form = el('form'); form.noValidate = true;
    var datos = { actual: '', nueva: '', repetir: '' };
    var a = F.texto(form, 'Contraseña actual', datos, 'actual', { tipoInput: 'password', sinBorrador: true }); a.autocomplete = 'current-password'; a.name = 'actual';
    var n = F.texto(form, 'Contraseña nueva (mínimo 12 caracteres)', datos, 'nueva', { tipoInput: 'password', sinBorrador: true }); n.autocomplete = 'new-password'; n.name = 'nueva';
    var med = el('div', 'medidor'); med.innerHTML = '<i></i><i></i><i></i><i></i>'; var medTxt = el('small', 'medidor-txt', 'Una frase de 3 o 4 palabras es fácil de recordar y segura.');
    n.parentNode.appendChild(med); n.parentNode.appendChild(medTxt); P.medidor(n, med, medTxt);
    var r2 = F.texto(form, 'Repite la contraseña nueva', datos, 'repetir', { tipoInput: 'password', sinBorrador: true }); r2.autocomplete = 'new-password'; r2.name = 'repetir';
    var av = el('div', 'aviso'); form.insertBefore(av, form.firstChild);
    var b = el('button', 'btn btn--primario', 'Cambiar contraseña'); b.type = 'submit'; form.appendChild(b);
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(datos.nueva !== datos.repetir) return P.errorEnCampo(form, 'repetir', 'No coincide con la nueva.');
      P.ocupado(b, true);
      P.api('cuenta/clave', { actual: datos.actual, nueva: datos.nueva }).then(function(r){ form.reset(); datos.actual = datos.nueva = datos.repetir = ''; P.aviso(av, r.mensaje, 'ok'); })
        .catch(function(err){ if(!P.errorEnCampo(form, err.datos && err.datos.campo, err.message)) P.aviso(av, err.message, 'error'); })
        .then(function(){ P.ocupado(b, false); });
    });
    s.appendChild(form);

    s = F.seccion(p, 'Verificación en dos pasos', { clave: 'cta-2fa', ayuda: 'Además de la contraseña, al entrar se pide un código de 6 dígitos de una app (Google Authenticator, Microsoft Authenticator, 1Password…). Muy recomendado para administradores.' });
    var zona = el('div'); s.appendChild(zona);
    function pintar2fa(){
      zona.textContent = '';
      if(u.totp){
        F.nota(zona, 'Activa. Para desactivarla escribe un código actual de tu app.', 'ok');
        var c = { v: '' }; var inp = F.texto(zona, 'Código de 6 dígitos', c, 'v', { max: 7, sinBorrador: true }); inp.inputMode = 'numeric'; inp.autocomplete = 'one-time-code';
        var bd = el('button', 'btn btn--peligro', 'Desactivar'); bd.type = 'button'; zona.appendChild(bd);
        bd.addEventListener('click', function(){ P.api('cuenta/2fa/desactivar', { codigo: c.v }).then(function(r){ u.totp = false; E.toast(r.mensaje, 'ok'); pintar2fa(); }).catch(E.error); });
        return;
      }
      var bi = el('button', 'btn btn--primario', 'Activar verificación en dos pasos'); bi.type = 'button'; zona.appendChild(bi);
      bi.addEventListener('click', function(){
        P.api('cuenta/2fa/iniciar', {}).then(function(r){
          zona.textContent = '';
          var ol = el('ol', 'ed-pasos');
          ol.appendChild(el('li', '', 'Abre tu app autenticadora y elige «Agregar cuenta» → «Ingresar clave de configuración».'));
          var li2 = el('li', '', 'Escribe esta clave (cuenta: ' + u.email + ', tipo: basada en tiempo):');
          li2.appendChild(el('code', 'ed-clave2fa', r.secreto));
          var link = el('a', 'enlace', 'En el teléfono puedes tocar aquí para agregarla directo'); link.href = r.uri;
          li2.appendChild(el('br')); li2.appendChild(link);
          ol.appendChild(li2);
          ol.appendChild(el('li', '', 'Escribe el código de 6 dígitos que muestra la app:'));
          zona.appendChild(ol);
          var c = { v: '' }; var inp = F.texto(zona, 'Código', c, 'v', { max: 7, sinBorrador: true }); inp.inputMode = 'numeric'; inp.autocomplete = 'one-time-code';
          var ba = el('button', 'btn btn--primario', 'Confirmar y activar'); ba.type = 'button'; zona.appendChild(ba);
          ba.addEventListener('click', function(){ P.api('cuenta/2fa/activar', { codigo: c.v }).then(function(r){ u.totp = true; E.toast(r.mensaje, 'ok'); pintar2fa(); }).catch(E.error); });
          inp.focus();
        }).catch(E.error);
      });
    }
    pintar2fa();

    s = F.seccion(p, 'Sesiones abiertas', { clave: 'cta-ses', abierta: false });
    var ls = el('div', 'ed-historial'); ls.textContent = 'Cargando…'; s.appendChild(ls);
    P.api('cuenta/sesiones').then(function(r){
      ls.textContent = '';
      r.sesiones.forEach(function(x){
        var f = el('div', 'ed-historial__fila');
        var t = el('div', 'ed-historial__txt');
        t.appendChild(el('strong', '', (x.id === r.actual ? 'Este navegador · ' : '') + 'desde ' + fecha(x.creado)));
        t.appendChild(el('span', '', x.ip + ' · ' + (x.agente || '').slice(0, 90)));
        f.appendChild(t); ls.appendChild(f);
      });
    }).catch(E.error);
    var bc = el('button', 'btn btn--secundario', 'Cerrar todas las sesiones (también esta)'); bc.type = 'button';
    bc.addEventListener('click', function(){
      E.confirmar('¿Cerrar todas las sesiones?', 'Tendrás que volver a entrar en todos tus dispositivos. Útil si entraste en un computador ajeno.', { si: 'Cerrar todas' }).then(function(si){
        if(si) P.api('cuenta/cerrar-todas', {}).then(function(){ location.href = './'; }).catch(E.error);
      });
    });
    s.appendChild(bc);
  } });
})();
