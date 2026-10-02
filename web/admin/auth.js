/* ==========================================================================
   ICEWELL — Entrar / Crear cuenta / Recuperar (admin/index.html)
   Un carril con 3 paneles que se desliza de lado: Registro ← Entrar → Recuperar.
   El panel visible queda en el hash (#registro, #recuperar) para que "Atrás"
   funcione y el enlace se pueda compartir. Los paneles ocultos llevan inert
   (no se puede tabular ni leer lo que no se ve).
   ========================================================================== */
(function(){
  'use strict';
  var P = window.Panel;
  var PANELES = ['registro', 'login', 'recuperar'];
  var carril = document.getElementById('carril'), ventana = document.getElementById('ventana');
  var actual = null;

  // ---------- deslizamiento ----------
  function altoDe(nombre){ return document.querySelector('[data-panel="' + nombre + '"]').offsetHeight; }
  function mostrar(nombre, enfocar){
    if(PANELES.indexOf(nombre) < 0) nombre = 'login';
    var previo = actual;
    actual = nombre;
    // fijar el alto actual antes de cambiar: así la altura también se anima
    if(previo) ventana.style.height = altoDe(previo) + 'px';
    carril.style.setProperty('--i', PANELES.indexOf(nombre));
    document.querySelectorAll('.panel').forEach(function(p){
      var activo = p.dataset.panel === nombre;
      p.inert = !activo;
      if(activo) p.removeAttribute('aria-hidden'); else p.setAttribute('aria-hidden', 'true');
    });
    requestAnimationFrame(function(){ ventana.style.height = altoDe(nombre) + 'px'; });
    document.title = 'Panel Icewell — ' + { registro: 'Crear cuenta', login: 'Entrar', recuperar: 'Recuperar acceso' }[nombre];
    if(enfocar){
      setTimeout(function(){
        var f = document.querySelector('[data-panel="' + nombre + '"] input:not([type=hidden])');
        if(f) f.focus({ preventScroll: true });
      }, 380);
    }
  }
  // el alto sigue al contenido (avisos que aparecen, errores, 2FA)
  if(window.ResizeObserver){
    new ResizeObserver(function(){ if(actual) ventana.style.height = altoDe(actual) + 'px'; })
      .observe(document.querySelector('.carril'));
  }
  function desdeHash(enfocar){ mostrar((location.hash || '').replace('#', '') || 'login', enfocar); }
  window.addEventListener('hashchange', function(){ desdeHash(true); });
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-ir]');
    if(!b) return;
    var destino = b.dataset.ir;
    // el correo escrito pasa de un panel a otro (no hay que escribirlo dos veces)
    var correo = document.querySelector('[data-panel="' + actual + '"] input[type=email]');
    var dest = document.querySelector('[data-panel="' + destino + '"] input[type=email]');
    if(correo && dest && correo.value && !dest.value) dest.value = correo.value;
    if(destino === 'login') history.pushState(null, '', location.pathname + location.search); else history.pushState(null, '', '#' + destino);
    mostrar(destino, true);
  });

  // ---------- entrar ----------
  var formLogin = document.getElementById('formLogin'), formTotp = document.getElementById('formTotp');
  var avisoLogin = document.getElementById('avisoLogin');
  var desafio = '';
  function entrar(){ location.replace('editor.html'); }

  formLogin.addEventListener('submit', function(e){
    e.preventDefault();
    var correo = formLogin.correo.value.trim(), clave = formLogin.clave.value;
    if(!correo || !clave){ P.aviso(avisoLogin, 'Escribe tu correo y tu contraseña.', 'error'); return; }
    var btn = formLogin.querySelector('[type=submit]');
    P.ocupado(btn, true); P.aviso(avisoLogin, '');
    P.api('auth/login', { correo: correo, clave: clave }).then(function(r){
      if(r.requiere_totp){ desafio = r.desafio; pasoTotp(true); return; }
      entrar();
    }).catch(function(err){
      P.aviso(avisoLogin, err.message, 'error');
      formLogin.clave.value = ''; formLogin.clave.focus();
    }).then(function(){ P.ocupado(btn, false); });
  });

  function pasoTotp(si){
    formLogin.hidden = si; formTotp.hidden = !si;
    document.getElementById('sepGoogle').hidden = si || !googleListo;
    document.getElementById('googleBtn').hidden = si || !googleListo;
    if(si){ P.aviso(avisoLogin, ''); formTotp.codigo.value = ''; formTotp.codigo.focus(); }
  }
  document.getElementById('totpVolver').addEventListener('click', function(){ desafio = ''; pasoTotp(false); formLogin.clave.focus(); });
  formTotp.addEventListener('submit', function(e){
    e.preventDefault();
    var btn = formTotp.querySelector('[type=submit]');
    P.ocupado(btn, true);
    P.api('auth/totp', { desafio: desafio, codigo: formTotp.codigo.value.replace(/\s/g, '') }).then(entrar).catch(function(err){
      P.aviso(avisoLogin, err.message, 'error');
      if(err.estado === 401 && /venció/.test(err.message)) pasoTotp(false);
      else { formTotp.codigo.select(); }
    }).then(function(){ P.ocupado(btn, false); });
  });

  // ---------- crear cuenta ----------
  var formReg = document.getElementById('formRegistro'), avisoReg = document.getElementById('avisoRegistro');
  P.medidor(formReg.clave, document.getElementById('regMedidor'), document.getElementById('regClaveAyuda'));
  formReg.addEventListener('submit', function(e){
    e.preventDefault();
    P.errorEnCampo(formReg, null);
    var d = { nombre: formReg.nombre.value.trim(), correo: formReg.correo.value.trim(), clave: formReg.clave.value };
    if(d.nombre.length < 2) return P.errorEnCampo(formReg, 'nombre', 'Escribe tu nombre.');
    if(!/^[^@\s]+@[^@\s]+$/.test(d.correo)) return P.errorEnCampo(formReg, 'correo', 'Escribe un correo válido.');
    var dom = d.correo.split('@')[1].toLowerCase();
    if(dominios.length && dominios.indexOf(dom) < 0) return P.errorEnCampo(formReg, 'correo', 'Usa tu correo de la empresa (@' + dominios.join(', @') + ').');
    if(d.clave.length < 12) return P.errorEnCampo(formReg, 'clave', 'Mínimo 12 caracteres.');
    if(d.clave !== formReg.clave2.value) return P.errorEnCampo(formReg, 'clave2', 'Las contraseñas no coinciden.');
    var btn = formReg.querySelector('[type=submit]');
    P.ocupado(btn, true); P.aviso(avisoReg, '');
    P.api('auth/registro', d).then(function(r){
      formReg.hidden = true;
      P.aviso(avisoReg, r.mensaje, 'ok');
    }).catch(function(err){
      if(!P.errorEnCampo(formReg, err.datos && err.datos.campo, err.message)) P.aviso(avisoReg, err.message, 'error');
    }).then(function(){ P.ocupado(btn, false); });
  });

  // ---------- recuperar ----------
  var formRec = document.getElementById('formRecuperar'), avisoRec = document.getElementById('avisoRecuperar');
  formRec.addEventListener('submit', function(e){
    e.preventDefault();
    var correo = formRec.correo.value.trim();
    if(!/^[^@\s]+@[^@\s]+$/.test(correo)) return P.errorEnCampo(formRec, 'correo', 'Escribe tu correo.');
    P.errorEnCampo(formRec, null);
    var btn = formRec.querySelector('[type=submit]');
    P.ocupado(btn, true);
    P.api('auth/recuperar', { correo: correo }).then(function(r){
      P.aviso(avisoRec, r.mensaje, 'ok');
      btn.textContent = 'Enviar de nuevo';
    }).catch(function(err){ P.aviso(avisoRec, err.message, 'error'); })
      .then(function(){ P.ocupado(btn, false); });
  });

  // ---------- Google (solo si está configurado en el servidor) ----------
  var googleListo = false, dominios = [];
  function iniciarGoogle(clientId){
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = function(){
      if(!window.google || !google.accounts) return;
      google.accounts.id.initialize({
        client_id: clientId, ux_mode: 'popup', auto_select: false, context: 'signin',
        callback: function(resp){
          P.aviso(avisoLogin, 'Verificando tu cuenta de Google…');
          P.api('auth/google', { credential: resp.credential }).then(function(r){
            if(r.requiere_totp){ desafio = r.desafio; pasoTotp(true); return; }
            entrar();
          }).catch(function(err){ P.aviso(avisoLogin, err.message, 'error'); });
        }
      });
      var cont = document.getElementById('googleBtn');
      google.accounts.id.renderButton(cont, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', locale: 'es', width: Math.min(360, cont.offsetWidth || 320) });
      googleListo = true;
      cont.hidden = false; document.getElementById('sepGoogle').hidden = false; document.getElementById('notaGoogle').hidden = false;
    };
    document.head.appendChild(s);
  }

  // ---------- modo local ----------
  document.getElementById('btnDev').addEventListener('click', function(){
    P.api('auth/desarrollador', {}).then(entrar).catch(function(err){ P.aviso(avisoLogin, err.message, 'error'); });
  });

  // ---------- arranque ----------
  P.verClaves();
  desdeHash(false);
  P.api('sesion').then(entrar).catch(function(){ /* sin sesión: quedarse acá */ });
  P.api('config').then(function(c){
    dominios = c.dominios || [];
    document.querySelectorAll('.js-dominio').forEach(function(el){ el.textContent = '@' + dominios.join(' o @'); });
    var reg = document.getElementById('regCorreo'); if(reg && dominios[0]) reg.placeholder = 'nombre@' + dominios[0];
    if(c.googleClientId) iniciarGoogle(c.googleClientId);
    document.getElementById('bloqueDev').hidden = !c.desarrollador;
  }).catch(function(err){ P.aviso(avisoLogin, err.message, 'error'); });
})();
