// Dibuja la plantilla del slide: fondo oscuro, contador arriba a la izquierda y pie abajo.
// Uso: swift plantilla.swift <n> <N> <salida.png> [fondo]
//   Sin "fondo": capa transparente para estampar encima de un slide. Con "fondo": fondo azul oscuro, para verla.
import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let n = args.count > 1 ? args[1] : "1"
let total = args.count > 2 ? args[2] : "4"
let out = args.count > 3 ? args[3] : "plantilla.png"
let conFondo = args.count > 4 && args[4] == "fondo"
let handle = ProcessInfo.processInfo.environment["PIE_HANDLE"] ?? "@tucuenta"
let W = 1080, H = 1350
let azul = CGColor(red: 0x1A/255.0, green: 0x79/255.0, blue: 0xFB/255.0, alpha: 1)
// PIE_ESTILO=claro: para carruseles de fondo claro. El pie y los segmentos pasan a azul marino; la guía se dibuja sobre crema.
let claro = ProcessInfo.processInfo.environment["PIE_ESTILO"] == "claro"
let marino = CGColor(red: 0x0b/255.0, green: 0x1a/255.0, blue: 0x33/255.0, alpha: 1)
let blanco = claro ? marino : CGColor(red: 1, green: 1, blue: 1, alpha: 1)
let textoPastilla = CGColor(red: 1, green: 1, blue: 1, alpha: 1)

let cs = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
// Coordenadas como en una imagen: origen arriba a la izquierda
ctx.translateBy(x: 0, y: CGFloat(H)); ctx.scaleBy(x: 1, y: -1)

// Fondo: azul marino muy oscuro con un brillo suave en el centro
let colores = [CGColor(red: 0x0d/255.0, green: 0x20/255.0, blue: 0x50/255.0, alpha: 1),
               CGColor(red: 0x04/255.0, green: 0x09/255.0, blue: 0x15/255.0, alpha: 1)] as CFArray
let grad = CGGradient(colorsSpace: cs, colors: colores, locations: [0, 1])!
if conFondo && claro { ctx.setFillColor(CGColor(red: 0xF4/255.0, green: 0xEF/255.0, blue: 0xE6/255.0, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H)) }
else if conFondo { ctx.drawRadialGradient(grad, startCenter: CGPoint(x: 540, y: 600), startRadius: 0, endCenter: CGPoint(x: 540, y: 600), endRadius: 900, options: [.drawsAfterEndLocation]) }

func texto(_ s: String, _ fuente: String, _ tam: CGFloat, centroX: CGFloat, baseY: CGFloat, color: CGColor) {
    let f = CTFontCreateWithName(fuente as CFString, tam, nil)
    let attr: [NSAttributedString.Key: Any] = [NSAttributedString.Key(kCTFontAttributeName as String): f,
                                               NSAttributedString.Key(kCTForegroundColorAttributeName as String): color]
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: s, attributes: attr))
    let ancho = CTLineGetTypographicBounds(line, nil, nil, nil)
    ctx.saveGState()
    ctx.textMatrix = CGAffineTransform(scaleX: 1, y: -1)
    ctx.textPosition = CGPoint(x: centroX - CGFloat(ancho)/2, y: baseY)
    CTLineDraw(line, ctx)
    ctx.restoreGState()
}

// Contador: pastilla oscura con borde azul y texto blanco
let pill = CGRect(x: 48, y: 48, width: 132, height: 64)
let pillPath = CGPath(roundedRect: pill, cornerWidth: 32, cornerHeight: 32, transform: nil)
ctx.setFillColor(CGColor(red: 0x0b/255.0, green: 0x1a/255.0, blue: 0x33/255.0, alpha: 0.92))
ctx.addPath(pillPath); ctx.fillPath()
ctx.setStrokeColor(azul); ctx.setLineWidth(3)
ctx.addPath(pillPath); ctx.strokePath()
texto("\(n)/\(total)", "HelveticaNeue-Bold", 32, centroX: pill.midX, baseY: 92, color: textoPastilla)
// Barra de progreso: un segmento por slide; el actual en azul, los demás en gris
let nAct = Int(n) ?? 1, nTot = max(Int(total) ?? 4, 1)
let segAncho: CGFloat = nTot > 8 ? 30 : 44, segAlto: CGFloat = 8, hueco: CGFloat = 8
var sx: CGFloat = pill.maxX + 18
for i in 1...nTot {
    let r = CGRect(x: sx, y: pill.midY - segAlto/2, width: segAncho, height: segAlto)
    ctx.setFillColor(i == nAct ? azul : claro ? CGColor(red: 0x0b/255.0, green: 0x1a/255.0, blue: 0x33/255.0, alpha: 0.25) : CGColor(red: 1, green: 1, blue: 1, alpha: 0.35))
    ctx.addPath(CGPath(roundedRect: r, cornerWidth: 4, cornerHeight: 4, transform: nil)); ctx.fillPath()
    sx += segAncho + hueco
}

