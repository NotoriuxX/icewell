/* ==========================================================================
   ICEWELL — Años de experiencia automáticos + tema de aniversario
   Portado de cuvolt/proyecto/assets/aniversario.js. Lo usan index.html y cv.html.

   ÚNICO dato a mantener: la fecha de fundación (panel /admin → Empresa; llega por sitio-data.js).
   - Los años cambian solos el día exacto del aniversario.
   - Desde ese día y durante 1 mes (hasta el mismo día del mes siguiente,
     sin incluirlo) la página muestra el tema de aniversario: modal de bienvenida
     (1 vez por aniversario), confeti y acentos dorados.
   - Rellena cualquier [data-anios] (años cumplidos) y [data-desde] (año de fundación).

   Vista previa (no afecta a nadie más):
     ?aniversario=1      fuerza el tema
     ?hoy=2027-01-05     simula la fecha de hoy (probar cálculo y corte del mes)
     Botón flotante 'Vista previa · Aniversario' (siempre visible mientras MOSTRAR_BOTON = true; ?preview=0 lo oculta)
   ========================================================================== */

// Ambos datos se editan en el panel (/admin → Empresa → Configuración) y llegan en assets/sitio-data.js,
// que debe cargarse ANTES que este archivo. Los valores de acá son solo el respaldo si falta.
const _CFG_SITIO = (window.ICEWELL_SITIO && window.ICEWELL_SITIO.config) || {};
const MOSTRAR_BOTON = _CFG_SITIO.botonAniversario != null ? !!_CFG_SITIO.botonAniversario : true;   // botón 'Vista previa · Aniversario' (false al publicar)
const ICEWELL_FUNDACION = /^\d{4}-\d{2}-\d{2}$/.test(_CFG_SITIO.fundacion || '') ? _CFG_SITIO.fundacion : '2009-01-01'; // ⚠ placeholder: el PDF solo dice "principios de 2009"

