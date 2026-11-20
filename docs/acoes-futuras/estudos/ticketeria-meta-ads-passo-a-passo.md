# Meta Ads na Divulgação da Ticketeria: o que ligar do lado da Meta (20/11/2026)

O código do conector está no PR "Meta Ads: conexão e leitura diária do gasto". Ele só aparece para o produtor (botão **Conectar**) depois que as credenciais do app da Meta estiverem na Vercel; sem elas o cartão mostra "Em breve".

## O que o Jards faz
- Só **leitura** (`ads_read`): lê gasto, impressões, alcance e cliques por dia da conta de anúncios que o produtor escolher. Nunca cria nem muda anúncio.
- Primeira leitura: o último ano. Depois, todo dia (Vercel Cron, `vercel.json`, 09:00 UTC) refaz os últimos 7 dias, porque a Meta ajusta os números recentes. O botão **Ler agora** faz o mesmo na hora.
- O token do produtor fica no Vault do Supabase (não na tabela). Desconectar apaga o token e guarda o gasto já lido.
- Só conta em **real (BRL)** por enquanto.

## O que só o dono do Jards faz
1. Em developers.facebook.com, criar um app do tipo **Business** e adicionar o produto **Marketing API**.
2. Em "Login do Facebook > Configurações", cadastrar o URI de redirecionamento: `https://jards.com.br/api/ticketeria/conexoes/meta/retorno` (igual, letra por letra).
3. Na Vercel (produção), criar: `META_APP_ID`, `META_APP_SECRET`, `CRON_SECRET` (um texto aleatório de 32+ letras; a Vercel o envia sozinha no cabeçalho do cron). Opcional: `META_GRAPH_VERSION` (ex.: `v25.0`; vale o padrão se faltar).
4. Antes de qualquer produtor de fora conectar: **verificação do negócio** (Business Verification) e **App Review** da permissão `ads_read` (acesso avançado). A gravação de tela do review mostra o login e o gasto/impressões/cliques aparecendo no app (a aba Conexões e Ações e gasto). Exige política de privacidade com endereço público e um endereço para pedidos de exclusão de dados.
5. Enquanto o review não sai: só quem tem papel no app (administrador, desenvolvedor) consegue conectar, o que basta para testar com a conta do próprio dono.

## A conferir com uma resposta real (as páginas oficiais lidas em 20/11 não cobrem)
- Duração do token longo (esperado ~60 dias) e como renovar. Hoje, quando vence, a conexão vai para "Precisa conectar de novo".
- Se `spend` vem em reais (o código lê "5339.5" como R$ 5.339,50).
- Os campos de `/me/adaccounts` (`account_id`, `name`, `currency`, `account_status`).
- A versão da API (as páginas citam v25 e v27).
