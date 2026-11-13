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

// O rider estruturado (PD2.5): o banco confere a lista num CHECK (supabase/migrations/*_producao_riders.sql).

/** `producao_rider_itens.secao`. */
export type SecaoDoRider = "palco" | "som" | "luz" | "energia" | "camarim" | "catering" | "geral";
export const SECOES_DO_RIDER: readonly SecaoDoRider[] = ["palco", "som", "luz", "energia", "camarim", "catering", "geral"];

// Os equipamentos da casa (PD3.2): o banco confere as listas num CHECK (supabase/migrations/*_producao_equipamentos.sql).

/** `producao_equipamentos.estado`. */
export type EstadoDoEquipamento = "em_uso" | "manutencao" | "avariado" | "baixado";
export const ESTADOS_DO_EQUIPAMENTO: readonly EstadoDoEquipamento[] = ["em_uso", "manutencao", "avariado", "baixado"];

// As licenças e liberações de uma data (PD4.9): o banco confere as listas num CHECK (supabase/migrations/*_producao_licencas.sql).

/** `producao_licencas.tipo`. */
export type TipoDeLicenca = "alvara" | "avcb" | "ecad" | "sbat" | "juizado_menores" | "via_publica" | "filmagem" | "outro";
export const TIPOS_DE_LICENCA: readonly TipoDeLicenca[] = ["alvara", "avcb", "ecad", "sbat", "juizado_menores", "via_publica", "filmagem", "outro"];

/** `producao_licencas.situacao`. */
export type SituacaoDaLicenca = "a_pedir" | "pedida" | "concedida" | "negada" | "dispensada";
export const SITUACOES_DA_LICENCA: readonly SituacaoDaLicenca[] = ["a_pedir", "pedida", "concedida", "negada", "dispensada"];

// O acerto técnico (PD4.1 e PD4.2): o banco confere as listas num CHECK (supabase/migrations/*_producao_acertos.sql).

/** `producao_modelos_acerto.lado` e `producao_acertos.lado`: quem preenche. */
export type LadoDoAcerto = "casa" | "companhia";
export const LADOS_DO_ACERTO: readonly LadoDoAcerto[] = ["casa", "companhia"];

/** O tipo de um campo do modelo (dentro do JSON do modelo e em `producao_acerto_itens.tipo`). */
export type TipoDeCampoDoAcerto = "texto" | "numero" | "escolha" | "sim_nao" | "data" | "hora";
export const TIPOS_DE_CAMPO_DO_ACERTO: readonly TipoDeCampoDoAcerto[] = ["texto", "numero", "escolha", "sim_nao", "data", "hora"];

/** O que a casa vê de um campo (`producao_acerto_itens.visibilidade`). */
export type VisibilidadeDoAcerto = "oculto" | "leitura" | "opcional" | "obrigatorio";
export const VISIBILIDADES_DO_ACERTO: readonly VisibilidadeDoAcerto[] = ["oculto", "leitura", "opcional", "obrigatorio"];

/** Para onde a resposta aprovada vai (`producao_acerto_itens.destino`). */
export type DestinoDoAcerto =
  | "livre" | "sala_palco_boca_m" | "sala_palco_profundidade_m" | "sala_palco_altura_m" | "sala_som_canais_entrada" | "sala_luz_refletores"
  | "sala_energia_kva" | "sala_energia_tensao_v" | "sala_camarins_quantidade" | "espaco_carga_descarga" | "espaco_doca_altura_m";
export const DESTINOS_DO_ACERTO: readonly DestinoDoAcerto[] = [
  "livre", "sala_palco_boca_m", "sala_palco_profundidade_m", "sala_palco_altura_m", "sala_som_canais_entrada", "sala_luz_refletores",
  "sala_energia_kva", "sala_energia_tensao_v", "sala_camarins_quantidade", "espaco_carga_descarga", "espaco_doca_altura_m",
];

/** `producao_acertos.situacao`. */
export type SituacaoDoAcerto = "aguardando" | "respondido" | "concluido" | "cancelado";
export const SITUACOES_DO_ACERTO: readonly SituacaoDoAcerto[] = ["aguardando", "respondido", "concluido", "cancelado"];

/** `producao_acerto_itens.situacao`. */
export type SituacaoDoItemDoAcerto = "pendente" | "respondido" | "aprovado" | "recusado";
export const SITUACOES_DO_ITEM_DO_ACERTO: readonly SituacaoDoItemDoAcerto[] = ["pendente", "respondido", "aprovado", "recusado"];

