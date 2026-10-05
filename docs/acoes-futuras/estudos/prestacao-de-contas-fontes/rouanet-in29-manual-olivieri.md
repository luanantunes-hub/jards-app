# Lei Rouanet — requisitos extraídos do "Manual IN 29" (Olivieri, 2026)

Fonte: Google Drive, `MANUAL_LEI-ROUANET_INSTRUCAO-NORMATIVA-29.pdf` (id do Drive omitido, 5.330.601 bytes, 46 páginas no PDF).

## 0. Como o documento foi lido e limites da fonte

- **Leitura completa, sem truncamento de texto.** `read_file_content` devolveu o texto inteiro, até a última página ("Outros manuais disponíveis", p. 45). Só que **essa leitura perdeu tudo o que está em imagem**:
  - a tabela de limites por proponente (p. 7);
  - o diagrama "Estrutura de orçamento" (p. 13);
  - os fluxogramas de notificação (p. 34 e 35);
  - o fluxograma de sanções após a reprovação (p. 40);
  - o selo "60 dias" da fase de admissibilidade (p. 24).

  Para recuperar esse conteúdo, baixei o PDF pelo próprio Drive (`download_file_content`), extraí o texto com `pdftotext` e renderizei essas páginas para ler as imagens. **Nada ficou faltando.**
- **Paginação.** Os números de página citados abaixo ("p. N") são do PDF. Conferi: coincidem com o número impresso no rodapé de cada página. O índice da p. 4 também usa essa numeração.
- **Natureza da fonte.** É um **manual secundário**, escrito por um escritório de advocacia, e **não o texto da IN**. A própria introdução diz que o manual "compila e simplifica" e que "não traz todos os detalhes" (p. 3). O manual não cita número de artigo da IN para quase nada. As exceções são o art. 42 (medidas de ampliação de acesso, p. 20), o art. 41, § 6º (Vale-Cultura, p. 29) e um "Art. 50 - § 1º" sem indicar a norma (p. 26).
- **Consequência para o software.** Vários pontos pedidos (banco, aplicação financeira, campos de NF, cotação, GRU, formulários) **não constam** neste documento. Para esses pontos, o texto integral da IN 29/2026 é a fonte a consultar.
- **Convenções.** [WEB] marca o que veio da busca na web e não do documento. [?] marca o que é ambíguo.

---

## 1. Identificação

| Item | Conteúdo | Fonte |
|---|---|---|
| Título | "MANUAL IN 29" (metadado). Capa: "Lei de Incentivo à Cultura — Instrução Normativa nº 29 de 29 de janeiro de 2026" | p. 1; metadados do PDF |
| Autor/órgão | Olivieri – Consultoria Jurídica em Cultura e Entretenimento (escritório privado, **não é publicação do MinC**). Metadado de autoria do PDF: "(nome omitido)", gerado no Canva | p. 2–3; metadados |
| Data do manual | Não impressa. Metadado de criação: 25/02/2026 | metadados do PDF |
| Órgãos citados | SEFIC (Secretaria de Economia Criativa e Fomento Cultural): recebe e analisa projetos. SGPTC (Subsecretaria de Gestão de Prestação e Tomada de Contas): analisa a prestação de contas. CNIC (Comissão Nacional de Incentivo à Cultura). MinC | p. 6, 25, 26, 38 |
| Base legal citada | Lei 8.313/91; Decreto 11.453/23; Lei 9.784/99; "demais regras administrativas e tributárias"; IN nº 29 "publicada em 29 de janeiro de 2026" | p. 6 |
| Lista "Legislações" | Lei 8.313/91; Lei 9.784/99; **Decreto 10.755/2021**; IN 29/2026 | p. 44 |
| Inconsistência [?] | A p. 6 cita o Decreto 11.453/23, mas a p. 44 lista o Decreto 10.755/21. [WEB] O Decreto 10.755/2021 foi revogado pelo Decreto 11.453/2023. O decreto vigente é, portanto, o 11.453/23 | p. 6 vs p. 44 |
| Outras normas citadas | Lei 13.146/2015, arts. 42 a 44, 54, 63, 67 a 71, 73 e 102; Decreto 3.298/1999, art. 46; Decreto 9.404/2018 (acessibilidade). Lei 8.313/91, art. 28, parágrafo único (contrato prévio de elaboração) e art. 30 (vantagem indevida). Decreto 11.453/23, art. 53, caput e § 1º | p. 16, 24, 30, 31 |
| Sistema eletrônico | **Salic**: portfólio, upload de documentos fiscais, prestação de contas, inabilitação, identificação de proposta de edital | p. 11, 22, 33, 34, 37, 39 |
| Vigência intertemporal | A IN "aplica-se a todos os projetos em andamento, respeitados os direitos adquiridos" | p. 43 |

**Confirmação na web [WEB]**

- IN MinC nº 29, de 29/01/2026. Publicada no DOU em **30/01/2026**. O manual diz "publicada em 29 de janeiro" (p. 6) [?].
- Trata da apresentação, recepção, seleção, análise, aprovação, acompanhamento, monitoramento, prestação de contas e avaliação de resultados do mecanismo de Incentivo a Projetos Culturais do Pronac.
- **Revogou a IN MinC nº 23, de 05/02/2025.** A IN 23/2025, por sua vez, já havia revogado a IN 11/2024.
- Uma fonte afirma que a IN 29 entrou em vigor em 29/01/2026 [?].
- **Continua vigente em 2026, com alteração.** A IN MinC nº 34, de 11/08/2026 (DOU de 14/08/2026), alterou a IN 29: acrescentou parágrafo ao art. 14 que exclui projetos de **patrimônio cultural** dos limites de valor e de quantidade de projetos do art. 10, § 1º, III. Não encontrei revogação da IN 29 até 01/10/2026.
- Fontes: gov.br/cultura (página da IN 29, não acessada, só listada na busca); Mattos Filho; CQS/FV; LegisWeb (IN 34/2026); Incentiv; IDEA.

---

## 2. Linha do tempo e prazos

