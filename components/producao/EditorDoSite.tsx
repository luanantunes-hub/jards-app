"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { blocosDoJson, lerBloco, lerSeo, ordemDasPaginas, ROTULO_DO_TIPO_DE_BLOCO, slugDaPagina, TIPOS_DE_BLOCO, type Bloco, type TipoDeBloco } from "@/lib/producao/site";

type Pagina = { id: string; slug: string; titulo: string; ordem: number; blocos: Bloco[]; blocos_publicados: Bloco[] | null; publicada_em: string | null; descricao: string | null; imagem_url: string | null };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border border-black/[.12] px-3 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

const resumoDoBloco = (bloco: Bloco): string => {
  switch (bloco.tipo) {
    case "titulo": case "texto": return bloco.texto.slice(0, 120);
    case "imagem": return bloco.alt;
    case "botao": return `${bloco.rotulo} → ${bloco.url}`;
    case "programacao": return bloco.titulo || "As sessões confirmadas do espaço, de hoje em diante";
    case "contato": return [bloco.endereco, bloco.telefone, bloco.email].filter(Boolean).join(" · ");
  }
};

function BlocoSheet({ bloco, tipoInicial, onClose, onSalvar }: { bloco?: Bloco; tipoInicial: TipoDeBloco; onClose: () => void; onSalvar: (bloco: Bloco) => Promise<string | null> }) {
  const tipo = bloco?.tipo ?? tipoInicial;
  const [texto, setTexto] = useState(bloco && (bloco.tipo === "titulo" || bloco.tipo === "texto") ? bloco.texto : "");
  const [url, setUrl] = useState(bloco && (bloco.tipo === "imagem" || bloco.tipo === "botao") ? bloco.url : "https://");
  const [alt, setAlt] = useState(bloco?.tipo === "imagem" ? bloco.alt : "");
  const [rotulo, setRotulo] = useState(bloco?.tipo === "botao" ? bloco.rotulo : "");
  const [tituloProg, setTituloProg] = useState(bloco?.tipo === "programacao" ? bloco.titulo : "Programação");
  const [email, setEmail] = useState(bloco?.tipo === "contato" ? bloco.email : "");
  const [telefone, setTelefone] = useState(bloco?.tipo === "contato" ? bloco.telefone : "");
  const [endereco, setEndereco] = useState(bloco?.tipo === "contato" ? bloco.endereco : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerBloco({ tipo, texto, url, alt, rotulo, titulo: tituloProg, email, telefone, endereco });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    const problema = await onSalvar(leitura.bloco);
    setSalvando(false);
    if (problema) { setErro(problema); return; }
    fechar();
  }

  return (
    <TopSheet
      titulo={`${bloco ? "Editar" : "Novo"} bloco: ${ROTULO_DO_TIPO_DE_BLOCO[tipo]}`}
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : bloco ? "Salvar" : "Acrescentar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {tipo === "titulo" && <div><label className={ROTULO} htmlFor="bl-texto">Título</label><input id="bl-texto" autoFocus className={CAMPO} value={texto} onChange={event => setTexto(event.target.value)} maxLength={120} disabled={salvando} /></div>}
        {tipo === "texto" && <div><label className={ROTULO} htmlFor="bl-texto">Texto (uma linha em branco separa os parágrafos)</label><textarea id="bl-texto" autoFocus rows={8} className={AREA} value={texto} onChange={event => setTexto(event.target.value)} maxLength={5000} disabled={salvando} /></div>}
        {tipo === "imagem" && (
          <>
            <div><label className={ROTULO} htmlFor="bl-url">Endereço da imagem (https://…)</label><input id="bl-url" autoFocus className={CAMPO} value={url} onChange={event => setUrl(event.target.value)} maxLength={500} disabled={salvando} /></div>
            <div><label className={ROTULO} htmlFor="bl-alt">Descreva a imagem (texto alternativo)</label><input id="bl-alt" className={CAMPO} value={alt} onChange={event => setAlt(event.target.value)} maxLength={200} placeholder="Fachada do teatro à noite" disabled={salvando} /></div>
          </>
        )}
        {tipo === "botao" && (
          <>
            <div><label className={ROTULO} htmlFor="bl-rotulo">Texto do botão</label><input id="bl-rotulo" autoFocus className={CAMPO} value={rotulo} onChange={event => setRotulo(event.target.value)} maxLength={60} placeholder="Comprar ingressos" disabled={salvando} /></div>
            <div><label className={ROTULO} htmlFor="bl-url">Para onde leva (https://…)</label><input id="bl-url" className={CAMPO} value={url} onChange={event => setUrl(event.target.value)} maxLength={500} disabled={salvando} /></div>
          </>
        )}
        {tipo === "programacao" && (
          <>
            <div><label className={ROTULO} htmlFor="bl-prog">Título (opcional)</label><input id="bl-prog" autoFocus className={CAMPO} value={tituloProg} onChange={event => setTituloProg(event.target.value)} maxLength={120} disabled={salvando} /></div>
          </>
        )}
        {tipo === "contato" && (
          <>
            <div><label className={ROTULO} htmlFor="bl-end">Endereço</label><input id="bl-end" autoFocus className={CAMPO} value={endereco} onChange={event => setEndereco(event.target.value)} maxLength={200} disabled={salvando} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={ROTULO} htmlFor="bl-tel">Telefone</label><input id="bl-tel" className={CAMPO} value={telefone} onChange={event => setTelefone(event.target.value)} maxLength={40} disabled={salvando} /></div>
              <div><label className={ROTULO} htmlFor="bl-email">E-mail</label><input id="bl-email" type="email" className={CAMPO} value={email} onChange={event => setEmail(event.target.value)} maxLength={254} disabled={salvando} /></div>
            </div>
            <p className="text-[0.75rem] text-black/55">O que você escrever aqui fica público no site.</p>
          </>
        )}
      </div>
    </TopSheet>
  );
}

function NovaPaginaSheet({ siteId, organizationId, existentes, onClose, onCreated }: { siteId: string; organizationId: string; existentes: Pagina[]; onClose: () => void; onCreated: (slug: string) => void }) {
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(fechar: () => void) {
    const limpo = titulo.trim();
    if (limpo === "" || limpo.length > 120) { setErro("Dê um título à página (até 120 letras)."); return; }
    const slug = slugDaPagina(limpo, new Set(existentes.map(pagina => pagina.slug)));
    setSalvando(true);
    const { error } = await clienteDaProducao(createClient()).from("producao_site_paginas").insert({ organization_id: organizationId, site_id: siteId, slug, titulo: limpo, ordem: Math.min(1000, Math.max(0, ...existentes.map(pagina => pagina.ordem)) + 10), blocos: [] });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode criar páginas neste site." : "Não foi possível criar a página. Tente de novo."); return; }
    onCreated(slug);
    fechar();
  }

  return (
    <TopSheet
      titulo="Nova página"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void criar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Criando…" : "Criar página"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div><label className={ROTULO} htmlFor="pg-titulo">Título da página</label><input id="pg-titulo" autoFocus className={CAMPO} value={titulo} onChange={event => setTitulo(event.target.value)} placeholder="Quem somos" maxLength={120} disabled={salvando} /></div>
        <p className="text-[0.75rem] text-black/55">O endereço sai do título (Quem somos fica em /quem-somos).</p>
      </div>
    </TopSheet>
  );
}

/** A descrição e a imagem de compartilhamento de uma página: o que buscadores e redes sociais mostram. Salvam na hora, sem publicar de novo. */
function SeoDaPagina({ pagina, podeEditar, onSalvo }: { pagina: Pagina; podeEditar: boolean; onSalvo: () => void }) {
  const [descricao, setDescricao] = useState(pagina.descricao ?? "");
  const [imagem, setImagem] = useState(pagina.imagem_url ?? "");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const mudou = descricao.trim() !== (pagina.descricao ?? "") || imagem.trim() !== (pagina.imagem_url ?? "");

  async function salvar() {
    const leitura = lerSeo({ descricao, imagem });
    if (!leitura.ok) { setAviso({ erro: true, texto: leitura.erro }); return; }
    setSalvando(true);
    setAviso(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_site_paginas").update({ descricao: leitura.descricao, imagem_url: leitura.imagem_url }).eq("id", pagina.id);
    setSalvando(false);
    if (error) { setAviso({ erro: true, texto: error.code === "42501" ? "Você não pode mudar este site." : "Não foi possível salvar. Tente de novo." }); return; }
    setAviso({ erro: false, texto: "Salvo." });
    onSalvo();
  }

  return (
    <details className="mt-6 rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <summary className="cursor-pointer px-4 py-3 text-[0.75rem] font-medium text-black/60 hover:text-black/80">Buscadores e redes sociais</summary>
      <div className="space-y-3 border-t px-4 py-4" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div><label className={ROTULO} htmlFor="seo-descricao">Descrição (até 300 letras)</label><textarea id="seo-descricao" rows={3} className={AREA} value={descricao} onChange={event => setDescricao(event.target.value)} maxLength={300} disabled={!podeEditar || salvando} /></div>
        <div><label className={ROTULO} htmlFor="seo-imagem">Imagem de compartilhamento (https://…)</label><input id="seo-imagem" className={CAMPO} value={imagem} onChange={event => setImagem(event.target.value)} maxLength={500} placeholder="https://…/capa.jpg" disabled={!podeEditar || salvando} /></div>
        {aviso && <p role={aviso.erro ? "alert" : "status"} className={`text-[0.75rem] ${aviso.erro ? "text-[#B23B3B]" : "text-black/55"}`}>{aviso.texto}</p>}
        {podeEditar && <button type="button" onClick={() => void salvar()} disabled={salvando || !mudou} className="inline-flex h-9 items-center rounded bg-[#2E8932] px-3.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40">{salvando ? "Salvando…" : "Salvar"}</button>}
      </div>
    </details>
  );
}

/** As páginas do site e os blocos de cada uma: o rascunho salva a cada mudança, e "Publicar esta página" põe no ar. */
export function EditorDoSite({ siteId, organizationId, podeEditar }: { siteId: string; organizationId: string; podeEditar: boolean }) {
  const { confirmDelete } = useDeleteConfirm();
  const [paginas, setPaginas] = useState<Pagina[] | null>(null);
  const [slug, setSlug] = useState("inicio");
  const [folha, setFolha] = useState<{ tipo: "bloco"; indice: number | null; tipoDeBloco: TipoDeBloco } | { tipo: "pagina" } | null>(null);
  const [novoTipo, setNovoTipo] = useState<string>("texto");
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_site_paginas").select("id, slug, titulo, ordem, blocos, blocos_publicados, publicada_em, descricao, imagem_url").eq("site_id", siteId);
      if (!ativo) return;
      setPaginas(ordemDasPaginas((data ?? []).map(item => ({ ...item, blocos: blocosDoJson(item.blocos), blocos_publicados: item.blocos_publicados === null ? null : blocosDoJson(item.blocos_publicados) }))));
      setErro(error ? "Não foi possível carregar as páginas. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [siteId, versao]);

  const atual = useMemo(() => paginas?.find(pagina => pagina.slug === slug) ?? paginas?.[0] ?? null, [paginas, slug]);
  const publicadaIgual = atual !== null && atual.blocos_publicados !== null && JSON.stringify(atual.blocos_publicados) === JSON.stringify(atual.blocos);

  /** Grava a lista de blocos do rascunho. Devolve a mensagem de erro, ou null se deu certo. */
  async function gravar(blocos: Bloco[]): Promise<string | null> {
    if (!atual) return "Página não encontrada.";
    const { error } = await clienteDaProducao(createClient()).from("producao_site_paginas").update({ blocos }).eq("id", atual.id);
    if (error) return error.code === "42501" ? "Você não pode mudar este site." : "Não foi possível salvar. Tente de novo.";
    recarregar();
    return null;
  }

  async function mover(indice: number, passo: number) {
    if (!atual) return;
    const destino = indice + passo;
    if (destino < 0 || destino >= atual.blocos.length) return;
    const lista = [...atual.blocos];
    [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
    setErro(await gravar(lista));
  }

  async function publicar() {
    if (!atual) return;
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).rpc("fn_producao_site_publicar_pagina", { p_pagina: atual.id });
    if (error) { setErro(error.code === "42501" ? "Você não pode publicar este site." : "Não foi possível publicar. Tente de novo."); return; }
    recarregar();
  }

  function apagarPagina() {
    if (!atual || atual.slug === "inicio") return;
    const alvo = atual;
    confirmDelete({
      title: "Apagar página?", description: `"${alvo.titulo}" sai do site (rascunho e publicada).`, confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_site_paginas").delete().eq("id", alvo.id);
        if (error) throw new Error("Não foi possível apagar a página.");
        setSlug("inicio");
        recarregar();
      },
    });
  }

  return (
    <section aria-labelledby="paginas-do-site">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="paginas-do-site" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Páginas</h2>
        {podeEditar && <PrimaryListAction onClick={() => setFolha({ tipo: "pagina" })}><Plus size={13} aria-hidden="true" /> Nova página</PrimaryListAction>}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {paginas === null ? (
        <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : (
        <>
          <div role="tablist" aria-label="Páginas do site" className="mb-4 flex gap-1 overflow-x-auto">
            {paginas.map(pagina => (
              <button key={pagina.id} type="button" role="tab" aria-selected={atual?.id === pagina.id} onClick={() => setSlug(pagina.slug)} className={`h-10 shrink-0 rounded border px-3.5 text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${atual?.id === pagina.id ? "border-[#282525] bg-black/[.06] font-medium text-[#282525]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}>{pagina.titulo}</button>
            ))}
          </div>
          {atual && (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="mr-auto text-[0.75rem] text-black/55">{atual.publicada_em === null ? "Ainda não publicada." : publicadaIgual ? "Publicada, sem mudanças." : "Há mudanças que ainda não estão no ar."}</p>
                <a href={`/previa-site/${siteId}${atual.slug === "inicio" ? "" : `/${atual.slug}`}`} target="_blank" rel="noopener noreferrer" className={BOTAO}><ExternalLink size={13} aria-hidden="true" /> Ver a prévia</a>
                {podeEditar && <button type="button" onClick={() => void publicar()} disabled={publicadaIgual} className="inline-flex h-9 items-center rounded bg-[#2E8932] px-3.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40">Publicar esta página</button>}
                {podeEditar && atual.slug !== "inicio" && <button type="button" onClick={apagarPagina} className={BOTAO}>Apagar a página</button>}
              </div>
              {atual.blocos.length === 0 ? (
                <p className="rounded border bg-white px-4 py-5 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Página vazia. Acrescente títulos, textos, imagens, botões, a programação e o contato.</p>
              ) : (
                <ol className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  {atual.blocos.map((bloco, indice) => (
                    <li key={indice} className="flex items-center gap-2 px-3 py-2">
                      <button type="button" disabled={!podeEditar} onClick={() => setFolha({ tipo: "bloco", indice, tipoDeBloco: bloco.tipo })} className="min-w-0 flex-1 rounded px-1 py-1 text-left transition enabled:hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                        <span className="block text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{ROTULO_DO_TIPO_DE_BLOCO[bloco.tipo]}</span>
                        <span className="block truncate text-[0.8125rem] text-[#282525]">{resumoDoBloco(bloco)}</span>
                      </button>
                      {podeEditar && (
                        <span className="flex shrink-0 items-center">
                          <button type="button" onClick={() => void mover(indice, -1)} disabled={indice === 0} aria-label="Subir o bloco" className="flex h-8 w-8 items-center justify-center rounded text-black/45 hover:bg-black/[.05] disabled:opacity-30"><ArrowUp size={14} aria-hidden="true" /></button>
                          <button type="button" onClick={() => void mover(indice, 1)} disabled={indice === atual.blocos.length - 1} aria-label="Descer o bloco" className="flex h-8 w-8 items-center justify-center rounded text-black/45 hover:bg-black/[.05] disabled:opacity-30"><ArrowDown size={14} aria-hidden="true" /></button>
                          <button type="button" onClick={() => void gravar(atual.blocos.filter((_, i) => i !== indice)).then(setErro)} aria-label="Tirar o bloco" className="flex h-8 w-8 items-center justify-center rounded text-black/35 hover:bg-black/[.05] hover:text-[#B23B3B]"><Trash2 size={14} aria-hidden="true" /></button>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              <SeoDaPagina key={`${atual.id}-${atual.descricao ?? ""}-${atual.imagem_url ?? ""}`} pagina={atual} podeEditar={podeEditar} onSalvo={recarregar} />
              {podeEditar && atual.blocos.length < 60 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="w-64 max-w-full"><Dropdown ariaLabel="Tipo do novo bloco" value={novoTipo} onChange={setNovoTipo} options={TIPOS_DE_BLOCO.map(tipo => ({ value: tipo, label: ROTULO_DO_TIPO_DE_BLOCO[tipo] }))} /></div>
                  <button type="button" onClick={() => setFolha({ tipo: "bloco", indice: null, tipoDeBloco: novoTipo as TipoDeBloco })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Acrescentar bloco</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {folha?.tipo === "pagina" && paginas && <NovaPaginaSheet siteId={siteId} organizationId={organizationId} existentes={paginas} onClose={() => setFolha(null)} onCreated={novoSlug => { setSlug(novoSlug); recarregar(); }} />}
      {folha?.tipo === "bloco" && atual && (
        <BlocoSheet
          bloco={folha.indice === null ? undefined : atual.blocos[folha.indice]} tipoInicial={folha.tipoDeBloco} onClose={() => setFolha(null)}
          onSalvar={novo => gravar(folha.indice === null ? [...atual.blocos, novo] : atual.blocos.map((existente, i) => (i === folha.indice ? novo : existente)))}
        />
      )}
    </section>
  );
}
