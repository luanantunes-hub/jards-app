// POST /api/ticketeria/lojas/{id}/remetente/teste: manda UM e-mail de teste, do domínio da loja, para quem pede (para ver como chega e conferir que o domínio funciona). Não gasta a cota nem grava nada.
//   → 200 { teste: true } | 402 email_nao_ativo (sem assinatura ou domínio ainda não verificado) | 409 sem_email_para_o_teste | 502 teste_falhou

import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/email/config";
import { enviarEmailDeDivulgacao } from "@/lib/email/divulgacao";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { emailDeDivulgacao } from "@/lib/ticketeria/envios";
import { remetenteParaEnviar } from "@/lib/ticketeria/remetente-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "remetente-teste", max: 10 });
  if (a.erro) return a.erro;
  const email = a.user.email;
  if (!email) return resposta({ error: "sem_email_para_o_teste" }, 409);
  try {
    const admin = createAdminClient();
    const de = await remetenteParaEnviar(admin, a.loja.id);
    if (!de) return resposta({ error: "email_nao_ativo", motivo: "dominio_nao_verificado" }, 402);
    const { data: loja } = await clienteDaTicketeria(admin).from("ticketeria_lojas").select("nome").eq("id", a.loja.id).maybeSingle();
    const origem = appUrl();
    const e = emailDeDivulgacao({
      loja: loja?.nome ?? "o organizador", nome: email.split("@")[0], assunto: "[Teste] E-mail do seu domínio",
      mensagem: "Olá, {nome}!\n\nEste é um e-mail de teste: se ele chegou, o envio pelo seu domínio está funcionando.",
      enderecoDeCompra: origem, enderecoParaSair: `${origem}/novidades/teste`,
    });
    const r = await enviarEmailDeDivulgacao({ to: email, subject: e.assunto, html: e.html, text: e.texto, enderecoDoCliqueUnico: `${origem}/api/ticketeria/novidades/sair?token=teste`, idempotencyKey: `ticketeria-remetente-teste-${a.user.id}-${Date.now()}` }, de);
    return r.ok ? resposta({ teste: true }) : resposta({ error: "teste_falhou" }, 502);
  } catch (erro) {
    console.error("[ticketeria] teste do remetente:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "teste_falhou" }, 502);
  }
}