| Fase | Regra/prazo | Marco de contagem | Fonte |
|---|---|---|---|
| Apresentação de proposta | De **01/02 a 31/10** de cada ano | calendário | p. 11 |
| Plano anual/plurianual | Prazo final **31/08** de cada ano | calendário | p. 12 |
| Chamamento público de patrocinador | O patrocinador pede ao MinC a avaliação do edital com **≥ 30 dias** de antecedência | data de lançamento do edital | p. 22 |
| Fase de admissibilidade | Selo "**60 dias**" ao lado do título [?: provavelmente a duração da fase] | não consta | p. 24 |
| Etapa 1 — Exame preliminar | Documentos e currículo do proponente e dirigentes; trilhas de controle (regularidade do proponente e dos sócios; CNAE) | — | p. 24 |
| Etapa 2 — Análise das informações | Enquadramento (art. 18 ou 26); previsão de acessibilidade, democratização e ações formativas | — | p. 24 |
| Indeferimento | Proposta arquivada. O proponente pode pedir desarquivamento: se negado, vai para o arquivo; se aceito, volta à análise | prazo não consta | p. 25 |
| Enquadramento → CNIC | Proposta fica "disponível para CNIC" por **7 dias**. Se a CNIC não se manifestar, há aprovação tácita; ou a CNIC reenquadra | disponibilização à CNIC | p. 25 |
| Recurso do enquadramento | **10 dias** (Lei 9.784/99). Decisão: enquadra no artigo solicitado ou mantém a decisão | decisão de enquadramento [?] | p. 25 |
| Portaria de aprovação para captação | Publicação da portaria → "pode captar incentivos fiscais" | — | p. 25–26 |
| Gatilho da análise técnica | Captação de **≥ 10%** ou apresentação de contrato de patrocínio | — | p. 26 |
| Adequação do projeto | "**20 dias**" [?: prazo para o proponente adequar após atingir 10%]. Deve incluir: acessibilidade/comunicação/divulgação acessíveis; democratização e ampliação de acesso; contrapartidas sociais; outros aspectos. **Não pode alterar: objeto, enquadramento, gratuidade** | atingir 10%/contrato [?] | p. 26 |
| Parecer técnico | **30 dias** | não consta [?] | p. 26 |
| CNIC → parecer de aprovação de execução | Resulta em "Homologado" | — | p. 26 |
| Liberação para execução | Captação de **≥ 20%** do valor do projeto → transferência para a **conta movimento** → execução com movimentação da conta | — | p. 26 |
| Reprovação ou corte na CNIC | Recurso "Art. 50 - § 1º" [?: de qual norma, não diz]. Se mantida a não aprovação, recurso ao Ministro (Lei 9.784/99). Se mantido o indeferimento, o dinheiro depositado vai para outro projeto do mesmo proponente ou para o FNC | prazos não constam | p. 26 |
| Exceções à exigência dos 10% | Vão direto ao parecerista e à CNIC: planos anuais/plurianuais; aprovados em chamamento público ou edital; contratos de patrocínio que garantam **≥ 20%** do valor, sem condicionantes | — | p. 27 |
| Prazo de captação | Até **36 meses**, com prorrogações automáticas. Deve ser sinalizado no cadastramento da proposta | não consta [?: início provável na portaria] | p. 27 |
| Execução: falta de comprovação no Salic | SEFIC notifica → **20 dias**. Se o proponente regulariza, segue a execução. Se não, **inadimplência** | notificação | p. 34 |
| Execução: denúncia, indício de irregularidade ou de vantagem indevida | SEFIC notifica → **10 dias**. Se não regularizar: suspensão do projeto, devolução do dinheiro, sanções penais, suspensão dos demais projetos | notificação | p. 35 |
| Prestação de contas final | Concluída em até **60 dias** após o fim da execução, **IMPRORROGÁVEL** | fim da execução | p. 36 |
| Relatório final não entregue | Inabilitação lançada no Salic + diligência de **20 dias** para regularizar, sob pena de reprovação | diligência | p. 37 |
| Análise | Relatório final → análise pela SGPTC (objeto → financeira) → **Laudo Final de Avaliação** | prazos de análise não constam | p. 38 |
| Após reprovação | **20 dias** para devolver os recursos com correção monetária e juros. **30 dias** para propor ação compensatória ou recorrer ao Ministro [?: leitura das setas do diagrama]. Se mantida a reprovação: CADIN e SIAFI, TCE no TCU, comunicação à Receita Federal, Dívida Ativa da União | reprovação | p. 40 |
| Inabilitação | Duração de **3 anos** | não consta | p. 41 |
| Guarda de documentos | **5 anos**, contados **após 6 meses** da entrega da prestação de contas (na prática, até 5,5 anos depois da entrega) | entrega da PC | p. 33 |
| Prazo de execução | **Não consta** (duração e prorrogação geral). Para plano anual/plurianual, a prorrogação da execução exige pedido de alteração de nome, cronograma e tipologia | — | p. 12 |

---

## 3. Contas bancárias e movimentação

| Tema | Conteúdo | Fonte |
|---|---|---|
| Conta captação × conta movimento | O fluxograma cita a transferência para a "**conta movimento**" depois de captados ≥ 20%. Não nomeia a conta de captação, mas diz "dinheiro depositado" antes da homologação | p. 26 |
| "Conta livre" | Cita o "arquivamento de projetos sem movimentação de conta livre" como efeito da inabilitação [?: termo não definido; possivelmente a conta movimento liberada] | p. 40 |
| Banco | **Não consta** | — |
| Percentual mínimo para liberação | **20%** do valor do projeto | p. 26 |
| Recursos de projeto não aprovado | Transferir para outro projeto do mesmo proponente ou para o FNC | p. 26 |
| Bloqueio | A inabilitação, inclusive cautelar, bloqueia contas e impede movimentar recursos e captar patrocínios ou doações | p. 40–41 |
| Aplicação financeira / rendimentos | **Não consta** | — |
| Tarifas bancárias | Aparecem só como custo administrativo ("tarifas bancárias cujo adimplemento se faz necessário" às atividades administrativas), dentro do teto de 15% | p. 16 |
| Meios de pagamento aceitos | **Não consta.** [WEB] A movimentação deve ser feita só por meios formais (PIX, TED). Acabou a transferência diária de R$ 1.500 para a conta pessoal do proponente para saques | — |
| Transferências entre projetos | Só no caso do fluxo de indeferimento (p. 26). [WEB] A IN 29 limita a uma única transferência, apenas em caso de não aprovação, não atingimento da captação mínima ou não execução | p. 26 |
| Depósito ao FNC | O depósito de recursos irregularmente gastos "reverte a inadimplência desde que não tenha outras irregularidades" | p. 41 |

---

## 4. Orçamento e despesas

### 4.1 Estrutura do orçamento (diagrama, p. 13)

O "**VALOR TOTAL DO PROJETO**" se divide em três blocos:

