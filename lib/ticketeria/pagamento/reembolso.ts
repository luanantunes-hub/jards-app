// O reembolso por e-mail (passo D da T5; decisão D15 do plano): o comprador manda um e-mail com o assunto "reembolso - código do ingresso" e o sistema estorna sozinho,
// sem aprovação manual, quando tudo confere. Aqui está a lógica, com as portas injetadas (banco, Asaas e e-mail): testa-se sem rede e sem banco (tests/ticketeria-reembolso.test.ts).
//
// O que confere: o pedido existe e está pago; o e-mail vem do MESMO endereço da compra (outro endereço cai na fila do Jards); o pedido de reembolso chega em até 7 dias da compra
// (conta a hora em que o e-mail chegou, decisão do dono); nenhum ingresso foi usado. Fora do prazo: resposta cordial (a proposta da seção 10 do plano). Tudo o que não é
// estornado fica registrado com o motivo (a fila do Jards), e nunca se estorna duas vezes o mesmo pedido.

import { partidasDaDevolucao, type Partida } from "@/lib/ticketeria/pagamento/razao";

export const PRAZO_DO_REEMBOLSO_EM_DIAS = 7;

/** O assunto "reembolso - ABCD2345" (também com "Re:", "Enc:", dois-pontos ou travessão): devolve o código lido (8 letras do pedido ou 10 do ingresso), ou null se não é um pedido de reembolso. */
export function lerAssuntoDoReembolso(assunto: string): { codigo: string | null } | null {
  const m = /^\s*(?:(?:re|res|enc|fwd?)\s*:\s*)*reembolso\b\s*[-–—:]?\s*(.*)$/i.exec((assunto ?? "").normalize("NFC"));
  if (!m) return null;
  const achado = /\b([A-HJ-NP-Za-hj-np-z2-9]{10}|[A-HJ-NP-Za-hj-np-z2-9]{8})\b/.exec(m[1].replace(/[\s-]+(?=[A-Za-z0-9])/g, " "));
  return { codigo: achado ? achado[1].toUpperCase() : null };
}

/** O endereço puro de um "Nome <endereco@dominio>" ou de um endereço solto, em minúsculas. */
export function enderecoDoRemetente(texto: string): string {
  const entre = /<([^<>\s]+@[^<>\s]+)>/.exec(texto ?? "");
  return (entre ? entre[1] : texto ?? "").trim().toLowerCase();
}

/** O endereço que o comprador usa para pedir reembolso (o mostrado na página do pedido) e o endereço de recebimento do Resend (reembolso@domínio): vale um e-mail para qualquer um dos dois. */
export function enderecosDeReembolso(ambiente: Record<string, string | undefined> = process.env): string[] {
  const publico = ambiente.TICKETERIA_EMAIL_DE_REEMBOLSO || "luan.antunes@jards.com.br";
  const dominio = (ambiente.NEXT_PUBLIC_PRESTACAO_EMAIL_DOMINIO ?? "").toLowerCase().replace(/^@/, "");
  return [publico.toLowerCase(), ...(dominio ? [`reembolso@${dominio}`] : [])];
}

export type SituacaoDoReembolso = "estornado" | "fora_do_prazo" | "remetente_diferente" | "nao_encontrado" | "ja_reembolsado" | "nao_elegivel" | "falhou";

export type PedidoParaReembolso = {
  id: string; loja_id: string; codigo: string; comprador_nome: string; comprador_email: string; situacao: string;
  total_centavos: number; taxa_centavos: number; produtor_centavos: number; custo_meio_centavos: number;
  pago_em: string | null; provedor: string | null; provedor_ref: string | null; reembolsado_em: string | null; ingresso_usado: boolean;
};

export type DecisaoDeReembolso = { acao: "estornar" } | { acao: "recusar"; situacao: Exclude<SituacaoDoReembolso, "estornado" | "falhou">; motivo: string };

