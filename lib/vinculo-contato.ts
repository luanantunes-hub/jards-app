// Quando concluir uma atividade pode registrar o contato (uma interação no histórico).
// A mesma regra vale no banco, em fn_concluir_atividade_com_interacao.

export type VinculosDaAtividade = {
  captacao_id?: string | null;
  empresa_crm_id?: string | null;
  proponente_id?: string | null;
  conta_patrocinio_id?: string | null;
};

/**
 * O contato fica no histórico de quem foi contatado: a negociação, a empresa, o proponente ou a conta.
 * Basta um desses vínculos; inscrição, projeto e contrato sozinhos não dizem com quem se falou.
 */
export function podeRegistrarContato(atividade: VinculosDaAtividade): boolean {
  return Boolean(
    atividade.captacao_id || atividade.empresa_crm_id || atividade.proponente_id || atividade.conta_patrocinio_id,
  );
}
