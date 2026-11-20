// Adiantamentos e diárias da temporada (plano do módulo, PD5.6, primeiro corte): dinheiro entregue a uma pessoa, a prestação de contas e o saldo; e a diária por
// período, com o recibo. Sem tela e sem banco; tudo em centavos inteiros.

import { emCentavos, formatarReais } from "@/lib/producao/dinheiro";
import { montarPlanilha, reaisNaPlanilha } from "@/lib/producao/planilha";
import type { SituacaoDoAdiantamento } from "@/lib/producao/estados";

export const ROTULO_DA_SITUACAO_DO_ADIANTAMENTO: Record<SituacaoDoAdiantamento, string> = { aberto: "Aberto", encerrado: "Encerrado" };

export type AdiantamentoDaTemporada = { id: string; pessoa_id: string; descricao: string; valor: number; data: string; devolvido: number; situacao: SituacaoDoAdiantamento; observacao: string | null };
export type GastoDoAdiantamento = { id: string; adiantamento_id: string; descricao: string; valor: number; data: string; documento: string | null };
export type DiariaDaTemporada = { id: string; pessoa_id: string; de: string; ate: string; dias: number; valor_dia: number; recibo: string | null; pago_em: string | null; observacao: string | null };

const dia = (data: string) => data.split("-").reverse().join("/");

export type ContaDoAdiantamento = { valorCentavos: number; prestadoCentavos: number; devolvidoCentavos: number; saldoCentavos: number; encerravel: boolean; avisos: string[] };

/** O saldo de um adiantamento: o valor entregue menos os gastos prestados menos o devolvido. Só se encerra com o saldo zerado. */
export function contaDoAdiantamento(adiantamento: Pick<AdiantamentoDaTemporada, "valor" | "devolvido" | "situacao">, gastos: readonly Pick<GastoDoAdiantamento, "valor">[]): ContaDoAdiantamento {
  const valor = emCentavos(adiantamento.valor);
  const prestado = gastos.reduce((soma, gasto) => soma + emCentavos(gasto.valor), 0);
  const devolvido = emCentavos(adiantamento.devolvido);
  const saldo = valor - prestado - devolvido;
  const avisos: string[] = [];
  if (saldo < 0) avisos.push(`A prestação e o devolvido passam do valor entregue em ${formatarReais(-saldo)}.`);
  else if (adiantamento.situacao === "aberto" && saldo > 0 && prestado + devolvido > 0) avisos.push(`Falta prestar ou devolver ${formatarReais(saldo)}.`);
  return { valorCentavos: valor, prestadoCentavos: prestado, devolvidoCentavos: devolvido, saldoCentavos: saldo, encerravel: adiantamento.situacao === "aberto" && saldo === 0, avisos };
}

/** O que está com as pessoas: soma dos saldos dos adiantamentos abertos. */
export function totalEmAberto(adiantamentos: readonly { adiantamento: Pick<AdiantamentoDaTemporada, "valor" | "devolvido" | "situacao">; gastos: readonly Pick<GastoDoAdiantamento, "valor">[] }[]): number {
  return adiantamentos.filter(item => item.adiantamento.situacao === "aberto").reduce((soma, item) => soma + Math.max(0, contaDoAdiantamento(item.adiantamento, item.gastos).saldoCentavos), 0);
}

export type LeituraDoAdiantamento =
  | { ok: true; valor: { pessoa_id: string; descricao: string; valor: number; data: string; devolvido: number; observacao: string | null } }
  | { ok: false; erro: string; campo: string };

const dataValida = (texto: string) => /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(`${texto}T00:00:00Z`));

