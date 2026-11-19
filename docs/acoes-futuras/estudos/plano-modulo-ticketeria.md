# Módulo Ticketeria no Jards — plano (v2: evento próprio)

18/11/2026. Base: `origin/main` do jards-app (8646aeb). Escrito antes de qualquer mudança; o andamento das fases fica na tabela abaixo.

**Decisão de hoje:** a Ticketeria tem **evento próprio** e **não depende da Produção**. Quem só quer vender ingresso usa só a Ticketeria.

**Decisões do dono, 18/11/2026 (depois da T0):** (1) o site público **se move** da Produção para a Ticketeria: um só site por produtor, que é da loja dele; (2) **a Produção não tem mais nenhuma forma de ticketeria**: saem de lá o site, a porta (leitor de credenciais), a plateia (setores e cotas), o borderô (com o acerto de contas) e os convidados e cortesias das sessões. A "ponte opcional" que alimentaria o borderô deixa de existir (seção 5). A Ticketeria terá as versões próprias dessas peças nas fases seguintes; o que saiu da Produção fica no histórico do git só como referência de desenho.

## Andamento

| Fase | Situação | Onde |
|---|---|---|
| **T0** | Módulo `ticketeria` registrado e escondido: `lib/modulos.ts` (em `MODULOS_EM_CONSTRUCAO`), seletor e menu no layout, página `/ingressos` com `exigirModulo("ticketeria")` e estado vazio (a rota não é `/ticketeria` porque jards.com.br/ticketeria é a página pública do produto, decisão de 18/11), as quatro regras de módulo e as funções de vagas, convites e cortesia aceitando a ticketeria, compra de vaga indisponível (409), sem Stripe. Testes: `supabase/tests/ticketeria_modulo.test.sql` e `tests/ticketeria-modulo-sql.test.ts` | PR #313, migrations `20261118222052_ticketeria_modulo_regras` e `20261118222139_ticketeria_modulo_funcoes` (aplicadas em 18/11/2026) |
| **T1** | Loja do produtor (`ticketeria_lojas`, uma por organização) e **site movido** da Produção: `ticketeria_sites` (um por loja), `ticketeria_site_paginas` e `ticketeria_site_dominios`, com `auth_ticketeria_pode(org, 'ler' \| 'editar')` e `auth_tem_modulo(org, 'ticketeria')`; o site da organização de teste foi copiado com os mesmos ids. Código em `lib/ticketeria/` (site, site-publico, vercel-dominios, banco, cliente, estados, permissoes) e `components/ticketeria/`; tela em `/ingressos/site`; API `/api/ticketeria/sites/[id]/dominio`; `/dominio/[host]`, `/previa-site` e `proxy.ts` leem da loja. O bloco de programação passou a dizer de qual espaço da Produção ele mostra as sessões (`espaco_id` no JSON). **A Produção ficou sem ingresso**: saíram as telas e rotas da porta, plateia, borderô e convidados (inclusive as públicas `/convidar` e `/credencial`), 14 tabelas, 20 funções, a regra da câmera no `next.config.ts`; o retorno da marca passou a contar só sessões. Testes: `supabase/tests/ticketeria_site.test.sql` (29 de 29 no banco real), `tests/ticketeria-banco-tipos.test.ts`, `tests/ticketeria-site.test.ts` | PR #325; migrations `20261118233242_ticketeria_lojas_site` (pelo conector) e `20261118233748_producao_sem_ingressos` (pela CLI, com o "sim" do dono: o conector recusa DROP), aplicadas e conferidas por catálogo em 18/11/2026. A `fn_producao_pai` (do histórico da Produção) foi limpa em 19/11/2026: `20261119300000_producao_pai_sem_ingressos`, aplicada, sem as cinco tabelas antigas |
| **T2** | **Locais, setores, eventos e sessões**, próprios da Ticketeria: `ticketeria_locais` (da loja, com cidade, UF e o **fuso** em que as horas das sessões são digitadas e mostradas; arquiva-se), `ticketeria_setores` (lugares de cada parte do local; a capacidade é a soma dos setores em uso), `ticketeria_eventos` (título, descrição, imagem, classificação indicativa; **rascunho, publicado ou cancelado**, e cancelado não volta) e `ticketeria_sessoes` (o evento num local: início, fim e abertura das portas; cancela-se com `cancelada_em`). O banco confere pai da mesma organização, local arquivado e evento cancelado sem sessão nova, e o que não se apaga (evento publicado ou cancelado, sessão de evento publicado, local com sessão). A loja nasce sozinha, com o nome da organização, no primeiro evento ou local. Telas: **Eventos** (`/ingressos`), a página do evento com as sessões (`/ingressos/eventos/[id]`) e **Locais** (`/ingressos/locais`). Publicar ainda não vende: o catálogo é a T3. Testes: `supabase/tests/ticketeria_eventos.test.sql` (21 de 21 no banco real), `tests/ticketeria-eventos.test.ts` (horas no fuso, leitura dos formulários) e `tests/ticketeria-banco-tipos.test.ts` | PR #332; migration `20261119002840_ticketeria_eventos` aplicada e conferida por catálogo em 19/11/2026 (tipos iguais aos do gerador) |
| **T3** | **Catálogo do evento**: `ticketeria_ingressos` (um tipo de ingresso num **setor**: categoria inteira, meia, social, gratuito, cortesia ou outra; limite por pedido; se aparece ao público, e a cortesia por padrão não aparece) e `ticketeria_lotes` (em sequência: preço em centavos, **quantidade por sessão** e janela de venda no fuso do local). O banco confere que o **preço combina com a categoria** (gratuito e cortesia custam zero; as outras, mais que zero) e que a **oferta do evento num setor não passa dos lugares** (a linha do setor é travada; diminuir o setor depois não trava a edição, a tela mostra o que passou). Setor com ingresso não se apaga. Tela: seção **Ingressos** na página do evento, por setor (lugares, no catálogo, sem ingresso), com os lotes e a sugestão da meia (metade da inteira). Ainda sem venda: o lote seguinte abrir quando o anterior esgota, a cota de 40% da meia e a conferência de documento ficam para a venda (T5) e a T8. Testes: `supabase/tests/ticketeria_catalogo.test.sql` (17 de 17 no banco real) e `tests/ticketeria-catalogo.test.ts` | PR #335; migration `20261119011007_ticketeria_catalogo` aplicada e conferida por catálogo em 19/11/2026 (tipos iguais aos do gerador) |
| **T4** | **Núcleo de pagamento, sem dinheiro real**: `ticketeria_taxas` (regra da taxa por loja ou padrão da plataforma: pontos-base + fixo, e quem paga; só o super admin grava; **sem regra, zero**: o valor é decisão do dono), `ticketeria_pedidos` e `_pedido_itens` (comprador com nome e e-mail, reserva com prazo, itens por lote; total = produtor + taxa), o **livro-razão de partidas dobradas** (`ticketeria_transacoes` e `_partidas`: soma zero conferida no fim da transação; não muda nem se apaga) e `ticketeria_notificacoes_provedor` (avisos do provedor, um por id externo). Funções só do servidor: `fn_ticketeria_reservar` (lote da vez em sequência, divisão entre lotes, estoque por sessão com o lote travado, reserva vencida libera o lugar, gratuito já nasce pago) e `fn_ticketeria_confirmar_pagamento` (confere o valor, idempotente, grava o razão; reserva vencida só vira paga se couber). Código em `lib/ticketeria/pagamento/`: a interface do provedor, o **provedor de mentira** (aviso assinado com HMAC; nunca roda em produção), a taxa (a mesma conta do banco, nos mesmos casos), o razão, o processamento idempotente dos avisos (com estorno quando o pedido não pode virar pago) e a conciliação. Sem tela e sem rota pública: a compra e a rota do aviso chegam com o provedor real (T5). Testes: `supabase/tests/ticketeria_pagamentos.test.sql` (29 de 29 no banco real) e `tests/ticketeria-pagamento.test.ts` | PR #342; migration `20261119033509_ticketeria_pagamentos` aplicada e conferida por catálogo em 19/11/2026 (tipos iguais aos do gerador; nenhuma regra de taxa gravada: zero) |
| **T5 (parte 1)** | **Adaptador do Asaas** (provedor escolhido pelo dono em 19/11/2026; a taxa do Jards deixou de ser 2,5%: é um valor fixo por ingresso, ver D13 e a parte 2 abaixo): `lib/ticketeria/pagamento/asaas.ts` implementa `ProvedorDePagamento` para o **Pix** (cliente, cobrança com `externalReference` = o pedido, copia e cola, estorno, cancelamento) e lê o aviso (webhook) pelo token do cabeçalho `asaas-access-token`; sandbox por padrão, **produção só com três travas juntas** (`ASAAS_AMBIENTE=producao`, `ASAAS_URL` conferida e `TICKETERIA_DINHEIRO_REAL=sim`). Escrito pela documentação pública e provado só com respostas falsas: **nenhuma chamada de verdade, nenhuma conta**. O **cartão não está feito**. **Achado:** o Asaas exige o **CPF ou CNPJ de quem paga**, e o pedido só guarda nome e e-mail (D6, dados mínimos): é decisão de dados do dono. Falta ainda: a rota pública do aviso, a página de compra, o cadastro da subconta de cada produtor, a escolha de onde nasce a cobrança (na subconta com split para o Jards, ou na conta do Jards com split para o produtor: a doc não diz se a primeira é permitida; validar no sandbox) e as respostas do comercial do Asaas (garantia de subconta negativa, prazo do cartão, retenção até o evento). Testes: `tests/ticketeria-asaas.test.ts` | PR do adaptador do Asaas |
| **T5 (parte 2)** | **Custo do meio de pagamento pago pelo comprador, taxa do Jards e parcelamento do produtor** (decisões do dono, 19/11/2026). Taxa do Jards: a T5 (parte 2) gravou primeiro um valor fixo de R$ 1,35, e o dono **trocou, no mesmo dia, para 2,5% do preço de cada ingresso pago** (D13), por loja (a tabela `ticketeria_taxas` da T4 já aceitava; a regra padrão é percentual 250 pontos-base, fixo zero, paga o comprador; migration `20261119055400_ticketeria_taxa_padrao_2_5`); cortesia e gratuito, zero. O **custo do meio** (Asaas: Pix R$ 1,99; cartão à vista 2,99% + R$ 0,49; 2 a 6 parcelas 3,49% + R$ 0,49: valores PROVISÓRIOS que o dono passou) mora na tabela `ticketeria_custos_meio` (só o super admin grava; uma linha nova com `vigente_desde` troca o valor, sem migration) e é calculado "por dentro" (o produtor recebe o preço cheio): `fn_ticketeria_custo_do_meio`. O comprador escolhe Pix ou cartão e as parcelas (`fn_ticketeria_definir_meio`, só o servidor), e a confirmação passa a conferir total + custo (`fn_ticketeria_confirmar_pagamento`, trocada, e exige o meio escolhido). O **parcelamento é opcional e o produtor escolhe**: `ticketeria_lojas.parcelas_max` (1 a 6; padrão 1, só à vista). O razão registra o que chega líquido (produtor + taxa); o custo do meio não é dinheiro do Jards nem do produtor. **Decidido para a T7:** em devolução, o comprador recebe tudo de volta e o **Jards cobre o custo do meio que o Asaas não devolve** (sem cobrar do produtor); o produtor não decide devolução. Código: `lib/ticketeria/pagamento/custo-meio.ts` (a mesma conta do banco, os valores separados para a tela, as parcelas oferecidas). Testes: `supabase/tests/ticketeria_custo_meio.test.sql` (31 de 31 no banco real; o da T4 foi ajustado) e `tests/ticketeria-custo-meio.test.ts` | PR #347; migration `20261119041904_ticketeria_custo_do_meio` aplicada e conferida por catálogo em 19/11/2026 (tipos iguais aos do gerador) |
| **T5 (parte 3)** | **Rota pública do aviso do Asaas**: `POST /api/ticketeria/avisos/asaas` (`app/api/ticketeria/avisos/asaas/route.ts`) recebe o webhook, confere o token do cabeçalho `asaas-access-token` e confirma o pedido pelo caminho já provado da T4 (idempotente, razão em partidas dobradas). **Inerte sem configuração**: sem `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` responde 503 e não grava nada; em produção, só com as três travas. Corpo maior que 64 KB: 413; falha passageira: 500 (o Asaas reenvia), sem vazar a mensagem. O limite de pedidos por minuto da rota é 600 (rajada de vendas). Lógica em `lib/ticketeria/pagamento/rota-aviso.ts`, testada sem rede e sem banco (`tests/ticketeria-rota-aviso.test.ts`). Sem banco novo, sem tela, sem dinheiro | PR da rota do aviso |
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
| **D11** | **Trava de saque de 7 dias**: o produtor não saca o que vendeu nos últimos 7 dias (janela do arrependimento, CDC art. 49). Só isso: nada de reter até o evento. Feita pela *validação de saque por webhook* do Asaas (o Asaas pergunta ao Jards, em cerca de 5 s, a cada saque da subconta; o Jards responde APROVADO ou RECUSADO). O dinheiro fica na conta do produtor, o Jards não guarda saldo (D3). Protege o Jards, que é garantidor de subconta negativa pelos Termos do Asaas | **19/11** |
| **D12** | **Provedor de pagamento: Asaas** (escolhido pelo dono em 19/11/2026). Provedor plugável (D4): trocar depois não muda o resto | **19/11** |
| **D13** | **Taxa do Jards = 2,5% do preço de cada ingresso pago** (percentual, não valor fixo), mais o custo do meio de pagamento (D14). Decidida pelo dono em 19/11/2026; **substitui o valor fixo provisório de R$ 1,35** que valeu antes no mesmo dia. Paga pelo comprador, somada ao preço; o produtor recebe o preço cheio. Cortesia e ingresso gratuito: taxa zero. **Configurável por loja** em `ticketeria_taxas`: a regra padrão é **250 pontos-base e fixo zero**, e uma linha nova com `vigente_desde` troca o valor sem mexer no código. Exemplo: ingresso de R$ 50 no Pix = R$ 50,00 + R$ 1,25 (Jards) + R$ 1,99 (Pix) = **R$ 53,24**. Com o percentual, a parte do Jards cresce com o preço (ingresso de R$ 20: R$ 0,50; de R$ 200: R$ 5,00). O dono foi avisado de que, com lucro tão baixo, o modelo só se sustenta como extensão do Jards (sugeridas uma mensalidade do módulo e uma taxa de 3% a 4%) e decidiu seguir. Ponto para o advogado: o STJ aceita a taxa de conveniência quando o preço total e a taxa são informados e destacados antes da compra; um rascunho de análise apontou o valor fixo como mais seguro que o percentual | **19/11** |
| **D14** | **O custo do meio de pagamento (Asaas) é pago pelo comprador**, na hora da compra, junto com a taxa do Jards; os dois aparecem separados antes de pagar. O produtor recebe o preço cheio do ingresso | **19/11** |

