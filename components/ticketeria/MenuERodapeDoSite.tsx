"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { APARENCIA_PADRAO, destinoDoBotaoDoMenu, type AparenciaDoSite, type LinkDoSite } from "@/lib/ticketeria/aparencia";
import { textoSobreCor } from "@/lib/ticketeria/site";

// O menu do alto e o rodapé do site da loja (a biblioteca de seções, passo 4; layouts aprovados pelo dono em 20/11/2026). O menu fica na cor do site e tem quatro layouts: clássico com
// botão de ingressos, duas camadas (faixa fina para imprensa, contato e afins), mínimo (o resto atrás de "Menu") e centralizado. No celular os links vão para um painel que abre
// pelo botão de menu; o botão de ingressos continua à vista. O rodapé tem três layouts: simples, em colunas e com convite para a newsletter. Lê do tema e da cor do site.

type Pagina = { slug: string; titulo: string };
const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2";

function BotaoDeIngressos({ destino, claro }: { destino: { rotulo: string; url: string; externo: boolean }; claro: boolean }) {
  return <a href={destino.url} {...(destino.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-[var(--site-raio)] px-4 text-[0.875rem] font-semibold transition hover:opacity-90 ${FOCO} ${claro ? "bg-white text-[#1a1426]" : "bg-[#282525] text-white"}`}>{destino.rotulo}</a>;
}

function LinkDeFaixa({ l }: { l: LinkDoSite }) {
  return <a href={l.url} target="_blank" rel="noopener noreferrer" className={`underline-offset-4 hover:underline ${FOCO}`}>{l.rotulo}</a>;
}

/** `base` é o começo do endereço das páginas ("" no domínio da pessoa; o caminho da prévia no painel). Só dados simples: o menu é um componente do navegador e não recebe funções do servidor. */
export function MenuDoSite({ titulo, cor, paginas, paginaAtual, base, aparencia = APARENCIA_PADRAO, caminhoDoPrimeiroEvento = null }: {
  titulo: string; cor: string; paginas: Pagina[]; paginaAtual: string; base: string; aparencia?: AparenciaDoSite; caminhoDoPrimeiroEvento?: string | null;
}) {
  const caminhoDe = (slug: string) => (slug === "inicio" ? base || "/" : `${base}/${slug}`);
  const [aberto, setAberto] = useState(false);
  const painel = useId();
  const texto = textoSobreCor(cor);
  const claro = texto === "#ffffff";
  const c = aparencia.cabecalho;
  const botao = destinoDoBotaoDoMenu(c, caminhoDoPrimeiroEvento);
  const links = paginas.length > 1 ? paginas : [];
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  const nome = <a href={caminhoDe("inicio")} className={`text-[1.125rem] font-medium tracking-[-.01em] ${FOCO}`} style={{ color: texto }}>{titulo}</a>;
  const linksDoMenu = (
    <ul className="flex flex-wrap gap-x-5 gap-y-1">
      {links.map(item => <li key={item.slug}><a href={caminhoDe(item.slug)} aria-current={item.slug === paginaAtual ? "page" : undefined} className={`text-[0.875rem] underline-offset-4 hover:underline ${item.slug === paginaAtual ? "underline" : ""} ${FOCO}`} style={{ color: texto }}>{item.titulo}</a></li>)}
    </ul>
  );
  const botaoDoMenu = (rotulo: ReactNode, escondidoNoComputador: boolean) => (
    <button type="button" aria-expanded={aberto} aria-controls={painel} aria-label={aberto ? "Fechar o menu" : "Abrir o menu"} onClick={() => setAberto(v => !v)} className={`inline-flex min-h-10 items-center gap-1.5 rounded-[var(--site-raio)] border px-3 text-[0.875rem] ${escondidoNoComputador ? "md:hidden" : ""} ${FOCO}`} style={{ color: texto, borderColor: "currentColor" }}>{rotulo}</button>
  );
  const mostraPainelNoComputador = c.layout === "minimo";
  const painelAberto = aberto && (links.length > 0 || c.faixa.length > 0 || botao !== null);

  return (
    <header style={{ backgroundColor: cor, color: texto }}>
      {c.layout === "duas_camadas" && c.faixa.length > 0 && (
        <div className="hidden bg-black/20 md:block"><div className="mx-auto flex w-full max-w-[56rem] justify-end gap-5 px-6 py-1.5 text-[0.75rem]">{c.faixa.map((l, i) => <LinkDeFaixa key={i} l={l} />)}</div></div>
      )}
      <div className={`mx-auto flex w-full max-w-[56rem] items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6 ${c.layout === "centralizado" ? "flex-col md:py-5" : "flex-wrap justify-between"}`}>
        {c.layout === "centralizado" ? (
          <>
            <div className="flex w-full items-center justify-between md:justify-center">{nome}<span className="flex items-center gap-2 md:hidden">{botao && <BotaoDeIngressos destino={botao} claro={claro} />}{links.length > 0 && botaoDoMenu("☰", true)}</span></div>
            {links.length > 0 && <nav aria-label="Páginas do site" className="hidden md:block">{linksDoMenu}</nav>}
            {botao && <span className="hidden md:block"><BotaoDeIngressos destino={botao} claro={claro} /></span>}
          </>
        ) : (
          <>
            {nome}
            {links.length > 0 && !mostraPainelNoComputador && <nav aria-label="Páginas do site" className="hidden flex-1 md:block">{linksDoMenu}</nav>}
            <div className="ml-auto flex items-center gap-2">
              {botao && <BotaoDeIngressos destino={botao} claro={claro} />}
              {mostraPainelNoComputador ? botaoDoMenu("☰ Menu", false) : (links.length > 0 || c.faixa.length > 0) && botaoDoMenu("☰", true)}
            </div>
          </>
        )}
      </div>
      {painelAberto && (
        <nav id={painel} aria-label="Menu do site" className="border-t px-4 py-3 sm:px-6" style={{ borderColor: "rgba(255,255,255,.25)" }}>
          <div className="mx-auto flex w-full max-w-[56rem] flex-col gap-3">
            {linksDoMenu}
            {c.faixa.length > 0 && <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem] opacity-90">{c.faixa.map((l, i) => <LinkDeFaixa key={i} l={l} />)}</div>}
          </div>
        </nav>
      )}
    </header>
  );
}

// ─── O rodapé ───────────────────────────────────────────────────────────────

const FUNDO_DO_RODAPE = { backgroundColor: "var(--site-borda)" };

function Linhas({ linhas }: { linhas: (string | null)[] }) {
  const itens = linhas.filter((x): x is string => Boolean(x));
  return itens.length === 0 ? null : <p className="opacity-75">{itens.map((l, i) => <span key={i} className="block">{l}</span>)}</p>;
}

function ListaDeLinks({ links }: { links: LinkDoSite[] }) {
  return <ul className="flex flex-col gap-1.5">{links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer" className={`underline-offset-4 hover:underline ${FOCO}`}>{l.rotulo}</a></li>)}</ul>;
}

export function RodapeDoSite({ titulo, aparencia = APARENCIA_PADRAO }: { titulo: string; aparencia?: AparenciaDoSite }) {
  const r = aparencia.rodape;
  const nome = r.nome || titulo;
  const base = "mx-auto w-full max-w-[56rem] px-4 py-8 text-[0.8125rem] sm:px-6";
  if (r.layout === "colunas" || r.layout === "newsletter") {
    return (
      <footer style={FUNDO_DO_RODAPE}>
        <div className={`${base} grid gap-8 sm:grid-cols-2 ${r.layout === "newsletter" ? "md:grid-cols-[1.4fr_1fr_1fr]" : "md:grid-cols-[1.3fr_1fr_1fr_1fr]"}`}>
          {r.layout === "newsletter" ? (
            <div className="flex flex-col gap-2">
              <b className="text-[1rem] font-medium [font-family:var(--site-fonte-titulos)]">{r.chamada || "Receba a programação"}</b>
              {r.texto && <p className="opacity-75">{r.texto}</p>}
              {r.botao_url && r.botao_rotulo && <a href={r.botao_url} target="_blank" rel="noopener noreferrer" className={`mt-1 inline-flex min-h-10 w-fit items-center rounded-[var(--site-raio)] bg-[color:var(--site-botao)] px-4 text-[0.875rem] font-semibold text-[color:var(--site-botao-texto)] ${FOCO}`}>{r.botao_rotulo}</a>}
              <Linhas linhas={[r.endereco, r.horario, r.contato]} />
            </div>
          ) : (
            <div className="flex flex-col gap-2"><b className="text-[1rem] font-medium [font-family:var(--site-fonte-titulos)]">{nome}</b><Linhas linhas={[r.endereco, r.horario, r.contato]} /></div>
          )}
          {r.colunas.map((c, i) => <div key={i}><h3 className="mb-2 text-[0.75rem] font-semibold uppercase tracking-[.07em]">{c.titulo}</h3><ListaDeLinks links={c.links} /></div>)}
          {(r.redes.length > 0 || r.politicas.length > 0) && <div className="sm:col-span-full flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t pt-4" style={{ borderColor: "var(--site-borda)" }}><span className="flex flex-wrap gap-x-4 gap-y-1">{r.redes.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className={`underline-offset-4 hover:underline ${FOCO}`}>{l.rotulo}</a>)}</span><span className="flex flex-wrap gap-x-4 gap-y-1 opacity-75">{r.politicas.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className={`underline-offset-4 hover:underline ${FOCO}`}>{l.rotulo}</a>)}</span></div>}
        </div>
      </footer>
    );
  }
  const todos = [...r.redes, ...r.politicas];
  return (
    <footer style={FUNDO_DO_RODAPE}>
      <div className={`${base} flex flex-wrap items-center justify-between gap-x-8 gap-y-2`}>
        <b className="text-[1rem] font-medium [font-family:var(--site-fonte-titulos)]">{nome}</b>
        {(r.contato || r.endereco) && <span className="opacity-75">{[r.contato, r.endereco].filter(Boolean).join(" · ")}</span>}
        {todos.length > 0 && <span className="flex flex-wrap gap-x-4 gap-y-1">{todos.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className={`underline-offset-4 hover:underline ${FOCO}`}>{l.rotulo}</a>)}</span>}
      </div>
    </footer>
  );
}
