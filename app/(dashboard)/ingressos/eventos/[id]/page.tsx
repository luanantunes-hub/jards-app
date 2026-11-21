"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CalendarPlus, MapPin, Pencil } from "lucide-react";
import { useOrganizationId, useOrganizationName, useOrganizationRole } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { podeEditarATicketeria } from "@/lib/ticketeria/permissoes";
import type { ClassificacaoIndicativa, SituacaoDoEvento } from "@/lib/ticketeria/estados";
import { ROTULO_DA_CLASSIFICACAO, ROTULO_DA_SITUACAO_DO_EVENTO, mensagemDoErroDoEvento, partesNoFuso, quandoDaSessao, situacaoDaSessao } from "@/lib/ticketeria/eventos";
import { PaginaDoEventoNoSite } from "@/components/ticketeria/PaginaDoEventoNoSite";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { SecondaryListAction } from "@/components/list/ListPagePrimitives";
import { CatalogoDoEvento } from "@/components/ticketeria/CatalogoDoEvento";
import { LinkDeVenda } from "@/components/ticketeria/LinkDeVenda";
import { Aviso, EventoSheet, LocalSheet, SessaoSheet, type EventoEditavel, type LocalDaSessao, type SessaoEditavel } from "@/components/ticketeria/FolhasDosEventos";

type Evento = EventoEditavel & { situacao: SituacaoDoEvento; loja_id: string; slug: string };
type Sessao = SessaoEditavel & { cancelada_em: string | null };
type Folha = { tipo: "evento" } | { tipo: "sessao"; sessao?: Sessao } | { tipo: "local" };

const BOTAO_ESCURO = "inline-flex h-10 items-center rounded-xl bg-[#6450D2] px-4 text-[0.75rem] font-normal text-white transition hover:bg-[#5342BA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const BOTAO_CLARO = "inline-flex h-10 items-center rounded-xl border border-black/[.12] bg-white px-4 text-[0.75rem] font-normal text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const ROTULO_DA_SESSAO = { agendada: "Por vir", realizada: "Realizada", cancelada: "Cancelada" } as const;

