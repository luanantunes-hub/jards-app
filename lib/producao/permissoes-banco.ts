// As duas chamadas ao banco das permissões da produção (PD0.7b): ler as funções
// da organização e dar a função a uma pessoa. A lógica fica em permissoes.ts.
//
// fn_producao_definir_funcao decide pela sessão de quem está logado (auth.uid()),
// então a chamada usa o cliente do navegador, nunca a chave de serviço, e só o
// administrador da organização passa. O navegador só lê `producao_funcoes`
// (a própria linha, ou todas se for admin da organização); não há outra escrita.
//
// As duas chamadas têm prazo: sem ele, uma conexão que pendura deixa o modal em
// "Salvando…" (ou o botão esperando a leitura) até a pessoa recarregar a página.
// Passado o prazo a tela mostra o erro comum e deixa tentar de novo; a chamada
// que ficou para trás pode ainda chegar ao banco, o que é seguro: gravar a mesma
// função duas vezes dá o mesmo resultado.

import {
  lerFuncoes,
  mensagemErroPermissoes,
  MENSAGEM_ERRO_DAS_PERMISSOES,
  type FuncoesPorPessoa,
  type PedidoDePermissoes,
} from "@/lib/producao/permissoes";

type ErroDoBanco = { message?: string | null; code?: string | null };
type Retorno = PromiseLike<{ data: unknown; error: ErroDoBanco | null }>;

/** Os argumentos de fn_producao_definir_funcao; `p_alcada` nula = a pessoa não aprova. */
export type ArgumentosDaFuncao = {
  p_org: string;
  p_user: string;
  p_dinheiro: boolean;
  p_alcada: number | null;
  p_escopo: PedidoDePermissoes["escopo"];
};

/**
 * O pedaço do cliente do Supabase que estas chamadas usam. A tabela e a função
 * da produção ainda não estão nos tipos gerados (lib/supabase/types.ts); o
 * cliente tipado vem na PD0.11. Quem chama converte o cliente do navegador:
 * `createClient() as unknown as ClienteDasPermissoes`.
 */
export type ClienteDasPermissoes = {
  from(tabela: "producao_funcoes"): {
    select(colunas: string): { eq(coluna: string, valor: string): Retorno };
  };
  rpc(nome: "fn_producao_definir_funcao", argumentos: ArgumentosDaFuncao): Retorno;
};

/** Quanto esperar a leitura e a gravação, em milissegundos. */
export const PRAZO_DA_LEITURA_MS = 15_000;
export const PRAZO_DA_GRAVACAO_MS = 30_000;

const PRAZO_ESGOTADO = Symbol("prazo esgotado");

/** Espera a operação até o prazo; o relógio é desligado quando ela termina, para não sobrar espera pendurada. */
async function comPrazo<T>(operacao: PromiseLike<T>, prazoMs: number): Promise<T | typeof PRAZO_ESGOTADO> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<typeof PRAZO_ESGOTADO>(resolver => {
    relogio = setTimeout(() => resolver(PRAZO_ESGOTADO), prazoMs);
  });
  try {
    return await Promise.race([operacao, prazo]);
  } finally {
    clearTimeout(relogio);
  }
}

/** Falha de rede, de leitura ou de prazo: quem chama não deve oferecer a edição com dados que não leu. */
export async function carregarFuncoes(
  cliente: ClienteDasPermissoes,
  organizationId: string,
  prazoMs: number = PRAZO_DA_LEITURA_MS,
): Promise<{ ok: true; funcoes: FuncoesPorPessoa } | { ok: false }> {
  try {
    const resposta = await comPrazo(
      cliente.from("producao_funcoes").select("user_id, dinheiro, alcada, escopo").eq("organization_id", organizationId),
      prazoMs,
    );
    if (resposta === PRAZO_ESGOTADO || resposta.error) return { ok: false };
    return { ok: true, funcoes: lerFuncoes(resposta.data) };
  } catch {
    return { ok: false };
  }
}

/** Dá a função à pessoa; a mensagem de erro já vem em português para a tela. */
export async function definirFuncao(
  cliente: ClienteDasPermissoes,
  organizationId: string,
  userId: string,
  pedido: PedidoDePermissoes,
  prazoMs: number = PRAZO_DA_GRAVACAO_MS,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const resposta = await comPrazo(
      cliente.rpc("fn_producao_definir_funcao", {
        p_org: organizationId,
        p_user: userId,
        p_dinheiro: pedido.dinheiro,
        p_alcada: pedido.alcada,
        p_escopo: pedido.escopo,
      }),
      prazoMs,
    );
    if (resposta === PRAZO_ESGOTADO) return { ok: false, erro: MENSAGEM_ERRO_DAS_PERMISSOES };
    return resposta.error ? { ok: false, erro: mensagemErroPermissoes(resposta.error) } : { ok: true };
  } catch {
    return { ok: false, erro: MENSAGEM_ERRO_DAS_PERMISSOES };
  }
}
