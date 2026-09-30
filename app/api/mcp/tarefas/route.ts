import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse, resolveOrgId } from "@/lib/mcp/auth";

export async function GET(req: NextRequest) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;

  const params = req.nextUrl.searchParams;
  const orgId = resolveOrgId(ctx, params.get("organization_id"));
  if (isErrorResponse(orgId)) return orgId;

  const responsavelId = params.get("responsavel_id");
  const apenasPendentes = params.get("apenas_pendentes") === "true";
  const limite = Math.min(Math.max(Number(params.get("limite") ?? 20), 1), 100);

  const admin = createAdminClient();
  let query = admin
    .from("tarefas")
    .select("id,titulo,tipo,status,data_prazo,data_conclusao,responsavel_id,captacao_id,created_at")
    .eq("organization_id", orgId)
    .order("data_prazo", { ascending: true, nullsFirst: false })
    .limit(limite);
  if (responsavelId) query = query.eq("responsavel_id", responsavelId);
  if (apenasPendentes) query = query.in("status", ["pendente", "em_andamento"]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tarefas: data });
}

export async function POST(req: NextRequest) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;

  const body = await req.json().catch(() => ({}));
  const orgId = resolveOrgId(ctx, body.organization_id ?? null);
  if (isErrorResponse(orgId)) return orgId;

  if (!body.titulo || typeof body.titulo !== "string" || !body.titulo.trim()) {
    return NextResponse.json({ error: "Informe titulo" }, { status: 400 });
  }

  const campos = {
    titulo: body.titulo.trim(),
    tipo: body.tipo ?? "tarefa",
    status: body.status ?? "pendente",
    data_prazo: body.data_prazo ?? null,
    responsavel_id: body.responsavel_id ?? null,
    captacao_id: body.captacao_id ?? null,
  };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tarefas")
    .insert({ organization_id: orgId, account_id: ctx.userId, ...campos })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tarefa: data }, { status: 201 });
}
