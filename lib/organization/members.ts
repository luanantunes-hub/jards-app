export type OrganizationMemberSummary = {
  user_id: string;
  papel: string;
  /** Módulos que a pessoa usa (P0.6); a rota devolve ["captacao"] quando vazio. */
  modulos_acesso?: string[];
  prestacao_funcao?: string | null;
  full_name: string | null;
  email: string | null;
  created_at: string;
};

export async function fetchOrganizationMembers(organizationId: string | null | undefined): Promise<OrganizationMemberSummary[]> {
  if (!organizationId) return [];
  const response = await fetch(`/api/members?organization_id=${encodeURIComponent(organizationId)}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as {
    members?: OrganizationMemberSummary[];
    error?: string;
  } | null;
  if (!response.ok) throw new Error(payload?.error || "Falha ao carregar membros da equipe");
  return payload?.members ?? [];
}
