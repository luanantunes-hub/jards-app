# Gravador de reuniões — estudo de viabilidade (Read.ai clone)

## Como funciona o Read.ai (e concorrentes)

Todos os grandes players usam o modelo de **bot participante**: um serviço entra na reunião como um "convidado" silencioso, capta os streams de áudio/vídeo diretamente e envia para transcrição em tempo real. O usuário final recebe o resumo depois.

A alternativa para usuários individuais é a **extensão de browser**, que captura o que o microfone local mistura.

---

## Modelo de negócio real do Read.ai (preços 2026)

| Plano | Anual/usuário | Mensal/usuário |
|---|---|---|
| Grátis | — | 5 reuniões/mês |
| Pro | $15 | $19,75 |
| Enterprise | $22,50 (mín. 5 seats) | $29,75 |
| Empresa+ | $29,75 | $39,75 |

**Economia por usuário Pro:**
- Custo AI (transcrição + sumarização + infra): ~$3,80/mês
- Receita: $15/mês
- Margem bruta estimada: ~75%

**Motor de crescimento:** freemium → expansão por seat → lock-in via integrações (Salesforce, HubSpot, Jira, Notion) → upsell enterprise por compliance (HIPAA, SAML).

**Diferencial do Read.ai:** meeting coach com métricas de engajamento (quem falou quanto, sentimento), busca corporativa cross-reuniões, integra email + Slack + calendário.

**Principais competidores:** Fireflies.ai ($10), Otter.ai ($10–17), Fathom ($15, generoso no free), Microsoft Copilot ($30, nativo no Teams).

---

## As 4 abordagens, do mais simples ao mais difícil

### 1. App desktop (captura de áudio do sistema) — Dificuldade 4/10
- Captura o áudio de saída do sistema operacional (o que você ouve)
- Funciona com qualquer plataforma: Meet, Teams, Zoom, qualquer coisa
- Tools: `PortAudio`, `CoreAudio` (macOS), `WASAPI` (Windows), ou `SoX`
- Transcrição: envia chunks para Whisper API ou roda localmente com `whisper.cpp`
- **Limitação**: só capta a mistura local, sem diarização confiável
- **Quando usar**: MVP rápido, produto de uso pessoal

### 2. Extensão de browser — Dificuldade 6/10
- Usa `chrome.tabCapture.capture()` ou `getDisplayMedia({ audio: true })` para capturar a aba
- Capta todo o áudio que o usuário ouve (todos os participantes misturados)
- Envia chunks de 5–30s para o servidor → Whisper → diarização → transcrição
- **Complexidade extra**: aprovação na Chrome Web Store é difícil (política contra malware/spyware)
- Stack: TypeScript + `MediaRecorder` API + WebSocket para streaming

### 3. Bot Teams via Microsoft Graph Communications API — Dificuldade 7/10
- Microsoft tem API oficial para bots em reuniões
- O bot entra como participante via convite ou link
- Recebe streams de mídia em tempo real (RTP) via `Media.Bot.SDK`
- Acesso a streams por participante (diarização nativa)
- Requer: Azure AD app registration, tenant admin consent, Bot Framework

### 4. Bot Google Meet (headless Chrome) — Dificuldade 9/10
- Não há API oficial de bot/gravação para Meet
- Read.ai e Fireflies usam Chrome headless (Puppeteer/Playwright) que entra como "convidado real"
- Altamente frágil: quebra a cada update do Meet, viola ToS do Google
- **Não recomendado** para um produto sério

---

## Custo de operação por usuário (média 8h reuniões/mês)

| Serviço | Custo/hora | Custo mensal |
|---|---|---|
| AssemblyAI (transcrição + diarização) | $0,65/h | $5,20 |
| Claude/GPT (resumo por reunião) | ~$0,005/reunião | ~$0,20 |
| Supabase Storage (áudio bruto) | ~$0,01/h | $0,08 |
| **Total** | | **~$5,50/usuário/mês** |

Break-even vs Read.ai Pro ($15): a partir de ~30 usuários internos já compensa financeiramente construir.

---

## Stack técnico recomendado

```
Extensão Chrome    →  getDisplayMedia + MediaRecorder (WAV/opus chunks)
WebSocket          →  chunks de 10s para o servidor (Node.js/Hono)
Transcrição        →  AssemblyAI Real-Time (inclui diarização)
                      OU Whisper API ($0,36/h, sem diarização nativa)
Sumarização        →  Claude haiku-4-5 (custo) ou sonnet (qualidade)
Storage            →  Supabase Storage (áudio) + Supabase DB (transcrições)
Frontend           →  Next.js + Supabase Realtime (transcrição ao vivo)
```

---

## Roadmap de desenvolvimento (1 desenvolvedor)

| Fase | Entrega | Tempo |
|---|---|---|
| 1 | Extensão Chrome → grava → transcreve → mostra texto | 3–4 semanas |
| 2 | Resumo automático (action items, decisões) com Claude | +1 semana |
| 3 | Diarização básica (separar falas) | +2 semanas |
| 4 | Bot Teams via Graph API (stream por participante) | +6–8 semanas |
| 5 | Dashboard, busca, integrações (Notion, CRM) | +2–3 meses |

---

## Bloqueadores reais (não técnicos)

1. **Chrome Web Store**: aprovação de extensão de gravação é difícil e demorada
2. **LGPD / consentimento**: bot precisa notificar participantes antes de gravar (como Read.ai faz via mensagem no chat)
3. **Google Meet**: sem API oficial — headless Chrome é frágil e viola ToS; extensão é a única abordagem estável

---

## Questões legais

- No Brasil: gravação sem consentimento viola a LGPD e pode configurar crime
- O bot/extensão precisa notificar TODOS os participantes antes de gravar
- Read.ai faz isso com uma mensagem automática no chat da reunião quando o bot entra
- Para uso corporativo (Teams Enterprise): o admin do tenant pode habilitar gravação sem alerta individual

---

## Viabilidade por contexto

| Contexto | Vale construir? |
|---|---|
| Uso interno (10–30 pessoas) | Sim — extensão + Whisper, 4–6 semanas |
| Produto SaaS competindo com Read.ai | 3+ devs, 6–12 meses de runway |
| **Feature dentro do Jards CRM** | **Sim** — extensão detecta reunião com contato Jards, grava, sumariza e salva direto na captação/contato |

## Oportunidade direta para o Jards

Extensão Chrome que detecta reunião com um contato do CRM, grava, sumariza com Claude e abre sidebar para salvar o resumo direto no deal/captação — sem precisar de aprovação de marketplace nem de bot externo. É o diferencial mais direto: o CRM já sabe quem é o contato, a reunião vira automaticamente uma atividade registrada.
