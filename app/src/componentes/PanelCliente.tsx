"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Trash2 } from "lucide-react";
import { Aviso, Campo, Panel } from "@/componentes/ui";
import { avisarPerfilesCambiados, recargarSinIntro } from "@/lib/navegacion";

type Perfil = { id: string; nombre: string; activo: boolean };
type Ubicacion = Record<string, string | number>;
const CAMPOS_UBI = [["ciudad", "Ciudad"], ["estado", "Estado / provincia"], ["pais", "País"], ["codigo", "Código de país"], ["lat", "Latitud"], ["lon", "Longitud"]] as const;

/** En Branding: nombre del cliente activo, su ubicación para los metadatos y eliminarlo (va a la papelera). */
export function PanelCliente() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [nombre, setNombre] = useState("");
  const [ubi, setUbi] = useState<Ubicacion>({});
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "danger"; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([fetch("/api/perfiles", { cache: "no-store" }).then((r) => r.json()), fetch("/api/ajustes", { cache: "no-store" }).then((r) => r.json())])
      .then(([p, a]: [{ perfiles: Perfil[] }, { ubicacion: Ubicacion }]) => {
        if (!vivo) return;
        setPerfiles(p.perfiles ?? []);
        setNombre(p.perfiles?.find((x) => x.activo)?.nombre ?? "");
        setUbi(a.ubicacion ?? {});
      }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const activo = perfiles.find((p) => p.activo);
  if (!activo) return null;

  async function guardar() {
    if (!activo) return;
    setGuardando(true); setAviso(null);
    try {
      const r1 = await fetch("/api/perfiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "renombrar", id: activo.id, nombre }) });
      if (!r1.ok) throw new Error((await r1.json()).error ?? "No se pudo guardar el nombre");
      const lat = Number(ubi.lat), lon = Number(ubi.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("La latitud y la longitud tienen que ser números");
      await fetch("/api/ajustes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ubicacion: { ...ubi, lat, lon } }) });
      setAviso({ tono: "ok", texto: "Guardado." });
      avisarPerfilesCambiados();
    } catch (e) { setAviso({ tono: "danger", texto: (e as Error).message }); } finally { setGuardando(false); }
  }

  async function eliminar() {
    if (!activo) return;
    if (!confirm(`¿Eliminar el cliente "${activo.nombre}"? Su marca y sus carruseles se mueven a la papelera (datos/_papelera) y dejan de verse en la app.`)) return;
    const r = await fetch("/api/perfiles", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activo.id }) });
    if (!r.ok) { setAviso({ tono: "danger", texto: (await r.json()).error ?? "No se pudo eliminar" }); return; }
    recargarSinIntro("/");
  }

  return (
    <Panel className="aparece">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold">Cliente</h2>
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Cada cliente tiene su marca y sus carruseles. La ubicación es la que se escribe en los metadatos al cerrar sus carruseles.</p>
        </div>
        <div className="flex gap-2">
          <button className="boton boton-peligro" onClick={() => void eliminar()} disabled={perfiles.length <= 1} title={perfiles.length <= 1 ? "Es el único cliente" : "Mover a la papelera"}><Trash2 size={16} /> Eliminar cliente</button>
          <button className="boton boton-primario" onClick={() => void guardar()} disabled={guardando || !nombre.trim()}>{guardando ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Guardar</button>
        </div>
      </div>
      {aviso && <div className="mb-4"><Aviso tono={aviso.tono}>{aviso.texto}</Aviso></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Campo etiqueta="Nombre del cliente" ayuda="Es como sale en el selector de clientes."><input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo></div>
        {CAMPOS_UBI.map(([k, etiqueta]) => (
          <Campo key={k} etiqueta={etiqueta}><input className="campo" value={String(ubi[k] ?? "")} onChange={(e) => setUbi({ ...ubi, [k]: e.target.value })} /></Campo>
        ))}
      </div>
    </Panel>
  );
}
