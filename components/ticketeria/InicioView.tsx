import type { ReactNode } from "react";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import type { DadosDoPeriodo, InicioDaLoja, NaoConcluida, PeriodoDoInicio } from "@/lib/ticketeria/inicio";
import type { ReembolsoDaLista, SessaoDeVendas } from "@/components/ticketeria/VendasView";

// A página inicial da Ticketeria, no jeito do painel do Stripe: "Hoje" (o que entrou, ontem, saldos e a próxima sessão) e a "Visão geral" por período.
// Só rótulos e números, sem texto explicativo. Os gráficos são SVG simples (sem biblioteca). A tela que lê os dados está em app/(dashboard)/ingressos/page.tsx.

const BORDA = "rgba(13,13,13,.08)";
const ROXO = "#7259B5";
const ROTULO = "text-[0.8125rem] text-black/55";
const NUMERO = "text-[1.625rem] font-medium tracking-[-.01em] text-[#282525] tabular-nums";
const LINK = "text-[0.8125rem] text-[#7259B5] underline-offset-2 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] rounded-xl";

const inteiro = (n: number) => n.toLocaleString("pt-BR");
/** "R$ 2 mil" nos rótulos do eixo. */
const compacto = (centavos: number) => { const reais = centavos / 100; return reais >= 1000 ? `R$ ${(reais / 1000).toLocaleString("pt-BR")} mil` : `R$ ${Math.round(reais).toLocaleString("pt-BR")}`; };
const soUmaCasa = (n: number) => String(n);

/** O teto redondo do eixo: 1, 2, 2,5, 5 ou 10 vezes a potência de dez. */
export function tetoDoEixo(maior: number): number {
  if (maior <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(maior));
  return ([1, 2, 2.5, 5, 10].find(k => k * potencia >= maior) ?? 10) * potencia;
}

function Cartao({ titulo, aside, children, rodape, className = "" }: { titulo: string; aside?: ReactNode; children: ReactNode; rodape?: ReactNode; className?: string }) {
  return (
    <section aria-label={titulo} className={`flex flex-col rounded-xl border bg-white p-5 ${className}`} style={{ borderColor: BORDA }}>
      <div className="mb-3 flex items-baseline justify-between gap-3"><h3 className="text-[0.8125rem] font-medium text-[#282525]">{titulo}</h3>{aside}</div>
      <div className="flex-1">{children}</div>
      {rodape && <div className="mt-4 flex justify-end">{rodape}</div>}
    </section>
  );
}

