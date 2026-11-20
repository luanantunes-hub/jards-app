// Os lançamentos da temporada (plano do módulo, PD5.3, primeiro corte): um pagamento feito, dividido entre as linhas do orçamento. Sem tela e sem banco; tudo em
// centavos inteiros.
//
// O PAGO do orçamento (PD5.1) vem daqui: a soma da divisão de cada linha vale no lugar do pago digitado. O lançamento não é uma ordem de pagamento: o app só registra
// o que já foi pago, fora dele.

import { emCentavos, formatarReais } from "@/lib/producao/dinheiro";
import { montarPlanilha, reaisNaPlanilha } from "@/lib/producao/planilha";

export type LancamentoDaTemporada = {
  id: string; descricao: string; favorecido: string | null; documento: string | null; data: string; valor: number; observacao: string | null;
  /** O pedido aprovado que este pagamento cumpre (PD5.4). */
  pedido_id?: string | null;
};
export type DivisaoDoLancamento = { id: string; lancamento_id: string; orcamento_linha_id: string; valor: number };

/** O que cada linha do orçamento recebeu em pagamentos, em centavos, por id da linha. Linha sem divisão não aparece (vale o pago digitado). */
export function pagoPorLinha(divisoes: readonly Pick<DivisaoDoLancamento, "orcamento_linha_id" | "valor">[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  for (const divisao of divisoes) mapa[divisao.orcamento_linha_id] = (mapa[divisao.orcamento_linha_id] ?? 0) + emCentavos(divisao.valor);
  return mapa;
}

export type ContaDaDivisao = { divididoCentavos: number; faltaCentavos: number; passaCentavos: number; completo: boolean; avisos: string[] };

/** Quanto do lançamento já está dividido, quanto falta e quanto passa (o banco não deixa passar; a tela avisa antes de gravar). */
export function contaDaDivisao(valorCentavos: number, divisaoCentavos: readonly number[]): ContaDaDivisao {
  const dividido = divisaoCentavos.reduce((soma, parte) => soma + parte, 0);
  const falta = Math.max(0, valorCentavos - dividido);
  const passa = Math.max(0, dividido - valorCentavos);
  const avisos: string[] = [];
  if (passa > 0) avisos.push(`A divisão passa do valor do lançamento em ${formatarReais(passa)}.`);
  else if (dividido > 0 && falta > 0) avisos.push(`Faltam ${formatarReais(falta)} para dividir entre as linhas do orçamento.`);
  return { divididoCentavos: dividido, faltaCentavos: falta, passaCentavos: passa, completo: dividido === valorCentavos && valorCentavos > 0, avisos };
}

/** Divide o valor igualmente entre as linhas; os centavos que sobram vão um a um para as primeiras. */
export function dividirIgualmente(valorCentavos: number, quantidade: number): number[] {
  if (quantidade <= 0 || valorCentavos <= 0) return [];
  const base = Math.floor(valorCentavos / quantidade);
  const resto = valorCentavos - base * quantidade;
  return Array.from({ length: quantidade }, (_, indice) => base + (indice < resto ? 1 : 0));
}

export type LeituraDoLancamento =
  | { ok: true; valor: { descricao: string; favorecido: string | null; documento: string | null; data: string; valor: number; observacao: string | null } }
  | { ok: false; erro: string; campo: string };

/**
 * O lançamento como o banco confere: descrição de 1 a 120 letras, favorecido de até 120, documento de até 60, a data do pagamento, valor maior que zero e
 * observação de até 300. `lerValor` é a leitura de reais da tela (lerValorEmReais).
 */
export function lerLancamento(campos: { descricao: string; favorecido: string; documento: string; data: string; valor: string; observacao: string }, lerValor: (texto: string) => number | null): LeituraDoLancamento {
  const descricao = campos.descricao.trim();
  if (descricao === "") return { ok: false, erro: "Escreva o que foi pago (por exemplo, cachê do elenco).", campo: "descricao" };
  if (descricao.length > 120) return { ok: false, erro: "A descrição pode ter até 120 letras.", campo: "descricao" };
  const favorecido = campos.favorecido.trim();
  if (favorecido.length > 120) return { ok: false, erro: "O nome de quem recebeu pode ter até 120 letras.", campo: "favorecido" };
  const documento = campos.documento.trim();
  if (documento.length > 60) return { ok: false, erro: "O número do documento pode ter até 60 letras.", campo: "documento" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.data) || Number.isNaN(Date.parse(`${campos.data}T00:00:00Z`))) return { ok: false, erro: "Escolha a data em que o pagamento foi feito.", campo: "data" };
  const valor = lerValor(campos.valor);
  if (valor === null || valor <= 0 || valor > 999999999999.99) return { ok: false, erro: "Digite o valor pago em reais, maior que zero, por exemplo 1.500 ou 350,50.", campo: "valor" };
  const observacao = campos.observacao.trim();
  if (observacao.length > 300) return { ok: false, erro: "A observação pode ter até 300 letras.", campo: "observacao" };
  return { ok: true, valor: { descricao, favorecido: favorecido === "" ? null : favorecido, documento: documento === "" ? null : documento, data: campos.data, valor, observacao: observacao === "" ? null : observacao } };
}

