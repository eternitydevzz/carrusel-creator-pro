import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATOS, leerEstado, leerTexto, motor, nombreSeguro, parsearFicha } from "@/lib/motor";

export const dynamic = "force-dynamic";

/** Todo lo que la pantalla de un carrusel necesita, en una llamada. Se consulta cada pocos segundos mientras genera. */
export async function GET(_req: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  if (!nombreSeguro(nombre)) return NextResponse.json({ error: "Nombre no válido" }, { status: 400 });
  const salida = path.join(DATOS, "salida", nombre);
  const fichaTxt = await leerTexto(path.join(DATOS, "fichas", `${nombre}.md`));
  const estado = await leerEstado(path.join(salida, "_estado.json"));
  const estadoFicha = await leerEstado(path.join(DATOS, "virales", nombre, "_estado_ficha.json"));

  let slides: { n: number; png: boolean; jpg: boolean; version: number }[] = [];
  let sinPie = 0; let cerrado = false;
  try {
    const archivos = await fs.readdir(salida);
    const nums = new Set<number>();
    for (const a of archivos) { const m = /^(\d+)\.(png|jpg)$/.exec(a); if (m) nums.add(Number(m[1])); }
    const versiones = await fs.readdir(path.join(salida, "_versiones")).catch(() => [] as string[]);
    slides = [...nums].sort((a, b) => a - b).map((n) => ({
      n,
      png: archivos.includes(`${n}.png`),
      jpg: archivos.includes(`${n}.jpg`),
      version: versiones.filter((v) => v.startsWith(`${n}_v`)).length,
    }));
    try { sinPie = (await fs.readdir(path.join(salida, "_sin_pie"))).filter((a) => a.endsWith(".png")).length; } catch { /* aún no */ }
    cerrado = slides.length > 0 && slides.every((s) => s.jpg && !s.png);
  } catch { /* sin salida todavía */ }

  let original: string[] = [];
  try { original = (await fs.readdir(path.join(DATOS, "virales", nombre))).filter((a) => /^slide_\d+\.jpg$/.test(a)).sort(); } catch { /* sin original */ }

  let comprobacion: { ok: boolean; texto: string } | null = null;
  if (fichaTxt && !cerrado) { const r = await motor(["comprobar", nombre], { timeoutMs: 30_000 }); comprobacion = { ok: r.codigo === 0, texto: r.salida }; }

  const cupo = (await motor(["cupo"], { timeoutMs: 15_000 })).salida;

  return NextResponse.json({
    nombre, fichaTexto: fichaTxt, ficha: fichaTxt ? parsearFicha(fichaTxt) : null, comprobacion,
    estado, estadoFicha, slides, sinPie, cerrado, original, cupo,
    hoja: slides.length ? `_hoja.jpg` : null,
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  if (!nombreSeguro(nombre)) return NextResponse.json({ error: "Nombre no válido" }, { status: 400 });
  for (const ruta of [path.join(DATOS, "fichas", `${nombre}.md`), path.join(DATOS, "salida", nombre), path.join(DATOS, "virales", nombre)]) {
    await fs.rm(ruta, { recursive: true, force: true });
  }
  return NextResponse.json({ ok: true });
}
