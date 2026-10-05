// Dados públicos de fornecedor (P2.3): validação de CPF e CNPJ (inclusive o
// CNPJ alfanumérico, que vale desde julho de 2026), leitura da consulta do
// CNPJ na BrasilAPI e da consulta consolidada de pessoa jurídica do TCU
// (inidôneos do TCU, improbidade no CNJ, CEIS e CNEP da CGU).
//
// Fonte única para o app (via lib/prestacao/fornecedores.ts) e para a função
// consultar-fornecedor. Sem imports, para rodar igual no Deno, no Node e no
// navegador.

/** Só letras e algarismos, em maiúsculas: a forma em que o documento é guardado. */
export function limparDocumento(valor: unknown): string {
  return String(valor ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** Dígito do CNPJ: cada caractere vale o código ASCII menos 48 (de "0" a "9" e de "A" a "Z"), pesos 2 a 9 da direita. */
function digitoCnpj(base: string): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) {
    soma += (base.charCodeAt(i) - 48) * (2 + ((base.length - 1 - i) % 8));
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** CNPJ numérico ou alfanumérico (12 letras ou algarismos e 2 dígitos verificadores). */
export function cnpjValido(valor: unknown): boolean {
  const cnpj = limparDocumento(valor);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const primeiro = digitoCnpj(cnpj.slice(0, 12));
  const segundo = digitoCnpj(cnpj.slice(0, 12) + primeiro);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

export function cpfValido(valor: unknown): boolean {
  const cpf = limparDocumento(valor);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
    return ((soma * 10) % 11) % 10;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** CNAE em sete algarismos ("9001901") no formato da Receita ("9001-9/01"). */
export function formatarCnae(codigo: unknown): string | null {
  const algarismos = String(codigo ?? "").replace(/\D/g, "");
  if (!algarismos || /^0+$/.test(algarismos)) return null;
  const c = algarismos.padStart(7, "0");
  return `${c.slice(0, 4)}-${c.slice(4, 5)}/${c.slice(5, 7)}`;
}

const texto = (valor: unknown) => (typeof valor === "string" && valor.trim() ? valor.trim() : null);
const data = (valor: unknown) => {
  const t = texto(valor);
  return t && /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null;
};
const lista = (valor: unknown) => (Array.isArray(valor) ? valor : []) as Record<string, unknown>[];
const semAcento = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export type Socio = { nome: string; qualificacao: string | null; documento: string | null; entrada: string | null };

export type DadosCnpj = {
  razao_social: string | null;
  nome_fantasia: string | null;
  /** Como a Receita escreve: ATIVA, BAIXADA, INAPTA, SUSPENSA ou NULA. */
  situacao_cadastral: string | null;
  data_situacao: string | null;
  data_abertura: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  cnaes_secundarios: { codigo: string; descricao: string }[];
  natureza_juridica: string | null;
  porte: string | null;
  opcao_mei: boolean | null;
  uf: string | null;
  municipio: string | null;
  /** O CPF do sócio já vem mascarado pela Receita ("***123456**"). */
  socios: Socio[];
};

/** Resposta de GET brasilapi.com.br/api/cnpj/v1/{cnpj} nos campos que a prestação usa. */
export function lerCnpjBrasilApi(bruto: unknown): DadosCnpj {
  const r = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  return {
    razao_social: texto(r.razao_social),
    nome_fantasia: texto(r.nome_fantasia),
    situacao_cadastral: texto(r.descricao_situacao_cadastral)?.toUpperCase() ?? null,
    data_situacao: data(r.data_situacao_cadastral),
    data_abertura: data(r.data_inicio_atividade),
    cnae_principal: formatarCnae(r.cnae_fiscal),
    cnae_descricao: texto(r.cnae_fiscal_descricao),
    cnaes_secundarios: lista(r.cnaes_secundarios)
      .map(c => ({ codigo: formatarCnae(c.codigo), descricao: texto(c.descricao) ?? "" }))
      .filter((c): c is { codigo: string; descricao: string } => c.codigo !== null),
    natureza_juridica: texto(r.natureza_juridica),
    porte: texto(r.porte),
    opcao_mei: typeof r.opcao_pelo_mei === "boolean" ? r.opcao_pelo_mei : null,
    uf: texto(r.uf),
    municipio: texto(r.municipio),
    socios: lista(r.qsa)
      .map(s => ({
        nome: texto(s.nome_socio) ?? "",
        qualificacao: texto(s.qualificacao_socio),
        documento: texto(s.cnpj_cpf_do_socio),
        entrada: data(s.data_entrada_sociedade),
      }))
      .filter(s => s.nome),
  };
}

export type ResultadoCertidao = "nada_consta" | "consta" | "a_conferir";
export type SituacaoSancoes = ResultadoCertidao | "indisponivel";

export type Certidao = {
  emissor: string | null;
  tipo: string | null;
  descricao: string | null;
  situacao: string | null;
  observacao: string | null;
  emitida_em: string | null;
  resultado: ResultadoCertidao;
};

/**
 * O TCU não documenta os valores de "situacao". Só "nada consta" e "consta"
 * escritos de forma clara viram resultado; o resto fica para a pessoa
 * conferir, com o texto original à vista.
 */
function resultadoDaCertidao(situacao: string | null): ResultadoCertidao {
  const alvo = semAcento(situacao ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (/^(nada consta|nao consta)\b/.test(alvo)) return "nada_consta";
  if (/^consta\b/.test(alvo)) return "consta";
  return "a_conferir";
}

/** Resposta de GET certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/{cnpj}. */
export function lerCertidoesTcu(bruto: unknown): { certidoes: Certidao[]; situacao: SituacaoSancoes } {
  const r = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const certidoes = lista(r.certidoes).map(c => {
    const situacao = texto(c.situacao);
    return {
      emissor: texto(c.emissor),
      tipo: texto(c.tipo),
      descricao: texto(c.descricao),
      situacao,
      observacao: texto(c.observacao),
      emitida_em: texto(c.dataHoraEmissao),
      resultado: resultadoDaCertidao(situacao),
    };
  });
  return { certidoes, situacao: resumoDasCertidoes(certidoes) };
}

/** Uma certidão com "consta" basta; "nada consta" só quando todas dizem isso. */
export function resumoDasCertidoes(certidoes: readonly Pick<Certidao, "resultado">[]): ResultadoCertidao {
  if (certidoes.some(c => c.resultado === "consta")) return "consta";
  if (certidoes.length > 0 && certidoes.every(c => c.resultado === "nada_consta")) return "nada_consta";
  return "a_conferir";
}
