#!/bin/zsh
# Carruseles Top · un solo script para toda la cadena.
#
#   carrusel.sh bajar <url_instagram> <nombre>      descarga los slides del carrusel original a virales/<nombre>/
#   carrusel.sh nueva <nombre> <N>                  crea la ficha vacía en fichas/<nombre>.md
#   carrusel.sh ficha_ia <nombre>                   Claude Code redacta la ficha mirando los slides del original (tokens, no imágenes)
#   carrusel.sh comprobar <nombre>                  comprueba la ficha (sin gastar nada)
#   carrusel.sh generar <nombre>                    comprueba, monta el prompt, genera con Codex, recorta, estampa y hace la hoja
#   carrusel.sh corregir <nombre> <n> "<cambio>"    corrige un slide editándolo y lo vuelve a estampar (1 imagen)
#   carrusel.sh revisar <nombre>                    hoja del carrusel y tira de pies, para revisar
#   carrusel.sh cerrar <nombre>                     JPG limpios sin metadatos; borra el material de trabajo y las copias de Codex
#   carrusel.sh descripcion <nombre>                Claude Code escribe la descripción de Instagram en salida/<nombre>/descripcion.txt
#   carrusel.sh encoger <nombre> <n> [factor] [y]  encoge la escena (0.92; y = px que baja) para no pisar pie ni contador; 0 imágenes
#   carrusel.sh variaciones <nombre>                5 variaciones de esa descripción (otro gancho y enfoque) en salida/<nombre>/variaciones.txt
#   carrusel.sh cupo                                imágenes gastadas en 24 h por la cuenta actual
#
# Variables opcionales:  ENSAYO=1 (no llama a Codex)   FORZAR=1 (salta el cupo)   RECOGER_SID=<id> (recoge una sesión ya hecha)
#                        PERFIL=<cliente> (por defecto, el cliente activo en la app)
set -u
AQUI="${0:A:h}"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
DATOS="${DATOS:-${AQUI:h}/datos}"; export DATOS
# Cliente (perfil): la variable PERFIL o el activo en ajustes.json. Cada cliente tiene su carpeta en perfiles/
# con su marca, fichas, originales y carruseles. Lo compartido (cupo de Codex, clave, ajustes) queda en DATOS.
# Sin perfiles (datos de antes de la migración) se usa la propia carpeta de datos.
PERFIL="${PERFIL:-$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('perfil_activo',''))" "$DATOS/ajustes.json" 2>/dev/null)}"
if [[ -n "$PERFIL" && ! "$PERFIL" =~ '^[a-z0-9_-]+$' ]]; then echo "Nombre de cliente no válido: $PERFIL"; exit 64; fi
if [ -n "$PERFIL" ] && [ -d "$DATOS/perfiles/$PERFIL" ]; then DATOS_PERFIL="$DATOS/perfiles/$PERFIL"; else DATOS_PERFIL="$DATOS"; fi
export PERFIL DATOS_PERFIL
MARCA="$DATOS_PERFIL/marca"; FICHAS="$DATOS_PERFIL/fichas"; VIRALES="$DATOS_PERFIL/virales"; SALIDA="$DATOS_PERFIL/salida"
GEN="${GEN:-$HOME/.codex/generated_images}"
CUPO="$DATOS/CUPO.csv"; ESTADO="$DATOS_PERFIL/ESTADO.md"
CUENTA="$(head -1 "$DATOS/CUENTA_ACTUAL.txt" 2>/dev/null)"; CUENTA="${CUENTA:-sin_nombre}"
# clave de ScrapeCreators: variable de entorno o datos/ajustes.json
[ -z "${SCRAPECREATORS_API_KEY:-}" ] && [ -f "$DATOS/ajustes.json" ] && export SCRAPECREATORS_API_KEY="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('scrapecreators_key',''))" "$DATOS/ajustes.json" 2>/dev/null)"
dato() { grep -m1 "^$1:" "$MARCA/marca.txt" | cut -d: -f2- | sed 's/^ *//'; }
TOPE="$(dato tope_imagenes_dia)"; TOPE="${TOPE:-60}"
export PIE_HANDLE="$(dato handle)"
export PIE_LEMA="$(dato lema)"
MODELO="gpt-5.5"; ESFUERZO="medium"

