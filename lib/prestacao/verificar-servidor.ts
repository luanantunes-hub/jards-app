// Roda o motor de checagens (lib/prestacao/checagens) numa prestação e grava os achados em prestacao_verificacoes
// por fn_prestacao_verificacoes_sincronizar, que só o service role executa. É um caminho só para o app
// (POST /api/prestacoes/[id]/verificar) e para o conector do Claude e do ChatGPT (rodar_verificacoes).
//
// Quem chama confere o acesso antes: aqui o estado é lido com o service role, para o resultado não depender
// do que cada papel enxerga.

import { executarChecagens } from "@/lib/prestacao/checagens";
import { estadoDaPrestacao, type ClienteDoEstado } from "@/lib/prestacao/checagens/estado";

type ClienteComRpc = ClienteDoEstado & {
  rpc: (nome: string, argumentos: unknown) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type ResumoDaVerificacao = {
  abertas: number;
  bloqueios: number;
  avisos: number;
  justificadas: number;
  dispensadas: number;
  resolvidas: number;
  verificada_em: string;
};

/** Verifica a prestação e devolve as contagens de depois da sincronização, mais quantos achados o motor encontrou. */
export async function verificarPrestacao(db: ClienteComRpc, prestacaoId: string): Promise<ResumoDaVerificacao & { achados: number }> {
  const achados = executarChecagens(await estadoDaPrestacao(db, prestacaoId));
  const { data, error } = await db.rpc("fn_prestacao_verificacoes_sincronizar", {
    p_prestacao_id: prestacaoId,
    p_achados: achados.map(a => ({
      chave: a.chave,
      codigo: a.codigo,
      severidade: a.severidade,
      resultado: a.resultado,
      entidade_tipo: a.entidade.tipo,
      entidade_id: a.entidade.id,
      mensagem: a.mensagem,
      fonte: a.fonte,
      dados: a.dados,
      justificativa: a.justificativa,
    })),
  });
  if (error) throw new Error(error.message);
  return { ...(data as ResumoDaVerificacao), achados: achados.length };
}
