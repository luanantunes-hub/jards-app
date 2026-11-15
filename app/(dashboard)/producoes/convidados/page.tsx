"use client";

import { useOrganizationRole } from "@/contexts/OrganizationContext";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { ConvidadosDaSessao } from "@/components/producao/ConvidadosDaSessao";
import { AbasDaSessao } from "@/components/producao/AbasDaSessao";
import { SeletorDeSessao } from "@/components/producao/SeletorDeSessao";

/** Convidados e cortesias (PD7.2): escolhe o espaço e a sessão; a cota de cada tipo de credencial vale por sessão. */
export default function ConvidadosPage() {
  const papel = useOrganizationRole();
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Convidados</h1>
          <AbasDaSessao ativa="convidados" />
        </div>
      </header>
      <SeletorDeSessao>
        {sessao => <ConvidadosDaSessao key={sessao.id} organizationId={sessao.organizationId} sessaoId={sessao.id} sessaoRotulo={sessao.rotulo} podeEditar={podeEditar} />}
      </SeletorDeSessao>
    </div>
  );
}
