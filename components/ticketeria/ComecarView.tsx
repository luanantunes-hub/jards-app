"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Building2, Check, Landmark, PartyPopper, Route, Tent, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import {
  PASSOS_DO_COMECAR, PERFIL, PERFIS, RESPOSTAS_VAZIAS, argumentosDoComecar, centavosDe, conferirPasso, divisaoDosLugares, hojeEmBrasilia, mensagemDoErroDoComecar, ondeDoEvento, precoDaMeia,
  type PerfilDoProdutor, type RespostasDoComecar, type ResultadoDoComecar,
} from "@/lib/ticketeria/comecar";
import { cidadeExata, cidadesDoBrasil, cidadesDoEstado } from "@/lib/ticketeria/local-do-evento";
import type { TabelaMunicipios } from "@/lib/prestacao/municipios";
import { carregarMunicipios } from "@/components/prestacao/objeto/MunicipioCombobox";
import { MapaDoBrasil } from "@/components/ticketeria/MapaDoBrasil";
import { Aviso, CAMPO, ROTULO } from "@/components/ticketeria/FolhasDosEventos";

// O onboarding da Ticketeria (desenho aprovado pelo dono em 21/11/2026): como você trabalha, o evento e o ingresso; no fim, o
// evento pronto em rascunho. A conta de recebimento não trava nada: aparece no fim, para agora ou depois.

const ICONE: Record<PerfilDoProdutor, LucideIcon> = { espaco: Building2, turne: Route, unico: PartyPopper, festival: Tent };
const PASSOS = PASSOS_DO_COMECAR;
const TITULO = "mt-1 text-[1.875rem] font-normal leading-[1.15] tracking-[-.03em] md:text-[2.375rem] text-[#282525] [text-wrap:balance]";
const APOIO = "mt-2 text-[0.9375rem] text-black/55";
const CTA = "inline-flex items-center gap-1.5 rounded-xl bg-[#1C0E33] px-4 py-2.5 text-[0.8125rem] font-normal text-white transition hover:bg-[#2A1750] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const VOLTAR = "inline-flex items-center gap-1 rounded-xl px-2 py-2.5 text-[0.75rem] font-normal text-black/40 transition hover:text-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const LINK = "rounded-xl border border-black/[.12] bg-white px-3.5 py-2 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diaPorExtenso = (data: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long", weekday: "long" }).format(new Date(`${data}T12:00:00Z`));