/** A decisão, só com o que o banco sabe e o que o e-mail trouxe. Recusa na dúvida: um estorno indevido não se desfaz. */
export function decidirReembolso(entrada: { pedido: PedidoParaReembolso | null; remetente: string; recebidoEm: string }): DecisaoDeReembolso {
  const { pedido } = entrada;
  if (!pedido) return { acao: "recusar", situacao: "nao_encontrado", motivo: "nenhum pedido com esse código" };
  if (pedido.reembolsado_em) return { acao: "recusar", situacao: "ja_reembolsado", motivo: "o pedido já foi reembolsado" };
  if (enderecoDoRemetente(entrada.remetente) !== enderecoDoRemetente(pedido.comprador_email)) return { acao: "recusar", situacao: "remetente_diferente", motivo: "o e-mail não veio do endereço da compra" };
  if (pedido.situacao !== "pago" || !pedido.pago_em) return { acao: "recusar", situacao: "nao_elegivel", motivo: "o pedido não está pago" };
  const chegou = Date.parse(entrada.recebidoEm);
  const pago = Date.parse(pedido.pago_em);
  if (!Number.isFinite(chegou) || !Number.isFinite(pago)) return { acao: "recusar", situacao: "nao_elegivel", motivo: "data ilegível" };
  if (chegou - pago > PRAZO_DO_REEMBOLSO_EM_DIAS * 86_400_000) return { acao: "recusar", situacao: "fora_do_prazo", motivo: `pedido de ${Math.floor((chegou - pago) / 86_400_000)} dias depois da compra` };
  if (pedido.ingresso_usado) return { acao: "recusar", situacao: "nao_elegivel", motivo: "algum ingresso já foi usado na entrada" };
  if (pedido.provedor !== "asaas" || !pedido.provedor_ref) return { acao: "recusar", situacao: "nao_elegivel", motivo: "o pedido não tem pagamento no Asaas para estornar" };
  if (pedido.total_centavos <= 0) return { acao: "recusar", situacao: "nao_elegivel", motivo: "pedido gratuito: não há o que estornar" };
  return { acao: "estornar" };
}

type Mensagem = { assunto: string; texto: string; html: string };
const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emHtml = (paragrafos: string[]) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#282525">${paragrafos.map(p => `<p style="margin:0 0 14px">${escapar(p)}</p>`).join("")}</div>`;
const mensagem = (assunto: string, paragrafos: string[]): Mensagem => ({ assunto, texto: paragrafos.join("\n\n"), html: emHtml(paragrafos) });
const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
const dataBr = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)).replace(", ", " às ");

/** As respostas ao comprador. Quem não é achado e quem escreveu de outro endereço recebem a MESMA resposta: ela não revela se um código existe. */
export const RESPOSTAS = {
  estornado: (p: PedidoParaReembolso) => mensagem("Reembolso do pedido " + p.codigo, [
    `Olá, ${p.comprador_nome}!`,
    `Pedimos o reembolso de ${reais(p.total_centavos)} do pedido ${p.codigo} ao seu banco, pelo mesmo meio com que você pagou. No Pix, o dinheiro costuma aparecer na sua conta em poucos instantes; no cartão, o valor volta na fatura (em compra parcelada, todas as parcelas são devolvidas) e pode levar até duas faturas, conforme o seu banco. Se não aparecer, fale com o seu banco.`,
    "Os ingressos deste pedido foram cancelados e não valem mais na entrada.",
  ]),
  foraDoPrazo: (p: PedidoParaReembolso, codigo: string, recebidoEm: string, organizador: string) => mensagem("Sobre o seu pedido de reembolso", [
    "Olá!",
    `Recebemos o seu pedido de reembolso do ingresso ${codigo} em ${dataBr(recebidoEm)}. O prazo de desistência é de 7 dias corridos a partir da compra, e esta compra foi feita em ${p.pago_em ? dataBr(p.pago_em) : "—"}, fora desse prazo; por isso não conseguimos devolver o valor por este canal.`,
    `Se o evento for cancelado ou adiado, você tem direito à devolução e avisaremos por e-mail. Se aconteceu algum problema com o ingresso ou com o evento, fale com o organizador (${organizador}). Obrigado pela compreensão.`,
  ]),
  naoLocalizado: () => mensagem("Não localizamos o seu pedido", [
    "Olá!",
    "Não conseguimos localizar uma compra com esse código feita com este endereço de e-mail. Escreva de novo, a partir do mesmo e-mail que você usou na compra, com o assunto \"reembolso - código do ingresso\", trocando \"código do ingresso\" pelo código que aparece no seu ingresso.",
  ]),
  jaReembolsado: (p: PedidoParaReembolso) => mensagem("Pedido " + p.codigo + " já reembolsado", ["Olá!", `O pedido ${p.codigo} já foi reembolsado. Se o valor não apareceu na sua conta, fale com o seu banco.`]),
  emAnalise: (p: PedidoParaReembolso) => mensagem("Estamos analisando o seu pedido de reembolso", ["Olá!", `Recebemos o seu pedido de reembolso do pedido ${p.codigo}. Ele precisa de uma análise nossa, e responderemos por e-mail.`]),
};

