#!/usr/bin/env python3
"""Dibuja la plantilla del slide: fondo oscuro, contador arriba a la izquierda y pie abajo.

Versión multiplataforma (macOS, Windows y Linux) de plantilla.swift: misma geometría, colores y textos.
Uso: python3 plantilla.py <n> <N> <salida.png> [fondo]
  Sin "fondo": capa transparente para estampar encima de un slide. Con "fondo": fondo azul oscuro, para verla.

Variables de entorno (las mismas que plantilla.swift):
  PIE_HANDLE        el @ de la cuenta (por defecto @tucuenta)
  PIE_ESTILO=claro  pie y segmentos en azul marino; con "fondo", la guía se dibuja sobre crema
  PIE_LEMA          lema pequeño bajo el @
  PIE_SIGUIENTE     adelanto del siguiente slide, dos líneas separadas por " / "
  PIE_VARIANTE=referencia  pie centrado: línea · foto redonda · @ · línea con flecha
  PIE_AVATAR        ruta de la foto de perfil (solo con PIE_VARIANTE=referencia)
  PIE_HANDLE_AZUL=1 el @ en el azul de la marca
  PLANTILLA_FUENTE=bundled  usa siempre las fuentes de fuentes/ (Inter), también en Mac (útil para pruebas)

Todo se dibuja a escala ESCALA y al final se reduce con LANCZOS, para que líneas y curvas queden suaves
como en CoreGraphics. Las coordenadas son de imagen (origen arriba a la izquierda) y los textos se colocan
por su línea base, igual que en CoreText.
"""
import math
import os
import sys
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
FUENTES = os.path.join(AQUI, "fuentes")
W, H = 1080, 1350
ESCALA = 4  # supermuestreo: se dibuja a 4x y se reduce al final

AZUL = (0x1A, 0x79, 0xFB, 255)
MARINO = (0x0B, 0x1A, 0x33, 255)
BLANCO_PURO = (255, 255, 255, 255)


def rgba(r, g, b, a=1.0):
    """Color con alfa en 0..1, como CGColor."""
    return (r, g, b, round(a * 255))


# ---------- fuentes ----------

HELVETICA_MAC = "/System/Library/Fonts/HelveticaNeue.ttc"
# nombre lógico (como en CoreText) -> (estilo en HelveticaNeue.ttc, archivo de Inter)
CARAS = {"HelveticaNeue-Bold": ("Bold", "Inter-Bold.ttf"),
         "HelveticaNeue": ("Regular", "Inter-Regular.ttf")}


@lru_cache(maxsize=None)
def indice_helvetica(estilo):
    """Índice de la cara 'Helvetica Neue <estilo>' dentro del .ttc del Mac, o None si no está."""
    if os.environ.get("PLANTILLA_FUENTE") == "bundled" or not os.path.isfile(HELVETICA_MAC):
        return None
    for i in range(32):
        try:
            nombre = ImageFont.truetype(HELVETICA_MAC, 12, index=i).getname()
        except OSError:
            break
        if nombre == ("Helvetica Neue", estilo):
            return i
    return None


@lru_cache(maxsize=None)
def fuente(nombre, tam):
    """Fuente al tamaño `tam` (en puntos de la plantilla, ya multiplicado por ESCALA)."""
    estilo, archivo = CARAS[nombre]
    i = indice_helvetica(estilo)
    if i is not None:
        try:
            return ImageFont.truetype(HELVETICA_MAC, tam, index=i)
        except OSError:
            pass
    ruta = os.path.join(FUENTES, archivo)
    if not os.path.isfile(ruta):
        raise RuntimeError(f"falta la fuente {ruta}")
    return ImageFont.truetype(ruta, tam)


def medir(s, nombre, tam, espacio=0.0):
    """Ancho tipográfico como CTLineGetTypographicBounds: avances + espaciado extra tras cada letra."""
    if not s:
        return 0.0
    f = fuente(nombre, tam * ESCALA)
    if espacio == 0:
        return f.getlength(s) / ESCALA
    return sum(f.getlength(c) / ESCALA + espacio for c in s)


# ---------- lienzo por capas ----------