1. **Valor do projeto:**
   - Pré-produção;
   - Produção;
   - Pós-produção;
   - "Recolhimento" [?: provavelmente recolhimento de tributos ou encargos, não explicado];
   - Contador + Jurídico.
2. **Custos vinculados:**
   - Administrativo — **15%**;
   - Custos de acessibilidade, comunicação e divulgação acessíveis — **20%**.
3. **Captação de recursos:** "Captação – **10% até 150.000,00**" [?: entendido como 10% com teto absoluto de R$ 150.000].

O documento **não diz sobre qual base** incidem os percentuais 15/20/10% (valor do projeto? valor total?) [?].

O manual não detalha produtos, etapas e itens além disso. Ele cita "produto principal" e "produto secundário de maior valor" para o enquadramento (p. 9).

### 4.2 Remanejamento e readequação

- **Sem autorização da SEFIC:** o proponente pode remanejar rubricas se não alterar (a) o valor total do projeto e (b) o valor aprovado para custos vinculados e para remuneração de captação (p. 12). **O manual não estabelece limite percentual.**
- **Pelo Salic, durante a execução:** pedidos de alteração de orçamento, nome, local de realização ou plano de distribuição (p. 34).
- **Na fase de adequação, não pode mudar:** objeto, enquadramento, gratuidade (p. 26).
- **Bloqueio:** a inadimplência impede o andamento de pedidos de alteração ou readequação (p. 40).

### 4.3 Tetos percentuais

| Teto | Valor | Base | Fonte |
|---|---|---|---|
| Custos administrativos | máx. **15%** | não consta [?] | p. 13, 16 |
| Acessibilidade, comunicação e divulgação acessíveis | máx. **20%** | não consta [?] | p. 13, 17 |
| Regra de proporcionalidade | Administrativos e acessibilidade/divulgação "deverão ser gastos proporcionalmente à captação" | valor captado | p. 17 |
| Remuneração de captação | **10%, até R$ 150.000** [?] | não consta | p. 13 |
| Remuneração do proponente | até **20% do valor captado**, desde que preste serviços previstos no orçamento. Inclui serviços de cônjuge, companheiro, empresas coligadas ou com sócios em comum | valor captado | p. 15 |
| Remuneração do proponente PF ou MEI | até **30% do valor captado** | valor captado | p. 15 |
| Exceção ao limite de 20% do proponente | "grupos artísticos, familiares, corpos estáveis, grupos e coletivos culturais ou artístico-culturais" [?: o manual não diz se ficam sem limite ou com outro limite] | — | p. 15 |
| Concentração por fornecedor | até **20% do valor captado** para um mesmo fornecedor | valor captado | p. 15 |
| Exceções à concentração | Projetos executivos; conservação e restauro de bens tombados, acautelados ou de reconhecido valor cultural; construção, reforma, requalificação ou adequação de equipamentos culturais; serviços gráficos para livros artísticos, literários ou humanísticos; energia elétrica | — | p. 15 |
| Direitos autorais e conexos | até **10% do valor homologado para execução**, a preço de mercado | valor homologado | p. 14 |
| ECAD | Seguir o regulamento de arrecadação do ECAD | — | p. 14 |
| Audiovisual: direitos de exibição cinematográfica | até **20% do valor homologado para execução** | valor homologado | p. 14 |
| Divulgação (isolada) | Não há teto separado. Está somada à acessibilidade e comunicação nos 20% | — | p. 17 |

**O que entra nos custos administrativos (p. 16):**

- bens e material de consumo administrativos;
- locação do imóvel administrativo, com encargos, tributos e condomínio;
- tributos e tarifas bancárias das atividades administrativas;
- telefone, internet, água e luz;
- postagem;
- pessoal administrativo e encargos (plano de saúde e vale-transporte permitidos);
- diárias do pessoal administrativo;
- **elaboração da proposta** por contrato prévio, paga após a aprovação de execução (Lei 8.313/91, art. 28, parágrafo único);
- consultoria de gestão e **elaboração de prestação de contas**;
- regularização documental de imóvel tombado.

**O que entra em acessibilidade, comunicação e divulgação (p. 17):**

- medidas temporárias de acessibilidade (rampas, pisos, passarelas, corrimãos removíveis, áreas reservadas);
- consultor ou coordenador de acessibilidade;
- equipe de apoio a pessoas com deficiência ou mobilidade reduzida;
- jornalista e assessoria de imprensa;
- valoração de mídia;
- serviços gráficos;
- gestão de redes sociais.

### 4.4 Limites de valor por item (p. 14)

**Cachês por apresentação**

| Categoria | Teto |
|---|---|
| Artista individual | R$ 25.000 |
| Grupos e coletivos (exceto orquestras) | R$ 50.000 |
| Orquestras | R$ 5.000 por músico + R$ 25.000 para o maestro ou regente |
| Palestrante, orador ou conferencista | R$ 5.000 |

A CNIC pode aprovar valores superiores.

**Audiovisual**

| Produto | Teto |
|---|---|
| Curta-metragem | R$ 350.000 |
| Média-metragem | R$ 900.000 a R$ 1.200.000 |
| Mostras, festivais e eventos — 1ª edição | R$ 600.000 |
| Mostras, festivais e eventos — 2ª edição | Pelo histórico de maior captação do proponente, admitidos valores captados em outros mecanismos |
| Programa de TV | R$ 80.000 por episódio |
| Programa de rádio | R$ 135.000 por programação semestral |
| Podcast | R$ 30.000 por episódio |
| Sítio de internet — infraestrutura | R$ 80.000 |
| Sítio de internet — conteúdo | R$ 220.000 |
| Aplicativos educativos e culturais | R$ 850.000 |
| Desenvolvimento de game | R$ 400.000 |
| Websérie | R$ 60.000 por episódio |
| Games ou jogo eletrônico | R$ 1.500.000 |
| Plataforma VOD independente | R$ 2.000.000 |

- Vários produtos audiovisuais no mesmo projeto: vale a soma dos limites.
- Os valores podem ser superiores em projetos de edital ou com contrato ou termo de patrocínio que assegure **≥ 50%** do valor solicitado, a preço de mercado.
- A CNIC pode aprovar valores superiores.
- [?] Há duas linhas distintas: "Desenvolvimento de game" (R$ 400 mil) e "Games ou jogo eletrônico" (R$ 1,5 mi). O manual não explica a diferença.

### 4.5 Faixas, porte e limites de carteira

**Limites por tipo de proponente (tabela-imagem, p. 7)**

