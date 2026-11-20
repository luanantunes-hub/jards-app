# Ticketeria: o que falta para vender o primeiro ingresso

Escrito em 19/11/2026, depois de a parte de código estar na main. **O módulo está pronto e escondido dos clientes; nada vende ainda.** Tudo abaixo é o que **só você faz** (configuração) ou o que **só se prova com o Asaas de verdade**. A ordem importa: de cima para baixo.

## 1. Variáveis na Vercel (produção)

| Variável | Para quê | Estado |
|---|---|---|
| `ASAAS_VALIDACAO_SAQUE_TOKEN` | o token do cadeado do repasse (o Asaas manda no cabeçalho quando pergunta se um saque pode sair) | **já está** |
| `ASAAS_API_KEY` | a chave da conta PRINCIPAL do Asaas (cadastra subcontas, recebe os avisos) | falta |
| `ASAAS_WEBHOOK_TOKEN` | o token do aviso de pagamento (32 a 255 letras, sem espaço e **sem mais de 4 caracteres iguais seguidos**: o Asaas recusa; o mesmo que você põe no webhook do painel) | falta |
| `ASAAS_WALLET_JARDS` | o `walletId` da conta principal: para onde vai a comissão de 2,5% | falta (sem ela a compra responde "vendas pausadas") |
| `ASAAS_AMBIENTE=producao`, `ASAAS_URL` (a base da API com `/v3`) e `TICKETERIA_DINHEIRO_REAL=sim` | as **três travas** do dinheiro real. Sem as três juntas o sistema fica no sandbox. **Só depois do piloto (seção 5).** | falta, de propósito |
| `TICKETERIA_EMAIL_DE_REEMBOLSO` | o endereço que o comprador usa para pedir reembolso (aparece nos termos, no ingresso e no e-mail). Padrão: `luan.antunes@jards.com.br` | opcional |
| `TICKETERIA_EMAIL_DE_ALERTA` | para onde vão os avisos de reembolso que precisam de gente. Padrão: `luan.antunes@jards.com.br` | opcional |
| `RESEND_API_KEY`, `TRANSACTIONAL_EMAIL_FROM` | o e-mail transacional (ingressos, reembolso, avisos) | já usados pelo resto do Jards: conferir |
| `RESEND_WEBHOOK_SECRET`, `NEXT_PUBLIC_PRESTACAO_EMAIL_DOMINIO` | o recebimento de e-mail (o reembolso chega pelo mesmo webhook da prestação) | já usados: conferir |

Nunca cole chave no chat: `vercel env add NOME production` no terminal (a CLI já está logada neste Mac). A chave do **sandbox** colada no chat no começo do trabalho deve ser **revogada** (Integrações, Chaves de API) assim que a prova do passo A rodar.

## 2. No painel do Asaas

1. **Habilitar o Split** na conta principal (token por SMS). Feito no sandbox; falta repetir na conta de produção.
2. **Validação de saque por webhook** (Integrações > Mecanismos de segurança): URL `https://jards.com.br/api/ticketeria/validacao-saque/asaas`, token igual a `ASAAS_VALIDACAO_SAQUE_TOKEN`. **Não marcar** "validar saques via interface". A "autorização para splits" pode ficar ligada: o cadeado aprova a divisão para a carteira do Jards (`ASAAS_WALLET_JARDS`, a comissão, **obrigatória** para ela ser aprovada) e recusa divisão para qualquer outra carteira. É o cadeado: sem ele o produtor saca antes do evento. Feito no sandbox; falta na produção.
3. **Webhook de aviso de pagamento** da conta principal: URL `https://jards.com.br/api/ticketeria/avisos/asaas`, token igual a `ASAAS_WEBHOOK_TOKEN`, eventos de pagamento recebido e confirmado, estorno e chargeback.
4. **O aviso de pagamento de uma SUBCONTA** (as cobranças nascem nas subcontas): **vai para o webhook da própria subconta, não para o da principal** (provado no sandbox em 20/11/2026). O cadastro da subconta cria esse webhook sozinho (mesmo endereço e mesmo token do da principal; e-mail de `TICKETERIA_EMAIL_DE_ALERTA`) e o resultado do cadastro traz `webhook: criado | pendente`: `pendente` quer dizer que os pagamentos daquela subconta não chegam sozinhos e é preciso refazer.
5. **Subcontas em produção:** o período de avaliação do Asaas permite 10 subcontas, de R$ 2.000 cada, por 60 dias, e a conta-pai precisa ser **CNPJ**. Confirmar com o comercial o prazo e os documentos da aprovação de cada subconta, e se a subconta recebe Pix antes de aprovada.

