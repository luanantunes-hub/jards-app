// /api/ticketeria/lojas/{id}/conexoes/meta/contas
//   GET  → as contas de anúncios do produtor, lidas da Meta com o token guardado: { contas: [{ id, nome, moeda, ativa, suportada }] }. Só real (BRL) é suportada por ora.
//   POST { conta_id } → escolhe a conta (precisa ser uma das que a Meta devolve), liga a conexão e já faz a primeira leitura (o último ano de gasto).
// Quem pede precisa EDITAR a Ticketeria da organização.

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { fraseDoErro, listarContasDaMeta } from "@/lib/ticketeria/midia/meta";
import { buscarNaMeta, lerConexaoAgora, metaConfigurada } from "@/lib/ticketeria/midia/servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function conexaoParaEscolher(lojaId: string) {
  const t = clienteDaTicketeria(createAdminClient());
  const { data } = await t.from("ticketeria_conexoes_midia").select("id, situacao").eq("loja_id", lojaId).eq("provedor", "meta").maybeSingle();
  return data && (data.situacao === "escolher_conta" || data.situacao === "ativa") ? data : null;
}

async function contasDaMeta(conexaoId: string) {
  const config = metaConfigurada();
  if (!config) return { erro: resposta({ error: "meta_indisponivel" }, 503) };
  const { data: token } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_midia_token", { p_conexao: conexaoId });
  if (typeof token !== "string" || token === "") return { erro: resposta({ error: "conecte_de_novo", mensagem: "O acesso ao Meta venceu ou foi retirado. Conecte de novo." }, 409) };
  try {
    return { config, contas: await listarContasDaMeta(config, token, buscarNaMeta) };
  } catch (erro) {
    const f = fraseDoErro(erro);
    return { erro: resposta({ error: f.tokenInvalido ? "conecte_de_novo" : "meta_falhou", mensagem: f.frase }, f.tokenInvalido ? 409 : 502) };
  }
}

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "conexao-meta-contas", max: 20 });
  if (a.erro) return a.erro;
  const conexao = await conexaoParaEscolher(a.loja.id);
  if (!conexao) return resposta({ error: "sem_conexao" }, 404);
  const r = await contasDaMeta(conexao.id);
  if (r.erro) return r.erro;
  return resposta({ contas: r.contas.map(c => ({ ...c, suportada: c.moeda === "BRL" })) });
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "conexao-meta-escolher", max: 10 });
  if (a.erro) return a.erro;
  let corpo: { conta_id?: unknown } = {};
  try { corpo = (await req.json()) as { conta_id?: unknown }; } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const contaId = typeof corpo.conta_id === "string" ? corpo.conta_id.trim() : "";
  if (!/^\d{3,30}$/.test(contaId)) return resposta({ error: "conta_invalida" }, 400);
  const conexao = await conexaoParaEscolher(a.loja.id);
  if (!conexao) return resposta({ error: "sem_conexao" }, 404);
  const r = await contasDaMeta(conexao.id);
  if (r.erro) return r.erro;
  const conta = r.contas.find(c => c.id === contaId);
  if (!conta) return resposta({ error: "conta_invalida" }, 400);
  if (conta.moeda !== "BRL") return resposta({ error: "moeda_nao_suportada", mensagem: "Por enquanto só contas em real (BRL)." }, 409);
  const admin = createAdminClient();
  const { error } = await clienteDaTicketeria(admin).rpc("fn_ticketeria_midia_escolher_conta", { p_conexao: conexao.id, p_conta: conta.id, p_nome: conta.nome, p_moeda: conta.moeda });
  if (error) {
    console.error("[ticketeria] escolher conta da Meta:", error.message);
    return resposta({ error: "falha_ao_gravar" }, 500);
  }
  const leitura = await lerConexaoAgora(admin, r.config, conexao.id);
  return resposta({ ok: true, leitura: leitura ?? { ok: false, erro: "Não foi possível ler agora.", token_invalido: false } });
}
