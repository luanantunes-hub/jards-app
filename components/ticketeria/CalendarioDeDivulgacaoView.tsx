"use client";

import { useMemo, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, CAMPO, ROTULO } from "@/components/ticketeria/FolhasDosEventos";
import { SeloDePrecisao } from "@/components/ticketeria/PainelView";
import { emCentavos, lerValorEmReais } from "@/lib/producao/dinheiro";
import { rotuloDoCanalDeGasto } from "@/lib/ticketeria/modelo";
import { canaisComCurva } from "@/lib/ticketeria/modelo-recomendacao";
import { canaisDoCalendario, lerPedidoDoCalendario, montarCalendario, planilhaDoCalendario, porQueAssim, SEMANAS_DO_ATRASO, type Calendario } from "@/lib/ticketeria/modelo-calendario";
import type { CanalDoResultado } from "@/lib/ticketeria/modelo-resultado";
import type { SessaoParaDivulgar } from "@/lib/ticketeria/divulgacao";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";

// O calendário de divulgação de um evento (aba Modelo): a folha que pede o plano (evento, quanto gastar até a sessão, a partir de quando, canais), o calendário semana a semana com a
// comparação e o gráfico, e a prévia com exemplo enquanto o modelo não tem histórico para isso. O cálculo é lib/ticketeria/modelo-calendario.ts. Só desenho: os dados chegam por props.

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "relative px-4 py-2.5 text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-2.5 text-[0.8125rem] text-[#282525]";
const CANCELAR = "rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const CONFIRMAR = "rounded-xl bg-[#7259B5] px-4 py-2.5 text-[0.75rem] font-normal text-white transition hover:bg-[#6349A6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const SECUNDARIO = "rounded-xl border bg-white px-3 py-1.5 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const CORES = ["#7259B5", "#B9A9E0", "#E4DCF5", "#9C8BC9", "#D3C8EE"];
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const reaisParaCampo = (centavos: number) => String(Math.round(centavos / 100));

export type PlanoDoCalendario = { sessaoId: string; evento: string; diaDaSessao: string; inicio: string; totalCentavos: number; canais: string[]; lugaresRestantes?: number | null };

/** A folha "Planejar a divulgação de um evento": escolher a sessão, o total até ela, de quando começa e os canais. */
export function PlanejarDivulgacaoSheet({ sessoes, canais, gastoSemanal, hoje, inicial, onMontar, onClose }: {
  sessoes: SessaoParaDivulgar[]; canais: CanalDoResultado[]; gastoSemanal: Record<string, number>; hoje: string; inicial?: PlanoDoCalendario | null;
  onMontar: (p: PlanoDoCalendario) => void; onClose: () => void;
}) {
  const futuras = useMemo(() => sessoes.filter(s => s.a_venda && s.dia && s.dia >= hoje).sort((a, b) => (a.dia as string).localeCompare(b.dia as string)), [sessoes, hoje]);
  const disponiveis = useMemo(() => canaisDoCalendario(canaisComCurva(canais)), [canais]);
  const [sessaoId, setSessaoId] = useState(inicial?.sessaoId ?? futuras[0]?.id ?? "");
  const [inicio, setInicio] = useState(inicial?.inicio ?? hoje);
  const [escolhidos, setEscolhidos] = useState<string[]>(inicial?.canais ?? disponiveis.map(c => c.canal));
  const sessao = futuras.find(s => s.id === sessaoId) ?? null;
  const porSemana = disponiveis.reduce((s, c) => s + (gastoSemanal[c.canal] ?? 0), 0);
  const leituraDasSemanas = sessao?.dia ? lerPedidoDoCalendario({ totalCentavos: 1e9, inicio, diaDaSessao: sessao.dia }) : null;
  const semanas = leituraDasSemanas?.ok ? leituraDasSemanas.semanas : null;
  const [texto, setTexto] = useState(inicial ? reaisParaCampo(inicial.totalCentavos) : porSemana > 0 && semanas ? reaisParaCampo(Math.round((porSemana * semanas) / 10000) * 10000) : "");
  const reais = lerValorEmReais(texto);
  const total = reais === null ? null : emCentavos(reais);
  const leitura = sessao?.dia && total !== null ? lerPedidoDoCalendario({ totalCentavos: total, inicio, diaDaSessao: sessao.dia }) : null;
  const problema = !leitura || leitura.ok ? null
    : leitura.problema === "valor" ? "Digite um valor a partir de R$ 50."
    : leitura.problema === "sessao_passou" ? "A data de início é depois da sessão."
    : leitura.problema === "longe_demais" ? "A sessão está a mais de 16 semanas: comece mais perto da data."
    : "Confira a data de início.";
  const pode = !!sessao && leitura?.ok === true && escolhidos.length > 0;
  const alternar = (c: string) => setEscolhidos(x => (x.includes(c) ? x.filter(y => y !== c) : [...x, c]));

  return (
    <TopSheet titulo="Planejar a divulgação de um evento" onClose={onClose} largura="36rem" footer={fechar => (
      <>
        <button type="button" onClick={fechar} className={CANCELAR}>Cancelar</button>
        <button type="button" disabled={!pode} className={CONFIRMAR}
          onClick={() => { if (sessao?.dia && total !== null) onMontar({ sessaoId: sessao.id, evento: sessao.evento, diaDaSessao: sessao.dia, inicio, totalCentavos: total, canais: escolhidos, lugaresRestantes: sessao.lugares_restantes ?? null }); }}>Montar calendário</button>
      </>
    )}>
      <div className="space-y-4">
        <p className="text-[0.8125rem] text-black/55">O modelo sugere quanto pôr em cada canal, semana a semana, até a sessão.</p>
        {futuras.length === 0 ? <Aviso texto="Não há sessão à venda pela frente. O calendário é montado para uma sessão futura." /> : (
          <>
            <div>
              <label className={ROTULO} htmlFor="cd-sessao">Evento</label>
              <select id="cd-sessao" className={CAMPO} value={sessaoId} onChange={e => setSessaoId(e.target.value)}>
                {futuras.map(s => <option key={s.id} value={s.id}>{s.evento} · {s.quando}</option>)}
              </select>
            </div>
            <div>
              <label className={ROTULO} htmlFor="cd-total">Quanto gastar em anúncios até a sessão (em reais)</label>
              <input id="cd-total" inputMode="decimal" className={`${CAMPO} max-w-[12rem]`} value={texto} onChange={e => setTexto(e.target.value)} placeholder="3000" />
              {porSemana > 0 && <p className="mt-1.5 text-[0.75rem] text-black/45">Em geral você gasta {formatarMoeda(porSemana)} por semana em anúncios.{typeof sessao?.lugares_restantes === "number" ? ` Faltam ${inteiro(sessao.lugares_restantes)} lugares nesta sessão.` : ""}</p>}
            </div>
            <div>
              <label className={ROTULO} htmlFor="cd-inicio">A partir de</label>
              <input id="cd-inicio" type="date" className={`${CAMPO} max-w-[12rem]`} value={inicio} min={hoje} onChange={e => setInicio(e.target.value)} />
              {semanas !== null && <p className="mt-1.5 text-[0.75rem] text-black/45">{semanas === 1 ? "É a semana da sessão." : `São ${semanas} semanas até a sessão.`}</p>}
            </div>
            <div>
              <span className={ROTULO}>Canais</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Canais">
                {disponiveis.map(c => {
                  const on = escolhidos.includes(c.canal);
                  return <button key={c.canal} type="button" aria-pressed={on} onClick={() => alternar(c.canal)}
                    className={`rounded-xl border px-3 py-1.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${on ? "border-[#7259B5] bg-[#F5F2FB] text-[#1C0E33]" : "bg-white text-black/55 hover:bg-black/[.03]"}`}
                    style={on ? undefined : { borderColor: BORDA }}>{rotuloDoCanalDeGasto(c.canal)}</button>;
                })}
              </div>
              <p className="mt-1.5 text-[0.75rem] text-black/45">Só aparecem os canais com curva no modelo.</p>
            </div>
            {problema && texto !== "" && <p role="alert" className="text-[0.75rem] text-[#B23B3B]">{problema}</p>}
          </>
        )}
      </div>
    </TopSheet>
  );
}

/** O gráfico dos ingressos esperados por semana, empilhados por canal, com o que sobra depois da sessão em cinza. */
function GraficoDoCalendario({ cal, canais, diaDaSessao }: { cal: Calendario; canais: string[]; diaDaSessao: string }) {
  const S = cal.semanas.length, n = S + Math.min(4, SEMANAS_DO_ATRASO);
  const W = 900, H = 230, pl = 40, pb = 40, pt = 16;
  const totais = Array.from({ length: n }, (_, t) => canais.reduce((s, c) => s + (cal.porSemana[c]?.[t] ?? 0), 0));
  const maximo = Math.max(1, ...totais) * 1.15;
  const passo = maximo > 60 ? 20 : maximo > 24 ? 10 : 5;
  const Y = (v: number) => H - pb - (v / maximo) * (H - pb - pt);
  const bw = (W - pl - 20) / n;
  const xs = pl + S * bw;
  const linhas = Array.from({ length: Math.floor(maximo / passo) + 1 }, (_, i) => i * passo);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Ingressos esperados por semana, pelos anúncios">
      {linhas.map(v => <g key={v}><line x1={pl} x2={W - 10} y1={Y(v)} y2={Y(v)} stroke="rgba(13,13,13,.07)" /><text x={4} y={Y(v) + 4} fontSize={10} fill="rgba(13,13,13,.4)">{v}</text></g>)}
      {Array.from({ length: n }, (_, t) => {
        let y0 = H - pb;
        const x = pl + t * bw + 6, depois = t >= S;
        return (
          <g key={t}>
            {canais.map((c, i) => {
              const h = ((cal.porSemana[c]?.[t] ?? 0) / maximo) * (H - pb - pt);
              y0 -= h;
              return <rect key={c} x={x} y={y0} width={Math.max(1, bw - 12)} height={h} fill={depois ? "#D9D6DE" : CORES[i % CORES.length]} />;
            })}
            {!depois && <text x={x + (bw - 12) / 2} y={H - pb + 15} fontSize={10} fill="rgba(13,13,13,.45)" textAnchor="middle">{diaMes(cal.semanas[t].inicio)}</text>}
          </g>
        );
      })}
      <line x1={xs} x2={xs} y1={pt} y2={H - pb + 4} stroke="#282525" strokeDasharray="3 3" />
      <text x={xs + 6} y={pt + 10} fontSize={11} fill="#282525">sessão, {diaMes(diaDaSessao)}</text>
      <text x={xs + ((n - S) * bw) / 2} y={H - pb + 15} fontSize={10} fill="rgba(13,13,13,.45)" textAnchor="middle">depois da sessão: o efeito que sobra não vende mais</text>
    </svg>
  );
}

