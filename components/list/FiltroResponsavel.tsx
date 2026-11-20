"use client";

import { Select } from "@/components/ui/Select";
import type { FiltroResponsavel as Filtro, MembroDaEquipe } from "@/lib/equipe/responsavel";

/**
 * Filtro por responsável na barra da lista. Só aparece quando a organização tem equipe, a não ser com `sempre`
 * (a lista de Empresas, onde dá para atribuir responsável em lote mesmo numa organização de uma pessoa só: aí
 * o filtro separa o que já tem responsável do que ainda não tem). `rotuloDeTodos` troca o texto de "sem filtro".
 */
export function FiltroResponsavel({ membros, meuId, value, onChange, sempre = false, rotuloDeTodos = "Toda a equipe" }: {
  membros: readonly MembroDaEquipe[];
  meuId: string | null;
  value: Filtro;
  onChange: (valor: Filtro) => void;
  sempre?: boolean;
  rotuloDeTodos?: string;
}) {
  // Com `sempre`, espera a equipe carregar (lista vazia) para não mostrar o filtro pela metade.
  if (membros.length < (sempre ? 1 : 2)) return null;
  return (
    <Select
      block={false}
      aria-label="Filtrar por responsável"
      value={value === meuId ? "meus" : value}
      onChange={event => onChange(event.target.value)}
      className="h-9 shrink-0 pl-3 pr-8 text-black/60"
    >
      <option value="todos">{rotuloDeTodos}</option>
      {meuId && <option value="meus">Só os meus</option>}
      {membros.filter(membro => membro.id !== meuId).map(membro => (
        <option key={membro.id} value={membro.id}>{membro.nome}</option>
      ))}
      <option value="sem">Sem responsável</option>
    </Select>
  );
}
