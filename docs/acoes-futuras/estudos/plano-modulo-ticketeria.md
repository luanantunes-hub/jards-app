# Módulo Ticketeria no Jards — plano (v2: evento próprio)

18/11/2026. Base: `origin/main` do jards-app (8646aeb). Escrito antes de qualquer mudança; o andamento das fases fica na tabela abaixo.

**Decisão de hoje:** a Ticketeria tem **evento próprio** e **não depende da Produção**. Quem só quer vender ingresso usa só a Ticketeria. Quem tem as duas pode ligar um evento a uma sessão da Produção (ponte opcional, ver seção 5).

## Andamento

| Fase | Situação | Onde |
|---|---|---|
| **T0** | Módulo `ticketeria` registrado e escondido: `lib/modulos.ts` (em `MODULOS_EM_CONSTRUCAO`), seletor e menu no layout, página `/ingressos` com `exigirModulo("ticketeria")` e estado vazio (a rota não é `/ticketeria` porque jards.com.br/ticketeria é a página pública do produto, decisão de 18/11), as quatro regras de módulo e as funções de vagas, convites e cortesia aceitando a ticketeria, compra de vaga indisponível (409), sem Stripe. Testes: `supabase/tests/ticketeria_modulo.test.sql` e `tests/ticketeria-modulo-sql.test.ts` | PR #313, migrations `20261118222052_ticketeria_modulo_regras` e `20261118222139_ticketeria_modulo_funcoes` (aplicadas em 18/11/2026) |
| T1 | Não começou | |
| T2 | Não começou | |
| T3 | Não começou | |
| T4 | Não começou | |
| T5–T8 e piloto | Dependem das decisões da seção 7 | |

## 1. Decisões que o módulo obedece

| # | Decisão | Origem |
|---|---|---|
| D1 | Não é marketplace: cada produtor vende no **site dele, no domínio dele**, e na porta | conversa 18/11 |
| D2 | Receita do Jards = **taxa por ingresso** (% + valor fixo, configurável) | conversa 18/11 |
| D3 | **O Jards não guarda saldo de terceiros.** Split no PSP: ingresso para a subconta do produtor, taxa para o Jards | plano de Produção (decisão 16) + conversa |
| D4 | **Gateway próprio como núcleo** (orquestração, ledger imutável, conciliação, roteador), com **PSP plugável**. Virar subcredenciador ou instituição de pagamento está fora (capital e regime do BCB) | conversa 18/11 |
| D5 | A taxa da plataforma é devolvida junto com o ingresso no arrependimento de 7 dias (CDC) | conversa 18/11 |
| D6 | Comprador é dado pessoal: dados mínimos; organização controladora, Jards operador; guarda de 12 meses | decisões de 15/11 |
| D7 | Nada com dinheiro real antes de **piloto de baixo valor** e parecer jurídico sobre o split e a taxa | plano de Produção |
| D8 | Interface pelo `DESIGN.md`; telas só vão para a main com o ok do dono; backend segue o fluxo automático e **para em decisões de dinheiro** | memória do projeto |
| **D9** | **Evento próprio**: a Ticketeria tem locais, eventos, sessões e setores seus; independente da Produção, com ponte opcional | **18/11** |

Em aberto: o **PSP** (decisões 16 e 17), a venda em **dinheiro na porta**, quem paga o custo do meio de pagamento, o valor da taxa, o fiscal e o preço do módulo.

## 2. O que existe hoje na Produção e o que acontece com cada peça

Tudo o que já existe de "ingresso" está pendurado em `producao_sessoes` (sessão da programação de uma sala). Como a Ticketeria não depende da Produção, **nada de lá é reaproveitado como tabela**: o que serve vira **referência de desenho**, e o que não depende da sessão (o site) é movido.

