// Os envios de divulgação por e-mail do Público: para quem vai (o segmento), o que a pessoa escreve e confere, o e-mail que sai, a ação do link e o resultado em vendas. Só a conta,
// sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-envios.test.ts). Quem fala com o banco e com o Resend é lib/ticketeria/envios-servidor.ts.
//
// Só recebe quem aceitou novidades e não saiu da lista (ver lib/ticketeria/publico.ts). O link de compra de cada e-mail leva `?canal=email&acao=…` (lib/ticketeria/divulgacao.ts):
// as vendas que voltam por ele aparecem no resultado do envio e no painel Divulgação.

import { enderecoDeDivulgacao } from "@/lib/ticketeria/divulgacao";
import { montarPublico, recebeNovidades, type EntradaDoPublico } from "@/lib/ticketeria/publico";

/** O máximo de pessoas num envio de e-mail: a fila manda em lotes de 100 e leva uns minutos. */
export const LIMITE_DE_DESTINATARIOS = 5000;
/** No WhatsApp cada conversa é aberta à mão pelo produtor, então o envio é menor. */
export const LIMITE_DE_DESTINATARIOS_WHATSAPP = 100;
export type CanalDoEnvio = "email" | "whatsapp";
export const limiteDoCanal = (canal: CanalDoEnvio) => (canal === "whatsapp" ? LIMITE_DE_DESTINATARIOS_WHATSAPP : LIMITE_DE_DESTINATARIOS);
export const MAX_ASSUNTO = 150;
export const MAX_MENSAGEM = 5000;
export const SEGMENTO_TODOS = "aceitaram";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EntradaParaEnvio = EntradaDoPublico & {
  /** O id do evento de cada sessão, pelo id da sessão (para o segmento "compraram o evento X"). */
  eventoIdDaSessao: Record<string, string>;
};

export type Segmento = { id: string; rotulo: string; total: number };
export type Destinatario = { email: string; nome: string; whatsapp?: string | null };

/** As escolhas de "Para quem": todos que aceitaram, e quem comprou cada evento e aceitou. Só entram as que têm gente. */
export function segmentosDoPublico(e: EntradaParaEnvio, canal: CanalDoEnvio = "email"): Segmento[] {
  const aceitaram = new Set(montarPublico(e).contatos.filter(c => recebeNovidades(c) && (canal === "email" || !!c.whatsapp)).map(c => c.email));
  const porEvento = new Map<string, Set<string>>();
  for (const p of e.pedidos) {
    const email = p.comprador_email.trim().toLowerCase();
    const evento = e.eventoIdDaSessao[p.sessao_id];
    if (!evento || !aceitaram.has(email)) continue;
    (porEvento.get(evento) ?? porEvento.set(evento, new Set()).get(evento)!).add(email);
  }
  const titulos = new Map<string, string>();
  for (const [sessao, evento] of Object.entries(e.eventoIdDaSessao)) titulos.set(evento, e.eventoDaSessao[sessao] ?? "Evento");
  const eventos: Segmento[] = [...porEvento.entries()].map(([id, emails]) => ({ id: `evento:${id}`, rotulo: `Compraram ${titulos.get(id) ?? "o evento"} e aceitaram`, total: emails.size }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return aceitaram.size === 0 ? [] : [{ id: SEGMENTO_TODOS, rotulo: "Todos que aceitaram novidades", total: aceitaram.size }, ...eventos];
}

/** As pessoas de um segmento: aceitaram novidades e não saíram da lista (quem saiu nunca entra). */
export function destinatariosDoSegmento(e: EntradaParaEnvio, segmento: string, canal: CanalDoEnvio = "email"): Destinatario[] {
  const contatos = montarPublico(e).contatos.filter(c => recebeNovidades(c) && (canal === "email" || !!c.whatsapp));
  const pessoa = (c: { email: string; nome: string; whatsapp: string | null }): Destinatario => ({ email: c.email, nome: c.nome, ...(canal === "whatsapp" ? { whatsapp: c.whatsapp } : {}) });
  if (segmento === SEGMENTO_TODOS) return contatos.map(pessoa);
  // "evento:A" (compraram A) ou "evento:A:sem:B" (compraram A e não compraram B: o envio da aba Eventos em comum).
  const m = /^evento:([^:]+)(?::sem:([^:]+))?$/.exec(segmento);
  if (!m || !UUID.test(m[1]) || (m[2] !== undefined && !UUID.test(m[2]))) return [];
  const doEvento = (id: string) => new Set(e.pedidos.filter(p => e.eventoIdDaSessao[p.sessao_id] === id.toLowerCase()).map(p => p.comprador_email.trim().toLowerCase()));
  const compraram = doEvento(m[1]);
  const fora = m[2] ? doEvento(m[2]) : new Set<string>();
  return contatos.filter(c => compraram.has(c.email) && !fora.has(c.email)).map(pessoa);
}

export type EnvioLido = { canal: CanalDoEnvio; assunto: string; mensagem: string; sessao_id: string; segmento: string; teste: boolean };

/** O corpo do pedido de envio, conferido. */
export function lerEnvio(entrada: unknown): { ok: true; envio: EnvioLido } | { ok: false; problemas: string[] } {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  const problemas: string[] = [];
  const texto = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "");
  const assunto = texto(e.assunto).replace(/\s+/g, " ");
  if (assunto.length < 1 || assunto.length > MAX_ASSUNTO) problemas.push("assunto");
  const mensagem = texto(e.mensagem);
  if (mensagem.length < 1 || mensagem.length > MAX_MENSAGEM) problemas.push("mensagem");
  const sessao = texto(e.sessao_id).toLowerCase();
  if (!UUID.test(sessao)) problemas.push("sessão");
  const segmento = texto(e.segmento);
  if (segmento !== SEGMENTO_TODOS && !/^evento:[0-9a-f-]{36}(:sem:[0-9a-f-]{36})?$/i.test(segmento)) problemas.push("para quem");
  if (problemas.length > 0) return { ok: false, problemas };
  const canal: CanalDoEnvio = e.canal === "whatsapp" ? "whatsapp" : "email";
  return { ok: true, envio: { canal, assunto, mensagem, sessao_id: sessao, segmento: segmento.toLowerCase(), teste: canal === "email" && e.teste === true } };
}

/** O nome da ação do link do envio: o assunto em letras minúsculas, sem acento, com o dia e o mês ("ultimas-vagas-hamlet-20-11"). */
export function acaoDoEnvio(assunto: string, agora: Date = new Date(), canal: CanalDoEnvio = "email"): string {
  const base = assunto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 45).replace(/-+$/g, "");
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(agora).replace("/", "-");
  return `${base === "" ? "envio" : base}${canal === "whatsapp" ? "-wa" : ""}-${dia}`;
}

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || "";

