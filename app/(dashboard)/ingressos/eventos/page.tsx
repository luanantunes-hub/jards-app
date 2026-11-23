"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, Ticket } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { podeEditarATicketeria } from "@/lib/ticketeria/permissoes";
import type { SituacaoDoEvento } from "@/lib/ticketeria/estados";
import { ROTULO_DA_SITUACAO_DO_EVENTO, proximaSessao, quandoDaSessao } from "@/lib/ticketeria/eventos";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface, PrimaryListAction } from "@/components/list/ListPagePrimitives";

type Evento = { id: string; titulo: string; situacao: SituacaoDoEvento };
type Sessao = { id: string; evento_id: string; local_id: string; inicio: string; fim: string | null; cancelada_em: string | null };
type Local = { id: string; nome: string; fuso: string };

const COR_DA_SITUACAO: Record<SituacaoDoEvento, string> = { rascunho: "#6B6767", publicado: "#2E8932", cancelado: "#B23B3B" };

/** Os eventos da loja (T2): título, situação, a próxima sessão e quantas sessões há. "Novo evento" abre o assistente em tela cheia (/ingressos/eventos/novo). */
export default function IngressosPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const router = useRouter();
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const podeEditar = podeEditarATicketeria(papel);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const ticketeria = clienteDaTicketeria(createClient());
      const [ev, se, lo] = await Promise.all([
        ticketeria.from("ticketeria_eventos").select("id, titulo, situacao").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        ticketeria.from("ticketeria_sessoes").select("id, evento_id, local_id, inicio, fim, cancelada_em").eq("organization_id", organizationId).order("inicio"),
        ticketeria.from("ticketeria_locais").select("id, nome, fuso").eq("organization_id", organizationId),
      ]);
      if (!ativo) return;
      setEventos((ev.data ?? []) as Evento[]);
      setSessoes((se.data ?? []) as Sessao[]);
      setLocais((lo.data ?? []) as Local[]);
      setErro(ev.error || se.error || lo.error ? "Não foi possível carregar os eventos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  const linhas = useMemo(() => (eventos ?? []).map(evento => {
    const delas = sessoes.filter(sessao => sessao.evento_id === evento.id);
    const proxima = proximaSessao(delas);
    const local = proxima ? locais.find(item => item.id === proxima.local_id) : undefined;
    return { evento, total: delas.filter(sessao => !sessao.cancelada_em).length, proxima: proxima && local ? `${quandoDaSessao(proxima.inicio, local.fuso)} · ${local.nome}` : null };
  }), [eventos, sessoes, locais]);

  const novo = podeEditar ? <PrimaryListAction onClick={() => router.push("/ingressos/eventos/novo")}><Plus size={13} aria-hidden="true" /> Novo evento</PrimaryListAction> : undefined;

  return (
    <>
      <ListPageHeader title="Programação" actions={eventos && eventos.length > 0 ? novo : undefined} />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <ListTableSurface>
          {eventos === null ? (
            <div className="h-32 bg-black/[.02] motion-safe:animate-pulse" />
          ) : eventos.length === 0 ? (
            <ListEmptyState icon={Ticket} title="Nenhum evento ainda" action={novo} />
          ) : (
            <ul className="divide-y divide-black/[.06]">
              {linhas.map(({ evento, total, proxima }) => (
                <li key={evento.id}>
                  <Link href={`/ingressos/eventos/${evento.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                    <span className="min-w-0 flex-1 basis-60">
                      <span className="block truncate text-[0.8125rem] font-normal text-[#282525]">{evento.titulo}</span>
                      <span className="flex items-center gap-1.5 truncate text-[0.6875rem] text-black/45">
                        <CalendarDays size={12} aria-hidden="true" className="shrink-0 text-black/40" />
                        {proxima ?? (total === 0 ? "Sem sessões" : "Nenhuma sessão por vir")}
                      </span>
                    </span>
                    <span className="text-[0.6875rem] tabular-nums text-black/45">{total} {total === 1 ? "sessão" : "sessões"}</span>
                    <span className="rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: COR_DA_SITUACAO[evento.situacao] + "47", color: COR_DA_SITUACAO[evento.situacao] }}>{ROTULO_DA_SITUACAO_DO_EVENTO[evento.situacao]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ListTableSurface>
      </ListContent>
    </>
  );
}
