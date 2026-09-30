import { NextResponse } from "next/server";
import path from "node:path";
import { datos, motor, motorFondo, nombreSeguro, ordenEnCurso } from "@/lib/motor";

export const dynamic = "force-dynamic";

type Accion = { accion: "generar" | "corregir" | "cerrar" | "ficha_ia" | "revisar"; n?: number; cambio?: string };

/** Las órdenes largas (generar, corregir, ficha_ia) se lanzan en segundo plano; la pantalla pregunta el estado cada pocos segundos. */
export async function POST(req: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  if (!nombreSeguro(nombre)) return NextResponse.json({ error: "Nombre no válido" }, { status: 400 });
  const a = (await req.json()) as Accion;
  const D = datos();
  const estadoSalida = path.join(D, "salida", nombre, "_estado.json");

  if (a.accion === "ficha_ia") {
    await motorFondo(["ficha_ia", nombre], path.join(D, "virales", nombre, "_estado_ficha.json"));
    return NextResponse.json({ ok: true, lanzado: "ficha_ia" });
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
