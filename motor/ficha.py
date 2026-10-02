#!/usr/bin/env python3
"""Ficha de carrusel → prompt para Codex, y comprobación previa.

Uso:
  ficha.py comprobar <ficha.md>            comprueba la ficha; sale con 1 si algo falla
  ficha.py prompt <ficha.md> <salida.txt> <n_hojas_viral>   monta el prompt completo
  ficha.py nueva <nombre> <N> <carpeta_viral>               crea una ficha vacía en fichas/
"""
import os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
# carpeta del cliente activo (la exporta carrusel.sh); sin perfiles, la carpeta de datos
DATOS = os.environ.get("DATOS_PERFIL") or os.environ.get("DATOS") or os.path.join(os.path.dirname(AQUI), "datos")
MARCA = os.path.join(DATOS, "marca", "marca.txt")
BASE = os.path.join(AQUI, "PROMPT_BASE.txt")
BASE_CLARO = os.path.join(AQUI, "PROMPT_BASE_CLARO.txt")  # cabecera 'estilo: claro': fondo claro como el original
ESTILO = {"claro": False, "mascotas": False, "mascotas_cara": False, "quien": "las fotos 1, 2 y 3"}  # lo rellena prompt() con la cabecera de la ficha
REGLAS = os.path.join(AQUI, "REGLAS.md")

OBLIGATORIAS = []  # por slide hace falta 'titular' o 'texto'; el resto es opcional
# Si la ficha no dice manos o ropa, se asignan rotando estas listas, para que no se repitan entre slides seguidos.
MANOS = ["señala con el índice el elemento principal", "presenta el elemento principal con la mano abierta",
         "brazos cruzados", "mano en la barbilla", "sostiene el elemento principal en la palma",
         "señala a cámara con el índice", "las dos manos apoyadas en la mesa", "mano en el bolsillo de la americana"]
# La ropa es siempre la de marca.txt; la casilla 'ropa' de la ficha solo se usa si el usuario quiere una excepción.


def leer_marca():
    m = {}
    for l in open(MARCA, encoding="utf-8"):
        if ":" in l:
            k, v = l.split(":", 1)
            m[k.strip()] = v.strip()
    return m


def leer_ficha(path):
    cab, slides, actual = {}, {}, None
    for raw in open(path, encoding="utf-8"):
        l = raw.rstrip("\n")
        if not l.strip():
            continue
        mm = re.match(r"^##\s*(\d+)\s*$", l)
        if mm:
            actual = int(mm.group(1)); slides[actual] = {}; continue
        if ":" not in l:
            raise SystemExit(f"Línea sin 'casilla: valor': {l}")
        k, v = l.split(":", 1); k, v = k.strip(), v.strip()
        (cab if actual is None else slides[actual])[k] = v
    return cab, slides


def palabras_prohibidas():
    out = []
    dentro = False
    for l in open(REGLAS, encoding="utf-8"):
        if l.startswith("## 3."):
            dentro = True; continue
        if dentro and l.startswith("## "):
            break
        if dentro and l.startswith("| `"):
            celda = l.split("|")[1]
            for p in re.findall(r"`([^`]+)`", celda):
                out.append(p)
    return out


def numeros(texto):
    # cifras como 51K, 1.300, 50, 24.000, 5,5k
    return {n.lower().replace(".", "").replace(",", "").replace(" ", "") for n in re.findall(r"\d[\d.,]*\s?[kKmM]?\b", texto)}


# cifra con su multiplicador: "1.2B", "1.2 billion", "1.200 millones" y "1.200 M" son la misma (1.200.000.000);
# "10K" y "10,000" también. Así la ficha puede traducir el formato sin que la comprobación la tome por inventada.
_MULT = {"k": 1e3, "mil": 1e3, "m": 1e6, "millon": 1e6, "millón": 1e6, "millones": 1e6, "million": 1e6, "millions": 1e6,
         "b": 1e9, "bn": 1e9, "billion": 1e9, "billions": 1e9, "mil millones": 1e9}
_CIFRA = re.compile(r"(\d[\d.,]*)\s?(mil millones|millones|millón|millon|millions?|billions?|mil|bn|[kKmMbB])?(?![\wáéíóúñ])", re.IGNORECASE)


