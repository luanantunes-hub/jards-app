"use client";

import { useOrganizationId } from "@/contexts/OrganizationContext";
import { ListContent } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { ComecarView } from "@/components/ticketeria/ComecarView";

/** O onboarding da Ticketeria: três perguntas e o primeiro evento pronto, em rascunho. O bloqueio por módulo é do layout de /ingressos. */
export default function ComecarPage() {
  const organizationId = useOrganizationId();
  if (!organizationId) return <DetailPageSkeleton />;
  return <ListContent className="py-8 md:py-12"><ComecarView organizationId={organizationId} /></ListContent>;
}
