# Matriz de cobertura dos regimes

> Gerada por `scripts/prestacao-gerar-matriz-regimes.ts` a partir de `lib/prestacao/regimes`. Não edite à mão: mude o regime e gere de novo. O teste `tests/prestacao-regimes-cobertura.test.ts` falha se este arquivo ficar diferente do código ou se um regime deixar uma dimensão sem regras e sem lacuna explicada.

Cada célula resume o que o regime traz na dimensão. "Não se aplica" e "a norma não trata" vêm com o motivo e a fonte no detalhe abaixo. "A confirmar" conta as regras que vieram de fonte secundária ou ambígua: a checagem só alerta.

| Dimensão | Lei Rouanet — IN MinC 29/2026 (v2) | Genérico (sem regras de lei) (v2) |
|---|---|---|
| Versão da norma pela data | atos desde 30/jan/2026 | não se aplica |
| Prazos | 8 prazos; envio em 60 dias do fim da execução | nenhum prazo de lei; os essenciais dizem por quê |
| Prestação parcial | contínua (1 a confirmar) | não se aplica |
| Orçamento, grupos e tetos | 6 grupos, 4 tetos (custos de administração 15%, acessibilidade 20%…) | 6 grupos, 0 tetos |
| Alterações do orçamento | remanejamento livre com condições; silêncio aprova (1 a confirmar) | não se aplica |
| Fornecedores e partes relacionadas | fornecedor 20%, proponente 20%, proponente 30% | não se aplica |
| Contas, liberação e rendimentos | 2 contas (Banco do Brasil), liberação com 20% (1 a confirmar) | não se aplica |
| Meios de pagamento e documento fiscal | pix, ted, doc, boleto, debito_automatico (2 a confirmar) | não se aplica |
| Período e despesas vedadas | 13 vedações, 4 regras | não se aplica |
| Porte | pequeno até R$ 750.000, medio até R$ 5.000.000, grande (1 a confirmar) | não se aplica |
| Objeto, metas e contrapartidas | 15 regras | não se aplica |
| Divulgação, marcas e defeso | 3 marcas, aprovação prévia, defeso (2 a confirmar) | não se aplica |
| Envio, documentos e modelos | Salic; 11 documentos, 1 modelo | não se aplica |
| Análise, resultado e devolução | 3 resultados, GRU 019473 | não se aplica |
| Guarda de documentos | 5 anos do fim da execução | não se aplica |
| **Regras com fonte** | 180 | 26 |
| **A confirmar** | 8 | 0 |

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
