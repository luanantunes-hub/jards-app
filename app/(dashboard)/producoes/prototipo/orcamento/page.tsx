"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { Indicador } from "@/components/ui/IndicadoresFinanceiros";
import { Caixa, FaixaDoPrototipo, TituloDeSecao } from "@/components/producao/prototipo/Prototipo";
import { A_RECEBER, ORCAMENTO, TURNE } from "@/lib/producao/prototipo/dados";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

const CENARIOS = [
  { pracas: 6, label: "6 praças (atual)" },
  { pracas: 8, label: "8 praças" },
] as const;

function Valor({ valor, apagado = false }: { valor: number; apagado?: boolean }) {
  return <span title={formatarValorCompleto(valor)} className={`tabular-nums ${valor === 0 || apagado ? "text-black/30" : "text-[#282525]"}`}>{formatarValorCurto(valor)}</span>;
}

/** Protótipo do orçamento vivo (PD5.1 e PD5.2): orçado, comprometido nos acordos e realizado, por categoria e por cenário. */
export default function PrototipoDoOrcamento() {
  const [pracas, setPracas] = useState<number>(6);

  const linhas = useMemo(() => ORCAMENTO.map(linha => ({
    ...linha,
    orcado: linha.porPraca ? Math.round((linha.orcado * pracas) / 6) : linha.orcado,
  })), [pracas]);
  const total = (campo: "orcado" | "comprometido" | "realizado") => linhas.reduce((soma, linha) => soma + linha[campo], 0);

  return (
    <div className="min-h-full">
      <FaixaDoPrototipo href="/producoes/prototipo/orcamento" />
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-7 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Orçamento</h1>
              <p className="mt-1 text-[0.75rem] text-black/45">{TURNE.titulo} · versão 3, aprovada em 20 out</p>
            </div>
            <div role="group" aria-label="Cenário" className="flex gap-1.5">
              {CENARIOS.map(cenario => (
                <button
                  key={cenario.pracas}
                  type="button"
                  onClick={() => setPracas(cenario.pracas)}
                  aria-pressed={pracas === cenario.pracas}
                  className={`h-9 rounded border px-3.5 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${pracas === cenario.pracas ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}
                >
                  {cenario.label}
                </button>
              ))}
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Indicador rotulo="Orçado" valor={total("orcado")} tamanho="lg" />
            <Indicador rotulo="Comprometido" valor={total("comprometido")} tamanho="lg" />
            <Indicador rotulo="Realizado" valor={total("realizado")} tamanho="lg" />
            <Indicador rotulo="A receber dos acordos" valor={Math.round((A_RECEBER * pracas) / 6)} tamanho="lg" />
          </dl>
        </div>
      </header>
      <DetailPageContent>
        <TituloDeSecao acao={
          <span className="flex items-center gap-3 text-[0.6875rem] text-black/45">
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-3 rounded-sm bg-[#282525]" /> Realizado</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-3 rounded-sm bg-[#282525]/30" /> Comprometido</span>
          </span>
        }>Por categoria</TituloDeSecao>
        <Caixa>
          <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,0.7fr))_minmax(0,1.2fr)] gap-4 border-b px-4 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45 md:grid" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <span>Categoria</span><span className="text-right">Orçado</span><span className="text-right">Comprometido</span><span className="text-right">Realizado</span><span className="text-right">Saldo</span><span />
          </div>
          <ul className="divide-y divide-black/[.06]">
            {linhas.map(linha => {
              const usado = Math.max(linha.comprometido, linha.realizado);
              const saldo = linha.orcado - usado;
              const escala = Math.max(linha.orcado, usado) || 1;
              return (
                <li key={linha.categoria} className="px-4 py-3 md:grid md:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,0.7fr))_minmax(0,1.2fr)] md:items-center md:gap-4">
                  <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-[#282525]">
                    {linha.categoria}
                    {saldo < 0 && <AlertTriangle size={12} aria-label="Acima do orçado" className="shrink-0 text-[#D94A4A]" />}
                  </p>
                  <div className="mt-1.5 grid grid-cols-4 gap-2 text-[0.75rem] md:contents">
                    {[["Orçado", linha.orcado], ["Comprometido", linha.comprometido], ["Realizado", linha.realizado]].map(([rotulo, valor]) => (
                      <p key={rotulo} className="md:text-right">
                        <span className="block text-[0.625rem] text-black/40 md:hidden">{rotulo}</span>
                        <Valor valor={valor as number} />
                      </p>
                    ))}
                    <p className="md:text-right">
                      <span className="block text-[0.625rem] text-black/40 md:hidden">Saldo</span>
                      <span title={formatarValorCompleto(saldo)} className={`tabular-nums ${saldo === 0 ? "text-black/30" : "text-[#282525]"}`}>{saldo < 0 ? "−" : ""}{formatarValorCurto(Math.abs(saldo))}</span>
                    </p>
                  </div>
                  <div className="relative mt-2 h-2 overflow-hidden rounded-sm bg-black/[.06] md:mt-0" aria-hidden="true">
                    <div className="absolute inset-y-0 left-0 bg-[#282525]/30" style={{ width: `${Math.min(100, (linha.comprometido / escala) * 100)}%` }} />
                    <div className="absolute inset-y-0 left-0 bg-[#282525]" style={{ width: `${Math.min(100, (linha.realizado / escala) * 100)}%` }} />
                    {usado > linha.orcado && <div className="absolute inset-y-0 w-px bg-white" style={{ left: `${(linha.orcado / escala) * 100}%` }} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </Caixa>
        <p className="mt-3 text-[0.6875rem] text-black/45">O comprometido vem dos acordos e dos pedidos aprovados; o realizado, dos lançamentos com nota. No cenário de 8 praças, só as categorias que dependem das praças mudam.</p>
      </DetailPageContent>
    </div>
  );
}
