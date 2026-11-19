# Módulo Ticketeria no Jards — plano (v2: evento próprio)

18/11/2026. Base: `origin/main` do jards-app (8646aeb). Escrito antes de qualquer mudança; o andamento das fases fica na tabela abaixo.

**Decisão de hoje:** a Ticketeria tem **evento próprio** e **não depende da Produção**. Quem só quer vender ingresso usa só a Ticketeria.

**Decisões do dono, 18/11/2026 (depois da T0):** (1) o site público **se move** da Produção para a Ticketeria: um só site por produtor, que é da loja dele; (2) **a Produção não tem mais nenhuma forma de ticketeria**: saem de lá o site, a porta (leitor de credenciais), a plateia (setores e cotas), o borderô (com o acerto de contas) e os convidados e cortesias das sessões. A "ponte opcional" que alimentaria o borderô deixa de existir (seção 5). A Ticketeria terá as versões próprias dessas peças nas fases seguintes; o que saiu da Produção fica no histórico do git só como referência de desenho.

## Andamento

| Fase | Situação | Onde |
|---|---|---|
| **T0** | Módulo `ticketeria` registrado e escondido: `lib/modulos.ts` (em `MODULOS_EM_CONSTRUCAO`), seletor e menu no layout, página `/ingressos` com `exigirModulo("ticketeria")` e estado vazio (a rota não é `/ticketeria` porque jards.com.br/ticketeria é a página pública do produto, decisão de 18/11), as quatro regras de módulo e as funções de vagas, convites e cortesia aceitando a ticketeria, compra de vaga indisponível (409), sem Stripe. Testes: `supabase/tests/ticketeria_modulo.test.sql` e `tests/ticketeria-modulo-sql.test.ts` | PR #313, migrations `20261118222052_ticketeria_modulo_regras` e `20261118222139_ticketeria_modulo_funcoes` (aplicadas em 18/11/2026) |
| **T1** | Loja do produtor (`ticketeria_lojas`, uma por organização) e **site movido** da Produção: `ticketeria_sites` (um por loja), `ticketeria_site_paginas` e `ticketeria_site_dominios`, com `auth_ticketeria_pode(org, 'ler' \| 'editar')` e `auth_tem_modulo(org, 'ticketeria')`; o site da organização de teste foi copiado com os mesmos ids. Código em `lib/ticketeria/` (site, site-publico, vercel-dominios, banco, cliente, estados, permissoes) e `components/ticketeria/`; tela em `/ingressos/site`; API `/api/ticketeria/sites/[id]/dominio`; `/dominio/[host]`, `/previa-site` e `proxy.ts` leem da loja. O bloco de programação passou a dizer de qual espaço da Produção ele mostra as sessões (`espaco_id` no JSON). **A Produção ficou sem ingresso**: saíram as telas e rotas da porta, plateia, borderô e convidados (inclusive as públicas `/convidar` e `/credencial`), 14 tabelas, 20 funções, a regra da câmera no `next.config.ts`; o retorno da marca passou a contar só sessões. Testes: `supabase/tests/ticketeria_site.test.sql` (29 de 29 no banco real), `tests/ticketeria-banco-tipos.test.ts`, `tests/ticketeria-site.test.ts` | PR #325; migrations `20261118233242_ticketeria_lojas_site` (pelo conector) e `20261118233748_producao_sem_ingressos` (pela CLI, com o "sim" do dono: o conector recusa DROP), aplicadas e conferidas por catálogo em 18/11/2026. A `fn_producao_pai` (do histórico da Produção) foi limpa em 19/11/2026: `20261119300000_producao_pai_sem_ingressos`, aplicada, sem as cinco tabelas antigas |
| **T2** | **Locais, setores, eventos e sessões**, próprios da Ticketeria: `ticketeria_locais` (da loja, com cidade, UF e o **fuso** em que as horas das sessões são digitadas e mostradas; arquiva-se), `ticketeria_setores` (lugares de cada parte do local; a capacidade é a soma dos setores em uso), `ticketeria_eventos` (título, descrição, imagem, classificação indicativa; **rascunho, publicado ou cancelado**, e cancelado não volta) e `ticketeria_sessoes` (o evento num local: início, fim e abertura das portas; cancela-se com `cancelada_em`). O banco confere pai da mesma organização, local arquivado e evento cancelado sem sessão nova, e o que não se apaga (evento publicado ou cancelado, sessão de evento publicado, local com sessão). A loja nasce sozinha, com o nome da organização, no primeiro evento ou local. Telas: **Eventos** (`/ingressos`), a página do evento com as sessões (`/ingressos/eventos/[id]`) e **Locais** (`/ingressos/locais`). Publicar ainda não vende: o catálogo é a T3. Testes: `supabase/tests/ticketeria_eventos.test.sql` (21 de 21 no banco real), `tests/ticketeria-eventos.test.ts` (horas no fuso, leitura dos formulários) e `tests/ticketeria-banco-tipos.test.ts` | PR da T2, migration `*_ticketeria_eventos` |
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
| **D9** | **Evento próprio**: a Ticketeria tem locais, eventos, sessões e setores seus; independente da Produção | **18/11** |
| **D10** | **Um só site, da Ticketeria**; a Produção fica sem nenhuma forma de ticketeria (site, porta, plateia, borderô e convidados saem dela) | **18/11** |

