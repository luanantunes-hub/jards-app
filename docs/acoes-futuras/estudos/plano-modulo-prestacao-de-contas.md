# Plano de implementação — Módulo de Prestação de Contas (Cultura, Esporte, Audiovisual e Saúde)

> Estudo de 01/10/2026. Proposta para discussão; nada aqui foi implementado.
> Fontes: os manuais da pasta "prestação de contas" do Drive, os dois PDFs enviados na conversa, pesquisa na web (só resumos de busca; regras dessa origem aparecem marcadas com [web] e as incertas com [?]) e um mapeamento do código atual.
> As extrações detalhadas, com página citada em cada regra, estão em [`prestacao-de-contas-fontes/`](./prestacao-de-contas-fontes/README.md).

## 0. Resumo

O módulo de prestação de contas atual foi desenhado para a Lei Rouanet, com regras fixas no código e várias telas incompletas. Atender cultura, esporte, audiovisual e saúde não é questão de adicionar telas: cada mecanismo tem contas, prazos, tetos, documentos e formulários próprios, e eles mudam com frequência (a Rouanet trocou de instrução normativa em 2024, 2025 e 2026).

Decisões centrais:

1. **Regime normativo como dado versionado.** Cada prestação aponta para um *regime* (ex.: `rouanet_in29_2026`, `ancine_in159_2021`, `pie_sc_in04_2025`). O regime guarda os parâmetros (prazos, tetos, meios de pagamento, documentos exigidos, checklist de envio, modelos de saída). As checagens são funções em código, testadas, que o regime liga e parametriza. Nada de "20%" escrito em componente React.
2. **O extrato bancário é a espinha dorsal.** Todas as quatro áreas exigem a mesma coisa no fundo: cada débito da conta do projeto precisa ter um documento fiscal válido, ligado a um item aprovado do orçamento, pago ao próprio credor. O módulo passa a ser construído em cima de contas → lançamentos → pagamentos → despesas → itens.
3. **O Jards é a mesa de trabalho, não o sistema oficial.** Salic, STR/ANCINE, Prosas, Transferegov e o sistema da LIE não têm API pública para escrita. O Jards organiza, valida e gera o pacote no formato de cada sistema; a pessoa lança ou envia lá. A situação oficial (ex.: E75, E24, diligência aberta) é registrada no Jards.
4. **Alertas apoiam, não julgam.** O próprio manual de avaliação do MinC diz que apontamentos automáticos passam por análise humana. Cada checagem tem severidade (bloqueia envio, alerta de glosa, exige justificativa) e sempre aceita justificativa registrada.
5. **Antes de qualquer funcionalidade, uma fase de fundação**: versionar o schema que hoje só existe no banco remoto, isolar por organização, corrigir o armazenamento e a função de IA sem autorização.

Ordem sugerida: Fundação → Rouanet completo (piloto em cultura) → ANCINE → Esporte (PIE-SC e LIE federal) → Saúde (PRONON/PRONAS). Estimativa: cerca de 24 semanas de uma pessoa full-stack (≈ 4 meses com duas), detalhada na seção 12.

---

## 1. Fontes e grau de confiança

| Área | Documento | Órgão / versão | O que cobre | Confiança |
|---|---|---|---|---|
| Cultura | Manual do Proponente – Módulo II – Monitoramento e Execução | MinC/SEFIC, v3, ago/2026 | Execução no Salic, contas, comprovantes, remanejamento, readequação, checklist de envio | Alta (oficial) |
| Cultura | Manual do Proponente – Módulo III – Avaliação de Resultados | MinC/SGPTC, 2026 (IN 29/2026) | Prestação final, porte, relatório do objeto, GRU, campos do comprovante | Alta (oficial) |
| Cultura | Manual IN 29 (Olivieri) | Escritório privado, fev/2026 | Tetos, carteira por proponente, plano de distribuição, sanções | Média (secundária; confirmar no texto da IN) |
| Cultura | Manual de Uso da Marca do PRONAC — jan/2026 e versão defeso jun/2026 | MinC | Marcas, créditos, placas, defeso eleitoral | Alta (oficial) |
| Cultura | Manual de Projetos Culturais (Vale) | Instituto Cultural Vale, 2021 | Rouanet sob a IN 02/2019 | **Obsoleto** — usar só como histórico |
| Audiovisual | Manual de Prestação de Contas v2.11 | ANCINE/SPR, 23/09/2026 (IN 159/2021) | PC completa: contas, documentos, tetos, RP/DE/DO, GRU, sanções, parcelamento | Alta (oficial) |
| Esporte (SC) | Manual de Execução Financeira e Prestação de Contas — PIE | FESPORTE/SC, 2026 | Programa estadual de ICMS: conta, despesas, apostilamento, relatórios, checklist I–XXII | Alta, com conflito de canal de entrega (papel × Prosas) |
| Esporte (SC) | Pesquisa web: IN FESPORTE 04/2025, Portaria 123/2025, Manual da Marca PIE | — | Prazo, canal e resultados da prestação final; onde a IN diverge do manual | Média (só resumos de busca) |
| Esporte (federal) | Manual de Divulgação da LIE — versão defeso | Ministério do Esporte, "versão 2023" | Só marcas e divulgação; o texto das regras de defeso está em imagem | Baixa para PC |
| Esporte (federal) | Pesquisa web: LC 222/2025, Decreto 12.861/2026, Portaria MESP 10/2026 | — | Contas, tetos, vedações, PCP/PCF, prazos, transição de regimes | Média a baixa (só resumos de busca) |
| Saúde | Manual de análise contábil e financeira PRONON e PRONAS/PCD | MS/FNS, 2ª ed., ago/2019 | Só a parte financeira da prestação final, nos regimes 875/2013, 1550/2014 e PRC 5/2017 | Média; desatualizado frente à Portaria 8.031/2025 |
| Saúde | Pesquisa web: Portaria GM/MS 8.031/2025 (Anexo LXXXVI-A), Transferegov, Lei 15.513/2026 | — | Habilitação e chamamento no Transferegov, CMD no lugar do CIHA, deduções de 2026 | Média (só resumos de busca) |
| Audiovisual | Pesquisa web: layout das planilhas do STR, logomarca, FSA | — | Layout do DE quase completo; RP parcial; DO e FSA não encontrados | Média |

**Limite da pesquisa web:** neste ambiente, o acesso direto a páginas foi bloqueado para quase todos os domínios (não só o gov.br), e a cota de buscas da sessão acabou. Tudo o que está marcado [web] veio de resumos do buscador; nenhum texto normativo foi lido na íntegra.

### Fontes que faltam (bloqueiam partes do plano)

Precisam ser baixados num navegador e colocados na pasta do Drive:

1. **LIE federal**: texto da Portaria MESP 10/2026 e do Decreto 12.861/2026, e os modelos da página "Modelos e Manuais" do gov.br/esporte (formulários de prestação parcial e final, planilha orçamentária, grade horária de RH). Os dois "manuais do proponente" enviados são da Rouanet, não da LIE.
2. **Saúde**: texto da Portaria GM/MS 8.031/2025 (DOU de 08/09/2025, Seção 1, p. 99–106). O "Manual Orientativo" previsto nela ainda não saiu (prazo até 08/06/2026, prorrogável até 08/03/2027).
3. **Rouanet**: texto integral da IN MinC 29/2026 (e da IN 34/2026, que a alterou), para conferir os artigos usados no plano (arts. 19, 20, 22, 24, 47, 58, 64 e 68 a 76) e as divergências da seção 2.3.
4. **ANCINE**: "Manual STR – Planilhas" e os modelos `.xls` de RP, DE e DO; Manual de Aplicação da Logomarca v3.0; guias de acompanhamento do FSA no BRDE.
5. **PIE-SC**: texto integral da IN FESPORTE 04/2025 e da Portaria 123/2025, e os modelos de relatório técnico e balancete do site da FESPORTE.

