// Transferegov (P9.4): a parceria do Pronon e do Pronas/PCD, as contas no
// Banco do Brasil e as linhas do extrato, pela API pública de Gestão de
// Parcerias (sem chave; atualizada uma vez por dia). A busca é pelo NUP da
// prestação, que a API guarda sem pontuação em `cd_processo_sei`; o caminho é
// parceria → contas (`/parceria-conta`) → extrato (`/extrato-bancario`).
//
// O que a API traz de diferente de um extrato do banco:
//  * cada linha tem um identificador próprio (`id_extrato_bancario`), que vira
//    a chave do lançamento: importar de novo não duplica nada;
//  * créditos da Conta Captação trazem o CNPJ e o nome de quem depositou, e
//    a conta traz a classificação de cada ingresso feita no Transferegov
//    (doação aprovada, aguardando análise, não classificada, indevida);
//  * a aplicação e o resgate automáticos aparecem como linhas; os rendimentos
//    ficam na aplicação e só o saldo dela vem na conta;
//  * documentos vêm como número ("53096781000126.0", "606549000124"), sem os
//    zeros à esquerda.
// Sem React e sem Supabase.

import { classificarLancamento, semAcento, type CategoriaLancamento, type LancamentoLido, type NaturezaLancamento } from "./extrato";
import { cnpjValido, cpfValido } from "@/supabase/functions/_shared/fornecedor-publico";

export const URL_DA_API_DE_PARCERIAS = "https://api-publica.transferegov.gestao.gov.br/parcerias";
/** Página da parceria no Transferegov, para quem tem acesso. */
export const URL_DO_TRANSFEREGOV = "https://transferegov.sistema.gov.br/";

type Registro = Record<string, unknown>;

const texto = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).replace(/\s+/g, " ").trim();
  return t ? t : null;
};
const data = (v: unknown): string | null => {
  const t = texto(v);
  return t && /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null;
};
const centavos = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100));

// ─── Identificadores ────────────────────────────────────────────────────────

/** O NUP como a API guarda: os 17 algarismos ("25000.161983/2024-66" → "25000161983202466"). */
export function processoDoNup(identificador: string | null | undefined): string | null {
  const d = (identificador ?? "").replace(/\D/g, "");
  return d.length === 17 ? d : null;
}

/** "25000161983202466" → "25000.161983/2024-66". */
export function nupFormatado(processo: string | null | undefined): string | null {
  const d = (processo ?? "").replace(/\D/g, "");
  return d.length === 17 ? `${d.slice(0, 5)}.${d.slice(5, 11)}/${d.slice(11, 15)}-${d.slice(15)}` : null;
}