Em aberto: o **PSP** (decisões 16 e 17), a venda em **dinheiro na porta**, quem paga o custo do meio de pagamento, o valor da taxa, o fiscal e o preço do módulo.

## 2. O que havia na Produção e o que aconteceu com cada peça

Tudo o que existia de "ingresso" estava pendurado em `producao_sessoes` (sessão da programação de uma sala). Decisão do dono em 18/11/2026: **a Produção fica sem nenhuma forma de ticketeria**. O site (que não dependia da sessão) **mudou-se** para a Ticketeria na T1; o resto **saiu** da Produção e serve só de referência de desenho (está no histórico do git: migrations `20261115200000` a `20261116200000` e as telas apagadas no PR da T1).

| Peça | O que aconteceu (T1, 18/11/2026) |
|---|---|
| **Site público** (`producao_sites`, `producao_site_paginas`, `producao_site_dominios`; `site.ts`, `site-publico.ts`, `vercel-dominios.ts`; `/dominio/[host]`, `/previa-site`, `EditorDoSite`, `DominiosDoSite`, roteamento no `proxy.ts`) | **MOVIDO para a Ticketeria.** Agora é da loja (`ticketeria_lojas` → `ticketeria_sites`, um por loja), não de um espaço. A tela fica em `/ingressos/site`. O bloco de programação aponta para um espaço da Produção da mesma organização (`espaco_id`); quem não tem a Produção não vê esse bloco no editor |
| Programação pública (`/programacao`, `/embed/programacao`, `.ics`) e marcas | **FICAM** na Produção. A Ticketeria terá a **agenda própria** dos eventos, com o mesmo desenho |
| Plateia (`producao_setores`, `producao_setor_cotas`) | **SAIU** da Produção. A Ticketeria terá locais e setores seus (T2); as cotas viram categorias do catálogo. Referência: a conferência "soma ≤ lugares" feita pelo banco |
| Porta (`producao_porta_leituras`, `producao_credenciais`, `/producoes/porta`, `/credencial/[código]`, leitor de câmera) | **SAIU.** A Ticketeria terá o leitor próprio (`ticketeria_leituras`) com o mesmo resultado (permitido, já entrou, negado) e modo offline (T6). A regra da câmera no `next.config.ts` saiu junto e volta com a porta da Ticketeria |
| Borderô (`producao_borderos`, receitas, deduções e acerto de contas) | **SAIU.** A Ticketeria gera o **relatório de bilheteria** próprio (receita, taxa, público, ECAD/prefeitura) (T7). As funções de dinheiro que outras telas usavam (`emCentavos`, `formatarReais`, `lerValorEmReais`) ficaram em `lib/producao/dinheiro.ts` |
| Convidados e cortesias (`producao_credencial_tipos`, `producao_convidados`, `producao_convidados_links`, `/convidar/[código]`) | **SAIU.** A Ticketeria terá a categoria "cortesia" no catálogo (T3) |
| Retorno da marca | **FICA**, sem o público e as entradas pela porta (vinham do borderô e da porta): conta só as sessões apresentadas, realizadas e por vir |
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
5. **Mover e desacoplar o site** (feito na T1): `ticketeria_lojas` criada; as três tabelas do site viraram `ticketeria_sites`, `ticketeria_site_paginas` e `ticketeria_site_dominios`, da loja (não mais de `producao_espacos`); as de `producao_*` foram apagadas. Os tipos ficam em `lib/ticketeria/banco.ts` (o `lib/supabase/types.ts` do app é escrito à mão e não tem as tabelas dos módulos, como a Produção, que tem o dela em `lib/producao/banco.ts`); `proxy.ts` atualizado; testes de banco acompanham.
7. **Tirar a ticketeria da Produção** (feito na T1, decisão de 18/11): menu (o grupo "Dia da sessão" virou "Público", sem a aba "Sessão"), rotas, componentes, funções e tabelas da porta, plateia, borderô e convidados.
6. **Preço do módulo e vaga extra**: a Produção tem R$ 92,80 e vaga de R$ 19,90. Para a Ticketeria o dono decide (seção 7).

