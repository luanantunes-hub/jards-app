# PRONON e PRONAS/PCD: regras "a confirmar" conferidas no Anexo LXXXVI (PRC 5/2017)

> Leitura feita em 05/10/2026. As decisões tomadas a partir dela estão em `lib/prestacao/regimes/conferencias/saude-lxxxvi-2017.ts`, aplicadas na versão 2 do regime.

As 88 regras "a confirmar" do regime foram conferidos no texto do Anexo LXXXVI do Saúde Legis, já com as alterações das PRT 695/2020, 751/2020, 1.484/2020, 3.314/2024 e 7.224/2025 e a retificação publicada no DOU de 12/03/2020. Os modelos (Anexos 1 a 10) também foram consultados. Todas as citações foram verificadas automaticamente como trechos literais do texto.

## Contagem

| Veredito | Itens |
|---|---|
| confirmada | 43 |
| diferente | 26 |
| ausente | 17 |
| fora_do_regime | 2 |

## Diferenças relevantes (por impacto no sistema)

1. **Despesas administrativas eram admitidas sem teto.** A frase "o regime não previa custos indiretos" está errada. Material de escritório, aluguel, correios, transporte administrativo, telefone, água, luz, internet e honorários administrativos, contábeis e advocatícios eram admitidos, só com detalhamento. O modelo de orçamento chama o bloco de capital de "custos indiretos". O regime derivado remove o grupo "administração". Base: art. 28 e Anexo 6. Itens: `orcamento.grupos[execucao]`, `orcamento.regras[sem_custos_indiretos]`.
2. **Obras: reformas admitidas, ampliação e construção vedadas.** As reformas exigiam declaração do responsável técnico e preço pelo SINAPI ou por 3 propostas. O regime derivado tira toda a vedação de obras. Base: arts. 34 e 35. Item: `despesas.regras[obras_com_requisitos]`.
3. **Rendimentos da Conta Movimento sem aprovação prévia.** Eram usados em ações do projeto a critério da instituição, com justificativa na prestação de contas. Só o uso em despesas administrativas, elaboração e captação dependia de autorização. Não existia Termo de Apostilamento. Base: art. 82, § 3º, II, na redação da PRT 751/2020. Item: `alteracoes.regras[rendimentos_por_apostilamento]`.
4. **Análise financeira de toda prestação.** O FNS analisava a parte contábil e financeira de todas as prestações. Ela só era dispensada quando o objeto era integralmente descumprido; não havia análise por exceção nem por amostragem. Base: art. 96, § 1º, e art. 97, § 2º. Itens: `porte`, `objeto.fonte`.
5. **Outros critérios de resultado.** Aprovada: aplicação regular e avaliação técnica satisfatória. Com ressalvas: contas regulares e avaliação técnica insatisfatória (não falta formal). Reprovada: objeto descumprido ou contas irregulares, mesmo com avaliação técnica favorável; a omissão também reprova. Base: art. 98, §§ 1º a 4º. Itens: `posEnvio.resultados[*]`.
6. **Pessoal do quadro.** Era vedado pagar profissionais que já atuavam na instituição, salvo aumento de carga horária. Base: art. 24, § 1º. Item: `fornecedores.regras[equipe_ligada_a_acao]`.
7. **Recurso na prestação de contas.** O recurso ia pela SE/MS, que o encaminhava em 5 dias à autoridade recorrida; mantida a decisão, ela o enviava em 5 dias à "autoridade superior". O anexo não tem prazo próprio de interposição; pelo art. 113 vale a Lei 9.784/1999: 10 dias. Não há 10 dias de reconsideração nem o Secretário-Executivo como última instância. Base: arts. 103 e 113. Item: `prazos.recurso`.
8. **Passagem executiva para PcD.** Primeira classe ou executiva era permitida, com justificativa, para pessoas com deficiência ou mobilidade reduzida. Base: art. 44, VII. Item: `despesas.vedadas[primeira_classe]`.
9. **Regularidade fiscal.** As certidões eram FGTS, INSS, CND conjunta da PGFN, CEPIM e CADIN; a CNDT não constava. A perda da regularidade levava ao descredenciamento. Base: art. 17, VII, VIII e § 3º, e art. 22, IV. Item: `contas.regras[regularidade]`.
10. **Relatório do objeto.** Pedia resultados esperados × atingidos, objetivos e custos estimados × reais, além de fotografias e reportagens. Listas de presença, vídeos e justificativa de metas não cumpridas não eram exigidos. Base: art. 92, I e XI, e art. 97. Itens: `objeto.regras[metas_resultados]`, `objeto.regras[evidencias]`.
11. **Remanejamento entre projetos.** O beneficiário podia receber até 20% acima do aprovado. O excedente além do teto do art. 70 podia ser remanejado em qualquer fase da execução do cedente. A SE/MS publicava o resultado em 20 dias. Base: art. 75, §§ 3º e 5º, e art. 78. Item: `alteracoes.regras[remanejamento_entre_projetos]`.
12. **Alterações sem apostilamento nem aditivo.** Os remanejamentos de rubricas tinham parecer conclusivo do órgão técnico, e as alterações do plano de trabalho iam ao órgão competente, que tinha 10 dias para se manifestar. O anexo não menciona Termo de Apostilamento nem termo aditivo. Base: art. 16, III, e arts. 86 e 87. Itens: `remanejamento.orientacoes[termo_de_apostilamento]`, `complementacao.orientacoes[termo_aditivo]`, `alteracoes.janela`.
13. **Tetos.** Havia só o de elaboração e captação (5% do valor total, até R$ 50 mil); não havia teto de custos indiretos. Base: art. 27, § 3º, e art. 44, V. Item: `remanejamento.requisitos[tetos]`.
14. **Preços de referência.** As fontes eram SIGEM, BPS, SIASG e SINAPI, ou 3 orçamentos. SIGTAP, PNCP e o parâmetro salarial da convenção coletiva não aparecem. Base: art. 51. Item: `orcamento.regras[precos_de_referencia]`.
15. **Órteses, próteses e meios de locomoção (OPM) em qualquer projeto.** Bastava o vínculo com o objeto; a compra não se restringia a habilitação e reabilitação. Base: art. 40. Item: `orcamento.regras[opm]`.
16. **Monitoramento.** O relatório de monitoramento só registrava as diligências. Não havia relatório anual, homologação em 45 dias nem conteúdo mínimo. Base: art. 89, § 4º. Item: `prestacaoParcial.regras[monitoramento_anual]`.
17. **Captação.** Começava com a publicação da portaria e corria no prazo fixado nela; o prazo original de 90 + 30 dias foi revogado em 2024. Não havia "notificação de abertura da conta". Base: arts. 55, V, 59, § 2º, e 60. Item: `contas.regras[captacao_depois_da_publicacao]`.
18. **Diferenças menores.**
    - A complementação não tinha o marco do "aviso antecipado de conclusão" (art. 70).
    - A exposição de marca do doador não aparece expressamente como vantagem indevida (arts. 66 e 105, X).

