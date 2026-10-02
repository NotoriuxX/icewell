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
  esquema: 1,
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
    'hero.eyebrow': 'Ingeniería HVAC · Chile desde {desde}',
    'hero.titulo1': 'Ingeniería que',
    'hero.tituloDestacado': 'hace habitable',
    'hero.titulo2': 'lo extraordinario.',
    'hero.lead': 'Diseñamos, instalamos y mantenemos soluciones de climatización para proyectos que exigen desempeño, continuidad y precisión.',
    'hero.boton1': 'Conocer proyectos',
    'hero.boton2': 'Hablar con un ingeniero',
    'hero.casoEtiqueta': 'Proyecto destacado',
    'hero.casoTitulo': 'Cerro Dominador',
    'hero.casoTexto': 'Antofagasta · Climatización industrial',
    'nosotros.eyebrow': 'Quiénes somos',
    'nosotros.titulo': 'El clima también se *diseña.*',
    'nosotros.destacado': 'Más que aire acondicionado: entregamos la confianza de una operación térmicamente estable, eficiente y pensada para durar.',
    'nosotros.texto': 'Fundada por profesionales con más de 25 años de experiencia en climatización y ventilación, Icewell integra conocimiento técnico, planificación y oficio para responder a los desafíos de cada industria.',
    'servicios.eyebrow': 'Qué hacemos',
    'servicios.titulo': 'Del cálculo a la puesta en marcha.',
    'servicios.lead': 'Un equipo involucrado en cada fase, con ingeniería aplicada a resultados reales.',
    'servicios.nota': 'Además desarrollamos soluciones para **piscinas, control de humedad, centros de salud, hoteles, retail y oficinas.** Revisa nuestras obras por sector:',
    'metodo.eyebrow': 'Por qué Icewell',
    'metodo.titulo': 'La respuesta correcta antes del primer plano.',
    'metodo.texto': 'Interpretamos cada necesidad desde la operación. Así construimos soluciones que equilibran eficiencia, calidad y presupuesto sin perder de vista a quienes usarán el espacio.',
    'metodo.resultado': 'Una respuesta superior\npara cada cliente.',
    'trayectoria.eyebrow': 'Trayectoria',
    'trayectoria.titulo': 'Obra, no promesas.',
    'trayectoria.lead': 'Una historia de proyectos que han crecido junto a la confianza de nuestros clientes.',
    'proyectos.eyebrow': 'Portafolio',
    'proyectos.titulo': 'Soluciones que ya están en marcha.',
    'equipo.eyebrow': 'Equipo directivo',
    'equipo.titulo': 'Las personas tras cada proyecto.',
    'socios.eyebrow': 'Red de especialistas',
    'socios.texto': 'Trabajamos con tecnologías y proveedores líderes para diseñar soluciones a la medida de cada desafío.',
    'contacto.eyebrow': 'Contacto',
    'contacto.titulo': '¿Tienes un proyecto que necesita respirar mejor?',
    'contacto.texto': 'Cuéntanos el alcance. Te responderá un ingeniero, no un formulario automático.',
    'footer.lema': 'Asesorías, ingeniería y montajes térmicos',

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
    servicios: [
      { etiqueta: 'Asesorías térmicas', titulo: 'Diagnóstico', texto: 'Informes de proyecto, evaluaciones técnico-económicas, inspecciones de obra, cálculos de carga térmica y consumo de ACS.' },
      { etiqueta: 'Ingeniería', titulo: 'Diseño', texto: 'Proyectos de climatización, ventilación y calefacción para los sectores comercial, residencial e industrial, con foco en eficiencia energética.' },
      { etiqueta: 'Instalaciones', titulo: 'Montaje', texto: 'Implementación HVAC con sistemas de agua, expansión directa, VRV, caudal variable e instalaciones solares, entre otros.' }
    ],
    metodo: [
      { titulo: 'Eficiencia operacional', texto: 'Energía y confort trabajando en el mismo sentido.' },
      { titulo: 'Calidad verificable', texto: 'Método, control y estándares desde el diseño hasta la entrega.' },
      { titulo: 'Innovación aplicada', texto: 'Tecnología útil para retos concretos y operaciones exigentes.' }
    ],
    hitos: [
      { fecha: '{desde}', titulo: 'Nace Icewell', texto: 'Fundación y comienzo de operaciones en Santiago.' },
      { fecha: '2012', titulo: 'Primera gran minería', texto: 'Inicio de proyectos de alto estándar en el norte de Chile.' },
      { fecha: '2023', titulo: 'Nueva escala', texto: 'Hotel Debaines y remodelación ACHS Alameda.' },
      { fecha: 'HOY', titulo: '{anios} años', texto: '{obras} obras registradas en {regiones} regiones, de Tarapacá a Los Lagos.' }
    ],
    equipo: [
      { cargo: 'CEO', nombre: 'Andrés Mora', texto: 'Ingeniero en Climatización (USACH) e Ingeniería Civil Industrial (U. Mayor).', foto: '' },
      { cargo: 'CFO', nombre: 'Flavio Magnasco', texto: 'MBA UC, Magíster en Finanzas UAI e Ingeniero Comercial (U. de Chile).', foto: '' },
      { cargo: 'CCO', nombre: 'Gonzalo Díaz W.', texto: 'Ingeniero Industrial (USM), con formación especializada en climatización.', foto: '' },
      { cargo: 'COO', nombre: 'Cristian Castro', texto: 'Arquitecto (U. Mayor) y diplomado BIM (U. Católica).', foto: '' }
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
    certificaciones: ['Proyectos con certificación LEED', 'Eficiencia energética', 'ERNC y solar térmica', 'Obras sobre 4.800 msnm']
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
