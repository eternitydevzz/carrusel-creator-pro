// Recargas que hace la propia app (cambiar o eliminar cliente, cancelar la bienvenida): van a la página entera para que
// todas las pantallas pidan sus datos de nuevo, pero sin la intro de Código MaestrIA, que solo sale al abrir o recargar tú.

export const CLAVE_SIN_INTRO = "ccp-sin-intro";

export function recargarSinIntro(ruta = "/") {
  try { sessionStorage.setItem(CLAVE_SIN_INTRO, "1"); } catch { /* sin almacenamiento: saldrá la intro, nada más */ }
  window.location.assign(new URL(ruta, window.location.origin).href);
}

/** Aviso para que el selector de clientes vuelva a leer los datos (tras guardar el nombre o las fotos de un cliente). */
export const EVENTO_PERFILES = "ccp-perfiles-cambiados";
export function avisarPerfilesCambiados() { window.dispatchEvent(new Event(EVENTO_PERFILES)); }
