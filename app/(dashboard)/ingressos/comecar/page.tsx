"use client";

import Link from "next/link";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { ListContent } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { ComecarView } from "@/components/ticketeria/ComecarView";

/**
 * O onboarding da Ticketeria: três perguntas e o primeiro evento pronto, em rascunho. Ocupa a tela toda (o layout tira o menu
 * lateral e a barra do topo nesta rota, ROTAS_TELA_CHEIA), sem marca; a única saída é "Fazer depois". O bloqueio por módulo é do layout de /ingressos.
 */
export default function ComecarPage() {
  const organizationId = useOrganizationId();
  if (!organizationId) return <DetailPageSkeleton />;
  return (
    <ListContent className="!px-5 !pt-5 pb-28 md:!px-10 md:pb-12">
      <div className="mb-8 flex items-center justify-end md:mb-14">
        <Link href="/ingressos/eventos" prefetch={false}
          className="rounded-xl px-3 py-2 text-[0.75rem] font-normal text-black/45 transition hover:bg-black/[.04] hover:text-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
          Fazer depois
        </Link>
      </div>
      <ComecarView organizationId={organizationId} />
    </ListContent>
  );
}