## 3. No e-mail (Resend)

- **Encaminhar** o endereço público de reembolso para `reembolso@<domínio de recebimento do Resend>` (ou trocar `TICKETERIA_EMAIL_DE_REEMBOLSO` por esse endereço). O Resend só recebe o que chega ao domínio dele; sem isso, o pedido de reembolso do comprador nunca chega ao sistema.
- O webhook `email.received` do Resend já aponta para `/api/email/entrada` (o da prestação): o reembolso usa o mesmo, não precisa de outro.

## 4. A prova com o Asaas de verdade (passo A)

O sandbox limita a **20 subcontas por dia**; em 19/11 a conta já tinha 21 (as chaves das antigas não se recuperam), e duas tentativas foram recusadas. **Depois da meia-noite**, escreva "pode rodar o passo A": o roteiro está em `ticketeria-roteiro-da-prova-do-cadeado.md`, cria **uma** subconta e prova:

- os saques do cadeado (aprovado, retido, outra conta);
- **onde chega o aviso de pagamento da subconta** (seção 2, item 4);
- e, na mesma subconta, o que nunca foi provado: **o Pix com divisão da comissão**, **o cartão** (a cobrança `CREDIT_CARD` e o que o aviso traz: `netValue`) e **o estorno com o cadeado ligado** (o `splitRefunds`, e se o Asaas pergunta algo além de `PIX_REFUND`).

Também falta **testar a câmera da Porta num celular** (a leitura do QR Code só foi provada na lógica e nas telas) e **abrir `/ingressos/vendas`, `/ingressos/porta` e o editor do site logado** (as telas só foram vistas em imagens geradas por fora, nunca logado).

## 5. O piloto de baixo valor (antes de ligar o dinheiro real)

Com as três travas **ainda desligadas**, rode uma venda inteira no sandbox: criar o evento, a conta de recebimento, publicar, comprar pelo link (Pix e cartão), ver os ingressos, ler na Porta, pedir reembolso por e-mail. Só então, com **um evento real de ingresso barato** e um produtor de confiança, ligue as três travas. Depois do primeiro evento, confira a conciliação (o razão fecha em zero) antes de abrir para mais produtores.

## 6. Decisões que ainda são suas

- **Parcelamento no cartão:** está **desligado** (`PARCELAMENTO_LIBERADO = false` em `compra.ts`). O Asaas manda um aviso por parcela e o sistema ainda não os soma. Para liberar: somar as parcelas, provar no sandbox e ligar. A tela já está pronta.
- **Acesso da equipe da porta:** hoje só quem **edita a Ticketeria** confere ingressos. Se a equipe da porta não deve ver o resto (vendas, repasse), é preciso um acesso só de conferência (um papel novo). Diga se quer.
- **Prazo para o dinheiro do reembolso aparecer:** os termos dizem "depende do seu banco". O número de dias úteis do Asaas segue pendente.
- **Texto dos Termos de compra:** aprovado em 19/11; a versão gravada em cada pedido é `2026-11-19`. Mudar o texto é mudar a versão (`lib/ticketeria/termos-de-compra.ts`).
- **Reenvio automático dos reembolsos que falham:** hoje há o botão "Tentar de novo" na tela Vendas e o aviso por e-mail ao Jards. Reenviar sozinho exigiria um agendador (o projeto não tem um para esta parte) e, na maioria dos casos, a falha precisa de uma pessoa (por exemplo, saldo na conta do produtor).

## 7. O que já está pronto (na main)

Loja e site do produtor com o bloco de ingressos; eventos, sessões, locais, catálogo e lotes; compra pelo link (`/comprar/{sessão}`) com Pix e cartão à vista, reserva de 15 minutos e aceite dos Termos; ingressos com QR Code e e-mail; tela Vendas (resumo, sessões, compras, reembolsos); Porta; reembolso por e-mail com estorno automático e fila; cadeado do repasse; cadastro da subconta e tela Recebimentos; troca da conta de saques com código por e-mail e 24 horas de espera; razão imutável. O plano com todas as decisões e o andamento está em `plano-modulo-ticketeria.md`.
