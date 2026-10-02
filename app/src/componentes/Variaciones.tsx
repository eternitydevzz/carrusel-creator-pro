"use client";

import { llamar, postJson } from "@/lib/llamar";
import { useState } from "react";
import { Check, Copy, Save } from "lucide-react";
import { Aviso } from "@/componentes/ui";

const GANCHOS = ["Dato", "Pregunta", "Problema", "Promesa", "Curiosidad"];

/** Las 5 variaciones de la descripción (carrusel.sh variaciones): cada una editable y con su botón de copiar. */
export function Variaciones({ nombre, textos, recargar }: { nombre: string; textos: string[]; recargar: () => Promise<void> }) {
  const [editados, setEditados] = useState<string[]>([]);
  const [sucio, setSucio] = useState(false);
  const [copiada, setCopiada] = useState<number | null>(null);
  const [aviso, setAviso] = useState<{ tono: "ok" | "danger"; texto: string } | null>(null);

  // mientras no hay cambios sin guardar, las cajas muestran lo que hay en el servidor
  const actuales = sucio ? editados : textos;

  function cambiar(i: number, v: string) {
    const base = sucio ? editados : textos;
    setEditados(base.map((t, j) => (j === i ? v : t))); setSucio(true);
  }
  async function guardar() {
    setAviso(null);
    const { ok, datos: res } = await llamar(`/api/carrusel/${nombre}/accion`, postJson({ accion: "guardar_variaciones", textos: actuales }));
    if (!ok) { setAviso({ tono: "danger", texto: res.error ?? "No se pudo" }); return; }
    setSucio(false); setAviso({ tono: "ok", texto: "Variaciones guardadas." }); await recargar();
  }
  async function copiar(i: number) {
    try { await navigator.clipboard.writeText(actuales[i]); setCopiada(i); setTimeout(() => setCopiada(null), 2000); }
    catch { setAviso({ tono: "danger", texto: "El navegador no dejó copiar. Selecciona el texto y cópialo a mano." }); }
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold">5 variaciones</h3>
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Cada una abre con otro gancho y lleva otra combinación de hashtags, para probar cuál funciona mejor.</p>
        </div>
        {sucio && <button className="boton" onClick={guardar}><Save size={16} /> Guardar variaciones</button>}
      </div>
      {aviso && <div className="mb-3"><Aviso tono={aviso.tono}>{aviso.texto}</Aviso></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        {actuales.map((t, i) => {
          const hashtags = (t.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
          const largo = t.trim().length;
          return (
            <div key={i} className="vidrio-suave rounded-[16px] border p-4" style={{ borderColor: "var(--border)" }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-semibold">Variación {i + 1}{GANCHOS[i] ? <span style={{ color: "var(--fg-faint)" }}> · {GANCHOS[i]}</span> : null}</span>
                <button className="boton boton-fantasma" style={{ minHeight: 36 }} disabled={!t.trim()} onClick={() => copiar(i)}>{copiada === i ? <Check size={16} /> : <Copy size={16} />} {copiada === i ? "Copiada" : "Copiar"}</button>
              </div>
              <textarea className="campo" rows={10} value={t} onChange={(e) => cambiar(i, e.target.value)} aria-label={`Variación ${i + 1}`} />
              <p className="mt-2 text-[12.5px]" style={{ color: largo > 2200 || hashtags !== 5 ? "var(--danger)" : "var(--fg-faint)" }}>{largo} de 2.200 caracteres · {hashtags} hashtags</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
