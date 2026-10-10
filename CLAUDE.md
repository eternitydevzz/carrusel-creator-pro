# Carrusel Creator Pro · instrucciones para Claude

App local para Mac y Windows (Next.js en `app/` + motor en Python en `motor/`) que convierte carruseles virales de Instagram en carruseles con la marca de cada cliente. Habla siempre en español con el usuario. Las instrucciones para personas están en `README.md`.

## Si el usuario te pide instalarla

Hazlo paso a paso, comprobando cada uno antes de seguir:

1. **Mira en qué sistema estás.**
   - **Mac:** hace falta Homebrew (`brew`). Si falta, dile que lo instale desde https://brew.sh (pide su contraseña: lo hace él).
   - **Windows:** hace falta winget (viene con Windows 10/11).
2. **Instalador**: en Mac `./instalar.sh`; en Windows `powershell -ExecutionPolicy Bypass -File .\instalar.ps1`. Instala Node, Python con Pillow, ffmpeg, exiftool, Codex CLI (versión probada), Claude Code y las dependencias (en Windows también Git y un acceso directo en el escritorio). Lee su salida entera y resuelve lo que diga:
   - En Windows, si no encuentra algo recién instalado, el usuario tiene que cerrar y abrir la terminal (o reiniciar Claude Code) y volver a ejecutarlo. Si `python` no responde, que desactive los alias de python en Configuración → Aplicaciones → Alias de ejecución de aplicaciones.
   - Si Codex no tiene sesión, el usuario ejecuta `codex login` (se abre el navegador con su cuenta de ChatGPT). No lo hagas por él ni escribas contraseñas.
3. **Arrancar**: en Mac `./arrancar.sh`; en Windows `arrancar.cmd` o el acceso directo del escritorio (déjalo corriendo en segundo plano). La app se abre en **http://carrusel.localhost:3000**; usa siempre esa dirección, nunca "localhost:3000" a secas.
4. **Bienvenida**: el usuario la rellena en la app (su nombre, @, color, fotos, referencia de estilo, clave de ScrapeCreators). Las claves las pega él en la app: no las pidas por el chat ni las guardes en archivos.
5. **Solo en Mac: pregúntale si quiere instalarla como app en su Mac** (en Windows ya tiene el acceso directo del escritorio), con esta frase o parecida:
   > ¿Quieres instalarla como una app más del Mac? Tendrías un icono de Código MaestrIA en el Dock: al abrirlo se enciende el servidor solo y al cerrarlo se apaga, sin usar la Terminal.

   Si dice que sí:
   1. Con `./arrancar.sh` en marcha, que instale la app desde Chrome en http://carrusel.localhost:3000: icono de **Instalar** en la barra de direcciones (o menú ⋮ → Transmitir, guardar y compartir → Instalar página como aplicación). Ese clic lo hace él.
   2. Ejecuta **`./crear-lanzador.sh`**. Crea `~/Applications/Carrusel Creator Pro.app` (el icono con el servidor automático) y lo enseña en el Finder.
   3. Para el servidor que arrancaste en el paso 3 (desde ahora lo enciende el icono).
   4. Que arrastre ese icono al Dock y quite el que instaló Chrome (clic derecho → Opciones → Quitar del Dock). Que la abra siempre desde el icono nuevo.
   5. Compruébalo con él: al abrir el icono la app carga; al cerrarla (X o Cmd+Q), `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` da `000`. El registro está en `~/Library/Logs/carrusel-creator-pro.log`.

   Si mueve la carpeta del repositorio, hay que volver a ejecutar `./crear-lanzador.sh`. Para quitarlo: `./crear-lanzador.sh --quitar`.

## Si cambias código

- Después de tocar el motor (`motor/`), ejecuta `python3 motor/pruebas/correr.py` (en Windows, `python`): tiene que terminar con "fallan 0". No gasta imágenes ni créditos. El motor tiene que seguir funcionando en Mac y en Windows: nada de herramientas de un solo sistema (sips, swift, zsh…); las imágenes, con Pillow.
- En `app/`: `npx tsc --noEmit -p .` y `npx eslint src`. Lee `app/AGENTS.md` antes de escribir código de Next.js (versión 16, con cambios).
- No des nada por terminado sin decir qué no se ha probado con una generación real (Codex gasta del cupo de ~60 imágenes al día).
- `datos/` es de cada usuario (marca, fotos, claves, carruseles) y nunca se sube a git.
