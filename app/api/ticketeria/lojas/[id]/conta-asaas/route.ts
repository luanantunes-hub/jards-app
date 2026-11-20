// /api/ticketeria/lojas/{id}/conta-asaas: a subconta da loja no Asaas (parte 2 do cadeado do repasse; sem tela ainda).
//
//   POST { dados do produtor, conta_bancaria? }  cria a subconta no Asaas, guarda a chave no Vault, cria a chave Pix e devolve a situação
//   GET                         confere a situação cadastral no Asaas e atualiza (pendente, aprovada, bloqueada)
//
// Quem pede precisa EDITAR a Ticketeria da organização da loja. A chave da subconta nunca sai daqui. Sem ASAAS_API_KEY (ou sem as três travas da
// produção) responde 503 e não faz nada.

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { ErroDoAsaas, ambienteDoAsaas } from "@/lib/ticketeria/pagamento/asaas";
import { SubcontasAsaas, problemasDosDados, type DadosDoProdutor } from "@/lib/ticketeria/pagamento/asaas-subconta";
import { SubcontaSemChaveGuardada, cadastrarSubconta, problemasDaContaBancaria, type ContaBancaria } from "@/lib/ticketeria/pagamento/cadastro-subconta";
import { portasDoCadastroDoSupabase } from "@/lib/ticketeria/pagamento/portas-supabase";
import { appUrl } from "@/lib/email/config";

// Criar a subconta leva uns 40 segundos no Asaas.
export const maxDuration = 150;

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota);
  if (a.erro) return a.erro;
  const base = ambienteDoAsaas();
  if (!base) return resposta({ error: "asaas_nao_configurado" }, 503);
  let dados: DadosDoProdutor;
  let contaBancaria: ContaBancaria | null = null;
  try {
    const corpo = (await req.json()) as DadosDoProdutor & { conta_bancaria?: ContaBancaria | null };
    contaBancaria = corpo.conta_bancaria ?? null;
    dados = corpo;
  } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const problemas = [...problemasDosDados(dados), ...(contaBancaria ? problemasDaContaBancaria(contaBancaria) : [])];
  if (problemas.length > 0) return resposta({ error: "dados_invalidos", problemas }, 400);
  const { data: existente } = await a.ticketeria.from("ticketeria_contas_asaas").select("id").eq("loja_id", a.loja.id).maybeSingle();
  if (existente) return resposta({ error: "conta_ja_cadastrada" }, 409);
  try {
    const resultado = await cadastrarSubconta({
      loja: a.loja.id, dados, asaas: new SubcontasAsaas({ chaveDaConta: base.chave, url: base.url }), portas: portasDoCadastroDoSupabase(createAdminClient()), contaBancaria,
      // O aviso de pagamento da subconta vai para o webhook dela: o mesmo endereço e o mesmo token do webhook da conta principal.
      webhook: process.env.ASAAS_WEBHOOK_TOKEN ? { url: `${appUrl()}/api/ticketeria/avisos/asaas`, authToken: process.env.ASAAS_WEBHOOK_TOKEN, email: process.env.TICKETERIA_EMAIL_DE_ALERTA || "luan.antunes@jards.com.br" } : null,
      registrarErro: erro => console.error("[ticketeria] webhook da subconta não criado:", erro instanceof Error ? erro.message : erro),
    });
    return resposta({ situacao: resultado.situacao, chave_pix: resultado.chave_pix, conta_destino: resultado.conta_destino, webhook: resultado.webhook });
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
  const a = await autorizarLoja(rota);
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
