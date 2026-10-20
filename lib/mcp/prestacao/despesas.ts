import { mensagemParaOAssistente } from "@/lib/mcp/prestacao/mensagens";
import { tituloDaChecagem } from "@/lib/prestacao/checagens";
import { motivosDaIa } from "@/lib/prestacao/leitura-ia";
import { limparDocumento } from "@/lib/prestacao/fornecedores";

/** Colunas da despesa que o conector lê: nada do caminho do arquivo no Storage e nada da chave de acesso. */
export const COLUNAS_DA_DESPESA =
  "id,tipo,nome_arquivo,descricao_servico,status,no_id,fornecedor_id,numero_documento,serie,data_doc,valor_extraido,valor_liquido,iss,inss,irrf,outras_retencoes," +
  "origem,canal,justificativa,observacao,motivos_ia,contrapartida,atestado_em,created_at,avaliado_em";

export interface LinhaDeDespesa {
  id: string;
  tipo: string;
  nome_arquivo: string;
  descricao_servico: string | null;
  status: string;
  no_id: string | null;
  fornecedor_id: string | null;
  numero_documento: string | null;
  serie: string | null;
  data_doc: string | null;
  valor_extraido: number | string | null;
  valor_liquido: number | string | null;
  iss: number | string | null;
  inss: number | string | null;
  irrf: number | string | null;
  outras_retencoes: number | string | null;
  origem: string | null;
  canal: string | null;
  justificativa: string | null;
  observacao: string | null;
  motivos_ia: unknown;
  contrapartida: string | null;
  atestado_em: string | null;
  created_at: string | null;
  avaliado_em: string | null;
}

export interface FornecedorLido {
  id: string;
  nome: string;
  tipo_pessoa: string | null;
  documento: string | null;
}

export interface ItemLido {
  id: string;
  codigo: string | null;
  nome: string;
}

export interface VerificacaoDaDespesa {
  check_codigo: string;
  severidade: string;
  mensagem: string;
  entidade_tipo?: string | null;
  entidade_id: string | null;
}

const numero = (valor: number | string | null | undefined): number | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/** CPF aparece só com o miolo ("***.456.789-**"): a pessoa física do cadastro de fornecedores não vai inteira para o assistente. CNPJ aparece inteiro. */
export function mascararDocumento(tipoPessoa: string | null, documento: string | null): string | null {
  const digitos = limparDocumento(documento ?? "");
  if (!digitos) return null;
  if (tipoPessoa === "pf" || digitos.length === 11) return digitos.length === 11 ? `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**` : "***";
  return digitos.length === 14 ? `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}` : digitos;
}

const OBSERVACAO_MAXIMA = 300;

export function despesaParaOAssistente(
  d: LinhaDeDespesa,
  contexto: { prestacaoId: string; origem: string; fornecedores: ReadonlyMap<string, FornecedorLido>; itens: ReadonlyMap<string, ItemLido>; verificacoes: ReadonlyMap<string, VerificacaoDaDespesa[]> },
) {
  const fornecedor = d.fornecedor_id ? contexto.fornecedores.get(d.fornecedor_id) : undefined;
  const item = d.no_id ? contexto.itens.get(d.no_id) : undefined;
  const retencoes = { iss: numero(d.iss) ?? 0, inss: numero(d.inss) ?? 0, irrf: numero(d.irrf) ?? 0, outras: numero(d.outras_retencoes) ?? 0 };
  const abertas = contexto.verificacoes.get(d.id) ?? [];
  const observacao = d.observacao?.trim() || null;
  return {
    id: d.id,
    tipo: d.tipo,
    status: d.status,
    nome: d.descricao_servico || d.nome_arquivo,
    arquivo: d.nome_arquivo,
    fornecedor: fornecedor ? { nome: fornecedor.nome, documento: mascararDocumento(fornecedor.tipo_pessoa, fornecedor.documento) } : null,
    numero_do_documento: d.numero_documento,
    serie: d.serie,
    data_do_documento: d.data_doc,
    valor_bruto: numero(d.valor_extraido),
    valor_liquido: numero(d.valor_liquido),
    ...(Object.values(retencoes).some(v => v > 0) ? { retencoes } : {}),
    item_do_orcamento: item ? { id: item.id, codigo: item.codigo, nome: item.nome } : null,
    contrapartida: d.contrapartida,
    origem: d.origem,
    canal: d.canal,
    justificativa: d.justificativa,
    observacao: observacao && observacao.length > OBSERVACAO_MAXIMA ? `${observacao.slice(0, OBSERVACAO_MAXIMA)}…` : observacao,
    pontos_a_revisar_pela_ia: motivosDaIa(d.motivos_ia).map(m => ({ codigo: m.codigo, titulo: tituloDaChecagem(m.codigo), texto: m.texto })),
    verificacoes_abertas: {
      bloqueios: abertas.filter(v => v.severidade === "bloqueio").length,
      outras: abertas.filter(v => v.severidade !== "bloqueio").length,
      itens: abertas.slice(0, 3).map(v => ({ codigo: v.check_codigo, titulo: tituloDaChecagem(v.check_codigo), severidade: v.severidade, mensagem: mensagemParaOAssistente(v) })),
    },
    avaliada_em: d.avaliado_em,
    criada_em: d.created_at,
    url: `${contexto.origem}/prestacoes/${contexto.prestacaoId}/comprovantes?despesa=${d.id}`,
  };
}
