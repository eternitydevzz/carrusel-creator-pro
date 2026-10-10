"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Download, FolderOpen, Loader2, Pencil, RefreshCw, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { Aviso, Campo, Panel, Pastilla } from "@/componentes/ui";
import { Descripcion } from "@/componentes/Descripcion";
import { AvisoClaude } from "@/componentes/AvisoClaude";
import { Visor } from "@/componentes/Visor";
import { ElegirImagenes } from "@/componentes/ElegirImagenes";
import type { Ficha, Slide } from "@/lib/motor";
import { llamar, postJson } from "@/lib/llamar";

type Datos = {
  nombre: string; fichaTexto: string; ficha: Ficha | null; comprobacion: { ok: boolean; texto: string } | null;
  estado: { estado: string; orden: string[]; salida: string; inicio: string } | null; estadoFicha: { estado: string; salida: string } | null;
  estadoDescripcion: { estado: string; salida: string } | null; descripcion: string;
  estadoVariaciones: { estado: string; salida: string } | null; variaciones: string[];
  slides: { n: number; png: boolean; jpg: boolean; version: number }[]; progreso: number; cerrado: boolean; original: string[]; cupo: string;
  revisar: string[]; // imágenes de más cuando Codex rehízo alguna: se elige la buena de cada slide
};

const CASILLAS: { k: string; etiqueta: string; ayuda?: string; larga?: boolean }[] = [
  { k: "titular", etiqueta: "Titular", ayuda: 'Líneas entre comillas separadas por " / ". Portada y cierre: de 5 a 10 palabras.' },
  { k: "azul", etiqueta: "En azul", ayuda: "La parte del titular que va en el color de la marca." },
  { k: "arriba", etiqueta: "Texto pequeño arriba" },
  { k: "debajo", etiqueta: "Texto secundario", ayuda: "Máximo 95 caracteres: con más se mete en el pie.", larga: true },
  { k: "cta_grande", etiqueta: "Llamada a la acción grande" },
  { k: "idea", etiqueta: "Idea del original", ayuda: "Qué enseña ese slide y qué cuenta. Es la referencia visual.", larga: true },
  { k: "texto_escena", etiqueta: "Texto dentro de la escena", ayuda: 'Entre comillas y separados por comas, o "ninguno".', larga: true },
  { k: "personaje", etiqueta: "Personaje en el slide", ayuda: "Sí donde el original lleva a una persona. No donde lleva una mascota, un muñeco u objeto (se quedan como en el original). Si el original no lleva a nadie, el cliente sale en el último." },
  { k: "manos", etiqueta: "Manos", ayuda: "Una sola acción." },
  { k: "expresion", etiqueta: "Expresión" },
  { k: "texto", etiqueta: "Texto libre del slide", ayuda: "Solo si no hay titular: el generador saca el titular de aquí.", larga: true },
];