/** O adiantamento como o banco confere: pessoa escolhida, descrição de 1 a 120, valor maior que zero, a data, devolvido de zero até o valor e observação de até 300. */
export function lerAdiantamento(campos: { pessoaId: string; descricao: string; valor: string; data: string; devolvido: string; observacao: string }, lerValor: (texto: string) => number | null): LeituraDoAdiantamento {
  if (campos.pessoaId === "") return { ok: false, erro: "Escolha a pessoa que recebeu o adiantamento.", campo: "pessoaId" };
  const descricao = campos.descricao.trim();
  if (descricao === "") return { ok: false, erro: "Escreva para que é o adiantamento (por exemplo, verba da estrada).", campo: "descricao" };
  if (descricao.length > 120) return { ok: false, erro: "A descrição pode ter até 120 letras.", campo: "descricao" };
  const valor = lerValor(campos.valor);
  if (valor === null || valor <= 0 || valor > 999999999999.99) return { ok: false, erro: "Digite o valor entregue em reais, maior que zero.", campo: "valor" };
  if (!dataValida(campos.data)) return { ok: false, erro: "Escolha o dia em que o dinheiro foi entregue.", campo: "data" };
  const devolvido = campos.devolvido.trim() === "" ? 0 : lerValor(campos.devolvido);
  if (devolvido === null || devolvido > valor) return { ok: false, erro: "O devolvido vai de zero até o valor entregue.", campo: "devolvido" };
  const observacao = campos.observacao.trim();
  if (observacao.length > 300) return { ok: false, erro: "A observação pode ter até 300 letras.", campo: "observacao" };
  return { ok: true, valor: { pessoa_id: campos.pessoaId, descricao, valor, data: campos.data, devolvido, observacao: observacao === "" ? null : observacao } };
}

export type LeituraDoGasto = { ok: true; valor: { descricao: string; valor: number; data: string; documento: string | null } } | { ok: false; erro: string; campo: string };

/** O gasto da prestação como o banco confere: descrição de 1 a 120, valor maior que zero, a data e o número do comprovante de até 60 letras. */
export function lerGasto(campos: { descricao: string; valor: string; data: string; documento: string }, lerValor: (texto: string) => number | null): LeituraDoGasto {
  const descricao = campos.descricao.trim();
  if (descricao === "") return { ok: false, erro: "Escreva o que foi gasto.", campo: "descricao" };
  if (descricao.length > 120) return { ok: false, erro: "A descrição pode ter até 120 letras.", campo: "descricao" };
  const valor = lerValor(campos.valor);
  if (valor === null || valor <= 0 || valor > 999999999999.99) return { ok: false, erro: "Digite o valor gasto em reais, maior que zero.", campo: "valor" };
  if (!dataValida(campos.data)) return { ok: false, erro: "Escolha o dia do gasto.", campo: "data" };
  const documento = campos.documento.trim();
  if (documento.length > 60) return { ok: false, erro: "O número do comprovante pode ter até 60 letras.", campo: "documento" };
  return { ok: true, valor: { descricao, valor, data: campos.data, documento: documento === "" ? null : documento } };
}

/** A prestação de contas de um adiantamento, em texto para colar ou imprimir. */
export function textoDaPrestacao(campos: { pessoa: string; adiantamento: AdiantamentoDaTemporada; gastos: readonly GastoDoAdiantamento[] }): string {
  const { pessoa, adiantamento, gastos } = campos;
  const conta = contaDoAdiantamento(adiantamento, gastos);
  const linhas = [`Prestação de contas: ${adiantamento.descricao} — ${pessoa}`, `Entregue em ${dia(adiantamento.data)}: ${formatarReais(conta.valorCentavos)}`];
  [...gastos].sort((a, b) => a.data.localeCompare(b.data)).forEach(gasto => linhas.push(`  ${dia(gasto.data)} · ${gasto.descricao}${gasto.documento ? ` (${gasto.documento})` : ""}: ${formatarReais(emCentavos(gasto.valor))}`));
  linhas.push(`Prestado: ${formatarReais(conta.prestadoCentavos)}`);
  if (conta.devolvidoCentavos > 0) linhas.push(`Devolvido: ${formatarReais(conta.devolvidoCentavos)}`);
  linhas.push(`Saldo: ${formatarReais(conta.saldoCentavos)}${adiantamento.situacao === "encerrado" ? " (encerrado)" : ""}`);
  return linhas.join("\n");
}

