import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse, requireWriteScope, resolveOrgId, type McpAuthContext } from "@/lib/mcp/auth";
import type { Admin } from "@/lib/mcp/crm";
import { ErroMcp, type Corpo } from "@/lib/mcp/validacao";

export interface ContextoDaRota {
  req: NextRequest;
  /** Quem autorizou o acesso (dono da chave). */
  ctx: McpAuthContext;
  orgId: string;
  admin: Admin;
  query: URLSearchParams;
  /** Corpo JSON dos pedidos que não são GET. */
  corpo: Corpo;
  /** Parâmetro {id} do caminho, quando a rota tem. */
  id: string | null;
  /** Endereço do site (ex.: https://jards.com.br), para montar os links das telas. */
  origem: string;
}

export type ParametrosDaRota = { params: Promise<Record<string, string>> };

/** Contexto sem parâmetros de caminho, para chamar uma rota direto (o Next sempre entrega esse segundo argumento). */
export const SEM_PARAMETROS: ParametrosDaRota = { params: Promise.resolve({}) };

/** Autenticação e banco das rotas. Em produção são sempre os de verdade; os testes trocam por versões falsas. */
export const dependenciasDaRota = { autenticar: authenticateMcpRequest, criarAdmin: createAdminClient };

/**
 * Casca das rotas do conector: confere a chave, o escopo de escrita e a organização, lê o corpo e transforma
 * qualquer ErroMcp em resposta JSON com o status certo. Quem chama só escreve o que a rota faz.
 */
export function rotaMcp(opcoes: { escrita: boolean }, executar: (contexto: ContextoDaRota) => Promise<NextResponse>) {
  // O segundo argumento é obrigatório no tipo: o Next confere isso no build (RouteContext) e sempre o entrega.
  return async (req: NextRequest, rota: ParametrosDaRota): Promise<NextResponse> => {
    const ctx = await dependenciasDaRota.autenticar(req);
    if (isErrorResponse(ctx)) return ctx;
    if (opcoes.escrita) {
      const semEscrita = requireWriteScope(ctx);
      if (semEscrita) return semEscrita;
    }

    try {
      let corpo: Corpo = {};
      if (req.method !== "GET") {
        const bruto: unknown = await req.json().catch(() => null);
        if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) throw new ErroMcp(400, "Envie os dados como um objeto JSON.");
        corpo = bruto as Corpo;
      }

      const query = req.nextUrl.searchParams;
      const pedida = req.method === "GET" ? query.get("organization_id") : (corpo.organization_id as string | undefined) ?? null;
      const orgId = resolveOrgId(ctx, typeof pedida === "string" && pedida ? pedida : null);
      if (isErrorResponse(orgId)) return orgId;

      const id = (rota ? (await rota.params).id : null) ?? null;
      return await executar({ req, ctx, orgId, admin: dependenciasDaRota.criarAdmin(), query, corpo, id, origem: req.nextUrl.origin });
    } catch (erro) {
      if (erro instanceof ErroMcp) return NextResponse.json({ error: erro.message, ...erro.extra }, { status: erro.status });
      console.error("[mcp] erro inesperado em", req.method, req.nextUrl.pathname, erro);
      return NextResponse.json({ error: "Não foi possível concluir. Tente de novo em instantes." }, { status: 500 });
    }
  };
}

export function resposta(dados: unknown, status = 200): NextResponse {
  return NextResponse.json(dados, { status });
}
