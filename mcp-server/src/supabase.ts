import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.JARDS_USER_EMAIL;
const password = process.env.JARDS_USER_PASSWORD;

if (!url || !anonKey) {
  throw new Error(
    "Jards MCP: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente."
  );
}
if (!email || !password) {
  throw new Error(
    "Jards MCP: defina JARDS_USER_EMAIL e JARDS_USER_PASSWORD — o servidor se autentica como o próprio usuário " +
      "(mesma conta usada para logar no Jards), nunca com uma chave admin, para que o RLS do Supabase limite cada " +
      "pessoa apenas às organizações e dados que ela já pode ver no app."
  );
}

/**
 * Client anon-key + sessão de usuário real, NUNCA service role. Toda leitura e
 * escrita passa pelas policies de RLS do banco — a mesma barreira que protege o
 * app web — então este servidor não tem acesso a nada que o usuário logado não
 * teria. Isso inclui o corte por organização e o consumo de créditos ao
 * desbloquear contatos (fn_desbloquear_empresa), que já existe no produto.
 */
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: true },
});

let signInPromise: Promise<void> | null = null;

export function ensureAuthenticated(): Promise<void> {
  if (!signInPromise) {
    signInPromise = supabase.auth
      .signInWithPassword({ email: email!, password: password! })
      .then(({ error }) => {
        if (error) {
          signInPromise = null;
          throw new Error(`Jards MCP: falha ao autenticar como ${email}: ${error.message}`);
        }
      });
  }
  return signInPromise;
}
