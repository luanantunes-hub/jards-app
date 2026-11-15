"use client";

import { useOrganizationRole } from "@/contexts/OrganizationContext";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { PlateiaDaSessao } from "@/components/producao/PlateiaDaSessao";
import { AbasDaSessao } from "@/components/producao/AbasDaSessao";
import { SeletorDeSessao } from "@/components/producao/SeletorDeSessao";

/** Mapa da plateia (PD7.7): os setores da sala e o que a sessão faz com os lugares de cada um (venda, patrocinador, gratuidade, acessibilidade, imprensa, bloqueio). */
export default function PlateiaPage() {
  const papel = useOrganizationRole();
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Plateia</h1>
          <p className="mt-1 max-w-2xl text-[0.75rem] text-black/45">Os setores de cada sala e, em cada sessão, quantos lugares vão para venda, patrocinador, gratuidade, acessibilidade, imprensa ou bloqueio. O banco não deixa a soma passar dos lugares do setor. A receita e o borderô por cima vêm depois.</p>
          <AbasDaSessao ativa="plateia" />
        </div>
      </header>
      <SeletorDeSessao>
        {sessao => <PlateiaDaSessao key={sessao.id} organizationId={sessao.organizationId} sessaoId={sessao.id} podeEditar={podeEditar} />}
      </SeletorDeSessao>
    </div>
  );
}
