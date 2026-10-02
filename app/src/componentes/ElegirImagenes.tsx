"use client";

import { llamar, postJson } from "@/lib/llamar";
import { useState } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { Aviso, Panel } from "@/componentes/ui";

/** Codex rehízo alguna imagen y generó más que slides: se elige la buena de cada slide, en orden, sin gastar imágenes. */
export function ElegirImagenes({ nombre, archivos, slides, img, onHecho }: { nombre: string; archivos: string[]; slides: number; img: (ruta: string) => string; onHecho: () => Promise<void> }) {
  const [orden, setOrden] = useState<number[]>([]); // números de imagen elegidos, uno por slide
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const numero = (f: string) => Number(/orden_(\d+)\.png$/.exec(f)?.[1] ?? 0);

  function pulsar(n: number) {
    setError("");
    setOrden((o) => (o.includes(n) ? o.filter((x) => x !== n) : o.length < slides ? [...o, n] : o));
  }
  async function usar() {
    setGuardando(true); setError("");
    try {
      const { ok, datos } = await llamar(`/api/carrusel/${nombre}/accion`, postJson({ accion: "elegir", lista: orden }));
      if (!ok) { setError(datos.error ?? "No se pudieron colocar"); return; }
      await onHecho();
    } finally { setGuardando(false); }
  }

  return (
    <Panel fuerte className="aparece">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold">Codex rehízo alguna imagen: elige la buena de cada slide</h2>
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
            Generó {archivos.length} imágenes para {slides} slides (repite las que no le convencían). Pulsa, en orden, la del slide 1, la del 2… No gasta imágenes.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="boton" onClick={() => setOrden([])} disabled={!orden.length || guardando}><RotateCcw size={16} /> Empezar de nuevo</button>
          <button className="boton boton-primario" onClick={() => void usar()} disabled={orden.length !== slides || guardando}>{guardando ? <><Loader2 className="animate-spin" size={16} /> Colocando…</> : <><Check size={16} /> Usar estas ({orden.length}/{slides})</>}</button>
        </div>
      </div>
      {error && <div className="mb-4"><Aviso tono="danger"><pre className="whitespace-pre-wrap font-sans">{error}</pre></Aviso></div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {archivos.map((f) => {
          const n = numero(f);
          const pos = orden.indexOf(n);
          return (
            <button key={f} type="button" onClick={() => pulsar(n)} className="vidrio-suave relative overflow-hidden rounded-[16px] border text-left transition-transform hover:-translate-y-0.5"
              style={{ borderColor: pos >= 0 ? "var(--accent)" : "var(--border)", boxShadow: pos >= 0 ? "0 0 0 2px var(--accent), 0 10px 30px -10px var(--accent-glow)" : undefined }}
              aria-pressed={pos >= 0} aria-label={pos >= 0 ? `Imagen ${n}: slide ${pos + 1}` : `Imagen ${n}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(`salida/${nombre}/_revisar/${f}`)} alt={`Imagen ${n}`} className="w-full" style={{ aspectRatio: "4/5", objectFit: "cover" }} />
              <span className="flex items-center justify-between p-3 text-[13px] font-semibold">
                <span>Imagen {n}</span>
                {pos >= 0 && <span className="rounded-full px-2.5 py-0.5 text-[12px] text-white" style={{ background: "var(--accent)" }}>Slide {pos + 1}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
