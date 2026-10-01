import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { cliente, datos, existe } from "@/lib/motor";

export const dynamic = "force-dynamic";

/** Abre en el Finder una carpeta de datos (o la propia carpeta de datos si no se indica ninguna). Solo dentro de datos. */
export async function POST(req: Request) {
  const { ruta = "" } = (await req.json().catch(() => ({}))) as { ruta?: string };
  // sin ruta: la carpeta general de datos (Ajustes); con ruta: dentro de la carpeta del cliente activo (sus carruseles)
  const D = ruta ? cliente() : datos();
  const abs = path.resolve(D, ruta);
  if (abs !== D && !abs.startsWith(D + path.sep)) return NextResponse.json({ error: "Ruta fuera de la carpeta de datos" }, { status: 400 });
  if (!(await existe(abs))) return NextResponse.json({ error: "Esa carpeta todavía no existe" }, { status: 404 });
  try {
    await new Promise<void>((res, rej) => execFile("open", [abs], (e) => (e ? rej(e) : res())));
    return NextResponse.json({ ok: true, ruta: abs });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
