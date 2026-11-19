# Jards — sistema visual e componentes

## Direção

A interface combina precisão tecnológica com proximidade humana. Deve parecer confiável, clara e amigável sem se tornar infantil ou excessivamente decorativa.

Princípios:

- hierarquia antes de ornamentação;
- uma ação principal evidente por contexto;
- dados densos com espaço e leitura confortável;
- movimento suave como metáfora de continuidade e relacionamento;
- feedback direto, sem linguagem técnica desnecessária;
- consistência entre desktop e celular.

## Identidade

| Token | Cor | Uso |
|---|---|---|
| Tinta (grafite quente) | `#282525` | texto; preenchimento escuro só fora do app (landing, páginas públicas, autenticação) |
| Roxo Jards | `#684DB0` / `#7259B5` | navegação, seleção e identidade |
| Roxo noite | `#1C0E33` | hero da landing e todo preenchimento escuro dentro do app: botões, item ativo, dicas, selos (hover `#2D1A53`) |
| Coral Jards | `#D94A4A` | marca, atenção e prioridade alta |
| Verde | `#2E8932` | salvar, confirmar e sucesso |
| Azul | `#2D72B0` | informação e estados auxiliares |
| Âmbar | `#B07A14` | atenção moderada e prioridade média |
| Teal | `#1A8B7A` | relacionamento e sinais positivos |

- o texto do Jards é o grafite quente `#282525`. Dentro do app (a parte logada, incluindo o admin), todo preenchimento escuro é o roxo noite `#1C0E33`, com hover `#2D1A53`: botões, item ativo do menu, abas e chips selecionados, interruptor ligado, dicas, selos de contagem e avatares. Na landing, nas páginas públicas, na autenticação e na tela de palco, o preenchimento escuro segue em grafite. Gráficos ficam em grafite (roxo não é cor de dado). Não usar `#000`, `#0D0D0D`, `#171717` nem `#1a1a1a` sólidos. Cinzas e bordas continuam em preto com baixa opacidade;
- fundos são brancos ou neutros levemente tingidos;
- **nunca tom sobre tom**: texto ou ícone colorido não fica sobre fundo claro da mesma cor (roxo sobre lilás, verde sobre verde-claro). A cor fica no texto, no ícone ou numa borda fina, sobre branco ou cinza neutro (`bg-black/[.04]`); quando precisa de peso, usa preenchimento sólido com texto branco;
- passar o mouse, item selecionado, dia de hoje e linha arrastada usam cinza neutro, nunca a cor da marca diluída;
- avisos de erro, alerta e sucesso: fundo branco, borda fina na cor e texto na cor;
- bordas usam preto com baixa opacidade;
- sombras devem ser discretas e comunicar elevação real;
- cartões não recebem cor ou sombra sem função hierárquica.

## Tipografia

- títulos e display: Valley Sans, com Google Sans como fallback;
- interface e corpo: Google Sans;
- títulos grandes usam tracking negativo e `text-wrap: balance`;
- corpo usa peso 400 ou 500;
- controles e filtros não ficam em negrito por padrão;
- tabelas usam cabeçalhos de `0.625rem` (10px na base), peso 500, caixa alta e tracking `.08em`;
- números financeiros devem usar algarismos tabulares quando comparados em coluna.

## Números e indicadores

- rótulo neutro: `0.625rem`, peso 500, caixa alta, tracking `.08em`, `text-black/45`; nunca colorido nem em negrito;
- valor em tinta (`#282525`), semibold, algarismos tabulares; valor zerado fica apagado (`text-black/30`);
- cor só no gráfico (barra, segmento), nunca no rótulo nem no valor. Sem pontos ou quadrados coloridos como marcador: quando o rótulo precisa de apoio visual, usa ícone cinza (`text-black/40`, 12px); só um estado de alerta (em risco, expirado, atrasado) pode colorir o ícone;
- captação: verde folha (`#3DA86A`, o mesmo dos medidores de meio círculo e do gráfico de Atividades) é confirmado, folha a 35% é em negociação, cinza é o que falta. O verde `#2E8932` fica para salvar e confirmar ações, não para dados. Roxo é navegação, não é cor de dado;
- exceção: um desfecho escrito em palavra ("Meta atingida") pode levar a cor no texto;
- valores de resumo, totais, kanban e cartões usam `formatarValorCurto` (`R$ 400.000`, `R$ 1,5 mi`, `R$ 13 bi`), com `formatarValorCompleto` no `title`; campos, propostas, exportações e prestação de contas mostram o valor exato;
- componentes: `Indicador` e `BarraCaptacao` em `components/ui/IndicadoresFinanceiros.tsx`.

## Forma e espaçamento

