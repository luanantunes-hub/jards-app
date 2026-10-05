// Fornecedores da organização (P2.3): tipos, documento formatado e os alertas
// que a consulta pública levanta. A validação do documento e a leitura das
// consultas moram em supabase/functions/_shared/fornecedor-publico.ts, para a
// função consultar-fornecedor usar o mesmo código. Sem React e sem Supabase.

import {
  cnpjValido,
  cpfValido,
  limparDocumento,
} from "@/supabase/functions/_shared/fornecedor-publico";
import type { PrestacaoFornecedor, PrestacaoFornecedorDocumento } from "@/lib/supabase/types";

export {
  caminhoDocumentoFornecedor,
  cnpjValido,
  cpfValido,
  formatarCnae,
  lerCertidoesTcu,
  lerCnpjBrasilApi,
  limparDocumento,
  resumoDasCertidoes,
} from "@/supabase/functions/_shared/fornecedor-publico";
export type { Certidao, DadosCnpj, SituacaoSancoes } from "@/supabase/functions/_shared/fornecedor-publico";

export type TipoPessoa = PrestacaoFornecedor["tipo_pessoa"];
export type TipoRelacao = NonNullable<PrestacaoFornecedor["tipo_relacao"]>;

export const TIPOS_PESSOA: { id: TipoPessoa; rotulo: string; documento: string }[] = [
  { id: "pj", rotulo: "Pessoa jurídica", documento: "CNPJ" },
  { id: "mei", rotulo: "MEI", documento: "CNPJ" },
  { id: "pf", rotulo: "Pessoa física", documento: "CPF" },
  { id: "estrangeiro", rotulo: "Estrangeiro", documento: "Documento" },
];

/** Partes relacionadas ao proponente, que a Rouanet limita em conjunto (art. 23 da IN 29). */
export const TIPOS_RELACAO: { id: TipoRelacao; rotulo: string }[] = [
  { id: "proponente", rotulo: "O próprio proponente" },
  { id: "dirigente", rotulo: "Dirigente do proponente" },
  { id: "socio_em_comum", rotulo: "Sócio em comum" },
  { id: "coligada", rotulo: "Empresa coligada" },
  { id: "conjuge", rotulo: "Cônjuge ou companheiro" },
  { id: "parente", rotulo: "Parente" },
];

/** CNPJ e CPF com consulta pública; estrangeiro aceita qualquer documento. */
export function documentoValido(tipo: TipoPessoa, documento: string): boolean {
  if (tipo === "pj" || tipo === "mei") return cnpjValido(documento);
  if (tipo === "pf") return cpfValido(documento);
  return limparDocumento(documento).length > 0;
}

