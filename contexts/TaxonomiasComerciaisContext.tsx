"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { LEI_OPTIONS } from "@/lib/constants/lei";

export type TaxonomiaCategoria = "origem" | "canal" | "resultado" | "lei";
export type TaxonomiaOpcao = {
  id: string;
  categoria: TaxonomiaCategoria;
  chave: string;
  label: string;
  cor: string;
  icone: string;
  ordem: number;
  ativo: boolean;
  padrao: boolean;
};

const DEFAULTS: Record<TaxonomiaCategoria, TaxonomiaOpcao[]> = {
  origem: [
    ["prospeccao_ativa","Prospecção ativa","#7259B5","Search"], ["indicacao","Indicação","#2E8932","Users"],
    ["edital","Edital","#2D72B0","FileText"], ["evento","Evento","#B07A14","Calendar"],
    ["inbound","Inbound","#1A8B7A","ArrowDownToLine"], ["parceiro","Parceiro","#7259B5","Handshake"],
    ["base_propria","Base própria","#666666","Database"], ["outro","Outro","#888888","MoreHorizontal"],
  ].map(([chave,label,cor,icone], index) => ({ id:`default-origem-${chave}`, categoria:"origem", chave, label, cor, icone, ordem:(index+1)*10, ativo:true, padrao:true })),
  canal: [
    ["email","E-mail","#2D72B0","Mail"], ["telefone","Telefone","#1A8B7A","Phone"],
    ["linkedin","LinkedIn","#2D72B0","Send"], ["whatsapp","WhatsApp","#2E8932","MessageCircle"],
    ["videoconferencia","Videoconferência","#7259B5","Video"], ["presencial","Presencial","#B07A14","Users"],
    ["outro","Outro","#888888","MoreHorizontal"],
  ].map(([chave,label,cor,icone], index) => ({ id:`default-canal-${chave}`, categoria:"canal", chave, label, cor, icone, ordem:(index+1)*10, ativo:true, padrao:true })),
  resultado: [
    ["sem_resposta","Sem resposta","#888888","Clock"], ["respondeu","Respondeu","#2D72B0","MessageSquare"],
    ["reuniao_agendada","Reunião agendada","#7259B5","CalendarCheck"], ["proposta_solicitada","Proposta solicitada","#B07A14","FileCheck"],
    ["avancou","Avançou","#2E8932","TrendingUp"], ["adiado","Adiado","#B07A14","Pause"],
    ["recusou","Recusou","#D94E4E","XCircle"],
  ].map(([chave,label,cor,icone], index) => ({ id:`default-resultado-${chave}`, categoria:"resultado", chave, label, cor, icone, ordem:(index+1)*10, ativo:true, padrao:true })),
  lei: LEI_OPTIONS.filter(option => option.status).map((option, index) => ({
    id: `default-lei-${option.status}`, categoria: "lei", chave: option.status,
    label: option.label, cor: option.bg, icone: option.iconName,
    ordem: (index + 1) * 10, ativo: true, padrao: true,
  })),
};

type ContextValue = {
  origens: TaxonomiaOpcao[];
  canais: TaxonomiaOpcao[];
  resultados: TaxonomiaOpcao[];
  leis: TaxonomiaOpcao[];
  loading: boolean;
  recarregar: () => Promise<void>;
};

const Context = createContext<ContextValue>({ origens: DEFAULTS.origem, canais: DEFAULTS.canal, resultados: DEFAULTS.resultado, leis: DEFAULTS.lei, loading: true, recarregar: async () => {} });

function merge(category: TaxonomiaCategoria, rows: TaxonomiaOpcao[]) {
  const remote = rows.filter(row => row.categoria === category);
  if (!remote.length) return DEFAULTS[category];
  const keys = new Set(remote.map(row => row.chave));
  return [...remote, ...DEFAULTS[category].filter(row => !keys.has(row.chave))].sort((a,b)=>a.ordem-b.ordem);
}

export function TaxonomiasComerciaisProvider({ children }: { children: React.ReactNode }) {
  const organizationId = useOrganizationId();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<TaxonomiaOpcao[]>([]);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    if (!organizationId) { setLoading(false); return; }
    const { data } = await (supabase as any).from("crm_taxonomia_opcoes")
      .select("id,categoria,chave,label,cor,icone,ordem,ativo,padrao")
      .eq("organization_id", organizationId).order("ordem");
    setRows((data ?? []) as TaxonomiaOpcao[]);
    setLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => { void recarregar(); }, [recarregar]);

  return <Context.Provider value={{
    origens: merge("origem", rows), canais: merge("canal", rows), resultados: merge("resultado", rows), leis: merge("lei", rows), loading, recarregar,
  }}>{children}</Context.Provider>;
}

export function useTaxonomiasComerciais() { return useContext(Context); }
