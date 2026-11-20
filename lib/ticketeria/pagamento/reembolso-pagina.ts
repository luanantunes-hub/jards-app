// Pedir o reembolso pela página do pedido (decisão do dono em 20/11/2026; o reembolso por e-mail, D15, continua como reserva). Só as regras e os textos, sem imports de servidor:
// a página do pedido, a de confirmação, as rotas e os testes (tests/ticketeria-reembolso-pagina.test.ts) usam o mesmo código.
//
// O desenho: o botão "Pedir reembolso" NÃO estorna. Ele manda um LINK DE CONFIRMAÇÃO ao e-mail da compra, e o estorno só sai quando o comprador abre o link e confirma. O estorno usa o
// MESMO motor do e-mail (lib/ticketeria/pagamento/reembolso.ts): pedido pago, prazo de 7 dias, nenhum ingresso usado, uma vez só, cadeado do Asaas. O prazo conta da hora do PEDIDO na
// página (a hora do clique), e o link vale pouco (48 horas) e nunca além dos 7 dias da compra: confirmar não estende o direito.

import { PRAZO_DO_REEMBOLSO_EM_DIAS } from "@/lib/ticketeria/pagamento/reembolso";

export const VALIDADE_DO_LINK_EM_HORAS = 48;
export const ESPERA_ENTRE_LINKS_EM_MINUTOS = 10;
export const LINKS_POR_DIA = 5;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehIdDePedido = (texto: unknown): texto is string => typeof texto === "string" && UUID.test(texto);

/** O código do link: 64 letras e números de 0 a 9 e a a f (32 bytes sorteados), em minúsculas. Qualquer outra coisa não é um link. */
export function lerCodigoDoLink(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const t = texto.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(t) ? t : null;
}

export type PedidoNaPagina = { situacao: string; pago_em: string | null; reembolsado_em: string | null; total_centavos: number; provedor: string | null; ingresso_usado: boolean };

/** O botão "Pedir reembolso" aparece? Só com o pedido pago, no Asaas, dentro dos 7 dias da compra, sem reembolso e sem ingresso usado. O servidor confere tudo de novo ao pedir. */
export function podePedirReembolsoNaPagina(pedido: PedidoNaPagina, agora: Date): boolean {
  if (pedido.situacao !== "pago" || !pedido.pago_em || pedido.reembolsado_em || pedido.ingresso_usado) return false;
  if (pedido.provedor !== "asaas" || pedido.total_centavos <= 0) return false;
  const pago = Date.parse(pedido.pago_em);
  if (!Number.isFinite(pago)) return false;
  return agora.getTime() - pago <= PRAZO_DO_REEMBOLSO_EM_DIAS * 86_400_000;
}

/** Até quando o pedido pode ser feito: 7 dias depois da compra. */
export function limiteDoPedidoDeReembolso(pagoEm: string): Date {
  return new Date(Date.parse(pagoEm) + PRAZO_DO_REEMBOLSO_EM_DIAS * 86_400_000);
}

/** "rita.souza@gmail.com" → "ri***@gmail.com": a página mostra para onde o link vai, sem entregar o endereço inteiro. */
export function emailMascarado(email: string): string {
  const [usuario, dominio] = (email ?? "").split("@");
  if (!usuario || !dominio) return "o e-mail da compra";
  return `${usuario.slice(0, Math.min(2, Math.max(1, usuario.length - 1)))}***@${dominio}`;
}

export type MotivoDaRecusa = "nao_encontrado" | "fora_do_prazo" | "ingresso_usado" | "nao_elegivel" | "ja_reembolsado" | "em_andamento" | "aguarde" | "muitos_pedidos";

/** O que a página diz, e o status HTTP, quando o link não pode ser enviado. `nao_encontrado` responde como a página do pedido (404), sem dizer mais. */
export const RECUSAS_DO_PEDIDO: Record<MotivoDaRecusa, { status: number; mensagem: string }> = {
  nao_encontrado: { status: 404, mensagem: "Pedido não encontrado." },
  fora_do_prazo: { status: 409, mensagem: "O prazo de 7 dias da compra já passou, então o reembolso não pode mais ser pedido por aqui." },
  ingresso_usado: { status: 409, mensagem: "Algum ingresso deste pedido já foi usado na entrada, então o reembolso não pode ser pedido por aqui." },
  nao_elegivel: { status: 409, mensagem: "Este pedido não pode ser reembolsado por aqui." },
  ja_reembolsado: { status: 409, mensagem: "Este pedido já foi reembolsado." },
  em_andamento: { status: 409, mensagem: "O reembolso deste pedido já está em andamento." },
  aguarde: { status: 429, mensagem: `Já enviamos um link há pouco. Olhe a sua caixa de entrada e o spam, ou espere ${ESPERA_ENTRE_LINKS_EM_MINUTOS} minutos para pedir outro.` },
  muitos_pedidos: { status: 429, mensagem: "Você já pediu o link várias vezes hoje. Olhe a sua caixa de entrada e o spam, ou tente amanhã." },
};