---

## 2. O que é comum e onde as leis divergem

### 2.1 Ciclo comum

Todas as áreas seguem o mesmo esqueleto, com nomes diferentes:

```
aprovação ─► captação (conta de captação) ─► liberação (limiar mínimo / termo assinado)
   ─► execução (conta de movimento): débito ⇄ pagamento ⇄ documento fiscal ⇄ item aprovado
   ─► comprovação (contínua, semestral ou anual) ─► prestação final (prazo fatal)
   ─► análise: objeto + financeiro ─► diligências ─► resultado (aprovada | com ressalvas | reprovada)
   ─► devolução de saldo (GRU) · glosas · recurso · sanções ─► guarda documental (5–10 anos)
```

### 2.2 Parâmetros por regime

| Parâmetro | Rouanet (IN MinC 29/2026) | ANCINE (IN 159/2021) | PIE-SC (Dec. 780/2024, IN FESPORTE 04/2025) | PRONON/PRONAS (PRC 5, Anexo LXXXVI-A) | LIE federal (LC 222/2025, Port. MESP 10/2026) [web] |
|---|---|---|---|---|---|
| Sistema oficial | Salic | STR + BB Gestão Ágil + Protocolo Digital | Prosas + SGPE | Transferegov (habilitação, chamamento, execução); SEI/SIPAR nos projetos antigos | SLI (cadastro, captação, recibos) + Transferegov (remanejamento, aditivo, PCP, PCF) [?] |
| Contas | Captação (bloqueada) + Movimento, BB | Captação + Movimentação (+ Recolhimento do investidor), BB, abertas pela ANCINE; FSA sem captação | 1 conta única, BB, gerida pela FESPORTE | Captação + Movimento, BB | conta específica e exclusiva no BB ou na Caixa; na prática, captação + movimento [?] |
| Liberação | ≥ 20% do aprovado captado (art. 47; análise técnica a partir de 10%) | autorização da ANCINE | fim da captação (≥ 20%) + Termo de Compromisso | Termo de Compromisso | ≥ 20% captado + Termo de Compromisso |
| Meios de pagamento | só PIX, TED ou outro meio formal (art. 58); o Salic ainda lista cheque e saque | TED, DOC, PIX; boleto em casos listados; **cheque e saque = glosa** | boleto, PIX, transferência; **saque vedado** | não consta (cheque citado no manual antigo) | transferência identificada; saque e espécie vedados [?] |
| Comprovação durante a execução | contínua no Salic, débito a débito; manter ≥ 80% comprovado | por RP/DE/DO no fim; parcial existe sem regra clara | relatórios técnicos a cada 6 meses | anual, até 30/04 | prestação parcial (PCP) a critério do Ministério; condiciona as parcelas seguintes |
| Prazo da prestação final | 60 dias improrrogáveis do fim da execução (situação E75) | 180 dias da conclusão do objeto (CPB, estreia, fim do festival) | 30 dias úteis do 1º dia útil após o fim da execução | 30/04 do ano seguinte ao último exercício | 60 dias do término do projeto |
| Entrega | eletrônica no Salic | planilhas no STR + Protocolo Digital | só Prosas, PDF colorido assinado via gov.br (a IN prevalece sobre o manual, que pedia papel) | Transferegov ("poderá") | ofício do responsável legal + Transferegov [?] |
| O documento fiscal precisa ter | descrição igual à planilha; em nome do proponente; retenções | título + nº SALIC; proponente como tomadora; emissão ≤ 30 dias após o débito | nº do processo SGPE; em nome do proponente; atesto de recebimento | SIPAR + nome do projeto (ou declaração do representante) | não encontrado |
| Tetos principais | sobre o "valor do projeto": administração ≤ 15% (inclui tarifas); divulgação/acessibilidade ≤ 20%, paga na proporção do captado; captação ≤ 10% e ≤ R$ 150 mil | gerenciamento ≤ 10%; agenciamento ≤ 10% proporcional ao captado; colocação ≤ 10%; contrapartida ≥ 5% | elaboração + captação ≤ 10% do captado | elaboração + captação ≤ 5% e ≤ R$ 50 mil (a confirmar no Anexo LXXXVI-A) | atividade-meio ≤ 15% do orçamento total, fora o pessoal da atividade-fim; elaboração/captação ≤ 10% [?] |
| Concentração e vedações | fornecedor ≤ 20% do captado (exceções do art. 24, I–V); proponente + partes relacionadas ≤ 20% (30% PF/MEI) | fornecedor/grupo 25–50% = advertência; > 50% = inabilitação | bens/serviços de dirigentes e parentes até 2º grau vedados | não consta | vedados: atleta profissional, intermediação, espaço publicitário, benefício a pessoa ligada ao patrocinador |
| Remanejamento sem autorização | livre se não mudar o valor do projeto, os custos vinculados e a captação (IN 29); o Salic ainda aplica 50% do item | pedido prévio quando as alterações somam 20% do orçamento; sempre justificar | +10% no preço unitário, ±20% na quantidade; acima disso, apostilamento antes da despesa | não consta | até 2 pedidos, com aprovação prévia [?] |
| Devolução de saldo | GRU ao FNC (34902 / 340034 / 019473), referência = Pronac | GRU por fonte (019401, 026642, 026667, 026674), referência = SALIC | guia à FESPORTE; correção SELIC + 1% ao mês na inadimplência [?] | GRU ao Tesouro em 30 dias da notificação | transferência a outro projeto do proponente (120 dias [?]) ou recolhimento; GRU não encontrada |
| Resultado | aprovada / com ressalvas / reprovada; inabilitação de 3 anos | aprovada / com ressalvas / não aprovada; multa de 50% (Lei do Audiovisual) ou 20% (FSA/Funcines); inabilitação até 2 anos | regular / regular com ressalva / irregular; análise em até 150 dias [?] | parecer conclusivo; TCE | não encontrado; sem PCF: suspensão para novos projetos e recolhimento de saldos; reconsideração em 5 dias |
| Guarda de documentos | 5 anos (marco divergente; usar entrega + 6 meses + 5 anos) | não consta no manual | 10 anos | 5 anos após a aprovação | não encontrado |
| Transição de regimes | IN 29 vale para projetos em andamento | IN 150/2019 e IN 125/2015 para projetos antigos | — | 875/2013, 1550/2014, PRC 5/2017, Anexo LXXXVI-A/2025 | Portaria 424/2020 para projetos submetidos até 31/12/2025 [?] |

### 2.3 Divergências que ainda precisam do texto da norma

| Tema | O que se sabe | Decisão provisória |
|---|---|---|
| Rouanet: remanejamento por item | A IN 29 não fixa limite por item; o Módulo II (ago/2026) e a tela do Salic ainda aplicam 50% | aplicar as duas: alerta acima de 50% do item, bloqueio se mudar totais, custos vinculados ou captação |
| Rouanet: marco da guarda de documentos | "fim da vigência" (LegisWeb) × "6 meses após a entrega" (manual Olivieri) | usar o mais tardio |
| Rouanet: forma de pagamento | IN 29 só aceita meios formais; o formulário do Salic oferece cheque e saque | saque e cheque exigem justificativa e anexo |
| LIE: quase tudo | Regras vieram de resumos de busca | parâmetros marcados "a confirmar"; fase de esporte federal só começa com a Portaria 10 em mãos |
| Saúde: limites do Anexo LXXXVI-A | Não confirmados | idem, aguardando o texto da Portaria 8.031/2025 |

