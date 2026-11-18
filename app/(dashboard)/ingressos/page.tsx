"use client";

import { Ticket } from "lucide-react";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface } from "@/components/list/ListPagePrimitives";

// Página inicial da ticketeria (T0 do plano): o módulo está registrado e escondido,
// sem funcionalidade ainda. A loja do produtor e os eventos chegam nas fases T1 e T2
// (docs/acoes-futuras/estudos/plano-modulo-ticketeria.md).
export default function IngressosPage() {
  return (
    <>
      <ListPageHeader eyebrow="Ticketeria" title="Ingressos" />
      <ListContent>
        <ListTableSurface>
          <ListEmptyState
            icon={Ticket}
            title="Nenhum evento ainda"
            description="O primeiro passo será cadastrar a loja do produtor e o primeiro evento. Essas telas ainda estão sendo construídas: por enquanto, o módulo está só preparado."
          />
        </ListTableSurface>
      </ListContent>
    </>
  );
}
