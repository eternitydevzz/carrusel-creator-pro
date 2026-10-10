#!/bin/zsh
# Instala lo que hace falta para Carrusel Creator Pro en un Mac. Se puede ejecutar varias veces.
# En Windows se usa instalar.ps1.
set -e
AQUI="${0:A:h}"
echo "Carrusel Creator Pro · instalación"
[ "$(uname)" = "Darwin" ] || { echo "Este instalador es para Mac. En Windows usa instalar.ps1 (ver README)."; exit 1; }

if ! command -v brew >/dev/null; then
  echo "Falta Homebrew. Instálalo desde https://brew.sh y vuelve a ejecutar este script."; exit 1
fi
for f in node ffmpeg exiftool python3; do
  if command -v $f >/dev/null; then echo "  ✓ $f"; else echo "  → instalando $f"; brew install ${f/python3/python}; fi
done
NODE_MAJOR=$(node --version 2>/dev/null | sed 's/v\([0-9]*\).*/\1/'); [ "${NODE_MAJOR:-0}" -ge 20 ] || { echo "  ! Node $(node --version) es antiguo: la app necesita Node 20 o más (brew upgrade node)"; exit 1; }
# el motor es Python (motor/carrusel.py) y dibuja el pie con Pillow
if python3 -c "import PIL" 2>/dev/null; then echo "  ✓ Pillow"; else echo "  → instalando Pillow"; python3 -m pip install --user -q -r "$AQUI/motor/requirements.txt" || python3 -m pip install --user --break-system-packages -q -r "$AQUI/motor/requirements.txt"; fi
python3 -c "import pillow_heif" 2>/dev/null || python3 -m pip install --user -q pillow-heif 2>/dev/null || true  # opcional: fotos HEIC del iPhone
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
chmod +x "$AQUI"/motor/*.sh "$AQUI"/motor/*.py "$AQUI/arrancar.sh" 2>/dev/null || true

echo
if codex login status 2>&1 | grep -qi "logged in"; then echo "  ✓ Codex conectado"; else echo "  ! Codex sin sesión: ejecuta  codex login  (se abre el navegador)"; fi
echo
echo "Listo. Arranca con:  ./arrancar.sh   (se abre sola en http://carrusel.localhost:3000)"
echo "Primera vez: entra en Claude Code con  claude  , y en la app: Ajustes (clave de ScrapeCreators) y Branding (tus fotos y tu marca)."
echo "Opcional: instala la app desde Chrome y ejecuta  ./crear-lanzador.sh  para abrirla desde el Dock sin Terminal (enciende y apaga el servidor solo)."