| Pronto hoje | Destino |
|---|---|
| **Site público** (`producao_sites`, `producao_site_paginas`, `producao_site_dominios`; `lib/producao/site.ts`, `site-publico.ts`, `vercel-dominios.ts`; `/dominio/[host]`, `/previa-site`, `EditorDoSite`, `DominiosDoSite`, roteamento no `proxy.ts`) | **MOVER para a Ticketeria e desacoplar.** Hoje o site pertence a um espaço da Produção (`espaco_id` obrigatório); na Ticketeria passa a pertencer ao **produtor** (`ticketeria_lojas`). A Produção continua podendo ter site? Ver pergunta 8 da seção 7 |
| Programação pública (`/programacao`, `/embed/programacao`, `.ics`) e marcas | **FICAM** na Produção. A Ticketeria terá a **agenda própria** dos eventos, com o mesmo desenho (filtro por dia, calendário, embutir) |
| Plateia (`producao_setores`, `producao_setor_cotas`) | **Não reaproveitada.** A Ticketeria tem locais e setores seus; as cotas viram categorias do catálogo. Serve de referência (inclusive a conferência "soma ≤ lugares" feita pelo banco) |
| Leitor da porta (`producao_porta_leituras`, credenciais) | **Não reaproveitado.** Leitor próprio (`ticketeria_leituras`) com o mesmo resultado (permitido, já entrou, negado) e modo offline |
| Borderô (`producao_borderos` e filhas) | **FICA** como dinheiro da produção. A Ticketeria gera o **relatório de bilheteria** próprio (receita, taxa, público, ECAD/prefeitura) e, se houver ponte, **alimenta** o borderô |
| Convidados e cortesias | **FICAM**; a Ticketeria tem a categoria "cortesia" no catálogo |
| `producao_pedidos` | **FICA, e o nome é armadilha**: é o pedido de compra de despesa. Os de ingresso usam `ticketeria_` |

## 3. O que é novo (tudo com prefixo `ticketeria_`)

1. **Produtor/loja** (`ticketeria_lojas`): dono do site, da taxa, da subconta no PSP.
2. **Locais, setores e (depois) assentos**: capacidade que a Ticketeria controla sozinha.
3. **Eventos e sessões** (data, horário, local), situação (rascunho, à venda, esgotado, encerrado, cancelado).
4. **Catálogo e lotes**: inteira, meia, social, cortesia; preço, janela de venda, limite por comprador, lote que vira o seguinte.
5. **Pedido e comprador**: carrinho sem conta, reserva com validade, dados mínimos.
6. **Núcleo de pagamento** (D4): interface `PaymentProvider`, provedor de mentira, **ledger de partidas dobradas** (desenho do pgledger, MIT), regra de taxa, conciliação, webhooks idempotentes.
7. **Ingresso com QR assinado** e leitura na porta, offline.
8. **PDV**: Pix dinâmico no celular do bilheteiro; dinheiro apurado.
9. **Bloco de compra embutível** no site do produtor e agenda pública.
10. **Reembolso e estorno** com devolução da taxa e cancelamento de sessão.
11. **Relatório de bilheteria** para ECAD e prefeitura; meia-entrada e cotas legais.
12. **Painel da plataforma**: taxa por produtor, extrato, faturas da venda em dinheiro, conciliação.

## 4. Como o módulo entra no Jards (o caminho que a Produção percorreu)

1. `lib/modulos.ts`: `ModuloId` ganha `"ticketeria"`; entra em `MODULOS`, `MODULOS_EM_CONSTRUCAO` (escondido dos clientes), `INICIO_DO_MODULO` (`/ingressos`; era `/ticketeria`, mudou em 18/11 porque jards.com.br/ticketeria é a página pública do produto) e `ROTAS_DO_MODULO`.
2. **Banco**: uma migration, como a PD0.1, para as quatro regras de módulo aceitarem o valor novo: `organization_modulos_modulo_check`, `organization_invitations_modulos_acesso_check`, `organization_members_modulos_acesso_check`, `organization_seat_purchases_modulo_check`.
3. **Acesso**: `exigirModulo("ticketeria")` no servidor; funções `auth_ticketeria_*` e papéis próprios (quem vê dinheiro, quem opera a porta, quem vende no PDV).
4. **Regressão**: os testes que citam o módulo `producao` (`supabase/tests/cortesia_por_modulo.test.sql`, `e2e/producao-acesso.spec.ts`) ganham caso para o novo; nenhum pode quebrar a captação nem a prestação.
5. **Mover e desacoplar o site**: criar `ticketeria_lojas`; as três tabelas do site passam a apontar para a loja (não mais para `producao_espacos`); regenerar `lib/supabase/types.ts`; atualizar `proxy.ts`; testes de banco acompanham.
6. **Preço do módulo e vaga extra**: a Produção tem R$ 92,80 e vaga de R$ 19,90. Para a Ticketeria o dono decide (seção 7).

