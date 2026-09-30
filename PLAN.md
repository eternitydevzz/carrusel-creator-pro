# Carrusel Creator Pro · plan

30 de septiembre de 2026. Proyecto nuevo, separado de `CARRUSELES TOP`, que pasa a ser su motor.

## Qué es

Una app local para Mac, en el navegador, que convierte links de Instagram (o un guion propio) en carruseles con tu marca, generados con Codex, listos para subir. Para ti y tu equipo de confianza. Se comparte como repositorio de GitHub: cada uno se lo descarga, lo instala con un comando y lo configura con su Codex, su clave de ScrapeCreators y su kit de marca.

## Decisiones cerradas

| Tema | Decisión |
|---|---|
| Quién | Tú y gente de confianza, cada uno en su Mac |
| Dónde corre | Local, `localhost:3000`. Nada sale del ordenador salvo las llamadas a ScrapeCreators y a Codex |
| Control | Dos paradas: aprobar la ficha antes de generar y aprobar el carrusel antes de cerrar |
| Entrada | Links de Instagram, o guion propio pegado ("SLIDE 1…") |
| Salida | JPG limpios para descargar (skill adaptar-para-subir incluida en el repo) |
| Kit de marca | Cada usuario sube el suyo: personaje, referencias de estilo, datos de marca, color |
| Metadatos | Se limpian siempre, con ubicación configurable |
| Nombre e idioma | Carrusel Creator Pro, en español |
| Estética | Glassmorphism oscuro estilo Apple: fondo cinematográfico con brillos azules difusos, paneles de cristal, acento #1A79FB |

## Arquitectura

```
carrusel-creator-pro/
  app/            Next.js (interfaz y API local)
  motor/          los scripts de CARRUSELES TOP: carrusel.sh, ficha.py, plantilla.swift, adaptar.sh
  datos/          lo del usuario, fuera de git: marca/, fichas/, virales/, salida/, CUPO.csv, ajustes.json
  instalar.sh     un comando: Homebrew, ffmpeg, exiftool, Node, Codex CLI, dependencias
  README.md       qué hace, qué necesita, cómo se instala, el cupo de Codex en la primera línea
```

La interfaz no genera nada por sí misma: llama al motor, que ya ha producido dos carruseles. Si el motor cambia, la interfaz no se toca.

## Pantallas

| Pantalla | Qué hace |
|---|---|
| Inicio | Pegar links o un guion. Botón "Crear carrusel". Tarjetas con los carruseles recientes |
| Ficha | La ficha por slide, editable en pantalla. Comprobación automática visible. Botón "Generar" |
| Generando | Progreso real (slides que van saliendo), tiempo y cupo. No bloquea la app |
| Revisión | Los slides en grande, lista de control, botón "Corregir" por slide con el cambio escrito, "Aprobar y cerrar" |
| Biblioteca | Carruseles cerrados con descarga en ZIP |
| Branding | Subir personaje, referencias, datos de marca y color. Vista previa del contador y el pie |
| Ajustes | Clave de ScrapeCreators, estado de Codex, cupo del día, ubicación de los metadatos |

## Fases

| Fase | Qué | Cuándo |
|---|---|---|
| 1 | Esqueleto: Next.js, sistema de diseño, motor copiado, datos migrados | Hoy |
| 2 | Inicio → Ficha → Generar → Revisión → Cerrar, con el motor real | Hoy |
| 3 | Branding y Ajustes | Hoy o mañana |
| 4 | Instalador, README, prueba en un Mac que no sea el tuyo | Cuando lo pruebe alguien del equipo |
| 5 | Repositorio en GitHub | Tras la prueba |

## Lo que no promete

- No acelera a Codex: cada carrusel tarda de 5 a 12 minutos.
- No publica en Instagram.
- No funciona sin Mac, sin Codex conectado ni sin clave de ScrapeCreators.
- No quita la necesidad de mirar el resultado: hoy 5 de cada 7 slides salen bien a la primera.