// O site público do espaço (PD12.1 e PD12.1b): o banco confere as listas num CHECK (supabase/migrations/*_producao_sites.sql).

/** `producao_sites.situacao`. */
export type SituacaoDoSite = "rascunho" | "publicado";
export const SITUACOES_DO_SITE: readonly SituacaoDoSite[] = ["rascunho", "publicado"];

/** `producao_site_dominios.situacao`: aguardando o DNS, conferindo, ativo ou com erro. */
export type SituacaoDoDominio = "aguardando" | "verificando" | "ativo" | "erro";
export const SITUACOES_DO_DOMINIO: readonly SituacaoDoDominio[] = ["aguardando", "verificando", "ativo", "erro"];

/** `producao_manutencoes.tipo`. */
export type TipoDeManutencao = "preventiva" | "corretiva";
export const TIPOS_DE_MANUTENCAO: readonly TipoDeManutencao[] = ["preventiva", "corretiva"];

// Os veículos da produção (PD6.1): o banco confere as listas num CHECK (supabase/migrations/*_producao_veiculos.sql).

/** `producao_veiculos.categoria`. */
export type CategoriaDoVeiculo = "leve" | "van" | "micro_onibus" | "onibus" | "caminhao";
export const CATEGORIAS_DO_VEICULO: readonly CategoriaDoVeiculo[] = ["leve", "van", "micro_onibus", "onibus", "caminhao"];

/** `producao_veiculos.combustivel`. */
export type CombustivelDoVeiculo = "gasolina" | "etanol" | "flex" | "diesel_s10" | "diesel_s500";
export const COMBUSTIVEIS_DO_VEICULO: readonly CombustivelDoVeiculo[] = ["gasolina", "etanol", "flex", "diesel_s10", "diesel_s500"];

/** `producao_veiculos.contratacao`. */
export type ContratacaoDoVeiculo = "proprio" | "locado" | "fretado_combustivel_incluso";
export const CONTRATACOES_DO_VEICULO: readonly ContratacaoDoVeiculo[] = ["proprio", "locado", "fretado_combustivel_incluso"];

/** `producao_veiculo_documentos.tipo`. */
export type TipoDeDocumentoDoVeiculo = "documento_do_veiculo" | "seguro" | "antt" | "vistoria" | "outro";
export const TIPOS_DE_DOCUMENTO_DO_VEICULO: readonly TipoDeDocumentoDoVeiculo[] = ["documento_do_veiculo", "seguro", "antt", "vistoria", "outro"];

// Os deslocamentos da data (PD6.2): o banco confere a lista num CHECK (supabase/migrations/*_producao_deslocamentos.sql).

/** `producao_deslocamentos.tipo`. */
export type TipoDeDeslocamento = "aviao" | "onibus" | "van" | "carro" | "caminhao" | "trem" | "balsa" | "outro";
export const TIPOS_DE_DESLOCAMENTO: readonly TipoDeDeslocamento[] = ["aviao", "onibus", "van", "carro", "caminhao", "trem", "balsa", "outro"];

// Os convites da temporada (PD6.9): o banco confere a lista num CHECK (supabase/migrations/*_producao_convites.sql).

/** `producao_convites.resposta`. */
export type RespostaDoConvite = "pendente" | "vou" | "nao_vou";
export const RESPOSTAS_DO_CONVITE: readonly RespostaDoConvite[] = ["pendente", "vou", "nao_vou"];

// O checklist de transporte (PD6.3): o banco confere as listas num CHECK (supabase/migrations/*_producao_checklist_transporte.sql).

/** `producao_checklist_itens.tipo`. */
export type TipoDoItemDoChecklist = "item" | "documento";
export const TIPOS_DO_ITEM_DO_CHECKLIST: readonly TipoDoItemDoChecklist[] = ["item", "documento"];

/** `producao_checklist_itens.saida` e `.volta`: a conferência de cada momento. */
export type SituacaoDaConferencia = "pendente" | "conferido" | "faltou" | "avariado";
export const SITUACOES_DA_CONFERENCIA: readonly SituacaoDaConferencia[] = ["pendente", "conferido", "faltou", "avariado"];

// As ocorrências do dia (PD7.8): o banco confere as listas num CHECK (supabase/migrations/*_producao_ocorrencias.sql).

/** `producao_ocorrencias.tipo`. */
export type TipoDeOcorrencia = "seguranca" | "saude" | "tecnica" | "publico" | "atraso" | "equipamento" | "outro";
export const TIPOS_DE_OCORRENCIA: readonly TipoDeOcorrencia[] = ["seguranca", "saude", "tecnica", "publico", "atraso", "equipamento", "outro"];

