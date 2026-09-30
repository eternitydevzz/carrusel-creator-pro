import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { datos, leerEstado, leerTexto, motor, nombreSeguro, parsearFicha } from "@/lib/motor";

export const dynamic = "force-dynamic";

/** Mientras Codex genera, las imágenes van cayendo en su carpeta de sesión: eso es el progreso real. */
async function progresoCodex(salida: string): Promise<number> {
  try {
    const logs = (await fs.readdir(path.join(salida, "_logs"))).filter((l) => /^carrusel_\d+\.log$/.test(l)).sort((a, b) => parseInt(a.slice(9)) - parseInt(b.slice(9)));
    if (!logs.length) return 0;
    const log = await fs.readFile(path.join(salida, "_logs", logs[logs.length - 1]), "utf8");
    const sid = /session id:\s*(\S+)/.exec(log)?.[1];
    if (!sid) return 0;
    return (await fs.readdir(path.join(os.homedir(), ".codex", "generated_images", sid))).filter((f) => f.endsWith(".png")).length;
  } catch { return 0; }
}

/** Todo lo que la pantalla de un carrusel necesita, en una llamada. Se consulta cada pocos segundos mientras genera. */
export async function GET(_req: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  if (!nombreSeguro(nombre)) return NextResponse.json({ error: "Nombre no válido" }, { status: 400 });
  const D = datos();
  const salida = path.join(D, "salida", nombre);
  const fichaTxt = await leerTexto(path.join(D, "fichas", `${nombre}.md`));
  const estado = await leerEstado(path.join(salida, "_estado.json"));
  const estadoFicha = await leerEstado(path.join(D, "virales", nombre, "_estado_ficha.json"));

  let slides: { n: number; png: boolean; jpg: boolean; version: number }[] = [];
  let cerrado = false;
  try {
    const archivos = await fs.readdir(salida);
    const nums = new Set<number>();
    for (const a of archivos) { const m = /^(\d+)\.(png|jpg)$/.exec(a); if (m) nums.add(Number(m[1])); }
    const versiones = await fs.readdir(path.join(salida, "_versiones")).catch(() => [] as string[]);
    slides = [...nums].sort((a, b) => a - b).map((n) => ({ n, png: archivos.includes(`${n}.png`), jpg: archivos.includes(`${n}.jpg`), version: versiones.filter((v) => v.startsWith(`${n}_v`)).length }));
    cerrado = slides.length > 0 && slides.every((s) => s.jpg && !s.png);
  } catch { /* sin salida todavía */ }

  const enCurso = estado?.estado === "en_curso";
  const progreso = enCurso && estado?.orden?.[0] === "generar" ? await progresoCodex(salida) : 0;

  let original: string[] = [];
  try { original = (await fs.readdir(path.join(D, "virales", nombre))).filter((a) => /^slide_\d+\.jpg$/.test(a)).sort(); } catch { /* sin original */ }

  let comprobacion: { ok: boolean; texto: string } | null = null;
  if (fichaTxt && !cerrado && !enCurso) { const r = await motor(["comprobar", nombre], { timeoutMs: 30_000 }); comprobacion = { ok: r.codigo === 0, texto: r.salida }; }

  const cupo = (await motor(["cupo"], { timeoutMs: 15_000 })).salida;

  return NextResponse.json({ nombre, fichaTexto: fichaTxt, ficha: fichaTxt ? parsearFicha(fichaTxt) : null, comprobacion, estado, estadoFicha, slides, progreso, cerrado, original, cupo });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  if (!nombreSeguro(nombre)) return NextResponse.json({ error: "Nombre no válido" }, { status: 400 });
  const D = datos();
  if ((await leerEstado(path.join(D, "salida", nombre, "_estado.json")))?.estado === "en_curso") return NextResponse.json({ error: "Espera a que termine la generación" }, { status: 409 });
  for (const ruta of [path.join(D, "fichas", `${nombre}.md`), path.join(D, "salida", nombre), path.join(D, "virales", nombre)]) await fs.rm(ruta, { recursive: true, force: true });
  return NextResponse.json({ ok: true });
}
