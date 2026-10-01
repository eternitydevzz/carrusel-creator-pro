import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import { datos, escribirAjustes, leerAjustes, leerMarca } from "@/lib/motor";

export const dynamic = "force-dynamic";

/** ¿Hace falta la bienvenida? Sí, si no se ha terminado nunca y además la marca está incompleta
 *  (sin @ propio, con menos de 2 fotos del personaje o sin referencia de estilo).
 *  Así, quien ya tenía su marca configurada antes de existir la bienvenida no la ve. */
export async function GET() {
  const ajustes = await leerAjustes();
  const marca = await leerMarca();
  const fotos = (marca.fotos ?? "").split(",").map((f) => f.trim()).filter((f) => f && existsSync(path.join(datos(), "marca", f)));
  const tipografia = !!marca.tipografia && existsSync(path.join(datos(), "marca", marca.tipografia));
  const handle = !!marca.handle && marca.handle !== "@tucuenta";
  const faltan = [!handle && "tu cuenta", fotos.length < 2 && "tus fotos", !tipografia && "la referencia de estilo"].filter(Boolean);
  const hecha = ajustes.bienvenida_hecha === true || faltan.length === 0;
  return NextResponse.json({ hecha, faltan });
}

/** { hecha: true } al terminar; { hecha: false } para repetirla desde Ajustes. */
export async function POST(req: Request) {
  const { hecha } = (await req.json()) as { hecha?: boolean };
  const ajustes = await leerAjustes();
  ajustes.bienvenida_hecha = hecha === true;
  await escribirAjustes(ajustes);
  return NextResponse.json({ ok: true });
}