- raio padrão do produto: `rounded` (4px);
- raios maiores ficam restritos a experiências de marca, autenticação e ilustrações;
- alturas usuais de controle: 36–44px;
- áreas clicáveis devem ter pelo menos 40px quando isoladas;
- separação entre seções usa espaço, regra fina ou mudança sutil de superfície;
- páginas de detalhe usam container máximo `max-w-pagina` (utilidade em `globals.css`): 80rem (1280px na base), abrindo para 96rem em telas a partir de 2400px de largura e 120rem a partir de 3200px (só a largura conta, para os ultrawides);
- listas com `ManagedTable` marcam a coluna principal com `grow: true`, para a tabela ocupar a largura que sobra em telas largas;
- medidas que acompanham a tela ficam em `rem` (`text-[0.75rem]`, `w-[17.5rem]`, `max-w-[80rem]`); `px` só para bordas, raios, sombras, desfoques e traços abaixo de 4px.

## Botões

### Ação principal de página

Criar ou iniciar o objeto principal da página ("Novo projeto", "Nova data") usa `PrimaryListAction`, de `components/list/ListPagePrimitives.tsx`: roxo noite `#1C0E33`, o mesmo do hero da landing, com texto branco e `h-9`.

- volume discreto: degradê de cima para baixo em torno do roxo noite (`#28164B` → `#1C0E33` → `#160A2A`), uma linha de luz de 1px no topo, uma de sombra na base e uma sombra curta tingida de roxo noite, que descola o botão da página. Sem borda;
- o brilho violeta não fica no botão. Quando o clique abre uma folha que desce do topo, uma luz passa uma vez pela borda de cima dela, da esquerda para a direita, e some: começa aos 160ms, junto com o fim da descida, e usa a mesma curva da folha. É uma faixa fixa no topo da tela, na largura da folha, montada pelo `PrimaryListAction` (`.brilho-da-folha` em `app/globals.css`, escolha da folha em `lib/brilho-da-folha.ts`). Folha que sobe de baixo, modal no meio da tela ou clique que não abre folha: sem brilho. Não aparece com `prefers-reduced-motion`;
- o botão fica parado: sem animação ao carregar a página e sem movimento no hover, que só clareia um tom, na hora. Ao pressionar, afunda (sombra por dentro);
- sem contorno em volta. O foco do teclado clareia como o hover e abre um brilho embaixo do botão; o contorno só aparece no modo de alto contraste do sistema;
- uma ação principal por contexto. Quando há duas lado a lado, a principal é roxo noite e a outra é `SecondaryListAction`: botão branco com borda leve e hover cinza;
- os outros botões escuros do app (modais, assistentes, páginas de detalhe) são roxo noite liso:

```tsx
className="rounded bg-[#1C0E33] px-4 py-2.5 text-white hover:bg-[#2D1A53]"
```

- na autenticação e nos links públicos, a ação principal segue em tinta: `bg-[#282525]` com hover `bg-[#3A3535]`.

### Salvar ou confirmar

Use verde em rodapés de modal, sheets e operações que persistem dados:

```tsx
className="rounded bg-[#2E8932] px-4 py-2.5 text-white hover:bg-[#26752A]"
```

### Seleção e navegação

Roxo indica aba ativa, seleção, foco de navegação ou ação contextual — não deve competir com o botão de salvar.

### Secundário

Texto puro ou botão branco com borda leve. Cancelar normalmente é texto sem borda.

### Destrutivo

Vermelho, separado visualmente da confirmação. Exclusões materiais usam o diálogo global de confirmação.

Todos os botões precisam de estado `hover`, `focus-visible`, `disabled` e feedback de pressionamento quando apropriado.

## Dropdowns

**Não usar `<select>` nativo diretamente nas páginas.**

| Contexto | Componente |
|---|---|
| formulário ou modal simples | `Dropdown` |
| toolbar compacta | `Select` |
| ícone, busca, conteúdo rico ou portal | `CustomDropdown` |
| várias opções de uma lista longa, com busca | `MultiSelectDropdown` |
| prioridade | `PrioridadeSelect` |

Regras:

- o valor selecionado usa peso normal, salvo quando a hierarquia exigir ênfase;
- o menu deve usar portal ou posicionamento fixo quando estiver dentro de modal/sheet;
- o menu escolhe automaticamente abrir acima quando não há espaço inferior;
- Escape fecha o menu e o foco precisa permanecer visível;
- labels, ícones e cores semânticas devem ser consistentes entre gatilho e opções.

## Tabelas e listas

O padrão completo está em `docs/LISTAS_PADRAO_OURO.md`.

- busca e filtros ficam acima do conteúdo;
- lista e kanban compartilham a mesma fonte de dados;
- ordenação deve mostrar direção;
- colunas configuráveis usam `ColumnManager`;
- estados vazios explicam a próxima ação;
- carregamento usa skeleton compatível com a forma final;
- tabelas largas podem rolar horizontalmente sem cortar ações essenciais.

## Etiquetas e estados

Etiquetas informativas e não editáveis usam borda leve, fundo neutro e cor semântica:

```tsx
<span
  className="rounded border bg-white px-2 py-1 text-[0.625rem] font-medium"
  style={{ borderColor: color + "47", color }}
>
  {label}
</span>
```

Exceções:

- status concluído em contexto temporal pode aparecer como label em caixa alta sem borda;
- status editável usa `StatusDropdown` ou `StatusBadge` interativo;
- prioridade alta usa ícone e texto vermelhos;
- a identidade visual (ícone de projeto, proponente e captador) é escolhida no `IconePicker`, sem bordas: ícones em cinza; clicar num ícone abre, grudado nele, o mesmo ícone nas cinco cores, e a escolha é feita ali.

