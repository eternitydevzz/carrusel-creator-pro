"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Una imagen a pantalla completa, con flechas (en pantalla y en el teclado) para pasar a la anterior o la siguiente. */
export function Visor({ src, alt, posicion, total, onMover, onCerrar }: { src: string; alt: string; posicion: number; total: number; onMover: (paso: -1 | 1) => void; onCerrar: () => void }) {
  const hayAnterior = posicion > 0;
  const haySiguiente = posicion < total - 1;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hayAnterior) { e.preventDefault(); onMover(-1); }
      if (e.key === "ArrowRight" && haySiguiente) { e.preventDefault(); onMover(1); }
    };
    window.addEventListener("keydown", tecla); return () => window.removeEventListener("keydown", tecla);
  }, [hayAnterior, haySiguiente, onMover]);

  const flecha = "absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border text-white transition-opacity hover:opacity-100";
  const estilo = { background: "rgba(10,16,30,0.7)", borderColor: "var(--border)", opacity: 0.85 };

  return (
    <div className="telon fixed inset-0 z-50 grid place-items-center p-4" onClick={onCerrar}>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-[92dvh] rounded-2xl" style={{ boxShadow: "0 40px 100px -30px rgba(0,0,0,0.9)" }} />
        {hayAnterior && <button className={`${flecha} left-3`} style={estilo} onClick={() => onMover(-1)} aria-label="Slide anterior"><ChevronLeft size={26} /></button>}
        {haySiguiente && <button className={`${flecha} right-3`} style={estilo} onClick={() => onMover(1)} aria-label="Slide siguiente"><ChevronRight size={26} /></button>}
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[13px] text-white" style={{ background: "rgba(10,16,30,0.7)" }}>{posicion + 1} / {total}</span>
      </div>
    </div>
  );
}
