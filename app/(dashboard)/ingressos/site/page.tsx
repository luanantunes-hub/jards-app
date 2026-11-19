"use client";

import { useEffect, useState } from "react";
import { Globe, Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { podeEditarATicketeria } from "@/lib/ticketeria/permissoes";
import type { SituacaoDoSite } from "@/lib/ticketeria/estados";
import { corDoTema, type Bloco } from "@/lib/ticketeria/site";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { TopSheet } from "@/components/ui/TopSheet";
import { EditorDoSite, type EspacoDaProgramacao } from "@/components/ticketeria/EditorDoSite";
import { DominiosDoSite } from "@/components/ticketeria/DominiosDoSite";

type Loja = { id: string; nome: string };
type Site = { id: string; nome: string; titulo: string | null; cor: string; situacao: SituacaoDoSite };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

/** Cria a loja (se ainda não houver) e o site dela, com a página de início já começada. */
function NovoSiteSheet({ organizationId, loja, espacos, onClose, onCreated }: { organizationId: string; loja: Loja | null; espacos: readonly EspacoDaProgramacao[]; onClose: () => void; onCreated: () => void }) {
  const [nome, setNome] = useState(loja?.nome ?? "");
  const [cor, setCor] = useState("#282525");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    const limpo = nome.trim();
    if (limpo === "" || limpo.length > 120) { setErro("Dê um nome ao site (até 120 letras)."); return; }
    setSalvando(true);
    setErro(null);
    const ticketeria = clienteDaTicketeria(createClient());
    let lojaId = loja?.id ?? null;
    if (!lojaId) {
      const { data: nova, error } = await ticketeria.from("ticketeria_lojas").insert({ organization_id: organizationId, nome: limpo }).select("id").single();
      if (error || !nova) { setSalvando(false); setErro(error?.code === "42501" ? "Você não pode criar a loja desta organização." : "Não foi possível criar a loja. Tente de novo."); return; }
      lojaId = nova.id;
    }
    const { data: site, error } = await ticketeria.from("ticketeria_sites").insert({ organization_id: organizationId, loja_id: lojaId, nome: limpo, cor: corDoTema(cor) }).select("id").single();
    if (error || !site) { setSalvando(false); setErro(error?.code === "42501" ? "Você não pode criar o site." : error?.code === "23505" ? "A loja já tem um site. Recarregue a página." : "Não foi possível criar o site. Tente de novo."); return; }
    // A página de início já nasce com um começo: um título, um texto e, se houver espaço na Produção, a programação dele.
    const inicio: Bloco[] = [
      { tipo: "titulo", texto: limpo },
      { tipo: "texto", texto: "Escreva aqui uma apresentação: quem somos, o que fazemos e como chegar." },
      ...(espacos[0] ? [{ tipo: "programacao", titulo: "Programação", espaco_id: espacos[0].id } as const] : []),
    ];
    const { error: erroDaPagina } = await ticketeria.from("ticketeria_site_paginas").insert({ organization_id: organizationId, site_id: site.id, slug: "inicio", titulo: "Início", ordem: 0, blocos: inicio });
    setSalvando(false);
    if (erroDaPagina) setErro("O site foi criado, mas a página inicial não. Crie a página no editor.");
    onCreated();
  }

  return (
    <TopSheet
      titulo="Novo site"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void criar()} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Criando…" : "Criar site"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div><label className={ROTULO} htmlFor="site-nome">Nome do site</label><input id="site-nome" autoFocus className={CAMPO} value={nome} onChange={event => setNome(event.target.value)} placeholder="Teatro Central" maxLength={120} disabled={salvando} /></div>
        <div className="flex items-center gap-3"><label className={`${ROTULO} mb-0`} htmlFor="site-cor">Cor do cabeçalho</label><input id="site-cor" type="color" value={cor} onChange={event => setCor(event.target.value)} className="h-10 w-14 cursor-pointer rounded border border-black/[.12] bg-white p-1" disabled={salvando} /></div>
        <p className="text-[0.75rem] text-black/55">O site abre só no domínio da sua casa, festival ou companhia. Você liga o domínio depois de criar.</p>
      </div>
    </TopSheet>
  );
}