---

## 3. Diagnóstico do módulo atual

O que existe em `app/(dashboard)/prestacoes/`: lista; visão geral com status e checklist; orçamento (CSV/PDF); comprovantes com leitura por IA (Gemini) e risco de glosa; atividades com evidências; distribuição de ingressos; divulgação; relatório em tela. As tabelas são `prestacoes_contas`, `prestacao_itens`, `prestacao_comprovantes`, `prestacao_atividades`, `prestacao_atividade_evidencias`, `prestacao_relatorio`, `prestacao_status_log`, `prestacao_distribuicao` e `prestacao_divulgacao`.

### 3.1 Problemas de fundação (bloqueiam a evolução)

1. **Schema fora do controle de versão.** Nenhuma migration cria as tabelas de prestação; só existem as políticas de acesso (`20260830044912_predeploy_phase1_fixes.sql`, `20261001210000_corrigir_acessos_abertos.sql`). Tipos, defaults e restrições reais são desconhecidos.
2. **Sem `organization_id`.** O acesso depende de `can_access_prestacao` olhar projeto ou captação. Não há papéis (quem lança, quem revisa, quem envia).
3. **Arquivos fora da regra do bucket.** Os caminhos `prestacoes/{id}/...` e `orcamentos/{id}/...` não começam pelo ID da organização, que é o que as políticas de storage exigem.
4. **`extrair-comprovante` roda com a chave de serviço e não confere quem chama** nem se a pessoa tem acesso à prestação.
5. **Mudança de status só no navegador**, em duas escritas não atômicas, sem checagem de papel e sem exigir o checklist.
6. **`valor_realizado` nunca é calculado** (a tela promete cálculo automático; não há gatilho nem função).
7. **O módulo não é bloqueado por rota** e as colunas `modulos_ativos` e `modulos_acesso` não existem em nenhuma migration.

### 3.2 Regras erradas ou desatualizadas

- O alerta "limite de 20% para pessoa física" soma RPA e recibos sobre o aprovado. A regra real da Rouanet é outra: 20% por **fornecedor** e 20% (30% para PF/MEI) para **proponente e partes relacionadas**, sobre o **captado**. Além disso, a consulta lê uma coluna `valor` que nunca é gravada.
- "A Lei Rouanet recomenda ao menos 20% de acesso gratuito": a IN 29/2026 exige ≥ 10% gratuito social/educativo, até 10% para patrocinadores, até 10% para o proponente e ≥ 20% vendido a até R$ 50.
- A tolerância padrão de 15% por item do orçamento não corresponde a nenhuma regra encontrada; o remanejamento segue as regras do regime (seção 2.2).
- A divulgação verifica "lei mencionada" e "logo do MinC". O manual de marcas de 2026 exige a marca Lei Rouanet à esquerda, "Ministério da Cultura apresenta", Governo Federal no bloco de realização (fora do defeso), aprovação prévia no Salic e versão própria no defeso eleitoral.
- O relatório usa quantidades fictícias ("1,00", 100%, saldo 0) e mistura fontes no total.
- Prazo da prestação é um campo manual; a regra "60 dias após o fim da execução" é só um comentário.

### 3.3 O que aproveitar

A estrutura de abas, o upload com leitura por IA, o fluxo de evidências de atividades, a importação de orçamento por CSV/PDF e o padrão visual. A recomendação é **evoluir as tabelas existentes por migrations** (não recriar do zero) e reescrever as telas sobre os primitivos atuais (`ListPagePrimitives`, `DetailPagePrimitives`, `Dropdown`/`Select`, `StatusBadge`), conforme o `DESIGN.md`.

---

## 4. Arquitetura

### 4.1 Regime normativo

- **Catálogo global** `prestacao_regimes`, mantido pela equipe Jards (super admin). Cada registro é uma versão: código, área, mecanismo, esfera (federal, estadual, municipal), UF/município, órgão, sistema oficial, norma de referência, vigência, `parametros` (jsonb validado por schema Zod no código), `checagens` (lista de códigos com severidade e parâmetros), `checklist_envio`, `modelos_saida` e `fontes` (documento e página de cada regra).
- **Cada prestação guarda o regime e a versão** usados. Uma nova norma não muda prestações em andamento sem uma ação explícita e auditada (a IN 29/2026 se aplica a projetos em andamento; nesse caso o super admin migra em lote, com registro).
- **Exceções declaradas por prestação** (ex.: projeto do art. 24, I–V da Rouanet, isento do teto por fornecedor; grupo artístico familiar; animação na ANCINE), sempre com justificativa e anexo.
- **Regimes da v1**: `rouanet_in29_2026`, `ancine_in159_2021` (+ `ancine_in150_2019` para projetos antigos), `pie_sc_in04_2025`, `lie_lc222_2026` (+ `lie_portaria424_2020` para projetos submetidos até 31/12/2025), `pronon_pronas_prc5_2017` (+ `_1550_2014`, `_875_2013` e `_lxxxvi_a_2025` quando houver o texto). Um regime `generico` cobre patrocínio direto e leis ainda não modeladas, sem checagens normativas.
- **Parâmetro "a confirmar".** Valores que vieram só de fonte secundária ficam marcados no catálogo. A tela mostra o aviso e a checagem nunca bloqueia; no máximo alerta.

### 4.2 Unidade de prestação

- Uma prestação = **um projeto × uma fonte × um identificador oficial** (Pronac, SALIC/processo ANCINE, processo SGPE, SIPAR). A ANCINE exige prestação separada por fonte, mesmo para a mesma obra.
- Um projeto (`projetos_crm`) pode ter várias prestações; uma prestação recebe **vários aportes** (hoje há um único `captacao_id`).
- Prestações da mesma obra e do mesmo objeto (ANCINE) ficam agrupadas para a concentração por fornecedor e para o prazo que vence por último.

### 4.3 Núcleo financeiro

```
conta bancária ─1:N─► lançamento (extrato importado)
lançamento (débito) ─N:N─► pagamento ─N:1─► despesa (documento fiscal) ─N:1─► item do orçamento
despesa ─N:1─► fornecedor (PF, PJ, MEI, estrangeiro; partes relacionadas; grupo econômico)
```

- **O extrato manda.** Débito sem pagamento conciliado é pendência; pagamento sem débito correspondente também.
- Conciliação por valor, data, número do documento de pagamento (normalizado sem "." e ",", como o Salic exige) e CPF/CNPJ do favorecido.
- Retenções (ISS, INSS, IRRF) ficam na despesa e geram linhas próprias quando o regime exige (ANCINE lança o tributo em nome do credor, na rubrica do fato gerador).
- Rendimentos, tarifas, IOF, transferências entre contas, aportes e devoluções são categorias de lançamento, cada uma com regra por regime (ex.: ANCINE glosa tarifas que não sejam de manutenção).

### 4.4 Orçamento versionado

- Versões: solicitada, aprovada para captar, adequada, homologada, readequada (as cinco do Salic), com uma ativa.
- Árvore genérica de nós (`produto`, `etapa`, `meta`, `grupo`, `local`, `item`), porque cada regime tem uma hierarquia: Rouanet usa Fonte → Produto → Etapa → UF → Município → Item; a ANCINE usa rubricas de desenvolvimento, produção, pós e comercialização; PIE e saúde usam plano de trabalho com metas e etapas.
- Cada item tem **grupo de custo** (administração, divulgação/acessibilidade, captação, gerenciamento, agenciamento, elaboração, recolhimentos, execução), que alimenta os tetos.
- **Alterações** (remanejamento, complementação, redução, inclusão, apostilamento) são registros com status e data de aprovação. O motor checa os limites do regime e se a aprovação veio **antes** da despesa (exigência do PIE).

