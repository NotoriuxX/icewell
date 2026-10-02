/* ICEWELL — Confirmación de correo (admin/verificar.html?id=…&t=…) */
(function(){
  'use strict';
  var P = window.Panel;
  var q = new URLSearchParams(location.search), id = q.get('id') || '', t = q.get('t') || '';
  try { history.replaceState(null, '', location.pathname); } catch(e){}
  var icono = document.getElementById('icono'), titulo = document.getElementById('titulo'), aviso = document.getElementById('aviso'), ir = document.getElementById('ir');
  function fin(ok, tit, msg){
    icono.textContent = ok ? '✓' : '!';
    icono.className = 'estado-icono estado-icono--' + (ok ? 'ok' : 'error');
    titulo.textContent = tit;
    P.aviso(aviso, msg, ok ? 'ok' : 'error');
    ir.hidden = false;
  }
  if(!id || !t) return fin(false, 'Enlace incompleto', 'Abre el enlace directo desde el correo.');
  P.api('auth/verificar', { id: id, t: t })
    .then(function(r){ fin(true, r.estado === 'activo' ? 'Listo' : 'Correo confirmado', r.mensaje); })
    .catch(function(err){ fin(false, 'No se pudo confirmar', err.message); });
})();
