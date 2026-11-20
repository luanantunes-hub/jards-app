import "server-only";

// Conferência da assinatura dos webhooks do Resend, que segue o padrão Svix:
// o conteúdo assinado é "<svix-id>.<svix-timestamp>.<corpo>", com HMAC-SHA256
// na chave do segredo (whsec_<base64>), e o cabeçalho svix-signature traz uma
// ou mais assinaturas "v1,<base64>". Um evento com mais de 5 minutos é recusado.

import { conferirAssinaturaSvix } from "./svix";

export function webhookDoResendValido(cabecalhos: Headers, corpo: string, segredo: string, agora = Date.now()): boolean {
  return conferirAssinaturaSvix({
    segredo,
    id: cabecalhos.get("svix-id"),
    timestamp: cabecalhos.get("svix-timestamp"),
    assinaturas: cabecalhos.get("svix-signature"),
    corpo,
    agora,
  });
}