export function lerMotivoDaRecusa(valor: unknown): MotivoDaRecusa | null {
  return typeof valor === "string" && Object.prototype.hasOwnProperty.call(RECUSAS_DO_PEDIDO, valor) ? (valor as MotivoDaRecusa) : null;
}

const dataEHora = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)).replace(", ", " às ");
const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** O e-mail com o link de confirmação. Diz o que acontece ao confirmar, até quando o link vale, e que sem confirmar nada acontece. */
export function mensagemDoLinkDeReembolso(d: { nome: string; codigo: string; endereco: string; expiraEm: string }): { assunto: string; texto: string; html: string } {
  const ate = dataEHora(d.expiraEm);
  const paragrafos = [
    `Olá, ${d.nome}!`,
    `Você pediu o reembolso do pedido ${d.codigo}. Para confirmar, abra o link abaixo e toque em “Confirmar reembolso”.`,
  ];
  const depois = [
    `O link vale até ${ate} (horário de Brasília) e só pode ser usado uma vez. Ao confirmar, devolvemos o valor total pelo mesmo meio com que você pagou e os ingressos do pedido deixam de valer.`,
    "Não foi você? Ignore este e-mail: sem a confirmação, nada acontece com o seu pedido.",
  ];
  const texto = [...paragrafos, d.endereco, ...depois].join("\n\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#282525">`
    + paragrafos.map(p => `<p style="margin:0 0 14px">${escapar(p)}</p>`).join("")
    + `<p style="margin:0 0 14px"><a href="${escapar(d.endereco)}" style="display:inline-block;background:#282525;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:12px">Confirmar o reembolso</a></p>`
    + `<p style="margin:0 0 14px;color:#6b6767;font-size:13px">Se o botão não abrir, copie este endereço no navegador:<br>${escapar(d.endereco)}</p>`
    + depois.map(p => `<p style="margin:0 0 14px">${escapar(p)}</p>`).join("")
    + `</div>`;
  return { assunto: `Confirme o reembolso do pedido ${d.codigo}`, texto, html };
}

export type ResultadoDaConfirmacao = "estornado" | "fora_do_prazo" | "nao_elegivel" | "ja_reembolsado" | "falhou" | "repetido" | "link_invalido";

/** O que a página diz depois de o comprador confirmar. Qualquer coisa que não é "estornado" cai em "estamos analisando" ou numa frase clara; o motor já respondeu por e-mail. */
export function textoDaConfirmacao(resultado: ResultadoDaConfirmacao): { titulo: string; texto: string; ok: boolean } {
  switch (resultado) {
    case "estornado": return { ok: true, titulo: "Reembolso confirmado", texto: "Pedimos o reembolso ao seu banco, pelo mesmo meio com que você pagou. No Pix, o dinheiro costuma aparecer em poucos instantes; no cartão, o valor volta na fatura e pode levar até duas faturas. Os ingressos deste pedido foram cancelados. Enviamos a confirmação por e-mail." };
    case "fora_do_prazo": return { ok: false, titulo: "O prazo já passou", texto: "O prazo de 7 dias da compra terminou, então não conseguimos devolver o valor por aqui. Se aconteceu algum problema com o ingresso ou com o evento, fale com o organizador." };
    case "ja_reembolsado": return { ok: false, titulo: "Pedido já reembolsado", texto: "Este pedido já foi reembolsado. Se o valor não apareceu na sua conta, fale com o seu banco." };
    case "repetido": return { ok: false, titulo: "O reembolso já está em andamento", texto: "Já estamos cuidando do reembolso deste pedido. Você receberá a confirmação por e-mail." };
    case "falhou":
    case "nao_elegivel": return { ok: false, titulo: "Estamos analisando o seu pedido", texto: "O seu pedido de reembolso precisa de uma análise nossa. Enviamos um e-mail e responderemos por lá. O seu pedido foi registrado e o prazo de 7 dias vale a partir da hora em que você o fez." };
    case "link_invalido": return { ok: false, titulo: "Este link não vale mais", texto: "O link vale uma vez só e por pouco tempo. Se ainda está no prazo de 7 dias da compra, peça outro na página do pedido." };
  }
}
