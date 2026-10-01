"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Trash2, Upload } from "lucide-react";
import { Aviso, Cabecera, Campo, Panel } from "@/componentes/ui";
import { PanelCliente } from "@/componentes/PanelCliente";

type Marca = { marca: Record<string, string>; fotos: string[]; tipografia: string; referencias: string[] };

export default function Branding() {
  const [m, setM] = useState<Marca | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: "ok" | "danger"; texto: string } | null>(null);

  async function cargar() { const r = await fetch("/api/marca", { cache: "no-store" }); const d = (await r.json()) as Marca; setM(d); setCampos(d.marca); }
  // la carga va detrás de una promesa: así el estado se actualiza fuera del efecto (regla react-hooks/set-state-in-effect)
  useEffect(() => { void Promise.resolve().then(cargar); }, []);

  async function guardar() {
    setGuardando(true); setAviso(null);
    const r = await fetch("/api/marca", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campos) });
    const d = await r.json();
    setAviso(r.ok ? { tono: "ok", texto: "Guardado. Los próximos carruseles usan estos datos." } : { tono: "danger", texto: d.error });
    setGuardando(false); await cargar();
  }

  async function subir(tipo: string, archivos: FileList | null) {
    if (!archivos?.length) return;
    setSubiendo(tipo); setAviso(null);
    const fd = new FormData(); fd.append("tipo", tipo); for (const a of Array.from(archivos)) fd.append("archivos", a);
    const r = await fetch("/api/marca/foto", { method: "POST", body: fd });
    if (!r.ok) setAviso({ tono: "danger", texto: (await r.json()).error ?? "No se pudo subir" });
    setSubiendo(null); await cargar();
  }

  async function quitar(ruta: string) { await fetch("/api/marca/foto", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruta }) }); await cargar(); }

  if (!m) return <Panel><p style={{ color: "var(--fg-muted)" }}>Cargando…</p></Panel>;
  const img = (ruta: string) => `/api/archivo?ruta=${encodeURIComponent(`marca/${ruta}`)}&t=${Date.now()}`;

  return (
    <div className="flex flex-col gap-6">
      <Cabecera titulo="Branding" texto="El kit de marca del cliente activo. Cada cliente tiene el suyo; para cambiar de cliente, usa el selector de la barra lateral." />
      <PanelCliente />
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Subida titulo="Personaje" texto="2 o 3 fotos de la persona: rostro de frente, varios ángulos y una de cuerpo. Van adjuntas a cada generación y a cada corrección." tipo="personaje" multiple items={m.fotos} img={img} subiendo={subiendo === "personaje"} onSubir={subir} onQuitar={quitar} />
        <Subida titulo="Referencias de estilo" texto="Ejemplos de cómo quieres el acabado y la tipografía (tus miniaturas, por ejemplo). La primera se adjunta al prompt." tipo="tipografia" items={m.tipografia ? [m.tipografia] : []} img={img} subiendo={subiendo === "tipografia"} onSubir={subir} onQuitar={quitar} />
      </div>

      <Panel fuerte className="aparece">
        <h2 className="mb-4 text-[18px] font-semibold">Datos de la marca</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo etiqueta="Cuenta" ayuda="Va en el pie de todos los slides."><input className="campo" value={campos.handle ?? ""} onChange={(e) => setCampos({ ...campos, handle: e.target.value })} placeholder="@tucuenta" /></Campo>
          <Campo etiqueta="Color de la marca" ayuda="El color de los titulares destacados y del contador.">
            <div className="flex items-center gap-3">
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(campos.azul ?? "") ? campos.azul : "#1a79fb"} onChange={(e) => setCampos({ ...campos, azul: e.target.value.toUpperCase() })} className="h-11 w-14 cursor-pointer rounded-xl border-0 bg-transparent" aria-label="Elegir color" />
              <input className="campo mono" value={campos.azul ?? ""} onChange={(e) => setCampos({ ...campos, azul: e.target.value })} placeholder="#1A79FB" />
            </div>
          </Campo>
          <div className="md:col-span-2"><Campo etiqueta="Ángulo de comunicación" ayuda="Lo que todo copy tiene que conectar. Ejemplo: vender sistemas de AI a empresas en USA."><textarea className="campo" rows={2} value={campos.angulo ?? ""} onChange={(e) => setCampos({ ...campos, angulo: e.target.value })} /></Campo></div>
          <div className="md:col-span-2"><Campo etiqueta="Ropa del personaje" ayuda="La misma en todos los slides. Ejemplo: traje azul marino y camisa blanca, sin corbata."><input className="campo" value={campos.ropa ?? ""} onChange={(e) => setCampos({ ...campos, ropa: e.target.value })} /></Campo></div>
          <Campo etiqueta="Lema del pie" ayuda="Frase pequeña debajo de tu cuenta, en todos los slides. Ejemplo: SISTEMAS DE AI PARA EMPRESAS EN USA."><input className="campo" value={campos.lema ?? ""} onChange={(e) => setCampos({ ...campos, lema: e.target.value })} placeholder="TU LEMA EN MAYÚSCULAS" /></Campo>
          <Campo etiqueta="Idioma" ayuda='Por ejemplo: español. Se dice "AI", nunca "IA".'><input className="campo" value={campos.idioma ?? ""} onChange={(e) => setCampos({ ...campos, idioma: e.target.value })} /></Campo>
          <Campo etiqueta="Tope de imágenes al día" ayuda="Codex bloquea en torno a 60 por cuenta. El sistema no lanza si no hay sitio."><input className="campo" inputMode="numeric" value={campos.tope_imagenes_dia ?? "60"} onChange={(e) => setCampos({ ...campos, tope_imagenes_dia: e.target.value })} /></Campo>
        </div>
        <div className="mt-5 flex justify-end"><button className="boton boton-primario" disabled={guardando} onClick={guardar}>{guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar</button></div>
      </Panel>
    </div>
  );
}

function Subida({ titulo, texto, tipo, multiple, items, img, subiendo, onSubir, onQuitar }: { titulo: string; texto: string; tipo: string; multiple?: boolean; items: string[]; img: (r: string) => string; subiendo: boolean; onSubir: (tipo: string, f: FileList | null) => void; onQuitar: (r: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Panel className="aparece">
      <h2 className="text-[18px] font-semibold">{titulo}</h2>
      <p className="mb-4 text-[13px]" style={{ color: "var(--fg-muted)" }}>{texto}</p>
      <div className="mb-4 grid grid-cols-3 gap-3">
        {items.map((r) => (
          <div key={r} className="group relative overflow-hidden rounded-xl" style={{ aspectRatio: "4/5", background: "rgba(0,0,0,0.3)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(r)} alt="" className="h-full w-full object-cover" />
            <button className="boton boton-peligro absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100" style={{ minHeight: 34, padding: "0 10px" }} onClick={() => onQuitar(r)} aria-label="Quitar"><Trash2 size={14} /></button>
          </div>
        ))}
        {items.length === 0 && <div className="col-span-3 grid h-28 place-items-center rounded-xl text-[13px]" style={{ background: "rgba(0,0,0,0.25)", color: "var(--fg-faint)" }}>Sin fotos</div>}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple={multiple} hidden onChange={(e) => onSubir(tipo, e.target.files)} />
      <button className="boton" disabled={subiendo} onClick={() => ref.current?.click()}>{subiendo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Subir {titulo.toLowerCase()}</button>
    </Panel>
  );
}
