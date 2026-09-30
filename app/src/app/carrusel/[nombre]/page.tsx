import { Carrusel } from "@/componentes/Carrusel";

export default async function Pagina({ params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  return <Carrusel nombre={nombre} />;
}
