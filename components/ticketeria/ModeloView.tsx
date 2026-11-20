"use client";

import { Check } from "lucide-react";
import { SEMANAS_IDEAIS, rotuloDoCanalDeGasto, type Confianca, type ProntidaoDoModelo, type Verificacao } from "@/lib/ticketeria/modelo";
import type { ResultadoParaATela } from "@/lib/ticketeria/modelo-servidor";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";

// A aba Modelo da Divulgação (fatia M-A): se já há dado para o modelo de marketing rodar, e o que falta. Ainda não há o cálculo do modelo (é a fatia seguinte). Só desenho: os dados
// e as ações chegam por props. Segue o DESIGN.md da Ticketeria: rótulos pequenos, cantos de 12px, cor só de estado.

const BORDA = "rgba(13,13,13,.08)";
const VERDE = "#2E8932";
const AMBAR = "#B07A14";
const LINK = "rounded-xl text-[0.75rem] text-[#7259B5] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const ROTULO_CONFIANCA: Record<Confianca, string> = { baixa: "baixa", media: "média", boa: "boa" };

function Marca({ estado }: { estado: Verificacao["estado"] }) {
  if (estado === "ok") return <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: VERDE }} aria-label="Pronto"><Check size={12} aria-hidden="true" /></span>;
  if (estado === "atencao") return <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] text-white" style={{ background: AMBAR }} aria-label="Falta um pouco">!</span>;
  return <span className="mt-0.5 size-5 shrink-0 rounded-full border-[1.5px]" style={{ borderColor: "rgba(13,13,13,.25)" }} aria-label={estado === "falta" ? "Falta" : "Opcional"} />;
}

/** A checklist de prontidão: o aviso (pronto ou não, com o progresso) e cada verificação, com o botão que leva ao que resolve. */
export function ModeloDaLoja({ prontidao, onImportar, onConexoes }: { prontidao: ProntidaoDoModelo; onImportar?: () => void; onConexoes?: () => void }) {
  const { pronto, prontos, total, confianca, semanas, verificacoes, ignoradas } = prontidao;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border px-4 py-3.5" style={{ borderColor: "rgba(176,122,20,.25)", background: "#FFFBF2" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {pronto ? (
            <p className="max-w-3xl text-[0.8125rem] text-black/60"><span className="text-[#282525]">Os dados estão prontos.</span> Com eles o modelo teria confiança {confianca ? ROTULO_CONFIANCA[confianca] : "baixa"} ({semanas} {semanas === 1 ? "semana" : "semanas"} com vendas e gasto; o ideal são {SEMANAS_IDEAIS}). O cálculo do modelo chega na próxima etapa.</p>
          ) : (
            <p className="max-w-3xl text-[0.8125rem] text-black/60"><span className="text-[#282525]">O modelo ainda não pode rodar.</span> Faltam dados em {total - prontos === 1 ? "uma coisa" : `${total - prontos === 2 ? "duas" : "três"} coisas`}. Quando estiver tudo certo, ele roda sozinho toda segunda-feira.</p>
          )}
          <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: pronto ? `${VERDE}47` : "rgba(176,122,20,.28)", color: pronto ? VERDE : AMBAR }}>{prontos} de {total} prontos</span>
        </div>
      </div>
      <div className="divide-y divide-black/[.08] rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        {verificacoes.map(v => (
          <div key={v.id} className="flex items-start gap-3.5 px-4 py-4">
            <Marca estado={v.estado} />
            <div className="min-w-0">
              <p className="text-[0.8125rem] text-[#282525]">{v.titulo}</p>
              <p className="mt-1 max-w-3xl text-[0.75rem] leading-relaxed text-black/45">{v.detalhe}</p>
              {v.acao === "importar" && <button type="button" onClick={onImportar} className={`mt-1.5 ${LINK}`}>{v.id === "gasto" ? "Importar gastos antigos" : "Importar planilha"}</button>}
              {v.acao === "conexoes" && <button type="button" onClick={onConexoes} className={`mt-1.5 ${LINK}`}>Ir para Conexões</button>}
            </div>
          </div>
        ))}
      </div>
      {ignoradas.length > 0 && <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">Para não contar o mesmo gasto duas vezes, ficou de fora o gasto {ignoradas.length === 1 ? "da ação" : "das ações"} <span className="text-black/65">{ignoradas.join(", ")}</span>: o gasto de anúncios já vem das conexões.</p>}
    </div>
  );
}

// ─── O resultado do modelo (M-B) ────────────────────────────────────────────

const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const dataBr = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const pontos = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
const margem = (baixo: number, alto: number, meio: number) => Math.round(Math.max(meio - baixo, alto - meio));

