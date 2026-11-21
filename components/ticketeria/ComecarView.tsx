"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Building2, Check, Landmark, PartyPopper, Route, Tent, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria, type ClienteDaTicketeria } from "@/lib/ticketeria/cliente";
import {
  PERFIL, PERFIS, RESPOSTAS_VAZIAS, argumentosDoComecar, centavosDe, conferirPasso, divisaoDosLugares, hojeEmBrasilia, mapaDoAuditorio, mensagemDoErroDoComecar, ondeDoEvento, passosDoComecar, precoDaMeia, sugestaoPorFileira,
  type PerfilDoProdutor, type RespostasDoComecar, type ResultadoDoComecar,
} from "@/lib/ticketeria/comecar";
import { dataPorExtenso } from "@/lib/ticketeria/calendario";
import { mensagemDoErroDoMapa, paraSalvar, type FileiraDoMapa } from "@/lib/ticketeria/mapa";
import { CalendarioDoMes } from "@/components/ticketeria/CalendarioDoMes";
import { MapaDeAssentos } from "@/components/ticketeria/AssentosView";
import { SetorSheet, type SetorEditavel } from "@/components/ticketeria/SetorDoLocal";
import { cidadeExata, cidadesDoBrasil, cidadesDoEstado } from "@/lib/ticketeria/local-do-evento";
import type { TabelaMunicipios } from "@/lib/prestacao/municipios";
import { carregarMunicipios } from "@/components/prestacao/objeto/MunicipioCombobox";
import { MapaDoBrasil } from "@/components/ticketeria/MapaDoBrasil";
import { Aviso, CAMPO, ROTULO } from "@/components/ticketeria/FolhasDosEventos";

// O onboarding da Ticketeria (desenho aprovado pelo dono em 21/11/2026): como você trabalha, o evento e o ingresso; no fim, o
// evento pronto em rascunho. A conta de recebimento não trava nada: aparece no fim, para agora ou depois.

const ICONE: Record<PerfilDoProdutor, LucideIcon> = { espaco: Building2, turne: Route, unico: PartyPopper, festival: Tent };
const TITULO = "mt-1 text-[1.875rem] font-normal leading-[1.15] tracking-[-.03em] md:text-[2.375rem] text-[#282525] [text-wrap:balance]";
const APOIO = "mt-2 text-[0.9375rem] text-black/55";
const CAMPO_GRANDE = "w-full rounded-xl border border-black/[.15] bg-white px-4 py-4 text-[1.5rem] font-[700] leading-tight tracking-[-.02em] text-[#1C0E33] outline-none transition placeholder:font-[700] placeholder:text-black/20 focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10 md:px-5 md:py-5 md:text-[1.875rem]";
const CTA = "inline-flex items-center gap-1.5 rounded-xl bg-[#1C0E33] px-4 py-2.5 text-[0.8125rem] font-normal text-white transition hover:bg-[#2A1750] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const VOLTAR = "inline-flex items-center gap-1 rounded-xl px-2 py-2.5 text-[0.75rem] font-normal text-black/40 transition hover:text-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const LINK = "rounded-xl border border-black/[.12] bg-white px-3.5 py-2 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** O que a tela final precisa saber além da resposta do banco: o setor numerado e como terminou a montagem do mapa de assentos. */
type Pronto = ResultadoDoComecar & { setor: SetorEditavel | null; mapa: "montado" | "falhou" | null; erroDoMapa: string | null };

