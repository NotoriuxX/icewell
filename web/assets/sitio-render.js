/* ==========================================================================
   ICEWELL — Aplica window.ICEWELL_SITIO (assets/sitio-data.js) al HTML.
   Lo cargan index.html, cv.html y cv-presentacion.html; los PDF usan sus
   helpers (icewellSitio.plano, .empresa…). Así un dato (teléfono, cifra,
   texto) se cambia en UN lugar —el panel /admin— y se propaga a todo.

   Marcas en el HTML (el contenido escrito queda de respaldo si falta el JS):
     data-t="clave"          texto de ICEWELL_SITIO.textos (con formato, ver rico())
     data-empresa="campo"    dato de la empresa; en <a> también arma el href
                             (telefono → tel:, whatsapp → wa.me, correo → mailto:)
     data-wa="contexto"      href de WhatsApp con el mensaje de ese contexto
     data-cifra="obras|m2|regiones|regionesTexto"
     data-img="heroFoto"     src de una imagen del sitio
     data-lista="nombre"     contenedor que se arma entero (servicios, portada, socios…)

   Formato de texto (rico): *énfasis* → <em>, **negrita** → <b>, salto de línea → <br>,
   {anios} {desde} {obras} {m2} {regiones} → valores automáticos.
   Todo se arma con textContent/createElement: un texto nunca se interpreta como HTML.

   icewellRender() vuelve a aplicar todo (lo usa la vista previa del editor).
   ========================================================================== */
