// As faturas ao contratante (plano do módulo, PD5.5, primeiro corte): o que a companhia cobra, as retenções, as parcelas e o que falta receber. Sem tela e sem banco;
// tudo em centavos inteiros. O app não cobra ninguém: registra e acompanha.

import { emCentavos, formatarReais } from "@/lib/producao/bordero";
import { dividirIgualmente } from "@/lib/producao/lancamentos";
import { montarPlanilha, reaisNaPlanilha } from "@/lib/producao/planilha";
import { SITUACOES_DA_FATURA, type SituacaoDaFatura } from "@/lib/producao/estados";

export const ROTULO_DA_SITUACAO_DA_FATURA: Record<SituacaoDaFatura, string> = { rascunho: "Rascunho", revisao: "Em revisão", em_aberto: "Em aberto", quitada: "Quitada" };

export type FaturaDaTemporada = {
  id: string; acordo_id: string | null; contratante: string; descricao: string; situacao: SituacaoDaFatura; valor: number; retencoes: number;
  nota_numero: string | null; emissao: string | null; vencimento: string | null; observacao: string | null;
};
export type ParcelaDaFatura = { id: string; fatura_id: string; rotulo: string | null; valor: number; vencimento: string; recebido_em: string | null };

/** O próximo passo da situação, ou nulo no fim (quitada). */
export function proximaSituacaoDaFatura(situacao: SituacaoDaFatura): SituacaoDaFatura | null {
  return SITUACOES_DA_FATURA[SITUACOES_DA_FATURA.indexOf(situacao) + 1] ?? null;
}

/** O passo de volta: só enquanto a fatura não está em aberto (revisão volta para rascunho). */
export const situacaoAnteriorDaFatura = (situacao: SituacaoDaFatura): SituacaoDaFatura | null => (situacao === "revisao" ? "rascunho" : null);

/** Em aberto e quitada não mudam valor, retenções, contratante nem acordo. */
export const faturaEmitida = (situacao: SituacaoDaFatura) => situacao === "em_aberto" || situacao === "quitada";

/** O valor líquido, o que de fato se recebe: o valor menos as retenções, em centavos. */
export const liquidoDaFaturaEmCentavos = (fatura: Pick<FaturaDaTemporada, "valor" | "retencoes">) => emCentavos(fatura.valor) - emCentavos(fatura.retencoes);

export type ContaDaFatura = {
  liquidoCentavos: number; parceladoCentavos: number; faltaParcelarCentavos: number; recebidoCentavos: number; aReceberCentavos: number; atrasadoCentavos: number;
  /** Parcelas vencidas e não recebidas, com a fatura em aberto. */
  parcelasAtrasadas: string[]; fecha: boolean; avisos: string[];
};

/**
 * As contas de uma fatura: quanto está parcelado e quanto falta parcelar, quanto já foi recebido, o que falta receber e o que está atrasado (parcela vencida
 * antes de `hoje` e não recebida, com a fatura em aberto). Só uma fatura em aberto ou quitada tem a receber; antes disso nada foi cobrado.
 */
export function calcularFatura(fatura: Pick<FaturaDaTemporada, "valor" | "retencoes" | "situacao">, parcelas: readonly Pick<ParcelaDaFatura, "id" | "valor" | "vencimento" | "recebido_em">[], hoje: string): ContaDaFatura {
  const liquido = liquidoDaFaturaEmCentavos(fatura);
  const parcelado = parcelas.reduce((soma, parcela) => soma + emCentavos(parcela.valor), 0);
  const recebido = parcelas.filter(parcela => parcela.recebido_em !== null).reduce((soma, parcela) => soma + emCentavos(parcela.valor), 0);
  const cobrada = faturaEmitida(fatura.situacao);
  const atrasadas = cobrada ? parcelas.filter(parcela => parcela.recebido_em === null && parcela.vencimento < hoje) : [];
  const avisos: string[] = [];
  if (parcelado > liquido) avisos.push(`As parcelas passam do valor líquido em ${formatarReais(parcelado - liquido)}.`);
  else if (!cobrada && parcelado < liquido && parcelas.length > 0) avisos.push(`Faltam ${formatarReais(liquido - parcelado)} para parcelar: a fatura só abre com as parcelas somando o valor líquido.`);
  if (atrasadas.length > 0) avisos.push(`${atrasadas.length} ${atrasadas.length === 1 ? "parcela atrasada" : "parcelas atrasadas"}.`);
  return {
    liquidoCentavos: liquido, parceladoCentavos: parcelado, faltaParcelarCentavos: Math.max(0, liquido - parcelado), recebidoCentavos: recebido,
    aReceberCentavos: cobrada ? Math.max(0, parcelado - recebido) : 0, atrasadoCentavos: atrasadas.reduce((soma, parcela) => soma + emCentavos(parcela.valor), 0),
    parcelasAtrasadas: atrasadas.map(parcela => parcela.id), fecha: parcelado === liquido && parcelas.length > 0, avisos,
  };
}

