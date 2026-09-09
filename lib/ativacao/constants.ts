import type { StatusPlanoAtivacao } from "@/lib/supabase/types";

export const ACTIVATION_STATUS: Record<StatusPlanoAtivacao, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "rgba(13,13,13,.42)" },
  planejado: { label: "Planejado", color: "#2D72B0" },
  em_execucao: { label: "Em execução", color: "#7259B5" },
  concluido: { label: "Concluído", color: "#2E8932" },
  arquivado: { label: "Arquivado", color: "rgba(13,13,13,.32)" },
};

export const ACTIVATION_CHANNELS = [
  ["evento", "Evento"], ["conteudo", "Conteúdo"], ["redes_sociais", "Redes sociais"],
  ["imprensa", "Imprensa"], ["hospitalidade", "Hospitalidade"], ["experiencia", "Experiência"],
  ["comunicacao_interna", "Comunicação interna"], ["outro", "Outro"],
] as const;

export const ACTIVATION_BUDGET_CATEGORIES = [
  "Produção", "Mídia", "Conteúdo", "Hospitalidade", "Equipe", "Tecnologia", "Pesquisa", "Outro",
] as const;
