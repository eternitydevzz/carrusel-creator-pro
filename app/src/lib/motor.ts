// Puente entre la interfaz y el motor (motor/carrusel.py). Todo corre en la compu del usuario (Mac o Windows).
import { spawn, execFile, execFileSync } from "node:child_process";
import { promises as fs, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const RAIZ = path.resolve(process.cwd(), "..");
export const MOTOR = path.join(RAIZ, "motor");
export const SCRIPT = path.join(MOTOR, "carrusel.py");
export const WINDOWS = process.platform === "win32";
/** Python que corre el motor: CCP_PYTHON si se define; si no, "python" en Windows y "python3" en Mac/Linux. */
export const PY = process.env.CCP_PYTHON || (WINDOWS ? "python" : "python3");
/** Ajustes de la app que no viven en la carpeta de datos (porque dicen dónde está esa carpeta). */
export const CONFIG = path.join(os.homedir(), ".carrusel-creator-pro.json");
export const DATOS_POR_DEFECTO = path.join(RAIZ, "datos");

export function leerConfig(): { datos?: string } {
  try { return JSON.parse(readFileSync(CONFIG, "utf8")); } catch { return {}; }
}
/** Carpeta de datos del usuario: la variable CCP_DATOS (pruebas, varias marcas), la de la configuración, o datos/ dentro del proyecto. */
export function datos(): string {
  if (process.env.CCP_DATOS) return process.env.CCP_DATOS;
  const c = leerConfig().datos;
  return c && existsSync(c) ? c : DATOS_POR_DEFECTO;
}
/* ---------- Clientes (perfiles) ----------
   Cada cliente tiene su carpeta en datos/perfiles/<id>/ con marca, fichas, virales, salida y perfil.json (nombre y ubicación).
   Lo compartido (ajustes.json con el cliente activo, CUPO.csv, CUENTA_ACTUAL.txt, capas) queda en datos/. */
export const ID_PERFIL = /^[a-z0-9_-]+$/;
let migrado = "";
/** Si los datos son del formato antiguo (un solo cliente), los pasa a perfiles una vez (motor/migrar_perfiles.py: copia antes de mover). */
function asegurarPerfiles(D: string) {
  if (migrado === D) return;
  const P = path.join(D, "perfiles");
  const hay = existsSync(P) && readdirSync(P, { withFileTypes: true }).some((e) => e.isDirectory());
  if (!hay) execFileSync(PY, [path.join(MOTOR, "migrar_perfiles.py"), D], { env: entornoBase(), stdio: "pipe", windowsHide: true });
  migrado = D;
}
export function perfilActivo(): string {
  const D = datos();
  asegurarPerfiles(D);
  let id = "";
  try { id = String(JSON.parse(readFileSync(path.join(D, "ajustes.json"), "utf8")).perfil_activo ?? ""); } catch { /* sin ajustes */ }
  if (ID_PERFIL.test(id) && existsSync(path.join(D, "perfiles", id))) return id;
  // el activo no existe (borrado a mano): el primero que haya
  return readdirSync(path.join(D, "perfiles"), { withFileTypes: true }).filter((e) => e.isDirectory() && ID_PERFIL.test(e.name)).map((e) => e.name).sort()[0] ?? "";
}
/** Carpeta del cliente activo: su marca, fichas, originales y carruseles. */
export function cliente(): string {
  const id = perfilActivo();
  return id ? path.join(datos(), "perfiles", id) : datos();
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

// Homebrew, ~/.local/bin (Mac) y la carpeta de npm (Windows) no siempre están en el PATH de un proceso arrancado desde una app: se añaden.
const RUTAS = WINDOWS
  ? [process.env.APPDATA && path.join(process.env.APPDATA, "npm"), process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links"), path.join(os.homedir(), ".local", "bin")].filter((r): r is string => !!r)
  : [path.join(os.homedir(), ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
const PATH_ACTUAL = Object.entries(process.env).find(([k]) => k.toUpperCase() === "PATH")?.[1] ?? "";
export const PATH = [...new Set([...RUTAS, ...PATH_ACTUAL.split(path.delimiter)].filter(Boolean))].join(path.delimiter);
/** El entorno del proceso con el PATH de arriba. En Windows la variable se llama "Path": se quita para no mandar dos. */
export function entornoBase(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) if (k.toUpperCase() !== "PATH") env[k] = v;
  return { ...env, PATH, PYTHONUTF8: "1", ...extra } as unknown as NodeJS.ProcessEnv;
}
// el motor recibe la carpeta común y el cliente: una orden larga sigue con su cliente aunque se cambie de cliente en la app
const entorno = (extra: Record<string, string> = {}) => entornoBase({ DATOS: datos(), PERFIL: perfilActivo(), ...extra });

/** Ruta completa de un programa del PATH (en Windows prueba también .exe, .cmd…), o null si no está instalado. */
export function ejecutable(nombre: string): string | null {
  // En Windows, npm deja junto a codex.cmd un "codex" sin extensión (un script de shell que Windows no puede ejecutar):
  // solo valen los nombres con extensión de PATHEXT (.exe, .cmd…), salvo que el nombre ya traiga extensión.
  const exts = WINDOWS && !path.extname(nombre) ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").toLowerCase().split(";").filter(Boolean) : [""];
  for (const dir of PATH.split(path.delimiter)) {
    for (const ext of exts) {
      const f = path.join(dir, nombre + ext);
      try { if (statSync(f).isFile()) return f; } catch { /* no está aquí */ }
    }
  }
  return null;
}
/** Ejecuta un programa del PATH (codex, claude…) y devuelve su salida. En Windows, los .cmd de npm necesitan la consola. */
export function ejecutar(nombre: string, args: string[], timeoutMs = 15_000): Promise<string> {
  const ruta = ejecutable(nombre);
  if (!ruta) return Promise.resolve("");
  const conConsola = WINDOWS && /\.(cmd|bat)$/i.test(ruta);
  // con la consola, Node junta la orden en una línea: la ruta va entre comillas por si la carpeta del usuario tiene espacios
  return new Promise((res) => execFile(conConsola ? `"${ruta}"` : ruta, args, { env: entornoBase(), timeout: timeoutMs, windowsHide: true, shell: conConsola }, (e, out, err) => res(`${out ?? ""}${err ?? ""}`.trim() || (e ? e.message : ""))));
}

/** Ejecuta una orden del motor y espera a que termine. Para lo que dura segundos. */
export function motor(args: string[], opciones: { timeoutMs?: number } = {}): Promise<{ codigo: number; salida: string }> {
  return new Promise((resolve) => {
    execFile(PY, [SCRIPT, ...args], { env: entorno(), timeout: opciones.timeoutMs ?? 120_000, maxBuffer: 20 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      const salida = `${stdout ?? ""}${stderr ?? ""}`.trim();
      const e = err as (NodeJS.ErrnoException & { code?: number | string }) | null;
      const codigo = !e ? 0 : typeof e.code === "number" ? e.code : 1;
      resolve({ codigo, salida });
    });
  });
}

/** Lanza una orden larga (generar, corregir, ficha_ia, descripción, variaciones) sin esperar.
 *  La orden escribe su salida en <estado>.log y, al terminar, su código en <estado>.fin: así su final queda apuntado aunque
 *  el servidor de la app se reinicie o se cierre la Terminal a mitad. leerEstado() junta las piezas cada vez que alguien pregunta.
 *  (Antes la salida y el final los escribía este proceso: si se reiniciaba, o si una escritura de "en curso" llegaba tarde,
 *  la pantalla se quedaba en "Generando…" para siempre.) */
export async function motorFondo(args: string[], archivoEstado: string) {
  await fs.mkdir(path.dirname(archivoEstado), { recursive: true });
  const log = `${archivoEstado}.log`, fin = `${archivoEstado}.fin`;
  await fs.rm(fin, { force: true }); await fs.writeFile(log, "");
  // motor/lanzar.py escribe la salida en el .log y el código en el .fin (igual en Mac y en Windows)
  const hijo = spawn(PY, [path.join(MOTOR, "lanzar.py"), log, fin, SCRIPT, ...args], { env: entorno(), detached: true, stdio: "ignore", windowsHide: true });
  await fs.writeFile(archivoEstado, JSON.stringify({ estado: "en_curso", orden: args, inicio: new Date().toISOString(), salida: "", pid: hijo.pid }));
  hijo.unref();
}

function vivo(pid: unknown) {
  if (typeof pid !== "number") return true; // estados de antes de este cambio: no se puede saber
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; }
}

/** ¿Hay alguna generación o corrección en curso en cualquier carrusel? Codex comparte el cupo: solo una a la vez. */
export async function ordenEnCurso(): Promise<string | null> {
  // en todos los clientes: Codex es una sola cuenta y hace una generación a la vez
  const raiz = path.join(datos(), "perfiles");
  let salidas: string[] = [];
  try { salidas = (await fs.readdir(raiz)).map((p) => path.join(raiz, p, "salida")); } catch { salidas = [path.join(datos(), "salida")]; }
  for (const salida of salidas) {
  let carpetas: string[] = [];
  try { carpetas = await fs.readdir(salida); } catch { continue; }
  for (const c of carpetas) {
    const e = await leerEstado(path.join(salida, c, "_estado.json"));
    if (e?.estado === "en_curso") {
      // si el proceso murió sin cerrar el estado, no bloquear para siempre: 40 minutos de margen
      if (Date.now() - new Date(e.inicio).getTime() < 40 * 60_000) return c;
    }
  }
  }
  return null;
}

export async function leerEstado(archivoEstado: string) {
  let e;
  try { e = JSON.parse(await fs.readFile(archivoEstado, "utf8")); } catch { return null; }
  if (e?.estado !== "en_curso") return e;
  const salida = await leerTexto(`${archivoEstado}.log`);
  const fin = (await leerTexto(`${archivoEstado}.fin`)).trim();
  if (fin) {
    const codigo = Number(fin);
    const final = { ...e, estado: codigo === 0 ? "ok" : "error", codigo, salida, fin: new Date().toISOString() };
    await fs.writeFile(archivoEstado, JSON.stringify(final)).catch(() => {});
    return final;
  }
  if (!vivo(e.pid)) {
    const final = { ...e, estado: "error", codigo: -1, salida: `${salida}\nLa orden se interrumpió antes de terminar (¿se cerró la app, la terminal o la compu?). Vuelve a lanzarla.`.trim(), fin: new Date().toISOString() };
    await fs.writeFile(archivoEstado, JSON.stringify(final)).catch(() => {});
    return final;
  }
  return { ...e, salida };
}
export async function leerTexto(ruta: string) { try { return await fs.readFile(ruta, "utf8"); } catch { return ""; } }
export async function existe(ruta: string) { try { await fs.access(ruta); return true; } catch { return false; } }
/** El cuerpo JSON de una petición; si viene roto o vacío, un objeto vacío (cada ruta valida sus campos y responde 400). */
export async function cuerpoJson<T extends object>(req: Request): Promise<Partial<T>> {
  try { const d = await req.json(); return d && typeof d === "object" && !Array.isArray(d) ? (d as Partial<T>) : {}; } catch { return {}; }
}
/** Casillas de marca.txt con varias rutas separadas por comas (fotos, tipografia). */
export function lista(valor: string | undefined): string[] { return (valor ?? "").split(",").map((f) => f.trim()).filter(Boolean); }
export function nombreSeguro(nombre: string) { return /^[a-z0-9_\-]+$/i.test(nombre) ? nombre : null; }
export function limpiarNombre(nombre: string) {
  return nombre.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_\-]/g, "");
}

export async function leerMarca(): Promise<Record<string, string>> {
  const t = await leerTexto(path.join(cliente(), "marca", "marca.txt"));
  const m: Record<string, string> = {};
  for (const l of t.split("\n")) { const i = l.indexOf(":"); if (i > 0) m[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  return m;
}
export async function escribirMarca(m: Record<string, string>) {
  const orden = ["handle", "azul", "angulo", "ropa", "idioma", "fotos", "tipografia", "pie", "tope_imagenes_dia"];
  const lineas = orden.filter((k) => m[k] !== undefined).map((k) => `${k}: ${m[k]}`);
  for (const k of Object.keys(m)) if (!orden.includes(k)) lineas.push(`${k}: ${m[k]}`);
  await fs.mkdir(path.join(cliente(), "marca", "fotos"), { recursive: true });
  await fs.writeFile(path.join(cliente(), "marca", "marca.txt"), lineas.join("\n") + "\n");
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
  const ordenCab = ["carrusel", "slides", "cta", "viral", "bandera", "estilo", "mascotas", "cifras_confirmadas"];
  const ordenSlide = ["arriba", "titular", "azul", "subrayado", "caja", "texto", "debajo", "cta_grande", "idea", "texto_escena", "personaje", "manos", "ropa", "expresion", "siguiente"];
  // las casillas que no están en la lista se guardan al final, en su orden: si no, se perdían al guardar desde la app
  const conOrden = (o: Record<string, string>, orden: string[]) => [...orden, ...Object.keys(o).filter((k) => !orden.includes(k))];
  const out: string[] = [];
  const cab: Record<string, string> = { ...f.cabecera, slides: String(f.slides.length) };
  for (const k of conOrden(cab, ordenCab)) if (cab[k] !== undefined && cab[k] !== "") out.push(`${k}: ${cab[k]}`);
  f.slides.forEach((s, i) => { out.push("", `## ${i + 1}`); for (const k of conOrden(s, ordenSlide)) if (s[k] !== undefined && s[k] !== "") out.push(`${k}: ${s[k]}`); });
  return out.join("\n") + "\n";
}

/** Casillas de un slide donde la comprobación revisa las cifras (las mismas que ficha.py). */
const CASILLAS_CON_CIFRAS = ["titular", "debajo", "arriba", "texto_escena", "cta_grande", "texto"];
const CIFRA = /\d[\d.,]*\s?(?:mil millones|millones|millón|millon|millions?|billions?|mil|bn|[kKmMbB])?(?![\wáéíóúñ])/gi;
function cifrasDe(f: Ficha): Set<string> {
  const s = new Set<string>();
  for (const sl of f.slides) for (const c of CASILLAS_CON_CIFRAS) for (const m of (sl[c] ?? "").match(CIFRA) ?? []) {
    const cifra = m.trim().replace(/[.,]+$/, "");
    if (cifra.replace(/\D/g, "").length >= 2) s.add(cifra);
  }
  return s;
}
/** Una cifra que la persona escribe en el editor es suya: se añade a "Cifras confirmadas" para que la comprobación no la frene.
 *  Solo cuenta lo que no estaba en la ficha anterior, así que una cifra inventada por la IA sigue frenándose. */
export function confirmarCifrasEscritas(previa: Ficha | null, nueva: Ficha): Ficha {
  if (!previa) return nueva;
  const conf = nueva.cabecera.cifras_confirmadas ?? "";
  if (conf.trim().toLowerCase().startsWith("todas")) return nueva;
  const antes = cifrasDe(previa), yaConfirmadas = new Set(conf.split(",").map((x) => x.trim()).filter(Boolean));
  const nuevas = [...cifrasDe(nueva)].filter((c) => !antes.has(c) && !yaConfirmadas.has(c));
  if (!nuevas.length) return nueva;
  return { ...nueva, cabecera: { ...nueva.cabecera, cifras_confirmadas: [...yaConfirmadas, ...nuevas].join(", ") } };
}

/** Cambia el nombre de un carrusel: ficha, original y salida. */
export async function renombrar(viejo: string, nuevo: string) {
  const D = cliente();
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
  const D = cliente();
  const nombres = new Set<string>();
  for (const carpeta of ["fichas", "salida", "virales"]) {
    try { for (const f of await fs.readdir(path.join(D, carpeta))) if (!f.startsWith("_") && !f.startsWith(".") && !f.endsWith("_originales")) nombres.add(f.replace(/\.md$/, "")); } catch { /* vacío */ }
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
