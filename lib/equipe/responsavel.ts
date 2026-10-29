// Filtro "por responsável" das listas (negociações, empresas, atividades):
// "todos", "meus", "sem" ou o id de uma pessoa da equipe.

import type { OrganizationMemberSummary } from "@/lib/organization/members";

export type MembroDaEquipe = { id: string; nome: string };

export type FiltroResponsavel = string;

/** Captador e proponente externos não são da equipe interna. */
const PAPEIS_EXTERNOS = new Set(["captador", "proponente"]);

export function nomeDoMembro(membro: Pick<OrganizationMemberSummary, "full_name" | "email">): string {
  return membro.full_name?.trim() || membro.email?.split("@")[0] || "Sem nome";
}

/** A equipe interna, em ordem de nome. */
export function membrosDaEquipe(membros: readonly OrganizationMemberSummary[]): MembroDaEquipe[] {
  return membros
    .filter(membro => !PAPEIS_EXTERNOS.has(membro.papel))
    .map(membro => ({ id: membro.user_id, nome: nomeDoMembro(membro) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * O registro passa no filtro? `donos` são as pessoas que respondem por ele
 * (responsável, supervisor, responsável pela empresa).
 */
export function casaResponsavel(
  donos: readonly (string | null | undefined)[],
  filtro: FiltroResponsavel,
  meuId: string | null,
): boolean {
  if (filtro === "todos") return true;
  const ids = donos.filter((dono): dono is string => Boolean(dono));
  if (filtro === "sem") return ids.length === 0;
  const alvo = filtro === "meus" ? meuId : filtro;
  return alvo !== null && ids.includes(alvo);
}
