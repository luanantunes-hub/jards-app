"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { fraseDoHistorico, type LinhaDoHistorico } from "@/lib/producao/historico";

const FILHAS = ["producao_blocos", "producao_escalas", "producao_cartoes_dia", "producao_tarefas"] as const;

function quando(instante: string): string {
  return new Date(instante).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * O histórico da data (PD1.6): o que mudou na própria data, nos blocos do dia, nas escalas, nos cartões e nas tarefas,
 * do mais novo ao mais velho. Cada pessoa só vê o que as regras do banco deixam ela ver; a lista começa recolhida.
 */
export function HistoricoDaData({ dataId }: { dataId: string }) {
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<LinhaDoHistorico[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    void (async () => {
      const cliente = clienteDaProducao(createClient());
      const filhas = await Promise.all(FILHAS.map(tabela => cliente.from(tabela).select("id").eq("data_id", dataId)));
      const ids = [dataId, ...filhas.flatMap(resposta => (resposta.data ?? []).map(linha => (linha as { id: string }).id))];
      const { data, error } = await cliente.from("producao_historico")
        .select("id, entidade, acao, campo, antes, depois, quando").in("entidade_id", ids).order("quando", { ascending: false }).limit(100);
      if (!ativo) return;
      setLinhas((data ?? []) as LinhaDoHistorico[]);
      setErro(error ? "Não foi possível carregar o histórico. Tente de novo." : null);
    })();
    return () => { ativo = false; };
  }, [aberto, dataId]);

  return (
    <section aria-labelledby="historico-da-data" className="mt-10">
      <h2 id="historico-da-data" className="mb-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Histórico</h2>
      {!aberto ? (
        <button type="button" onClick={() => setAberto(true)} className="rounded border border-black/[.12] px-3.5 py-2 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Ver o que mudou nesta data</button>
      ) : erro ? (
        <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>
      ) : linhas === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : linhas.length === 0 ? (
        <p className="text-[0.75rem] text-black/45">Nada mudou ainda.</p>
      ) : (
        <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <ul className="divide-y divide-black/[.06]">
            {linhas.map(linha => (
              <li key={linha.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5">
                <span className="text-[0.8125rem] text-[#282525]">{fraseDoHistorico(linha)}</span>
                <span className="text-[0.6875rem] tabular-nums text-black/45">{quando(linha.quando)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