/** "Oi, {nome}!" vira o primeiro nome da pessoa (sem nome, some junto com a vírgula). */
export function comNome(mensagem: string, nome: string): string {
  const n = primeiroNome(nome);
  return mensagem.replace(/,\s*\{nome\}/gi, n ? `, ${n}` : "").replace(/\{nome\}/gi, n);
}

/** O link de compra do envio: a sessão, o canal (e-mail ou WhatsApp) e o nome da ação. */
export const enderecoDeCompraDoEnvio = (origem: string, sessaoId: string, acao: string, canal: CanalDoEnvio = "email") => enderecoDeDivulgacao(origem, sessaoId, canal, acao);

export type DadosDoEmail = { loja: string; nome: string; assunto: string; mensagem: string; enderecoDeCompra: string; enderecoParaSair: string };

/** O e-mail de divulgação: a mensagem do produtor, o botão de comprar e, no rodapé, por que a pessoa recebe e como sair. */
export function emailDeDivulgacao(d: DadosDoEmail): { assunto: string; texto: string; html: string } {
  const corpo = comNome(d.mensagem, d.nome);
  const rodape = `Você recebe este e-mail porque aceitou receber novidades de ${d.loja} ao comprar ingressos.`;
  const texto = [corpo, `Comprar ingressos: ${d.enderecoDeCompra}`, `${rodape} Para sair da lista: ${d.enderecoParaSair}`].join("\n\n");
  const paragrafos = corpo.split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${escapar(p).replace(/\n/g, "<br>")}</p>`).join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#282525">`
    + paragrafos
    + `<p style="margin:0 0 22px"><a href="${escapar(d.enderecoDeCompra)}" style="display:inline-block;background:#282525;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:12px">Comprar ingressos</a></p>`
    + `<p style="margin:0;color:#6b6767;font-size:13px">${escapar(rodape)} <a href="${escapar(d.enderecoParaSair)}">Sair da lista</a>.</p>`
    + `</div>`;
  return { assunto: d.assunto, texto, html };
}

// ─── O WhatsApp simples ─────────────────────────────────────────────────────

