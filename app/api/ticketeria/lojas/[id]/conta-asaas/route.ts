// /api/ticketeria/lojas/{id}/conta-asaas: a subconta da loja no Asaas (parte 2 do cadeado do repasse; sem tela ainda).
//
//   POST { dados do produtor }  cria a subconta no Asaas, guarda a chave no Vault, cria a chave Pix e devolve a situação
//   GET                         confere a situação cadastral no Asaas e atualiza (pendente, aprovada, bloqueada)
//
// Quem pede precisa EDITAR a Ticketeria da organização da loja. A chave da subconta nunca sai daqui. Sem ASAAS_API_KEY (ou sem as três travas da
// produção) responde 503 e não faz nada.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ErroDoAsaas, ambienteDoAsaas } from "@/lib/ticketeria/pagamento/asaas";
import { SubcontasAsaas, problemasDosDados, type DadosDoProdutor } from "@/lib/ticketeria/pagamento/asaas-subconta";
import { SubcontaSemChaveGuardada, cadastrarSubconta } from "@/lib/ticketeria/pagamento/cadastro-subconta";
import { portasDoCadastroDoSupabase } from "@/lib/ticketeria/pagamento/portas-supabase";
import { isRateLimited } from "@/lib/mcp/rateLimit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resposta = (corpo: object, status = 200) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

async function autorizar(rota: { params: Promise<{ id: string }> }) {
  const { id } = await rota.params;
  if (!UUID.test(id)) return { erro: resposta({ error: "loja_invalida" }, 400) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: resposta({ error: "nao_autenticado" }, 401) };
  if (isRateLimited(`conta-asaas:${user.id}`, 10)) return { erro: resposta({ error: "muitas_tentativas" }, 429) };
  const ticketeria = clienteDaTicketeria(supabase);
  const { data: loja } = await ticketeria.from("ticketeria_lojas").select("id, organization_id").eq("id", id).maybeSingle();
  if (!loja) return { erro: resposta({ error: "loja_nao_encontrada" }, 404) };
  const { data: pode } = await ticketeria.rpc("auth_ticketeria_pode", { p_org: loja.organization_id, p_acao: "editar" });
  if (pode !== true) return { erro: resposta({ error: "sem_permissao" }, 403) };
  return { loja, ticketeria, admin: clienteDaTicketeria(createAdminClient()) };
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizar(rota);
  if (a.erro) return a.erro;
  const base = ambienteDoAsaas();
  if (!base) return resposta({ error: "asaas_nao_configurado" }, 503);
  let dados: DadosDoProdutor;
  try { dados = (await req.json()) as DadosDoProdutor; } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const problemas = problemasDosDados(dados);
  if (problemas.length > 0) return resposta({ error: "dados_invalidos", problemas }, 400);
  const { data: existente } = await a.ticketeria.from("ticketeria_contas_asaas").select("id").eq("loja_id", a.loja.id).maybeSingle();
  if (existente) return resposta({ error: "conta_ja_cadastrada" }, 409);
  try {
    const resultado = await cadastrarSubconta({
      loja: a.loja.id, dados, asaas: new SubcontasAsaas({ chaveDaConta: base.chave, url: base.url }), portas: portasDoCadastroDoSupabase(createAdminClient()),
    });
    return resposta({ situacao: resultado.situacao, chave_pix: resultado.chave_pix });
  } catch (erro) {
    if (erro instanceof SubcontaSemChaveGuardada) {
      console.error("[ticketeria] subconta criada no Asaas sem a chave guardada:", erro.message);
      return resposta({ error: "cadastro_incompleto" }, 500);
    }
    if (erro instanceof ErroDoAsaas) return resposta({ error: "asaas_recusou", codigos: erro.codigos }, 502);
    console.error("[ticketeria] cadastro de subconta falhou:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_no_cadastro" }, 500);
  }
}

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizar(rota);
  if (a.erro) return a.erro;
  const { data: conta } = await a.ticketeria.from("ticketeria_contas_asaas").select("situacao").eq("loja_id", a.loja.id).maybeSingle();
  if (!conta) return resposta({ cadastrada: false });
  const base = ambienteDoAsaas();
  if (!base || conta.situacao === "bloqueada") return resposta({ cadastrada: true, situacao: conta.situacao });
  try {
    const { data: chave } = await a.admin.rpc("fn_ticketeria_chave_da_conta_asaas", { p_loja: a.loja.id });
    if (!chave) return resposta({ cadastrada: true, situacao: conta.situacao });
    const atual = await new SubcontasAsaas({ chaveDaConta: base.chave, url: base.url }).situacao(chave);
    if (atual !== conta.situacao) await a.admin.rpc("fn_ticketeria_situacao_da_conta_asaas", { p_loja: a.loja.id, p_situacao: atual });
    return resposta({ cadastrada: true, situacao: atual });
  } catch (erro) {
    console.error("[ticketeria] conferência da subconta falhou:", erro instanceof Error ? erro.message : erro);
    return resposta({ cadastrada: true, situacao: conta.situacao });
  }
}