## Ausentes e fora do regime

- **Ausentes (17).** Os itens abaixo não existiam no anexo antigo:
  - prazo de 20 dias para certidões;
  - reserva de contingência;
  - suspensão a pedido;
  - custeio duplo genérico;
  - procedimentos com equipamentos (Edital 3/2025);
  - docentes;
  - satisfação;
  - sustentabilidade na prestação de contas;
  - dados de pacientes;
  - contrapartida;
  - todo o bloco de divulgação (5 itens);
  - impropriedades registradas no Transferegov;
  - rescisão com restituição integral.

  Desses itens, só a infração por vantagem ao doador (Lei 12.715/2012) e a LGPD valem para qualquer projeto. O resto é do Anexo LXXXVI-A, da minuta do TC de 2025 ou do Edital 3/2025.
- **Fora do regime (2).**
  - A prestação do exercício 2025 até 31/05/2026 vem da Portaria SE/MS 928/2026, aplicada por decisão do MS.
  - O Manual Orientativo vem da Portaria GM/MS 8.031/2025, art. 2º. Para projetos antigos, a referência é o art. 92 e os Anexos 1 a 10 do Anexo LXXXVI.

## Achados fora da lista (em `saude-lxxxvi-2017.ts`)

- `posEnvio.devolucao.atualizacao` diz que o regime anterior "não fixa índice". O art. 101 fixa a atualização desde a captação pelo índice oficial da caderneta de poupança, na reprovação.
- `contas.rendimentos` descreve o art. 82 na redação original (fundo de curto prazo ou mercado aberto). A redação da PRT 751/2020 diz:
  - aplicação automática em poupança;
  - na Conta Movimento, opção entre poupança e fundo de curto prazo;
  - rendimentos da Conta Captação não contam para os 60% e os 100% (art. 82, § 3º, I, b). Portanto `contamComoCaptado` deveria ser `false`.
- `alteracoes.regras` fica com dois itens `remanejamento_entre_projetos`: o herdado e o do art. 75, § 3º.
