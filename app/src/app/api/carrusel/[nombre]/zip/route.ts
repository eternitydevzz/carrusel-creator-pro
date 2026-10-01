import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { cliente, nombreSeguro } from "@/lib/motor";

export const dynamic = "force-dynamic";

/** Descarga los JPG finales de un carrusel en un ZIP, con la descripción de Instagram y sus variaciones si existen. */
export async function GET(_req: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  if (!nombreSeguro(nombre)) return NextResponse.json({ error: "Nombre no válido" }, { status: 400 });
  const salida = path.join(cliente(), "salida", nombre);
  const jpgs = (await fs.readdir(salida).catch(() => [] as string[])).filter((a) => /^\d+\.jpg$/.test(a)).sort((a, b) => parseInt(a) - parseInt(b));
  if (!jpgs.length) return NextResponse.json({ error: "Este carrusel no tiene JPG finales todavía" }, { status: 404 });
  // la descripción de Instagram y sus variaciones van dentro si ya se crearon
  const extra: string[] = [];
  for (const t of ["descripcion.txt", "variaciones.txt"]) if (await fs.access(path.join(salida, t)).then(() => true, () => false)) extra.push(path.join(salida, t));
  const zip = path.join(os.tmpdir(), `${nombre}-${Date.now()}.zip`);
  await new Promise<void>((resolve, reject) => execFile("zip", ["-j", "-q", zip, ...jpgs.map((j) => path.join(salida, j)), ...extra], (e) => (e ? reject(e) : resolve())));
  const bytes = await fs.readFile(zip); await fs.rm(zip, { force: true });
  return new NextResponse(bytes, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${nombre}.zip"` } });
}
