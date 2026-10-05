// Conferência do regime ANCINE IN 150 na própria IN 150/2019 (P1.11).
//
// Gerado a partir da leitura do texto oficial da IN 150 com o Anexo e dos
// formulários oficiais dela: cada regra herdada da IN 159 "a confirmar" foi
// procurada na IN 150. Confirmadas trocam a fonte; diferentes trocam a regra;
// as que só a IN 159 tem saem. Manuais, Guia do FSA, leis e normas do TCU
// valem igual; o que vem da IN 158 continua "a confirmar", porque depende da
// regra de transição dela, e o material do objeto por modalidade remete à
// IN 125/2015, que não foi lida.

import type { AjusteConferido } from "../conferencia";
import type { Fonte } from "../tipos";

const IN150 = "IN ANCINE 150/2019";

function in150(dispositivo: string, citacao?: string, nota?: string): Fonte {
  return { documento: IN150, dispositivo, ...(citacao ? { citacao } : {}), ...(nota ? { nota } : {}) };
}

export const CONFERENCIA_ANCINE_IN150_2019: readonly AjusteConferido[] = [
  { caminho: "prazos.prestacaoFinal.fonte", fonte: in150("art. 3º, caput e parágrafo único; arts. 4º e 5º", "A prestação de contas final dos projetos realizados com recursos de fomento indireto deverá ser apresentada à ANCINE em até 180 (cento e oitenta) dias da conclusão do objeto do projeto.") },
  // ausente_vale_outra_norma
  { caminho: "prazos.fimExecucaoFinanceira.fonte", fonte: { documento: "IN ANCINE 158/2021", dispositivo: "art. 57; FAQ SPR 2.10", aConfirmar: true, nota: "Vale a IN 158/2021 se a regra de transição dela alcançar o projeto; senão, a IN 125/2015, norma de aprovação que a IN 150 cita (Anexo, art. 1º, VIII)." } },
  { caminho: "prazos.respostaDiligencia.fonte", fonte: in150("art. 46, caput e §§ 1º a 3º", "terão o prazo de atendimento fixado em 30 (trinta) dias a partir da data da confirmação de seu recebimento pela proponente. […] poderá conceder prorrogação única de 30 (trinta) dias do prazo fixado no caput deste artigo.") },
  { caminho: "prazos.notificacaoOmissao.fonte", fonte: in150("art. 6º, §§ 1º e 2º", "A proponente será notificada de sua inscrição na situação de inadimplência e instada a regularizar a omissão no prazo de 30 (trinta) dias.") },
  // confirmada
  {
    caminho: "prazos.analisePrestacao.fonte",
    regra: { motivo: "A IN 150 não fixa prazo para a ANCINE analisar a prestação." },
    fonte: in150("Seção V (arts. 26 a 31); texto integral"),
  },
  // ausente_vale_outra_norma
  { caminho: "prazos.analiseAcompanhamento.fonte", fonte: { documento: "IN ANCINE 158/2021", dispositivo: "art. 3º, II e § 3º", aConfirmar: true, nota: "Vale a IN 158/2021 se a regra de transição dela alcançar o projeto; senão, a IN 125/2015, norma de aprovação que a IN 150 cita (Anexo, art. 1º, VIII)." } },
  { caminho: "prazos.recurso.fonte", fonte: in150("art. 49; art. 51", "Caberá recurso contra as decisões exaradas pela Diretoria Colegiada da ANCINE, no prazo de 30 (trinta) dias, contado da data do recebimento da notificação, sendo o mesmo recebido com efeito suspensivo.") },
  { caminho: "prazos.devolucao.fonte", fonte: in150("art. 41, caput", "Decorrido o prazo de 30 (trinta) dias da data de recebimento da Guia de Recolhimento da União - GRU e permanecendo a proponente omissa quanto ao seu recolhimento integral, apresentação de recurso ou solicitação de parcelamento") },
  // ausente_vale_outra_norma
  { caminho: "prazos.correcaoLogomarcaInfraestrutura.fonte", fonte: { documento: "IN ANCINE 130/2016, com a IN 152/2020", dispositivo: "art. 9º", nota: "A IN 150 remete à norma de logomarca (art. 43, § 3º)." } },
  { caminho: "prestacaoParcial.regras[sem_gru_nem_encerramento].fonte", fonte: in150("Anexo, art. 1º, § 2º", "A prestação de contas parcial prescinde dos documentos dos incisos IV e V.", "Na IN 150 a dispensa da parcial é o Anexo, art. 1º, § 2º.") },
  // ausente_vale_outra_norma
  { caminho: "prestacaoParcial.regras[extratos_ate_a_data].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 18, nota 3", nota: "A IN 150 só descreve os extratos da abertura ao encerramento; o recorte da parcial é do Manual." } },
  // diferente
  {
    caminho: "prestacaoParcial.regras[reanalise_na_final].fonte",
    regra: { codigo: "sem_reanalise_na_final", descricao: "Despesas e documentos da prestação parcial não são reanalisados na final." },
    fonte: in150("art. 58", "As despesas executadas e seus documentos fiscais comprobatórios da execução do projeto, integrantes da prestação de contas parcial, não serão objeto de nova análise quando da prestação de contas final."),
  },
  { caminho: "prestacaoParcial.regras[fsa_especial].fonte", fonte: in150("art. 59", "Os regramentos para prestação de contas parcial aplicam-se, subsidiariamente, à prestação de contas especial prevista nos contratos do Fundo Setorial do Audiovisual") },
  // diferente
  {
    caminho: "prestacaoParcial.fonte",
    regra: { descricao: "A ANCINE pode pedir prestação parcial conforme o regramento do projeto, com os documentos do Anexo menos os incisos IV e V; a análise parcial vai à Diretoria Colegiada, e as despesas da parcial não são reanalisadas na final." },
    fonte: in150("arts. 56 a 59; Anexo, art. 1º, § 2º", "A ANCINE poderá solicitar prestação de contas parcial baseada nas especificidades e na fase de execução de cada projeto, conforme determinado em regramento específico."),
  },
  // ausente_vale_outra_norma
  { caminho: "orcamento.estrutura.fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 12 e 60; Demonstrativo Orçamentário e Financeiro, seção IV", nota: "A IN 150 só exige o DO; a estrutura vem do Manual." } },
  // ausente_vale_outra_norma
  { caminho: "orcamento.grupos[execucao].fonte", fonte: { documento: "IN ANCINE 158/2021", dispositivo: "art. 31", aConfirmar: true, nota: "Vale a IN 158/2021 se a regra de transição dela alcançar o projeto; senão, a IN 125/2015, norma de aprovação que a IN 150 cita (Anexo, art. 1º, VIII)." } },
  // ausente_vale_outra_norma
  { caminho: "orcamento.grupos[gerenciamento].fonte", fonte: { documento: "IN ANCINE 158/2021", dispositivo: "art. 31, I", aConfirmar: true, nota: "Vale a IN 158/2021 se a regra de transição dela alcançar o projeto; senão, a IN 125/2015, norma de aprovação que a IN 150 cita (Anexo, art. 1º, VIII). A IN 150 só veda pagá-lo a radiodifusoras e afins (art. 21, XIX)." } },
  { caminho: "orcamento.grupos[agenciamento].fonte", fonte: in150("art. 21, IV, a", "para captação de recursos em mecanismos diferentes do art. 1º-A da Lei nº 8.685/93 e da Lei nº 8.313/91;", "A IN 150 só admite agenciamento nesses dois mecanismos; a definição do grupo vem da norma de aprovação.") },
  { caminho: "orcamento.grupos[colocacao].fonte", fonte: in150("art. 21, V", "ou para a captação de recursos em mecanismos diferentes do art. 1º da Lei nº 8.685/93;", "A composição (taxas, prospecto, agente divulgador) vem da norma de aprovação.") },
  // ausente_vale_outra_norma
  { caminho: "orcamento.bases.orcamento_producao.fonte", fonte: { documento: "IN ANCINE 158/2021", dispositivo: "art. 31, I", aConfirmar: true, nota: "Vale a IN 158/2021 se a regra de transição dela alcançar o projeto; senão, a IN 125/2015, norma de aprovação que a IN 150 cita (Anexo, art. 1º, VIII). A fonte não detalha o que entra no orçamento de produção; o limite também se prende ao executado com recursos ANCINE." } },
  // ausente_vale_outra_norma
  { caminho: "orcamento.bases.valor_total_projeto.fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 27–28", nota: "A IN 150 usa \"orçamento global aprovado\" (art. 14, parágrafo único) sem defini-lo como base." } },
  // ausente_vale_outra_norma
  { caminho: "orcamento.tetos[gerenciamento].fonte", fonte: { documento: "IN ANCINE 158/2021", dispositivo: "art. 31, I; Lei 11.437/2006, art. 12", aConfirmar: true, nota: "A IN 150 glosa o excesso (art. 21, VI) sem fixar percentual nem base. Vale a IN 158/2021 se a regra de transição dela alcançar o projeto; senão, a IN 125/2015, norma de aprovação que a IN 150 cita (Anexo, art. 1º, VIII). Limitado ao executado com recursos ANCINE; na coprodução internacional, só a parte brasileira. O excesso é glosado (IN 159, art. 18, VI)." } },
  // ausente_vale_outra_norma
  { caminho: "orcamento.tetos[agenciamento].fonte", fonte: { documento: "IN ANCINE 158/2021", dispositivo: "art. 31, II", aConfirmar: true, nota: "A IN 150 glosa o excesso (art. 21, VI) sem fixar percentual nem base. Vale a IN 158/2021 se a regra de transição dela alcançar o projeto; senão, a IN 125/2015, norma de aprovação que a IN 150 cita (Anexo, art. 1º, VIII). Proporcional ao captado: R$ 100 mil autorizados e R$ 80 mil captados dão teto de R$ 8 mil." } },
  // ausente_vale_outra_norma
  { caminho: "orcamento.tetos[colocacao].fonte", fonte: { documento: "IN ANCINE 158/2021", dispositivo: "art. 31, III", aConfirmar: true, nota: "A IN 150 glosa o excesso (art. 21, VI) sem fixar percentual nem base. Vale a IN 158/2021 se a regra de transição dela alcançar o projeto; senão, a IN 125/2015, norma de aprovação que a IN 150 cita (Anexo, art. 1º, VIII). Sobre o autorizado pelo art. 1º da Lei 8.685, limitado ao captado." } },
  // ausente_vale_outra_norma
  {
    caminho: "orcamento.regras[contrapartida_minima].fonte",
    regra: { descricao: "Contrapartida de ao menos 5% do orçamento global aprovado quando há mecanismo da Lei do Audiovisual." },
    fonte: { documento: "Lei 8.685/1993", dispositivo: "art. 4º, § 2º, I; IN 150, art. 2º, II, e art. 17", nota: "A alternativa de 5% das fontes brasileiras integralizadas é da IN 159 (art. 16, § 1º)." },
  },
  // diferente
  {
    caminho: "orcamento.regras[agenciamento_vedado].fonte",
    regra: { descricao: "Agenciamento glosado fora do art. 1º-A da Lei 8.685 e da Lei 8.313 e na captação em editais e outras seleções públicas (inclusive programas internacionais) ou feita por estatais." },
    fonte: in150("art. 21, IV, a e b", "para captação de recursos provenientes de editais ou qualquer outro mecanismo de seleção pública, incluindo programas internacionais com participação do Ministério da Cidadania e ANCINE, ou realizada por empresas estatais"),
  },
  { caminho: "orcamento.regras[colocacao_autorizada].fonte", fonte: in150("art. 21, V", "pagamento de Coordenação e Colocação para agentes não autorizados ou registrados na CVM") },
  { caminho: "orcamento.regras[gerenciamento_por_quem].fonte", fonte: in150("art. 21, XIX", "pagamento de serviço de gerenciamento a empresa de serviços de radiodifusão de sons e imagens, empresas de comunicação eletrônica de massa por assinatura, distribuidoras cinematográficas, de vídeo ou de programas de televisão", "A IN 150 fala em empresas de comunicação eletrônica de massa por assinatura, inclusive telefonia fixa e móvel.") },
  // ausente_vale_outra_norma
  { caminho: "alteracoes.janela.fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 27–28", nota: "A IN 150 não trata de pedidos durante a execução; vale o Manual." } },
  // ausente_vale_outra_norma
  { caminho: "alteracoes.tipos.remanejamento.condicoes[movido_ate].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 27–28", nota: "A IN 150 não fixa os 20%; trata o remanejamento irregular como ressalva (art. 29, V). Vale para projetos fora dos limites de grandes itens da IN 158 (arts. 49 e 50)." } },
  { caminho: "alteracoes.tipos.remanejamento.requisitos[tetos].fonte", fonte: in150("art. 21, VI", "pagamentos que excedam os percentuais fixados legalmente para rubricas orçamentárias, tais como o de gerenciamento e execução, agenciamento, coordenação e colocação, dentre outras;") },
  // diferente
  {
    caminho: "alteracoes.tipos.remanejamento.orientacoes[justificar_na_pc].fonte",
    regra: { descricao: "Sem dever de justificar cada alteração: remanejamento em desacordo leva a ressalva e advertência, e despesa não autorizada é glosada na análise final; o DO pede justificativa das significativas diferenças." },
    fonte: in150("art. 29, V; art. 21, XV; art. 43, § 1º, I", "despesas que tenham sido anteriormente glosadas ou não autorizadas pela ANCINE do orçamento em sede de análise de execução final e cumprimento de objeto;"),
  },
  // ausente
  { caminho: "alteracoes.tipos.remanejamento.orientacoes[aporte_nao_financeiro].fonte", remover: "Só da IN 159 (art. 18, XXXII); o art. 21 da IN 150 vai até o inciso XXXI." },
  // ausente_vale_outra_norma
  { caminho: "alteracoes.tipos.remanejamento.fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 27–28", nota: "A IN 150 só trata do remanejamento irregular como ressalva (art. 29, V)." } },
  { caminho: "alteracoes.tipos.complementacao.requisitos[tetos].fonte", fonte: in150("art. 21, VI", "pagamentos que excedam os percentuais fixados legalmente para rubricas orçamentárias, tais como o de gerenciamento e execução, agenciamento, coordenação e colocação, dentre outras;") },
  // ausente_vale_outra_norma
  { caminho: "alteracoes.tipos.complementacao.fonte", fonte: { documento: "Guia de Acompanhamento de Projetos do FSA (BRDE, jan/2025)", dispositivo: "§ 4.10; IN 158, arts. 49 e 50", aConfirmar: true, nota: "A IN 150 não regula a complementação; vale o Guia do FSA e a norma de acompanhamento. Redimensionamento do orçamento depende de aprovação prévia; o texto da IN 158 não foi lido." } },
  { caminho: "alteracoes.tipos.reducao.requisitos[tetos].fonte", fonte: in150("Anexo, art. 1º, VII; art. 21, VI", "com subsequente adaptação dos valores de contrapartida obrigatória e de remuneração pelos serviços de agenciamento e de gerenciamento e execução do projeto", "Na redução, contrapartida, agenciamento e gerenciamento acompanham o novo orçamento.") },
  // diferente
  {
    caminho: "alteracoes.tipos.reducao.fonte",
    fonte: in150("Anexo, art. 1º, VII", "solicitação de redução do orçamento global do projeto aprovado, para os valores efetivamente executados, […] para os projetos oriundos de incentivo fiscal, quando de interesse da proponente;", "No incentivo fiscal, a redução aos valores executados vai junto com a prestação, sem aprovação prévia; no FSA e no fomento direto, segue o Guia do FSA e o contrato."),
  },
  // ausente_vale_outra_norma
  { caminho: "alteracoes.tipos.inclusao.condicoes[movido_ate].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 27–28", nota: "A IN 150 não fixa os 20% para rubricas novas." } },
  { caminho: "alteracoes.tipos.inclusao.requisitos[tetos].fonte", fonte: in150("art. 21, VI", "pagamentos que excedam os percentuais fixados legalmente para rubricas orçamentárias, tais como o de gerenciamento e execução, agenciamento, coordenação e colocação, dentre outras;") },
  // diferente
  {
    caminho: "alteracoes.tipos.inclusao.orientacoes[justificar_na_pc].fonte",
    regra: { descricao: "Sem dever de justificar cada rubrica nova: despesa não autorizada é glosada na análise final, e remanejamento em desacordo leva a ressalva." },
    fonte: in150("art. 29, V; art. 21, XV; art. 43, § 1º, I", "despesas que tenham sido anteriormente glosadas ou não autorizadas pela ANCINE do orçamento em sede de análise de execução final e cumprimento de objeto;"),
  },
  // ausente_vale_outra_norma
  { caminho: "alteracoes.tipos.inclusao.fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 27–28", nota: "A IN 150 não trata da inclusão." } },
  { caminho: "alteracoes.regras[projeto_tecnico].fonte", fonte: in150("art. 29, XI; art. 43, § 1º, II, b", "efetuar alterações nos parâmetros técnicos aprovados para o produto final do projeto sem a prévia autorização da ANCINE […] b) a ocorrência do inciso XI do art. 29;") },
  // ausente_vale_outra_norma
  { caminho: "alteracoes.regras[fsa].fonte", fonte: { documento: "Guia de Acompanhamento de Projetos do FSA (BRDE, jan/2025)", dispositivo: "§ 4.10", nota: "A IN 150 não trata de alterações no FSA." } },
  // ausente_vale_outra_norma
  { caminho: "alteracoes.fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 20 e 27–28", nota: "A IN 150 não trata de prazo de análise nem de aprovação tácita de alterações." } },
  { caminho: "fornecedores.limites[concentracao].excecoes[0].fonte", fonte: in150("art. 29, VI, f; art. 43, § 1º, II, c", "exceto para projetos específicos de: […] f) animação;") },
  { caminho: "fornecedores.limites[concentracao].excecoes[1].fonte", fonte: in150("art. 29, VI, h; art. 43, § 1º, II, c", "exceto para projetos específicos de: […] h) jogos eletrônicos.") },
  // confirmada
  {
    caminho: "fornecedores.limites[concentracao].excecoes[2].fonte",
    regra: { descricao: "Produção com orçamento executado de até R$ 500 mil" },
    fonte: in150("art. 29, VI, g; art. 43, § 1º, II, c", "g) produção com orçamento executado de até R$ 500.000,00 (quinhentos mil reais);"),
  },
  // diferente
  {
    caminho: "fornecedores.limites[concentracao].fonte",
    regra: { descricao: "Concentração em um mesmo fornecedor ou grupo ligado a um mesmo sócio, sobre o total executado" },
    fonte: in150("art. 29, VI; art. 43, § 1º, I e II, c", "concentração de pagamentos de pelo menos 25% (vinte e cinco por cento) do valor total executado a um mesmo fornecedor, ou grupos de empresas vinculadas a um mesmo sócio", "A soma das RPs de todos os processos da mesma obra é da IN 159."),
  },
  // diferente
  {
    caminho: "fornecedores.partesRelacionadas.fonte",
    regra: { descricao: "Bens da proponente, do coexecutor ou do coprodutor, locados ou fornecidos, pedem 3 orçamentos de mercado e pagamento até o menor, também na doação ou comodato como contrapartida." },
    fonte: in150("art. 12 e parágrafo único; art. 18, § 3º", "de propriedade da própria proponente, do coexecutor ou do coprodutor, deverão ser acompanhados de 3 (três) orçamentos para fornecimento dos produtos ou locação de equipamentos equivalentes no mercado.", "A IN 150 não veda agenciamento pago a partes relacionadas."),
  },
  // ausente_vale_outra_norma
  { caminho: "fornecedores.regras[cnae_compativel].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 26", nota: "A IN 150 não trata; vale o Manual." } },
  { caminho: "fornecedores.regras[vinculo_com_emitente].fonte", fonte: in150("art. 21, XXVI", "documentos fiscais nos quais a pessoa natural prestadora do serviço não possua vínculo societário ou empregatício com a empresa emitente;") },
  // ausente_vale_outra_norma
  { caminho: "fornecedores.regras[agente_de_artista].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 26–27", nota: "A IN 150 não trata; vale o Manual." } },
  { caminho: "fornecedores.regras[reincidencia].fonte", fonte: in150("art. 43, § 1º, II, a", "a) a reincidência dos fatos previstos no inciso I supra;", "A IN 150 não exige que a reincidência seja em outro projeto.") },
  { caminho: "fornecedores.fonte", fonte: in150("arts. 12, 21, 29 e 43", "Serão consideradas irregulares e efetivamente glosadas, independentemente das características do projeto a elas vinculadas, as seguintes despesas:") },
  // diferente
  {
    caminho: "contas.tarifas.fonte",
    regra: { regra: "vedadas", descricao: "Tarifas bancárias de qualquer natureza são glosadas, sem a exceção da tarifa de manutenção." },
    fonte: in150("art. 21, VII", "IOC, IOF, tarifas bancárias de qualquer natureza e encargos contratuais, mesmo que decorrentes de atraso no depósito de parcela do investidor", "A exceção da manutenção entrou na IN 159 pela IN 167/2023."),
  },
  // ausente_vale_outra_norma
  { caminho: "contas.liberacao.fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 22", nota: "A IN 150 não trata da liberação; vale o Manual." } },
  // diferente
  {
    caminho: "contas.saldo.fonte",
    regra: { descricao: "Saldos das contas de movimentação e de aplicação recolhidos por GRU, com os comprovantes de encerramento das contas de movimentação." },
    fonte: in150("Anexo, art. 1º, IV e V", "comprovantes de recolhimentos dos saldos das contas-correntes de movimentação e de aplicação de recursos, quando houver, […] comprovantes de encerramento das contas-correntes de movimentação de recursos;"),
  },
  { caminho: "contas.regras[sem_outras_contas].fonte", fonte: in150("art. 21, XXX; art. 71 (IN 125, art. 56, § 2º)", "movimentadas em contas correntes não autorizadas pela ANCINE, ressalvado o previsto no art. 16; […] não poderão ser transferidos para outras contas correntes vinculadas ao projeto, ainda que previamente aprovadas.") },
  // ausente_vale_outra_norma
  { caminho: "contas.regras[creditos_permitidos].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 23", nota: "A IN 150 só trata a movimentação sem pagamento como ressalva (art. 29, IX)." } },
  // ausente_vale_outra_norma
  { caminho: "contas.regras[emprestimo_e_ressarcimento].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 25", nota: "A IN 150 não trata; vale o Manual." } },
  { caminho: "contas.regras[movimentos_sem_finalidade].fonte", fonte: in150("art. 29, IX", "movimentação de recursos nas contas abertas para a execução do projeto que não forem destinados ao pagamento de despesas do projeto, comprovadas junto à prestação de contas;") },
  // ausente_vale_outra_norma
  { caminho: "contas.regras[contas_inativas].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 18", nota: "A IN 150 não trata; vale o Manual." } },
  // diferente
  {
    caminho: "contas.fonte",
    regra: { descricao: "Contas de movimentação abertas pela ANCINE no Banco do Brasil, em nome da proponente; projetos aprovados antes da IN 150 podem manter a conta já aberta em outro banco, se autorizada." },
    fonte: in150("art. 71 (IN 125, art. 55, caput e §§ 3º e 4º; art. 73, § 3º, II e III)", "As contas de movimentação relacionadas aos mecanismos de fomento indireto e direto serão abertas pela ANCINE no Banco do Brasil, em nome da proponente […] poderá ser utilizada a conta de movimentação já aberta em outra instituição bancária conforme autorizado pela ANCINE"),
  },
  // diferente
  {
    caminho: "pagamentos.documentoFiscal[titulo_e_salic].fonte",
    regra: { descricao: "Documento com o título do projeto, a numeração na ANCINE e a discriminação do serviço ou bem; em cupom sem campo, carimbo da proponente no verso." },
    fonte: in150("art. 9º, caput e §§ 1º e 2º; art. 10, I", "o título do projeto e sua numeração junto à ANCINE poderão ser incluídos pela proponente, por meio de carimbo, no verso do documento."),
  },
  { caminho: "pagamentos.documentoFiscal[proponente_tomadora].fonte", fonte: in150("art. 21, XXI, a a c; art. 9º", "dos comprovantes de despesas da contrapartida obrigatória emitidos em nome de coexecutores, coprodutores ou distribuidores, ficando sua aceitação condicionada à apresentação de cópias dos contratos pertinentes", "A IN 150 também aceita documento em nome do coexecutor brasileiro e de terceiros no reembolso.") },
  { caminho: "pagamentos.documentoFiscal[documento_habil].fonte", fonte: in150("art. 21, XXII a XXIV", "documento fiscal irregular; […] nota fiscal fora do prazo de validade previsto no talão; […] documentos fiscais rasurados, rasgados ou com dados ilegíveis;") },
  { caminho: "pagamentos.documentoFiscal[dispensa_de_nota].fonte", fonte: in150("art. 11", "Nas hipóteses em que não for devido o recolhimento do tributo na fonte ou emissão de nota fiscal, deverá ser apresentado o recibo acompanhado da fundamentação que comprove a dispensa.") },
  { caminho: "pagamentos.documentoFiscal[rpa].fonte", fonte: in150("art. 10, II e § 2º", "quando pessoas naturais não obrigadas à emissão de nota fiscal, recibo contendo em seu corpo: […] d) data de emissão e período de execução; e […] e) número do CPF/MF do profissional.") },
  // ausente_vale_outra_norma
  { caminho: "pagamentos.documentoFiscal[tributos_na_rubrica].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 60", nota: "A IN 150 não trata; vale o Manual." } },
  // diferente
  {
    caminho: "pagamentos.documentoFiscal[exterior].fonte",
    regra: { descricao: "Serviço no exterior por contrato de câmbio que discrimine emitente, natureza, vínculo com a invoice, taxa, tributos e tarifas; invoice com o título do projeto." },
    fonte: in150("art. 15, I", "contrato de câmbio emitido por instituição financeira autorizada a funcionar pelo Banco Central do Brasil, no qual estejam discriminados: nome do emitente da fatura comercial (invoice), a natureza da operação"),
  },
  // ausente_vale_outra_norma
  { caminho: "pagamentos.documentoFiscal[arquivo_por_documento].fonte", fonte: { documento: "Manual de Envio de Documentos Fiscais – STR (04/05/2021)", dispositivo: "§§ 2 e 6", nota: "A IN 150 guarda os originais em meio físico (art. 8º); o envio digital segue o manual do STR." } },
  // diferente
  {
    caminho: "pagamentos.regras[reembolso].fonte",
    regra: { descricao: "Reembolso só para diárias, figurante até R$ 1.000 por mês, rateio de serviços internalizados, compras até R$ 1.000 cada e locação até R$ 1.000, com documentos fiscais, vínculo contratual, título do projeto e recibo até o débito.", parametros: { figuranteMes: 1000, compra: 1000, locacao: 1000 } },
    fonte: in150("art. 16, caput, I a V, e §§ 1º e 2º", "pagamento por figurante de até R$ 1.000,00 por mês; […] rateio de serviços internalizados; […] compras de até R$ 1.000,00 cada; […] despesas de até R$ 1.000,00 por locação."),
  },
  { caminho: "pagamentos.regras[real_credor].fonte", fonte: in150("art. 8º, § 3º; art. 13, parágrafo único, b", "deverão ser nominais aos credores, emissores dos documentos fiscais comprobatórios da execução da referida despesa", "A exceção do MEI vem do Manual.") },
  { caminho: "pagamentos.regras[sem_caixa].fonte", fonte: in150("art. 71 (IN 125, art. 56, §§ 1º e 3º)", "serão movimentados exclusivamente por meio eletrônico, com vedação de emissão de cheques e cartão para saques de valores em espécie.", "Caixa pequeno, cartão pré-pago e empréstimo a contas particulares estão nomeados só no Manual.") },
  // diferente
  {
    caminho: "pagamentos.regras[cartao_internacional].fonte",
    regra: { descricao: "Cartão de crédito internacional emitido no Brasil, da proponente ou de pessoa vinculada ao projeto, para pequenas despesas de manutenção de equipe no exterior; anuidade e taxas não ligadas à conversão são glosadas." },
    fonte: in150("art. 15, II; art. 21, VIII e IX", "pequenas despesas para manutenção de equipe no exterior, com pagamento em cartão de crédito internacional, emitido no Brasil, de titularidade da proponente ou de pessoa natural vinculada ao projeto"),
  },
  { caminho: "pagamentos.fonte", fonte: in150("art. 71 (IN 125, art. 56, §§ 1º e 3º)", "os recursos depositados nas contas de movimentação serão movimentados exclusivamente por meio eletrônico, com vedação de emissão de cheques", "Vale desde 1º/1/2020; TED, PIX e boleto são detalhes do Manual, e o pagamento ao exterior por câmbio está no art. 15.") },
  { caminho: "despesas.vedadas[sem_documento].fonte", fonte: in150("art. 21, I", "despesas que não apresentem o correspondente documento fiscal comprobatório;") },
  { caminho: "despesas.vedadas[duplicidade].fonte", fonte: in150("art. 21, II e III", "lançado em duplicidade ou comprovadamente apresentado na prestação de contas de outro projeto cadastrado junto à ANCINE […] despesas que comprovadamente se referem a outro projeto;") },
  { caminho: "despesas.vedadas[acima_dos_limites].fonte", fonte: in150("art. 21, VI", "pagamentos que excedam os percentuais fixados legalmente para rubricas orçamentárias, tais como o de gerenciamento e execução, agenciamento, coordenação e colocação, dentre outras;") },
  // diferente
  {
    caminho: "despesas.vedadas[juros_multas_tarifas].fonte",
    regra: { descricao: "Juros, multas, IOC, IOF, tarifas bancárias de qualquer natureza e encargos contratuais" },
    fonte: in150("art. 21, VII", "IOC, IOF, tarifas bancárias de qualquer natureza e encargos contratuais, mesmo que decorrentes de atraso no depósito de parcela do investidor"),
  },
  { caminho: "despesas.vedadas[sem_vinculo].fonte", fonte: in150("art. 21, XI", "pagamento de passagens, hospedagem e diárias na hipótese de não serem comprovados os vínculos entre o projeto e o beneficiário destas despesas;") },
  // diferente
  {
    caminho: "despesas.vedadas[auditoria].fonte",
    regra: { descricao: "Serviço de auditoria independente, salvo nos projetos do art. 5º, I, da IN ANCINE 42/2005" },
    fonte: in150("art. 21, XII", "pagamento de serviço de Auditoria Independente, exceto para os projetos enquadrados no inciso I do art. 5º da Instrução Normativa n.º 42, de 30 de agosto de 2005;"),
  },
  { caminho: "despesas.vedadas[condecine_certificados].fonte", fonte: in150("art. 21, XIII", "pagamento de CONDECINE e de despesas referentes à obtenção da Classificação Indicativa e do Certificado de Produto Brasileiro – CPB, Certificado de Registro de Título – CRT") },
  { caminho: "despesas.vedadas[rubrica_glosada].fonte", fonte: in150("art. 21, XV", "despesas que tenham sido anteriormente glosadas ou não autorizadas pela ANCINE do orçamento em sede de análise de execução final e cumprimento de objeto;") },
  { caminho: "despesas.vedadas[copias_no_exterior].fonte", fonte: in150("art. 21, XVI", "serviços de cópias e reprodução de matrizes de obras audiovisuais executadas em laboratórios instalados no exterior e que se destinem à exploração comercial no mercado brasileiro;") },
  // diferente
  {
    caminho: "despesas.vedadas[material_permanente].fonte",
    regra: { descricao: "Material permanente, salvo em infraestrutura técnica, com recibo de doação a instituição sem fins lucrativos ou pública, ou comprado para pagar credores de serviços ou locações (doação, nota e justificativa)" },
    fonte: in150("art. 21, XVII, a a c", "aquele acompanhado de recibo de doação, nota fiscal e justificativa, quando a aquisição for feita para pagamento a credores de serviços ou locações."),
  },
  { caminho: "despesas.vedadas[bebida_cigarro].fonte", fonte: in150("art. 21, XVIII", "despesas com bebidas alcoólicas ou cigarros, exceto nos casos em que estiverem caracterizadas como objeto de cena;") },
  { caminho: "despesas.vedadas[fora_dos_marcos].fonte", fonte: in150("art. 21, XX; art. 14", "executadas fora dos marcos temporais iniciais e finais estabelecidos nos respectivos regramentos;", "Marco inicial: publicação no DOU da aprovação (indireto) ou do extrato do instrumento (direto), art. 14.") },
  // confirmada
  {
    caminho: "despesas.vedadas[nao_financiavel].fonte",
    regra: { descricao: "Itens não financiáveis pela norma de aprovação do projeto ou pelo regramento de fomento direto" },
    fonte: in150("art. 21, XXVII", "despesas realizadas em itens não financiáveis, conforme definido em instrução normativa da ANCINE sobre aprovação e acompanhamento de projetos audiovisuais ou em regramento de fomento direto;", "Para projetos da IN 150, a norma de aprovação era a IN 125/2015."),
  },
  { caminho: "despesas.vedadas[contrapartida_publica].fonte", fonte: in150("art. 21, XXVIII", "despesas a título de contrapartida obrigatória executadas por meio de recursos públicos de origem municipal, estadual, distrital ou federal, bem como oriundas de aporte da parte do coprodutor estrangeiro") },
  // ausente
  { caminho: "despesas.vedadas[infraestrutura_na_producao].fonte", remover: "Só da IN 159 (art. 18, XXXV)." },
  { caminho: "despesas.vedadas[estranhas_ao_projeto].fonte", fonte: in150("art. 22, I a III", "de caráter pessoal não diretamente associadas à execução do projeto; […] pagamento de tributos cujo fato gerador seja o resultado, lucro, receita auferidos pela proponente, pelo coprodutor ou pelo coexecutor.") },
  { caminho: "despesas.vedadas[conteudo_nao_financiavel].fonte", fonte: in150("art. 71 (IN 125, art. 4º); art. 30, VI", "são vedados os objetos que não constituam espaço qualificado, nos termos do art. 2º, XII, da Lei nº 12.485/2011.") },
  // ausente_vale_outra_norma
  { caminho: "despesas.regras[aderencia_por_modalidade].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 28", nota: "A IN 150 só tem a regra geral (art. 22, II)." } },
  // ausente_vale_outra_norma
  { caminho: "despesas.regras[classe_economica].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 34–35", nota: "A IN 150 não trata; vale o Manual." } },
  // ausente_vale_outra_norma
  { caminho: "despesas.regras[diarias_so_autonomo].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 33–34", nota: "A IN 150 admite diárias sem restringir a autônomos (art. 16, I); a restrição é do Manual." } },
  { caminho: "despesas.regras[glosa_dentro_dos_20].fonte", fonte: in150("art. 21, XV; art. 22, II", "relacionadas a itens orçamentários inconsistentes com a natureza do projeto;", "A IN 150 não tem o art. 20 da IN 159 nem fala em 20%.") },
  { caminho: "despesas.fonte", fonte: in150("Seção IV, arts. 20 a 25", "Despesas irregulares, inválidas ou estranhas ao projeto serão glosadas.", "Equivalências: art. 18 da IN 159 → art. 21; art. 19 → art. 22; o art. 20 não tem par.") },
  { caminho: "porte.fonte", fonte: in150("art. 29, VI, g; art. 43, § 1º, II, c", "g) produção com orçamento executado de até R$ 500.000,00 (quinhentos mil reais);", "R$ 500 mil (inclusive) é uma das oito exceções da regra de concentração.") },
  // ausente
  { caminho: "objeto.regras[desenvolvimento].fonte", fonte: { documento: "IN ANCINE 125/2015", dispositivo: "art. 85 (remissão do Anexo, art. 1º, VIII, da IN 150)", aConfirmar: true, nota: "A IN 150 não lista o material por modalidade e remete à IN 125/2015, art. 85, cujo texto não foi conferido." } },
  // ausente
  {
    caminho: "objeto.regras[producao].fonte",
    regra: { descricao: "Produção: número do CPB; o resto do material segue a IN 125/2015." },
    fonte: in150("art. 3º, parágrafo único; Anexo, art. 1º, VIII", "Para projetos de produção de obras audiovisuais, será considerado como comprovante de conclusão do objeto o número do Certificado de Produto Brasileiro – CPB emitido para a obra.", "A IN 150 não lista o material por modalidade e remete à IN 125/2015, art. 85, cujo texto não foi conferido."),
  },
  // ausente
  { caminho: "objeto.regras[distribuicao].fonte", fonte: { documento: "IN ANCINE 125/2015", dispositivo: "art. 85 (remissão do Anexo, art. 1º, VIII, da IN 150)", aConfirmar: true, nota: "A IN 150 não lista o material por modalidade e remete à IN 125/2015, art. 85, cujo texto não foi conferido." } },
  // ausente
  { caminho: "objeto.regras[festival].fonte", fonte: { documento: "IN ANCINE 125/2015", dispositivo: "art. 85 (remissão do Anexo, art. 1º, VIII, da IN 150)", aConfirmar: true, nota: "A IN 150 não lista o material por modalidade e remete à IN 125/2015, art. 85, cujo texto não foi conferido." } },
  // diferente
  {
    caminho: "objeto.regras[infraestrutura].fonte",
    regra: { descricao: "Infraestrutura de sala: alvará, memorial do engenheiro ou arquiteto responsável e fotos antes e depois; inspeção in loco na análise." },
    fonte: in150("art. 71 (IN 125, art. 85, V e § 7º)", "b) relatório ou memorial descritivo emitido e assinado pelo engenheiro ou arquiteto responsável pela execução da obra detalhando o projeto executado;"),
  },
  // diferente
  {
    caminho: "objeto.regras[infraestrutura_tecnica].fonte",
    regra: { descricao: "Atualização tecnológica: documento fiscal, fotos do equipamento instalado e laudos da instaladora; inspeção in loco na análise." },
    fonte: in150("art. 71 (IN 125, art. 85, VI e § 7º)", "a) cópia do documento fiscal que comprove a atualização tecnológica executada;"),
  },
  // ausente
  { caminho: "objeto.regras[formacao].fonte", fonte: { documento: "IN ANCINE 125/2015", dispositivo: "art. 85 (remissão do Anexo, art. 1º, VIII, da IN 150)", aConfirmar: true, nota: "A IN 150 não lista o material por modalidade e remete à IN 125/2015, art. 85, cujo texto não foi conferido." } },
  // diferente
  {
    caminho: "objeto.regras[contrapartida_por_doacao].fonte",
    regra: { descricao: "Doação como contrapartida só em itens aprovados e até o valor aprovado do item, por proponente, coprodutor, coexecutor ou terceiro creditado; gerenciamento não cobrado não vale, e bens próprios pedem 3 orçamentos." },
    fonte: in150("art. 18, I e II, §§ 1º a 3º; art. 19", "Não será admitida doação de produtos e/ou serviços referente a itens orçamentários não aprovados para o projeto ou que extrapole o valor aprovado para o item a que se refere."),
  },
  // ausente
  { caminho: "objeto.regras[contrapartida_nao_compensa].fonte", remover: "Só da IN 159 (art. 21, parágrafo único)." },
  // diferente
  {
    caminho: "objeto.regras[deposito_legal].fonte",
    regra: { descricao: "Na produção, o comprovante do depósito legal na Cinemateca (com legendagem, legendagem descritiva, LIBRAS e audiodescrição) vai com o material do objeto; omissão ou reprovação: 30 dias para GRU, parcelamento ou recurso com nova cópia." },
    fonte: in150("art. 71 (IN 125, art. 128-A, §§ 1º a 5º)", "comprovante de entrega da cópia final de depósito legal na Cinemateca Brasileira ou em instituição credenciada pela ANCINE", "Multa de R$ 2 mil a R$ 50 mil pela IN 109/2012, art. 26."),
  },
  // ausente_vale_outra_norma
  { caminho: "objeto.regras[prazo_do_objeto].fonte", fonte: { documento: "IN ANCINE 158/2021", dispositivo: "art. 53", aConfirmar: true, nota: "Vale a IN 158/2021 se a regra de transição dela alcançar o projeto; senão, a IN 125/2015, norma de aprovação que a IN 150 cita (Anexo, art. 1º, VIII)." } },
  // ausente
  {
    caminho: "objeto.fonte",
    regra: { descricao: "Material de cumprimento do objeto e da finalidade conforme a IN 125/2015; infraestrutura de sala e técnica pelo art. 85, V e VI, da IN 125, na redação da IN 150; na produção, o número do CPB conclui o objeto." },
    fonte: in150("Anexo, art. 1º, VIII; art. 71; art. 3º, parágrafo único", "material comprobatório de cumprimento do objeto e finalidade, conforme previsto na Instrução Normativa n.º 125, de 22 de dezembro de 2015.", "A lista por modalidade da IN 125, art. 85, não foi conferida."),
  },
  // ausente_vale_outra_norma
  { caminho: "divulgacao.aprovacaoPrevia.fonte", fonte: { documento: "Manual de Aplicação da Logomarca v3.0 (24/08/2022)", dispositivo: "aprovação prévia", nota: "A IN 150 não trata; vale o manual da logomarca." } },
  // ausente_vale_outra_norma
  { caminho: "divulgacao.regras[onde_aplicar].fonte", fonte: { documento: "IN ANCINE 130/2016, com a IN 152/2020", dispositivo: "art. 4º (red. IN 152/2020)", nota: "A IN 150 remete à norma de logomarca (art. 29, XII), na redação vigente na data." } },
  // ausente_vale_outra_norma
  { caminho: "divulgacao.regras[bandeira].fonte", fonte: { documento: "Lei 5.700/1971", dispositivo: "art. 3º-A; IN 152/2020", nota: "A IN 150 não trata; vale a lei, conforme a vigência na data da peça." } },
  // ausente_vale_outra_norma
  { caminho: "divulgacao.regras[cartela_ancine].fonte", fonte: { documento: "Manual de Aplicação da Logomarca v3.0 (24/08/2022)", dispositivo: "créditos", nota: "A IN 150 não trata; vale o manual da logomarca." } },
  // ausente_vale_outra_norma
  { caminho: "divulgacao.regras[ordem_e_visibilidade].fonte", fonte: { documento: "Manual de Aplicação da Logomarca v3.0 (24/08/2022)", dispositivo: "conjunto, visibilidade e cor", nota: "A IN 150 não trata; vale o manual da logomarca." } },
  // ausente_vale_outra_norma
  { caminho: "divulgacao.regras[placa_infraestrutura].fonte", fonte: { documento: "Manual de Aplicação da Logomarca v3.0 (24/08/2022)", dispositivo: "placa de infraestrutura", nota: "A IN 150 não trata; vale o manual da logomarca." } },
  // ausente_vale_outra_norma
  { caminho: "divulgacao.regras[sancoes].fonte", fonte: { documento: "IN ANCINE 130/2016, com a IN 152/2020", dispositivo: "art. 6º", nota: "A IN 150 remete à norma de logomarca (art. 43, § 3º; art. 32, III)." } },
  { caminho: "divulgacao.regras[ressalva_e_debito].fonte", fonte: in150("art. 29, XII; art. 32, III", "não aplicação da(s) logomarca(s) obrigatória(s) pela utilização dos recursos federais, conforme estipulado nas normas aplicáveis da ANCINE ou do Agente Financeiro;") },
  // ausente_vale_outra_norma
  { caminho: "divulgacao.regras[defeso_nao_tratado].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "parte B.8 da conferência", nota: "A IN 150 também não trata do defeso." } },
  // ausente_vale_outra_norma
  { caminho: "divulgacao.fonte", fonte: { documento: "IN ANCINE 130/2016, com a IN 152/2020", dispositivo: "arts. 2º a 6º; Manual de Aplicação da Logomarca v3.0", nota: "A IN 150 remete à IN 130/2016 (arts. 29, XII, 32, III, e 43, § 3º)." } },
  { caminho: "envio.documentos[rp].fonte", fonte: in150("Anexo, art. 1º, I e § 1º", "I – Relação de Pagamentos;") },
  { caminho: "envio.documentos[de].fonte", fonte: in150("Anexo, art. 1º, II e § 1º", "II – Demonstrativo do Extrato da Conta Corrente;") },
  { caminho: "envio.documentos[do].fonte", fonte: in150("Anexo, art. 1º, III e § 1º", "III – Demonstrativo Orçamentário e Financeiro;") },
  { caminho: "envio.documentos[gru_saldos].fonte", fonte: in150("Anexo, art. 1º, IV e § 2º", "comprovantes de recolhimentos dos saldos das contas-correntes de movimentação e de aplicação de recursos, quando houver, por meio da Guia de Recolhimento da União – GRU") },
  // diferente
  {
    caminho: "envio.documentos[encerramento_contas].fonte",
    regra: { descricao: "Comprovantes de encerramento das contas de movimentação" },
    fonte: in150("Anexo, art. 1º, V e § 2º", "V – comprovantes de encerramento das contas-correntes de movimentação de recursos;"),
  },
  { caminho: "envio.documentos[extratos].fonte", fonte: in150("Anexo, art. 1º, VI", "extrato das contas bancárias utilizadas pelo projeto, inclusive as contas de aplicação financeira, compreendendo o período da abertura até seu encerramento;") },
  { caminho: "envio.documentos[objeto].fonte", fonte: in150("Anexo, art. 1º, VIII", "material comprobatório de cumprimento do objeto e finalidade, conforme previsto na Instrução Normativa n.º 125, de 22 de dezembro de 2015.") },
  // ausente
  {
    caminho: "envio.documentos[documentos_fiscais].fonte",
    regra: { descricao: "Documentos fiscais e complementares, quando a ANCINE pedir; os originais ficam guardados em meio físico" },
    fonte: in150("art. 48; art. 8º", "a ANCINE poderá solicitar, a qualquer tempo e com a devida justificativa, esclarecimentos e documentos complementares"),
  },
  // ausente
  { caminho: "envio.documentos[junta_comercial].fonte", fonte: { documento: "IN ANCINE 125/2015", dispositivo: "art. 85", aConfirmar: true, nota: "O Anexo da IN 150 não pede o registro na junta comercial; pode estar na IN 125, não conferida." } },
  // ausente_vale_outra_norma
  { caminho: "envio.documentos[confirmacao_str].fonte", fonte: { documento: "Manual STR – Planilhas v2.2 (30/09/2025)", dispositivo: "§§ 6.1 e 6.3", nota: "A IN 150 manda as planilhas pelo STR (Anexo, art. 1º, § 1º); a confirmação segue o manual." } },
  // diferente
  {
    caminho: "envio.modelos[rp].fonte",
    regra: { nome: "Relação de Pagamentos (RP) — IN 150", arquivo: "ancine/IN_150_Relacao_de_Pagamentos.xls" },
    fonte: in150("Anexo, Formulários (Relação de Pagamentos)", undefined, "Mesmo leiaute do modelo da IN 159, com título e cabeçalho próprios."),
  },
  // diferente
  {
    caminho: "envio.modelos[de].fonte",
    regra: { nome: "Demonstrativo do Extrato da Conta Corrente (DE) — IN 150", arquivo: "ancine/IN_150_Demonstrativo_do_Extrato.xls" },
    fonte: in150("Anexo, Formulários (Demonstrativo do Extrato de Conta Corrente)", undefined, "Mesmo leiaute do modelo da IN 159, com título e cabeçalho próprios."),
  },
  // diferente
  {
    caminho: "envio.modelos[do].fonte",
    regra: { nome: "Demonstrativo Orçamentário e Financeiro (DO) — IN 150", arquivo: "ancine/IN_150_Demonstrativo_Orcamentario_e_Financeiro.xls" },
    fonte: in150("Anexo, Formulários (Demonstrativo Orçamentário e Financeiro)", undefined, "Mesmo leiaute da IN 159; a aba se chama \"Demonstrativo Orçam. e Contabil\" e a justificativa é das \"significativas diferenças\"."),
  },
  // ausente_vale_outra_norma
  { caminho: "envio.regras[xls_97].fonte", fonte: { documento: "Manual STR – Planilhas v2.2 (30/09/2025)", dispositivo: "§§ 3.1 e 3.2", nota: "A IN 150 só diz planilha eletrônica pelo STR (Anexo, art. 1º, § 1º)." } },
  // ausente_vale_outra_norma
  { caminho: "envio.regras[salic_nas_planilhas].fonte", fonte: { documento: "Manual STR – Planilhas v2.2 (30/09/2025)", dispositivo: "§§ 2.3 e 3.2.1", nota: "A IN 150 não trata; vale o manual do STR." } },
  // ausente_vale_outra_norma
  { caminho: "envio.regras[criticas_de_cruzamento].fonte", fonte: { documento: "Manual STR – Planilhas v2.2 (30/09/2025)", dispositivo: "§ 5.3", nota: "A IN 150 não trata; vale o manual do STR." } },
  { caminho: "envio.regras[uma_por_fonte].fonte", fonte: in150("art. 5º, parágrafo único", "Deverá ser entregue uma prestação de contas para cada processo.") },
  // ausente_vale_outra_norma
  { caminho: "envio.regras[bb_gestao_agil].fonte", fonte: { documento: "Manual STR – Planilhas v2.2 (30/09/2025)", dispositivo: "§§ 3.1 e 4.1.1", nota: "A IN 150 não trata; vale o manual do STR." } },
  // ausente_vale_outra_norma
  { caminho: "envio.regras[reabrir_envio].fonte", fonte: { documento: "Manual STR – Planilhas v2.2 (30/09/2025)", dispositivo: "§ 6.3", nota: "A IN 150 não trata; vale o manual do STR." } },
  { caminho: "envio.fonte", fonte: in150("Anexo, art. 1º, § 1º; art. 5º, parágrafo único", "Os documentos previstos nos incisos I, II, e III relativos às prestações de contas entregues a partir de 01/01/2019 deverão ser encaminhadas na forma de planilha eletrônica, por meio do Sistema de Triagem Financeira - STR.", "Formato .xls, Protocolo Digital e envio digitalizado vêm dos manuais.") },
  { caminho: "posEnvio.resultados[aprovada].fonte", fonte: in150("art. 28, I", "aprovação das contas: quando comprovado o cumprimento do objeto e finalidade, e a regular utilização dos recursos públicos;") },
  { caminho: "posEnvio.resultados[aprovada_ressalvas].fonte", fonte: in150("art. 25; art. 29", "A prestação de contas será aprovada com ressalvas quando verificadas as seguintes ocorrências, dentre outras:", "Concentração de 25% ou mais, movimentação sem pagamento, formulários, logomarca e glosa recolhida.") },
  { caminho: "posEnvio.resultados[reprovada].fonte", fonte: in150("art. 30, I a IX", "A prestação de contas não será aprovada quando verificadas as seguintes ocorrências:") },
  // ausente_vale_outra_norma
  { caminho: "posEnvio.devolucao.gru[019401].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 14–17", nota: "A IN 150 remete ao Manual para a GRU (Anexo, art. 1º, IV). Lei 8.313/1991, arts. 18 e 25: órgão 34902 (Fundo Nacional de Cultura)." } },
  // ausente_vale_outra_norma
  { caminho: "posEnvio.devolucao.gru[026642].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 14–17", nota: "A IN 150 remete ao Manual para a GRU (Anexo, art. 1º, IV). Lei 8.685/1993, arts. 1º, 1º-A, 3º e 3º-A: órgão 20203 (ANCINE)." } },
  // ausente_vale_outra_norma
  { caminho: "posEnvio.devolucao.gru[026667].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 14–17", nota: "A IN 150 remete ao Manual para a GRU (Anexo, art. 1º, IV). PAR/PAQ, orçamento da ANCINE." } },
  // ausente_vale_outra_norma
  { caminho: "posEnvio.devolucao.gru[026674].fonte", fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 14–17", nota: "A IN 150 remete ao Manual para a GRU (Anexo, art. 1º, IV). Editais FSA, MP 2.228-1 (art. 39, X) e Funcines." } },
  // ausente_vale_outra_norma
  {
    caminho: "posEnvio.devolucao.fonte",
    regra: { atualizacao: "SELIC a partir do mês seguinte ao vencimento e 1% no mês do pagamento; mora de 0,33% ao dia até 20% (IN 164/2022), se alcançar o débito." },
    fonte: { documento: "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)", dispositivo: "p. 14–17 e 69; IN 150, arts. 23, 32, § 1º, e 33", nota: "A IN 150 remete à norma de atualização de débitos e não fixa data-base." },
  },
  // diferente
  {
    caminho: "posEnvio.regras[multa_na_nao_aprovacao].fonte",
    regra: { descricao: "Na não aprovação, multa de 50% sobre o débito atualizado (Lei 8.685) ou de 20% sobre o valor total dos recursos (Funcines); no FSA e no fomento direto, a do regramento próprio. Pagar antes da decisão da Diretoria evita a multa.", parametros: { leiAudiovisual: 50, funcines: 20 } },
    fonte: in150("arts. 34 a 38", "Sobre o débito atualizado dos valores incentivados pelos Funcines, em conformidade com o art. 61 da Medida Provisória nº 2.228-1/01, incidirá multa de 20% (vinte por cento) calculada sobre o valor total dos recursos."),
  },
  { caminho: "posEnvio.regras[inadimplencia].fonte", fonte: in150("art. 2º, IX; arts. 6º, 46, § 1º, 53, § 2º, e 62, § 2º", "ficam impedidos, pelo prazo em que persistir o descumprimento de obrigações previstas nesta Instrução Normativa", "Na IN 150, o não pagamento da primeira parcela gera inadimplência (art. 53, § 2º); três parcelas não pagas rescindem o parcelamento (art. 55).") },
  { caminho: "posEnvio.regras[sancoes].fonte", fonte: in150("art. 43, I e II, e § 2º; art. 2º, VIII", "II – inabilitação da proponente por um prazo de até 2 (dois) anos. […] serão aplicadas à proponente a partir do encerramento do prazo recursal.", "A inabilitação alcança sócios administradores e empresas em que eles também sejam sócios administradores (art. 2º, VIII).") },
  { caminho: "posEnvio.regras[parcelamento].fonte", fonte: in150("art. 53, caput e § 4º", "poderão ser parcelados em até 60 (sessenta) prestações mensais e sucessivas […] O valor mínimo de cada prestação será de R$ 200,00 (duzentos reais) para pessoas jurídicas e R$ 50,00 (cinquenta reais) para pessoas naturais.") },
  // ausente_vale_outra_norma
  { caminho: "posEnvio.regras[tce].fonte", fonte: { documento: "IN TCU 98/2024", dispositivo: "art. 6º, I; Manual v2.11, p. 71–73", nota: "A IN 150 remete às normas do TCU (arts. 41, 42 e 70)." } },
  // ausente_vale_outra_norma
  { caminho: "posEnvio.regras[prescricao].fonte", fonte: { documento: "Res. TCU 344/2022", dispositivo: "arts. 2º e 8º; DDC ANCINE 110-E/2023", nota: "A IN 150 não trata de prescrição." } },
  { caminho: "posEnvio.regras[inspecao].fonte", fonte: in150("art. 61, § 2º; art. 62, § 2º", "A inspeção será agendada com antecedência mínima de 10 (dez) dias. […] esta será inscrita como inadimplente até a efetiva realização da inspeção") },
  { caminho: "posEnvio.fonte", fonte: in150("arts. 25 a 55 e 60 a 63", "A análise da prestação de contas final será composta do Relatório de Análise Financeira") },
  { caminho: "guarda.fonte", fonte: in150("art. 8º, caput; art. 9º, § 4º", "em ordem cronológica ou na ordem em que se encontrarem dispostos em sua Relação de Pagamentos, pelo prazo de 5 (cinco) anos, contados a partir da decisão final da análise da prestação de contas.") },
];
