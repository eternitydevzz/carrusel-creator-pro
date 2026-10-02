import type { MetadataRoute } from "next";

/** Manifiesto de la app: con él, Chrome deja "Instalar" Carrusel Creator Pro como una app con su ventana, su nombre y el logo
 *  de Código MaestrIA en el Dock. Sigue siendo la misma app local (necesita ./arrancar.sh en marcha). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Carrusel Creator Pro",
    short_name: "Carruseles",
    description: "Carruseles de Instagram con tu marca, de Código MaestrIA.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#030a22",
    theme_color: "#030a22",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
