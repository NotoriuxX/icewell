/* ==========================================================================
   ICEWELL — Datos del currículum interactivo (cv.html)
   ÚNICA fuente de verdad del CV. Para corregir un dato: editar acá y recargar.

   Fuente: Icewell-Presentacion-Corporativa.pdf (págs. 4–8) + los 5 proyectos
   2024 del sitio (CEN-FACH, Línea 7, Quillagua, Dilaco, PF Talca).
   Deduplicado: los que el PDF repite entre "Proyectos destacados" y
   "Trayectoria" quedan en UN solo registro (el de más detalle, con m²).

   Campos:
     nombre, anio, lugar (comuna/ciudad), regiones[] (ids de REGIONES),
     sectores[] (ids de SECTORES), uso, sistemas, m2 (número o null),
     foto (archivo en assets/ o null), estado ('ejecucion' | 'ejecutado'),
     tags[] (LEED, Gran altura, Solar/ERNC, Ingeniería…),
     trabajo ('Suministro y montaje' | 'Proyecto y montaje' | 'Proyecto' | 'Montaje'),
     cliente ('Público' | 'Privado': explícito en las 6 obras 2023 del PDF; el resto deducido por el mandante —
              Estado, municipios, empresas públicas = Público — revisar con Icewell),
     detalle (texto largo del CV original), destacado (true = una de las 9 "Proyectos destacados" del PDF corporativo)
   Fuente adicional: CV original de Icewell (PowerPoint en Wix, 20 págs,
   Downloads/2afe9a_76c6036a839247e7bc40b906e9405d19.pdf): m², uso, tipo de trabajo y detalle
   de ~35 obras; separa Park Plaza/Park Calama, Carozzi ×2 y Metro ×3; PDI Linares = 2017.
   Los casos marcados "// revisar" son supuestos a confirmar con Icewell.
   ========================================================================== */

const SECTORES = [
  { id: 'oficinas',    label: 'Oficinas' },
  { id: 'residencial', label: 'Residencial' },
  { id: 'retail',      label: 'Retail' },
  { id: 'hoteleria',   label: 'Hotelería' },
  { id: 'mineria',     label: 'Minería' },
  { id: 'salud',       label: 'Salud' },
  { id: 'gobierno',    label: 'Gobierno' },
  { id: 'educacion',   label: 'Educación' },
  { id: 'industrial',  label: 'Industrial' },
  { id: 'logistica',   label: 'Logística' }
];

// Norte → sur (las 12 regiones de "Cobertura territorial" del PDF)
const REGIONES = [
  { id: 'tarapaca',      label: 'Tarapacá' },
  { id: 'antofagasta',   label: 'Antofagasta' },
  { id: 'atacama',       label: 'Atacama' },
  { id: 'coquimbo',      label: 'Coquimbo' },
  { id: 'valparaiso',    label: 'Valparaíso' },
  { id: 'metropolitana', label: 'Metropolitana' },
  { id: 'ohiggins',      label: "O'Higgins" },
  { id: 'maule',         label: 'Maule' },
  { id: 'nuble',         label: 'Ñuble' },
  { id: 'biobio',        label: 'Biobío' },
  { id: 'araucania',     label: 'La Araucanía' },
  { id: 'loslagos',      label: 'Los Lagos' }
];

const PERIODOS = [
  { id: '2024',      label: '2024 +',      desde: 2024, hasta: 9999 },
  { id: '2019-2023', label: '2019 – 2023', desde: 2019, hasta: 2023 },
  { id: '2014-2018', label: '2014 – 2018', desde: 2014, hasta: 2018 },
  { id: '2010-2013', label: '2010 – 2013', desde: 2010, hasta: 2013 }
];

