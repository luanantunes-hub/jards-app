import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse, requireModulo, resolveOrgId } from "@/lib/mcp/auth";

export async function GET(req: NextRequest) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;
  // Esta rota é da captação: uma chave que só autorizou a prestação de contas não passa.
  const semModulo = requireModulo(ctx, "captacao");
  if (semModulo) return semModulo;

  const params = req.nextUrl.searchParams;
  const orgId = resolveOrgId(ctx, params.get("organization_id"));
  if (isErrorResponse(orgId)) return orgId;

  const empresaCrmId = params.get("empresa_crm_id");
  if (!empresaCrmId) return NextResponse.json({ error: "Informe empresa_crm_id" }, { status: 400 });

  const admin = createAdminClient();

  const { data: empresa, error: empresaError } = await admin
    .from("empresas_crm")
    .select("id,nome,setor,tipo,ja_patrocina_cultura,ja_patrocina_esporte")
    .eq("organization_id", orgId)
    .eq("id", empresaCrmId)
    .single();
  if (empresaError) return NextResponse.json({ error: empresaError.message }, { status: 404 });

  const { data: vendas, error: vendasError } = await admin
    .from("vendas_patrocinio")
    .select("id,projeto_id,valor_vendido,quantidade,vendida_em")
    .eq("organization_id", orgId)
    .eq("empresa_crm_id", empresaCrmId)
    .order("vendida_em", { ascending: false });
  if (vendasError) return NextResponse.json({ error: vendasError.message }, { status: 500 });

  const projetoIds = [...new Set((vendas ?? []).map((v) => v.projeto_id))];
  let projetosPorId = new Map<string, { id: string; nome: string; fase: string; areas_culturais: string[] }>();
  if (projetoIds.length > 0) {
    const { data: projetos, error: projetosError } = await admin
      .from("projetos_crm")
      .select("id,nome,fase,areas_culturais")
      .in("id", projetoIds);
    if (projetosError) return NextResponse.json({ error: projetosError.message }, { status: 500 });
    projetosPorId = new Map((projetos ?? []).map((p) => [p.id, p]));
  }

  const historico = (vendas ?? []).map((v) => ({
    projeto_id: v.projeto_id,
    projeto_nome: projetosPorId.get(v.projeto_id)?.nome ?? null,
    projeto_fase: projetosPorId.get(v.projeto_id)?.fase ?? null,
    valor_vendido: v.valor_vendido,
    vendida_em: v.vendida_em,
  }));

  const valorTotal = historico.reduce((acc, h) => acc + (h.valor_vendido ?? 0), 0);
  const areasContagem: Record<string, number> = {};
  for (const id of projetoIds) {
    for (const area of projetosPorId.get(id)?.areas_culturais ?? []) {
      areasContagem[area] = (areasContagem[area] ?? 0) + 1;
    }
  }
  const areasRecorrentes = Object.entries(areasContagem)
    .sort((a, b) => b[1] - a[1])
    .map(([area, vezes]) => ({ area, vezes }));

  const ultimoPatrocinio = historico[0]?.vendida_em ?? null;
  const diasDesdeUltimo = ultimoPatrocinio
    ? Math.floor((Date.now() - new Date(ultimoPatrocinio).getTime()) / 86_400_000)
    : null;

  return NextResponse.json({
    empresa,
    resumo: {
      projetos_apoiados: projetoIds.length,
      patrocinios_realizados: historico.length,
      valor_total_investido: valorTotal,
      ticket_medio: historico.length > 0 ? valorTotal / historico.length : 0,
      areas_culturais_recorrentes: areasRecorrentes,
      ultimo_patrocinio_em: ultimoPatrocinio,
      dias_desde_ultimo_patrocinio: diasDesdeUltimo,
    },
    historico_patrocinios: historico,
  });
}
