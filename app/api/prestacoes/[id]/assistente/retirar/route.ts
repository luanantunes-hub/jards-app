// POST /api/prestacoes/[id]/assistente/retirar: a equipe retira uma despesa ou evidência que o assistente (Claude ou
// ChatGPT) criou. O acesso é conferido com a sessão de quem pediu; a retirada usa a chave de serviço, com as mesmas
// conferências do conector (lib/mcp/prestacao/desfazer.ts).

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { retirarPelaEquipe, type SessaoDaEquipe } from "@/lib/mcp/prestacao/retirada-da-equipe";
import { ErroMcp } from "@/lib/mcp/validacao";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Prestação não encontrada." }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });

  const corpo: unknown = await req.json().catch(() => null);
  const acaoId = corpo && typeof corpo === "object" ? (corpo as { acao_id?: unknown }).acao_id : null;
  if (typeof acaoId !== "string" || !UUID.test(acaoId)) return NextResponse.json({ error: "Informe a ação a retirar." }, { status: 400 });

  const sessao: SessaoDaEquipe = {
    userId: user.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    enxerga: async (prestacaoId) => Boolean((await (supabase as any).from("prestacoes_contas").select("id").eq("id", prestacaoId).maybeSingle()).data),
    podeEditar: async (prestacaoId) => (await supabase.rpc("auth_prestacao_pode" as never, { p_prestacao_id: prestacaoId, p_acao: "editar" } as never)).data === true,
  };

  try {
    const { retirado, resumo } = await retirarPelaEquipe({ sessao, admin: createAdminClient(), prestacaoId: id, acaoId });
    return NextResponse.json({ retirado, resumo });
  } catch (erro) {
    if (erro instanceof ErroMcp) return NextResponse.json({ error: erro.message }, { status: erro.status });
    console.error("[assistente/retirar] falhou", id, erro);
    return NextResponse.json({ error: "Não foi possível retirar agora. Tente de novo em instantes." }, { status: 500 });
  }
}
