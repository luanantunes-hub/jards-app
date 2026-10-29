"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drama } from "lucide-react";
import { useOrganizationRole, useUsaProducao } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { tituloSugeridoDaTemporada } from "@/lib/producao/abrir";
import { NovaTemporadaSheet } from "@/components/producao/NovaTemporadaSheet";

const BOTAO = "flex h-11 items-center gap-2 rounded border bg-white px-4 text-[0.75rem] font-medium text-black/50 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]";

/**
 * No projeto com patrocínio vendido ou inscrição aprovada: abre a produção (cria a
 * temporada já ligada ao projeto) ou, se já existe, leva até ela. Só aparece para
 * quem usa a produção na organização e pode editar.
 */
export function AbrirProducaoBotao({ projetoId, projetoNome, organizationId, elegivel }: {
  projetoId: string;
  projetoNome: string;
  organizationId: string;
  /** O projeto já tem venda ou inscrição aprovada (podeAbrirProducao). */
  elegivel: boolean;
}) {
  const router = useRouter();
  const usaProducao = useUsaProducao();
  const papel = useOrganizationRole();
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  const [existente, setExistente] = useState<string | null | undefined>(undefined);
  const [aberta, setAberta] = useState(false);
  const visivel = usaProducao && podeEditar;

  useEffect(() => {
    if (!visivel) return;
    let ativo = true;
    void (async () => {
      const { data } = await clienteDaProducao(createClient()).from("producao_temporadas").select("id").eq("projeto_id", projetoId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (ativo) setExistente(data?.id ?? null);
    })();
    return () => { ativo = false; };
  }, [visivel, projetoId]);

  if (!visivel || existente === undefined) return null;
  if (existente) {
    return <Link href={`/producoes/temporadas/${existente}`} className={BOTAO} style={{ borderColor: "rgba(13,13,13,.12)" }}><Drama size={14} aria-hidden="true" /> Ver produção</Link>;
  }
  if (!elegivel) return null;
  return (
    <>
      <button type="button" onClick={() => setAberta(true)} className={BOTAO} style={{ borderColor: "rgba(13,13,13,.12)" }}><Drama size={14} aria-hidden="true" /> Abrir produção</button>
      {aberta && (
        <NovaTemporadaSheet
          organizationId={organizationId}
          projetoId={projetoId}
          tituloInicial={tituloSugeridoDaTemporada(projetoNome)}
          onClose={() => setAberta(false)}
          onCreated={id => router.push(`/producoes/temporadas/${id}`)}
        />
      )}
    </>
  );
}
