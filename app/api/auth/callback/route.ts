import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { lerOrigem } from "@/lib/origem-cadastro";

// Conta criada há menos que isso ainda é cadastro novo, não login.
const CONTA_NOVA_MS = 15 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Convite de equipe (inviteUserByEmail): o Supabase devolve a sessão no fragmento do endereço (#access_token=...),
  // que o servidor não lê, e sem "code". A tela /aceitar-convite lê o fragmento, pede a senha e aceita o convite.
  // O navegador leva o fragmento junto no redirecionamento. Erros do provedor (?error=, ?error_code=) seguem para o login.
  if (!code && !searchParams.get("error") && !searchParams.get("error_code") && !searchParams.get("error_description")) {
    const destinoDoConvite = next.startsWith("/") ? next : "/dashboard";
    return NextResponse.redirect(`${origin}/aceitar-convite?next=${encodeURIComponent(destinoDoConvite)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Marca convites de equipe como aceitos depois que o usuário conclui o login.
      const { error: aceiteError } = await supabase.rpc("accept_my_organization_invitations");
      if (aceiteError) console.error("Falha ao aceitar convites de equipe", aceiteError.message);
      const destino = next.startsWith("/") ? next : "/dashboard";

      const { data: { user } } = await supabase.auth.getUser();
      const contaNova = !!user && Date.now() - new Date(user.created_at).getTime() <= CONTA_NOVA_MS;
      if (user && contaNova) await registrarOrigemDoCadastro(supabase, user, searchParams);

      // Cadastro novo com Google passa pela página que avisa o Google Ads.
      if (user && contaNova && user.app_metadata?.provider === "google") {
        return NextResponse.redirect(`${origin}/cadastro/concluido?next=${encodeURIComponent(destino)}`);
      }
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

// Cadastro com Google: a origem chega pelo endereço de retorno (o cadastro só
// inclui o clique do anúncio com o aceite) e fica na conta nova.
async function registrarOrigemDoCadastro(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
  params: URLSearchParams,
) {
  const origem = lerOrigem(params, true);
  if (!origem || user.user_metadata?.origem_cadastro) return;
  try {
    await supabase.auth.updateUser({ data: { origem_cadastro: origem } });
  } catch {
    // A origem é medição; nunca impede o login.
  }
}
