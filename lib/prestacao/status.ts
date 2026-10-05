// Status da prestação e quem muda o quê (P0.10).
//
// O banco decide (fn_prestacao_mudar_status e fn_prestacao_avaliar_comprovante
// em supabase/migrations/20261005140000_prestacao_status_e_papeis.sql); aqui
// fica o mesmo mapa, para a tela oferecer só o que a pessoa pode fazer e
// explicar as recusas. Um teste compara este mapa com o do banco.

import type { StatusPrestacao } from "@/lib/supabase/types";

/** O que a transição exige: editar (admin, colaborador) ou decidir (admin, responsável). */
export type AcaoPrestacao = "editar" | "avaliar" | "decidir";

export const TRANSICOES: Record<StatusPrestacao, Partial<Record<StatusPrestacao, Exclude<AcaoPrestacao, "avaliar">>>> = {
  rascunho:          { revisao_interna: "editar" },
  revisao_interna:   { enviado: "decidir", rascunho: "editar" },
  enviado:           { ajuste_solicitado: "decidir", aprovado: "decidir" },
  ajuste_solicitado: { revisao_interna: "editar" },
  aprovado:          { arquivado: "decidir" },
  arquivado:         {},
};

export type PermissoesPrestacao = Record<AcaoPrestacao, boolean>;

export const SEM_PERMISSAO: PermissoesPrestacao = { editar: false, avaliar: false, decidir: false };

/** Próximos status que a pessoa pode escolher, na ordem do mapa. */
export function proximosStatus(atual: StatusPrestacao, permissoes: PermissoesPrestacao): StatusPrestacao[] {
  return (Object.entries(TRANSICOES[atual]) as [StatusPrestacao, Exclude<AcaoPrestacao, "avaliar">][])
    .filter(([, acao]) => permissoes[acao])
    .map(([status]) => status);
}

/** Próximos status que existem, mas pedem um papel que a pessoa não tem. */
export function proximosBloqueados(atual: StatusPrestacao, permissoes: PermissoesPrestacao): StatusPrestacao[] {
  return (Object.entries(TRANSICOES[atual]) as [StatusPrestacao, Exclude<AcaoPrestacao, "avaliar">][])
    .filter(([, acao]) => !permissoes[acao])
    .map(([status]) => status);
}

const ERROS: Record<string, string> = {
  nao_autenticado: "Sua sessão expirou. Entre de novo.",
  prestacao_inexistente: "Prestação não encontrada ou sem acesso.",
  comprovante_inexistente: "Comprovante não encontrado ou sem acesso.",
  transicao_invalida: "Essa mudança de status não existe a partir do status atual. Atualize a página.",
  prazo_sem_justificativa: "Explique por que o prazo é diferente do calculado pelo regime.",
  sem_permissao: "Seu papel não permite essa ação. Enviar ao órgão e registrar a decisão cabem ao administrador ou ao responsável; aceitar comprovantes, ao administrador, revisor ou responsável.",
};

export function mensagemErroPrestacao(erro: { message?: string } | null | undefined, padrao: string): string {
  const codigo = Object.keys(ERROS).find(chave => erro?.message?.includes(chave));
  return codigo ? ERROS[codigo] : `${padrao}${erro?.message ? `: ${erro.message}` : ""}`;
}
