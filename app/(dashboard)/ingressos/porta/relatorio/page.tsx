"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScanLine } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { RelatorioDaPorta, type RelatorioDaSessao } from "@/components/ticketeria/PortaExtrasView";
import { horaNoFuso, relatorioDaSessao } from "@/lib/ticketeria/porta";

/** O relatório da porta de uma sessão: quantos entraram e quantos não vieram, por ingresso e por horário, e a lista para baixar. Só quem edita a Ticketeria. */
function Relatorio() {
  const organizationId = useOrganizationId();
  const sessaoId = useSearchParams().get("sessao") ?? "";
  const [dados, setDados] = useState<{ lojaId: string; rotulo: string; relatorio: RelatorioDaSessao } | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId || !sessaoId) return;
    let ativo = true;
    void (async () => {
      const t = clienteDaTicketeria(createClient());
      const { data: loja } = await t.from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
      const { data: sessao } = await t.from("ticketeria_sessoes").select("evento_id, local_id, inicio").eq("id", sessaoId).maybeSingle();
      if (!ativo) return;
      if (!loja || !sessao) { setDados(null); return; }
      const [{ data: evento }, { data: local }] = await Promise.all([t.from("ticketeria_eventos").select("titulo").eq("id", sessao.evento_id).maybeSingle(), t.from("ticketeria_locais").select("fuso").eq("id", sessao.local_id).maybeSingle()]);
      try {
        const r = await fetch(`/api/ticketeria/lojas/${loja.id}/porta/relatorio?sessao=${sessaoId}`, { cache: "no-store" });
        const relatorio = r.ok ? relatorioDaSessao(await r.json().catch(() => null)) : null;
        if (!ativo) return;
        if (!relatorio) { setErro(r.status === 403 ? "Só quem edita a Ticketeria vê o relatório da porta." : "Não foi possível carregar o relatório. Recarregue a página."); setDados(null); return; }
        const fuso = local?.fuso ?? "America/Sao_Paulo";
        const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(sessao.inicio)).replace(".", "");
        setDados({ lojaId: loja.id, rotulo: `${evento?.titulo ?? "Evento"} · ${dia[0].toUpperCase()}${dia.slice(1)} às ${horaNoFuso(sessao.inicio, fuso)}`, relatorio });
      } catch {
        if (ativo) { setErro("Sem conexão. Recarregue a página."); setDados(null); }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId, sessaoId]);

  if (!organizationId || (sessaoId && dados === undefined)) return <DetailPageSkeleton />;
  return (
    <>
      <ListPageHeader eyebrow="Ticketeria" title="Relatório da entrada" />
      <ListContent>
        {erro && <p role="alert" className="mx-auto mb-4 max-w-[44rem] rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {dados ? (
          <RelatorioDaPorta sessao={dados.rotulo} relatorio={dados.relatorio} onBaixar={() => { window.location.assign(`/api/ticketeria/lojas/${dados.lojaId}/porta/lista?sessao=${sessaoId}`); }} />
        ) : !erro && (
          <ListTableSurface><ListEmptyState icon={ScanLine} title="Escolha uma sessão na Porta" description="O relatório é de uma sessão. Abra a Porta, escolha a sessão e toque em Relatório da sessão." /></ListTableSurface>
        )}
      </ListContent>
    </>
  );
}

export default function RelatorioDaPortaPage() {
  return <Suspense fallback={<DetailPageSkeleton />}><Relatorio /></Suspense>;
}
