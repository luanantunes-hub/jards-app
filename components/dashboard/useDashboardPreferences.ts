"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { DASHBOARD_MODULES, DEFAULT_DASHBOARD_PREFERENCES, type DashboardModuleId, type DashboardModulePreference } from "./dashboardModules";

const STORAGE_KEY = "jards:dashboard-preferences:v1";

// Preferências salvas (localStorage ou Supabase) podem ter sido gravadas antes de um
// novo módulo existir — sem isso, o módulo novo nunca apareceria pra quem já customizou.
function reconcile(prefs: DashboardModulePreference[]): DashboardModulePreference[] {
  const known = new Set(DASHBOARD_MODULES.map((module) => module.id));
  const present = new Set(prefs.map((item) => item.id));
  const missing = DEFAULT_DASHBOARD_PREFERENCES.filter((item) => !present.has(item.id));
  return [...prefs.filter((item) => known.has(item.id)), ...missing].map((item, position) => ({ ...item, position }));
}

function readLocal(): DashboardModulePreference[] {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_PREFERENCES;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as DashboardModulePreference[] | null;
    return parsed?.length ? reconcile(parsed) : DEFAULT_DASHBOARD_PREFERENCES;
  } catch {
    return DEFAULT_DASHBOARD_PREFERENCES;
  }
}

export function useDashboardPreferences() {
  const supabase = useMemo(() => createClient(), []);
  const organizationId = useOrganizationId();
  // O primeiro render precisa ser idêntico no servidor e no navegador.
  // Preferências do localStorage só podem ser aplicadas depois da hidratação.
  const [preferences, setPreferences] = useState<DashboardModulePreference[]>(DEFAULT_DASHBOARD_PREFERENCES);

  useEffect(() => {
    setPreferences(readLocal());
  }, []);

  const persist = useCallback(async (next: DashboardModulePreference[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (!organizationId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Compatibilidade temporária: o schema manual do Supabase não infere novas relações imediatamente.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("dashboard_preferences").upsert(
      next.map((item) => ({
        user_id: user.id,
        organization_id: organizationId,
        module_id: item.id,
        enabled: item.enabled,
        position: item.position,
        settings: {},
      })),
      { onConflict: "user_id,organization_id,module_id" }
    );
  }, [organizationId, supabase]);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("dashboard_preferences")
        .select("module_id, enabled, position")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .order("position");
      if (!active || !data?.length) return;
      const remote = reconcile((data as Array<{ module_id: string; enabled: boolean; position: number }>).map((row) => ({ id: row.module_id as DashboardModuleId, enabled: row.enabled, position: row.position })));
      setPreferences(remote);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
    });
    return () => { active = false; };
  }, [organizationId, supabase]);

  const commit = useCallback((updater: (current: DashboardModulePreference[]) => DashboardModulePreference[]) => {
    setPreferences((current) => {
      const next = updater(current).map((item, position) => ({ ...item, position }));
      void persist(next);
      return next;
    });
  }, [persist]);

  return {
    preferences,
    isEnabled: (id: DashboardModuleId) => preferences.find((item) => item.id === id)?.enabled ?? false,
    toggle: (id: DashboardModuleId) => commit((current) => current.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item)),
    move: (id: DashboardModuleId, direction: -1 | 1) => commit((current) => {
      const next = [...current];
      const from = next.findIndex((item) => item.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= next.length) return current;
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    }),
    reset: () => commit(() => DEFAULT_DASHBOARD_PREFERENCES),
  };
}