/** `producao_ocorrencias.gravidade`. */
export type GravidadeDaOcorrencia = "baixa" | "media" | "alta";
export const GRAVIDADES_DA_OCORRENCIA: readonly GravidadeDaOcorrencia[] = ["baixa", "media", "alta"];

// Os voluntários (PD7.11): o banco confere a lista num CHECK (supabase/migrations/*_producao_voluntarios.sql).

/** `producao_voluntarios.situacao`. */
export type SituacaoDoVoluntario = "inscrito" | "aprovado" | "recusado";
export const SITUACOES_DO_VOLUNTARIO: readonly SituacaoDoVoluntario[] = ["inscrito", "aprovado", "recusado"];

// Os convidados de uma sessão (PD7.2): o banco confere a lista num CHECK (supabase/migrations/*_producao_convidados.sql).

/** `producao_convidados.situacao`. */
export type SituacaoDoConvidado = "pedido" | "confirmado" | "recusado";
export const SITUACOES_DO_CONVIDADO: readonly SituacaoDoConvidado[] = ["pedido", "confirmado", "recusado"];

// A leitura na porta (PD7.3): o banco confere a lista num CHECK (supabase/migrations/*_producao_credenciais.sql).

/** `producao_porta_leituras.resultado`. */
export type ResultadoDaLeitura = "permitido" | "ja_entrou" | "negado";
export const RESULTADOS_DA_LEITURA: readonly ResultadoDaLeitura[] = ["permitido", "ja_entrou", "negado"];

// A acessibilidade por sessão (PD7.6): o banco confere as listas num CHECK (supabase/migrations/*_producao_acessibilidade.sql).

/** `producao_acessibilidade.tipo`. */
export type TipoDeAcessibilidade = "libras" | "audiodescricao" | "legendagem" | "lugares_reservados" | "outro";
export const TIPOS_DE_ACESSIBILIDADE: readonly TipoDeAcessibilidade[] = ["libras", "audiodescricao", "legendagem", "lugares_reservados", "outro"];

/** `producao_acessibilidade.situacao`. */
export type SituacaoDaAcessibilidade = "planejado" | "confirmado" | "cancelado";
export const SITUACOES_DA_ACESSIBILIDADE: readonly SituacaoDaAcessibilidade[] = ["planejado", "confirmado", "cancelado"];

// A visitação e os grupos (PD7.5): o banco confere a lista num CHECK (supabase/migrations/*_producao_visitacao.sql).

/** `producao_visitas_agendamentos.situacao`. */
export type SituacaoDoAgendamento = "pedido" | "confirmado" | "recusado" | "cancelado";
export const SITUACOES_DO_AGENDAMENTO: readonly SituacaoDoAgendamento[] = ["pedido", "confirmado", "recusado", "cancelado"];

// A formação (PD7.10): o banco confere as listas num CHECK (supabase/migrations/*_producao_formacao.sql).

/** `producao_turmas.situacao`. */
export type SituacaoDaTurma = "aberta" | "em_andamento" | "concluida" | "cancelada";
export const SITUACOES_DA_TURMA: readonly SituacaoDaTurma[] = ["aberta", "em_andamento", "concluida", "cancelada"];

/** `producao_matriculas.situacao`. */
export type SituacaoDaMatricula = "inscrito" | "confirmado" | "desistente";
export const SITUACOES_DA_MATRICULA: readonly SituacaoDaMatricula[] = ["inscrito", "confirmado", "desistente"];

// O mapa da plateia (PD7.7): o banco confere a lista num CHECK (supabase/migrations/*_producao_plateia.sql).

/** `producao_setor_cotas.categoria`. */
export type CategoriaDaCota = "venda" | "patrocinador" | "gratuidade" | "acessibilidade" | "imprensa" | "bloqueio";
export const CATEGORIAS_DA_COTA: readonly CategoriaDaCota[] = ["venda", "patrocinador", "gratuidade", "acessibilidade", "imprensa", "bloqueio"];

// A planta expográfica (PD8.5): o banco confere as listas num CHECK (supabase/migrations/*_producao_expografia.sql).

/** `producao_expografia.posicao`. */
export type PosicaoNaExposicao = "parede" | "piso" | "teto" | "vitrine" | "outro";
export const POSICOES_NA_EXPOSICAO: readonly PosicaoNaExposicao[] = ["parede", "piso", "teto", "vitrine", "outro"];

/** `producao_expografia.luz`. */
export type LuzDaObra = "sem_luz" | "difusa" | "pontual" | "natural" | "baixa";
export const LUZES_DA_OBRA: readonly LuzDaObra[] = ["sem_luz", "difusa", "pontual", "natural", "baixa"];