(function(){
  const [FY, FM, FD] = ICEWELL_FUNDACION.split('-').map(Number);
  const params = (()=>{ try{ return new URLSearchParams(location.search); }catch(e){ return new URLSearchParams(''); } })();

  // Fecha "hoy" (local del visitante), o la simulada con ?hoy=aaaa-mm-dd
  function hoy(){
    const h = params.get('hoy');
    if(h && /^\d{4}-\d{2}-\d{2}$/.test(h)){ const [y,m,d] = h.split('-').map(Number); return new Date(y, m-1, d); }
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  // Años cumplidos: resta 1 si este año todavía no llega el día/mes de fundación
  function aniosExperiencia(h){
    let a = h.getFullYear() - FY;
    if(h.getMonth()+1 < FM || (h.getMonth()+1 === FM && h.getDate() < FD)) a--;
    return Math.max(a, 0);
  }

  // Ventana del tema: [aniversario de este año, mismo día del mes siguiente)
  function enMesAniversario(h){
    const ini = new Date(h.getFullYear(), FM-1, FD);
    const fin = new Date(h.getFullYear(), FM, FD);   // Date ajusta solo el cambio de año (dic → ene)
    return h >= ini && h < fin && h.getFullYear() > FY;
  }

  const HOY = hoy();
  const ANIOS = aniosExperiencia(HOY);

  // Rellena cualquier [data-anios] / [data-desde] de la página (se puede volver a llamar tras un re-render)
  function rellenar(root){
    (root || document).querySelectorAll('[data-anios]').forEach(el=>{ el.textContent = ANIOS; });
    (root || document).querySelectorAll('[data-desde]').forEach(el=>{ el.textContent = FY; });
  }

  /* ---------- Tema de aniversario ---------- */
  // Dorado metálico único (logo, tarjeta, lema y modal comparten exactamente el mismo degradado)
  const GOLD = 'linear-gradient(135deg, #8C6A1F 0%, #C9A646 30%, #F1DFA0 52%, #C9A646 72%, #B08D3A 100%)';
  const CSS = `
  .aniv-gold-text{ background:${GOLD}; -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
  html.aniversario .eyebrow{ color:#8C6A1F; }
  html.aniversario .eyebrow--light{ color:#E3C877; }
  html.aniversario [data-anios]{ background:${GOLD}; -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
  html.aniversario .hero-stamp{ background:${GOLD}; color:#2b1d05; box-shadow:0 12px 23px rgba(140,106,31,.35); }
  html.aniversario .hero-stamp span:nth-child(2){ color:#2b1d05; }
  html.aniversario .numbers-section [data-anios]{ background:linear-gradient(135deg,#F1DFA0,#E3C877 50%,#fff6d6); -webkit-background-clip:text; background-clip:text; }
  html.aniversario .tri-strip, html.aniversario .numbers-section::before, html.aniversario .site-footer::before{ background:${GOLD}; }

  .aniv-modal-overlay{ position:fixed; inset:0; z-index:9990; display:flex; align-items:center; justify-content:center; padding:1rem;
    background:rgba(8,5,2,.78); backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); opacity:0; transition:opacity .35s ease; }
  .aniv-modal-overlay.open{ opacity:1; }
  /* Tarjeta estilo "aniversario dorado": fondo oscuro cálido con trama de puntos, anillo, laurel, cinta */
  .aniv-modal{ position:relative; width:100%; max-width:25rem; text-align:center; padding:2rem 1.5rem 1.75rem; border-radius:1.5rem; overflow:hidden;
    background:
      radial-gradient(circle at 50% 38%, rgba(201,166,70,.22), transparent 55%),
      radial-gradient(rgba(201,166,70,.10) 1px, transparent 1.4px) 0 0 / 14px 14px,
      linear-gradient(180deg, #1c130a, #0d0906);
    border:1px solid rgba(201,166,70,.45); box-shadow:0 40px 90px -25px rgba(0,0,0,.85), inset 0 0 0 1px rgba(241,223,160,.06);
    transform:scale(.9) translateY(10px); transition:transform .45s cubic-bezier(.2,.8,.25,1.15); color:#e9dcc0; }
  .aniv-modal-overlay.open .aniv-modal{ transform:none; }
  .aniv-modal .aniv-x{ position:absolute; top:.8rem; right:.8rem; z-index:2; width:2rem; height:2rem; border-radius:999px; border:1px solid rgba(201,166,70,.35); background:rgba(0,0,0,.25); color:#c9b27a; cursor:pointer; }
  .aniv-modal .aniv-x:hover{ color:#F1DFA0; border-color:rgba(241,223,160,.6); }
  .aniv-emblema{ position:relative; width:15rem; height:15rem; margin:0 auto; }
  .aniv-emblema svg.aniv-deco{ position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
  .aniv-emblema .aniv-num{ position:absolute; left:0; right:0; top:23%; font-family:'Big Shoulders Display', Impact, sans-serif; font-weight:800; font-size:6.2rem; line-height:1; letter-spacing:-.05em;
    filter:drop-shadow(0 3px 0 #6b4f16) drop-shadow(0 8px 14px rgba(0,0,0,.55)); }
  .aniv-emblema .aniv-num .aniv-n{ display:inline-block; }
  /* ordinal volado: ancho 0 para que el número siga centrado; dorado propio (el recorte del padre no siempre lo alcanza) */
  .aniv-emblema .aniv-num .aniv-ord{ display:inline-block; width:0; overflow:visible; white-space:nowrap; vertical-align:top; margin-top:.1em; padding-left:.06em; font-size:.36em; letter-spacing:0; line-height:1;
    background:${GOLD}; -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
  .aniv-emblema .aniv-banda{ position:absolute; left:50%; top:51%; transform:translateX(-50%); width:19.5rem; }
  .aniv-emblema .aniv-banda svg{ width:100%; height:auto; display:block; overflow:visible; }
  .aniv-modal p{ font-size:.92rem; line-height:1.6; color:#cbbd9c; margin:1rem .5rem .5rem; }
  .aniv-logo{ display:flex; justify-content:center; margin:.35rem 0 1.4rem; }
    .aniv-modal .aniv-ok{ border:0; border-radius:999px; padding:.85rem 2.2rem; font-weight:800; font-size:.95rem; letter-spacing:.02em; cursor:pointer; color:#2b1d05;
    background:linear-gradient(135deg, #8C6A1F 0%, #C9A646 28%, #F1DFA0 50%, #C9A646 72%, #9c7a2a 100%); background-size:200% 100%; background-position:0% 0;
    box-shadow:0 12px 26px -12px rgba(201,166,70,.75), inset 0 1px 0 rgba(255,255,255,.45); transition:background-position .6s ease, transform .2s ease; }
  .aniv-modal .aniv-ok:hover{ background-position:100% 0; transform:translateY(-1px); }
  @media (max-width:420px){ .aniv-emblema{ width:13rem; height:13rem; } .aniv-emblema .aniv-num{ font-size:5.3rem; } .aniv-emblema .aniv-banda{ width:14.5rem; } }
  @media (prefers-reduced-motion: reduce){ .aniv-modal-overlay, .aniv-modal{ transition:none; } }
  .aniv-confetti{ position:fixed; inset:0; width:100%; height:100%; pointer-events:none; z-index:9998; }
  `;
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);

  // Degradado SVG para la "O" del logo (los ids de gradiente SVG son globales: sirve para header y footer)
  function ponerGradienteSVG(){
    if(document.getElementById('anivGold')) return;
    const holder = document.createElement('div');
    holder.setAttribute('aria-hidden','true');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    holder.innerHTML = `<svg width="0" height="0"><defs><linearGradient id="anivGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8C6A1F"/><stop offset=".3" stop-color="#C9A646"/><stop offset=".52" stop-color="#F1DFA0"/><stop offset=".72" stop-color="#C9A646"/><stop offset="1" stop-color="#B08D3A"/>
    </linearGradient></defs></svg>`;
    document.body.appendChild(holder);
  }

  const CLAVE_VISTO = 'icewell_aniv_visto_' + HOY.getFullYear();
  const guardar = (k,v)=>{ try{ (window.i18nSafeSetStorage || ((a,b)=>localStorage.setItem(a,b)))(k,v); }catch(e){} };
  const leer = k=>{ try{ return (window.i18nSafeGetStorage || (a=>localStorage.getItem(a)))(k); }catch(e){ return null; } };

  function onKey(e){ if(e.key === 'Escape') cerrarModal(); }
  function cerrarModal(){
    const ov = document.querySelector('.aniv-modal-overlay');
    if(!ov) return;
    guardar(CLAVE_VISTO, '1');
    ov.classList.remove('open');
    ov.classList.add('closing');
    setTimeout(()=>ov.remove(), 300);
    document.removeEventListener('keydown', onKey);
  }

  // Fuentes solo para el modal (número serif + "años" manuscrito), se cargan al abrir
  function cargarFuentes(){
    if(document.getElementById('anivFonts')) return;
    const l = document.createElement('link');
    l.id = 'anivFonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@700&display=swap';
    document.head.appendChild(l);
  }

  // Laurel: hojas elípticas repartidas sobre un arco a cada lado del anillo (SVG generado, sin imágenes)
  // Corona dorada estilo "wreath": aro doble + 2 ramas con hojas en punta, tallitos con bayas y polvo dorado.
  // Todo SVG generado (sin imágenes). Coordenadas en viewBox 200x200, centro (100,100); ángulos en grados con y hacia abajo
  // (-90 = arriba, 0 = derecha, 90 = abajo, 180 = izquierda).
  function laurel(){
    const R = 84, rad = d => d * Math.PI / 180, P = (r, d) => [100 + r * Math.cos(rad(d)), 100 + r * Math.sin(rad(d))];
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // aleatorio fijo: siempre igual
    // hoja en punta apuntando hacia +y, largo L, ancho W
    const hoja = (x, y, dir, L, W, op) =>
      `<path d="M0 0 C ${W} ${L*.3} ${W*.7} ${L*.72} 0 ${L} C ${-W*.7} ${L*.72} ${-W} ${L*.3} 0 0 Z" fill="url(#anivLeaf)" opacity="${op.toFixed(2)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(dir - 90).toFixed(1)})"/>`;
    let out = '';
    // polvo dorado (lado opuesto a las ramas, como en la referencia)
    for(const [c0, c1] of [[222, 262], [15, 100]]){
      for(let i = 0; i < 70; i++){
        const d = c0 + rnd() * (c1 - c0), r = R + (rnd() - .5) * 16;
        const [x, y] = P(r, d);
        out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(.3 + rnd() * .7).toFixed(2)}" fill="#E3C877" opacity="${(.25 + rnd() * .5).toFixed(2)}"/>`;
      }
    }
    // aro doble (dos trazos finos levemente desplazados)
    out += `<circle cx="100" cy="100" r="${R}" fill="none" stroke="url(#anivGoldR)" stroke-width="1.5"/>`;
    out += `<circle cx="101.2" cy="99.2" r="${R - 2.2}" fill="none" stroke="url(#anivGoldR)" stroke-width=".7" opacity=".7"/>`;
    // ramas: [ángulo inicio, ángulo fin] — la rama crece de inicio a fin, hojas alternadas afuera/adentro
    for(const [d0, d1] of [[-108, 12], [102, 222]]){
      const n = 15, sign = Math.sign(d1 - d0);
      // tallo: arco un poco por fuera del aro
      const [sx, sy] = P(R + 1.5, d0), [ex, ey] = P(R + 1.5, d1);
      out += `<path d="M${sx.toFixed(1)} ${sy.toFixed(1)} A ${R + 1.5} ${R + 1.5} 0 0 ${sign > 0 ? 1 : 0} ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="url(#anivGoldR)" stroke-width="1.1"/>`;
      for(let i = 0; i < n; i++){
        const t = i / (n - 1), d = d0 + (d1 - d0) * t;
        const [x, y] = P(R + 1.5, d);
        const tangente = d + 90 * sign;                       // dirección en que crece la rama
        const lado = i % 2 ? 1 : -1;                          // alterna hacia afuera / adentro
        const L = 25 - t * 11, W = 6.8 - t * 2.4;
        out += hoja(x, y, tangente + lado * 40 * sign, L, W, .82 + .18 * (1 - t));
        // tallito con 3 bayas cada 4 hojas
        if(i % 4 === 2){
          const dir = rad(tangente - 70 * sign), l = 11;
          const bx = x + Math.cos(dir) * l, by = y + Math.sin(dir) * l;
          out += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} L${bx.toFixed(1)} ${by.toFixed(1)}" stroke="#C9A646" stroke-width=".7"/>`;
          for(const k of [-28, 0, 28]){
            const dk = dir + rad(k);
            out += `<circle cx="${(bx + Math.cos(dk) * 3).toFixed(1)}" cy="${(by + Math.sin(dk) * 3).toFixed(1)}" r="1.25" fill="#E3C877"/>`;
          }
        }
      }
      // hoja terminal en la punta de la rama
      const [tx, ty] = P(R + 1.5, d1);
      out += hoja(tx, ty, d1 + 90 * sign, 15, 4.6, 1);
    }
    return out;
  }

  // Logo sin placa (Manuel: el recuadro blanco se veía feo): isotipo con sus colores y la palabra "icewell"
  // en crema para que se lea sobre el fondo oscuro del modal. SVG en línea (copia de assets/icewell-logo.svg).
  const LOGO_MODAL = "<svg aria-hidden=\"true\" style=\"height:1.9rem;width:auto;display:block\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 359.76 90.74\"><g transform=\"translate(-12.837 -5.522)\"><path fill=\"#0062A8\" d=\"M66.852 6.382C66.947 8.304 65.420 8.645 64.075 9.255C63.231 9.639 62.459 10.129 61.696 10.640C60.215 11.633 58.770 12.705 57.372 13.811C55.979 14.912 54.631 16.046 53.348 17.277C52.072 18.502 50.859 19.821 49.818 21.251C48.734 22.739 47.836 24.345 47.247 26.088C46.936 27.010 46.711 27.971 46.473 28.918C46.227 29.898 45.967 30.863 45.746 31.840C45.308 33.772 45.024 35.751 44.906 37.738C44.776 39.942 44.851 42.157 44.784 44.363C44.715 46.587 44.502 48.802 44.326 51.024C44.161 53.107 44.029 55.195 43.517 57.215C43.276 58.165 42.951 59.099 42.638 60.032C42.476 60.515 42.317 60.998 42.127 61.463C41.949 61.898 41.744 62.317 41.498 62.714C41.039 63.454 40.437 64.118 39.832 64.766C39.227 65.413 38.620 66.044 37.951 66.622C36.548 67.835 34.879 68.817 33.124 69.390C31.203 70.017 29.180 70.154 27.128 70.156C25.068 70.158 22.979 70.022 21.132 69.169C20.293 68.782 19.504 68.246 18.720 67.749C17.839 67.190 16.964 66.680 15.902 67.177A45.370 45.370 0 0 1 66.852 6.382Z\"/><path fill=\"#1A9614\" d=\"M66.852 6.382C66.947 8.304 65.420 8.645 64.075 9.255C63.231 9.639 62.459 10.129 61.696 10.640C60.215 11.633 58.770 12.705 57.372 13.811C55.979 14.912 54.631 16.046 53.348 17.277C52.072 18.502 50.859 19.821 49.818 21.251C48.734 22.739 47.836 24.345 47.247 26.088C46.936 27.010 46.711 27.971 46.473 28.918C46.227 29.898 45.967 30.863 45.746 31.840C45.308 33.772 45.024 35.751 44.906 37.738C44.776 39.942 44.851 42.157 44.784 44.363C44.715 46.587 44.502 48.802 44.326 51.024C44.161 53.107 44.029 55.195 43.517 57.215C43.276 58.165 42.951 59.099 42.638 60.032C42.476 60.515 42.317 60.998 42.127 61.463C41.949 61.898 41.744 62.317 41.498 62.714C41.039 63.454 40.437 64.118 39.832 64.766C39.227 65.413 38.620 66.044 37.951 66.622C36.548 67.835 34.879 68.817 33.124 69.390C31.203 70.017 29.180 70.154 27.128 70.156C25.068 70.158 22.979 70.022 21.132 69.169C20.293 68.782 19.504 68.246 18.720 67.749C17.839 67.190 16.964 66.680 15.902 67.177A45.370 45.370 0 0 1 66.852 6.382Z\" transform=\"rotate(120 58.207 50.892)\"/><path fill=\"#D01726\" d=\"M66.852 6.382C66.947 8.304 65.420 8.645 64.075 9.255C63.231 9.639 62.459 10.129 61.696 10.640C60.215 11.633 58.770 12.705 57.372 13.811C55.979 14.912 54.631 16.046 53.348 17.277C52.072 18.502 50.859 19.821 49.818 21.251C48.734 22.739 47.836 24.345 47.247 26.088C46.936 27.010 46.711 27.971 46.473 28.918C46.227 29.898 45.967 30.863 45.746 31.840C45.308 33.772 45.024 35.751 44.906 37.738C44.776 39.942 44.851 42.157 44.784 44.363C44.715 46.587 44.502 48.802 44.326 51.024C44.161 53.107 44.029 55.195 43.517 57.215C43.276 58.165 42.951 59.099 42.638 60.032C42.476 60.515 42.317 60.998 42.127 61.463C41.949 61.898 41.744 62.317 41.498 62.714C41.039 63.454 40.437 64.118 39.832 64.766C39.227 65.413 38.620 66.044 37.951 66.622C36.548 67.835 34.879 68.817 33.124 69.390C31.203 70.017 29.180 70.154 27.128 70.156C25.068 70.158 22.979 70.022 21.132 69.169C20.293 68.782 19.504 68.246 18.720 67.749C17.839 67.190 16.964 66.680 15.902 67.177A45.370 45.370 0 0 1 66.852 6.382Z\" transform=\"rotate(240 58.207 50.892)\"/><path fill=\"#ffffff\" d=\"M177.00 44.25L169.58 40.54A13.0 12.45 0 1 0 169.58 63.46L177.00 59.75L177.00 73.38A27.5 24.0 0 1 1 177.00 30.62Z\"/><path fill=\"#ffffff\" fill-rule=\"evenodd\" d=\"M118 18H132V28.3H118ZM118 32.5H132V75H118ZM185.00 29.00L215.00 29.00L215.00 39.30L199.00 39.30L199.00 46.70L214.00 46.70L214.00 56.70L199.00 56.70L199.00 64.70L215.00 64.70L215.00 75.00L185.00 75.00ZM302.00 29.00L332.00 29.00L332.00 39.30L316.00 39.30L316.00 46.70L331.00 46.70L331.00 56.70L316.00 56.70L316.00 64.70L332.00 64.70L332.00 75.00L302.00 75.00ZM218.00 29.00L232.00 29.00L241.50 57.50L252.00 29.00L262.00 29.00L272.50 57.50L283.00 29.00L296.00 29.00L280.00 75.00L267.00 75.00L257.00 48.50L247.00 75.00L233.00 75.00ZM338.80 18.00L351.80 18.00L351.80 75.00L338.80 75.00L338.80 39.00L347.80 30.00L338.80 21.00ZM336.00 21.00L345.00 30.00L336.00 39.00ZM359.60 18.00L372.60 18.00L372.60 75.00L359.60 75.00L359.60 72.50L368.60 63.50L359.60 54.50ZM356.80 54.50L365.80 63.50L356.80 72.50Z\"/></g></svg>";
  function logoSVG(){ return LOGO_MODAL; }

  function abrirModal(){
    if(document.querySelector('.aniv-modal-overlay:not(.closing)')) return;
    // Esperar a que la página termine de cargar (y se vaya la pantalla "Cargando") antes de mostrarlo
    if(document.readyState !== 'complete'){ window.addEventListener('load', ()=>setTimeout(abrirModal, 900), { once:true }); return; }
    cargarFuentes();
    const ov = document.createElement('div');
    ov.className = 'aniv-modal-overlay';
    ov.innerHTML = `<div class="aniv-modal" role="dialog" aria-modal="true" aria-label="Celebramos ${ANIOS} años">
        <button type="button" class="aniv-x" aria-label="Cerrar">✕</button>
        <div class="aniv-emblema">
          <svg class="aniv-deco" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <linearGradient id="anivGoldV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1DFA0"/><stop offset=".5" stop-color="#C9A646"/><stop offset="1" stop-color="#8C6A1F"/></linearGradient>
              <linearGradient id="anivGoldR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8C6A1F"/><stop offset=".45" stop-color="#F1DFA0"/><stop offset="1" stop-color="#9c7a2a"/></linearGradient>
              <linearGradient id="anivLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6E7B0"/><stop offset=".5" stop-color="#D9B85C"/><stop offset="1" stop-color="#A5802C"/></linearGradient>
            </defs>
            ${laurel()}
          </svg>
          <div class="aniv-num aniv-gold-text"><span class="aniv-n">${ANIOS}<span class="aniv-ord">º</span></span></div>
          <div class="aniv-banda" aria-hidden="true">
            <svg viewBox="0 0 320 110">
              <defs>
                <linearGradient id="anivBanda" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBEFC4"/><stop offset=".28" stop-color="#E6C671"/><stop offset=".6" stop-color="#C9A646"/><stop offset="1" stop-color="#94722A"/></linearGradient>
                <linearGradient id="anivColaL" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#B8923A"/><stop offset=".55" stop-color="#D9B85C"/><stop offset="1" stop-color="#8C6A1F"/></linearGradient>
                <linearGradient id="anivColaR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B8923A"/><stop offset=".55" stop-color="#D9B85C"/><stop offset="1" stop-color="#8C6A1F"/></linearGradient>
                <linearGradient id="anivPliegue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4f16"/><stop offset="1" stop-color="#3d2c0a"/></linearGradient>
                <filter id="anivSombra" x="-10%" y="-20%" width="120%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000" flood-opacity=".55"/></filter>
                <path id="anivArco" d="M48 49 C120 81 200 81 272 49"/>
              </defs>
              <g filter="url(#anivSombra)">
                <path d="M62 50 C44 44 26 39 6 35 Q14 46 23 58 Q15 69 8 81 C28 79 46 78 62 77 Z" fill="url(#anivColaL)"/>
                <path d="M258 50 C276 44 294 39 314 35 Q306 46 297 58 Q305 69 312 81 C292 79 274 78 258 77 Z" fill="url(#anivColaR)"/>
                <path d="M48 34 L48 62 Q53 71 62 77 L62 50 Q54 44 48 34 Z" fill="url(#anivPliegue)"/>
                <path d="M272 34 L272 62 Q267 71 258 77 L258 50 Q266 44 272 34 Z" fill="url(#anivPliegue)"/>
                <path d="M48 34 C120 66 200 66 272 34 L272 62 C200 94 120 94 48 62 Z" fill="url(#anivBanda)"/>
              </g>
              <path d="M49 36.5 C120 68.5 200 68.5 271 36.5" fill="none" stroke="#fff" stroke-width="1" opacity=".45"/>
              <path d="M50 39.5 C120 71.5 200 71.5 270 39.5" fill="none" stroke="#6b4f16" stroke-width=".6" opacity=".55"/>
              <path d="M50 57.5 C120 89.5 200 89.5 270 57.5" fill="none" stroke="#6b4f16" stroke-width=".6" opacity=".55"/>
              <text font-family="'Cinzel', 'Trajan Pro', Georgia, serif" font-weight="700" font-size="15" letter-spacing="2" fill="#F6E7B0" opacity=".55" transform="translate(0 .9)"><textPath href="#anivArco" startOffset="50%" text-anchor="middle" dominant-baseline="middle">• ANIVERSARIO •</textPath></text>
              <text font-family="'Cinzel', 'Trajan Pro', Georgia, serif" font-weight="700" font-size="15" letter-spacing="2" fill="#3a2a08"><textPath href="#anivArco" startOffset="50%" text-anchor="middle" dominant-baseline="middle">• ANIVERSARIO •</textPath></text>
            </svg>
          </div>
        </div>
        <p>Ingeniería HVAC en todo Chile desde ${FY}.<br>Gracias por confiar en</p>
        <div class="aniv-logo">${logoSVG()}</div>
        <button type="button" class="aniv-ok">Gracias</button>
      </div>`;
    ov.addEventListener('click', e=>{ if(e.target === ov) cerrarModal(); });
    ov.querySelector('.aniv-x').addEventListener('click', cerrarModal);
    ov.querySelector('.aniv-ok').addEventListener('click', cerrarModal);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    requestAnimationFrame(()=>ov.classList.add('open'));
    ov.querySelector('.aniv-ok').focus();
    confeti();
  }

  function confeti(){
    try{ if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; }catch(e){}
    const c = document.createElement('canvas'); c.className = 'aniv-confetti'; c.setAttribute('aria-hidden','true');
    document.body.appendChild(c);
    const ctx = c.getContext && c.getContext('2d');
    if(!ctx){ return; }   // sin canvas (entorno de pruebas): queda el marcador
    const W = c.width = innerWidth, H = c.height = innerHeight;
    const COL = ['#8C6A1F','#C9A646','#E3C877','#F1DFA0','#B08D3A'];
    const P = Array.from({length:150}, (_,k)=>({ x:Math.random()*W, y:-20-Math.random()*H*.5, w:k%4===0 ? 2.5 : 5+Math.random()*5, h:k%4===0 ? 22+Math.random()*16 : 7+Math.random()*7,
      vx:-1.5+Math.random()*3, vy:2+Math.random()*3.5, r:Math.random()*6.28, vr:-.2+Math.random()*.4, c:COL[(Math.random()*COL.length)|0] }));
    const t0 = performance.now();
    (function frame(t){
      ctx.clearRect(0,0,W,H);
      const fade = Math.max(0, 1 - Math.max(0, t - t0 - 2200) / 800);
      ctx.globalAlpha = fade;
      P.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=.05; p.r+=p.vr;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r); ctx.fillStyle=p.c; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore(); });
      if(fade > 0) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  let activo = false;
  // aplicar(on, forzarModal): prende/apaga el tema; el modal sale 1 vez por aniversario (o siempre en vista previa)
  function aplicar(on, forzarModal){
    activo = !!on;
    document.documentElement.classList.toggle('aniversario', activo);
    if(activo){
      ponerGradienteSVG();
      if(forzarModal || !leer(CLAVE_VISTO)) abrirModal();
    }else{
      cerrarModal();
    }
  }

  window.icewellAniversario = { anios:ANIOS, desde:FY, hoy:HOY, rellenar, aplicar, get activo(){ return activo; }, enMes:enMesAniversario(HOY) };

  function init(){
    rellenar();
    const previa = params.get('aniversario') === '1';
    aplicar(previa || enMesAniversario(HOY), previa);
    if(MOSTRAR_BOTON && params.get('preview') !== '0') botonVistaPrevia();
  }

  // Botón de vista previa (como la barra de cuvolt v3): siempre visible mientras el sitio es prototipo,
  // para mostrarle a Icewell cómo se ve la página en su aniversario. Abajo al centro: WhatsApp está a la
  // derecha y los avisos de PDF a la izquierda. Estado en la URL (?aniversario=1), así el link se comparte ya activado.
  // Para publicar sin el botón: MOSTRAR_BOTON = false (arriba), o ?preview=0 para ocultarlo en una visita.
  function botonVistaPrevia(){
    const css = document.createElement('style');
    css.textContent = `
      .aniv-switch{ position:fixed; left:50%; bottom:calc(16px + env(safe-area-inset-bottom, 0px)); transform:translateX(-50%); z-index:9000;
        display:flex; align-items:center; gap:6px; padding:5px 6px 5px 12px; border-radius:999px; border:1px solid rgba(201,166,70,.45);
        background:rgba(20,14,6,.92); backdrop-filter:blur(6px); box-shadow:0 8px 24px rgba(0,0,0,.35); font:600 11.5px/1 system-ui,sans-serif; color:#c9b27a; }
      .aniv-switch span{ letter-spacing:.06em; text-transform:uppercase; font-size:10px; }
      .aniv-switch button{ padding:7px 13px; border-radius:999px; border:1px solid rgba(201,166,70,.5); background:transparent; color:#F1DFA0; font:inherit; cursor:pointer; transition:background .2s, color .2s; }
      .aniv-switch button:hover{ background:rgba(201,166,70,.15); }
      .aniv-switch button[aria-pressed="true"]{ color:#2b1d05; border-color:transparent; background:${GOLD}; }
      /* el botón de vista previa va fijo abajo al centro: que no tape el final del pie (crédito, ©) */
      .site-footer, .cv-footer{ padding-bottom:84px !important; }
      @media print{ .aniv-switch{ display:none !important; } }
      @media (max-width:520px){ .aniv-switch span{ display:none; } .aniv-switch{ padding:4px; } }
    `;
    document.head.appendChild(css);
    const bar = document.createElement('div');
    bar.className = 'aniv-switch';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Vista previa del aniversario');
    bar.innerHTML = '<span>Vista previa</span><button type="button" aria-pressed="' + activo + '">Aniversario · ' + (ANIOS + (enMesAniversario(HOY) ? 0 : 0)) + ' años</button>';
    const b = bar.querySelector('button');
    b.addEventListener('click', ()=>{
      const on = !activo;
      aplicar(on, true);                       // en vista previa el modal sale siempre
      b.setAttribute('aria-pressed', on);
      try{ const u = new URL(location.href); on ? u.searchParams.set('aniversario','1') : u.searchParams.delete('aniversario'); history.replaceState(null,'',u); }catch(e){}
    });
    document.body.appendChild(bar);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
