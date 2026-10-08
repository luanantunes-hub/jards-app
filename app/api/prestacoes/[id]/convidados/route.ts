// POST /api/prestacoes/[id]/convidados (P5.3): convida alguém de fora da
// equipe para acompanhar a prestação.
//
// O convite nasce em fn_prestacao_convidar com a sessão de quem convida (o
// banco confere se a pessoa edita a prestação). O link volta uma vez, para a
// tela mostrar e copiar, e segue por e-mail quando o envio transacional está
// configurado. Quem recebe entra (ou cria a conta) com o e-mail convidado.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { conviteDaPrestacaoEmail } from "@/lib/email/templates";
import { enderecoDoConvite, textoDasSecoes } from "@/lib/prestacao/convidados";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "prestacao_inexistente" }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });

  const corpo = await req.json().catch(() => null) as {
    email?: unknown; nome?: unknown; papel?: unknown; secoes?: unknown; expira_em?: unknown; mensagem?: unknown;
  } | null;
  const texto = (v: unknown) => (typeof v === "string" ? v : "");
  const secoes = Array.isArray(corpo?.secoes) ? corpo.secoes.filter((s): s is string => typeof s === "string") : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
  const { data, error } = await (supabase as any).rpc("fn_prestacao_convidar", {
    p_prestacao_id: id,
    p_email: texto(corpo?.email),
    p_nome: texto(corpo?.nome) || null,
    p_papel: texto(corpo?.papel) || "outro",
    p_secoes: secoes,
    p_expira_em: texto(corpo?.expira_em) || null,
    p_mensagem: texto(corpo?.mensagem) || null,
  });
  if (error || !data?.token) {
    const status = error?.code === "42501" ? 403 : error?.code === "P0002" ? 404 : 400;
    return NextResponse.json({ error: error?.message ?? "Não foi possível criar o convite" }, { status });
  }

  const link = enderecoDoConvite(req.nextUrl.origin, data.token);

  // O que o e-mail diz vem do próprio convite, lido pelo link.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
  const { data: convite } = await (supabase as any).rpc("fn_convite_publico", { p_token: data.token });
  let emailEnviado = false;
  let avisoEmail: string | null = null;
  if (convite?.email) {
    const mensagem = conviteDaPrestacaoEmail({
      recipientName: convite.nome,
      organizacao: convite.organizacao?.nome ?? "Uma organização",
      convidadoPor: convite.convidado_por,
      prestacao: convite.prestacao?.titulo ?? "um projeto",
      secoes: textoDasSecoes(convite.secoes ?? []),
      validade: dataBr(convite.expira_em),
      mensagem: convite.mensagem,
      url: link,
    });
    const envio = await sendTransactionalEmail({ to: convite.email, ...mensagem, idempotencyKey: `convite-prestacao-${data.id}` });
    emailEnviado = envio.ok;
    if (!envio.ok) avisoEmail = envio.notConfigured ? "nao_configurado" : envio.error;
  }

  return NextResponse.json({ id: data.id, link, emailEnviado, avisoEmail });
}
