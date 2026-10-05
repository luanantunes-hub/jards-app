# Matriz de cobertura dos regimes

> Gerada por `scripts/prestacao-gerar-matriz-regimes.ts` a partir de `lib/prestacao/regimes`. Não edite à mão: mude o regime e gere de novo. O teste `tests/prestacao-regimes-cobertura.test.ts` falha se este arquivo ficar diferente do código ou se um regime deixar uma dimensão sem regras e sem lacuna explicada.

Cada célula resume o que o regime traz na dimensão. "Não se aplica" e "a norma não trata" vêm com o motivo e a fonte no detalhe abaixo. "A confirmar" conta as regras que vieram de fonte secundária ou ambígua: a checagem só alerta.

| Dimensão | Lei Rouanet — IN MinC 29/2026 (v2) | Lei de Incentivo ao Esporte — Portaria MESP 10/2026 (v1) | Lei de Incentivo ao Esporte — Portaria 424/2020 (v1) | PRONON e PRONAS/PCD — Anexo LXXXVI-A (v1) | PRONON e PRONAS/PCD — Anexo LXXXVI (anterior) (v1) | Genérico (sem regras de lei) (v2) |
|---|---|---|---|---|---|---|
| Versão da norma pela data | atos desde 30/jan/2026 | protocolo desde 04/mar/2026 (1 a confirmar) | protocolo de 23/jun/2020 a 03/mar/2026 (1 a confirmar) | atos desde 08/set/2025 | aprovação de 28/set/2017 a 07/set/2025 | não se aplica |
| Prazos | 8 prazos; envio em 60 dias do fim da execução | 10 prazos; envio em 60 dias do fim da execução | 10 prazos; envio em 60 dias do fim da execução (6 a confirmar) | 13 prazos; envio em 4 meses do fim do exercício | 11 prazos; envio em 4 meses do fim do exercício (4 a confirmar) | nenhum prazo de lei; os essenciais dizem por quê |
| Prestação parcial | contínua (1 a confirmar) | a pedido do órgão, por parcela | a pedido do órgão, por parcela (4 a confirmar) | periódica | periódica (3 a confirmar) | não se aplica |
| Orçamento, grupos e tetos | 6 grupos, 4 tetos (custos de administração 15%, acessibilidade 20%…) | 3 grupos, 2 tetos (despesas administrativas (atividade-meio) 15%, elaboração e captação 10%) | 3 grupos, 2 tetos (despesas administrativas (atividade-meio) 15%, elaboração e captação 10%) (13 a confirmar) | 3 grupos, 2 tetos (custos indiretos 15%, elaboração da proposta e captação 5%) | 2 grupos, 1 teto (elaboração do projeto e captação 5%) (11 a confirmar) | 6 grupos, 0 tetos |
| Alterações do orçamento | remanejamento livre com condições; silêncio aprova (1 a confirmar) | remanejamento livre com condições; silêncio não aprova (1 a confirmar) | remanejamento livre com condições; silêncio não aprova (15 a confirmar) | remanejamento com pedido; silêncio não aprova | remanejamento com pedido; silêncio não aprova (14 a confirmar) | não se aplica |
| Fornecedores e partes relacionadas | fornecedor 20%, proponente 20%, proponente 30% | 4 regras, sem limite percentual | 4 regras, sem limite percentual (6 a confirmar) | 4 regras, sem limite percentual | 4 regras, sem limite percentual (6 a confirmar) | não se aplica |
| Contas, liberação e rendimentos | 2 contas (Banco do Brasil), liberação com 20% (1 a confirmar) | 2 contas (Banco do Brasil ou Caixa Econômica Federal), liberação sem percentual | 2 contas (Banco do Brasil ou Caixa Econômica Federal), liberação sem percentual (8 a confirmar) | 2 contas (Instituição financeira oficial (na prática, Banco do Brasil)), liberação com 100% (1 a confirmar) | 2 contas (Banco do Brasil), liberação com 100% (8 a confirmar) | não se aplica |
| Meios de pagamento e documento fiscal | pix, ted, doc, boleto, debito_automatico (2 a confirmar) | qualquer meio bancário; vedado: saque | qualquer meio bancário; vedado: saque (13 a confirmar) | qualquer meio bancário; vedado: saque (1 a confirmar) | qualquer meio bancário | não se aplica |
| Período e despesas vedadas | 13 vedações, 4 regras | 12 vedações, 4 regras (1 a confirmar) | 12 vedações, 4 regras (17 a confirmar) | 13 vedações, 2 regras | 12 vedações, 3 regras (16 a confirmar) | não se aplica |
| Porte | pequeno até R$ 750.000, medio até R$ 5.000.000, grande (1 a confirmar) | não se aplica | não se aplica (1 a confirmar) | não se aplica | não se aplica (1 a confirmar) | não se aplica |
| Objeto, metas e contrapartidas | 15 regras | 9 regras | 9 regras (10 a confirmar) | 11 regras | 11 regras (11 a confirmar) | não se aplica |
| Divulgação, marcas e defeso | 3 marcas, aprovação prévia, defeso (2 a confirmar) | 4 marcas, aprovação prévia, defeso (1 a confirmar) | 4 marcas, aprovação prévia, defeso (11 a confirmar) | 1 marcas (1 a confirmar) | 1 marcas (5 a confirmar) | não se aplica |
| Envio, documentos e modelos | Salic; 11 documentos, 1 modelo | SEI (PCP) e protocolo digital (PCF); 19 documentos, 6 modelos (1 a confirmar) | Sistema eletrônico, remessa postal ou e-mail; 18 documentos, 6 modelos (29 a confirmar) | Transferegov; 16 documentos, 0 modelos | AR, Sedex ou protocolo; 15 documentos, 0 modelos (2 a confirmar) | não se aplica |
| Análise, resultado e devolução | 3 resultados, GRU 019473 | 4 resultados, GRU 18004-1 (1 a confirmar) | 4 resultados, GRU 18004-1 (12 a confirmar) | 3 resultados (1 a confirmar) | 3 resultados (7 a confirmar) | não se aplica |
| Guarda de documentos | 5 anos do fim da execução | 10 anos da decisão | 10 anos da decisão (1 a confirmar) | 5 anos da decisão | 5 anos da decisão | não se aplica |
| **Regras com fonte** | 180 | 171 | 168 | 145 | 136 | 26 |
| **A confirmar** | 8 | 6 | 147 | 4 | 88 | 0 |

