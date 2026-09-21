export type WorkspaceEtapa = "a_iniciar" | "em_andamento" | "aguardando_retorno";

export const WORKSPACE_ETAPAS: { id: WorkspaceEtapa; label: string }[] = [
  { id: "a_iniciar", label: "A iniciar" },
  { id: "em_andamento", label: "Em andamento" },
  { id: "aguardando_retorno", label: "Aguardando retorno" },
];

export function workspaceEtapaLabel(etapa: string | null | undefined) {
  return WORKSPACE_ETAPAS.find(item => item.id === etapa)?.label ?? WORKSPACE_ETAPAS[0].label;
}
