// A tela Recebimentos (cadastro da conta que recebe o valor das vendas): os bancos, as máscaras do formulário, o corpo que vai para a rota
// `POST /api/ticketeria/lojas/{id}/conta-asaas` e as frases dos erros. Sem nenhum import de servidor: roda no navegador e nos testes.

import { problemasDaContaBancaria, problemasDosDados, type ContaBancaria, type DadosDoProdutor, type TipoDeEmpresa } from "@/lib/ticketeria/pagamento/dados-do-produtor";

export type Banco = { codigo: string; nome: string };

/** Os bancos mais usados. Outro banco: o produtor escolhe "Outro banco" e digita o código de 3 números. */
export const BANCOS: readonly Banco[] = [
  { codigo: "001", nome: "Banco do Brasil" }, { codigo: "033", nome: "Santander" }, { codigo: "077", nome: "Inter" }, { codigo: "104", nome: "Caixa" },
  { codigo: "208", nome: "BTG Pactual" }, { codigo: "212", nome: "Original" }, { codigo: "237", nome: "Bradesco" }, { codigo: "260", nome: "Nubank" },
  { codigo: "290", nome: "PagBank" }, { codigo: "323", nome: "Mercado Pago" }, { codigo: "336", nome: "C6 Bank" }, { codigo: "341", nome: "Itaú" },
  { codigo: "403", nome: "Cora" }, { codigo: "422", nome: "Safra" }, { codigo: "748", nome: "Sicredi" }, { codigo: "756", nome: "Sicoob" },
];
export const OUTRO_BANCO = "outro";

export const somenteNumeros = (texto: string) => texto.replace(/\D/g, "");

/** CPF (11 números) ou CNPJ (14), com pontos e traço enquanto se digita. */
export function mascararDocumento(texto: string): string {
  const d = somenteNumeros(texto).slice(0, 14);
  if (d.length <= 11) return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4").replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

export function mascararCelular(texto: string): string {
  const d = somenteNumeros(texto).slice(0, 11);
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/^(\(\d{2}\) \d{5})(\d)/, "$1-$2");
}

export function mascararCep(texto: string): string {
  return somenteNumeros(texto).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

/** Dinheiro digitado como numa maquininha: só os números contam, e os dois últimos são os centavos. */
export function centavosDoTexto(texto: string): number {
  const d = somenteNumeros(texto).slice(0, 11);
  return d === "" ? 0 : Number(d);
}
export function formatarMoeda(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type FormularioDaConta = {
  nome: string; documento: string; tipoDeEmpresa: TipoDeEmpresa | ""; nascimento: string; email: string; celular: string; faturamento: string;
  cep: string; endereco: string; numero: string; bairro: string; complemento: string;
  banco: string; codigoDoOutroBanco: string; agencia: string; conta: string; digito: string;
};

export const FORMULARIO_VAZIO: FormularioDaConta = {
  nome: "", documento: "", tipoDeEmpresa: "", nascimento: "", email: "", celular: "", faturamento: "",
  cep: "", endereco: "", numero: "", bairro: "", complemento: "", banco: "", codigoDoOutroBanco: "", agencia: "", conta: "", digito: "",
};

/** CPF tem 11 números: pede a data de nascimento. Qualquer outro tamanho pede o tipo de empresa (só o CNPJ de 14 exige de fato). */
export const ehCpf = (documento: string) => somenteNumeros(documento).length === 11;

/** O código do banco escolhido: o da lista ou o digitado em "Outro banco". */
export const codigoDoBanco = (f: FormularioDaConta) => (f.banco === OUTRO_BANCO ? somenteNumeros(f.codigoDoOutroBanco) : f.banco);

export type CorpoDoCadastro = DadosDoProdutor & { conta_bancaria: ContaBancaria };

/** O corpo da rota, no formato que ela confere (a mesma conferência vale aqui, antes do envio). */
export function corpoDoCadastro(f: FormularioDaConta): CorpoDoCadastro {
  const cpf = ehCpf(f.documento);
  return {
    nome: f.nome.trim(), email: f.email.trim(), cpf_cnpj: somenteNumeros(f.documento),
    ...(cpf ? { data_nascimento: f.nascimento || null } : { tipo_empresa: (f.tipoDeEmpresa || null) as TipoDeEmpresa | null }),
    celular: somenteNumeros(f.celular), cep: somenteNumeros(f.cep), endereco: f.endereco.trim(), numero: f.numero.trim(), bairro: f.bairro.trim(),
    complemento: f.complemento.trim() === "" ? null : f.complemento.trim(), renda_mensal_centavos: centavosDoTexto(f.faturamento),
    conta_bancaria: { banco: codigoDoBanco(f), agencia: somenteNumeros(f.agencia), conta: somenteNumeros(f.conta), digito: f.digito.trim() === "" ? null : f.digito.trim() },
  };
}

/** Os problemas do formulário, em frases (vazio: pode enviar). */
export function problemasDoFormulario(f: FormularioDaConta): string[] {
  const corpo = corpoDoCadastro(f);
  return [...problemasDosDados(corpo), ...problemasDaContaBancaria(corpo.conta_bancaria)];
}

/** Os erros da rota (e os códigos que o Asaas devolve) em frases para a pessoa. */
export function mensagemDoErroDoCadastro(status: number, erro: string | undefined, codigos: readonly string[] = [], problemas: readonly string[] = []): string {
  if (erro === "dados_invalidos" && problemas.length > 0) return `Confira: ${problemas.join("; ")}.`;
  if (erro === "asaas_nao_configurado") return "O recebimento ainda não está disponível. Fale com o suporte do Jards.";
  if (erro === "conta_ja_cadastrada") return "Esta loja já tem uma conta cadastrada. Recarregue a página.";
  if (erro === "sem_permissao" || status === 403) return "Você não pode cadastrar a conta desta loja.";
  if (erro === "muitas_tentativas" || status === 429) return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (erro === "asaas_recusou") {
    if (codigos.includes("invalid_mobilePhone")) return "O celular informado é inválido.";
    if (codigos.includes("invalid_cpfCnpj")) return "O CPF ou CNPJ não foi aceito. Confira os números.";
    if (codigos.includes("invalid_email")) return "O e-mail não foi aceito.";
    if (codigos.includes("invalid_postalCode")) return "O CEP não foi aceito.";
    if (codigos.includes("invalid_object")) return "O Asaas recusou o cadastro. Confira os dados e tente de novo mais tarde.";
    return "O Asaas recusou os dados. Confira o cadastro e tente de novo.";
  }
  if (erro === "cadastro_incompleto") return "O cadastro ficou pela metade. Fale com o suporte do Jards antes de tentar de novo.";
  return "Não foi possível cadastrar a conta. Tente de novo.";
}

/** "Banco do Brasil · 0001 · 123456-7" a partir do que está gravado. */
export function resumoDaContaDeSaque(c: { banco_codigo: string | null; agencia: string | null; conta: string | null; conta_digito: string | null }): string | null {
  if (!c.banco_codigo || !c.agencia || !c.conta) return null;
  const banco = BANCOS.find(b => b.codigo === c.banco_codigo)?.nome ?? `Banco ${c.banco_codigo}`;
  return `${banco} · ${c.agencia} · ${c.conta}${c.conta_digito ? `-${c.conta_digito}` : ""}`;
}
