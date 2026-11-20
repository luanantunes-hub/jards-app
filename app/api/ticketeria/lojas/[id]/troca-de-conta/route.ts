// /api/ticketeria/lojas/{id}/troca-de-conta: trocar a conta para a qual o Jards aprova saque (passo B do cadeado do repasse).
//
//   GET                          a troca aberta (a conta nova, se já foi confirmada e quando passa a valer), sem o código
//   POST { acao: "pedir", conta_bancaria }   confere a conta, manda um código de 6 dígitos para o e-mail de quem pediu
//   POST { acao: "confirmar", codigo }       com o código certo, a troca fica confirmada e passa a valer 24 horas depois (na hora, se ainda não havia conta)
//   DELETE                       cancela a troca aberta (qualquer pessoa que edite a Ticketeria)
//
// O código vai para o e-mail da PESSOA LOGADA (não para um e-mail digitado na tela): quem pegasse uma sessão aberta não escolhe para onde vai o código.

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRateLimited } from "@/lib/mcp/rateLimit";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { estadoDaTroca, portasDaTrocaDoSupabase } from "@/lib/ticketeria/pagamento/portas-supabase";
import { ErroDaTroca, confirmarTrocaDeConta, pedirTrocaDeConta, type PortasDaTroca } from "@/lib/ticketeria/pagamento/troca-de-conta";
import type { ContaBancaria } from "@/lib/ticketeria/pagamento/dados-do-produtor";

const portas = (): PortasDaTroca => portasDaTrocaDoSupabase(createAdminClient(), async (para, m) => (await sendTransactionalEmail({ to: para, subject: m.assunto, text: m.texto, html: m.html })).ok);
const FALHAS = new Set(["dados_invalidos", "mesma_conta", "conta_inexistente", "conta_bloqueada", "codigo_invalido"]);

function erroDaTroca(erro: unknown) {
  if (erro instanceof ErroDaTroca) return resposta({ error: erro.codigo, problemas: erro.problemas }, FALHAS.has(erro.codigo) ? 400 : 502);
  console.error("[ticketeria] troca de conta de saques falhou:", erro instanceof Error ? erro.message : erro);
  return resposta({ error: "falha_na_troca" }, 500);
}

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "troca-ler", max: 30 });
  if (a.erro) return a.erro;
  try {
    const troca = await estadoDaTroca(createAdminClient(), a.loja.id);
    if (!troca) return resposta({ troca: null });
    const { pedida_por, ...resto } = troca;
    return resposta({ troca: { ...resto, minha: pedida_por === a.user.id } });
  } catch (erro) { return erroDaTroca(erro); }
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "troca-acao", max: 10 });
  if (a.erro) return a.erro;
  if (!a.user.email) return resposta({ error: "usuario_sem_email" }, 400);
  let corpo: { acao?: string; conta_bancaria?: ContaBancaria; codigo?: string };
  try { corpo = await req.json(); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  try {
    if (corpo.acao === "pedir") {
      // Quatro pedidos de código por hora, por pessoa (cada um manda um e-mail).
      if (isRateLimited(`troca-codigo:${a.user.id}`, 4, 3_600_000)) return resposta({ error: "muitas_tentativas" }, 429);
      if (!corpo.conta_bancaria || typeof corpo.conta_bancaria !== "object") return resposta({ error: "dados_invalidos", problemas: ["conta bancária"] }, 400);
      const conta = corpo.conta_bancaria;
      const { expira_em } = await pedirTrocaDeConta({ loja: a.loja.id, usuario: a.user.id, email: a.user.email, conta, portas: portas() });
      return resposta({ enviado: true, expira_em });
    }
    if (corpo.acao === "confirmar") {
      const troca = await estadoDaTroca(createAdminClient(), a.loja.id);
      if (!troca || troca.pedida_por !== a.user.id || troca.confirmada) return resposta({ resultado: "sem_pedido" });
      const conta: ContaBancaria = { banco: troca.banco, agencia: troca.agencia, conta: troca.conta, digito: troca.digito };
      const resultado = await confirmarTrocaDeConta({ loja: a.loja.id, usuario: a.user.id, email: a.user.email, codigo: String(corpo.codigo ?? ""), conta, portas: portas() });
      return resposta(resultado);
    }
    return resposta({ error: "acao_invalida" }, 400);
  } catch (erro) { return erroDaTroca(erro); }
}

export async function DELETE(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "troca-cancelar", max: 10 });
  if (a.erro) return a.erro;
  try {
    const canceladas = await portas().cancelar(a.loja.id);
    return resposta({ canceladas });
  } catch (erro) { return erroDaTroca(erro); }
}
