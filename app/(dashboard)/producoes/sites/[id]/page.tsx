"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import type { SituacaoDoSite } from "@/lib/producao/estados";
import { corDoTema } from "@/lib/producao/site";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { EditorDoSite } from "@/components/producao/EditorDoSite";
import { DominiosDoSite } from "@/components/producao/DominiosDoSite";

type Site = { id: string; nome: string; titulo: string | null; cor: string; situacao: SituacaoDoSite; espaco_id: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";

/** O site de um espaço: título e cor, publicar ou tirar do ar, as páginas com os blocos, e o domínio da pessoa. */
export default function SitePage() {
  const { id } = useParams<{ id: string }>();
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const router = useRouter();
  const { confirmDelete } = useDeleteConfirm();
  const [site, setSite] = useState<Site | null | undefined>(undefined);
  const [titulo, setTitulo] = useState("");
  const [cor, setCor] = useState("#282525");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_sites").select("id, nome, titulo, cor, situacao, espaco_id").eq("id", id).eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      const lido = error ? null : (data as Site | null);
      setSite(lido);
      if (lido) { setTitulo(lido.titulo ?? ""); setCor(corDoTema(lido.cor)); }
    })();
    return () => { ativo = false; };
  }, [id, organizationId, versao]);

  async function atualizar(mudanca: { titulo?: string | null; cor?: string; situacao?: SituacaoDoSite }) {
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_sites").update(mudanca).eq("id", id);
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar este site." : error.code === "23514" ? "Confira o título e a cor." : "Não foi possível salvar. Tente de novo."); return; }
    setVersao(atual => atual + 1);
  }

  function apagar() {
    if (!site) return;
    confirmDelete({
      title: "Apagar o site?", description: `"${site.nome}", as páginas e os domínios ligados saem. O site deixa de abrir no domínio da casa.`, confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        // Os domínios saem também do servidor (senão ficariam cadastrados lá sem site).
        const { data: dominios } = await clienteDaProducao(createClient()).from("producao_site_dominios").select("id").eq("site_id", site.id);
        for (const dominio of dominios ?? []) {
          const resposta = await fetch(`/api/producao/sites/${site.id}/dominio`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: dominio.id }) });
          if (!resposta.ok) throw new Error("Não foi possível tirar um dos domínios do servidor. Tire os domínios um a um e tente de novo.");
        }
        const { error } = await clienteDaProducao(createClient()).from("producao_sites").delete().eq("id", site.id);
        if (error) throw new Error("Não foi possível apagar o site.");
        router.push("/producoes/sites");
      },
    });
  }

  if (site === undefined) return <DetailPageSkeleton />;
  if (site === null || !organizationId) return <DetailNotFound title="Site não encontrado" description="Ele pode ter sido apagado ou você não tem acesso." backHref="/producoes/sites" backLabel="Voltar aos sites" />;

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <DetailBackLink href="/producoes/sites" label="Sites" />
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{site.nome}</h1>
              <p className="mt-1 text-[0.75rem] text-black/45">{site.situacao === "publicado" ? "No ar: abre no domínio ligado, com as páginas publicadas." : "Rascunho: só você vê, pela prévia."}</p>
            </div>
            {podeEditar && (
              <button type="button" disabled={salvando} onClick={() => void atualizar({ situacao: site.situacao === "publicado" ? "rascunho" : "publicado" })}
                className={site.situacao === "publicado"
                  ? "inline-flex h-10 items-center rounded border border-black/[.12] px-4 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50"
                  : "inline-flex h-10 items-center rounded bg-[#282525] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50"}>
                {site.situacao === "publicado" ? "Tirar do ar" : "Pôr o site no ar"}
              </button>
            )}
          </div>
        </div>
      </header>
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
          {podeEditar && <button type="button" disabled={salvando || (titulo.trim() === (site.titulo ?? "") && cor === corDoTema(site.cor))} onClick={() => void atualizar({ titulo: titulo.trim() === "" ? null : titulo.trim(), cor })} className="inline-flex h-10 items-center rounded bg-[#2E8932] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40">Salvar</button>}
        </section>
        <EditorDoSite siteId={site.id} organizationId={organizationId} podeEditar={podeEditar} />
        <DominiosDoSite siteId={site.id} podeEditar={podeEditar} />
        {podeEditar && <div className="mt-12"><button type="button" onClick={apagar} className="text-[0.75rem] font-medium text-black/45 underline underline-offset-2 hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5]">Apagar este site</button></div>}
      </DetailPageContent>
    </div>
  );
}
