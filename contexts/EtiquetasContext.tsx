"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";

import {
  DEFAULT_ETIQUETAS_CAPTACAO,
  DEFAULT_ETIQUETAS_INSCRICAO,
  DEFAULT_ETIQUETAS_MATURIDADE_PROPONENTE,
  DEFAULT_ETIQUETAS_PROPONENTE,
  corDeEtiqueta,
  type Etiqueta,
} from "@/lib/etiquetas-padrao";

export type { Etiqueta };
export { DEFAULT_ETIQUETAS_CAPTACAO, DEFAULT_ETIQUETAS_INSCRICAO, DEFAULT_ETIQUETAS_MATURIDADE_PROPONENTE, DEFAULT_ETIQUETAS_PROPONENTE };

type EtiquetasCtx = {
  etiquetas: Etiqueta[];
  etiquetasInscricao: Etiqueta[];
  etiquetasProponente: Etiqueta[];
  etiquetasMaturidadeProponente: Etiqueta[];
  loading: boolean;
  recarregar: () => Promise<void>;
};

const Ctx = createContext<EtiquetasCtx>({ etiquetas: DEFAULT_ETIQUETAS_CAPTACAO, etiquetasInscricao: DEFAULT_ETIQUETAS_INSCRICAO, etiquetasProponente: DEFAULT_ETIQUETAS_PROPONENTE, etiquetasMaturidadeProponente: DEFAULT_ETIQUETAS_MATURIDADE_PROPONENTE, loading: true, recarregar: async () => {} });

export function EtiquetasProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>(DEFAULT_ETIQUETAS_CAPTACAO);
  const [etiquetasInscricao, setEtiquetasInscricao] = useState<Etiqueta[]>(DEFAULT_ETIQUETAS_INSCRICAO);
  const [etiquetasProponente, setEtiquetasProponente] = useState<Etiqueta[]>(DEFAULT_ETIQUETAS_PROPONENTE);
  const [etiquetasMaturidadeProponente, setEtiquetasMaturidadeProponente] = useState<Etiqueta[]>(DEFAULT_ETIQUETAS_MATURIDADE_PROPONENTE);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const [{ data }, { data: removidas }] = await Promise.all([
      (supabase as any)
      .from("etiquetas")
      .select("id, entidade, key, label, cor, icone, ordem, deletavel")
      .eq("organization_id", organizationId)
      .in("entidade", ["captacao", "inscricao", "proponente", "proponente_maturidade"])
      .order("ordem"),
      (supabase as any).from("funil_etapas_removidas").select("entidade, key").eq("organization_id", organizationId),
    ]);
    // Etiquetas gravadas com o cinza antigo passam a usar o cinza firme.
    const rows = ((data ?? []) as Array<Etiqueta & { entidade: string }>).map(item => ({ ...item, cor: corDeEtiqueta(item.cor) ?? item.cor }));
    const hidden = new Set(((removidas ?? []) as Array<{ entidade: string; key: string }>).map(item => `${item.entidade}:${item.key}`));
    const captacaoRows = rows.filter(item => item.entidade === "captacao");
    const captacaoDefaultKeys = new Set(DEFAULT_ETIQUETAS_CAPTACAO.map(item => item.key));
    setEtiquetas([
      ...DEFAULT_ETIQUETAS_CAPTACAO.filter(item => !hidden.has(`captacao:${item.key}`)).map(padrao => ({ ...(captacaoRows.find(item => item.key === padrao.key) ?? padrao), deletavel: true })),
      ...captacaoRows.filter(item => !captacaoDefaultKeys.has(item.key) && !hidden.has(`captacao:${item.key}`)),
    ]);

    const inscricaoRows = rows.filter((item) => item.entidade === "inscricao");
    const inscricaoDefaultKeys = new Set(DEFAULT_ETIQUETAS_INSCRICAO.map(item => item.key));
    setEtiquetasInscricao([
      ...DEFAULT_ETIQUETAS_INSCRICAO.filter(item => !hidden.has(`inscricao:${item.key}`)).map(padrao => ({ ...(inscricaoRows.find(item => item.key === padrao.key) ?? padrao), deletavel: true })),
      ...inscricaoRows.filter(item => !inscricaoDefaultKeys.has(item.key) && !hidden.has(`inscricao:${item.key}`)),
    ]);
    const proponenteRows = rows.filter((item) => item.entidade === "proponente");
    const defaultKeys = new Set(DEFAULT_ETIQUETAS_PROPONENTE.map(item => item.key));
    setEtiquetasProponente([
      ...DEFAULT_ETIQUETAS_PROPONENTE.filter(item => !hidden.has(`proponente:${item.key}`)).map(padrao => ({ ...(proponenteRows.find(item => item.key === padrao.key) ?? padrao), deletavel: true })),
      ...proponenteRows.filter(item => !defaultKeys.has(item.key) && !hidden.has(`proponente:${item.key}`)).map(item => ({ ...item, deletavel: true })),
    ]);
    const maturidadeRows = rows.filter(item => item.entidade === "proponente_maturidade");
    const maturidadeDefaultKeys = new Set(DEFAULT_ETIQUETAS_MATURIDADE_PROPONENTE.map(item => item.key));
    setEtiquetasMaturidadeProponente([
      ...DEFAULT_ETIQUETAS_MATURIDADE_PROPONENTE.filter(item => !hidden.has(`proponente_maturidade:${item.key}`)).map(padrao => ({ ...(maturidadeRows.find(item => item.key === padrao.key) ?? padrao), deletavel: true })),
      ...maturidadeRows.filter(item => !maturidadeDefaultKeys.has(item.key) && !hidden.has(`proponente_maturidade:${item.key}`)).map(item => ({ ...item, deletavel: true })),
    ]);
    setLoading(false);
  }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { recarregar(); }, [recarregar]);

  return <Ctx.Provider value={{ etiquetas, etiquetasInscricao, etiquetasProponente, etiquetasMaturidadeProponente, loading, recarregar }}>{children}</Ctx.Provider>;
}

export function useEtiquetas() { return useContext(Ctx); }