/** O evento (T2): título, situação, publicar ou cancelar, e as sessões com dia, hora e local. */
export default function EventoPage() {
  const { id } = useParams<{ id: string }>();
  const organizationId = useOrganizationId();
  const nomeDaOrganizacao = useOrganizationName();
  const papel = useOrganizationRole();
  const router = useRouter();
  const { confirmDelete } = useDeleteConfirm();
  const [evento, setEvento] = useState<Evento | null | undefined>(undefined);
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [locais, setLocais] = useState<LocalDaSessao[]>([]);
  const [folha, setFolha] = useState<Folha | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = podeEditarATicketeria(papel);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const ticketeria = clienteDaTicketeria(createClient());
      const [ev, se, lo] = await Promise.all([
        ticketeria.from("ticketeria_eventos").select("id, loja_id, slug, titulo, descricao, imagem_url, classificacao, situacao").eq("id", id).eq("organization_id", organizationId).maybeSingle(),
        ticketeria.from("ticketeria_sessoes").select("id, local_id, inicio, fim, abertura_portas, cancelada_em").eq("evento_id", id).order("inicio"),
        ticketeria.from("ticketeria_locais").select("id, nome, fuso, arquivado").eq("organization_id", organizationId).order("nome"),
      ]);
      if (!ativo) return;
      setEvento(ev.error ? null : ((ev.data ?? null) as Evento | null));
      setSessoes((se.data ?? []) as Sessao[]);
      setLocais((lo.data ?? []) as LocalDaSessao[]);
    })();
    return () => { ativo = false; };
  }, [id, organizationId, versao]);

  const linhas = useMemo(() => sessoes.map(sessao => {
    const local = locais.find(item => item.id === sessao.local_id);
    const fuso = local?.fuso ?? "America/Sao_Paulo";
    return { sessao, local, quando: quandoDaSessao(sessao.inicio, fuso), situacao: situacaoDaSessao(sessao), detalhes: [sessao.abertura_portas ? `portas às ${partesNoFuso(sessao.abertura_portas, fuso).hora}` : null, sessao.fim ? `até ${partesNoFuso(sessao.fim, fuso).hora}` : null].filter(Boolean).join(" · ") };
  }), [sessoes, locais]);

  async function mudarSituacao(situacao: SituacaoDoEvento) {
    if (!evento) return;
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_eventos").update({ situacao }).eq("id", evento.id);
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDoEvento(error)); return; }
    recarregar();
  }

  function cancelarEvento() {
    if (!evento) return;
    confirmDelete({
      title: "Cancelar o evento?", description: `"${evento.titulo}" fica cancelado e não volta. As sessões ficam registradas.`, confirmLabel: "Cancelar o evento", pendingLabel: "Cancelando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_eventos").update({ situacao: "cancelado" }).eq("id", evento.id);
        if (error) throw new Error(mensagemDoErroDoEvento(error));
        recarregar();
      },
    });
  }

  function apagarEvento() {
    if (!evento) return;
    confirmDelete({
      title: "Apagar o evento?", description: `"${evento.titulo}" e as sessões dele saem. Só rascunho se apaga.`, confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_eventos").delete().eq("id", evento.id);
        if (error) throw new Error(mensagemDoErroDoEvento(error));
        router.push("/ingressos/eventos");
      },
    });
  }

  async function cancelarSessao(sessao: Sessao, cancelar: boolean) {
    setErro(null);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_sessoes").update({ cancelada_em: cancelar ? new Date().toISOString() : null }).eq("id", sessao.id);
    if (error) { setErro(mensagemDoErroDoEvento(error)); return; }
    recarregar();
  }

  if (evento === undefined) return <DetailPageSkeleton sidebar={false} />;
  if (evento === null || !organizationId) return <DetailNotFound title="Evento não encontrado" description="Ele pode ter sido apagado ou você não tem acesso." backHref="/ingressos/eventos" backLabel="Voltar aos eventos" />;

  const editavel = podeEditar && evento.situacao !== "cancelado";
  const resumo = [ROTULO_DA_SITUACAO_DO_EVENTO[evento.situacao], evento.classificacao ? ROTULO_DA_CLASSIFICACAO[evento.classificacao as ClassificacaoIndicativa] : null].filter(Boolean).join(" · ");

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <DetailBackLink href="/ingressos/eventos" label="Eventos" />
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[1.5rem] font-medium tracking-[-.02em] text-[#282525] [text-wrap:balance]">{evento.titulo}</h1>
              <p className="mt-1 text-[0.75rem] text-black/45">{resumo}</p>
              {evento.descricao && <p className="mt-3 max-w-2xl whitespace-pre-line text-[0.8125rem] text-black/65 line-clamp-3">{evento.descricao}</p>}
            </div>
            {editavel && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setFolha({ tipo: "evento" })} className={BOTAO_CLARO}><Pencil size={13} aria-hidden="true" className="mr-1.5" /> Editar</button>
                {evento.situacao === "rascunho"
                  ? <button type="button" disabled={salvando} onClick={() => void mudarSituacao("publicado")} className={BOTAO_ESCURO}>Publicar</button>
                  : <button type="button" disabled={salvando} onClick={() => void mudarSituacao("rascunho")} className={BOTAO_CLARO}>Voltar para rascunho</button>}
              </div>
            )}
          </div>
        </div>
      </header>
      <DetailPageContent>
        <PaginaDoEventoNoSite lojaId={evento.loja_id} slug={evento.slug} publicado={evento.situacao === "publicado"} />
        {erro && <div className="mb-4"><Aviso texto={erro} /></div>}
        {evento.situacao === "publicado" && <p className="mb-6 max-w-2xl text-[0.75rem] text-black/55">Publicado: o catálogo de ingressos está montado abaixo; a venda e o pagamento entram nas próximas etapas.</p>}
        <section aria-labelledby="sessoes-do-evento">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="sessoes-do-evento" className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Sessões</h2>
            {editavel && <SecondaryListAction onClick={() => setFolha({ tipo: "sessao" })}><CalendarPlus size={13} aria-hidden="true" /> Nova sessão</SecondaryListAction>}
          </div>
          {linhas.length === 0 ? (
            <div className="rounded-xl border bg-white px-5 py-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-[0.8125rem] font-normal text-black/55">Nenhuma sessão ainda</p>
              <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Cada sessão é um dia e uma hora num local. Os ingressos valem para as sessões no local do setor.</p>
            </div>
          ) : (
            <ul className="divide-y divide-black/[.06] overflow-hidden rounded-xl border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              {linhas.map(({ sessao, local, quando, situacao, detalhes }) => (
                <li key={sessao.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <span className="min-w-0 flex-1 basis-60">
                    <span className={`block text-[0.8125rem] font-normal tabular-nums ${situacao === "cancelada" ? "text-black/40 line-through" : "text-[#282525]"}`}>{quando}</span>
                    <span className="flex items-center gap-1.5 truncate text-[0.6875rem] text-black/45"><MapPin size={12} aria-hidden="true" className="shrink-0 text-black/40" />{[local?.nome ?? "Local", detalhes].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="text-[0.6875rem] text-black/50">{ROTULO_DA_SESSAO[situacao]}</span>
                  {evento.situacao === "publicado" && situacao === "agendada" && <LinkDeVenda sessaoId={sessao.id} />}
                  {editavel && (
                    <span className="flex items-center gap-1">
                      {situacao !== "cancelada" && <button type="button" onClick={() => setFolha({ tipo: "sessao", sessao })} className="h-8 rounded-xl px-2.5 text-[0.6875rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">Editar</button>}
                      {evento.situacao === "publicado" && situacao !== "realizada" && <button type="button" onClick={() => void cancelarSessao(sessao, situacao !== "cancelada")} className="h-8 rounded-xl px-2.5 text-[0.6875rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">{situacao === "cancelada" ? "Desfazer cancelamento" : "Cancelar"}</button>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <CatalogoDoEvento organizationId={organizationId} eventoId={evento.id} locaisDasSessoes={[...new Set(sessoes.map(sessao => sessao.local_id))]} podeEditar={editavel} />
        {editavel && (
          <div className="mt-12">
            {evento.situacao === "rascunho"
              ? <button type="button" onClick={apagarEvento} className="text-[0.75rem] font-normal text-black/45 underline underline-offset-2 hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5]">Apagar este evento</button>
              : <button type="button" onClick={cancelarEvento} className="text-[0.75rem] font-normal text-black/45 underline underline-offset-2 hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar este evento</button>}
          </div>
        )}
      </DetailPageContent>
      {folha?.tipo === "evento" && <EventoSheet organizationId={organizationId} nomeDaOrganizacao={nomeDaOrganizacao} evento={evento} onClose={() => setFolha(null)} onSaved={recarregar} />}
      {folha?.tipo === "sessao" && <SessaoSheet organizationId={organizationId} eventoId={evento.id} locais={locais} sessao={folha.sessao} podeApagar={evento.situacao === "rascunho"} onClose={() => setFolha(null)} onSaved={recarregar} onNovoLocal={() => setFolha({ tipo: "local" })} />}
      {folha?.tipo === "local" && <LocalSheet organizationId={organizationId} nomeDaOrganizacao={nomeDaOrganizacao} onClose={() => setFolha({ tipo: "sessao" })} onSaved={() => recarregar()} />}
    </div>
  );
}
