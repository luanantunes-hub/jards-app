// O orçamento vivo da temporada (plano do módulo, PD5.1, primeiro corte): o que se espera gastar em três versões (estimativa, aprovado, revisado), o que já
// está comprometido e pago, o custo final previsto e a variação. Sem tela e sem banco; tudo em centavos inteiros.
//
// Primeiro corte: o comprometido e o pago são digitados na linha. Com os acordos (PD4.5) e os lançamentos (PD5.3) passam a ser somados de lá.

import { emCentavos, formatarReais } from "@/lib/producao/bordero";
import { montarPlanilha, reaisNaPlanilha } from "@/lib/producao/planilha";
import { CATEGORIAS_DO_ORCAMENTO, type CategoriaDoOrcamento, type SituacaoDoOrcamento } from "@/lib/producao/estados";

export const ROTULO_DA_CATEGORIA_DO_ORCAMENTO: Record<CategoriaDoOrcamento, string> = {
  cache: "Cachê", comissao: "Comissão", hospedagem: "Hospedagem", alimentacao: "Alimentação", passagem: "Passagem", transporte: "Transporte",
  combustivel: "Combustível", frete: "Frete", som_e_luz: "Som e luz", cenografia: "Cenografia", figurino: "Figurino", direitos: "Direitos",
  imposto: "Imposto", seguro: "Seguro", divulgacao: "Divulgação", taxa_da_casa: "Taxa da casa", acessibilidade: "Acessibilidade", outros: "Outros",
};
export const ROTULO_DA_SITUACAO_DO_ORCAMENTO: Record<SituacaoDoOrcamento, string> = { rascunho: "Rascunho", aprovado: "Aprovado", encerrado: "Encerrado" };

export type LinhaDoOrcamento = {
  id: string; categoria: CategoriaDoOrcamento; descricao: string;
  estimativa: number | null; aprovado: number | null; revisado: number | null; comprometido: number; pago: number; ordem: number;
  /** A conta da estimativa, com os nomes das variáveis do orçamento (PD5.2). */
  formula?: string | null;
  /** O acordo pelo qual a linha se cumpre (PD4.5): se estiver assinado e a pagar, o comprometido vem dele. */
  acordo_id?: string | null;
};

const emCentavosOuNulo = (reais: number | null) => (reais === null ? null : emCentavos(reais));

export type ContaDaLinha = {
  id: string; categoria: CategoriaDoOrcamento; descricao: string;
  estimativaCentavos: number | null; aprovadoCentavos: number | null; revisadoCentavos: number | null;
  /** O custo final previsto: o revisado, senão o aprovado, senão a estimativa (zero se nenhum). */
  previstoCentavos: number;
  comprometidoCentavos: number; pagoCentavos: number;
  /** O comprometido veio de um acordo assinado, não do que foi digitado na linha. */
  viaAcordo: boolean;
  /** O pago veio dos lançamentos, não do que foi digitado na linha. */
  pagoViaLancamentos: boolean;
  /** O previsto menos o aprovado; nulo quando a linha não tem valor aprovado. */
  variacaoCentavos: number | null;
  /** O que está comprometido e ainda não foi pago. */
  aPagarCentavos: number;
  /** O que ainda não foi comprometido do previsto (zero quando já passou). */
  aComprometerCentavos: number;
  avisos: string[];
};

export type ContaDaCategoria = { categoria: CategoriaDoOrcamento; linhas: number; previstoCentavos: number; comprometidoCentavos: number; pagoCentavos: number };

export type ContasDoOrcamento = {
  linhas: ContaDaLinha[];
  porCategoria: ContaDaCategoria[];
  estimativaCentavos: number; aprovadoCentavos: number; revisadoCentavos: number;
  previstoCentavos: number; comprometidoCentavos: number; pagoCentavos: number;
  /** O previsto total menos o aprovado total. Com orçamento ainda sem aprovado, é o previsto inteiro: a tela só mostra depois de aprovar. */
  variacaoCentavos: number; aPagarCentavos: number;
  avisos: string[];
};

/**
 * As contas do orçamento. `pagoDosLancamentos` diz, por linha, o pago em centavos que vem dos lançamentos (a soma da divisão; vale no lugar do digitado). `comprometidoDosAcordos` diz, por linha, o comprometido em centavos que vem de um acordo assinado (vale no lugar do digitado). O custo final previsto de cada linha é o revisado, senão o aprovado, senão a estimativa. A variação é o previsto menos o aprovado.
 * Avisa quando o pago passa do comprometido e quando o comprometido passa do previsto (o app avisa, não impede: a pessoa decide).
 */
