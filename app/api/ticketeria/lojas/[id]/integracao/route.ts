// /api/ticketeria/lojas/{id}/integracao: a chave pública da loja, que os sites e CMS de fora usam para ler os ingressos (a API pública). Quem pede precisa EDITAR a Ticketeria da
// organização.
//
//   GET                         a chave (criada na primeira vez), se está ligada e o endereço da API
//   POST { acao: "girar" }      sorteia outra chave: a antiga deixa de valer na hora (quem a usa precisa trocar)
//   POST { acao: "ligar" }      liga a chave          POST { acao: "desligar" }   desliga: a API responde "não encontrado" até ligar de novo

import { type NextRequest } from "next/server";
import { appUrl } from "@/lib/email/config";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { lerChaveDaLoja } from "@/lib/ticketeria/integracao";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "integracao", max: 30 });
  if (a.erro) return a.erro;
  const { data, error } = await a.admin.rpc("fn_ticketeria_chave_publica_garantir", { p_loja: a.loja.id });
  const chave = error ? null : lerChaveDaLoja(data, appUrl());
  if (!chave) {
    if (error) console.error("[ticketeria] chave pública:", error.message);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
  return resposta(chave);
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "integracao-muda", max: 10 });
  if (a.erro) return a.erro;
  let corpo: { acao?: unknown };
  try { corpo = await req.json(); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const acao = corpo.acao;
  const chamada = acao === "girar" ? a.admin.rpc("fn_ticketeria_chave_publica_girar", { p_loja: a.loja.id })
    : acao === "ligar" || acao === "desligar" ? a.admin.rpc("fn_ticketeria_chave_publica_ligar", { p_loja: a.loja.id, p_ligada: acao === "ligar" })
      : null;
  if (!chamada) return resposta({ error: "acao_invalida" }, 400);
  const { data, error } = await chamada;
  const chave = error ? null : lerChaveDaLoja(data, appUrl());
  if (!chave) {
    if (error) console.error("[ticketeria] chave pública:", error.message);
    return resposta({ error: "falha_ao_mudar" }, 500);
  }
  return resposta(chave);
}
