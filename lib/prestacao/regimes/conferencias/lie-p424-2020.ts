// Conferência do regime LIE P424 na própria Portaria 424/2020 (P1.11).
//
// Gerado a partir da leitura do texto compilado da P424 (com as Portarias
// 454/2020 e 638/2021) e das alterações publicadas no DOU até a Portaria MESP
// 33/2025: cada regra que veio da P10 "a confirmar" foi procurada na P424.
// Confirmadas trocam a fonte; diferentes trocam a regra; as que só a P10 tem
// saem. As que vêm do Decreto 6.180/2007 continuam "a confirmar": o texto do
// decreto não abriu na conferência.

import type { AjusteConferido } from "../conferencia";
import type { Fonte } from "../tipos";

const P424 = "Portaria 424/2020";
const P424_33 = "Portaria 424/2020, na redação da Portaria MESP 33/2025";

function p424(dispositivo: string, citacao?: string, nota?: string): Fonte {
  return { documento: P424, dispositivo, ...(citacao ? { citacao } : {}), ...(nota ? { nota } : {}) };
}

export const CONFERENCIA_LIE_P424_2020: readonly AjusteConferido[] = [
  { caminho: "prazos.prestacaoFinal.fonte", fonte: p424("art. 71, caput; art. 102-A (contagem)", "Fica estabelecido o prazo de até 60 (sessenta) dias para apresentação da Prestação de Contas Final contados do término do prazo de vigência do termo de compromisso ou Termo Aditivo.") },
  { caminho: "prazos.analisePrestacaoParcial.fonte", fonte: p424("art. 70", "o DIFE emitirá parecer sobre a execução do projeto, no prazo de 60 (sessenta) dias, sendo este prazo devidamente interrompido nos casos de realização de diligência.") },
  { caminho: "prazos.devolucao.fonte", fonte: p424("art. 84, caput e §§ 2º e 3º", "o proponente beneficiário terá prazo de quarenta e cinco dias, contados da data da cientificação oficial, para recolhimento dos recursos aplicados irregularmente ou ressarcimento do dano, incluídos os rendimentos") },
  { caminho: "prazos.devolucaoRessalva.fonte", fonte: p424("art. 84, § 4º", "Quando a decisão for pelo arquivamento ou pela aprovação com ressalva em virtude de cumprimento parcial do objeto, o proponente terá prazo de 30 (trinta) dias para recolhimento dos recursos remanescentes") },
  { caminho: "prazos.esclarecimentoDivulgacao.fonte", fonte: p424("art. 97, § 1º", "serão comunicados pelo DIFE a respeito da violação observada a prestar esclarecimentos, em até 5 (cinco) dias, a contar do recebimento") },
  { caminho: "prestacaoParcial.regras[pcp_por_parcela].fonte", fonte: p424("art. 31, parágrafo único, II; art. 69, § 2º", "para cada parcela executada do plano de trabalho com incentivo parcelado é necessária a apresentação da Prestação de Contas Parcial cuja aprovação é condição para a liberação da parcela seguinte") },
  // diferente
  {
    caminho: "prestacaoParcial.regras[pcp_pelo_sei].fonte",
    regra: { codigo: "pcp_pelo_sistema", descricao: "PCP por sistema eletrônico, remessa postal ou e-mail, com nº do processo, nome do projeto e os documentos I a IX; itens I a IV nos formulários do DIFE." },
    fonte: p424("art. 69, caput e § 1º", "via Sistema Eletrônico, Remessa Postal ou e-mail, devendo conter o número do processo, o nome do projeto aprovado e os seguintes documentos"),
  },
  // ausente
  { caminho: "prestacaoParcial.regras[pcp_sem_merito].fonte", remover: "Só da P10 (art. 66); a P424 diz que o DIFE emite parecer sobre a execução (art. 70)." },
  // diferente
  {
    caminho: "prestacaoParcial.fonte",
    regra: { descricao: "A PCP é pedida a critério do DIFE e é obrigatória antes de cada parcela quando o incentivo é parcelado; vai por sistema eletrônico, remessa postal ou e-mail, com os itens I a IV nos formulários do DIFE." },
    fonte: p424("arts. 68 e 69, caput, §§ 1º e 2º; art. 31, parágrafo único, II", "A entidade proponente que receber recursos incentivados ficará sujeita a apresentar Prestação de Contas Parcial, a critério do DIFE"),
  },
  { caminho: "orcamento.estrutura.fonte", fonte: p424("art. 7º, V; art. 26, V; art. 7º, § 2º (modelos do DIFE)", "as despesas de produção que são detalhadas na planilha de custo, destacadas dos demais itens orçamentários, não integram os 15% (quinze por cento) de despesas administrativas (atividade meio)") },
  // ausente
  { caminho: "orcamento.grupos[execucao].fonte", fonte: { documento: "Decreto 6.180/2007", dispositivo: "art. 11, § 1º (remissão do art. 26, V, da P424)", aConfirmar: true, nota: "A P424 usa o termo atividade-fim sem defini-lo; texto do Decreto 6.180/2007 não conferido (o Planalto não abriu); a P424 não trata." } },
  { caminho: "orcamento.grupos[administracao].fonte", fonte: p424("art. 26, V (remete ao art. 11 do Decreto 6.180/2007)", "não integram os 15% (quinze por cento) de despesas administrativas (atividade meio), de que trata o art. 11 do Decreto 6.180, de 2007", "A P424 iguala despesas administrativas e atividade-meio; o \"inclusive os encargos\" vem do decreto.") },
  { caminho: "orcamento.grupos[elaboracao].fonte", fonte: p424("art. 26, caput e V", "Os limites máximos para despesas de produção, que abrangem as despesas com a contratação de serviços destinados à elaboração do projeto desportivo ou paradesportivo e à captação de recursos") },
  // ausente
  { caminho: "orcamento.bases.valor_atividade_fim.fonte", fonte: { documento: "Planilha Orçamentária (modelo oficial do MESP)", dispositivo: "H64 = H63/H47; P424, art. 26, V", aConfirmar: true, nota: "A P424 fixa os 15% sem dizer a base e remete ao Decreto 6.180/2007, art. 11, que falava em orçamento total; meio ÷ fim é o critério dos modelos oficiais, o mesmo da P10." } },
  { caminho: "orcamento.bases.valor_projeto.fonte", fonte: p424("art. 26, I a IV", "do somatório do valor da atividade fim e da atividade meio do projeto originalmente apresentado ou do valor apresentado para a Análise Técnica e Orçamentária", "O § 1º (cálculo só sobre o valor captado), que o texto compilado ainda mostra, foi revogado pela Portaria MC 834/2022.") },
  // ausente
  { caminho: "orcamento.bases.valor_total_projeto.fonte", fonte: { documento: "Planilha Orçamentária (modelo oficial do MESP)", dispositivo: "D68 \"TOTAL GERAL\"", nota: "Conceito do modelo oficial, igual nos dois regimes; a P424 não define o total geral." } },
  { caminho: "orcamento.tetos[atividade_meio].fonte", fonte: p424("art. 26, V; Portaria MESP 33/2025, art. 57, § 4º", "não integram os 15% (quinze por cento) de despesas administrativas (atividade meio), de que trata o art. 11 do Decreto 6.180, de 2007") },
  { caminho: "orcamento.regras[sem_valor_fechado].fonte", fonte: p424("art. 7º, V", "não devendo ser lançados valores fechados no orçamento analítico") },
  // diferente
  {
    caminho: "orcamento.regras[encargos_proprios].fonte",
    regra: { descricao: "Forma de contratação e encargos de cada profissional explicitados no projeto; os encargos trabalhistas da contratação podem ser previstos.", severidade: "info" },
    fonte: p424("art. 50, § 2º; art. 54, parágrafo único", "A forma de contratação de cada profissional e encargos deverão estar explicitados no projeto."),
  },
  { caminho: "orcamento.regras[media_de_orcamentos].fonte", fonte: p424("art. 7º, § 6º", "O valor máximo das despesas constantes no projeto não excederá a média dos valores dos três orçamentos apresentados ou de tabela de referência.") },
  { caminho: "orcamento.regras[receitas_no_orcamento].fonte", fonte: p424("art. 7º, §§ 3º e 4º; art. 49", "As receitas auferidas em razão do projeto devem estar previstas em orçamento analítico, conforme modelo definido pelo DIFE.") },
  { caminho: "orcamento.regras[limite_de_captacao].fonte", fonte: p424("art. 14, I a IV e §§ 1º e 2º", "até seis projetos por ano-calendário, considerado o número do CNPJ raiz independentemente de ser filial ou matriz; II - R$ 5.000.000,00 (cinco milhões de reais) para a manifestação desportiva de rendimento") },
  { caminho: "alteracoes.janela.fonte", fonte: p424("art. 21, § 3º; arts. 42 e 46", "poderá ser movimentada pelo proponente exclusivamente para a execução do projeto, após a assinatura do Termo de Compromisso.") },
  { caminho: "alteracoes.tipos.complementacao.orientacoes[termo_aditivo].fonte", fonte: p424("art. 57-A, §§ 2º e 3º", "A readequação do plano de trabalho deverá ser aprovada pela CTLIE, precedida de parecer técnico da CGDPE") },
  { caminho: "alteracoes.tipos.complementacao.orientacoes[sem_item_nao_autorizado].fonte", fonte: p424("art. 57-A, § 1º; art. 34, § 3º", "sendo vedada a inclusão de itens não autorizados originalmente") },
  { caminho: "alteracoes.tipos.complementacao.fonte", fonte: p424("art. 57-A, caput e §§ 2º e 3º", "Readequação é a possibilidade de o proponente captar recurso após o início da execução do projeto") },
  // ausente
  { caminho: "alteracoes.tipos.reducao.requisitos[tetos].fonte", fonte: p424("art. 26; art. 57, § 4º, na redação da Portaria MESP 33/2025", undefined, "A P424 não trata da redução, mas os tetos valem em qualquer mudança do plano.") },
  // ausente
  { caminho: "alteracoes.tipos.reducao.fonte", fonte: p424("art. 100", "Casos omissos e/ou de comprovada excepcionalidade poderão ser dirimidos pelo DIFE ou pela CTLIE", "A P424 não prevê redução do plano de trabalho durante a execução; é caso omisso, decidido pelo DIFE ou pela CTLIE.") },
  // ausente
  { caminho: "alteracoes.tipos.inclusao.requisitos[tetos].fonte", remover: "Sem efeito: na P424 não há inclusão de item novo." },
  // diferente
  {
    caminho: "alteracoes.tipos.inclusao.fonte",
    regra: { permitido: false },
    fonte: p424("art. 57, § 2º; art. 57-A, § 1º; art. 34, § 7º", "Somente poderão ser remanejados valores referentes a itens orçamentários previstos no projeto aprovado.", "O remanejamento só mexe em itens previstos e a readequação veda itens não autorizados originalmente; item novo só na ATO com captação parcial, a pedido do DIFE, ou como caso omisso (art. 100)."),
  },
  { caminho: "alteracoes.regras[local_de_execucao].fonte", fonte: p424("art. 48", "Não é permitida a alteração de local de execução do projeto sem a prévia anuência do DIFE.") },
  // ausente
  { caminho: "alteracoes.regras[outra_alteracao].fonte", remover: "Só da P10 (art. 43); a P424 tem regras próprias para cada alteração e o art. 100 para os casos omissos." },
  { caminho: "alteracoes.regras[prorrogacao].fonte", fonte: p424("art. 58, caput e § 1º", "É permitida até duas prorrogações de prazo de execução do projeto, devendo ser formalizada por meio de termo aditivo a ser assinado em data anterior ao vencimento do Termo vigente.") },
  // diferente
  {
    caminho: "alteracoes.regras[uso_de_rendimentos].fonte",
    regra: { descricao: "Rendimentos só nas ações do projeto, com a destinação em planilha específica do Plano de Trabalho, relatório próprio e a ação escolhida justificada na análise do objeto." },
    fonte: p424("art. 29, §§ 2º, 5º e 6º", "deverão ser utilizados exclusivamente nas ações do projeto aprovado, estando sujeitos às mesmas condições de prestação de contas exigidas para os recursos incentivados"),
  },
  { caminho: "alteracoes.fonte", fonte: p424("arts. 48, 57-A, § 2º, e 58, caput", "O DIFE decidirá sobre eventual pedido de prorrogação de prazo para execução do projeto desportivo ou paradesportivo") },
  { caminho: "fornecedores.partesRelacionadas.fonte", fonte: p424("art. 61, V", "em benefício de membros da entidade proponente, exceto quando este desempenha função específica previamente aprovada no projeto.", "A P424 veda despesa com membros da entidade; a indedutibilidade do patrocínio a pessoa vinculada vem da LC 222/2025 (art. 5º), que vale pelos projetos da P424.") },
  // ausente
  { caminho: "fornecedores.regras[credor_ligado_ao_incentivador].fonte", fonte: { documento: "LC 222/2025", dispositivo: "art. 5º", nota: "Vale pelos projetos da P424 (Portaria MESP 10/2026, art. 102); antes, Lei 11.438/2006, art. 1º, § 5º." } },
  { caminho: "fornecedores.regras[intermediacao].fonte", fonte: p424("art. 63 e parágrafo único", "Entende-se por intermediação, no âmbito desta Portaria, a transferência da execução do objeto do projeto a terceiros.", "A rescisão como sanção não está no art. 63; a P424 remete as hipóteses de rescisão ao Decreto 6.180/2007, art. 34.") },
  // ausente
  { caminho: "fornecedores.regras[subcontratacao].fonte", fonte: { documento: "Decreto 12.861/2026", dispositivo: "art. 13, §§ 3º e 6º", aConfirmar: true, nota: "A P424 não regula a subcontratação e o Decreto 6.180/2007 não tinha regra igual; a P10, art. 102, só estende a LC 222/2025 aos projetos da P424." } },
  { caminho: "fornecedores.regras[contratacao_de_pessoal].fonte", fonte: p424("art. 50, I a III e § 1º", "a remuneração em pesquisas e publicações especializadas e independentes ou tabela de referência publicada pelo DIFE.") },
  { caminho: "fornecedores.fonte", fonte: p424("arts. 50, 61, 62 e 63 (equivalentes aos arts. 44, 58 e 59 da P10)", "É vedada a intermediação de recursos nos termos do art. 12 do Decreto nº 6.180, de 2007.") },
  // ausente
  {
    caminho: "contas.tarifas.fonte",
    regra: { descricao: "A LC e a P424 não dizem se tarifa bancária é despesa elegível." },
    fonte: { documento: "LC 222/2025 e Portaria 424/2020", dispositivo: "texto integral, sem regra sobre tarifas" },
  },
  { caminho: "contas.liberacao.fonte", fonte: p424("art. 43; art. 21, § 3º; art. 31, parágrafo único, II e III; art. 41", "O DIFE especificará o percentual e demais exigências para a transferência de recursos da conta CAPTAÇÃO para a conta MOVIMENTO.") },
  { caminho: "contas.regras[conta_exclusiva].fonte", fonte: p424("art. 21, caput e § 10", "O DIFE providenciará a abertura das contas bancárias específicas e exclusivas para depósitos e movimentações dos recursos") },
  { caminho: "contas.regras[captar_acima].fonte", fonte: p424("art. 23, § 2º", "É vedado ao proponente captar valor superior ao autorizado pela CTLIE, sob pena de recolhimento ao Tesouro Nacional dos recursos excedentes") },
  { caminho: "contas.regras[estorno].fonte", fonte: p424("arts. 24 e 25", "devendo ser encaminhada ao DIFE no prazo de 60 (sessenta) dias, a contar da data de realização do depósito.") },
  { caminho: "contas.regras[bloqueio_judicial].fonte", fonte: p424("art. 21, §§ 7º e 8º", "Os recursos que forem bloqueados judicialmente devem ser imediatamente informados pelo proponente ao DIFE, sob pena de arquivamento do projeto.") },
  { caminho: "contas.regras[autorizacao_ao_banco].fonte", fonte: p424("art. 22; art. 21, § 1º", "deverá o proponente autorizar a instituição financeira, em caráter irrevogável e irretratável, a cumprir as determinações do DIFE relativas às movimentações financeiras.") },
  { caminho: "contas.fonte", fonte: p424("art. 21, caput, §§ 2º, 3º e 10", "Todos os aportes feitos por doadores/patrocinadores deverão ser depositados direta e somente na conta CAPTAÇÃO") },
  { caminho: "pagamentos.documentoFiscal[em_nome_da_entidade].fonte", fonte: p424("art. 47, caput", "Os documentos comprobatórios das despesas devem ser emitidos única e exclusivamente em nome do proponente.") },
  { caminho: "pagamentos.documentoFiscal[numero_sli].fonte", fonte: p424("art. 47, § 1º", "O proponente deverá registrar o número do Sistema Eletrônico da Lei de Incentivo ao Esporte referente ao projeto aprovado em todos os documentos que comprovem as despesas.") },
  { caminho: "pagamentos.documentoFiscal[carimbo_e_atesto].fonte", fonte: p424("art. 47, § 1º; art. 54, III", "O proponente deverá registrar o número do Sistema Eletrônico da Lei de Incentivo ao Esporte referente ao projeto aprovado em todos os documentos que comprovem as despesas.", "O formato (carimbo na frente, atesto no verso) vem do modelo de carimbos do MESP.") },
  { caminho: "pagamentos.documentoFiscal[nota_discriminada].fonte", fonte: p424("art. 82", "deverão conter a discriminação dos serviços contratados ou dos produtos adquiridos") },
  { caminho: "pagamentos.documentoFiscal[recibo_de_diarias].fonte", fonte: p424("art. 47, § 2º", "poderão ser comprovadas por meio de recibo próprio, conforme modelo anexo, assinado pelo usuário com identificação e CPF.") },
  { caminho: "pagamentos.documentoFiscal[retencoes].fonte", fonte: p424("art. 80", "É responsabilidade do proponente efetuar a retenção e o recolhimento dos tributos que incidirem sobre os recursos movimentados, serviços contratados ou obrigações decorrentes de relações de trabalho.", "A P424 não nomeia IR, INSS e ISS; vêm da instrução do formulário.") },
  { caminho: "pagamentos.documentoFiscal[traducao].fonte", fonte: p424("art. 102", "Caso contrário, devem estar acompanhados de tradução por tradutor juramentado, com documento original ou cópia.") },
  { caminho: "pagamentos.regras[um_comprovante_por_debito].fonte", fonte: p424("art. 45", "Para cada lançamento efetuado a débito na conta de LIVRE MOVIMENTAÇÃO deverá corresponder um comprovante de sua regular aplicação") },
  // alterada_depois
  { caminho: "pagamentos.regras[ate_o_aprovado].fonte", fonte: { documento: P424_33, dispositivo: "art. 51, caput e § 3º", nota: "Na redação original, toda compra pedia cotação com 3 orçamentos." } },
  { caminho: "pagamentos.regras[processo_de_compra].fonte", fonte: p424("art. 54, I a IV", "cotação prévia ou justificativa em caso de não apresentação da cotação, quando couber") },
  { caminho: "pagamentos.regras[contrato].fonte", fonte: p424("art. 55, I a VIII", "O contrato de prestação de serviço celebrado entre proponente e fornecedores deverá prever, com clareza e precisão, as condições para sua execução") },
  { caminho: "pagamentos.regras[pregao].fonte", fonte: p424("art. 56 e § 1º", "Para aquisição de bens e serviços comuns, será obrigatório o uso da modalidade pregão") },
  { caminho: "pagamentos.fonte", fonte: p424("art. 44", "através de qualquer operação bancária autorizada pelo Banco Central do Brasil, desde que fique identificada sua destinação e, no caso de pagamento, o credor, estando vedado em qualquer hipótese o saque em dinheiro.") },
  { caminho: "despesas.vedadas[taxa_administracao].fonte", fonte: p424("art. 61, I", "a título de taxa de administração, de gerência ou similar") },
  { caminho: "despesas.vedadas[agente_publico].fonte", fonte: p424("art. 61, II", "em benefício de agente público da ativa por serviços prestados, inclusive consultoria, assistência técnica ou assemelhados") },
  { caminho: "despesas.vedadas[clube_de_servidores].fonte", fonte: p424("art. 61, III", "em favor de clubes e associações de servidores públicos ou entidades congêneres") },
  { caminho: "despesas.vedadas[vantagem_ao_patrocinador].fonte", fonte: p424("art. 61, IV", "que resultarem em vantagem financeira ou material para o patrocinador") },
  { caminho: "despesas.vedadas[membros_da_entidade].fonte", fonte: p424("art. 61, V", "em benefício de membros da entidade proponente, exceto quando este desempenha função específica previamente aprovada no projeto.") },
  { caminho: "despesas.vedadas[imovel].fonte", fonte: p424("art. 37, II", "contemplem ação para aquisição de imóvel") },
  { caminho: "despesas.vedadas[atleta_profissional].fonte", fonte: p424("art. 62, I; art. 1º, § 6º", "o pagamento de remuneração de atletas profissionais, nos termos da Lei nº 9.615, de 24 de março de 1998, em qualquer modalidade desportiva") },
  { caminho: "despesas.vedadas[equipe_profissional].fonte", fonte: p424("art. 62, II; art. 1º, § 6º", "a utilização dos recursos para o pagamento de quaisquer despesas relativas à manutenção e organização de equipes desportivas ou paradesportivas profissionais de alto rendimento") },
  // ausente
  { caminho: "despesas.vedadas[espaco_publicitario].fonte", fonte: { documento: "Decreto 6.180/2007", dispositivo: "art. 13", aConfirmar: true, nota: "Texto do Decreto 6.180/2007 não conferido (o Planalto não abriu); a P424 não trata." } },
  // ausente
  { caminho: "despesas.vedadas[cobranca_de_beneficiarios].fonte", fonte: { documento: "Decreto 6.180/2007", dispositivo: "art. 15", aConfirmar: true, nota: "A P424 só manda reverter ao projeto a inscrição em eventos (art. 7º, § 4º); texto do Decreto 6.180/2007 não conferido (o Planalto não abriu)." } },
  { caminho: "despesas.vedadas[so_manutencao].fonte", fonte: p424("art. 37, I", "envolvam, estritamente, despesas administrativas para manutenção da entidade proponente") },
  // ausente
  { caminho: "despesas.vedadas[beneficio_de_convencao].fonte", remover: "Só da P10 (art. 44, § 4º); a P424 permite prever todos os encargos da contratação (art. 54, parágrafo único)." },
  { caminho: "despesas.regras[pessoal_na_vigencia].fonte", fonte: p424("art. 46; art. 50, § 2º", "O proponente não poderá realizar despesas anteriores à celebração do Termo de Compromisso ou posteriores ao prazo de execução do projeto desportivo ou paradesportivo aprovado, sob pena de ressarcimento e demais penalidades cabíveis.") },
  { caminho: "despesas.regras[bolsa_auxilio].fonte", fonte: p424("art. 13", "Será permitido o pagamento de Bolsa para beneficiários de projetos desportivos e paradesportivos da manifestação de rendimento, nos termos previstos em Portaria Específica.") },
  // diferente
  {
    caminho: "despesas.regras[crc_excelencia].fonte",
    regra: { descricao: "No rendimento, a certificação dos arts. 18 e 18-A da Lei 9.615/1998 vale durante toda a execução e eventual Termo Aditivo; sem ela na ATO, o projeto é rejeitado e arquivado, com recolhimento por GRU." },
    fonte: p424("art. 35, parágrafo único; art. 34, §§ 12 e 13", "A entidade proponente deverá zelar pela validade da certificação durante toda execução do projeto e eventual Termo Aditivo"),
  },
  { caminho: "despesas.regras[tabela_de_referencia].fonte", fonte: p424("art. 50, § 1º; art. 7º, §§ 2º e 6º", "ou tabela de referência publicada pelo DIFE") },
  { caminho: "despesas.fonte", fonte: p424("arts. 46, 61 e 62 (equivalentes aos arts. 40, 58 e 59 da P10)", "É vedada a previsão de despesas:") },
  { caminho: "porte.fonte", fonte: p424("arts. 10, 14 e 26", "Os projetos desportivos ou paradesportivos deverão ser enquadrados em apenas uma das manifestações abaixo") },
  { caminho: "objeto.regras[metas_da_ato].fonte", fonte: p424("art. 64, III; art. 42, parágrafo único", "o cumprimento das metas do projeto aprovado.") },
  { caminho: "objeto.regras[percentual_de_atingimento].fonte", fonte: p424("art. 6º, IV, c; art. 7º, III; art. 72, I", "metas qualitativas e quantitativas, com seus respectivos indicadores e instrumentos de verificação") },
  // ausente
  {
    caminho: "objeto.regras[rede_publica].fonte",
    regra: { descricao: "No desporto educacional de atividade regular, ao menos 50% de alunos da rede pública." },
    fonte: { documento: "Decreto 6.180/2007", dispositivo: "art. 17", aConfirmar: true, nota: "Texto do Decreto 6.180/2007 não conferido (o Planalto não abriu); a P424 não trata." },
  },
  // diferente
  {
    caminho: "objeto.regras[acessibilidade].fonte",
    regra: { descricao: "Medidas de acessibilidade para pessoas com deficiência, com mobilidade reduzida e idosas, compatíveis com o objeto e analisadas na PCF; a P424 não pede fotos." },
    fonte: p424("art. 11; art. 75, V", "deverão contemplar medidas que garantam acesso às pessoas com deficiência ou com mobilidade reduzida e às pessoas idosas em atividades de esporte e lazer"),
  },
  { caminho: "objeto.regras[beneficiados].fonte", fonte: p424("art. 69, III; art. 72, III e § 2º", "relação de beneficiários") },
  // ausente
  { caminho: "objeto.regras[ingressos_nao_distribuidos].fonte", fonte: { documento: "Decreto 6.180/2007", dispositivo: "art. 10, § 2º", aConfirmar: true, nota: "Texto do Decreto 6.180/2007 não conferido (o Planalto não abriu); a P424 não trata." } },
  { caminho: "objeto.regras[receitas_revertidas].fonte", fonte: p424("art. 7º, § 4º; art. 72, § 5º", "Os recursos auferidos em função do projeto deverão constar do relatório de execução de receitas e despesas.") },
  // ausente
  { caminho: "objeto.regras[avaliacao_de_resultados].fonte", fonte: { documento: "Decreto 6.180/2007", dispositivo: "art. 33, §§ 1º e 3º", aConfirmar: true, nota: "Na P424, o RCO traz resultados, objetivos e repercussão (art. 72, I); custos estimados × reais e peritos vêm do decreto, cujo texto não foi conferido." } },
  { caminho: "objeto.regras[visita_tecnica].fonte", fonte: p424("art. 65; art. 66", "O DIFE poderá, a qualquer tempo e de ofício, realizar visita técnica de acompanhamento da execução do projeto, por meio de vistoria in loco", "A P424 fala em vistoria in loco e outros expedientes; não menciona visita virtual.") },
  // diferente
  {
    caminho: "objeto.fonte",
    regra: { descricao: "Relatório de Cumprimento do Objeto (RCO) com resultados esperados e atingidos, objetivos previstos e alcançados e repercussão na comunidade e no esporte; beneficiados, calendário atualizado de eventos e fotos dos materiais e da realização." },
    fonte: p424("art. 72, I, III, XI, XII e XIII", "relatório de cumprimento do objeto, que mencionará os resultados esperados e atingidos, os objetivos previstos e alcançados e a repercussão da iniciativa na comunidade e no desenvolvimento do esporte"),
  },
  { caminho: "divulgacao.aprovacaoPrevia.fonte", fonte: p424("art. 40, I e § 4º; art. 95, caput", "Plano de Divulgação da Lei de Incentivo ao Esporte - PDLIE previamente aprovado pela Assessoria de Comunicação Social do Ministério da Cidadania", "O envio das peças finalizadas à ASCOM, em PDF ou JPG, vem da P10 e do modelo do PDLIE.") },
  // ausente
  { caminho: "divulgacao.defeso.fonte", fonte: { documento: "Manual de assinatura no período eleitoral (SICOM, jun/2026)", dispositivo: "p. 2 a 6; Manual de Divulgação da LIE, versão defeso", aConfirmar: true, nota: "A P424 manda seguir o Manual de Divulgação e as regras da SECOM (art. 40, § 4º); o defeso vem da lei eleitoral e vale para qualquer projeto." } },
  { caminho: "divulgacao.regras[exposicao_equivalente].fonte", fonte: p424("art. 94, § 2º", "A exposição do selo da Lei de Incentivo ao Esporte e da marca do Governo Federal deverá ser equivalente a do maior patrocinador.") },
  { caminho: "divulgacao.regras[selo_a_cada_insercao].fonte", fonte: p424("art. 96", "deverá ocorrer, obrigatoriamente, a inserção do selo da Lei de Incentivo ao Esporte e das marcas da Secretaria Especial do Esporte, do MC, e do Governo Federal, com igual exposição.") },
  { caminho: "divulgacao.regras[marcas_sem_distorcao].fonte", fonte: p424("art. 97, I a III", "alterar as cores institucionais do selo da Lei de Incentivo ao Esporte e suas posições") },
  { caminho: "divulgacao.regras[comprovacao].fonte", fonte: p424("art. 98; art. 72, X", "A execução do PDLIE poderá ser comprovada por meio de fotos, filmagens, gravações, peças de mídia, ou quaisquer outros documentos aptos a demonstrarem a sua observância.") },
  { caminho: "divulgacao.regras[reincidencia].fonte", fonte: p424("art. 97, §§ 1º e 2º", "que poderá impedir o proponente de apresentar novos projetos de que trata a Lei nº 11.438, de 2006, por um período de 24 (vinte e quatro) meses.", "A P424 fixa o período em 24 meses, por decisão da CTLIE provocada pelo DIFE.") },
  // ausente
  { caminho: "divulgacao.regras[expressao_apresenta].fonte", fonte: { documento: "Manual de Divulgação da LIE, versão defeso (jul/2026)", dispositivo: "p. 14", nota: "A P424 manda observar o manual (arts. 40, § 4º, e 94)." } },
  // ausente
  { caminho: "divulgacao.regras[tamanho_minimo].fonte", fonte: { documento: "Manual de Divulgação da LIE, versão defeso (jul/2026)", dispositivo: "p. 6 e 15 a 18", nota: "A P424 remete ao manual as especificações de tamanho, duração, formato e posição (art. 94, I)." } },
  { caminho: "divulgacao.regras[patrocinador_no_titulo].fonte", fonte: p424("art. 12 e parágrafo único", "desde que o Ministério da Cidadania e a Secretaria Especial do Esporte sejam inseridos em todos os meios de comunicação como apresentador do projeto em questão.") },
  { caminho: "divulgacao.fonte", fonte: p424("arts. 94 a 98 (equivalentes aos arts. 90 a 94 da P10); art. 40, I e § 4º", "A entidade proponente deverá observar a inserção da Bandeira Nacional no Selo da Lei de Incentivo ao Esporte") },
  { caminho: "envio.documentos[rco].fonte", fonte: p424("art. 69, I; art. 72, I", "relatório de cumprimento parcial do objeto, que mencionará os resultados esperados e atingidos") },
  { caminho: "envio.documentos[recursos_humanos].fonte", fonte: p424("art. 69, II; art. 72, II", "relação de pessoal contratado") },
  { caminho: "envio.documentos[beneficiados].fonte", fonte: p424("art. 69, III; art. 72, III", "relação de beneficiários") },
  { caminho: "envio.documentos[receita_e_despesa].fonte", fonte: p424("art. 69, IV; art. 72, IV", "relatórios de receitas e despesas, de execução físico-financeira e de pagamentos") },
  { caminho: "envio.documentos[eventos].fonte", fonte: p424("art. 69, V; art. 72, XI", "calendário atualizado de eventos/atividades") },
  // diferente
  {
    caminho: "envio.documentos[grade].fonte",
    regra: { obrigatorio: false },
    fonte: p424("art. 40, II", "calendário de atividades ou eventos discriminando grade horária, locais e datas de execução de cada núcleo do projeto", "Na P424 a grade é condição para assinar o Termo de Compromisso; a PCP (art. 69) e a PCF (art. 72) não a pedem."),
  },
  // diferente
  { caminho: "envio.documentos[grade_rh].fonte", remover: "Só da P10 (art. 65, VII); a PCP da P424 tem 9 peças (art. 69, I a IX)." },
  { caminho: "envio.documentos[divulgacao].fonte", fonte: p424("art. 69, VI; art. 72, X", "comprovação de divulgação (PDLIE) e execução") },
  { caminho: "envio.documentos[fotos_materiais].fonte", fonte: p424("art. 69, VII; art. 72, XII", "fotografias dos materiais e equipamentos adquiridos através do projeto") },
  { caminho: "envio.documentos[fotos_reportagens].fonte", fonte: p424("art. 69, VIII; art. 72, XIII", "fotografias e reportagens que comprovem o andamento do projeto") },
  { caminho: "envio.documentos[certidoes].fonte", fonte: p424("art. 69, IX", "certidões de regularidade fiscal, tributária e trabalhista.") },
  // ausente
  {
    caminho: "envio.documentos[a_executar].fonte",
    regra: { obrigatorio: false },
    fonte: { documento: "Formulário PCP/PCF 2026 (modelo oficial do MESP)", dispositivo: "aba A EXECUTAR", nota: "A P424 não lista o cronograma a executar na PCP (art. 69); ele cabe no item IV, execução físico-financeira, no formulário do DIFE (art. 69, § 1º)." },
  },
  { caminho: "envio.documentos[extratos].fonte", fonte: p424("art. 72, V; art. 77, IV", "cópia do extrato da conta bancária específica, desde o dia do recebimento dos recursos até a data do último pagamento") },
  { caminho: "envio.documentos[rendimentos].fonte", fonte: p424("art. 72, VI; art. 29, § 6º", "demonstrativo de rendimentos das aplicações") },
  { caminho: "envio.documentos[gru_ou_transferencia].fonte", fonte: p424("art. 72, VII", "comprovante de recolhimento dos recursos não aplicados, mediante GRU ou comprovante de transferência dos recursos", "O inciso remete aos arts. 59 e 60; o art. 60 foi revogado pela Portaria 638/2021 e a regra ficou no art. 59.") },
  { caminho: "envio.documentos[comprovantes_despesa].fonte", fonte: p424("art. 72, VIII", "cópia dos documentos comprobatórios das despesas, acompanhados dos documentos constantes dos artigos arts. 47 a 55") },
  // diferente
  {
    caminho: "envio.documentos[bens].fonte",
    regra: { em: ["final"] },
    fonte: p424("art. 72, IX", "relação de bens adquiridos, produzidos ou construídos com recursos da Lei de Incentivo ao Esporte"),
  },
  // ausente
  { caminho: "envio.documentos[diarias].fonte", fonte: { documento: "Modelo RCO 2026 (MESP)", dispositivo: "item IV, n", nota: "Do modelo e do formulário, comuns aos dois regimes; a P424 trata do recibo de diárias (art. 47, § 2º)." } },
  { caminho: "envio.modelos[formulario_pcp_pcf].fonte", fonte: p424("art. 72, § 2º; art. 69, § 1º", "Para os itens I, II, III e IV deverão ser adotados os formulários aprovados pelo DIFE e disponibilizados no sítio da SEESP.") },
  { caminho: "envio.modelos[rco].fonte", fonte: p424("art. 72, § 2º", "Para os itens I, II, III e IV deverão ser adotados os formulários aprovados pelo DIFE e disponibilizados no sítio da SEESP.") },
  // ausente
  { caminho: "envio.modelos[carimbos].fonte", fonte: { documento: "Modelo de carimbos (MESP, 2023)", dispositivo: "frente e verso", nota: "Publicado na vigência da P424; aplica o art. 47, § 1º (nº SLI em todos os comprovantes)." } },
  { caminho: "envio.modelos[planilha_orcamentaria].fonte", fonte: p424("art. 7º, § 3º; art. 9º", "As receitas auferidas em razão do projeto devem estar previstas em orçamento analítico, conforme modelo definido pelo DIFE.") },
  // alterada_depois
  { caminho: "envio.modelos[planilha_remanejamento].fonte", fonte: { documento: P424_33, dispositivo: "art. 57, §§ 1º e 7º", nota: "Remanejamento informado em 5 dias com a documentação atualizada e comprovado na PCF." } },
  // ausente
  { caminho: "envio.modelos[gru].fonte", fonte: { documento: "Orientações para recolhimento de valores ao Tesouro (MESP, 2023)", dispositivo: "p. 1 a 3", nota: "Publicadas na vigência da P424, que manda recolher por GRU sem dar instruções." } },
  // diferente
  {
    caminho: "envio.regras[formularios_obrigatorios].fonte",
    regra: { descricao: "Itens I a IV da PCF e da PCP nos formulários do DIFE." },
    fonte: p424("art. 72, § 2º; art. 69, § 1º", "Para os itens I, II, III e IV, deverão ser adotados os formulários"),
  },
  // ausente
  { caminho: "envio.regras[marcador_parcial_final].fonte", fonte: { documento: "Formulário PCP/PCF 2026 (modelo oficial do MESP)", dispositivo: "células E1/E2, J1/J2, H1/H2, I1/I2, M1/M2, G1/G2 e K1/K2", nota: "Regra do formulário oficial, que a P424 manda usar (arts. 69, § 1º, e 72, § 2º)." } },
  // ausente
  { caminho: "envio.regras[numeracao_do_plano].fonte", fonte: { documento: "Formulário PCP/PCF 2026 (modelo oficial do MESP)", dispositivo: "instruções das abas", nota: "Instrução do formulário oficial, comum aos dois regimes." } },
  { caminho: "envio.regras[responsabilidade_do_contador].fonte", fonte: p424("art. 72, § 1º", "O Contador e Proponente são inteiramente responsáveis pelas informações prestadas, sob pena de responder pelos seus atos cível, penal e administrativamente.") },
  // diferente
  {
    caminho: "envio.regras[arquivos].fonte",
    regra: { descricao: "PDF pesquisável com OCR, até 10 MB por arquivo, com as declarações assinadas.", parametros: { mb: 10 } },
    fonte: p424("art. 5º, caput; art. 6º, § 5º", "formato PDF pesquisável OCR, devendo ser inserido no Sistema da Lei de Incentivo ao Esporte, com cada arquivo enviado não excedendo o tamanho superior a 10 MB.", "Regra escrita para a apresentação do projeto; estendida à prestação por cautela."),
  },
  { caminho: "posEnvio.resultados[aprovada].fonte", fonte: p424("art. 83, I", "aprovada quando os recursos tiverem aplicação regular e a execução do projeto tiver avaliação técnica satisfatória") },
  { caminho: "posEnvio.resultados[aprovada_ressalvas].fonte", fonte: p424("art. 83, II", "aprovada com ressalvas quando, apesar de regulares as contas, a execução do projeto tiver obtido avaliação técnica insatisfatória, desde que não resulte em prejuízo ao erário ou descumprimento do objeto") },
  { caminho: "posEnvio.resultados[aprovada_parcialmente].fonte", fonte: p424("art. 83, III", "aprovada parcialmente quando, apesar da execução do projeto tiver obtido avaliação técnica satisfatória, forem identificadas irregularidades nas contas, resultando em prejuízo ao erário") },
  { caminho: "posEnvio.resultados[reprovada].fonte", fonte: p424("art. 83, IV", "reprovada quando, independentemente do resultado do relatório quanto ao cumprimento do objeto e execução física do projeto, tenha as contas consideradas irregulares no Parecer de Avaliação Final.") },
  // ausente
  { caminho: "posEnvio.devolucao.gru[18004-1].fonte", fonte: { documento: "Orientações para recolhimento de valores ao Tesouro (MESP, 2023)", dispositivo: "p. 1 a 3", aConfirmar: true, nota: "Dados do Tesouro, não da P424; valem para os dois regimes enquanto o MESP não publicar outros. O exemplo do próprio PDF mostra UG 180002; UG e código ficam configuráveis." } },
  // diferente
  {
    caminho: "posEnvio.devolucao.fonte",
    regra: {
      descricao: "GRU: saldo na PCF, reprovação em 45 dias da ciência e ressalva por cumprimento parcial ou arquivamento em 30 dias, com os rendimentos; despesa fora da vigência é ressarcida, sem multa.",
      atualizacao: "IN TCU 71/2012.",
    },
    fonte: p424("art. 84, caput e §§ 3º e 4º; art. 46; art. 72, VII", "sob pena de ressarcimento e demais penalidades cabíveis."),
  },
  { caminho: "posEnvio.regras[duas_analises].fonte", fonte: p424("arts. 75, 76, 77 e 78", "emitirá Parecer de Avaliação Final do projeto sugerindo a aprovação, aprovação parcial, aprovação com ressalva ou reprovação") },
  // diferente
  {
    caminho: "posEnvio.regras[diligencia_por_email].fonte",
    regra: { codigo: "diligencia_pelo_sistema", descricao: "Diligência da PCF pelo sistema eletrônico da LIE, com recebimento acusado em 1 dia útil e 30 dias improrrogáveis para responder; a falta de documentos leva à reprovação e à TCE." },
    fonte: p424("art. 72, §§ 3º e 4º; art. 88, § 1º, II, f", "As diligências poderão ser solicitadas via sistema eletrônico da Lei de Incentivo ao Esporte, cujo recebimento deverá ser acusado em até 1 (um) dia útil."),
  },
  { caminho: "posEnvio.regras[tce].fonte", fonte: p424("art. 88, § 1º, I e II, a a f, e § 3º, II; art. 92", "A TCE deve ser encaminhada ao TCU em até cento em oitenta dias após a sua instauração") },
  { caminho: "posEnvio.regras[prescricao].fonte", fonte: p424("art. 85", "Transcorrido o prazo de 5 (cinco) anos, contados da apresentação dos documentos previstos no art. 72 desta Portaria, fica caracterizada a prescrição para aplicação das sanções") },
  // ausente
  { caminho: "posEnvio.regras[multa_vantagem].fonte", fonte: { documento: "LC 222/2025", dispositivo: "arts. 20 e 21", nota: "Vale pelos projetos da P424 (Portaria MESP 10/2026, art. 102); antes, Lei 11.438/2006, art. 11, II." } },
  { caminho: "posEnvio.fonte", fonte: p424("arts. 75 a 93 (equivalentes aos arts. 71 a 88 da P10)", "O parecer de prestação de contas final emitido pelo DIFE juntamente com o processo digitalizado será encaminhado à Coordenação Geral de Prestação de Contas - CGPC") },
  { caminho: "guarda.fonte", fonte: p424("art. 73; art. 81; art. 51, § 1º", "deverão ser arquivados na sede do proponente, por no mínimo 10 (dez) anos após a avaliação da Prestação de Contas Final") },
];
