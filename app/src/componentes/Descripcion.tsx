"use client";

import { llamar as api, postJson } from "@/lib/llamar";
import { useEffect, useState } from "react";
import { Check, Copy, FileText, Layers, Loader2, RefreshCw, Save } from "lucide-react";
import { Aviso, Panel } from "@/componentes/ui";
import { Variaciones } from "@/componentes/Variaciones";
import { AvisoClaude } from "@/componentes/AvisoClaude";

type Estado = { estado: string; salida: string } | null;

/** Descripción de Instagram del carrusel: la escribe Claude Code (carrusel.sh descripcion) y aquí se edita y se copia. */
export function Descripcion({ nombre, texto, estado, variaciones, estadoVariaciones, recargar }: { nombre: string; texto: string; estado: Estado; variaciones: string[]; estadoVariaciones: Estado; recargar: () => Promise<void> }) {
  const [editado, setEditado] = useState("");
  const [sucio, setSucio] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "danger"; texto: string } | null>(null);
  const escribiendo = estado?.estado === "en_curso";
  const variando = estadoVariaciones?.estado === "en_curso";

  // mientras no hay cambios sin guardar, la caja muestra lo que hay en el servidor
  const borrador = sucio ? editado : texto;
  useEffect(() => { if (!escribiendo && !variando) return; const t = setInterval(() => { void recargar(); }, 3000); return () => clearInterval(t); }, [escribiendo, variando, recargar]);

  async function llamar(cuerpo: Record<string, unknown>) {
    setAviso(null);
    const { ok, datos: res } = await api(`/api/carrusel/${nombre}/accion`, postJson(cuerpo));
    if (!ok) { setAviso({ tono: "danger", texto: res.error ?? "No se pudo" }); return false; }
    return true;
  }
  async function crear() {
    if (sucio && !confirm("Tienes cambios sin guardar en la descripción. ¿Escribir una nueva y perderlos?")) return;
    setSucio(false);
    if (await llamar({ accion: "descripcion" })) await recargar();
  }
  async function variar() {
    if (variaciones.length && !confirm("¿Escribir 5 variaciones nuevas? Las que hay ahora se sustituyen.")) return;
    if (sucio) { setAviso({ tono: "danger", texto: "Guarda antes los cambios de la descripción: las variaciones salen de la versión guardada." }); return; }
    if (await llamar({ accion: "variaciones" })) await recargar();
  }
  async function guardar() {
    if (await llamar({ accion: "guardar_descripcion", texto: borrador })) { setSucio(false); setAviso({ tono: "ok", texto: "Guardada." }); await recargar(); }
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(borrador); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setAviso({ tono: "danger", texto: "El navegador no dejó copiar. Selecciona el texto y cópialo a mano." }); }
  }

  const caracteres = borrador.trim().length;
  const hashtags = (borrador.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;

  return (
    <Panel fuerte className="aparece">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold">Descripción para Instagram</h2>
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>La escribe Claude a partir de la ficha. Los 5 hashtags los propone Claude: no están medidos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {texto ? (
            <>
              <button className="boton" disabled={escribiendo} onClick={crear}>{escribiendo ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} Rehacer</button>
              {sucio && <button className="boton" onClick={guardar}><Save size={16} /> Guardar</button>}
              <button className="boton" disabled={escribiendo || variando} onClick={variar}>{variando ? <Loader2 className="animate-spin" size={16} /> : <Layers size={16} />} {variando ? "Escribiendo variaciones…" : variaciones.length ? "Rehacer variaciones" : "Crear 5 variaciones"}</button>
              <button className="boton boton-primario" disabled={escribiendo || !borrador.trim()} onClick={copiar}>{copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? "Copiada" : "Copiar"}</button>
            </>
          ) : (
            <button className="boton boton-primario" disabled={escribiendo} onClick={crear}>{escribiendo ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />} {escribiendo ? "Escribiendo…" : "Crear descripción"}</button>
          )}
        </div>
      </div>
      {escribiendo && <Aviso tono="info">Claude está escribiendo la descripción. Tarda unos 15–30 segundos.</Aviso>}
      {estado?.estado === "error" && !escribiendo && <div className="mb-3"><AvisoClaude salida={estado.salida} /></div>}
      {variando && <div className="mb-3"><Aviso tono="info">Claude está escribiendo las 5 variaciones. Tarda unos 30–60 segundos.</Aviso></div>}
      {estadoVariaciones?.estado === "error" && !variando && <div className="mb-3"><AvisoClaude salida={estadoVariaciones.salida} /></div>}
      {aviso && <div className="mb-3"><Aviso tono={aviso.tono}>{aviso.texto}</Aviso></div>}
      {texto && (
        <>
          <textarea className="campo" rows={14} value={borrador} onChange={(e) => { setEditado(e.target.value); setSucio(true); }} aria-label="Descripción para Instagram" />
          <p className="mt-2 text-[12.5px]" style={{ color: caracteres > 2200 || hashtags !== 5 ? "var(--danger, #e5484d)" : "var(--fg-faint)" }}>
            {caracteres} de 2.200 caracteres · {hashtags} hashtags{sucio ? " · cambios sin guardar" : ""}
          </p>
        </>
      )}
      {texto && variaciones.length > 0 && <Variaciones nombre={nombre} textos={variaciones} recargar={recargar} />}
    </Panel>
  );
}
