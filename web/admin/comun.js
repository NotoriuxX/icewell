/* ==========================================================================
   ICEWELL — Panel: utilidades comunes (acceso y editor)
   - api(): fetch a ../api/?r=… con las cabeceras que exige el servidor
     (X-Requested-With y, con sesión, X-CSRF-Token). Errores → excepción con mensaje.
   - Mostrar/ocultar contraseña, medidor de fuerza, avisos.
   Sin JavaScript en línea en el HTML (CSP script-src 'self').
   ========================================================================== */
(function(){
  'use strict';
  var csrf = '';

  function api(ruta, datos, opciones){
    opciones = opciones || {};
    var init = { method: datos === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'icewell' } };
    if(datos !== undefined){
      init.headers['Content-Type'] = 'application/json';
      if(csrf) init.headers['X-CSRF-Token'] = csrf;
      init.body = JSON.stringify(datos);
    }
    return fetch('../api/?r=' + encodeURIComponent(ruta).replace(/%2F/g, '/') + (opciones.query || ''), init)
      .catch(function(){ throw Object.assign(new Error('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'), { estado: 0 }); })
      .then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(d){
          if(d && d.csrf) csrf = d.csrf;
          if(!r.ok || d.ok === false){
            var e = new Error((d && d.error) || 'Algo falló (error ' + r.status + ').');
            e.estado = r.status; e.datos = d || {};
            throw e;
          }
          return d;
        });
      });
  }

  function aviso(el, texto, tipo){
    if(!el) return;
    el.className = 'aviso' + (tipo ? ' aviso--' + tipo : '');
    el.textContent = texto || '';
    el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  }

  // botón "Mostrar" en cada contraseña
  function verClaves(raiz){
    (raiz || document).querySelectorAll('.ver-clave').forEach(function(b){
      if(b._listo) return; b._listo = true;
      b.addEventListener('click', function(){
        var inp = b.parentNode.querySelector('input');
        var ver = inp.type === 'password';
        inp.type = ver ? 'text' : 'password';
        b.textContent = ver ? 'Ocultar' : 'Mostrar';
        b.setAttribute('aria-pressed', String(ver));
        inp.focus();
      });
    });
  }

  // Fuerza aproximada (el servidor decide): largo, variedad y patrones obvios.
  var COMUNES = /^(1234|qwer|asdf|pass|contra|admin|icewell|chile|santiago)/i;
  function fuerza(clave){
    if(!clave) return { n: 0, txt: '' };
    if(clave.length < 12) return { n: 1, txt: 'Muy corta: mínimo 12 caracteres. Una frase de 3 o 4 palabras es fácil de recordar y segura.' };
    var tipos = [/[a-záéíóúñ]/, /[A-ZÁÉÍÓÚÑ]/, /\d/, /[^\wáéíóúñÁÉÍÓÚÑ]/].filter(function(r){ return r.test(clave); }).length;
    var puntos = (clave.length >= 16 ? 2 : 1) + (tipos >= 3 ? 1 : 0) + (/\s/.test(clave) && clave.length >= 16 ? 1 : 0);
    if(COMUNES.test(clave) || new Set(clave.toLowerCase()).size < 6) puntos = Math.min(puntos, 2);
    var n = Math.max(2, Math.min(4, puntos + 1));
    return { n: n, txt: ['', '', 'Aceptable. Más largo es mejor.', 'Buena.', 'Muy buena.'][n] };
  }
  function medidor(input, barra, texto){
    var ayuda = texto.textContent;   // sin nada escrito se deja la ayuda original
    function act(){ var f = fuerza(input.value); barra.dataset.n = f.n; texto.textContent = f.txt || ayuda; }
    input.addEventListener('input', act); act();
  }

  // marca un campo con error (y lo enfoca) a partir de la respuesta del servidor { campo }
  function errorEnCampo(form, campo, msg){
    form.querySelectorAll('[aria-invalid]').forEach(function(i){ i.removeAttribute('aria-invalid'); });
    form.querySelectorAll('.error-campo').forEach(function(e){ e.remove(); });
    if(!campo) return false;
    var inp = form.querySelector('[name="' + campo + '"]');
    if(!inp) return false;
    inp.setAttribute('aria-invalid', 'true');
    var e = document.createElement('span'); e.className = 'error-campo'; e.id = inp.id + '-error'; e.textContent = msg;
    inp.setAttribute('aria-describedby', e.id);
    (inp.closest('.campo') || inp.parentNode).appendChild(e);
    inp.focus();
    return true;
  }

  function ocupado(boton, si){
    boton.disabled = si;
    boton.classList.toggle('cargando', si);
    boton.setAttribute('aria-busy', String(si));
  }

  window.Panel = {
    api: api, aviso: aviso, verClaves: verClaves, medidor: medidor, fuerza: fuerza,
    errorEnCampo: errorEnCampo, ocupado: ocupado,
    setCsrf: function(t){ csrf = t || ''; }, getCsrf: function(){ return csrf; }
  };
})();
