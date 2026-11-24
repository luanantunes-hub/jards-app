"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Eye, GripVertical, PencilLine, Plus, Trash2, X } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { partesNoFuso } from "@/lib/ticketeria/eventos";
import { copiaDeUmaPagina, duplicarBloco, enderecoDaPrevia, moverBloco } from "@/lib/ticketeria/editor-site";
import { PreviaDoSite } from "@/components/ticketeria/PreviaDoSite";
import { CampoDeImagem } from "@/components/ticketeria/CampoDeImagem";
import { VersoesSheet } from "@/components/ticketeria/VersoesDoSite";
import { blocosDoJson, lerBloco, lerSeo, ordemDasPaginas, ROTULO_DO_LAYOUT_DA_AGENDA, ROTULO_DO_LAYOUT_DO_DESTAQUE, ROTULO_DO_TIPO_DE_BLOCO, slugDaPagina, type Bloco, type TipoDeBloco } from "@/lib/ticketeria/site";
import { AcrescentarBlocoSheet, BlocoNovoSheet, TIPOS_DAS_FOLHAS_NOVAS } from "@/components/ticketeria/BlocosNovosSheet";

/** Um evento da loja: a fonte de um bloco de ingressos. */
export type EventoParaBloco = { id: string; titulo: string; situacao: string };

/** Um espaço da Produção da organização: a fonte de um bloco de programação. */
export type EspacoDaProgramacao = { id: string; nome: string };

type Pagina = { id: string; slug: string; titulo: string; ordem: number; blocos: Bloco[]; blocos_publicados: Bloco[] | null; publicada_em: string | null; descricao: string | null; imagem_url: string | null };

const CAMPO = "h-10 w-full rounded-xl border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const AREA = "w-full rounded-xl border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-normal text-black/55";
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/[.12] px-3 text-[0.75rem] font-normal text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

const resumoDoBloco = (bloco: Bloco, espacos: readonly EspacoDaProgramacao[], eventos: readonly EventoParaBloco[] = []): string => {
  switch (bloco.tipo) {
    case "titulo": case "texto": return bloco.texto.slice(0, 120);
    case "imagem": return bloco.alt;
    case "botao": return `${bloco.rotulo} → ${bloco.url}`;
    case "programacao": {
      const espaco = espacos.find(item => item.id === bloco.espaco_id)?.nome;
      return [bloco.titulo, espaco ? `as sessões de ${espaco}` : "sem espaço: o bloco não mostra nada"].filter(Boolean).join(" · ");
    }
    case "ingressos": {
      const evento = eventos.find(item => item.id === bloco.evento_id);
      return [bloco.titulo, evento ? `as sessões de ${evento.titulo}${evento.situacao === "publicado" ? "" : " (o evento ainda não está publicado: o bloco não mostra nada)"}` : "sem evento: o bloco não mostra nada"].filter(Boolean).join(" · ");
    }
    case "contato": return [bloco.endereco, bloco.telefone, bloco.email].filter(Boolean).join(" · ");
    case "capa": return [ROTULO_DO_LAYOUT_DO_DESTAQUE[bloco.layout].nome, bloco.layout === "carrossel" ? `${bloco.slides.length} ${bloco.slides.length === 1 ? "destaque" : "destaques"}` : bloco.layout === "proximo" ? "o próximo evento" : bloco.titulo, bloco.layout === "carrossel" || bloco.layout === "proximo" ? "" : bloco.subtitulo].filter(Boolean).join(" · ");
    case "colunas": return `${bloco.esquerda.tipo === "texto" ? "texto" : "imagem"} e ${bloco.direita.tipo === "texto" ? "texto" : "imagem"}`;
    case "galeria": return [bloco.titulo, `${bloco.imagens.length} imagens`].filter(Boolean).join(" · ");
    case "video": return [bloco.titulo, bloco.provedor === "youtube" ? "YouTube" : "Vimeo"].filter(Boolean).join(" · ");
    case "mapa": return [bloco.titulo, bloco.endereco].filter(Boolean).join(" · ");
    case "contagem": return [bloco.titulo, `até ${partesNoFuso(bloco.ate, "America/Sao_Paulo").dia.split("-").reverse().join("/")} ${partesNoFuso(bloco.ate, "America/Sao_Paulo").hora}`].filter(Boolean).join(" · ");
    case "faq": return [bloco.titulo, `${bloco.itens.length} ${bloco.itens.length === 1 ? "pergunta" : "perguntas"}`].filter(Boolean).join(" · ");
    case "agenda": return [bloco.titulo, `os eventos da loja · ${ROTULO_DO_LAYOUT_DA_AGENDA[bloco.layout].nome.toLowerCase()}`].filter(Boolean).join(" · ");
    case "patrocinadores": return [bloco.titulo, `${bloco.itens.length} ${bloco.itens.length === 1 ? "patrocinador" : "patrocinadores"}`].filter(Boolean).join(" · ");
  }
};