## Lei Rouanet — IN MinC 29/2026 (v2)

- Código: `rouanet_in29_2026`. Órgão: Ministério da Cultura. Sistema: Salic.
- Norma: Lei 8.313/1991; IN MinC 29/2026, alterada pela IN MinC 34/2026.

| Dimensão | Situação | Fontes | A confirmar |
|---|---|---|---|
| Versão da norma pela data | atos desde 30/jan/2026 | 1 | 0 |
| Prazos | 8 prazos; envio em 60 dias do fim da execução | 8 | 0 |
| Prestação parcial | contínua | 4 | 1 |
| Orçamento, grupos e tetos | 6 grupos, 4 tetos (custos de administração 15%, acessibilidade 20%…) | 22 | 0 |
| Alterações do orçamento | remanejamento livre com condições; silêncio aprova | 26 | 1 |
| Fornecedores e partes relacionadas | fornecedor 20%, proponente 20%, proponente 30% | 13 | 0 |
| Contas, liberação e rendimentos | 2 contas (Banco do Brasil), liberação com 20% | 12 | 1 |
| Meios de pagamento e documento fiscal | pix, ted, doc, boleto, debito_automatico | 10 | 2 |
| Período e despesas vedadas | 13 vedações, 4 regras | 19 | 0 |
| Porte | pequeno até R$ 750.000, medio até R$ 5.000.000, grande | 4 | 1 |
| Objeto, metas e contrapartidas | 15 regras | 16 | 0 |
| Divulgação, marcas e defeso | 3 marcas, aprovação prévia, defeso | 9 | 2 |
| Envio, documentos e modelos | Salic; 11 documentos, 1 modelo | 21 | 0 |
| Análise, resultado e devolução | 3 resultados, GRU 019473 | 14 | 0 |
| Guarda de documentos | 5 anos do fim da execução | 1 | 0 |

A confirmar:

- Prestação parcial: Manual do Proponente, Módulo II (MinC, ago/2026), p. 57 (Régua do manual; a IN usa a de 30% do art. 65, § 3º.)
- Alterações do orçamento: Manual do Proponente, Módulo II (MinC, ago/2026), p. 36
- Contas, liberação e rendimentos: IN MinC 29/2026, arts. 69 e 70
- Meios de pagamento e documento fiscal: IN MinC 29/2026, art. 58; Anexo I, XVI
- Meios de pagamento e documento fiscal: IN MinC 29/2026, art. 58 ("Como PIX e TED" é exemplificativo: boleto e débito de guia são meios formais. Outros meios geram alerta, não bloqueio.)
- Porte: IN MinC 29/2026, art. 73, §§ 3º e 4º (A IN não diz se a base é o captado ou o aprovado.)
- Divulgação, marcas e defeso: Manual de Uso das Marcas do Pronac, versão defeso (jun/2026), p. 1 a 8 (O manual não fixa a data de fim; o calendário regulatório guarda o defeso.)
- Divulgação, marcas e defeso: Manual de Uso das Marcas do Pronac (jan/2026), p. 39

## Lei de Incentivo ao Esporte — Portaria MESP 10/2026 (v1)

- Código: `lie_p10_2026`. Órgão: Ministério do Esporte. Sistema: SLI e SEI.
- Norma: LC 222/2025; Decreto 12.861/2026; Portaria MESP 10/2026.

| Dimensão | Situação | Fontes | A confirmar |
|---|---|---|---|
| Versão da norma pela data | protocolo desde 04/mar/2026 | 1 | 1 |
| Prazos | 10 prazos; envio em 60 dias do fim da execução | 10 | 0 |
| Prestação parcial | a pedido do órgão, por parcela | 4 | 0 |
| Orçamento, grupos e tetos | 3 grupos, 2 tetos (despesas administrativas (atividade-meio) 15%, elaboração e captação 10%) | 15 | 0 |
| Alterações do orçamento | remanejamento livre com condições; silêncio não aprova | 26 | 1 |
| Fornecedores e partes relacionadas | 4 regras, sem limite percentual | 6 | 0 |
| Contas, liberação e rendimentos | 2 contas (Banco do Brasil ou Caixa Econômica Federal), liberação sem percentual | 11 | 0 |
| Meios de pagamento e documento fiscal | qualquer meio bancário; vedado: saque | 13 | 0 |
| Período e despesas vedadas | 12 vedações, 4 regras | 18 | 1 |
| Porte | Não se aplica: A LIE não classifica projetos por porte. O que muda regras é o nível da manifestação esportiva (formação, toda a vida, excelência), que define o limite de elaboração e captação e o de captação por projeto. | 1 | 0 |
| Objeto, metas e contrapartidas | 9 regras | 10 | 0 |
| Divulgação, marcas e defeso | 4 marcas, aprovação prévia, defeso | 11 | 1 |
| Envio, documentos e modelos | SEI (PCP) e protocolo digital (PCF); 19 documentos, 6 modelos | 31 | 1 |
| Análise, resultado e devolução | 4 resultados, GRU 18004-1 | 13 | 1 |
| Guarda de documentos | 10 anos da decisão | 1 | 0 |

