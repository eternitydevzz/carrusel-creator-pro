import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATOS, escribirMarca, leerMarca } from "@/lib/motor";

export const dynamic = "force-dynamic";

/** Sube fotos del kit: tipo=personaje (hasta 3, van al prompt), tipo=tipografia (1), tipo=referencia (varias, solo para verlas). */
export async function POST(req: Request) {
  const form = await req.formData();
  const tipo = String(form.get("tipo") ?? "");
  const archivos = form.getAll("archivos").filter((a): a is File => a instanceof File);
  if (!["personaje", "tipografia", "referencia"].includes(tipo)) return NextResponse.json({ error: "Tipo desconocido" }, { status: 400 });
  if (!archivos.length) return NextResponse.json({ error: "No llegó ningún archivo" }, { status: 400 });

  const marca = await leerMarca();
  const carpeta = path.join(DATOS, "marca", tipo === "referencia" ? "referencias" : "fotos");
  await fs.mkdir(carpeta, { recursive: true });
  const fotos = (marca.fotos ?? "").split(",").map((f) => f.trim()).filter(Boolean);
  const guardados: string[] = [];

  for (const a of archivos) {
    const base = tipo === "personaje" ? `personaje_${Date.now()}_${guardados.length + 1}` : tipo === "tipografia" ? "tipografia" : `ref_${Date.now()}_${guardados.length + 1}`;
    const tmp = path.join(carpeta, `.${base}.subiendo`);
    await fs.writeFile(tmp, Buffer.from(await a.arrayBuffer()));
    // todo pasa a JPG con sips (acepta HEIC, PNG, WEBP…) y se limita a 1600 px para no cargar el prompt
    const destino = path.join(carpeta, `${base}.jpg`);
    await new Promise<void>((res, rej) => execFile("sips", ["-s", "format", "jpeg", "-Z", "1600", tmp, "--out", destino], (e) => (e ? rej(e) : res()))).catch(async () => { await fs.rm(tmp, { force: true }); });
    await fs.rm(tmp, { force: true });
    guardados.push(path.relative(path.join(DATOS, "marca"), destino));
  }

  if (tipo === "personaje") {
    // se conservan como máximo 3 fotos: las nuevas primero
    const nuevas = [...guardados, ...fotos].slice(0, 3);
    for (const vieja of fotos.filter((f) => !nuevas.includes(f))) await fs.rm(path.join(DATOS, "marca", vieja), { force: true });
    marca.fotos = nuevas.join(", ");
  }
  if (tipo === "tipografia") marca.tipografia = guardados[0];
  await escribirMarca(marca);
  return NextResponse.json({ ok: true, guardados, marca });
}

export async function DELETE(req: Request) {
  const { ruta } = (await req.json()) as { ruta: string };
  const absoluta = path.resolve(DATOS, "marca", ruta);
  if (!absoluta.startsWith(path.resolve(DATOS, "marca") + path.sep)) return NextResponse.json({ error: "Ruta no permitida" }, { status: 400 });
  await fs.rm(absoluta, { force: true });
  const marca = await leerMarca();
  marca.fotos = (marca.fotos ?? "").split(",").map((f) => f.trim()).filter((f) => f && f !== ruta).join(", ");
  if (marca.tipografia === ruta) marca.tipografia = "";
  await escribirMarca(marca);
  return NextResponse.json({ ok: true });
}
