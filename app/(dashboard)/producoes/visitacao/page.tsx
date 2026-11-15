"use client";

import { useEffect, useState } from "react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { Dropdown } from "@/components/ui/Dropdown";
import { VisitacaoDoEspaco } from "@/components/producao/VisitacaoDoEspaco";

type Espaco = { id: string; nome: string };

/** Visitação e grupos (PD7.5): escolhe o espaço; horários com capacidade, agendamentos de escolas e grupos por link e o público por dia. */
export default function VisitacaoPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [espacos, setEspacos] = useState<Espaco[] | null>(null);
  const [espacoId, setEspacoId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_espacos").select("id, nome").eq("organization_id", organizationId).eq("arquivado", false).order("nome");
      if (!ativo) return;
      setEspacos((data ?? []) as Espaco[]);
      setEspacoId(atual => atual || data?.[0]?.id || "");
      if (error) setErro("Não foi possível carregar os espaços. Recarregue a página.");
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  const espaco = espacos?.find(item => item.id === espacoId);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Visitação</h1>
        </div>
      </header>
      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {espacos === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : espacos.length === 0 ? (
          <p className="rounded border bg-white px-5 py-8 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Cadastre um espaço para criar os horários de visita.</p>
        ) : (
          <>
            <div className="mb-5 w-64 max-w-full"><Dropdown ariaLabel="Espaço" value={espacoId} onChange={setEspacoId} options={espacos.map(item => ({ value: item.id, label: item.nome }))} /></div>
            {espaco && organizationId && <VisitacaoDoEspaco key={espaco.id} organizationId={organizationId} espacoId={espaco.id} espacoNome={espaco.nome} podeEditar={podeEditar} />}
          </>
        )}
      </DetailPageContent>
    </div>
  );
}
