"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Download, Loader2, RefreshCw, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { Aviso, Cabecera, Campo, Panel, Pastilla } from "@/componentes/ui";
import type { Ficha, Slide } from "@/lib/motor";

type Datos = {
  nombre: string; fichaTexto: string; ficha: Ficha | null; comprobacion: { ok: boolean; texto: string } | null;
  estado: { estado: string; orden: string[]; salida: string } | null; estadoFicha: { estado: string; salida: string } | null;
  slides: { n: number; png: boolean; jpg: boolean; version: number }[]; sinPie: number; cerrado: boolean; original: string[]; cupo: string;
};

const CASILLAS: { k: string; etiqueta: string; ayuda?: string; larga?: boolean }[] = [
  { k: "titular", etiqueta: "Titular", ayuda: 'Líneas entre comillas separadas por " / ". Portada y cierre: de 5 a 10 palabras.' },
  { k: "azul", etiqueta: "En azul", ayuda: "La parte del titular que va en el color de la marca." },
  { k: "arriba", etiqueta: "Texto pequeño arriba" },
  { k: "debajo", etiqueta: "Texto secundario", ayuda: "Máximo 95 caracteres: con más se mete en el pie.", larga: true },
  { k: "cta_grande", etiqueta: "Llamada a la acción grande" },
  { k: "idea", etiqueta: "Idea del original", ayuda: "Qué enseña ese slide y qué cuenta. Es la referencia visual.", larga: true },
  { k: "texto_escena", etiqueta: "Texto dentro de la escena", ayuda: 'Entre comillas y separados por comas, o "ninguno".', larga: true },
  { k: "manos", etiqueta: "Manos", ayuda: "Una sola acción." },
  { k: "expresion", etiqueta: "Expresión" },
  { k: "texto", etiqueta: "Texto libre del slide", ayuda: "Solo si no hay titular: el generador saca el titular de aquí.", larga: true },
];

