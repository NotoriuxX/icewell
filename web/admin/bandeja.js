/* ICEWELL — Bandeja de correos de prueba (solo modo local) */
(function(){
  'use strict';
  var P = window.Panel, lista = document.getElementById('lista');
  function cargar(){
    P.api('dev/bandeja').then(function(r){
      lista.textContent = '';
      if(!r.correos.length){ P.aviso(document.getElementById('aviso'), 'Todavía no hay correos. Prueba "Crear cuenta" o "¿La olvidaste?".'); return; }
      P.aviso(document.getElementById('aviso'), '');
      r.correos.forEach(function(c){
        var art = document.createElement('article'); art.className = 'correo';
        var cab = document.createElement('p'); cab.className = 'correo__cab';
        cab.textContent = new Date(c.fecha * 1000).toLocaleString('es-CL') + ' · para ' + c.para;
        var h = document.createElement('h3'); h.textContent = c.asunto;
        var cuerpo = document.createElement('p'); cuerpo.className = 'correo__texto';
        // texto plano; los enlaces del mismo sitio se vuelven clic (nada de HTML del correo)
        c.texto.split(/(https?:\/\/\S+)/).forEach(function(parte){
          if(/^https?:\/\//.test(parte) && parte.indexOf(location.origin) === 0){
            var a = document.createElement('a'); a.href = parte; a.textContent = parte; cuerpo.appendChild(a);
          } else cuerpo.appendChild(document.createTextNode(parte));
        });
        art.appendChild(cab); art.appendChild(h); art.appendChild(cuerpo);
        lista.appendChild(art);
      });
    }).catch(function(err){ P.aviso(document.getElementById('aviso'), err.estado === 404 ? 'La bandeja de prueba solo existe en modo local.' : err.message, 'error'); });
  }
  document.getElementById('recargar').addEventListener('click', cargar);
  cargar();
})();