| | Pessoa física | MEI | Demais PJ (sem limite separado para o Simples) |
|---|---|---|---|
| Quantidade de projetos por proponente | 2 | 4 | 10 |
| Valor máximo de projetos ativos por proponente | R$ 500.000 | R$ 1.500.000 | R$ 15.000.000 |
| Limite máximo por projeto | R$ 500.000 | R$ 1.500.000 | R$ 1.500.000 |

**Mesma carteira**

- Empresas com sócios ou dirigentes em comum, ou do mesmo grupo empresarial (inclusive OSCs), cumprem os limites "por proponente e por empresa em conjunto" (p. 7).
- Empresas com os mesmos sócios ou dirigentes contam como a mesma carteira (p. 11).
- Entre PF e PJ vale o mesmo entendimento, prevalecendo o limite da PJ com maior capacidade de captação (p. 7).

**Tetos por tipo de projeto (p. 8)**

- **R$ 6.000.000:**
  - desfiles festivos;
  - circo, dança, teatro e música com itinerância em ≥ 2 regiões do Brasil ou entre o Brasil e o exterior;
  - exposições de artes visuais com museografia ou ligadas a acervos de museus;
  - territórios criativos;
  - plataformas VOD independentes, respeitando os tetos do audiovisual.
- **R$ 15.000.000:**
  - festival, bienal, festa ou feira;
  - teatro musical;
  - ópera.
- [?] O manual não explica como esses tetos convivem com o limite de R$ 1,5 mi por projeto para PJ.

**Exceções aos tetos (p. 9)**

- Planos anuais e plurianuais: respeitam a série histórica de captação dos últimos **3 exercícios fiscais**.
- Patrimônio cultural. [WEB] A IN 34/2026 reforça essa exceção, inclusive quanto à quantidade de projetos.
- Construção, restauro, requalificação e reforma de museus.
- Equipamentos culturais de reconhecido valor.
- Ações continuadas podem superar o limite da carteira, mas a homologação da nova edição depende do envio da prestação de contas da edição anterior.

**Outros limites e faixas**

- **Primeiro projeto:** sem comprovar atuação cultural, o projeto fica limitado a **R$ 200.000** (p. 11).
- **Custo-benefício (critério de admissão):** valor solicitado de captação ÷ quantidade de beneficiários do produto principal **≤ R$ 300**. Não se aplica a propostas sem cobrança de ingresso ou venda de produto (p. 10, 24).
- **Porte, para a análise da prestação de contas (p. 36):**
  - pequeno: até R$ 750.000, com subfaixa até R$ 200.000;
  - médio: de R$ 750.001 a R$ 5.000.000;
  - grande: acima de R$ 5.000.000.
  - Ver seção 8.

### 4.6 Despesas vedadas (p. 18)

1. Taxa de administração ou similar.
2. Pagamentos em benefício de agente público ou político da administração direta ou indireta, por qualquer serviço, salvo hipóteses da LDO ou de leis específicas.
3. Serviços de captação quando o projeto (a) tem patrocínio exclusivo de edital ou chamamento público, ou (b) foi apresentado por instituição cultural criada pelo patrocinador. Também no chamamento público: "não poderá remunerar a captação de recursos" (p. 22).
4. Consultoria, assessoria técnica, seleção ou avaliação de projetos prestadas diretamente ao patrocinador.
5. Aquisições, contratações ou pagamentos sem relação direta, necessária e comprovada com o objeto e a finalidade do projeto aprovado.

### 4.7 Cotação, partes relacionadas, tributos

- **Cotação ou orçamentos de fornecedores:** **não consta.** Há só a exigência de preços "compatíveis com os praticados no mercado" (p. 14) e de "economicidade e exclusividade" quando o patrocinador fornece produtos ou serviços (p. 31).
- **Partes relacionadas:**
  - remuneração do proponente inclui cônjuge, companheiro, coligadas e empresas com sócios em comum (p. 15);
  - vedação a pagamento a agente público (p. 18);
  - proponente não pode ser nem ter como dirigentes agentes políticos, dirigentes públicos, servidores do MinC e vinculadas, ou seus cônjuges e companheiros (p. 24);
  - fornecimento pelo patrocinador é permitido se comprovadas economicidade e exclusividade (p. 31).
- **Tributos:** só os tributos das atividades administrativas, dentro dos 15% (p. 16), e o item "Recolhimento" no diagrama (p. 13) [?]. **Não há regra sobre retenções ou impostos de NF.**

---

## 5. Documentos comprobatórios

| Item | Conteúdo | Fonte |
|---|---|---|
| Lançamento | A prestação de contas é "alimentada no sistema em tempo real", durante a execução, com upload dos documentos fiscais | p. 34 |
| NF eletrônica | "Notas Fiscais Eletrônicas" é uma das trilhas de controle do MinC | p. 33 |
| Campos obrigatórios de NF ou recibo de despesa (PRONAC, datas, descrição) | **Não consta** | — |
| Comprovante de pagamento | **Não consta** | — |
| Contratos | Contrato prévio de elaboração de proposta (pago após aprovação, p. 16); contrato de patrocínio (gatilho de admissão, p. 26–27); autorização de uso de obras protegidas por direitos autorais e conexos (a falta gera ressalva, p. 39). Requisitos de contrato com fornecedor: **não consta** | p. 16, 26, 27, 39 |
| Comprovação de gratuidade, PF | Declaração assinada com recibo contendo **nome completo e CPF** do beneficiário, **nome e PRONAC do projeto** e comprovação do caráter social ou educativo | p. 19 |
| Comprovação de gratuidade, instituição | Nome, **CNPJ** e dados do representante ou subscritor; nome do projeto e **PRONAC**; quantidade de ingressos ou produtos; compromisso de distribuição gratuita à população | p. 19 |
| Vale-Cultura | Comprovante de fornecimento de Vale-Cultura em projetos de custeio de atividades permanentes | p. 37 |
| O que invalida um comprovante | **Não consta** como regra explícita | — |

Situações que o manual liga a um desfecho:

- despesa fora do prazo de execução: gera **ressalva** se o fato gerador ocorreu dentro do prazo ou se a natureza da despesa justifica pagamento posterior; caso contrário, o desfecho não é dito [?] (p. 39);
- despesa sem relação com o objeto: vedada (p. 18);
- inadequações financeiras sem dolo: ressalva (p. 39);
- dano ao erário: reprovação (p. 39).

---

## 6. Comprovação do objeto