export function calcularOrcamento(linhas: readonly LinhaDoOrcamento[], comprometidoDosAcordos: Readonly<Record<string, number>> = {}, pagoDosLancamentos: Readonly<Record<string, number>> = {}): ContasDoOrcamento {
  const contas: ContaDaLinha[] = [...linhas]
    .sort((a, b) => CATEGORIAS_DO_ORCAMENTO.indexOf(a.categoria) - CATEGORIAS_DO_ORCAMENTO.indexOf(b.categoria) || a.ordem - b.ordem || a.descricao.localeCompare(b.descricao, "pt-BR"))
    .map(linha => {
      const estimativa = emCentavosOuNulo(linha.estimativa);
      const aprovado = emCentavosOuNulo(linha.aprovado);
      const revisado = emCentavosOuNulo(linha.revisado);
      const previsto = revisado ?? aprovado ?? estimativa ?? 0;
      const viaAcordo = Object.hasOwn(comprometidoDosAcordos, linha.id);
      const comprometido = viaAcordo ? comprometidoDosAcordos[linha.id] : emCentavos(linha.comprometido);
      const pagoViaLancamentos = Object.hasOwn(pagoDosLancamentos, linha.id);
      const pago = pagoViaLancamentos ? pagoDosLancamentos[linha.id] : emCentavos(linha.pago);
      const avisos: string[] = [];
      if (pago > comprometido) avisos.push(`Pago (${formatarReais(pago)}) passa do comprometido (${formatarReais(comprometido)}).`);
      if (comprometido > previsto) avisos.push(`Comprometido passa do previsto em ${formatarReais(comprometido - previsto)}.`);
      return {
        id: linha.id, categoria: linha.categoria, descricao: linha.descricao,
        estimativaCentavos: estimativa, aprovadoCentavos: aprovado, revisadoCentavos: revisado, previstoCentavos: previsto,
        comprometidoCentavos: comprometido, pagoCentavos: pago, viaAcordo, pagoViaLancamentos,
        variacaoCentavos: aprovado === null ? null : previsto - aprovado,
        aPagarCentavos: Math.max(0, comprometido - pago), aComprometerCentavos: Math.max(0, previsto - comprometido), avisos,
      };
    });
  const soma = (pegar: (conta: ContaDaLinha) => number) => contas.reduce((total, conta) => total + pegar(conta), 0);
  const porCategoria = CATEGORIAS_DO_ORCAMENTO
    .map(categoria => {
      const daCategoria = contas.filter(conta => conta.categoria === categoria);
      return {
        categoria, linhas: daCategoria.length,
        previstoCentavos: daCategoria.reduce((total, conta) => total + conta.previstoCentavos, 0),
        comprometidoCentavos: daCategoria.reduce((total, conta) => total + conta.comprometidoCentavos, 0),
        pagoCentavos: daCategoria.reduce((total, conta) => total + conta.pagoCentavos, 0),
      };
    })
    .filter(item => item.linhas > 0);
  const previsto = soma(conta => conta.previstoCentavos);
  const aprovado = soma(conta => conta.aprovadoCentavos ?? 0);
  const comprometido = soma(conta => conta.comprometidoCentavos);
  const pago = soma(conta => conta.pagoCentavos);
  const avisos: string[] = [];
  if (comprometido > previsto && contas.length > 0) avisos.push(`O comprometido passa do previsto em ${formatarReais(comprometido - previsto)}.`);
  return {
    linhas: contas, porCategoria,
    estimativaCentavos: soma(conta => conta.estimativaCentavos ?? 0), aprovadoCentavos: aprovado, revisadoCentavos: soma(conta => conta.revisadoCentavos ?? 0),
    previstoCentavos: previsto, comprometidoCentavos: comprometido, pagoCentavos: pago,
    variacaoCentavos: previsto - aprovado, aPagarCentavos: soma(conta => conta.aPagarCentavos), avisos,
  };
}

export type ColunaDoCenario = { id: string; nome: string; porCategoria: Partial<Record<CategoriaDoOrcamento, number>>; previstoCentavos: number; diferencaCentavos: number | null };