/** A planilha dos lançamentos da temporada, com o que cada um dividiu por linha do orçamento (`rotuloDaLinha` dá o nome de uma linha pelo id). */
export function planilhaDosLancamentos(campos: {
  temporada: string; lancamentos: readonly LancamentoDaTemporada[]; divisoes: readonly DivisaoDoLancamento[]; rotuloDaLinha: (id: string) => string;
}): string {
  const { temporada, lancamentos, divisoes, rotuloDaLinha } = campos;
  const ordenados = [...lancamentos].sort((a, b) => a.data.localeCompare(b.data) || a.descricao.localeCompare(b.descricao, "pt-BR"));
  const dia = (data: string) => data.split("-").reverse().join("/");
  const total = ordenados.reduce((soma, item) => soma + emCentavos(item.valor), 0);
  return montarPlanilha([
    ["Temporada", temporada],
    [],
    ["Data", "Descrição", "Favorecido", "Documento", "Valor (R$)", "Dividido entre"],
    ...ordenados.map(item => [
      dia(item.data), item.descricao, item.favorecido ?? "", item.documento ?? "", reaisNaPlanilha(emCentavos(item.valor)),
      divisoes.filter(divisao => divisao.lancamento_id === item.id).map(divisao => `${rotuloDaLinha(divisao.orcamento_linha_id)}: ${formatarReais(emCentavos(divisao.valor))}`).join(" | "),
    ]),
    ["Total", "", "", "", reaisNaPlanilha(total), ""],
  ]);
}

/** O texto para o erro que o banco devolve ao gravar. */
export function mensagemDoErroDeLancamento(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (mensagem.includes("divisao_passa_do_valor")) return "A divisão passa do valor do lançamento. Ajuste os valores das linhas ou o valor total.";
  if (mensagem.includes("linha_de_outra_temporada")) return "Essa linha do orçamento não é desta temporada.";
  if (mensagem.includes("pedido_nao_aprovado")) return "Só se liga um pagamento a um pedido aprovado.";
  if (mensagem.includes("pedido_de_outra_temporada")) return "Esse pedido não é desta temporada.";
  if (erro.code === "42501") return "Você não pode alterar os lançamentos (eles pedem a permissão de dinheiro).";
  if (erro.code === "23505" && mensagem.includes("documento")) return "Já existe um lançamento com esse documento deste favorecido. Se é o mesmo pagamento, não lance de novo.";
  if (erro.code === "23505") return "Essa linha do orçamento já está na divisão deste lançamento.";
  if (erro.code === "23503") return "Essa linha do orçamento já recebeu pagamento: apague ou mude o lançamento antes.";
  return "Não foi possível salvar. Tente de novo.";
}
