// Planilhas do STR da ANCINE (P7.3).
//
// O STR recebe três planilhas por SALIC, nos modelos anexos à IN 159 (os da IN
// 150 têm o mesmo mapa de células), salvas como Excel 97-2003:
//  * Relação de Pagamentos (RP): uma por conta de movimentação e uma de
//    contrapartida, quando a contrapartida sai de fora da conta;
//  * Demonstrativo do Extrato (DE): um por conta, de captação e de movimentação;
//  * Demonstrativo Orçamentário e Financeiro (DO): um por SALIC.
// O layout célula a célula e as regras vêm do Manual STR – Planilhas v2.2
// (docs/acoes-futuras/estudos/prestacao-de-contas-fontes/ancine-oficial-str-logomarca.md, §§ 1 a 5).
//
// Este módulo monta o conteúdo das três a partir da prestação: cada pagamento
// conciliado vira uma linha da RP com o histórico e a data do débito do
// extrato (é assim que o STR cruza RP e DE), o item orçamentário vem do código
// que o DO usa (é assim que ele cruza RP e DO), e o DO segue a árvore do
// orçamento. As críticas do STR (§ 5) viram uma lista, com a linha da planilha
// e onde corrigir, para resolver antes da carga. A gravação em .xls fica em
// planilhas-str-xls.ts. Sem React e sem Supabase.

import { ehDespesa } from "./despesas";
import { cnpjValido, cpfValido, limparDocumento } from "./fornecedores";
import { contrapartidaDaPrestacao } from "./checagens/checar-financeiro";
import type { DespesaDoEstado, EstadoDaPrestacao } from "./checagens/catalogo";
import type { NoOrcamento } from "./orcamento";
import type { PrestacaoContaBancaria, PrestacaoFornecedor } from "@/lib/supabase/types";

const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const valida = (d: DespesaDoEstado) => d.status !== "rejeitado" && ehDespesa(d.tipo);

/** Primeira linha de dados de cada planilha no modelo. */
export const LINHA_INICIAL = { rp: 12, de: 14, doOrcamento: 52 } as const;
/** O STR corta o histórico do DE em 60 caracteres (M-STR § 3.2.2). */
export const LIMITE_DO_HISTORICO = 60;

// ─── Fonte e mecanismo do DO ────────────────────────────────────────────────

export type Mecanismo = "indireto" | "direto" | "fsa";

/** Texto exato da lista de C9 do DO; outro texto cai em fomento direto. */
export const MECANISMOS: Record<Mecanismo, string> = {
  indireto: "Fomento Indireto (leis de incentivo)",
  direto: "Fomento Direto (Editais: PAR / PAQ / Outros)",
  fsa: "FSA",
};

/** Linhas da seção III do DO: a fonte, os rendimentos e o subtotal de cada mecanismo. */
export const BLOCOS_DO_DO: Record<Mecanismo, { rendimentos: number; subtotal: number; contrapartida: number | null; primeira: number }> = {
  indireto: { primeira: 21, contrapartida: 29, rendimentos: 30, subtotal: 31 },
  direto: { primeira: 33, contrapartida: null, rendimentos: 37, subtotal: 38 },
  fsa: { primeira: 40, contrapartida: null, rendimentos: 41, subtotal: 42 },
};

