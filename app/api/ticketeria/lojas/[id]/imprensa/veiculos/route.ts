// GET /api/ticketeria/lojas/{id}/imprensa/veiculos: os veículos que o Jards acompanha para a casa (a grande imprensa entra na primeira vez) e as sugestões (veículos marcados à mão).
// POST { site }: "Acompanhar" um site: confere o endereço, acha o RSS agora e grava. Quem pede precisa EDITAR a Ticketeria da organização.

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { acompanharSite, veiculosDaLoja } from "@/lib/ticketeria/imprensa-monitor-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "imprensa-veiculos", max: 30 });
  if (a.erro) return a.erro;
  try {
    return resposta(await veiculosDaLoja(createAdminClient(), a.loja.id, a.loja.organization_id));
  } catch (erro) {
    console.error("[ticketeria] veículos da imprensa:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "imprensa-acompanhar", max: 10 });
  if (a.erro) return a.erro;
  const corpo = (await req.json().catch(() => null)) as { site?: unknown } | null;
  if (typeof corpo?.site !== "string" || corpo.site.length > 300) return resposta({ error: "dados_invalidos" }, 400);
  try {
    const r = await acompanharSite(createAdminClient(), a.loja.id, a.loja.organization_id, corpo.site);
    return r.ok ? resposta({ ok: true }) : resposta({ error: "site_invalido", mensagem: r.erro }, 400);
  } catch (erro) {
    console.error("[ticketeria] acompanhar site:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_gravar" }, 500);
  }
}
