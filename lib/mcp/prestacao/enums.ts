import { TIPOS_FISCAIS } from "@/lib/prestacao/despesas";
import { TRANSICOES } from "@/lib/prestacao/status";
import type { TipoComprovante } from "@/lib/supabase/types";

/** Os status da prestação, na ordem do fluxo: a mesma lista que o app usa (lib/prestacao/status.ts). */
export const STATUS_PRESTACAO = Object.keys(TRANSICOES) as ReadonlyArray<keyof typeof TRANSICOES>;

/** Módulo do conector que dá acesso à prestação de contas. */
export const MODULO_PRESTACAO = "prestacao";

/**
 * Papéis da equipe que usam a prestação no app (mesma regra de auth_prestacao_papel_permite no banco):
 * admin e colaborador editam, visualizador é o nome antigo de colaborador, leitor só consulta.
 * Captador e proponente são externos e ficam de fora do conector.
 */
export const PAPEIS_DA_EQUIPE_NA_PRESTACAO = ["admin", "colaborador", "visualizador", "leitor"] as const;

/** Funções que o banco aceita em organization_members.prestacao_funcao. */
export const FUNCOES_NA_PRESTACAO = ["preparador", "revisor", "responsavel"] as const;

/** O nome de cada status, como a tela mostra. */
export const STATUS_ROTULO: Record<keyof typeof TRANSICOES, string> = {
  rascunho: "Rascunho",
  revisao_interna: "Revisão interna",
  enviado: "Enviado",
  ajuste_solicitado: "Ajuste solicitado",
  aprovado: "Aprovado",
  arquivado: "Arquivado",
};

/** Documentos que o assistente pode registrar como despesa: os fiscais, mais "outro" quando não dá para saber. */
export const TIPOS_DA_DESPESA: readonly TipoComprovante[] = [...TIPOS_FISCAIS, "outro"];