Referência de mercado, conferida em 19/11/2026 (páginas das próprias empresas e imprensa; vale reconferir antes de fechar preço): **Sympla** cobra 10% por ingresso pago, com mínimo fixo de R$ 3,99 para ingressos até R$ 39,90, a partir de 15% com lugar marcado e zero para gratuitos; a taxa de processamento aparece como item à parte e a página não diz se está dentro dos 10%. **Eventim.Light** diz "a partir de 6%" por ingresso, sem mensalidade, para eventos de até mil pessoas, sem deixar claro o que inclui (a página oficial não abriu na consulta); a plataforma principal da Eventim cobra 14%. Com a D13 e o custo do Asaas (Pix R$ 1,99; cartão à vista 2,99% + R$ 0,49; valores publicados, a confirmar), o total acima do preço para o comprador em um ingresso de R$ 50 no Pix é de **R$ 3,24 (6,5%)** (R$ 1,25 do Jards + R$ 1,99 do Pix), contra R$ 5,00 da Sympla.

Em aberto: a venda em **dinheiro na porta**, o **fiscal** (quem emite o documento da taxa e o do ingresso), o **preço do módulo**, as respostas do comercial do Asaas (devolução do custo do cartão em cancelamento, chargeback, garantia de subconta negativa) e o parecer jurídico sobre o split.

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
2. ~~PSP~~: **decidido, Asaas (D12).** Falta o retorno do comercial do Asaas sobre os pontos acima.
3. **Preço do módulo**: gratuito (receita só na taxa), mensal, ou os dois.
4. **Venda em dinheiro na porta**: fatura mensal ao produtor ou só meios eletrônicos.
5. ~~Quem paga o custo do meio de pagamento e o valor da taxa~~: **decidido, o comprador paga o meio (D14) e a taxa é 2,5% do preço do ingresso (D13).**
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
| Produtor saca o Pix e depois há arrependimento em massa ou cancelamento; a conta dele fica negativa e o Asaas cobra o Jards (garantidor, pelos Termos públicos) | D11: trava de saque de 7 dias pelo webhook de validação; contrato com direito de regresso e desconto nas vendas seguintes; teto de vendas por produtor no piloto. **A confirmar com o Asaas:** como ativa, se vale para subcontas, se segura também o estorno por Pix, e se a garantia tem teto. **A confirmar com o advogado:** se segurar o saque assim parece controlar dinheiro de terceiro |

