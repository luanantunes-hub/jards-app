/**
 * Opções comerciais que todo workspace tem antes de personalizar: de onde veio a oportunidade, por qual canal
 * se falou e qual foi o resultado do contato. Ficam fora do contexto do React para as rotas do servidor
 * (conector MCP) usarem a mesma lista que a tela. Cada linha: chave, rótulo, cor, ícone.
 */

export type TuplaTaxonomia = readonly [chave: string, label: string, cor: string, icone: string];

export const ORIGENS_PADRAO: readonly TuplaTaxonomia[] = [
    ["prospeccao_ativa","Prospecção ativa","#7259B5","Search"], ["indicacao","Indicação","#2E8932","Users"],
    ["edital","Edital","#2D72B0","FileText"], ["evento","Evento","#B07A14","Calendar"],
    ["inbound","Inbound","#1A8B7A","ArrowDownToLine"], ["parceiro","Parceiro","#7259B5","Handshake"],
    ["base_propria","Base própria","#666666","Database"], ["outro","Outro","#888888","MoreHorizontal"],
];

export const CANAIS_PADRAO: readonly TuplaTaxonomia[] = [
    ["email","E-mail","#2D72B0","Mail"], ["telefone","Telefone","#1A8B7A","Phone"],
    ["linkedin","LinkedIn","#2D72B0","Send"], ["whatsapp","WhatsApp","#2E8932","MessageCircle"],
    ["videoconferencia","Videoconferência","#7259B5","Video"], ["presencial","Presencial","#B07A14","Users"],
    ["outro","Outro","#888888","MoreHorizontal"],
];

export const RESULTADOS_PADRAO: readonly TuplaTaxonomia[] = [
    ["sem_resposta","Sem resposta","#888888","Clock"], ["respondeu","Respondeu","#2D72B0","MessageSquare"],
    ["reuniao_agendada","Reunião agendada","#7259B5","CalendarCheck"], ["proposta_solicitada","Proposta solicitada","#B07A14","FileCheck"],
    ["avancou","Avançou","#2E8932","TrendingUp"], ["adiado","Adiado","#B07A14","Pause"],
    ["recusou","Recusou","#D94E4E","XCircle"],
];
