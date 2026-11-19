"use client";

import { ArrowDown, ArrowUp, Settings2, X } from "lucide-react";
import { DASHBOARD_MODULES, type DashboardModuleId, type DashboardModulePreference } from "./dashboardModules";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: DashboardModulePreference[];
  onToggle: (id: DashboardModuleId) => void;
  onMove: (id: DashboardModuleId, direction: -1 | 1) => void;
  onReset: () => void;
};

export function DashboardCustomizer({ open, onOpenChange, preferences, onToggle, onMove, onReset }: Props) {
  const catalog = new Map(DASHBOARD_MODULES.map((module) => [module.id, module]));
  return (
    <>
      <button type="button" onClick={() => onOpenChange(true)} aria-label="Personalizar painel" title="Personalizar painel" className="group flex h-9 w-9 items-center justify-center rounded text-black/40 transition hover:text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15">
        <Settings2 size={17} strokeWidth={1.5} className="transition-[stroke-width] group-hover:stroke-[2.5]" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center veu" onMouseDown={() => onOpenChange(false)}>
          <aside className="folha-desce folha-vidro max-h-[96dvh] w-full max-w-[30rem] overflow-y-auto" onMouseDown={(event) => event.stopPropagation()}>
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-black/[.07] bg-white px-5 py-5">
              <div><p className="text-[0.625rem] font-bold uppercase tracking-[.09em] text-[#7259B5]">Visão geral</p><h2 className="mt-1 text-[1.0625rem] font-semibold text-black/80">Personalizar módulos</h2></div>
              <button type="button" onClick={() => onOpenChange(false)} className="flex h-9 w-9 items-center justify-center rounded border border-black/10 text-black/35 hover:bg-black/[.04]"><X size={15} /></button>
            </header>
            <div className="divide-y divide-black/[.06] px-5">
              {preferences.map((preference, index) => {
                const moduleDefinition = catalog.get(preference.id);
                if (!moduleDefinition) return null;
                return <div key={preference.id} className="flex items-center gap-3 py-4">
                  <button
                    type="button"
                    role="switch"
                    aria-label={`${preference.enabled ? "Desativar" : "Ativar"} ${moduleDefinition.label}`}
                    aria-checked={preference.enabled}
                    onClick={() => onToggle(preference.id)}
                    className={`relative h-6 w-11 flex-none rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${
                      preference.enabled ? "border-[#7259B5] bg-[#7259B5]" : "border-black/10 bg-black/10"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute top-0.5 z-10 block h-5 w-5 rounded-full border transition-[left] duration-200"
                      style={{
                        left: preference.enabled ? 20 : 2,
                        backgroundColor: "#FFFFFF",
                        borderColor: "rgba(13,13,13,.14)",
                        boxShadow: "0 1px 5px rgba(13,13,13,.34)",
                      }}
                    />
                  </button>
                  <div className="min-w-0 flex-1"><p className="text-[0.75rem] font-semibold text-black/70">{moduleDefinition.label}</p></div>
                  <div className="flex gap-1"><button type="button" disabled={index === 0} onClick={() => onMove(preference.id, -1)} className="flex h-8 w-8 items-center justify-center rounded border border-black/10 text-black/35 hover:bg-black/[.04] disabled:opacity-20"><ArrowUp size={12} /></button><button type="button" disabled={index === preferences.length - 1} onClick={() => onMove(preference.id, 1)} className="flex h-8 w-8 items-center justify-center rounded border border-black/10 text-black/35 hover:bg-black/[.04] disabled:opacity-20"><ArrowDown size={12} /></button></div>
                </div>;
              })}
            </div>
            <footer className="px-5 py-5"><button type="button" onClick={onReset} className="text-xs font-medium text-black/35 hover:text-black/55">Restaurar configuração padrão</button></footer>
          </aside>
        </div>
      )}
    </>
  );
}