def _valor(num, suf):
    num = num.rstrip(".,")
    partes = re.split(r"[.,]", num)
    if len(partes) > 1 and all(len(x) == 3 for x in partes[1:]):
        v = float("".join(partes))                      # 1.200 / 10,000: separador de miles
    elif len(partes) == 2:
        v = float(partes[0] + "." + partes[1])          # 1.2 / 5,5: decimales
    else:
        v = float("".join(partes))
    return round(v * _MULT.get((suf or "").lower(), 1), 3)


def valores(texto):
    return {_valor(n, s) for n, s in _CIFRA.findall(texto)}


def comprobar(path):
    cab, slides = leer_ficha(path)
    fallos = []
    for k in ("carrusel", "slides", "cta", "viral"):
        if k not in cab:
            fallos.append(f"Falta '{k}' en la cabecera")
    n = int(cab.get("slides", 0) or 0)
    if sorted(slides) != list(range(1, n + 1)):
        fallos.append(f"La cabecera dice {n} slides y la ficha tiene {sorted(slides)}")
    prohib = palabras_prohibidas()
    texto_total = open(path, encoding="utf-8").read()
    for p in prohib:
        pat = r"(?<![\wáéíóúñ])" + re.escape(p) + r"(?![\wáéíóúñ])"
        flags = 0 if p.isupper() else re.IGNORECASE
        if re.search(pat, texto_total, flags):
            fallos.append(f"Palabra prohibida en la ficha: '{p}' (ver REGLAS.md, punto 3)")
    for k, s in slides.items():
        if not s.get("titular") and not s.get("texto"):
            fallos.append(f"Slide {k}: falta 'titular' o 'texto'")
        if s.get("personaje") and s["personaje"].strip().lower() not in ("si", "sí", "no", "sin", "ninguno"):
            fallos.append(f"Slide {k}: 'personaje' solo admite si o no (tiene '{s['personaje']}')")
        if sin_personaje(s) and (s.get("manos") or s.get("expresion")):
            fallos.append(f"Slide {k}: va sin personaje pero tiene 'manos' o 'expresion'; déjalas vacías")
        if len(s.get("debajo", "")) > 95:
            fallos.append(f"Slide {k}: 'debajo' tiene {len(s['debajo'])} caracteres; más de 95 son 3 líneas y se meten en el pie (pasó en el #11)")
        if s.get("titular"):
            lineas = [x.strip().strip('"') for x in s["titular"].split(" / ")]
            if not all(x.startswith('"') and x.endswith('"') for x in s["titular"].split(" / ")):
                fallos.append(f"Slide {k}: cada línea del titular va entre comillas")
            palabras = sum(len(x.split()) for x in lineas)
            if k in (1, n) and not (5 <= palabras <= 10):
                fallos.append(f"Slide {k}: el titular tiene {palabras} palabras; portada y cierre van de 5 a 10")
            if s.get("azul") and s["azul"].strip('"') not in " ".join(lineas):
                fallos.append(f"Slide {k}: 'azul' ({s['azul']}) no está dentro del titular")
    # el cliente tiene que dar la cara al menos una vez: si el original no lleva a nadie, sale en el último slide
    if slides and all(sin_personaje(s) for s in slides.values()):
        fallos.append(f"El cliente no sale en ningún slide: pon 'personaje: si' al menos en el último (slide {max(slides)}), con sus manos y su expresión")
    # cifras: todas tienen que existir en el carrusel original
    viral = cab.get("viral", "")
    fuente = ""
    # datos movidos (p. ej. al pasar a perfiles): si la ruta guardada ya no existe, el original está en la carpeta del cliente
    if viral and not os.path.isdir(viral) and os.path.isdir(os.path.join(DATOS, "virales", os.path.basename(viral.rstrip("/")))):
        viral = os.path.join(DATOS, "virales", os.path.basename(viral.rstrip("/")))
    if viral.strip().lower() in ("ninguno", "ninguna", "no", ""):
        fuente = None  # guion propio: no hay original con el que comparar cifras
    elif os.path.isdir(viral):
        for f in os.listdir(viral):
            if f.endswith((".txt", ".md")):
                fuente += open(os.path.join(viral, f), encoding="utf-8", errors="ignore").read()
        # de las descripciones solo vale la sección de ESTE viral, no la de los demás
        vd = os.path.join(DATOS, "virales_descritos")
        nombre = os.path.basename(viral.rstrip("/"))
        for f in os.listdir(vd) if os.path.isdir(vd) else []:
            t = open(os.path.join(vd, f), encoding="utf-8", errors="ignore").read()
            for sec in re.split(r"\n(?=##? )", t):
                if nombre in sec.split("\n", 1)[0]:
                    fuente += sec
    else:
        fallos.append(f"No existe la carpeta del viral: {viral}")
    if fuente:
        # cifras que el usuario ya dio por buenas aunque el original las escriba de otra forma (p. ej. 1.3B → 1.300 millones)
        conf = cab.get("cifras_confirmadas", "")
        cifras_fuente = numeros(fuente) | numeros(conf)
        valores_fuente = valores(fuente) | valores(conf)
        if conf.strip().lower().startswith("todas"):
            cifras_fuente = None
        for k, s in slides.items():
            for c in ("titular", "debajo", "arriba", "texto_escena", "cta_grande", "texto"):
                for m_cifra in _CIFRA.finditer(s.get(c, "")):
                    n_txt, suf = m_cifra.group(1), m_cifra.group(2)
                    num = numeros(n_txt + (" " + suf if suf and len(suf) == 1 else ""))
                    num = next(iter(num)) if num else n_txt
                    if len(num) < 2:
                        continue
                    # vale si está escrita igual o si vale lo mismo (1.2B = 1.200 millones)
                    if cifras_fuente is not None and num not in cifras_fuente and _valor(n_txt, suf) not in valores_fuente:
                        fallos.append(f"Slide {k}: la cifra '{m_cifra.group(0).strip()}' de '{c}' no aparece en el carrusel original")
    m = leer_marca()
    for f in m.get("fotos", "").split(",") + m.get("tipografia", "").split(","):
        f = f.strip()
        if f and not os.path.isfile(os.path.join(DATOS, "marca", f)):
            fallos.append(f"Falta la foto de marca {f}")
    if fallos:
        print("FICHA CON FALLOS:")
        for f in fallos:
            print(" -", f)
        sys.exit(1)
    print(f"Ficha correcta: {cab['carrusel']} · {n} slides · CTA {cab['cta']}")


