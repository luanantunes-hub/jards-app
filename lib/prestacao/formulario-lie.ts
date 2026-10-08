// Formulário PCP/PCF 2026 da Lei de Incentivo ao Esporte (P8.2).
//
// A prestação de contas parcial (PCP, pelo SEI) e a final (PCF) levam os
// formulários da DPPIE num arquivo de 10 abas (Portaria MESP 10/2026, art. 65,
// § 1º, e art. 68, § 2º). Este módulo monta o conteúdo das abas a partir da
// prestação; a gravação sobre o modelo fica em formulario-lie-xlsx.ts.
//  * RECEITA E DESPESA: os aportes do extrato, os rendimentos por mês e o
//    executado de cada macro ação;
//  * EXECUTADO: cada item do plano, com unidade, quantidade e valores
//    programados e o valor executado;
//  * PAGAMENTOS: cada despesa paga, com o credor, o título de crédito e o cheque;
//  * RECURSOS HUMANOS: as pessoas físicas e os RPAs, por pessoa;
//  * A EXECUTAR (só na PCP): as macro ações com o valor orçado;
//  * BENS ADQUIRIDOS: os bens cadastrados.
// BENEFICIADOS, GRADE, EVENTOS e DIÁRIAS saem com o cabeçalho e o marcador,
// para preencher à mão. As ações seguem a numeração do plano de trabalho: os
// códigos do orçamento quando todos têm; senão, 1, 1.1… na atividade-fim e M1,
// M1.1… na atividade-meio (instruções das abas). As críticas comparam as abas
// entre si e com o extrato. Sem React e sem Supabase.

import { ehDespesa } from "./despesas";
import { formatarDocumento, limparDocumento } from "./fornecedores";
import { itensDaArvore, montarArvore, type LinhaOrcamento } from "./orcamento";
import type { DespesaDoEstado, EstadoDaPrestacao } from "./checagens/catalogo";
import type { PrestacaoFornecedor } from "@/lib/supabase/types";

const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const mesBr = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const valida = (d: DespesaDoEstado) => d.status !== "rejeitado" && ehDespesa(d.tipo);

export type EtapaDoFormulario = "parcial" | "final";

export const ABAS_DO_FORMULARIO = [
  "RECEITA E DESPESA", "EXECUTADO", "PAGAMENTOS", "RECURSOS HUMANOS", "BENEFICIADOS",
  "GRADE", "EVENTOS", "A EXECUTAR", "BENS ADQUIRIDOS", "DIÁRIAS",
] as const;
export type AbaDoFormulario = (typeof ABAS_DO_FORMULARIO)[number];

/** Abas que o Jards não tem como preencher: saem com o cabeçalho e o marcador. */
export const ABAS_A_MAO: readonly AbaDoFormulario[] = ["BENEFICIADOS", "GRADE", "EVENTOS", "DIÁRIAS"];

/** Primeira linha de dados de cada aba no modelo e a última linha do bloco (a que fica antes do total). */
export const BLOCOS = {
  receitaDespesa: { primeira: 7, ultima: 30 },
  executado: { primeira: 9, ultima: 31 },
  pagamentos: { primeira: 7, ultima: 32 },
  recursosHumanos: { primeira: 7, ultima: 33 },
  aExecutarFim: { primeira: 9, ultima: 23 },
  aExecutarMeio: { primeira: 28, ultima: 33 },
  bens: { primeira: 7, ultima: 32 },
} as const;

export type DivisaoDaAcao = "fim" | "meio" | "elaboracao";

export type DestinoDoFormulario =
  | { tipo: "despesa"; id: string }
  | { tipo: "orcamento" }
  | { tipo: "comprovantes" }
  | { tipo: "conciliacao" }
  | { tipo: "extrato" }
  | { tipo: "bens" }
  | { tipo: "dados" };

export type CriticaDoFormulario = {
  aba: AbaDoFormulario | null;
  linha: number | null;
  campo: string;
  mensagem: string;
  /** Corrigir: o formulário sai errado ou incompleto; aviso: conferir ou completar à mão. */
  tipo: "corrigir" | "aviso";
  destino: DestinoDoFormulario | null;
};