## 9. Liberação do repasse antes do evento e taxa de risco (EM ESTUDO, não decidido; 19/11/2026)

**Nada disto está construído nem vai para produção antes do parecer jurídico e das respostas do Asaas (D7).** O dono pediu registrar a ideia, com a regra de vocabulário abaixo.

### 9.1 Ideia

O repasse do produtor fica retido até depois do evento (padrão do mercado: a Sympla repassa no 3º dia útil depois do evento; a Eventbrite segura o repasse enquanto processa reembolsos). O produtor pode pedir a **liberação antecipada de parte do repasse** e o Jards cobra uma **taxa de risco** por isso. A taxa existe porque o Jards assume o risco: pelos Termos do Asaas, a conta principal é garantidora de subconta negativa. A retenção seria feita pela *validação de saque por webhook* do Asaas (o Asaas pergunta ao Jards, a cada saque da subconta, e o Jards responde APROVADO ou RECUSADO). O dinheiro **nunca sai da conta do produtor**; o Jards não guarda saldo (D3) e **nunca usa dinheiro próprio** para pagar o produtor (D4).

Substitui a D11 (só 7 dias) **se** for aprovada; até lá a D11 vale.

### 9.2 Vocabulário (regra do dono)

O Jards **não opera serviço financeiro**: é software de ticketeria e esta é mais uma função dele. Na tela, nos Termos, em e-mails e em código de produto, usar **"liberação antecipada do repasse"** e **"taxa de risco"**; a sobra vai para a **"reserva do Jards"**. **Não usar**: antecipação, adiantamento, desconto de recebível, empréstimo, crédito, juros, fundo, proteção ou seguro. (Estes termos só aparecem nas perguntas ao advogado, em 9.5, para serem descartados.)