/** "12.ABC.345/01DE-35", "123.456.789-09" ou, com mascarar, "***.456.789-**". */
export function formatarDocumento(documento: string | null | undefined, opcoes: { mascararCpf?: boolean } = {}): string {
  const d = limparDocumento(documento);
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (/^\d{11}$/.test(d)) {
    return opcoes.mascararCpf
      ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
      : `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return documento?.trim() ?? "";
}

type FornecedorParaNome = Pick<PrestacaoFornecedor, "nome" | "nome_fantasia" | "razao_social" | "documento">;

/**
 * O nome dado pela pessoa; sem ele, a razão social, que é o nome da nota
 * fiscal (o fantasia da Receita às vezes é "MATRIZ" ou "DIRECAO GERAL").
 */
export function nomeDoFornecedor(f: FornecedorParaNome): string {
  return f.nome?.trim() || f.razao_social || f.nome_fantasia || formatarDocumento(f.documento, { mascararCpf: true }) || "Fornecedor sem nome";
}

/** Depois disso a consulta pública pede para ser refeita. */
export const DIAS_VALIDADE_CONSULTA = 90;

export type AlertaFornecedor = {
  codigo:
    | "FORNECEDOR_DOCUMENTO"
    | "FORNECEDOR_NAO_CONSULTADO"
    | "FORNECEDOR_SITUACAO"
    | "FORNECEDOR_TIPO"
    | "FORNECEDOR_SANCIONADO"
    | "FORNECEDOR_SANCOES_A_CONFERIR"
    | "FORNECEDOR_CONSULTA_ANTIGA"
    | "PARTE_RELACIONADA";
  nivel: "alerta" | "info";
  texto: string;
};

const dataCurta = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");

/**
 * O que a pessoa precisa ver sobre o fornecedor hoje. Os códigos são os do
 * catálogo de checagens (estudo, seção 8); o motor da P2.7 vai cruzar com a
 * data de cada despesa.
 */
export function alertasDoFornecedor(f: PrestacaoFornecedor, hoje: Date = new Date()): AlertaFornecedor[] {
  const alertas: AlertaFornecedor[] = [];
  const temCnpj = f.tipo_pessoa === "pj" || f.tipo_pessoa === "mei";

  if (f.documento && !documentoValido(f.tipo_pessoa, f.documento)) {
    alertas.push({ codigo: "FORNECEDOR_DOCUMENTO", nivel: "alerta", texto: `${TIPOS_PESSOA.find(t => t.id === f.tipo_pessoa)?.documento ?? "Documento"} inválido.` });
  }
  if (temCnpj && cnpjValido(f.documento) && !f.cnpj_consultado_em) {
    alertas.push({ codigo: "FORNECEDOR_NAO_CONSULTADO", nivel: "info", texto: f.cnpj_erro ? `A consulta do CNPJ falhou: ${f.cnpj_erro}` : "CNPJ ainda não consultado na Receita." });
  }
  if (f.situacao_cadastral && f.situacao_cadastral !== "ATIVA") {
    const desde = f.data_situacao ? ` desde ${dataCurta(f.data_situacao)}` : "";
    alertas.push({ codigo: "FORNECEDOR_SITUACAO", nivel: "alerta", texto: `CNPJ ${f.situacao_cadastral.toLowerCase()} na Receita${desde}.` });
  }
  if (f.tipo_pessoa === "pj" && f.opcao_mei === true) {
    alertas.push({ codigo: "FORNECEDOR_TIPO", nivel: "info", texto: "A Receita indica que é MEI; troque o tipo para MEI." });
  } else if (f.tipo_pessoa === "mei" && f.opcao_mei === false) {
    alertas.push({ codigo: "FORNECEDOR_TIPO", nivel: "info", texto: "A Receita não indica MEI; troque o tipo para pessoa jurídica." });
  }
  if (f.sancoes_situacao === "consta") {
    const onde = (f.sancoes ?? []).filter(s => s.resultado === "consta").map(s => s.descricao || s.tipo || s.emissor).filter(Boolean);
    alertas.push({ codigo: "FORNECEDOR_SANCIONADO", nivel: "alerta", texto: `Consta em cadastro de sanções${onde.length ? `: ${onde.join("; ")}` : ""}.` });
  } else if (temCnpj && f.sancoes_situacao === "a_conferir") {
    alertas.push({ codigo: "FORNECEDOR_SANCOES_A_CONFERIR", nivel: "alerta", texto: "A consulta de sanções voltou sem resultado claro; confira as certidões." });
  } else if (temCnpj && f.sancoes_situacao === "indisponivel") {
    alertas.push({ codigo: "FORNECEDOR_SANCOES_A_CONFERIR", nivel: "info", texto: "A consulta de sanções do TCU não respondeu; tente de novo mais tarde." });
  }
  const consultas = [f.cnpj_consultado_em, f.sancoes_consultadas_em].filter((d): d is string => Boolean(d)).sort();
  const maisAntiga = consultas[0];
  if (maisAntiga && (hoje.getTime() - new Date(maisAntiga).getTime()) / 86_400_000 > DIAS_VALIDADE_CONSULTA) {
    alertas.push({ codigo: "FORNECEDOR_CONSULTA_ANTIGA", nivel: "info", texto: `Consulta de ${dataCurta(maisAntiga)}; consulte de novo antes de usar na prestação.` });
  }
  if (f.parte_relacionada) {
    const relacao = TIPOS_RELACAO.find(r => r.id === f.tipo_relacao)?.rotulo;
    alertas.push({ codigo: "PARTE_RELACIONADA", nivel: "info", texto: `Parte relacionada ao proponente${relacao ? ` (${relacao.toLowerCase()})` : ""}: entra no limite conjunto do regime.` });
  }
  return alertas;
}

// ─── Comprovantes do fornecedor (P2.3b) ─────────────────────────────────────

export type TipoDocumentoFornecedor = PrestacaoFornecedorDocumento["tipo"];

export const ROTULOS_DOCUMENTO_FORNECEDOR: Record<TipoDocumentoFornecedor, string> = {
  certidao_tcu: "Certidão do TCU (sanções)",
  consulta_receita: "Comprovante da consulta pública",
  cartao_cnpj: "Cartão CNPJ",
  certidao: "Certidão",
  outro: "Outro documento",
};

/** O que a pessoa pode anexar; a certidão do TCU e o comprovante da consulta vêm só da função. */
export const TIPOS_ANEXO_FORNECEDOR: TipoDocumentoFornecedor[] = ["cartao_cnpj", "certidao", "outro"];

export const ANEXO_FORNECEDOR_ACEITO = "application/pdf,image/png,image/jpeg,image/webp";
export const TAMANHO_MAXIMO_ANEXO_FORNECEDOR = 10 * 1024 * 1024;

/** Emissão do Comprovante de Inscrição e de Situação Cadastral (cartão CNPJ), com captcha: a pessoa baixa e anexa. */
export const URL_CARTAO_CNPJ_RECEITA = "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp";

/** Recusa o arquivo antes de enviar; null quando está tudo certo. */
export function problemaDoAnexo(arquivo: { name: string; type: string; size: number }): string | null {
  const aceitos = ANEXO_FORNECEDOR_ACEITO.split(",");
  const pdfPeloNome = /\.pdf$/i.test(arquivo.name) && (arquivo.type === "" || arquivo.type === "application/octet-stream");
  if (!aceitos.includes(arquivo.type) && !pdfPeloNome) return "Envie um PDF ou uma imagem (PNG, JPG ou WebP).";
  if (arquivo.size === 0) return "O arquivo está vazio.";
  if (arquivo.size > TAMANHO_MAXIMO_ANEXO_FORNECEDOR) return "O arquivo passa de 10 MB.";
  return null;
}

/** PJ e MEI sem cartão CNPJ anexado: a consulta pública não substitui o cartão emitido pela Receita. */
export function faltaCartaoCnpj(
  fornecedor: Pick<PrestacaoFornecedor, "tipo_pessoa" | "documento">,
  documentos: readonly Pick<PrestacaoFornecedorDocumento, "tipo">[],
): boolean {
  return (fornecedor.tipo_pessoa === "pj" || fornecedor.tipo_pessoa === "mei")
    && cnpjValido(fornecedor.documento)
    && !documentos.some(d => d.tipo === "cartao_cnpj");
}

export function extensaoDoAnexo(arquivo: { name: string; type: string }): string {
  const porTipo: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  return porTipo[arquivo.type] ?? (/\.pdf$/i.test(arquivo.name) ? "pdf" : "bin");
}
