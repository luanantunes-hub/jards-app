// Modelos de sala: pontos de partida para o produtor não montar tudo do zero (um cinema, um teatro, uma pista), e copiar os setores e os mapas de outra sala.
// O modelo só descreve os setores; quem grava é a tela (cria os setores e, nos numerados, salva o mapa). Tudo se ajusta depois, setor a setor, em Espaços.

import { mapaDoAuditorio } from "@/lib/ticketeria/comecar";
import { totalDeLugares, type FileiraDoMapa } from "@/lib/ticketeria/mapa";

export type SetorDoModelo = { nome: string; lugares: number; numerado: boolean; /** Lugares por fileira (só nos numerados). */ porFileira?: number; corredor?: boolean };
export type ModeloDeSala = { id: string; nome: string; descricao: string; setores: readonly SetorDoModelo[] };

export const MODELOS_DE_SALA: readonly ModeloDeSala[] = [
  { id: "cinema-pequeno", nome: "Cinema pequeno", descricao: "Uma plateia numerada de 8 fileiras de 12 lugares.", setores: [{ nome: "Plateia", lugares: 96, numerado: true, porFileira: 12, corredor: true }] },
  { id: "cinema-medio", nome: "Cinema médio", descricao: "Uma plateia numerada de 12 fileiras de 15 lugares.", setores: [{ nome: "Plateia", lugares: 180, numerado: true, porFileira: 15, corredor: true }] },
  { id: "teatro", nome: "Teatro", descricao: "Plateia numerada de 10 fileiras de 20 lugares e um balcão de 4 fileiras de 20.", setores: [{ nome: "Plateia", lugares: 200, numerado: true, porFileira: 20, corredor: true }, { nome: "Balcão", lugares: 80, numerado: true, porFileira: 20, corredor: true }] },
  { id: "pista", nome: "Pista", descricao: "Uma pista de 500 lugares, sem lugar marcado.", setores: [{ nome: "Pista", lugares: 500, numerado: false }] },
];

export const modeloDeSala = (id: string): ModeloDeSala | undefined => MODELOS_DE_SALA.find(modelo => modelo.id === id);

/** O mapa de um setor numerado do modelo: fileiras A, B, C... com `porFileira` lugares cada. */
export function mapaDoSetorDoModelo(setor: SetorDoModelo): FileiraDoMapa[] {
  return mapaDoAuditorio(setor.lugares, setor.porFileira ?? 10, setor.corredor ?? true);
}

/** "Plateia 96 · Balcão 80" para a tela. */
export const resumoDoModelo = (modelo: ModeloDeSala): string => modelo.setores.map(setor => `${setor.nome} ${setor.lugares}`).join(" · ");

/** Os lugares do modelo inteiro. */
export const lugaresDoModelo = (modelo: ModeloDeSala): number => modelo.setores.reduce((soma, setor) => soma + setor.lugares, 0);

/** Confere o modelo (a soma do mapa gerado bate com os lugares do setor): usado pelo teste, para o modelo nunca sair torto. */
export const modeloCoerente = (modelo: ModeloDeSala): boolean => modelo.setores.every(setor => !setor.numerado || totalDeLugares(mapaDoSetorDoModelo(setor)) === setor.lugares);