// Pie, copiado del esquema de los carruseles virales :
//   izquierda: el @ en negrita y debajo el lema (PIE_LEMA), pequeño y con letras espaciadas;
//   derecha: botón azul "DESLIZA →", separador y el adelanto del siguiente slide (PIE_SIGUIENTE, dos líneas separadas por " / ").
//   En el último slide no hay botón: solo el separador y el adelanto (por ejemplo "SÍGUEME PARA MÁS / ...").
let env = ProcessInfo.processInfo.environment
let lema = (env["PIE_LEMA"] ?? "").uppercased()
let siguiente = (env["PIE_SIGUIENTE"] ?? "").components(separatedBy: " / ").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
let tenue = claro ? CGColor(red: 0x0b/255.0, green: 0x1a/255.0, blue: 0x33/255.0, alpha: 0.62) : CGColor(red: 1, green: 1, blue: 1, alpha: 0.7)
let linea = claro ? CGColor(red: 0x0b/255.0, green: 0x1a/255.0, blue: 0x33/255.0, alpha: 0.28) : CGColor(red: 1, green: 1, blue: 1, alpha: 0.3)

/// Texto alineado a la izquierda, con espaciado entre letras; si no cabe en `ancho`, baja el tamaño hasta que cabe.
@discardableResult
func textoIzq(_ s: String, _ fuente: String, _ tam: CGFloat, x: CGFloat, baseY: CGFloat, color: CGColor, espacio: CGFloat = 0, ancho: CGFloat = 10_000) -> CGFloat {
    var t = tam
    while true {
        let f = CTFontCreateWithName(fuente as CFString, t, nil)
        let attr: [NSAttributedString.Key: Any] = [NSAttributedString.Key(kCTFontAttributeName as String): f,
                                                   NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
                                                   NSAttributedString.Key(kCTKernAttributeName as String): espacio * t / tam]
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: s, attributes: attr))
        let w = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        if w <= ancho || t <= 9 {
            ctx.saveGState(); ctx.textMatrix = CGAffineTransform(scaleX: 1, y: -1); ctx.textPosition = CGPoint(x: x, y: baseY); CTLineDraw(line, ctx); ctx.restoreGState()
            return w
        }
        t -= 0.5
    }
}