export type PortasDoReembolso = {
  /** fn_ticketeria_reembolso_registrar: o e-mail é registrado uma vez só (o Resend reenvia). `situacao` é a atual do registro. */
  registrar(e: { email_id: string; remetente: string; assunto: string; recebido_em: string }, codigo: string | null): Promise<{ id: string; novo: boolean; situacao: string }>;
  /** fn_ticketeria_pedido_para_reembolso. */
  buscarPedido(codigo: string): Promise<PedidoParaReembolso | null>;
  /** fn_ticketeria_reembolso_reivindicar: true só para quem começa o estorno. */
  reivindicar(id: string, pedido: string): Promise<boolean>;
  /** fn_ticketeria_reembolso_marcar. */
  marcar(id: string, situacao: Exclude<SituacaoDoReembolso, "estornado">, motivo: string, pedido?: string): Promise<void>;
  /** fn_ticketeria_reembolso_autorizar_estorno: a ordem do cadeado, antes de o Asaas perguntar. */
  autorizarEstorno(id: string): Promise<void>;
  /** O estorno no Asaas: devolve o pagamento inteiro ao comprador (Pix, cartão ou o parcelamento todo), com a comissão do Jards saindo da carteira do Jards. `ok: false` quando o Asaas recusa (sem saldo, por exemplo). */
  estornar(pedido: PedidoParaReembolso): Promise<{ ok: boolean; motivo?: string; ref?: string }>;
  /** fn_ticketeria_reembolso_concluir: cancela o pedido e os ingressos e grava a devolução no razão. */
  concluir(id: string, partidas: Partida[], ref: string | null): Promise<void>;
  /** O e-mail ao comprador. Nunca derruba o resto. */
  responder(para: string, mensagem: Mensagem): Promise<void>;
  /** Avisa o Jards (por e-mail) de que um reembolso precisa de uma pessoa: o estorno falhou, a gravação falhou depois do estorno ou o pedido pede análise. Opcional; nunca derruba o resto. */
  avisarOJards?(aviso: { assunto: string; texto: string }): Promise<void>;
  /** O nome de quem organiza (a loja), para a resposta de fora do prazo. */
  nomeDoOrganizador(loja: string): Promise<string>;
  registrarErro?(erro: unknown): void;
};

export type ResultadoDoEmail = { resultado: SituacaoDoReembolso | "ignorado" | "repetido" };

