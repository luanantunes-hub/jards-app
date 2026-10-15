// As duas chamadas ao banco das permissões da produção (PD0.7b): ler as funções
// da organização e dar a função a uma pessoa. A lógica fica em permissoes.ts.
//
// fn_producao_definir_funcao decide pela sessão de quem está logado (auth.uid()),
// então a chamada usa o cliente do navegador, nunca a chave de serviço, e só o
// administrador da organização passa. O navegador só lê `producao_funcoes`
// (a própria linha, ou todas se for admin da organização); não há outra escrita.

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

/** Falha de rede ou de leitura: quem chama não deve oferecer a edição com dados que não leu. */
export async function carregarFuncoes(
  cliente: ClienteDasPermissoes,
  organizationId: string,
): Promise<{ ok: true; funcoes: FuncoesPorPessoa } | { ok: false }> {
  try {
    const { data, error } = await cliente
      .from("producao_funcoes")
      .select("user_id, dinheiro, alcada, escopo")
      .eq("organization_id", organizationId);
    return error ? { ok: false } : { ok: true, funcoes: lerFuncoes(data) };
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
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const { error } = await cliente.rpc("fn_producao_definir_funcao", {
      p_org: organizationId,
      p_user: userId,
      p_dinheiro: pedido.dinheiro,
      p_alcada: pedido.alcada,
      p_escopo: pedido.escopo,
    });
    return error ? { ok: false, erro: mensagemErroPermissoes(error) } : { ok: true };
  } catch {
    return { ok: false, erro: MENSAGEM_ERRO_DAS_PERMISSOES };
  }
}
