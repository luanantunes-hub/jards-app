"use client";

import { useState } from "react";
import { Check, FileText, Plus } from "lucide-react";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { Caixa, Etiqueta, FaixaDoPrototipo, TituloDeSecao } from "@/components/producao/prototipo/Prototipo";
import { ACORDOS, ETAPAS_DO_ACORDO, TURNE, type SituacaoDoAcordo } from "@/lib/producao/prototipo/dados";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

const COR: Record<SituacaoDoAcordo, string> = {
  Rascunho: "#6B6B6B",
  "Em revisão": "#2D72B0",
  "Para assinatura": "#B07A14",
  Assinado: "#2E8932",
  Encerrado: "#6B6B6B",
};

/** Protótipo dos acordos (PD4.5 e PD4.6): os contratos com quem compra ou recebe a data. */
export default function PrototipoDosAcordos() {
  const [escolhido, setEscolhido] = useState(ACORDOS[0].id);
  const acordo = ACORDOS.find(item => item.id === escolhido) ?? ACORDOS[0];
  const etapa = ETAPAS_DO_ACORDO.indexOf(acordo.situacao);

  return (
    <div className="min-h-full">
      <FaixaDoPrototipo href="/producoes/prototipo/acordos" />
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto flex max-w-pagina flex-wrap items-start justify-between gap-4 px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          <div>
            <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Acordos</h1>
            <p className="mt-1 text-[0.75rem] text-black/45">{TURNE.titulo} · {ACORDOS.length} acordos</p>
          </div>
          <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded bg-[#282525] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]"><Plus size={13} aria-hidden="true" /> Novo acordo</button>
        </div>
      </header>
      <DetailPageContent>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <section>
            <TituloDeSecao>Da turnê</TituloDeSecao>
            <Caixa>
              <ul className="divide-y divide-black/[.06]">
                {ACORDOS.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setEscolhido(item.id)}
                      aria-current={item.id === escolhido ? "true" : undefined}
                      className={`w-full px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-[#7259B5] ${item.id === escolhido ? "bg-black/[.04]" : "hover:bg-black/[.02]"}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-[0.8125rem] font-medium leading-snug text-[#282525]">{item.contraparte}</span>
                        <Etiqueta cor={COR[item.situacao]}>{item.situacao}</Etiqueta>
                      </span>
                      <span className="mt-1 block text-[0.6875rem] text-black/45">{item.datas} · {item.resumo}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Caixa>
          </section>

          <section aria-label={`Acordo com ${acordo.contraparte}`} className="min-w-0 space-y-6">
            <div>
              <h2 className="text-[1.125rem] font-semibold tracking-[-.01em] text-[#282525] [text-wrap:balance]">{acordo.contraparte}</h2>
              <p className="mt-0.5 text-[0.75rem] text-black/45">{acordo.tipo} · {acordo.datas}</p>
              <ol className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Situação do acordo">
                {ETAPAS_DO_ACORDO.map((nome, indice) => (
                  <li key={nome} className="flex items-center gap-1">
                    <span className={`inline-flex h-7 items-center gap-1 rounded px-2.5 text-[0.6875rem] font-medium ${indice === etapa ? "bg-[#282525] text-white" : indice < etapa ? "text-[#282525]" : "text-black/35"}`} aria-current={indice === etapa ? "step" : undefined}>
                      {indice < etapa && <Check size={11} aria-hidden="true" />}{nome}
                    </span>
                    {indice < ETAPAS_DO_ACORDO.length - 1 && <span aria-hidden="true" className="text-black/20">›</span>}
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <TituloDeSecao>Condições</TituloDeSecao>
              <Caixa>
                <dl className="divide-y divide-black/[.06]">
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-[0.6875rem] font-medium text-black/45">Garantia</dt>
                    <dd className={`text-[0.8125rem] tabular-nums ${acordo.garantia ? "font-semibold text-[#282525]" : "text-black/30"}`} title={formatarValorCompleto(acordo.garantia)}>{acordo.garantia ? formatarValorCurto(acordo.garantia) : "Sem garantia"}</dd>
                  </div>
                  {[["Bilheteria", acordo.percentual], ["Bônus", acordo.bonus], ["Retenções", acordo.retencoes]].map(([rotulo, valor]) => (
                    <div key={rotulo} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                      <dt className="text-[0.6875rem] font-medium text-black/45">{rotulo}</dt>
                      <dd className="text-[0.8125rem] text-[#282525]">{valor}</dd>
                    </div>
                  ))}
                </dl>
              </Caixa>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <TituloDeSecao>Quem paga cada despesa</TituloDeSecao>
                <Caixa>
                  <ul className="divide-y divide-black/[.06]">
                    {acordo.despesas.map(despesa => (
                      <li key={despesa.item} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[0.75rem]">
                        <span className="text-[#282525]">{despesa.item}</span>
                        <span className="text-black/55">{despesa.quem}</span>
                      </li>
                    ))}
                  </ul>
                </Caixa>
              </div>
              <div>
                <TituloDeSecao>Assinaturas</TituloDeSecao>
                <Caixa>
                  {acordo.signatarios.length === 0 ? (
                    <p className="px-4 py-3 text-[0.75rem] text-black/45">Quando o acordo for para assinatura, cada signatário recebe o link do provedor de assinatura.</p>
                  ) : (
                    <ul className="divide-y divide-black/[.06]">
                      {acordo.signatarios.map(pessoa => (
                        <li key={pessoa.nome} className="px-4 py-2.5">
                          <p className="text-[0.75rem] font-medium text-[#282525]">{pessoa.nome} <span className="font-normal text-black/45">· {pessoa.papel}</span></p>
                          <p className="text-[0.6875rem] text-black/50">{pessoa.estado}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Caixa>
              </div>
            </div>

            {acordo.arquivo && (
              <p className="flex items-center gap-1.5 text-[0.75rem] text-black/55"><FileText size={13} aria-hidden="true" className="text-black/40" /> {acordo.arquivo}</p>
            )}
          </section>
        </div>
      </DetailPageContent>
    </div>
  );
}
