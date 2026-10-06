import { NextRequest, NextResponse } from "next/server";

const CORS = { "Access-Control-Allow-Origin": "*" };

/**
 * Metadados do servidor de autorização (RFC 8414): onde o cliente MCP registra o aplicativo,
 * abre a tela de consentimento e troca o código pelo token. Só clientes públicos com PKCE S256.
 */
export async function GET(req: NextRequest) {
  const origem = req.nextUrl.origin;
  return NextResponse.json(
    {
      issuer: origem,
      authorization_endpoint: `${origem}/oauth/authorize`,
      token_endpoint: `${origem}/api/mcp/oauth/token`,
      registration_endpoint: `${origem}/api/mcp/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["read", "write"],
    },
    { headers: { ...CORS, "Cache-Control": "public, max-age=300" } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
}
