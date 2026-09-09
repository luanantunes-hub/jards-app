# Listas CRM — padrão-ouro Jards

Referência de produto: lista de Negociações.

## Estrutura obrigatória

1. Cabeçalho com eyebrow, título de 28 px, descrição curta e resumo quantitativo.
2. Ações e seletor de visualização alinhados à direita no desktop e abaixo do título em telas menores.
3. Barra de controles independente, com filtros à esquerda e busca de 300 px à direita.
4. Conteúdo com 32 px de margem no desktop e 16 px no mobile.
5. Tabela dentro de superfície branca, borda neutra e roundness de 4 px.
6. Cabeçalho da tabela em `#F9F9F8`, labels pequenas e números tabulares.
7. Hover de linha discreto, ação principal pelo clique na linha e ações destrutivas apenas no hover.

## Primitivos

- `ListPageHeader`: contexto, título, descrição, resumo e ações.
- `ListSummary`: indicador compacto; substitui cartões de métricas quando a informação não precisa de análise própria.
- `ListToolbar`: filtros e busca em uma barra responsiva.
- `ListSearch`: busca com altura e foco padronizados.
- `ListContent`: área rolável com espaçamento responsivo.
- `ListTableSurface`: superfície comum das tabelas.
- `PrimaryListAction`: ação de criação branca, com borda e hover cinza.

## Variações permitidas

- Negociações e Inscrições podem exibir seletor Lista/Kanban/Potencial.
- Clientes podem exibir alertas de renovação e inatividade.
- Contatos podem exibir ordenação por score e origem.
- Proponentes podem filtrar por natureza jurídica.
- Projetos podem omitir a barra de filtros enquanto não houver busca ou segmentação útil.

As variações mudam o conteúdo dos controles, não sua posição, altura ou comportamento visual.
