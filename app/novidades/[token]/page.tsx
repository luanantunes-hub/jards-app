// A central de preferências do produtor (sem login): /novidades/{token}, o link "Sair da lista" do e-mail de divulgação. O token (UUID sorteado) vai no e-mail e é a prova. A pessoa
// escolhe quantos e-mails recebe e sobre o quê; "Não quero receber mais nada" leva à saída de sempre. Só os botões gravam. Fora do índice dos buscadores e sem cache.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CentralDePreferencias } from "@/components/ticketeria/CentralDePreferencias";
import type { Dias, Frequencia } from "@/lib/ticketeria/envios-controle";
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
  const { data: destinatario } = await t.from("ticketeria_envio_destinatarios").select("envio_id, email").eq("token", token.toLowerCase()).maybeSingle();
  if (!destinatario) notFound();
  const { data: envio } = await t.from("ticketeria_envios").select("loja_id").eq("id", destinatario.envio_id).maybeSingle();
  const { data: loja } = envio ? await t.from("ticketeria_lojas").select("nome, limite_emails_semana").eq("id", envio.loja_id).maybeSingle() : { data: null };
  const { data: pref } = envio ? await t.from("ticketeria_preferencias").select("frequencia, dias").eq("loja_id", envio.loja_id).eq("email", destinatario.email.trim().toLowerCase()).maybeSingle() : { data: null };
  return <CentralDePreferencias token={token.toLowerCase()} loja={loja?.nome ?? null} limite={loja?.limite_emails_semana ?? 3} inicial={{ frequencia: (pref?.frequencia as Frequencia) ?? "tudo", dias: (pref?.dias as Dias) ?? "qualquer" }} />;
}
