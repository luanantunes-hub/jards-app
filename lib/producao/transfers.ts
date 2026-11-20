// Os transfers sugeridos (plano do módulo, PD6.10): a partir das chegadas e saídas que a equipe respondeu no convite, agrupa quem
// chega (ou sai) em horários próximos e propõe um deslocamento para cada grupo. Sem tela e sem banco.

/** Quem chega (ou sai) até esta quantidade de minutos depois do primeiro do grupo vai na mesma condução. */
export const JANELA_DO_TRANSFER_MIN = 60;

/** Os textos que marcam o deslocamento como transfer de chegada ou de saída (para não sugerir o mesmo duas vezes). */
export const MARCADOR_DE_CHEGADA = "Chegada da equipe";
export const MARCADOR_DE_SAIDA = "Saída da equipe";

export type TipoDeTransfer = "chegada" | "saida";
export type EntradaDeTransfer = { pessoa_id: string; nome: string; dia: string | null; hora: string | null };
export type GrupoDeTransfer = { tipo: TipoDeTransfer; dia: string; de: string | null; ate: string | null; pessoas: { id: string; nome: string }[] };

const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/**
 * Agrupa as chegadas (ou saídas) por dia e por janela de horário: cada grupo começa no primeiro que chega e leva quem chega até
 * `janela` minutos depois dele. Quem não disse a hora fica num grupo à parte do dia (sem horário). Quem não disse o dia fica de fora.
 * Os grupos saem em ordem de dia e hora.
 */
export function agruparTransfers(entradas: readonly EntradaDeTransfer[], tipo: TipoDeTransfer, janela = JANELA_DO_TRANSFER_MIN): GrupoDeTransfer[] {
  const porDia = new Map<string, EntradaDeTransfer[]>();
  for (const entrada of entradas) {
    if (!entrada.dia) continue;
    porDia.set(entrada.dia, [...(porDia.get(entrada.dia) ?? []), entrada]);
  }
  const grupos: GrupoDeTransfer[] = [];
  for (const dia of [...porDia.keys()].sort()) {
    const doDia = porDia.get(dia) ?? [];
    const comHora = doDia.filter((entrada): entrada is EntradaDeTransfer & { hora: string } => Boolean(entrada.hora)).sort((a, b) => minutos(a.hora) - minutos(b.hora) || a.nome.localeCompare(b.nome, "pt-BR"));
    let atual: GrupoDeTransfer | null = null;
    let inicio = 0;
    for (const entrada of comHora) {
      if (!atual || minutos(entrada.hora) - inicio > janela) {
        atual = { tipo, dia, de: entrada.hora, ate: entrada.hora, pessoas: [] };
        inicio = minutos(entrada.hora);
        grupos.push(atual);
      }
      atual.pessoas.push({ id: entrada.pessoa_id, nome: entrada.nome });
      atual.ate = entrada.hora;
    }
    const semHora = doDia.filter(entrada => !entrada.hora).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (semHora.length > 0) grupos.push({ tipo, dia, de: null, ate: null, pessoas: semHora.map(entrada => ({ id: entrada.pessoa_id, nome: entrada.nome })) });
  }
  return grupos;
}

const diasEntre = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

/** A data da produção que recebe o transfer: a do mesmo dia; senão a mais próxima (a anterior vence o empate). Sem datas, nada. */
export function dataDoTransfer<T extends { id: string; data: string }>(dia: string, datas: readonly T[]): T | null {
  if (datas.length === 0) return null;
  return [...datas].sort((a, b) => diasEntre(a.data, dia) - diasEntre(b.data, dia) || a.data.localeCompare(b.data))[0];
}

/** O hotel do dia: o primeiro cuja entrada e saída cobrem o dia; senão o primeiro com nome (ou nenhum). */
export function hotelDoDia(dia: string, hospedagens: readonly { hotel: string; entrada: string | null; saida: string | null }[]): string | null {
  const cobre = hospedagens.find(h => h.entrada && h.entrada <= dia && (h.saida ?? h.entrada) >= dia);
  return (cobre ?? hospedagens[0])?.hotel ?? null;
}

/** Os campos do deslocamento que o grupo propõe: a chegada vai do ponto de chegada ao hotel; a saída, do hotel ao ponto de saída. */
export function camposDoTransfer(grupo: GrupoDeTransfer, hotel: string | null): { origem: string; destino: string | null; hora: string | null } {
  return grupo.tipo === "chegada"
    ? { origem: MARCADOR_DE_CHEGADA, destino: hotel, hora: grupo.de }
    : { origem: hotel ?? "Hotel", destino: MARCADOR_DE_SAIDA, hora: grupo.de };
}

type DeslocamentoDoTransfer = { id: string; origem: string | null; destino: string | null };

/** O grupo já virou deslocamento: há um transfer do mesmo tipo (pelo marcador) que leva todas as pessoas dele. */
export function transferJaCriado(grupo: GrupoDeTransfer, deslocamentos: readonly DeslocamentoDoTransfer[], passageiros: ReadonlyMap<string, readonly string[]>): boolean {
  const marcado = deslocamentos.filter(item => (grupo.tipo === "chegada" ? item.origem === MARCADOR_DE_CHEGADA : item.destino === MARCADOR_DE_SAIDA));
  return marcado.some(item => grupo.pessoas.every(pessoa => (passageiros.get(item.id) ?? []).includes(pessoa.id)));
}

const numero = (n: number) => String(n);

/** "Chegada · 22/11 · 14:30 a 15:10 · 4 pessoas". */
export function rotuloDoGrupo(grupo: GrupoDeTransfer): string {
  const [, mes, dia] = grupo.dia.split("-");
  const horas = grupo.de ? (grupo.ate && grupo.ate !== grupo.de ? `${grupo.de} a ${grupo.ate}` : grupo.de) : "sem horário";
  return `${grupo.tipo === "chegada" ? "Chegada" : "Saída"} · ${dia}/${mes} · ${horas} · ${numero(grupo.pessoas.length)} ${grupo.pessoas.length === 1 ? "pessoa" : "pessoas"}`;
}