// PIE_VARIANTE=referencia: pie centrado como el de los carruseles virales claros:
//   línea · foto de perfil redonda (PIE_AVATAR, opcional) · @ en negrita · línea (con flecha si hay más slides). Sin lema ni botón.
if env["PIE_VARIANTE"] == "referencia" {
    let yc: CGFloat = 1285, tam: CGFloat = 25
    let fHandle = CTFontCreateWithName("HelveticaNeue-Bold" as CFString, tam, nil)
    let lHandle = CTLineCreateWithAttributedString(NSAttributedString(string: handle, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): fHandle]))
    let wH = CGFloat(CTLineGetTypographicBounds(lHandle, nil, nil, nil))
    var foto: CGImage? = nil
    if let ruta = env["PIE_AVATAR"], let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: ruta) as CFURL, nil) { foto = CGImageSourceCreateImageAtIndex(src, 0, nil) }
    let d: CGFloat = 46, hueco: CGFloat = 12, tramo: CGFloat = 84, sep: CGFloat = 20
    var x = (CGFloat(W) - (tramo + sep + (foto != nil ? d + hueco : 0) + wH + sep + tramo)) / 2
    ctx.setStrokeColor(blanco); ctx.setLineWidth(2.4); ctx.setLineCap(.round); ctx.setLineJoin(.round)
    ctx.move(to: CGPoint(x: x, y: yc)); ctx.addLine(to: CGPoint(x: x + tramo, y: yc)); ctx.strokePath()
    x += tramo + sep
    if let foto = foto {
        let lado = min(foto.width, foto.height)
        let recorte = foto.cropping(to: CGRect(x: (foto.width - lado) / 2, y: Int(Double(foto.height - lado) * 0.15), width: lado, height: lado))
        if let recorte = recorte {
            ctx.saveGState()
            ctx.addEllipse(in: CGRect(x: x, y: yc - d / 2, width: d, height: d)); ctx.clip()
            ctx.translateBy(x: x, y: yc + d / 2); ctx.scaleBy(x: 1, y: -1)  // el lienzo está invertido: la foto se dibuja al revés si no
            ctx.draw(recorte, in: CGRect(x: 0, y: 0, width: d, height: d))
            ctx.restoreGState()
        }
        x += d + hueco
    }
    textoIzq(handle, "HelveticaNeue-Bold", tam, x: x, baseY: yc + 9, color: blanco)
    x += wH + sep
    ctx.setStrokeColor(blanco); ctx.setLineWidth(2.4)
    ctx.move(to: CGPoint(x: x, y: yc)); ctx.addLine(to: CGPoint(x: x + tramo, y: yc))
    if nAct < nTot {
        ctx.move(to: CGPoint(x: x + tramo - 11, y: yc - 9)); ctx.addLine(to: CGPoint(x: x + tramo, y: yc)); ctx.addLine(to: CGPoint(x: x + tramo - 11, y: yc + 9))
    }
    ctx.strokePath()
} else {
let yLineas: CGFloat = 1258
ctx.setStrokeColor(linea); ctx.setLineWidth(1.5)
ctx.move(to: CGPoint(x: 64, y: yLineas)); ctx.addLine(to: CGPoint(x: 500, y: yLineas))
ctx.move(to: CGPoint(x: 530, y: yLineas)); ctx.addLine(to: CGPoint(x: 1016, y: yLineas))
ctx.strokePath()

// PIE_HANDLE_AZUL=1: el @ en el azul de la marca
let colorHandle = env["PIE_HANDLE_AZUL"] == "1" ? azul : blanco
if !handle.isEmpty { textoIzq(handle, "HelveticaNeue-Bold", 25, x: 64, baseY: 1295, color: colorHandle, ancho: 440) }
if !lema.isEmpty { textoIzq(lema, "HelveticaNeue", 14, x: 64, baseY: 1322, color: tenue, espacio: 2.2, ancho: 440) }

let xSep: CGFloat = 716
if nAct < nTot {
    // botón DESLIZA: pastilla azul con el texto y la flecha en blanco
    let boton = CGRect(x: 530, y: 1274, width: 160, height: 50)
    ctx.setFillColor(azul); ctx.addPath(CGPath(roundedRect: boton, cornerWidth: 25, cornerHeight: 25, transform: nil)); ctx.fillPath()
    let blancoPuro = CGColor(red: 1, green: 1, blue: 1, alpha: 1)
    let wTxt = textoIzq("DESLIZA", "HelveticaNeue-Bold", 19, x: boton.minX + 22, baseY: 1306, color: blancoPuro, espacio: 0.5)
    let ax = boton.minX + 22 + wTxt + 12, ay = boton.midY
    ctx.setStrokeColor(blancoPuro); ctx.setLineWidth(2.6); ctx.setLineCap(.round); ctx.setLineJoin(.round)
    ctx.move(to: CGPoint(x: ax, y: ay)); ctx.addLine(to: CGPoint(x: ax + 24, y: ay))
    ctx.move(to: CGPoint(x: ax + 15, y: ay - 8)); ctx.addLine(to: CGPoint(x: ax + 24, y: ay)); ctx.addLine(to: CGPoint(x: ax + 15, y: ay + 8))
    ctx.strokePath()
}
if nAct == nTot {
    // último slide: botón "+ SEGUIR" en el sitio del DESLIZA
    let boton = CGRect(x: 530, y: 1274, width: 160, height: 50)
    ctx.setFillColor(azul); ctx.addPath(CGPath(roundedRect: boton, cornerWidth: 25, cornerHeight: 25, transform: nil)); ctx.fillPath()
    let blancoPuro = CGColor(red: 1, green: 1, blue: 1, alpha: 1)
    let px = boton.minX + 30, py = boton.midY
    ctx.setStrokeColor(blancoPuro); ctx.setLineWidth(3); ctx.setLineCap(.round)
    ctx.move(to: CGPoint(x: px - 8, y: py)); ctx.addLine(to: CGPoint(x: px + 8, y: py))
    ctx.move(to: CGPoint(x: px, y: py - 8)); ctx.addLine(to: CGPoint(x: px, y: py + 8))
    ctx.strokePath()
    textoIzq("SEGUIR", "HelveticaNeue-Bold", 19, x: px + 20, baseY: 1306, color: blancoPuro, espacio: 0.5)
}
if !siguiente.isEmpty {
    ctx.setStrokeColor(linea); ctx.setLineWidth(1.5)
    ctx.move(to: CGPoint(x: xSep, y: 1274)); ctx.addLine(to: CGPoint(x: xSep, y: 1324)); ctx.strokePath()
    for (i, l) in siguiente.prefix(2).enumerated() {
        textoIzq(l.uppercased(), "HelveticaNeue", 13.5, x: xSep + 18, baseY: 1295 + CGFloat(i) * 23, color: tenue, espacio: 1.4, ancho: 1016 - (xSep + 18))
    }
}

}

let img = ctx.makeImage()!
let url = URL(fileURLWithPath: out) as CFURL
let dest = CGImageDestinationCreateWithURL(url, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, img, nil)
CGImageDestinationFinalize(dest)
print("ok \(out)")
