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
  // Antes de documento_invalido: a busca é por trecho do código.
  tipo_de_documento_invalido: "Escolha o tipo de documento.",
  documento_invalido: "Envie o documento pela própria alteração.",
  acao_invalida: "Ação desconhecida. Atualize a página.",
  // Metas e locais (P3.1)
  no_invalido: "Escolha um agrupador do orçamento desta prestação (meta, produto ou etapa), não um item.",
  meta_de_outra_prestacao: "Escolha uma meta desta prestação.",
  local_de_outra_prestacao: "Escolha um local desta prestação.",
  prestacao_locais_justificativa: "Não realizado e realizado com outras fontes pedem justificativa.",
  prestacao_locais_brasil: "No Brasil, informe a UF e o município.",
  prestacao_locais_periodo: "O fim vem antes do início.",
  prestacao_atividades_justificativa: "Explique por que a atividade não foi realizada.",
  // Evidências (P3.2)
  atividade_de_outra_prestacao: "Escolha uma atividade desta prestação.",
  prestacao_evidencias_arquivo_ou_link: "A evidência precisa de um arquivo ou de um link.",
  // Extrato (P2.1)
  conta_inexistente: "Conta bancária não encontrada ou sem acesso.",
  extrato_invalido: "O arquivo não tem lançamentos que dê para importar (ou passa de 5 mil linhas).",
  // Extrato e evidências (P3.2): o arquivo fora da pasta dele na prestação.
  caminho_invalido: "O arquivo precisa ser enviado pela própria tela, na pasta desta prestação.",
  extrato_ja_importado: "Esse arquivo já foi importado nesta conta.",
  extrato_sem_novos: "Todos os lançamentos desse arquivo já estavam importados nesta conta.",
  // Despesas (P2.4)
  fornecedor_de_outra_organizacao: "Escolha um fornecedor desta organização.",
  prestacao_comprovantes_chave_acesso_key: "Esta chave de acesso já está em outra despesa da prestação.",
  prestacao_comprovantes_chave_acesso_check: "A chave de acesso tem 44 posições (NF-e) ou 50 (NFS-e nacional).",
  prestacao_comprovantes_retencoes_check: "As retenções passam do valor do documento.",
  prestacao_comprovantes_fornecedor_id_fkey: "O fornecedor está ligado a despesas. Troque o fornecedor nelas antes de excluir.",
  prestacao_orcamento_nos_cnaes_aceitos_check: "Há um CNAE fora do formato; escolha pela busca.",
  // Bens (P3.5)
  prestacao_orcamento_nos_bem_permanente_check: "Só um item da planilha pode ser bem permanente.",
  despesa_de_outra_prestacao: "Escolha uma despesa desta prestação.",
  cotacao_invalida: "Cada cotação precisa do fornecedor e de um valor.",
  // Peças de divulgação (P3.6)
  prestacao_pecas_periodo: "A veiculação não termina antes de começar.",
  prestacao_pecas_envio: "Informe quando a peça foi enviada para aprovação.",
  prestacao_pecas_decisao: "Aprovada ou recusada: informe a data da decisão, que não vem antes do envio.",
  // Verificações (P2.7)
  verificacao_inexistente: "Verificação não encontrada ou sem acesso. Atualize a página.",
  verificacao_resolvida: "Essa pendência já se resolveu. Atualize a página.",
  bloqueio_nao_se_justifica: "Pendência que bloqueia o envio não se justifica: resolva, ou peça ao revisor para dispensar com o motivo.",
  justificativa_obrigatoria: "Escreva o motivo (pelo menos 5 letras).",
  verificacao_falhou: "Não foi possível verificar agora. Tente de novo em instantes.",
  // Envio (bloqueio aberto impede)
  verificacao_pendente: "Rode a verificação da prestação antes de enviar (painel Verificações, na visão geral).",
  bloqueios_abertos: "Há bloqueios abertos nas verificações. Resolva cada um, ou peça ao revisor para dispensar com o motivo, e envie de novo.",
  // Envio registrado (P4.6)
  envio_vigente: "Já há um envio registrado valendo nesta etapa. Para mandar uma correção, reabra esse envio na aba Envio.",
  enviado_travado: "Isso foi enviado e está travado enquanto o envio vale. Para corrigir, reabra o envio na aba Envio.",
  enviado_guardado: "Isso foi enviado e fica guardado pelo prazo de guarda do regime: não pode ser apagado.",
  envio_imutavel: "O envio registrado não muda; só pode ser reaberto, com o motivo.",
  envio_inexistente: "Envio não encontrado ou sem acesso. Atualize a página.",
  envio_ja_reaberto: "Esse envio já foi reaberto. Atualize a página.",
  reabertura_sem_motivo: "Explique por que o envio está sendo reaberto (pelo menos 10 letras).",
  etapa_invalida: "Etapa do envio inválida. Atualize a página.",
  envio_data_invalida: "Informe a data do envio, que não pode ser futura.",
  manifesto_invalido: "O manifesto do pacote veio incompleto. Gere o pacote de novo.",
  // Depois do envio (P4.7)
  diligencia_aberta: "Há diligência aberta: registre a resposta na aba Após o envio antes de registrar o novo envio.",
  vinculo_de_outra_prestacao: "Escolha um registro desta prestação.",
  patrocinador_invalido: "Informe o patrocinador.",
  validade_invalida: "A validade vai de amanhã até um ano.",
  periodo_invalido: "O fim do período não vem antes do início.",
  mensagem_longa: "A mensagem tem até 2.000 caracteres.",
  empresa_de_outra_organizacao: "Escolha uma empresa desta organização.",
  link_inexistente: "Este link não existe mais.",
  responsavel_sem_acesso: "O responsável precisa ser da equipe, com a prestação de contas e papel que edita.",
  // Convidados (P5.3)
  email_invalido: "Informe um e-mail válido.",
  nome_invalido: "O nome tem de 2 a 200 caracteres.",
  papel_invalido: "Escolha o papel do convidado.",
  secoes_invalidas: "Escolha ao menos uma seção: financeiro, objeto ou envio.",
  ja_e_da_equipe: "Essa pessoa já é da equipe e vê a prestação sem convite.",
  convite_existente: "Já há um convite valendo para esse e-mail nesta prestação. Revogue o atual para convidar de novo.",
  convite_inexistente: "Convite não encontrado. Atualize a página.",
  convite_invalido: "Este convite não existe. Confira o endereço ou peça um novo.",
  convite_revogado: "Este convite foi revogado. Peça um novo a quem convidou.",
  convite_expirado: "Este convite venceu. Peça um novo a quem convidou.",
  email_diferente: "O convite é para outro e-mail. Saia e entre com a conta do e-mail convidado.",
  email_nao_confirmado: "Confirme seu e-mail pelo link que enviamos e abra o convite de novo.",
  sem_convite: "Seu acesso como convidado a esta prestação não vale mais.",
  fora_do_escopo: "Este item é de uma seção fora do seu convite.",
  entidade_invalida: "Item desconhecido. Atualize a página.",
  entidade_inexistente: "Este item não existe mais na prestação. Atualize a página.",
  tipo_invalido: "Ação desconhecida. Atualize a página.",
  texto_invalido: "Escreva o comentário (até 2.000 caracteres).",
  // Espaço do proponente (P5.4) e captura por e-mail (P5.5)
  arquivo_nao_enviado: "O arquivo não chegou ao armazenamento. Tente enviar de novo.",
  arquivo_ja_registrado: "Este arquivo já foi registrado. Atualize a página.",
  valor_invalido: "Informe o valor do documento.",
  data_do_documento_invalida: "Informe a data do documento, que não pode ser futura.",
  descricao_invalida: "Diga o que o documento comprova (até 500 caracteres).",
  arquivo_invalido: "Confira o nome do arquivo e o número do documento.",
  despesa_ja_avaliada: "A equipe já avaliou esta despesa; ela não pode mais ser retirada.",
  vinculo_do_proponente: "Só o admin da organização liga a conta ao cadastro do proponente.",
  remetentes_demais: "São até 20 remetentes autorizados.",
  prestacao_diligencias_resposta: "Diligência respondida pede a data da resposta.",
  prestacao_diligencias_datas: "Confira as datas: a resposta e o prazo não vêm antes do recebimento.",
  prestacao_decisoes_datas: "A ciência não vem antes do registro da decisão.",
  prestacao_recursos_decisao: "Recurso decidido pede a data da decisão.",
  prestacao_recursos_datas: "A decisão do recurso não vem antes do protocolo.",
};

export function mensagemErroPrestacao(erro: { message?: string } | null | undefined, padrao: string): string {
  const codigo = Object.keys(ERROS).find(chave => erro?.message?.includes(chave));
  return codigo ? ERROS[codigo] : `${padrao}${erro?.message ? `: ${erro.message}` : ""}`;
}