export const FONTES_DO_DO = [
  { id: "art1", linha: 21, mecanismo: "indireto", rotulo: "Art. 1º da Lei 8.685/93" },
  { id: "art1a", linha: 22, mecanismo: "indireto", rotulo: "Art. 1º-A da Lei 8.685/93" },
  { id: "art3", linha: 23, mecanismo: "indireto", rotulo: "Art. 3º da Lei 8.685/93" },
  { id: "art3a", linha: 24, mecanismo: "indireto", rotulo: "Art. 3º-A da Lei 8.685/93" },
  { id: "rouanet", linha: 25, mecanismo: "indireto", rotulo: "Art. 18 ou 25 da Lei 8.313/91" },
  { id: "lei10179", linha: 26, mecanismo: "indireto", rotulo: "Lei 10.179/01" },
  { id: "art39", linha: 27, mecanismo: "indireto", rotulo: "Inciso X do art. 39 da MP 2.228-1/01" },
  { id: "art41", linha: 28, mecanismo: "indireto", rotulo: "Art. 41 da MP 2.228-1/01" },
  { id: "par", linha: 33, mecanismo: "direto", rotulo: "PAR (Prêmio Adicional de Renda)" },
  { id: "paq", linha: 34, mecanismo: "direto", rotulo: "PAQ (Programa de Incentivo à Qualidade)" },
  { id: "coproducao", linha: 35, mecanismo: "direto", rotulo: "Edital de Coprodução Internacional" },
  { id: "editais", linha: 36, mecanismo: "direto", rotulo: "Outros editais" },
  { id: "fsa", linha: 40, mecanismo: "fsa", rotulo: "FSA" },
] as const satisfies readonly { id: string; linha: number; mecanismo: Mecanismo; rotulo: string }[];
export type FonteDoDo = (typeof FONTES_DO_DO)[number]["id"];

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A fonte da seção III pelo texto da "Fonte do recurso" da prestação; null quando não dá para saber. */
export function fonteSugerida(texto: string | null | undefined): FonteDoDo | null {
  const t = semAcento(texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/\bfsa\b|fundo setorial/.test(t)) return "fsa";
  if (/\bpar\b|premio adicional/.test(t)) return "par";
  if (/\bpaq\b|incentivo a qualidade/.test(t)) return "paq";
  if (/coprodu/.test(t)) return "coproducao";
  if (/edita/.test(t)) return "editais";
  if (/8\.?313|rouanet/.test(t)) return "rouanet";
  if (/10\.?179/.test(t)) return "lei10179";
  if (/2\.?228|mp /.test(t)) return /\b41\b/.test(t) ? "art41" : /\b39\b/.test(t) ? "art39" : null;
  const artigo = /art(?:igo|\.)?\s*(1|3)\s*[ºo°]?\s*(-?\s*a\b)?/.exec(t);
  if (artigo) return `art${artigo[1]}${artigo[2] ? "a" : ""}` as FonteDoDo;
  return null;
}

// ─── Campos ─────────────────────────────────────────────────────────────────

/** SALIC no formato do STR, NN-NNNN; null quando o texto não é um SALIC. */
export function salicDoStr(texto: string | null | undefined): string | null {
  const m = /^\s*(\d{2})\s*[-./]?\s*(\d{4})\s*$/.exec(texto ?? "");
  return m ? `${m[1]}-${m[2]}` : null;
}

const BANCOS: [RegExp, string][] = [
  [/banco do brasil|\bbb\b/, "001"], [/caixa|\bcef\b/, "104"], [/bradesco/, "237"], [/itau/, "341"], [/santander/, "033"],
  [/\bbrb\b|banco de brasilia/, "070"], [/banrisul/, "041"], [/sicoob/, "756"], [/sicredi/, "748"], [/nubank|nu pagamentos/, "260"],
  [/\binter\b/, "077"], [/nordeste|\bbnb\b/, "004"], [/amazonia|\bbasa\b/, "003"], [/safra/, "422"], [/btg/, "208"],
];

/** Código numérico do banco: os dígitos digitados ou o código pelo nome. */
export function codigoDoBanco(banco: string | null | undefined): string | null {
  const t = (banco ?? "").trim();
  const digitos = /^\D*(\d{1,3})\b/.exec(t);
  if (digitos && /^\d{1,3}(\s|$|-)/.test(t.replace(/^\D*/, ""))) return digitos[1].padStart(3, "0");
  const nome = semAcento(t);
  return BANCOS.find(([re]) => re.test(nome))?.[1] ?? null;
}

/** Agência só com dígitos; o dígito verificador com letra fica de fora (M-STR § 3.2.3). */
export function agenciaDoStr(agencia: string | null | undefined): string {
  return (agencia ?? "").trim().replace(/-\s*[a-z]$/i, "").replace(/\D/g, "");
}

/** Tipo do documento fiscal na RP (II.f): as siglas do manual. */
export function siglaDoDocumento(d: Pick<DespesaDoEstado, "tipo" | "nome_arquivo">): string | null {
  switch (d.tipo) {
    case "nfe": case "nfse": return "NF";
    case "cupom": return "CF";
    case "rpa": return "RPA";
    case "recibo": case "rpci": return "Recibo";
    case "invoice": return "INVOICE";
    case "fatura": return "Fatura";
    case "guia_tributo": return /gps|inss/i.test(d.nome_arquivo) ? "GPS" : "DARF";
    case "folha_pagamento": return "Folha";
    case "apolice": return "Apólice";
    case "nota_debito": return "ND";
    default: return null;
  }
}

