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

// O histórico das alterações (PD0.10): o que ele registra de um registro. O banco confere esta lista
// num CHECK de `producao_historico.acao` (supabase/migrations/*_producao_historico.sql) e
// tests/producao-historico-sql.test.ts garante que o SQL e este arquivo dizem a mesma coisa. A tabela
// de origem (`entidade`) NÃO está aqui: é aberta, e uma tabela nova da produção entra no histórico só
// com um gatilho. A PD0.9 (espaços e salas) não fecha lista nenhuma: o tipo do espaço é do catálogo.

/** `producao_historico.acao`: criou e apagou deixam uma linha só; alterou deixa uma linha por campo mudado. */
export type AcaoDoHistorico = "criou" | "alterou" | "apagou";
export const ACOES_DO_HISTORICO: readonly AcaoDoHistorico[] = ["criou", "alterou", "apagou"];

// A equipe (PD1.9 e PD1.10): o banco confere estas listas num CHECK
// (supabase/migrations/*_producao_equipe.sql) e tests/producao-equipe-sql.test.ts garante que o SQL e
// este arquivo dizem a mesma coisa. O tipo principal da pessoa NÃO está aqui: é do catálogo.

/** `producao_vinculos.situacao`. O vínculo cancelado não dá o recorte por vínculo; o previsto e o confirmado dão. */
export type SituacaoDoVinculo = "prevista" | "confirmada" | "cancelada";
export const SITUACOES_DO_VINCULO: readonly SituacaoDoVinculo[] = ["prevista", "confirmada", "cancelada"];

/** `producao_escalas.confirmacao`: a resposta da pessoa à escala da data. */
export type ConfirmacaoDaEscala = "pendente" | "confirmada" | "recusada";
export const CONFIRMACOES_DA_ESCALA: readonly ConfirmacaoDaEscala[] = ["pendente", "confirmada", "recusada"];
