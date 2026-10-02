# Carrusel Creator Pro · instrucciones para Claude

App local de Mac (Next.js en `app/` + motor en `motor/`) que convierte carruseles virales de Instagram en carruseles con la marca de cada cliente. Habla siempre en español con el usuario. Las instrucciones para personas están en `README.md`.

## Si el usuario te pide instalarla

Hazlo paso a paso, comprobando cada uno antes de seguir:

1. **Requisitos**: macOS y Homebrew (`brew`). Si falta Homebrew, dile que lo instale desde https://brew.sh (pide su contraseña: lo hace él).
2. **`./instalar.sh`**. Instala Node, ffmpeg, exiftool, Codex CLI (versión probada) y las dependencias. Lee su salida entera y resuelve lo que diga:
   - Si pide las herramientas de Xcode, se abre una ventana: que el usuario acepte y vuelve a ejecutar el script al terminar.
   - Si Codex no tiene sesión, el usuario ejecuta `codex login` (se abre el navegador con su cuenta de ChatGPT). No lo hagas por él ni escribas contraseñas.
3. **Arrancar**: `./arrancar.sh` (déjalo corriendo en segundo plano). La app se abre en **http://carrusel.localhost:3000**; usa siempre esa dirección, nunca "localhost:3000" a secas.
4. **Bienvenida**: el usuario la rellena en la app (su nombre, @, color, fotos, referencia de estilo, clave de ScrapeCreators). Las claves las pega él en la app: no las pidas por el chat ni las guardes en archivos.
5. **Pregúntale si quiere instalarla como app en su Mac**, con esta frase o parecida:
   > ¿Quieres instalarla como una app más del Mac? Tendrías un icono de Código MaestrIA en el Dock: al abrirlo se enciende el servidor solo y al cerrarlo se apaga, sin usar la Terminal.

   Si dice que sí:
   1. Con `./arrancar.sh` en marcha, que instale la app desde Chrome en http://carrusel.localhost:3000: icono de **Instalar** en la barra de direcciones (o menú ⋮ → Transmitir, guardar y compartir → Instalar página como aplicación). Ese clic lo hace él.
   2. Ejecuta **`./crear-lanzador.sh`**. Crea `~/Applications/Carrusel Creator Pro.app` (el icono con el servidor automático) y lo enseña en el Finder.
   3. Para el servidor que arrancaste en el paso 3 (desde ahora lo enciende el icono).
   4. Que arrastre ese icono al Dock y quite el que instaló Chrome (clic derecho → Opciones → Quitar del Dock). Que la abra siempre desde el icono nuevo.
   5. Compruébalo con él: al abrir el icono la app carga; al cerrarla (X o Cmd+Q), `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` da `000`. El registro está en `~/Library/Logs/carrusel-creator-pro.log`.

   Si mueve la carpeta del repositorio, hay que volver a ejecutar `./crear-lanzador.sh`. Para quitarlo: `./crear-lanzador.sh --quitar`.

## Si cambias código

- Después de tocar el motor (`motor/`), ejecuta `motor/pruebas/correr.sh`: tiene que terminar con "fallan 0". No gasta imágenes ni créditos.
- En `app/`: `npx tsc --noEmit -p .` y `npx eslint src`. Lee `app/AGENTS.md` antes de escribir código de Next.js (versión 16, con cambios).
- No des nada por terminado sin decir qué no se ha probado con una generación real (Codex gasta del cupo de ~60 imágenes al día).
- `datos/` es de cada usuario (marca, fotos, claves, carruseles) y nunca se sube a git.