export type ItemDoFormulario = {
  id: string;
  codigo: string;
  nome: string;
  divisao: DivisaoDaAcao;
  unidade: string;
  /** Quantidade × ocorrências do plano; null quando o item não tem quantidade. */
  quantidade: number | null;
  /** Centavos. */
  programado: number;
  executado: number;
};

export type AcaoDoFormulario = {
  chave: string;
  codigo: string;
  nome: string;
  divisao: DivisaoDaAcao;
  programado: number;
  executado: number;
  itens: ItemDoFormulario[];
};

export type LinhaDeReceita = { descricao: string; valor: number };
export type LinhaDeDespesa = { descricao: string; valor: number };

export type LinhaDePagamento = {
  despesaId: string;
  acao: string;
  credor: string;
  documento: string;
  cheque: string;
  dataCheque: string;
  titulo: string;
  dataTitulo: string;
  valor: number;
};

export type LinhaDeRecursoHumano = { nome: string; documento: string; funcao: string; valor: number; periodo: string };

export type LinhaDeBem = { acao: string; item: string; origem: string; destinacao: string; data: string; valor: number };

export type CabecalhoDoFormulario = {
  projeto: string;
  sli: string;
  proponente: string;
  /** "dd/mm/aaaa a dd/mm/aaaa", do Termo (ou do início da execução) ao fim da vigência. */
  vigencia: string;
  captado: number;
  rendimentos: number;
};

export type FormularioLie = {
  etapa: EtapaDoFormulario;
  cabecalho: CabecalhoDoFormulario;
  receitas: LinhaDeReceita[];
  despesas: LinhaDeDespesa[];
  acoes: AcaoDoFormulario[];
  itens: ItemDoFormulario[];
  pagamentos: LinhaDePagamento[];
  recursosHumanos: LinhaDeRecursoHumano[];
  bens: LinhaDeBem[];
  /** Centavos. */
  totais: {
    receitas: number;
    despesas: number;
    saldo: number;
    pagamentos: number;
    programado: number;
    semPagamento: { quantidade: number; valor: number };
    foraDoOrcamento: { quantidade: number; valor: number };
    /** Soma do último saldo de cada conta do projeto; null sem extrato com saldo. */
    saldoDasContas: number | null;
  };
  criticas: CriticaDoFormulario[];
};

export type ContaDoFormulario = {
  id: string;
  tipo: string | null;
  extratos: readonly { periodo_fim: string | null; saldo_final: number | null; created_at?: string | null }[];
};

export type DadosDoFormularioLie = {
  estado: EstadoDaPrestacao;
  etapa: EtapaDoFormulario;
  prestacao: { titulo: string; sli: string | null; proponente: string | null };
  contas?: readonly ContaDoFormulario[];
};

/** A etapa que faz sentido hoje: final depois do fim da vigência, parcial antes. */
export function etapaSugerida(estado: Pick<EstadoDaPrestacao, "prestacao">, hoje: Date): EtapaDoFormulario {
  const fim = estado.prestacao?.data_fim_execucao;
  return fim && fim.slice(0, 10) < hoje.toISOString().slice(0, 10) ? "final" : "parcial";
}

/** Sigla e número do título de crédito, como a instrução 9 da aba PAGAMENTOS pede ("NF 0457"). */
export function tituloDeCredito(d: Pick<DespesaDoEstado, "tipo" | "numero_documento" | "serie">): string {
  const sigla: Partial<Record<string, string>> = {
    nfe: "NF", nfse: "NF", cupom: "CF", recibo: "Rec.", rpci: "Rec.", rpa: "RPA", invoice: "Invoice",
    fatura: "Fat.", folha_pagamento: "Folha", guia_tributo: "Guia", apolice: "Apólice", nota_debito: "ND",
  };
  const numero = (d.numero_documento ?? "").trim();
  return [sigla[d.tipo] ?? "", numero].filter(Boolean).join(" ");
}

