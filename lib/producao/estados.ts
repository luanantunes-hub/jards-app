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

// Viagem e hospedagem do dia (PD1.8): o banco confere a lista num CHECK (supabase/migrations/*_producao_cartoes_dia.sql).

/** `producao_cartoes_dia.tipo`: um cartão de cada tipo por data. */
export type TipoDeCartaoDoDia = "viagem" | "hospedagem";
export const TIPOS_DE_CARTAO_DO_DIA: readonly TipoDeCartaoDoDia[] = ["viagem", "hospedagem"];

// As tarefas da produção (PD1.11): o banco confere a lista num CHECK (supabase/migrations/*_producao_tarefas.sql).

/** `producao_tarefas.situacao`: a tarefa feita guarda a hora da conclusão. */
export type SituacaoDaTarefa = "aberta" | "feita";
export const SITUACOES_DA_TAREFA: readonly SituacaoDaTarefa[] = ["aberta", "feita"];

// As pautas do espaço (PD1.5): o banco confere a lista num CHECK (supabase/migrations/*_producao_pautas.sql).

/** `producao_pautas.situacao`: consulta, pré-reserva (com fila e validade), confirmada ou cancelada. */
export type SituacaoDaPauta = "consulta" | "pre_reserva" | "confirmada" | "cancelada";
export const SITUACOES_DA_PAUTA: readonly SituacaoDaPauta[] = ["consulta", "pre_reserva", "confirmada", "cancelada"];

// O inventário da produção (PD2.1): o banco confere as listas num CHECK (supabase/migrations/*_producao_inventario.sql).

/** `producao_itens.categoria`. */
export type CategoriaDoItem = "cenario" | "figurino" | "instrumento" | "luz" | "som" | "video" | "praticavel" | "adereco" | "obra_de_arte" | "outro";
export const CATEGORIAS_DO_ITEM: readonly CategoriaDoItem[] = ["cenario", "figurino", "instrumento", "luz", "som", "video", "praticavel", "adereco", "obra_de_arte", "outro"];

/** `producao_itens.dono`: a produção, um espaço ou um fornecedor (locado). */
export type DonoDoItem = "producao" | "espaco" | "locado";
export const DONOS_DO_ITEM: readonly DonoDoItem[] = ["producao", "espaco", "locado"];

// As plantas (PD2.2): o banco confere a lista num CHECK (supabase/migrations/*_producao_plantas.sql).

/** `producao_plantas.tipo`. */
export type TipoDePlanta = "palco" | "sala" | "hospedagem" | "exposicao" | "outro";
export const TIPOS_DE_PLANTA: readonly TipoDePlanta[] = ["palco", "sala", "hospedagem", "exposicao", "outro"];

/** `producao_planta_objetos.tipo`: o que o objeto é no mapa de palco (PD2.4). */
export type TipoDeObjetoDaPlanta = "instrumento" | "praticavel" | "cenario" | "monitor" | "microfone" | "energia" | "outro";
export const TIPOS_DE_OBJETO_DA_PLANTA: readonly TipoDeObjetoDaPlanta[] = ["instrumento", "praticavel", "cenario", "monitor", "microfone", "energia", "outro"];

/** `producao_planta_objetos.fase`: a fase da energia. */
export type FaseDeEnergia = "R" | "S" | "T";
export const FASES_DE_ENERGIA: readonly FaseDeEnergia[] = ["R", "S", "T"];
