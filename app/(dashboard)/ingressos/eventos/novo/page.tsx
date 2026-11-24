"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { PERFIS, type PerfilDoProdutor } from "@/lib/ticketeria/comecar";
import { ListContent } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { ComecarView } from "@/components/ticketeria/ComecarView";

/**
 * O evento novo, em tela cheia (o mesmo assistente do onboarding, sem o perfil e as salas, que a loja já sabe): nome, lugar, data, ingressos e preço, e o evento sai
 * pronto em rascunho. Quem ainda não fez o onboarding é levado a ele. Sem menu lateral nem barra do topo (ROTAS_TELA_CHEIA, no layout); a saída é "Cancelar".
 */
export default function NovoEventoPage() {
  const organizationId = useOrganizationId();
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilDoProdutor | null | undefined>(undefined);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("perfil").eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      const achado = PERFIS.find(p => p === data?.perfil) ?? null;
      if (achado === null) { router.replace("/ingressos/comecar"); return; }
      setPerfil(achado);
    })();
    return () => { ativo = false; };
  }, [organizationId, router]);

  if (!organizationId || !perfil) return <DetailPageSkeleton />;
  return (
    <ListContent className="!px-5 !pt-5 pb-28 md:!px-10 md:pb-12">
      <div className="mb-8 flex items-center justify-end md:mb-14">
        <Link href="/ingressos/eventos" prefetch={false}
          className="rounded-xl px-3 py-2 text-[0.75rem] font-normal text-black/45 transition hover:bg-black/[.04] hover:text-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
          Cancelar
        </Link>
      </div>
      <ComecarView organizationId={organizationId} perfilDaLoja={perfil} />
    </ListContent>
  );
}
