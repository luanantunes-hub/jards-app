// GET /api/ticketeria/preco-dinamico/atualizar: a rodada do atualizador do preço dinâmico (cron da Vercel, a cada 30 minutos). Para cada evento com adesão ativa, move o fator de cada sessão por vir um passo na direção
// que o quadro de precificação sugere, dentro do piso e do teto do produtor. Só com `Authorization: Bearer ${CRON_SECRET}` (a Vercel o envia sozinha quando a variável existe); sem CRON_SECRET responde 503.
// Sem a plataforma liberar o recurso (TICKETERIA_PRECO_DINAMICO_LIBERADO=sim) não faz nada.

import { timingSafeEqual } from "node:crypto";
import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { atualizarPrecosDinamicos, precoDinamicoLiberado } from "@/lib/ticketeria/preco-dinamico-servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  const recebido = req.headers.get("authorization") ?? "";
  if (!segredo) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const lido = Buffer.from(recebido);
  return lido.length === esperado.length && timingSafeEqual(lido, esperado);
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return resposta({ error: "cron_indisponivel" }, 503);
  if (!autorizado(req)) return resposta({ error: "nao_autorizado" }, 401);
  if (!precoDinamicoLiberado()) return resposta({ ok: true, motivo: "recurso_nao_liberado" });
  try {
    return resposta({ ok: true, ...(await atualizarPrecosDinamicos(createAdminClient())) });
  } catch (erro) {
    console.error("[ticketeria] preço dinâmico (atualizador):", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_na_rodada" }, 500);
  }
}
