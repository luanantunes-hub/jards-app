import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OAUTH_CODE_TTL_MS, generateOpaqueToken, isAllowedRedirectUri, normalizeScope } from "@/lib/mcp/oauth";

/** Processa o botão Permitir/Negar da tela de consentimento OAuth. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const form = await req.formData();
  const clientId = String(form.get("client_id") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const state = String(form.get("state") ?? "");
  const scope = normalizeScope(String(form.get("scope") ?? ""));
  const codeChallenge = form.get("code_challenge") ? String(form.get("code_challenge")) : null;
  const codeChallengeMethod = form.get("code_challenge_method") ? String(form.get("code_challenge_method")) : null;
  const negado = form.has("deny");

  if (clientId !== process.env.OAUTH_CHATGPT_CLIENT_ID || !isAllowedRedirectUri(redirectUri)) {
    return NextResponse.json({ error: "Pedido de autorização inválido" }, { status: 400 });
  }

  const callback = new URL(redirectUri);
  if (state) callback.searchParams.set("state", state);

  if (negado) {
    callback.searchParams.set("error", "access_denied");
    return NextResponse.redirect(callback, { status: 303 });
  }

  const { raw, hash } = generateOpaqueToken("jards_oauth_code_");
  const admin = createAdminClient();
  const { error } = await admin.from("oauth_authorization_codes").insert({
    code_hash: hash,
    user_id: user.id,
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    expires_at: new Date(Date.now() + OAUTH_CODE_TTL_MS).toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  callback.searchParams.set("code", raw);
  return NextResponse.redirect(callback, { status: 303 });
}
