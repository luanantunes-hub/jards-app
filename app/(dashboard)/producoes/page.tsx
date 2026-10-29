"use client";
import { CalendarDays } from "lucide-react";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface } from "@/components/list/ListPagePrimitives";

// Página inicial da produção. O módulo ainda não tem funcionalidade (as tabelas
// nascem na PD0.8 e a criação de datas na PD1.3): o estado vazio diz o que vai
// ficar aqui e que ainda não há o que fazer, sem ação, sem ordem e sem data prometidas.
export default function ProducaoPage() {
  return (
    <div className="flex h-full flex-col">
      <ListPageHeader eyebrow="Produção" title="Agenda" />
      <ListContent>
        <ListTableSurface>
          <ListEmptyState
            icon={CalendarDays}
            title="A agenda ainda está sendo montada"
            description="Aqui vão ficar as datas, a equipe, a logística e o roteiro de cada dia. Por enquanto, não há nada para preencher."
          />
        </ListTableSurface>
      </ListContent>
    </div>
  );
}
