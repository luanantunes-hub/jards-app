// Equipamentos da casa e manutenção (plano do módulo, PD3.2): leitura do formulário com as regras do banco, a próxima
// manutenção preventiva e as pendências (o que está avariado e o que venceu). Sem tela e sem banco.

import { CATEGORIAS_DO_ITEM, ESTADOS_DO_EQUIPAMENTO, TIPOS_DE_MANUTENCAO, type CategoriaDoItem, type EstadoDoEquipamento, type TipoDeManutencao } from "@/lib/producao/estados";
import { somarDias } from "@/lib/producao/tarefas";

export const ROTULO_DO_ESTADO: Record<EstadoDoEquipamento, string> = { em_uso: "Em uso", manutencao: "Em manutenção", avariado: "Avariado", baixado: "Baixado" };
export const ROTULO_DO_TIPO_DE_MANUTENCAO: Record<TipoDeManutencao, string> = { preventiva: "Preventiva", corretiva: "Corretiva" };

export type LeituraDoEquipamento =
  | { ok: true; equipamento: { nome: string; categoria: CategoriaDoItem; quantidade: number; estado: EstadoDoEquipamento; sala_id: string | null; observacoes: string | null } }
  | { ok: false; erro: string };

/** O equipamento como o banco aceita: nome até 200, categoria e estado da lista, quantidade de 1 a 99.999, notas até 2.000. */
export function lerEquipamento(c: { nome: string; categoria: string; quantidade: string; estado: string; salaId: string; observacoes: string }): LeituraDoEquipamento {
  const nome = c.nome.trim();
  if (nome === "") return { ok: false, erro: "Informe o nome do equipamento." };
  if (nome.length > 200) return { ok: false, erro: "O nome pode ter até 200 letras." };
  if (!(CATEGORIAS_DO_ITEM as readonly string[]).includes(c.categoria)) return { ok: false, erro: "Escolha a categoria." };
  if (!(ESTADOS_DO_EQUIPAMENTO as readonly string[]).includes(c.estado)) return { ok: false, erro: "Escolha o estado." };
  const bruta = c.quantidade.trim() === "" ? "1" : c.quantidade.trim();
  if (!/^\d{1,5}$/.test(bruta) || Number(bruta) < 1) return { ok: false, erro: "A quantidade é um número inteiro de 1 a 99.999." };
  if (c.observacoes.length > 2000) return { ok: false, erro: "As observações podem ter até 2.000 letras." };
  return { ok: true, equipamento: { nome, categoria: c.categoria as CategoriaDoItem, quantidade: Number(bruta), estado: c.estado as EstadoDoEquipamento, sala_id: c.salaId === "" ? null : c.salaId, observacoes: c.observacoes.trim() === "" ? null : c.observacoes.trim() } };
}

export type LeituraDaManutencao =
  | { ok: true; manutencao: { tipo: TipoDeManutencao; descricao: string; prevista_para: string; recorrencia_dias: number | null } }
  | { ok: false; erro: string };

/** A manutenção como o banco aceita: descrição de 1 a 500, data prevista, e recorrência de 1 a 3.650 dias só na preventiva. */
export function lerManutencao(c: { tipo: string; descricao: string; prevista: string; recorrencia: string }): LeituraDaManutencao {
  if (!(TIPOS_DE_MANUTENCAO as readonly string[]).includes(c.tipo)) return { ok: false, erro: "Escolha o tipo." };
  const descricao = c.descricao.trim();
  if (descricao === "") return { ok: false, erro: "Descreva a manutenção." };
  if (descricao.length > 500) return { ok: false, erro: "A descrição pode ter até 500 letras." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.prevista)) return { ok: false, erro: "Informe a data prevista." };
  let recorrencia: number | null = null;
  if (c.recorrencia.trim() !== "") {
    if (c.tipo !== "preventiva") return { ok: false, erro: "Só a manutenção preventiva se repete." };
    if (!/^\d{1,4}$/.test(c.recorrencia.trim()) || Number(c.recorrencia) < 1 || Number(c.recorrencia) > 3650) return { ok: false, erro: "A repetição é de 1 a 3.650 dias." };
    recorrencia = Number(c.recorrencia);
  }
  return { ok: true, manutencao: { tipo: c.tipo as TipoDeManutencao, descricao, prevista_para: c.prevista, recorrencia_dias: recorrencia } };
}

/** A data da próxima preventiva de uma que se repete: a feita mais os dias. Sem recorrência, não há próxima. */
export function proximaPreventiva(feitaEm: string, recorrenciaDias: number | null): string | null {
  return recorrenciaDias === null ? null : somarDias(feitaEm, recorrenciaDias);
}

export type EquipamentoParaPendencia = { id: string; nome: string; estado: EstadoDoEquipamento };
export type ManutencaoParaPendencia = { id: string; equipamento_id: string; descricao: string; prevista_para: string; feita_em: string | null };

export type PendenciasDaCasa = {
  avariados: EquipamentoParaPendencia[];
  vencidas: (ManutencaoParaPendencia & { equipamento: string })[];
  proximas: (ManutencaoParaPendencia & { equipamento: string })[];
};

/** O que pede atenção: o avariado, a manutenção aberta que venceu e a que vence nos próximos `dias` dias (30 por padrão). O baixado não conta. */
export function pendenciasDaCasa(equipamentos: readonly EquipamentoParaPendencia[], manutencoes: readonly ManutencaoParaPendencia[], hoje: string, dias = 30): PendenciasDaCasa {
  const porId = new Map(equipamentos.map(item => [item.id, item]));
  const limite = somarDias(hoje, dias);
  const abertas = manutencoes
    .filter(item => item.feita_em === null && porId.get(item.equipamento_id) && porId.get(item.equipamento_id)?.estado !== "baixado")
    .map(item => ({ ...item, equipamento: porId.get(item.equipamento_id)?.nome ?? "" }))
    .sort((a, b) => a.prevista_para.localeCompare(b.prevista_para));
  return {
    avariados: equipamentos.filter(item => item.estado === "avariado"),
    vencidas: abertas.filter(item => item.prevista_para < hoje),
    proximas: abertas.filter(item => item.prevista_para >= hoje && item.prevista_para <= limite),
  };
}

/** O que entra na ficha: só o que está em uso (o avariado, o em manutenção e o baixado saem). */
export function equipamentosDaFicha<T extends { estado: EstadoDoEquipamento }>(equipamentos: readonly T[]): T[] {
  return equipamentos.filter(item => item.estado === "em_uso");
}
