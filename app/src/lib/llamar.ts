/** Llamada a la API de la app desde una pantalla. Nunca lanza: si no hay conexión o la respuesta no es JSON,
 *  devuelve un error con un texto que se puede enseñar tal cual (antes esos fallos no salían en pantalla). */
export const SIN_CONEXION = "No hay conexión con la app. Comprueba que la ventana de la terminal con la app (arrancar.sh en Mac, arrancar.cmd en Windows) sigue abierta y vuelve a intentarlo.";

export async function llamar<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; datos: T & { error?: string } }> {
  let r: Response;
  try { r = await fetch(url, init); } catch { return { ok: false, status: 0, datos: { error: SIN_CONEXION } as T & { error?: string } }; }
  let datos: T & { error?: string };
  try { datos = await r.json(); } catch { datos = { error: r.ok ? undefined : `La app respondió con un error (${r.status}). Vuelve a intentarlo; si se repite, reinicia ./arrancar.sh.` } as T & { error?: string }; }
  if (!r.ok && !datos?.error) datos = { ...datos, error: `La app respondió con un error (${r.status}).` };
  return { ok: r.ok, status: r.status, datos };
}

export function postJson(cuerpo: unknown, metodo = "POST"): RequestInit {
  return { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) };
}