/**
 * Os cenários (orçamentos da mesma temporada) lado a lado: o custo final previsto de cada um por categoria e no total, e a diferença de cada cenário
 * para o primeiro (a base da comparação). Só entram as categorias que algum cenário usa.
 */
export function compararCenarios(cenarios: readonly { id: string; nome: string; linhas: readonly LinhaDoOrcamento[] }[]): { categorias: CategoriaDoOrcamento[]; colunas: ColunaDoCenario[] } {
  const calculados = cenarios.map(cenario => ({ cenario, contas: calcularOrcamento(cenario.linhas) }));
  const categorias = CATEGORIAS_DO_ORCAMENTO.filter(categoria => calculados.some(item => item.contas.porCategoria.some(parte => parte.categoria === categoria)));
  const base = calculados[0]?.contas.previstoCentavos ?? 0;
  const colunas = calculados.map(({ cenario, contas }, indice) => ({
    id: cenario.id, nome: cenario.nome,
    porCategoria: Object.fromEntries(contas.porCategoria.map(parte => [parte.categoria, parte.previstoCentavos])) as Partial<Record<CategoriaDoOrcamento, number>>,
    previstoCentavos: contas.previstoCentavos,
    diferencaCentavos: indice === 0 ? null : contas.previstoCentavos - base,
  }));
  return { categorias, colunas };
}

export type LeituraDaLinha =
  | { ok: true; valor: { categoria: CategoriaDoOrcamento; descricao: string; estimativa: number | null; aprovado: number | null; revisado: number | null; comprometido: number; pago: number; ordem: number } }
  | { ok: false; erro: string; campo: string };

const LIMITE = 999999999999.99;

/**
 * A linha como o banco confere: descrição de 1 a 120 letras, valores de 0 a 999.999.999.999,99 (estimativa, aprovado e revisado podem ficar em branco;
 * comprometido e pago em branco valem zero) e ordem de 0 a 999. `lerValor` é a leitura de reais da tela (lerValorEmReais).
 */
export function lerLinhaDoOrcamento(
  campos: { categoria: CategoriaDoOrcamento; descricao: string; estimativa: string; aprovado: string; revisado: string; comprometido: string; pago: string; ordem: string },
  lerValor: (texto: string) => number | null,
): LeituraDaLinha {
  const descricao = campos.descricao.trim();
  if (descricao === "") return { ok: false, erro: "Escreva o que é este gasto (por exemplo, cachê do elenco).", campo: "descricao" };
  if (descricao.length > 120) return { ok: false, erro: "A descrição pode ter até 120 letras.", campo: "descricao" };
  const opcional = (texto: string): { ok: true; valor: number | null } | { ok: false } => {
    if (texto.trim() === "") return { ok: true, valor: null };
    const valor = lerValor(texto);
    return valor === null || valor > LIMITE ? { ok: false } : { ok: true, valor };
  };
  const lidos = {
    estimativa: opcional(campos.estimativa), aprovado: opcional(campos.aprovado), revisado: opcional(campos.revisado),
    comprometido: opcional(campos.comprometido), pago: opcional(campos.pago),
  };
  for (const [campo, lido] of Object.entries(lidos)) {
    if (!lido.ok) return { ok: false, erro: "Digite o valor em reais, por exemplo 2.000 ou 350,50.", campo };
  }
  const ordem = campos.ordem.trim() === "" ? 0 : /^\d+$/.test(campos.ordem.trim()) ? Number(campos.ordem.trim()) : Number.NaN;
  if (!Number.isInteger(ordem) || ordem > 999) return { ok: false, erro: "A ordem é um número de 0 a 999.", campo: "ordem" };
  const numero = (lido: { ok: true; valor: number | null } | { ok: false }) => (lido.ok ? lido.valor : null);
  return {
    ok: true,
    valor: {
      categoria: campos.categoria, descricao, estimativa: numero(lidos.estimativa), aprovado: numero(lidos.aprovado), revisado: numero(lidos.revisado),
      comprometido: numero(lidos.comprometido) ?? 0, pago: numero(lidos.pago) ?? 0, ordem,
    },
  };
}

