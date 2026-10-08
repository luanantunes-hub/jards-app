"use client";

// As prestações de contas do proponente (P5.4), no espaço dele: a situação,
// o prazo e o que ele enviou. Some quando não há nenhuma.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { situacaoDaPrestacao, textoDoPrazo, type MinhaPrestacao } from "@/lib/prestacao/proponente";

const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function PrestacoesDoProponente() {
  const [prestacoes, setPrestacoes] = useState<MinhaPrestacao[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    (createClient() as any).rpc("fn_proponente_minhas_prestacoes").then(({ data, error }: { data: MinhaPrestacao[] | null; error: unknown }) => {
      if (!ativo) return;
      setErro(Boolean(error));
      setPrestacoes(data ?? []);
    });
    return () => { ativo = false; };
  }, []);

  if (prestacoes === null || (prestacoes.length === 0 && !erro)) return null;
  const hoje = hojeIso();

  return (
    <section aria-labelledby="prestacoes-proponente" className="mb-10">
      <h2 id="prestacoes-proponente" className="mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold text-[#0D0D0D]">
        <ClipboardCheck size={16} className="text-black/40" aria-hidden /> Prestações de contas
      </h2>
      {erro ? (
        <p role="alert" className="text-[0.75rem] text-[#B23B3B]">Não foi possível carregar as prestações. Atualize a página.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {prestacoes.map(p => {
            const s = situacaoDaPrestacao(p.status);
            const prazo = textoDoPrazo(p.prazo, hoje);
            return (
              <li key={p.id}>
                <Link href={`/workspace-proponente/prestacoes/${p.id}`}
                  className="group flex h-full flex-col rounded border bg-white p-5 transition hover:bg-black/[.015] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                  style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">{p.organizacao}</p>
                    <span className="shrink-0 rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: s.cor + "47", color: s.cor }}>{s.rotulo}</span>
                  </div>
                  <p className="mt-2 text-[0.875rem] font-semibold text-black/80 group-hover:text-black">{p.titulo}</p>
                  <p className="mt-0.5 text-[0.6875rem] text-black/45">{[p.regime, p.identificador_oficial].filter(Boolean).join(" · ")}</p>
                  {prazo && <p className={`mt-2 text-[0.6875rem] ${prazo.atrasado ? "text-[#B23B3B]" : "text-black/55"}`}>{prazo.texto}</p>}
                  <div className="mt-auto pt-4">
                    <div className="flex items-center justify-between gap-2 border-t pt-3 text-[0.6875rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                      <span>
                        {plural(p.despesas, "despesa", "despesas")}
                        {p.em_analise > 0 && ` · ${p.em_analise} em análise`}
                        {p.recusadas > 0 && <span className="text-[#B23B3B]">{` · ${plural(p.recusadas, "recusada", "recusadas")}`}</span>}
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-black/30" aria-hidden />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
