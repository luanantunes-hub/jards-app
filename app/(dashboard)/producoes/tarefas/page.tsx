"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { diaEMes } from "@/lib/producao/agenda";
import type { SituacaoDaTarefa } from "@/lib/producao/estados";
import { GRUPOS_DA_TAREFA, grupoDaTarefa, type GrupoDaTarefa } from "@/lib/producao/tarefas";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { textoDoPrazo } from "@/components/producao/TarefasDaData";

type Linha = {
  id: string; titulo: string; prazo: string | null; prazo_dias: number | null; funcao: string | null; situacao: SituacaoDaTarefa; data_id: string;
  data: { data: string } | null;
};

/** As tarefas de todas as datas da organização, por urgência: atrasadas, desta semana, depois e feitas. */
export default function TarefasPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  const hoje = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_tarefas")
        .select("id, titulo, prazo, prazo_dias, funcao, situacao, data_id, data:producao_datas(data)").eq("organization_id", organizationId);
      if (!ativo) return;
      setLinhas((data ?? []) as unknown as Linha[]);
      setErro(error ? "Não foi possível carregar as tarefas. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const grupos = useMemo(() => {
    const por: Record<GrupoDaTarefa, Linha[]> = { Atrasadas: [], "Esta semana": [], Depois: [], Feitas: [] };
    for (const linha of linhas ?? []) por[grupoDaTarefa(linha, hoje)].push(linha);
    for (const grupo of GRUPOS_DA_TAREFA) por[grupo].sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
    return por;
  }, [linhas, hoje]);

  async function alternar(linha: Linha) {
    const nova: SituacaoDaTarefa = linha.situacao === "feita" ? "aberta" : "feita";
    setErro(null);
    setLinhas(atual => atual?.map(item => (item.id === linha.id ? { ...item, situacao: nova } : item)) ?? atual);
    const { error } = await clienteDaProducao(createClient()).from("producao_tarefas").update({ situacao: nova }).eq("id", linha.id);
    if (error) { setVersao(atual => atual + 1); setErro("Não foi possível mudar a tarefa. Tente de novo."); }
  }

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Tarefas</h1>
        </div>
      </header>
      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {linhas === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : linhas.length === 0 ? (
          <div className="rounded border bg-white px-5 py-10 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">Nenhuma tarefa ainda</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Abra uma data na agenda e crie as tarefas do modelo (contrato, rider, hotel, folha do dia…).</p>
          </div>
        ) : (
          <div className="space-y-8">
            {GRUPOS_DA_TAREFA.filter(grupo => grupos[grupo].length > 0).map(grupo => (
              <section key={grupo} aria-label={grupo}>
                <h2 className="mb-2 flex items-center gap-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">
                  {grupo === "Atrasadas" && <AlertTriangle size={12} aria-hidden="true" className="text-[#B07A14]" />}
                  {grupo} · {grupos[grupo].length}
                </h2>
                <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <ul className="divide-y divide-black/[.06]">
                    {grupos[grupo].map(linha => {
                      const feita = linha.situacao === "feita";
                      return (
                        <li key={linha.id} className="flex items-start gap-3 px-4 py-3">
                          <button type="button" disabled={!podeEditar} onClick={() => void alternar(linha)} aria-pressed={feita} aria-label={feita ? `Reabrir: ${linha.titulo}` : `Concluir: ${linha.titulo}`} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition focus-visible:outline-2 focus-visible:outline-[#7259B5] ${feita ? "border-[#2E8932] bg-[#2E8932] text-white" : "border-black/20 bg-white text-transparent enabled:hover:border-black/40"}`}>
                            <Check size={12} aria-hidden="true" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[0.8125rem] ${feita ? "text-black/40 line-through decoration-black/25" : "font-medium text-[#282525]"}`}>{linha.titulo}</p>
                            <p className="mt-0.5 text-[0.6875rem] text-black/45">{[textoDoPrazo(linha), linha.funcao].filter(Boolean).join(" · ")}</p>
                          </div>
                          <Link href={`/producoes/datas/${linha.data_id}`} className="shrink-0 rounded px-2 py-1 text-[0.6875rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                            {linha.data ? `Data de ${diaEMes(linha.data.data)}` : "Ver a data"}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            ))}
          </div>
        )}
      </DetailPageContent>
    </div>
  );
}
