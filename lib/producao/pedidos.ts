// Os pedidos de pagamento da temporada (plano do módulo, PD5.4, primeiro corte): rascunho, pendente, aprovado, pagando, pago ou recusado, com a alçada de quem
// aprova. Sem tela e sem banco; tudo em centavos inteiros. A situação só muda pela função `fn_producao_pedido_mudar`, que o banco confere; aqui a tela só decide
// quais passos oferecer a quem.

import { emCentavos, formatarReais } from "@/lib/producao/dinheiro";
import { montarPlanilha, reaisNaPlanilha } from "@/lib/producao/planilha";
import type { SituacaoDoPedido } from "@/lib/producao/estados";

export const ROTULO_DA_SITUACAO_DO_PEDIDO: Record<SituacaoDoPedido, string> = {
  rascunho: "Rascunho", pendente: "Aguardando aprovação", aprovado: "Aprovado", pagando: "Pagando", pago: "Pago", recusado: "Recusado",
};

export type PedidoDaTemporada = {
  id: string; orcamento_linha_id: string | null; solicitante_id: string | null; descricao: string; favorecido: string | null; valor: number; justificativa: string | null;
  situacao: SituacaoDoPedido; aprovado_por: string | null; aprovado_em: string | null; motivo_recusa: string | null; pendencia: string | null; pendencia_ate: string | null;
};

export type PassoDoPedido = "enviar" | "retirar" | "aprovar" | "recusar" | "reabrir" | "pagar" | "concluir";
export const ROTULO_DO_PASSO_DO_PEDIDO: Record<PassoDoPedido, string> = {
  enviar: "Enviar para aprovação", retirar: "Retirar da aprovação", aprovar: "Aprovar", recusar: "Recusar", reabrir: "Reabrir para ajustar", pagar: "Começar a pagar", concluir: "Marcar como pago",
};

/**
 * Os passos que a tela oferece a quem, por situação. `podeEditar` é quem edita e vê o dinheiro (pede, retira, reabre, começa a pagar e conclui) e `podeAprovar` é quem
 * tem a ação de aprovar (administrador, ou colaborador com dinheiro e alçada). O banco confere de novo, e a alçada só ele sabe contra o valor.
 */
export function passosDoPedido(situacao: SituacaoDoPedido, quem: { podeEditar: boolean; podeAprovar: boolean }): PassoDoPedido[] {
  const passos: PassoDoPedido[] = [];
  if (situacao === "rascunho" && quem.podeEditar) passos.push("enviar");
  if (situacao === "pendente") {
    if (quem.podeAprovar) passos.push("aprovar", "recusar");
    if (quem.podeEditar) passos.push("retirar");
  }
  if (situacao === "aprovado" && quem.podeEditar) passos.push("pagar");
  if (situacao === "pagando" && quem.podeEditar) passos.push("concluir");
  if (situacao === "recusado" && quem.podeEditar) passos.push("reabrir");
  return passos;
}

/** Só o rascunho se edita (valor, descrição, favorecido, justificativa e linha do orçamento); depois de enviado, o que foi pedido não muda. */
export const pedidoEditavel = (situacao: SituacaoDoPedido) => situacao === "rascunho";
/** Só rascunho e recusado se apagam. */
export const pedidoApagavel = (situacao: SituacaoDoPedido) => situacao === "rascunho" || situacao === "recusado";
/** A próxima pendência se escreve até o pedido ser pago. */
export const pendenciaEditavel = (situacao: SituacaoDoPedido) => situacao !== "pago";

/** A pendência com data vencida (antes de `hoje`) num pedido que ainda não foi pago nem recusado. */
export const pendenciaVencida = (pedido: Pick<PedidoDaTemporada, "pendencia" | "pendencia_ate" | "situacao">, hoje: string) =>
  pedido.pendencia !== null && pedido.pendencia_ate !== null && pedido.pendencia_ate < hoje && pedido.situacao !== "pago" && pedido.situacao !== "recusado";

export type TotaisDosPedidos = { aguardandoCentavos: number; aprovadoAPagarCentavos: number; pagoCentavos: number; pendenciasVencidas: number };

/** Quanto espera aprovação, quanto está aprovado e ainda não pago (aprovado e pagando) e quanto já foi pago; e quantas pendências estão vencidas. */
export function totaisDosPedidos(pedidos: readonly Pick<PedidoDaTemporada, "valor" | "situacao" | "pendencia" | "pendencia_ate">[], hoje: string): TotaisDosPedidos {
  const soma = (situacoes: SituacaoDoPedido[]) => pedidos.filter(pedido => situacoes.includes(pedido.situacao)).reduce((total, pedido) => total + emCentavos(pedido.valor), 0);
  return { aguardandoCentavos: soma(["pendente"]), aprovadoAPagarCentavos: soma(["aprovado", "pagando"]), pagoCentavos: soma(["pago"]), pendenciasVencidas: pedidos.filter(pedido => pendenciaVencida(pedido, hoje)).length };
}

export type LeituraDoPedido =
  | { ok: true; valor: { descricao: string; favorecido: string | null; valor: number; justificativa: string | null; pendencia: string | null; pendencia_ate: string | null } }
  | { ok: false; erro: string; campo: string };

