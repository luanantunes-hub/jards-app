// Quem pede e o banco das rotas de equipe (/api/members/**).
//
// As rotas conferem que quem pede é administrador da organização e só depois
// usam a chave de serviço. As duas pontas ficam aqui, num objeto que os testes
// trocam por versões falsas, no molde de dependenciasDaRota (lib/mcp/rota.ts).
// Em produção são sempre as de verdade.

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Quem está logado, lido dos cookies da requisição; null sem sessão. */
export async function usuarioAtual() {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

/** Banco com a chave de serviço: nunca antes de conferir quem pede. */
export function criarAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export const dependenciasDeEquipe = { usuarioAtual, criarAdmin };
