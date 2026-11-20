// /api/ticketeria/lojas/{id}/conexoes/{provedor}/contas
//   GET  → as contas de anúncios do produtor, lidas da plataforma com o token guardado: { contas: [{ id, nome, moeda, ativa, gerente, suportada }] }. Só real (BRL) é suportada por ora.
//   POST { conta_id } → escolhe a conta (precisa ser uma das que a plataforma devolve), liga a conexão e já faz a primeira leitura (o último ano de gasto).
// Quem pede precisa EDITAR a Ticketeria da organização. `provedor` é `meta` ou `google`.

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { fraseDoErro, frasePedindoNovaConexao } from "@/lib/ticketeria/midia/erro";
import { provedorDaUrl, type AdaptadorDeMidia, type ProvedorDeMidia } from "@/lib/ticketeria/midia/provedores";
import { adaptadorConfigurado, lerConexaoAgora } from "@/lib/ticketeria/midia/servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function conexaoParaEscolher(lojaId: string, provedor: ProvedorDeMidia) {
  const t = clienteDaTicketeria(createAdminClient());
  const { data } = await t.from("ticketeria_conexoes_midia").select("id, situacao").eq("loja_id", lojaId).eq("provedor", provedor).maybeSingle();
  return data && (data.situacao === "escolher_conta" || data.situacao === "ativa") ? data : null;
}

async function contasDaPlataforma(conexaoId: string, adaptador: AdaptadorDeMidia) {
  const { data: token } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_midia_token", { p_conexao: conexaoId });
  if (typeof token !== "string" || token === "") return { erro: resposta({ error: "conecte_de_novo", mensagem: frasePedindoNovaConexao(adaptador.fonte) }, 409) };
  try {
    return { contas: await adaptador.listarContas(token) };
  } catch (erro) {
    const f = fraseDoErro(erro, adaptador.fonte);
    return { erro: resposta({ error: f.tokenInvalido ? "conecte_de_novo" : "plataforma_falhou", mensagem: f.frase }, f.tokenInvalido ? 409 : 502) };
  }
}

async function preparar(rota: { params: Promise<{ id: string; provedor: string }> }, chave: string, max: number) {
  const provedor = provedorDaUrl((await rota.params).provedor);
  if (!provedor) return { erro: resposta({ error: "provedor_invalido" }, 404) };
  const a = await autorizarLoja(rota, { chave: `conexao-${provedor}-${chave}`, max });
  if (a.erro) return { erro: a.erro };
  const adaptador = adaptadorConfigurado(provedor);
  if (!adaptador) return { erro: resposta({ error: "conector_indisponivel" }, 503) };
  const conexao = await conexaoParaEscolher(a.loja.id, provedor);
  if (!conexao) return { erro: resposta({ error: "sem_conexao" }, 404) };
  return { provedor, adaptador, conexao };
}

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string; provedor: string }> }) {
  const p = await preparar(rota, "contas", 20);
  if (p.erro) return p.erro;
  const r = await contasDaPlataforma(p.conexao.id, p.adaptador);
  if (r.erro) return r.erro;
  return resposta({ contas: r.contas.map(c => ({ ...c, suportada: c.moeda === "BRL" })) });
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string; provedor: string }> }) {
  const p = await preparar(rota, "escolher", 10);
  if (p.erro) return p.erro;
  let corpo: { conta_id?: unknown } = {};
  try { corpo = (await req.json()) as { conta_id?: unknown }; } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const contaId = typeof corpo.conta_id === "string" ? corpo.conta_id.trim() : "";
  if (!/^\d{3,30}$/.test(contaId)) return resposta({ error: "conta_invalida" }, 400);
  const r = await contasDaPlataforma(p.conexao.id, p.adaptador);
  if (r.erro) return r.erro;
  const conta = r.contas.find(c => c.id === contaId);
  if (!conta) return resposta({ error: "conta_invalida" }, 400);
  if (conta.moeda !== "BRL") return resposta({ error: "moeda_nao_suportada", mensagem: "Por enquanto só contas em real (BRL)." }, 409);
  const admin = createAdminClient();
  const t = clienteDaTicketeria(admin);
  const { error } = await t.rpc("fn_ticketeria_midia_escolher_conta", { p_conexao: p.conexao.id, p_conta: conta.id, p_nome: conta.nome, p_moeda: conta.moeda });
  if (error) {
    console.error("[ticketeria] escolher conta de mídia:", error.message);
    return resposta({ error: "falha_ao_gravar" }, 500);
  }
  const { error: erroGerente } = await t.rpc("fn_ticketeria_midia_definir_gerente", { p_conexao: p.conexao.id, p_gerente: conta.gerente ?? null });
  if (erroGerente) {
    console.error("[ticketeria] definir a conta gerente:", erroGerente.message);
    return resposta({ error: "falha_ao_gravar" }, 500);
  }
  const leitura = await lerConexaoAgora(admin, p.conexao.id);
  return resposta({ ok: true, leitura: leitura ?? { ok: false, erro: "Não foi possível ler agora.", token_invalido: false } });
}