/** O pedido como o banco confere: descrição de 1 a 120 letras, favorecido de até 120, valor maior que zero, justificativa de até 400, pendência de até 200 e a data dela válida. */
export function lerPedido(campos: { descricao: string; favorecido: string; valor: string; justificativa: string; pendencia: string; pendenciaAte: string }, lerValor: (texto: string) => number | null): LeituraDoPedido {
  const descricao = campos.descricao.trim();
  if (descricao === "") return { ok: false, erro: "Escreva o que precisa ser pago (por exemplo, cachê do diretor).", campo: "descricao" };
  if (descricao.length > 120) return { ok: false, erro: "A descrição pode ter até 120 letras.", campo: "descricao" };
  const favorecido = campos.favorecido.trim();
  if (favorecido.length > 120) return { ok: false, erro: "O nome de quem vai receber pode ter até 120 letras.", campo: "favorecido" };
  const valor = lerValor(campos.valor);
  if (valor === null || valor <= 0 || valor > 999999999999.99) return { ok: false, erro: "Digite o valor pedido em reais, maior que zero.", campo: "valor" };
  const justificativa = campos.justificativa.trim();
  if (justificativa.length > 400) return { ok: false, erro: "A justificativa pode ter até 400 letras.", campo: "justificativa" };
  const pendencia = campos.pendencia.trim();
  if (pendencia.length > 200) return { ok: false, erro: "A pendência pode ter até 200 letras.", campo: "pendencia" };
  if (campos.pendenciaAte !== "" && (!/^\d{4}-\d{2}-\d{2}$/.test(campos.pendenciaAte) || Number.isNaN(Date.parse(`${campos.pendenciaAte}T00:00:00Z`)))) return { ok: false, erro: "Escolha a data da pendência ou deixe em branco.", campo: "pendenciaAte" };
  return {
    ok: true,
    valor: { descricao, favorecido: favorecido === "" ? null : favorecido, valor, justificativa: justificativa === "" ? null : justificativa, pendencia: pendencia === "" ? null : pendencia, pendencia_ate: pendencia === "" || campos.pendenciaAte === "" ? null : campos.pendenciaAte },
  };
}

const dia = (data: string) => data.split("-").reverse().join("/");

/** A planilha dos pedidos da temporada: um por linha, com a situação, a próxima pendência e quem decidiu fica no próprio app. */
export function planilhaDosPedidos(campos: { temporada: string; hoje: string; pedidos: readonly PedidoDaTemporada[]; rotuloDaLinha: (id: string) => string }): string {
  const { temporada, hoje, pedidos, rotuloDaLinha } = campos;
  const totais = totaisDosPedidos(pedidos, hoje);
  return montarPlanilha([
    ["Temporada", temporada],
    [],
    ["Descrição", "Favorecido", "Valor (R$)", "Situação", "Linha do orçamento", "Próxima pendência", "Até", "Motivo da recusa"],
    ...pedidos.map(pedido => [
      pedido.descricao, pedido.favorecido ?? "", reaisNaPlanilha(emCentavos(pedido.valor)), ROTULO_DA_SITUACAO_DO_PEDIDO[pedido.situacao],
      pedido.orcamento_linha_id ? rotuloDaLinha(pedido.orcamento_linha_id) : "", pedido.pendencia ?? "", pedido.pendencia_ate ? dia(pedido.pendencia_ate) : "", pedido.motivo_recusa ?? "",
    ]),
    [],
    ["Aguardando aprovação (R$)", reaisNaPlanilha(totais.aguardandoCentavos)],
    ["Aprovado e a pagar (R$)", reaisNaPlanilha(totais.aprovadoAPagarCentavos)],
    ["Pago (R$)", reaisNaPlanilha(totais.pagoCentavos)],
  ]);
}

/** O texto para o erro que o banco devolve ao gravar ou ao mudar a situação. */
export function mensagemDoErroDePedido(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (mensagem.includes("alcada_insuficiente")) return "O valor passa da sua alçada. Peça a quem tem alçada maior, ou a um administrador.";
  if (mensagem.includes("nao_aprova_o_proprio")) return "Quem pediu não aprova o próprio pedido. Peça a outra pessoa com alçada, ou a um administrador.";
  if (mensagem.includes("pedido_sem_lancamento")) return `Para marcar como pago, os lançamentos ligados ao pedido precisam somar pelo menos o valor dele.`;
  if (mensagem.includes("pedido_sem_motivo")) return "Escreva o motivo da recusa.";
  if (mensagem.includes("pedido_pago")) return "O pedido está pago: nada muda.";
  if (mensagem.includes("pedido_enviado")) return "Depois de enviado, o que foi pedido não muda (valor, descrição, favorecido, justificativa e linha do orçamento), e o pedido não se apaga. Retire-o da aprovação ou reabra-o para ajustar.";
  if (mensagem.includes("pedido_passo_invalido")) return "Esse passo não vale para a situação atual do pedido.";
  if (mensagem.includes("linha_de_outra_temporada")) return "Essa linha do orçamento não é desta temporada.";
  if (mensagem.includes("pedido_nao_aprovado")) return "Só se liga um lançamento a um pedido aprovado.";
  if (mensagem.includes("sem_permissao") || erro.code === "42501") return "Você não pode fazer isso com este pedido (ele pede a permissão de dinheiro, e aprovar pede alçada).";
  return "Não foi possível salvar. Tente de novo.";
}

/** Uma frase com o que o pedido está esperando, para a lista. */
export function resumoDoPedido(pedido: Pick<PedidoDaTemporada, "valor" | "favorecido" | "situacao">): string {
  return `${formatarReais(emCentavos(pedido.valor))}${pedido.favorecido ? ` para ${pedido.favorecido}` : ""} · ${ROTULO_DA_SITUACAO_DO_PEDIDO[pedido.situacao].toLowerCase()}`;
}
