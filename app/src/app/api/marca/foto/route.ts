import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cliente, cuerpoJson, escribirMarca, leerMarca, lista } from "@/lib/motor";

export const dynamic = "force-dynamic";

/** Sube fotos del kit: tipo=personaje (1 a 3, van al prompt), tipo=tipografia (referencias de estilo, 1 a 3, van al prompt), tipo=referencia (varias, solo para verlas). */
export async function POST(req: Request) {
  const form = await req.formData();
  const tipo = String(form.get("tipo") ?? "");
  const archivos = form.getAll("archivos").filter((a): a is File => a instanceof File);
  if (!["personaje", "tipografia", "referencia"].includes(tipo)) return NextResponse.json({ error: "Tipo desconocido" }, { status: 400 });
  if (!archivos.length) return NextResponse.json({ error: "No llegó ningún archivo" }, { status: 400 });

  const marca = await leerMarca();
  const carpeta = path.join(cliente(), "marca", tipo === "referencia" ? "referencias" : "fotos");
  await fs.mkdir(carpeta, { recursive: true });
  const fotos = (marca.fotos ?? "").split(",").map((f) => f.trim()).filter(Boolean);
  const guardados: string[] = [];
  const fallidos: string[] = [];

  for (const a of archivos) {
    // nombre distinto en cada subida: con el mismo nombre la pantalla seguía enseñando la imagen anterior (misma dirección)
    const base = tipo === "personaje" ? `personaje_${Date.now()}_${guardados.length + 1}` : tipo === "tipografia" ? `tipografia_${Date.now()}_${guardados.length + 1}` : `ref_${Date.now()}_${guardados.length + 1}`;
    const tmp = path.join(carpeta, `.${base}.subiendo`);
    await fs.writeFile(tmp, Buffer.from(await a.arrayBuffer()));
    // todo pasa a JPG con sips (acepta HEIC, PNG, WEBP…) y se limita a 1600 px para no cargar el prompt
    const destino = path.join(carpeta, `${base}.jpg`);
    const ok = await new Promise<boolean>((res) => execFile("sips", ["-s", "format", "jpeg", "-Z", "1600", tmp, "--out", destino], (e) => res(!e)));
    await fs.rm(tmp, { force: true });
    // solo cuenta si de verdad salió un JPG: si no, una foto fallida desplazaría a una buena del máximo de 3
    if (ok && (await fs.stat(destino).then((st) => st.size > 0, () => false))) guardados.push(path.relative(path.join(cliente(), "marca"), destino));
    else { await fs.rm(destino, { force: true }); fallidos.push(a.name || "archivo"); }
  }
  if (!guardados.length) return NextResponse.json({ error: `No se pudo leer como imagen: ${fallidos.join(", ")}. Usa JPG, PNG o HEIC.` }, { status: 400 });

  if (tipo === "personaje") {
    // se conservan como máximo 3 fotos: las nuevas primero
    const nuevas = [...guardados, ...fotos].slice(0, 3);
    for (const vieja of fotos.filter((f) => !nuevas.includes(f))) await fs.rm(path.join(cliente(), "marca", vieja), { force: true });
    marca.fotos = nuevas.join(", ");
  }
  if (tipo === "tipografia") {
    // referencias de estilo: como máximo 3, las nuevas primero (la casilla "tipografia" de marca.txt es una lista)
    const estilos = lista(marca.tipografia);
    const nuevas = [...guardados, ...estilos].slice(0, 3);
    for (const vieja of estilos.filter((f) => !nuevas.includes(f) && !fotos.includes(f))) await fs.rm(path.join(cliente(), "marca", vieja), { force: true });
    marca.tipografia = nuevas.join(", ");
  }
  await escribirMarca(marca);
  return NextResponse.json({ ok: true, guardados, fallidos, marca });
}

export async function DELETE(req: Request) {
  const { ruta } = (await cuerpoJson<{ ruta: string }>(req));
  if (typeof ruta !== "string" || !ruta) return NextResponse.json({ error: "Falta la foto" }, { status: 400 });
  const absoluta = path.resolve(cliente(), "marca", ruta);
  if (!absoluta.startsWith(path.resolve(cliente(), "marca") + path.sep)) return NextResponse.json({ error: "Ruta no permitida" }, { status: 400 });
  await fs.rm(absoluta, { force: true });
  const marca = await leerMarca();
  marca.fotos = lista(marca.fotos).filter((f) => f !== ruta).join(", ");
  marca.tipografia = lista(marca.tipografia).filter((f) => f !== ruta).join(", ");
  await escribirMarca(marca);
  return NextResponse.json({ ok: true });
}
