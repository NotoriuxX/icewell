/* ICEWELL — Página del enlace de recuperación (/admin/restablecer?id=…&t=… → restablecer.html)
   1) Lee el id y el token del enlace y los saca de la barra de direcciones
      (no quedan en el historial ni se comparten por error).
   2) Pregunta al servidor si el enlace sirve ANTES de mostrar el formulario.
   3) Guarda la contraseña nueva; el servidor gasta el enlace (un solo uso). */
(function(){
  'use strict';
  var P = window.Panel;
  var q = new URLSearchParams(location.search);
  var id = q.get('id') || '', t = q.get('t') || '';
  try { history.replaceState(null, '', location.pathname); } catch(e){}
  var aviso = document.getElementById('aviso'), form = document.getElementById('formClave'), quien = document.getElementById('paraQuien');
  P.verClaves();
  P.medidor(form.clave, document.getElementById('medidor'), document.getElementById('claveAyuda'));

  if(!id || !t){ quien.textContent = ''; P.aviso(aviso, 'El enlace está incompleto. Ábrelo directo desde el correo o pide uno nuevo.', 'error'); return; }
  P.api('auth/enlace', { id: id, t: t }).then(function(r){
    quien.textContent = 'Cuenta: ' + r.correo + '. Elige una contraseña de al menos 12 caracteres que no uses en otro sitio.';
    form.hidden = false;
    form.clave.focus();
  }).catch(function(err){ quien.textContent = ''; P.aviso(aviso, err.message, 'error'); });

  form.addEventListener('submit', function(e){
    e.preventDefault();
    P.errorEnCampo(form, null);
    if(form.clave.value.length < 12) return P.errorEnCampo(form, 'clave', 'Mínimo 12 caracteres.');
    if(form.clave.value !== form.clave2.value) return P.errorEnCampo(form, 'clave2', 'Las contraseñas no coinciden.');
    var btn = form.querySelector('[type=submit]');
    P.ocupado(btn, true);
    P.api('auth/restablecer', { id: id, t: t, clave: form.clave.value }).then(function(r){
      form.hidden = true; quien.textContent = '';
      P.aviso(aviso, r.mensaje, 'ok');
      document.getElementById('volver').textContent = 'Entrar con la contraseña nueva';
    }).catch(function(err){
      if(!P.errorEnCampo(form, err.datos && err.datos.campo, err.message)) P.aviso(aviso, err.message, 'error');
    }).then(function(){ P.ocupado(btn, false); });
  });
})();