const PROYECTOS = [
  // ---------- 2024 · en ejecución (sitio web) ----------
  { nombre: 'CEN-FACH', anio: 2024, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['gobierno'], uso: 'Instalaciones FACH',
    sistemas: 'Split, chiller y sistemas de ventilación.', m2: null, foto: 'p-cenfach.jpg', estado: 'ejecucion', tags: [], cliente: 'Público' },
  { nombre: 'Línea 7 Metro', anio: 2024, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['gobierno', 'industrial'], uso: 'Talleres y cocheras', // revisar sector
    sistemas: 'VRV, aire acondicionado y extracción en talleres y cocheras.', m2: null, foto: 'p-linea7.jpg', estado: 'ejecucion', tags: [], cliente: 'Público' },
  { nombre: 'Aduana de Quillagua', anio: 2024, lugar: 'Quillagua', regiones: ['tarapaca'], sectores: ['gobierno'], uso: 'Complejo aduanero', // revisar región (Quillagua está en el límite Tarapacá/Antofagasta; el sitio dice Tarapacá)
    sistemas: 'Aire acondicionado, refrigeración, ventilación y bombas de calor.', m2: null, foto: 'p-quillagua.jpg', estado: 'ejecucion', tags: [], cliente: 'Público' },
  { nombre: 'Laboratorio Dilaco', anio: 2024, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['salud', 'industrial'], uso: 'Laboratorio',
    sistemas: 'VRV, aire acondicionado y refrigeración de precisión.', m2: null, foto: 'p-dilaco-ig.jpg', estado: 'ejecucion', tags: [], cliente: 'Privado' },
  { nombre: 'PF Talca planta 6', anio: 2024, lugar: 'Talca', regiones: ['maule'], sectores: ['industrial'], uso: 'Planta de alimentos',
    sistemas: 'Aire acondicionado heavy duty.', m2: null, foto: 'p-pftalca.jpg', estado: 'ejecucion', tags: [], cliente: 'Privado' },

  // ---------- 2023 (PDF pág. 4 "Obras en ejecución" + pág. 7) ----------
  { nombre: 'Remodelación ACHS', anio: 2023, lugar: 'Alameda, Santiago', regiones: ['metropolitana'], sectores: ['salud', 'oficinas'], uso: 'Privado',
    sistemas: 'Climatización mediante chiller, unidades manejadoras de aire y fan-coil.', m2: null, foto: 'p-achs.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Hotel Debaines', anio: 2023, lugar: 'Santiago Centro', regiones: ['metropolitana'], sectores: ['hoteleria'], uso: 'Comercial · 10 pisos y 2 subterráneos',
    sistemas: 'Chiller fan-coil, UMAs y ventilación en un edificio de 10 pisos y 2 subterráneos.', m2: null, foto: 'p-debaines.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Centro de distribución Komatsu', anio: 2023, lugar: 'Lampa', regiones: ['metropolitana'], sectores: ['logistica', 'industrial'], uso: 'Privado',
    sistemas: 'Equipos split para oficinas y sala de baterías con control de concentración de hidrógeno.', m2: null, foto: 'p-komatsu.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'DK Home El Cortijo', anio: 2023, lugar: 'Conchalí', regiones: ['metropolitana'], sectores: ['retail'], uso: 'Privado', // revisar sector
    sistemas: 'Equipos compactos y split; ventilación de inyección y extracción.', m2: null, foto: 'p-dkhome.jpeg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Ampliación planta Agrichile', anio: 2023, lugar: 'Río Claro', regiones: ['maule'], sectores: ['industrial'], uso: 'Privado',
    sistemas: 'Equipos VRF, refrigeración para nave de almacenamiento y ventilación de extracción.', m2: null, foto: 'p-agrichile.jpeg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Parque de negocios Los Libertadores', anio: 2023, lugar: 'Quilicura', regiones: ['metropolitana'], sectores: ['oficinas', 'logistica'], uso: 'Público · oficinas y naves',
    sistemas: 'Equipos split y ventilación para oficinas y naves.', m2: null, foto: 'p-loslibertadores.webp', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Público' },
  { nombre: 'Centro de distribución Kersting', anio: 2023, lugar: 'Pudahuel', regiones: ['metropolitana'], sectores: ['logistica'], uso: 'Centro de distribución',
    sistemas: 'Climatización con equipos split y ventilación.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },

  // ---------- Destacados 2018–2022 (PDF págs. 5–6, con superficie) ----------
  { nombre: 'Centro de distribución Mercado Libre', anio: 2022, lugar: 'Quilicura', regiones: ['metropolitana'], sectores: ['logistica'], uso: 'Bodegas y oficinas',
    sistemas: 'Rooftop, equipos compactos y split de distintas capacidades, con extracción e inyección de aire fresco.', m2: 105200, foto: 'p-mercadolibre.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Sistema de climatización con equipos compactos y splits de diferentes capacidades. Integra un sistema de extracción e inyección de aire fresco para los recintos habitables.', destacado: true, cliente: 'Privado' },
  { nombre: 'Centro de distribución ROSEN', anio: 2022, lugar: 'Quilicura', regiones: ['metropolitana'], sectores: ['logistica'], uso: 'Bodegas y oficinas',
    sistemas: 'Rooftop, equipos compactos y split de distintas capacidades, con extracción e inyección de aire fresco.', m2: 27600, foto: 'p-rosen.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Sistema de climatización con equipos compactos y splits de diferentes capacidades. Integra un sistema de extracción e inyección de aire fresco para los recintos habitables.', destacado: true, cliente: 'Privado' },
  { nombre: 'Planta CCU series 100-300-400', anio: 2022, lugar: 'Quilicura', regiones: ['metropolitana'], sectores: ['industrial'], uso: 'Camarines y baños',
    sistemas: 'Calderas eléctricas, chillers, manejadoras de aire, sistema VRV y paneles solares para ACS.', m2: 7912, foto: 'p-ccu.jpg', estado: 'ejecutado', tags: ['Solar / ERNC'], trabajo: 'Suministro y montaje', detalle: 'Climatización y ventilación de los edificios de servicios: calderas eléctricas, manejadoras de aire, sistema VRV y paneles solares para ACS.', destacado: true, cliente: 'Privado' },
  { nombre: 'Cuartel policial PDI Osorno', anio: 2021, lugar: 'Osorno', regiones: ['loslagos'], sectores: ['gobierno'], uso: 'Oficinas y bodega',
    sistemas: 'Chiller fan-coil, equipos compactos, UMAs y ventilación de inyección y extracción.', m2: 10380, foto: 'p-pdiosorno.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Climatización con chiller fan-coil, equipos compactos, unidades manejadoras de aire y ventilación de inyección y extracción de aire.', destacado: true, cliente: 'Público' },
  { nombre: '2ª Etapa Facultad de Economía y Administración UC', anio: 2021, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['educacion'], uso: 'Salas de clase y oficinas',
    sistemas: 'Chiller fan-coil y manejadoras de aire, más extracción e inyección de aire fresco.', m2: 3500, foto: 'n-uc.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Climatización con chiller fan-coil y manejadoras de aire, más extracción e inyección de aire fresco.', destacado: true, cliente: 'Privado' }, // revisar foto (viene de Noticias del sitio)
  { nombre: 'Centro de Importaciones Fast Air', anio: 2021, lugar: 'Santiago (Aeropuerto)', regiones: ['metropolitana'], sectores: ['oficinas', 'logistica'], uso: 'Oficinas',
    sistemas: 'Sistema VRV/VRF con recuperación de calor y ventilación de aire fresco.', m2: 3276, foto: 'p-fastair.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Climatización con sistema VRV con recuperación de calor, más extracción e inyección de aire fresco.', destacado: true, cliente: 'Privado' }, // revisar: el PDF también lista "Oficinas Fast Air Aeropuerto" (2021) — se fusionó, confirmar si es la misma obra
  { nombre: 'Edificio corporativo Empresa Portuaria de San Antonio', anio: 2020, lugar: 'San Antonio', regiones: ['valparaiso'], sectores: ['oficinas', 'gobierno'], uso: 'Oficinas',
    sistemas: 'Chiller fan-coil y manejadoras de aire con extracción e inyección de aire fresco.', m2: 4340, foto: 'n-sanantonio.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Climatización con chiller fan-coil y manejadoras de aire, más extracción e inyección de aire fresco.', destacado: true, cliente: 'Público' }, // revisar foto
  { nombre: 'Centro de Estimulación Integral', anio: 2019, lugar: 'Talagante', regiones: ['metropolitana'], sectores: ['salud'], uso: 'Boxes y piscina temperada',
    sistemas: 'Split y ventilación de extracción; bomba de calor y deshumidificador para piscina.', m2: 7288, foto: 'p-estimulacion.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Climatización de boxes de atención con splits y ventilación de extracción. Para la piscina temperada: bomba de calor y deshumidificador.', destacado: true, cliente: 'Privado' },
  { nombre: 'Colegio Darío Salas', anio: 2018, lugar: 'Carahue', regiones: ['araucania'], sectores: ['educacion'], uso: 'Educación · 3 pisos',
    sistemas: 'Calderas a pellets, radiadores y piso radiante en 3 pisos, más ventilación.', m2: 6708, foto: 'p-dariosalas.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Calefacción de un edificio de 3 pisos (salas y recintos comunes) con calderas a pellets, radiadores y piso radiante, más ventilación de extracción e inyección.', destacado: true, cliente: 'Público' },

  // ---------- Trayectoria 2014–2022 (PDF pág. 7) ----------
  { nombre: 'Casino Enjoy Pucón', anio: 2022, lugar: 'Pucón', regiones: ['araucania'], sectores: ['hoteleria'], uso: 'Hotel y casino', // revisar sector
    sistemas: 'Aire acondicionado rooftop y ventilación.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Juzgado de Osorno', anio: 2022, lugar: 'Osorno', regiones: ['loslagos'], sectores: ['gobierno'], uso: 'Tribunales',
    sistemas: 'VRV, equipos split y ventilación.', m2: null, foto: 'p-juzgadoosorno.jpeg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Público' },
  { nombre: 'Edificio habitacional Karun', anio: 2022, lugar: 'Las Condes', regiones: ['metropolitana'], sectores: ['residencial'], uso: 'Vivienda',
    sistemas: 'Generación de ACS y calefacción con calderas.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Ampliación Cervecería Kross', anio: 2020, lugar: 'Curacaví', regiones: ['metropolitana'], sectores: ['industrial'], uso: 'Oficinas y bodega',
    sistemas: 'Climatización con equipos split y ventilación.', m2: 2800, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Climatización de oficina y bodega con equipos splits de diferentes capacidades, más ventilación de inyección y extracción de aire.', cliente: 'Privado' },
  { nombre: 'Fedex Placilla', anio: 2020, lugar: 'Placilla, Valparaíso', regiones: ['valparaiso'], sectores: ['logistica'], uso: 'Oficinas',
    sistemas: 'VRF, ventilación y equipos de precisión.', m2: 805, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Climatización con sistemas VRV de diferentes capacidades, más extracción e inyección de aire fresco.', cliente: 'Privado' },
  { nombre: "McDonald's Vicente Valdés", anio: 2020, lugar: 'La Florida', regiones: ['metropolitana'], sectores: ['retail'], uso: 'Restaurante',
    sistemas: 'Ventilación y equipos rooftop.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Edificio Block La Dehesa', anio: 2020, lugar: 'Lo Barnechea', regiones: ['metropolitana'], sectores: ['oficinas'], uso: 'Edificio', // revisar sector
    sistemas: 'Sistema chiller.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Laboratorio Braun', anio: 2019, lugar: 'San Bernardo', regiones: ['metropolitana'], sectores: ['salud', 'industrial'], uso: 'Bodega',
    sistemas: 'Climatización y ventilación con equipos compactos.', m2: 1200, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Climatización y ventilación de la bodega con equipos compactos.', cliente: 'Privado' },
  { nombre: 'Cerro Dominador', anio: 2018, lugar: 'Sierra Gorda', regiones: ['antofagasta'], sectores: ['industrial'], uso: 'Planta solar', // revisar sector (energía)
    sistemas: 'Climatización con equipos split y ventilación.', m2: null, foto: 'hero-cerro-dominador.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Climatización con equipos split y ventilación.', cliente: 'Privado' },
  { nombre: 'Planta Solar CPS Cerro Dominador', anio: 2018, lugar: 'Sierra Gorda', regiones: ['antofagasta'], sectores: ['industrial'], uso: 'Oficinas', // revisar sector (energía)
    sistemas: 'Climatización con sistemas VRV y extracción e inyección de aire fresco.', m2: 3436, foto: 'n-calama.jpg', estado: 'ejecutado', tags: ['Solar / ERNC'], trabajo: 'Suministro y montaje', detalle: 'Climatización de los edificios de la planta concentradora solar con sistemas VRV de diferentes capacidades, más extracción e inyección de aire fresco.', cliente: 'Privado' },
  { nombre: 'Estaciones Metro Inés de Suárez y Estadio Nacional', anio: 2018, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['gobierno'], uso: 'Andenes y oficinas', // revisar sector (transporte)
    sistemas: 'Ventilación de andenes y oficinas.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Público' },
  { nombre: 'Escuela básica Manuel Orella', anio: 2018, lugar: 'Caldera', regiones: ['atacama'], sectores: ['educacion'], uso: 'Educación',
    sistemas: 'Calefacción, ACS y ventilación.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Público' },
  { nombre: 'Fiscalía de Viña del Mar', anio: 2017, lugar: 'Viña del Mar', regiones: ['valparaiso'], sectores: ['gobierno'], uso: 'Oficinas públicas',
    sistemas: 'Chiller / fan-coils y ventilación.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Público' },
  { nombre: 'Edificio Universidad Mayor – Odontología', anio: 2017, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['educacion', 'salud'], uso: 'Educación',
    sistemas: 'VRV y ventilación.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Liga Chilena contra la Epilepsia', anio: 2016, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['salud'], uso: 'Salud',
    sistemas: 'VRV y ventilación.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Fruta Fresca de Cabrero', anio: 2016, lugar: 'Cabrero', regiones: ['biobio'], sectores: ['industrial'], uso: 'Planta frutícola',
    sistemas: 'Chillers, enfriadores y ventilación.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Cuartel PDI Linares', anio: 2017, lugar: 'Linares', regiones: ['maule'], sectores: ['gobierno'], uso: 'Oficinas',
    sistemas: 'Chillers fan-coil y ventilación.', m2: 6430, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Climatización con chiller fan-coil y equipos splits, más extracción e inyección de aire fresco.', cliente: 'Público' },
  { nombre: 'Remodelación Hospital del Tórax', anio: 2015, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['salud'], uso: 'Boxes de atención',
    sistemas: 'Chillers, fan-coil y UMAs.', m2: 2513, foto: 'n-torax.jpg', estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Climatización con chiller fan-coil y unidades manejadoras de aire, más extracción e inyección de aire fresco.', cliente: 'Público' }, // revisar foto
  { nombre: 'Comisaría de Chillán', anio: 2014, lugar: 'Chillán', regiones: ['nuble'], sectores: ['gobierno'], uso: 'Comisaría',
    sistemas: 'Chillers, fan-coil y UMAs.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Público' },
  { nombre: 'Bodega Soprole Rukan', anio: 2014, lugar: 'Rukan', regiones: [], sectores: ['logistica', 'industrial'], uso: 'Bodega', // revisar región (el PDF no la indica)
    sistemas: 'Equipos split y refrigeración.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },

  // ---------- Trayectoria 2010–2013 (PDF pág. 8) ----------
  { nombre: 'Proyecto OGP1, Minera Escondida', anio: 2013, lugar: 'Antofagasta', regiones: ['antofagasta'], sectores: ['mineria'], uso: 'Minería',
    sistemas: 'Ventilación y calefacción.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Casino y comedor, Minera Teck Quebrada Blanca', anio: 2013, lugar: 'Tarapacá', regiones: ['tarapaca'], sectores: ['mineria'], uso: 'Casino y comedor',
    sistemas: 'Ventilación y calefacción.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Campamento MEL 5400, Minera Escondida', anio: 2013, lugar: 'Antofagasta', regiones: ['antofagasta'], sectores: ['mineria'], uso: 'Habitacional',
    sistemas: 'Ventilación y climatización a 3.200 msnm.', m2: 3914, foto: null, estado: 'ejecutado', tags: ['Gran altura'], trabajo: 'Proyecto y montaje', detalle: 'Ventilación y climatización de los edificios misceláneos del Campamento 5400, a 170 km al sureste de Antofagasta y 3.200 msnm.', cliente: 'Privado' },
  { nombre: 'Planta Galletas, Carozzi', anio: 2013, lugar: 'Nos, San Bernardo', regiones: ['metropolitana'], sectores: ['industrial'], uso: 'Industrial',
    sistemas: 'Ventilación forzada con extractores axiales para la ampliación de la planta.', m2: 4500, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Montaje', detalle: 'Sistema de ventilación para la ampliación de la Planta Galletas: los sectores que requieren ventilación forzada cuentan con extractores de aire axiales.', cliente: 'Privado' },
  { nombre: 'Planta de Pastas, Carozzi', anio: 2013, lugar: 'Nos, San Bernardo', regiones: ['metropolitana'], sectores: ['industrial'], uso: 'Industrial',
    sistemas: 'Ventilación forzada con extractores axiales.', m2: null, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Montaje', detalle: 'Sistema de ventilación forzada con extractores de aire axiales.', cliente: 'Privado' },
  { nombre: 'Edificio Torre del Sol', anio: 2013, lugar: 'Copiapó', regiones: ['atacama'], sectores: ['residencial'], uso: 'Habitacional', // revisar sector
    sistemas: 'Climatización, ventilación, piscinas y ACS.', m2: 7400, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Ventilación de subterráneos, presurización de caja escala, ventilación de baños, cocina y lavanderías; climatización de dormitorios, gimnasio y piscinas; generación de agua caliente sanitaria.', cliente: 'Privado' },
  { nombre: 'Municipalidad de Contulmo', anio: 2013, lugar: 'Contulmo', regiones: ['biobio'], sectores: ['gobierno'], uso: 'Oficinas',
    sistemas: 'Calefacción con calderas a leña y equipos split.', m2: 1600, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Calefacción con 2 calderas a leña que entregan 180.000 kcal/h; aire acondicionado con equipos split.', cliente: 'Público' },
  { nombre: 'Casino PUCV Campus Curauma', anio: 2013, lugar: 'Valparaíso', regiones: ['valparaiso'], sectores: ['educacion'], uso: 'Casino · 2 niveles',
    sistemas: 'Calefacción con calderas, radiadores y extracción.', m2: 2432, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Calefacción con cuatro calderas individuales y radiadores; extracción de baños y cocina e inyección de aire fresco; refrigeración de sala de basura y climatización de oficinas.', cliente: 'Privado' },
  { nombre: 'Hotel Park Plaza Lyon', anio: 2013, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['hoteleria'], uso: 'Salones del hotel',
    sistemas: 'Climatización de salones con equipos VRV.', m2: 1810, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Sistema de climatización para los salones del hotel con equipos VRV.', cliente: 'Privado' },
  { nombre: 'Hotel Park Calama', anio: 2013, lugar: 'Calama', regiones: ['antofagasta'], sectores: ['hoteleria'], uso: 'Sala de calderas',
    sistemas: 'Modificación de la sala de calderas: 4 calderas nuevas.', m2: 700, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Montaje', detalle: 'Modificación de la sala de calderas del primer piso y cubierta: se reemplazaron 4 calderas y se modificó la estructura de la sala.', cliente: 'Privado' },
  { nombre: 'Bodega concentrado de cobre, Caserones', anio: 2013, lugar: 'Caserones', regiones: ['coquimbo'], sectores: ['mineria'], uso: 'Bodegas', // revisar región (el PDF dice Coquimbo)
    sistemas: 'Sistema de extracción industrial.', m2: 3400, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Suministro y montaje', detalle: 'Sistema de extracción en las bodegas de concentrado con ventiladores NOVOVENT, SODECA, S&P o similar.', cliente: 'Privado' },
  { nombre: 'Planta ADR – Kinross, Minera Maricunga', anio: 2012, lugar: 'Atacama, 4.800 msnm', regiones: ['atacama'], sectores: ['mineria'], uso: 'Planta procesadora de oro · 3 niveles',
    sistemas: 'Extracción localizada, calefacción y tableros eléctricos.', m2: 3000, foto: null, estado: 'ejecutado', tags: ['Gran altura'], trabajo: 'Proyecto y montaje', detalle: 'Extracción localizada y calefacción con ventiladores de inyección de gran caudal y resistencias eléctricas; proyectos eléctricos de fuerza y control centralizado. 60 equipos de ventilación y 10 tableros eléctricos, a 4.800 msnm.', cliente: 'Privado' },
  { nombre: 'Ampliación campamento – Kinross, Minera Maricunga', anio: 2012, lugar: 'Atacama, 4.800 msnm', regiones: ['atacama'], sectores: ['mineria'], uso: 'Campamento, administración, ADR y chancado fino',
    sistemas: 'Extracción localizada, calefacción y control centralizado.', m2: 5000, foto: null, estado: 'ejecutado', tags: ['Gran altura'], trabajo: 'Proyecto y montaje', detalle: 'Extracción localizada y calefacción con ventiladores de mediano caudal y resistencias eléctricas; proyectos eléctricos de fuerza y control centralizado. 15 equipos de ventilación y 12 tableros eléctricos, a 4.800 msnm.', cliente: 'Privado' },
  { nombre: 'Pabellón del Inca, Collahuasi', anio: 2012, lugar: 'Tarapacá', regiones: ['tarapaca'], sectores: ['mineria'], uso: 'Campamento',
    sistemas: 'Sistema de ACS con aporte solar.', m2: null, foto: null, estado: 'ejecutado', tags: ['Solar / ERNC'], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Edificio Moneda Bicentenario', anio: 2012, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['oficinas', 'gobierno'], uso: 'Oficinas',
    sistemas: 'Proyecto con certificación LEED.', m2: null, foto: null, estado: 'ejecutado', tags: ['LEED'], trabajo: 'Suministro y montaje', cliente: 'Público' },
  { nombre: 'Campamento 3.400 Casale', anio: 2012, lugar: 'Atacama', regiones: ['atacama'], sectores: ['mineria'], uso: 'Campamento',
    sistemas: 'Proyecto con certificación LEED.', m2: null, foto: null, estado: 'ejecutado', tags: ['LEED'], trabajo: 'Suministro y montaje', cliente: 'Privado' },
  { nombre: 'Comisaría de Carabineros Pedro Aguirre Cerda', anio: 2012, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['gobierno'], uso: 'Comisaría',
    sistemas: 'Enfriadores de agua, fan-coils y extracción.', m2: 2500, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Proyecto y montaje', detalle: 'Enfriadores de agua y fan-coils con resistencia eléctrica de apoyo para oficinas y comedores; extracción de dormitorios, baños, lockers y cocina.', cliente: 'Público' },
  { nombre: 'Campamento Barriales, Minera Pascua Lama', anio: 2012, lugar: 'Atacama', regiones: ['atacama'], sectores: ['mineria'], uso: 'Módulos de dormitorio y oficinas',
    sistemas: 'Calefacción por aire caliente en módulos.', m2: 2987, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Proyecto y montaje', detalle: 'Tres pabellones de dormitorios y uno de oficinas, en módulos, calefaccionados con aire caliente mediante equipos de ventilación y resistencias eléctricas.', cliente: 'Privado' },
  { nombre: 'Edificio Essbio Rancagua', anio: 2011, lugar: 'Rancagua', regiones: ['ohiggins'], sectores: ['oficinas'], uso: 'Oficinas administrativas · 3 niveles',
    sistemas: 'VRF a gas licuado y recuperación de calor (LEED).', m2: 3450, foto: null, estado: 'ejecutado', tags: ['LEED'], trabajo: 'Proyecto', detalle: 'Proyecto de climatización con volumen de refrigerante variable a gas licuado y ventilación de aire fresco con recuperación de calor termodinámica activa, según parámetros de certificación LEED.', cliente: 'Privado' },
  { nombre: 'Centro de Distribución GLI', anio: 2011, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['logistica'], uso: 'Oficinas centrales · 2 niveles',
    sistemas: '25 equipos split y ventilación de aire fresco.', m2: 1700, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Proyecto y montaje', detalle: 'Climatización con 25 equipos split Carrier de diferentes capacidades, más extracción e inyección de aire fresco.', cliente: 'Privado' },
  { nombre: 'Restaurante Aquí Está Coco', anio: 2011, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['retail'], uso: 'Restaurante',
    sistemas: 'VRF 245.000 Btu/hr y extracción de cocina.', m2: 800, foto: null, estado: 'ejecutado', tags: [], trabajo: 'Proyecto y montaje', detalle: 'Climatización con equipos de volumen de refrigerante variable LG de 245.000 Btu/h, más extracción de campanas de cocina, baños y sector fumadores.', cliente: 'Privado' },
  { nombre: 'Condominio Parque Los Encinos', anio: 2011, lugar: 'Chillán', regiones: ['nuble'], sectores: ['residencial'], uso: 'Habitacional · 5 torres',
    sistemas: 'Paneles solares termosifón y ventilación.', m2: null, foto: null, estado: 'ejecutado', tags: ['Solar / ERNC'], trabajo: 'Proyecto y montaje', detalle: 'Condominio de 5 torres con calentamiento de agua sanitaria por paneles solares termosifón y ventilación de baños y cocinas.', cliente: 'Privado' },
  { nombre: 'Metro S.A., Estación Tobalaba', anio: 2010, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['gobierno'], uso: 'Estación de metro', // revisar sector (transporte)
    sistemas: 'Proyecto de climatización con chiller y fan-coil (solo frío) y calefacción por resistencia eléctrica.', m2: null, foto: null, estado: 'ejecutado', tags: ['Ingeniería'], trabajo: 'Proyecto', detalle: 'Elaboración y desarrollo del proyecto de climatización: enfriadores de agua (chiller) con fan-coil solo frío y calefacción por resistencia eléctrica.', cliente: 'Público' },
  { nombre: 'Metro S.A., Estación Moneda', anio: 2010, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['gobierno'], uso: 'Estación de metro', // revisar sector (transporte)
    sistemas: 'Proyecto de climatización con equipos de refrigerante tipo bomba de calor.', m2: null, foto: null, estado: 'ejecutado', tags: ['Ingeniería'], trabajo: 'Proyecto', detalle: 'Elaboración y desarrollo del proyecto de climatización con equipos de refrigerante tipo bomba de calor.', cliente: 'Público' },
  { nombre: 'Metro S.A., Estación Pedro de Valdivia', anio: 2010, lugar: 'Santiago', regiones: ['metropolitana'], sectores: ['gobierno'], uso: 'Estación de metro', // revisar sector (transporte)
    sistemas: 'Proyecto de climatización con equipos de refrigerante tipo bomba de calor.', m2: null, foto: null, estado: 'ejecutado', tags: ['Ingeniería'], trabajo: 'Proyecto', detalle: 'Elaboración y desarrollo del proyecto de climatización con equipos de refrigerante tipo bomba de calor.', cliente: 'Público' },
  { nombre: 'Terminales portuarios Queilén, Chequián y Quellón – MOP', anio: 2010, lugar: 'Chiloé', regiones: ['loslagos'], sectores: ['gobierno'], uso: 'Terminales portuarios',
    sistemas: 'Ingeniería básica y de detalles.', m2: null, foto: null, estado: 'ejecutado', tags: ['Ingeniería'], trabajo: 'Proyecto', detalle: 'Ingeniería básica y de detalles de la climatización de 3 terminales de pasajeros: calderas eléctricas, radiadores extraplanos y extracción de baños y cocina.', cliente: 'Público' },
  { nombre: 'Edificio Alto Lafquén', anio: 2010, lugar: 'Los Ángeles', regiones: ['biobio'], sectores: ['residencial'], uso: 'Habitacional · 2 torres',
    sistemas: 'Calefacción por radiadores y central solar de ACS.', m2: null, foto: null, estado: 'ejecutado', tags: ['Solar / ERNC'], trabajo: 'Proyecto', detalle: 'Condominio de 2 torres con calefacción por radiadores y generadores de calor individuales, más central solar para ACS.', cliente: 'Privado' }
];
