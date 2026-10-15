"use client";

import { CalendarDays } from "lucide-react";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface } from "@/components/list/ListPagePrimitives";

// Agenda da produção. Por enquanto só o estado vazio: as datas e o botão de
// criar chegam na PD1.3.
export default function ProducoesPage() {
  return (
    <div className="flex h-full flex-col">
      <ListPageHeader eyebrow="Produção" title="Agenda" />
      <ListContent>
        <ListTableSurface>
          <ListEmptyState
            icon={CalendarDays}
            title="Nenhuma data ainda"
            description="Apresentações, ensaios, montagens e viagens vão aparecer aqui."
          />
        </ListTableSurface>
      </ListContent>
    </div>
  );
}
