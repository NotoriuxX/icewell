/* ==========================================================================
   ICEWELL — Editor: Solicitudes del formulario «Cuéntanos tu proyecto».
   Llegan por api/?r=contacto (servidor/lib/Solicitudes.php), que además avisa
   por correo a la empresa. Aquí se revisan, se responden y se marcan atendidas.
   Todo lo que escribió el visitante se muestra con textContent (F.el).
   ========================================================================== */
(function(){
  'use strict';
  var E = window.Editor, F = E.campos, P = window.Panel, el = F.el;
  var filtro = 'nueva';
  function fecha(t){ return new Date(t * 1000).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }); }
  function contador(n){ var b = document.getElementById('nuevasSol'); if(b){ b.hidden = !n; b.textContent = n; } }
  E.solicitudesNuevas = function(){ return P.api('solicitudes/nuevas').then(function(r){ contador(r.n); return r.n; }).catch(function(){ return 0; }); };

  function pintar(cont, r){
    cont.textContent = '';
    var lista = r.solicitudes;
    contador(lista.filter(function(s){ return s.estado === 'nueva'; }).length);
    var ver = filtro === 'todas' ? lista : lista.filter(function(s){ return s.estado === 'nueva'; });
    if(!ver.length){
      cont.appendChild(el('p', 'ed-ayuda', filtro === 'todas' ? 'Todavía no llega ninguna solicitud.' : 'No hay solicitudes nuevas. 🎉'));
      return;
    }
    ver.forEach(function(s){
      var c = el('article', 'ed-solicitud' + (s.estado === 'nueva' ? ' ed-solicitud--nueva' : ''));
      var cab = el('div', 'ed-solicitud__cab');
      cab.appendChild(el('strong', '', s.nombre));
      cab.appendChild(el('span', 'ed-marca ' + (s.estado === 'nueva' ? 'ed-marca--amarilla' : 'ed-marca--verde'), s.estado === 'nueva' ? 'Nueva' : 'Atendida'));
      cab.appendChild(el('span', 'ed-solicitud__tipo', r.tipos[s.tipo] || s.tipo));
      cab.appendChild(el('span', 'ed-solicitud__fecha', fecha(s.fecha)));
      c.appendChild(cab);
      var datos = el('p', 'ed-solicitud__datos');
      var mail = el('a', '', s.correo); mail.href = 'mailto:' + s.correo + '?subject=' + encodeURIComponent('Re: tu solicitud a Icewell');
      datos.appendChild(mail);
      if(s.telefono){ datos.appendChild(document.createTextNode(' · ')); var tel = el('a', '', s.telefono); tel.href = 'tel:' + s.telefono.replace(/[^0-9+]/g, ''); datos.appendChild(tel); }
      c.appendChild(datos);
      c.appendChild(el('p', 'ed-solicitud__msg', s.mensaje));
      var acc = el('div', 'ed-solicitud__acc');
      var resp = el('a', 'btn btn--primario btn--chico', 'Responder por correo'); resp.href = mail.href;
      acc.appendChild(resp);
      var est = el('button', 'btn btn--secundario btn--chico', s.estado === 'nueva' ? 'Marcar atendida' : 'Marcar como nueva'); est.type = 'button';
      est.addEventListener('click', function(){
        P.api('solicitudes/estado', { id: s.id, estado: s.estado === 'nueva' ? 'atendida' : 'nueva' }).then(cargar).catch(E.error);
      });
      acc.appendChild(est);
      if(E.usuario && E.usuario.rol === 'admin'){
        var del = el('button', 'btn btn--peligro btn--chico', 'Borrar'); del.type = 'button';
        del.addEventListener('click', function(){
          E.confirmar('¿Borrar la solicitud de ' + s.nombre + '?', ['Se elimina del panel y no se puede recuperar. El correo de aviso que ya llegó no se borra.'], { si: 'Borrar', peligro: true })
            .then(function(si){ if(si) return P.api('solicitudes/borrar', { id: s.id }).then(cargar); }).catch(E.error);
        });
        acc.appendChild(del);
      }
      c.appendChild(acc);
      cont.appendChild(c);
    });
  }
  var contActual = null;
  function cargar(){
    if(!contActual) return;
    return P.api('solicitudes').then(function(r){ pintar(contActual, r); }).catch(E.error);
  }

  E.registrarTab('solicitudes', { render: function(p){
    F.encabezado(p, 'Solicitudes', 'Lo que llega por el formulario «Cuéntanos tu proyecto» del sitio. También llega un aviso al correo de la empresa (Empresa y contacto → Correo).');
    var filtros = el('div', 'ed-solicitudes__filtro');
    [['nueva', 'Nuevas'], ['todas', 'Todas']].forEach(function(f){
      var b = el('button', 'ed-chip', f[1]); b.type = 'button';
      b.setAttribute('aria-pressed', String(filtro === f[0]));
      b.addEventListener('click', function(){
        filtro = f[0];
        filtros.querySelectorAll('button').forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); });
        cargar();
      });
      filtros.appendChild(b);
    });
    p.appendChild(filtros);
    contActual = el('div', 'ed-solicitudes'); contActual.textContent = 'Cargando…';
    p.appendChild(contActual);
    cargar();
  } });
})();
