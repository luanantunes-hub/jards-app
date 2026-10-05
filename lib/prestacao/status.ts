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
  // Orçamento em árvore (P1.6)
  versao_ativa: "A versão ativa não pode ser excluída. Torne outra versão ativa antes.",
  use_ativar_versao: "Use “Tornar ativa” para trocar a versão ativa do orçamento.",
  versao_imutavel: "Um nó não muda de versão. Copie a versão para trabalhar numa nova.",
  orcamento_pai_invalido: "Escolha um agrupador da mesma versão: um item não fica dentro de outro item.",
  orcamento_ciclo: "Um agrupador não pode ficar dentro de algo que está abaixo dele.",
  item_com_filhos: "Esse agrupador tem nós dentro. Mova-os antes de transformá-lo em item.",
  item_com_comprovantes: "Esse item tem comprovantes ligados e não pode virar agrupador.",
  item_com_remanejamento: "Esse item tem remanejamento e não pode virar agrupador.",
  remanejamento_pela_alteracao: "O remanejado muda pelas alterações de orçamento, não pela edição do item.",
  item_invalido: "Escolha um item do orçamento desta prestação.",
  // Alterações de orçamento (P1.7)
  alteracao_fechada: "Essa alteração já foi pedida ou decidida e não pode mais ser editada.",
  use_registrar_alteracao: "Pedir, aplicar e registrar a decisão usam os botões da alteração.",
  alteracao_imutavel: "Uma alteração não muda de prestação nem de versão.",
  alteracao_sem_justificativa: "Escreva a justificativa antes de pedir ou aplicar.",
  alteracao_sem_motivo: "Informe o motivo da negativa.",
  alteracao_vazia: "A alteração não muda nenhum item.",
  alteracao_desatualizada: "O valor de algum item mudou desde que a alteração foi montada. Abra, revise os valores e salve de novo.",
  alteracao_valor_invalido: "Há um valor inválido na alteração.",
  versao_nao_ativa: "A alteração é de uma versão que não está mais em uso. Monte de novo na versão em uso.",
  documento_invalido: "Envie o documento pela própria alteração.",
  acao_invalida: "Ação desconhecida. Atualize a página.",
  // Extrato (P2.1)
  conta_inexistente: "Conta bancária não encontrada ou sem acesso.",
  extrato_invalido: "O arquivo não tem lançamentos que dê para importar (ou passa de 5 mil linhas).",
  caminho_invalido: "O arquivo do extrato precisa ser enviado pela própria tela.",
  extrato_ja_importado: "Esse arquivo já foi importado nesta conta.",
  extrato_sem_novos: "Todos os lançamentos desse arquivo já estavam importados nesta conta.",
};

export function mensagemErroPrestacao(erro: { message?: string } | null | undefined, padrao: string): string {
  const codigo = Object.keys(ERROS).find(chave => erro?.message?.includes(chave));
  return codigo ? ERROS[codigo] : `${padrao}${erro?.message ? `: ${erro.message}` : ""}`;
}
