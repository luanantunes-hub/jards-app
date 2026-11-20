// A lista de espera da Ticketeria: a leitura do pedido de quem entra na lista, as frases dos erros, as opções de "quantas pessoas avisar" e o e-mail do aviso.
// Só lógica: sem banco, sem tela e sem import de servidor (roda no navegador e nos testes).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_QUANTIDADE_NA_ESPERA = 50;

export type PessoaNaEspera = { id: string; nome: string; email: string; quantidade: number; entrou: string; avisado_em: string | null };
export type IngressoComEspera = { id: string; nome: string; livres: number; pessoas: PessoaNaEspera[] };
export type SessaoComEspera = { id: string; titulo: string; quando: string; ingressos: IngressoComEspera[] };
export type EsperaDaLoja = { sessoes: SessaoComEspera[] };

export type CorpoDaEspera = { sessao_id: string; ingresso_id: string; nome: string; email: string; quantidade: number };
export type LeituraDaEspera = { ok: true; corpo: CorpoDaEspera } | { ok: false; problemas: string[] };

/** O corpo do pedido HTTP de quem entra na lista, conferido. Nada aqui vem confiável. */
export function lerCorpoDaEspera(entrada: unknown): LeituraDaEspera {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const problemas: string[] = [];
  const sessao = texto(e.sessao_id);
  const ingresso = texto(e.ingresso_id);
  if (!UUID.test(sessao)) problemas.push("sessão");
  if (!UUID.test(ingresso)) problemas.push("ingresso");
  const nome = texto(e.nome).replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 120) problemas.push("nome");
  const email = texto(e.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) problemas.push("e-mail");
  const q = e.quantidade;
  if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > MAX_QUANTIDADE_NA_ESPERA) problemas.push("quantidade");
  if (problemas.length > 0) return { ok: false, problemas };
  return { ok: true, corpo: { sessao_id: sessao.toLowerCase(), ingresso_id: ingresso.toLowerCase(), nome, email, quantidade: q as number } };
}

/** O erro do banco ao entrar na lista, numa frase para o comprador. */
export function mensagemDoErroDaEspera(mensagem: string): string {
  if (mensagem.includes("ainda_ha_lugar")) return "Ainda há ingressos à venda. Volte e compre direto.";
  if (mensagem.includes("lista_cheia")) return "A lista de espera desta sessão está cheia.";
  if (mensagem.includes("sessao_indisponivel")) return "Esta sessão não está mais à venda.";
  if (mensagem.includes("evento_nao_publicado")) return "Este evento ainda não está à venda.";
  if (mensagem.includes("ingresso_indisponivel") || mensagem.includes("ingresso_de_outro_local")) return "Esse ingresso não está à venda nesta sessão.";
  if (mensagem.includes("comprador_invalido")) return "Confira o nome e o e-mail.";
  if (mensagem.includes("quantidade_invalida")) return "Escolha de 1 a 50 ingressos.";
  return "Não foi possível entrar na lista agora. Tente de novo em instantes.";
}

/** O erro do banco ao avisar, numa frase para o produtor. */
export function mensagemDoErroDeAvisar(mensagem: string): string {
  if (mensagem.includes("sem_lugar")) return "Não há lugar livre agora para este ingresso. Avise quando voltarem lugares.";
  if (mensagem.includes("sessao_de_outra_loja")) return "Essa sessão não é desta loja.";
  if (mensagem.includes("quantas_invalido")) return "Escolha quantas pessoas avisar.";
  return "Não foi possível avisar agora. Tente de novo em instantes.";
}

const FUSO_PADRAO = "America/Sao_Paulo";

/** "dom., 29 nov. · 20h" (ou "20h30"), no fuso do local da sessão. */
export function quandoDaSessao(iso: string, fuso: string = FUSO_PADRAO): string {
  try {
    const d = new Date(iso);
    const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "short", day: "numeric", month: "short" }).format(d).replace(" de ", " ");
    const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).replace(/^(\d+):00$/, "$1h").replace(/^(\d+):(\d+)$/, "$1h$2");
    return `${dia} · ${hora}`;
  } catch {
    return iso;
  }
}

