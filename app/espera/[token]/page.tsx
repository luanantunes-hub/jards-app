// Sair da lista de espera (sem login): /espera/{token}. O token (UUID sorteado) vai no e-mail de aviso e é a prova. A página só mostra o botão; quem apaga é o botão.
// Fora do índice dos buscadores e sem cache.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SairDaEspera } from "@/components/ticketeria/SairDaEspera";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ticketeria.sair.espera");
  return { title: t("titulo"), robots: { index: false, follow: false } };
}

export default async function PaginaSairDaEspera({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  return <SairDaEspera token={token.toLowerCase()} />;
}
