# Roadmap de módulos do dashboard de Captação

## Objetivo

Evoluir o dashboard de Captação como uma composição modular, configurável por usuário, sem transformar a página em um painel excessivamente longo. Cada módulo deve responder a uma pergunta operacional ou estratégica concreta.

O usuário poderá ativar, ocultar e reordenar os módulos por meio da opção **Personalizar painel**.

## Módulos atuais

- Indicadores principais
- Prioridades do dia
- Funil comercial
- Negociações em risco
- Atividades recentes
- Agenda comercial

## Próximos módulos prioritários

### 1. Meta versus realizado

**Pergunta respondida:** quanto falta captar no período?

- Meta mensal, trimestral ou anual
- Valor captado
- Pipeline ponderado
- Valor restante
- Progresso percentual

### 2. Desempenho por projeto

**Pergunta respondida:** quais projetos estão avançando e quais precisam de atenção?

- Meta de cada projeto
- Valor captado
- Valor em negociação
- Quantidade de patrocinadores
- Percentual de conclusão
- Link direto para o projeto

### 3. Previsões de fechamento

**Pergunta respondida:** o que deve fechar nas próximas semanas?

- Negociações previstas para o mês
- Valor esperado
- Previsões atrasadas
- Distribuição pelas próximas semanas

### 4. Propostas sem resposta

**Pergunta respondida:** quais propostas precisam de retomada?

- Empresa
- Projeto
- Valor solicitado
- Data de envio
- Dias aguardando retorno

### 5. Saúde dos dados

**Pergunta respondida:** quais registros estão incompletos ou comprometem a operação?

- Negociações sem contato
- Negociações sem responsável
- Sem previsão de fechamento
- Sem valor solicitado
- Empresas possivelmente duplicadas
- Projetos sem meta

### 6. Renovações

**Pergunta respondida:** quais patrocínios precisam ser renovados em breve?

- Patrocínios próximos da renovação
- Valor renovável
- Última interação
- Responsável
- Dias restantes

## Inteligência comercial

### Concentração do pipeline

- Participação das cinco maiores empresas
- Dependência por setor
- Dependência por captador
- Alertas de concentração excessiva

### Cobertura por setor

- Setores mais prospectados
- Setores com melhor conversão
- Setores ainda não explorados
- Valor captado por setor

### Janela de investimento

- Empresas em período favorável de investimento
- Editais abertos relacionados
- Histórico de investimento por trimestre
- Contatos recomendados para antecipação

### Origem das oportunidades

- Indicação
- Prospecção própria
- Edital
- Captador externo
- Contato da comunidade
- Conversão e valor por origem

### Velocidade do funil

- Tempo médio em cada etapa
- Negociações acima da média de permanência
- Etapa mais lenta
- Comparação com o trimestre anterior

## Equipe e operação

### Carga da equipe

- Negociações por responsável
- Follow-ups pendentes
- Valor sob gestão
- Distribuição desequilibrada de oportunidades

### Atividade comercial

- Contatos realizados
- Reuniões
- Propostas enviadas
- Follow-ups concluídos
- Comparação com o período anterior

### Supervisão

- Negociações sem supervisor
- Aprovações necessárias
- Alterações relevantes
- Riscos que exigem decisão

## Recursos avançados

### Próximas melhores ações

Recomendações inicialmente baseadas em regras explicáveis:

- Retomar contato
- Trocar ou adicionar contato principal
- Vincular um decisor
- Preparar proposta
- Antecipar renovação
- Atualizar previsão de fechamento

A inteligência artificial poderá enriquecer essas recomendações futuramente, mas cada sugestão deverá informar o motivo.

### Resumo semanal

- O que avançou
- O que foi aprovado
- O que entrou em risco
- Próximos prazos
- Mudança no pipeline ponderado

### Radar da comunidade

- Novos contatos sugeridos
- Experiências publicadas
- Editais avaliados
- Empresas com dados atualizados recentemente

## Sequência recomendada

1. Meta versus realizado
2. Previsões de fechamento
3. Propostas sem resposta
4. Saúde dos dados
5. Renovações
6. Desempenho por projeto
7. Velocidade do funil
8. Cobertura e concentração
9. Próximas melhores ações

## Princípios de produto e UX

- Módulos novos devem nascer desativados.
- O dashboard padrão deve permanecer enxuto.
- Cada módulo deve responder a uma pergunta clara.
- Métricas meramente decorativas devem ser evitadas.
- Estados vazios devem explicar como gerar os dados necessários.
- Alertas devem informar o motivo e oferecer uma ação direta.
- Módulos ocultos não devem executar consultas desnecessárias.
- A composição deve funcionar em uma coluna no celular.
- Ordenação e visibilidade devem ser persistidas por usuário e organização.
