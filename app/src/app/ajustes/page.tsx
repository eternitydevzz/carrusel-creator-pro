"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, FolderOpen, Loader2, Sparkles } from "lucide-react";
import { Aviso, Cabecera, Campo, Panel, Pastilla } from "@/componentes/ui";

type Ajustes = { clave_puesta: boolean; clave_final: string; creditos: number | null; creditos_error?: string; cuenta: string; ubicacion: Record<string, string | number>; codex: string; codex_ok: boolean; claude: string; claude_ok: boolean; cupo: string; herramientas: Record<string, boolean>; datos: string; datos_por_defecto: string };

export default function AjustesPagina() {
  const [a, setA] = useState<Ajustes | null>(null);
  const [clave, setClave] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [ubi, setUbi] = useState<Record<string, string | number>>({});
  const [carpeta, setCarpeta] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "danger"; texto: string } | null>(null);

  async function cargar() { const d = (await (await fetch("/api/ajustes", { cache: "no-store" })).json()) as Ajustes; setA(d); setCuenta(d.cuenta); setUbi(d.ubicacion); setCarpeta(d.datos); }
  // la carga va detrás de una promesa: así el estado se actualiza fuera del efecto (regla react-hooks/set-state-in-effect)
  useEffect(() => { void Promise.resolve().then(cargar); }, []);

  async function guardar() {
    setGuardando(true); setAviso(null);
    await fetch("/api/ajustes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scrapecreators_key: clave || undefined, cuenta, ubicacion: ubi }) });
    setClave(""); setAviso({ tono: "ok", texto: "Guardado." }); setGuardando(false); await cargar();
  }

  async function cambiarCarpeta() {
    if (!carpeta.trim() || carpeta === a?.datos) return;
    if (!confirm(`¿Usar "${carpeta}" como carpeta de datos? Se crea si no existe y se copia tu kit de marca. Los carruseles que ya tienes se quedan en la carpeta anterior.`)) return;
    setGuardando(true); setAviso(null);
    const r = await fetch("/api/ajustes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datos: carpeta }) });
    const d = await r.json();
    setAviso(r.ok ? { tono: "ok", texto: `Ahora todo se guarda en ${d.datos}.` } : { tono: "danger", texto: d.error });
    setGuardando(false); await cargar();
  }

  if (!a) return <Panel><p style={{ color: "var(--fg-muted)" }}>Cargando…</p></Panel>;
  return (
    <div className="flex flex-col gap-6">
      <Cabecera titulo="Ajustes" texto="Lo que conecta la app con Codex, Claude Code, ScrapeCreators y tu carpeta de trabajo." derecha={<Link className="boton" href="/bienvenida"><Sparkles size={16} /> Repetir bienvenida</Link>} />
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <Panel fuerte className="aparece">
        <h2 className="mb-1 text-[18px] font-semibold">Carpeta de datos</h2>
        <p className="mb-4 text-[13px]" style={{ color: "var(--fg-muted)" }}>Aquí se guardan tu kit de marca, las fichas, los originales descargados y los carruseles terminados. Escribe la ruta de la carpeta que quieras usar (por ejemplo, una dentro de Documentos o de tu Drive).</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1"><Campo etiqueta="Ruta de la carpeta" ayuda={`Por defecto: ${a.datos_por_defecto}`}><input className="campo mono" value={carpeta} onChange={(e) => setCarpeta(e.target.value)} /></Campo></div>
          <button className="boton" disabled={guardando || carpeta === a.datos} onClick={cambiarCarpeta}><Check size={16} /> Usar esta carpeta</button>
          <button className="boton boton-fantasma" title="Abrir la carpeta actual en el Finder" onClick={() => void fetch("/api/abrir", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })}><FolderOpen size={16} /> Abrir en el Finder</button>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="aparece">
          <h2 className="mb-3 text-[18px] font-semibold">Codex</h2>
          <div className="mb-3 flex items-center gap-2"><Pastilla tono={a.codex_ok ? "ok" : "danger"}>{a.codex_ok ? "Conectado" : "Sin sesión"}</Pastilla><span className="mono" style={{ color: "var(--fg-muted)" }}>{a.codex}</span></div>
          <p className="mb-4 text-[13px]" style={{ color: "var(--fg-muted)" }}>Codex genera las imágenes con tu plan de ChatGPT. Para conectarlo o cambiar de cuenta, en la Terminal: <code className="mono">codex logout</code> y <code className="mono">codex login</code>. Después escribe aquí el nombre de la cuenta para que el cupo se cuente bien.</p>
          <Campo etiqueta="Nombre de la cuenta conectada" ayuda="Solo una etiqueta para el registro de imágenes (cuenta1, cuenta2…)."><input className="campo" value={cuenta} onChange={(e) => setCuenta(e.target.value)} /></Campo>
          <div className="mt-4"><Pastilla tono="accent">{a.cupo}</Pastilla></div>
        </Panel>

        <Panel className="aparece">
          <h2 className="mb-3 text-[18px] font-semibold">Claude Code</h2>
          <div className="mb-3 flex items-center gap-2"><Pastilla tono={a.claude_ok ? "ok" : "danger"}>{a.claude_ok ? "Instalado" : "No encontrado"}</Pastilla><span className="mono" style={{ color: "var(--fg-muted)" }}>{a.claude}</span></div>
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Claude redacta las fichas leyendo los slides del original, con tu propia sesión de Claude Code, no con la API. Si no está: <code className="mono">npm install -g @anthropic-ai/claude-code</code> y luego <code className="mono">claude</code> para entrar.</p>
        </Panel>

        <Panel className="aparece">
          <h2 className="mb-3 text-[18px] font-semibold">ScrapeCreators</h2>
          <div className="mb-3 flex items-center gap-2">
            {a.clave_puesta ? <Pastilla tono={a.creditos !== null ? "ok" : "warn"}>{a.creditos !== null ? `${a.creditos} créditos` : a.creditos_error ?? "Clave guardada"}</Pastilla> : <Pastilla tono="danger">Sin clave</Pastilla>}
          </div>
          <p className="mb-4 text-[13px]" style={{ color: "var(--fg-muted)" }}>Descarga los slides de los carruseles originales. 1 crédito por carrusel. La clave se guarda solo en tu Mac.</p>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
            <div className="min-w-[240px] flex-1">
              <Campo etiqueta={a.clave_puesta ? `Clave guardada (termina en ${a.clave_final})` : "Clave de la API"} ayuda="Pega una clave nueva para sustituirla.">
                <input className="campo mono" type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder={a.clave_puesta ? "••••••••" : "Pega aquí tu clave"} autoComplete="off" />
              </Campo>
            </div>
            <button className="boton boton-primario" type="submit" disabled={guardando || !clave.trim()}>{guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar clave</button>
          </form>
        </Panel>

        <Panel className="aparece">
          <h2 className="mb-1 text-[18px] font-semibold">Ubicación de los metadatos</h2>
          <p className="mb-4 text-[13px]" style={{ color: "var(--fg-muted)" }}>Al cerrar un carrusel se borran todos los metadatos y se escribe solo esta ubicación.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["ciudad", "estado", "pais", "codigo", "lat", "lon"] as const).map((k) => (
              <Campo key={k} etiqueta={{ ciudad: "Ciudad", estado: "Estado / provincia", pais: "País", codigo: "Código de país", lat: "Latitud", lon: "Longitud" }[k]}>
                <input className="campo" value={String(ubi[k] ?? "")} onChange={(e) => setUbi({ ...ubi, [k]: e.target.value })} />
              </Campo>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="aparece">
        <h2 className="mb-3 text-[18px] font-semibold">Herramientas del Mac</h2>
        <div className="flex flex-wrap gap-2">{Object.entries(a.herramientas).map(([h, ok]) => <Pastilla key={h} tono={ok ? "ok" : "danger"}>{ok ? <Check size={14} /> : null} {h}</Pastilla>)}</div>
        {Object.values(a.herramientas).some((ok) => !ok) && <p className="mt-3 text-[13px]" style={{ color: "var(--warn)" }}>Falta alguna herramienta: ejecuta <code className="mono">./instalar.sh</code> en la carpeta del proyecto.</p>}
      </Panel>

      <div className="flex justify-end"><button className="boton boton-primario" disabled={guardando} onClick={guardar}>{guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar ajustes</button></div>
    </div>
  );
}
