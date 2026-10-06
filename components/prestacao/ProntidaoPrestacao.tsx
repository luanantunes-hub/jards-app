"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import type { Checagem, DestinoPendencia, Prontidao } from "@/lib/prestacao/prontidao";

function destino(prestacaoId: string, para: DestinoPendencia, codigo: string): string {
  switch (para) {
    case "orcamento": return `/prestacoes/${prestacaoId}/orcamento`;
    case "comprovantes": return `/prestacoes/${prestacaoId}/comprovantes`;
    case "atividades": return `/prestacoes/${prestacaoId}/atividades`;
    case "pendencias": return `/prestacoes/${prestacaoId}/pendencias`;
    case "visao_geral": return codigo === "prazo" ? "#prazo" : "#dados-oficiais";
  }
}

function cor(percentual: number): string {
  return percentual >= 80 ? "#2E8932" : percentual >= 50 ? "#B07A14" : "#7259B5";
}

function Linha({ checagem, prestacaoId }: { checagem: Checagem; prestacaoId: string }) {
  const ok = checagem.situacao === "ok";
  return (
    <li className="flex items-start gap-3 py-2.5">
      {ok
        ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#2E8932]" aria-label="Em ordem" />
        : <AlertCircle size={14} className="mt-0.5 shrink-0 text-[#B07A14]" aria-label="Pendente" />}
      <div className="min-w-0 flex-1">
        <p className="text-[0.75rem] font-medium text-black/75">
          {checagem.titulo}
          {!ok && checagem.progresso > 0 && <span className="ml-1.5 text-[0.625rem] font-normal tabular-nums text-black/40">{Math.floor(checagem.progresso * 100)}%</span>}
        </p>
        <p className="text-[0.6875rem] leading-4 text-black/50">{checagem.detalhe}</p>
      </div>
      {!ok && (
        <Link
          href={destino(prestacaoId, checagem.destino, checagem.codigo)}
          className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[0.6875rem] text-[#684DB0] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
        >
          Resolver <ArrowRight size={11} aria-hidden />
        </Link>
      )}
    </li>
  );
}

/**
 * Prontidão para envio: o percentual, as pendências com o caminho para
 * resolver cada uma e, recolhido, o que já está em ordem.
 */
export function ProntidaoPrestacao({ prontidao, prestacaoId }: { prontidao: Prontidao; prestacaoId: string }) {
  const [verOk, setVerOk] = useState(false);
  const emOrdem = prontidao.checagens.filter(c => c.situacao === "ok");
  const tom = cor(prontidao.percentual);
  return (
    <section aria-labelledby="prontidao-titulo" className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div>
          <h2 id="prontidao-titulo" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">Prontidão para envio</h2>
          <p className="mt-1 text-[2rem] font-semibold leading-none tracking-[-.02em] tabular-nums" style={{ color: tom }}>{prontidao.percentual}%</p>
        </div>
        <div className="min-w-[12rem] flex-1 sm:max-w-[22rem]">
          <div
            className="h-2 overflow-hidden rounded-full bg-black/[.07]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={prontidao.percentual}
            aria-label="Prontidão para envio"
          >
            <div className="h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${prontidao.percentual}%`, background: tom }} />
          </div>
          <p className="mt-1.5 text-right text-[0.6875rem] text-black/45">
            {prontidao.pendencias.length
              ? `${prontidao.pendencias.length} ${prontidao.pendencias.length === 1 ? "pendência" : "pendências"} antes de enviar`
              : "Nada pendente para enviar"}
          </p>
        </div>
      </div>

      <div className="px-5">
        {prontidao.pendencias.length > 0 && (
          <ul className="divide-y divide-black/[.05]">
            {prontidao.pendencias.map(checagem => <Linha key={checagem.codigo} checagem={checagem} prestacaoId={prestacaoId} />)}
          </ul>
        )}
        {emOrdem.length > 0 && (
          <div className={prontidao.pendencias.length ? "border-t border-black/[.05]" : ""}>
            <button
              type="button"
              onClick={() => setVerOk(!verOk)}
              aria-expanded={verOk}
              className="flex w-full items-center gap-1.5 py-2.5 text-left text-[0.6875rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
            >
              <ChevronRight size={12} className={`transition-transform duration-200 motion-reduce:transition-none ${verOk ? "rotate-90" : ""}`} aria-hidden />
              Em ordem ({emOrdem.length})
            </button>
            {verOk && (
              <ul className="divide-y divide-black/[.05] pb-1">
                {emOrdem.map(checagem => <Linha key={checagem.codigo} checagem={checagem} prestacaoId={prestacaoId} />)}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
