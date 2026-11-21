"use client";

import { useEffect, useState, type ReactNode } from "react";
import { botoesDoProximoEvento, caminhoDoEvento, chamadaDoProximoEvento, contagemParaOEvento, type ItemDaAgenda } from "@/lib/ticketeria/evento-site";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import type { Bloco, SlideDoDestaque } from "@/lib/ticketeria/site";

// O destaque do alto da página, em cinco layouts (a biblioteca de seções, passo 3; desenhos aprovados pelo dono em 20/11/2026): imagem de tela cheia, dividido (texto e imagem), carrossel,
// próximo evento (automático, lido dos eventos publicados) e imagem com cartão sobreposto. Lê do tema do site. O texto sobre imagem sempre leva um degradê escuro para ler. O carrossel
// passa sozinho a cada 6 segundos, para quando a pessoa passa o mouse ou usa o teclado, tem botão de pausa e não anda se a pessoa pediu menos movimento.

type Destaque = Extract<Bloco, { tipo: "capa" }>;

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2";
const BASE = `inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[var(--site-raio)] px-5 text-[0.9375rem] font-semibold transition hover:opacity-90 ${FOCO}`;
const SOBRE_IMAGEM = `${BASE} bg-white text-[#1a1426]`;
const SOBRE_IMAGEM_VAZADO = `${BASE} border border-white/80 text-white`;
const SOBRE_O_SITE = `${BASE} bg-[color:var(--site-botao)] text-[color:var(--site-botao-texto)]`;
const SOBRE_O_SITE_VAZADO = `${BASE} border border-[color:var(--site-texto)]/40`;

type Botao = { texto: string; url: string | null };

function Link({ botao, classe }: { botao: Botao; classe: string }) {
  return botao.url === null
    ? <span className={classe}>{botao.texto}</span>
    : <a href={botao.url} target="_blank" rel="noopener noreferrer" className={classe}>{botao.texto}</a>;
}

/** A imagem de fundo; sem imagem, a cor do site com um degradê. */
function Fundo({ imagem, cor, eager }: { imagem: string; cor: string; eager?: boolean }) {
  return (
    <>
      {imagem
        // eslint-disable-next-line @next/next/no-img-element -- imagem de endereço externo (https), sem otimização do Next
        ? <img src={imagem} alt="" loading={eager ? "eager" : "lazy"} referrerPolicy="no-referrer" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        : <span aria-hidden="true" className="absolute inset-0 -z-20" style={{ background: `linear-gradient(150deg, ${cor}, #0d0a14)` }} />}
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
    </>
  );
}

const Selo = ({ texto, claro }: { texto: string; claro: boolean }) => (
  <span className={`inline-flex self-start rounded-full px-3 py-1 text-[0.75rem] font-semibold ${claro ? "bg-white/20 text-white" : "bg-[color:var(--site-borda)]"}`}>{texto}</span>
);

function botoesDe(rotulo: string, url: string, rotulo2?: string, url2?: string): Botao[] {
  const lista: Botao[] = [];
  if (rotulo) lista.push({ texto: rotulo, url });
  if (rotulo2 && url2) lista.push({ texto: rotulo2, url: url2 });
  return lista;
}

function TelaCheia({ b, cor }: { b: Pick<Destaque, "titulo" | "subtitulo" | "imagem" | "botao_rotulo" | "botao_url" | "botao2_rotulo" | "botao2_url" | "chamada">; cor: string }) {
  const botoes = botoesDe(b.botao_rotulo, b.botao_url, b.botao2_rotulo, b.botao2_url);
  return (
    <section aria-label={b.titulo} className="relative isolate flex min-h-[22rem] items-end overflow-hidden rounded-[var(--site-raio)] text-white sm:min-h-[26rem]">
      <Fundo imagem={b.imagem} cor={cor} eager />
      <div className="flex w-full flex-col gap-3 p-5 pt-24 sm:p-8 sm:pt-32">
        {b.chamada && <Selo texto={b.chamada} claro />}
        <h2 className="max-w-[18ch] text-[2rem] font-medium leading-[1.05] tracking-[-.02em] sm:text-[2.75rem]">{b.titulo}</h2>
        {b.subtitulo && <p className="max-w-[46ch] text-[1rem] leading-relaxed opacity-95">{b.subtitulo}</p>}
        {botoes.length > 0 && <div className="mt-1 flex flex-wrap gap-2.5">{botoes.map((x, i) => <Link key={i} botao={x} classe={i === 0 ? SOBRE_IMAGEM : SOBRE_IMAGEM_VAZADO} />)}</div>}
      </div>
    </section>
  );
}

