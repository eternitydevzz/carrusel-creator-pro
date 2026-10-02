# Carrusel Creator Pro

Convierte carruseles virales de Instagram (o tu propio guion) en carruseles con tu marca, generados con Codex, listos para subir. Corre en tu Mac, en el navegador. Nada sale de tu ordenador salvo las llamadas a ScrapeCreators (descargar el original), a Claude Code (redactar la ficha) y a Codex (generar las imágenes).

> **Lo primero que tienes que saber:** Codex, con un plan de ChatGPT, bloquea la generación de imágenes en torno a las **60 imágenes al día por cuenta** (medido, no publicado). Un carrusel de 7 slides con dos correcciones son 9 imágenes. Eso da para 5 o 6 carruseles al día. La app lleva la cuenta y no lanza si no hay sitio.

## Qué necesitas

- Un Mac (la plantilla del pie y el contador se dibuja con Swift).
- [Homebrew](https://brew.sh).
- Codex CLI conectado a tu cuenta de ChatGPT (`codex login`): genera las imágenes.
- Claude Code conectado a tu cuenta (`claude`): redacta las fichas.
- Una clave de [ScrapeCreators](https://scrapecreators.com) para descargar los carruseles originales (1 crédito por carrusel).
- Tus fotos: de 1 a 3 del personaje (con 2 o 3 la cara sale más fiel) y de 1 a 3 referencias de estilo.

Cada persona usa **sus propias cuentas** (ChatGPT para Codex, Claude, ScrapeCreators) y **su propia marca**. Nada se comparte entre usuarios: tus fotos, fichas, carruseles y claves viven en `datos/`, que nunca se sube a GitHub.

### ¿Por qué no se puede subir a Vercel?

No es solo poner unas claves. La app depende de cosas que solo hay en un Mac: el pie se dibuja con Swift y las imágenes se recortan con `sips`; Codex y Claude Code se usan con la sesión de tu plan (sin pagar API); los carruseles se guardan en disco y cada generación tarda de 5 a 12 minutos en segundo plano. En la nube habría que reescribirla y pagar cada imagen por API.

## Instalar

```bash
git clone <este repositorio> carrusel-creator-pro
cd carrusel-creator-pro
./instalar.sh
```

El instalador pone Node, ffmpeg y exiftool con Homebrew, instala Codex CLI si no está, y las dependencias de la app. Al terminar te dice cómo arrancar.

## Arrancar

```bash
./arrancar.sh
```

Abre `http://localhost:3000`. La primera vez sale la **bienvenida**: un formulario de 11 pasos (unos 3 minutos) que deja todo configurado: tu nombre, tu @, el color, a quién le hablas, el lema del pie, tus fotos, la referencia de estilo, la ropa, la clave de ScrapeCreators, la comprobación de Codex y Claude Code, y la ubicación de los metadatos. Se repite desde **Ajustes → Repetir bienvenida**, y todo se puede cambiar después en **Branding** y **Ajustes**.

Si Codex no está conectado, la bienvenida te da la orden exacta para la Terminal (`codex login`).

Para probar con otra marca sin tocar la tuya, arranca con otra carpeta de datos: `CCP_DATOS=/ruta/a/otra/carpeta ./arrancar.sh`.

Al abrir o recargar la app sale la intro de Código MaestrIA (unos 3 segundos; se salta con un clic, Escape o Enter). Cuando la app recarga sola (al cambiar de cliente) no sale.

## Varios clientes

Cada cliente tiene **su marca** (fotos, @, color, lema, ángulo, ropa), **su ubicación** para los metadatos y **su biblioteca** de carruseles. Se cambia de cliente con el selector de arriba en la barra lateral; ahí también está **"+ Nuevo cliente"**, que abre una bienvenida corta (9 pasos) para dejar su marca lista. Nombre, ubicación y **Eliminar cliente** están en **Branding**.

Lo que se comparte entre clientes: la cuenta de Codex y su cupo de imágenes (una sola generación a la vez entre todos), la clave de ScrapeCreators y los ajustes.

En disco: `datos/perfiles/<cliente>/` (marca, fichas, originales, carruseles y `perfil.json`). Eliminar un cliente no borra nada: su carpeta pasa a `datos/_papelera/`. Si tus datos son de antes de los clientes, la app los convierte sola la primera vez que la abres, después de guardar una copia en `datos/_copias/`.

Desde la Terminal: `PERFIL=<cliente> motor/carrusel.sh ...` trabaja con otro cliente sin cambiar el activo.

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

```bash
git pull
./instalar.sh
```

Tus datos no se tocan.

## Versiones probadas

El motor usa opciones concretas de Codex CLI y de Claude Code. Está probado con **Codex CLI 0.158.0** y **Claude Code 2.1**. El instalador pone esa versión de Codex y avisa si tienes otra. Si al generar falla con un error de opciones, vuelve a esa versión: `npm install -g @openai/codex@0.158.0`.

## Si algo pisa el pie

A veces Codex lleva la escena hasta abajo y tapa el @. Sin gastar imágenes: `motor/carrusel.sh encoger <carrusel> <n>` encoge la escena de ese slide para dejar libre el pie (con `<factor> <px>` al final se puede encoger más o bajarla si el titular choca con el contador).

## Estructura

```
app/      la interfaz (Next.js) y su API local
motor/    los scripts que hacen el trabajo: carrusel.sh, ficha.py, plantilla.swift, adaptar.sh
datos/    lo tuyo, fuera de git: perfiles/<cliente>/ (marca, fichas, virales, salida), CUPO.csv y ajustes.json compartidos
```

El motor se puede usar solo, sin la interfaz: `motor/carrusel.sh` sin argumentos enseña las órdenes.

## Lo que no hace

- No acelera a Codex: cada carrusel tarda de 5 a 12 minutos.
- No publica en Instagram.
- No funciona sin Mac, sin Codex conectado ni sin clave de ScrapeCreators.
- No sustituye tu ojo: hay que mirar el resultado antes de cerrar.

## Metadatos

Al cerrar, cada imagen se recodifica como JPEG y se le borran todos los metadatos, incluido el manifiesto de contenido de AI que añade el generador. Como único dato se escribe una ubicación (por defecto Newark, New Jersey; se cambia en Ajustes). La marca de agua invisible en los píxeles se degrada con la recodificación, pero no hay forma de confirmar que desaparece. Úsalo bajo tu criterio y el de las normas de la plataforma donde publiques.
