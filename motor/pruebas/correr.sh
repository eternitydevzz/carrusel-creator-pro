#!/bin/sh
# Las pruebas ahora son correr.py (Mac, Windows y Linux). Este archivo queda por compatibilidad.
DIR="$(cd "$(dirname "$0")" && pwd)"
PY="$(command -v python3 || command -v python)"
exec "$PY" "$DIR/correr.py" "$@"
