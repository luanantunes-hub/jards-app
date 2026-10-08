"use client";

// Quem conduz a prestação na equipe (P5.1). Vazio, o banco escolhe: quem tem
// a função de responsável, quem criou, o admin. Os prazos automáticos da
// prestação vão para essa pessoa.

import { useEffect, useState } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { fetchOrganizationMembers, type OrganizationMemberSummary } from "@/lib/organization/members";

/** Quem pode conduzir: tem a prestação de contas e papel que edita. */
export function podeConduzir(m: Pick<OrganizationMemberSummary, "papel" | "modulos_acesso">): boolean {
  return ["admin", "colaborador", "visualizador"].includes(m.papel) && (m.modulos_acesso ?? []).includes("prestacao");
}

export const nomeDoMembro = (m: Pick<OrganizationMemberSummary, "full_name" | "email">) => m.full_name || m.email || "Sem nome";

export function ResponsavelDaPrestacao({ organizationId, responsavelId, podeEditar, onSalvar }: {
  organizationId: string | null;
  responsavelId: string | null;
  podeEditar: boolean;
  onSalvar: (campos: { responsavel_id: string | null }) => Promise<boolean>;
}) {
  const [membros, setMembros] = useState<OrganizationMemberSummary[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    fetchOrganizationMembers(organizationId)
      .then(lista => { if (ativo) setMembros(lista); })
      .catch(() => { if (ativo) setMembros([]); });
    return () => { ativo = false; };
  }, [organizationId]);

  const elegiveis = (membros ?? []).filter(podeConduzir);
  const atual = (membros ?? []).find(m => m.user_id === responsavelId);

  if (!podeEditar) {
    return <p className="text-[0.6875rem] text-black/60">{atual ? nomeDoMembro(atual) : responsavelId ? "Fora da equipe" : "Automático"}</p>;
  }

  return (
    <div aria-busy={salvando}>
      <Dropdown
        value={responsavelId ?? ""}
        ariaLabel="Responsável pela prestação"
        disabled={membros === null || salvando}
        onChange={async v => {
          if ((v || null) === responsavelId) return;
          setSalvando(true);
          await onSalvar({ responsavel_id: v || null });
          setSalvando(false);
        }}
        options={[
          { value: "", label: "Automático" },
          ...elegiveis.map(m => ({ value: m.user_id, label: nomeDoMembro(m) })),
          ...(responsavelId && !elegiveis.some(m => m.user_id === responsavelId) ? [{ value: responsavelId, label: atual ? `${nomeDoMembro(atual)} (sem acesso)` : "Fora da equipe" }] : []),
        ]}
      />
      <p className="mt-1 text-[0.5625rem] text-black/35">Recebe os prazos e avisos da prestação. Automático: quem tem a função de responsável ou quem criou.</p>
    </div>
  );
}
