import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cuerpoJson, datos, escribirAjustes, existe, ID_PERFIL, leerAjustes, leerEstado, leerTexto, limpiarNombre, perfilActivo } from "@/lib/motor";

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

/** ¿Marca completa? (@ propio, 2 fotos y referencia de estilo, como pide la bienvenida) y ¿está vacío? (recién creado, sin nada). */
async function estado(id: string) {
  const dir = path.join(raiz(), id);
  const marca = await leerTexto(path.join(dir, "marca", "marca.txt"));
  const handle = campo(marca, "handle");
  const fotos = campo(marca, "fotos").split(",").map((f) => f.trim()).filter(Boolean);
  let existentes = 0;
  for (const f of fotos) if (await existe(path.join(dir, "marca", f))) existentes++;
  let estilosOk = 0;
  for (const f of campo(marca, "tipografia").split(",").map((x) => x.trim()).filter(Boolean)) if (await existe(path.join(dir, "marca", f))) estilosOk++;
  let fichas = 0;
  try { fichas = (await fs.readdir(path.join(dir, "fichas"))).filter((f) => f.endsWith(".md")).length; } catch { /* sin fichas */ }
  let enFotos = 0;
  try { enFotos = (await fs.readdir(path.join(dir, "marca", "fotos"))).length; } catch { /* sin fotos */ }
  const completo = !!handle && handle !== "@tucuenta" && existentes >= 1 && estilosOk >= 1;
  const vacio = (!handle || handle === "@tucuenta") && enFotos === 0 && fichas === 0;
  return { completo, vacio };
}
/** Un cliente creado desde "Nuevo cliente" que se dejó sin rellenar: se aparta a la papelera para que no quede colgado. */
async function aPapelera(id: string) {
  const papelera = path.join(datos(), "_papelera");
  await fs.mkdir(papelera, { recursive: true });
  await fs.rename(path.join(raiz(), id), path.join(papelera, `${id}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`));
}
const provisional = (id: string) => id.startsWith("nuevo_cliente");

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
    const { completo } = await estado(id);
    lista.push({ id, nombre: String(perfil.nombre ?? id), handle: campo(marca, "handle"), azul: campo(marca, "azul") || "#1A79FB", foto: foto && (await existe(path.join(p, "marca", foto))) ? foto : "", carruseles, activo: id === activo, completo });
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

type Peticion = { accion: "crear" | "activar" | "renombrar" | "cancelar"; id?: string; nombre?: string };

export async function POST(req: Request) {
  const p = (await cuerpoJson<Peticion>(req)) as Peticion;
  const ajustes = await leerAjustes();
  if (p.accion === "crear") {
    const nombre = (p.nombre ?? "").trim();
    if (!nombre) return NextResponse.json({ error: "Escribe el nombre del cliente" }, { status: 400 });
    const anterior = perfilActivo(); // de paso, migra antes de crear si hace falta
    // se recuerda de qué cliente se venía, para volver si se cancela la bienvenida
    const volverA = provisional(anterior) ? String(ajustes.perfil_anterior ?? "") : anterior;
    // si ya hay un cliente nuevo sin rellenar, se reutiliza en vez de crear otro
    if (nombre === "Nuevo cliente") {
      for (const e of await fs.readdir(raiz(), { withFileTypes: true })) {
        if (e.isDirectory() && provisional(e.name) && (await estado(e.name)).vacio) {
          await escribirAjustes({ ...ajustes, perfil_activo: e.name, perfil_anterior: volverA });
          return NextResponse.json({ ok: true, id: e.name, reutilizado: true });
        }
      }
    }
    const base = limpiarNombre(nombre).replace(/[^a-z0-9_-]/g, "") || "cliente";
    let id = base; let n = 2;
    while (await existe(path.join(raiz(), id))) id = `${base}_${n++}`;
    const dir = path.join(raiz(), id);
    for (const sub of ["marca/fotos", "fichas", "virales", "salida"]) await fs.mkdir(path.join(dir, sub), { recursive: true });
    await fs.writeFile(path.join(dir, "marca", "marca.txt"), MARCA_NUEVA);
    await fs.writeFile(path.join(dir, "perfil.json"), JSON.stringify({ nombre, ubicacion: UBICACION_POR_DEFECTO }, null, 2));
    await escribirAjustes({ ...ajustes, perfil_activo: id, perfil_anterior: volverA });
    return NextResponse.json({ ok: true, id });
  }
  if (p.accion === "cancelar") {
    // salir de la bienvenida de un cliente nuevo: a la papelera (se puede recuperar de ahí) y se vuelve al cliente de antes
    const actual = perfilActivo();
    if (provisional(actual)) await aPapelera(actual); // nunca terminó la bienvenida (al terminar, la carpeta toma su nombre)
    const ids = (await fs.readdir(raiz(), { withFileTypes: true })).filter((e) => e.isDirectory() && ID_PERFIL.test(e.name)).map((e) => e.name);
    const anterior = String(ajustes.perfil_anterior ?? "");
    const destino = ids.includes(anterior) ? anterior : ids.includes(actual) ? actual : ids.sort()[0] ?? "";
    await escribirAjustes({ ...ajustes, perfil_activo: destino, perfil_anterior: "" });
    return NextResponse.json({ ok: true, id: destino });
  }
  if (p.accion !== "activar" && p.accion !== "renombrar") return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  const id = p.id ?? "";
  if (!ID_PERFIL.test(id) || !(await existe(path.join(raiz(), id)))) return NextResponse.json({ error: "Ese cliente no existe" }, { status: 404 });
  if (p.accion === "activar") {
    // al cambiar de cliente, uno nuevo que se dejó vacío no se queda colgado en la lista
    const actual = perfilActivo();
    if (actual !== id && provisional(actual) && (await estado(actual)).vacio) await aPapelera(actual);
    await escribirAjustes({ ...ajustes, perfil_activo: id, perfil_anterior: "" });
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
  await aPapelera(id);
  const ajustes = await leerAjustes();
  if (ajustes.perfil_activo === id) await escribirAjustes({ ...ajustes, perfil_activo: lista.find((x) => x.id !== id)?.id ?? "" });
  return NextResponse.json({ ok: true });
}
