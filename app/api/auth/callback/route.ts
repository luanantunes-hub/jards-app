import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      const redirectUrl = next.startsWith("/") ? `${origin}${next}` : `${origin}/dashboard`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