export function BlocoSheet({ bloco, tipoInicial, organizationId, espacos, eventos = [], onClose, onSalvar }: { bloco?: Bloco; organizationId: string; tipoInicial: TipoDeBloco; espacos: readonly EspacoDaProgramacao[]; eventos?: readonly EventoParaBloco[]; onClose: () => void; onSalvar: (bloco: Bloco) => Promise<string | null> }) {
  const tipo = bloco?.tipo ?? tipoInicial;
  const [texto, setTexto] = useState(bloco && (bloco.tipo === "titulo" || bloco.tipo === "texto") ? bloco.texto : "");
  const [url, setUrl] = useState(bloco && (bloco.tipo === "imagem" || bloco.tipo === "botao") ? bloco.url : "https://");
  const [alt, setAlt] = useState(bloco?.tipo === "imagem" ? bloco.alt : "");
  const [rotulo, setRotulo] = useState(bloco?.tipo === "botao" ? bloco.rotulo : "");
  const [tituloProg, setTituloProg] = useState(bloco?.tipo === "programacao" ? bloco.titulo : "Programação");
  const [espacoId, setEspacoId] = useState(bloco?.tipo === "programacao" && bloco.espaco_id ? bloco.espaco_id : espacos[0]?.id ?? "");
  const [tituloIng, setTituloIng] = useState(bloco?.tipo === "ingressos" ? bloco.titulo : "Ingressos");
  const [eventoId, setEventoId] = useState(bloco?.tipo === "ingressos" && bloco.evento_id ? bloco.evento_id : eventos.find(e => e.situacao === "publicado")?.id ?? eventos[0]?.id ?? "");
  const [email, setEmail] = useState(bloco?.tipo === "contato" ? bloco.email : "");
  const [telefone, setTelefone] = useState(bloco?.tipo === "contato" ? bloco.telefone : "");
  const [endereco, setEndereco] = useState(bloco?.tipo === "contato" ? bloco.endereco : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    if (tipo === "programacao" && !espacos.some(espaco => espaco.id === espacoId)) { setErro("Escolha o espaço da Produção de onde vem a programação."); return; }
    if (tipo === "ingressos" && !eventos.some(evento => evento.id === eventoId)) { setErro("Escolha o evento dos ingressos."); return; }
    const leitura = lerBloco({ tipo, texto, url, alt, rotulo, titulo: tipo === "ingressos" ? tituloIng : tituloProg, espaco_id: espacoId, evento_id: eventoId, email, telefone, endereco });
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
          <button type="button" onClick={fechar} disabled={salvando} className="rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded-xl acao-salvar px-4 py-2.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : bloco ? "Salvar" : "Acrescentar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded-xl border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {tipo === "titulo" && <div><label className={ROTULO} htmlFor="bl-texto">Título</label><input id="bl-texto" autoFocus className={CAMPO} value={texto} onChange={event => setTexto(event.target.value)} maxLength={120} disabled={salvando} /></div>}
        {tipo === "texto" && <div><label className={ROTULO} htmlFor="bl-texto">Texto (uma linha em branco separa os parágrafos)</label><textarea id="bl-texto" autoFocus rows={8} className={AREA} value={texto} onChange={event => setTexto(event.target.value)} maxLength={5000} disabled={salvando} /></div>}
        {tipo === "imagem" && (
          <>
            <CampoDeImagem id="bl-url" rotulo="Endereço da imagem (https://…) ou da biblioteca" valor={url} onChange={setUrl} organizationId={organizationId} desabilitado={salvando} />
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
            {espacos.length === 0 ? (
              <p className="text-[0.75rem] text-black/55">A programação vem dos espaços da Produção, e esta organização não tem nenhum. Cadastre um espaço na Produção para mostrar as sessões dele aqui.</p>
            ) : (
              <div><span className={ROTULO}>Espaço</span><Dropdown ariaLabel="Espaço da programação" value={espacoId} onChange={setEspacoId} disabled={salvando} options={espacos.map(espaco => ({ value: espaco.id, label: espaco.nome }))} /></div>
            )}
            <p className="text-[0.75rem] text-black/55">Mostra as sessões confirmadas do espaço, de hoje em diante.</p>
          </>
        )}
        {tipo === "ingressos" && (
          <>
            <div><label className={ROTULO} htmlFor="bl-ing">Título (opcional)</label><input id="bl-ing" autoFocus className={CAMPO} value={tituloIng} onChange={event => setTituloIng(event.target.value)} maxLength={120} disabled={salvando} /></div>
            {eventos.length === 0 ? (
              <p className="text-[0.75rem] text-black/55">Os ingressos vêm dos eventos da loja, e ainda não há nenhum. Crie e publique um evento para mostrar as sessões dele aqui.</p>
            ) : (
              <div><span className={ROTULO}>Evento</span><Dropdown ariaLabel="Evento dos ingressos" value={eventoId} onChange={setEventoId} disabled={salvando} options={eventos.map(evento => ({ value: evento.id, label: evento.situacao === "publicado" ? evento.titulo : `${evento.titulo} (não publicado)` }))} /></div>
            )}
            <p className="text-[0.75rem] text-black/55">Mostra as sessões que ainda vão acontecer, cada uma com o botão que leva à compra. O evento precisa estar publicado.</p>
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
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_site_paginas").insert({ organization_id: organizationId, site_id: siteId, slug, titulo: limpo, ordem: Math.min(1000, Math.max(0, ...existentes.map(pagina => pagina.ordem)) + 10), blocos: [] });
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
          <button type="button" onClick={fechar} disabled={salvando} className="rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void criar(fechar)} disabled={salvando} className="rounded-xl acao-salvar px-4 py-2.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Criando…" : "Criar página"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded-xl border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div><label className={ROTULO} htmlFor="pg-titulo">Título da página</label><input id="pg-titulo" autoFocus className={CAMPO} value={titulo} onChange={event => setTitulo(event.target.value)} placeholder="Quem somos" maxLength={120} disabled={salvando} /></div>
        <p className="text-[0.75rem] text-black/55">O endereço sai do título (Quem somos fica em /quem-somos).</p>
      </div>
    </TopSheet>
  );
}

/** A descrição e a imagem de compartilhamento de uma página: o que buscadores e redes sociais mostram. Salvam na hora, sem publicar de novo. */
function SeoDaPagina({ pagina, organizationId, podeEditar, onSalvo }: { pagina: Pagina; organizationId: string; podeEditar: boolean; onSalvo: () => void }) {
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
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_site_paginas").update({ descricao: leitura.descricao, imagem_url: leitura.imagem_url }).eq("id", pagina.id);
    setSalvando(false);
    if (error) { setAviso({ erro: true, texto: error.code === "42501" ? "Você não pode mudar este site." : "Não foi possível salvar. Tente de novo." }); return; }
    setAviso({ erro: false, texto: "Salvo." });
    onSalvo();
  }

  return (
    <details className="mt-6 rounded-xl border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <summary className="cursor-pointer px-4 py-3 text-[0.75rem] font-normal text-black/60 hover:text-black/80">Buscadores e redes sociais</summary>
      <div className="space-y-3 border-t px-4 py-4" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div><label className={ROTULO} htmlFor="seo-descricao">Descrição (até 300 letras)</label><textarea id="seo-descricao" rows={3} className={AREA} value={descricao} onChange={event => setDescricao(event.target.value)} maxLength={300} disabled={!podeEditar || salvando} /></div>
        <CampoDeImagem id="seo-imagem" rotulo="Imagem de compartilhamento (https://…) ou da biblioteca" valor={imagem} onChange={setImagem} organizationId={organizationId} desabilitado={!podeEditar} placeholder="https://…/capa.jpg" />
        {aviso && <p role={aviso.erro ? "alert" : "status"} className={`text-[0.75rem] ${aviso.erro ? "text-[#B23B3B]" : "text-black/55"}`}>{aviso.texto}</p>}
        {podeEditar && <button type="button" onClick={() => void salvar()} disabled={salvando || !mudou} className="inline-flex h-9 items-center rounded-xl acao-salvar px-3.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40">{salvando ? "Salvando…" : "Salvar"}</button>}
      </div>
    </details>
  );
}

/**
 * O editor do site em TELA INTEIRA (pedido do dono em 20/11/2026): por cima do painel, o editor das páginas à esquerda e a prévia da página de verdade à direita. O rascunho salva a cada
 * mudança, e "Publicar esta página" põe no ar. Em tela estreita (celular), um botão alterna entre o editor e a prévia. `onFechar` volta para a tela do site.
 */
export function EditorDoSite({ siteId, nomeDoSite, organizationId, podeEditar, espacos, eventos = [], onFechar }: { siteId: string; nomeDoSite: string; organizationId: string; podeEditar: boolean; espacos: readonly EspacoDaProgramacao[]; eventos?: readonly EventoParaBloco[]; onFechar: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [paginas, setPaginas] = useState<Pagina[] | null>(null);
  const [slug, setSlug] = useState("inicio");
  const [folha, setFolha] = useState<{ tipo: "bloco"; indice: number | null; tipoDeBloco: TipoDeBloco } | { tipo: "pagina" } | { tipo: "escolher" } | { tipo: "versoes" } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  // Em tela larga o editor e a prévia ficam lado a lado; em tela estreita, um de cada vez (este botão alterna).
  const [mostrarPrevia, setMostrarPrevia] = useState(false);
  const recarregar = () => setVersao(atual => atual + 1);

  // O editor ocupa a tela: o painel por baixo não rola enquanto ele está aberto.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, []);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaTicketeria(createClient()).from("ticketeria_site_paginas").select("id, slug, titulo, ordem, blocos, blocos_publicados, publicada_em, descricao, imagem_url").eq("site_id", siteId);
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
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_site_paginas").update({ blocos }).eq("id", atual.id);
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

  /** Arrastar: leva o bloco de `de` para `para` e grava. */
  async function reordenar(de: number, para: number) {
    if (!atual || de === para) return;
    setErro(await gravar(moverBloco(atual.blocos, de, para)));
  }

  /** Duplicar: uma cópia do bloco logo depois dele. */
  async function duplicar(indice: number) {
    if (!atual) return;
    const lista = duplicarBloco(atual.blocos, indice);
    if (!lista) { setErro("A página já tem 60 blocos, o máximo."); return; }
    setErro(await gravar(lista));
  }

  /** Duplicar a página: uma nova, em rascunho, com os mesmos blocos, a descrição e a imagem de compartilhamento. */
  async function duplicarPagina() {
    if (!atual || !paginas) return;
    setErro(null);
    const copia = copiaDeUmaPagina(atual.titulo, paginas);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_site_paginas").insert({
      organization_id: organizationId, site_id: siteId, slug: copia.slug, titulo: copia.titulo, ordem: Math.min(1000, Math.max(0, ...paginas.map(pagina => pagina.ordem)) + 1),
      blocos: atual.blocos, descricao: atual.descricao, imagem_url: atual.imagem_url,
    });
    if (error) { setErro(error.code === "42501" ? "Você não pode criar páginas neste site." : "Não foi possível duplicar a página. Tente de novo."); return; }
    setSlug(copia.slug);
    recarregar();
  }

  async function publicar() {
    if (!atual) return;
    setErro(null);
    const { error } = await clienteDaTicketeria(createClient()).rpc("fn_ticketeria_site_publicar_pagina", { p_pagina: atual.id });
    if (error) { setErro(error.code === "42501" ? "Você não pode publicar este site." : "Não foi possível publicar. Tente de novo."); return; }
    recarregar();
  }

  function apagarPagina() {
    if (!atual || atual.slug === "inicio") return;
    const alvo = atual;
    confirmDelete({
      title: "Apagar página?", description: `"${alvo.titulo}" sai do site (rascunho e publicada).`, confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_site_paginas").delete().eq("id", alvo.id);
        if (error) throw new Error("Não foi possível apagar a página.");
        setSlug("inicio");
        recarregar();
      },
    });
  }

  const tela = (
    <div role="dialog" aria-modal="false" aria-label="Editor do site" className="fixed inset-0 z-[45] flex flex-col bg-[#F7F6F4]">
      <header className="shrink-0 border-b bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button type="button" onClick={onFechar} className={`${BOTAO} shrink-0`}><X size={13} aria-hidden="true" /><span className="sm:hidden">Fechar</span><span className="hidden sm:inline">Fechar o editor</span></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.875rem] font-medium text-[#282525]">{nomeDoSite}</p>
            {atual && <p className="truncate text-[0.6875rem] text-black/50">{atual.publicada_em === null ? "Ainda não publicada." : publicadaIgual ? "Publicada, sem mudanças." : "Há mudanças que ainda não estão no ar."}</p>}
          </div>
          <button type="button" onClick={() => setMostrarPrevia(valor => !valor)} aria-pressed={mostrarPrevia} className={`${BOTAO} lg:hidden`}>{mostrarPrevia ? <><PencilLine size={13} aria-hidden="true" /> Editar</> : <><Eye size={13} aria-hidden="true" /> Prévia</>}</button>
          {podeEditar && atual && <button type="button" onClick={() => void publicar()} disabled={publicadaIgual} className="inline-flex h-9 shrink-0 items-center rounded-xl acao-salvar px-3.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40"><span className="sm:hidden">Publicar</span><span className="hidden sm:inline">Publicar esta página</span></button>}
        </div>
        {paginas !== null && (
          <div className="flex items-center gap-2 border-t px-4 py-2" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            <div role="tablist" aria-label="Páginas do site" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
              {paginas.map(pagina => (
                <button key={pagina.id} type="button" role="tab" aria-selected={atual?.id === pagina.id} onClick={() => { setSlug(pagina.slug); setAviso(null); }} className={`h-9 shrink-0 rounded-xl border px-3.5 text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${atual?.id === pagina.id ? "border-[#6450D2] bg-[#6450D2] text-white" : "border-black/[.12] bg-white text-black/60 hover:bg-black/[.04]"}`}>{pagina.titulo}</button>
              ))}
            </div>
            {podeEditar && <button type="button" onClick={() => setFolha({ tipo: "pagina" })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Nova página</button>}
          </div>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className={`min-h-0 w-full overflow-y-auto border-black/[.08] bg-white p-4 lg:w-[440px] lg:shrink-0 lg:border-r ${mostrarPrevia ? "hidden lg:block" : "flex-1 lg:flex-none"}`}>
          {aviso && <p role="status" className="mb-3 rounded-xl border border-black/[.1] bg-white px-4 py-2.5 text-[0.75rem] text-black/70">{aviso}</p>}
          {erro && <p role="alert" className="mb-3 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
          {paginas === null ? (
            <div className="h-24 rounded-xl border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
          ) : atual && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <a href={enderecoDaPrevia(siteId, atual.slug)} target="_blank" rel="noopener noreferrer" className={BOTAO}><ExternalLink size={13} aria-hidden="true" /> Ver em outra aba</a>
                {podeEditar && <button type="button" onClick={() => setFolha({ tipo: "versoes" })} className={BOTAO}>Versões</button>}
                {podeEditar && <button type="button" onClick={() => void duplicarPagina()} className={BOTAO}>Duplicar a página</button>}
                {podeEditar && atual.slug !== "inicio" && <button type="button" onClick={apagarPagina} className={BOTAO}>Apagar a página</button>}
              </div>
              {atual.blocos.length === 0 ? (
                <p className="rounded-xl border bg-white px-4 py-5 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Página vazia. Acrescente títulos, textos, imagens, botões e o contato.</p>
              ) : (
                <ol className="divide-y divide-black/[.06] overflow-hidden rounded-xl border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  {atual.blocos.map((bloco, indice) => (
                    <li
                      key={indice}
                      draggable={podeEditar}
                      onDragStart={event => { setArrastando(indice); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(indice)); }}
                      onDragOver={event => { if (arrastando !== null) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (sobre !== indice) setSobre(indice); } }}
                      onDrop={event => { event.preventDefault(); if (arrastando !== null) void reordenar(arrastando, indice); setArrastando(null); setSobre(null); }}
                      onDragEnd={() => { setArrastando(null); setSobre(null); }}
                      className={`flex items-center gap-2 px-3 py-2 ${arrastando === indice ? "bg-black/[.04] opacity-60" : ""} ${sobre === indice && arrastando !== null && arrastando !== indice ? "shadow-[inset_0_2px_0_#7259B5]" : ""}`}
                    >
                      {podeEditar && <span aria-hidden="true" title="Arraste para mudar a ordem" className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-black/30 active:cursor-grabbing"><GripVertical size={14} /></span>}
                      <button type="button" disabled={!podeEditar} onClick={() => setFolha({ tipo: "bloco", indice, tipoDeBloco: bloco.tipo })} className="min-w-0 flex-1 rounded-xl px-1 py-1 text-left transition enabled:hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                        <span className="block text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">{ROTULO_DO_TIPO_DE_BLOCO[bloco.tipo]}</span>
                        <span className="block truncate text-[0.8125rem] text-[#282525]">{resumoDoBloco(bloco, espacos, eventos)}</span>
                      </button>
                      {podeEditar && (
                        <span className="flex shrink-0 items-center">
                          <button type="button" onClick={() => void mover(indice, -1)} disabled={indice === 0} aria-label="Subir o bloco" className="flex h-8 w-8 items-center justify-center rounded-xl text-black/45 hover:bg-black/[.05] disabled:opacity-30"><ArrowUp size={14} aria-hidden="true" /></button>
                          <button type="button" onClick={() => void mover(indice, 1)} disabled={indice === atual.blocos.length - 1} aria-label="Descer o bloco" className="flex h-8 w-8 items-center justify-center rounded-xl text-black/45 hover:bg-black/[.05] disabled:opacity-30"><ArrowDown size={14} aria-hidden="true" /></button>
                          <button type="button" onClick={() => void duplicar(indice)} disabled={atual.blocos.length >= 60} aria-label="Duplicar o bloco" title="Duplicar o bloco" className="flex h-8 w-8 items-center justify-center rounded-xl text-black/45 hover:bg-black/[.05] disabled:opacity-30"><Copy size={14} aria-hidden="true" /></button>
                          <button type="button" onClick={() => void gravar(atual.blocos.filter((_, i) => i !== indice)).then(setErro)} aria-label="Tirar o bloco" className="flex h-8 w-8 items-center justify-center rounded-xl text-black/35 hover:bg-black/[.05] hover:text-[#B23B3B]"><Trash2 size={14} aria-hidden="true" /></button>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              <SeoDaPagina key={`${atual.id}-${atual.descricao ?? ""}-${atual.imagem_url ?? ""}`} pagina={atual} organizationId={organizationId} podeEditar={podeEditar} onSalvo={recarregar} />
              {podeEditar && atual.blocos.length < 60 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setFolha({ tipo: "escolher" })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Acrescentar bloco</button>
                </div>
              )}
            </>
          )}
        </div>
        <div className={`min-h-0 flex-1 p-4 ${mostrarPrevia ? "" : "hidden lg:block"}`}>
          {atual ? <PreviaDoSite siteId={siteId} slug={atual.slug} versao={versao} telaInteira /> : null}
        </div>
      </div>
      {folha?.tipo === "pagina" && paginas && <NovaPaginaSheet siteId={siteId} organizationId={organizationId} existentes={paginas} onClose={() => setFolha(null)} onCreated={novoSlug => { setSlug(novoSlug); recarregar(); }} />}
      {folha?.tipo === "versoes" && atual && (
        <VersoesSheet paginaId={atual.id} titulo={atual.titulo} publicados={atual.blocos_publicados} podeEditar={podeEditar} onClose={() => setFolha(null)} onRestaurado={mensagem => { setAviso(mensagem); recarregar(); }} />
      )}
      {folha?.tipo === "escolher" && (
        <AcrescentarBlocoSheet temEspacos={espacos.length > 0} temEventos={eventos.length > 0} onClose={() => setFolha(null)} onEscolher={tipoDeBloco => setFolha({ tipo: "bloco", indice: null, tipoDeBloco })} />
      )}
      {folha?.tipo === "bloco" && atual && TIPOS_DAS_FOLHAS_NOVAS.includes(folha.tipoDeBloco) && (
        <BlocoNovoSheet
          organizationId={organizationId}
          bloco={folha.indice === null ? undefined : atual.blocos[folha.indice]} tipo={folha.tipoDeBloco} onClose={() => setFolha(null)}
          onSalvar={novo => gravar(folha.indice === null ? [...atual.blocos, novo] : atual.blocos.map((existente, i) => (i === folha.indice ? novo : existente)))}
        />
      )}
      {folha?.tipo === "bloco" && atual && !TIPOS_DAS_FOLHAS_NOVAS.includes(folha.tipoDeBloco) && (
        <BlocoSheet
          organizationId={organizationId}
          bloco={folha.indice === null ? undefined : atual.blocos[folha.indice]} tipoInicial={folha.tipoDeBloco} espacos={espacos} eventos={eventos} onClose={() => setFolha(null)}
          onSalvar={novo => gravar(folha.indice === null ? [...atual.blocos, novo] : atual.blocos.map((existente, i) => (i === folha.indice ? novo : existente)))}
        />
      )}
    </div>
  );
  // O editor só se abre por um clique (nunca vem no HTML do servidor); a guarda é para quem o montar já no carregamento.
  return typeof document === "undefined" ? null : createPortal(tela, document.body);
}
