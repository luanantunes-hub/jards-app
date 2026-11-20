"use client";

// O restante da prestação, só para ler (P5.4): o proponente vê o mesmo que um
// convidado com todas as seções, menos as despesas e as evidências, que a
// página dele já mostra com a situação de cada envio.

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LISTAS_DO_CONVIDADO, SECOES_DO_CONVITE, type ItemDoConvidado, type SecaoDoConvite } from "@/lib/prestacao/convidados";

type ListaCarregada = { tipo: string; titulo: string; vazia: string; itens: ItemDoConvidado[]; erro: boolean };
const JA_NA_PAGINA = new Set(["despesa", "evidencia"]);

export function AcompanharPrestacao({ prestacaoId, onAbrirArquivo }: { prestacaoId: string; onAbrirArquivo: (path: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [secao, setSecao] = useState<SecaoDoConvite>("financeiro");
  const [listas, setListas] = useState<ListaCarregada[] | null>(null);

  useEffect(() => {
    let ativo = true;
    Promise.all(LISTAS_DO_CONVIDADO[secao].filter(l => !JA_NA_PAGINA.has(l.tipo)).map(async l => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
      let consulta = (supabase as any).from(l.tabela).select(l.campos).eq("prestacao_id", prestacaoId);
      if (l.filtro) consulta = consulta.eq(l.filtro.coluna, l.filtro.valor);
      const { data, error } = await consulta.order(l.ordem.coluna, { ascending: l.ordem.crescente }).limit(500);
      return { tipo: l.tipo, titulo: l.titulo, vazia: l.vazia, itens: ((data ?? []) as Record<string, unknown>[]).map(l.item), erro: Boolean(error) };
    })).then(r => { if (ativo) setListas(r); });
    return () => { ativo = false; };
  }, [secao, prestacaoId, supabase]);

  return (
    <section aria-labelledby="acompanhar-titulo" className="space-y-3">
      <h2 id="acompanhar-titulo" className="text-[0.9375rem] font-semibold text-[#282525]">Acompanhar a prestação</h2>
      <div role="tablist" aria-label="Seções da prestação" className="flex gap-1 overflow-x-auto border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        {SECOES_DO_CONVITE.map(s => (
          <button key={s.id} type="button" role="tab" id={`aba-acompanhar-${s.id}`} aria-selected={secao === s.id} aria-controls="painel-acompanhar"
            onClick={() => { if (secao !== s.id) { setListas(null); setSecao(s.id); } }}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] ${
              secao === s.id ? "border-[#7259B5] text-[#282525]" : "border-transparent text-black/50 hover:text-black/80"}`}>
            {s.rotulo}
          </button>
        ))}
      </div>
      <div id="painel-acompanhar" role="tabpanel" aria-labelledby={`aba-acompanhar-${secao}`} className="space-y-3">
        {listas === null ? (
          <div className="h-32 animate-pulse rounded-lg bg-black/[.04] motion-reduce:animate-none" />
        ) : listas.map(l => (
          <div key={l.tipo} className="rounded-lg border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <h3 className="border-b px-4 py-2.5 text-[0.75rem] font-semibold text-black/70" style={{ borderColor: "rgba(13,13,13,.07)" }}>{l.titulo}</h3>
            {l.erro ? (
              <p role="alert" className="px-4 py-3 text-[0.6875rem] text-[#B23B3B]">Não foi possível carregar esta lista.</p>
            ) : l.itens.length === 0 ? (
              <p className="px-4 py-3 text-[0.75rem] text-black/45">{l.vazia}</p>
            ) : (
              <ul className="divide-y divide-black/[.05]">
                {l.itens.map(item => (
                  <li key={item.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[0.75rem] font-medium text-black/80">{item.titulo}</p>
                      {item.detalhes.length > 0 && <p className="mt-0.5 text-[0.6875rem] text-black/50">{item.detalhes.join(" · ")}</p>}
                      {(item.arquivo || item.link) && (
                        <div className="mt-1 flex flex-wrap gap-3">
                          {item.arquivo && (
                            <button type="button" onClick={() => onAbrirArquivo(item.arquivo!.path)}
                              className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/60 underline decoration-black/20 underline-offset-2 hover:text-[#282525] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                              <FileText size={11} aria-hidden /> {item.arquivo.nome}
                            </button>
                          )}
                          {item.link && (
                            <a href={item.link} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/60 underline decoration-black/20 underline-offset-2 hover:text-[#282525] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                              Abrir link <ExternalLink size={11} aria-hidden />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    {item.valor && <p className="shrink-0 text-[0.75rem] tabular-nums text-black/70">{item.valor}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
