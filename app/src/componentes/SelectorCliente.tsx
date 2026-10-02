"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { recargarSinIntro } from "@/lib/navegacion";

type Perfil = { id: string; nombre: string; handle: string; azul: string; foto: string; carruseles: number; activo: boolean; completo: boolean };

/** Recarga la app en Inicio: todas las pantallas vuelven a pedir sus datos ya con el cliente nuevo. */
function irAInicio(ruta = "/") { recargarSinIntro(ruta); }

function Avatar({ p, tam = 34 }: { p: Perfil; tam?: number }) {
  const [fallo, setFallo] = useState(false);
  const estilo = { width: tam, height: tam, background: p.azul, boxShadow: `0 6px 18px -8px ${p.azul}` };
  if (p.foto && !fallo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/perfiles?foto=${p.id}`} alt="" className="shrink-0 rounded-full object-cover" style={estilo} onError={() => setFallo(true)} />;
  }
  return <span className="grid shrink-0 place-items-center rounded-full text-[14px] font-bold text-white" style={estilo}>{p.nombre.trim()[0]?.toUpperCase() ?? "?"}</span>;
}

/** Selector del cliente activo, en la barra lateral. Cada cliente tiene su marca y su biblioteca. */
export function SelectorCliente({ compacto = false }: { compacto?: boolean }) {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/perfiles", { cache: "no-store" }).then((r) => r.json()).then((d: { perfiles: Perfil[] }) => { if (vivo) setPerfiles(d.perfiles ?? []); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("pointerdown", fuera); document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);

  const activo = perfiles.find((p) => p.activo);
  async function activar(id: string) {
    setOcupado(true);
    await fetch("/api/perfiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "activar", id }) });
    irAInicio();
  }
  async function nuevo() {
    setOcupado(true);
    // se crea con un nombre provisional; la bienvenida pregunta el de verdad
    const r = await fetch("/api/perfiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "crear", nombre: "Nuevo cliente" }) });
    if (r.ok) irAInicio("/bienvenida"); else setOcupado(false);
  }

  if (!activo) return null;
  return (
    <div ref={caja} className={`relative ${compacto ? "" : "mb-5"}`}>
      <button type="button" className="vidrio-suave flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors hover:bg-white/5" style={{ borderColor: "var(--border)" }}
        onClick={() => setAbierto((a) => !a)} aria-haspopup="listbox" aria-expanded={abierto} disabled={ocupado}>
        <Avatar p={activo} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[14px] font-semibold">{activo.nombre}</span>
          <span className="block truncate text-[12px]" style={{ color: activo.completo ? "var(--fg-muted)" : "var(--warn, #fbbf24)" }}>{activo.completo ? activo.handle : "Marca sin completar"}</span>
        </span>
        <ChevronsUpDown size={16} style={{ color: "var(--fg-muted)" }} />
      </button>
      {!activo.completo && !abierto && (
        <Link href="/bienvenida" className="mt-2 block rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-colors hover:bg-white/5" style={{ color: "var(--accent)" }}>Completar su marca →</Link>
      )}
      {abierto && (
        <div className="modal absolute left-0 right-0 top-full z-40 mt-2 p-2" role="listbox" aria-label="Clientes">
          <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-faint)" }}>Clientes</p>
          {perfiles.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={p.activo} disabled={ocupado}
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/5"
              onClick={() => (p.activo ? setAbierto(false) : void activar(p.id))}>
              <Avatar p={p} tam={28} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13.5px] font-semibold">{p.nombre}</span>
                <span className="block truncate text-[11.5px]" style={{ color: p.completo ? "var(--fg-muted)" : "var(--warn, #fbbf24)" }}>{p.completo ? `${p.carruseles} ${p.carruseles === 1 ? "carrusel" : "carruseles"}` : "Marca sin completar"}</span>
              </span>
              {p.activo && <Check size={16} style={{ color: "var(--accent)" }} />}
            </button>
          ))}
          <div className="my-1 h-px" style={{ background: "var(--border)" }} />
          <button type="button" disabled={ocupado} className="flex w-full items-center gap-3 rounded-xl p-2 text-left text-[13.5px] font-semibold transition-colors hover:bg-white/5" style={{ color: "var(--accent)" }} onClick={() => void nuevo()}>
            <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "var(--accent-soft)" }}><Plus size={16} /></span>
            Nuevo cliente
          </button>
        </div>
      )}
    </div>
  );
}
