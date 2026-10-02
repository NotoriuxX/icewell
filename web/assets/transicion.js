/* ICEWELL — transición de carga entre páginas (inicio ↔ /curriculum ↔ /presentacion)
   Se carga en el <head> de las 3 páginas (síncrono y liviano) para que, al llegar desde
   otra página nuestra, la cortina ya esté puesta antes del primer pintado (sin parpadeo).
   - Salida: al hacer clic en un enlace a otra de las 3 páginas, la cortina entra y recién
     después se navega. La llegada lee `sessionStorage` y mantiene la cortina hasta
     que la página avisa `icewellTransicion.listo()` (o, como respaldo, al evento `load`).
   - Se omite dentro de un iframe (vista previa del panel), con Ctrl/Cmd/Shift/clic medio,
     en enlaces con target/download y en saltos de ancla dentro de la misma página.
   - Con `prefers-reduced-motion` la cortina es un fundido corto, sin giro. */
(function(){
  'use strict';
  if(window.top !== window) return;                       // vista previa del panel: sin cortina
  var CLAVE = 'icewellTr';
  var MIN_MS = 450;                                       // tiempo mínimo visible al llegar (evita un destello)
  var MAX_MS = 6000;                                      // respaldo: nunca dejar la cortina pegada
  var SALIDA_MS = 500;                                    // lo que tarda en cubrir antes de navegar
  /* Último tramo de la dirección → página. Direcciones limpias (/curriculum, /presentacion;
     ver web/.htaccess) y, por si acaso, los nombres de archivo de antes. */
  var PAGINAS = { '': 'inicio', 'index.html': 'inicio', 'curriculum': 'curriculum', 'cv.html': 'curriculum',
                  'presentacion': 'presentacion', 'cv-presentacion.html': 'presentacion' };
  /* Abierto con doble clic (file://) no hay servidor que traduzca /curriculum: se va al archivo. */
  var ARCHIVOS = { inicio: 'index.html', curriculum: 'cv.html', presentacion: 'cv-presentacion.html' };
  var reducido = false;
  try{ reducido = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}

  /* Misma pantalla de carga que ya tenía el sitio (#preloader de index.html): fondo blanco→celeste,
     isotipo que gira con brillo bajo y fundido de .5 s. Si cambia allá, cambiarlo acá. */
  var css = document.createElement('style');
  css.textContent =
    '.tr-cortina{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
      'background:linear-gradient(160deg,#FFFFFF,#E7F3FA);opacity:0;visibility:hidden;pointer-events:none;' +
      'transition:opacity .5s cubic-bezier(.23,1,.32,1),visibility .5s cubic-bezier(.23,1,.32,1)}' +
    '.tr-cortina.on{opacity:1;visibility:visible;pointer-events:auto}' +
    '.tr-cortina.ya{opacity:1;visibility:visible;transition:none}' +                       /* puesta desde el primer pintado */
    '.tr-cortina img{width:84px;height:84px;animation:trSpin 1.8s cubic-bezier(.45,.05,.55,.95) infinite}' +
    '@keyframes trSpin{' +
      '0%{transform:rotate(0deg) scale(1);filter:drop-shadow(0 0 2px rgba(0,98,168,.15))}' +
      '25%{transform:rotate(90deg) scale(1.06);filter:drop-shadow(0 0 8px rgba(95,196,228,.32))}' +
      '50%{transform:rotate(180deg) scale(1);filter:drop-shadow(0 0 2px rgba(26,150,20,.15))}' +
      '75%{transform:rotate(270deg) scale(1.06);filter:drop-shadow(0 0 8px rgba(95,196,228,.32))}' +
      '100%{transform:rotate(360deg) scale(1);filter:drop-shadow(0 0 2px rgba(0,98,168,.15))}}' +
    '@media (prefers-reduced-motion:reduce){.tr-cortina{transition-duration:.01s}.tr-cortina img{animation:none}}';
  document.documentElement.appendChild(css);

  var cortina = document.createElement('div');
  cortina.className = 'tr-cortina';
  cortina.setAttribute('role', 'status');
  cortina.innerHTML = '<img src="assets/isotipo.svg" alt="Cargando">';
  document.documentElement.appendChild(cortina);

  function leer(){ try{ return sessionStorage.getItem(CLAVE); }catch(e){ return null; } }
  function guardar(v){ try{ v == null ? sessionStorage.removeItem(CLAVE) : sessionStorage.setItem(CLAVE, v); }catch(e){} }

  /* ── llegada ── */
  var desde = leer();
  var inicio = Date.now();
  var pagina = false, listo = false, cerrada = false;
  function cerrar(){
    if(cerrada) return; cerrada = true;
    var espera = Math.max(0, MIN_MS - (Date.now() - inicio));
    setTimeout(function(){
      guardar(null);
      cortina.classList.remove('ya', 'on');
      void cortina.offsetWidth;                            // reflujo para que el fundido de salida corra
    }, espera);
  }
  function revisar(){ if(pagina && listo) cerrar(); }
  if(desde){
    cortina.classList.add('ya');                           // visible ya, sin transición
    setTimeout(function(){ pagina = listo = true; revisar(); }, MAX_MS);
    window.addEventListener('load', function(){ pagina = true; revisar(); });
    // si la página no avisa, el load basta (index); cv/presentación avisan tras su primer armado
    if(nombreDe(location) === 'inicio') listo = true;
  }
  /* bfcache: al volver con "Atrás" la página queda con la cortina de salida puesta */
  window.addEventListener('pageshow', function(e){
    if(e.persisted){ cortina.classList.remove('ya', 'on'); guardar(null); }
  });

  /* ── salida ── */
  function nombreDe(url){
    var p = url.pathname.split('/').pop();
    return Object.prototype.hasOwnProperty.call(PAGINAS, p) ? PAGINAS[p] : null;
  }
  /* WhatsApp es otro sitio (y se abre en pestaña nueva): se cubre la página un instante con
     "Abriendo WhatsApp" y se abre la pestaña. La pestaña se abre en el clic (si no, el bloqueador
     de ventanas la frena) y se le asigna la dirección cuando la cortina ya cubrió. */
  function irAWhatsapp(e, a, url){
    e.preventDefault();
    var nueva = a.target === '_blank';
    var w = null;
    if(nueva){ try{ w = window.open('', '_blank'); if(w) w.opener = null; }catch(err){} }
    cortina.classList.add('on');
    setTimeout(function(){
      if(nueva && w){ w.location.href = url.href; }
      else if(nueva){ window.open(url.href, '_blank', 'noopener'); }   // sin pestaña previa: intento directo
      else { location.href = url.href; return; }
      setTimeout(function(){ cortina.classList.remove('on'); }, 500);  // la página original queda lista al volver
    }, reducido ? 60 : SALIDA_MS + 250);
  }

  document.addEventListener('click', function(e){
    if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if(!a || a.hasAttribute('download')) return;
    var url;
    try{ url = new URL(a.href, location.href); }catch(err){ return; }
    if(url.hostname === 'wa.me' || url.hostname === 'api.whatsapp.com'){ irAWhatsapp(e, a, url); return; }
    if(a.target && a.target !== '_self') return;
    if(url.origin !== location.origin || !/^https?:$/.test(url.protocol) && url.protocol !== 'file:') return;
    var destino = nombreDe(url);
    if(!destino) return;
    if(destino === nombreDe(location) && url.search === location.search) return;   // ancla/filtro en la misma página
    e.preventDefault();
    if(url.protocol === 'file:') url.pathname = url.pathname.replace(/[^\/]*$/, ARCHIVOS[destino]);
    cortina.classList.add('on');
    guardar('1');
    setTimeout(function(){ location.href = url.href; }, reducido ? 60 : SALIDA_MS);
  });

  window.icewellTransicion = {
    /* La página llama esto cuando su primer armado terminó (cv, presentación). */
    listo: function(){ listo = true; revisar(); }
  };
})();
