# LIE: conferência na Portaria 424/2020 das regras "a confirmar"

> Leitura feita em 05/10/2026. As decisões tomadas a partir dela estão em `lib/prestacao/regimes/conferencias/lie-p424-2020.ts`, aplicadas na versão 2 do regime.

147 regras "a confirmar" do regime conferidas no texto compilado da P424 (PDF do Ministério, com as Portarias 454/2020 e 638/2021).

Também baixei do DOU a P424 original e as alterações: 454/2020, 638/2021, 675/2021, 834/2022, 62/2023, 82/2023, 2/2024, MESP 84/2024 e MESP 33/2025. Com elas foi possível classificar as regras como `alterada_depois` e achar erros no PDF compilado (ver o fim deste arquivo).

## Contagem

| Veredito | Itens |
|---|---|
| confirmada | 100 |
| ausente | 29 |
| diferente | 15 |
| alterada_depois | 3 |

## Diferenças relevantes

**Prazos**
- **Análise da PCF** (`prazos.analisePrestacao`), **alterada_depois**: o art. 86 compilado dá 360 dias para a análise técnica e 180 para a financeira. A P33/2025 mudou para 360 e 360. A regra atual está certa e agora tem dispositivo (art. 86).
- **Diligência da PCF** (`posEnvio.regras[diligencia_por_email]`): pelo sistema eletrônico da LIE, não por e-mail, com recebimento acusado em 1 dia útil e 30 dias improrrogáveis para responder (art. 72, §§ 3º e 4º). A P424 não prevê arquivamento nem indeferimento na PCF.

**Documentos e envio**
- **PCP** (`prestacaoParcial.fonte`, `pcp_pelo_sei`, `formularios_obrigatorios`): enviada via Sistema Eletrônico, Remessa Postal ou e-mail, não pelo SEI. Tem 9 peças (art. 69, I a IX), não 11, e formulário do DIFE obrigatório só para os itens I a IV (art. 69, § 1º), não I a VII.
- **Grade horária das atividades** (`envio.documentos[grade]`): a P424 não pede na PCP nem na PCF. É condição para assinar o Termo de Compromisso (art. 40, II).
- **Grade de RH** (`envio.documentos[grade_rh]`): não existe na P424. É exclusiva da P10 (art. 65, VII).
- **Bens** (`envio.documentos[bens]`): só na PCF (art. 72, IX), não na PCP.
- **RCO e peças da PCF** (`objeto.fonte`): conteúdo do art. 72, I, III, XI a XIII, sem grade horária e sem fotos de acessibilidade.
- **Arquivos** (`envio.regras[arquivos]`): PDF pesquisável com OCR, até **10 MB** por arquivo (art. 5º), não 25 MB.

**Percentuais, valores e devolução**
- **Devolução** (`posEnvio.devolucao.fonte`): sem multa de 5% para despesa fora da vigência, que gera só ressarcimento (art. 46). Os prazos são 45 dias na reprovação e 30 dias na ressalva por cumprimento parcial ou no arquivamento (art. 84 e § 4º). "GRU só no BB" e "mora calculada pelo MESP" não estão na P424.
- **Compras** (`pagamentos.regras[ate_o_aprovado]`), **alterada_depois**: o art. 51 compilado exige sempre cotação com 3 orçamentos. A P33/2025 dispensou novos orçamentos até o valor aprovado na ATO e só os exige quando há majoração (art. 51, caput e § 3º).
- **Encargos** (`orcamento.regras[encargos_proprios]`): a P424 só exige forma de contratação e encargos explicitados no projeto (art. 50, § 2º) e permite prever todos os encargos (art. 54, parágrafo único). Não há marcação de salário bruto ou líquido nem vedação de encargo não autorizado.

**Alterações do plano**
- **Inclusão de item** (`alteracoes.tipos.inclusao`): não há via na P424. O remanejamento só mexe em itens previstos (art. 57, § 2º) e a readequação veda itens não autorizados originalmente (art. 57-A, § 1º). A única exceção é a ATO com captação parcial, a pedido do DIFE (art. 34, § 7º).
- **Uso de rendimentos** (`alteracoes.regras[uso_de_rendimentos]`): não há pedido formal com valor exato. A destinação vai em planilha específica no Plano de Trabalho, com relatório próprio e justificativa no RCO (art. 29, §§ 2º, 5º e 6º).
- **Planilha de remanejamento** (`envio.modelos[planilha_remanejamento]`), **alterada_depois**: a P33/2025 trocou o § 3º do art. 57, que previa os formulários do DIFE. Sem efeito prático: o § 1º novo exige enviar a documentação atualizada em 5 dias.