export function ComecarView({ organizationId }: { organizationId: string }) {
  const [r, setR] = useState<RespostasDoComecar>(RESPOSTAS_VAZIAS);
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState<Pronto | null>(null);
  const [municipios, setMunicipios] = useState<TabelaMunicipios | null>(null);

  const PASSOS = passosDoComecar(r.perfil, r.numerada);

  const passoAtual = PASSOS[passo];

  // A lista de cidades do IBGE só é baixada quando a pessoa chega no passo do lugar (276 KB, uma vez por sessão).
  useEffect(() => {
    if (passoAtual !== "onde" || municipios) return;
    let ativo = true;
    carregarMunicipios().then(t => { if (ativo) setMunicipios(t); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [passoAtual, municipios]);

  const muda = (parte: Partial<RespostasDoComecar>) => { setErro(null); setR(atual => ({ ...atual, ...parte })); };

  async function seguir() {
    const problema = conferirPasso(passoAtual, r);
    if (problema) { setErro(problema); return; }
    // O auditório já vem com uma sugestão de lugares por fileira, para a pessoa só ajustar.
    if (passoAtual === "lugares" && r.numerada && !r.porFileira) setR(atual => ({ ...atual, porFileira: String(sugestaoPorFileira(Number(atual.lugares))) }));
    if (passo < PASSOS.length - 1) { setPasso(passo + 1); return; }
    setSalvando(true);
    const ticketeria = clienteDaTicketeria(createClient());
    const { data, error } = await ticketeria.rpc("fn_ticketeria_comecar", argumentosDoComecar(organizationId, r));
    if (error || !data) { setSalvando(false); setErro(mensagemDoErroDoComecar(error)); return; }
    const resultado = data as unknown as ResultadoDoComecar;
    // O banco cria o local sem o estado (a função não o recebe): grava aqui. Se falhar, o evento já está criado e o estado se corrige na tela de Locais.
    await ticketeria.from("ticketeria_locais").update({ uf: r.uf }).eq("id", resultado.local_id);
    const montagem = r.numerada ? await montarAuditorio(ticketeria, resultado.local_id, r) : { setor: null, mapa: null, erroDoMapa: null };
    setSalvando(false);
    setPronto({ ...resultado, ...montagem });
  }

  if (pronto) return <EventoPronto r={r} resultado={pronto} organizationId={organizationId} recomecar={() => { setPronto(null); setR(RESPOSTAS_VAZIAS); setPasso(0); }} />;

  const perfil = r.perfil ? PERFIL[r.perfil] : null;
  return (
    <div className="mx-auto w-full max-w-[36rem]">
      <div className="mb-6 h-[3px] overflow-hidden rounded-full bg-black/[.08]" role="progressbar" aria-label="Andamento" aria-valuemin={1} aria-valuemax={PASSOS.length} aria-valuenow={passo + 1}>
        <div className="h-full rounded-full bg-[#7259B5] transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${((passo + 1) / PASSOS.length) * 100}%` }} />
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
            <CampoGrande valor={r.perfil === "espaco" ? r.lugar : r.evento} exemplo={perfil.nome.exemplo} rotulo={perfil.nome.rotulo}
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

      {PASSOS[passo] === "evento" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>Qual é o primeiro evento?</h1>
          <p className={APOIO}>O nome que as pessoas vão ver no ingresso.</p>
          <div className="mt-12 md:mt-16"><CampoGrande valor={r.evento} exemplo="Hamlet, temporada de março" rotulo="Nome do primeiro evento" onChange={evento => muda({ evento })} onEnter={() => void seguir()} /></div>
        </section>
      )}

      {PASSOS[passo] === "data" && perfil && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>{perfil.data.pergunta}</h1>
          <div className="mt-8 md:mt-12"><CalendarioDoMes valor={r.data} hoje={hojeEmBrasilia()} onChange={data => muda({ data })} /></div>
        </section>
      )}

      {PASSOS[passo] === "dias" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>Quantos dias tem o festival?</h1>
          <div className="mt-12 md:mt-16"><CampoGrande numerico valor={r.dias} exemplo="3" rotulo="Quantos dias" onChange={dias => muda({ dias: dias.replace(/\D/g, "") })} onEnter={() => void seguir()} /></div>
        </section>
      )}

      {PASSOS[passo] === "horario" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>A que horas começa?</h1>
          <div className="mt-12 md:mt-16">
            <input type="time" aria-label="Horário" value={r.hora} onChange={e => muda({ hora: e.target.value })} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void seguir(); } }} className={CAMPO_GRANDE} />
            <div className="mt-4 flex flex-wrap gap-2">
              {["18:00", "19:00", "20:00", "21:00"].map(h => (
                <button key={h} type="button" aria-pressed={r.hora === h} onClick={() => muda({ hora: h })}
                  className={`rounded-xl border px-4 py-2 text-[0.9375rem] tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${r.hora === h ? "border-[#1C0E33] bg-[#1C0E33] text-white" : "border-black/[.12] bg-white text-[#282525] hover:bg-black/[.04]"}`}>{h}</button>
              ))}
            </div>
          </div>
        </section>
      )}

      {PASSOS[passo] === "numerada" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>Os lugares são numerados?</h1>
          <div className="mt-12 grid grid-cols-2 gap-3 md:mt-16">
            {([[true, "Sim", "Cada pessoa escolhe o seu lugar."], [false, "Não", "Entrada livre, sem lugar marcado."]] as const).map(([valor, rotulo, dica]) => (
              <button key={rotulo} type="button" aria-pressed={r.numerada === valor} onClick={() => muda({ numerada: valor })}
                className={`rounded-xl border bg-white p-5 text-left transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${r.numerada === valor ? "border-[#7259B5] ring-1 ring-[#7259B5]" : "border-black/[.12]"}`}>
                <span className="flex items-center justify-between text-[1.375rem] text-[#1C0E33]">{rotulo}{r.numerada === valor && <Check size={18} className="text-[#7259B5]" aria-hidden="true" />}</span>
                <span className="mt-1 block text-[0.8125rem] text-black/50">{dica}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {PASSOS[passo] === "lugares" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>Quantos lugares tem?</h1>
          <div className="mt-12 md:mt-16"><CampoGrande numerico valor={r.lugares} exemplo="200" rotulo="Quantos lugares" onChange={lugares => muda({ lugares: lugares.replace(/\D/g, "") })} onEnter={() => void seguir()} /></div>
        </section>
      )}

      {PASSOS[passo] === "auditorio" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>Monte o auditório</h1>
          <div className="mt-8 md:mt-10"><MontarAuditorio r={r} muda={muda} /></div>
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

/** O campo de uma pergunta só: uma caixa grande, com o texto em negrito (peso 700 direto: a Ticketeria limita font-bold a 500 em globals.css), sem rótulo (a pergunta já é o rótulo). O cursor já entra nele; Enter segue. */
function CampoGrande({ valor, exemplo, rotulo, onChange, onEnter, numerico = false }: { valor: string; exemplo: string; rotulo: string; onChange: (valor: string) => void; onEnter: () => void; numerico?: boolean }) {
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => campo.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);
  return (
    <input ref={campo} autoFocus aria-label={rotulo} value={valor} placeholder={exemplo} maxLength={200} autoComplete="off" inputMode={numerico ? "numeric" : undefined} className={CAMPO_GRANDE}
      onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }} />
  );
}

/** O lugar: o estado pelo mapa e a cidade da lista dele; digitando, a lista filtra. Sem estado, quem digita a cidade acha em todo o Brasil. Cidade fora da lista vale como digitada. */
function EscolherOnde({ r, muda, municipios, rotuloDoLugar, exemploDoLugar }: { r: RespostasDoComecar; muda: (parte: Partial<RespostasDoComecar>) => void; municipios: TabelaMunicipios | null; rotuloDoLugar: string; exemploDoLugar: string }) {
  // A lista recolhe quando a cidade é escolhida e reabre ao clicar no campo, digitar ou trocar o estado. Ao voltar a este passo com a cidade já escolhida, ela já vem recolhida.
  const [aberta, setAberta] = useState(!r.cidade.trim());
  const lista = municipios
    ? (r.uf ? cidadesDoEstado(municipios, r.uf, r.cidade) : cidadesDoBrasil(municipios, r.cidade))
    : [];
  const exata = municipios && r.uf ? cidadeExata(municipios, r.uf, r.cidade) : null;
  return (
    <div className="space-y-4">
      <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
        <MapaDoBrasil uf={r.uf} onChange={uf => { muda({ uf, cidade: r.uf === uf ? r.cidade : "" }); if (r.uf !== uf) setAberta(true); }} />
        <div>
          <label className={ROTULO} htmlFor="co-cidade">{r.uf ? "Cidade" : "Cidade (ou escolha o estado no mapa)"}</label>
          <div className="relative">
            <input id="co-cidade" className={`${CAMPO} ${!aberta && exata ? "pr-9" : ""}`} value={r.cidade} placeholder={r.uf ? "Digite para filtrar" : "Sorocaba"} autoComplete="off" role="combobox" aria-expanded={aberta} aria-controls="co-cidades"
              onFocus={() => setAberta(true)} onChange={e => { muda({ cidade: e.target.value }); setAberta(true); }}
              onKeyDown={e => { if (e.key === "Escape" || (e.key === "Enter" && r.cidade.trim())) { e.preventDefault(); setAberta(false); } }} />
            {!aberta && exata && <Check size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7259B5]" aria-hidden="true" />}
          </div>
          {aberta && <ul id="co-cidades" role="listbox" aria-label="Cidades" className="mt-2 max-h-48 divide-y divide-black/[.06] overflow-y-auto rounded-xl border border-black/[.12] bg-white">
            {!municipios && <li className="px-3 py-2.5 text-[0.75rem] text-black/40">Carregando as cidades…</li>}
            {municipios && lista.length === 0 && <li className="px-3 py-2.5 text-[0.75rem] text-black/40">{r.cidade.trim() ? "Nenhuma cidade com esse nome na lista. Vale o que você digitou." : "Digite a cidade."}</li>}
            {lista.map(m => {
              const escolhida = !!exata && exata[0] === m[0];
              return (
                <li key={m[0]} role="option" aria-selected={escolhida}>
                  <button type="button" onClick={() => { muda({ uf: m[2], cidade: m[1] }); setAberta(false); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[0.8125rem] text-[#282525] transition hover:bg-black/[.04] focus-visible:bg-black/[.04] focus-visible:outline-none">
                    <span>{m[1]}{!r.uf && <span className="text-black/40">, {m[2]}</span>}</span>
                    {escolhida && <Check size={14} className="shrink-0 text-[#7259B5]" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>}
        </div>
      </div>
      {rotuloDoLugar && <Campo id="co-lugar" rotulo={rotuloDoLugar} valor={r.lugar} exemplo={exemploDoLugar} onChange={lugar => muda({ lugar })} />}
    </div>
  );
}

/** O auditório de lugares numerados: quantos lugares por fileira (as fileiras saem da conta) e a prévia das cadeiras. O desenho (palco, cadeiras, corredor) é o MapaDeAssentos em modo "previa": o mesmo da compra e do editor. */
function MontarAuditorio({ r, muda }: { r: RespostasDoComecar; muda: (parte: Partial<RespostasDoComecar>) => void }) {
  const lugares = Number(r.lugares) || 0;
  const porFileira = Math.max(1, Math.min(80, Number(r.porFileira) || 1));
  const fileiras: FileiraDoMapa[] = lugares > 0 ? mapaDoAuditorio(lugares, porFileira, r.corredor) : [];
  const botao = "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/[.15] bg-white text-[1.25rem] leading-none text-[#1C0E33] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-95 disabled:opacity-30";
  const ajusta = (novo: number) => muda({ porFileira: String(Math.max(1, Math.min(80, novo))) });
  return (
    <div>
      <div className="flex items-center justify-center gap-3">
        <button type="button" className={botao} aria-label="Menos um lugar por fileira" disabled={porFileira <= 1} onClick={() => ajusta(porFileira - 1)}>−</button>
        <div className="text-center">
          <input aria-label="Lugares por fileira" inputMode="numeric" value={r.porFileira} onChange={e => muda({ porFileira: e.target.value.replace(/\D/g, "").slice(0, 2) })}
            className="w-20 rounded-xl border border-black/[.15] bg-white py-2 text-center text-[1.75rem] font-[700] tabular-nums text-[#1C0E33] outline-none focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10" />
          <p className="mt-1 text-[0.75rem] text-black/45">lugares por fileira</p>
        </div>
        <button type="button" className={botao} aria-label="Mais um lugar por fileira" disabled={porFileira >= 80} onClick={() => ajusta(porFileira + 1)}>+</button>
      </div>
      <p className="mt-4 text-center text-[0.9375rem] text-black/55 tabular-nums">{fileiras.length} {fileiras.length === 1 ? "fileira" : "fileiras"} · {lugares} lugares</p>
      <div className="mt-4 rounded-xl border border-black/[.08] bg-black/[.015] px-4 py-5"><MapaDeAssentos fileiras={fileiras} modo="previa" /></div>
      <div className="mt-4 flex justify-center"><Marcar id="co-corredor" marcado={r.corredor} onChange={corredor => muda({ corredor })} texto="Corredor no meio de cada fileira" /></div>
    </div>
  );
}

/** Monta o mapa de assentos do setor "Geral" que a função do banco criou. Um setor que já era numerado, ou de outro tamanho (espaço refeito), fica como está: o mapa se ajusta no editor. */
async function montarAuditorio(ticketeria: ClienteDaTicketeria, localId: string, r: RespostasDoComecar): Promise<Pick<Pronto, "setor" | "mapa" | "erroDoMapa">> {
  const { data: setor } = await ticketeria.from("ticketeria_setores").select("id, nome, lugares, arquivado, numerado, corredor_no_meio").eq("local_id", localId).eq("nome", "Geral").eq("arquivado", false).maybeSingle();
  if (!setor) return { setor: null, mapa: null, erroDoMapa: null };
  if (setor.numerado || setor.lugares !== Number(r.lugares)) return { setor, mapa: null, erroDoMapa: null };
  const fileiras = mapaDoAuditorio(Number(r.lugares), Number(r.porFileira), r.corredor);
  const { error } = await ticketeria.rpc("fn_ticketeria_salvar_mapa", { p_setor: setor.id, p_fileiras: paraSalvar(fileiras), p_corredor: r.corredor });
  if (error) return { setor, mapa: "falhou", erroDoMapa: mensagemDoErroDoMapa(error) };
  return { setor: { ...setor, numerado: true, corredor_no_meio: r.corredor }, mapa: "montado", erroDoMapa: null };
}

function Marcar({ id, marcado, onChange, texto }: { id: string; marcado: boolean; onChange: (marcado: boolean) => void; texto: string }) {
  return <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-[0.8125rem] text-[#282525]"><input id={id} type="checkbox" checked={marcado} onChange={e => onChange(e.target.checked)} className="size-4 accent-[#7259B5]" />{texto}</label>;
}

function EventoPronto({ r, resultado, recomecar, organizationId }: { r: RespostasDoComecar; resultado: Pronto; recomecar: () => void; organizationId: string }) {
  const [editandoMapa, setEditandoMapa] = useState(false);
  const inteira = r.gratuito ? 0 : (centavosDe(r.preco) ?? 0);
  const lugares = Number(r.lugares);
  const divisao = divisaoDosLugares(lugares, r.meia, r.gratuito);
  const onde = ondeDoEvento(r);
  const linhas: [string, string][] = r.gratuito
    ? [["Entrada gratuita", `${lugares} lugares`]]
    : [["Inteira", `${reais(inteira)} · ${divisao.inteira} lugares`], ...(divisao.meia > 0 ? [["Meia-entrada", `${reais(precoDaMeia(inteira))} · ${divisao.meia} lugares`] as [string, string]] : [])];
  if (resultado.mapa === "montado") linhas.push(["Auditório", `${Math.ceil(lugares / (Number(r.porFileira) || 1))} fileiras · ${lugares} lugares numerados`]);
  return (
    <section aria-labelledby="pronto-titulo" className="mx-auto w-full max-w-[36rem]">
      <div className="mb-6 h-[3px] rounded-full bg-[#7259B5]" aria-hidden="true" />
      <p className="text-[0.75rem] text-black/45">Pronto</p>
      <h1 id="pronto-titulo" className="mt-1 text-[1.875rem] font-normal leading-[1.15] tracking-[-.03em] md:text-[2.375rem] text-[#282525]">Seu evento está criado</h1>
      <p className="mt-2 text-[0.9375rem] text-black/55">Ele fica em rascunho até você publicar.</p>

      <div className="mt-5 overflow-hidden rounded-xl border border-black/[.12] bg-white">
        <div className="bg-[#1C0E33] px-4 py-3.5 text-white">
          <p className="text-[1rem] font-normal">{r.evento.trim()}</p>
          <p className="mt-0.5 text-[0.75rem] text-white/70">
            {dataPorExtenso(r.data)}, {r.hora}{resultado.sessoes > 1 ? ` · ${resultado.sessoes} dias` : ""} · {onde}
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

      {resultado.mapa === "falhou" && resultado.erroDoMapa && <div className="mt-4"><Aviso texto={`O evento foi criado, mas o mapa de assentos não ficou pronto: ${resultado.erroDoMapa}`} /></div>}

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        {!r.gratuito && <Link href="/ingressos/recebimentos" className={CTA}>Cadastrar conta</Link>}
        {r.numerada && resultado.setor && <button type="button" onClick={() => setEditandoMapa(true)} className={LINK}>Desenhar o mapa de assentos</button>}
        <Link href={`/ingressos/eventos/${resultado.evento_id}`} className={r.gratuito ? CTA : LINK}>{r.gratuito ? "Abrir o evento para publicar" : "Abrir o evento"}</Link>
        <button type="button" onClick={recomecar} className={VOLTAR}>Criar outro</button>
      </div>
      {editandoMapa && resultado.setor && (
        <SetorSheet organizationId={organizationId} localId={resultado.local_id} nomeDoLocal={ondeDoEvento(r)} setor={resultado.setor} onClose={() => setEditandoMapa(false)} onSaved={() => setEditandoMapa(false)} />
      )}
    </section>
  );
}
