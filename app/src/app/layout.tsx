import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Barra } from "@/componentes/Barra";
import { GuardiaBienvenida } from "@/componentes/GuardiaBienvenida";
import { CLAVE_SIN_INTRO } from "@/lib/navegacion";

// Intro de Código MaestrIA (la de la landing, landing-maestria/intro-matrix): sale en cada carga o recarga (F5).
// Las recargas que hace la app sola dejan una nota de un solo uso (lib/navegacion.ts) y esas van sin intro.
// Se salta con clic, Escape, Enter o espacio; con "reducir movimiento" en el sistema no sale.
const CONFIG_INTRO = `(function(){var s=false;try{s=sessionStorage.getItem("${CLAVE_SIN_INTRO}")==="1";sessionStorage.removeItem("${CLAVE_SIN_INTRO}");if(s)sessionStorage.setItem("ccp-intro-vista","1");}catch(e){}
window.CM_INTRO_CONFIG=s?{oncePerSession:true,storageKey:"ccp-intro-vista"}:{oncePerSession:false};})();`;

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "Carrusel Creator Pro",
  description: "Crea carruseles de Instagram con tu marca a partir de carruseles virales, con Codex.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // la intro pone la clase cm-intro-lock en <html> antes de que React arranque (bloquea el scroll mientras se ve)
    <html lang="es" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <Script id="config-intro" strategy="beforeInteractive">{CONFIG_INTRO}</Script>
        <Script src="/intro/matrix-intro.min.js" strategy="beforeInteractive" />
        <div className="escena" aria-hidden="true"><div className="brillo" /></div>
        <GuardiaBienvenida />
        <div className="mx-auto flex min-h-dvh w-full max-w-[1400px] flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:gap-6 lg:px-8">
          <Barra />
          <main id="contenido" className="min-w-0 flex-1 pb-16">{children}</main>
        </div>
      </body>
    </html>
  );
}