export async function tratarEmailDeReembolso(email: { email_id: string; remetente: string; assunto: string; recebido_em: string }, portas: PortasDoReembolso): Promise<ResultadoDoEmail> {
  const lido = lerAssuntoDoReembolso(email.assunto);
  if (!lido) return { resultado: "ignorado" };
  const responder = async (para: string, m: Mensagem) => { try { await portas.responder(para, m); } catch (erro) { portas.registrarErro?.(erro); } };
  const remetente = enderecoDoRemetente(email.remetente);
  const avisar = async (assunto: string, texto: string) => { try { await portas.avisarOJards?.({ assunto, texto }); } catch (erro) { portas.registrarErro?.(erro); } };

  const registro = await portas.registrar({ ...email, remetente }, lido.codigo);
  // Já tratado (o Resend reenvia): não faz nada. O que ficou em "recebido" (a conta caiu no meio) é retomado.
  if (!registro.novo && registro.situacao !== "recebido") return { resultado: "repetido" };

  const pedido = lido.codigo ? await portas.buscarPedido(lido.codigo) : null;
  const decisao = decidirReembolso({ pedido, remetente, recebidoEm: email.recebido_em });

  if (decisao.acao === "recusar") {
    await portas.marcar(registro.id, decisao.situacao, decisao.motivo, pedido?.id);
    if (decisao.situacao === "fora_do_prazo" && pedido) await responder(pedido.comprador_email, RESPOSTAS.foraDoPrazo(pedido, lido.codigo ?? pedido.codigo, email.recebido_em, await portas.nomeDoOrganizador(pedido.loja_id).catch(() => "a produtora do evento")));
    else if (decisao.situacao === "ja_reembolsado" && pedido) await responder(pedido.comprador_email, RESPOSTAS.jaReembolsado(pedido));
    else if (decisao.situacao === "nao_elegivel" && pedido) {
      await responder(pedido.comprador_email, RESPOSTAS.emAnalise(pedido));
      await avisar(`Reembolso para analisar: pedido ${pedido.codigo}`, `Um pedido de reembolso não pôde ser atendido sozinho e espera uma análise.\n\nPedido: ${pedido.codigo}\nMotivo: ${decisao.motivo}\nE-mail recebido: ${email.recebido_em}\n\nEle está na fila da tela Vendas (seção Reembolsos) da loja.`);
    }
    else await responder(remetente, RESPOSTAS.naoLocalizado());
    return { resultado: decisao.situacao };
  }

  if (!pedido) throw new Error("decisão de estornar sem pedido");
  // Só um e-mail começa o estorno de um pedido, uma vez só.
  if (!(await portas.reivindicar(registro.id, pedido.id))) return { resultado: "repetido" };
  let estorno: { ok: boolean; motivo?: string; ref?: string };
  try {
    await portas.autorizarEstorno(registro.id);
    estorno = await portas.estornar(pedido);
  } catch (erro) {
    portas.registrarErro?.(erro);
    estorno = { ok: false, motivo: "erro ao falar com o provedor" };
  }
  if (!estorno.ok) {
    await portas.marcar(registro.id, "falhou", `o Asaas não estornou: ${estorno.motivo ?? "sem motivo"}`, pedido.id);
    await responder(pedido.comprador_email, RESPOSTAS.emAnalise(pedido));
    await avisar(`Reembolso FALHOU: pedido ${pedido.codigo}`, `O Asaas não conseguiu estornar um reembolso.\n\nPedido: ${pedido.codigo} (${reais(pedido.total_centavos)})\nMotivo: ${estorno.motivo ?? "sem motivo"}\n\nO comprador recebeu "estamos analisando". O prazo de 7 dias conta da hora do e-mail (${email.recebido_em}). Dá para tentar de novo pelo botão da seção Reembolsos da tela Vendas, depois de resolver o motivo (por exemplo, saldo na conta do produtor).`);
    return { resultado: "falhou" };
  }
  // O dinheiro já voltou ao comprador. Se gravar no banco falhar, o registro fica "estornando" (nunca estorna de novo) e o erro grita no registro para o Jards acertar à mão.
  try {
    await portas.concluir(registro.id, partidasDaDevolucao(pedido, false), estorno.ref ?? null);
  } catch (erro) {
    portas.registrarErro?.(new Error(`ESTORNO FEITO NO ASAAS, MAS NÃO GRAVADO: pedido ${pedido.codigo}, referência ${estorno.ref ?? "?"}: ${erro instanceof Error ? erro.message : erro}`));
    await avisar(`URGENTE: estorno feito e não gravado, pedido ${pedido.codigo}`, `O Asaas estornou o Pix (${reais(pedido.total_centavos)}, referência ${estorno.ref ?? "?"}), mas o Jards não conseguiu gravar. O comprador já foi avisado do reembolso.\n\nPedido: ${pedido.codigo}\n\nO registro do reembolso ficou "estornando": o sistema nunca estorna de novo. É preciso cancelar o pedido, os ingressos e lançar a devolução no razão à mão.`);
  }
  await responder(pedido.comprador_email, RESPOSTAS.estornado(pedido));
  return { resultado: "estornado" };
}
