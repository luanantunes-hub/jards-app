import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRegistrableRedirectUri } from "@/lib/mcp/oauth";

const NO_STORE = { "Cache-Control": "no-store" };

function erro(error: string, description: string) {
  return NextResponse.json({ error, error_description: description }, { status: 400, headers: NO_STORE });
}

/**
 * Registro dinâmico de cliente (RFC 7591) para assistentes que falam MCP, como o Claude.
 * Só clientes públicos (sem segredo, PKCE) e só com callback do Claude ou loopback: o
 * redirect_uri é o que impede o código de autorização de ir parar em outro lugar.
 */
export async function POST(req: NextRequest) {
  const corpo = await req.json().catch(() => null);
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    return erro("invalid_client_metadata", "Envie um JSON com os metadados do cliente.");
  }
  const { redirect_uris, client_name, token_endpoint_auth_method, grant_types, response_types } = corpo as Record<string, unknown>;

  if (!Array.isArray(redirect_uris) || redirect_uris.length < 1 || redirect_uris.length > 5) {
    return erro("invalid_redirect_uri", "redirect_uris deve ter de 1 a 5 endereços.");
  }
  if (!redirect_uris.every((uri) => typeof uri === "string" && isRegistrableRedirectUri(uri))) {
    return erro("invalid_redirect_uri", "Só são aceitos o callback do Claude ou endereços de loopback (http://localhost).");
  }
  if (token_endpoint_auth_method !== undefined && token_endpoint_auth_method !== "none") {
    return erro("invalid_client_metadata", "Só há suporte a clientes públicos (token_endpoint_auth_method=none).");
  }
  if (grant_types !== undefined && (!Array.isArray(grant_types) || !grant_types.every((g) => g === "authorization_code" || g === "refresh_token"))) {
    return erro("invalid_client_metadata", "grant_types aceitos: authorization_code e refresh_token.");
  }
  if (response_types !== undefined && (!Array.isArray(response_types) || !response_types.every((r) => r === "code"))) {
    return erro("invalid_client_metadata", "response_types aceito: code.");
  }

  const nome = typeof client_name === "string" ? client_name.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80) : "";
  const clientName = nome || "Assistente MCP";
  const clientId = `jards_client_${crypto.randomBytes(24).toString("base64url")}`;

  const { error } = await createAdminClient()
    .from("oauth_clients")
    .insert({ client_id: clientId, client_name: clientName, redirect_uris: redirect_uris as string[] });
  if (error) {
    return NextResponse.json({ error: "server_error", error_description: "Não foi possível registrar o cliente." }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName,
      redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: NO_STORE }
  );
}
