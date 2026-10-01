"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Si la marca está sin configurar, lleva a la bienvenida. Se comprueba al abrir la app y al cambiar de pantalla. */
export function GuardiaBienvenida() {
  const ruta = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (ruta.startsWith("/bienvenida")) return;
    let vivo = true;
    fetch("/api/bienvenida", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { hecha: boolean }) => { if (vivo && !d.hecha) router.replace("/bienvenida"); })
      .catch(() => { /* sin respuesta: la app sigue normal */ });
    return () => { vivo = false; };
  }, [ruta, router]);
  return null;
}
