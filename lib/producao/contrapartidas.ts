// As contrapartidas dos patrocinadores ligadas às datas da produção (plano do módulo, PD9.1, primeiro corte): rótulos, resumo do que falta
// cumprir e a tarefa que a contrapartida vira. Sem tela e sem banco.

export type StatusDaContrapartida = "pendente" | "em_andamento" | "entregue" | "aprovado" | "atrasado" | "cancelado";

export const ROTULO_DO_STATUS_DA_CONTRAPARTIDA: Record<StatusDaContrapartida, string> = {
  pendente: "Pendente", em_andamento: "Em andamento", entregue: "Entregue", aprovado: "Aprovada", atrasado: "Atrasada", cancelado: "Cancelada",
};

const ROTULO_DA_CATEGORIA: Record<string, string> = {
  marca_comunicacao: "Marca e comunicação", hospitalidade: "Hospitalidade", relatorio: "Relatório", ativacao: "Ativação", conteudo: "Conteúdo",
  colaboradores: "Colaboradores", impacto: "Impacto", compliance: "Conformidade", financeiro: "Financeiro", outro: "Outro",
};

/** O rótulo da categoria; uma categoria que a lista não conhece aparece como veio, sem quebrar. */
export function rotuloDaCategoriaDaContrapartida(categoria: string): string {
  return ROTULO_DA_CATEGORIA[categoria] ?? categoria.replace(/_/g, " ");
}

export type ContrapartidaDaData = { id: string; titulo: string; categoria: string; prazo: string | null; status: StatusDaContrapartida };

/** As canceladas saem da conta; falta cumprir o que está pendente, em andamento ou atrasado; está cumprido o que foi entregue ou aprovado. */
export function resumoDasContrapartidas(lista: readonly Pick<ContrapartidaDaData, "status">[]): { total: number; faltam: number; cumpridas: number; atrasadas: number } {
  const vivas = lista.filter(item => item.status !== "cancelado");
  return {
    total: vivas.length,
    faltam: vivas.filter(item => item.status === "pendente" || item.status === "em_andamento" || item.status === "atrasado").length,
    cumpridas: vivas.filter(item => item.status === "entregue" || item.status === "aprovado").length,
    atrasadas: vivas.filter(item => item.status === "atrasado").length,
  };
}

/** Ordem da lista: atrasadas e pendentes primeiro (por prazo, as sem prazo no fim), depois as cumpridas, depois as canceladas. */
export function ordenarContrapartidas<T extends ContrapartidaDaData>(lista: readonly T[]): T[] {
  const peso = (status: StatusDaContrapartida) => (status === "cancelado" ? 2 : status === "entregue" || status === "aprovado" ? 1 : 0);
  return [...lista].sort((a, b) => peso(a.status) - peso(b.status) || (a.prazo ?? "9999-12-31").localeCompare(b.prazo ?? "9999-12-31") || a.titulo.localeCompare(b.titulo, "pt-BR"));
}

/** O prefixo que marca a tarefa como vinda de uma contrapartida (e deixa saber se já foi criada). */
export const PREFIXO_DA_TAREFA_DE_CONTRAPARTIDA = "Contrapartida: ";

/** A tarefa em que a contrapartida vira: o título com o prefixo (cortado nos 200 do banco) e o prazo, se houver. */
export function tarefaDaContrapartida(contrapartida: Pick<ContrapartidaDaData, "titulo" | "prazo">): { titulo: string; prazo: string | null } {
  return { titulo: `${PREFIXO_DA_TAREFA_DE_CONTRAPARTIDA}${contrapartida.titulo.trim()}`.slice(0, 200), prazo: contrapartida.prazo };
}

/** Se a tarefa já existe na data (mesmo título). */
export function jaViraTarefa(contrapartida: Pick<ContrapartidaDaData, "titulo" | "prazo">, titulosDasTarefas: readonly string[]): boolean {
  const alvo = tarefaDaContrapartida(contrapartida).titulo.trim().toLowerCase();
  return titulosDasTarefas.some(titulo => titulo.trim().toLowerCase() === alvo);
}

/** O texto para o erro que o banco devolve ao ligar ou desligar. */
export function mensagemDoErroDeContrapartida(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (mensagem.includes("sem_modulo_producao")) return "Para ligar uma contrapartida a uma data, é preciso ter a Captação e a Produção.";
  if (mensagem.includes("data_de_outra_organizacao")) return "Essa data não é desta organização.";
  if (erro.code === "42501") return "Você não pode alterar as contrapartidas desta organização.";
  return "Não foi possível salvar. Tente de novo.";
}