## Modais, sheets e menus

- cabeçalho fixo com título e fechamento;
- conteúdo pode rolar, mas o rodapé de ações permanece visível;
- botão de salvar fica à direita e usa verde;
- menus internos não podem ser cortados pelo overflow do painel;
- formulários extensos são agrupados por assunto, não por decoração;
- erros aparecem junto ao formulário, nunca em `window.alert()`.

## Formulários de cadastro

Referência: `NovaCaptacaoModal`, `NovaInscricaoModal` e `NovaAtividadeModal`.

- o essencial vem primeiro, numa lista direta, sem título de seção;
- campos opcionais ficam em "Mais detalhes", recolhido; ele já abre quando há algo preenchido lá dentro;
- o formulário é o mesmo para todo mundo: sem botão para esconder ou personalizar blocos;
- registros ligados (empresa, projeto, agência) são criados digitando o nome e escolhendo `Criar "Nome"` no menu; nada é criado ao clicar num botão com o campo vazio;
- o cadastro não oferece etapas de desfecho (aprovado, recusado, reprovado, cancelado); desfecho tem fluxo próprio (`lib/etapas.ts`) e a coluna de desfecho do kanban não tem "+";
- ganhar uma negociação é sempre "Fechar negócio" (`FecharNegocioSheet`), venha do topo, do menu de status ou do kanban;
- responsável e supervisor só aparecem quando a organização tem equipe; o responsável já vem preenchido com quem está criando;
- todo campo exibido é salvo;
- o botão principal diz o que acontece: "Criar negociação" no cadastro, "Salvar" na edição.

## Páginas de detalhe

Use os primitivos de `components/ui/DetailPagePrimitives.tsx` para manter:

- cabeçalho com identidade e ações; a identidade alinha com o título, no topo;
- descrição e outros textos livres usam `TextoRecolhivel`: poucas linhas (3 no cabeçalho), "Ver mais" só quando o texto passa do limite, parágrafos preservados;
- barra de informações principais;
- abas coerentes;
- conteúdo com largura e espaçamento padronizados;
- cards laterais apenas quando resumem contexto útil.

## Identidade de entidades

- empresas usam `CompanyLogo` com fallback para inicial;
- projetos, proponentes e captadores usam `ProjectIdentity`: o ícone aparece solto, só o traço na cor, como no Notion — sem quadrado, degradê, volume ou sombra. Em linhas de tabela, `semFundo` só deixa o traço um pouco menor;
- cores de identidade: cinco, alegres e que conversam com o roxo do Jards — lavanda `#7C5CD6`, coral `#E8665A`, mel `#DFA024`, folha `#3DA86A` e céu `#3B8BE0` (`PROJECT_ICON_COLORS`). Cores gravadas da paleta antiga são mostradas pela mais parecida (`corDaIdentidade`), sem mudar o banco;
- as chaves dos ícones ficam gravadas no banco: nunca renomear, só acrescentar;
- exceção ao "nunca tom sobre tom": nas pastas de projeto, o verso leva o tom claro da cor do ícone e a folha da frente fica quase branca, com o ícone na cor e o texto em tinta
- projetos, proponentes e captadores podem escolher ícone, logo e cor;
- imagens precisam de texto alternativo útil;
- cores não podem ser o único meio de transmitir estado.

## Movimento e acessibilidade

- transições comuns: 160–240ms;
- animar `transform` e `opacity`, evitando propriedades de layout;
- respeitar `prefers-reduced-motion`;
- exceção deliberada: a folha aberta pelo botão de criar ganha uma luz que passa uma vez pela borda de cima e some, para ligar o clique à folha; não aparece com `prefers-reduced-motion`;
- movimento deve indicar conexão, continuidade ou mudança de estado;
- foco por teclado é obrigatório;
- ícones sem label visível precisam de `aria-label` ou `title`;
- contraste e tamanho de texto precisam permanecer legíveis em estados desabilitados.

## Responsividade

- começar pela leitura em uma coluna;
- telas grandes: a fonte base cresce a partir de 1800px de largura (106,25%; 112,5% com 2100×1000; 125% com 2400×1150; 137,5% com 3200×1700, medidas da janela) e tudo que está em `rem` cresce junto — por isso tamanhos novos não usam `px`. A exigência de altura mantém ultrawides no degrau da altura que eles têm;
- larguras em `style` usam string em rem (`maxWidth: "35rem"`), não número; ícones Lucide/Phosphor com `size` numérico já acompanham a escala por uma regra em `globals.css`;
- medidas que o JavaScript compara com `getBoundingClientRect` ou `window.innerHeight` (altura de menu para abrir acima, largura de popover, coordenadas de desenho) são multiplicadas por `escalaUi()` de `lib/escala-ui.ts`;
- toolbars podem quebrar linha sem perder o botão principal;
- abas horizontais podem rolar no celular;
- modais ocupam a altura disponível e preservam o rodapé;
- visualizações densas devem oferecer uma alternativa legível à tabela no celular.
