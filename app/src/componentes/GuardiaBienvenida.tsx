"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** La primera vez del equipo (nada configurado) lleva a la bienvenida. A un cliente con la marca a medias no se le encierra:
 *  el selector lo marca como "Marca sin completar" y desde ahí se termina. Se comprueba al abrir la app y al cambiar de pantalla. */
export function GuardiaBienvenida() {
  const ruta = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (ruta.startsWith("/bienvenida")) return;
    let vivo = true;
    fetch("/api/bienvenida", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { hecha: boolean; modo: string }) => { if (vivo && !d.hecha && d.modo === "inicial") router.replace("/bienvenida"); })
      .catch(() => { /* sin respuesta: la app sigue normal */ });
    return () => { vivo = false; };
  }, [ruta, router]);
  return null;
}
