"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { llamar, postJson } from "@/lib/llamar";

export type Herramienta = "claude" | "codex";

/** Inicia sesión de Claude o Codex desde la app: abre el navegador y espera a que termine (comprueba cada 3 segundos).
 *  iniciar() también sirve para reintentar si se cerró la ventana del navegador. */
export function useConexion(herramienta: Herramienta, alConectar?: () => void) {
  const [fase, setFase] = useState<"inicial" | "esperando" | "listo">("inicial");
  const [error, setError] = useState("");
  const final = useRef(alConectar);
  useEffect(() => { final.current = alConectar; }, [alConectar]);

  useEffect(() => {
    if (fase !== "esperando") return;
    const t = setInterval(async () => {
      const { ok, datos } = await llamar<{ conectado: boolean }>(`/api/claude?herramienta=${herramienta}`, { cache: "no-store" });
      if (ok && datos.conectado) { setFase("listo"); final.current?.(); }
    }, 3000);
    return () => clearInterval(t);
  }, [fase, herramienta]);

  const iniciar = useCallback(async () => {
    setError("");
    const { ok, datos } = await llamar("/api/claude", postJson({ herramienta }));
    if (!ok) { setError(datos.error ?? "No se pudo abrir el inicio de sesión"); return; }
    setFase("esperando");
  }, [herramienta]);

  return { fase, error, iniciar };
}
