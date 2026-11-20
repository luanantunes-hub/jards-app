// POST /api/ticketeria/compra/cupom: o comprador (sem login) confere um código de cupom numa sessão, antes de pagar.
//
//   { sessao_id, codigo }
//   → 200 { codigo, tipo: "percentual" | "valor", valor, ingresso_id }   (o cupom vale: a tela calcula o desconto com os preços que mostra)
//   → 422 { error, mensagem }                                           (não existe, desativado, vencido ou esgotado)
//
// Só confere: não reserva nada e não gasta o uso do cupom. O valor de verdade é o que o banco calcula ao reservar (fn_ticketeria_reservar_com_cupom).
// O limite por IP é bem baixo (proxy.ts), para ninguém ficar adivinhando códigos.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { codigoDoCupomValido, lerCupomConferido, mensagemDoErroDoCupom, normalizarCodigo } from "@/lib/ticketeria/cupom";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resposta = (corpo: object, status: number) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  const texto = await req.text();
  if (texto.length > 1024) return resposta({ error: "corpo_grande_demais" }, 413);
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const e = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const sessao = typeof e.sessao_id === "string" ? e.sessao_id.trim().toLowerCase() : "";
  const codigo = normalizarCodigo(e.codigo);
  if (!UUID.test(sessao)) return resposta({ error: "dados_invalidos", mensagem: "Sessão inválida." }, 400);
  if (!codigoDoCupomValido(codigo)) return resposta({ error: "cupom_invalido", mensagem: "Esse cupom não existe ou não está mais valendo." }, 422);
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_cupom_conferir", { p_sessao: sessao, p_codigo: codigo });
  if (error) {
    const mensagem = mensagemDoErroDoCupom(error.message ?? "");
    if (mensagem) return resposta({ error: (error.message ?? "").match(/cupom_\w+/)?.[0] ?? "cupom_invalido", mensagem }, 422);
    console.error("[ticketeria] conferir cupom:", error.message);
    return resposta({ error: "falha", mensagem: "Não foi possível conferir o cupom agora. Tente de novo." }, 500);
  }
  const cupom = lerCupomConferido(data);
  if (!cupom) return resposta({ error: "falha", mensagem: "Não foi possível conferir o cupom agora. Tente de novo." }, 500);
  return resposta({ codigo: cupom.codigo, tipo: cupom.tipo, valor: cupom.valor, ingresso_id: cupom.ingresso_id }, 200);
}