| Item | Regra | Fonte |
|---|---|---|
| Relatório final — conteúdo obrigatório | (1) realização do objeto, com evidências; (2) relação entre metas e resultados; (3) produto cultural (fotos, listas de presença, registro audiovisual, arquivo digital etc.); (4) etapas de execução com os comprovantes de despesas; (5) medidas de acessibilidade; (6) democratização de acesso; (7) mostra ou registro fotográfico e videográfico das peças do plano de divulgação; (8) comprovante de Vale-Cultura, para atividades permanentes. "**Lançar todos os itens no Salic**" | p. 37 |
| Metas, produtos, público | Relação metas × resultados; "produto principal" define o enquadramento e o custo-benefício; quantidade de beneficiários do produto principal | p. 9, 10, 37 |
| Plano de Distribuição | Os percentuais de democratização já devem estar declarados no Plano de Distribuição enviado com a proposta | p. 19 |
| Ingressos e produtos: distribuição gratuita à população | **mínimo 10%**, de caráter social ou educativo, incluindo professores da rede pública | p. 19 |
| Gratuidade promocional dos patrocinadores | **até 10%**, rateados entre todos | p. 19 |
| Gratuidade promocional do proponente | **até 10%**, para divulgação | p. 19 |
| Venda a preço popular | **mínimo 20%** a no máximo **R$ 50,00** | p. 19 |
| Preço médio | "**50%** comercializado com preço médio de **R$ 250,00**" [?: não diz se R$ 250 é teto do preço médio nem se os 50% são fixos ou máximos] | p. 19 |
| Apresentações exclusivas | As cortesias podem ser concentradas em sessões exclusivas de patrocinador ou proponente, ou em ações sociais e educativas, respeitado o limite percentual total | p. 19 |
| Definições | **Caráter social:** grupos minoritários ou vulneráveis (negros, indígenas, povos tradicionais, populações nômades, pessoas em situação de rua, LGBTQIAPN+, PcD, beneficiários do Bolsa Família e do CadÚnico). **Caráter educativo:** alunos da rede pública de ensino fundamental, médio ou superior | p. 19 |
| Local da gratuidade | "Preferencialmente nos pontos de venda" | p. 19 |
| Medidas de ampliação de acesso | **Pelo menos 1** da lista do art. 42 da IN. Ver a lista completa abaixo da tabela | p. 20 |
| Contrapartida social (ação formativa cultural) | **10%** do público total do produto principal, com **mín. 20 e máx. 500** pessoas. Gratuita, para estudantes e professores de escolas públicas. Não se aplica a projetos com ingressos ou produtos gratuitos. Exemplo: exposição com 600 pessoas → ação para 60 | p. 21 |
| Acessibilidade | Medidas compatíveis com cada linguagem, justificadas, em três aspectos: **arquitetônico** (acesso, sanitários, circulação); **comunicacional e de conteúdo** (pessoas autistas e com deficiência intelectual, física, auditiva, visual, psicossocial ou múltipla); **comunicação e divulgação acessíveis** (materiais em formato acessível). Em caso de impossibilidade técnica, justificar e propor alternativas à CNIC. É **obrigatório** usar o **Guia de Acessibilidade do Ministério dos Direitos Humanos e da Cidadania** | p. 30 |
| Divulgação e marcas | Logomarcas da Lei de Incentivo à Cultura, do MinC e do Governo Federal em toda divulgação institucional, conforme o **Manual de uso de Marcas do PRONAC**. **Leiaute submetido previamente ao MinC.** Visibilidade **igual à marca do patrocinador majoritário**, conforme o Manual de Identidade Visual da SEFIC. As medidas de acessibilidade devem ser divulgadas. Logomarca do **Vale-Cultura** obrigatória em atividades de caráter permanente (art. 41, § 6º, da IN) | p. 29 |
| Aprovação de logomarcas | Feita no Salic antes da divulgação | p. 34 |
| Patrocinador | Pode receber **10% do produto final** e pôr sua logomarca | p. 31 |
| Apresentação para convidados | Não é vantagem indevida se respeitar **10% da lotação total** das apresentações | p. 31 |
| Clipping | Não citado como tal. Exige-se "registro fotográfico/videográfico das peças do plano de divulgação" | p. 37 |

**Lista do art. 42 da IN (medidas de ampliação de acesso, p. 20)**

1. Doar mais 10% dos produtos (total de 20% de gratuidade social ou educativa).
2. Oferecer transporte gratuito acessível.
3. Disponibilizar na internet registros audiovisuais com Libras e audiodescrição.
4. Garantir veiculação em TV pública ou outros meios gratuitos.
5. Realizar atividades paralelas gratuitas (ensaios abertos, cursos, oficinas etc.).
6. Realizar ação para crianças, adolescentes, jovens e educadores.
7. Realizar atividades em presídios, ILPIs, residências terapêuticas ou unidades de acolhimento da RAPS.
8. Firmar parceria para formação de agentes culturais.
9. Oferecer bolsas de formação para públicos prioritários.
10. Outras medidas sugeridas pelo proponente, apreciadas pela CNIC.

---

## 7. Prestação de contas

| Item | Conteúdo | Fonte |
|---|---|---|
| Parcial × final | O manual **não usa** o termo "prestação de contas parcial". A PC é "alimentada em tempo real" durante a execução (upload fiscal, aprovação de marcas, pedidos de alteração), e a PC final é concluída em até 60 dias após o fim da execução, improrrogável | p. 34, 36 |
| Consequência do atraso | A não apresentação no prazo deixa o proponente **inabilitado**, "travando todos seus projetos" | p. 36 |
| Conteúdo | Relatório final (lista da seção 6). Conforme o porte: **Relatório de Execução do Objeto** e **Relatório de Execução Financeira** | p. 36–37 |
| Simplificação por faixa | Ver a tabela de portes logo abaixo | p. 36 |
| Formulários e anexos | Só os nomes citados na seção 10. Formulários específicos de PC: **não consta** | — |
| Conciliação bancária | **Não consta** | — |
| Devolução de saldo e rendimentos | **Não consta** como regra de encerramento. Há regras próximas: (a) recursos de projeto indeferido vão para outro projeto do mesmo proponente ou para o FNC (p. 26); (b) após reprovação, devolução **com correção monetária e juros** em 20 dias (p. 40); (c) depósito ao FNC de recursos irregularmente gastos reverte a inadimplência (p. 41); (d) vantagem indevida obriga proponente **e** patrocinador a devolver o IR corrigido com juros (p. 31). **GRU: não consta** | p. 26, 31, 40, 41 |
| Guarda de documentos | 5 anos, contados após 6 meses da entrega da PC | p. 33 |