class Capa:
    """Zona rectangular de un solo color: se dibuja la máscara (cobertura) y luego se funde sobre el lienzo.
    Así los colores con alfa se mezclan como en CoreGraphics (un trazo o relleno = una pintada)."""

    def __init__(self, lienzo, x0, y0, x1, y1, color):
        self.lienzo, self.color = lienzo, color
        self.ox, self.oy = math.floor(x0) - 2, math.floor(y0) - 2
        ancho, alto = math.ceil(x1) + 2 - self.ox, math.ceil(y1) + 2 - self.oy
        self.mascara = Image.new("L", (ancho * ESCALA, alto * ESCALA), 0)
        self.d = ImageDraw.Draw(self.mascara)

    def p(self, x, y):
        return ((x - self.ox) * ESCALA, (y - self.oy) * ESCALA)

    def rect_redondo(self, x, y, w, h, r, borde=0.0):
        """Rectángulo redondeado relleno o, con `borde`, su contorno centrado en el borde (como strokePath)."""
        if borde:
            m = borde / 2
            x, y, w, h, r = x - m, y - m, w + borde, h + borde, r + m
        x0, y0 = self.p(x, y)
        x1, y1 = self.p(x + w, y + h)
        self.d.rounded_rectangle((x0, y0, x1 - 1, y1 - 1), radius=r * ESCALA, fill=None if borde else 255,
                                 outline=255 if borde else None, width=round(borde * ESCALA) if borde else 0)

    def trazo(self, puntos, ancho, redondo):
        """Polilínea de grosor `ancho`; con `redondo`, extremos y uniones redondeados."""
        m = ancho * ESCALA / 2
        pts = [self.p(x, y) for x, y in puntos]
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            lx, ly = bx - ax, by - ay
            largo = math.hypot(lx, ly) or 1
            nx, ny = -ly / largo * m, lx / largo * m
            self.d.polygon([(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)], fill=255)
        if redondo:
            for x, y in pts:
                self.d.ellipse((x - m, y - m, x + m, y + m), fill=255)

    def texto(self, s, nombre, tam, x, base, espacio=0.0):
        """Texto con la línea base en `base`; con `espacio`, letra a letra con ese hueco extra (kern de CoreText)."""
        f = fuente(nombre, tam * ESCALA)
        if espacio == 0:
            self.d.text(self.p(x, base), s, font=f, fill=255, anchor="ls")
            return
        for c in s:
            self.d.text(self.p(x, base), c, font=f, fill=255, anchor="ls")
            x += f.getlength(c) / ESCALA + espacio

    def fundir(self):
        r, g, b, a = self.color
        capa = Image.new("RGBA", self.mascara.size, (r, g, b, 0))
        capa.putalpha(self.mascara if a == 255 else self.mascara.point(lambda v: v * a // 255))
        self.lienzo.alpha_composite(capa, dest=(self.ox * ESCALA, self.oy * ESCALA))


def fondo_radial(lienzo):
    """Degradado radial: #0d2050 en (540, 600) a #040915 a 900 px; más allá, el color final."""
    c0, c1 = (0x0D, 0x20, 0x50, 255), (0x04, 0x09, 0x15, 255)
    # radial_gradient da 256x256 con 0 en el centro y 255 en el borde (radio 128): se escala a radio 900
    mapa = Image.radial_gradient("L").resize((1800, 1800), Image.BILINEAR)
    grad = Image.composite(Image.new("RGBA", mapa.size, c1), Image.new("RGBA", mapa.size, c0), mapa)
    base = Image.new("RGBA", lienzo.size, c1)
    base.paste(grad, (540 - 900, 600 - 900))
    lienzo.paste(base, (0, 0))


def dibujar(n, total, con_fondo, env):
    handle = env.get("PIE_HANDLE", "@tucuenta")
    claro = env.get("PIE_ESTILO") == "claro"
    blanco = MARINO if claro else BLANCO_PURO
    # Lo dibujado va en un lienzo transparente a escala; el fondo (si lo hay) se pone debajo al final, a tamaño real
    lienzo = Image.new("RGBA", (W * ESCALA, H * ESCALA), (0, 0, 0, 0))

    def capa(x0, y0, x1, y1, color):
        return Capa(lienzo, x0, y0, x1, y1, color)

    def texto_izq(s, nombre, tam, x, base, color, espacio=0.0, ancho=10_000.0):
        """Texto alineado a la izquierda, con espaciado entre letras; si no cabe en `ancho`, baja el tamaño
        de 0,5 en 0,5 hasta que cabe (mínimo 9). Devuelve el ancho dibujado."""
        t = tam
        while True:
            esp = espacio * t / tam
            w = medir(s, nombre, t, esp)
            if w <= ancho or t <= 9:
                c = capa(x - t, base - 2 * t, x + w + t, base + t, color)
                c.texto(s, nombre, t, x, base, esp)
                c.fundir()
                return w
            t -= 0.5

    # Contador: pastilla oscura con borde azul y texto blanco
    px, py, pw, ph = 48, 48, 132, 64
    c = capa(px, py, px + pw, py + ph, rgba(0x0B, 0x1A, 0x33, 0.92))
    c.rect_redondo(px, py, pw, ph, 32)
    c.fundir()
    c = capa(px - 3, py - 3, px + pw + 3, py + ph + 3, AZUL)
    c.rect_redondo(px, py, pw, ph, 32, borde=3)
    c.fundir()
    contador = f"{n}/{total}"
    ancho = medir(contador, "HelveticaNeue-Bold", 32)
    texto_izq(contador, "HelveticaNeue-Bold", 32, px + pw / 2 - ancho / 2, 92, BLANCO_PURO)

    # Barra de progreso: un segmento por slide; el actual en azul, los demás en gris
    n_act = entero(n, 1)
    n_tot = max(entero(total, 4), 1)
    seg_ancho, seg_alto, hueco = (30 if n_tot > 8 else 44), 8, 8
    gris = rgba(0x0B, 0x1A, 0x33, 0.25) if claro else rgba(255, 255, 255, 0.35)
    sx = px + pw + 18
    for i in range(1, n_tot + 1):
        y = py + ph / 2 - seg_alto / 2
        c = capa(sx, y, sx + seg_ancho, y + seg_alto, AZUL if i == n_act else gris)
        c.rect_redondo(sx, y, seg_ancho, seg_alto, 4)
        c.fundir()
        sx += seg_ancho + hueco

    # Pie, copiado del esquema de los carruseles virales:
    #   izquierda: el @ en negrita y debajo el lema (PIE_LEMA), pequeño y con letras espaciadas;
    #   derecha: botón azul "DESLIZA →", separador y el adelanto del siguiente slide (PIE_SIGUIENTE, dos líneas separadas por " / ").
    #   En el último slide el botón es "+ SEGUIR", y después el separador y el adelanto.
    lema = env.get("PIE_LEMA", "").upper()
    siguiente = [l.strip(" \t") for l in env.get("PIE_SIGUIENTE", "").split(" / ")]
    siguiente = [l for l in siguiente if l]
    tenue = rgba(0x0B, 0x1A, 0x33, 0.62) if claro else rgba(255, 255, 255, 0.7)
    linea = rgba(0x0B, 0x1A, 0x33, 0.28) if claro else rgba(255, 255, 255, 0.3)

    if env.get("PIE_VARIANTE") == "referencia":
        # Pie centrado como el de los carruseles virales claros:
        #   línea · foto de perfil redonda (PIE_AVATAR, opcional) · @ en negrita · línea (con flecha si hay más slides).
        yc, tam = 1285, 25
        w_h = medir(handle, "HelveticaNeue-Bold", tam)
        foto = None
        ruta = env.get("PIE_AVATAR")
        if ruta:
            try:
                foto = Image.open(ruta)
                foto.load()
            except Exception:
                foto = None  # como en la versión de Mac: si la foto no se puede leer, se dibuja sin ella
        d, hueco, tramo, sep = 46, 12, 84, 20
        x = (W - (tramo + sep + (d + hueco if foto else 0) + w_h + sep + tramo)) / 2
        c = capa(x, yc - 2, x + tramo, yc + 2, blanco)
        c.trazo([(x, yc), (x + tramo, yc)], 2.4, True)
        c.fundir()
        x += tramo + sep
        if foto:
            pegar_avatar(lienzo, foto, x, yc - d / 2, d)
            x += d + hueco
        texto_izq(handle, "HelveticaNeue-Bold", tam, x, yc + 9, blanco)
        x += w_h + sep
        c = capa(x, yc - 11, x + tramo, yc + 11, blanco)
        c.trazo([(x, yc), (x + tramo, yc)], 2.4, True)
        if n_act < n_tot:
            c.trazo([(x + tramo - 11, yc - 9), (x + tramo, yc), (x + tramo - 11, yc + 9)], 2.4, True)
        c.fundir()
    else:
        y_lineas = 1258
        c = capa(64, y_lineas - 1, 1016, y_lineas + 1, linea)
        c.trazo([(64, y_lineas), (500, y_lineas)], 1.5, False)
        c.trazo([(530, y_lineas), (1016, y_lineas)], 1.5, False)
        c.fundir()

        # PIE_HANDLE_AZUL=1: el @ en el azul de la marca
        color_handle = AZUL if env.get("PIE_HANDLE_AZUL") == "1" else blanco
        if handle:
            texto_izq(handle, "HelveticaNeue-Bold", 25, 64, 1295, color_handle, ancho=440)
        if lema:
            texto_izq(lema, "HelveticaNeue", 14, 64, 1322, tenue, espacio=2.2, ancho=440)

        x_sep = 716
        bx, by, bw, bh = 530, 1274, 160, 50
        if n_act <= n_tot:
            c = capa(bx, by, bx + bw, by + bh, AZUL)
            c.rect_redondo(bx, by, bw, bh, 25)
            c.fundir()
        if n_act < n_tot:
            # botón DESLIZA: pastilla azul con el texto y la flecha en blanco
            w_txt = texto_izq("DESLIZA", "HelveticaNeue-Bold", 19, bx + 22, 1306, BLANCO_PURO, espacio=0.5)
            ax, ay = bx + 22 + w_txt + 12, by + bh / 2
            c = capa(ax, ay - 10, ax + 26, ay + 10, BLANCO_PURO)
            c.trazo([(ax, ay), (ax + 24, ay)], 2.6, True)
            c.trazo([(ax + 15, ay - 8), (ax + 24, ay), (ax + 15, ay + 8)], 2.6, True)
            c.fundir()
        elif n_act == n_tot:
            # último slide: botón "+ SEGUIR" en el sitio del DESLIZA
            mx, my = bx + 30, by + bh / 2
            c = capa(mx - 10, my - 10, mx + 10, my + 10, BLANCO_PURO)
            c.trazo([(mx - 8, my), (mx + 8, my)], 3, True)
            c.trazo([(mx, my - 8), (mx, my + 8)], 3, True)
            c.fundir()
            texto_izq("SEGUIR", "HelveticaNeue-Bold", 19, mx + 20, 1306, BLANCO_PURO, espacio=0.5)
        if siguiente:
            # separador con extremos redondeados (en la versión de Mac hereda el remate redondo del botón)
            c = capa(x_sep - 1, 1273, x_sep + 1, 1325, linea)
            c.trazo([(x_sep, 1274), (x_sep, 1324)], 1.5, n_act <= n_tot)
            c.fundir()
            for i, l in enumerate(siguiente[:2]):
                texto_izq(l.upper(), "HelveticaNeue", 13.5, x_sep + 18, 1295 + i * 23, tenue, espacio=1.4,
                          ancho=1016 - (x_sep + 18))

    # Solo hay dibujo en la franja de arriba y en la de abajo: se reducen esas dos (reducir el lienzo entero es lo lento)
    final = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y0, y1 in ((0, 160), (1180, H)):
        franja = lienzo.crop((0, y0 * ESCALA, W * ESCALA, y1 * ESCALA))
        final.paste(franja.resize((W, y1 - y0), Image.LANCZOS), (0, y0))

    # Fondo: azul marino muy oscuro con un brillo suave en el centro (o crema en el estilo claro)
    if con_fondo:
        fondo = Image.new("RGBA", (W, H), (0xF4, 0xEF, 0xE6, 255))
        if not claro:
            fondo_radial(fondo)
        final = Image.alpha_composite(fondo, final)
    return final


def pegar_avatar(lienzo, foto, x, y, d):
    """Recorte cuadrado centrado en horizontal y desde el 15 % de arriba, dentro de un círculo de `d` px."""
    lado = min(foto.width, foto.height)
    x0, y0 = (foto.width - lado) // 2, int((foto.height - lado) * 0.15)
    recorte = foto.convert("RGBA").crop((x0, y0, x0 + lado, y0 + lado))
    # se coloca en píxeles enteros del lienzo grande: el círculo y la foto comparten la misma rejilla
    X, Y, D = round(x * ESCALA), round(y * ESCALA), round(d * ESCALA)
    recorte = recorte.resize((D, D), Image.LANCZOS)
    mascara = Image.new("L", (D, D), 0)
    ImageDraw.Draw(mascara).ellipse((0, 0, D - 1, D - 1), fill=255)
    alfa = Image.composite(recorte.getchannel("A"), mascara, mascara)  # respeta también la transparencia de la foto
    recorte.putalpha(alfa)
    lienzo.alpha_composite(recorte, dest=(X, Y))


def entero(s, defecto):
    try:
        return int(s)
    except ValueError:
        return defecto


def main():
    args = sys.argv
    n = args[1] if len(args) > 1 else "1"
    total = args[2] if len(args) > 2 else "4"
    salida = args[3] if len(args) > 3 else "plantilla.png"
    con_fondo = len(args) > 4 and args[4] == "fondo"
    try:
        img = dibujar(n, total, con_fondo, os.environ)
        img.save(salida, "PNG")
    except Exception as e:
        print(f"No se pudo dibujar la plantilla: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"ok {salida}")


if __name__ == "__main__":
    main()
