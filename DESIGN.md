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
| Tinta | `#0D0D0D` | texto e ações principais |
| Roxo Jards | `#684DB0` / `#7259B5` | navegação, seleção e identidade |
| Coral Jards | `#D94A4A` | marca, atenção e prioridade alta |
| Verde | `#2E8932` | salvar, confirmar e sucesso |
| Azul | `#2D72B0` | informação e estados auxiliares |
| Âmbar | `#B07A14` | atenção moderada e prioridade média |
| Teal | `#1A8B7A` | relacionamento e sinais positivos |

- fundos são brancos ou neutros levemente tingidos;
- bordas usam preto com baixa opacidade;
- sombras devem ser discretas e comunicar elevação real;
- cartões não recebem cor ou sombra sem função hierárquica.

## Tipografia

- títulos e display: Valley Sans, com Google Sans como fallback;
- interface e corpo: Google Sans;
- títulos grandes usam tracking negativo e `text-wrap: balance`;
- corpo usa peso 400 ou 500;
- controles e filtros não ficam em negrito por padrão;
- tabelas usam cabeçalhos de 10px, peso 500, caixa alta e tracking `.08em`;
- números financeiros devem usar algarismos tabulares quando comparados em coluna.

## Forma e espaçamento

- raio padrão do produto: `rounded` (4px);
- raios maiores ficam restritos a experiências de marca, autenticação e ilustrações;
- alturas usuais de controle: 36–44px;
- áreas clicáveis devem ter pelo menos 40px quando isoladas;
- separação entre seções usa espaço, regra fina ou mudança sutil de superfície;
- páginas de dados usam container máximo próximo de 1280px.

## Botões

### Ação principal de página

Use preto para criar ou iniciar o objeto principal da página:

```tsx
className="rounded bg-[#0D0D0D] px-4 py-2.5 text-white"
```

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
  className="rounded border bg-white px-2 py-1 text-[10px] font-medium"
  style={{ borderColor: color + "47", color }}
>
  {label}
</span>
```

Exceções:

- status concluído em contexto temporal pode aparecer como label em caixa alta sem borda;
- status editável usa `StatusDropdown` ou `StatusBadge` interativo;
- prioridade alta usa ícone e texto vermelhos;
- controles de identidade visual usam quadrados totalmente preenchidos pela cor, não círculos internos.

## Modais, sheets e menus

- cabeçalho fixo com título e fechamento;
- conteúdo pode rolar, mas o rodapé de ações permanece visível;
- botão de salvar fica à direita e usa verde;
- menus internos não podem ser cortados pelo overflow do painel;
- formulários extensos são agrupados por assunto, não por decoração;
- erros aparecem junto ao formulário, nunca em `window.alert()`.

## Páginas de detalhe

Use os primitivos de `components/ui/DetailPagePrimitives.tsx` para manter:

- cabeçalho com identidade e ações;
- barra de informações principais;
- abas coerentes;
- conteúdo com largura e espaçamento padronizados;
- cards laterais apenas quando resumem contexto útil.

## Identidade de entidades

- empresas usam `CompanyLogo` com fallback para inicial;
- projetos usam `ProjectIdentity`;
- projetos, proponentes e captadores podem escolher ícone, logo e cor;
- imagens precisam de texto alternativo útil;
- cores não podem ser o único meio de transmitir estado.

## Movimento e acessibilidade

- transições comuns: 160–240ms;
- animar `transform` e `opacity`, evitando propriedades de layout;
- respeitar `prefers-reduced-motion`;
- movimento deve indicar conexão, continuidade ou mudança de estado;
- foco por teclado é obrigatório;
- ícones sem label visível precisam de `aria-label` ou `title`;
- contraste e tamanho de texto precisam permanecer legíveis em estados desabilitados.

## Responsividade

- começar pela leitura em uma coluna;
- toolbars podem quebrar linha sem perder o botão principal;
- abas horizontais podem rolar no celular;
- modais ocupam a altura disponível e preservam o rodapé;
- visualizações densas devem oferecer uma alternativa legível à tabela no celular.
