#!/usr/bin/env python3
"""Carruseles Top · un solo script para toda la cadena (Mac, Windows y Linux).

Versión multiplataforma de carrusel.sh (zsh): mismas órdenes, argumentos, variables de entorno,
archivos, mensajes y códigos de salida. Ver USO abajo.
Necesita Python 3.9+, Pillow y ffmpeg; Codex CLI y Claude Code para generar y redactar.
"""
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import traceback
from pathlib import Path

USO = """\
# Carruseles Top · un solo script para toda la cadena.
#
#   carrusel.sh bajar <url_instagram> <nombre>      descarga los slides del carrusel original a virales/<nombre>/
#   carrusel.sh nueva <nombre> <N>                  crea la ficha vacía en fichas/<nombre>.md
#   carrusel.sh ficha_ia <nombre>                   Claude Code redacta la ficha mirando los slides del original (tokens, no imágenes)
#   carrusel.sh comprobar <nombre>                  comprueba la ficha (sin gastar nada)
#   carrusel.sh generar <nombre>                    comprueba, monta el prompt, genera con Codex, recorta, estampa y hace la hoja
#   carrusel.sh corregir <nombre> <n> "<cambio>"    corrige un slide editándolo y lo vuelve a estampar (1 imagen)
#   carrusel.sh revisar <nombre>                    hoja del carrusel y tira de pies, para revisar
#   carrusel.sh elegir <nombre> <a,b,c>             si Codex rehízo imágenes: coloca las buenas de _revisar/ como slides 1..N
#   carrusel.sh cerrar <nombre>                     JPG limpios sin metadatos; borra el material de trabajo y las copias de Codex
#   carrusel.sh descripcion <nombre>                Claude Code escribe la descripción de Instagram en salida/<nombre>/descripcion.txt
#   carrusel.sh encoger <nombre> <n> [factor] [y]  encoge la escena (0.92; y = px que baja) para no pisar pie ni contador; 0 imágenes
#   carrusel.sh variaciones <nombre>                5 variaciones de esa descripción (otro gancho y enfoque) en salida/<nombre>/variaciones.txt
#   carrusel.sh reestampar <nombre> [n]            vuelve a pegar contador y pie sobre los slides que ya hay (todos o el n); 0 imágenes
"""
#   carrusel.sh cupo                                imágenes gastadas en 24 h por la cuenta actual
#   (USO son las líneas 2 a 16 de la cabecera de carrusel.sh, las que enseñaba con argumentos malos; 'cupo' no entraba)
# Variables opcionales:  ENSAYO=1 (no llama a Codex)   FORZAR=1 (salta el cupo)   RECOGER_SID=<id> (recoge una sesión ya hecha)
#                        Pruebas sin gasto: SC_RESPUESTA, SC_SIN_IMAGENES, CODEX_SIMULADO, GEN (ver motor/pruebas/correr.py)
#                        PERFIL=<cliente> (por defecto, el cliente activo en la app)
#                        DEBUG_MOTOR=1: ante un error inesperado, el detalle completo va a stderr

ES_WINDOWS = os.name == "nt"
AQUI = Path(__file__).resolve().parent
PY = sys.executable or "python3"
MODELO = "gpt-5.5"
ESFUERZO = "medium"
ANSI = re.compile(r"\x1b\[[0-9;]*m")


class Salir(Exception):
    """exit <código> del script original."""

    def __init__(self, codigo):
        super().__init__(codigo)
        self.codigo = codigo


def say(*a):
    print(*a, flush=True)


def env(k, defecto=""):
    return os.environ.get(k, defecto)


def env_o(k, defecto):
    """${K:-defecto}: vacía cuenta como no puesta."""
    return os.environ.get(k) or defecto


def leer_texto(p):
    try:
        return Path(p).read_bytes().decode("utf-8", errors="replace")
    except OSError:
        return ""


def escribir_texto(p, texto, modo="w"):
    with open(p, modo, encoding="utf-8", newline="") as f:
        f.write(texto)


def primera_linea_con(p, prefijo):
    """grep -m1 "^<prefijo>" <archivo>, o None."""
    try:
        with open(p, encoding="utf-8", errors="replace", newline="") as f:
            for l in f:
                l = l.rstrip("\n").rstrip("\r")
                if l.startswith(prefijo):
                    return l
    except OSError:
        pass
    return None


def valor_de(p, clave):
    """grep -m1 "^clave:" | cut -d: -f2- | sed 's/^ *//'"""
    l = primera_linea_con(p, clave + ":")
    return "" if l is None else l.split(":", 1)[1].lstrip(" ")


def lista_comas(s):
    """${(s:,:)s} con los espacios de los lados fuera; sin elementos vacíos."""
    return [x.strip() for x in s.split(",") if x.strip()]


# ---------- entorno ----------
def preparar_path():
    extra = []
    if ES_WINDOWS:
        for v, sub in (("APPDATA", "npm"), ("LOCALAPPDATA", r"Microsoft\WinGet\Links"), ("ProgramFiles", "nodejs"),
                       ("LOCALAPPDATA", r"Programs\ffmpeg\bin"), ("ProgramFiles", r"ffmpeg\bin")):
            base = os.environ.get(v)
            if base and os.path.isdir(os.path.join(base, sub)):
                extra.append(os.path.join(base, sub))
        loc = Path.home() / ".local" / "bin"
        if loc.is_dir():
            extra.append(str(loc))
    else:
        extra = [str(Path.home() / ".local" / "bin"), "/opt/homebrew/bin", "/usr/local/bin"]
    os.environ["PATH"] = os.pathsep.join(extra + [os.environ.get("PATH", "")])


def destino_atajo_npm(texto):
    """Del atajo .cmd que crea npm ("%dp0%\\node_modules\\...\\cli.js" %*), la ruta relativa del programa
    al que llama (un .js o un .exe), sin contar el node.exe opcional de la misma carpeta."""
    for m in re.finditer(r'"%~?dp0%?\\([^"%]+?\.(?:js|cjs|mjs|exe))"', texto, re.IGNORECASE):
        if m.group(1).lower() != "node.exe":
            return m.group(1)
    return None


def comando(nombre):
    """Ruta del programa como lista para subprocess, o None. En Windows, los atajos .cmd de npm
    (codex.cmd, claude.cmd) se ejecutan con node directamente: así la entrada por stdin y los
    argumentos no pasan por cmd.exe."""
    p = shutil.which(nombre)
    if not p:
        return None
    if ES_WINDOWS and p.lower().endswith((".cmd", ".bat")):
        dp0 = os.path.dirname(p)
        rel = destino_atajo_npm(leer_texto(p))
        destino = os.path.join(dp0, rel) if rel else ""
        if destino and os.path.isfile(destino):
            if destino.lower().endswith(".exe"):
                return [destino]
            node = os.path.join(dp0, "node.exe")
            node = node if os.path.isfile(node) else shutil.which("node")
            if node:
                return [node, destino]
        # atajo con otra forma: CreateProcess sabe lanzar un .cmd (lo pasa por cmd.exe)
    return [p]


def run(args, **kw):
    """subprocess.run sin shell; si el programa no existe, código 127 como en la shell."""
    try:
        return subprocess.run([str(a) for a in args], **kw).returncode
    except FileNotFoundError:
        return 127
    except OSError as e:
        print(f"{args[0]}: {e}", file=sys.stderr, flush=True)
        return 126