/** Linha do gráfico com a área embaixo, a grade e o eixo à direita (o jeito do Stripe). */
export function Grafico({ serie, formato, de, ate, altura = "h-40", rotulo }: { serie: number[]; formato: (n: number) => string; de: string; ate: string; altura?: string; rotulo: string }) {
  const teto = tetoDoEixo(Math.max(...serie, 0));
  const n = Math.max(serie.length, 2);
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 100 - (v / teto) * 100;
  const pontos = serie.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const linha = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${p}`).join(" ");
  const area = `${linha} L${x(serie.length - 1).toFixed(2)},100 L0,100 Z`;
  const marcas = [0, 0.5, 1];
  return (
    <figure aria-label={rotulo} className="m-0">
      <div className={`relative ${altura}`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-y-0 left-0 right-16 h-full w-[calc(100%-4rem)] overflow-visible" role="img" aria-hidden="true">
          {marcas.map(m => <line key={m} x1="0" x2="100" y1={100 - m * 100} y2={100 - m * 100} stroke="rgba(13,13,13,.09)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          <path d={area} fill={ROXO} fillOpacity="0.08" />
          <path d={linha} fill="none" stroke={ROXO} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {marcas.map(m => <span key={m} className="absolute right-0 w-14 -translate-y-1/2 text-right text-[0.6875rem] text-black/40 tabular-nums" style={{ top: `${100 - m * 100}%` }}>{formato(Math.round(teto * m))}</span>)}
      </div>
      <figcaption className="mr-16 mt-2 flex justify-between text-[0.6875rem] text-black/40"><span>{de}</span><span>{ate}</span></figcaption>
    </figure>
  );
}

/** Hoje (linha cheia, para na hora atual) contra ontem (tracejada), acumulado hora a hora. */
export function GraficoDoDia({ hoje, ontem }: { hoje: (number | null)[]; ontem: number[] }) {
  const teto = tetoDoEixo(Math.max(...ontem, ...hoje.map(v => v ?? 0), 0));
  const x = (i: number) => (i / 23) * 100;
  const y = (v: number) => 100 - (v / teto) * 100;
  const trecho = (serie: (number | null)[]) => serie.flatMap((v, i) => (v === null ? [] : [`${x(i).toFixed(2)},${y(v).toFixed(2)}`])).map((p, i) => `${i === 0 ? "M" : "L"}${p}`).join(" ");
  return (
    <figure aria-label="Vendas de hoje e de ontem, hora a hora" className="m-0">
      <div className="relative h-44">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-y-0 left-0 h-full w-full overflow-visible" aria-hidden="true">
          <path d={trecho(ontem)} fill="none" stroke="rgba(13,13,13,.35)" strokeWidth="1.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <path d={trecho(hoje)} fill="none" stroke={ROXO} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2="100" y1="100" y2="100" stroke="rgba(13,13,13,.15)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <figcaption className="mt-2 flex justify-between text-[0.6875rem] text-black/40"><span>00:00</span><span>00:00</span></figcaption>
    </figure>
  );
}

const COR_DA_VENDA = { pagas: ROXO, aguardando: "#B07A14", reembolsadas: "#3A8FB7", canceladas: "#D94A4A" } as const;
const ROTULO_DA_VENDA = { pagas: "Pagas", aguardando: "Aguardando", reembolsadas: "Reembolsadas", canceladas: "Canceladas" } as const;

function VendasPorSituacao({ vendas }: { vendas: DadosDoPeriodo["vendas"] }) {
  const ordem = ["pagas", "aguardando", "reembolsadas", "canceladas"] as const;
  const total = ordem.reduce((s, k) => s + vendas[k].quantidade, 0);
  return (
    <>
      <div className="mb-4 flex h-3 overflow-hidden rounded-xl bg-black/[.06]" role="img" aria-label="Compras por situação">
        {total > 0 && ordem.map(k => vendas[k].quantidade > 0 && <span key={k} style={{ width: `${(vendas[k].quantidade / total) * 100}%`, background: COR_DA_VENDA[k] }} />)}
      </div>
      <ul className="m-0 list-none space-y-2.5 p-0">
        {ordem.map(k => (
          <li key={k} className="flex items-center justify-between gap-3 text-[0.8125rem]">
            <span className="flex items-center gap-2 text-black/70"><span className="h-2 w-2 rounded-full" style={{ background: COR_DA_VENDA[k] }} aria-hidden="true" />{ROTULO_DA_VENDA[k]}<span className="text-black/35 tabular-nums">{inteiro(vendas[k].quantidade)}</span></span>
            <span className="tabular-nums text-[#282525]">{formatarMoeda(vendas[k].valor_centavos)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Sessoes({ sessoes }: { sessoes: SessaoDeVendas[] }) {
  if (sessoes.length === 0) return <p className="m-0 text-[0.8125rem] text-black/35">—</p>;
  return (
    <ul className="m-0 list-none space-y-4 p-0">
      {sessoes.map(s => {
        const pct = s.lugares > 0 ? Math.min(100, Math.round((s.vendidos / s.lugares) * 100)) : 0;
        return (
          <li key={s.id}>
            <div className="flex items-baseline justify-between gap-3"><span className="truncate text-[0.8125rem] text-[#282525]">{s.evento}</span><span className="shrink-0 text-[0.75rem] text-black/45 tabular-nums">{inteiro(s.vendidos)}{s.lugares > 0 ? ` de ${inteiro(s.lugares)}` : ""}</span></div>
            <div className="mt-0.5 text-[0.75rem] text-black/40">{s.quando}</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-xl bg-black/[.06]" role="img" aria-label={`${pct}% vendido`}><div className="h-full rounded-xl" style={{ width: `${pct}%`, background: ROXO }} /></div>
          </li>
        );
      })}
    </ul>
  );
}

const ETIQUETA_NAO_CONCLUIDA: Record<NaoConcluida["situacao"], { texto: string; cor: string }> = { aguardando_pagamento: { texto: "Aguardando", cor: "#B07A14" }, cancelado: { texto: "Cancelado", cor: "#6B6767" } };
const ETIQUETA_DO_REEMBOLSO: Record<ReembolsoDaLista["situacao"], { texto: string; cor: string }> = {
  estornando: { texto: "Estornando", cor: "#B07A14" }, estornado: { texto: "Estornado", cor: "#2E8932" }, falhou: { texto: "Falha", cor: "#D94A4A" }, fora_do_prazo: { texto: "Fora do prazo", cor: "#6B6767" },
  remetente_diferente: { texto: "Outro remetente", cor: "#6B6767" }, nao_elegivel: { texto: "Não elegível", cor: "#6B6767" }, ja_reembolsado: { texto: "Já reembolsado", cor: "#6B6767" },
};
function Etiqueta({ texto, cor }: { texto: string; cor: string }) { return <span className="inline-flex shrink-0 rounded-xl border px-2 py-0.5 text-[0.6875rem]" style={{ borderColor: cor + "47", color: cor, background: cor + "0F" }}>{texto}</span>; }

function Linhas({ vazio, children }: { vazio: boolean; children: ReactNode }) {
  if (vazio) return <p className="m-0 text-[0.8125rem] text-black/35">—</p>;
  return <ul className="m-0 list-none divide-y divide-black/[.08] p-0">{children}</ul>;
}

export const PERIODOS: { id: PeriodoDoInicio; rotulo: string }[] = [{ id: "tudo", rotulo: "Desde o início" }, { id: "30d", rotulo: "30 dias" }, { id: "7d", rotulo: "7 dias" }];

export function InicioView({ dados, periodo, onPeriodo, ver }: { dados: InicioDaLoja; periodo: PeriodoDoInicio; onPeriodo: (p: PeriodoDoInicio) => void; ver: (destino: string) => ReactNode }) {
  const p = dados.periodos[periodo];
  const { hoje, saldos, proxima } = dados;
  const pctDaProxima = proxima && proxima.lugares > 0 ? Math.min(100, Math.round((proxima.vendidos / proxima.lugares) * 100)) : 0;
  return (
    <div className="space-y-10">
      <section aria-label="Hoje" className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <div className="grid grid-cols-2 gap-6">
            <div><div className={ROTULO}>Vendas</div><div className={`mt-1 ${NUMERO}`}>{formatarMoeda(hoje.vendido_centavos)}</div><div className="mt-0.5 text-[0.75rem] text-black/40 tabular-nums">{hoje.hora}</div></div>
            <div><div className={ROTULO}>Ontem</div><div className={`mt-1 ${NUMERO} text-black/55`}>{formatarMoeda(hoje.ontem_vendido_centavos)}</div></div>
          </div>
          <div className="mt-4"><GraficoDoDia hoje={hoje.serie_hoje} ontem={hoje.serie_ontem} /></div>
          <div className="mt-8 grid grid-cols-2 gap-6">
            <div><div className={ROTULO}>Liberado para saque</div><div className={`mt-1 ${NUMERO}`}>{formatarMoeda(saldos.liberado_centavos)}</div><div className="mt-1">{ver("/ingressos/recebimentos")}</div></div>
            <div><div className={ROTULO}>Retido</div><div className={`mt-1 ${NUMERO}`}>{formatarMoeda(saldos.retido_centavos)}</div></div>
          </div>
        </div>
        <aside aria-label="Próxima sessão" className="self-start rounded-xl border bg-white p-5" style={{ borderColor: BORDA }}>
          <div className="text-[0.75rem] text-black/45">Próxima sessão</div>
          {proxima ? (
            <>
              <div className="mt-2 text-[1.125rem] font-medium leading-snug text-[#282525]">{proxima.evento}</div>
              <div className="mt-1 text-[0.8125rem] text-black/55">{proxima.quando}</div>
              <div className="mt-5 flex items-baseline justify-between"><span className={NUMERO}>{inteiro(proxima.vendidos)}</span><span className="text-[0.75rem] text-black/40 tabular-nums">{proxima.lugares > 0 ? `de ${inteiro(proxima.lugares)}` : ""}</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-xl bg-black/[.06]" role="img" aria-label={`${pctDaProxima}% vendido`}><div className="h-full rounded-xl" style={{ width: `${pctDaProxima}%`, background: ROXO }} /></div>
              <div className="mt-5">{ver("/ingressos/vendas")}</div>
            </>
          ) : <div className="mt-2 text-[0.875rem] text-black/35">—</div>}
        </aside>
      </section>

      <section aria-label="Visão geral">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: BORDA }}>
          <h2 className="m-0 text-[1.375rem] font-medium tracking-[-.01em] text-[#282525]">Visão geral</h2>
          <div role="group" aria-label="Período" className="flex gap-1.5">
            {PERIODOS.map(item => (
              <button key={item.id} type="button" aria-pressed={periodo === item.id} onClick={() => onPeriodo(item.id)}
                className={`rounded-xl border px-3 py-1.5 text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${periodo === item.id ? "border-[#7259B5]/40 bg-[#7259B5]/[.08] text-[#5D489D]" : "border-black/[.12] bg-white text-black/55 hover:bg-black/[.03]"}`}>
                {item.rotulo}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Cartao titulo="Vendas" rodape={ver("/ingressos/vendas")}><VendasPorSituacao vendas={p.vendas} /></Cartao>
          <Cartao titulo="Volume vendido" aside={<span className="text-[0.75rem] text-black/40 tabular-nums">Repasse {formatarMoeda(p.repasse_centavos)}</span>} rodape={ver("/ingressos/vendas")}>
            <div className={`mb-3 ${NUMERO}`}>{formatarMoeda(p.vendido.total_centavos)}</div>
            <Grafico serie={p.vendido.serie} formato={compacto} de={p.vendido.de} ate={p.vendido.ate} rotulo="Volume vendido" />
          </Cartao>
          <Cartao titulo="Ingressos" rodape={ver("/ingressos/vendas")}>
            <div className={`mb-3 ${NUMERO}`}>{inteiro(p.ingressos.total)}</div>
            <Grafico serie={p.ingressos.serie} formato={soUmaCasa} de={p.ingressos.de} ate={p.ingressos.ate} rotulo="Ingressos vendidos" />
          </Cartao>
          <Cartao titulo="Sessões" rodape={ver("/ingressos/eventos")}><Sessoes sessoes={dados.sessoes} /></Cartao>
          <Cartao titulo="Compras não concluídas" rodape={ver("/ingressos/vendas")}>
            <Linhas vazio={dados.nao_concluidas.length === 0}>
              {dados.nao_concluidas.map(c => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                  <div className="min-w-0"><div className="text-[0.875rem] tabular-nums text-[#282525]">{formatarMoeda(c.valor_centavos)}</div><div className="truncate text-[0.75rem] text-black/45">{c.quando} · {c.email}</div></div>
                  <Etiqueta {...ETIQUETA_NAO_CONCLUIDA[c.situacao]} />
                </li>
              ))}
            </Linhas>
          </Cartao>
          <Cartao titulo="Reembolsos" rodape={ver("/ingressos/vendas")}>
            <Linhas vazio={dados.reembolsos.length === 0}>
              {dados.reembolsos.map(r => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                  <div className="min-w-0"><div className="text-[0.875rem] tabular-nums text-[#282525]">{r.valor_centavos !== null ? formatarMoeda(r.valor_centavos) : r.codigo}</div><div className="truncate text-[0.75rem] text-black/45">{r.recebido} · {r.remetente}</div></div>
                  <Etiqueta {...ETIQUETA_DO_REEMBOLSO[r.situacao]} />
                </li>
              ))}
            </Linhas>
          </Cartao>
          <Cartao titulo="Principais compradores" className="md:col-span-2 xl:col-span-3" rodape={ver("/ingressos/vendas")}>
            <Linhas vazio={p.compradores.length === 0}>
              {p.compradores.map(c => (
                <li key={c.email} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <div className="min-w-0"><div className="truncate text-[0.875rem] text-[#282525]">{c.nome}</div><div className="truncate text-[0.75rem] text-black/45">{c.email}</div></div>
                  <div className="shrink-0 text-right"><div className="text-[0.875rem] tabular-nums text-[#282525]">{formatarMoeda(c.valor_centavos)}</div><div className="text-[0.75rem] text-black/40 tabular-nums">{c.compras === 1 ? "1 compra" : `${inteiro(c.compras)} compras`}</div></div>
                </li>
              ))}
            </Linhas>
          </Cartao>
        </div>
      </section>
    </div>
  );
}

/** "Ver tudo" dos cartões: o link vem da página (Link do Next); aqui só o estilo. */
export const ESTILO_DO_LINK = LINK;
