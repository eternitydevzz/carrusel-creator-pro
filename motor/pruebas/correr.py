#!/usr/bin/env python3
"""Pruebas del motor sin gasto: no llama a ScrapeCreators ni a Codex, no gasta imágenes ni créditos y no toca datos/.
  python3 motor/pruebas/correr.py            todas
  python3 motor/pruebas/correr.py bajar      solo las que contienen "bajar" en el nombre
Usa respuestas guardadas (scrapecreators/*.json, codex/*/codex.log; en codex/*/origen pone si son reales o sintéticas)
y una marca de prueba con imágenes lisas (datos/). Cada prueba corre en una carpeta temporal que se borra al final.
Funciona igual en Mac, Windows y Linux (Python 3.9+, Pillow y ffmpeg).
"""
import datetime
import filecmp
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

AQUI = Path(__file__).resolve().parent
MOTOR = AQUI.parent
PYM = MOTOR / "carrusel.py"
FILTRO = sys.argv[1] if len(sys.argv) > 1 else ""
TMP = Path(tempfile.mkdtemp())
PASAN, FALLAN = 0, []
SALIDA, RC = "", 0
D = P = None
ANSI = re.compile(r"\x1b\[[0-9;]*m")
COLOR = sys.stdout.isatty() and os.name != "nt"
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass


def leer(p):
    return Path(p).read_bytes().decode("utf-8", errors="replace")


def escribir(p, t):
    Path(p).write_bytes(t.encode("utf-8"))


def preparar(nombre):
    """Carpeta de datos nueva para cada prueba (DATOS, PERFIL y GEN propios)."""
    global D, P
    D = TMP / nombre
    shutil.rmtree(D, ignore_errors=True)
    shutil.copytree(AQUI / "datos", D)
    P = D / "perfiles" / "prueba"
    for x in (P / "virales", P / "salida", D / "gen"):
        x.mkdir(parents=True, exist_ok=True)
    # la ruta del original en las fichas apunta a la carpeta temporal
    for f in (P / "fichas").glob("*.md"):
        escribir(f, "\n".join(l.replace("VIRALES/", str(P / "virales") + os.sep, 1) for l in leer(f).split("\n")))


