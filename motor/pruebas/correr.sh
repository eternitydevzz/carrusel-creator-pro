#!/bin/zsh
# Pruebas del motor sin gasto: no llama a ScrapeCreators ni a Codex, no gasta imágenes ni créditos y no toca datos/.
#   motor/pruebas/correr.sh            todas
#   motor/pruebas/correr.sh bajar      solo las que contienen "bajar" en el nombre
# Usa respuestas guardadas (scrapecreators/*.json, codex/*/codex.log; en codex/*/origen pone si son reales o sintéticas)
# y una marca de prueba con imágenes lisas (datos/). Cada prueba corre en una carpeta temporal que se borra al final.
set -u
AQUI="${0:A:h}"; MOTOR="${AQUI:h}"; SH="$MOTOR/carrusel.sh"
FILTRO="${1:-}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
PASAN=0; FALLAN=(); SALIDA=""; RC=0

# carpeta de datos nueva para cada prueba (DATOS, PERFIL y GEN propios)
preparar() {
  D="$TMP/$1"; rm -rf "$D"; cp -R "$AQUI/datos" "$D"; P="$D/perfiles/prueba"
  mkdir -p "$P/virales" "$P/salida" "$D/gen"
  # la ruta del original en las fichas apunta a la carpeta temporal
  for f in "$P"/fichas/*.md; do sed -i '' "s|VIRALES/|$P/virales/|" "$f"; done
}
motor() { SALIDA="$(DATOS="$D" PERFIL=prueba GEN="$D/gen" zsh "$SH" "$@" 2>&1)"; RC=$?; }
original() {  # <nombre> <N>: slides del original hechos con la imagen de prueba
  mkdir -p "$P/virales/$1"; local k; for k in $(seq 1 $2); do cp "$AQUI/slide_prueba.jpg" "$P/virales/$1/slide_$(printf %02d $k).jpg"; done
}
codex() {  # <caso>: Codex simulado con su log y sus imágenes (lisas, de colores distintos, en orden de creación)
  export CODEX_SIMULADO="$AQUI/codex/$1/codex.log"
  local sid=$(sed 's/\x1b\[[0-9;]*m//g' "$CODEX_SIMULADO" | grep -m1 "session id:" | awk '{print $3}') k
  local n=$(cat "$AQUI/codex/$1/imagenes"); [ -n "$sid" ] || sid=sin_sesion
  mkdir -p "$D/gen/$sid"
  for k in $(seq 1 $n); do
    ffmpeg -loglevel error -y -f lavfi -i "color=c=0x$(printf '%02x%02x%02x' $(((k*29)%256)) 90 $(((250-k*23)%256))):s=1080x1350" -frames:v 1 "$D/gen/$sid/img_$k.png"
    touch -t "2026010112$(printf %02d $k)" "$D/gen/$sid/img_$k.png"
  done
}
slides() { ls "$P/salida/$1" 2>/dev/null | grep -cE '^[0-9]+\.png$'; }
igual() { cmp -s "$1" "$2"; }

prueba() {  # <nombre> <qué se espera> <función>
  [ -n "$FILTRO" ] && [[ "$1" != *"$FILTRO"* ]] && return
  unset CODEX_SIMULADO; SALIDA=""; RC=0; preparar "$1"
  if "$3"; then PASAN=$((PASAN+1)); print -P "%F{green}PASA%f  $1"
  else FALLAN+=("$1"); print -P "%F{red}FALLA%f $1 — se espera: $2"; print "      salida (código $RC): ${${SALIDA//$'\n'/ · }[1,300]}"; fi
}

# ---------- descarga (fase 1) ----------
bajar() { SC_RESPUESTA="$1" SC_SIN_IMAGENES=1 motor bajar "${2:-https://www.instagram.com/p/PRUEBA/}" orig; }
p_bajar_videos() { bajar "$AQUI/scrapecreators/carrusel_con_videos.json"; [ $RC -eq 0 ] && [ "$(ls $P/virales/orig | grep -c '^slide_')" -eq 6 ] && [ -f "$P/virales/orig/slide_06.jpg" ]; }
p_bajar_fotos() { bajar "$AQUI/scrapecreators/carrusel_solo_fotos.json"; [ $RC -eq 0 ] && [ "$(ls $P/virales/orig | grep -c '^slide_')" -eq 7 ]; }
p_bajar_foto_suelta() { bajar "$AQUI/scrapecreators/foto_suelta.json"; [ $RC -ne 0 ] && [[ "$SALIDA" == *NO_ES_CARRUSEL* ]] && [ "$(ls $P/virales/orig 2>/dev/null | grep -c '^slide_')" -eq 0 ]; }
p_bajar_reel() { bajar "$AQUI/scrapecreators/reel.json" "https://www.instagram.com/reel/PRUEBA/"; [ $RC -ne 0 ] && [[ "$SALIDA" == *NO_ES_CARRUSEL* ]]; }
p_bajar_error_api() { echo '{"success":false,"error":"Post no encontrado"}' > "$D/r.json"; bajar "$D/r.json"; [ $RC -ne 0 ] && [[ "$SALIDA" == *"no devolvió"* ]]; }
p_bajar_slide_sin_imagen() {  # un slide sin imagen: se para, no deja un carrusel a medias
  python3 - "$AQUI/scrapecreators/carrusel_con_videos.json" "$D/r.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); m=(d.get("data") or d)["xdt_shortcode_media"]
n=m["edge_sidecar_to_children"]["edges"][3]["node"]; n.pop("display_resources",None); n.pop("display_url",None)
json.dump(d,open(sys.argv[2],"w"))
PY
  bajar "$D/r.json"; [ $RC -ne 0 ] && [ "$(ls $P/virales/orig 2>/dev/null | grep -c '^slide_')" -eq 0 ]
}
prueba bajar_carrusel_con_videos "6 de 6 slides (3 de vídeo, con su portada)" p_bajar_videos
prueba bajar_carrusel_solo_fotos "7 de 7 slides" p_bajar_fotos
prueba bajar_foto_suelta "para con NO_ES_CARRUSEL y no baja nada" p_bajar_foto_suelta
prueba bajar_reel "para con NO_ES_CARRUSEL" p_bajar_reel
prueba bajar_error_de_la_api "para con un mensaje (antes terminaba como si hubiera ido bien)" p_bajar_error_api
prueba bajar_slide_sin_imagen "para sin dejar un carrusel a medias" p_bajar_slide_sin_imagen

# ---------- generación (fase 2) ----------
p_gen_normal() { original normal_8 9; codex normal; motor generar normal_8; [ $RC -eq 0 ] && [ "$(slides normal_8)" -eq 8 ]; }
p_gen_rehizo_sin_final() { original con_persona_3 3; codex rehizo_sin_final; motor generar con_persona_3
  [ $RC -eq 4 ] && [ "$(ls $P/salida/con_persona_3/_revisar | wc -l | tr -d ' ')" -eq 5 ] && [ "$(slides con_persona_3)" -eq 0 ] && [[ "$SALIDA" == *"Elige en la app"* ]]; }
p_gen_rehizo_con_final() { original con_persona_3 3; codex rehizo_con_final; motor generar con_persona_3
  local o="$P/salida/con_persona_3"; [ $RC -eq 0 ] && [ "$(slides con_persona_3)" -eq 3 ] && igual "$o/_sin_pie/1.png" "$o/_revisar/orden_02.png" && igual "$o/_sin_pie/3.png" "$o/_revisar/orden_05.png"; }
p_gen_final_solo_en_prompt() { original con_persona_3 3; codex final_solo_en_prompt; motor generar con_persona_3; [ $RC -eq 4 ] && [ "$(slides con_persona_3)" -eq 0 ]; }
p_gen_limite() { original con_persona_3 3; codex limite; motor generar con_persona_3; [ $RC -eq 2 ] && [[ "$SALIDA" == *LIMITE_DE_USO* ]]; }
p_gen_sin_sesion() { original con_persona_3 3; codex sin_sesion; motor generar con_persona_3; [ $RC -ne 0 ] && [[ "$SALIDA" == *"sin session id"* ]]; }
p_elegir_mal() { original con_persona_3 3; codex rehizo_sin_final; motor generar con_persona_3; motor elegir con_persona_3 2,9,4; [ $RC -ne 0 ] && [ "$(slides con_persona_3)" -eq 0 ]; }
p_elegir_bien() { original con_persona_3 3; codex rehizo_sin_final; motor generar con_persona_3; motor elegir con_persona_3 2,4,5; [ $RC -eq 0 ] && [ "$(slides con_persona_3)" -eq 3 ]; }
prueba generar_normal "8 slides con su pie (log real del #12)" p_gen_normal
prueba generar_codex_rehizo_sin_final "para con código 4 y deja las 5 imágenes para elegir (log real de Santo)" p_gen_rehizo_sin_final
prueba generar_codex_rehizo_con_final "coloca solas las imágenes 2, 4 y 5" p_gen_rehizo_con_final
prueba generar_final_solo_en_el_prompt "no elige nada solo: el FINAL del prompt no es la respuesta de Codex" p_gen_final_solo_en_prompt
prueba generar_limite_de_uso "para con código 2 y LIMITE_DE_USO" p_gen_limite
prueba generar_sin_sesion "para con un mensaje" p_gen_sin_sesion
prueba elegir_numeros_malos "rechaza 2,9,4 sin tocar nada" p_elegir_mal
prueba elegir_2_4_5 "3 slides con su pie" p_elegir_bien

# ---------- personaje (fase 3) ----------
fotos() { sed -i '' "s|^fotos: .*|fotos: $1|" "$P/marca/marca.txt"; }
prompt_de() { original "$1" 3; SALIDA="$(DATOS="$D" DATOS_PERFIL="$P" python3 "$MOTOR/ficha.py" prompt "$P/fichas/$1.md" "$D/prompt.txt" 1 2>&1)"; RC=$?; [ $RC -eq 0 ]; }
p_sin_cliente() { original sin_persona_3 3; motor comprobar sin_persona_3; [ $RC -ne 0 ] && [[ "$SALIDA" == *"ningún slide"* ]]; }
p_mascota() { prompt_de con_persona_3 && ! grep -q "La mascota o la persona del original tampoco aparecen" "$D/prompt.txt"; }
p_una_foto() { fotos "fotos/personaje_1.jpg"; prompt_de con_persona_3 && grep -q "la foto 1" "$D/prompt.txt" && ! grep -q "las fotos 1" "$D/prompt.txt"; }
p_tres_fotos() { fotos "fotos/personaje_1.jpg, fotos/personaje_2.jpg, fotos/personaje_3.jpg"; prompt_de con_persona_3 && grep -q "las fotos 1, 2 y 3" "$D/prompt.txt"; }
prueba ficha_sin_el_cliente_en_ningun_slide "la comprobación frena: el cliente tiene que salir al menos al final" p_sin_cliente
prueba prompt_la_mascota_se_queda "el prompt no manda quitar la mascota del original" p_mascota
prueba prompt_con_1_foto "habla de 'la foto 1'" p_una_foto
prueba prompt_con_3_fotos "habla de 'las fotos 1, 2 y 3'" p_tres_fotos

print; print "Pasan ${PASAN} · fallan ${#FALLAN}"
[ ${#FALLAN} -eq 0 ]
