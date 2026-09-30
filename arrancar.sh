#!/bin/zsh
# Arranca Carrusel Creator Pro en http://localhost:3000
AQUI="${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$AQUI/app" || exit 1
[ -d node_modules ] || { echo "Primero ejecuta ./instalar.sh"; exit 1; }
( sleep 4 && open "http://localhost:3000" ) &
npm run dev
