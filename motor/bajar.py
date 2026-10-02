"""Descarga los slides de un post de Instagram con ScrapeCreators: bajar.py <url> <destino>

Para las pruebas sin gasto (motor/pruebas/correr.sh):
  SC_RESPUESTA=<archivo.json>  lee la respuesta guardada en vez de llamar a ScrapeCreators (no gasta créditos)
  SC_SIN_IMAGENES=1            no baja las imágenes: deja en su sitio una imagen de prueba
"""
import json, os, shutil, sys, urllib.parse, urllib.request

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


def main(url, dest):
    d = respuesta(url); d = d.get("data") or d
    m = d.get("xdt_shortcode_media") or {}
    if not m:
        raise SystemExit("La API no devolvió el post: " + str(d)[:300])
    kids = [e["node"] for e in m.get("edge_sidecar_to_children", {}).get("edges", [])] or [m]
    n = 0; videos = []
    for i, kd in enumerate(kids, 1):
        # los slides de vídeo también cuentan: se baja su portada (la imagen que enseña Instagram antes de reproducirlo).
        # Antes se saltaban y un carrusel de 6 con 3 vídeos se quedaba en 3 slides (01, 04, 06), sin avisar.
        res = sorted(kd.get("display_resources") or [], key=lambda x: x.get("config_width", 0))
        src = res[-1]["src"] if res else kd.get("display_url")
        if not src:
            print(f"AVISO: el slide {i} no trae imagen; se omite"); continue
        bajar(src, f"{dest}/slide_{i:02d}.jpg"); n += 1
        if kd.get("is_video"):
            videos.append(i)
    cap = (m.get("edge_media_to_caption", {}).get("edges") or [{}])[0].get("node", {}).get("text", "")
    user = (m.get("owner") or {}).get("username", "")
    likes = (m.get("edge_media_preview_like") or {}).get("count", "")
    com = (m.get("edge_media_to_parent_comment") or m.get("edge_media_preview_comment") or {}).get("count", "")
    nota = f"Slides de vídeo (se usa su portada): {', '.join(map(str, videos))}\n" if videos else ""
    open(f"{dest}/info.txt", "w").write(f"URL: {url}\nCuenta: @{user}\nComentarios: {com}\nLikes: {likes}\nSlides: {n}\n{nota}\nTexto:\n{cap}\n")
    print(f"{n} slides descargados en {dest}" + (f" ({len(videos)} de vídeo: se usa su portada)" if videos else ""))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