/** O que o modelo estimou: o selo de confiança, a tabela canal a canal com o modelo ao lado dos links e, para cada canal, o gasto semanal a partir do qual rende pouco. */
export function ResultadoDoModelo({ resultado }: { resultado: ResultadoParaATela }) {
  const { execucao: e, comparacao, canais, ultimaFalha } = resultado;
  const parte = Math.min(100, Math.round((e.semanas / SEMANAS_IDEAIS) * 100));
  const saturacoes = canais.filter(c => c.saturacao_gasto_centavos !== null && c.gasto_centavos > 0);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border px-4 py-3.5" style={{ borderColor: "rgba(176,122,20,.25)", background: "#FFFBF2" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-3xl text-[0.8125rem] text-black/60"><span className="text-[#282525]">Confiança {ROTULO_CONFIANCA[e.confianca]}.</span> {e.semanas} semanas de histórico (o ideal são {SEMANAS_IDEAIS}). Última leitura do modelo: {dataBr(e.created_at)}.</p>
          <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: "rgba(176,122,20,.28)", color: AMBAR }}>{e.semanas} de {SEMANAS_IDEAIS} semanas</span>
        </div>
        <div className="mt-2.5 h-2 rounded bg-[#F1E6C8]" aria-hidden="true"><div className="h-2 rounded" style={{ width: `${parte}%`, background: AMBAR }} /></div>
        {e.confianca === "baixa" && (e.r_hat_maximo > 1.05 || e.divergencias > 0) && <p className="mt-2 text-[0.75rem] text-black/50">O cálculo ainda não se firmou direito com estes dados: leia os números como indício.</p>}
      </div>
      {ultimaFalha && <p role="alert" className="rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-black/55" style={{ borderColor: "rgba(176,122,20,.25)" }}>A rodada de {dataBr(ultimaFalha.created_at)} não deu: {ultimaFalha.motivo} Esta tela mostra a anterior.</p>}
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <table className="w-full min-w-[46rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Canal</th><th className={`${CABECALHO} text-right`}>Gasto</th><th className={`${CABECALHO} text-right`}>Ingressos, segundo o modelo</th><th className={`${CABECALHO} text-right`}>Ingressos, segundo os links</th><th className={`${CABECALHO} text-right`}>Custo por ingresso</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            <tr>
              <td className={CELULA}>Venderia de qualquer jeito</td><td className={`${CELULA} text-right text-black/30`}>—</td>
              <td className={`${CELULA} text-right tabular-nums`}>{pontos(e.base.porcento)}% <span className="text-black/35">±{margem(e.base.baixo, e.base.alto, e.base.porcento)}</span></td>
              <td className={`${CELULA} text-right text-black/30`}>—</td><td className={`${CELULA} text-right text-black/30`}>—</td>
            </tr>
            {comparacao.linhas.map(l => (
              <tr key={l.canal}>
                <td className={CELULA}>{rotuloDoCanalDeGasto(l.canal)}{l.gastoConstante && <span className="ml-2 inline-flex rounded-xl border px-2 py-0.5 text-[0.625rem] text-black/50" style={{ borderColor: BORDA }}>gasto quase constante</span>}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{l.gastoCentavos > 0 ? formatarMoeda(l.gastoCentavos) : "—"}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{pontos(l.modelo)}% <span className="text-black/35">±{margem(l.baixo, l.alto, l.modelo)}</span></td>
                <td className={`${CELULA} text-right tabular-nums`}>{l.links === null ? <span className="text-black/30">—</span> : `${l.links}%`}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{l.custoPorIngressoCentavos === null ? <span className="text-black/30">—</span> : formatarMoeda(l.custoPorIngressoCentavos)}{l.margemGrande && <span className="ml-2 inline-flex rounded-xl border px-2 py-0.5 text-[0.625rem] text-black/50" style={{ borderColor: BORDA }}>margem grande</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comparacao.anuncios && <p className="text-[0.75rem] text-black/50">Anúncios pagos (Meta e Google juntos, porque os links só dizem “anúncio pago”): modelo {comparacao.anuncios.modelo}%{comparacao.anuncios.links !== null ? ` · links ${comparacao.anuncios.links}%` : ""}.</p>}
      {saturacoes.length > 0 && (
        <ul className="space-y-1 text-[0.75rem] text-black/50">
          {saturacoes.map(c => <li key={c.canal}>{rotuloDoCanalDeGasto(c.canal)}: acima de {formatarMoeda(c.saturacao_gasto_centavos as number)} por semana, cada real a mais rende pouco.</li>)}
        </ul>
      )}
      <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">Os links só contam quem clicou e comprou. O modelo também enxerga quem viu o anúncio e comprou depois por outro caminho. Quando os dois números se parecem, a leitura é mais segura; quando diferem muito, desconfie do modelo até ter mais semanas. É uma estimativa, não uma prova: o ± é o quanto o próprio modelo acha que ainda pode errar, e costuma ser otimista.</p>
    </div>
  );
}