/** Soma de várias faturas: o que falta receber, o já recebido e o atrasado. Só entram as em aberto e quitadas. */
export function totaisDasFaturas(faturas: readonly { fatura: Pick<FaturaDaTemporada, "valor" | "retencoes" | "situacao">; parcelas: readonly Pick<ParcelaDaFatura, "id" | "valor" | "vencimento" | "recebido_em">[] }[], hoje: string) {
  let aReceber = 0; let recebido = 0; let atrasado = 0; let retido = 0;
  for (const { fatura, parcelas } of faturas) {
    if (!faturaEmitida(fatura.situacao)) continue;
    const conta = calcularFatura(fatura, parcelas, hoje);
    aReceber += conta.aReceberCentavos; recebido += conta.recebidoCentavos; atrasado += conta.atrasadoCentavos; retido += emCentavos(fatura.retencoes);
  }
  return { aReceberCentavos: aReceber, recebidoCentavos: recebido, atrasadoCentavos: atrasado, retidoCentavos: retido };
}

/** Soma `meses` a uma data ISO (AAAA-MM-DD), mantendo o fim do mês quando o dia não existe (31/01 + 1 mês = 28/02). */
export function somarMeses(dia: string, meses: number): string {
  const [ano, mes, data] = dia.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(data, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/**
 * Gera as parcelas de um valor líquido: `quantidade` partes iguais (os centavos que sobram vão para as primeiras) vencendo uma por mês a partir do primeiro
 * vencimento. Com `sinalPercentual`, a primeira é um sinal desse percentual do líquido (vence no primeiro vencimento) e o resto se divide nas demais.
 */
export function gerarParcelas(liquidoCentavos: number, quantidade: number, primeiroVencimento: string, sinalPercentual: number | null = null): { rotulo: string | null; valorCentavos: number; vencimento: string }[] {
  if (liquidoCentavos <= 0 || quantidade < 1) return [];
  if (sinalPercentual !== null && sinalPercentual > 0 && sinalPercentual < 100 && quantidade >= 2) {
    const sinal = Math.round((liquidoCentavos * sinalPercentual) / 100);
    const resto = dividirIgualmente(liquidoCentavos - sinal, quantidade - 1);
    return [{ rotulo: "Sinal", valorCentavos: sinal, vencimento: primeiroVencimento }, ...resto.map((valorCentavos, indice) => ({ rotulo: `Parcela ${indice + 2}`, valorCentavos, vencimento: somarMeses(primeiroVencimento, indice + 1) }))];
  }
  return dividirIgualmente(liquidoCentavos, quantidade).map((valorCentavos, indice) => ({ rotulo: quantidade === 1 ? null : `Parcela ${indice + 1}`, valorCentavos, vencimento: somarMeses(primeiroVencimento, indice) }));
}

export type LeituraDaFatura =
  | { ok: true; valor: { contratante: string; descricao: string; valor: number; retencoes: number; nota_numero: string | null; emissao: string | null; vencimento: string | null; observacao: string | null } }
  | { ok: false; erro: string; campo: string };

const dataValida = (texto: string) => /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(`${texto}T00:00:00Z`));

/** A fatura como o banco confere: contratante e descrição de 1 a 120 letras, valor maior que zero, retenções de zero ao valor, nota até 60 letras, datas válidas, observação até 300. */
export function lerFatura(campos: { contratante: string; descricao: string; valor: string; retencoes: string; notaNumero: string; emissao: string; vencimento: string; observacao: string }, lerValor: (texto: string) => number | null): LeituraDaFatura {
  const contratante = campos.contratante.trim();
  if (contratante === "") return { ok: false, erro: "Escreva quem vai pagar (a casa, o SESC, a prefeitura...).", campo: "contratante" };
  if (contratante.length > 120) return { ok: false, erro: "O nome pode ter até 120 letras.", campo: "contratante" };
  const descricao = campos.descricao.trim();
  if (descricao === "") return { ok: false, erro: "Escreva o que está sendo cobrado.", campo: "descricao" };
  if (descricao.length > 120) return { ok: false, erro: "A descrição pode ter até 120 letras.", campo: "descricao" };
  const valor = lerValor(campos.valor);
  if (valor === null || valor <= 0 || valor > 999999999999.99) return { ok: false, erro: "Digite o valor da fatura em reais, maior que zero.", campo: "valor" };
  const retencoes = campos.retencoes.trim() === "" ? 0 : lerValor(campos.retencoes);
  if (retencoes === null || retencoes > valor) return { ok: false, erro: "As retenções vão de zero até o valor da fatura.", campo: "retencoes" };
  const nota = campos.notaNumero.trim();
  if (nota.length > 60) return { ok: false, erro: "O número da nota pode ter até 60 letras.", campo: "notaNumero" };
  if (campos.emissao !== "" && !dataValida(campos.emissao)) return { ok: false, erro: "Escolha a data de emissão ou deixe em branco.", campo: "emissao" };
  if (campos.vencimento !== "" && !dataValida(campos.vencimento)) return { ok: false, erro: "Escolha a data de vencimento ou deixe em branco.", campo: "vencimento" };
  const observacao = campos.observacao.trim();
  if (observacao.length > 300) return { ok: false, erro: "A observação pode ter até 300 letras.", campo: "observacao" };
  return {
    ok: true,
    valor: { contratante, descricao, valor, retencoes, nota_numero: nota === "" ? null : nota, emissao: campos.emissao === "" ? null : campos.emissao, vencimento: campos.vencimento === "" ? null : campos.vencimento, observacao: observacao === "" ? null : observacao },
  };
}

export type LeituraDaParcela = { ok: true; valor: { rotulo: string | null; valor: number; vencimento: string } } | { ok: false; erro: string; campo: string };

/** A parcela como o banco confere: rótulo de até 40 letras, valor maior que zero e vencimento válido. */
export function lerParcela(campos: { rotulo: string; valor: string; vencimento: string }, lerValor: (texto: string) => number | null): LeituraDaParcela {
  const rotulo = campos.rotulo.trim();
  if (rotulo.length > 40) return { ok: false, erro: "O nome da parcela pode ter até 40 letras.", campo: "rotulo" };
  const valor = lerValor(campos.valor);
  if (valor === null || valor <= 0 || valor > 999999999999.99) return { ok: false, erro: "Digite o valor de cada parcela, maior que zero.", campo: "valor" };
  if (!dataValida(campos.vencimento)) return { ok: false, erro: "Escolha o vencimento de cada parcela.", campo: "vencimento" };
  return { ok: true, valor: { rotulo: rotulo === "" ? null : rotulo, valor, vencimento: campos.vencimento } };
}

const dia = (data: string) => data.split("-").reverse().join("/");

/** A planilha das faturas da temporada: uma linha por parcela, com o valor, as retenções, o vencimento e o recebimento. */
export function planilhaDasFaturas(campos: { temporada: string; hoje: string; faturas: readonly { fatura: FaturaDaTemporada; parcelas: readonly ParcelaDaFatura[] }[] }): string {
  const { temporada, hoje, faturas } = campos;
  const linhas: string[][] = [];
  for (const { fatura, parcelas } of faturas) {
    const conta = calcularFatura(fatura, parcelas, hoje);
    const base = [fatura.contratante, fatura.descricao, ROTULO_DA_SITUACAO_DA_FATURA[fatura.situacao], fatura.nota_numero ?? ""];
    if (parcelas.length === 0) linhas.push([...base, reaisNaPlanilha(emCentavos(fatura.valor)), reaisNaPlanilha(emCentavos(fatura.retencoes)), "", "", "", ""]);
    for (const parcela of [...parcelas].sort((a, b) => a.vencimento.localeCompare(b.vencimento))) {
      const atrasada = conta.parcelasAtrasadas.includes(parcela.id);
      linhas.push([...base, reaisNaPlanilha(emCentavos(fatura.valor)), reaisNaPlanilha(emCentavos(fatura.retencoes)), parcela.rotulo ?? "", reaisNaPlanilha(emCentavos(parcela.valor)), dia(parcela.vencimento), parcela.recebido_em ? `Recebida em ${dia(parcela.recebido_em)}` : atrasada ? "Atrasada" : "A receber"]);
    }
  }
  const totais = totaisDasFaturas(faturas, hoje);
  return montarPlanilha([
    ["Temporada", temporada],
    [],
    ["Contratante", "Descrição", "Situação", "Nota", "Valor da fatura (R$)", "Retenções (R$)", "Parcela", "Valor da parcela (R$)", "Vencimento", "Situação da parcela"],
    ...linhas,
    [],
    ["A receber (R$)", reaisNaPlanilha(totais.aReceberCentavos)],
    ["Já recebido (R$)", reaisNaPlanilha(totais.recebidoCentavos)],
    ["Atrasado (R$)", reaisNaPlanilha(totais.atrasadoCentavos)],
  ]);
}

/** O texto para o erro que o banco devolve ao gravar. */
export function mensagemDoErroDeFatura(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (mensagem.includes("fatura_quitada")) return "A fatura está quitada: nada muda.";
  if (mensagem.includes("fatura_emitida")) return "A fatura está em aberto: o valor, as retenções, o contratante, o acordo e as parcelas não mudam, e ela não se apaga. Só o vencimento e o recebimento de cada parcela.";
  if (mensagem.includes("fatura_nao_emitida")) return "Só se marca recebimento com a fatura em aberto.";
  if (mensagem.includes("fatura_nao_quitada")) return "Para quitar, todas as parcelas precisam estar recebidas.";
  if (mensagem.includes("parcelas_nao_fecham")) return "Para abrir a fatura, as parcelas precisam somar o valor líquido (valor menos retenções).";
  if (mensagem.includes("parcelas_passam_do_valor")) return "As parcelas passam do valor líquido da fatura (valor menos retenções).";
  if (mensagem.includes("fatura_situacao_invalida")) return "A situação da fatura anda um passo de cada vez.";
  if (mensagem.includes("acordo_invalido")) return "O acordo precisa ser desta temporada e a receber.";
  if (erro.code === "42501") return "Você não pode alterar as faturas (elas pedem a permissão de dinheiro).";
  if (erro.code === "23505") return "Já existe uma fatura com esse número de nota deste contratante.";
  return "Não foi possível salvar. Tente de novo.";
}
