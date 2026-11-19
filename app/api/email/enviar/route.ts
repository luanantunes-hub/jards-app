import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import type { EmailProvider } from "@/lib/email/config";
import { getEmailConnection, listEmailConnections } from "@/lib/email/connections";
import { provedorDaMensagem } from "@/lib/email/conversas";
import { MAXIMO_DE_AGENDADOS_POR_PESSOA, podeEnviarPelaConexao, validarPedidoDeEnvio } from "@/lib/email/envio";
import { enviarPelaConta, ErroDeEnvio, type MensagemRespondida } from "@/lib/email/enviar";
import { podeConectarEmail } from "@/lib/email/liberacao";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

const ROTULO: Record<EmailProvider, string> = { google: "Gmail", microsoft: "Outlook" };

/**
 * Escreve, responde ou agenda um e-mail pela caixa da própria pessoa. Com `enviarEm`, guarda na fila e a rotina do banco
 * envia na hora; sem, envia agora. `responderAEmailId` (um e-mail da pessoa) mantém a resposta no mesmo fio.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const validacao = validarPedidoDeEnvio(corpo);
  if (!validacao.ok) return NextResponse.json({ error: validacao.erro }, { status: 400 });
  const { pedido } = validacao;

  try {
    const admin = createAdminClient();
    const conexoes = await listEmailConnections(user.id);
    if (conexoes.length === 0) return NextResponse.json({ error: "Conecte seu e-mail em Configurações › Minhas ferramentas para enviar." }, { status: 409 });

    // De que caixa sai: a da mensagem respondida; senão a pedida; senão a única conectada.
    let resposta: MensagemRespondida | null = null;
    let provider: EmailProvider | null = corpo?.provider === "google" || corpo?.provider === "microsoft" ? corpo.provider : null;
    if (pedido.responderAEmailId) {
      const { data: original } = await (admin as any)
        .from("emails")
        .select("message_id, thread_id, internet_message_id")
        .eq("id", pedido.responderAEmailId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!original) return NextResponse.json({ error: "Não encontrei o e-mail que você quer responder." }, { status: 404 });
      resposta = { messageId: original.message_id, threadId: original.thread_id, internetMessageId: original.internet_message_id };
      provider = provedorDaMensagem(original.message_id);
    }
    if (!provider) {
      if (conexoes.length > 1) return NextResponse.json({ error: "Escolha de qual conta enviar." }, { status: 400 });
      provider = conexoes[0].provider;
    }

    const conexao = await getEmailConnection(user.id, provider);
    if (!conexao) return NextResponse.json({ error: `Conecte seu ${ROTULO[provider]} em Configurações › Minhas ferramentas para enviar.` }, { status: 409 });
    if (!(await podeConectarEmail({ id: user.id, email: user.email }, conexao.organization_id))) {
      return NextResponse.json({ error: "O e-mail ainda está em teste fechado." }, { status: 403 });
    }
    if (!podeEnviarPelaConexao(provider, conexao.scopes)) {
      return NextResponse.json(
        { error: `Reconecte seu ${ROTULO[provider]} em Configurações › Minhas ferramentas e autorize o envio de e-mails.`, reconectar: provider },
        { status: 409 },
      );
    }

    if (pedido.enviarEm) {
      if (!conexao.organization_id) return NextResponse.json({ error: "Conexão sem organização válida." }, { status: 400 });
      const { count } = await (admin as any)
        .from("email_agendados")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("estado", ["pendente", "enviando"]);
      if ((count ?? 0) >= MAXIMO_DE_AGENDADOS_POR_PESSOA) {
        return NextResponse.json({ error: `Você já tem ${MAXIMO_DE_AGENDADOS_POR_PESSOA} e-mails agendados. Cancele algum ou espere o envio.` }, { status: 409 });
      }
      const { data: criado, error } = await (admin as any)
        .from("email_agendados")
        .insert({
          user_id: user.id,
          organization_id: conexao.organization_id,
          provider,
          para: pedido.para,
          cc: pedido.cc,
          cco: pedido.cco,
          assunto: pedido.assunto,
          texto: pedido.texto,
          responder_a_email_id: pedido.responderAEmailId,
          enviar_em: pedido.enviarEm.toISOString(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ agendado: true, id: criado.id, enviarEm: pedido.enviarEm.toISOString() });
    }

    await enviarPelaConta(user.id, provider, pedido, resposta);
    return NextResponse.json({ enviado: true });
  } catch (err) {
    if (err instanceof ErroDeEnvio) {
      const status = err.codigo === "provedor" ? 502 : 409;
      return NextResponse.json({ error: err.message }, { status });
    }
    const message = err instanceof Error ? err.message : "Erro ao enviar o e-mail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