def render_slide(k, s, n):
    out = [f"SLIDE {k} de {n}"]
    if s.get("arriba"):
        out.append(f"Arriba, pequeño y en letras azules, sin caja: {s['arriba']}")
    if s.get("titular"):
        lineas = s["titular"].split(" / ")
        t = f"Titular, en {len(lineas)} línea{'s' if len(lineas) > 1 else ''}: {' / '.join(lineas)}."
        if s.get("azul"):
            t += f" En azul: \"{s['azul'].strip(chr(34))}\". El resto en {'negro' if ESTILO['claro'] else 'blanco'}."
        out.append(t)
        if s.get("debajo"):
            out.append(f"Debajo, en letra más pequeña: {s['debajo']}")
        if s.get("subrayado"):
            out.append(f"Subrayado a mano: un trazo de rotulador azul, irregular, debajo de \"{s['subrayado'].strip(chr(34))}\". Ningún otro subrayado en el titular.")
        if s.get("caja"):
            out.append(f"Caja de color: detrás de \"{s['caja'].strip(chr(34))}\" va una mancha de rotulador en el azul de la marca, con bordes irregulares, y la palabra encima en BLANCO (nunca en negro). Ninguna otra caja.")
    else:
        out.append("Texto del slide (el titular, de 5 a 10 palabras, sale de la idea central de este texto; el resto va como texto secundario, más pequeño; las cifras se escriben tal cual):")
        out.append(s["texto"])
    if s.get("cta_grande"):
        out.append(f"Abajo, grande y en azul: {s['cta_grande']}")
    if s.get("idea"):
        out.append(f"Idea del original: {s['idea']}")
    te = s.get("texto_escena", "").strip()
    if te and te.lower() not in ("ninguno", "ninguna", "no", "-"):
        cierre = ("Nada más: ni pestañas, ni fechas, ni otras cifras; y ningún logo salvo los de las herramientas que nombra el guion."
                  if ESTILO["claro"] else "Nada más: ni pestañas, ni fechas, ni cifras, ni logos.")
        out.append(f"El único texto que aparece dentro de la escena es este: {te}. {cierre}")
    else:
        out.append("Dentro de la escena solo puede aparecer texto que esté en el guion (por ejemplo, los datos en tarjetas o cajas). Ningún otro rótulo, pantalla con letras ni logo.")
    # personaje: no → el slide va sin el personaje (portadas con mascota u objeto, slides de "guarda este post"…)
    if sin_personaje(s):
        if ESTILO["mascotas"]:  # cabecera 'mascotas: si': los muñecos del original son la idea del carrusel y se quedan
            if ESTILO.get("mascotas_cara"):
                out.append("SIN PERSONAJE en este slide: el personaje de las fotos no aparece como persona. Los muñecos de píxel del original SÍ aparecen, como en el slide original (son los agentes de AI), y cada muñeco lleva la cara del personaje de " + ESTILO["quien"] + ", reconocible, sobre su cuerpo de vóxel, con su gorro o accesorio del original.")
            else:
                out.append("SIN PERSONAJE en este slide: el personaje de las fotos no aparece. Los muñecos de píxel del original SÍ aparecen, como en el slide original: son los agentes de AI.")
        else:
            # la mascota, el muñeco o el objeto del original se quedan (decisión de Cristian, 2-10-2026); antes se quitaban
            out.append("SIN PERSONAJE en este slide: aquí no aparece ninguna persona. Si el slide original lleva una mascota, un muñeco o un objeto protagonista, se queda como en el original, sin la cara de nadie. La escena ocupa todo el encuadre, como en el slide original.")
        return "\n".join(out)
    ropa = s.get("ropa") or leer_marca().get("ropa", "").split(".")[0]
    manos = s.get("manos") or MANOS[(k - 1) % len(MANOS)]
    pers = f"Personaje: {ropa}."
    if s.get("expresion"):
        pers += f" {s['expresion'][0].upper() + s['expresion'][1:]}."
    pers += f" UNA sola acción con las manos: {manos}."
    out.append(pers)
    return "\n".join(out)


