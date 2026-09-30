#!/usr/bin/env bash
# Uso:
#   adaptar.sh <carpeta>                 -> adapta todas las imágenes y videos de la carpeta
#   adaptar.sh <archivo> [<archivo>...]  -> adapta solo esos archivos
# Opciones (van al final, todas opcionales):
#   --ciudad "Newark" --estado "New Jersey" --pais "United States" --codigo US --lat 40.7357 --lon -74.1724
#
# Qué hace con cada archivo:
#   Imagen: reescribe los píxeles como JPEG (ancho 1080, calidad 92) con sips, borra todos los
#           metadatos con exiftool y escribe solo la ubicación (GPS + IPTC + XMP).
#   Video:  reempaqueta con ffmpeg sin recodificar, sin metadatos ni capítulos, y escribe la
#           ubicación en el átomo ©xyz (ISO 6709).
#   Los originales se mueven a una carpeta hermana "<carpeta>_originales" (fuera de la de subida).
#   Al final comprueba byte a byte que no quede c2pa / openai / jumbf / gpt / sora / watermark.
set -euo pipefail

CIUDAD="Newark"; ESTADO="New Jersey"; PAIS="United States"; CODIGO="US"; LAT="40.7357"; LON="-74.1724"
ENTRADAS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --ciudad) CIUDAD="$2"; shift 2 ;;
    --estado) ESTADO="$2"; shift 2 ;;
    --pais)   PAIS="$2";   shift 2 ;;
    --codigo) CODIGO="$2"; shift 2 ;;
    --lat)    LAT="$2";    shift 2 ;;
    --lon)    LON="$2";    shift 2 ;;
    *) ENTRADAS+=("$1"); shift ;;
  esac
done
[ ${#ENTRADAS[@]} -gt 0 ] || { echo "Uso: adaptar.sh <carpeta|archivos...> [--ciudad ... --estado ... --lat ... --lon ...]" >&2; exit 1; }
command -v exiftool >/dev/null || { echo "Falta exiftool (brew install exiftool)" >&2; exit 1; }

# Referencias GPS para EXIF y coordenada ISO 6709 para video (+DD.DDDD-DDD.DDDD/)
LAT_ABS="${LAT#-}"; LON_ABS="${LON#-}"
LAT_REF="N"; [ "${LAT:0:1}" = "-" ] && LAT_REF="S"
LON_REF="E"; [ "${LON:0:1}" = "-" ] && LON_REF="W"
ISO6709=$(python3 -c "print(f'{float(\"$LAT\"):+08.4f}{float(\"$LON\"):+09.4f}/')")

PATRON='c2pa|jumb|openai|chatgpt|gpt-image|dall-e|sora|trainedAlgorithmic|watermark|midjourney|stable ?diffusion|gemini|imagen'

# Lista de archivos a tratar
ARCHIVOS=()
for e in "${ENTRADAS[@]}"; do
  if [ -d "$e" ]; then
    while IFS= read -r f; do ARCHIVOS+=("$f"); done < <(find "$e" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.heic' -o -iname '*.tif' -o -iname '*.tiff' -o -iname '*.mp4' -o -iname '*.mov' -o -iname '*.m4v' \) | sort)
  elif [ -f "$e" ]; then
    ARCHIVOS+=("$e")
  else
    echo "No existe: $e" >&2; exit 1
  fi
done
[ ${#ARCHIVOS[@]} -gt 0 ] || { echo "No hay imágenes ni videos que adaptar" >&2; exit 1; }

rastros() { # cuenta coincidencias del patrón en metadatos + bytes del archivo
  local n1 n2
  n1=$(exiftool -a -s "$1" 2>/dev/null | grep -icE "$PATRON" || true)
  n2=$(grep -aioE "$PATRON" "$1" 2>/dev/null | wc -l | tr -d ' ')
  echo $((n1 + n2))
}

adaptar_imagen() {
  local in="$1" out="$2" w h nh
  w=$(sips -g pixelWidth "$in" | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$in" | awk '/pixelHeight/{print $2}')
  nh=$(( (h * 1080 / w) / 2 * 2 ))
  # Si está a menos de un 1 % de un formato estándar de Instagram, encajar en él (4:5, 1:1, 9:16, 1.91:1)
  for std in 1350 1080 1920 566; do
    d=$(( nh - std )); d=${d#-}
    [ "$d" -le $(( std / 100 )) ] && { nh=$std; break; }
  done
  sips -s format jpeg -s formatOptions 92 -z "$nh" 1080 "$in" --out "$out" >/dev/null
  exiftool -q -overwrite_original -all= "$out"
  exiftool -q -q -overwrite_original \
    -GPSLatitude="$LAT_ABS" -GPSLatitudeRef="$LAT_REF" -GPSLongitude="$LON_ABS" -GPSLongitudeRef="$LON_REF" \
    -XMP:City="$CIUDAD" -XMP:State="$ESTADO" -XMP:Country="$PAIS" -XMP:CountryCode="$CODIGO" \
    -IPTC:City="$CIUDAD" -IPTC:Province-State="$ESTADO" -IPTC:Country-PrimaryLocationName="$PAIS" -IPTC:Country-PrimaryLocationCode="$CODIGO" \
    "$out"
  exiftool -q -overwrite_original -XMP-x:XMPToolkit= "$out"
  echo "${w}x${h} -> 1080x${nh} jpg"
}

adaptar_video() {
  local in="$1" out="$2"
  command -v ffmpeg >/dev/null || { echo "Falta ffmpeg para videos" >&2; return 1; }
  ffmpeg -v error -y -i "$in" -map 0:v -map 0:a? -map_metadata -1 -map_chapters -1 -c copy -fflags +bitexact -flags +bitexact \
    -metadata location="$ISO6709" -metadata location-eng="$ISO6709" -movflags +faststart "$out"
  echo "reempaquetado mp4 sin metadatos"
}

FALLOS=0
for f in "${ARCHIVOS[@]}"; do
  dir="$(cd "$(dirname "$f")" && pwd)"; base="$(basename "$f")"; stem="${base%.*}"; ext="${base##*.}"; ext="$(echo "$ext" | tr 'A-Z' 'a-z')"
  orig_dir="${dir}_originales"; mkdir -p "$orig_dir"
  antes=$(rastros "$f")
  case "$ext" in
    mp4|mov|m4v) out="$dir/$stem.mp4"; tipo=video ;;
    *)           out="$dir/$stem.jpg"; tipo=imagen ;;
  esac
  tmp="$dir/.$stem.adaptando.${out##*.}"
  if [ "$tipo" = video ]; then detalle=$(adaptar_video "$f" "$tmp"); else detalle=$(adaptar_imagen "$f" "$tmp"); fi
  mv "$f" "$orig_dir/$base"
  mv "$tmp" "$out"
  despues=$(rastros "$out")
  estado="limpio"; [ "$despues" -gt 0 ] && { estado="QUEDAN RASTROS ($despues)"; FALLOS=$((FALLOS + 1)); }
  printf '%-28s %-24s rastros antes: %-3s ahora: %s\n' "$base -> $(basename "$out")" "$detalle" "$antes" "$estado"
done
rm -f "${dir}/.DS_Store" 2>/dev/null || true

echo "ORIGINALES=${orig_dir}"
echo "UBICACION=${CIUDAD}, ${ESTADO}, ${PAIS} (${LAT}, ${LON})"
if [ "$FALLOS" -gt 0 ]; then echo "ATENCIÓN: $FALLOS archivo(s) siguen con rastros; revisar a mano" >&2; exit 1; fi
echo "ok: ${#ARCHIVOS[@]} archivo(s) limpios"
