/**
 * Etapas e etiquetas que todo workspace tem antes de personalizar (funil de negociações, de inscrições, tipos e
 * maturidade de proponente). Fica fora do contexto do React para as rotas do servidor (conector MCP) usarem a
 * mesma lista que a tela.
 */

export type Etiqueta = {
  id: string;
  key: string;
  label: string;
  cor: string;
  icone: string;
  ordem: number;
  deletavel: boolean;
};

export const DEFAULT_ETIQUETAS_INSCRICAO: Etiqueta[] = [
  { id: "default-inscricao-interesse", key: "interesse", label: "Interesse", cor: "#888888", icone: "Lightbulb", ordem: 1, deletavel: true },
  { id: "default-inscricao-inscrito", key: "inscrito", label: "Inscrito", cor: "#2D72B0", icone: "Send", ordem: 2, deletavel: true },
  { id: "default-inscricao-em_analise", key: "em_analise", label: "Em análise", cor: "#B07A14", icone: "Clock", ordem: 3, deletavel: true },
  { id: "default-inscricao-aprovado", key: "aprovado", label: "Aprovado", cor: "#2E8932", icone: "CheckCircle", ordem: 4, deletavel: true },
  { id: "default-inscricao-reprovado", key: "reprovado", label: "Reprovado", cor: "#D94E4E", icone: "XCircle", ordem: 5, deletavel: true },
  { id: "default-inscricao-cancelado", key: "cancelado", label: "Cancelado", cor: "#666666", icone: "Ban", ordem: 6, deletavel: true },
];

export const DEFAULT_ETIQUETAS_CAPTACAO: Etiqueta[] = [
  { id: "default-captacao-prospeccao", key: "prospeccao", label: "Prospecção", cor: "#888888", icone: "Lightbulb", ordem: 1, deletavel: true },
  { id: "default-captacao-primeiro_contato", key: "primeiro_contato", label: "1º Contato", cor: "#2D72B0", icone: "MessageSquare", ordem: 2, deletavel: true },
  { id: "default-captacao-proposta_enviada", key: "proposta_enviada", label: "Proposta", cor: "#B07A14", icone: "Briefcase", ordem: 3, deletavel: true },
  { id: "default-captacao-em_negociacao", key: "em_negociacao", label: "Negociação", cor: "#B07A14", icone: "TrendingUp", ordem: 4, deletavel: true },
  { id: "default-captacao-aprovado", key: "aprovado", label: "Aprovado", cor: "#2E8932", icone: "Check", ordem: 5, deletavel: true },
  { id: "default-captacao-recusado", key: "recusado", label: "Recusado", cor: "#D94E4E", icone: "Ban", ordem: 6, deletavel: true },
  { id: "default-captacao-renovacao", key: "renovacao", label: "Renovação", cor: "#7259B5", icone: "RefreshCw", ordem: 7, deletavel: true },
];

export const DEFAULT_ETIQUETAS_PROPONENTE: Etiqueta[] = [
  { id: "default-proponente-oscip", key: "oscip", label: "OSCIP", cor: "#7259B5", icone: "Building2", ordem: 1, deletavel: true },
  { id: "default-proponente-associacao", key: "associacao", label: "Associação", cor: "#2D72B0", icone: "Users", ordem: 2, deletavel: true },
  { id: "default-proponente-empresa", key: "empresa", label: "Empresa", cor: "#1A8B7A", icone: "BriefcaseBusiness", ordem: 3, deletavel: true },
  { id: "default-proponente-pessoa_fisica", key: "pessoa_fisica", label: "Pessoa física", cor: "#B07A14", icone: "User", ordem: 4, deletavel: true },
  { id: "default-proponente-outro", key: "outro", label: "Outro", cor: "#888888", icone: "Tag", ordem: 5, deletavel: true },
];

export const DEFAULT_ETIQUETAS_MATURIDADE_PROPONENTE: Etiqueta[] = [
  { id: "default-proponente_maturidade-em_estruturacao", key: "em_estruturacao", label: "Em estruturação", cor: "#B07A14", icone: "Hammer", ordem: 1, deletavel: true },
  { id: "default-proponente_maturidade-em_desenvolvimento", key: "em_desenvolvimento", label: "Em desenvolvimento", cor: "#2D72B0", icone: "TrendingUp", ordem: 2, deletavel: true },
  { id: "default-proponente_maturidade-estruturado", key: "estruturado", label: "Estruturado", cor: "#1A8B7A", icone: "Building2", ordem: 3, deletavel: true },
  { id: "default-proponente_maturidade-consolidado", key: "consolidado", label: "Consolidado", cor: "#7259B5", icone: "Award", ordem: 4, deletavel: true },
];
