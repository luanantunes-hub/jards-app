// Conferência do regime PRONON e PRONAS/PCD anterior no próprio Anexo LXXXVI
// da PRC 5/2017 (P1.11).
//
// Gerado a partir da leitura do texto do Saúde Legis, com as alterações das
// PRT 695/2020, 751/2020, 1.484/2020, 3.314/2024 e 7.224/2025, a retificação
// do DOU de 12/03/2020 e os modelos (Anexos 1 a 10): cada regra herdada do
// Anexo LXXXVI-A "a confirmar" foi procurada no anexo anterior. Confirmadas
// trocam a fonte; diferentes trocam a regra; as que só o anexo novo, a minuta
// do Termo de 2025 ou o Edital 3/2025 têm saem.

import type { AjusteConferido } from "../conferencia";
import type { Fonte } from "../tipos";

const ANTIGO = "Anexo LXXXVI da PRC 5/2017 (revogado)";

function antigo(dispositivo: string, citacao?: string, nota?: string): Fonte {
  return { documento: ANTIGO, dispositivo, ...(citacao ? { citacao } : {}), ...(nota ? { nota } : {}) };
}

export const CONFERENCIA_SAUDE_LXXXVI_2017: readonly AjusteConferido[] = [
  // diferente
  {
    caminho: "prazos.recurso.fonte",
    regra: { descricao: "Recurso protocolado na SE/MS, que o envia à autoridade recorrida em 5 dias; mantida a decisão, sobe à autoridade superior em 5 dias", quantidade: 10 },
    fonte: antigo("art. 103, caput e § 2º; art. 113", "A instituição poderá interpor recurso perante a SE/MS, que encaminhará à autoridade recorrida, no prazo máximo de 5 (cinco) dias, contados de seu recebimento.", "O anexo não fixa prazo para recorrer da prestação; pelo art. 113 vale a Lei 9.784/1999, que dá 10 dias (art. 59)."),
  },
  { caminho: "prazos.readequacaoCaptacao.fonte", fonte: antigo("art. 69, caput, e art. 70, caput (texto retificado no DOU de 12/03/2020)", "art. 69: “desde que tenham sido captados pelo menos 60% dos recursos, a instituição enviará, no prazo de 30 (trinta) dias contados do término do período de captação de recursos, readequação”; art. 70: “readequação para maior do orçamento do projeto aprovado, em até 20% (vinte por cento), a critério do Ministério da Saúde”", "O prazo de captação do art. 68, § 3º (90 + 30 dias), foi revogado pela PRT GM/MS 3.314/2024; vale o da portaria de autorização.") },
  { caminho: "prazos.recursoInabilitacao.fonte", fonte: antigo("art. 107", "Caberá recurso para o Ministro de Estado da Saúde, da decisão de que trata o art. 106, § 2º , II, no prazo de 15 (quinze) dias, contado da notificação da instituição destinatária.") },
  { caminho: "prestacaoParcial.regras[auditoria_anual].fonte", fonte: antigo("art. 92, caput e parágrafo único", "art. 92: “demonstrações contábeis e financeiras, submetidas a parecer conclusivo de auditoria independente, realizada por instituição credenciada perante o respectivo Conselho Regional de Contabilidade (CRC)”; parágrafo único: “serão apresentados anualmente até o dia 30 de abril de cada ano de execução o projeto”", "Também no Decreto 7.988/2013, art. 22, parágrafo único.") },
  // fora_do_regime
  { caminho: "prestacaoParcial.regras[excecao_2025].fonte", fonte: { documento: "Portaria SE/MS 928/2026", dispositivo: "art. 4º", nota: "Ato posterior à revogação do anexo; o MS o aplicou a todos os projetos executados em 2025, inclusive os antigos." } },
  // diferente
  {
    caminho: "prestacaoParcial.regras[monitoramento_anual].fonte",
    regra: { codigo: "relatorio_de_monitoramento", descricao: "O órgão técnico acompanha a execução, com acesso a documentos e locais, auditorias e vistorias; as diligências ficam no relatório de monitoramento do processo." },
    fonte: antigo("art. 89, §§ 2º e 4º; art. 16, IV", "As diligências previstas no § 2º serão registradas em relatório de monitoramento do projeto, que integrará os autos do processo administrativo."),
  },
  { caminho: "orcamento.grupos[elaboracao].fonte", fonte: antigo("art. 27, §§ 2º e 3º", "As despesas referentes aos serviços de elaboração do projeto e de captação de recursos deverão ser detalhadas na planilha de custos do projeto, sendo obrigatório o seu destaque em relação aos demais itens de despesas.") },
  { caminho: "orcamento.bases.valor_projeto.fonte", fonte: antigo("art. 27, caput; Anexo 6 do Anexo LXXXVI (modelo de orçamento)", "art. 27: “O projeto deverá apresentar orçamento detalhado, contendo todos os custos envolvidos para alcance dos objetivos”; Anexo 6: “VALOR DO PROJETO: R$ XXX”") },
  { caminho: "orcamento.bases.valor_total_projeto.fonte", fonte: antigo("art. 27, § 3º", "desde que as despesas somadas não ultrapassem 5% (cinco por cento) do valor total previsto para o projeto, limitada ao teto de R$ 50.000,00 (cinquenta mil reais)") },
  // diferente
  {
    caminho: "orcamento.regras[precos_de_referencia].fonte",
    regra: { descricao: "Preços pelo SIGEM, BPS, SIASG, SINAPI ou outros sistemas de referência; fora deles, a opção mais econômica entre 3 orçamentos ou justificativa circunstanciada." },
    fonte: antigo("art. 51, caput e §§ 1º e 2º; arts. 35, 39 e 42", "art. 51: “levará em conta os valores constantes do SIGEM, do BPS, do Sistema Integrado de Administração de Serviços Gerais (SIASG), do SINAPI, além de outros sistemas de informação”; art. 51, § 1º: “no mínimo, 3 (três) orçamentos com preços praticados no mercado”"),
  },
  { caminho: "orcamento.regras[equipamentos].fonte", fonte: antigo("arts. 36, 37 e 39", "art. 36: “de forma a permitir ao analista técnico avaliar a viabilidade técnica de instalação e operação dos equipamentos, bem como a sustentabilidade desses”; art. 39: “deverá ser consultado o Sistema de Informação e Gerenciamento de Equipamentos e Materiais (SIGEM) do Fundo Nacional de Saúde”", "O anexo anterior também pedia que os itens constassem das relações do FNS, salvo em pesquisa (art. 36).") },
  { caminho: "orcamento.regras[medicamentos].fonte", fonte: antigo("art. 40, § 1º", "“deverão estar listados na Relação Nacional de Medicamentos Essenciais (RENAME), exceto quando se tratar de medicamento utilizado no tratamento do câncer”; “que deverão ser registrados na ANVISA”") },
  // diferente
  {
    caminho: "orcamento.regras[opm].fonte",
    regra: { descricao: "Órteses, próteses e outros produtos para a saúde em qualquer projeto, ligados ao objeto, com preço pelo BPS e pelo SIASG." },
    fonte: antigo("art. 40, caput; arts. 41 e 42", "Os projetos poderão prever a aquisição de medicamentos, kits diagnósticos, materiais médico-hospitalares, órteses, próteses e de outros produtos para saúde, observando o seu objeto."),
  },
  { caminho: "orcamento.regras[prazo_de_execucao].fonte", fonte: antigo("art. 26, § 1º", "O prazo para execução do projeto poderá ser de até 24 (vinte e quatro) meses, exceto quando se tratar de projetos de pesquisa, hipótese em que o prazo de execução poderá ser de até 36 (trinta e seis) meses.") },
  // ausente
  { caminho: "orcamento.regras[reserva_de_contingencia].fonte", remover: "Só do Anexo LXXXVI-A (art. 16), ligada ao edital de chamamento." },
  // diferente
  {
    caminho: "alteracoes.janela.fonte",
    regra: { descricao: "Durante a execução, que começa com o Termo de Compromisso assinado e publicado e a liberação da Conta Captação para a Movimento; alterações do plano vão ao órgão competente, que tem 10 dias para se manifestar." },
    fonte: antigo("arts. 26, § 2º, 65, 84 e 87", "O órgão do Ministério da Saúde competente terá o prazo de 10 (dez) dias para se manifestar formalmente acerca da alteração"),
  },
  // diferente
  {
    caminho: "alteracoes.tipos.remanejamento.requisitos[tetos].fonte",
    regra: { descricao: "Depois do remanejamento, elaboração e captação continuam dentro do teto, o único do regime." },
    fonte: antigo("art. 27, § 3º; art. 44, V", "art. 44, V: “com ações e serviços de captação que excedam o limite estabelecido no art. 27, § 3º”"),
  },
  // diferente
  {
    caminho: "alteracoes.tipos.remanejamento.orientacoes[termo_de_apostilamento].fonte",
    regra: { codigo: "parecer_do_orgao_tecnico", descricao: "Remanejamento de rubricas depende de parecer conclusivo do órgão técnico; a alteração do plano vai ao órgão competente, que se manifesta em 10 dias." },
    fonte: antigo("art. 16, III; art. 87", "art. 16, III: “avaliar pedidos de remanejamento de rubricas e adequação do projeto em função de captação inferior ou superior ao inicialmente planejado e aprovado, emitindo parecer conclusivo”", "O anexo não prevê Termo de Apostilamento."),
  },
  { caminho: "alteracoes.tipos.remanejamento.fonte", fonte: antigo("art. 16, III; art. 87", "art. 16, III: “avaliar pedidos de remanejamento de rubricas”; art. 87: “Quaisquer alterações no Plano de Trabalho do projeto autorizado serão submetidas à apreciação do órgão do Ministério da Saúde competente, com justificativas necessárias.”") },
  // diferente
  {
    caminho: "alteracoes.tipos.complementacao.orientacoes[pedido_em_30_dias].fonte",
    regra: { descricao: "Pedido em 30 dias do fim da captação." },
    fonte: antigo("art. 70, caput", "A instituição poderá enviar, no prazo de 30 (trinta) dias contados do término do período de captação de recursos, readequação para maior do orçamento do projeto aprovado"),
  },
  { caminho: "alteracoes.tipos.complementacao.orientacoes[excedente_recolhido].fonte", fonte: antigo("art. 70, caput e § 4º; art. 88, V", "art. 70: “em até 20% (vinte por cento)”; art. 70, § 4º: “Os recursos captados remanescentes serão recolhidos na forma do art. 88.”") },
  // diferente
  {
    caminho: "alteracoes.tipos.complementacao.orientacoes[termo_aditivo].fonte",
    regra: { codigo: "portaria_da_se", descricao: "A readequação sai em portaria da SE/MS; a prorrogação é decidida pelo MS uma única vez. O anexo não fala em termo aditivo." },
    fonte: antigo("arts. 69, 70, 86 e 87", "art. 86: “O Ministério da Saúde decidirá sobre eventual pedido de prorrogação de prazo para a execução do projeto, uma única vez”", "O Termo de Compromisso assinado pode prever o aditivo; confira o do projeto."),
  },
  { caminho: "alteracoes.tipos.reducao.orientacoes[pedido_em_30_dias].fonte", fonte: antigo("art. 69, caput e §§ 2º a 4º (texto retificado no DOU de 12/03/2020)", "art. 69: “no prazo de 30 (trinta) dias contados do término do período de captação de recursos, readequação das ações previstas no projeto aprovado ao valor total obtido na captação, mediante aprovação prévia do Ministério da Saúde”; § 3º: “terá o prazo de 30 (trinta) dias do recebimento da proposta de readequação para emitir parecer técnico conclusivo”") },
  { caminho: "alteracoes.tipos.inclusao.requisitos[tetos].fonte", fonte: antigo("art. 27, § 3º; art. 44, V", "desde que as despesas somadas não ultrapassem 5% (cinco por cento) do valor total previsto para o projeto, limitada ao teto de R$ 50.000,00 (cinquenta mil reais)", "No regime anterior o único teto é o de elaboração e captação.") },
  { caminho: "alteracoes.tipos.inclusao.fonte", fonte: antigo("art. 87", "Quaisquer alterações no Plano de Trabalho do projeto autorizado serão submetidas à apreciação do órgão do Ministério da Saúde competente, com justificativas necessárias.", "O MS tinha 10 dias para se manifestar (art. 87, parágrafo único).") },
  // diferente
  {
    caminho: "alteracoes.regras[rendimentos_por_apostilamento].fonte",
    regra: { codigo: "uso_de_rendimentos", descricao: "Rendimentos da Conta Movimento pagam ações do projeto a critério da instituição, que justifica a escolha na prestação; despesa administrativa, elaboração ou captação só com autorização expressa do MS.", severidade: "alerta" },
    fonte: antigo("art. 82, § 3º, II, b e c, na redação da PRT GM/MS 751/2020", "serão utilizados em ações do projeto aprovado para a obtenção do melhor resultado para a execução do projeto, a critério da instituição, que deverá justificar a escolha realizada na apresentação da prestação de contas"),
  },
  // ausente
  { caminho: "alteracoes.regras[suspensao].fonte", remover: "Só do Anexo LXXXVI-A (art. 77); o anexo anterior só tem a suspensão determinada pelo MS (art. 89, § 6º)." },
  // diferente
  {
    caminho: "alteracoes.regras[remanejamento_entre_projetos].fonte",
    regra: {
      descricao: "Remanejamento entre Contas Captação: mesmo CNPJ, programa e ano fiscal, depois do fim da captação e antes da readequação; o beneficiário recebe até 20% acima do aprovado, e o que passa do art. 70 pode sair em qualquer fase da execução do cedente. A SE/MS publica em 20 dias.",
      severidade: "alerta",
      parametros: { percentual: 20 },
    },
    fonte: antigo("arts. 75, 76 e 78 (texto retificado no DOU de 12/03/2020)", "podendo o remanejamento ocorrer em qualquer fase de execução do projeto cedente"),
  },
  { caminho: "alteracoes.fonte", fonte: antigo("art. 69, caput; art. 87, parágrafo único", "art. 69: “mediante aprovação prévia do Ministério da Saúde”; art. 87: “terá o prazo de 10 (dez) dias para se manifestar formalmente acerca da alteração”", "O prazo de 10 dias do MS não gera aprovação tácita.") },
  // diferente
  {
    caminho: "fornecedores.partesRelacionadas.fonte",
    regra: { descricao: "É vedado captar de entidades vinculadas à proponente e dar ao doador vantagem em razão da doação; o anexo não diz que expor a marca do doador é vantagem indevida." },
    fonte: antigo("art. 66; arts. 44, IV, 105, X, e 110", "É vedada a captação de recursos de entidades vinculadas à instituição proponente."),
  },
  { caminho: "fornecedores.regras[vantagem_ao_doador].fonte", fonte: antigo("art. 44, IV; art. 110", "art. 44, IV: “que resultarem em vantagem financeira ou material para o doador, nos termos da Lei nº 12.715, de 2012”", "A multa de 2 vezes a vantagem vem da Lei 12.715/2012, que vale para qualquer projeto.") },
  { caminho: "fornecedores.regras[unidade_executora].fonte", fonte: antigo("art. 89, § 3º", "“A unidade executora do projeto será a própria instituição”; “não podendo atribuir a terceiros as atividades principais objeto do projeto”") },
  { caminho: "fornecedores.regras[intermediacao].fonte", fonte: antigo("art. 81; art. 46", "art. 81: “Nenhuma aplicação dos recursos poderá ser efetuada mediante intermediação. Parágrafo Único. Não configura intermediação a contratação de serviços de:”", "Exceções: elaboração do projeto e captação (art. 81, I e II).") },
  // diferente
  {
    caminho: "fornecedores.regras[equipe_ligada_a_acao].fonte",
    regra: { descricao: "Não se pagam profissionais que já atuam na instituição, salvo aumento de carga horária; ninguém é contratado para atividade sem relação com o objeto." },
    fonte: antigo("art. 24, §§ 1º e 2º", "§ 1º: “Os projetos não poderão solicitar o custeio dos serviços já realizados na instituição, tampouco o pagamento de profissionais que já atuam no local, exceto nos casos em que houver a necessidade e possibilidade de se aumentar a carga horária”; § 2º: “Em nenhuma hipótese será admitida contratação de profissionais para execução de atividades que não apresentem relação com o objeto do projeto.”"),
  },
  { caminho: "fornecedores.fonte", fonte: antigo("arts. 45, 66, 81 e 89, § 3º", "art. 66: “É vedada a captação de recursos de entidades vinculadas à instituição proponente.”") },
  { caminho: "contas.liberacao.fonte", fonte: antigo("arts. 65, 68 (caput e § 2º), 69, 82, § 3º, I, b, e 88, IV", "art. 68: “Somente poderão ser iniciadas as execuções dos projetos depois de captados 100% (cem por cento) dos recursos previstos nos respectivos orçamentos.”; art. 82, § 3º, I, b: “não serão computados no cálculo dos montantes captados para fins de apuração da captação integral ou captação mínima”") },
  // diferente
  {
    caminho: "contas.regras[captacao_depois_da_publicacao].fonte",
    regra: { descricao: "Captação só depois da publicação da portaria de aprovação e autorização, no prazo fixado nela." },
    fonte: antigo("art. 60, caput; art. 55, V", "Os recursos financeiros oriundos de doação somente poderão ser captados após a publicação da portaria de aprovação de projeto e de autorização para captação de recursos de que trata o art. 54.", "Os 90 + 30 dias do art. 68, § 3º, foram revogados pela PRT GM/MS 3.314/2024."),
  },
  { caminho: "contas.regras[doacao_em_bens].fonte", fonte: antigo("art. 68, § 4º; art. 74, caput e §§ 1º e 2º", "art. 68, § 4º: “estará condicionada à apresentação dos recibos nos casos de doações previstas nos incisos II a V do art. 57”; art. 74: “somente poderão ser feitas por pessoas jurídicas e com apresentação de nota fiscal dos produtos doados”; § 1º: “não poderá ser inferior a 12 (doze) meses”", "O anexo anterior também admitia doação por realização de despesas com reformas (art. 57, IV; art. 73).") },
  { caminho: "contas.regras[captacao_acima].fonte", fonte: antigo("art. 70, caput e § 4º; art. 88, V", "art. 70: “em até 20% (vinte por cento)”; art. 70, § 4º: “Os recursos captados remanescentes serão recolhidos na forma do art. 88.”") },
  { caminho: "contas.regras[contas_bloqueadas].fonte", fonte: antigo("art. 59, §§ 6º e 7º", "§ 6º: “Após o prazo de captação ou quando for captada a integralidade dos recursos previstos no projeto, o Ministério da Saúde providenciará o bloqueio da Conta Captação.”; § 7º: “o encerramento de contas após o término da vigência do Termo de Compromisso”") },
  { caminho: "contas.regras[recursos_publicos].fonte", fonte: antigo("art. 89, caput", "As doações captadas pelas instituições no âmbito do Pronon e do Pronas/PCD são recursos públicos", "A impenhorabilidade vem do CPC, art. 833, IX.") },
  // diferente
  {
    caminho: "contas.regras[regularidade].fonte",
    regra: { descricao: "Regularidade fiscal, tributária e previdenciária mantida o tempo todo e exigível a qualquer tempo (FGTS, INSS, CND conjunta, CEPIM e CADIN); a perda leva ao descredenciamento, e o MS pode bloquear as contas." },
    fonte: antigo("art. 17, VII, VIII e § 3º; art. 22, IV; art. 59, § 5º, II", "A regularidade fiscal, tributária e com a seguridade social deverá ser mantida por todo o período de execução dos projetos, podendo a sua comprovação ser exigida a qualquer tempo pelo Ministério da Saúde."),
  },
  { caminho: "contas.fonte", fonte: antigo("art. 59, caput e § 1º; art. 61", "art. 59, § 1º: “serão vinculadas a cada projeto e serão abertas pelo Ministério da Saúde em instituição financeira oficial”; art. 61: “a instituição autorizará a instituição financeira oficial, em caráter irrevogável e irretratável, a cumprir as determinações do Ministério da Saúde relativas às movimentações financeiras”") },
  { caminho: "despesas.vedadas[taxa_administracao].fonte", fonte: antigo("art. 44, I", "a título de taxa de administração ou similar") },
  { caminho: "despesas.vedadas[consultoria_de_servidor].fonte", fonte: antigo("art. 44, II", "em benefício de servidor ou empregado público, integrante do quadro de pessoal de órgão ou entidade pública da administração direta ou indireta de qualquer esfera governamental, por serviços de consultoria ou assistência técnica") },
  { caminho: "despesas.vedadas[clube_de_servidores].fonte", fonte: antigo("art. 44, III", "em favor de clubes e associações de servidores públicos ou entidades congêneres") },
  { caminho: "despesas.vedadas[vantagem_ao_doador].fonte", fonte: antigo("art. 44, IV", "que resultarem em vantagem financeira ou material para o doador, nos termos da Lei nº 12.715, de 2012") },
  { caminho: "despesas.vedadas[festas_bufe].fonte", fonte: antigo("art. 44, VI", "com recepções, festas, coquetéis, serviços de bufê ou similares, excetuados os gastos com refeições dos profissionais ou com ações educativas") },
  // diferente
  {
    caminho: "despesas.vedadas[primeira_classe].fonte",
    regra: { descricao: "Passagem de primeira classe ou executiva, salvo necessidade justificada de pessoa com deficiência ou mobilidade reduzida" },
    fonte: antigo("art. 44, VII", "referentes à compra de passagens em primeira classe ou classe executiva, salvo em caso de necessidade justificada, para pessoas com deficiência ou mobilidade reduzida"),
  },
  { caminho: "despesas.vedadas[taxas_multas_juros].fonte", fonte: antigo("art. 44, VIII", "com taxas bancárias, multas, juros ou correção monetária, inclusive referentes a pagamentos ou recolhimentos fora dos prazos") },
  { caminho: "despesas.vedadas[acao_ja_no_sus].fonte", fonte: antigo("art. 44, IX; art. 24", "para custeio de ações e serviços médico-assistenciais, já executados pelo proponente para atenção às pessoas no âmbito do SUS") },
  { caminho: "despesas.vedadas[antes_do_termo].fonte", fonte: antigo("art. 68, § 1º; art. 84", "A instituição não poderá ressarcir-se de despesas efetuadas em data anterior à celebração do Termo de Compromisso, exceto para captação de recursos e elaboração de projeto.", "O marco é a celebração do Termo; despesa depois do prazo de execução também é ressarcida (art. 84).") },
  // ausente
  { caminho: "despesas.vedadas[custeio_duplo].fonte", remover: "Só do Anexo LXXXVI-A (art. 22, X); o anterior veda a sobreposição com o SUS (art. 24), já nas regras." },
  { caminho: "despesas.vedadas[compra_centralizada].fonte", fonte: antigo("art. 40, § 3º", "Não será permitida a previsão de medicamentos cuja aquisição seja realizada de forma centralizada pelo Ministério da Saúde.") },
  // ausente
  { caminho: "despesas.vedadas[procedimentos_com_equipamentos].fonte", remover: "Só do Edital MS 3/2025 (item 7.4.13)." },
  { caminho: "despesas.regras[encargos_da_instituicao].fonte", fonte: antigo("art. 94; art. 89, § 3º", "art. 94: “É responsabilidade da instituição, efetuar a retenção e os recolhimentos de impostos e contribuições que incidirem sobre os recursos movimentados, serviços contratados e obrigações decorrentes de relações de trabalho.”") },
  { caminho: "despesas.regras[sem_sobreposicao_sus].fonte", fonte: antigo("art. 24, caput, I e II", "“não poderá ocorrer em prejuízo de suas atividades prestadas ao SUS, não podendo compreender o quantitativo executado ou em execução”; II: “para obtenção do Certificado de Entidade Beneficente de Assistência Social”") },
  { caminho: "despesas.fonte", fonte: antigo("arts. 27, 28, 29 a 44, 68, § 1º, e 84", "art. 44: “É vedada a previsão de despesas:”") },
  // diferente
  {
    caminho: "porte.fonte",
    regra: { motivo: "O anexo não classifica projetos por porte: toda prestação passa pela análise contábil e financeira do FNS e pelo parecer do órgão técnico; a financeira só é dispensada quando o objeto é integralmente descumprido." },
    fonte: antigo("art. 96, caput e § 1º; art. 97, § 2º", "Em caso de descumprimento integral do objeto, atestado no parecer de avaliação técnica, fica dispensada a análise financeira da prestação de contas."),
  },
  // diferente
  {
    caminho: "objeto.regras[metas_resultados].fonte",
    regra: { descricao: "Resultados esperados × atingidos, objetivos previstos × alcançados e custos estimados × reais; metas ou atividades descumpridas levam à devolução correspondente." },
    fonte: antigo("art. 92, parágrafo único, I; art. 97, II e § 1º", "art. 92, I: “relatório de cumprimento do objeto, no qual serão discriminados os resultados esperados e atingidos, os objetivos previstos e alcançados e os custos estimados e reais”; art. 97, § 1º: “a área técnica deverá indicar as metas ou as atividades descumpridas, recomendando a devolução dos recursos correspondentes”"),
  },
  // diferente
  {
    caminho: "objeto.regras[evidencias].fonte",
    regra: { descricao: "Fotografias e reportagens que comprovem a execução." },
    fonte: antigo("art. 92, parágrafo único, XI", "fotografias e reportagens que comprovem a execução do projeto"),
  },
  // ausente
  { caminho: "objeto.regras[docentes].fonte", remover: "Só do Anexo LXXXVI-A (art. 87, VI)." },
  // ausente
  { caminho: "objeto.regras[satisfacao].fonte", remover: "Só do Anexo LXXXVI-A (arts. 79, § 4º, e 87, IX)." },
  // ausente
  { caminho: "objeto.regras[sustentabilidade].fonte", remover: "Só do Anexo LXXXVI-A (art. 87, X); no anterior, a permanência dos equipamentos segue o art. 38, § 3º." },
  { caminho: "objeto.regras[pesquisa_autorizada].fonte", fonte: antigo("art. 26, V", "“submeter o projeto à apreciação dos comitês de ética, da Agência Nacional de Vigilância Sanitária (ANVISA) e da Comissão Técnica Nacional de Biossegurança (CTNBio)”; “somente iniciar a execução do projeto após enviar ao Ministério da Saúde comprovante(s) de ter obtido as necessárias autorizações”") },
  { caminho: "objeto.regras[insumos_remanescentes].fonte", fonte: antigo("art. 41, caput e § 2º, I", "art. 41: “adquiridos que não foram utilizados serão doados, ao término do projeto, ao ente federativo que anuiu com a realização do projeto”; § 2º, I: “nos 30 (trinta) dias anteriores ao término do projeto, solicitar à Secretaria de Saúde do ente federativo que anuiu com a realização do projeto a manutenção do uso dos produtos”", "A permanência só vale para instituição que atue de forma complementar ao SUS, com termo de compromisso com o gestor (§ 2º, II).") },
  { caminho: "objeto.regras[bens_permanentes].fonte", fonte: antigo("art. 92, parágrafo único, XII; art. 38", "art. 92, XII: “relação de equipamentos e materiais permanentes adquiridos para as atividades do projeto, contendo o número e/ou identificação do projeto e controlados em inventário físico específico”; art. 38: “será revertido, ao final do projeto, mediante doação, ao patrimônio do ente federativo que anuiu com a realização do projeto”", "A instituição pode ficar com o bem se pedir ao gestor do SUS nos 30 dias anteriores ao término (art. 38, § 3º).") },
  // ausente
  {
    caminho: "objeto.regras[dados_de_pacientes].fonte",
    regra: { descricao: "Dados de saúde são sensíveis: não vão prontuários ao sistema." },
    fonte: { documento: "Lei 13.709/2018 (LGPD)", dispositivo: "art. 5º, II; art. 11", nota: "O anexo anterior não trata de dados pessoais; criptografia e destruição ou devolução a pedido do MS são da minuta do Termo de 2025." },
  },
  // ausente
  { caminho: "objeto.regras[contrapartida].fonte", remover: "Só do Anexo LXXXVI-A (art. 14, § 5º), ligada ao edital." },
  // diferente
  {
    caminho: "objeto.fonte",
    regra: { descricao: "O parecer confirma os documentos do art. 92, compara resultados esperados e atingidos e aponta metas descumpridas; o FNS analisa o contábil e o financeiro de toda prestação; produção médico-assistencial no CMD (antes, no CIHA)." },
    fonte: antigo("art. 97, caput, I e II; art. 96, § 1º; art. 31", "art. 97, I: “confirmação da apresentação dos documentos relacionados no art. 92, parágrafo único referente à análise da execução do objeto e dos objetivos do projeto”; art. 97, II: “comparação entre os resultados esperados e os atingidos pelo projeto”", "O registro no CMD para os projetos antigos vem da Portaria GM/MS 8.031/2025, art. 3º."),
  },
  // fora_do_regime
  {
    caminho: "envio.regras[manual_nao_publicado].fonte",
    regra: { codigo: "modelos_do_anexo", descricao: "Documentos do art. 92 e modelos dos Anexos 1 a 10 do Anexo LXXXVI, com o Termo que o projeto assinou; os atos SE/MS de 2026 valem por decisão do MS." },
    fonte: antigo("art. 92, parágrafo único; Anexos 1 a 10", undefined, "O Manual Orientativo da Portaria GM/MS 8.031/2025 é do Anexo LXXXVI-A."),
  },
  // ausente
  { caminho: "envio.regras[impropriedades_registradas].fonte", remover: "Só do Anexo LXXXVI-A (art. 81, § 2º); não há Transferegov no anterior." },
  // diferente
  {
    caminho: "posEnvio.resultados[aprovada].fonte",
    regra: { descricao: "Aplicação regular dos recursos e avaliação técnica satisfatória." },
    fonte: antigo("art. 98, § 1º", "O projeto será considerado aprovado integralmente quando o parecer técnico atestar a aplicação regular dos recursos e indicar que o projeto teve avaliação técnica satisfatória."),
  },
  // diferente
  {
    caminho: "posEnvio.resultados[aprovada_ressalvas].fonte",
    regra: { descricao: "Contas regulares com avaliação técnica insatisfatória, sem prejuízo ao erário nem descumprimento do objeto; na execução parcial, o remanescente com rendimentos volta em 30 dias." },
    fonte: antigo("art. 98, § 2º; art. 102", "apesar de regulares as contas, tiver obtido avaliação técnica insatisfatória com fundamento nos aspectos do art. 97, desde que não resulte em prejuízo ao erário ou descumprimento do objeto"),
  },
  // diferente
  {
    caminho: "posEnvio.resultados[reprovada].fonte",
    regra: { descricao: "Objeto descumprido ou contas irregulares, mesmo com avaliação técnica favorável; a omissão também reprova." },
    fonte: antigo("art. 98, §§ 3º e 4º; art. 101", "A omissão na prestação de contas também é causa de reprovação"),
  },
  { caminho: "posEnvio.regras[tce].fonte", fonte: antigo("art. 89, § 1º; arts. 101, § 2º, 108 e 109", "art. 89, § 1º: “A não aplicação sem justa causa ou aplicação incorreta dos recursos no âmbito do Pronon e do Pronas/PCD poderá ensejar instauração de Tomada de Contas Especial.”; art. 109: “o registro de seus atos será realizado no Sistema Integrado de Administração Financeira do Governo Federal (SIAFI)”") },
  { caminho: "posEnvio.regras[omissao_sanavel].fonte", fonte: antigo("art. 98, § 4º", "A omissão na prestação de contas também é causa de reprovação, podendo ser sanada se apresentada até o julgamento da Tomada de Contas Especial.") },
  // ausente
  { caminho: "posEnvio.regras[rescisao].fonte", remover: "Da minuta do Termo de 2025 (cl. 12ª); o anexo anterior não trata de rescisão." },
  { caminho: "posEnvio.fonte", fonte: antigo("arts. 96 a 109", "art. 96: “realizar a análise das atividades executadas, com emissão de parecer conclusivo do relatório em até 90 (noventa) dias, contados da data de recebimento”") },
];
