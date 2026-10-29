"use client";

import { Select } from "@/components/ui/Select";
import type { FiltroResponsavel as Filtro, MembroDaEquipe } from "@/lib/equipe/responsavel";

/** Filtro por responsável na barra da lista. Só aparece quando a organização tem equipe. */
export function FiltroResponsavel({ membros, meuId, value, onChange }: {
  membros: readonly MembroDaEquipe[];
  meuId: string | null;
  value: Filtro;
  onChange: (valor: Filtro) => void;
}) {
  if (membros.length < 2) return null;
  return (
    <Select
      block={false}
      aria-label="Filtrar por responsável"
      value={value === meuId ? "meus" : value}
      onChange={event => onChange(event.target.value)}
      className="h-9 shrink-0 pl-3 pr-8 text-black/60"
    >
      <option value="todos">Toda a equipe</option>
      {meuId && <option value="meus">Só os meus</option>}
      {membros.filter(membro => membro.id !== meuId).map(membro => (
        <option key={membro.id} value={membro.id}>{membro.nome}</option>
      ))}
      <option value="sem">Sem responsável</option>
    </Select>
  );
}
