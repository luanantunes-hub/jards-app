"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ListContent, ListPageHeader } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { VenderView } from "@/components/ticketeria/VenderView";
import { depoisDeAdicionar, type EscolhasDaLoja } from "@/lib/ticketeria/menu";
import type { Caixa } from "@/lib/ticketeria/vender";

const TUDO: EscolhasDaLoja = { canais: null, usaEspacos: null };

/**
 * Vendas: as formas de vender, em caixas (a Bilheteria, o site, o widget, o link de cada sessão e as que vêm por aí). Abrir uma caixa leva à página dela; se a caixa é
 * um canal que a loja ainda não usava (a Bilheteria, o site), abrir a adiciona, como o "+" da barra de abas fazia.
 */
export default function VenderPage() {
  const organizationId = useOrganizationId();
  const router = useRouter();
  const [loja, setLoja] = useState<{ id: string; escolhas: EscolhasDaLoja } | null | undefined>(undefined);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id, canais, usa_espacos").eq("organization_id", organizationId).maybeSingle();
      if (ativo) setLoja(data ? { id: data.id, escolhas: { canais: data.canais, usaEspacos: data.usa_espacos } } : null);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  async function abrir(caixa: Caixa) {
    if (!caixa.href) return;
    if (loja && caixa.canal && loja.escolhas.canais !== null && !loja.escolhas.canais.includes(caixa.canal)) {
      const novas = depoisDeAdicionar(loja.escolhas, { rotulo: caixa.titulo, href: caixa.href, grava: { canal: caixa.canal } });
      const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").update({ canais: novas.canais, usa_espacos: novas.usaEspacos }).eq("id", loja.id);
      if (!error) setLoja({ id: loja.id, escolhas: novas });
    }
    router.push(caixa.href);
  }

  if (!organizationId || loja === undefined) return <DetailPageSkeleton />;
  return (
    <>
      <ListPageHeader title="Vendas" />
      <ListContent>
        <VenderView loja={loja?.escolhas ?? TUDO} onAbrir={caixa => void abrir(caixa)} />
      </ListContent>
    </>
  );
}
