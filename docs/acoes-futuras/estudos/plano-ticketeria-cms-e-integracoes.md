# Ticketeria: o CMS próprio e as integrações com outros CMS

Pedido do dono (20/11/2026): "melhorar o CMS, hoje ele é muito simples; integrar com todos os CMS que têm integração e, além disso, criar o nosso próprio". Respostas dele às perguntas de escopo: o que mais pesa hoje é **tudo** (visual e layout, poder de edição, venda e conversão, vários eventos); a integração é por **plugins nativos por CMS**; o CMS próprio é um **construtor de sites completo**. Este documento é a proposta de caminho. **Nada foi construído**; cada fase com tela passa pelo ok do dono nas imagens, e cada migration, pelo "sim" dele.

## Onde estamos

O site da loja (`ticketeria_sites`, `ticketeria_site_paginas`, `ticketeria_site_dominios`; `lib/ticketeria/site.ts`, `EditorDoSite.tsx`) é um por loja, com páginas feitas de **7 blocos fixos** (título, texto, imagem, botão, programação, ingressos, contato), uma **cor** de tema, rascunho e publicado por página, SEO mínimo (descrição e imagem de compartilhamento) e **domínio próprio** com prova de DNS. É seguro (sem HTML livre, links só em https) e funciona, mas é pobre: sem tema de verdade, sem layout, sem pré-visualização, sem histórico, sem reordenar arrastando.

Dois fatos que pesam no desenho: **(1)** o site inteiro, inclusive a compra, é do Jards, e o pagamento no cartão abre a página segura do Asaas (que o Jards não controla); **(2)** o `next.config.ts` só deixa o Jards ser aberto dentro de outro site (iframe) nas rotas `/embed/...` (as demais mandam `X-Frame-Options: DENY`). Quem integra por iframe precisa de uma rota `/embed/` nova.

## A ideia central: uma base só para as integrações

Todo CMS de terceiros acaba usando uma de duas portas: **um pedaço de código embutido** (script ou iframe) ou **a API**. Fazer as duas uma vez serve a todos os CMS; o plugin de cada CMS é só uma casca que as chama. Por isso a ordem proposta começa por ela.

**Base de integração (I0):**
- **Chave pública por loja** (só identifica a loja; não dá poder de escrita) e **API pública de leitura**: eventos publicados, sessões, ingressos e lotes com preço e disponibilidade, o que está esgotado, a fila de espera. Resposta em JSON, com cache e limite por IP.
- **Widget de ingressos** (um script de 1 linha): mostra os eventos ou as sessões no estilo do site da pessoa (cor, fonte) e leva à compra. A compra abre numa **rota `/embed/` (iframe)** ou em **nova aba**; o cartão sempre abre a página segura do Asaas em nova aba.
- **Webhooks de saída** (venda paga, reembolso, ingresso lido, evento mudou) assinados, para quem integra com ERP, CRM, e-mail marketing ou Zapier e Make. Zapier e Make entram como conectores em cima da API e dos webhooks.
- **Segurança:** a chave pública não escreve nada; origens permitidas por loja; limite de chamadas; nenhum dado de comprador sai pela API pública; o webhook de saída vai assinado (HMAC) e com repetição segura.

## Integrações por CMS (I1 em diante)

O dono pediu **plugins nativos**. Cada um tem custo e prazo diferentes, e **alguns CMS não têm loja de plugins**: nesses, o caminho é o widget da base. A viabilidade de cada marketplace (regras, revisão, prazo) **precisa ser conferida na documentação oficial de cada um antes de prometer prazo**; a tabela é minha leitura do que conheço, a confirmar.

| CMS | Caminho | Observação |
|---|---|---|
| **WordPress** | Plugin no diretório oficial: bloco do editor (Gutenberg), shortcode e página de configuração (chave da loja) | Maior base de sites do mundo e o mais barato de fazer; revisão do diretório existe. Primeiro da fila |
| **Webflow** | App ou extensão com o widget; hoje o caminho simples é colar o código de incorporação | Marketplace próprio, com revisão |
| **Wix** | App para o Wix App Market (com elemento visual de ingressos); o simples é o elemento "incorporar" | Marketplace próprio, com revisão |
| **Shopify** | App com extensão de tema (bloco de ingressos); só faz sentido para quem vende ingresso junto com produtos | Revisão exigente; menor prioridade |
| **Squarespace, Carrd, Framer, Notion e outros** | **Só o widget** (bloco de código). Não há "plugin" que o Jards possa publicar de forma simples | Documentar o passo a passo de cada um, com imagens |