**Formato da análise por faixa de valor (p. 36)**

| Faixa | Formato da análise |
|---|---|
| Pequeno porte, **até R$ 200.000** | A análise "poderá ocorrer no formato **in loco**", **dispensada a avaliação financeira** |
| Pequeno porte, **até R$ 750.000**, e médio porte, **R$ 750.001 a R$ 5.000.000** | Relatório de execução do objeto + **apenas as inconformidades** apontadas no **Relatório de Execução Financeira**. **Vedado** o in loco [?: a faixa de R$ 200.001 a R$ 750.000 parece ser a que cai aqui; o texto sobrepõe "até 200 mil" e "até 750 mil"] |
| Grande porte, **acima de R$ 5.000.000** | Relatório de execução do objeto **e** relatório de execução financeira completos, além de **monitoramento específico** |

O manual não diz se a faixa considera o valor aprovado, homologado ou captado [?].

---

## 8. Análise e resultado

**Quem analisa e como**

- **SGPTC** analisa o objeto e depois a parte financeira, e emite o **Laudo Final de Avaliação** (p. 38).
- O MinC acompanha a execução por trilhas de controle, pelos documentos no Salic e por **vistorias in loco** (p. 33).
- **Trilhas de controle (p. 33):**
  - regularidade de proponentes e sócios;
  - CNAE dos fornecedores;
  - princípio da não concentração;
  - itens concentrados por fornecedor;
  - notas fiscais eletrônicas;
  - beneficiários de ingressos gratuitos;
  - incentivadores inativos;
  - regularidade de captadores.

**Diligências**

| Situação | Prazo | Se não regularizar | Fonte |
|---|---|---|---|
| Não comprovação da execução no Salic | 20 dias | inadimplência | p. 34 |
| Denúncias, indícios de irregularidade ou de vantagem indevida | 10 dias | suspensão do projeto, devolução, sanções penais, suspensão dos demais projetos | p. 35 |
| Relatório final não entregue | 20 dias | reprovação | p. 37 |

Os prazos da análise da PC pelo MinC **não constam**. [WEB] Fontes dizem que a IN fixa prazos máximos de análise.

**Resultados (p. 39)**

- **Aprovação:**
  - execução integral;
  - execução ampliada;
  - execução parcial proporcional à captação;
  - inadequações financeiras apontadas pelo Salic no monitoramento já sanadas;
  - ocorrências de diligência sanadas.
- **Aprovação com ressalva:**
  - inadequações financeiras **sem dolo**;
  - alteração do projeto sem anuência do MinC, sem descaracterizar o objeto;
  - descumprimento do Manual de uso de Marcas;
  - falta da autorização de uso de obras protegidas (direitos autorais e conexos);
  - alteração do Plano de Distribuição que cumpre a democratização e o objeto;
  - alteração do conteúdo do produto principal que alcança a ação projetada, sem desvio de finalidade;
  - alteração do plano de distribuição sem impacto na democratização;
  - despesas fora do prazo de execução, se o fato gerador ocorreu no prazo ou a natureza da despesa justifica pagamento posterior;
  - **medidas de acessibilidade não comprovadas**.
- **Reprovação:**
  - não prestar contas;
  - descumprir o objeto;
  - dano ao erário;
  - vantagem indevida (p. 31).

**Consequências da reprovação (p. 40–41)**

- Devolução com correção monetária e juros (20 dias); proposta de **ação compensatória** (30 dias [?]).
- **Recurso ao Ministro** (30 dias [?]). Se mantida a reprovação:
  - inscrição no **CADIN** e no **SIAFI**;
  - **Tomada de Contas Especial no TCU**;
  - comunicação à **Receita Federal**;
  - inscrição na **Dívida Ativa da União**.

**Inadimplência impede (p. 40)**

- prorrogação dos prazos de captação e execução do projeto em que foi constatada;
- andamento de pedidos de alteração ou readequação desse projeto;
- apresentação de novas propostas;
- publicação de portaria de captação para novos projetos.

**Reprovação ou inabilitação, efeitos (p. 40–41)**

- impossibilidade de apresentar novas propostas;
- impossibilidade de prorrogar captação;
- cancelamento das propostas em análise;
- arquivamento de projetos sem movimentação de conta livre;
- suspensão dos projetos ativos e bloqueio de contas;
- impedimento de novas captações;
- **duração de 3 anos**.

**Inabilitação cautelar (p. 41)**

Pode ser aplicada em qualquer fase, diante de indícios de irregularidade. Efeitos:

- bloqueio de contas;
- impedimento de captação e de prorrogações;
- suspensão de alterações;
- impedimento de novas propostas;
- suspensão de portarias de novos projetos.

**Vantagem indevida (p. 31)**

- Reprovação.
- Proponente **e** patrocinador devolvem o IR corrigido com juros, mais eventual responsabilidade criminal (Lei 8.313/91, art. 30).

**Recursos administrativos**

- Enquadramento: 10 dias, pela Lei 9.784/99 (p. 25).
- Reprovação ou corte na CNIC: "Art. 50 § 1º" e depois recurso ao Ministro (p. 26).
- PC reprovada: recurso ao Ministro (p. 40).

---

## 9. Regras especiais