export function ComecarView({ organizationId }: { organizationId: string }) {
  const [r, setR] = useState<RespostasDoComecar>(RESPOSTAS_VAZIAS);
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState<ResultadoDoComecar | null>(null);
  const [municipios, setMunicipios] = useState<TabelaMunicipios | null>(null);

  // A lista de cidades do IBGE só é baixada quando a pessoa chega no passo do lugar (276 KB, uma vez por sessão).
  useEffect(() => {
    if (PASSOS[passo] !== "onde" || municipios) return;
    let ativo = true;
    carregarMunicipios().then(t => { if (ativo) setMunicipios(t); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [passo, municipios]);

  const muda = (parte: Partial<RespostasDoComecar>) => { setErro(null); setR(atual => ({ ...atual, ...parte })); };

  async function seguir() {
    const problema = conferirPasso(PASSOS[passo], r);
    if (problema) { setErro(problema); return; }
    if (passo < PASSOS.length - 1) { setPasso(passo + 1); return; }
    setSalvando(true);
    const ticketeria = clienteDaTicketeria(createClient());
    const { data, error } = await ticketeria.rpc("fn_ticketeria_comecar", argumentosDoComecar(organizationId, r));
    if (error || !data) { setSalvando(false); setErro(mensagemDoErroDoComecar(error)); return; }
    const resultado = data as unknown as ResultadoDoComecar;
    // O banco cria o local sem o estado (a função não o recebe): grava aqui. Se falhar, o evento já está criado e o estado se corrige na tela de Locais.
    await ticketeria.from("ticketeria_locais").update({ uf: r.uf }).eq("id", resultado.local_id);
    setSalvando(false);
    setPronto(resultado);
  }

  if (pronto) return <EventoPronto r={r} resultado={pronto} recomecar={() => { setPronto(null); setR(RESPOSTAS_VAZIAS); setPasso(0); }} />;

  const perfil = r.perfil ? PERFIL[r.perfil] : null;
  return (
    <div className="mx-auto w-full max-w-[36rem]">
      <div className="mb-6 flex gap-1.5" aria-label={`Passo ${passo + 1} de ${PASSOS.length}`}>
        {PASSOS.map((p, i) => <span key={p} className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ${i <= passo ? "bg-[#7259B5]" : "bg-black/[.08]"}`} />)}
      </div>

      {passo === 0 && (
        <section aria-labelledby="comecar-titulo">
          <p className="text-[0.75rem] text-black/45">Bem-vindo à Ticketeria</p>
          <h1 id="comecar-titulo" className="mt-1 text-[1.875rem] font-normal leading-[1.15] tracking-[-.03em] md:text-[2.375rem] text-[#282525] [text-wrap:balance]">Como você costuma fazer seus eventos?</h1>
          <p className="mt-2 text-[0.9375rem] text-black/55">Escolha o que mais se parece com você.</p>
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {PERFIS.map(id => {
              const Icone = ICONE[id];
              const escolhido = r.perfil === id;
              return (
                <button key={id} type="button" aria-pressed={escolhido} onClick={() => muda({ perfil: id })}
                  className={`rounded-xl border bg-white p-4 text-left transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${escolhido ? "border-[#7259B5] ring-1 ring-[#7259B5]" : "border-black/[.12]"}`}>
                  <span className="relative flex h-36 items-center justify-center">
                    {PERFIL[id].ilustracao
                      // eslint-disable-next-line @next/next/no-img-element -- ilustração estática, já reduzida
                      ? <img src={PERFIL[id].ilustracao} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                      : <Icone size={32} strokeWidth={1.25} className="text-[#7259B5]/70" aria-hidden="true" />}
                    {escolhido && <Check size={16} className="absolute right-0 top-0 text-[#7259B5]" aria-hidden="true" />}
                  </span>
                  <span className="mt-3 block text-[1.125rem] leading-snug tracking-[-.01em] text-[#1C0E33]">{PERFIL[id].titulo}</span>
                  <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-black/45">{PERFIL[id].descricao}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {PASSOS[passo] === "nome" && perfil && r.perfil && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>{perfil.nome.pergunta}</h1>
          <p className={APOIO}>{perfil.nome.apoio}</p>
          <div className="mt-12 md:mt-16">
            <CampoDoNome valor={r.perfil === "espaco" ? r.lugar : r.evento} exemplo={perfil.nome.exemplo} rotulo={perfil.nome.rotulo}
              onChange={nome => muda(r.perfil === "espaco" ? { lugar: nome } : { evento: nome })} onEnter={() => void seguir()} />
          </div>
        </section>
      )}

      {PASSOS[passo] === "onde" && perfil && r.perfil && (
        <section aria-labelledby="comecar-titulo" className="space-y-4">
          <div>
            <p className="text-[0.75rem] text-black/45">{perfil.titulo}</p>
            <h1 id="comecar-titulo" className={TITULO}>{perfil.onde.pergunta}</h1>
            <p className={APOIO}>{perfil.onde.apoio}</p>
          </div>
          <EscolherOnde r={r} muda={muda} municipios={municipios} rotuloDoLugar={perfil.onde.rotuloDoLugar} exemploDoLugar={perfil.onde.exemploDoLugar} />
        </section>
      )}

      {PASSOS[passo] === "quando" && perfil && r.perfil && (
        <section aria-labelledby="comecar-titulo" className="space-y-3">
          <div>
            <p className="text-[0.75rem] text-black/45">{perfil.titulo}</p>
            <h1 id="comecar-titulo" className={TITULO}>{perfil.quando.pergunta}</h1>
            <p className={APOIO}>{perfil.quando.apoio}</p>
          </div>
          {r.perfil === "espaco" && <Campo id="co-evento" rotulo="Nome do primeiro evento" valor={r.evento} exemplo="Hamlet, temporada de março" onChange={evento => muda({ evento })} autoFocus />}
          <div className={`grid gap-2.5 ${r.perfil === "festival" ? "grid-cols-3" : "grid-cols-2"}`}>
            <div><label className={ROTULO} htmlFor="co-data">{perfil.quando.rotuloDaData}</label><input id="co-data" type="date" min={hojeEmBrasilia()} className={CAMPO} value={r.data} onChange={e => muda({ data: e.target.value })} /></div>
            <div><label className={ROTULO} htmlFor="co-hora">Horário</label><input id="co-hora" type="time" className={CAMPO} value={r.hora} onChange={e => muda({ hora: e.target.value })} /></div>
            {r.perfil === "festival" && <Campo id="co-dias" rotulo="Quantos dias" valor={r.dias} exemplo="3" onChange={dias => muda({ dias: dias.replace(/\D/g, "") })} numerico />}
          </div>
          <Campo id="co-lugares" rotulo="Quantos lugares" valor={r.lugares} exemplo="200" onChange={lugares => muda({ lugares: lugares.replace(/\D/g, "") })} numerico autoFocus={r.perfil !== "espaco"} onEnter={() => void seguir()} />
        </section>
      )}

      {PASSOS[passo] === "ingresso" && (
        <section aria-labelledby="comecar-titulo" className="space-y-3">
          <div>
            <p className="text-[0.75rem] text-black/45">Ingresso</p>
            <h1 id="comecar-titulo" className={TITULO}>Quanto custa a entrada?</h1>
            <p className={APOIO}>Um preço basta para começar. Lotes e outros tipos você cria depois.</p>
          </div>
          <Marcar id="co-gratuito" marcado={r.gratuito} onChange={gratuito => muda({ gratuito })} texto="É gratuito, só quero controlar quem entra" />
          {!r.gratuito && (
            <>
              <Campo id="co-preco" rotulo="Inteira (R$)" valor={r.preco} exemplo="60" onChange={preco => muda({ preco })} autoFocus numerico onEnter={() => void seguir()} />
              <Marcar id="co-meia" marcado={r.meia} onChange={meia => muda({ meia })} texto="Ter meia-entrada pela metade do preço" />
              {r.meia && <p className="text-[0.75rem] text-black/45">A lei garante meia-entrada a estudantes, pessoas idosas e outros públicos: separamos 40% dos lugares para ela.</p>}
            </>
          )}
        </section>
      )}

      {erro && <div className="mt-4"><Aviso texto={erro} /></div>}
      <div className="mt-6 flex items-center justify-between">
        {passo > 0 ? <button type="button" onClick={() => { setErro(null); setPasso(passo - 1); }} disabled={salvando} className={VOLTAR}><ArrowLeft size={13} aria-hidden="true" /> Voltar</button> : <span />}
        <button type="button" onClick={() => void seguir()} disabled={salvando} className={CTA}>{passo < PASSOS.length - 1 ? "Continuar" : salvando ? "Criando…" : "Criar evento"}</button>
      </div>
    </div>
  );
}

function Campo({ id, rotulo, valor, exemplo, onChange, autoFocus = false, numerico = false, onEnter }: { id: string; rotulo: string; valor: string; exemplo: string; onChange: (valor: string) => void; autoFocus?: boolean; numerico?: boolean; onEnter?: () => void }) {
  return <div><label className={ROTULO} htmlFor={id}>{rotulo}</label><input id={id} autoFocus={autoFocus} inputMode={numerico ? "decimal" : undefined} className={CAMPO} value={valor} placeholder={exemplo} onChange={e => onChange(e.target.value)} onKeyDown={onEnter ? (e => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }) : undefined} /></div>;
}

/** O campo do nome: uma caixa grande, com o texto em negrito (peso 700 direto: a Ticketeria limita font-bold a 500 em globals.css), sem rótulo (a pergunta já é o rótulo). O cursor já entra nele; Enter segue. */
function CampoDoNome({ valor, exemplo, rotulo, onChange, onEnter }: { valor: string; exemplo: string; rotulo: string; onChange: (valor: string) => void; onEnter: () => void }) {
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => campo.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);
  return (
    <input ref={campo} autoFocus aria-label={rotulo} value={valor} placeholder={exemplo} maxLength={200} autoComplete="off"
      className="w-full rounded-xl border border-black/[.15] bg-white px-4 py-4 text-[1.5rem] font-[700] leading-tight tracking-[-.02em] text-[#1C0E33] outline-none transition placeholder:font-[700] placeholder:text-black/20 focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10 md:px-5 md:py-5 md:text-[1.875rem]"
      onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }} />
  );
}

/** O lugar: o estado pelo mapa e a cidade da lista dele; digitando, a lista filtra. Sem estado, quem digita a cidade acha em todo o Brasil. Cidade fora da lista vale como digitada. */
function EscolherOnde({ r, muda, municipios, rotuloDoLugar, exemploDoLugar }: { r: RespostasDoComecar; muda: (parte: Partial<RespostasDoComecar>) => void; municipios: TabelaMunicipios | null; rotuloDoLugar: string; exemploDoLugar: string }) {
  const lista = municipios
    ? (r.uf ? cidadesDoEstado(municipios, r.uf, r.cidade) : cidadesDoBrasil(municipios, r.cidade))
    : [];
  const exata = municipios && r.uf ? cidadeExata(municipios, r.uf, r.cidade) : null;
  return (
    <div className="space-y-4">
      <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
        <MapaDoBrasil uf={r.uf} onChange={uf => muda({ uf, cidade: r.uf === uf ? r.cidade : "" })} />
        <div>
          <label className={ROTULO} htmlFor="co-cidade">{r.uf ? "Cidade" : "Cidade (ou escolha o estado no mapa)"}</label>
          <input id="co-cidade" className={CAMPO} value={r.cidade} placeholder={r.uf ? "Digite para filtrar" : "Sorocaba"} autoComplete="off" onChange={e => muda({ cidade: e.target.value })} />
          <ul role="listbox" aria-label="Cidades" className="mt-2 max-h-48 divide-y divide-black/[.06] overflow-y-auto rounded-xl border border-black/[.12] bg-white">
            {!municipios && <li className="px-3 py-2.5 text-[0.75rem] text-black/40">Carregando as cidades…</li>}
            {municipios && lista.length === 0 && <li className="px-3 py-2.5 text-[0.75rem] text-black/40">{r.cidade.trim() ? "Nenhuma cidade com esse nome na lista. Vale o que você digitou." : "Digite a cidade."}</li>}
            {lista.map(m => {
              const escolhida = !!exata && exata[0] === m[0];
              return (
                <li key={m[0]} role="option" aria-selected={escolhida}>
                  <button type="button" onClick={() => muda({ uf: m[2], cidade: m[1] })} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[0.8125rem] text-[#282525] transition hover:bg-black/[.04] focus-visible:bg-black/[.04] focus-visible:outline-none">
                    <span>{m[1]}{!r.uf && <span className="text-black/40">, {m[2]}</span>}</span>
                    {escolhida && <Check size={14} className="shrink-0 text-[#7259B5]" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {rotuloDoLugar && <Campo id="co-lugar" rotulo={rotuloDoLugar} valor={r.lugar} exemplo={exemploDoLugar} onChange={lugar => muda({ lugar })} />}
    </div>
  );
}

function Marcar({ id, marcado, onChange, texto }: { id: string; marcado: boolean; onChange: (marcado: boolean) => void; texto: string }) {
  return <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-[0.8125rem] text-[#282525]"><input id={id} type="checkbox" checked={marcado} onChange={e => onChange(e.target.checked)} className="size-4 accent-[#7259B5]" />{texto}</label>;
}

function EventoPronto({ r, resultado, recomecar }: { r: RespostasDoComecar; resultado: ResultadoDoComecar; recomecar: () => void }) {
  const inteira = r.gratuito ? 0 : (centavosDe(r.preco) ?? 0);
  const lugares = Number(r.lugares);
  const divisao = divisaoDosLugares(lugares, r.meia, r.gratuito);
  const onde = ondeDoEvento(r);
  const linhas: [string, string][] = r.gratuito
    ? [["Entrada gratuita", `${lugares} lugares`]]
    : [["Inteira", `${reais(inteira)} · ${divisao.inteira} lugares`], ...(divisao.meia > 0 ? [["Meia-entrada", `${reais(precoDaMeia(inteira))} · ${divisao.meia} lugares`] as [string, string]] : [])];
  return (
    <section aria-labelledby="pronto-titulo" className="mx-auto w-full max-w-[36rem]">
      <div className="mb-6 flex gap-1.5">{PASSOS.map(p => <span key={p} className="h-[3px] flex-1 rounded-full bg-[#7259B5]" />)}</div>
      <p className="text-[0.75rem] text-black/45">Pronto</p>
      <h1 id="pronto-titulo" className="mt-1 text-[1.875rem] font-normal leading-[1.15] tracking-[-.03em] md:text-[2.375rem] text-[#282525]">Seu evento está criado</h1>
      <p className="mt-2 text-[0.9375rem] text-black/55">Ele fica em rascunho até você publicar.</p>

      <div className="mt-5 overflow-hidden rounded-xl border border-black/[.12] bg-white">
        <div className="bg-[#1C0E33] px-4 py-3.5 text-white">
          <p className="text-[1rem] font-normal">{r.evento.trim()}</p>
          <p className="mt-0.5 text-[0.75rem] text-white/70">
            {diaPorExtenso(r.data)}, {r.hora}{resultado.sessoes > 1 ? ` · ${resultado.sessoes} dias` : ""} · {onde}
          </p>
        </div>
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex justify-between border-t border-dashed border-black/[.12] px-4 py-2.5 text-[0.8125rem]">
            <span className="text-black/55">{rotulo}</span><span className="tabular-nums text-[#282525]">{valor}</span>
          </div>
        ))}
      </div>

      {!r.gratuito && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border bg-white px-3.5 py-3 text-[0.8125rem] text-[#9A6A10]" style={{ borderColor: "#B07A1447" }}>
          <Landmark size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Para vender, falta dizer em qual conta você recebe. Leva dois minutos e pode ser agora ou depois.</span>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        {!r.gratuito && <Link href="/ingressos/recebimentos" className={CTA}>Cadastrar conta</Link>}
        <Link href={`/ingressos/eventos/${resultado.evento_id}`} className={r.gratuito ? CTA : LINK}>{r.gratuito ? "Abrir o evento para publicar" : "Abrir o evento"}</Link>
        <button type="button" onClick={recomecar} className={VOLTAR}>Criar outro</button>
      </div>
    </section>
  );
}