### 4.5 Objeto e evidências

Metas com previsto × realizado e justificativa; locais de realização (realizado, não realizado com justificativa, realizado com outras fontes); atividades (já existem); evidências tipadas (foto, vídeo, link, lista de presença, declaração, clipping, borderô, print, relatório de exibição, CPB); plano de distribuição; bens permanentes com cotação, inventário e destinação; peças de divulgação com aprovação e marcas.

### 4.6 Pós-envio

Diligências com prazo calculado, glosas com data-base, decisões, recursos, devoluções (GRU), parcelamentos (ANCINE) e marcação de inadimplência ou inabilitação, que afeta todos os projetos do proponente.

### 4.7 Integração com o resto do Jards

| Objeto existente | Uso no módulo |
|---|---|
| `projetos_crm` | Criar prestação a partir do projeto; mudar `fase` para `prestacao` ao entrar em E75 ou fim de execução |
| `captacoes` aprovadas | Viram aportes da prestação (valor, incentivador, data) |
| `proponentes` | Carteira: limites por proponente (Rouanet), inadimplência e inabilitação valendo para todos os projetos |
| `planos_ativacao`, `compromissos_cliente`, `ativacao_evidencias` | Contrapartidas de marca do patrocinador viram peças de divulgação com evidência reaproveitada |
| `atividades` | Prazos de prestação, diligências e relatórios parciais criam tarefas com responsável, aparecendo em Lista, Calendário e Gantt |
| `notification_events` | Alertas de prazo e de verificações bloqueantes |
| `documentos` + bucket `documentos` | Todos os arquivos, com `prestacao_id` e caminho `{orgId}/prestacoes/{id}/...` |

### 4.8 Saídas para os sistemas oficiais

Sem API de escrita, o Jards gera:

- **Rouanet**: "espelho Salic" com os campos do comprovante na ordem da tela (tipo, número, série, data, CPF/CNPJ, forma, data e nº do pagamento, valor), rascunho do Relatório de Execução do Objeto, plano de distribuição, bens doados e GRU pré-preenchida.
- **ANCINE**: planilhas RP, DE e DO no layout do STR e GRU por fonte. O DE já tem layout conhecido (cabeçalho com título, SALIC, proponente, tipo de conta, banco, agência e conta; colunas Data, Histórico, Fomento, Outros Depósitos, Transferências, Aplicações/Resgates, Pagamentos, Despesas Bancárias e Saldo calculado). A RP tem as colunas principais (item orçamentário, credor, CPF/CNPJ só com números, histórico idêntico ao do DE, data do pagamento, tipo e número do documento fiscal, data de emissão, valor). O DO depende do modelo oficial.
- **LIE federal**: dossiê da prestação final (ofício do responsável legal, execução desde o início somando as parciais, relatório de cumprimento dos objetivos, extratos, documentos, lista de beneficiários, relatório fotográfico); prestação parcial sob demanda.
- **PIE-SC**: balancete, relatórios técnicos parciais e final, pacote de PDFs em ordem cronológica, um por campo do Prosas, e checklist I–XXII.
- **Saúde**: relação de pagamentos, Planilha II de conciliação, Tabela 1 de rendimentos, informações compiladas, relação de bens com inventário.
- **Todos**: dossiê ZIP com índice e relatório PDF da prestação.

Importações: extrato (OFX, CSV e PDF do Banco do Brasil), XML de NF-e/NFS-e e orçamento aprovado (CSV, XLSX, PDF).

---

## 5. Modelo de dados

Convenções: `organization_id not null` em toda tabela por organização; RLS por organização e papel; `created_at`, `updated_at`, `created_by`; valores em `numeric(15,2)`; enums como `text` com `check`, seguindo o restante do schema.

### 5.1 Catálogo (global)

| Tabela | Colunas principais |
|---|---|
| `prestacao_regimes` | `codigo`, `nome`, `area` (cultura, esporte, audiovisual, saude, outro), `mecanismo` (chave de `tipos_patrocinio`/`captacoes.lei`), `esfera`, `uf`, `municipio`, `orgao`, `sistema_oficial`, `norma_referencia`, `versao`, `vigente_desde`, `vigente_ate`, `status` (rascunho, publicado, obsoleto), `parametros jsonb`, `checagens jsonb`, `checklist_envio jsonb`, `modelos_saida jsonb`, `fontes jsonb` |
| `calendario_regulatorio` | `tipo` (defeso_eleitoral, feriado), `esfera`, `uf`, `municipio`, `inicio`, `fim`, `descricao`, `fonte`. Alimenta a contagem de dias úteis e o defeso (2026: 04/07 a 04/10, ou 25/10 onde houver 2º turno) |

### 5.2 Prestação e financeiro

| Tabela | Colunas principais |
|---|---|
| `prestacoes_contas` (alterar) | + `organization_id`, `regime_id`, `identificador_oficial`, `identificador_tipo`, `fonte_recurso`, `proponente_id`, `grupo_objeto_id`, `valor_homologado`, `porte` (calculado), marcos (`data_aprovacao`, `data_liberacao`, `data_termo`, `data_inicio_execucao`, `data_fim_execucao`, `data_conclusao_objeto`, `data_envio`), `prazo_final` (calculado) + `prazo_final_override` com justificativa, `situacao_oficial`, `status` (workflow interno), `inadimplente`, `resultado` |
| `prestacao_aportes` | `prestacao_id`, `captacao_id`, `incentivador_nome`, `incentivador_documento`, `valor`, `data`, `conta_id`, `validado_oficialmente`, `recibo_doador_documento_id` |
| `prestacao_contas_bancarias` | `prestacao_id`, `tipo` (captacao, movimento, unica, recolhimento, aplicacao), `banco`, `agencia`, `conta`, `aberta_por`, `data_abertura`, `data_encerramento`, `comprovante_encerramento_id` |
| `prestacao_extrato_importacoes` | `conta_id`, `formato`, `periodo_inicio`, `periodo_fim`, `hash_arquivo` (evita importação duplicada), `documento_id` |
| `prestacao_lancamentos` | `conta_id`, `data`, `natureza` (credito, debito), `valor`, `historico`, `numero_documento`, `numero_normalizado`, `categoria` (aporte, transferencia, pagamento, tarifa, rendimento, aplicacao, resgate, devolucao, estorno, outro), `status_conciliacao` |
| `fornecedores` (por organização) | `tipo_pessoa` (PF, PJ, MEI, estrangeiro), `documento`, `nome`, `cnae_principal`, `grupo_economico`, `parte_relacionada` + `tipo_relacao` (proponente, cônjuge, coligada, sócio em comum, dirigente, parente) |
| `prestacao_despesas` (evolui `prestacao_comprovantes`) | `item_id`, `fornecedor_id`, `tipo_documento` (nfe, nfse, cupom, recibo, rpa, rpci, invoice, folha, guia, fatura, boleto, apolice, nota_debito), `numero`, `serie`, `chave_acesso`, `data_emissao`, `data_fato_gerador`, `valor_bruto`, `iss`, `inss`, `irrf`, `outras_retencoes`, `valor_liquido`, `descricao`, `moeda` + `cambio`, `identificacao_projeto` (presente, declaração, ausente), `atesto_nome`, `atesto_cargo`, `atesto_data`, `reembolso`, `status` (rascunho, em_revisao, aceita, lancada_oficial, glosada), `justificativa`, `extracao_ia jsonb` |
| `prestacao_pagamentos` | `despesa_id`, `lancamento_id`, `forma` (pix, ted, doc, boleto, cheque, saque, cartao, cambio), `data`, `valor`, `favorecido_documento`, `numero_documento_pagamento` |