const divisaoDoGrupo = (grupo: string | null): DivisaoDaAcao =>
  grupo === "administracao" ? "meio" : grupo === "elaboracao" ? "elaboracao" : "fim";

const ROTULO_ELABORACAO = "Elaboração e captação de recursos";

/** As macro ações e os itens do plano, na ordem do orçamento, com a numeração do plano de trabalho. */
function acoesDoPlano(itens: readonly LinhaOrcamento[], nomeDoNo: (id: string) => { nome: string; codigo: string | null } | null) {
  const acoes = new Map<string, AcaoDoFormulario>();
  for (const linha of itens) {
    const divisao = divisaoDoGrupo(linha.grupo);
    const pai = linha.no.parent_id ? nomeDoNo(linha.no.parent_id) : null;
    const chave = divisao === "elaboracao" ? "elaboracao" : `${divisao}:${linha.no.parent_id && pai ? linha.no.parent_id : linha.no.id}`;
    let acao = acoes.get(chave);
    if (!acao) {
      acao = {
        chave, divisao,
        codigo: divisao === "elaboracao" ? "" : (pai ? pai.codigo : linha.no.codigo)?.trim() ?? "",
        nome: divisao === "elaboracao" ? ROTULO_ELABORACAO : pai ? pai.nome : linha.no.nome,
        programado: 0, executado: 0, itens: [],
      };
      acoes.set(chave, acao);
    }
    const quantidade = linha.no.quantidade === null || linha.no.quantidade === undefined ? null
      : Number(linha.no.quantidade) * (linha.no.ocorrencias ? Number(linha.no.ocorrencias) : 1);
    const item: ItemDoFormulario = {
      id: linha.no.id,
      codigo: (linha.no.codigo ?? "").trim(),
      nome: linha.no.nome,
      divisao,
      unidade: (linha.no.unidade ?? "").trim(),
      quantidade: quantidade !== null && Number.isFinite(quantidade) ? quantidade : null,
      programado: centavos(linha.totais.vigente),
      executado: centavos(linha.totais.pago) + centavos(linha.totais.comprometido),
    };
    acao.itens.push(item);
    acao.programado += item.programado;
    acao.executado += item.executado;
  }
  const ordem: DivisaoDaAcao[] = ["fim", "meio", "elaboracao"];
  const lista = [...acoes.values()].sort((a, b) => ordem.indexOf(a.divisao) - ordem.indexOf(b.divisao));

  // Os códigos do orçamento valem quando toda ação e todo item de fim e meio têm um; senão, a numeração do plano.
  const numeradas = lista.filter(a => a.divisao !== "elaboracao");
  const proprios = numeradas.length > 0 && numeradas.every(a => a.codigo && a.itens.every(i => i.codigo));
  if (!proprios) {
    const contagem = { fim: 0, meio: 0 };
    for (const a of numeradas) {
      const div = a.divisao as "fim" | "meio";
      contagem[div] += 1;
      const prefixo = `${div === "meio" ? "M" : ""}${contagem[div]}`;
      // Item sem agrupador é a própria ação.
      const sozinho = a.itens.length === 1 && a.chave.endsWith(`:${a.itens[0].id}`);
      a.codigo = prefixo;
      a.itens.forEach((i, j) => { i.codigo = sozinho ? prefixo : `${prefixo}.${j + 1}`; });
    }
  }
  for (const a of lista.filter(x => x.divisao === "elaboracao")) a.itens.forEach(i => { i.codigo = ""; });
  return { acoes: lista, proprios };
}

