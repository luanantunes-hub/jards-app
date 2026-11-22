// GET /api/ticketeria/lojas/{id}/precificacao?evento={eventoId}: o quadro de precificação de um evento (plano da Ticketeria, seção 11, P1, só leitura): por sessão por vir, o preço que vale, a ocupação,
// a previsão de lotação por comparação e a sugestão de direção. Quem pede precisa EDITAR a Ticketeria da organização (tem venda e dinheiro). Só leitura.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { createAdminClient } from "@/lib/supabase/admin";
import { quadroDoEvento } from "@/lib/ticketeria/precificacao-servidor";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "precificacao", max: 30 });
  if (a.erro) return a.erro;
  const evento = req.nextUrl.searchParams.get("evento") ?? "";
  if (!UUID.test(evento)) return resposta({ error: "evento_invalido" }, 400);
  try {
    const quadro = await quadroDoEvento(createAdminClient(), a.loja.id, evento);
    if (!quadro) return resposta({ error: "evento_nao_encontrado" }, 404);
    return resposta(quadro);
  } catch (erro) {
    console.error("[ticketeria] quadro de precificação:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