def correr(args, extra=None, script=PYM):
    global SALIDA, RC
    e = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
    e.update(extra or {})
    r = subprocess.run([sys.executable, str(script)] + [str(a) for a in args], env=e, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    SALIDA, RC = r.stdout.decode("utf-8", errors="replace").rstrip("\n"), r.returncode
    return RC


def motor(*args, **extra):
    return correr(args, dict({"DATOS": str(D), "PERFIL": "prueba", "GEN": str(D / "gen")}, **extra))


def original(nombre, n):
    """Slides del original hechos con la imagen de prueba."""
    d = P / "virales" / nombre
    d.mkdir(parents=True, exist_ok=True)
    for k in range(1, n + 1):
        shutil.copyfile(AQUI / "slide_prueba.jpg", d / f"slide_{k:02d}.jpg")


def _hora(k):
    return datetime.datetime(2026, 1, 1, 12, k).timestamp()


def codex(caso):
    """Codex simulado con su log y sus imágenes (lisas, de colores distintos, en orden de creación)."""
    log = AQUI / "codex" / caso / "codex.log"
    os.environ["CODEX_SIMULADO"] = str(log)
    sid = ""
    for l in ANSI.sub("", leer(log)).split("\n"):
        if "session id:" in l:
            c = l.split()
            sid = c[2] if len(c) > 2 else ""
            break
    sid = sid or "sin_sesion"
    n = int(leer(AQUI / "codex" / caso / "imagenes").strip() or 0)
    g = D / "gen" / sid
    g.mkdir(parents=True, exist_ok=True)
    for k in range(1, n + 1):
        f = g / f"img_{k}.png"
        Image.new("RGB", (1080, 1350), ((k * 29) % 256, 90, (250 - k * 23) % 256)).save(f)
        os.utime(f, (_hora(k), _hora(k)))
    # codex/<caso>/rota: número de la imagen que llega rota (no es una imagen)
    rota = AQUI / "codex" / caso / "rota"
    if rota.is_file():
        k = int(leer(rota).strip())
        f = g / f"img_{k}.png"
        escribir(f, "no es una imagen\n")
        os.utime(f, (_hora(k), _hora(k)))


def slides(nombre):
    try:
        return sum(1 for x in os.listdir(P / "salida" / nombre) if re.fullmatch(r"[0-9]+\.png", x))
    except OSError:
        return 0


def n_slides_viral(nombre):
    try:
        return sum(1 for x in os.listdir(P / "virales" / nombre) if x.startswith("slide_"))
    except OSError:
        return 0


def igual(a, b):
    try:
        return filecmp.cmp(a, b, shallow=False)
    except OSError:
        return False


def contiene(p, texto, ignorar_mayus=False):
    try:
        t = leer(p)
    except OSError:
        return False
    return texto.lower() in t.lower() if ignorar_mayus else texto in t


def linea_empieza(p, prefijo):
    try:
        return any(l.startswith(prefijo) for l in leer(p).split("\n"))
    except OSError:
        return False


def capas():
    try:
        return os.listdir(D / "capas")
    except OSError:
        return []


def lineas_cupo():
    try:
        return len(leer(D / "CUPO.csv").splitlines())
    except OSError:
        return 0


def prueba(nombre, espera, fn):
    global PASAN, SALIDA, RC
    if FILTRO and FILTRO not in nombre:
        return
    os.environ.pop("CODEX_SIMULADO", None)
    SALIDA, RC = "", 0
    preparar(nombre)
    try:
        ok = bool(fn())
    except Exception as e:  # una prueba que rompe cuenta como fallo, con el error en la salida
        ok, SALIDA = False, f"{SALIDA} · error en la prueba: {type(e).__name__}: {e}"
    if ok:
        PASAN += 1
        print(("\x1b[32mPASA\x1b[0m" if COLOR else "PASA") + f"  {nombre}", flush=True)
    else:
        FALLAN.append(nombre)
        print(("\x1b[31mFALLA\x1b[0m" if COLOR else "FALLA") + f" {nombre} — se espera: {espera}", flush=True)
        print(f"      salida (código {RC}): {SALIDA.replace(chr(10), ' · ')[:300]}", flush=True)


# ---------- descarga (fase 1) ----------
def bajar(resp, url="https://www.instagram.com/p/PRUEBA/"):
    return motor("bajar", url, "orig", SC_RESPUESTA=str(resp), SC_SIN_IMAGENES="1")


def p_bajar_videos():
    bajar(AQUI / "scrapecreators" / "carrusel_con_videos.json")
    return RC == 0 and n_slides_viral("orig") == 6 and (P / "virales" / "orig" / "slide_06.jpg").is_file()


def p_bajar_fotos():
    bajar(AQUI / "scrapecreators" / "carrusel_solo_fotos.json")
    return RC == 0 and n_slides_viral("orig") == 7


def p_bajar_foto_suelta():
    bajar(AQUI / "scrapecreators" / "foto_suelta.json")
    return RC == 6 and "NO_ES_CARRUSEL" in SALIDA and n_slides_viral("orig") == 0


def p_bajar_reel():
    bajar(AQUI / "scrapecreators" / "reel.json", "https://www.instagram.com/reel/PRUEBA/")
    return RC == 6 and "NO_ES_CARRUSEL" in SALIDA and not (P / "virales" / "orig").exists()


def p_bajar_error_api():
    escribir(D / "r.json", '{"success":false,"error":"Post no encontrado"}\n')
    bajar(D / "r.json")
    return RC != 0 and "no devolvió" in SALIDA


def _respuesta_cambiada(cambiar):
    with open(AQUI / "scrapecreators" / "carrusel_con_videos.json", encoding="utf-8") as f:
        d = json.load(f)
    m = (d.get("data") or d)["xdt_shortcode_media"]
    cambiar(m["edge_sidecar_to_children"]["edges"])
    with open(D / "r.json", "w", encoding="utf-8") as f:
        json.dump(d, f)


def p_bajar_slide_sin_imagen():
    """Un slide sin imagen: se para, no deja un carrusel a medias."""
    def quitar(edges):
        n = edges[3]["node"]
        n.pop("display_resources", None)
        n.pop("display_url", None)
    _respuesta_cambiada(quitar)
    bajar(D / "r.json")
    return RC != 0 and "FALTA_SLIDE" in SALIDA and not (P / "virales" / "orig").exists()


def fallo_en_slide_3():
    """Imágenes locales (sin red) y la del slide 3 no existe: la descarga falla a mitad."""
    def locales(edges):
        for k, e in enumerate(edges, 1):
            n = e["node"]
            n.pop("display_resources", None)
            n["display_url"] = (AQUI / "slide_prueba.jpg").as_uri() if k != 3 else "file:///no/existe.jpg"
    _respuesta_cambiada(locales)
    motor("bajar", "https://www.instagram.com/p/PRUEBA/", "orig", SC_RESPUESTA=str(D / "r.json"))


def p_bajar_falla_a_mitad():
    fallo_en_slide_3()
    return RC != 0 and "FALLO_DESCARGA" in SALIDA and not (P / "virales" / "orig").exists() and not (P / "virales" / "orig.bajando").exists()


def p_bajar_reintento():
    fallo_en_slide_3()
    bajar(AQUI / "scrapecreators" / "carrusel_con_videos.json")
    return RC == 0 and n_slides_viral("orig") == 6


# ---------- generación (fase 2) ----------
def p_gen_normal():
    original("normal_8", 9); codex("normal"); motor("generar", "normal_8")
    return RC == 0 and slides("normal_8") == 8


def p_gen_rehizo_sin_final():
    original("con_persona_3", 3); codex("rehizo_sin_final"); motor("generar", "con_persona_3")
    rev = P / "salida" / "con_persona_3" / "_revisar"
    return RC == 4 and rev.is_dir() and len(os.listdir(rev)) == 5 and slides("con_persona_3") == 0 and "Elige en la app" in SALIDA


def p_gen_rehizo_con_final():
    original("con_persona_3", 3); codex("rehizo_con_final"); motor("generar", "con_persona_3")
    o = P / "salida" / "con_persona_3"
    return (RC == 0 and slides("con_persona_3") == 3 and igual(o / "_sin_pie" / "1.png", o / "_revisar" / "orden_02.png")
            and igual(o / "_sin_pie" / "3.png", o / "_revisar" / "orden_05.png"))


def p_gen_final_solo_en_prompt():
    original("con_persona_3", 3); codex("final_solo_en_prompt"); motor("generar", "con_persona_3")
    return RC == 4 and slides("con_persona_3") == 0


def p_gen_limite():
    original("con_persona_3", 3); codex("limite"); motor("generar", "con_persona_3")
    return RC == 2 and "LIMITE_DE_USO" in SALIDA


def p_gen_sin_sesion():
    original("con_persona_3", 3); codex("sin_sesion"); motor("generar", "con_persona_3")
    return RC != 0 and "sin session id" in SALIDA


def p_elegir_mal():
    original("con_persona_3", 3); codex("rehizo_sin_final"); motor("generar", "con_persona_3"); motor("elegir", "con_persona_3", "2,9,4")
    return RC != 0 and slides("con_persona_3") == 0


def p_elegir_bien():
    original("con_persona_3", 3); codex("rehizo_sin_final"); motor("generar", "con_persona_3"); motor("elegir", "con_persona_3", "2,4,5")
    return RC == 0 and slides("con_persona_3") == 3


def p_gen_imagen_rota():
    original("normal_8", 9); codex("normal_imagen_rota"); motor("generar", "normal_8")
    return RC != 0 and "imagen 3 de Codex no se pudo recortar" in SALIDA


def tres_slides():
    original("con_persona_3", 3); codex("rehizo_con_final"); motor("generar", "con_persona_3")
    return RC == 0


def p_corregir():
    o = P / "salida" / "con_persona_3"
    if not tres_slides():
        return False
    codex("correccion")
    return (motor("corregir", "con_persona_3", "2", "sube el texto") == 0 and (o / "_versiones" / "2_v1.png").is_file()
            and not igual(o / "_sin_pie" / "2.png", o / "_versiones" / "2_v1.png"))


def p_corregir_sin_imagen():
    if not tres_slides():
        return False
    codex("correccion_sin_imagen"); motor("corregir", "con_persona_3", "2", "sube el texto")
    return RC != 0 and "FALLO slide 2" in SALIDA


def p_corregir_imagen_rota():
    if not tres_slides():
        return False
    codex("correccion_imagen_rota"); motor("corregir", "con_persona_3", "2", "sube el texto")
    o = P / "salida" / "con_persona_3"
    return RC != 0 and "se queda como estaba" in SALIDA and igual(o / "_sin_pie" / "2.png", o / "_versiones" / "2_v1.png") and (o / "2.png").is_file()


# ---------- rediseño (REDISENO=1): Codex recibe el slide ORIGINAL como referencia ----------
def ensayo_corregir(modo, slide="2"):
    """Corrige en ensayo (no llama a Codex) y deja el prompt en _correcciones/."""
    os.environ.pop("CODEX_SIMULADO", None)
    extra = {"ENSAYO": "1"}
    if modo == "rediseno":
        extra["REDISENO"] = "1"
    motor("corregir", "con_persona_3", slide, "fondo blanco", **extra)


def _prompt_corr(n):
    return P / "salida" / "con_persona_3" / "_correcciones" / f"slide_{n}_v1.txt"


def _sep(*partes):
    return os.sep.join(partes)


def p_rediseno_adjunta_original():
    if not tres_slides():
        return False
    ensayo_corregir("rediseno", "2")
    pr = _prompt_corr(2)
    return (RC == 0 and _sep("virales", "con_persona_3", "slide_02.jpg") in SALIDA and "_sin_pie" not in SALIDA
            and contiene(pr, "mismo diseño que la imagen 1") and linea_empieza(pr, "- titular:"))


def p_rediseno_sin_original():
    if not tres_slides():
        return False
    (P / "virales" / "con_persona_3" / "slide_02.jpg").unlink()
    ensayo_corregir("rediseno", "2")
    return RC != 0 and "No existe el slide original" in SALIDA


def p_corregir_normal_intacto():
    """Sin REDISENO, corregir sigue mandando el slide actual y la instrucción de siempre."""
    if not tres_slides():
        return False
    ensayo_corregir("normal", "2")
    pr = _prompt_corr(2)
    return RC == 0 and _sep("_sin_pie", "2.png") in SALIDA and contiene(pr, "Edita la imagen 1") and not contiene(pr, "mismo diseño")


def p_rediseno_con_persona():
    """El slide 3 lleva personaje: se añaden las fotos tras la referencia."""
    if not tres_slides():
        return False
    ensayo_corregir("rediseno", "3")
    return RC == 0 and "slide_03.jpg" in SALIDA and "fotos" + os.sep in SALIDA and contiene(_prompt_corr(3), "El personaje es el de la imagen 2")


def p_rediseno_sin_persona():
    if not tres_slides():
        return False
    ensayo_corregir("rediseno", "2")
    return "fotos" + os.sep not in SALIDA and contiene(_prompt_corr(2), "no aparece ninguna persona")


def _insertar_tras_linea_1(f, linea):
    l = leer(f).split("\n")
    escribir(f, "\n".join(l[:1] + [linea] + l[1:]))


def p_pie_claro():
    """pie_claro: si → el pie se dibuja en azul marino, sin cambiar el prompt de la ficha."""
    if not tres_slides():
        return False
    f = P / "fichas" / "con_persona_3.md"
    _insertar_tras_linea_1(f, "pie_claro: si")
    if not linea_empieza(f, "pie_claro: si"):
        return False
    shutil.rmtree(D / "capas", ignore_errors=True)
    motor("generar", "con_persona_3", ENSAYO="1")
    return any("_claro" in x for x in capas())


def p_reestampar():
    """Vuelve a estampar el pie sin Codex y sin gastar cupo."""
    if not tres_slides():
        return False
    o = P / "salida" / "con_persona_3"
    antes = lineas_cupo()
    (o / "2.png").unlink()
    motor("reestampar", "con_persona_3", "2")
    return RC == 0 and (o / "2.png").is_file() and lineas_cupo() == antes


def p_pie_referencia():
    """pie_claro: referencia → capas con la variante en el nombre (no se mezclan con las del pie normal)."""
    if not tres_slides():
        return False
    _insertar_tras_linea_1(P / "fichas" / "con_persona_3.md", "pie_claro: referencia")
    shutil.rmtree(D / "capas", ignore_errors=True)
    motor("reestampar", "con_persona_3", "1")
    return RC == 0 and any("_claro_referencia_" in x for x in capas())


def p_pie_normal_intacto():
    """Sin pie_claro, las capas se llaman como siempre."""
    if not tres_slides():
        return False
    shutil.rmtree(D / "capas", ignore_errors=True)
    motor("reestampar", "con_persona_3", "1")
    c = capas()
    return RC == 0 and any(x.startswith("capa_1de3_") for x in c) and not any(("referencia" in x or "claro" in x) for x in c)


# ---------- ficha y cifras (perfiles nuevos) ----------
def ficha_ia_con(caso):
    """El original se baja con la respuesta guardada (trae el pie del post en info.txt, como en la app)."""
    motor("bajar", "https://www.instagram.com/p/PRUEBA/", "santo_prueba_real",
          SC_RESPUESTA=str(AQUI / "scrapecreators" / "carrusel_con_videos.json"), SC_SIN_IMAGENES="1")
    motor("ficha_ia", "santo_prueba_real", CLAUDE_SIMULADO=str(AQUI / "claude" / caso / "respuesta.txt"))


def p_ficha_texto():
    ficha_ia_con("ficha_con_texto")
    return (RC == 0 and contiene(P / "virales" / "santo_prueba_real" / "texto_original.md", "1.2B a week")
            and not contiene(P / "fichas" / "santo_prueba_real.md", "TEXTO DEL ORIGINAL"))


def p_cifras_con_texto():
    ficha_ia_con("ficha_con_texto"); motor("comprobar", "santo_prueba_real")
    return RC == 0


def p_cifras_sin_texto():
    ficha_ia_con("ficha_sin_texto"); motor("comprobar", "santo_prueba_real")
    return RC != 0 and "no aparece en el carrusel original" in SALIDA


def p_ruta_del_original():
    ficha_ia_con("ficha_con_texto")
    return "viral: " + str(P / "virales" / "santo_prueba_real") in leer(P / "fichas" / "santo_prueba_real.md").split("\n")


def p_cifra_inventada():
    ficha_ia_con("ficha_con_texto")
    f = P / "fichas" / "santo_prueba_real.md"
    escribir(f, "\n".join(l.replace("Un fundador llegó a $10K al mes en 3 semanas", "Un fundador llegó a $25K al mes en 3 semanas", 1)
                          for l in leer(f).split("\n")))
    motor("comprobar", "santo_prueba_real")
    return RC != 0 and "25K" in SALIDA


def p_mismo_valor():
    codigo = ("import sys; sys.path.insert(0, sys.argv[1]); import ficha as f; v=f.valores; "
              "sys.exit(0 if v('1.2B')==v('1.200 millones')==v('1.2 billion')==v('1.200 M') and v('10K')==v('10,000') and v('1.2B')!=v('1.3B') else 1)")
    return subprocess.run([sys.executable, "-B", "-c", codigo, str(MOTOR)]).returncode == 0


# ---------- descripción: cada cliente con su marca ----------
def ficha_py(*args):
    return correr(args, {"DATOS": str(D), "DATOS_PERFIL": str(P)}, script=MOTOR / "ficha.py")


def p_desc_marca():
    original("con_persona_3", 3)
    ficha_py("prompt_descripcion", P / "fichas" / "con_persona_3.md", D / "desc.txt")
    return RC == 0 and contiene(D / "desc.txt", "Marca de prueba del comando") and not contiene(D / "desc.txt", "sistemas de AI a empresas en USA", True)


def p_prompts_sin_marca_fija():
    for f in MOTOR.glob("PROMPT_*.txt"):
        t = leer(f).lower()
        if any(x in t for x in ("sistemas de ai a empresas", "cristianews", "cristian news")):
            return False
    return True


# ---------- personaje (fase 3) ----------
def fotos(valor):
    f = P / "marca" / "marca.txt"
    escribir(f, "\n".join(("fotos: " + valor) if l.startswith("fotos: ") else l for l in leer(f).split("\n")))


def prompt_de(nombre):
    original(nombre, 3)
    return ficha_py("prompt", P / "fichas" / f"{nombre}.md", D / "prompt.txt", "1") == 0


def p_sin_cliente():
    original("sin_persona_3", 3); motor("comprobar", "sin_persona_3")
    return RC != 0 and "ningún slide" in SALIDA


def p_mascota():
    return (prompt_de("con_persona_3") and not contiene(D / "prompt.txt", "La mascota o la persona del original tampoco aparecen")
            and contiene(D / "prompt.txt", "se queda como en el original, sin la cara de nadie"))


def p_cliente_al_final():
    original("con_persona_3", 3); motor("comprobar", "con_persona_3")
    return RC == 0


def p_regla_ficha():
    return contiene(MOTOR / "PROMPT_FICHA.txt", 'Si el original no lleva a ninguna persona en ningún slide, pon "si" en el último slide')


def p_una_foto():
    fotos("fotos/personaje_1.jpg")
    return prompt_de("con_persona_3") and contiene(D / "prompt.txt", "la foto 1") and not contiene(D / "prompt.txt", "las fotos 1")


def p_tres_fotos():
    fotos("fotos/personaje_1.jpg, fotos/personaje_2.jpg, fotos/personaje_3.jpg")
    return prompt_de("con_persona_3") and contiene(D / "prompt.txt", "las fotos 1, 2 y 3")


PRUEBAS = [
    ("bajar_carrusel_con_videos", "6 de 6 slides (3 de vídeo, con su portada)", p_bajar_videos),
    ("bajar_carrusel_solo_fotos", "7 de 7 slides", p_bajar_fotos),
    ("bajar_foto_suelta", "para con NO_ES_CARRUSEL y no baja nada", p_bajar_foto_suelta),
    ("bajar_reel", "para con NO_ES_CARRUSEL", p_bajar_reel),
    ("bajar_error_de_la_api", "para con un mensaje (antes terminaba como si hubiera ido bien)", p_bajar_error_api),
    ("bajar_slide_sin_imagen", "para sin dejar un carrusel a medias", p_bajar_slide_sin_imagen),
    ("bajar_falla_una_imagen_a_mitad", "para con FALLO_DESCARGA y no deja nada", p_bajar_falla_a_mitad),
    ("bajar_reintento_tras_un_fallo", "el segundo intento baja los 6 (antes: \"Ya existe\")", p_bajar_reintento),
    ("rediseno_adjunta_original", "manda el slide original como imagen 1, no el slide actual, y los textos de la ficha", p_rediseno_adjunta_original),
    ("rediseno_sin_original", "para y dice que falta el slide original", p_rediseno_sin_original),
    ("rediseno_con_persona", "si el slide lleva personaje, añade sus fotos tras la referencia", p_rediseno_con_persona),
    ("rediseno_sin_persona", "si no lleva personaje, no manda fotos", p_rediseno_sin_persona),
    ("corregir_normal_intacto", "sin REDISENO, corregir no cambia", p_corregir_normal_intacto),
    ("pie_claro", "pie_claro: si dibuja el pie en azul marino", p_pie_claro),
    ("reestampar", "estampa el pie sin gastar cupo", p_reestampar),
    ("pie_referencia", "pie_claro: referencia usa la variante", p_pie_referencia),
    ("pie_normal_intacto", "sin pie_claro, capas como siempre", p_pie_normal_intacto),
    ("generar_normal", "8 slides con su pie (log real del #12)", p_gen_normal),
    ("generar_imagen_rota", "para diciendo qué imagen falló (antes, sin mensaje)", p_gen_imagen_rota),
    ("corregir_normal", "corrige el slide 2 y guarda la versión anterior", p_corregir),
    ("corregir_sin_imagen", "para con FALLO slide 2", p_corregir_sin_imagen),
    ("corregir_imagen_rota", "para, lo dice y deja el slide como estaba (antes respondía OK)", p_corregir_imagen_rota),
    ("generar_codex_rehizo_sin_final", "para con código 4 y deja las 5 imágenes para elegir (log real de Santo)", p_gen_rehizo_sin_final),
    ("generar_codex_rehizo_con_final", "coloca solas las imágenes 2, 4 y 5", p_gen_rehizo_con_final),
    ("generar_final_solo_en_el_prompt", "no elige nada solo: el FINAL del prompt no es la respuesta de Codex", p_gen_final_solo_en_prompt),
    ("generar_limite_de_uso", "para con código 2 y LIMITE_DE_USO", p_gen_limite),
    ("generar_sin_sesion", "para con un mensaje", p_gen_sin_sesion),
    ("elegir_numeros_malos", "rechaza 2,9,4 sin tocar nada", p_elegir_mal),
    ("elegir_2_4_5", "3 slides con su pie", p_elegir_bien),
    ("ficha_ia_guarda_el_texto_del_original", "texto_original.md junto al original y la ficha sin esa sección", p_ficha_texto),
    ("cifras_del_original_por_su_valor", "las 6 cifras de Santo (1.2B → 1.200 millones, 10K, 10,000, 29) se dan por buenas", p_cifras_con_texto),
    ("cifras_sin_texto_del_original", "sin el texto del original, se rechazan (lo que les pasaba a los perfiles nuevos)", p_cifras_sin_texto),
    ("ficha_ia_pone_la_ruta_del_original", "la ficha apunta a su original aunque Claude escriba otra ruta", p_ruta_del_original),
    ("cifra_inventada", "una cifra que no está en el original se sigue frenando", p_cifra_inventada),
    ("cifras_mismo_valor", "1.2B = 1.2 billion = 1.200 millones = 1.200 M; 10K = 10,000; 1.2B ≠ 1.3B", p_mismo_valor),
    ("descripcion_con_el_angulo_del_cliente", "el prompt lleva el ángulo de este cliente y no el de Cristian", p_desc_marca),
    ("prompts_sin_marca_fija", "ningún prompt lleva escrita la marca de Cristian", p_prompts_sin_marca_fija),
    ("ficha_sin_el_cliente_en_ningun_slide", "la comprobación frena: el cliente tiene que salir al menos al final", p_sin_cliente),
    ("prompt_la_mascota_se_queda", "la mascota se queda como en el original, sin la cara de nadie", p_mascota),
    ("ficha_con_el_cliente_en_el_ultimo", "la comprobación la da por buena", p_cliente_al_final),
    ("regla_de_la_ficha_ia", "el prompt de la ficha pide al cliente en el último si el original no lleva a nadie", p_regla_ficha),
    ("prompt_con_1_foto", "habla de 'la foto 1'", p_una_foto),
    ("prompt_con_3_fotos", "habla de 'las fotos 1, 2 y 3'", p_tres_fotos),
]

if __name__ == "__main__":
    if not shutil.which("ffmpeg"):
        print("Falta ffmpeg: las pruebas de generación lo necesitan.", flush=True)
    try:
        for nombre, espera, fn in PRUEBAS:
            prueba(nombre, espera, fn)
    finally:
        shutil.rmtree(TMP, ignore_errors=True)
    print()
    print(f"Pasan {PASAN} · fallan {len(FALLAN)}")
    sys.exit(1 if FALLAN else 0)