def sin_personaje(s):
    return s.get("personaje", "").strip().lower() in ("no", "sin", "ninguno")


def prompt(path, salida, hojas):
    cab, slides = leer_ficha(path)
    m = leer_marca()
    n = int(cab["slides"])
    # marca incompleta (cliente recién creado o marca.txt editado a mano): avisar de qué falta, sin errores de Python
    faltan = [q for k, q in (("fotos", "las fotos del personaje"), ("tipografia", "la referencia de estilo"), ("ropa", "la ropa"), ("azul", "el color")) if not m.get(k, "").strip()]
    if faltan:
        verbo = "le falta" if len(faltan) == 1 and not faltan[0].startswith("las ") else "le faltan"
        raise SystemExit(f"FALTA_MARCA: a la marca de este cliente {verbo} {', '.join(faltan)}. Complétalo en Branding antes de generar.")
    fotos = [f.strip() for f in m["fotos"].split(",") if f.strip()]
    estilos = [f.strip() for f in m["tipografia"].split(",") if f.strip()]  # referencias de estilo: de 1 a 3
    # qué imágenes son la cara: con 1 foto, las imágenes 2 y 3 ya son referencias de estilo y no pueden llamarse "fotos del personaje"
    ESTILO["quien"] = {1: "la foto 1", 2: "las fotos 1 y 2"}.get(len(fotos), "las fotos 1, 2 y 3")
    # el orden tiene que ser el mismo en que carrusel.sh adjunta las imágenes (refs_marca: fotos, estilos; luego hojas y guía)
    img = [f"{i+1}: foto del personaje." for i in range(len(fotos))]
    e0 = len(fotos) + 1
    img.append(f"{e0}: referencia de estilo de la marca (tipografía y acabado)." if len(estilos) == 1 else f"{e0} a {e0+len(estilos)-1}: referencias de estilo de la marca (tipografía y acabado).")
    sig = e0 + len(estilos)
    h = int(hojas)
    if h == 1:
        img.append(f"{sig}: los slides del carrusel original, en una hoja, de izquierda a derecha y de arriba abajo.")
    elif h > 1:
        img.append(f"{sig} a {sig+h-1}: los slides del carrusel original, 6 por hoja, de izquierda a derecha y de arriba abajo.")
    img.append(f"{sig+h}: guía de zonas. Muestra el contador y el pie que pondremos nosotros encima de cada slide. Sus dos zonas quedan libres en tu imagen.")
    ESTILO["claro"] = cab.get("estilo", "").strip().lower() == "claro"
    ESTILO["mascotas"] = cab.get("mascotas", "").strip().lower() in ("si", "sí", "cara")
    ESTILO["mascotas_cara"] = cab.get("mascotas", "").strip().lower() == "cara"  # los muñecos llevan la cara del personaje
    base = open(BASE_CLARO if ESTILO["claro"] else BASE, encoding="utf-8").read()
    if h == 0:  # sin carrusel original: fuera la línea que habla de él
        base = "\n".join(l for l in base.split("\n") if not l.startswith("- Carrusel original:"))
    texto = (base.replace("{IMAGENES}", "\n".join(img))
                 .replace("{N}", str(n))
                 .replace("{FOTOS_PERSONAJE}", ESTILO["quien"])
                 .replace("{ROPA}", m["ropa"].split(".")[0])
                 .replace("{AZUL}", m["azul"])
                 .replace("{SLIDES}", "\n\n".join(render_slide(k, slides[k], n) for k in sorted(slides))))
    open(salida, "w", encoding="utf-8").write(texto)
    print(f"Prompt montado: {salida} ({len(texto)} caracteres)")


