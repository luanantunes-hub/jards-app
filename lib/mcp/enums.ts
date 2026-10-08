/**
 * Valores aceitos pelo banco (check constraints) nos registros que o conector cria. Ficam num lugar só: a spec
 * OpenAPI (o que o assistente vê) e a validação das rotas (o que o servidor aceita) leem as mesmas listas.
 */

export const TIPOS_EMPRESA = ["prospect", "cliente_ativo", "ex_cliente"] as const;

export const ORIGENS_CONTATO = ["jards", "proprio", "indicacao", "linkedin", "outro"] as const;
export const PAPEIS_DECISAO = ["decision_maker", "champion", "influencer", "gatekeeper"] as const;
export const CANAIS_PREFERIDOS = ["email", "telefone", "linkedin", "mensagem", "reuniao", "outro"] as const;

export const TIPOS_ATIVIDADE = ["email", "telefone", "linkedin", "reuniao", "evento", "outro"] as const;
export const PRIORIDADES = ["alta", "media", "baixa"] as const;

export const POTENCIAIS_FECHAMENTO = ["baixo", "medio", "alto"] as const;

export const FASES_PROJETO = ["planejamento", "captacao", "execucao", "prestacao", "concluido"] as const;
export const STATUS_COMERCIAL_PROJETO = ["estruturando", "pronto", "em_captacao", "captado", "encerrado"] as const;
export const VISIBILIDADES_PROJETO = ["equipe", "restrita"] as const;

export const TIPOS_PROPONENTE = ["oscip", "associacao", "empresa", "pessoa_fisica", "outro"] as const;

export const WORKFLOWS_FOLLOWUP = [
  "sem_resposta",
  "negociacao_esfriando",
  "novo_contato",
  "pos_reuniao",
  "retomar_futuramente",
  "revisao_parceria",
  "entrega_em_risco",
  "mapear_stakeholders",
  "preparar_renovacao",
  "oportunidade_expansao",
] as const;

export const DIRECOES_INTERACAO = ["entrada", "saida"] as const;
export const STATUS_FOLLOWUP = ["pendente", "concluido", "cancelado"] as const;

/** Papéis que o conector aceita: quem é externo (captador, proponente) só vê o próprio espaço no app. */
export const PAPEL_COM_ACESSO_AO_CRM = "admin";
/** Módulo que dá acesso ao CRM de captação. */
export const MODULO_CAPTACAO = "captacao";
