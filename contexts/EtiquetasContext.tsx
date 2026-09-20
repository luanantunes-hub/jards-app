"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";

export type Etiqueta = {
  id: string;
  key: string;
  label: string;
  cor: string;
  icone: string;
  ordem: number;
  deletavel: boolean;
};

type EtiquetasCtx = {
  etiquetas: Etiqueta[];
  etiquetasInscricao: Etiqueta[];
  etiquetasProponente: Etiqueta[];
  loading: boolean;
  recarregar: () => Promise<void>;
};

export const DEFAULT_ETIQUETAS_INSCRICAO: Etiqueta[] = [
  { id: "default-inscricao-interesse", key: "interesse", label: "Interesse", cor: "#888888", icone: "Lightbulb", ordem: 1, deletavel: true },
  { id: "default-inscricao-inscrito", key: "inscrito", label: "Inscrito", cor: "#2D72B0", icone: "Send", ordem: 2, deletavel: true },
  { id: "default-inscricao-em_analise", key: "em_analise", label: "Em análise", cor: "#B07A14", icone: "Clock", ordem: 3, deletavel: true },
  { id: "default-inscricao-aprovado", key: "aprovado", label: "Aprovado", cor: "#2E8932", icone: "CheckCircle", ordem: 4, deletavel: true },
  { id: "default-inscricao-reprovado", key: "reprovado", label: "Reprovado", cor: "#D94E4E", icone: "XCircle", ordem: 5, deletavel: true },
  { id: "default-inscricao-cancelado", key: "cancelado", label: "Cancelado", cor: "#666666", icone: "Ban", ordem: 6, deletavel: true },
];

export const DEFAULT_ETIQUETAS_CAPTACAO: Etiqueta[] = [
  { id: "default-captacao-prospeccao", key: "prospeccao", label: "Prospecção", cor: "#888888", icone: "Lightbulb", ordem: 1, deletavel: true },
  { id: "default-captacao-primeiro_contato", key: "primeiro_contato", label: "1º Contato", cor: "#2D72B0", icone: "MessageSquare", ordem: 2, deletavel: true },
  { id: "default-captacao-proposta_enviada", key: "proposta_enviada", label: "Proposta", cor: "#B07A14", icone: "Briefcase", ordem: 3, deletavel: true },
  { id: "default-captacao-em_negociacao", key: "em_negociacao", label: "Negociação", cor: "#B07A14", icone: "TrendingUp", ordem: 4, deletavel: true },
  { id: "default-captacao-aprovado", key: "aprovado", label: "Aprovado", cor: "#2E8932", icone: "Check", ordem: 5, deletavel: true },
  { id: "default-captacao-recusado", key: "recusado", label: "Recusado", cor: "#D94E4E", icone: "Ban", ordem: 6, deletavel: true },
  { id: "default-captacao-renovacao", key: "renovacao", label: "Renovação", cor: "#7259B5", icone: "RefreshCw", ordem: 7, deletavel: true },
];

export const DEFAULT_ETIQUETAS_PROPONENTE: Etiqueta[] = [
  { id: "default-proponente-oscip", key: "oscip", label: "OSCIP", cor: "#7259B5", icone: "Building2", ordem: 1, deletavel: true },
  { id: "default-proponente-associacao", key: "associacao", label: "Associação", cor: "#2D72B0", icone: "Users", ordem: 2, deletavel: true },
  { id: "default-proponente-empresa", key: "empresa", label: "Empresa", cor: "#1A8B7A", icone: "BriefcaseBusiness", ordem: 3, deletavel: true },
  { id: "default-proponente-pessoa_fisica", key: "pessoa_fisica", label: "Pessoa física", cor: "#B07A14", icone: "User", ordem: 4, deletavel: true },
  { id: "default-proponente-outro", key: "outro", label: "Outro", cor: "#888888", icone: "Tag", ordem: 5, deletavel: true },
];

const Ctx = createContext<EtiquetasCtx>({ etiquetas: DEFAULT_ETIQUETAS_CAPTACAO, etiquetasInscricao: DEFAULT_ETIQUETAS_INSCRICAO, etiquetasProponente: DEFAULT_ETIQUETAS_PROPONENTE, loading: true, recarregar: async () => {} });

export function EtiquetasProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>(DEFAULT_ETIQUETAS_CAPTACAO);
  const [etiquetasInscricao, setEtiquetasInscricao] = useState<Etiqueta[]>(DEFAULT_ETIQUETAS_INSCRICAO);
  const [etiquetasProponente, setEtiquetasProponente] = useState<Etiqueta[]>(DEFAULT_ETIQUETAS_PROPONENTE);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const [{ data }, { data: removidas }] = await Promise.all([
      (supabase as any)
      .from("etiquetas")
      .select("id, entidade, key, label, cor, icone, ordem, deletavel")
      .eq("organization_id", organizationId)
      .in("entidade", ["captacao", "inscricao", "proponente"])
      .order("ordem"),
      (supabase as any).from("funil_etapas_removidas").select("entidade, key").eq("organization_id", organizationId),
    ]);
    const rows = (data ?? []) as Array<Etiqueta & { entidade: string }>;
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
    setLoading(false);
  }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { recarregar(); }, [recarregar]);

  return <Ctx.Provider value={{ etiquetas, etiquetasInscricao, etiquetasProponente, loading, recarregar }}>{children}</Ctx.Provider>;
}

export function useEtiquetas() { return useContext(Ctx); }
