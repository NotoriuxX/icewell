/* ICEWELL — Vista previa del panel (/admin/editor)
   El editor muestra el sitio real en un iframe con ?borrador=1. Este script, que va
   ANTES de sitio-data.js y cv-data.js, toma el borrador sin guardar desde el editor
   (window.parent.icewellBorrador) para que la vista previa muestre los cambios
   antes de publicar. En una visita normal no hace nada; desde otro dominio el
   acceso a window.parent lanza un error (mismo origen obligatorio) y se ignora. */
(function(){
  try {
    if(/[?&]borrador=1(&|$)/.test(location.search) && window.parent !== window && typeof window.parent.icewellBorrador === 'function'){
      window.ICEWELL_BORRADOR = window.parent.icewellBorrador();
    }
  } catch(e){ /* otro origen: sin vista previa */ }
})();
