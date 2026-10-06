"use client";

import { Loader2, LogIn } from "lucide-react";
import { Aviso } from "@/componentes/ui";
import { useConexion } from "@/lib/useConexion";

const MARCA = "SESION_CLAUDE_CADUCADA";

/** Error de una orden que usa Claude. Si la causa es la sesión caducada, en vez del texto técnico ofrece iniciar sesión
 *  desde aquí (abre el navegador con `claude auth login`) y avisa cuando ya está conectada. */
export function AvisoClaude({ salida, recorte = 0, titulo }: { salida: string; recorte?: number; titulo?: string }) {
  const { fase, error, iniciar } = useConexion("claude");

  if (!salida.includes(MARCA)) {
    const texto = recorte ? salida.trim().split("\n").slice(-recorte).join("\n") : salida;
    return <Aviso tono="danger">{titulo && <div className="mb-1 font-semibold">{titulo}</div>}<pre className="whitespace-pre-wrap font-sans">{texto}</pre></Aviso>;
  }
  if (fase === "listo") return <Aviso tono="ok">Sesión de Claude iniciada. Vuelve a pulsar el botón para redactar.</Aviso>;
  return (
    <Aviso tono="danger">
      <div className="mb-1 font-semibold">{titulo ?? "Tu sesión de Claude caducó"}</div>
      <div className="mb-3">Para que Claude pueda redactar hay que iniciar sesión otra vez. Se abre el navegador: entra con tu cuenta y vuelve aquí.</div>
      {fase === "esperando"
        ? <div className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Esperando a que termines el inicio de sesión en el navegador…</span><button className="boton" onClick={iniciar}>¿Cerraste la ventana? Abrir de nuevo</button></div>
        : <button className="boton boton-primario" onClick={iniciar}><LogIn size={16} /> Iniciar sesión de Claude</button>}
      {error && <div className="mt-2">{error}</div>}
    </Aviso>
  );
}
