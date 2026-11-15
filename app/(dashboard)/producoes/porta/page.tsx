"use client";

import { useOrganizationRole } from "@/contexts/OrganizationContext";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { PortaDaSessao } from "@/components/producao/PortaDaSessao";
import { AbasDaSessao } from "@/components/producao/AbasDaSessao";
import { SeletorDeSessao } from "@/components/producao/SeletorDeSessao";

/** A porta (PD7.3): escolhe a sessão e confere o código de cada credencial na entrada. */
export default function PortaPage() {
  const papel = useOrganizationRole();
  const podeLer = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Porta</h1>
          <AbasDaSessao ativa="porta" />
        </div>
      </header>
      <SeletorDeSessao>
        {sessao => <PortaDaSessao key={sessao.id} sessaoId={sessao.id} podeLer={podeLer} />}
      </SeletorDeSessao>
    </div>
  );
}