# ---------- utilidades ----------
ajustar_4x5() {  # <origen> <destino>: deja la imagen en 4:5 recortando, nunca estirando
  local src="$1" dst="$2" w h nw nh
  w=$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}'); h=$(sips -g pixelHeight "$src" | awk '/pixelHeight/{print $2}')
  [ -z "$w" ] || [ -z "$h" ] && return 1
  if [ $((w*5)) -lt $((h*4)) ]; then nw=$w; nh=$((w*5/4)); else nh=$h; nw=$((h*4/5)); fi
  sips -c $nh $nw "$src" --out "$dst" >/dev/null && sips -z 1350 1080 "$dst" >/dev/null
}
capa() {  # <n> <N> → ruta de la capa transparente con contador y pie
  # el adelanto del pie (casilla 'siguiente' del slide) cambia por carrusel: va en el nombre de la capa (huella corta)
  export PIE_SIGUIENTE=""; [ -n "${PIE_FICHA:-}" ] && PIE_SIGUIENTE="$(python3 "$AQUI/ficha.py" campo "$PIE_FICHA" "$1" siguiente)"
  local huella=$(printf '%s|%s' "$PIE_LEMA" "$PIE_SIGUIENTE" | md5 | cut -c1-8)
  local f="$DATOS/capas/capa_${1}de${2}_${PIE_HANDLE//[@.]/}${PIE_ESTILO:+_$PIE_ESTILO}_$huella.png"
  mkdir -p "$DATOS/capas"
  [ -f "$f" ] || swift "$AQUI/plantilla/plantilla.swift" "$1" "$2" "$f" >/dev/null || { echo "FALLO al dibujar la capa $1"; exit 1; }
  echo "$f"
}
guia_zonas() {  # <N> → imagen con fondo que enseña dónde van el contador y el pie (referencia para Codex)
  export PIE_SIGUIENTE="SIGUIENTE: / ADELANTO DEL SLIDE"  # en la guía solo enseña cuánto ocupa el pie
  local f="$DATOS/capas/guia_zonas_${1}_${PIE_HANDLE//[@.]/}${PIE_ESTILO:+_$PIE_ESTILO}_pie2.png"
  mkdir -p "$DATOS/capas"
  [ -f "$f" ] || swift "$AQUI/plantilla/plantilla.swift" 1 "$1" "$f" fondo >/dev/null || { echo "FALLO al dibujar la guía de zonas"; exit 1; }
  echo "$f"
}
estampar() {  # <carpeta> <n> <N>: estampa contador y pie sobre _sin_pie/n.png → n.png
  local out="$1" n="$2" N="$3"
  ffmpeg -y -loglevel error -i "$out/_sin_pie/$n.png" -i "$(capa $n $N)" -filter_complex "[0][1]overlay=0:0:format=auto,format=rgb24" "$out/$n.png"
}
anotar_cupo() {  # <carrusel> <tipo> <imagenes> <tokens>
  [ -f "$CUPO" ] || echo "fecha;hora;epoch;cuenta;carrusel;tipo;imagenes;tokens" > "$CUPO"
  echo "$(date +%F);$(date +%H:%M);$(date +%s);$CUENTA;$1;$2;$3;$4" >> "$CUPO"
}
gastadas_24h() { [ -f "$CUPO" ] || { echo 0; return; }; awk -F';' -v c="$CUENTA" -v t="$(( $(date +%s) - 86400 ))" 'NR>1 && $4==c && $3>=t {s+=$7} END{print s+0}' "$CUPO"; }
hay_cupo() {  # <imagenes que se van a pedir>
  local g=$(gastadas_24h)
  if [ $((g + $1)) -gt $TOPE ] && [ "${FORZAR:-0}" != "1" ]; then
    echo "SIN_CUPO: la cuenta '$CUENTA' lleva $g imágenes en 24 h y se piden $1 (tope $TOPE). No se lanza."; return 1
  fi
}
imagenes_de_sesion() { find "$GEN/$1" -type f -name '*.png' -print0 2>/dev/null | xargs -0 ls -tr 2>/dev/null; }
siguiente_log() { local k=1; while [ -e "$1/_logs/${2}_$k.log" ]; do k=$((k+1)); done; echo "$1/_logs/${2}_$k.log"; }
refs_marca() {  # rutas completas de las fotos de la marca, en orden
  # fotos del personaje y después las referencias de estilo (1 a 3): el mismo orden que describe ficha.py en el prompt
  local f; for f in ${(s:,:)"$(dato fotos)"} ${(s:,:)"$(dato tipografia)"}; do f="${f## }"; f="${f%% }"; [ -n "$f" ] && echo "$MARCA/$f"; done
}
llamar_codex() {  # <carpeta_trabajo> <prompt> <log> <ref>...  → escribe el log; devuelve el código de salida de codex
  local dir="$1" prompt="$2" log="$3"; shift 3
  local IMGS=(); for f in "$@"; do [ -f "$f" ] || { echo "FALTA_REFERENCIA: $f · Sube tus fotos y la referencia de estilo en Branding antes de generar."; return 5; }; IMGS+=(-i "${f:A}"); done
  if [ "${ENSAYO:-0}" = "1" ]; then echo "ENSAYO: no se llama a Codex. Prompt: $prompt · Referencias:"; printf '  %s\n' "${IMGS[@]}" | grep -v '^  -i$'; return 0; fi
  # El prompt entra por stdin. No se pone "-" al final: -i lo leería como una imagen.
  cat "$prompt" | codex exec --ephemeral --ignore-user-config --skip-git-repo-check -s read-only -C "$dir" \
    -m "$MODELO" -c model_reasoning_effort="$ESFUERZO" "${IMGS[@]}" > "$log" 2>&1
}
ficha_de() { echo "$FICHAS/$1.md"; }
cab() { grep -m1 "^$2:" "$(ficha_de "$1")" | cut -d: -f2- | sed 's/^ *//'; }

