"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { Sfx, iniciarSonidos } from "@/lib/sonidos";

/* Primer arranque: deja la marca y las conexiones configuradas en 4 bloques.
   Guarda en los mismos sitios que Branding y Ajustes (/api/marca, /api/marca/foto, /api/ajustes). */

type Opcion = { v: string; t: string; e?: string };
type Ajustes = { codex_ok: boolean; claude_ok: boolean; clave_puesta: boolean; creditos: number | null; creditos_error?: string; herramientas: Record<string, boolean> };

const BLOQUES = ["Tú", "Tu marca", "Tu personaje", "Conexiones"];
// cada paso: su bloque (0-3)
const PASOS = [
  { id: "nombre", b: 0 }, { id: "handle", b: 0 },
  { id: "color", b: 1 }, { id: "angulo", b: 1 }, { id: "lema", b: 1 },
  { id: "fotos", b: 2 }, { id: "estilo", b: 2 }, { id: "ropa", b: 2 },
  { id: "clave", b: 3 }, { id: "conexiones", b: 3 }, { id: "ubicacion", b: 3 },
] as const;

const COLORES: (Opcion & { hex: string })[] = [
  { v: "#0070F8", hex: "#0070F8", t: "Azul Maestría" }, { v: "#1A79FB", hex: "#1A79FB", t: "Azul eléctrico" },
  { v: "#10B981", hex: "#10B981", t: "Verde" }, { v: "#7C3AED", hex: "#7C3AED", t: "Morado" },
  { v: "#F97316", hex: "#F97316", t: "Naranja" }, { v: "otro", hex: "", t: "Otro color" },
];
const ANGULOS: Opcion[] = [
  { v: "vender sistemas de AI a empresas en USA, para latinos que viven en Estados Unidos", t: "Vender AI a empresas en USA", e: "💼" },
  { v: "enseñar a emprendedores latinos a usar AI en su negocio", t: "Emprendedores latinos", e: "🚀" },
  { v: "ayudar a creadores de contenido a crecer con AI", t: "Creadores de contenido", e: "🎬" },
  { v: "otro", t: "Otro: lo escribo yo", e: "✍️" },
];
const LEMAS: Record<string, string> = {
  [ANGULOS[0].v]: "SISTEMAS DE AI PARA EMPRESAS EN USA",
  [ANGULOS[1].v]: "AI PARA EMPRENDEDORES LATINOS",
  [ANGULOS[2].v]: "AI PARA CREADORES DE CONTENIDO",
};
const ROPAS: Opcion[] = [
  { v: "traje azul marino y camisa blanca, sin corbata", t: "Traje azul marino y camisa blanca", e: "🤵" },
  { v: "camisa casual de botones, lisa", t: "Camisa casual", e: "👔" },
  { v: "sudadera lisa de color oscuro", t: "Sudadera lisa", e: "🧥" },
  { v: "otro", t: "Otra: la escribo yo", e: "✍️" },
];
const UBICACIONES = [
  { v: "newark", t: "Newark, NJ", e: "🗽", u: { ciudad: "Newark", estado: "New Jersey", pais: "United States", codigo: "US", lat: 40.7357, lon: -74.1724 } },
  { v: "miami", t: "Miami, FL", e: "🌴", u: { ciudad: "Miami", estado: "Florida", pais: "United States", codigo: "US", lat: 25.7617, lon: -80.1918 } },
  { v: "houston", t: "Houston, TX", e: "🤠", u: { ciudad: "Houston", estado: "Texas", pais: "United States", codigo: "US", lat: 29.7604, lon: -95.3698 } },
  { v: "la", t: "Los Ángeles, CA", e: "🌉", u: { ciudad: "Los Angeles", estado: "California", pais: "United States", codigo: "US", lat: 34.0522, lon: -118.2437 } },
  { v: "nyc", t: "Nueva York, NY", e: "🏙️", u: { ciudad: "New York", estado: "New York", pais: "United States", codigo: "US", lat: 40.7128, lon: -74.006 } },
  { v: "chicago", t: "Chicago, IL", e: "🌬️", u: { ciudad: "Chicago", estado: "Illinois", pais: "United States", codigo: "US", lat: 41.8781, lon: -87.6298 } },
];

