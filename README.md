# Carrusel Creator Pro

Convierte carruseles virales de Instagram (o tu propio guion) en carruseles con tu marca, generados con Codex, listos para subir. Corre en tu Mac, en el navegador. Nada sale de tu ordenador salvo las llamadas a ScrapeCreators (descargar el original), a Claude Code (redactar la ficha) y a Codex (generar las imágenes).

> **Lo primero que tienes que saber:** Codex, con un plan de ChatGPT, bloquea la generación de imágenes en torno a las **60 imágenes al día por cuenta** (medido, no publicado). Un carrusel de 7 slides con dos correcciones son 9 imágenes. Eso da para 5 o 6 carruseles al día. La app lleva la cuenta y no lanza si no hay sitio.

## Qué necesitas

- Un Mac (la plantilla del pie y el contador se dibuja con Swift).
- [Homebrew](https://brew.sh).
- Codex CLI conectado a tu cuenta de ChatGPT (`codex login`): genera las imágenes.
- Claude Code conectado a tu cuenta (`claude`): redacta las fichas.
- Una clave de [ScrapeCreators](https://scrapecreators.com) para descargar los carruseles originales (1 crédito por carrusel).
- Tus fotos: 2 o 3 del personaje y una referencia de estilo.

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

Abre `http://localhost:3000`. La primera vez:

1. **Ajustes:** conecta Codex (`codex login` en la Terminal si no lo está), pega tu clave de ScrapeCreators y ponle un nombre a tu cuenta.
2. **Branding:** sube 2 o 3 fotos del personaje, una referencia de estilo, tu @, tu color, tu ángulo de comunicación y la ropa del personaje.
3. **Inicio:** pega un link de Instagram o tu guion.

## Cómo funciona

| Paso | Quién | Qué pasa |
|---|---|---|
| Link o guion | Tú | Pegas el link del carrusel original, o tu guion con bloques "SLIDE 1", "SLIDE 2"… |
| Ficha | Claude Code (o tú) | Redacta la ficha de tu versión leyendo los slides del original: titulares, textos, idea de cada slide. Tú la editas en pantalla |
| Comprobación | La app | Frena cifras que no están en el original, textos demasiado largos y palabras que ya dieron problemas |
| Generar | Codex, una llamada | Genera la escena de cada slide, sin pie ni contador |
| Estampar | La app | Pone el contador y el pie idénticos en todos los slides |
| Revisión | Tú | Ves cada slide en grande, corriges lo que falle (1 imagen por corrección) y apruebas |
| Cerrar | La app | Exporta JPG a 1080×1350 sin metadatos de AI, con la ubicación que elijas, y los deja para descargar en ZIP |

Dos paradas tuyas, la ficha y el resultado, porque hoy salen bien a la primera unos 5 de cada 7 slides.

## Estructura

```
app/      la interfaz (Next.js) y su API local
motor/    los scripts que hacen el trabajo: carrusel.sh, ficha.py, plantilla.swift, adaptar.sh
datos/    lo tuyo, fuera de git: marca/, fichas/, virales/, salida/, CUPO.csv, ajustes.json
```

El motor se puede usar solo, sin la interfaz: `motor/carrusel.sh` sin argumentos enseña las órdenes.

## Lo que no hace

- No acelera a Codex: cada carrusel tarda de 5 a 12 minutos.
- No publica en Instagram.
- No funciona sin Mac, sin Codex conectado ni sin clave de ScrapeCreators.
- No sustituye tu ojo: hay que mirar el resultado antes de cerrar.

## Metadatos

Al cerrar, cada imagen se recodifica como JPEG y se le borran todos los metadatos, incluido el manifiesto de contenido de AI que añade el generador. Como único dato se escribe una ubicación (por defecto Newark, New Jersey; se cambia en Ajustes). La marca de agua invisible en los píxeles se degrada con la recodificación, pero no hay forma de confirmar que desaparece. Úsalo bajo tu criterio y el de las normas de la plataforma donde publiques.