function Dividido({ b, cor }: { b: Destaque; cor: string }) {
  const botoes = botoesDe(b.botao_rotulo, b.botao_url, b.botao2_rotulo, b.botao2_url);
  return (
    <section aria-label={b.titulo} className="grid overflow-hidden rounded-[var(--site-raio)] border border-[color:var(--site-borda)] md:grid-cols-2">
      <div className="order-2 flex flex-col justify-center gap-3 p-5 sm:p-8 md:order-1">
        {b.chamada && <Selo texto={b.chamada} claro={false} />}
        <h2 className="text-[1.875rem] font-medium leading-[1.06] tracking-[-.02em] sm:text-[2.25rem]">{b.titulo}</h2>
        {b.info && <p className="text-[0.9375rem] font-semibold">{b.info}</p>}
        {b.subtitulo && <p className="text-[0.9375rem] leading-relaxed opacity-75">{b.subtitulo}</p>}
        {botoes.length > 0 && <div className="mt-1 flex flex-wrap gap-2.5">{botoes.map((x, i) => <Link key={i} botao={x} classe={i === 0 ? SOBRE_O_SITE : SOBRE_O_SITE_VAZADO} />)}</div>}
      </div>
      <div className="relative isolate order-1 min-h-[15rem] md:order-2 md:min-h-[24rem]">
        {b.imagem
          // eslint-disable-next-line @next/next/no-img-element -- imagem de endereço externo (https), sem otimização do Next
          ? <img src={b.imagem} alt="" loading="eager" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
          : <span aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${cor}, #0d0a14)` }} />}
      </div>
    </section>
  );
}

function Cartao({ b, cor }: { b: Destaque; cor: string }) {
  const botoes = botoesDe(b.botao_rotulo, b.botao_url);
  return (
    <section aria-label={b.titulo} className="relative mb-10 sm:mb-12">
      <div className="relative isolate min-h-[18rem] overflow-hidden rounded-[var(--site-raio)] sm:min-h-[22rem]"><Fundo imagem={b.imagem} cor={cor} eager /></div>
      <div className="relative z-10 mx-3 -mt-14 flex flex-col gap-3 rounded-[var(--site-raio)] bg-[color:var(--site-fundo)] p-5 shadow-[0_10px_30px_rgba(0,0,0,.18)] sm:mx-6 sm:-mt-12 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.375rem] font-medium leading-tight tracking-[-.01em]">{b.titulo}</h2>
          {b.subtitulo && <p className="mt-1 text-[0.9375rem] leading-relaxed opacity-75">{b.subtitulo}</p>}
        </div>
        {botoes.map((x, i) => <Link key={i} botao={x} classe={SOBRE_O_SITE} />)}
      </div>
    </section>
  );
}

function Slide({ s, cor, ativo }: { s: SlideDoDestaque; cor: string; ativo: boolean }) {
  const botao = s.botao_rotulo ? { texto: s.botao_rotulo, url: s.botao_url } : null;
  return (
    <div role="group" aria-roledescription="destaque" aria-label={s.titulo} aria-hidden={!ativo} className="relative isolate flex min-h-[22rem] w-full shrink-0 items-end overflow-hidden text-white sm:min-h-[26rem]">
      <Fundo imagem={s.imagem} cor={cor} eager={ativo} />
      <div className="flex w-full flex-col gap-3 p-5 pt-24 sm:p-8 sm:pt-32">
        <h2 className="max-w-[18ch] text-[2rem] font-medium leading-[1.05] tracking-[-.02em] sm:text-[2.75rem]">{s.titulo}</h2>
        {s.frase && <p className="max-w-[46ch] text-[1rem] leading-relaxed opacity-95">{s.frase}</p>}
        {botao && <div className="mt-1"><Link botao={botao} classe={ativo ? SOBRE_IMAGEM : `${SOBRE_IMAGEM} pointer-events-none`} /></div>}
      </div>
    </div>
  );
}

function Carrossel({ slides, cor, titulo }: { slides: SlideDoDestaque[]; cor: string; titulo: string }) {
  const [at, setAt] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [parado, setParado] = useState(false);
  const n = slides.length;
  useEffect(() => {
    if (n < 2 || pausado || parado) return;
    const relogio = setInterval(() => { if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setAt(a => (a + 1) % n); }, 6000);
    return () => clearInterval(relogio);
  }, [n, pausado, parado]);
  const ir = (passo: number) => setAt(a => (a + passo + n) % n);
  return (
    <section aria-roledescription="carrossel" aria-label={titulo || "Destaques"} className="relative overflow-hidden rounded-[var(--site-raio)]" onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)} onFocus={() => setPausado(true)} onBlur={() => setPausado(false)}>
      <div className="flex transition-transform duration-500 motion-reduce:transition-none" style={{ transform: `translateX(-${at * 100}%)` }} aria-live={parado || pausado ? "polite" : "off"}>
        {slides.map((s, i) => <Slide key={i} s={s} cor={cor} ativo={i === at} />)}
      </div>
      {n > 1 && (
        <div className="absolute right-4 top-4 flex items-center gap-2 text-[#1a1426]">
          <button type="button" onClick={() => setParado(v => !v)} aria-pressed={parado} className={`h-9 rounded-full bg-white/90 px-3 text-[0.75rem] font-semibold ${FOCO}`}>{parado ? "Continuar" : "Pausar"}</button>
          <button type="button" aria-label="Destaque anterior" onClick={() => ir(-1)} className={`h-9 w-9 rounded-full bg-white/90 text-[1.125rem] ${FOCO}`}>‹</button>
          <button type="button" aria-label="Próximo destaque" onClick={() => ir(1)} className={`h-9 w-9 rounded-full bg-white/90 text-[1.125rem] ${FOCO}`}>›</button>
        </div>
      )}
      {n > 1 && <div className="absolute left-5 top-6 flex gap-1.5" aria-hidden="true">{slides.map((_, i) => <span key={i} className={`h-2 w-2 rounded-full ${i === at ? "bg-white" : "bg-white/50"}`} />)}</div>}
    </section>
  );
}

