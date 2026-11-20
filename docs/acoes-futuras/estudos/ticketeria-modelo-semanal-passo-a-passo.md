# O cálculo semanal do modelo de marketing: o que ligar (20/11/2026)

O modelo (MMM) da Ticketeria é calculado **toda segunda-feira às 06:00 (Brasília)** por um job no GitHub Actions (`.github/workflows/modelo-semanal.yml`, código em `modelo/`). O job **só fala com o Jards**, por três rotas protegidas por um token estreito; ele **nunca recebe a chave do banco**.

## O que o job faz
1. Pede ao Jards as lojas cujos dados já bastam (`GET /api/ticketeria/modelo/prontas`: vendas, gasto e variação do gasto, a mesma checklist da aba Modelo).
2. Para cada loja, baixa a tabela semanal (`GET /api/ticketeria/modelo/lojas/{id}/tabela`), ajusta o modelo (PyMC-Marketing 1.5.0, efeito atrasado e que rende cada vez menos por canal, base com tendência e sazonalidade) e devolve o resultado (`POST …/resultado`).
3. O Jards **confere o resultado de novo** (formato, limites, soma perto de 100%), calcula ele mesmo a confiança e os avisos de margem, e grava de uma vez ou nada. Uma loja que falha não derruba as outras: a frase da falha aparece na aba Modelo e a tela segue mostrando a última rodada boa.

## O que só o dono do Jards faz
1. Criar um **token** (texto aleatório de 32 letras ou mais). Exemplo, no terminal: `openssl rand -hex 24`.
2. **Vercel** (produção): variável `MODELO_TOKEN` com esse valor. Sem ela, as três rotas respondem 503 e nada fica aberto.
3. **GitHub** (Settings > Secrets and variables > Actions > New repository secret): `MODELO_TOKEN` (o mesmo valor) e `MODELO_BASE_URL` (`https://jards.com.br`).
4. Conferir que o repositório pode usar GitHub Actions agendado (Settings > Actions).
5. Para testar à mão: Actions > "Modelo semanal" > Run workflow. Marque "teste_sintetico" para provar o modelo com dados inventados (não fala com o Jards) ou informe o id de uma loja para rodar só ela.

## Custo e limites
- O ajuste leva alguns minutos por loja em CPU (sem GPU). O plano gratuito do GitHub dá 2.000 minutos por mês em repositório privado.
- Quando houver muitos produtores, o mesmo job pode virar um serviço próprio (Cloud Run Jobs ou Modal) sem mudar as rotas.

## Como o modelo foi provado (dados inventados com resposta conhecida)
`python modelo/teste_sintetico.py` gera 90 semanas com 3 canais de efeito conhecido e confere: o modelo converge (r-hat ~1,005, sem divergências), acerta cada canal dentro de 12 pontos (Google 15,4% contra 16,2% verdadeiro; Instagram 4,9% contra 5,1%; Meta 34,6% contra 41,3%), **não inventa efeito** quando o gasto é embaralhado (5% contra 55%) e **alarga a margem** com menos semanas (30 semanas: intervalos duas vezes mais largos). Honestidade: o intervalo de 80% foi **otimista** no canal maior (o verdadeiro ficou fora), por isso a tela diz que o ± costuma ser otimista.
