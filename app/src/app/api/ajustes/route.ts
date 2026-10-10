import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cambiarDatos, cliente, codexConectado, CONFIG, cuerpoJson, datos, DATOS_POR_DEFECTO, ejecutable, ejecutar, escribirAjustes, leerAjustes, leerTexto, motor, PY, WINDOWS } from "@/lib/motor";

export const dynamic = "force-dynamic";

const comando = ejecutar;

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

// la ubicación de los metadatos es de cada cliente (perfil.json); la de ajustes.json queda como valor por defecto
async function leerPerfil(): Promise<Record<string, unknown>> {
  try { return JSON.parse(await fs.readFile(path.join(cliente(), "perfil.json"), "utf8")); } catch { return {}; }
}

export async function GET() {
  const ajustes = await leerAjustes();
  const perfil = await leerPerfil();
  const clave = String(ajustes.scrapecreators_key ?? "");
  const [codex, cupo, claude, claudeSesion, sc] = await Promise.all([comando("codex", ["login", "status"]), motor(["cupo"], { timeoutMs: 15_000 }), comando("claude", ["--version"]), comando("claude", ["auth", "status"]), creditos(clave)]);
  const herramientas: Record<string, boolean> = {};
  // python: el que usa el motor (python3 en Mac, python en Windows), con Pillow instalado
  for (const h of ["codex", "claude", "ffmpeg", "exiftool"]) herramientas[h] = !!ejecutable(h);
  herramientas.python = /^ok/.test(await ejecutar(PY, ["-c", "import PIL; print('ok')"]));
  return NextResponse.json({
    clave_puesta: clave.length > 0, clave_final: clave.slice(-4), creditos: sc.creditos, creditos_error: sc.error,
    cuenta: (await leerTexto(path.join(datos(), "CUENTA_ACTUAL.txt"))).trim(),
    ubicacion: perfil.ubicacion ?? ajustes.ubicacion ?? { ciudad: "Newark", estado: "New Jersey", pais: "United States", codigo: "US", lat: 40.7357, lon: -74.1724 },
    codex, codex_ok: codexConectado(codex), claude, claude_instalado: /^\d+\.\d+/.test(claude), claude_ok: /^\d+\.\d+/.test(claude) && /"loggedIn":\s*true/.test(claudeSesion), cupo: cupo.salida, herramientas,
    datos: datos(), datos_por_defecto: DATOS_POR_DEFECTO, config: CONFIG, windows: WINDOWS,
  });
}

export async function POST(req: Request) {
  const cuerpo = (await cuerpoJson(req)) as { scrapecreators_key?: string; cuenta?: string; ubicacion?: Record<string, unknown>; datos?: string };
  if (typeof cuerpo.datos === "string" && cuerpo.datos.trim()) {
    try { const abs = await cambiarDatos(cuerpo.datos); return NextResponse.json({ ok: true, datos: abs }); }
    catch (e) { return NextResponse.json({ error: `No se pudo usar esa carpeta: ${(e as Error).message}` }, { status: 400 }); }
  }
  const ajustes = await leerAjustes();
  if (typeof cuerpo.scrapecreators_key === "string" && cuerpo.scrapecreators_key.trim()) ajustes.scrapecreators_key = cuerpo.scrapecreators_key.trim();
  if (cuerpo.ubicacion) await fs.writeFile(path.join(cliente(), "perfil.json"), JSON.stringify({ ...(await leerPerfil()), ubicacion: cuerpo.ubicacion }, null, 2));
  await escribirAjustes(ajustes);
  if (typeof cuerpo.cuenta === "string" && cuerpo.cuenta.trim()) await fs.writeFile(path.join(datos(), "CUENTA_ACTUAL.txt"), cuerpo.cuenta.trim().replace(/\s+/g, "_") + "\n");
  return NextResponse.json({ ok: true });
}
