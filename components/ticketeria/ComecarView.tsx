"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Building2, Check, Landmark, PartyPopper, Route, Tent, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria, type ClienteDaTicketeria } from "@/lib/ticketeria/cliente";
import {
  PERFIL, PERFIS, RESPOSTAS_VAZIAS, VENDAS, argumentosDoComecar, auditorioInicial, centavosDe, conferirPasso, divisaoDosLugares, hojeEmBrasilia, lugaresParaVender, mapaDoAuditorio, mensagemDoErroDoComecar, ondeDaPraca, passosDoComecar, pracasEfetivas, praca as pracaVazia, precoDaMeia, sugestaoPorFileira, totalDeSessoes,
  type PerfilDoProdutor, type Praca, type PracaCriada, type RespostasDoComecar, type ResultadoDoComecar,
} from "@/lib/ticketeria/comecar";
import { resumoDasDatas } from "@/lib/ticketeria/calendario";
import { adicionarFileira, alternarBloqueio, comCorredor, maisLugares, menosLugares, mensagemDoErroDoMapa, paraSalvar, resumoDoMapa } from "@/lib/ticketeria/mapa";
import { CalendarioDoMes } from "@/components/ticketeria/CalendarioDoMes";
import { EditorDoMapa } from "@/components/ticketeria/AssentosView";
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

/** O que a tela final precisa saber além da resposta do banco: como terminou a gravação do mapa de assentos desenhado (em todas as cidades). */
type Pronto = ResultadoDoComecar & { mapa: "montado" | "falhou" | "mantido" | null; erroDoMapa: string | null };

