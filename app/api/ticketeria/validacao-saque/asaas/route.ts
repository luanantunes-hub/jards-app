// POST /api/ticketeria/validacao-saque/asaas: a validação de saque do Asaas (o cadeado do repasse). Sem login: a prova é o token do cabeçalho
// `asaas-access-token`, que está em ASAAS_VALIDACAO_SAQUE_TOKEN (32 letras ou mais). Sem ele, a rota responde 503 e o Asaas cancela a operação
// (falha fechada). A decisão está em fn_ticketeria_validar_saque; tudo que importa está em lib/ticketeria/pagamento/validacao-saque.ts (testado).
// NÃO ative no Asaas "validar também saques via interface" nem "autorização de saque para splits": a rota só decide saques pela API.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarSaqueDoSupabase } from "@/lib/ticketeria/pagamento/portas-supabase";
import { TAMANHO_MAXIMO_DO_PEDIDO_DE_SAQUE, tratarPedidoDeSaque } from "@/lib/ticketeria/pagamento/validacao-saque";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const tamanho = Number(req.headers.get("content-length") ?? "0");
  if (tamanho > TAMANHO_MAXIMO_DO_PEDIDO_DE_SAQUE) return NextResponse.json({ error: "corpo_grande_demais" }, { status: 413, headers: { "cache-control": "no-store" } });
  const { status, corpo } = await tratarPedidoDeSaque({
    tokenEsperado: process.env.ASAAS_VALIDACAO_SAQUE_TOKEN ?? null,
    assinatura: req.headers.get("asaas-access-token"),
    corpo: await req.text(),
    validar: validarSaqueDoSupabase(createAdminClient()),
    registrarTokenRecusado: tamanho => console.warn(`[ticketeria] validação de saque: token recusado (chegaram ${tamanho} caracteres; o esperado tem ${(process.env.ASAAS_VALIDACAO_SAQUE_TOKEN ?? "").length})`),
    registrarErro: erro => console.error("[ticketeria] validação de saque não decidida:", erro instanceof Error ? erro.message : erro),
  });
  return NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });
}
