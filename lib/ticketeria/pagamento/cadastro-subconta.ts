// O cadastro da subconta de uma loja: cria no Asaas, GUARDA A CHAVE NA HORA (ela aparece uma vez), cria a chave Pix e confere a situação.
// As portas do banco são injetadas: a lógica é testada sem rede e sem banco (tests/ticketeria-cadastro-subconta.test.ts).

import type { DadosDoProdutor, SituacaoDaSubconta, SubcontasAsaas } from "@/lib/ticketeria/pagamento/asaas-subconta";

export type PortasDoCadastro = {
  /** fn_ticketeria_registrar_conta_asaas: guarda a chave no Vault e grava a subconta da loja. */
  registrar(loja: string, conta: { asaas_account_id: string; wallet_id: string; cpf_cnpj: string; chave: string; situacao: SituacaoDaSubconta }): Promise<void>;
  /** fn_ticketeria_situacao_da_conta_asaas. */
  atualizarSituacao(loja: string, situacao: SituacaoDaSubconta): Promise<void>;
  /** fn_ticketeria_definir_conta_destino: a única conta bancária para a qual o Jards aprova saque desta subconta. */
  definirContaDestino(loja: string, conta: ContaBancaria): Promise<void>;
};

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

/** O cadastro quebrou DEPOIS de o Asaas criar a subconta e não deu para guardar a chave: a subconta existe no Asaas e precisa de resgate à mão. */
export class SubcontaSemChaveGuardada extends Error {
  constructor(readonly asaas_account_id: string, causa: string) {
    super(`a subconta ${asaas_account_id} foi criada no Asaas, mas a chave não foi guardada (${causa}): resgatar à mão`);
    this.name = "SubcontaSemChaveGuardada";
  }
}

export type ResultadoDoCadastro = { asaas_account_id: string; wallet_id: string; situacao: SituacaoDaSubconta; chave_pix: "criada" | "pendente"; conta_destino: "definida" | "pendente" };

export async function cadastrarSubconta(entrada: { loja: string; dados: DadosDoProdutor; asaas: SubcontasAsaas; portas: PortasDoCadastro; contaBancaria?: ContaBancaria | null }): Promise<ResultadoDoCadastro> {
  const { loja, dados, asaas, portas, contaBancaria } = entrada;
  const criada = await asaas.criarSubconta(dados);
  const documento = dados.cpf_cnpj.replace(/\D/g, "");
  // A chave aparece uma vez: guarda na hora, com uma nova tentativa. A mensagem do erro nunca leva a chave.
  let guardada = false;
  let causa = "";
  for (let tentativa = 1; tentativa <= 2 && !guardada; tentativa++) {
    try {
      await portas.registrar(loja, { asaas_account_id: criada.asaas_account_id, wallet_id: criada.wallet_id, cpf_cnpj: documento, chave: criada.chave, situacao: "pendente" });
      guardada = true;
    } catch (erro) {
      causa = erro instanceof Error ? erro.message.replace(criada.chave, "[chave]") : "erro";
    }
  }
  if (!guardada) throw new SubcontaSemChaveGuardada(criada.asaas_account_id, causa);

  // A conta de destino do saque: sem ela, nenhum saque desta subconta é aprovado. Se falhar, a subconta já existe e fica "pendente" (define-se depois).
  let contaDestino: ResultadoDoCadastro["conta_destino"] = "pendente";
  if (contaBancaria) {
    try { await portas.definirContaDestino(loja, contaBancaria); contaDestino = "definida"; } catch { /* segue: a subconta existe e a chave está guardada */ }
  }

  let chavePix: ResultadoDoCadastro["chave_pix"] = "pendente";
  try { await asaas.criarChavePix(criada.chave); chavePix = "criada"; } catch { /* o Asaas cria a chave sozinho no primeiro QR; o adaptador de cobrança tenta de novo */ }
  let situacao: SituacaoDaSubconta = "pendente";
  try {
    situacao = await asaas.situacao(criada.chave);
    if (situacao !== "pendente") await portas.atualizarSituacao(loja, situacao);
  } catch { /* fica pendente: a situação se confere depois */ }
  return { asaas_account_id: criada.asaas_account_id, wallet_id: criada.wallet_id, situacao, chave_pix: chavePix, conta_destino: contaDestino };
}