/** O calendário de um evento: a tabela semana a semana, o mesmo dinheiro gasto de outros jeitos, por que assim e o gráfico. */
export function CalendarioDeDivulgacao({ plano, canais, semanasDoModelo, onAjustar, onFechar }: {
  plano: PlanoDoCalendario; canais: CanalDoResultado[]; semanasDoModelo: number; onAjustar: () => void; onFechar: () => void;
}) {
  const usados = useMemo(() => canaisDoCalendario(canaisComCurva(canais)).filter(c => plano.canais.includes(c.canal)), [canais, plano.canais]);
  const cal = useMemo(() => montarCalendario(usados, { totalCentavos: plano.totalCentavos, inicio: plano.inicio, diaDaSessao: plano.diaDaSessao, lugaresRestantes: plano.lugaresRestantes ?? null }), [usados, plano]);
  if (!cal) return <Aviso texto="Não deu para montar o calendário com esses dados. Ajuste o evento, o valor ou os canais." />;
  const nomes = Object.keys(cal.totalPorCanal);
  const maxCelula = Math.max(1, ...cal.semanas.flatMap(s => Object.values(s.porCanal)));
  const planilha = `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${planilhaDoCalendario(cal, rotuloDoCanalDeGasto)}`)}`;
  const diferenca = (x: number) => { const d = Math.round(x - cal.comparacao.ingressos); return d === 0 ? "o mesmo" : `${d > 0 ? "+" : ""}${inteiro(d)} ${Math.abs(d) === 1 ? "ingresso" : "ingressos"}`; };
  const S = cal.semanas.length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3" style={{ borderColor: "rgba(114,89,181,.28)", background: "#FAF8FE" }}>
        <p className="text-[0.8125rem] text-black/55"><span className="text-[#282525]">Calendário de divulgação: {plano.evento}.</span> Como dividir {formatarMoeda(cal.totalCentavos)} em anúncios {S === 1 ? "na semana da sessão" : `nas ${S} semanas até a sessão`}, para vender o máximo antes da data.</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onAjustar} className={SECUNDARIO} style={{ borderColor: BORDA }}>Ajustar</button>
          <a href={planilha} download={`calendario-${plano.diaDaSessao}.csv`} className={SECUNDARIO} style={{ borderColor: BORDA }}>Baixar planilha</a>
          <button type="button" onClick={onFechar} className={CANCELAR}>Fechar</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <div className="flex items-center justify-between px-4 pb-1 pt-3.5"><p className="text-[0.875rem] text-[#282525]">O calendário que o modelo aponta</p><SeloDePrecisao selo="razoavel" /></div>
        <table className="w-full min-w-[40rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={`${CABECALHO} text-left`}>Semana</th>{nomes.map(c => <th key={c} className={`${CABECALHO} text-right`}>{rotuloDoCanalDeGasto(c)}</th>)}<th className={`${CABECALHO} text-right`}>Total da semana</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {cal.semanas.map(s => (
              <tr key={s.inicio}>
                <td className={CELULA}>Semana de {diaMes(s.inicio)}{s.daSessao ? " (a da sessão)" : ""}</td>
                {nomes.map(c => {
                  const v = s.porCanal[c] ?? 0;
                  return <td key={c} className={`${CELULA} whitespace-nowrap text-right tabular-nums ${v === 0 ? "text-black/25" : ""}`}>{v === 0 ? "—" : formatarMoeda(v)}{v > 0 && <span aria-hidden="true" className="ml-2 inline-block h-1.5 rounded-full bg-[#7259B5]/55 align-middle" style={{ width: `${Math.max(4, (v / maxCelula) * 46)}px` }} />}</td>;
                })}
                <td className={`${CELULA} text-right tabular-nums`}>{formatarMoeda(s.totalCentavos)}</td>
              </tr>
            ))}
            <tr><td className={CELULA}>Total</td>{nomes.map(c => <td key={c} className={`${CELULA} text-right tabular-nums`}>{formatarMoeda(cal.totalPorCanal[c])}</td>)}<td className={`${CELULA} text-right tabular-nums`}>{formatarMoeda(cal.totalCentavos)}</td></tr>
          </tbody>
        </table>
      </div>
      {cal.sobraCentavos > 0 && <p className="rounded-xl border px-3 py-2 text-[0.75rem] text-black/60" style={{ borderColor: "rgba(176,122,20,.25)", background: "#FFFBF2" }}>{cal.parouNaLotacao
        ? `${formatarMoeda(cal.sobraCentavos)} ficaram de fora: faltam ${inteiro(plano.lugaresRestantes ?? 0)} lugares nesta sessão, e com ${formatarMoeda(cal.totalCentavos)} os anúncios já venderiam isso. Parte dos lugares ainda vende sem anúncio, então dá para gastar até menos.`
        : `${formatarMoeda(cal.sobraCentavos)} ficaram de fora: acima disso, nestas semanas, os canais já rendem quase nada pelo que o modelo viu.`}</p>}
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
          <div className="flex items-start justify-between gap-3"><p className="text-[0.875rem] text-[#282525]">O mesmo dinheiro, gasto de outros jeitos</p><SeloDePrecisao selo="razoavel" /></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border px-3.5 py-3" style={{ borderColor: "rgba(114,89,181,.45)", background: "#FAF8FE" }}><p className="text-[0.78rem] text-[#282525]">Como o calendário aponta</p><p className="mt-1 text-[1.25rem] tabular-nums text-[#282525]">{inteiro(cal.comparacao.ingressos)}</p><p className="text-[0.6875rem] text-black/50">ingressos, entre {inteiro(cal.baixo)} e {inteiro(cal.alto)}</p></div>
            <div className="rounded-xl border px-3.5 py-3" style={{ borderColor: BORDA }}><p className="text-[0.78rem] text-[#282525]">Igual toda semana</p><p className="mt-1 text-[1.25rem] tabular-nums text-[#282525]">{inteiro(cal.comparacao.igual)}</p><p className="text-[0.6875rem] text-black/50">{diferenca(cal.comparacao.igual)}</p></div>
            <div className="rounded-xl border px-3.5 py-3" style={{ borderColor: BORDA }}><p className="text-[0.78rem] text-[#282525]">{S <= 2 ? "Tudo no fim" : "Tudo nas 2 últimas semanas"}</p><p className="mt-1 text-[1.25rem] tabular-nums text-[#282525]">{inteiro(cal.comparacao.noFim)}</p><p className="text-[0.6875rem] text-black/50">{diferenca(cal.comparacao.noFim)}</p></div>
          </div>
          <p className="mt-2.5 text-[0.75rem] leading-relaxed text-black/50">Ingressos vendidos pelos anúncios até a sessão, sem contar o que venderia de qualquer jeito. Deixar para o fim rende menos porque o efeito dos anúncios demora a aparecer e parte dele cai depois da data. Cada canal fica com o mesmo total nos três jeitos.</p>
        </div>
        <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
          <p className="text-[0.875rem] text-[#282525]">Por que assim</p>
          <div className="mt-2 space-y-1 text-[0.78rem] leading-relaxed text-[#282525]">
            {usados.map(c => <p key={c.canal}>{rotuloDoCanalDeGasto(c.canal)}: <span className="text-black/50">{porQueAssim(c, cal.semanas.map(s => s.porCanal[c.canal] ?? 0))}</span></p>)}
          </div>
          <p className="mt-2 text-[0.75rem] leading-relaxed text-black/50">Se a sessão lotar antes, pare de gastar: o calendário não sabe o que você vende fora dos anúncios.</p>
        </div>
      </div>
      <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        <p className="text-[0.8125rem] text-[#282525]">Ingressos esperados por semana, pelos anúncios</p>
        <div className="mb-2 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-black/50">{nomes.map((c, i) => <span key={c} className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: CORES[i % CORES.length] }} />{rotuloDoCanalDeGasto(c)}</span>)}</div>
        <GraficoDoCalendario cal={cal} canais={nomes} diaDaSessao={plano.diaDaSessao} />
      </div>
      <p className="max-w-4xl text-[0.75rem] leading-relaxed text-black/50">
        É o que o modelo aponta, não uma garantia: vem das curvas que ele estimou com as suas {semanasDoModelo} semanas de histórico e vale perto do que você já gastou por semana. A faixa costuma ser otimista.
        {cal.foraDaFaixa.length > 0 && ` Em algumas semanas, ${cal.foraDaFaixa.map(rotuloDoCanalDeGasto).join(" e ")} passa${cal.foraDaFaixa.length > 1 ? "m" : ""} do maior gasto semanal que você já testou: ali a previsão é menos firme.`}
      </p>
    </div>
  );
}

const EXEMPLO_DO_CALENDARIO = [{ semana: "27/10", meta: 65000, google: 15000 }, { semana: "10/11", meta: 25000, google: 15000 }, { semana: "01/12", meta: 0, google: 10000 }];

/** Antes de o modelo ter histórico para isso: o calendário com exemplo e a regra geral que já vale. */
export function PreviaDoCalendario({ motivo, acao, onAcao }: { motivo: string; acao?: string; onAcao?: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="relative rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        <div className="absolute right-4 top-3.5"><SeloDePrecisao selo="exemplo" /></div>
        <div aria-hidden="true" className="opacity-50">
          <p className="text-[0.875rem] text-black/60">Calendário de divulgação do evento</p>
          <table className="mt-2 w-full border-collapse text-[0.75rem] text-[#282525]">
            <thead><tr className="text-[0.625rem] uppercase tracking-[.08em] text-black/40"><th className="py-1 text-left font-normal">Semana</th><th className="py-1 text-right font-normal">Meta Ads</th><th className="py-1 text-right font-normal">Google Ads</th></tr></thead>
            <tbody>{EXEMPLO_DO_CALENDARIO.map(l => <tr key={l.semana}><td className="py-1">{l.semana}</td><td className="py-1 text-right">{l.meta ? formatarMoeda(l.meta) : "—"}</td><td className="py-1 text-right">{formatarMoeda(l.google)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-2.5 text-[0.75rem] leading-relaxed text-black/50">{motivo}{acao && onAcao && <> <button type="button" onClick={onAcao} className="rounded-xl text-[#7259B5] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{acao}</button></>}</p>
      </div>
      <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        <div className="flex items-start justify-between gap-3"><p className="text-[0.875rem] text-[#282525]">O que já vale para qualquer evento</p><span className="inline-flex shrink-0 items-center rounded-xl border px-2 py-0.5 text-[0.625rem]" style={{ color: "#B07A14", borderColor: "rgba(176,122,20,.4)" }}>regra geral</span></div>
        <div className="mt-1.5 space-y-1.5 text-[0.75rem] leading-relaxed text-black/50">
          <p>O anúncio continua vendendo nas semanas seguintes; o que você paga na semana da sessão tem pouco tempo para render.</p>
          <p>Deixar quase tudo para o fim costuma vender menos que espalhar o mesmo valor pelas semanas antes.</p>
          <p>Não é medido com os seus dados: é como os anúncios costumam se comportar. O quanto vale para você, só o modelo diz.</p>
        </div>
      </div>
    </div>
  );
}