export function Carrusel({ nombre }: { nombre: string }) {
  const router = useRouter();
  const [d, setD] = useState<Datos | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [sucia, setSucia] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "warn" | "danger" | "info"; texto: string } | null>(null);
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null);
  const [cambio, setCambio] = useState("");
  const [grande, setGrande] = useState<number | null>(null);
  const [grandeOriginal, setGrandeOriginal] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [renombrando, setRenombrando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(nombre);
  const [ahora, setAhora] = useState(0); // hora de la última consulta: el contador de minutos no lee el reloj al dibujar
  const cargaInicial = useRef(true);
  const estabaEnCurso = useRef(false);

  const cargar = useCallback(async () => {
    const { ok, status, datos: res } = await llamar<Datos>(`/api/carrusel/${nombre}`, { cache: "no-store" });
    if (!ok) { if (status === 0) setMensaje({ tono: "danger", texto: res.error ?? "No hay conexión con la app" }); return; }
    const datos = res as Datos;
    setD(datos); setAhora(Date.now());
    if (cargaInicial.current || !sucia) { setFicha(datos.ficha); if (datos.ficha) cargaInicial.current = false; }
    const enCurso = datos.estado?.estado === "en_curso" || datos.estadoFicha?.estado === "en_curso";
    if (estabaEnCurso.current && !enCurso && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Carrusel Creator Pro", { body: `${nombre}: terminado. Ya puedes revisarlo.` });
    }
    estabaEnCurso.current = enCurso;
  }, [nombre, sucia]);

  // la carga va detrás de una promesa: así el estado se actualiza fuera del efecto (regla react-hooks/set-state-in-effect)
  useEffect(() => { void Promise.resolve().then(cargar); }, [cargar]);
  const enCurso = d?.estado?.estado === "en_curso" || d?.estadoFicha?.estado === "en_curso";
  useEffect(() => { if (!enCurso) return; const t = setInterval(() => { void cargar(); }, 4000); return () => clearInterval(t); }, [enCurso, cargar]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { setGrande(null); setGrandeOriginal(null); setCorrigiendo(null); setRenombrando(false); } };
    window.addEventListener("keydown", tecla); return () => window.removeEventListener("keydown", tecla);
  }, []);

  const fase = useMemo(() => {
    if (!d) return "cargando";
    if (d.cerrado) return "cerrado";
    if (d.estado?.estado === "en_curso") return "generando";
    if (d.slides.some((s) => s.png)) return "revision";
    if (d.revisar.length) return "elegir";
    if (d.estadoFicha?.estado === "en_curso") return "redactando";
    if (d.ficha) return "ficha";
    return "sin_ficha";
  }, [d]);

  async function guardar(): Promise<boolean> {
    if (!ficha) return false;
    setGuardando(true);
    try {
      const { ok, datos: res } = await llamar<{ ok: boolean; texto: string; ficha: Ficha }>(`/api/carrusel/${nombre}/ficha`, postJson({ ficha }, "PUT"));
      // la comprobación con fallos también llega con 200 (ok: false y su texto); solo un error de la app trae status de error
      if (!ok) { setMensaje({ tono: "danger", texto: res.error ?? "No se pudo guardar la ficha" }); return false; }
      setSucia(false);
      setD((prev) => prev ? { ...prev, comprobacion: { ok: res.ok, texto: res.texto }, ficha: res.ficha } : prev);
      return !!res.ok;
    } finally { setGuardando(false); }
  }

  async function accion(cuerpo: Record<string, unknown>) {
    setOcupado(true); setMensaje(null);
    try {
      const { ok, datos: res } = await llamar<{ ok?: boolean; texto?: string }>(`/api/carrusel/${nombre}/accion`, postJson(cuerpo));
      if (!ok) setMensaje({ tono: "danger", texto: res.error ?? "No se pudo" });
      else if (res.texto) setMensaje({ tono: res.ok ? "ok" : "warn", texto: res.texto });
      await cargar();
    } finally { setOcupado(false); }
  }

  async function generar() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
    if (sucia) { const ok = await guardar(); if (!ok) { setMensaje({ tono: "warn", texto: "La ficha tiene fallos. Corrígelos antes de generar." }); return; } }
    else if (d?.comprobacion && !d.comprobacion.ok) { setMensaje({ tono: "warn", texto: "La ficha tiene fallos. Corrígelos antes de generar." }); return; }
    await accion({ accion: "generar" });
  }

  async function renombrar() {
    const { ok, datos: res } = await llamar<{ nombre: string }>(`/api/carrusel/${nombre}/renombrar`, postJson({ nuevo: nuevoNombre }));
    if (!ok) { setMensaje({ tono: "danger", texto: res.error ?? "No se pudo cambiar el nombre" }); setRenombrando(false); return; }
    router.replace(`/carrusel/${res.nombre}`);
  }

  async function borrar() {
    if (!confirm(`¿Borrar el carrusel "${nombre}" con su ficha, su original y sus imágenes? No se puede deshacer.`)) return;
    const { ok, datos: res } = await llamar(`/api/carrusel/${nombre}`, { method: "DELETE" });
    if (!ok) { setMensaje({ tono: "danger", texto: res.error ?? "No se pudo borrar" }); return; }
    router.push("/");
  }

  function cambiarSlide(i: number, k: string, v: string) { setFicha((f) => { if (!f) return f; return { ...f, slides: f.slides.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }; }); setSucia(true); }
  function cambiarCab(k: string, v: string) { setFicha((f) => (f ? { ...f, cabecera: { ...f.cabecera, [k]: v } } : f)); setSucia(true); }
  function añadirSlide() { setFicha((f) => (f ? { ...f, slides: [...f.slides, { titular: "", azul: "", idea: "", texto_escena: "ninguno", manos: "" } as Slide] } : f)); setSucia(true); }
  function quitarSlide(i: number) { setFicha((f) => (f ? { ...f, slides: f.slides.filter((_, j) => j !== i) } : f)); setSucia(true); }
  function moverSlide(i: number, dir: -1 | 1) {
    setFicha((f) => { if (!f) return f; const j = i + dir; if (j < 0 || j >= f.slides.length) return f; const s = [...f.slides]; [s[i], s[j]] = [s[j], s[i]]; return { ...f, slides: s }; }); setSucia(true);
  }

  if (!d) return <Panel><p style={{ color: "var(--fg-muted)" }}>Cargando…</p></Panel>;

  const n = d.ficha ? Number(d.ficha.cabecera.slides) : d.slides.length;
  const corrigiendoAhora = d.estado?.orden?.[0] === "corregir";
  const progreso = fase === "generando" ? (corrigiendoAhora ? 50 : Math.min(100, Math.round((d.progreso / Math.max(n, 1)) * 100))) : 0;
  const minutos = d.estado?.inicio && ahora ? Math.max(0, Math.round((ahora - new Date(d.estado.inicio).getTime()) / 60000)) : 0;
  const sello = d.slides.reduce((a, s) => a + s.version, 0);
  const img = (ruta: string) => `/api/archivo?ruta=${encodeURIComponent(ruta)}&t=${sello}`;
  // "Cuenta 'x': 29 imágenes en las últimas 24 h (tope 60)" → cuántas quedan hoy
  const cupoM = /(\d+) imágenes .*tope (\d+)/.exec(d.cupo);
  const quedan = cupoM ? Math.max(0, Number(cupoM[2]) - Number(cupoM[1])) : null;
  const etiquetaFase = fase === "cerrado" ? "Listo para subir" : fase === "generando" ? (corrigiendoAhora ? "Corrigiendo" : "Generando") : fase === "redactando" ? "Redactando la ficha" : fase === "revision" ? "En revisión" : fase === "elegir" ? "Elegir imágenes" : fase === "ficha" ? "Ficha" : "Sin ficha";

  return (
    <div className="flex flex-col gap-6">
      <header className="aparece mb-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {renombrando ? (
            <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void renombrar(); }}>
              <input className="campo text-[22px] font-bold" style={{ width: "min(480px, 90vw)" }} value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} autoFocus aria-label="Nuevo nombre" />
              <button className="boton boton-primario" type="submit"><Check size={16} /> Guardar</button>
              <button className="boton" type="button" onClick={() => setRenombrando(false)}>Cancelar</button>
            </form>
          ) : (
            <div className="group flex items-center gap-3">
              <h1 className="cursor-text truncate text-[28px] font-bold tracking-tight sm:text-[32px]" title="Doble clic para cambiar el nombre" onDoubleClick={() => { if (fase !== "generando") { setNuevoNombre(nombre); setRenombrando(true); } }}>{nombre}</h1>
              <button className="opacity-40 transition-opacity group-hover:opacity-100 disabled:opacity-20" aria-label="Cambiar el nombre" title="Cambiar el nombre" onClick={() => { setNuevoNombre(nombre); setRenombrando(true); }} disabled={fase === "generando"}><Pencil size={18} /></button>
            </div>
          )}
          <p className="mt-1 text-[14px]" style={{ color: "var(--fg-muted)" }}>{d.cupo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="boton boton-fantasma"><ArrowLeft size={16} /> Inicio</Link>
          <Pastilla tono={fase === "cerrado" ? "ok" : fase === "generando" || fase === "redactando" ? "warn" : "accent"}>{etiquetaFase}</Pastilla>
          {d.slides.length > 0 && <button className="boton boton-fantasma" title="Abrir la carpeta" aria-label="Abrir la carpeta" onClick={() => void fetch("/api/abrir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruta: `salida/${nombre}` }) })}><FolderOpen size={16} /></button>}
          <button className="boton boton-fantasma" onClick={borrar} aria-label="Borrar carrusel" disabled={fase === "generando"}><Trash2 size={16} /></button>
        </div>
      </header>

      {mensaje && <Aviso tono={mensaje.tono}><pre className="whitespace-pre-wrap font-sans">{mensaje.texto}</pre></Aviso>}

      {d.original.length > 0 && (
        <Panel className="aparece">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold">Carrusel original</h2><span className="text-[13px]" style={{ color: "var(--fg-muted)" }}>{d.original.length} slides</span></div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {d.original.map((s, i) => (
              <button key={s} className="shrink-0 cursor-zoom-in rounded-xl" onClick={() => setGrandeOriginal(s)} aria-label={`Ver el slide ${i + 1} del original en grande`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/archivo?ruta=${encodeURIComponent(`virales/${nombre}/${s}`)}`} alt={`Slide ${i + 1} del original`} className="h-36 rounded-xl object-cover" style={{ aspectRatio: "4/5" }} loading="lazy" />
              </button>
            ))}
          </div>
        </Panel>
      )}

      {fase === "redactando" && (
        <Panel fuerte className="aparece"><div className="flex items-center gap-3"><Loader2 className="animate-spin" size={18} /><div><div className="font-semibold">Claude está leyendo los slides y redactando la ficha</div><div className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Un minuto aproximadamente. No gasta imágenes.</div></div></div></Panel>
      )}

      {fase === "sin_ficha" && !ficha && (
        <Panel fuerte className="aparece">
          <h2 className="mb-2 text-[16px] font-semibold">Este carrusel no tiene ficha</h2>
          {d.estadoFicha?.estado === "error" && <div className="mb-3"><AvisoClaude salida={d.estadoFicha.salida} /></div>}
          <div className="flex flex-wrap gap-2">
            {d.original.length > 0 && <button className="boton boton-primario" disabled={ocupado} onClick={() => accion({ accion: "ficha_ia" })}><Sparkles size={16} /> Que Claude la redacte</button>}
            <button className="boton" onClick={() => { setFicha({ cabecera: { carrusel: nombre, slides: String(d.original.length || 4), cta: "", viral: d.original.length ? `virales/${nombre}` : "ninguno", bandera: "no" }, slides: Array.from({ length: d.original.length || 4 }, () => ({ titular: "", azul: "", idea: "", texto_escena: "ninguno", manos: "" })) }); setSucia(true); }}>Escribirla yo</button>
          </div>
        </Panel>
      )}

      {fase === "elegir" && <ElegirImagenes nombre={nombre} archivos={d.revisar} slides={n} img={img} onHecho={cargar} />}

      {/* si la primera generación falló, se dice aquí; antes la pantalla volvía a la ficha sin explicar nada (en revisión ya se avisa abajo) */}
      {d.estado?.estado === "error" && (fase === "ficha" || fase === "sin_ficha") && (
        <Aviso tono="danger"><div className="mb-1 font-semibold">{d.estado.orden[0] === "corregir" ? `La corrección del slide ${d.estado.orden[2]} falló` : "La generación falló"}</div><pre className="whitespace-pre-wrap font-sans">{d.estado.salida.trim().split("\n").slice(-4).join("\n")}</pre></Aviso>
      )}

      {fase === "ficha" && d.estadoFicha?.estado === "error" && (
        <AvisoClaude salida={d.estadoFicha.salida} recorte={4} titulo="No se pudo volver a redactar la ficha (se mantiene la anterior)" />
      )}

      {(fase === "ficha" || (fase === "sin_ficha" && ficha)) && ficha && (
        <Panel fuerte className="aparece">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-[18px] font-semibold">Ficha</h2><p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Lo único que se escribe por carrusel. Revísala y aprueba generando.</p></div>
            <div className="flex gap-2">
              {d.original.length > 0 && <button className="boton" disabled={ocupado} onClick={() => accion({ accion: "ficha_ia" })} title="Vuelve a redactar toda la ficha con Claude"><Sparkles size={16} /> Redactar de nuevo</button>}
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
                        {c.k === "personaje" ? (
                          <select className="campo" value={(s.personaje ?? "si").toLowerCase() === "no" ? "no" : "si"} onChange={(e) => cambiarSlide(i, "personaje", e.target.value)}><option value="si">Sí</option><option value="no">No</option></select>
                        ) : c.larga ? <textarea className="campo" rows={2} value={s[c.k] ?? ""} onChange={(e) => cambiarSlide(i, c.k, e.target.value)} /> : <input className="campo" value={s[c.k] ?? ""} onChange={(e) => cambiarSlide(i, c.k, e.target.value)} />}
                      </Campo>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-1">
                  <button className="boton boton-fantasma" onClick={() => moverSlide(i, -1)} disabled={i === 0} aria-label="Subir slide"><ArrowUp size={14} /></button>
                  <button className="boton boton-fantasma" onClick={() => moverSlide(i, 1)} disabled={i === ficha.slides.length - 1} aria-label="Bajar slide"><ArrowDown size={14} /></button>
                  <button className="boton boton-fantasma boton-peligro" onClick={() => quitarSlide(i)}><X size={14} /> Quitar</button>
                </div>
              </details>
            ))}
            <button className="boton" onClick={añadirSlide}>+ Añadir slide</button>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5" style={{ borderColor: "var(--border)" }}>
            <div className="flex max-w-xl flex-col gap-2 text-[13px]">
              {d.comprobacion ? (d.comprobacion.ok ? <Pastilla tono="ok"><Check size={14} /> {d.comprobacion.texto}</Pastilla> : <Aviso tono="warn"><pre className="whitespace-pre-wrap font-sans">{d.comprobacion.texto}</pre></Aviso>) : <span style={{ color: "var(--fg-muted)" }}>Guarda para comprobar la ficha.</span>}
              {quedan !== null && ficha.slides.length > quedan && <Aviso tono="warn">A esta cuenta le quedan {quedan} imágenes hoy y el carrusel necesita {ficha.slides.length}. Codex no lo aceptará: cambia de cuenta en Ajustes o espera.</Aviso>}
            </div>
            <button className="boton boton-primario" disabled={ocupado || guardando} onClick={generar}><Wand2 size={16} /> Generar {ficha.slides.length} slides</button>
          </div>
        </Panel>
      )}

      {fase === "generando" && (
        <Panel fuerte className="aparece">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3"><Loader2 className="animate-spin" size={18} /><div><div className="font-semibold">{corrigiendoAhora ? `Corrigiendo el slide ${d.estado?.orden[2]}` : "Codex está generando los slides"}</div><div className="text-[13px]" style={{ color: "var(--fg-muted)" }}>{corrigiendoAhora ? "Uno o dos minutos." : "De 5 a 12 minutos."} Puedes cerrar esta pestaña: sigue solo. Llevas {minutos} min.</div></div></div>
            <span className="mono">{corrigiendoAhora ? "" : `${d.progreso}/${n}`}</span>
          </div>
          <div className="progreso" aria-label="Progreso"><div style={{ width: `${Math.max(progreso, 4)}%` }} /></div>
          {d.slides.some((s) => s.png) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {d.slides.map((s) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={s.n} src={img(`salida/${nombre}/${s.n}.png`)} alt={`Slide ${s.n}`} className="w-full rounded-xl opacity-70" style={{ aspectRatio: "4/5", objectFit: "cover" }} />
              ))}
            </div>
          )}
        </Panel>
      )}

      {(fase === "revision" || fase === "cerrado") && (
        <Panel fuerte className="aparece">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-[18px] font-semibold">{fase === "cerrado" ? "Listo para subir" : "Revisión"}</h2><p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>{fase === "cerrado" ? "JPG a 1080×1350, sin metadatos de AI. Para cambiar algo habría que generarlo de nuevo." : "Mira cada slide en grande. Corrige solo lo que falle. Cuando esté, aprueba y cierra."}</p></div>
            <div className="flex flex-wrap gap-2">
              {fase === "cerrado" ? <a className="boton boton-primario" href={`/api/carrusel/${nombre}/zip`}><Download size={16} /> Descargar ZIP</a> : (
                <>
                  <button className="boton" disabled={ocupado} onClick={() => accion({ accion: "revisar" })}><RefreshCw size={16} /> Rehacer hoja</button>
                  <button className="boton boton-primario" disabled={ocupado} onClick={() => { if (confirm("¿Aprobar el carrusel y cerrarlo? Se exportan los JPG limpios y se borran los archivos de trabajo. Después ya no se puede corregir.")) void accion({ accion: "cerrar" }); }}><Check size={16} /> Aprobar y cerrar</button>
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

      {(fase === "revision" || fase === "cerrado") && <Descripcion nombre={nombre} texto={d.descripcion} estado={d.estadoDescripcion} variaciones={d.variaciones} estadoVariaciones={d.estadoVariaciones} recargar={cargar} />}

      {corrigiendo !== null && (
        <div className="telon fixed inset-0 z-50 grid place-items-center p-4" onClick={() => setCorrigiendo(null)}>
          <div className="modal aparece w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="titulo-corregir">
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

      {grandeOriginal !== null && (
        <Visor src={`/api/archivo?ruta=${encodeURIComponent(`virales/${nombre}/${grandeOriginal}`)}`} alt="Slide del original"
          posicion={d.original.indexOf(grandeOriginal)} total={d.original.length} onCerrar={() => setGrandeOriginal(null)}
          onMover={(paso) => setGrandeOriginal((g) => d.original[d.original.indexOf(g ?? "") + paso] ?? g)} />
      )}

      {grande !== null && (
        <Visor src={img(`salida/${nombre}/${grande}.${d.cerrado ? "jpg" : "png"}`)} alt={`Slide ${grande}`}
          posicion={d.slides.findIndex((s) => s.n === grande)} total={d.slides.length} onCerrar={() => setGrande(null)}
          onMover={(paso) => setGrande((g) => d.slides[d.slides.findIndex((s) => s.n === g) + paso]?.n ?? g)} />
      )}
    </div>
  );
}