/** A planilha dos adiantamentos da temporada: um por linha, com o prestado, o devolvido e o saldo. */
export function planilhaDosAdiantamentos(campos: { temporada: string; itens: readonly { pessoa: string; adiantamento: AdiantamentoDaTemporada; gastos: readonly GastoDoAdiantamento[] }[] }): string {
  const linhas = campos.itens.map(({ pessoa, adiantamento, gastos }) => {
    const conta = contaDoAdiantamento(adiantamento, gastos);
    return [pessoa, adiantamento.descricao, dia(adiantamento.data), reaisNaPlanilha(conta.valorCentavos), reaisNaPlanilha(conta.prestadoCentavos), reaisNaPlanilha(conta.devolvidoCentavos), reaisNaPlanilha(conta.saldoCentavos), ROTULO_DA_SITUACAO_DO_ADIANTAMENTO[adiantamento.situacao]];
  });
  return montarPlanilha([["Temporada", campos.temporada], [], ["Pessoa", "Adiantamento", "Entregue em", "Valor (R$)", "Prestado (R$)", "Devolvido (R$)", "Saldo (R$)", "Situação"], ...linhas]);
}

/** Quantos dias há de `de` até `ate`, contando os dois (de 01 a 05 são 5). Zero se o período for ao contrário ou a data não valer. */
export function diasDoPeriodo(de: string, ate: string): number {
  if (!dataValida(de) || !dataValida(ate)) return 0;
  const dias = Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000) + 1;
  return dias >= 1 ? dias : 0;
}

/** O total de uma diária em centavos: dias × valor do dia. */
export const totalDaDiariaEmCentavos = (diaria: Pick<DiariaDaTemporada, "dias" | "valor_dia">) => diaria.dias * emCentavos(diaria.valor_dia);

export type TotaisDasDiarias = { totalCentavos: number; pagoCentavos: number; aPagarCentavos: number; dias: number };

/** O total das diárias, o que já foi pago (com recibo e dia) e o que falta pagar. */
export function totaisDasDiarias(diarias: readonly Pick<DiariaDaTemporada, "dias" | "valor_dia" | "pago_em">[]): TotaisDasDiarias {
  const total = diarias.reduce((soma, item) => soma + totalDaDiariaEmCentavos(item), 0);
  const pago = diarias.filter(item => item.pago_em !== null).reduce((soma, item) => soma + totalDaDiariaEmCentavos(item), 0);
  return { totalCentavos: total, pagoCentavos: pago, aPagarCentavos: total - pago, dias: diarias.reduce((soma, item) => soma + item.dias, 0) };
}

export type LeituraDaDiaria = { ok: true; valor: { pessoa_id: string; de: string; ate: string; dias: number; valor_dia: number; recibo: string | null; pago_em: string | null; observacao: string | null } } | { ok: false; erro: string; campo: string };

/**
 * A diária como o banco confere: pessoa escolhida, o período (até depois ou no mesmo dia de), de 1 até o número de dias do período (em branco vale o período inteiro),
 * valor do dia de zero para cima, recibo de até 60 letras e o dia do pagamento, que pede o recibo.
 */
export function lerDiaria(campos: { pessoaId: string; de: string; ate: string; dias: string; valorDia: string; recibo: string; pagoEm: string; observacao: string }, lerValor: (texto: string) => number | null): LeituraDaDiaria {
  if (campos.pessoaId === "") return { ok: false, erro: "Escolha a pessoa que recebe a diária.", campo: "pessoaId" };
  if (!dataValida(campos.de) || !dataValida(campos.ate)) return { ok: false, erro: "Escolha o primeiro e o último dia da diária.", campo: "de" };
  const periodo = diasDoPeriodo(campos.de, campos.ate);
  if (periodo < 1) return { ok: false, erro: "O último dia não pode vir antes do primeiro.", campo: "ate" };
  if (periodo > 366) return { ok: false, erro: "Um período de diária vai até 366 dias.", campo: "ate" };
  const dias = campos.dias.trim() === "" ? periodo : /^\d+$/.test(campos.dias.trim()) ? Number(campos.dias.trim()) : Number.NaN;
  if (!Number.isInteger(dias) || dias < 1 || dias > periodo) return { ok: false, erro: `Os dias de diária vão de 1 até ${periodo} (os dias do período).`, campo: "dias" };
  const valorDia = lerValor(campos.valorDia);
  if (valorDia === null || valorDia > 999999999999.99) return { ok: false, erro: "Digite o valor de cada dia em reais, por exemplo 200 ou 150,50.", campo: "valorDia" };
  const recibo = campos.recibo.trim();
  if (recibo.length > 60) return { ok: false, erro: "O número do recibo pode ter até 60 letras.", campo: "recibo" };
  if (campos.pagoEm !== "" && !dataValida(campos.pagoEm)) return { ok: false, erro: "Escolha o dia do pagamento ou deixe em branco.", campo: "pagoEm" };
  if (campos.pagoEm !== "" && recibo === "") return { ok: false, erro: "Para marcar como paga, escreva o número do recibo.", campo: "recibo" };
  const observacao = campos.observacao.trim();
  if (observacao.length > 300) return { ok: false, erro: "A observação pode ter até 300 letras.", campo: "observacao" };
  return { ok: true, valor: { pessoa_id: campos.pessoaId, de: campos.de, ate: campos.ate, dias, valor_dia: valorDia, recibo: recibo === "" ? null : recibo, pago_em: campos.pagoEm === "" ? null : campos.pagoEm, observacao: observacao === "" ? null : observacao } };
}

