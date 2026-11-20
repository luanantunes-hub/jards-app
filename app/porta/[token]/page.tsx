// A porta da equipe pelo link (sem login): /porta/{segredo}. Quem recebe o link do produtor lê o QR Code, digita o código ou busca pelo nome, SÓ na sessão do link, no celular.
// O segredo é a prova; a página não consulta nada no servidor (a tela pergunta à rota da equipe, que confere se o link vale). Fora do índice dos buscadores e sem cache.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortaDaEquipe } from "@/components/ticketeria/PortaDaEquipe";
import { TOKEN_DO_LINK } from "@/lib/ticketeria/porta";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Porta", robots: { index: false, follow: false } };

export default async function PaginaDaPortaDaEquipe({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_DO_LINK.test(token)) notFound();
  return <div className="min-h-screen bg-[#FAFAF8] text-[#282525]"><PortaDaEquipe token={token} /></div>;
}
