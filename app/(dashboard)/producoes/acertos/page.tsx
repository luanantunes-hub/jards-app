"use client";

import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { DetailBackLink, DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { ModelosDeAcerto } from "@/components/producao/ModelosDeAcerto";

/** Os modelos de acerto técnico da organização (PD4.1). O acerto em si nasce na página de cada data. */
export default function ModelosDeAcertoPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <DetailBackLink href="/producoes" label="Produção" />
          <h1 className="mt-5 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Acerto técnico</h1>
          <p className="mt-1 max-w-2xl text-[0.75rem] text-black/45">A lista de perguntas que a casa responde pelo link, sem entrar no Jards. Você revê cada resposta, e só o que aprovar vai para a ficha da sala ou do espaço.</p>
        </div>
      </header>
      <DetailPageContent>
        {organizationId && <ModelosDeAcerto organizationId={organizationId} podeEditar={podeEditar} />}
      </DetailPageContent>
    </div>
  );
}
