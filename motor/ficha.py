#!/usr/bin/env python3
"""Ficha de carrusel → prompt para Codex, y comprobación previa.

Uso:
  ficha.py comprobar <ficha.md>            comprueba la ficha; sale con 1 si algo falla
  ficha.py prompt <ficha.md> <salida.txt> <n_hojas_viral>   monta el prompt completo
  ficha.py nueva <nombre> <N> <carpeta_viral>               crea una ficha vacía en fichas/
"""
import os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
DATOS = os.environ.get("DATOS") or os.path.join(os.path.dirname(AQUI), "datos")
MARCA = os.path.join(DATOS, "marca", "marca.txt")
BASE = os.path.join(AQUI, "PROMPT_BASE.txt")
REGLAS = os.path.join(AQUI, "REGLAS.md")

OBLIGATORIAS = []  # por slide hace falta 'titular' o 'texto'; el resto es opcional
# Si la ficha no dice manos o ropa, se asignan rotando estas listas, para que no se repitan entre slides seguidos.
MANOS = ["señala con el índice el elemento principal", "presenta el elemento principal con la mano abierta",
         "brazos cruzados", "mano en la barbilla", "sostiene el elemento principal en la palma",
         "señala a cámara con el índice", "las dos manos apoyadas en la mesa", "mano en el bolsillo de la americana"]
# La ropa es siempre la de marca.txt; la casilla 'ropa' de la ficha solo se usa si Cristian quiere una excepción.


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
    # cifras: todas tienen que existir en el carrusel original
    viral = cab.get("viral", "")
    fuente = ""
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
        # cifras que Cristian ya dio por buenas aunque el original las escriba de otra forma (p. ej. 1.3B → 1.300 millones)
        conf = cab.get("cifras_confirmadas", "")
        cifras_fuente = numeros(fuente) | numeros(conf)
        if conf.strip().lower().startswith("todas"):
            cifras_fuente = None
        for k, s in slides.items():
            for c in ("titular", "debajo", "arriba", "texto_escena", "cta_grande", "texto"):
                for num in numeros(s.get(c, "")):
                    if len(num) < 2:
                        continue
                    if cifras_fuente is not None and num not in cifras_fuente:
                        fallos.append(f"Slide {k}: la cifra '{num}' de '{c}' no aparece en el carrusel original")
    m = leer_marca()
    for f in m.get("fotos", "").split(",") + [m.get("tipografia", "")]:
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
            t += f" En azul: \"{s['azul'].strip(chr(34))}\". El resto en blanco."
        out.append(t)
        if s.get("debajo"):
            out.append(f"Debajo, en letra más pequeña: {s['debajo']}")
    else:
        out.append("Texto del slide (el titular, de 5 a 10 palabras, sale de la idea central de este texto; el resto va como texto secundario, más pequeño; las cifras se escriben tal cual):")
        out.append(s["texto"])
    if s.get("cta_grande"):
        out.append(f"Abajo, grande y en azul: {s['cta_grande']}")
    if s.get("idea"):
        out.append(f"Idea del original: {s['idea']}")
    te = s.get("texto_escena", "").strip()
    if te and te.lower() not in ("ninguno", "ninguna", "no", "-"):
        out.append(f"El único texto que aparece dentro de la escena es este: {te}. Nada más: ni pestañas, ni fechas, ni cifras, ni logos.")
    else:
        out.append("Dentro de la escena solo puede aparecer texto que esté en el guion (por ejemplo, los datos en tarjetas o cajas). Ningún otro rótulo, pantalla con letras ni logo.")
    # personaje: no → el slide va sin Cristian (portadas con mascota u objeto, slides de "guarda este post"…)
    if sin_personaje(s):
        out.append("SIN PERSONAJE en este slide: aquí no aparece ninguna persona. La escena ocupa todo el encuadre, como en el slide original. La mascota o la persona del original tampoco aparecen.")
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
    fotos = [f.strip() for f in m["fotos"].split(",")]
    img = [f"{i+1}: foto del personaje." for i in range(len(fotos))]
    img.append(f"{len(fotos)+1}: miniatura de la marca, referencia de tipografía y acabado.")
    h = int(hojas)
    if h == 1:
        img.append(f"{len(fotos)+2}: los slides del carrusel original, en una hoja, de izquierda a derecha y de arriba abajo.")
    elif h > 1:
        img.append(f"{len(fotos)+2} a {len(fotos)+1+h}: los slides del carrusel original, 6 por hoja, de izquierda a derecha y de arriba abajo.")
    img.append(f"{len(fotos)+2+h}: guía de zonas. Muestra el contador y el pie que pondremos nosotros encima de cada slide. Sus dos zonas quedan libres en tu imagen.")
    base = open(BASE, encoding="utf-8").read()
    if h == 0:  # sin carrusel original: fuera la línea que habla de él
        base = "\n".join(l for l in base.split("\n") if not l.startswith("- Carrusel original:"))
    texto = (base.replace("{IMAGENES}", "\n".join(img))
                 .replace("{N}", str(n))
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


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__); sys.exit(64)
    if a[0] == "comprobar" and len(a) == 2:
        comprobar(a[1])
    elif a[0] == "prompt" and len(a) == 4:
        prompt(a[1], a[2], a[3])
    elif a[0] == "nueva" and len(a) == 4:
        nueva(a[1], a[2], a[3])
    else:
        print(__doc__); sys.exit(64)
