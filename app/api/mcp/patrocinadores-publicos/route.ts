import { NextRequest, NextResponse } from "next/server";
import { isErrorResponse, resolveOrgId } from "@/lib/mcp/auth";
import { buscarBasePublica, creditosDisponiveis, fichaDaEmpresaPublica } from "@/lib/mcp/basePublica";
import { dependenciasDaRota } from "@/lib/mcp/rota";
import { ErroMcp, paginacao, paramTexto, paramUf } from "@/lib/mcp/validacao";

/**
 * Base pública de empresas/patrocinadores, compartilhada entre todos os clientes — não é a carteira da organização.
 * A busca vale para nome, cidade e setor; cidade, estado e setor também filtram à parte. Devolve o total do resultado
 * e a próxima página, e diz quantos contatos cada empresa tem e quanto custa liberá-los.
 */
export async function GET(req: NextRequest) {
  const ctx = await dependenciasDaRota.autenticar(req);
  if (isErrorResponse(ctx)) return ctx;

  try {
    const query = req.nextUrl.searchParams;

    // A organização é opcional aqui: sem ela a base continua consultável, só não dá para dizer o que já está liberado.
    const pedida = query.get("organization_id");
    const resolvida = resolveOrgId(ctx, pedida || null);
    if (isErrorResponse(resolvida) && pedida) return resolvida;
    const orgId = isErrorResponse(resolvida) ? null : resolvida;

    const { limite, deslocamento } = paginacao(query);
    const admin = dependenciasDaRota.criarAdmin();
    const { empresas, total } = await buscarBasePublica(admin, {
      orgId,
      busca: paramTexto(query, "busca"),
      cidade: paramTexto(query, "cidade"),
      estado: paramUf(query, "estado"),
      setor: paramTexto(query, "setor"),
      limite,
      deslocamento,
    });

    const proximo = deslocamento + empresas.length;
    return NextResponse.json({
      patrocinadores: empresas.map(fichaDaEmpresaPublica),
      total,
      limite,
      deslocamento,
      proximo_deslocamento: proximo < total ? proximo : null,
      ...(orgId ? { creditos_disponiveis: await creditosDisponiveis(admin, orgId) } : {}),
    });
  } catch (erro) {
    if (erro instanceof ErroMcp) return NextResponse.json({ error: erro.message, ...erro.extra }, { status: erro.status });
    console.error("[mcp] erro inesperado em", req.method, req.nextUrl.pathname, erro);
    return NextResponse.json({ error: "Não foi possível concluir. Tente de novo em instantes." }, { status: 500 });
  }
}
