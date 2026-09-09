export const DASHBOARD_MODULES = [
  { id: "kpis", label: "Indicadores principais", description: "Pipeline, previsão ponderada e conversão", defaultEnabled: true },
  { id: "priorities", label: "Prioridades do dia", description: "Pendências e ações que exigem atenção", defaultEnabled: true },
  { id: "funnel", label: "Funil comercial", description: "Distribuição das negociações por estágio", defaultEnabled: true },
  { id: "risks", label: "Negociações em risco", description: "Captações sem atividade recente", defaultEnabled: true },
  { id: "recentActivities", label: "Atividades recentes", description: "Últimas interações registradas no CRM", defaultEnabled: false },
  { id: "upcomingEvents", label: "Agenda comercial", description: "Follow-ups e editais dos próximos 30 dias", defaultEnabled: false },
  { id: "channelEffectiveness", label: "Eficácia dos canais", description: "Taxas de resposta, reunião e conversão por canal de contato", defaultEnabled: false },
] as const;

export type DashboardModuleId = (typeof DASHBOARD_MODULES)[number]["id"];

export type DashboardModulePreference = {
  id: DashboardModuleId;
  enabled: boolean;
  position: number;
};

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardModulePreference[] = DASHBOARD_MODULES.map((module, position) => ({
  id: module.id,
  enabled: module.defaultEnabled,
  position,
}));
