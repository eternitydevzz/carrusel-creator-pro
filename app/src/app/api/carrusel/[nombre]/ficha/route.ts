import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cliente, motor, nombreSeguro, parsearFicha, serializarFicha, type Ficha } from "@/lib/motor";

export const dynamic = "force-dynamic";

/** Guarda la ficha (como objeto del editor o como texto) y devuelve la comprobación. */
export async function PUT(req: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  if (!nombreSeguro(nombre)) return NextResponse.json({ error: "Nombre no válido" }, { status: 400 });
  const cuerpo = (await req.json()) as { ficha?: Ficha; texto?: string };
  const texto = cuerpo.texto ?? (cuerpo.ficha ? serializarFicha({ ...cuerpo.ficha, cabecera: { ...cuerpo.ficha.cabecera, carrusel: nombre } }) : null);
  if (!texto) return NextResponse.json({ error: "Falta la ficha" }, { status: 400 });
  await fs.mkdir(path.join(cliente(), "fichas"), { recursive: true });
  await fs.writeFile(path.join(cliente(), "fichas", `${nombre}.md`), texto);
  const r = await motor(["comprobar", nombre], { timeoutMs: 30_000 });
  return NextResponse.json({ ok: r.codigo === 0, texto: r.salida, ficha: parsearFicha(texto) });
}