/** Histórico do DE, igual na RP: o do extrato, cortado em 60 caracteres. */
export const historicoDoStr = (h: string) => h.replace(/\s+/g, " ").trim().slice(0, LIMITE_DO_HISTORICO).trimEnd();

// ─── Tipos de saída ─────────────────────────────────────────────────────────

/** Onde a pessoa corrige o que a crítica aponta. */
export type DestinoDaCritica =
  | { tipo: "despesa"; id: string }
  | { tipo: "conciliacao" }
  | { tipo: "orcamento" }
  | { tipo: "extrato" }
  | { tipo: "dados" };

export type CriticaDoStr = {
  /** Nome do arquivo; null vale para todas. */
  arquivo: string | null;
  /** Linha da planilha (como o Excel numera). */
  linha: number | null;
  campo: string;
  mensagem: string;
  /** Carga: o STR recusa a planilha; envio: recusa o envio; aviso: não é crítica do STR, mas muda o que a planilha mostra. */
  momento: "carga" | "envio" | "aviso";
  destino: DestinoDaCritica | null;
};

export type CabecalhoDoStr = { titulo: string; salic: string; proponente: string };

export type LinhaDaRp = {
  item: string;
  credor: string;
  documento: string;
  historico: string;
  dataPagamento: string | null;
  tipoDocumento: string;
  numeroDocumento: string;
  dataEmissao: string | null;
  /** Centavos. */
  valor: number;
  despesaId: string;
};

export type RelacaoDePagamentos = {
  arquivo: string;
  contaId: string | null;
  contrapartida: boolean;
  banco: string;
  agencia: string;
  conta: string;
  linhas: LinhaDaRp[];
  total: number;
};

export type LinhaDoDe = {
  data: string;
  historico: string;
  /** Centavos, com o sinal da coluna (transferência concedida e aplicação negativas). */
  fomento: number;
  outros: number;
  transferencias: number;
  aplicacoes: number;
  pagamentos: number;
  despesasBancarias: number;
  saldo: number;
};

export type DemonstrativoDoExtrato = {
  arquivo: string;
  contaId: string;
  contaDe: "CAPTAÇÃO" | "MOVIMENTAÇÃO";
  banco: string;
  agencia: string;
  conta: string;
  linhas: LinhaDoDe[];
  totais: Omit<LinhaDoDe, "data" | "historico">;
};

export type LinhaDoDo = {
  tipo: "grupo" | "item" | "vazia";
  codigo: string;
  descricao: string;
  /** Centavos. */
  aprovado: number;
  executado: number;
};

export type CaptacaoDoDo = { linha: number; aprovado: number; captado: number };

export type DemonstrativoOrcamentario = {
  arquivo: string;
  mecanismo: Mecanismo | null;
  fonte: FonteDoDo | null;
  captacoes: CaptacaoDoDo[];
  linhas: LinhaDoDo[];
  totalAprovado: number;
  totalExecutado: number;
  /** II.a: captado + rendimentos (+ contrapartida no fomento indireto). */
  disponibilizado: number;
};

export type PlanilhasDoStr = {
  cabecalho: CabecalhoDoStr;
  rps: RelacaoDePagamentos[];
  des: DemonstrativoDoExtrato[];
  do: DemonstrativoOrcamentario;
  /** O STR soma e confronta (M-STR § 5.3.3); centavos. */
  totais: { aComprovar: number; comprovado: number; captado: number; contrapartidaMinima: number; rendimentos: number; rps: number; despesasBancarias: number };
  criticas: CriticaDoStr[];
};

export type ContaDoStr = Pick<PrestacaoContaBancaria, "id" | "tipo" | "banco" | "agencia" | "conta" | "apelido">;

export type DadosDoStr = {
  estado: EstadoDaPrestacao;
  contas: readonly ContaDoStr[];
  prestacao: { titulo: string; identificador: string | null; proponente: string | null; valorAprovado: number | null };
  fonte: FonteDoDo | null;
};

// ─── Montagem ───────────────────────────────────────────────────────────────

const nomeDoArquivo = (partes: (string | null | undefined)[]) =>
  `${partes.filter(Boolean).join("_").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._ -]+/g, "-").slice(0, 80)}.xls`;

const contaNoNome = (c: ContaDoStr) => (c.conta ?? "").replace(/[^0-9.-]/g, "") || c.apelido || c.id.slice(0, 8);

