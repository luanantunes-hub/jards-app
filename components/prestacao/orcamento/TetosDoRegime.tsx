"use client";

import { AlertTriangle, Check, Tag } from "lucide-react";
import type { BasesDoOrcamento, TetoDoGrupo } from "@/lib/prestacao/orcamento";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/**
 * Quanto cada grupo de custo pesa no orçamento vigente e, quando o regime
 * fixa, o teto (percentual sobre o total e teto em reais). O estado vem em
 * texto e ícone, não só na cor.
 */
const NOME_DA_BASE: Record<string, string> = {
  valor_projeto: "valor do projeto",
  valor_total_projeto: "valor total",
  valor_aprovado_execucao: "aprovado para execução",
  valor_atividade_fim: "atividade-fim",
  orcamento_producao: "orçamento de produção",
};

export function TetosDoRegime({ tetos, regimeNome, bases }: { tetos: TetoDoGrupo[]; regimeNome: string | null; bases: BasesDoOrcamento }) {
  if (tetos.length === 0) return null;
  const semGrupo = tetos.find(t => t.grupo === null);
  const comGrupo = tetos.filter(t => t.grupo !== null);
  // As bases que o regime define e que diferem do total, para mostrar sobre o que os tetos incidem.
  const basesDoRegime = Object.entries(bases.porBase)
    .filter(([chave, valor]) => chave !== "valor_total_projeto" && valor !== undefined && valor !== bases.valorTotalProjeto)
    .map(([chave, valor]) => `${NOME_DA_BASE[chave] ?? chave} ${fmt(valor as number)}`);

  return (
    <section aria-labelledby="tetos-titulo" className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <h2 id="tetos-titulo" className="text-[0.75rem] font-semibold text-[#0D0D0D]">Grupos de custo e tetos</h2>
        <p className="text-[0.625rem] text-black/40">
          {regimeNome
            ? basesDoRegime.length
              ? `Limites de ${regimeNome} · ${basesDoRegime.join(", ")}, valor total ${fmt(bases.valorTotalProjeto)}`
              : `Limites de ${regimeNome}, sobre o vigente`
            : "Escolha o regime na visão geral para conferir os tetos"}
        </p>
      </div>

      <ul className="divide-y divide-black/[.06]">
        {comGrupo.map(teto => {
          const maximo = teto.limite?.maximo ?? null;
          const largura = maximo && maximo > 0 && teto.limite ? Math.min(100, (teto.limite.valorLimitado / maximo) * 100) : null;
          const cor = teto.excedido ? "#D94A4A" : "#2E8932";
          return (
            <li key={teto.grupo} className="grid grid-cols-1 gap-2 px-5 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
              <div className="min-w-0">
                <p className="truncate text-[0.75rem] font-medium text-black/75">{teto.rotulo}</p>
                <p className="text-[0.625rem] text-black/40">{teto.itens} {teto.itens === 1 ? "item" : "itens"}</p>
              </div>

              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3 text-[0.6875rem] tabular-nums">
                  <span className="font-medium text-black/70">{fmt(teto.valor)}</span>
                  <span className="text-black/40">{teto.percentual !== null ? `${pct(teto.percentual)} do orçamento` : "—"}</span>
                </div>
                {teto.limite && largura !== null && (
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[.06]"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(largura)}
                    aria-label={`${teto.rotulo}: ${Math.round(largura)}% do teto`}
                  >
                    <div className="h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${largura}%`, background: cor }} />
                  </div>
                )}
                {teto.limite && (
                  <p className="mt-1 text-[0.625rem] leading-4 text-black/40" title={teto.limite.norma}>
                    Até {pct(teto.limite.percentual)} {teto.limite.base}{teto.limite.teto ? ` e ${fmt(teto.limite.teto)}` : ""}
                    {teto.limite.maximo !== null ? `: no máximo ${fmt(teto.limite.maximo)}` : ""}
                    {teto.limite.proporcionalAoCaptado ? ", pago na proporção do captado" : ""}
                    {teto.limite.valorLimitado !== teto.valor ? ` (somado a outros grupos: ${fmt(teto.limite.valorLimitado)})` : ""}
                    {" · "}{teto.limite.norma}
                  </p>
                )}
              </div>

              <div className="text-[0.6875rem] sm:text-right">
                {teto.limite ? (
                  teto.limite.maximo === null ? (
                    <span className="text-black/45">Depende {teto.limite.base}</span>
                  ) : teto.excedido ? (
                    <span className="inline-flex items-center gap-1 font-medium tabular-nums text-black/70">
                      <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className={`shrink-0 ${teto.limite.severidade === "bloqueio" ? "text-[#D94A4A]" : "text-[#B07A14]"}`} />
                      <span>Acima do teto em {fmt(teto.limite.valorLimitado - teto.limite.maximo)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-black/55">
                      <Check size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-black/40" />
                      Dentro do teto
                    </span>
                  )
                ) : (
                  <span className="text-black/35">Sem teto no regime</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {semGrupo && (
        <p className="flex items-start gap-2 border-t px-5 py-3 text-[0.6875rem] leading-4 text-black/55" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <Tag size={12} className="mt-0.5 shrink-0 text-[#B07A14]" aria-hidden />
          <span>
            {semGrupo.itens} {semGrupo.itens === 1 ? "item" : "itens"} sem grupo de custo ({fmt(semGrupo.valor)}
            {semGrupo.percentual !== null ? `, ${pct(semGrupo.percentual)} do orçamento` : ""}). Classifique-os para os tetos ficarem completos: edite o item ou o agrupador acima dele.
          </span>
        </p>
      )}
    </section>
  );
}