export function formularioLie(dados: DadosDoFormularioLie): FormularioLie {
  const { estado, etapa } = dados;
  const criticas: CriticaDoFormulario[] = [];
  const aviso = (aba: AbaDoFormulario | null, campo: string, mensagem: string, destino: DestinoDoFormulario | null = null, linha: number | null = null) =>
    criticas.push({ aba, linha, campo, mensagem, tipo: "aviso", destino });
  const corrigir = (aba: AbaDoFormulario | null, campo: string, mensagem: string, destino: DestinoDoFormulario | null = null, linha: number | null = null) =>
    criticas.push({ aba, linha, campo, mensagem, tipo: "corrigir", destino });

  // ─── Cabeçalho ───
  const datas = estado.prestacao ?? {};
  const inicio = datas.data_termo ?? datas.data_inicio_execucao ?? null;
  const fim = datas.data_fim_execucao ?? null;
  const aportes = estado.lancamentos.filter(l => l.natureza === "credito" && l.categoria === "aporte").sort((a, b) => a.data.localeCompare(b.data));
  const rendimentos = estado.lancamentos.filter(l => l.natureza === "credito" && l.categoria === "rendimento");
  const cabecalho: CabecalhoDoFormulario = {
    projeto: dados.prestacao.titulo.trim(),
    sli: (dados.prestacao.sli ?? "").trim(),
    proponente: (dados.prestacao.proponente ?? "").trim(),
    vigencia: inicio || fim ? `${dataBr(inicio) || "—"} a ${dataBr(fim) || "—"}` : "",
    captado: aportes.reduce((s, l) => s + centavos(l.valor), 0),
    rendimentos: rendimentos.reduce((s, l) => s + centavos(l.valor), 0),
  };
  if (!cabecalho.sli) corrigir(null, "Nº SLI", "Informe o número do projeto no SLI nos dados oficiais da prestação: ele vai no cabeçalho das abas.", { tipo: "dados" });
  if (!cabecalho.proponente) corrigir(null, "Proponente", "A prestação não tem proponente: o cabeçalho das abas sai sem o nome.", { tipo: "dados" });
  if (!inicio || !fim) aviso("EXECUTADO", "Período de vigência", "Informe a data do Termo e o fim da vigência nos dados da prestação: o período sai incompleto.", { tipo: "dados" });
  aviso(null, "Nº do processo", "O número do processo no SEI não fica na prestação: preencha nas abas EXECUTADO, GRADE, EVENTOS e A EXECUTAR.");

  // ─── Plano e execução ───
  const despesas = estado.despesas.filter(valida);
  const nos = estado.nos ?? [];
  const nosPorId = new Map(nos.map(n => [n.id, n]));
  const arvore = montarArvore(nos, despesas.map(d => ({ id: d.id, no_id: d.no_id, status: d.status, valor_extraido: d.valor_extraido, valor_liquido: d.valor_liquido })), estado.pagamentos);
  const { acoes, proprios } = acoesDoPlano(itensDaArvore(arvore.raizes), id => {
    const no = nosPorId.get(id);
    return no ? { nome: no.nome, codigo: no.codigo } : null;
  });
  const itens = acoes.flatMap(a => a.itens);
  const codigoDoItem = new Map(itens.map(i => [i.id, i.codigo]));
  if (!itens.length) corrigir("EXECUTADO", "Ações", "O orçamento em uso não tem itens: EXECUTADO, RECEITA E DESPESA e A EXECUTAR saem sem ações.", { tipo: "orcamento" });
  if (proprios) {
    const semM = acoes.filter(a => a.divisao === "meio" && !/^M/i.test(a.codigo));
    if (semM.length) aviso("EXECUTADO", "Ação", `Na atividade-meio, as ações levam o prefixo M (instruções do formulário): ${semM.map(a => a.codigo).join(", ")} no orçamento.`, { tipo: "orcamento" });
  }
  const fora = despesas.filter(d => !d.no_id || !codigoDoItem.has(d.no_id));
  const foraDoOrcamento = { quantidade: fora.length, valor: fora.reduce((s, d) => s + centavos(d.valor_extraido), 0) };
  if (fora.length) {
    corrigir("RECEITA E DESPESA", "Despesa", `${fora.length === 1 ? "1 despesa sem item" : `${fora.length} despesas sem item`} do orçamento em uso (${reais(foraDoOrcamento.valor)}) não ${fora.length === 1 ? "entra" : "entram"} em nenhuma ação.`, { tipo: "comprovantes" });
  }

  // ─── RECEITA E DESPESA ───
  const receitas: LinhaDeReceita[] = aportes.map(l => ({ descricao: `${l.historico.replace(/\s+/g, " ").trim() || "Aporte"} (${dataBr(l.data)})`, valor: centavos(l.valor) }));
  const porMes = new Map<string, number>();
  for (const l of [...rendimentos].sort((a, b) => a.data.localeCompare(b.data))) porMes.set(l.data.slice(0, 7), (porMes.get(l.data.slice(0, 7)) ?? 0) + centavos(l.valor));
  for (const [mes, valor] of porMes) receitas.push({ descricao: `Rendimento de aplicação financeira – ${mesBr(`${mes}-01`)}`, valor });
  if (aportes.length) aviso("RECEITA E DESPESA", "Receita", "As receitas usam o histórico de cada aporte no extrato: confira se aparece o nome do incentivador.", { tipo: "extrato" });
  else corrigir("RECEITA E DESPESA", "Receita", "Nenhum aporte no extrato: a receita sai vazia. Importe o extrato da conta de captação.", { tipo: "extrato" });

  const despesasDoForm: LinhaDeDespesa[] = acoes.filter(a => a.executado > 0)
    .map(a => ({ descricao: [a.codigo, a.nome].filter(Boolean).join(" – "), valor: a.executado }));
  if (foraDoOrcamento.valor > 0) despesasDoForm.push({ descricao: "Despesas sem item do orçamento", valor: foraDoOrcamento.valor });
  const totalReceitas = receitas.reduce((s, r) => s + r.valor, 0);
  const totalDespesas = despesasDoForm.reduce((s, d) => s + d.valor, 0);
  const saldo = totalReceitas - totalDespesas;

  // ─── PAGAMENTOS ───
  const fornecedores = new Map(estado.fornecedores.map(f => [f.id, f]));
  const pagamentosPorDespesa = new Map<string, typeof estado.pagamentos[number][]>();
  for (const p of estado.pagamentos) pagamentosPorDespesa.set(p.despesa_id, [...(pagamentosPorDespesa.get(p.despesa_id) ?? []), p]);
  const pagas = despesas.filter(d => (pagamentosPorDespesa.get(d.id) ?? []).length > 0);
  const primeiraData = (d: DespesaDoEstado) => (pagamentosPorDespesa.get(d.id) ?? []).map(p => p.data).sort()[0] ?? "";
  pagas.sort((a, b) => primeiraData(a).localeCompare(primeiraData(b)) || (a.data_doc ?? "").localeCompare(b.data_doc ?? ""));
  const pagamentos: LinhaDePagamento[] = pagas.map((d, i) => {
    const linha = BLOCOS.pagamentos.primeira + i;
    const f = d.fornecedor_id ? fornecedores.get(d.fornecedor_id) : undefined;
    const cheques = (pagamentosPorDespesa.get(d.id) ?? []).filter(p => p.forma === "cheque").sort((a, b) => a.data.localeCompare(b.data));
    const destino = { tipo: "despesa", id: d.id } as const;
    const credor = f ? (f.razao_social?.trim() || f.nome?.trim() || "") : "";
    const documento = f ? formatarDocumento(f.documento) : "";
    if (!credor) corrigir("PAGAMENTOS", "Credor", `${d.nome_arquivo}: despesa sem fornecedor, o credor fica vazio.`, destino, linha);
    else if (!limparDocumento(f?.documento)) corrigir("PAGAMENTOS", "C.N.P.J./C.P.F.", `${credor}: fornecedor sem CPF ou CNPJ.`, destino, linha);
    if (!(d.numero_documento ?? "").trim()) corrigir("PAGAMENTOS", "Tít. crédito", `${credor || d.nome_arquivo}: o título de crédito sai sem número.`, destino, linha);
    if (!d.data_doc) corrigir("PAGAMENTOS", "Data", `${credor || d.nome_arquivo}: o título de crédito sai sem data de emissão.`, destino, linha);
    if (cheques.some(c => !(c.numero_documento ?? "").trim())) corrigir("PAGAMENTOS", "Cheque", `${credor || d.nome_arquivo}: pagamento em cheque sem o número.`, destino, linha);
    return {
      despesaId: d.id,
      acao: (d.no_id && codigoDoItem.get(d.no_id)) || "",
      credor,
      documento,
      cheque: cheques.map(c => (c.numero_documento ?? "").trim()).filter(Boolean).join(", "),
      dataCheque: cheques.length ? dataBr(cheques[0].data) : "",
      titulo: tituloDeCredito(d),
      dataTitulo: dataBr(d.data_doc),
      valor: centavos(d.valor_extraido),
    };
  });
  const totalPagamentos = pagamentos.reduce((s, p) => s + p.valor, 0);
  const semPagamento = despesas.filter(d => !(pagamentosPorDespesa.get(d.id) ?? []).length);
  const semPagamentoResumo = { quantidade: semPagamento.length, valor: semPagamento.reduce((s, d) => s + centavos(d.valor_extraido), 0) };
  if (semPagamento.length) {
    aviso("PAGAMENTOS", "Pagamentos", `${semPagamento.length === 1 ? "1 despesa sem pagamento registrado" : `${semPagamento.length} despesas sem pagamento registrado`} (${reais(semPagamentoResumo.valor)}) ${semPagamento.length === 1 ? "fica" : "ficam"} fora da relação: o total dos pagamentos (${reais(totalPagamentos)}) não bate com o das despesas (${reais(totalDespesas)}).`, { tipo: "conciliacao" });
  }

  // ─── RECURSOS HUMANOS ───
  const pessoas = new Map<string, { f: PrestacaoFornecedor; despesas: DespesaDoEstado[] }>();
  let rhSemFornecedor = 0;
  for (const d of despesas) {
    const f = d.fornecedor_id ? fornecedores.get(d.fornecedor_id) : undefined;
    const ehPessoa = d.tipo === "rpa" || d.tipo === "folha_pagamento" || f?.tipo_pessoa === "pf";
    if (!ehPessoa) continue;
    if (!f) { rhSemFornecedor += 1; continue; }
    const atual = pessoas.get(f.id) ?? { f, despesas: [] };
    atual.despesas.push(d);
    pessoas.set(f.id, atual);
  }
  const nomeDoItem = (noId: string | null) => (noId && nosPorId.get(noId)?.nome) || "";
  const recursosHumanos: LinhaDeRecursoHumano[] = [...pessoas.values()].map(({ f, despesas: ds }) => {
    const meses = ds.map(d => d.data_doc).filter((x): x is string => Boolean(x)).sort();
    const periodo = meses.length ? (mesBr(meses[0]) === mesBr(meses[meses.length - 1]) ? mesBr(meses[0]) : `${mesBr(meses[0])} a ${mesBr(meses[meses.length - 1])}`) : "";
    return {
      nome: f.nome?.trim() || f.razao_social?.trim() || "",
      documento: f.tipo_pessoa === "pf" ? "" : formatarDocumento(f.documento),
      funcao: [...new Set(ds.map(d => nomeDoItem(d.no_id)).filter(Boolean))].join("; "),
      valor: ds.reduce((s, d) => s + centavos(d.valor_extraido), 0),
      periodo,
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (recursosHumanos.length) aviso("RECURSOS HUMANOS", "RG, telefone, carga horária e encargos", "A relação traz nome, função, valor pago e período de cada pessoa física ou RPA; RG, telefone, carga horária e encargos ficam para preencher.");
  if (rhSemFornecedor) aviso("RECURSOS HUMANOS", "Nome", `${rhSemFornecedor === 1 ? "1 folha ou RPA sem fornecedor fica" : `${rhSemFornecedor} folhas ou RPAs sem fornecedor ficam`} fora da relação.`, { tipo: "comprovantes" });

  // ─── BENS ADQUIRIDOS ───
  const despesasPorId = new Map(estado.despesas.map(d => [d.id, d]));
  const DESTINO: Record<string, string> = { doacao: "Doação", proponente: "Permanece com o proponente", outra: "Outra destinação" };
  const bens: LinhaDeBem[] = (estado.bens ?? []).map((b, i) => {
    const d = b.despesa_id ? despesasPorId.get(b.despesa_id) : undefined;
    const noId = b.no_id ?? d?.no_id ?? null;
    if (!b.destinacao) aviso("BENS ADQUIRIDOS", "Destinação", `${b.descricao}: sem destinação definida.`, { tipo: "bens" }, BLOCOS.bens.primeira + i);
    const quantidade = Number(b.quantidade ?? 1);
    return {
      acao: (noId && codigoDoItem.get(noId)) || "",
      item: quantidade > 1 ? `${quantidade} × ${b.descricao}` : b.descricao,
      origem: "Adquirido",
      destinacao: b.destinacao ? `${DESTINO[b.destinacao] ?? ""}${b.destinacao === "doacao" && b.beneficiario ? ` a ${b.beneficiario}` : ""}` : "",
      data: dataBr(d?.data_doc),
      valor: b.valor !== null && b.valor !== undefined ? centavos(b.valor) : centavos(d?.valor_extraido),
    };
  });
  if (bens.length) aviso("BENS ADQUIRIDOS", "Localização", "A localização de cada bem fica para preencher.");

  // ─── A EXECUTAR e abas à mão ───
  if (etapa === "parcial") {
    const saldoAExecutar = acoes.reduce((s, a) => s + Math.max(a.programado - a.executado, 0), 0);
    aviso("A EXECUTAR", "Meses", `Distribua pelos meses que faltam o que resta a executar de cada ação (${reais(saldoAExecutar)} no total): a coluna do total soma os meses.`);
  }
  aviso("EXECUTADO", "Quantidade executada", "A quantidade executada de cada ação fica para preencher; a programada vem do orçamento (quantidade × ocorrências).");
  aviso(null, "Abas para preencher", `${ABAS_A_MAO.join(", ")} saem com o cabeçalho e o marcador ${etapa === "parcial" ? "PARCIAL" : "FINAL"}; os dados delas ficam para preencher.`);

  // ─── Saldo × extrato ───
  const ultimos = (dados.contas ?? [])
    .filter(c => c.tipo === "captacao" || c.tipo === "movimento" || c.tipo === "unica" || c.tipo === null)
    .map(c => [...c.extratos].filter(e => e.saldo_final !== null && e.saldo_final !== undefined)
      .sort((a, b) => (a.periodo_fim ?? "").localeCompare(b.periodo_fim ?? "") || (a.created_at ?? "").localeCompare(b.created_at ?? "")).pop())
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const saldoDasContas = ultimos.length ? ultimos.reduce((s, e) => s + centavos(e.saldo_final), 0) : null;
  if (saldoDasContas !== null && saldoDasContas !== saldo) {
    aviso("RECEITA E DESPESA", "Saldo", `O saldo do formulário (${reais(saldo)}) difere do saldo das contas no último extrato (${reais(saldoDasContas)}) em ${reais(Math.abs(saldo - saldoDasContas))}: tarifas, despesas ainda não pagas ou lançamentos sem despesa explicam a diferença.`, { tipo: "conciliacao" });
  }
  if (etapa === "final" && saldo > 0) {
    aviso("RECEITA E DESPESA", "Saldo", `Na PCF, o saldo de ${reais(saldo)} é recolhido por GRU (instrução 10 da aba).`);
  }

  return {
    etapa,
    cabecalho,
    receitas,
    despesas: despesasDoForm,
    acoes,
    itens,
    pagamentos,
    recursosHumanos,
    bens,
    totais: {
      receitas: totalReceitas,
      despesas: totalDespesas,
      saldo,
      pagamentos: totalPagamentos,
      programado: acoes.reduce((s, a) => s + a.programado, 0),
      semPagamento: semPagamentoResumo,
      foraDoOrcamento,
      saldoDasContas,
    },
    criticas,
  };
}

/** Nome do arquivo: Formulario_PCP_<SLI ou título>.xlsx. */
export function nomeDoFormulario(f: Pick<FormularioLie, "etapa" | "cabecalho">): string {
  const base = (f.cabecalho.sli || f.cabecalho.projeto || "projeto").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `Formulario_${f.etapa === "parcial" ? "PCP" : "PCF"}_${base}.xlsx`;
}
