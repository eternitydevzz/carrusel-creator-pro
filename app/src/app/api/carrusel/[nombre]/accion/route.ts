import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cliente, motor, motorFondo, nombreSeguro, ordenEnCurso } from "@/lib/motor";

export const dynamic = "force-dynamic";

type Accion = { accion: "generar" | "corregir" | "cerrar" | "ficha_ia" | "revisar" | "descripcion" | "guardar_descripcion" | "variaciones" | "guardar_variaciones"; n?: number; cambio?: string; texto?: string; textos?: string[] };

/** Las órdenes largas (generar, corregir, ficha_ia) se lanzan en segundo plano; la pantalla pregunta el estado cada pocos segundos. */
export async function POST(req: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  if (!nombreSeguro(nombre)) return NextResponse.json({ error: "Nombre no válido" }, { status: 400 });
  const a = (await req.json()) as Accion;
  const D = cliente();
  const estadoSalida = path.join(D, "salida", nombre, "_estado.json");

  if (a.accion === "ficha_ia") {
    await motorFondo(["ficha_ia", nombre], path.join(D, "virales", nombre, "_estado_ficha.json"));
    return NextResponse.json({ ok: true, lanzado: "ficha_ia" });
  }
  // La descripción la escribe Claude, no Codex: no bloquea ni gasta imágenes, así que no pasa por ordenEnCurso
  if (a.accion === "descripcion") {
    await motorFondo(["descripcion", nombre], path.join(D, "salida", nombre, "_estado_descripcion.json"));
    return NextResponse.json({ ok: true, lanzado: "descripcion" });
  }
  if (a.accion === "guardar_descripcion") {
    if (typeof a.texto !== "string" || !a.texto.trim()) return NextResponse.json({ error: "La descripción está vacía" }, { status: 400 });
    await fs.writeFile(path.join(D, "salida", nombre, "descripcion.txt"), a.texto.trim() + "\n");
    return NextResponse.json({ ok: true });
  }
  if (a.accion === "variaciones") {
    await motorFondo(["variaciones", nombre], path.join(D, "salida", nombre, "_estado_variaciones.json"));
    return NextResponse.json({ ok: true, lanzado: "variaciones" });
  }
  if (a.accion === "guardar_variaciones") {
    const t = a.textos;
    if (!Array.isArray(t) || t.length !== 5 || t.some((x) => typeof x !== "string" || !x.trim())) return NextResponse.json({ error: "Tienen que ser 5 variaciones y ninguna vacía" }, { status: 400 });
    await fs.writeFile(path.join(D, "salida", nombre, "variaciones.txt"), t.map((x, i) => `=== VARIACIÓN ${i + 1} ===\n${x.trim()}\n`).join("\n"));
    return NextResponse.json({ ok: true });
  }
  if (a.accion === "generar" || a.accion === "corregir") {
    // Codex comparte el cupo entre carruseles: una sola generación a la vez en todo el sistema
    const ocupado = await ordenEnCurso();
    if (ocupado) return NextResponse.json({ error: ocupado === nombre ? "Ya hay una orden en curso para este carrusel" : `Ya hay una generación en curso en "${ocupado}". Espera a que termine: Codex solo hace una a la vez.` }, { status: 409 });
  }
  if (a.accion === "generar") {
    await motorFondo(["generar", nombre], estadoSalida);
    return NextResponse.json({ ok: true, lanzado: "generar" });
  }
  if (a.accion === "corregir") {
    if (!a.n || !a.cambio?.trim()) return NextResponse.json({ error: "Falta el slide o el cambio" }, { status: 400 });
    await motorFondo(["corregir", nombre, String(a.n), a.cambio.trim()], estadoSalida);
    return NextResponse.json({ ok: true, lanzado: "corregir" });
  }
  if (a.accion === "cerrar") {
    const r = await motor(["cerrar", nombre], { timeoutMs: 300_000 });
    return NextResponse.json({ ok: r.codigo === 0, texto: r.salida });
  }
  if (a.accion === "revisar") {
    const r = await motor(["revisar", nombre], { timeoutMs: 60_000 });
    return NextResponse.json({ ok: r.codigo === 0, texto: r.salida });
  }
  return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
}
