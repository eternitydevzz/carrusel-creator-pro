#!/usr/bin/env python3
"""Mete archivos en un ZIP sin carpetas (como zip -j). Uso: empaquetar.py <salida.zip> <archivo>..."""
import os, sys, zipfile

with zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED) as z:
    for f in sys.argv[2:]:
        z.write(f, os.path.basename(f))
