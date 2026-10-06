"use client";

import { Check, Loader2, LogIn } from "lucide-react";
import { useConexion, type Herramienta } from "@/lib/useConexion";

/** Botón para conectar Claude o Codex desde la app (Ajustes): abre el navegador y avisa cuando termina. */
export function BotonConexion({ herramienta, alConectar }: { herramienta: Herramienta; alConectar?: () => void }) {
  const { fase, error, iniciar } = useConexion(herramienta, alConectar);
  const nombre = herramienta === "claude" ? "Claude" : "Codex";
  if (fase === "listo") return <span className="inline-flex items-center gap-2"><Check size={16} /> {nombre} conectado</span>;
  if (fase === "esperando") return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Esperando a que termines en el navegador…</span>
      <button className="boton" onClick={iniciar}>¿Cerraste la ventana? Abrir de nuevo</button>
    </div>
  );
  return <div><button className="boton boton-primario" onClick={iniciar}><LogIn size={16} /> Conectar {nombre}</button>{error && <p className="mt-2 text-[13px]">{error}</p>}</div>;
}