A confirmar:

- Versão da norma pela data: Portaria MESP 10/2026, arts. 102 a 104 (O corte em 04/03/2026 é leitura dos arts. 102 a 104; a portaria não escreve a data.)
- Alterações do orçamento: Portaria MESP 10/2026, art. 52, § 1º (Leitura de "somente no segundo remanejamento sem a necessidade de prévia anuência": o primeiro pede aprovação.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 44, § 1º (Não se sabe se as tabelas de 2020 continuam a referência vigente.)
- Divulgação, marcas e defeso: Manual de assinatura no período eleitoral (SICOM, jun/2026), p. 2 a 6; Manual de Divulgação da LIE, versão defeso (Nenhuma norma da DPPIE trata da análise do PDLIE no defeso; é leitura dos dois manuais.)
- Envio, documentos e modelos: Portaria MESP 10/2026, arts. 5º e 6º, §§ 3º e 4º (Regra escrita para a apresentação do projeto; estendida à prestação por cautela.)
- Análise, resultado e devolução: Orientações para recolhimento de valores ao Tesouro (MESP, 2023), p. 1 a 3 (O exemplo do próprio PDF mostra UG 180002; não há orientação de 2026. UG e código ficam configuráveis.)

## Lei de Incentivo ao Esporte — Portaria 424/2020 (v1)

- Código: `lie_p424_2020`. Órgão: Ministério do Esporte. Sistema: SLI.
- Norma: LC 222/2025; Portaria MC 424/2020, com as alterações até a Portaria MESP 33/2025.

| Dimensão | Situação | Fontes | A confirmar |
|---|---|---|---|
| Versão da norma pela data | protocolo de 23/jun/2020 a 03/mar/2026 | 1 | 1 |
| Prazos | 10 prazos; envio em 60 dias do fim da execução | 10 | 6 |
| Prestação parcial | a pedido do órgão, por parcela | 4 | 4 |
| Orçamento, grupos e tetos | 3 grupos, 2 tetos (despesas administrativas (atividade-meio) 15%, elaboração e captação 10%) | 15 | 13 |
| Alterações do orçamento | remanejamento livre com condições; silêncio não aprova | 23 | 15 |
| Fornecedores e partes relacionadas | 4 regras, sem limite percentual | 6 | 6 |
| Contas, liberação e rendimentos | 2 contas (Banco do Brasil ou Caixa Econômica Federal), liberação sem percentual | 12 | 8 |
| Meios de pagamento e documento fiscal | qualquer meio bancário; vedado: saque | 13 | 13 |
| Período e despesas vedadas | 12 vedações, 4 regras | 18 | 17 |
| Porte | Não se aplica: A LIE não classifica projetos por porte. O que muda regras é o nível da manifestação esportiva (formação, toda a vida, excelência), que define o limite de elaboração e captação e o de captação por projeto. | 1 | 1 |
| Objeto, metas e contrapartidas | 9 regras | 10 | 10 |
| Divulgação, marcas e defeso | 4 marcas, aprovação prévia, defeso | 11 | 11 |
| Envio, documentos e modelos | Sistema eletrônico, remessa postal ou e-mail; 18 documentos, 6 modelos | 30 | 29 |
| Análise, resultado e devolução | 4 resultados, GRU 18004-1 | 13 | 12 |
| Guarda de documentos | 10 anos da decisão | 1 | 1 |

A confirmar:

- Versão da norma pela data: Portaria MESP 10/2026, art. 102 (O corte em 03/03/2026 é leitura dos arts. 102 a 104 da P10.)
- Prazos: Portaria MESP 10/2026, art. 67; Decreto 12.861/2026, art. 33 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. Dias corridos, do dia seguinte à cientificação, com prorrogação para o primeiro dia útil (arts. 99 e 101).)
- Prazos: Portaria 424/2020, na redação da Portaria MESP 33/2025, prazo de análise da PCF (A redação original dava 360 dias para a técnica e 180 para a financeira; a fonte não registra o artigo.)
- Prazos: Portaria MESP 10/2026, art. 66 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O prazo para durante a diligência; a PCP não julga o mérito nem a parte financeira.)
- Prazos: Portaria MESP 10/2026, art. 80 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. Atualização pela IN TCU 71/2012 (§ 3º); sem recolhimento, TCE.)
- Prazos: Portaria MESP 10/2026, art. 80, § 4º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Prazos: Portaria MESP 10/2026, art. 93 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Prestação parcial: Portaria MESP 10/2026, art. 37; art. 65, § 2º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Prestação parcial: Portaria MESP 10/2026, art. 65 e § 1º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Prestação parcial: Portaria MESP 10/2026, art. 66 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Prestação parcial: Portaria MESP 10/2026, arts. 64 a 66; Decreto 12.861/2026, art. 33, § 3º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Orçamento, grupos e tetos: Planilha Orçamentária (modelo oficial do MESP), colunas A a H e rodapé (H47, H63 a H68) (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Orçamento, grupos e tetos: Decreto 12.861/2026, art. 12, § 1º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Orçamento, grupos e tetos: Decreto 12.861/2026, art. 12, caput e §§ 1º e 2º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Orçamento, grupos e tetos: Portaria MESP 10/2026, art. 26 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Orçamento, grupos e tetos: Planilha Orçamentária (modelo oficial do MESP), H64 = H63/H47 ("Porcentagem da Atividade Meio x Fim (Até 15%)") (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Orçamento, grupos e tetos: Portaria MESP 10/2026, art. 26 e §§ 1º a 3º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Orçamento, grupos e tetos: Planilha Orçamentária (modelo oficial do MESP), D68 "TOTAL GERAL" (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Orçamento, grupos e tetos: Decreto 12.861/2026, art. 12; Planilha Orçamentária, H64 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O Decreto fala em orçamento total; os modelos oficiais calculam meio ÷ fim, o critério da área técnica e o mais restritivo.)
- Orçamento, grupos e tetos: Portaria MESP 10/2026, art. 7º, V (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Orçamento, grupos e tetos: Portaria MESP 10/2026, art. 7º, IX; art. 44, §§ 2º e 3º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Orçamento, grupos e tetos: Portaria MESP 10/2026, art. 7º, § 4º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Orçamento, grupos e tetos: Decreto 12.861/2026, art. 15; Portaria MESP 10/2026, art. 7º, § 3º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Orçamento, grupos e tetos: Portaria MESP 10/2026, art. 14; Decreto 12.861/2026, art. 23 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Alterações do orçamento: Portaria MESP 10/2026, art. 20, § 3º; arts. 52 e 53 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Alterações do orçamento: Tutorial de remanejamento e readequação (MESP, 2023), art. 57-A, § 1º (citado)
- Alterações do orçamento: Tutorial de remanejamento e readequação (MESP, 2023), art. 57-A, § 1º (citado) (Não foi achado no DOU o ato que incluiu o art. 57-A.)
- Alterações do orçamento: Portaria MESP 10/2026, art. 53 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Alterações do orçamento: Decreto 12.861/2026, art. 12 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Alterações do orçamento: Portaria MESP 10/2026, art. 43 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. A P10 não trata de redução; qualquer outra alteração do plano de trabalho depende de autorização prévia da DPPIE.)
- Alterações do orçamento: Portaria MESP 10/2026, art. 43; art. 52, § 3º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O remanejamento só mexe em itens já previstos; item novo é alteração do plano de trabalho.)
- Alterações do orçamento: Portaria MESP 10/2026, art. 42 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Alterações do orçamento: Portaria MESP 10/2026, art. 43 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Alterações do orçamento: Portaria MESP 10/2026, art. 56 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Alterações do orçamento: Portaria MESP 10/2026, art. 55 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Alterações do orçamento: Portaria MESP 10/2026, arts. 42 a 56 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Fornecedores e partes relacionadas: LC 222/2025, art. 3º, § 2º, e art. 5º; Decreto 12.861/2026, art. 2º, §§ 5º e 6º; Portaria MESP 10/2026, art. 58, V (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Fornecedores e partes relacionadas: LC 222/2025, art. 5º; Decreto 12.861/2026, art. 2º, §§ 5º e 6º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Fornecedores e partes relacionadas: Decreto 12.861/2026, art. 13; Portaria MESP 10/2026, art. 59, III (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Fornecedores e partes relacionadas: Decreto 12.861/2026, art. 13, §§ 3º e 6º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Fornecedores e partes relacionadas: Portaria MESP 10/2026, art. 44 e § 1º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Fornecedores e partes relacionadas: Portaria MESP 10/2026, arts. 44, 58 e 59 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. A LIE não fixa limite percentual por fornecedor nem por parte relacionada.)
- Contas, liberação e rendimentos: LC 222/2025, Decreto 12.861/2026 e Portaria MESP 10/2026, texto integral, sem regra sobre tarifas (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Contas, liberação e rendimentos: Portaria MESP 10/2026, art. 20, § 3º; art. 37; art. 65, § 2º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Contas, liberação e rendimentos: Decreto 12.861/2026, arts. 30 e 31, §§ 1º a 3º; LC 222/2025, art. 11 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Contas, liberação e rendimentos: LC 222/2025, art. 10, parágrafo único; Portaria MESP 10/2026, art. 22, § 2º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Contas, liberação e rendimentos: Portaria MESP 10/2026, arts. 23 e 25 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Contas, liberação e rendimentos: Portaria MESP 10/2026, art. 20, §§ 7º e 8º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Contas, liberação e rendimentos: Portaria MESP 10/2026, art. 20, § 1º; art. 21 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Contas, liberação e rendimentos: Portaria MESP 10/2026, arts. 20 a 28 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Meios de pagamento e documento fiscal: Portaria MESP 10/2026, art. 41 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Meios de pagamento e documento fiscal: Portaria MESP 10/2026, art. 41, § 1º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Meios de pagamento e documento fiscal: Modelo de carimbos (MESP, 2023), frente e verso; Portaria MESP 10/2026, art. 49, III (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O carimbo publicado ainda cita a Lei 11.438/2006, revogada; o texto da lei fica configurável.)
- Meios de pagamento e documento fiscal: Portaria MESP 10/2026, art. 78 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Meios de pagamento e documento fiscal: Portaria MESP 10/2026, art. 41, § 2º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Meios de pagamento e documento fiscal: Portaria MESP 10/2026, art. 76; Formulário PCP/PCF, aba PAGAMENTOS, instrução 5 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Meios de pagamento e documento fiscal: Portaria MESP 10/2026, art. 98 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Meios de pagamento e documento fiscal: Portaria MESP 10/2026, art. 39 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Meios de pagamento e documento fiscal: Portaria MESP 10/2026, art. 46 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Meios de pagamento e documento fiscal: Portaria MESP 10/2026, art. 49 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Meios de pagamento e documento fiscal: Portaria MESP 10/2026, art. 50 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Meios de pagamento e documento fiscal: Portaria MESP 10/2026, art. 51 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Meios de pagamento e documento fiscal: Portaria MESP 10/2026, arts. 38 e 39 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 58, I (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 58, II (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 58, III (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 58, IV; Decreto 12.861/2026, art. 34, I; LC 222/2025, art. 20, I (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 58, V (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 58, VI (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: LC 222/2025, art. 6º, § 2º; Decreto 12.861/2026, art. 6º; Portaria MESP 10/2026, art. 59, I (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Decreto 12.861/2026, art. 6º, § 2º; Portaria MESP 10/2026, art. 59, II (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Decreto 12.861/2026, art. 14 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Decreto 12.861/2026, art. 16 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 32, I (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 44, § 4º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 45 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 13 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 31 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Período e despesas vedadas: Portaria MESP 10/2026, art. 44, § 1º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. Não se sabe se as tabelas de 2020 continuam a referência vigente.)
- Período e despesas vedadas: Portaria MESP 10/2026, arts. 40, 58 e 59 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Porte: Portaria MESP 10/2026, arts. 14 e 26 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Objeto, metas e contrapartidas: Modelo RCO 2026 (MESP), seção III (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Objeto, metas e contrapartidas: Decreto 12.861/2026, art. 18 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Objeto, metas e contrapartidas: Decreto 12.861/2026, art. 17; Portaria MESP 10/2026, arts. 11 e 68, XV (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Objeto, metas e contrapartidas: Formulário PCP/PCF 2026 (modelo oficial do MESP), aba BENEFICIADOS (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Objeto, metas e contrapartidas: Decreto 12.861/2026, art. 11, § 2º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Objeto, metas e contrapartidas: Portaria MESP 10/2026, art. 68, § 5º; art. 7º, § 3º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Objeto, metas e contrapartidas: Decreto 12.861/2026, art. 32 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Objeto, metas e contrapartidas: Portaria MESP 10/2026, arts. 61 e 62 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Objeto, metas e contrapartidas: Portaria MESP 10/2026, arts. 65 e 68 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Divulgação, marcas e defeso: Portaria MESP 10/2026, art. 35, I; art. 91, § 4º; modelo PDLIE 2026 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Divulgação, marcas e defeso: Manual de assinatura no período eleitoral (SICOM, jun/2026), p. 2 a 6; Manual de Divulgação da LIE, versão defeso (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. Nenhuma norma da DPPIE trata da análise do PDLIE no defeso; é leitura dos dois manuais.)
- Divulgação, marcas e defeso: Portaria MESP 10/2026, art. 90, § 2º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Divulgação, marcas e defeso: Portaria MESP 10/2026, art. 92 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Divulgação, marcas e defeso: Portaria MESP 10/2026, art. 93 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Divulgação, marcas e defeso: Portaria MESP 10/2026, art. 94 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Divulgação, marcas e defeso: Manual de Divulgação da LIE, versão defeso (jul/2026), p. 14 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Divulgação, marcas e defeso: Manual de Divulgação da LIE, versão defeso (jul/2026), p. 6 e 15 a 18 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Divulgação, marcas e defeso: Portaria MESP 10/2026, art. 12 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Divulgação, marcas e defeso: Portaria MESP 10/2026, arts. 90 a 94; LC 222/2025, art. 18 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 65, I; art. 68, I (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 65, II; art. 68, II (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 65, III; art. 68, III (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 65, IV; art. 68, IV (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 65, V; art. 68, XI (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 65, VI; art. 68, XII (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 65, VII (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 65, VIII; art. 68, X (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 65, IX; art. 68, XIII (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 65, X; art. 68, XIV (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 65, XI (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Formulário PCP/PCF 2026 (modelo oficial do MESP), aba A EXECUTAR (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 68, V (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 68, VI (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O modelo RCO pede o demonstrativo também na PCP.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 68, VII (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 68, VIII (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 68, IX (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Modelo RCO 2026 (MESP), item IV, n (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Formulário PCP/PCF 2026 (modelo oficial do MESP), abas RECEITA E DESPESA a DIÁRIAS (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Modelo RCO 2026 (MESP), seções I a VI (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Modelo de carimbos (MESP, 2023), frente e verso (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Planilha Orçamentária (modelo oficial do MESP), aba Planilha Orçamentária (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 54 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Orientações para recolhimento de valores ao Tesouro (MESP, 2023), p. 1 a 3 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 65, § 1º; art. 68, § 2º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Formulário PCP/PCF 2026 (modelo oficial do MESP), células E1/E2, J1/J2, H1/H2, I1/I2, M1/M2, G1/G2 e K1/K2 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Formulário PCP/PCF 2026 (modelo oficial do MESP), instruções das abas (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, art. 68, § 1º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Envio, documentos e modelos: Portaria MESP 10/2026, arts. 5º e 6º, §§ 3º e 4º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. Regra escrita para a apresentação do projeto; estendida à prestação por cautela.)
- Análise, resultado e devolução: Portaria MESP 10/2026, art. 79 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Análise, resultado e devolução: Orientações para recolhimento de valores ao Tesouro (MESP, 2023), p. 1 a 3 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O exemplo do próprio PDF mostra UG 180002; não há orientação de 2026. UG e código ficam configuráveis.)
- Análise, resultado e devolução: Portaria MESP 10/2026, art. 80 e §§ 3º, 4º e 7º (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Análise, resultado e devolução: Portaria MESP 10/2026, arts. 71 a 74 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Análise, resultado e devolução: Portaria MESP 10/2026, art. 68, § 4º; art. 100 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Análise, resultado e devolução: Portaria MESP 10/2026, arts. 84 e 88 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Análise, resultado e devolução: Portaria MESP 10/2026, art. 81 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Análise, resultado e devolução: LC 222/2025, arts. 20 e 21; Decreto 12.861/2026, arts. 34 e 35 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Análise, resultado e devolução: Portaria MESP 10/2026, arts. 71 a 88 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)
- Guarda de documentos: Portaria MESP 10/2026, arts. 46, § 1º, 69, 70 e 77; IN RFB 1.131/2011, art. 36 (Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido.)

## PRONON e PRONAS/PCD — Anexo LXXXVI-A (v1)

- Código: `pronon_pronas_lxxxvi_a_2025`. Órgão: Ministério da Saúde. Sistema: Transferegov.
- Norma: Lei 12.715/2012; Decreto 7.988/2013; Anexo LXXXVI-A da PRC GM/MS 5/2017 (Portaria GM/MS 8.031/2025).

| Dimensão | Situação | Fontes | A confirmar |
|---|---|---|---|
| Versão da norma pela data | atos desde 08/set/2025 | 1 | 0 |
| Prazos | 13 prazos; envio em 4 meses do fim do exercício | 13 | 0 |
| Prestação parcial | periódica | 4 | 0 |
| Orçamento, grupos e tetos | 3 grupos, 2 tetos (custos indiretos 15%, elaboração da proposta e captação 5%) | 14 | 0 |
| Alterações do orçamento | remanejamento com pedido; silêncio não aprova | 21 | 0 |
| Fornecedores e partes relacionadas | 4 regras, sem limite percentual | 6 | 0 |
| Contas, liberação e rendimentos | 2 contas (Instituição financeira oficial (na prática, Banco do Brasil)), liberação com 100% | 13 | 1 |
| Meios de pagamento e documento fiscal | qualquer meio bancário; vedado: saque | 7 | 1 |
| Período e despesas vedadas | 13 vedações, 2 regras | 17 | 0 |
| Porte | Não se aplica: O anexo não classifica projetos por porte: a análise é por resultados, e o financeiro só é examinado quando uma meta falha ou por amostragem. | 1 | 0 |
| Objeto, metas e contrapartidas | 11 regras | 12 | 0 |
| Divulgação, marcas e defeso | 1 marcas | 5 | 1 |
| Envio, documentos e modelos | Transferegov; 16 documentos, 0 modelos | 19 | 0 |
| Análise, resultado e devolução | 3 resultados | 11 | 1 |
| Guarda de documentos | 5 anos da decisão | 1 | 0 |

A confirmar:

- Contas, liberação e rendimentos: Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025), cl. 5ª (Diverge do anexo (arts. 57 e 69).)
- Meios de pagamento e documento fiscal: Anexo LXXXVI da PRC 5/2017 (revogado), art. 95, § 1º (Exigência do regime anterior, mantida como boa prática.)
- Divulgação, marcas e defeso: Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025), cl. 2ª, II, s e t
- Análise, resultado e devolução: Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025), cl. 12ª (Redação mais dura que a do anexo.)

## PRONON e PRONAS/PCD — Anexo LXXXVI (anterior) (v1)

- Código: `pronon_pronas_lxxxvi_2017`. Órgão: Ministério da Saúde. Sistema: SIPAR (protocolo).
- Norma: Lei 12.715/2012; Decreto 7.988/2013; Anexo LXXXVI da PRC GM/MS 5/2017 (origem na PRT GM/MS 1.550/2014), revogado pela Portaria GM/MS 8.031/2025.

| Dimensão | Situação | Fontes | A confirmar |
|---|---|---|---|
| Versão da norma pela data | aprovação de 28/set/2017 a 07/set/2025 | 1 | 0 |
| Prazos | 11 prazos; envio em 4 meses do fim do exercício | 11 | 4 |
| Prestação parcial | periódica | 4 | 3 |
| Orçamento, grupos e tetos | 2 grupos, 1 teto (elaboração do projeto e captação 5%) | 13 | 11 |
| Alterações do orçamento | remanejamento com pedido; silêncio não aprova | 21 | 14 |
| Fornecedores e partes relacionadas | 4 regras, sem limite percentual | 6 | 6 |
| Contas, liberação e rendimentos | 2 contas (Banco do Brasil), liberação com 100% | 12 | 8 |
| Meios de pagamento e documento fiscal | qualquer meio bancário | 4 | 0 |
| Período e despesas vedadas | 12 vedações, 3 regras | 17 | 16 |
| Porte | Não se aplica: O anexo não classifica projetos por porte: a análise é por resultados, e o financeiro só é examinado quando uma meta falha ou por amostragem. | 1 | 1 |
| Objeto, metas e contrapartidas | 11 regras | 12 | 11 |
| Divulgação, marcas e defeso | 1 marcas | 5 | 5 |
| Envio, documentos e modelos | AR, Sedex ou protocolo; 15 documentos, 0 modelos | 18 | 2 |
| Análise, resultado e devolução | 3 resultados | 10 | 7 |
| Guarda de documentos | 5 anos da decisão | 1 | 0 |

A confirmar:

- Prazos: Anexo LXXXVI-A da PRC 5/2017, arts. 94 e 95 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Prazos: Anexo LXXXVI-A da PRC 5/2017, arts. 58 e 59 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Prazos: Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025), cláusula 3ª (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida. Com irregularidade, o MS pode bloquear as contas.)
- Prazos: Decreto 7.988/2013, art. 15 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Prestação parcial: Decreto 7.988/2013, art. 22, parágrafo único; Anexo LXXXVI-A, art. 88, III; minuta do TC, cl. 6ª, subcl. 4ª e 5ª (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Prestação parcial: Portaria SE/MS 928/2026, art. 4º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Prestação parcial: Anexo LXXXVI-A da PRC 5/2017, arts. 78 e 79 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Orçamento, grupos e tetos: Anexo LXXXVI-A da PRC 5/2017, art. 21, I, II e V (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Orçamento, grupos e tetos: Anexo LXXXVI-A da PRC 5/2017, art. 21, IV (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Orçamento, grupos e tetos: Anexo LXXXVI-A da PRC 5/2017, art. 21, III (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida. O anexo não tira grupos do valor do projeto.)
- Orçamento, grupos e tetos: Anexo LXXXVI-A da PRC 5/2017, art. 41 e § 3º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Orçamento, grupos e tetos: Anexo LXXXVI-A da PRC 5/2017, arts. 27 a 29 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Orçamento, grupos e tetos: Anexo LXXXVI-A da PRC 5/2017, art. 30, § 1º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Orçamento, grupos e tetos: Anexo LXXXVI-A da PRC 5/2017, art. 31 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Orçamento, grupos e tetos: Anexo LXXXVI-A da PRC 5/2017, art. 18 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Orçamento, grupos e tetos: Anexo LXXXVI-A da PRC 5/2017, art. 16 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Orçamento, grupos e tetos: Anexo LXXXVI-A da PRC 5/2017, seção 11 da conferência (antes × agora)
- Alterações do orçamento: Anexo LXXXVI-A da PRC 5/2017, arts. 50 e 72 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Alterações do orçamento: Anexo LXXXVI-A da PRC 5/2017, art. 21, III e IV (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Alterações do orçamento: Anexo LXXXVI-A da PRC 5/2017, art. 69, § 2º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Alterações do orçamento: Anexo LXXXVI-A da PRC 5/2017, arts. 69, § 2º, e 72 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida. O anexo não tem remanejamento livre: toda mudança exige autorização prévia.)
- Alterações do orçamento: Anexo LXXXVI-A da PRC 5/2017, art. 59 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Alterações do orçamento: Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025), cl. 2ª, subcl. 2ª (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Alterações do orçamento: Anexo LXXXVI-A da PRC 5/2017, art. 72, § 1º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Alterações do orçamento: Anexo LXXXVI-A da PRC 5/2017, art. 58 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Alterações do orçamento: Anexo LXXXVI-A da PRC 5/2017, art. 72 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Alterações do orçamento: Anexo LXXXVI-A da PRC 5/2017, art. 77 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Alterações do orçamento: Anexo LXXXVI-A da PRC 5/2017, arts. 61 a 64 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Alterações do orçamento: Anexo LXXXVI-A da PRC 5/2017, arts. 58, 59, 69 e 72 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Fornecedores e partes relacionadas: Anexo LXXXVI-A da PRC 5/2017, arts. 51 e 96, parágrafo único (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Fornecedores e partes relacionadas: Anexo LXXXVI-A da PRC 5/2017, art. 22, IV; Lei 12.715/2012, art. 13 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Fornecedores e partes relacionadas: Anexo LXXXVI-A da PRC 5/2017, art. 76, § 3º; minuta do TC, cl. 9ª (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Fornecedores e partes relacionadas: Lei 12.715/2012, art. 11; minuta do TC, cl. 1ª, subcl. 2ª (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Fornecedores e partes relacionadas: Anexo LXXXVI-A da PRC 5/2017, art. 20, § 1º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Fornecedores e partes relacionadas: Anexo LXXXVI-A da PRC 5/2017, arts. 20, 51 e 76 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida. O anexo não fixa limite percentual por fornecedor nem por parte relacionada.)
- Contas, liberação e rendimentos: Anexo LXXXVI-A da PRC 5/2017, arts. 50, 56, 58, 60, III, e 69, § 3º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Contas, liberação e rendimentos: Anexo LXXXVI-A da PRC 5/2017, arts. 39, 47, § 2º, e 48 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Contas, liberação e rendimentos: Anexo LXXXVI-A da PRC 5/2017, arts. 52 a 56, § 3º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Contas, liberação e rendimentos: Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025), cl. 2ª, subcl. 2ª (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Contas, liberação e rendimentos: Anexo LXXXVI-A da PRC 5/2017, art. 47, §§ 3º e 4º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Contas, liberação e rendimentos: Anexo LXXXVI-A da PRC 5/2017, art. 67 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Contas, liberação e rendimentos: Anexo LXXXVI-A da PRC 5/2017, art. 65, §§ 1º e 3º; minuta do TC, cl. 3ª (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Contas, liberação e rendimentos: Anexo LXXXVI-A da PRC 5/2017, arts. 47 a 69 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, art. 22, I (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, art. 22, II (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, art. 22, III (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, art. 22, IV (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, art. 22, V (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, art. 22, VI (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, art. 22, VII (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, art. 22, VIII; art. 24 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, art. 22, IX (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, art. 22, X (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, art. 30, § 3º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Edital de Chamamento MS 3/2025, item 7.4.13 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, arts. 19 e 20, § 2º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, art. 24 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, seção 11 da conferência (antes × agora)
- Período e despesas vedadas: Anexo LXXXVI-A da PRC 5/2017, arts. 21 a 31 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Porte: Anexo LXXXVI-A da PRC 5/2017, art. 81, § 3º; art. 88 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Objeto, metas e contrapartidas: Anexo LXXXVI-A da PRC 5/2017, art. 87, II, III e VII (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Objeto, metas e contrapartidas: Anexo LXXXVI-A da PRC 5/2017, art. 87, V (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Objeto, metas e contrapartidas: Anexo LXXXVI-A da PRC 5/2017, art. 87, VI (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Objeto, metas e contrapartidas: Anexo LXXXVI-A da PRC 5/2017, art. 79, § 4º; art. 87, IX (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Objeto, metas e contrapartidas: Anexo LXXXVI-A da PRC 5/2017, art. 87, X (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Objeto, metas e contrapartidas: Anexo LXXXVI-A da PRC 5/2017, art. 17, § 1º, VIII (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Objeto, metas e contrapartidas: Anexo LXXXVI-A da PRC 5/2017, art. 54 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Objeto, metas e contrapartidas: Anexo LXXXVI-A da PRC 5/2017, art. 80; minuta do TC, documento XI (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Objeto, metas e contrapartidas: Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025), cl. 8ª (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Objeto, metas e contrapartidas: Anexo LXXXVI-A da PRC 5/2017, art. 14, § 5º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Objeto, metas e contrapartidas: Anexo LXXXVI-A da PRC 5/2017, arts. 74, 79 e 87 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Divulgação, marcas e defeso: Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025), cl. 2ª, II, s e t (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Divulgação, marcas e defeso: Anexo LXXXVI-A da PRC 5/2017, art. 96, parágrafo único (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Divulgação, marcas e defeso: Anexo LXXXVI-A da PRC 5/2017, art. 100 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Divulgação, marcas e defeso: Anexo LXXXVI-A da PRC 5/2017, art. 96; minuta do TC, cl. 2ª (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Envio, documentos e modelos: Portaria GM/MS 8.031/2025, art. 2º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Envio, documentos e modelos: Anexo LXXXVI-A da PRC 5/2017, art. 81, § 2º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Análise, resultado e devolução: Anexo LXXXVI-A da PRC 5/2017, art. 84 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Análise, resultado e devolução: Anexo LXXXVI-A da PRC 5/2017, arts. 76, § 1º, 81, § 1º, 92 e 93 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Análise, resultado e devolução: Anexo LXXXVI-A da PRC 5/2017, art. 87, § 2º (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)
- Análise, resultado e devolução: Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025), cl. 12ª (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida. Redação mais dura que a do anexo.)
- Análise, resultado e devolução: Anexo LXXXVI-A da PRC 5/2017, arts. 81 a 95 (Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida.)

## Genérico (sem regras de lei) (v2)

- Código: `generico`. Órgão: —. Sistema: nenhum.
- Norma: Sem norma específica; vale o contrato de patrocínio.

| Dimensão | Situação | Fontes | A confirmar |
|---|---|---|---|
| Versão da norma pela data | Não se aplica: Vale para qualquer projeto sem regime de lei. | 1 | 0 |
| Prazos | nenhum prazo de lei; os essenciais dizem por quê | 5 | 0 |
| Prestação parcial | Não se aplica: Prestação parcial só se o contrato pedir. | 1 | 0 |
| Orçamento, grupos e tetos | 6 grupos, 0 tetos | 8 | 0 |
| Alterações do orçamento | Não se aplica: O contrato define se a alteração precisa de aceite do patrocinador; a pessoa escolhe a classificação. | 1 | 0 |
| Fornecedores e partes relacionadas | Não se aplica: Sem limite por fornecedor fora do contrato. | 1 | 0 |
| Contas, liberação e rendimentos | Não se aplica: A conta é a que o contrato indicar. | 1 | 0 |
| Meios de pagamento e documento fiscal | Não se aplica: Sem restrição de meio de pagamento fora do contrato. | 1 | 0 |
| Período e despesas vedadas | Não se aplica: Período e vedações seguem o contrato. | 1 | 0 |
| Porte | Não se aplica: Sem classificação por porte. | 1 | 0 |
| Objeto, metas e contrapartidas | Não se aplica: O objeto e as metas são os do contrato. | 1 | 0 |
| Divulgação, marcas e defeso | Não se aplica: Marcas e aprovação de peças seguem o contrato. | 1 | 0 |
| Envio, documentos e modelos | Não se aplica: O formato de envio é o que o patrocinador pedir. | 1 | 0 |
| Análise, resultado e devolução | Não se aplica: A análise e a devolução seguem o contrato. | 1 | 0 |
| Guarda de documentos | Não se aplica: Guarda pelo contrato e pela legislação fiscal. | 1 | 0 |
