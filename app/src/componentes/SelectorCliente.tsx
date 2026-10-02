"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { EVENTO_PERFILES, avisarPerfilesCambiados, recargarSinIntro } from "@/lib/navegacion";
import { llamar } from "@/lib/llamar";

type Perfil = { id: string; nombre: string; handle: string; azul: string; foto: string; carruseles: number; activo: boolean; completo: boolean };

/** Recarga la app en Inicio: todas las pantallas vuelven a pedir sus datos ya con el cliente nuevo. */
function irAInicio(ruta = "/") { recargarSinIntro(ruta); }

function Avatar({ p, tam = 34 }: { p: Perfil; tam?: number }) {
  const [fallo, setFallo] = useState(false);
  const estilo = { width: tam, height: tam, background: p.azul, boxShadow: `0 6px 18px -8px ${p.azul}` };
  if (p.foto && !fallo) {
    // la foto va en la dirección: si cambia, la dirección cambia y se ve la nueva (con la misma, se quedaba la anterior)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/perfiles?foto=${p.id}&v=${encodeURIComponent(p.foto)}`} alt="" className="shrink-0 rounded-full object-cover" style={estilo} onError={() => setFallo(true)} />;
  }
  return <span className="grid shrink-0 place-items-center rounded-full text-[14px] font-bold text-white" style={estilo}>{p.nombre.trim()[0]?.toUpperCase() ?? "?"}</span>;
}

/** Selector del cliente activo, en la barra lateral. Cada cliente tiene su marca y su biblioteca. */
export function SelectorCliente({ compacto = false }: { compacto?: boolean }) {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const ruta = usePathname();

  // se vuelve a leer al cambiar de pantalla (p. ej. al terminar la bienvenida de un cliente nuevo) y cuando
  // Branding avisa de que ha guardado (nombre o fotos): así el selector nunca enseña datos viejos sin recargar
  useEffect(() => {
    let vivo = true;
    const leer = () => fetch("/api/perfiles", { cache: "no-store" }).then((r) => r.json()).then((d: { perfiles: Perfil[] }) => { if (vivo) setPerfiles(d.perfiles ?? []); }).catch(() => {});
    void leer();
    window.addEventListener(EVENTO_PERFILES, leer);
    return () => { vivo = false; window.removeEventListener(EVENTO_PERFILES, leer); };
  }, [ruta]);
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
  // borrar cualquier cliente desde aquí, sin activarlo antes: va a la papelera (datos/_papelera), no se pierde
  async function eliminar(p: Perfil) {
    if (!confirm(`¿Eliminar el cliente "${p.nombre}"${p.carruseles ? ` y sus ${p.carruseles} ${p.carruseles === 1 ? "carrusel" : "carruseles"}` : ""}? Se mueve a la papelera (datos/_papelera) y deja de verse en la app.`)) return;
    setOcupado(true);
    const { ok, datos } = await llamar(`/api/perfiles`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) });
    if (!ok) { setOcupado(false); alert(datos.error ?? "No se pudo eliminar"); return; }
    if (p.activo) { irAInicio(); return; } // era el activo: la app pasa a otro cliente
    setPerfiles((l) => l.filter((x) => x.id !== p.id)); setOcupado(false); avisarPerfilesCambiados();
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
        <Avatar key={activo.foto} p={activo} />
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
            <div key={p.id} className="group flex items-center gap-1 rounded-xl transition-colors hover:bg-white/5">
              <button type="button" role="option" aria-selected={p.activo} disabled={ocupado}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left"
                onClick={() => (p.activo ? setAbierto(false) : void activar(p.id))}>
                <Avatar key={p.foto} p={p} tam={28} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[13.5px] font-semibold">{p.nombre}</span>
                  <span className="block truncate text-[11.5px]" style={{ color: p.completo ? "var(--fg-muted)" : "var(--warn, #fbbf24)" }}>{p.completo ? `${p.carruseles} ${p.carruseles === 1 ? "carrusel" : "carruseles"}` : "Marca sin completar"}</span>
                </span>
                {p.activo && <Check size={16} style={{ color: "var(--accent)" }} />}
              </button>
              {perfiles.length > 1 && (
                <button type="button" disabled={ocupado} onClick={() => void eliminar(p)}
                  className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg opacity-50 transition hover:bg-white/10 hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Eliminar el cliente ${p.nombre}`} title="Eliminar cliente (va a la papelera)" style={{ color: "var(--danger, #f87171)" }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
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
