#!/usr/bin/env python3
"""Pasa una carpeta de datos de un solo cliente al formato de perfiles. Idempotente: si ya hay perfiles, no hace nada.

    migrar_perfiles.py <carpeta_datos> [nombre del cliente]

Antes:  datos/{marca, fichas, virales, virales_descritos, salida, ESTADO.md, CUPO.csv, ajustes.json, ...}
Después: datos/perfiles/<id>/{marca, fichas, virales, virales_descritos, salida, ESTADO.md, perfil.json}
         datos/{CUPO.csv, ajustes.json (con perfil_activo), CUENTA_ACTUAL.txt, capas}   ← compartido

Primero guarda una copia comprimida de todo en datos/_copias/. Las fichas guardan la ruta del original
(`viral: .../datos/virales/X`): se reescriben a la nueva carpeta.
"""
import json
import os
import re
import shutil
import sys
import tarfile
import time
import unicodedata

DEL_CLIENTE = ["marca", "fichas", "virales", "virales_descritos", "salida", "ESTADO.md"]


def slug(nombre):
    s = unicodedata.normalize("NFD", nombre.strip().lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s or "mi_marca"


def leer_json(p):
    try:
        return json.load(open(p, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def nombre_de_marca(datos):
    try:
        for l in open(os.path.join(datos, "marca", "marca.txt"), encoding="utf-8"):
            if l.startswith("nombre:") and l.split(":", 1)[1].strip():
                return l.split(":", 1)[1].strip()
    except OSError:
        pass
    return "Mi marca"


def migrar(datos, nombre=None):
    datos = os.path.abspath(datos)
    ajustes_p = os.path.join(datos, "ajustes.json")
    ajustes = leer_json(ajustes_p)
    perfiles = os.path.join(datos, "perfiles")
    if os.path.isdir(perfiles) and any(os.path.isdir(os.path.join(perfiles, d)) for d in os.listdir(perfiles)):
        print("YA_MIGRADO: ya hay perfiles; no se toca nada")
        return 0

    nombre = nombre or nombre_de_marca(datos)
    pid = slug(nombre)
    destino = os.path.join(perfiles, pid)

    # 1. copia de seguridad de todo (salvo las capas, que se regeneran solas, y copias anteriores)
    os.makedirs(os.path.join(datos, "_copias"), exist_ok=True)
    copia = os.path.join(datos, "_copias", f"antes_de_perfiles_{time.strftime('%Y-%m-%d_%H%M%S')}.tar.gz")
    with tarfile.open(copia, "w:gz") as tar:
        for f in sorted(os.listdir(datos)):
            if f in ("_copias", "capas"):
                continue
            tar.add(os.path.join(datos, f), arcname=f)
    print(f"COPIA: {copia} ({os.path.getsize(copia) // 1024} KB)")

    # 2. mover lo del cliente
    os.makedirs(destino, exist_ok=True)
    movidos = []
    for f in DEL_CLIENTE:
        origen = os.path.join(datos, f)
        if os.path.exists(origen):
            shutil.move(origen, os.path.join(destino, f))
            movidos.append(f)
    for sub in ("marca/fotos", "fichas", "virales", "salida"):
        os.makedirs(os.path.join(destino, sub), exist_ok=True)
    print(f"MOVIDO a perfiles/{pid}: {', '.join(movidos) or 'nada (carpeta nueva)'}")

    # 3. rutas del original dentro de las fichas
    # cualquier ruta cuyo original esté ahora en la carpeta del cliente (venga de donde venga la ruta guardada)
    virales = os.path.join(destino, "virales")
    def corregir(m):
        base = os.path.basename(m.group(1).rstrip("/"))
        return f"viral: {os.path.join(virales, base)}" if base and os.path.isdir(os.path.join(virales, base)) else m.group(0)
    cambiadas = 0
    for f in sorted(os.listdir(os.path.join(destino, "fichas"))):
        p = os.path.join(destino, "fichas", f)
        if not f.endswith(".md"):
            continue
        t = open(p, encoding="utf-8").read()
        t2 = re.sub(r"(?m)^viral: (\S.*)$", corregir, t)
        if t2 != t:
            open(p, "w", encoding="utf-8").write(t2)
            cambiadas += 1
    print(f"FICHAS con la ruta del original corregida: {cambiadas}")

    # 4. perfil del cliente (nombre y ubicación de los metadatos) y cliente activo
    perfil = {"nombre": nombre, "ubicacion": ajustes.get("ubicacion") or {"ciudad": "Newark", "estado": "New Jersey", "pais": "United States", "codigo": "US", "lat": 40.7357, "lon": -74.1724}}
    json.dump(perfil, open(os.path.join(destino, "perfil.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    ajustes["perfil_activo"] = pid
    json.dump(ajustes, open(ajustes_p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"PERFIL_ACTIVO: {pid} ({nombre})")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(64)
    sys.exit(migrar(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None))
