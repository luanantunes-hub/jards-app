import { NextRequest, NextResponse } from "next/server";

const CORS = { "Access-Control-Allow-Origin": "*" };

/**
 * Metadados do recurso protegido (RFC 9728): dizem ao cliente MCP, como o Claude, qual servidor
 * de autorização usar para o servidor MCP do Jards. Atende a raiz e o caminho do recurso
 * (/.well-known/oauth-protected-resource/api/mcp/server).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  if (path && path.join("/") !== "api/mcp/server") return new NextResponse(null, { status: 404 });

  const origem = req.nextUrl.origin;
  return NextResponse.json(
    {
      resource: `${origem}/api/mcp/server`,
      resource_name: "Jards",
      authorization_servers: [origem],
      bearer_methods_supported: ["header"],
      scopes_supported: ["read", "write"],
    },
    { headers: { ...CORS, "Cache-Control": "public, max-age=300" } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
}