## 5. A Produção e a Ticketeria

~~Ponte opcional: a Ticketeria alimentaria o borderô da sessão da Produção.~~ **Deixou de existir em 18/11/2026**: a Produção não tem mais borderô nem nenhuma peça de ingresso. O único ponto de contato que fica é o **bloco de programação do site**, que mostra as sessões confirmadas de um espaço da Produção quando a organização tem os dois módulos. Se um dia o evento da Ticketeria precisar importar dados de uma sessão (data, sala, capacidade), isso volta como decisão nova do dono.

## 6. Fases

| Fase | Entrega | Depende de decisão? |
|---|---|---|
| **T0** | Módulo `ticketeria` registrado e escondido (seção 4, passos 1 a 4) | Não |
| **T1** | Loja do produtor e **site movido e desacoplado** (passo 5); Produção sem nenhuma peça de ingresso (passo 7) | Não (decidido em 18/11) |
| **T2** | Locais, setores, eventos e sessões | Não |
| **T3** | Catálogo e lotes | Não |
| **T4** | Núcleo de pagamento: interface, provedor de mentira, ledger, taxa, conciliação | Não |
| **T5** | Compra online com PSP real e split; ingresso por e-mail | **Sim: PSP, taxa, fiscal** |
| **T6** | Ingresso com QR, leitura offline na porta, PDV com Pix | **Sim: venda em dinheiro** |
| **T7** | Reembolso com devolução da taxa, conciliação diária, relatório de bilheteria | Sim |
| **T8** | Meia-entrada, cotas legais, fiscal, assento marcado | Sim |
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
8. ~~O site continua existindo na Produção?~~ **Decidido em 18/11: mover.** Um só site por produtor, da Ticketeria, que mostrará a agenda da Ticketeria e, quando houver, a programação da Produção por bloco.

## 8. Riscos

| Risco | Resposta |
|---|---|
| Renomear e religar tabelas em produção quebra funções, políticas e tipos | Feito na T1 criando as tabelas novas, copiando o único site (da organização de teste) e apagando as antigas; conferido por catálogo antes e depois que nenhuma tabela, função, regra, view ou cron aponta para o nome antigo |
| Conector do Supabase recusa blocos de ensaio com `delete` em tabela de produção | Não contornar; apurar por catálogo e dizer o que ficou sem prova |
| Modelo de evento duplicado entre Produção e Ticketeria | Aceito por decisão (D9); sem ponte desde 18/11 (seção 5) |
| `producao_pedidos` confunde com pedido de ingresso | Prefixo `ticketeria_` e glossário no `vocabulario.ts` |
| Dado do comprador | Dados mínimos, guarda de 12 meses, pedido de exclusão previsto no texto de privacidade |
| Dinheiro real cedo demais | Nada antes do piloto e do parecer jurídico (D7) |