### 5.3 Orçamento

| Tabela | Colunas principais |
|---|---|
| `prestacao_orcamento_versoes` | `prestacao_id`, `tipo` (solicitada, aprovada, adequada, homologada, readequada), `ativa`, `ato` (portaria, apostilamento), `data_ato`, `documento_id` |
| `prestacao_orcamento_nos` (substitui `prestacao_itens`, mantido como view durante a transição) | `versao_id`, `parent_id`, `tipo` (produto, etapa, meta, grupo, local, item), `codigo`, `nome`, `uf`, `municipio`, `grupo_custo`, `unidade`, `quantidade`, `ocorrencias`, `valor_unitario`, `valor_total`, `fonte`, `ordem` |
| `prestacao_alteracoes` | `tipo` (remanejamento, complementacao, reducao, inclusao, exclusao, apostilamento, prorrogacao, transferencia), `status` (rascunho, solicitada, aprovada, negada), `solicitada_em`, `aprovada_em`, `ato`, `justificativa`, `diff jsonb` |

### 5.4 Objeto, divulgação e bens

| Tabela | Colunas principais |
|---|---|
| `prestacao_metas` | `descricao`, `indicador`, `unidade`, `previsto`, `realizado`, `justificativa`, `no_orcamento_id` |
| `prestacao_locais` | `pais`, `uf`, `municipio`, `status` (realizado, nao_realizado, outras_fontes), `inicio`, `fim`, `justificativa` (≤ 500 caracteres, limite do Salic) |
| `prestacao_atividades` (existente) | + `meta_id`, `local_id`; corrigir a ordem e a obrigatoriedade da justificativa |
| `prestacao_evidencias` (generaliza `prestacao_atividade_evidencias`) | `tipo` (foto, video, link, lista_presenca, declaracao, clipping, bordero, print, relatorio_exibicao, cpb, outro), `requisito` (alcance do objeto, democratização, acessibilidade, distribuição, divulgação), vínculo a meta, atividade, local, peça ou bem, `documento_id`, `url` |
| `prestacao_distribuicao` (existente) | + `produto`, `categoria` por regime (social/educativo, patrocinador, proponente, preço popular, venda, gratuita total), `preco`, `beneficiario_documento`, `declaracao_documento_id`; editar em vez de só criar e excluir |
| `prestacao_pecas` (substitui `prestacao_divulgacao`) | `tipo`, `dimensoes`, `data_veiculacao`, `aprovacao_status`, `aprovacao_data`, `aprovacao_protocolo` (Salic, e-mail da ASCOM, ANCINE), `versao_manual` (padrão, defeso), `marcas jsonb` (ordem e papel de cada marca), `texto_creditos`, `evidencia_veiculacao_id`, `compromisso_id` |
| `prestacao_bens` | `despesa_id`, `descricao`, `tipo` (movel, imovel, obra_arte, equipamento), `numero_inventario`, `cotacoes` (até 3 documentos), `destinacao`, `beneficiario_documento`, `termo_doacao_id`, `aceite_id`, dados do cartório (imóveis) |

### 5.5 Pós-envio, verificações e auditoria

| Tabela | Colunas principais |
|---|---|
| `prestacao_diligencias` | `origem` (órgão), `tipo`, `recebida_em`, `prazo_dias`, `dias_uteis`, `vence_em` (calculado), `status`, `resposta`, `respondida_em` + anexos |
| `prestacao_glosas` | `despesa_id`, `valor`, `motivo`, `data_base` (regra do regime: data do débito, ponto médio para mais de 100 itens na ANCINE etc.) |
| `prestacao_decisoes` | `resultado` (aprovada, aprovada_ressalvas, reprovada, regular, regular_ressalva, irregular), `data`, `documento_id`, `ressalvas` |
| `prestacao_recursos` | `decisao_id`, `protocolado_em`, `prazo`, `status`, `resultado` |
| `prestacao_devolucoes` | `motivo` (saldo, rendimento, glosa, reprovação), `codigo_recolhimento`, `ug`, `servico`, `referencia`, `competencia`, `valor_principal`, `pago_em`, `comprovante_id` |
| `prestacao_parcelamentos` | `devolucao_id`, `parcelas`, `valor_parcela`, `deferido_em`, `status` |
| `prestacao_verificacoes` | `check_codigo`, `severidade` (bloqueio, alerta, justificativa, info), `entidade_tipo`, `entidade_id`, `mensagem`, `fonte`, `status` (aberta, resolvida, justificada, dispensada), `justificativa`, `resolvida_por`, `resolvida_em` |
| `prestacao_eventos` (auditoria imutável) | `ator`, `acao`, `entidade`, `antes jsonb`, `depois jsonb`, `ip`, `created_at`; substitui e amplia `prestacao_status_log` |

Papéis por prestação (`prestacao_membros` ou papel na organização): **preparador** (lança), **revisor** (aceita ou recusa despesas, aprova justificativas) e **responsável** (muda status e registra o envio). Mudanças de status e aceite de despesas passam por funções no banco (`security definer`), não por `update` direto do navegador.

---

## 6. Motor de checagens

### 6.1 Como funciona

- Cada checagem é uma função TypeScript pura em `lib/prestacao/checagens/`, com código estável (ex.: `FORNECEDOR_CONCENTRACAO`), que recebe o estado da prestação e os parâmetros do regime e devolve achados.
- Severidades: **bloqueio** (impede marcar como pronta para envio), **alerta** (risco de glosa ou ressalva), **justificativa** (precisa de texto ou anexo), **info**.
- Roda no servidor a cada gravação relevante (rota de API ou função no banco que enfileira) e grava em `prestacao_verificacoes`. Resolver, justificar ou dispensar fica registrado com autor e data.
- Cada achado mostra a **fonte** (norma e página do manual), copiada do catálogo do regime.
- Testes por regime com casos montados a partir dos manuais (seção 13).

### 6.2 Catálogo inicial

As listas completas, com página citada, estão nos arquivos de fontes (Rouanet: 59 + 49 + 39 checagens; ANCINE: 38; PIE: 23 + 17; LIE: 34; saúde: 22 + 22; marcas: 22 + 9). Abaixo, as que entram na primeira versão, com o regime que as liga.

