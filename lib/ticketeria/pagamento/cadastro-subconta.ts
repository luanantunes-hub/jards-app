// O cadastro da subconta de uma loja: cria no Asaas, GUARDA A CHAVE NA HORA (ela aparece uma vez), cria a chave Pix e confere a situação.
// As portas do banco são injetadas: a lógica é testada sem rede e sem banco (tests/ticketeria-cadastro-subconta.test.ts).

import type { DadosDoProdutor, SituacaoDaSubconta, SubcontasAsaas } from "@/lib/ticketeria/pagamento/asaas-subconta";

export type PortasDoCadastro = {
  /** fn_ticketeria_registrar_conta_asaas: guarda a chave no Vault e grava a subconta da loja. */
  registrar(loja: string, conta: { asaas_account_id: string; wallet_id: string; cpf_cnpj: string; chave: string; situacao: SituacaoDaSubconta }): Promise<void>;
  /** fn_ticketeria_situacao_da_conta_asaas. */
  atualizarSituacao(loja: string, situacao: SituacaoDaSubconta): Promise<void>;
};

/** O cadastro quebrou DEPOIS de o Asaas criar a subconta e não deu para guardar a chave: a subconta existe no Asaas e precisa de resgate à mão. */
export class SubcontaSemChaveGuardada extends Error {
  constructor(readonly asaas_account_id: string, causa: string) {
    super(`a subconta ${asaas_account_id} foi criada no Asaas, mas a chave não foi guardada (${causa}): resgatar à mão`);
    this.name = "SubcontaSemChaveGuardada";
  }
}

export type ResultadoDoCadastro = { asaas_account_id: string; wallet_id: string; situacao: SituacaoDaSubconta; chave_pix: "criada" | "pendente" };

export async function cadastrarSubconta(entrada: { loja: string; dados: DadosDoProdutor; asaas: SubcontasAsaas; portas: PortasDoCadastro }): Promise<ResultadoDoCadastro> {
  const { loja, dados, asaas, portas } = entrada;
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

  let chavePix: ResultadoDoCadastro["chave_pix"] = "pendente";
  try { await asaas.criarChavePix(criada.chave); chavePix = "criada"; } catch { /* o Asaas cria a chave sozinho no primeiro QR; o adaptador de cobrança tenta de novo */ }
  let situacao: SituacaoDaSubconta = "pendente";
  try {
    situacao = await asaas.situacao(criada.chave);
    if (situacao !== "pendente") await portas.atualizarSituacao(loja, situacao);
  } catch { /* fica pendente: a situação se confere depois */ }
  return { asaas_account_id: criada.asaas_account_id, wallet_id: criada.wallet_id, situacao, chave_pix: chavePix };
}
