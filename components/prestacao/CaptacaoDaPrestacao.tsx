"use client";

// Captação diante da liberação da execução (P9.1): captado, valor a captar,
// a barra e a situação pelas faixas do regime (na saúde, 60%, 100% e 120% do
// aprovado), com o prazo da readequação contado do fim da captação.

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { BarraCaptacao, Indicador } from "@/components/ui/IndicadoresFinanceiros";
import { percentualDaCaptacao, textoDaCaptacao, type SituacaoDaCaptacao } from "@/lib/prestacao/captacao";

const PEDEM_ATENCAO = new Set(["abaixo_do_minimo", "readequacao_para_menor", "acrescimo", "excedente"]);
const PEDEM_READEQUACAO = new Set(["readequacao_para_menor", "acrescimo", "excedente"]);

export function CaptacaoDaPrestacao({ situacao, prestacaoId, fimDaCaptacao, podeEditar }: {
  situacao: SituacaoDaCaptacao;
  prestacaoId: string;
  fimDaCaptacao: string | null;
  podeEditar: boolean;
}) {
  const s = situacao;
  const atencao = PEDEM_ATENCAO.has(s.faixa);
  const readequar = PEDEM_READEQUACAO.has(s.faixa) && !s.readequada && !s.readequacaoPedida;
  const semFim = readequar && !fimDaCaptacao && s.regra.prazoDaReadequacao;
  return (
    <section className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }} aria-labelledby="captacao-titulo">
      <div className="space-y-3 px-5 py-4">
        <h2 id="captacao-titulo" className="text-[0.6875rem] font-semibold text-black/50">Captação</h2>
        <dl className="grid grid-cols-3 gap-4">
          <Indicador rotulo="Captado" valor={s.captado / 100} tamanho="sm" />
          <Indicador rotulo={s.readequada ? "Readequado" : "Aprovado"} valor={s.aCaptar / 100} tamanho="sm" />
          <Indicador rotulo="Percentual" valor={s.captado} texto={s.captado ? percentualDaCaptacao(s.percentual) : "—"} tamanho="sm" />
        </dl>
        <BarraCaptacao confirmado={s.captado} meta={s.aCaptar} className="h-1.5" />
        <p className="flex items-start gap-1.5 text-[0.6875rem] leading-4 text-black/60">
          {atencao && <AlertTriangle size={12} strokeWidth={1.75} aria-label="Atenção" className="mt-0.5 shrink-0 text-[#B07A14]" />}
          <span>
            {textoDaCaptacao(s)}
            {semFim && " Informe o fim da captação nos marcos para contar o prazo."}
            {readequar && podeEditar && (
              <>
                {" "}
                <Link href={`/prestacoes/${prestacaoId}/orcamento`} className="rounded text-black/75 underline decoration-black/20 underline-offset-2 hover:text-black focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  Pedir em Orçamento
                </Link>
              </>
            )}
          </span>
        </p>
        <p className="text-[0.625rem] text-black/35">O captado são os aportes do extrato da conta de captação.</p>
      </div>
    </section>
  );
}