/** "18/11 · 21:04", no horário de Brasília: quando a pessoa entrou na lista. */
export function quandoEntrou(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_PADRAO, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)).replace(", ", " · ");
}

/** "19/11": o dia em que a pessoa foi avisada. */
export const diaDoAviso = (iso: string): string => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_PADRAO, day: "2-digit", month: "2-digit" }).format(new Date(iso));

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

/** As opções de "quem avisar": as primeiras pessoas da fila, em ordem de chegada. `pessoas` são só as que ainda esperam. */
export function opcoesDeAviso(pessoas: readonly Pick<PessoaNaEspera, "nome" | "quantidade">[]): { value: string; label: string }[] {
  const opcoes: { value: string; label: string }[] = [];
  const total = pessoas.length;
  let soma = 0;
  const limite = Math.min(total, 8);
  for (let n = 1; n <= limite; n++) {
    soma += pessoas[n - 1].quantidade;
    if (n === total) break;
    opcoes.push({ value: String(n), label: n === 1 ? `A primeira pessoa (${primeiroNome(pessoas[0].nome)}, ${plural(soma, "ingresso", "ingressos")})` : `As ${n} primeiras (${plural(soma, "ingresso", "ingressos")})` });
  }
  const todosOsIngressos = pessoas.reduce((s, p) => s + p.quantidade, 0);
  if (total > 0) opcoes.push({ value: String(total), label: total === 1 ? `${primeiroNome(pessoas[0].nome)} (${plural(todosOsIngressos, "ingresso", "ingressos")})` : `Todas as ${total} esperando (${plural(todosOsIngressos, "ingresso", "ingressos")})` });
  return opcoes;
}

/** Quantas pessoas avisar de saída: as primeiras que cabem nos lugares livres (pelo menos uma). */
export function quantasAvisarPorPadrao(pessoas: readonly Pick<PessoaNaEspera, "quantidade">[], livres: number): number {
  let soma = 0;
  let n = 0;
  for (const p of pessoas) {
    if (n > 0 && soma + p.quantidade > livres) break;
    soma += p.quantidade;
    n++;
    if (soma >= livres) break;
  }
  return Math.max(1, n);
}

const escapar = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** O e-mail do aviso: voltaram lugares; o lugar não fica reservado; o link para comprar e o link para sair da lista. */
export function emailDoAviso(d: { nome: string; evento: string; ingresso: string; quando: string; enderecoDeCompra: string; enderecoParaSair: string }): { assunto: string; texto: string; html: string } {
  const texto = [
    `Olá, ${primeiroNome(d.nome)}!`,
    `Você pediu para ser avisado: voltaram lugares de ${d.ingresso} para ${d.evento}, ${d.quando}.`,
    "Os ingressos não ficam reservados para você: quem comprar primeiro leva. Garanta o seu pelo link:",
    d.enderecoDeCompra,
    `Não quer mais ser avisado? Saia da lista por aqui: ${d.enderecoParaSair}`,
  ].join("\n\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#282525">`
    + `<p style="margin:0 0 14px">Olá, ${escapar(primeiroNome(d.nome))}!</p>`
    + `<p style="margin:0 0 14px">Você pediu para ser avisado: voltaram lugares de <strong>${escapar(d.ingresso)}</strong> para <strong>${escapar(d.evento)}</strong>, ${escapar(d.quando)}.</p>`
    + `<p style="margin:0 0 14px">Os ingressos não ficam reservados para você: quem comprar primeiro leva.</p>`
    + `<p style="margin:0 0 14px"><a href="${escapar(d.enderecoDeCompra)}">Comprar ingressos</a></p>`
    + `<p style="margin:0;color:#6b6767;font-size:13px">Não quer mais ser avisado? <a href="${escapar(d.enderecoParaSair)}">Sair da lista</a>.</p>`
    + `</div>`;
  return { assunto: `Voltaram ingressos: ${d.evento}`, texto, html };
}
