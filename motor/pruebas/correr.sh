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
# ---------- rediseño (REDISENO=1): Codex recibe el slide ORIGINAL como referencia ----------
ensayo_corregir() {  # [REDISENO] <slide>: corrige en ensayo (no llama a Codex) y deja el prompt en _correcciones/
  unset CODEX_SIMULADO; export ENSAYO=1; [ "$1" = "rediseno" ] && export REDISENO=1; motor corregir con_persona_3 "${2:-2}" "fondo blanco"; unset ENSAYO REDISENO
}
p_rediseno_adjunta_original() {
  tres_slides && ensayo_corregir rediseno 2; local pr="$P/salida/con_persona_3/_correcciones/slide_2_v1.txt"
  [ $RC -eq 0 ] && [[ "$SALIDA" == *"virales/con_persona_3/slide_02.jpg"* ]] && [[ "$SALIDA" != *"_sin_pie"* ]] && grep -q "mismo diseño que la imagen 1" "$pr" && grep -q "^- titular:" "$pr"
}
p_rediseno_sin_original() { tres_slides && rm "$P/virales/con_persona_3/slide_02.jpg" && ensayo_corregir rediseno 2; [ $RC -ne 0 ] && [[ "$SALIDA" == *"No existe el slide original"* ]]; }
p_corregir_normal_intacto() {  # sin REDISENO, corregir sigue mandando el slide actual y la instrucción de siempre
  tres_slides && ensayo_corregir normal 2; local pr="$P/salida/con_persona_3/_correcciones/slide_2_v1.txt"
  [ $RC -eq 0 ] && [[ "$SALIDA" == *"_sin_pie/2.png"* ]] && grep -q "Edita la imagen 1" "$pr" && ! grep -q "mismo diseño" "$pr"
}
p_rediseno_con_persona() {  # el slide 3 lleva personaje: se añaden las fotos tras la referencia
  tres_slides && ensayo_corregir rediseno 3; local pr="$P/salida/con_persona_3/_correcciones/slide_3_v1.txt"
  [ $RC -eq 0 ] && [[ "$SALIDA" == *"slide_03.jpg"* ]] && [[ "$SALIDA" == *"fotos/"* ]] && grep -q "El personaje es el de la imagen 2" "$pr"
}
p_rediseno_sin_persona() { tres_slides && ensayo_corregir rediseno 2; [[ "$SALIDA" != *"fotos/"* ]] && grep -q "no aparece ninguna persona" "$P/salida/con_persona_3/_correcciones/slide_2_v1.txt"; }
p_pie_claro() {  # pie_claro: si → el pie se dibuja en azul marino, sin cambiar el prompt de la ficha
  tres_slides || return 1
  sed -i '' '1a\
pie_claro: si
' "$P/fichas/con_persona_3.md"; grep -q "^pie_claro: si" "$P/fichas/con_persona_3.md" || return 1
  rm -rf "$D/capas"; export ENSAYO=1; motor generar con_persona_3; unset ENSAYO
  ls "$D/capas" | grep -q "_claro"
}
prueba rediseno_adjunta_original "manda el slide original como imagen 1, no el slide actual, y los textos de la ficha" p_rediseno_adjunta_original
prueba rediseno_sin_original "para y dice que falta el slide original" p_rediseno_sin_original
prueba rediseno_con_persona "si el slide lleva personaje, añade sus fotos tras la referencia" p_rediseno_con_persona
prueba rediseno_sin_persona "si no lleva personaje, no manda fotos" p_rediseno_sin_persona
prueba corregir_normal_intacto "sin REDISENO, corregir no cambia" p_corregir_normal_intacto
prueba pie_claro "pie_claro: si dibuja el pie en azul marino" p_pie_claro
p_reestampar() {  # vuelve a estampar el pie sin Codex y sin gastar cupo
  tres_slides || return 1; local o="$P/salida/con_persona_3" antes; antes=$(wc -l < "$D/CUPO.csv" 2>/dev/null || echo 0); rm "$o/2.png"
  motor reestampar con_persona_3 2; [ $RC -eq 0 ] && [ -f "$o/2.png" ] && [ "$(wc -l < "$D/CUPO.csv" 2>/dev/null || echo 0)" = "$antes" ]
}
p_pie_referencia() {  # pie_claro: referencia → capas con la variante en el nombre (no se mezclan con las del pie normal)
  tres_slides || return 1
  sed -i '' '1a\
pie_claro: referencia
' "$P/fichas/con_persona_3.md"; rm -rf "$D/capas"; motor reestampar con_persona_3 1; [ $RC -eq 0 ] && ls "$D/capas" | grep -q "_claro_referencia_"
}
p_pie_normal_intacto() {  # sin pie_claro, las capas se llaman como siempre
  tres_slides || return 1; rm -rf "$D/capas"; motor reestampar con_persona_3 1; [ $RC -eq 0 ] && ls "$D/capas" | grep -q "^capa_1de3_" && ! ls "$D/capas" | grep -q "referencia\|claro"
}
prueba reestampar "estampa el pie sin gastar cupo" p_reestampar
prueba pie_referencia "pie_claro: referencia usa la variante" p_pie_referencia
prueba pie_normal_intacto "sin pie_claro, capas como siempre" p_pie_normal_intacto
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

