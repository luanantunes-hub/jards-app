// /api/ticketeria/lojas/{id}/porta: conferir os ingressos na entrada do evento (passo C5 da T5). Quem pede precisa EDITAR a Ticketeria da organização da loja.
//
//   GET  ?sessao={id}                     o resumo da sessão: quantos ingressos válidos, quantos já entraram e as últimas entradas
//   POST { sessao_id, codigo }            confere o código e, se vale, marca como usado (uma vez só): pode_entrar, ja_usado, outra_sessao, cancelado ou nao_encontrado

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { normalizarCodigo, resultadoDaConferencia, resumoDaPorta } from "@/lib/ticketeria/porta";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function erroDaPorta(erro: { message?: string } | null) {
  if (erro?.message?.includes("sessao_inexistente")) return resposta({ error: "sessao_inexistente" }, 404);
  console.error("[ticketeria] porta:", erro?.message);
  return resposta({ error: "falha_na_porta" }, 500);
}

export async function GET(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "porta-resumo", max: 120 });
  if (a.erro) return a.erro;
  const sessao = req.nextUrl.searchParams.get("sessao") ?? "";
  if (!UUID.test(sessao)) return resposta({ error: "sessao_invalida" }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_porta_resumo", { p_loja: a.loja.id, p_sessao: sessao.toLowerCase() });
  if (error) return erroDaPorta(error);
  const resumo = resumoDaPorta(data);
  return resumo ? resposta(resumo) : resposta({ error: "resposta_inesperada" }, 500);
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  // Quem confere ingressos lê um atrás do outro: o teto é alto.
  const a = await autorizarLoja(rota, { chave: "porta-conferir", max: 240 });
  if (a.erro) return a.erro;
  let corpo: { sessao_id?: unknown; codigo?: unknown };
  try { corpo = await req.json(); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const sessao = typeof corpo.sessao_id === "string" ? corpo.sessao_id : "";
  const codigo = typeof corpo.codigo === "string" ? normalizarCodigo(corpo.codigo.slice(0, 500)) : "";
  if (!UUID.test(sessao)) return resposta({ error: "sessao_invalida" }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_conferir_ingresso", { p_loja: a.loja.id, p_sessao: sessao.toLowerCase(), p_codigo: codigo, p_usuario: a.user.id });
  if (error) return erroDaPorta(error);
  // O banco devolve o fuso certo nos casos que têm hora; o de São Paulo só entra se faltar.
  const resultado = resultadoDaConferencia(data, "America/Sao_Paulo");
  return resultado ? resposta(resultado) : resposta({ error: "resposta_inesperada" }, 500);
}
