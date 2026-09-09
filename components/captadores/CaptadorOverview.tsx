"use client";

import Link from "next/link";
import {
  Activity, AlertCircle, Banknote, CalendarDays, CheckCircle2,
  CircleDot, Clock3, FileCheck2, Info, Percent, Send, UsersRound,
} from "lucide-react";

type Metric = {
  valor: number | null;
  mediana_pares: number | null;
  numerador?: number;
  denominador?: number;
  base_suficiente?: boolean;
};

type Alert = {
  id?: string;
  tipo: string;
  titulo: string;
  detalhe: string;
  severidade: "atencao" | "risco";
  href: string;
  acao: string;
};

type RecentEvent = {
  id: string;
  tipo: string;
  titulo: string;
  contexto: string | null;
  ocorrido_em: string;
  href: string | null;
};

export type CaptadorOverviewData = {
  periodo: { inicio: string; fim: string };
  comparacao: { pares_elegiveis: number; confiavel: boolean };
  valor_captado: Metric;
  conversao: Metric;
  carteira_movimento: Metric;
  funil: { oportunidades: number; propostas: number; aprovacoes: number };
  alertas: Alert[];
  atividade_recente: RecentEvent[];
};

function currency(value: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function percent(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value)}%`;
}

function relativeDate(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "—";
  const days = Math.round((timestamp - Date.now()) / 86_400_000);
  if (days === 0) return "Hoje";
  if (days === -1) return "Ontem";
  if (days > -7 && days < 0) return `Há ${Math.abs(days)} dias`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(timestamp);
}

function comparisonCopy(current: number | null, median: number | null, reliable: boolean, unit: "money" | "percent") {
  if (!reliable || current == null || median == null) return { text: "Referência ainda em formação", tone: "neutral" as const };
  const delta = unit === "percent"
    ? current - median
    : median === 0 ? (current > 0 ? 100 : 0) : ((current - median) / Math.abs(median)) * 100;
  const absolute = Math.abs(Math.round(delta));
  if (delta >= 10) return { text: unit === "percent" ? `${absolute} p.p. acima da mediana` : `${absolute}% acima da mediana`, tone: "positive" as const };
  if (delta <= -10) return { text: unit === "percent" ? `${absolute} p.p. abaixo da mediana` : `${absolute}% abaixo da mediana`, tone: "attention" as const };
  return { text: "Próximo da mediana da equipe", tone: "neutral" as const };
}

function MetricBlock({
  label,
  value,
  median,
  reliable,
  formatter,
  unit,
  detail,
  sampleSize,
  icon: Icon,
}: {
  label: string;
  value: number | null;
  median: number | null;
  reliable: boolean;
  formatter: (value: number | null) => string;
  unit: "money" | "percent";
  detail?: string;
  sampleSize?: number;
  icon: React.ElementType;
}) {
  const comparison = comparisonCopy(value, median, reliable, unit);
  const noFinancialHistory = unit === "money" && value === 0 && median === 0;
  const scale = Math.max(value ?? 0, median ?? 0, 1);
  const currentWidth = Math.max(value == null ? 0 : 4, Math.min(100, ((value ?? 0) / scale) * 100));
  const medianPosition = Math.min(100, ((median ?? 0) / scale) * 100);
  const tone = comparison.tone === "positive" ? "#2E8932" : comparison.tone === "attention" ? "#B07A14" : "rgba(13,13,13,.42)";
  const sampleLabel = noFinancialHistory
    ? "Sem base"
    : !reliable
      ? "Amostra inicial"
      : sampleSize != null && sampleSize < 5
        ? "Base moderada"
        : sampleSize != null
          ? "Base confiável"
          : "Base comparável";
  const comparisonText = noFinancialHistory ? "Nenhuma captação no período" : comparison.text;

  return (
    <div className="min-w-0 px-5 py-5 sm:px-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-black/38">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-black/[.045] text-black/40">
            <Icon size={13} strokeWidth={1.8} />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[.11em]">{label}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[9px] font-medium text-black/28" title="A confiança considera o tamanho da amostra e a quantidade de captadores comparáveis.">
          <Info size={9} /> {sampleLabel}
        </span>
      </div>
      <p className="text-[25px] font-semibold leading-none tracking-[-.035em] text-[#0D0D0D] tabular-nums">{formatter(value)}</p>
      <p className="mt-2 min-h-4 text-[11px] font-medium" style={{ color: tone }}>{comparisonText}</p>
      <div className="relative mt-4 h-1 overflow-visible rounded-sm bg-black/[.06]">
        <div className="h-full rounded-sm bg-[#0D0D0D]/75 transition-[width] duration-500" style={{ width: `${noFinancialHistory ? 0 : currentWidth}%` }} />
        {reliable && median != null && !noFinancialHistory && (
          <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-[#7259B5]" style={{ left: `${medianPosition}%` }} title={`Mediana: ${formatter(median)}`} />
        )}
      </div>
      <p className="mt-2 text-[10px] text-black/28">
        {detail ?? (noFinancialHistory ? "A equipe também está sem valor captado nesta amostra" : reliable && median != null ? `Mediana ${formatter(median)}` : "Dados insuficientes para comparar")}
      </p>
    </div>
  );
}

function buildSummary(data: CaptadorOverviewData) {
  if (!data.comparacao.confiavel) {
    return { before: "Ainda não há uma ", emphasis: "base suficiente", after: " para comparar este captador com a equipe." };
  }
  const value = comparisonCopy(data.valor_captado.valor, data.valor_captado.mediana_pares, true, "money");
  const conversion = comparisonCopy(data.conversao.valor, data.conversao.mediana_pares, Boolean(data.conversao.base_suficiente), "percent");
  const movement = comparisonCopy(data.carteira_movimento.valor, data.carteira_movimento.mediana_pares, (data.carteira_movimento.denominador ?? 0) >= 3, "percent");
  if (data.alertas.some(item => item.severidade === "risco")) {
    return { before: "Há resultado registrado, mas a carteira possui ", emphasis: "pontos que pedem atenção", after: "." };
  }
  if (movement.tone === "attention") {
    return { before: "O desempenho comercial está registrado, mas a carteira está ", emphasis: "abaixo da referência", after: "." };
  }
  if (value.tone === "positive" && conversion.tone !== "attention") {
    return { before: "Valor captado ", emphasis: "acima da referência", after: ", com eficiência comercial consistente." };
  }
  if (conversion.tone === "positive") {
    return { before: "Boa ", emphasis: "eficiência de conversão", after: " em relação aos demais captadores da equipe." };
  }
  return { before: "Desempenho ", emphasis: "próximo da referência", after: " da equipe no período analisado." };
}

export function CaptadorOverview({ data }: { data: CaptadorOverviewData | null }) {
  if (!data) {
    return (
      <div className="rounded border border-black/[.08] bg-white px-6 py-14 text-center">
        <Activity size={22} className="mx-auto text-black/15" />
        <p className="mt-3 text-[13px] font-medium text-black/38">Ainda não há dados suficientes para esta leitura.</p>
      </div>
    );
  }

  const comparisonLabel = data.comparacao.pares_elegiveis > 0
    ? `${data.comparacao.pares_elegiveis} ${data.comparacao.pares_elegiveis === 1 ? "captador comparável" : "captadores comparáveis"}`
    : "Referência em formação";
  const summary = buildSummary(data);
  const resultItems = [
    { value: data.funil.oportunidades, label: "oportunidades", icon: CircleDot },
    { value: data.funil.propostas, label: "propostas", icon: Send },
    { value: data.funil.aprovacoes, label: "aprovações", icon: FileCheck2 },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded border border-black/[.08] bg-white">
        <div className="px-5 pb-5 pt-6 sm:px-6">
          <p className="max-w-3xl text-[20px] font-semibold leading-[1.25] tracking-[-.025em] text-[#0D0D0D] sm:text-[22px]">
            <span className="font-normal text-black/65">{summary.before}</span>
            <span className="font-semibold text-[#0D0D0D]">{summary.emphasis}</span>
            <span className="font-normal text-black/65">{summary.after}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-black/32">
            <span className="inline-flex items-center gap-1.5"><UsersRound size={11} /> {comparisonLabel}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={11} /> Últimos 12 meses</span>
          </div>
        </div>

        <div className="grid border-t border-black/[.06] sm:grid-cols-3 sm:divide-x sm:divide-black/[.06]">
          <MetricBlock
            label="Valor captado"
            value={data.valor_captado.valor}
            median={data.valor_captado.mediana_pares}
            reliable={data.comparacao.confiavel}
            formatter={currency}
            unit="money"
            icon={Banknote}
          />
          <MetricBlock
            label="Conversão"
            value={data.conversao.valor}
            median={data.conversao.mediana_pares}
            reliable={data.comparacao.confiavel && Boolean(data.conversao.base_suficiente)}
            formatter={percent}
            unit="percent"
            detail={`${data.conversao.numerador ?? 0} de ${data.conversao.denominador ?? 0} oportunidades encerradas`}
            sampleSize={data.conversao.denominador}
            icon={Percent}
          />
          <MetricBlock
            label="Carteira em movimento"
            value={data.carteira_movimento.valor}
            median={data.carteira_movimento.mediana_pares}
            reliable={data.comparacao.confiavel && (data.carteira_movimento.denominador ?? 0) >= 3}
            formatter={percent}
            unit="percent"
            detail={`${data.carteira_movimento.numerador ?? 0} de ${data.carteira_movimento.denominador ?? 0} empresas atribuídas`}
            sampleSize={data.carteira_movimento.denominador}
            icon={Activity}
          />
        </div>

        <div className="border-t border-black/[.06] bg-black/[.012] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[.11em] text-black/30">Resultados do período</span>
            <Info size={10} className="text-black/20" aria-label="Negociações e inscrições podem chegar à aprovação por caminhos diferentes." />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {resultItems.map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2.5 rounded bg-white px-3 py-2.5">
                <Icon size={13} strokeWidth={1.8} className="text-black/28" />
                <p className="text-[11px] text-black/40"><strong className="mr-1 font-semibold tabular-nums text-black/75">{value}</strong>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded border border-black/[.08] bg-white">
          <div className="flex items-center justify-between border-b border-black/[.06] px-5 py-4">
            <h2 className="text-[13px] font-semibold text-black/75">Atenção necessária</h2>
            {data.alertas.length > 0 && <span className="text-[11px] font-semibold tabular-nums text-black/35">{data.alertas.length}</span>}
          </div>
          {data.alertas.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-7 text-black/35">
              <CheckCircle2 size={16} className="text-[#2E8932]" />
              <p className="text-[12px] font-medium">Nenhum ponto crítico identificado.</p>
            </div>
          ) : (
            <div>
              {data.alertas.map((alert, index) => (
                <Link key={`${alert.tipo}-${alert.id ?? index}-${alert.href}`} href={alert.href} className="group flex items-center gap-3 border-b border-black/[.05] px-5 py-3.5 transition last:border-b-0 hover:bg-black/[.018]">
                  <AlertCircle size={14} className={alert.severidade === "risco" ? "text-[#D94E4E]" : "text-[#B07A14]"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-black/68">{alert.titulo}</p>
                    <p className="mt-0.5 truncate text-[10px] text-black/35">{alert.detalhe}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-black/32 transition group-hover:text-[#7259B5]">{alert.acao}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded border border-black/[.08] bg-white">
          <div className="border-b border-black/[.06] px-5 py-4">
            <h2 className="text-[13px] font-semibold text-black/75">Atividade recente</h2>
          </div>
          {data.atividade_recente.length === 0 ? (
            <div className="px-5 py-7 text-[12px] font-medium text-black/30">Nenhum movimento registrado no período.</div>
          ) : (
            <div>
              {data.atividade_recente.map(event => {
                const content = (
                  <>
                    <Clock3 size={13} className="mt-0.5 shrink-0 text-black/22" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-black/65">{event.titulo}</p>
                      {event.contexto && <p className="mt-0.5 truncate text-[10px] text-black/33">{event.contexto}</p>}
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-black/28">{relativeDate(event.ocorrido_em)}</span>
                  </>
                );
                return event.href ? (
                  <Link key={event.id} href={event.href} className="flex gap-3 border-b border-black/[.05] px-5 py-3.5 transition last:border-b-0 hover:bg-black/[.018]">{content}</Link>
                ) : (
                  <div key={event.id} className="flex gap-3 border-b border-black/[.05] px-5 py-3.5 last:border-b-0">{content}</div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
