import type { ReactNode } from "react";

export function Panel({ children, className = "", fuerte = false }: { children: ReactNode; className?: string; fuerte?: boolean }) {
  return <section className={`vidrio ${fuerte ? "vidrio-fuerte" : ""} p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function Cabecera({ titulo, texto, derecha }: { titulo: string; texto?: string; derecha?: ReactNode }) {
  return (
    <header className="aparece mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight sm:text-[32px]">{titulo}</h1>
        {texto && <p className="mt-1 max-w-2xl text-[15px]" style={{ color: "var(--fg-muted)" }}>{texto}</p>}
      </div>
      {derecha}
    </header>
  );
}

export function Pastilla({ children, tono = "" }: { children: ReactNode; tono?: "" | "ok" | "warn" | "danger" | "accent" }) {
  return <span className={`pastilla ${tono ? `pastilla-${tono}` : ""}`}>{children}</span>;
}

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="etiqueta mb-2 block">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1.5 block text-[12.5px]" style={{ color: "var(--fg-faint)" }}>{ayuda}</span>}
    </label>
  );
}

export function Aviso({ tono, children }: { tono: "ok" | "warn" | "danger" | "info"; children: ReactNode }) {
  const color = tono === "ok" ? "var(--ok)" : tono === "warn" ? "var(--warn)" : tono === "danger" ? "var(--danger)" : "#8ec0ff";
  return (
    <div className="vidrio-suave rounded-[14px] border px-4 py-3 text-[13.5px] leading-relaxed" style={{ borderColor: color, color: "var(--fg)" }} role={tono === "danger" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export const faseTexto: Record<string, string> = { sin_ficha: "Sin ficha", ficha: "Ficha lista", generando: "Generando", revision: "En revisión", cerrado: "Cerrado" };
export const faseTono: Record<string, "" | "ok" | "warn" | "danger" | "accent"> = { sin_ficha: "", ficha: "accent", generando: "warn", revision: "warn", cerrado: "ok" };
