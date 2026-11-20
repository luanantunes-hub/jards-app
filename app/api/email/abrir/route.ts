import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import { CAIXA_DE_ENTRADA_DO_OUTLOOK, enderecoDoOutlookValido, enderecoNoGmail } from "@/lib/email/abrir";
import { getValidEmailAccessToken, listEmailConnections } from "@/lib/email/connections";
import { provedorDaMensagem } from "@/lib/email/conversas";
import { GRAPH } from "@/lib/email/graph";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Abre no Gmail ou no Outlook a conversa de um e-mail sincronizado. É um link comum (abre em outra aba):
 * o Gmail tem endereço previsível; o Outlook só diz o endereço da mensagem a quem tem acesso à caixa,
 * então o Jards pergunta e redireciona. Só funciona para e-mails da própria caixa da pessoa.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

  try {
    const supabase = createAdminClient();
    const { data: email, error } = await (supabase as any)
      .from("emails")
      .select("message_id, thread_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!email) return NextResponse.json({ error: "E-mail não encontrado" }, { status: 404 });

    const provedor = provedorDaMensagem(email.message_id);

    if (provedor === "google") {
      const conexao = (await listEmailConnections(user.id)).find((item) => item.provider === "google");
      return NextResponse.redirect(enderecoNoGmail(conexao?.provider_account_email ?? null, email.thread_id ?? email.message_id));
    }

    try {
      const token = await getValidEmailAccessToken(user.id, "microsoft");
      const resposta = await fetch(`${GRAPH}/me/messages/${encodeURIComponent(email.message_id)}?$select=webLink`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (resposta.ok) {
        const { webLink } = (await resposta.json()) as { webLink?: unknown };
        const destino = enderecoDoOutlookValido(webLink);
        if (destino) return NextResponse.redirect(destino);
      }
    } catch {
      // Sem a conexão ou com o token vencido, a pessoa ainda chega ao Outlook, só que na caixa de entrada.
    }
    return NextResponse.redirect(CAIXA_DE_ENTRADA_DO_OUTLOOK);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao abrir o e-mail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
