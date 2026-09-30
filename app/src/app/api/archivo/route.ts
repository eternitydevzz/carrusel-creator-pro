import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATOS } from "@/lib/motor";

export const dynamic = "force-dynamic";

const tipos: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8" };

/** Sirve un archivo de la carpeta de datos (imágenes de los slides, del original, del kit de marca). Solo dentro de datos/. */
export async function GET(req: Request) {
  const ruta = new URL(req.url).searchParams.get("ruta") ?? "";
  const absoluta = path.resolve(DATOS, ruta);
  if (!absoluta.startsWith(path.resolve(DATOS) + path.sep)) return NextResponse.json({ error: "Ruta no permitida" }, { status: 400 });
  try {
    const [datos, st] = [await fs.readFile(absoluta), await fs.stat(absoluta)];
    return new NextResponse(datos, { headers: { "Content-Type": tipos[path.extname(absoluta).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-store", "Last-Modified": st.mtime.toUTCString() } });
  } catch { return NextResponse.json({ error: "No existe" }, { status: 404 }); }
}