export function Carrusel({ nombre }: { nombre: string }) {
  const [d, setD] = useState<Datos | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [sucia, setSucia] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "warn" | "danger" | "info"; texto: string } | null>(null);
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null);
  const [cambio, setCambio] = useState("");
  const [grande, setGrande] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const cargaInicial = useRef(true);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/carrusel/${nombre}`, { cache: "no-store" });
    if (!r.ok) return;
    const datos = (await r.json()) as Datos;
    setD(datos);
    if (cargaInicial.current || !sucia) { setFicha(datos.ficha); if (datos.ficha) cargaInicial.current = false; }
  }, [nombre, sucia]);

  useEffect(() => { void cargar(); }, [cargar]);
  const enCurso = d?.estado?.estado === "en_curso" || d?.estadoFicha?.estado === "en_curso";
  useEffect(() => {
    if (!enCurso) return;
    const t = setInterval(() => { void cargar(); }, 4000);
    return () => clearInterval(t);
  }, [enCurso, cargar]);

  const fase = useMemo(() => {
    if (!d) return "cargando";
    if (d.cerrado) return "cerrado";
    if (d.estado?.estado === "en_curso") return "generando";
    if (d.slides.some((s) => s.png)) return "revision";
    if (d.estadoFicha?.estado === "en_curso") return "redactando";
    if (d.ficha) return "ficha";
    return "sin_ficha";
  }, [d]);

  async function guardar(): Promise<boolean> {
    if (!ficha) return false;
    setGuardando(true);
    try {
      const r = await fetch(`/api/carrusel/${nombre}/ficha`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ficha }) });
      const res = await r.json();
      setSucia(false);
      setD((prev) => prev ? { ...prev, comprobacion: { ok: res.ok, texto: res.texto }, ficha: res.ficha } : prev);
      return !!res.ok;
    } finally { setGuardando(false); }
  }

  async function accion(cuerpo: Record<string, unknown>) {
    setOcupado(true); setMensaje(null);
    try {
      const r = await fetch(`/api/carrusel/${nombre}/accion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const res = await r.json();
      if (!r.ok) setMensaje({ tono: "danger", texto: res.error ?? "No se pudo" });
      else if (res.texto) setMensaje({ tono: res.ok ? "ok" : "warn", texto: res.texto });
      await cargar();
    } finally { setOcupado(false); }
  }

  async function generar() {
    if (sucia) { const ok = await guardar(); if (!ok) { setMensaje({ tono: "warn", texto: "La ficha tiene fallos. Corrígelos antes de generar." }); return; } }
    else if (d?.comprobacion && !d.comprobacion.ok) { setMensaje({ tono: "warn", texto: "La ficha tiene fallos. Corrígelos antes de generar." }); return; }
    await accion({ accion: "generar" });
  }

  async function borrar() {
    if (!confirm(`¿Borrar el carrusel "${nombre}" con su ficha, su original y sus imágenes? No se puede deshacer.`)) return;
    await fetch(`/api/carrusel/${nombre}`, { method: "DELETE" });
    window.location.href = "/";
  }

  function cambiarSlide(i: number, k: string, v: string) {
    setFicha((f) => { if (!f) return f; const slides = f.slides.map((s, j) => (j === i ? { ...s, [k]: v } : s)); return { ...f, slides }; });
    setSucia(true);
  }
  function cambiarCab(k: string, v: string) { setFicha((f) => (f ? { ...f, cabecera: { ...f.cabecera, [k]: v } } : f)); setSucia(true); }
  function añadirSlide() { setFicha((f) => (f ? { ...f, slides: [...f.slides, { titular: "", azul: "", idea: "", texto_escena: "ninguno", manos: "" } as Slide] } : f)); setSucia(true); }
  function quitarSlide(i: number) { setFicha((f) => (f ? { ...f, slides: f.slides.filter((_, j) => j !== i) } : f)); setSucia(true); }

  if (!d) return <Panel><p style={{ color: "var(--fg-muted)" }}>Cargando…</p></Panel>;

  const n = d.ficha ? Number(d.ficha.cabecera.slides) : d.slides.length;
  const progreso = fase === "generando" ? Math.min(100, Math.round(((d.sinPie || 0) / Math.max(n, 1)) * 100)) : 0;
  const img = (ruta: string) => `/api/archivo?ruta=${encodeURIComponent(ruta)}&t=${d.slides.reduce((a, s) => a + s.version, 0)}-${d.sinPie}`;

  return (
    <div className="flex flex-col gap-6">
      <Cabecera
        titulo={nombre}
        texto={d.cupo}
        derecha={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" className="boton boton-fantasma"><ArrowLeft size={16} /> Inicio</Link>
            <Pastilla tono={fase === "cerrado" ? "ok" : fase === "generando" || fase === "redactando" ? "warn" : "accent"}>
              {fase === "cerrado" ? "Listo para subir" : fase === "generando" ? "Generando" : fase === "redactando" ? "Redactando la ficha" : fase === "revision" ? "En revisión" : fase === "ficha" ? "Ficha" : "Sin ficha"}
            </Pastilla>
            <button className="boton boton-fantasma" onClick={borrar} aria-label="Borrar carrusel"><Trash2 size={16} /></button>
          </div>
        }
      />

      {mensaje && <Aviso tono={mensaje.tono}><pre className="whitespace-pre-wrap font-sans">{mensaje.texto}</pre></Aviso>}

      {/* Original */}
      {d.original.length > 0 && (
        <Panel className="aparece">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold">Carrusel original</h2><span className="text-[13px]" style={{ color: "var(--fg-muted)" }}>{d.original.length} slides</span></div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {d.original.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s} src={`/api/archivo?ruta=${encodeURIComponent(`virales/${nombre}/${s}`)}`} alt="" className="h-36 shrink-0 rounded-xl object-cover" style={{ aspectRatio: "4/5" }} loading="lazy" />
            ))}
          </div>
        </Panel>
      )}

      {/* Redactando */}
      {fase === "redactando" && (
        <Panel fuerte className="aparece"><div className="flex items-center gap-3"><Loader2 className="animate-spin" size={18} /><div><div className="font-semibold">Codex está leyendo los slides y redactando la ficha</div><div className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Un minuto aproximadamente. No gasta imágenes.</div></div></div></Panel>
      )}

      {fase === "sin_ficha" && (
        <Panel fuerte className="aparece">
          <h2 className="mb-2 text-[16px] font-semibold">Este carrusel no tiene ficha</h2>
          {d.estadoFicha?.estado === "error" && <div className="mb-3"><Aviso tono="danger"><pre className="whitespace-pre-wrap font-sans">{d.estadoFicha.salida}</pre></Aviso></div>}
          <div className="flex flex-wrap gap-2">
            {d.original.length > 0 && <button className="boton boton-primario" disabled={ocupado} onClick={() => accion({ accion: "ficha_ia" })}><Sparkles size={16} /> Que la AI la redacte</button>}
            <button className="boton" onClick={() => { setFicha({ cabecera: { carrusel: nombre, slides: String(d.original.length || 4), cta: "", viral: d.original.length ? `${"datos"}/virales/${nombre}` : "ninguno", bandera: "no" }, slides: Array.from({ length: d.original.length || 4 }, () => ({ titular: "", azul: "", idea: "", texto_escena: "ninguno", manos: "" })) }); setSucia(true); }}>Escribirla yo</button>
          </div>
        </Panel>
      )}

      {/* Ficha */}
      {(fase === "ficha" || (fase === "sin_ficha" && ficha)) && ficha && (
        <Panel fuerte className="aparece">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-[18px] font-semibold">Ficha</h2><p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Lo único que se escribe por carrusel. Revísala y aprueba generando.</p></div>
            <div className="flex gap-2">
              {d.original.length > 0 && <button className="boton" disabled={ocupado} onClick={() => accion({ accion: "ficha_ia" })} title="Vuelve a redactar toda la ficha con la AI"><Sparkles size={16} /> Redactar de nuevo</button>}
              <button className="boton" disabled={!sucia || guardando} onClick={() => void guardar()}>{guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar y comprobar</button>
            </div>
          </div>

          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Palabra del CTA"><input className="campo" value={ficha.cabecera.cta ?? ""} onChange={(e) => cambiarCab("cta", e.target.value)} /></Campo>
            <Campo etiqueta="Bandera de EEUU" ayuda="Solo si el tema es dinero, negocio o EEUU.">
              <select className="campo" value={ficha.cabecera.bandera ?? "no"} onChange={(e) => cambiarCab("bandera", e.target.value)}><option value="no">No</option><option value="si">Sí</option></select>
            </Campo>
            <Campo etiqueta="Cifras confirmadas" ayuda='Cifras que no están en el original pero das por buenas, o "todas".'><input className="campo" value={ficha.cabecera.cifras_confirmadas ?? ""} onChange={(e) => cambiarCab("cifras_confirmadas", e.target.value)} /></Campo>
          </div>

          <div className="grid gap-4">
            {ficha.slides.map((s, i) => (
              <details key={i} open={i < 2} className="vidrio-suave rounded-[16px] border p-4" style={{ borderColor: "var(--border)" }}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="font-semibold">Slide {i + 1}{i === 0 ? " · portada" : i === ficha.slides.length - 1 ? " · cierre" : ""}</span>
                  <span className="truncate text-[13px]" style={{ color: "var(--fg-muted)" }}>{s.titular || s.texto || "sin titular"}</span>
                </summary>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {CASILLAS.filter((c) => c.k !== "texto" || s.texto !== undefined).map((c) => (
                    <div key={c.k} className={c.larga ? "md:col-span-2" : ""}>
                      <Campo etiqueta={c.etiqueta} ayuda={c.ayuda}>
                        {c.larga ? <textarea className="campo" rows={2} value={s[c.k] ?? ""} onChange={(e) => cambiarSlide(i, c.k, e.target.value)} /> : <input className="campo" value={s[c.k] ?? ""} onChange={(e) => cambiarSlide(i, c.k, e.target.value)} />}
                      </Campo>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-end"><button className="boton boton-fantasma boton-peligro" onClick={() => quitarSlide(i)}><X size={14} /> Quitar slide</button></div>
              </details>
            ))}
            <button className="boton" onClick={añadirSlide}>+ Añadir slide</button>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5" style={{ borderColor: "var(--border)" }}>
            <div className="max-w-xl text-[13px]">
              {d.comprobacion ? (d.comprobacion.ok ? <Pastilla tono="ok"><Check size={14} /> {d.comprobacion.texto}</Pastilla> : <Aviso tono="warn"><pre className="whitespace-pre-wrap font-sans">{d.comprobacion.texto}</pre></Aviso>) : <span style={{ color: "var(--fg-muted)" }}>Guarda para comprobar la ficha.</span>}
            </div>
            <button className="boton boton-primario" disabled={ocupado || guardando} onClick={generar}><Wand2 size={16} /> Generar {ficha.slides.length} slides</button>
          </div>
        </Panel>
      )}

      {/* Generando */}
      {fase === "generando" && (
        <Panel fuerte className="aparece">
          <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-3"><Loader2 className="animate-spin" size={18} /><div><div className="font-semibold">{d.estado?.orden?.[0] === "corregir" ? `Corrigiendo el slide ${d.estado.orden[2]}` : "Codex está generando los slides"}</div><div className="text-[13px]" style={{ color: "var(--fg-muted)" }}>De 5 a 12 minutos. Puedes cerrar esta pestaña: sigue solo.</div></div></div><span className="mono">{d.sinPie}/{n}</span></div>
          <div className="progreso" aria-label="Progreso"><div style={{ width: `${d.estado?.orden?.[0] === "corregir" ? 50 : progreso}%` }} /></div>
        </Panel>
      )}

      {/* Revisión y cerrado */}
      {(fase === "revision" || fase === "cerrado") && (
        <Panel fuerte className="aparece">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-[18px] font-semibold">{fase === "cerrado" ? "Listo para subir" : "Revisión"}</h2><p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>{fase === "cerrado" ? "JPG a 1080×1350, sin metadatos de AI." : "Mira cada slide en grande. Corrige solo lo que falle. Cuando esté, aprueba y cierra."}</p></div>
            <div className="flex flex-wrap gap-2">
              {fase === "cerrado" ? <a className="boton boton-primario" href={`/api/carrusel/${nombre}/zip`}><Download size={16} /> Descargar ZIP</a> : (
                <>
                  <button className="boton" disabled={ocupado} onClick={() => accion({ accion: "revisar" })}><RefreshCw size={16} /> Rehacer hoja</button>
                  <button className="boton boton-primario" disabled={ocupado} onClick={() => { if (confirm("¿Aprobar el carrusel y cerrarlo? Se exportan los JPG limpios y se borran los archivos de trabajo.")) void accion({ accion: "cerrar" }); }}><Check size={16} /> Aprobar y cerrar</button>
                </>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {d.slides.map((s) => {
              const ruta = s.jpg && !s.png ? `salida/${nombre}/${s.n}.jpg` : `salida/${nombre}/${s.n}.png`;
              return (
                <figure key={s.n} className="vidrio-suave overflow-hidden rounded-[16px] border" style={{ borderColor: "var(--border)" }}>
                  <button className="block w-full cursor-zoom-in" onClick={() => setGrande(s.n)} aria-label={`Ver el slide ${s.n} en grande`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(ruta)} alt={`Slide ${s.n}`} className="w-full" style={{ aspectRatio: "4/5", objectFit: "cover" }} />
                  </button>
                  <figcaption className="flex items-center justify-between gap-2 p-3">
                    <span className="text-[13.5px] font-semibold">Slide {s.n}{s.version ? <span style={{ color: "var(--fg-faint)" }}> · v{s.version + 1}</span> : null}</span>
                    {fase === "revision" && <button className="boton boton-fantasma" style={{ minHeight: 36 }} onClick={() => { setCorrigiendo(s.n); setCambio(""); }}>Corregir</button>}
                  </figcaption>
                </figure>
              );
            })}
          </div>
          {fase === "revision" && d.estado?.estado === "error" && <div className="mt-4"><Aviso tono="danger"><pre className="whitespace-pre-wrap font-sans">{d.estado.salida}</pre></Aviso></div>}
        </Panel>
      )}

      {/* Corregir */}
      {corrigiendo !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setCorrigiendo(null)}>
          <div className="vidrio vidrio-fuerte w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="titulo-corregir">
            <h3 id="titulo-corregir" className="mb-1 text-[18px] font-semibold">Corregir el slide {corrigiendo}</h3>
            <p className="mb-4 text-[13px]" style={{ color: "var(--fg-muted)" }}>Describe el único cambio. Todo lo demás se mantiene, y la cara se restaura con tus fotos. Gasta 1 imagen.</p>
            <textarea className="campo" rows={4} autoFocus value={cambio} onChange={(e) => setCambio(e.target.value)} placeholder="sube el texto para dejar libre la franja del pie" />
            <div className="mt-4 flex justify-end gap-2">
              <button className="boton" onClick={() => setCorrigiendo(null)}>Cancelar</button>
              <button className="boton boton-primario" disabled={!cambio.trim() || ocupado} onClick={async () => { const nn = corrigiendo; setCorrigiendo(null); await accion({ accion: "corregir", n: nn, cambio }); }}><Wand2 size={16} /> Corregir</button>
            </div>
          </div>
        </div>
      )}

      {/* Slide en grande */}
      {grande !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={() => setGrande(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img(`salida/${nombre}/${grande}.${d.cerrado ? "jpg" : "png"}`)} alt={`Slide ${grande}`} className="max-h-[92dvh] rounded-2xl" style={{ boxShadow: "0 40px 100px -30px rgba(0,0,0,0.9)" }} />
        </div>
      )}
    </div>
  );
}
