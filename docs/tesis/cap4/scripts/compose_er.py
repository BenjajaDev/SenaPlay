"""Apila los tres grupos del modelo entidad-relación en una sola figura.

Uso: python compose_er.py <dir_png_grupos> <salida.png>
"""
import sys
from PIL import Image, ImageDraw, ImageFont

TITLES = ["Usuarios y aprendizaje", "Configuración remota y auditoría", "Contenido y datos de entrenamiento"]
src, out_path = sys.argv[1:3]
images = [Image.open(f"{src}/er-{i}.png").convert("RGB") for i in (1, 2, 3)]
width = max(im.width for im in images)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 70)
gap, title_h = 70, 110
out = Image.new("RGB", (width, sum(im.height for im in images) + len(images) * (gap + title_h)), "white")
draw, y = ImageDraw.Draw(out), 0
for title, im in zip(TITLES, images):
    draw.text((40, y + 20), title, fill=(60, 60, 60), font=font)
    y += title_h
    out.paste(im, ((width - im.width) // 2, y))
    y += im.height + gap
out.save(out_path)
