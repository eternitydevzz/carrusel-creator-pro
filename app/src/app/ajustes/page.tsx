"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Aviso, Cabecera, Campo, Panel, Pastilla } from "@/componentes/ui";

type Ajustes = { clave_puesta: boolean; clave_final: string; cuenta: string; ubicacion: Record<string, string | number>; codex: string; codex_ok: boolean; cupo: string; herramientas: Record<string, boolean>; datos: string };

export default function AjustesPagina() {
  const [a, setA] = useState<Ajustes | null>(null);
  const [clave, setClave] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [ubi, setUbi] = useState<Record<string, string | number>>({});
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  async function cargar() { const d = (await (await fetch("/api/ajustes", { cache: "no-store" })).json()) as Ajustes; setA(d); setCuenta(d.cuenta); setUbi(d.ubicacion); }
  useEffect(() => { void cargar(); }, []);

  async function guardar() {
    setGuardando(true); setAviso("");
    await fetch("/api/ajustes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scrapecreators_key: clave || undefined, cuenta, ubicacion: ubi }) });
    setClave(""); setAviso("Guardado."); setGuardando(false); await cargar();
  }

  if (!a) return <Panel><p style={{ color: "var(--fg-muted)" }}>Cargando…</p></Panel>;
  return (
    <div className="flex flex-col gap-6">
      <Cabecera titulo="Ajustes" texto="Lo que conecta la app con tu Codex, con ScrapeCreators y con tu cuenta." />
      {aviso && <Aviso tono="ok">{aviso}</Aviso>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="aparece">
          <h2 className="mb-3 text-[18px] font-semibold">Codex</h2>
          <div className="mb-3 flex items-center gap-2"><Pastilla tono={a.codex_ok ? "ok" : "danger"}>{a.codex_ok ? "Conectado" : "Sin sesión"}</Pastilla><span className="mono" style={{ color: "var(--fg-muted)" }}>{a.codex}</span></div>
          <p className="mb-4 text-[13px]" style={{ color: "var(--fg-muted)" }}>Codex usa tu plan de ChatGPT. Para conectarlo o cambiar de cuenta, en la Terminal: <code className="mono">codex logout</code> y <code className="mono">codex login</code>. Después escribe aquí el nombre de la cuenta para que el cupo se cuente bien.</p>
          <Campo etiqueta="Nombre de la cuenta conectada" ayuda="Solo una etiqueta para el registro de imágenes (cuenta1, cuenta2…)."><input className="campo" value={cuenta} onChange={(e) => setCuenta(e.target.value)} /></Campo>
          <div className="mt-4"><Pastilla tono="accent">{a.cupo}</Pastilla></div>
        </Panel>

        <Panel className="aparece" >
          <h2 className="mb-3 text-[18px] font-semibold">ScrapeCreators</h2>
          <p className="mb-4 text-[13px]" style={{ color: "var(--fg-muted)" }}>Descarga los slides de los carruseles originales. 1 crédito por carrusel. La clave se guarda solo en tu Mac, en <code className="mono">datos/ajustes.json</code>.</p>
          <Campo etiqueta={a.clave_puesta ? `Clave guardada (termina en ${a.clave_final})` : "Clave de la API"} ayuda="Pega una clave nueva para sustituirla.">
            <input className="campo mono" type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder={a.clave_puesta ? "••••••••" : "sc_…"} autoComplete="off" />
          </Campo>
        </Panel>
      </div>

      <Panel className="aparece">
        <h2 className="mb-1 text-[18px] font-semibold">Ubicación de los metadatos</h2>
        <p className="mb-4 text-[13px]" style={{ color: "var(--fg-muted)" }}>Al cerrar un carrusel se borran todos los metadatos y se escribe solo esta ubicación.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {(["ciudad", "estado", "pais", "codigo", "lat", "lon"] as const).map((k) => (
            <Campo key={k} etiqueta={{ ciudad: "Ciudad", estado: "Estado / provincia", pais: "País", codigo: "Código de país", lat: "Latitud", lon: "Longitud" }[k]}>
              <input className="campo" value={String(ubi[k] ?? "")} onChange={(e) => setUbi({ ...ubi, [k]: e.target.value })} />
            </Campo>
          ))}
        </div>
      </Panel>

      <Panel className="aparece">
        <h2 className="mb-3 text-[18px] font-semibold">Herramientas del Mac</h2>
        <div className="flex flex-wrap gap-2">{Object.entries(a.herramientas).map(([h, ok]) => <Pastilla key={h} tono={ok ? "ok" : "danger"}>{ok ? <Check size={14} /> : null} {h}</Pastilla>)}</div>
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--fg-faint)" }}>Los datos viven en <code className="mono">{a.datos}</code>.</p>
      </Panel>

      <div className="flex justify-end"><button className="boton boton-primario" disabled={guardando} onClick={guardar}>{guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar ajustes</button></div>
    </div>
  );
}
