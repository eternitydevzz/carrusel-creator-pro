import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATOS, PATH, escribirAjustes, leerAjustes, leerTexto, motor } from "@/lib/motor";

export const dynamic = "force-dynamic";

function comando(cmd: string, args: string[]): Promise<string> {
  return new Promise((res) => execFile(cmd, args, { timeout: 15_000, env: { ...process.env, PATH } }, (e, out, err) => res(`${out}${err}`.trim() || (e ? e.message : ""))));
}

export async function GET() {
  const ajustes = await leerAjustes();
  const clave = String(ajustes.scrapecreators_key ?? "");
  const [codex, cupo] = await Promise.all([comando("codex", ["login", "status"]), motor(["cupo"], { timeoutMs: 15_000 })]);
  const herramientas: Record<string, boolean> = {};
  for (const h of ["codex", "ffmpeg", "exiftool", "swift", "python3", "zip"]) { const w = await comando("which", [h]); herramientas[h] = w.startsWith("/"); }
  return NextResponse.json({
    clave_puesta: clave.length > 0, clave_final: clave.slice(-4),
    cuenta: (await leerTexto(path.join(DATOS, "CUENTA_ACTUAL.txt"))).trim(),
    ubicacion: ajustes.ubicacion ?? { ciudad: "Newark", estado: "New Jersey", pais: "United States", codigo: "US", lat: 40.7357, lon: -74.1724 },
    codex, codex_ok: /logged in/i.test(codex), cupo: cupo.salida, herramientas, datos: DATOS,
  });
}

export async function POST(req: Request) {
  const cuerpo = (await req.json()) as { scrapecreators_key?: string; cuenta?: string; ubicacion?: Record<string, unknown> };
  const ajustes = await leerAjustes();
  if (typeof cuerpo.scrapecreators_key === "string" && cuerpo.scrapecreators_key.trim()) ajustes.scrapecreators_key = cuerpo.scrapecreators_key.trim();
  if (cuerpo.ubicacion) ajustes.ubicacion = cuerpo.ubicacion;
  await escribirAjustes(ajustes);
  if (typeof cuerpo.cuenta === "string" && cuerpo.cuenta.trim()) await fs.writeFile(path.join(DATOS, "CUENTA_ACTUAL.txt"), cuerpo.cuenta.trim().replace(/\s+/g, "_") + "\n");
  return NextResponse.json({ ok: true });
}
