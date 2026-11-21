"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Building2, Check, Landmark, PartyPopper, Route, Tent, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import {
  PERFIL, PERFIS, RESPOSTAS_VAZIAS, argumentosDoComecar, centavosDe, conferirPasso, divisaoDosLugares, hojeEmBrasilia, mensagemDoErroDoComecar, precoDaMeia,
  type PassoDoComecar, type PerfilDoProdutor, type RespostasDoComecar, type ResultadoDoComecar,
} from "@/lib/ticketeria/comecar";
import { Aviso, CAMPO, ROTULO } from "@/components/ticketeria/FolhasDosEventos";

// O onboarding da Ticketeria (desenho aprovado pelo dono em 21/11/2026): como você trabalha, o evento e o ingresso; no fim, o
// evento pronto em rascunho. A conta de recebimento não trava nada: aparece no fim, para agora ou depois.

const ICONE: Record<PerfilDoProdutor, LucideIcon> = { espaco: Building2, turne: Route, unico: PartyPopper, festival: Tent };
const PASSOS: PassoDoComecar[] = ["perfil", "evento", "ingresso"];
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

  const muda = (parte: Partial<RespostasDoComecar>) => { setErro(null); setR(atual => ({ ...atual, ...parte })); };

  async function seguir() {
    const problema = conferirPasso(PASSOS[passo], r);
    if (problema) { setErro(problema); return; }
    if (passo < PASSOS.length - 1) { setPasso(passo + 1); return; }
    setSalvando(true);
    const { data, error } = await clienteDaTicketeria(createClient()).rpc("fn_ticketeria_comecar", argumentosDoComecar(organizationId, r));
    setSalvando(false);
    if (error || !data) { setErro(mensagemDoErroDoComecar(error)); return; }
    setPronto(data as unknown as ResultadoDoComecar);
  }

  if (pronto) return <EventoPronto r={r} resultado={pronto} recomecar={() => { setPronto(null); setR(RESPOSTAS_VAZIAS); setPasso(0); }} />;

  const perfil = r.perfil ? PERFIL[r.perfil] : null;
  return (
    <div className="mx-auto w-full max-w-[36rem]">
      <div className="mb-6 flex gap-1.5" aria-label={`Passo ${passo + 1} de 3`}>
        {PASSOS.map((p, i) => <span key={p} className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ${i <= passo ? "bg-[#7259B5]" : "bg-black/[.08]"}`} />)}
      </div>

      {passo === 0 && (
        <section aria-labelledby="comecar-titulo">
          <p className="text-[0.75rem] text-black/45">Bem-vindo à Ticketeria</p>
          <h1 id="comecar-titulo" className="mt-1 text-[1.5rem] font-normal tracking-[-.02em] text-[#282525] [text-wrap:balance]">Como você costuma fazer seus eventos?</h1>
          <p className="mt-1.5 text-[0.8125rem] text-black/50">Escolha o que mais se parece com você. Dá para fazer de tudo depois.</p>
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {PERFIS.map(id => {
              const Icone = ICONE[id];
              const escolhido = r.perfil === id;
              return (
                <button key={id} type="button" aria-pressed={escolhido} onClick={() => muda({ perfil: id })}
                  className={`rounded-xl border bg-white p-4 text-left transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${escolhido ? "border-[#7259B5] ring-1 ring-[#7259B5]" : "border-black/[.12]"}`}>
                  <span className="relative flex h-28 items-center justify-center">
                    {PERFIL[id].ilustracao
                      // eslint-disable-next-line @next/next/no-img-element -- ilustração estática, já reduzida
                      ? <img src={PERFIL[id].ilustracao} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                      : <Icone size={32} strokeWidth={1.25} className="text-[#7259B5]/70" aria-hidden="true" />}
                    {escolhido && <Check size={16} className="absolute right-0 top-0 text-[#7259B5]" aria-hidden="true" />}
                  </span>
                  <span className="mt-3 block text-[0.875rem] text-[#282525]">{PERFIL[id].titulo}</span>
                  <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-black/45">{PERFIL[id].descricao}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {passo === 1 && perfil && r.perfil && (
        <section aria-labelledby="comecar-titulo" className="space-y-3">
          <div>
            <p className="text-[0.75rem] text-black/45">{perfil.titulo}</p>
            <h1 id="comecar-titulo" className="mt-1 text-[1.5rem] font-normal tracking-[-.02em] text-[#282525]">{perfil.pergunta}</h1>
            <p className="mt-1.5 text-[0.8125rem] text-black/50">{perfil.apoio}</p>
          </div>
          {r.perfil === "espaco" && <Campo id="co-lugar" rotulo={perfil.rotuloDoLugar} valor={r.lugar} exemplo={perfil.exemploDoLugar} onChange={lugar => muda({ lugar })} autoFocus />}
          <Campo id="co-evento" rotulo={perfil.rotuloDoNome} valor={r.evento} exemplo={perfil.exemploDoNome} onChange={evento => muda({ evento })} autoFocus={r.perfil !== "espaco"} />
          {r.perfil !== "espaco" && <Campo id="co-lugar" rotulo={perfil.rotuloDoLugar} valor={r.lugar} exemplo={perfil.exemploDoLugar} onChange={lugar => muda({ lugar })} />}
          <div className="grid grid-cols-2 gap-2.5">
            <Campo id="co-cidade" rotulo="Cidade" valor={r.cidade} exemplo="Sorocaba" onChange={cidade => muda({ cidade })} />
            <Campo id="co-lugares" rotulo="Quantos lugares" valor={r.lugares} exemplo="200" onChange={lugares => muda({ lugares: lugares.replace(/\D/g, "") })} numerico />
          </div>
          <div className={`grid gap-2.5 ${r.perfil === "festival" ? "grid-cols-3" : "grid-cols-2"}`}>
            <div><label className={ROTULO} htmlFor="co-data">{perfil.rotuloDaData}</label><input id="co-data" type="date" min={hojeEmBrasilia()} className={CAMPO} value={r.data} onChange={e => muda({ data: e.target.value })} /></div>
            <div><label className={ROTULO} htmlFor="co-hora">Horário</label><input id="co-hora" type="time" className={CAMPO} value={r.hora} onChange={e => muda({ hora: e.target.value })} /></div>
            {r.perfil === "festival" && <Campo id="co-dias" rotulo="Quantos dias" valor={r.dias} exemplo="3" onChange={dias => muda({ dias: dias.replace(/\D/g, "") })} numerico />}
          </div>
          {r.perfil === "turne" && <p className="text-[0.75rem] text-black/45">As outras datas da turnê você soma depois, na página do evento.</p>}
        </section>
      )}

      {passo === 2 && (
        <section aria-labelledby="comecar-titulo" className="space-y-3">
          <div>
            <p className="text-[0.75rem] text-black/45">Ingresso</p>
            <h1 id="comecar-titulo" className="mt-1 text-[1.5rem] font-normal tracking-[-.02em] text-[#282525]">Quanto custa a entrada?</h1>
            <p className="mt-1.5 text-[0.8125rem] text-black/50">Um preço basta para começar. Lotes e outros tipos você cria depois.</p>
          </div>
          <Marcar id="co-gratuito" marcado={r.gratuito} onChange={gratuito => muda({ gratuito })} texto="É gratuito, só quero controlar quem entra" />
          {!r.gratuito && (
            <>
              <Campo id="co-preco" rotulo="Inteira (R$)" valor={r.preco} exemplo="60" onChange={preco => muda({ preco })} autoFocus numerico />
              <Marcar id="co-meia" marcado={r.meia} onChange={meia => muda({ meia })} texto="Ter meia-entrada pela metade do preço" />
              {r.meia && <p className="text-[0.75rem] text-black/45">A lei garante meia-entrada a estudantes, pessoas idosas e outros públicos: separamos 40% dos lugares para ela.</p>}
            </>
          )}
        </section>
      )}

      {erro && <div className="mt-4"><Aviso texto={erro} /></div>}
      <div className="mt-6 flex items-center justify-between">
        {passo > 0 ? <button type="button" onClick={() => { setErro(null); setPasso(passo - 1); }} disabled={salvando} className={VOLTAR}><ArrowLeft size={13} aria-hidden="true" /> Voltar</button> : <span />}
        <button type="button" onClick={() => void seguir()} disabled={salvando} className={CTA}>{passo < 2 ? "Continuar" : salvando ? "Criando…" : "Criar evento"}</button>
      </div>
    </div>
  );
}

function Campo({ id, rotulo, valor, exemplo, onChange, autoFocus = false, numerico = false }: { id: string; rotulo: string; valor: string; exemplo: string; onChange: (valor: string) => void; autoFocus?: boolean; numerico?: boolean }) {
  return <div><label className={ROTULO} htmlFor={id}>{rotulo}</label><input id={id} autoFocus={autoFocus} inputMode={numerico ? "decimal" : undefined} className={CAMPO} value={valor} placeholder={exemplo} onChange={e => onChange(e.target.value)} /></div>;
}

function Marcar({ id, marcado, onChange, texto }: { id: string; marcado: boolean; onChange: (marcado: boolean) => void; texto: string }) {
  return <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-[0.8125rem] text-[#282525]"><input id={id} type="checkbox" checked={marcado} onChange={e => onChange(e.target.checked)} className="size-4 accent-[#7259B5]" />{texto}</label>;
}

function EventoPronto({ r, resultado, recomecar }: { r: RespostasDoComecar; resultado: ResultadoDoComecar; recomecar: () => void }) {
  const inteira = r.gratuito ? 0 : (centavosDe(r.preco) ?? 0);
  const lugares = Number(r.lugares);
  const divisao = divisaoDosLugares(lugares, r.meia, r.gratuito);
  const onde = [r.lugar.trim(), r.cidade.trim()].filter(Boolean).join(", ");
  const linhas: [string, string][] = r.gratuito
    ? [["Entrada gratuita", `${lugares} lugares`]]
    : [["Inteira", `${reais(inteira)} · ${divisao.inteira} lugares`], ...(divisao.meia > 0 ? [["Meia-entrada", `${reais(precoDaMeia(inteira))} · ${divisao.meia} lugares`] as [string, string]] : [])];
  return (
    <section aria-labelledby="pronto-titulo" className="mx-auto w-full max-w-[36rem]">
      <div className="mb-6 flex gap-1.5">{PASSOS.map(p => <span key={p} className="h-[3px] flex-1 rounded-full bg-[#7259B5]" />)}</div>
      <p className="text-[0.75rem] text-black/45">Pronto</p>
      <h1 id="pronto-titulo" className="mt-1 text-[1.5rem] font-normal tracking-[-.02em] text-[#282525]">Seu evento está criado</h1>
      <p className="mt-1.5 text-[0.8125rem] text-black/50">Ele fica em rascunho até você publicar.</p>

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
