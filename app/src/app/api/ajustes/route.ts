import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { CONFIG, DATOS_POR_DEFECTO, PATH, cambiarDatos, datos, escribirAjustes, leerAjustes, leerTexto, motor } from "@/lib/motor";

export const dynamic = "force-dynamic";

function comando(cmd: string, args: string[]): Promise<string> {
  return new Promise((res) => execFile(cmd, args, { timeout: 15_000, env: { ...process.env, PATH } }, (e, out, err) => res(`${out}${err}`.trim() || (e ? e.message : ""))));
}

/** Créditos que quedan en ScrapeCreators. Si la clave es mala o no hay red, devuelve null y el motivo. */
async function creditos(clave: string): Promise<{ creditos: number | null; error?: string }> {
  if (!clave) return { creditos: null };
  try {
    // GET /v1/account/credit-balance → { success, credits_remaining, creditCount }. No gasta créditos.
    const r = await fetch("https://api.scrapecreators.com/v1/account/credit-balance", { headers: { "x-api-key": clave }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return { creditos: null, error: r.status === 401 || r.status === 403 ? "La clave no es válida" : `ScrapeCreators respondió ${r.status}` };
    const d = (await r.json()) as { credits_remaining?: unknown; creditCount?: unknown; credits?: unknown };
    const n = Number(d.credits_remaining ?? d.creditCount ?? d.credits);
    return { creditos: Number.isFinite(n) ? n : null };
  } catch { return { creditos: null, error: "No se pudo consultar ScrapeCreators" }; }
}

export async function GET() {
  const ajustes = await leerAjustes();
  const clave = String(ajustes.scrapecreators_key ?? "");
  const [codex, cupo, claude, sc] = await Promise.all([comando("codex", ["login", "status"]), motor(["cupo"], { timeoutMs: 15_000 }), comando("claude", ["--version"]), creditos(clave)]);
  const herramientas: Record<string, boolean> = {};
  for (const h of ["codex", "claude", "ffmpeg", "exiftool", "swift", "python3", "zip"]) { const w = await comando("which", [h]); herramientas[h] = w.startsWith("/"); }
  return NextResponse.json({
    clave_puesta: clave.length > 0, clave_final: clave.slice(-4), creditos: sc.creditos, creditos_error: sc.error,
    cuenta: (await leerTexto(path.join(datos(), "CUENTA_ACTUAL.txt"))).trim(),
    ubicacion: ajustes.ubicacion ?? { ciudad: "Newark", estado: "New Jersey", pais: "United States", codigo: "US", lat: 40.7357, lon: -74.1724 },
    codex, codex_ok: /logged in/i.test(codex), claude, claude_ok: /^\d+\.\d+/.test(claude), cupo: cupo.salida, herramientas,
    datos: datos(), datos_por_defecto: DATOS_POR_DEFECTO, config: CONFIG,
  });
}

export async function POST(req: Request) {
  const cuerpo = (await req.json()) as { scrapecreators_key?: string; cuenta?: string; ubicacion?: Record<string, unknown>; datos?: string };
  if (typeof cuerpo.datos === "string" && cuerpo.datos.trim()) {
    try { const abs = await cambiarDatos(cuerpo.datos); return NextResponse.json({ ok: true, datos: abs }); }
    catch (e) { return NextResponse.json({ error: `No se pudo usar esa carpeta: ${(e as Error).message}` }, { status: 400 }); }
  }
  const ajustes = await leerAjustes();
  if (typeof cuerpo.scrapecreators_key === "string" && cuerpo.scrapecreators_key.trim()) ajustes.scrapecreators_key = cuerpo.scrapecreators_key.trim();
  if (cuerpo.ubicacion) ajustes.ubicacion = cuerpo.ubicacion;
  await escribirAjustes(ajustes);
  if (typeof cuerpo.cuenta === "string" && cuerpo.cuenta.trim()) await fs.writeFile(path.join(datos(), "CUENTA_ACTUAL.txt"), cuerpo.cuenta.trim().replace(/\s+/g, "_") + "\n");
  return NextResponse.json({ ok: true });
}
