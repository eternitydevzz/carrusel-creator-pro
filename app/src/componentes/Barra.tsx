"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Images, Palette, Settings } from "lucide-react";
import { SelectorCliente } from "@/componentes/SelectorCliente";

const enlaces = [
  { href: "/", texto: "Inicio", Icono: Home },
  { href: "/biblioteca", texto: "Biblioteca", Icono: Images },
  { href: "/branding", texto: "Branding", Icono: Palette },
  { href: "/ajustes", texto: "Ajustes", Icono: Settings },
];

export function Barra() {
  const ruta = usePathname();
  const esActivo = (href: string) => (href === "/" ? ruta === "/" || ruta.startsWith("/carrusel") : ruta.startsWith(href));
  return (
    <>
    {/* ventanas estrechas (menos de 768 px): la barra lateral no cabe y va arriba, compacta */}
    <header className="vidrio sticky top-2 z-30 flex flex-col gap-3 p-3 md:hidden">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Inicio">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white" style={{ boxShadow: "0 0 14px rgba(0, 112, 248, 0.45)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/maestria.png" alt="Código MaestrIA" className="h-7 w-7 object-contain" />
          </span>
        </Link>
        <nav className="flex flex-1 justify-end gap-1" aria-label="Principal">
          {enlaces.map(({ href, texto, Icono }) => (
            <Link key={href} href={href} className="nav-item" style={{ padding: "8px 10px" }} data-activo={esActivo(href)} aria-current={esActivo(href) ? "page" : undefined} aria-label={texto} title={texto}>
              <Icono size={18} strokeWidth={2} />
            </Link>
          ))}
        </nav>
      </div>
      <SelectorCliente compacto />
    </header>
    <aside className="vidrio sticky top-4 hidden h-[calc(100dvh-2rem)] w-[232px] shrink-0 flex-col p-4 md:flex">
      <Link href="/" className="mb-6 flex items-center gap-3 px-2 pt-1">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white" style={{ boxShadow: "0 0 18px rgba(0, 112, 248, 0.45), 0 8px 20px rgba(0, 0, 0, 0.4)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/maestria.png" alt="Código MaestrIA" className="h-8 w-8 object-contain" />
        </span>
        <span className="leading-tight">
          <span className="block text-[15px] font-bold">Carrusel</span>
          <span className="block text-[13px] font-semibold" style={{ color: "var(--fg-muted)" }}>Creator Pro</span>
        </span>
      </Link>
      <SelectorCliente />
      <nav className="flex flex-col gap-1" aria-label="Principal">
        {enlaces.map(({ href, texto, Icono }) => {
          const activo = esActivo(href);
          return (
            <Link key={href} href={href} className="nav-item" data-activo={activo} aria-current={activo ? "page" : undefined}>
              <Icono size={18} strokeWidth={2} />
              {texto}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-2 text-[12px] leading-relaxed" style={{ color: "var(--fg-faint)" }}>
        Todo pasa en tu compu. Codex genera; nosotros estampamos el pie y limpiamos los metadatos.
      </div>
    </aside>
    </>
  );
}