/** Códigos do DO: os do orçamento quando todos são números e pontos, únicos; senão, pela posição na árvore. */
function codigosDoOrcamento(nos: readonly NoOrcamento[]): Map<string, string> {
  const filhosDe = new Map<string | null, NoOrcamento[]>();
  for (const no of nos) filhosDe.set(no.parent_id, [...(filhosDe.get(no.parent_id) ?? []), no]);
  for (const lista of filhosDe.values()) lista.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  const proprios = nos.map(n => (n.codigo ?? "").trim());
  const usarProprios = proprios.every(c => /^\d+(\.\d+)*$/.test(c)) && new Set(proprios).size === proprios.length;
  const codigos = new Map<string, string>();
  const visitar = (pai: string | null, prefixo: string) => {
    (filhosDe.get(pai) ?? []).forEach((no, i) => {
      const codigo = usarProprios ? (no.codigo ?? "").trim() : prefixo ? `${prefixo}.${i + 1}` : String(i + 1);
      codigos.set(no.id, codigo);
      visitar(no.id, codigo);
    });
  };
  visitar(null, "");
  return codigos;
}

function documentoDoCredor(d: DespesaDoEstado, fornecedor: PrestacaoFornecedor | undefined, sigla: string | null): { documento: string; problema: string | null } {
  if (sigla === "INVOICE") {
    const numero = (d.numero_documento ?? "").trim();
    return { documento: numero, problema: numero ? null : "Na invoice, o campo leva o número do documento, que está vazio." };
  }
  if (!fornecedor) return { documento: "", problema: "Despesa sem fornecedor: o CPF ou CNPJ do credor fica vazio." };
  const documento = limparDocumento(fornecedor.documento);
  if (!documento) return { documento: "", problema: "Fornecedor sem CPF ou CNPJ." };
  if (!/^\d+$/.test(documento)) return { documento, problema: "O STR aceita CPF ou CNPJ só com números; o CNPJ alfanumérico ainda não tem orientação da ANCINE." };
  const ok = documento.length === 11 ? cpfValido(documento) : documento.length === 14 ? cnpjValido(documento) : false;
  return { documento, problema: ok ? null : "CPF ou CNPJ inválido: o STR recusa a carga." };
}

