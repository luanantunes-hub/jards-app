"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { ROTULO_DA_SITUACAO_DO_VINCULO } from "@/lib/producao/equipe";
import { SITUACOES_DO_VINCULO, type SituacaoDoVinculo } from "@/lib/producao/estados";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { Select } from "@/components/ui/Select";
import { VincularPessoaSheet } from "@/components/producao/VincularPessoaSheet";

type Vinculo = {
  id: string; pessoa_id: string; funcao: string; grupo: string | null; situacao: SituacaoDoVinculo;
  pessoa: { nome: string; nome_artistico: string | null } | null;
  valores: { cache: number | null; diaria: number | null } | null;
};

/** A equipe da temporada (PD1.9): quem trabalha nela, em que função, e o cachê e a diária para quem vê o dinheiro. */
export function EquipeDaTemporada({ organizationId, temporadaId, podeEditar }: { organizationId: string; temporadaId: string; podeEditar: boolean }) {
  const { confirmDelete } = useDeleteConfirm();
  const [vinculos, setVinculos] = useState<Vinculo[] | null>(null);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([]);
  const [comDinheiro, setComDinheiro] = useState(false);
  const [folha, setFolha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [vin, pes, dinheiro] = await Promise.all([
        producao.from("producao_vinculos")
          .select("id, pessoa_id, funcao, grupo, situacao, pessoa:producao_pessoas!pessoa_id(nome, nome_artistico), valores:producao_vinculos_valores(cache, diaria)")
          .eq("temporada_id", temporadaId),
        producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
        producao.rpc("auth_producao_pode", { p_org: organizationId, p_acao: "dinheiro" }),
      ]);
      if (!ativo) return;
      setVinculos(((vin.data ?? []) as unknown as (Omit<Vinculo, "valores"> & { valores: Vinculo["valores"] | Vinculo["valores"][] })[])
        .map(item => ({ ...item, valores: Array.isArray(item.valores) ? item.valores[0] ?? null : item.valores })));
      setPessoas((pes.data ?? []) as { id: string; nome: string }[]);
      setComDinheiro(dinheiro.data === true);
      setErro(vin.error ? "Não foi possível carregar a equipe. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [temporadaId, organizationId, versao]);

  const ordenados = useMemo(() => [...(vinculos ?? [])].sort((a, b) => (a.pessoa?.nome ?? "").localeCompare(b.pessoa?.nome ?? "", "pt-BR") || a.funcao.localeCompare(b.funcao, "pt-BR")), [vinculos]);
  const jaVinculadas = useMemo(() => new Set((vinculos ?? []).map(item => item.pessoa_id)), [vinculos]);

  async function mudarSituacao(vinculo: Vinculo, nova: SituacaoDoVinculo) {
    if (nova === vinculo.situacao) return;
    setErro(null);
    setVinculos(atual => atual?.map(item => (item.id === vinculo.id ? { ...item, situacao: nova } : item)) ?? atual);
    const { error } = await clienteDaProducao(createClient()).from("producao_vinculos").update({ situacao: nova }).eq("id", vinculo.id);
    if (error) { recarregar(); setErro("Não foi possível mudar a situação. Tente de novo."); }
  }

  function tirar(vinculo: Vinculo) {
    confirmDelete({
      title: "Tirar da temporada?",
      description: `${vinculo.pessoa?.nome ?? "A pessoa"} deixa a função "${vinculo.funcao}". O cadastro e as escalas continuam.`,
      confirmLabel: "Tirar",
      pendingLabel: "Tirando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_vinculos").delete().eq("id", vinculo.id);
        if (error) throw new Error("Não foi possível tirar da temporada.");
        recarregar();
      },
    });
  }

  const vincular = <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Pôr pessoa</PrimaryListAction>;

  return (
    <section aria-labelledby="equipe-da-temporada" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="equipe-da-temporada" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Equipe da temporada</h2>
        {podeEditar && ordenados.length > 0 && vincular}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {vinculos === null ? (
        <div className="h-20 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : ordenados.length === 0 ? (
        <div className="rounded border bg-white px-5 py-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Ninguém nesta temporada ainda</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Ponha quem trabalha nela, com a função. Depois é só escalar em cada data.</p>
          {podeEditar && <div className="mt-4 flex justify-center">{vincular}</div>}
        </div>
      ) : (
        <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <ul className="divide-y divide-black/[.06]">
            {ordenados.map(vinculo => {
              const nome = vinculo.pessoa?.nome ?? "Pessoa sem acesso";
              return (
                <li key={vinculo.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate text-[0.8125rem] font-medium text-[#282525]">
                      {nome}{vinculo.pessoa?.nome_artistico && <span className="font-normal text-black/45"> · {vinculo.pessoa.nome_artistico}</span>}
                    </p>
                    <p className="text-[0.6875rem] text-black/45">{[vinculo.funcao, vinculo.grupo].filter(Boolean).join(" · ")}</p>
                  </div>
                  {comDinheiro && (
                    <p className="text-[0.6875rem] tabular-nums text-black/55">
                      {vinculo.valores?.cache ? <span title={formatarValorCompleto(vinculo.valores.cache)}>Cachê {formatarValorCurto(vinculo.valores.cache)}</span> : null}
                      {vinculo.valores?.cache && vinculo.valores?.diaria ? " · " : null}
                      {vinculo.valores?.diaria ? <span title={formatarValorCompleto(vinculo.valores.diaria)}>Diária {formatarValorCurto(vinculo.valores.diaria)}</span> : null}
                    </p>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    {podeEditar ? (
                      <Select block={false} aria-label={`Situação de ${nome} como ${vinculo.funcao}`} value={vinculo.situacao} onChange={event => void mudarSituacao(vinculo, event.target.value as SituacaoDoVinculo)} className="h-9 pl-3 text-black/60">
                        {SITUACOES_DO_VINCULO.map(situacao => <option key={situacao} value={situacao}>{ROTULO_DA_SITUACAO_DO_VINCULO[situacao]}</option>)}
                      </Select>
                    ) : <span className="text-[0.75rem] text-black/55">{ROTULO_DA_SITUACAO_DO_VINCULO[vinculo.situacao]}</span>}
                    {podeEditar && (
                      <button type="button" onClick={() => tirar(vinculo)} aria-label={`Tirar ${nome} da temporada`} title="Tirar da temporada" className="flex h-9 w-9 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Trash2 size={14} aria-hidden="true" /></button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {folha && <VincularPessoaSheet organizationId={organizationId} temporadaId={temporadaId} pessoas={pessoas} jaVinculadas={jaVinculadas} comDinheiro={comDinheiro && podeEditar} onClose={() => setFolha(false)} onCreated={recarregar} />}
    </section>
  );
}