def ffmpeg(*args, **kw):
    f = comando("ffmpeg")
    if not f:
        print("Falta ffmpeg. Instálalo (Mac: brew install ffmpeg · Windows: winget install ffmpeg).", file=sys.stderr, flush=True)
        return 127
    return run(f + list(args), **kw)


def py(script, *args, **kw):
    return run([PY, str(AQUI / script)] + list(args), **kw)


def py_salida(script, *args):
    """$(python3 script args): stdout sin los saltos de línea del final."""
    try:
        r = subprocess.run([PY, str(AQUI / script)] + [str(a) for a in args], stdout=subprocess.PIPE)
    except OSError:
        return ""
    return r.stdout.decode("utf-8", errors="replace").rstrip("\r\n")


preparar_path()
# los Python hijos (ficha.py, bajar.py, plantilla.py, adaptar.py) escriben y leen en UTF-8 también en Windows
os.environ.setdefault("PYTHONUTF8", "1")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

DATOS = Path(env_o("DATOS", str(AQUI.parent / "datos")))
os.environ["DATOS"] = str(DATOS)


def _ajuste(clave):
    try:
        with open(DATOS / "ajustes.json", encoding="utf-8") as f:
            v = json.load(f).get(clave, "")
        return "" if v is None else str(v)
    except Exception:
        return ""


PERFIL = env_o("PERFIL", _ajuste("perfil_activo"))
if PERFIL and not re.fullmatch(r"[a-z0-9_-]+", PERFIL):
    say(f"Nombre de cliente no válido: {PERFIL}")
    sys.exit(64)
DATOS_PERFIL = DATOS / "perfiles" / PERFIL if PERFIL and (DATOS / "perfiles" / PERFIL).is_dir() else DATOS
os.environ["PERFIL"] = PERFIL
os.environ["DATOS_PERFIL"] = str(DATOS_PERFIL)
MARCA = DATOS_PERFIL / "marca"
FICHAS = DATOS_PERFIL / "fichas"
VIRALES = DATOS_PERFIL / "virales"
SALIDA = DATOS_PERFIL / "salida"
GEN = Path(env_o("GEN", str(Path.home() / ".codex" / "generated_images")))
CUPO = DATOS / "CUPO.csv"
ESTADO = DATOS_PERFIL / "ESTADO.md"
_c = leer_texto(DATOS / "CUENTA_ACTUAL.txt").split("\n", 1)[0].rstrip("\r")
CUENTA = _c or "sin_nombre"
if not env("SCRAPECREATORS_API_KEY") and (DATOS / "ajustes.json").is_file():
    os.environ["SCRAPECREATORS_API_KEY"] = _ajuste("scrapecreators_key")


def dato(clave):
    return valor_de(MARCA / "marca.txt", clave)


try:
    TOPE = int(dato("tope_imagenes_dia") or 60)
except ValueError:
    TOPE = 60
os.environ["PIE_HANDLE"] = dato("handle")
os.environ["PIE_LEMA"] = dato("lema")


# ---------- utilidades ----------
def ajustar_4x5(src, dst):
    """Deja la imagen en 4:5 recortando (centrado), nunca estirando, a 1080x1350. False si no es una imagen."""
    try:
        from PIL import Image
        with Image.open(src) as im:
            im.load()
            w, h = im.size
            if w * 5 < h * 4:
                nw, nh = w, w * 5 // 4
            else:
                nh, nw = h, h * 4 // 5
            x, y = (w - nw) // 2, (h - nh) // 2
            out = im.crop((x, y, x + nw, y + nh))
            if out.mode not in ("RGB", "RGBA"):
                out = out.convert("RGBA" if "A" in out.getbands() else "RGB")
            out = out.resize((1080, 1350), Image.LANCZOS)
            Path(dst).parent.mkdir(parents=True, exist_ok=True)
            out.save(dst, "PNG")
        return True
    except Exception:
        return False


