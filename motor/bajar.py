"""Descarga los slides de un post de Instagram con ScrapeCreators: bajar.py <url> <destino>

Para las pruebas sin gasto (motor/pruebas/correr.sh):
  SC_RESPUESTA=<archivo.json>  lee la respuesta guardada en vez de llamar a ScrapeCreators (no gasta créditos)
  SC_SIN_IMAGENES=1            no baja las imágenes: deja en su sitio una imagen de prueba
"""
import json, os, re, shutil, sys, urllib.parse, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))


def respuesta(url):
    guardada = os.environ.get("SC_RESPUESTA")
    if guardada:
        return json.load(open(guardada, encoding="utf-8"))
    q = urllib.parse.urlencode({"url": url, "include_play_count": "false"})
    r = urllib.request.Request("https://api.scrapecreators.com/v1/instagram/post?" + q, headers={"x-api-key": os.environ["SC_KEY"]})
    return json.load(urllib.request.urlopen(r, timeout=120))


def bajar(u, p):
    if os.environ.get("SC_SIN_IMAGENES") == "1":
        shutil.copy(os.path.join(AQUI, "pruebas", "slide_prueba.jpg"), p); return
    rq = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(rq, timeout=120) as s, open(p, "wb") as f:
        f.write(s.read())


NO_ES_CARRUSEL = 6  # código de salida: el link es de un reel o de una foto suelta (la app lo enseña en una ventana)


def no_es_carrusel(que):
    print(f"NO_ES_CARRUSEL: Ese link es de {que}, no de un carrusel. Pega el link de un post con varios slides.")
    sys.exit(NO_ES_CARRUSEL)


def main(url, dest):
    # un reel se reconoce por el link: se para sin llamar a ScrapeCreators (no gasta crédito)
    if re.search(r"instagram\.com/(reels?|tv)/", url):
        no_es_carrusel("un reel")
    if os.path.exists(dest):
        raise SystemExit(f"Ya existe {dest}: bórralo o usa otro nombre.")
    d = respuesta(url); d = d.get("data") or d
    m = d.get("xdt_shortcode_media") or {}
    if not m:
        raise SystemExit("La API no devolvió el post: " + str(d)[:300])
    kids = [e["node"] for e in m.get("edge_sidecar_to_children", {}).get("edges", [])]
    if not kids:  # una foto suelta o un vídeo publicado con /p/: solo se sabe después de preguntar (1 crédito)
        no_es_carrusel("un vídeo" if m.get("is_video") else "una foto suelta")
    # todos o ninguno: primero se comprueba que cada slide trae imagen; los de vídeo cuentan con su portada
    # (antes se saltaban y un carrusel de 6 con 3 vídeos se quedaba en 3 slides, sin avisar)
    srcs = []; videos = []
    for i, kd in enumerate(kids, 1):
        res = sorted(kd.get("display_resources") or [], key=lambda x: x.get("config_width", 0))
        src = res[-1]["src"] if res else kd.get("display_url")
        if not src:
            raise SystemExit(f"FALTA_SLIDE: el slide {i} de {len(kids)} no trae imagen. No se descarga nada para no dejar el carrusel a medias; prueba de nuevo en unos minutos.")
        srcs.append(src)
        if kd.get("is_video"):
            videos.append(i)
    # se baja a una carpeta provisional: solo pasa a su sitio si bajan todos
    tmp = dest + ".bajando"; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    try:
        for i, src in enumerate(srcs, 1):
            try:
                bajar(src, f"{tmp}/slide_{i:02d}.jpg")
            except Exception as e:
                raise SystemExit(f"FALLO_DESCARGA: no se pudo bajar el slide {i} de {len(srcs)} ({e}). No queda nada a medias; prueba de nuevo.")
        cap = (m.get("edge_media_to_caption", {}).get("edges") or [{}])[0].get("node", {}).get("text", "")
        user = (m.get("owner") or {}).get("username", "")
        likes = (m.get("edge_media_preview_like") or {}).get("count", "")
        com = (m.get("edge_media_to_parent_comment") or m.get("edge_media_preview_comment") or {}).get("count", "")
        nota = f"Slides de vídeo (se usa su portada): {', '.join(map(str, videos))}\n" if videos else ""
        open(f"{tmp}/info.txt", "w").write(f"URL: {url}\nCuenta: @{user}\nComentarios: {com}\nLikes: {likes}\nSlides: {len(srcs)}\n{nota}\nTexto:\n{cap}\n")
        os.rename(tmp, dest)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"{len(srcs)} de {len(srcs)} slides descargados en {dest}" + (f" ({len(videos)} de vídeo: se usa su portada)" if videos else ""))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
