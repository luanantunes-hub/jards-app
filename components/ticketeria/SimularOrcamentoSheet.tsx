"use client";

import { useMemo, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { CAMPO, ROTULO } from "@/components/ticketeria/FolhasDosEventos";
import { emCentavos, lerValorEmReais } from "@/lib/producao/dinheiro";
import { rotuloDoCanalDeGasto } from "@/lib/ticketeria/modelo";
import { canaisComCurva, dividirOrcamento, orcamentoMaximo, preverDivisao } from "@/lib/ticketeria/modelo-recomendacao";
import type { CanalDoResultado } from "@/lib/ticketeria/modelo-resultado";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";

// A folha "Simular orçamento" da aba Modelo: o produtor diz quanto quer gastar por semana em anúncios, o modelo sugere como dividir entre os canais e mostra o que esperar, ao lado de hoje.
// É uma PREVISÃO a partir da curva de resposta de cada canal (lib/ticketeria/modelo-recomendacao.ts), não uma garantia. Só desenho: os dados chegam por props.

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "px-4 py-2.5 text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-2.5 text-[0.8125rem] text-[#282525]";
const inteiro = (n: number) => String(Math.round(n));
const reaisParaCampo = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",").replace(/,00$/, "");

export function SimularOrcamentoSheet({ canais, gastoSemanal, onClose, valorInicial }: { canais: CanalDoResultado[]; gastoSemanal: Record<string, number>; onClose: () => void; valorInicial?: string }) {
  const comCurva = useMemo(() => canaisComCurva(canais).filter(c => (gastoSemanal[c.canal] ?? 0) > 0), [canais, gastoSemanal]);
  const hojePorCanal = useMemo(() => Object.fromEntries(comCurva.map(c => [c.canal, gastoSemanal[c.canal] ?? 0])), [comCurva, gastoSemanal]);
  const totalHoje = Object.values(hojePorCanal).reduce((s, n) => s + n, 0);
  const [texto, setTexto] = useState(valorInicial ?? reaisParaCampo(Math.round(totalHoje / 500) * 500));
  const reais = lerValorEmReais(texto);
  const total = reais === null ? null : emCentavos(reais);
  const sugerida = useMemo(() => (total === null ? null : dividirOrcamento(comCurva, total)), [comCurva, total]);
  const hoje = useMemo(() => preverDivisao(comCurva, hojePorCanal), [comCurva, hojePorCanal]);
  const nova = useMemo(() => (sugerida ? preverDivisao(comCurva, sugerida.porCanal) : null), [comCurva, sugerida]);
  const maximo = orcamentoMaximo(comCurva);
  const diferenca = sugerida ? sugerida.totalCentavos - totalHoje : 0;
  const ganho = nova ? Math.round(nova.ingressos) - Math.round(hoje.ingressos) : 0;

  return (
    <TopSheet titulo="Simular orçamento" onClose={onClose} largura="40rem" footer={fechar => <button type="button" onClick={fechar} className="rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Fechar</button>}>
      <div className="space-y-4">
        <p className="text-[0.8125rem] text-black/55">Quanto você quer gastar por semana em anúncios? O modelo sugere como dividir entre os canais e mostra o que esperar. É uma previsão, não uma garantia.</p>
        <div>
          <label className={ROTULO} htmlFor="so-total">Gasto por semana (todos os canais, em reais)</label>
          <input id="so-total" inputMode="decimal" className={`${CAMPO} max-w-[12rem]`} value={texto} onChange={e => setTexto(e.target.value)} placeholder="250" />
          <p className="mt-1.5 text-[0.75rem] text-black/45">Em geral você gasta {formatarMoeda(totalHoje)} por semana ({comCurva.map(c => `${rotuloDoCanalDeGasto(c.canal)} ${formatarMoeda(hojePorCanal[c.canal])}`).join(" e ")}).</p>
          {reais === null && <p role="alert" className="mt-1.5 text-[0.75rem] text-[#B23B3B]">Digite um valor em reais, como 250 ou 250,50.</p>}
        </div>
        {sugerida && nova && (
          <>
            <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDA }}>
              <table className="w-full border-collapse">
                <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={`${CABECALHO} text-left`}><span className="sr-only">Canal</span></th><th className={`${CABECALHO} text-right`}>Hoje</th><th className={`${CABECALHO} text-right`}>Dividindo como sugerido</th></tr></thead>
                <tbody className="divide-y divide-black/[.08]">
                  {comCurva.map(c => <tr key={c.canal}><td className={CELULA}>{rotuloDoCanalDeGasto(c.canal)}</td><td className={`${CELULA} text-right tabular-nums`}>{formatarMoeda(hojePorCanal[c.canal])}</td><td className={`${CELULA} text-right tabular-nums`}>{formatarMoeda(sugerida.porCanal[c.canal] ?? 0)}</td></tr>)}
                  <tr><td className={CELULA}>Ingressos esperados por semana, pelos anúncios</td><td className={`${CELULA} text-right tabular-nums`}>{inteiro(hoje.ingressos)}</td><td className={`${CELULA} text-right tabular-nums`}>{inteiro(nova.ingressos)} <span className="text-black/35">entre {nova.baixo} e {nova.alto}</span></td></tr>
                  <tr><td className={CELULA}>Custo por ingresso</td><td className={`${CELULA} text-right tabular-nums`}>{hoje.custoPorIngressoCentavos === null ? "—" : formatarMoeda(hoje.custoPorIngressoCentavos)}</td><td className={`${CELULA} text-right tabular-nums`}>{nova.custoPorIngressoCentavos === null ? "—" : formatarMoeda(nova.custoPorIngressoCentavos)}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[0.75rem] leading-relaxed text-black/50">
              {diferenca > 0 ? `Sobre os ${formatarMoeda(diferenca)} a mais por semana, o modelo espera ${ganho >= 0 ? `${ganho} ${ganho === 1 ? "ingresso" : "ingressos"} a mais` : "menos ingressos"}.`
                : diferenca < 0 ? `Com ${formatarMoeda(-diferenca)} a menos por semana, o modelo espera ${ganho <= 0 ? `${-ganho} ${ganho === -1 ? "ingresso" : "ingressos"} a menos` : "mais ingressos"}.`
                : `Com o mesmo gasto de hoje dividido de outro jeito, o modelo espera ${ganho >= 0 ? `${ganho} a mais` : `${-ganho} a menos`}.`}
              {nova.foraDaFaixa.length > 0 && ` ${nova.foraDaFaixa.map(rotuloDoCanalDeGasto).join(" e ")} passa${nova.foraDaFaixa.length > 1 ? "m" : ""} do que você já testou: por isso a margem é larga. Experimente subir devagar e conferir.`}
              {total !== null && total > maximo && ` A curva cobre até ${formatarMoeda(maximo)} por semana; acima disso o modelo não sabe prever, e o que passa não foi dividido.`}
            </p>
          </>
        )}
        {comCurva.length === 0 && <p className="text-[0.8125rem] text-black/45">Ainda não há canal com anúncio e curva para simular.</p>}
      </div>
    </TopSheet>
  );
}
