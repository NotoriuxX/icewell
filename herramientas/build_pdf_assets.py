#!/usr/bin/env python3
"""
build_pdf_assets.py — Genera web/assets/vendor/cv-pdf-assets.js para el PDF del CV.

Por qué existe: el botón "Descargar PDF" de cv.html arma un PDF real con jsPDF
en el navegador. jsPDF necesita las fuentes (TTF) y las fotos como base64.
Leerlas en vivo con canvas/fetch falla al abrir la página con doble clic (file://),
así que se embeben en un .js que se carga recién cuando alguien pide el PDF.

Correr de nuevo cada vez que se agregue o cambie una foto en cv-data.js:
    python proyecto/herramientas/build_pdf_assets.py
"""
import base64
import io
import json
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Falta Pillow: pip install pillow")

WEB = Path(__file__).resolve().parent.parent / "web"
ASSETS = WEB / "assets"
SALIDA = ASSETS / "vendor" / "cv-pdf-assets.js"

# Fuentes: nombre jsPDF -> archivo TTF (mismas familias que el sitio)
FUENTES = {
    "BigShoulders-Black": "BigShouldersDisplay-Black.ttf",
    "BigShoulders-Bold": "BigShouldersDisplay-Bold.ttf",
    "PlexMono": "IBMPlexMono-Medium.ttf",
    "PlexSans": "IBMPlexSans-Regular.ttf",
    "PlexSans-SemiBold": "IBMPlexSans-SemiBold.ttf",
    "PlexSans-Bold": "IBMPlexSans-Bold.ttf",
}
FOTO_ANCHO, FOTO_ALTO = 720, 480      # recorte 3:2, igual que la tarjeta del PDF
FOTO_CALIDAD = 72


def b64(datos: bytes) -> str:
    return base64.b64encode(datos).decode("ascii")


def foto_recortada(ruta: Path) -> str:
    """Recorte centrado tipo object-fit: cover a 3:2 y JPEG liviano (data URL)."""
    im = Image.open(ruta).convert("RGB")
    w, h = im.size
    objetivo = FOTO_ANCHO / FOTO_ALTO
    if w / h > objetivo:                       # más ancha: cortar lados
        nw = round(h * objetivo)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:                                      # más alta: cortar arriba/abajo
        nh = round(w / objetivo)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    im = im.resize((FOTO_ANCHO, FOTO_ALTO), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=FOTO_CALIDAD, optimize=True)
    return "data:image/jpeg;base64," + b64(buf.getvalue())


def main():
    datos_cv = (ASSETS / "cv-data.js").read_text(encoding="utf-8")
    fotos = sorted(set(re.findall(r"foto:\s*'([^']+)'", datos_cv)))

    salida = {"fuentes": {}, "fotos": {}, "logo": None}
    for nombre, archivo in FUENTES.items():
        salida["fuentes"][nombre] = b64((ASSETS / "fonts" / archivo).read_bytes())

    faltan = []
    for f in fotos:
        ruta = ASSETS / f
        if not ruta.exists():
            faltan.append(f)
            continue
        salida["fotos"][f] = foto_recortada(ruta)

    # Logo a color sobre fondo blanco (PNG con transparencia)
    salida["logo"] = "data:image/png;base64," + b64((ASSETS / "icewell-logo.png").read_bytes())

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(
        "/* GENERADO por proyecto/herramientas/build_pdf_assets.py — no editar a mano */\n"
        "window.CV_PDF_ASSETS = " + json.dumps(salida, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"Fuentes: {len(salida['fuentes'])} | Fotos: {len(salida['fotos'])} | "
          f"Peso: {SALIDA.stat().st_size // 1024} KB -> {SALIDA}")
    if faltan:
        print("OJO, fotos referenciadas en cv-data.js que no existen:", ", ".join(faltan), file=sys.stderr)


if __name__ == "__main__":
    main()
