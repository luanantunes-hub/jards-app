import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { appUrl } from "@/lib/email/config";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { createAdminClient } from "@/lib/supabase/admin";
import { ambienteDoAsaas } from "@/lib/ticketeria/pagamento/asaas";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { executar, type EmailDeReembolso } from "@/lib/ticketeria/pagamento/reembolso-entrada";
import { RECUSAS_DO_PEDIDO, emailMascarado, lerMotivoDaRecusa, mensagemDoLinkDeReembolso, type ResultadoDaConfirmacao } from "@/lib/ticketeria/pagamento/reembolso-pagina";

// O reembolso pedido pela página do pedido (decisão do dono em 20/11/2026): pedir manda o link de confirmação ao e-mail da compra; confirmar gasta o link (uma vez só) e roda o MESMO
// motor do reembolso por e-mail. As regras e os textos estão em reembolso-pagina.ts; as do banco, em fn_ticketeria_reembolso_link_*.

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");
type Resposta = { status: number; corpo: object };
const erro = (e: unknown) => console.error("[ticketeria] reembolso pela página:", e instanceof Error ? e.message : e);

/** O botão "Pedir reembolso": confere o pedido, grava o link e manda o e-mail ao endereço da compra. O estorno NÃO acontece aqui. */
export async function pedirReembolsoPelaPagina(pedido: string): Promise<Resposta> {
  const admin = createAdminClient();
  const t = clienteDaTicketeria(admin);
  // O código do link é sorteado aqui; no banco fica só o hash dele.
  const codigo = randomBytes(32).toString("hex");
  const hash = sha256(codigo);
  const { data, error } = await t.rpc("fn_ticketeria_reembolso_link_pedir", { p_pedido: pedido, p_hash: hash });
  if (error) { erro(error); return { status: 500, corpo: { error: "falha", mensagem: "Não foi possível pedir o reembolso agora. Tente de novo em instantes." } }; }
  const r = (data ?? {}) as { ok?: boolean; motivo?: unknown; email?: string; nome?: string; codigo?: string; expira_em?: string };
  if (!r.ok) {
    const motivo = lerMotivoDaRecusa(r.motivo) ?? "nao_elegivel";
    return { status: RECUSAS_DO_PEDIDO[motivo].status, corpo: { error: motivo, mensagem: RECUSAS_DO_PEDIDO[motivo].mensagem } };
  }
  if (!r.email || !r.nome || !r.codigo || !r.expira_em) { erro(new Error("resposta inesperada do banco ao pedir o link")); return { status: 500, corpo: { error: "falha", mensagem: "Não foi possível pedir o reembolso agora. Tente de novo em instantes." } }; }
  const m = mensagemDoLinkDeReembolso({ nome: r.nome.split(" ")[0] || r.nome, codigo: r.codigo, endereco: `${appUrl()}/pedido/${pedido}/reembolso?c=${codigo}`, expiraEm: r.expira_em });
  const envio = await sendTransactionalEmail({ to: r.email, subject: m.assunto, text: m.texto, html: m.html });
  if (!envio.ok) {
    // O e-mail não saiu: o link não serve para nada. Apaga, para a pessoa poder tentar de novo sem esperar.
    erro(new Error(`e-mail do link não enviado: ${envio.error}`));
    await t.from("ticketeria_reembolso_links").delete().eq("token_hash", hash);
    return { status: 502, corpo: { error: "email_nao_enviado", mensagem: "Não conseguimos enviar o e-mail agora. Tente de novo em instantes." } };
  }
  return { status: 200, corpo: { enviado: true, email: emailMascarado(r.email), valido_ate: r.expira_em } };
}

/** O link ainda vale? Não gasta nada. Devolve o que a página de confirmação mostra, ou null (a mesma resposta para qualquer link que não vale). */
export async function verLinkDeReembolso(pedido: string, codigo: string): Promise<{ codigo: string; total_centavos: number; expira_em: string } | null> {
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_reembolso_link_ver", { p_pedido: pedido, p_hash: sha256(codigo) });
  if (error) { erro(error); return null; }
  const r = (data ?? {}) as { valido?: boolean; codigo?: string; total_centavos?: number; expira_em?: string };
  return r.valido && typeof r.codigo === "string" && typeof r.total_centavos === "number" && typeof r.expira_em === "string" ? { codigo: r.codigo, total_centavos: r.total_centavos, expira_em: r.expira_em } : null;
}

const RESULTADOS_CONHECIDOS = new Set(["estornado", "fora_do_prazo", "nao_elegivel", "ja_reembolsado", "falhou", "repetido"]);

/** O botão "Confirmar reembolso": gasta o link (uma vez só) e entrega o pedido ao motor do reembolso. */
export async function confirmarReembolsoPelaPagina(pedido: string, codigo: string): Promise<Resposta> {
  // Sem Asaas não há o que estornar: responde antes de gastar o link.
  if (!ambienteDoAsaas()) return { status: 503, corpo: { error: "indisponivel", mensagem: "O reembolso não está disponível agora. Tente de novo mais tarde." } };
  const admin = createAdminClient();
  const t = clienteDaTicketeria(admin);
  const { data, error } = await t.rpc("fn_ticketeria_reembolso_link_consumir", { p_pedido: pedido, p_hash: sha256(codigo) });
  if (error) { erro(error); return { status: 500, corpo: { error: "falha", mensagem: "Não foi possível confirmar agora. Tente de novo em instantes." } }; }
  if (!data) return { status: 410, corpo: { resultado: "link_invalido" satisfies ResultadoDaConfirmacao } };
  const email = data as EmailDeReembolso;
  const r = await executar(email);
  const resultado = (r.corpo as { reembolso?: string }).reembolso;
  if (r.status === 200 && typeof resultado === "string" && RESULTADOS_CONHECIDOS.has(resultado)) return { status: 200, corpo: { resultado } };
  // O motor não terminou (erro do servidor): o registro fica na fila do Jards como "falhou", para ser tentado de novo na tela Vendas dentro do prazo. A pessoa vê "estamos analisando".
  erro(new Error(`o motor do reembolso não terminou (status ${r.status}) para ${email.email_id}`));
  const { data: registro } = await t.from("ticketeria_reembolsos").select("id, situacao").eq("email_id", email.email_id).maybeSingle();
  if (registro?.situacao === "recebido") await t.rpc("fn_ticketeria_reembolso_marcar", { p_reembolso: registro.id, p_situacao: "falhou", p_motivo: "erro do servidor ao confirmar pela página", p_pedido: pedido });
  return { status: 200, corpo: { resultado: "falhou" satisfies ResultadoDaConfirmacao } };
}