export function planilhasDoStr(dados: DadosDoStr): PlanilhasDoStr {
  const { estado, contas } = dados;
  const criticas: CriticaDoStr[] = [];
  const salic = salicDoStr(dados.prestacao.identificador);
  const cabecalho: CabecalhoDoStr = {
    titulo: dados.prestacao.titulo,
    salic: salic ?? (dados.prestacao.identificador ?? ""),
    proponente: dados.prestacao.proponente ?? "",
  };
  if (!salic) {
    criticas.push({
      arquivo: null, linha: null, campo: "SALIC", momento: "carga", destino: { tipo: "dados" },
      mensagem: dados.prestacao.identificador
        ? `"${dados.prestacao.identificador}" não está no formato do SALIC (NN-NNNN, ex. 21-0123): o STR recusa planilha com SALIC diferente do projeto.`
        : "Informe o SALIC (NN-NNNN) nos dados oficiais da prestação: ele vai no cabeçalho das três planilhas.",
    });
  }
  if (!cabecalho.proponente) {
    criticas.push({ arquivo: null, linha: null, campo: "Proponente", momento: "aviso", destino: { tipo: "dados" }, mensagem: "A prestação não tem proponente: o cabeçalho sai sem o nome." });
  }
  const prefixo = salic ?? dados.prestacao.titulo;

  // DO: códigos e linhas da árvore do orçamento em uso.
  const nos = estado.nos ?? [];
  const codigos = codigosDoOrcamento(nos);
  const temFilhos = new Set(nos.map(n => n.parent_id).filter((p): p is string => Boolean(p)));
  const despesas = estado.despesas.filter(valida);
  const fornecedores = new Map(estado.fornecedores.map(f => [f.id, f]));
  const nosPorId = new Map(nos.map(n => [n.id, n]));

  // ─── RP ───
  const lancamentos = new Map(estado.lancamentos.map(l => [l.id, l]));
  const contasDoProjeto = contas.filter(c => c.tipo === "captacao" || c.tipo === "movimento" || c.tipo === "unica");
  const movimentacao = contas.filter(c => c.tipo === "movimento" || c.tipo === "unica");
  const rps: RelacaoDePagamentos[] = movimentacao.map(c => ({
    arquivo: nomeDoArquivo(["RP", prefixo, contaNoNome(c)]),
    contaId: c.id, contrapartida: false,
    banco: codigoDoBanco(c.banco) ?? "", agencia: agenciaDoStr(c.agencia), conta: (c.conta ?? "").trim(),
    linhas: [], total: 0,
  }));
  const rpContrapartida: RelacaoDePagamentos = {
    arquivo: nomeDoArquivo(["RP", prefixo, "CONTRAPARTIDA"]), contaId: null, contrapartida: true,
    banco: "CONTRAPARTIDA", agencia: "", conta: "CONTRAP", linhas: [], total: 0,
  };
  if (!movimentacao.length) {
    criticas.push({ arquivo: null, linha: null, campo: "Conta de movimentação", momento: "envio", destino: { tipo: "extrato" }, mensagem: "Cadastre a conta de movimentação com o extrato: cada uma tem a sua RP e o seu DE." });
  }

  const linhaBase = (d: DespesaDoEstado) => {
    const sigla = siglaDoDocumento(d);
    const no = d.no_id ? nosPorId.get(d.no_id) : undefined;
    return {
      sigla, no,
      item: no ? codigos.get(no.id) ?? "" : "",
      credor: (d.fornecedor_id && (fornecedores.get(d.fornecedor_id)?.razao_social || fornecedores.get(d.fornecedor_id)?.nome)) || "",
      ...documentoDoCredor(d, d.fornecedor_id ? fornecedores.get(d.fornecedor_id) : undefined, sigla),
      numeroDocumento: (d.numero_documento ?? "").trim(),
    };
  };

  for (const d of despesas) {
    const base = linhaBase(d);
    const pagamentos = estado.pagamentos.filter(p => p.despesa_id === d.id);
    const doExtrato = pagamentos.filter(p => p.lancamento_id && lancamentos.has(p.lancamento_id));
    const foraDoExtrato = pagamentos.filter(p => !p.lancamento_id || !lancamentos.has(p.lancamento_id));
    for (const p of doExtrato) {
      const l = lancamentos.get(p.lancamento_id!)!;
      const rp = rps.find(r => r.contaId === l.conta_id);
      if (!rp) {
        criticas.push({ arquivo: null, linha: null, campo: "Conta", momento: "aviso", destino: { tipo: "despesa", id: d.id }, mensagem: `"${d.nome_arquivo}" foi paga por um débito de uma conta que não é de movimentação: a RP só lista os pagamentos da conta de movimentação.` });
        continue;
      }
      rp.linhas.push({ ...base, despesaId: d.id, historico: historicoDoStr(l.historico), dataPagamento: l.data, tipoDocumento: base.sigla ?? "", dataEmissao: d.data_doc, valor: centavos(p.valor) });
    }
    if (d.contrapartida) {
      // Contrapartida fora da conta: o pagamento registrado sem débito no extrato, ou o documento todo na doação.
      const partes = foraDoExtrato.length ? foraDoExtrato.map(p => ({ data: p.data, valor: centavos(p.valor) }))
        : !pagamentos.length ? [{ data: d.data_doc, valor: centavos(d.valor_extraido) }] : [];
      for (const parte of partes) {
        rpContrapartida.linhas.push({ ...base, despesaId: d.id, historico: "CONTRAPARTIDA", dataPagamento: parte.data, tipoDocumento: base.sigla ?? "", dataEmissao: d.data_doc, valor: parte.valor });
      }
    } else if (foraDoExtrato.length) {
      criticas.push({ arquivo: null, linha: null, campo: "Pagamento", momento: "aviso", destino: { tipo: "conciliacao" }, mensagem: `"${d.nome_arquivo}": ${foraDoExtrato.length === 1 ? "um pagamento não está ligado" : `${foraDoExtrato.length} pagamentos não estão ligados`} a um débito do extrato e ${foraDoExtrato.length === 1 ? "fica" : "ficam"} fora da RP. Concilie para que entre com o histórico do débito.` });
    } else if (!pagamentos.length) {
      criticas.push({ arquivo: null, linha: null, campo: "Pagamento", momento: "aviso", destino: { tipo: "despesa", id: d.id }, mensagem: `"${d.nome_arquivo}" não tem pagamento registrado e fica fora da RP.` });
    }
  }

  const todasAsRps = [...rps, ...(rpContrapartida.linhas.length ? [rpContrapartida] : [])];
  for (const rp of todasAsRps) {
    rp.linhas.sort((a, b) => (a.dataPagamento ?? "").localeCompare(b.dataPagamento ?? "") || a.historico.localeCompare(b.historico) || a.item.localeCompare(b.item, "pt-BR", { numeric: true }));
    rp.total = rp.linhas.reduce((s, l) => s + l.valor, 0);
    if (!rp.contrapartida && !rp.banco) {
      criticas.push({ arquivo: rp.arquivo, linha: 8, campo: "I.d. Banco", momento: "carga", destino: { tipo: "extrato" }, mensagem: "Banco sem código numérico: informe o código (ex.: 001) na conta, igual ao do DE." });
    }
    rp.linhas.forEach((l, i) => {
      const linha = LINHA_INICIAL.rp + i;
      const critica = (campo: string, mensagem: string, momento: CriticaDoStr["momento"] = "carga", destino: DestinoDaCritica = { tipo: "despesa", id: l.despesaId }) =>
        criticas.push({ arquivo: rp.arquivo, linha, campo, mensagem, momento, destino });
      const d = despesas.find(x => x.id === l.despesaId)!;
      const base = linhaBase(d);
      if (!l.item) critica("II.a. Item orçam.", d.no_id ? "A despesa está num item de outra versão do orçamento: ligue a um item do DO." : "Despesa sem item do orçamento: o STR não acha o item no DO.", "envio");
      else if (base.no && temFilhos.has(base.no.id)) critica("II.a. Item orçam.", `"${base.no.nome}" é um grupo do orçamento: o STR só aceita o item, não a linha de grupo.`, "envio");
      if (!l.credor) critica("II.b. Credor", "Credor vazio: ligue a despesa ao fornecedor.", "aviso");
      if (base.problema) critica("II.c. CPF/CNPJ", base.problema);
      if (!l.tipoDocumento) critica("II.f. Tipo doc. fiscal", "Tipo de documento sem sigla da ANCINE (NF, Recibo, RPA, DARF…): ajuste o tipo da despesa.");
      if (!l.numeroDocumento) critica("II.g. Nº doc. fiscal", "Número do documento vazio. Recibo sem número leva numeração sequencial.");
      else if (!/^\d+$/.test(l.numeroDocumento.replace(/[\s./-]/g, ""))) critica("II.g. Nº doc. fiscal", `"${l.numeroDocumento}" não é número: o STR só aceita algarismos.`);
      if (!l.dataPagamento) critica("II.e. Data do pgto.", "Data do pagamento vazia.");
      if (!l.dataEmissao) critica("II.h. Data de emissão", "Data de emissão vazia.");
      if (l.valor <= 0) critica("II.i. Valor", "Valor vazio ou zero.");
    });
  }

  // ─── DE ───
  const des: DemonstrativoDoExtrato[] = contasDoProjeto.map(c => {
    const contaDe = c.tipo === "captacao" ? "CAPTAÇÃO" as const : "MOVIMENTAÇÃO" as const;
    const doDaConta = estado.lancamentos
      .map((l, ordem) => ({ l, ordem }))
      .filter(({ l }) => l.conta_id === c.id)
      .sort((a, b) => a.l.data.localeCompare(b.l.data) || a.ordem - b.ordem);
    let saldo = 0;
    const linhas: LinhaDoDe[] = doDaConta.map(({ l }) => {
      const v = centavos(l.valor);
      const credito = l.natureza === "credito";
      const linha: LinhaDoDe = { data: l.data, historico: historicoDoStr(l.historico), fomento: 0, outros: 0, transferencias: 0, aplicacoes: 0, pagamentos: 0, despesasBancarias: 0, saldo: 0 };
      if (l.categoria === "aporte" && credito) {
        if (contaDe === "CAPTAÇÃO" || dados.fonte === "fsa") linha.fomento = v; else linha.outros = v;
      } else if (l.categoria === "transferencia") linha.transferencias = credito ? v : -v;
      else if (l.categoria === "aplicacao" || l.categoria === "resgate" || l.categoria === "rendimento") linha.aplicacoes = credito ? v : -v;
      else if (l.categoria === "tarifa" && !credito) linha.despesasBancarias = v;
      else if (credito) linha.outros = v;
      else linha.pagamentos = v;
      saldo += linha.fomento + linha.outros + linha.transferencias + linha.aplicacoes - linha.pagamentos - linha.despesasBancarias;
      linha.saldo = saldo;
      return linha;
    });
    const soma = (k: keyof Omit<LinhaDoDe, "data" | "historico" | "saldo">) => linhas.reduce((s, l) => s + l[k], 0);
    const de: DemonstrativoDoExtrato = {
      arquivo: nomeDoArquivo(["DE", prefixo, contaNoNome(c)]),
      contaId: c.id, contaDe,
      banco: codigoDoBanco(c.banco) ?? "", agencia: agenciaDoStr(c.agencia), conta: (c.conta ?? "").trim(),
      linhas,
      totais: { fomento: soma("fomento"), outros: soma("outros"), transferencias: soma("transferencias"), aplicacoes: soma("aplicacoes"), pagamentos: soma("pagamentos"), despesasBancarias: soma("despesasBancarias"), saldo },
    };
    if (!de.banco) criticas.push({ arquivo: de.arquivo, linha: 10, campo: "I.e. Banco", momento: "carga", destino: { tipo: "extrato" }, mensagem: "Banco sem código numérico: informe o código (ex.: 001) na conta." });
    if (!linhas.length) criticas.push({ arquivo: de.arquivo, linha: null, campo: "II. Movimentação", momento: "aviso", destino: { tipo: "extrato" }, mensagem: `A conta ${c.apelido || c.conta || ""} não tem extrato importado: o DE sai vazio.`.replace("  ", " ") });
    else if (saldo !== 0) criticas.push({ arquivo: de.arquivo, linha: LINHA_INICIAL.de + linhas.length, campo: "II.i. Saldo", momento: "aviso", destino: { tipo: "extrato" }, mensagem: `O saldo final é ${reais(saldo)}; na prestação final ele precisa ser zero. Confira se o extrato começa na abertura da conta.` });
    return de;
  });
  for (const rp of rps) {
    const de = des.find(d => d.contaId === rp.contaId);
    if (!de) continue;
    // RP×DE (M-STR § 5.3.1): o histórico com a data precisa existir no DE.
    const doDe = new Set(de.linhas.map(l => `${l.data}|${l.historico}`));
    rp.linhas.forEach((l, i) => {
      if (!doDe.has(`${l.dataPagamento}|${l.historico}`)) {
        criticas.push({ arquivo: rp.arquivo, linha: LINHA_INICIAL.rp + i, campo: "II.d. Histórico", momento: "envio", destino: { tipo: "conciliacao" }, mensagem: `"${l.historico}" de ${l.dataPagamento ? dataBr(l.dataPagamento) : "data vazia"} não está no DE com a mesma data.` });
      }
    });
  }

  // ─── DO ───
  const executadoPorNo = new Map<string, number>();
  for (const d of despesas) if (d.no_id) executadoPorNo.set(d.no_id, (executadoPorNo.get(d.no_id) ?? 0) + centavos(d.valor_extraido));
  const filhosDe = new Map<string | null, NoOrcamento[]>();
  for (const no of nos) filhosDe.set(no.parent_id, [...(filhosDe.get(no.parent_id) ?? []), no]);
  for (const lista of filhosDe.values()) lista.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  const linhasDoDo: LinhaDoDo[] = [];
  const somar = (no: NoOrcamento): { aprovado: number; executado: number } => {
    const filhos = filhosDe.get(no.id) ?? [];
    if (!filhos.length) return { aprovado: centavos(no.valor_total) + centavos(no.valor_remanejado), executado: executadoPorNo.get(no.id) ?? 0 };
    return filhos.map(somar).reduce((s, x) => ({ aprovado: s.aprovado + x.aprovado, executado: s.executado + x.executado }), { aprovado: 0, executado: 0 });
  };
  const escrever = (no: NoOrcamento) => {
    const filhos = filhosDe.get(no.id) ?? [];
    const codigo = codigos.get(no.id) ?? "";
    const { aprovado, executado } = somar(no);
    if (filhos.length) {
      // Linha de grupo: o código vai dentro da descrição, como no modelo.
      linhasDoDo.push({ tipo: "grupo", codigo: "", descricao: `${codigo} ${no.nome}`, aprovado, executado });
      filhos.forEach(escrever);
    } else {
      linhasDoDo.push({ tipo: "item", codigo, descricao: no.nome, aprovado, executado });
    }
  };
  (filhosDe.get(null) ?? []).forEach((raiz, i) => {
    if (i > 0) linhasDoDo.push({ tipo: "vazia", codigo: "", descricao: "", aprovado: 0, executado: 0 });
    escrever(raiz);
  });
  const folhas = linhasDoDo.filter(l => l.tipo === "item");
  const totalAprovado = folhas.reduce((s, l) => s + l.aprovado, 0);
  const totalExecutado = folhas.reduce((s, l) => s + l.executado, 0);
  const arquivoDo = nomeDoArquivo(["DO", prefixo]);
  if (!nos.length) criticas.push({ arquivo: arquivoDo, linha: null, campo: "IV. Orçamento", momento: "envio", destino: { tipo: "orcamento" }, mensagem: "Cadastre o orçamento aprovado: o DO lista todas as rubricas, e a RP precisa achar o item nele." });

  const fonte = FONTES_DO_DO.find(f => f.id === dados.fonte) ?? null;
  const mecanismo = fonte?.mecanismo ?? null;
  if (!fonte) criticas.push({ arquivo: arquivoDo, linha: 9, campo: "I.d. Mecanismo", momento: "carga", destino: null, mensagem: "Escolha a fonte do recurso: ela define o mecanismo (I.d) e a linha da captação na seção III." });

  const captado = estado.lancamentos.filter(l => l.natureza === "credito" && l.categoria === "aporte" && contas.find(c => c.id === l.conta_id)?.tipo === "captacao")
    .reduce((s, l) => s + centavos(l.valor), 0)
    || estado.lancamentos.filter(l => l.natureza === "credito" && l.categoria === "aporte").reduce((s, l) => s + centavos(l.valor), 0);
  const rendimentos = estado.lancamentos.filter(l => l.natureza === "credito" && l.categoria === "rendimento").reduce((s, l) => s + centavos(l.valor), 0);
  const conta = contrapartidaDaPrestacao(estado);
  const contrapartidaMinima = mecanismo === "indireto" ? conta?.minimo ?? 0 : 0;
  const aprovadoDaFonte = dados.prestacao.valorAprovado !== null ? centavos(dados.prestacao.valorAprovado) : Math.max(totalAprovado - contrapartidaMinima, 0);
  const captacoes: CaptacaoDoDo[] = [];
  let disponibilizado = 0;
  if (fonte && mecanismo) {
    const bloco = BLOCOS_DO_DO[mecanismo];
    captacoes.push({ linha: fonte.linha, aprovado: aprovadoDaFonte, captado });
    if (bloco.contrapartida) captacoes.push({ linha: bloco.contrapartida, aprovado: contrapartidaMinima, captado: conta?.comprovada ?? 0 });
    captacoes.push({ linha: bloco.rendimentos, aprovado: 0, captado: rendimentos });
    disponibilizado = captacoes.reduce((s, c) => s + c.captado, 0);
  }

  const doc: DemonstrativoOrcamentario = { arquivo: arquivoDo, mecanismo, fonte: fonte?.id ?? null, captacoes, linhas: linhasDoDo, totalAprovado, totalExecutado, disponibilizado };

  // ─── A comprovar × comprovado (M-STR § 5.3.3) ───
  const totalRps = todasAsRps.reduce((s, r) => s + r.total, 0);
  const despesasBancarias = des.reduce((s, d) => s + d.totais.despesasBancarias, 0);
  const aComprovar = captado + contrapartidaMinima + rendimentos;
  const comprovado = totalRps + despesasBancarias;
  if (comprovado < aComprovar) {
    criticas.push({
      arquivo: null, linha: null, campo: "A comprovar × comprovado", momento: "envio", destino: { tipo: "conciliacao" },
      mensagem: `Comprovado ${reais(comprovado)} (RPs ${reais(totalRps)} + despesas bancárias ${reais(despesasBancarias)}) é menor que o a comprovar ${reais(aComprovar)} (captado ${reais(captado)}${contrapartidaMinima ? ` + contrapartida mínima ${reais(contrapartidaMinima)}` : ""} + rendimentos ${reais(rendimentos)}): faltam ${reais(aComprovar - comprovado)}, e o STR bloqueia o envio.`,
    });
  }

  return {
    cabecalho,
    rps: todasAsRps,
    des,
    do: doc,
    totais: { aComprovar, comprovado, captado, contrapartidaMinima, rendimentos, rps: totalRps, despesasBancarias },
    criticas,
  };
}

/** As críticas que impedem a carga ou o envio no STR. */
export const criticasQueBloqueiam = (criticas: readonly CriticaDoStr[]) => criticas.filter(c => c.momento !== "aviso");