| Código | O que verifica | Severidade | Regimes |
|---|---|---|---|
| **Prazos e estado** | | | |
| `PRAZO_FINAL` | Contagem até o prazo da prestação final, com marco e tipo de dia do regime | alerta → bloqueio vencido | todos |
| `PRAZO_DILIGENCIA` | Diligência aberta com vencimento próximo | alerta | todos |
| `RELATORIO_PARCIAL` | Relatório semestral (PIE) ou anual até 30/04 (saúde) | alerta | PIE, saúde |
| `COMPROVACAO_TEMPESTIVA` | Comprovado abaixo de 80% do gasto | alerta | Rouanet |
| `LIBERACAO_MINIMA` | Despesa paga antes da liberação (20% captado / termo assinado) | justificativa | Rouanet, PIE, saúde |
| **Conta e conciliação** | | | |
| `DEBITO_SEM_COMPROVANTE` | Débito na conta de movimento sem despesa conciliada | bloqueio | todos |
| `NUMERO_PAGAMENTO_DIVERGENTE` | Nº do pagamento diferente do lançamento do extrato (normalizado) | bloqueio | Rouanet |
| `FORMA_PAGAMENTO` | Saque, cheque ou cartão fora das hipóteses do regime | bloqueio (ANCINE, PIE) / justificativa (Rouanet) | todos |
| `FAVORECIDO_DIFERENTE` | CPF/CNPJ do favorecido diferente do emitente (exceções: reembolso, MEI) | justificativa | todos |
| `EXTRATO_LACUNA` | Mês sem extrato entre abertura e último pagamento | bloqueio | todos |
| `TARIFA_GLOSAVEL` | Tarifa (exceto manutenção), juros, multa, IOF | alerta | ANCINE, PIE |
| `SALDO_FINAL` | Saldo diferente de zero no envio sem GRU registrada | bloqueio | todos |
| `RENDIMENTO_LIMITE` | Captado + rendimentos acima do aprovado | bloqueio | Rouanet |
| **Documento fiscal** | | | |
| `DOC_FORA_VIGENCIA` | Emissão antes do marco inicial ou depois do fim da execução | alerta (ressalva na Rouanet) / bloqueio (PIE, saúde) | todos |
| `DOC_TOMADOR` | Documento não emitido em nome do proponente | bloqueio | todos |
| `DOC_IDENTIFICACAO_PROJETO` | Falta Pronac/SALIC/SGPE/SIPAR no documento quando exigido | bloqueio ou declaração | ANCINE, PIE, saúde |
| `DOC_DESCRICAO_PLANILHA` | Descrição diferente do item aprovado | alerta | Rouanet |
| `DOC_PJ_SEM_NF` | Fornecedor PJ com recibo ou fatura sem dispensa legal anexada | justificativa | Rouanet, ANCINE |
| `DOC_RETENCOES` | Serviço sem ISS, INSS ou IRRF quando aplicável | alerta | todos |
| `DOC_EMISSAO_POS_DEBITO` | Emissão mais de 30 dias após o débito | alerta | ANCINE |
| `NFE_CHAVE_REPETIDA` | Chave de NF-e já usada em outro projeto | bloqueio | todos |
| `RPA_CAMPOS` | RPA sem nome, CPF, endereço, data, assinatura, retenções ou SALIC | bloqueio | Rouanet, ANCINE |
| `ATESTO_RECEBIMENTO` | Despesa sem atesto com nome e cargo | bloqueio | PIE |
| **Limites e partes relacionadas** | | | |
| `FORNECEDOR_CONCENTRACAO` | Soma por fornecedor ou grupo acima do teto (base e faixas do regime) | alerta / bloqueio | Rouanet, ANCINE |
| `PROPONENTE_PARTES_RELACIONADAS` | Proponente e partes relacionadas acima de 20% (30% PF/MEI) | alerta | Rouanet |
| `CONFLITO_INTERESSE` | Fornecedor é dirigente ou parente até 2º grau (PIE) ou ligado ao patrocinador (LIE) | bloqueio | PIE, LIE |
| `TETO_GRUPO_CUSTO` | Administração, divulgação, captação, gerenciamento, agenciamento, elaboração, atividade-meio acima do teto (sobre valor do projeto, captado, orçamento total ou de produção, conforme o regime) | alerta | todos |
| `BANCO_CONTA` | Conta fora do banco exigido (BB; BB ou Caixa na LIE) ou titular diferente do proponente | bloqueio | todos |
| `CONTRAPARTIDA_MINIMA` | Contrapartida abaixo de 5% | alerta | ANCINE |
| `REEMBOLSO_MATRIZ` | Reembolso fora da lista do art. 15 ou acima de R$ 1.000 | bloqueio | ANCINE |
| `DESPESA_VEDADA` | Categoria vedada pelo regime (folha da proponente e infraestrutura na ANCINE; cessão de atleta no PIE; atleta profissional, intermediação e espaço publicitário na LIE etc.) | bloqueio | todos |
| **Orçamento e alterações** | | | |
| `ITEM_SEM_SALDO` | Despesa acima do saldo do item | bloqueio | todos |
| `REMANEJAMENTO_LIMITE` | Variação acima do limite sem alteração aprovada; número máximo de pedidos (LIE) | bloqueio | Rouanet, ANCINE, PIE, LIE |
| `APOSTILAMENTO_PREVIO` | Despesa alterada paga antes da aprovação do apostilamento | bloqueio | PIE |
| `ALTERACAO_PENDENTE` | Readequação em análise no envio | bloqueio | Rouanet |
| **Objeto** | | | |
| `META_SEM_RESULTADO` | Meta sem realizado ou divergência sem justificativa | bloqueio | todos |
| `LOCAL_SEM_STATUS` | Local sem status; "não realizado" sem justificativa | bloqueio | Rouanet |
| `ACESSIBILIDADE_SEM_EVIDENCIA` | Medida pactuada sem evidência | alerta | Rouanet |
| `DISTRIBUICAO_PERCENTUAIS` | Percentuais do plano de distribuição fora do regime | alerta | Rouanet |
| `LISTA_PRESENCA` | Atividade formativa ou treino sem lista com identificação | alerta | Rouanet, PIE, LIE |
| `RH_GRADE_FREQUENCIA` | Profissional pago em dia sem atividade registrada, ou horas pagas acima da grade de RH | alerta | PIE, LIE |
| `BENEFICIARIO_PERFIL` | Beneficiário fora do perfil exigido (vulnerabilidade na Formação Esportiva, faixa etária) | alerta | LIE |
| `BEM_SEM_DESTINACAO` | Bem permanente sem cotação, inventário ou termo de doação | alerta | todos |
| `OBJETO_AUDIOVISUAL` | Produção sem CPB, cópia na Central de Conteúdo ou depósito legal | bloqueio | ANCINE |
| **Divulgação** | | | |
| `PECA_SEM_APROVACAO` | Peça veiculada sem aprovação prévia ou antes dela | alerta | Rouanet, LIE, ANCINE |
| `PECA_MARCAS` | Marcas obrigatórias ausentes, fora de ordem ou com papel errado | alerta | Rouanet, LIE, PIE, ANCINE |
| `PECA_DEFESO` | Peça no período de defeso com versão errada do manual | alerta | federais |
| `PECA_SO_ARTE` | Comprovação só com a arte aprovada, sem registro de veiculação | alerta | Rouanet |

---

## 7. Prazos e calendário

- Cada prazo do regime é **marco + quantidade + unidade (corridos ou úteis) + regra de contagem**. Os dias úteis usam `calendario_regulatorio` (feriados nacionais, estaduais e municipais).
- Prazos iniciais:

| Regime | Prazo | Marco |
|---|---|---|
| Rouanet | prestação final em 60 dias, improrrogável | fim da execução (situação E75) |
| Rouanet | diligência de omissão ou análise preditiva em 20 dias | notificação / dia seguinte ao envio |
| Rouanet | devolução em 20 dias e recurso em 30 dias após reprovação [?] | ciência da reprovação |
| ANCINE | execução financeira e prestação final em 180 dias | conclusão do objeto (prazo que vencer por último entre processos da mesma obra) |
| ANCINE | GRU de glosa em 30 dias; recurso em 30 dias, com efeito suspensivo | comunicação / recebimento da notificação |
| PIE-SC | prestação final em 30 dias úteis; relatório parcial a cada 6 meses; esclarecimento em 10 dias úteis; defesa em 15 dias; prorrogação pedida 30 dias antes do fim; Termo de Compromisso devolvido em 10 dias | 1º dia útil após o fim da execução; assinatura do termo; notificação |
| LIE federal [web] | prestação final em 60 dias; diligência em 30 dias corridos [?]; reconsideração em 5 dias; transferência de saldo em 120 dias [?] | término do projeto; notificação; ciência da decisão |
| Saúde | documentos anuais até 30/04; GRU em 30 dias | calendário; notificação do MS |

