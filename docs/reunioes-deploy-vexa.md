# Deploy do Vexa (bot de reuniões) — Vexa Lite no Fly.io

> Estado: infraestrutura do MVP da feature Reuniões. Cobrança por uso (sem VM fixa) — adequado ao volume atual (~10 usuários pagantes). Revisite a decisão de infra quando o volume mensal de reuniões, somado entre todos os clientes, passar de ~25-30h/mês — nesse ponto um servidor fixo com transcrição local (Whisper) fica mais barato por cliente. Veja a conversa de planejamento da feature pro raciocínio completo.

## Arquitetura

O bot ([Vexa](https://github.com/Vexa-ai/vexa), open source, Apache-2.0) entra na reunião de Google Meet/Teams, grava e transcreve, e avisa a Jards por webhook quando termina. Roda fora da Vercel/Supabase porque precisa de um processo contínuo (navegador headless) durante a reunião inteira — algo que função serverless não sustenta.

Este guia usa o **Vexa Lite**: um único container stateless, sem GPU, que usa transcrição externa (Deepgram) e roda no Fly.io, que cobra por segundo de uso real e desliga sozinho quando ocioso.

## 1. Banco de dados

O Vexa Lite precisa de um Postgres próprio (`DATABASE_URL`). **Não reutilize o Postgres de produção da Jards** — crie um projeto Supabase novo e separado, só pra isso:

1. [supabase.com/dashboard](https://supabase.com/dashboard) → New Project → nome sugerido: `jards-vexa`.
2. Depois de criado, em **Project Settings → Database**, copie a *Connection string* (modo "URI", com a senha já preenchida).

## 2. Conta Fly.io

```bash
# Instalar a CLI (macOS/Linux)
curl -L https://fly.io/install.sh | sh

# Logar (abre o navegador)
fly auth login
```

Se ainda não tiver conta, o `fly auth login` oferece criar uma. Vai pedir cartão de crédito mesmo no uso pay-as-you-go (é assim que o Fly.io cobra pelo consumo real).

## 3. Chave de transcrição

O Vexa Lite transcreve via provedor externo. Pegue a chave em [staging.vexa.ai/dashboard/transcription](https://staging.vexa.ai/dashboard/transcription) (`TRANSCRIBER_API_KEY`), ou configure sua própria conta Deepgram se preferir não depender do painel do Vexa.

## 4. Deploy

```bash
git clone https://github.com/Vexa-ai/vexa-lite-deploy.git
cd vexa-lite-deploy/fly

chmod +x deploy.sh
./deploy.sh
```

Se o script pedir confirmação de nome do app, sugerido: `jards-vexa`.

Configurar os segredos (troque pelos valores reais):

```bash
fly secrets set \
  DATABASE_URL="postgresql://postgres:SENHA@db.xxxxx.supabase.co:5432/postgres" \
  ADMIN_API_TOKEN="gere um token aleatório longo, ex: openssl rand -hex 32" \
  TRANSCRIBER_API_KEY="chave do passo 3" \
  -a jards-vexa

fly deploy -a jards-vexa
```

Ao final, confirme a URL pública:

```bash
fly status -a jards-vexa
```

Deve aparecer algo como `https://jards-vexa.fly.dev` — HTTPS já incluso, sem configurar nada.

## 5. Testar antes de ligar na Jards

Faça uma chamada de teste na própria API (troque a URL e o token):

```bash
curl -X POST https://jards-vexa.fly.dev/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SEU_ADMIN_API_TOKEN" \
  -d '{
    "meeting_url": "https://meet.google.com/xxx-xxxx-xxx",
    "platform": "google_meet",
    "bot_name": "Jards (teste)"
  }'
```

Confirme que o bot pede pra entrar numa reunião de teste real (Meet e depois Teams) e que a transcrição sai coerente antes de apontar a Jards pra produção.

⚠️ **O contrato exato da API (nomes de campo, formato do webhook) pode não bater 100% com o que foi assumido em `lib/reunioes/vexa.ts` e `app/api/reunioes/webhook/route.ts`** — esses arquivos foram escritos com base na documentação pública, sem acesso a uma instância viva. Ajuste conforme a resposta real da chamada acima.

## 6. Ligar na Jards

No ambiente de produção da Vercel (Project Settings → Environment Variables), configure:

```bash
VEXA_API_URL=https://jards-vexa.fly.dev
VEXA_API_KEY=<o ADMIN_API_TOKEN do passo 4>
VEXA_WEBHOOK_SECRET=<gere outro token aleatório>
```

E no webhook, aponte pra `https://<seu-dominio-jards>/api/reunioes/webhook`, usando o mesmo valor de `VEXA_WEBHOOK_SECRET` no cabeçalho `x-vexa-webhook-secret` (ajuste o nome do cabeçalho se o Vexa usar outro).

## Checklist antes de anunciar a feature pros clientes

- [ ] Testou entrada real em reunião de Google Meet
- [ ] Testou entrada real em reunião de Microsoft Teams
- [ ] Confirmou que a transcrição chega na Jards via webhook (não só via consulta manual)
- [ ] Confirmou o custo real de algumas horas de uso na fatura do Fly.io e do provedor de transcrição
- [ ] Revisou o aviso de consentimento/LGPD mostrado aos participantes da reunião