(function(){
  'use strict';

  function S(){ return window.ICEWELL_SITIO || null; }
  // cv-data.js declara const SECTORES/PROYECTOS: no cuelgan de window, pero sí se ven por nombre
  function sectores(){ try { return SECTORES; } catch(e){ return []; } }
  function proyectos(){ try { return PROYECTOS; } catch(e){ return []; } }

  // ---------- valores automáticos ----------
  function fundacion(){
    var s = S(), f = (s && s.config && s.config.fundacion) || '2009-01-01';
    var p = f.split('-').map(Number);
    return { y: p[0], m: p[1], d: p[2] };
  }
  function anios(){
    if(window.icewellAniversario) return window.icewellAniversario.anios;
    var f = fundacion(), h = new Date(), a = h.getFullYear() - f.y;
    if(h.getMonth() + 1 < f.m || (h.getMonth() + 1 === f.m && h.getDate() < f.d)) a--;
    return Math.max(a, 0);
  }
  function valor(nombre){
    var s = S() || {}, c = s.cifras || {};
    switch(nombre){
      case 'anios': return String(anios());
      case 'desde': return String(fundacion().y);
      case 'obras': return c.obras || '';
      case 'm2': return c.m2 || '';
      case 'regiones': return c.regiones || '';
      default: return null;
    }
  }

  // ---------- texto con formato → nodos (sin innerHTML) ----------
  function rico(el, texto){
    while(el.firstChild) el.removeChild(el.firstChild);
    texto = texto == null ? '' : String(texto);
    // regex nueva en cada llamada: rico() es recursivo (negrita/énfasis) y un lastIndex compartido se reiniciaría
    var RE = /\*\*([^*]+)\*\*|\*([^*]+)\*|\{(anios|desde|obras|m2|regiones)\}|\n/g;
    var doc = el.ownerDocument, ult = 0, m;
    while((m = RE.exec(texto))){
      if(m.index > ult) el.appendChild(doc.createTextNode(texto.slice(ult, m.index)));
      if(m[1] != null){ var b = doc.createElement('b'); rico(b, m[1]); el.appendChild(b); }
      else if(m[2] != null){ var em = doc.createElement('em'); rico(em, m[2]); el.appendChild(em); }
      else if(m[3] != null){
        var sp = doc.createElement('span'); sp.textContent = valor(m[3]);
        // conservar los ganchos de aniversario.js (los vuelve a rellenar en el tema aniversario)
        if(m[3] === 'anios') sp.setAttribute('data-anios', ''); else if(m[3] === 'desde') sp.setAttribute('data-desde', '');
        el.appendChild(sp);
      }
      else el.appendChild(doc.createElement('br'));
      ult = RE.lastIndex;
    }
    if(ult < texto.length) el.appendChild(doc.createTextNode(texto.slice(ult)));
  }
  // versión texto plano (PDF, title, alt): sin marcas, valores reemplazados
  function plano(texto, conSaltos){
    return String(texto == null ? '' : texto)
      .replace(/\{(anios|desde|obras|m2|regiones)\}/g, function(_, k){ return valor(k); })
      .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
      .replace(/\n/g, conSaltos ? '\n' : ' ');
  }
  // HTML seguro de un texto con formato (para quien arma HTML en string, como cv-presentacion.js):
  // se arma con rico() y se serializa → todo lo que no es formato queda escapado
  function html(texto){ var d = document.createElement('div'); rico(d, texto); return d.innerHTML; }
  function t(clave){ var s = S(); return s && s.textos && s.textos[clave] != null ? s.textos[clave] : null; }

  // ---------- empresa ----------
  function empresa(){ return (S() && S().empresa) || {}; }
  function soloDigitos(x){ return String(x || '').replace(/\D/g, ''); }
  function waUrl(contexto){
    var e = empresa(), msg = (e.wa && e.wa[contexto]) || '';
    return 'https://wa.me/' + soloDigitos(e.whatsapp) + (msg ? '?text=' + encodeURIComponent(msg) : '');
  }
  // campos derivados para no repetir la dirección armada en cada página
  function campoEmpresa(k){
    var e = empresa();
    switch(k){
      case 'direccionCompleta': return [e.direccion, e.comuna].filter(Boolean).join(', ');
      case 'ubicacion': return [e.comuna, e.ciudad].filter(Boolean).join(', ');
      case 'ubicacionLarga': return [e.comuna, e.ciudad, e.pais].filter(Boolean).join(' · ');
      case 'ciudadPais': return [e.ciudad, e.pais].filter(Boolean).join(', ');
      case 'webCorta': return String(e.web || '').replace(/^www\./, '');
      default: return e[k] == null ? '' : String(e[k]);
    }
  }
  function hrefEmpresa(k){
    var e = empresa();
    if(k === 'telefono') return 'tel:+' + soloDigitos(e.telefono);
    if(k === 'whatsapp') return 'https://wa.me/' + soloDigitos(e.whatsapp);
    if(k === 'correo' || k === 'correoComercial') return 'mailto:' + (e[k] || '');
    if(k === 'web' || k === 'webCorta') return 'https://' + String(e.web || '').replace(/^https?:\/\//, '');
    return null;
  }

  // ---------- constructores de listas ----------
  var FLECHA = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7v10h10"/><path d="m7 7 10 10"/></svg>';
  var CHECK = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  function nodo(doc, tag, clase, texto){
    var n = doc.createElement(tag);
    if(clase) n.className = clase;
    if(texto != null) rico(n, texto);
    return n;
  }
  function svg(doc, html){ var w = doc.createElement('div'); w.innerHTML = html; return w.firstChild; }   // solo íconos fijos de este archivo
  function num(i){ return String(i + 1).padStart(2, '0'); }
  function iniciales(nombre){
    return String(nombre || '').split(/\s+/).filter(function(w){ return /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(w); }).slice(0, 2)
      .map(function(w){ return w.charAt(0).toUpperCase(); }).join('');
  }
  // data-edit: ruta del dato para que el editor salte al campo al hacer clic en la vista previa
  function marcar(n, ruta){ n.setAttribute('data-edit', ruta); return n; }

  var LISTAS = {
    'servicios': function(doc, s, cont){
      (s.inicio.servicios || []).forEach(function(x, i){
        var a = marcar(nodo(doc, 'article', 'service-card'), 'inicio.servicios.' + i);
        var top = nodo(doc, 'div', 'service-card__top');
        top.appendChild(nodo(doc, 'span', '', num(i))); top.appendChild(nodo(doc, 'span', '', x.etiqueta));
        a.appendChild(top); a.appendChild(nodo(doc, 'h3', '', x.titulo)); a.appendChild(nodo(doc, 'p', '', x.texto));
        var fl = nodo(doc, 'div', 'service-card__arrow'); fl.appendChild(svg(doc, FLECHA)); a.appendChild(fl);
        cont.appendChild(a);
      });
    },
    'sectores': function(doc, s, cont){
      sectores().forEach(function(x){
        var a = doc.createElement('a'); a.href = 'cv.html#sector=' + encodeURIComponent(x.id); a.textContent = x.label;
        cont.appendChild(a);
      });
    },
    'metodo': function(doc, s, cont){
      (s.inicio.metodo || []).forEach(function(x, i){
        var a = marcar(nodo(doc, 'article', 'method-item'), 'inicio.metodo.' + i);
        a.appendChild(nodo(doc, 'span', '', num(i)));
        var d = doc.createElement('div'); d.appendChild(nodo(doc, 'h3', '', x.titulo)); d.appendChild(nodo(doc, 'p', '', x.texto));
        a.appendChild(d); a.appendChild(svg(doc, CHECK));
        cont.appendChild(a);
      });
      var r = nodo(doc, 'article', 'method-result');
      r.appendChild(nodo(doc, 'span', '', '='));
      var p = nodo(doc, 'p', '', t('metodo.resultado') || ''); p.setAttribute('data-t', 'metodo.resultado');
      r.appendChild(p); cont.appendChild(r);
    },
    'hitos': function(doc, s, cont){
      (s.inicio.hitos || []).forEach(function(x, i){
        var a = marcar(nodo(doc, 'article', 'timeline-item'), 'inicio.hitos.' + i);
        a.appendChild(nodo(doc, 'span', 'timeline-dot'));
        a.appendChild(nodo(doc, 'span', 'timeline-date', x.fecha));
        a.appendChild(nodo(doc, 'h3', '', x.titulo)); a.appendChild(nodo(doc, 'p', '', x.texto));
        cont.appendChild(a);
      });
    },
    // Portafolio del index: obras con portada:true (siempre con foto), por ordenPortada
    'portada': function(doc, s, cont){
      var lista = proyectos().filter(function(p){ return p.portada && p.foto; })
        .sort(function(a, b){ return (a.ordenPortada || 0) - (b.ordenPortada || 0); });
      lista.forEach(function(p, i){
        var a = marcar(nodo(doc, 'article', 'project-card' + (p.portadaAncha ? ' project-card--wide' : '')), 'obra:' + p.id);
        var img = doc.createElement('img'); img.src = 'assets/' + p.foto; img.alt = p.alt || p.nombre; img.loading = 'lazy';
        a.appendChild(img);
        a.appendChild(nodo(doc, 'div', 'project-card__shade'));
        var c = nodo(doc, 'div', 'project-card__content');
        var meta = doc.createElement('span'); meta.textContent = p.anio + (p.estado === 'ejecucion' ? ' · En ejecución' : '');
        var h3 = doc.createElement('h3'); h3.textContent = p.nombre;
        var tx = doc.createElement('p'); tx.textContent = p.textoPortada || [p.lugar, p.sistemas].filter(Boolean).join(' · ');
        c.appendChild(meta); c.appendChild(h3); c.appendChild(tx); a.appendChild(c);
        a.appendChild(nodo(doc, 'div', 'project-card__index', num(i)));
        cont.appendChild(a);
      });
    },
    'equipo': function(doc, s, cont){
      (s.inicio.equipo || []).forEach(function(x, i){
        var a = marcar(nodo(doc, 'article', 'team-card'), 'inicio.equipo.' + i);
        if(x.foto){
          var img = doc.createElement('img'); img.className = 'team-photo'; img.src = 'assets/' + x.foto; img.alt = x.nombre; img.loading = 'lazy';
          a.appendChild(img);
        } else {
          var ini = doc.createElement('div'); ini.className = 'team-initials team-initials--' + (i % 4 + 1); ini.textContent = iniciales(x.nombre);
          a.appendChild(ini);
        }
        var info = nodo(doc, 'div', 'team-info');
        info.appendChild(nodo(doc, 'span', '', x.cargo)); info.appendChild(nodo(doc, 'h3', '', x.nombre)); info.appendChild(nodo(doc, 'p', '', x.texto));
        a.appendChild(info);
        cont.appendChild(a);
      });
    },
    // Marquesina: la lista va 2 veces seguidas para que el loop (translateX -50%) no tenga salto
    'socios': function(doc, s, cont){
      var socios = s.inicio.socios || [];
      [0, 1].forEach(function(vuelta){
        socios.forEach(function(x, i){
          var img = doc.createElement('img'); img.src = 'assets/' + x.logo; img.alt = vuelta ? '' : x.nombre;
          if(vuelta) img.setAttribute('aria-hidden', 'true');
          if(x.grande) img.className = 'logo-grande';
          if(!vuelta) marcar(img, 'inicio.socios.' + i);
          cont.appendChild(img);
        });
      });
    },
    // CV (cv.html)
    'cv-servicios': function(doc, s, cont){
      (s.cv.servicios || []).forEach(function(x, i){
        var a = marcar(nodo(doc, 'article', 'service'), 'cv.servicios.' + i);
        a.appendChild(nodo(doc, 'span', '', x.etiqueta)); a.appendChild(nodo(doc, 'h3', '', x.titulo)); a.appendChild(nodo(doc, 'p', '', x.texto));
        var ul = doc.createElement('ul');
        (x.items || []).forEach(function(it){ ul.appendChild(nodo(doc, 'li', '', it)); });
        a.appendChild(ul);
        cont.appendChild(a);
      });
    },
    'cv-cert': function(doc, s, cont){
      (s.cv.certificaciones || []).forEach(function(x){ cont.appendChild(marcar(nodo(doc, 'div', '', x), 'cv.certificaciones')); });
    }
  };

  // ---------- aplicar ----------
  function render(raiz){
    var s = S(); if(!s) return;
    var doc = (raiz && raiz.ownerDocument) || document;
    raiz = raiz || doc;
    raiz.querySelectorAll('[data-t]').forEach(function(el){
      var v = t(el.getAttribute('data-t'));
      if(v != null) rico(el, v);
    });
    raiz.querySelectorAll('[data-empresa]').forEach(function(el){
      var k = el.getAttribute('data-empresa'), v = campoEmpresa(k);
      el.textContent = v;
      if(el.tagName === 'A'){ var h = hrefEmpresa(k); if(h) el.setAttribute('href', h); }
      el.hidden = !v && el.hasAttribute('data-ocultar-vacio');
    });
    raiz.querySelectorAll('[data-wa]').forEach(function(el){ el.setAttribute('href', waUrl(el.getAttribute('data-wa'))); });
    raiz.querySelectorAll('[data-cifra]').forEach(function(el){
      var v = (s.cifras || {})[el.getAttribute('data-cifra')];
      if(v == null) return;
      el.textContent = v;
      // contador animado del index: si ya leyó su objetivo, mostrar el valor nuevo tal cual
      if(el._countParts){ el._countParts = null; el._counted = true; }
    });
    raiz.querySelectorAll('[data-img]').forEach(function(el){
      var k = el.getAttribute('data-img'), v = s.inicio && s.inicio[k];
      if(v) el.setAttribute('src', 'assets/' + v);
      var alt = s.inicio && s.inicio[k + 'Alt']; if(alt) el.setAttribute('alt', alt);
    });
    raiz.querySelectorAll('[data-lista]').forEach(function(cont){
      var f = LISTAS[cont.getAttribute('data-lista')];
      if(!f) return;
      while(cont.firstChild) cont.removeChild(cont.firstChild);
      f(doc, s, cont);
    });
    // Redes sociales: se muestran solo las que tienen dirección
    raiz.querySelectorAll('[data-red]').forEach(function(a){
      var u = (empresa().redes || {})[a.getAttribute('data-red')];
      if(u && /^https:\/\//i.test(u)){ a.href = u; a.hidden = false; } else { a.hidden = true; a.removeAttribute('href'); }
    });
    raiz.querySelectorAll('[data-redes]').forEach(function(c){
      c.hidden = !c.querySelector('[data-red]:not([hidden])');
    });
    // <title> y descripción solo en la página que lo pide (<html data-seo>)
    if(doc.documentElement.hasAttribute('data-seo') && s.seo){
      if(s.seo.titulo) doc.title = plano(s.seo.titulo);
      var md = doc.querySelector('meta[name="description"]');
      if(md && s.seo.descripcion) md.setAttribute('content', plano(s.seo.descripcion));
    }
  }

  window.icewellSitio = {
    datos: S, t: t, rico: rico, html: html, plano: plano, valor: valor,
    empresa: empresa, campoEmpresa: campoEmpresa, waUrl: waUrl, iniciales: iniciales, proyectos: proyectos
  };
  window.icewellRender = render;
  render();
})();