| Tema | Regra | Fonte |
|---|---|---|
| Alterações de projeto | Pelo Salic: orçamento, nome, local, plano de distribuição. Remanejamento livre se total, custos vinculados e captação ficarem intactos. Na adequação, não se altera objeto, enquadramento nem gratuidade. Alteração sem anuência que não descaracteriza o objeto gera ressalva. [WEB] Não é mais permitido trocar o proponente | p. 12, 26, 34, 39 |
| Prorrogação de captação | Até 36 meses no total, concedida automaticamente e sinalizada no cadastro. O limite não se aplica a: caso fortuito ou força maior; recuperação de patrimônio histórico ou construção de imóveis; apresentação de contrato de patrocínio ou documento de seleção pública. A inadimplência impede a prorrogação | p. 27, 40 |
| Prorrogação de execução | Regra geral **não consta**. Plano anual/plurianual: exige pedido de alteração de nome, cronograma e tipologia. Inadimplência e inabilitação impedem | p. 12, 40–41 |
| Transferência de recursos entre projetos | Recurso depositado em projeto indeferido pode ir para outro projeto do mesmo proponente ou para o FNC. [WEB] A transferência é única e só nos casos de não aprovação, não atingimento da captação mínima ou não execução | p. 26 |
| Cancelamento e arquivamento | Proposta indeferida é arquivada (cabe pedido de desarquivamento). Propostas não selecionadas em chamamento são arquivadas definitivamente. A inabilitação cancela propostas em análise e arquiva projetos sem movimentação de conta livre | p. 22, 25, 40 |
| Fracionamento | Vedados dois ou mais projetos com objetivos iguais ou semelhantes, do mesmo proponente ou de proponentes diversos, mesmo em locais diferentes. Vedado também objeto e cronograma similares a proposta ou projeto ativo do mesmo proponente | p. 24 |
| Vedações de objeto | Construção de portais, estátuas ou réplicas em logradouros públicos; bolsas de graduação ou pós-graduação; proselitismo religioso ou cultos; difusão da imagem de agente político; órgãos da administração direta (Decreto 11.453/23, art. 53) | p. 24 |
| Plano anual/plurianual | Só para instituições sem fins lucrativos; prazo até 31/08. Objeto: manutenção de instituições; espaços culturais (programação, plano museológico, educação musical, comunicação, móveis, equipamentos, reforma ou construção, acessibilidade); corpos estáveis; eventos (festivais, bienais, feiras, festas) com uma só edição. Pode haver vários planos do mesmo proponente para equipamentos diferentes, com equipe técnica e orçamentos distintos. Teto pela série histórica de 3 exercícios. Não define o enquadramento (exceto museus) | p. 9, 12, 27 |
| Ações continuadas e nova edição | A homologação da nova edição depende do envio da PC da edição anterior | p. 9, 11 |
| Enquadramento | Art. 18 ou 26, conforme o produto principal. Capacitação e treinamento podem ir no art. 18 (100% de incentivo). Plano anual (exceto museus) e Festival/Bienal/Festa/Feira (só estrutura) não definem o enquadramento: vale o produto secundário de maior valor | p. 9 |
| Experiência do proponente | Portfólio na aba do Salic e cartão CNPJ com CNAE cultural. Sem atuação comprovada no primeiro projeto: teto de R$ 200 mil | p. 11 |
| Chamamento público | Prioridade no Salic; análise técnica só das propostas selecionadas; não remunera captação; não selecionadas são arquivadas definitivamente | p. 22 |
| Não é vantagem indevida | Ações extras do patrocinador pagas com recurso não incentivado; fornecimento pelo patrocinador com economicidade e exclusividade; acesso a ensaios e visitas; venda promocional de produtos no evento; sessão vendida além do plano de distribuição; convidados até 10% da lotação | p. 31 |
| Projetos em andamento | A IN 29 se aplica a eles, respeitados os direitos adquiridos | p. 43 |

---

## 10. Modelos, anexos e documentos citados (nome exato)

| Nome citado | Finalidade | Fonte |
|---|---|---|
| "Anexo II da IN" | Lista dos documentos essenciais à análise e aprovação do projeto. O conteúdo **não consta** no manual | p. 11 |
| "Plano de Distribuição" | Declara os percentuais de democratização (gratuidade, preço popular, preço médio) | p. 19, 34, 39 |
| "Plano Anual ou Plurianual de Atividades" | Tipo de projeto para instituições sem fins lucrativos | p. 12 |
| "Manual de uso de Marcas do PRONAC" (link gov.br `26_LeiRouanetManualatualizadoJAN2026.pdf`) | Aplicação das logomarcas | p. 29, 39 |
| "Manual de Identidade Visual da SEFIC" | Regras de visibilidade das marcas | p. 29 |
| "Guia de Acessibilidade do Ministério dos Direitos Humanos e da Cidadania" | Uso obrigatório na implementação de medidas de acessibilidade | p. 30 |
| "Relatório final" | Comprovação do objeto (lista da seção 6) | p. 37–38 |
| "Relatório de execução do objeto" | Componente da análise da PC | p. 36 |
| "Relatório de Execução Financeira" | Componente financeiro. Em médio e pequeno porte (acima de R$ 200 mil [?]), só as inconformidades apontadas | p. 36 |
| "Laudo Final de Avaliação" | Resultado da análise da SGPTC | p. 38 |
| Declaração assinada de distribuição gratuita, ou recibo | Comprova a gratuidade, para PF ou instituição | p. 19 |
| "Portaria de Aprovação para Captação de Recursos" | Autoriza a captação | p. 25–26, 40 |
| "Parecer Técnico" e "Parecer de aprovação de execução" | Análise técnica e homologação | p. 26 |
| Portfólio (aba específica do Salic) e Cartão CNPJ com CNAE cultural | Comprovação de experiência | p. 11 |
| Contrato ou termo de compromisso de patrocínio | Gatilho de admissão ou exceção; permite superar tetos do audiovisual (≥ 50%) | p. 14, 26, 27 |
| Comprovante de fornecimento de Vale-Cultura | Exigido em projetos de custeio de atividades permanentes | p. 37 |

---

## 11. Checagens automatizáveis (derivadas SOMENTE do documento)

### Cadastro e proposta

1. **Janela de envio:** bloquear ou alertar fora de **01/02–31/10**. Para plano anual/plurianual, após **31/08** (p. 11–12).
2. **Carteira por proponente:**

   | Tipo | Projetos ativos | Valor total ativo | Por projeto |
   |---|---|---|---|
   | PF | ≤ 2 | ≤ R$ 500 mil | ≤ R$ 500 mil |
   | MEI | ≤ 4 | ≤ R$ 1,5 mi | ≤ R$ 1,5 mi |
   | Demais PJ | ≤ 10 | ≤ R$ 15 mi | ≤ R$ 1,5 mi |

   Agregar a carteira por grupo econômico (sócios ou dirigentes em comum), aplicando o limite da PJ de maior capacidade. Isentar tipos de exceção: plano anual, patrimônio, museus, equipamentos (p. 7, 9, 11).
3. **Teto por tipologia:** R$ 6 mi ou R$ 15 mi conforme a lista da p. 8.
4. **Primeiro projeto sem experiência comprovada:** valor ≤ **R$ 200.000** (p. 11).
5. **Custo per capita:** valor solicitado ÷ beneficiários do produto principal ≤ **R$ 300**, quando há bilheteria ou venda (p. 10, 24).
6. **Nova edição ou ação continuada:** bloquear a homologação se a PC da edição anterior não foi enviada (p. 9, 11).
7. **Fracionamento:** alertar sobre projetos do mesmo proponente (ou do grupo) com objeto e cronograma semelhantes a projeto ativo (p. 24).

### Orçamento