/** O texto do orçamento para colar num e-mail. */
export function textoDoOrcamento(campos: { temporada: string; nome: string; situacao: SituacaoDoOrcamento; contas: ContasDoOrcamento }): string {
  const { temporada, nome, situacao, contas } = campos;
  const linhas = [`Orçamento: ${nome} (${ROTULO_DA_SITUACAO_DO_ORCAMENTO[situacao].toLowerCase()}) — ${temporada}`];
  contas.porCategoria.forEach(item => linhas.push(`  ${ROTULO_DA_CATEGORIA_DO_ORCAMENTO[item.categoria]}: previsto ${formatarReais(item.previstoCentavos)} · comprometido ${formatarReais(item.comprometidoCentavos)} · pago ${formatarReais(item.pagoCentavos)}`));
  linhas.push(`Custo final previsto: ${formatarReais(contas.previstoCentavos)}`);
  if (situacao !== "rascunho") linhas.push(`Aprovado: ${formatarReais(contas.aprovadoCentavos)} · variação: ${contas.variacaoCentavos < 0 ? "−" : contas.variacaoCentavos > 0 ? "+" : ""}${formatarReais(Math.abs(contas.variacaoCentavos))}`);
  linhas.push(`Comprometido: ${formatarReais(contas.comprometidoCentavos)} · pago: ${formatarReais(contas.pagoCentavos)} · a pagar: ${formatarReais(contas.aPagarCentavos)}`);
  contas.avisos.forEach(aviso => linhas.push(`Atenção: ${aviso}`));
  return linhas.join("\n");
}

/** A planilha do orçamento: uma linha por gasto, com as três versões, o previsto, a variação, o comprometido, o pago e o que falta pagar. */
export function planilhaDoOrcamento(campos: { temporada: string; nome: string; situacao: SituacaoDoOrcamento; contas: ContasDoOrcamento }): string {
  const { temporada, nome, situacao, contas } = campos;
  const reais = (centavos: number | null) => (centavos === null ? "" : reaisNaPlanilha(centavos));
  return montarPlanilha([
    ["Temporada", temporada],
    ["Orçamento", nome, ROTULO_DA_SITUACAO_DO_ORCAMENTO[situacao]],
    [],
    ["Categoria", "Descrição", "Estimativa (R$)", "Aprovado (R$)", "Revisado (R$)", "Custo final previsto (R$)", "Variação (R$)", "Comprometido (R$)", "Pago (R$)", "A pagar (R$)"],
    ...contas.linhas.map(linha => [
      ROTULO_DA_CATEGORIA_DO_ORCAMENTO[linha.categoria], linha.descricao, reais(linha.estimativaCentavos), reais(linha.aprovadoCentavos), reais(linha.revisadoCentavos),
      reais(linha.previstoCentavos), reais(linha.variacaoCentavos), reais(linha.comprometidoCentavos), reais(linha.pagoCentavos), reais(linha.aPagarCentavos),
    ]),
    ["Total", "", reais(contas.estimativaCentavos), reais(contas.aprovadoCentavos), reais(contas.revisadoCentavos), reais(contas.previstoCentavos), reais(contas.variacaoCentavos),
      reais(contas.comprometidoCentavos), reais(contas.pagoCentavos), reais(contas.aPagarCentavos)],
  ]);
}

/** O texto para o erro que o banco devolve ao gravar. */
export function mensagemDoErroDeOrcamento(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (mensagem.includes("orcamento_encerrado")) return "O orçamento está encerrado: nada muda.";
  if (mensagem.includes("orcamento_aprovado")) return "O orçamento está aprovado: a estimativa, o aprovado e a categoria não mudam, e uma linha com valor aprovado não se apaga. Use o revisado.";
  if (mensagem.includes("orcamento_nao_volta")) return "O orçamento aprovado não volta para rascunho.";
  if (erro.code === "23503") return "Esta linha já recebeu pagamento (lançamento): apague ou mude o lançamento antes de apagá-la.";
  if (erro.code === "42501") return "Você não pode alterar o orçamento (os valores pedem a permissão de dinheiro).";
  if (erro.code === "23505" && mensagem.includes("variaveis")) return "Já existe uma variável com esse nome neste orçamento.";
  if (mensagem.includes("orcamento_aprovado") === false && mensagem.includes("variaveis_nome_check")) return "O nome da variável usa letras minúsculas sem acento, números e sublinhado (por exemplo, dias_de_estrada), e não pode ser min, max, round, ceil nem floor.";
  if (erro.code === "23505" && mensagem.includes("descricao")) return "Já existe uma linha com essa categoria e descrição neste orçamento.";
  if (erro.code === "23505") return "Já existe um orçamento com esse nome nesta temporada.";
  return "Não foi possível salvar. Tente de novo.";
}
