import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cliente, confirmarCifrasEscritas, cuerpoJson, leerTexto, motor, nombreSeguro, parsearFicha, serializarFicha, type Ficha } from "@/lib/motor";

export const dynamic = "force-dynamic";

/** Guarda la ficha (como objeto del editor o como texto) y devuelve la comprobación. */
export async function PUT(req: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  if (!nombreSeguro(nombre)) return NextResponse.json({ error: "Nombre no válido" }, { status: 400 });
  const cuerpo = (await cuerpoJson<{ ficha: Ficha; texto: string }>(req));
  const fichaValida = !!cuerpo.ficha && typeof cuerpo.ficha === "object" && Array.isArray(cuerpo.ficha.slides);
  const archivo = path.join(cliente(), "fichas", `${nombre}.md`);
  // lo que la persona escribe en el editor es suyo: sus cifras nuevas se dan por confirmadas (la comprobación solo frena las de la IA)
  const previaTxt = await leerTexto(archivo);
  const editada = fichaValida && cuerpo.ficha ? confirmarCifrasEscritas(previaTxt ? parsearFicha(previaTxt) : null, cuerpo.ficha) : null;
  const texto = typeof cuerpo.texto === "string" ? cuerpo.texto : (editada ? serializarFicha({ ...editada, cabecera: { ...editada.cabecera, carrusel: nombre } }) : null);
  if (!texto) return NextResponse.json({ error: "Falta la ficha" }, { status: 400 });
  await fs.mkdir(path.join(cliente(), "fichas"), { recursive: true });
  await fs.writeFile(archivo, texto);
  const r = await motor(["comprobar", nombre], { timeoutMs: 30_000 });
  return NextResponse.json({ ok: r.codigo === 0, texto: r.salida, ficha: parsearFicha(texto) });
}