## 5. Ponte opcional com a Produção

Coluna `producao_sessao_id` (nula) no evento da Ticketeria. Se a organização tem as duas, o produtor pode **importar** a sessão (data, sala, capacidade) em vez de digitar, e a Ticketeria pode **alimentar o borderô** da sessão. Se não tem a Produção, a coluna fica vazia e nada muda. A ponte fica para depois do núcleo estar pronto.

## 6. Fases

| Fase | Entrega | Depende de decisão? |
|---|---|---|
| **T0** | Módulo `ticketeria` registrado e escondido (seção 4, passos 1 a 4) | Não |
| **T1** | Loja do produtor e **site movido e desacoplado** (passo 5) | Não (pergunta 8) |
| **T2** | Locais, setores, eventos e sessões | Não |
| **T3** | Catálogo e lotes | Não |
| **T4** | Núcleo de pagamento: interface, provedor de mentira, ledger, taxa, conciliação | Não |
| **T5** | Compra online com PSP real e split; ingresso por e-mail | **Sim: PSP, taxa, fiscal** |
| **T6** | Ingresso com QR, leitura offline na porta, PDV com Pix | **Sim: venda em dinheiro** |
| **T7** | Reembolso com devolução da taxa, conciliação diária, relatório de bilheteria | Sim |
| **T8** | Meia-entrada, cotas legais, fiscal, assento marcado; ponte com a Produção | Sim |
| **Piloto** | Bilheteria de baixo valor, dinheiro real, com parecer jurídico em mãos | Sim |

T0 a T4 não dependem de nenhuma decisão em aberto. É mais trabalho que a opção anterior, porque agora a Ticketeria tem o próprio modelo de evento, mas o custo vem **antes** do dinheiro, onde dá para errar sem consequência.

## 7. Decisões que só o dono toma

1. ~~Dependência da Produção~~: **decidido, evento próprio (D9).**
2. **PSP**: perguntas prontas em `~/Downloads/perguntas-provedores-pagamento.md`. Acrescentar o Asaas e perguntar à Stripe se uma plataforma **brasileira** pode cobrar taxa de contas conectadas brasileiras.
3. **Preço do módulo**: gratuito (receita só na taxa), mensal, ou os dois.
4. **Venda em dinheiro na porta**: fatura mensal ao produtor ou só meios eletrônicos.
5. **Quem paga o custo do meio de pagamento** e o **valor da taxa**.
6. **Fiscal**: quem emite o documento da taxa e o do ingresso.
7. Parecer jurídico sobre o split e a taxa de conveniência.
8. **O site continua existindo na Produção?** Se sim, a mudança é **copiar** o motor em vez de mover. Recomendo **mover**: um só site, que mostra a agenda da Ticketeria e, quando houver, a programação da Produção por bloco.

## 8. Riscos

| Risco | Resposta |
|---|---|
| Renomear e religar tabelas em produção quebra funções, políticas e tipos | Nenhuma organização real tem Produção hoje; fazer o T1 agora, com teste de banco, e conferir por catálogo que nada aponta para o nome antigo |
| Conector do Supabase recusa blocos de ensaio com `delete` em tabela de produção | Não contornar; apurar por catálogo e dizer o que ficou sem prova |
| Modelo de evento duplicado entre Produção e Ticketeria | Aceito por decisão (D9); a ponte opcional (seção 5) liga os dois sem fundir |
| `producao_pedidos` confunde com pedido de ingresso | Prefixo `ticketeria_` e glossário no `vocabulario.ts` |
| Dado do comprador | Dados mínimos, guarda de 12 meses, pedido de exclusão previsto no texto de privacidade |
| Dinheiro real cedo demais | Nada antes do piloto e do parecer jurídico (D7) |
