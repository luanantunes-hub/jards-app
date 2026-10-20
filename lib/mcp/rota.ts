import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse, requireModulo, requireWriteScope, resolveOrgId, type AcessoNaOrganizacao, type McpAuthContext } from "@/lib/mcp/auth";
import type { ModuloMcp } from "@/lib/mcp/modulos";
import type { Admin } from "@/lib/mcp/crm";
import { executarComIdempotencia, impressaoDoPedido, separarChave } from "@/lib/mcp/idempotencia";
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
  /** Papel, função e situação do módulo da pessoa na organização escolhida. Só nas rotas da prestação de contas. */
  acessoNaPrestacao: AcessoNaOrganizacao | null;
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
export function rotaMcp(opcoes: { escrita: boolean; modulo?: ModuloMcp; semOrganizacao?: boolean }, executar: (contexto: ContextoDaRota) => Promise<NextResponse>) {
  const modulo = opcoes.modulo ?? "captacao";
  // O segundo argumento é obrigatório no tipo: o Next confere isso no build (RouteContext) e sempre o entrega.
  return async (req: NextRequest, rota: ParametrosDaRota): Promise<NextResponse> => {
    const ctx = await dependenciasDaRota.autenticar(req);
    if (isErrorResponse(ctx)) return ctx;
    // A chave só fala dos módulos que a pessoa autorizou: quem autorizou só a captação não chega na prestação.
    const semModulo = requireModulo(ctx, modulo);
    if (semModulo) return semModulo;
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
      // semOrganizacao: a rota é sobre a própria pessoa (ex.: em quais organizações ela usa o módulo), não sobre uma organização.
      const orgId = opcoes.semOrganizacao ? "" : resolveOrgId(ctx, typeof pedida === "string" && pedida ? pedida : null, modulo, { escrita: opcoes.escrita });
      if (isErrorResponse(orgId)) return orgId;

      const id = (rota ? (await rota.params).id : null) ?? null;
      const admin = dependenciasDaRota.criarAdmin();
      const operacao = `${req.method} ${req.nextUrl.pathname}`;
      // Nas criações, a chave de idempotência (campo ou cabeçalho) deixa repetir o pedido com segurança depois de um erro de rede.
      const pedido = opcoes.escrita ? separarChave(corpo, req.headers.get("idempotency-key")) : { chave: null, corpo };
      const acessoNaPrestacao = modulo === "prestacao" ? (ctx.prestacao?.porOrganizacao[orgId] ?? null) : null;
      const rodar = () => executar({ req, ctx, orgId, admin, query, corpo: pedido.corpo, id, origem: req.nextUrl.origin, acessoNaPrestacao });
      if (!pedido.chave) return await rodar();
      return await executarComIdempotencia(
        admin,
        { orgId, userId: ctx.userId, chave: pedido.chave, operacao, impressao: impressaoDoPedido(operacao, pedido.corpo) },
        rodar
      );
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
