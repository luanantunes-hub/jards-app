// Os dados que o Asaas exige do titular de uma subconta, e a conferência deles. Sem nenhum import de servidor (nada de node:*): o formulário de
// cadastro (cliente) e a rota (servidor) conferem com as MESMAS regras. O que o Asaas faz com eles está em asaas-subconta.ts.

export type TipoDeEmpresa = "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
export const TIPOS_DE_EMPRESA: readonly TipoDeEmpresa[] = ["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"];

/** Os dados que o Asaas exige do titular da subconta. CPF: precisa da data de nascimento. CNPJ: precisa do tipo de empresa. */
export type DadosDoProdutor = {
  nome: string;
  email: string;
  /** Só os números: 11 (CPF) ou 14 (CNPJ). */
  cpf_cnpj: string;
  /** AAAA-MM-DD, só para CPF. */
  data_nascimento?: string | null;
  tipo_empresa?: TipoDeEmpresa | null;
  /** Celular com DDD, só os números (11 dígitos). */
  celular: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  /** Faturamento ou renda mensal, em centavos (o Asaas exige). */
  renda_mensal_centavos: number;
};

const apenasNumeros = (texto: string) => texto.replace(/\D/g, "");

/** Confere os dados antes de chamar o Asaas. Devolve as frases dos problemas (vazio: pode seguir). */
export function problemasDosDados(dados: DadosDoProdutor): string[] {
  const erros: string[] = [];
  const documento = apenasNumeros(dados.cpf_cnpj ?? "");
  if (!dados.nome || dados.nome.trim().length < 2 || dados.nome.length > 200 || /\d/.test(dados.nome)) erros.push("nome: sem números, de 2 a 200 letras");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email ?? "") || dados.email.length > 200) erros.push("e-mail inválido");
  if (documento.length !== 11 && documento.length !== 14) erros.push("CPF ou CNPJ inválido");
  if (documento.length === 11 && !/^\d{4}-\d{2}-\d{2}$/.test(dados.data_nascimento ?? "")) erros.push("data de nascimento (AAAA-MM-DD) é obrigatória para CPF");
  if (documento.length === 14 && !TIPOS_DE_EMPRESA.includes(dados.tipo_empresa as TipoDeEmpresa)) erros.push("tipo de empresa é obrigatório para CNPJ");
  if (apenasNumeros(dados.celular ?? "").length !== 11) erros.push("celular com DDD (11 números)");
  if (apenasNumeros(dados.cep ?? "").length !== 8) erros.push("CEP com 8 números");
  for (const [campo, valor] of [["endereço", dados.endereco], ["número", dados.numero], ["bairro", dados.bairro]] as const) if (!valor || valor.trim() === "" || valor.length > 150) erros.push(`${campo} é obrigatório`);
  if (!Number.isInteger(dados.renda_mensal_centavos) || dados.renda_mensal_centavos <= 0) erros.push("faturamento mensal maior que zero");
  return erros;
}


/** A conta bancária do produtor, para onde (e só para onde) o Jards aprova saque: banco (3 números), agência, conta e dígito. */
export type ContaBancaria = { banco: string; agencia: string; conta: string; digito?: string | null };

/** Confere a conta bancária antes de gravar. Devolve as frases dos problemas (vazio: pode seguir). */
export function problemasDaContaBancaria(c: ContaBancaria): string[] {
  const erros: string[] = [];
  const numeros = (t: string) => (t ?? "").replace(/\D/g, "");
  if (numeros(c.banco).length !== 3) erros.push("banco com 3 números");
  if (numeros(c.agencia).length < 1 || numeros(c.agencia).length > 6) erros.push("agência de 1 a 6 números");
  if (numeros(c.conta).length < 1 || numeros(c.conta).length > 15) erros.push("conta de 1 a 15 números");
  if (c.digito != null && c.digito !== "" && !/^[0-9A-Za-z]{1,2}$/.test(c.digito.trim())) erros.push("dígito de 1 ou 2 caracteres");
  return erros;
}

