import { NextResponse } from "next/server";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { PATH } from "@/lib/motor";

export const dynamic = "force-dynamic";

type Herramienta = "claude" | "codex";
const env = () => ({ ...process.env, PATH });
const hijos: Partial<Record<Herramienta, ChildProcess>> = {};
const esHerramienta = (h: unknown): h is Herramienta => h === "claude" || h === "codex";

function salida(cmd: string, args: string[]): Promise<string> {
  return new Promise((res) => execFile(cmd, args, { env: env(), timeout: 15_000 }, (_e, out, err) => res(`${out ?? ""}${err ?? ""}`)));
}

/** ¿Hay sesión iniciada? Claude: `claude auth status` (la que usa el motor para redactar). Codex: `codex login status`. */
export async function GET(req: Request) {
  const h = new URL(req.url).searchParams.get("herramienta") ?? "claude";
  if (!esHerramienta(h)) return NextResponse.json({ error: "Herramienta no válida" }, { status: 400 });
  if (h === "codex") return NextResponse.json({ conectado: /logged in/i.test(await salida("codex", ["login", "status"])) });
  let conectado = false;
  try { conectado = JSON.parse(await salida("claude", ["auth", "status"])).loggedIn === true; } catch { /* sin respuesta legible: no conectado */ }
  return NextResponse.json({ conectado });
}

/** Inicia sesión: abre el navegador para entrar con la cuenta (Claude con suscripción; Codex con ChatGPT).
 *  Si ya había un login esperando (por ejemplo, se cerró la ventana del navegador), se corta y se lanza otro:
 *  así el botón siempre vuelve a abrir el navegador. */
export async function POST(req: Request) {
  const { herramienta } = (await req.json().catch(() => ({}))) as { herramienta?: unknown };
  const h = herramienta ?? "claude";
  if (!esHerramienta(h)) return NextResponse.json({ error: "Herramienta no válida" }, { status: 400 });
  const previo = hijos[h];
  if (previo?.pid && previo.exitCode === null) { try { process.kill(-previo.pid); } catch { /* ya había terminado */ } }
  // por si el servidor se reinició y perdió su hijo: solo la orden exacta, nunca una búsqueda amplia
  if (h === "claude") await new Promise<void>((res) => execFile("pkill", ["-f", "^claude auth login"], () => res()));
  try {
    const hijo = spawn(h, h === "claude" ? ["auth", "login", "--claudeai"] : ["login"], { env: env(), stdio: "ignore", detached: true });
    hijo.on("error", () => { delete hijos[h]; });
    hijo.unref();
    hijos[h] = hijo;
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
