"""Genera los íconos de la app a partir de los íconos oficiales de SeñaPlay.

Los oficiales (assets/senaplay_icono_{claro,oscuro}.png) son cuadrados de
1024 px con esquinas redondeadas transparentes. Tal cual no sirven como ícono
de la app:

- iOS exige un ícono cuadrado opaco (aplica su propia máscara); la
  transparencia se vería negra.
- El ícono adaptativo de Android solo muestra el ~66 % central de la capa y
  cada launcher le aplica su forma, así que las flechas se recortarían.

Este script:
1. Ajusta un degradado lineal a los píxeles de fondo del ícono y lo usa para
   rellenar las esquinas transparentes -> ícono cuadrado opaco (iOS / legacy).
2. Para Android, separa el dibujo del degradado: el degradado va en la capa
   de fondo y el dibujo, achicado hasta caber en la zona segura, en la de
   primer plano.
3. Escribe versiones livianas (256 px y favicon de 64 px) para el portal web
   en web/public/brand/.

Uso (requiere Pillow y numpy):  python scripts/generateAppIcons.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
OUT = ASSETS / "app-icon"
SIZE = 1024

# Zona segura del ícono adaptativo: 66 dp de diámetro en una capa de 108 dp.
SAFE_RADIUS = SIZE * (66 / 108) / 2


def fit_background_gradient(rgba, is_background):
    """Ajusta color = a + b*x + c*y por canal sobre los píxeles de fondo."""
    h, w = rgba.shape[:2]
    ys, xs = np.nonzero(is_background)
    design = np.column_stack([np.ones_like(xs), xs, ys]).astype(np.float64)
    coef = [np.linalg.lstsq(design, rgba[ys, xs, c].astype(np.float64), rcond=None)[0] for c in range(3)]
    gy, gx = np.mgrid[0:h, 0:w]
    grid = np.stack([np.ones_like(gx), gx, gy], axis=-1).astype(np.float64)
    return np.clip(np.stack([grid @ k for k in coef], axis=-1), 0, 255)


def extract_artwork(rgba, gradient):
    """Separa el dibujo (manos, flechas) del fondo degradado.

    Devuelve una imagen RGBA con el fondo transparente. La opacidad sale de
    cuánto se aleja cada píxel del degradado, así los bordes suavizados del
    dibujo se conservan. El borde redondeado del ícono no cuenta como dibujo.
    """
    diff = np.max(np.abs(rgba[..., :3] - gradient), axis=-1)
    alpha = np.clip((diff - 20) / 50, 0, 1)
    h, w = alpha.shape
    gy, gx = np.mgrid[0:h, 0:w]
    inside = (np.abs(gx - w / 2) < w / 2 - 40) & (np.abs(gy - h / 2) < h / 2 - 40)
    alpha = alpha * inside * (rgba[..., 3] / 255)
    art = np.dstack([rgba[..., :3], alpha * 255])
    return Image.fromarray(art.round().astype(np.uint8), "RGBA"), alpha


def content_radius(alpha):
    """Distancia al centro del píxel de dibujo más lejano."""
    ys, xs = np.nonzero(alpha > 0.5)
    return float(np.max(np.hypot(xs - SIZE / 2, ys - SIZE / 2)))


def build(name, is_background_fn, adaptive):
    src = Image.open(ASSETS / f"senaplay_icono_{name}.png").convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
    rgba = np.asarray(src).astype(np.float64)
    opaque = rgba[..., 3] > 250
    is_background = opaque & is_background_fn(rgba)
    gradient = fit_background_gradient(rgba, is_background)

    # 1. Ícono cuadrado opaco: las esquinas transparentes toman el degradado.
    alpha = rgba[..., 3:4] / 255
    full = rgba[..., :3] * alpha + gradient * (1 - alpha)
    full_img = Image.fromarray(full.round().astype(np.uint8), "RGB")
    full_img.save(OUT / f"icon-{name}.png")
    if not adaptive:
        return

    # 2. Ícono adaptativo de Android: el degradado va entero en la capa de
    #    fondo y el dibujo, achicado hasta caber en la zona segura, en la de
    #    primer plano (con transparencia, como espera Android).
    art, art_alpha = extract_artwork(rgba, gradient)
    scale = min(1.0, (SAFE_RADIUS - 8) / content_radius(art_alpha))
    inner = round(SIZE * scale)
    offset = (SIZE - inner) // 2
    foreground = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    foreground.paste(art.resize((inner, inner), Image.LANCZOS), (offset, offset))
    foreground.save(OUT / f"adaptive-foreground-{name}.png")
    Image.fromarray(gradient.round().astype(np.uint8), "RGB").save(OUT / f"adaptive-background-{name}.png")
    print(f"{name}: dibujo escalado a {scale:.2f} para la zona segura de Android")


def purple_background(rgba):
    # Fondo morado del ícono claro: el dibujo es amarillo o blanco (verde alto).
    return rgba[..., 1] < 110


def yellow_background(rgba):
    # Fondo amarillo del ícono oscuro: el dibujo es morado (verde bajo) o blanco.
    r, g, b = rgba[..., 0], rgba[..., 1], rgba[..., 2]
    return (r > 200) & (g > 150) & (b < 120)


def build_web():
    """Versiones livianas para el portal web (nav, panel y favicon).

    Conservan las esquinas redondeadas transparentes de los originales: en la
    web el ícono se muestra tal cual, sin máscara del sistema.
    """
    WEB_OUT.mkdir(parents=True, exist_ok=True)
    for name in ("claro", "oscuro"):
        src = Image.open(ASSETS / f"senaplay_icono_{name}.png").convert("RGBA")
        src.resize((256, 256), Image.LANCZOS).save(WEB_OUT / f"icono-{name}.png", optimize=True)
        src.resize((64, 64), Image.LANCZOS).save(WEB_OUT / f"favicon-{name}.png", optimize=True)


WEB_OUT = ROOT / "web" / "public" / "brand"

if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    build_web()
    build("claro", purple_background, adaptive=True)
    # El oscuro solo se usa como variante oscura del ícono de iOS: Android no
    # cambia el ícono de la app según el modo del sistema.
    build("oscuro", yellow_background, adaptive=False)
