// Puente entre la interfaz y el motor (motor/carrusel.sh). Todo corre en el Mac del usuario.
import { spawn, execFile } from "node:child_process";
import { promises as fs, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const RAIZ = path.resolve(process.cwd(), "..");
export const MOTOR = path.join(RAIZ, "motor");
export const SCRIPT = path.join(MOTOR, "carrusel.sh");
/** Ajustes de la app que no viven en la carpeta de datos (porque dicen dónde está esa carpeta). */
export const CONFIG = path.join(os.homedir(), ".carrusel-creator-pro.json");
export const DATOS_POR_DEFECTO = path.join(RAIZ, "datos");

export function leerConfig(): { datos?: string } {
  try { return JSON.parse(readFileSync(CONFIG, "utf8")); } catch { return {}; }
}
/** Carpeta de datos del usuario: la de la configuración, o datos/ dentro del proyecto. */
export function datos(): string {
  const c = leerConfig().datos;
  return c && existsSync(c) ? c : DATOS_POR_DEFECTO;
}
export async function cambiarDatos(ruta: string) {
  const abs = path.resolve(ruta.replace(/^~/, os.homedir()));
  for (const sub of ["marca/fotos", "fichas", "virales", "salida"]) await fs.mkdir(path.join(abs, sub), { recursive: true });
  // si es una carpeta nueva, se lleva el kit de marca actual para no empezar de cero
  if (!existsSync(path.join(abs, "marca", "marca.txt")) && existsSync(path.join(datos(), "marca"))) {
    await fs.cp(path.join(datos(), "marca"), path.join(abs, "marca"), { recursive: true });
  }
  if (!existsSync(path.join(abs, "CUENTA_ACTUAL.txt"))) await fs.writeFile(path.join(abs, "CUENTA_ACTUAL.txt"), "cuenta1\n");
  await fs.writeFile(CONFIG, JSON.stringify({ ...leerConfig(), datos: abs }, null, 2));
  return abs;
}

// Homebrew y ~/.local/bin no están en el PATH de un proceso arrancado desde una app: se añaden siempre.
const RUTAS = [path.join(os.homedir(), ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
export const PATH = [...new Set([...RUTAS, ...(process.env.PATH ?? "").split(":")])].join(":");
const entorno = () => ({ ...process.env, DATOS: datos(), PATH });

/** Ejecuta una orden del motor y espera a que termine. Para lo que dura segundos. */
export function motor(args: string[], opciones: { timeoutMs?: number } = {}): Promise<{ codigo: number; salida: string }> {
  return new Promise((resolve) => {
    execFile("/bin/zsh", [SCRIPT, ...args], { env: entorno(), timeout: opciones.timeoutMs ?? 120_000, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      const salida = `${stdout ?? ""}${stderr ?? ""}`.trim();
      const e = err as (NodeJS.ErrnoException & { code?: number | string }) | null;
      const codigo = !e ? 0 : typeof e.code === "number" ? e.code : 1;
      resolve({ codigo, salida });
    });
  });
}

/** Lanza una orden larga (generar, corregir, ficha_ia) sin esperar. Escribe su salida en un archivo de estado. */
export async function motorFondo(args: string[], archivoEstado: string) {
  await fs.mkdir(path.dirname(archivoEstado), { recursive: true });
  const inicio = { estado: "en_curso", orden: args, inicio: new Date().toISOString(), salida: "" };
  await fs.writeFile(archivoEstado, JSON.stringify(inicio));
  const hijo = spawn("/bin/zsh", [SCRIPT, ...args], { env: entorno(), detached: true, stdio: ["ignore", "pipe", "pipe"] });
  let salida = "";
  const volcar = async (fin?: number) => {
    const estado = fin === undefined ? "en_curso" : fin === 0 ? "ok" : "error";
    await fs.writeFile(archivoEstado, JSON.stringify({ ...inicio, estado, codigo: fin, salida, fin: fin === undefined ? undefined : new Date().toISOString() }));
  };
  hijo.stdout.on("data", (d) => { salida += d.toString(); void volcar(); });
  hijo.stderr.on("data", (d) => { salida += d.toString(); void volcar(); });
  hijo.on("close", (codigo) => { void volcar(codigo ?? 1); });
  hijo.unref();
}

/** ¿Hay alguna generación o corrección en curso en cualquier carrusel? Codex comparte el cupo: solo una a la vez. */
export async function ordenEnCurso(): Promise<string | null> {
  const salida = path.join(datos(), "salida");
  let carpetas: string[] = [];
  try { carpetas = await fs.readdir(salida); } catch { return null; }
  for (const c of carpetas) {
    const e = await leerEstado(path.join(salida, c, "_estado.json"));
    if (e?.estado === "en_curso") {
      // si el proceso murió sin cerrar el estado, no bloquear para siempre: 40 minutos de margen
      if (Date.now() - new Date(e.inicio).getTime() < 40 * 60_000) return c;
    }
  }
  return null;
}

export async function leerEstado(archivoEstado: string) {
  try { return JSON.parse(await fs.readFile(archivoEstado, "utf8")); } catch { return null; }
}
export async function leerTexto(ruta: string) { try { return await fs.readFile(ruta, "utf8"); } catch { return ""; } }
export async function existe(ruta: string) { try { await fs.access(ruta); return true; } catch { return false; } }
export function nombreSeguro(nombre: string) { return /^[a-z0-9_\-]+$/i.test(nombre) ? nombre : null; }
export function limpiarNombre(nombre: string) {
  return nombre.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_\-]/g, "");
}

export async function leerMarca(): Promise<Record<string, string>> {
  const t = await leerTexto(path.join(datos(), "marca", "marca.txt"));
  const m: Record<string, string> = {};
  for (const l of t.split("\n")) { const i = l.indexOf(":"); if (i > 0) m[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  return m;
}
export async function escribirMarca(m: Record<string, string>) {
  const orden = ["handle", "azul", "angulo", "ropa", "idioma", "fotos", "tipografia", "pie", "tope_imagenes_dia"];
  const lineas = orden.filter((k) => m[k] !== undefined).map((k) => `${k}: ${m[k]}`);
  for (const k of Object.keys(m)) if (!orden.includes(k)) lineas.push(`${k}: ${m[k]}`);
  await fs.mkdir(path.join(datos(), "marca", "fotos"), { recursive: true });
  await fs.writeFile(path.join(datos(), "marca", "marca.txt"), lineas.join("\n") + "\n");
}
export async function leerAjustes(): Promise<Record<string, unknown>> {
  try { return JSON.parse(await fs.readFile(path.join(datos(), "ajustes.json"), "utf8")); } catch { return {}; }
}
export async function escribirAjustes(a: Record<string, unknown>) {
  await fs.mkdir(datos(), { recursive: true });
  await fs.writeFile(path.join(datos(), "ajustes.json"), JSON.stringify(a, null, 2));
}

/** Ficha (texto) ↔ objeto para el editor. Mismo formato que ficha.py. */
export type Slide = Record<string, string>;
export type Ficha = { cabecera: Record<string, string>; slides: Slide[] };

export function parsearFicha(texto: string): Ficha {
  const cab: Record<string, string> = {}; const slides: Slide[] = []; let actual: Slide | null = null;
  for (const raw of texto.split("\n")) {
    const l = raw.trimEnd(); if (!l.trim()) continue;
    const m = /^##\s*(\d+)\s*$/.exec(l);
    if (m) { actual = {}; slides.push(actual); continue; }
    const i = l.indexOf(":"); if (i < 0) continue;
    (actual ?? cab)[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return { cabecera: cab, slides };
}
export function serializarFicha(f: Ficha): string {
  const ordenCab = ["carrusel", "slides", "cta", "viral", "bandera", "cifras_confirmadas"];
  const ordenSlide = ["arriba", "titular", "azul", "texto", "debajo", "cta_grande", "idea", "texto_escena", "personaje", "manos", "ropa", "expresion"];
  const out: string[] = [];
  const cab: Record<string, string> = { ...f.cabecera, slides: String(f.slides.length) };
  for (const k of ordenCab) if (cab[k] !== undefined && cab[k] !== "") out.push(`${k}: ${cab[k]}`);
  f.slides.forEach((s, i) => { out.push("", `## ${i + 1}`); for (const k of ordenSlide) if (s[k] !== undefined && s[k] !== "") out.push(`${k}: ${s[k]}`); });
  return out.join("\n") + "\n";
}

/** Cambia el nombre de un carrusel: ficha, original y salida. */
export async function renombrar(viejo: string, nuevo: string) {
  const D = datos();
  for (const [a, b] of [[path.join(D, "fichas", `${viejo}.md`), path.join(D, "fichas", `${nuevo}.md`)], [path.join(D, "virales", viejo), path.join(D, "virales", nuevo)], [path.join(D, "salida", viejo), path.join(D, "salida", nuevo)]]) {
    if (await existe(a)) await fs.rename(a, b);
  }
  const f = path.join(D, "fichas", `${nuevo}.md`);
  if (await existe(f)) {
    let t = await fs.readFile(f, "utf8");
    t = t.replace(/^carrusel: .*$/m, `carrusel: ${nuevo}`).replace(new RegExp(`(^viral: .*)/${viejo}\\s*$`, "m"), `$1/${nuevo}`);
    await fs.writeFile(f, t);
  }
}

/** Lista de carruseles con su estado, para Inicio y Biblioteca. */
export type Resumen = { nombre: string; slides: number; cta: string; ficha: boolean; original: boolean; generados: number; cerrado: boolean; fase: "ficha" | "generando" | "revision" | "cerrado" | "sin_ficha"; fecha?: string };

export async function listarCarruseles(): Promise<Resumen[]> {
  const D = datos();
  const nombres = new Set<string>();
  for (const carpeta of ["fichas", "salida", "virales"]) {
    try { for (const f of await fs.readdir(path.join(D, carpeta))) if (!f.startsWith("_") && !f.startsWith(".")) nombres.add(f.replace(/\.md$/, "")); } catch { /* vacío */ }
  }
  const lista: Resumen[] = [];
  for (const nombre of [...nombres].sort()) {
    const fichaTxt = await leerTexto(path.join(D, "fichas", `${nombre}.md`));
    const ficha = fichaTxt ? parsearFicha(fichaTxt) : null;
    const salida = path.join(D, "salida", nombre);
    let generados = 0; let cerrado = false; let fecha: string | undefined;
    try {
      const archivos = await fs.readdir(salida);
      generados = archivos.filter((a) => /^\d+\.png$/.test(a)).length;
      cerrado = archivos.some((a) => /^\d+\.jpg$/.test(a)) && generados === 0;
      fecha = (await fs.stat(salida)).mtime.toISOString();
    } catch { try { fecha = (await fs.stat(path.join(D, "fichas", `${nombre}.md`))).mtime.toISOString(); } catch { /* sin fecha */ } }
    const estado = await leerEstado(path.join(salida, "_estado.json"));
    const generando = estado?.estado === "en_curso";
    const fase: Resumen["fase"] = cerrado ? "cerrado" : generando ? "generando" : generados > 0 ? "revision" : ficha ? "ficha" : "sin_ficha";
    lista.push({ nombre, slides: Number(ficha?.cabecera.slides ?? 0), cta: ficha?.cabecera.cta ?? "", ficha: !!ficha, original: await existe(path.join(D, "virales", nombre)), generados, cerrado, fase, fecha });
  }
  return lista;
}
