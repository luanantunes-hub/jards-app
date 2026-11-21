# Idiomas do Jards (módulo Ingressos primeiro)

Plano completo e decisões: ver o plano de tradução do dono (20/11/2026). Escopo atual: **só o módulo Ingressos (Ticketeria)**. O resto do Jards continua em português do Brasil e não usa nada disto.

## Os 10 idiomas

Ordem de prioridade do dono. O português do Brasil é a origem: todo texto nasce nele.

| Código | Idioma | Direção | Fonte |
|---|---|---|---|
| `en` | Inglês | → | Plus Jakarta Sans |
| `zh-Hans` | Chinês simplificado | → | Noto Sans SC |
| `es-419` | Espanhol da América Latina | → | Plus Jakarta Sans |
| `de` | Alemão | → | Plus Jakarta Sans |
| `ar` | Árabe | ← (RTL) | Noto Sans Arabic |
| `ja` | Japonês | → | Noto Sans JP |
| `ru` | Russo | → | Google Sans (cobre cirílico) |
| `id` | Indonésio | → | Plus Jakarta Sans |
| `pt-BR` | Português do Brasil (origem) | → | Plus Jakarta Sans |
| `fr` | Francês | → | Plus Jakarta Sans |

Código do idioma, nome e direção: `lib/i18n/idiomas.ts`. Fontes: `lib/i18n/fontes.ts` e `app/globals.css` (`.fonte-ticketeria:lang(...)`).

## Como o idioma é escolhido

- A pessoa escolhe no seletor (`components/i18n/SeletorDeIdioma.tsx`). A escolha vira o cookie `jards_idioma` (um ano, sem dado pessoal).
- Sem cookie, vale o português. A leitura do idioma do navegador existe e está testada, mas fica desligada (`NEGOCIAR_PELO_NAVEGADOR` em `lib/i18n/idiomas.ts`) até a compra inteira estar traduzida e o idioma ser gravado no pedido.
- Só as telas dentro de `ProvedorDeIdioma` leem o cookie. Hoje: `app/espera/layout.tsx` e `app/novidades/layout.tsx`. O resto do app não lê cookie por causa disto.

## Como pôr um texto novo (ou traduzir uma tela)

1. Escreva o texto em `messages/pt-BR/ticketeria.json` (ou outra área, ver `AREAS` em `lib/i18n/mensagens.ts`). Chaves em português, agrupadas por tela: `sair.espera.pergunta`.
2. Use no código: `useTranslations("ticketeria.sair")` (cliente) ou `getTranslations(...)` (servidor) e `t("espera.pergunta")`. Os tipos conferem a chave.
3. Crie a mesma chave nos outros 9 arquivos (`messages/<idioma>/ticketeria.json`), seguindo o glossário (`glossario-ticketeria.md`).
4. `npm test`: `tests/i18n-mensagens.test.ts` falha se faltar chave, se sobrar chave, se um marcador como `{loja}` mudar ou se a sintaxe estiver errada.
5. Tela pública nova: o layout dela usa `ProvedorDeIdioma` e o cabeçalho (`Moldura`) leva `seletorDeIdioma`.

Regras dos textos:

- **Nunca monte frase juntando pedaços.** A ordem das palavras muda de idioma para idioma. Use um texto só com marcadores: `"... de {loja}."`.
- **Quando o marcador pode faltar** (nome do organizador vazio), escreva duas versões do texto (`explicacao` e `explicacaoSemLoja`), como em `sair.novidades`. Preposição e artigo mudam com o nome.
- **Plural** usa o formato ICU: `{n, plural, one {# ingresso} other {# ingressos}}`. Russo e árabe têm mais formas (`few`, `many`, `two`, `zero`).
- **Valores, datas e números**: nunca escritos à mão no texto. A fatia 2 do plano traz o formatador único; até lá, não traduza telas com valores.
- Apóstrofo em francês: use `’` (curvo), nunca `'`, para não confundir o formato.

## Árabe e o espelhamento (RTL)

O `ProvedorDeIdioma` põe `dir="rtl"` quando o idioma é o árabe. O texto e o `flex` espelham sozinhos; o que o Tailwind escreve com esquerda/direita **não**. Nas telas traduzidas use sempre o neutro:

| Em vez de | Use |
|---|---|
| `ml-*`, `mr-*` | `ms-*`, `me-*` |
| `pl-*`, `pr-*` | `ps-*`, `pe-*` |
| `left-*`, `right-*` | `start-*`, `end-*` |
| `text-left`, `text-right` | `text-start`, `text-end` |
| `border-l`, `border-r` | `border-s`, `border-e` |
| `rounded-l`, `rounded-r` | `rounded-s`, `rounded-e` |
| ícone de seta | `rtl:-scale-x-100` |

Números, "R$", e-mails e nomes em letras latinas dentro de frase árabe: o navegador resolve a direção, mas confira na imagem. Um nome de organizador que vem de fora do texto pode ser isolado com `<bdi>`.

## Fontes

A Plus Jakarta Sans (Ticketeria) e a Google Sans cobrem latim e cirílico (a Jakarta só tem `cyrillic-ext`, por isso o russo cai na Google Sans). Chinês, japonês e árabe têm fonte própria, baixada do Google no build e servida pelo próprio Jards. Ela vem **antes** da Jakarta na lista (a fonte de reserva que o `next/font` cria para a Jakarta declara todos os caracteres e tomaria o lugar da fonte da escrita).

## O que não traduzir

- Siglas, leis e órgãos do Brasil que a pessoa vai ver no ingresso, na cobrança ou na lei: CPF, CNPJ, Pix, meia-entrada (explicar numa frase), ECAD, Rouanet. Ficam em português, com uma explicação curta quando a pessoa precisa entender.
- Nomes de marca: Jards, Ticketeria.
- O que o produtor escreve: nome do evento, descrição, local, nome da loja. A tela é traduzida; o conteúdo, não.
- Termos de Uso, Privacidade e Termos de compra: só com revisão de advogado (não fazem parte desta fatia).

## Tradução e revisão

Os textos novos entram traduzidos por IA, seguindo o glossário. Tudo o que o público vê (compra, pedido, ingresso, e-mails ao comprador) precisa de revisão de falante nativo antes de abrir o idioma em produção. Ainda não há essa revisão: `en`, `es-419` e os demais estão como rascunho.
