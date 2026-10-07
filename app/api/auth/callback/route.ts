import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerOrigem } from "@/lib/origem-cadastro";

// Conta criada há menos que isso ainda é cadastro novo, não login.
const CONTA_NOVA_MS = 15 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Marca convites de equipe como aceitos depois que o usuário conclui o login.
      await supabase.rpc("accept_my_organization_invitations");
      await registrarOrigemDoCadastro(supabase, searchParams);
      const redirectUrl = next.startsWith("/") ? `${origin}${next}` : `${origin}/dashboard`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

// Cadastro com Google: a origem chega pelo endereço de retorno (o cadastro só
// inclui o clique do anúncio com o aceite) e fica na conta, se ela for nova.
async function registrarOrigemDoCadastro(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: URLSearchParams,
) {
  const origem = lerOrigem(params, true);
  if (!origem) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.user_metadata?.origem_cadastro) return;
    if (Date.now() - new Date(user.created_at).getTime() > CONTA_NOVA_MS) return;
    await supabase.auth.updateUser({ data: { origem_cadastro: origem } });
  } catch {
    // A origem é medição; nunca impede o login.
  }
}
