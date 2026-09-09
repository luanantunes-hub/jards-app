"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { LEI_OPTIONS } from "@/lib/constants/lei";
import type { StatusDropdownCreateInput } from "@/components/ui/StatusDropdown";

type LeiRow = { id: string; chave: string; label: string; cor: string; icone: string; ativo: boolean };

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 44);
}

export function useLeiOptions() {
  const organizationId = useOrganizationId();
  const supabase = useMemo(() => createClient(), []);
  const [customRows, setCustomRows] = useState<LeiRow[]>([]);

  const reload = useCallback(async () => {
    if (!organizationId) return;
    const { data } = await (supabase as any).from("crm_taxonomia_opcoes")
      .select("id,chave,label,cor,icone,ativo")
      .eq("organization_id", organizationId).eq("categoria", "lei").order("ordem");
    setCustomRows((data ?? []) as LeiRow[]);
  }, [organizationId, supabase]);

  useEffect(() => { void reload(); }, [reload]);

  const options = useMemo(() => {
    const standardKeys = new Set(LEI_OPTIONS.map(option => option.status));
    const disabledKeys = new Set(customRows.filter(row => !row.ativo).map(row => row.chave));
    return [
      ...LEI_OPTIONS.filter(option => !option.status || !disabledKeys.has(option.status)).map(option => ({ ...option, custom: Boolean(option.status) })),
      ...customRows.filter(row => row.ativo && !standardKeys.has(row.chave)).map(row => ({ status: row.chave, label: row.label, bg: row.cor, iconName: row.icone, custom: true })),
    ];
  }, [customRows]);

  const create = useCallback(async ({ label, bg, iconName }: StatusDropdownCreateInput) => {
    if (!organizationId) return null;
    const key = `${slug(label) || "lei"}_${Date.now().toString(36)}`;
    const { data, error } = await (supabase as any).from("crm_taxonomia_opcoes").insert({
      organization_id: organizationId, categoria: "lei", chave: key, label, cor: bg, icone: iconName,
      ordem: (customRows.length + LEI_OPTIONS.length + 1) * 10, ativo: true, padrao: false,
    }).select("id,chave,label,cor,icone").single();
    if (error || !data) return null;
    setCustomRows(current => [...current, { ...(data as LeiRow), ativo: true }]);
    return key;
  }, [customRows.length, organizationId, supabase]);

  const remove = useCallback(async (status: string) => {
    if (!organizationId || !status) return;
    const standard = LEI_OPTIONS.find(option => option.status === status);
    const query = standard
      ? (supabase as any).from("crm_taxonomia_opcoes").upsert({
          organization_id: organizationId, categoria: "lei", chave: status,
          label: standard.label, cor: standard.bg, icone: standard.iconName,
          ordem: LEI_OPTIONS.findIndex(option => option.status === status) * 10,
          ativo: false, padrao: true,
        }, { onConflict: "organization_id,categoria,chave" })
      : (supabase as any).from("crm_taxonomia_opcoes").delete()
          .eq("organization_id", organizationId).eq("categoria", "lei").eq("chave", status);
    const { error } = await query;
    if (!error) await reload();
  }, [organizationId, reload, supabase]);

  return { options, create, remove };
}