### 9.3 Fórmula para testar (muito conservadora; os números de risco são palpites até haver dados)

- **Elegível (V):** vendas pagas há mais de 7 dias, sem estorno, de eventos que acontecem em até 30 dias.
- **Chance de problema:** `π = (1 + I) / (20 + N)`; N = eventos realizados, I = eventos com incidente (evento cancelado ou adiado com estorno em massa, chargeback do produtor ou conta negativa). Produtor novo: 5%.
- **Parte liberada (f):** no máximo **30% de V** (os 70% restantes cobrem estornos) e no máximo `R$ 50 ÷ π` (produtor novo: R$ 1.000), com teto de R$ 10.000.
- **Taxa de risco sobre o valor liberado:** `máx( π + 1 ponto ; (π ÷ 5%) × (3% + 3 × f²) )`. Produtor novo: liberar 10% custa 6%; 20% custa 15%; 30% custa 30%. Com 20 eventos limpos: 3,5%, 7,5% e 15%. Com 1 incidente: 11,4%, 28,6% e 57,1%.
- **Bloqueio imediato:** chargeback aberto, evento adiado ou cancelado, conta negativa.
- **Teto global no piloto:** soma do liberado em aberto até R$ 20.000.
- A tela mostra a taxa e o valor que o produtor recebe **antes** de ele confirmar.
- Simulação (200 produtores, 10 eventos, perda de 100% do liberado quando há incidente, produtor ruim sempre pega o máximo): resultado positivo no perfil normal (R$ 92 mil) e no perfil com 20% de ruins (R$ 36 mil), nenhuma rodada negativa. Reproduzir com `python3 -I docs/acoes-futuras/estudos/simulacao-liberacao-repasse.py` antes de decidir (as probabilidades de incidente são palpites).

