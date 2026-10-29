"use client";

// Filtros de responsável, tipo de patrocínio e projeto das negociações e das
// inscrições, com o menu do Jards (CustomDropdown). As opções e a regra de
// quando cada filtro aparece vêm de lib/filtros-do-funil.ts.

import type { ReactNode } from "react";
import { FolderKanban, Tag, UserRound } from "lucide-react";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { mostraFiltro, TODOS, type OpcaoDeFiltro } from "@/lib/filtros-do-funil";

export type FiltroDoFunil = { valor: string; opcoes: readonly OpcaoDeFiltro[]; onChange: (valor: string) => void };

function Filtro({ filtro, todos, icone }: { filtro: FiltroDoFunil; todos: string; icone: ReactNode }) {
  if (!mostraFiltro(filtro.opcoes, filtro.valor)) return null;
  return (
    <CustomDropdown
      value={filtro.valor}
      onChange={filtro.onChange}
      options={[{ value: TODOS, label: todos }, ...filtro.opcoes.map(o => ({ value: o.valor, label: `${o.nome} (${o.quantos})` }))]}
      icon={icone}
      compact
      emphasized={false}
      className="w-[12.5rem] shrink-0 [&>button]:w-full"
    />
  );
}

export function FiltrosDoFunil({ responsavel, lei, projeto }: { responsavel: FiltroDoFunil; lei: FiltroDoFunil; projeto: FiltroDoFunil }) {
  return (
    <>
      <Filtro filtro={responsavel} todos="Todos os responsáveis" icone={<UserRound size={13} aria-hidden="true" />} />
      <Filtro filtro={lei} todos="Todos os tipos" icone={<Tag size={13} aria-hidden="true" />} />
      <Filtro filtro={projeto} todos="Todos os projetos" icone={<FolderKanban size={13} aria-hidden="true" />} />
    </>
  );
}
