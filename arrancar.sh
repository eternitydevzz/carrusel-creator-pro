#!/bin/zsh
# Arranca Carrusel Creator Pro en http://carrusel.localhost:3000
# (los nombres *.localhost llevan al propio Mac sin configurar nada; Chrome los abre directamente).
# Si la app está instalada desde Chrome ("Instalar Carrusel Creator Pro"), se abre en su ventana; si no, en Chrome.
AQUI="${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
URL="http://carrusel.localhost:3000"
cd "$AQUI/app" || exit 1
[ -d node_modules ] || { echo "Primero ejecuta ./instalar.sh"; exit 1; }

abrir() {
  # espera a que el servidor responda (hasta 90 s) en vez de un tiempo fijo
  local i; for i in {1..90}; do curl -s -o /dev/null --max-time 2 "http://localhost:3000/" && break; sleep 1; done
  local app="" d
  for d in "$HOME/Applications/Chrome Apps.localized" "$HOME/Applications/Chrome Apps"; do
    [ -d "$d/Carrusel Creator Pro.app" ] && { app="$d/Carrusel Creator Pro.app"; break; }
  done
  if [ -n "$app" ]; then open -a "$app"
  elif [ -d "/Applications/Google Chrome.app" ]; then open -a "Google Chrome" "$URL"
  else open "$URL"
  fi
}
( abrir ) &
echo "Carrusel Creator Pro → $URL (deja esta ventana abierta mientras uses la app)"
npm run dev
