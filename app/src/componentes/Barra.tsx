"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Images, Palette, Settings, Sparkles } from "lucide-react";
import { SelectorCliente } from "@/componentes/SelectorCliente";

const enlaces = [
  { href: "/", texto: "Inicio", Icono: Home },
  { href: "/biblioteca", texto: "Biblioteca", Icono: Images },
  { href: "/branding", texto: "Branding", Icono: Palette },
  { href: "/ajustes", texto: "Ajustes", Icono: Settings },
];

export function Barra() {
  const ruta = usePathname();
  return (
    <aside className="vidrio sticky top-4 hidden h-[calc(100dvh-2rem)] w-[232px] shrink-0 flex-col p-4 md:flex">
      <Link href="/" className="mb-6 flex items-center gap-3 px-2 pt-1">
        <span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: "var(--accent)", boxShadow: "0 10px 30px -10px var(--accent-glow)" }}>
          <Sparkles size={20} strokeWidth={2.2} />
        </span>
        <span className="leading-tight">
          <span className="block text-[15px] font-bold">Carrusel</span>
          <span className="block text-[13px] font-semibold" style={{ color: "var(--fg-muted)" }}>Creator Pro</span>
        </span>
      </Link>
      <SelectorCliente />
      <nav className="flex flex-col gap-1" aria-label="Principal">
        {enlaces.map(({ href, texto, Icono }) => {
          const activo = href === "/" ? ruta === "/" || ruta.startsWith("/carrusel") : ruta.startsWith(href);
          return (
            <Link key={href} href={href} className="nav-item" data-activo={activo} aria-current={activo ? "page" : undefined}>
              <Icono size={18} strokeWidth={2} />
              {texto}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-2 text-[12px] leading-relaxed" style={{ color: "var(--fg-faint)" }}>
        Todo pasa en tu Mac. Codex genera; nosotros estampamos el pie y limpiamos los metadatos.
      </div>
    </aside>
  );
}
