"use client";

import { useOrganizationRole } from "@/contexts/OrganizationContext";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { AcessibilidadeDaSessao } from "@/components/producao/AcessibilidadeDaSessao";
import { SeletorDeSessao } from "@/components/producao/SeletorDeSessao";

/** Acessibilidade por sessão (PD7.6): Libras, audiodescrição, legendagem e lugares reservados, com a pessoa escalada e o que falta. */
export default function AcessibilidadePage() {
  const papel = useOrganizationRole();
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Acessibilidade</h1>
        </div>
      </header>
      <SeletorDeSessao>
        {sessao => <AcessibilidadeDaSessao key={sessao.id} organizationId={sessao.organizationId} sessaoId={sessao.id} podeEditar={podeEditar} />}
      </SeletorDeSessao>
    </div>
  );
}
