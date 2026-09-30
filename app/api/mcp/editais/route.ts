import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse } from "@/lib/mcp/auth";

/** Base pública, compartilhada entre todos os clientes do Jards — não é escopada por organização. */
export async function GET(req: NextRequest) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;

  const params = req.nextUrl.searchParams;
  const busca = params.get("busca");
  const apenasAtivos = params.get("apenas_ativos") !== "false";
  const limite = Math.min(Math.max(Number(params.get("limite") ?? 20), 1), 100);

  const admin = createAdminClient();
  let query = admin
    .from("editais")
    .select("id,titulo,data_abertura,data_fechamento,url_acesso,ativo")
    .order("data_fechamento", { ascending: true })
    .limit(limite);
  if (busca) query = query.ilike("titulo", `%${busca}%`);
  if (apenasAtivos) query = query.eq("ativo", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ editais: data });
}
