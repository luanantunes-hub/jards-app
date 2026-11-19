// POST /api/ticketeria/avisos/asaas: o aviso (webhook) do Asaas (T5, parte 3). Sem login: a prova é o token do cabeçalho
// `asaas-access-token` (o Asaas não assina o corpo). Sem ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN configurados a rota responde 503 e não
// faz nada; em produção, só com as três travas de `provedorAsaas`. Tudo que importa está em lib/ticketeria/pagamento/ (testado).

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provedorAsaas } from "@/lib/ticketeria/pagamento/asaas";
import { portasDoSupabase } from "@/lib/ticketeria/pagamento/portas-supabase";
import { mandarIngressosDoPedido } from "@/lib/ticketeria/pagamento/envio-do-servidor";
import { TAMANHO_MAXIMO_DO_AVISO, tratarAvisoDoProvedor } from "@/lib/ticketeria/pagamento/rota-aviso";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const tamanho = Number(req.headers.get("content-length") ?? "0");
  if (tamanho > TAMANHO_MAXIMO_DO_AVISO) return NextResponse.json({ error: "corpo_grande_demais" }, { status: 413, headers: { "cache-control": "no-store" } });
  const { status, corpo } = await tratarAvisoDoProvedor({
    provedor: provedorAsaas(),
    portas: () => ({ ...portasDoSupabase(createAdminClient()), aposPagamento: mandarIngressosDoPedido }),
    corpo: await req.text(),
    assinatura: req.headers.get("asaas-access-token"),
    registrarErro: erro => console.error("[ticketeria] aviso do Asaas não processado:", erro instanceof Error ? erro.message : erro),
  });
  return NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });
}