# ---------- órdenes ----------
cmd_bajar() {  # <url> <nombre>
  local url="$1" nombre="$2"; local dest="$VIRALES/$nombre"
  local key="${SCRAPECREATORS_API_KEY:-$(grep -m1 SCRAPECREATORS_API_KEY ~/.config/last30days/.env 2>/dev/null | cut -d= -f2- | tr -d '"')}"
  [ -n "$key" ] || { echo "Falta SCRAPECREATORS_API_KEY"; exit 1; }
  mkdir -p "$dest"
  SC_KEY="$key" python3 - "$url" "$dest" <<'EOF'
import json, os, sys, urllib.request, urllib.parse
url, dest = sys.argv[1], sys.argv[2]
k = os.environ["SC_KEY"]
q = urllib.parse.urlencode({"url": url, "include_play_count": "false"})
r = urllib.request.Request("https://api.scrapecreators.com/v1/instagram/post?" + q, headers={"x-api-key": k})
d = json.load(urllib.request.urlopen(r, timeout=120)); d = d.get("data") or d
m = d.get("xdt_shortcode_media") or {}
if not m: raise SystemExit("La API no devolvió el post: " + str(d)[:300])
kids = [e["node"] for e in m.get("edge_sidecar_to_children", {}).get("edges", [])] or [m]
def bajar(u, p):
    rq = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(rq, timeout=120) as s, open(p, "wb") as f: f.write(s.read())
n = 0
for i, kd in enumerate(kids, 1):
    if kd.get("is_video"): continue
    res = sorted(kd.get("display_resources") or [], key=lambda x: x.get("config_width", 0))
    bajar(res[-1]["src"] if res else kd["display_url"], f"{dest}/slide_{i:02d}.jpg"); n += 1
cap = (m.get("edge_media_to_caption", {}).get("edges") or [{}])[0].get("node", {}).get("text", "")
user = (m.get("owner") or {}).get("username", "")
likes = (m.get("edge_media_preview_like") or {}).get("count", "")
com = (m.get("edge_media_to_parent_comment") or m.get("edge_media_preview_comment") or {}).get("count", "")
open(f"{dest}/info.txt", "w").write(f"URL: {url}\nCuenta: @{user}\nComentarios: {com}\nLikes: {likes}\nSlides: {n}\n\nTexto:\n{cap}\n")
print(f"{n} slides descargados en {dest}")
EOF
  for f in "$dest"/slide_*.jpg; do sips -s format jpeg "$f" --out "$f" >/dev/null 2>&1; done
  echo "Siguiente paso: mirar los slides, escribir virales/$nombre/descripcion.md y la ficha (carrusel.sh nueva $nombre <N>)."
}

cmd_nueva() { python3 "$AQUI/ficha.py" nueva "$1" "$2" "$VIRALES/$1"; }

cmd_ficha_ia() {  # <nombre>: Claude Code (con la sesión del usuario) redacta la ficha mirando los slides del original. Tokens, no imágenes.
  local nombre="$1" V="$VIRALES/$1" F="$FICHAS/$1.md"
  [ -d "$V" ] || { echo "No existe el original en $V. Primero: carrusel.sh bajar <url> $nombre"; exit 1; }
  local N=$(ls "$V" | grep -c -E '^slide_[0-9]+\.jpg$'); [ "$N" -gt 0 ] || { echo "No hay slides en $V"; exit 1; }
  local CLAUDE="$(command -v claude || true)"; [ -z "$CLAUDE" ] && [ -x "$HOME/.local/bin/claude" ] && CLAUDE="$HOME/.local/bin/claude"
  [ -n "$CLAUDE" ] || { echo "Falta Claude Code. Instálalo (npm install -g @anthropic-ai/claude-code) y entra con: claude"; exit 1; }
  local IDIOMA="$(dato idioma)"; local ANGULO="$(dato angulo)"
  local P="$V/_prompt_ficha.txt"
  sed -e "s|{HANDLE}|$PIE_HANDLE|g" -e "s|{ANGULO}|$ANGULO|g" -e "s|{IDIOMA}|${IDIOMA:-español}|g" -e "s|{NOMBRE}|$nombre|g" -e "s|{N}|$N|g" -e "s|{VIRAL}|$V|g" "$AQUI/PROMPT_FICHA.txt" > "$P"
  { cat "$P"; echo; echo "Los slides del carrusel original están en estos archivos, en orden. Ábrelos con la herramienta Read y lee con cuidado todo su texto (nombres, cifras y pasos tienen que ser exactos) antes de escribir la ficha:"; for f in "$V"/slide_*.jpg; do echo "${f:A}"; done; echo; echo "Responde SOLO con la ficha, sin explicaciones ni marcas de código."; } > "$V/_prompt_ficha_enviado.txt"
  mkdir -p "$V/_logs"; local LOG=$(siguiente_log "$V" ficha)
  if [ "${ENSAYO:-0}" = "1" ]; then echo "ENSAYO: no se llama a Claude. Prompt: $V/_prompt_ficha_enviado.txt"; exit 0; fi
  "$CLAUDE" -p --allowedTools "Read" --output-format text < "$V/_prompt_ficha_enviado.txt" > "$LOG" 2>"$LOG.err"; local RC=$?
  [ $RC -eq 0 ] || { echo "Claude falló (exit $RC): $(head -c 300 "$LOG.err")"; exit 1; }
  python3 - "$LOG" "$F" <<'PY'
import sys,re
t=open(sys.argv[1],encoding="utf-8",errors="ignore").read()
t=re.sub(r"```\w*","",t)
i=t.find("carrusel:")
if i<0: raise SystemExit("Claude no devolvió una ficha. Ver "+sys.argv[1])
t=t[i:].strip()
open(sys.argv[2],"w",encoding="utf-8").write(t+"\n")
print("Ficha escrita en",sys.argv[2],"·",t.count("\n## "),"slides")
PY
  [ $? -eq 0 ] || exit 1
  anotar_cupo "$nombre" ficha_ia 0 "claude"
  python3 "$AQUI/ficha.py" comprobar "$F" || echo "La ficha tiene avisos: revísala antes de generar."
  echo "OK ficha_ia $nombre (Claude Code)"
}