def nueva(nombre, n, viral):
    path = os.path.join(DATOS, "fichas", f"{nombre}.md")
    if os.path.exists(path):
        raise SystemExit(f"Ya existe {path}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"carrusel: {nombre}\nslides: {n}\ncta: \nviral: {viral}\nbandera: no\n")
        for k in range(1, int(n) + 1):
            f.write(f"\n## {k}\ntitular: \nazul: \ndebajo: \nidea: \ntexto_escena: ninguno\nmanos: \nropa: \nexpresion: \n")
    print(f"Ficha creada: {path}")


def prompt_descripcion(path, salida):
    """Monta el prompt de la descripción de Instagram a partir de la ficha y marca.txt."""
    cab, _ = leer_ficha(path)
    m = leer_marca()
    plantilla = open(os.path.join(AQUI, "PROMPT_DESCRIPCION.txt"), encoding="utf-8").read()
    texto = (plantilla.replace("{HANDLE}", m.get("handle", ""))
                      .replace("{ANGULO}", m.get("angulo", ""))
                      .replace("{IDIOMA}", m.get("idioma", "español"))
                      .replace("{CTA}", cab.get("cta", "").strip() or "la palabra clave")
                      .replace("{FICHA}", open(path, encoding="utf-8").read()))
    open(salida, "w", encoding="utf-8").write(texto)


def fallos_descripcion(t, ficha):
    """Lo que tiene mal un texto de descripción: hashtags que no son 5, "IA", más de 2.200 caracteres
    (el máximo de Instagram) o una cifra que no está en la ficha."""
    fallos = []
    tags = re.findall(r"#\w+", t)
    if len(tags) != 5:
        fallos.append(f"tiene {len(tags)} hashtags y tienen que ser 5: {' '.join(tags)}")
    if re.search(r"\bIA\b", t):
        fallos.append('dice "IA"; se dice "AI"')
    if len(t) > 2200:
        fallos.append(f"tiene {len(t)} caracteres; Instagram admite 2.200")
    cifras_ficha = numeros(ficha)
    for num in sorted(numeros(re.sub(r"#\w+", "", t))):
        if len(num) >= 2 and num not in cifras_ficha:
            fallos.append(f"la cifra {num} no está en la ficha")
    return fallos


def comprobar_descripcion(path_ficha, path_desc):
    t = open(path_desc, encoding="utf-8").read().strip()
    fallos = fallos_descripcion(t, open(path_ficha, encoding="utf-8").read())
    if fallos:
        print("DESCRIPCIÓN RECHAZADA: " + "; ".join(fallos))
        sys.exit(1)
    print(f"Descripción correcta: {len(t)} caracteres · hashtags: {' '.join(re.findall(r'#\w+', t))}")


MARCA_VARIACION = re.compile(r"^=== VARIACI[ÓO]N (\d+) ===\s*$", re.M)


def partir_variaciones(texto):
    """Trocea el texto por las líneas '=== VARIACIÓN N ==='. Devuelve la lista de variaciones en orden."""
    partes = MARCA_VARIACION.split(texto)
    # partes = [antes, n1, texto1, n2, texto2, ...]
    return [partes[i + 1].strip() for i in range(1, len(partes) - 1, 2)]


def prompt_variaciones(path_ficha, path_desc, salida):
    cab, _ = leer_ficha(path_ficha)
    m = leer_marca()
    plantilla = open(os.path.join(AQUI, "PROMPT_VARIACIONES.txt"), encoding="utf-8").read()
    texto = (plantilla.replace("{HANDLE}", m.get("handle", ""))
                      .replace("{ANGULO}", m.get("angulo", ""))
                      .replace("{IDIOMA}", m.get("idioma", "español"))
                      .replace("{CTA}", cab.get("cta", "").strip() or "la palabra clave")
                      .replace("{FICHA}", open(path_ficha, encoding="utf-8").read())
                      .replace("{DESCRIPCION}", open(path_desc, encoding="utf-8").read().strip()))
    open(salida, "w", encoding="utf-8").write(texto)


def comprobar_variaciones(path_ficha, path_var):
    """Para si no son exactamente 5, si alguna falla el filtro de la descripción,
    o si dos repiten la primera línea o la misma combinación de hashtags."""
    ficha = open(path_ficha, encoding="utf-8").read()
    vs = partir_variaciones(open(path_var, encoding="utf-8").read())
    fallos = []
    if len(vs) != 5:
        fallos.append(f"hay {len(vs)} variaciones y tienen que ser 5")
    for i, v in enumerate(vs, 1):
        fallos += [f"variación {i}: {f}" for f in fallos_descripcion(v, ficha)]
    primeras = [v.split("\n", 1)[0].strip().lower() for v in vs]
    tags = [frozenset(t.lower() for t in re.findall(r"#\w+", v)) for v in vs]
    for i in range(len(vs)):
        for j in range(i + 1, len(vs)):
            if primeras[i] == primeras[j]:
                fallos.append(f"las variaciones {i+1} y {j+1} empiezan igual")
            if tags[i] == tags[j]:
                fallos.append(f"las variaciones {i+1} y {j+1} llevan los mismos hashtags")
    if fallos:
        print("VARIACIONES RECHAZADAS: " + "; ".join(fallos))
        sys.exit(1)
    print(f"Variaciones correctas: {len(vs)} · caracteres: {', '.join(str(len(v)) for v in vs)}")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__); sys.exit(64)
    if a[0] == "comprobar" and len(a) == 2:
        comprobar(a[1])
    elif a[0] == "prompt" and len(a) == 4:
        prompt(a[1], a[2], a[3])
    elif a[0] == "prompt_descripcion" and len(a) == 3:
        prompt_descripcion(a[1], a[2])
    elif a[0] == "comprobar_descripcion" and len(a) == 3:
        comprobar_descripcion(a[1], a[2])
    elif a[0] == "prompt_variaciones" and len(a) == 4:
        prompt_variaciones(a[1], a[2], a[3])
    elif a[0] == "comprobar_variaciones" and len(a) == 3:
        comprobar_variaciones(a[1], a[2])
    elif a[0] == "campo" and len(a) == 4:  # campo <ficha> <n> <casilla>: el valor de una casilla de un slide (vacío si no está)
        _, sl = leer_ficha(a[1])
        print(sl.get(int(a[2]), {}).get(a[3], "").strip().strip('"'))
    elif a[0] == "nueva" and len(a) == 4:
        nueva(a[1], a[2], a[3])
    else:
        print(__doc__); sys.exit(64)
