"use client";

import { useEffect, useState } from "react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { BorderoDaSessao } from "@/components/producao/BorderoDaSessao";
import { SeletorDeSessao } from "@/components/producao/SeletorDeSessao";

/** Borderô (PD7.4): escolhe a sessão e vê o público (casa e porta) e, para quem tem a permissão de dinheiro, a receita, as deduções e o líquido. */
export default function BorderoPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [comDinheiro, setComDinheiro] = useState<boolean | null>(null);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data } = await clienteDaProducao(createClient()).rpc("auth_producao_pode", { p_org: organizationId, p_acao: "dinheiro" });
      if (ativo) setComDinheiro(data === true);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Borderô</h1>
          <p className="mt-1 max-w-2xl text-[0.75rem] text-black/45">O resumo de cada sessão: o público (o da casa e o da porta), a receita por categoria de ingresso, as deduções e o líquido. Receita e deduções só aparecem para quem tem a permissão de dinheiro. As deduções são uma lista aberta: o app não traz porcentagem pronta.</p>
        </div>
      </header>
      <SeletorDeSessao>
        {sessao => comDinheiro === null
          ? <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
          : <BorderoDaSessao key={sessao.id} organizationId={sessao.organizationId} sessaoId={sessao.id} sessaoRotulo={sessao.rotulo} podeEditar={podeEditar} comDinheiro={comDinheiro} />}
      </SeletorDeSessao>
    </div>
  );
}
