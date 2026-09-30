# Reglas de Carruseles Top

Único documento de reglas. Si una regla cambia, se cambia aquí.
El prompt que recibe Codex está en `PROMPT_BASE.txt`. Los datos de la marca, en `marca/marca.txt`.

## 1. Reparto de trabajo

| Quién | Qué hace |
|---|---|
| Codex | La escena de cada slide, sin contador ni pie |
| Claude | El contador y el pie, estampados con `plantilla/plantilla.swift`. Idénticos en todos los slides |
| Cristian | Aprueba la ficha antes de generar y el carrusel antes de cerrar |

Sin agentes. Un carrusel cada vez. El siguiente no empieza hasta que el anterior está aprobado.

## 2. La ficha

Es lo único que se escribe por carrusel. Casillas, no redacción. Ejemplo en `fichas/_ejemplo.md`.

Cabecera: `carrusel`, `slides`, `cta`, `viral` (carpeta con los slides originales), `bandera` (si/no).

Por slide hay dos formas. La corta es la de Cristian: solo `texto`. La larga controla más.

| Casilla | Qué va | Obligatoria |
|---|---|---|
| `texto` | El texto del slide tal cual, como en el guion de Cristian. El generador saca el titular de ahí | Sí, si no hay `titular` |
| `titular` | Las líneas entre comillas, separadas por ` / `. El generador lo escribe tal cual | Sí, si no hay `texto` |
| `azul` | La parte del titular que va en azul | No |
| `arriba` | Texto pequeño encima del titular | No |
| `debajo` | Texto secundario, entre comillas | No |
| `cta_grande` | Texto grande en azul abajo (llamada a la acción) | No |
| `idea` | Qué enseña el slide original y qué cuenta | No |
| `texto_escena` | Textos que aparecen dentro de la escena, entre comillas | No |
| `manos` | La única acción de las manos. Si falta, el script asigna una rotando una lista fija | No |
| `ropa` | Solo para una excepción. Por defecto, la ropa de `marca.txt`: traje azul marino y camisa blanca en todos los slides | No |
| `expresion` | Gesto y mirada | No |

Cabecera opcional: `cifras_confirmadas:` con las cifras que no están en el original pero Cristian da por buenas, o `todas` si el guion lo escribió él.

Reglas del copy:
- Portada y cierre: titular de 5 a 10 palabras, en 2 o 3 líneas.
- Texto secundario (`debajo`): 95 caracteres como máximo, dos líneas. Con tres líneas se mete en la franja del pie (pasó en el #11, slides 3 y 4). Lo comprueba el script.
- Interiores: número y nombre de la herramienta tal cual ("2. OLLAMA").
- El copy lleva el ángulo de `marca.txt`.
- Ninguna cifra que no esté en el carrusel original. Las que no vengan de ahí se quitan o se le piden a Cristian.
- Bandera de EEUU solo si el tema es dinero, negocio o EEUU.

## 3. Palabras prohibidas en la ficha

Cada una causó un fallo real. `carrusel.sh comprobar` se para si aparece alguna.

| Palabra | Qué provocó |
|---|---|
| `IA` | El público dice "AI" |
| `etiqueta` | El generador dibujó una caja de color |
| `panel` | Bordes desenfocados en un slide y no en los demás |
| `solo el icono` | Desapareció el @ del pie |
| `sugerencia` | El generador la ignoró: manos dobles |
| `si lo muestras` | Texto inventado dentro de la captura |
| `contador` / `pie` | No van en la ficha: los pone Claude |

## 4. Lista de control después de generar

Por slide, a tamaño completo:
- [ ] Texto exacto al de la ficha, con tildes.
- [ ] Nada en inglés salvo herramientas y marcas.
- [ ] Ningún rótulo, cifra, cartel o logo fuera de la ficha.
- [ ] Nada de la escena debajo de la línea del pie ni bajo el contador.
- [ ] Azul plano. Sin subrayados ni contorno.
- [ ] La cara es la de las fotos. Ropa elegante.
- [ ] Una sola acción con las manos.

Por carrusel:
- [ ] Contador y pie estampados en todos.
- [ ] Cara, pose y ropa distintas entre slides seguidos.
- [ ] Mismo estilo de principio a fin.

Correcciones: una ronda, solo lo que falle en la lista, con `carrusel.sh corregir`. Cada corrección adjunta las fotos del personaje: si no, la cara pierde calidad con cada edición (lo detectó Cristian en el #11, slides 2 y 6).

## 5. Lo que se mide

Por carrusel: slides publicables sin corrección / total (objetivo 9 de 10) e imágenes gastadas por slide publicable (objetivo menos de 1,3). Se apunta en `ESTADO.md`.

## 6. Cupo

Codex bloquea la generación de imágenes en torno a las 60 al día por cuenta (medido: 62 nosotros, 97 otro usuario; no está publicado). `CUPO.csv` lleva la cuenta y el script no lanza si no hay sitio para los slides más 3.

## 7. Cierre

Solo tras el ok de Cristian: JPG a 1080×1350 sin ningún metadato, se borran los archivos de trabajo y las copias de Codex, y se apunta el resultado en `ESTADO.md`.
