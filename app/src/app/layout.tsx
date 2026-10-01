import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Barra } from "@/componentes/Barra";
import { GuardiaBienvenida } from "@/componentes/GuardiaBienvenida";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "Carrusel Creator Pro",
  description: "Crea carruseles de Instagram con tu marca a partir de carruseles virales, con Codex.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-dvh">
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
