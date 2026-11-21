# Envio de e-mail do Público (Ticketeria): como ligar, passo a passo

Para o dono do Jards, 21/11/2026. O envio nasce **desligado**: nada sai até os passos 1 a 3. Os passos 4 e 5 ligam os números de quem abriu e clicou.

## 1. Cadastrar o subdomínio de envio no Resend
1. Resend → **Domains** → **Add Domain**. Use um subdomínio (ex.: `mail.jards.com.br`), não o domínio principal: se uma divulgação cair em spam, o e-mail principal não é afetado.
2. O Resend mostra 3 ou 4 registros de DNS. No GoDaddy (DNS do jards.com.br), **adicione** cada um exatamente como aparece. Não mexa nos registros que já existem (o SPF do Google continua como está).
3. Volte ao Resend e clique em **Verify**. Pode levar de minutos a algumas horas.

## 2. Dizer ao Jards qual é o remetente
Na Vercel (projeto jards-app, Production), crie a variável `TICKETERIA_NOVIDADES_EMAIL_FROM` com o remetente, por exemplo `Jards Ingressos <novidades@mail.jards.com.br>`. Sem ela, o botão "Enviar" da folha Novo envio avisa que o envio não está ligado.

## 3. Primeiro teste
Em **Público → Novo envio**, escreva uma mensagem, clique em **Enviar teste para mim** e confira se chegou na caixa de entrada (não no spam) e se o botão "Sair da lista" abre a página certa. Só depois envie de verdade, para um grupo pequeno.

## 4. Avisos de abriu, clicou, devolveu e reclamou (webhook)
1. Resend → **Webhooks** → **Add Endpoint**.
2. Endereço: `https://jards.com.br/api/ticketeria/resend-eventos`
3. Eventos: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`.
4. Copie o **Signing Secret** (começa com `whsec_`) e crie na Vercel a variável `TICKETERIA_RESEND_WEBHOOK_SECRET`. **É outro segredo**, diferente do `RESEND_WEBHOOK_SECRET` do webhook de e-mails recebidos (prestação de contas e reembolso). Sem ele, a rota responde 503 e nada é gravado.
5. Republique o site na Vercel para a variável valer.

## 5. Ligar o acompanhamento no domínio
No Resend → **Domains** → seu subdomínio, ligue **Open Tracking** e **Click Tracking**. Sem isso o Resend não avisa as aberturas e os cliques.

## 6. Envios grandes (a fila)
- Um envio aceita até **5.000 pessoas**. O Jards cria o envio, responde na hora e manda os e-mails em **lotes de 100**, logo depois; a aba Envios mostra "400 de 1.200" e se atualiza sozinha.
- Se a primeira rodada não terminar (muita gente ou uma queda), um **cron a cada minuto** continua de onde parou. Para ele funcionar, crie na Vercel a variável `CRON_SECRET` (qualquer texto longo e secreto; a Vercel o envia sozinha ao cron). Sem ela o cron responde 503 e só a primeira rodada trabalha, que dá conta de milhares de e-mails na maioria dos casos.
- O cron só roda em produção, ou seja, depois de **publicar** o site.
- Quem ficou "enviando" por mais de 5 minutos (a rodada caiu) volta para a fila sozinho. Duas rodadas ao mesmo tempo nunca mandam para a mesma pessoa.

## O que a aba Envios passa a mostrar
- **Abriram** e **Clicaram**: porcentagem dos enviados e, embaixo, quantas pessoas. Cada pessoa conta uma vez. Quem clica conta também como quem abriu.
- **N voltaram**: e-mails devolvidos pelo provedor do destinatário.
- Devolução **permanente** e **reclamação de spam** colocam o e-mail na lista de saídas da loja: ele não recebe mais nada, como quem clicou em "Sair da lista".

## Cuidados
- **Abertura é número aproximado.** Alguns programas de e-mail (Apple Mail com proteção de privacidade) abrem a mensagem sozinhos e inflam o número. O **clique** e as **vendas pelo link** são mais confiáveis.
- O acompanhamento de clique troca os links por links do Resend; alguns provedores tratam isso com desconfiança. Se a entrega piorar, desligue o Click Tracking e fique só com as vendas pelo link.
- Comece com poucos envios e cresça aos poucos: remetente novo cai em spam se mandar muito de uma vez.
