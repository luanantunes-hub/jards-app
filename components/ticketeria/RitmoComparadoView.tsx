"use client";

import { useCallback, useEffect, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import { SeloDePrecisao } from "@/components/ticketeria/PainelView";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import { DIAS_DA_CURVA, MIN_VENDIDO_DO_PARECIDO, type Candidato, type PrevisaoPorComparacao } from "@/lib/ticketeria/ritmo-comparado";
import type { RitmoDoEvento } from "@/lib/ticketeria/modelo-painel";

// O ritmo de venda comparado com eventos parecidos (a lotação prevista), na aba Modelo: a previsão com faixa, o gráfico das vendas acumuladas contra a faixa dos parecidos, a tabela dos eventos usados e,
// sem parecido, a expectativa do próprio produtor. Não é MMM. Só desenho: os dados e as ações chegam por props. A escolha dos parecidos e a expectativa ficam NESTE navegador (conveniência de quem usa).

const BORDA = "rgba(13,13,13,.08)";
const ROXO = "#7259B5";
const numero = (n: number) => Math.round(n).toLocaleString("pt-BR");
// `relative`: o texto `sr-only` do cabeçalho (posicionado de forma absoluta) fica dentro da célula; solto, contava como parte da página e criava um segundo scroll, com espaço em branco, em listas compridas.
const CABECALHO = "relative px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-2.5 text-[0.8125rem] text-[#282525]";
const BOTAO = "rounded-xl border bg-white px-3.5 py-2 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

// ─── O que fica neste navegador ─────────────────────────────────────────────

const ler = <T,>(chave: string, padrao: T): T => { try { const v = window.localStorage.getItem(chave); return v ? (JSON.parse(v) as T) : padrao; } catch { return padrao; } };
const gravar = (chave: string, valor: unknown | null) => { try { if (valor === null) window.localStorage.removeItem(chave); else window.localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento: vale só nesta tela */ } };

/** A escolha dos eventos parecidos e a expectativa de venda de uma sessão, guardadas só neste navegador (não vão ao servidor). */
export function useEscolhasDoRitmo(lojaId: string | null, sessaoId: string | null) {
  const chaveEscolhas = lojaId && sessaoId ? `ticketeria:parecidos:${lojaId}:${sessaoId}` : null;
  const chaveExpectativa = lojaId && sessaoId ? `ticketeria:expectativa:${lojaId}:${sessaoId}` : null;
  const [escolhas, setEscolhas] = useState<Record<string, boolean>>({});
  const [expectativa, setExpectativa] = useState<number | null>(null);
  useEffect(() => {
    queueMicrotask(() => {
      setEscolhas(chaveEscolhas ? ler<Record<string, boolean>>(chaveEscolhas, {}) : {});
      setExpectativa(chaveExpectativa ? ler<number | null>(chaveExpectativa, null) : null);
    });
  }, [chaveEscolhas, chaveExpectativa]);
  const salvarEscolhas = useCallback((novas: Record<string, boolean>) => { setEscolhas(novas); if (chaveEscolhas) gravar(chaveEscolhas, novas); }, [chaveEscolhas]);
  const salvarExpectativa = useCallback((valor: number | null) => { setExpectativa(valor); if (chaveExpectativa) gravar(chaveExpectativa, valor); }, [chaveExpectativa]);
  return { escolhas, salvarEscolhas, expectativa, salvarExpectativa };
}

// ─── A previsão por comparação ──────────────────────────────────────────────

function Grafico({ ritmo, previsao }: { ritmo: RitmoDoEvento; previsao: PrevisaoPorComparacao }) {
  const comparacao = ritmo.comparacao;
  const W = 640, H = 300, pl = 40, pb = 30, pt = 10;
  const X = (d: number) => pl + ((DIAS_DA_CURVA - d) / DIAS_DA_CURVA) * (W - pl - 14);
  const Y = (v: number) => H - pb - (Math.min(100, v) / 100) * (H - pb - pt);
  const faixa = previsao.faixa;
  const banda = [...faixa.map(f => `${X(f.d).toFixed(1)},${Y(f.max * 100).toFixed(1)}`), ...[...faixa].reverse().map(f => `${X(f.d).toFixed(1)},${Y(f.min * 100).toFixed(1)}`)].join(" ");
  const linha = comparacao ? Array.from({ length: DIAS_DA_CURVA - ritmo.diasAteASessao + 1 }, (_, i) => DIAS_DA_CURVA - i).map(d => `${X(d).toFixed(1)},${Y(((comparacao.acumulado[d] ?? 0) / ritmo.lugares) * 100).toFixed(1)}`).join(" ") : "";
  const hoje = ritmo.lugares > 0 ? (ritmo.vendidos / ritmo.lugares) * 100 : 0;
  const barra = previsao.baixo !== null && previsao.alto !== null ? { de: Y((previsao.alto / ritmo.lugares) * 100), ate: Y((previsao.baixo / ritmo.lugares) * 100) } : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[640px]" role="img" aria-label="Vendas acumuladas deste evento contra a faixa dos eventos parecidos">
      {[0, 25, 50, 75, 100].map(v => <g key={v}><line x1={pl} x2={W - 14} y1={Y(v)} y2={Y(v)} stroke="rgba(13,13,13,.07)" /><text x={4} y={Y(v) + 4} fontSize="10" fill="rgba(13,13,13,.4)">{v}%</text></g>)}
      <polygon points={banda} fill="#EFECF6" />
      <line x1={X(ritmo.diasAteASessao)} x2={X(ritmo.diasAteASessao)} y1={pt} y2={H - pb} stroke="rgba(13,13,13,.25)" strokeDasharray="3 3" />
      <polyline fill="none" stroke={ROXO} strokeWidth="2.6" points={linha} />
      <circle cx={X(ritmo.diasAteASessao)} cy={Y(hoje)} r="5" fill="#fff" stroke={ROXO} strokeWidth="2.4" />
      {barra ? <rect x={X(0) - 9} y={barra.de} width="12" height={Math.max(3, barra.ate - barra.de)} rx="3" fill={ROXO} opacity=".28" /> : <circle cx={X(0) - 3} cy={Y((previsao.ingressos / ritmo.lugares) * 100)} r="4" fill={ROXO} opacity=".35" />}
      {[60, 45, 30, 15, 0].map(d => <text key={d} x={X(d)} y={H - 10} fontSize="10" fill="rgba(13,13,13,.4)" textAnchor="middle">{d} d</text>)}
      <text x={X(ritmo.diasAteASessao) + 8} y={Y(hoje) + 18} fontSize="11" fill={ROXO}>hoje, a {ritmo.diasAteASessao} {ritmo.diasAteASessao === 1 ? "dia" : "dias"}: {Math.round(hoje)}%</text>
    </svg>
  );
}

