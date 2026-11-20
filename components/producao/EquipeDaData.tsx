"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { CONFIRMACOES_DA_ESCALA, type ConfirmacaoDaEscala } from "@/lib/producao/estados";
import { diaEMes } from "@/lib/producao/agenda";
import { conflitosDasEscalas } from "@/lib/producao/conflitos";
import { ROTULO_DA_CONFIRMACAO, rotuloDoHorario } from "@/lib/producao/escala";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { Select } from "@/components/ui/Select";
import { EscalarPessoaSheet } from "@/components/producao/EscalarPessoaSheet";

type Escala = {
  id: string; pessoa_id: string; funcao: string | null; chamada: string | null; saida: string | null; confirmacao: ConfirmacaoDaEscala;
  pessoa: { nome: string; nome_artistico: string | null } | null;
};
type OutraEscala = {
  id: string; pessoa_id: string; data_id: string; chamada: string | null; saida: string | null;
  data: { data: string; data_fim: string | null; fuso: string; temporada: { titulo: string } | null } | null;
};
type Pessoa = { id: string; nome: string };

/** Pela chamada, quem não tem chamada no fim, e então pelo nome. */
function porChamada(a: Escala, b: Escala): number {
  if (a.chamada && b.chamada && a.chamada !== b.chamada) return a.chamada.localeCompare(b.chamada);
  if (!a.chamada !== !b.chamada) return a.chamada ? -1 : 1;
  return (a.pessoa?.nome ?? "").localeCompare(b.pessoa?.nome ?? "", "pt-BR");
}

/**
 * A equipe da data (PD1.10): quem trabalha, a função no dia, a chamada e a saída, a resposta de cada
 * pessoa e o aviso de quem já está em outra data no mesmo horário, com o link para ela. O aviso sai
 * só das escalas que quem consulta vê (lib/producao/conflitos.ts).
 */
