#!/usr/bin/env python3
"""Corre una orden larga del motor en segundo plano (la lanza la app con motorFondo).
Uso: lanzar.py <log> <fin> <script.py> [args...]
Escribe toda la salida en <log> y, al terminar, el código de salida en <fin>. Así el final queda apuntado
aunque el servidor de la app se reinicie a mitad. Funciona igual en Mac, Windows y Linux."""
import subprocess, sys

log, fin, script, *args = sys.argv[1:]
codigo = 1
try:
    with open(log, "ab") as salida:
        codigo = subprocess.call([sys.executable, script, *args], stdout=salida, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
finally:
    with open(fin, "w", encoding="utf-8") as f:
        f.write(f"{codigo}\n")
