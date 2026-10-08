import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse } from "@/lib/mcp/auth";

/** Base pública de empresas/patrocinadores, compartilhada entre todos os clientes — não é a carteira da organização. */
export async function GET(req: NextRequest) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;

  const params = req.nextUrl.searchParams;
  const busca = params.get("busca");
  const limite = Math.min(Math.max(Number(params.get("limite") ?? 20), 1), 100);

  const admin = createAdminClient();
  let query = admin.from("empresas").select("id,nome,site,cidade,estado,setor").limit(limite);
  if (busca) query = query.ilike("nome", `%${busca}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ patrocinadores: data });
}
