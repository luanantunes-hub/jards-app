import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// mesmo leitor manual de .env.local usado em scripts/*.mjs e no playwright.config.ts.
const envPath = ".env.local";
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    if (!line.includes("=") || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    if (!(key in process.env)) process.env[key] = line.slice(i + 1).trim();
  }
}

// service role: usado só para limpar os dados que os próprios testes criam,
// sem depender de RLS. Nunca usar isto para ações que os testes exercitam.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// prefixo comum para tudo que os testes criam — facilita identificar e,
// se algo escapar da limpeza automática, remover manualmente depois.
export const E2E_PREFIX = "[e2e]";
export function e2eName(label: string) {
  return `${E2E_PREFIX} ${label} ${Date.now()}`;
}
