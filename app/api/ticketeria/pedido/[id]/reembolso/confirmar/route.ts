// POST /api/ticketeria/pedido/{id}/reembolso/confirmar: o botão "Confirmar reembolso" da página aberta pelo link do e-mail (sem login). É AQUI que o estorno sai.
//
//   { codigo }                       o código do link (64 letras e números), o mesmo do endereço da página
//   → 200 { resultado }              "estornado", "fora_do_prazo", "nao_elegivel", "ja_reembolsado", "falhou" ou "repetido" (o motor do reembolso decidiu)
//   → 410 { resultado: "link_invalido" }   o link não existe, é de outro pedido, já foi usado, foi trocado por outro ou venceu: a MESMA resposta para todos
//   → 503                            o Asaas não está configurado (o link não é gasto)
//
// O link é de uso único e vale pouco (48 horas, nunca além dos 7 dias da compra). Abrir a página não gasta nada: só este botão (um POST) gasta.

import { NextResponse, type NextRequest } from "next/server";
import { ehIdDePedido, lerCodigoDoLink } from "@/lib/ticketeria/pagamento/reembolso-pagina";
import { confirmarReembolsoPelaPagina } from "@/lib/ticketeria/pagamento/reembolso-pagina-servidor";

export const dynamic = "force-dynamic";
const resposta = (corpo: object, status: number) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const texto = await req.text();
  if (texto.length > 512) return resposta({ error: "corpo_grande_demais" }, 413);
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const codigo = lerCodigoDoLink((bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>) : {}).codigo);
  if (!ehIdDePedido(id) || !codigo) return resposta({ resultado: "link_invalido" }, 410);
  const r = await confirmarReembolsoPelaPagina(id.toLowerCase(), codigo);
  return resposta(r.corpo, r.status);
}