/** 202400000270 → "2024-00000270", como o Transferegov escreve o número da parceria. */
export function codigoDaParceria(cd: unknown): string | null {
  const d = String(cd ?? "").replace(/\D/g, "");
  return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4).padStart(8, "0")}` : null;
}

/**
 * O CPF ou CNPJ que a API manda como número: sem o ".0" e com os zeros à
 * esquerda de volta. CPF mascarado pelo banco ("***40317***") fica como veio;
 * "Não informado pelo banco" e zero viram null.
 */
export function documentoDaApi(valor: unknown): string | null {
  const t = texto(valor);
  if (!t) return null;
  if (t.includes("*")) return t;
  const d = t.replace(/\.0+$/, "").replace(/\D/g, "");
  if (!d || /^0+$/.test(d)) return null;
  if (d.length > 11) return d.padStart(14, "0");
  // Com até 11 algarismos pode ser CPF ou CNPJ que perdeu os zeros ("191" é o Banco do Brasil).
  const cpf = d.padStart(11, "0");
  const cnpj = d.padStart(14, "0");
  if (cpfValido(cpf) && !cnpjValido(cnpj)) return cpf;
  if (cnpjValido(cnpj)) return cnpj;
  return cpf;
}

// ─── Parceria ───────────────────────────────────────────────────────────────

export type ParceriaNoTransferegov = {
  id: number;
  /** "2024-00000270". */
  codigo: string | null;
  situacao: string | null;
  processo: string | null;
  assinatura: string | null;
  autorizacao: { situacao: string | null; data: string | null; justificativa: string | null };
  captacao: { inicio: string | null; fim: string | null };
  publicacoes: { data: string | null; documento: string | null; url: string | null }[];
};

export function lerParceria(r: Registro): ParceriaNoTransferegov {
  const publicacoes = (Array.isArray(r.publicacoes_parceria) ? r.publicacoes_parceria : []) as Registro[];
  // A captação vem nas publicações (a mais recente vale); sem elas, no texto "20/12/2024 à 30/11/2025".
  const comCaptacao = [...publicacoes].filter(p => data(p.dt_inicio_captacao) || data(p.dt_fim_captacao))
    .sort((a, b) => (data(b.dt_publicacao) ?? "").localeCompare(data(a.dt_publicacao) ?? ""))[0];
  const doTexto = (texto(r.prazo_limite_captacao_recursos) ?? "").match(/(\d{2})\/(\d{2})\/(\d{4}).*?(\d{2})\/(\d{2})\/(\d{4})/);
  return {
    id: Number(r.id_parceria),
    codigo: codigoDaParceria(r.cd_parceria),
    situacao: texto(r.in_situacao_parceria),
    processo: nupFormatado(texto(r.cd_processo_sei)),
    assinatura: data(r.dh_assinatura),
    autorizacao: {
      situacao: texto(r.in_situacao_autorizacao_execucao),
      data: data(r.dh_autorizacao_execucao),
      justificativa: texto(r.ds_justificativa_autorizacao),
    },
    captacao: {
      inicio: data(comCaptacao?.dt_inicio_captacao) ?? (doTexto ? `${doTexto[3]}-${doTexto[2]}-${doTexto[1]}` : null),
      fim: data(comCaptacao?.dt_fim_captacao) ?? (doTexto ? `${doTexto[6]}-${doTexto[5]}-${doTexto[4]}` : null),
    },
    publicacoes: publicacoes.map(p => ({ data: data(p.dt_publicacao), documento: texto(p.ds_documento_publicado), url: texto(p.ds_url_documento_publicado) })),
  };
}

export type PropostaNoTransferegov = {
  instituicao: string | null;
  cnpj: string | null;
  municipio: string | null;
  objeto: string | null;
  /** Em centavos: o total do planejamento de gastos da proposta. */
  valorPlanejado: number | null;
  situacao: string | null;
};

export function lerProposta(r: Registro): PropostaNoTransferegov {
  const municipio = texto(r.nm_municipio_recebedor);
  const uf = texto(r.sg_uf_recebedor);
  return {
    instituicao: texto(r.nm_ente_recebedor),
    cnpj: documentoDaApi(r.cnpj_ente_recebedor),
    municipio: municipio ? [municipio, uf].filter(Boolean).join("/") : null,
    objeto: texto(r.ds_objeto),
    valorPlanejado: centavos(r.vl_total_planejamento_gastos ?? r.nr_vlr_total),
    situacao: texto(r.situacao_proposta),
  };
}

// ─── Contas ─────────────────────────────────────────────────────────────────

export type SituacaoDoIngresso = "aprovado" | "aguardando" | "nao_classificado" | "indevido" | "outro";

export type IngressoNoTransferegov = {
  data: string | null;
  /** Em centavos. */
  valor: number;
  depositante: { documento: string | null; nome: string | null };
  /** "Doação/Incentivo", "Ingresso Indevido"… */
  tipo: string | null;
  situacao: SituacaoDoIngresso;
  /** A situação como o Transferegov escreve ("Aprovado", "Não Classificado"…). */
  rotulo: string;
};

export type ContaNoTransferegov = {
  id: number;
  tipo: "captacao" | "movimento" | null;
  nome: string;
  banco: string | null;
  /** "0726-9", quando a API traz o dígito; senão o número da agência. */
  agencia: string | null;
  numero: string | null;
  apelido: string | null;
  situacao: string | null;
  abertura: string | null;
  /** Em centavos, cada um com a sua data de referência. */
  saldo: { corrente: number | null; dataCorrente: string | null; investimento: number | null; dataInvestimento: string | null };
  ingressos: IngressoNoTransferegov[];
};

/**
 * A instituição classifica cada crédito da Conta Captação no Transferegov
 * ("Doação/Incentivo" ou "Ingresso Indevido") e o MS analisa a doação.
 */
function situacaoDoIngresso(i: Registro): { situacao: SituacaoDoIngresso; rotulo: string } {
  const analise = texto(i.tx_desc_classificacao_analise_situacao);
  const classificacao = texto(i.tx_descricao_classificacao_ingresso);
  const tipo = texto(i.tx_descricao_classificao_ingresso_tipo);
  if (!classificacao || /nao classificado/.test(semAcento(classificacao))) return { situacao: "nao_classificado", rotulo: "Não classificado" };
  if (/indevid/.test(semAcento(tipo ?? ""))) return { situacao: "indevido", rotulo: tipo! };
  if (/doacao|incentivo/.test(semAcento(tipo ?? ""))) {
    if (analise && /aprovad/.test(semAcento(analise))) return { situacao: "aprovado", rotulo: "Doação aprovada" };
    if (!analise || /analise|aguard/.test(semAcento(analise))) return { situacao: "aguardando", rotulo: "Doação aguardando análise" };
  }
  return { situacao: "outro", rotulo: [tipo, analise].filter(Boolean).join(", ") || classificacao };
}

export function lerConta(r: Registro): ContaNoTransferegov {
  const nome = texto(r.nm_conta) ?? texto(r.tp_conta) ?? "Conta";
  const alvo = semAcento(`${nome} ${texto(r.tp_conta) ?? ""} ${texto(r.nm_personalizado_conta_bb_agil) ?? ""}`);
  const agenciaComDigito = (texto(r.ds_justificativa) ?? "").match(/ag[eê]ncia[^:]*:\s*([\d.]+-?[\dxX]?)/i)?.[1] ?? null;
  const ingressos = (Array.isArray(r.classificacoes_ingresso) ? r.classificacoes_ingresso : []) as Registro[];
  return {
    id: Number(r.id_parceria_conta),
    tipo: /captac|-cap/.test(alvo) ? "captacao" : /moviment|-mov/.test(alvo) ? "movimento" : null,
    nome,
    banco: texto(r.nm_banco),
    agencia: agenciaComDigito ?? texto(r.tx_numero),
    numero: texto(r.tx_conta),
    apelido: texto(r.nm_personalizado_conta_bb_agil),
    situacao: texto(r.tx_descricao),
    abertura: data(r.dt_abertura),
    saldo: {
      corrente: centavos(r.vl_saldo_conta_corrente ?? r.vl_saldo),
      dataCorrente: data(r.dt_referencia_saldo_conta_corrente ?? r.dt_referencia_saldo),
      investimento: centavos(r.vl_saldo_conta_investimento),
      dataInvestimento: data(r.dt_referencia_saldo_conta_investimento),
    },
    ingressos: ingressos.map(i => ({
      data: data(i.dt_movimento_lancamento),
      valor: centavos(i.vl_lancamento) ?? 0,
      depositante: { documento: documentoDaApi(i.nu_identificacao_depositante), nome: /nao informado/.test(semAcento(texto(i.tx_nome_depositante) ?? "")) ? null : texto(i.tx_nome_depositante) },
      tipo: texto(i.tx_descricao_classificao_ingresso_tipo),
      ...situacaoDoIngresso(i),
    })),
  };
}

/** O saldo total da conta (corrente mais aplicação) e a data mais antiga das duas referências. */
export function saldoDaConta(conta: Pick<ContaNoTransferegov, "saldo">): { valor: number; data: string | null } | null {
  const { corrente, investimento, dataCorrente, dataInvestimento } = conta.saldo;
  if (corrente === null && investimento === null) return null;
  const datas = [dataCorrente, dataInvestimento].filter((d): d is string => Boolean(d)).sort();
  return { valor: (corrente ?? 0) + (investimento ?? 0), data: datas[0] ?? null };
}

export type ResumoDosIngressos = {
  /** Em centavos. */
  aprovado: number; aguardando: number; naoClassificado: number; indevido: number; outro: number;
  quantidadeNaoClassificada: number;
};

/** A captação pela classificação do Transferegov: o que o MS já aprovou como doação e o que falta classificar. */
export function resumoDosIngressos(contas: readonly Pick<ContaNoTransferegov, "tipo" | "ingressos">[]): ResumoDosIngressos {
  const resumo: ResumoDosIngressos = { aprovado: 0, aguardando: 0, naoClassificado: 0, indevido: 0, outro: 0, quantidadeNaoClassificada: 0 };
  for (const conta of contas) {
    // Na Conta Movimentação os ingressos são a transferência da captação: só a Conta Captação conta.
    if (conta.tipo !== "captacao") continue;
    for (const i of conta.ingressos) {
      if (i.situacao === "aprovado") resumo.aprovado += i.valor;
      else if (i.situacao === "aguardando") resumo.aguardando += i.valor;
      else if (i.situacao === "nao_classificado") { resumo.naoClassificado += i.valor; resumo.quantidadeNaoClassificada += 1; }
      else if (i.situacao === "indevido") resumo.indevido += i.valor;
      else resumo.outro += i.valor;
    }
  }
  return resumo;
}

// ─── Extrato ────────────────────────────────────────────────────────────────

export type LancamentoDoTransferegov = LancamentoLido & {
  /** "transferegov:<id_extrato_bancario>", a chave do lançamento na conta. */
  chave: string;
  contraparte: { documento: string | null; nome: string | null } | null;
};

const ehDoBanco = (documento: string | null, nome: string | null) =>
  documento === "00000000000191" || /^banco do brasil/i.test(nome ?? "");

function categoria(operacao: string, natureza: NaturezaLancamento, tipoConta: ContaNoTransferegov["tipo"], contraparte: LancamentoDoTransferegov["contraparte"]): CategoriaLancamento {
  const alvo = semAcento(operacao);
  if (/\baplic|\brende facil|\bbb rf\b|\bpoupanca/.test(alvo) && natureza === "debito") return "aplicacao";
  if (/\bresgate/.test(alvo) && natureza === "credito") return "resgate";
  if (/\bdevolvid/.test(alvo) && natureza === "credito") return "estorno";
  if (/\brendimento|\bremuneracao/.test(alvo) && natureza === "credito") return "rendimento";
  // A passagem da Conta Captação para a Conta Movimentação.
  if (/movimento do dia/.test(alvo)) return "transferencia";
  const sugerida = classificarLancamento(operacao, natureza);
  if (sugerida === "tarifa" || sugerida === "estorno" || sugerida === "devolucao") return sugerida;
  if (natureza === "credito") {
    // Depósito de terceiro na Conta Captação é doação.
    if (tipoConta === "captacao" && contraparte && !ehDoBanco(contraparte.documento, contraparte.nome)) return "aporte";
    return sugerida;
  }
  // Na Conta Movimento, o débito que não é aplicação nem tarifa paga despesa ("Transferência enviada", "Câmbio", "Folha", "Impostos").
  return tipoConta === "movimento" ? "pagamento" : sugerida;
}

function historicoDoLancamento(operacao: string, contraparte: LancamentoDoTransferegov["contraparte"]): string {
  if (!contraparte) return operacao;
  const doc = contraparte.documento && !contraparte.documento.includes("*") ? formatarDocumentoCurto(contraparte.documento) : contraparte.documento;
  return [operacao, contraparte.nome, doc].filter(Boolean).join(" · ");
}

const formatarDocumentoCurto = (d: string) =>
  d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
    : d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;

/**
 * As linhas do extrato da conta, em ordem (data e número do lançamento), com
 * a categoria pela operação e pelo tipo da conta. Linha sem data ou sem valor
 * fica de fora.
 */
export function lerExtratoDoTransferegov(registros: readonly Registro[], tipoConta: ContaNoTransferegov["tipo"]): LancamentoDoTransferegov[] {
  return registros
    .map(r => {
      const dia = data(r.dt_movimento_lancamento_extrato_bancario);
      const valor = centavos(r.vl_lancamento_extrato_bancario);
      if (!dia || !valor) return null;
      const natureza: NaturezaLancamento = /d[eé]bito/i.test(texto(r.in_transacao) ?? "") || valor < 0 ? "debito" : "credito";
      const operacao = texto(r.nm_tipo_operacao) ?? (natureza === "credito" ? "Crédito" : "Débito");
      const doc = documentoDaApi(natureza === "credito" ? r.nu_identificacao_depositante_extrato_bancario : r.nu_identificacao_beneficiario);
      const nomeBruto = texto(natureza === "credito" ? r.tx_nome_depositante_extrato_bancario : r.tx_nome_beneficiario);
      // O beneficiário vem com o CNPJ base na frente do nome ("53.096.781 FULANA").
      const nome = nomeBruto?.replace(/^\d{2}\.\d{3}\.\d{3}\s+/, "").trim() || null;
      const contraparte = doc || nome ? { documento: doc, nome } : null;
      const id = texto(r.id_extrato_bancario);
      return {
        ordem: Number(r.nu_identificador_lancamento_extrato_bancario) || 0,
        lancamento: {
          data: dia,
          valor: Math.abs(valor) / 100,
          natureza,
          historico: historicoDoLancamento(operacao, contraparte),
          // O número de referência interno do banco não é o documento do pagamento.
          documento: null,
          documentoNormalizado: null,
          idExterno: id,
          saldoApos: null,
          categoria: categoria(operacao, natureza, tipoConta, contraparte),
          chave: `transferegov:${id ?? `${dia}|${natureza}|${Math.abs(valor)}|${operacao}`}`,
          contraparte,
        } satisfies LancamentoDoTransferegov,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.lancamento.data.localeCompare(b.lancamento.data) || a.ordem - b.ordem)
    .map(x => x.lancamento);
}

// ─── Importação ─────────────────────────────────────────────────────────────

export type LancamentoExistente = { chave: string; data: string; natureza: NaturezaLancamento; valor: number };

export type SeparacaoDosLancamentos = {
  novos: LancamentoDoTransferegov[];
  /** Já importados do Transferegov (mesma chave). */
  jaImportados: number;
  /** Já no extrato vindo do arquivo do banco: mesma data, sentido e valor. */
  equivalentes: number;
};

/**
 * O que entra na importação: fica de fora o que já veio do Transferegov e,
 * uma a uma, as linhas que já estão no extrato importado do arquivo do banco
 * (mesma data, sentido e valor), para não contar o mesmo débito duas vezes.
 */
export function separarLancamentosNovos(daApi: readonly LancamentoDoTransferegov[], existentes: readonly LancamentoExistente[]): SeparacaoDosLancamentos {
  const chaves = new Set(existentes.map(e => e.chave));
  const livres = new Map<string, number>();
  for (const e of existentes) {
    if (e.chave.startsWith("transferegov:")) continue;
    const k = `${e.data}|${e.natureza}|${Math.round(Number(e.valor) * 100)}`;
    livres.set(k, (livres.get(k) ?? 0) + 1);
  }
  const novos: LancamentoDoTransferegov[] = [];
  let jaImportados = 0, equivalentes = 0;
  for (const l of daApi) {
    if (chaves.has(l.chave)) { jaImportados += 1; continue; }
    const k = `${l.data}|${l.natureza}|${Math.round(l.valor * 100)}`;
    const n = livres.get(k) ?? 0;
    if (n > 0) { livres.set(k, n - 1); equivalentes += 1; continue; }
    novos.push(l);
  }
  return { novos, jaImportados, equivalentes };
}

const digitosDaConta = (c: string | null | undefined) => (c ?? "").replace(/[^0-9a-z]/gi, "").toUpperCase().replace(/^0+/, "");

/** A conta da prestação com o mesmo número (com ou sem o dígito), ou null. */
export function contaCorrespondente<T extends { conta: string | null }>(conta: Pick<ContaNoTransferegov, "numero">, contas: readonly T[]): T | null {
  const numero = digitosDaConta(conta.numero);
  if (!numero) return null;
  return contas.find(c => {
    const d = digitosDaConta(c.conta);
    return d === numero || d.slice(0, -1) === numero || numero.slice(0, -1) === d;
  }) ?? null;
}

/** O período e o saldo da importação: o saldo da API só vale se a referência for posterior à última linha. */
export function resumoDaImportacao(conta: Pick<ContaNoTransferegov, "saldo">, lancamentos: readonly Pick<LancamentoLido, "data">[]) {
  const datas = lancamentos.map(l => l.data).sort();
  const saldo = saldoDaConta(conta);
  const ultima = datas.at(-1) ?? null;
  const saldoVale = saldo && saldo.data && (!ultima || saldo.data >= ultima);
  return {
    periodo_inicio: datas[0] ?? null,
    periodo_fim: saldoVale ? saldo.data : ultima,
    saldo_final: saldoVale ? saldo.valor / 100 : null,
  };
}

// ─── Resposta da rota ───────────────────────────────────────────────────────

export type ContaComExtrato = ContaNoTransferegov & { lancamentos: LancamentoDoTransferegov[] };

/** O que GET /api/prestacoes/[id]/transferegov devolve. */
export type RespostaDoTransferegov = {
  parceria: ParceriaNoTransferegov;
  proposta: PropostaNoTransferegov | null;
  contas: ContaComExtrato[];
  /** Dia da última carga da API (ela é atualizada uma vez por dia). */
  atualizadoEm: string | null;
  consultadoEm: string;
};

export const ERROS_DO_TRANSFEREGOV: Record<string, string> = {
  nup_invalido: "Informe o NUP do processo (25000.000000/0000-00) nos dados oficiais da prestação para consultar o Transferegov.",
  parceria_nao_encontrada: "O Transferegov não tem parceria com esse NUP. Confira o número do processo nos dados oficiais.",
  transferegov_indisponivel: "A API do Transferegov não respondeu agora. Tente de novo em alguns minutos.",
};

// ─── Comparação com a prestação ─────────────────────────────────────────────

export type CampoDeData = "data_termo" | "data_inicio_execucao" | "data_fim_captacao";
export type DataDivergente = { campo: CampoDeData; rotulo: string; naPrestacao: string | null; noTransferegov: string };

export type ComparacaoComTransferegov = {
  /** Datas que o Transferegov traz e a prestação não tem, ou tem diferente. */
  datas: DataDivergente[];
  contasQueFaltam: Pick<ContaNoTransferegov, "id" | "nome" | "numero">[];
  ingressos: ResumoDosIngressos;
  /** Em centavos: os aportes do extrato importado no Jards. */
  aportesNoExtrato: number;
};

/**
 * O que a prestação registra diante do Transferegov: a assinatura do Termo,
 * o início da execução (a autorização do MS, art. 50) e o fim da captação;
 * as contas que faltam cadastrar; e a captação classificada contra os aportes
 * do extrato.
 */
export function compararComTransferegov(
  resposta: Pick<RespostaDoTransferegov, "parceria" | "contas">,
  prestacao: Partial<Record<CampoDeData, string | null>>,
  jards: { aportes: number; contas: readonly { conta: string | null }[] },
): ComparacaoComTransferegov {
  const { parceria } = resposta;
  const candidatas: [CampoDeData, string, string | null][] = [
    ["data_termo", "Assinatura do Termo", parceria.assinatura],
    ["data_inicio_execucao", "Início da execução (autorização do MS)", parceria.autorizacao.data],
    ["data_fim_captacao", "Fim da captação", parceria.captacao.fim],
  ];
  return {
    datas: candidatas
      .filter((c): c is [CampoDeData, string, string] => Boolean(c[2]) && (prestacao[c[0]] ?? null)?.slice(0, 10) !== c[2])
      .map(([campo, rotulo, noTransferegov]) => ({ campo, rotulo, naPrestacao: prestacao[campo]?.slice(0, 10) ?? null, noTransferegov })),
    contasQueFaltam: resposta.contas.filter(c => !contaCorrespondente(c, jards.contas)).map(c => ({ id: c.id, nome: c.nome, numero: c.numero })),
    ingressos: resumoDosIngressos(resposta.contas),
    aportesNoExtrato: jards.aportes,
  };
}
