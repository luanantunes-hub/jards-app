type FollowupSource = {
  captacao_id?: string | null;
  captacao?: object | null;
  conta_patrocinio_id?: string | null;
  conta_patrocinio?: object | null;
  proponente_id?: string | null;
  proponente?: object | null;
  empresa_crm_id?: string | null;
  empresa_crm?: object | null;
};

// An ID alone is not enough: the related row may have been removed or be inaccessible.
export function followupSourceLink(row: FollowupSource): string | undefined {
  if (row.captacao_id && row.captacao) return `/captacoes/${row.captacao_id}?tab=relacionamento`;
  if (row.conta_patrocinio_id && row.conta_patrocinio) return `/contas-patrocinio/${row.conta_patrocinio_id}?tab=relationship`;
  if (row.proponente_id && row.proponente) return `/proponentes/${row.proponente_id}?tab=relationship`;
  if (row.empresa_crm_id && row.empresa_crm) return `/empresas-crm/${row.empresa_crm_id}?tab=relationship`;
  return undefined;
}
