# Ticketeria: o passe (desenho, sem código)

21/11/2026. Base: `feat/ticketeria` (PR #499). **Só desenho**: nenhuma migration escrita ou aplicada, nenhum código, nenhum dinheiro real. Decisão do dono em 21/11: o festival vende **"passe e por dia"**.

## 1. Em uma página

**O problema.** Hoje um pedido é de **uma** sessão (`ticketeria_pedidos.sessao_id` é `not null`) e o estoque é contado **por sessão**. Um passe de 3 dias é um ingresso que vale em **várias sessões do mesmo evento**, vendido ao lado do ingresso por dia. O "ingresso por dia" já existe: no Começar, o festival é uma praça com várias datas, e a pessoa escolhe o dia na compra. Falta só o passe.

**A recomendação (opção A).** O passe é um **tipo de ingresso especial** (`passe`) que cobre uma lista de sessões. Ao pagar, o pedido emite **um ingresso por sessão coberta** (cada um com seu código e QR, todos do mesmo `passe_grupo`). Tudo o que já funciona por sessão (porta, contagem de entradas, reembolso, lugar) continua igual, porque cada ingresso emitido segue sendo "de uma sessão". O pedido continua com **uma sessão âncora** (a primeira coberta).

**O ponto perigoso.** O repasse ao produtor libera pela sessão do pedido. Com o passe, o dinheiro **sairia depois do dia 1**, com os dias 2 e 3 ainda por acontecer. É preciso liberar pela **última** sessão coberta. Isso troca o corpo de `fn_ticketeria_saldo_liberavel`, que é o **cadeado do repasse**: só com o "sim" do dono, e **antes** de ligar a venda do passe.

**O que depende do "sim" do dono** (detalhe na seção 7): trocar o corpo de 4 funções já publicadas (sem sobrecarga: mesma assinatura ou nome novo), em 3 migrations aditivas, **nenhum DROP**; e ligar a venda do passe em produção.

**Duas correções ao que se supunha antes de ler o código:**

1. **A taxa não é "fixa por ingresso".** Hoje é **2,5% do preço** (`ticketeria_taxas`: 250 pontos-base, fixo zero, paga o produtor; D13 e D14 do plano). O campo fixo existe e vale zero. "Uma taxa por passe ou por sessão" só importa se o dono criar um valor fixo por ingresso; com porcentagem é uma conta só, sobre o preço do passe.
2. **O Começar já cria o ingresso por dia** (setor "Geral" e ingressos Inteira e Meia por praça: `fn_ticketeria_comecar_pracas`).

## 2. O que existe hoje (conferido nas migrations e no código)

| Peça | Como é hoje | Onde |
|---|---|---|
| Pedido | Uma sessão: `sessao_id uuid not null`; `total = taxa + produtor`; situação `aguardando_pagamento`, `pago` ou `cancelado`; reserva com prazo (`reservado_ate`) | `20261119033509_ticketeria_pagamentos` |
| Item do pedido | Um lote de um ingresso (tipo), quantidade de 1 a 50, preço e taxa por unidade | idem |
| Estoque | O lote tem `quantidade` **por sessão**; `fn_ticketeria_ocupados(sessao, lote, fora)` soma itens de pedidos pagos ou reservados **daquela sessão**. A vitrine lê essa função por RPC, então **não há uma segunda cópia da regra em TypeScript** | idem; `lib/ticketeria/vitrine-servidor.ts` |
| Lotação do setor | `fn_ticketeria_conferir_lugares`: a soma das quantidades dos lotes dos ingressos do evento no setor não passa dos lugares do setor | `20261119011007_ticketeria_catalogo` |
| Ingresso (tipo) | Pertence a **evento + setor**; o setor pertence a um local. `categoria` só aceita inteira, meia, social, gratuito, cortesia, outra. Não há nada acima de "evento" (passe, pacote, temporada) | idem |
| Reserva | Cadeia: `fn_ticketeria_reservar` → `_com_cupom` → `_com_lugares` (a de fora é a que o servidor chama) | pagamentos, cupons, assentos_compra |
| Ingresso emitido | Um por unidade comprada: `sessao_id not null`, código de 10 letras, `usado_em`, `cancelado_em`, `assento_rotulo`. Emitido por gatilho quando o pedido vira pago (`fn_ticketeria_emitir_ingressos`, idempotente) | `20261119290000`, `20261121100000` |
| Porta | `fn_ticketeria_conferir_ingresso(loja, sessao, codigo, usuario)`: trava o ingresso e marca como usado; já responde `outra_sessao` ("Não vale nesta sessão"), `ja_usado`, `cancelado`, `nao_encontrado` | `20261121200000_ticketeria_assentos_porta` |
| Repasse | `fn_ticketeria_saldo_liberavel` junta o pedido à **sessão do pedido** (`p.sessao_id`) e libera às 18h do dia seguinte ao fim da sessão, nunca antes de 7 dias da venda | `20261119250000`, `20261119270000` |
| Reembolso | Do **pedido inteiro**: estorno total, cancela todos os ingressos emitidos do pedido, recusa (vai à fila de análise) se algum ingresso foi usado | `20261119310000`, `20261125300000` |
| Razão e conciliação | Partidas dobradas **por pedido**; o aviso do Asaas chega por pedido | `ticketeria_transacoes`, `ticketeria_partidas` |
| Lugar numerado | `ticketeria_pedido_assentos` tem `sessao_id` e `unique (pedido_id, fileira, numero)` | `20261121100000` |

## 3. As opções

### A. O passe gera N ingressos emitidos (um por sessão coberta) num só pedido. **Recomendada.**

- O catálogo ganha o tipo "passe" e a lista de sessões que ele cobre.
- O pedido do passe é de **uma sessão âncora** (a primeira coberta) e guarda a **última** coberta (`sessao_fim_id`) para o repasse.
- Ao pagar, emite-se um ingresso por sessão coberta, por unidade comprada, todos com o mesmo `passe_grupo`.

### B. Um pedido com várias sessões.

Tirar o `not null` de `pedidos.sessao_id` e criar `ticketeria_pedido_sessoes`. **Rejeitada:** todo leitor de `pedidos.sessao_id` passaria a ter regra dupla (estoque, confirmação do pagamento, repasse, cupom, webhooks, o modelo de vendas, divulgação, público, envios, Vendas). É a mudança mais larga, e a mais fácil de errar com dinheiro.

### C. Um QR só (credencial), com uma tabela de usos por sessão.

Um único ingresso com um único código, e a porta registra o uso por sessão. Mais bonito para o comprador, mais mudança na porta. **Vira a fase 2 da A** (seção 5), sem desfazer nada da A.

### O que cada uma muda

| | A (recomendada) | B | C |
|---|---|---|---|
| **Pedido** | Continua com 1 sessão (âncora) + `sessao_fim_id` | Várias sessões por pedido | Continua com 1 sessão |
| **Reserva e estoque** | Lote de passe com `quantidade` = nº de passes; `fn_ticketeria_ocupados` conta o passe em todas as sessões cobertas | Ocupados passa a olhar a ponte | Igual à A |
| **Lotação** | Reserva separada: oferta do setor = lotes por sessão dos ingressos de dia + lotes de passe | Igual | Igual |
| **Lugar numerado** | v1 não vende passe em setor numerado | Igual | Igual |
| **Porta** | **Não muda.** Cada filho é um ingresso de uma sessão | Não muda | Ramo novo: código de passe acha o filho da sessão lida |
| **Preço e taxa** | Item com o passe como `ingresso_id`; 2,5% do preço do passe, uma só | Igual | Igual |
| **Reembolso** | Pedido inteiro; cancela os N filhos; dia já usado cai na análise | Igual | Igual |
| **Conciliação** | Nada muda (por pedido) | Nada muda | Nada muda |
| **Relatórios** | "Lugares ocupados" passa a contar emitidos válidos; passe em linha própria | Reescrever tudo por sessão | Igual à A |

## 4. Como a A funciona, ponto por ponto

### 4.1 Estoque e lotação

- O passe tem **lote próprio** com `quantidade` = número de passes (global, **não por sessão**). Cada passe vendido consome **1 lugar em cada sessão coberta**.
- **Reserva separada** (o passe não divide o estoque do dia): `fn_ticketeria_conferir_lugares` passa a somar `Σ lotes por sessão dos ingressos de dia + Σ lotes de passe` e isso tem que caber nos lugares do setor. Resultado: em qualquer sessão, `dia vendido + passes vendidos ≤ lugares`. Nunca vende demais e **não há trava entre tipos** (um tipo não espera o outro).
- **Custo:** passe que não vendeu não vira ingresso de dia. O produtor ajusta o lote do passe para devolver lugares.
- O passe cobre só algumas sessões (por exemplo, fim de semana, 2 de 3 dias)? A conta de lotação continua **conservadora** (reserva o lugar do passe no setor inteiro). Aceitável para a v1.
- **Reserva e prazo:** uma reserva só, de 15 minutos, cobre todos os dias (o passe é um item do pedido).

### 4.2 Lugar numerado

**v1: sem passe em setor numerado** (o banco recusa: `passe_em_setor_numerado`). Um passe com lugar fixo precisaria do **mesmo assento em N sessões**, e `ticketeria_pedido_assentos` tem `unique (pedido_id, fileira, numero)`, que teria de virar `(pedido_id, sessao_id, fileira, numero)`. Trocar essa constraint é DROP: fica para depois, com "sim". Festival costuma ser lugar livre, então o corte é pequeno.

### 4.3 Compra e emissão

- Função **nova** `fn_ticketeria_reservar_com_passe`, com **outro nome** (sem parâmetro novo e sem sobrecarga: uma sobrecarga quebra o PostgREST com PGRST203, como já aconteceu). Ela chama a cadeia de sempre com `p_sessao` = a primeira sessão coberta, depois grava `sessao_fim_id` e confere que o pedido de passe **não mistura** com ingresso de dia (v1: "ou passe, ou dia", no mesmo padrão dos pedidos de hoje).
- O passe é vendido **até o início da primeira sessão coberta** (a regra de hoje, `inicio <= now()`, vale para a âncora).
- `fn_ticketeria_emitir_ingressos(p_pedido)` (mesma assinatura, corpo novo) emite, **por unidade de passe**, um ingresso por sessão coberta, com o mesmo `passe_grupo`. Continua idempotente (se já há emitido do pedido, não faz nada). O e-mail e a página do pedido listam **todos os dias**.
- Cupom: o cupom por link vale como hoje (`fn_ticketeria_aplicar_cupom` trabalha por item). Um cupom sem `ingresso_id` passaria a valer também no passe: decidir se queremos isso (seção 6).

### 4.4 Na porta

- **Não muda na v1.** Cada filho é um ingresso de **uma** sessão.
- Ler no dia 2 o QR do dia 1: já dá **"Não vale nesta sessão"** e diz de qual é (código pronto, `outra_sessao`). Ler o QR do dia certo: **"Pode entrar"**, marca só aquele dia.
- **"Passe já usado em outra sessão" não é um problema**: usa-se por dia, e o uso do dia 1 não consome o dia 2.
- A contagem "entraram de válidos" por sessão continua certa (cada passe vale 1 ingresso por sessão coberta).
- A página do pedido agrupa os dias num cartão **"Passe · 3 dias"** e destaca o QR de hoje. O rótulo "Passe · dia 2 de 3" aparece também na Porta (só texto, sem mudar a conferência).
- Busca por nome e desfazer entrada funcionam como estão (cada filho tem código próprio).

### 4.5 Preço e taxa

- O item do pedido é o **passe** (um `ingresso_id` com `passe = true`) e um lote. O preço do passe é livre (o produtor decide; a tela pode mostrar "os 3 dias separados somam R$ X").
- **Taxa = 2,5% do preço do passe, uma só por passe** (o comprador paga uma vez; o Asaas cobra o Pix por cobrança). Se um dia existir **taxa fixa por ingresso**, a regra proposta é **uma por passe**, não uma por sessão. Registrar a decisão quando surgir.
- O razão (partidas dobradas) **não muda**: um pedido, uma transação.

### 4.6 Repasse (o ponto crítico)

- `fn_ticketeria_saldo_liberavel` passa a usar `coalesce(p.sessao_fim_id, p.sessao_id)`: o passe só libera depois da **última** sessão coberta (mesma regra de hoje: 18h do dia seguinte ao fim, no fuso do local, nunca antes de 7 dias). A regra "sessão cancelada não libera" passa a olhar a sessão do fim.
- É troca do corpo do **cadeado**: exige "sim", testes pgTAP novos (passe liberando só depois da última sessão) ao lado dos de `supabase/tests/ticketeria_validacao_saque.test.sql`, e o espelho TypeScript em `lib/ticketeria/vendas.ts`.
- **Ordem obrigatória:** essa migration tem que estar aplicada **antes** de a venda do passe ligar. A rota de compra do passe fica atrás de uma trava até lá.

### 4.7 Reembolso (passe e ingresso avulso)

- **Ingresso avulso:** como hoje (pedido inteiro, estorno total).
- **Passe:** é um pedido, então o reembolso por e-mail ou pela página do pedido **estorna o passe inteiro e cancela todos os filhos**. Se **algum dia já foi usado**, vale a regra atual de "ingresso usado": cai na fila de análise, sem estorno automático.
- **Fora da v1:** devolver só os dias não usados. Exige **estorno parcial**, que segue como pergunta aberta (D5).
- **Sessão cancelada com passe vendido:** na v1 trata-se à mão, com a regra proposta **"devolve o passe inteiro"** (decisão do dono, seção 7).

### 4.8 Conciliação

Nada muda: o aviso do Asaas e o razão são por pedido. O que muda é a leitura: cada passe deixa **1 pedido e N ingressos emitidos**, e o `passe_grupo` liga os N.

### 4.9 Relatório de bilheteria (Vendas) e outros leitores de `pedidos.sessao_id`

- **Vendas por sessão:** "lugares ocupados" passa a contar **ingressos emitidos válidos da sessão** (inclui os filhos dos passes). A **receita do passe** aparece numa linha própria, **"Passes"** (não é rateada entre as sessões no razão).
- **Modelo de vendas (MMM)** (`lib/ticketeria/modelo-servidor.ts`) e **divulgação por origem** (`divulgacao-servidor.ts`): na v1 **excluem o passe**, para não distorcer a primeira sessão (o passe entraria todo no dia âncora). Ficam anotados como pendência.
- **Webhooks** (`20261123200000`): o aviso de "venda paga" ganha campos **aditivos** (`passe`, lista de sessões); quem já recebe não quebra.
- **Público e envios** (`publico-servidor.ts`, `envios-servidor.ts`): o comprador de passe entra na sessão âncora. O segmento "quem comprou para a sessão X" deve usar os ingressos emitidos; ajustar junto com o relatório.

## 5. Fase 2, opcional: um QR só

Tabela `ticketeria_passes_emitidos` (um código por passe, `passe_grupo`, pedido) e um ramo no `fn_ticketeria_conferir_ingresso`: se o código não é de um ingresso emitido, procura o **passe**, acha o **filho da sessão que a porta está lendo** e marca só esse. Nada da A é desfeito; os filhos continuam existindo, com códigos próprios (úteis para busca e desfazer). Código novo tem que ser sorteado conferindo as **duas** tabelas, para nunca colidir.

## 6. O que é incerto

- **Quantos passes por padrão.** O 20% dos lugares é palpite; o produtor ajusta depois.
- **Vender passe depois que o dia 1 começou** (o "passe do que resta"). v1 não vende.
- **Meia-entrada no passe.** Sem meia na v1. Se a cota de 40% da Lei 12.933 conta os passes, é pergunta para o advogado.
- **Cupom no passe.** Um cupom "para todos os ingressos" passaria a valer no passe. Decidir se vale ou se o cupom precisa dizer que serve para passe.
- **Sessão cancelada com passe vendido.** A devolução do passe inteiro é a proposta; o proporcional exige estorno parcial.
- **Estorno parcial no Asaas** (a pergunta aberta da D5): só devolve a taxa quando o estorno é total.
- **Reserva separada para o passe**: o produtor aceita decidir quantos passes? Se não aceitar, o caminho seria o passe dividir o estoque do dia, que pede travar vários lotes em ordem fixa (mais código e mais chance de deadlock).
- **QR único desde já?** Se o dono quiser, a fase 2 entra junto (mais uma migration e mais uma troca de função: `fn_ticketeria_conferir_ingresso`).
- **Mesmo local:** o passe só cobre sessões do **mesmo local** (o ingresso pertence a um setor, e o setor a um local). Turnê (vários locais) fica fora; passe de **temporada** (vários eventos) pede uma camada acima de "evento", que não existe.

## 7. Plano de migrations (nenhuma escrita nem aplicada)

Todas **aditivas** (colunas anuláveis, tabela nova e vazia, funções novas, ou troca de corpo com a **mesma assinatura**), **reaplicáveis** e **sem DROP**. Funções novas só para `service_role`, com `revoke` de `public`, `anon` e `authenticated` (como as de hoje). Tabela nova com RLS igual à das tabelas do catálogo (`auth_ticketeria_pode`). Mecânica da Ticketeria: aplicar **pela CLI do Supabase** (o conector recusa DROP e DELETE), renomear o arquivo para a versão gravada, tudo no PR único #499, e só typecheck e testes da parte mexida aqui (o build do Next roda no GitHub).

| # | Migration | O que faz | Precisa do "sim" |
|---|---|---|---|
| 1 | `ticketeria_passe_catalogo` | `ticketeria_ingressos.passe boolean not null default false`; tabela `ticketeria_passe_sessoes (ingresso_id, sessao_id, organization_id)`; gatilho de coerência (passe só em setor não numerado, só sessões do mesmo evento e do mesmo local do setor, não se tira sessão que já tem venda); corpo novo de `fn_ticketeria_conferir_lugares` (mesma assinatura) | **Sim:** troca corpo de função publicada |
| 2 | `ticketeria_passe_pedidos` | `ticketeria_pedidos.sessao_fim_id` e `ticketeria_ingressos_emitidos.passe_grupo` (anuláveis); corpo novo de `fn_ticketeria_ocupados` (mesma assinatura: lote de passe conta em todas as sessões) e de `fn_ticketeria_emitir_ingressos` (mesma assinatura); função **nova** `fn_ticketeria_reservar_com_passe` | **Sim:** estoque e emissão |
| 3 | `ticketeria_passe_liberacao` | Corpo novo de `fn_ticketeria_saldo_liberavel` (o cadeado), com pgTAP novo | **Sim, o mais sensível.** Aplicar **antes** de ligar a venda |
| 4 | (só TypeScript, sem migration) | Rota de compra do passe atrás de trava; vitrine (preço e "quantos sobram" do passe); página do pedido (cartão "Passe · 3 dias"); e-mail; Vendas; rótulo na Porta; webhooks; testes | Telas só com imagens aprovadas pelo dono |
| 5 | Fase 2: `ticketeria_passes_emitidos` | QR único + ramo no `fn_ticketeria_conferir_ingresso` | **Sim**, se o dono quiser |

**Mudar função publicada sem sobrecarga:** a regra é **nunca acrescentar parâmetro a uma função existente** (isso cria outra assinatura ao lado e o PostgREST responde PGRST203). Ou o corpo muda com a **mesma assinatura** (itens 1 a 3), ou nasce uma função com **outro nome** (`fn_ticketeria_reservar_com_passe`, `fn_ticketeria_comecar_com_passe`).

**Pede o "sim" do dono, resumindo:**

1. As quatro trocas de corpo: `fn_ticketeria_conferir_lugares`, `fn_ticketeria_ocupados`, `fn_ticketeria_emitir_ingressos` e (a mais sensível) `fn_ticketeria_saldo_liberavel`.
2. Nenhum DROP na v1. O passe com lugar numerado (trocar a constraint) e a retirada das funções antigas do Começar exigiriam.
3. A permissão para ligar a venda do passe em produção (depois da migration 3 aplicada e provada, e do ensaio com o Asaas em sandbox).

**Ordem de segurança:** 1 → 2 → 3 → trava da compra aberta. Antes disso, nada vende passe.

## 8. O Começar: "Tem passe?"

Hoje, no perfil **festival**, o Começar pergunta nome, onde, quando começa (as datas, seguidas ou alternadas), horário, lugares numerados ou não, lugares, e (se pago) o preço e a meia. Proposta:

- **Quando aparece:** perfil **festival**, **2 ou mais datas**, setor **não numerado**, ingresso **pago**. Nos outros perfis (espaço, turnê, evento único) não aparece.
- **Pergunta 1:** *"Vai ter passe para todos os dias?"* (Sim / Não).
- **Pergunta 2 (se sim):** *"Quanto custa o passe?"*, com a dica *"Os N dias separados somam R$ X"*.
- **Quantos passes:** **não pergunta.** Reserva **20% dos lugares** e diz isso em uma frase ("Vamos separar N lugares para o passe; você muda depois"). A Inteira diminui na mesma proporção, para a oferta caber nos lugares.
- **Função:** nova, `fn_ticketeria_comecar_com_passe` (outro nome). Ela chama `fn_ticketeria_comecar_pracas`, reduz o lote da Inteira (reduzir nunca trava a regra de lotação) e cria o ingresso `passe` com todas as sessões da praça, num lote de preço livre. Segue tudo-ou-nada, como a de hoje.

**Fica para depois:**

- passe na turnê (vários locais), no espaço e no evento único;
- meia no passe;
- passe com lugar numerado;
- passe de só alguns dias (o editor do evento cobre depois);
- tela do produtor para editar o passe, a quantidade e as sessões cobertas;
- passe entre eventos diferentes (temporada, assinatura);
- passe do dia restante (comprar com o festival já começado);
- reembolso parcial do passe.

## 9. As decisões que só o dono toma

1. **Um QR por dia ou um QR só?** Começar com o passe mostrando **um cartão com os 3 dias** (um QR por dia, destaque no de hoje) é o caminho barato e seguro, sem mexer na porta. **Um QR único** é mais bonito e entra como fase 2.
2. **Os passes têm estoque separado do dia?** Recomendo que **sim** (nunca vende demais, sem trava entre tipos). O custo é o produtor decidir quantos passes ele quer; o Começar sugere 20% dos lugares.
3. **O dinheiro do passe só sai depois do último dia, e, se um dia for cancelado ou o comprador pedir reembolso do passe, devolve-se o passe inteiro** (o parcial espera o estorno parcial). Isso exige **trocar a função do cadeado do repasse**: precisa do "sim" dele antes de aplicar.