// O borderô da sessão (PD7.4): o banco confere as listas num CHECK (supabase/migrations/*_producao_bordero.sql).

/** `producao_borderos.situacao`. */
export type SituacaoDoBordero = "rascunho" | "conferido" | "fechado";
export const SITUACOES_DO_BORDERO: readonly SituacaoDoBordero[] = ["rascunho", "conferido", "fechado"];

/** `producao_bordero_deducoes.forma`. */
export type FormaDaDeducao = "percentual" | "fixo";
export const FORMAS_DA_DEDUCAO: readonly FormaDaDeducao[] = ["percentual", "fixo"];

// O acerto de contas do borderô (PD7.9): o banco confere as listas num CHECK (supabase/migrations/*_producao_bordero_acertos.sql).

/** `producao_bordero_acertos.papel`. */
export type PapelNoAcerto = "companhia" | "casa" | "patrocinador" | "outra";
export const PAPEIS_NO_ACERTO: readonly PapelNoAcerto[] = ["companhia", "casa", "patrocinador", "outra"];

/** `producao_bordero_acertos.forma`. */
export type FormaDoAcerto = "percentual" | "fixo" | "resto";
export const FORMAS_DO_ACERTO: readonly FormaDoAcerto[] = ["percentual", "fixo", "resto"];

/** `producao_bordero_acertos.situacao`. */
export type SituacaoDoAcertoDoBordero = "proposto" | "aprovado";
export const SITUACOES_DO_ACERTO_DO_BORDERO: readonly SituacaoDoAcertoDoBordero[] = ["proposto", "aprovado"];

// O orçamento vivo da temporada (PD5.1): o banco confere as listas num CHECK (supabase/migrations/*_producao_orcamento.sql).

/** `producao_orcamentos.situacao`: só anda para a frente. */
export type SituacaoDoOrcamento = "rascunho" | "aprovado" | "encerrado";
export const SITUACOES_DO_ORCAMENTO: readonly SituacaoDoOrcamento[] = ["rascunho", "aprovado", "encerrado"];

/** `producao_orcamento_linhas.categoria`. */
export type CategoriaDoOrcamento =
  | "cache" | "comissao" | "hospedagem" | "alimentacao" | "passagem" | "transporte" | "combustivel" | "frete" | "som_e_luz"
  | "cenografia" | "figurino" | "direitos" | "imposto" | "seguro" | "divulgacao" | "taxa_da_casa" | "acessibilidade" | "outros";
export const CATEGORIAS_DO_ORCAMENTO: readonly CategoriaDoOrcamento[] = [
  "cache", "comissao", "hospedagem", "alimentacao", "passagem", "transporte", "combustivel", "frete", "som_e_luz",
  "cenografia", "figurino", "direitos", "imposto", "seguro", "divulgacao", "taxa_da_casa", "acessibilidade", "outros",
];

// Os acordos da temporada (PD4.5): o banco confere as listas num CHECK (supabase/migrations/*_producao_acordos.sql).

/** `producao_acordos.tipo`. */
export type TipoDeAcordo = "cache" | "bilheteria" | "misto" | "cessao_de_espaco" | "outro";
export const TIPOS_DE_ACORDO: readonly TipoDeAcordo[] = ["cache", "bilheteria", "misto", "cessao_de_espaco", "outro"];

/** `producao_acordos.sentido`: quem paga a quem. */
export type SentidoDoAcordo = "a_pagar" | "a_receber";
export const SENTIDOS_DO_ACORDO: readonly SentidoDoAcordo[] = ["a_pagar", "a_receber"];

/** `producao_acordos.situacao`: anda um passo para a frente; assinado só vai para encerrado. */
export type SituacaoDoAcordo = "rascunho" | "revisao" | "para_assinatura" | "assinado" | "encerrado";
export const SITUACOES_DO_ACORDO: readonly SituacaoDoAcordo[] = ["rascunho", "revisao", "para_assinatura", "assinado", "encerrado"];

// As faturas ao contratante (PD5.5): o banco confere a lista num CHECK (supabase/migrations/*_producao_faturas.sql).

/** `producao_faturas.situacao`: anda um passo; em aberto só vai para quitada, e só com todas as parcelas recebidas. */
export type SituacaoDaFatura = "rascunho" | "revisao" | "em_aberto" | "quitada";
export const SITUACOES_DA_FATURA: readonly SituacaoDaFatura[] = ["rascunho", "revisao", "em_aberto", "quitada"];
