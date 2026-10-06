import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cliente, cuerpoJson, datos, escribirMarca, leerMarca, lista } from "@/lib/motor";

export const dynamic = "force-dynamic";

const CAMPOS = ["handle", "azul", "angulo", "ropa", "idioma", "pie", "lema", "nombre", "tope_imagenes_dia"];

export async function GET() {
  const marca = await leerMarca();
  const fotos = (marca.fotos ?? "").split(",").map((f) => f.trim()).filter(Boolean);
  let referencias: string[] = [];
  try { referencias = (await fs.readdir(path.join(cliente(), "marca", "referencias"))).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).map((f) => `referencias/${f}`); } catch { /* sin referencias */ }
  return NextResponse.json({ marca, fotos, tipografia: lista(marca.tipografia)[0] ?? "", estilos: lista(marca.tipografia), referencias });
}

/** Guarda los campos de texto del kit de marca. Las fotos van por /api/marca/foto. */
export async function POST(req: Request) {
  const cuerpo = (await cuerpoJson(req)) as Record<string, string>;
  const marca = await leerMarca();
  const handleAntes = marca.handle ?? "";
  for (const k of CAMPOS) if (typeof cuerpo[k] === "string") marca[k] = cuerpo[k].replace(/\n/g, " ").trim();
  if (marca.azul && !/^#[0-9a-fA-F]{6}$/.test(marca.azul)) return NextResponse.json({ error: "El color tiene que ser un código como #1A79FB" }, { status: 400 });
  if (marca.handle && !marca.handle.startsWith("@")) marca.handle = "@" + marca.handle;
  await escribirMarca(marca);
  // las capas del pie llevan el handle en su nombre (_handle_). Se borran solo las de este cliente (la de antes y la de ahora)
  // para que se redibujen solas; la carpeta capas es de todos los clientes y puede haber otra generación usándola.
  const sinSimbolos = (h: string) => h.replace(/[@.]/g, "");
  const handles = [...new Set([handleAntes, marca.handle ?? ""].map(sinSimbolos).filter(Boolean))];
  const carpetaCapas = path.join(datos(), "capas");
  for (const nombre of await fs.readdir(carpetaCapas).catch(() => [] as string[])) {
    if (handles.some((h) => nombre.includes(`_${h}_`))) await fs.rm(path.join(carpetaCapas, nombre), { force: true });
  }
  return NextResponse.json({ ok: true, marca });
}
