import { NextRequest, NextResponse } from "next/server";
import { construirSpecOpenApi } from "@/lib/mcp/openapi";

/**
 * Spec OpenAPI para configurar uma Custom GPT Action. Aponte a Action para
 * esta URL; a autenticação é "API Key" / "Bearer", com a chave gerada em
 * /configuracoes/mcp (POST /api/mcp/keys).
 */
export async function GET(req: NextRequest) {
  return NextResponse.json(construirSpecOpenApi(req.nextUrl.origin));
}
