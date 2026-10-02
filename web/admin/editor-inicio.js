/* ICEWELL — Editor: arranque. Sin sesión → a la pantalla de entrada. */
(function(){
  'use strict';
  var E = window.Editor, P = window.Panel;
  E.cargar().then(function(){
    document.getElementById('cargando') && document.getElementById('cargando').remove();
    var tab = (location.hash || '').replace('#', '');
    E.tab(E.tabs[tab] ? tab : 'inicio');
    // en celular se parte viendo el sitio; el panel se abre con "Editar" o al tocar un texto
    document.body.classList.remove('ed--panel-abierto');
    E.vista.iniciar();
    E.recuperarLocal();
    // solicitudes nuevas del formulario del sitio (pestaña Solicitudes)
    if(E.solicitudesNuevas) E.solicitudesNuevas().then(function(n){
      if(n) E.toast(n === 1 ? 'Llegó 1 solicitud nueva desde el sitio (pestaña Solicitudes).' : 'Llegaron ' + n + ' solicitudes nuevas desde el sitio (pestaña Solicitudes).');
    });
    // aviso de cuentas por aprobar (pestaña Usuarios)
    if(E.usuario.rol === 'admin'){
      P.api('usuarios').then(function(r){
        var n = r.usuarios.filter(function(u){ return u.estado === 'pendiente_aprobacion'; }).length;
        var b = document.getElementById('pendientes'); b.hidden = !n; b.textContent = n;
        if(n) E.toast(n === 1 ? 'Hay 1 cuenta nueva esperando tu aprobación (pestaña Usuarios).' : 'Hay ' + n + ' cuentas nuevas esperando tu aprobación (pestaña Usuarios).');
      }).catch(function(){});
    }
  }).catch(function(err){
    if(err.estado === 401){ location.replace('./'); return; }
    var c = document.getElementById('cargando');
    if(c){ c.textContent = 'No se pudo cargar el editor: ' + err.message; c.className = 'aviso aviso--error'; }
  });
})();
