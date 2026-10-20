import { NextRequest, NextResponse } from "next/server";
import { ehModuloMcp, MODULO_PADRAO, MODULOS_MCP } from "@/lib/mcp/modulos";
import { construirSpecOpenApi } from "@/lib/mcp/openapi";

/**
 * Spec OpenAPI para configurar uma Custom GPT Action. Aponte a Action para
 * esta URL; a autenticação é "API Key" / "Bearer", com a chave gerada em
 * /configuracoes/mcp (POST /api/mcp/keys).
 *
 * Cada módulo tem a sua spec (uma Action aceita poucas operações): sem parâmetro é a da captação, como sempre foi;
 * `?modulo=prestacao` é a da prestação de contas, para uma segunda GPT.
 */
export async function GET(req: NextRequest) {
  const pedido = req.nextUrl.searchParams.get("modulo");
  if (pedido !== null && !ehModuloMcp(pedido)) {
    return NextResponse.json({ error: `Módulo desconhecido. Use um destes: ${MODULOS_MCP.join(", ")}.` }, { status: 400 });
  }
  return NextResponse.json(construirSpecOpenApi(req.nextUrl.origin, pedido ?? MODULO_PADRAO));
}
