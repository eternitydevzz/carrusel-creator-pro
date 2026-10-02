#!/bin/zsh
# Crea el icono "Carrusel Creator Pro" en ~/Applications: al abrirlo enciende el servidor y abre la app instalada
# desde Chrome; al cerrar la app (X o Cmd+Q) apaga el servidor. Así no hace falta ./arrancar.sh ni dejar la Terminal abierta.
#   ./crear-lanzador.sh            lo crea (o lo rehace, p. ej. si mueves la carpeta del repositorio)
#   ./crear-lanzador.sh --quitar   lo borra
# Requisito: la app instalada desde Chrome ("Instalar Carrusel Creator Pro" en carrusel.localhost:3000).
set -e
AQUI="${0:A:h}"
DESTINO="$HOME/Applications/Carrusel Creator Pro.app"

if [ "${1:-}" = "--quitar" ]; then
  rm -rf "$DESTINO" && echo "Quitado: $DESTINO (quítalo también del Dock si lo pusiste)"; exit 0
fi
[ "$(uname)" = "Darwin" ] || { echo "Esto solo funciona en macOS."; exit 1; }
[ -d "$AQUI/app/node_modules" ] || { echo "Primero ejecuta ./instalar.sh"; exit 1; }

# la app que instala Chrome (su nombre de paquete cambia en cada Mac: se busca por su nombre)
PWA=""
for d in "$HOME/Applications/Chrome Apps.localized" "$HOME/Applications/Chrome Apps"; do
  [ -d "$d/Carrusel Creator Pro.app" ] && { PWA="$d/Carrusel Creator Pro.app"; break; }
done
if [ -z "$PWA" ]; then
  echo "Falta instalar la app desde Chrome:"
  echo "  1. ./arrancar.sh  (se abre http://carrusel.localhost:3000 en Chrome)"
  echo "  2. En la barra de direcciones, icono de Instalar (o menú ⋮ → Transmitir, guardar y compartir → Instalar página como aplicación)"
  echo "  3. Vuelve a ejecutar ./crear-lanzador.sh"
  exit 1
fi

rm -rf "$DESTINO"; mkdir -p "$DESTINO/Contents/MacOS" "$DESTINO/Contents/Resources"

# icono: el logo de Código MaestrIA de la app, en todos los tamaños que pide macOS
TMP="$(mktemp -d)"; SET="$TMP/app.iconset"; mkdir -p "$SET"
for t in 16 32 128 256 512; do
  sips -z $t $t "$AQUI/app/public/icon-512.png" --out "$SET/icon_${t}x${t}.png" >/dev/null
  sips -z $((t*2)) $((t*2)) "$AQUI/app/public/icon-512.png" --out "$SET/icon_${t}x${t}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$DESTINO/Contents/Resources/app.icns"; rm -rf "$TMP"

cat > "$DESTINO/Contents/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Carrusel Creator Pro</string>
  <key>CFBundleDisplayName</key><string>Carrusel Creator Pro</string>
  <key>CFBundleIdentifier</key><string>com.codigomaestria.carrusel.lanzador</string>
  <key>CFBundleExecutable</key><string>lanzador</string>
  <key>CFBundleIconFile</key><string>app</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
EOF

# el lanzador: la ruta del repositorio va escrita dentro (si mueves la carpeta, vuelve a ejecutar este script)
{ echo '#!/bin/zsh'; echo "APP_DIR=${(qq)AQUI}/app"; cat <<'EOF'
# Lanzador de Carrusel Creator Pro (lo crea crear-lanzador.sh): enciende el servidor, abre la app instalada desde Chrome
# y, cuando la cierras, apaga el servidor (solo si lo encendió él). Sin ventana ni icono propio (LSUIElement).
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
LOG="$HOME/Library/Logs/carrusel-creator-pro.log"
CANDADO="${TMPDIR:-/tmp}/carrusel-lanzador.pid"
apunta() { echo "$(date '+%F %T') $*" >> "$LOG"; }
responde() { curl -s -o /dev/null --max-time 2 "http://localhost:3000/"; }
aviso() { osascript -e "display alert \"Carrusel Creator Pro\" message \"$1\" as critical" >/dev/null 2>&1; }
# apaga un proceso y todos sus hijos (npm → next dev → next-server)
apagar() { local h; for h in $(pgrep -P "$1"); do apagar "$h"; done; kill -"${2:-TERM}" "$1" 2>/dev/null; }

PWA=""
for d in "$HOME/Applications/Chrome Apps.localized" "$HOME/Applications/Chrome Apps"; do
  [ -d "$d/Carrusel Creator Pro.app" ] && { PWA="$d/Carrusel Creator Pro.app"; break; }
done
[ -n "$PWA" ] || { aviso "No encuentro la app instalada desde Chrome. Instálala desde http://carrusel.localhost:3000 y vuelve a ejecutar ./crear-lanzador.sh"; exit 1; }
[ -d "$APP_DIR" ] || { aviso "No encuentro el repositorio en $APP_DIR. Si lo moviste, vuelve a ejecutar ./crear-lanzador.sh"; exit 1; }
PWA_PROC="$PWA/Contents/MacOS/app_mode_loader"

# si ya hay un lanzador vigilando (la app ya está abierta), solo se trae la app al frente
if [ -f "$CANDADO" ] && kill -0 "$(cat "$CANDADO")" 2>/dev/null; then open -a "$PWA"; exit 0; fi
echo $$ > "$CANDADO"; trap 'rm -f "$CANDADO"' EXIT

SERVIDOR=""
if ! responde; then
  apunta "enciendo el servidor"
  ( cd "$APP_DIR" && exec npm run dev ) >> "$LOG" 2>&1 &
  SERVIDOR=$!
  for i in {1..90}; do responde && break; sleep 1; done
  if ! responde; then apunta "el servidor no respondió en 90 s"; apagar "$SERVIDOR"
    aviso "El servidor no arrancó. Mira el registro en ~/Library/Logs/carrusel-creator-pro.log"; exit 1; fi
else
  apunta "el servidor ya estaba encendido: no lo toco"
fi

open -a "$PWA"
# espera a que la app se abra (hasta 30 s) y después a que se cierre
for i in {1..30}; do pgrep -f "$PWA_PROC" >/dev/null && break; sleep 1; done
while pgrep -f "$PWA_PROC" >/dev/null; do sleep 2; done
apunta "app cerrada"
if [ -n "$SERVIDOR" ]; then
  apagar "$SERVIDOR"; for i in {1..10}; do responde || break; sleep 1; done
  responde && { apagar "$SERVIDOR" KILL; sleep 1; }
  responde && apunta "AVISO: el servidor sigue respondiendo" || apunta "servidor apagado"
fi
EOF
} > "$DESTINO/Contents/MacOS/lanzador"
chmod +x "$DESTINO/Contents/MacOS/lanzador"
touch "$DESTINO"

echo "Listo: $DESTINO"
echo "Ponlo en el Dock (arrástralo desde el Finder) y quita el icono que instaló Chrome: clic derecho → Opciones → Quitar del Dock."
echo "Ábrela siempre desde ese icono. Al cerrarla, el servidor se apaga solo. Registro: ~/Library/Logs/carrusel-creator-pro.log"
open -R "$DESTINO" 2>/dev/null || true
