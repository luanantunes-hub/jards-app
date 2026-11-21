// Sair da lista de novidades do produtor (sem login): /novidades/{token}. O token (UUID sorteado) vai no e-mail de divulgação e é a prova. A página só mostra o botão; quem grava a
// saída é o botão. Fora do índice dos buscadores e sem cache.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SairDasNovidades } from "@/components/ticketeria/SairDasNovidades";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ticketeria.sair.novidades");
  return { title: t("titulo"), robots: { index: false, follow: false } };
}

export default async function PaginaSairDasNovidades({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  const t = clienteDaTicketeria(createAdminClient());
  const { data: destinatario } = await t.from("ticketeria_envio_destinatarios").select("envio_id").eq("token", token.toLowerCase()).maybeSingle();
  if (!destinatario) notFound();
  const { data: envio } = await t.from("ticketeria_envios").select("loja_id").eq("id", destinatario.envio_id).maybeSingle();
  const { data: loja } = envio ? await t.from("ticketeria_lojas").select("nome").eq("id", envio.loja_id).maybeSingle() : { data: null };
  return <SairDasNovidades token={token.toLowerCase()} loja={loja?.nome ?? null} />;
}
