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
  for (( k = 1; k <= n; k++ )); do  # no seq: en Mac "seq 1 0" cuenta hacia atrás y daba 2 imágenes
    ffmpeg -loglevel error -y -f lavfi -i "color=c=0x$(printf '%02x%02x%02x' $(((k*29)%256)) 90 $(((250-k*23)%256))):s=1080x1350" -frames:v 1 "$D/gen/$sid/img_$k.png"
    touch -t "2026010112$(printf %02d $k)" "$D/gen/$sid/img_$k.png"
  done
  # codex/<caso>/rota: número de la imagen que llega rota (no es una imagen)
  if [ -f "$AQUI/codex/$1/rota" ]; then k=$(cat "$AQUI/codex/$1/rota"); echo "no es una imagen" > "$D/gen/$sid/img_$k.png"; touch -t "2026010112$(printf %02d $k)" "$D/gen/$sid/img_$k.png"; fi
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
p_bajar_foto_suelta() { bajar "$AQUI/scrapecreators/foto_suelta.json"; [ $RC -eq 6 ] && [[ "$SALIDA" == *NO_ES_CARRUSEL* ]] && [ "$(ls $P/virales/orig 2>/dev/null | grep -c '^slide_')" -eq 0 ]; }
p_bajar_reel() { bajar "$AQUI/scrapecreators/reel.json" "https://www.instagram.com/reel/PRUEBA/"; [ $RC -eq 6 ] && [[ "$SALIDA" == *NO_ES_CARRUSEL* ]] && [ ! -e "$P/virales/orig" ]; }
p_bajar_error_api() { echo '{"success":false,"error":"Post no encontrado"}' > "$D/r.json"; bajar "$D/r.json"; [ $RC -ne 0 ] && [[ "$SALIDA" == *"no devolvió"* ]]; }
p_bajar_slide_sin_imagen() {  # un slide sin imagen: se para, no deja un carrusel a medias
  python3 - "$AQUI/scrapecreators/carrusel_con_videos.json" "$D/r.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); m=(d.get("data") or d)["xdt_shortcode_media"]
n=m["edge_sidecar_to_children"]["edges"][3]["node"]; n.pop("display_resources",None); n.pop("display_url",None)
json.dump(d,open(sys.argv[2],"w"))
PY
  bajar "$D/r.json"; [ $RC -ne 0 ] && [[ "$SALIDA" == *FALTA_SLIDE* ]] && [ ! -e "$P/virales/orig" ]
}
fallo_en_slide_3() {  # imágenes locales (sin red) y la del slide 3 no existe: la descarga falla a mitad
  python3 - "$AQUI/scrapecreators/carrusel_con_videos.json" "$D/r.json" "$AQUI/slide_prueba.jpg" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); m=(d.get("data") or d)["xdt_shortcode_media"]
for k,e in enumerate(m["edge_sidecar_to_children"]["edges"],1):
    n=e["node"]; n.pop("display_resources",None); n["display_url"]="file://"+(sys.argv[3] if k!=3 else "/no/existe.jpg")
json.dump(d,open(sys.argv[2],"w"))
PY
  SC_RESPUESTA="$D/r.json" motor bajar https://www.instagram.com/p/PRUEBA/ orig
}
p_bajar_falla_a_mitad() { fallo_en_slide_3; [ $RC -ne 0 ] && [[ "$SALIDA" == *FALLO_DESCARGA* ]] && [ ! -e "$P/virales/orig" ] && [ ! -e "$P/virales/orig.bajando" ]; }
p_bajar_reintento() { fallo_en_slide_3; bajar "$AQUI/scrapecreators/carrusel_con_videos.json"; [ $RC -eq 0 ] && [ "$(ls $P/virales/orig | grep -c '^slide_')" -eq 6 ]; }
prueba bajar_carrusel_con_videos "6 de 6 slides (3 de vídeo, con su portada)" p_bajar_videos
prueba bajar_carrusel_solo_fotos "7 de 7 slides" p_bajar_fotos
prueba bajar_foto_suelta "para con NO_ES_CARRUSEL y no baja nada" p_bajar_foto_suelta
prueba bajar_reel "para con NO_ES_CARRUSEL" p_bajar_reel
prueba bajar_error_de_la_api "para con un mensaje (antes terminaba como si hubiera ido bien)" p_bajar_error_api
prueba bajar_slide_sin_imagen "para sin dejar un carrusel a medias" p_bajar_slide_sin_imagen
prueba bajar_falla_una_imagen_a_mitad "para con FALLO_DESCARGA y no deja nada" p_bajar_falla_a_mitad
prueba bajar_reintento_tras_un_fallo "el segundo intento baja los 6 (antes: \"Ya existe\")" p_bajar_reintento

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
p_gen_imagen_rota() { original normal_8 9; codex normal_imagen_rota; motor generar normal_8; [ $RC -ne 0 ] && [[ "$SALIDA" == *"imagen 3 de Codex no se pudo recortar"* ]]; }
tres_slides() { original con_persona_3 3; codex rehizo_con_final; motor generar con_persona_3; [ $RC -eq 0 ]; }
p_corregir() { tres_slides && codex correccion && motor corregir con_persona_3 2 "sube el texto" && [ $RC -eq 0 ] && [ -f "$P/salida/con_persona_3/_versiones/2_v1.png" ] && ! igual "$P/salida/con_persona_3/_sin_pie/2.png" "$P/salida/con_persona_3/_versiones/2_v1.png"; }
p_corregir_sin_imagen() { tres_slides && codex correccion_sin_imagen; motor corregir con_persona_3 2 "sube el texto"; [ $RC -ne 0 ] && [[ "$SALIDA" == *"FALLO slide 2"* ]]; }
p_corregir_imagen_rota() { tres_slides && codex correccion_imagen_rota; motor corregir con_persona_3 2 "sube el texto"; local o="$P/salida/con_persona_3"
  [ $RC -ne 0 ] && [[ "$SALIDA" == *"se queda como estaba"* ]] && igual "$o/_sin_pie/2.png" "$o/_versiones/2_v1.png" && [ -f "$o/2.png" ]; }
prueba generar_normal "8 slides con su pie (log real del #12)" p_gen_normal
prueba generar_imagen_rota "para diciendo qué imagen falló (antes, sin mensaje)" p_gen_imagen_rota
prueba corregir_normal "corrige el slide 2 y guarda la versión anterior" p_corregir
prueba corregir_sin_imagen "para con FALLO slide 2" p_corregir_sin_imagen
prueba corregir_imagen_rota "para, lo dice y deja el slide como estaba (antes respondía OK)" p_corregir_imagen_rota
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