export function EquipeDaData({ organizationId, data, podeEditar }: {
  organizationId: string;
  data: { id: string; data: string; data_fim: string | null; fuso: string };
  podeEditar: boolean;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [escalas, setEscalas] = useState<Escala[] | null>(null);
  const [outras, setOutras] = useState<OutraEscala[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [folha, setFolha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [esc, pes] = await Promise.all([
        producao.from("producao_escalas").select("id, pessoa_id, funcao, chamada, saida, confirmacao, pessoa:producao_pessoas!pessoa_id(nome, nome_artistico)").eq("data_id", data.id),
        producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
      ]);
      const daData = (esc.data ?? []) as Escala[];
      const ids = [...new Set(daData.map(escala => escala.pessoa_id))];
      // As outras datas de quem está aqui, para o aviso de conflito.
      const out = ids.length === 0 ? null : await producao.from("producao_escalas")
        .select("id, pessoa_id, data_id, chamada, saida, data:producao_datas!data_id(data, data_fim, fuso, temporada:producao_temporadas!temporada_id(titulo))")
        .in("pessoa_id", ids).neq("data_id", data.id);
      if (!ativo) return;
      setEscalas(daData);
      setOutras((out?.data ?? []) as OutraEscala[]);
      setPessoas((pes.data ?? []) as Pessoa[]);
      if (esc.error) setErro("Não foi possível carregar a equipe. Recarregue a página.");
    })();
    return () => { ativo = false; };
  }, [data.id, organizationId, versao]);

  const ordenadas = useMemo(() => [...(escalas ?? [])].sort(porChamada), [escalas]);
  const jaEscaladas = useMemo(() => new Set((escalas ?? []).map(escala => escala.pessoa_id)), [escalas]);
  const outraPorId = useMemo(() => new Map(outras.map(outra => [outra.id, outra])), [outras]);
  const conflitos = useMemo(() => conflitosDasEscalas(
    (escalas ?? []).map(escala => ({ id: escala.id, pessoaId: escala.pessoa_id, dataId: data.id, dia: data.data, diaFim: data.data_fim, chamada: escala.chamada, saida: escala.saida })),
    outras.flatMap(outra => (outra.data ? [{ id: outra.id, pessoaId: outra.pessoa_id, dataId: outra.data_id, dia: outra.data.data, diaFim: outra.data.data_fim, chamada: outra.chamada, saida: outra.saida }] : [])),
  ), [escalas, outras, data.id, data.data, data.data_fim]);

  async function responder(escala: Escala, nova: ConfirmacaoDaEscala) {
    if (nova === escala.confirmacao) return;
    setErro(null);
    setEscalas(atual => atual?.map(item => (item.id === escala.id ? { ...item, confirmacao: nova } : item)) ?? atual);
    const { error } = await clienteDaProducao(createClient()).from("producao_escalas").update({ confirmacao: nova }).eq("id", escala.id);
    if (error) { recarregar(); setErro("Não foi possível guardar a resposta. Tente de novo."); }
  }

  function tirar(escala: Escala) {
    confirmDelete({
      title: "Tirar da escala?",
      description: `${escala.pessoa?.nome ?? "A pessoa"} sai da equipe desta data. O cadastro continua.`,
      confirmLabel: "Tirar",
      pendingLabel: "Tirando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_escalas").delete().eq("id", escala.id);
        if (error) throw new Error("Não foi possível tirar da escala.");
        recarregar();
      },
    });
  }

  const escalar = <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Escalar pessoa</PrimaryListAction>;

  return (
    <section aria-labelledby="equipe-da-data" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="equipe-da-data" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Equipe</h2>
        {podeEditar && ordenadas.length > 0 && escalar}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

      {escalas === null ? (
        <div className="h-20 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : ordenadas.length === 0 ? (
        <div className="rounded border bg-white px-5 py-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Ninguém escalado nesta data</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">O Jards avisa quando alguém já está em outra data no mesmo horário.</p>
          {podeEditar && <div className="mt-4 flex justify-center">{escalar}</div>}
        </div>
      ) : (
        <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <ul className="divide-y divide-black/[.06]">
            {ordenadas.map(escala => {
              const nome = escala.pessoa?.nome ?? "Pessoa sem acesso";
              const detalhe = [escala.funcao, rotuloDoHorario(escala, data.fuso)].filter(Boolean).join(" · ");
              return (
                <li key={escala.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="truncate text-[0.8125rem] font-medium text-[#282525]">
                      {nome}
                      {escala.pessoa?.nome_artistico && <span className="font-normal text-black/45"> · {escala.pessoa.nome_artistico}</span>}
                    </p>
                    <p className="text-[0.6875rem] text-black/45">{detalhe || "Sem função nem horário"}</p>
                    {(conflitos.get(escala.id) ?? []).map(conflito => {
                      const outra = outraPorId.get(conflito.id);
                      const horario = outra?.data ? rotuloDoHorario(conflito, outra.data.fuso) : "";
                      return (
                        <p key={conflito.id} className="mt-1.5 flex items-start gap-1.5 text-[0.6875rem] text-black/60">
                          <AlertTriangle size={12} aria-hidden="true" className="mt-px shrink-0 text-[#B07A14]" />
                          <span>
                            Também em{" "}
                            <Link href={`/producoes/datas/${conflito.dataId}`} className="font-medium text-[#282525] underline decoration-black/20 underline-offset-2 transition hover:decoration-black/50 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                              {outra?.data?.temporada?.titulo ?? "outra data"} · {diaEMes(conflito.dia)}
                            </Link>
                            {horario ? ` · ${horario}` : ""}
                          </span>
                        </p>
                      );
                    })}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {podeEditar ? (
                      <Select block={false} aria-label={`Resposta de ${nome}`} value={escala.confirmacao} onChange={event => void responder(escala, event.target.value as ConfirmacaoDaEscala)} className="h-9 pl-3 text-black/60">
                        {CONFIRMACOES_DA_ESCALA.map(confirmacao => <option key={confirmacao} value={confirmacao}>{ROTULO_DA_CONFIRMACAO[confirmacao]}</option>)}
                      </Select>
                    ) : <span className="text-[0.75rem] text-black/55">{ROTULO_DA_CONFIRMACAO[escala.confirmacao]}</span>}
                    {podeEditar && (
                      <button type="button" onClick={() => tirar(escala)} aria-label={`Tirar ${nome} da escala`} title="Tirar da escala" className="flex h-9 w-9 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Trash2 size={14} aria-hidden="true" /></button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {folha && (
        <EscalarPessoaSheet organizationId={organizationId} dataId={data.id} dia={data.data} fuso={data.fuso} pessoas={pessoas} jaEscaladas={jaEscaladas} onClose={() => setFolha(false)} onCreated={recarregar} />
      )}
    </section>
  );
}
