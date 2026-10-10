#!/usr/bin/env python3
"""Deja imágenes y videos listos para subir: sin metadatos y con la ubicación que se indique.

Versión multiplataforma (macOS, Windows y Linux) de adaptar.sh: mismas opciones, misma salida.
Uso:
  adaptar.py <carpeta>                 -> adapta todas las imágenes y videos de la carpeta
  adaptar.py <archivo> [<archivo>...]  -> adapta solo esos archivos
Opciones (van al final, todas opcionales):
  --ciudad "Newark" --estado "New Jersey" --pais "United States" --codigo US --lat 40.7357 --lon -74.1724

Qué hace con cada archivo:
  Imagen: reescribe los píxeles como JPEG (ancho 1080, calidad 92) con Pillow, borra todos los
          metadatos con exiftool y escribe solo la ubicación (GPS + IPTC + XMP).
  Video:  reempaqueta con ffmpeg sin recodificar, sin metadatos ni capítulos, y escribe la
          ubicación en el átomo ©xyz (ISO 6709).
  Los originales se mueven a una carpeta hermana "<carpeta>_originales" (fuera de la de subida).
  Al final comprueba byte a byte que no quede c2pa / openai / jumbf / gpt / sora / watermark.
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

try:  # HEIC solo si está pillow-heif (pip install pillow-heif)
    import pillow_heif
    pillow_heif.register_heif_opener()
    HEIC = True
except ImportError:
    HEIC = False

WINDOWS = os.name == "nt"
USO = "Uso: adaptar.py <carpeta|archivos...> [--ciudad ... --estado ... --lat ... --lon ...]"
EXTENSIONES = {".png", ".jpg", ".jpeg", ".webp", ".heic", ".tif", ".tiff", ".mp4", ".mov", ".m4v"}
VIDEOS = {"mp4", "mov", "m4v"}
PATRON = rb"c2pa|jumb|openai|chatgpt|gpt-image|dall-e|sora|trainedAlgorithmic|watermark|midjourney|stable ?diffusion|gemini|imagen"
RE_PATRON = re.compile(PATRON, re.IGNORECASE)


class Fallo(Exception):
    """Error que corta el proceso con un mensaje para el usuario (como set -e en adaptar.sh)."""


def salir(msg, codigo=1):
    print(msg, file=sys.stderr)
    sys.exit(codigo)


def buscar_exiftool():
    for nombre in (("exiftool.exe", "exiftool") if WINDOWS else ("exiftool",)):
        ruta = shutil.which(nombre)
        if ruta:
            return ruta
    return None


def pista_exiftool():
    if WINDOWS:
        return "winget install --id OliverBetz.ExifTool -e"
    if sys.platform == "darwin":
        return "brew install exiftool"
    return "sudo apt install libimage-exiftool-perl"


def exiftool(exe, *args, capturar=False):
    """Ejecuta exiftool pasándole los argumentos en un archivo UTF-8 (-@), para que las rutas y los
    valores con tildes o espacios lleguen bien también en Windows."""
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".args", delete=False) as f:
        if WINDOWS:
            f.write("-charset\nfilename=utf8\n")
        for a in args:
            f.write(f"{a}\n")
        argfile = f.name
    try:
        return subprocess.run([exe, "-@", argfile], stdout=subprocess.PIPE if capturar else None,
                              stderr=subprocess.DEVNULL if capturar else None)
    finally:
        os.unlink(argfile)


def rastros(exe, archivo):
    """Cuenta coincidencias del patrón en los metadatos (líneas de exiftool -a -s) + en los bytes del archivo."""
    n1 = 0
    r = exiftool(exe, "-a", "-s", str(archivo), capturar=True)
    for linea in (r.stdout or b"").splitlines():
        if RE_PATRON.search(linea):
            n1 += 1
    try:
        n2 = len(RE_PATRON.findall(Path(archivo).read_bytes()))
    except OSError:
        n2 = 0
    return n1 + n2


def adaptar_imagen(exe, entrada, salida, ub):
    if entrada.suffix.lower() in (".heic", ".heif") and not HEIC:
        raise Fallo(f"No se puede leer {entrada.name}: para HEIC hace falta pillow-heif (pip install pillow-heif)")
    try:
        img = Image.open(entrada)
        img.load()
    except Exception as e:
        raise Fallo(f"No se puede leer la imagen {entrada.name}: {e}")
    w, h = img.size
    nh = (h * 1080 // w) // 2 * 2
    # Si está a menos de un 1 % de un formato estándar de Instagram, encajar en él (4:5, 1:1, 9:16, 1.91:1)
    for std in (1350, 1080, 1920, 566):
        if abs(nh - std) <= std // 100:
            nh = std
            break
    # JPEG no tiene transparencia: lo transparente se apoya sobre blanco
    if img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        img = Image.new("RGB", rgba.size, (255, 255, 255))
        img.paste(rgba, mask=rgba.getchannel("A"))
    else:
        img = img.convert("RGB")
    img.resize((1080, nh), Image.LANCZOS).save(salida, "JPEG", quality=92)

    for args in (["-q", "-overwrite_original", "-all="],
                 ["-q", "-q", "-overwrite_original",
                  f"-GPSLatitude={ub['lat_abs']}", f"-GPSLatitudeRef={ub['lat_ref']}",
                  f"-GPSLongitude={ub['lon_abs']}", f"-GPSLongitudeRef={ub['lon_ref']}",
                  f"-XMP:City={ub['ciudad']}", f"-XMP:State={ub['estado']}",
                  f"-XMP:Country={ub['pais']}", f"-XMP:CountryCode={ub['codigo']}",
                  f"-IPTC:City={ub['ciudad']}", f"-IPTC:Province-State={ub['estado']}",
                  f"-IPTC:Country-PrimaryLocationName={ub['pais']}", f"-IPTC:Country-PrimaryLocationCode={ub['codigo']}"],
                 ["-q", "-overwrite_original", "-XMP-x:XMPToolkit="]):
        if exiftool(exe, *args, str(salida)).returncode != 0:
            raise Fallo(f"exiftool no pudo limpiar {entrada.name}")
    return f"{w}x{h} -> 1080x{nh} jpg"


def adaptar_video(entrada, salida, ub):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise Fallo("Falta ffmpeg para videos")
    r = subprocess.run([ffmpeg, "-v", "error", "-y", "-i", str(entrada), "-map", "0:v", "-map", "0:a?",
                        "-map_metadata", "-1", "-map_chapters", "-1", "-c", "copy",
                        "-fflags", "+bitexact", "-flags", "+bitexact",
                        "-metadata", f"location={ub['iso6709']}", "-metadata", f"location-eng={ub['iso6709']}",
                        "-movflags", "+faststart", str(salida)])
    if r.returncode != 0:
        raise Fallo(f"ffmpeg no pudo reempaquetar {entrada.name}")
    return "reempaquetado mp4 sin metadatos"


def leer_args(argv):
    op = {"ciudad": "Newark", "estado": "New Jersey", "pais": "United States", "codigo": "US",
          "lat": "40.7357", "lon": "-74.1724"}
    entradas = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a.startswith("--") and a[2:] in op:
            if i + 1 >= len(argv):
                salir(USO)
            op[a[2:]] = argv[i + 1]
            i += 2
        else:
            entradas.append(a)
            i += 1
    return op, entradas


def main():
    if WINDOWS and not sys.stdout.isatty():  # la app lee la salida en UTF-8
        for flujo in (sys.stdout, sys.stderr):
            flujo.reconfigure(encoding="utf-8", errors="replace")
    op, entradas = leer_args(sys.argv[1:])
    if not entradas:
        salir(USO)
    exe = buscar_exiftool()
    if not exe:
        salir(f"Falta exiftool ({pista_exiftool()})")

    # Referencias GPS para EXIF y coordenada ISO 6709 para video (+DD.DDDD-DDD.DDDD/)
    lat, lon = op["lat"], op["lon"]
    try:
        iso6709 = f"{float(lat):+08.4f}{float(lon):+09.4f}/"
    except ValueError:
        salir(f"Latitud o longitud no válida: {lat}, {lon}")
    ub = dict(ciudad=op["ciudad"], estado=op["estado"], pais=op["pais"], codigo=op["codigo"],
              lat_abs=lat[1:] if lat.startswith("-") else lat, lat_ref="S" if lat.startswith("-") else "N",
              lon_abs=lon[1:] if lon.startswith("-") else lon, lon_ref="W" if lon.startswith("-") else "E",
              iso6709=iso6709)

    # Lista de archivos a tratar
    archivos = []
    for e in entradas:
        p = Path(e)
        if p.is_dir():
            archivos += sorted((f for f in p.iterdir()
                                if f.is_file() and not f.is_symlink() and f.suffix.lower() in EXTENSIONES),
                               key=lambda f: str(f))
        elif p.is_file():
            archivos.append(p)
        else:
            salir(f"No existe: {e}")
    if not archivos:
        salir("No hay imágenes ni videos que adaptar")

    fallos = 0
    carpeta = orig_dir = None
    for f in archivos:
        carpeta = f.resolve().parent
        base = f.name
        stem, ext = (base.rsplit(".", 1) if "." in base else (base, base))
        ext = ext.lower()
        orig_dir = carpeta.parent / f"{carpeta.name}_originales"
        orig_dir.mkdir(parents=True, exist_ok=True)
        antes = rastros(exe, f)
        if ext in VIDEOS:
            out, tipo = carpeta / f"{stem}.mp4", "video"
        else:
            out, tipo = carpeta / f"{stem}.jpg", "imagen"
        tmp = carpeta / f".{stem}.adaptando{out.suffix}"
        try:
            detalle = adaptar_video(f, tmp, ub) if tipo == "video" else adaptar_imagen(exe, f, tmp, ub)
        except Fallo as err:
            tmp.unlink(missing_ok=True)
            salir(str(err))
        mover(f, orig_dir / base)
        mover(tmp, out)
        despues = rastros(exe, out)
        estado = "limpio"
        if despues > 0:
            estado = f"QUEDAN RASTROS ({despues})"
            fallos += 1
        print(f"{base + ' -> ' + out.name:<28} {detalle:<24} rastros antes: {antes:<3} ahora: {estado}", flush=True)
    try:
        (carpeta / ".DS_Store").unlink(missing_ok=True)
    except OSError:
        pass

    print(f"ORIGINALES={orig_dir}")
    print(f"UBICACION={op['ciudad']}, {op['estado']}, {op['pais']} ({lat}, {lon})")
    if fallos > 0:
        salir(f"ATENCIÓN: {fallos} archivo(s) siguen con rastros; revisar a mano")
    print(f"ok: {len(archivos)} archivo(s) limpios")


def mover(origen, destino):
    """Mueve sobrescribiendo el destino si ya existe (como mv)."""
    try:
        os.replace(origen, destino)
    except OSError:
        if destino.exists():
            destino.unlink()
        shutil.move(str(origen), str(destino))


if __name__ == "__main__":
    main()
