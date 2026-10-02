import { NextResponse } from "next/server";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { cliente, cuerpoJson, datos, escribirAjustes, leerAjustes, leerMarca, lista, perfilActivo } from "@/lib/motor";

export const dynamic = "force-dynamic";

async function leerPerfil(): Promise<Record<string, unknown>> {
  try { return JSON.parse(await fs.readFile(path.join(cliente(), "perfil.json"), "utf8")); } catch { return {}; }
}

/** ¿Hace falta la bienvenida para el cliente activo? Sí, si no la terminó y su marca está incompleta
 *  (sin @ propio, sin ninguna foto del personaje o sin referencia de estilo).
 *  modo "inicial": primera vez del equipo en este Mac (marca + conexiones); "cliente": solo la marca de un cliente nuevo. */
export async function GET() {
  const ajustes = await leerAjustes();
  const perfil = await leerPerfil();
  const marca = await leerMarca();
  const fotos = (marca.fotos ?? "").split(",").map((f) => f.trim()).filter((f) => f && existsSync(path.join(cliente(), "marca", f)));
  const tipografia = lista(marca.tipografia).some((f) => existsSync(path.join(cliente(), "marca", f)));
  const handle = !!marca.handle && marca.handle !== "@tucuenta";
  const faltan = [!handle && "la cuenta", fotos.length < 1 && "las fotos", !tipografia && "la referencia de estilo"].filter(Boolean);
  const hecha = perfil.bienvenida_hecha === true || faltan.length === 0;
  // el equipo ya está configurado si terminó la bienvenida completa, si la terminó antes de existir los perfiles
  // (bienvenida_hecha global) o si ya hay más de un cliente (alguien creó uno nuevo desde el selector)
  let clientes = 0;
  try { clientes = (await fs.readdir(path.join(datos(), "perfiles"), { withFileTypes: true })).filter((e) => e.isDirectory()).length; } catch { /* sin perfiles */ }
  const modo = ajustes.equipo_configurado === true || ajustes.bienvenida_hecha === true || clientes > 1 ? "cliente" : "inicial";
  return NextResponse.json({ hecha, faltan, modo, perfil: perfilActivo(), nombre: String(perfil.nombre ?? "") });
}

/** { hecha: true, modo } al terminar: marca al cliente como configurado y, si era la primera vez, al equipo. */
export async function POST(req: Request) {
  const { hecha, modo } = (await cuerpoJson<{ hecha: boolean; modo: string }>(req));
  if (typeof hecha !== "boolean") return NextResponse.json({ error: "Falta hecha (true o false)" }, { status: 400 });
  const f = path.join(cliente(), "perfil.json");
  await fs.writeFile(f, JSON.stringify({ ...(await leerPerfil()), bienvenida_hecha: hecha === true }, null, 2));
  if (hecha === true && modo === "inicial") await escribirAjustes({ ...(await leerAjustes()), equipo_configurado: true });
  return NextResponse.json({ ok: true });
}
