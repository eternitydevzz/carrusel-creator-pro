#!/bin/zsh
# Instala lo que hace falta para Carrusel Creator Pro en un Mac. Se puede ejecutar varias veces.
set -e
AQUI="${0:A:h}"
echo "Carrusel Creator Pro · instalación"
[ "$(uname)" = "Darwin" ] || { echo "Esto solo funciona en macOS (la plantilla usa Swift)."; exit 1; }

if ! command -v brew >/dev/null; then
  echo "Falta Homebrew. Instálalo desde https://brew.sh y vuelve a ejecutar este script."; exit 1
fi
for f in node ffmpeg exiftool; do
  if command -v $f >/dev/null; then echo "  ✓ $f"; else echo "  → instalando $f"; brew install $f; fi
done
NODE_MAJOR=$(node --version 2>/dev/null | sed 's/v\([0-9]*\).*/\1/'); [ "${NODE_MAJOR:-0}" -ge 20 ] || { echo "  ! Node $(node --version) es antiguo: la app necesita Node 20 o más (brew upgrade node)"; exit 1; }
if command -v swift >/dev/null; then echo "  ✓ swift"; else echo "  → instalando las herramientas de Xcode (Swift)"; xcode-select --install || true; echo "    Cuando termine la instalación de Xcode, vuelve a ejecutar este script."; exit 1; fi
# Versiones probadas con el motor (opciones como --ephemeral o --tools ""): una versión distinta puede romperlo.
CODEX_PROBADO="0.158.0"; CLAUDE_MIN="2.1"
if command -v codex >/dev/null; then
  v=$(codex --version 2>/dev/null | awk '{print $2}'); [ "$v" = "$CODEX_PROBADO" ] && echo "  ✓ codex $v" || echo "  ! codex $v: el motor está probado con $CODEX_PROBADO. Si falla al generar: npm install -g @openai/codex@$CODEX_PROBADO"
else echo "  → instalando Codex CLI $CODEX_PROBADO"; npm install -g @openai/codex@$CODEX_PROBADO; fi
if command -v claude >/dev/null || [ -x "$HOME/.local/bin/claude" ]; then echo "  ✓ claude $(claude --version 2>/dev/null | awk '{print $1}') (mínimo $CLAUDE_MIN)"; else echo "  → instalando Claude Code"; npm install -g @anthropic-ai/claude-code; fi

echo "  → dependencias de la app"
(cd "$AQUI/app" && npm install --silent)
mkdir -p "$AQUI/datos/marca/fotos" "$AQUI/datos/fichas" "$AQUI/datos/virales" "$AQUI/datos/salida"
[ -f "$AQUI/datos/marca/marca.txt" ] || cat > "$AQUI/datos/marca/marca.txt" <<'EOF'
handle: @tucuenta
azul: #1A79FB
angulo:
ropa: traje azul marino y camisa blanca, sin corbata
idioma: español. Se dice "AI", nunca "IA"
fotos:
tipografia:
pie: a la izquierda el handle y el lema; a la derecha botón "DESLIZA →" y el adelanto del siguiente slide; en el último, "+ SEGUIR"
lema:
tope_imagenes_dia: 60
EOF
[ -f "$AQUI/datos/CUENTA_ACTUAL.txt" ] || echo "cuenta1" > "$AQUI/datos/CUENTA_ACTUAL.txt"
chmod +x "$AQUI"/motor/*.sh "$AQUI"/motor/ficha.py "$AQUI/arrancar.sh" 2>/dev/null || true

echo
if codex login status 2>&1 | grep -qi "logged in"; then echo "  ✓ Codex conectado"; else echo "  ! Codex sin sesión: ejecuta  codex login  (se abre el navegador)"; fi
echo
echo "Listo. Arranca con:  ./arrancar.sh   y abre http://localhost:3000"
echo "Primera vez: entra en Claude Code con  claude  , y en la app: Ajustes (clave de ScrapeCreators) y Branding (tus fotos y tu marca)."