8. **Custos administrativos** ≤ **15%** e **acessibilidade/comunicação/divulgação** ≤ **20%**. A base não é definida no manual [?]: tratar como configurável (p. 13, 16–17).
9. **Remuneração de captação** ≤ **10%** e ≤ **R$ 150.000** [?] (p. 13).
10. **Captação = 0** quando o projeto vem de edital ou chamamento com patrocínio exclusivo, ou quando o proponente é instituição criada pelo patrocinador (p. 18, 22).
11. **Cachê por apresentação:**

    | Categoria | Teto |
    |---|---|
    | Artista individual | ≤ R$ 25 mil |
    | Grupo | ≤ R$ 50 mil |
    | Orquestra | ≤ R$ 5 mil por músico e ≤ R$ 25 mil para o regente |
    | Palestrante | ≤ R$ 5 mil |

    Acima disso, marcar "requer aprovação da CNIC" (p. 14).
12. **Direitos autorais** ≤ **10%** e **direitos de exibição audiovisual** ≤ **20%** do valor homologado para execução (p. 14).
13. **Tetos de produtos audiovisuais** (tabela 4.4). Com vários produtos, vale a soma. Exceção quando há ≥ 50% garantido por edital ou contrato (p. 14).
14. **Remanejamento:** permitir sem pedido se o valor total, a soma dos custos vinculados e a captação ficarem iguais. Caso contrário, gerar solicitação de alteração no Salic (p. 12, 34).
15. **Despesas vedadas:** classificador e alerta para taxa de administração; pagamento a agente público; consultoria ou seleção para o patrocinador; despesa sem vínculo com o objeto (p. 18).

### Execução e financeiro

16. **Liberação da conta movimento:** só com captado ≥ **20%** do valor do projeto (p. 26).
17. **Gatilho de análise técnica:** captado ≥ **10%** ou contrato de patrocínio. Exceções: plano anual, edital ou chamamento, contrato ≥ 20% sem condicionantes (p. 26–27).
18. **Prazo de captação:** alertas até o limite de **36 meses** (p. 27).
19. **Concentração por fornecedor:** soma paga a um mesmo CPF/CNPJ ≤ **20% do valor captado**. Permitir marcar as categorias de exceção (p. 15). Isso espelha as trilhas "princípio da não concentração" e "itens concentrados por fornecedores" (p. 33).
20. **Remuneração do proponente e partes relacionadas:** soma paga ao proponente, cônjuge, companheiro, coligadas e empresas com sócios em comum ≤ **20% do captado** (≤ **30%** se PF ou MEI). Exceção para grupos e corpos estáveis (p. 15). Exige cadastro de partes relacionadas.
21. **Proporcionalidade:** gasto realizado em administrativo e em divulgação/acessibilidade ≤ teto % × valor **captado**, não aprovado (p. 17).
22. **CNAE do fornecedor** compatível com o item (trilha do MinC, p. 33). [?] O manual não diz qual é o critério de compatibilidade.
23. **Documento fiscal anexado** a cada despesa, de preferência NF eletrônica (p. 33–34). [Campos obrigatórios da NF: não constam.]
24. **Data da despesa** fora da vigência de execução: alertar "possível ressalva" e pedir justificativa do fato gerador (p. 39).
25. **Marcas:** impedir o status "peça publicada" sem leiaute aprovado pelo MinC. Checklist com Lei de Incentivo, MinC, Governo Federal e Vale-Cultura (se atividade permanente). Registrar a visibilidade igual à do patrocinador majoritário (p. 29, 34).

### Objeto e democratização

26. **Plano de distribuição:**

    | Faixa | Regra |
    |---|---|
    | Gratuidade social ou educativa | ≥ **10%** (≥ 20% se escolhida a medida "doar mais 10%") |
    | Cortesias de patrocinadores | ≤ **10%** no total |
    | Cortesias do proponente | ≤ **10%** |
    | Preço até R$ 50 | ≥ **20%** dos ingressos ou produtos |
    | Preço médio | faixa de **50%** com preço médio de **R$ 250** [?] |

    Validar na proposta e no realizado (p. 19–20).
27. **Declarações de gratuidade:** completude dos campos. PF: nome, CPF, nome do projeto, PRONAC, prova de caráter social ou educativo. Instituição: nome, CNPJ, representante, PRONAC, quantidade, compromisso (p. 19). Espelha a trilha "beneficiários de ingressos gratuitos" (p. 33).
28. **Convidados** ≤ **10% da lotação total** das apresentações. **Patrocinador** recebe ≤ **10% do produto final** (p. 31).
29. **Ação formativa:** público ≥ 10% do público do produto principal, limitado ao intervalo [20, 500], gratuita, para estudantes e professores da rede pública. Dispensada em projeto gratuito (p. 21).
30. **Pelo menos 1 medida de ampliação de acesso** do art. 42 marcada (p. 20).
31. **Acessibilidade:** os três aspectos (arquitetônico, comunicacional, divulgação) preenchidos ou justificados. A falta de comprovação gera ressalva (p. 30, 39).

### Prestação de contas e conformidade

32. **Prazo da PC final:** fim da execução + **60 dias**, improrrogável, com contagem regressiva e alertas. Se vencer: status "inabilitado" e bloqueio de todos os projetos do proponente (p. 36).
33. **Checklist do relatório final:** as 8 evidências da p. 37, cada uma com upload obrigatório.
34. **Trilha de análise por porte:** ≤ R$ 200 mil (in loco possível, sem análise financeira); ≤ R$ 5 mi (objeto + inconformidades financeiras); > R$ 5 mi (objeto + financeiro completo + monitoramento) (p. 36).
35. **Diligências:** relógios de **20 dias** (comprovação de execução; relatório final) e **10 dias** (denúncia ou indício) a partir da notificação (p. 34, 35, 37).
36. **Pós-reprovação:** relógios de **20 dias** (devolução atualizada) e **30 dias** (recurso ao Ministro ou ação compensatória) [?] (p. 40).
37. **Inabilitação de 3 anos:** guardar a data de início e de fim e bloquear novas propostas, prorrogações e alterações enquanto durar (p. 40–41).
38. **Retenção documental:** impedir exclusão de documentos até entrega da PC + 6 meses + 5 anos (p. 33).
39. **Classificação prévia do resultado:**
    - "provável ressalva": despesa fora do prazo, plano de distribuição alterado sem anuência, marca fora do manual, falta de autorização de direitos autorais, acessibilidade não comprovada;
    - "risco de reprovação": PC não enviada, objeto não cumprido (p. 39).
