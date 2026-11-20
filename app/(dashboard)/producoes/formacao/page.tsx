"use client";

import { useEffect, useState } from "react";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import type { TurmaDeFormacao } from "@/lib/producao/formacao";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { Dropdown } from "@/components/ui/Dropdown";
import { FormacaoDaTurma, TurmaSheet } from "@/components/producao/FormacaoDaTurma";

/** Formação (PD7.10): turmas com aulas, matrículas, presença por aula, frequência e certificado. */
export default function FormacaoPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [turmas, setTurmas] = useState<TurmaDeFormacao[] | null>(null);
  const [turmaId, setTurmaId] = useState("");
  const [novaAberta, setNovaAberta] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_turmas").select("id, nome, inicio, fim, vagas, frequencia_minima, situacao, notas").eq("organization_id", organizationId).order("inicio", { ascending: false, nullsFirst: true }).order("nome");
      if (!ativo) return;
      setTurmas(data ?? []);
      setTurmaId(atual => (data ?? []).some(turma => turma.id === atual) ? atual : (data?.[0]?.id ?? ""));
      setErro(error ? "Não foi possível carregar as turmas. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const turma = turmas?.find(item => item.id === turmaId);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Formação</h1>
        </div>
      </header>
      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {turmas === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              {turmas.length > 0 && <div className="w-80 max-w-full"><Dropdown ariaLabel="Turma" value={turmaId} onChange={setTurmaId} options={turmas.map(item => ({ value: item.id, label: item.nome }))} /></div>}
              {podeEditar && <PrimaryListAction onClick={() => setNovaAberta(true)}><Plus size={13} aria-hidden="true" /> Nova turma</PrimaryListAction>}
            </div>
            {turma && organizationId ? (
              <FormacaoDaTurma key={turma.id} organizationId={organizationId} turma={turma} podeEditar={podeEditar} onTurmaMudou={() => setVersao(atual => atual + 1)} />
            ) : (
              <p className="rounded border bg-white px-5 py-8 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhuma turma ainda. Crie a primeira para cadastrar aulas e matrículas.</p>
            )}
          </>
        )}
      </DetailPageContent>
      {novaAberta && organizationId && <TurmaSheet organizationId={organizationId} turma={null} onClose={() => setNovaAberta(false)} onSalvou={id => { if (id) setTurmaId(id); setVersao(atual => atual + 1); }} />}
    </div>
  );
}
