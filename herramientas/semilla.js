#!/usr/bin/env node
/* ==========================================================================
   ICEWELL — Semilla del contenido (se corre UNA vez, o para reimportar)
   Convierte lo que hoy está escrito a mano (cv-data.js + los textos del index,
   del CV y de la presentación) en servidor/semilla.json, que es el contenido
   inicial del panel. Desde ahí el panel (o `php herramientas/admin-cli.php
   publicar-semilla`) genera web/assets/sitio-data.js y web/assets/cv-data.js.

   Por qué un script y no a mano: los "// revisar" de cv-data.js son
   comentarios y se perderían al regenerar el archivo; acá se convierten en el
   campo `revisar` de cada obra, que el editor muestra como insignia.

   Uso:  node herramientas/semilla.js [ruta/cv-data.js]
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const ORIGEN = process.argv[2] || path.join(RAIZ, 'web/assets/cv-data.js');
const DESTINO = path.join(RAIZ, 'servidor/semilla.json');

const fuente = fs.readFileSync(ORIGEN, 'utf8');
// const → var para que queden en el contexto del vm
const ctx = { window: {} };   // cv-data.js generado mira window.ICEWELL_BORRADOR
vm.createContext(ctx);
vm.runInContext(fuente.replace(/^const /gm, 'var '), ctx);
const { SECTORES, REGIONES, PERIODOS, PROYECTOS } = ctx;

// ---- "// revisar …" por obra: cada obra empieza en una línea "  { nombre:" ----
const bloques = fuente.split(/\n(?=\s*\{ nombre:)/).slice(1);
const notas = bloques.map(b => {
  const m = b.split('\n').slice(0, 3).join('\n').match(/\/\/\s*(revisar[^\n]*)/);
  return m ? m[1].trim() : '';
});

function slug(t){
  return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

// Portafolio del index (hoy 6 tarjetas a mano): orden, tarjeta ancha y texto propio de la tarjeta
const PORTADA = {
  'CEN-FACH':            { orden: 1, texto: 'Santiago · Split, chiller y sistemas de ventilación.' },
  'Línea 7 Metro':       { orden: 2, texto: 'Santiago · Talleres y cocheras con VRV, aire acondicionado y extracción.' },
  'Aduana de Quillagua': { orden: 3, texto: 'Tarapacá · Aire acondicionado, refrigeración, ventilación y bombas de calor.' },
  'Laboratorio Dilaco':  { orden: 4, texto: 'Santiago · VRV, aire acondicionado y refrigeración de precisión.' },
  'Hotel Debaines':      { orden: 5, texto: 'Santiago Centro · Chiller fan-coil, UMAs y ventilación para 10 pisos.', ancha: true },
  'PF Talca planta 6':   { orden: 6, texto: 'Talca, Maule · Aire acondicionado heavy duty.' }
};

const usados = new Set();
const obras = PROYECTOS.map((p, i) => {
  let id = slug(p.nombre) || 'obra-' + (i + 1), k = 2;
  while(usados.has(id)) id = slug(p.nombre) + '-' + k++;
  usados.add(id);
  const o = Object.assign({ id }, p);
  if(notas[i]) o.revisar = notas[i];
  const port = PORTADA[p.nombre];
  if(port){
    o.portada = true; o.ordenPortada = port.orden; o.textoPortada = port.texto;
    if(port.ancha) o.portadaAncha = true;
    // el index mostraba "2024" sin "En ejecución" en Quillagua: se respeta el estado de los datos
  }
  o.visible = true;
  return o;
});

const contenido = {
  esquema: 2,
  empresa: {
    nombre: 'Icewell',
    razonSocial: 'Icewell SpA',
    giro: 'Asesorías, ingeniería y montajes térmicos',
    rut: '76.059.117-3',
    direccion: 'Román Díaz #1363',
    comuna: 'Providencia',
    ciudad: 'Santiago',
    pais: 'Chile',
    telefono: '+56 2 2847 0610',
    whatsapp: '+56 9 6407 4519',
    correo: 'contacto@icewell.cl',
    correoComercial: 'gonzalo.diaz@icewell.cl',
    web: 'www.icewell.cl',
    redes: { linkedin: '', instagram: '', facebook: '', youtube: '' },
    wa: {
      cotizar: 'Hola Icewell, quiero cotizar un proyecto de climatización',
      cv: 'Hola Icewell, vi su currículum y quiero cotizar un proyecto',
      presentacion: 'Hola Icewell, vi su presentación y quiero cotizar un proyecto'
    }
  },
  // Cifras institucionales: escritas, NO calculadas (regla del proyecto: = PDF corporativo)
  cifras: { obras: '51', m2: '+170.000', regiones: '12', regionesTexto: 'de Tarapacá a Los Lagos' },
  config: {
    fundacion: '2009-01-01',          // ⚠ placeholder: el PDF solo dice "principios de 2009"
    botonAniversario: true            // botón "Vista previa · Aniversario" (false al publicar)
  },
  seo: {
    titulo: 'Icewell — Ingeniería en Climatización',
    descripcion: 'Asesorías térmicas, ingeniería y montaje de sistemas HVAC en todo Chile desde {desde}. {obras} obras registradas y más de 170.000 m² intervenidos en obras destacadas.'
  },
  // Textos sueltos. Formato: *énfasis* (em), **negrita**, salto de línea = \n,
  // {anios} {desde} {obras} {m2} {regiones} = valores automáticos.
  textos: {
    // etiquetas de las cifras (los números van en "cifras"; los años se calculan solos)
    'cifras.aniosHero': 'Años de trayectoria',
    'cifras.obrasHero': 'Obras y proyectos registrados',
    'cifras.regionesHero': 'Regiones con proyectos',
    'cifras.m2Hero': 'm² en obras destacadas',
    'cifras.aniosBanda': 'Años de experiencia · desde {desde}',
    'cifras.obrasBanda': 'Obras y proyectos registrados',
    'cifras.regionesBanda': 'Regiones con proyectos y montajes',
    'cifras.m2Banda': 'm² intervenidos en obras destacadas',
    // Diseño 2 (02-oct): textos del diseño elegido por Icewell (los del sitio Wix) y el lema nuevo
    'hero.eyebrow': 'Ingeniería en climatización · Chile, desde {desde}',
    'hero.titulo1': 'Somos',
    'hero.tituloDestacado': 'confianza y profesionalismo',
    'hero.titulo2': 'para tus proyectos de climatización.',
    'hero.lead': 'Damos respuesta ágil y responsable a las crecientes necesidades en el mercado relacionado con aire acondicionado.',
    'hero.boton1': 'Ver proyectos ejecutados',
    'hero.boton2': 'Hablar por WhatsApp',
    'hero.casoBadge': 'Cliente',
    'hero.casoEtiqueta': 'Proyecto destacado',
    'hero.casoTitulo': 'Cerro Dominador',
    'hero.casoTexto': 'Planta termosolar, Antofagasta',
    'nosotros.eyebrow': 'Quiénes somos',
    'nosotros.titulo': 'Redefiniendo la forma de climatizar.',
    'nosotros.destacado': '**El corazón de nuestra empresa, son sus colaboradores.**',
    'nosotros.texto': 'Fundada por José Castillo Cuevas, Ingeniero Mecánico con MBA UC y más de 25 años de experiencia en climatización y ventilación.\n\nCon {anios} años de experiencia en el mercado nacional, hemos entregado soluciones integrales y profesionales a empresas, muchas de ellas líderes en el mercado.',
    'servicios.eyebrow': 'Servicios',
    'servicios.titulo': 'Hacemos realidad grandes ideas.',
    'servicios.nota': 'También: **temperar piscinas**, **control de humedad**, calefacción en oficinas, centros de salud, hoteles y resort, entre otros. Revisa nuestras obras por sector:',
    'metodo.eyebrow': 'Por qué Icewell',
    'metodo.titulo': 'Buscamos soluciones estratégicas.',
    'metodo.texto': 'Para apoyar a nuestros clientes en todas las etapas de ejecución de un proyecto, cumpliendo con los plazos, estándares de calidad y presupuestos.',
    'metodo.resultado': 'Respuesta superior al cliente',
    'trayectoria.eyebrow': 'Trayectoria',
    'trayectoria.titulo': '{anios} años de obra, no de promesas.',
    'proyectos.eyebrow': 'Proyectos',
    'proyectos.titulo': 'Algunos de nuestros proyectos.',
    'equipo.eyebrow': 'Equipo directivo',
    'equipo.titulo': 'Responsables de cada proyecto.',
    'equipo.area1Titulo': 'Área de Operaciones',
    'equipo.area1Texto': 'Todos nuestros supervisores son Ingenieros mecánicos o en climatización. Jefaturas, planificadores y gerentes, son Ingenieros civiles y arquitectos con vasta experiencia en construcción y en el desarrollo de proyectos HVAC.',
    'equipo.area2Titulo': 'Área de Administración y Recursos Humanos',
    'equipo.area2Texto': 'Está liderada por un gerente de profesión, Ingeniero Comercial, con un Magíster en Finanzas y un MBA UC. Esta gerencia la compone: Control de Gestión, Contabilidad, Adquisiciones y Recursos Humanos. Sus integrantes también son profesionales en sus respectivas áreas.',
    'equipo.area3Titulo': 'Área Comercial',
    'equipo.area3Texto': 'Está liderada por un gerente de profesión, Ingeniero Civil Industrial, con un Diplomado en Climatización. Esta gerencia la compone: Jefe de Estudios de propuestas a cargo de analistas de proyectos, cuyas formaciones son de Ingenieros Mecánicos con experiencia en proyectos HVAC.',
    'socios.eyebrow': 'Industria',
    'socios.titulo': 'Nuestros socios',
    'contacto.eyebrow': 'Contacto',
    'contacto.titulo': '¿Tienes un proyecto de climatización?',
    'contacto.texto': 'Cuéntanos el alcance y te responderá un especialista.',
    'footer.lema': 'Ingeniería en climatización',

    'cv.eyebrow': 'Currículum corporativo · Icewell SpA',
    'cv.titulo': 'Ingeniería y montaje de sistemas *HVAC.*',
    'cv.lead': 'Asesorías térmicas, ingeniería e instalaciones de climatización, ventilación y calefacción para proyectos en todo Chile. Un equipo de ingenieros civiles industriales y mecánicos con experiencia en obras de relevancia desde {desde}.',
    'cv.serviciosTitulo': 'Tres líneas de servicio, un solo responsable.',
    'cv.serviciosLead': 'Proyectamos, estudiamos y proponemos soluciones considerando las mejores alternativas de precios y equipos del mercado, cumpliendo plazos, estándares de calidad y presupuestos.',
    'cv.obrasTitulo': 'Obras por sector.',
    'cv.obrasLead': 'Elige uno o más sectores, un período o una región. El PDF se descarga con lo que tengas seleccionado.',
    'cv.certTitulo': 'Obras que exigen más.',
    'cv.coberturaTitulo': 'De Tarapacá a Los Lagos.',
    'cv.coberturaNota': 'Regiones con proyectos y montajes de Icewell. Toca una para ver sus obras.',
    'cv.empresaTitulo': 'Conversemos su próximo proyecto.',
    'cv.empresaLead': 'Cuéntenos el alcance. Le responderá un ingeniero.',

    'pres.portadaTitulo': 'Ingeniería y montaje\nde sistemas HVAC',
    'pres.portadaLead': 'Asesorías térmicas, ingeniería e instalaciones de climatización, ventilación y calefacción para proyectos en todo Chile.',
    'pres.cobertura': 'Todo el país',
    'pres.especialidad': 'Asesorías,\ningeniería y\nmontajes térmicos',
    'pres.quienesTitulo': 'Respuesta ágil y responsable\nen climatización',
    'pres.quienes1': 'Icewell SpA fue creada a principios de 2009 para responder de manera ágil y responsable a las crecientes necesidades del mercado de aire acondicionado, ventilación y calefacción (HVAC), de acuerdo con los nuevos estándares de calidad, tecnología y cumplimiento de objetivos.',
    'pres.quienes2': 'La compañía está conformada por ingenieros civiles industriales e ingenieros mecánicos jóvenes, dinámicos y comprometidos con las necesidades de sus clientes. Cuentan con la experiencia acumulada durante más de 15 años trabajando para las principales empresas de climatización del país, ejecutando obras de relevancia y realizando proyectos de ingeniería e inspecciones técnicas en construcciones de diversos usos a lo largo de todo Chile.',
    'pres.serviciosTitulo': 'Tres líneas de servicio,\nun solo responsable',
    'pres.valorTexto': 'Proyectamos, estudiamos y proponemos soluciones a los requerimientos de nuestros clientes, considerando las mejores alternativas de precios y equipos disponibles en el mercado, para acompañarlos en todas las etapas de ejecución de un proyecto, cumpliendo plazos, estándares de calidad y presupuestos de costos.',
    'pres.portafolioLead': 'Obras de suministro y montaje en ejecución, recientes y destacadas, en usos privados, comerciales y públicos.',
    'pres.trayectoriaNota': 'Proyectos y montajes desarrollados por Icewell SpA a lo largo de Chile.',
    'pres.datosTitulo': 'Conversemos su\npróximo proyecto'
  },
  inicio: {
    heroFoto: 'hero-cerro-dominador.jpg',
    heroFotoAlt: 'Infraestructura industrial de climatización en el norte de Chile',
    serviciosColumnas: '3',     // servicios por fila: 'auto' (todos en una fila) o '1'…'6'
    servicios: [
      { etiqueta: 'Asesorías térmicas', titulo: 'Diagnóstico', texto: 'Realizamos informes a proyectos y evaluaciones técnico - económica, inspecciones técnicas de obra, cálculos de cargas térmicas, consumo de ACS, entre otros.' },
      { etiqueta: 'Ingeniería', titulo: 'Diseño', texto: 'Elaboramos proyectos de climatización, ventilación y calefacción, tanto para el área comercial, residencial e industrial. Tenemos experiencia en eficiencia energética y uso de Energías Renovables no Convencionales (ERNC).' },
      { etiqueta: 'Instalaciones', titulo: 'Montaje', texto: 'Desarrollamos montajes de diversos sistemas Heating Ventilation Air Conditioner (HVAC). Sistemas de agua, sistemas de expansión directa, sistemas de refrigerante variable y sistemas de volumen variable, instalaciones solares, entre otros.' }
    ],
    metodo: [
      { titulo: 'Eficiencia operacional', texto: '' },
      { titulo: 'Máxima calidad', texto: '' },
      { titulo: 'Innovación y desarrollo', texto: '' }
    ],
    hitos: [
      // título opcional: el diseño 2 muestra solo fecha + texto
      { fecha: '{desde}', titulo: '', texto: 'Fundación de Icewell por José Castillo Cuevas.' },
      { fecha: '2012', titulo: '', texto: 'Primer gran proyecto minero: Minera Maricunga.' },
      { fecha: '2023', titulo: '', texto: 'Hotel Debaines (10 pisos) y Remodelación ACHS Alameda.' },
      { fecha: 'Hoy', titulo: '', texto: '{obras} obras registradas en {regiones} regiones y {m2} m² en obras destacadas.' }
    ],
    equipo: [
      // Manuel, 02-oct: sale Cristian Castro, entra José Castillo. Las fotos se suben en el panel.
      { cargo: 'CEO', nombre: 'Andrés Mora', texto: 'Ingeniero en Climatización (USACH), Ingeniería Civil Industrial (U. Mayor).', foto: '' },
      { cargo: 'CFO', nombre: 'Flavio Magnasco', texto: 'MBA UC, Magíster en Finanzas UAI, Ingeniero Comercial (U. de Chile).', foto: '' },
      { cargo: 'CCO', nombre: 'Gonzalo Díaz W.', texto: 'Ingeniero Industrial (USM), Ingeniería Electrónica (U. Mayor), Diplomado en Climatización (U. de Chile).', foto: '' },
      { cargo: 'Gerente de Operaciones', nombre: 'José Castillo', texto: 'Ing. Civil Industrial, Ing. Mecánico, Diplomado en Climatización y Calefacción. Más de 17 años de experiencia en climatización y calefacción.', foto: '' }
    ],
    socios: [
      { nombre: 'Daikin', logo: 'p-daikin-trans.png' },
      { nombre: 'LG', logo: 'p-lg.png' },
      { nombre: 'Aermec', logo: 'p-aermec.png' },
      { nombre: 'Dimaco', logo: 'p-dimaco.png' },
      { nombre: 'Novaclima', logo: 'p-novaclima-trans.png' },
      { nombre: 'Flowtech', logo: 'p-flowtech.png', grande: true },
      { nombre: 'Empresas Mar del Sur', logo: 'p-mardelsur-trans.png' },
      { nombre: 'Amwo', logo: 'p-amwo-trans.png' },
      { nombre: 'NVL Clima & Energía', logo: 'p-nvl-trans.png' }
    ]
  },
  cv: {
    // texto = versión web; resumen = versión corta para los PDF (espacio fijo)
    servicios: [
      { etiqueta: '01 · Asesoría', titulo: 'Asesorías térmicas', texto: 'Informes a proyectos y evaluaciones técnico-económicas, inspecciones técnicas de obra, cálculos de cargas térmicas y consumo de ACS.',
        resumen: 'Informes y evaluaciones técnico-económicas, inspección técnica de obra, cargas térmicas y consumo de ACS.', items: ['Evaluación técnico-económica', 'ITO', 'Cargas térmicas y ACS'] },
      { etiqueta: '02 · Ingeniería', titulo: 'Ingeniería', texto: 'Proyectos de climatización, ventilación y calefacción para el área comercial, residencial e industrial, con experiencia en eficiencia energética y ERNC.',
        resumen: 'Proyectos de climatización, ventilación y calefacción comercial, residencial e industrial, con eficiencia energética y ERNC.', items: ['Ingeniería básica y de detalles', 'Eficiencia energética', 'ERNC'] },
      { etiqueta: '03 · Montaje', titulo: 'Instalaciones', texto: 'Montaje de sistemas HVAC: sistemas de agua, expansión directa, refrigerante variable, volumen variable e instalaciones solares.',
        resumen: 'Sistemas de agua, expansión directa, VRV/VRF, volumen variable e instalaciones solares.', items: ['Suministro y montaje', 'Chiller, fan-coil y UMA', 'VRV / VRF y solar térmica'] }
    ],
    certificaciones: ['Proyectos con certificación LEED', 'Eficiencia energética', 'ERNC y solar térmica', 'Obras sobre 4.800 msnm'],
    serviciosColumnas: '3'
  },
  presentacion: {
    caja: [
      { etiqueta: '01 · Asesoría', texto: 'Informes, evaluación técnico-económica e inspección técnica de obra' },
      { etiqueta: '02 · Ingeniería', texto: 'Proyectos de climatización, ventilación y calefacción' },
      { etiqueta: '03 · Montaje', texto: 'Suministro e instalación de sistemas HVAC' }
    ],
    servicios: [
      { icono: 'asesoria', titulo: 'Asesorías Térmicas', texto: 'Informes a proyectos y evaluaciones técnico-económicas, inspecciones técnicas de obra, cálculos de cargas térmicas y consumo de ACS, entre otros.', tags: ['Evaluación técnico-económica', 'Inspección técnica de obra (ITO)', 'Cargas térmicas y consumo ACS'] },
      { icono: 'ingenieria', titulo: 'Ingeniería', texto: 'Elaboración de proyectos de climatización, ventilación y calefacción para el área comercial, residencial e industrial, con experiencia en eficiencia energética y uso de ERNC.', tags: ['Ingeniería básica y de detalles', 'Eficiencia energética', 'Energías renovables no convencionales'] },
      { icono: 'montaje', titulo: 'Instalaciones', texto: 'Desarrollo de montajes de diversos sistemas HVAC: sistemas de agua, expansión directa, refrigerante variable, volumen variable e instalaciones solares.', tags: ['Suministro y montaje', 'Chiller, fan-coil y UMA', 'VRV / VRF y solar térmica'] }
    ],
    valorPuntos: ['Eficiencia operacional', 'Máxima calidad', 'Innovación y desarrollo', 'Respuesta superior al cliente'],
    barraAzul: [
      { etiqueta: 'Modalidad', texto: 'Suministro y montaje' },
      { etiqueta: 'Usos', texto: 'Privado, comercial y público' },
      { etiqueta: 'Ubicación', texto: 'Región Metropolitana y regiones' }
    ]
  },
  catalogos: { sectores: SECTORES, regiones: REGIONES, periodos: PERIODOS },
  obras
};

fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
fs.writeFileSync(DESTINO, JSON.stringify(contenido, null, 2) + '\n');
console.log('Semilla escrita en ' + path.relative(RAIZ, DESTINO) + ': ' + obras.length + ' obras, ' +
  obras.filter(o => o.revisar).length + ' con nota "revisar", ' + obras.filter(o => o.portada).length + ' en portada.');
