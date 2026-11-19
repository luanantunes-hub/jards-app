export type EmailProvider = "google" | "microsoft";

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function googleEmailRedirectUri(): string {
  return `${appUrl()}/api/email/google/callback`;
}

export function googleEmailClientId(): string {
  return process.env.GOOGLE_EMAIL_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID || "";
}

export function googleEmailClientSecret(): string {
  return process.env.GOOGLE_EMAIL_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "";
}

export function tokenSecret(): string | undefined {
  return process.env.CALENDAR_TOKEN_SECRET || process.env.CALENDAR_OAUTH_STATE_SECRET;
}

export function googleEmailConfigured(): boolean {
  return Boolean(googleEmailClientId() && googleEmailClientSecret() && tokenSecret());
}

/**
 * `gmail.readonly` lê a caixa; `gmail.send` envia o que a pessoa escreveu no Jards (etapa de escrever e agendar).
 * O envio já é pedido na conexão para a pessoa autorizar tudo de uma vez e não reconectar depois. A conexão só
 * exige a leitura (ver o retorno do Google): quem desmarcar o envio continua lendo.
 */
export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

/** O app do Azure pode ser o mesmo da agenda (MICROSOFT_CLIENT_ID): basta somar a permissão Mail.Read e o endereço de retorno do e-mail. */
export function microsoftEmailClientId(): string {
  return process.env.MICROSOFT_EMAIL_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || "";
}

export function microsoftEmailClientSecret(): string {
  return process.env.MICROSOFT_EMAIL_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || "";
}

/** `common` aceita contas de trabalho ou escola e contas pessoais (Outlook.com, Hotmail). */
export function microsoftEmailTenant(): string {
  return process.env.MICROSOFT_TENANT_ID || "common";
}

export function microsoftEmailRedirectUri(): string {
  return `${appUrl()}/api/email/microsoft/callback`;
}

export function microsoftEmailConfigured(): boolean {
  return Boolean(microsoftEmailClientId() && microsoftEmailClientSecret() && tokenSecret());
}

/** `Mail.Read` lê a caixa; `Mail.Send` envia o que a pessoa escreveu no Jards. Pedidos juntos para não reconectar depois. */
export const MICROSOFT_EMAIL_SCOPES = ["openid", "email", "offline_access", "User.Read", "Mail.Read", "Mail.Send"];
