#!/usr/bin/env python3
"""Convierte una foto subida a JPG de 1600 px como máximo (lo usa la app al subir fotos de marca).
Uso: foto.py <entrada> <salida.jpg>. Acepta JPG, PNG, WEBP y, si está instalado pillow-heif, HEIC.
Sale con 1 si no es una imagen."""
import sys
from PIL import Image, ImageOps

try:
    try:
        import pillow_heif  # opcional: fotos HEIC del iPhone
        pillow_heif.register_heif_opener()
    except ImportError:
        pass
    entrada, salida = sys.argv[1], sys.argv[2]
    with Image.open(entrada) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA", "P"):
            fondo = Image.new("RGB", im.size, (255, 255, 255))
            im = im.convert("RGBA")
            fondo.paste(im, mask=im.getchannel("A"))
            im = fondo
        else:
            im = im.convert("RGB")
        im.thumbnail((1600, 1600), Image.LANCZOS)
        im.save(salida, "JPEG", quality=92)
except Exception as e:  # noqa: BLE001 — cualquier fallo es "no se pudo leer como imagen"
    print(f"No se pudo convertir la foto: {e}", file=sys.stderr)
    sys.exit(1)