/** O texto da conversa: a mensagem do produtor com o nome, o link de compra marcado e o link para sair da lista. */
export function mensagemDeWhatsapp(d: { loja: string; nome: string; mensagem: string; enderecoDeCompra: string; enderecoParaSair: string }): string {
  return [comNome(d.mensagem, d.nome), d.enderecoDeCompra, `Para sair da lista de novidades de ${d.loja}: ${d.enderecoParaSair}`].join("\n\n");
}

/** O endereço que abre a conversa com a pessoa, com o texto já escrito. `numero` são os dígitos com o 55. */
export const enderecoDoWhatsapp = (numero: string, texto: string) => `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;

export type PessoaDoWhatsapp = { id: string; nome: string; whatsapp: string; link: string; enviada: boolean };

// ─── O fluxo do envio ───────────────────────────────────────────────────────

export type DestinatarioCriado = { id: string; email: string; nome: string; token: string };
export type PortasDoEnvio = {
  /** Grava o envio e as pessoas (cada uma com o seu token do link de sair, todas "pendente") e devolve o id do envio e as pessoas. */
  criar(dados: { canal: CanalDoEnvio; assunto: string; mensagem: string; sessao_id: string; acao: string; segmento: string; destinatarios: Destinatario[] }): Promise<{ envio: string; destinatarios: DestinatarioCriado[] }>;
};

// ─── A fila do e-mail ───────────────────────────────────────────────────────

/** Quantas pessoas vão num lote do Resend (o máximo da API é 100 por chamada). */
export const TAMANHO_DO_LOTE = 100;
/** O tempo que uma rodada da fila trabalha antes de largar o resto para a próxima (a função da Vercel dura até 300 s). */
export const ORCAMENTO_DA_RODADA_MS = 240_000;

export type EmailDaFila = { para: string; assunto: string; html: string; texto: string; token: string };
export type MarcaDaFila = { id: string; ok: boolean; provedorId?: string };
export type PortasDaFila = {
  /** Reivindica até `n` pessoas pendentes do envio (ou as que ficaram travadas) e as devolve. Duas rodadas ao mesmo tempo nunca pegam a mesma pessoa. */
  reivindicar(n: number): Promise<DestinatarioCriado[]>;
  /** Manda o lote numa chamada só; `ids` vêm na mesma ordem. Nunca lança. */
  enviarLote(emails: EmailDaFila[], chave: string): Promise<{ ok: true; ids: string[] } | { ok: false }>;
  /** Manda um e-mail (para isolar quem fez o lote falhar). Nunca lança. */
  enviarUm(email: EmailDaFila, chave: string): Promise<{ ok: boolean; id?: string }>;
  marcar(marcas: MarcaDaFila[]): Promise<void>;
  /** Refaz as contagens do envio, conclui se não sobrou ninguém e devolve quantas faltam. */
  atualizar(): Promise<number>;
  agora(): number;
  registrarErro?(erro: unknown): void;
};
export type ResultadoDaRodada = { enviados: number; falhas: number; faltam: number };

/**
 * Uma rodada da fila de um envio por e-mail: reivindica um lote, manda numa chamada só, marca cada pessoa e atualiza as contagens, de novo e de novo até acabar a fila ou o tempo da rodada.
 * Se o lote falha (um endereço torto pode derrubar o lote inteiro), cada pessoa dele é mandada sozinha: quem falha conta como falha, as outras saem. Falha de banco para a rodada
 * (quem ficou "enviando" volta para a fila depois de 5 minutos), e o que já foi marcado fica.
 */
export async function processarFila(d: { loja: string; origem: string; assunto: string; mensagem: string; sessao_id: string; acao: string; enderecoParaSair: (token: string) => string; orcamentoMs?: number }, portas: PortasDaFila): Promise<ResultadoDaRodada> {
  const limite = portas.agora() + (d.orcamentoMs ?? ORCAMENTO_DA_RODADA_MS);
  const enderecoDeCompra = enderecoDeCompraDoEnvio(d.origem, d.sessao_id, d.acao);
  let enviados = 0;
  let falhas = 0;
  let faltam = 0;
  while (portas.agora() < limite) {
    const pessoas = await portas.reivindicar(TAMANHO_DO_LOTE);
    if (pessoas.length === 0) { faltam = await portas.atualizar(); break; }
    const emails: EmailDaFila[] = pessoas.map(p => {
      const e = emailDeDivulgacao({ loja: d.loja, nome: p.nome, assunto: d.assunto, mensagem: d.mensagem, enderecoDeCompra, enderecoParaSair: d.enderecoParaSair(p.token) });
      return { para: p.email, assunto: e.assunto, html: e.html, texto: e.texto, token: p.token };
    });
    const chave = `ticketeria-lote-${pessoas[0].id}-${pessoas.length}`;
    const marcas: MarcaDaFila[] = [];
    const lote = await portas.enviarLote(emails, chave);
    if (lote.ok && lote.ids.length === pessoas.length) {
      pessoas.forEach((p, i) => marcas.push({ id: p.id, ok: true, provedorId: lote.ids[i] }));
    } else {
      for (let i = 0; i < pessoas.length; i++) {
        let r: { ok: boolean; id?: string } = { ok: false };
        try { r = await portas.enviarUm(emails[i], `ticketeria-envio-${pessoas[i].id}`); } catch (erro) { portas.registrarErro?.(erro); }
        marcas.push({ id: pessoas[i].id, ok: r.ok, provedorId: r.id });
      }
    }
    await portas.marcar(marcas);
    enviados += marcas.filter(m => m.ok).length;
    falhas += marcas.filter(m => !m.ok).length;
    faltam = await portas.atualizar();
    if (faltam === 0) break;
  }
  return { enviados, falhas, faltam };
}

// ─── O resultado em vendas ──────────────────────────────────────────────────

export type PedidoDoEnvio = { id: string; total_centavos: number; origem_acao: string | null };
/** Ingressos e valor vendidos pelo link de cada ação (as compras pagas com `canal=email` e a ação do envio). */
export function vendasPorAcao(pedidos: PedidoDoEnvio[], quantidadePorPedido: Record<string, number>): Record<string, { ingressos: number; vendido_centavos: number }> {
  const saida: Record<string, { ingressos: number; vendido_centavos: number }> = {};
  for (const p of pedidos) {
    if (!p.origem_acao) continue;
    const s = saida[p.origem_acao] ?? { ingressos: 0, vendido_centavos: 0 };
    s.ingressos += quantidadePorPedido[p.id] ?? 0;
    s.vendido_centavos += p.total_centavos;
    saida[p.origem_acao] = s;
  }
  return saida;
}

// ─── Mensagens para quem envia ──────────────────────────────────────────────

/** A frase para o produtor quando o envio não segue. */
export function mensagemDoErroDoEnvio(codigo: string, extra?: { total?: number; limite?: number; motivo?: string; restante?: number }): string {
  switch (codigo) {
    case "envio_desligado": return "O envio de e-mail ainda não está ligado. Fale com o suporte do Jards.";
    case "sem_destinatarios": return "Ninguém para receber: só entra quem aceitou novidades e não saiu da lista.";
    case "sem_whatsapp": return "Ninguém com WhatsApp neste grupo: só entra quem aceitou novidades, informou o número e não saiu da lista.";
    case "destinatarios_demais": return `Este envio teria ${extra?.total ?? "gente demais"} pessoas, e o limite por envio é ${extra?.limite ?? LIMITE_DE_DESTINATARIOS}. Escolha um grupo menor.`;
    case "email_nao_ativo":
      if (extra?.motivo === "cota_do_mes") return `Esse envio passa do limite de e-mails do mês${typeof extra.restante === "number" ? `: ainda dá para mandar ${extra.restante.toLocaleString("pt-BR")}` : ""}. Escolha um grupo menor ou espere a renovação.`;
      if (extra?.motivo === "sem_dominio" || extra?.motivo === "dominio_nao_verificado") return "O e-mail ainda não está pronto: falta confirmar o seu domínio. Veja a aba E-mail.";
      return "Ative o e-mail na aba E-mail para enviar.";
    case "envio_repetido": return "Um envio igual a este acabou de sair. Espere alguns minutos antes de repetir.";
    case "sessao_indisponivel": return "Essa sessão não está mais à venda. Escolha outra.";
    case "teste_falhou": return "Não foi possível enviar o teste agora. Tente de novo em instantes.";
    case "sem_email_para_o_teste": return "Sua conta não tem e-mail para receber o teste.";
    case "dados_invalidos": return "Confira o assunto, a mensagem e para quem vai.";
    case "muitas_tentativas": return "Muitas tentativas seguidas. Espere um pouco.";
    default: return "Não foi possível enviar agora. Tente de novo em instantes.";
  }
}
