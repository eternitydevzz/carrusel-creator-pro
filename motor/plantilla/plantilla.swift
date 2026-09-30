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
let handle = ProcessInfo.processInfo.environment["PIE_HANDLE"] ?? "@cristianews.ai"
let W = 1080, H = 1350
let azul = CGColor(red: 0x1A/255.0, green: 0x79/255.0, blue: 0xFB/255.0, alpha: 1)
let blanco = CGColor(red: 1, green: 1, blue: 1, alpha: 1)

let cs = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
// Coordenadas como en una imagen: origen arriba a la izquierda
ctx.translateBy(x: 0, y: CGFloat(H)); ctx.scaleBy(x: 1, y: -1)

// Fondo: azul marino muy oscuro con un brillo suave en el centro
let colores = [CGColor(red: 0x0d/255.0, green: 0x20/255.0, blue: 0x50/255.0, alpha: 1),
               CGColor(red: 0x04/255.0, green: 0x09/255.0, blue: 0x15/255.0, alpha: 1)] as CFArray
let grad = CGGradient(colorsSpace: cs, colors: colores, locations: [0, 1])!
if conFondo { ctx.drawRadialGradient(grad, startCenter: CGPoint(x: 540, y: 600), startRadius: 0, endCenter: CGPoint(x: 540, y: 600), endRadius: 900, options: [.drawsAfterEndLocation]) }

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
texto("\(n)/\(total)", "HelveticaNeue-Bold", 32, centroX: pill.midX, baseY: 92, color: blanco)
// Barra de progreso: un segmento por slide; el actual en azul, los demás en gris
let nAct = Int(n) ?? 1, nTot = max(Int(total) ?? 4, 1)
let segAncho: CGFloat = nTot > 8 ? 30 : 44, segAlto: CGFloat = 8, hueco: CGFloat = 8
var sx: CGFloat = pill.maxX + 18
for i in 1...nTot {
    let r = CGRect(x: sx, y: pill.midY - segAlto/2, width: segAncho, height: segAlto)
    ctx.setFillColor(i == nAct ? azul : CGColor(red: 1, green: 1, blue: 1, alpha: 0.35))
    ctx.addPath(CGPath(roundedRect: r, cornerWidth: 4, cornerHeight: 4, transform: nil)); ctx.fillPath()
    sx += segAncho + hueco
}

// Pie: el @ centrado. La línea-estrella de encima es opcional (PIE_LINEA=1): a 1232 px chocaba
// con el texto secundario cuando Codex lo colocaba pegado al borde, y sin ella el pie sigue leyéndose igual.
if ProcessInfo.processInfo.environment["PIE_LINEA"] == "1" {
    let yLinea: CGFloat = 1232
    ctx.setStrokeColor(blanco); ctx.setLineWidth(2); ctx.setLineCap(.round)
    ctx.move(to: CGPoint(x: 400, y: yLinea)); ctx.addLine(to: CGPoint(x: 508, y: yLinea))
    ctx.move(to: CGPoint(x: 572, y: yLinea)); ctx.addLine(to: CGPoint(x: 680, y: yLinea))
    ctx.strokePath()
    let cx: CGFloat = 540, cy = yLinea, rE: CGFloat = 13, rI: CGFloat = 5.5
    let star = CGMutablePath()
    for i in 0..<10 {
        let r = i % 2 == 0 ? rE : rI
        let a = -CGFloat.pi/2 + CGFloat(i) * CGFloat.pi/5
        let p = CGPoint(x: cx + r * cos(a), y: cy + r * sin(a))
        if i == 0 { star.move(to: p) } else { star.addLine(to: p) }
    }
    star.closeSubpath()
    ctx.setFillColor(blanco); ctx.addPath(star); ctx.fillPath()
}
texto(handle, "HelveticaNeue-Medium", 30, centroX: 540, baseY: 1284, color: blanco)

// A la derecha, a la altura del @: "desliza →" en todos menos el último; en el último, el icono de guardar
ctx.setStrokeColor(blanco); ctx.setLineWidth(3.2); ctx.setLineJoin(.round); ctx.setLineCap(.round)
if nAct < nTot {
    texto("desliza", "HelveticaNeue-Medium", 24, centroX: 940, baseY: 1282, color: blanco)
    let ax: CGFloat = 990, ay: CGFloat = 1273
    ctx.move(to: CGPoint(x: ax, y: ay)); ctx.addLine(to: CGPoint(x: ax + 34, y: ay))
    ctx.move(to: CGPoint(x: ax + 21, y: ay - 12)); ctx.addLine(to: CGPoint(x: ax + 34, y: ay)); ctx.addLine(to: CGPoint(x: ax + 21, y: ay + 12))
    ctx.strokePath()
} else {
    let bx: CGFloat = 996, by: CGFloat = 1254
    ctx.move(to: CGPoint(x: bx, y: by)); ctx.addLine(to: CGPoint(x: bx + 28, y: by)); ctx.addLine(to: CGPoint(x: bx + 28, y: by + 38))
    ctx.addLine(to: CGPoint(x: bx + 14, y: by + 27)); ctx.addLine(to: CGPoint(x: bx, y: by + 38)); ctx.closePath(); ctx.strokePath()
}

let img = ctx.makeImage()!
let url = URL(fileURLWithPath: out) as CFURL
let dest = CGImageDestinationCreateWithURL(url, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, img, nil)
CGImageDestinationFinalize(dest)
print("ok \(out)")
