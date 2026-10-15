// Os estados fechados do esqueleto da produção (plano do módulo, PD0.8).
//
// O banco confere estas listas num CHECK (supabase/migrations/*_producao_esqueleto.sql)
// e tests/producao-schema.test.ts garante que o SQL e este arquivo dizem a mesma
// coisa. O que muda com o catálogo, como o tipo da obra e da temporada, o formato
// e o tipo do bloco, NÃO está aqui: mora em vocabulario.ts, e um tipo novo exige
// só uma entrada lá, sem mexer no banco.

import type { TipoData } from "@/lib/producao/vocabulario";

/** Quem usa a temporada: a companhia que se desloca ou o espaço que recebe (`producao_temporadas.lado`). */
export type LadoDaTemporada = "circula" | "recebe";
export const LADOS_DA_TEMPORADA: readonly LadoDaTemporada[] = ["circula", "recebe"];

/** Como anda a temporada (`producao_temporadas.situacao`). */
export type SituacaoDaTemporada = "planejada" | "em_andamento" | "encerrada" | "cancelada";
export const SITUACOES_DA_TEMPORADA: readonly SituacaoDaTemporada[] = ["planejada", "em_andamento", "encerrada", "cancelada"];

/** A situação da data (`producao_datas.situacao`). Opção guarda a ordem na fila e o prazo; os outros estados não. */
export type SituacaoDaData = "opcao" | "confirmada" | "realizada" | "cancelada";
export const SITUACOES_DA_DATA: readonly SituacaoDaData[] = ["opcao", "confirmada", "realizada", "cancelada"];

/** Como a hora do bloco aparece (`producao_blocos.exibicao`). A hora oculta fica guardada e some das folhas. */
export type ExibicaoDoBloco = "exata" | "aproximada" | "a_definir" | "oculta";
export const EXIBICOES_DO_BLOCO: readonly ExibicaoDoBloco[] = ["exata", "aproximada", "a_definir", "oculta"];

// O tipo da data é fechado pelo plano (`producao_datas.tipo`). O tipo vem de
// vocabulario.ts e a lista sai do objeto abaixo: esquecer um valor, ou sobrar um,
// não compila.
const TIPOS_DE_DATA_POR_ID: Record<TipoData, true> = {
  apresentacao: true,
  viagem: true,
  folga: true,
  ensaio: true,
  montagem: true,
  filmagem: true,
  aula: true,
  visitacao: true,
  outro: true,
};
export const TIPOS_DE_DATA = Object.keys(TIPOS_DE_DATA_POR_ID) as TipoData[];
