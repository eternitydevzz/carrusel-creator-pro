import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATOS, existe, motor, motorFondo, nombreSeguro, serializarFicha, type Slide } from "@/lib/motor";

export const dynamic = "force-dynamic";

type Peticion = { modo: "link" | "guion"; url?: string; nombre?: string; guion?: string; redactar?: boolean };

function nombreDesdeUrl(url: string) {
  const m = /instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/.exec(url);
  return m ? `ig_${m[1]}` : null;
}

/** El guion propio va como el de Cristian: bloques "SLIDE 1", "SLIDE 2"… con el texto debajo. */
function guionAFicha(nombre: string, guion: string): { texto: string; n: number } {
  const bloques = guion.split(/^\s*SLIDE\s+\d+\s*:?\s*$/im).map((b) => b.trim()).filter(Boolean);
  const slides: Slide[] = bloques.map((b) => ({ texto: b.replace(/\s*\n\s*/g, " ").trim() }));
  const cta = /COMENTA\s+"?([A-ZÁÉÍÓÚÑ]+)"?/i.exec(guion)?.[1]?.toUpperCase() ?? "";
  return { texto: serializarFicha({ cabecera: { carrusel: nombre, slides: String(slides.length), cta, viral: "ninguno", bandera: "no", cifras_confirmadas: "todas (guion propio)" }, slides }), n: slides.length };
}

export async function POST(req: Request) {
  const p = (await req.json()) as Peticion;
  let nombre = (p.nombre ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-]/g, "");
  if (p.modo === "link") {
    const url = (p.url ?? "").trim();
    if (!/instagram\.com\/(p|reel)\//.test(url)) return NextResponse.json({ error: "Pega un link de un post o reel de Instagram" }, { status: 400 });
    nombre = nombre || nombreDesdeUrl(url) || "";
    if (!nombreSeguro(nombre)) return NextResponse.json({ error: "Nombre no válido" }, { status: 400 });
    if (await existe(path.join(DATOS, "virales", nombre))) return NextResponse.json({ error: `Ya existe un carrusel llamado ${nombre}` }, { status: 409 });
    const r = await motor(["bajar", url, nombre], { timeoutMs: 180_000 });
    if (r.codigo !== 0) return NextResponse.json({ error: r.salida || "No se pudo descargar el carrusel" }, { status: 500 });
    if (p.redactar !== false) await motorFondo(["ficha_ia", nombre], path.join(DATOS, "virales", nombre, "_estado_ficha.json"));
    return NextResponse.json({ ok: true, nombre, salida: r.salida });
  }
  if (p.modo === "guion") {
    if (!nombreSeguro(nombre)) return NextResponse.json({ error: "Ponle un nombre al carrusel (letras, números y guiones)" }, { status: 400 });
    if (!p.guion?.trim()) return NextResponse.json({ error: "Pega el guion" }, { status: 400 });
    if (await existe(path.join(DATOS, "fichas", `${nombre}.md`))) return NextResponse.json({ error: `Ya existe un carrusel llamado ${nombre}` }, { status: 409 });
    const { texto, n } = guionAFicha(nombre, p.guion);
    if (n === 0) return NextResponse.json({ error: 'No encontré ningún "SLIDE 1", "SLIDE 2"… en el guion' }, { status: 400 });
    await fs.mkdir(path.join(DATOS, "fichas"), { recursive: true });
    await fs.writeFile(path.join(DATOS, "fichas", `${nombre}.md`), texto);
    return NextResponse.json({ ok: true, nombre, slides: n });
  }
  return NextResponse.json({ error: "Modo desconocido" }, { status: 400 });
}
