/* ==========================================================================
   ICEWELL — Editor: pestañas Página principal, Currículum, Empresa y
   Sectores/regiones. Siguen el orden en que se ve cada página.
   ========================================================================== */
(function(){
  'use strict';
  var E = window.Editor, F = E.campos, el = F.el;

  // años cumplidos desde la fundación (misma cuenta que assets/aniversario.js)
  function aniosDesde(f){
    var p = String(f || '2009-01-01').split('-').map(Number), h = new Date(), a = h.getFullYear() - p[0];
    if(h.getMonth() + 1 < p[1] || (h.getMonth() + 1 === p[1] && h.getDate() < p[2])) a--;
    return Math.max(a, 0);
  }
  var COLUMNAS = [['auto', 'Automático: todos en una fila'], ['1', '1 por fila'], ['2', '2 por fila'], ['3', '3 por fila'], ['4', '4 por fila'], ['5', '5 por fila'], ['6', '6 por fila']];
  var AYUDA_COLUMNAS = 'En pantallas medianas se muestran como máximo 2 por fila y en celular 1, para que siempre se lean bien.';

  // campo de texto del diccionario "textos" (clave con punto: 'hero.lead')
  function T(cont, etq, clave, op){
    op = Object.assign({ ruta: 't:' + clave }, op || {});
    if(E.draft.textos[clave] == null) E.draft.textos[clave] = '';
    return F.texto(cont, etq, E.draft.textos, clave, op);
  }
  E.T = T;

  // ==================================================================== Página principal
  E.registrarTab('inicio', { render: function(p){
    var d = E.draft, ini = d.inicio;
    F.encabezado(p, 'Página principal', 'Cada bloque sigue el orden de la página. Los cambios se ven al instante en la vista previa; el sitio cambia recién al Publicar.');
    F.formato(p);

    var s = F.seccion(p, 'Portada (primer pantallazo)', { clave: 'ini-hero' });
    T(s, 'Etiqueta superior', 'hero.eyebrow', { max: 80 });
    var g = F.grilla(s);
    T(g, 'Título · parte 1', 'hero.titulo1', { max: 60 });
    T(g, 'Título · parte destacada (celeste)', 'hero.tituloDestacado', { max: 60 });
    T(g, 'Título · parte 3', 'hero.titulo2', { max: 60 });
    T(s, 'Bajada', 'hero.lead', { multi: true, max: 300 });
    g = F.grilla(s);
    T(g, 'Botón 1 (va a Proyectos)', 'hero.boton1', { max: 40 });
    T(g, 'Botón 2 (abre WhatsApp)', 'hero.boton2', { max: 40 });
    F.imagen(s, 'Foto grande', ini, 'heroFoto', { tipo: 'hero', ruta: 'lista:inicio.heroFoto', nombre: function(){ return 'portada'; }, ayuda: 'Horizontal, mínimo 1600 px de ancho.' });
    F.texto(s, 'Descripción de la foto (para lectores de pantalla y Google)', ini, 'heroFotoAlt', { max: 200 });
    g = F.grilla(s);
    T(g, 'Insignia sobre la foto', 'hero.casoBadge', { max: 30 });
    T(g, 'Recuadro · obra', 'hero.casoTitulo', { max: 60 });
    T(g, 'Recuadro · detalle', 'hero.casoTexto', { max: 80 });
    F.nota(s, 'Las cifras de la portada (años, obras, regiones, m²) se editan en «Empresa y contacto → Cifras». Los años se calculan solos desde la fecha de fundación.');

    s = F.seccion(p, 'Quiénes somos', { clave: 'ini-nos', abierta: false });
    T(s, 'Etiqueta', 'nosotros.eyebrow', { max: 60 });
    T(s, 'Título', 'nosotros.titulo', { max: 80 });
    T(s, 'Texto destacado', 'nosotros.destacado', { multi: true, max: 400 });
    T(s, 'Texto', 'nosotros.texto', { multi: true, max: 800 });

    s = F.seccion(p, 'Servicios', { clave: 'ini-serv', abierta: false });
    T(s, 'Etiqueta', 'servicios.eyebrow', { max: 60 });
    T(s, 'Título', 'servicios.titulo', { max: 80 });
    if(!ini.serviciosColumnas) ini.serviciosColumnas = '3';
    F.selector(s, 'Servicios por fila', ini, 'serviciosColumnas', COLUMNAS, { ruta: 'lista:inicio.serviciosColumnas', ayuda: AYUDA_COLUMNAS });
    F.lista(s, { arr: ini.servicios, ruta: 'lista:inicio.servicios', max: 12, min: 1, agregar: 'Agregar servicio',
      titulo: function(x){ return x.titulo; }, nuevo: function(){ return { etiqueta: '', titulo: 'Nuevo servicio', texto: '' }; },
      campos: function(c, x){ var g = F.grilla(c); F.texto(g, 'Etiqueta', x, 'etiqueta', { max: 60 }); F.texto(g, 'Título', x, 'titulo', { max: 80 }); F.texto(c, 'Texto', x, 'texto', { multi: true, max: 500 }); } });
    T(s, 'Nota bajo los servicios', 'servicios.nota', { multi: true, max: 400 });
    F.nota(s, 'Los botones de sectores («Hotelería», «Minería»…) salen solos de «Sectores y regiones».');

    s = F.seccion(p, 'Por qué Icewell', { clave: 'ini-met', abierta: false });
    T(s, 'Etiqueta', 'metodo.eyebrow', { max: 60 });
    T(s, 'Título', 'metodo.titulo', { max: 100 });
    T(s, 'Texto', 'metodo.texto', { multi: true, max: 500 });
    F.lista(s, { arr: ini.metodo, ruta: 'lista:inicio.metodo', max: 8, min: 1, agregar: 'Agregar punto',
      titulo: function(x){ return x.titulo; }, nuevo: function(){ return { titulo: 'Nuevo punto', texto: '' }; },
      campos: function(c, x){ F.texto(c, 'Título', x, 'titulo', { max: 80 }); F.texto(c, 'Texto (opcional)', x, 'texto', { max: 300 }); } });
    T(s, 'Cierre (=)', 'metodo.resultado', { multi: true, max: 120 });

    s = F.seccion(p, 'Trayectoria (línea de tiempo)', { clave: 'ini-hitos', abierta: false });
    T(s, 'Etiqueta', 'trayectoria.eyebrow', { max: 60 });
    T(s, 'Título', 'trayectoria.titulo', { max: 80 });
    F.lista(s, { arr: ini.hitos, ruta: 'lista:inicio.hitos', max: 12, min: 1, agregar: 'Agregar hito',
      titulo: function(x){ return x.fecha + ' · ' + (x.titulo || x.texto); }, nuevo: function(){ return { fecha: String(new Date().getFullYear()), titulo: '', texto: 'Nuevo hito' }; },
      campos: function(c, x){ var g = F.grilla(c); F.texto(g, 'Fecha', x, 'fecha', { max: 20, ayuda: '{desde} = año de fundación' }); F.texto(g, 'Título (opcional)', x, 'titulo', { max: 80 }); F.texto(c, 'Texto', x, 'texto', { multi: true, max: 300 }); } });

    s = F.seccion(p, 'Portafolio', { clave: 'ini-port', abierta: false });
    T(s, 'Etiqueta', 'proyectos.eyebrow', { max: 60 });
    T(s, 'Título', 'proyectos.titulo', { max: 100 });
    var enPortada = d.obras.filter(function(o){ return o.portada && o.visible !== false; }).sort(function(a, b){ return (a.ordenPortada || 0) - (b.ordenPortada || 0); });
    var info = el('p', 'ed-ayuda', enPortada.length + ' obra(s) en la portada: ' + (enPortada.map(function(o){ return o.nombre; }).join(', ') || 'ninguna') + '.');
    s.appendChild(info);
    var ir = el('button', 'btn btn--secundario', 'Elegir y ordenar las obras de la portada'); ir.type = 'button';
    ir.addEventListener('click', function(){ E.tab('obras'); if(E.obras) E.obras.verPortada(); });
    s.appendChild(ir);

    s = F.seccion(p, 'Equipo', { clave: 'ini-eq', abierta: false });
    T(s, 'Etiqueta', 'equipo.eyebrow', { max: 60 });
    T(s, 'Título', 'equipo.titulo', { max: 80 });
    F.lista(s, { arr: ini.equipo, ruta: 'lista:inicio.equipo', max: 24, agregar: 'Agregar persona',
      titulo: function(x){ return x.nombre + (x.cargo ? ' · ' + x.cargo : ''); }, nuevo: function(){ return { cargo: '', nombre: 'Nombre Apellido', texto: '', foto: '' }; },
      campos: function(c, x){
        var g = F.grilla(c); F.texto(g, 'Nombre', x, 'nombre', { max: 80 }); F.texto(g, 'Cargo', x, 'cargo', { max: 40 });
        F.texto(c, 'Formación / descripción', x, 'texto', { multi: true, max: 300 });
        F.imagen(c, 'Foto (opcional: sin foto se muestran las iniciales)', x, 'foto', { tipo: 'equipo', opcional: true, nombre: function(){ return x.nombre; }, ayuda: 'Cuadrada (retrato), mínimo 400 px. Se usa en las 4 vistas: Grid, Organigrama, Fotos y Lista.' });
      } });
    F.nota(s, 'Organigrama: la primera persona de la lista va arriba y el resto debajo. Usa las flechas para cambiar el orden.');
    var areas = F.seccion(s, 'Áreas (bajo el organigrama)', { clave: 'ini-eq-areas', abierta: false });
    [1, 2, 3].forEach(function(n){
      T(areas, 'Área ' + n + ' · título', 'equipo.area' + n + 'Titulo', { max: 80 });
      T(areas, 'Área ' + n + ' · texto', 'equipo.area' + n + 'Texto', { multi: true, max: 500 });
    });

    s = F.seccion(p, 'Socios y proveedores (logos)', { clave: 'ini-soc', abierta: false });
    T(s, 'Etiqueta', 'socios.eyebrow', { max: 60 });
    T(s, 'Título', 'socios.titulo', { max: 80 });
    F.lista(s, { arr: ini.socios, ruta: 'lista:inicio.socios', max: 40, agregar: 'Agregar logo',
      titulo: function(x){ return x.nombre; }, nuevo: function(){ return { nombre: 'Nuevo socio', logo: '', grande: false }; },
      campos: function(c, x){
        F.texto(c, 'Nombre', x, 'nombre', { max: 80 });
        F.imagen(c, 'Logo', x, 'logo', { tipo: 'socio', nombre: function(){ return x.nombre; }, ayuda: 'PNG con fondo transparente (la cinta va sobre fondo blanco).' });
        F.interruptor(c, 'Mostrar más grande (logos con texto chico)', x, 'grande');
      } });
    F.nota(s, 'La cinta de logos se repite sola para que el movimiento no tenga cortes.');

    s = F.seccion(p, 'Contacto y pie de página', { clave: 'ini-cont', abierta: false });
    T(s, 'Etiqueta', 'contacto.eyebrow', { max: 60 });
    T(s, 'Título', 'contacto.titulo', { max: 100 });
    T(s, 'Texto', 'contacto.texto', { multi: true, max: 300 });
    T(s, 'Botón del formulario', 'contacto.formBoton', { max: 40, ayuda: 'Abre el formulario paso a paso. Las solicitudes llegan al correo de la empresa (Empresa y contacto) y quedan en la pestaña Solicitudes.' });
    T(s, 'Lema del pie de página', 'footer.lema', { max: 100 });
    F.nota(s, 'Dirección, teléfono, correo y WhatsApp se editan en «Empresa y contacto» y cambian en todas las páginas y los PDF.');

    s = F.seccion(p, 'Google y redes sociales (SEO)', { clave: 'ini-seo', abierta: false, ayuda: 'Lo que aparece en la pestaña del navegador y en los resultados de Google.' });
    F.texto(s, 'Título de la página', d.seo, 'titulo', { max: 90, ruta: 'seo:titulo', ayuda: 'Ideal: menos de 60 caracteres.' });
    F.texto(s, 'Descripción', d.seo, 'descripcion', { multi: true, max: 300, ruta: 'seo:descripcion', ayuda: 'Ideal: 120 a 160 caracteres.' });
  } });

  // ==================================================================== Currículum
  E.registrarTab('cv', { render: function(p){
    var d = E.draft;
    F.encabezado(p, 'Currículum', 'Textos de la versión web (/curriculum) y de la versión presentación. Las obras se editan en la pestaña Obras.');
    F.formato(p);

    var s = F.seccion(p, 'Datos de la empresa (solo lectura)', { clave: 'cv-emp' });
    var e = d.empresa, dl = el('dl', 'ed-lectura');
    [['Razón social', e.razonSocial], ['RUT', e.rut], ['Dirección', [e.direccion, e.comuna, e.ciudad].filter(Boolean).join(', ')], ['Teléfono', e.telefono], ['Correos', [e.correo, e.correoComercial].filter(Boolean).join(' · ')], ['Sitio web', e.web]]
      .forEach(function(x){ dl.appendChild(el('dt', '', x[0])); dl.appendChild(el('dd', '', x[1] || '—')); });
    s.appendChild(dl);
    var b = el('button', 'btn btn--secundario', 'Editar en «Empresa y contacto»'); b.type = 'button'; b.dataset.tab = 'empresa';
    s.appendChild(b);

    s = F.seccion(p, 'Versión web · portada', { clave: 'cv-port' });
    T(s, 'Etiqueta', 'cv.eyebrow', { max: 80 });
    T(s, 'Título', 'cv.titulo', { max: 100 });
    T(s, 'Bajada', 'cv.lead', { multi: true, max: 500 });

    s = F.seccion(p, 'Versión web · servicios', { clave: 'cv-serv', abierta: false });
    T(s, 'Título', 'cv.serviciosTitulo', { max: 100 });
    T(s, 'Bajada', 'cv.serviciosLead', { multi: true, max: 400 });
    if(!d.cv.serviciosColumnas) d.cv.serviciosColumnas = '3';
    F.selector(s, 'Servicios por fila', d.cv, 'serviciosColumnas', COLUMNAS, { ruta: 'lista:cv.serviciosColumnas', ayuda: AYUDA_COLUMNAS });
    F.lista(s, { arr: d.cv.servicios, ruta: 'lista:cv.servicios', max: 6, min: 1, agregar: 'Agregar servicio',
      titulo: function(x){ return x.titulo; }, nuevo: function(){ return { etiqueta: '', titulo: 'Nuevo servicio', texto: '', resumen: '', items: [] }; },
      campos: function(c, x){
        var g = F.grilla(c); F.texto(g, 'Etiqueta', x, 'etiqueta', { max: 60 }); F.texto(g, 'Título', x, 'titulo', { max: 80 });
        F.texto(c, 'Texto (web)', x, 'texto', { multi: true, max: 500 });
        F.texto(c, 'Texto corto (PDF)', x, 'resumen', { multi: true, max: 160, ayuda: 'En el PDF el espacio es fijo: máximo 160 caracteres.' });
        F.lineas(c, 'Puntos', x, 'items');
      } });

    s = F.seccion(p, 'Versión web · obras, certificaciones y cobertura', { clave: 'cv-obras', abierta: false });
    T(s, 'Título del explorador de obras', 'cv.obrasTitulo', { max: 80 });
    T(s, 'Bajada', 'cv.obrasLead', { multi: true, max: 300 });
    T(s, 'Título de certificaciones', 'cv.certTitulo', { max: 80 });
    F.lineas(s, 'Certificaciones y estándares (también en la presentación)', d.cv, 'certificaciones', { ruta: 'lista:cv.certificaciones' });
    T(s, 'Título de cobertura', 'cv.coberturaTitulo', { max: 80 });
    T(s, 'Nota de cobertura', 'cv.coberturaNota', { multi: true, max: 200 });
    T(s, 'Cierre · título', 'cv.empresaTitulo', { max: 80 });
    T(s, 'Cierre · texto', 'cv.empresaLead', { multi: true, max: 200 });

    s = F.seccion(p, 'Versión presentación', { clave: 'cv-pres', abierta: false, ayuda: 'Hojas A4 idénticas a la presentación corporativa. Ojo con los textos largos: cada hoja tiene un tamaño fijo.' });
    T(s, 'Portada · título', 'pres.portadaTitulo', { multi: true, max: 80 });
    T(s, 'Portada · bajada', 'pres.portadaLead', { multi: true, max: 200 });
    var g = F.grilla(s);
    T(g, 'Portada · cobertura', 'pres.cobertura', { max: 40 });
    T(g, 'Portada · especialidad', 'pres.especialidad', { multi: true, max: 80 });
    T(s, 'Quiénes somos · título', 'pres.quienesTitulo', { multi: true, max: 80 });
    T(s, 'Quiénes somos · párrafo 1', 'pres.quienes1', { multi: true, max: 600 });
    T(s, 'Quiénes somos · párrafo 2', 'pres.quienes2', { multi: true, max: 600 });
    F.lista(s, { arr: d.presentacion.caja, ruta: 'lista:presentacion.caja', max: 3, min: 3, titulo: function(x){ return x.etiqueta; }, nuevo: function(){ return { etiqueta: '', texto: '' }; },
      campos: function(c, x){ var g = F.grilla(c); F.texto(g, 'Etiqueta', x, 'etiqueta', { max: 60 }); F.texto(g, 'Texto', x, 'texto', { max: 160 }); } });
    T(s, 'Servicios · título', 'pres.serviciosTitulo', { multi: true, max: 80 });
    F.lista(s, { arr: d.presentacion.servicios, ruta: 'lista:presentacion.servicios', max: 3, min: 1, titulo: function(x){ return x.titulo; },
      nuevo: function(){ return { icono: 'asesoria', titulo: 'Servicio', texto: '', tags: [] }; },
      campos: function(c, x){
        var g = F.grilla(c);
        F.selector(g, 'Ícono', x, 'icono', [['asesoria', 'Asesoría (portapapeles)'], ['ingenieria', 'Ingeniería (plano)'], ['montaje', 'Montaje (ventilador)']]);
        F.texto(g, 'Título', x, 'titulo', { max: 80 });
        F.texto(c, 'Texto', x, 'texto', { multi: true, max: 400 });
        F.lineas(c, 'Etiquetas', x, 'tags');
      } });
    T(s, 'Propuesta de valor', 'pres.valorTexto', { multi: true, max: 600 });
    F.lineas(s, 'Propuesta de valor · 4 puntos', d.presentacion, 'valorPuntos');
    T(s, 'Portafolio · bajada', 'pres.portafolioLead', { multi: true, max: 200 });
    F.lista(s, { arr: d.presentacion.barraAzul, ruta: 'lista:presentacion.barraAzul', max: 3, min: 3, titulo: function(x){ return x.etiqueta; }, nuevo: function(){ return { etiqueta: '', texto: '' }; },
      campos: function(c, x){ var g = F.grilla(c); F.texto(g, 'Etiqueta', x, 'etiqueta', { max: 40 }); F.texto(g, 'Texto', x, 'texto', { max: 80 }); } });
    T(s, 'Trayectoria · nota', 'pres.trayectoriaNota', { multi: true, max: 200 });
    T(s, 'Última hoja · título', 'pres.datosTitulo', { multi: true, max: 80 });
  } });

  // ==================================================================== Empresa y contacto
  E.registrarTab('empresa', { render: function(p){
    var d = E.draft, e = d.empresa;
    F.encabezado(p, 'Empresa y contacto', 'Se cambia aquí una vez y se actualiza en todas partes: página principal, currículum, presentación, botones de WhatsApp y PDF.');

    var s = F.seccion(p, 'Contacto', { clave: 'emp-cont' });
    var g = F.grilla(s);
    F.texto(g, 'Teléfono', e, 'telefono', { max: 30, ruta: 'empresa:telefono', placeholder: '+56 2 2847 0610', tipoInput: 'tel' });
    F.texto(g, 'WhatsApp', e, 'whatsapp', { max: 30, ruta: 'empresa:whatsapp', placeholder: '+56 9 6407 4519', tipoInput: 'tel', ayuda: 'Con código de país.' });
    g = F.grilla(s);
    F.texto(g, 'Correo de contacto', e, 'correo', { max: 120, ruta: 'empresa:correo', tipoInput: 'email' });
    F.texto(g, 'Correo comercial (opcional)', e, 'correoComercial', { max: 120, ruta: 'empresa:correoComercial', tipoInput: 'email' });
    g = F.grilla(s);
    F.texto(g, 'Dirección', e, 'direccion', { max: 150, ruta: 'empresa:direccion' });
    F.texto(g, 'Comuna', e, 'comuna', { max: 80, ruta: 'empresa:comuna' });
    g = F.grilla(s);
    F.texto(g, 'Ciudad', e, 'ciudad', { max: 80, ruta: 'empresa:ciudad' });
    F.texto(g, 'País', e, 'pais', { max: 60, ruta: 'empresa:pais' });
    F.texto(s, 'Sitio web', e, 'web', { max: 100, ruta: 'empresa:web', placeholder: 'www.icewell.cl' });

    s = F.seccion(p, 'Mensajes de WhatsApp', { clave: 'emp-wa', abierta: false, ayuda: 'El texto que aparece escrito cuando alguien toca un botón de WhatsApp.' });
    F.texto(s, 'Desde la página principal y el botón flotante', e.wa, 'cotizar', { multi: true, max: 300 });
    F.texto(s, 'Desde el currículum', e.wa, 'cv', { multi: true, max: 300 });
    F.texto(s, 'Desde la presentación', e.wa, 'presentacion', { multi: true, max: 300 });

    s = F.seccion(p, 'Datos legales', { clave: 'emp-legal', abierta: false });
    g = F.grilla(s);
    F.texto(g, 'Razón social', e, 'razonSocial', { max: 120, ruta: 'empresa:razonSocial' });
    F.texto(g, 'RUT', e, 'rut', { max: 15, ruta: 'empresa:rut', ayuda: 'Se valida el dígito verificador.' });
    F.texto(s, 'Giro', e, 'giro', { max: 200, ruta: 'empresa:giro' });
    F.texto(s, 'Nombre corto', e, 'nombre', { max: 60 });

    s = F.seccion(p, 'Cifras institucionales', { clave: 'emp-cifras', ayuda: 'Se escriben a mano a propósito (son las del PDF corporativo y deben poder respaldarse). Abajo de cada una ves lo que suman las obras cargadas, como referencia.' });
    var vis = d.obras.filter(function(o){ return o.visible !== false; });
    var m2 = vis.reduce(function(a, o){ return a + (o.m2 || 0); }, 0);
    var regs = {}; vis.forEach(function(o){ o.regiones.forEach(function(r){ regs[r] = 1; }); });
    // cada cifra con sus textos: el número aquí; los años salen solos de la fecha de fundación (más abajo)
    var bloque = function(titulo){ var b = el('div', 'ed-cifra'); b.appendChild(el('p', 'ed-cifra__titulo', titulo)); s.appendChild(b); return b; };
    var c = bloque('Años de experiencia');
    c.appendChild(el('p', 'ed-ayuda', 'El número se calcula solo desde la fecha de fundación (hoy: ' + aniosDesde(d.config.fundacion) + ' años). Aquí solo cambias los textos.'));
    g = F.grilla(c);
    T(g, 'Texto en la portada', 'cifras.aniosHero', { multi: true, max: 60 });
    T(g, 'Texto en la banda de cifras y en el CV', 'cifras.aniosBanda', { max: 80 });
    c = bloque('Obras registradas');
    F.texto(c, 'Número', d.cifras, 'obras', { max: 20, ruta: 'cifras:obras', ayuda: 'Obras cargadas en el panel: ' + vis.length });
    g = F.grilla(c);
    T(g, 'Texto en la portada', 'cifras.obrasHero', { multi: true, max: 60 });
    T(g, 'Texto en la banda de cifras y en el CV', 'cifras.obrasBanda', { max: 80 });
    c = bloque('m² intervenidos');
    F.texto(c, 'Número', d.cifras, 'm2', { max: 20, ruta: 'cifras:m2', ayuda: 'Suma de m² cargados: ' + new Intl.NumberFormat('es-CL').format(m2) });
    g = F.grilla(c);
    T(g, 'Texto en la portada', 'cifras.m2Hero', { multi: true, max: 60 });
    T(g, 'Texto en la banda de cifras y en el CV', 'cifras.m2Banda', { max: 80 });
    c = bloque('Regiones');
    F.texto(c, 'Número', d.cifras, 'regiones', { max: 20, ruta: 'cifras:regiones', ayuda: 'Regiones con obras cargadas: ' + Object.keys(regs).length });
    g = F.grilla(c);
    T(g, 'Texto en la portada', 'cifras.regionesHero', { multi: true, max: 60 });
    T(g, 'Texto en la banda de cifras', 'cifras.regionesBanda', { max: 80 });
    F.texto(g, 'Texto en el CV (después de «Regiones,»)', d.cifras, 'regionesTexto', { max: 80, ruta: 'cifras:regionesTexto' });

    s = F.seccion(p, 'Aniversario', { clave: 'emp-aniv', abierta: false });
    var f = F.texto(s, 'Fecha de fundación', d.config, 'fundacion', { tipoInput: 'date', ruta: 'config:fundacion',
      ayuda: 'Los «años de experiencia» cambian solos ese día, y durante un mes el sitio muestra el tema de aniversario. ⚠ Hoy es un supuesto (1 de enero de 2009): confirmar la fecha real.' });
    f.min = '1950-01-01'; f.max = new Date().toISOString().slice(0, 10);
    F.interruptor(s, 'Mostrar el botón «Vista previa · Aniversario» en el sitio', d.config, 'botonAniversario', { ayuda: 'Útil para mostrarle el tema a la empresa. Desactívalo antes de la publicación definitiva.' });
  } });

  // ==================================================================== Sectores y regiones
  function slug(t){ return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
  function idUnico(base, lista){ var id = base || 'nuevo', k = 2; while(lista.some(function(x){ return x.id === id; })) id = base + '-' + k++; return id; }

  function catalogo(p, titulo, arr, campo, ayuda){
    var s = F.seccion(p, titulo, { clave: 'cat-' + campo, ayuda: ayuda });
    var usados = function(id){ return E.draft.obras.filter(function(o){ return (o[campo] || []).indexOf(id) >= 0; }).length; };
    F.lista(s, { arr: arr, ruta: 'catalogo:' + campo, tipo: 'obras', max: 30, min: 1, agregar: 'Agregar',
      titulo: function(x){ var n = usados(x.id); return x.label + ' · ' + n + (n === 1 ? ' obra' : ' obras'); },
      nuevo: function(){ return { id: idUnico('nuevo', arr), label: '' }; },
      campos: function(c, x){
        F.texto(c, 'Nombre', x, 'label', { max: 40, tipo: 'obras', alCambiar: function(v){
          // el id (va en los enlaces, p.ej. cv.html#sector=mineria) se arma del nombre solo mientras nadie lo use
          if(!usados(x.id) && /^nuevo(-\d+)?$|^$/.test(x.id) || x._nuevo){ x._nuevo = true; x.id = idUnico(slug(v) || 'nuevo', arr.filter(function(y){ return y !== x; })); idInfo.textContent = 'Identificador en enlaces: ' + x.id; }
        } });
        var idInfo = el('small', 'ed-ayuda-campo', 'Identificador en enlaces: ' + x.id + (usados(x.id) ? ' (no se puede cambiar: lo usan obras y enlaces publicados)' : ''));
        c.appendChild(idInfo);
      } });
    // no se puede borrar algo que usan obras: se avisa antes de guardar
    var huerfanos = E.draft.obras.filter(function(o){ return (o[campo] || []).some(function(id){ return !arr.some(function(x){ return x.id === id; }); }); });
    if(huerfanos.length) F.nota(s, 'Hay obras que apuntan a un elemento que quitaste: ' + huerfanos.map(function(o){ return o.nombre; }).join(', ') + '. Vuelve a agregarlo (↶ Deshacer) o cámbiales el ' + (campo === 'sectores' ? 'sector' : 'región') + ' en Obras.', 'error');
  }
  E.registrarTab('catalogos', { render: function(p){
    var c = E.draft.catalogos;
    // _nuevo es solo del editor: no se guarda
    F.encabezado(p, 'Sectores, regiones y períodos', 'Son los filtros del currículum y los botones de sectores de la página principal.');
    catalogo(p, 'Sectores', c.sectores, 'sectores', 'Cada sector nuevo aparece solo como botón en «Servicios» de la página principal y como filtro en el CV.');
    catalogo(p, 'Regiones (de norte a sur)', c.regiones, 'regiones', 'El orden de la lista es el orden en que se muestran.');
    var s = F.seccion(p, 'Períodos (filtro por años)', { clave: 'cat-per', abierta: false });
    F.lista(s, { arr: c.periodos, ruta: 'catalogo:periodos', tipo: 'obras', max: 12, min: 1, agregar: 'Agregar período',
      titulo: function(x){ return x.label; }, nuevo: function(){ var y = new Date().getFullYear(); return { id: String(y), label: y + ' +', desde: y, hasta: 9999 }; },
      campos: function(cc, x){
        var g = F.grilla(cc);
        F.texto(g, 'Nombre', x, 'label', { max: 40, tipo: 'obras' });
        // el id (va en los enlaces: cv.html#periodo=2019-2023) se arma de los años
        var idPer = function(){ x.id = x.desde + (x.hasta >= 9999 ? '' : '-' + x.hasta); };
        F.numero(g, 'Desde (año)', x, 'desde', { tipo: 'obras', min: 1990, maxNum: 2100, alCambiar: idPer });
        F.numero(g, 'Hasta (año, 9999 = sin fin)', x, 'hasta', { tipo: 'obras', min: 1990, maxNum: 9999, alCambiar: idPer });
      } });
  } });
})();