- Prazos criam **tarefas em `atividades`** com responsável (aparecem no Calendário e no Gantt) e **notificações** em 30, 15, 7, 3 e 1 dia, com deduplicação pelo sistema de notificações existente.
- **Defeso eleitoral** como período no calendário. Peças com veiculação no período passam a ser checadas contra a versão de defeso do manual de marcas do regime.

---

## 8. Experiência do usuário

### 8.1 Lista `/prestacoes`

Padrão de `docs/LISTAS_PADRAO_OURO.md`: cabeçalho com resumo (em execução, prazo em até 30 dias, vencidas, com bloqueios), filtros por área, regime, status e responsável, busca e tabela com colunas configuráveis (`ColumnManager`): projeto, identificador oficial, regime, próximo prazo, % comprovado, saldo em conta, verificações abertas. Alternativa em cartões no celular. Botão principal preto "Nova prestação".

### 8.2 Criação guiada

1. Escolher o projeto (ou criar a partir da tela do projeto).
2. Área e mecanismo → regime sugerido pela data de aprovação, com a versão visível.
3. Identificador oficial, proponente e fonte.
4. Marcos: aprovação, liberação ou termo, início e fim da execução (ou conclusão do objeto).
5. Contas bancárias.
6. Orçamento aprovado: importar CSV, XLSX ou PDF (a importação por IA já existe) e revisar a árvore.
7. Aportes: vincular captações aprovadas.

### 8.3 Área de trabalho `/prestacoes/[id]`

Abas, com `DetailTabs` e cabeçalho com status, regime, prazo e ação principal:

1. **Visão geral**: contagem regressiva do prazo, captado × aprovado, saldo das contas, % comprovado, porte, verificações por severidade, checklist de envio do regime e próximos prazos.
2. **Orçamento**: versão ativa em árvore com aprovado, comprovado, saldo e % por item e por grupo de custo; tetos do regime; alterações com o limite visível antes de salvar.
3. **Financeiro**:
   - *Contas e extratos*: importar extrato, ver lançamentos e categorias.
   - *Despesas*: envio em lote, leitura do documento, revisão campo a campo e vínculo ao item.
   - *Conciliação*: débitos à esquerda e despesas à direita, com sugestões automáticas para confirmar.
   - *Fornecedores*: concentração por fornecedor e por partes relacionadas, em barras com o teto marcado.
4. **Objeto**: metas, locais, atividades, evidências, distribuição e bens.
5. **Divulgação**: peças com aprovação, checklist de marcas por tipo de peça e aviso de defeso.
6. **Pendências**: todas as verificações abertas, agrupadas por severidade, com ação de resolver ou justificar.
7. **Envio**: checklist do regime, geração do pacote ou espelho, registro do envio oficial (data, protocolo, situação).
8. **Após o envio**: diligências, glosas, decisão, recursos, devoluções e parcelamentos.
9. **Histórico**: auditoria completa.

Regras do `DESIGN.md`: salvar em verde à direita no rodapé; roxo só para seleção; nada de `<select>` nativo; exclusões pelo diálogo global de confirmação (hoje várias exclusões não confirmam); erros junto ao formulário; algarismos tabulares nos valores; skeleton no carregamento.

### 8.4 Celular

Registro de evidência pelo celular (foto com data, local e vínculo à atividade), consulta de prazos e pendências. A conciliação e o orçamento ficam para tela grande.

---

## 9. Inteligência artificial

- **Leitura de documento v2**: XML de NF-e/NFS-e é lido sem IA. PDF e imagem usam o modelo atual, com prompt específico do regime. Campos novos: CPF/CNPJ do emitente e do tomador, número, série, chave de acesso, retenções, presença do identificador do projeto e descrição. A IA **sugere**, a pessoa confirma; nada é aceito automaticamente.
- **Extrato em PDF** → lançamentos.
- **Sugestão de conciliação** por valor, data, favorecido e número.
- **Rascunho do Relatório de Execução do Objeto** a partir de metas, atividades, locais e evidências, editável.
- **Correções na função existente**: validar o token de quem chama e `can_access_prestacao` antes de baixar o arquivo; aceitar só caminhos da organização; registrar custo e modelo usado por chamada.

---

## 10. Segurança, LGPD e guarda

- RLS por `organization_id` e papel em todas as tabelas novas e alteradas; `can_access_prestacao` deixa de depender de projeto ou captação.
- Status, aceite de despesa e registro de envio por funções no banco com checagem de papel e escrita atômica no log.
- Arquivos em `{orgId}/prestacoes/{prestacaoId}/...`, com migração dos arquivos atuais.
- **LGPD**: listas de presença e declarações com CPF ficam como arquivo; quando estruturadas, o CPF é mascarado e só o hash é usado para busca. Em PRONON/PRONAS, **nenhum dado clínico de paciente** entra no sistema: só contagens agregadas e documentos exigidos.
- **Guarda**: após o envio, despesas e arquivos ficam travados contra exclusão até a data do regime (Rouanet: entrega + 6 meses + 5 anos; PIE: 10 anos; saúde: 5 anos após a aprovação). Correções viram nova versão, não sobrescrita.
- Bloqueio de rota para o módulo, com as colunas `modulos_ativos` e `modulos_acesso` criadas por migration e administradas na tela de admin. Até a liberação pública, só super admin.

---

## 11. Riscos

| Risco | Mitigação |
|---|---|
| A norma muda no meio do projeto | Regimes versionados, migração explícita e auditada, fonte em cada regra |
| Fontes incompletas (LIE federal, saúde) | Fases dessas áreas só começam com o manual oficial em mãos; até lá, regime `generico` |
| Sem API dos sistemas oficiais; dados divergirem | Espelho com campos na ordem da tela oficial; registro manual da situação oficial; importação de exportações oficiais quando existirem |
| Responsabilidade por orientação errada | Alertas como apoio, fonte citada, justificativa sempre possível, aviso de que a análise é do órgão |
| Dados pessoais de beneficiários e pacientes | Minimização, mascaramento, arquivos privados, sem dado clínico |
| Escopo crescer sem fim | v1 limitada a cinco regimes; novos estados e municípios entram como configuração depois |
| Volume (projetos com milhares de lançamentos) | Índices por prestação e conta, paginação, verificações incrementais |

---

## 12. Sequência de entrega

Estimativas em semanas de uma pessoa full-stack.

### Fase 0 — Fundação (2 semanas)

- Exportar o schema remoto das tabelas de prestação para migrations e conferir tipos, padrões e chaves.
- `organization_id` com preenchimento retroativo; RLS por organização e papel.
- Migrar caminhos de arquivo para `{orgId}/...`; corrigir `extrair-comprovante` e `importar-orcamento`.
- Funções de banco para status e log; corrigir erros silenciosos e exclusões sem confirmação.
- Bloqueio de rota, colunas de módulo e tela de admin para ativar o módulo por organização.
- Primeiros testes do módulo.

### Fase 1 — Núcleo multi-regime e Rouanet (3 semanas)

- `prestacao_regimes`, `calendario_regulatorio` e o regime `rouanet_in29_2026`.
- Criação guiada, marcos, prazos calculados, tarefas e notificações.
- Orçamento versionado em árvore, com grupos de custo e alterações.
- Nova visão geral e lista no padrão.

### Fase 2 — Financeiro (4 semanas)

- Contas, importação de extrato, lançamentos.
- Fornecedores e partes relacionadas; despesas v2 e pagamentos.
- Tela de conciliação com sugestões.
- Motor de checagens com as checagens financeiras e de documento da Rouanet; tela de pendências.
- Leitura de documento v2 (XML sem IA; PDF/imagem com IA).

