"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ListContent, ListPageHeader, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { DivulgacaoDaLoja, LinkDeDivulgacaoSheet } from "@/components/ticketeria/DivulgacaoView";
import type { DivulgacaoDaLoja as DadosDaDivulgacao } from "@/lib/ticketeria/divulgacao";

/** Divulgação: de onde vieram as vendas e o link de divulgação de cada sessão. Lê da rota do servidor, que confere quem edita a Ticketeria. */
export default function DivulgacaoPage() {
  const organizationId = useOrganizationId();
  const [estado, setEstado] = useState<{ dados: DadosDaDivulgacao | null } | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data: loja, error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      if (error) { setErro("Não foi possível carregar a divulgação. Recarregue a página."); setEstado({ dados: null }); return; }
      if (!loja) { setEstado({ dados: { linhas: [], sessoes: [] } }); return; }
      try {
        const resposta = await fetch(`/api/ticketeria/lojas/${loja.id}/divulgacao`, { cache: "no-store" });
        if (!resposta.ok) throw new Error(String(resposta.status));
        const dados = (await resposta.json()) as DadosDaDivulgacao;
        if (ativo) { setErro(null); setEstado({ dados }); }
      } catch {
        if (ativo) { setErro("Não foi possível carregar a divulgação. Só quem edita a Ticketeria vê esta página."); setEstado({ dados: null }); }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;
  const dados = estado.dados;
  return (
    <>
      <ListPageHeader title="Divulgação" actions={dados ? <PrimaryListAction onClick={() => setCriando(true)}><Link2 size={13} aria-hidden="true" /> Criar link de divulgação</PrimaryListAction> : undefined} />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {dados && <DivulgacaoDaLoja linhas={dados.linhas} sessoes={dados.sessoes} sessaoId={sessaoId} onSessao={setSessaoId} onCriarLink={() => setCriando(true)} />}
      </ListContent>
      {criando && dados && <LinkDeDivulgacaoSheet sessoes={dados.sessoes} origem={window.location.origin} sessaoInicial={sessaoId} onClose={() => setCriando(false)} />}
    </>
  );
}