/** O próximo evento publicado, sem a pessoa digitar nada: título, data, espaço, preço e botões vêm do evento. */
function Proximo({ item, cor, base, semLinks, agora }: { item: ItemDaAgenda; cor: string; base: string; semLinks: boolean; agora: number }) {
  const botoes = botoesDoProximoEvento(item);
  const aberta = item.lista.find(s => s.estado === "aberta") ?? item.lista[0];
  const preco = item.estado === "aberta" && item.a_partir_de_centavos !== null ? `a partir de ${formatarMoeda(item.a_partir_de_centavos)}` : null;
  const detalhes = [aberta?.quando, aberta?.local_nome, preco].filter(Boolean);
  const paginaDoEvento = semLinks ? null : caminhoDoEvento(base, item.slug);
  const principal: Botao = { texto: botoes.principal.texto, url: semLinks ? null : botoes.principal.url ?? paginaDoEvento };
  return (
    <section aria-label={item.titulo} className="relative isolate flex min-h-[22rem] items-end overflow-hidden rounded-[var(--site-raio)] text-white sm:min-h-[26rem]">
      <Fundo imagem={item.imagem ?? ""} cor={cor} eager />
      <div className="flex w-full flex-col gap-3 p-5 pt-24 sm:p-8 sm:pt-32">
        <Selo texto={chamadaDoProximoEvento(contagemParaOEvento(item.lista, agora))} claro />
        <h2 className="max-w-[18ch] text-[2rem] font-medium leading-[1.05] tracking-[-.02em] sm:text-[2.75rem]">{item.titulo}</h2>
        {detalhes.length > 0 && <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.9375rem]"><span className="font-semibold">{detalhes[0]}</span>{detalhes.slice(1).map((d, i) => <span key={i} className="opacity-90">{d}</span>)}</p>}
        <div className="mt-1 flex flex-wrap gap-2.5">
          {principal.url === null ? <span className={SOBRE_IMAGEM}>{principal.texto}</span> : <a href={principal.url} target={principal.url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={SOBRE_IMAGEM}>{principal.texto}</a>}
          {botoes.secundario && (paginaDoEvento === null ? <span className={SOBRE_IMAGEM_VAZADO}>{botoes.secundario.texto}</span> : <a href={paginaDoEvento} className={SOBRE_IMAGEM_VAZADO}>{botoes.secundario.texto}</a>)}
        </div>
      </div>
    </section>
  );
}

const Aviso = ({ children }: { children: ReactNode }) => <p className="rounded-[var(--site-raio)] border border-dashed border-[color:var(--site-borda)] px-4 py-6 text-[0.875rem] opacity-70">{children}</p>;

export function DestaqueDoSite({ bloco, cor, agenda, base, semLinks, agora }: { bloco: Destaque; cor: string; agenda: ItemDaAgenda[]; base: string; semLinks: boolean; agora: number }) {
  switch (bloco.layout) {
    case "dividido": return <Dividido b={bloco} cor={cor} />;
    case "carrossel": return <Carrossel slides={bloco.slides} cor={cor} titulo={bloco.titulo} />;
    case "cartao": return <Cartao b={bloco} cor={cor} />;
    case "proximo":
      return agenda[0]
        ? <Proximo item={agenda[0]} cor={cor} base={base} semLinks={semLinks} agora={agora} />
        // Na prévia do editor, explica por que está vazio; no site no ar, simplesmente não aparece.
        : semLinks ? <Aviso>Destaque do próximo evento: aparece aqui quando houver um evento publicado com sessão por vir.</Aviso> : null;
    default: return <TelaCheia b={bloco} cor={cor} />;
  }
}