# ---------- ficha y cifras (perfiles nuevos) ----------
ficha_ia_con() {  # el original se baja con la respuesta guardada (trae el pie del post en info.txt, como en la app)
  SC_RESPUESTA="$AQUI/scrapecreators/carrusel_con_videos.json" SC_SIN_IMAGENES=1 motor bajar https://www.instagram.com/p/PRUEBA/ santo_prueba_real; CLAUDE_SIMULADO="$AQUI/claude/$1/respuesta.txt" motor ficha_ia santo_prueba_real; }
p_ficha_texto() { ficha_ia_con ficha_con_texto; [ $RC -eq 0 ] && grep -q "1.2B a week" "$P/virales/santo_prueba_real/texto_original.md" && ! grep -q "TEXTO DEL ORIGINAL" "$P/fichas/santo_prueba_real.md"; }
p_cifras_con_texto() { ficha_ia_con ficha_con_texto; motor comprobar santo_prueba_real; [ $RC -eq 0 ]; }
p_cifras_sin_texto() { ficha_ia_con ficha_sin_texto; motor comprobar santo_prueba_real; [ $RC -ne 0 ] && [[ "$SALIDA" == *"no aparece en el carrusel original"* ]]; }
p_ruta_del_original() { ficha_ia_con ficha_con_texto; grep -q "^viral: $P/virales/santo_prueba_real$" "$P/fichas/santo_prueba_real.md"; }
p_cifra_inventada() { ficha_ia_con ficha_con_texto; sed -i '' 's/Un fundador llegó a \$10K al mes en 3 semanas/Un fundador llegó a $25K al mes en 3 semanas/' "$P/fichas/santo_prueba_real.md"; motor comprobar santo_prueba_real; [ $RC -ne 0 ] && [[ "$SALIDA" == *"25K"* ]]; }
p_mismo_valor() { python3 -c "import sys; sys.path.insert(0,'$MOTOR'); import ficha as f; v=f.valores; sys.exit(0 if v('1.2B')==v('1.200 millones')==v('1.2 billion')==v('1.200 M') and v('10K')==v('10,000') and v('1.2B')!=v('1.3B') else 1)"; }
prueba ficha_ia_guarda_el_texto_del_original "texto_original.md junto al original y la ficha sin esa sección" p_ficha_texto
prueba cifras_del_original_por_su_valor "las 6 cifras de Santo (1.2B → 1.200 millones, 10K, 10,000, 29) se dan por buenas" p_cifras_con_texto
prueba cifras_sin_texto_del_original "sin el texto del original, se rechazan (lo que les pasaba a los perfiles nuevos)" p_cifras_sin_texto
prueba ficha_ia_pone_la_ruta_del_original "la ficha apunta a su original aunque Claude escriba otra ruta" p_ruta_del_original
prueba cifra_inventada "una cifra que no está en el original se sigue frenando" p_cifra_inventada
prueba cifras_mismo_valor "1.2B = 1.2 billion = 1.200 millones = 1.200 M; 10K = 10,000; 1.2B ≠ 1.3B" p_mismo_valor

# ---------- descripción: cada cliente con su marca ----------
p_desc_marca() { original con_persona_3 3; SALIDA="$(DATOS="$D" DATOS_PERFIL="$P" python3 "$MOTOR/ficha.py" prompt_descripcion "$P/fichas/con_persona_3.md" "$D/desc.txt" 2>&1)"; RC=$?
  [ $RC -eq 0 ] && grep -q "Marca de prueba del comando" "$D/desc.txt" && ! grep -qi "sistemas de AI a empresas en USA" "$D/desc.txt"; }
p_prompts_sin_marca_fija() { ! grep -il "sistemas de AI a empresas\|cristianews\|Cristian News" "$MOTOR"/PROMPT_*.txt; }
prueba descripcion_con_el_angulo_del_cliente "el prompt lleva el ángulo de este cliente y no el de Cristian" p_desc_marca
prueba prompts_sin_marca_fija "ningún prompt lleva escrita la marca de Cristian" p_prompts_sin_marca_fija

# ---------- personaje (fase 3) ----------
fotos() { sed -i '' "s|^fotos: .*|fotos: $1|" "$P/marca/marca.txt"; }
prompt_de() { original "$1" 3; SALIDA="$(DATOS="$D" DATOS_PERFIL="$P" python3 "$MOTOR/ficha.py" prompt "$P/fichas/$1.md" "$D/prompt.txt" 1 2>&1)"; RC=$?; [ $RC -eq 0 ]; }
p_sin_cliente() { original sin_persona_3 3; motor comprobar sin_persona_3; [ $RC -ne 0 ] && [[ "$SALIDA" == *"ningún slide"* ]]; }
p_mascota() { prompt_de con_persona_3 && ! grep -q "La mascota o la persona del original tampoco aparecen" "$D/prompt.txt" && grep -q "se queda como en el original, sin la cara de nadie" "$D/prompt.txt"; }
p_cliente_al_final() { original con_persona_3 3; motor comprobar con_persona_3; [ $RC -eq 0 ]; }
p_regla_ficha() { grep -q 'Si el original no lleva a ninguna persona en ningún slide, pon "si" en el último slide' "$MOTOR/PROMPT_FICHA.txt"; }
p_una_foto() { fotos "fotos/personaje_1.jpg"; prompt_de con_persona_3 && grep -q "la foto 1" "$D/prompt.txt" && ! grep -q "las fotos 1" "$D/prompt.txt"; }
p_tres_fotos() { fotos "fotos/personaje_1.jpg, fotos/personaje_2.jpg, fotos/personaje_3.jpg"; prompt_de con_persona_3 && grep -q "las fotos 1, 2 y 3" "$D/prompt.txt"; }
prueba ficha_sin_el_cliente_en_ningun_slide "la comprobación frena: el cliente tiene que salir al menos al final" p_sin_cliente
prueba prompt_la_mascota_se_queda "la mascota se queda como en el original, sin la cara de nadie" p_mascota
prueba ficha_con_el_cliente_en_el_ultimo "la comprobación la da por buena" p_cliente_al_final
prueba regla_de_la_ficha_ia "el prompt de la ficha pide al cliente en el último si el original no lleva a nadie" p_regla_ficha
prueba prompt_con_1_foto "habla de 'la foto 1'" p_una_foto
prueba prompt_con_3_fotos "habla de 'las fotos 1, 2 y 3'" p_tres_fotos

print; print "Pasan ${PASAN} · fallan ${#FALLAN}"
[ ${#FALLAN} -eq 0 ]
