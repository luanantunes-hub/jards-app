"use client";

import { MIN_INGRESSOS_DO_CUSTO, acaoDoExperimento, custoMedidoPorCanal, sugerirExperimento, variacaoDosCanais } from "@/lib/ticketeria/modelo-plano-b";
import type { AcaoComResultado, CamposDaAcao } from "@/lib/ticketeria/divulgacao";
import type { ResumoDoCanal } from "@/lib/ticketeria/modelo";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";

// O plano B da aba Modelo para quem tem pouco histórico: o custo por ingresso que já dá para medir e um experimento PEQUENO e SEGURO para o produtor descobrir onde o dinheiro rende mais. O
// experimento é do produtor, não do nosso modelo: mesmo total gasto, nada pausado, fora das semanas de sessão, e ele decide. Só desenho: os dados e as ações chegam por props.

const BORDA = "rgba(13,13,13,.08)";
const AMBAR = "#B07A14";
const VERDE = "#2E8932";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const TITULO = "text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45";
const diaMes = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const comDiaDaSemana = (iso: string) => `${DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()]} (${diaMes(iso)})`;

/** O custo por ingresso medido pelas ações (só conta quem clicou no link e comprou). Sem ação registrada, não desenha nada. */
export function CustoMedido({ acoes }: { acoes: AcaoComResultado[] }) {
  const linhas = custoMedidoPorCanal(acoes);
  if (linhas.length === 0) return null;
  return (
    <section className="space-y-2.5" aria-label="O que já dá para medir">
      <h3 className={TITULO}>O que já dá para medir: custo por ingresso</h3>
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <table className="w-full min-w-[34rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Canal</th><th className={`${CABECALHO} text-right`}>Gasto nas ações</th><th className={`${CABECALHO} text-right`}>Ingressos medidos</th><th className={`${CABECALHO} text-right`}>Custo por ingresso</th><th className={`${CABECALHO} text-right`}>Ações</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {linhas.map(l => (
              <tr key={l.canal}>
                <td className={CELULA}>{l.rotulo}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{formatarMoeda(l.gastoCentavos)}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{l.ingressos}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{l.custoPorIngressoCentavos === null ? <span className="text-black/30">—</span> : formatarMoeda(l.custoPorIngressoCentavos)}{l.poucoDado && l.custoPorIngressoCentavos !== null && <span className="ml-2 inline-flex rounded-xl border px-2 py-0.5 text-[0.625rem] text-black/50" style={{ borderColor: BORDA }}>poucos ingressos</span>}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{l.acoes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">É medido, não previsto: conta só quem clicou no link de divulgação e comprou. Canal sem gasto não tem custo por ingresso. Com menos de {MIN_INGRESSOS_DO_CUSTO} ingressos medidos, o número ainda diz pouco.</p>
    </section>
  );
}

/** O experimento sugerido (ou o motivo de não haver) e o quanto o gasto de cada canal varia. */
export function ExperimentoPequeno({ canais, hoje, proximaSessao, onRegistrar }: { canais: ResumoDoCanal[]; hoje: string; proximaSessao: string | null; onRegistrar?: (campos: CamposDaAcao) => void }) {
  const situacao = sugerirExperimento(canais, hoje, proximaSessao);
  const variacao = variacaoDosCanais(canais);
  return (
    <section className="space-y-2.5" aria-label="Um experimento pequeno">
      <h3 className={TITULO}>Para descobrir onde rende mais</h3>
      {situacao.tipo === "sugerido" && (
        <div className="rounded-xl border px-5 py-4" style={{ borderColor: "rgba(114,89,181,.28)", background: "#FAF8FE" }}>
          <p className="text-[0.875rem] text-[#282525]">Um experimento pequeno: mova {formatarMoeda(situacao.experimento.valorCentavos)} por semana do {situacao.experimento.de.rotulo} para o {situacao.experimento.para.rotulo}, por {situacao.experimento.semanas} semanas.</p>
          <p className="mt-1.5 max-w-3xl text-[0.75rem] leading-relaxed text-black/50">O total que você gasta não muda. Hoje o gasto dos dois quase não varia, então não dá para saber qual rende mais por real. Mexendo um pouco, você compara o custo por ingresso dos dois e fica com a divisão que rendeu mais.</p>
          <p className="mt-1.5 text-[0.75rem] text-black/50">De {comDiaDaSemana(situacao.experimento.inicio)} a {comDiaDaSemana(situacao.experimento.fim)}.</p>
          <p className="mt-1.5 max-w-3xl text-[0.75rem] leading-relaxed text-black/50"><span style={{ color: VERDE }}>Seguro:</span> é pouco dinheiro, o total é o mesmo, não pausa nada e fica fora das semanas de sessão. Você decide se faz.</p>
          <button type="button" onClick={() => onRegistrar?.(acaoDoExperimento(situacao.experimento))} className="mt-3 rounded-xl border bg-white px-3.5 py-2 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" style={{ borderColor: BORDA }}>Registrar como ação</button>
        </div>
      )}
      {situacao.tipo === "esperar_sessao" && <p className="rounded-xl border bg-white px-4 py-3 text-[0.8125rem] text-black/60" style={{ borderColor: BORDA }}>Melhor esperar: há uma sessão em {diaMes(situacao.sessao)}. Experimento só em período tranquilo, para não arriscar as suas vendas.</p>}
      {situacao.tipo === "poucos_canais" && <p className="rounded-xl border bg-white px-4 py-3 text-[0.8125rem] text-black/60" style={{ borderColor: BORDA }}>Quando você tiver gasto em dois canais por pelo menos 8 semanas, o Jards sugere um experimento pequeno para comparar os dois.</p>}
      {situacao.tipo === "nao_precisa" && <p className="rounded-xl border bg-white px-4 py-3 text-[0.8125rem] text-black/60" style={{ borderColor: BORDA }}>O gasto dos seus canais já varia o bastante. Não há nada a ajustar.</p>}
      {variacao.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
          <table className="w-full min-w-[32rem] border-collapse">
            <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Canal</th><th className={`${CABECALHO} text-right`}>Gasto por semana</th><th className={CABECALHO}>O quanto o gasto varia</th><th className={CABECALHO}><span className="sr-only">Situação</span></th></tr></thead>
            <tbody className="divide-y divide-black/[.08]">
              {variacao.map(l => (
                <tr key={l.canal}>
                  <td className={CELULA}>{l.rotulo}</td>
                  <td className={`${CELULA} text-right tabular-nums`}>{formatarMoeda(l.medianaCentavos)}</td>
                  <td className="px-4 py-3"><div className="relative h-2 w-40 rounded bg-[#EFECF6]" role="img" aria-label={l.suficiente ? "varia o bastante" : "varia pouco"}><div className="h-2 rounded" style={{ width: `${Math.max(4, Math.round(l.nivel * 100))}%`, background: l.suficiente ? VERDE : AMBAR }} /><span className="absolute -top-[3px] -bottom-[3px] left-1/2 w-0.5 bg-black/45" /></div></td>
                  <td className="px-4 py-3"><span className="inline-flex rounded-xl border bg-white px-2 py-0.5 text-[0.625rem]" style={l.suficiente ? { borderColor: `${VERDE}4D`, color: VERDE } : { borderColor: "rgba(176,122,20,.3)", color: AMBAR }}>{l.suficiente ? "varia o bastante" : "varia pouco"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {variacao.length > 0 && <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">O traço é o mínimo para comparar dois canais com segurança. Experimentar é sempre opcional: a sua venda vem primeiro.</p>}
    </section>
  );
}

/** O plano B inteiro: o custo medido e o experimento pequeno. */
export function PlanoBDoModelo({ acoes, canais, hoje, proximaSessao, onRegistrar }: { acoes: AcaoComResultado[]; canais: ResumoDoCanal[]; hoje: string; proximaSessao: string | null; onRegistrar?: (campos: CamposDaAcao) => void }) {
  return (
    <div className="space-y-5">
      <CustoMedido acoes={acoes} />
      <ExperimentoPequeno canais={canais} hoje={hoje} proximaSessao={proximaSessao} onRegistrar={onRegistrar} />
    </div>
  );
}
