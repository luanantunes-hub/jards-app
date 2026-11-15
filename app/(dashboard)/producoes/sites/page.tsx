"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import type { SituacaoDoSite } from "@/lib/producao/estados";
import { corDoTema, type Bloco } from "@/lib/producao/site";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";

type SiteDaLista = { id: string; nome: string; situacao: SituacaoDoSite; espaco_id: string };
type Espaco = { id: string; nome: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

function NovoSiteSheet({ organizationId, espacos, onClose, onCreated }: { organizationId: string; espacos: Espaco[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [espacoId, setEspacoId] = useState(espacos[0]?.id ?? "");
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#282525");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    const limpo = nome.trim();
    if (!espacoId) { setErro("Escolha o espaço do site."); return; }
    if (limpo === "" || limpo.length > 120) { setErro("Dê um nome ao site (até 120 letras)."); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { data: site, error } = await producao.from("producao_sites").insert({ organization_id: organizationId, espaco_id: espacoId, nome: limpo, cor: corDoTema(cor) }).select("id").single();
    if (error || !site) { setSalvando(false); setErro(error?.code === "42501" ? "Você não pode criar sites." : "Não foi possível criar o site. Tente de novo."); return; }
    // A página de início já nasce com um começo: um título, um texto e a programação.
    const inicio: Bloco[] = [
      { tipo: "titulo", texto: limpo },
      { tipo: "texto", texto: "Escreva aqui uma apresentação da casa: quem somos, o que fazemos e como chegar." },
      { tipo: "programacao", titulo: "Programação" },
    ];
    const { error: erroDaPagina } = await producao.from("producao_site_paginas").insert({ organization_id: organizationId, site_id: site.id, slug: "inicio", titulo: "Início", ordem: 0, blocos: inicio });
    setSalvando(false);
    if (erroDaPagina) { setErro("O site foi criado, mas a página inicial não. Abra o site e crie a página."); }
    onCreated(site.id);
  }

  return (
    <TopSheet
      titulo="Novo site"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void criar()} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Criando…" : "Criar site"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div><span className={ROTULO}>Espaço do site</span><Dropdown ariaLabel="Espaço do site" value={espacoId} onChange={setEspacoId} disabled={salvando} options={espacos.map(espaco => ({ value: espaco.id, label: espaco.nome }))} /></div>
        <div><label className={ROTULO} htmlFor="site-nome">Nome do site</label><input id="site-nome" autoFocus className={CAMPO} value={nome} onChange={event => setNome(event.target.value)} placeholder="Teatro Central" maxLength={120} disabled={salvando} /></div>
        <div className="flex items-center gap-3"><label className={`${ROTULO} mb-0`} htmlFor="site-cor">Cor do cabeçalho</label><input id="site-cor" type="color" value={cor} onChange={event => setCor(event.target.value)} className="h-10 w-14 cursor-pointer rounded border border-black/[.12] bg-white p-1" disabled={salvando} /></div>
      </div>
    </TopSheet>
  );
}

/** Os sites dos espaços (PD12.1): cada um abre só no domínio da própria pessoa. */
export default function SitesPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const router = useRouter();
  const [sites, setSites] = useState<SiteDaLista[] | null>(null);
  const [espacos, setEspacos] = useState<Espaco[]>([]);
  const [folha, setFolha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [sit, esp] = await Promise.all([
        producao.from("producao_sites").select("id, nome, situacao, espaco_id").eq("organization_id", organizationId).order("nome"),
        producao.from("producao_espacos").select("id, nome").eq("organization_id", organizationId).eq("arquivado", false).order("nome"),
      ]);
      if (!ativo) return;
      setSites((sit.data ?? []) as SiteDaLista[]);
      setEspacos((esp.data ?? []) as Espaco[]);
      setErro(sit.error ? "Não foi possível carregar os sites. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  const nomeDoEspaco = (id: string) => espacos.find(espaco => espaco.id === id)?.nome ?? "";

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Sites</h1>
            </div>
            {podeEditar && espacos.length > 0 && <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Novo site</PrimaryListAction>}
          </div>
        </div>
      </header>
      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {sites === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : sites.length === 0 ? (
          <div className="rounded border bg-white px-5 py-10 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">Nenhum site ainda</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">{espacos.length === 0 ? "Cadastre um espaço primeiro. O site nasce dele." : "Crie o site de um espaço, ponha a programação e ligue o domínio da casa."}</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {sites.map(site => (
              <li key={site.id}>
                <Link href={`/producoes/sites/${site.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  <Globe size={14} aria-hidden="true" className="shrink-0 text-black/40" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[0.8125rem] font-medium text-[#282525]">{site.nome}</span><span className="block truncate text-[0.6875rem] text-black/45">{nomeDoEspaco(site.espaco_id)}</span></span>
                  <span className="text-[0.6875rem] font-medium text-black/50">{site.situacao === "publicado" ? "No ar" : "Rascunho"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DetailPageContent>
      {folha && organizationId && <NovoSiteSheet organizationId={organizationId} espacos={espacos} onClose={() => setFolha(false)} onCreated={id => router.push(`/producoes/sites/${id}`)} />}
    </div>
  );
}
