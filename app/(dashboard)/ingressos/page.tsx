"use client";

import { Ticket } from "lucide-react";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface } from "@/components/list/ListPagePrimitives";

// Página inicial da ticketeria: o módulo está escondido dos clientes. O site da loja já existe
// (/ingressos/site, T1); os eventos chegam na fase T2 (docs/acoes-futuras/estudos/plano-modulo-ticketeria.md).
export default function IngressosPage() {
  return (
    <>
      <ListPageHeader eyebrow="Ticketeria" title="Ingressos" />
      <ListContent>
        <ListTableSurface>
          <ListEmptyState
            icon={Ticket}
            title="Nenhum evento ainda"
            description="Os eventos e a venda ainda estão sendo construídos. Enquanto isso, monte o site da sua loja em Site, no menu."
          />
        </ListTableSurface>
      </ListContent>
    </>
  );
}
