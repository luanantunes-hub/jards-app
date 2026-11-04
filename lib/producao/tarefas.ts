// As tarefas da produção (plano do módulo, PD1.11): os modelos por tipo de produção, o rótulo do prazo contado
// da data e o agrupamento por urgência. Sem tela e sem banco.

import type { SituacaoDaTarefa } from "@/lib/producao/estados";
import type { TipoProducao } from "@/lib/producao/vocabulario";

/** Uma tarefa de modelo: a chave não muda (a tarefa criada a guarda e o modelo não se repete na data). */
export type ModeloDeTarefa = { chave: string; titulo: string; dias: number; funcao: string };

const CONTRATO: ModeloDeTarefa = { chave: "contrato", titulo: "Assinar o contrato", dias: -45, funcao: "Produção" };
const HOTEL: ModeloDeTarefa = { chave: "hotel", titulo: "Confirmar o hotel e mandar a lista de quartos", dias: -15, funcao: "Produção" };
const FOLHA: ModeloDeTarefa = { chave: "folha", titulo: "Mandar a folha do dia para a equipe", dias: -2, funcao: "Produção" };
const PRESTACAO: ModeloDeTarefa = { chave: "prestacao-diaria", titulo: "Prestar contas da diária da equipe", dias: 7, funcao: "Financeiro" };

const PALCO: ModeloDeTarefa[] = [
  CONTRATO,
  { chave: "rider", titulo: "Mandar o rider técnico à casa", dias: -30, funcao: "Direção técnica" },
  { chave: "mapa-de-palco", titulo: "Conferir o mapa de palco com a ficha da sala", dias: -21, funcao: "Direção técnica" },
  HOTEL,
  FOLHA,
  { chave: "bordero", titulo: "Separar o borderô assinado", dias: 1, funcao: "Produção" },
  PRESTACAO,
];

const GERAL: ModeloDeTarefa[] = [
  CONTRATO,
  { chave: "logistica", titulo: "Fechar a logística: transporte, hospedagem e montagem", dias: -15, funcao: "Produção" },
  FOLHA,
  { chave: "relatorio", titulo: "Fechar o relatório da data", dias: 7, funcao: "Produção" },
];

const MODELOS: Partial<Record<TipoProducao, ModeloDeTarefa[]>> = {
  show: PALCO, teatro: PALCO, danca: PALCO, circo: PALCO, concerto: PALCO, opera: PALCO, rua: PALCO,
};

/** Os modelos de tarefa do tipo de produção; os tipos sem modelo próprio usam o geral. */
export function modelosDeTarefas(tipo: TipoProducao): ModeloDeTarefa[] {
  return MODELOS[tipo] ?? GERAL;
}

/** Os modelos que a data ainda não tem (a tarefa de um modelo não se repete). */
export function modelosQueFaltam(modelos: readonly ModeloDeTarefa[], jaCriados: Iterable<string | null>): ModeloDeTarefa[] {
  const criados = new Set(jaCriados);
  return modelos.filter(modelo => !criados.has(modelo.chave));
}

/** "30 dias antes", "1 dia antes", "no dia", "1 dia depois", "7 dias depois". */
export function rotuloDoPrazoRelativo(dias: number): string {
  if (dias === 0) return "no dia";
  const n = Math.abs(dias);
  return `${n} ${n === 1 ? "dia" : "dias"} ${dias < 0 ? "antes" : "depois"}`;
}

export type GrupoDaTarefa = "Atrasadas" | "Esta semana" | "Depois" | "Feitas";
export const GRUPOS_DA_TAREFA: readonly GrupoDaTarefa[] = ["Atrasadas", "Esta semana", "Depois", "Feitas"];

/** "2026-11-05" + dias → "2026-11-12". */
export function somarDias(dia: string, dias: number): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, d + dias)).toISOString().slice(0, 10);
}

/** Feita, atrasada (prazo antes de hoje), desta semana (até 7 dias) ou depois (inclui as sem prazo). */
export function grupoDaTarefa(tarefa: { situacao: SituacaoDaTarefa; prazo: string | null }, hoje: string): GrupoDaTarefa {
  if (tarefa.situacao === "feita") return "Feitas";
  if (!tarefa.prazo) return "Depois";
  if (tarefa.prazo < hoje) return "Atrasadas";
  return tarefa.prazo <= somarDias(hoje, 7) ? "Esta semana" : "Depois";
}

export type LeituraDaTarefa =
  | { ok: true; tarefa: { titulo: string; funcao: string | null } }
  | { ok: false; erro: string };

/** O título é obrigatório (até 200 letras); a função, opcional (até 80). */
export function lerTarefa(campos: { titulo: string; funcao: string }): LeituraDaTarefa {
  const titulo = campos.titulo.trim();
  if (titulo.length === 0) return { ok: false, erro: "Informe a tarefa." };
  if (titulo.length > 200) return { ok: false, erro: "A tarefa pode ter até 200 letras." };
  const funcao = campos.funcao.trim();
  if (funcao.length > 80) return { ok: false, erro: "A função pode ter até 80 letras." };
  return { ok: true, tarefa: { titulo, funcao: funcao === "" ? null : funcao } };
}
