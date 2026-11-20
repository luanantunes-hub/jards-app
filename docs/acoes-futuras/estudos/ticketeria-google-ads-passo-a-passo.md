# Google Ads na Divulgação da Ticketeria: o que ligar do lado do Google (20/11/2026)

O código do conector (aba **Conexões** da Divulgação, cartão **Google Ads**) usa o mesmo desenho do Meta Ads: só **leitura**, token no Vault do Supabase, escolha da conta de anúncios, primeira leitura do último ano e depois, todo dia, os últimos 7 dias (o mesmo Vercel Cron). O botão **Conectar** só aparece depois que as credenciais do Google estiverem na Vercel; sem elas o cartão mostra "Em breve".

## O que o Jards faz
- Permissão pedida: só `https://www.googleapis.com/auth/adwords` (Google Ads). Nada de Gmail nem Agenda.
- Guarda o token de **renovação** (não vence sozinho; só deixa de valer se o produtor retirar o acesso, ou em 7 dias se o app do Google ainda estiver "em teste"). A cada leitura troca por um token de acesso de 1 hora.
- Lê o gasto, as impressões e os cliques por dia (o Google Ads não dá alcance nessa consulta). Contas de uma conta **gerente (MCC)** aparecem na escolha e são lidas pelo cabeçalho `login-customer-id`. Só conta em **real (BRL)** por enquanto.
- Canal do gasto no banco: `google-ads` (o do Meta passou a `meta-ads`).

## O que só o dono do Jards faz
1. Google Cloud: criar um projeto **separado** (recomendado: "Jards Marketing", para não misturar com a verificação do Gmail) e ativar a **Google Ads API**.
2. Tela de consentimento OAuth: nome do app, logo, e-mail de suporte, **página inicial pública** e **política de privacidade no mesmo domínio**; adicionar o escopo do Google Ads.
3. Cliente OAuth do tipo "Aplicativo da Web" com o URI de redirecionamento: `https://jards.com.br/api/ticketeria/conexoes/google/retorno` (igual, letra por letra).
4. Vercel (produção): `GOOGLE_MARKETING_CLIENT_ID` e `GOOGLE_MARKETING_CLIENT_SECRET` (e `CRON_SECRET`, que já serve ao Meta). Opcional: `GOOGLE_ADS_API_VERSION` (ex.: `v26`; vale o padrão se faltar).
5. **Verificação**: da marca (automática, minutos) e do uso do escopo (até ~10 dias; pede um vídeo de demonstração no YouTube mostrando o login e o gasto aparecendo na aba Conexões). Sem ela, o app mostra o aviso de "app não verificado" e tem limite de usuários.
6. **Nível de acesso da API**: pedir o nível **Básico** no projeto (a revisão é automática depois da verificação da marca; o Padrão, com auditoria de cerca de 10 dias úteis, é para ferramentas que atendem muitos usuários). O token de desenvolvedor foi descontinuado em 09/09/2026: o nível é do projeto.
7. Até a verificação sair: só usuários de teste do app (lista na tela de consentimento) conseguem conectar, o que basta para testar com a conta do próprio dono.

## A conferir com uma resposta real (as páginas oficiais lidas em 20/11 não cobrem)
- O endereço de listar as contas acessíveis (`customers:listAccessibleCustomers`) e o formato da resposta.
- Os campos da consulta (`segments.date`, `metrics.cost_micros`, `customer.currency_code`) e que `cost_micros` é milionésimo da moeda (o código divide por 10.000 para dar centavos).
- A versão da API (as páginas citam v26; o padrão aqui é v26).

---

# Google Analytics 4 (as visitas ao site), na mesma conta do Google (20/11/2026)

O cartão **Google Analytics 4** (grupo "Site e redes" da aba Conexões) usa o **mesmo cliente OAuth e o mesmo endereço de retorno** do Google Ads (`https://jards.com.br/api/ticketeria/conexoes/google/retorno`; o cookie do login diz qual dos dois abriu). Não traz gasto: traz as **visitas por dia e por origem** ("instagram / social"), que servem de variável do modelo e para saber quantos visitantes viram a compra.

## O que o Jards faz
- Permissão pedida: só `https://www.googleapis.com/auth/analytics.readonly` (leitura do Analytics), numa autorização separada da do Google Ads (o produtor escolhe conectar um, o outro ou os dois).
- Lê, por dia e origem (`sessionSourceMedium`): sessões e usuários. Primeira leitura: o último ano; depois, todo dia os últimos 7 dias (o mesmo Vercel Cron).
- O GA4 só enxerga origens marcadas com `utm_*`. Por isso o link de divulgação criado na aba Divulgação passou a levar também `utm_source` (o canal), `utm_medium=divulgacao` e `utm_campaign` (a ação), além do `?canal=` e do `?acao=` que o Jards já lia. Os links de e-mail de divulgação seguem como estavam.
- Reconhece o canal da origem (Instagram, WhatsApp, Google, e-mail, direto) e guarda o resto como "outros".

## O que a mais só o dono do Jards faz
1. No projeto do Google Cloud, ativar também a **Analytics Data API** e a **Analytics Admin API**.
2. Na tela de consentimento, adicionar o escopo `analytics.readonly` (a verificação cobre os dois escopos; o vídeo de demonstração deve mostrar também a aba Conexões com as visitas).
3. Nada de variável nova na Vercel: o GA4 usa `GOOGLE_MARKETING_CLIENT_ID` e `GOOGLE_MARKETING_CLIENT_SECRET`.
4. Dizer qual propriedade do GA4 sua serve para testes (o produtor precisa ter acesso à propriedade).

## A conferir com uma resposta real
O formato de `accountSummaries` (propriedades) e de `runReport` com `date` e `sessionSourceMedium`; e se o escopo `analytics.readonly` é tratado como sensível na verificação.
