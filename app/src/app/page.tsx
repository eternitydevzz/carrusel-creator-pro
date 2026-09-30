"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2, FileText, Loader2 } from "lucide-react";
import { Aviso, Cabecera, Campo, Panel, Pastilla, faseTexto, faseTono } from "@/componentes/ui";
import type { Resumen } from "@/lib/motor";

export default function Inicio() {
  const router = useRouter();
  const [modo, setModo] = useState<"link" | "guion">("link");
  const [url, setUrl] = useState("");
  const [nombre, setNombre] = useState("");
  const [guion, setGuion] = useState("");
  const [redactar, setRedactar] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [lista, setLista] = useState<Resumen[]>([]);

  useEffect(() => { fetch("/api/carruseles").then((r) => r.json()).then(setLista).catch(() => {}); }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault(); setError(""); setOcupado(true);
    try {
      const r = await fetch("/api/nuevo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modo, url, nombre, guion, redactar }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "No se pudo crear"); return; }
      router.push(`/carrusel/${d.nombre}`);
    } catch { setError("No hay conexión con la app"); } finally { setOcupado(false); }
  }

  const recientes = [...lista].sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? "")).slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <Cabecera titulo="Crear carrusel" texto="Pega el link de un carrusel de Instagram o tu propio guion. La ficha la revisas tú antes de gastar una sola imagen." />

      <Panel fuerte className="aparece">
        <div className="mb-5 flex gap-2" role="tablist" aria-label="Forma de empezar">
          <button type="button" role="tab" aria-selected={modo === "link"} className={`boton ${modo === "link" ? "boton-primario" : ""}`} onClick={() => setModo("link")}><Link2 size={16} /> Desde un link</button>
          <button type="button" role="tab" aria-selected={modo === "guion"} className={`boton ${modo === "guion" ? "boton-primario" : ""}`} onClick={() => setModo("guion")}><FileText size={16} /> Con mi guion</button>
        </div>

        <form onSubmit={crear} className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-4">
            {modo === "link" ? (
              <>
                <Campo etiqueta="Link del carrusel original" ayuda="Se descargan sus slides con ScrapeCreators (1 crédito) y Claude redacta la ficha en español con tu ángulo.">
                  <input className="campo" placeholder="https://www.instagram.com/p/…" value={url} onChange={(e) => setUrl(e.target.value)} required inputMode="url" />
                </Campo>
                <label className="flex items-center gap-3 text-[14px]">
                  <input type="checkbox" checked={redactar} onChange={(e) => setRedactar(e.target.checked)} className="h-4 w-4 accent-[#1a79fb]" />
                  Que Claude redacte la ficha (si lo desmarcas, la escribes tú)
                </label>
              </>
            ) : (
              <Campo etiqueta="Tu guion" ayuda='Un bloque por slide, empezando cada uno con "SLIDE 1", "SLIDE 2"… El titular sale del texto de cada bloque.'>
                <textarea className="campo" rows={12} value={guion} onChange={(e) => setGuion(e.target.value)} placeholder={"SLIDE 1\nEstos son los mejores repositorios de GitHub que puedes instalar y vender a empresas en USA…\n\nSLIDE 2\n1. DocuSeal · 19k estrellas…"} required />
              </Campo>
            )}
          </div>
          <div className="grid content-start gap-4">
            <Campo etiqueta="Nombre" ayuda={modo === "link" ? "Opcional. Si lo dejas vacío, se usa el código del post." : "Letras, números y guiones."}>
              <input className="campo" placeholder="11_equipo_marketing" value={nombre} onChange={(e) => setNombre(e.target.value)} required={modo === "guion"} />
            </Campo>
            <button className="boton boton-primario mt-2" disabled={ocupado} type="submit">
              {ocupado ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {ocupado ? (modo === "link" ? "Descargando…" : "Creando…") : "Crear carrusel"}
            </button>
            {error && <Aviso tono="danger">{error}</Aviso>}
          </div>
        </form>
      </Panel>

      <section className="aparece" style={{ animationDelay: "80ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold">Recientes</h2>
          <Link href="/biblioteca" className="boton boton-fantasma">Ver todos <ArrowRight size={14} /></Link>
        </div>
        {recientes.length === 0 ? (
          <Panel><p style={{ color: "var(--fg-muted)" }}>Todavía no hay carruseles. El primero empieza arriba.</p></Panel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recientes.map((c) => <Tarjeta key={c.nombre} c={c} />)}
          </div>
        )}
      </section>
    </div>
  );
}

export function Tarjeta({ c }: { c: Resumen }) {
  const portada = c.cerrado ? `salida/${c.nombre}/1.jpg` : c.generados > 0 ? `salida/${c.nombre}/1.png` : c.original ? `virales/${c.nombre}/slide_01.jpg` : null;
  return (
    <Link href={`/carrusel/${c.nombre}`} className="vidrio group block overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
      <div className="aspect-[4/3] w-full overflow-hidden" style={{ background: "rgba(0,0,0,0.3)" }}>
        {portada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/archivo?ruta=${encodeURIComponent(portada)}`} alt="" className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : <div className="grid h-full place-items-center text-[13px]" style={{ color: "var(--fg-faint)" }}>Sin imágenes todavía</div>}
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold">{c.nombre}</div>
          <div className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>{c.slides ? `${c.slides} slides` : "—"}{c.cta ? ` · ${c.cta}` : ""}</div>
        </div>
        <Pastilla tono={faseTono[c.fase]}>{faseTexto[c.fase]}</Pastilla>
      </div>
    </Link>
  );
}