export function ComecarView({ organizationId }: { organizationId: string }) {
  const [r, setR] = useState<RespostasDoComecar>(RESPOSTAS_VAZIAS);
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState<Pronto | null>(null);
  const [municipios, setMunicipios] = useState<TabelaMunicipios | null>(null);

  const PASSOS = passosDoComecar(r.perfil, r.pracas, r.numerada, r.gratuito);
  const atual = PASSOS[Math.min(passo, PASSOS.length - 1)];
  const passoAtual = atual.id;
  const ip = atual.praca;
  const cidadeAtual = r.pracas[ip] ?? pracaVazia();

  // A lista de cidades do IBGE só é baixada quando a pessoa chega no passo do lugar (276 KB, uma vez por sessão).
  useEffect(() => {
    if (passoAtual !== "onde" || municipios) return;
    let ativo = true;
    carregarMunicipios().then(t => { if (ativo) setMunicipios(t); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [passoAtual, municipios]);

  const muda = (parte: Partial<RespostasDoComecar>) => { setErro(null); setR(anterior => ({ ...anterior, ...parte })); };
  /** Muda a praça `i` (a cidade com as suas datas), criando as que faltam. */
  const mudaPraca = (i: number, parte: Partial<Praca>) => {
    setErro(null);
    setR(anterior => {
      const pracas = [...anterior.pracas];
      while (pracas.length <= i) pracas.push(pracaVazia());
      pracas[i] = { ...pracas[i], ...parte };
      return { ...anterior, pracas };
    });
  };

  async function seguir() {
    const problema = conferirPasso(atual, r);
    if (problema) { setErro(problema); return; }
    // O auditório já vem desenhado com uma grade sugerida, para a pessoa só ajustar (refeito se ela voltou e mudou o número de lugares).
    if (passoAtual === "lugares" && r.numerada && (!r.mapa || r.mapaDeLugares !== Number(r.lugares))) {
      setR(anterior => ({ ...anterior, mapa: auditorioInicial(Number(anterior.lugares)), mapaDeLugares: Number(anterior.lugares), porFileira: String(sugestaoPorFileira(Number(anterior.lugares))) }));
    }
    // "Tem outra cidade?" sim: abre a próxima cidade (a sequência de passos ganha o onde e o data dela).
    if (passoAtual === "outra" && cidadeAtual.outra === true && r.pracas.length <= ip + 1) setR(anterior => ({ ...anterior, pracas: [...anterior.pracas, pracaVazia()] }));
    if (passo < PASSOS.length - 1 || (passoAtual === "outra" && cidadeAtual.outra === true)) { setPasso(passo + 1); return; }
    setSalvando(true);
    const ticketeria = clienteDaTicketeria(createClient());
    const { data, error } = await ticketeria.rpc("fn_ticketeria_comecar_pracas", argumentosDoComecar(organizationId, r));
    if (error || !data) { setSalvando(false); setErro(mensagemDoErroDoComecar(error)); return; }
    const resultado = data as unknown as ResultadoDoComecar;
    const montagem = r.numerada ? await montarAuditorio(ticketeria, resultado.pracas, r) : { mapa: null, erroDoMapa: null };
    setSalvando(false);
    setPronto({ ...resultado, ...montagem });
  }

  if (pronto) return <EventoPronto r={r} resultado={pronto} recomecar={() => { setPronto(null); setR({ ...RESPOSTAS_VAZIAS, pracas: [pracaVazia()] }); setPasso(0); }} />;

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

      {passoAtual === "nome" && perfil && r.perfil && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>{perfil.nome.pergunta}</h1>
          <p className={APOIO}>{perfil.nome.apoio}</p>
          <div className="mt-12 md:mt-16">
            <CampoGrande valor={r.perfil === "espaco" ? r.pracas[0]?.lugar ?? "" : r.evento} exemplo={perfil.nome.exemplo} rotulo={perfil.nome.rotulo}
              onChange={nome => (r.perfil === "espaco" ? mudaPraca(0, { lugar: nome }) : muda({ evento: nome }))} onEnter={() => void seguir()} />
          </div>
        </section>
      )}

      {passoAtual === "onde" && perfil && r.perfil && (
        <section aria-labelledby="comecar-titulo" className="space-y-4">
          <div>
            <p className="text-[0.75rem] text-black/45">{r.perfil === "turne" ? `Cidade ${ip + 1}` : perfil.titulo}</p>
            <h1 id="comecar-titulo" className={TITULO}>{r.perfil === "turne" && ip > 0 ? "Onde é a próxima cidade?" : perfil.onde.pergunta}</h1>
            <p className={APOIO}>{perfil.onde.apoio}</p>
          </div>
          <EscolherOnde praca={cidadeAtual} mudaPraca={parte => mudaPraca(ip, parte)} municipios={municipios} rotuloDoLugar={r.perfil === "espaco" ? "" : perfil.onde.rotuloDoLugar} exemploDoLugar={perfil.onde.exemploDoLugar} />
        </section>
      )}

      {passoAtual === "evento" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>Qual é o primeiro evento?</h1>
          <p className={APOIO}>O nome que as pessoas vão ver no ingresso.</p>
          <div className="mt-12 md:mt-16"><CampoGrande valor={r.evento} exemplo="Hamlet, temporada de março" rotulo="Nome do primeiro evento" onChange={evento => muda({ evento })} onEnter={() => void seguir()} /></div>
        </section>
      )}

      {passoAtual === "data" && perfil && r.perfil && (
        <section aria-labelledby="comecar-titulo">
          {r.perfil === "turne" && <p className="text-[0.75rem] text-black/45">{cidadeAtual.cidade ? `${cidadeAtual.cidade}, ${cidadeAtual.uf}` : `Cidade ${ip + 1}`}</p>}
          <h1 id="comecar-titulo" className={TITULO}>{r.perfil === "turne" ? "Quais dias nessa cidade?" : perfil.data.pergunta}</h1>
          <div className="mt-8 md:mt-12"><CalendarioDoMes valores={cidadeAtual.datas} hoje={hojeEmBrasilia()} onChange={datas => mudaPraca(ip, { datas })} /></div>
        </section>
      )}

      {passoAtual === "outra" && (
        <section aria-labelledby="comecar-titulo">
          <p className="text-[0.75rem] text-black/45">{`${cidadeAtual.cidade}, ${cidadeAtual.uf} · ${resumoDasDatas(cidadeAtual.datas)}`}</p>
          <h1 id="comecar-titulo" className={TITULO}>Tem outra cidade na turnê?</h1>
          <div className="mt-12 md:mt-16"><SimOuNao valor={cidadeAtual.outra} onChange={outra => mudaPraca(ip, { outra })} dicaSim="Você marca o lugar e os dias dela." dicaNao="Essa é a última." /></div>
        </section>
      )}

      {passoAtual === "horario" && (
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

      {passoAtual === "numerada" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>Os lugares são numerados?</h1>
          <div className="mt-12 md:mt-16"><SimOuNao valor={r.numerada} onChange={numerada => muda({ numerada })} dicaSim="Cada pessoa escolhe o seu lugar." dicaNao="Entrada livre, sem lugar marcado." /></div>
        </section>
      )}

      {passoAtual === "lugares" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>Quantos lugares tem?</h1>
          <div className="mt-12 md:mt-16"><CampoGrande numerico valor={r.lugares} exemplo="200" rotulo="Quantos lugares" onChange={lugares => muda({ lugares: lugares.replace(/\D/g, "") })} onEnter={() => void seguir()} /></div>
        </section>
      )}

      {passoAtual === "auditorio" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>Monte o auditório</h1>
          <div className="mt-8 md:mt-10"><AuditorioDoEvento r={r} muda={muda} /></div>
        </section>
      )}

      {passoAtual === "gratuito" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>O ingresso é gratuito?</h1>
          <div className="mt-12 md:mt-16"><SimOuNao valor={r.gratuito} onChange={gratuito => muda({ gratuito })} dicaSim="Só quero controlar quem entra." dicaNao="Vou cobrar a entrada." /></div>
        </section>
      )}

      {passoAtual === "preco" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>Quanto custa a inteira?</h1>
          <div className="mt-12 md:mt-16"><CampoGrande numerico prefixo="R$" valor={r.preco} exemplo="60" rotulo="Preço da inteira, em reais" onChange={preco => muda({ preco: preco.replace(/[^\d.,]/g, "") })} onEnter={() => void seguir()} /></div>
        </section>
      )}

      {passoAtual === "meia" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>Tem meia-entrada?</h1>
          <div className="mt-12 md:mt-16"><SimOuNao valor={r.meia} onChange={meia => muda({ meia })} dicaSim="Pela metade do preço." dicaNao="Só a inteira." /></div>
        </section>
      )}

      {passoAtual === "venda" && (
        <section aria-labelledby="comecar-titulo">
          <h1 id="comecar-titulo" className={TITULO}>Como será a venda dos ingressos?</h1>
          <p className="mt-3 text-[0.9375rem] text-black/55">Pode marcar as duas.</p>
          <div className="mt-12 grid gap-3 md:mt-16 sm:grid-cols-2">
            {VENDAS.map(opcao => (
              <button key={opcao.id} type="button" aria-pressed={r.venda.includes(opcao.id)} onClick={() => muda({ venda: r.venda.includes(opcao.id) ? r.venda.filter(v => v !== opcao.id) : [...r.venda, opcao.id] })}
                className={`rounded-xl border bg-white p-5 text-left transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${r.venda.includes(opcao.id) ? "border-[#7259B5] ring-1 ring-[#7259B5]" : "border-black/[.12]"}`}>
                <span className="flex items-center justify-between text-[1.375rem] text-[#1C0E33]">{opcao.rotulo}{r.venda.includes(opcao.id) && <Check size={18} className="text-[#7259B5]" aria-hidden="true" />}</span>
                <span className="mt-1 block text-[0.8125rem] text-black/50">{opcao.dica}</span>
              </button>
            ))}
          </div>
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
function CampoGrande({ valor, exemplo, rotulo, onChange, onEnter, numerico = false, prefixo }: { valor: string; exemplo: string; rotulo: string; onChange: (valor: string) => void; onEnter: () => void; numerico?: boolean; prefixo?: string }) {
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => campo.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);
  const entrada = (
    <input ref={campo} autoFocus aria-label={rotulo} value={valor} placeholder={exemplo} maxLength={200} autoComplete="off" inputMode={numerico ? "numeric" : undefined}
      className={`${CAMPO_GRANDE} ${prefixo ? "pl-14 md:pl-16" : ""}`}
      onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }} />
  );
  if (!prefixo) return entrada;
  return <div className="relative">{entrada}<span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[1.25rem] font-[700] text-black/30 md:left-5 md:text-[1.5rem]" aria-hidden="true">{prefixo}</span></div>;
}