/** O site da loja (um por produtor): título e cor, publicar ou tirar do ar, as páginas com os blocos, e o domínio da pessoa. */
export default function SiteDaLojaPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const { confirmDelete } = useDeleteConfirm();
  const [estado, setEstado] = useState<{ loja: Loja | null; site: Site | null } | undefined>(undefined);
  const [espacos, setEspacos] = useState<EspacoDaProgramacao[]>([]);
  const [titulo, setTitulo] = useState("");
  const [cor, setCor] = useState("#282525");
  const [folha, setFolha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = podeEditarATicketeria(papel);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const cliente = createClient();
      const ticketeria = clienteDaTicketeria(cliente);
      // Os espaços são da Produção: quem não usa a Produção recebe a lista vazia (as regras do banco), e o bloco de programação some.
      const [lojas, esp] = await Promise.all([
        ticketeria.from("ticketeria_lojas").select("id, nome").eq("organization_id", organizationId).maybeSingle(),
        clienteDaProducao(cliente).from("producao_espacos").select("id, nome").eq("organization_id", organizationId).eq("arquivado", false).order("nome"),
      ]);
      const loja = lojas.data ?? null;
      const sites = loja ? await ticketeria.from("ticketeria_sites").select("id, nome, titulo, cor, situacao").eq("loja_id", loja.id).maybeSingle() : { data: null, error: null };
      if (!ativo) return;
      const site = (sites.data ?? null) as Site | null;
      setEstado({ loja, site });
      setEspacos((esp.data ?? []) as EspacoDaProgramacao[]);
      if (site) { setTitulo(site.titulo ?? ""); setCor(corDoTema(site.cor)); }
      setErro(lojas.error || sites.error ? "Não foi possível carregar o site. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const site = estado?.site ?? null;

  async function atualizar(mudanca: { titulo?: string | null; cor?: string; situacao?: SituacaoDoSite }) {
    if (!site) return;
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_sites").update(mudanca).eq("id", site.id);
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar este site." : error.code === "23514" ? "Confira o título e a cor." : "Não foi possível salvar. Tente de novo."); return; }
    recarregar();
  }

  function apagar() {
    if (!site) return;
    confirmDelete({
      title: "Apagar o site?", description: `"${site.nome}", as páginas e os domínios ligados saem. O site deixa de abrir no domínio da casa.`, confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        // Os domínios saem também do servidor (senão ficariam cadastrados lá sem site).
        const ticketeria = clienteDaTicketeria(createClient());
        const { data: dominios } = await ticketeria.from("ticketeria_site_dominios").select("id").eq("site_id", site.id);
        for (const dominio of dominios ?? []) {
          const resposta = await fetch(`/api/ticketeria/sites/${site.id}/dominio`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: dominio.id }) });
          if (!resposta.ok) throw new Error("Não foi possível tirar um dos domínios do servidor. Tire os domínios um a um e tente de novo.");
        }
        const { error } = await ticketeria.from("ticketeria_sites").delete().eq("id", site.id);
        if (error) throw new Error("Não foi possível apagar o site.");
        recarregar();
      },
    });
  }

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;

  if (!site) {
    return (
      <>
        <ListPageHeader eyebrow="Ticketeria" title="Site" />
        <ListContent>
          {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
          <ListTableSurface>
            <ListEmptyState
              icon={Globe}
              title="Nenhum site ainda"
              description="Crie o site da sua casa, festival ou companhia, escreva as páginas e ligue o seu domínio. Depois, a venda de ingressos entra nele."
              action={podeEditar ? <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Novo site</PrimaryListAction> : undefined}
            />
          </ListTableSurface>
        </ListContent>
        {folha && <NovoSiteSheet organizationId={organizationId} loja={estado.loja} espacos={espacos} onClose={() => setFolha(false)} onCreated={() => { setFolha(false); recarregar(); }} />}
      </>
    );
  }

  return (
    <div className="min-h-full">
      <ListPageHeader
        eyebrow="Ticketeria"
        title={site.nome}
        description={site.situacao === "publicado" ? "No ar: abre no domínio ligado, com as páginas publicadas." : "Rascunho: só quem edita vê, pela prévia."}
        actions={podeEditar ? (
          <button type="button" disabled={salvando} onClick={() => void atualizar({ situacao: site.situacao === "publicado" ? "rascunho" : "publicado" })}
            className={site.situacao === "publicado"
              ? "inline-flex h-10 items-center rounded border border-black/[.12] px-4 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50"
              : "inline-flex h-10 items-center rounded bg-[#1C0E33] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#2D1A53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50"}>
            {site.situacao === "publicado" ? "Tirar do ar" : "Pôr o site no ar"}
          </button>
        ) : undefined}
      />
      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <section aria-label="Aparência do site" className="mb-10 grid max-w-2xl gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label htmlFor="site-titulo" className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">Título no cabeçalho</label>
            <input id="site-titulo" className={CAMPO} value={titulo} onChange={event => setTitulo(event.target.value)} placeholder={site.nome} maxLength={120} disabled={!podeEditar || salvando} />
          </div>
          <div>
            <label htmlFor="site-cor" className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">Cor</label>
            <input id="site-cor" type="color" value={cor} onChange={event => setCor(event.target.value)} className="h-10 w-14 cursor-pointer rounded border border-black/[.12] bg-white p-1" disabled={!podeEditar || salvando} />
          </div>
          {podeEditar && <button type="button" disabled={salvando || (titulo.trim() === (site.titulo ?? "") && cor === corDoTema(site.cor))} onClick={() => void atualizar({ titulo: titulo.trim() === "" ? null : titulo.trim(), cor })} className="inline-flex h-10 items-center rounded acao-salvar px-4 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40">Salvar</button>}
        </section>
        <EditorDoSite siteId={site.id} organizationId={organizationId} podeEditar={podeEditar} espacos={espacos} />
        <DominiosDoSite siteId={site.id} podeEditar={podeEditar} />
        {podeEditar && <div className="mt-12"><button type="button" onClick={apagar} className="text-[0.75rem] font-medium text-black/45 underline underline-offset-2 hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5]">Apagar este site</button></div>}
      </DetailPageContent>
    </div>
  );
}
