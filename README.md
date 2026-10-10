# Carrusel Creator Pro

Convierte carruseles virales de Instagram (o tu propio guion) en carruseles con tu marca, generados con Codex, listos para subir. Corre en tu compu (**Mac o Windows**), en el navegador. Nada sale de tu ordenador salvo las llamadas a ScrapeCreators (descargar el original), a Claude Code (redactar la ficha) y a Codex (generar las imágenes).

> **Lo primero que tienes que saber:** Codex, con un plan de ChatGPT, bloquea la generación de imágenes en torno a las **60 imágenes al día por cuenta** (medido, no publicado). Un carrusel de 7 slides con dos correcciones son 9 imágenes. Eso da para 5 o 6 carruseles al día. La app lleva la cuenta y no lanza si no hay sitio.

## Qué necesitas

- Un **Mac** o una **PC con Windows 10/11**.
- Para instalar las herramientas: [Homebrew](https://brew.sh) en Mac, o **winget** en Windows (ya viene en Windows 10 y 11).
- Codex CLI conectado a tu cuenta de ChatGPT (`codex login`): genera las imágenes.
- Claude Code conectado a tu cuenta (`claude`): redacta las fichas.
- Una clave de [ScrapeCreators](https://scrapecreators.com) para descargar los carruseles originales (1 crédito por carrusel).
- Tus fotos: de 1 a 3 del personaje (con 2 o 3 la cara sale más fiel) y de 1 a 3 referencias de estilo.

Cada persona usa **sus propias cuentas** (ChatGPT para Codex, Claude, ScrapeCreators) y **su propia marca**. Nada se comparte entre usuarios: tus fotos, fichas, carruseles y claves viven en `datos/`, que nunca se sube a GitHub.

### ¿Por qué no se puede subir a Vercel?

No es solo poner unas claves. La app depende de cosas que corren en tu propia compu: Codex y Claude Code se usan con la sesión de tu plan (sin pagar API); los carruseles se guardan en disco y cada generación tarda de 5 a 12 minutos en segundo plano. En la nube habría que reescribirla y pagar cada imagen por API.

## Instalar

Descarga el ZIP desde la plataforma (o clona el repositorio si te dieron acceso) y descomprímelo.

**Mac** (en la Terminal, dentro de la carpeta):

```bash
./instalar.sh
```

El instalador pone Node (20 o más), Python con Pillow, ffmpeg y exiftool con Homebrew, instala Codex CLI (versión probada) y Claude Code si no están, y las dependencias de la app. Al terminar te dice cómo arrancar.

**Windows** (en PowerShell, dentro de la carpeta):

```powershell
powershell -ExecutionPolicy Bypass -File .\instalar.ps1
```

Instala con winget Node, Python, ffmpeg, ExifTool y Git, después Pillow, Codex CLI, Claude Code y las dependencias, y crea un acceso directo **Carrusel Creator Pro** en el escritorio. Si dice que no encuentra algo recién instalado, cierra PowerShell, abre una nueva y vuelve a ejecutarlo. Si `python` no responde, desactiva los alias de python en *Configuración → Aplicaciones → Alias de ejecución de aplicaciones*.

**Lo más fácil: que la instale tu Claude.** Abre Claude Code dentro de la carpeta (`cd carrusel-creator-pro` y `claude`) y dile *"instálame esta app"*. Sigue los pasos de `CLAUDE.md`: ejecuta el instalador, te dice qué tienes que hacer tú (por ejemplo `codex login`) y al final te pregunta si quieres el icono en el Dock que enciende y apaga el servidor solo.

## Arrancar

- **Mac:** `./arrancar.sh`
- **Windows:** doble clic en el acceso directo **Carrusel Creator Pro** del escritorio (o en `arrancar.cmd`).

Se abre sola en **`http://carrusel.localhost:3000`** (los nombres `*.localhost` llevan a tu propia compu sin configurar nada; usa Chrome). Deja abierta la ventana de la terminal mientras uses la app: al cerrarla se apaga.

### Instalarla como app (recomendado)

En Chrome, con la app abierta, pulsa el icono de **Instalar** de la barra de direcciones (o menú ⋮ → *Transmitir, guardar y compartir* → *Instalar página como aplicación*). Queda en el Dock y en Launchpad como **Carrusel Creator Pro**, con el logo de Código MaestrIA y su propia ventana, sin pestañas ni dirección. A partir de entonces, `./arrancar.sh` abre directamente esa ventana. Sigue siendo la misma app: necesita `./arrancar.sh` en marcha.

### Abrirla sin Terminal en Mac: el servidor se enciende y se apaga solo

Esto es solo para Mac. En Windows ya tienes el acceso directo del escritorio.

Con la app ya instalada desde Chrome, ejecuta una vez:

```bash
./crear-lanzador.sh
```

Crea el icono **Carrusel Creator Pro** en tu carpeta Aplicaciones (`~/Applications`), con el logo de Código MaestrIA. Arrástralo al Dock y quita el que instaló Chrome (clic derecho → Opciones → Quitar del Dock). Desde entonces:

- **Al abrirlo** se enciende el servidor y se abre la app (unos segundos la primera vez).
- **Al cerrar la app** (con la X o con Cmd+Q) el servidor se apaga solo. Solo apaga el servidor que encendió él: si lo arrancaste a mano con `./arrancar.sh`, no lo toca.
- Mientras está abierta verás dos iconos de Código MaestrIA en el Dock: el del lanzador y el de la ventana. Es normal.
- En Spotlight saldrán dos "Carrusel Creator Pro": el de la carpeta *Chrome Apps* abre la app sin encender el servidor. Usa el del Dock.
- Si algo falla, el registro está en `~/Library/Logs/carrusel-creator-pro.log`. Si mueves la carpeta del repositorio, vuelve a ejecutar `./crear-lanzador.sh`. Para quitarlo: `./crear-lanzador.sh --quitar`.

### Primera vez

La primera vez sale la **bienvenida**: un formulario de 11 pasos (unos 3 minutos) que deja todo configurado: tu nombre, tu @, el color, a quién le hablas, el lema del pie, tus fotos (de 1 a 3), tus referencias de estilo (de 1 a 3), la ropa, la clave de ScrapeCreators, la comprobación de Codex y Claude Code, y la ubicación de los metadatos. Se repite desde **Ajustes → Repetir bienvenida**, y todo se puede cambiar después en **Branding** y **Ajustes**.

Si Codex no está conectado, la bienvenida te da la orden exacta para la terminal (`codex login`).

Para probar con otra marca sin tocar la tuya, arranca con otra carpeta de datos: `CCP_DATOS=/ruta/a/otra/carpeta ./arrancar.sh` (en Windows: `$env:CCP_DATOS="C:\ruta"; .\arrancar.ps1`).

Al abrir o recargar la app sale la intro de Código MaestrIA (unos 3 segundos; se salta con un clic, Escape o Enter). Cuando la app recarga sola (al cambiar de cliente) no sale.

## Varios clientes

Cada cliente tiene **su marca** (fotos, @, color, lema, ángulo, ropa), **su ubicación** para los metadatos y **su biblioteca** de carruseles. Se cambia de cliente con el selector de arriba en la barra lateral; ahí también está **"+ Nuevo cliente"**, que abre una bienvenida corta (9 pasos) para dejar su marca lista. Nombre y ubicación están en **Branding**. Para **eliminar** un cliente, pulsa la papelera junto a su nombre en el selector (o **Eliminar cliente** en Branding).

Lo que se comparte entre clientes: la cuenta de Codex y su cupo de imágenes (una sola generación a la vez entre todos), la clave de ScrapeCreators y los ajustes.

En disco: `datos/perfiles/<cliente>/` (marca, fichas, originales, carruseles y `perfil.json`). Eliminar un cliente no borra nada: su carpeta pasa a `datos/_papelera/`. Si tus datos son de antes de los clientes, la app los convierte sola la primera vez que la abres, después de guardar una copia en `datos/_copias/`.

Desde la terminal: `PERFIL=<cliente> python3 motor/carrusel.py ...` trabaja con otro cliente sin cambiar el activo.

## Cómo funciona

| Paso | Quién | Qué pasa |
|---|---|---|
| Link o guion | Tú | Pegas el link del carrusel original, o tu guion con bloques "SLIDE 1", "SLIDE 2"… |
| Ficha | Claude Code (o tú) | Redacta la ficha de tu versión leyendo los slides del original: titulares, textos, idea de cada slide. Tú la editas en pantalla |
| Comprobación | La app | Frena cifras que no están en el original, textos demasiado largos y palabras que ya dieron problemas |
| Generar | Codex, una llamada | Genera la escena de cada slide, sin pie ni contador |
| Estampar | La app | Pone el contador y el pie idénticos en todos los slides |
| Revisión | Tú | Ves cada slide en grande, corriges lo que falle (1 imagen por corrección) y apruebas |
| Descripción | Claude Code | Botón "Crear descripción": texto para Instagram con 5 hashtags (propuestos por Claude, sin medir). "Crear 5 variaciones": cinco versiones con otro gancho, para probar |
| Cerrar | La app | Exporta JPG a 1080×1350 sin metadatos de AI, con la ubicación que elijas, y los deja para descargar en ZIP |

Dos paradas tuyas, la ficha y el resultado, porque hoy salen bien a la primera unos 5 de cada 7 slides.

## Actualizar

Cuando haya una versión nueva:

Descarga el ZIP nuevo y copia dentro tu carpeta `datos/`, o, si clonaste el repositorio:

```bash
git pull
./instalar.sh          # en Windows: powershell -ExecutionPolicy Bypass -File .\instalar.ps1
```

Tus datos no se tocan.

## Versiones probadas

El motor usa opciones concretas de Codex CLI y de Claude Code. Está probado con **Codex CLI 0.158.0** y **Claude Code 2.1**. El instalador pone esa versión de Codex y avisa si tienes otra. Si al generar falla con un error de opciones, vuelve a esa versión: `npm install -g @openai/codex@0.158.0`.

## Pruebas sin gasto

```bash
python3 motor/pruebas/correr.py     # en Windows: python motor\pruebas\correr.py
```

Prueba el motor con respuestas guardadas de ScrapeCreators y de Codex (carrusel con vídeos, foto suelta, reel, Codex que rehace imágenes, límite de uso, correcciones que fallan, reglas del personaje…). No gasta imágenes ni créditos y no toca `datos/`. Lánzalo después de cambiar algo del motor: tiene que terminar con "fallan 0". En `motor/pruebas/codex/*/origen` pone qué casos son reales y cuáles están construidos a mano.

## Si algo pisa el pie

A veces Codex lleva la escena hasta abajo y tapa el @. Sin gastar imágenes: `python3 motor/carrusel.py encoger <carrusel> <n>` encoge la escena de ese slide para dejar libre el pie (con `<factor> <px>` al final se puede encoger más o bajarla si el titular choca con el contador).

## Estructura

```
app/      la interfaz (Next.js) y su API local
motor/    el motor en Python (Mac y Windows): carrusel.py, ficha.py, bajar.py, plantilla/plantilla.py (pie y contador), adaptar.py
datos/    lo tuyo, fuera de git: perfiles/<cliente>/ (marca, fichas, virales, salida), CUPO.csv y ajustes.json compartidos
```

El motor se puede usar solo, sin la interfaz: `python3 motor/carrusel.py` (en Windows, `python`) sin argumentos enseña las órdenes. `motor/carrusel.sh` sigue funcionando en Mac: llama a carrusel.py.

## Lo que no hace

- No acelera a Codex: cada carrusel tarda de 5 a 12 minutos.
- No publica en Instagram.
- No funciona sin Codex conectado. Sin clave de ScrapeCreators no se pueden copiar carruseles virales (con tu propio guion, sí).
- No sustituye tu ojo: hay que mirar el resultado antes de cerrar.

## Metadatos

Al cerrar, cada imagen se recodifica como JPEG y se le borran todos los metadatos, incluido el manifiesto de contenido de AI que añade el generador. Como único dato se escribe una ubicación (por defecto Newark, New Jersey; cada cliente tiene la suya y se cambia en Branding). La marca de agua invisible en los píxeles se degrada con la recodificación, pero no hay forma de confirmar que desaparece. Úsalo bajo tu criterio y el de las normas de la plataforma donde publiques.