cmd_comprobar() { [ -f "$(ficha_de "$1")" ] || { echo "No existe la ficha \"$1\" en el cliente ${PERFIL:-actual}"; exit 1; }; python3 "$AQUI/ficha.py" comprobar "$(ficha_de "$1")"; }

cmd_hojas() {  # <carpeta_viral> <destino>: hojas de 6 slides del original
  local V="$1" O="$2"; mkdir -p "$O"; local N=$(ls "$V" | grep -c -E '^slide_[0-9]+\.jpg$') H=0 INI=1
  while [ $INI -le $N ]; do H=$((H+1))
    ffmpeg -y -loglevel error -start_number $INI -i "$V/slide_%02d.jpg" -frames:v 1 -vf "scale=540:675:force_original_aspect_ratio=increase,crop=540:675,setsar=1,tile=3x2" "$O/viral_hoja_$H.jpg" || return 1
    INI=$((INI+6)); done
  echo $H
}

cmd_generar() {  # <nombre>
  local nombre="$1" F="$(ficha_de "$1")"; [ -f "$F" ] || { echo "No existe la ficha $F"; exit 1; }
  python3 "$AQUI/ficha.py" comprobar "$F" || exit 1
  local N=$(cab "$nombre" slides) V=$(cab "$nombre" viral) OUT="$SALIDA/$nombre"
  # la ficha guarda la ruta del original; si ya no existe (datos movidos), se busca en la carpeta del cliente
  [ -n "$V" ] && [ ! -d "$V" ] && [ -d "$VIRALES/${V:t}" ] && V="$VIRALES/${V:t}"
  mkdir -p "$OUT/_logs" "$OUT/_sin_pie" "$OUT/_viral"
  local H=0
  if [ -d "$V" ]; then H=$(cmd_hojas "$V" "$OUT/_viral") || { echo "FALLO al hacer las hojas del viral"; exit 1; }; fi
  python3 "$AQUI/ficha.py" prompt "$F" "$OUT/_prompt.txt" "$H" || exit 1
  { cat "$OUT/_prompt.txt"; echo; echo "INSTRUCCIÓN TÉCNICA: crea el carrusel completo, los $N slides en orden, en esta misma respuesta. No ejecutes comandos ni añadas texto con código. Al terminar responde solo 'ok'."; } > "$OUT/_prompt_enviado.txt"
  local REFS=("${(@f)$(refs_marca)}"); [ "$H" -gt 0 ] && for h in $(seq 1 $H); do REFS+=("$OUT/_viral/viral_hoja_$h.jpg"); done
  REFS+=("$(guia_zonas $N)")
  local SID TOK LIM=0 RC=0 LOG
  if [ -n "${RECOGER_SID:-}" ]; then SID="$RECOGER_SID"; TOK="-"
  else
    hay_cupo "$N" || exit 3
    LOG=$(siguiente_log "$OUT" carrusel)
    llamar_codex "$OUT" "$OUT/_prompt_enviado.txt" "$LOG" "${REFS[@]}"; RC=$?
    [ $RC -eq 5 ] && exit 5
    [ "${ENSAYO:-0}" = "1" ] && { echo "ENSAYO terminado: prompt en $OUT/_prompt_enviado.txt"; exit 0; }
    TOK=$(grep -A1 'tokens used' "$LOG" | tail -1)
    grep -q -i -E "usage limit|usage_limit_reached" "$LOG" && LIM=1
    SID=$(grep -m1 "session id:" "$LOG" | awk '{print $3}'); [ -z "$SID" ] && { echo "FALLO: sin session id · ver $LOG"; exit 1; }
    echo "$SID" >> "$OUT/_logs/sesiones.txt"
  fi
  local FILES=("${(@f)$(imagenes_de_sesion "$SID")}"); FILES=(${FILES:#}); local K=${#FILES}
  [ -z "${RECOGER_SID:-}" ] && anotar_cupo "$nombre" carrusel "$K" "$TOK"
  if [ $K -gt $N ]; then mkdir -p "$OUT/_revisar"; local i=0; for f in "${FILES[@]}"; do i=$((i+1)); ajustar_4x5 "$f" "$OUT/_revisar/orden_$(printf '%02d' $i).png"; done
    echo "SOBRAN: Codex generó $K imágenes para $N slides. Están en $OUT/_revisar/ sin numerar. Míralas y numéralas a mano."; exit 4; fi
  local i=0; for f in "${FILES[@]}"; do i=$((i+1)); ajustar_4x5 "$f" "$OUT/_sin_pie/$i.png" || exit 1; estampar "$OUT" $i $N || exit 1; done
  [ $LIM -eq 1 ] && { echo "LIMITE_DE_USO tras $i de $N slides · tokens: $TOK"; exit 2; }
  [ $i -lt $N ] && { echo "INCOMPLETO: $i/$N slides (codex exit $RC) · tokens: $TOK · ver $LOG"; exit 1; }
  cmd_revisar "$nombre"
  echo "OK carrusel $nombre: $N/$N slides · tokens: $TOK · imágenes: $K · cuenta '$CUENTA': $(gastadas_24h) en 24 h"
}

cmd_corregir() {  # <nombre> <n> "<cambio>"
  local nombre="$1" n="$2" cambio="$3" OUT="$SALIDA/$1"; local N=$(cab "$nombre" slides)
  [ -f "$OUT/_sin_pie/$n.png" ] || { echo "No existe $OUT/_sin_pie/$n.png"; exit 1; }
  hay_cupo 1 || exit 3
  mkdir -p "$OUT/_versiones" "$OUT/_correcciones"
  local k=1; while [ -e "$OUT/_versiones/${n}_v$k.png" ]; do k=$((k+1)); done
  local P="$OUT/_correcciones/slide_${n}_v$k.txt"
  # Cada corrección lleva las fotos del personaje: al editar, la cara pierde calidad copia a copia si no tiene la referencia.
  # solo fotos del personaje (1 o 2): con una sola foto, la "segunda" era la referencia de estilo y Codex la tomaba por la cara
  local FOTOS=() f; for f in ${(s:,:)"$(dato fotos)"}; do f="${f## }"; f="${f%% }"; [ -n "$f" ] && FOTOS+=("$MARCA/$f"); done
  FOTOS=(${FOTOS[1,2]})  # sin comillas: con la lista vacía no deja un elemento vacío (zsh no parte por espacios)
  [ ${#FOTOS} -gt 0 ] || { echo "FALTA_MARCA: este cliente no tiene fotos del personaje. Súbelas en Branding."; exit 1; }
  local QUIEN="La imagen 2 es una foto del personaje: su cara tiene que quedar exactamente como en esa foto"
  [ ${#FOTOS} -ge 2 ] && QUIEN="Las imágenes 2 y 3 son fotos del personaje: su cara tiene que quedar exactamente como en esas fotos"
  printf 'Edita la imagen 1 (slide de un carrusel de Instagram, 4:5). %s, nítida y con sus rasgos, aunque el resto del slide no cambie.\nMantén todo lo demás exactamente igual: pose, ropa, fondo, titular y textos.\nÚnico cambio: %s\nNo añadas ningún texto ni elemento nuevo. No pongas contador ni pie.\n\nINSTRUCCIÓN TÉCNICA: no leas skills ni archivos y no ejecutes ningún comando. Llama UNA sola vez a la herramienta de generación de imágenes con todo lo anterior y termina respondiendo solo '"'"'ok'"'"'.\n' "$QUIEN" "$cambio" > "$P"
  local LOG=$(siguiente_log "$OUT" "slide_$n")
  llamar_codex "$OUT" "$P" "$LOG" "$OUT/_sin_pie/$n.png" "${FOTOS[@]}"; local RC=$?
  [ $RC -eq 5 ] && exit 5
  [ "${ENSAYO:-0}" = "1" ] && exit 0
  local TOK=$(grep -A1 'tokens used' "$LOG" | tail -1) SID=$(grep -m1 "session id:" "$LOG" | awk '{print $3}')
  [ -z "$SID" ] && { echo "FALLO: sin session id · ver $LOG"; exit 1; }
  echo "$SID" >> "$OUT/_logs/sesiones.txt"
  local FILES=("${(@f)$(imagenes_de_sesion "$SID")}"); FILES=(${FILES:#})
  anotar_cupo "$nombre" "slide_$n" "${#FILES}" "$TOK"
  [ ${#FILES} -eq 0 ] && { grep -q -i -E "usage limit|usage_limit_reached" "$LOG" && echo "LIMITE_DE_USO" || echo "FALLO slide $n (exit $RC) · ver $LOG"; exit 1; }
  cp "$OUT/_sin_pie/$n.png" "$OUT/_versiones/${n}_v$k.png"
  ajustar_4x5 "${FILES[-1]}" "$OUT/_sin_pie/$n.png" && estampar "$OUT" $n $N && cmd_revisar "$nombre" >/dev/null
  echo "OK slide $n corregido · tokens: $TOK · versión anterior en _versiones/${n}_v$k.png · cuenta '$CUENTA': $(gastadas_24h) en 24 h"
}

cmd_revisar() {  # <nombre>: hoja + tira de pies
  local OUT="$SALIDA/$1" N=$(cab "$1" slides); local cols=$(( N > 6 ? 6 : N )) rows=$(( (N + 5) / 6 ))
  ffmpeg -y -loglevel error -start_number 1 -i "$OUT/%d.png" -frames:v 1 -vf "scale=360:450,tile=${cols}x${rows}" "$OUT/_hoja.jpg"
  ffmpeg -y -loglevel error -start_number 1 -i "$OUT/%d.png" -frames:v 1 -vf "crop=1080:170:0:1180,scale=540:85,tile=1x${N}" "$OUT/_pies.jpg"
  echo "Revisión: $OUT/_hoja.jpg y $OUT/_pies.jpg"
}

cmd_cerrar() {  # <nombre>: solo tras el ok del usuario. Usa la skill adaptar-para-subir para dejar los JPG listos.
  local nombre="$1" OUT="$SALIDA/$1" N=$(cab "$1" slides)
  local ADAPTAR="$AQUI/adaptar.sh"
  for n in $(seq 1 $N); do [ -f "$OUT/$n.png" ] || { echo "Falta $OUT/$n.png"; exit 1; }; done
  local SIDS=$(cat "$OUT/_logs/sesiones.txt" 2>/dev/null | tr '\n' ' ')
  # fuera todo lo que no es un slide, para que la skill solo toque los N PNG
  rm -rf "$OUT"/_sin_pie "$OUT"/_versiones "$OUT"/_viral "$OUT"/_logs "$OUT"/_correcciones "$OUT"/_revisar "$OUT"/_hoja.jpg "$OUT"/_pies.jpg "$OUT"/_prompt.txt "$OUT"/.DS_Store
  local AVISO=""
  # ubicación de los metadatos: la del cliente (perfil.json); si no tiene, la de ajustes.json; si no, Newark
  local UBI=("${(@f)$(python3 -c "import json,sys,os
u={}
for p in sys.argv[1:]:
  if os.path.isfile(p):
    u=json.load(open(p)).get('ubicacion') or {}
    if u: break
print('\\n'.join(['--ciudad',u.get('ciudad','Newark'),'--estado',u.get('estado','New Jersey'),'--pais',u.get('pais','United States'),'--codigo',u.get('codigo','US'),'--lat',str(u.get('lat',40.7357)),'--lon',str(u.get('lon',-74.1724))]))" "$DATOS_PERFIL/perfil.json" "$DATOS/ajustes.json")}")
  bash "$ADAPTAR" "$OUT" "${UBI[@]}" || AVISO="ATENCIÓN: la skill avisó de rastros en algún JPG. Comprobar con: grep -aioE 'c2pa|openai|sora' <archivo>. Un 'sORA' suelto dentro de los bytes de la imagen es casualidad: se recodifica ese JPG con calidad 91 y se vuelve a limpiar."
  for n in $(seq 1 $N); do [ -f "$OUT/$n.jpg" ] || { echo "Falta $OUT/$n.jpg tras adaptar"; exit 1; }; done
  [ -z "$AVISO" ] && rm -rf "${OUT}_originales"   # los PNG con C2PA no se guardan; si hubo aviso, se dejan hasta revisar
  local borradas=0; for s in $(echo $SIDS); do [ -d "$GEN/$s" ] && { borradas=$((borradas+$(ls "$GEN/$s" | wc -l))); rm -rf "$GEN/$s"; }; done
  local gastadas=$(awk -F';' -v c="$nombre" 'NR>1 && $5==c {s+=$7} END{print s+0}' "$CUPO")
  [ -f "$ESTADO" ] || printf '# Estado de los carruseles\n\n| Carrusel | Fecha | Slides | Imágenes gastadas | Notas |\n|---|---|---|---|---|\n' > "$ESTADO"
  echo "| $nombre | $(date +%F) | $N | $gastadas | cerrado |" >> "$ESTADO"
  echo "CERRADO $nombre: $N JPG listos para subir en $OUT · imágenes gastadas en total: $gastadas · copias de Codex borradas: $borradas"
  # sin aviso, el [ -n ] devolvía 1 y la app marcaba el cierre como fallido aunque todo hubiera ido bien
  [ -n "$AVISO" ] && echo "$AVISO"
  return 0
}

cmd_descripcion() {  # <nombre>: Claude Code (con la sesión del usuario) escribe la descripción de Instagram. Tokens, no imágenes.
  local nombre="$1" F="$(ficha_de "$1")" OUT="$SALIDA/$1"
  [ -f "$F" ] || { echo "No existe la ficha $F"; exit 1; }
  mkdir -p "$OUT/_logs"
  local CLAUDE="$(command -v claude || true)"; [ -z "$CLAUDE" ] && [ -x "$HOME/.local/bin/claude" ] && CLAUDE="$HOME/.local/bin/claude"
  [ -n "$CLAUDE" ] || { echo "Falta Claude Code. Instálalo (npm install -g @anthropic-ai/claude-code) y entra con: claude"; exit 1; }
  local P="$OUT/_logs/prompt_descripcion.txt"
  python3 "$AQUI/ficha.py" prompt_descripcion "$F" "$P" || exit 1
  if [ "${ENSAYO:-0}" = "1" ]; then echo "ENSAYO: no se llama a Claude. Prompt: $P"; exit 0; fi
  local LOG=$(siguiente_log "$OUT" descripcion)
  # sin herramientas: todo lo que necesita va en el prompt
  "$CLAUDE" -p --tools "" --output-format text < "$P" > "$LOG" 2>"$LOG.err"; local RC=$?
  [ $RC -eq 0 ] || { echo "Claude falló (exit $RC): $(head -c 300 "$LOG.err")"; exit 1; }
  python3 - "$LOG" "$OUT/_descripcion_nueva.txt" <<'PY'
import sys,re
t=open(sys.argv[1],encoding="utf-8",errors="ignore").read()
t=re.sub(r"```\w*","",t).strip()
if not t: raise SystemExit("Claude no devolvió texto. Ver "+sys.argv[1])
open(sys.argv[2],"w",encoding="utf-8").write(t+"\n")
PY
  [ $? -eq 0 ] || exit 1
  # solo se guarda si pasa la comprobación; si no, la anterior (si la hay) se queda como estaba
  python3 "$AQUI/ficha.py" comprobar_descripcion "$F" "$OUT/_descripcion_nueva.txt" || { echo "Texto rechazado en $OUT/_descripcion_nueva.txt"; exit 1; }
  mv "$OUT/_descripcion_nueva.txt" "$OUT/descripcion.txt"
  anotar_cupo "$nombre" descripcion 0 "claude"
  echo "Descripción escrita en $OUT/descripcion.txt"
}

cmd_variaciones() {  # <nombre>: 5 variaciones de la descripción, para probar cuál funciona. Tokens, no imágenes.
  local nombre="$1" F="$(ficha_de "$1")" OUT="$SALIDA/$1"
  [ -f "$F" ] || { echo "No existe la ficha $F"; exit 1; }
  [ -f "$OUT/descripcion.txt" ] || { echo "Primero hace falta la descripción: carrusel.sh descripcion $nombre"; exit 1; }
  mkdir -p "$OUT/_logs"
  local CLAUDE="$(command -v claude || true)"; [ -z "$CLAUDE" ] && [ -x "$HOME/.local/bin/claude" ] && CLAUDE="$HOME/.local/bin/claude"
  [ -n "$CLAUDE" ] || { echo "Falta Claude Code. Instálalo (npm install -g @anthropic-ai/claude-code) y entra con: claude"; exit 1; }
  local P="$OUT/_logs/prompt_variaciones.txt"
  python3 "$AQUI/ficha.py" prompt_variaciones "$F" "$OUT/descripcion.txt" "$P" || exit 1
  if [ "${ENSAYO:-0}" = "1" ]; then echo "ENSAYO: no se llama a Claude. Prompt: $P"; exit 0; fi
  local LOG=$(siguiente_log "$OUT" variaciones)
  "$CLAUDE" -p --tools "" --output-format text < "$P" > "$LOG" 2>"$LOG.err"; local RC=$?
  [ $RC -eq 0 ] || { echo "Claude falló (exit $RC): $(head -c 300 "$LOG.err")"; exit 1; }
  python3 - "$LOG" "$OUT/_variaciones_nuevas.txt" <<'PY'
import sys,re
t=open(sys.argv[1],encoding="utf-8",errors="ignore").read()
t=re.sub(r"```\w*","",t)
i=t.find("=== VARIACI")
if i<0: raise SystemExit("Claude no devolvió variaciones. Ver "+sys.argv[1])
open(sys.argv[2],"w",encoding="utf-8").write(t[i:].strip()+"\n")
PY
  [ $? -eq 0 ] || exit 1
  # solo se guardan si pasan la comprobación; si no, las anteriores (si las hay) se quedan como estaban
  python3 "$AQUI/ficha.py" comprobar_variaciones "$F" "$OUT/_variaciones_nuevas.txt" || { echo "Texto rechazado en $OUT/_variaciones_nuevas.txt"; exit 1; }
  mv "$OUT/_variaciones_nuevas.txt" "$OUT/variaciones.txt"
  anotar_cupo "$nombre" variaciones 0 "claude"
  echo "Variaciones escritas en $OUT/variaciones.txt"
}

cmd_encoger() {  # <nombre> <n> [factor] [y]: cuando Codex lleva la escena hasta el pie o el titular choca con el contador. Sin Codex: no gasta imágenes.
  local nombre="$1" n="$2" f="${3:-0.92}" y="${4:-0}" OUT="$SALIDA/$1"; local N=$(cab "$nombre" slides)
  [ -f "$OUT/_sin_pie/$n.png" ] || { echo "No existe $OUT/_sin_pie/$n.png"; exit 1; }
  mkdir -p "$OUT/_versiones"; local k=1; while [ -e "$OUT/_versiones/${n}_v$k.png" ]; do k=$((k+1)); done
  cp "$OUT/_sin_pie/$n.png" "$OUT/_versiones/${n}_v$k.png"
  local w=$(python3 -c "print(int(round(1080*$f/2))*2)") h=$(python3 -c "print(int(round(1350*$f/2))*2)")
  local x=$(( (1080 - w) / 2 ))
  # color del fondo: la media de las cuatro esquinas de la escena
  local esq=() xy; for xy in 10:10 1050:10 10:1320 1050:1320; do esq+=$(ffmpeg -loglevel error -i "$OUT/_sin_pie/$n.png" -vf "crop=20:20:$xy,scale=1:1:flags=area" -f rawvideo -pix_fmt rgb24 - | xxd -p); done
  local col=$(python3 -c "import sys;v=[bytes.fromhex(h) for h in sys.argv[1:]];print(''.join('%02x'%round(sum(c[i] for c in v)/len(v)) for i in range(3)))" "${esq[@]}")
  # todo en RGB (gbrp): con la mezcla en YUV el azul de la marca se apagaba (#0270FD → #3C72B5, medido 01-10-2026)
  ffmpeg -y -loglevel error -i "$OUT/_versiones/${n}_v$k.png" -f lavfi -i "color=c=0x${col}:s=1080x1350" -f lavfi -i color=c=black:s=1080x1350 \
    -filter_complex "[0]format=gbrp,scale=${w}:${h}:flags=lanczos[e];[1]format=gbrp,split[bg][bg2];[bg][e]overlay=${x}:${y}:format=gbrp[im];[2]format=gbrp,drawbox=x=$((x+20)):y=0:w=$((w-40)):h=$((h+y-20)):color=white:t=fill,boxblur=18:1[m];[bg2][im][m]maskedmerge,format=rgb24" \
    -frames:v 1 "$OUT/_sin_pie/$n.png" || { cp "$OUT/_versiones/${n}_v$k.png" "$OUT/_sin_pie/$n.png"; echo "FALLO al encoger el slide $n"; exit 1; }
  estampar "$OUT" $n $N && cmd_revisar "$nombre" >/dev/null
  echo "OK slide $n encogido al $f, bajado ${y} px · fondo #$col · versión anterior en _versiones/${n}_v$k.png"
}

cmd_cupo() { echo "Cuenta '$CUENTA': $(gastadas_24h) imágenes en las últimas 24 h (tope $TOPE)"; }

# estilo: claro en la ficha → pie en azul marino (plantilla) y PROMPT_BASE_CLARO.txt (ficha.py)
[ $# -ge 2 ] && [ -f "$(ficha_de "$2")" ] && [ "$(cab "$2" estilo)" = "claro" ] && export PIE_ESTILO=claro
[ $# -ge 2 ] && [ -f "$(ficha_de "$2")" ] && export PIE_FICHA="$(ficha_de "$2")"

case "${1:-}" in
  bajar)     [ $# -eq 3 ] || { sed -n '2,15p' "$0"; exit 64; }; cmd_bajar "$2" "$3" ;;
  nueva)     [ $# -eq 3 ] || { sed -n '2,15p' "$0"; exit 64; }; cmd_nueva "$2" "$3" ;;
  ficha_ia)  [ $# -eq 2 ] || { sed -n '2,15p' "$0"; exit 64; }; cmd_ficha_ia "$2" ;;
  comprobar) [ $# -eq 2 ] || { sed -n '2,15p' "$0"; exit 64; }; cmd_comprobar "$2" ;;
  generar)   [ $# -eq 2 ] || { sed -n '2,15p' "$0"; exit 64; }; cmd_generar "$2" ;;
  corregir)  [ $# -eq 4 ] || { sed -n '2,15p' "$0"; exit 64; }; cmd_corregir "$2" "$3" "$4" ;;
  revisar)   [ $# -eq 2 ] || { sed -n '2,15p' "$0"; exit 64; }; cmd_revisar "$2" ;;
  cerrar)    [ $# -eq 2 ] || { sed -n '2,15p' "$0"; exit 64; }; cmd_cerrar "$2" ;;
  descripcion) [ $# -eq 2 ] || { sed -n '2,15p' "$0"; exit 64; }; cmd_descripcion "$2" ;;
  encoger)   [ $# -ge 3 ] || { sed -n '2,15p' "$0"; exit 64; }; cmd_encoger "$2" "$3" "${4:-0.92}" "${5:-0}" ;;
  variaciones) [ $# -eq 2 ] || { sed -n '2,15p' "$0"; exit 64; }; cmd_variaciones "$2" ;;
  cupo)      cmd_cupo ;;
  *)         sed -n '2,15p' "$0"; exit 64 ;;
esac