function confeti(n = 90) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colores = ["#0070f8", "#4da3ff", "#8cc6ff", "#ffffff", "#ffd166"];
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.className = "cm-confetti";
    const s = 6 + Math.random() * 6;
    Object.assign(p.style, { left: `${Math.random() * 100}vw`, width: `${s}px`, height: `${s * 0.45}px`, background: colores[i % colores.length], animationDuration: `${2.2 + Math.random() * 1.8}s`, animationDelay: `${Math.random() * 0.4}s` });
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 4800);
  }
}

export function Bienvenida() {
  const router = useRouter();
  const [paso, setPaso] = useState(-1); // -1 portada · 0-10 preguntas · 11 guardando · 12 listo
  const [mudo, setMudo] = useState(false);
  const [error, setError] = useState("");
  const [nombre, setNombre] = useState("");
  const [handle, setHandle] = useState("");
  const [color, setColor] = useState("");
  const [colorOtro, setColorOtro] = useState("#0070F8");
  const [angulo, setAngulo] = useState("");
  const [anguloOtro, setAnguloOtro] = useState("");
  const [lema, setLema] = useState("");
  const [ropa, setRopa] = useState("");
  const [ropaOtra, setRopaOtra] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [estilo, setEstilo] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [encima, setEncima] = useState(false);
  const [clave, setClave] = useState("");
  const [aj, setAj] = useState<Ajustes | null>(null);
  const [comprobando, setComprobando] = useState(false);
  const [ubicacion, setUbicacion] = useState("newark");
  const titulo = useRef<HTMLHeadingElement>(null);

  // lo que ya hubiera (si se repite la bienvenida, no se empieza de cero)
  useEffect(() => {
    iniciarSonidos();
    let vivo = true;
    fetch("/api/marca", { cache: "no-store" }).then((r) => r.json()).then((d: { marca: Record<string, string>; fotos: string[]; tipografia: string }) => {
      if (!vivo) return;
      setMudo(Sfx.enSilencio());
      const m = d.marca;
      if (m.nombre) setNombre(m.nombre);
      if (m.handle && m.handle !== "@tucuenta") setHandle(m.handle);
      if (m.azul) { const c = COLORES.find((x) => x.hex.toLowerCase() === m.azul.toLowerCase()); if (c) setColor(c.v); else { setColor("otro"); setColorOtro(m.azul); } }
      if (m.angulo) { if (ANGULOS.some((a) => a.v === m.angulo)) setAngulo(m.angulo); else { setAngulo("otro"); setAnguloOtro(m.angulo); } }
      if (m.lema) setLema(m.lema);
      if (m.ropa) { if (ROPAS.some((r) => r.v === m.ropa)) setRopa(m.ropa); else { setRopa("otro"); setRopaOtra(m.ropa); } }
      setFotos(d.fotos ?? []);
      setEstilo(d.tipografia ?? "");
    }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const idPaso = paso >= 0 && paso < PASOS.length ? PASOS[paso].id : null;
  const bloque = idPaso ? PASOS[paso].b : paso >= PASOS.length ? 4 : 0;

  const comprobar = useCallback(async () => {
    setComprobando(true);
    try { setAj((await (await fetch("/api/ajustes", { cache: "no-store" })).json()) as Ajustes); } finally { setComprobando(false); }
  }, []);
  useEffect(() => { if (idPaso === "conexiones" && !aj) void Promise.resolve().then(comprobar); }, [idPaso, aj, comprobar]);
  useEffect(() => { titulo.current?.focus(); }, [paso]);

  const valido = (): string => {
    switch (idPaso) {
      case "nombre": return nombre.trim() ? "" : "Escribe tu nombre";
      case "handle": return /^@?[A-Za-z0-9._]{2,30}$/.test(handle.trim()) ? "" : "Escribe tu cuenta, por ejemplo @tucuenta";
      case "color": return !color ? "Elige un color" : color === "otro" && !/^#[0-9a-fA-F]{6}$/.test(colorOtro) ? "Elige el color" : "";
      case "angulo": return !angulo ? "Elige una opción" : angulo === "otro" && !anguloOtro.trim() ? "Escribe a quién le hablas" : "";
      case "lema": return lema.trim() ? "" : "Escribe tu lema";
      case "fotos": return fotos.length >= 2 ? "" : "Sube al menos 2 fotos tuyas";
      case "estilo": return estilo ? "" : "Sube una imagen de referencia";
      case "ropa": return !ropa ? "Elige una opción" : ropa === "otro" && !ropaOtra.trim() ? "Escribe la ropa" : "";
      default: return "";
    }
  };

  async function guardarClave(): Promise<boolean> {
    if (!clave.trim()) return true; // ya puesta o se deja para luego
    await fetch("/api/ajustes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scrapecreators_key: clave.trim() }) });
    const d = (await (await fetch("/api/ajustes", { cache: "no-store" })).json()) as Ajustes;
    setAj(d);
    if (d.creditos_error) { setError(d.creditos_error); return false; }
    return true;
  }

  async function terminar() {
    setPaso(PASOS.length);
    const inicio = Date.now();
    const marca = {
      nombre: nombre.trim(), handle: handle.trim().startsWith("@") ? handle.trim() : "@" + handle.trim(),
      azul: (color === "otro" ? colorOtro : color).toUpperCase(), angulo: angulo === "otro" ? anguloOtro.trim() : angulo,
      lema: lema.trim().toUpperCase(), ropa: ropa === "otro" ? ropaOtra.trim() : ropa,
    };
    const u = UBICACIONES.find((x) => x.v === ubicacion)?.u;
    try {
      const r1 = await fetch("/api/marca", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(marca) });
      if (!r1.ok) throw new Error((await r1.json()).error ?? "No se pudo guardar la marca");
      await fetch("/api/ajustes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ubicacion: u }) });
      await fetch("/api/bienvenida", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hecha: true }) });
    } catch (e) { setPaso(PASOS.length - 1); setError((e as Error).message); return; }
    await new Promise((r) => setTimeout(r, Math.max(0, 1400 - (Date.now() - inicio))));
    setPaso(PASOS.length + 1);
    Sfx.success(); confeti();
  }

  async function siguiente() {
    setError("");
    if (paso === -1) { Sfx.advance(); setPaso(0); return; }
    const e = valido();
    if (e) { setError(e); return; }
    if (idPaso === "clave" && !(await guardarClave())) return;
    if (idPaso === "angulo" && !lema && LEMAS[angulo]) setLema(LEMAS[angulo]);
    if (paso === PASOS.length - 1) { void terminar(); return; }
    Sfx.advance();
    setPaso(paso + 1);
  }
  function atras() { if (paso > 0) { Sfx.click(); setError(""); setPaso(paso - 1); } }

  function elegir(fn: (v: string) => void, v: string) {
    Sfx.select(); fn(v); setError("");
  }

  async function subir(lista: FileList | null, tipo: "personaje" | "tipografia") {
    if (!lista?.length) return;
    setSubiendo(true); setError("");
    try {
      const fd = new FormData();
      fd.append("tipo", tipo);
      for (const f of Array.from(lista).slice(0, tipo === "personaje" ? 3 : 1)) fd.append("archivos", f);
      const r = await fetch("/api/marca/foto", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo subir");
      const m = d.marca as Record<string, string>;
      if (tipo === "personaje") setFotos((m.fotos ?? "").split(",").map((f) => f.trim()).filter(Boolean));
      else setEstilo(m.tipografia ?? "");
      Sfx.select();
    } catch (e) { setError((e as Error).message); } finally { setSubiendo(false); }
  }

  // opciones de la pantalla actual, para los atajos de teclado 1-6
  const opciones: { lista: Opcion[]; fijar: (v: string) => void } | null =
    idPaso === "color" ? { lista: COLORES, fijar: setColor } : idPaso === "angulo" ? { lista: ANGULOS, fijar: setAngulo }
    : idPaso === "ropa" ? { lista: ROPAS, fijar: setRopa } : idPaso === "ubicacion" ? { lista: UBICACIONES, fijar: setUbicacion } : null;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      // con el foco en un botón, Enter ya lo pulsa el navegador: si además avanzáramos, haría dos cosas a la vez
      const enCampo = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLButtonElement;
      if (e.key === "Enter" && !enCampo && !e.shiftKey) { e.preventDefault(); void siguiente(); return; }
      if (opciones && !(e.target instanceof HTMLInputElement) && /^[1-9]$/.test(e.key)) {
        const o = opciones.lista[Number(e.key) - 1];
        if (o) elegir(opciones.fijar, o.v);
      }
    };
    window.addEventListener("keydown", tecla); return () => window.removeEventListener("keydown", tecla);
  });

  const segmentos = BLOQUES.map((_, i) => {
    if (bloque > i) return 100;
    if (bloque < i || !idPaso) return 0;
    const delBloque = PASOS.filter((p) => p.b === i);
    const pos = delBloque.findIndex((p) => p.id === idPaso);
    return Math.round(((pos + 1) / delBloque.length) * 100);
  });

  const img = (ruta: string) => `/api/archivo?ruta=${encodeURIComponent(`marca/${ruta}`)}`;
  const tarjetas = (lista: Opcion[], valor: string, fijar: (v: string) => void, emoji = true) => (
    <div className={`cm-opts${emoji ? " cm-opts--emoji" : ""}`} role="radiogroup">
      {lista.map((o, i) => (
        <button key={o.v} type="button" role="radio" aria-checked={valor === o.v} className={`cm-opt${valor === o.v ? " is-picked" : ""}`} onClick={() => elegir(fijar, o.v)}>
          {"hex" in o ? <span className="cm-swatch" style={{ background: (o as { hex: string }).hex || "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }} /> : o.e && <span className="cm-opt__e">{o.e}</span>}
          <span>{o.t}</span>
          <span className="cm-opt__k">{i + 1}</span>
        </button>
      ))}
    </div>
  );

  const pregunta = () => {
    switch (idPaso) {
      case "nombre": return (<>
        <h2 className="cm-q__title" tabIndex={-1} ref={titulo}>¿Cómo te llamas?</h2>
        <input className={`cm-input${error ? " is-bad" : ""}`} autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" autoComplete="given-name" />
      </>);
      case "handle": return (<>
        <h2 className="cm-q__title" tabIndex={-1} ref={titulo}>{nombre ? `${nombre.split(" ")[0]}, ¿cuál es tu cuenta de Instagram?` : "¿Cuál es tu cuenta de Instagram?"}</h2>
        <p className="cm-q__help">Sale en el pie de todos tus slides.</p>
        <input className={`cm-input${error ? " is-bad" : ""}`} autoFocus value={handle} onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))} placeholder="@tucuenta" autoCapitalize="none" />
      </>);
      case "color": return (<>
        <h2 className="cm-q__title" tabIndex={-1} ref={titulo}>¿Cuál es el color de tu marca?</h2>
        <p className="cm-q__help">Va en los titulares, los botones y los detalles de cada slide.</p>
        {tarjetas(COLORES, color, setColor)}
        {color === "otro" && <div className="cm-field"><label htmlFor="cm-color">Tu color</label><input id="cm-color" type="color" className="cm-input" style={{ padding: 6 }} value={colorOtro} onChange={(e) => setColorOtro(e.target.value.toUpperCase())} /></div>}
      </>);
      case "angulo": return (<>
        <h2 className="cm-q__title" tabIndex={-1} ref={titulo}>¿A quién le hablas?</h2>
        <p className="cm-q__help">Claude lo usa para escribir cada carrusel y su descripción.</p>
        {tarjetas(ANGULOS, angulo, setAngulo)}
        {angulo === "otro" && <textarea className="cm-input" rows={2} autoFocus value={anguloOtro} onChange={(e) => setAnguloOtro(e.target.value)} placeholder="Por ejemplo: ayudar a dueños de restaurantes a automatizar con AI" />}
      </>);
      case "lema": return (<>
        <h2 className="cm-q__title" tabIndex={-1} ref={titulo}>Tu lema para el pie</h2>
        <p className="cm-q__help">Una frase corta que sale debajo de tu cuenta en todos los slides.</p>
        <input className={`cm-input${error ? " is-bad" : ""}`} autoFocus value={lema} onChange={(e) => setLema(e.target.value.toUpperCase())} placeholder="SISTEMAS DE AI PARA EMPRESAS EN USA" maxLength={48} />
      </>);
      case "fotos": return (<>
        <h2 className="cm-q__title" tabIndex={-1} ref={titulo}>Sube 2 o 3 fotos tuyas</h2>
        <p className="cm-q__help">De frente, con buena luz y de distintos ángulos. Codex las usa para que en cada slide salgas tú.</p>
        {fotos.length > 0 && <div className="cm-thumbs">{fotos.map((f) => (
          <div key={f} className="cm-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(f)} alt="Tu foto" />
          </div>
        ))}</div>}
        <Zona multiple onFiles={(l) => subir(l, "personaje")} subiendo={subiendo} encima={encima} setEncima={setEncima} texto={fotos.length ? "Añadir o cambiar fotos (máximo 3)" : "Arrastra tus fotos aquí"} />
      </>);
      case "estilo": return (<>
        <h2 className="cm-q__title" tabIndex={-1} ref={titulo}>Sube una referencia de estilo</h2>
        <p className="cm-q__help">Una portada o miniatura que te guste: Codex copia de ahí la letra y el acabado.</p>
        {estilo && <div className="cm-thumbs"><div className="cm-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img(estilo)} alt="Tu referencia" />
        </div></div>}
        <Zona onFiles={(l) => subir(l, "tipografia")} subiendo={subiendo} encima={encima} setEncima={setEncima} texto={estilo ? "Cambiar la referencia" : "Arrastra la imagen aquí"} />
      </>);
      case "ropa": return (<>
        <h2 className="cm-q__title" tabIndex={-1} ref={titulo}>¿Qué ropa llevas en los slides?</h2>
        <p className="cm-q__help">Siempre la misma, para que tu marca se reconozca.</p>
        {tarjetas(ROPAS, ropa, setRopa)}
        {ropa === "otro" && <input className="cm-input" autoFocus value={ropaOtra} onChange={(e) => setRopaOtra(e.target.value)} placeholder="Por ejemplo: polo negro con el logo" />}
      </>);
      case "clave": return (<>
        <h2 className="cm-q__title" tabIndex={-1} ref={titulo}>Tu clave de ScrapeCreators</h2>
        <p className="cm-q__help">Sirve para descargar los carruseles virales que copias (1 crédito cada uno). La sacas en scrapecreators.com. Si aún no la tienes, deja el campo vacío y la pones luego en Ajustes.</p>
        <input className={`cm-input${error ? " is-bad" : ""}`} value={clave} onChange={(e) => setClave(e.target.value)} placeholder={aj?.clave_puesta ? "Ya tienes una clave guardada" : "Pega tu clave"} autoComplete="off" spellCheck={false} />
        {aj?.creditos != null && !error && <p className="cm-ok-txt">✓ Clave válida · {aj.creditos} créditos</p>}
      </>);
      case "conexiones": return (<>
        <h2 className="cm-q__title" tabIndex={-1} ref={titulo}>Codex y Claude Code</h2>
        <p className="cm-q__help">Codex genera las imágenes con tu plan de ChatGPT; Claude Code escribe las fichas y las descripciones con tu plan de Claude.</p>
        {!aj ? <div className="cm-wait"><div className="cm-wait__spin" /><p className="cm-wait__text">Comprobando…</p></div> : (<>
          <Fila ok={aj.codex_ok} nombre="Codex" si="Conectado a tu cuenta de ChatGPT" no="Abre la Terminal y escribe:" orden="codex login" />
          <Fila ok={aj.claude_ok} nombre="Claude Code" si="Instalado" no="Abre la Terminal y escribe:" orden="claude" />
          {Object.entries(aj.herramientas).some(([, v]) => !v) && <Fila ok={false} nombre={`Faltan: ${Object.entries(aj.herramientas).filter(([, v]) => !v).map(([k]) => k).join(", ")}`} no="En la carpeta de la app, ejecuta:" orden="./instalar.sh" si="" />}
          <button type="button" className="cm-back" style={{ justifySelf: "center" }} disabled={comprobando} onClick={() => { Sfx.click(); void comprobar(); }}>{comprobando ? "Comprobando…" : "↻ Volver a comprobar"}</button>
          {(!aj.codex_ok || !aj.claude_ok) && <p className="cm-q__help" style={{ textAlign: "center", marginTop: 0 }}>Puedes seguir y conectarlo después: sin Codex no se puede generar.</p>}
        </>)}
      </>);
      case "ubicacion": return (<>
        <h2 className="cm-q__title" tabIndex={-1} ref={titulo}>¿Dónde publicas?</h2>
        <p className="cm-q__help">Al cerrar cada carrusel se borran los metadatos de AI y se escribe esta ubicación. La puedes cambiar en Ajustes.</p>
        {tarjetas(UBICACIONES, ubicacion, setUbicacion)}
      </>);
      default: return null;
    }
  };

  const nombreCorto = nombre.trim().split(" ")[0];

  return (
    <div className="cmb">
      <div className="cm-pop__card" key={paso < 0 ? "portada" : paso >= PASOS.length ? `fin${paso}` : "quiz"}>
        {paso === -1 && (
          <div>
            <div className="cm-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/maestria.png" alt="Código MaestrIA" />
            </div>
            <span className="cm-eyebrow">Código MaestrIA · Carrusel Creator Pro</span>
            <h1 className="cm-pop__title" tabIndex={-1}>Bienvenido a tu fábrica de carruseles</h1>
            <p className="cm-pop__sub">Deja tu marca lista en 3 minutos y crea tu primer carrusel.</p>
            <ul className="cm-bullets">
              <li><span>🎨</span>Tu marca: cuenta, color y lema</li>
              <li><span>📸</span>Tus fotos, para salir en cada slide</li>
              <li><span>🔌</span>Tus conexiones: Codex, Claude y ScrapeCreators</li>
            </ul>
            <button type="button" className="cm-btn cm-btn--block" onClick={() => void siguiente()}>Empezar</button>
            <p className="cm-hint" style={{ marginTop: 14 }}>o pulsa Enter ↵</p>
          </div>
        )}

        {idPaso && (
          <div className="cm-quiz">
            <div className="cm-quiz__top">
              <div className="cm-quiz__segs" aria-hidden="true">{segmentos.map((w, i) => <div key={i} className="cm-seg"><i style={{ width: `${w}%` }} /></div>)}</div>
              <button type="button" className="cm-icon-btn" onClick={() => setMudo(Sfx.alternar())} aria-label={mudo ? "Activar sonido" : "Silenciar"}>{mudo ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
            </div>
            <div className="cm-q" key={idPaso}>
              <div className="cm-q__meta"><span className="cm-q__blk">Bloque {PASOS[paso].b + 1} · <b>{BLOQUES[PASOS[paso].b]}</b></span><span className="cm-q__count">{paso + 1} / {PASOS.length}</span></div>
              {pregunta()}
              <p className="cm-err" role="alert">{error}</p>
            </div>
            <div className="cm-quiz__nav">
              {paso > 0 && <button type="button" className="cm-back" onClick={atras}><ArrowLeft size={16} /> Atrás</button>}
              <button type="button" className="cm-btn" disabled={subiendo} onClick={() => void siguiente()}>{paso === PASOS.length - 1 ? "Terminar" : "Siguiente"}</button>
            </div>
            {opciones ? <p className="cm-hint">Pulsa 1-{opciones.lista.length} para elegir · Enter para seguir</p> : <p className="cm-hint">Enter ↵ para seguir</p>}
          </div>
        )}

        {paso === PASOS.length && (
          <div className="cm-wait"><div className="cm-wait__spin" /><span className="cm-eyebrow">Guardando</span><p className="cm-wait__text">Un momento, {nombreCorto}: estamos dejando tu marca lista…</p></div>
        )}

        {paso === PASOS.length + 1 && (
          <div className="cm-result">
            <div className="cm-result__ok" aria-hidden="true">✓</div>
            <h1 className="cm-pop__title" tabIndex={-1}>¡Todo listo, {nombreCorto}!</h1>
            <div className="cm-sum">
              <div><span>Cuenta</span><b>{handle.startsWith("@") ? handle : "@" + handle}</b></div>
              <div><span>Color</span><b style={{ color: color === "otro" ? colorOtro : color }}>● {color === "otro" ? colorOtro : COLORES.find((c) => c.v === color)?.t}</b></div>
              <div><span>Lema</span><b>{lema}</b></div>
              <div><span>Fotos</span><b>{fotos.length} + referencia de estilo</b></div>
              <div><span>Codex</span><b>{aj?.codex_ok ? "Conectado ✓" : "Pendiente"}</b></div>
            </div>
            <button type="button" className="cm-btn cm-btn--block" onClick={() => { Sfx.advance(); router.push("/"); }}>Crear mi primer carrusel</button>
            <button type="button" className="cm-back" onClick={() => router.push("/branding")}>Revisar mi marca</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Fila({ ok, nombre, si, no, orden }: { ok: boolean; nombre: string; si: string; no: string; orden: string }) {
  return (
    <div className="cm-check">
      <span className={`cm-check__i ${ok ? "ok" : "no"}`}>{ok ? "✓" : "!"}</span>
      <span className="cm-check__t"><b>{nombre}</b>{ok ? si : <>{no} <code>{orden}</code></>}</span>
    </div>
  );
}

function Zona({ multiple = false, onFiles, subiendo, encima, setEncima, texto }: { multiple?: boolean; onFiles: (l: FileList | null) => void; subiendo: boolean; encima: boolean; setEncima: (v: boolean) => void; texto: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button type="button" className={`cm-drop${encima ? " is-over" : ""}`} disabled={subiendo}
      onClick={() => { Sfx.click(); ref.current?.click(); }}
      onDragOver={(e) => { e.preventDefault(); setEncima(true); }} onDragLeave={() => setEncima(false)}
      onDrop={(e) => { e.preventDefault(); setEncima(false); onFiles(e.dataTransfer.files); }}>
      <span style={{ fontSize: "1.8rem" }}>{subiendo ? "⏳" : "📸"}</span>
      <b>{subiendo ? "Subiendo…" : texto}</b>
      <span>o haz clic para elegir · JPG, PNG o HEIC</span>
      <input ref={ref} type="file" accept="image/*,.heic" multiple={multiple} hidden onChange={(e) => onFiles(e.target.files)} />
    </button>
  );
}
