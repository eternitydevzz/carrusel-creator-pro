import { NextResponse } from "next/server";
import path from "node:path";
import { cliente, existe, leerEstado, limpiarNombre, nombreSeguro, renombrar } from "@/lib/motor";

export const dynamic = "force-dynamic";

/** Cambia el nombre de un carrusel (ficha, original y salida). El nombre es también el del ZIP que se descarga. */
export async function POST(req: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  if (!nombreSeguro(nombre)) return NextResponse.json({ error: "Nombre no válido" }, { status: 400 });
  const { nuevo } = (await req.json()) as { nuevo?: string };
  const limpio = limpiarNombre(nuevo ?? "");
  if (!limpio) return NextResponse.json({ error: "El nombre tiene que tener letras o números" }, { status: 400 });
  if (limpio === nombre) return NextResponse.json({ ok: true, nombre });
  const D = cliente();
  if ((await leerEstado(path.join(D, "salida", nombre, "_estado.json")))?.estado === "en_curso") return NextResponse.json({ error: "Espera a que termine la generación para cambiar el nombre" }, { status: 409 });
  for (const ruta of [path.join(D, "fichas", `${limpio}.md`), path.join(D, "salida", limpio), path.join(D, "virales", limpio)]) {
    if (await existe(ruta)) return NextResponse.json({ error: `Ya existe un carrusel llamado ${limpio}` }, { status: 409 });
  }
  await renombrar(nombre, limpio);
  return NextResponse.json({ ok: true, nombre: limpio });
}
