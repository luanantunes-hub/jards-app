import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OAUTH_CODE_TTL_MS, generateOpaqueToken, normalizeScope, validateAuthorizationRequest } from "@/lib/mcp/oauth";
import { modulosQueAPessoaPodeAutorizar } from "@/lib/mcp/auth";
import { modulosAutorizados } from "@/lib/mcp/consentimento";
import { paginaDeRetorno } from "@/lib/mcp/retorno-oauth";

/** Devolve a pessoa ao assistente por uma página com refresh (um redirect direto do formulário é bloqueado pela política de segurança). */
function voltarAoAssistente(destino: URL, titulo: string, mensagem: string) {
  return new NextResponse(paginaDeRetorno({ destino: destino.toString(), titulo, mensagem }), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

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
  const codeChallenge = form.get("code_challenge") ? String(form.get("code_challenge")) : null;
  const codeChallengeMethod = form.get("code_challenge_method") ? String(form.get("code_challenge_method")) : null;
  const resource = form.get("resource") ? String(form.get("resource")) : undefined;
  const negado = form.has("deny");

  const admin = createAdminClient();
  const validacao = await validateAuthorizationRequest(
    admin,
    {
      responseType: "code",
      clientId,
      redirectUri,
      codeChallenge: codeChallenge ?? undefined,
      codeChallengeMethod: codeChallengeMethod ?? undefined,
      resource,
    },
    req.nextUrl.origin
  );
  if (!validacao.ok) {
    return NextResponse.json({ error: "Pedido de autorização inválido", detalhes: validacao.errors }, { status: 400 });
  }

  // ChatGPT: o escopo vem do pedido. Assistentes MCP (Claude): quem autoriza decide, e o padrão é só leitura.
  const scopeDoPedido = String(form.get("scope") ?? "");
  const scope = validacao.client.kind === "chatgpt" ? normalizeScope(scopeDoPedido) : form.has("escrita") ? "write" : "read";

  const callback = new URL(redirectUri);
  if (state) callback.searchParams.set("state", state);
  const assistente = validacao.client.kind === "chatgpt" ? "ChatGPT" : validacao.client.name;

  if (negado) {
    callback.searchParams.set("error", "access_denied");
    return voltarAoAssistente(callback, "Acesso negado", `Você negou o acesso. Voltando ao ${assistente}…`);
  }

  // O que a pessoa pode autorizar é recalculado aqui: o formulário só diz o que ela escolheu, nunca o que ela pode.
  const disponiveis = await modulosQueAPessoaPodeAutorizar(admin, { id: user.id, email: user.email });
  if (disponiveis.length === 0) {
    callback.searchParams.set("error", "access_denied");
    callback.searchParams.set("error_description", "Assinatura necessária");
    return voltarAoAssistente(callback, "Assinatura necessária", `O acesso por assistentes está nos planos pagos. Voltando ao ${assistente}…`);
  }

  const modulos = modulosAutorizados({
    cliente: validacao.client.kind,
    scope: scopeDoPedido,
    formulario: form,
    disponiveis,
  });
  if (modulos.length === 0) {
    callback.searchParams.set("error", "access_denied");
    callback.searchParams.set("error_description", "Nenhum módulo liberado");
    return voltarAoAssistente(callback, "Nenhum módulo liberado", `Nenhum módulo do Jards ficou liberado para este acesso. Voltando ao ${assistente}…`);
  }

  const { raw, hash } = generateOpaqueToken("jards_oauth_code_");
  const { error } = await admin.from("oauth_authorization_codes").insert({
    code_hash: hash,
    user_id: user.id,
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    modulos,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    expires_at: new Date(Date.now() + OAUTH_CODE_TTL_MS).toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  callback.searchParams.set("code", raw);
  return voltarAoAssistente(callback, "Acesso autorizado", `Pronto, acesso autorizado. Voltando ao ${assistente}…`);
}