Cada plugin traz: escolher o evento ou "todos", cores e idioma, e **mostrar a disponibilidade em tempo real** (vem da API). A compra termina no Jards (nada de pagamento dentro do CMS do outro: o produtor continua recebendo pela subconta e o Jards continua com o razão).

## O construtor de sites próprio (C1 em diante)

A direção: manter o que é bom (blocos tipados, sem HTML livre, tudo validado no servidor) e crescer **por blocos, seções e temas**, e não por HTML solto. Isso preserva a segurança, a velocidade e a possibilidade de o Jards gerar a página de cada evento sozinho. Um editor com HTML e CSS livres só se discute depois, e abre riscos (XSS, quebrar a página de compra, suporte); fica **fora do começo**.

**C1. Base do construtor** (visual, layout, poder de edição)
- **Temas:** conjunto de temas (cores, fontes, cantos, estilo dos botões), troca em um clique e pré-visualização; hoje só há uma cor.
- **Seções e layout:** capa grande (imagem ou vídeo), colunas, faixa de destaque, galeria, vídeo, mapa do local, perguntas frequentes, patrocinadores e parceiros, depoimentos, contagem regressiva, lista de eventos da loja (agenda).
- **Editor:** arrastar para reordenar, duplicar bloco e página, **pré-visualização no celular e no computador**, desfazer e refazer, **histórico de versões** da página (voltar a uma publicada antes).
- **Mídia:** biblioteca de imagens da loja (envio de arquivo, hoje é só link https), com redimensionamento e texto alternativo.

**C2. Vários eventos e venda** (conversão)
- **Página de cada evento gerada sozinha** a partir dos dados do evento (modelos), com o produtor podendo personalizar.
- **Agenda** da loja (lista e calendário) e filtros por local, data e categoria.
- **Conversão:** contagem regressiva, lote em destaque ("últimos ingressos"), cupom pela URL (`?cupom=`), SEO por página (título, descrição, imagem, dados estruturados de evento para o Google), sitemap, **pixel do Meta, GA4 e TikTok** com consentimento do visitante (a origem das vendas já é gravada).

**C3. Conteúdo e relacionamento**
- **Blog e notícias** (páginas de conteúdo com lista).
- **Formulários** (contato, lista de interesse, patrocinadores) que viram contatos no CRM do Jards.
- Menu, rodapé e idioma configuráveis.

## Ordem proposta e por quê

1. **I0, base de integração** (API pública, widget, `/embed/`, webhooks): destrava todos os CMS de uma vez, o produtor com site já vende por ela, e nada disso mexe no editor.
2. **C1, base do construtor** (temas, seções, pré-visualização, histórico): é o que o produtor sem site mais sente.
3. **I1, plugin do WordPress** (usa o I0).
4. **C2, página automática por evento e conversão.**
5. **I2, Webflow e Wix; Shopify por último**, conforme a procura.
6. **C3, blog e formulários.**

Cada fase vira **vários PRs pequenos**, como no resto da Ticketeria (banco primeiro, depois a lógica testada, depois a tela). **Tamanho honesto:** isto é um produto à parte; I0 e C1 são semanas de trabalho cada; os plugins dependem também de revisão das lojas de apps, que não controlamos.

## O que o dono precisa decidir

1. **A ordem acima**, ou outra (por exemplo, C1 antes de I0).
2. **Contas de desenvolvedor** nas lojas de apps (WordPress.org é grátis; Wix, Webflow e Shopify têm contas de parceiro, algumas pagas ou com revisão) e **em nome de quem** ficam.
3. **Blog e formulários (C3):** entram agora ou só depois do resto?
4. **HTML livre:** fica fora (recomendado) ou queremos um bloco "código" só para planos pagos, com os riscos conhecidos?
5. **Pixel e analytics:** o consentimento do visitante (cookies) pede texto de política; o advogado deve ver junto com os Termos.

## Riscos a ter em mente

- **Pagamento dentro do site de terceiros:** fora do alcance; a compra termina no Jards (e o cartão, na página do Asaas).
- **Iframe e navegadores:** cookies de terceiros e bloqueio de rastreio quebram o carrinho dentro de iframe em alguns navegadores; por isso a compra pode abrir em nova aba por padrão.
- **Manutenção de plugins:** cada plugin é uma superfície nova (versões do CMS, revisão, suporte). Só vale abrir um depois que o I0 estiver estável.
- **Os Termos de compra** ainda falam só em Pix e precisam de revisão (pendência anterior).
