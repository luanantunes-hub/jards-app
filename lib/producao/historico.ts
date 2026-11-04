// O histórico da data (plano do módulo, PD1.6): transforma as linhas de `producao_historico` em frases
// curtas ("Mudou a situação de opcao para confirmada"). Sem tela e sem banco.

import type { AcaoDoHistorico } from "@/lib/producao/estados";

export type LinhaDoHistorico = {
  id: number; entidade: string; acao: AcaoDoHistorico; campo: string | null; antes: string | null; depois: string | null; quando: string;
};

const COISA: Record<string, string> = {
  producao_datas: "a data",
  producao_blocos: "um bloco do dia",
  producao_escalas: "uma escala",
  producao_cartoes_dia: "um cartão de viagem ou hospedagem",
  producao_tarefas: "uma tarefa",
};

const CAMPO: Record<string, string> = {
  situacao: "a situação", data: "o dia", data_fim: "o último dia", uf: "o estado", fuso: "o fuso", titulo: "o título", tipo: "o tipo",
  inicio: "o início", fim: "o fim", exibicao: "a forma da hora", confirmado: "a confirmação", notas: "as notas", capacidade: "a capacidade",
  funcao: "a função", chamada: "a chamada", saida: "a saída", confirmacao: "a resposta", endereco: "o endereço", prazo: "o prazo",
  prazo_dias: "o prazo em dias", responsavel_pessoa_id: "quem faz", espaco_id: "o espaço", sala_id: "a sala", ordem: "a ordem",
};

export function rotuloDaEntidade(entidade: string): string {
  return COISA[entidade] ?? "um registro";
}

function valor(texto: string | null): string {
  return texto === null || texto === "" ? "vazio" : texto;
}

/** "Criou uma tarefa: Assinar o contrato", "Mudou a situação de aberta para feita", "Apagou um bloco do dia: Abertura". */
export function fraseDoHistorico(linha: Pick<LinhaDoHistorico, "entidade" | "acao" | "campo" | "antes" | "depois">): string {
  const coisa = rotuloDaEntidade(linha.entidade);
  if (linha.acao === "criou") return linha.depois ? `Criou ${coisa}: ${linha.depois}` : `Criou ${coisa}`;
  if (linha.acao === "apagou") return linha.antes ? `Apagou ${coisa}: ${linha.antes}` : `Apagou ${coisa}`;
  const campo = linha.campo ? (CAMPO[linha.campo] ?? `o campo ${linha.campo.replace(/_/g, " ")}`) : "algo";
  const onde = linha.entidade === "producao_datas" ? "" : ` em ${coisa}`;
  return `Mudou ${campo}${onde} de ${valor(linha.antes)} para ${valor(linha.depois)}`;
}
