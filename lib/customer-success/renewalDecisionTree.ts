export type RenewalDecisionOutcome =
  | "pronta_para_negociar"
  | "aguardando_cliente"
  | "aguardando_orcamento"
  | "mapeando_decisao"
  | "recuperando_parceria"
  | "nutrir_outro_ciclo"
  | "encerrar_parceria";

export type RenewalDecisionOption = {
  id: string;
  label: string;
  nextNodeId?: string;
  outcome?: RenewalDecisionOutcome;
};

export type RenewalDecisionNode = {
  id: string;
  title: string;
  options: RenewalDecisionOption[];
};

export type RenewalDecisionAnswers = Record<string, string>;

export const OUTCOME_LABELS: Record<RenewalDecisionOutcome, string> = {
  pronta_para_negociar: "Pronta para negociar",
  aguardando_cliente: "Aguardando cliente",
  aguardando_orcamento: "Aguardando orçamento",
  mapeando_decisao: "Mapeando decisão",
  recuperando_parceria: "Recuperando a parceria",
  nutrir_outro_ciclo: "Nutrir para outro ciclo",
  encerrar_parceria: "Encerrar parceria",
};

export const DEFAULT_RENEWAL_DECISION_TREE: RenewalDecisionNode[] = [
  { id: "interesse", title: "Existe interesse em continuar?", options: [
    { id: "sim", label: "Sim", nextNodeId: "entregas" },
    { id: "incerto", label: "Ainda não sabemos", outcome: "aguardando_cliente" },
    { id: "nao", label: "Não", outcome: "nutrir_outro_ciclo" },
  ] },
  { id: "entregas", title: "As entregas estão satisfatórias?", options: [
    { id: "sim", label: "Sim", nextNodeId: "decisor" },
    { id: "parcial", label: "Parcialmente", outcome: "recuperando_parceria" },
    { id: "nao", label: "Não", outcome: "recuperando_parceria" },
  ] },
  { id: "decisor", title: "O decisor está envolvido?", options: [
    { id: "sim", label: "Sim", nextNodeId: "orcamento" },
    { id: "ainda_nao", label: "Ainda não", outcome: "mapeando_decisao" },
    { id: "sem_acesso", label: "Não há acesso", outcome: "mapeando_decisao" },
  ] },
  { id: "orcamento", title: "Existe orçamento ou fonte de recurso?", options: [
    { id: "confirmado", label: "Confirmado", nextNodeId: "escopo" },
    { id: "aprovacao", label: "Em aprovação", outcome: "aguardando_orcamento" },
    { id: "nao_identificado", label: "Não identificado", outcome: "aguardando_orcamento" },
    { id: "nao", label: "Não existe", outcome: "nutrir_outro_ciclo" },
  ] },
  { id: "escopo", title: "O escopo da próxima parceria está definido?", options: [
    { id: "manter", label: "Manter", nextNodeId: "prazo" },
    { id: "ampliar", label: "Ampliar", nextNodeId: "prazo" },
    { id: "reduzir", label: "Reduzir", nextNodeId: "prazo" },
    { id: "indefinido", label: "Ainda não", outcome: "aguardando_cliente" },
  ] },
  { id: "prazo", title: "Existe prazo de decisão?", options: [
    { id: "sim", label: "Sim", nextNodeId: "proximo_passo" },
    { id: "estimado", label: "Estimado", nextNodeId: "proximo_passo" },
    { id: "nao", label: "Não", outcome: "aguardando_cliente" },
  ] },
  { id: "proximo_passo", title: "Existe um próximo passo acordado?", options: [
    { id: "sim", label: "Sim", outcome: "pronta_para_negociar" },
    { id: "nao", label: "Não", outcome: "aguardando_cliente" },
    { id: "interno", label: "Cliente avaliando internamente", outcome: "aguardando_cliente" },
  ] },
];

export function cloneDecisionTree(tree: RenewalDecisionNode[]) {
  return JSON.parse(JSON.stringify(tree)) as RenewalDecisionNode[];
}

export function nextDecision(tree: RenewalDecisionNode[], nodeId: string, optionId: string) {
  const option = tree.find(node => node.id === nodeId)?.options.find(item => item.id === optionId);
  return option ? { nextNodeId: option.nextNodeId ?? null, outcome: option.outcome ?? null } : null;
}