### 9.4 Cancelamento do evento pelo produtor

Quem cancela devolve o valor do ingresso (do saldo do produtor). **O Jards devolve a própria taxa e o custo do meio de pagamento** (as plataformas que retêm a taxa enfrentam multa do Procon e reclamação; o Procon-MG multou a Sympla em mais de R$ 210 mil). A política de reembolso é do Jards, o produtor não decide sobre ela. A plataforma responde em conjunto com o produtor perante o comprador (decisão do TJDF), mesmo sendo software: mostrar no checkout o nome e o CNPJ do produtor como vendedor ajuda, mas não elimina.

### 9.5 Conta no Asaas

Recomendado: **A. subconta por produtor** (conta principal do Jards em CNPJ; subconta criada por API, em nome do produtor, com cadastro verificado pelo Asaas; o dinheiro vai da subconta para o banco dele). Alternativa **B. conta do próprio produtor** com a chave entregue ao Jards: sem a garantia do Jards, mas com mais atrito e chaves de terceiros. Falta validar no sandbox em qual conta a cobrança nasce (subconta com split para o Jards, ou conta principal com split para o produtor).

### 9.6 Perguntas

**Ao Asaas** (também em `~/Downloads/perguntas-asaas-trava-de-saque.md`): garantia por escrito e se tem teto; como ativar a validação de saque; se vale para subcontas; se segura estorno por Pix; se o produtor assina contrato próprio na subconta; se o estorno devolve a taxa do split.

**Ao advogado:** (1) A taxa de risco, como desenhada (percentual sobre o valor liberado, sem depender de prazo, sobre dinheiro do próprio produtor, sem dinheiro do Jards), é preço de serviço ou pode ser reclassificada como desconto de recebível, empréstimo ou crédito? (2) O limite de juros da Lei de Usura (12% ao ano para quem não é instituição financeira) pode ser aplicado? (3) A reserva própria do Jards, sem direito de nenhum produtor, afasta a proteção mutualista (Lei Complementar 213/2025, Susep)? (4) Precisa de autorização do Banco Central ou da Susep? (5) Como escrever os Termos e a tela. (6) Tributação da taxa de risco. (7) Segurar o saque assim parece controlar dinheiro de terceiro? (8) O Jards responde junto com o produtor pelo reembolso de evento cancelado, mesmo como software?

Se o parecer disser que se parece com serviço financeiro, **não se libera**: o padrão passa a ser reter até o evento, sem taxa, e o produtor que quiser dinheiro antes usa a antecipação do próprio Asaas (instituição autorizada), no cartão.