**Sanções e requisitos**
- **CRC no nível excelência** (`despesas.regras[crc_excelencia]`): a P424 não dá 30 dias para renovar nem suspende pagamentos. Exige zelar pela validade durante a execução (art. 35, parágrafo único). Sem a certidão, o projeto é rejeitado e arquivado, com recolhimento via GRU (art. 34, § 13).
- **Acessibilidade** (`objeto.regras[acessibilidade]`): a obrigação é a mesma (art. 11; art. 75, V), mas a P424 não exige fotos.

## Ausentes (29)

**Valem mesmo assim, por lei ou decreto.** Vêm da LC 222/2025 ou do Decreto 12.861/2026, e quase todas já estavam no Decreto 6.180/2007 ou na Lei 11.438/2006.

| Regra | Norma |
|---|---|
| Atividade-fim inclui o pessoal indispensável | Dec. 6.180, art. 11, § 1º |
| Credor ligado ao incentivador | Lei 11.438, art. 1º, § 5º |
| Espaço publicitário | Dec. 6.180, art. 13 |
| Cobrança dos beneficiários | Dec. 6.180, art. 15 |
| 50% de alunos da rede pública | Dec. 6.180, art. 17 |
| Ingressos não distribuídos | Dec. 6.180, art. 10, § 2º |
| Avaliação de custos e peritos | Dec. 6.180, art. 33 |
| Multa de 2 vezes a vantagem indevida | LC 222, arts. 20 e 21; Lei 11.438, art. 11, II |
| Tetos na redução e na inclusão | Dec. 12.861, art. 12; art. 26 da P424 |

**Subcontratação:** é regra nova do Decreto 12.861 (art. 13), sem equivalente anterior.

**Exclusivas da P10**

| Item | Dispositivo da P10 |
|---|---|
| `pcp_sem_merito` | art. 66 |
| Redução como alteração formal | art. 43 |
| `outra_alteracao` | art. 43 |
| `beneficio_de_convencao` | art. 44, § 4º |

**De modelos, manuais ou do Tesouro, comuns aos dois regimes**
- Base meio ÷ fim
- Total geral
- Aba A EXECUTAR
- Demonstrativo de diárias
- Carimbo
- Orientações de GRU e códigos de GRU
- Marcador PARCIAL/FINAL
- Numeração do plano
- Expressão "apresenta"
- Tamanhos mínimos
- Defeso eleitoral (a P424 manda seguir as regras da SECOM, art. 40, § 4º)

**Outras**
- **Tarifas:** a P424 também é silente, o que confirma a regra `norma_silente`.
- **Aplicabilidade:** o corte vem da P10, art. 102.

## Fora da lista: problemas no regime P424 achados na conferência

1. **Art. 26, § 1º, revogado pela Portaria MC 834/2022.** O regime troca a base do teto de elaboração e captação para "valor_captado" citando esse parágrafo. Hoje a base é fim + meio (art. 26, I a IV).
2. **Art. 29, § 3º: o PDF compilado está errado.** O texto da Portaria 638/2021 no DOU **permite** usar rendimentos em despesa administrativa, elaboração e captação e pessoal, "caso configure item necessário e com relação direta com a execução". A vedação é da redação de 2020. O regime (`contas.rendimentos`) usa a vedação.
3. **Art. 71, § 3º.** O "DIFE dá 30 dias para apresentar ou recolher" é a redação original de 2020. Desde a Portaria 638/2021, o DIFE recolhe o saldo das duas contas e recomenda TCE. A Portaria 62/2023 (§ 4º) acrescentou que o acesso ao SLI fica suspenso e os outros projetos ficam paralisados; a P33/2025 (§ 6º) acrescentou que, sanada a PCF, o acesso volta, mas o saldo não pode ser usado em outro projeto. Afeta `prazos.notificacaoOmissao` e `posEnvio.regras[pcf_fora_do_prazo]`.
4. **Art. 60 revogado pela Portaria 638/2021.** `prazos.transferenciaSaldo` e `contas.saldo` citam o art. 60, § 2º. Os 120 dias continuam no art. 59, I, para a conta CAPTAÇÃO. A conta MOVIMENTO volta à CAPTAÇÃO ou vai para GRU (art. 59, II). O art. 59-A (Portaria 2/2024) trata do reaproveitamento pela DPPIE.
5. **Ressalva geral.** A P10, art. 102, manda observar "o normativo vigente à época do protocolo". As alterações de 2021 a 2025 (inclusive a P33/2025) podem não alcançar projetos protocolados antes delas. Vale decidir se o regime terá versões por data de protocolo.
