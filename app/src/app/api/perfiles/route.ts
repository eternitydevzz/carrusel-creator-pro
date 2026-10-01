import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ID_PERFIL, datos, escribirAjustes, existe, leerAjustes, leerEstado, leerTexto, limpiarNombre, perfilActivo } from "@/lib/motor";

export const dynamic = "force-dynamic";

/* Clientes (perfiles): cada uno con su marca y sus carruseles en datos/perfiles/<id>/. */

const MARCA_NUEVA = `handle: @tucuenta
azul: #1A79FB
angulo:
ropa: traje azul marino y camisa blanca, sin corbata
idioma: español. Se dice "AI", nunca "IA"
fotos:
tipografia:
pie: a la izquierda el handle y el lema; a la derecha botón "DESLIZA →" y el adelanto del siguiente slide; en el último, "+ SEGUIR"
lema:
tope_imagenes_dia: 60
`;
const UBICACION_POR_DEFECTO = { ciudad: "Newark", estado: "New Jersey", pais: "United States", codigo: "US", lat: 40.7357, lon: -74.1724 };

const raiz = () => path.join(datos(), "perfiles");
async function leerJson(p: string): Promise<Record<string, unknown>> { try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return {}; } }
function campo(marca: string, k: string) { return new RegExp(`^${k}:\\s*(.*)$`, "m").exec(marca)?.[1]?.trim() ?? ""; }

async function listar() {
  const activo = perfilActivo(); // de paso, migra los datos antiguos si hace falta
  const ids = (await fs.readdir(raiz(), { withFileTypes: true })).filter((e) => e.isDirectory() && ID_PERFIL.test(e.name)).map((e) => e.name);
  const lista = [];
  for (const id of ids) {
    const p = path.join(raiz(), id);
    const perfil = await leerJson(path.join(p, "perfil.json"));
    const marca = await leerTexto(path.join(p, "marca", "marca.txt"));
    const foto = campo(marca, "fotos").split(",")[0]?.trim() ?? "";
    let carruseles = 0;
    try { carruseles = (await fs.readdir(path.join(p, "fichas"))).filter((f) => f.endsWith(".md") && !f.startsWith("_")).length; } catch { /* sin fichas */ }
    lista.push({ id, nombre: String(perfil.nombre ?? id), handle: campo(marca, "handle"), azul: campo(marca, "azul") || "#1A79FB", foto: foto && (await existe(path.join(p, "marca", foto))) ? foto : "", carruseles, activo: id === activo });
  }
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  // ?foto=<id>: la primera foto del cliente, para el selector (la ruta de archivos solo sirve los del cliente activo)
  const idFoto = url.searchParams.get("foto");
  if (idFoto !== null) {
    if (!ID_PERFIL.test(idFoto)) return NextResponse.json({ error: "Cliente no válido" }, { status: 400 });
    const marca = await leerTexto(path.join(raiz(), idFoto, "marca", "marca.txt"));
    const foto = campo(marca, "fotos").split(",")[0]?.trim() ?? "";
    const abs = path.resolve(raiz(), idFoto, "marca", foto);
    if (!foto || !abs.startsWith(path.resolve(raiz(), idFoto, "marca") + path.sep) || !(await existe(abs))) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(await fs.readFile(abs)), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ perfiles: await listar() });
}

type Peticion = { accion: "crear" | "activar" | "renombrar"; id?: string; nombre?: string };

export async function POST(req: Request) {
  const p = (await req.json()) as Peticion;
  const ajustes = await leerAjustes();
  if (p.accion === "crear") {
    const nombre = (p.nombre ?? "").trim();
    if (!nombre) return NextResponse.json({ error: "Escribe el nombre del cliente" }, { status: 400 });
    perfilActivo(); // migra antes de crear, si hace falta
    const base = limpiarNombre(nombre).replace(/[^a-z0-9_-]/g, "") || "cliente";
    let id = base; let n = 2;
    while (await existe(path.join(raiz(), id))) id = `${base}_${n++}`;
    const dir = path.join(raiz(), id);
    for (const sub of ["marca/fotos", "fichas", "virales", "salida"]) await fs.mkdir(path.join(dir, sub), { recursive: true });
    await fs.writeFile(path.join(dir, "marca", "marca.txt"), MARCA_NUEVA);
    await fs.writeFile(path.join(dir, "perfil.json"), JSON.stringify({ nombre, ubicacion: UBICACION_POR_DEFECTO }, null, 2));
    await escribirAjustes({ ...ajustes, perfil_activo: id });
    return NextResponse.json({ ok: true, id });
  }
  const id = p.id ?? "";
  if (!ID_PERFIL.test(id) || !(await existe(path.join(raiz(), id)))) return NextResponse.json({ error: "Ese cliente no existe" }, { status: 404 });
  if (p.accion === "activar") {
    await escribirAjustes({ ...ajustes, perfil_activo: id });
    return NextResponse.json({ ok: true });
  }
  if (p.accion === "renombrar") {
    const nombre = (p.nombre ?? "").trim();
    if (!nombre) return NextResponse.json({ error: "Escribe el nombre del cliente" }, { status: 400 });
    const f = path.join(raiz(), id, "perfil.json");
    await fs.writeFile(f, JSON.stringify({ ...(await leerJson(f)), nombre }, null, 2));
    // un cliente recién creado desde el selector tiene carpeta provisional (nuevo_cliente…): pasa a llamarse como el cliente
    if (id.startsWith("nuevo_cliente")) {
      const base = limpiarNombre(nombre).replace(/[^a-z0-9_-]/g, "") || "cliente";
      let nuevo = base; let n = 2;
      while (nuevo !== id && (await existe(path.join(raiz(), nuevo)))) nuevo = `${base}_${n++}`;
      if (nuevo !== id) {
        await fs.rename(path.join(raiz(), id), path.join(raiz(), nuevo));
        if (ajustes.perfil_activo === id) await escribirAjustes({ ...ajustes, perfil_activo: nuevo });
        return NextResponse.json({ ok: true, id: nuevo });
      }
    }
    return NextResponse.json({ ok: true, id });
  }
  return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
}

/** Eliminar un cliente: su carpeta pasa a datos/_papelera/ (no se borra), salvo que sea el único o tenga una generación en curso. */
export async function DELETE(req: Request) {
  const { id = "" } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!ID_PERFIL.test(id) || !(await existe(path.join(raiz(), id)))) return NextResponse.json({ error: "Ese cliente no existe" }, { status: 404 });
  const lista = await listar();
  if (lista.length <= 1) return NextResponse.json({ error: "Es el único cliente: crea otro antes de eliminar este" }, { status: 409 });
  try {
    for (const c of await fs.readdir(path.join(raiz(), id, "salida"))) {
      if ((await leerEstado(path.join(raiz(), id, "salida", c, "_estado.json")))?.estado === "en_curso") return NextResponse.json({ error: `Tiene una generación en curso (${c}). Espera a que termine.` }, { status: 409 });
    }
  } catch { /* sin carruseles */ }
  const papelera = path.join(datos(), "_papelera");
  await fs.mkdir(papelera, { recursive: true });
  await fs.rename(path.join(raiz(), id), path.join(papelera, `${id}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`));
  const ajustes = await leerAjustes();
  if (ajustes.perfil_activo === id) await escribirAjustes({ ...ajustes, perfil_activo: lista.find((x) => x.id !== id)?.id ?? "" });
  return NextResponse.json({ ok: true });
}
