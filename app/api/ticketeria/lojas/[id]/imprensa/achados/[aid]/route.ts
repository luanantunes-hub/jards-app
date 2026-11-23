// POST /api/ticketeria/lojas/{id}/imprensa/achados/{aid} { acao: "confirmar" | "descartar" | "desfazer" }: o produtor decide um achado da imprensa ("É, registrar", "Não é sobre o
// evento", "Desfazer"). Quem pede precisa EDITAR a Ticketeria da organização.

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decidirAchado } from "@/lib/ticketeria/imprensa-monitor-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string; aid: string }> }) {
  const a = await autorizarLoja(rota, { chave: "imprensa-achado", max: 60 });
  if (a.erro) return a.erro;
  const { aid } = await rota.params;
  const corpo = (await req.json().catch(() => null)) as { acao?: unknown } | null;
  const acao = corpo?.acao === "confirmar" || corpo?.acao === "descartar" || corpo?.acao === "desfazer" ? corpo.acao : null;
  if (!UUID.test(aid) || !acao) return resposta({ error: "dados_invalidos" }, 400);
  try {
    const r = await decidirAchado(createAdminClient(), a.loja.id, a.loja.organization_id, aid.toLowerCase(), acao);
    return r.ok ? resposta({ ok: true }) : resposta({ error: r.erro }, 409);
  } catch (erro) {
    console.error("[ticketeria] decidir achado:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_gravar" }, 500);
  }
}