/** A previsão da lotação por comparação com eventos parecidos: a frase com a faixa e o selo, o gráfico e a tabela dos eventos usados (com o botão de ajustar). */
export function RitmoComparado({ ritmo, previsao, candidatos, onAjustar }: { ritmo: RitmoDoEvento; previsao: PrevisaoPorComparacao; candidatos: Candidato[]; onAjustar?: () => void }) {
  const hojePct = ritmo.lugares > 0 ? (ritmo.vendidos / ritmo.lugares) * 100 : 0;
  const { min, max } = previsao.noMesmoPonto;
  const posicao = hojePct / 100 < min ? "abaixo do que eles tinham" : hojePct / 100 > max ? "acima do que eles tinham" : "dentro do que eles tinham";
  const pontoDe = (c: Candidato["curva"]) => (c.lugares > 0 ? Math.round(((c.acumulado[Math.min(DIAS_DA_CURVA, ritmo.diasAteASessao)] ?? 0) / c.lugares) * 100) : 0);
  const fimDe = (c: Candidato["curva"]) => (c.lugares > 0 ? Math.round(((c.acumulado[0] ?? 0) / c.lugares) * 100) : 0);
  return (
    <section className="space-y-3.5" aria-label="O ritmo comparado com eventos parecidos">
      <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.875rem] text-[#282525]">{previsao.baixo !== null && previsao.alto !== null ? `No ritmo dos eventos parecidos, você chega a ${numero(previsao.baixo)} a ${numero(previsao.alto)} ingressos` : `No ritmo do evento parecido, você chega a cerca de ${numero(previsao.ingressos)} ingressos`}</p>
          <SeloDePrecisao selo={previsao.selo} />
        </div>
        <p className="mt-1.5 max-w-3xl text-[0.75rem] leading-relaxed text-black/50">
          {previsao.baixo !== null && previsao.alto !== null ? `É ${Math.round((previsao.baixo / ritmo.lugares) * 100)}% a ${Math.round((previsao.alto / ritmo.lugares) * 100)}% dos ${numero(ritmo.lugares)} lugares. ` : "Só há um evento parecido: sem faixa, é uma estimativa solta. "}
          Hoje você está em {Math.round(hojePct)}% da lotação a {ritmo.diasAteASessao} {ritmo.diasAteASessao === 1 ? "dia" : "dias"} da sessão, {posicao} no mesmo ponto ({Math.round(min * 100)}% a {Math.round(max * 100)}%). A conta: o que cada evento parecido vendeu no fim, ajustado pela diferença de hoje.
        </p>
      </div>
      <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        <p className="text-[0.8125rem] text-[#282525]">Vendas acumuladas até a sessão</p>
        <p className="mb-2 mt-0.5 text-[0.75rem] text-black/45">Roxo: este evento. Cinza: a faixa dos eventos parecidos. A barra roxa clara no fim é onde a conta termina.</p>
        <Grafico ritmo={ritmo} previsao={previsao} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Eventos parecidos usados na comparação</h3>
        <button type="button" onClick={onAjustar} className={BOTAO} style={{ borderColor: BORDA }}>Ajustar eventos parecidos</button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <table className="w-full min-w-[40rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Evento</th><th className={CABECALHO}>Quando</th><th className={CABECALHO}>Onde</th><th className={`${CABECALHO} text-right`}>Preço médio</th><th className={`${CABECALHO} text-right`}>Vendido a {ritmo.diasAteASessao} dias</th><th className={`${CABECALHO} text-right`}>Vendido no fim</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {candidatos.map(c => (
              <tr key={c.curva.id} className={c.usado ? "" : "text-black/35"}>
                <td className={`${CELULA} ${c.usado ? "" : "!text-black/35"}`}><span className={`mr-2 inline-block size-3.5 rounded border-[1.5px] align-[-2px] ${c.usado ? "border-[#7259B5] bg-[#7259B5]" : "border-black/25"}`} aria-hidden="true" />{c.curva.nome}{!c.usado && !c.veredito.parecido && <span className="ml-2 text-[0.6875rem]">({c.veredito.motivo})</span>}</td>
                <td className={`${CELULA} ${c.usado ? "" : "!text-black/35"}`}>{c.curva.quando}</td>
                <td className={`${CELULA} ${c.usado ? "" : "!text-black/35"}`}>{c.curva.local}</td>
                <td className={`${CELULA} text-right tabular-nums ${c.usado ? "" : "!text-black/35"}`}>{c.curva.precoMedioCentavos > 0 ? formatarMoeda(c.curva.precoMedioCentavos) : "—"}</td>
                <td className={`${CELULA} text-right tabular-nums ${c.usado ? "" : "!text-black/35"}`}>{c.usado ? `${pontoDe(c.curva)}%` : "—"}</td>
                <td className={`${CELULA} text-right tabular-nums ${c.usado ? "" : "!text-black/35"}`}>{c.usado ? `${fimDe(c.curva)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">Parecido quer dizer mesmo local, preço na mesma faixa e que vendeu pelo menos {Math.round(MIN_VENDIDO_DO_PARECIDO * 100)}% da lotação. A faixa estreita com mais eventos. É uma comparação, não uma garantia: um grande nome ou uma final muda tudo, e o Jards não sabe disso.</p>
    </section>
  );
}

// ─── Sem evento parecido ────────────────────────────────────────────────────

/** Sem parecido: o que é medido (já está nos outros blocos), por que não há comparação e a expectativa do próprio produtor, que vira o ponto de partida. */
export function SemParecido({ ritmo, temHistorico, expectativa, onExpectativa, onImportar }: { ritmo: RitmoDoEvento; temHistorico: boolean; expectativa: number | null; onExpectativa?: () => void; onImportar?: () => void }) {
  const passaDoPalpite = expectativa !== null && ritmo.projecao > expectativa;
  return (
    <section className="space-y-3.5" aria-label="Sem evento parecido">
      <div className="grid gap-3.5 md:grid-cols-2">
        <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
          <div className="flex items-start justify-between gap-3"><p className="text-[0.875rem] text-[#282525]">Sem evento parecido, sem previsão por comparação</p><SeloDePrecisao selo="medido" /></div>
          <p className="mt-1.5 text-[0.75rem] leading-relaxed text-black/50">{temHistorico ? "Os seus eventos anteriores são de outro local, de outro preço ou venderam pouco." : "Este é o seu primeiro evento com venda."} Em vez de inventar um número, o Jards mostra o que já aconteceu: {numero(ritmo.vendidos)}{ritmo.lugares > 0 ? ` de ${numero(ritmo.lugares)}` : ""} ingressos{ritmo.porcento !== null ? ` (${ritmo.porcento}%)` : ""} a {ritmo.diasAteASessao} {ritmo.diasAteASessao === 1 ? "dia" : "dias"} da sessão. A conta simples dos últimos 7 dias está no bloco ao lado.</p>
        </div>
        <div className="rounded-xl border px-5 py-4" style={{ borderColor: "rgba(114,89,181,.28)", background: "#FAF8FE" }}>
          <div className="flex items-start justify-between gap-3"><p className="text-[0.875rem] text-[#282525]">Quanto você espera vender?</p><span className="inline-flex shrink-0 rounded-xl border px-2 py-0.5 text-[0.625rem]" style={{ borderColor: "rgba(176,122,20,.4)", color: "#B07A14" }}>sua expectativa</span></div>
          {expectativa === null ? (
            <p className="mt-1.5 text-[0.75rem] leading-relaxed text-black/50">Se você tem uma ideia (“acho que lota 70%”), ela vira o ponto de partida, e os primeiros dias de venda a corrigem. É opcional.</p>
          ) : (
            <>
              <p className="mt-2 text-[1.375rem] tabular-nums tracking-[-.02em] text-[#282525]">{numero(expectativa)} ingressos{ritmo.lugares > 0 && <span className="ml-2 text-[0.8125rem] text-black/45">({Math.round((expectativa / ritmo.lugares) * 100)}% da lotação)</span>}</p>
              <p className="mt-1.5 text-[0.75rem] leading-relaxed text-black/50">Você já vendeu {numero(ritmo.vendidos)} dos {numero(expectativa)} que espera{passaDoPalpite ? ": com o ritmo de hoje, o evento passa do seu palpite." : ritmo.projecao < expectativa ? `: com o ritmo de hoje chega a cerca de ${numero(ritmo.projecao)}, abaixo do palpite.` : "."}</p>
            </>
          )}
          <button type="button" onClick={onExpectativa} className={`mt-3 ${BOTAO}`} style={{ borderColor: BORDA }}>{expectativa === null ? "Dizer quanto espero vender" : "Mudar a expectativa"}</button>
        </div>
      </div>
      <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">Depois da sessão, este evento passa a valer como parecido para os próximos no mesmo local, na mesma faixa de preço.{" "}{onImportar && <>Se você já vendeu aqui antes e ainda não importou, <button type="button" onClick={onImportar} className="rounded-xl text-[#7259B5] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">importar as vendas anteriores</button> traz esse histórico agora.</>} Não ter evento parecido é um fato, não uma falha: a final de um campeonato não se parece com uma rodada comum.</p>
    </section>
  );
}

// ─── As folhas ──────────────────────────────────────────────────────────────

/** A folha "Ajustar eventos parecidos": o produtor marca quais entram na comparação (a sugestão vem do local, do preço e do quanto venderam). */
export function ParecidosSheet({ candidatos, onSalvar, onClose }: { candidatos: Candidato[]; onSalvar?: (escolhas: Record<string, boolean>) => void; onClose: () => void }) {
  const [marcados, setMarcados] = useState<Record<string, boolean>>(() => Object.fromEntries(candidatos.map(c => [c.curva.id, c.usado])));
  return (
    <TopSheet titulo="Eventos parecidos" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={false} rotulo="Salvar" onSalvar={() => { onSalvar?.(marcados); fechar(); }} />}>
      <div className="space-y-3">
        <p className="max-w-xl text-[0.75rem] leading-relaxed text-black/50">Marque os eventos que se parecem com este. O Jards sugere pelo local, pelo preço e por quanto o evento vendeu; você sabe do que ele não sabe, como um nome grande. A escolha fica neste navegador.</p>
        {candidatos.length === 0 && <p className="text-[0.8125rem] text-black/45">Ainda não há evento anterior com venda.</p>}
        <ul className="divide-y divide-black/[.08] rounded-xl border bg-white" style={{ borderColor: BORDA }}>
          {candidatos.map(c => (
            <li key={c.curva.id}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-3 text-[0.8125rem] text-[#282525]">
                <input type="checkbox" className="mt-0.5 size-4 accent-[#7259B5]" checked={!!marcados[c.curva.id]} onChange={e => setMarcados(m => ({ ...m, [c.curva.id]: e.target.checked }))} />
                <span><span className="block">{c.curva.nome} <span className="text-black/45">· {c.curva.quando} · {c.curva.local}</span></span><span className="block text-[0.6875rem] text-black/45">{c.veredito.parecido ? "Sugerido: mesmo local, preço na faixa." : `Não sugerido: ${c.veredito.motivo}.`}</span></span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </TopSheet>
  );
}

/** A folha "Quanto você espera vender?": o número de ingressos (opcional, só neste navegador). */
export function ExpectativaSheet({ lugares, valorInicial, onSalvar, onClose }: { lugares: number; valorInicial: number | null; onSalvar?: (valor: number | null) => void; onClose: () => void }) {
  const [texto, setTexto] = useState(valorInicial === null ? "" : String(valorInicial));
  const [erro, setErro] = useState<string | null>(null);
  const n = Number(texto.replace(",", "."));
  return (
    <TopSheet titulo="Quanto você espera vender?" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={false} rotulo="Salvar" onApagar={valorInicial !== null ? () => { onSalvar?.(null); fechar(); } : undefined} rotuloApagar="Apagar" onSalvar={() => {
      if (!Number.isInteger(n) || n < 1 || (lugares > 0 && n > lugares)) { setErro(lugares > 0 ? `Digite um número de ingressos entre 1 e ${lugares}.` : "Digite um número de ingressos."); return; }
      onSalvar?.(n); fechar();
    }} />}>
      <div className="space-y-3">
        <p className="max-w-xl text-[0.75rem] leading-relaxed text-black/50">Se você tem uma ideia de quantos ingressos vai vender, diga aqui. Ela serve de ponto de partida e os primeiros dias de venda a corrigem. É opcional e fica neste navegador.</p>
        {erro && <Aviso texto={erro} />}
        <div><label className={ROTULO} htmlFor="ex-n">Ingressos esperados{lugares > 0 ? ` (a lotação é ${lugares})` : ""}</label><input id="ex-n" inputMode="numeric" className={CAMPO} value={texto} onChange={e => { setTexto(e.target.value); setErro(null); }} placeholder="140" /></div>
      </div>
    </TopSheet>
  );
}
