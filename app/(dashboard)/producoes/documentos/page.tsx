"use client";

import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { DocumentosDaProducao } from "@/components/producao/DocumentosDaProducao";

/** A pasta de documentos com validade (PD4.8): da organização e das pessoas. O Jards avisa no "Hoje" da Agenda quando um vai vencer. */
export default function DocumentosPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Documentos</h1>
        </div>
      </header>
      <DetailPageContent>
        {organizationId ? <DocumentosDaProducao organizationId={organizationId} podeEditar={podeEditar} /> : null}
      </DetailPageContent>
    </div>
  );
}
