# Calendar sync push — Fase 2

> **Substituída (18/11/2026).** O envio das atividades para a agenda agora roda dentro do app (`lib/calendar/empurrar.ts`, rota `/api/calendar/push`), usando as mesmas chaves e a mesma criptografia do resto da integração, e a importação das reuniões da agenda para o Jards roda em `lib/calendar/importar.ts` (rota `/api/calendar/importar`). Esta função Deno nunca foi publicada e não precisa ser. O texto abaixo fica como histórico.

Esta Edge Function recebe o Database Webhook de `atividades` e cria, atualiza ou remove eventos no Google Calendar e no Microsoft Outlook.

## Deploy

```bash
supabase functions deploy calendar-sync-push --no-verify-jwt
supabase secrets set \
  CALENDAR_SYNC_WEBHOOK_SECRET="<gere-uma-string-longa>" \
  CALENDAR_TOKEN_SECRET="<o-mesmo-segredo-da-aplicacao-next>" \
  GOOGLE_CALENDAR_CLIENT_ID="..." \
  GOOGLE_CALENDAR_CLIENT_SECRET="..." \
  MICROSOFT_CLIENT_ID="..." \
  MICROSOFT_CLIENT_SECRET="..." \
  MICROSOFT_TENANT_ID="common" \
  CALENDAR_TIME_ZONE="America/Sao_Paulo"
```

`CALENDAR_TOKEN_SECRET` precisa ser idêntico ao segredo usado pela aplicação Next.js, pois os tokens existentes foram gravados com AES-256-GCM nessa chave.

Após o deploy, no SQL Editor, substitua `<PROJECT_REF>` e configure o disparo:

```sql
alter database postgres set app.settings.calendar_sync_push_url =
  'https://<PROJECT_REF>.supabase.co/functions/v1/calendar-sync-push';
alter database postgres set app.settings.calendar_sync_webhook_secret =
  '<o-mesmo-CALENDAR_SYNC_WEBHOOK_SECRET>';
```

Execute a migration `20260825000010_calendar_sync_push.sql` depois da `20260825000009_calendar_connections.sql`.

## Regras

- Reuniões e eventos novos vêm com sincronização marcada; os demais tipos são opt-in.
- Sem data, responsável/criador, ou conexão ativa, a atividade fica `skipped` e o CRM não falha.
- Excluir no Jards remove o evento externo. Marcar como feita mantém o evento, mas o deixa como livre.
- O trigger observa apenas campos de negócio para evitar loops com as atualizações de status.

Pull de eventos externos e conflitos pertencem à Fase 3.