/** O recibo da diária em texto, para a pessoa assinar: o que recebeu, por quantos dias e quanto. */
export function textoDoReciboDaDiaria(campos: { pessoa: string; diaria: DiariaDaTemporada; temporada: string }): string {
  const { pessoa, diaria, temporada } = campos;
  return [
    `Recibo${diaria.recibo ? ` nº ${diaria.recibo}` : ""}`,
    `Recebi o valor de ${formatarReais(totalDaDiariaEmCentavos(diaria))}, referente a ${diaria.dias} ${diaria.dias === 1 ? "diária" : "diárias"} de ${formatarReais(emCentavos(diaria.valor_dia))}, de ${dia(diaria.de)} a ${dia(diaria.ate)}, na temporada "${temporada}".`,
    `Nome: ${pessoa}`,
    diaria.pago_em ? `Pago em ${dia(diaria.pago_em)}.` : "Pagamento: ______/______/______",
    "",
    "Assinatura: ______________________________",
  ].join("\n");
}

/** A planilha das diárias da temporada, uma por linha, com o total e o que falta pagar. */
export function planilhaDasDiarias(campos: { temporada: string; itens: readonly { pessoa: string; diaria: DiariaDaTemporada }[] }): string {
  const totais = totaisDasDiarias(campos.itens.map(item => item.diaria));
  return montarPlanilha([
    ["Temporada", campos.temporada],
    [],
    ["Pessoa", "De", "Até", "Dias", "Valor do dia (R$)", "Total (R$)", "Recibo", "Pago em"],
    ...campos.itens.map(({ pessoa, diaria }) => [pessoa, dia(diaria.de), dia(diaria.ate), String(diaria.dias), reaisNaPlanilha(emCentavos(diaria.valor_dia)), reaisNaPlanilha(totalDaDiariaEmCentavos(diaria)), diaria.recibo ?? "", diaria.pago_em ? dia(diaria.pago_em) : ""]),
    [],
    ["Total (R$)", reaisNaPlanilha(totais.totalCentavos)],
    ["Já pago (R$)", reaisNaPlanilha(totais.pagoCentavos)],
    ["A pagar (R$)", reaisNaPlanilha(totais.aPagarCentavos)],
  ]);
}

/** O texto para o erro que o banco devolve ao gravar. */
export function mensagemDoErroDeAdiantamento(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (mensagem.includes("adiantamento_encerrado")) return "O adiantamento está encerrado: nada muda e ele não se apaga.";
  if (mensagem.includes("adiantamento_com_saldo")) return "Só se encerra com o saldo zerado: preste o que falta ou registre a devolução.";
  if (mensagem.includes("prestacao_passa_do_adiantamento")) return "A prestação mais o devolvido passam do valor entregue.";
  if (mensagem.includes("diaria_paga")) return "A diária está paga: nada muda e ela não se apaga.";
  if (mensagem.includes("diaria_sem_recibo")) return "Para marcar como paga, escreva o número do recibo.";
  if (mensagem.includes("diaria_sobreposta")) return "Essa pessoa já tem uma diária que se cruza com este período.";
  if (mensagem.includes("dias_ou_periodo_invalido")) return "Confira o período: o último dia não vem antes do primeiro e os dias não passam dos dias do período.";
  if (erro.code === "42501") return "Você não pode alterar adiantamentos e diárias (eles pedem a permissão de dinheiro).";
  if (erro.code === "23503") return "Esta pessoa tem adiantamento ou diária: arquive em vez de apagar.";
  return "Não foi possível salvar. Tente de novo.";
}
