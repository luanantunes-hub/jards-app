"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Ticket } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { ESTILO_DO_LINK, InicioView } from "@/components/ticketeria/InicioView";
import type { InicioDaLoja, PeriodoDoInicio } from "@/lib/ticketeria/inicio";

/** A página inicial da Ticketeria: hoje, saldos e a visão geral das vendas. Lê da rota do servidor, que confere quem edita a Ticketeria. */
export default function IngressosInicioPage() {
  const organizationId = useOrganizationId();
  const [estado, setEstado] = useState<{ dados: InicioDaLoja | null } | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoDoInicio>("tudo");

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data: loja, error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      if (error) { setErro("Não foi possível carregar a página. Recarregue."); setEstado({ dados: null }); return; }
      if (!loja) { setEstado({ dados: null }); return; }
      try {
        const resposta = await fetch(`/api/ticketeria/lojas/${loja.id}/inicio`, { cache: "no-store" });
        if (!resposta.ok) throw new Error(String(resposta.status));
        const dados = (await resposta.json()) as InicioDaLoja;
        if (ativo) { setErro(null); setEstado({ dados }); }
      } catch {
        if (ativo) { setErro("Não foi possível carregar a página. Só quem edita a Ticketeria a vê."); setEstado({ dados: null }); }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;
  return (
    <>
      <ListPageHeader title="Hoje" />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {estado.dados ? (
          <InicioView dados={estado.dados} periodo={periodo} onPeriodo={setPeriodo} ver={destino => <Link href={destino} prefetch={false} className={ESTILO_DO_LINK}>Ver tudo</Link>} />
        ) : !erro && (
          <ListTableSurface>
            <ListEmptyState icon={Ticket} title="Seu primeiro evento" description="Três perguntas e ele fica pronto para você conferir e publicar." action={<Link href="/ingressos/comecar" className="inline-flex items-center gap-1.5 rounded-xl bg-[#1C0E33] px-4 py-2.5 text-[0.75rem] text-white transition hover:bg-[#2D1A53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><Plus size={13} aria-hidden="true" /> Começar</Link>} />
          </ListTableSurface>
        )}
      </ListContent>
    </>
  );
}