### Fase 3 — Objeto e divulgação (3 semanas)

- Metas, locais, evidências, distribuição (regras da IN 29) e bens.
- Peças de divulgação com marcas, aprovação e defeso.

### Fase 4 — Envio e piloto em cultura (3 semanas)

- Checklist de envio da Rouanet, espelho Salic, rascunho do relatório do objeto, GRU.
- Pós-envio: diligências, glosas, decisões, recursos e devoluções.
- Piloto com projetos Rouanet reais.

### Fase 5 — Audiovisual / ANCINE (3 semanas)

- Regimes `ancine_in159_2021` e `ancine_in150_2019`; prestação por fonte e agrupamento por obra.
- Matriz de reembolso, tetos de gerenciamento, agenciamento e colocação, contrapartida, concentração por obra.
- Planilhas RP, DE e DO (depende do manual de planilhas do STR); GRU por fonte; calculadora de débito e simulador de parcelamento.
- Checklist do objeto por modalidade (CPB, Central de Conteúdo, depósito legal, jogos).

### Fase 6 — Esporte (3 semanas, a LIE depende da Portaria MESP 10/2026 em mãos)

- `pie_sc_in04_2025`: conta única, apostilamento prévio, faixas de 10% e 20%, relatórios semestrais, checklist I–XXII, pacote em PDF assinado para o Prosas, atesto de recebimento, bolsa-atleta.
- `lie_lc222_2026` e `lie_portaria424_2020`: conta no BB ou na Caixa, atividade-meio ≤ 15%, vedações da LC 222, até 2 remanejamentos, prestação parcial sob demanda e final em 60 dias, nível da prática (formação, excelência, toda a vida) com teto de captação, grade horária de RH × frequência × pagamentos, lista de beneficiários com perfil, marcas da LIE com versão de defeso.

### Fase 7 — Saúde (3 semanas, depende do texto da Portaria 8.031/2025)

- Regimes por portaria (875, 1550, PRC 5 e Anexo LXXXVI-A).
- Prestação anual até 30/04, auditoria independente, Planilha II, Tabela 1, relação de bens com inventário, recibos aos doadores (em 2026, só empresas do lucro real deduzem, até 1% do IR).
- Registro de produção no CMD (substituiu o CIHA) e operação no Transferegov.

### Fase 8 — Expansão contínua

- Tela de admin para criar e publicar regimes sem deploy de código (parâmetros e checklists; novas checagens continuam em código).
- Regimes estaduais e municipais (ProAC, Pro-Mac, FIA, Fundo do Idoso) e relatório ao patrocinador para patrocínio direto.
- Integração bancária (Open Finance) para extrato automático.

**Total das fases 0 a 7: cerca de 24 semanas.** As fases 5, 6 e 7 podem correr em paralelo com duas pessoas depois da fase 2.

---

## 13. Testes

- **Unitários por checagem** (`tests/prestacao/*.test.ts`, com o `tsx --test` já usado): casos positivos e negativos montados a partir dos exemplos dos manuais (ex.: complementação de R$ 100 mil com R$ 50 mil captados; agenciamento de R$ 100 mil autorizados e R$ 80 mil captados = teto de R$ 8 mil; ação formativa de 600 pessoas = 60).
- **Prazos**: dias corridos e úteis com feriados, marcos de cada regime e o "prazo que vence por último" da ANCINE.
- **Conciliação**: extratos de exemplo com tarifas, rendimentos, estornos e pagamentos parcelados.
- **RLS**: pessoa de outra organização, colega da mesma organização com papéis diferentes, anônimo.
- **Saídas**: arquivos de referência para espelho Salic, RP/DE/DO e Planilha II.
- **E2E (Playwright)**: criação guiada → importar extrato → lançar despesa → conciliar → resolver pendências → gerar pacote.

---

## 14. Critérios de sucesso do piloto (cultura)

- 3 projetos Rouanet reais em execução, de organizações diferentes.
- 100% dos débitos da conta de movimento conciliados antes do prazo final.
- Nenhuma diligência da análise preditiva por erro formal que o sistema detecta (número de pagamento, documento fora da vigência, tomador, saldo).
- Tempo para montar a prestação final reduzido pela metade em relação ao processo atual da equipe (medir antes).
- Toda regra exibida com fonte; nenhuma regra fixa em componente.

---

## 15. Arquivos previstos

### Criar

- `supabase/migrations/2026XXXX_prestacao_fundacao.sql` (schema atual versionado, `organization_id`, RLS por papel, funções de status)
- `supabase/migrations/2026XXXX_prestacao_regimes.sql` (catálogo, calendário, seeds)
- `supabase/migrations/2026XXXX_prestacao_financeiro.sql` (contas, lançamentos, fornecedores, despesas, pagamentos)
- `supabase/migrations/2026XXXX_prestacao_objeto.sql` (metas, locais, evidências, peças, bens)
- `supabase/migrations/2026XXXX_prestacao_pos_envio.sql` (diligências, glosas, decisões, recursos, devoluções, verificações, eventos)
- `lib/prestacao/regimes/` (schemas Zod dos parâmetros e seeds por regime)
- `lib/prestacao/checagens/` (uma função por código de checagem)
- `lib/prestacao/prazos.ts`, `lib/prestacao/conciliacao.ts`, `lib/prestacao/extrato/` (OFX, CSV, PDF BB)
- `lib/prestacao/saidas/` (espelho Salic, RP/DE/DO, Planilha II, pacote Prosas, dossiê)
- `app/api/prestacoes/[id]/verificar/route.ts`, `.../exportar/route.ts`
- `app/(dashboard)/prestacoes/[id]/financeiro/`, `objeto/`, `pendencias/`, `envio/`, `pos-envio/`, `historico/`
- `components/prestacao/` (árvore de orçamento, tela de conciliação, cartão de verificação, checklist de envio)
- `tests/prestacao/`

### Modificar

- `app/(dashboard)/prestacoes/page.tsx`, `[id]/layout.tsx`, `[id]/page.tsx`, `orcamento/`, `comprovantes/` (vira Despesas), `atividades/`, `distribuicao/`, `divulgacao/` (vira Peças), `relatorio/`
- `components/modals/NovaPrestacaoModal.tsx` (vira criação guiada)
- `supabase/functions/extrair-comprovante/index.ts`, `supabase/functions/importar-orcamento/index.ts`
- `app/(dashboard)/layout.tsx` (bloqueio de rota e navegação do módulo)
- `lib/supabase/types.ts`
- `app/(dashboard)/projetos/[id]/page.tsx` (atalho para criar ou abrir a prestação)
- `package.json` (biblioteca para gerar XLSX e PDF, a escolher na fase 4)

---

## 16. Decisões em aberto

1. **Prioridade entre áreas.** Sugestão: cultura → audiovisual → esporte → saúde, pela qualidade das fontes e pela base de clientes.
2. **Quem opera.** Proponente direto, consultoria/captador gerindo vários proponentes, ou os dois. Isso muda papéis, a "carteira" por proponente e o que o patrocinador vê.
3. **Plano comercial.** Se o módulo entra em todos os planos ou é cobrado à parte.
4. **Busca das fontes da seção 1** (LIE, saúde, IN 29 integral, manual STR, IN FESPORTE 04/2025).
5. **Estados e municípios na v1.** Só SC (PIE) ou já incluir outros programas usados pelos clientes.
6. **Visão do patrocinador.** Se o patrocinador recebe um relatório ou acesso de leitura à prestação.

---

## Anexo — Extrações das fontes

Ver [`prestacao-de-contas-fontes/README.md`](./prestacao-de-contas-fontes/README.md).
