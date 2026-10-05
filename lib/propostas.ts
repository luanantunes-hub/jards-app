/**
 * Mesma regra do banco (fn_valor_pela_proposta): a proposta que vale é a
 * aceita, se houver; senão a mais recente que não foi recusada, expirada nem
 * arquivada.
 */
export const STATUS_PROPOSTA_INATIVA = ["recusada", "expirada", "arquivada"] as const;

type PropostaComStatus = { status: string; created_at: string };

export function propostaAtivaDe<T extends PropostaComStatus>(propostas: T[]): T | null {
  const ativas = propostas.filter(p => !(STATUS_PROPOSTA_INATIVA as readonly string[]).includes(p.status));
  const aceita = ativas.find(p => p.status === "aceita");
  if (aceita) return aceita;
  return [...ativas].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

/** Situação da proposta como aparece nas telas. */
export const SITUACAO_PROPOSTA: Record<string, string> = {
  rascunho: "Em elaboração",
  enviada: "Enviada à empresa",
  visualizada: "Vista pela empresa",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
  arquivada: "Arquivada",
};
