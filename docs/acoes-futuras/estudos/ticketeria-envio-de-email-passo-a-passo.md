# Envio de e-mail do Público (Ticketeria): como ligar, passo a passo

Para o dono do Jards, 21/11/2026. **O CRM é do cliente:** cada produtor envia do **domínio dele** (um cliente, um domínio, um endereço), com o nome dele, e paga R$ 32,90 por mês pelo e-mail. O Jards cria e confere o domínio no Resend por trás; o produtor só adiciona os registros de DNS no provedor do domínio dele e nunca entra no Resend. Não existe mais remetente único do Jards (a variável `TICKETERIA_NOVIDADES_EMAIL_FROM` saiu).

O envio nasce **desligado**: nada sai até os passos 1 a 4.

## 1. A chave do Resend (uma conta só, a do Jards)
1. Resend → **API Keys**. A chave de envio (`RESEND_API_KEY`) já existe. Para **criar domínios** a chave precisa de **acesso total**: crie uma chave de acesso total e ponha na Vercel como `RESEND_DOMAINS_API_KEY` (ou troque a `RESEND_API_KEY` por uma de acesso total).
2. **Limite de domínios do plano:** o plano Pro do Resend aceita 10 domínios; acima disso é preciso o plano Scale (1.000 domínios) ou falar com eles. Cada loja que ativa o e-mail usa **um** domínio, não importa quantos e-mails mande. Confira o plano antes de abrir para muitos clientes.
3. Resend → **Domains**: o domínio **não** precisa ser criado à mão. O Jards cria quando o produtor o escolhe.

## 2. O preço no Stripe (R$ 32,90 por mês)
1. Stripe → **Produtos** → novo produto "E-mail da Ticketeria", preço **recorrente mensal de R$ 32,90**, só cartão. (Criar produto exige a chave com permissão de gravar produtos, ou faça no painel.)
2. Copie o id do preço (`price_...`) e crie na Vercel a variável `STRIPE_PRICE_TICKETERIA_EMAIL`.
3. Stripe → **Desenvolvedores → Webhooks** → **Adicionar endpoint**: `https://jards.com.br/api/ticketeria/stripe-eventos`, eventos `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copie o **Signing Secret** (`whsec_...`) e crie na Vercel a variável `STRIPE_WEBHOOK_SECRET_TICKETERIA_EMAIL`. **É um endpoint e um segredo próprios**, separados do webhook do plano e da prestação de contas.

## 3. Avisos de abriu, clicou, devolveu e reclamou (webhook do Resend)
1. Resend → **Webhooks** → **Add Endpoint**: `https://jards.com.br/api/ticketeria/resend-eventos`
2. Eventos: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`.
3. Copie o **Signing Secret** e crie na Vercel `TICKETERIA_RESEND_WEBHOOK_SECRET`. **É outro segredo**, diferente do `RESEND_WEBHOOK_SECRET` do webhook de e-mails recebidos. Sem ele a rota responde 503 e nada é gravado. Um endpoint só serve a todos os domínios das lojas.
4. A leitura de **abertura e clique** por domínio o Jards liga sozinho ao criar o domínio.

## 4. Fila de envios grandes (cron)
Crie na Vercel a variável `CRON_SECRET` (qualquer texto longo e secreto; a Vercel o envia sozinha ao cron). O cron a cada minuto continua os envios que a primeira rodada não terminou, e retoma os que ficaram **pausados** (assinatura em atraso ou domínio fora do ar). O cron só roda em produção, ou seja, depois de **publicar** o site. Republique o site para as variáveis valerem.

## Como é para o produtor (Público → aba E-mail)
1. **Ativar e-mail:** R$ 32,90 por mês no cartão, com o texto de que o valor cobre o custo do provedor. O checkout é do Stripe, com a aparência do Jards; só quem **administra** a organização assina.
2. **Domínio:** o produtor escolhe o domínio (de preferência um subdomínio, como `novidades.seusite.com.br`), o começo do endereço (`ingressos`), o nome que aparece e o e-mail das respostas.
3. **Registros de DNS:** a tela mostra a tabela de registros (tipo, nome, valor) com **Copiar** e um texto pronto para mandar a quem cuida do site. O produtor adiciona no provedor do domínio (GoDaddy, Registro.br, Cloudflare…) e clica em **Verificar agora**; enquanto espera, a tela confere sozinha a cada 30 segundos.
4. **Pronto:** com o domínio verificado e a assinatura ativa, **Novo envio** libera. Dá para **Enviar teste para mim**. A tela mostra os e-mails do mês (cota de 5.000) e **Gerenciar assinatura** (o portal de cobrança do Stripe, onde ele cancela).

## Regras de funcionamento
- **Cota:** 5.000 e-mails por mês por loja, contados desde o início do período da assinatura (a data em que o cartão renova). Um envio que passa do que resta é recusado antes de começar, com a conta na mensagem. O WhatsApp não gasta cota e não é cobrado.
- **Cartão recusado:** a assinatura vira "inadimplente": os envios **pausam** (as pessoas ficam pendentes) e voltam sozinhos quando o pagamento é regularizado.
- **Cancelamento:** continua valendo até o fim do período pago; depois, os envios ficam bloqueados e o histórico continua.
- **Trocar de domínio:** o domínio antigo é apagado no Resend (o limite do plano conta domínios) e o novo precisa ser verificado de novo.
- Um domínio só pode estar em **uma** loja.

## O que a aba Envios mostra
- **Abriram** e **Clicaram**: porcentagem dos enviados e, embaixo, quantas pessoas. Cada pessoa conta uma vez. Quem clica conta também como quem abriu.
- **N voltaram**: e-mails devolvidos pelo provedor do destinatário.
- Devolução **permanente** e **reclamação de spam** colocam o e-mail na lista de saídas da loja: ele não recebe mais nada, como quem clicou em "Sair da lista".

## Cuidados
- **Abertura é número aproximado.** Alguns programas de e-mail (Apple Mail com proteção de privacidade) abrem a mensagem sozinhos e inflam o número. O **clique** e as **vendas pelo link** são mais confiáveis.
- O acompanhamento de clique troca os links por links do Resend; alguns provedores tratam isso com desconfiança. Se a entrega piorar, desligue o Click Tracking no domínio e fique só com as vendas pelo link.
- Remetente novo cai em spam se mandar muito de uma vez: oriente o produtor a começar com poucos envios.
- Os domínios dos clientes ficam todos na **mesma conta do Resend**, mas cada um tem a reputação própria (domínio e DKIM próprios). Uma reclamação grave de um cliente pode levar o Resend a suspender a conta toda: vale acompanhar a taxa de reclamação e devolução.
