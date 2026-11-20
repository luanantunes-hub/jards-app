// POST /api/producao/convite-folha (PD1.12): manda por e-mail o convite para a pessoa da equipe ver a própria folha.
//
// O endereço vem sempre do acesso gravado no banco (nunca do corpo do pedido), então a rota não serve para mandar
// e-mail a quem não foi convidado. Quem manda precisa editar a produção da organização; as regras de leitura do banco
// valem (a leitura do acesso passa pela sessão de quem pede). O link é o de /minha-folha: a pessoa entra, ou cria a
// conta, com o e-mail do convite.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { conviteDaFolhaEmail } from "@/lib/email/templates";
import { nomeDaOrganizacao, nomeDeQuemConvida } from "@/lib/email/nomes-do-convite";
import { isRateLimited } from "@/lib/mcp/rateLimit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });

  const corpo = await req.json().catch(() => null) as { pessoa_id?: unknown } | null;
  const pessoaId = typeof corpo?.pessoa_id === "string" ? corpo.pessoa_id : "";
  if (!UUID.test(pessoaId)) return NextResponse.json({ error: "pessoa_invalida" }, { status: 400 });

  // No máximo 20 convites por hora por pessoa que convida, e um por minuto para o mesmo acesso.
  if (isRateLimited(`convite-folha:${user.id}`, 20, 60 * 60_000)) return NextResponse.json({ error: "muitos_envios" }, { status: 429 });

  const producao = clienteDaProducao(supabase);
  const { data: acesso } = await producao.from("producao_acessos_equipe")
    .select("id, organization_id, email, revogado_em, user_id").eq("pessoa_id", pessoaId).maybeSingle();
  if (!acesso || acesso.revogado_em) return NextResponse.json({ error: "sem_acesso" }, { status: 404 });

  const { data: podeEditar } = await producao.rpc("auth_producao_pode", { p_org: acesso.organization_id, p_acao: "editar" });
  if (podeEditar !== true) return NextResponse.json({ error: "sem_permissao" }, { status: 403 });

  const [{ data: pessoa }, nomeOrganizacao, nomeConvidante] = await Promise.all([
    producao.from("producao_pessoas").select("nome").eq("id", pessoaId).maybeSingle(),
    nomeDaOrganizacao(supabase, acesso.organization_id),
    nomeDeQuemConvida(supabase, user.id),
  ]);

  const mensagem = conviteDaFolhaEmail({
    recipientName: pessoa?.nome ?? null,
    organizacao: nomeOrganizacao ?? "Uma produção",
    convidadoPor: nomeConvidante,
    url: `${req.nextUrl.origin}/minha-folha`,
  });
  // A chave muda a cada minuto: duplo clique não manda duas vezes, e reenviar depois funciona.
  const envio = await sendTransactionalEmail({
    to: acesso.email, ...mensagem, idempotencyKey: `convite-folha-${acesso.id}-${Math.floor(Date.now() / 60_000)}`,
  });
  if (!envio.ok) {
    return NextResponse.json({ error: envio.notConfigured ? "nao_configurado" : "falha_no_envio" }, { status: envio.notConfigured ? 503 : 502 });
  }
  return NextResponse.json({ enviadoPara: acesso.email });
}