def dibujar(*args):
    """<args de plantilla.py...>: dibuja una capa; si la carpeta capas desapareció a mitad, la recrea y reintenta una vez."""
    f = Path(args[2])
    f.parent.mkdir(parents=True, exist_ok=True)
    if py("plantilla/plantilla.py", *args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
        return True
    f.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = subprocess.run([PY, str(AQUI / "plantilla" / "plantilla.py")] + [str(a) for a in args],
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    except OSError as e:
        print(f"error: {e}", file=sys.stderr, flush=True)
        return False
    if r.returncode == 0:
        return True
    lineas = [l for l in r.stderr.decode("utf-8", errors="replace").splitlines() if l.strip()]
    err = [l for l in lineas if re.search(r"fatal error|error:", l, re.IGNORECASE)]
    if err or lineas:  # solo la línea del error, no el volcado entero
        print((err or lineas[-1:])[0], file=sys.stderr, flush=True)
    return False


def _sufijo_capa():
    h = re.sub(r"[@.]", "", env("PIE_HANDLE"))
    return h + (f"_{env('PIE_ESTILO')}" if env("PIE_ESTILO") else "") + (f"_{env('PIE_VARIANTE')}" if env("PIE_VARIANTE") else "")


def capa(n, N):
    """<n> <N> → ruta de la capa transparente con contador y pie, o None si no se pudo dibujar."""
    # el adelanto del pie (casilla 'siguiente' del slide) cambia por carrusel: va en el nombre de la capa (huella corta)
    sig = py_salida("ficha.py", "campo", env("PIE_FICHA"), n, "siguiente") if env("PIE_FICHA") else ""
    os.environ["PIE_SIGUIENTE"] = sig
    huella = hashlib.md5(f"{env('PIE_LEMA')}|{sig}".encode("utf-8")).hexdigest()[:8]
    f = DATOS / "capas" / f"capa_{n}de{N}_{_sufijo_capa()}_{huella}.png"
    (DATOS / "capas").mkdir(parents=True, exist_ok=True)
    if not f.is_file() and not dibujar(n, N, f):
        # en el original el mensaje acababa como ruta de la capa y ffmpeg lo decía en stderr
        print(f"FALLO al dibujar la capa {n}", file=sys.stderr, flush=True)
        return None
    return f


def guia_zonas(N):
    """<N> → imagen con fondo que enseña dónde van el contador y el pie (referencia para Codex)."""
    os.environ["PIE_SIGUIENTE"] = "SIGUIENTE: / ADELANTO DEL SLIDE"  # en la guía solo enseña cuánto ocupa el pie
    f = DATOS / "capas" / f"guia_zonas_{N}_{_sufijo_capa()}_pie2.png"
    (DATOS / "capas").mkdir(parents=True, exist_ok=True)
    if not f.is_file() and not dibujar(1, N, f, "fondo"):
        say("FALLO al dibujar la guía de zonas")
        raise Salir(1)
    return f


def estampar(out, n, N):
    """<carpeta> <n> <N>: estampa contador y pie sobre _sin_pie/n.png → n.png. True si fue bien."""
    c = capa(n, N)
    if c is None:
        return False
    return ffmpeg("-y", "-loglevel", "error", "-i", Path(out) / "_sin_pie" / f"{n}.png", "-i", c,
                  "-filter_complex", "[0][1]overlay=0:0:format=auto,format=rgb24", Path(out) / f"{n}.png") == 0


def anotar_cupo(carrusel, tipo, imagenes, tokens):
    if not CUPO.is_file():
        escribir_texto(CUPO, "fecha;hora;epoch;cuenta;carrusel;tipo;imagenes;tokens\n")
    ahora = datetime.datetime.now()
    escribir_texto(CUPO, f"{ahora:%Y-%m-%d};{ahora:%H:%M};{int(time.time())};{CUENTA};{carrusel};{tipo};{imagenes};{tokens}\n", "a")


def _num_awk(s):
    """Valor numérico de un campo como lo convierte awk (prefijo numérico; si no hay, 0)."""
    m = re.match(r"\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?", s)
    return float(m.group(0)) if m else 0.0


def _filas_cupo():
    if not CUPO.is_file():
        return []
    lineas = leer_texto(CUPO).split("\n")
    if lineas and lineas[-1] == "":
        lineas.pop()
    return [l.rstrip("\r").split(";") for l in lineas[1:]]


def _num_txt(v):
    return str(int(v)) if v == int(v) else repr(v)


def gastadas_24h():
    t = int(time.time()) - 86400
    s = 0.0
    for c in _filas_cupo():
        if len(c) >= 4 and c[3] == CUENTA and _num_awk(c[2]) >= t:
            s += _num_awk(c[6]) if len(c) >= 7 else 0
    return _num_txt(s)


def hay_cupo(n):
    g = gastadas_24h()
    if float(g) + n > TOPE and env_o("FORZAR", "0") != "1":
        say(f"SIN_CUPO: la cuenta '{CUENTA}' lleva {g} imágenes en 24 h y se piden {n} (tope {TOPE}). No se lanza.")
        return False
    return True


def imagenes_de_sesion(sid):
    """PNG de la sesión de Codex, del más antiguo al más nuevo (como find | xargs ls -tr)."""
    base = GEN / sid
    if not base.is_dir():
        return []
    fs = [p for p in base.rglob("*.png") if p.is_file()]
    fs.sort(key=lambda p: str(p), reverse=True)  # ls -t desempata por nombre; -r lo invierte
    fs.sort(key=lambda p: p.stat().st_mtime_ns)
    return [str(p) for p in fs]


def buscar_claude():
    c = comando("claude")
    if c:
        return c
    loc = Path.home() / ".local" / "bin" / ("claude.exe" if ES_WINDOWS else "claude")
    if loc.is_file() and os.access(loc, os.X_OK):
        return [str(loc)]
    return None


def fallo_claude(rc, log, claude):
    """Claude Code escribe sus errores en la salida normal (el .log), no en el .err: se leen los dos.
    Si la causa es la sesión caducada, empieza por SESION_CLAUDE_CADUCADA para que la app ofrezca el botón de iniciar sesión."""
    def cabeza(p):
        try:
            with open(p, "rb") as f:
                return f.read(300)
        except OSError:
            return b""
    det = (cabeza(log) + cabeza(f"{log}.err")).decode("utf-8", errors="replace")
    caducada = bool(re.search(r"OAuth session expired|Failed to authenticate", det, re.IGNORECASE))
    if not caducada and claude:
        try:
            r = subprocess.run(claude + ["auth", "status"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=60)
            caducada = '"loggedIn": false' in r.stdout.decode("utf-8", errors="replace")
        except (OSError, subprocess.SubprocessError):
            pass
    if caducada:
        say("SESION_CLAUDE_CADUCADA: tu sesión de Claude caducó. Inicia sesión y vuelve a probar.")
    else:
        say(f"Claude falló (exit {rc}): {det}")


def siguiente_log(d, base):
    k = 1
    while (Path(d) / "_logs" / f"{base}_{k}.log").exists():
        k += 1
    return Path(d) / "_logs" / f"{base}_{k}.log"


def refs_marca():
    """Rutas completas de las fotos de la marca, en orden: fotos del personaje y después las referencias
    de estilo (1 a 3), el mismo orden que describe ficha.py en el prompt."""
    return [str(MARCA / f) for f in lista_comas(dato("fotos")) + lista_comas(dato("tipografia"))]


def llamar_codex(d, prompt, log, refs):
    """<carpeta_trabajo> <prompt> <log> <ref>... → escribe el log; devuelve el código de salida de codex."""
    imgs = []
    for f in refs:
        if not os.path.isfile(f):
            say(f"FALTA_REFERENCIA: {f} · Sube tus fotos y la referencia de estilo en Branding antes de generar.")
            return 5
        imgs += ["-i", str(Path(f).resolve())]
    # pruebas sin gasto: CODEX_SIMULADO=<log guardado> hace de Codex (con GEN apuntando a las imágenes de esa sesión)
    if env("CODEX_SIMULADO"):
        shutil.copyfile(env("CODEX_SIMULADO"), log)
        try:
            return int(env_o("CODEX_SIMULADO_RC", "0"))
        except ValueError:
            return 1
    if env_o("ENSAYO", "0") == "1":
        say(f"ENSAYO: no se llama a Codex. Prompt: {prompt} · Referencias:")
        for a in imgs:
            if a != "-i":
                say(f"  {a}")
        return 0
    codex = comando("codex")
    if not codex:
        escribir_texto(log, "No se encontró el comando codex: instala Codex CLI (npm install -g @openai/codex) y entra con: codex login\n")
        return 127
    # El prompt entra por stdin. No se pone "-" al final: -i lo leería como una imagen.
    with open(prompt, "rb") as entrada, open(log, "wb") as salida:
        return run(codex + ["exec", "--ephemeral", "--ignore-user-config", "--skip-git-repo-check", "-s", "read-only", "-C", str(d),
                            "-m", MODELO, "-c", f"model_reasoning_effort={ESFUERZO}"] + imgs,
                   stdin=entrada, stdout=salida, stderr=subprocess.STDOUT)


def ficha_de(nombre):
    return FICHAS / f"{nombre}.md"


def cab(nombre, k):
    return valor_de(ficha_de(nombre), k)


def entero(s, defecto=0):
    try:
        return int(str(s).strip())
    except ValueError:
        return defecto


def tokens_de(texto):
    """grep -A1 'tokens used' | tail -1"""
    lineas = texto.split("\n")
    idx = [i for i, l in enumerate(lineas) if "tokens used" in l]
    if not idx:
        return ""
    i = idx[-1]
    return (lineas[i + 1] if i + 1 < len(lineas) else lineas[i]).rstrip("\r")


def sid_de(texto):
    """grep -m1 'session id:' | awk '{print $3}'"""
    for l in texto.split("\n"):
        if "session id:" in l:
            c = l.split()
            return c[2] if len(c) > 2 else ""
    return ""


def limite_de_uso(texto):
    return bool(re.search(r"usage limit|usage_limit_reached", texto, re.IGNORECASE))


def final_de(texto):
    """El 'FINAL: a,b,c' que Codex escribió después del prompt (el log repite el prompt)."""
    t = ""
    for l in ANSI.sub("", texto).split("\n"):
        if "INSTRUCCIÓN TÉCNICA" in l:
            t = ""
            continue
        t += l + "\n"
    m = re.findall(r"FINAL: *[0-9 ,]+", t)
    return re.sub(r"^FINAL: *", "", m[-1]).replace(" ", "") if m else ""


def contar_slides(v):
    try:
        return sum(1 for x in os.listdir(v) if re.fullmatch(r"slide_[0-9]+\.jpg", x))
    except OSError:
        return 0


# ---------- órdenes ----------
def cmd_bajar(url, nombre):
    dest = VIRALES / nombre
    key = env("SCRAPECREATORS_API_KEY")
    if not key:
        l = None
        try:
            with open(Path.home() / ".config" / "last30days" / ".env", encoding="utf-8", errors="replace") as f:
                l = next((x for x in f if "SCRAPECREATORS_API_KEY" in x), None)
        except OSError:
            pass
        if l is not None:
            key = l.rstrip("\r\n").split("=", 1)[1].replace('"', "") if "=" in l else l.rstrip("\r\n").replace('"', "")
    if not key and not env("SC_RESPUESTA"):
        say("Falta SCRAPECREATORS_API_KEY")
        raise Salir(1)
    VIRALES.mkdir(parents=True, exist_ok=True)
    # bajar.py deja la carpeta solo si bajan todos los slides; 6 = no es un carrusel (la app enseña una ventana)
    rc = py("bajar.py", url, dest, env=dict(os.environ, SC_KEY=key))
    if rc != 0:
        raise Salir(rc)
    from PIL import Image
    for f in sorted(dest.glob("slide_*.jpg")):
        try:  # Instagram a veces sirve webp con extensión .jpg: se guarda como JPEG de verdad
            with Image.open(f) as im:
                im.load()
                im = im.convert("RGB")
            im.save(f, "JPEG", quality=92)
        except Exception:
            pass
    say(f"Siguiente paso: mirar los slides, escribir virales/{nombre}/descripcion.md y la ficha (carrusel.sh nueva {nombre} <N>).")
    return 0


def cmd_nueva(nombre, n):
    return py("ficha.py", "nueva", nombre, n, VIRALES / nombre)


def _limpiar_ficha_ia(log, f, original, viral):
    t = leer_texto(log)
    t = re.sub(r"```\w*", "", t)
    i = t.find("carrusel:")
    if i < 0:
        print("Claude no devolvió una ficha. Ver " + str(log), file=sys.stderr, flush=True)
        return False
    t = t[i:].strip()
    # el texto literal del original va aparte, junto a sus slides: la comprobación saca de ahí las cifras que solo
    # se leen dentro de las imágenes
    ficha, _, orig = t.partition("=== TEXTO DEL ORIGINAL ===")
    ficha = ficha.strip()
    # la ruta del original la pone el motor, no Claude (podría copiarla mal y la comprobación leería otra carpeta)
    ficha = re.sub(r"^viral:.*$", lambda _: "viral: " + str(viral), ficha, count=1, flags=re.M)
    Path(f).parent.mkdir(parents=True, exist_ok=True)
    escribir_texto(f, ficha + "\n")
    if orig.strip():
        escribir_texto(original, "# Texto de los slides del original (lo copia Claude al redactar la ficha)\n\n" + orig.strip() + "\n")
    else:
        say("AVISO: Claude no copió el texto del original; las cifras que solo están en las imágenes saldrán como no encontradas")
    say("Ficha escrita en", f, "·", ficha.count("\n## "), "slides")
    return True


def cmd_ficha_ia(nombre):
    """Claude Code (con la sesión del usuario) redacta la ficha mirando los slides del original. Tokens, no imágenes."""
    V = VIRALES / nombre
    F = FICHAS / f"{nombre}.md"
    if not V.is_dir():
        say(f"No existe el original en {V}. Primero: carrusel.sh bajar <url> {nombre}")
        raise Salir(1)
    N = contar_slides(V)
    if N <= 0:
        say(f"No hay slides en {V}")
        raise Salir(1)
    claude = buscar_claude()
    if not claude and not env("CLAUDE_SIMULADO"):
        say("Falta Claude Code. Instálalo (npm install -g @anthropic-ai/claude-code) y entra con: claude")
        raise Salir(1)
    idioma, angulo = dato("idioma"), dato("angulo")
    P = V / "_prompt_ficha.txt"
    t = leer_texto(AQUI / "PROMPT_FICHA.txt")
    for a, b in (("{HANDLE}", env("PIE_HANDLE")), ("{ANGULO}", angulo), ("{IDIOMA}", idioma or "español"),
                 ("{NOMBRE}", nombre), ("{N}", str(N)), ("{VIRAL}", str(V))):
        t = t.replace(a, b)
    escribir_texto(P, t)
    slides = sorted(x for x in V.glob("slide_*.jpg"))
    enviado = (t + "\n" + "Los slides del carrusel original están en estos archivos, en orden. Ábrelos con la herramienta Read y lee con cuidado "
               "todo su texto (nombres, cifras y pasos tienen que ser exactos) antes de escribir la ficha:\n"
               + "".join(f"{s.resolve()}\n" for s in slides)
               + "\nResponde SOLO con la ficha y, al final, la sección === TEXTO DEL ORIGINAL ===, sin explicaciones ni marcas de código.\n")
    escribir_texto(V / "_prompt_ficha_enviado.txt", enviado)
    (V / "_logs").mkdir(parents=True, exist_ok=True)
    LOG = siguiente_log(V, "ficha")
    if env_o("ENSAYO", "0") == "1":
        say(f"ENSAYO: no se llama a Claude. Prompt: {V / '_prompt_ficha_enviado.txt'}")
        raise Salir(0)
    # pruebas sin gasto: CLAUDE_SIMULADO=<respuesta guardada> hace de Claude
    if env("CLAUDE_SIMULADO"):
        shutil.copyfile(env("CLAUDE_SIMULADO"), LOG)
        escribir_texto(f"{LOG}.err", "")
        rc = 0
    else:
        with open(V / "_prompt_ficha_enviado.txt", "rb") as e, open(LOG, "wb") as o, open(f"{LOG}.err", "wb") as er:
            rc = run(claude + ["-p", "--allowedTools", "Read", "--output-format", "text"], stdin=e, stdout=o, stderr=er)
    if rc != 0:
        fallo_claude(rc, LOG, claude)
        raise Salir(1)
    if not _limpiar_ficha_ia(LOG, F, V / "texto_original.md", V):
        raise Salir(1)
    anotar_cupo(nombre, "ficha_ia", 0, "claude")
    if py("ficha.py", "comprobar", F) != 0:
        say("La ficha tiene avisos: revísala antes de generar.")
    say(f"OK ficha_ia {nombre} (Claude Code)")
    return 0


def cmd_comprobar(nombre):
    if not ficha_de(nombre).is_file():
        say(f'No existe la ficha "{nombre}" en el cliente {PERFIL or "actual"}')
        raise Salir(1)
    return py("ficha.py", "comprobar", ficha_de(nombre))


def cmd_hojas(V, O):
    """<carpeta_viral> <destino>: hojas de 6 slides del original. Devuelve el número de hojas, o None si falla."""
    Path(O).mkdir(parents=True, exist_ok=True)
    N = contar_slides(V)
    H, ini = 0, 1
    while ini <= N:
        H += 1
        if ffmpeg("-y", "-loglevel", "error", "-start_number", ini, "-i", Path(V) / "slide_%02d.jpg", "-frames:v", "1",
                  "-vf", "scale=540:675:force_original_aspect_ratio=increase,crop=540:675,setsar=1,tile=3x2",
                  Path(O) / f"viral_hoja_{H}.jpg") != 0:
            return None
        ini += 6
    return H


def cmd_generar(nombre):
    F = ficha_de(nombre)
    if not F.is_file():
        say(f"No existe la ficha {F}")
        raise Salir(1)
    if py("ficha.py", "comprobar", F) != 0:
        raise Salir(1)
    N_txt, V, OUT = cab(nombre, "slides"), cab(nombre, "viral"), SALIDA / nombre
    N = entero(N_txt)
    # la ficha guarda la ruta del original; si ya no existe (datos movidos), se busca en la carpeta del cliente
    if V and not os.path.isdir(V) and (VIRALES / Path(V).name).is_dir():
        V = str(VIRALES / Path(V).name)
    for s in ("_logs", "_sin_pie", "_viral"):
        (OUT / s).mkdir(parents=True, exist_ok=True)
    recoger = env("RECOGER_SID")
    if not recoger:
        shutil.rmtree(OUT / "_revisar", ignore_errors=True)  # las que sobraron en una generación anterior ya no valen
    H = 0
    if V and os.path.isdir(V):
        H = cmd_hojas(V, OUT / "_viral")
        if H is None:
            say("FALLO al hacer las hojas del viral")
            raise Salir(1)
    if py("ficha.py", "prompt", F, OUT / "_prompt.txt", H) != 0:
        raise Salir(1)
    escribir_texto(OUT / "_prompt_enviado.txt", leer_texto(OUT / "_prompt.txt") + "\n" + (
        f"INSTRUCCIÓN TÉCNICA: crea el carrusel completo, los {N_txt} slides en orden, en esta misma respuesta. No ejecutes comandos ni añadas texto con código. "
        "Si rehaces alguna imagen, al terminar responde solo con FINAL: y los números de la imagen buena de cada slide, en orden de slide, contando las imágenes "
        "en el orden en que las creaste empezando en 1 (por ejemplo, con 3 slides y los dos primeros rehechos, la palabra FINAL, dos puntos y luego 2,4,5). "
        "Si no rehiciste ninguna, responde solo 'ok'.\n"))
    REFS = refs_marca() or [""]  # sin fotos, la referencia vacía hace saltar FALTA_REFERENCIA (como en el original)
    REFS += [str(OUT / "_viral" / f"viral_hoja_{h}.jpg") for h in range(1, H + 1)]
    REFS.append(str(guia_zonas(N_txt)))
    LIM, RC, LOG = False, 0, None
    if recoger:
        SID, TOK = recoger, "-"
    else:
        if not hay_cupo(N):
            raise Salir(3)
        LOG = siguiente_log(OUT, "carrusel")
        RC = llamar_codex(OUT, OUT / "_prompt_enviado.txt", LOG, REFS)
        if RC == 5:
            raise Salir(5)
        if env_o("ENSAYO", "0") == "1":
            say(f"ENSAYO terminado: prompt en {OUT / '_prompt_enviado.txt'}")
            raise Salir(0)
        texto = leer_texto(LOG)
        TOK = tokens_de(texto)
        LIM = limite_de_uso(texto)
        SID = sid_de(texto)
        if not SID:
            say(f"FALLO: sin session id · ver {LOG}")
            raise Salir(1)
        escribir_texto(OUT / "_logs" / "sesiones.txt", SID + "\n", "a")
    FILES = imagenes_de_sesion(SID)
    K = len(FILES)
    if not recoger:
        anotar_cupo(nombre, "carrusel", K, TOK)
    if K > N:
        # Codex rehízo alguna imagen. Si dijo cuáles son las buenas ("FINAL: 2,4,5"), se usan esas; si no, se guardan todas
        # en _revisar/ y se eligen en la app (o con: carrusel.sh elegir <nombre> 2,4,5).
        (OUT / "_revisar").mkdir(parents=True, exist_ok=True)
        for i, f in enumerate(FILES, 1):
            if not ajustar_4x5(f, OUT / "_revisar" / f"orden_{i:02d}.png"):
                say(f"AVISO: la imagen {i} de Codex no se pudo recortar ({f}); no saldrá para elegir")
        # el log repite el prompt: solo cuenta lo que Codex escribió después de él
        FINAL = final_de(leer_texto(LOG)) if LOG else ""
        if FINAL and cmd_elegir(nombre, FINAL, "quieto") == 0:
            say(f"OK carrusel {nombre}: {N_txt}/{N_txt} slides · Codex rehízo {K - N} y eligió {FINAL} · tokens: {TOK} · imágenes: {K} · cuenta '{CUENTA}': {gastadas_24h()} en 24 h")
            return 0
        say(f"SOBRAN: Codex generó {K} imágenes para {N_txt} slides (rehízo alguna). Elige en la app cuál es la buena de cada slide.")
        raise Salir(4)
    i = 0
    for f in FILES:
        i += 1
        if not ajustar_4x5(f, OUT / "_sin_pie" / f"{i}.png"):
            say(f"FALLO: la imagen {i} de Codex no se pudo recortar a 4:5 ({f})")
            raise Salir(1)
        if not estampar(OUT, i, N_txt):
            say(f"FALLO: no se pudo estampar el pie del slide {i}")
            raise Salir(1)
    if LIM:
        say(f"LIMITE_DE_USO tras {i} de {N_txt} slides · tokens: {TOK}")
        raise Salir(2)
    if i < N:
        say(f"INCOMPLETO: {i}/{N_txt} slides (codex exit {RC}) · tokens: {TOK} · ver {LOG or ''}")
        raise Salir(1)
    cmd_revisar(nombre)
    say(f"OK carrusel {nombre}: {N_txt}/{N_txt} slides · tokens: {TOK} · imágenes: {K} · cuenta '{CUENTA}': {gastadas_24h()} en 24 h")
    return 0


def _ok_entre_comillas():
    return ("INSTRUCCIÓN TÉCNICA: no leas skills ni archivos y no ejecutes ningún comando. Llama UNA sola vez a la herramienta "
            "de generación de imágenes con todo lo anterior y termina respondiendo solo 'ok'.\n")


def cmd_corregir(nombre, n, cambio):
    OUT = SALIDA / nombre
    N = cab(nombre, "slides")
    if not (OUT / "_sin_pie" / f"{n}.png").is_file():
        say(f"No existe {OUT / '_sin_pie' / f'{n}.png'}")
        raise Salir(1)
    if not hay_cupo(1):
        raise Salir(3)
    (OUT / "_versiones").mkdir(parents=True, exist_ok=True)
    (OUT / "_correcciones").mkdir(parents=True, exist_ok=True)
    k = 1
    while (OUT / "_versiones" / f"{n}_v{k}.png").exists():
        k += 1
    P = OUT / "_correcciones" / f"slide_{n}_v{k}.txt"
    # Cada corrección lleva las fotos del personaje (1 o 2): al editar, la cara pierde calidad copia a copia si no tiene la referencia.
    FOTOS = [str(MARCA / f) for f in lista_comas(dato("fotos"))][:2]
    if not FOTOS:
        say("FALTA_MARCA: este cliente no tiene fotos del personaje. Súbelas en Branding.")
        raise Salir(1)
    QUIEN = "La imagen 2 es una foto del personaje: su cara tiene que quedar exactamente como en esa foto"
    if len(FOTOS) >= 2:
        QUIEN = "Las imágenes 2 y 3 son fotos del personaje: su cara tiene que quedar exactamente como en esas fotos"
    IMAGENES = [str(OUT / "_sin_pie" / f"{n}.png")] + FOTOS
    if env_o("REDISENO", "0") == "1":
        # Rediseño: Codex recibe el slide ORIGINAL como referencia (imagen 1) y rehace el slide con su diseño, con los textos de la ficha.
        REFERENCIA = VIRALES / nombre / f"slide_{entero(n):02d}.jpg"
        FI = ficha_de(nombre)
        if not REFERENCIA.is_file():
            say(f"No existe el slide original {REFERENCIA}")
            raise Salir(1)
        TEXTOS = ""
        for c in ("titular", "arriba", "debajo", "texto_escena", "cta_grande"):
            v = py_salida("ficha.py", "campo", FI, n, c)
            if v and v != "ninguno":
                TEXTOS += f'- {c}: "{v}"\n'
        if py_salida("ficha.py", "campo", FI, n, "personaje") in ("si", "sí", "Si", "Sí"):
            IMAGENES = [str(REFERENCIA)] + FOTOS
            PERSONA = ("El personaje es el de la imagen 2" + (" y 3" if len(FOTOS) >= 2 else "")
                       + " (fotos): su cara tiene que quedar exactamente como en esas fotos, nítida y con sus rasgos.")
        else:
            IMAGENES = [str(REFERENCIA)]
            PERSONA = "En este slide no aparece ninguna persona."
        texto = ("Crea un slide de un carrusel de Instagram vertical 4:5 (1080 x 1350) con el mismo diseño que la imagen 1, que es el slide original de referencia.\n"
                 "Copia de la referencia: el fondo y su color, la composición, el tamaño y el estilo de la letra, los iconos, logos, móviles e ilustraciones, "
                 "los colores de los resaltados y la cantidad de elementos. Tiene que parecerse a la referencia en un 95 %.\n"
                 "Textos: escribe exactamente estas palabras, con sus tildes, y ninguna más (las mayúsculas y minúsculas las marca la referencia, salvo que abajo "
                 "se diga otra cosa; si una casilla trae varias líneas entre comillas separadas por \" / \", cada una es una línea del slide; el texto de la escena "
                 "va dentro de la escena donde la referencia tiene texto):\n"
                 f"{TEXTOS}\nCambios sobre la referencia: {cambio}\n{PERSONA}\n"
                 "No copies de la referencia su @, su foto de perfil, su contador ni las flechas de abajo. Deja el 10 % inferior de la imagen liso, del color del "
                 "fondo (ahí pondremos nosotros el pie). No pongas contador ni pie.\n\n" + _ok_entre_comillas())
    else:
        texto = (f"Edita la imagen 1 (slide de un carrusel de Instagram, 4:5). {QUIEN}, nítida y con sus rasgos, aunque el resto del slide no cambie.\n"
                 "Mantén todo lo demás exactamente igual: pose, ropa, fondo, titular y textos.\n"
                 f"Único cambio: {cambio}\nNo añadas ningún texto ni elemento nuevo. No pongas contador ni pie.\n\n" + _ok_entre_comillas())
    escribir_texto(P, texto)
    LOG = siguiente_log(OUT, f"slide_{n}")
    RC = llamar_codex(OUT, P, LOG, IMAGENES)
    if RC == 5:
        raise Salir(5)
    if env_o("ENSAYO", "0") == "1":
        raise Salir(0)
    t = leer_texto(LOG)
    TOK, SID = tokens_de(t), sid_de(t)
    if not SID:
        say(f"FALLO: sin session id · ver {LOG}")
        raise Salir(1)
    escribir_texto(OUT / "_logs" / "sesiones.txt", SID + "\n", "a")
    FILES = imagenes_de_sesion(SID)
    anotar_cupo(nombre, f"slide_{n}", len(FILES), TOK)
    if not FILES:
        say("LIMITE_DE_USO" if limite_de_uso(t) else f"FALLO slide {n} (exit {RC}) · ver {LOG}")
        raise Salir(1)
    anterior = OUT / "_versiones" / f"{n}_v{k}.png"
    shutil.copyfile(OUT / "_sin_pie" / f"{n}.png", anterior)
    # si la imagen nueva no se puede recortar o estampar, se deja la anterior y se dice
    if not (ajustar_4x5(FILES[-1], OUT / "_sin_pie" / f"{n}.png") and estampar(OUT, n, N)):
        shutil.copyfile(anterior, OUT / "_sin_pie" / f"{n}.png")
        estampar(OUT, n, N)
        say(f"FALLO: Codex hizo la corrección del slide {n}, pero no se pudo recortar o estampar (ver {FILES[-1]}). El slide se queda como estaba.")
        raise Salir(1)
    cmd_revisar(nombre, mostrar=False)
    say(f"OK slide {n} corregido · tokens: {TOK} · versión anterior en _versiones/{n}_v{k}.png · cuenta '{CUENTA}': {gastadas_24h()} en 24 h")
    return 0


def cmd_elegir(nombre, lista, quieto=""):
    """<nombre> <a,b,c> [quieto]: coloca las imágenes de _revisar/ como slides 1..N, en ese orden. No gasta imágenes."""
    OUT = SALIDA / nombre
    N = cab(nombre, "slides")
    nums = [x for x in lista.split(",") if x]
    if not N.strip().isdigit() or len(nums) != int(N):
        say(f"Hacen falta {N} números (uno por slide) y llegaron {len(nums)}: {lista}")
        return 1
    for k in nums:
        if not (re.fullmatch(r"[0-9]+", k) and (OUT / "_revisar" / f"orden_{int(k):02d}.png").is_file()):
            say(f"No existe la imagen {k} en _revisar/")
            return 1
    (OUT / "_sin_pie").mkdir(parents=True, exist_ok=True)
    for i, k in enumerate(nums, 1):
        try:
            shutil.copyfile(OUT / "_revisar" / f"orden_{int(k):02d}.png", OUT / "_sin_pie" / f"{i}.png")
            ok = estampar(OUT, i, N)
        except OSError:
            ok = False
        if not ok:
            say(f"FALLO: no se pudo colocar la imagen {k} como slide {i}")
            return 1
    cmd_revisar(nombre, mostrar=False)
    if quieto != "quieto":
        say(f"OK carrusel {nombre}: slides elegidos {lista}")
    return 0


def cmd_revisar(nombre, mostrar=True):
    """<nombre>: hoja + tira de pies."""
    OUT = SALIDA / nombre
    N = entero(cab(nombre, "slides"))
    cols, rows = min(N, 6), (N + 5) // 6
    ffmpeg("-y", "-loglevel", "error", "-start_number", "1", "-i", OUT / "%d.png", "-frames:v", "1",
           "-vf", f"scale=360:450,tile={cols}x{rows}", OUT / "_hoja.jpg")
    ffmpeg("-y", "-loglevel", "error", "-start_number", "1", "-i", OUT / "%d.png", "-frames:v", "1",
           "-vf", f"crop=1080:170:0:1180,scale=540:85,tile=1x{N}", OUT / "_pies.jpg")
    if mostrar:
        say(f"Revisión: {OUT / '_hoja.jpg'} y {OUT / '_pies.jpg'}")
    return 0


def cmd_cerrar(nombre):
    """<nombre>: solo tras el ok del usuario. Deja los JPG listos con adaptar.py."""
    OUT = SALIDA / nombre
    N = entero(cab(nombre, "slides"))
    for n in range(1, N + 1):
        if not (OUT / f"{n}.png").is_file():
            say(f"Falta {OUT / f'{n}.png'}")
            raise Salir(1)
    SIDS = leer_texto(OUT / "_logs" / "sesiones.txt").split()
    # fuera todo lo que no es un slide, para que adaptar solo toque los N PNG
    for x in ("_sin_pie", "_versiones", "_viral", "_logs", "_correcciones", "_revisar", "_hoja.jpg", "_pies.jpg", "_prompt.txt", ".DS_Store"):
        p = OUT / x
        if p.is_dir() and not p.is_symlink():
            shutil.rmtree(p, ignore_errors=True)
        elif p.exists() or p.is_symlink():
            try:
                p.unlink()
            except OSError:
                pass
    aviso = ""
    # ubicación de los metadatos: la del cliente (perfil.json); si no tiene, la de ajustes.json; si no, Newark
    u = {}
    for p in (DATOS_PERFIL / "perfil.json", DATOS / "ajustes.json"):
        if p.is_file():
            try:
                with open(p, encoding="utf-8") as f:
                    u = json.load(f).get("ubicacion") or {}
            except Exception:
                u = {}
            if u:
                break
    ubi = ["--ciudad", u.get("ciudad", "Newark"), "--estado", u.get("estado", "New Jersey"), "--pais", u.get("pais", "United States"),
           "--codigo", u.get("codigo", "US"), "--lat", str(u.get("lat", 40.7357)), "--lon", str(u.get("lon", -74.1724))]
    if py("adaptar.py", OUT, *ubi) != 0:
        aviso = ("ATENCIÓN: la skill avisó de rastros en algún JPG. Comprobar con: grep -aioE 'c2pa|openai|sora' <archivo>. Un 'sORA' suelto "
                 "dentro de los bytes de la imagen es casualidad: se recodifica ese JPG con calidad 91 y se vuelve a limpiar.")
    for n in range(1, N + 1):
        if not (OUT / f"{n}.jpg").is_file():
            say(f"Falta {OUT / f'{n}.jpg'} tras adaptar")
            raise Salir(1)
    if not aviso:
        shutil.rmtree(f"{OUT}_originales", ignore_errors=True)  # los PNG con C2PA no se guardan; si hubo aviso, se dejan hasta revisar
    borradas = 0
    for s in SIDS:
        d = GEN / s
        if d.is_dir():
            borradas += sum(1 for x in os.listdir(d) if not x.startswith("."))
            shutil.rmtree(d, ignore_errors=True)
    gastadas = _num_txt(sum(_num_awk(c[6]) for c in _filas_cupo() if len(c) >= 7 and c[4] == nombre))
    if not ESTADO.is_file():
        escribir_texto(ESTADO, "# Estado de los carruseles\n\n| Carrusel | Fecha | Slides | Imágenes gastadas | Notas |\n|---|---|---|---|---|\n")
    escribir_texto(ESTADO, f"| {nombre} | {datetime.date.today():%Y-%m-%d} | {N} | {gastadas} | cerrado |\n", "a")
    say(f"CERRADO {nombre}: {N} JPG listos para subir en {OUT} · imágenes gastadas en total: {gastadas} · copias de Codex borradas: {borradas}")
    if aviso:
        say(aviso)
    return 0


def _texto_claude(nombre, F, OUT, prompt_de, base_log):
    """Parte común de descripcion y variaciones: llama a Claude sin herramientas y devuelve el log."""
    claude = buscar_claude()
    if not claude:
        say("Falta Claude Code. Instálalo (npm install -g @anthropic-ai/claude-code) y entra con: claude")
        raise Salir(1)
    P = prompt_de()
    if env_o("ENSAYO", "0") == "1":
        say(f"ENSAYO: no se llama a Claude. Prompt: {P}")
        raise Salir(0)
    LOG = siguiente_log(OUT, base_log)
    # sin herramientas: todo lo que necesita va en el prompt
    with open(P, "rb") as e, open(LOG, "wb") as o, open(f"{LOG}.err", "wb") as er:
        rc = run(claude + ["-p", "--tools", "", "--output-format", "text"], stdin=e, stdout=o, stderr=er)
    if rc != 0:
        fallo_claude(rc, LOG, claude)
        raise Salir(1)
    return LOG


def cmd_descripcion(nombre):
    """Claude Code (con la sesión del usuario) escribe la descripción de Instagram. Tokens, no imágenes."""
    F, OUT = ficha_de(nombre), SALIDA / nombre
    if not F.is_file():
        say(f"No existe la ficha {F}")
        raise Salir(1)
    (OUT / "_logs").mkdir(parents=True, exist_ok=True)

    def prompt():
        P = OUT / "_logs" / "prompt_descripcion.txt"
        if py("ficha.py", "prompt_descripcion", F, P) != 0:
            raise Salir(1)
        return P
    LOG = _texto_claude(nombre, F, OUT, prompt, "descripcion")
    t = re.sub(r"```\w*", "", leer_texto(LOG)).strip()
    if not t:
        print("Claude no devolvió texto. Ver " + str(LOG), file=sys.stderr, flush=True)
        raise Salir(1)
    nueva = OUT / "_descripcion_nueva.txt"
    escribir_texto(nueva, t + "\n")
    # solo se guarda si pasa la comprobación; si no, la anterior (si la hay) se queda como estaba
    if py("ficha.py", "comprobar_descripcion", F, nueva) != 0:
        say(f"Texto rechazado en {nueva}")
        raise Salir(1)
    os.replace(nueva, OUT / "descripcion.txt")
    anotar_cupo(nombre, "descripcion", 0, "claude")
    say(f"Descripción escrita en {OUT / 'descripcion.txt'}")
    return 0


def cmd_variaciones(nombre):
    """5 variaciones de la descripción, para probar cuál funciona. Tokens, no imágenes."""
    F, OUT = ficha_de(nombre), SALIDA / nombre
    if not F.is_file():
        say(f"No existe la ficha {F}")
        raise Salir(1)
    if not (OUT / "descripcion.txt").is_file():
        say(f"Primero hace falta la descripción: carrusel.sh descripcion {nombre}")
        raise Salir(1)
    (OUT / "_logs").mkdir(parents=True, exist_ok=True)

    def prompt():
        P = OUT / "_logs" / "prompt_variaciones.txt"
        if py("ficha.py", "prompt_variaciones", F, OUT / "descripcion.txt", P) != 0:
            raise Salir(1)
        return P
    LOG = _texto_claude(nombre, F, OUT, prompt, "variaciones")
    t = re.sub(r"```\w*", "", leer_texto(LOG))
    i = t.find("=== VARIACI")
    if i < 0:
        print("Claude no devolvió variaciones. Ver " + str(LOG), file=sys.stderr, flush=True)
        raise Salir(1)
    nuevas = OUT / "_variaciones_nuevas.txt"
    escribir_texto(nuevas, t[i:].strip() + "\n")
    # solo se guardan si pasan la comprobación; si no, las anteriores (si las hay) se quedan como estaban
    if py("ficha.py", "comprobar_variaciones", F, nuevas) != 0:
        say(f"Texto rechazado en {nuevas}")
        raise Salir(1)
    os.replace(nuevas, OUT / "variaciones.txt")
    anotar_cupo(nombre, "variaciones", 0, "claude")
    say(f"Variaciones escritas en {OUT / 'variaciones.txt'}")
    return 0


def _color_esquinas(png):
    """Color del fondo: la media de las cuatro esquinas de la escena (bloques de 20x20), en hex sin #."""
    from PIL import Image, ImageStat
    with Image.open(png) as im:
        im = im.convert("RGB")
        esq = [[int(v + 0.5) for v in ImageStat.Stat(im.crop((x, y, x + 20, y + 20))).mean[:3]]
               for x, y in ((10, 10), (1050, 10), (10, 1320), (1050, 1320))]
    return "".join("%02x" % round(sum(c[i] for c in esq) / len(esq)) for i in range(3))


def cmd_encoger(nombre, n, f="0.92", y="0"):
    """Cuando Codex lleva la escena hasta el pie o el titular choca con el contador. Sin Codex: no gasta imágenes."""
    OUT = SALIDA / nombre
    N = cab(nombre, "slides")
    sin_pie = OUT / "_sin_pie" / f"{n}.png"
    if not sin_pie.is_file():
        say(f"No existe {sin_pie}")
        raise Salir(1)
    try:
        fac, dy = float(f), int(y)
    except ValueError:
        say(f"FALLO al encoger el slide {n}: factor o desplazamiento no válidos ({f}, {y})")
        raise Salir(1)
    (OUT / "_versiones").mkdir(parents=True, exist_ok=True)
    k = 1
    while (OUT / "_versiones" / f"{n}_v{k}.png").exists():
        k += 1
    ver = OUT / "_versiones" / f"{n}_v{k}.png"
    shutil.copyfile(sin_pie, ver)
    w, h = int(round(1080 * fac / 2)) * 2, int(round(1350 * fac / 2)) * 2
    x = (1080 - w) // 2
    try:
        col = _color_esquinas(sin_pie)
    except Exception:
        col = None
    # todo en RGB (gbrp): con la mezcla en YUV el azul de la marca se apagaba (#0270FD → #3C72B5, medido 01-10-2026)
    if col is None or ffmpeg(
            "-y", "-loglevel", "error", "-i", ver, "-f", "lavfi", "-i", f"color=c=0x{col}:s=1080x1350", "-f", "lavfi", "-i", "color=c=black:s=1080x1350",
            "-filter_complex",
            f"[0]format=gbrp,scale={w}:{h}:flags=lanczos[e];[1]format=gbrp,split[bg][bg2];[bg][e]overlay={x}:{dy}:format=gbrp[im];"
            f"[2]format=gbrp,drawbox=x={x + 20}:y=0:w={w - 40}:h={h + dy - 20}:color=white:t=fill,boxblur=18:1[m];[bg2][im][m]maskedmerge,format=rgb24",
            "-frames:v", "1", sin_pie) != 0:
        shutil.copyfile(ver, sin_pie)
        say(f"FALLO al encoger el slide {n}")
        raise Salir(1)
    if estampar(OUT, n, N):
        cmd_revisar(nombre, mostrar=False)
    say(f"OK slide {n} encogido al {f}, bajado {y} px · fondo #{col} · versión anterior en _versiones/{n}_v{k}.png")
    return 0


def cmd_reestampar(nombre, cual=""):
    """Vuelve a estampar contador y pie sobre _sin_pie/ (no gasta imágenes). Sirve al cambiar el pie en la ficha."""
    OUT = SALIDA / nombre
    N = cab(nombre, "slides")
    lista = cual.split() if cual else [str(k) for k in range(1, entero(N) + 1)]
    for k in lista:
        if not (OUT / "_sin_pie" / f"{k}.png").is_file():
            say(f"No existe {OUT / '_sin_pie' / f'{k}.png'}")
            raise Salir(1)
        if not estampar(OUT, k, N):
            say(f"FALLO: no se pudo estampar el pie del slide {k}")
            raise Salir(1)
    cmd_revisar(nombre, mostrar=False)
    say(f"OK pie estampado en los slides: {' '.join(lista)}")
    return 0


def cmd_cupo():
    say(f"Cuenta '{CUENTA}': {gastadas_24h()} imágenes en las últimas 24 h (tope {TOPE})")
    return 0


def uso():
    sys.stdout.write(USO)
    sys.stdout.flush()
    raise Salir(64)


def main(a):
    # estilo: claro en la ficha → pie en azul marino (plantilla) y PROMPT_BASE_CLARO.txt (ficha.py)
    # pie_claro: si → solo el pie en azul marino; referencia → pie centrado (línea · foto · @ · línea con flecha)
    if len(a) >= 2 and ficha_de(a[1]).is_file():
        if cab(a[1], "estilo") == "claro" or cab(a[1], "pie_claro") in ("si", "referencia"):
            os.environ["PIE_ESTILO"] = "claro"
        if cab(a[1], "pie_claro") == "referencia":
            os.environ["PIE_VARIANTE"] = "referencia"
            fotos = dato("fotos").split(",")
            av = fotos[0].lstrip(" ") if fotos else ""
            if av and (MARCA / av).is_file():
                os.environ["PIE_AVATAR"] = str(MARCA / av)
        os.environ["PIE_FICHA"] = str(ficha_de(a[1]))
    orden = a[0] if a else ""
    n = len(a)
    exactos = {"bajar": 3, "nueva": 3, "ficha_ia": 2, "comprobar": 2, "generar": 2, "corregir": 4, "revisar": 2,
               "elegir": 3, "cerrar": 2, "descripcion": 2, "variaciones": 2}
    minimos = {"encoger": 3, "reestampar": 2}
    if orden in exactos and n != exactos[orden]:
        uso()
    if orden in minimos and n < minimos[orden]:
        uso()
    arg = lambda i, d="": a[i] if len(a) > i and a[i] else d  # ${i:-d}
    if orden == "bajar":
        return cmd_bajar(a[1], a[2])
    if orden == "nueva":
        return cmd_nueva(a[1], a[2])
    if orden == "ficha_ia":
        return cmd_ficha_ia(a[1])
    if orden == "comprobar":
        return cmd_comprobar(a[1])
    if orden == "generar":
        return cmd_generar(a[1])
    if orden == "corregir":
        return cmd_corregir(a[1], a[2], a[3])
    if orden == "revisar":
        return cmd_revisar(a[1])
    if orden == "elegir":
        return cmd_elegir(a[1], a[2])
    if orden == "cerrar":
        return cmd_cerrar(a[1])
    if orden == "descripcion":
        return cmd_descripcion(a[1])
    if orden == "encoger":
        return cmd_encoger(a[1], a[2], arg(3, "0.92"), arg(4, "0"))
    if orden == "variaciones":
        return cmd_variaciones(a[1])
    if orden == "reestampar":
        return cmd_reestampar(a[1], arg(2))
    if orden == "cupo":
        return cmd_cupo()
    uso()


if __name__ == "__main__":
    try:
        codigo = main(sys.argv[1:]) or 0
    except Salir as s:
        codigo = s.codigo
    except KeyboardInterrupt:
        say("Interrumpido: el motor se paró antes de terminar.")
        codigo = 1
    except Exception as e:
        if env("DEBUG_MOTOR") == "1":
            traceback.print_exc()
        detalle = str(e).splitlines()[0] if str(e) else ""
        say(f"FALLO inesperado del motor ({type(e).__name__}{': ' + detalle if detalle else ''}). Con DEBUG_MOTOR=1 se ve el detalle.")
        codigo = 1
    sys.stdout.flush()
    sys.exit(codigo)
