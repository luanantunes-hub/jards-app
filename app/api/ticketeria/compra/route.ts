// POST /api/ticketeria/compra: o comprador (sem login) escolhe os ingressos de uma sessão e recebe o Pix (passo C1 da T5).
//
//   { sessao_id, itens: [{ ingresso_id, quantidade }], nome, email, documento, termos, meio?: "pix" | "cartao", parcelas? }
//   → 201 { situacao: "aguardando_pagamento", meio: "pix", pedido_id, codigo, total_centavos, reservado_ate, pix_copia_e_cola }
//   → 201 { situacao: "aguardando_pagamento", meio: "cartao", ..., url_de_pagamento }   (cartão: a pessoa paga na página segura do Asaas)
//   → 201 { situacao: "pago", pedido_id, codigo, total_centavos: 0 }                 (ingresso gratuito: nasce pago)
//
// O CPF ou CNPJ vai ao Asaas e não é guardado (D17). A cobrança nasce na subconta do produtor, com a comissão do Jards dividida para a carteira do
// Jards. Sem Asaas configurado (ou sem as três travas da produção) responde 503 e não reserva nada. O limite por IP está no proxy.ts.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProvedorAsaas, ambienteDoAsaas } from "@/lib/ticketeria/pagamento/asaas";
import { ErroDaCompra, iniciarCompra, lerCorpoDaCompra } from "@/lib/ticketeria/pagamento/compra";
import { portasDaCompraDoSupabase } from "@/lib/ticketeria/pagamento/portas-supabase";
import { mandarIngressosDoPedido } from "@/lib/ticketeria/pagamento/envio-do-servidor";

export const dynamic = "force-dynamic";
const TAMANHO_MAXIMO = 8 * 1024;
const resposta = (corpo: object, status: number) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  const base = ambienteDoAsaas();
  if (!base) return resposta({ error: "vendas_indisponiveis", mensagem: "As vendas ainda não estão abertas." }, 503);
  const texto = await req.text();
  if (new TextEncoder().encode(texto).length > TAMANHO_MAXIMO) return resposta({ error: "corpo_grande_demais" }, 413);
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const leitura = lerCorpoDaCompra(bruto);
  if (!leitura.ok) return resposta({ error: "dados_invalidos", problemas: leitura.problemas }, 400);
  try {
    const portas = portasDaCompraDoSupabase(createAdminClient(), {
      // O token do webhook não é usado para abrir a cobrança; o construtor só exige um de tamanho válido.
      provedor: chave => new ProvedorAsaas({ chave, tokenDoWebhook: process.env.ASAAS_WEBHOOK_TOKEN || "nao-usado-ao-abrir-a-cobranca".padEnd(32, "x"), url: base.url }),
      carteiraDoJards: process.env.ASAAS_WALLET_JARDS || null,
      registrarErro: erro => console.error("[ticketeria] compra:", erro instanceof Error ? erro.message : erro),
    });
    const compra = await iniciarCompra(leitura.corpo, { ...portas, aposPagamento: mandarIngressosDoPedido });
    return resposta(compra, 201);
  } catch (erro) {
    if (erro instanceof ErroDaCompra) return resposta({ error: erro.codigo, mensagem: erro.mensagem }, erro.codigo === "reserva_recusada" || erro.codigo === "meio_indisponivel" ? 409 : erro.codigo === "vendas_indisponiveis" ? 503 : 502);
    console.error("[ticketeria] compra falhou:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_na_compra", mensagem: "Não foi possível concluir agora. Tente de novo em instantes." }, 500);
  }
}
