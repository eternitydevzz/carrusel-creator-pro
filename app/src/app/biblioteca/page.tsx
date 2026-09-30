"use client";

import { useEffect, useState } from "react";
import { Cabecera, Panel } from "@/componentes/ui";
import { Tarjeta } from "../page";
import type { Resumen } from "@/lib/motor";

export default function Biblioteca() {
  const [lista, setLista] = useState<Resumen[] | null>(null);
  useEffect(() => { fetch("/api/carruseles").then((r) => r.json()).then(setLista).catch(() => setLista([])); }, []);
  const grupos: { titulo: string; filtro: (c: Resumen) => boolean }[] = [
    { titulo: "Listos para subir", filtro: (c) => c.fase === "cerrado" },
    { titulo: "En marcha", filtro: (c) => c.fase === "generando" || c.fase === "revision" },
    { titulo: "Por generar", filtro: (c) => c.fase === "ficha" || c.fase === "sin_ficha" },
  ];
  return (
    <div className="flex flex-col gap-8">
      <Cabecera titulo="Biblioteca" texto="Todos tus carruseles, por estado." />
      {lista === null ? <Panel><p style={{ color: "var(--fg-muted)" }}>Cargando…</p></Panel> : lista.length === 0 ? <Panel><p style={{ color: "var(--fg-muted)" }}>Todavía no hay carruseles.</p></Panel> :
        grupos.map((g) => {
          const items = lista.filter(g.filtro).sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
          if (!items.length) return null;
          return (
            <section key={g.titulo} className="aparece">
              <h2 className="mb-3 text-[18px] font-semibold">{g.titulo} <span style={{ color: "var(--fg-faint)" }}>· {items.length}</span></h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((c) => <Tarjeta key={c.nombre} c={c} />)}</div>
            </section>
          );
        })}
    </div>
  );
}