/** Duas opções grandes, Sim e Não, para as perguntas de resposta curta. `valor` é null enquanto a pessoa não respondeu. */
function SimOuNao({ valor, onChange, dicaSim, dicaNao }: { valor: boolean | null; onChange: (valor: boolean) => void; dicaSim: string; dicaNao: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {([[true, "Sim", dicaSim], [false, "Não", dicaNao]] as const).map(([opcao, rotulo, dica]) => (
        <button key={rotulo} type="button" aria-pressed={valor === opcao} onClick={() => onChange(opcao)}
          className={`rounded-xl border bg-white p-5 text-left transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${valor === opcao ? "border-[#7259B5] ring-1 ring-[#7259B5]" : "border-black/[.12]"}`}>
          <span className="flex items-center justify-between text-[1.375rem] text-[#1C0E33]">{rotulo}{valor === opcao && <Check size={18} className="text-[#7259B5]" aria-hidden="true" />}</span>
          <span className="mt-1 block text-[0.8125rem] text-black/50">{dica}</span>
        </button>
      ))}
    </div>
  );
}

/** O lugar: o estado pelo mapa e a cidade da lista dele; digitando, a lista filtra. Sem estado, quem digita a cidade acha em todo o Brasil. Cidade fora da lista vale como digitada. */
function EscolherOnde({ praca, mudaPraca, municipios, rotuloDoLugar, exemploDoLugar }: { praca: Praca; mudaPraca: (parte: Partial<Praca>) => void; municipios: TabelaMunicipios | null; rotuloDoLugar: string; exemploDoLugar: string }) {
  // A lista recolhe quando a cidade é escolhida e reabre ao clicar no campo, digitar ou trocar o estado. Ao voltar a este passo com a cidade já escolhida, ela já vem recolhida.
  const [aberta, setAberta] = useState(!praca.cidade.trim());
  const lista = municipios
    ? (praca.uf ? cidadesDoEstado(municipios, praca.uf, praca.cidade) : cidadesDoBrasil(municipios, praca.cidade))
    : [];
  const exata = municipios && praca.uf ? cidadeExata(municipios, praca.uf, praca.cidade) : null;
  return (
    <div className="space-y-4">
      <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
        <MapaDoBrasil uf={praca.uf} onChange={uf => { mudaPraca({ uf, cidade: praca.uf === uf ? praca.cidade : "" }); if (praca.uf !== uf) setAberta(true); }} />
        <div>
          <label className={ROTULO} htmlFor="co-cidade">{praca.uf ? "Cidade" : "Cidade (ou escolha o estado no mapa)"}</label>
          <div className="relative">
            <input id="co-cidade" className={`${CAMPO} ${!aberta && exata ? "pr-9" : ""}`} value={praca.cidade} placeholder={praca.uf ? "Digite para filtrar" : "Sorocaba"} autoComplete="off" role="combobox" aria-expanded={aberta} aria-controls="co-cidades"
              onFocus={() => setAberta(true)} onChange={e => { mudaPraca({ cidade: e.target.value }); setAberta(true); }}
              onKeyDown={e => { if (e.key === "Escape" || (e.key === "Enter" && praca.cidade.trim())) { e.preventDefault(); setAberta(false); } }} />
            {!aberta && exata && <Check size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7259B5]" aria-hidden="true" />}
          </div>
          {aberta && <ul id="co-cidades" role="listbox" aria-label="Cidades" className="mt-2 max-h-48 divide-y divide-black/[.06] overflow-y-auto rounded-xl border border-black/[.12] bg-white">
            {!municipios && <li className="px-3 py-2.5 text-[0.75rem] text-black/40">Carregando as cidades…</li>}
            {municipios && lista.length === 0 && <li className="px-3 py-2.5 text-[0.75rem] text-black/40">{praca.cidade.trim() ? "Nenhuma cidade com esse nome na lista. Vale o que você digitou." : "Digite a cidade."}</li>}
            {lista.map(m => {
              const escolhida = !!exata && exata[0] === m[0];
              return (
                <li key={m[0]} role="option" aria-selected={escolhida}>
                  <button type="button" onClick={() => { mudaPraca({ uf: m[2], cidade: m[1] }); setAberta(false); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[0.8125rem] text-[#282525] transition hover:bg-black/[.04] focus-visible:bg-black/[.04] focus-visible:outline-none">
                    <span>{m[1]}{!praca.uf && <span className="text-black/40">, {m[2]}</span>}</span>
                    {escolhida && <Check size={14} className="shrink-0 text-[#7259B5]" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>}
        </div>
      </div>
      {rotuloDoLugar && <Campo id="co-lugar" rotulo={rotuloDoLugar} valor={praca.lugar} exemplo={exemploDoLugar} onChange={lugar => mudaPraca({ lugar })} />}
    </div>
  );
}

/**
 * O auditório de lugares numerados: o MESMO editor de mapa do setor (EditorDoMapa), aqui dentro do onboarding. A grade de partida vem sugerida; a pessoa
 * soma ou tira lugares de cada fileira, acrescenta fileiras, bloqueia cadeiras e liga ou desliga o corredor. O que ficar desenhado aqui é o mapa final do setor:
 * o evento nasce com ele. "Refazer a grade" volta a uma grade uniforme com N lugares por fileira (e descarta o que foi editado).
 */
function AuditorioDoEvento({ r, muda }: { r: RespostasDoComecar; muda: (parte: Partial<RespostasDoComecar>) => void }) {
  const mapa = r.mapa ?? [];
  const resumo = resumoDoMapa(mapa);
  const lugares = Number(r.lugares) || 0;
  const porFileira = Math.max(1, Math.min(80, Number(r.porFileira) || 1));
  const refazer = (por: number) => muda({ porFileira: String(por), mapa: mapaDoAuditorio(lugares, por, true) });
  const botao = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[.15] bg-white text-[1.125rem] leading-none text-[#1C0E33] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-95 disabled:opacity-30";
  return (
    <div className="space-y-4">
      <EditorDoMapa fileiras={comCorredor(mapa, r.corredor)} lugares={resumo.aVenda} bloqueados={resumo.bloqueados} vendidos={0} corredor={r.corredor}
        onCorredor={corredor => muda({ corredor })} onAlternar={(f, n) => muda({ mapa: alternarBloqueio(mapa, f, n) })} onAdicionarFileira={() => muda({ mapa: adicionarFileira(mapa) })}
        onMaisLugares={f => muda({ mapa: maisLugares(mapa, f) })} onMenosLugares={f => muda({ mapa: menosLugares(mapa, f) })} />
      <div className="flex flex-wrap items-center gap-3 text-[0.8125rem] text-black/60">
        <span>Refazer a grade com</span>
        <button type="button" className={botao} aria-label="Menos um lugar por fileira" disabled={porFileira <= 1 || lugares < 1} onClick={() => refazer(porFileira - 1)}>−</button>
        <span className="w-6 text-center text-[1rem] font-[700] tabular-nums text-[#1C0E33]">{porFileira}</span>
        <button type="button" className={botao} aria-label="Mais um lugar por fileira" disabled={porFileira >= 80 || lugares < 1} onClick={() => refazer(porFileira + 1)}>+</button>
        <span>lugares por fileira</span>
      </div>
    </div>
  );
}

/**
 * Grava o mapa desenhado no setor "Geral" de cada cidade (o mesmo mapa em todas: o produtor ajusta por cidade depois). Um setor que já era numerado, ou de
 * outro tamanho (espaço refeito), fica como está: o mapa se ajusta no editor do local.
 */
async function montarAuditorio(ticketeria: ClienteDaTicketeria, pracas: PracaCriada[], r: RespostasDoComecar): Promise<Pick<Pronto, "mapa" | "erroDoMapa">> {
  const lugares = lugaresParaVender(r);
  let tentou = false;
  let mantido = false;
  let erro: string | null = null;
  for (const p of pracas) {
    if (!r.mapa) continue;
    // O espaço já existia (de outro evento) já numerado ou com outro tamanho: fica como está, mas a pessoa precisa saber que o desenho dela não entrou.
    if (p.setor_numerado || p.setor_lugares !== lugares) { mantido = true; continue; }
    tentou = true;
    const { error } = await ticketeria.rpc("fn_ticketeria_salvar_mapa", { p_setor: p.setor_id, p_fileiras: paraSalvar(r.mapa), p_corredor: r.corredor });
    if (error) erro ??= mensagemDoErroDoMapa(error);
  }
  return { mapa: erro ? "falhou" : mantido ? "mantido" : tentou ? "montado" : null, erroDoMapa: erro };
}

function EventoPronto({ r, resultado, recomecar }: { r: RespostasDoComecar; resultado: Pronto; recomecar: () => void }) {
  const gratuito = r.gratuito === true;
  const porta = r.venda.includes("porta");
  const online = r.venda.includes("online");
  const inteira = gratuito ? 0 : (centavosDe(r.preco) ?? 0);
  const lugares = lugaresParaVender(r);
  const divisao = divisaoDosLugares(lugares, r.meia === true, gratuito);
  const cidades = pracasEfetivas(r.perfil, r.pracas);
  const varias = cidades.length > 1;
  const linhas: [string, string][] = [
    ...(varias ? cidades.map(c => [`${c.cidade}, ${c.uf}`, resumoDasDatas(c.datas)] as [string, string]) : []),
    ...(gratuito
      ? [["Entrada gratuita", `${lugares} lugares${varias ? " por cidade" : ""}`] as [string, string]]
      : [["Inteira", reais(inteira)] as [string, string], ...(divisao.meia > 0 ? [["Meia-entrada", reais(precoDaMeia(inteira))] as [string, string]] : []), ["Lugares", `${lugares}${varias ? " por cidade" : ""}`] as [string, string]]),
  ];
  if (resultado.mapa === "montado" && r.mapa) {
    const resumo = resumoDoMapa(r.mapa);
    linhas.push(["Auditório", `${resumo.fileiras} fileiras · ${resumo.aVenda} lugares numerados${resumo.bloqueados > 0 ? ` · ${resumo.bloqueados} bloqueados` : ""}`]);
  }
  const cabecalho = varias
    ? `${cidades.length} cidades · ${totalDeSessoes(r)} datas · ${r.hora}`
    : `${resumoDasDatas(cidades[0].datas)}, ${r.hora} · ${ondeDaPraca(cidades[0])}`;
  return (
    <section aria-labelledby="pronto-titulo" className="mx-auto w-full max-w-[36rem]">
      <div className="mb-6 h-[3px] rounded-full bg-[#7259B5]" aria-hidden="true" />
      <p className="text-[0.75rem] text-black/45">Pronto</p>
      <h1 id="pronto-titulo" className="mt-1 text-[1.875rem] font-normal leading-[1.15] tracking-[-.03em] md:text-[2.375rem] text-[#282525]">Seu evento está criado</h1>
      <p className="mt-2 text-[0.9375rem] text-black/55">Ele fica em rascunho até você publicar.</p>

      <div className="mt-5 overflow-hidden rounded-xl border border-black/[.12] bg-white">
        <div className="bg-[#1C0E33] px-4 py-3.5 text-white">
          <p className="text-[1rem] font-normal">{r.evento.trim()}</p>
          <p className="mt-0.5 text-[0.75rem] text-white/70">{cabecalho}</p>
        </div>
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex justify-between gap-4 border-t border-dashed border-black/[.12] px-4 py-2.5 text-[0.8125rem]">
            <span className="text-black/55">{rotulo}</span><span className="text-right tabular-nums text-[#282525]">{valor}</span>
          </div>
        ))}
      </div>

      {!gratuito && online && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border bg-white px-3.5 py-3 text-[0.8125rem] text-[#9A6A10]" style={{ borderColor: "#B07A1447" }}>
          <Landmark size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Para vender, falta dizer em qual conta você recebe. Leva dois minutos e pode ser agora ou depois.</span>
        </div>
      )}

      {resultado.mapa === "mantido" && (
        <div className="mt-4 space-y-2">
          <Aviso texto="O espaço já existia com outro tamanho (ou já tinha mapa), então ficou como estava e o auditório que você desenhou não foi gravado nele." />
          <Link href="/ingressos/locais" className={LINK}>Abrir os espaços e montar o mapa</Link>
        </div>
      )}

      {resultado.mapa === "falhou" && resultado.erroDoMapa && (
        <div className="mt-4 space-y-2">
          <Aviso texto={`O evento foi criado, mas o mapa de assentos não ficou pronto: ${resultado.erroDoMapa}`} />
          <Link href="/ingressos/locais" className={LINK}>Abrir os espaços e montar o mapa</Link>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        {!gratuito && online && <Link href="/ingressos/recebimentos" className={CTA}>Cadastrar conta</Link>}
        {porta && <Link href="/ingressos/bilheteria" className={online ? LINK : CTA}>Cadastrar quem vende na porta</Link>}
        <Link href={`/ingressos/eventos/${resultado.evento_id}`} className={gratuito && online ? CTA : LINK}>{gratuito && online ? "Abrir o evento para publicar" : "Abrir o evento"}</Link>
        <button type="button" onClick={recomecar} className={VOLTAR}>Criar outro</button>
      </div>
    </section>
  );
}
